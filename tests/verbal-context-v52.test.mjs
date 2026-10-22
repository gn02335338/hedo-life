import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as E from '../dist/engine.js';
import {EVENTS,FANTASY_EVENTS} from '../dist/events.js';
import * as persona from '../dist/persona.js';
import * as titles from '../dist/job-titles-v42.js';
import * as princess from '../dist/princess-english-v47.js';
import * as arm from '../dist/arm-verbal-copy-v51.js';
import * as armScene from '../dist/arm-scene-ui-v51.js';
import {polishVerbalHistoryV41} from '../dist/verbal-presentation-v41.js';
import {verbalTargetsV30} from '../dist/verbal-v30.js';
import {verbalSceneLine} from '../dist/verbal-scene-copy.js';
import {strongVerbalLineV39} from '../dist/verbal-lines-v39.js';
import * as contextCopy from '../dist/verbal-context-v52.js';
const {displayContextVerbalLineV52:line,displayContextVerbalHistoryV52:history}=contextCopy;
const copy=value=>JSON.parse(JSON.stringify(value));
const scenes=[...EVENTS,...FANTASY_EVENTS].map(event=>({...event,speaker:event.speaker||'wing'}));
const sample=E.createRun('system','e39-v52-context-audit');
const actual=(event,target,phase='event',run=sample)=>line(strongVerbalLineV39({event,target,phase,run,base:verbalSceneLine({event,target,phase,run})}),{event,target,phase,run});

