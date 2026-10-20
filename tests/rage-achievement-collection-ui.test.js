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
import {renderEndingReport} from '../dist/ending-report-view.js';

const appSource=(await readFile(new URL('../dist/app.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
const oldIds=['rage-wing','rage-spencer','rage-rick','rage-hope','rage-erich','rage-jenjen','rage-sonny','rage-kind','rage-jack','rage-meimei','rage-first-day','rage-documented','rage-catharsis','rage-absent'];
const date='2026-10-01T03:04:05.000Z';
const row=(source='local',unlockedAt=date)=>({unlockedAt,source});
const plain=value=>JSON.parse(JSON.stringify(value));

function harness(initial={}){
 const nodes=new Map(),listeners=new Map(),calls={save:0,proof:0,cloud:0},stored=new Map([['hedo-life-v3',JSON.stringify({unlocked:[],achievements:initial})]]);
 let subscriber,exported;
 const node=selector=>{
  if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',title:'',open:false,
   classList:{add(){},remove(){},toggle(){}},focus(){},setAttribute(){},addEventListener(){},scrollIntoView(){},
   showModal(){this.open=true;},close(){this.open=false;},
  });return nodes.get(selector);
 };
 const context=vm.createContext({...roles,...sources,...endings,...legacy,...engine,...achievements,...career,...currentCareer,...persona,...characterStats,polishDreamText,renderEndingReport,
  createFeedbackUI:()=>({open(){}}),createCharacterBook:()=>({open(){},onSnapshot(){},onRunChanged(){}}),
  cloud:{state:{status:'local',achievements:[]},subscribe(callback){subscriber=callback;},init:async()=>{calls.cloud++;return null;},achievementProgress:async()=>{calls.proof++;return null;},characterProgress:async()=>null,complete:async()=>null},
  localStorage:{getItem:key=>stored.get(key)||null,setItem(key,value){calls.save++;stored.set(key,value);}},
  document:{querySelector:node,addEventListener(type,callback){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(callback);},createElement:()=>({click(){}})},
  window:{scrollTo(){},matchMedia:()=>({matches:false})},crypto:webcrypto,structuredClone,setTimeout:()=>1,clearTimeout(){},
  Blob,URL:{createObjectURL(blob){exported=blob;return 'blob:test-export';},revokeObjectURL(){}},
 });
 vm.runInContext(appSource,context,{filename:'dist/app.js'});
 return {calls,node,records:()=>plain(vm.runInContext('achievements',context)),saved:()=>JSON.parse(stored.get('hedo-life-v3')),
  book(filter='all'){context.testFilter=filter;vm.runInContext('achievementFilter=testFilter;achievementBook()',context);return node('#dialog-content').innerHTML;},
  cloudMerge(rows){subscriber({status:'online',achievements:rows});},
  async importRecords(rows){const target={id:'import-collection',value:'file',files:[{size:100,text:async()=>JSON.stringify({format:'hedo-collection',version:3,unlocked:[],achievements:rows})}]};for(const callback of listeners.get('change')||[])await callback({target});return target;},
  async exportRecords(){vm.runInContext('exportCollection()',context);return JSON.parse(await exported.text());},
  renderEnding(){context.testRun={...engine.createRun('sales','e21-collection-ending'),completed:true,endingId:endings.ENDINGS[0].id};vm.runInContext('run=testRun;endingScreen()',context);return node('#main').innerHTML;},
 };
}
function mainGrid(html){return html.split('<section class="legacy-rage-achievements"')[0];}
const cardCount=(html,kind)=>[...html.matchAll(new RegExp(`<article class="achievement-card ${kind}(?: |")`,'g'))].length;

test('old local badges retain every ID, timestamp and source without becoming real-hit achievements',()=>{
 const initial=Object.fromEntries(oldIds.map((id,index)=>[id,row(['local','verified','imported'][index%3])]));
 initial['work-card']=row();initial['unknown-badge']=row();initial['dream-first-day']={unlockedAt:'broken date',source:'verified'};
 const app=harness(initial),saved=app.saved();
 for(const id of oldIds)assert.deepEqual(saved.achievements[id],initial[id],id);
 assert.equal(saved.achievements['unknown-badge'],undefined);assert.equal(saved.achievements['dream-first-day'],undefined);
 assert.ok(!Object.keys(saved.achievements).some(id=>id.startsWith('real-hit-')));
 assert.equal(app.node('#achievement-count').textContent,`1 / ${achievements.ACHIEVEMENTS.length}`);
 const html=app.book();assert.match(html,/aria-valuenow="1"/);assert.match(html,/舊版暴走紀念/);
 assert.match(html,/無法據此確認真的出手/);assert.equal(cardCount(mainGrid(html),'unlocked'),1);
 assert.equal(cardCount(html,'unlocked'),1+oldIds.length);assert.equal(cardCount(html,'locked'),achievements.ACHIEVEMENTS.length-1);
 assert.match(app.renderEnding(),new RegExp(`翻開成就簿 · 1 / ${achievements.ACHIEVEMENTS.length}`));
});

test('cloud records preserve old badges but unknown IDs cannot enter the collection or its progress',()=>{
 const app=harness({'rage-wing':row('local')});
 const synced='2026-10-02T04:05:06.000Z';
 app.cloudMerge([{id:'rage-wing',unlockedAt:synced},{id:'rage-hope',unlockedAt:date},{id:'real-hit-wing',unlockedAt:date},{id:'unknown-badge',unlockedAt:date},{id:'rage-rick',unlockedAt:'bad'}]);
 const saved=app.saved().achievements;
 assert.deepEqual(saved['rage-wing'],row('verified',synced));assert.deepEqual(saved['rage-hope'],row('verified'));
 assert.deepEqual(saved['real-hit-wing'],row('verified'));assert.equal(saved['unknown-badge'],undefined);assert.equal(saved['rage-rick'],undefined);
 assert.equal(app.node('#achievement-count').textContent,`1 / ${achievements.ACHIEVEMENTS.length}`);
 const html=app.book();assert.equal(cardCount(mainGrid(html),'unlocked'),1);assert.equal(cardCount(html,'unlocked'),3);
 assert.match(html,/achievement-mode real">現實出手/);
});

test('import and export keep legacy collections without promoting them or syncing imported proof',async()=>{
 const app=harness({'rage-wing':row('verified')}),before={...app.calls};
 const target=await app.importRecords({'rage-wing':row('imported','2026-09-01T00:00:00.000Z'),'rage-rick':row('verified'),'dream-wing':row('verified'),'nonsense':row()});
 const saved=app.saved().achievements;
 assert.deepEqual(saved['rage-wing'],row('verified'),'import does not overwrite an existing earned record');
 assert.deepEqual(saved['rage-rick'],row('imported'));assert.deepEqual(saved['dream-wing'],row('imported'));
 assert.equal(saved.nonsense,undefined);assert.equal(saved['real-hit-wing'],undefined);assert.equal(target.value,'');
 const exported=await app.exportRecords();assert.equal(exported.format,'hedo-collection');assert.equal(exported.version,3);
 assert.deepEqual(exported.achievements,saved);assert.equal(app.calls.proof,before.proof);assert.equal(app.calls.cloud,before.cloud);
 assert.equal(app.node('#achievement-count').textContent,`1 / ${achievements.ACHIEVEMENTS.length}`);
});

test('active filters and progress exclude legacy keepsakes and never list unearned old badges',()=>{
 const app=harness({'rage-wing':row(),'work-card':row()});
 const unlocked=app.book('unlocked');assert.equal(cardCount(mainGrid(unlocked),'unlocked'),1);assert.equal(cardCount(mainGrid(unlocked),'locked'),0);
 assert.equal(cardCount(unlocked,'unlocked'),2);assert.match(unlocked,/legacy-rage-card/);
 const locked=app.book('locked');assert.equal(cardCount(mainGrid(locked),'unlocked'),0);assert.equal(cardCount(mainGrid(locked),'locked'),achievements.ACHIEVEMENTS.length-1);
 const absent=achievements.LEGACY_RAGE_ACHIEVEMENTS.find(item=>item.id==='rage-rick');assert.ok(absent);assert.ok(!locked.includes(`<h3>${absent.title}</h3>`));
 assert.match(locked,/aria-valuenow="1"/);
 const empty=harness().book();assert.ok(!empty.includes('legacy-rage-achievements'));assert.equal(cardCount(empty,'locked'),achievements.ACHIEVEMENTS.length);
});

test('only unlocked active rage badges reveal their dream or real mode, title, condition and art',()=>{
 const initial={'dream-wing':row(),'real-hit-wing':row()};
 const app=harness(initial),html=app.book();
 for(const [id,mode,label]of [['dream-wing','imagined','腦內夢境'],['real-hit-wing','real','現實出手']]){
  const item=achievements.ACHIEVEMENT_MAP[id];assert.ok(item);assert.ok(html.includes(`<h3>${item.title}</h3>`));
  assert.ok(html.includes(item.description));assert.ok(html.includes(`src="${item.image}"`));assert.ok(html.includes(`achievement-mode ${mode}">${label}`));
 }
 for(const card of html.matchAll(/<article class="achievement-card locked"[\s\S]*?<\/article>/g)){
  assert.match(card[0],/<h3>\?\?\?<\/h3>/);assert.doesNotMatch(card[0],/<img|achievement-mode|現實出手|腦內夢境|real-hit-|dream-/);
 }
 const locked=achievements.ACHIEVEMENT_MAP['real-hit-spencer'];assert.ok(locked);assert.ok(!html.includes(`<h3>${locked.title}</h3>`));
});

test('reading or filtering the achievement book never changes records, draws game RNG or submits proof',()=>{
 const app=harness({'rage-wing':row(),'dream-wing':row()}),before=app.records(),saved=app.saved(),calls={...app.calls};
 for(const filter of ['all','locked','unlocked','all'])app.book(filter);
 assert.deepEqual(app.records(),before);assert.deepEqual(app.saved(),saved);assert.deepEqual(app.calls,calls);
});
