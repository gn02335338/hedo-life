import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {createCharacterBook,characterBookHTML} from '../dist/character-book.js';
import * as characterStats from '../dist/character-stats.js';
import * as roles from '../dist/roles.js';
import * as sources from '../dist/public-sources.js';
import * as endings from '../dist/endings.js';
import * as legacy from '../dist/legacy.js';
import * as engine from '../dist/engine.js';
import * as achievements from '../dist/achievements.js';
import * as career from '../dist/career-api.js';
import * as currentCareer from '../dist/career-v17.js';
import * as persona from '../dist/persona.js';
import {polishDreamText} from '../dist/copy-v15.js';

const {CHARACTER_IDS,CHARACTER_METRICS}=characterStats;
const rows=(overrides={})=>CHARACTER_IDS.map(id=>({id,...Object.fromEntries(CHARACTER_METRICS.map(metric=>[metric,0])),...(overrides[id]||{})}));
const firstTable=html=>html.match(/<table class="character-comparison">[\s\S]*?<\/table>/)?.[0];
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};

function bookHarness(cloud,cache=null){
  const handlers=new Map(),focus=[],store=new Map(cache?[['hedo-character-public-v1',JSON.stringify(cache)]]:[]);
  let html='';
  const dialog={open:false,scrollTop:0,querySelector(selector){
    if(selector==='[data-character-book]')return html.includes('data-character-book')?{}:null;
    if(selector.startsWith('#'))return {focus(){focus.push(selector);},scrollIntoView(){}};
    return null;
  },addEventListener(type,callback){handlers.set(type,callback);}};
  const book=createCharacterBook({dialog,cloud,getRun:()=>null,openDialog(value){html=value;dialog.open=true;dialog.scrollTop=0;},storage:{getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value)}});
  return {book,dialog,store,focus,get html(){return html;},replace(value){html=value;},change(id,value){handlers.get('change')({target:{id,value}});},retry(){handlers.get('click')({target:{closest:selector=>selector==='[data-character-retry]'?{}:null}});}};
}

test('the cast archive contains sixteen alias-only portraits and never lists locked endings',()=>{
 const html=characterBookHTML();
 assert.equal([...html.matchAll(/class="character-card"/g)].length,16);
 for(const id of CHARACTER_IDS){assert.ok(html.includes(`src="${persona.PERSONAS[id].image}"`));assert.ok(html.includes(persona.PERSONAS[id].name));}
 assert.doesNotMatch(html,/Wing|Spencer|Erich|Sonny|JenJen|Rick|Hope|Kind|Jack|美美/);
 assert.doesNotMatch(html,/納斯達克幻想|自願離職陷阱|勉強通關|成功率/);
 assert.match(html,/目前不影響升遷或事件機率/);
 assert.match(html,/全站角色統計從上線後開始；舊版沒有逐步互動紀錄，不推算/);
 assert.ok(html.indexOf('class="character-card-grid"')<html.indexOf('class="character-ranking-details"'));
 assert.ok(html.indexOf('class="character-card-grid"')<html.indexOf('class="character-book-help"'));
 assert.doesNotMatch(html, /id="character-ranking-details"\s+open/);
 assert.match(html, /<details class="character-book-help"><summary>統計怎麼記？<\/summary>/);
});

test('unavailable numbers remain dashes while genuine empty statistics show zero',()=>{
 const missing=firstTable(characterBookHTML({personal:null,global:null}));
 assert.equal([...missing.matchAll(/<td>—<\/td>/g)].length,10);
 assert.doesNotMatch(missing,/<td>0/);
 const empty=characterBookHTML({personal:rows(),global:{version:1,characters:rows()}});
 assert.match(firstTable(empty),/<td>0<small>次<\/small><\/td>/);
 assert.match(empty,/全站還沒有完成的角色互動/);
 const incomplete=firstTable(characterBookHTML({personal:[{id:'wing',encounters:99}],global:null}));
 assert.equal([...incomplete.matchAll(/<td>—<\/td>/g)].length,10);
});

