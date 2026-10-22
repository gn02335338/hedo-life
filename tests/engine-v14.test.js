import {rageTargetForV20} from '../dist/rage-v20.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRun,getEvent,applyChoice,advance,requestExit,requestBreak,requestCareer,requestRage,canRequestRage,replayRun,validRun,STAT_KEYS} from '../dist/engine.js';
import {deriveAchievements} from '../dist/achievements.js';
import {validateCompletion} from '../worker/http.js';
const copy=x=>JSON.parse(JSON.stringify(x));
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
function legacyCheckpoints(route,saved=false){
 let run=createRun(route.roleId,route.seed),hashes=[];
 const check=()=>{if(saved)run=copy(run);assert.equal(validRun(run),true,route.seed+'/'+run.eventId);hashes.push(hash(run));};check();
 for(const action of route.actions){
  if(action.type==='exit')run=requestExit(run);
  else if(action.type==='break')run=requestBreak(run);
  else if(action.type==='career')run=requestCareer(run);
  else if(action.type==='rage')run=requestRage(run);
  else{run=applyChoice(run,action.index);check();run=advance(run);}
  check();
 }
 return {run,hashes};
}
test('all published e13 endings, every target and banquet preserve 10649 direct and saved checkpoints',()=>{
 const fixtures=JSON.parse(readFileSync(new URL('./fixtures/legacy-e13-routes.json',import.meta.url)));
 assert.equal(fixtures.length,243);let count=0;
 for(const route of fixtures){
  const direct=legacyCheckpoints(route),saved=legacyCheckpoints(route,true);
  assert.equal(hash(direct.run),route.stateSha256,route.ending);
  assert.equal(hash(saved.run),route.savedStateSha256,route.ending);
  assert.deepEqual(direct.hashes,route.directCheckpoints,route.ending);
  assert.deepEqual(saved.hashes,route.savedCheckpoints,route.ending);
  assert.deepEqual(replayRun(route.roleId,route.seed,route.actions),direct.run);
  count+=direct.hashes.length;
 }
 assert.equal(count,10649);
});

function ledger(before,pending){
 const last=pending.history.at(-1),totals=Object.fromEntries(STAT_KEYS.map(key=>[key,0]));
 for(const part of last.breakdown)for(const [key,delta]of Object.entries(part.delta))totals[key]+=delta;
 assert.deepEqual(totals,last.delta);
 assert.deepEqual(last.delta,Object.fromEntries(STAT_KEYS.map(key=>[key,pending.stats[key]-before.stats[key]])));
 assert.ok(Object.values(pending.stats).every(value=>value>=0&&value<=100));
}
function sample(predicate,pendingSource=false){
 for(let index=0;index<500;index++){
  const initial=createRun('system',`e14-direct-test-${index}`),source=pendingSource?applyChoice(initial,0):initial;
  const result=requestRage(source);
  if(predicate(result))return {source,result,settled:advance(result)};
 }
 throw new Error('Missing natural branch');
}

test('one direct click targets onboarding Wing, resolves once and reveals a complete actual ledger',()=>{
 const source=createRun('system','e14-direct-onboarding'),before=copy(source),result=requestRage(source);
 assert.deepEqual(source,before);assert.equal(result.pending,true);assert.equal(result.eventId,'rage-release');
 assert.deepEqual(result.actions,[{type:'rage',phase:'event',eventId:'onboarding'}]);
 assert.equal(result.flags.rage_target_wing,1);assert.equal(result.flags.rage_attempts,1);
 assert.equal(result.history.length,1);assert.equal(result.history[0].speaker,'wing');
 assert.equal(getEvent(source).id,'onboarding');assert.ok(!getEvent(source).choices.some(choice=>choice.rageTarget));
 assert.match(result.history[0].result,/報到|第一天|名字/);
 assert.ok(!getEvent(source).body.includes(result.history[0].result));
 assert.equal(validRun(copy(result)),true);ledger(source,result);
 assert.deepEqual(requestRage(source),result);assert.strictEqual(requestRage(result),result);
 const settled=advance(result);assert.deepEqual(replayRun(source.roleId,source.seed,result.actions),settled);
 assert.equal(validRun(copy(settled)),true);
 const real=result.history[0].eventOutcome.result==='真的失控了',achievements=deriveAchievements(result);
 assert.equal(achievements.includes('real-hit-wing'),real);
 assert.equal(achievements.includes('dream-first-day'),!real);
 assert.equal(achievements.includes('real-first-day'),real);
 assert.ok(!achievements.includes('rage-wing'));
});

