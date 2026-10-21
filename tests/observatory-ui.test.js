import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {ROLES} from '../dist/roles.js';
import {ENDINGS} from '../dist/endings.js';
import {CAREER_LEVELS_V17} from '../dist/career-v17.js';

const source=await readFile(new URL('../dist/app.js',import.meta.url),'utf8');
const begin=source.indexOf('function observatoryCount(');
const end=source.indexOf('\nfunction ',source.indexOf('async function statistics()',begin));
const code=source.slice(begin,end);
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const rankRows=(length,counts={})=>Array.from({length},(_,rank)=>({rank,count:counts[rank]||0}));
const idRows=(ids,counts={})=>ids.map(id=>({id,count:counts[id]||0}));
const departureDefinitions=[
 ['voluntary','自行離職'],['forced_signed','被要求簽自願離職'],['company_exit','資遣／被要求離場'],
 ['pip_failed','PIP 未通過離場'],['pip_passed_exit','PIP 通過後自行離職'],['cold_storage','冷凍調職後離場'],
 ['labor_dispute','勞資爭議後離場'],['burnout','身心耗盡'],['cash_exhausted','存款耗盡'],
 ['startup','離職創業'],['retirement','退休／彈性接案'],['other','未明確離職／其他收尾'],['unclassified','待分類']
];
const departureRows=counts=>idRows(departureDefinitions.map(([id])=>id),counts);
function response(){return {
 players:7,totalRuns:10,uniqueEndings:8,averageTurns:9.5,
 roles:[{id:'sales',count:4},{id:'finance',count:3},{id:'design',count:3}],
 endings:[{id:ENDINGS[0].id,count:2}],daily:[{date:'2026-10-20',count:2},{date:'2026-10-21',count:3}],
 observatory:{version:1,trackingSince:'2026-10-21T00:00:00.000Z',recordedRuns:4,unclassifiedRuns:6,
  career:{full8:rankRows(8,{0:1,1:1,4:1}),legacy5:rankRows(5),special:idRows(['son','daughter'],{daughter:1})},
  actualRoles:[{id:'sales',count:3},{id:'finance',count:4},{id:'design',count:3}],reassignments:2,
  endingTypes:idRows(['good','normal','bad','secret'],{good:3,normal:4,bad:2,secret:1}),
  tenure:idRows(['1-3','4-7','8-12','13-19','20-24'],{'1-3':3,'4-7':2,'8-12':2,'13-19':2,'20-24':1}),
  salary:{average:64.5,bands:idRows(['under30','30-49','50-79','80-119','120plus'],{under30:1,'30-49':2,'50-79':4,'80-119':2,'120plus':1})},
  departureWays:departureRows({voluntary:3,forced_signed:1,company_exit:2,pip_failed:1,pip_passed_exit:1,retirement:1,other:1}),
  experiences:{pip:3,promoted:1,payCut:2,collapse:2,appointed:1}
 }
};}
function harness(mobile,data,error=null){
 const node={innerHTML:''},calls={stats:0,dialogs:[]};let exists=true;
 const context=vm.createContext({ROLES,ENDINGS,CAREER_LEVELS_V17,esc:escape,
  window:{matchMedia:()=>({matches:mobile})},
  openDialog:html=>calls.dialogs.push(html),$:()=>exists?node:null,
  cloud:{stats:async()=>{calls.stats++;if(error)throw error;return data;}}
 });
 vm.runInContext(code,context);
 return {calls,node,context,close(){exists=false;},
  async render(){await vm.runInContext('statistics()',context);return node.innerHTML;},
  career(value){context.value=value;return vm.runInContext('careerStatsHTML(value)',context);},
  departure(value){context.value=value;return vm.runInContext('departureStatsHTML(value)',context);}
 };
}
function noSpoilers(html){
 for(const ending of ENDINGS){assert(!html.includes(`>${escape(ending.title)}<`),`ending title ${ending.id}`);assert(!html.includes(`"${ending.id}"`),`ending identity ${ending.id}`);}
 assert.doesNotMatch(html,/undefined|NaN|Infinity/);
}

