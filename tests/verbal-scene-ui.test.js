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

const appSource=(await readFile(new URL('../dist/app.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
const {routes}=JSON.parse(await readFile(new URL('./fixtures/verbal-scene-routes.json',import.meta.url),'utf8'));
const plain=value=>JSON.parse(JSON.stringify(value));
const esc=value=>persona.displayText(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function sourceFor(route){
 const actions=route.baseActions;
 const source=route.phase==='result'?engine.applyChoice(engine.replayRun(route.roleId,route.seed,actions.slice(0,-1)),actions.at(-1).index):engine.replayRun(route.roleId,route.seed,actions);
 return {...source,runId:webcrypto.randomUUID()};
}
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
 return{context,calls,html:()=>node('#main').innerHTML,picker:()=>node('#dialog-content').innerHTML,dialog:()=>node('#dialog'),state:()=>vm.runInContext('run',context),
  render(run){context.testRun=run;vm.runInContext('run=testRun;game(true)',context);return node('#main').innerHTML;},
  action:(action,verbalTarget)=>click({action,verbalTarget}),
  cancel(){for(const callback of dialogListeners.get('cancel')||[])callback({target:node('#dialog')});node('#dialog').close();},
  async doubleChoice(index){const revision=vm.runInContext('gameViewRevision',context),dataset={choice:String(index),choiceView:String(revision)};await click(dataset,true,1);await click(dataset,true,2);},
 };
}


for(const mobile of [false,true]){
 const device=mobile?'mobile':'desktop';
 test(`${device}: each visible scene response previews only its actual line and speaking displays it once`,async()=>{
  const cases=[...routes.filter(row=>row.kind==='onboarding'),...routes.filter(row=>row.kind==='quote').slice(0,4),...routes.filter(row=>row.kind==='work')];
  assert.ok(cases.length>=5);
  for(const route of cases){
   const app=await harness(mobile),source=sourceFor(route),snapshot=JSON.stringify(source),targets=engine.getVerbalTargets(source),quote=engine.getVerbalLine(source,route.target),html=app.render(source);
   assert.ok(quote.length>15);assert.equal(quote,route.quote);assert.equal(JSON.stringify(app.state()),snapshot);assert.equal(app.calls.save,0);assert.equal(app.calls.proof,0);
   if(targets.length===1)assert.ok(html.includes(esc(quote)),'the literal response is readable before clicking');
   const expected=engine.requestVerbal(source,targets.length>1?route.target:undefined,2),row=expected.history.at(-1);
   if(row.result.length>20)assert.ok(!html.includes(esc(row.result)),'the reaction stays hidden');
   await app.action('verbal');if(targets.length>1)await app.action('verbal-target',route.target);await app.action('verbal');
   assert.equal(app.calls.verbal.length,1);assert.equal(app.calls.verbal[0].argsLength,3);assert.deepEqual(plain(app.state()),plain(expected));
   const result=app.html();assert.match(result,/class="spoken-line"/);assert.match(result,/aria-label="你說出口的話"/);assert.ok(result.includes(esc(quote)));assert.match(result,/真的說出口/);assert.match(result,/outcome-ledger/);
   assert.match(result,/<button[^>]*data-action="verbal" disabled/);assert.doesNotMatch(result,/reality-imagined|reality-real/);
   const action=app.state().actions.at(-1);assert.equal(action.type,'verbal');assert.equal(action.version,2);assert.equal(app.calls.save,1);assert.equal(app.calls.proof,1);
  }
 });
 test(`${device}: group target cards show distinct scene lines without committing until one person is chosen`,async()=>{
  const route=routes.find(row=>row.id==='group-event-sonny');assert.ok(route);const source=sourceFor(route),app=await harness(mobile),snapshot=JSON.stringify(source);
  app.render(source);await app.action('verbal');const picker=app.picker(),quotes=[];
  for(const target of ['erich','jenjen','sonny']){const line=engine.getVerbalLine(source,target);quotes.push(line);assert.ok(picker.includes(esc(line)));assert.ok(picker.includes(`data-verbal-target="${target}"`));}
  assert.equal(new Set(quotes).size,3);assert.equal(JSON.stringify(app.state()),snapshot);assert.equal(app.calls.save,0);assert.equal(app.calls.proof,0);
  assert.doesNotMatch(picker,/成功率|好感[ +−-]\d|\d+(?:\.\d+)?[%％]/);
  await app.action('verbal-cancel');assert.equal(JSON.stringify(app.state()),snapshot);await app.action('verbal');await app.action('verbal-target','sonny');
  const expected=engine.requestVerbal(source,'sonny',2);assert.deepEqual(plain(app.state()),plain(expected));assert.equal(app.state().history.at(-1).verbalOutcome.target,'sonny');
  const before=characterStats.deriveCharacterStats(source),after=characterStats.deriveCharacterStats(app.state());
  for(const row of before){const now=after.find(item=>item.id===row.id);assert.equal(now.realHits,row.realHits);assert.equal(now.imaginedHits,row.imaginedHits);if(row.id!=='sonny')assert.deepEqual(now,row);}
 });
 test(`${device}: recruitment can immediately end employment and daily speech moves beyond the original question`,async()=>{
  const lost=routes.find(row=>row.id==='onboarding-dismissed');assert.ok(lost);const app=await harness(mobile),source=sourceFor(lost);app.render(source);await app.action('verbal');
  assert.ok(app.state().pendingFamily||app.state().verbalContext||app.state().pendingEffect);await app.action('next');
  assert.notEqual(app.state().eventId,'onboarding');assert.equal(app.state().completed,true);assert.match(app.html(),/ending/);assert.equal(app.state().endingId,lost.endingId);
  const work=routes.find(row=>row.phase==='event'&&['daily','fantasy'].includes(row.sourceKind)&&['ignored','relationship','retort','support'].includes(row.branch)&&!row.expected.completed);assert.ok(work);const another=await harness(mobile),atWork=sourceFor(work);another.render(atWork);await another.action('verbal');await another.action('next');
  assert.notEqual(another.state().eventId,atWork.eventId);assert.equal(another.state().turn,atWork.turn+1);assert.equal(engine.validRun(another.state()),true);
 });
}
