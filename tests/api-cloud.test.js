import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { randomUUID, webcrypto } from 'node:crypto';
import { createRun, applyChoice, advance, validRun } from '../dist/engine.js';

const source = (await readFile(new URL('../dist/cloud.js', import.meta.url), 'utf8')).replace('export const cloud=', 'globalThis.cloud=');
const item = (id = randomUUID()) => ({ runId: id, roleId: 'ai', seed: 'test', actions: [{ type: 'choice', eventId: 'onboarding', index: 2 }] });
function client(queue, responder, { storageFails = false } = {}) {
  const saved = new Map([['hedo-anonymous-v1', '1'.repeat(64)], ['hedo-sync-queue-v3', JSON.stringify(queue)]]);
  const timers = new Map();
  const requests = [];
  let timerId = 0;
  const context = vm.createContext({
    Response, AbortSignal, structuredClone, crypto: webcrypto,
    localStorage: { getItem: key => saved.get(key) ?? null, setItem: (key, value) => { if (storageFails) throw new Error('quota'); saved.set(key, value); } },
    window: { addEventListener() {} },
    setTimeout: (fn, delay) => { timers.set(++timerId, { fn, delay }); return timerId; },
    clearTimeout: id => timers.delete(id),
    fetch: async (path, options) => { const body = options.body ? JSON.parse(options.body) : null; requests.push({ path, body }); return responder(path, body); },
  });
  vm.runInContext(source, context);
  return { cloud: context.cloud, timers, requests, saved };
}
const registered = () => Response.json({ playerId: 'test-player', unlocked: [], totalRuns: 0 });
const completed = () => Response.json({ playerId: 'test-player', unlocked: ['ragequit-ai'], totalRuns: 1 });

test('a permanently rejected replay does not block later valid queued runs', async () => {
  const first = item(), second = item();
  const c = client([first, second], (path, body) => path === '/api/player' ? registered() : body.runId === first.runId ? Response.json({ error: 'invalid_replay' }, { status: 400 }) : completed());
  await c.cloud.init();
  assert.deepEqual(c.requests.filter(r => r.path === '/api/complete').map(r => r.body.runId), [first.runId, second.runId]);
  assert.equal(c.cloud.state.pending, 0);
  assert.match(c.cloud.state.lastError, /本機收藏/);
  assert.equal(c.cloud.state.status, 'online');
});

test('429 retains queued runs and schedules a bounded automatic retry', async () => {
  let limited = true;
  const c = client([item()], path => path === '/api/player' ? registered() : limited ? Response.json({ error: 'rate_limited' }, { status: 429, headers: { 'Retry-After': '10' } }) : completed());
  await c.cloud.init();
  assert.equal(c.cloud.state.pending, 1);
  const timer = [...c.timers.values()][0];
  assert.equal(timer.delay, 10000);
  limited = false;
  timer.fn();
  await c.cloud.init();
  assert.equal(c.cloud.state.pending, 0);
  assert.equal(c.cloud.state.status, 'online');
});

test('offline reload preserves more than forty unsent games', async () => {
  const pending = Array.from({ length: 60 }, () => item());
  const c = client(pending, () => { throw new TypeError('offline'); });
  await c.cloud.init();
  assert.equal(c.cloud.state.pending, 60);
  assert.equal(JSON.parse(c.saved.get('hedo-sync-queue-v3')).length, 60);
  assert.equal(c.cloud.state.status, 'pending');
  assert.ok([...c.timers.values()][0].delay <= 60000);
});

test('the 500-run limit warns without removing any earlier unsent game', async () => {
  const pending = Array.from({ length: 500 }, () => item());
  const c = client(pending, () => registered());
  await c.cloud.complete({ ...item(), completed: true });
  assert.equal(c.cloud.state.pending, 500);
  assert.match(c.cloud.state.lastError, /500局/);
  assert.deepEqual(JSON.parse(c.saved.get('hedo-sync-queue-v3')), pending);
});

test('local storage failure exposes a visible-status message and retains the in-memory run', async () => {
  const c = client([], () => { throw new TypeError('offline'); }, { storageFails: true });
  await c.cloud.complete({ ...item(), completed: true });
  assert.equal(c.cloud.state.pending, 1);
  assert.match(c.cloud.state.lastError, /無法存入瀏覽器/);
});

test('the browser run UUID survives choices, advancement, JSON persistence, and validation', () => {
  let run = createRun('ai', 'uuid-persistence');
  run.runId = randomUUID();
  const id = run.runId;
  run = JSON.parse(JSON.stringify(advance(applyChoice(run, 2))));
  assert.equal(run.runId, id);
  assert.equal(run.completed, true);
  assert.equal(validRun(run), true);
});

test('offline milestone proofs keep only the latest prefix and retry when online', async () => {
  let online=false;
  const c=client([],path=>{
    if(!online)throw new TypeError('offline');
    return path==='/api/player'?registered():Response.json({playerId:'test-player',unlocked:[],totalRuns:0,achievements:[{id:'work-card',unlockedAt:'2026-10-20T00:00:00.000Z'}]});
  });
  const run=item();
  await c.cloud.achievementProgress(run);
  await c.cloud.achievementProgress({...run,actions:[...run.actions,{type:'rage'}]});
  const pending=JSON.parse(c.saved.get('hedo-achievement-queue-v1'));
  assert.equal(pending.length,1);assert.equal(pending[0].actions.length,2);assert.equal(c.cloud.state.pending,1);
  online=true;await c.cloud.retry();
  assert.equal(c.cloud.state.pending,0);
  assert.equal(c.cloud.state.achievements[0].id,'work-card');
  assert.equal(c.requests.filter(r=>r.path==='/api/achievements').length,1);
});

test('a newer milestone proof arriving during upload is not discarded by the older response', async () => {
  let release,started;
  const gate=new Promise(resolve=>{started=resolve;});
  const c=client([],async(path,body)=>{
    if(path==='/api/player')return registered();
    if(body.actions.length===1){started();await new Promise(resolve=>{release=resolve;});}
    return Response.json({playerId:'test-player',unlocked:[],totalRuns:0,achievements:[{id:'work-card',unlockedAt:'2026-10-20T00:00:00.000Z'}]});
  });
  await c.cloud.init();
  const first=item(),a=c.cloud.achievementProgress(first);await gate;
  const b=c.cloud.achievementProgress({...first,actions:[...first.actions,{type:'rage'}]});
  release();await Promise.all([a,b]);
  assert.deepEqual(c.requests.filter(r=>r.path==='/api/achievements').map(r=>r.body.actions.length),[1,2]);
  assert.equal(c.cloud.state.pending,0);
});
