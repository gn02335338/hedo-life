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
import * as treatUI from '../dist/office-treats-ui-v61.js';
import * as art from '../dist/illustrations-v38.js';
import {polishDreamText} from '../dist/copy-v15.js';
const source=(await readFile(new URL('../dist/app.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
const fixture=JSON.parse(await readFile(new URL('./fixtures/office-treats-routes-v61.json',import.meta.url),'utf8'));
const plain=value=>JSON.parse(JSON.stringify(value));
const escape=value=>personas.displayText(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function harness(mobile){
 const nodes=new Map(),listeners=[];
 const node=key=>{
  if(!nodes.has(key))nodes.set(key,{innerHTML:'',textContent:'',open:false,focus(){},scrollIntoView(){},setAttribute(){},addEventListener(){},classList:{add(){},remove(){},toggle(){}},showModal(){this.open=true;},close(){this.open=false;}});
  return nodes.get(key);
 };
 const context=vm.createContext({...roles,...sources,...endings,...legacy,...engine,...achievements,...career,...levels,...personas,...characters,...treatUI,...art,polishDreamText,
  createFeedbackUI:()=>({open(){}}),createCharacterBook:()=>({open(){},onSnapshot(){},onRunChanged(){}}),
  cloud:{state:{status:'local',achievements:[],characters:[]},subscribe(){},init:async()=>null,achievementProgress:async()=>null,characterProgress:async()=>null,complete:async()=>null},
  localStorage:{getItem:()=>null,setItem(){}},
  document:{querySelector:node,addEventListener(type,callback){if(type==='click')listeners.push(callback);}},window:{scrollTo(){},matchMedia:()=>({matches:mobile})},
  crypto:webcrypto,structuredClone,setTimeout:()=>1,clearTimeout(){},
 });
 vm.runInContext(source,context);await tick();
 const click=async dataset=>{
  const selector=dataset.action?'[data-action]':'[data-choice]',target={closest:key=>key===selector?{dataset}:null};
  for(const listener of listeners)await listener({target,detail:1});await tick();
 };
 return {html:()=>node('#main').innerHTML,state:()=>vm.runInContext('run',context),
  action:action=>click({action}),choose:index=>click({choice:String(index),choiceView:String(vm.runInContext('gameViewRevision',context))}),
  render(run){context.saved=plain(run);vm.runInContext('run=saved;game(false)',context);},
 };
}
const storyNames={'jack-drinks':'傑克請飲料','company-tea':'公司下午茶','birthday-cake':'同月生日蛋糕'};
for(const mobile of [false,true]){
 const device=mobile?'mobile':'desktop';
 test(`${device}: each food story has a clear start, committed finish, unchanged saved state and exact return to work`,async()=>{
  for(const [storyId,name]of Object.entries(storyNames)){
   const route=fixture.routes.find(row=>row.id===`${storyId}-0-0`);assert.ok(route);
   let run=engine.replayRun(route.roleId,route.seed,route.beforeActions);const app=await harness(mobile),turn=run.turn,pay=run.pay,cash=run.stats.cash,returnId=run.treatsContext.returnEventId,priorTreatCount=run.history.filter(row=>row.kind==='office-treat').length;
   for(let stage=0;stage<3;stage++){
    const snapshot=plain(run),event=engine.getEvent(run);app.render(run);assert.deepEqual(plain(app.state()),snapshot);
    assert.match(app.html(),new RegExp(`${name}狀態`));assert.ok(app.html().includes(stage===0?'插曲開始':'同一場插曲'));
    assert.doesNotMatch(app.html(),/class="result-text"|插曲結束/);assert.doesNotMatch(app.html().replace(/<[^>]+>/g,''),/\d+%/);
    assert.match(app.html(),/data-action="exit" disabled/);assert.match(app.html(),/data-action="raise" disabled/);
    assert.match(app.html(),/data-scene-theme="(?:admin_coffee|banquet)"/);
    for(const option of event.choices)assert.ok(!app.html().includes(escape(option.result)),'unselected reactions do not leak through cards or artwork');
    const expected=engine.applyChoice(run,0);await app.choose(0);assert.deepEqual(plain(app.state()),plain(expected));
    assert.match(app.html(),/class="result-text"/);assert.ok(app.html().includes(escape(expected.history.at(-1).result)));
    assert.ok(app.html().includes('插曲結束')===(stage===2));
    app.render(expected);assert.deepEqual(plain(app.state()),plain(expected));
    await app.action('next');run=app.state();assert.equal(run.turn,turn);assert.equal(run.pay,pay);assert.equal(run.stats.cash,cash);assert.equal(engine.validRun(run),true);
    if(stage<2){assert.equal(run.treatsContext.id,storyId);assert.equal(run.treatsContext.stage,stage+1);}
   }
   assert.equal(run.eventId,returnId);assert.ok(!run.treatsContext);assert.match(app.html(),/辦公室插曲已結束/);
   assert.equal(run.history.filter(row=>row.kind==='office-treat').length,priorTreatCount+3);
  }
 });
 test(`${device}: refusing Jack's drink ends only this invitation and never presents a cancelled company benefit`,async()=>{
  const route=fixture.routes.find(row=>row.id==='jack-drinks-0-0'),run=engine.replayRun(route.roleId,route.seed,route.beforeActions),app=await harness(mobile);
  app.render(run);await app.choose(1);assert.equal(app.state().history.at(-1).treatsOutcome.accepted,false);assert.match(app.html(),/插曲結束/);
  assert.equal(app.state().stats.cash,run.stats.cash);assert.doesNotMatch(app.html(),/公司下午茶結束|公司下午茶仍被取消/);
  await app.action('next');assert.ok(!app.state().treatsContext);assert.equal(app.state().eventId,run.treatsContext.returnEventId);assert.equal(app.state().turn,run.turn);
 });
}
