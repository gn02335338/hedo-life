import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as E from '../dist/engine.js';
import {PERSONAS,displayPersona} from '../dist/persona.js';
import {CAST_IDS_V65,CAST_PROFILES_V65,isCastV65} from '../dist/cast-v65.js';
import {CAST_EVENTS_V65} from '../dist/events-cast-v65.js';
import {getMealEventV65,castInvitationProfileV65,castMealChatProfileV65,mealPageIdV65} from '../dist/meals-cast-v65.js';
import {getMealEventV39} from '../dist/meals-cast-v39.js';
import {getRageV65} from '../dist/rage-cast-v65.js';
import {castVerbalLineV65,castVerbalReactionsV65,withCastVerbalScenarioV65} from '../dist/verbal-cast-v65.js';
import {characterHistoryChanges,deriveCharacterStats,isMealOutcomeV36} from '../dist/character-stats.js';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/expansion-v65.json',import.meta.url),'utf8'));
const source=id=>{const row=fixture.routes.find(row=>row.id===`cast-${id}`);assert.ok(row,id);return E.replayRun(row.roleId,row.seed,row.actions);};
const meal=(profile=65,id=null,page=3)=>({seed:`e39-r${profile}-n-${'a'.repeat(22)}`,actualRoleId:'project',roleId:'project',rank:1,turn:5,stats:{cash:70,mood:60,energy:60,trust:50,boss:50},flags:{},history:[],eventId:id?`meal-with-${id}`:`meal-guests-${['a','b','c','d'][page]}`,mealContext:{origin:'self-care',page,guest:id}});

test('six public neutral cards and 48 distinct fictional scenes carry their own voices, three replies, job differences and scene art',()=>{
 assert.deepEqual(CAST_IDS_V65,['zoe','action','hester','simon','james','johnny']);assert.equal(CAST_EVENTS_V65.length,48);assert.equal(new Set(CAST_EVENTS_V65.map(event=>event.id)).size,48);assert.equal(new Set(CAST_EVENTS_V65.map(event=>event.body)).size,48);
 assert.equal(PERSONAS.zoe.title,'教育訓練專家主管／福委會會長');
 for(const id of CAST_IDS_V65){assert.equal(PERSONAS[id].name,CAST_PROFILES_V65[id].name);assert.ok(displayPersona(id).about.length>25);assert.equal(PERSONAS[id].image,`./assets/${id}.png`);assert.doesNotMatch(PERSONAS[id].about,/心生怨恨|奴役|急凍|冷凍|差點乾女兒/);const events=CAST_EVENTS_V65.filter(event=>event.speaker===id);assert.equal(events.length,8);assert.ok(events.some(event=>!event.roles));for(const event of events){assert.equal(event.requiresCastV65,true);assert.equal(event.minRules,39);assert.equal(event.minTurn,1);assert.ok(event.scene);assert.equal(event.choices.length,3);assert.equal(event.choices[2].wild,true);assert.ok(event.choices.every(choice=>choice.result.length>20));assert.doesNotMatch(event.choices.map(choice=>choice.text).join(' '),/成功率|\d+%|心情\s*[+-]|體力\s*[+-]/);}}
});

test('the fourth meal page appends navigation without moving the first three pages or changing any older cohort',()=>{
 for(const profile of [60,61,62,63,64])for(const page of [0,1,2]){const run=meal(profile,null,page);assert.deepEqual(getMealEventV65(run),getMealEventV39(run));}
 const third=meal(65,null,2),old=getMealEventV39(third),next=getMealEventV65(third);assert.deepEqual(next.choices.slice(0,old.choices.length),old.choices);assert.equal(next.choices.at(-1).effect,'mealPage');assert.equal(next.choices.at(-1).mealPage,3);assert.equal(mealPageIdV65(3),'meal-guests-d');assert.equal(mealPageIdV65(4),null);
 const fourth=getMealEventV65(meal());assert.deepEqual(fourth.choices.filter(choice=>choice.mealTarget).map(choice=>choice.mealTarget),CAST_IDS_V65);assert.equal(fourth.privateContext,true);assert.ok(fourth.choices.some(choice=>choice.effect==='mealCancel'));assert.ok(fourth.choices.some(choice=>choice.effect==='mealFinish'&&!choice.mealTarget));
});

test('new invitations depend on role and familiarity, cost nothing before eating, and cannot reroll a refusal on the same day',()=>{
 for(const id of CAST_IDS_V65){
  const run=meal(),invitation=getMealEventV65(run).choices.find(choice=>choice.mealTarget===id),profile=castInvitationProfileV65(run,id);assert.ok(profile.acceptChance>0&&profile.acceptChance<1);assert.equal(invitation.mealCost,CAST_PROFILES_V65[id].cost);assert.match(invitation.text,new RegExp(`${invitation.mealCost} 存款`));assert.deepEqual(invitation.delta,{});assert.ok(invitation.draw.outcomes.every(outcome=>Object.keys(outcome.delta).length===0));assert.deepEqual(invitation.draw.outcomes.map(outcome=>outcome.effect),['mealPick','mealDeclined']);
  const asked={...run,flags:{[`meal_invite_${id}_day_5`]:1}};assert.equal(getMealEventV65(asked).choices.find(choice=>choice.mealTarget===id).available,false);const poor={...run,stats:{...run.stats,cash:CAST_PROFILES_V65[id].cost-1}};assert.equal(getMealEventV65(poor).choices.find(choice=>choice.mealTarget===id).available,false);
  for(const index of [0,1]){const chat=castMealChatProfileV65(run,id,index);assert.ok(chat.warmChance>0&&chat.neutralChance>0&&chat.mineChance>0);assert.ok(Math.abs(chat.warmChance+chat.neutralChance+chat.mineChance-1)<1e-10);}
 }
 assert.ok(castInvitationProfileV65({...meal(),actualRoleId:'bd'},'action').acceptChance>castInvitationProfileV65(meal(),'action').acceptChance);assert.ok(castInvitationProfileV65(meal(),'action').acceptChance<castInvitationProfileV65(meal(),'johnny').acceptChance);
});