for(const mobile of [false,true]){
 const device=mobile?'mobile':'desktop';
 test(`${device}: departure chart shows fixed public categories and all-run percentages without exposing endings`,async()=>{
  const data=response(),before=JSON.stringify(data),app=harness(mobile,data);
  const html=await app.render(),panel=app.departure(data);
  assert.match(html,/這份工作，怎麼結束的？/);assert.match(panel,/如何離職/);
  for(const [id,label] of departureDefinitions){
   assert(panel.includes(escape(label)),`departure label ${id}`);
   const count=data.observatory.departureWays.find(row=>row.id===id).count;
   assert(panel.includes(`${escape(label)}：${count}局`),`accessible departure count ${id}`);
  }
  assert.match(panel,/30\.0%/);assert.match(panel,/20\.0%/);assert.match(panel,/10\.0%/);assert.match(panel,/0\.0%/);
  assert.match(panel,/全站|全部|已完成/);assert.doesNotMatch(panel,/75\.0%|25\.0%/,'denominator is all 10 completed lives, not the 4 newly classified career records');
  assert.match(panel,/role="img" aria-label=/);noSpoilers(panel);noSpoilers(html);
  assert.equal(JSON.stringify(data),before,'departure rendering does not mutate the API response');
 });

 test(`${device}: a historical API without departure data leaves an explicit unavailable panel instead of guessing from endings`,async()=>{
  const data=response();delete data.observatory.departureWays;
  data.endings=[{id:'voluntary',title:'PRIVATE-RESIGNATION',count:10},{id:'layoff',title:'PRIVATE-DISMISSAL',count:99}];
  const app=harness(mobile,data),html=await app.render(),panel=app.departure(data);
  assert.match(html,/這份工作，怎麼結束的？/);assert.match(panel,/尚未提供|等待|待補/);
  assert.doesNotMatch(panel,/class="bar-row"|class="observatory-departure-row"|0\.0%|PRIVATE-|voluntary|layoff/);
  assert.doesNotMatch(html,/PRIVATE-RESIGNATION|PRIVATE-DISMISSAL/);noSpoilers(html);
  delete data.observatory;
  const legacy=app.departure(data);
  assert.match(legacy,/這份工作，怎麼結束的？/);assert.match(legacy,/尚未提供|等待|待補/);
  assert.doesNotMatch(legacy,/class="bar-row"|class="observatory-departure-row"|0\.0%|PRIVATE-/);
 });

 test(`${device}: no completed lives keep zero category counts but never invent percentage rates`,async()=>{
  const data=response();data.totalRuns=0;data.observatory.departureWays=departureRows();
  const panel=harness(mobile,data).departure(data);
  assert.match(panel,/這份工作，怎麼結束的？/);assert.match(panel,/—/);
  for(const [,label] of departureDefinitions)assert(panel.includes(`${escape(label)}：0局`));
  assert.doesNotMatch(panel,/0\.0%(?:\s|<)|尚未提供/);noSpoilers(panel);
 });

 test(`${device}: observatory separates eight ranks, legacy ranks and special appointments with explicit collection scope`,async()=>{
  const data=response(),before=JSON.stringify(data),app=harness(mobile,data),html=await app.render();
  assert.match(html,/離場時職級/);assert.match(html,/各種離場都計入/);
  for(const level of CAREER_LEVELS_V17)assert(html.includes(`${level.label}：`));
  assert.match(html,/舊版五階離場時職級/);assert.match(html,/基層／待轉正/);
  assert.match(html,/乾女兒<\/span><b>1/);assert.match(html,/乾兒子<\/span><b>0/);
  assert.match(html,/6局早期紀錄未留完整職級/);assert.match(html,/2026-10-21（UTC）/);
  assert.match(html,/目前記下 4局/);assert.match(html,/75\.0%/);assert.match(html,/3 \/ 4局/);
  assert.match(html,/分母都是已採集完整分類的 4局/);
  assert.match(html,/月薪降低/);assert.match(html,/無薪假或卸任/);
  assert.match(html,/2<small>局 · 20\.0%/);assert.match(html,/平均 64\.5K/);
  for(const role of ROLES)assert(html.includes(escape(role.name)));
  assert.match(html,/只顯示好／一般／壞／隱藏類型/);assert.match(html,/20–24 回合/);
  assert.match(app.calls.dialogs[0],/aria-live="polite"/);assert.match(html,/role="img" aria-label=/);
  noSpoilers(html);assert.equal(JSON.stringify(data),before,'reading statistics never mutates input');
  assert.equal(app.calls.stats,1);
 });

 test(`${device}: missing observatory uses honest legacy fallback without guessing ranks from endings`,async()=>{
  const data=response();delete data.observatory;
  data.endings.push({id:'private-ending-<script>SECRET</script>',title:'not-public',count:100});
  const app=harness(mobile,data),html=await app.render(),career=app.career(data);
  assert.match(html,/新的分類圖表，還在等資料/);assert.match(career,/等待新版分類資料/);
  assert.match(career,/不由結局路線猜職級/);assert.doesNotMatch(career,/class="bar-row"/);
  assert.match(html,/大家從什麼職缺出發/);assert.match(html,/已完成的人生/);
  assert.match(html,/這份工作，怎麼結束的？/,'departure panel remains present on the legacy fallback');
  assert.doesNotMatch(html,/SECRET|private-ending|not-public/);noSpoilers(html);
 });

 test(`${device}: zero new samples keep historical totals and show unavailable rates instead of a false zero percent`,async()=>{
  const data=response(),model=data.observatory;model.recordedRuns=0;model.unclassifiedRuns=10;model.trackingSince=null;
  model.career={full8:rankRows(8),legacy5:rankRows(5),special:idRows(['son','daughter'])};
  model.experiences={pip:0,promoted:0,payCut:0,collapse:0,appointed:0};
  const html=await harness(mobile,data).render();
  assert.match(html,/尚無新的分類完成紀錄/);assert.match(html,/10局早期紀錄未留完整職級/);
  assert.doesNotMatch(html,/日期待確認起採集/);assert.match(html,/<b>—<\/b><p>0 \/ 0局/);
  assert.match(html,/平均 64\.5K/,'all-run salary remains independent from the new sample count');
  noSpoilers(html);
 });
}

