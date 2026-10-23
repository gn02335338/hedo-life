import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as E from '../dist/engine.js';
import * as balance from '../dist/life-balance-v62.js';
import {renderWorkGapHTMLV50} from '../dist/work-gap-ui-v50.js';

const text=html=>html.replace(/<[^>]+>/g,'');
const state=(mood,energy,extra={})=>({day:8,stats:{mood,energy,cash:63},warningRest:true,moodRest:true,restAllowed:true,continueChoiceHTML:'<button type="button" data-choice="0">繼續上班</button>',...extra});

test('r62 intervals identify the current mood, energy or joint warning at the inclusive 30 boundary',()=>{
 for(const [mood,energy,kind,heading]of [[30,80,'mood','心情進入警告'],[80,30,'energy','體力進入警告'],[30,30,'both','心情、體力都偏低'],[1,29,'both','心情、體力都偏低']]){
  const html=renderWorkGapHTMLV50(state(mood,energy));
  assert.match(html,/data-work-gap/);assert.match(html,/data-mood-rest/);assert.ok(html.includes(`data-rest-state="${kind}"`));assert.ok(html.includes(heading));
  assert.match(html,/DAY 08 \/ 工作空檔/);assert.match(html,/data-gap-stat="mood"/);assert.match(html,/data-gap-stat="energy"/);assert.match(html,/data-action="break"/);assert.doesNotMatch(html,/data-action="break" disabled/);
  assert.match(text(html),/下一件工作還沒開始/);assert.doesNotMatch(text(html),/只有體力|體力也降到|體力回來一些|心情和體力都已回到/);
 }
});

test('recovering one resource does not call the other recovered, and full recovery retains the same interval',()=>{
 const moodOnly=renderWorkGapHTMLV50(state(22,76,{restAllowed:false})),energyOnly=renderWorkGapHTMLV50(state(74,19,{restAllowed:false}));
 assert.match(moodOnly,/data-rest-state="mood"/);assert.match(moodOnly,/心情進入警告/);assert.doesNotMatch(moodOnly,/體力回來一些|都已回到警告範圍以上/);
 assert.match(energyOnly,/data-rest-state="energy"/);assert.match(energyOnly,/體力進入警告/);assert.doesNotMatch(energyOnly,/都已回到警告範圍以上/);
 const html=renderWorkGapHTMLV50(state(31,31,{restAllowed:false}));
 assert.match(html,/data-rest-state="recovered"/);assert.match(html,/狀態回來一些/);assert.match(html,/心情和體力都已回到警告範圍以上，這段空檔還沒結束/);assert.match(html,/狀態確認/);
 assert.match(html,/data-action="break" disabled aria-describedby="gap-rest-reason"/);assert.match(html,/心情或體力若仍在警告範圍/);assert.match(html,/繼續上班/);assert.doesNotMatch(html,/自動繼續|已經開始下一|已離開空檔/);
});

test('current meters and native controls remain readable and focusable without exposing the next scene or results',()=>{
 const input=state(14,27,{warningHTML:'<section data-resource-warning role="alert">目前狀態偏低</section>',mobileWorkbarHTML:'<nav class="mobile-workbar">心情 14 · 體力 27 · 存款 63</nav>',
  nextEvent:{title:'UNREVEALED_TITLE',speaker:'HIDDEN_PERSON',choices:[{text:'NEXT_CHOICE',result:'FUTURE_RESULT',delta:{mood:30}}]}}),before=JSON.stringify(input);
 const html=renderWorkGapHTMLV50(input);
 assert.equal(JSON.stringify(input),before);assert.match(html,/<article[^>]+tabindex="-1"/);assert.match(html,/aria-label="目前身心與存款"/);
 assert.match(html,/class="work-gap-stat critical" data-gap-stat="mood"/);assert.match(html,/class="work-gap-stat caution" data-gap-stat="energy"/);assert.match(html,/style="width:14%"/);assert.match(html,/style="width:27%"/);
 assert.match(html,/<button type="button" class="secondary" data-action="break"/);assert.match(html,/<button type="button" data-choice="0">繼續上班/);
 assert.match(html,/mobile-workbar/);assert.match(html,/data-resource-warning role="alert"/);assert.doesNotMatch(html,/UNREVEALED_TITLE|HIDDEN_PERSON|NEXT_CHOICE|FUTURE_RESULT|\+30|機率|成功率|保證恢復/);
 assert.equal((html.match(/<h1\b/g)||[]).length,1);assert.equal((html.match(/id="work-gap-rest-title"/g)||[]).length,1);
});

test('disabled reasons stay specific and escaped while untrusted numbers cannot inject markup',()=>{
 const html=renderWorkGapHTMLV50(state(25,55,{restAllowed:false,restReason:'<img src=x onerror=alert(1)>',stats:{mood:'<script>1</script>',energy:Infinity,cash:-5}}));
 assert.match(html,/disabled aria-describedby="gap-rest-reason"/);assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/);assert.doesNotMatch(html,/<img|<script|Infinity|-5/);
 assert.match(html,/data-gap-stat="mood"><span>自己心情<\/span><b>0/);assert.match(html,/data-gap-stat="energy"><span>體力<\/span><b>0/);
});

