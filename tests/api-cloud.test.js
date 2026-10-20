import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { randomUUID, webcrypto } from 'node:crypto';
import { createRun, applyChoice, advance, validRun } from '../dist/engine.js';
import { deriveCharacterStats } from '../dist/character-stats.js';

const source = (await readFile(new URL('../dist/cloud.js', import.meta.url), 'utf8')).replace('export const cloud=', 'globalThis.cloud=');
const item = (id = randomUUID()) => ({ runId: id, roleId: 'ai', seed: 'test', actions: [{ type: 'choice', eventId: 'onboarding', index: 2 }] });
function client(queue, responder, { storageFails = false, savedEntries = [] } = {}) {
  const saved = new Map([['hedo-anonymous-v1', '1'.repeat(64)], ['hedo-sync-queue-v3', JSON.stringify(queue)],...savedEntries]);
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

const characterRows=()=>deriveCharacterStats(advance(applyChoice(createRun('system','e20-cloud-characters'),0)));
const withCharacters=rows=>Response.json({playerId:'test-player',unlocked:[],achievements:[],totalRuns:0,characters:rows,characterTrackingSince:'2026-10-20T00:00:00.000Z'});

test('character and achievement proofs coalesce and an acknowledged prefix is not sent again on Continue',async()=>{
 const rows=characterRows(),c=client([],path=>path==='/api/player'?withCharacters(rows):withCharacters(rows));
 await c.cloud.init();const run=item();
 await Promise.all([c.cloud.characterProgress(run),c.cloud.achievementProgress(run)]);
 await c.cloud.characterProgress(structuredClone(run));
 assert.equal(c.requests.filter(row=>row.path==='/api/achievements').length,1);
 assert.equal(c.cloud.state.pending,0);
 assert.deepEqual(JSON.parse(JSON.stringify(c.cloud.state.characters)),rows);
 const changed=c.cloud.state.characters;changed[0].realHits=999;
 assert.notEqual(c.cloud.state.characters[0].realHits,999);
});

test('verified character totals survive an offline reload and are bound to the anonymous credential hash',async()=>{
 const rows=characterRows(),c=client([],()=>withCharacters(rows));await c.cloud.init();
 const cache=c.saved.get('hedo-character-cache-v1');assert.ok(cache);
 assert.ok(!cache.includes('1'.repeat(64)),'the new cache does not duplicate the bearer token');
 const offline=client([],()=>{throw new TypeError('offline');},{savedEntries:[...c.saved]});await offline.cloud.init();
 assert.deepEqual(JSON.parse(JSON.stringify(offline.cloud.state.characters)),rows);
 assert.ok(Number.isFinite(Date.parse(offline.cloud.state.charactersVerifiedAt)));
 assert.equal(offline.cloud.state.characterTrackingSince,'2026-10-20T00:00:00.000Z');
 assert.equal(offline.cloud.state.status,'local');
 const another=client([],()=>{throw new TypeError('offline');},{savedEntries:[...c.saved,['hedo-anonymous-v1','2'.repeat(64)]]});await another.cloud.init();
 assert.deepEqual(JSON.parse(JSON.stringify(another.cloud.state.characters)),[],'another identity cannot read this cache as its totals');
});

test('public character statistics cannot overwrite private cumulative counts',async()=>{
 const personal=characterRows(),global=personal.map(row=>({...row,realHits:400}));
 const c=client([],path=>path==='/api/characters'?Response.json({version:1,characters:global,trackingSince:'2026-10-20T00:00:00.000Z'}):withCharacters(personal));
 await c.cloud.init();const data=await c.cloud.characters();assert.equal(data.characters[0].realHits,400);
 assert.deepEqual(JSON.parse(JSON.stringify(c.cloud.state.characters)),personal);
});

test('offline character proofs stay in the shared durable queue and later synchronize without a new achievement',async()=>{
 let online=false;const rows=characterRows();
 const c=client([],()=>{if(!online)throw new TypeError('offline');return withCharacters(rows);});
 const run=item();await c.cloud.characterProgress(run);await c.cloud.characterProgress({...run,actions:[...run.actions,{type:'rage'}]});
 assert.equal(c.cloud.state.pending,1);assert.equal(JSON.parse(c.saved.get('hedo-achievement-queue-v1'))[0].actions.length,2);
 online=true;await c.cloud.retry();assert.equal(c.cloud.state.pending,0);
 assert.equal(c.requests.filter(row=>row.path==='/api/achievements').length,1);
 assert.deepEqual(JSON.parse(JSON.stringify(c.cloud.state.characters)),rows);
});

test('malformed or future-version character cache is ignored without blocking normal anonymous sync',async()=>{
 const rows=characterRows(),c=client([],()=>withCharacters(rows));await c.cloud.init();
 const cached=JSON.parse(c.saved.get('hedo-character-cache-v1'));cached.version=99;
 const reload=client([],()=>{throw new TypeError('offline');},{savedEntries:[['hedo-character-cache-v1',JSON.stringify(cached)]]});await reload.cloud.init();
 assert.deepEqual(JSON.parse(JSON.stringify(reload.cloud.state.characters)),[]);
 cached.version=1;cached.characters[0].imaginedHits=-1;
 const broken=client([],()=>{throw new TypeError('offline');},{savedEntries:[['hedo-character-cache-v1',JSON.stringify(cached)]]});await broken.cloud.init();
 assert.deepEqual(JSON.parse(JSON.stringify(broken.cloud.state.characters)),[]);
});

test('a delayed registration read cannot roll back a newer verified character proof or its offline cache',async()=>{
 const latest=characterRows(),old=latest.map(row=>({id:row.id,...Object.fromEntries(Object.keys(row).filter(key=>key!=='id').map(key=>[key,0]))}));
 let registrations=0,releaseRead,releaseUpload,uploadStarted,readStarted;
 const uploading=new Promise(resolve=>{uploadStarted=resolve;}),reading=new Promise(resolve=>{readStarted=resolve;});
 const c=client([],async path=>{
  if(path==='/api/player'){
   if(++registrations===1)return withCharacters(old);
   readStarted();return new Promise(resolve=>{releaseRead=()=>resolve(withCharacters(old));});
  }
  uploadStarted();return new Promise(resolve=>{releaseUpload=()=>resolve(withCharacters(latest));});
 });
 await c.cloud.init();
 const upload=c.cloud.characterProgress(item());await uploading;
 const refresh=c.cloud.init();await reading;
 releaseUpload();await upload;
 assert.deepEqual(JSON.parse(JSON.stringify(c.cloud.state.characters)),latest);
 const verifiedAt=c.cloud.state.charactersVerifiedAt;
 releaseRead();const result=await refresh;
 assert.deepEqual(JSON.parse(JSON.stringify(c.cloud.state.characters)),latest);
 assert.deepEqual(JSON.parse(JSON.stringify(result.characters)),latest);
 assert.equal(c.cloud.state.charactersVerifiedAt,verifiedAt);
 assert.deepEqual(JSON.parse(c.saved.get('hedo-character-cache-v1')).characters,latest);
 assert.equal(c.cloud.state.pending,0);
});
