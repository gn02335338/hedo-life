import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';
import * as roles from '../dist/roles.js';
import * as sources from '../dist/public-sources.js';
import * as endings from '../dist/endings.js';
import * as legacy from '../dist/legacy.js';
import * as engine from '../dist/engine.js';
import * as achievements from '../dist/achievements.js';
import * as career from '../dist/career-api.js';
import * as levels from '../dist/career-v17.js';
import * as personas from '../dist/persona.js';
import * as characters from '../dist/character-stats.js';
import * as recruitment from '../dist/recruitment-v60.js';
import * as profiles from '../dist/seed-profile-v60.js';
import * as verbalPresentation from '../dist/verbal-context-v52.js';
import {createRandomRecruiterV60} from '../dist/random-recruitment-v60.js';
import {polishDreamText} from '../dist/copy-v15.js';
const source=(await readFile(new URL('../dist/app.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
const plain=value=>JSON.parse(JSON.stringify(value));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function harness(mobile,ticket=.5){
 const nodes=new Map(),listeners=[];
 const node=key=>{
  if(!nodes.has(key))nodes.set(key,{innerHTML:'',textContent:'',open:false,focus(){},scrollIntoView(){},setAttribute(){},addEventListener(){},classList:{add(){},remove(){},toggle(){}},showModal(){this.open=true;},close(){this.open=false;}});
  return nodes.get(key);
 };
 const context=vm.createContext({...roles,...sources,...endings,...legacy,...engine,...achievements,...career,...levels,...personas,...characters,...recruitment,...profiles,...verbalPresentation,polishDreamText,
  createRandomRecruiterV60:()=>createRandomRecruiterV60(()=>ticket),
  createFeedbackUI:()=>({open(){}}),createCharacterBook:()=>({open(){},onSnapshot(){},onRunChanged(){}}),
  cloud:{state:{status:'local',achievements:[],characters:[]},subscribe(){},init:async()=>null,achievementProgress:async()=>null,characterProgress:async()=>null,complete:async()=>null},
  localStorage:{getItem:()=>null,setItem(){}},
  document:{querySelector:node,addEventListener(type,callback){if(type==='click')listeners.push(callback);}},window:{scrollTo(){},matchMedia:()=>({matches:mobile})},
  crypto:webcrypto,structuredClone,setTimeout:()=>1,clearTimeout(){},
 });
 vm.runInContext(source,context);await tick();
 const click=async dataset=>{
  const target={closest:selector=>({action:'[data-action]',role:'[data-role]',choice:'[data-choice]'})[Object.keys(dataset)[0]]===selector?{dataset}:null};
  for(const listener of listeners)await listener({target,detail:1});await tick();
 };
 return {html:()=>node('#main').innerHTML,state:()=>vm.runInContext('run',context),candidate:()=>vm.runInContext('candidate',context),
  action:action=>click({action}),role:role=>click({role}),
  choose:index=>click({choice:String(index),choiceView:String(vm.runInContext('gameViewRevision',context))}),
  render(run){context.saved=plain(run);vm.runInContext('run=saved;game(false)',context);},
 };
}
for(const mobile of [false,true]){
 const device=mobile?'mobile':'desktop';
 test(`${device}: random stays first and selected while rerolls use one continuing ordinary bag`,async()=>{
  const app=await harness(mobile);await app.action('new');
  assert.match(app.html(),/class="role-card selected" data-role="random" aria-pressed="true"/);
  assert.ok(app.html().indexOf('data-role="random"')<app.html().indexOf('data-role="system"'));
  assert.doesNotMatch(app.html(),/data-role="(?:executive|godson|goddaughter)"|\d+%/);
  const seen=[];
  for(let round=0;round<3;round++){
   await app.action('roll');seen.push(app.candidate().roleId);
   for(let reroll=0;reroll<3;reroll++){await app.action('reroll');seen.push(app.candidate().roleId);}
   const last=plain(app.candidate());await app.action('reroll');assert.deepEqual(plain(app.candidate()),last,'the fourth reroll cannot bypass the limit');
   await app.action('back-roles');
  }
  assert.equal(new Set(seen).size,12,'all ordinary professions appear across three four-roll applications');
  await app.role('ai');await app.action('roll');assert.equal(app.candidate().roleId,'ai');assert.equal(recruitment.directEntryV60(app.candidate()),null);
  await app.action('back-roles');assert.match(app.html(),/data-role="ai" aria-pressed="true"/);
 });
 for(const [ticket,title,badge]of [[.05,'乾兒子','kin-direct-son'],[.08,'乾女兒','kin-direct-daughter']])test(`${device}: a surprise ${title} starts the two introductions and reveals results only after a choice`,async()=>{
  const app=await harness(mobile,ticket);await app.action('new');await app.action('roll');
  assert.match(app.html(),/特別任用職缺/);assert.doesNotMatch(app.html(),/乾兒子|乾女兒|recruitment60_|kin-direct-/);
  assert.equal(app.candidate().patronage,null);await app.action('start');
  assert.match(app.html(),new RegExp(title));assert.doesNotMatch(app.html(),/class="result-text"|recruitmentOutcome|同業競爭/);
  assert.match(app.html(),/報到直接替我改輩分/);assert.doesNotMatch(app.html(),/名片是(?:會計專員|商務開發|系統工程師)/);
  await app.choose(0);assert.equal(app.state().patronage.title,title);assert.match(app.html(),/瑞克/);assert.match(app.html(),/好感 -18/);
  assert.ok(achievements.deriveAchievements(app.state()).includes(badge));
  const saved=plain(app.state());app.render(saved);assert.deepEqual(plain(app.state()),saved);assert.equal(engine.validRun(app.state()),true);
  await app.action('next');assert.equal(app.state().eventId,'recruitment60-rick');
  const turn=app.state().turn,pay=app.state().pay;
  for(const eventId of ['recruitment60-rick','recruitment60-princess']){
   assert.equal(app.state().eventId,eventId);assert.match(app.html(),/特殊任用/);assert.match(app.html(),/data-action="exit" disabled/);assert.doesNotMatch(app.html(),/class="result-text"/);
   await app.choose(0);assert.match(app.html(),/class="result-text"/);await app.action('next');
  }
  assert.equal(app.state().recruitmentContext,null);assert.equal(app.state().turn,turn);assert.equal(app.state().pay,pay);assert.equal(engine.jobTitle(app.state()),title);assert.equal(engine.validRun(app.state()),true);
 });
}
