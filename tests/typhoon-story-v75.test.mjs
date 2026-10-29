import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../dist/engine.js';
import {ROLE_MAP} from '../dist/roles.js';
import {isLifeV75,TYPHOON_STORY_V75} from '../dist/typhoon-story-v75.js';
import {hiddenStoryCountV66,hiddenStoryV66} from '../dist/hidden-stories-v66.js';
import {getHiddenEncounterEventV45,resolveHiddenEncounterChoiceV45} from '../dist/hidden-encounter-v45.js';
import {characterBookHTML} from '../dist/character-book.js';
import {validateCompletion} from '../worker/http.js';

// A naturally reached current-profile prefix: no supplied scene, outcomes,
// stats or random state are needed to enter the new warehouse-store encounter.
const witness={roleId:'system',seed:'e39-r75-n-00000000000000000000f3',actions:[
 {type:'activity-schedule',version:1},
 {type:'choice',eventId:'onboarding',index:0},
 {type:'choice',eventId:'professor37-notebook-server',index:0}
]};
const source=()=>E.replayRun(witness.roleId,witness.seed,witness.actions);
const open=()=>E.requestHiddenEncounter(source());
const clone=value=>JSON.parse(JSON.stringify(value));

test('the warehouse encounter is appended only to strict current lives, with both people actually present',()=>{
 assert.equal(isLifeV75(witness.seed),true);assert.equal(isLifeV75({seed:witness.seed}),true);
 for(const seed of [witness.seed.replace('r75','r74'),witness.seed.replace('r75','r76'),witness.seed+'a',witness.seed.toUpperCase()])assert.equal(isLifeV75(seed),false);
 const run=open(),event=E.getEvent(run);
 assert.equal(E.canRequestHiddenEncounter(source()),true);
 assert.equal(run.hiddenEncounterContext.scene,31);assert.equal(event.id,'hidden45-31-0');
 assert.equal(hiddenStoryCountV66(run),32);assert.equal(hiddenStoryV66(run,31),TYPHOON_STORY_V75);
 assert.equal(hiddenStoryCountV66({seed:witness.seed.replace('r75','r74')}),31);
 assert.equal(hiddenStoryV66({seed:witness.seed.replace('r75','r74')},31),undefined);
 assert.deepEqual(event.participants,['hidden-visitor','wing']);
 assert.match(event.body,/颱風假/);assert.match(event.body,/好市多/);assert.match(event.body,/翅膀和魚酥姐/);
 assert.match(event.body,/年終考績和履歷/);assert.match(event.body,/不知道私人關係/);
 assert.ok(event.choices[2].wild);
 assert.ok(event.choices.every(choice=>!choice.result));
 assert.doesNotMatch(characterBookHTML(),/魚酥|好市多|hidden-visitor/);
});

test('all three replies reveal their own consequence once and resume the same unanswered work',()=>{
 for(const index of [0,1,2]){
  const before=source(),run=open(),event=E.getEvent(run),pending=E.applyChoice(run,index),row=pending.history.at(-1);
  assert.equal(row.choiceText,event.choices[index].text);
  assert.equal(row.result,TYPHOON_STORY_V75.choices[index].result);
  assert.equal(row.hiddenOutcome.mode,'normal');assert.equal(row.hiddenOutcome.done,true);
  assert.equal(pending.turn,before.turn);assert.equal(pending.pay,before.pay);
  assert.deepEqual(pending.pip,before.pip);assert.equal(pending.stats.boss,before.stats.boss);
  assert.equal(E.applyChoice(pending,index),pending);assert.equal(E.validRun(clone(pending)),true);
  assert.doesNotThrow(()=>validateCompletion({runId:'21212121-2121-4212-8212-212121212121',roleId:pending.roleId,seed:pending.seed,actions:pending.actions},ROLE_MAP));
  const returned=E.advance(clone(pending));
  assert.equal(returned.hiddenEncounterContext,undefined);assert.equal(returned.eventId,before.eventId);
  assert.equal(returned.turn,before.turn);assert.equal(returned.completed,false);
  assert.equal(E.requestHiddenEncounter(returned),returned);
  assert.deepEqual(E.replayRun(returned.roleId,returned.seed,returned.actions),returned);
  const forged=clone(pending);forged.history.at(-1).result+=' 私人關係已獲證實。';assert.equal(E.validRun(forged),false);
 }
});

test('speech, imaginary violence and a real incident retain warehouse-specific consequences',()=>{
 const run=open();
 const speech=resolveHiddenEncounterChoiceV45(run,3,.99),dream=resolveHiddenEncounterChoiceV45(run,4,.99),real=resolveHiddenEncounterChoiceV45(run,4,0);
 assert.equal(speech.incident,'verbal');assert.match(speech.result,/賣場人員/);
 assert.equal(dream.mode,'imagined');assert.equal(dream.done,true);assert.match(dream.result,/只是想像/);
 assert.equal(real.mode,'real');assert.equal(real.done,false);assert.match(real.result,/推車/);
 for(const incident of ['real','verbal']){
  const aftermath={...run,hiddenEncounterContext:{...run.hiddenEncounterContext,stage:1,incident}};
  const event=getHiddenEncounterEventV45(aftermath);assert.match(event.title,/賣場/);
  for(const index of [0,1,2]){
   const resolved=resolveHiddenEncounterChoiceV45(aftermath,index,.5);
   assert.equal(resolved.done,true);assert.equal(resolved.mode,'aftermath');
   assert.doesNotMatch(resolved.result,/自動.*離職|證明.*外遇/);
  }
 }
});
