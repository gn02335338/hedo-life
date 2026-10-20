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
import * as endingReport from '../dist/ending-report.js';
import * as endingReportView from '../dist/ending-report-view.js';
import {polishDreamText} from '../dist/copy-v15.js';

const appSource=(await readFile(new URL('../dist/app.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
const {routes}=JSON.parse(await readFile(new URL('../research/reachability-v3.json',import.meta.url),'utf8'));
const oldRoutes=JSON.parse(await readFile(new URL('./fixtures/legacy-e23-routes.json',import.meta.url),'utf8'));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const plain=value=>JSON.parse(JSON.stringify(value));
const esc=value=>persona.displayText(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function completed(route=routes[0]){const run=engine.replayRun(route.roleId,route.seed,route.actions);assert.equal(run.completed,true);assert.equal(engine.validRun(run),true);return run;}
async function harness(mobile,initialRun=null){
 const nodes=new Map(),listeners=new Map(),calls={save:0,proof:0,downloads:[],blobs:[],characters:[],focus:[]};
 const store=new Map(initialRun?[['hedo-life-v3',JSON.stringify({run:initialRun,unlocked:initialRun.completed?[initialRun.endingId]:[],achievements:{}})]]:[]);
 const node=selector=>{
  if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',title:'',open:false,
   classList:{add(){},remove(){},toggle(){}},focus(){calls.focus.push(selector);},setAttribute(){},scrollIntoView(){},addEventListener(){},
   showModal(){this.open=true;},close(){this.open=false;},
  });return nodes.get(selector);
 };
 const context=vm.createContext({...roles,...sources,...endings,...legacy,...engine,...achievements,...career,...currentCareer,...persona,...characterStats,...endingReport,...endingReportView,polishDreamText,
  createFeedbackUI:()=>({open(){}}),createCharacterBook:()=>({open(id){calls.characters.push(id);},onSnapshot(){},onRunChanged(){}}),
  cloud:{state:{status:'offline',achievements:[],characters:[]},subscribe(){},init:async()=>null,
   achievementProgress:async()=>null,characterProgress:async()=>{calls.proof++;return null;},complete:async()=>null},
  localStorage:{getItem:key=>store.get(key)||null,setItem(key,value){calls.save++;store.set(key,value);}},
  document:{querySelector:node,addEventListener(type,callback){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(callback);},body:{append(){}},
   createElement(){return{href:'',download:'',click(){calls.downloads.push({href:this.href,name:this.download});},remove(){}};}},
  window:{scrollTo(){},matchMedia:()=>({matches:mobile})},crypto:webcrypto,structuredClone,Blob,
  URL:{createObjectURL(blob){calls.blobs.push(blob);return`blob:salary-advice-${calls.blobs.length}`;},revokeObjectURL(){}},
  setTimeout:()=>1,clearTimeout(){},
 });
 vm.runInContext(appSource,context,{filename:'dist/app.js'});await tick();calls.save=0;calls.proof=0;
 async function click(dataset,choice=false){
  const target={closest:selector=>selector===(choice?'[data-choice]':'[data-action]')?{dataset}:null};
  for(const callback of listeners.get('click')||[])await callback({target});await tick();
 }
 return{calls,node,state:()=>vm.runInContext('run',context),html:()=>node('#main').innerHTML,dialogHTML:()=>node('#dialog-content').innerHTML,
  saved:()=>JSON.parse(store.get('hedo-life-v3')||'null'),
  render(run){context.fixtureRun=run;vm.runInContext('run=fixtureRun;game(true)',context);return node('#main').innerHTML;},
  renderLoaded(){vm.runInContext('game(true)',context);return node('#main').innerHTML;},
  journal(){return vm.runInContext('journalHTML()',context);},
  action:(action,extra={})=>click({action,...extra}),choice:index=>click({choice:String(index)},true),
 };
}


for(const mobile of [false,true]){
 const device=mobile?'mobile':'desktop';
 test(`${device}: a completed canonical life renders readable comparisons and three resource trends without rewriting its save`,async()=>{
  const run=completed(),before=JSON.stringify(run),app=await harness(mobile,run),saved=app.saved();
  const html=app.renderLoaded(),report=endingReport.buildEndingReport(run);
  assert.match(html,/class="ending-report(?:\s|")/);
  assert.doesNotMatch(html,/class="ending-stats"/,'the former unscaled number grid is gone');
  assert.match(html,/report-ability-chart/);assert.match(html,/report-trend-chart/);
  for(const key of Object.keys(engine.STAT_LABELS)){
   assert.equal([...html.matchAll(new RegExp(`(?:data-report-stat|data-trend-key)="${key}"`,'g'))].length,1,`${key} has one readable comparison`);
   assert.ok(html.includes(engine.STAT_LABELS[key]));
  }
  for(const key of ['mood','energy','cash'])assert.equal([...html.matchAll(new RegExp(`data-trend-key="${key}"`,'g'))].length,1);
  assert.match(html,/入職|起點/);assert.match(html,/離場/);assert.match(html,/選擇進程/);assert.match(html,/存款指數/);
  assert.doesNotMatch(html,/NaN|undefined|Infinity/);assert.equal(report.metadata.decisionCount,run.history.length);
  assert.ok(report.metadata.decisionCount>report.metadata.workTurns,'this natural route contains same-day notices and rest, not extra workdays');
  assert.equal(JSON.stringify(app.state()),before);assert.deepEqual(app.saved(),saved);
  assert.equal(app.calls.save,0);assert.equal(app.calls.proof,0);assert.ok(app.calls.focus.includes('#main'));
 });

 test(`${device}: report actions preserve the download, private ending collection, character book and replay path`,async()=>{
  const run=completed(),app=await harness(mobile,run),before=JSON.stringify(app.state());app.renderLoaded();
  await app.action('download');assert.equal(app.calls.downloads.length,1);assert.equal(app.calls.blobs.length,1);
  const svg=await app.calls.blobs[0].text();assert.match(svg,/<svg/);assert.match(svg,/月薪\d+K/);assert.doesNotMatch(svg,/NaN|undefined|遊戲月薪/);
  assert.match(app.calls.downloads[0].name,/^移動人生-.+\.svg$/);
  await app.action('characters');assert.deepEqual(app.calls.characters,['all']);
  await app.action('collection');assert.match(app.dialogHTML(),/未遇見|還沒遇見|先保密/);
  const grid=app.node('#ending-grid').innerHTML;assert.match(grid,/ending-card locked/);assert.match(grid,/question-mark/);
  assert.ok(grid.includes(esc(endings.ENDINGS.find(row=>row.id===run.endingId).title)));
  for(const ending of endings.ENDINGS.filter(row=>row.id!==run.endingId)){
   if(ending.body!==endings.ENDINGS.find(row=>row.id===run.endingId).body)assert.ok(!grid.includes(esc(ending.body)),'locked ending prose stays hidden');
  }
  await app.action('close-dialog');await app.action('new');assert.match(app.html(),/這次，你想應徵什麼/);
  assert.equal(JSON.stringify(app.state()),before,'opening the next-life occupation screen retains the completed record until a new life starts');
  assert.equal(app.calls.save,0);assert.equal(app.calls.proof,0);
 });

 test(`${device}: published e23 saved lives receive the same report without changing their replay inputs`,async()=>{
  const run=completed(oldRoutes[0]),before=JSON.stringify(run),app=await harness(mobile,run),saved=app.saved(),html=app.renderLoaded();
  assert.match(html,/ending-report/);assert.match(html,/report-ability-chart/);assert.match(html,/report-trend-chart/);
  assert.equal(JSON.stringify(app.state()),before);assert.deepEqual(app.saved(),saved);assert.equal(app.calls.save,0);assert.equal(app.calls.proof,0);
 });

 test(`${device}: an unfinished scene never shows a future report or unchosen result`,async()=>{
  const run=engine.createRun('sales','e25-report-no-spoilers'),app=await harness(mobile),before=JSON.stringify(run),html=app.render(run),event=engine.getEvent(run);
  assert.doesNotMatch(html,/ending-report|report-trend-chart|report-ability-chart/);
  for(const choice of event.choices)if(choice.result.length>10)assert.ok(!html.includes(esc(choice.result)));
  assert.equal(JSON.stringify(app.state()),before);assert.equal(app.calls.save,0);assert.equal(app.calls.proof,0);
 });
}

test('incomplete old history renders an honest report fallback instead of a fabricated origin or NaN',()=>{
 const run=completed();delete run.history[1].delta.mood;
 const before=JSON.stringify(run),html=endingReportView.renderEndingReport(run);
 assert.match(html,/不足|不完整|缺少|無法|起點未記錄/);assert.doesNotMatch(html,/NaN|undefined|Infinity/);
 assert.match(html,/data-trend-key="mood"/);
 assert.equal(JSON.stringify(run),before);
});
