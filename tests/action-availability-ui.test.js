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
function harness({mobile=false}={}){
 const nodes=new Map(),listeners=new Map(),calls={save:0,proof:0,break:0,career:0,raise:0,scroll:[]};
 const node=selector=>{
  if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',title:'',open:false,
   classList:{add(){},remove(){},toggle(){}},focus(){},setAttribute(){},addEventListener(){},
   scrollIntoView(){calls.scroll.push(selector);},showModal(){this.open=true;},close(){this.open=false;},
  });return nodes.get(selector);
 };
 const context=vm.createContext({...roles,...sources,...endings,...legacy,...engine,...achievements,...career,...currentCareer,...persona,...characterStats,polishDreamText,
  requestBreak(run){calls.break++;return engine.requestBreak(run);},
  requestCareer(run){calls.career++;return engine.requestCareer(run);},
  requestRaise(run){calls.raise++;return engine.requestRaise(run);},
  createFeedbackUI:()=>({open(){}}),createCharacterBook:()=>({open(){},onSnapshot(){},onRunChanged(){}}),
  cloud:{state:{status:'local',achievements:[]},subscribe(){},init:async()=>null,achievementProgress:async()=>null,characterProgress:async()=>{calls.proof++;return null;},complete:async()=>null},
  localStorage:{getItem:()=>null,setItem(){calls.save++;}},
  document:{querySelector:node,addEventListener(type,callback){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(callback);}},
  window:{scrollTo(){},matchMedia:()=>({matches:mobile})},crypto:webcrypto,structuredClone,setTimeout:()=>1,clearTimeout(){},
 });
 vm.runInContext(appSource,context,{filename:'dist/app.js'});
 return {calls,state:()=>vm.runInContext('run',context),
  render(run,focus=false){context.testRun=run;vm.runInContext(`run=testRun;game(${focus})`,context);return node('#main').innerHTML;},
  async action(action){const event={target:{closest:selector=>selector==='[data-action]'?{dataset:{action}}:null}};for(const callback of listeners.get('click')||[])await callback(event);},
 };
}

// Isolated display states exercise blockers without changing game rules.
function workState(changes={},cohort='e21'){
 const run=engine.createRun('sales',`${cohort}-action-availability-ui`);
 return {...run,eventId:'meeting-ten-minutes',turn:4,actualRoleId:'sales',assignment:'honest',pay:45,stats:{...run.stats,mood:70,energy:70,cash:70},...changes};
}
function control(html,action){
 const button=html.match(new RegExp(`<button data-action="${action}"[^>]*>[\\s\\S]*?<\\/button>`))?.[0];
 assert.ok(button,`${action} is rendered`);
 const id=button.match(/aria-describedby="([^"]+)"/)?.[1];
 const reason=id?html.match(new RegExp(`<p class="action-availability-reason" id="${id}">([^<]+)<\\/p>`))?.[1]:null;
 return {button,id,reason,disabled:/\bdisabled\b/.test(button)};
}
const doneWork=Array.from({length:3},()=>({kind:'daily',choiceIndex:0}));

test('all disabled controls give visible, individually linked reasons on desktop and mobile',()=>{
 for(const mobile of [false,true]){
  const app=harness({mobile}),run=engine.applyChoice(workState(),0),html=app.render(run,true),ids=[];
  for(const action of ['break','career','raise']){
   const row=control(html,action);assert.equal(row.disabled,true);assert.ok(row.reason);ids.push(row.id);
   assert.match(row.reason,/先看完眼前結果，再回工作安排/);
   assert.doesNotMatch(row.reason,/按.*繼續|成功率|機率|[%％]/);
  }
  assert.equal(new Set(ids).size,3);
  assert.match(html,/data-action="work-card"/);
 }
});

test('reporting, personnel notices and nested scenes explain the current blocker',()=>{
 const app=harness(),initial=engine.createRun('sales','e21-action-entry');
 assert.match(control(app.render(initial),'break').reason,/報到/);
 assert.match(control(app.render(initial),'career').reason,/DAY 04/);
 assert.equal(control(app.render(initial),'raise').reason,engine.raiseAvailability(initial).reason);
 for(const eventId of ['dismissal-final','floor-notice','watch-review']){
  const html=app.render(workState({eventId}));
  for(const action of ['break','career','raise'])assert.match(control(html,action).reason,/人事通知/);
 }
 for(const [changes,pattern]of [
  [{eventId:'self-care',breakReturnEventId:'meeting-ten-minutes'},/休息安排/],
  [{eventId:'crisis-boss',resumeEventId:'meeting-ten-minutes'},/通知/],
  [{eventId:'exit-menu',exitReturnEventId:'meeting-ten-minutes'},/離職/],
 ]){
  const html=app.render(workState(changes));
  for(const action of ['break','career'])assert.match(control(html,action).reason,pattern);
 }
 const rage=engine.requestRage(engine.createRun('sales','e21-availability-rage'));
 // Once the pending outcome has been read, the ongoing rage context remains
 // the blocker; no button promises that a named Continue button must exist.
 rage.pending=false;
 const html=app.render(rage);
 for(const action of ['break','career'])assert.match(control(html,action).reason,/暴走/);
});

