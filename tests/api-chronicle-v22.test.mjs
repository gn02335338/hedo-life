import {ObservationStore} from '../worker/observations.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { AchievementStore } from '../worker/achievements.js';
import { CharacterStore } from '../worker/characters.js';
import { FeedbackStore } from '../worker/feedback-store.js';
import { validateFeedback, validatePublisherToken } from '../worker/feedback.js';
import * as http from '../worker/http.js';
import { replayRun, createRun, applyChoice, VERSION, MAX_TURNS } from '../dist/engine.js';
import { ROLE_MAP } from '../dist/roles.js';
import { ENDINGS } from '../dist/endings.js';
import { CHARACTER_IDS, CHARACTER_METRICS, deriveCharacterStats } from '../dist/character-stats.js';

const source = readFileSync(new URL('../worker/index.js', import.meta.url), 'utf8')
  .replace(/^import .*;\n/gm, '')
  .replace('export class HedoArchive', 'globalThis.HedoArchive=class HedoArchive')
  .replace('export default', 'globalThis.worker=');
const { routes } = JSON.parse(readFileSync(new URL('./fixtures/chronicle-routes-v22.json', import.meta.url), 'utf8'));
const rageRoutes = routes.filter(route => ['helen-imagined', 'helen-real'].includes(route.id));
const proof = (fixture, runId) => ({ runId, roleId: fixture.roleId, seed: fixture.seed, actions: fixture.actions });
const rowFor = rows => rows.find(row => row.id === 'helen');

