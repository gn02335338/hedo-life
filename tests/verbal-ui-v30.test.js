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
import {polishDreamText} from '../dist/copy-v15.js';

const appSource=(await readFile(new URL('../dist/app.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
const {routes}=JSON.parse(await readFile(new URL('./fixtures/verbal-routes-v30.json',import.meta.url),'utf8'));
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
 const context=vm.createContext({...roles,...sources,...endings,...legacy,...engine,...achievements,...career,...currentCareer,...persona,...characterStats,polishDreamText,
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
 test(`${device}: verbal control follows every choice and precedes rage, with no future result shown`,async()=>{
  const app=await harness(mobile),route=routes.find(row=>row.id==='target-event-wing'),run=sourceFor(route),snapshot=JSON.stringify(run),event=engine.getEvent(run),html=app.render(run);
  const choices=html.slice(html.indexOf('<div class="choices '),html.indexOf('<p class="story-source">'));
  assert.equal([...choices.matchAll(/data-action="verbal"/g)].length,1);assert.ok(choices.indexOf('data-action="verbal"')>choices.lastIndexOf('data-choice='));assert.ok(choices.indexOf('data-action="verbal"')<choices.indexOf('data-action="rage"'));
  const result=engine.requestVerbal(run).history.at(-1).result;assert.ok(!html.includes(esc(result)));assert.doesNotMatch(choices.replace(/<[^>]*>/g,''),/成功率|機率|\d+(?:\.\d+)?\s*[%％]/);
  for(const choice of event.choices)if(choice.result?.length>15)assert.ok(!html.includes(esc(choice.result)));
  assert.equal(JSON.stringify(app.state()),snapshot);assert.equal(app.calls.save,0);assert.equal(app.calls.proof,0);assert.equal(app.calls.verbal.length,0);
 });

 test(`${device}: one solo or air curse resolves once, labels actual speech and never credits a hit`,async()=>{
  for(const phase of ['event','result'])for(const target of ['wing','self']){
   const app=await harness(mobile),route=routes.find(row=>row.id===`target-${phase}-${target}`),run=sourceFor(route),expected=engine.requestVerbal(run,undefined,2);
   const html=app.render(run);if(target==='self')assert.match(html,/惡言相向 · 對空氣開罵/);
   const old=characterStats.deriveCharacterStats(run);await app.action('verbal');await app.action('verbal');
   assert.equal(app.dialog().open,false);assert.equal(app.calls.verbal.length,1);assert.equal(app.calls.verbal[0].argsLength,3);assert.equal(app.calls.advance,0);assert.equal(app.calls.save,1);assert.equal(app.calls.proof,1);
   assert.deepEqual(plain(app.state()),plain(expected));assert.match(app.html(),/reality-verbal/);assert.match(app.html(),/真的說出口/);assert.match(app.html(),/這是口頭衝突，沒有動手/);
   assert.doesNotMatch(app.html(),/reality-imagined|reality-real|imagined-consequence|real-consequence|dream-return-note/);
   assert.match(app.html(),/<button[^>]*data-action="verbal" disabled/);assert.match(app.html(),/<button[^>]*data-action="rage" disabled/);
   const now=characterStats.deriveCharacterStats(app.state());for(const previous of old){const row=now.find(item=>item.id===previous.id);assert.equal(row.realHits,previous.realHits);assert.equal(row.imaginedHits,previous.imaginedHits);}
  }
 });

 test(`${device}: the group picker exposes only present portraits and cancellation consumes no RNG, save or proof`,async()=>{
  for(const mode of ['cancel','close','escape']){
   const app=await harness(mobile),route=routes.find(row=>row.id==='group-event-sonny'),run=sourceFor(route),snapshot=JSON.stringify(run);app.render(run);
   await app.action('verbal');assert.equal(app.dialog().open,true);assert.equal(JSON.stringify(app.state()),snapshot);assert.equal(app.calls.verbal.length,0);assert.equal(app.calls.save,0);assert.equal(app.calls.proof,0);
   const picker=app.picker();assert.match(picker,/data-verbal-target-picker/);assert.equal([...picker.matchAll(/data-verbal-target="/g)].length,3);
   for(const id of ['erich','jenjen','sonny']){assert.ok(picker.includes(`data-verbal-target="${id}"`));assert.ok(picker.includes(`src="./assets/${id}.png"`));assert.ok(picker.includes(persona.PERSONAS[id].name));}
   assert.doesNotMatch(picker,/data-verbal-target="(?:wing|rick|hope|sam)"|成功率|機率|好感|\d+%/);
   if(mode==='cancel')await app.action('verbal-cancel');else if(mode==='close')await app.action('close-dialog');else app.cancel();
   await app.action('verbal-target','sonny');assert.equal(app.dialog().open,false);assert.equal(JSON.stringify(app.state()),snapshot);assert.equal(app.calls.verbal.length,0);assert.equal(app.calls.save,0);assert.equal(app.calls.proof,0);
  }
 });

 test(`${device}: explicit group targets commit once in either phase and stale pickers cannot act on another view`,async()=>{
  for(const phase of ['event','result'])for(const target of ['erich','jenjen','sonny']){
   const app=await harness(mobile),route=routes.find(row=>row.id===`group-${phase}-${target}`),run=sourceFor(route);app.render(run);
   await app.action('verbal');await app.action('verbal');for(const absent of ['wing','sam','unknown',undefined])await app.action('verbal-target',absent);
   assert.equal(app.calls.verbal.length,0);assert.equal(app.dialog().open,true);
   await app.action('verbal-target',target);const once=JSON.stringify(app.state());await app.action('verbal-target',target);
   assert.equal(app.calls.verbal.length,1);assert.equal(app.calls.verbal[0].target,target);assert.equal(app.calls.verbal[0].phase,phase);assert.equal(app.calls.save,1);assert.equal(app.calls.proof,1);assert.equal(JSON.stringify(app.state()),once);
   assert.equal(app.state().history.at(-1).verbalOutcome.target,target);assert.deepEqual(plain(app.state().history.slice(0,-1)),plain(run.history));
  }
  for(const mutation of ['run=structuredClone(run)','run.pending=!run.pending','run.runId=crypto.randomUUID()','home();game(false)']){
   const app=await harness(mobile),route=routes.find(row=>row.id==='group-event-sonny');app.render(sourceFor(route));await app.action('verbal');vm.runInContext(mutation,app.context);await app.action('verbal-target','sonny');
   assert.equal(app.calls.verbal.length,0,mutation);assert.equal(app.calls.save,0,mutation);assert.equal(app.calls.proof,0,mutation);
  }
 });

 test(`${device}: a large affinity loss is visible only after speaking and identifies the selected character`,async()=>{
  const route=routes.find(row=>row.branch==='relationship');assert.ok(route);const run=sourceFor(route),app=await harness(mobile);
  const before=app.render(run);assert.doesNotMatch(before,/好感 -32/);await app.action('verbal');
  if(engine.getVerbalTargets(run).length>1)await app.action('verbal-target',route.target);
  assert.equal(app.state().history.at(-1).verbalOutcome.affinityDelta,-32);assert.match(app.html(),/好感 -32/);assert.match(app.html(),/character-change affinity-down/);
  assert.ok(app.html().includes(persona.PERSONAS[route.target].name));assert.match(app.html(),/outcome-ledger/);
 });

 test(`${device}: free clarification and paid legal help reveal their result after selection, then resume the original scene`,async()=>{
  for(const index of [0,2]){
   const route=routes.find(row=>row.id===`legal-${index}-withdrawn`),legal={...engine.replayRun(route.roleId,route.seed,route.legalActions),runId:webcrypto.randomUUID()},app=await harness(mobile),event=engine.getEvent(legal);
   const html=app.render(legal);assert.match(html,/口舌風波/);assert.doesNotMatch(html,/這輪要求撤回，話還是說過了/);
   assert.match(html,/<button[^>]*data-action="verbal" disabled/);assert.match(html,/<button[^>]*data-action="rage" disabled/);
   for(const choice of event.choices)for(const result of choice.draw?.outcomes||[])assert.ok(!html.includes(esc(result.result)));
   const expected=engine.applyChoice(legal,index);await app.doubleChoice(index);
   assert.deepEqual(plain(app.state()),plain(expected));assert.equal(app.calls.save,1);assert.equal(app.calls.proof,1);assert.equal(app.state().stats.cash,legal.stats.cash-(index===2?12:0));assert.match(app.html(),/outcome-ledger/);
   await app.action('next');assert.equal(app.state().eventId,'verbal-legal-result');assert.match(app.html(),/這輪要求撤回，話還是說過了/);
   await app.doubleChoice(0);await app.action('next');assert.equal(app.state().verbalContext,null);assert.equal(engine.validRun(app.state()),true);
   const canonical=engine.replayRun(app.state().roleId,app.state().seed,app.state().actions);assert.deepEqual(plain(canonical),plain((({runId,...rest})=>rest)(app.state())));
  }
 });

 test(`${device}: mood-zero and same-turn blockers stay disabled, while published e29 controls remain unchanged`,async()=>{
  const app=await harness(mobile),zero=sourceFor(routes.find(row=>row.id==='zero-mood'));assert.match(app.render(zero),/<button[^>]*data-action="verbal" disabled/);
  assert.match(app.html(),/先面對這次心情歸零/);await app.action('verbal');assert.equal(app.calls.verbal.length,0);assert.equal(app.calls.save,0);
  const route=routes.find(row=>row.kind==='target'&&row.phase==='event'&&['ignored','relationship','retort','support'].includes(row.branch)),source=sourceFor(route),returned=engine.advance(engine.getVerbalTargets(source).length>1?engine.requestVerbal(source,route.target):engine.requestVerbal(source));
  assert.equal(returned.turn,source.turn);assert.match(app.render(returned),/<button[^>]*data-action="verbal" disabled/);assert.match(app.html(),/這個工作回合已經嗆過/);
  const old=engine.createRun('sales','e29-verbal-ui-legacy');assert.doesNotMatch(app.render(old),/data-action="verbal"/);
 });
}