test('verified totals and current-run previews remain separate without max or addition',()=>{
 const run=engine.applyChoice(engine.createRun('system','e20-character-book-preview'),0);
 const html=characterBookHTML({personal:rows({wing:{encounters:3,imaginedHits:1,affinityGained:12,affinityUpEvents:2}}),global:{version:1,characters:rows({wing:{encounters:40,imaginedHits:14,realHits:7,affinityLost:24,affinityDownEvents:2}})},currentRun:run});
 const table=firstTable(html);
 assert.match(table,/<th scope="row">完成互動<\/th><td>3<small>次<\/small><\/td><td>40<small>次<\/small><\/td>/);
 assert.match(table,/2<small>次<\/small><span class="character-points">\+12 點/);
 assert.match(table,/2<small>次<\/small><span class="character-points">−24 點/);
 assert.match(html,/這局預覽/);assert.match(html,/兩者不相加/);
 assert.match(html,/<dt>完成互動<\/dt><dd>1 次<\/dd>/);
 assert.doesNotMatch(table,/<td>4<small>次|<td>41<small>次/);
});

test('opening shows loading, then real results; filters and ranking use only the chosen actual metric',async()=>{
 const personal=deferred(),global=deferred(),state={status:'connecting',characters:[],pending:0};
 const cloud={state,init:()=>personal.promise,characters:()=>global.promise};
 const app=bookHarness(cloud),opened=app.book.open();
 assert.match(app.html,/正在取得角色互動紀錄/);assert.match(app.html,/data-character-retry disabled/);
 Object.assign(state,{status:'online',characters:rows({wing:{encounters:4}})});
 personal.resolve({characters:state.characters});global.resolve({version:1,characters:rows({meimei:{realHits:3,encounters:5},wing:{imaginedHits:8,encounters:10}}),trackingSince:'2026-10-20T00:00:00.000Z'});
 await opened;
 assert.doesNotMatch(app.html,/正在取得角色互動紀錄/);assert.match(app.html,/已驗證雲端紀錄/);
 assert.ok(app.html.indexOf('data-character-focus="meimei"')<app.html.indexOf('data-character-focus="wing"'));
 app.change('character-metric','imaginedHits');
 assert.ok(app.html.indexOf('data-character-focus="wing"')<app.html.indexOf('data-character-focus="meimei"'));
 assert.match(app.html, /id="character-ranking-details" open/);
 app.change('character-filter','meimei');
 assert.equal([...app.html.matchAll(/class="character-card"/g)].length,1);
 assert.match(app.html,/id="character-card-meimei"/);assert.ok(app.focus.includes('#character-filter'));
 assert.ok(app.store.has('hedo-character-public-v1'));
});

test('public totals are fetched after personal pending-proof synchronization completes',async()=>{
 const sync=deferred(),order=[];
 const cloud={state:{status:'connecting',characters:[],pending:1},init:async()=>{order.push('init');await sync.promise;cloud.state={status:'online',characters:rows({wing:{encounters:1}}),pending:0};order.push('flushed');return {characters:cloud.state.characters};},characters:async()=>{order.push('public');return {version:1,characters:rows({wing:{encounters:1}})};}};
 const app=bookHarness(cloud),opened=app.book.open();await tick();
 assert.deepEqual(order,['init'],'public read cannot precede a pending proof');
 sync.resolve();await opened;
 assert.deepEqual(order,['init','flushed','public']);
 assert.match(firstTable(app.html),/<td>1<small>次<\/small><\/td><td>1<small>次/);
});

test('offline archive preserves cached verified values and retry replaces them with fetched values',async()=>{
 const cached={version:1,characters:rows({wing:{encounters:7}}),trackingSince:'2026-10-20T00:00:00Z',fetchedAt:'2026-10-20T02:00:00Z'};
 const cloud={state:{status:'local',characters:rows({wing:{encounters:2}}),charactersVerifiedAt:'2026-10-20T02:00:00Z',pending:3},init:async()=>null,characters:async()=>{throw new Error('offline');}};
 const app=bookHarness(cloud,cached);await app.book.open();
 assert.match(app.html,/離線・顯示上次已驗證紀錄/);assert.match(app.html,/有 3 筆紀錄等待同步/);
 assert.match(app.html,/顯示上次取得的數字/);assert.match(firstTable(app.html),/<td>2<small>次<\/small><\/td><td>7<small>次/);
 cloud.state={status:'online',characters:rows({wing:{encounters:3}}),pending:0};
 cloud.init=async()=>({characters:cloud.state.characters});cloud.characters=async()=>({version:1,characters:rows({wing:{encounters:9}}),trackingSince:cached.trackingSince});
 app.retry();await tick();await tick();
 assert.match(app.html,/已驗證雲端紀錄/);assert.doesNotMatch(app.html,/全站紀錄暫時無法更新/);
 assert.match(firstTable(app.html),/<td>3<small>次<\/small><\/td><td>9<small>次/);
});

