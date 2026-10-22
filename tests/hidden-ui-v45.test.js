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
import * as hidden from '../dist/hidden-encounter-v45.js';
import {renderSceneIllustration} from '../dist/illustrations-v38.js';
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
 const context=vm.createContext({...roles,...sources,...endings,...legacy,...engine,...achievements,...career,...currentCareer,...persona,...characterStats,...jobTitles,...activityUI,...hidden,renderSceneIllustration,polishDreamText,polishVerbalHistoryV41,renderEndingReport,renderEndingTransition,
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




function ready(){
 const actions=[['onboarding',0],['job-system-rollback',0],['education-scrutiny',0],['salary-cut',0]].map(([eventId,index])=>({type:'choice',eventId,index}));
 return {...engine.replayRun('system','e39-hidden-natural-10',actions),runId:webcrypto.randomUUID()};
}
for(const mobile of [false,true]){
 const device=mobile?'mobile':'desktop';
 test(`${device}: a rare encounter opens automatically once, with a distinct frame and a sealed book link`,async()=>{
  const source=ready(),app=await harness(mobile),expected=engine.requestHiddenEncounter(source),event=engine.getEvent(expected);
  assert.equal(engine.canRequestHiddenEncounter(source),true);app.render(source);
  await app.action('continue');assert.deepEqual(plain(app.state()),plain(expected));
  assert.match(app.html(),/hidden-character-chapter/);assert.match(app.html(),/遇見隱藏角色/);assert.match(app.html(),/RARE ENCOUNTER/);
  assert.match(app.html(),/魚酥姐/);assert.match(app.html(),/公開圖鑑仍保留/);
  assert.match(app.html(),/hidden-visitor.png/);assert.doesNotMatch(app.html(),/data-character-id="hidden-visitor"|api\/admin\/portrait/);
  assert.equal((app.html().match(/data-choice="3"/g)||[]).length,1);assert.equal((app.html().match(/data-choice="4"/g)||[]).length,1);
  assert.ok(app.html().indexOf('data-choice="3"')>app.html().indexOf('data-choice="2"'));
  assert.ok(app.html().indexOf('data-choice="4"')>app.html().indexOf('data-choice="3"'));
  assert.ok(!app.html().includes(esc(engine.applyChoice(expected,0).history.at(-1).result)));
  const before=JSON.stringify(app.state());await app.action('continue');assert.equal(JSON.stringify(app.state()),before);
  await app.doubleChoice(0);assert.equal(engine.validRun(plain(app.state())),true);assert.match(app.html(),/這次實際變化/);
  await app.action('next');assert.equal(app.state().eventId,source.eventId);assert.equal(app.state().turn,source.turn);
  assert.equal(engine.validRun(plain(app.state())),true);assert.doesNotMatch(app.html(),/hidden-character-chapter/);
 });
 test(`${device}: special spoken and rage choices resolve once without accidentally choosing ordinary work`,async()=>{
  for(const index of [3,4]){
   const app=await harness(mobile),source=ready();app.render(source);await app.action('continue');
   const opened=app.state(),expected=engine.applyChoice(opened,index);await app.doubleChoice(index);
   assert.deepEqual(plain(app.state()),plain(expected));assert.equal(app.state().turn,source.turn);
   const row=app.state().history.at(-1),html=app.html();
   assert.ok(html.includes(esc(row.result)));assert.ok(!html.includes('今天已經出過這口氣'));
   if(index===3){assert.equal(html.split(esc(row.choiceText)).length-1,1);assert.match(html,/真的說出口/);}
   if(row.hiddenOutcome.mode==='imagined')assert.match(html,/腦內夢境|現實沒有動手/);
   await app.action('next');
   if(app.state().hiddenEncounterContext){await app.doubleChoice(0);await app.action('next');}
   assert.equal(app.state().eventId,source.eventId);assert.equal(app.state().turn,source.turn);
   assert.equal(engine.validRun(plain(app.state())),true);
  }
 });
}
