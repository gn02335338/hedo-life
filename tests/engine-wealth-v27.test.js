import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ROLES} from '../dist/roles.js';
import {ENDINGS} from '../dist/endings.js';
import {createRun,getEvent,applyChoice,advance,replayRun,validRun,requestExit,requestBreak,canRequestBreak,requestCareer,canRequestCareer,canRequestRage} from '../dist/engine.js';
import {WEALTH_EVENTS_V27,wealthEligibilityV27} from '../dist/wealth-exit-v27.js';
import {replayRoute} from './find-routes-v3.mjs';

const {routes,families}=JSON.parse(readFileSync(new URL('./fixtures/wealth-routes-v27.json',import.meta.url),'utf8'));
const endings=routes.filter(route=>route.kind==='ending');
const play=(run,index)=>advance(applyChoice(run,index));
const from=route=>replayRun(route.roleId,route.seed,route.actions);
const snapshot=run=>({rng:run.rng,turn:run.turn,pip:run.pip,pipCount:run.pipCount,stats:run.stats,pay:run.pay,basePay:run.basePay});
function eligibilityState(cash,workDays,{pending=false,cohort='e27'}={}){
 const run=createRun('system',`${cohort}-wealth-boundary`);
 return {...run,stats:{...run.stats,cash},pending,history:Array.from({length:workDays},(_,index)=>({kind:index%2?'fantasy':'daily',eventId:'meeting-ten-minutes',turn:index+1})),flags:{...run.flags}};
}

test('wealth planning requires earned work days and exact cash thresholds; menus and pending work do not qualify early',()=>{
 for(const [cash,days,startup,retirement]of [[74,6,false,false],[75,5,false,false],[75,6,true,false],[89,10,true,false],[90,9,true,false],[90,10,true,true]]){
  const state=eligibilityState(cash,days),actual=wealthEligibilityV27(state);
  assert.equal(actual.workDays,days,`${cash}/${days}`);assert.equal(actual.startup,startup,`${cash}/${days}/startup`);assert.equal(actual.retirement,retirement,`${cash}/${days}/retirement`);assert.equal(actual.eligible,startup||retirement);
 }
 const pendingSix=wealthEligibilityV27(eligibilityState(75,6,{pending:true}));
 assert.equal(pendingSix.workDays,5);assert.equal(pendingSix.startup,false);
 const pendingTen=wealthEligibilityV27(eligibilityState(90,10,{pending:true}));
 assert.equal(pendingTen.workDays,9);assert.equal(pendingTen.retirement,false);
 const menus=eligibilityState(100,5);menus.history.push(...Array.from({length:30},()=>({kind:'career',eventId:'wealth-plan'})),{kind:'onboarding'});
 assert.equal(wealthEligibilityV27(menus).workDays,5);assert.equal(wealthEligibilityV27(menus).eligible,false);
 const resolvedWorkWithPendingMenu=eligibilityState(90,10);resolvedWorkWithPendingMenu.history.push({kind:'career',eventId:'wealth-plan'});resolvedWorkWithPendingMenu.pending=true;
 assert.equal(wealthEligibilityV27(resolvedWorkWithPendingMenu).workDays,10);
 const old=eligibilityState(100,20,{cohort:'e26'});assert.equal(wealthEligibilityV27(old).eligible,false);
});

test('the 36 new endings are naturally reachable for every chosen profession and retain valid complete save boundaries',()=>{
 assert.equal(endings.length,36);assert.equal(new Set(endings.map(route=>route.id)).size,36);
 assert.deepEqual(new Set(endings.map(route=>route.id)),new Set(ROLES.filter(role=>(role.minRules||1)<=27).flatMap(role=>families.map(family=>`${family}-${role.id}`))));
 assert.ok(ENDINGS.length>=377);assert.deepEqual(new Set(WEALTH_EVENTS_V27),new Set(['wealth-plan','wealth-startup','wealth-retire']));
 let boundaries=0;
 for(const route of endings){
  const done=replayRoute(route,run=>{boundaries++;assert.equal(validRun(run),true,`${route.id}/${run.eventId}`);assert.ok(run.stats.skill+run.stats.slack+run.stats.lick<=180);});
  assert.equal(done.completed,true,route.id);assert.equal(done.endingId,route.id);assert.equal(done.eventId,null);assert.equal(done.wealthReturnEventId,null);
  const scene=replayRun(route.roleId,route.seed,route.choiceActions),eligibility=wealthEligibilityV27(scene);
  assert.equal(eligibility.startup,true);if(route.family.startsWith('retired_'))assert.equal(eligibility.retirement,true);
  assert.ok(scene.stats.cash>=75);assert.ok(eligibility.workDays>=6);assert.equal(done.actualRoleId,route.actualRoleId);
 }
 assert.ok(boundaries>1000);
});

