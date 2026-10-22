import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRun,getEvent,applyChoice,advance,replayRun,validRun,canRequestCareer,requestCareer,jobTitle,enableActivitySchedule,requestBreak,requestExit,requestActivityInvitation} from '../dist/engine.js';
import {patronageEligibleV29,getPatronageEventV29,patronageWorkCountV29} from '../dist/patronage-v29.js';
import {isPatronageV49,PATRONAGE_REQUIREMENTS_V49,patronageEligibleV49,isPatronageApplicationOutcomeV49} from '../dist/patronage-v49.js';
import {characterHistoryChanges,characterAffinity,deriveCharacterStats} from '../dist/character-stats.js';

const copy=value=>JSON.parse(JSON.stringify(value));
const choose=(run,index)=>advance(applyChoice(run,index));
const {routes,applications,gates,followups}=JSON.parse(readFileSync(new URL('./fixtures/patronage-routes-v49.json',import.meta.url),'utf8'));
const old=JSON.parse(readFileSync(new URL('./fixtures/patronage-routes-v29.json',import.meta.url),'utf8')).routes;
const from=(route,actions=route.actions)=>replayRun(route.roleId,route.seed,actions);
const attempts=routes.filter(route=>route.kind==='application');
const gateRoutes=routes.filter(route=>route.kind==='career-gate');
function replaySavedActions(route){
 let run=createRun(route.roleId,route.seed);
 for(const action of route.actions){
  if(action.type==='activity-schedule')run=enableActivitySchedule(run);
  else if(action.type==='activity-invitation')run=requestActivityInvitation(run);
  else if(action.type==='career')run=requestCareer(run);
  else if(action.type==='break')run=requestBreak(run);
  else if(action.type==='exit')run=requestExit(run);
  else if(action.type==='choice'){
   assert.equal(getEvent(run).id,action.eventId);run=choose(run,action.index);
  }else assert.fail(`Unexpected witness action ${action.type}`);
  run=copy(run);
  if(run.eventId==='patronage-application')assert.ok(run.stats.lick>=70&&run.stats.boss>=65);
 }
 return run;
}

test('new patronage rules are versioned; existing application histories and random draws stay unchanged',()=>{
 assert.deepEqual(PATRONAGE_REQUIREMENTS_V49,{lick:70,boss:65});
 for(const route of old.filter(row=>row.kind==='application')){
  const before=from(route,route.beforeActions),snapshot=copy(before);
  assert.equal(isPatronageV49(before),false);
  assert.equal(patronageEligibleV49(before),patronageEligibleV29(before));
  assert.deepEqual(getEvent(before),getPatronageEventV29(before));
  const resolved=from(route);
  assert.ok(resolved.history.every(row=>row.patronageApplicationOutcome===undefined));
  assert.equal(validRun(resolved),true);
  assert.deepEqual(before,snapshot);
 }
 assert.equal(isPatronageV49({seed:'e39-cal46-kin49-natural'}),true);
 for(const seed of ['e29-natural','e39-natural','e39-cal46-natural','e39-cal46-kin490-natural','e39-kin49-natural'])assert.equal(isPatronageV49({seed}),false);
});

