import { ApiError, tokenHash } from './http.js';
import { RACE_CATALOG } from '../dist/gta/racing-catalog.js';
import { verifyRaceProof } from '../dist/gta/racing-proof.js';
import { racingCalendar, dailyChallenge, validWeekId } from '../dist/gta/racing-calendar.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const conflict = () => new ApiError(409, 'gta_run_conflict', '這個賽事編號已記錄其他成績。');
export function validateGtaRaceFilter(url, { mine = false, now = Date.now() } = {}) {
  const params = url.searchParams;
  if ([...params.keys()].some(key => !['raceId', 'scope', 'weekId'].includes(key))
    || ['raceId', 'scope', 'weekId'].some(key => params.getAll(key).length > 1)
    || (mine ? params.has('raceId') : !RACE_CATALOG.some(race => race.id === params.get('raceId')))) {
    throw new ApiError(400, 'invalid_gta_race', '請選擇有效的街頭賽事。');
  }
  const scope = params.get('scope') ?? 'alltime';
  if (!['alltime', 'weekly'].includes(scope) || (scope !== 'weekly' && params.has('weekId'))) {
    throw new ApiError(400, 'invalid_gta_scope', '請選擇有效的排行榜。');
  }
  const calendar = racingCalendar(now);
  const weekId = scope === 'weekly' ? (params.get('weekId') ?? calendar.weekId) : null;
  if (scope === 'weekly' && (!validWeekId(weekId) || ![calendar.weekId, calendar.previousWeekId].includes(weekId))) {
    throw new ApiError(400, 'invalid_gta_week', '每週排行榜目前開放本週與上週。');
  }
  return { raceId: mine ? null : params.get('raceId'), scope, weekId };
}
export class GtaRacingStore {
  constructor(sql, storage, { now = Date.now } = {}) {
    this.sql = sql; this.storage = storage; this.now = now;
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
      CREATE INDEX IF NOT EXISTS gta_submissions_proof ON gta_race_submissions(player_id,proof_hash);
      CREATE TABLE IF NOT EXISTS gta_race_bests (
        player_id TEXT NOT NULL REFERENCES players(id), race_id TEXT NOT NULL,
        run_id TEXT NOT NULL UNIQUE REFERENCES gta_race_submissions(run_id),
        elapsed_ms INTEGER NOT NULL CHECK(elapsed_ms > 0),
        PRIMARY KEY (player_id, race_id)
      );
      CREATE INDEX IF NOT EXISTS gta_bests_order ON gta_race_bests(race_id,elapsed_ms);
      CREATE TABLE IF NOT EXISTS gta_race_week_entries (
        player_id TEXT NOT NULL REFERENCES players(id), proof_hash TEXT NOT NULL,
        run_id TEXT NOT NULL UNIQUE REFERENCES gta_race_submissions(run_id), week_id TEXT NOT NULL,
        PRIMARY KEY (player_id, proof_hash)
      );
      CREATE TABLE IF NOT EXISTS gta_race_week_bests (
        player_id TEXT NOT NULL REFERENCES players(id), race_id TEXT NOT NULL, week_id TEXT NOT NULL,
        run_id TEXT NOT NULL REFERENCES gta_race_submissions(run_id),
        elapsed_ms INTEGER NOT NULL CHECK(elapsed_ms > 0),
        PRIMARY KEY (player_id, race_id, week_id)
      );
      CREATE INDEX IF NOT EXISTS gta_week_bests_order ON gta_race_week_bests(week_id,race_id,elapsed_ms);
    `);
  }
  calendar() {
    const serverNow = this.now(), calendar = racingCalendar(serverNow);
    return { version: 1, serverNow, ...calendar, dailyChallenge: dailyChallenge(calendar.dayId) };
  }
  driverCode(playerId, create = false) {
    let code = this.sql.exec('SELECT driver_code FROM gta_racers WHERE player_id=?', playerId).toArray()[0]?.driver_code;
    if (!code && create) {
      code = `車手-${crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
      this.sql.exec('INSERT INTO gta_racers(player_id,driver_code) VALUES(?,?)', playerId, code);
    }
    return code || null;
  }
  position(raceId, elapsedMs, weekId = null) {
    return 1 + (weekId
      ? this.sql.exec('SELECT COUNT(*) AS n FROM gta_race_week_bests WHERE week_id=? AND race_id=? AND elapsed_ms<?', weekId, raceId, elapsedMs)
      : this.sql.exec('SELECT COUNT(*) AS n FROM gta_race_bests WHERE race_id=? AND elapsed_ms<?', raceId, elapsedMs)).one().n;
  }
  entry(row, privateEntry = false, weekId = null) {
    return { ...(privateEntry ? { raceId: row.race_id, runId: row.run_id } : {}),
      driverCode: row.driver_code, elapsedMs: row.elapsed_ms, position: this.position(row.race_id, row.elapsed_ms, weekId), vehicleId: row.vehicle_id };
  }
  public({ raceId, weekId = null }) {
    const table = weekId ? 'gta_race_week_bests' : 'gta_race_bests';
    const filter = weekId ? 'AND b.week_id=?' : '', args = weekId ? [raceId, weekId] : [raceId];
    const rows = this.sql.exec(`SELECT b.race_id,b.elapsed_ms,s.vehicle_id,r.driver_code
      FROM ${table} b JOIN gta_race_submissions s ON s.run_id=b.run_id
      JOIN gta_racers r ON r.player_id=b.player_id WHERE b.race_id=? ${filter}
      ORDER BY b.elapsed_ms,s.created_at,r.driver_code LIMIT 20`, ...args).toArray();
    return { version: 1, raceId, ...(weekId ? { scope: 'weekly', weekId } : {}), entries: rows.map(row => this.entry(row, false, weekId)),
      totalDrivers: this.sql.exec(`SELECT COUNT(*) AS n FROM ${table} b WHERE b.race_id=? ${filter}`, ...args).one().n };
  }
  mine(playerId, { weekId = null } = {}) {
    const table = weekId ? 'gta_race_week_bests' : 'gta_race_bests';
    const rows = this.sql.exec(`SELECT b.race_id,b.run_id,b.elapsed_ms,s.vehicle_id,r.driver_code
      FROM ${table} b JOIN gta_race_submissions s ON s.run_id=b.run_id
      JOIN gta_racers r ON r.player_id=b.player_id WHERE b.player_id=? ${weekId ? 'AND b.week_id=?' : ''} ORDER BY b.race_id`,
    ...weekId ? [playerId, weekId] : [playerId]).toArray();
    return { version: 1, ...(weekId ? { scope: 'weekly', weekId } : {}), driverCode: this.driverCode(playerId), entries: rows.map(row => this.entry(row, true, weekId)) };
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
      // Capture the authoritative date inside the transaction: a request whose
      // proof verification crosses midnight belongs to its first accepted week.
      const acceptedAt = this.now(), calendar = racingCalendar(acceptedAt);
      const existing = this.sql.exec('SELECT * FROM gta_race_submissions WHERE run_id=?', runId).toArray()[0];
      if (existing && (existing.player_id !== playerId || existing.proof_hash !== proofHash)) throw conflict();
      const priorProof = this.sql.exec('SELECT 1 FROM gta_race_submissions WHERE player_id=? AND proof_hash=? LIMIT 1', playerId, proofHash).toArray().length > 0;
      const driverCode = this.driverCode(playerId, true);
      if (!existing) this.sql.exec(`INSERT INTO gta_race_submissions(run_id,player_id,proof_hash,race_id,vehicle_id,elapsed_ms,created_at)
        VALUES(?,?,?,?,?,?,?)`, runId, playerId, proofHash, verified.raceId, verified.vehicleId, verified.elapsedMs, new Date(acceptedAt).toISOString());
      // Only genuinely new evidence receives a weekly marker. Legacy receipts
      // have none; changing their UUID must not enroll an old drive in a new week.
      if (!priorProof) this.sql.exec('INSERT INTO gta_race_week_entries(player_id,proof_hash,run_id,week_id) VALUES(?,?,?,?)', playerId, proofHash, runId, calendar.weekId);
      const best = this.sql.exec('SELECT elapsed_ms FROM gta_race_bests WHERE player_id=? AND race_id=?', playerId, verified.raceId).toArray()[0];
      const improved = !best || verified.elapsedMs < best.elapsed_ms;
      if (improved) this.sql.exec(`INSERT INTO gta_race_bests(player_id,race_id,run_id,elapsed_ms) VALUES(?,?,?,?)
        ON CONFLICT(player_id,race_id) DO UPDATE SET run_id=excluded.run_id,elapsed_ms=excluded.elapsed_ms`, playerId, verified.raceId, runId, verified.elapsedMs);
      const receipt = { race_id: verified.raceId, run_id: runId, elapsed_ms: verified.elapsedMs, vehicle_id: verified.vehicleId, driver_code: driverCode };
      const originalWeek = this.sql.exec('SELECT week_id FROM gta_race_week_entries WHERE player_id=? AND proof_hash=?', playerId, proofHash).toArray()[0]?.week_id;
      let weekly = null;
      if ([calendar.weekId, calendar.previousWeekId].includes(originalWeek)) {
        const weeklyBest = this.sql.exec('SELECT elapsed_ms FROM gta_race_week_bests WHERE player_id=? AND race_id=? AND week_id=?', playerId, verified.raceId, originalWeek).toArray()[0];
        const weeklyImproved = !weeklyBest || verified.elapsedMs < weeklyBest.elapsed_ms;
        if (weeklyImproved) this.sql.exec(`INSERT INTO gta_race_week_bests(player_id,race_id,week_id,run_id,elapsed_ms) VALUES(?,?,?,?,?)
          ON CONFLICT(player_id,race_id,week_id) DO UPDATE SET run_id=excluded.run_id,elapsed_ms=excluded.elapsed_ms`, playerId, verified.raceId, originalWeek, runId, verified.elapsedMs);
        weekly = { weekId: originalWeek, improved: weeklyImproved, entry: this.entry(receipt, true, originalWeek) };
      }
      return { recorded: true, duplicate: Boolean(existing), improved, entry: this.entry(receipt, true), driverCode, weekly };
    });
  }
  remove(playerId, { raceId, weekId = null }) {
    const table = weekId ? 'gta_race_week_bests' : 'gta_race_bests';
    const filter = weekId ? 'AND week_id=?' : '', args = weekId ? [playerId, raceId, weekId] : [playerId, raceId];
    const removed = Boolean(this.sql.exec(`SELECT 1 FROM ${table} WHERE player_id=? AND race_id=? ${filter}`, ...args).toArray().length);
    this.sql.exec(`DELETE FROM ${table} WHERE player_id=? AND race_id=? ${filter}`, ...args);
    // Receipts remain bound to their owner. Explicit resubmission of the same
    // proof can republish it; a delayed network retry never changes its result.
    return { removed, raceId, ...(weekId ? { scope: 'weekly', weekId } : {}) };
  }
}
