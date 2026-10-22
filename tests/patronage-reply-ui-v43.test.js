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
import * as jobTitles from '../dist/job-titles-v42.js';
import {polishVerbalHistoryV41} from '../dist/verbal-presentation-v41.js';
import {renderEndingTransition} from '../dist/ending-transition-v40.js';

const appSource=(await readFile(new URL('../dist/app.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
const plain=value=>JSON.parse(JSON.stringify(value));
const esc=value=>persona.displayText(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function harness(mobile){
 const nodes=new Map(),listeners=new Map(),dialogListeners=new Map(),calls={verbal:[],patronage:[],save:0,proof:0,advance:0};
 const node=selector=>{
  if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',title:'',open:false,scrollTop:0,
   classList:{add(){},remove(){},toggle(){}},focus(){},scrollIntoView(){},setAttribute(){},
   addEventListener(type,callback){if(selector!=='#dialog')return;if(!dialogListeners.has(type))dialogListeners.set(type,[]);dialogListeners.get(type).push(callback);},
   showModal(){this.open=true;},close(){this.open=false;for(const callback of dialogListeners.get('close')||[])callback({target:this});},
  });return nodes.get(selector);
 };
 const context=vm.createContext({...roles,...sources,...endings,...legacy,...engine,...achievements,...career,...currentCareer,...persona,...characterStats,...jobTitles,polishDreamText,polishVerbalHistoryV41,renderEndingReport,renderEndingTransition,
  requestPatronageReply(...args){calls.patronage.push(args[1]);return engine.requestPatronageReply(...args);},
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
 return{context,calls,html:()=>node('#main').innerHTML,picker:()=>node('#dialog-content').innerHTML,dialog:()=>node('#dialog'),state:()=>vm.runInContext('run',context),
  render(run){context.testRun=run;vm.runInContext('run=testRun;game(true)',context);return node('#main').innerHTML;},
  action:(action,patronageTarget)=>click({action,patronageTarget}),
  cancel(){for(const callback of dialogListeners.get('cancel')||[])callback({target:node('#dialog')});node('#dialog').close();},
  async doubleChoice(index){const revision=vm.runInContext('gameViewRevision',context),dataset={choice:String(index),choiceView:String(revision)};await click(dataset,true,1);await click(dataset,true,2);},
 };
}


const patronageFixtures=JSON.parse(await readFile(new URL('./fixtures/patronage-routes-v29.json',import.meta.url),'utf8')).routes;
function appointed(gender,group=false){
 const route=patronageFixtures.find(row=>row.id===`application-${gender}-success`),suffix=group?['reading-list-rush','system-weekend','kind-workday','system-printer','jonathan-today-release'].map(eventId=>({type:'choice',eventId,index:2})):[];
 return {...engine.replayRun(route.roleId,route.seed,[...route.actions,...suffix]),runId:webcrypto.randomUUID()};
}
for(const mobile of [false,true]){
 const device=mobile?'mobile':'desktop';
 test(`${device}: appointed reply previews the right tone and reveals only the committed reaction`,async()=>{
  for(const [gender,target,stance]of [['male','wing','向上表忠'],['female','helen','擺點架子']]){
   const source=appointed(gender),app=await harness(mobile),snapshot=JSON.stringify(source),line=engine.getPatronageReplyLine(source,target),expected=engine.requestPatronageReply(source,target),result=expected.history.at(-1).result;
   const html=app.render(source);assert.match(html,/class="choice patronage-trigger"/);assert.ok(html.includes(stance));assert.ok(html.includes(esc(line)));
   assert.ok(html.indexOf('data-action="patronage-reply"')>html.lastIndexOf('data-choice="'));assert.ok(html.indexOf('data-action="patronage-reply"')<html.indexOf('data-action="rage"'));
   assert.ok(!html.includes(esc(result)));assert.equal(JSON.stringify(app.state()),snapshot);assert.equal(app.calls.save,0);assert.equal(app.calls.proof,0);
   await app.action('patronage-reply');await app.action('patronage-reply');
   assert.deepEqual(plain(app.state()),plain(expected));assert.deepEqual(app.calls.patronage,[target]);assert.equal(app.calls.save,1);assert.equal(app.calls.proof,1);
   assert.equal(app.html().split(esc(line)).length-1,1);assert.ok(app.html().includes(esc(result)));assert.match(app.html(),/這次實際變化/);
   assert.doesNotMatch(app.html(),/reality-imagined|reality-real|真的說出口 這是口頭衝突/);
   await app.action('next');assert.equal(app.state().eventId,source.eventId);assert.equal(app.state().turn,source.turn);assert.match(app.html(),/data-action="patronage-reply" disabled/);
   assert.ok(app.html().includes('data-choice="0"'));assert.equal(engine.validRun(plain(app.state())),true);
  }
 });
 test(`${device}: group preview, cancel and stale cards cannot roll or change the target`,async()=>{
  const source=appointed('male',true),app=await harness(mobile),snapshot=JSON.stringify(source);app.render(source);
  await app.action('patronage-reply');const picker=app.picker();assert.match(picker,/data-patronage-target-picker/);
  for(const id of ['rick','wing']){assert.ok(picker.includes(`data-patronage-target="${id}"`));assert.ok(picker.includes(esc(engine.getPatronageReplyLine(source,id))));}
  assert.match(picker,/向上表忠/);assert.match(picker,/擺點架子/);assert.doesNotMatch(picker,/成功率|機率|好感[ +−-]\d|\d+(?:\.\d+)?[%％]/);
  await app.action('patronage-target','spencer');assert.equal(JSON.stringify(app.state()),snapshot);assert.equal(app.calls.save,0);
  await app.action('patronage-cancel');assert.equal(JSON.stringify(app.state()),snapshot);assert.equal(app.calls.proof,0);
  await app.action('patronage-reply');await app.action('patronage-target','rick');await app.action('patronage-target','wing');
  assert.deepEqual(app.calls.patronage,['rick']);assert.deepEqual(plain(app.state()),plain(engine.requestPatronageReply(source,'rick')));
 });
 test(`${device}: the special option does not appear before formal appointment`,async()=>{
  const app=await harness(mobile);assert.doesNotMatch(app.render(engine.createRun('sales','e39-not-appointed')),/data-action="patronage-reply"/);
 });
}