test('departure chart rejects incomplete partitions, unsafe counts and unknown categories without displaying incoming text',()=>{
 const mutations=[
  ['missing field',data=>delete data.observatory.departureWays],
  ['null field',data=>{data.observatory.departureWays=null;}],
  ['non-array field',data=>{data.observatory.departureWays={voluntary:10};}],
  ['missing category',data=>data.observatory.departureWays.pop()],
  ['extra category',data=>data.observatory.departureWays.push({id:'PRIVATE-EXTRA',count:0})],
  ['duplicate category',data=>{data.observatory.departureWays[1].id='voluntary';}],
  ['unknown category',data=>{data.observatory.departureWays[1].id='<img src=x onerror=PRIVATE-UNKNOWN>'; }],
  ['null row',data=>{data.observatory.departureWays[1]=null;}],
  ['negative count',data=>{data.observatory.departureWays[0].count=-1;}],
  ['fractional count',data=>{data.observatory.departureWays[0].count=3.5;}],
  ['NaN count',data=>{data.observatory.departureWays[0].count=NaN;}],
  ['infinite count',data=>{data.observatory.departureWays[0].count=Infinity;}],
  ['string count',data=>{data.observatory.departureWays[0].count='3';}],
  ['unsafe integer count',data=>{data.observatory.departureWays[0].count=Number.MAX_SAFE_INTEGER+1;}],
  ['count exceeds total',data=>{data.observatory.departureWays[0].count=11;}],
  ['sum below total',data=>{data.observatory.departureWays[0].count=2;}],
  ['sum exceeds total',data=>{data.observatory.departureWays[0].count=4;}],
  ['missing total',data=>delete data.totalRuns],
  ['string total',data=>{data.totalRuns='10';}],
  ['negative total',data=>{data.totalRuns=-10;}],
  ['unsafe integer total',data=>{data.totalRuns=Number.MAX_SAFE_INTEGER+1;}]
 ];
 for(const [name,mutate] of mutations){
  const data=response();mutate(data);
  const before=structuredClone(data),panel=harness(false,data).departure(data);
  assert.match(panel,/這份工作，怎麼結束的？/,name);
  assert.match(panel,/尚未提供|等待|待補/,name);
  assert.doesNotMatch(panel,/class="bar-row"|class="observatory-departure-row"|0\.0%|PRIVATE-|<img|onerror|undefined|NaN|Infinity/,name);
  assert.deepEqual(data,before,`${name}: no input repair or mutation`);noSpoilers(panel);
 }
});