test('an old ten-character public cache preserves its offline totals and dates while Helen stays unknown',async()=>{
 const legacy=rows({wing:{encounters:7,realHits:2}}).slice(0,10);
 const cached={version:1,characters:legacy,trackingSince:'2026-09-01T00:00:00.000Z',fetchedAt:'2026-09-30T12:34:56.000Z'};
 const cloud={state:{status:'local',characters:[],pending:0},init:async()=>null,characters:async()=>{throw new Error('offline');}};
 const app=bookHarness(cloud,cached);await app.book.open();
 assert.match(firstTable(app.html),/<td>—<\/td><td>7<small>次<\/small>/);
 assert.match(firstTable(app.html),/<td>—<\/td><td>2<small>次<\/small>/);
 for(const value of [cached.fetchedAt,cached.trackingSince])assert.ok(app.html.includes(new Date(value).toLocaleString('zh-TW',{hour12:false})));
 assert.deepEqual(JSON.parse(app.store.get('hedo-character-public-v1')),cached,'offline reading does not rewrite the ten-person snapshot');
 app.change('character-filter','helen');
 assert.equal([...firstTable(app.html).matchAll(/<td>—<\/td>/g)].length,10);
 assert.doesNotMatch(firstTable(app.html),/<td>0/);
 assert.match(app.html,/前女友/);
});

test('a fresh eleven-character public response replaces the legacy cache and supplies actual Helen totals',async()=>{
 const cached={version:1,characters:rows({wing:{encounters:7}}).slice(0,10),trackingSince:'2026-09-01T00:00:00.000Z',fetchedAt:'2026-09-30T12:34:56.000Z'};
 const cloud={state:{status:'local',characters:[],pending:0},init:async()=>null,characters:async()=>{throw new Error('offline');}};
 const app=bookHarness(cloud,cached);await app.book.open();
 const fresh=rows({wing:{encounters:9},helen:{encounters:5,realHits:4}}).slice(0,11);
 cloud.state={status:'online',characters:rows().slice(0,11),pending:0};cloud.init=async()=>({});
 cloud.characters=async()=>({version:1,characters:fresh,trackingSince:cached.trackingSince});
 app.retry();await tick();await tick();
 app.change('character-filter','helen');
 assert.match(firstTable(app.html),/<td>0<small>次<\/small><\/td><td>5<small>次<\/small>/);
 assert.match(firstTable(app.html),/<td>0<small>次<\/small><\/td><td>4<small>次<\/small>/);
 const saved=JSON.parse(app.store.get('hedo-character-public-v1'));
 assert.deepEqual(saved.characters,fresh);assert.equal(saved.characters.length,11);
 assert.equal(saved.trackingSince,cached.trackingSince);assert.notEqual(saved.fetchedAt,cached.fetchedAt);
});

test('malformed Helen rows and missing original characters cannot masquerade as compatible public caches',async()=>{
 const good=rows({wing:{encounters:7}}),helen=good.find(row=>row.id==='helen'),missingMetric={...helen};delete missingMetric.affinityLost;
 const invalid=[good.map(row=>row.id==='helen'?{...row,realHits:-1}:row),good.map(row=>row.id==='helen'?missingMetric:row),good.filter(row=>row.id!=='sonny')];
 const legacy={version:1,characters:good.slice(0,10),trackingSince:'2026-09-01T00:00:00.000Z',fetchedAt:'2026-09-30T12:34:56.000Z'};
 for(const bad of invalid){
  const cloud={state:{status:'local',characters:[],pending:0},init:async()=>null,characters:async()=>{throw new Error('offline');}};
  const rejected=bookHarness(cloud,{...legacy,characters:bad});await rejected.book.open();
  assert.equal([...firstTable(rejected.html).matchAll(/<td>—<\/td>/g)].length,10);
  assert.doesNotMatch(firstTable(rejected.html),/<td>7<small>/);
  const retained=bookHarness(cloud,legacy);await retained.book.open();
  cloud.characters=async()=>({version:1,characters:bad,trackingSince:legacy.trackingSince});
  retained.retry();await tick();await tick();
  assert.match(firstTable(retained.html),/<td>—<\/td><td>7<small>次<\/small>/);
  assert.match(retained.html,/全站紀錄暫時無法更新，顯示上次取得的數字/);
  assert.deepEqual(JSON.parse(retained.store.get('hedo-character-public-v1')),legacy);
 }
});

