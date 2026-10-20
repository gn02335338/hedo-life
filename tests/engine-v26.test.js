import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ROLES,ROLE_MAP} from '../dist/roles.js';
import {EVENTS} from '../dist/events.js';
import {QUIZ_EVENTS_V26_A} from '../dist/events-quiz26-a.js';
import {QUIZ_EVENTS_V26_B} from '../dist/events-quiz26-b.js';
import {SOURCES} from '../dist/public-sources.js';
import {PERSONAS} from '../dist/persona.js';
import {careerMaxRank} from '../dist/career-api.js';
import {deriveCharacterStats} from '../dist/character-stats.js';
import {createRun,getEvent,applyChoice,advance,replayRun,validRun,requestRage,canRequestRage,getRageTargets,STAT_KEYS} from '../dist/engine.js';
import {validateCompletion} from '../worker/http.js';
import {replayRoute} from './find-routes-v3.mjs';
import {QUIZ_GROUPS} from './quiz-v26-groups.js';

const events=[...QUIZ_EVENTS_V26_A,...QUIZ_EVENTS_V26_B];
const report=JSON.parse(readFileSync(new URL('./fixtures/quiz-routes-v26.json',import.meta.url)));
const {routes}=report,choices=routes.filter(route=>!route.id.startsWith('role-'));
const proof=route=>({runId:'d7a3bf3c-19a0-4ff1-8a79-c33ab4487403',roleId:route.roleId,seed:route.seed,actions:route.actions});

test('verified quiz scenes append original e26 choices without changing the published pools or exposing answers',()=>{
 assert.ok(QUIZ_EVENTS_V26_A.length>0);assert.ok(QUIZ_EVENTS_V26_B.length>0);
 assert.deepEqual(EVENTS.filter(event=>event.minRules===26),events);
 assert.equal(EVENTS.filter(event=>(event.minRules||1)<=25).length,323);
 assert.equal(new Set(EVENTS.map(event=>event.id)).size,EVENTS.length);
 assert.ok(SOURCES.verifiedQuiz);
 for(const event of events){
  assert.equal(event.minRules,26);assert.ok(event.id.length<=100);
  assert.ok(PERSONAS[event.speaker]||event.speaker==='self',event.id);
  assert.ok(event.sourceIds.includes('verifiedQuiz'),event.id);
  assert.ok(event.sourceIds.every(id=>SOURCES[id]),event.id);
  assert.equal(event.choices.length,3,event.id);assert.ok(event.choices.some(choice=>choice.wild),event.id);
  if(event.roles)assert.ok(event.roles.length&&event.roles.every(id=>ROLE_MAP[id]),event.id);
  for(const choice of event.choices){
   assert.equal(choice.detail,'');assert.ok(choice.text.length>5&&choice.result.length>15,event.id);
   assert.doesNotMatch(choice.text,/成功率|機率|[%％]|[+-]\d+/,event.id);
   assert.ok(Object.entries(choice.delta).every(([key,value])=>STAT_KEYS.includes(key)&&Number.isInteger(value)),event.id);
  }
 }
});

test('every quiz response has a natural canonical prefix, valid JSON save boundaries and an honest completed continuation',()=>{
 const expected=events.flatMap(event=>event.choices.map((choice,index)=>`${event.id}-choice-${index}`));
 assert.equal(report.eventCount,events.length);assert.equal(report.choiceCount,expected.length);
 assert.deepEqual(choices.map(route=>route.id).sort(),expected.sort());
 let boundaries=0;
 for(const route of choices){
  assert.match(route.seed,/^e26-/);
  const before=replayRun(route.roleId,route.seed,route.actions.slice(0,-1));
  assert.equal(before.eventId,route.eventId,route.id);assert.equal(before.actualRoleId,route.actualRoleId);
  const event=getEvent(before),saved=JSON.stringify(before),previous=deriveCharacterStats(before);
  getEvent(before);assert.equal(JSON.stringify(before),saved);
  if(event.roles)assert.ok(event.roles.includes(before.actualRoleId),route.id);
  const pending=applyChoice(before,route.index),resolved=advance(pending),row=pending.history.at(-1);
  assert.equal(row.eventId,event.id);assert.equal(row.choiceIndex,route.index);assert.equal(row.speaker,event.speaker);
  const canonical=replayRoute({...route,ending:route.id},state=>{assert.equal(validRun(state),true,`${route.id}/${state.eventId}`);boundaries++;});
  assert.deepEqual(canonical,resolved,route.id);assert.deepEqual(replayRun(route.roleId,route.seed,route.actions),resolved,route.id);
  assert.ok(resolved.stats.skill+resolved.stats.slack+resolved.stats.lick<=180,route.id);
  const actual=deriveCharacterStats(pending);
  for(const prior of previous){const next=actual.find(item=>item.id===prior.id);assert.equal(next.realHits,prior.realHits);assert.equal(next.imaginedHits,prior.imaginedHits);}
  assert.doesNotThrow(()=>validateCompletion(proof(route),ROLE_MAP));
  const full={...route,actions:route.completionActions},ended=replayRoute({...full,ending:route.id},state=>assert.equal(validRun(state),true,`${route.id}/completion/${state.eventId}`));
  assert.equal(ended.completed,true,route.id);assert.equal(ended.endingId,route.endingId);
  assert.deepEqual(replayRun(full.roleId,full.seed,full.actions),ended,route.id);
 }
 assert.ok(boundaries>events.length*5);
});

