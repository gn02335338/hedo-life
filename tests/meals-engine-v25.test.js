import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRun, getEvent, applyChoice, advance, requestBreak, requestExit, requestCareer, requestRaise, requestRage, canRequestRage, validRun, replayRun } from '../dist/engine.js';
import { MEAL_GUEST_IDS_V25 } from '../dist/meals-v25.js';
import { deriveCharacterStats } from '../dist/character-stats.js';

const copy=run=>JSON.parse(JSON.stringify(run));
const canonical=run=>assert.deepEqual(replayRun(run.roleId,run.seed,run.actions),run);
const resolve=(run,index)=>{
 const pending=applyChoice(run,index);assert.equal(validRun(pending),true,`pending ${run.eventId}`);
 const next=advance(copy(pending));assert.equal(validRun(next),true,`${run.eventId} -> ${next.eventId}`);return next;
};
const closedControls=run=>{
 for(const request of [requestExit,requestBreak,requestCareer,requestRaise])assert.equal(request(run),run,`${request.name}/${run.eventId}`);
};
const guestStats=(run,id)=>deriveCharacterStats(run).find(row=>row.id===id);
function care(seedNumber=1){
 let run=resolve(createRun('sales',`e25-meal-${seedNumber}`),0);
 assert.equal(getEvent(run).kind,'daily');
 run=requestBreak(run);assert.equal(validRun(run),true);
 if(run.eventId==='kind-break')run=resolve(run,1);
 assert.equal(run.eventId,'self-care');return run;
}
function table(id,seedNumber=1){
 let run=resolve(care(seedNumber),4),at=MEAL_GUEST_IDS_V25.indexOf(id);
 if(at>=8)run=resolve(run,8);
 return resolve(run,at%8);
}
const warningActions=[
 ['onboarding',0],['bd21-mou-annex',1],['bd21-introduction-scope',1],['education-scrutiny',1],['salary-cut',2],
 ['owen-triple-followup',1],['kind-workday',1],['meeting-chair-host',0],['mood-collapse',1],['wing-leave-forecast',0]
].map(([eventId,index])=>({type:'choice',eventId,index}));
const warning=()=>replayRun('sales','e25-meal-warning-0',warningActions);

test('e25 guest browsing and cancelling keep the exact workday, PIP, RNG, savings and character counters',()=>{
 const original=care(),workEventId=original.breakReturnEventId;
 for(const pip of [null,{active:true,remaining:2}]){
  const start={...copy(original),pip,pipCount:pip?1:original.pipCount};assert.equal(validRun(start),true);
  const before=copy(start),stats=deriveCharacterStats(start);
  let run=resolve(start,4);closedControls(run);assert.equal(canRequestRage(run),false);
  for(const index of [8,8,8,8]){run=resolve(run,index);closedControls(run);assert.deepEqual(deriveCharacterStats(run),stats);}
  for(const key of ['turn','rng','pay','rank','lastBreakTurn','breakReturnEventId'])assert.deepEqual(run[key],before[key]);
  assert.deepEqual(run.pip,before.pip);assert.deepEqual(run.stats,before.stats);
  run=resolve(run,9);assert.equal(run.eventId,'self-care');assert.equal(run.mealContext,null);
  assert.equal(run.breakReturnEventId,workEventId);assert.deepEqual(run.stats,before.stats);assert.deepEqual(deriveCharacterStats(run),stats);
  const again=resolve(run,4);assert.equal(again.eventId,'meal-guests-a');assert.equal(again.rng,before.rng);
  if(!pip)canonical(again);
 }
});

