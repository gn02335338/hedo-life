import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ENDINGS} from '../dist/endings.js';
import {ROLES,ROLE_MAP} from '../dist/roles.js';
import {EVENTS} from '../dist/events.js';
import {SOURCES} from '../dist/public-sources.js';
import {PERSONAS} from '../dist/persona.js';
import {selectWorkEventV21} from '../dist/work-events-v21.js';
import {createRun,getEvent,applyChoice,advance,validRun,replayRun,requestExit,requestBreak,requestCareer,requestRaise,requestRage,canRequestBreak,canRequestCareer,canRequestRaise,jobTitle} from '../dist/engine.js';
import {careerMaxRank} from '../dist/career-api.js';
import {deriveAchievements} from '../dist/achievements.js';
import {validateCompletion} from '../worker/http.js';

const newEvents=()=>EVENTS.filter(event=>event.minRules===21);
const copy=value=>JSON.parse(JSON.stringify(value));
const scene=(id,roles)=>({id,roles,weight:1});

test('sixty new single-profession scenes prioritize sales, BD and design with authored absurd choices',()=>{
 const events=newEvents();assert.equal(events.length,60);assert.equal(EVENTS.filter(event=>(event.minRules||1)<=21).length,283);
 for(const role of ROLES.filter(role=>(role.minRules||1)<=21))assert.equal(events.filter(event=>event.roles[0]===role.id).length,['sales','bd','design'].includes(role.id)?12:4,role.id);
 assert.equal(new Set(events.map(event=>event.id)).size,60);
 for(const event of events){
  assert.equal(event.roles.length,1);assert.ok(ROLE_MAP[event.roles[0]]);assert.ok(PERSONAS[event.speaker]);
  assert.ok(event.sourceIds.length&&event.sourceIds.every(id=>SOURCES[id]));
  assert.equal(event.choices.length,3);assert.ok(event.choices.some(choice=>choice.wild===true),event.id);
  for(const choice of event.choices){assert.ok(choice.text.length>8&&choice.result.length>15);assert.doesNotMatch(choice.text,/成功率|機率|[+-]\d+|[%％]/);assert.ok(Object.values(choice.delta).every(Number.isInteger));}
 }
});

test('new work scheduling opens with the actual profession, even after a bait-and-switch',()=>{
 const exclusive=scene('actual',['sales']),advertised=scene('offer',['ai']),related=scene('related',['sales','bd']),shared=scene('shared');
 const run={actualRoleId:'sales',roleId:'ai',history:[]};let calls=0;
 assert.equal(selectWorkEventV21(run,[exclusive,related,shared],()=>{calls++;return .99;},[exclusive,advertised,related,shared]),'actual');
 assert.equal(calls,1,'a forced first profession scene draws only its within-bucket ticket');
 assert.deepEqual(run,{actualRoleId:'sales',roleId:'ai',history:[]});
});

test('ordinary scheduling favors exclusive and related work without eliminating shared office stories',()=>{
 const exclusive=scene('exclusive',['sales']),related=scene('related',['sales','bd']),shared=scene('shared'),pool=[exclusive,related,shared];
 const run={actualRoleId:'sales',roleId:'sales',history:[{kind:'daily',choiceIndex:0,eventId:'exclusive'}]};
 for(const [draw,id]of [[0,'exclusive'],[.499,'exclusive'],[.5,'related'],[.699,'related'],[.7,'shared'],[.999,'shared']]){
  const draws=[draw,.3];assert.equal(selectWorkEventV21(run,pool,()=>draws.shift(),pool),id);
 }
});

test('two resolved shared work scenes trigger profession work while interruptions do not count as work',()=>{
 const pool=[scene('exclusive',['sales']),scene('related',['sales','bd']),scene('shared-a'),scene('shared-b')];
 const history=[{kind:'daily',choiceIndex:0,eventId:'shared-a'},{kind:'self-care',eventId:'self-care'},{kind:'daily',choiceIndex:0,eventId:'shared-b'},{kind:'career',eventId:'career-review'},{kind:'daily',choiceIndex:-1,eventId:'exclusive'}];
 const run={actualRoleId:'sales',history};
 assert.equal(selectWorkEventV21(run,[pool[0],pool[1]],()=>.999,pool),'exclusive');
 assert.equal(selectWorkEventV21(run,[pool[1]],()=>.999,pool),'related');
 assert.equal(selectWorkEventV21(run,[pool[2]],()=>.999,pool),'shared-a','shared remains available when job scenes are exhausted');
 const before=copy(run);selectWorkEventV21(run,pool,()=>.4,pool);assert.deepEqual(run,before);
});