test('imagination returns to the interrupted conversation while actual loss of control opens a separate world',()=>{
 const imagined=sample(run=>run.flags.rage_imagined>0),actual=sample(run=>run.flags.rage_real>0);
 assert.equal(imagined.settled.eventId,'onboarding');assert.equal(imagined.settled.turn,0);
 assert.equal(imagined.settled.rageContext,null);assert.equal(canRequestRage(imagined.settled),false);
 assert.strictEqual(requestRage(imagined.settled),imagined.settled);
 assert.equal(actual.settled.eventId,'rage-aftermath');assert.equal(actual.settled.rageContext.target,'wing');
 assert.strictEqual(requestExit(actual.settled),actual.settled);assert.strictEqual(requestBreak(actual.settled),actual.settled);
 assert.strictEqual(requestCareer(actual.settled),actual.settled);assert.equal(canRequestRage(actual.settled),false);
 for(const branch of [imagined,actual]){
  assert.equal(validRun(copy(branch.result)),true);assert.equal(validRun(copy(branch.settled)),true);
  assert.deepEqual(replayRun(branch.source.roleId,branch.source.seed,branch.result.actions),branch.settled);
 }
});

test('rage from a revealed result retains the speaking scene and continues the committed choice only once',()=>{
 for(const real of [false,true]){
  const {source,result,settled}=sample(run=>Boolean(run.flags.rage_real)===real,true);
  assert.equal(source.eventId,'onboarding');assert.equal(source.pending,true);
  assert.equal(result.rageContext.phase,'result');assert.equal(result.rageContext.target,'wing');
  assert.deepEqual(result.actions.at(-1),{type:'rage',phase:'result',eventId:'onboarding'});
  assert.equal(result.history.length,2);assert.equal(result.history[0].eventId,'onboarding');
  assert.deepEqual(replayRun(source.roleId,source.seed,result.actions),settled);
  assert.equal(validRun(copy(result)),true);assert.equal(validRun(copy(settled)),true);ledger(source,result);
  if(!real){assert.equal(settled.turn,1);assert.equal(settled.history.filter(row=>row.eventId==='onboarding').length,1);}
  else{assert.equal(settled.turn,0);assert.equal(settled.eventId,'rage-aftermath');}
 }
 const terminal=applyChoice(createRun('system','e14-terminal'),2);
 assert.equal(canRequestRage(terminal),false);assert.strictEqual(requestRage(terminal),terminal);
});

test('seeded imagination versus actual action varies, and lower mood makes actual loss of control more frequent',()=>{
 let hotReal=0,calmReal=0;const modes=new Set();
 for(let index=0;index<1000;index++){
  const original=createRun('system',`e14-mood-sample-${index}`);
  for(const [mood,counter]of [[10,'hot'],[90,'calm']]){
   const run={...original,stats:{...original.stats,mood}},result=requestRage(run);
   if(result.flags.rage_real){if(counter==='hot')hotReal++;else calmReal++;}
   modes.add(result.rageContext.mode);ledger(run,result);
  }
 }
 assert.deepEqual([...modes].sort(),['imagined','real']);
 assert.ok(hotReal>calmReal+180,{hotReal,calmReal});
 assert.ok(calmReal>100&&hotReal<750,{hotReal,calmReal});
});

test('replay rejects forged conversation phases, fabricated targets and separate synthetic choices',()=>{
 const source=createRun('system','e14-forged-conversation'),event={type:'rage',phase:'event',eventId:'onboarding'};
 for(const action of [{type:'rage'},{...event,phase:'result'},{...event,eventId:'pip-review'},{...event,target:'rick'}]){
  assert.throws(()=>replayRun(source.roleId,source.seed,[action]));
 }
 assert.throws(()=>replayRun(source.roleId,source.seed,[event,{type:'choice',eventId:'rage-release',index:0}]));
 const result=requestRage(source),bad=copy(result);bad.rageContext.target='rick';assert.equal(validRun(bad),false);
 const incomplete=copy(result);incomplete.rageContext.phase='result';assert.equal(validRun(incomplete),false);
});

