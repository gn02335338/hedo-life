import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { randomUUID, webcrypto } from 'node:crypto';
const source = readFileSync(new URL('../dist/cloud.js', import.meta.url), 'utf8').replace('export const cloud=', 'globalThis.cloud=');
function client(responder, { storageFails = false } = {}) {
  const saved = new Map([['hedo-anonymous-v1', '1'.repeat(64)]]), requests = [], timers = new Map(); let timer = 0;
  const context = vm.createContext({ Response, AbortSignal, structuredClone, crypto: webcrypto, localStorage: { getItem: key => saved.get(key) ?? null, setItem(key, value) { if (storageFails) throw new Error('quota'); saved.set(key, value); } }, window: { addEventListener() {} }, setTimeout(fn, delay) { timers.set(++timer, { fn, delay }); return timer; }, clearTimeout: id => timers.delete(id), async fetch(path, options) { const request = { path, method: options.method, headers: options.headers, body: options.body ? JSON.parse(options.body) : null }; requests.push(request); return responder(request); } });
  vm.runInContext(source, context); return { cloud: context.cloud, saved, requests, timers };
}
const registered = () => Response.json({ playerId: 'anonymous-player', unlocked: [], totalRuns: 0, achievements: [] });
const run = () => ({ runId: randomUUID(), completed: true, roleId: 'system', seed: 'e39-cal46-kin49-g-e-s-m-00000001', actions: [{ type: 'activity-schedule', version: 1 }, { type: 'choice', eventId: 'onboarding', index: 2 }], stats: { skill: 999999 }, endingId: 'client-is-not-authority' });

test('public ranking reads do not register a player and encode filter values safely', async () => {
  const c = client(() => Response.json({ version: 1, entries: [] }));
  await c.cloud.leaderboard({ metric: 'skill', role: 'sales' });
  await c.cloud.leaderboard({ metric: 'a&b', role: 'x?y' });
  assert.deepEqual(c.requests.map(row => row.path), ['/api/leaderboard?metric=skill&role=sales', '/api/leaderboard?metric=a%26b&role=x%3Fy']); assert.ok(c.requests.every(row => row.method === 'GET'));
});

test('explicit publication transmits only proof and supplied name, and metadata updates use authenticated PATCH/DELETE', async () => {
  const c = client(request => request.path === '/api/player' ? registered() : Response.json({ version: 1, published: true, entry: { nickname: request.body?.nickname } })), current = run();
  await c.cloud.submitLeaderboard(current, '匿名玩家');
  const post = c.requests.find(row => row.path === '/api/leaderboard'); assert.equal(post.method, 'POST'); assert.deepEqual(Object.keys(post.body).sort(), ['actions', 'nickname', 'roleId', 'runId', 'seed']); assert.deepEqual(post.body.actions, current.actions); assert.equal(post.headers.Authorization, `Bearer ${'1'.repeat(64)}`);
  current.actions.push({ type: 'exit' }); assert.equal(post.body.actions.length, 2, 'caller mutations do not alter a submitted proof');
  await c.cloud.renameLeaderboard(current.runId, '另一個名字'); await c.cloud.removeLeaderboard(current.runId); await c.cloud.myLeaderboard();
  const patch = c.requests.find(row => row.method === 'PATCH'); assert.equal(patch.path, `/api/leaderboard/${current.runId}`); assert.deepEqual(patch.body, { nickname: '另一個名字' });
  const remove = c.requests.find(row => row.method === 'DELETE'); assert.equal(remove.body, null); assert.equal(remove.path, patch.path); assert.equal(c.requests.at(-1).path, '/api/leaderboard/mine');
  assert.equal(JSON.stringify([...c.saved]).includes('匿名玩家'), false); assert.equal(JSON.stringify([...c.saved]).includes('另一個名字'), false);
});

test('offline publication never enters automatic sync and reconnecting cannot publish a name', async () => {
  let online = false;
  const c = client(request => { if (!online) throw new TypeError('offline'); if (request.path === '/api/player') return registered(); throw new Error('unexpected publication'); });
  await assert.rejects(c.cloud.submitLeaderboard(run(), '保留草稿'), /尚未公開/);
  assert.equal(c.cloud.state.pending, 0); assert.ok(!JSON.stringify([...c.saved]).includes('保留草稿')); assert.equal(c.requests.filter(row => row.path === '/api/leaderboard').length, 0);
  online = true; await c.cloud.retry(); assert.equal(c.cloud.state.status, 'online'); assert.equal(c.requests.filter(row => row.path === '/api/leaderboard').length, 0);
});

test('a rejected publication, withdrawal or rename shows an error and is never silently retried', async () => {
  const c = client(request => request.path === '/api/player' ? registered() : Response.json({ error: 'unavailable', message: '稍後再試' }, { status: 503 }));
  await assert.rejects(c.cloud.submitLeaderboard(run(), '這次留名'), error => error.status === 503 && error.message === '稍後再試');
  await assert.rejects(c.cloud.renameLeaderboard(randomUUID(), '改名失敗'), error => error.status === 503);
  await assert.rejects(c.cloud.removeLeaderboard(randomUUID()), error => error.status === 503);
  assert.equal(c.cloud.state.pending, 0); const before = c.requests.filter(row => row.path !== '/api/player').length; await c.cloud.retry(); assert.equal(c.requests.filter(row => row.path !== '/api/player').length, before);
  assert.ok(!JSON.stringify([...c.saved]).includes('這次留名'));
});

test('unfinished runs and unavailable anonymous storage cannot publish', async () => {
  const c = client(() => registered()); await assert.rejects(c.cloud.submitLeaderboard({ ...run(), completed: false }, '未完待續'), /尚未走到結局/); assert.equal(c.requests.length, 0);
  const offline = client(() => { throw new TypeError('offline'); }, { storageFails: true });
  await assert.rejects(offline.cloud.removeLeaderboard(randomUUID()), /尚未撤下/); await assert.rejects(offline.cloud.renameLeaderboard(randomUUID(), '改名失敗'), /尚未修改/); assert.equal(offline.cloud.state.pending, 0);
});