test('departure chart uses canonical labels and order rather than arbitrary API labels or ending identities',()=>{
 const data=response(),app=harness(false,data);
 for(const row of data.observatory.departureWays){row.label='<script>PRIVATE-LABEL</script>';row.title='PRIVATE-TITLE';row.endingId='PRIVATE-ENDING';}
 data.observatory.departureWays.reverse();
 data.endings=[{id:'PRIVATE-ENDING',title:'PRIVATE-SPOILER',count:99}];
 const before=JSON.stringify(data),panel=app.departure(data);
 assert.match(panel,/30\.0%/);assert.doesNotMatch(panel,/PRIVATE-|<script|尚未提供/);
 let previous=-1;
 for(const [,label] of departureDefinitions){const at=panel.indexOf(escape(label));assert(at>previous,`${label} keeps canonical chart order`);previous=at;}
 assert.equal(JSON.stringify(data),before);noSpoilers(panel);
});

test('observatory optional charts reject malformed, duplicate, missing and private-labelled categories without printing incoming text',async()=>{
 const data=response(),model=data.observatory;
 model.actualRoles.push({id:'<img src=x onerror=alert(1)>',label:'private-person',count:9});
 model.endingTypes=[{id:'good',count:3},{id:'good',count:4},{id:'bad',count:2},{id:'secret',count:1}];
 model.tenure[0].count=-1;model.salary.bands[2].count=Infinity;model.experiences.pip=40;
 model.trackingSince='<script>private-source</script>';model.reassignments=11;
 data.daily.push({date:'<img src=x>',count:3},{date:'2026-10-22',count:'3'});
 const html=await harness(false,data).render();
 assert.match(html,/這項分類資料尚未提供/);assert.match(html,/經歷分類資料尚未提供/);
 assert.match(html,/日期待確認/);assert.match(html,/資料待補/);
 assert.doesNotMatch(html,/<script|onerror|private-person|private-source|private-ending/);
 noSpoilers(html);
});

test('observatory empty site preserves valid zero totals without inventing salary averages or activity',async()=>{
 const data=response();data.players=0;data.totalRuns=0;data.uniqueEndings=0;data.averageTurns=0;data.daily=[];
 data.roles=[];data.observatory.recordedRuns=0;data.observatory.unclassifiedRuns=0;
 data.observatory.career={full8:rankRows(8),legacy5:rankRows(5),special:idRows(['son','daughter'])};
 data.observatory.actualRoles=[];data.observatory.reassignments=0;
 data.observatory.endingTypes=idRows(['good','normal','bad','secret']);data.observatory.tenure=idRows(['1-3','4-7','8-12','13-19','20-24']);
 data.observatory.salary={average:0,bands:idRows(['under30','30-49','50-79','80-119','120plus'])};
 data.observatory.departureWays=departureRows();
 data.observatory.experiences={pip:0,promoted:0,payCut:0,collapse:0,appointed:0};
 const html=await harness(false,data).render();assert.match(html,/還沒有人完成/);assert.match(html,/還沒有每日遊玩紀錄/);
 assert.match(html,/平均 —/);assert.doesNotMatch(html,/平均 0\.0K/);noSpoilers(html);
});

test('observatory failure offers retry and a closed dialog is not filled after a late response',async()=>{
 const app=harness(false,response(),new Error('offline'));
 assert.match(await app.render(),/觀測站暫時休息/);assert.match(app.node.innerHTML,/data-action="stats"/);
 const late=harness(false,response());late.close();assert.equal(await late.render(),'');
});

test('observatory mobile CSS stacks comparison cards, retains numbers and confines only daily history scrolling',async()=>{
 const css=await readFile(new URL('../dist/style.css',import.meta.url),'utf8');
 const section=css.slice(css.indexOf('/* Anonymous observatory:'));
 assert.match(section,/@media\(max-width:560px\)/);
 assert.match(section,/\.observatory-chart-grid\{grid-template-columns:minmax\(0,1fr\)/);
 assert.match(section,/\.observatory-compact-bars\{grid-template-columns:minmax\(0,1fr\)/);
 assert.match(section,/\.observatory-experiences\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(section,/\.observatory \.daily-chart\{overflow-x:auto;max-width:100%/);
 assert.match(section,/\.observatory-panel\{min-width:0/);
 assert.match(section,/\.observatory-departures\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(section,/@media\(max-width:560px\)\{\.observatory-departures\{grid-template-columns:minmax\(0,1fr\)/);
 assert.match(section,/\.observatory-departure-heading>b\{flex-shrink:0/,'counts stay legible beside long departure labels');
});