test('natural HR, salary, banquet and character conversations target their current speaker with timing-specific results',async()=>{
 const {replayRoute}=await import('./find-routes-v3.mjs');
 const {rageTargetFor,rageTiming}=await import('../dist/rage-v14.js');
 const {rageTargetForV16}=await import('../dist/rage-v16.js');
 const {rageTargetForV22}=await import('../dist/rage-v22.js');
 const {rageTargetForV23}=await import('../dist/rage-v23.js');
 const {rageTargetForV37}=await import('../dist/rage-v37.js');
 const {rageTargetForV39}=await import('../dist/rage-cast-v39.js');
 const routes=JSON.parse(readFileSync(new URL('../research/reachability-v3.json',import.meta.url))).routes;
 const people=new Set(),timings=new Set(),phases=new Set();
 for(const route of routes){
  replayRoute(route,run=>{
   if(!canRequestRage(run))return;
   const event=getEvent(run),person=/^e39-/.test(run.seed)?rageTargetForV39(event):/^e(?:37|38)-/.test(run.seed)?rageTargetForV37(event):/^e(?:23|24|25|26|27|28|29|30|31|32|33|34|35|36)-/.test(run.seed)?rageTargetForV23(event):/^e22-/.test(run.seed)?rageTargetForV22(event):/^e(?:20|21)-/.test(run.seed)?rageTargetForV20(event):/^e(?:16|17|18|19)-/.test(run.seed)?rageTargetForV16(event):rageTargetFor(event),timing=rageTiming(event.id),key=`${person}:${timing}:${run.pending}`;
   assert.ok(person,`natural current speaker for ${run.seed}/${event.id}`);
   if(phases.has(key))return;phases.add(key);people.add(person);timings.add(timing);
   const result=requestRage(run);assert.equal(result.rageContext.target,person,key);
   assert.equal(result.rageContext.eventId,event.id,key);assert.equal(result.history.at(-1).speaker,person,key);
   assert.equal(validRun(copy(result)),true,key);ledger(run,result);
   const settled=advance(result);assert.equal(validRun(copy(settled)),true,key);
   assert.deepEqual(replayRun(run.roleId,run.seed,result.actions),settled,key);
  });
 }
 for(const person of ['wing','spencer','rick','hope','erich','jenjen','sonny','kind'])assert.ok(people.has(person),`natural current speaker ${person}`);
 for(const timing of ['onboarding','pip','salary','banquet','exit','kind','workday'])assert.ok(timings.has(timing),`natural timing ${timing}`);
});

test('ordinary daily-result interruptions serialize an absent transition as null and restore correctly',()=>{
 let run=advance(applyChoice(createRun('system','e14-system-0-0'),0));
 assert.equal(getEvent(run).kind,'daily');run=applyChoice(run,0);assert.equal(run.pendingEffect,undefined);
 const result=requestRage(run);assert.equal(result.rageContext.pendingEffect,null);
 assert.equal(validRun(copy(result)),true);
 const settled=advance(copy(result));assert.equal(validRun(settled),true);
 assert.deepEqual(replayRun(run.roleId,run.seed,result.actions),settled);
});

test('real action from naturally exhausted work still reaches its aftermath instead of a generic burnout ending',async()=>{
 const {replayRoute}=await import('./find-routes-v3.mjs');
 const routes=JSON.parse(readFileSync(new URL('../research/reachability-v3.json',import.meta.url))).routes;
 let checked=0;
 for(const route of routes){
  if(checked)break;
  replayRoute(route,run=>{
   if(checked||run.stats.energy>11||!canRequestRage(run))return;
   const result=requestRage(run);if(!result.flags.rage_real)return;
   assert.equal(result.pendingFamily,null);assert.equal(validRun(copy(result)),true);
   const world=advance(result);assert.equal(world.eventId,'rage-aftermath');assert.equal(world.completed,false);
   const legal=advance(applyChoice(world,0));assert.equal(legal.eventId,'rage-legal');assert.equal(legal.completed,false);
   const finished=advance(applyChoice(legal,0));assert.equal(finished.endingId,`rage_legal-${run.roleId}`);
   assert.equal(validRun(copy(finished)),true);assert.deepEqual(replayRun(run.roleId,run.seed,finished.actions),finished);
   checked++;
  });
 }
 assert.ok(checked>0,'a naturally exhausted real-action witness exists');
});
