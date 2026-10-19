import { DurableObject } from 'cloudflare:workers';
import { replayRun, VERSION, MAX_TURNS } from '../dist/engine.js';
import { ROLE_MAP } from '../dist/roles.js';
import { ENDINGS } from '../dist/endings.js';
import { ApiError, RateGuard, assertSameOrigin, bearerToken, errorResponse, json, readJson, tokenHash, validToken, validateCompletion } from './http.js';

const ENDING_IDS = new Set(ENDINGS.map(ending => ending.id));

export class HedoArchive extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.rate = new RateGuard();
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
  }

  playerSnapshot(playerId) {
    return {
      playerId,
      unlocked: this.sql.exec('SELECT ending_id FROM player_endings WHERE player_id = ? ORDER BY ending_id', playerId).toArray().map(row => row.ending_id),
      totalRuns: this.sql.exec('SELECT COUNT(*) AS n FROM runs WHERE player_id = ?', playerId).one().n,
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
    const existing = this.sql.exec('SELECT id, player_id, ending_id FROM runs WHERE id = ?', runId).toArray()[0];
    if (existing) {
      if (existing.player_id !== playerId) throw new ApiError(409, 'run_id_conflict', '這個遊戲紀錄識別碼已使用。');
      return this.completedResponse(playerId, existing, true);
    }
    let run;
    try { run = replayRun(roleId, seed, actions); }
    catch { throw new ApiError(400, 'invalid_replay', '遊戲操作紀錄無法重播。'); }
    if (!run?.completed || !ENDING_IDS.has(run.endingId)) {
      throw new ApiError(400, 'incomplete_run', '這一局尚未走到結局。');
    }
    const now = new Date().toISOString();
    this.ctx.storage.transactionSync(() => {
      this.sql.exec(`INSERT INTO runs
        (id, player_id, ending_id, role_id, actual_role_id, rank, salary, turns, game_version, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        runId, playerId, run.endingId, run.roleId, run.actualRoleId, run.rank, run.pay, Math.min(run.turn + 1, MAX_TURNS), VERSION, now);
      this.sql.exec('INSERT OR IGNORE INTO player_endings (player_id, ending_id, first_seen_at) VALUES (?, ?, ?)', playerId, run.endingId, now);
    });
    return this.completedResponse(playerId, { id: runId, ending_id: run.endingId }, false);
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
    });
  }

  async fetch(request) {
    try {
      const path = new URL(request.url).pathname;
      if (request.method === 'POST') assertSameOrigin(request);
      if (path === '/api/player' && request.method === 'POST') return await this.register(request);
      if (path === '/api/me' && request.method === 'GET') return json(this.playerSnapshot(await this.authenticate(request)));
      if (path === '/api/complete' && request.method === 'POST') return await this.complete(request);
      if (path === '/api/stats' && request.method === 'GET') return this.stats();
      if (['/api/player', '/api/me', '/api/complete', '/api/stats'].includes(path)) {
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
