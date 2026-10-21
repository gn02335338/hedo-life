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
const { routes } = JSON.parse(readFileSync(new URL('./fixtures/lowpay-routes-v24.json', import.meta.url), 'utf8'));
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

const selected = routes.filter(route => /^tip-choice-|^tip-(event|result)-rage-/.test(route.id));
const character = (rows, id = 'erich') => rows.find(row => row.id === id);

test('all advice options and four natural Erich rage prefixes verify, complete and deduplicate anonymous/public statistics', async t => {
  const h = harness(t); assert.equal(selected.length, 7);
  const expectedTotals = Object.fromEntries(CHARACTER_IDS.map(id => [id, Object.fromEntries(CHARACTER_METRICS.map(key => [key, 0]))]));
  for (const fixture of selected) {
    const player = await h.register(), runId = randomUUID(), tipIndex = fixture.actions.findIndex(action => action.eventId === 'low-pay-tip');
    assert.ok(tipIndex >= 0); const prefix = { ...fixture, actions: fixture.actions.slice(0, tipIndex) };
    const before = replayRun(prefix.roleId, prefix.seed, prefix.actions), resolved = replayRun(fixture.roleId, fixture.seed, fixture.actions);
    assert.equal(before.eventId, 'low-pay-tip'); assert.equal(before.salaryAdvice.status, 'open'); assert.equal(resolved.completed, false);
    const initial = await h.call('/api/characters', { method: 'POST', token: player.token, body: {
      ...proof(prefix, runId), salaryAdvice: { from: 100, to: 1, status: 'done' }, pay: 1,
      history: [{ eventId: 'low-pay-tip', speaker: 'erich', eventOutcome: { result: '真的失控了' } }],
      characters: [{ id: 'erich', realHits: 9999, encounters: 9999 }],
    } });
    assert.equal(initial.status, 200); assert.deepEqual(initial.body.characters, deriveCharacterStats(before));
    const earned = await h.call('/api/characters', { method: 'POST', token: player.token, body: proof(fixture, runId) });
    assert.equal(earned.status, 200, fixture.id); assert.equal(earned.body.verified, true);
    assert.deepEqual(earned.body.characters, deriveCharacterStats(resolved)); assert.equal(earned.body.totalRuns, 0);
    const a = character(initial.body.characters), b = character(earned.body.characters);
    assert.equal(b.realHits - a.realHits, Number(fixture.mode === 'real'));
    assert.equal(b.imaginedHits - a.imaginedHits, Number(fixture.mode === 'imagined'));
    if (fixture.id.startsWith('tip-choice-')) assert.equal(b.encounters - a.encounters, 1);
    for (const endpoint of ['/api/characters', '/api/achievements']) {
      const retry = await h.call(endpoint, { method: 'POST', token: player.token, body: proof(fixture, runId) });
      assert.equal(retry.status, 200); assert.equal(retry.body.totalRuns, 0); assert.deepEqual(retry.body.characters, earned.body.characters);
    }
    const full = { ...fixture, actions: fixture.completionActions }, ended = replayRun(full.roleId, full.seed, full.actions);
    assert.equal(ended.completed, true); assert.equal(ended.salaryAdvice, null);
    const receipt = await h.call('/api/complete', { method: 'POST', token: player.token, body: proof(full, runId) });
    assert.equal(receipt.status, 200, fixture.id); assert.equal(receipt.body.recorded, true); assert.equal(receipt.body.duplicate, false);
    assert.equal(receipt.body.endingId, ended.endingId); assert.equal(receipt.body.totalRuns, 1);
    assert.deepEqual(receipt.body.characters, deriveCharacterStats(ended));
    const retry = await h.call('/api/complete', { method: 'POST', token: player.token, body: proof(full, runId) });
    assert.equal(retry.status, 200); assert.equal(retry.body.duplicate, true); assert.deepEqual(retry.body.characters, receipt.body.characters);
    const older = await h.call('/api/characters', { method: 'POST', token: player.token, body: proof(prefix, runId) });
    assert.equal(older.status, 200); assert.deepEqual(older.body.characters, receipt.body.characters);
    const me = await h.call('/api/me', { token: player.token }); assert.deepEqual(me.body.characters, receipt.body.characters);
    for (const row of receipt.body.characters) for (const key of CHARACTER_METRICS) expectedTotals[row.id][key] += row[key];
    const stored = JSON.stringify(h.sql.exec('SELECT * FROM character_runs').toArray());
    assert.ok(!stored.includes(fixture.seed)); assert.ok(!stored.includes(player.token)); assert.ok(!stored.includes('法師把降薪通知'));
  }
  const global = await h.call('/api/characters'); assert.equal(global.status, 200);
  for (const row of global.body.characters) for (const key of CHARACTER_METRICS) assert.equal(row[key], expectedTotals[row.id][key], `${row.id}/${key}`);
  const stats = await h.call('/api/stats'); assert.equal(stats.body.totalRuns, selected.length);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM runs').one().n, selected.length);
  const other = await h.register(), isolated = await h.call('/api/me', { token: other.token });
  assert.ok(isolated.body.characters.every(row => CHARACTER_METRICS.every(key => row[key] === 0)));
});

test('e24 rejects an invented early advice event and an absent rage target without changing existing anonymous collections', async t => {
  const h = harness(t), player = await h.register(), fixture = routes.find(route => route.id === 'accepted-cut');
  const baseline = await h.call('/api/me', { token: player.token });
  const attempts = [
    [{ type: 'choice', eventId: 'low-pay-tip', index: 0 }],
    [...fixture.actions, { type: 'rage', phase: 'event', eventId: 'low-pay-tip', target: 'wing' }],
    [...fixture.actions, { type: 'choice', eventId: 'low-pay-tip', index: 9 }],
  ];
  for (const actions of attempts) {
    const rejected = await h.call('/api/characters', { method: 'POST', token: player.token, body: {
      ...proof(fixture, randomUUID()), actions, pay: 1, salaryAdvice: { from: 100, to: 1, status: 'open' },
      characters: [{ id: 'erich', realHits: 9999 }],
    } });
    assert.equal(rejected.status, 400); assert.equal(rejected.body.error, 'invalid_replay');
  }
  assert.deepEqual((await h.call('/api/me', { token: player.token })).body, baseline.body);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM character_runs').one().n, 0);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM runs').one().n, 0);
});