test('omitted or false moodRest preserves five published v50/r61 HTML snapshots byte for byte',()=>{
 const published=[
  [{},'7421b06b76799e677b767c65e6e121838e085acc84f9de20105de0fda843a227'],
  [{day:7,warningRest:false,stats:{energy:15,mood:24,cash:90},restAllowed:true},'b98dc34b4edc2f6cae1d6318849329dde781af3df87ad8dc0b71f2bf114c2302'],
  [{day:19,warningRest:true,stats:{energy:18,mood:44,cash:65},restAllowed:true,continueChoiceHTML:'<button data-choice="0">繼續上班</button>'},'43df006f61b51d9339257c22b76840f9fe33df4fe6121b8b08ebf19372ed68c5'],
  [{warningRest:true,stats:{energy:62,mood:14,cash:50}},'cc8d4bbf62471cd5e2ccf87aa127db339b6caf6561d8d78d051a2bbbf2fd1337'],
  [{warningRest:true,stats:{energy:31,mood:29,cash:0},restReason:'<script>reason</script>',warningHTML:'<aside>warning</aside>',mobileWorkbarHTML:'<nav>current state</nav>'},'a1c2f74ca1e0134fb15436bee7328fd8a7dea68622080dadc2cad2fd4e097df7'],
 ];
 for(const [input,hash]of published){
  const original=renderWorkGapHTMLV50(input),explicitFalse=renderWorkGapHTMLV50({...input,moodRest:false});
  assert.equal(createHash('sha256').update(original).digest('hex'),hash);assert.equal(explicitFalse,original);assert.doesNotMatch(original,/data-mood-rest|data-rest-state/);
 }
});

const appSource=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
const natural=JSON.parse(readFileSync(new URL('./fixtures/mood-rest-routes-v62.json',import.meta.url),'utf8')).routes;
function appHarness(mobile){
 const calls=[],nodes=new Map(),node=key=>{
  if(!nodes.has(key))nodes.set(key,{innerHTML:'',focus(){calls.push(`focus:${key}`);},scrollIntoView(){calls.push(`scroll:${key}`);}});return nodes.get(key);
 };
 const context=vm.createContext({...E,...balance,renderWorkGapHTMLV50,run:null,MAX_TURNS:E.MAX_TURNS,
  shareholderCleanupV58:null,activityPlayCleanupV55:null,patronagePickerContext:null,ragePickerContext:null,verbalPickerContext:null,gameViewRevision:0,screen:'game',main:node('#main'),$:node,
  window:{scrollTo(){calls.push('scroll:window');},matchMedia:()=>({matches:mobile})},isPersonnelNotice:()=>false,esc:String,STAT_LABELS:{mood:'自己心情',energy:'體力'},
  gameSidebarHTML:()=>'<aside class="game-sidebar"></aside>',activityReturnNotice:()=>'',eventDepartureControlV63:()=>'',
  mobileWorkbar:()=>`<nav class="mobile-workbar">心情 ${context.run.stats.mood} · 體力 ${context.run.stats.energy}</nav>`,
  choiceHTML:({c,i})=>`<button type="button" data-choice="${i}">${c.text}</button>`
 });
 const availability=appSource.slice(appSource.indexOf('function actionAvailability('),appSource.indexOf('function careerControl('));
 const warning=appSource.slice(appSource.indexOf('function resourceWarningHTML('),appSource.indexOf('function gameSidebarHTML('));
 const screen=appSource.slice(appSource.indexOf('function workGapScreen('),appSource.indexOf('function shareholderHoldingHTMLV58('));
 const view=appSource.slice(appSource.indexOf('function view('),appSource.indexOf('function schoolHTML('));
 vm.runInContext(`${availability}\n${warning}\n${screen}\n${view}`,context);
 return {context,calls,html:()=>node('#main').innerHTML,render(run,focus=true){calls.length=0;context.run=JSON.parse(JSON.stringify(run));context.workGapScreen(focus);}};
}
for(const mobile of [false,true])test(`${mobile?'mobile':'desktop'}: the actual app wires mood-only and recovered intervals with appropriate focus and no early rest or spoilers`,()=>{
 const app=appHarness(mobile);
 for(const [id,expected]of [['mood-only-gap','mood'],['paid-mood-recovery','recovered'],['cancel-mood-return','mood']]){
  const row=natural.find(row=>row.id===id),run=E.replayRun(row.roleId,row.seed,row.actions),saved=JSON.stringify(run);app.render(run);
  assert.ok(app.html().includes(`data-rest-state="${expected}"`));assert.match(app.html(),/data-mood-rest/);assert.match(app.html(),/mobile-workbar/);assert.match(app.html(),/data-choice="0">繼續上班/);
  assert.equal(app.calls.at(-1),mobile?'focus:.chapter':'focus:#main');assert.equal(JSON.stringify(app.context.run),saved,'rendering cannot close the interval, spend money or redraw');
  if(id==='mood-only-gap'){assert.match(app.html(),/心情進入警告/);assert.match(app.html(),/data-warning-stat="mood"/);assert.doesNotMatch(app.html(),/data-warning-stat="energy"|只有體力|體力也降到|惡言相向|受不了了/);}
  else assert.match(app.html(),/data-action="break" disabled aria-describedby="gap-rest-reason"/);
  assert.doesNotMatch(app.html(),/chanceOutcome|nextEvent|\+\d+|成功率/);app.render(run,false);assert.deepEqual(app.calls,[],'background repaint does not move keyboard focus or scroll position');
 }
 const row=natural.find(row=>row.id==='mood-only-gap'),source=E.replayRun(row.roleId,row.seed,row.beforeActions),pending=E.applyChoice(source,row.index);
 app.context.run=pending;const notice=app.context.resourceWarningHTML();assert.match(notice,/data-warning-stat="mood"/);assert.match(notice,/先看完這次結果/);assert.doesNotMatch(notice,/data-action="break"|只有體力|體力也降到/);
});
