import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
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
import {polishDreamText} from '../dist/copy-v15.js';
import {renderEndingReport} from '../dist/ending-report-view.js';

const {routes}=JSON.parse(readFileSync(new URL('./fixtures/starting-salary-advice-routes.json',import.meta.url),'utf8'));
const appSource=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
const plain=value=>JSON.parse(JSON.stringify(value));
const fixture=id=>{const route=routes.find(row=>row.id===id);assert.ok(route,id);return route;};
const from=(id,field='actions')=>{const route=fixture(id);return {...engine.replayRun(route.roleId,route.seed,route[field]),runId:webcrypto.randomUUID()};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const esc=value=>persona.displayText(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

async function harness(mobile,initialRun=null){
 const nodes=new Map(),listeners=new Map(),calls={save:0,proof:0},store=new Map(initialRun?[['hedo-life-v3',JSON.stringify({run:initialRun,unlocked:[],achievements:{}})]]:[]);
 const node=selector=>{
  if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',title:'',open:false,classList:{add(){},remove(){},toggle(){}},focus(){},setAttribute(){},scrollIntoView(){},addEventListener(){},showModal(){this.open=true;},close(){this.open=false;}});return nodes.get(selector);
 };
 const context=vm.createContext({...roles,...sources,...endings,...legacy,...engine,...achievements,...career,...currentCareer,...persona,...characterStats,polishDreamText,renderEndingReport,
  createFeedbackUI:()=>({open(){}}),createCharacterBook:()=>({open(){},onSnapshot(){},onRunChanged(){}}),
  cloud:{state:{status:'offline',achievements:[],characters:[]},subscribe(){},init:async()=>null,achievementProgress:async()=>null,characterProgress:async()=>{calls.proof++;return null;},complete:async()=>null},
  localStorage:{getItem:key=>store.get(key)||null,setItem(key,value){calls.save++;store.set(key,value);}},document:{querySelector:node,addEventListener(type,callback){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(callback);}},
  window:{scrollTo(){},matchMedia:()=>({matches:mobile})},crypto:webcrypto,structuredClone,setTimeout:()=>1,clearTimeout(){},
 });
 vm.runInContext(appSource,context);await tick();calls.save=0;calls.proof=0;
 const click=async(dataset,choice=false,detail=1)=>{
  const target={closest:selector=>selector===(choice?'[data-choice]':'[data-action]')?{dataset}:null};
  for(const callback of listeners.get('click')||[])await callback({target,detail});await tick();
 };
 return{calls,html:()=>node('#main').innerHTML,state:()=>vm.runInContext('run',context),saved:()=>JSON.parse(store.get('hedo-life-v3')||'null'),
  render(run){context.fixtureRun=run;vm.runInContext('run=fixtureRun;game(true)',context);return node('#main').innerHTML;},
  renderLoaded(){vm.runInContext('game(true)',context);return node('#main').innerHTML;},
  candidate(run){context.fixtureRun=run;vm.runInContext('candidate=fixtureRun;selectedRole=fixtureRun.roleId;rollScreen()',context);return node('#main').innerHTML;},
  action:action=>click({action}),
  async choice(index,twice=false){const revision=vm.runInContext('gameViewRevision',context),dataset={choice:String(index),choiceView:String(revision)};await click(dataset,true,1);if(twice)await click(dataset,true,2);},
 };
}

for(const mobile of [false,true]){
 const device=mobile?'mobile':'desktop';
 test(`${device}: restoring a saved 27K administrative life catches up on Continue, while game rendering stays pure`,async()=>{
  const run=from('admin-27'),snapshot=plain(run),app=await harness(mobile,run);assert.equal(app.state().salaryAdvice,null);
  const html=app.renderLoaded();assert.match(html,/27<small>K/);assert.doesNotMatch(html,/法師看了一眼你的錄取條件/);assert.deepEqual(plain(app.state()),snapshot);assert.equal(app.calls.save,0);assert.equal(app.calls.proof,0);
  await app.action('continue');const opened=app.state(),expected=engine.requestSalaryAdvice(run);assert.deepEqual(plain(opened),plain(expected));assert.equal(opened.salaryAdvice.origin,'starting-pay');assert.equal(opened.eventId,'low-pay-tip');assert.equal(app.calls.save,1);assert.equal(app.calls.proof,1);
  assert.match(app.html(),/法師看了一眼你的錄取條件/);assert.match(app.html(),/報到時就是27K/);assert.match(app.html(),/src="\.\/assets\/erich\.png"/);
  assert.deepEqual(app.saved().run,plain(opened));await app.action('continue');assert.deepEqual(plain(app.state()),plain(expected));assert.equal(app.state().actions.filter(action=>action.type==='salary-advice').length,1);
 });

 test(`${device}: onboarding waits until Next, including earlier first-day dreams and speech, then opens advice exactly once`,async()=>{
  for(const id of ['admin-27','onboarding-after-dream','onboarding-after-verbal']){
   const route=fixture(id),last=route.actions.at(-1),before=engine.replayRun(route.roleId,route.seed,route.actions.slice(0,-1)),pending={...engine.applyChoice(before,last.index),runId:webcrypto.randomUUID()},app=await harness(mobile);
   assert.equal(pending.eventId,'onboarding');assert.equal(pending.pending,true);app.render(pending);assert.equal(app.state().salaryAdvice,null);assert.doesNotMatch(app.html(),/法師看了一眼你的錄取條件/);
   const expected=engine.requestSalaryAdvice(engine.advance(pending));await app.action('next');assert.deepEqual(plain(app.state()),plain(expected));assert.equal(app.state().eventId,'low-pay-tip');assert.equal(app.state().history.filter(row=>row.eventId==='onboarding').length,1);
   await app.action('next');assert.deepEqual(plain(app.state()),plain(expected));assert.equal(app.state().actions.filter(action=>action.type==='salary-advice').length,1);assert.equal(engine.validRun(app.state()),true);
  }
 });

 test(`${device}: all three replies hide future changes, commit once and resume the saved work without a day or PIP tick`,async()=>{
  for(const index of [0,1,2])for(const id of ['admin-27','active-pip']){
   const run=from(id,'openActions'),app=await harness(mobile,run),event=engine.getEvent(run),html=app.renderLoaded();
   for(const choice of event.choices){assert.ok(html.includes(esc(choice.text)));assert.ok(!html.includes(esc(choice.result)));}
   assert.doesNotMatch(html,/outcome-ledger|delta-chip|luck-result/);const expected=engine.applyChoice(run,index);await app.choice(index,true);
   assert.deepEqual(plain(app.state()),plain(expected));assert.equal(app.calls.save,1);assert.equal(app.calls.proof,1);assert.ok(app.html().includes(esc(expected.history.at(-1).result)));assert.match(app.html(),/outcome-ledger/);
   await app.action('next');const resumed=app.state(),done=engine.advance(expected);assert.deepEqual(plain(resumed),plain(done));assert.equal(resumed.salaryAdvice.status,'done');assert.equal(resumed.eventId,run.salaryAdvice.returnEventId);
   assert.equal(resumed.turn,run.turn);assert.equal(resumed.rng,run.rng);assert.deepEqual(plain(resumed.pip),plain(run.pip));assert.deepEqual([...resumed.seen],[...run.seen]);assert.equal(resumed.stats.cash,run.stats.cash);assert.equal(resumed.stats.energy,run.stats.energy);assert.equal(resumed.history.filter(row=>row.eventId==='low-pay-tip').length,1);
  }
 });

 test(`${device}: restarting with the open or completed reminder never adds a second action or notice`,async()=>{
  const run=from('admin-27','openActions'),opened=await harness(mobile,run);await opened.action('continue');assert.deepEqual(plain(opened.state()),plain(run));assert.equal(opened.calls.save,0);assert.equal(opened.calls.proof,0);
  const done=engine.advance(engine.applyChoice(run,0)),finished=await harness(mobile,done);await finished.action('continue');assert.deepEqual(plain(finished.state()),plain(done));assert.equal(finished.state().actions.filter(action=>action.type==='salary-advice').length,1);assert.equal(finished.state().history.filter(row=>row.eventId==='low-pay-tip').length,1);assert.equal(finished.calls.save,0);assert.equal(finished.calls.proof,0);
 });

 test(`${device}: saved personnel and mood crises defer advice until their actual safe continuation`,async()=>{
  for(const id of ['deferred-hr','deferred-mood']){
   const route=fixture(id),blocked=from(id),app=await harness(mobile,blocked),snapshot=plain(blocked);await app.action('continue');assert.deepEqual(plain(app.state()),snapshot);assert.equal(app.calls.save,0);assert.equal(app.calls.proof,0);assert.notEqual(app.state().eventId,'low-pay-tip');
   for(const action of route.resumeActions.slice(route.actions.length)){
    assert.equal(action.type,'choice');assert.equal(app.state().eventId,action.eventId);await app.choice(action.index);await app.action('next');
   }
   const expected={...engine.replayRun(route.roleId,route.seed,route.openActions),runId:blocked.runId};assert.deepEqual(plain(app.state()),plain(expected));assert.equal(app.state().eventId,'low-pay-tip');assert.equal(app.state().salaryAdvice.origin,'starting-pay');assert.equal(app.state().actions.filter(action=>action.type==='salary-advice').length,1);
  }
 });

 test(`${device}: a rolled résumé, pending result and an actual 30K or raised offer do not start the reminder`,async()=>{
  const route=fixture('admin-27'),candidate=engine.createRun(route.roleId,route.seed),app=await harness(mobile);app.candidate(candidate);assert.doesNotMatch(app.html(),/法師看了一眼你的錄取條件/);assert.equal(app.calls.save,0);assert.equal(app.calls.proof,0);
  const pending={...engine.applyChoice(candidate,0),runId:webcrypto.randomUUID()},held=await harness(mobile,pending);await held.action('continue');assert.deepEqual(plain(held.state()),plain(pending));assert.equal(held.state().salaryAdvice,null);assert.equal(held.calls.save,0);
  for(const id of ['admin-30','normal-high','raised-above-threshold']){
   const run=from(id),saved=await harness(mobile,run);await saved.action('continue');assert.deepEqual(plain(saved.state()),plain(run));assert.equal(saved.state().salaryAdvice,null);assert.equal(saved.calls.save,0);assert.equal(saved.calls.proof,0);
  }
 });
}
