import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {getEvent,applyChoice,advance,replayRun,validRun,requestRage,requestVerbal} from '../dist/engine.js';
import {characterAffinity,characterHistoryChanges,deriveCharacterStats,isMealOutcomeV36} from '../dist/character-stats.js';
import {MEAL_GUEST_IDS_V25,getMealV25} from '../dist/meals-v25.js';
import {mealChatProfileV36,withMealReactionsV36} from '../dist/meal-reactions-v36.js';

const {routes,refusals}=JSON.parse(readFileSync(new URL('./fixtures/meal-reactions-v36.json',import.meta.url),'utf8'));
const clamp=n=>Math.max(0,Math.min(100,n));
const copy=value=>structuredClone(value);
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const rngStep=value=>{let x=value;x^=x<<13;x^=x>>>17;x^=x<<5;return x>>>0||1;};
const resolve=(run,index)=>advance(applyChoice(run,index));
const replay=route=>replayRun(route.roleId,route.seed,route.actions);
const beforeMeal=route=>replayRun(route.roleId,route.seed,route.actions.slice(0,-1));
const reactions=['warm','neutral','mine'];
const label={warm:'聊得很開',neutral:'平常吃飯',mine:'不小心踩雷'};

test('all sixteen guests and both paid replies naturally reach all three seeded table reactions',()=>{
  assert.equal(routes.length,96);
  const covered=new Set();
  for(const route of routes){
    const before=beforeMeal(route),choice=getEvent(before).choices[route.replyIndex],base=getMealV25(before).choices[route.replyIndex];
    assert.equal(before.eventId,`meal-with-${route.guest}`);assert.equal(validRun(before),true);
    const snapshot=copy(before);
    for(let view=0;view<4;view++){
      const event=getEvent(before);assert.equal(event.choices[route.replyIndex].draw.label,'餐桌氣氛');
      assert.deepEqual(mealChatProfileV36(before,route.guest,route.replyIndex),mealChatProfileV36(before,route.guest,route.replyIndex));
      assert.deepEqual(before,snapshot,'rendering and profile reads cannot draw RNG or change history');
    }
    for(const outcome of choice.draw.outcomes){
      assert.equal(outcome.delta.cash,base.delta.cash);assert.equal(outcome.delta.mood,base.delta.mood);
      assert.equal(outcome.delta.energy,base.delta.energy,'a rejected joke cannot take back the meal recovery');
    }
    const oldCharacters=deriveCharacterStats(before),oldAffinity=characterAffinity(before,route.guest).score;
    const paid=applyChoice(before,route.replyIndex),row=paid.history.at(-1),outcome=row.mealOutcome;
    assert.equal(validRun(paid),true,route.id);assert.equal(isMealOutcomeV36(paid,row),true,route.id);
    assert.deepEqual(outcome,{version:1,target:route.guest,replyIndex:route.replyIndex,reaction:route.reaction,affinityDelta:route.affinityDelta});
    assert.equal(row.eventOutcome.label,'餐桌氣氛');assert.equal(row.eventOutcome.result,label[route.reaction]);
    assert.equal(paid.rng,rngStep(before.rng),'only the committed table response consumes one seeded draw');
    assert.equal(paid.stats.cash,before.stats.cash-choice.mealCost);assert.equal(paid.turn,before.turn);assert.deepEqual(paid.pip,before.pip);
    assert.equal(paid.stats.energy,clamp(before.stats.energy+base.delta.energy));
    assert.equal(paid.stats.mood,clamp(before.stats.mood+base.delta.mood),'food recovery remains independent from the relationship reaction, including near caps');
    assert.equal(paid.stats.boss,route.guest==='wing'?clamp(before.stats.boss+route.affinityDelta):before.stats.boss,'other guests do not move remote Wing mood');
    assert.equal(characterAffinity(paid,route.guest).score,clamp(oldAffinity+route.affinityDelta));
    const change=characterHistoryChanges(paid).filter(item=>item.historyIndex===paid.history.length-1);
    assert.equal(change.length,1);assert.equal(change[0].id,route.guest);
    assert.equal(change[0].affinityDelta,clamp(oldAffinity+route.affinityDelta)-oldAffinity);
    assert.equal(change[0].realHits+change[0].imaginedHits,0);
    const characters=deriveCharacterStats(paid);
    for(const id of MEAL_GUEST_IDS_V25){
      const previous=oldCharacters.find(item=>item.id===id),actual=characters.find(item=>item.id===id);
      if(id===route.guest)assert.equal(actual.encounters,previous.encounters+1);
      else assert.deepEqual(actual,previous,`${route.id}: an absent person's relationship must not change`);
    }
    assert.deepEqual(applyChoice(paid,route.replyIndex),paid,'pending duplicate clicks cannot reroll or pay twice');
    const continued=advance(paid);assert.equal(validRun(continued),true);assert.equal(continued.mealContext,null);
    assert.equal(continued.rng,paid.rng);assert.deepEqual(replay(route),continued);assert.equal(hash(continued),route.stateHash);
    covered.add(`${route.guest}/${route.replyIndex}/${route.reaction}`);
  }
  assert.equal(covered.size,96);
  for(const id of MEAL_GUEST_IDS_V25)for(const reply of [0,1])for(const reaction of reactions)assert.ok(covered.has(`${id}/${reply}/${reaction}`));
});