test('natural career menus hide the application unless both flattery and Wing mood meet the gate',()=>{
 assert.equal(gates,4);
 assert.deepEqual(gateRoutes.map(route=>route.id).sort(),['both-low','eligible','low-boss','low-lick']);
 for(const route of gateRoutes){
  const source=from(route,route.entryBeforeActions),review=from(route,route.beforeActions),snapshot=copy(source);
  assert.ok(isPatronageV49(source));assert.ok(patronageEligibleV29(source));assert.ok(canRequestCareer(source));
  assert.deepEqual(requestCareer(source),review);
  const expected=source.stats.lick>=70&&source.stats.boss>=65;
  assert.equal(patronageEligibleV49(source),expected,route.id);
  assert.equal(route.eligible,expected);
  const choices=getEvent(review).choices;
  assert.equal(choices.some(choice=>choice.effect==='patronageApply'),expected,route.id);
  if(!expected){
   assert.ok(!choices.some(choice=>/乾兒子|乾女兒/.test(choice.text)));
   assert.throws(()=>applyChoice(review,choices.length),/Unavailable choice/);
   assert.equal(review.patronageContext,null);
  }
  if(route.id==='low-lick')assert.ok(source.stats.lick<70&&source.stats.boss>=65);
  if(route.id==='low-boss')assert.ok(source.stats.lick>=70&&source.stats.boss<65);
  if(route.id==='both-low')assert.ok(source.stats.lick<70&&source.stats.boss<65);
  assert.deepEqual(source,snapshot);assert.equal(validRun(review),true);assert.equal(validRun(from(route)),true);
 }
 // A pure boundary check uses the observed eligible life, not a fabricated
 // save or route. The game must accept the threshold itself, not only >.
 const route=gateRoutes.find(route=>route.id==='eligible'),observed=from(route,route.entryBeforeActions);
 for(const [lick,boss,eligible]of [[69,65,false],[70,64,false],[70,65,true],[100,64,false],[69,100,false],[100,100,true]]){
  const view={...observed,stats:{...observed.stats,lick,boss}};
  assert.equal(patronageEligibleV49(view),eligible,`${lick}/${boss}`);
 }
 for(const blocked of [
  {...observed,pip:{active:true}},
  {...observed,flags:{...observed.flags,floor_watch:1}},
  {...observed,flags:{...observed.flags,post_pip_tolerance:1}},
  {...observed,flags:{...observed.flags,patronage_offers:2}},
  {...observed,flags:{...observed.flags,patronage_last_offer_work:patronageWorkCountV29(observed)}},
  {...observed,turn:20},
  {...observed,patronage:{title:'乾兒子'}},
  {...observed,history:[]}
 ])assert.equal(patronageEligibleV49(blocked),false);
});

test('both genders reach automatic and career entry, with formal/wild acceptance, rejection and cancellation',()=>{
 assert.equal(applications,20);assert.equal(attempts.length,20);
 const required=['automatic','career'].flatMap(origin=>['male','female'].flatMap(gender=>['formal-success','formal-setback','wild-success','wild-setback','cancel'].map(outcome=>`${origin}-${gender}-${outcome}`)));
 assert.deepEqual(attempts.map(route=>route.id).sort(),required.sort());
 for(const route of attempts){
  const before=from(route,route.beforeActions),snapshot=copy(before),event=getEvent(before);
  assert.equal(before.eventId,'patronage-application');assert.equal(before.characterGender,route.characterGender);
  assert.equal(before.patronageContext.origin,route.origin);assert.equal(before.patronage,null);
  assert.ok(before.stats.lick>=70&&before.stats.boss>=65,route.id);
  assert.ok(patronageWorkCountV29(before)>=3);
  assert.equal(before.pip?.active??false,false);assert.ok(!before.flags.floor_watch&&!before.flags.post_pip_tolerance);
  assert.ok(event.choices[1].wild);
  for(const choice of event.choices)assert.doesNotMatch(choice.text,/成功率|機率|[%％]|[+-]\d+/);
  for(const choice of event.choices.slice(0,2))assert.ok(choice.check.chance>0&&choice.check.chance<1);
  const pending=applyChoice(before,route.index),row=pending.history.at(-1),resolved=advance(pending);
  assert.equal(pending.actions.length,before.actions.length+1);assert.equal(pending.turn,before.turn);
  assert.deepEqual(before,snapshot);assert.deepEqual(from(route),resolved);
  if(route.index===2){
   assert.equal(row.chanceOutcome,null);assert.equal(row.patronageApplicationOutcome,undefined);
   assert.equal(resolved.patronage,null);assert.equal(resolved.pay,before.pay);assert.equal(resolved.rng,before.rng);
  }else{
   const success=route.id.endsWith('-success'),expected=success?'appointed':'rejected';
   assert.equal(row.chanceOutcome,success?'success':'setback');
   assert.deepEqual(row.patronageApplicationOutcome,{version:1,result:expected,target:'rick',affinityDelta:success?-18:-12});
   assert.equal(isPatronageApplicationOutcomeV49(pending,row),true);
   assert.equal(Boolean(resolved.patronage),success);
   if(success){assert.equal(jobTitle(resolved),route.characterGender==='female'?'乾女兒':'乾兒子');assert.ok(resolved.pay>before.pay);}
   else{assert.equal(resolved.pay,before.pay);assert.equal(jobTitle(resolved),jobTitle(before));}
  }
  assert.equal(resolved.patronageContext,null);assert.equal(resolved.turn,before.turn);
  assert.deepEqual(resolved.pip,before.pip);
 }
});

