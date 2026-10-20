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
const witnesses=JSON.parse(await readFile(new URL('./fixtures/personnel-routes-v20.json',import.meta.url),'utf8'));
function teamRun(phase='event'){
 const route=witnesses.routes.find(row=>row.id==='direct-without-pip');assert.ok(route);
 let run=engine.replayRun(route.roleId,route.seed,route.actions);run.runId=webcrypto.randomUUID();
 assert.equal(engine.getEvent(run).speaker,'exit-team');
 if(phase==='result')run=engine.applyChoice(run,1);
 assert.equal(engine.canRequestRage(run),true);return run;
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function harness(){
 const nodes=new Map(),listeners=new Map(),dialogListeners=new Map();
 const calls={rage:[],save:0,proof:0,advance:0};
 const node=selector=>{
  if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',title:'',open:false,scrollTop:0,
   classList:{add(){},remove(){},toggle(){}},focus(){},scrollIntoView(){},setAttribute(){},
   addEventListener(type,callback){if(selector!=='#dialog')return;if(!dialogListeners.has(type))dialogListeners.set(type,[]);dialogListeners.get(type).push(callback);},
   showModal(){this.open=true;},close(){this.open=false;for(const callback of dialogListeners.get('close')||[])callback({target:this});},
  });return nodes.get(selector);
 };
 const context=vm.createContext({...roles,...sources,...endings,...legacy,...engine,...achievements,...career,...currentCareer,...persona,...characterStats,polishDreamText,
  requestRage(...args){calls.rage.push({argsLength:args.length,target:args[1],phase:args[0].pending?'result':'event'});return engine.requestRage(...args);},
  advance(run){calls.advance++;return engine.advance(run);},
  createFeedbackUI:()=>({open(){}}),createCharacterBook:()=>({open(){},onSnapshot(){},onRunChanged(){}}),
  cloud:{state:{status:'local',achievements:[],characters:[]},subscribe(){},init:async()=>null,achievementProgress:async()=>null,characterProgress:async()=>{calls.proof++;return null;},complete:async()=>null},
  localStorage:{getItem:()=>null,setItem(){calls.save++;}},
  document:{querySelector:node,addEventListener(type,callback){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(callback);}},
  window:{scrollTo(){},matchMedia:()=>({matches:false})},crypto:webcrypto,structuredClone,setTimeout:()=>1,clearTimeout(){},
 });
 vm.runInContext(appSource,context,{filename:'dist/app.js'});
 return {context,calls,nodes,state:()=>vm.runInContext('run',context),dialog:()=>node('#dialog'),picker:()=>node('#dialog-content').innerHTML,html:()=>node('#main').innerHTML,
  render(run){context.testRun=run;vm.runInContext('run=testRun;game(false)',context);},
  async action(action,target){const event={target:{closest:selector=>selector==='[data-action]'?{dataset:{action,rageTarget:target}}:null}};for(const callback of listeners.get('click')||[])await callback(event);},
  cancel(){for(const callback of dialogListeners.get('cancel')||[])callback({target:node('#dialog')});node('#dialog').open=false;},
 };
}

