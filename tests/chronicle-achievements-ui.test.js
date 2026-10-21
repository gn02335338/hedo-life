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
import * as badges from '../dist/achievements.js';
import * as career from '../dist/career-api.js';
import * as currentCareer from '../dist/career-v17.js';
import * as persona from '../dist/persona.js';
import * as characterStats from '../dist/character-stats.js';
import {polishDreamText} from '../dist/copy-v15.js';

const appSource=(await readFile(new URL('../dist/app.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
const {routes:chronicleRoutes}=JSON.parse(await readFile(new URL('./fixtures/chronicle-achievement-routes.json',import.meta.url),'utf8'));
const wealthRoutes=JSON.parse(await readFile(new URL('./fixtures/wealth-routes-v27.json',import.meta.url),'utf8')).routes.filter(route=>route.kind==='ending');
const wealthScenes=[
 ['venture_independent','wealth-startup-success'],['venture_restart','wealth-startup-failure'],
 ['retired_free','wealth-retired-free'],['retired_free','wealth-goose-chairman',2],
].map(([family,achievementId,index])=>{
 const route=wealthRoutes.find(item=>item.family===family),before=engine.replayRun(route.roleId,route.seed,route.choiceActions);
 const choiceIndex=index??route.index,run=engine.applyChoice(before,choiceIndex);
 return {roleId:route.roleId,seed:route.seed,actions:run.actions,eventId:before.eventId,choiceIndex,achievementId};
});
const routes=[...chronicleRoutes,...wealthScenes];
const newIds=['banquet-first-love','sonny-press-conference','sonny-unplayed-champion','wealth-startup-success','wealth-startup-failure','wealth-goose-chairman','wealth-retired-free'];
const plain=value=>JSON.parse(JSON.stringify(value));
const esc=value=>persona.displayText(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tick=()=>new Promise(resolve=>setImmediate(resolve));

async function harness(mobile,initial={},retainedRun=null){
 const nodes=new Map(),calls={save:0,proof:0};
 const storage=new Map([['hedo-life-v3',JSON.stringify({unlocked:[],achievements:initial,...(retainedRun?{run:retainedRun}:{})})]]);
 const node=selector=>{
  if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',title:'',open:false,
   classList:{add(){},remove(){},toggle(){}},focus(){},setAttribute(){},addEventListener(){},scrollIntoView(){},
   showModal(){this.open=true;},close(){this.open=false;},
  });return nodes.get(selector);
 };
 const context=vm.createContext({
  ...roles,...sources,...endings,...legacy,...engine,...badges,...career,...currentCareer,...persona,...characterStats,polishDreamText,
  createFeedbackUI:()=>({open(){}}),createCharacterBook:()=>({open(){},onSnapshot(){},onRunChanged(){}}),
  cloud:{state:{status:'offline',achievements:[],characters:[]},subscribe(){},init:async()=>null,
   achievementProgress:async()=>{calls.proof++;return null;},characterProgress:async()=>null,complete:async()=>null},
  localStorage:{getItem:key=>storage.get(key)||null,setItem(key,value){calls.save++;storage.set(key,value);}},
  document:{querySelector:node,addEventListener(){}},
  window:{scrollTo(){},matchMedia:()=>({matches:mobile})},crypto:webcrypto,structuredClone,setTimeout:()=>1,clearTimeout(){},
 });
 vm.runInContext(appSource,context,{filename:'dist/app.js'});
 await tick();calls.save=0;calls.proof=0;
 return {calls,node,
  render(run){context.fixtureRun=run;vm.runInContext('run=fixtureRun;game(true)',context);return node('#main').innerHTML;},
  choose(index){context.fixtureIndex=index;vm.runInContext('choose(fixtureIndex)',context);return node('#main').innerHTML;},
  book(filter='all'){context.fixtureFilter=filter;vm.runInContext('achievementFilter=fixtureFilter;achievementBook()',context);const html=node('#dialog-content').innerHTML;node('#dialog').close();return html;},
  state:()=>vm.runInContext('run',context),
  records:()=>plain(vm.runInContext('achievements',context)),
  saved:()=>JSON.parse(storage.get('hedo-life-v3')),
 };
}

function assertHidden(html,item){
 assert.ok(!html.includes(`<h3>${esc(item.title)}</h3>`),`${item.id}: locked title`);
 assert.ok(!html.includes(esc(item.description)),`${item.id}: locked condition`);
 assert.ok(!html.includes(item.image),`${item.id}: locked illustration`);
}

for(const mobile of [false,true]){
 const device=mobile?'mobile':'desktop';
 test(`${device}: all seven special-scene badges remain anonymous in every locked collection view`,async()=>{
  const app=await harness(mobile),before=app.saved(),calls={...app.calls};
  for(const filter of ['all','locked','unlocked']){
   const html=app.book(filter);
   for(const id of newIds){const item=badges.ACHIEVEMENT_MAP[id];assert.ok(item,id);assertHidden(html,item);}
   for(const card of html.matchAll(/<article class="achievement-card locked"[\s\S]*?<\/article>/g)){
    assert.match(card[0],/<h3>\?\?\?<\/h3>/);assert.doesNotMatch(card[0],/<img|data-achievement-id=/);
   }
  }
  assert.equal(app.node('#achievement-toast').innerHTML,'');
  assert.deepEqual(app.saved(),before);assert.deepEqual(app.calls,calls,'collection views never save or submit proof');
 });

 test(`${device}: retained e27 resolved lives backfill earned wealth art without changing saves or unrelated badges`,async()=>{
  for(const fixture of wealthScenes){
   const run=engine.replayRun(fixture.roleId,fixture.seed,fixture.actions);run.runId=webcrypto.randomUUID();
   const before=plain(run),oldRecord={unlockedAt:'2026-10-01T00:00:00.000Z',source:'local'};
   const initial={'work-card':oldRecord},app=await harness(mobile,initial,run),item=badges.ACHIEVEMENT_MAP[fixture.achievementId];
   assert.ok(app.records()[item.id],'retained canonical history earns its goal on restore');
   assert.deepEqual(app.records()['work-card'],oldRecord,'existing timestamp is preserved');
   assert.deepEqual(plain(app.state()),before,'backfill never rewrites the retained life or RNG');
   assert.deepEqual(app.saved().run,before);assert.ok(app.saved().achievements[item.id]);
   const book=app.book();assert.ok(book.includes(`<h3>${esc(item.title)}</h3>`));
   assert.ok(book.includes(esc(item.description)));assert.ok(book.includes(`src="${item.image}"`));
   for(const id of newIds.filter(id=>!Object.hasOwn(app.records(),id)))assertHidden(book,badges.ACHIEVEMENT_MAP[id]);
  }
 });

 test(`${device}: resolving each naturally reached chronicle or wealth choice reveals only its earned badge in results and collection`,async()=>{
  for(const fixture of routes){
   const before=engine.replayRun(fixture.roleId,fixture.seed,fixture.actions.slice(0,-1));
   assert.equal(before.eventId,fixture.eventId);assert.equal(before.pending,false);
   assert.ok(!badges.deriveAchievements(before).includes(fixture.achievementId));
   before.runId=webcrypto.randomUUID();
   const initial=Object.fromEntries(badges.deriveAchievements(before).map(id=>[id,{unlockedAt:'2026-10-01T00:00:00.000Z',source:'local'}]));
   const app=await harness(mobile,initial),item=badges.ACHIEVEMENT_MAP[fixture.achievementId];assert.ok(item);
   app.render(before);assertHidden(app.book(),item);
   assert.equal(app.node('#achievement-toast').innerHTML,'');
   const expected=engine.applyChoice(before,fixture.choiceIndex),html=app.choose(fixture.choiceIndex);
   assert.deepEqual(plain(app.state()),plain(expected),'the UI commits the canonical engine choice');
   const shown=persona.displayChronicleHistory(expected.history.at(-1));
   assert.ok(html.includes(esc(shown.result)),'the committed story result is visible');
   const recent=html.match(/<section class="result-achievements"[\s\S]*?<\/section>/)?.[0];
   assert.ok(recent,'newly earned badge accompanies the result');
   assert.ok(recent.includes(esc(item.title)));assert.ok(recent.includes(`src="${item.image}"`));
   const toast=app.node('#achievement-toast').innerHTML;
   const justEarned=badges.deriveAchievements(expected).filter(id=>!Object.hasOwn(initial,id)),first=badges.ACHIEVEMENT_MAP[justEarned[0]];
   assert.ok(justEarned.includes(item.id));assert.ok(toast.includes(`<b>${esc(first.title)}</b>`));assert.ok(toast.includes(`src="${first.image}"`));
   if(justEarned.length>1)assert.ok(toast.includes(`共 ${justEarned.length} 枚`),'a simultaneous milestone is included in the toast total');
   const record=app.records()[item.id];assert.equal(record.source,'local');assert.ok(Number.isFinite(Date.parse(record.unlockedAt)));
   assert.deepEqual(app.saved().achievements[item.id],record);assert.equal(app.calls.proof,1,'one replay proof is queued after earning');
   const canonical=JSON.stringify(app.state()),saved=app.saved(),calls={...app.calls},book=app.book();
   assert.ok(book.includes(`<h3>${esc(item.title)}</h3>`));assert.ok(book.includes(esc(item.description)));assert.ok(book.includes(`src="${item.image}"`));
   for(const id of newIds.filter(id=>!Object.hasOwn(app.records(),id)))assertHidden(book,badges.ACHIEVEMENT_MAP[id]);
   app.book('unlocked');app.book('all');
   assert.equal(JSON.stringify(app.state()),canonical,'reading the badge never draws another outcome');
   assert.deepEqual(app.saved(),saved);assert.deepEqual(app.calls,calls);
  }
 });
}
