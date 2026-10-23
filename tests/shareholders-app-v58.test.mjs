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
import * as jobTitles from '../dist/job-titles-v42.js';
import * as shareholderUI from '../dist/shareholders-ui-v58.js';
import * as shareholderEngine from '../dist/shareholders-v58.js';
import {renderEndingReport} from '../dist/ending-report-view.js';
import {polishDreamText} from '../dist/copy-v15.js';
import {polishVerbalHistoryV41} from '../dist/verbal-presentation-v41.js';
import {renderEndingTransition} from '../dist/ending-transition-v40.js';

const appSource=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
const fixture=JSON.parse(readFileSync(new URL('./fixtures/shareholder-routes-v58.json',import.meta.url),'utf8'));
const plain=value=>JSON.parse(JSON.stringify(value));
const load=id=>{const route=fixture.routes.find(row=>row.id===id);assert.ok(route,id);return {...engine.replayRun(route.roleId,route.seed,route.actions),runId:webcrypto.randomUUID()};};
const tick=async()=>{for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve));};

async function harness(mobile=false){
 const nodes=new Map(),listeners=new Map(),dialogListeners=new Map(),calls={save:0,proof:0,play:0,advance:0},callbacks=[];
 const document={activeElement:null,querySelector:selector=>node(selector),addEventListener(type,callback){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(callback);}};
 const node=selector=>{
  if(!nodes.has(selector)){
   const events=new Map();
   nodes.set(selector,{innerHTML:'',textContent:'',title:'',open:false,scrollTop:0,ownerDocument:document,events,
    matches:query=>selector==='[data-shareholder-game-v58]'&&query===selector,contains:()=>true,querySelectorAll:()=>[],
    classList:{add(){},remove(){},toggle(){}},focus(){},scrollIntoView(){},setAttribute(){},
    addEventListener(type,callback){events.set(type,callback);if(selector==='#dialog'){if(!dialogListeners.has(type))dialogListeners.set(type,[]);dialogListeners.get(type).push(callback);}},
    removeEventListener(type,callback){if(events.get(type)===callback)events.delete(type);},
    showModal(){this.open=true;},close(){this.open=false;for(const callback of dialogListeners.get('close')||[])callback({target:this});},
   });
  }
  return nodes.get(selector);
 };
 const context=vm.createContext({...roles,...sources,...endings,...legacy,...engine,...achievements,...career,...currentCareer,...persona,...characterStats,...jobTitles,...shareholderEngine,...shareholderUI,
  polishDreamText,polishVerbalHistoryV41,renderEndingReport,renderEndingTransition,
  applyShareholderPlay(run,input){calls.play++;return engine.applyShareholderPlay(run,input);},
  advance(run){calls.advance++;return engine.advance(run);},
  mountShareholderGameV58(root,options){callbacks.push(options.onPlay);return shareholderUI.mountShareholderGameV58(root,options);},
  createFeedbackUI:()=>({open(){}}),createCharacterBook:()=>({open(){},onSnapshot(){},onRunChanged(){}}),
  cloud:{state:{status:'local',achievements:[],characters:[]},subscribe(){},init:async()=>null,achievementProgress:async()=>null,characterProgress:async()=>{calls.proof++;return null;},complete:async()=>null},
  localStorage:{getItem:()=>null,setItem(){calls.save++;}},document,
  window:{scrollTo(){},matchMedia:()=>({matches:mobile})},crypto:webcrypto,structuredClone,setTimeout:()=>1,clearTimeout(){},
 });
 vm.runInContext(appSource,context);await tick();calls.save=0;calls.proof=0;
 const action=async value=>{
  const target={closest:selector=>selector==='[data-action]'?{dataset:{action:value}}:null};
  for(const callback of listeners.get('click')||[])await callback({target,detail:1});await tick();
 };
 const click=(command,value)=>{
  const target={dataset:{shareholderCommand:command,...(value===undefined?{}:{shareholderValue:String(value)})},disabled:false};
  node('[data-shareholder-game-v58]').events.get('click')?.({target:{closest:()=>target},stopPropagation(){}});
 };
 return {calls,callbacks,context,action,click,html:()=>node('#main').innerHTML,panel:()=>node('[data-shareholder-game-v58]'),dialog:()=>node('#dialog'),
  state:()=>vm.runInContext('run',context),choose:index=>vm.runInContext(`choose(${index})`,context),
  render(run){context.testRun=run;vm.runInContext('run=testRun;game(true)',context);return node('#main').innerHTML;},
  key(value){for(const callback of listeners.get('keydown')||[])callback({key:value,target:{tagName:'BUTTON'},preventDefault(){}});},
 };
}

