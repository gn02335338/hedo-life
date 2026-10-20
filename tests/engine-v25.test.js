import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRun,getEvent,applyChoice,advance,requestBreak,requestExit,requestRage,canRequestRage,validRun,replayRun,STAT_KEYS} from '../dist/engine.js';
import {moodCollapseProfileV25} from '../dist/meltdown-v25.js';
import {deriveCharacterStats} from '../dist/character-stats.js';
import {deriveAchievements} from '../dist/achievements.js';
import {validateCompletion} from '../worker/http.js';
import {ROLE_MAP} from '../dist/roles.js';

const {routes}=JSON.parse(readFileSync(new URL('./fixtures/mood-meals-routes-v25.json',import.meta.url)));
const copy=state=>JSON.parse(JSON.stringify(state));
const fixture=id=>{const row=routes.find(x=>x.id===id);assert.ok(row,id);return row;};
const from=id=>{const r=fixture(id);return replayRun(r.roleId,r.seed,r.actions);};

test('all new mood stages, self-destruct branches and sixteen dinners have natural canonical save/replay witnesses',()=>{
 assert.ok(routes.length>=60);let boundaries=0;
 for(const route of routes){
  assert.match(route.seed,/^e25-/);
  assert.doesNotThrow(()=>validateCompletion({runId:'11111111-1111-4111-8111-111111111111',roleId:route.roleId,seed:route.seed,actions:route.actions},ROLE_MAP));
  let run=createRun(route.roleId,route.seed);
  const check=()=>{run=copy(run);assert.equal(validRun(run),true,`${route.id}/${run.eventId}`);boundaries++;};check();
  for(const action of route.actions){
   if(action.type==='break')run=requestBreak(run);
   else {assert.equal(action.type,'choice');assert.equal(run.eventId,action.eventId);run=applyChoice(run,action.index);check();run=advance(run);}
   check();
  }
  assert.deepEqual(run,replayRun(route.roleId,route.seed,route.actions),route.id);
  for(const key of ['eventId','turn'])assert.equal(run[key],route.expected[key]);
  assert.equal(run.stats.mood,route.expected.mood);assert.equal(run.flags.mood_crash_count||0,route.expected.crashes);
  if(route.completionActions){const end=replayRun(route.roleId,route.seed,route.completionActions);assert.equal(end.completed,true);assert.equal(end.mealContext,null);assert.equal(end.meltdownReturnEventId,null);}
 }
 assert.ok(boundaries>1000);
});

test('the first four zero-mood episodes have different prose, higher rescue costs and smaller recovery without consuming another day',()=>{
 const costs=[],recoveries=[],cuts=[],titles=new Set();
 for(let stage=1;stage<=4;stage++){
  const original=from(`collapse-${stage}`),run={...copy(original),stats:{...original.stats,cash:100,energy:30},pip:{active:true,remaining:2},pipCount:1};
  const event=getEvent(run),profile=moodCollapseProfileV25(run);titles.add(event.title);assert.equal(event.meltdownStage,stage);
  assert.equal(run.flags.mood_crash_count,stage);assert.equal(run.stats.mood,0);assert.equal(advance(run),run);
  assert.equal(canRequestRage(run),false);assert.equal(requestRage(run),run);assert.equal(requestExit(run),run);
  costs.push(profile.cost);recoveries.push(profile.mood);cuts.push(profile.cut);
  for(const index of [0,1]){
   const before=copy(run),pending=applyChoice(run,index),after=advance(pending);
   assert.equal(after.salaryAdvice?.status==='open'?after.salaryAdvice.returnEventId:after.eventId,before.meltdownReturnEventId);assert.equal(after.meltdownReturnEventId,null);
   assert.equal(after.turn,before.turn);assert.deepEqual(after.pip,before.pip);assert.equal(after.rng,before.rng);
   assert.equal(after.flags.career_service,before.flags.career_service);assert.equal(after.flags.mood_crash_count,stage);
   assert.equal(after.stats.mood,index===0?profile.mood:profile.unpaidMood);
   assert.equal(after.stats.cash,index===0?100-profile.cost:100);
   if(index===1)assert.equal(after.pay,Math.max(1,Math.round(before.pay*(1-profile.cut/100))));
   assert.equal(validRun(after),true);
   const row=pending.history.at(-1);for(const key of STAT_KEYS)assert.equal(row.breakdown.reduce((sum,x)=>sum+(x.delta[key]||0),0),row.delta[key]);
  }
  const broke={...copy(run),stats:{...run.stats,cash:profile.cost-1}};assert.equal(getEvent(broke).choices[0].available,false);assert.throws(()=>applyChoice(broke,0),/Unavailable/);
 }
 assert.equal(titles.size,4);for(let i=1;i<4;i++){assert.ok(costs[i]>costs[i-1]);assert.ok(recoveries[i]<recoveries[i-1]);assert.ok(cuts[i]>cuts[i-1]);}
 const fifth={...from('collapse-4'),flags:{...from('collapse-4').flags,mood_crash_count:5}};
 assert.equal(getEvent(fifth).meltdownStage,4);assert.deepEqual(moodCollapseProfileV25(fifth),moodCollapseProfileV25(from('collapse-4')));
});

test('self-destruct opens a real workplace outburst with choices, preserves the crisis count and never awards a hit',()=>{
 for(let stage=1;stage<=4;stage++){
  const run=from(`collapse-${stage}`),before=deriveCharacterStats(run),pending=applyChoice(run,3),exploded=advance(pending);
  assert.equal(exploded.eventId,'mood-self-destruct');assert.equal(exploded.stats.mood,0);assert.equal(exploded.flags.mood_crash_count,stage);
  assert.equal(exploded.turn,run.turn);assert.equal(exploded.rng,run.rng);assert.deepEqual(exploded.pip,run.pip);
  assert.equal(getEvent(exploded).speaker,'self');assert.equal(getEvent(exploded).choices.length,3);assert.ok(getEvent(exploded).choices.some(x=>x.wild));
  assert.deepEqual(deriveCharacterStats(exploded),before);
  assert.deepEqual(deriveAchievements(exploded).filter(x=>/real-hit|dream-hit|first-punch/.test(x)),deriveAchievements(run).filter(x=>/real-hit|dream-hit|first-punch/.test(x)));
  assert.equal(validRun(exploded),true);assert.deepEqual(replayRun(run.roleId,run.seed,exploded.actions),exploded);
  const recovering=advance(applyChoice(exploded,1));assert.ok(recovering.stats.mood>0);assert.equal(recovering.flags.mood_crash_count,stage);assert.equal(recovering.meltdownReturnEventId,null);
  const exit=advance(applyChoice(exploded,2));assert.equal(exit.completed,true);assert.equal(exit.endingId,`ragequit-${run.roleId}`);assert.equal(exit.mealContext,null);
 }
});

test('published e24 runs retain the old collapse choices and never acquire a meal context',()=>{
 const old=createRun('system','e24-legacy-mood');assert.equal(Object.hasOwn(old,'mealContext'),false);
 const run={...old,eventId:'mood-collapse',meltdownReturnEventId:'jack-notebook',stats:{...old.stats,mood:0,cash:100},flags:{...old.flags,mood_crash_count:4}};
 const event=getEvent(run);assert.equal(event.choices.length,3);assert.equal(event.choices[0].delta.cash,-18);assert.equal(event.choices[0].delta.mood,50);
 assert.equal(event.choices.some(x=>x.effect==='moodSelfDestruct'),false);
});
