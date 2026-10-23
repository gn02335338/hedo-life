import { DurableObject } from 'cloudflare:workers';
import { replayRun, VERSION, MAX_TURNS } from '../dist/engine.js';
import { ROLE_MAP } from '../dist/roles.js';
import { ENDINGS } from '../dist/endings.js';
import { ApiError, RateGuard, assertSameOrigin, bearerToken, errorResponse, json, readJson, tokenHash, validToken, validateCompletion } from './http.js';
import { validateFeedback, validatePublisherToken } from './feedback.js';
import { FeedbackStore } from './feedback-store.js';
import { AchievementStore } from './achievements.js';
import { CharacterStore } from './characters.js';
import { ObservationStore } from './observations.js';
import { AdminPrivateStore } from './admin-private.js';
import { LeaderboardStore, validateLeaderboardFilter, validateLeaderboardNickname } from './leaderboards.js';
import { deriveLeaderboardScoreV56, leaderboardEligibilityV56, SCORE_VERSION_V56 } from '../dist/leaderboard-score-v56.js';

const ENDING_IDS = new Set(ENDINGS.map(ending => ending.id));

export class HedoArchive extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.rate = new RateGuard();
    this.feedbackEnv = env;
    this.adminPrivate = null;
    this.leaderboards = null;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY,
        token_hash TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        player_id TEXT NOT NULL REFERENCES players(id),
        ending_id TEXT NOT NULL,
        role_id TEXT NOT NULL,
        actual_role_id TEXT NOT NULL,
        rank INTEGER NOT NULL,
        salary INTEGER NOT NULL,
        turns INTEGER NOT NULL,
        game_version INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS runs_player ON runs(player_id);
      CREATE INDEX IF NOT EXISTS runs_ending ON runs(ending_id);
      CREATE TABLE IF NOT EXISTS player_endings (
        player_id TEXT NOT NULL REFERENCES players(id),
        ending_id TEXT NOT NULL,
        first_seen_at TEXT NOT NULL,
        PRIMARY KEY (player_id, ending_id)
      );
    `);
    this.feedback = new FeedbackStore(this.sql, ctx.storage);
    this.achievements = new AchievementStore(this.sql, ctx.storage);
    this.characters = new CharacterStore(this.sql, ctx.storage);
    this.observations = new ObservationStore(this.sql);
    ctx.blockConcurrencyWhile(() => this.scheduleFeedbackCleanup());
  }

  async scheduleFeedbackCleanup() {
    const next = this.feedback.nextCleanup();
    if (next === null) return;
    const current = await this.ctx.storage.getAlarm();
    if (current === null || current > next) await this.ctx.storage.setAlarm(next);
  }

  async alarm() {
    this.feedback.cleanup(Date.now());
    await this.scheduleFeedbackCleanup();
  }

  playerSnapshot(playerId) {
    return {
      playerId,
      unlocked: this.sql.exec('SELECT ending_id FROM player_endings WHERE player_id = ? ORDER BY ending_id', playerId).toArray().map(row => row.ending_id),
      totalRuns: this.sql.exec('SELECT COUNT(*) AS n FROM runs WHERE player_id = ?', playerId).one().n,
      achievements: this.achievements.snapshot(playerId),
      characters: this.characters.snapshot(playerId),
    };
  }

  async authenticate(request) {
    const hash = await tokenHash(bearerToken(request));
    this.rate.check(hash);
    const row = this.sql.exec('SELECT id FROM players WHERE token_hash = ?', hash).toArray()[0];
    if (!row) throw new ApiError(401, 'unknown_player', '請先建立匿名收藏。');
    return row.id;
  }

  async register(request) {
    const body = await readJson(request);
    const hash = await tokenHash(validToken(body.token));
    this.rate.check(hash);
    let playerId;
    this.ctx.storage.transactionSync(() => {
      const existing = this.sql.exec('SELECT id FROM players WHERE token_hash = ?', hash).toArray()[0];
      playerId = existing?.id || crypto.randomUUID();
      if (!existing) this.sql.exec('INSERT INTO players (id, token_hash, created_at) VALUES (?, ?, ?)', playerId, hash, new Date().toISOString());
    });
    return json(this.playerSnapshot(playerId));
  }

  completedResponse(playerId, row, duplicate) {
    return json({
      ...this.playerSnapshot(playerId),
      runId: row.id,
      endingId: row.ending_id,
      recorded: true,
      duplicate,
    });
  }

  async complete(request) {
    const playerId = await this.authenticate(request);
    const { runId, roleId, seed, actions } = validateCompletion(await readJson(request), ROLE_MAP);
    // A retry of a committed run remains idempotent after future engine updates.
    const existing = this.sql.exec('SELECT id, player_id, role_id, ending_id FROM runs WHERE id = ?', runId).toArray()[0];
    if (existing) {
      if (existing.player_id !== playerId) throw new ApiError(409, 'run_id_conflict', '這個遊戲紀錄識別碼已使用。');
      await this.characters.assertIdentity(playerId, runId, roleId, seed);
      let replay;
      try { replay = replayRun(roleId, seed, actions); }
      catch { return this.completedResponse(playerId, existing, true); }
      if (replay.completed && replay.endingId !== existing.ending_id) {
        throw new ApiError(409, 'run_id_conflict', '這個人生編號已記錄其他結局，請保留原本的遊戲紀錄。');
      }
      // Old completions lack an action commitment, so a matching ending cannot
      // prove their historical branch. Keep the receipt without estimating it.
      if (this.characters.progress(runId)) {
        await this.characters.record(playerId, runId, replay);
        const commitment = this.characters.progress(runId);
        if (replay.completed && commitment?.completed && commitment.action_count === actions.length &&
            commitment.action_hash === await tokenHash(JSON.stringify(actions))) {
          this.ctx.storage.transactionSync(() => this.observations.record(runId, replay));
        }
      }
      return this.completedResponse(playerId, existing, true);
    }
    let run;
    try { run = replayRun(roleId, seed, actions); }
    catch { throw new ApiError(400, 'invalid_replay', '遊戲操作紀錄無法重播。'); }
    if (!run?.completed || !ENDING_IDS.has(run.endingId)) {
      throw new ApiError(400, 'incomplete_run', '這一局尚未走到結局。');
    }
    await this.characters.record(playerId, runId, run);
    await this.achievements.record(playerId, runId, run);
    const now = new Date().toISOString();
    let duplicate = false;
    this.ctx.storage.transactionSync(() => {
      const concurrent = this.sql.exec('SELECT player_id FROM runs WHERE id = ?', runId).toArray()[0];
      if (concurrent) {
        if (concurrent.player_id !== playerId) throw new ApiError(409, 'run_id_conflict', '這個遊戲紀錄識別碼已使用。');
        duplicate = true; return;
      }
      this.sql.exec(`INSERT INTO runs
        (id, player_id, ending_id, role_id, actual_role_id, rank, salary, turns, game_version, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        runId, playerId, run.endingId, run.roleId, run.actualRoleId, run.rank, run.pay, Math.min(run.turn + 1, MAX_TURNS), VERSION, now);
      this.sql.exec('INSERT OR IGNORE INTO player_endings (player_id, ending_id, first_seen_at) VALUES (?, ?, ?)', playerId, run.endingId, now);
      this.observations.record(runId, run, now);
    });
    return this.completedResponse(playerId, { id: runId, ending_id: run.endingId }, duplicate);
  }

  leaderboardStore() {
    return this.leaderboards ||= new LeaderboardStore(this.sql, this.ctx.storage);
  }

  async leaderboardSubmit(request) {
    const playerId = await this.authenticate(request);
    const body = await readJson(request);
    if (Object.keys(body).sort().join(',') !== 'actions,nickname,roleId,runId,seed') {
      throw new ApiError(400, 'invalid_leaderboard_submission', '請送出本局紀錄與這次同意公開的暱稱。');
    }
    const { runId, roleId, seed, actions } = validateCompletion(body, ROLE_MAP);
    const nickname = validateLeaderboardNickname(body.nickname);
    let run;
    try { run = replayRun(roleId, seed, actions); }
    catch { throw new ApiError(400, 'invalid_replay', '遊戲操作紀錄無法重播。'); }
    if (!run?.completed || !ENDING_IDS.has(run.endingId)) {
      throw new ApiError(400, 'incomplete_run', '這一局尚未走到結局。');
    }
    const eligibility = leaderboardEligibilityV56(run);
    if (!eligibility.eligible) throw new ApiError(400, 'ineligible_rules', eligibility.reason || '這局使用舊版規則，請開啟新人生參加本季排行榜。');
    const score = deriveLeaderboardScoreV56(run);
    const actionHash = await tokenHash(JSON.stringify(actions));
    const seedHash = await tokenHash(seed);
    const existing = this.sql.exec('SELECT * FROM runs WHERE id = ?', runId).toArray()[0];
    const assertCommitment = () => {
      const committed = this.characters.progress(runId);
      if (!committed || committed.player_id !== playerId || committed.role_id !== roleId || committed.seed_hash !== seedHash || !committed.completed || committed.ending_id !== run.endingId || committed.action_count !== actions.length || committed.action_hash !== actionHash) {
        throw new ApiError(409, 'leaderboard_commitment_conflict', '這局的完整操作與原本紀錄不一致，無法加入排行榜。');
      }
    };
    if (existing) {
      if (existing.player_id !== playerId || existing.role_id !== roleId || existing.ending_id !== run.endingId) {
        throw new ApiError(409, 'run_id_conflict', '這個人生編號已使用，請保留原本的遊戲紀錄。');
      }
      // Unlike legacy completion receipts, ranking requires the exact historical
      // action commitment, even when two branches happen to share an ending.
      assertCommitment();
    } else {
      await this.characters.record(playerId, runId, run);
      await this.achievements.record(playerId, runId, run);
    }
    const store = this.leaderboardStore(), now = new Date().toISOString();
    let entry;
    this.ctx.storage.transactionSync(() => {
      assertCommitment();
      const committed = this.sql.exec('SELECT * FROM runs WHERE id = ?', runId).toArray()[0];
      if (committed && (committed.player_id !== playerId || committed.role_id !== roleId || committed.ending_id !== run.endingId)) {
        throw new ApiError(409, 'run_id_conflict', '這個人生編號已使用，請保留原本的遊戲紀錄。');
      }
      if (!committed) {
        this.sql.exec(`INSERT INTO runs
          (id,player_id,ending_id,role_id,actual_role_id,rank,salary,turns,game_version,created_at)
          VALUES (?,?,?,?,?,?,?,?,?,?)`, runId, playerId, run.endingId, run.roleId, run.actualRoleId, run.rank, run.pay, Math.min(run.turn + 1, MAX_TURNS), VERSION, now);
        this.sql.exec('INSERT OR IGNORE INTO player_endings (player_id,ending_id,first_seen_at) VALUES (?,?,?)', playerId, run.endingId, now);
        this.observations.record(runId, run, now);
      }
      entry = store.publish(playerId, runId, run, score, nickname, now);
    });
    return json({ version: 1, scoreVersion: SCORE_VERSION_V56, published: true, entry });
  }

  async achievementProgress(request) {
    const playerId = await this.authenticate(request);
    const { runId, roleId, seed, actions } = validateCompletion(await readJson(request), ROLE_MAP);
    let run;
    try { run = replayRun(roleId, seed, actions); }
    catch { throw new ApiError(400, 'invalid_replay', '成就操作紀錄無法重播。'); }
    const historical = this.sql.exec('SELECT id FROM runs WHERE id = ?', runId).toArray()[0];
    if (historical && !this.characters.progress(runId)) await this.characters.assertIdentity(playerId, runId, roleId, seed);
    else await this.characters.record(playerId, runId, run);
    const newlyUnlocked = await this.achievements.record(playerId, runId, run);
    return json({ ...this.playerSnapshot(playerId), runId, verified: true, newlyUnlocked });
  }

  async characterProgress(request) {
    const playerId = await this.authenticate(request);
    const { runId, roleId, seed, actions } = validateCompletion(await readJson(request), ROLE_MAP);
    let run;
    try { run = replayRun(roleId, seed, actions); }
    catch { throw new ApiError(400, 'invalid_replay', '角色互動紀錄無法重播。'); }
    await this.characters.record(playerId, runId, run);
    return json({ ...this.playerSnapshot(playerId), runId, verified: true });
  }

  stats() {
    const totals = this.sql.exec('SELECT COUNT(*) AS totalRuns, COUNT(DISTINCT ending_id) AS uniqueEndings, COALESCE(AVG(turns), 0) AS averageTurns FROM runs').one();
    return json({
      players: this.sql.exec('SELECT COUNT(*) AS n FROM players').one().n,
      totalRuns: totals.totalRuns,
      uniqueEndings: totals.uniqueEndings,
      averageTurns: Math.round(totals.averageTurns * 10) / 10,
      roles: this.sql.exec('SELECT role_id AS id, COUNT(*) AS count FROM runs GROUP BY role_id ORDER BY count DESC, id').toArray(),
      endings: this.sql.exec('SELECT ending_id AS id, COUNT(*) AS count FROM runs GROUP BY ending_id ORDER BY count DESC, id').toArray(),
      daily: this.sql.exec('SELECT substr(created_at, 1, 10) AS date, COUNT(*) AS count FROM runs GROUP BY date ORDER BY date').toArray(),
      observatory: this.observations.snapshot(),
    });
  }

  async fetch(request) {
    try {
      const path = new URL(request.url).pathname;
      if (path.startsWith('/api/admin/')) {
        this.adminPrivate ||= new AdminPrivateStore(this.sql, this.feedbackEnv);
        return await this.adminPrivate.fetch(request);
      }
      if (['POST', 'DELETE', 'PATCH'].includes(request.method)) assertSameOrigin(request);
      if (path.startsWith('/api/feedback-publisher/')) {
        const token = /^Bearer (\S+)$/i.exec(request.headers.get('Authorization') || '')?.[1];
        await validatePublisherToken(token, this.feedbackEnv);
        if (request.method !== 'POST') throw new ApiError(405, 'method_not_allowed', '這個端點不接受此操作。');
        const body = await readJson(request);
        if (path === '/api/feedback-publisher/claim') return json(this.feedback.claim());
        if (path === '/api/feedback-publisher/ack') return json(this.feedback.ack(body));
      }
      if (path === '/api/feedback-config' && request.method === 'GET') return json(this.feedback.config());
      if (path === '/api/feedback' && request.method === 'POST') {
        const playerId = await this.authenticate(request);
        const payload = validateFeedback(await readJson(request));
        const receipt = await this.feedback.submit(playerId, payload, request.headers.get('CF-Connecting-IP') || '');
        await this.scheduleFeedbackCleanup();
        return json(receipt, 202);
      }
      if (path.startsWith('/api/feedback/') && request.method === 'GET') {
        return json(this.feedback.status(await this.authenticate(request), path.slice('/api/feedback/'.length)));
      }
      if (path === '/api/player' && request.method === 'POST') return await this.register(request);
      if (path === '/api/leaderboard' && request.method === 'GET') {
        this.rate.check(`leaderboard:${request.headers.get('CF-Connecting-IP') || 'unknown'}`);
        return json(this.leaderboardStore().public(validateLeaderboardFilter(new URL(request.url))));
      }
      if (path === '/api/leaderboard' && request.method === 'POST') return await this.leaderboardSubmit(request);
      if (path === '/api/leaderboard/mine' && request.method === 'GET') {
        const playerId = await this.authenticate(request), params = new URL(request.url).searchParams;
        if ([...params.keys()].some(key => key !== 'after') || params.getAll('after').length > 1) throw new ApiError(400, 'invalid_leaderboard_cursor', '留名紀錄的頁碼無效。');
        return json(this.leaderboardStore().mine(playerId, params.get('after')));
      }
      if (path.startsWith('/api/leaderboard/') && path !== '/api/leaderboard/mine' && ['DELETE', 'PATCH'].includes(request.method)) {
        const playerId = await this.authenticate(request), runId = path.slice('/api/leaderboard/'.length);
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(runId)) throw new ApiError(400, 'invalid_run_id', '遊戲紀錄識別碼無效。');
        if (request.method === 'PATCH') {
          const body = await readJson(request);
          if (Object.keys(body).join(',') !== 'nickname') throw new ApiError(400, 'invalid_leaderboard_submission', '只能修改這筆已公開紀錄的暱稱。');
          return json(this.leaderboardStore().rename(playerId, runId.toLowerCase(), validateLeaderboardNickname(body.nickname)));
        }
        return json(this.leaderboardStore().remove(playerId, runId.toLowerCase()));
      }
      if (path === '/api/me' && request.method === 'GET') return json(this.playerSnapshot(await this.authenticate(request)));
      if (path === '/api/complete' && request.method === 'POST') return await this.complete(request);
      if (path === '/api/achievements' && request.method === 'POST') return await this.achievementProgress(request);
      if (path === '/api/characters' && request.method === 'POST') return await this.characterProgress(request);
      if (path === '/api/characters' && request.method === 'GET') return json(this.characters.global());
      if (path === '/api/stats' && request.method === 'GET') return this.stats();
      if (['/api/player', '/api/me', '/api/complete', '/api/achievements', '/api/characters', '/api/stats', '/api/feedback', '/api/feedback-config', '/api/leaderboard', '/api/leaderboard/mine'].includes(path)) {
        throw new ApiError(405, 'method_not_allowed', '這個端點不接受此操作。');
      }
      throw new ApiError(404, 'not_found', '找不到這個史冊端點。');
    } catch (error) {
      return errorResponse(error);
    }
  }
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (!path.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (path === '/api/health' && request.method === 'GET') return json({ ok: true, version: 3 });
    try {
      return await env.ARCHIVE.get(env.ARCHIVE.idFromName('global-v3')).fetch(request);
    } catch (error) {
      return errorResponse(error);
    }
  },
};
