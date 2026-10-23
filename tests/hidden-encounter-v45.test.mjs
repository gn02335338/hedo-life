import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as engine from '../dist/engine.js';
import {HIDDEN_PERSONAS_V45,HIDDEN_SCENE_COUNT_V45,getHiddenEncounterEventV45,resolveHiddenEncounterChoiceV45} from '../dist/hidden-encounter-v45.js';
import {PERSONAS} from '../dist/persona.js';
import {CHARACTER_IDS,deriveCharacterStats} from '../dist/character-stats.js';
import {characterBookHTML} from '../dist/character-book.js';
import {validateCompletion} from '../worker/http.js';
import {ROLE_MAP} from '../dist/roles.js';

const copy=value=>JSON.parse(JSON.stringify(value));
const nextRng=value=>{let x=value;x^=x<<13;x^=x>>>17;x^=x<<5;return x>>>0||1;};
const choose=(run,index)=>engine.advance(engine.applyChoice(run,index));
const check=run=>assert.equal(engine.validRun(copy(run)),true,`${run.seed}/${run.eventId}/${run.pending}`);
const sources=[];
for(let index=0;index<400&&sources.length<24;index++){
 let run=engine.createRun('system',`e39-hidden-natural-${index}`);
 for(let step=0;step<10&&!run.completed;step++){
  if(engine.canRequestHiddenEncounter(run)){sources.push(run);break;}
  const event=engine.getEvent(run),option=event.choices.findIndex(choice=>choice.available!==false);
  if(option<0)break;run=choose(run,option);
 }
}
assert.ok(sources.length>=12,'natural canonical routes can meet a hidden visitor');

test('all eight previously authored scenes retain their exact titles, prose, choices and results',()=>{
 const stories=Array.from({length:HIDDEN_SCENE_COUNT_V45},(_,scene)=>{
  const run={...sources[0],hiddenEncounterContext:{version:1,returnEventId:sources[0].eventId,scene,stage:0,incident:null}},event=getHiddenEncounterEventV45(run);
  assert.equal(event.choices[1].wild,true);
  return {title:event.title,body:event.body,choices:event.choices.slice(0,3).map((choice,index)=>({text:choice.text,result:resolveHiddenEncounterChoiceV45(run,index,.5).result}))};
 });
 // The digest covers public story fields only. No private archive file or
 // administrator content is required by the build, tests, or game runtime.
 assert.equal(createHash('sha256').update(JSON.stringify(stories)).digest('hex'),'0c95d1b73d8a098b7e915dd4fe834832158516858be424e4ceca9056ad2fc65e');
});

test('a hidden encounter is a rare side scene, absent from the public cast and stats',()=>{
 assert.equal(Object.keys(PERSONAS).length,28);assert.equal(CHARACTER_IDS.length,Object.keys(PERSONAS).length);
 assert.equal(Object.hasOwn(PERSONAS,'hidden-visitor'),false);
 assert.equal(HIDDEN_PERSONAS_V45['hidden-visitor'].name,'魚酥姐');
 assert.equal(HIDDEN_PERSONAS_V45['hidden-visitor'].image,'./assets/hidden-visitor.png');
 const book=characterBookHTML();assert.doesNotMatch(book,/魚酥|hidden-visitor|Frans/);
 assert.match(book,/private-sealed-card/);
 assert.equal(HIDDEN_SCENE_COUNT_V45,8);
 const prohibited=/Frans|小三|情婦|女友|林澤|台大/;
 for(let scene=0;scene<HIDDEN_SCENE_COUNT_V45;scene++){
  const source={...sources[0],hiddenEncounterContext:{version:1,returnEventId:sources[0].eventId,scene,stage:0,incident:null}},event=getHiddenEncounterEventV45(source);
  assert.equal(event.speaker,'hidden-visitor');assert.equal(event.kind,'hidden');assert.equal(event.hiddenCharacter,true);assert.equal(event.scope,'private');
  assert.equal(event.choices.length,5);assert.equal(event.choices[3].hiddenAction,'verbal');assert.equal(event.choices[4].hiddenAction,'rage');
  assert.ok(event.choices.slice(0,3).some(choice=>choice.wild));assert.doesNotMatch(JSON.stringify(event),prohibited);
  for(let index=0;index<5;index++)for(const draw of [.01,.5,.99])assert.doesNotMatch(JSON.stringify(resolveHiddenEncounterChoiceV45(source,index,draw)),prohibited);
 }
});