test('six naturally present people support contextual spoken replies and departure without inventing off-scene targets',()=>{
 for(const id of CAST_IDS_V65){const run=source(id);assert.equal(E.validRun(run),true);assert.ok(E.getRageTargets(run).includes(id));assert.ok(E.getVerbalTargets(run).includes(id));const line=E.getVerbalLine(run,id);assert.match(line,/幹|靠北/);assert.match(line,new RegExp(CAST_PROFILES_V65[id].name));assert.equal(line,castVerbalLineV65(run,E.getEvent(run),id,'event'));const spoken=E.requestVerbal(run,undefined,2);assert.equal(spoken.pending,true);assert.equal(spoken.history.at(-1).choiceText,line);assert.equal(spoken.history.at(-1).speaker,id);assert.equal(E.validRun(spoken),true);assert.deepEqual(E.replayRun(spoken.roleId,spoken.seed,spoken.actions),E.advance(spoken));assert.equal(spoken.history.at(-1).result.includes(line),false,'the full spoken line is not duplicated in the reaction');const left=E.requestEventDepartureV63(run);assert.equal(left.history.at(-1).departureOutcome.target,id);assert.equal(characterHistoryChanges(left).at(-1).id,id);assert.equal(E.validRun(left),true);}
 const event=CAST_EVENTS_V65.find(event=>event.id==='cast65-simon-pixel-contract'),line=castVerbalLineV65(source('simon'),event,'simon');assert.match(line,/規格|驗收/);assert.doesNotMatch(line,/熟面孔|以前那版/,'metaphorical new skills reporting for work must not trigger return-to-company insults');
});

test('work fantasies and real hits remain separate with six authored dreams and no imaginary hit counted as physical',()=>{
 const dreamTexts=[];
 for(const id of CAST_IDS_V65){const run=source(id),release=getRageV65({...run,eventId:'rage-release',rageContext:{target:id,eventId:run.eventId,phase:'event'}});assert.equal(release.speaker,id);const outcomes=release.choices[0].draw.outcomes;assert.deepEqual(outcomes.map(outcome=>outcome.label),['腦內劇場','真的失控了']);assert.equal(outcomes.reduce((sum,outcome)=>sum+outcome.weight,0),100);assert.ok(outcomes.every(outcome=>outcome.delta.boss===0));assert.match(outcomes[0].result,/沒有挨打|腦內的夢境/);assert.match(outcomes[1].result,/真的出手/);dreamTexts.push(outcomes[0].result);
  const pending=E.requestRage(run),after=deriveCharacterStats(pending).find(character=>character.id===id),before=deriveCharacterStats(run).find(character=>character.id===id);assert.equal(E.validRun(pending),true);assert.equal(after.encounters,before.encounters+1);assert.equal(after.realHits-before.realHits,pending.rageContext.mode==='real'?1:0);assert.equal(after.imaginedHits-before.imaginedHits,pending.rageContext.mode==='imagined'?1:0);assert.deepEqual(E.replayRun(pending.roleId,pending.seed,pending.actions),E.advance(pending));}
 assert.equal(new Set(dreamTexts).size,6);
});

test('new history evidence projects only in r65 while all public cards stay visible on old saves',()=>{
 for(const id of CAST_IDS_V65){const event=getMealEventV65(meal(65,id)),outcome=event.choices[0].draw.outcomes[0],row={eventId:event.id,kind:'self-care',speaker:id,choiceIndex:0,turn:5,mealOutcome:outcome.mealOutcome,eventOutcome:{label:'餐桌氣氛',result:'聊得很開'},breakdown:[]};assert.equal(isMealOutcomeV36(meal(),row),true);assert.equal(isMealOutcomeV36(meal(64),row),false);assert.equal(deriveCharacterStats({...meal(),history:[row]}).find(character=>character.id===id).affinityGained,8);assert.equal(deriveCharacterStats({...meal(64),history:[row]}).find(character=>character.id===id).encounters,0);}
 assert.equal(isCastV65('e39-r65-n-'+'a'.repeat(22)),true);assert.equal(isCastV65('e39-r64-n-'+'a'.repeat(22)),false);assert.equal(isCastV65('e39-r65-n-'+'A'.repeat(22)),false);
});

test('verbal wrappers preserve every numeric consequence and hidden draw while supplying the six character voices',()=>{
 for(const id of CAST_IDS_V65){const run=source(id),context={version:2,target:id,stage:'release',line:'已經顯示過的原話'},original={id:run.eventId,choices:[{text:context.line,delta:{},draw:{label:'test',outcomes:Object.keys(castVerbalReactionsV65(id)).map(verbalKind=>({verbalKind,weight:7,delta:{mood:3},effect:'verbalV2Resolve',result:'old reaction'}))}}]},snapshot=structuredClone(original),wrapped=withCastVerbalScenarioV65(original,{...run,verbalContext:context});assert.deepEqual(original,snapshot);for(const [index,outcome]of wrapped.choices[0].draw.outcomes.entries()){assert.equal(outcome.weight,7);assert.deepEqual(outcome.delta,{mood:3});assert.equal(outcome.effect,original.choices[0].draw.outcomes[index].effect);assert.ok(outcome.result.length>20);assert.equal(outcome.result.includes(context.line),false);}assert.equal(withCastVerbalScenarioV65(original,{...run,seed:meal(64).seed,verbalContext:context}),original);}
});
