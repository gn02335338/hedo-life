import test from 'node:test';
import assert from 'node:assert/strict';
import {PRINCESS_EVENTS_V39} from '../dist/events-cast-v39-princess.js';
import {JOYCE_EVENTS_V39} from '../dist/events-cast-v39-joyce.js';
import {ANNIE_EVENTS_V39} from '../dist/events-cast-v39-annie.js';
import {getMealEventV39} from '../dist/meals-cast-v39.js';
import {castVerbalLineV39,castVerbalReactionsV39} from '../dist/verbal-cast-v39.js';
import {getVerbalScenarioV2} from '../dist/verbal-scenario-v2.js';
import {getRageV39} from '../dist/rage-cast-v39.js';
import {patronageReplyOutcomesV43} from '../dist/patronage-reply-v43.js';
import {PRINCESS_ENGLISH_COVERAGE_V47,displayPrincessEventV47,displayPrincessHistoryV47,displayPrincessTextV47} from '../dist/princess-english-v47.js';

const han=/\p{Script=Han}/u;
const run=()=>({seed:'e39-princess-english-test',turn:4,actualRoleId:'ai',rank:1,stats:{cash:80,mood:50,energy:80,boss:50,trust:60},flags:{},history:[]});
const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
const committed=(event,result,extra={})=>({eventId:event.id,speaker:event.speaker,title:event.title,body:event.body,wing:event.wing,choiceText:'先把工作談清楚。',result,...extra});
const englishQuote=text=>assert.match(text,/[A-Za-z][^「」]*[.!?]/u);

test('all 30 authored Princess daily quote cards are English without changing canonical events or player choices',()=>{
 assert.equal(PRINCESS_EVENTS_V39.length,30);
 assert.deepEqual(PRINCESS_ENGLISH_COVERAGE_V47.dailyEventIds,PRINCESS_EVENTS_V39.map(e=>e.id));
 for(const event of PRINCESS_EVENTS_V39){
  const before=JSON.stringify(event),shown=displayPrincessEventV47(freeze(structuredClone(event)),run());
  assert.notEqual(shown.wing,event.wing,event.id);
  assert.equal(han.test(shown.wing),false,event.id);
  assert.ok(han.test(shown.body),event.id+' retains the Chinese narrator');
  assert.deepEqual(shown.choices,event.choices,event.id+' keeps player answers and canonical consequences');
  assert.equal(JSON.stringify(event),before,event.id);
 }
});

test('mixed meetings translate only Princess attribution and keep Jack, Cindy and Rick in Chinese',()=>{
 for(const slug of ['robot-review','pm-bridge','release-check']){
  const event=PRINCESS_EVENTS_V39.find(e=>e.id.endsWith(slug)),shown=displayPrincessEventV47(event);
  assert.match(shown.body,/「[A-Za-z]/u);
  assert.ok(han.test(shown.body));
  const allResults=event.choices.map(c=>displayPrincessHistoryV47(committed(event,c.result)).result).join('\n');
  if(slug==='robot-review')assert.match(allResults,/傑克把待補欄留在會議紀錄/);
  if(slug==='pm-bridge')assert.match(allResults,/主持人說可以晚點再問/);
  if(slug==='release-check')assert.match(allResults,/瑞克先說不要這麼計較/);
 }
 const joyce=JOYCE_EVENTS_V39.find(e=>e.id.endsWith('data-answer')),shown=displayPrincessEventV47(joyce);
 assert.equal(shown.wing,joyce.wing,'914 is still speaking Chinese in her quote card');
 assert.match(shown.body,/公主卻說：「We need to confirm the data scope first\.」/);
 assert.match(shown.body,/914要你給客戶/);
 const annie=ANNIE_EVENTS_V39.find(e=>e.id.endsWith('name-check'));
 assert.equal(displayPrincessEventV47(annie).wing,annie.wing,'same-name multi-person quote belongs to 安妮余');
});

test('event preview does not read result, delta, draw, outcome or choice getters',()=>{
 const choice={text:'先核對實際工作。'};
 for(const field of ['result','delta','draw','outcomes'])Object.defineProperty(choice,field,{get(){throw new Error('unrevealed '+field);}});
 const choices=[choice],event={id:'cast39-princess-robot-review',speaker:'princess',body:PRINCESS_EVENTS_V39[0].body,wing:PRINCESS_EVENTS_V39[0].wing,choices};
 Object.defineProperty(event,'result',{get(){throw new Error('unrevealed event.result');}});
 Object.defineProperty(event,'resolvedChapter',{get(){throw new Error('unrevealed accessor');}});
 const shown=displayPrincessEventV47(Object.freeze(event));
 assert.equal(shown.choices,choices);
 assert.equal(shown.choices[0],choice);
 assert.equal(han.test(shown.wing),false);
});

