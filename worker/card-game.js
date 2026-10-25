import { createCardState, projectCardState, applyCardAction, grantLifeTickets, CardRuleError, CARD_CATALOG } from '../dist/cards/rules.js';
import { ApiError, tokenHash } from './http.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const keys = (value, expected) => plain(value) && Object.keys(value).sort().join(',') === expected.split(',').sort().join(',');
const cardIds = new Set(CARD_CATALOG.map(card => card.id));
const cardId = value => typeof value === 'string' && cardIds.has(value);
const invalid = () => new ApiError(400, 'invalid_card_action', '抽卡操作格式不正確，請重新整理後再試。');

// The server accepts intentions only. Balances, cards, random results, battle
// damage and revisions inside an action are never accepted from the browser.
export function validateCardActionRequest(body) {
  if (!keys(body, 'requestId,revision,action') || typeof body.requestId !== 'string' || !uuid.test(body.requestId)
      || !Number.isSafeInteger(body.revision) || body.revision < 0 || !plain(body.action)) throw invalid();
  const action = body.action;
  switch (action.type) {
    case 'start-expedition':
      if (!keys(action,'type,stage,archetype') || !Number.isInteger(action.stage) || action.stage<1 || action.stage>10 || !['evidence','slack','lick'].includes(action.archetype)) throw invalid();
      break;
    case 'expedition-room': case 'expedition-event':
      if (!keys(action,'type,choice') || !Number.isInteger(action.choice) || action.choice<0 || action.choice>1) throw invalid();
      break;
    case 'expedition-play':
      if (!keys(action,'type,handIndex') || !Number.isInteger(action.handIndex) || action.handIndex<0 || action.handIndex>9) throw invalid();
      break;
    case 'expedition-end-turn': case 'abandon-expedition':
      if (!keys(action,'type')) throw invalid();
      break;
    case 'expedition-reward':
      if (!keys(action,'type,choice') || !Number.isInteger(action.choice) || action.choice<0 || action.choice>3) throw invalid();
      break;
    case 'expedition-rest':
      if (action.choice==='heal' ? !keys(action,'type,choice') : action.choice!=='upgrade' || !keys(action,'type,choice,cardIndex') || !Number.isInteger(action.cardIndex) || action.cardIndex<0 || action.cardIndex>99) throw invalid();
      break;
    case 'draw':
      if (!keys(action, 'type,count,banner') || ![1, 10].includes(action.count)
          || !['all', 'character', 'item', 'event'].includes(action.banner)) throw invalid();
      break;
    case 'set-deck':
      if (!keys(action, 'type,characters,item,event') || !Array.isArray(action.characters)
          || action.characters.length !== 3 || new Set(action.characters).size !== 3
          || !action.characters.every(cardId) || !cardId(action.item) || !cardId(action.event)) throw invalid();
      break;
    case 'upgrade': case 'craft':
      if (!keys(action, 'type,cardId') || !cardId(action.cardId)) throw invalid();
      break;
    case 'start-battle':
      if (!keys(action, 'type,stage') || !Number.isSafeInteger(action.stage) || action.stage < 1 || action.stage > 10) throw invalid();
      break;
    case 'battle-turn':
      if ((!keys(action, 'type,move') && !keys(action, 'type,move,target'))
          || !['strike', 'guard', 'skill', 'event'].includes(action.move)
          || Object.hasOwn(action, 'target') && (!Number.isInteger(action.target) || action.target < 0 || action.target > 2)) throw invalid();
      break;
    case 'abandon-battle':
      if (!keys(action, 'type')) throw invalid();
      break;
    default: throw invalid();
  }
  return { requestId: body.requestId.toLowerCase(), revision: body.revision, action };
}

export function validateCardLifeClaim(body) {
  if (!keys(body, 'runId,roleId,seed,actions')) {
    throw new ApiError(400, 'invalid_card_claim', '請送出這局完整的人生紀錄；積分與抽卡券會由伺服器核對。');
  }
  return body;
}

export function lifeTicketAward(score, workTurns) {
  if (!Number.isSafeInteger(score) || score < 0 || !Number.isSafeInteger(workTurns) || workTurns < 0) throw invalid();
  return workTurns < 3 ? 0 : Math.min(12, 1 + Math.floor(score / 1000) + Math.floor(workTurns / 6));
}

