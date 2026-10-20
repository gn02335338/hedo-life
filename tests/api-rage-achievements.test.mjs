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

// Exercise the real Worker handlers against SQLite. All proof inputs below are
// naturally played fixtures; no flags, history rows or outcomes are injected.
const workerSource = readFileSync(new URL('../worker/index.js', import.meta.url), 'utf8')
  .replace(/^import .*;\n/gm, '')
  .replace('export class HedoArchive', 'globalThis.HedoArchive=class HedoArchive')
  .replace('export default', 'globalThis.worker=');
const routes = JSON.parse(readFileSync(new URL('./fixtures/rage-achievement-routes.json', import.meta.url))).routes;
const targets = ['wing', 'spencer', 'rick', 'hope', 'erich', 'jenjen', 'sonny', 'kind', 'jack', 'meimei'];
const historicalMixedIds = [
  ...targets.map(target => `rage-${target}`),
  'rage-catharsis', 'rage-absent', 'rage-documented', 'rage-first-day',
];
const historicalTime = '2026-10-19T12:34:56.000Z';
const route = id => {
  const found = routes.find(item => item.id === id);
  assert.ok(found, `Missing naturally replayed fixture: ${id}`);
  return found;
};
const proof = (item, runId = randomUUID()) => ({ runId, roleId: item.roleId, seed: item.seed, actions: item.actions });
const ids = response => response.body.achievements.map(item => item.id);

function harness(t) {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.exec('PRAGMA foreign_keys = ON');
  const sql = { exec(query, ...args) {
    let rows = [];
    if (!args.length && query.includes(';')) db.exec(query);
    else {
      const statement = db.prepare(query);
      if (statement.columns().length) rows = statement.all(...args);
      else statement.run(...args);
    }
    return { toArray: () => rows, one: () => { assert.equal(rows.length, 1); return rows[0]; } };
  } };
  const storage = {
    sql,
    transactionSync(fn) {
      db.exec('BEGIN IMMEDIATE');
      try { const result = fn(); db.exec('COMMIT'); return result; }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    async getAlarm() { return null; },
    async setAlarm() {},
  };
  const ctx = { storage, blockConcurrencyWhile: fn => fn() };
  const scope = vm.createContext({
    DurableObject: class { constructor(context) { this.ctx = context; } },
    replayRun, VERSION, MAX_TURNS, ROLE_MAP, ENDINGS, ...http,
    validateFeedback, validatePublisherToken, FeedbackStore, AchievementStore, CharacterStore,
    crypto, Response, Request, URL, Date,
  });
  vm.runInContext(workerSource, scope);
  const archive = new scope.HedoArchive(ctx, {});
  const call = async (path, { method = 'GET', token, body } = {}) => {
    archive.rate = new http.RateGuard();
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body) headers['Content-Type'] = 'application/json';
    const response = await archive.fetch(new Request(`https://game.example${path}`, {
      method, headers, body: body ? JSON.stringify(body) : undefined,
    }));
    return { status: response.status, body: await response.json() };
  };
  const register = async () => {
    const token = randomBytes(32).toString('hex');
    const response = await call('/api/player', { method: 'POST', body: { token } });
    assert.equal(response.status, 200);
    return { token, id: response.body.playerId };
  };
  const submit = (player, item, runId) => call('/api/achievements', { method: 'POST', token: player.token, body: proof(item, runId) });
  return { sql, archive, call, register, submit };
}

test('HTTP replay keeps all ten imagined targets separate from actual-hit achievements', async t => {
  const h = harness(t);
  for (const target of targets) {
    for (const mode of ['imagined', 'real']) {
      const player = await h.register();
      const item = route(`${target}-${mode}`);
      const response = await h.submit(player, item);
      assert.equal(response.status, 200, `${target}/${mode}`);
      assert.equal(response.body.verified, true);
      assert.equal(response.body.totalRuns, 0);
      assert.deepEqual(ids(response).filter(id => id.startsWith('real-hit-')), mode === 'real' ? [`real-hit-${target}`] : []);
      assert.equal(ids(response).includes('rage-real'), mode === 'real');
      assert.equal(ids(response).includes('rage-imagined'), mode === 'imagined');
      assert.ok(historicalMixedIds.every(id => !response.body.newlyUnlocked.includes(id)));
      const character = response.body.characters.find(row => row.id === target);
      assert.equal(character.realHits, mode === 'real' ? 1 : 0);
      assert.equal(character.imaginedHits, mode === 'imagined' ? 1 : 0);
    }
  }
});

