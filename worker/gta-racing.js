import { ApiError, tokenHash } from './http.js';
import { RACE_CATALOG } from '../dist/gta/racing-catalog.js';
import { verifyRaceProof } from '../dist/gta/racing-proof.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const conflict = () => new ApiError(409, 'gta_run_conflict', '這個賽事編號已記錄其他成績。');
export function validateGtaRaceFilter(url) {
  if ([...url.searchParams.keys()].some(key => key !== 'raceId') || url.searchParams.getAll('raceId').length !== 1
    || !RACE_CATALOG.some(race => race.id === url.searchParams.get('raceId'))) {
    throw new ApiError(400, 'invalid_gta_race', '請選擇有效的街頭賽事。');
  }
  return url.searchParams.get('raceId');
}
export class GtaRacingStore {
  constructor(sql, storage) {
    this.sql = sql; this.storage = storage;
    sql.exec(`
      CREATE TABLE IF NOT EXISTS gta_racers (
        player_id TEXT PRIMARY KEY REFERENCES players(id), driver_code TEXT NOT NULL UNIQUE
      );
      CREATE TABLE IF NOT EXISTS gta_race_submissions (
        run_id TEXT PRIMARY KEY, player_id TEXT NOT NULL REFERENCES players(id),
        proof_hash TEXT NOT NULL, race_id TEXT NOT NULL, vehicle_id TEXT NOT NULL,
        elapsed_ms INTEGER NOT NULL CHECK(elapsed_ms > 0), created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS gta_submissions_player ON gta_race_submissions(player_id);
      CREATE TABLE IF NOT EXISTS gta_race_bests (
        player_id TEXT NOT NULL REFERENCES players(id), race_id TEXT NOT NULL,
        run_id TEXT NOT NULL UNIQUE REFERENCES gta_race_submissions(run_id),
        elapsed_ms INTEGER NOT NULL CHECK(elapsed_ms > 0),
        PRIMARY KEY (player_id, race_id)
      );
      CREATE INDEX IF NOT EXISTS gta_bests_order ON gta_race_bests(race_id,elapsed_ms);
    `);
  }
  driverCode(playerId, create = false) {
    let code = this.sql.exec('SELECT driver_code FROM gta_racers WHERE player_id=?', playerId).toArray()[0]?.driver_code;
    if (!code && create) {
      code = `車手-${crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
      this.sql.exec('INSERT INTO gta_racers(player_id,driver_code) VALUES(?,?)', playerId, code);
    }
    return code || null;
  }
  position(raceId, elapsedMs) {
    return 1 + this.sql.exec('SELECT COUNT(*) AS n FROM gta_race_bests WHERE race_id=? AND elapsed_ms<?', raceId, elapsedMs).one().n;
  }
  entry(row, privateEntry = false) {
    return { ...(privateEntry ? { raceId: row.race_id, runId: row.run_id } : {}),
      driverCode: row.driver_code, elapsedMs: row.elapsed_ms, position: this.position(row.race_id, row.elapsed_ms), vehicleId: row.vehicle_id };
  }
  public(raceId) {
    const rows = this.sql.exec(`SELECT b.race_id,b.elapsed_ms,s.vehicle_id,r.driver_code
      FROM gta_race_bests b JOIN gta_race_submissions s ON s.run_id=b.run_id
      JOIN gta_racers r ON r.player_id=b.player_id WHERE b.race_id=?
      ORDER BY b.elapsed_ms,s.created_at,r.driver_code LIMIT 20`, raceId).toArray();
    return { version: 1, raceId, entries: rows.map(row => this.entry(row)),
      totalDrivers: this.sql.exec('SELECT COUNT(*) AS n FROM gta_race_bests WHERE race_id=?', raceId).one().n };
  }
  mine(playerId) {
    const rows = this.sql.exec(`SELECT b.race_id,b.run_id,b.elapsed_ms,s.vehicle_id,r.driver_code
      FROM gta_race_bests b JOIN gta_race_submissions s ON s.run_id=b.run_id
      JOIN gta_racers r ON r.player_id=b.player_id WHERE b.player_id=? ORDER BY b.race_id`, playerId).toArray();
    return { version: 1, driverCode: this.driverCode(playerId), entries: rows.map(row => this.entry(row, true)) };
  }
  async submit(playerId, body) {
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).sort().join(',') !== 'proof,runId'
      || typeof body.runId !== 'string' || !uuid.test(body.runId)) {
      throw new ApiError(400, 'invalid_gta_submission', '競速成績格式無效。');
    }
    const verified = verifyRaceProof(body.proof);
    if (!verified.ok) throw new ApiError(400, 'invalid_gta_proof', '這次競速路線無法驗證；本機紀錄仍保留。');
    const runId = body.runId.toLowerCase(), proofHash = await tokenHash(JSON.stringify({ version: body.proof.version, raceId: body.proof.raceId, vehicleId: body.proof.vehicleId, samples: body.proof.samples }));
    return this.storage.transactionSync(() => {
      const existing = this.sql.exec('SELECT * FROM gta_race_submissions WHERE run_id=?', runId).toArray()[0];
      if (existing && (existing.player_id !== playerId || existing.proof_hash !== proofHash)) throw conflict();
      const driverCode = this.driverCode(playerId, true);
      if (!existing) this.sql.exec(`INSERT INTO gta_race_submissions(run_id,player_id,proof_hash,race_id,vehicle_id,elapsed_ms,created_at)
        VALUES(?,?,?,?,?,?,?)`, runId, playerId, proofHash, verified.raceId, verified.vehicleId, verified.elapsedMs, new Date().toISOString());
      const best = this.sql.exec('SELECT elapsed_ms FROM gta_race_bests WHERE player_id=? AND race_id=?', playerId, verified.raceId).toArray()[0];
      const improved = !best || verified.elapsedMs < best.elapsed_ms;
      if (improved) this.sql.exec(`INSERT INTO gta_race_bests(player_id,race_id,run_id,elapsed_ms) VALUES(?,?,?,?)
        ON CONFLICT(player_id,race_id) DO UPDATE SET run_id=excluded.run_id,elapsed_ms=excluded.elapsed_ms`, playerId, verified.raceId, runId, verified.elapsedMs);
      const entry = this.entry({ race_id: verified.raceId, run_id: runId, elapsed_ms: verified.elapsedMs, vehicle_id: verified.vehicleId, driver_code: driverCode }, true);
      return { recorded: true, duplicate: Boolean(existing), improved, entry, driverCode };
    });
  }
  remove(playerId, raceId) {
    const removed = Boolean(this.sql.exec('SELECT 1 FROM gta_race_bests WHERE player_id=? AND race_id=?', playerId, raceId).toArray().length);
    this.sql.exec('DELETE FROM gta_race_bests WHERE player_id=? AND race_id=?', playerId, raceId);
    // Receipts remain bound to their owner. Explicit resubmission of the same
    // proof can republish it; a delayed network retry never changes its result.
    return { removed, raceId };
  }
}
