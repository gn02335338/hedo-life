import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {simulate} from './find-routes-v3.mjs';
import {currentSeedV66,simulateCurrentV66,findCurrentEndingsV66,currentEndingFixtureV66,currentSourceSha256V66,CURRENT_ENDING_SEARCH_VERSION_V66} from '../scripts/find-current-endings-v66.mjs';
import * as E from '../dist/engine.js';
import {ENDINGS} from '../dist/endings.js';

const quiet=()=>{};
test('current ending search generates deterministic strict r66 seeds for distinct jobs, goals and attempts',()=>{
 const seeds=[];for(const role of ['system','bd'])for(const target of ['ragequit','broke'])for(let attempt=0;attempt<3;attempt++){
  const seed=currentSeedV66(role,target,attempt);assert.match(seed,/^e39-r66-n-[0-9a-f]{22}$/);assert.equal(seed.length,32);assert.equal(currentSeedV66(role,target,attempt),seed);seeds.push(seed);
 }
 assert.equal(new Set(seeds).size,seeds.length);
});
test('an actual current life starts with the calendar and its complete actions reproduce the canonical saved state',()=>{
 const {run,route}=simulateCurrentV66('system','ragequit',0);assert.equal(run.endingId,'ragequit-system');assert.equal(run.actions[0].type,'activity-schedule');assert.equal(route.actions,run.actions);assert.equal(E.validRun(run),true);assert.deepEqual(E.replayRun(route.roleId,route.seed,route.actions),run);
 const result=findCurrentEndingsV66({maxAttempts:1,roles:['system'],families:['ragequit'],onProgress:quiet});assert.equal(result.complete,true);assert.equal(result.expected,1);assert.equal(result.found,1);assert.deepEqual(result.missing,[]);assert.deepEqual(result.routes[0].actions,run.actions);
});
test('resuming revalidates saved natural proofs and never repeats the already attempted deterministic seeds',()=>{
 let checkpoints=0;const first=findCurrentEndingsV66({maxAttempts:1,roles:['system'],families:['career_chief'],onProgress:quiet,onCheckpoint:()=>checkpoints++});assert.ok(checkpoints>0);assert.equal(first.attempts[0].attempts,1);
 const resumed=findCurrentEndingsV66({maxAttempts:2,roles:['system'],families:['career_chief'],resume:first,onProgress:quiet});assert.equal(resumed.attempts[0].attempts,2);assert.ok(resumed.routes.length>=first.routes.length);assert.ok(first.routes.every(route=>resumed.routes.some(row=>row.ending===route.ending&&row.seed===route.seed)));
 const quit=findCurrentEndingsV66({maxAttempts:1,roles:['system'],families:['ragequit'],onProgress:quiet});const forged=structuredClone(quit);forged.routes[0].actions.at(-1).index=0;assert.throws(()=>findCurrentEndingsV66({maxAttempts:1,roles:['system'],families:['ragequit'],resume:forged,onProgress:quiet}),/Invalid resumed witness/);
 const old=structuredClone(quit);old.routes[0].seed=old.routes[0].seed.replace('r66','r65');assert.throws(()=>findCurrentEndingsV66({maxAttempts:1,roles:['system'],families:['ragequit'],resume:old,onProgress:quiet}),/Invalid current resume route/);
});
test('the search rejects invalid filters and a non-positive attempt budget',()=>{
 for(const input of [{maxAttempts:0},{maxAttempts:1.5},{roles:['made-up']},{roles:[]},{families:['made-up']}])assert.throws(()=>findCurrentEndingsV66({...input,onProgress:quiet}));
});
test('adding current-profile hooks leaves historical finder action/state output byte stable',()=>{
 const golden=[
  [['system','ragequit',0],'b336710f71bfe388d387260f850088124f08548dfb84c3459b0994d46a320e7c'],
  [['ai','fired_signed',3],'e1d3e6f4e86b9e3f23baec0e31a5dd408447f660ee84b068ad3dc851bd1b8df7'],
  [['bd','verbal_onboarding',1],'a765d557cd0f6ff477c2ca5b6ada7ec9ef23913f7c511d9e70a9972fc8cd04f8'],
  [['design','rage_coup',3],'5d2961a402c646f206a4adbeff54118b4b1213d5853bf31bf612fb0fe7d3a1d5']
 ];
 for(const [args,expected]of golden)assert.equal(createHash('sha256').update(JSON.stringify(simulate(...args))).digest('hex'),expected,args.join(':'));
});

