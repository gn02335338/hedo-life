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
 const nodes=new Map(),listeners=new Map(),calls={save:0,proof:0,break:0,scroll:[]};
 const node=selector=>{
  if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',title:'',open:false,
   classList:{add(){},remove(){},toggle(){}},focus(){},setAttribute(){},addEventListener(){},
   scrollIntoView(){calls.scroll.push(selector);},showModal(){this.open=true;},close(){this.open=false;},
  });return nodes.get(selector);
 };
 const context=vm.createContext({...roles,...sources,...endings,...legacy,...engine,...achievements,...career,...currentCareer,...persona,...characterStats,polishDreamText,
  requestBreak(run){calls.break++;return engine.requestBreak(run);},
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

// Isolated display states deliberately exercise resource boundaries without
// altering the authored outcomes or the deterministic engine fixtures.
function workState(stats={},cohort='e20'){
 const run=engine.createRun('system',`${cohort}-resource-warning-ui`);
 return {...run,eventId:cohort==='e20'?'meimei-product-loop':'meeting-ten-minutes',turn:4,stats:{...run.stats,mood:70,energy:70,cash:70,...stats}};
}
function region(html){
 const attribute=html.indexOf('data-resource-warning');if(attribute<0)return '';
 const start=html.lastIndexOf('<',attribute),root=html.slice(start).match(/^<([a-z][a-z0-9-]*)\b/i)?.[1];
 assert.ok(root,'warning has an actual container');
 let depth=0;
 for(const match of html.slice(start).matchAll(/<(\/?)([a-z][a-z0-9-]*)\b[^>]*>/gi)){
  if(match[2]!==root)continue;depth+=match[1]?-1:1;
  if(depth===0)return html.slice(start,start+match.index+match[0].length);
 }
 assert.fail('warning container closes');
}
const statsIn=html=>[...region(html).matchAll(/\bdata-warning-stat="([^"]+)"/g)].map(match=>match[1]).sort();
const hasBreak=html=>/\bdata-action="break"/.test(region(html));

test('resource warning starts at 30, becomes critical at 15, and disappears after recovery',()=>{
 const app=harness();
 assert.equal(region(app.render(workState({energy:31,mood:31}))), '');
 for(const key of ['energy','mood']){
  const caution=app.render(workState({[key]:30}));
  assert.deepEqual(statsIn(caution),[key]);assert.match(region(caution),/\bcaution\b/);assert.match(region(caution),/\b30\b/);
  assert.match(region(app.render(workState({[key]:16}))),/\bcaution\b/);
  assert.match(region(app.render(workState({[key]:15}))),/\bcritical\b/);
  assert.match(region(app.render(workState({[key]:1}))),/\bcritical\b/);
 }
 assert.equal(region(app.render(workState({energy:60,mood:60}))), '');
});

test('both low resources share one accessible warning before the current choices',()=>{
 const html=harness().render(workState({energy:15,mood:25}));
 assert.equal([...html.matchAll(/\bdata-resource-warning\b/g)].length,1);
 assert.deepEqual(statsIn(html),['energy','mood']);assert.match(region(html),/role="alert"/);
 assert.ok(html.indexOf('chapter-progress')<html.indexOf('data-resource-warning'));
 assert.ok(html.indexOf('data-resource-warning')<html.indexOf('class="chapter-title"'));
 assert.ok(html.indexOf('data-resource-warning')<html.indexOf('data-choice='));
 assert.match(region(html),/體力/);assert.match(region(html),/心情/);assert.match(region(html),/歸零|耗盡/);
});

test('reading low resource warnings does not save, draw RNG, advance, or disclose choice outcomes',()=>{
 const app=harness(),run=workState({energy:20,mood:20}),before=JSON.stringify(run),calls={...app.calls};
 const html=app.render(run);app.render(run);
 assert.equal(JSON.stringify(run),before);assert.equal(JSON.stringify(app.state()),before);
 for(const key of ['save','proof','break'])assert.equal(app.calls[key],calls[key],key);
 const warning=region(html);
 assert.doesNotMatch(warning,/data-choice|delta-list|luck-result|success|成功率|機率|概率|下一個選項|選擇後將|[%％]/i);
 const event=engine.getEvent(run);
 for(const choice of event.choices)if(choice.result.length>10)assert.ok(!warning.includes(persona.displayText(choice.result)));
});

test('available warning recovery uses the existing break action exactly once, including PIP workdays',async()=>{
 for(const pip of [null,{active:true,remaining:2}]){
  const app=harness(),run=workState({energy:25,mood:25});run.pip=pip;
  assert.equal(engine.canRequestBreak(run),true);assert.equal(hasBreak(app.render(run)),true);
  const expected=engine.requestBreak(run),savedBefore=app.calls.save;await app.action('break');
  assert.equal(app.calls.break,1);assert.equal(app.calls.save,savedBefore+1);
  assert.equal(JSON.stringify(app.state()),JSON.stringify(expected));
 }
});

test('pending results show the warning inside the visible result before Continue, without a rest action',()=>{
 const app=harness({mobile:true}),pending=engine.applyChoice(workState(),0);
 pending.stats.energy=25;pending.stats.mood=25;pending.pendingFamily=null;
 const html=app.render(pending,true);
 assert.equal([...html.matchAll(/\bdata-resource-warning\b/g)].length,1);
 assert.ok(html.indexOf('class="consequence')<html.indexOf('data-resource-warning'));
 assert.ok(html.indexOf('data-resource-warning')<html.indexOf('AND THEN'));
 assert.ok(html.indexOf('data-resource-warning')<html.indexOf('data-action="next"'));
 assert.equal(hasBreak(html),false);assert.match(region(html),/結果/);
 assert.equal(app.calls.scroll.at(-1),'.consequence');
});

test('used rest, personnel notices, and ongoing rage never promise an available recovery shortcut',()=>{
 const app=harness(),used=workState({energy:25,mood:25});used.lastBreakTurn=used.turn;
 assert.equal(hasBreak(app.render(used)),false);assert.match(region(app.render(used)),/本工作回合|這個工作回合|今天|本回合/);
 for(const eventId of ['dismissal-final','floor-notice','watch-review']){
  const run=workState({energy:25,mood:25});run.eventId=eventId;
  assert.equal(hasBreak(app.render(run)),false,eventId);
 }
 let rage=engine.requestRage(engine.createRun('system','e20-resource-warning-rage'));rage.stats.energy=25;rage.stats.mood=25;
 const rageHTML=app.render(rage);assert.equal(hasBreak(rageHTML),false);assert.match(region(rageHTML),/暴走|失控|後續/);
});

test('care scenes point to their own choices and never add a recursive break control',()=>{
 const app=harness(),care=workState({energy:25,mood:25});care.eventId='self-care';care.breakReturnEventId='meimei-product-loop';
 assert.equal(hasBreak(app.render(care)),false);assert.match(region(app.render(care)),/休息|休整/);
 const crisis=workState({energy:25,mood:10});crisis.eventId='crisis-mood';crisis.resumeEventId='meimei-product-loop';
 assert.equal(hasBreak(app.render(crisis)),false);assert.match(region(app.render(crisis)),/眼前|畫面|情緒/);
});

test('zero, a committed ending, and the existing collapse scene do not get a misleading near-zero alert',()=>{
 const app=harness();
 assert.equal(region(app.render(workState({energy:0}))), '');assert.equal(region(app.render(workState({mood:0}))), '');
 const ending=engine.applyChoice(workState(),0);ending.stats.energy=20;ending.stats.mood=20;ending.pendingFamily='burnout';
 assert.equal(region(app.render(ending)), '');
 const collapse=workState({energy:20,mood:0});collapse.eventId='mood-collapse';collapse.meltdownReturnEventId='meimei-product-loop';
 const html=app.render(collapse);assert.equal(region(html), '');assert.match(html,/collapse-banner/);
});

test('old runs keep their mood crisis wording instead of claiming the new actual-collapse rule',()=>{
 const run=workState({energy:70,mood:20},'e17'),html=harness().render(run),warning=region(html);
 assert.match(warning,/情緒|危機|低落/);assert.doesNotMatch(warning,/真正失控|真的失控|當場崩潰/);
});
