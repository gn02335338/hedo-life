import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {ENDINGS} from '../dist/endings.js';
import {ROLES,ROLE_MAP} from '../dist/roles.js';
import {EVENTS} from '../dist/events.js';
import {SOURCES} from '../dist/public-sources.js';
import {PERSONAS} from '../dist/persona.js';
import {careerMaxRank} from '../dist/career-api.js';
import {CHARACTER_IDS,CHARACTER_METRICS,deriveCharacterStats,characterAffinity} from '../dist/character-stats.js';
import {createRun,getEvent,applyChoice,advance,requestBreak,requestCareer,requestRaise,requestRage,canRequestBreak,canRequestCareer,canRequestRaise,validRun,replayRun,STAT_KEYS} from '../dist/engine.js';
import {validateCompletion} from '../worker/http.js';
import {replayRoute} from './find-routes-v3.mjs';

const copy=value=>JSON.parse(JSON.stringify(value));
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fixtures=name=>JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`,import.meta.url)));
const newEvents=()=>EVENTS.filter(event=>event.minRules===22);
const abilitySum=stats=>stats.skill+stats.slack+stats.lick;

test('all 341 published e21 routes retain 14541 exact JSON boundaries and final replay states',()=>{
 const routes=fixtures('legacy-e21-routes');assert.equal(routes.length,341);let count=0;
 for(const route of routes){
  assert.match(route.seed,/^e21-/);const checkpoints=[];
  const run=replayRoute(route,state=>{
   assert.equal(validRun(state),true,`${route.ending}: ${state.eventId}`);
   checkpoints.push(hash(state));
  });
  assert.deepEqual(checkpoints,route.checkpoints,route.ending);
  assert.equal(hash(run),route.stateSha256,route.ending);
  assert.equal(run.endingId,route.ending);
  assert.deepEqual(replayRun(route.roleId,route.seed,route.actions),run,route.ending);
  count+=checkpoints.length;
 }
 assert.equal(count,14541);
});

test('twenty e22 chronicle scenes use known characters and sources, with authored absurd options',()=>{
 const events=newEvents();assert.equal(events.length,20);
 assert.equal(EVENTS.filter(event=>(event.minRules||1)<=21).length,283,'published event pools keep their original membership');
 assert.equal(new Set(EVENTS.map(event=>event.id)).size,EVENTS.length);
 assert.ok(events.some(event=>event.speaker==='helen'));
 assert.ok(events.some(event=>event.speaker==='sonny'));
 for(const event of events){
  assert.ok(PERSONAS[event.speaker],event.id);
  assert.ok(event.sourceIds.length&&event.sourceIds.every(id=>SOURCES[id]),event.id);
  if(event.roles)assert.ok(event.roles.length&&event.roles.every(id=>ROLE_MAP[id]),event.id);
  assert.ok(event.title.length>5&&event.body.length>30&&event.wing.length>5,event.id);
  assert.equal(event.choices.length,3,event.id);
  assert.ok(event.choices.some(choice=>choice.wild===true),event.id);
  for(const choice of event.choices){
   assert.ok(choice.text.length>8&&choice.result.length>15,event.id);
   assert.equal(choice.detail,'',event.id);
   assert.doesNotMatch(choice.text,/成功率|機率|[+-]\d+|[%％]/,event.id);
   assert.ok(Object.entries(choice.delta).every(([key,value])=>STAT_KEYS.includes(key)&&Number.isInteger(value)),event.id);
  }
 }
});

test('e22 starts with the eight-rank career and retains ability, interruption and personnel state',()=>{
 for(const role of ROLES.filter(role=>(role.minRules||1)<=22))for(let index=0;index<8;index++){
  const run=createRun(role.id,`e22-inherit-${role.id}-${index}`);
  assert.equal(careerMaxRank(run),7);
  assert.equal(run.rank,role.id==='executive'?5:run.assignment==='assistant'?0:1);
  assert.equal(run.version,3);assert.equal(run.raiseContext,null);assert.equal(run.personnelPending,null);
  assert.equal(run.meltdownReturnEventId,null);assert.equal(run.rageContext,null);
  assert.ok(abilitySum(run.stats)<=180);
  assert.ok(getEvent(run).choices.some(choice=>choice.wild===true));
  const pending=applyChoice(run,0);assert.equal(validRun(copy(pending)),true);
  assert.ok(abilitySum(pending.stats)<=180);
  const gains=['skill','slack','lick'].filter(key=>pending.stats[key]>run.stats[key]);
  assert.ok(gains.length<=1);
  if(gains.length){
   const focus=gains[0],cost=Math.ceil((pending.stats[focus]-run.stats[focus])*.5);
   for(const key of ['skill','slack','lick'])if(key!==focus)assert.ok(pending.stats[key]<=Math.max(0,run.stats[key]-cost));
  }
  const history=pending.history.at(-1);
  for(const key of STAT_KEYS)assert.equal(history.breakdown.reduce((total,row)=>total+(row.delta[key]||0),0),history.delta[key]);
  assert.deepEqual(replayRun(role.id,run.seed,pending.actions),advance(pending));
 }
});

test('e22 preserves salary, spending and career availability while PIP prevents overlapping reviews',()=>{
 const initial=createRun('system','e22-work-card-gates');
 const run={...initial,eventId:'jack-notebook',turn:6,educationReviewed:true,stats:{...initial.stats,mood:80,energy:80,cash:80,boss:65},history:Array.from({length:3},()=>({kind:'daily',choiceIndex:0,eventId:'jack-notebook'}))};
 assert.equal(canRequestBreak(run),true);assert.equal(canRequestCareer(run),true);assert.equal(canRequestRaise(run),true);
 for(const [request,id]of [[requestCareer,'career-review'],[requestRaise,'raise-request']]){
  const next=request(run);assert.equal(next.eventId,id);assert.equal(next.turn,run.turn);
  assert.ok(getEvent(next).choices.length>=3);
 }
 const rest=requestBreak(run);assert.ok(['self-care','kind-break'].includes(rest.eventId));assert.equal(rest.turn,run.turn);
 assert.equal(canRequestBreak(rest),false);assert.equal(canRequestCareer(rest),false);assert.equal(canRequestRaise(rest),false);
 const pip={...run,pip:{active:true,remaining:3},pipCount:1};
 assert.equal(canRequestCareer(pip),false);assert.equal(canRequestRaise(pip),false);assert.equal(canRequestBreak(pip),true);
 const watch={...run,flags:{...run.flags,floor_watch:1}};
 assert.equal(canRequestCareer(watch),false);assert.equal(canRequestRaise(watch),false);
});

test('e22 action envelopes support current interactions and reject forged raise and rage fields',()=>{
 const run=createRun('system','e22-action-envelope');
 const body={runId:'54f51683-00db-4a1b-b025-b6fc0d423109',roleId:'system',seed:run.seed};
 for(const action of [{type:'raise'},{type:'break'},{type:'career'},{type:'rage',phase:'event',eventId:'onboarding'},{type:'rage',phase:'event',eventId:'crisis-boss',target:'helen'}])assert.doesNotThrow(()=>validateCompletion({...body,actions:[action]},ROLE_MAP));
 for(const action of [{type:'raise',amount:300},{type:'rage',phase:'event',eventId:'onboarding',target:'outsider'},{type:'rage',phase:'event',eventId:'onboarding',result:'real'}])assert.throws(()=>validateCompletion({...body,actions:[action]},ROLE_MAP));
 assert.throws(()=>replayRun(run.roleId,run.seed,[{type:'raise'}]));
 const pending=requestRage(run);assert.equal(validRun(copy(pending)),true);
 assert.deepEqual(replayRun(run.roleId,run.seed,pending.actions),advance(pending));
 assert.throws(()=>replayRun(run.roleId,run.seed,[{...pending.actions[0],eventId:'invented-scene'}]));
});

test('Helen has her own illustrated identity and starts with zero counters in old and new lives',()=>{
 assert.equal(PERSONAS.helen.name,'前女友');assert.equal(PERSONAS.helen.title,'產品開發總監');
 assert.equal(PERSONAS.helen.image,'./assets/helen.png');
 assert.match(PERSONAS.helen.about,/產品開發總監.*前女友/);
 assert.match(PERSONAS.helen.about,/產品規劃、工作分工與交接/);
 assert.doesNotMatch(PERSONAS.helen.about,/海倫|實際交往|特權/);assert.match(PERSONAS.sonny.about,/桑尼/);
 assert.ok(CHARACTER_IDS.includes('helen'));
 for(const seed of ['e21-character-zero','e22-character-zero']){
  const run=createRun('system',seed),before=copy(run),row=deriveCharacterStats(run).find(item=>item.id==='helen');
  assert.ok(row);for(const key of CHARACTER_METRICS)assert.equal(row[key],0,key);
  assert.deepEqual(characterAffinity(run,'helen'),{score:50,start:50,gained:0,lost:0});
  assert.deepEqual(run,before,'reading the expanded character book never rewrites a save or RNG');
 }
});

test('only committed Helen dialogue records an encounter; ordinary work is neither an imagined nor real hit',()=>{
 const event=newEvents().find(item=>item.speaker==='helen');assert.ok(event);
 const initial=createRun('product','e22-helen-dialogue');
 const run={...initial,eventId:event.id,stats:{...initial.stats,energy:85,mood:85,cash:85,boss:60}};
 const before=copy(run);getEvent(run);assert.equal(deriveCharacterStats(run).find(row=>row.id==='helen').encounters,0);
 assert.deepEqual(run,before,'viewing a choice does not record it');
 const pending=applyChoice(run,0),row=deriveCharacterStats(pending).find(item=>item.id==='helen');
 assert.equal(pending.history.at(-1).speaker,'helen');assert.equal(row.encounters,1);
 assert.equal(row.realHits,0);assert.equal(row.imaginedHits,0);
 const recorded=structuredClone(pending);deriveCharacterStats(pending);characterAffinity(pending,'helen');assert.deepEqual(pending,recorded);
});

test('the current ending report remains complete across all occupations',()=>{
 const report=JSON.parse(readFileSync(new URL('../research/reachability-v3.json',import.meta.url)));
 assert.equal(report.complete,true);assert.equal(report.found,ENDINGS.length);assert.deepEqual(report.missing,[]);
 assert.ok(report.routes.every(route=>/^e(?:31|32|33|34|35|36|37|38|39)-/.test(route.seed)));
 for(const role of ROLES)assert.ok(report.routes.some(route=>route.roleId===role.id),role.id);
});

test('all twenty new scenes have natural replay witnesses without injected state',()=>{
 const routes=fixtures('chronicle-routes-v22').routes.filter(route=>newEvents().some(event=>event.id===route.id));
 assert.equal(routes.length,20);
 assert.deepEqual(new Set(routes.map(route=>route.eventId)),new Set(newEvents().map(event=>event.id)));
 for(const route of routes){
  const before=replayRun(route.roleId,route.seed,route.actions.slice(0,-1));
  assert.equal(before.eventId,route.eventId);assert.equal(before.pending,false);
  const pending=applyChoice(before,route.actions.at(-1).index),resolved=advance(pending);
  assert.equal(pending.history.at(-1).eventId,route.eventId);
  assert.equal(validRun(copy(resolved)),true);
  assert.deepEqual(replayRun(route.roleId,route.seed,route.actions),resolved);
 }
});
