import test from 'node:test';
import assert from 'node:assert/strict';
import {MEAL_GUEST_IDS_V25} from '../dist/meals-v25.js';
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
const {routes}=JSON.parse(await readFile(new URL('./fixtures/meal-invitations-v34.json',import.meta.url),'utf8'));
const plain=value=>JSON.parse(JSON.stringify(value));
const esc=value=>persona.displayText(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const tick=()=>new Promise(resolve=>setImmediate(resolve));

async function harness(mobile){
 const nodes=new Map(),listeners=new Map();
 const node=selector=>{
  if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',title:'',open:false,
   classList:{add(){},remove(){},toggle(){}},focus(){},setAttribute(){},addEventListener(){},scrollIntoView(){},
   showModal(){this.open=true;},close(){this.open=false;},
  });return nodes.get(selector);
 };
 const context=vm.createContext({...roles,...sources,...endings,...legacy,...engine,...achievements,...career,...currentCareer,...persona,...characterStats,polishDreamText,
  createFeedbackUI:()=>({open(){}}),createCharacterBook:()=>({open(){},onSnapshot(){},onRunChanged(){}}),
  cloud:{state:{status:'local',achievements:[],characters:[]},subscribe(){},init:async()=>null,achievementProgress:async()=>null,characterProgress:async()=>null,complete:async()=>null},
  localStorage:{getItem:()=>null,setItem(){}},
  document:{querySelector:node,addEventListener(type,callback){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(callback);}},
  window:{scrollTo(){},matchMedia:()=>({matches:mobile})},crypto:webcrypto,structuredClone,setTimeout:()=>1,clearTimeout(){},
 });
 vm.runInContext(appSource,context,{filename:'dist/app.js'});await tick();
 async function click(dataset,choice=false,detail=1){
  const target={closest:selector=>selector===(choice?'[data-choice]':'[data-action]')?{dataset}:null};
  for(const callback of listeners.get('click')||[])await callback({target,detail});await tick();
 }
 return{state:()=>vm.runInContext('run',context),html:()=>node('#main').innerHTML,
  render(run){context.fixtureRun=run;vm.runInContext('run=fixtureRun;game(true)',context);return node('#main').innerHTML;},
  action:action=>click({action}),
  choice:(index,revision=vm.runInContext('gameViewRevision',context),detail=1)=>click({choice:String(index),choiceView:String(revision)},true,detail),
  async doubleChoice(index){const revision=vm.runInContext('gameViewRevision',context);await click({choice:String(index),choiceView:String(revision)},true,1);await click({choice:String(index),choiceView:String(revision)},true,2);},
 };
}

function invitation(route){
 for(let index=route.actions.length-1;index>=0;index--){
  const action=route.actions[index];if(action.type!=='choice'||!/^meal-guests-[ab]$/.test(action.eventId))continue;
  const run=engine.replayRun(route.roleId,route.seed,route.actions.slice(0,index));
  const choice=engine.getEvent(run).choices[action.index];
  if(choice?.effect==='mealPick'&&choice.mealTarget===route.guest)return{run,index:action.index,choice};
 }
 throw new Error(`Missing invitation in ${route.id}`);
}
function secretOutcomesStayHidden(html,event){
 assert.doesNotMatch(html,/outcome-ledger|delta-chip|luck-result|aria-label="事件後數值變化"/);
 const start=html.indexOf('<div class="choices '),end=html.indexOf('<p class="story-source">');
 const choices=html.slice(start,end).replace(/<[^>]*>/g,'');
 assert.doesNotMatch(choices,/成功率|拒絕率|[+-]\d+|\d+(?:\.\d+)?\s*[%％]/);
 for(const choice of event.choices){
  if(choice.result?.length>10)assert.ok(!html.includes(esc(choice.result)),choice.text);
  for(const outcome of choice.draw?.outcomes||[])if(outcome.result?.length>10)assert.ok(!html.includes(esc(outcome.result)),choice.text);
 }
}

