import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {currentSeedV66,simulateCurrentV66} from '../scripts/find-current-endings-v66.mjs';
import {currentSeedV67,simulateCurrentV67,findCurrentEndingsV67,currentEndingFixtureV67,currentSourceSha256V67,CURRENT_ENDING_SEARCH_VERSION_V67} from '../scripts/find-current-endings-v67.mjs';
import * as E from '../dist/engine.js';
import {ENDINGS} from '../dist/endings.js';

const quiet=()=>{};
test('the r67 proof uses deterministic strict ordinary seeds distinct from the preserved r66 search',()=>{
 const seeds=[];
 for(const role of ['system','bd'])for(const target of ['ragequit','broke'])for(let attempt=0;attempt<3;attempt++){
  const seed=currentSeedV67(role,target,attempt);
  assert.match(seed,/^e39-r67-n-[0-9a-f]{22}$/);assert.equal(seed.length,32);
  assert.equal(currentSeedV67(role,target,attempt),seed);assert.notEqual(seed,currentSeedV66(role,target,attempt));seeds.push(seed);
 }
 assert.equal(new Set(seeds).size,seeds.length);
});

test('an actual r67 proof life includes the app calendar and its public actions canonically reproduce its result',()=>{
 const {run,route}=simulateCurrentV67('system','ragequit',0);
 assert.equal(run.endingId,'ragequit-system');assert.equal(run.patronage,null);assert.deepEqual(run.actions[0],{type:'activity-schedule',version:1});
 assert.equal(route.actions,run.actions);assert.equal(E.validRun(run),true);assert.deepEqual(E.replayRun(route.roleId,route.seed,route.actions),run);
 const report=findCurrentEndingsV67({maxAttempts:1,roles:['system'],families:['ragequit'],onProgress:quiet});
 assert.equal(report.profile,'e39-r67-n');assert.equal(report.complete,true);assert.equal(report.expected,1);assert.equal(report.found,1);
 assert.deepEqual(report.routes[0].actions,run.actions);assert.deepEqual(report.missing,[]);
});

test('the optional finder profile leaves unconfigured r66 searches byte stable',()=>{
 // The original r66 result still uses its original hash seed and independent
 // calendar; explicitly requesting a different proof cannot rewrite it.
 const before=simulateCurrentV66('system','ragequit',0),hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
 assert.match(before.run.seed,/^e39-r66-n-[0-9a-f]{22}$/);
 simulateCurrentV67('system','ragequit',0);
 assert.equal(hash(simulateCurrentV66('system','ragequit',0)),hash(before));
 assert.equal(before.run.seed,currentSeedV66('system','ragequit',0));
});

test('resuming r67 proof progress validates every witness and rejects foreign or altered routes',()=>{
 const report=findCurrentEndingsV67({maxAttempts:1,roles:['system'],families:['ragequit'],onProgress:quiet});
 assert.deepEqual(findCurrentEndingsV67({maxAttempts:1,roles:['system'],families:['ragequit'],resume:report,onProgress:quiet}).routes,report.routes);
 const foreign=structuredClone(report);foreign.routes[0].seed=foreign.routes[0].seed.replace('r67','r66');
 assert.throws(()=>findCurrentEndingsV67({maxAttempts:1,roles:['system'],families:['ragequit'],resume:foreign,onProgress:quiet}),/Invalid current resume route/);
 const altered=structuredClone(report);altered.routes[0].actions.at(-1).index=0;
 assert.throws(()=>findCurrentEndingsV67({maxAttempts:1,roles:['system'],families:['ragequit'],resume:altered,onProgress:quiet}),/Invalid resumed witness/);
});

test('an incomplete or filtered r67 search cannot masquerade as the whole current catalog',()=>{
 const report=findCurrentEndingsV67({maxAttempts:1,roles:['system'],families:['ragequit'],onProgress:quiet});
 assert.throws(()=>currentEndingFixtureV67(report),/Current catalog proof is incomplete/);
 assert.throws(()=>currentEndingFixtureV67({...report,profile:'e39-r66-n'}),/Invalid r67 proof profile/);
 for(const input of [{maxAttempts:0},{maxAttempts:1.2},{roles:[]},{roles:['fake']},{families:[]}])assert.throws(()=>findCurrentEndingsV67({...input,onProgress:quiet}));
});

test('a natural company offer with disabled draw choices uses a legal public fallback instead of clicking a disabled response',()=>{
 const {run,route}=simulateCurrentV67('finance','company_stagnation',10);
 assert.match(run.seed,/^e39-r67-n-/);assert.equal(E.validRun(run),true);assert.deepEqual(E.replayRun(route.roleId,route.seed,route.actions),run);
});

test('the complete r67 fixture covers all 883 endings and binds its proof to the current production source',()=>{
 const catalog=JSON.parse(readFileSync(new URL('./fixtures/current-endings-v67.json',import.meta.url),'utf8'));
 assert.equal(catalog.profile,'e39-r67-n');assert.equal(catalog.strategyVersion,CURRENT_ENDING_SEARCH_VERSION_V67);assert.equal(catalog.choiceIndexBase,0);
 assert.match(catalog.method,/Public actions only, no state or RNG injection/);assert.match(catalog.method,/目標導向合法操作，不代表一般玩家隨機就能碰齊/);
 assert.equal(catalog.routes.length,883);assert.equal(catalog.routes.length,ENDINGS.length);assert.equal(new Set(catalog.routes.map(route=>route.ending)).size,ENDINGS.length);
 assert.deepEqual(catalog.routes.map(route=>route.ending).sort(),ENDINGS.map(ending=>ending.id).sort());
 assert.deepEqual(catalog.sourceSha256,currentSourceSha256V67(),'Revalidate every route and refresh the proof after source changes');
});

test('every catalog ending is attainable through a fresh r67 ordinary start and replay-valid complete app actions',()=>{
 const catalog=JSON.parse(readFileSync(new URL('./fixtures/current-endings-v67.json',import.meta.url),'utf8'));
 for(const route of catalog.routes){
  assert.deepEqual(Object.keys(route).sort(),['actions','ending','roleId','seed']);assert.match(route.seed,/^e39-r67-n-[0-9a-f]{22}$/,route.ending);
  assert.deepEqual(route.actions[0],{type:'activity-schedule',version:1},route.ending);assert.equal(ENDINGS.find(ending=>ending.id===route.ending)?.roleId,route.roleId);
  const run=E.replayRun(route.roleId,route.seed,route.actions);
  assert.equal(run.completed,true,route.ending);assert.equal(run.endingId,route.ending,route.ending);assert.deepEqual(run.actions,route.actions,route.ending);assert.equal(E.validRun(run),true,route.ending);
 }
});
