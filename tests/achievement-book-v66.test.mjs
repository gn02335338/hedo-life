import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {ACHIEVEMENTS,ACHIEVEMENT_GROUPS} from '../dist/achievements.js';
import {achievementPageV66,renderAchievementBookV66,ACHIEVEMENT_PAGE_SIZE_V66} from '../dist/achievement-book-v66.js';
import {createAppHarnessV63} from './app-ui-harness-v63.mjs';
const records=Object.fromEntries(ACHIEVEMENTS.slice(0,3).map(item=>[item.id,{unlockedAt:'2026-10-23T01:02:03.000Z',source:'verified'}]));
const args={catalog:ACHIEVEMENTS,records,groups:ACHIEVEMENT_GROUPS,renderUnlocked:item=>`<article class="achievement-card unlocked"><h3>${item.title}</h3><img src="${item.image}" alt=""></article>`};
const count=html=>(html.match(/<article class="achievement-card /g)||[]).length;

test('1000-card projection renders only 36 at a time and retains stable serial numbers across all 28 pages',()=>{
 assert.equal(ACHIEVEMENT_PAGE_SIZE_V66,36);let visited=[];
 for(let page=0;page<28;page++){const state=achievementPageV66({...args,page});assert.equal(state.page,page);assert.equal(state.pages,28);assert.equal(state.total,1000);assert.equal(state.rows.length,page===27?28:36);visited.push(...state.rows.map(row=>row.item.id));const html=renderAchievementBookV66({...args,page});assert.equal(count(html),state.rows.length);assert.match(html,/type="button" data-achievement-page/);}
 assert.deepEqual(visited,ACHIEVEMENTS.map(item=>item.id));assert.equal(achievementPageV66({...args,page:999}).page,27);assert.equal(achievementPageV66({...args,page:-1}).page,0);assert.equal(achievementPageV66({...args,page:NaN}).page,0);
});

test('locked pages reveal no title, condition, ID, mode, image URL or hidden-character identity',()=>{
 const all=ACHIEVEMENTS.map((_,index)=>index%36===0?renderAchievementBookV66({...args,records:{},page:Math.floor(index/36)}):'').join('');
 for(const item of ACHIEVEMENTS){assert.ok(!all.includes(`<h3>${item.title}</h3>`));assert.ok(!all.includes(item.description));assert.ok(!all.includes(item.image));assert.ok(!all.includes(`data-achievement-id="${item.id}"`));}
 assert.doesNotMatch(all,/<img|achievement-mode|frans|魚酥|真實失控|夢境專屬/);assert.equal((all.match(/<h3>\?\?\?<\/h3>/g)||[]).length,1000);
 assert.doesNotMatch(renderAchievementBookV66({...args,records:{},group:'missing'}),/undefined|NaN/);
});

test('status and category filters preserve earned dates while clamping a stale page',()=>{
 const stored=JSON.stringify(records),unlocked=achievementPageV66({...args,filter:'unlocked',page:27});assert.equal(unlocked.page,0);assert.equal(unlocked.rows.length,3);assert.deepEqual(unlocked.rows.map(row=>row.item.id),Object.keys(records));
 const locked=achievementPageV66({...args,filter:'locked'});assert.equal(locked.total,997);assert.ok(locked.rows.every(row=>!records[row.item.id]));
 const profession=achievementPageV66({...args,group:'professions'});assert.ok(profession.rows.every(row=>row.item.group==='professions'));assert.ok(profession.total>=169);assert.equal(JSON.stringify(records),stored);
});

for(const mobile of [false,true])test(`${mobile?'mobile':'desktop'}: actual app opens a paginated collection and navigation only changes its view`,async()=>{
 const app=await createAppHarnessV63(mobile);app.context.testAchievements=records;vm.runInContext('achievements=structuredClone(testAchievements);achievementBook()',app.context);
 const dialog=()=>app.node('#dialog-content').innerHTML;assert.equal(count(dialog()),36);assert.match(dialog(),/3<\/b> \/ 1000/);assert.match(dialog(),/第 <b>1<\/b> \/ 28/);
 const calls={...app.calls},before=vm.runInContext('JSON.stringify(achievements)',app.context),runBefore=app.state();
 vm.runInContext('achievementPageV66Index=27;achievementBook()',app.context);assert.equal(count(dialog()),28);assert.match(dialog(),/第 <b>28<\/b> \/ 28/);assert.match(dialog(),/1000 \/ UNKNOWN/);
 vm.runInContext("achievementFilter='unlocked';achievementPageV66Index=27;achievementBook()",app.context);assert.equal(count(dialog()),3);assert.match(dialog(),/已驗證同步/);assert.equal(vm.runInContext('achievementPageV66Index',app.context),0);
 vm.runInContext("achievementFilter='locked';achievementGroupV66='activities';achievementBook()",app.context);assert.equal(count(dialog()),36);assert.doesNotMatch(dialog(),/<img|undefined|NaN/);
 assert.equal(vm.runInContext('JSON.stringify(achievements)',app.context),before);assert.equal(app.state(),runBefore);assert.deepEqual(app.calls,calls);
});