test('opening or declining wealth plans preserves resources, time, queued work and RNG; retirement always needs an explicit choice',()=>{
 for(const route of endings){
  const plan=replayRun(route.roleId,route.seed,route.planActions),scene=replayRun(route.roleId,route.seed,route.choiceActions);
  assert.equal(plan.eventId,'wealth-plan');assert.equal(scene.completed,false);assert.equal(scene.pendingFamily,null);
  assert.deepEqual(snapshot(scene),snapshot(plan),route.id);
  assert.equal(canRequestRage(plan),false);assert.equal(canRequestRage(scene),false);
  assert.equal(requestExit(scene),scene);assert.equal(canRequestBreak(scene),false);assert.equal(canRequestCareer(scene),false);
  const backIndex=getEvent(scene).choices.findIndex(choice=>choice.effect==='wealthBack');assert.ok(backIndex>=0);
  const back=play(scene,backIndex);assert.equal(back.eventId,'wealth-plan');assert.deepEqual(snapshot(back),snapshot(plan),route.id);
  const returnIndex=getEvent(back).choices.findIndex(choice=>choice.effect==='wealthReturn');assert.ok(returnIndex>=0);
  const returned=play(back,returnIndex);assert.equal(returned.eventId,plan.wealthReturnEventId);assert.equal(returned.wealthReturnEventId,null);
  assert.deepEqual(snapshot(returned),snapshot(plan),route.id);assert.equal(returned.completed,false);assert.equal(validRun(returned),true);
 }
});

test('startup commitments charge the stated fee once, draw one check, and never give another work-day salary or PIP tick',()=>{
 for(const route of endings.filter(route=>route.family.startsWith('venture_'))){
  const scene=replayRun(route.roleId,route.seed,route.choiceActions),choice=getEvent(scene).choices[route.index],fee=route.index===0?35:40;
  assert.ok(choice.check);const pending=applyChoice(scene,route.index);
  assert.equal(pending.stats.cash,scene.stats.cash-fee,route.id);assert.equal(pending.turn,scene.turn);assert.deepEqual(pending.pip,scene.pip);assert.equal(pending.pay,scene.pay);
  assert.notEqual(pending.rng,scene.rng);assert.equal(pending.history.length,scene.history.length+1);
  const repeated=applyChoice(pending,route.index);assert.equal(repeated,pending);
  const done=advance(pending);assert.equal(done.completed,true);assert.equal(done.rng,pending.rng);assert.equal(done.stats.cash,pending.stats.cash);assert.equal(done.turn,scene.turn);
  const delta=pending.history.at(-1).delta;assert.equal(delta.cash,-fee);assert.equal(pending.history.at(-1).kind,'career');
 }
 for(const route of endings.filter(route=>route.family.startsWith('retired_'))){
  const scene=replayRun(route.roleId,route.seed,route.choiceActions),pending=applyChoice(scene,route.index);
  assert.equal(pending.stats.cash,scene.stats.cash);assert.equal(pending.turn,scene.turn);assert.equal(pending.rng,scene.rng);assert.deepEqual(pending.pip,scene.pip);
  assert.equal(advance(pending).endingId,route.id);
 }
});

