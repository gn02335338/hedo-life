import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { replayRun, createRun, getEvent, applyChoice, advance, requestExit, enableActivitySchedule, VERSION, MAX_TURNS } from '../dist/engine.js';
import { ROLE_MAP } from '../dist/roles.js';
import { ENDINGS } from '../dist/endings.js';
import { FeedbackStore } from '../worker/feedback-store.js';
import { AchievementStore } from '../worker/achievements.js';
import { CharacterStore } from '../worker/characters.js';
import { ObservationStore } from '../worker/observations.js';
import { LeaderboardStore, validateLeaderboardFilter, validateLeaderboardNickname } from '../worker/leaderboards.js';
import { validateFeedback, validatePublisherToken } from '../worker/feedback.js';
import { deriveLeaderboardScoreV56, leaderboardEligibilityV56, SCORE_VERSION_V56, LEADERBOARD_METRICS_V56 } from '../dist/leaderboard-score-v56.js';
import * as http from '../worker/http.js';

const source = readFileSync(new URL('../worker/index.js', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '').replace('export class HedoArchive', 'globalThis.HedoArchive=class HedoArchive').replace('export default', 'globalThis.worker=');
function harness() {
  const db = new DatabaseSync(':memory:'); db.exec('PRAGMA foreign_keys=ON');
  const sql = { exec(query, ...args) { let rows = []; if (!args.length && query.includes(';')) db.exec(query); else { const statement = db.prepare(query); if (statement.columns().length) rows = statement.all(...args); else statement.run(...args); } return { toArray: () => rows, one: () => { assert.equal(rows.length, 1); return rows[0]; } }; } };
  const storage = { sql, transactionSync(fn) { db.exec('BEGIN IMMEDIATE'); try { const value = fn(); db.exec('COMMIT'); return value; } catch (error) { db.exec('ROLLBACK'); throw error; } }, async getAlarm() { return null; }, async setAlarm() {} };
  const ctx = { storage, blockConcurrencyWhile: fn => fn() };
  const scope = vm.createContext({ DurableObject: class { constructor(context) { this.ctx = context; } }, replayRun, VERSION, MAX_TURNS, ROLE_MAP, ENDINGS, ...http, validateFeedback, validatePublisherToken, FeedbackStore, AchievementStore, CharacterStore, ObservationStore, LeaderboardStore, validateLeaderboardFilter, validateLeaderboardNickname, deriveLeaderboardScoreV56, leaderboardEligibilityV56, SCORE_VERSION_V56, crypto, Response, Request, URL, Date });
  vm.runInContext(source, scope); const archive = new scope.HedoArchive(ctx, {});
  const call = async (path, { method = 'GET', token, body, headers = {}, resetRate = true } = {}) => {
    if (resetRate) archive.rate = new http.RateGuard();
    const response = await archive.fetch(new Request(`https://game.example${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) }));
    return { status: response.status, body: await response.json(), headers: response.headers };
  };
  const register = async (token = 'a'.repeat(64)) => { const response = await call('/api/player', { method: 'POST', body: { token } }); assert.equal(response.status, 200); return { id: response.body.playerId, token }; };
  return { db, sql, storage, archive, call, register };
}
const completed = (seed = '00000001', roleId = 'system') => advance(applyChoice(enableActivitySchedule(createRun(roleId, `e39-cal46-kin49-g-e-s-m-${seed}`)), 2));
const proof = (run, runId = randomUUID(), nickname = '匿名打工人') => ({ runId, roleId: run.roleId, seed: run.seed, actions: run.actions, nickname });
const submit = (h, p, body) => h.call('/api/leaderboard', { method: 'POST', token: p.token, body });

test('ranking is explicitly opt-in and derives numeric scores from exact canonical completion', async () => {
  const h = harness(), p = await h.register(), run = completed(), payload = proof(run), expected = deriveLeaderboardScoreV56(run);
  assert.equal(run.completed, true);
  assert.equal((await h.call('/api/complete', { method: 'POST', token: p.token, body: payload })).status, 200);
  assert.equal((await h.call('/api/leaderboard')).body.entries.length, 0, 'ordinary completion never publishes');
  const response = await submit(h, p, payload); assert.equal(response.status, 200); assert.equal(response.body.entry.total, expected.total); assert.deepEqual(response.body.entry.metrics, expected.metrics);
  assert.equal(response.body.entry.runId, payload.runId); assert.notEqual(response.body.entry.entryId, payload.runId);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM runs').one().n, 1);
  const duplicate = await submit(h, p, { ...payload, nickname: '重新留名' }); assert.equal(duplicate.status, 200); assert.equal(duplicate.body.entry.entryId, response.body.entry.entryId); assert.equal(duplicate.body.entry.createdAt, response.body.entry.createdAt); assert.equal(duplicate.body.entry.nickname, '重新留名');
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM leaderboard_entries').one().n, 1);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM runs').one().n, 1);
  assert.equal((await submit(h, p, { ...payload, total: 10000, metrics: { skill: 999999 } })).status, 400);
  h.db.close();
});

test('first publication can atomically record completion, while a store failure never leaves a completed receipt', async () => {
  const h = harness(), p = await h.register(), payload = proof(completed());
  h.archive.leaderboardStore().publish = () => { throw new Error('storage failure'); };
  assert.equal((await submit(h, p, payload)).status, 503);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM runs').one().n, 0);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM leaderboard_entries').one().n, 0);
  h.archive.leaderboards = null;
  const response = await submit(h, p, payload); assert.equal(response.status, 200); assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM runs').one().n, 1); assert.equal((await h.call('/api/me', { token: p.token })).body.totalRuns, 1);
  h.db.close();
});

test('another anonymous identity cannot publish, rename, withdraw or inspect the owner run', async () => {
  const h = harness(), p = await h.register(), other = await h.register('b'.repeat(64)), payload = proof(completed());
  assert.equal((await submit(h, p, payload)).status, 200);
  assert.equal((await submit(h, other, { ...payload, nickname: '冒名者' })).status, 409);
  assert.equal((await h.call(`/api/leaderboard/${payload.runId}`, { method: 'DELETE', token: other.token })).status, 404);
  const mine = await h.call('/api/leaderboard/mine', { token: other.token }); assert.equal(mine.status, 200); assert.equal(mine.body.entries.length, 0);
  assert.equal((await h.call('/api/leaderboard/mine')).status, 401);
  assert.equal((await h.call('/api/leaderboard', { method: 'POST', body: payload })).status, 401);
  assert.equal((await h.call(`/api/leaderboard/${payload.runId}`, { method: 'DELETE' })).status, 401);
  h.db.close();
});

test('complete receipts with missing or different action commitments cannot be backfilled into ranking', async () => {
  const h = harness(), p = await h.register(), run = completed(), payload = proof(run);
  h.sql.exec('INSERT INTO runs (id,player_id,ending_id,role_id,actual_role_id,rank,salary,turns,game_version,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)', payload.runId, p.id, run.endingId, run.roleId, run.actualRoleId, run.rank, run.pay, run.turn, VERSION, new Date().toISOString());
  assert.equal((await submit(h, p, payload)).status, 409);
  const next = proof(completed('00000002')); assert.equal((await submit(h, p, next)).status, 200);
  h.sql.exec('UPDATE character_runs SET action_hash = ? WHERE id = ?', 'different-branch-hash', next.runId);
  assert.equal((await submit(h, p, next)).status, 409);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM leaderboard_entries').one().n, 1);
  h.db.close();
});

test('a natural longer fork ending the same way cannot replace the exact committed branch', async () => {
  const h = harness(), p = await h.register(), original = completed(), payload = proof(original);
  assert.equal((await submit(h, p, payload)).status, 200);
  const entered = advance(applyChoice(enableActivitySchedule(createRun('system', original.seed)), 0));
  const fork = advance(applyChoice(requestExit(entered), 0));
  assert.equal(fork.completed, true); assert.equal(fork.endingId, original.endingId); assert.ok(fork.actions.length > original.actions.length);
  const response = await submit(h, p, { ...proof(fork, payload.runId), nickname: '同結局不同路' });
  assert.equal(response.status, 409); assert.equal(response.body.error, 'leaderboard_commitment_conflict');
  assert.equal((await h.call('/api/leaderboard/mine', { token: p.token })).body.entries[0].nickname, payload.nickname);
  h.db.close();
});

test('unfinished, forged, extended, different-seed and legacy proofs are rejected', async () => {
  const h = harness(), p = await h.register(), payload = proof(completed());
  const unfinished = advance(applyChoice(enableActivitySchedule(createRun('system', payload.seed)), 0));
  assert.equal((await submit(h, p, proof(unfinished))).status, 400);
  assert.equal((await submit(h, p, { ...payload, actions: [{ type: 'choice', eventId: 'made-up', index: 0 }] })).status, 400);
  assert.equal((await submit(h, p, { ...payload, actions: [...payload.actions, { type: 'exit' }] })).status, 400);
  assert.equal((await submit(h, p, proof(advance(applyChoice(enableActivitySchedule(createRun('system', 'e39-cal46-kin49-g-e-s-old')), 2))))).status, 400);
  assert.equal((await submit(h, p, payload)).status, 200);
  assert.equal((await submit(h, p, { ...payload, seed: 'e39-cal46-kin49-g-e-s-m-00000003' })).status, 409);
  h.db.close();
});

test('nickname rules normalize width and reject controls, bidi, URLs, email and executable markup', async () => {
  assert.equal(validateLeaderboardNickname('  ＡＢ玩家  '), 'AB玩家'); assert.equal(validateLeaderboardNickname('🐧🐧'), '🐧🐧');
  for (const nickname of ['', 'A', 'a'.repeat(17), 'ab\n', 'ab\u202E', 'ab\u200B', 'test@example.com', 'https://x.tw', 'ｗｗｗ．x.com', 'x.dev', '<svg/onload=1>', '<script>']) assert.throws(() => validateLeaderboardNickname(nickname), error => error.status === 400, nickname);
  const h = harness(), p = await h.register(), payload = proof(completed());
  for (const nickname of ['<img src=x>', 'a@b.tw', 'AB\u202E']) assert.equal((await submit(h, p, { ...payload, nickname })).status, 400);
  const response = await submit(h, p, { ...payload, nickname: 'ＡＢ玩家' }); assert.equal(response.status, 200); assert.equal(response.body.entry.nickname, 'AB玩家');
  h.db.close();
});

test('public ranking exposes only allowlisted presentation fields and never endings, proofs or identity', async () => {
  const h = harness(), p = await h.register(), run = completed(), payload = proof(run);
  const publish = await submit(h, p, payload); assert.equal(publish.status, 200);
  const response = await h.call('/api/leaderboard?metric=skill&role=all'); assert.equal(response.status, 200); assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.deepEqual(Object.keys(response.body).sort(), ['entries', 'metric', 'role', 'scoreVersion', 'totalEntries', 'totalPlayers', 'updatedAt', 'version']);
  assert.deepEqual(Object.keys(response.body.entries[0]).sort(), ['actualRoleId', 'createdAt', 'entryId', 'nickname', 'rank', 'roleId', 'total', 'turns', 'value']);
  assert.equal(response.body.entries[0].value, run.stats.skill);
  const text = JSON.stringify(response.body); for (const secret of [p.id, p.token, payload.runId, run.seed, run.endingId, 'actions', 'difficulty', 'player_id', 'endingId', 'seed_hash']) assert.ok(!text.includes(secret), secret);
  const own = await h.call('/api/leaderboard/mine', { token: p.token }); assert.equal(own.body.entries[0].runId, payload.runId);
  const stored = JSON.stringify(h.sql.exec('SELECT * FROM leaderboard_entries').toArray()); assert.ok(!stored.includes(run.seed)); assert.ok(!stored.includes('onboarding'));
  h.db.close();
});

test('each metric ranks every named run, including several from the same player, with actual job filters and deterministic ties', async () => {
  const h = harness(), p = await h.register(), other = await h.register('b'.repeat(64)), payloads = [];
  for (const seed of ['00000001', '00000002', '00000003', '00000004']) { const run = completed(seed, 'ai'), payload = proof(run); payloads.push({ run, payload, score: deriveLeaderboardScoreV56(run) }); assert.equal((await submit(h, p, payload)).status, 200); }
  const same = await submit(h, other, proof(payloads[0].run)); assert.equal(same.status, 200);
  for (const metric of ['overall', 'skill', 'slack', 'lick', 'cash', 'verbal']) {
    const data = (await h.call(`/api/leaderboard?metric=${metric}&role=all`)).body; assert.equal(data.entries.length, 5); assert.equal(data.totalEntries, 5); assert.equal(data.totalPlayers, 2);
    const expected = payloads.map(row => row.score.metrics[metric]).sort((a,b)=>b-a); const ids = new Set((await h.call('/api/leaderboard/mine', { token: p.token })).body.entries.map(row => row.entryId));
    assert.deepEqual(data.entries.filter(row => ids.has(row.entryId)).map(row=>row.value), expected);
    assert.deepEqual(data, { ...data, entries: (await h.call(`/api/leaderboard?metric=${metric}&role=all`)).body.entries });
  }
  const reassigned = payloads.find(row => row.run.actualRoleId !== row.run.roleId); assert.ok(reassigned, 'natural AI onboarding produces a real reassignment witness');
  const filtered = (await h.call(`/api/leaderboard?role=${reassigned.run.actualRoleId}`)).body; assert.ok(filtered.entries.length > 0); assert.ok(filtered.entries.every(row => row.actualRoleId === reassigned.run.actualRoleId));
  const invalid = await h.call('/api/leaderboard?metric=total%20DESC'); assert.equal(invalid.status, 400); assert.equal((await h.call('/api/leaderboard?role=madeup')).status, 400); assert.equal((await h.call('/api/leaderboard?metric=skill&metric=cash')).status, 400);
  h.db.close();
});

test('a lower-score life stays listed beside the same owner\'s better life, with per-run rename, withdrawal and retry isolation',async t=>{
 const h=harness();t.after(()=>h.db.close());const owner=await h.register(),other=await h.register('b'.repeat(64));
 let better=advance(applyChoice(enableActivitySchedule(createRun('system','e39-cal46-kin49-g-e-s-m-00000001')),0));
 better=advance(applyChoice(better,0));better=requestExit(better);for(let i=0;i<10&&!better.completed;i++)better=advance(applyChoice(better,0));
 const lower=completed('00000002'),bestProof=proof(better,randomUUID(),'同一位玩家'),lowProof=proof(lower,randomUUID(),'同一位玩家');assert.ok(deriveLeaderboardScoreV56(better).total>deriveLeaderboardScoreV56(lower).total);
 const best=await submit(h,owner,bestProof),low=await submit(h,owner,lowProof);assert.equal(best.status,200);assert.equal(low.status,200);assert.notEqual(best.body.entry.entryId,low.body.entry.entryId);assert.equal(low.body.entry.total,0,'zero points remain a valid named completed life');
 const stableBest={...h.sql.exec('SELECT * FROM leaderboard_entries WHERE run_id=?',bestProof.runId).one()};
 for(const metric of LEADERBOARD_METRICS_V56.map(metric=>metric.id)){
  const board=(await h.call(`/api/leaderboard?metric=${metric}`)).body;assert.equal(board.totalEntries,2);assert.equal(board.totalPlayers,1);assert.deepEqual(new Set(board.entries.map(entry=>entry.entryId)),new Set([best.body.entry.entryId,low.body.entry.entryId]));
 }
 const roles=new Set([best.body.entry.actualRoleId,low.body.entry.actualRoleId]);for(const role of roles){const board=(await h.call(`/api/leaderboard?role=${role}`)).body;assert.equal(board.totalEntries,[best,low].filter(response=>response.body.entry.actualRoleId===role).length);assert.ok(board.entries.every(entry=>entry.actualRoleId===role));}
 const retries=await Promise.all([submit(h,owner,lowProof),submit(h,owner,lowProof)]);assert.ok(retries.every(response=>response.status===200&&response.body.entry.entryId===low.body.entry.entryId));assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM leaderboard_entries').one().n,2);
 const changed=await h.call(`/api/leaderboard/${lowProof.runId}`,{method:'PATCH',token:owner.token,body:{nickname:'低分也有自己的名字'}});assert.equal(changed.status,200);assert.equal(changed.body.entry.total,low.body.entry.total);assert.deepEqual({...h.sql.exec('SELECT * FROM leaderboard_entries WHERE run_id=?',bestProof.runId).one()},stableBest);
 assert.equal((await h.call(`/api/leaderboard/${bestProof.runId}`,{method:'PATCH',token:other.token,body:{nickname:'冒名更動'}})).status,404);assert.equal((await h.call(`/api/leaderboard/${bestProof.runId}`,{method:'DELETE',token:other.token})).status,404);
 assert.equal((await submit(h,owner,{...lowProof,total:10000})).status,400);assert.equal((await submit(h,other,lowProof)).status,409);
 for(let i=0;i<2;i++)assert.equal((await h.call(`/api/leaderboard/${lowProof.runId}`,{method:'DELETE',token:owner.token})).status,200);
 const after=(await h.call('/api/leaderboard')).body;assert.equal(after.totalEntries,1);assert.equal(after.totalPlayers,1);assert.equal(after.entries[0].entryId,best.body.entry.entryId);assert.deepEqual({...h.sql.exec('SELECT * FROM leaderboard_entries WHERE run_id=?',bestProof.runId).one()},stableBest);assert.equal((await h.call('/api/me',{token:owner.token})).body.totalRuns,2,'withdrawing one public name preserves both completed lives');
});

test('public output is bounded to 50 runs even when more opted in', async () => {
  const h = harness(), run = completed(), score = deriveLeaderboardScoreV56(run), store = h.archive.leaderboardStore(), date = '2026-10-23T00:00:00.000Z';
  for (let i = 0; i < 55; i++) {
    const playerId = `owner-${i}`, runId = randomUUID();
    h.sql.exec('INSERT INTO players (id,token_hash,created_at) VALUES (?,?,?)', playerId, `hash-${i}`, date);
    h.sql.exec('INSERT INTO runs (id,player_id,ending_id,role_id,actual_role_id,rank,salary,turns,game_version,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)', runId, playerId, run.endingId, run.roleId, run.actualRoleId, run.rank, run.pay, run.turn, VERSION, date);
    store.publish(playerId, runId, run, score, `玩家${i}`, date);
  }
  const a = (await h.call('/api/leaderboard')).body, b = (await h.call('/api/leaderboard')).body;
  assert.equal(a.entries.length, 50); assert.equal(a.totalEntries, 55); assert.equal(a.totalPlayers, 55); assert.deepEqual(a.entries, b.entries); assert.deepEqual(a.entries.map(row => row.rank), Array(50).fill(1));
  assert.deepEqual(a.entries.map(row => row.entryId), a.entries.map(row => row.entryId).sort());
  h.db.close();
});

test('equal selected ability earns competition ranks even when reporting exits have zero overall scores', async () => {
  const h = harness(), players = [await h.register(), await h.register('b'.repeat(64)), await h.register('c'.repeat(64))];
  for (const [index, seed] of ['00000000', '00000003', '00000001'].entries()) assert.equal((await submit(h, players[index], proof(completed(seed), randomUUID(), `玩家${index}`))).status, 200);
  const rows = (await h.call('/api/leaderboard?metric=skill')).body.entries;
  assert.deepEqual(rows.map(row => row.value), [49, 49, 45]); assert.deepEqual(rows.map(row => row.rank), [1, 1, 3]); assert.deepEqual(rows.map(row => row.total), [0, 0, 0], 'initial ability is visible on its own board, but reporting is not work experience');
  h.db.close();
});

test('withdrawal is idempotent, preserves private collection, and republishing needs a new explicit request', async () => {
  const h = harness(), p = await h.register(), payload = proof(completed());
  const before = await submit(h, p, payload); assert.equal(before.status, 200);
  for (let i = 0; i < 2; i++) assert.equal((await h.call(`/api/leaderboard/${payload.runId}`, { method: 'DELETE', token: p.token })).status, 200);
  assert.equal((await h.call('/api/leaderboard')).body.entries.length, 0); assert.equal((await h.call('/api/me', { token: p.token })).body.totalRuns, 1);
  assert.equal((await h.call('/api/complete', { method: 'POST', token: p.token, body: payload })).status, 200); assert.equal((await h.call('/api/leaderboard')).body.entries.length, 0);
  const after = await submit(h, p, { ...payload, nickname: '我又回來了' }); assert.equal(after.status, 200); assert.notEqual(after.body.entry.entryId, before.body.entry.entryId); assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM runs').one().n, 1);
  h.db.close();
});

test('metadata-only rename is authenticated, cannot rewrite scores, and never republishes a withdrawn run', async () => {
  const h = harness(), p = await h.register(), other = await h.register('b'.repeat(64)), payload = proof(completed());
  const before = await submit(h, p, payload), path = `/api/leaderboard/${payload.runId}`;
  const patch = await h.call(path, { method: 'PATCH', token: p.token, body: { nickname: '新暱稱' } });
  assert.equal(patch.status, 200); assert.deepEqual(patch.body.entry, { ...before.body.entry, nickname: '新暱稱' });
  assert.equal((await h.call(path, { method: 'PATCH', token: other.token, body: { nickname: '冒名者' } })).status, 404);
  assert.equal((await h.call(path, { method: 'PATCH', token: p.token, body: { nickname: '新暱稱', total: 999999 } })).status, 400);
  assert.equal((await h.call(path, { method: 'PATCH', token: p.token, body: { nickname: '新暱稱' }, headers: { Origin: 'https://other.example' } })).status, 403);
  await h.call(path, { method: 'DELETE', token: p.token });
  assert.equal((await h.call(path, { method: 'PATCH', token: p.token, body: { nickname: '不能自動復活' } })).status, 404);
  assert.equal((await h.call('/api/leaderboard')).body.entries.length, 0);
  h.db.close();
});

test('own listing pages beyond 100 without losing access to an old public best result', async () => {
  const h = harness(), p = await h.register(), other = await h.register('b'.repeat(64)), run = completed(), score = deriveLeaderboardScoreV56(run), store = h.archive.leaderboardStore();
  const runIds = [];
  for (let i = 0; i < 103; i++) {
    const runId = randomUUID(), date = new Date(Date.UTC(2026, 0, 1, i)).toISOString(); runIds.push(runId);
    h.sql.exec('INSERT INTO runs (id,player_id,ending_id,role_id,actual_role_id,rank,salary,turns,game_version,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)', runId, p.id, run.endingId, run.roleId, run.actualRoleId, run.rank, run.pay, run.turn, VERSION, date);
    store.publish(p.id, runId, run, score, `留名${i}`, date);
  }
  const first = (await h.call('/api/leaderboard/mine', { token: p.token })).body;
  assert.equal(first.entries.length, 100); assert.equal(first.hasMore, true); assert.equal(first.nextCursor, first.entries.at(-1).entryId);
  const second = (await h.call(`/api/leaderboard/mine?after=${first.nextCursor}`, { token: p.token })).body;
  assert.equal(second.entries.length, 3); assert.equal(second.hasMore, false); assert.equal(second.nextCursor, null);
  assert.equal(new Set([...first.entries, ...second.entries].map(row => row.runId)).size, 103);
  const publicBefore = (await h.call('/api/leaderboard')).body; assert.equal(publicBefore.entries[0].entryId, second.entries.at(-1).entryId);
  assert.equal((await h.call(`/api/leaderboard/mine?after=${first.nextCursor}`, { token: other.token })).status, 400);
  assert.equal((await h.call(`/api/leaderboard/${runIds[0]}`, { method: 'DELETE', token: p.token })).status, 200);
  assert.notEqual((await h.call('/api/leaderboard')).body.entries[0].entryId, publicBefore.entries[0].entryId);
  assert.equal((await h.call('/api/leaderboard/mine?after=madeup', { token: p.token })).status, 400);
  h.db.close();
});

test('same-origin mutations, public rate guards and existing streamed body limits apply', async () => {
  const h = harness(), p = await h.register(), payload = proof(completed());
  assert.equal((await h.call('/api/leaderboard', { method: 'POST', token: p.token, body: payload, headers: { Origin: 'https://other.example' } })).status, 403);
  assert.equal((await h.call(`/api/leaderboard/${payload.runId}`, { method: 'DELETE', token: p.token, headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
  assert.equal((await h.call('/api/leaderboard', { method: 'POST', token: p.token, body: { ...payload, nickname: 'x'.repeat(70000) } })).status, 413);
  h.archive.rate = new http.RateGuard(); for (let i = 0; i < 10; i++) assert.equal((await h.call('/api/leaderboard', { resetRate: false })).status, 200); assert.equal((await h.call('/api/leaderboard', { resetRate: false })).status, 429);
  h.db.close();
});
