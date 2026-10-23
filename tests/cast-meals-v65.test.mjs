import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as E from '../dist/engine.js';
import {CAST_IDS_V65,CAST_PROFILES_V65} from '../dist/cast-v65.js';
import {deriveCharacterStats} from '../dist/character-stats.js';

const {routes}=JSON.parse(readFileSync(new URL('./fixtures/cast-meals-v65.json',import.meta.url),'utf8'));
const row=id=>{const value=routes.find(route=>route.id===id);assert.ok(value,id);return value;};
const replay=(route,actions=route.actions)=>E.replayRun(route.roleId,route.seed,actions);
const sameClock=(after,before)=>{for(const key of ['turn','pay','pip','pipCount'])assert.deepEqual(after[key],before[key],key);};

test('sixty new dinner witnesses come from natural warning gaps and replay exactly without injected wallets or friendship',()=>{
 assert.equal(routes.length,60);
 for(const route of routes){const run=replay(route);assert.equal(E.validRun(run),true,route.id);assert.deepEqual(replay(route),run);assert.equal(E.validRun(JSON.parse(JSON.stringify(run))),true);}
});

test('all six guests can accept or refuse; neither reply nor cancellation charges a meal or consumes a work/PIP day',()=>{
 for(const guest of CAST_IDS_V65)for(const kind of ['accepted','declined','cancelled']){
  const route=row(`${kind}-${guest}`),before=replay(route,route.beforeActions),pending=E.applyChoice(before,route.index),after=E.advance(pending);assert.deepEqual(after,replay(route));assert.deepEqual(pending.stats,before.stats);sameClock(pending,before);sameClock(after,before);assert.equal(after.stats.cash,before.stats.cash);assert.equal(E.validRun(pending),true);assert.deepEqual(E.applyChoice(pending,route.index),pending);assert.deepEqual(deriveCharacterStats(pending),deriveCharacterStats(before));
  if(kind==='accepted'){assert.equal(after.eventId,`meal-with-${guest}`);assert.equal(after.mealContext.page,3);assert.equal(after.mealContext.guest,guest);}
  if(kind==='cancelled'){assert.equal(after.eventId,'self-care');assert.equal(after.mealContext,null);}
  if(kind==='declined'){const index=E.getEvent(after).choices.findIndex(choice=>choice.mealTarget===guest);assert.equal(E.getEvent(after).choices[index].available,false);assert.throws(()=>E.applyChoice(after,index),/Unavailable/);assert.equal(after.mealContext.guest,null);}
 }
});

test('all 36 warm, ordinary and mine reactions charge one visible dinner price and project the matching relationship change',()=>{
 for(const guest of CAST_IDS_V65)for(const reply of [0,1])for(const reaction of ['warm','neutral','mine']){
  const route=row(`paid-${guest}-${reply}-${reaction}`),before=replay(route,route.beforeActions),pending=E.applyChoice(before,reply),after=E.advance(pending),cost=CAST_PROFILES_V65[guest].cost;assert.equal(E.getEvent(before).choices[reply].mealCost,cost);assert.match(E.getEvent(before).choices[reply].text,new RegExp(`${cost} 存款`));assert.equal(pending.stats.cash,before.stats.cash-cost);assert.equal(after.stats.cash,pending.stats.cash);sameClock(after,before);assert.equal(after.mealContext,null);assert.equal(E.validRun(pending),true);assert.deepEqual(E.applyChoice(pending,reply),pending);assert.equal(after.history.at(-1).mealOutcome.target,guest);assert.equal(after.history.at(-1).mealOutcome.reaction,reaction);
  const old=deriveCharacterStats(before).find(character=>character.id===guest),actual=deriveCharacterStats(after).find(character=>character.id===guest);assert.equal(actual.encounters,old.encounters+1);assert.equal(actual.realHits,old.realHits);assert.equal(actual.imaginedHits,old.imaginedHits);if(reaction==='warm')assert.ok(actual.affinityGained>old.affinityGained);if(reaction==='mine')assert.ok(actual.affinityLost>old.affinityLost);if(reaction==='neutral'){assert.equal(actual.affinityGained,old.affinityGained);assert.equal(actual.affinityLost,old.affinityLost);}
 }
});

test('new dinners keep arguments and actual physical aftermath in the private scene rather than silently dismissing the employee',()=>{
 for(const guest of CAST_IDS_V65){
  const route=row(`accepted-${guest}`),run=replay(route);assert.ok(E.getRageTargets(run).includes(guest));assert.ok(E.getVerbalTargets(run).includes(guest));assert.equal(E.getEvent(run).privateContext,true);
  const verbal=E.requestVerbal(run,undefined,2);assert.equal(verbal.pending,true);assert.match(verbal.history.at(-1).choiceText,/下班吃飯|私下安排/);assert.equal(verbal.history.at(-1).speaker,guest);assert.equal(verbal.history.at(-1).verbalOutcome.kind==='personnel',false);assert.equal(E.validRun(verbal),true);assert.deepEqual(E.replayRun(verbal.roleId,verbal.seed,verbal.actions),E.advance(verbal));
  const hit=E.requestRage(run);assert.equal(hit.pending,true);assert.equal(E.validRun(hit),true);assert.equal(hit.history.at(-1).speaker,guest);assert.equal(hit.stats.boss,run.stats.boss);const after=E.advance(hit);assert.equal(after.completed,false);if(hit.rageContext.mode==='real'){assert.equal(after.eventId,'rage-aftermath');assert.equal(E.getEvent(after).scope,'private');}assert.deepEqual(E.replayRun(hit.roleId,hit.seed,hit.actions),after);
 }
});