test('e25 picking a dinner guest resolves no character interaction; only the table response changes affinity and charges once',()=>{
 for(const id of MEAL_GUEST_IDS_V25){
  const start=care(),before=deriveCharacterStats(start),run=table(id);closedControls(run);
  assert.deepEqual(deriveCharacterStats(run),before,id);assert.equal(run.stats.cash,start.stats.cash);
  assert.equal(run.rng,start.rng);assert.equal(run.turn,start.turn);assert.deepEqual(run.pip,start.pip);
  assert.equal(run.mealContext.guest,id);assert.equal(getEvent(run).speaker,id);assert.equal(canRequestRage(run),true);
  for(const index of [0,1]){
   const choice=getEvent(run).choices[index],pending=applyChoice(run,index),once=copy(pending);
   assert.equal(applyChoice(pending,index),pending);assert.deepEqual(pending,once);
   const paid=advance(pending);assert.equal(validRun(paid),true);canonical(paid);
   assert.equal(paid.stats.cash,run.stats.cash-choice.mealCost);assert.equal(paid.rng,run.rng);assert.equal(paid.turn,run.turn);
   assert.deepEqual(paid.pip,run.pip);assert.equal(paid.mealContext,null);assert.equal(paid.breakReturnEventId,null);
   const old=guestStats(run,id),now=guestStats(paid,id),ledger=pending.history.at(-1).breakdown.find(row=>row.source==='choice');
   assert.equal(now.encounters,old.encounters+1);assert.equal(now.realHits,old.realHits);assert.equal(now.imaginedHits,old.imaginedHits);
   const expected=id==='wing'?(ledger.delta.boss||0):(ledger.delta.trust||0);
   assert.equal((now.affinityGained-old.affinityGained)-(now.affinityLost-old.affinityLost),expected,id);
   if(id!=='wing')assert.equal(paid.stats.boss,run.stats.boss,id);
  }
  const cancelled=resolve(run,2);canonical(cancelled);
  assert.equal(cancelled.eventId,'self-care');assert.equal(cancelled.stats.cash,run.stats.cash);
  assert.equal(cancelled.rng,run.rng);assert.equal(cancelled.turn,run.turn);
  const old=guestStats(run,id),now=guestStats(cancelled,id);
  assert.equal(now.encounters,old.encounters+1);assert.equal(now.affinityGained,old.affinityGained);assert.equal(now.affinityLost,old.affinityLost);
 }
});

test('e25 dinner choices reject insufficient savings and preserve PIP; exact-price spending finishes with the normal broke ending',()=>{
 for(const id of ['wing','jack']){
  const original=table(id),cost=getEvent(original).choices[0].mealCost;
  const poor={...copy(original),stats:{...original.stats,cash:cost-1},pip:{active:true,remaining:2},pipCount:1};
  assert.equal(validRun(poor),true);assert.throws(()=>applyChoice(poor,0),/Unavailable choice/);assert.throws(()=>applyChoice(poor,1),/Unavailable choice/);
  const cancel=resolve(poor,2);assert.deepEqual(cancel.pip,poor.pip);assert.equal(cancel.stats.cash,poor.stats.cash);
  const affordable={...copy(poor),stats:{...poor.stats,cash:cost+1}},paid=resolve(affordable,0);
  assert.equal(paid.stats.cash,1);assert.equal(paid.rng,affordable.rng);assert.deepEqual(paid.pip,affordable.pip);
  const exact={...copy(poor),stats:{...poor.stats,cash:cost}},broke=resolve(exact,0);
  assert.equal(broke.completed,true);assert.equal(broke.endingId,'broke-sales');assert.equal(broke.mealContext,null);assert.equal(broke.breakReturnEventId,null);
 }
 const guests=resolve(care(),4),poor={...copy(guests),stats:{...guests.stats,cash:1}};
 for(let index=0;index<8;index++)assert.throws(()=>applyChoice(poor,index),/Unavailable choice/);
 assert.equal(resolve(poor,8).eventId,'meal-guests-b');assert.equal(resolve(poor,9).eventId,'self-care');
});

test('e25 all sixteen dinner guests preserve canonical event/result dreams and real-hit aftermaths through completion',()=>{
 let paths=0;
 for(const id of MEAL_GUEST_IDS_V25)for(const phase of ['event','result'])for(const mode of ['imagined','real']){
  const secondPage=MEAL_GUEST_IDS_V25.indexOf(id)>=8;
  const n=phase==='event'?(mode==='imagined'?1:2):id==='wing'?(mode==='imagined'?0:1):(mode==='imagined'?1:secondPage?20:2);
  let run=table(id,n);const cash=run.stats.cash,cost=getEvent(run).choices[0].mealCost;
  if(phase==='result')run=applyChoice(run,0);
  const before=guestStats(run,id),released=requestRage(run);assert.notEqual(released,run);
  assert.equal(released.rageContext.mode,mode,`${id}/${phase}/${mode}`);assert.equal(validRun(released),true);
  let after=advance(copy(released));assert.equal(validRun(after),true);canonical(after);
  const now=guestStats(after,id);assert.equal(now[mode==='real'?'realHits':'imaginedHits'],before[mode==='real'?'realHits':'imaginedHits']+1);
  if(mode==='imagined'){
   assert.equal(after.eventId,phase==='event'?`meal-with-${id}`:run.breakReturnEventId);
   assert.equal(after.stats.cash,cash-(phase==='result'?cost:0));
   assert.equal(after.mealContext===null,phase==='result');
  }else{
   assert.equal(after.eventId,'rage-aftermath');assert.ok(after.mealContext);closedControls(after);
   for(let depth=0;depth<8&&!after.completed;depth++){
    const index=getEvent(after).choices.findIndex(choice=>choice.available!==false);
    assert.ok(index>=0);after=resolve(after,index);canonical(after);
   }
   assert.equal(after.completed,true,`${id}/${phase}`);assert.equal(after.mealContext,null);assert.equal(after.breakReturnEventId,null);
  }
  paths++;
 }
 assert.equal(paths,64);
});