test('empty categories fall back to eligible unplayed scenes, and selected buckets retain authored weights',()=>{
 const a={...scene('a',['sales']),weight:1},b={...scene('b',['sales']),weight:3},shared=scene('shared');
 const run={actualRoleId:'sales',history:[{kind:'daily',choiceIndex:0,eventId:'shared'}]};
 for(const [ticket,id]of [[.1,'a'],[.5,'b'],[.99,'b']]){
  const draws=[.6,ticket];assert.equal(selectWorkEventV21(run,[a,b],()=>draws.shift(),[a,b,shared]),id);
 }
 assert.throws(()=>selectWorkEventV21(run,[],()=>0,[]));
});

test('e21 inherits full careers, ability tradeoffs, wild choices, raises, HR rules and strict action envelopes',()=>{
 const run=createRun('system','e21-feature-inheritance');assert.equal(careerMaxRank(run),7);assert.equal(validRun(copy(run)),true);
 assert.ok(run.stats.skill+run.stats.slack+run.stats.lick<=180);assert.equal(run.personnelPending,null);assert.equal(run.raiseContext,null);
 const event=getEvent(run);assert.ok(event.choices.some(choice=>choice.wild));assert.ok(jobTitle(run));
 const selected=applyChoice(run,0);assert.equal(validRun(copy(selected)),true);assert.ok(deriveAchievements(selected).includes('work-card'));
 const body={runId:'54f51683-00db-4a1b-b025-b6fc0d423109',roleId:'system',seed:run.seed,actions:[]};
 for(const action of [{type:'raise'},{type:'break'},{type:'career'},{type:'rage',phase:'event',eventId:'onboarding'},{type:'rage',phase:'event',eventId:'crisis-boss',target:'sonny'}])assert.doesNotThrow(()=>validateCompletion({...body,actions:[action]},ROLE_MAP));
 assert.throws(()=>validateCompletion({...body,actions:[{type:'rage',phase:'event',eventId:'crisis-boss',target:'outsider'}]},ROLE_MAP));
 const proof=requestRage(run);assert.equal(validRun(copy(proof)),true);assert.deepEqual(replayRun(run.roleId,run.seed,proof.actions),advance(proof));
});

test('natural e21 first work scenes belong to the current job, while every saved step replays canonically',()=>{
 for(const role of ROLES.filter(role=>(role.minRules||1)<=21))for(let index=0;index<12;index++){
  let run=createRun(role.id,`e21-first-work-${role.id}-${index}`);
  for(let step=0;step<8&&getEvent(run)?.kind!=='daily'&&!run.completed;step++){
   const event=getEvent(run);const choice=event.id==='onboarding'?0:event.id.startsWith('career-duty-')?0:event.choices.findIndex(choice=>choice.available!==false);
   run=advance(applyChoice(run,choice));assert.equal(validRun(copy(run)),true);
  }
  assert.equal(getEvent(run)?.kind,'daily',`${role.id}/${index}`);
  const authored=EVENTS.find(event=>event.id===run.eventId);assert.deepEqual(authored.roles,[run.actualRoleId]);
  assert.deepEqual(replayRun(role.id,run.seed,run.actions),run);
 }
});

test('the latest complete report uses e29 and retains every profession and every ending',()=>{
 const report=JSON.parse(readFileSync(new URL('../research/reachability-v3.json',import.meta.url)));
 assert.equal(report.complete,true);assert.equal(report.found,ENDINGS.length);assert.deepEqual(report.missing,[]);
 assert.ok(report.routes.every(route=>route.seed.startsWith('e29-')));
 for(const role of ROLES)assert.ok(report.routes.some(route=>route.roleId===role.id&&route.actions.some(action=>EVENTS.some(event=>event.id===action.eventId&&event.roles?.length===1))),role.id);
});
