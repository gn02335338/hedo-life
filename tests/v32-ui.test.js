import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import * as roles from '../dist/roles.js';
import * as sources from '../dist/public-sources.js';
import * as endings from '../dist/endings.js';
import * as legacy from '../dist/legacy.js';
import * as engine from '../dist/engine.js';
import * as achievements from '../dist/achievements.js';
import * as career from '../dist/career-api.js';
import * as currentCareer from '../dist/career-v17.js';
import * as persona from '../dist/persona.js';
import * as characterStats from '../dist/character-stats.js';
import {renderEndingReport} from '../dist/ending-report-view.js';
import {polishDreamText} from '../dist/copy-v15.js';
import {ACHIEVEMENTS_V32} from '../dist/achievements-v32.js';
import {buildEndingReport} from '../dist/ending-report.js';

const appSource=(await readFile(new URL('../dist/app.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
const {routes}=JSON.parse(await readFile(new URL('./fixtures/v32-routes.json',import.meta.url),'utf8'));
const plain=value=>JSON.parse(JSON.stringify(value));
const esc=value=>persona.displayText(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function harness(mobile){
 const nodes=new Map(),listeners=new Map(),dialogListeners=new Map(),calls={verbal:[],save:0,proof:0,advance:0};
 const node=selector=>{
  if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',title:'',open:false,scrollTop:0,
   classList:{add(){},remove(){},toggle(){}},focus(){},scrollIntoView(){},setAttribute(){},
   addEventListener(type,callback){if(selector!=='#dialog')return;if(!dialogListeners.has(type))dialogListeners.set(type,[]);dialogListeners.get(type).push(callback);},
   showModal(){this.open=true;},close(){this.open=false;for(const callback of dialogListeners.get('close')||[])callback({target:this});},
  });return nodes.get(selector);
 };
 const context=vm.createContext({...roles,...sources,...endings,...legacy,...engine,...achievements,...career,...currentCareer,...persona,...characterStats,polishDreamText,renderEndingReport,
  requestVerbal(...args){calls.verbal.push({argsLength:args.length,target:args[1],phase:args[0].pending?'result':'event'});return engine.requestVerbal(...args);},
  advance(run){calls.advance++;return engine.advance(run);},
  createFeedbackUI:()=>({open(){}}),createCharacterBook:()=>({open(){},onSnapshot(){},onRunChanged(){}}),
  cloud:{state:{status:'local',achievements:[],characters:[]},subscribe(){},init:async()=>null,achievementProgress:async()=>null,characterProgress:async()=>{calls.proof++;return null;},complete:async()=>null},
  localStorage:{getItem:()=>null,setItem(){calls.save++;}},document:{querySelector:node,addEventListener(type,callback){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(callback);}},
  window:{scrollTo(){},matchMedia:()=>({matches:mobile})},crypto:webcrypto,structuredClone,setTimeout:()=>1,clearTimeout(){},
 });
 vm.runInContext(appSource,context);await tick();calls.save=0;calls.proof=0;
 const click=async(dataset,choice=false,detail=1)=>{
  const target={closest:selector=>selector===(choice?'[data-choice]':'[data-action]')?{dataset}:null};
  for(const callback of listeners.get('click')||[])await callback({target,detail});await tick();
 };
 return{context,calls,html:()=>node('#main').innerHTML,grid:()=>node('#ending-grid').innerHTML,picker:()=>node('#dialog-content').innerHTML,dialog:()=>node('#dialog'),state:()=>vm.runInContext('run',context),
  render(run){context.testRun=run;vm.runInContext('run=testRun;game(true)',context);return node('#main').innerHTML;},
  action:(action,verbalTarget)=>click({action,verbalTarget}),
  cancel(){for(const callback of dialogListeners.get('cancel')||[])callback({target:node('#dialog')});node('#dialog').close();},
  async doubleChoice(index){const revision=vm.runInContext('gameViewRevision',context),dataset={choice:String(index),choiceView:String(revision)};await click(dataset,true,1);await click(dataset,true,2);},
 };
}



function hidden(html,item){assert.ok(!html.includes(`<h3>${esc(item.title)}</h3>`),item.id);assert.ok(!html.includes(esc(item.description)),item.id);assert.ok(!html.includes(item.image),item.id);}
for(const mobile of [false,true]){
 const device=mobile?'mobile':'desktop';
 test(`${device}: new ending names and all 26 illustrated goals remain hidden until the actual resolved branch`,async()=>{
  const app=await harness(mobile),route=routes.find(row=>row.ending==='verbal_onboarding-system');assert.ok(route);
  const ready=engine.replayRun(route.roleId,route.seed,route.actions.slice(0,-1));assert.equal(ready.eventId,'verbal-v32-aftermath');
  const html=app.render({...ready,runId:webcrypto.randomUUID()});assert.match(html,/口舌風波/);
  for(const ending of endings.ENDINGS.slice(545))assert.ok(!html.includes(esc(ending.title)),ending.id);
  await app.action('achievements');for(const item of ACHIEVEMENTS_V32)hidden(app.picker(),item);app.dialog().close();
  await app.action('collection');for(let page=0;page<Math.ceil(endings.ENDINGS.length/24);page++)await app.action('more-endings');assert.equal([...app.grid().matchAll(/class="ending-card locked"/g)].length,805);for(const ending of endings.ENDINGS.slice(545))assert.ok(!app.grid().includes(`<h3>${esc(ending.title)}</h3>`),ending.id);app.dialog().close();
  // Return to the same untouched source, then commit the chosen consequence.
  app.render({...ready,runId:webcrypto.randomUUID()});await app.doubleChoice(route.actions.at(-1).index);
  assert.equal(app.state().pending,true);assert.equal(app.state().actions.length,ready.actions.length+1,'double click cannot choose twice');
  await app.action('next');assert.equal(app.state().endingId,route.ending);assert.equal(app.state().completed,true);
  assert.equal(buildEndingReport(app.state()).metadata.complete,true);assert.match(app.html(),/THIS LIFE \/ REPORT/);
  const earned=new Set(achievements.deriveAchievements(app.state()));assert.ok(earned.has('verbal-onboarding'));
  await app.action('achievements');const book=app.picker();
  for(const item of ACHIEVEMENTS_V32)if(earned.has(item.id)){assert.ok(book.includes(item.image));assert.ok(book.includes(esc(item.title)));}else hidden(book,item);
  assert.ok(!earned.has('rage-real'));assert.ok(!earned.has('rage-imagined'));
 });
 test(`${device}: all ten company outcomes keep their draw hidden, block nested actions and render the actual finale`,async()=>{
  for(const family of ['nasdaq','nasdaq_failed','taiwan','taiwan_failed','google_board','google_ousted','buyer_board','buyer_ousted','vietnam_core','vietnam_afterdark']){
   const route=routes.find(row=>row.ending===`${family}-system`);assert.ok(route,family);
   const ready=engine.replayRun(route.roleId,route.seed,route.actions.slice(0,-1)),app=await harness(mobile),before=JSON.stringify(ready);
   const html=app.render({...ready,runId:webcrypto.randomUUID()});assert.match(html,/公司幻想線/);assert.match(html,/先確認眼前的公司方案/);
   for(const action of ['break','career','raise','exit']){const button=html.match(new RegExp(`<button\\b(?=[^>]*data-action="${action}")[^>]*>`))?.[0];if(button)assert.match(button,/disabled/,action);}
   for(const outcome of engine.getEvent(ready).choices.flatMap(choice=>choice.draw?.outcomes||[]))assert.ok(!html.includes(outcome.result),family);
   assert.equal(JSON.stringify(ready),before,'reading cannot reroll the company result');
   await app.doubleChoice(route.actions.at(-1).index);assert.equal(app.state().pending,true);await app.action('next');
   assert.equal(app.state().endingId,route.ending);assert.equal(app.state().companyContext,null);assert.equal(buildEndingReport(app.state()).metadata.complete,true);
   if(family==='taiwan'){assert.match(app.html(),/上櫃/);const expected=persona.displayText(endings.ENDINGS.find(row=>row.id===route.ending).body).replaceAll('上市','上櫃');assert.ok(app.html().includes(esc(expected)));}
   await app.action('achievements');const earned=new Set(achievements.deriveAchievements(app.state()));for(const item of ACHIEVEMENTS_V32)if(!earned.has(item.id))hidden(app.picker(),item);
  }
 });
}
