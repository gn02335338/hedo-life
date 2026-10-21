import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRun,getEvent,applyChoice,advance,requestBreak,replayRun,validRun} from '../dist/engine.js';
import {deriveCharacterStats} from '../dist/character-stats.js';

const resolve=(run,index)=>advance(applyChoice(run,index));
const routes=JSON.parse(readFileSync(new URL('./fixtures/meal-invitations-v34.json',import.meta.url))).routes;
const replay=route=>replayRun(route.roleId,route.seed,route.actions);

test('all sixteen e34 guests can accept or decline canonical invitations with no fee, workday or relationship reward',()=>{
 for(const route of routes){
  const before=replayRun(route.roleId,route.seed,route.actions.slice(0,-1));
  const action=route.actions.at(-1),choice=getEvent(before).choices[action.index],run=applyChoice(before,action.index);
  assert.equal(run.pending,true);assert.equal(validRun(run),true);
  assert.equal(run.pendingEffect,route.outcome==='accepted'?'mealPick':'mealDeclined',route.id);
  assert.deepEqual(run.stats,before.stats);assert.equal(run.turn,before.turn);assert.deepEqual(run.pip,before.pip);
  assert.notEqual(run.rng,before.rng);assert.deepEqual(deriveCharacterStats(run),deriveCharacterStats(before));
  assert.equal(run.flags[`meal_invite_${route.guest}_day_${run.turn}`],1);
  assert.deepEqual(applyChoice(run,action.index),run,'double activation cannot reroll');
  assert.equal(choice.delta.cash||0,0);assert.ok(run.history.at(-1).result.length>20);
  const next=advance(run);assert.equal(validRun(next),true);assert.deepEqual(replayRun(next.roleId,next.seed,next.actions),next);
  if(route.outcome==='accepted'){
   assert.equal(next.eventId,`meal-with-${route.guest}`);
   const meal=getEvent(next).choices[0],paid=resolve(next,0);
   assert.equal(validRun(paid),true);assert.equal(paid.stats.cash,next.stats.cash-meal.mealCost);
   assert.equal(paid.turn,next.turn);assert.deepEqual(paid.pip,next.pip);assert.equal(paid.mealContext,null);
   assert.deepEqual(replayRun(paid.roleId,paid.seed,paid.actions),paid);
  }else{
   assert.match(next.eventId,/^meal-guests-[ab]$/);assert.equal(next.mealContext.guest,null);
   const again=getEvent(next).choices.findIndex(c=>c.mealTarget===route.guest);
   assert.equal(getEvent(next).choices[again].available,false);assert.throws(()=>applyChoice(next,again),/Unavailable/);
   const page=getEvent(next).choices.findIndex(c=>c.effect==='mealPage');
   const returned=resolve(resolve(next,page),page);
   assert.equal(getEvent(returned).choices[again].available,false,'page changes cannot erase a refusal');
   const cancelled=resolve(returned,getEvent(returned).choices.findIndex(c=>c.effect==='mealCancel'));
   assert.equal(cancelled.eventId,'self-care');assert.equal(cancelled.stats.cash,before.stats.cash);
   const menu=resolve(cancelled,getEvent(cancelled).choices.findIndex(c=>c.effect==='mealOpen'));
   const samePage=menu.mealContext.page===next.mealContext.page?menu:resolve(menu,8);
   assert.equal(getEvent(samePage).choices.find(c=>c.mealTarget===route.guest).available,false,'reopening cannot reroll');
  }
 }
});

test('rejected invitations leave affordable solo recovery available and never consume a PIP day',()=>{
 const route=routes.find(r=>r.outcome==='declined'),menu=replayRun(route.roleId,route.seed,route.actions.slice(0,-1));
 const pip={...menu,pip:{active:true,remaining:2},pipCount:1};
 const rejected=resolve(pip,route.actions.at(-1).index);assert.deepEqual(rejected.pip,pip.pip);
 const care=resolve(rejected,getEvent(rejected).choices.findIndex(c=>c.effect==='mealCancel'));
 const index=getEvent(care).choices.findIndex(c=>c.effect==='finishBreak'&&c.available!==false);
 assert.ok(index>=0);const rested=resolve(care,index);
 assert.equal(validRun(rested),true);assert.equal(rested.turn,care.turn);assert.deepEqual(rested.pip,care.pip);
 assert.ok(rested.stats.mood>=care.stats.mood);
});
