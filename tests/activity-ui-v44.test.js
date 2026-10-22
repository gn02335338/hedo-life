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
import * as activityUI from '../dist/activity-ui-v44.js';
import * as activities from '../dist/activities-v44.js';
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
 const context=vm.createContext({...roles,...sources,...endings,...legacy,...engine,...achievements,...career,...currentCareer,...persona,...characterStats,...jobTitles,...activityUI,polishDreamText,polishVerbalHistoryV41,renderEndingReport,renderEndingTransition,
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
  action:(action,activityId)=>click({action,activityId}),
  cancel(){for(const callback of dialogListeners.get('cancel')||[])callback({target:node('#dialog')});node('#dialog').close();},
  async doubleChoice(index){const revision=vm.runInContext('gameViewRevision',context),dataset={choice:String(index),choiceView:String(revision)};await click(dataset,true,1);await click(dataset,true,2);},
 };
}



function sourceRun(role='sales'){
 for(let i=0;i<100;i++){
  const run=engine.advance(engine.applyChoice(engine.createRun(role,`e39-activity-ui-${i}`),0));
  if(engine.canRequestActivity(run))return {...run,runId:webcrypto.randomUUID()};
 }
 throw new Error('No natural activity source');
}
for(const mobile of [false,true]){
 const device=mobile?'mobile':'desktop';
 test(`${device}: browsing/canceling activities never commits a choice or reveals outcomes`,async()=>{
  const source=sourceRun(),app=await harness(mobile);const initial=JSON.stringify(source);
  const html=app.render(source);assert.match(html,/今天還有這件事/);assert.match(html,/data-action="activity-menu"/);
  await app.action('activity-menu');const picker=app.picker();
  for(const id of activities.ACTIVITY_IDS_V44)assert.ok(picker.includes(`data-activity-id="${id}"`));
  assert.doesNotMatch(picker,/成功率|機率|好感[ +−-]\d|\d+(?:\.\d+)?[%％]/);
  assert.equal(JSON.stringify(app.state()),initial);assert.equal(app.calls.save,0);
  await app.action('activity-cancel');await app.action('activity-start','arm');
  assert.equal(JSON.stringify(app.state()),initial);assert.equal(app.calls.save,0);
 });
 test(`${device}: seven distinct activities survive every selected result and return to unanswered work`,async()=>{
  for(const id of activities.ACTIVITY_IDS_V44){
   const source=sourceRun(id==='review'?'design':'sales'),app=await harness(mobile);app.render(source);
   await app.action('activity-menu');await app.action('activity-start',id);await app.action('activity-start',id);
   assert.equal(app.state().actions.length,source.actions.length+1);
   assert.match(app.html(),/aria-label="目前活動進度"/);
   assert.match(app.html(),/先完成目前活動/);
   for(let step=0;step<activities.ACTIVITY_META_V44[id].stages;step++){
    const event=engine.getEvent(app.state()),expected=engine.applyChoice(app.state(),0),result=expected.history.at(-1).result;
    assert.ok(!app.html().includes(esc(result)));
    await app.doubleChoice(0);assert.deepEqual(plain(app.state()),plain(expected));
    assert.equal(app.html().split(esc(result)).length-1,1);
    assert.match(app.html(),/這次實際變化/);
    assert.equal(engine.validRun(plain(app.state())),true);
    await app.action('next');assert.equal(engine.validRun(plain(app.state())),true);
   }
   assert.equal(app.state().eventId,source.eventId);assert.equal(app.state().turn,source.turn);
   assert.equal(app.state().pending,false);assert.ok(!app.state().activityContext);
   assert.match(app.html(),/data-choice="0"/);
   assert.doesNotMatch(app.html(),/aria-label="目前活動進度"/);
  }
 });
 test(`${device}: a stale activity picker cannot start on a different save`,async()=>{
  const source=sourceRun(),app=await harness(mobile);app.render(source);await app.action('activity-menu');
  const different=sourceRun('bd');app.render(different);const before=JSON.stringify(app.state());
  await app.action('activity-start','review');assert.equal(JSON.stringify(app.state()),before);assert.equal(app.calls.save,0);
 });
}