for(const mobile of [false,true]){
 const device=mobile?'phone':'desktop';
 test(`${device}: subscription and admission remain deliberate ordinary choices with no unpaid shortcut`,async()=>{
  const app=await harness(mobile),offer=load('offer'),snapshot=plain(offer),html=app.render(offer);
  assert.deepEqual(plain(app.state()),snapshot);assert.equal(app.calls.save,0);assert.match(html,/35 存款指數/);assert.match(html,/大企業/);assert.doesNotMatch(html,/data-shareholder-game-v58/);
  assert.equal(app.choose(0),true);const paid=app.state();assert.equal(paid.pending,true);assert.equal(offer.stats.cash-paid.stats.cash,35);assert.equal(paid.flags.shareholder58_owned,35);
  assert.equal(app.choose(0),false,'the pending receipt cannot charge twice');assert.match(app.html(),/認股款已支付/);assert.equal(engine.validRun(paid),true);
  const gate=load('gate');app.render(gate);assert.match(app.html(),/真真/);assert.doesNotMatch(app.html(),/data-shareholder-game-v58/);
  assert.equal(app.choose(0),true);await app.action('next');assert.equal(app.state().shareholderContext,undefined);assert.equal(app.state().flags.shareholder58_attended||0,0);
  app.render(gate);assert.equal(app.choose(1),true);assert.match(app.html(),/股東大會開始/);await app.action('next');
  assert.ok(engine.getShareholderPlayV58(app.state()));assert.match(app.html(),/data-shareholder-game-v58/);assert.match(app.html(),/股東大會攻防/);
  for(const id of ['wing','spencer','erich','jenjen','janet','sonny','jack'])assert.ok(app.html().includes(`./assets/${id}.png`),id);
  assert.doesNotMatch(app.html(),/correctEvidence|rightStatement|successRate|機率\s*\d/);
 });

 test(`${device}: real testimony controls commit once, show a pending consequence, then Continue returns to the same round with the new clue`,async()=>{
  const app=await harness(mobile),source=load('hearing');app.render(source);
  const snapshot=plain(app.state()),saves=app.calls.save;
  for(const index of [0,1,2])assert.equal(app.choose(index),false);app.key('1');
  app.click('statement',0);app.click('evidence','receipt');assert.deepEqual(plain(app.state()),snapshot);assert.equal(app.calls.save,saves);assert.equal(app.calls.play,0);
  app.click('press');app.click('press');app.click('present');await tick();
  const pending=app.state();assert.equal(app.calls.play,1);assert.equal(app.calls.save,saves+1);assert.equal(pending.pending,true);assert.equal(engine.validRun(pending),true);
  assert.deepEqual(plain(pending.actions.at(-1).input),{mode:'press',statement:0,evidence:null});assert.match(app.html(),/追問這句證詞/);assert.match(app.html(),/data-action="next"/);
  assert.doesNotMatch(app.html(),/data-shareholder-game-v58/);assert.equal(app.panel().events.size,0,'pending view removes the old control listeners');
  const recorded=plain(pending),callback=app.callbacks.at(-1);assert.equal(callback({mode:'yield',statement:0,evidence:null}),false,'an old callback cannot submit into a pending result');assert.deepEqual(plain(app.state()),recorded);
  await app.action('next');const after=app.state(),view=engine.getShareholderPlayV58(after);assert.ok(view);assert.equal(view.round,0);assert.equal(view.statements[0].pressed,true);assert.ok(view.evidence.some(file=>file.id==='investment'));
  assert.match(app.html(),/投資意向進度表/);assert.match(app.html(),/剛才的交鋒/);assert.equal(after.stats.cash,source.stats.cash);assert.equal(after.turn,source.turn);
  const clean=plain(after);await app.action('next');assert.deepEqual(plain(app.state()),clean,'Continue is inert when there is no pending result');
  app.click('evidence','investment');app.click('present');await tick();assert.equal(app.state().pending,true);assert.match(app.html(),/異議成立/);await app.action('next');assert.equal(engine.getShareholderPlayV58(app.state()).round,1);
 });

 test(`${device}: stale callbacks, open dialogs and navigating away cannot mutate the suspended meeting`,async()=>{
  const app=await harness(mobile);app.render(load('hearing'));const callback=app.callbacks.at(-1),before=plain(app.state());
  app.dialog().open=true;assert.equal(callback({mode:'press',statement:0,evidence:null}),false);assert.deepEqual(plain(app.state()),before);app.dialog().open=false;
  app.render(app.state());assert.equal(callback({mode:'press',statement:0,evidence:null}),false,'rerender invalidates the earlier view revision');assert.deepEqual(plain(app.state()),before);
  app.click('statement',2);app.click('evidence','risk');await app.action('home');assert.equal(app.panel().events.size,0);
  app.click('present');assert.deepEqual(plain(app.state()),before,'discarded drafts are not game actions');
  await app.action('continue');assert.match(app.html(),/data-shareholder-game-v58/);assert.equal(app.panel().events.size,2);assert.equal(engine.validRun(app.state()),true);
 });

 test(`${device}: questioning statement two keeps that target through the result screen before presenting the new document`,async()=>{
  const app=await harness(mobile),source=load('round-2');app.render(source);
  app.click('statement',1);app.click('press');await tick();assert.equal(app.state().pending,true);await app.action('next');
  const view=engine.getShareholderPlayV58(app.state());assert.equal(view.round,2);assert.equal(view.statements[1].pressed,true);assert.ok(view.evidence.some(file=>file.id==='roster'));
  assert.match(app.html(),/data-shareholder-value="1" aria-pressed="true"/);
  app.click('evidence','roster');app.click('present');await tick();
  assert.deepEqual(plain(app.state().actions.at(-1).input),{mode:'present',statement:1,evidence:'roster'});assert.match(app.html(),/異議成立/);
  await app.action('next');assert.equal(engine.getShareholderPlayV58(app.state()).round,3);assert.match(app.html(),/data-shareholder-value="0" aria-pressed="true"/);assert.match(app.html(),/尚未選文件/);
 });

 test(`${device}: meeting outcomes clearly return to work without accidentally ending the life or repeating the admission charge`,async()=>{
  for(const policy of ['prepared','yield','wrong']){
   const app=await harness(mobile),source=load(`finish-${policy}`),before=plain(source);app.render(source);
   assert.match(app.html(),/股東會結束/);assert.match(app.html(),/回去處理原本的工作/);assert.doesNotMatch(app.html(),/data-shareholder-game-v58/);
   assert.equal(app.choose(0),true);assert.equal(app.state().pending,true);assert.match(app.html(),/這場股東會已結束/);await app.action('next');
   const returned=app.state();assert.equal(returned.shareholderContext,undefined);assert.equal(returned.completed,false);assert.equal(returned.eventId,before.shareholderContext.returnEventId);assert.equal(returned.stats.cash,before.stats.cash);assert.equal(returned.turn,before.turn);assert.equal(engine.validRun(returned),true);
   assert.match(app.html(),/員工股東/);assert.doesNotMatch(app.html(),/data-shareholder-game-v58/);
  }
 });
}
