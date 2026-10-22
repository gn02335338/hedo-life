import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {PERSONAS,displayText} from '../dist/persona.js';
import {PROFESSOR_EVENTS_V37} from '../dist/events-professor-v37.js';
import {getEvent,applyChoice,advance,replayRun,validRun,getRageTargets,getVerbalTargets,getVerbalLine,requestRage,requestVerbal} from '../dist/engine.js';
import {deriveCharacterStats,characterAffinity,characterHistoryChanges} from '../dist/character-stats.js';
import {MEAL_GUEST_IDS_V25} from '../dist/meals-v25.js';
import {MEAL_GUEST_IDS_V37,MEAL_EVENTS_V37,mealPageIdV37,getMealEventV37,professorInvitationProfileV37,professorMealChatProfileV37} from '../dist/professor-v37.js';
import {rageTargetForV37} from '../dist/rage-v37.js';
import {verbalSceneLine} from '../dist/verbal-scene-copy.js';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/professor-v37.json',import.meta.url),'utf8'));
const resolve=(run,index)=>advance(applyChoice(run,index));
const replay=route=>replayRun(route.roleId,route.seed,route.actions);
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const stat=run=>deriveCharacterStats(run).find(row=>row.id==='professor');
const before=route=>replayRun(route.roleId,route.seed,route.beforeActions);
const chooseEffect=(run,effect)=>{const index=getEvent(run).choices.findIndex(c=>c.effect===effect&&c.available!==false);assert.ok(index>=0,effect);return resolve(run,index);};

test('all thirty professor scenes have natural replayable encounters and name mentions never create an absent target',()=>{
  assert.equal(PERSONAS.professor.name,'林澤教授');assert.equal(MEAL_GUEST_IDS_V37.length,17);
  assert.deepEqual(MEAL_GUEST_IDS_V37.slice(0,16),MEAL_GUEST_IDS_V25);assert.equal(PROFESSOR_EVENTS_V37.length,30);
  assert.equal(fixture.scenes.length,30);const ids=new Set();
  for(const route of fixture.scenes){
    const source=before(route),event=getEvent(source),run=replay(route);ids.add(event.id);
    assert.equal(event.speaker,'professor');assert.equal(event.minRules,37);assert.equal(validRun(source),true);assert.equal(validRun(run),true);
    assert.ok(getRageTargets(source).includes('professor'));assert.ok(getVerbalTargets(source).includes('professor'));
    assert.match(getVerbalLine(source),/林澤教授/);assert.ok(event.choices.some(c=>c.wild));
    assert.equal(stat(run).encounters,stat(source).encounters+1);assert.equal(hash(run),route.stateHash);
    assert.equal(stat(run).realHits+stat(run).imaginedHits,stat(source).realHits+stat(source).imaginedHits);
  }
  assert.equal(ids.size,30);
  assert.equal(rageTargetForV37({id:'advisor-application-progress',speaker:'wing',body:'翅膀提到林澤教授'}),'wing');
  assert.equal(rageTargetForV37({id:'remote-message',speaker:'self',body:'林澤教授回覆今天不在'}),null);
});

test('new lives have a free three-page cycle while old lives retain two pages and no phantom professor encounters',()=>{
  const meal=before(fixture.meals[0]),menu=replayRun(meal.roleId,meal.seed,fixture.accepted.actions.slice(0,-1));
  assert.equal(menu.eventId,'meal-guests-c');assert.equal(menu.mealContext.page,2);
  assert.deepEqual([0,1,2,3].map(mealPageIdV37),['meal-guests-a','meal-guests-b','meal-guests-c',null]);
  const snapshot=structuredClone(menu),event=getEvent(menu);getMealEventV37(menu);getVerbalLine(menu);
  assert.deepEqual(menu,snapshot,'rendering never spends or draws');assert.equal(event.choices.length,4);
  assert.equal(getRageTargets(menu).length,0);assert.deepEqual(getVerbalTargets(menu),['self']);
  const line=verbalSceneLine({event,target:'self',run:menu});assert.doesNotMatch(line,/「翻到/);assert.match(line,/吃|便當/);
  const a=chooseEffect(menu,'mealPage'),b=chooseEffect(a,'mealPage'),c=chooseEffect(b,'mealPage');
  assert.equal(a.eventId,'meal-guests-a');assert.equal(b.eventId,'meal-guests-b');assert.equal(c.eventId,'meal-guests-c');
  for(const page of [a,b,c]){assert.equal(validRun(page),true);assert.equal(page.rng,menu.rng);assert.deepEqual(page.stats,menu.stats);assert.equal(page.turn,menu.turn);assert.deepEqual(deriveCharacterStats(page),deriveCharacterStats(menu));}
  const legacy=JSON.parse(readFileSync(new URL('./fixtures/meal-reactions-v36.json',import.meta.url),'utf8')).routes[0];
  let old=replayRun(legacy.roleId,legacy.seed,legacy.actions.slice(0,-2));
  if(old.eventId==='meal-guests-a')old=chooseEffect(old,'mealPage');
  assert.equal(old.eventId,'meal-guests-b');assert.equal(getEvent(old).choices.find(c=>c.effect==='mealPage').mealPage,0);
  assert.equal(stat(old).encounters,0);assert.throws(()=>getMealEventV37(old));
});