test('unpaid cancel, rejected invitations and solo food never invent a table reaction or an affinity reward',()=>{
  assert.equal(refusals.length,16);
  for(const route of refusals){
    const before=replayRun(route.roleId,route.seed,route.actions.slice(0,-1));
    const pending=applyChoice(before,route.actions.at(-1).index),menu=advance(pending);
    assert.equal(pending.pendingEffect,'mealDeclined');assert.equal(pending.history.at(-1).mealOutcome,undefined);
    assert.deepEqual(menu.stats,before.stats);assert.deepEqual(deriveCharacterStats(menu),deriveCharacterStats(before));
    assert.equal(hash(menu),route.stateHash);
    const again=getEvent(menu).choices.findIndex(c=>c.mealTarget===route.guest);
    assert.equal(getEvent(menu).choices[again].available,false);assert.throws(()=>applyChoice(menu,again),/Unavailable/);
    const cancelIndex=getEvent(menu).choices.findIndex(c=>c.effect==='mealCancel');
    const cancelled=resolve(menu,cancelIndex);assert.equal(cancelled.rng,menu.rng);assert.deepEqual(cancelled.stats,menu.stats);
    assert.deepEqual(deriveCharacterStats(cancelled),deriveCharacterStats(menu));assert.equal(cancelled.history.at(-1).mealOutcome,undefined);
    const soloIndex=getEvent(menu).choices.findIndex(c=>c.effect==='mealFinish'&&!c.mealTarget);
    const solo=resolve(menu,soloIndex);assert.equal(validRun(solo),true);assert.equal(solo.rng,menu.rng);
    assert.equal(solo.stats.cash,menu.stats.cash-8);assert.ok(solo.stats.mood>=menu.stats.mood);
    assert.deepEqual(deriveCharacterStats(solo),deriveCharacterStats(menu));assert.equal(solo.history.at(-1).mealOutcome,undefined);
  }
  for(const id of MEAL_GUEST_IDS_V25){
    const route=routes.find(row=>row.guest===id),before=beforeMeal(route),cancelIndex=getEvent(before).choices.findIndex(c=>c.effect==='mealCancel');
    const cancelled=resolve(before,cancelIndex);
    assert.equal(cancelled.rng,before.rng);assert.deepEqual(cancelled.stats,before.stats);assert.equal(cancelled.mealContext,null);
    assert.equal(cancelled.history.at(-1).mealOutcome,undefined);assert.deepEqual(deriveCharacterStats(cancelled),deriveCharacterStats(before));
    assert.deepEqual(replayRun(cancelled.roleId,cancelled.seed,cancelled.actions),cancelled);
  }
});

test('meal affinity clamps to its own 0–100 score and ignores incidental trust, weather, supplied totals and remote boss deltas',()=>{
  for(const guest of MEAL_GUEST_IDS_V25){
    const route=routes.find(row=>row.guest===guest&&row.reaction==='warm');
    const actual=applyChoice(beforeMeal(route),route.replyIndex),original=actual.history.at(-1);
    const positive=copy(original),negative=copy(original),neutral=copy(original);
    positive.mealOutcome={...positive.mealOutcome,reaction:'warm',affinityDelta:12};positive.eventOutcome.result=label.warm;
    negative.mealOutcome={...negative.mealOutcome,reaction:'mine',affinityDelta:-12};negative.eventOutcome.result=label.mine;
    neutral.mealOutcome={...neutral.mealOutcome,reaction:'neutral',affinityDelta:0};neutral.eventOutcome.result=label.neutral;
    // Projection-only boundary evidence; these rows are not gameplay witnesses
    // and are never sent to the server as a fabricated action replay.
    const boundary={seed:route.seed,history:[...Array.from({length:6},()=>copy(positive)),copy(negative),copy(neutral)]};
    assert.equal(characterAffinity(boundary,guest).score,88);
    const changes=characterHistoryChanges(boundary);assert.deepEqual(changes.map(row=>row.affinityDelta),[12,12,12,12,2,0,-12,0]);
    const floor={seed:route.seed,history:[...Array.from({length:6},()=>copy(negative)),copy(positive)]};
    assert.equal(characterAffinity(floor,guest).score,12);
    assert.deepEqual(characterHistoryChanges(floor).map(row=>row.affinityDelta),[-12,-12,-12,-12,-2,0,12]);
    const altered=copy(actual),row=altered.history.at(-1);
    row.delta.trust=-100;row.delta.boss=100;row.weather={delta:100,text:'unrelated weather'};
    row.breakdown=[{source:'choice',label:'unrelated team trust',delta:{trust:-100,boss:100}},{source:'weather',label:'unrelated mood',delta:{boss:100}}];
    altered.characters=[{id:guest,affinityGained:9999,affinityLost:0}];altered.stats.trust=0;altered.stats.boss=100;
    assert.deepEqual(deriveCharacterStats(altered),deriveCharacterStats(actual),'explicit meal response outranks all unrelated counters');
  }
});