function harness(t) {
  const db = new DatabaseSync(':memory:'); t.after(() => db.close()); db.exec('PRAGMA foreign_keys = ON');
  const sql = { exec(query, ...args) {
    let rows = [];
    if (!args.length && query.includes(';')) db.exec(query);
    else { const statement = db.prepare(query); if (statement.columns().length) rows = statement.all(...args); else statement.run(...args); }
    return { toArray: () => rows, one: () => { assert.equal(rows.length, 1); return rows[0]; } };
  } };
  const storage = { sql, transactionSync(fn) {
    db.exec('BEGIN IMMEDIATE'); try { const result = fn(); db.exec('COMMIT'); return result; } catch (error) { db.exec('ROLLBACK'); throw error; }
  }, async getAlarm() { return null; }, async setAlarm() {} };
  const scope = vm.createContext({
    DurableObject: class { constructor(context) { this.ctx = context; } }, replayRun, VERSION, MAX_TURNS, ROLE_MAP, ENDINGS,
    ...http, validateFeedback, validatePublisherToken, FeedbackStore, AchievementStore, CharacterStore,ObservationStore, crypto, Response, Request, URL, Date,
  });
  vm.runInContext(source, scope);
  const archive = new scope.HedoArchive({ storage, blockConcurrencyWhile: fn => fn() }, {});
  const call = async (path, { method = 'GET', token, body } = {}) => {
    archive.rate = new http.RateGuard(); const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body) headers['Content-Type'] = 'application/json';
    const response = await archive.fetch(new Request(`https://game.example${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }));
    return { status: response.status, body: await response.json() };
  };
  const register = async () => {
    const token = randomBytes(32).toString('hex'), result = await call('/api/player', { method: 'POST', body: { token } });
    assert.equal(result.status, 200); return { token, id: result.body.playerId };
  };
  return { sql, call, register };
}

test('natural e22 Helen prefixes verify both rage modes once without creating completed games', async t => {
  assert.equal(rageRoutes.length, 2);
  const h = harness(t);
  for (const fixture of rageRoutes) {
    const player = await h.register(), runId = randomUUID();
    const before = { ...fixture, actions: fixture.actions.slice(0, -1) };
    const beforeRun = replayRun(before.roleId, before.seed, before.actions), resolved = replayRun(fixture.roleId, fixture.seed, fixture.actions);
    assert.equal(beforeRun.eventId, fixture.eventId);
    assert.equal(resolved.completed, false);
    const identity = h.sql.exec('SELECT * FROM players WHERE id=?', player.id).one();
    const initial = await h.call('/api/characters', { method: 'POST', token: player.token, body: {
      ...proof(before, runId), characters: [{ id: 'helen', realHits: 9999, encounters: 9999 }],
      history: [{ eventId: 'rage-release', speaker: 'helen', choiceIndex: 0, kind: 'rage', eventOutcome: { result: '真的失控了' } }],
      flags: { rage_real: 9999, rage_target_helen: 9999 },
    } });
    assert.equal(initial.status, 200); assert.equal(initial.body.verified, true);
    assert.deepEqual(initial.body.characters, deriveCharacterStats(beforeRun), 'client-supplied counters and history are not evidence');
    const earned = await h.call('/api/characters', { method: 'POST', token: player.token, body: proof(fixture, runId) });
    assert.equal(earned.status, 200, fixture.id); assert.equal(earned.body.verified, true);
    assert.equal(earned.body.characters.length, CHARACTER_IDS.length);
    assert.deepEqual(earned.body.characters, deriveCharacterStats(resolved));
    const a = rowFor(initial.body.characters), b = rowFor(earned.body.characters);
    assert.equal(b.encounters - a.encounters, 1);
    assert.equal(b.imaginedHits - a.imaginedHits, Number(fixture.mode === 'imagined'));
    assert.equal(b.realHits - a.realHits, Number(fixture.mode === 'real'));
    for (const id of CHARACTER_IDS.filter(id => id !== 'helen')) {
      assert.deepEqual(earned.body.characters.find(row => row.id === id), initial.body.characters.find(row => row.id === id));
    }
    for (const endpoint of ['/api/characters', '/api/achievements']) {
      const retry = await h.call(endpoint, { method: 'POST', token: player.token, body: proof(fixture, runId) });
      assert.equal(retry.status, 200); assert.deepEqual(retry.body.characters, earned.body.characters);
      assert.equal(retry.body.totalRuns, 0); assert.deepEqual(retry.body.unlocked, []);
    }
    const me = await h.call('/api/me', { token: player.token });
    assert.equal(me.status, 200); assert.equal(me.body.playerId, player.id);
    assert.deepEqual(me.body.characters, earned.body.characters);
    assert.deepEqual(h.sql.exec('SELECT * FROM players WHERE id=?', player.id).one(), identity);
    const other = await h.register(), isolated = await h.call('/api/me', { token: other.token });
    assert.ok(isolated.body.characters.every(row => CHARACTER_METRICS.every(key => row[key] === 0)));
    const saved = JSON.stringify(h.sql.exec('SELECT * FROM character_runs').toArray());
    assert.ok(!saved.includes(fixture.seed)); assert.ok(!saved.includes(player.token));
  }
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM runs').one().n, 0);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM player_endings').one().n, 0);
  const stats = await h.call('/api/stats');
  assert.equal(stats.status, 200); assert.equal(stats.body.totalRuns, 0); assert.equal(stats.body.uniqueEndings, 0);
  const global = await h.call('/api/characters');
  assert.equal(global.status, 200); assert.equal(global.body.characters.length, CHARACTER_IDS.length);
  const expectedHelen = rageRoutes.map(fixture => rowFor(deriveCharacterStats(replayRun(fixture.roleId, fixture.seed, fixture.actions))));
  for (const key of CHARACTER_METRICS) {
    assert.equal(rowFor(global.body.characters)[key], expectedHelen.reduce((sum, row) => sum + row[key], 0));
  }
});

test('e21 remains a valid anonymous prefix and cannot acquire Helen interactions retroactively', async t => {
  const h = harness(t), player = await h.register();
  const run = applyChoice(createRun('system', 'e21-chronicle-compat'), 0);
  const fixture = { roleId: run.roleId, seed: run.seed, actions: run.actions };
  const expected = deriveCharacterStats(replayRun(fixture.roleId, fixture.seed, fixture.actions));
  const result = await h.call('/api/characters', { method: 'POST', token: player.token, body: proof(fixture, randomUUID()) });
  assert.equal(result.status, 200); assert.equal(result.body.verified, true);
  assert.deepEqual(result.body.characters, expected);
  assert.ok(CHARACTER_METRICS.every(key => rowFor(result.body.characters)[key] === 0));
  assert.equal(result.body.totalRuns, 0);
});

test('an invented Helen event or forged hit cannot change a verified collection', async t => {
  assert.equal(rageRoutes.length, 2);
  const h = harness(t), player = await h.register(), before = await h.call('/api/me', { token: player.token });
  const fixture = rageRoutes[0];
  const rejected = await h.call('/api/characters', { method: 'POST', token: player.token, body: {
    ...proof(fixture, randomUUID()), actions: [{ type: 'choice', eventId: fixture.eventId, index: 0 }],
    characters: [{ id: 'helen', realHits: 9999 }],
  } });
  assert.equal(rejected.status, 400); assert.equal(rejected.body.error, 'invalid_replay');
  assert.deepEqual((await h.call('/api/me', { token: player.token })).body, before.body);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM character_runs').one().n, 0);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM runs').one().n, 0);
});
