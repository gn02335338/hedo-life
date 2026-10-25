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
function harness(t) {
  const db = new DatabaseSync(':memory:'); db.exec('PRAGMA foreign_keys=ON'); t.after(() => db.close());
  const sql = { exec(query, ...args) { let rows = []; if (!args.length && query.includes(';')) db.exec(query); else { const statement = db.prepare(query); if (statement.columns().length) rows = statement.all(...args); else statement.run(...args); } return { toArray: () => rows, one: () => { assert.equal(rows.length, 1); return rows[0]; } }; } };
  const storage = { sql, transactionSync(fn) { db.exec('BEGIN IMMEDIATE'); try { const value = fn(); db.exec('COMMIT'); return value; } catch (error) { db.exec('ROLLBACK'); throw error; } }, async getAlarm() { return null; }, async setAlarm() {} };
  const ctx = { storage, blockConcurrencyWhile: fn => fn() };
  const scope = vm.createContext({ DurableObject: class { constructor(context) { this.ctx = context; } }, ENDINGS, ...http, FeedbackStore, AchievementStore, CharacterStore, ObservationStore, GtaRacingStore, validateGtaRaceFilter, RACE_PROOF_LIMITS, crypto, Response, Request, URL, Date });
  vm.runInContext(source, scope); let archive = new scope.HedoArchive(ctx, {});
  const call = async (path, { method = 'GET', token, body, headers = {}, resetRate = true } = {}) => {
    if (resetRate) archive.rate = new http.RateGuard();
    const response = await archive.fetch(new Request(`https://game.example${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) }));
    return { status: response.status, body: await response.json(), headers: response.headers };
  };
  const register = async (token = 'a'.repeat(64)) => { const response = await call('/api/player', { method: 'POST', body: { token } }); assert.equal(response.status, 200); return { id: response.body.playerId, token }; };
  return { db, sql, storage, get archive() { return archive; }, restart() { archive = new scope.HedoArchive(ctx, {}); }, call, register };
}
const base = '/api/gta/leaderboard';
const publicPath = `${base}?raceId=first-sprint`;
const bodyFor = options => ({ runId: randomUUID(), proof: driveRaceProof(options).proof });
const submit = (h, p, body) => h.call(base, { method: 'POST', token: p.token, body });

test('GTA publishes only submitted route-verified anonymous times and never alters life archives', async t => {
  const h = harness(t), p = await h.register(), payload = bodyFor();
  assert.deepEqual((await h.call(publicPath)).body.entries, []);
  assert.deepEqual((await h.call(`${base}/mine`, { token: p.token })).body, { version: 1, driverCode: null, entries: [] });
  const response = await submit(h, p, payload);
  assert.equal(response.status, 200); assert.equal(response.body.recorded, true); assert.equal(response.body.duplicate, false); assert.equal(response.body.improved, true);
  assert.equal(response.body.entry.runId, payload.runId); assert.equal(response.body.entry.elapsedMs, driveRaceProof().state.result.receipt.elapsedMs);
  assert.match(response.body.entry.driverCode, /^車手-[0-9A-F]{12}$/);
  const board = await h.call(publicPath); assert.equal(board.body.totalDrivers, 1);
  assert.deepEqual(Object.keys(board.body.entries[0]).sort(), ['driverCode', 'elapsedMs', 'position', 'vehicleId']);
  assert.equal(board.body.entries[0].position, 1); assert.equal(board.headers.get('Cache-Control'), 'private, no-store');
  const serialized = JSON.stringify(board.body); for (const secret of [p.id, p.token, payload.runId, 'proof', 'samples']) assert.ok(!serialized.includes(secret));
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM runs').one().n, 0); assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM player_endings').one().n, 0);
  const retained = h.sql.exec('SELECT * FROM gta_race_submissions').one(); assert.equal(retained.proof_hash.length, 64); assert.equal(Object.hasOwn(retained, 'proof'), false); assert.equal(Object.hasOwn(retained, 'samples'), false);
});

test('same run retries, slower records, better times, exact ties, stable identities and restart preserve best-only rankings', async t => {
  const h = harness(t), p = await h.register(), other = await h.register('b'.repeat(64));
  const normal = bodyFor(), slow = bodyFor({ waitFrames: 60 }), fast = bodyFor({ engine: 2, boost: true });
  const first = (await submit(h, p, normal)).body;
  const duplicate = (await submit(h, p, normal)).body; assert.equal(duplicate.duplicate, true); assert.equal(duplicate.improved, false); assert.deepEqual(duplicate.entry, first.entry);
  const slower = (await submit(h, p, slow)).body; assert.equal(slower.improved, false); assert.equal(slower.entry.runId, slow.runId);
  assert.equal((await h.call(`${base}/mine`, { token: p.token })).body.entries[0].runId, normal.runId);
  const improvement = (await submit(h, p, fast)).body; assert.equal(improvement.improved, true); assert.ok(improvement.entry.elapsedMs < first.entry.elapsedMs);
  assert.equal(improvement.driverCode, first.driverCode);
  assert.equal((await submit(h, other, { ...fast, runId: randomUUID() })).status, 200);
  assert.deepEqual((await h.call(publicPath)).body.entries.map(row => row.position), [1, 1]);
  assert.equal((await h.call(publicPath)).body.totalDrivers, 2);
  h.restart(); assert.equal((await h.call(`${base}/mine`, { token: p.token })).body.entries[0].runId, fast.runId);
  assert.equal((await submit(h, p, fast)).body.duplicate, true);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM gta_race_submissions').one().n, 4);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM gta_race_bests').one().n, 2);
});

test('player isolation rejects borrowed run IDs and changed proofs; withdrawal is owned and explicit resubmission republishes', async t => {
  const h = harness(t), p = await h.register(), other = await h.register('b'.repeat(64)), payload = bodyFor();
  assert.equal((await submit(h, p, payload)).status, 200);
  assert.equal((await submit(h, other, payload)).status, 409);
  const changed = bodyFor({ waitFrames: 60 }); changed.runId = payload.runId;
  assert.equal((await submit(h, p, changed)).status, 409);
  assert.deepEqual((await h.call(`${base}/mine`, { token: other.token })).body.entries, []);
  assert.equal((await h.call(publicPath, { method: 'DELETE', token: other.token })).body.removed, false);
  assert.equal((await h.call(publicPath)).body.totalDrivers, 1);
  assert.equal((await h.call(publicPath, { method: 'DELETE', token: p.token })).body.removed, true);
  assert.equal((await h.call(publicPath)).body.totalDrivers, 0);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM gta_race_submissions').one().n, 1);
  const published = (await submit(h, p, payload)).body; assert.equal(published.duplicate, true); assert.equal(published.improved, true);
  assert.equal((await h.call(publicPath)).body.totalDrivers, 1);
});

test('GTA rejects forged timing, incomplete and oversized evidence, unsupported schema and invalid filtering', async t => {
  const h = harness(t), p = await h.register(), valid = bodyFor();
  const invalid = [];
  invalid.push({ ...valid, elapsedMs: 1 }, { ...valid, runId: 'fake' }, { ...valid, proof: { ...valid.proof, elapsedMs: 1 } });
  invalid.push({ ...valid, proof: { ...valid.proof, samples: valid.proof.samples.slice(0, -1) } });
  const teleport = structuredClone(valid); teleport.proof.samples[5][1] = 120; invalid.push(teleport);
  for (const payload of invalid) assert.equal((await submit(h, p, payload)).status, 400);
  assert.equal((await submit(h, p, { ...valid, padding: '大'.repeat(90_000) })).status, 413);
  for (const path of [base, `${base}?raceId=unknown`, `${publicPath}&raceId=first-sprint`, `${publicPath}&name=private`, `${base}/mine?raceId=first-sprint`]) assert.equal((await h.call(path, { token: p.token })).status, 400, path);
  assert.equal((await h.call(base, { method: 'PUT', token: p.token })).status, 405);
  assert.equal((await h.call('/api/gta/unknown')).status, 404);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM gta_race_submissions').one().n, 0);
});

test('GTA uses existing bearer authentication, same-origin mutations, bounded rate and safe error responses', async t => {
  const h = harness(t), p = await h.register(), payload = bodyFor();
  for (const [path, options] of [[`${base}/mine`, {}], [base, { method: 'POST', body: payload }], [publicPath, { method: 'DELETE' }]]) assert.equal((await h.call(path, options)).status, 401);
  assert.equal((await h.call(base, { method: 'POST', token: 'f'.repeat(64), body: payload })).status, 401);
  assert.equal((await h.call(base, { method: 'POST', token: p.token, body: payload, headers: { Origin: 'https://other.example' } })).status, 403);
  assert.equal((await h.call(publicPath, { method: 'DELETE', token: p.token, headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
  for (let i = 0; i < 10; i += 1) assert.equal((await h.call(publicPath, { resetRate: false })).status, 200);
  const throttled = await h.call(publicPath, { resetRate: false }); assert.equal(throttled.status, 429); assert.equal(throttled.headers.get('Retry-After'), '10');
  h.archive.gtaRacingStore().submit = () => { throw new Error('SECRET'); };
  const failed = await submit(h, p, payload); assert.equal(failed.status, 503); assert.ok(!JSON.stringify(failed.body).includes('SECRET'));
});

test('public list is bounded to twenty drivers and exact ties have a shared competition position', async t => {
  const h = harness(t), sample = bodyFor().proof;
  for (let index = 1; index <= 22; index += 1) {
    const p = await h.register(index.toString(16).padStart(64, '0'));
    assert.equal((await submit(h, p, { runId: randomUUID(), proof: sample })).status, 200);
  }
  const board = (await h.call(publicPath)).body;
  assert.equal(board.totalDrivers, 22); assert.equal(board.entries.length, 20); assert.ok(board.entries.every(row => row.position === 1));
});

test('a failed publication rolls back its anonymous code and receipt, while semantic proof key order is retry-safe', async t => {
  const h = harness(t), p = await h.register(), payload = bodyFor();
  await h.call(publicPath);
  h.db.exec("CREATE TRIGGER fail_gta_best BEFORE INSERT ON gta_race_bests BEGIN SELECT RAISE(ABORT, 'test failure'); END;");
  assert.equal((await submit(h, p, payload)).status, 503);
  for (const table of ['gta_racers', 'gta_race_submissions', 'gta_race_bests']) assert.equal(h.sql.exec(`SELECT COUNT(*) AS n FROM ${table}`).one().n, 0);
  h.db.exec('DROP TRIGGER fail_gta_best');
  assert.equal((await submit(h, p, payload)).status, 200);
  const { version, raceId, vehicleId, samples } = payload.proof;
  const retry = await submit(h, p, { ...payload, proof: { samples, vehicleId, raceId, version } });
  assert.equal(retry.status, 200); assert.equal(retry.body.duplicate, true);
});
