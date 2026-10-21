import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRun,getEvent,applyChoice,advance,replayRun,validRun,canRequestSalaryAdvice,requestSalaryAdvice,requestExit,requestBreak,requestCareer,requestRaise,STAT_KEYS} from '../dist/engine.js';
import {deriveCharacterStats} from '../dist/character-stats.js';
import {replayRoute} from './find-routes-v3.mjs';

const {routes}=JSON.parse(readFileSync(new URL('./fixtures/starting-salary-advice-routes.json',import.meta.url),'utf8'));
const copy=value=>JSON.parse(JSON.stringify(value));
const get=id=>{const route=routes.find(row=>row.id===id);assert.ok(route,id);return route;};
const from=(route,actions=route.actions)=>replayRun(route.roleId,route.seed,actions);
const openingState=run=>{const {actions,eventId,salaryAdvice,...state}=run;return state;};

test('natural administrative and assistant offers cover 27/28/29K, exact 30K and a normal higher offer',()=>{
 for(const pay of [27,28,29,30]){
  const route=get(`admin-${pay}`),initial=createRun(route.roleId,route.seed),run=from(route);assert.equal(initial.pay,pay);assert.equal(run.pay,pay);assert.equal(run.history.find(row=>row.eventId==='onboarding').pay,pay);
  assert.equal(run.salaryAdvice,null);assert.equal(canRequestSalaryAdvice(run),pay<30);assert.equal(validRun(copy(run)),true);
 }
 const assistant=from(get('assistant-low'));assert.equal(assistant.assignment,'assistant');assert.ok(assistant.pay<30);assert.equal(canRequestSalaryAdvice(assistant),true);
 const high=from(get('normal-high'));assert.equal(high.assignment,'honest');assert.ok(high.pay>=30);assert.equal(canRequestSalaryAdvice(high),false);assert.equal(requestSalaryAdvice(high),high);
 const raised=get('raised-above-threshold'),promoted=from(raised);assert.ok(raised.startPay<30);assert.ok(promoted.pay>=30);assert.equal(promoted.salaryAdvice,null);assert.equal(canRequestSalaryAdvice(promoted),false);assert.equal(requestSalaryAdvice(promoted),promoted);
});

test('every natural saved boundary replays, including three responses, deferred urgent scenes and all supported cohorts',()=>{
 let boundaries=0;
 for(const route of routes){
  const run=from(route);assert.equal(validRun(copy(run)),true,route.id);assert.equal(run.pay,route.expected.pay);assert.equal(run.eventId,route.expected.eventId);assert.equal(canRequestSalaryAdvice(run),route.expected.eligible);
  assert.deepEqual(replayRoute({...route,ending:route.id},state=>{boundaries++;assert.equal(validRun(state),true,`${route.id}/${state.eventId}`);}),run);
  if(route.openActions){const opened=from(route,route.openActions);assert.equal(opened.salaryAdvice.origin,'starting-pay');assert.equal(opened.eventId,'low-pay-tip');assert.equal(validRun(copy(opened)),true);}
  if(route.completionActions){const done=from(route,route.completionActions);assert.equal(done.completed,true);assert.equal(done.endingId,route.endingId);assert.equal(validRun(copy(done)),true);}
 }
 assert.ok(boundaries>100);
 for(const cohort of ['e28','e29','e30','e31'])assert.equal(canRequestSalaryAdvice(from(get(`cohort-${cohort}`))),true);
});

test('opening the starting-pay reminder adds one canonical action without a roll, workday, PIP tick, encounter or resource change',()=>{
 for(const id of ['admin-27','assistant-low','active-pip','onboarding-after-dream','onboarding-after-verbal']){
  const route=get(id),run=from(route),snapshot=copy(run),opened=requestSalaryAdvice(run),onboard=run.history.find(row=>row.eventId==='onboarding');
  assert.notEqual(opened,run);assert.deepEqual(run,snapshot);assert.deepEqual(openingState(opened),openingState(run));assert.equal(opened.actions.length,run.actions.length+1);assert.deepEqual(opened.actions.at(-1),{type:'salary-advice'});
  assert.deepEqual(opened.salaryAdvice,{from:onboard.pay,to:run.pay,historyIndex:run.history.length-1,returnEventId:run.eventId,status:'open',origin:'starting-pay'});
  assert.deepEqual(deriveCharacterStats(opened),deriveCharacterStats(run));assert.deepEqual(opened.stats,run.stats);assert.deepEqual(opened.pip,run.pip);assert.deepEqual(opened.seen,run.seen);assert.equal(opened.rng,run.rng);assert.equal(opened.turn,run.turn);
  assert.equal(canRequestSalaryAdvice(opened),false);assert.equal(requestSalaryAdvice(opened),opened);assert.equal(advance(opened),opened);
  assert.deepEqual(replayRun(opened.roleId,opened.seed,opened.actions),opened);assert.equal(validRun(copy(opened)),true);
  for(const request of [requestExit,requestBreak,requestCareer,requestRaise])assert.equal(request(opened),opened);
  if(id==='active-pip')assert.ok(opened.pip?.active);
 }
});

