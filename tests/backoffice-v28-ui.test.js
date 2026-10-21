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
import {BACKOFFICE_ROLE_IDS_V28,BACKOFFICE_LADDERS_V28} from '../dist/roles-v28.js';
import {BACKOFFICE_EVENTS_V28} from '../dist/events-backoffice-v28.js';
import {polishDreamText} from '../dist/copy-v15.js';
import {renderEndingReport} from '../dist/ending-report-view.js';

const source=(await readFile(new URL('../dist/app.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
const {routes}=JSON.parse(await readFile(new URL('./fixtures/backoffice-routes-v28.json',import.meta.url),'utf8'));
const scenes=routes.filter(route=>route.index===0&&!route.id.startsWith('role-'));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const display=value=>String(persona.displayText(value)).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const groups={
 'accounting28-final-form':['sophie','sonny'],
 'hr28-coffee-jd':['wing','hope'],
 'hr28-onboarding-notice':['wing','sonny'],
 'hr28-attendance-access':['jack','meimei'],
 'admin28-extension-grandeur':['wing','jenjen','erich','sonny'],
 'admin28-supply-minimum':['wing','jenjen'],
 'admin28-seat-key':['sophie','sonny'],
};

async function appHarness({mobile=false,saved=null,random=.5}={}){
 const nodes=new Map(),listeners=new Map(),calls={saves:0,proofs:[],scroll:[],rage:[]};
 const node=selector=>{
  if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',title:'',open:false,scrollTop:0,
   classList:{add(){},remove(){},toggle(){}},focus(){},setAttribute(){},addEventListener(){},
   scrollIntoView(){calls.scroll.push(selector);},showModal(){this.open=true;},close(){this.open=false;},
  });return nodes.get(selector);
 };
 const context=vm.createContext({...roles,...sources,...endings,...legacy,...engine,...achievements,...career,...currentCareer,...persona,...characterStats,polishDreamText,renderEndingReport,
  requestRage(...args){calls.rage.push({target:args[1],phase:args[0].pending?'result':'event'});return engine.requestRage(...args);},
  Math:Object.assign(Object.create(Math),{random:()=>random}),
  createFeedbackUI:()=>({open(){}}),createCharacterBook:()=>({open(){},onSnapshot(){},onRunChanged(){}}),
  cloud:{state:{status:'offline',achievements:[],characters:[]},subscribe(){},init:async()=>null,achievementProgress:async()=>null,
   characterProgress:async run=>{calls.proofs.push(structuredClone(run));return null;},complete:async()=>null},
  localStorage:{getItem:key=>key==='hedo-life-v3'&&saved?JSON.stringify(saved):null,setItem(){calls.saves++;}},
  document:{querySelector:node,addEventListener(type,callback){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(callback);}},
  window:{scrollTo(){},matchMedia:()=>({matches:mobile})},crypto:webcrypto,structuredClone,setTimeout:()=>1,clearTimeout(){},
 });
 vm.runInContext(source,context,{filename:'dist/app.js'});await tick();calls.saves=0;calls.proofs.length=0;
 async function click(selector,dataset){
  const target={closest:s=>s===selector?{dataset}:null};for(const callback of listeners.get('click')||[])await callback({target});await tick();
 }
 return {calls,context,node,state:()=>vm.runInContext('run',context),candidate:()=>vm.runInContext('candidate',context),html:()=>node('#main').innerHTML,
  dialog:()=>node('#dialog-content').innerHTML,
  render(run,focus=true){context.fixtureRun=run;vm.runInContext(`run=fixtureRun;game(${focus})`,context);return node('#main').innerHTML;},
  action:(action,extra={})=>click('[data-action]',{action,...extra}),role:role=>click('[data-role]',{role}),choice:index=>click('[data-choice]',{choice:String(index)}),
 };
}

for(const mobile of [false,true]){
 const device=mobile?'mobile':'desktop';
 test(`${device}: finance, accounting, HR and administration can be selected, rolled and started with modern careers`,async()=>{
  const app=await appHarness({mobile});
  assert.match(app.html(),new RegExp(`<b>${roles.ROLES.length}</b><span>應徵職缺</span>`));
  await app.action('new');let html=app.html();
  for(const id of BACKOFFICE_ROLE_IDS_V28){assert.match(html,new RegExp(`data-role="${id}"`));assert.ok(html.includes(display(roles.ROLE_MAP[id].name)));}
  assert.match(html,/data-role="random"/);assert.doesNotMatch(html,/data-role="executive"/);
  assert.equal([...html.matchAll(/class="role-card /g)].length,roles.ROLES.length);
  for(const id of BACKOFFICE_ROLE_IDS_V28){
   await app.role(id);await app.action('roll');const candidate=app.candidate();html=app.html();
   assert.equal(candidate.roleId,id);assert.match(candidate.seed,/^e33-/);assert.ok(html.includes(display(roles.ROLE_MAP[id].name)));
   assert.match(html,/骰子點數/);assert.match(html,/面試談好的月薪/);assert.doesNotMatch(html,/改派機率|成功率|[0-9]+\s*[%％]/);
   assert.equal(engine.validRun(candidate),true);await app.action('start');
   assert.equal(app.state().roleId,id);assert.equal(app.state().seed,candidate.seed);assert.ok(app.state().runId);
   assert.equal(engine.validRun(app.state()),true);assert.equal(career.careerLevels(app.state()).length,8);
   assert.match(app.html(),/aria-label="八階職涯"/);assert.equal([...app.html().matchAll(/<small>LV\.\d<\/small>/g)].length,8);
   assert.ok(app.html().includes(display(engine.jobTitle(app.state()))));
   assert.doesNotMatch(app.html(),/這局保留原本的玩法|新的當場暴走與失控後續，從新人生開始/);
   await app.action('new');assert.equal(app.node('#dialog').open,true);await app.action('confirm-new');
  }
 });

 test(`${device}: each natural back-office scene hides outcomes before a choice and reveals only the committed absurd reply`,async()=>{
  assert.equal(scenes.length,32);assert.deepEqual(scenes.map(route=>route.eventId).sort(),BACKOFFICE_EVENTS_V28.map(event=>event.id).sort());
  const app=await appHarness({mobile});
  for(const route of scenes){
   const run=engine.replayRun(route.roleId,route.seed,route.actions.slice(0,-1));run.runId=webcrypto.randomUUID();
   const event=engine.getEvent(run),before=JSON.stringify(run),saves=app.calls.saves,proofs=app.calls.proofs.length;
   const html=app.render(run),buttons=html.slice(html.indexOf('<div class="choices '));
   assert.equal(event.id,route.eventId);assert.ok(event.roles.includes(run.actualRoleId));
   assert.equal(event.choices.length,3);assert.equal([...buttons.matchAll(/\bdata-choice="/g)].length,3);
   assert.ok(html.includes(display(event.title)));assert.ok(html.includes(display(event.body)));
   for(const choice of event.choices){
    assert.ok(buttons.includes(display(choice.text)),route.id);
    for(const result of [choice.result,choice.check?.success?.result,choice.check?.failure?.result,...(choice.draw?.outcomes.map(row=>row.result)||[])]){
     if(result)assert.ok(!html.includes(display(result)),`${route.id}: unrevealed result`);
    }
   }
   assert.doesNotMatch(html,/outcome-ledger|delta-chip|luck-result|這局保留原本的玩法/);
   assert.doesNotMatch(buttons.replace(/<[^>]*>/g,''),/成功率|[0-9]+\s*[%％]|[+-]\d+/);
   if(persona.PERSONAS[event.speaker])assert.match(html,new RegExp(`src="\\./assets/${event.speaker}\\.png"`));
   assert.ok(buttons.indexOf('data-action="rage"')>buttons.lastIndexOf('data-choice='));
   assert.equal(JSON.stringify(app.state()),before);assert.equal(app.calls.saves,saves);assert.equal(app.calls.proofs.length,proofs);
   const index=event.choices.findIndex(choice=>choice.wild);assert.ok(index>=0,`${route.id}: absurd authored reply`);
   await app.choice(index);const after=app.state(),last=after.history.at(-1),result=app.html();
   assert.equal(after.pending,true);assert.equal(last.eventId,event.id);assert.equal(last.choiceIndex,index);assert.equal(engine.validRun(after),true);
   assert.ok(result.includes(display(last.result)),route.id);assert.match(result,/aria-label="事件後數值變化"/);
   for(const[key,delta]of Object.entries(last.delta))if(delta&&engine.STAT_LABELS[key])assert.ok(result.includes(`>${delta>0?'+':''}${delta}</b>`),`${route.id}/${key}`);
   assert.equal(app.calls.saves,saves+1);assert.equal(app.calls.proofs.length,proofs+1);
   assert.deepEqual(app.calls.proofs.at(-1).actions,after.actions);
   const committed=JSON.stringify(after);await app.choice(index);assert.equal(JSON.stringify(app.state()),committed);assert.equal(app.calls.proofs.length,proofs+1);
   if(mobile)assert.equal(app.calls.scroll.at(-1),'.consequence');
  }
 });

 test(`${device}: saved back-office lives resume with the actual occupation's full ladder and locked endings stay secret`,async()=>{
  const occupations=routes.filter(route=>route.id.startsWith('role-'));
  assert.deepEqual(occupations.map(route=>route.actualRoleId).sort(),[...BACKOFFICE_ROLE_IDS_V28].sort());
  for(const route of occupations){
   const run=engine.replayRun(route.roleId,route.seed,route.actions);run.runId=webcrypto.randomUUID();
   const app=await appHarness({mobile,saved:{run,unlocked:[],achievements:{},records:{},legacy:[]}}),before=JSON.stringify(app.state());
   assert.match(app.html(),/繼續上班/);await app.action('continue');assert.equal(JSON.stringify(app.state()),before);
   assert.ok(app.html().includes(display(engine.jobTitle(run))));assert.match(app.html(),/aria-label="八階職涯"/);
   assert.deepEqual(career.careerLadder(run),BACKOFFICE_LADDERS_V28[run.actualRoleId]);
   await app.action('career-guide');for(const title of BACKOFFICE_LADDERS_V28[run.actualRoleId])assert.ok(app.dialog().includes(display(title)),title);
   await app.action('close-dialog');await app.action('collection');
   vm.runInContext(`collectionFilter={role:${JSON.stringify(run.actualRoleId)},status:'all',query:'',limit:1000};renderCollection()`,app.context);
   const grid=app.node('#ending-grid').innerHTML,newEndings=endings.ENDINGS.filter(ending=>ending.roleId===run.actualRoleId);assert.ok(newEndings.length>0);
   assert.equal([...grid.matchAll(/class="ending-card locked"/g)].length,newEndings.length);
   assert.doesNotMatch(grid,/<h3>|ending-card unlocked/);
   for(const ending of newEndings){assert.ok(!grid.includes(display(ending.title)));assert.ok(!grid.includes(display(ending.body)));assert.ok(!grid.includes(display(ending.hint)));}
  }
 });

 test(`${device}: seven shared back-office scenes require a present-person picker before committing in either phase`,async()=>{
  for(const[eventId,targets]of Object.entries(groups)){
   const fixture=scenes.find(route=>route.eventId===eventId);assert.ok(fixture,eventId);
   const before=engine.replayRun(fixture.roleId,fixture.seed,fixture.actions.slice(0,-1));
   const result=engine.getEvent(before).choices.map((choice,index)=>engine.applyChoice(before,index)).find(engine.canRequestRage);assert.ok(result,eventId);
   for(const context of [before,result])for(const target of targets){
    const app=await appHarness({mobile}),run=structuredClone(context);run.runId=webcrypto.randomUUID();
    app.render(run);const saved=JSON.stringify(app.state()),rng=run.rng,saves=app.calls.saves,proofs=app.calls.proofs.length;
    await app.action('rage');
    assert.equal(app.node('#dialog').open,true);assert.equal(JSON.stringify(app.state()),saved);assert.equal(app.state().rng,rng);
    assert.equal(app.calls.rage.length,0,'opening the picker cannot use the legacy default target');
    assert.equal(app.calls.saves,saves);assert.equal(app.calls.proofs.length,proofs);
    const picker=app.dialog();assert.match(picker,/data-rage-target-picker/);assert.equal([...picker.matchAll(/data-rage-target="/g)].length,targets.length);
    for(const present of targets){assert.ok(picker.includes(`data-rage-target="${present}"`));assert.ok(picker.includes(`src="./assets/${present}.png"`));}
    for(const absent of characterStats.CHARACTER_IDS.filter(id=>!targets.includes(id)))assert.ok(!picker.includes(`data-rage-target="${absent}"`));
    assert.doesNotMatch(picker,/夢境|真的|成功率|機率|\d+\s*[%％]/);
    const absent=characterStats.CHARACTER_IDS.find(id=>!targets.includes(id));await app.action('rage-target',{rageTarget:absent});
    assert.equal(JSON.stringify(app.state()),saved);assert.equal(app.calls.rage.length,0);assert.equal(app.calls.proofs.length,proofs);
    await app.action('rage-target',{rageTarget:target});
    const pending=app.state(),phase=run.pending?'result':'event';
    assert.equal(app.node('#dialog').open,false);assert.equal(app.calls.rage.length,1);assert.deepEqual(app.calls.rage[0],{target,phase});
    assert.equal(pending.pending,true);assert.equal(pending.rageContext.target,target);assert.equal(pending.history.at(-1).speaker,target);
    assert.deepEqual(pending.history.slice(0,-1),run.history);assert.equal(pending.actions.length,run.actions.length+1);
    assert.deepEqual(pending.actions.at(-1),{type:'rage',phase,eventId,target});
    assert.equal(app.calls.proofs.length,proofs+1);assert.equal(app.calls.saves,saves+1);assert.equal(engine.validRun(pending),true);
    const old=characterStats.deriveCharacterStats(run),actual=characterStats.deriveCharacterStats(pending);
    for(const prior of old){const after=actual.find(row=>row.id===prior.id);assert.equal(after.encounters-prior.encounters,Number(prior.id===target));}
    const committed=JSON.stringify(pending);await app.action('rage-target',{rageTarget:target});
    assert.equal(JSON.stringify(app.state()),committed);assert.equal(app.calls.rage.length,1);assert.equal(app.calls.proofs.length,proofs+1);
   }
  }
 });
}

test('random occupation draw includes all four new jobs and the hidden executive',async()=>{
 for(const id of [...BACKOFFICE_ROLE_IDS_V28,'executive']){
  const index=roles.ROLES.findIndex(role=>role.id===id),app=await appHarness({random:(index+.5)/roles.ROLES.length});
  await app.action('new');assert.doesNotMatch(app.html(),/data-role="executive"/);
  await app.role('random');await app.action('roll');assert.equal(app.candidate().roleId,id);
  assert.ok(app.html().includes(display(roles.ROLE_MAP[id].name)));assert.match(app.candidate().seed,/^e33-/);
 }
});
