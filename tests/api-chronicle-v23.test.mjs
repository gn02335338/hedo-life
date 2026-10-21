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
import { replayRun, VERSION, MAX_TURNS } from '../dist/engine.js';
import { ROLE_MAP } from '../dist/roles.js';
import { ENDINGS } from '../dist/endings.js';
import { CHARACTER_IDS, CHARACTER_METRICS, deriveCharacterStats } from '../dist/character-stats.js';

const source = readFileSync(new URL('../worker/index.js', import.meta.url), 'utf8')
  .replace(/^import .*;\n/gm, '')
  .replace('export class HedoArchive', 'globalThis.HedoArchive=class HedoArchive')
  .replace('export default', 'globalThis.worker=');
const { routes } = JSON.parse(readFileSync(new URL('./fixtures/chronicle-routes-v23.json', import.meta.url), 'utf8'));
const people = ['sophie', 'jonathan', 'owen', 'sam', 'cindy'];
const proof = (fixture, runId) => ({ runId, roleId: fixture.roleId, seed: fixture.seed, actions: fixture.actions });

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

test('all five new characters verify both natural rage modes and deduplicate anonymous/public statistics', async t => {
  const h = harness(t), witnesses = routes.filter(route => people.some(id => route.id === `${id}-imagined` || route.id === `${id}-real`));
  assert.equal(witnesses.length, 10);
  const expectedTotals = Object.fromEntries(CHARACTER_IDS.map(id => [id, Object.fromEntries(CHARACTER_METRICS.map(key => [key, 0]))]));
  for (const fixture of witnesses) {
    const person = fixture.id.replace(/-(imagined|real)$/, ''), player = await h.register(), runId = randomUUID();
    const before = { ...fixture, actions: fixture.actions.slice(0, -1) };
    const beforeRun = replayRun(before.roleId, before.seed, before.actions), resolved = replayRun(fixture.roleId, fixture.seed, fixture.actions);
    assert.equal(beforeRun.eventId, fixture.eventId); assert.equal(resolved.completed, false);
    const initial = await h.call('/api/characters', { method: 'POST', token: player.token, body: {
      ...proof(before, runId), characters: people.map(id => ({ id, realHits: 9999, encounters: 9999 })),
      history: [{ eventId: 'rage-release', speaker: person, eventOutcome: { result: '真的失控了' } }], flags: { rage_real: 9999 },
    } });
    assert.equal(initial.status, 200); assert.deepEqual(initial.body.characters, deriveCharacterStats(beforeRun));
    const earned = await h.call('/api/characters', { method: 'POST', token: player.token, body: proof(fixture, runId) });
    assert.equal(earned.status, 200, fixture.id); assert.equal(earned.body.verified, true);
    assert.equal(earned.body.characters.length, CHARACTER_IDS.length); assert.deepEqual(earned.body.characters, deriveCharacterStats(resolved));
    const a = initial.body.characters.find(row => row.id === person), b = earned.body.characters.find(row => row.id === person);
    assert.equal(b.encounters - a.encounters, 1); assert.equal(b.imaginedHits - a.imaginedHits, Number(fixture.mode === 'imagined'));
    assert.equal(b.realHits - a.realHits, Number(fixture.mode === 'real'));
    for (const id of CHARACTER_IDS.filter(id => id !== person)) assert.deepEqual(
      earned.body.characters.find(row => row.id === id), initial.body.characters.find(row => row.id === id));
    for (const endpoint of ['/api/characters', '/api/achievements']) {
      const retry = await h.call(endpoint, { method: 'POST', token: player.token, body: proof(fixture, runId) });
      assert.equal(retry.status, 200); assert.deepEqual(retry.body.characters, earned.body.characters); assert.equal(retry.body.totalRuns, 0);
    }
    const me = await h.call('/api/me', { token: player.token }); assert.deepEqual(me.body.characters, earned.body.characters);
    for (const row of earned.body.characters) for (const key of CHARACTER_METRICS) expectedTotals[row.id][key] += row[key];
    const stored = JSON.stringify(h.sql.exec('SELECT * FROM character_runs').toArray());
    assert.ok(!stored.includes(fixture.seed)); assert.ok(!stored.includes(player.token));
  }
  const global = await h.call('/api/characters'); assert.equal(global.status, 200);
  assert.equal(global.body.characters.length, CHARACTER_IDS.length);
  for (const row of global.body.characters) for (const key of CHARACTER_METRICS) assert.equal(row[key], expectedTotals[row.id][key], `${row.id}/${key}`);
  const unrelated = await h.register(), isolated = await h.call('/api/me', { token: unrelated.token });
  assert.ok(isolated.body.characters.every(row => CHARACTER_METRICS.every(key => row[key] === 0)));
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM runs').one().n, 0);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM player_endings').one().n, 0);
});

test('all six explicitly co-present new scene targets validate through server replay', async t => {
  const h = harness(t), groupRoutes = routes.filter(route => route.id.startsWith('group-')); assert.equal(groupRoutes.length, 6);
  for (const fixture of groupRoutes) {
    const player = await h.register(), result = await h.call('/api/characters', { method: 'POST', token: player.token, body: proof(fixture, randomUUID()) });
    assert.equal(result.status, 200, fixture.id); assert.equal(result.body.verified, true);
    const run = replayRun(fixture.roleId, fixture.seed, fixture.actions);
    assert.deepEqual(result.body.characters, deriveCharacterStats(run));
    assert.equal(run.history.at(-1).speaker, fixture.target);
  }
});

test('forged new-character events and out-of-room targets cannot change a saved collection', async t => {
  const h = harness(t), player = await h.register(), initial = await h.call('/api/me', { token: player.token });
  for (const person of people) {
    const fixture = routes.find(route => route.id === `${person}-real`);
    for (const actions of [[{ type: 'choice', eventId: fixture.eventId, index: 0 }],
      [{ type: 'rage', phase: 'event', eventId: 'onboarding', target: person }]]) {
      const result = await h.call('/api/characters', { method: 'POST', token: player.token, body: {
        ...proof(fixture, randomUUID()), actions, characters: [{ id: person, realHits: 9999 }],
      } });
      assert.equal(result.status, 400); assert.equal(result.body.error, 'invalid_replay');
    }
  }
  assert.deepEqual((await h.call('/api/me', { token: player.token })).body, initial.body);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM character_runs').one().n, 0);
});