test('familiarity, affinity, target sensitivity and chosen topic influence probabilities without guaranteeing a response',()=>{
  for(const guest of MEAL_GUEST_IDS_V25)for(const replyIndex of [0,1]){
    const route=routes.find(row=>row.guest===guest&&row.replyIndex===replyIndex&&row.reaction==='warm'),cold=beforeMeal(route);
    const row=applyChoice(cold,replyIndex).history.at(-1),friendly=copy(cold);
    friendly.history=[...cold.history,...Array.from({length:6},()=>copy(row))];
    const original=mealChatProfileV36(cold,guest,replyIndex),close=mealChatProfileV36(friendly,guest,replyIndex);
    assert.ok(close.warmChance>original.warmChance);assert.ok(close.mineChance<original.mineChance);
    for(const profile of [original,close]){
      assert.ok(Math.abs(profile.warmChance+profile.neutralChance+profile.mineChance-1)<1e-10);
      assert.ok(profile.warmChance>0&&profile.neutralChance>0&&profile.mineChance>0);
      assert.ok(profile.warmChance<1&&profile.mineChance<1);assert.ok(typeof profile.topic==='string'&&profile.topic.length>0);
    }
  }
  const wing=beforeMeal(routes.find(row=>row.guest==='wing'));
  assert.ok(mealChatProfileV36(wing,'wing',1).mineChance>mealChatProfileV36(wing,'wing',0).mineChance);
  const erich=beforeMeal(routes.find(row=>row.guest==='erich'));
  assert.ok(mealChatProfileV36(erich,'erich',1).mineChance<mealChatProfileV36(wing,'wing',1).mineChance);
  assert.throws(()=>mealChatProfileV36(wing,'unknown',0));assert.throws(()=>mealChatProfileV36(wing,'wing',2));
});

test('malformed or misplaced meal outcomes cannot validate or fabricate relationships',()=>{
  const route=routes.find(row=>row.guest==='jack'&&row.reaction==='mine'),before=beforeMeal(route),paid=applyChoice(before,route.replyIndex),row=paid.history.at(-1);
  assert.equal(validRun(paid),true);
  const variants=[undefined,null,{}, {...row.mealOutcome,target:'wing'}, {...row.mealOutcome,replyIndex:2}, {...row.mealOutcome,affinityDelta:13}, {...row.mealOutcome,affinityDelta:0}, {...row.mealOutcome,reaction:'secret'}, {...row.mealOutcome,version:2}, {...row.mealOutcome,extra:true}];
  for(const mealOutcome of variants){
    const altered=copy(paid);altered.history.at(-1).mealOutcome=mealOutcome;
    assert.equal(validRun(altered),false,JSON.stringify(mealOutcome));
    assert.equal(isMealOutcomeV36(altered,altered.history.at(-1)),false);
  }
  for(const mutate of [row=>row.choiceIndex=2,row=>row.speaker='wing',row=>row.eventId='self-care',row=>row.kind='daily']){
    const altered=copy(paid);mutate(altered.history.at(-1));assert.equal(validRun(altered),false);
  }
  const cancel=applyChoice(before,2);cancel.history.at(-1).mealOutcome=copy(row.mealOutcome);assert.equal(validRun(cancel),false);
  const old=copy(paid);old.seed=old.seed.replace(/^e36-/,'e35-');assert.equal(isMealOutcomeV36(old,old.history.at(-1)),false);
  const legacy=getMealV25({...before,seed:old.seed});assert.deepEqual(withMealReactionsV36(legacy,{...before,seed:old.seed}),legacy);
});

test('interrupting an already paid meal preserves its sampled reaction, fee and replay instead of drawing a second table result',()=>{
  for(const guest of MEAL_GUEST_IDS_V25){
    const route=routes.find(row=>row.guest===guest&&row.reaction==='mine'),paid=applyChoice(beforeMeal(route),route.replyIndex),original=copy(paid.history.at(-1).mealOutcome);
    for(const type of ['rage','verbal']){
      let run=type==='rage'?requestRage(paid):requestVerbal(paid,undefined,2);
      assert.notEqual(run,paid,`${guest}/${type}`);assert.equal(validRun(run),true);
      run=advance(run);assert.equal(validRun(run),true,`${guest}/${type}/advance`);
      assert.deepEqual(run.history.find(row=>row.mealOutcome)?.mealOutcome,original);
      assert.equal(run.history.filter(row=>row.mealOutcome).length,1);assert.equal(run.stats.cash,paid.stats.cash);
      assert.deepEqual(replayRun(run.roleId,run.seed,run.actions),run,`${guest}/${type}/replay`);
    }
  }
});