test('preview is immutable and RNG-free; only a successful opener consumes one seeded draw',()=>{
 for(const source of sources){
  const snapshot=copy(source),event=copy(engine.getEvent(source));check(source);
  for(let repeat=0;repeat<3;repeat++){assert.equal(engine.canRequestHiddenEncounter(source),true);assert.deepEqual(engine.getEvent(source),event);}
  const opened=engine.requestHiddenEncounter(source);
  assert.deepEqual(source,snapshot);assert.equal(opened.rng,nextRng(source.rng));assert.deepEqual(opened.stats,source.stats);
  assert.equal(opened.turn,source.turn);assert.deepEqual(opened.history,source.history);
  assert.deepEqual(opened.actions.at(-1),{type:'hidden-encounter',version:1,eventId:source.eventId});
  assert.ok(opened.hiddenEncounterContext.scene>=0&&opened.hiddenEncounterContext.scene<8);
  assert.equal(opened.hiddenEncounterContext.returnEventId,source.eventId);assert.equal(opened.flags.hidden45_seen,1);
  check(opened);assert.deepEqual(engine.replayRun(opened.roleId,opened.seed,opened.actions),opened);
  assert.equal(engine.requestHiddenEncounter(opened),opened);
 }
});

test('all reply modes commit once, preserve the workday, and resume the unanswered source event',()=>{
 const witnessed=new Set();
 for(const source of sources)for(let index=0;index<5;index++){
  let run=engine.requestHiddenEncounter(source),stages=0;
  while(run.hiddenEncounterContext){
   const event=engine.getEvent(run),selected=stages===0?index:stages%3;
   const pending=engine.applyChoice(run,selected),row=pending.history.at(-1);stages++;
   assert.ok(stages<=2,'no hidden encounter loop');witnessed.add(row.hiddenOutcome.mode);
   assert.equal(pending.rng,nextRng(run.rng));assert.equal(row.kind,'hidden');assert.equal(row.speaker,'hidden-visitor');
   assert.equal(row.choiceText,event.choices[selected].text);assert.equal(row.hiddenOutcome.version,1);
   assert.deepEqual(Object.keys(row.delta).sort(),engine.STAT_KEYS.slice().sort());
   assert.equal(row.delta.boss,0,'a private visitor interaction cannot change Wing sentiment');
   assert.equal(pending.turn,source.turn);assert.equal(pending.pay,source.pay);assert.deepEqual(pending.pip,source.pip);
   assert.ok(pending.stats.skill+pending.stats.slack+pending.stats.lick<=180);
   assert.equal(engine.applyChoice(pending,selected),pending);check(pending);
   run=engine.advance(copy(pending));check(run);assert.deepEqual(engine.replayRun(run.roleId,run.seed,run.actions),run);
  }
  assert.equal(run.eventId,source.eventId);assert.equal(run.turn,source.turn);assert.equal(run.completed,false);
  assert.equal(run.pipCount,source.pipCount);assert.equal(run.pending,false);
  assert.deepEqual(engine.getEvent(run).choices.map(choice=>choice.text),engine.getEvent(source).choices.map(choice=>choice.text));
  assert.equal(engine.requestHiddenEncounter(run),run,'cannot farm the visitor');
  assert.deepEqual(deriveCharacterStats(run),deriveCharacterStats(source),'hidden actor is excluded from public per-person stats');
 }
 for(const mode of ['normal','verbal','imagined','real','aftermath'])assert.ok(witnessed.has(mode),mode);
});

test('real and imagined actions stay distinct, and a private dispute has an explicit personal aftermath',()=>{
 const opened=engine.requestHiddenEncounter(sources[0]);
 const imagined=resolveHiddenEncounterChoiceV45(opened,4,.99),real=resolveHiddenEncounterChoiceV45(opened,4,0),verbal=resolveHiddenEncounterChoiceV45(opened,3,.99);
 assert.equal(imagined.mode,'imagined');assert.equal(imagined.done,true);assert.match(imagined.result,/只是想像/);
 assert.equal(real.mode,'real');assert.equal(real.done,false);assert.equal(real.incident,'real');assert.match(real.result,/不是想像/);
 assert.equal(verbal.mode,'verbal');assert.equal(verbal.done,false);
 for(const incident of ['real','verbal']){
  const scene={...opened,hiddenEncounterContext:{...opened.hiddenEncounterContext,stage:1,incident}};
  const event=getHiddenEncounterEventV45(scene);assert.equal(event.choices.length,3);assert.ok(event.choices.every(choice=>!choice.hiddenAction));
  for(let index=0;index<3;index++){const result=resolveHiddenEncounterChoiceV45(scene,index,.5);assert.equal(result.done,true);assert.equal(result.mode,'aftermath');assert.doesNotMatch(result.result,/你.*被開除|你.*自願離職/);}
 }
});

