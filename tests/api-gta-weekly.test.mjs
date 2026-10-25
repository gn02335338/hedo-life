import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { ENDINGS } from '../dist/endings.js';
import { FeedbackStore } from '../worker/feedback-store.js';
import { AchievementStore } from '../worker/achievements.js';
import { CharacterStore } from '../worker/characters.js';
import { ObservationStore } from '../worker/observations.js';
import { GtaRacingStore, validateGtaRaceFilter } from '../worker/gta-racing.js';
import { RACE_PROOF_LIMITS } from '../dist/gta/racing-proof.js';
import { driveRaceProof } from './helpers/gta-racing-proof.mjs';
import * as http from '../worker/http.js';

const source = readFileSync(new URL('../worker/index.js', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '').replace('export class HedoArchive', 'globalThis.HedoArchive=class HedoArchive').replace('export default', 'globalThis.worker=');
function harness(t, initialTime = Date.parse('2026-10-25T15:59:59.000Z')) {
  let time = initialTime;
  const db = new DatabaseSync(':memory:'); db.exec('PRAGMA foreign_keys=ON'); t.after(() => db.close());
  const sql = { exec(query, ...args) { let rows = []; if (!args.length && query.includes(';')) db.exec(query); else { const statement = db.prepare(query); if (statement.columns().length) rows = statement.all(...args); else statement.run(...args); } return { toArray: () => rows, one: () => { assert.equal(rows.length, 1); return rows[0]; } }; } };
  const storage = { sql, transactionSync(fn) { db.exec('BEGIN IMMEDIATE'); try { const value = fn(); db.exec('COMMIT'); return value; } catch (error) { db.exec('ROLLBACK'); throw error; } }, async getAlarm() { return null; }, async setAlarm() {} };
  const ctx = { storage, blockConcurrencyWhile: fn => fn() };
  const scope = vm.createContext({ DurableObject: class { constructor(context) { this.ctx = context; } }, ENDINGS, ...http, FeedbackStore, AchievementStore, CharacterStore, ObservationStore, GtaRacingStore, validateGtaRaceFilter, RACE_PROOF_LIMITS, crypto, Response, Request, URL, Date });
  vm.runInContext(source, scope); let archive = new scope.HedoArchive(ctx, {});
  const setClock = () => { archive.gtaRacingStore().now = () => time; }; setClock();
  const call = async (path, { method = 'GET', token, body, headers = {}, resetRate = true } = {}) => {
    if (resetRate) archive.rate = new http.RateGuard();
    const response = await archive.fetch(new Request(`https://game.example${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) }));
    return { status: response.status, body: await response.json(), headers: response.headers };
  };
  const register = async (token = 'a'.repeat(64)) => { const response = await call('/api/player', { method: 'POST', body: { token } }); assert.equal(response.status, 200); return { id: response.body.playerId, token }; };
  return { db, sql, storage, get archive() { return archive; }, restart() { archive = new scope.HedoArchive(ctx, {}); setClock(); }, setTime(value) { time = value; }, call, register };
}
const base = '/api/gta/leaderboard';
const alltime = `${base}?raceId=first-sprint`;
const week = (weekId = '', raceId = 'first-sprint') => `${base}?raceId=${raceId}&scope=weekly${weekId ? `&weekId=${weekId}` : ''}`;
const mine = weekId => `${base}/mine?scope=weekly${weekId ? `&weekId=${weekId}` : ''}`;
const bodyFor = options => ({ runId: randomUUID(), proof: driveRaceProof(options).proof });
const submit = (h, player, body) => h.call(base, { method: 'POST', token: player.token, body });
const boundary = Date.parse('2026-10-25T16:00:00.000Z');

test('calendar is public server time in Taipei, changes at local midnight and Monday, and rejects extra inputs', async t => {
  const h = harness(t);
  const sunday = await h.call('/api/gta/calendar');
  assert.equal(sunday.status, 200); assert.equal(sunday.headers.get('Cache-Control'), 'private, no-store');
  assert.deepEqual(sunday.body, { version: 1, serverNow: boundary - 1000, dayId: '2026-10-25', weekId: '2026-10-19', previousWeekId: '2026-10-12',
    dayStartsAt: Date.parse('2026-10-24T16:00:00Z'), dayEndsAt: boundary,
    weekStartsAt: Date.parse('2026-10-18T16:00:00Z'), weekEndsAt: boundary,
    dailyChallenge: { dayId: '2026-10-25', raceId: 'first-sprint', title: '週日暖身衝刺', description: '在 10 秒內有效完賽，領取今日獎勵。', targetMs: 10000, reward: 180,
      startsAt: Date.parse('2026-10-24T16:00:00Z'), endsAt: boundary } });
  h.setTime(boundary);
  const monday = (await h.call('/api/gta/calendar')).body;
  assert.equal(monday.dayId, '2026-10-26'); assert.equal(monday.weekId, '2026-10-26'); assert.equal(monday.previousWeekId, '2026-10-19');
  assert.equal(monday.weekStartsAt, boundary); assert.equal(monday.dailyChallenge.raceId, 'block-sprint');
  h.setTime(Date.parse('2026-10-26T16:00:00Z'));
  const tuesday = (await h.call('/api/gta/calendar')).body;
  assert.equal(tuesday.dayId, '2026-10-27'); assert.equal(tuesday.weekId, '2026-10-26'); assert.equal(tuesday.dailyChallenge.targetMs, 9000);
  assert.equal((await h.call('/api/gta/calendar?now=1')).status, 400);
  assert.equal((await h.call('/api/gta/calendar', { method: 'POST', body: {} })).status, 405);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM players').one().n, 0);
});

test('weekly board is a real best-only private/public projection with independent all-time improvement', async t => {
  const h = harness(t), player = await h.register(), original = bodyFor({ engine: 2, boost: true });
  const first = (await submit(h, player, original)).body;
  assert.equal(first.weekly.weekId, '2026-10-19'); assert.equal(first.weekly.improved, true);
  assert.deepEqual(first.weekly.entry, first.entry);
  const publicBoard = (await h.call(week())).body;
  assert.equal(publicBoard.weekId, '2026-10-19'); assert.equal(publicBoard.scope, 'weekly'); assert.equal(publicBoard.totalDrivers, 1);
  assert.deepEqual(Object.keys(publicBoard.entries[0]).sort(), ['driverCode', 'elapsedMs', 'position', 'vehicleId']);
  for (const secret of [player.id, player.token, original.runId, 'proof', 'samples', 'created_at']) assert.ok(!JSON.stringify(publicBoard).includes(secret));
  assert.deepEqual((await h.call(mine(), { token: player.token })).body.entries, [first.weekly.entry]);
  h.setTime(boundary);
  const second = (await submit(h, player, bodyFor())).body;
  assert.equal(second.improved, false); assert.equal(second.weekly.improved, true); assert.equal(second.weekly.weekId, '2026-10-26');
  assert.equal((await h.call(alltime)).body.entries[0].elapsedMs, first.entry.elapsedMs);
  assert.equal((await h.call(week())).body.entries[0].elapsedMs, second.entry.elapsedMs);
  assert.equal((await h.call(week('2026-10-19'))).body.entries[0].elapsedMs, first.entry.elapsedMs);
  const slower = (await submit(h, player, bodyFor({ waitFrames: 60 }))).body;
  assert.equal(slower.weekly.improved, false); assert.ok(slower.weekly.entry.elapsedMs > second.entry.elapsedMs);
  assert.equal((await h.call(mine(), { token: player.token })).body.entries[0].runId, second.entry.runId);
  assert.deepEqual(Object.keys((await h.call(alltime)).body).sort(), ['entries', 'raceId', 'totalDrivers', 'version']);
  assert.deepEqual(Object.keys((await h.call(`${base}/mine`, { token: player.token })).body).sort(), ['driverCode', 'entries', 'version']);
});

test('retries and changing UUID cannot re-date first-accepted evidence after rollover or restart', async t => {
  const h = harness(t), player = await h.register(), payload = bodyFor();
  const first = (await submit(h, player, payload)).body;
  const originalReceipt = h.sql.exec('SELECT * FROM gta_race_submissions WHERE run_id=?', payload.runId).one();
  h.setTime(boundary); h.restart();
  const retry = (await submit(h, player, payload)).body;
  assert.equal(retry.duplicate, true); assert.equal(retry.weekly.weekId, '2026-10-19'); assert.equal(retry.weekly.improved, false);
  assert.equal((await h.call(week())).body.totalDrivers, 0);
  const changedId = { ...payload, runId: randomUUID() };
  const repeatedProof = (await submit(h, player, changedId)).body;
  assert.equal(repeatedProof.duplicate, false); assert.equal(repeatedProof.weekly.weekId, '2026-10-19');
  assert.equal(repeatedProof.weekly.entry.runId, changedId.runId);
  assert.equal((await h.call(week())).body.totalDrivers, 0);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM gta_race_week_entries').one().n, 1);
  assert.deepEqual(h.sql.exec('SELECT * FROM gta_race_submissions WHERE run_id=?', payload.runId).one(), originalReceipt);
  h.setTime(boundary + 7 * 24 * 60 * 60 * 1000);
  const expired = (await submit(h, player, payload)).body;
  assert.equal(expired.weekly, null); assert.equal(expired.entry.elapsedMs, first.entry.elapsedMs);
  assert.equal((await h.call(week())).body.totalDrivers, 0);
  assert.equal((await h.call(week('2026-10-19'))).status, 400);
});

test('legacy receipts remain all-time compatible and cannot qualify for weekly by changing their UUID', async t => {
  const h = harness(t), player = await h.register(), payload = bodyFor();
  const hash = await http.tokenHash(JSON.stringify(payload.proof));
  h.sql.exec('INSERT INTO gta_race_submissions(run_id,player_id,proof_hash,race_id,vehicle_id,elapsed_ms,created_at) VALUES(?,?,?,?,?,?,?)',
    payload.runId, player.id, hash, payload.proof.raceId, payload.proof.vehicleId, Math.round(payload.proof.samples.at(-1)[0] / 120 * 1000), '2026-10-24T00:00:00.000Z');
  const legacy = (await submit(h, player, payload)).body;
  assert.equal(legacy.duplicate, true); assert.equal(legacy.improved, true); assert.equal(legacy.weekly, null);
  const changed = (await submit(h, player, { ...payload, runId: randomUUID() })).body;
  assert.equal(changed.duplicate, false); assert.equal(changed.weekly, null);
  assert.equal((await h.call(alltime)).body.totalDrivers, 1); assert.equal((await h.call(week())).body.totalDrivers, 0);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM gta_race_week_entries').one().n, 0);
  assert.equal((await submit(h, player, bodyFor({ waitFrames: 1 }))).body.weekly.improved, true);
});

test('withdrawals affect only the selected scope and owner; explicit republish restores only the original week', async t => {
  const h = harness(t), player = await h.register(), other = await h.register('b'.repeat(64)), payload = bodyFor();
  await submit(h, player, payload);
  assert.equal((await h.call(week(), { method: 'DELETE', token: other.token })).body.removed, false);
  const removed = (await h.call(week(), { method: 'DELETE', token: player.token })).body;
  assert.deepEqual(removed, { removed: true, raceId: 'first-sprint', scope: 'weekly', weekId: '2026-10-19' });
  assert.equal((await h.call(alltime)).body.totalDrivers, 1); assert.equal((await h.call(week())).body.totalDrivers, 0);
  h.setTime(boundary);
  const repeated = (await submit(h, player, payload)).body;
  assert.equal(repeated.weekly.improved, true); assert.equal(repeated.weekly.weekId, '2026-10-19');
  assert.equal((await h.call(week())).body.totalDrivers, 0); assert.equal((await h.call(week('2026-10-19'))).body.totalDrivers, 1);
  assert.equal((await h.call(alltime, { method: 'DELETE', token: player.token })).body.removed, true);
  assert.equal((await h.call(week('2026-10-19'))).body.totalDrivers, 1);
  assert.deepEqual((await h.call(mine('2026-10-19'), { token: other.token })).body.entries, []);
  assert.equal((await h.call(week('2026-10-19'), { method: 'DELETE', token: player.token })).body.removed, true);
  assert.equal((await h.call(week('2026-10-19'), { method: 'DELETE', token: player.token })).body.removed, false);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM gta_race_week_entries').one().n, 1);
});

test('weekly ties use competition positions, courses remain separate and the public result is capped at twenty', async t => {
  const h = harness(t), fast = bodyFor({ engine: 2, boost: true }).proof, normal = bodyFor().proof;
  for (let index = 1; index <= 22; index += 1) {
    const player = await h.register(index.toString(16).padStart(64, '0'));
    assert.equal((await submit(h, player, { runId: randomUUID(), proof: index <= 2 ? fast : normal })).status, 200);
  }
  const board = (await h.call(week())).body;
  assert.equal(board.totalDrivers, 22); assert.equal(board.entries.length, 20);
  assert.deepEqual(board.entries.slice(0, 3).map(row => row.position), [1, 1, 3]);
  assert.equal((await h.call(week('', 'city-loop'))).body.totalDrivers, 0);
  const third = await h.register('3'.padStart(64, '0'));
  assert.equal((await h.call(mine(), { token: third.token })).body.entries[0].position, 3);
});

test('weekly queries reject old/future/non-Monday/duplicate filters and retain bearer, same-origin and rate protection', async t => {
  const h = harness(t), player = await h.register(), payload = bodyFor();
  for (const path of [week('2026-10-26'), week('2026-10-05'), week('2026-10-25'), week('2026-02-30'),
    `${week()}&weekId=2026-10-19&weekId=2026-10-12`, `${week()}&scope=alltime`, `${alltime}&weekId=2026-10-19`,
    `${alltime}&scope=`, `${alltime}&scope=private`, `${mine()}&raceId=first-sprint`, `${mine()}&name=hidden`]) {
    assert.equal((await h.call(path, { token: player.token })).status, 400, path);
  }
  assert.equal((await h.call(week('2026-10-12'))).status, 200);
  assert.equal((await h.call(mine())).status, 401);
  assert.equal((await h.call(week(), { method: 'DELETE' })).status, 401);
  assert.equal((await h.call(week(), { method: 'DELETE', token: player.token, headers: { Origin: 'https://elsewhere.example' } })).status, 403);
  assert.equal((await submit(h, player, { ...payload, weekId: '2026-10-12' })).status, 400);
  assert.equal((await h.call(base, { method: 'POST', token: player.token, body: { ...payload, padding: '大'.repeat(90_000) } })).status, 413);
  for (let index = 0; index < 10; index += 1) assert.equal((await h.call('/api/gta/calendar', { resetRate: false })).status, 200);
  assert.equal((await h.call('/api/gta/calendar', { resetRate: false })).status, 429);
});

test('weekly transaction failure rolls back every new identity, receipt, marker and best; retry remains safe', async t => {
  const h = harness(t), player = await h.register(), payload = bodyFor();
  h.db.exec("CREATE TRIGGER fail_weekly BEFORE INSERT ON gta_race_week_bests BEGIN SELECT RAISE(ABORT, 'SECRET'); END;");
  const failed = await submit(h, player, payload);
  assert.equal(failed.status, 503); assert.ok(!JSON.stringify(failed.body).includes('SECRET'));
  for (const table of ['gta_racers', 'gta_race_submissions', 'gta_race_bests', 'gta_race_week_entries', 'gta_race_week_bests']) {
    assert.equal(h.sql.exec(`SELECT COUNT(*) AS n FROM ${table}`).one().n, 0, table);
  }
  h.db.exec('DROP TRIGGER fail_weekly');
  const success = (await submit(h, player, payload)).body;
  assert.equal(success.weekly.improved, true); assert.equal(success.duplicate, false);
  const other = await h.register('b'.repeat(64));
  assert.equal((await submit(h, other, payload)).status, 409);
  assert.equal((await submit(h, player, { ...bodyFor({ waitFrames: 1 }), runId: payload.runId })).status, 409);
  const { version, raceId, vehicleId, samples } = payload.proof;
  const retry = (await submit(h, player, { ...payload, proof: { samples, raceId, vehicleId, version } })).body;
  assert.equal(retry.duplicate, true); assert.equal(retry.weekly.improved, false);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM gta_race_week_entries').one().n, 1);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM runs').one().n, 0);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM player_endings').one().n, 0);
});