test('every public daily/fantasy participant receives deterministic coarse speech without reading future choices or changing state',()=>{
 let count=0;
 for(const event of scenes){
  const before=JSON.stringify({event,run:sample});
  for(const target of verbalTargetsV30(event))for(const phase of ['event','result']){
   const raw=actual(event,target,phase),visible={id:event.id,title:event.title,body:event.body,wing:event.wing,speaker:event.speaker};
   for(const key of ['choices','draw','outcomes','result','ending'])Object.defineProperty(visible,key,{get(){throw Error(`future ${key}`)}});
   assert.equal(actual(visible,target,phase),raw,`${event.id}/${target}/${phase}`);
   assert.match(raw,/幹[，。！？]|他媽|靠北|媽的|狗屁/,event.id);
   assert.ok(raw.length>18&&raw.length<500,`${event.id}: ${raw}`);
   assert.doesNotMatch(raw,/undefined|null|NaN|https?:\/\/|\/Users\//,event.id);count++;
  }
  assert.equal(JSON.stringify({event,run:sample}),before);
 }
 assert.ok(count>1800);
});

test('incidental words in the narration cannot turn a visible meal or spectatorship into another job',()=>{
 const event={id:'future-social-scene',title:'大家一起吃點心',speaker:'jack',wing:'今天先把點心吃完，好嗎？',body:'有人拿了蛋塔。'};
 const first=actual(event,'jack');
 for(const body of ['有人想起開會、排程與上線。','有人提到 DB SQL AI 模型與資料庫。','有人說設計師的Figma跟報價單都很忙。','名單、座位、請假、表單、佣金、咖啡']){
  assert.equal(actual({...event,body},'jack'),first);
 }
 assert.match(first,/點心/);assert.doesNotMatch(first,/工期|資料結構|願景唸三遍|規格|發票|交付能力/);
 const other=actual({...event,speaker:'wing'},'spencer');
 assert.doesNotMatch(other,/你說.*點心吃完/,'another participant is not blamed for the main speaker quotation');
 assert.notEqual(actual(event,'jack','result'),first);
});

test('authored profession, meal and education replies survive the strong wrapper without premature technical answers',()=>{
 const cases=[['sales21-commission-proof','jenjen',/佣金|算法/],['bd21-mou-annex','spencer',/合照|合作|附件/],['design-v21-chairman-portrait','spencer',/照片|椅子|威嚴/],['ai31-auto-increment','rick',/資料庫|匯入|模型|截圖/]];
 for(const [id,target,pattern]of cases){const event=scenes.find(row=>row.id===id);assert.ok(event,id);assert.match(actual(event,target),pattern,id);}
 const ai=scenes.find(row=>row.id==='ai31-auto-increment');assert.doesNotMatch(actual(ai,'rick'),/auto[ _]?increment|自動編號|流水號/i);
 const meal={id:'meal-with-hope',speaker:'hope',title:'一起吃飯',body:'希望說今天只是吃飯。',wing:'先吃飯。'};
 assert.match(actual(meal,'hope'),/飯|白飯|自評/);assert.doesNotMatch(actual(meal,'hope'),/你這張表要改善/);
});

const routes=JSON.parse(readFileSync(new URL('./fixtures/verbal-scene-routes.json',import.meta.url),'utf8')).routes;
function sourceFor(route){
 const actions=route.baseActions;
 return route.phase==='result'?E.applyChoice(E.replayRun(route.roleId,route.seed,actions.slice(0,-1)),actions.at(-1).index):E.replayRun(route.roleId,route.seed,actions);
}
function representativeRoutes(){
 const selected=new Map();
 for(const route of routes){
  if(route.version!==2||!['onboarding','low-pay-tip','raise-response','raise-confirmation','banquet-afterparty','career-review'].includes(route.sourceEventId))continue;
  const run=sourceFor(route),key=[route.sourceEventId,route.phase,run.assignment,run.salaryAdvice?.origin,run.raiseContext?.view,run.characterGender].join('/');
  if(!selected.has(key))selected.set(key,route);
 }
 return [...selected.values()].slice(0,35);
}

test('preview, committed quote and finished histories agree using each original transient context rather than the final life state',()=>{
 const selected=representativeRoutes();assert.ok(selected.length>=5);
 for(const route of selected){
  const source=sourceFor(route),event=E.getEvent(source),target=route.target,before=JSON.stringify(source);
  const preview=line(E.getVerbalLine(source,target),{event,target,run:source,phase:route.phase});
  const pending=E.requestVerbal(source,E.getVerbalTargets(source).length>1?target:undefined,2),row=pending.history.at(-1),snapshot=JSON.stringify(pending);
  const shown=history(polishVerbalHistoryV41(row),{run:pending,rawRow:row});
  assert.equal(shown.choiceText,preview,route.id);assert.doesNotMatch(shown.body,/^你說：/);
  assert.equal(history(shown,{run:pending,rawRow:row}),shown,`${route.id}/idempotent`);
  assert.equal(JSON.stringify(source),before);assert.equal(JSON.stringify(pending),snapshot);assert.equal(E.validRun(pending),true);
  const finished=E.replayRun(route.roleId,route.seed,route.completionActions),past=finished.history[pending.history.length-1];
  assert.ok(past?.verbalOutcome,route.id);
  assert.equal(history(polishVerbalHistoryV41(past),{run:finished,rawRow:past}).choiceText,preview,`${route.id}/closed-context`);
 }
});

test('unrecognized historical evidence remains untouched and all canonical proofs replay unchanged',()=>{
 const row={eventId:'unknown',choiceText:'保留原話',body:'原文',result:'已發生',verbalOutcome:{version:2,origin:'unknown',target:'wing',phase:'event'}};
 for(const run of [undefined,{history:[]},{history:[row],actions:[]},{history:[row],actions:Array(301).fill({type:'verbal',version:2})}])assert.equal(history(row,{run}),row);
 const route=representativeRoutes()[0],source=sourceFor(route),pending=E.requestVerbal(source,undefined,2),raw=pending.history.at(-1),saved=copy(pending);
 history(polishVerbalHistoryV41(raw),{run:pending,rawRow:raw});
 assert.deepEqual(pending,saved);assert.equal(E.validRun(saved),true);
});

test('the actual UI helpers use the same contextual preview and history presenter',()=>{
 const app=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
 const helpers=app.slice(app.indexOf('const playerTitle='),app.indexOf('const shownEnding='));
 const route=representativeRoutes().find(row=>row.sourceEventId==='onboarding'),run=sourceFor(route),target=route.target;
 const sandbox=vm.createContext({...E,...persona,...titles,...princess,...arm,...armScene,...contextCopy,polishVerbalHistoryV41,run});
 vm.runInContext(`${helpers}\nglobalThis.preview=shownVerbalLine(run,'${target}');globalThis.project=shownHistory;`,sandbox);
 const pending=E.requestVerbal(run,undefined,2),raw=pending.history.at(-1);sandbox.run=pending;
 const shown=sandbox.project(raw);
 assert.equal(shown.choiceText,sandbox.preview);
 assert.equal(E.validRun(pending),true);
});

test('cached prefixes still verify the actual row and cannot lend a quotation to a different target',()=>{
 const route=representativeRoutes()[0],source=sourceFor(route),run=E.requestVerbal(source,undefined,2),raw=run.history.at(-1);
 history(raw,{run});
 raw.speaker='spencer';raw.verbalOutcome={...raw.verbalOutcome,target:'spencer'};
 assert.equal(history(raw,{run}),raw,'even a warm per-run cache rejects changed speaker evidence');
 const sibling=copy(run),other=sibling.history.at(-1);other.choiceText='這不是原本說過的話';
 assert.equal(history(other,{run:sibling}),other,'a shared prefix never makes an unrecognized quote canonical');
});