test('rest availability distinguishes a used workday and permits PIP workdays even without cash',()=>{
 const app=harness(),used=workState();used.lastBreakTurn=used.turn;
 assert.equal(engine.canRequestBreak(used),false);
 assert.match(control(app.render(used),'break').reason,/這個工作回合已安排過休息/);
 const pip=workState({pip:{active:true,remaining:2}});pip.stats.cash=0;
 assert.equal(engine.canRequestBreak(pip),true);
 assert.equal(control(app.render(pip),'break').disabled,false);
 assert.equal(control(app.render(pip),'break').reason,null);
 assert.match(control(app.render(pip),'career').reason,/PIP/);
 assert.equal(control(app.render(pip),'raise').reason,engine.raiseAvailability(pip).reason);
});

test('career Day 04 is distinct from completing three work rounds for a salary talk',()=>{
 const app=harness(),early=workState({turn:2}),day4=workState({turn:3,history:[]});
 assert.match(control(app.render(early),'career').reason,/DAY 04/);
 assert.equal(engine.canRequestCareer(day4),true);
 assert.equal(control(app.render(day4),'career').disabled,false);
 assert.match(control(app.render(day4),'raise').reason,/完成三個工作回合/);
 const ready=workState({history:doneWork});
 assert.equal(engine.canRequestRaise(ready),true);
 assert.equal(control(app.render(ready),'raise').disabled,false);
});

test('promotion cooldown, deferred review and floor duty have distinct explanations',()=>{
 const app=harness(),cooldown=workState({turn:6,lastPromotion:5,rank:1});
 assert.equal(engine.canRequestCareer(cooldown),false);
 assert.match(control(app.render(cooldown),'career').reason,/上次評核後/);
 const deferred=workState({turn:9,lastPromotion:3,flags:{career_defer_until:12}});
 assert.equal(engine.canRequestCareer(deferred),false);
 assert.match(control(app.render(deferred),'career').reason,/延後評核/);
 const floor=workState({flags:{floor_watch:1}});
 for(const action of ['career','raise'])assert.match(control(app.render(floor),action).reason,/三樓待命/);
});

test('salary talk blockers reuse the engine reason without previewing outcomes',()=>{
 const app=harness();
 for(const changes of [
  {flags:{raise_attempts:1,raise_last_work:3}},
  {flags:{raise_attempts:3}},
  {pay:500},
  {salaryCut:{status:'pending'}},
  {eventId:'raise-request',raiseContext:{eventId:'meeting-ten-minutes',fromPay:45}},
 ]){
  const run=workState({history:doneWork,...changes}),reason=engine.raiseAvailability(run).reason;
  assert.equal(control(app.render(run),'raise').reason,reason);
  assert.doesNotMatch(reason,/成功率|機率|氣炸|[%％]/);
 }
});

test('available actions stay clickable and open their existing scene exactly once',async()=>{
 for(const action of ['break','career','raise']){
  const app=harness(),run=workState({history:doneWork}),html=app.render(run);
  assert.equal(control(html,action).disabled,false);
  const before=app.calls.save;await app.action(action);
  assert.equal(app.calls[action],1);assert.equal(app.calls.save,before+1);
  assert.equal(app.state().actions.at(-1).type,action);
 }
});

test('rendering explanations never saves, syncs, advances or draws and preserves old cohort controls',()=>{
 const app=harness(),run=workState({lastPromotion:4}),before=JSON.stringify(run),calls={...app.calls};
 app.render(run);app.render(run);
 assert.equal(JSON.stringify(run),before);assert.equal(JSON.stringify(app.state()),before);
 for(const key of ['save','proof','break','career','raise'])assert.equal(app.calls[key],calls[key],key);
 for(const [cohort,hidden]of [['e1',['break','career','raise']],['e9',['career','raise']],['e18',['raise']]]){
  const html=app.render(engine.createRun('sales',`${cohort}-availability-compat`));
  for(const action of hidden)assert.ok(!html.includes(`data-action="${action}"`));
 }
 assert.ok(!app.render(workState({rank:7})).includes('data-action="career"'));
});


test('self-care explains its once-per-workday entry before choosing, including a free cancellation',()=>{
 let opened;
 for(let index=0;index<30;index++){
  const initial=engine.createRun('sales',`e21-ui-rest-cancel-${index}`);
  const source={...initial,eventId:'meeting-ten-minutes',turn:4};
  const candidate=engine.requestBreak(source);
  if(candidate.eventId==='self-care'){opened=candidate;break;}
 }
 assert.ok(opened,'a manual break opens the ordinary self-care menu');
 const app=harness({mobile:true}),canonical=JSON.stringify(engine.getEvent(opened)),before=JSON.stringify(opened),html=app.render(opened);
 const note=html.match(/<p class="self-care-availability-note"[^>]*>([^<]+)<\/p>/)?.[1];
 assert.ok(note);assert.match(note,/每個工作回合只能開啟一次/);assert.match(note,/先不花錢，也算使用這次安排/);
 assert.ok(html.indexOf('self-care-availability-note')<html.indexOf('data-choice='));
 assert.doesNotMatch(note,/\d|[%％]|機率|成功|增加|減少|恢復/);
 assert.equal(JSON.stringify(opened),before);assert.equal(JSON.stringify(engine.getEvent(opened)),canonical);
 const cancel=engine.getEvent(opened).choices.findIndex(choice=>choice.effect==='cancelBreak');assert.ok(cancel>=0);
 const chosen=engine.applyChoice(opened,cancel),returned=engine.advance(chosen);
 assert.equal(returned.eventId,opened.breakReturnEventId);assert.equal(returned.turn,opened.turn);
 assert.equal(engine.canRequestBreak(returned),false);
 assert.match(control(app.render(returned),'break').reason,/這個工作回合已安排過休息/);
 assert.doesNotMatch(app.render(chosen),/class="self-care-availability-note"/);
});
