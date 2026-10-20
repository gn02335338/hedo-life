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
import {EVENTS} from '../dist/events.js';
import {polishDreamText} from '../dist/copy-v15.js';

const source=(await readFile(new URL('../dist/app.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const escapeHTML=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const display=value=>escapeHTML(persona.displayText(value));

function appHarness({mobile=false}={}){
 const nodes=new Map(),listeners=new Map(),dialogListeners=new Map();
 const calls={save:0,proof:[],rage:[],book:[],scroll:[],break:0,raise:0};
 const node=selector=>{
  if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',title:'',open:false,scrollTop:0,
   classList:{add(){},remove(){},toggle(){}},focus(){},setAttribute(){},
   scrollIntoView(){calls.scroll.push(selector);},
   addEventListener(type,callback){if(selector!=='#dialog')return;if(!dialogListeners.has(type))dialogListeners.set(type,[]);dialogListeners.get(type).push(callback);},
   showModal(){this.open=true;},close(){this.open=false;for(const cb of dialogListeners.get('close')||[])cb({target:this});},
  });return nodes.get(selector);
 };
 const context=vm.createContext({...roles,...sources,...endings,...legacy,...engine,...achievements,...career,...currentCareer,...persona,...characterStats,polishDreamText,
  requestRage(...args){calls.rage.push(args[1]);return engine.requestRage(...args);},
  requestBreak(run){calls.break++;return engine.requestBreak(run);},
  requestRaise(run){calls.raise++;return engine.requestRaise(run);},
  createFeedbackUI:()=>({open(){}}),
  createCharacterBook:()=>({open(id){calls.book.push(id);},onSnapshot(){},onRunChanged(){}}),
  cloud:{state:{status:'local',achievements:[],characters:[]},subscribe(){},init:async()=>null,achievementProgress:async()=>null,
   characterProgress:async run=>{calls.proof.push(structuredClone(run));return null;},complete:async()=>null},
  localStorage:{getItem:()=>null,setItem(){calls.save++;}},
  document:{querySelector:node,addEventListener(type,callback){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(callback);}},
  window:{scrollTo(){},matchMedia:()=>({matches:mobile})},crypto:webcrypto,structuredClone,setTimeout:()=>1,clearTimeout(){},
 });
 vm.runInContext(source,context,{filename:'dist/app.js'});
 async function click(dataset,choice=false){
  const target={closest:selector=>selector===(choice?'[data-choice]':'[data-action]')?{dataset}:null};
  for(const callback of listeners.get('click')||[])await callback({target});
 }
 return {calls,context,node,state:()=>vm.runInContext('run',context),html:()=>node('#main').innerHTML,dialogHTML:()=>node('#dialog-content').innerHTML,
  render(run,focus=false){context.testRun=run;vm.runInContext(`run=testRun;game(${focus})`,context);return node('#main').innerHTML;},
  action:(action,extra={})=>click({action,...extra}),choice:index=>click({choice:String(index)},true),
 };
}

// Find real first-day selections rather than assigning a new event by hand.
// Other tests separately cover the full deterministic routes and server replay.
const firstWorkCache=new Map();
function firstWork(roleId){
 if(firstWorkCache.has(roleId))return structuredClone(firstWorkCache.get(roleId));
 for(let n=0;n<600;n++){
  let run=engine.createRun(roleId,`e21-ui-first-${roleId}-${n}`);
  if(run.actualRoleId!==roleId)continue;
  run=engine.advance(engine.applyChoice(run,0));
  const authored=EVENTS.find(event=>event.id===run.eventId);
  if(!run.completed&&authored?.minRules===21&&authored.roles?.length===1&&authored.roles[0]===roleId){
   run.runId=webcrypto.randomUUID();firstWorkCache.set(roleId,run);return structuredClone(run);
  }
 }
 throw new Error(`No naturally selected new ${roleId} scene`);
}
function raiseReady(){
 for(let n=0;n<250;n++){
  let run=engine.createRun('sales',`e21-ui-raise-${n}`);
  if(run.actualRoleId!=='sales')continue;
  for(let step=0;step<20&&!run.completed;step++){
   if(engine.canRequestRaise(run)){run.runId=webcrypto.randomUUID();return run;}
   if(run.pending)run=engine.advance(run);else{
    const choices=engine.getEvent(run).choices,index=choices.findIndex(c=>c.available!==false);
    if(index<0)break;run=engine.applyChoice(run,index);
   }
  }
 }
 throw new Error('No natural new-cohort raise opportunity');
}
const button=(html,action)=>html.match(new RegExp(`<button\\b(?=[^>]*\\bdata-action="${action}")[^>]*>`))?.[0]||'';

test('new UI candidates use e21 and retain the full eight-rank ladder and original portraits',async()=>{
 const app=appHarness();await tick();await app.action('roll');
 const candidate=vm.runInContext('candidate',app.context);assert.match(candidate.seed,/^e21-/);
 await app.action('start');const html=app.html();
 assert.equal(app.state().seed,candidate.seed);assert.equal(career.careerLevels(app.state()).length,8);
 assert.match(html,/aria-label="八階職涯"/);assert.equal([...html.matchAll(/<small>LV\.\d<\/small>/g)].length,8);
 assert.match(html,/src="\.\/assets\/wing\.png"/);assert.match(html,/翅膀/);
 assert.doesNotMatch(html,/這局保留原本的玩法|新的當場暴走與失控後續，從新人生開始/);
 await app.action('career-guide');const guide=app.dialogHTML();
 assert.match(guide,/八階都有各自的工作責任/);
 for(const title of career.careerLadder(app.state()))assert.ok(guide.includes(display(title)),title);
});

test('naturally selected sales, BD and design scenes show all authored choices without leaking outcomes',async()=>{
 for(const roleId of ['sales','bd','design']){
  const app=appHarness();await tick();const run=firstWork(roleId),event=engine.getEvent(run),before=JSON.stringify(run),saved=app.calls.save;
  const html=app.render(run),choicesHTML=html.slice(html.indexOf('<div class="choices '));
  assert.equal(event.choices.length,3);assert.equal(event.choices.filter(c=>c.wild).length,1);
  assert.equal([...choicesHTML.matchAll(/\bdata-choice="/g)].length,3);
  for(const choice of event.choices){assert.ok(choicesHTML.includes(display(choice.text)),`${roleId} authored text`);assert.ok(!html.includes(display(choice.result)),`${roleId} unrevealed result`);}
  assert.ok(choicesHTML.indexOf('data-action="rage"')>choicesHTML.lastIndexOf('data-choice='),'rage follows all authored replies');
  assert.doesNotMatch(html,/outcome-ledger|delta-chip|luck-result/);
  assert.doesNotMatch(html.replace(/<[^>]*>/g,''),/成功率|[+-]\d+|\d+(?:\.\d+)?\s*[%％]/);
  assert.match(html,new RegExp(`src="\\./assets/${event.speaker}\\.png"`));
  assert.equal(JSON.stringify(app.state()),before);assert.equal(app.calls.proof.length,0);assert.equal(app.calls.save,saved);
 }
});

test('choosing the new absurd reply reveals its own result and ledger and sends one character proof',async()=>{
 const app=appHarness({mobile:true});await tick();const run=firstWork('sales'),event=engine.getEvent(run),index=event.choices.findIndex(c=>c.wild);
 app.render(run);const historyLength=run.history.length,actionsLength=run.actions.length,saved=app.calls.save;
 await app.choice(index);await app.choice(index);await tick();
 const next=app.state(),last=next.history.at(-1),html=app.html();
 assert.equal(next.pending,true);assert.equal(next.history.length,historyLength+1);assert.equal(next.actions.length,actionsLength+1);
 assert.equal(last.choiceIndex,index);assert.equal(last.eventId,event.id);assert.ok(last.result.startsWith(event.choices[index].result),'authored reply survives the subsequent daily mood/energy pulse');
 assert.ok(html.includes(display(last.result)));assert.match(html,/outcome-ledger/);assert.match(html,/事件後數值變化/);assert.match(html,/這次實際變化/);
 for(const[key,delta]of Object.entries(last.delta))if(delta!==0&&engine.STAT_LABELS[key]){
  assert.ok(html.includes(`>${delta>0?'+':''}${delta}</b>`),`${key} actual committed change`);
 }
 assert.equal(app.calls.proof.length,1);assert.equal(app.calls.proof[0].actions.length,next.actions.length);assert.equal(app.calls.proof[0].history.at(-1).eventId,event.id);
 assert.equal(app.calls.save,saved+1);assert.equal(app.calls.scroll.at(-1),'.consequence');
 await app.action('characters',{characterId:event.speaker});assert.equal(app.calls.book.at(-1),event.speaker);
});

test('e21 low resources retain real-collapse warnings and open current spending choices',async()=>{
 const app=appHarness({mobile:true});await tick();const run=firstWork('bd');
 // UI boundary state: only current resources differ; no hidden outcomes are evaluated.
 run.stats={...run.stats,energy:15,mood:22,cash:90};const before=JSON.stringify(run),html=app.render(run,true);
 assert.match(html,/data-resource-warning/);assert.match(html,/resource-warning critical/);assert.match(html,/心情歸零會真正失控/);
 assert.doesNotMatch(html,/新版心情消耗.*從新人生開始/);assert.equal(JSON.stringify(app.state()),before);
 assert.equal(app.calls.scroll.at(-1),'.chapter');assert.ok(button(html,'break'));assert.doesNotMatch(button(html,'break'),/disabled/);
 await app.action('break');assert.equal(app.calls.break,1);assert.equal(app.state().breakReturnEventId,run.eventId);
 if(app.state().eventId==='kind-break'){
  const reject=engine.getEvent(app.state()).choices.findIndex(c=>c.effect==='declineKind');
  // Most seeds go directly to self care; the invitation remains a separate scene.
  assert.match(app.html(),/阿良/);assert.ok(reject>=0||engine.getEvent(app.state()).choices.length>1);
 }else{
  assert.equal(app.state().eventId,'self-care');assert.match(app.html(),/存款怎麼花|花費/);
  assert.match(app.html(),/補眠|睡|週末/);assert.doesNotMatch(app.html(),/這局保留原本的玩法/);
 }
 assert.equal(app.calls.proof.length,0,'opening spending does not commit a character interaction');
});

test('new-cohort salary discussion remains available independently of promotion',async()=>{
 const app=appHarness();await tick();const run=raiseReady(),turn=run.turn,rank=run.rank;
 assert.equal(engine.canRequestRaise(run),true);const html=app.render(run);
 assert.match(html,/我要談加薪/);assert.doesNotMatch(button(html,'raise'),/disabled/);
 await app.action('raise');assert.equal(app.calls.raise,1);assert.equal(app.state().eventId,'raise-request');
 assert.equal(app.state().turn,turn);assert.equal(app.state().rank,rank);assert.match(app.html(),/薪水/);
 assert.doesNotMatch(app.html(),/談加薪從新人生開啟/);
});

test('personnel notices lock side routes while floor assignment stays visible on desktop and mobile',async()=>{
 const app=appHarness({mobile:true});await tick();const run=firstWork('design');
 run.turn=6;run.eventId='floor-notice';run.flags.floor_watch=1;run.flags.post_pip_tolerance=1;run.stats.energy=20;
 const html=app.render(run);
 for(const action of ['break','career','raise','exit'])assert.match(button(html,action),/disabled/,`${action} cannot bypass personnel notice`);
 assert.match(html,/class="personnel-status floor-watch-status"/);assert.match(html,/辦公室在五樓・原職稱保留/);assert.match(html,/PIP 已通過・仍在觀察/);
 const mobile=html.match(/<div class="mobile-workbar">[\s\S]*?<\/div>/)?.[0];assert.ok(mobile);assert.match(mobile,/三樓看門中/);
 assert.match(html,/class="tag">人事通知/);assert.match(html,/data-resource-warning/);
 assert.doesNotMatch(html,/<button[^>]*class="resource-rest-button"/,'warning never offers a disabled personnel shortcut');
});

test('new-cohort solo rage resolves immediately and shared scenes require a present target',async()=>{
 const solo=appHarness();await tick();let run=engine.createRun('sales','e21-ui-solo-rage');run.runId=webcrypto.randomUUID();solo.render(run);
 await solo.action('rage');assert.equal(solo.calls.rage.length,1);assert.equal(solo.calls.rage[0],undefined);assert.equal(solo.state().rageContext.target,'wing');
 assert.match(solo.html(),/腦內夢境|現實失控/);assert.equal(solo.calls.proof.length,1);
 const group=appHarness();await tick();run=firstWork('sales');run.eventId='dismissal-final';group.render(run);
 const before=JSON.stringify(group.state());await group.action('rage');
 assert.equal(JSON.stringify(group.state()),before);assert.equal(group.calls.proof.length,0);assert.equal(group.calls.rage.length,0);
 const picker=group.dialogHTML();for(const id of ['erich','jenjen','sonny'])assert.match(picker,new RegExp(`data-rage-target="${id}"`));
 assert.doesNotMatch(picker,/data-rage-target="wing"|夢境|真的|成功率|\d+[%％]/);
 await group.action('rage-target',{rageTarget:'sonny'});assert.equal(group.calls.rage.length,1);assert.equal(group.state().rageContext.target,'sonny');
 assert.equal(group.state().history.at(-1).speaker,'sonny');assert.equal(group.calls.proof.length,1);
});

test('e21 guides retain modern resource and group-rage rules without publishing schedule odds',async()=>{
 const app=appHarness();await tick();app.render(firstWork('sales'));await app.action('guide');
 const html=app.dialogHTML();
 assert.match(html,/三頭馬車/);assert.match(html,/備份紀錄|租練團室/);assert.match(html,/我要談加薪/);assert.match(html,/多人同場會先讓你選一位/);
 assert.doesNotMatch(html,/你目前這局沿用原規則|\d+(?:\.\d+)?\s*[%％]|專屬.{0,8}[57]0|共通.{0,8}[23]0/);
 assert.doesNotMatch(html,/sales21-|bd21-|design-v21-/);
});
