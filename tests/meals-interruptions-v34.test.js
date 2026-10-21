import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getEvent,applyChoice,advance,requestRage,requestVerbal,replayRun,validRun,canRequestRage,canRequestVerbal} from '../dist/engine.js';

const {routes}=JSON.parse(readFileSync(new URL('./fixtures/meal-invitations-v34.json',import.meta.url),'utf8'));
const invitation=route=>{
 const before=replayRun(route.roleId,route.seed,route.actions.slice(0,-1));
 return {before,pending:applyChoice(before,route.actions.at(-1).index)};
};

test('verbal interruption after every committed invitation preserves its accepted or declined reply without charging or rerolling',()=>{
 for(const route of routes){
  const {before,pending}=invitation(route);
  assert.equal(canRequestRage(pending),false,'a person who only replied by message is not physically present');
  assert.equal(canRequestVerbal(pending),true);
  let run=requestVerbal(pending,undefined,2);
  assert.equal(validRun(run),true,`${route.id}/pending verbal result`);
  run=advance(run);assert.equal(validRun(run),true,`${route.id}/resolved verbal result`);
  for(let step=0;step<20&&!run.completed&&run.verbalContext;step++){
   const event=getEvent(run),index=event.choices.findIndex(choice=>choice.available!==false);
   assert.ok(index>=0);run=advance(applyChoice(run,index));assert.equal(validRun(run),true,`${route.id}/${event.id}`);
  }
  if(!run.completed){
   assert.equal(run.verbalContext,null,'the finite aftermath returns to the committed meal transition');
   assert.equal(run.eventId,route.outcome==='accepted'?`meal-with-${route.guest}`:before.eventId);
   assert.equal(run.stats.cash,before.stats.cash);assert.equal(run.turn,before.turn);
   assert.equal(run.flags[`meal_invite_${route.guest}_day_${run.turn}`],1);
   if(route.outcome==='declined')assert.equal(getEvent(run).choices.find(choice=>choice.mealTarget===route.guest).available,false);
  }
  assert.deepEqual(replayRun(run.roleId,run.seed,run.actions),run,`${route.id}/verbal replay`);
 }
});

test('rage during every accepted dinner or after paying preserves valid context, committed fees and canonical replay',()=>{
 for(const route of routes.filter(route=>route.outcome==='accepted')){
  const {pending}=invitation(route),meal=advance(pending);
  for(const phase of ['event','result']){
   const source=phase==='event'?meal:applyChoice(meal,0),cash=source.stats.cash;
   let run=requestRage(source);assert.notEqual(run,source,`${route.id}/${phase}`);
   assert.equal(validRun(run),true,`${route.id}/${phase}/pending`);
   run=advance(run);assert.equal(validRun(run),true,`${route.id}/${phase}/advance`);
   if(!run.rageContext){
    assert.equal(run.stats.cash,cash,'an imagined hit neither pays twice nor refunds an already paid dinner');
    if(phase==='event')assert.equal(run.eventId,meal.eventId);
   }
   assert.deepEqual(replayRun(run.roleId,run.seed,run.actions),run,`${route.id}/${phase}/replay`);
  }
 }
});

// A real low-savings warning reached through ordinary actions, including one
// accepted pay cut. No mood, energy, cash, history or RNG value is injected.
const crisisRoute=JSON.parse(readFileSync(new URL('./fixtures/meal-crisis-v34.json',import.meta.url),'utf8'));

test('a low-savings mood crisis can survive a refusal, cancel and reopen, then recover alone without inventing a dinner',()=>{
 let run=replayRun(crisisRoute.roleId,crisisRoute.seed,crisisRoute.actions);
 assert.equal(validRun(run),true);assert.equal(run.eventId,'crisis-mood');
 assert.equal(run.stats.cash,13);assert.equal(run.stats.mood,1);assert.equal(run.stats.energy,14);
 const original=structuredClone(run),resume=run.resumeEventId;
 const choose=effect=>{const index=getEvent(run).choices.findIndex(choice=>choice.effect===effect);assert.ok(index>=0);run=advance(applyChoice(run,index));assert.equal(validRun(run),true);};
 choose('mealOpen');assert.equal(run.mealContext.origin,'crisis-mood');
 const erich=getEvent(run).choices.findIndex(choice=>choice.mealTarget==='erich');assert.equal(getEvent(run).choices[erich].available,true);
 run=applyChoice(run,erich);assert.equal(run.pendingEffect,'mealDeclined');assert.equal(validRun(run),true);
 run=advance(run);assert.equal(validRun(run),true);assert.equal(run.stats.cash,original.stats.cash);
 choose('mealCancel');assert.equal(run.eventId,'crisis-mood');assert.equal(run.mealContext,null);assert.equal(run.resumeEventId,resume);
 choose('mealOpen');assert.equal(getEvent(run).choices.find(choice=>choice.mealTarget==='erich').available,false);
 const solo=getEvent(run).choices.findIndex(choice=>choice.effect==='mealFinish'&&!choice.mealTarget);
 assert.ok(solo>=0);assert.equal(getEvent(run).choices[solo].available,true);
 run=applyChoice(run,solo);assert.equal(validRun(run),true);assert.equal(run.stats.cash,5);assert.ok(run.stats.mood>12);assert.ok(run.stats.energy>15);
 run=advance(run);assert.equal(validRun(run),true);assert.equal(run.completed,false);assert.equal(run.eventId,resume);
 assert.equal(run.mealContext,null);assert.equal(run.resumeEventId,null);assert.equal(run.turn,original.turn);assert.deepEqual(run.pip,original.pip);
 assert.equal(run.flags.spend_solo,1);assert.equal(run.flags.meal_shared||0,original.flags.meal_shared||0);
 assert.deepEqual(replayRun(run.roleId,run.seed,run.actions),run);
});
