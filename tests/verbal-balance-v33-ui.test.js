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
import {VERBAL_ACHIEVEMENTS_V32} from '../dist/achievements-v32.js';

const appSource=(await readFile(new URL('../dist/app.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
const plain=value=>JSON.parse(JSON.stringify(value));
const esc=value=>persona.displayText(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const finalBadges=VERBAL_ACHIEVEMENTS_V32.slice(0,12);

async function harness(mobile){
 const nodes=new Map(),listeners=new Map(),dialogListeners=new Map(),calls={verbal:0,save:0};
 const node=selector=>{
  if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',title:'',open:false,scrollTop:0,
   classList:{add(){},remove(){},toggle(){}},focus(){},scrollIntoView(){},setAttribute(){},
   addEventListener(type,callback){if(selector!=='#dialog')return;if(!dialogListeners.has(type))dialogListeners.set(type,[]);dialogListeners.get(type).push(callback);},
   showModal(){this.open=true;},close(){this.open=false;for(const callback of dialogListeners.get('close')||[])callback({target:this});}
  });return nodes.get(selector);
 };
 const context=vm.createContext({...roles,...sources,...endings,...legacy,...engine,...achievements,...career,...currentCareer,...persona,...characterStats,polishDreamText,renderEndingReport,
  requestVerbal(...args){calls.verbal++;return engine.requestVerbal(...args);},
  createFeedbackUI:()=>({open(){}}),createCharacterBook:()=>({open(){},onSnapshot(){},onRunChanged(){}}),
  cloud:{state:{status:'local',achievements:[],characters:[]},subscribe(){},init:async()=>null,achievementProgress:async()=>null,characterProgress:async()=>null,complete:async()=>null},
  localStorage:{getItem:()=>null,setItem(){calls.save++;}},document:{querySelector:node,addEventListener(type,callback){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(callback);}},
  window:{scrollTo(){},matchMedia:()=>({matches:mobile})},crypto:webcrypto,structuredClone,setTimeout:()=>1,clearTimeout(){}
 });
 vm.runInContext(appSource,context);await tick();calls.save=0;
 const click=async(dataset,choice=false,detail=1)=>{
  const target={closest:selector=>selector===(choice?'[data-choice]':'[data-action]')?{dataset}:null};
  for(const callback of listeners.get('click')||[])await callback({target,detail});await tick();
 };
 return {calls,html:()=>node('#main').innerHTML,picker:()=>node('#dialog-content').innerHTML,state:()=>vm.runInContext('run',context),close:()=>node('#dialog').close(),
  render(run){context.testRun={...run,runId:webcrypto.randomUUID()};vm.runInContext('run=testRun;game(true)',context);return node('#main').innerHTML;},
  action:(action,verbalTarget)=>click({action,verbalTarget}),
  async doubleChoice(index){const revision=vm.runInContext('gameViewRevision',context),dataset={choice:String(index),choiceView:String(revision)};await click(dataset,true,1);await click(dataset,true,2);}
 };
}

function noFinaleLeaks(html,ready){
 for(const choice of engine.getEvent(ready).choices.slice(0,3)){
  assert.doesNotMatch(choice.text,/\d+%|機率|結局：/);
  for(const outcome of choice.draw.outcomes){assert.ok(!html.includes(esc(outcome.result)),outcome.result);assert.ok(!html.includes(esc(outcome.label)),outcome.label);}
 }
 for(const ending of endings.ENDINGS.filter(row=>row.family.startsWith('verbal_')))assert.ok(!html.includes(esc(ending.title)),ending.id);
}
function noEndingBadges(html,run){
 const earned=new Set(achievements.deriveAchievements(run));
 for(const badge of finalBadges){
  assert.ok(!earned.has(badge.id),badge.id);assert.ok(!html.includes(badge.image),badge.id);
  assert.ok(!html.includes(esc(badge.title)),badge.id);assert.ok(!html.includes(esc(badge.description)),badge.id);
 }
}
function witnesses(){
 let offer,result,group;
 for(let i=0;i<100&&(!offer||!result||!group);i++){
  const source=engine.createRun('sales',`e33-ui-offer-${i}`),ready=engine.advance(engine.requestVerbal(source,undefined,2));
  if(!offer&&source.assignment!=='honest'&&ready.verbalContext.outcome!=='personnel'){
   const after=engine.advance(engine.applyChoice(ready,0));
   if(after.eventId==='verbal-v2-decision')offer={source,ready};
  }
  let run=engine.createRun('sales',`e33-ui-group-${i}`);
  for(let step=0;step<45&&!run.completed;step++){
   const event=engine.getEvent(run);
   if(!group&&engine.canRequestVerbal(run)&&engine.getVerbalTargets(run).length>1)group=run;
   if(!result&&['daily','fantasy'].includes(event.kind)){
    const pending=engine.applyChoice(run,0);
    if(engine.canRequestVerbal(pending)){
     const reply=engine.advance(engine.requestVerbal(pending,undefined,2));
     if(!reply.completed&&['ignored','support'].includes(reply.verbalContext.outcome)){
      const after=engine.advance(engine.applyChoice(reply,0));
      if(!after.completed&&!after.verbalContext)result={source:pending,ready:reply};
     }
    }
   }
   let index=['salary-cut','crisis-boss','paperwork'].includes(event.id)?2:0;
   if(event.choices[index]?.available===false)index=event.choices.findIndex(choice=>choice.available!==false);
   run=engine.advance(engine.applyChoice(run,index));
  }
 }
 assert.ok(offer,'natural changed appointment prefix');assert.ok(result,'natural committed result prefix');assert.ok(group,'natural co-present target prefix');
 return {offer,result,group};
}
const natural=witnesses();

for(const mobile of [false,true]){
 const device=mobile?'mobile':'desktop';
 test(`${device}: calm e33 reply continues to explicit job consent without exposing or granting finale badges`,async()=>{
  const app=await harness(mobile),{source,ready}=natural.offer;
  noFinaleLeaks(app.render(ready),ready);const untouched=JSON.stringify(app.state());
  await app.action('achievements');noEndingBadges(app.picker(),app.state());app.close();assert.equal(JSON.stringify(app.state()),untouched);
  const actions=app.state().actions.length;await app.doubleChoice(0);
  assert.equal(app.state().pending,true);assert.equal(app.state().actions.length,actions+1);
  assert.match(app.html(),/話收回爭點/);assert.equal(app.state().endingId,null);assert.equal(app.state().completed,false);
  const committed=JSON.stringify(app.state());await app.action('verbal');assert.equal(JSON.stringify(app.state()),committed,'pending follow-up cannot be spoken or redrawn twice');
  await app.action('next');assert.equal(app.state().eventId,'verbal-v2-decision');assert.match(app.html(),/接受.*月薪/);
  assert.equal(app.state().pay,source.pay);assert.equal(app.state().assignment,source.assignment);
  assert.ok(!app.state().history.some(row=>row.eventId==='onboarding'&&row.verbalOutcome===undefined),'reply has not silently accepted the appointment');
  await app.action('achievements');noEndingBadges(app.picker(),app.state());assert.ok(app.picker().includes('./assets/achievements/verbal-first-word.svg'));app.close();
  await app.doubleChoice(0);await app.action('next');assert.equal(app.state().completed,false);assert.equal(app.state().verbalContext,null);
  assert.ok(app.state().history.some(row=>row.eventId==='onboarding'&&row.choiceIndex===0&&row.verbalOutcome===undefined));
  assert.equal(engine.validRun(app.state()),true);await app.action('achievements');noEndingBadges(app.picker(),app.state());
 });
 test(`${device}: speaking after a committed result keeps that choice and spends its workday only once`,async()=>{
  const app=await harness(mobile),{source,ready}=natural.result,expected=engine.advance(source),first=plain(source.history.at(-1));
  app.render(source);await app.action('verbal');assert.equal(app.calls.verbal,1);assert.equal(app.state().pending,true);
  assert.deepEqual(plain(app.state().history[source.history.length-1]),first);
  await app.action('next');assert.equal(app.state().eventId,'verbal-v32-aftermath');noFinaleLeaks(app.html(),ready);
  await app.doubleChoice(0);await app.action('next');const after=app.state();
  assert.equal(after.completed,false);assert.equal(after.endingId,null);assert.equal(after.verbalContext,null);
  assert.equal(after.turn,expected.turn);assert.equal(after.pay,expected.pay);assert.equal(after.rank,expected.rank);assert.equal(after.actualRoleId,expected.actualRoleId);
  assert.deepEqual(plain(after.history[source.history.length-1]),first);
  assert.equal(after.actions.filter(action=>action.type==='verbal').length,1);assert.equal(engine.validRun(after),true);
  await app.action('achievements');noEndingBadges(app.picker(),after);assert.ok(app.picker().includes('./assets/achievements/verbal-late-reply.svg'));
 });
 test(`${device}: opening, cancelling and re-opening a multi-person speech picker never rerolls or spends an action`,async()=>{
  const app=await harness(mobile),source=natural.group,targets=engine.getVerbalTargets(source);app.render(source);
  const before=JSON.stringify(app.state()),saves=app.calls.save;await app.action('verbal');
  assert.match(app.picker(),/data-verbal-target-picker/);const firstPicker=app.picker();
  for(const target of targets)assert.ok(firstPicker.includes(esc(engine.getVerbalLine(source,target))));
  assert.equal(JSON.stringify(app.state()),before);assert.equal(app.calls.verbal,0);assert.equal(app.calls.save,saves);
  await app.action('verbal');await app.action('verbal-cancel');assert.equal(JSON.stringify(app.state()),before);
  await app.action('verbal');assert.equal(app.picker(),firstPicker);assert.equal(JSON.stringify(app.state()),before);
  await app.action('verbal-target',targets[0]);const committed=JSON.stringify(app.state());
  await app.action('verbal-target',targets[0]);assert.equal(JSON.stringify(app.state()),committed);assert.equal(app.calls.verbal,1);
  assert.equal(app.state().actions.length,source.actions.length+1);assert.equal(app.state().history.at(-1).verbalOutcome.target,targets[0]);assert.equal(engine.validRun(app.state()),true);
  noEndingBadges(app.html(),app.state());
 });
}