for(const mobile of [false,true]){
 const device=mobile?'mobile':'desktop';
 test(`${device}: all sixteen e34 invitation outcomes wait for the revealed result and never charge before a meal`,async()=>{
  for(const guest of MEAL_GUEST_IDS_V25)for(const outcome of ['accepted','declined']){
   const route=routes.find(row=>row.guest===guest&&row.outcome===outcome);assert.ok(route,`${guest}/${outcome}`);
   const app=await harness(mobile),{run,index,choice}=invitation(route),event=engine.getEvent(run);
   assert.equal(engine.validRun(run),true);assert.equal(choice.available!==false,true);
   const before=plain(run),html=app.render(run);secretOutcomesStayHidden(html,event);
   assert.ok(html.includes(`src="${persona.PERSONAS[guest].image}"`));
   assert.equal(JSON.stringify(app.state()),JSON.stringify(run),'rendering does not draw an answer');
   const expected=engine.applyChoice(run,index);await app.doubleChoice(index);const pending=app.state();
   assert.deepEqual(plain(pending),plain(expected));assert.equal(pending.pending,true,`${guest}/${outcome}`);
   assert.equal(pending.eventId,run.eventId);assert.equal(pending.actions.length,run.actions.length+1);
   assert.equal(pending.stats.cash,before.stats.cash);assert.equal(pending.turn,before.turn);assert.deepEqual(plain(pending.pip),before.pip);
   assert.notEqual(pending.rng,before.rng,'the invitation consumes canonical RNG only after choosing');
   assert.deepEqual(characterStats.deriveCharacterStats(pending),characterStats.deriveCharacterStats(run),'a message reply is not a completed dinner or physical encounter');
   assert.ok(app.html().includes(esc(pending.history.at(-1).result)));assert.match(app.html(),/outcome-ledger|data-action="next"/);
   const unchanged=JSON.stringify(pending);await app.choice(index);assert.equal(JSON.stringify(app.state()),unchanged,'a pending reply cannot be drawn twice');
   await app.action('next');const after=app.state();assert.deepEqual(plain(after),plain(engine.advance(expected)));
   assert.equal(engine.validRun(after),true);assert.equal(after.stats.cash,before.stats.cash);assert.equal(after.turn,before.turn);
   assert.deepEqual(plain(engine.replayRun(after.roleId,after.seed,after.actions)),plain(after));
   if(outcome==='accepted'){
    assert.equal(after.eventId,`meal-with-${guest}`);assert.equal(engine.getEvent(after).speaker,guest);
    assert.ok(app.html().includes(`src="${persona.PERSONAS[guest].image}"`));secretOutcomesStayHidden(app.html(),engine.getEvent(after));
    const paid=engine.getEvent(after).choices.findIndex(row=>row.effect==='mealFinish');assert.ok(paid>=0);
    const paidExpected=engine.applyChoice(after,paid);await app.doubleChoice(paid);
    assert.deepEqual(plain(app.state()),plain(paidExpected));assert.ok(app.state().stats.cash<after.stats.cash);
    assert.equal(app.state().actions.length,after.actions.length+1);assert.ok(app.html().includes(esc(app.state().history.at(-1).result)));
    await app.action('next');assert.equal(engine.validRun(app.state()),true);assert.equal(app.state().mealContext,null);
    assert.deepEqual(plain(engine.replayRun(after.roleId,after.seed,app.state().actions)),plain(app.state()));
   }else{
    assert.match(after.eventId,/^meal-guests-[ab]$/);assert.equal(after.mealContext.guest,null);
    const repeated=engine.getEvent(after).choices.findIndex(row=>row.mealTarget===guest);assert.ok(repeated>=0);
    assert.equal(engine.getEvent(after).choices[repeated].available,false);
    const disabled=app.html().match(new RegExp(`<button[^>]*data-meal-target="${guest}"[^>]*>`))?.[0];assert.ok(disabled);assert.match(disabled,/disabled/);
    assert.match(disabled,/title="本工作回合已邀請過，下一個工作回合再問。"/);assert.doesNotMatch(disabled,/title="存款不足/);
    const rejected=JSON.stringify(app.state());await app.choice(repeated);assert.equal(JSON.stringify(app.state()),rejected,'a rejected guest cannot be spammed for a new answer');
    secretOutcomesStayHidden(app.html(),engine.getEvent(after));
   }
  }
 });

 test(`${device}: the eleventh meal choice rescues a naturally reached low-savings crisis after rejection without rerolling or inventing a shared meal`,async()=>{
  const route=JSON.parse(await readFile(new URL('./fixtures/meal-crisis-v34.json',import.meta.url),'utf8'));
  const crisis=engine.replayRun(route.roleId,route.seed,route.actions),app=await harness(mobile),resume=crisis.resumeEventId;
  assert.equal(engine.validRun(crisis),true);assert.equal(crisis.eventId,'crisis-mood');
  assert.equal(crisis.stats.cash,13);assert.equal(crisis.stats.mood,1);assert.equal(crisis.stats.energy,14);
  app.render(crisis);
  const effectIndex=effect=>engine.getEvent(app.state()).choices.findIndex(choice=>choice.effect===effect);
  await app.choice(effectIndex('mealOpen'));assert.equal(app.state().eventId,'meal-guests-a');
  const invite=engine.getEvent(app.state()).choices.findIndex(choice=>choice.mealTarget==='erich');assert.ok(invite>=0);
  await app.doubleChoice(invite);assert.equal(app.state().pendingEffect,'mealDeclined');assert.equal(app.state().stats.cash,13);
  await app.action('next');assert.equal(app.state().eventId,'meal-guests-a');
  await app.choice(effectIndex('mealCancel'));assert.equal(app.state().eventId,'crisis-mood');
  await app.choice(effectIndex('mealOpen'));assert.equal(app.state().eventId,'meal-guests-a');
  assert.equal(engine.getEvent(app.state()).choices.find(choice=>choice.mealTarget==='erich').available,false);
  const menu=app.state(),event=engine.getEvent(menu),solo=event.choices.findIndex(choice=>choice.effect==='mealFinish'&&!choice.mealTarget);
  assert.equal(solo,10,'the appended fallback must remain a selectable canonical eleventh choice');
  assert.equal(event.choices[solo].available,true);assert.ok(app.html().includes('data-choice="10"'));secretOutcomesStayHidden(app.html(),event);
  const before=plain(menu),characters=characterStats.deriveCharacterStats(menu),expected=engine.applyChoice(menu,solo);
  await app.doubleChoice(solo);const pending=app.state();assert.deepEqual(plain(pending),plain(expected));
  assert.equal(engine.validRun(pending),true);assert.equal(pending.pending,true);assert.equal(pending.stats.cash,5);
  assert.equal(pending.stats.mood,23);assert.equal(pending.stats.energy,26);assert.equal(pending.rng,before.rng);
  assert.equal(pending.turn,before.turn);assert.deepEqual(plain(pending.pip),before.pip);
  assert.ok(app.html().includes(esc(pending.history.at(-1).result)));assert.match(app.html(),/outcome-ledger/);
  assert.deepEqual(characterStats.deriveCharacterStats(pending),characters);
  await app.action('next');const recovered=app.state();assert.equal(engine.validRun(recovered),true);
  assert.equal(recovered.completed,false);assert.equal(recovered.eventId,resume);assert.equal(recovered.mealContext,null);assert.equal(recovered.resumeEventId,null);
  assert.equal(recovered.rng,before.rng);assert.equal(recovered.flags.spend_solo,1);assert.equal(recovered.flags.meal_shared||0,before.flags.meal_shared||0);
  assert.deepEqual(plain(engine.replayRun(recovered.roleId,recovered.seed,recovered.actions)),plain(recovered));
 });
}

test('e33 invitations retain instant acceptance while e34 invitations require a real result acknowledgement',async()=>{
 const {routes:old}=JSON.parse(await readFile(new URL('./fixtures/legacy-e33-routes.json',import.meta.url),'utf8'));
 const legacy=old.find(route=>route.actions.some(action=>action.eventId==='meal-with-wing'));assert.ok(legacy);assert.match(legacy.seed,/^e33-/);
 const pick=legacy.actions.findIndex(action=>action.type==='choice'&&/^meal-guests-[ab]$/.test(action.eventId));assert.ok(pick>=0);
 const before=engine.replayRun(legacy.roleId,legacy.seed,legacy.actions.slice(0,pick));
 const app=await harness(false);app.render(before);await app.choice(legacy.actions[pick].index);
 assert.equal(app.state().pending,false);assert.equal(app.state().eventId,'meal-with-wing');assert.equal(app.state().stats.cash,before.stats.cash);
});
