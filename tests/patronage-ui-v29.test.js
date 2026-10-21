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
const {routes}=JSON.parse(await readFile(new URL('./fixtures/patronage-routes-v29.json',import.meta.url),'utf8'));
const plain=value=>JSON.parse(JSON.stringify(value));
const esc=value=>persona.displayText(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function harness(mobile){
 const nodes=new Map(),listeners=new Map(),calls={save:0,proof:0};
 const node=selector=>{
  if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',title:'',open:false,
   classList:{add(){},remove(){},toggle(){}},focus(){},setAttribute(){},addEventListener(){},scrollIntoView(){},showModal(){this.open=true;},close(){this.open=false;},
  });return nodes.get(selector);
 };
 const context=vm.createContext({...roles,...sources,...endings,...legacy,...engine,...achievements,...career,...currentCareer,...persona,...characterStats,polishDreamText,
  createFeedbackUI:()=>({open(){}}),createCharacterBook:()=>({open(){},onSnapshot(){},onRunChanged(){}}),
  cloud:{state:{status:'local',achievements:[],characters:[]},subscribe(){},init:async()=>null,
   achievementProgress:async()=>null,characterProgress:async()=>{calls.proof++;return null;},complete:async()=>null},
  localStorage:{getItem:()=>null,setItem(){calls.save++;}},document:{querySelector:node,addEventListener(type,callback){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(callback);}},
  window:{scrollTo(){},matchMedia:()=>({matches:mobile})},crypto:webcrypto,structuredClone,setTimeout:()=>1,clearTimeout(){},
 });
 vm.runInContext(appSource,context);await tick();calls.save=0;calls.proof=0;
 const click=async(dataset,choice=false,detail=1)=>{
  const target={closest:selector=>selector===(choice?'[data-choice]':'[data-action]')?{dataset}:null};
  for(const callback of listeners.get('click')||[])await callback({target,detail});await tick();
 };
 return{calls,html:()=>node('#main').innerHTML,state:()=>vm.runInContext('run',context),
  render(run){context.fixtureRun=run;vm.runInContext('run=fixtureRun;game(true)',context);return node('#main').innerHTML;},
  candidate(run){context.fixtureRun=run;vm.runInContext('candidate=fixtureRun;selectedRole=fixtureRun.roleId;rollScreen()',context);return node('#main').innerHTML;},
  action:action=>click({action}),
  async doubleChoice(index){const revision=vm.runInContext('gameViewRevision',context),dataset={choice:String(index),choiceView:String(revision)};await click(dataset,true,1);await click(dataset,true,2);},
 };
}

for(const mobile of [false,true]){
 const device=mobile?'mobile':'desktop';
 test(`${device}: candidate and work ID clearly show fictional character gender without changing the run or collecting player gender`,async()=>{
  const app=await harness(mobile);
  for(const gender of ['male','female']){
   const route=routes.find(row=>row.id===`application-${gender}-success`),run=engine.createRun(route.roleId,route.seed),before=JSON.stringify(run);
   const resume=app.candidate(run);assert.match(resume,/本局角色性別/);assert.match(resume,/履歷隨機設定，不代表玩家本人/);
   assert.match(resume,new RegExp(`<h3>${gender==='male'?'男':'女'}<\/h3>`));
   assert.doesNotMatch(resume,/<input[^>]*(?:name|id)="(?:sex|gender|characterGender)"/);
   const id=app.render(run);assert.match(id,new RegExp(`角色性別：${gender==='male'?'男':'女'} · 本局設定`));
   assert.equal(JSON.stringify(run),before);assert.equal(JSON.stringify(app.state()),before);assert.equal(app.calls.save,0);assert.equal(app.calls.proof,0);
  }
  const old=app.candidate(engine.createRun('sales','e28-gender-ui-compat'));assert.doesNotMatch(old,/本局角色性別/);
 });

 test(`${device}: actual application decisions hide outcomes, guard double clicks and replace the job title only after success`,async()=>{
  for(const gender of ['male','female'])for(const outcome of ['success','setback','declined']){
   const app=await harness(mobile),route=routes.find(row=>row.id===`application-${gender}-${outcome}`),run={...engine.replayRun(route.roleId,route.seed,route.beforeActions),runId:webcrypto.randomUUID()},event=engine.getEvent(run);
   const html=app.render(run),title=gender==='male'?'乾兒子':'乾女兒';assert.doesNotMatch(html,/patronage-track|outcome-ledger/);
   for(const choice of event.choices)for(const result of [choice.result,choice.check?.success?.result,choice.check?.failure?.result])if(result?.length>10)assert.ok(!html.includes(esc(result)));
   assert.doesNotMatch(html.slice(html.indexOf('<div class="choices ')).replace(/<[^>]*>/g,''),/成功率|機率|\d+(?:\.\d+)?\s*[%％]/);
   const expected=engine.applyChoice(run,route.index);await app.doubleChoice(route.index);
   assert.deepEqual(plain(app.state()),plain(expected));assert.equal(app.state().actions.length,run.actions.length+1);assert.equal(app.calls.save,1);assert.equal(app.calls.proof,1);
   assert.ok(app.html().includes(esc(expected.history.at(-1).result)));assert.match(app.html(),/outcome-ledger/);
   if(outcome==='success'){
    assert.match(app.html(),new RegExp(`<h2>${title}<\/h2>`));assert.match(app.html(),/patronage-track/);assert.match(app.html(),/一般升遷暫停/);
    assert.match(app.html(),/<button data-action="career" disabled/);assert.match(app.html(),new RegExp(`<b>${expected.pay}<small>K<\/small>`));
   }else assert.doesNotMatch(app.html(),/patronage-track/);
   await app.action('next');assert.deepEqual(plain(app.state()),plain(engine.advance(expected)));
   if(outcome==='success'){assert.match(app.html(),/<button data-action="career" disabled/);assert.match(app.html(),/特殊任用.*升遷暫停/);}
  }
 });

 test(`${device}: Rick's speaker card displays the new name and retains 老闆乾兒子 as the job title`,async()=>{
  const app=await harness(mobile),route=routes.find(row=>row.eventId==='rick29-protected-report'),run=engine.replayRun(route.roleId,route.seed,route.beforeActions),html=app.render(run);
  assert.match(html,/<span class="speaker-name">瑞克 <small>老闆乾兒子 · 遊戲角色<\/small>/);
  assert.match(html,/src="\.\/assets\/rick\.png"/);assert.doesNotMatch(html,/<small>瑞克 · 遊戲角色/);
  assert.equal(app.calls.save,0);assert.equal(app.calls.proof,0);
 });
}