test('eleven-person public caches preserve totals while five added portraits remain unknown until refresh',async()=>{
 const legacy=rows({wing:{encounters:7},helen:{encounters:4,realHits:2}}).slice(0,11);
 const cached={version:1,characters:legacy,trackingSince:'2026-09-01T00:00:00.000Z',fetchedAt:'2026-09-30T12:34:56.000Z'};
 const cloud={state:{status:'local',characters:legacy,pending:0},init:async()=>null,characters:async()=>{throw new Error('offline');}};
 const app=bookHarness(cloud,cached);await app.book.open('helen');
 assert.match(firstTable(app.html),/<td>4<small>次<\/small><\/td><td>4<small>次/);
 for(const id of ['sophie','jonathan','owen','sam','cindy']){
  app.change('character-filter',id);
  assert.match(app.html,new RegExp(`id="character-card-${id}"`));
  assert.equal([...firstTable(app.html).matchAll(/<td>—<\/td>/g)].length,10);
  assert.doesNotMatch(firstTable(app.html),/<td>0/);
 }
 assert.deepEqual(JSON.parse(app.store.get('hedo-character-public-v1')),cached);
 const fresh=rows({wing:{encounters:8},helen:{encounters:5},sophie:{encounters:9,realHits:3}});
 cloud.state={status:'online',characters:rows({sophie:{encounters:2,realHits:1}}),pending:0};
 cloud.init=async()=>({});cloud.characters=async()=>({version:1,characters:fresh,trackingSince:cached.trackingSince});
 app.retry();await tick();await tick();app.change('character-filter','sophie');
 assert.match(firstTable(app.html),/<td>2<small>次<\/small><\/td><td>9<small>次/);
 assert.match(firstTable(app.html),/<td>1<small>次<\/small><\/td><td>3<small>次/);
 assert.deepEqual(JSON.parse(app.store.get('hedo-character-public-v1')).characters,fresh);
});

test('malformed supplied rows for any of the five added people cannot replace a valid eleven-person public cache',async()=>{
 const cached={version:1,characters:rows({wing:{encounters:7}}).slice(0,11),trackingSince:'2026-09-01T00:00:00.000Z',fetchedAt:'2026-09-30T12:34:56.000Z'};
 for(const id of ['sophie','jonathan','owen','sam','cindy']){
  const invalid=[...cached.characters,{id,...Object.fromEntries(CHARACTER_METRICS.map(key=>[key,0])),realHits:-1}];
  const cloud={state:{status:'local',characters:[],pending:0},init:async()=>null,characters:async()=>{throw new Error('offline');}};
  const rejected=bookHarness(cloud,{...cached,characters:invalid});await rejected.book.open();
  assert.equal([...firstTable(rejected.html).matchAll(/<td>—<\/td>/g)].length,10);
  const app=bookHarness(cloud,cached);await app.book.open();
  cloud.characters=async()=>({version:1,characters:invalid});app.retry();await tick();await tick();
  assert.match(firstTable(app.html),/<td>—<\/td><td>7<small>次/);
  assert.deepEqual(JSON.parse(app.store.get('hedo-character-public-v1')),cached);
 }
});

test('a delayed archive response cannot replace another dialog or an explicitly newer request',async()=>{
 const first=deferred(),second=deferred();let requests=0;
 const cloud={state:{status:'online',characters:rows(),pending:0},init:async()=>({}),characters:()=>++requests===1?first.promise:second.promise};
 const app=bookHarness(cloud),old=app.book.open();await tick();const latest=app.book.open('meimei');await tick();
 second.resolve({version:1,characters:rows({wing:{encounters:9}})});await latest;
 first.resolve({version:1,characters:rows({wing:{encounters:1}})});await old;
 app.change('character-filter','wing');assert.match(firstTable(app.html),/<td>9<small>次/);
 const delayed=deferred();cloud.characters=()=>delayed.promise;
 const opened=app.book.open();app.replace('<section>another dialog</section>');
 delayed.resolve({version:1,characters:rows({wing:{encounters:100}})});await opened;
 assert.equal(app.html,'<section>another dialog</section>');
});

