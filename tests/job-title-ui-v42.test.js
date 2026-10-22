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
 const nodes=new Map(),listeners=new Map(),dialogListeners=new Map(),calls={verbal:[],save:0,proof:0,advance:0};
 const node=selector=>{
  if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',title:'',open:false,scrollTop:0,
   classList:{add(){},remove(){},toggle(){}},focus(){},scrollIntoView(){},setAttribute(){},
   addEventListener(type,callback){if(selector!=='#dialog')return;if(!dialogListeners.has(type))dialogListeners.set(type,[]);dialogListeners.get(type).push(callback);},
   showModal(){this.open=true;},close(){this.open=false;for(const callback of dialogListeners.get('close')||[])callback({target:this});},
  });return nodes.get(selector);
 };
 const context=vm.createContext({...roles,...sources,...endings,...legacy,...engine,...achievements,...career,...currentCareer,...persona,...characterStats,...jobTitles,polishDreamText,polishVerbalHistoryV41,renderEndingReport,renderEndingTransition,
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
  action:(action,verbalTarget)=>click({action,verbalTarget}),
  cancel(){for(const callback of dialogListeners.get('cancel')||[])callback({target:node('#dialog')});node('#dialog').close();},
  async doubleChoice(index){const revision=vm.runInContext('gameViewRevision',context),dataset={choice:String(index),choiceView:String(revision)};await click(dataset,true,1);await click(dataset,true,2);},
 };
}


for(const mobile of [false,true]){
 const device=mobile?'mobile':'desktop';
 test(`${device}: AI reassignment names system career in badge, onboarding, speech and journal without changing the run`,async()=>{
  const app=await harness(mobile),source=engine.createRun('ai','e38-title-audit-0'),snapshot=JSON.stringify(source);
  assert.equal(source.actualRoleId,'system');assert.equal(engine.jobTitle(source),'工程師');
  const canonical=engine.getVerbalLine(source,'wing'),line=jobTitles.displayPlayerVerbalLineV42(canonical,source),html=app.render(source);
  assert.match(html,/<h2>系統工程師<\/h2>/);assert.match(html,/實際職稱是「系統工程師」/);
  assert.match(line,/錄取信寫AI工程師，報到卻叫我做系統工程師/);assert.ok(html.includes(esc(line)));
  assert.doesNotMatch(html,/報到卻叫我做工程師|實際職稱是「工程師」/);
  assert.equal(JSON.stringify(app.state()),snapshot);assert.equal(app.calls.save,0);assert.equal(app.calls.proof,0);
  await app.action('career-guide');const guide=app.picker();
  for(const title of ['助理系統工程師','系統工程師','資深系統工程師','主任系統工程師','系統工程副理','系統工程經理','系統工程總監','技術長 CTO'])assert.ok(guide.includes(title),title);
  app.dialog().close();await app.action('verbal');const expected=engine.requestVerbal(source,undefined,2);
  assert.deepEqual(plain(app.state()),plain(expected));assert.equal(app.state().history.at(-1).choiceText,canonical);
  const result=app.html();assert.equal(result.split(esc(line)).length-1,1,'the spoken line appears once');
  assert.match(result,/目前實際職稱：系統工程師/);assert.doesNotMatch(result,/報到卻叫我做工程師|目前實際職稱：工程師/);
  await app.action('journal');assert.ok(app.picker().includes(esc(line)));assert.match(app.picker(),/系統工程師 · 月薪/);
  assert.deepEqual(plain(app.state()),plain(expected));
 });
 test(`${device}: AI and MIS badges and NPC titles retain their own professions`,async()=>{
  for(const role of ['ai','mis']){
   let source;for(let index=0;index<100;index++){const candidate=engine.createRun(role,`e39-title-honest-${index}`);if(candidate.assignment==='honest'){source=candidate;break;}}
   assert.ok(source);const app=await harness(mobile),html=app.render(source);
   assert.ok(html.includes(`<h2>${engine.jobTitle(source)}</h2>`));assert.doesNotMatch(html,/<h2>系統工程師<\/h2>/);
  }
  assert.equal(persona.PERSONAS.jonathan.title,'助理工程師');
 });
}
