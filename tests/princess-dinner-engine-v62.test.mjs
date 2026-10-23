import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as E from '../dist/engine.js';
import {deriveCharacterStats} from '../dist/character-stats.js';

const {routes}=JSON.parse(readFileSync(new URL('./fixtures/princess-dinner-v62.json',import.meta.url),'utf8'));
const row=id=>{const value=routes.find(route=>route.id===id);assert.ok(value,id);return value;};
const replay=(route,actions=route.actions)=>E.replayRun(route.roleId,route.seed,actions);
const unchangedClock=(after,before)=>{assert.equal(after.turn,before.turn);assert.equal(after.pay,before.pay);assert.deepEqual(after.pip,before.pip);assert.equal(after.pipCount,before.pipCount);};

test('eleven natural r62 Princess meal routes reload and replay exactly, including each conversation outcome',()=>{
 assert.equal(routes.length,11);
 for(const route of routes){
  const run=replay(route);assert.equal(E.validRun(run),true,route.id);assert.equal(E.validRun(JSON.parse(JSON.stringify(run))),true,route.id);assert.deepEqual(replay(route),run,route.id);
  if(route.beforeActions){const before=replay(route,route.beforeActions),pending=E.applyChoice(before,route.index);assert.equal(pending.pending,true);assert.equal(E.validRun(pending),true);assert.deepEqual(E.applyChoice(pending,route.index),pending,'a result cannot be charged or rerolled twice');assert.deepEqual(E.advance(JSON.parse(JSON.stringify(pending))),run);assert.deepEqual(E.advance(run),run,'continuing a settled result is idempotent');}
 }
});

test('accepted and declined Princess invitations remain free and do not consume work or PIP time; cancellation stays free',()=>{
 for(const id of ['accepted','declined','cancelled']){
  const route=row(id),before=replay(route,route.beforeActions),pending=E.applyChoice(before,route.index),after=replay(route);unchangedClock(pending,before);unchangedClock(after,before);assert.deepEqual(pending.stats,before.stats);assert.deepEqual(deriveCharacterStats(pending),deriveCharacterStats(before));assert.equal(after.stats.cash,before.stats.cash);
  if(id==='accepted'){assert.equal(pending.pendingEffect,'mealPick');assert.equal(after.mealContext.guest,'princess');}
  if(id==='cancelled'){assert.equal(after.eventId,'self-care');assert.equal(after.mealContext,null);}
  if(id==='declined'){
   assert.equal(pending.pendingEffect,'mealDeclined');assert.equal(after.mealContext.guest,null);const index=E.getEvent(after).choices.findIndex(choice=>choice.mealTarget==='princess');assert.equal(E.getEvent(after).choices[index].available,false);assert.throws(()=>E.applyChoice(after,index),/Unavailable/);
  }
 }
});

test('both table responses charge exactly 52 once for warm, neutral and mine reactions, preserving their canonical relationship result',()=>{
 for(const index of [0,1])for(const reaction of ['warm','neutral','mine']){
  const route=row(`paid-${index}-${reaction}`),before=replay(route,route.beforeActions),pending=E.applyChoice(before,index),after=replay(route);assert.equal(before.eventId,'meal-with-princess');assert.equal(pending.stats.cash,before.stats.cash-52);assert.equal(after.stats.cash,pending.stats.cash);assert.equal(pending.history.at(-1).delta.cash,-52);unchangedClock(pending,before);unchangedClock(after,before);assert.equal(after.mealContext,null);assert.equal(after.history.at(-1).mealOutcome.reaction,reaction);assert.equal(after.history.at(-1).mealOutcome.replyIndex,index);
  const old=deriveCharacterStats(before).find(character=>character.id==='princess'),actual=deriveCharacterStats(after).find(character=>character.id==='princess');assert.equal(actual.encounters,old.encounters+1);if(reaction==='mine')assert.ok(actual.affinityLost>old.affinityLost);if(reaction==='warm')assert.ok(actual.affinityGained>old.affinityGained);
 }
});

test('a genuinely low-wallet menu cannot force an expensive invitation or invent a paid dinner',()=>{
 const route=row('poor-menu'),before=replay(route),choice=E.getEvent(before).choices[route.invitationIndex];assert.ok(before.stats.cash<52);assert.equal(choice.mealCost,52);assert.equal(choice.available,false);assert.throws(()=>E.applyChoice(before,route.invitationIndex),/Unavailable/);
 for(const action of [{type:'choice',eventId:before.eventId,index:route.invitationIndex},{type:'choice',eventId:'meal-with-princess',index:0}])assert.throws(()=>replay(route,[...route.actions,action]));
});

test('the explicit 52-wallet arithmetic boundary reaches zero and the existing broke story, never negative cash or a free meal',()=>{
 // Deliberate local arithmetic boundary, not a canonical route: the natural
 // fixture has no injected wallet or RNG, and validRun rejects this mutation.
 const accepted=row('accepted'),boundary=structuredClone(replay(accepted));boundary.stats.cash=52;assert.equal(E.validRun(boundary),false);assert.equal(E.getEvent(boundary).choices[0].available,true);
 const pending=E.applyChoice(boundary,0),after=E.advance(pending);assert.equal(pending.stats.cash,0);assert.equal(pending.history.at(-1).delta.cash,-52);assert.equal(after.stats.cash,0);assert.equal(after.chapterContext.family,'broke');assert.equal(after.eventId,'chapter-resolution');unchangedClock(after,boundary);assert.equal(E.validRun(pending),false,'the boundary mutation must never be accepted as a canonical save');
 boundary.stats.cash=51;assert.equal(E.getEvent(boundary).choices[0].available,false);assert.throws(()=>E.applyChoice(boundary,0),/Unavailable/);
});