const appSource=(await readFile(new URL('../dist/app.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
function gameHarness(){
 const nodes=new Map(),listeners=new Map(),calls={proofs:[],books:[],snapshots:0};
 const node=selector=>{if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',title:'',open:false,classList:{add(){},remove(){},toggle(){}},focus(){},scrollIntoView(){},setAttribute(){},addEventListener(){},showModal(){this.open=true;},close(){this.open=false;}});return nodes.get(selector);};
 const context=vm.createContext({...roles,...sources,...endings,...legacy,...engine,...achievements,...career,...currentCareer,...persona,...characterStats,polishDreamText,
  createFeedbackUI:()=>({open(){}}),createCharacterBook:()=>({open(id){calls.books.push(id);},onSnapshot(){calls.snapshots++;},onRunChanged(){}}),
  cloud:{state:{status:'local',characters:[],achievements:[]},subscribe(fn){this.listener=fn;},init:async()=>null,achievementProgress:async()=>null,characterProgress:async run=>{calls.proofs.push(structuredClone(run));return null;},complete:async()=>null},
  localStorage:{getItem:()=>null,setItem(){}},document:{querySelector:node,addEventListener(type,callback){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(callback);}},window:{scrollTo(){},matchMedia:()=>({matches:false})},crypto:webcrypto,structuredClone,setTimeout:()=>1,clearTimeout(){},});
 vm.runInContext(appSource,context,{filename:'dist/app.js'});
 return {context,calls,html:()=>node('#main').innerHTML,render(run){context.testRun=run;vm.runInContext('run=testRun;game(false)',context);},async action(action,id){const event={target:{closest:selector=>selector==='[data-action]'?{dataset:{action,characterId:id}}:null}};for(const fn of listeners.get('click')||[])await fn(event);},state:()=>vm.runInContext('run',context)};
}

test('ordinary resolved choices and next steps sync character proofs even with no new achievements',async()=>{
 const app=gameHarness(),run=engine.createRun('system','e20-character-proof');run.runId=webcrypto.randomUUID();app.render(run);await tick();
 vm.runInContext('achievements=Object.fromEntries(ACHIEVEMENTS.map(item=>[item.id,{unlockedAt:"2026-10-20T00:00:00Z",source:"verified"}]))',app.context);
 assert.doesNotMatch(app.html(),/class="character-outcomes"/);
 vm.runInContext('choose(0)',app.context);await tick();
 assert.equal(app.calls.proofs.length,1);assert.equal(app.calls.proofs[0].history.length,1);
 assert.match(app.html(),/aria-label="這次角色互動"/);
 assert.match(app.html(),/data-character-id="wing" class="character-change/);
 const expected=characterStats.characterHistoryChanges(app.state()).find(row=>row.historyIndex===0&&row.id==='wing');
 assert.ok(expected);
 if(expected.affinityDelta)assert.ok(app.html().includes(`好感 ${expected.affinityDelta>0?'+':''}${expected.affinityDelta}`));
 await app.action('next');await tick();assert.equal(app.calls.proofs.length,2);
 assert.equal(app.calls.proofs[1].actions.length,app.state().actions.length);
});

test('rage resolution syncs a new proof and character entries open a selected alias without choosing for the player',async()=>{
 const app=gameHarness(),run=engine.createRun('system','e20-character-rage-sync');run.runId=webcrypto.randomUUID();app.render(run);await tick();
 await app.action('rage');await tick();
 assert.equal(app.calls.proofs.length,1);assert.ok(app.calls.proofs[0].history.some(row=>row.eventId==='rage-release'));
 const actions=app.state().actions.length;await app.action('characters','wing');
 assert.deepEqual(app.calls.books,['wing']);assert.equal(app.state().actions.length,actions);
});

test('the global navigation and metadata advertise the actual current catalogs',async()=>{
 const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
 assert.match(html,/<nav[^>]*>[\s\S]*?data-action="characters">角色圖鑑/);
 assert.ok(html.includes(`0 / ${endings.ENDINGS.length}`));assert.ok(html.includes(`0 / ${achievements.ACHIEVEMENTS.length}`));assert.match(html,/八階職涯/);
 assert.doesNotMatch(html,/234張|五階職涯|0 \/ 32/);
});
