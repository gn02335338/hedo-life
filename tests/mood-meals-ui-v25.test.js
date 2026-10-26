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
const plain=value=>JSON.parse(JSON.stringify(value));
const esc=value=>persona.displayText(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function harness(mobile){
 const nodes=new Map(),listeners=new Map(),calls={save:0,proof:0,scroll:[]};
 const node=selector=>{
  if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',title:'',open:false,
   classList:{add(){},remove(){},toggle(){}},focus(){},setAttribute(){},addEventListener(){},
   scrollIntoView(){calls.scroll.push(selector);},showModal(){this.open=true;},close(){this.open=false;},
  });return nodes.get(selector);
 };
 const context=vm.createContext({...roles,...sources,...endings,...legacy,...engine,...achievements,...career,...currentCareer,...persona,...characterStats,polishDreamText,
  createFeedbackUI:()=>({open(){}}),createCharacterBook:()=>({open(){},onSnapshot(){},onRunChanged(){}}),
  cloud:{state:{status:'local',achievements:[],characters:[]},subscribe(){},init:async()=>null,
   achievementProgress:async()=>null,characterProgress:async()=>{calls.proof++;return null;},complete:async()=>null},
  localStorage:{getItem:()=>null,setItem(){calls.save++;}},
  document:{querySelector:node,addEventListener(type,callback){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(callback);}},
  window:{scrollTo(){},matchMedia:()=>({matches:mobile})},crypto:webcrypto,structuredClone,setTimeout:()=>1,clearTimeout(){},
 });
 vm.runInContext(appSource,context,{filename:'dist/app.js'});await tick();calls.save=0;calls.proof=0;
 async function click(dataset,choice=false,detail=1){
  const target={closest:selector=>selector===(choice?'[data-choice]':'[data-action]')?{dataset}:null};
  for(const callback of listeners.get('click')||[])await callback({target,detail});await tick();
 }
 return{calls,node,state:()=>vm.runInContext('run',context),html:()=>node('#main').innerHTML,
  render(run){context.fixtureRun=run;vm.runInContext('run=fixtureRun;game(true)',context);return node('#main').innerHTML;},
  action:(action,extra={})=>click({action,...extra}),
  choice:(index,options={})=>click({choice:String(index),choiceView:String(options.revision??vm.runInContext('gameViewRevision',context))},true,options.detail||1),
  async doubleChoice(index){const revision=vm.runInContext('gameViewRevision',context);await click({choice:String(index),choiceView:String(revision)},true,1);await click({choice:String(index),choiceView:String(revision)},true,2);},
  revision:()=>vm.runInContext('gameViewRevision',context),
 };
}
// Display boundaries are isolated from canonical replay fixtures. They exercise
// the actual app click handler and engine transition, never invent new outcomes.
function collapseState(stage=1,cohort='e25'){
 const run=engine.createRun('system',`${cohort}-mood-meals-ui-${stage}`);run.runId=webcrypto.randomUUID();
 return {...run,eventId:'mood-collapse',turn:4,meltdownReturnEventId:'meeting-ten-minutes',
  stats:{...run.stats,mood:0,energy:50,cash:100},flags:{...run.flags,mood_crash_count:stage}};
}
function careState(cash=100){
 const run=engine.createRun('sales','e25-meal-choice-ui');run.runId=webcrypto.randomUUID();
 return {...run,eventId:'self-care',turn:4,breakReturnEventId:'meeting-ten-minutes',
  stats:{...run.stats,mood:40,energy:50,cash},lastBreakTurn:4};
}
function choicesHTML(html){return html.slice(html.indexOf('<div class="choices '),html.indexOf('<p class="story-source">'));}
function hiddenOutcomes(html,event){
 assert.doesNotMatch(html,/outcome-ledger|delta-chip|luck-result|aria-label="事件後數值變化"/);
 for(const choice of event.choices)if(choice.result.length>10)assert.ok(!html.includes(esc(choice.result)),choice.text);
 assert.doesNotMatch(choicesHTML(html).replace(/<[^>]*>/g,''),/成功率|[+-]\d+|\d+(?:\.\d+)?\s*[%％]/);
}