// Battle turns are intentionally faster than career submissions. Keep their
// modest guard separate so a card session cannot consume the career quota.
export class CardRateGuard {
  constructor() { this.windows = new Map(); }
  check(key, now = Date.now()) {
    let window = this.windows.get(key);
    if (!window || now >= window.until) window = { until: now + 10_000, count: 0 };
    window.count += 1;
    this.windows.set(key, window);
    if (this.windows.size > 1_000) {
      for (const [id, value] of this.windows) if (now >= value.until) this.windows.delete(id);
      if (this.windows.size > 10_000) this.windows.delete(this.windows.keys().next().value);
    }
    if (window.count > 30) throw new ApiError(429, 'rate_limited', '出牌太快了，請稍等幾秒；已完成的操作都會保留。');
  }
}

export class CardGameStore {
  constructor(sql, storage) {
    this.sql = sql;
    this.storage = storage;
    sql.exec(`
      CREATE TABLE IF NOT EXISTS card_players (
        player_id TEXT PRIMARY KEY REFERENCES players(id),
        revision INTEGER NOT NULL CHECK(revision >= 0),
        state_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS card_action_receipts (
        player_id TEXT NOT NULL REFERENCES players(id),
        request_id TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        applied_revision INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY(player_id, request_id)
      );
      CREATE TABLE IF NOT EXISTS card_life_claims (
        run_id TEXT PRIMARY KEY REFERENCES runs(id),
        player_id TEXT NOT NULL REFERENCES players(id),
        role_id TEXT NOT NULL,
        seed_hash TEXT NOT NULL,
        action_hash TEXT NOT NULL,
        action_count INTEGER NOT NULL,
        tickets_awarded INTEGER NOT NULL CHECK(tickets_awarded >= 0 AND tickets_awarded <= 12),
        score INTEGER NOT NULL,
        work_turns INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS card_life_owner ON card_life_claims(player_id);
      CREATE UNIQUE INDEX IF NOT EXISTS card_life_identity ON card_life_claims(player_id,role_id,seed_hash);
      CREATE TABLE IF NOT EXISTS card_life_intents (
        run_id TEXT PRIMARY KEY,
        player_id TEXT NOT NULL REFERENCES players(id),
        role_id TEXT NOT NULL,
        seed_hash TEXT NOT NULL,
        action_hash TEXT NOT NULL,
        action_count INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(player_id,role_id,seed_hash)
      );
    `);
    // Earlier local previews used both five- and seven-column reservations.
    // Preserve their owner binding and add missing metadata without dropping
    // tables or replacing any card collection, claim or anonymous identity.
    const intentColumns = new Set(sql.exec('PRAGMA table_info(card_life_intents)').toArray().map(column => column.name));
    if (!intentColumns.has('action_hash')) sql.exec("ALTER TABLE card_life_intents ADD COLUMN action_hash TEXT NOT NULL DEFAULT ''");
    if (!intentColumns.has('action_count')) sql.exec('ALTER TABLE card_life_intents ADD COLUMN action_count INTEGER NOT NULL DEFAULT 0');
  }

  state(playerId) {
    const row = this.sql.exec('SELECT revision,state_json FROM card_players WHERE player_id=?', playerId).toArray()[0];
    if (row) {
      const state = JSON.parse(row.state_json);
      if (state.revision !== row.revision) throw new Error('Invalid stored card revision');
      return state;
    }
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const seed = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    const state = createCardState(seed);
    this.save(playerId, state);
    return state;
  }

  save(playerId, state) {
    this.sql.exec(`INSERT INTO card_players(player_id,revision,state_json,updated_at) VALUES(?,?,?,?)
      ON CONFLICT(player_id) DO UPDATE SET revision=excluded.revision,state_json=excluded.state_json,updated_at=excluded.updated_at`,
    playerId, state.revision, JSON.stringify(state), new Date().toISOString());
  }

  snapshot(playerId) {
    let state;
    this.storage.transactionSync(() => { state = this.state(playerId); });
    return { state: projectCardState(state) };
  }

  async action(playerId, payload) {
    const { requestId, revision, action } = validateCardActionRequest(payload);
    const canonicalAction = Object.fromEntries(Object.keys(action).sort().map(key => [key, action[key]]));
    const fingerprint = await tokenHash(JSON.stringify({ revision, action: canonicalAction }));
    let result;
    this.storage.transactionSync(() => {
      const receipt = this.sql.exec('SELECT fingerprint,applied_revision FROM card_action_receipts WHERE player_id=? AND request_id=?', playerId, requestId).toArray()[0];
      if (receipt && receipt.fingerprint !== fingerprint) throw new ApiError(409, 'card_request_conflict', '這個操作編號已用過，請更新卡牌紀錄後再試。');
      const state = this.state(playerId);
      if (receipt) {
        result = { duplicate: true, appliedRevision: receipt.applied_revision, state: projectCardState(state) };
        return;
      }
      if (state.revision !== revision) throw new ApiError(409, 'card_revision_conflict', '卡牌紀錄已在另一個分頁更新，請重新整理再操作。');
      let next;
      try { next = applyCardAction(state, action); }
      catch (error) {
        if (error instanceof CardRuleError) throw new ApiError(400, error.code, error.message);
        throw error;
      }
      if (next.revision !== state.revision + 1) throw new Error('Invalid card action revision');
      this.save(playerId, next);
      this.sql.exec('INSERT INTO card_action_receipts(player_id,request_id,fingerprint,applied_revision,created_at) VALUES(?,?,?,?,?)',
        playerId, requestId, fingerprint, next.revision, new Date().toISOString());
      result = { duplicate: false, appliedRevision: next.revision, state: projectCardState(next) };
    });
    return result;
  }

