import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { replayRun, createRun, applyChoice, advance, requestExit, enableActivitySchedule, VERSION, MAX_TURNS } from '../dist/engine.js';
import { ROLE_MAP } from '../dist/roles.js';
import { ENDINGS } from '../dist/endings.js';
import { FeedbackStore } from '../worker/feedback-store.js';
import { AchievementStore } from '../worker/achievements.js';
import { CharacterStore } from '../worker/characters.js';
import { ObservationStore } from '../worker/observations.js';
import { LeaderboardStore, validateLeaderboardFilter, validateLeaderboardNickname } from '../worker/leaderboards.js';
import { validateFeedback, validatePublisherToken } from '../worker/feedback.js';
import { deriveLeaderboardScoreV56, leaderboardEligibilityV56, SCORE_VERSION_V56 } from '../dist/leaderboard-score-v56.js';
import { CardGameStore, CardRateGuard, validateCardLifeClaim, validateCardActionRequest, lifeTicketAward } from '../worker/card-game.js';
import { createCardState, applyCardAction, projectCardState, CARD_CATALOG } from '../dist/cards/rules.js';
import * as http from '../worker/http.js';

const source = readFileSync(new URL('../worker/index.js', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '').replace('export class HedoArchive', 'globalThis.HedoArchive=class HedoArchive').replace('export default', 'globalThis.worker=');
function harness() {
  const db = new DatabaseSync(':memory:'); db.exec('PRAGMA foreign_keys=ON');
  const sql = { exec(query, ...args) { let rows = []; if (!args.length && query.includes(';')) db.exec(query); else { const statement = db.prepare(query); if (statement.columns().length) rows = statement.all(...args); else statement.run(...args); } return { toArray: () => rows, one: () => { assert.equal(rows.length, 1); return rows[0]; } }; } };
  const storage = { sql, transactionSync(fn) { db.exec('BEGIN IMMEDIATE'); try { const value = fn(); db.exec('COMMIT'); return value; } catch (error) { db.exec('ROLLBACK'); throw error; } }, async getAlarm() { return null; }, async setAlarm() {} };
  const ctx = { storage, blockConcurrencyWhile: fn => fn() };
  const scope = vm.createContext({ DurableObject: class { constructor(context) { this.ctx = context; } }, replayRun, VERSION, MAX_TURNS, ROLE_MAP, ENDINGS, ...http, validateFeedback, validatePublisherToken, FeedbackStore, AchievementStore, CharacterStore, ObservationStore, LeaderboardStore, validateLeaderboardFilter, validateLeaderboardNickname, deriveLeaderboardScoreV56, leaderboardEligibilityV56, SCORE_VERSION_V56, CardGameStore, CardRateGuard, validateCardLifeClaim, crypto, Response, Request, URL, Date });
  vm.runInContext(source, scope);
  let archive = new scope.HedoArchive(ctx, {});
  const call = async (path, { method = 'GET', token, body, headers = {}, resetRate = true } = {}) => {
    if (resetRate) { archive.rate = new http.RateGuard(); archive.cardRate = new CardRateGuard(); }
    const response = await archive.fetch(new Request(`https://game.example${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) }));
    return { status: response.status, body: await response.json(), headers: response.headers };
  };
  const register = async (token = 'a'.repeat(64)) => { const response = await call('/api/player', { method: 'POST', body: { token } }); assert.equal(response.status, 200); return { id: response.body.playerId, token }; };
  return { db, sql, storage, get archive() { return archive; }, restart() { archive = new scope.HedoArchive(ctx, {}); }, call, register };
}
const completion = (seed = '00000001', roleId = 'system') => advance(applyChoice(enableActivitySchedule(createRun(roleId, `e39-cal46-kin49-g-e-s-m-${seed}`)), 2));
const proof = (run, runId = randomUUID()) => ({ runId, roleId: run.roleId, seed: run.seed, actions: run.actions });
const draw = (revision, requestId = randomUUID(), count = 1) => ({ requestId, revision, action: { type: 'draw', banner: 'all', count } });
const act = (h, p, body, headers) => h.call('/api/cards/action', { method: 'POST', token: p.token, body, headers });
const claim = (h, p, body, headers) => h.call('/api/cards/claim-life', { method: 'POST', token: p.token, body, headers });
const storedState = (h, p) => JSON.parse(h.sql.exec('SELECT state_json FROM card_players WHERE player_id=?', p.id).one().state_json);
let longerRun;
function completedWork(exceptSeed = null) {
  if (longerRun && longerRun.seed !== exceptSeed) return structuredClone(longerRun);
  const routes = JSON.parse(readFileSync(new URL('./fixtures/current-endings-v67.json', import.meta.url), 'utf8')).routes;
  for (const route of routes) {
    if (route.seed === exceptSeed) continue;
    const run = replayRun(route.roleId, route.seed, route.actions);
    if (run.completed && leaderboardEligibilityV56(run).eligible && deriveLeaderboardScoreV56(run).completedTurns >= 3) {
      if (!longerRun) longerRun = run;
      return structuredClone(run);
    }
  }
  throw new Error('Missing canonical completed-work witness');
}

test('cards use the existing anonymous identity and private no-store projection without exposing random seeds', async t => {
  const h = harness(); t.after(() => h.db.close());
  assert.equal((await h.call('/api/cards')).status, 401);
  assert.equal((await h.call('/api/cards/action', { method: 'POST', body: draw(0) })).status, 401);
  const p = await h.register(), other = await h.register('b'.repeat(64));
  const first = await h.call('/api/cards', { token: p.token });
  assert.equal(first.status, 200); assert.equal(first.headers.get('Cache-Control'), 'private, no-store');
  assert.equal(first.body.state.revision, 0); assert.equal(first.body.state.tickets, 15);
  assert.deepEqual((await h.call('/api/cards', { token: p.token })).body, first.body);
  const privateState = storedState(h, p), text = JSON.stringify(first.body);
  assert.equal(typeof privateState.seed, 'string'); assert.equal(privateState.seed.length, 64);
  for (const secret of [privateState.seed, p.id, p.token, '"seed"', '"counter"', '"rng"']) assert.ok(!text.includes(secret), secret);
  assert.equal((await act(h, p, draw(0))).status, 200);
  assert.equal((await h.call('/api/cards', { token: other.token })).body.state.tickets, 15);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM card_players').one().n, 2);
  assert.equal((await h.call('/api/me', { token: p.token })).body.totalRuns, 0);
});

test('draw results are derived from the stored private seed and never from browser outcomes', async t => {
  const h = harness(); t.after(() => h.db.close()); const p = await h.register();
  await h.call('/api/cards', { token: p.token });
  const payload = draw(0, randomUUID(), 10), before = storedState(h, p);
  const expected = projectCardState(applyCardAction(before, payload.action));
  const result = await act(h, p, payload);
  assert.equal(result.status, 200); assert.equal(result.body.duplicate, false);
  assert.deepEqual(result.body.state, expected); assert.equal(result.body.state.tickets, 5);
  assert.equal((await act(h, p, { ...draw(1), result: { rarity: 'SSR' } })).status, 400);
});

test('exact request retries are durable and return current state without drawing twice or rolling back another action', async t => {
  const h = harness(); t.after(() => h.db.close()); const p = await h.register();
  const payload = draw(0), results = await Promise.all([act(h, p, payload), act(h, p, payload)]);
  assert.ok(results.every(result => result.status === 200));
  assert.deepEqual(results.map(result => result.body.duplicate).sort(), [false, true]);
  assert.equal(storedState(h, p).tickets, 14); assert.equal(storedState(h, p).revision, 1);
  const reordered = await act(h, p, { action: { count: 1, banner: 'all', type: 'draw' }, revision: 0, requestId: payload.requestId });
  assert.equal(reordered.status, 200); assert.equal(reordered.body.duplicate, true, 'JSON field ordering does not change the intended request');
  assert.equal((await act(h, p, { ...payload, action: { ...payload.action, banner: 'item' } })).status, 409);
  assert.equal((await act(h, p, { ...payload, revision: 1 })).status, 409);
  assert.equal((await act(h, p, draw(1))).status, 200);
  const after = projectCardState(storedState(h, p)); h.restart();
  const retry = await act(h, p, payload); assert.equal(retry.status, 200); assert.equal(retry.body.duplicate, true);
  assert.equal(retry.body.appliedRevision, 1); assert.deepEqual(retry.body.state, after); assert.equal(retry.body.state.tickets, 13);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM card_action_receipts').one().n, 2);
});

test('optimistic revision serializes separate requests while identical request IDs remain owner-scoped', async t => {
  const h = harness(); t.after(() => h.db.close()); const p = await h.register(), other = await h.register('b'.repeat(64));
  const payload = draw(0), results = await Promise.all([act(h, p, payload), act(h, p, draw(0))]);
  assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
  assert.equal(storedState(h, p).tickets, 14);
  assert.equal((await act(h, other, payload)).status, 200); assert.equal(storedState(h, other).tickets, 14);
  assert.notEqual(storedState(h, p).seed, storedState(h, other).seed);
});

test('failed card mutations roll back both the private state and idempotency receipt', async t => {
  const h = harness(); t.after(() => h.db.close()); const p = await h.register();
  await h.call('/api/cards', { token: p.token }); const before = storedState(h, p), store = h.archive.cardStore(), save = store.save;
  store.save = function (...args) { save.apply(this, args); throw new Error('synthetic interrupted storage'); };
  const payload = draw(0); assert.equal((await act(h, p, payload)).status, 503);
  assert.deepEqual(storedState(h, p), before); assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM card_action_receipts').one().n, 0);
  store.save = save; assert.equal((await act(h, p, payload)).status, 200); assert.equal(storedState(h, p).tickets, 14);
});

test('battle actions persist progress, validate locked stages and award each stage only once', async t => {
  const h = harness(); t.after(() => h.db.close()); const p = await h.register();
  let state = (await h.call('/api/cards', { token: p.token })).body.state;
  const action = async intention => {
    const response = await act(h, p, { requestId: randomUUID(), revision: state.revision, action: intention });
    assert.equal(response.status, 200, JSON.stringify(response.body)); state = response.body.state; return response;
  };
  assert.equal((await act(h, p, { requestId: randomUUID(), revision: 0, action: { type: 'start-battle', stage: 2 } })).status, 400);
  await action({ type: 'start-battle', stage: 1 });
  await action({ type: 'battle-turn', move: 'event' });
  assert.equal((await act(h, p, { requestId: randomUUID(), revision: state.revision, action: { type: 'draw', count: 1, banner: 'all' } })).status, 400);
  const finishBattle = async () => {
    for (let round = 0; round < 60 && state.battle.status === 'active'; round++) {
      const actor = state.battle.party.map((entry, target) => ({ ...entry, target })).filter(entry => entry.hp > 0).sort((a, b) => b.attack - a.attack)[0];
      const card = CARD_CATALOG.find(entry => entry.id === actor.id);
      await action({ type: 'battle-turn', move: actor.cooldown === 0 && card.effect !== 'heal' ? 'skill' : 'strike', target: actor.target });
    }
  };
  await finishBattle();
  assert.equal(state.battle.status, 'won'); assert.deepEqual(state.campaign.completed, [1]); assert.ok(state.tickets > 15);
  const tickets = state.tickets, shards = state.shards;
  await action({ type: 'start-battle', stage: 1 });
  await action({ type: 'battle-turn', move: 'event' }); await finishBattle();
  assert.equal(state.battle.status, 'won'); assert.equal(state.tickets, tickets); assert.equal(state.shards, shards);
  await action({ type: 'start-battle', stage: 2 });
  await action({ type: 'abandon-battle' }); assert.equal(state.battle.status, 'abandoned');
  assert.equal(state.tickets, tickets); assert.equal(state.shards, shards);
  h.restart(); assert.deepEqual((await h.call('/api/cards', { token: p.token })).body.state, state);
});

test('strict card action schemas reject browser balances, unknown cards, malformed arrays and extra battle fields', async t => {
  const h = harness(); t.after(() => h.db.close()); const p = await h.register();
  const malformed = [
    { ...draw(0), tickets: 9999 }, { ...draw(0), revision: -1 }, { ...draw(0), revision: 0.1 }, { ...draw(0), requestId: 'made-up' },
    { ...draw(0), action: { type: 'draw', count: 100, banner: 'all' } }, { ...draw(0), action: { type: 'draw', count: 1, banner: 'SSR' } },
    { ...draw(0), action: { type: 'draw', count: 1, banner: 'all', seed: 'my-result' } },
    { ...draw(0), action: { type: 'set-deck', characters: ['a', 'a', 'a'], item: 'i', event: 'e' } },
    { ...draw(0), action: { type: 'upgrade', cardId: 'a', level: 99 } },
    { ...draw(0), action: { type: 'start-battle', stage: 11 } },
    { ...draw(0), action: { type: 'battle-turn', move: 'strike', target: 3 } },
    { ...draw(0), action: { type: 'battle-turn', move: 'strike', target: 0, damage: 9999 } },
    { ...draw(0), action: { type: 'abandon-battle', reward: 99 } },
    { ...draw(0), action: { type: 'grant-tickets', count: 99 } }
  ];
  for (const payload of malformed) assert.equal((await act(h, p, payload)).status, 400, JSON.stringify(payload));
  assert.equal((await act(h, p, { ...draw(0), action: { type: 'craft', cardId: 'unknown-card' } })).status, 400);
  for (const cardId of ['constructor', '__proto__', 'toString']) {
    assert.equal((await act(h, p, { ...draw(0), action: { type: 'upgrade', cardId } })).status, 400);
    assert.equal((await act(h, p, { ...draw(0), action: { type: 'craft', cardId } })).status, 400);
  }
  assert.equal((await act(h, p, { ...draw(0), action: { type: 'battle-turn', move: 'event' } })).status, 400, 'valid schema still requires an active battle');
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM card_action_receipts').one().n, 0);
  assert.equal((await h.call('/api/cards', { token: p.token })).body.state.revision, 0);
});

test('career claims derive score and actual completed work from canonical replay and commit one immutable grant', async t => {
  const h = harness(); t.after(() => h.db.close()); const p = await h.register(), run = completedWork(), payload = proof(run), score = deriveLeaderboardScoreV56(run);
  const response = await claim(h, p, payload); assert.equal(response.status, 200);
  const award = Math.min(12, 1 + Math.floor(score.total / 1000) + Math.floor(score.completedTurns / 6));
  assert.equal(response.body.score, score.total); assert.equal(response.body.workTurns, score.completedTurns);
  assert.equal(response.body.ticketsAwarded, award); assert.equal(response.body.state.tickets, 15 + award); assert.equal(response.body.duplicate, false);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM runs').one().n, 1);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM card_life_claims').one().n, 1);
  assert.equal((await h.call('/api/me', { token: p.token })).body.totalRuns, 1);
  assert.equal((await h.call('/api/leaderboard')).body.entries.length, 0, 'claiming a reward never publishes a nickname');
  const text = JSON.stringify(h.sql.exec('SELECT * FROM card_life_claims').toArray());
  assert.ok(!text.includes(run.seed)); assert.ok(!text.includes('"actions"'));
});

test('claim retries after concurrency and restart never increase tickets or replay a reward', async t => {
  const h = harness(); t.after(() => h.db.close()); const p = await h.register(), payload = proof(completedWork());
  const results = await Promise.all([claim(h, p, payload), claim(h, p, payload)]);
  assert.ok(results.every(result => result.status === 200)); assert.deepEqual(results.map(result => result.body.duplicate).sort(), [false, true]);
  const before = storedState(h, p), receipt = h.sql.exec('SELECT * FROM card_life_claims').one(); h.restart();
  const retry = await claim(h, p, payload); assert.equal(retry.status, 200); assert.equal(retry.body.duplicate, true);
  assert.equal(retry.body.ticketsAwarded, receipt.tickets_awarded); assert.deepEqual(storedState(h, p), before);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM card_life_claims').one().n, 1);
});

test('a new UUID cannot claim the same canonical life again or add copied character counters, while a new seed remains eligible', async t => {
  const h = harness(); t.after(() => h.db.close()); const p = await h.register(), run = completedWork(), payload = proof(run);
  const first = await claim(h, p, payload); assert.equal(first.status, 200);
  const characters = (await h.call('/api/characters')).body, state = storedState(h, p), copied = { ...payload, runId: randomUUID() };
  h.restart(); const response = await claim(h, p, copied);
  assert.equal(response.status, 409); assert.equal(response.body.error, 'card_life_already_claimed');
  assert.deepEqual((await h.call('/api/characters')).body, characters); assert.deepEqual(storedState(h, p), state);
  assert.equal(h.archive.characters.progress(copied.runId), null); assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM runs').one().n, 1);
  const different = await claim(h, p, proof(completedWork(run.seed))); assert.equal(different.status, 200);
  assert.ok(different.body.ticketsAwarded > 0); assert.equal(different.body.state.tickets, state.tickets + different.body.ticketsAwarded);
});

test('concurrent copied UUIDs bind one canonical life before any character or achievement mutation', async t => {
  const h = harness(); t.after(() => h.db.close()); const p = await h.register(), run = completedWork(), a = proof(run), b = proof(run);
  const replies = await Promise.all([claim(h, p, a), claim(h, p, b)]);
  assert.deepEqual(replies.map(result => result.status).sort(), [200, 409]);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM card_life_intents').one().n, 1);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM card_life_claims').one().n, 1);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM character_runs').one().n, 1);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM achievement_runs').one().n, 1);
  const loser = replies[0].status === 409 ? a : b; assert.equal(h.archive.characters.progress(loser.runId), null);
});

test('a same-seed fork under another UUID cannot evade the canonical-life reservation', async t => {
  const h = harness(); t.after(() => h.db.close()); const p = await h.register(), original = completion(), payload = proof(original);
  assert.equal((await claim(h, p, payload)).status, 200);
  const entered = advance(applyChoice(enableActivitySchedule(createRun('system', original.seed)), 0));
  const fork = advance(applyChoice(requestExit(entered), 0)), forkProof = proof(fork);
  assert.equal(fork.completed, true); assert.ok(fork.actions.length > original.actions.length);
  assert.equal((await claim(h, p, forkProof)).status, 409); assert.equal(h.archive.characters.progress(forkProof.runId), null);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM character_runs').one().n, 1);
});

test('an exact existing completed proof can claim without replacing historical commitments or double-counting archive stats', async t => {
  const h = harness(); t.after(() => h.db.close()); const p = await h.register(), payload = proof(completedWork());
  assert.equal((await h.call('/api/complete', { method: 'POST', token: p.token, body: payload })).status, 200);
  const beforeCommit = { ...h.archive.characters.progress(payload.runId) };
  const characters = (await h.call('/api/characters')).body;
  assert.equal((await claim(h, p, payload)).status, 200);
  assert.deepEqual({ ...h.archive.characters.progress(payload.runId) }, beforeCommit);
  assert.deepEqual((await h.call('/api/characters')).body, characters);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM runs').one().n, 1);
});

test('reporting exits and fewer than three actual work scenes earn no career tickets despite high initial stats', async t => {
  const h = harness(); t.after(() => h.db.close()); const p = await h.register(), run = completion();
  const response = await claim(h, p, proof(run)); assert.equal(response.status, 200);
  assert.equal(response.body.workTurns, 0); assert.equal(response.body.score, 0); assert.equal(response.body.ticketsAwarded, 0); assert.equal(response.body.state.tickets, 15);
  for (const score of [0, 1000, 10000]) for (const turns of [0, 1, 2]) assert.equal(lifeTicketAward(score, turns), 0);
  assert.equal(lifeTicketAward(10000, 23), 12); assert.equal(lifeTicketAward(0, 3), 1);
});

test('claim rejects unfinished, forged, extended, legacy and client-invented score or ticket proofs', async t => {
  const h = harness(); t.after(() => h.db.close()); const p = await h.register(), payload = proof(completedWork());
  assert.equal((await h.call('/api/cards/claim-life', { method: 'POST', body: payload })).status, 401);
  for (const extra of [{ score: 10000 }, { tickets: 999 }, { workTurns: 23 }, { endingId: 'nasdaq-system' }]) assert.equal((await claim(h, p, { ...payload, ...extra })).status, 400);
  const unfinished = advance(applyChoice(enableActivitySchedule(createRun('system', 'e39-cal46-kin49-g-e-s-m-00000001')), 0));
  assert.equal((await claim(h, p, proof(unfinished))).status, 400);
  assert.equal((await claim(h, p, { ...payload, actions: [{ type: 'choice', eventId: 'made-up', index: 0 }] })).status, 400);
  assert.equal((await claim(h, p, { ...payload, actions: [...payload.actions, { type: 'exit' }] })).status, 400);
  const legacy = advance(applyChoice(enableActivitySchedule(createRun('system', 'e39-cal46-kin49-g-e-s-old')), 2));
  assert.equal((await claim(h, p, proof(legacy))).status, 400);
  assert.equal(h.sql.exec("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='card_life_claims'").one().n, 0, 'invalid proofs never initialize card storage');
});

test('ownership and exact action commitments prevent claiming another player or a different same-ending branch', async t => {
  const h = harness(); t.after(() => h.db.close()); const p = await h.register(), other = await h.register('b'.repeat(64)), original = completion(), payload = proof(original);
  assert.equal((await claim(h, p, payload)).status, 200);
  assert.equal((await claim(h, other, payload)).status, 409);
  assert.equal((await claim(h, p, { ...payload, seed: 'e39-cal46-kin49-g-e-s-m-00000002' })).status, 409);
  const entered = advance(applyChoice(enableActivitySchedule(createRun('system', original.seed)), 0));
  const fork = advance(applyChoice(requestExit(entered), 0));
  assert.equal(fork.completed, true); assert.equal(fork.endingId, original.endingId);
  assert.equal((await claim(h, p, proof(fork, payload.runId))).status, 409);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM card_life_claims').one().n, 1);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM card_players').one().n, 1);
});

test('missing or changed historical action commitments are rejected rather than estimated from an ending', async t => {
  const h = harness(); t.after(() => h.db.close()); const p = await h.register(), run = completedWork(), payload = proof(run);
  h.sql.exec('INSERT INTO runs(id,player_id,ending_id,role_id,actual_role_id,rank,salary,turns,game_version,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)', payload.runId, p.id, run.endingId, run.roleId, run.actualRoleId, run.rank, run.pay, run.turn, VERSION, new Date().toISOString());
  assert.equal((await claim(h, p, payload)).status, 409);
  const next = proof(run); assert.equal((await h.call('/api/complete', { method: 'POST', token: p.token, body: next })).status, 200);
  h.sql.exec('UPDATE character_runs SET action_hash=? WHERE id=?', 'different-history', next.runId);
  assert.equal((await claim(h, p, next)).status, 409); assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM card_life_claims').one().n, 0);
});

test('ticket grant, receipt, newly completed life and ending collection roll back together on interrupted storage', async t => {
  const h = harness(); t.after(() => h.db.close()); const p = await h.register(), payload = proof(completedWork());
  const store = h.archive.cardStore(), save = store.save;
  store.save = function (...args) { save.apply(this, args); throw new Error('synthetic storage interruption'); };
  assert.equal((await claim(h, p, payload)).status, 503);
  for (const table of ['card_players', 'card_life_claims', 'runs', 'player_endings']) assert.equal(h.sql.exec(`SELECT COUNT(*) AS n FROM ${table}`).one().n, 0, table);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM card_life_intents').one().n, 1, 'an interrupted grant retains its owner/run identity reservation');
  assert.equal((await claim(h, p, { ...payload, runId: randomUUID() })).status, 409);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM character_runs').one().n, 1, 'changing UUID after interruption cannot duplicate counters');
  store.save = save; assert.equal((await claim(h, p, payload)).status, 200);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM card_life_claims').one().n, 1); assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM runs').one().n, 1);
});

for (const columns of [5, 7]) test(`existing ${columns}-column preview reservations migrate additively and grant without resetting card progress`, async t => {
  const h = harness(); t.after(() => h.db.close()); const p = await h.register(), payload = proof(completedWork());
  h.sql.exec(`CREATE TABLE card_life_intents(
    run_id TEXT PRIMARY KEY,player_id TEXT NOT NULL REFERENCES players(id),role_id TEXT NOT NULL,seed_hash TEXT NOT NULL,
    ${columns === 7 ? 'action_hash TEXT NOT NULL,action_count INTEGER NOT NULL,' : ''}
    created_at TEXT NOT NULL,UNIQUE(player_id,role_id,seed_hash));
    CREATE TABLE card_players(player_id TEXT PRIMARY KEY REFERENCES players(id),revision INTEGER NOT NULL,state_json TEXT NOT NULL,updated_at TEXT NOT NULL);`);
  const prior = applyCardAction(createCardState('synthetic-preserved-preview'), { type: 'draw', count: 1, banner: 'all' });
  h.sql.exec('INSERT INTO card_players(player_id,revision,state_json,updated_at) VALUES(?,?,?,?)', p.id, prior.revision, JSON.stringify(prior), '2026-10-24T00:00:00Z');
  if (columns === 7) h.sql.exec('INSERT INTO card_life_intents(run_id,player_id,role_id,seed_hash,action_hash,action_count,created_at) VALUES(?,?,?,?,?,?,?)', 'kept-preview-run', p.id, 'hr', 'kept-preview-hash', 'kept-action-hash', 2, '2026-10-24T00:00:00Z');
  else h.sql.exec('INSERT INTO card_life_intents(run_id,player_id,role_id,seed_hash,created_at) VALUES(?,?,?,?,?)', 'kept-preview-run', p.id, 'hr', 'kept-preview-hash', '2026-10-24T00:00:00Z');
  const response = await claim(h, p, payload); assert.equal(response.status, 200, JSON.stringify(response.body));
  const after = storedState(h, p); assert.equal(after.seed, prior.seed); assert.equal(after.counter, prior.counter); assert.deepEqual(after.collection, prior.collection);
  assert.equal(after.tickets, prior.tickets + response.body.ticketsAwarded); assert.equal(after.revision, prior.revision + 1);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM card_life_intents').one().n, 2);
  const old = h.sql.exec('SELECT * FROM card_life_intents WHERE run_id=?', 'kept-preview-run').one();
  assert.equal(old.seed_hash, 'kept-preview-hash'); assert.equal(old.created_at, '2026-10-24T00:00:00Z');
  if (columns === 7) { assert.equal(old.action_hash, 'kept-action-hash'); assert.equal(old.action_count, 2); }
  const retry = await claim(h, p, payload); assert.equal(retry.status, 200); assert.equal(retry.body.duplicate, true); assert.deepEqual(storedState(h, p), after);
});

test('card endpoints preserve same-origin checks, body limits, method guards and anonymous request throttling', async t => {
  const h = harness(); t.after(() => h.db.close()); const p = await h.register(), payload = proof(completedWork());
  for (const headers of [{ Origin: 'https://other.example' }, { 'Sec-Fetch-Site': 'cross-site' }]) {
    assert.equal((await act(h, p, draw(0), headers)).status, 403); assert.equal((await claim(h, p, payload, headers)).status, 403);
  }
  assert.equal((await act(h, p, { ...draw(0), padding: 'x'.repeat(5000) })).status, 413);
  assert.equal((await claim(h, p, { ...payload, padding: 'x'.repeat(70000) })).status, 413);
  for (const path of ['/api/cards?seed=x', '/api/cards/action?revision=0', '/api/cards/claim-life?score=10000']) assert.equal((await h.call(path, { token: p.token })).status, 400);
  assert.equal((await h.call('/api/cards', { method: 'POST', token: p.token, body: {} })).status, 405);
  assert.equal((await h.call('/api/cards/action', { token: p.token })).status, 405);
  assert.equal((await h.call('/api/cards/missing', { token: p.token })).status, 404);
  h.archive.cardRate = new CardRateGuard(); h.archive.rate = new http.RateGuard();
  for (let i = 0; i < 30; i++) assert.equal((await h.call('/api/cards', { token: p.token, resetRate: false })).status, 200);
  assert.equal((await h.call('/api/cards', { token: p.token, resetRate: false })).status, 429);
  for (let i = 0; i < 10; i++) assert.equal((await h.call('/api/me', { token: p.token, resetRate: false })).status, 200);
  assert.equal((await h.call('/api/me', { token: p.token, resetRate: false })).status, 429, 'career guard stays separate and unchanged');
});

test('pure server validators preserve optional battle actor selection and reject unknown outer claim fields', () => {
  assert.equal(validateCardActionRequest({ ...draw(0), action: { type: 'battle-turn', move: 'guard' } }).action.move, 'guard');
  assert.equal(validateCardActionRequest({ ...draw(0), action: { type: 'battle-turn', move: 'skill', target: 2 } }).action.target, 2);
  assert.throws(() => validateCardLifeClaim({ ...proof(completion()), consent: true }), error => error.status === 400);
});