test('professor invitations can accept or refuse without a fee and the same-day answer cannot be rerolled',()=>{
  for(const route of [fixture.accepted,fixture.declined]){
    const menu=replayRun(route.roleId,route.seed,route.actions.slice(0,-1)),pending=applyChoice(menu,0),run=advance(pending);
    assert.equal(validRun(run),true);assert.equal(hash(run),route.stateHash);assert.deepEqual(run.stats,menu.stats);
    assert.equal(run.turn,menu.turn);assert.deepEqual(run.pip,menu.pip);assert.deepEqual(deriveCharacterStats(run),deriveCharacterStats(menu));
    assert.equal(getRageTargets(pending).length,0,'a message is not a physical appearance');
    if(run.eventId==='meal-guests-c'){
      assert.equal(getEvent(run).choices[0].available,false);assert.throws(()=>applyChoice(run,0),/Unavailable/);
      const cycle=chooseEffect(chooseEffect(chooseEffect(run,'mealPage'),'mealPage'),'mealPage');assert.equal(getEvent(cycle).choices[0].available,false);
    }else assert.equal(run.eventId,'meal-with-professor');
  }
  const rejected=replay(fixture.declined),solo=chooseEffect(rejected,'mealFinish'),cancelled=chooseEffect(rejected,'mealCancel');
  assert.equal(solo.rng,rejected.rng);assert.equal(solo.stats.cash,rejected.stats.cash-8);assert.ok(solo.stats.mood>=rejected.stats.mood);
  assert.equal(cancelled.rng,rejected.rng);assert.deepEqual(cancelled.stats,rejected.stats);
  assert.deepEqual(deriveCharacterStats(solo),deriveCharacterStats(rejected));assert.deepEqual(deriveCharacterStats(cancelled),deriveCharacterStats(rejected));
});

test('both professor dinner replies reach warm, neutral and landmine outcomes without moving remote Wing mood or changing the meal recovery',()=>{
  assert.equal(fixture.meals.length,6);const covered=new Set();
  for(const route of fixture.meals){
    const source=before(route),choice=getEvent(source).choices[route.replyIndex],pending=applyChoice(source,route.replyIndex),run=advance(pending),row=pending.history.at(-1);
    assert.equal(row.mealOutcome.target,'professor');assert.equal(row.mealOutcome.reaction,route.reaction);assert.equal(row.mealOutcome.replyIndex,route.replyIndex);
    assert.equal(validRun(pending),true);assert.equal(validRun(run),true);assert.equal(hash(run),route.stateHash);
    assert.equal(run.stats.cash,source.stats.cash-18);assert.equal(run.stats.boss,source.stats.boss);assert.equal(run.turn,source.turn);assert.deepEqual(run.pip,source.pip);
    assert.equal(run.stats.mood,Math.min(100,source.stats.mood+choice.delta.mood));assert.equal(run.stats.energy,Math.min(100,source.stats.energy+choice.delta.energy));
    assert.equal(characterAffinity(run,'professor').score,Math.max(0,Math.min(100,characterAffinity(source,'professor').score+row.mealOutcome.affinityDelta)));
    assert.equal(stat(run).encounters,stat(source).encounters+1);assert.equal(run.mealContext,null);
    assert.deepEqual(applyChoice(pending,route.replyIndex),pending);covered.add(`${route.replyIndex}/${route.reaction}`);
    const cancelled=chooseEffect(source,'mealCancel');assert.deepEqual(cancelled.stats,source.stats);assert.equal(cancelled.rng,source.rng);assert.deepEqual(deriveCharacterStats(cancelled),deriveCharacterStats(source));
    const bad=structuredClone(run);bad.history.findLast(row=>row.mealOutcome).mealOutcome.target='wing';assert.equal(validRun(bad),false);
  }
  assert.equal(covered.size,6);
  const source=before(fixture.meals.find(row=>row.reaction==='warm')),friendly=structuredClone(source);
  const warm=applyChoice(source,0).history.at(-1);friendly.history.push(...Array.from({length:4},()=>structuredClone(warm)));
  assert.ok(professorInvitationProfileV37(friendly).acceptChance>professorInvitationProfileV37(source).acceptChance);
  assert.ok(professorMealChatProfileV37(friendly,0).warmChance>professorMealChatProfileV37(source,0).warmChance);
  assert.ok(professorMealChatProfileV37(source,1).mineChance>professorMealChatProfileV37(source,0).mineChance);
});