test('a dinner invitation renders an English acceptance and refusal only after the roll commits',()=>{
 const state={...run(),eventId:'meal-guests-c',mealContext:{origin:'self-care',page:2,guest:null}},event=getMealEventV39(state);
 const choice=event.choices.find(c=>c.mealTarget==='princess');
 assert.ok(choice);
 const shown=displayPrincessEventV47(event,state);
 assert.equal(shown.choices,event.choices,'no outcome traversal in menu');
 for(const outcome of choice.draw.outcomes){
  const row=committed(event,outcome.result,{choiceText:choice.text});
  const after=displayPrincessHistoryV47(freeze(row),state);
  englishQuote(after.result);
  assert.match(after.result,/沒有|不拿/,'original no-cost invitation consequence remains');
 }
});

test('all six table RNG replies use her English voice while mood, cost and relationship data are unchanged',()=>{
 const state={...run(),eventId:'meal-with-princess',mealContext:{origin:'self-care',page:2,guest:'princess'}},event=getMealEventV39(state),shown=displayPrincessEventV47(event,state);
 assert.equal(han.test(shown.wing),false);
 englishQuote(shown.body);
 assert.equal(shown.choices,event.choices);
 for(const [replyIndex,choice] of event.choices.slice(0,2).entries()){
  for(const outcome of choice.draw.outcomes){
   const row=committed(event,outcome.result,{choiceText:choice.text,mealOutcome:outcome.mealOutcome,delta:outcome.delta});
   const before=JSON.stringify(row),after=displayPrincessHistoryV47(freeze(row),state);
   englishQuote(after.result);
   assert.equal(after.choiceText,choice.text,'player still chooses Chinese answers');
   assert.equal(after.mealOutcome,row.mealOutcome);
   assert.equal(after.delta,row.delta);
   assert.equal(JSON.stringify(row),before);
   assert.equal(after.mealOutcome.replyIndex,replyIndex);
  }
 }
});