test('Rick dislikes a submitted application after either result, without treating cancellation as rivalry',()=>{
 for(const route of attempts){
  const before=from(route,route.beforeActions),pending=applyChoice(before,route.index),historyIndex=pending.history.length-1;
  const changes=characterHistoryChanges(pending).filter(change=>change.historyIndex===historyIndex&&change.id==='rick');
  const oldScore=characterAffinity(before,'rick').score,newScore=characterAffinity(pending,'rick').score;
  const beforeStats=deriveCharacterStats(before).find(row=>row.id==='rick'),afterStats=deriveCharacterStats(pending).find(row=>row.id==='rick');
  if(route.index===2){
   assert.deepEqual(changes,[]);assert.equal(newScore,oldScore);assert.deepEqual(afterStats,beforeStats);
  }else{
   assert.equal(changes.length,1,route.id);
   const expected=pending.history.at(-1).patronageApplicationOutcome.affinityDelta;
   assert.equal(changes[0].affinityDelta,Math.max(0,oldScore+expected)-oldScore);
   assert.equal(newScore,Math.max(0,oldScore+expected));
   assert.equal(afterStats.encounters,beforeStats.encounters+1);
   assert.equal(afterStats.imaginedHits,beforeStats.imaginedHits);assert.equal(afterStats.realHits,beforeStats.realHits);
   assert.ok(newScore<oldScore,route.id);
  }
 }
});

test('the new evidence is save-safe through work and a completed departure, and canonical replay rejects tampering',()=>{
 assert.equal(followups,2);
 for(const route of routes){
  const before=from(route,route.beforeActions),resolved=from(route),ended=from(route,route.completionActions);
  assert.equal(validRun(copy(before)),true,`${route.id}/before`);assert.equal(validRun(copy(resolved)),true,`${route.id}/resolved`);
  assert.equal(validRun(copy(ended)),true,`${route.id}/ended`);assert.equal(ended.completed,true);assert.equal(ended.endingId,route.endingId);
  assert.deepEqual(replaySavedActions(route),resolved);
  if(route.kind==='followup'){
   assert.ok(before.patronage);assert.deepEqual(resolved.patronage,before.patronage);
   assert.ok(resolved.history.slice(before.history.length).some(row=>['daily','fantasy'].includes(row.kind)));
   assert.equal(characterAffinity(resolved,'rick').lost>=characterAffinity(before,'rick').lost,true);
  }
 }
 for(const result of ['success','setback']){
  const route=attempts.find(route=>route.id===`automatic-male-formal-${result}`),run=from(route),at=run.history.findLastIndex(row=>row.eventId==='patronage-application');
  for(const change of [
   row=>delete row.patronageApplicationOutcome,
   row=>row.patronageApplicationOutcome.target='wing',
   row=>row.patronageApplicationOutcome.affinityDelta=1,
   row=>row.patronageApplicationOutcome.result=result==='success'?'rejected':'appointed',
   row=>row.patronageApplicationOutcome.version=2,
   row=>row.patronageApplicationOutcome.untrusted=true,
   row=>row.chanceOutcome=result==='success'?'setback':'success'
  ]){
   const forged=copy(run);change(forged.history[at]);assert.equal(validRun(forged),false,`${result}/${change}`);
  }
  const moved=copy(run);moved.seed=moved.seed.replace('-kin49-','-');assert.equal(validRun(moved),false);
 }
 const cancelled=from(attempts.find(route=>route.id==='automatic-female-cancel')),forged=copy(cancelled);
 forged.history.at(-1).patronageApplicationOutcome={version:1,result:'rejected',target:'rick',affinityDelta:-12};
 assert.equal(validRun(forged),false);
});
