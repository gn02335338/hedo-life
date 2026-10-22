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
import * as transition from '../dist/ending-transition-v40.js';
import * as chapters from '../dist/chapters-v38.js';
import {renderEndingReport} from '../dist/ending-report-view.js';
import {polishDreamText} from '../dist/copy-v15.js';
import {displayContextVerbalHistoryV52} from '../dist/verbal-context-v52.js';

const appSource=(await readFile(new URL('../dist/app.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
const {routes}=JSON.parse(await readFile(new URL('../research/reachability-v3.json',import.meta.url),'utf8'));
const chapterRoutes=JSON.parse(await readFile(new URL('./fixtures/chapters-e38-routes.json',import.meta.url),'utf8')).routes;
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const plain=value=>JSON.parse(JSON.stringify(value));
const esc=value=>persona.displayText(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const routeFor=family=>routes.find(route=>route.target===family);
function complete(family){const route=routeFor(family);assert.ok(route,family);const run=engine.replayRun(route.roleId,route.seed,route.actions);assert.equal(run.completed,true);return run;}
function pending(family){
 const route=routeFor(family),action=route.actions.at(-1);assert.equal(action.type,'choice');
 const before=engine.replayRun(route.roleId,route.seed,route.actions.slice(0,-1));
 const run=engine.applyChoice(before,action.index);assert.equal(run.pending,true);assert.equal(run.completed,false);assert.equal(engine.advance(run).endingId,route.ending);
 return run;
}
const endingFor=run=>endings.ENDINGS.find(ending=>ending.id===run.endingId);

async function harness(mobile,initialRun=null){
 const nodes=new Map(),listeners=new Map(),calls={save:0,complete:0,characterProof:0,achievementProof:0};
 const store=new Map(initialRun?[['hedo-life-v3',JSON.stringify({run:initialRun,unlocked:initialRun.completed?[initialRun.endingId]:[],achievements:{}})]]:[]);
 const node=selector=>{
  if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',title:'',open:false,
   classList:{add(){},remove(){},toggle(){}},focus(){},setAttribute(){},scrollIntoView(){},addEventListener(){},
   showModal(){this.open=true;},close(){this.open=false;}
  });return nodes.get(selector);
 };
 const context=vm.createContext({...roles,...sources,...endings,...legacy,...engine,...achievements,...career,...currentCareer,...persona,...characterStats,...transition,...chapters,renderEndingReport,polishDreamText,
  createFeedbackUI:()=>({open(){}}),createCharacterBook:()=>({open(){},onSnapshot(){},onRunChanged(){}}),
  cloud:{state:{status:'offline',achievements:[],characters:[]},subscribe(){},init:async()=>null,
   achievementProgress:async()=>{calls.achievementProof++;return null;},characterProgress:async()=>{calls.characterProof++;return null;},complete:async()=>{calls.complete++;return null;}},
  localStorage:{getItem:key=>store.get(key)||null,setItem(key,value){calls.save++;store.set(key,value);}},
  document:{querySelector:node,addEventListener(type,callback){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(callback);}},
  window:{scrollTo(){},matchMedia:()=>({matches:mobile})},crypto:webcrypto,structuredClone,setTimeout:()=>1,clearTimeout(){}
 });
 vm.runInContext(appSource,context);await tick();for(const key of Object.keys(calls))calls[key]=0;
 async function action(action){
  const target={closest:selector=>selector==='[data-action]'?{dataset:{action}}:null};
  for(const callback of listeners.get('click')||[])await callback({target});await tick();
 }
 async function choice(index){
  const target={closest:selector=>selector==='[data-choice]'?{dataset:{choice:String(index)}}:null};
  for(const callback of listeners.get('click')||[])await callback({target,detail:1});await tick();
 }
 return {calls,action,choice,html:()=>node('#main').innerHTML,state:()=>vm.runInContext('run',context),saved:()=>JSON.parse(store.get('hedo-life-v3')||'null'),
  render(run){context.fixtureRun=run;vm.runInContext('run=fixtureRun;game(true)',context);return node('#main').innerHTML;},
  renderLoaded(){vm.runInContext('game(true)',context);return node('#main').innerHTML;},
  unlockedCollection(){node('#filter-role').value='all';node('#filter-status').value='unlocked';node('#filter-query').value='';vm.runInContext('readFilter()',context);return node('#ending-grid').innerHTML;},
  collectionIdOnly(id){context.onlyId=id;vm.runInContext('run=null;unlocked=[onlyId];records={[onlyId]:{departure38:true}};collection()',context);return this.unlockedCollection();},
  dialogHTML:()=>node('#dialog-content').innerHTML,node
 };
}

test('all published ending families have an explicit, read-only status without guessing a dismissal',()=>{
 for(const ending of endings.ENDINGS){
  const route=routes.find(route=>route.ending===ending.id);assert.ok(route,ending.id);
  const run=engine.replayRun(route.roleId,route.seed,route.actions),before=JSON.stringify(run);
  const model=transition.buildEndingTransition(run,ending);assert.ok(model?.employment.label,ending.id);
  assert.notEqual(model.employment.kind,'unspecified',ending.id);
  assert.ok(model.final?.choice,ending.id);assert.ok(model.final?.result,ending.id);
  assert.equal(JSON.stringify(run),before,ending.id);
 }
});

test('a real onboarding personnel reaction is a withdrawn appointment, even when its canonical family is layoff',()=>{
 let withdrawn;
 for(let i=0;i<100&&!withdrawn;i++){
  const spoken=engine.requestVerbal(engine.createRun('sales',`e37-transition-entry-${i}`),undefined,2);
  if(spoken.history.at(-1)?.verbalOutcome?.kind!=='personnel')continue;
  let next=engine.advance(spoken);next=engine.advance(engine.applyChoice(next,3));
  if(next.completed&&endingFor(next).family==='layoff')withdrawn=next;
 }
 assert.ok(withdrawn,'canonical no-PIP onboarding route');
 const model=transition.buildEndingTransition(withdrawn,endingFor(withdrawn));
 assert.equal(model.employment.kind,'offer-withdrawn');assert.match(model.employment.explanation,/沒有完成報到/);
 assert.equal(model.speech.target,'wing');assert.ok(model.speech.line);
});

test('special spoken finales distinguish retained employment, withdrawn offer and unresolved legal correspondence',()=>{
 const cases={verbal_onboarding:'offer-withdrawn',verbal_wing_concession:'employed',verbal_boardroom:'employed',verbal_rick_awake:'employed',verbal_hr_rewrite:'employed',verbal_legal_letter:'dispute-open',verbal_sonny_statement:'employed',verbal_kind_ghost:'employed',verbal_colleague_solidarity:'employed',verbal_viral:'new-chapter',verbal_mutual_mute:'employed',verbal_apology:'employed'};
 for(const [family,kind] of Object.entries(cases)){
  const run=complete(family),model=transition.buildEndingTransition(run,endingFor(run));
  assert.equal(model.employment.kind,kind,family);assert.ok(model.speech?.line,family);assert.ok(model.speech?.targetName,family);
  const source=run.history.findLast(row=>row.verbalOutcome);assert.equal(model.speech.target,source.verbalOutcome.target);
  const projected=displayContextVerbalHistoryV52(persona.displayChronicleHistory(source),{run,rawRow:source});
  assert.equal(model.speech.line,persona.displayText(projected.choiceText));
 }
 assert.equal(transition.buildEndingTransition(complete('rage_truce'),endingFor(complete('rage_truce'))).employment.kind,'employed');
 assert.equal(transition.buildEndingTransition(complete('google_ousted'),endingFor(complete('google_ousted'))).employment.kind,'company-chapter','Wing losing authority does not fire the player');
});

test('unfinished, pending and mismatched lives expose no future ending context',()=>{
 const fresh=engine.createRun('sales','e37-transition-privacy'),staged=pending('verbal_wing_concession');
 for(const run of [null,fresh,staged])for(const ending of endings.ENDINGS){
  assert.equal(transition.buildEndingTransition(run,ending),null);assert.equal(transition.renderEndingTransition(run,ending),'');
 }
 const run=complete('verbal_onboarding');assert.equal(transition.renderEndingTransition(run,endings.ENDINGS.find(ending=>ending.id!==run.endingId)),'');
});

for(const mobile of [false,true]){
 const device=mobile?'mobile':'desktop';
 for(const family of ['verbal_onboarding','verbal_wing_concession','layoff','ragequit','burnout','mediation_pending','google_ousted']){
  test(`${device}: ${family} reveals the committed cause and employment outcome before its ending, once`,async()=>{
   const run=pending(family),app=await harness(mobile);run.runId=webcrypto.randomUUID();app.render(run);
   const actions=run.actions.length,rng=run.rng,history=plain(run.history),expected=engine.advance(run),ending=endingFor(expected);
   await app.action('next');
   assert.equal(app.state().completed,true);assert.match(app.html(),/ending-transition-page/);assert.match(app.html(),/查看這次結局/);
   assert.match(app.html(),/data-employment-outcome=/);assert.ok(app.html().includes(esc(persona.displayChronicleHistory(history.at(-1)).result)));
   assert.doesNotMatch(app.html(),/ending-report|ending-art|class="ending-page"/);assert.ok(!app.html().includes(esc(ending.title)),'ending card stays behind the explicit continue');
   assert.equal(app.state().actions.length,actions);assert.equal(app.state().rng,expected.rng);assert.deepEqual(plain(app.state().history),history);
   assert.equal(app.calls.complete,1);assert.equal(engine.validRun(app.state()),true);
   const committed=JSON.stringify(app.state()),calls={...app.calls};await app.action('next');
   assert.equal(JSON.stringify(app.state()),committed);assert.deepEqual(app.calls,calls,'stale/double continue cannot re-complete or save again');
   await app.action('ending-continue');assert.match(app.html(),/class="ending-page"/);assert.match(app.html(),/ending-transition-context compact/);assert.match(app.html(),/ending-report/);
   assert.ok(app.html().includes(esc(ending.title)));assert.equal(JSON.stringify(app.state()),committed);assert.deepEqual(app.calls,calls,'acknowledgement is display-only');
   await app.action('ending-continue');assert.deepEqual(app.calls,calls);await app.action('home');await app.action('continue');
   assert.match(app.html(),/class="ending-page"/);assert.doesNotMatch(app.html(),/ending-transition-page/);
   assert.equal(app.state().actions.length,actions);assert.equal(engine.validRun(app.state()),true);
   if(expected.rng===rng)assert.equal(app.state().rng,rng,'no RNG is added by the transition');
  });
 }
 test(`${device}: direct reload of a completed life shows the causal status without save, RNG, proof or completion writes`,async()=>{
  const run=complete('verbal_mutual_mute'),app=await harness(mobile,run),before=JSON.stringify(app.state()),saved=app.saved();
  const html=app.renderLoaded();assert.match(html,/class="ending-page"/);assert.match(html,/data-employment-outcome="employed"/);assert.match(html,/薪水照領/);assert.match(html,/回看最後一幕的前因後果/);assert.match(html,/舊版篇章收尾 · 當時仍在職/);
  assert.equal(JSON.stringify(app.state()),before);assert.deepEqual(app.saved(),saved);assert.deepEqual(app.calls,{save:0,complete:0,characterProof:0,achievementProof:0});
 });
 test(`${device}: a new spoken milestone stays playable; only the explicit departure reaches its retrospective ending`,async()=>{
  const route=chapterRoutes.find(route=>route.target==='verbal_wing_concession'&&route.roleId==='sales');
  const staged=engine.replayRun(route.roleId,route.seed,route.actions.slice(0,-1)),ending=endings.ENDINGS.find(ending=>ending.id===route.ending);
  const stillWorking=await harness(mobile),before=JSON.stringify(staged),html=stillWorking.render(staged);
  assert.match(html,/你還沒有離職|還沒下班/);assert.match(html,/繼續上班/);assert.match(html,/提出離職/);assert.doesNotMatch(html,/ending-page|ending-report|data-employment-outcome/);
  assert.ok(!html.includes(esc(ending.title)));assert.equal(JSON.stringify(staged),before);assert.equal(stillWorking.calls.complete,0);
  await stillWorking.choice(0);assert.equal(stillWorking.state().pending,true);assert.equal(stillWorking.state().completed,false);
  await stillWorking.action('next');assert.equal(stillWorking.state().completed,false);assert.equal(stillWorking.state().chapterContext,null);assert.equal(stillWorking.calls.complete,0);
  assert.doesNotMatch(stillWorking.html(),/ending-page|ending-transition-page|ending-report/);
  const leaving=await harness(mobile);leaving.render(staged);await leaving.choice(1);
  assert.equal(leaving.state().pending,true);assert.equal(leaving.calls.complete,0);assert.match(leaving.html(),/明確提出離職/);
  assert.match(leaving.html(),/離職的意思，你已經說清楚/);assert.doesNotMatch(leaving.html(),/剛才那場風波有了收尾，但你還沒有離職/);
  await leaving.action('next');assert.equal(leaving.calls.complete,1);assert.match(leaving.html(),/ending-transition-page/);assert.match(leaving.html(),/data-employment-outcome="voluntary"/);
  assert.match(leaving.html(),/那場風波先有了這個收尾/);assert.match(leaving.html(),/翅膀把原本的要求收回一截/);assert.match(leaving.html(),/這件事結束時，你還沒有離職/);
  await leaving.action('ending-continue');const card=leaving.html();
  assert.match(card,/class="ending-page"/);assert.match(card,/這次，才是這段任職的最後一天/);assert.match(card,/離職前的篇章回顧（當時仍在職）/);assert.match(card,/並非目前的任職狀態/);
  assert.doesNotMatch(card,/THE MOVING LIFE \/ 000/);assert.ok(card.includes(esc(persona.displayText(ending.body))),'the profession-specific earlier episode is retained as an explicit retrospective');
  await leaving.action('collection');assert.match(leaving.unlockedCollection(),/確認交接|確認離職|任職的最後一天/);
  assert.equal(leaving.saved().records[route.ending].departure38,undefined,'a bare collection ID is not stored as canonical departure proof');
 });
 test(`${device}: reloading an open or pending chapter preserves exact replay data and cannot unlock its unchosen ending`,async()=>{
  const route=chapterRoutes.find(route=>route.target==='verbal_mutual_mute'&&route.roleId==='design');
  const staged=engine.replayRun(route.roleId,route.seed,route.actions.slice(0,-1));
  for(const run of [staged,engine.applyChoice(staged,0),engine.applyChoice(staged,1)]){
   assert.equal(engine.validRun(plain(run)),true);const app=await harness(mobile,run),before=JSON.stringify(app.state()),saved=app.saved();
   const html=app.renderLoaded();assert.doesNotMatch(html,/ending-page|ending-transition-page|ending-report/);
   assert.equal(JSON.stringify(app.state()),before);assert.deepEqual(app.saved(),saved);assert.equal(app.calls.save,0);assert.equal(app.calls.complete,0);
  }
 });
 test(`${device}: locked collection cards and uncommitted choices never receive a causal status or future final sentence`,async()=>{
  const run=engine.createRun('sales',`e37-transition-unplayed-${device}`),app=await harness(mobile),html=app.render(run);
  assert.doesNotMatch(html,/data-employment-outcome|ending-transition-context|查看這次結局/);
  await app.action('collection');const cards=app.node('#ending-grid').innerHTML;
  assert.match(cards,/ending-card locked/);assert.doesNotMatch(cards,/data-employment-outcome|ending-cause|ending-transition|仍在職|任用已/);
 });
 test(`${device}: an ID-only collection never manufactures a new-cohort resignation from an old record`,async()=>{
  const ending=endings.ENDINGS.find(ending=>ending.family==='verbal_wing_concession'),app=await harness(mobile),html=app.collectionIdOnly(ending.id);
  assert.ok(html.includes(esc(ending.body)));assert.match(html,/篇章收藏 · 不另推定離職方式/);
  assert.doesNotMatch(html,/這次，才是這段任職的最後一天|你已明確提出離職|data-employment-outcome="voluntary"/);
  assert.equal(app.calls.complete,0);assert.equal(app.calls.save,0);
 });
}