test('the starting-pay story distinguishes an initial low offer from a pay cut and keeps all three consequences hidden before selection',()=>{
 const route=get('admin-27'),opened=from(route,route.openActions),event=getEvent(opened);
 assert.equal(opened.salaryAdvice.from,27);assert.equal(opened.salaryAdvice.to,27);assert.equal(opened.salaryAdvice.historyIndex,0);assert.equal(event.speaker,'erich');assert.equal(event.kind,'crisis');assert.equal(event.choices.length,3);assert.ok(event.choices.some(choice=>choice.wild));
 assert.match(event.title,/錄取條件/);assert.match(event.body,/報到時就是27K/);assert.match(event.body,/一開始就開這樣/);assert.doesNotMatch(event.body,/27K改成27K/);
 for(const choice of event.choices){assert.equal(choice.detail,'');assert.doesNotMatch(choice.text,/成功率|機率|\d+(?:\.\d+)?\s*[%％]|[+-]\d+/);}
});

test('each response records its actual consequence and returns once to the exact work scene without charging another day',()=>{
 for(const index of [0,1,2])for(const id of ['admin-27','active-pip']){
  const route=get(id),opened=from(route,route.openActions),event=getEvent(opened),pending=applyChoice(opened,index),row=pending.history.at(-1),done=advance(pending);
  assert.equal(row.eventId,'low-pay-tip');assert.equal(row.speaker,'erich');assert.equal(row.choiceIndex,index);assert.equal(row.result,event.choices[index].result);assert.ok(row.delta.mood>0);
  for(const key of STAT_KEYS)assert.equal(row.breakdown.reduce((sum,part)=>sum+(part.delta[key]||0),0),row.delta[key]);
  for(const key of ['pay','rank','turn','rng','actualRoleId','lastBreakTurn'])assert.equal(done[key],opened[key],key);
  for(const key of ['cash','energy','boss','skill','slack','lick'])assert.equal(done.stats[key],opened.stats[key],key);
  assert.deepEqual(done.pip,opened.pip);assert.deepEqual(done.seen,opened.seen);assert.equal(done.eventId,opened.salaryAdvice.returnEventId);assert.equal(done.salaryAdvice.status,'done');assert.equal(done.salaryAdvice.returnEventId,null);assert.equal(done.salaryAdvice.origin,'starting-pay');
  assert.equal(done.actions.filter(action=>action.type==='salary-advice').length,1);assert.equal(done.history.filter(row=>row.eventId==='low-pay-tip').length,1);assert.equal(canRequestSalaryAdvice(done),false);assert.equal(requestSalaryAdvice(done),done);assert.equal(validRun(copy(done)),true);
  assert.deepEqual(replayRun(done.roleId,done.seed,done.actions),done);
 }
});

test('a candidate and pending onboarding result cannot trigger advice, while pre-onboarding dreams or speech do not hide the later salary',()=>{
 const baseline=get('admin-27'),initial=createRun(baseline.roleId,baseline.seed),pending=applyChoice(initial,0);
 assert.equal(initial.pay,27);assert.equal(canRequestSalaryAdvice(initial),false);assert.equal(requestSalaryAdvice(initial),initial);assert.equal(canRequestSalaryAdvice(pending),false);assert.equal(requestSalaryAdvice(pending),pending);assert.equal(canRequestSalaryAdvice(advance(pending)),true);
 for(const id of ['onboarding-after-dream','onboarding-after-verbal']){
  const route=get(id),run=from(route);assert.notEqual(run.history[0].eventId,'onboarding');const onboard=run.history.find(row=>row.eventId==='onboarding');assert.ok(onboard);assert.ok(onboard.pay<30);assert.equal(canRequestSalaryAdvice(run),true);
  const opened=requestSalaryAdvice(run);assert.equal(opened.salaryAdvice.from,onboard.pay);assert.equal(opened.salaryAdvice.historyIndex,run.history.length-1);assert.equal(validRun(copy(opened)),true);
 }
});