test('a warning dinner that reaches zero mood opens the next collapse and self-destruct, then returns without stale meal context',()=>{
 const start=warning();assert.equal(start.eventId,'crisis-mood');assert.equal(start.stats.mood,4);assert.equal(start.flags.mood_crash_count,1);
 const work=start.resumeEventId,clock={turn:start.turn,rng:start.rng,pip:start.pip};
 let run=resolve(start,1);assert.equal(run.mealContext.origin,'crisis-mood');closedControls(run);canonical(run);
 run=resolve(run,0);assert.equal(run.eventId,'meal-with-wing');assert.equal(run.stats.cash,start.stats.cash);canonical(run);
 run=resolve(run,0);assert.equal(run.eventId,'mood-collapse');assert.equal(run.flags.mood_crash_count,2);assert.equal(run.stats.mood,0);
 assert.equal(run.mealContext,null);assert.equal(run.resumeEventId,null);assert.equal(run.breakReturnEventId,null);assert.equal(run.meltdownReturnEventId,work);canonical(run);
 run=resolve(run,3);assert.equal(run.eventId,'mood-self-destruct');assert.equal(run.flags.mood_crash_count,2);canonical(run);
 run=resolve(run,0);assert.equal(run.eventId,work);assert.equal(run.stats.mood,30);assert.equal(run.stats.cash,start.stats.cash-26-32);
 assert.equal(run.mealContext,null);assert.equal(run.meltdownReturnEventId,null);assert.equal(run.resumeEventId,null);canonical(run);
 assert.equal(run.turn,clock.turn);assert.equal(run.rng,clock.rng);assert.deepEqual(run.pip,clock.pip);
});

test('meal queues retain valid low-pay/personnel priorities and reject forged simultaneous salary-talk contexts',()=>{
 const fixture=JSON.parse(readFileSync(new URL('./fixtures/mood-meals-routes-v25.json',import.meta.url)));
 const route=fixture.routes.find(row=>row.id==='self-destruct-4-reply-1');
 let advice=replayRun(route.roleId,route.seed,route.actions);assert.equal(advice.eventId,'low-pay-tip');
 advice=resolve(advice,0);assert.equal(advice.salaryAdvice.status,'done');assert.equal(validRun(advice),true);
 // Reset only the delivery state of an already evidenced salary reduction to
 // test scheduling. The authored route above proves the payroll history.
 const queued={...copy(advice),salaryAdvice:{...advice.salaryAdvice,status:'queued'}};
 queued.stats={...queued.stats,mood:70,cash:100};queued.lastBreakTurn=-1;
 let run=requestBreak(queued);if(run.eventId==='kind-break')run=resolve(run,1);assert.equal(run.eventId,'self-care');
 run=resolve(run,4);assert.equal(run.salaryAdvice.status,'queued');assert.equal(validRun(run),true);
 run=resolve(run,8);assert.equal(run.salaryAdvice.status,'queued');run=resolve(run,0);assert.equal(run.eventId,'meal-with-jack');
 run=resolve(run,0);assert.equal(run.eventId,'low-pay-tip');assert.equal(run.salaryAdvice.status,'open');assert.equal(run.mealContext,null);assert.equal(validRun(run),true);
 const guests=resolve(care(),4),source=guests.history[0].eventId;
 const personnel={...copy(guests),personnelPending:{reason:'first',source,strength:25}};assert.equal(validRun(personnel),true);
 let dinner=resolve(personnel,0);assert.ok(dinner.personnelPending);assert.equal(dinner.eventId,'meal-with-wing');
 dinner=resolve(dinner,1);assert.equal(dinner.mealContext,null);assert.equal(dinner.personnelPending,null);assert.ok(['crisis-boss','dismissal-final'].includes(dinner.eventId));assert.equal(validRun(dinner),true);
 const forged={...copy(guests),raiseContext:{eventId:guests.breakReturnEventId,fromPay:guests.pay,offerPay:null,percent:null,outcome:null,view:null,approach:null}};
 assert.equal(validRun(forged),false);
});