for(const mobile of [false,true]){
 const device=mobile?'mobile':'desktop';
 test(`${device}: four collapse stages show only the current severity and one final self-destruct button`,async()=>{
  const app=await harness(mobile),titles=new Set(),banners=new Set();
  for(let stage=1;stage<=4;stage++){
   const run=collapseState(stage),event=engine.getEvent(run),before=JSON.stringify(run),html=app.render(run),buttons=choicesHTML(html);
   titles.add(event.title);banners.add(html.match(/<div class="collapse-banner[\s\S]*?<\/ol>/)?.[0]);
   assert.match(html,new RegExp(`data-meltdown-stage="${stage}"`));assert.match(html,new RegExp(`第 ${stage} 次心情歸零`));
   assert.equal([...buttons.matchAll(/受不了了，自爆/g)].length,1);assert.equal([...buttons.matchAll(/data-choice="3"/g)].length,1);
   assert.ok(buttons.indexOf('self-destruct-trigger')>buttons.indexOf('data-choice="2"'));
   assert.doesNotMatch(buttons,/受不了了，扁他|data-action="rage"/);hiddenOutcomes(html,event);
   assert.ok(html.includes(esc(event.choices[0].text)),'the current rescue fee is disclosed');
   assert.equal(JSON.stringify(app.state()),before);assert.equal(app.calls.save,0);assert.equal(app.calls.proof,0);
  }
  assert.equal(titles.size,4);assert.equal(banners.size,4);
 });

 test(`${device}: self-destruct is a real choice, guards double clicks and never opens the NPC target picker`,async()=>{
  const app=await harness(mobile),run=collapseState(2),turn=run.turn,rng=run.rng,pip={active:true,remaining:2};run.pip=pip;
  app.render(run);await app.doubleChoice(3);
  const pending=app.state(),last=pending.history.at(-1),html=app.html();
  assert.equal(pending.actions.length,run.actions.length+1);assert.equal(last.eventId,'mood-collapse');assert.equal(last.choiceIndex,3);
  assert.equal(pending.pendingEffect,'moodSelfDestruct');assert.equal(pending.history.length,run.history.length+1);
  assert.ok(html.includes(esc(last.result)));assert.match(html,/outcome-ledger/);
  assert.doesNotMatch(html,/data-rage-target-picker|data-action="rage"|受不了了，扁他/);assert.equal(app.node('#dialog').open,false);
  assert.deepEqual(characterStats.deriveCharacterStats(pending).map(row=>[row.id,row.imaginedHits,row.realHits]),characterStats.deriveCharacterStats(run).map(row=>[row.id,row.imaginedHits,row.realHits]));
  assert.equal(pending.turn,turn);assert.deepEqual(plain(pending.pip),pip);assert.equal(pending.rng,rng);
  assert.equal(app.calls.save,1);assert.equal(app.calls.proof,1);
  await app.action('next');const aftermath=app.state(),afterHTML=app.html(),event=engine.getEvent(aftermath);
  assert.equal(aftermath.eventId,'mood-self-destruct');assert.equal(event.speaker,'self');assert.equal(event.meltdownStage,2);
  assert.equal(aftermath.turn,turn);assert.deepEqual(plain(aftermath.pip),pip);assert.equal(aftermath.rng,rng);
  assert.match(afterHTML,/self-destruct-chapter/);assert.match(afterHTML,/情緒自爆/);assert.doesNotMatch(afterHTML,/data-action="rage"|受不了了，扁他/);
  hiddenOutcomes(afterHTML,event);assert.equal([...choicesHTML(afterHTML).matchAll(/\bdata-choice=/g)].length,3);
 });

 test(`${device}: an unaffordable fourth collapse rescue stays visible with its fee and cannot be selected`,async()=>{
  const app=await harness(mobile),run=collapseState(4);run.stats.cash=20;
  const event=engine.getEvent(run),html=app.render(run),first=html.match(/<button[^>]*data-choice="0"[^>]*>/)?.[0];
  assert.equal(event.choices[0].available,false);assert.ok(html.includes(esc(event.choices[0].text)));assert.match(first,/disabled/);
  const before=JSON.stringify(app.state());await app.choice(0);assert.equal(JSON.stringify(app.state()),before);assert.equal(app.calls.save,0);
  assert.match(html,/受不了了，自爆/);assert.match(html,/data-choice="1"/);assert.match(html,/data-choice="2"/);
 });

 test(`${device}: a just-resolved zero mood result labels the disabled action as self-destruct while old runs retain their original control`,async()=>{
  const app=await harness(mobile),run=careState();run.eventId='meeting-ten-minutes';run.breakReturnEventId=null;
  const pending=engine.applyChoice(run,0);pending.stats.mood=0;pending.pendingFamily=null;
  const html=app.render(pending);assert.match(html,/self-destruct-trigger" disabled/);assert.match(html,/受不了了，自爆/);assert.doesNotMatch(html,/受不了了，扁他/);
  const old=collapseState(2,'e24'),oldEvent=engine.getEvent(old),oldHTML=app.render(old);
  assert.match(oldHTML,/受不了了，扁他/);assert.doesNotMatch(oldHTML,/data-meltdown-stage|受不了了，自爆/);assert.equal(oldEvent.choices.length,3);
 });

 test(`${device}: the meal invitation opens portraits and prices without charging, changing the day or revealing outcomes`,async()=>{
  const app=await harness(mobile),run=careState(),event=engine.getEvent(run),index=event.choices.findIndex(choice=>choice.effect==='mealOpen');
  assert.ok(index>=0);app.render(run);await app.doubleChoice(index);
  assert.equal(app.state().actions.length,run.actions.length+1);assert.equal(app.state().stats.cash,100);
  const menu=app.state(),menuEvent=engine.getEvent(menu),html=app.html(),cards=choicesHTML(html);
  assert.match(menu.eventId,/^meal-guests-[ab]$/);assert.equal(menuEvent.speaker,'self');assert.equal(menu.turn,run.turn);assert.equal(menu.stats.cash,100);
  assert.equal(menu.rng,run.rng);assert.match(cards,/meal-choices/);assert.equal([...cards.matchAll(/data-meal-target=/g)].length,8);
  for(const choice of menuEvent.choices.filter(choice=>choice.mealTarget)){
   const person=persona.PERSONAS[choice.mealTarget];assert.ok(cards.includes(`src="${person.image}"`));assert.ok(cards.includes(esc(choice.text)));assert.ok(cards.includes(esc(person.title)));
  }
  hiddenOutcomes(html,menuEvent);assert.match(html,/選人|名單/);
  assert.match(app.node('#main').innerHTML,/aria-label="/);
 });

 test(`${device}: choosing a meal guest only previews dinner; payment and affinity happen after a table reply`,async()=>{
  const app=await harness(mobile);let run=careState(),open=engine.getEvent(run).choices.findIndex(choice=>choice.effect==='mealOpen');
  run=engine.advance(engine.applyChoice(run,open));const menuEvent=engine.getEvent(run),index=menuEvent.choices.findIndex(choice=>choice.mealTarget&&choice.available!==false),guest=menuEvent.choices[index].mealTarget;
  app.render(run);await app.doubleChoice(index);assert.equal(app.state().stats.cash,run.stats.cash);
  const dinner=app.state(),event=engine.getEvent(dinner),html=app.html();
  assert.equal(dinner.eventId,`meal-with-${guest}`);assert.equal(event.speaker,guest);assert.ok(html.includes(`src="${persona.PERSONAS[guest].image}"`));hiddenOutcomes(html,event);
  const paidIndex=event.choices.findIndex(choice=>choice.effect==='mealFinish');assert.ok(paidIndex>=0);
  const expected=engine.applyChoice(dinner,paidIndex),beforeActions=dinner.actions.length;
  await app.doubleChoice(paidIndex);const paid=app.state();
  assert.deepEqual(plain(paid),plain(expected));assert.equal(paid.actions.length,beforeActions+1);assert.ok(paid.stats.cash<dinner.stats.cash);
  assert.ok(app.html().includes(esc(paid.history.at(-1).result)));assert.match(app.html(),/outcome-ledger/);
  assert.ok(characterStats.deriveCharacterStats(paid).find(row=>row.id===guest).encounters>0);
  await app.action('next');assert.equal(app.state().eventId,'meeting-ten-minutes');assert.equal(app.state().turn,run.turn);
 });

 test(`${device}: declining at the dinner table returns to the same crisis menu without a charge or affinity reward`,async()=>{
  const app=await harness(mobile),run=careState();run.eventId='crisis-mood';run.breakReturnEventId=null;run.resumeEventId='meeting-ten-minutes';
  const start=engine.getEvent(run),open=start.choices.findIndex(choice=>choice.effect==='mealOpen');assert.ok(open>=0);
  let menu=engine.advance(engine.applyChoice(run,open)),event=engine.getEvent(menu),pick=event.choices.findIndex(choice=>choice.mealTarget==='erich');
  let dinner=engine.advance(engine.applyChoice(menu,pick));app.render(dinner);event=engine.getEvent(dinner);
  const cancel=event.choices.findIndex(choice=>choice.effect==='mealCancel'),before=characterStats.deriveCharacterStats(dinner);
  await app.choice(cancel);const returned=app.state();
  assert.equal(returned.stats.cash,run.stats.cash);assert.equal(returned.eventId,'crisis-mood');assert.equal(returned.resumeEventId,'meeting-ten-minutes');assert.equal(returned.turn,run.turn);assert.equal(returned.mealContext,null);
  const after=characterStats.deriveCharacterStats(returned);
  assert.deepEqual(plain(after.map(({encounters,...rest})=>rest)),plain(before.map(({encounters,...rest})=>rest)),'cancelled dinner grants no affinity or hit counters');
  assert.equal(after.find(row=>row.id==='erich').encounters,before.find(row=>row.id==='erich').encounters+1,'the spoken cancellation is still one encounter');
 });

 test(`${device}: meal navigation opens immediately and rejects stale-page and double-click activations`,async()=>{
  const app=await harness(mobile),run=careState(),open=engine.getEvent(run).choices.findIndex(choice=>choice.effect==='mealOpen');
  app.render(run);const originRevision=app.revision();await app.choice(open);
  assert.equal(app.state().pending,false);assert.equal(app.state().eventId,'meal-guests-a');assert.doesNotMatch(app.html(),/AND THEN|data-action="next"/);
  const menuBefore=JSON.stringify(app.state());await app.choice(open,{revision:originRevision});assert.equal(JSON.stringify(app.state()),menuBefore,'an old source button cannot choose a new guest');
  const page=engine.getEvent(app.state()).choices.findIndex(choice=>choice.effect==='mealPage'),pageRevision=app.revision();await app.doubleChoice(page);
  assert.equal(app.state().eventId,'meal-guests-b');assert.equal(app.state().pending,false);assert.equal(app.state().actions.length,run.actions.length+2);
  const secondBefore=JSON.stringify(app.state());await app.choice(0,{revision:pageRevision});assert.equal(JSON.stringify(app.state()),secondBefore,'an old guest card cannot select a different second-page person');
  await app.doubleChoice(0);assert.equal(app.state().eventId,'meal-with-jack');assert.equal(app.state().pending,false);assert.equal(app.state().stats.cash,100);
  const cancel=engine.getEvent(app.state()).choices.findIndex(choice=>choice.effect==='mealCancel');await app.doubleChoice(cancel);
  assert.equal(app.state().eventId,'self-care');assert.equal(app.state().pending,false);assert.equal(app.state().stats.cash,100);assert.equal(app.state().actions.length,run.actions.length+4);
 });

 test(`${device}: guest pages and cancellation stay free, and unaffordable portraits remain visible but disabled`,async()=>{
  const app=await harness(mobile),care=careState(1),open=engine.getEvent(care).choices.findIndex(choice=>choice.effect==='mealOpen');
  let menu=engine.advance(engine.applyChoice(care,open));app.render(menu);let html=app.html(),event=engine.getEvent(menu);
  assert.equal(event.choices.filter(choice=>choice.mealTarget).length,8);assert.equal([...choicesHTML(html).matchAll(/data-meal-target=/g)].length,8);
  for(const choice of event.choices.filter(choice=>choice.mealTarget)){
   const card=html.match(new RegExp(`<button[^>]*data-meal-target="${choice.mealTarget}"[^>]*>`))?.[0];assert.ok(card);assert.match(card,/disabled/);
  }
  const locked=event.choices.findIndex(choice=>choice.mealTarget),before=JSON.stringify(app.state());await app.choice(locked);assert.equal(JSON.stringify(app.state()),before);
  const page=event.choices.findIndex(choice=>choice.effect==='mealPage');assert.ok(page>=0);await app.choice(page);menu=app.state();event=engine.getEvent(menu);html=app.html();
  assert.equal(menu.eventId,'meal-guests-b');assert.equal(menu.stats.cash,1);assert.equal(menu.turn,care.turn);assert.equal(menu.rng,care.rng);
  assert.equal([...choicesHTML(html).matchAll(/data-meal-target=/g)].length,8);hiddenOutcomes(html,event);
  const cancel=event.choices.findIndex(choice=>choice.effect==='mealCancel');assert.ok(cancel>=0);await app.choice(cancel);
  assert.equal(app.state().stats.cash,1);assert.equal(app.state().eventId,'self-care');assert.equal(app.state().turn,care.turn);
  assert.equal(app.state().breakReturnEventId,'meeting-ten-minutes');assert.equal(app.state().mealContext,null);
  const back=engine.getEvent(app.state()).choices.findIndex(choice=>choice.effect==='cancelBreak');await app.choice(back);await app.action('next');
  assert.equal(app.state().eventId,'meeting-ten-minutes');assert.equal(app.state().stats.cash,1);
 });
}

test('meal grid and meltdown UI keep shrinkable columns and single-column mobile guest cards',async()=>{
 const css=await readFile(new URL('../dist/style.css',import.meta.url),'utf8');
 assert.match(css,/\.meal-choices\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/\.meal-guest-choice \.choice-text\{min-width:0;overflow-wrap:anywhere/);
 assert.match(css,/@media\(max-width:560px\)\{[^}]*[\s\S]*?\.meal-choices\{grid-template-columns:1fr/);
 assert.match(css,/\.meltdown-stage-track\{display:flex;flex-wrap:wrap/);
});

const {routes:naturalRoutes}=JSON.parse(await readFile(new URL('./fixtures/mood-meals-routes-v25.json',import.meta.url),'utf8'));
function naturalRun(id){const route=naturalRoutes.find(row=>row.id===id);assert.ok(route,id);return engine.replayRun(route.roleId,route.seed,route.actions);}
const professorRoutes=JSON.parse(await readFile(new URL('./fixtures/professor-v37.json',import.meta.url),'utf8'));
for(const mobile of [false,true]){
 const device=mobile?'mobile':'desktop';
 test(`${device}: naturally replayed collapses use the visible self-destruct choice and preserve canonical transitions`,async()=>{
  for(let stage=1;stage<=4;stage++){
   const app=await harness(mobile),run=naturalRun(`collapse-${stage}`),html=app.render(run);
   assert.equal(engine.validRun(run),true);assert.match(html,new RegExp(`data-meltdown-stage="${stage}"`));
   const expected=engine.advance(engine.applyChoice(run,3));await app.choice(3);await app.action('next');
   assert.deepEqual(plain(app.state()),plain(expected));assert.deepEqual(plain(app.state()),plain(naturalRun(`self-destruct-${stage}`)));
   assert.equal(engine.validRun(app.state()),true);assert.equal(app.state().eventId,'mood-self-destruct');assert.doesNotMatch(app.html(),/data-action="rage"/);
   assert.deepEqual(plain(engine.replayRun(run.roleId,run.seed,app.state().actions)),plain(app.state()));
  }
 });
 test(`${device}: all sixteen naturally replayed dinner scenes show their own portrait and reveal only the chosen reply`,async()=>{
  for(const guest of MEAL_GUEST_IDS_V25){
   const app=await harness(mobile),run=naturalRun(`meal-with-${guest}`),event=engine.getEvent(run),html=app.render(run);
   assert.equal(engine.validRun(run),true);assert.equal(event.speaker,guest);assert.ok(html.includes(`src="${persona.PERSONAS[guest].image}"`));hiddenOutcomes(html,event);
   const expected=engine.applyChoice(run,1);await app.doubleChoice(1);
   assert.deepEqual(plain(app.state()),plain(expected));assert.ok(app.html().includes(esc(app.state().history.at(-1).result)));
   await app.action('next');const returned=app.state();assert.equal(engine.validRun(returned),true);assert.equal(returned.mealContext,null);
   assert.deepEqual(plain(engine.replayRun(run.roleId,run.seed,returned.actions)),plain(returned));
  }
 });
}

for(const mobile of [false,true]){
 const device=mobile?'mobile':'desktop';
 test(`${device}: all thirty natural professor scenes show the professor and hide outcomes until an actual reply`,async()=>{
  for(const route of professorRoutes.scenes){
   const app=await harness(mobile),run=engine.replayRun(route.roleId,route.seed,route.beforeActions),event=engine.getEvent(run),html=app.render(run);
   assert.equal(event.speaker,'professor');assert.equal(engine.validRun(run),true);assert.ok(html.includes('林老師'));
   assert.ok(html.includes(`src="${persona.PERSONAS.professor.image}"`));hiddenOutcomes(html,event);
   const expected=engine.applyChoice(run,0);await app.doubleChoice(0);
   assert.deepEqual(plain(app.state()),plain(expected));assert.ok(app.html().includes(esc(expected.history.at(-1).result)));
   assert.match(app.html(),/outcome-ledger|這次實際變化/);await app.action('next');
   assert.deepEqual(plain(app.state()),plain(engine.replayRun(route.roleId,route.seed,route.actions)),route.id);
  }
 });
 test(`${device}: all six natural professor dinner reactions reveal after payment and double clicks cannot charge twice`,async()=>{
  for(const route of professorRoutes.meals){
   const app=await harness(mobile),run=engine.replayRun(route.roleId,route.seed,route.beforeActions),event=engine.getEvent(run),html=app.render(run);
   assert.equal(event.id,'meal-with-professor');assert.ok(html.includes('林老師'));assert.ok(html.includes(`src="${persona.PERSONAS.professor.image}"`));hiddenOutcomes(html,event);
   for(const choice of event.choices)for(const outcome of choice.draw?.outcomes||[])assert.ok(!html.includes(esc(outcome.result)),'no table reaction is visible before a choice');
   const expected=engine.applyChoice(run,route.replyIndex);await app.doubleChoice(route.replyIndex);
   assert.deepEqual(plain(app.state()),plain(expected));assert.equal(app.state().stats.cash,run.stats.cash-18);
   assert.ok(app.html().includes(esc(expected.history.at(-1).result)));assert.ok(app.html().includes(esc(expected.history.at(-1).eventOutcome.result)));
   assert.match(app.html(),/這次角色互動/);assert.equal(app.state().history.at(-1).mealOutcome.reaction,route.reaction);
   await app.action('next');assert.equal(app.state().mealContext,null);assert.equal(app.state().stats.cash,expected.stats.cash);
   assert.deepEqual(plain(app.state()),plain(engine.replayRun(route.roleId,route.seed,route.actions)),route.id);
  }
 });
}