test('professor imaginary and real hits remain separate at daily and meal event/result timings and never charge a second dinner',()=>{
  assert.equal(fixture.rages.length,8);
  for(const route of fixture.rages){
    let source=before(route);if(route.phase==='result')source=applyChoice(source,0);
    const pending=requestRage(source),run=advance(pending),row=pending.history.at(-1);assert.equal(validRun(pending),true);assert.equal(validRun(run),true);
    assert.equal(row.speaker,'professor');assert.equal(pending.rageContext.mode,route.mode);assert.equal(hash(run),route.stateHash);
    const prior=stat(source),next=stat(run);assert.equal(next.imaginedHits-prior.imaginedHits,route.mode==='imagined'?1:0);assert.equal(next.realHits-prior.realHits,route.mode==='real'?1:0);
    assert.deepEqual(replay(route),run);
    if(route.origin==='meal'){
      assert.equal(run.stats.cash,source.stats.cash);assert.equal(run.turn,source.turn);
      assert.equal(run.history.filter(row=>row.mealOutcome).length,route.phase==='result'?1:0);
      if(route.mode==='imagined')assert.equal(run.eventId,route.phase==='result'?source.breakReturnEventId:'meal-with-professor');
    }
    assert.deepEqual(characterHistoryChanges(run).filter(change=>change.historyIndex===pending.history.length-1).map(change=>change.id),['professor']);
  }
});

test('spoken professor insults have scene-specific lines and canonical target affinity at all six outcomes and both timings',()=>{
  assert.equal(fixture.verbals.length,24);
  for(const route of fixture.verbals){
    let source=before(route);if(route.phase==='result')source=applyChoice(source,0);
    const line=getVerbalLine(source);assert.match(line,/林澤教授/);
    const pending=requestVerbal(source,undefined,2),run=advance(pending);assert.equal(validRun(pending),true);assert.equal(validRun(run),true);
    assert.equal(pending.history.at(-1).verbalOutcome.target,'professor');assert.equal(pending.history.at(-1).verbalOutcome.kind,route.outcome);
    assert.equal(hash(run),route.stateHash);assert.deepEqual(replay(route),run);assert.equal(stat(run).realHits+stat(run).imaginedHits,stat(source).realHits+stat(source).imaginedHits);
    assert.equal(run.history.filter(row=>row.mealOutcome).length,route.origin==='meal'&&route.phase==='result'?1:0);
    if(route.origin==='meal')assert.equal(run.stats.cash,source.stats.cash);
  }
  const source=before(fixture.meals[0]),oldRun={seed:'e36-prof-not-present'};
  assert.notEqual(verbalSceneLine({event:getEvent(source),target:'professor',run:source}),verbalSceneLine({event:getEvent(source),target:'professor',run:oldRun}));
  assert.equal(MEAL_EVENTS_V37.includes('meal-guests-c'),true);
  for(const phase of ['event','result']){
    const lines=fixture.scenes.map(route=>{let run=before(route);if(phase==='result')run=applyChoice(run,0);return getVerbalLine(run);});
    assert.equal(new Set(lines).size,30,`${phase}: each professor story needs its own spoken response`);
  }
});

test('the original spoken-action protocol also recognizes the professor without falling back to insulting air',()=>{
  const source=before(fixture.scenes[0]),pending=requestVerbal(source),row=pending.history.at(-1);
  assert.equal(validRun(pending),true);assert.equal(row.speaker,'professor');assert.equal(row.verbalOutcome.target,'professor');
  assert.match(displayText(row.result),/林老師/);assert.doesNotMatch(row.result,/空氣沒有回覆|四周卻沒有你正在對話的人/);
  const run=advance(pending);assert.equal(validRun(run),true);assert.deepEqual(replayRun(run.roleId,run.seed,run.actions),run);
  assert.equal(stat(run).realHits+stat(run).imaginedHits,stat(source).realHits+stat(source).imaginedHits);
});