test('unrelated menus and unsupported or unsafe states cannot replace the encounter',()=>{
 const source=sources[0],opened=engine.requestHiddenEncounter(source),pending=engine.applyChoice(opened,0);
 for(const run of [opened,pending]){
  for(const operation of [engine.requestBreak,engine.requestCareer,engine.requestRaise,engine.requestExit,engine.requestVerbal,engine.requestRage,engine.requestSalaryAdvice,engine.requestPatronageReply])assert.equal(operation(run),run);
  assert.equal(engine.requestActivity(run,'arm'),run);
 }
 for(const patch of [{seed:'e38-old'},{turn:0},{turn:1},{turn:20},{pending:true},{completed:true},{pip:{active:true}},{flags:{...source.flags,floor_watch:1}},{stats:{...source.stats,mood:15}},{stats:{...source.stats,energy:15}},{activityContext:{}},{chapterContext:{}},{verbalContext:{}},{personnelPending:{}}]){
  const run={...source,...patch};assert.equal(engine.canRequestHiddenEncounter(run),false);assert.equal(engine.requestHiddenEncounter(run),run);
 }
});

test('forged hidden contexts, extra action fields, history and RNG tampering are rejected',()=>{
 const source=sources[0],opened=engine.requestHiddenEncounter(source),pending=engine.applyChoice(opened,4);
 for(const mutate of [r=>r.hiddenEncounterContext.scene=(r.hiddenEncounterContext.scene+1)%8,r=>r.hiddenEncounterContext.returnEventId='onboarding',r=>r.rng++,r=>r.stats.mood--,r=>r.actions.at(-1).extra=true]){
  const run=copy(opened);mutate(run);assert.equal(engine.validRun(run),false);
 }
 for(const mutate of [r=>r.history.at(-1).result+=' forged',r=>r.history.at(-1).hiddenOutcome.mode='imagined',r=>r.history.at(-1).delta.boss=9]){
  const run=copy(pending);mutate(run);if(JSON.stringify(run)!==JSON.stringify(pending))assert.equal(engine.validRun(run),false);
 }
 assert.equal(engine.validRun({...source,hiddenEncounterContext:copy(opened.hiddenEncounterContext)}),false);
 for(const action of [{type:'hidden-encounter',version:2,eventId:source.eventId},{type:'hidden-encounter',version:1,eventId:'onboarding'},{type:'hidden-encounter',version:1,eventId:source.eventId,target:'wing'}])assert.throws(()=>engine.replayRun(source.roleId,source.seed,[...source.actions,action]));
});

test('API protocol allows only the three-field e39 opener and canonical replay checks actual availability',()=>{
 const source=sources[0],opened=engine.requestHiddenEncounter(source),runId='22222222-2222-4222-8222-222222222222';
 const body={runId,roleId:source.roleId,seed:source.seed,actions:opened.actions};
 assert.doesNotThrow(()=>validateCompletion(body,ROLE_MAP));
 for(const action of [{type:'hidden-encounter',version:2,eventId:source.eventId},{type:'hidden-encounter',version:1,eventId:''},{type:'hidden-encounter',version:1,eventId:source.eventId,target:'hidden-visitor'},{type:'hidden-encounter',eventId:source.eventId}])assert.throws(()=>validateCompletion({...body,actions:[action]},ROLE_MAP));
 assert.throws(()=>validateCompletion({...body,seed:'e38-old'},ROLE_MAP));
 assert.throws(()=>engine.replayRun(source.roleId,source.seed,[{type:'hidden-encounter',version:1,eventId:'onboarding'}]));
});

test('returning from the visitor preserves later event-phase and result-phase verbal and rage replay',()=>{
 for(const source of sources.slice(0,4)){
  const returned=choose(engine.requestHiddenEncounter(source),0);
  for(const mode of ['rage','verbal'])for(const phase of ['event','result']){
   const target=phase==='result'?engine.applyChoice(returned,0):returned;
   const allowed=mode==='rage'?engine.canRequestRage(target):engine.canRequestVerbal(target);
   if(!allowed)continue;
   const pending=mode==='rage'?engine.requestRage(target):engine.requestVerbal(target,undefined,2);
   assert.notEqual(pending,target);assert.equal(pending.actions.at(-1).phase,phase);check(pending);
   const after=engine.advance(pending);check(after);assert.deepEqual(engine.replayRun(after.roleId,after.seed,after.actions),after);
  }
 }
});