test('stored mixed-era badges retain their dates without becoming proof of an actual hit', async t => {
  const h = harness(t), player = await h.register();
  for (const id of historicalMixedIds) {
    h.sql.exec('INSERT INTO player_achievements (player_id,achievement_id,first_seen_at) VALUES (?,?,?)', player.id, id, historicalTime);
  }
  const response = await h.submit(player, route('first-day-imagined'));
  assert.equal(response.status, 200);
  assert.ok(ids(response).includes('dream-first-day'));
  assert.ok(ids(response).includes('rage-imagined'));
  assert.ok(!ids(response).includes('rage-real'));
  assert.ok(!ids(response).includes('real-first-day'));
  assert.ok(!ids(response).some(id => id.startsWith('real-hit-')));
  assert.ok(historicalMixedIds.every(id => !response.body.newlyUnlocked.includes(id)));
  const snapshot = await h.call('/api/me', { token: player.token });
  for (const id of historicalMixedIds) {
    assert.equal(snapshot.body.achievements.find(row => row.id === id)?.unlockedAt, historicalTime);
  }
  const reopened = new AchievementStore(h.sql, h.archive.ctx.storage);
  assert.equal(reopened.snapshot(player.id).filter(row => historicalMixedIds.includes(row.id)).length, historicalMixedIds.length);
});

test('actual-hit awards are target-specific, replay-verified and idempotent across retries', async t => {
  const h = harness(t), player = await h.register();
  const imagined = await h.submit(player, route('erich-imagined'));
  assert.equal(imagined.status, 200);
  const item = route('jenjen-real'), runId = randomUUID();
  const first = await h.submit(player, item, runId);
  assert.equal(first.status, 200);
  assert.deepEqual(ids(first).filter(id => id.startsWith('real-hit-')), ['real-hit-jenjen']);
  assert.ok(first.body.newlyUnlocked.includes('real-hit-jenjen'));
  assert.ok(!first.body.newlyUnlocked.includes('rage-imagined'));
  assert.equal(first.body.characters.find(row => row.id === 'erich').imaginedHits, 1);
  assert.equal(first.body.characters.find(row => row.id === 'erich').realHits, 0);
  assert.equal(first.body.characters.find(row => row.id === 'jenjen').realHits, 1);
  assert.equal(first.body.characters.find(row => row.id === 'jenjen').imaginedHits, 0);
  for (let attempt = 0; attempt < 3; attempt++) {
    const duplicate = await h.submit(player, item, runId);
    assert.equal(duplicate.status, 200);
    assert.deepEqual(duplicate.body.newlyUnlocked, []);
    assert.deepEqual(duplicate.body.achievements, first.body.achievements);
    assert.deepEqual(duplicate.body.characters, first.body.characters);
  }
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM player_achievements WHERE player_id=? AND achievement_id=?', player.id, 'real-hit-jenjen').one().n, 1);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM runs').one().n, 0);
});

test('actual first-day and legal awards unlock at their own resolved milestones through completion', async t => {
  const h = harness(t), player = await h.register(), runId = randomUUID();
  const first = await h.submit(player, route('first-day-real'), runId);
  assert.equal(first.status, 200);
  assert.ok(ids(first).includes('real-hit-wing'));
  assert.ok(ids(first).includes('real-first-day'));
  assert.ok(!ids(first).includes('dream-first-day'));
  assert.ok(!ids(first).includes('real-documented'));
  assert.ok(!ids(first).includes('rage-legal'));
  const completed = await h.call('/api/complete', { method: 'POST', token: player.token, body: proof(route('rage_legal'), runId) });
  assert.equal(completed.status, 200);
  assert.equal(completed.body.totalRuns, 1);
  assert.equal(completed.body.endingId, 'rage_legal-system');
  assert.ok(ids(completed).includes('real-documented'));
  assert.ok(ids(completed).includes('rage-legal'));
  assert.ok(!ids(completed).some(id => id.startsWith('dream-')));
  const duplicate = await h.call('/api/complete', { method: 'POST', token: player.token, body: proof(route('rage_legal'), runId) });
  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.body.duplicate, true);
  assert.equal(duplicate.body.totalRuns, 1);
  assert.deepEqual(duplicate.body.achievements, completed.body.achievements);
  assert.deepEqual(duplicate.body.characters, completed.body.characters);
  assert.equal(completed.body.characters.find(row => row.id === 'wing').realHits, 1);
});

test('client-supplied real-hit badges and invented replay evidence cannot unlock achievements', async t => {
  const h = harness(t), player = await h.register(), item = route('first-day-imagined');
  const response = await h.call('/api/achievements', { method: 'POST', token: player.token, body: {
    ...proof(item),
    achievements: ['real-hit-wing', 'real-first-day', 'real-documented', 'rage-real'],
    flags: { rage_real: 99, rage_target_wing: 99, rage_documented: 99 },
    history: [{ eventId: 'rage-release', speaker: 'wing', kind: 'rage', choiceIndex: 0, eventOutcome: { result: '真的失控了' } }],
    completed: true, endingId: 'rage_coup-system',
  } });
  assert.equal(response.status, 200);
  assert.ok(ids(response).includes('dream-first-day'));
  assert.ok(!ids(response).some(id => id.startsWith('real-')));
  assert.ok(!ids(response).includes('rage-real'));
  const before = await h.call('/api/me', { token: player.token });
  const forged = proof(item);
  forged.actions = [...forged.actions, { type: 'choice', eventId: 'rage-legal', index: 0 }];
  const rejected = await h.call('/api/achievements', { method: 'POST', token: player.token, body: forged });
  assert.equal(rejected.status, 400);
  assert.equal(rejected.body.error, 'invalid_replay');
  assert.deepEqual((await h.call('/api/me', { token: player.token })).body, before.body);
});