test('a group rage opens only portraits of the people present without drawing, saving or syncing',async()=>{
 const app=harness();await tick();const run=teamRun(),before=JSON.stringify(run);app.render(run);
 const saved=app.calls.save;await app.action('rage');
 assert.equal(app.dialog().open,true);assert.equal(JSON.stringify(app.state()),before);
 assert.equal(app.calls.rage.length,0);assert.equal(app.calls.proof,0);assert.equal(app.calls.save,saved);assert.equal(app.calls.advance,0);
 const html=app.picker();assert.match(html,/data-rage-target-picker/);
 for(const id of ['erich','jenjen','sonny']){assert.ok(html.includes(`data-rage-target="${id}"`));assert.ok(html.includes(`src="./assets/${id}.png"`));assert.ok(html.includes(persona.PERSONAS[id].name));assert.ok(html.includes(persona.PERSONAS[id].title));}
 assert.equal([...html.matchAll(/data-rage-target="/g)].length,3);
 assert.doesNotMatch(html,/data-rage-target="(?:wing|rick|hope|meimei|jack|kind|spencer)"/);
 assert.doesNotMatch(html,/Wing|Erich|Sonny|JenJen|幻想|夢境|真的|機率|成功率|數值|好感|\d+%/);
});

test('an explicitly shared two-person conversation shows two cards and permits either present character',async()=>{
 const app=harness();await tick();
 // Isolated UI state; natural route fixtures separately cover event selection.
 const run={...engine.createRun('system','e20-ui-pair-picker'),eventId:'meimei-missing-ticket',turn:6};
 run.runId=webcrypto.randomUUID();app.render(run);await app.action('rage');
 const html=app.picker();assert.match(html,/class="rage-target-grid targets-2"/);
 assert.equal([...html.matchAll(/data-rage-target="/g)].length,2);
 assert.match(html,/data-rage-target="meimei"/);assert.match(html,/data-rage-target="jack"/);
 assert.doesNotMatch(html,/data-rage-target="(?:wing|rick|hope|sonny|jenjen|erich)"/);
 await app.action('rage-target','jack');assert.equal(app.calls.rage.length,1);assert.equal(app.state().rageContext.target,'jack');
});

test('cancel, close and Escape leave the conversation, RNG and proof queue unchanged',async()=>{
 for(const mode of ['cancel','close','escape']){
  const app=harness();await tick();const run=teamRun(),before=JSON.stringify(run);app.render(run);const saved=app.calls.save;
  await app.action('rage');
  if(mode==='cancel')await app.action('rage-cancel');else if(mode==='close')await app.action('close-dialog');else app.cancel();
  await app.action('rage-target','sonny');
  assert.equal(app.dialog().open,false,mode);assert.equal(JSON.stringify(app.state()),before,mode);
  assert.equal(app.calls.rage.length,0,mode);assert.equal(app.calls.proof,0,mode);assert.equal(app.calls.save,saved,mode);assert.equal(app.calls.advance,0,mode);
 }
});

test('choosing a present person resolves once and the history, portrait and statistics identify only that person',async()=>{
 for(const target of ['erich','jenjen','sonny']){
  const app=harness();await tick();const run=teamRun(),history=structuredClone(run.history),before=characterStats.deriveCharacterStats(run);app.render(run);
  await app.action('rage');await app.action('rage-target',target);await tick();
  assert.equal(app.dialog().open,false);assert.equal(app.calls.rage.length,1);assert.equal(app.calls.rage[0].target,target);
  const next=app.state(),last=next.history.at(-1);assert.equal(next.pending,true);assert.equal(next.rageContext.target,target);assert.equal(last.eventId,'rage-release');assert.equal(last.speaker,target);
  assert.deepEqual(next.history.slice(0,-1),history);assert.equal(next.actions.length,run.actions.length+1);assert.equal(app.calls.advance,0);assert.equal(app.calls.proof,1);
  const after=characterStats.deriveCharacterStats(next);
  for(const id of ['erich','jenjen','sonny'])assert.equal(after.find(row=>row.id===id).encounters-before.find(row=>row.id===id).encounters,id===target?1:0);
  const quote=app.html().match(/<div class="character-quote">[\s\S]*?<\/div><\/div>/)?.[0];assert.ok(quote);assert.ok(quote.includes(`src="./assets/${target}.png"`));assert.ok(quote.includes(persona.PERSONAS[target].name));assert.doesNotMatch(quote,/avatar-group/);
 }
});

test('choosing after a revealed group result preserves the committed choice and records the result phase',async()=>{
 const app=harness();await tick();const run=teamRun('result'),history=structuredClone(run.history);app.render(run);
 await app.action('rage');assert.equal(app.calls.rage.length,0);await app.action('rage-target','sonny');
 const next=app.state();assert.equal(app.calls.rage[0].phase,'result');assert.equal(next.actions.at(-1).phase,'result');
 assert.equal(next.rageContext.target,'sonny');assert.deepEqual(next.history.slice(0,-1),history);assert.equal(next.rageContext.historyLength,history.length);assert.equal(next.rageContext.pendingEffect,run.pendingEffect);
 assert.equal(next.actions.length,run.actions.length+1);assert.equal(app.calls.advance,0);
});

test('solo conversations still resolve with one click and no optional target argument',async()=>{
 for(const phase of ['event','result']){
  const app=harness();await tick();let run=engine.createRun('system',`e20-solo-picker-${phase}`);run.runId=webcrypto.randomUUID();
  if(phase==='result')run=engine.applyChoice(run,0);app.render(run);
  await app.action('rage');assert.equal(app.dialog().open,false);assert.equal(app.calls.rage.length,1);assert.equal(app.calls.rage[0].argsLength,1);assert.equal(app.calls.rage[0].target,undefined);assert.equal(app.state().rageContext.target,'wing');
 }
});

test('e13 keeps its published rage menu even though direct conversational targets are unavailable',async()=>{
 const app=harness();await tick();const run=engine.createRun('system','e13-ui-group-compatibility');run.runId=webcrypto.randomUUID();
 assert.deepEqual(engine.getRageTargets(run),[]);app.render(run);await app.action('rage');
 assert.equal(app.dialog().open,false);assert.equal(app.calls.rage.length,1);assert.equal(app.calls.rage[0].argsLength,1);
 assert.equal(app.state().eventId,'rage-menu');assert.doesNotMatch(app.picker(),/data-rage-target-picker/);
});

test('rapid open and confirmation double-clicks commit a group rage only once',async()=>{
 const app=harness();await tick();const run=teamRun();app.render(run);
 await app.action('rage');await app.action('rage');assert.equal(app.calls.rage.length,0);
 await app.action('rage-target','sonny');const resolved=JSON.stringify(app.state());await app.action('rage-target','sonny');
 assert.equal(app.calls.rage.length,1);assert.equal(app.calls.proof,1);assert.equal(JSON.stringify(app.state()),resolved);
 assert.equal(app.state().actions.length,run.actions.length+1);
});

test('absent or malformed targets cannot commit a rage or replace the current selection',async()=>{
 const app=harness();await tick();const run=teamRun(),before=JSON.stringify(run);app.render(run);await app.action('rage');
 for(const target of ['wing','rick','not-a-person','__proto__',undefined])await app.action('rage-target',target);
 assert.equal(JSON.stringify(app.state()),before);assert.equal(app.calls.rage.length,0);assert.equal(app.dialog().open,true);
 await app.action('rage-target','jenjen');assert.equal(app.calls.rage.length,1);assert.equal(app.state().rageContext.target,'jenjen');
});

test('changing the run, action prefix, event, phase or view invalidates an open target picker',async()=>{
 for(const mutation of [
  'run=structuredClone(run)',
  'run.actions.push({type:"stale-test"})',
  'run.eventId="labor-claim"',
  'run.pending=!run.pending',
  'run.runId=crypto.randomUUID()',
  'home();game(false)',
  'openDialog("<h2 id=dialog-title>另一個視窗</h2>")',
 ]){
  const app=harness();await tick();app.render(teamRun());await app.action('rage');
  vm.runInContext(mutation,app.context);await app.action('rage-target','sonny');
  assert.equal(app.calls.rage.length,0,mutation);assert.equal(app.calls.proof,0,mutation);assert.equal(app.calls.advance,0,mutation);
 }
});

test('advancing or opening a new-life confirmation cannot reuse a previous group picker',async()=>{
 for(const mode of ['advance','new-life']){
  const app=harness();await tick();app.render(teamRun('result'));await app.action('rage');
  if(mode==='advance')await app.action('next');else await app.action('new');
  const before=JSON.stringify(app.state()),proofs=app.calls.proof;
  await app.action('rage-target','sonny');assert.equal(app.calls.rage.length,0,mode);assert.equal(JSON.stringify(app.state()),before,mode);assert.equal(app.calls.proof,proofs,mode);
 }
});