test('referenced Princess quotations inside player insults are English without changing the player voice',()=>{
 const event=PRINCESS_EVENTS_V39[0],line=castVerbalLineV39({event,target:'princess',run:run()});
 const shown=displayPrincessTextV47(line,{target:'princess'});
 assert.match(shown,/公主，幹/);
 assert.match(shown,/『Let's skip my part for now/);
 assert.match(shown,/這間公司不是只有別人的時間才算工時/);
 assert.doesNotMatch(shown,/『我那段先跳過/);
 assert.equal(displayPrincessTextV47(event.wing,{field:'choiceText',target:'princess'}),event.wing,'a player answer is not a character quote card');
});

test('all six verbal reactions preserve branch-specific aftermath and translate her reply',()=>{
 const source=PRINCESS_EVENTS_V39[0],reactions=castVerbalReactionsV39('princess');
 for(const [kind,result] of Object.entries(reactions)){
  const row=committed(source,result,{eventId:'verbal-release',kind:'verbal',verbalOutcome:{version:2,target:'princess',kind}});
  const after=displayPrincessHistoryV47(freeze(row));
  englishQuote(after.result);
  if(kind==='support')assert.match(after.result,/同事把測試結果攤開，說對每個人用同一套驗收就好/);
  if(kind==='relationship')assert.match(after.result,/開始只用書面回你/);
  if(kind==='legal')assert.match(after.result,/沒有誰因為職稱較高就已經勝訴/);
 }
});

test('special-appointment work and private branches keep their own consequences and player lines',()=>{
 for(const privateContext of [false,true]){
  const state=run(),event={...PRINCESS_EVENTS_V39[0],...(privateContext?{privateContext:true}:{})};
  for(const outcome of patronageReplyOutcomesV43(state,event,'princess')){
   const row=committed(event,outcome.result,{eventId:'patronage-reply',kind:'patronage',choiceText:'公主，這回先照我排的驗收走。',patronageOutcome:{version:1,target:'princess',reaction:outcome.reaction}});
   const shown=displayPrincessHistoryV47(freeze(row));
   if(outcome.reaction==='retort'||!privateContext&&['obliged','reported'].includes(outcome.reaction))englishQuote(shown.result);
   assert.equal(shown.choiceText,row.choiceText);
   if(privateContext&&outcome.reaction==='reported')assert.match(shown.result,/沒有誰去找翅膀處理/);
   if(!privateContext&&outcome.reaction==='reported')assert.match(shown.result,/翅膀聽完先嫌你們事情太多/);
  }
 }
});

test('dream and actual rage remain distinct, with an English stop request and dream response',()=>{
 const state={...run(),eventId:'rage-release',rageContext:{target:'princess',eventId:'cast39-princess-robot-review',phase:'event'}},event=getRageV39(state),shown=displayPrincessEventV47(event,state);
 assert.equal(shown.wing,'Stop for a moment. What exactly are we talking about?');
 const [dream,real]=event.choices[0].draw.outcomes;
 const dreamRow=displayPrincessHistoryV47(committed(event,dream.result),state);
 englishQuote(dreamRow.result);
 assert.match(dreamRow.result,/沒有挨打/);
 const realRow=displayPrincessHistoryV47(committed(event,real.result),state);
 assert.equal(realRow.result,real.result,'no speech is invented for an actual hit');
 assert.match(realRow.result,/這次真的動了手/);
});

test('frozen legacy histories and committed chapter summaries render English without mutating proof',()=>{
 const event=PRINCESS_EVENTS_V39[0],row=freeze(committed(event,event.choices[0].result,{eventOutcome:{label:'已揭曉',result:'公主回了謝謝，你的名字則穩穩留在兩個夜晚。'}})),before=JSON.stringify(row);
 const shown=displayPrincessHistoryV47(row);
 assert.equal(JSON.stringify(row),before);
 assert.equal(han.test(shown.wing),false);
 assert.match(shown.result,/I will send you the update later/);
 assert.match(shown.eventOutcome.result,/Thanks/);
 const chapter=freeze({...event,resolvedChapter:{result:event.choices[0].result}});
 const shownChapter=displayPrincessEventV47(chapter);
 assert.match(shownChapter.resolvedChapter.result,/I will send you the update later/);
 assert.equal(chapter.resolvedChapter.result,event.choices[0].result);
});

test('other people, player prose, opaque inputs and already-English text are unchanged',()=>{
 const other={id:'office-day',speaker:'wing',title:'今天先做什麼？',body:'翅膀說：「先把事情做好。」',wing:'先停一下。你現在要講的是哪件事？',choices:[{text:'我先去吃飯。'}]};
 assert.deepEqual(displayPrincessEventV47(other),other);
 for(const text of ['我先去吃飯。','She is speaking English already.','頂大資訊背景，工作以資料整理為主。'])assert.equal(displayPrincessTextV47(text,{speaker:'princess'}),text);
 for(const value of [undefined,null,42])assert.equal(displayPrincessTextV47(value),value);
 assert.equal(displayPrincessHistoryV47(null),null);
 assert.equal(displayPrincessEventV47(undefined),undefined);
});


test('identical words from another actor and mixed-scene pronouns never inherit Princess identity',()=>{
 const matching=PRINCESS_EVENTS_V39[0].wing;
 const other={id:'cast39-joyce-data-answer',speaker:'joyce',body:`914說：「${matching}」公主坐在旁邊。她說晚上有自己的計畫。`,wing:`「${matching}」`};
 const shown=displayPrincessEventV47(other);
 assert.equal(shown.body,other.body);
 assert.equal(shown.wing,other.wing);
 const generic={id:'rage-release',speaker:'rick',wing:'「先停一下。你現在要講的是哪件事？」'};
 assert.equal(displayPrincessEventV47(generic).wing,generic.wing);
 const player=`「${matching}」`;
 const row={eventId:PRINCESS_EVENTS_V39[0].id,speaker:'princess',choiceText:player,result:'你先收起筆。'};
 assert.equal(displayPrincessHistoryV47(row).choiceText,player);
 const verbal={...row,verbalOutcome:{target:'princess'},choiceText:`公主，幹，妳剛才說『${matching}』。`};
 assert.match(displayPrincessHistoryV47(verbal).choiceText,/公主，幹，妳剛才說『Let's skip my part/);
});


test('formal verbal follow-ups keep Hope Chinese and translate Princess legal and decision requests',()=>{
 const source=PRINCESS_EVENTS_V39[0],state={...run(),verbalContext:{version:2,target:'princess',stage:'legal',line:'把同一套標準講清楚。'}};
 const legal=displayPrincessEventV47(getVerbalScenarioV2(state,source),state);
 assert.match(legal.body,/公主要求：「Please clarify/);
 state.verbalContext.stage='decision';
 const decision=displayPrincessEventV47(getVerbalScenarioV2(state,source),state);
 assert.match(decision.body,/What would you like to do next/);
 state.verbalContext.stage='warning';
 const warning=displayPrincessEventV47(getVerbalScenarioV2(state,source),state);
 assert.match(warning.body,/她把談話紀錄推到你面前：「剛才那個口氣，我們需要了解一下。」/);
 assert.equal(warning.speaker,'hope');
});