test('each first qualification can offer a free plan once; urgent PIP work and assessment keep their priority',()=>{
 for(const id of ['notice-startup','notice-retirement']){
  const route=routes.find(row=>row.id===id);assert.ok(route,id);
  const before=replayRun(route.roleId,route.seed,route.actions.slice(0,-1)),action=route.actions.at(-1);
  const pending=applyChoice(before,action.index),offered=advance(pending);
  assert.equal(offered.eventId,'wealth-plan');assert.equal(offered.pending,false);assert.equal(offered.completed,false);
  // Suppressing only the one-time offer isolates its transition from the
  // underlying, identical natural work choice and next-event selection.
  const suppressed=advance({...pending,flags:{...pending.flags,wealth_startup_notice:1,wealth_retire_notice:1}});
  assert.deepEqual(snapshot(offered),snapshot(suppressed),id);assert.equal(offered.wealthReturnEventId,suppressed.eventId);
  assert.equal(offered.flags.wealth_startup_notice,1);if(id==='notice-retirement')assert.equal(offered.flags.wealth_retire_notice,1);
  const returned=play(offered,2);assert.equal(returned.eventId,suppressed.eventId);assert.equal(returned.wealthReturnEventId,null);assert.deepEqual(snapshot(returned),snapshot(suppressed));
  assert.equal(advance(returned),returned,'view cancellation alone never reopens the same offer');
 }
 const fixture=routes.find(row=>row.kind==='blocked-pip');assert.ok(fixture);const pip=from(fixture);
 assert.equal(pip.pip.active,true);assert.equal(wealthEligibilityV27(pip).startup,true);assert.notEqual(pip.eventId,'wealth-plan');
 const safe=getEvent(pip).choices.map((choice,index)=>({choice,index})).filter(({choice})=>choice.available!==false)
  .map(({index})=>({index,run:play(pip,index)})).find(({run})=>run.pip?.active&&run.stats.mood>12&&run.stats.energy>15&&!run.pendingFamily&&getEvent(run)?.kind==='daily');
 assert.ok(safe,'a natural active-PIP work response leaves enough mood and energy for a genuine priority test');
 const unfinished={...pip,flags:{...pip.flags,wealth_startup_notice:0,wealth_retire_notice:0}};
 const working=play(unfinished,safe.index);assert.notEqual(working.eventId,'wealth-plan');assert.equal(working.wealthReturnEventId,null);assert.equal(working.pip.remaining,pip.pip.remaining-1);
 // Isolated assessment boundary: qualification must not consume or replace the
 // final required work day when the ordinary PIP counter reaches zero.
 const lastDay={...unfinished,pip:{...unfinished.pip,remaining:1}},assessment=play(lastDay,safe.index);
 assert.equal(assessment.eventId,'pip-review');assert.equal(assessment.pip.remaining,0);assert.equal(assessment.wealthReturnEventId,null);
});

test('old e26 lives keep their original shape and ordinary controls while e27 wealth views reject unaffordable commitments',()=>{
 const old=createRun('sales','e26-wealth-compat');assert.equal(Object.hasOwn(old,'wealthReturnEventId'),false);assert.equal(wealthEligibilityV27(old).eligible,false);
 const exit=requestExit(old);assert.ok(getEvent(exit).choices.every(choice=>choice.effect!=='wealthPlan'));
 const contemporary=createRun('sales','e27-wealth-compat');assert.equal(contemporary.wealthReturnEventId,null);assert.equal(validRun(contemporary),true);
 const route=endings.find(candidate=>candidate.family==='venture_independent');
 const scene=replayRun(route.roleId,route.seed,route.choiceActions);
 for(const cash of [0,34,35,39,40,74,75]){
  // These are isolated affordability boundary states, never replay witnesses.
  const isolated={...scene,stats:{...scene.stats,cash}},event=getEvent(isolated);
  assert.equal(event.choices[0].available!==false,cash>=75);assert.equal(event.choices[1].available!==false,cash>=75);
  for(const index of [0,1])if(event.choices[index].available===false)assert.throws(()=>applyChoice(isolated,index),/Unavailable choice/);
 }
 const living=routes.find(row=>row.id==='plan-return');assert.ok(living);const returned=from(living);
 assert.ok(getEvent(returned));assert.equal(returned.completed,false);assert.equal(validRun(returned),true);
});
