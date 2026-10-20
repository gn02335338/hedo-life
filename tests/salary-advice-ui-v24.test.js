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
const {routes}=JSON.parse(await readFile(new URL('./fixtures/lowpay-routes-v24.json',import.meta.url),'utf8'));
const oldRoutes=JSON.parse(await readFile(new URL('./fixtures/legacy-e23-routes.json',import.meta.url),'utf8'));
// A natural old education conversation names the professor in its chosen reply
// and result, so the journal exercises the alias as well as the screen.
const oldProfessor=oldRoutes.flatMap(route=>route.actions.map((action,index)=>({route,action,index})))
 .find(({route,action,index})=>action.eventId==='education-scrutiny'&&action.index===1&&
  engine.getEvent(engine.replayRun(route.roleId,route.seed,route.actions.slice(0,index))).choices[action.index].text.includes('顧問教授'));
const oldAdvisor=oldRoutes.find(route=>route.actions.some(action=>action.eventId?.startsWith('advisor-')));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const plain=value=>JSON.parse(JSON.stringify(value));
const esc=value=>persona.displayText(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function routeRun(id){const route=routes.find(row=>row.id===id);assert.ok(route,id);return engine.replayRun(route.roleId,route.seed,route.actions);}

async function harness(mobile,initialRun=null){
 const nodes=new Map(),listeners=new Map(),calls={save:0,proof:0,downloads:[],blobs:[]};
 const store=new Map(initialRun?[['hedo-life-v3',JSON.stringify({run:initialRun,unlocked:[],achievements:{}})]]:[]);
 const node=selector=>{
  if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',title:'',open:false,
   classList:{add(){},remove(){},toggle(){}},focus(){},setAttribute(){},scrollIntoView(){},addEventListener(){},
   showModal(){this.open=true;},close(){this.open=false;},
  });return nodes.get(selector);
 };
 const context=vm.createContext({...roles,...sources,...endings,...legacy,...engine,...achievements,...career,...currentCareer,...persona,...characterStats,polishDreamText,
  createFeedbackUI:()=>({open(){}}),createCharacterBook:()=>({open(){},onSnapshot(){},onRunChanged(){}}),
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

 test(`${device}: a professor work story restores 林澤教授 in the body without revealing choice results`,async()=>{
  const index=oldAdvisor.actions.findIndex(action=>action.eventId?.startsWith('advisor-'));
  const run=engine.replayRun(oldAdvisor.roleId,oldAdvisor.seed,oldAdvisor.actions.slice(0,index));
  const event=engine.getEvent(run),canonical=JSON.stringify(run);assert.match(event.body,/顧問教授/);
  const app=await harness(mobile),html=app.render(run);
  assert.match(html,/class="chapter-body">[^<]*林澤教授/);assert.doesNotMatch(html,/顧問教授|遊戲月薪/);
  for(const choice of event.choices){assert.ok(html.includes(esc(choice.text)));assert.ok(!html.includes(esc(choice.result)));}
  assert.equal(JSON.stringify(app.state()),canonical);assert.equal(app.calls.save,0);assert.equal(app.calls.proof,0);
 });

 test(`${device}: an old saved professor conversation displays 林澤教授 and 月薪 without changing canonical history`,async()=>{
  const {route,index}=oldProfessor,before=engine.replayRun(route.roleId,route.seed,route.actions.slice(0,index));
  const pending=engine.applyChoice(before,route.actions[index].index);
  assert.equal(engine.validRun(pending),true);assert.match(pending.history.at(-1).result,/顧問教授/);
  assert.match(JSON.stringify(pending.history),/遊戲月薪/);
  const app=await harness(mobile,pending),canonical=JSON.stringify(app.state()),saved=app.saved();
  const html=app.renderLoaded(),journal=app.journal();
  assert.match(html,/林澤教授/);assert.match(journal,/林澤教授/);
  assert.match(html,/<div class="salary-line"><span>月薪<\/span>/);assert.match(journal,/· 月薪 \d+K/);
  assert.doesNotMatch(html+journal,/顧問教授|遊戲月薪/);
  await app.action('guide');const guide=app.dialogHTML();
  assert.match(guide,/月薪決定定期入帳多少/);assert.doesNotMatch(guide,/遊戲月薪/);
  assert.equal(JSON.stringify(app.state()),canonical,'rendering and opening the guide never rewrite the old replay');
  assert.deepEqual(app.saved(),saved);assert.equal(app.calls.save,0);assert.equal(app.calls.proof,0);
  assert.equal(engine.validRun(app.state()),true);
 });

 test(`${device}: completed old lives, journal and downloaded SVG consistently say 月薪`,async()=>{
  const {route}=oldProfessor,completed=engine.replayRun(route.roleId,route.seed,route.actions);
  assert.equal(completed.completed,true);assert.match(JSON.stringify(completed.history),/遊戲月薪/);
  const app=await harness(mobile,completed),canonical=JSON.stringify(app.state()),saved=app.saved(),html=app.renderLoaded();
  assert.match(html,/ending-employment/);assert.match(html,/<span>月薪 <b>\d+K<\/b>/);
  assert.match(html,/林澤教授/);assert.doesNotMatch(html,/遊戲月薪|顧問教授/);
  await app.action('download');assert.equal(app.calls.blobs.length,1);assert.equal(app.calls.downloads.length,1);
  const svg=await app.calls.blobs[0].text();assert.match(svg,/月薪\d+K/);assert.doesNotMatch(svg,/遊戲月薪|顧問教授/);
  assert.match(app.calls.downloads[0].name,/^移動人生-.+\.svg$/);
  assert.equal(JSON.stringify(app.state()),canonical);assert.deepEqual(app.saved(),saved);
  assert.equal(app.calls.save,0);assert.equal(app.calls.proof,0);
 });

 test(`${device}: an accepted pay cut below 30K reveals the legal advisor and three replies while keeping outcomes secret`,async()=>{
  const run=routeRun('accepted-cut'),event=engine.getEvent(run);run.runId=webcrypto.randomUUID();
  assert.equal(run.eventId,'low-pay-tip');assert.equal(run.pay,24);assert.equal(event.speaker,'erich');
  const app=await harness(mobile),canonical=JSON.stringify(run),html=app.render(run),buttons=html.slice(html.indexOf('<div class="choices '));
  assert.match(html,/src="\.\/assets\/erich\.png"/);assert.match(html,/<span class="speaker-name">法師 /);
  assert.ok(html.includes(`${run.salaryAdvice.from}K`));assert.ok(html.includes(`${run.salaryAdvice.to}K`));
  assert.match(html,/29,500|29，500|29500/);assert.match(html,/正常工時/);assert.match(html,/勞工局|調解/);
  assert.ok(html.includes(esc(sources.SOURCES.minimumWage2026.title)),'the official minimum-wage source is available');
  assert.ok(html.includes(sources.SOURCES.minimumWage2026.url));
  assert.equal(event.choices.length,3);assert.ok(event.choices.some(choice=>choice.wild));
  assert.equal([...buttons.matchAll(/\bdata-choice="/g)].length,3);
  for(const choice of event.choices){assert.ok(buttons.includes(esc(choice.text)));assert.ok(!html.includes(esc(choice.result)));}
  assert.match(buttons,/計算機.*法袍/);assert.ok(buttons.indexOf('data-action="rage"')>buttons.lastIndexOf('data-choice='));
  assert.doesNotMatch(html,/outcome-ledger|delta-chip|luck-result|aria-label="事件後數值變化"|遊戲月薪/);
  assert.doesNotMatch(buttons.replace(/<[^>]*>/g,''),/成功率|[+-]\d+|\d+(?:\.\d+)?\s*[%％]/);
  assert.equal(JSON.stringify(app.state()),canonical);assert.equal(app.calls.save,0);assert.equal(app.calls.proof,0);
 });

 test(`${device}: each legal-advice reply reveals its own result once, then returns to the saved work without spending a day`,async()=>{
  for(let index=0;index<3;index++){
   const run=routeRun('accepted-cut');run.runId=webcrypto.randomUUID();
   const event=engine.getEvent(run),returnId=run.salaryAdvice.returnEventId,turn=run.turn,remaining=plain(run.pip),seen=[...run.seen],rng=run.rng;
   const app=await harness(mobile);app.render(run);
   await app.choice(index);await app.choice(index);
   const pending=app.state(),last=pending.history.at(-1),html=app.html();
   assert.equal(pending.actions.length,run.actions.length+1);assert.equal(pending.history.length,run.history.length+1);
   assert.equal(last.eventId,'low-pay-tip');assert.equal(last.choiceIndex,index);assert.equal(last.result,event.choices[index].result);
   assert.ok(html.includes(esc(last.result)));assert.match(html,/outcome-ledger/);assert.match(html,/事件後數值變化/);
   assert.equal(pending.turn,turn);assert.deepEqual(plain(pending.pip),remaining);assert.deepEqual([...pending.seen],seen);
   assert.equal(pending.rng,rng,'a private advice reply does not roll work luck or boss weather');
   assert.equal(app.calls.save,1);assert.equal(app.calls.proof,1);
   await app.action('next');const resumed=app.state();
   assert.equal(resumed.eventId,returnId);assert.equal(resumed.turn,turn);assert.equal(resumed.salaryAdvice.status,'done');
   assert.equal(resumed.salaryAdvice.returnEventId,null);assert.deepEqual(plain(resumed.pip),remaining);assert.deepEqual([...resumed.seen],seen);
   assert.equal(resumed.rng,rng);assert.equal(resumed.actions.length,pending.actions.length);
   assert.equal(resumed.history.filter(row=>row.eventId==='low-pay-tip').length,1);
   const expected=routeRun(`tip-choice-${index}`);expected.runId=run.runId;
   assert.equal(engine.validRun(resumed),true);assert.deepEqual(plain(resumed),plain(expected),'the UI follows the naturally replayable advice route');
   assert.ok(!app.html().includes(esc(event.title)),'continuing returns to the saved work instead of showing advice twice');
  }
 });

 test(`${device}: a proposed cut does not show the private tip and an accepted 30K cut remains on the work event`,async()=>{
  const proposal=routeRun('proposal-below-30'),event=engine.getEvent(proposal),app=await harness(mobile);
  assert.equal(proposal.pay,37);assert.equal(proposal.salaryAdvice,null);assert.equal(event.id,'salary-cut');
  const html=app.render(proposal);assert.ok(html.includes(esc(event.body)));assert.doesNotMatch(html,/法師把降薪通知|私下的小建議/);
  const boundary=routeRun('cut-to-30'),before=JSON.stringify(boundary),boundaryHTML=app.render(boundary);
  assert.equal(boundary.pay,30);assert.equal(boundary.salaryAdvice,null);assert.notEqual(boundary.eventId,'low-pay-tip');
  assert.doesNotMatch(boundaryHTML,/法師把降薪通知|私下的小建議|遊戲月薪/);assert.equal(JSON.stringify(app.state()),before);
 });
}