test('all actual occupations retain the eight-rank career and inherited interventions while new scenes follow the actual job',()=>{
 const witnesses=routes.filter(route=>route.id.startsWith('role-'));
 assert.deepEqual(witnesses.map(route=>route.actualRoleId).sort(),ROLES.map(role=>role.id).sort());
 for(const route of witnesses){
  const initial=createRun(route.roleId,route.seed),run=replayRun(route.roleId,route.seed,route.actions.slice(0,-1));
  assert.equal(careerMaxRank(initial),7);assert.equal(initial.raiseContext,null);assert.equal(initial.personnelPending,null);
  assert.equal(initial.salaryAdvice,null);assert.equal(initial.mealContext,null);assert.equal(initial.meltdownReturnEventId,null);
  assert.equal(initial.rank,initial.roleId==='executive'?5:initial.assignment==='assistant'?0:1);
  assert.equal(validRun(initial),true);assert.equal(validRun(run),true);
  const event=getEvent(run);assert.equal(event.id,route.eventId);assert.equal(run.actualRoleId,route.actualRoleId);
  if(event.roles)assert.ok(event.roles.includes(run.actualRoleId));
 }
 for(const event of events)assert.throws(()=>getEvent({...createRun('system','e25-no-future-quiz'),eventId:event.id}),/Unknown event/);
});

test('fifteen new shared conversations replay every present target in event/result phases and never count a bystander hit',()=>{
 for(const [eventId,targets]of Object.entries(QUIZ_GROUPS)){
  const route=choices.find(row=>row.eventId===eventId&&row.index===0);assert.ok(route,eventId);
  const before=replayRun(route.roleId,route.seed,route.actions.slice(0,-1));
  assert.deepEqual(getRageTargets(before),targets,eventId);
  const result=getEvent(before).choices.map((choice,index)=>applyChoice(before,index)).find(canRequestRage);assert.ok(result,`${eventId}/result phase`);
  for(const context of [before,result])for(const target of targets){
   const previous=deriveCharacterStats(context),pending=requestRage(context,target),resolved=advance(pending);
   assert.notEqual(pending,context);assert.equal(pending.rageContext.target,target);assert.equal(pending.history.at(-1).speaker,target);
   assert.equal(validRun(pending),true,`${eventId}/${target}/pending`);assert.equal(validRun(resolved),true,`${eventId}/${target}/resolved`);
   assert.deepEqual(replayRun(context.roleId,context.seed,resolved.actions),resolved);
   assert.doesNotThrow(()=>validateCompletion(proof({...route,actions:resolved.actions}),ROLE_MAP));
   const actual=deriveCharacterStats(resolved);
   for(const prior of previous){
    const next=actual.find(row=>row.id===prior.id),selected=prior.id===target;
    assert.equal(next.imaginedHits-prior.imaginedHits,Number(selected&&pending.rageContext.mode==='imagined'));
    assert.equal(next.realHits-prior.realHits,Number(selected&&pending.rageContext.mode==='real'));
   }
   const absent=Object.keys(PERSONAS).find(id=>!targets.includes(id));
   assert.equal(requestRage(context,absent),context);
   assert.throws(()=>replayRun(context.roleId,context.seed,[...context.actions,{...pending.actions.at(-1),target:absent}]));
  }
 }
});