test('personnel and zero-mood crises defer the reminder until a real safe work boundary',()=>{
 for(const id of ['deferred-hr','deferred-mood']){
  const route=get(id),blocked=from(route),snapshot=copy(blocked);assert.equal(canRequestSalaryAdvice(blocked),false);assert.equal(requestSalaryAdvice(blocked),blocked);assert.deepEqual(blocked,snapshot);
  const safe=from(route,route.resumeActions);assert.ok(['daily','fantasy'].includes(getEvent(safe).kind));assert.ok(safe.stats.mood>0);assert.equal(canRequestSalaryAdvice(safe),true);assert.equal(safe.salaryAdvice,null);
  const opened=requestSalaryAdvice(safe);assert.equal(opened.salaryAdvice.returnEventId,safe.eventId);assert.equal(opened.turn,safe.turn);assert.deepEqual(opened.pip,safe.pip);assert.equal(validRun(copy(opened)),true);
 }
});

test('forged origins, onboarding pay, anchors and duplicate or premature actions cannot establish valid starting-pay advice',()=>{
 const route=get('admin-27'),opened=from(route,route.openActions);
 for(const advice of [
  {...opened.salaryAdvice,origin:'invented'}, {...opened.salaryAdvice,status:'queued'}, {...opened.salaryAdvice,from:30},
  {...opened.salaryAdvice,to:30}, {...opened.salaryAdvice,from:28}, {...opened.salaryAdvice,historyIndex:-1},
  {...opened.salaryAdvice,historyIndex:opened.history.length}, {...opened.salaryAdvice,returnEventId:null},
  {...opened.salaryAdvice,extra:true}, {...opened.salaryAdvice,status:'done',returnEventId:null},
 ])assert.equal(validRun({...copy(opened),salaryAdvice:advice}),false,JSON.stringify(advice));
 const noOrigin={...opened.salaryAdvice};delete noOrigin.origin;assert.equal(validRun({...copy(opened),salaryAdvice:noOrigin}),false);
 const noAction=copy(opened);noAction.actions.pop();assert.equal(validRun(noAction),false);
 assert.throws(()=>replayRun(route.roleId,route.seed,[{type:'salary-advice'}]));
 assert.throws(()=>replayRun(route.roleId,route.seed,[...route.openActions,{type:'salary-advice'}]));
 assert.throws(()=>replayRun(route.roleId,route.seed,[...route.actions,{type:'salary-advice',outcome:'legal'}]));
 const forged=copy(opened);forged.history.find(row=>row.eventId==='onboarding').pay++;assert.equal(validRun(forged),false);
});

test('the catch-up action reserves response space, stays opt-in for saved proofs and never rewrites old no-action e31 lives',()=>{
 const run=from(get('admin-27')),snapshot=JSON.stringify(run);getEvent(run);assert.equal(advance(run),run);assert.equal(JSON.stringify(run),snapshot);assert.equal(run.salaryAdvice,null);assert.equal(run.actions.some(action=>action.type==='salary-advice'),false);
 // Isolated action-count boundaries test the request guard, not replay proofs.
 for(const length of [299,300])assert.equal(canRequestSalaryAdvice({...run,actions:Array.from({length},()=>({type:'exit'}))}),false);
 assert.equal(canRequestSalaryAdvice({...run,actions:Array.from({length:298},()=>({type:'exit'}))}),true);
 let legacy;
 for(let index=0;index<1000;index++){const initial=createRun('sales',`e27-start-pay-old-${index}`);if(initial.pay<30){legacy=advance(applyChoice(initial,0));break;}}
 assert.ok(legacy);assert.equal(canRequestSalaryAdvice(legacy),false);assert.equal(requestSalaryAdvice(legacy),legacy);
 const goldens=JSON.parse(readFileSync(new URL('./fixtures/legacy-e31-routes.json',import.meta.url),'utf8')),old=goldens.find(route=>createRun(route.roleId,route.seed).pay<30);assert.ok(old);assert.ok(!old.actions.some(action=>action.type==='salary-advice'));
 const unchanged=replayRoute(old),hash=createHash('sha256').update(JSON.stringify(unchanged)).digest('hex');assert.equal(hash,old.stateSha256);assert.equal(validRun(unchanged),true);assert.deepEqual(replayRun(old.roleId,old.seed,old.actions),unchanged);
});