  claimReceipt(runId) {
    return this.sql.exec('SELECT * FROM card_life_claims WHERE run_id=?', runId).toArray()[0] || null;
  }

  assertClaimReceipt(receipt, playerId, proof) {
    if (receipt && (receipt.player_id !== playerId || receipt.role_id !== proof.roleId
        || receipt.seed_hash !== proof.seedHash || receipt.action_hash !== proof.actionHash || receipt.action_count !== proof.actionCount)) {
      throw new ApiError(409, 'card_claim_conflict', '這局的人生紀錄與已領取的版本不同，請保留原本的紀錄。');
    }
  }

  reserveLife(playerId, proof) {
    // Bind a canonical life before asynchronous character/achievement writes.
    // A copied proof with a new UUID must not create a second counter record,
    // even when two claims arrive concurrently or this object restarts.
    this.storage.transactionSync(() => {
      const previous = this.sql.exec('SELECT * FROM card_life_intents WHERE run_id=?', proof.runId).toArray()[0];
      if (previous && (previous.player_id !== playerId || previous.role_id !== proof.roleId || previous.seed_hash !== proof.seedHash)) {
        throw new ApiError(409, 'card_claim_conflict', '這局的人生身分與原本紀錄不同，請保留原本的紀錄。');
      }
      const identity = this.sql.exec('SELECT run_id FROM card_life_intents WHERE player_id=? AND role_id=? AND seed_hash=?', playerId, proof.roleId, proof.seedHash).toArray()[0]
        || this.sql.exec('SELECT run_id FROM card_life_claims WHERE player_id=? AND role_id=? AND seed_hash=?', playerId, proof.roleId, proof.seedHash).toArray()[0];
      if (identity && identity.run_id !== proof.runId) throw new ApiError(409, 'card_life_already_claimed', '這段人生已綁定原本的編號，換個編號也不能再領一次。請保留原本的遊戲紀錄。');
      if (!previous) this.sql.exec('INSERT INTO card_life_intents(run_id,player_id,role_id,seed_hash,action_hash,action_count,created_at) VALUES(?,?,?,?,?,?,?)',
        proof.runId, playerId, proof.roleId, proof.seedHash, proof.actionHash, proof.actionCount, new Date().toISOString());
    });
  }

  // The caller's final ownership/commitment checks and completion insert run
  // inside this transaction, beside the ticket balance and immutable receipt.
  claimLife(playerId, proof, score, workTurns, commitCompletion) {
    let result;
    this.storage.transactionSync(() => {
      const receipt = this.claimReceipt(proof.runId);
      this.assertClaimReceipt(receipt, playerId, proof);
      commitCompletion();
      this.sql.exec('UPDATE card_life_intents SET action_hash=?,action_count=? WHERE run_id=?', proof.actionHash, proof.actionCount, proof.runId);
      const state = this.state(playerId);
      if (receipt) {
        result = { ticketsAwarded: receipt.tickets_awarded, duplicate: true, score: receipt.score, workTurns: receipt.work_turns, state: projectCardState(state) };
        return;
      }
      const ticketsAwarded = lifeTicketAward(score, workTurns);
      const next = grantLifeTickets(state, { runId: proof.runId, score, workRounds: workTurns });
      if (next.revision !== state.revision + 1 || next.tickets !== state.tickets + ticketsAwarded) throw new Error('Invalid career ticket award');
      this.save(playerId, next);
      this.sql.exec(`INSERT INTO card_life_claims(run_id,player_id,role_id,seed_hash,action_hash,action_count,tickets_awarded,score,work_turns,created_at)
        VALUES(?,?,?,?,?,?,?,?,?,?)`, proof.runId, playerId, proof.roleId, proof.seedHash, proof.actionHash, proof.actionCount, ticketsAwarded, score, workTurns, new Date().toISOString());
      result = { ticketsAwarded, duplicate: false, score, workTurns, state: projectCardState(next) };
    });
    return result;
  }
}
