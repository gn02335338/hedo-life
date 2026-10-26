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
import {MEAL_FLAVOR_V36} from '../dist/meal-flavor-v36.js';

const appSource=(await readFile(new URL('../dist/app.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
const {routes}=JSON.parse(await readFile(new URL('./fixtures/meal-reactions-v36.json',import.meta.url),'utf8'));
const plain=value=>JSON.parse(JSON.stringify(value));
const esc=value=>persona.displayText(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const tick=()=>new Promise(resolve=>setImmediate(resolve));

async function harness(mobile,existingStorage=new Map()){
 const storage=existingStorage,calls={save:0};
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
  localStorage:{getItem:key=>storage.get(key)||null,setItem(key,value){storage.set(key,String(value));calls.save++;}},
  document:{querySelector:node,addEventListener(type,callback){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(callback);}},
  window:{scrollTo(){},matchMedia:()=>({matches:mobile})},crypto:webcrypto,structuredClone,setTimeout:()=>1,clearTimeout(){},
 });
 vm.runInContext(appSource,context,{filename:'dist/app.js'});await tick();
 async function click(dataset,choice=false,detail=1){
  const target={closest:selector=>selector===(choice?'[data-choice]':'[data-action]')?{dataset}:null};
  for(const callback of listeners.get('click')||[])await callback({target,detail});await tick();
 }
 return{storage,calls,node,state:()=>vm.runInContext('run',context),html:()=>node('#main').innerHTML,
  render(run){context.fixtureRun=run;vm.runInContext('run=fixtureRun;game(true)',context);return node('#main').innerHTML;},
  action:action=>click({action}),
  choice:(index,revision=vm.runInContext('gameViewRevision',context),detail=1)=>click({choice:String(index),choiceView:String(revision)},true,detail),
  async doubleChoice(index){const revision=vm.runInContext('gameViewRevision',context);await click({choice:String(index),choiceView:String(revision)},true,1);await click({choice:String(index),choiceView:String(revision)},true,2);},
 };
}


const reactionLabel={warm:'聊得很開',neutral:'平常吃飯',mine:'不小心踩雷'};
const signed=value=>`${value>0?'+':''}${value}`;
function hidden(html,event){
 assert.doesNotMatch(html,/outcome-ledger|delta-chip|luck-result|aria-label="事件後數值變化"/);
 assert.doesNotMatch(html,/餐桌氣氛|聊得很開|平常吃飯|不小心踩雷|affinityDelta|mealOutcome|warmChance|mineChance|neutralChance/);
 const choices=html.slice(html.indexOf('<div class="choices '),html.indexOf('<p class="story-source">')).replace(/<[^>]*>/g,'');
 assert.doesNotMatch(choices,/成功率|機率|權重|[+-]\d+|\d+(?:\.\d+)?\s*[%％]/);
 for(const choice of event.choices)for(const outcome of choice.draw?.outcomes||[]){
  assert.ok(!html.includes(esc(outcome.result)),`future consequence leaked: ${choice.text}`);
 }
}
function shown(html,run,route,beforeScore){
 const last=run.history.at(-1),flavor=MEAL_FLAVOR_V36[route.guest][route.replyIndex===0?'normal':'wild'];
 assert.ok(html.includes(esc(last.result)),`${route.id}: actual result text`);
 assert.ok(html.includes(esc(flavor[route.reaction])),`${route.id}: authored target/topic reaction`);
 assert.ok(html.includes(`餐桌氣氛：${reactionLabel[route.reaction]}`));
 const actual=characterStats.characterAffinity(run,route.guest).score-beforeScore;
 assert.ok(html.includes(`<b>${actual?`好感 ${signed(actual)}`:'好感沒有改變'}</b>`),`${route.id}: actual clamped character delta`);
 assert.match(html,/aria-label="這次角色互動"/);
 for(const other of ['warm','neutral','mine'].filter(reaction=>reaction!==route.reaction)){
  assert.ok(!html.includes(esc(flavor[other])),`${route.id}: another reaction leaked after selection`);
 }
}

for(const mobile of [false,true]){
 const device=mobile?'mobile':'desktop';
 test(`${device}: all 96 natural dinner replies hide table RNG until commitment, then survive reload and journal with one payment`,async()=>{
  let app=await harness(mobile);
  for(const route of routes){
   const before=engine.replayRun(route.roleId,route.seed,route.actions.slice(0,-1)),event=engine.getEvent(before),beforeScore=characterStats.characterAffinity(before,route.guest).score;
   assert.equal(engine.validRun(before),true);assert.equal(before.eventId,`meal-with-${route.guest}`);
   const source=plain(before),html=app.render(before);hidden(html,event);
   assert.ok(html.includes(`src="${persona.displayPersona(route.guest).image}"`));assert.deepEqual(plain(app.state()),source,'display does not roll table reactions');
   const expected=engine.applyChoice(before,route.replyIndex),savedBefore=app.calls.save;
   await app.doubleChoice(route.replyIndex);let paid=app.state();
   assert.deepEqual(plain(paid),plain(expected));assert.equal(paid.pending,true);assert.equal(paid.actions.length,before.actions.length+1);
   assert.equal(app.calls.save,savedBefore+1,'double activation saves and charges once');
   assert.equal(paid.stats.cash,before.stats.cash-event.choices[route.replyIndex].mealCost);assert.equal(paid.turn,before.turn);
   assert.equal(paid.history.at(-1).mealOutcome.reaction,route.reaction);assert.equal(paid.history.filter(row=>row.mealOutcome).length,1);
   shown(app.html(),paid,route,beforeScore);
   const committed=plain(paid),rng=paid.rng,ledger=app.html();await app.choice(route.replyIndex);
   assert.deepEqual(plain(app.state()),committed,'a still-visible pending choice cannot charge or roll again');assert.equal(app.html(),ledger);
   // Reload through the real app bootstrap and its stored-run validator.
   app=await harness(mobile,app.storage);assert.deepEqual(plain(app.state()),committed);
   await app.action('continue');paid=app.state();assert.deepEqual(plain(paid),committed);assert.equal(paid.rng,rng);
   shown(app.html(),paid,route,beforeScore);
   await app.action('journal');const journal=app.node('#dialog-content').innerHTML;
   shown(journal,paid,route,beforeScore);assert.match(journal,/這次上班，發生過什麼事/);
   await app.action('close-dialog');await app.action('next');
   assert.deepEqual(plain(app.state()),plain(engine.advance(expected)));assert.equal(engine.validRun(app.state()),true);
   assert.equal(app.state().rng,rng);assert.equal(app.state().stats.cash,committed.stats.cash);assert.equal(app.state().mealContext,null);
  }
 });

 test(`${device}: natural before/after dinner rage and verbal buttons preserve committed reactions without charging twice`,async()=>{
  const app=await harness(mobile);
  for(const guest of ['wing','rick','jack','erich']){
   const route=routes.find(row=>row.guest===guest&&row.reaction==='mine'),table=engine.replayRun(route.roleId,route.seed,route.actions.slice(0,-1));
   for(const phase of ['event','result'])for(const action of ['rage','verbal']){
    const source=phase==='event'?table:engine.applyChoice(table,route.replyIndex),reactions=source.history.filter(row=>row.mealOutcome).map(row=>plain(row.mealOutcome)),cash=source.stats.cash;
    const expected=action==='rage'?engine.requestRage(source):engine.requestVerbal(source,undefined,2);
    assert.notEqual(expected,source,`${guest}/${phase}/${action}: button is allowed`);app.render(source);
    await app.action(action);assert.deepEqual(plain(app.state()),plain(expected));assert.equal(engine.validRun(app.state()),true);
    assert.equal(app.state().stats.cash,cash);assert.deepEqual(app.state().history.filter(row=>row.mealOutcome).map(row=>plain(row.mealOutcome)),reactions);
    assert.match(app.html(),/outcome-ledger/);assert.equal(app.node('#dialog').open,false,'one person at dinner does not require a group picker');
    await app.action('next');const next=engine.advance(expected);assert.deepEqual(plain(app.state()),plain(next));assert.equal(engine.validRun(next),true);
    assert.equal(next.stats.cash,cash);assert.deepEqual(next.history.filter(row=>row.mealOutcome).map(row=>plain(row.mealOutcome)),reactions);
    assert.deepEqual(plain(engine.replayRun(next.roleId,next.seed,next.actions)),plain(next));
   }
  }
 });
}