test('an incomplete filtered search cannot be published as the current catalog proof',()=>{
 const result=findCurrentEndingsV66({maxAttempts:1,roles:['system'],families:['ragequit'],onProgress:quiet});assert.equal(result.complete,true);assert.throws(()=>currentEndingFixtureV66(result),/Current catalog proof is incomplete/);
});

test('an explicitly discarded stale resume cannot be published and is replaced by a new canonical life',()=>{
 const first=findCurrentEndingsV66({maxAttempts:1,roles:['system'],families:['ragequit'],onProgress:quiet}),stale=structuredClone(first);stale.routes[0].actions.at(-1).index=0;
 const result=findCurrentEndingsV66({maxAttempts:1,roles:['system'],families:['ragequit'],resume:stale,discardDriftedResume:true,onProgress:quiet});
 assert.equal(result.complete,true);assert.equal(result.discardedResume.length,1);assert.deepEqual(result.routes[0].actions,first.routes[0].actions);const run=E.replayRun(result.routes[0].roleId,result.routes[0].seed,result.routes[0].actions);assert.equal(run.endingId,'ragequit-system');assert.equal(E.validRun(run),true);
});

const currentCatalog=JSON.parse(readFileSync(new URL('./fixtures/current-endings-v66.json',import.meta.url),'utf8'));
test('the current-profile proof covers the entire catalog once and records the source and search limits',()=>{
 assert.equal(currentCatalog.profile,'e39-r66-n');
 assert.equal(currentCatalog.strategyVersion,CURRENT_ENDING_SEARCH_VERSION_V66);
 assert.equal(currentCatalog.choiceIndexBase,0);
 assert.match(currentCatalog.method,/目標導向合法操作，不代表一般玩家隨機就能碰齊/);
 assert.equal(currentCatalog.routes.length,ENDINGS.length);
 assert.equal(new Set(currentCatalog.routes.map(route=>route.ending)).size,ENDINGS.length);
 assert.deepEqual(currentCatalog.routes.map(route=>route.ending).sort(),ENDINGS.map(ending=>ending.id).sort());
 const source=currentSourceSha256V66();
 assert.deepEqual(Object.keys(currentCatalog.sourceSha256),Object.keys(source));
 for(const [name,sha]of Object.entries(source))assert.equal(currentCatalog.sourceSha256[name],sha,`Revalidate every current route and refresh the fixture after ${name} changes`);
});

test('every current catalog ending replays from a fresh r66 life with the app calendar and no injected state',()=>{
 for(const route of currentCatalog.routes){
  assert.deepEqual(Object.keys(route).sort(),['actions','ending','roleId','seed']);
  assert.match(route.seed,/^e39-r66-n-[0-9a-f]{22}$/,route.ending);
  assert.equal(route.seed.length,32,route.ending);
  assert.deepEqual(route.actions[0],{type:'activity-schedule',version:1},route.ending);
  assert.equal(ENDINGS.find(ending=>ending.id===route.ending)?.roleId,route.roleId,route.ending);
  const replay=E.replayRun(route.roleId,route.seed,route.actions);
  assert.equal(replay.completed,true,route.ending);
  assert.equal(replay.endingId,route.ending,route.ending);
  assert.deepEqual(replay.actions,route.actions,route.ending);
  assert.equal(E.validRun(replay),true,route.ending);
 }
});

test('the standard current search includes the executive merge route without a special one-off script',()=>{
 const {run,route}=simulateCurrentV66('executive','merged_out',345);
 assert.equal(run.endingId,'merged_out-executive');
 assert.ok(route.actions.some(action=>action.type==='event-departure'&&action.eventId==='job-executive-stamp-title'));
 assert.equal(E.validRun(run),true);
 assert.deepEqual(E.replayRun(route.roleId,route.seed,route.actions),run);
});
