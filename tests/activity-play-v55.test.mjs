import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import vm from 'node:vm';
import * as E from '../dist/engine.js';
import {ACTIVITY_IDS_V44} from '../dist/activities-v44.js';
import {isActivityPlayV55,deriveActivityPlayV55,getActivityPlayV55,resolveActivityPlayV55} from '../dist/activity-play-v55.js';
import {renderActivityPlayHTMLV55,mountActivityPlayV55} from '../dist/activity-play-ui-v55.js';
import {ROLE_MAP} from '../dist/roles.js';
import {ENDINGS} from '../dist/endings.js';
import {deriveCharacterStats} from '../dist/character-stats.js';
import {AchievementStore} from '../worker/achievements.js';
import {CharacterStore} from '../worker/characters.js';
import {ObservationStore} from '../worker/observations.js';
import {FeedbackStore} from '../worker/feedback-store.js';
import {validateFeedback,validatePublisherToken} from '../worker/feedback.js';
import * as http from '../worker/http.js';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/activity-play-routes-v55.json',import.meta.url),'utf8'));
const oldRoutes=JSON.parse(readFileSync(new URL('./fixtures/energy-safety-routes-v54.json',import.meta.url),'utf8')).routes;
const copy=value=>JSON.parse(JSON.stringify(value));
const route=id=>{const row=fixture.routes.find(row=>row.id===id);assert.ok(row,id);return row;};
const before=id=>{const row=route(id);return E.replayRun(row.roleId,row.seed,row.beforePlayActions);};
const strong=Object.freeze({
 arm:{kind:'arm',mode:'steady',taps:Array.from({length:8},(_,i)=>500+i*1000)},
 diet:{kind:'diet',days:Array.from({length:7},(_,i)=>({meal:i%2,exercise:i===2||i===5?2:i%2}))},
 roadshow:{kind:'roadshow',matches:[0,1,2,1,0,2]},
 dinner:{kind:'dinner',plates:[0,1,2,0,1,1]},
 banquet:{kind:'banquet',beats:Array.from({length:12},(_,i)=>500+i*600)},
 basketball:{kind:'basketball',moves:[0,2,1,2,0]},
 review:{kind:'review',evidence:[0,1,2,0]}
});
const weak=Object.freeze({
 arm:{kind:'arm',mode:'tap',taps:[]},
 diet:{kind:'diet',days:Array.from({length:7},()=>({meal:2,exercise:2}))},
 roadshow:{kind:'roadshow',matches:[2,2,0,0,1,1]},
 dinner:{kind:'dinner',plates:[3,3,3,3,3,3]},
 banquet:{kind:'banquet',beats:[]},
 basketball:{kind:'basketball',moves:[1,1,1,1,1]},
 review:{kind:'review',evidence:[2,2,1,1]}
});
const action=(run,input)=>({type:'activity-play',version:1,eventId:E.getEvent(run).id,index:1,input:copy(input)});
const proof=(run,actions=run.actions)=>({runId:'63512be4-e095-42d3-aad8-a11ccc295412',roleId:run.roleId,seed:run.seed,actions});
const replay=run=>E.replayRun(run.roleId,run.seed,run.actions);
const forbidden=run=>{assert.equal(E.canRequestBreak(run),false);assert.equal(E.requestBreak(run),run);};

test('seven interactive activities are reached by natural, refreshed calendar lives, with no injected state',()=>{
 assert.deepEqual(fixture.routes.map(row=>row.id).sort(),[...ACTIVITY_IDS_V44].sort());
 for(const row of fixture.routes){
  const run=before(row.id),snapshot=copy(run);
  assert.equal(run.seed.length,32,row.id);assert.equal(isActivityPlayV55(run),true,row.id);
  assert.equal(run.activityContext.id,row.id);assert.equal(run.activityContext.stage,1);assert.equal(run.pending,false);
  assert.equal(E.validRun(snapshot),true,row.id);assert.deepEqual(replay(snapshot),snapshot,row.id);
  for(let repeat=0;repeat<3;repeat++)assert.ok(getActivityPlayV55(run),row.id);
  assert.deepEqual(run,snapshot,'reading instructions never draws RNG or alters an activity');
  assert.equal(getActivityPlayV55({...run,pending:true}),null);
  assert.equal(getActivityPlayV55({...run,completed:true}),null);
  assert.equal(getActivityPlayV55({...run,activityContext:{...run.activityContext,stage:0}}),null);
  assert.equal(getActivityPlayV55({...run,seed:run.seed.replace('-s-m-','-s-')}),null);
 }
});

for(const id of ACTIVITY_IDS_V44)test(`${id}: actual controls commit once, reveal a result, survive refresh and return to the original work event`,()=>{
 const source=before(id),snapshot=copy(source),input=copy(strong[id]),pending=E.applyActivityPlay(source,input),last=pending.history.at(-1);
 assert.deepEqual(source,snapshot,'committing does not mutate the previous save');
 assert.equal(pending.pending,true);assert.equal(pending.pendingEffect,'activityContinue');
 assert.deepEqual(pending.actions.at(-1),action(source,input));assert.equal(pending.actions.length,source.actions.length+1);
 assert.equal(pending.activityContext.id,id);assert.equal(pending.activityContext.stage,1);
 assert.equal(last.kind,'activity');assert.equal(last.activityOutcome.id,id);assert.equal(last.activityOutcome.stage,1);
 assert.ok(last.result.length>25);assert.ok(last.breakdown.length>0,'the revealed ledger records actual resource effects');
 assert.equal(E.validRun(pending),true,'the already committed result is a valid save');
 assert.equal(E.validRun(copy(pending)),true,'JSON refresh preserves the result');
 forbidden(source);forbidden(pending);assert.equal(getActivityPlayV55(pending),null);
 for(const key of ['turn','pay','pip','pipCount'])assert.deepEqual(pending[key],source[key],`${id}/${key}`);
 const next=E.advance(copy(pending));assert.deepEqual(replay(pending),next,'server replay resolves exactly the same input and one result');
 assert.equal(E.validRun(next),true);assert.equal(next.activityContext.stage,2);assert.equal(next.turn,source.turn);
 assert.equal(next.rng,pending.rng,'revealing the next stage cannot draw another minigame outcome');
 assert.equal(getActivityPlayV55(next),null);forbidden(next);
 let run=next,stages=0;
 while(run.activityContext){
  assert.ok(stages++<3,`${id}: activity ends`);
  const index=E.getEvent(run).choices.findIndex(choice=>choice.available!==false);
  const result=E.applyChoice(run,index);forbidden(result);assert.equal(E.validRun(result),true);
  run=E.advance(copy(result));assert.equal(E.validRun(run),true);
 }
 assert.equal(run.eventId,source.activityContext.returnEventId);assert.equal(run.completed,false);
 assert.equal(run.turn,source.turn);assert.equal(run.pay,source.pay);assert.deepEqual(run.pip,source.pip);
 assert.equal(run.flags[`activity44_${id}`],1);assert.deepEqual(replay(run),run);
 if(run.stats.energy<=30&&run.stats.energy>0&&run.stats.mood>0&&run.stats.cash>0&&run.lastBreakTurn!==run.turn){
  assert.equal(E.isWorkGapOpenV50(run),true,'a warning waits for the entire activity to finish');
  assert.equal(E.canRequestBreak(run),true);
 }
});

test('performance is derived from raw controls, bounded and meaningful for every activity',()=>{
 for(const id of ACTIVITY_IDS_V44){
  const good=deriveActivityPlayV55(copy(strong[id]),id),poor=deriveActivityPlayV55(copy(weak[id]),id);
  assert.deepEqual(good.input,strong[id]);assert.ok(Number.isInteger(good.grade)&&good.grade>=0&&good.grade<=2,id);
  assert.ok(good.grade>poor.grade,`${id}: intentional play beats an empty, mismatched or unsafe plan`);
  assert.ok(Number.isFinite(good.score),id);assert.ok(typeof good.summary==='string'&&good.summary.length>4,id);
  const source=before(id),best=E.applyActivityPlay(source,strong[id]),worst=E.applyActivityPlay(source,weak[id]);
  assert.notDeepEqual(best.history.at(-1),worst.history.at(-1),`${id}: controls affect the actual revealed result`);
  for(const pending of [best,worst]){assert.equal(E.validRun(pending),true);assert.deepEqual(replay(pending),E.advance(pending));}
 }
 const rice={kind:'dinner',plates:[0,0,0,0,0,0]},rest={kind:'diet',days:Array.from({length:7},()=>({meal:0,exercise:2}))};
 assert.ok(deriveActivityPlayV55(rice,'dinner').grade<2,'six plates of rice cannot replace a varied shared menu');
 assert.ok(deriveActivityPlayV55(rest,'diet').grade<2,'a mixed calendar plays differently from seven identical rest days');
 assert.match(resolveActivityPlayV55(before('dinner'),rice,.5).result,/白飯一盤接一盤/,'the actual menu is reflected in the result');
});

test('seven control panels have distinct interaction boards, disabled initial submission and no previewed outcome',()=>{
 const boards={arm:/arm-arena/,diet:/diet-calendar/,roadshow:/road-visitor-list/,dinner:/dinner-plates/,banquet:/song-beat-sheet/,basketball:/basket-court/,review:/review-board/};
 for(const id of ACTIVITY_IDS_V44){
  const source=before(id),html=renderActivityPlayHTMLV55(source,E.getEvent(source));
  assert.match(html,new RegExp(`data-activity-play-v55="${id}"`));assert.match(html,boards[id]);
  assert.match(html,/data-play-command="commit" disabled/);assert.match(html,/role="status" aria-live="polite"/);
  assert.match(html,/交出後才揭曉|劇情結果還沒揭曉/);assert.doesNotMatch(html,/grade|injuryTarget|chanceOutcome|successRate|機率\s*\d|好感\s*[+-]\d/);
  assert.equal(renderActivityPlayHTMLV55({...source,pending:true},E.getEvent(source)),'');
  assert.equal(renderActivityPlayHTMLV55(source,{id:'onboarding'}),'');
 }
 const arm=before('arm'),armHTML=renderActivityPlayHTMLV55(arm,E.getEvent(arm));
 assert.match(armHTML,/穩定八拍/);assert.match(armHTML,/<button type="button" data-play-command="start"/);assert.match(armHTML,/開始八秒對決/);
 const song=before('banquet');assert.match(renderActivityPlayHTMLV55(song,E.getEvent(song)),/輪流接十二拍/);
});

// A minimal event/clock surface tests controller commitments, not browser
// layout. Real desktop/touch interactions are checked separately in the app.
function controls(id){
 const source=before(id),events=new Map(),documentEvents=new Map(),frames=new Map(),nodes=new Map(),commits=[];
 let clock=0,frameId=0;
 const node=selector=>{if(!nodes.has(selector))nodes.set(selector,{textContent:'',innerHTML:'',style:{},firstElementChild:{style:{}},classList:{toggle(){}},setAttribute(){},focus(){},disabled:false});return nodes.get(selector);};
 const doc={activeElement:null,hidden:false,addEventListener:(type,fn)=>documentEvents.set(type,fn),removeEventListener:(type,fn)=>{if(documentEvents.get(type)===fn)documentEvents.delete(type);},defaultView:{performance:{now:()=>clock},requestAnimationFrame:fn=>{frames.set(++frameId,fn);return frameId;},cancelAnimationFrame:id=>frames.delete(id)}};
 const panel={ownerDocument:doc,innerHTML:'',matches:()=>true,contains:()=>true,querySelector:node,querySelectorAll:()=>[],addEventListener:(type,fn)=>events.set(type,fn),removeEventListener:(type,fn)=>{if(events.get(type)===fn)events.delete(type);}};
 panel.innerHTML=renderActivityPlayHTMLV55(source,E.getEvent(source));
 const cleanup=mountActivityPlayV55({root:panel,run:source,event:E.getEvent(source),onCommit:input=>commits.push(input)});
 const target=(command,value)=>({dataset:{playCommand:command,...(value===undefined?{}:{playValue:String(value)})},disabled:false});
 const click=(command,value)=>{const button=target(command,value);events.get('click')?.({target:{closest:()=>button},stopPropagation(){}});};
 return{source,panel,events,documentEvents,frames,commits,cleanup,click,doc,setClock:value=>clock=value,flush(value){clock=value;const callbacks=[...frames.values()];frames.clear();for(const callback of callbacks)callback(value);},repeat(){let stopped=false;events.get('keydown')?.({repeat:true,key:' ',target:{closest:()=>target('arm-tap')},preventDefault(){stopped=true;}});return stopped;}};
}

test('controller records all seven real control sequences, rejects premature/duplicate submit and cleans listeners',()=>{
 for(const id of ACTIVITY_IDS_V44){
  const ui=controls(id),snapshot=copy(ui.source);ui.click('commit');assert.equal(ui.commits.length,0,id);
  if(id==='arm'){
   ui.click('arm-mode',1);ui.click('start');
   for(let i=0;i<8;i++){ui.setClock(100+i*100);ui.click('arm-tap');}
  }else if(id==='diet'){
   ui.click('diet-meal',0);ui.click('diet-exercise',0);ui.click('diet-copy');
   for(const i of [2,5]){ui.click('diet-day',i);ui.click('diet-exercise',2);}
  }else if(id==='roadshow')for(const [i,value]of strong.roadshow.matches.entries()){ui.click('road-visitor',i);ui.click('road-match',value);}
  else if(id==='dinner')for(const [i,value]of strong.dinner.plates.entries()){ui.click('dinner-slot',i);ui.click('dinner-dish',value);}
  else if(id==='banquet'){
   ui.click('start');for(const stamp of strong.banquet.beats){ui.setClock(stamp);ui.click('song-hit');}
   ui.click('commit');assert.equal(ui.commits.length,0,'a timed song finishes before submission');ui.flush(7800);
  }else if(id==='basketball')for(const value of strong.basketball.moves)ui.click('basket-move',value);
  else for(const [i,value]of strong.review.evidence.entries()){ui.click('review-question',i);ui.click('review-file',value);}
  assert.deepEqual(ui.source,snapshot,'local play leaves the saved engine untouched until commit');
  ui.click('commit');ui.click('commit');assert.equal(ui.commits.length,1,id);
  const committed=ui.commits[0];assert.equal(committed.kind,id);assert.equal(deriveActivityPlayV55(committed,id).grade,2,id);
  const result=E.applyActivityPlay(ui.source,committed);assert.equal(E.validRun(result),true,id);
  ui.cleanup();assert.equal(ui.events.size,0);assert.equal(ui.documentEvents.size,0);assert.equal(ui.frames.size,0);
  ui.click('commit');assert.equal(ui.commits.length,1,'a removed view cannot post an old round');
 }
});

test('timed controls begin only on Start, ignore keyboard hold, reset on hiding and never auto-submit',()=>{
 const ui=controls('arm');assert.equal(ui.frames.size,0);assert.equal(ui.repeat(),true);
 ui.click('start');assert.equal(ui.frames.size,1);ui.setClock(250);ui.click('arm-tap');
 ui.doc.hidden=true;ui.documentEvents.get('visibilitychange')();assert.equal(ui.frames.size,0);
 assert.match(ui.panel.innerHTML,/暫離了畫面/);assert.match(ui.panel.innerHTML,/開始八秒對決/);assert.equal(ui.commits.length,0);
 ui.doc.hidden=false;ui.click('start');ui.setClock(600);ui.click('arm-tap');ui.click('reset');
 assert.equal(ui.frames.size,0);assert.match(ui.panel.innerHTML,/開始八秒對決/);assert.equal(ui.commits.length,0);
 ui.cleanup();
});

test('the eight-second rapid-click arm round submits measured taps rather than a client-supplied win',()=>{
 const ui=controls('arm');ui.click('start');
 for(let i=1;i<=28;i++){ui.setClock(i*250);ui.click('arm-tap');}
 ui.click('commit');assert.equal(ui.commits.length,0,'clicking is still in progress before the clock ends');
 ui.flush(8000);assert.equal(ui.commits.length,0,'the timer reveals no result until the player submits');ui.click('commit');
 const input=ui.commits[0];assert.deepEqual(input,{kind:'arm',mode:'tap',taps:Array.from({length:28},(_,i)=>(i+1)*250)});
 assert.equal(deriveActivityPlayV55(input,'arm').grade,2);
 const pending=E.applyActivityPlay(ui.source,input);assert.equal(E.validRun(pending),true);assert.deepEqual(replay(pending),E.advance(pending));
 assert.match(pending.history.at(-1).result,/28 次/);assert.ok(!Object.hasOwn(pending.actions.at(-1).input,'score'));
 ui.cleanup();
});

test('the app choice handler ignores ordinary number shortcuts during an interactive round and preserves normal choices',()=>{
 const app=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8'),start=app.indexOf('function choose('),end=app.indexOf('function catchUpActivityInvitation(',start);
 assert.ok(start>=0&&end>start,'exercise the actual app choice handler');
 const calls={apply:0,save:0,render:0,proof:0,achievements:0};
 const context=vm.createContext({screen:'game',run:before('arm'),dialog:{open:false},gameViewRevision:7,getActivityPlayV55,getEvent:E.getEvent,
  usesWorkGap:()=>false,applyChoice(run,index){calls.apply++;return E.applyChoice(run,index);},advance:E.advance,
  catchUpStartingSalaryAdvice(){},catchUpActivityInvitation(){},catchUpHiddenEncounter(){},
  collectAchievements(){calls.achievements++;},syncCharacterProof(){calls.proof++;},save(){calls.save++;},game(){calls.render++;}
 });
 vm.runInContext(app.slice(start,end),context);
 for(const id of ACTIVITY_IDS_V44){
  context.run=before(id);const snapshot=copy(context.run);
  for(const index of [0,1,2])assert.equal(vm.runInContext(`choose(${index})`,context),false,id);
  assert.deepEqual(context.run,snapshot,`${id}: ordinary shortcuts cannot mutate or advance a control panel`);
 }
 assert.deepEqual(calls,{apply:0,save:0,render:0,proof:0,achievements:0});
 const old=E.createRun('system','e39-shortcut-safe'),snapshot=copy(old);context.run=old;
 assert.equal(vm.runInContext('choose(0)',context),true,'ordinary story choices still work');
 assert.deepEqual(old,snapshot,'the original save remains untouched');assert.equal(context.run.pending,true);assert.equal(context.run.actions.length,old.actions.length+1);
 assert.deepEqual(calls,{apply:1,save:1,render:1,proof:1,achievements:1});assert.equal(E.validRun(context.run),true);
});

const malformed=()=>[
 null,[],{},'arm',{kind:'missing'},{...strong.arm,score:100},{...strong.arm,grade:2},{...strong.arm,outcome:'win'},
 {kind:'arm',mode:'tap',taps:Array(101).fill(1)},
 {kind:'arm',mode:'tap',taps:[0,0]},{kind:'arm',mode:'tap',taps:[20,10]},
 {kind:'arm',mode:'tap',taps:[-1]},{kind:'arm',mode:'tap',taps:[8001]},
 {kind:'arm',mode:'tap',taps:[1.5]},{kind:'arm',mode:'tap',taps:[null]},
 {kind:'arm',mode:'rapid',taps:[10]},{kind:'arm',mode:'steady',taps:[10]},
 {kind:'diet',days:Array(6).fill({meal:0,exercise:0})},
 {kind:'diet',days:Array(8).fill({meal:0,exercise:0})},
 {kind:'diet',days:Array(7).fill({meal:0,exercise:3})},
 {kind:'diet',days:Array(7).fill({meal:0,exercise:0,weight:50})},
 {kind:'diet',days:Array(7).fill({meal:'0',exercise:0})},
 {kind:'roadshow',matches:[0,1,2,1,0]},{kind:'roadshow',matches:[0,1,2,1,0,3]},
 {kind:'dinner',plates:[0,1,2,0,1]},{kind:'dinner',plates:[0,1,2,0,1,4]},
 {kind:'banquet',beats:Array(13).fill(1)},{kind:'banquet',beats:[7801]},
 {kind:'banquet',beats:[0,0]},{kind:'banquet',beats:[1.5]},
 {kind:'basketball',moves:[0,1,2,0]},{kind:'basketball',moves:[0,1,2,0,3]},
 {kind:'review',evidence:[0,1,2]},{kind:'review',evidence:[0,1,2,-1]}
];

test('malformed, oversized, client-graded and cross-activity control payloads fail strict derivation',()=>{
 for(const input of malformed())assert.throws(()=>deriveActivityPlayV55(input,input?.kind),'only exact bounded raw inputs are accepted');
 for(const id of ACTIVITY_IDS_V44)for(const other of ACTIVITY_IDS_V44.filter(other=>other!==id))assert.throws(()=>deriveActivityPlayV55(strong[id],other));
 const source=before('arm');for(const input of malformed())assert.throws(()=>E.applyActivityPlay(source,input));
 const tiny={kind:'arm',mode:'tap',taps:[0,1,2,3,4,5,6,7]};
 assert.throws(()=>deriveActivityPlayV55(tiny,'arm'),'an impossible single burst cannot masquerade as sustained participation');
 const strained={kind:'arm',mode:'tap',taps:Array.from({length:60},(_,i)=>i*100)};
 assert.ok(deriveActivityPlayV55(strained,'arm').score<deriveActivityPlayV55(strong.arm,'arm').score,'frantic but plausible tapping incurs fatigue instead of always beating steady play');
});

test('wrong stage, stale event, duplicate submission and forged save results cannot bypass canonical replay',()=>{
 const source=before('arm'),valid=action(source,strong.arm),after=E.advance(E.applyActivityPlay(source,strong.arm));
 for(const index of [0,1,2]){
  assert.throws(()=>E.applyChoice(source,index),'normal route choices cannot bypass the interactive round');
  assert.throws(()=>E.replayRun(source.roleId,source.seed,[...source.actions,{type:'choice',eventId:E.getEvent(source).id,index}]));
 }
 for(const patch of [{eventId:'activity44-arm-0'},{index:0},{index:2},{version:2},{version:'1'},{grade:2},{score:999},{result:'won'},{input:{...strong.arm,grade:2}}]){
  assert.throws(()=>E.replayRun(source.roleId,source.seed,[...source.actions,{...valid,...patch}]));
 }
 assert.throws(()=>E.replayRun(source.roleId,source.seed,[...after.actions,valid]),'a stale second submission cannot award another result');
 assert.equal(E.applyActivityPlay(after,strong.arm),after,'later activity stages have no interactive control input');
 const prefix=source.actions.slice(0,-1),stage0=E.replayRun(source.roleId,source.seed,prefix);
 assert.equal(E.applyActivityPlay(stage0,strong.arm),stage0,'minigames cannot skip scene setup');
 const old=E.replayRun(oldRoutes[0].roleId,oldRoutes[0].seed,oldRoutes[0].actions);
 assert.equal(E.applyActivityPlay(old,strong.arm),old,'published cohorts retain their original controls');
 const pending=E.applyActivityPlay(source,strong.arm);
 for(const mutate of [run=>run.stats.mood=(run.stats.mood+1)%101,run=>run.history.at(-1).result+=' forged',run=>run.history.at(-1).activityOutcome.score=99,run=>run.actions.at(-1).input.taps.push(7999)]){
  const forged=copy(pending);mutate(forged);assert.equal(E.validRun(forged),false);
 }
});

test('good play improves the drawn result without guaranteeing victory, and risky drives raise collision risk',()=>{
 const arm=before('arm'),basketball=before('basketball'),ticks=Array.from({length:100},(_,i)=>(i+.5)/100);
 const armLabels=new Set(ticks.map(ticket=>resolveActivityPlayV55(arm,strong.arm,ticket).label));
 assert.equal(armLabels.size,2,'even a perfect eight-beat round has more than one result');
 const evaluate=input=>ticks.map(ticket=>resolveActivityPlayV55(basketball,input,ticket));
 const safe=evaluate(strong.basketball),risky=evaluate(weak.basketball);
 const safeHits=safe.filter(row=>row.performance.injured).length,riskyHits=risky.filter(row=>row.performance.injured).length;
 assert.ok(safeHits>=1&&safeHits<=10,'finding the open player reduces but does not abolish fictional collision risk');
 assert.ok(riskyHits>safeHits&&riskyHits<=35,'five crowded drives carry a clear, bounded extra risk');
 assert.deepEqual([...new Set(risky.filter(row=>row.performance.injured).map(row=>row.performance.injuryTarget))].sort(),['owen','sonny']);
 for(const row of risky.filter(row=>row.performance.injured)){
  assert.equal(row.delta.energy,-18);assert.match(row.result,/移動迷宮|飛天拐子/);assert.match(row.result,/叫停|候補上場/);
 }
 const noDrive={kind:'basketball',moves:[0,0,0,0,0]},incidental=resolveActivityPlayV55(basketball,noDrive,0);
 assert.equal(incidental.performance.injured,true);assert.match(incidental.result,/換位/);assert.doesNotMatch(incidental.result,/你切進|你和歐文同時衝向禁區/,'incidental contact cannot invent a drive the player never chose');
});

test('natural basketball lives reproduce both safe returns and Sonny/Owen injuries without exposing another rest mid-match',()=>{
 assert.ok(fixture.basketballWitnesses.length>=24);const injuries=new Set();let hurt=0;
 for(const witness of fixture.basketballWitnesses){
  const source=E.replayRun(witness.roleId,witness.seed,witness.beforePlayActions),pending=E.applyActivityPlay(source,weak.basketball);
  const performance=pending.history.at(-1).activityOutcome.performance;
  assert.equal(E.validRun(pending),true);forbidden(pending);assert.deepEqual(replay(pending),E.advance(pending));
  if(performance.injured){
   hurt++;injuries.add(performance.injuryTarget);const final=E.advance(pending);forbidden(final);
   assert.match(E.getEvent(final).body,/場邊|候補/);assert.equal(final.activityContext.performance.injured,true);
   const ending=E.applyChoice(final,0);forbidden(ending);assert.equal(ending.history.at(-1).activityOutcome.done,true);
   assert.ok(ending.history.at(-1).delta.energy>=-1,'the injured player stays off court for the last possession');
  }
 }
 assert.ok(hurt>0&&hurt<fixture.basketballWitnesses.length*.75,'a rough game sometimes hurts, but not every life');
 assert.deepEqual([...injuries].sort(),['owen','sonny'],'both character-specific collision stories can actually happen');
});

test('a natural warning that arrives during warm-up waits through the controls and final result, then opens timely rest',()=>{
 const source=fixture.basketballWitnesses.map(witness=>E.replayRun(witness.roleId,witness.seed,witness.beforePlayActions)).find(run=>run.stats.energy<=30&&run.flags.energy54_rest_owed===1);
 assert.ok(source,'a real warm-up crosses the warning threshold');forbidden(source);assert.equal(E.isWorkGapOpenV50(source),false);
 const pending=E.applyActivityPlay(source,weak.basketball);forbidden(pending);assert.ok(pending.stats.energy>0);
 const last=E.advance(pending);forbidden(last);assert.equal(E.isWorkGapOpenV50(last),false);assert.equal(last.activityContext.stage,2);
 const final=E.applyChoice(last,0);forbidden(final);assert.equal(final.history.at(-1).activityOutcome.done,true);
 const returned=E.advance(final);assert.equal(returned.activityContext,undefined);assert.ok(returned.stats.energy>0&&returned.stats.energy<=30);
 assert.equal(E.isWorkGapOpenV50(returned),true);assert.equal(E.canRequestBreak(returned),true);assert.equal(returned.flags.energy54_rest_owed,0);
 assert.equal(returned.turn,source.turn);assert.deepEqual(returned.pip,source.pip);assert.equal(returned.rng,final.rng);
 assert.equal(E.validRun(returned),true);assert.deepEqual(replay(returned),returned);
});

test('HTTP grammar accepts seven bounded traces and rejects supplied grades, extra fields and old cohorts',()=>{
 for(const id of ACTIVITY_IDS_V44){const source=before(id);assert.doesNotThrow(()=>http.validateCompletion(proof(source,[...source.actions,action(source,strong[id])]),ROLE_MAP));}
 const source=before('arm'),valid=action(source,strong.arm);
 for(const input of malformed())assert.throws(()=>http.validateCompletion(proof(source,[{...valid,input}]),ROLE_MAP),error=>error instanceof http.ApiError&&error.code==='invalid_actions');
 for(const patch of [{version:2},{version:'1'},{index:0},{index:2},{index:'1'},{eventId:''},{eventId:'x'.repeat(101)},{grade:2},{score:100},{result:'win'}])assert.throws(()=>http.validateCompletion(proof(source,[{...valid,...patch}]),ROLE_MAP));
 for(const field of ['version','eventId','index','input']){const invalid=copy(valid);delete invalid[field];assert.throws(()=>http.validateCompletion(proof(source,[invalid]),ROLE_MAP));}
 for(const seed of ['e39-cal46-kin49-g-e-s-0123456789','e39-cal46-kin49-g-e-0123456789ab','e39-cal46-legacy','e39-old'])assert.throws(()=>http.validateCompletion({...proof(source,[valid]),seed},ROLE_MAP));
 assert.ok(JSON.stringify(proof(source,[valid])).length<2048,'a complete trace is small enough to send as one canonical action');
});

test('HTTP streaming limits reject a 64 KiB control trace before any replay or storage',async()=>{
 const source=before('arm'),body=proof(source,[action(source,{kind:'arm',mode:'tap',taps:Array(40000).fill(8000)})]);
 const request=new Request('https://game.example/api/characters',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 await assert.rejects(http.readJson(request),error=>error instanceof http.ApiError&&error.code==='body_too_large'&&error.status===413);
});

test('the published v54 activity, PIP and warning saves keep their exact pre-minigame outcomes',()=>{
 const goldens={
  'activity-return-arm':'53a43ccecd5e22e0438e3ad483a651b74a4269294633e528b29755a605ed24e5',
  'activity-return-basketball':'6ba25b861eb2d7cd39fd2f55b75f8b76c0336708ff9e6af1bf4774b896d11713',
  'pip-start-gap':'ffc8ea151761421eb071f74c7c89a90decb37c4b7f214478356c8a56368c14a1',
  'owed-floor':'f67c5e330f565e518607e54f11e7f79d8fedd3990f0ddd40cd78dc60af111602'
 };
 for(const [id,expected]of Object.entries(goldens)){
  const row=oldRoutes.find(row=>row.id===id);assert.ok(row,id);const run=E.replayRun(row.roleId,row.seed,row.actions);
  assert.equal(isActivityPlayV55(run),false);assert.equal(getActivityPlayV55(run),null);assert.equal(E.validRun(run),true);
  assert.equal(createHash('sha256').update(JSON.stringify(run)).digest('hex'),expected,id);
 }
});

// Exercise the actual Worker with in-memory SQLite; never register artificial
// test players, activity statistics or completions on production.
function harness(t){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());db.exec('PRAGMA foreign_keys = ON');
 const sql={exec(query,...args){let rows=[];if(!args.length&&query.includes(';'))db.exec(query);else{const stmt=db.prepare(query);if(stmt.columns().length)rows=stmt.all(...args);else stmt.run(...args);}return{toArray:()=>rows,one:()=>{assert.equal(rows.length,1);return rows[0];}};}};
 const storage={sql,transactionSync(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}},async getAlarm(){return null;},async setAlarm(){}};
 const source=readFileSync(new URL('../worker/index.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export class HedoArchive','globalThis.HedoArchive=class HedoArchive').replace('export default','globalThis.worker=');
 const context=vm.createContext({DurableObject:class{constructor(ctx){this.ctx=ctx;}},replayRun:E.replayRun,VERSION:E.VERSION,MAX_TURNS:E.MAX_TURNS,ROLE_MAP,ENDINGS,...http,validateFeedback,validatePublisherToken,FeedbackStore,AchievementStore,CharacterStore,ObservationStore,crypto,Response,Request,URL,Date});
 vm.runInContext(source,context);const archive=new context.HedoArchive({storage,blockConcurrencyWhile:fn=>fn()},{});
 const call=async(path,{method='GET',token,body}={})=>{archive.rate=new http.RateGuard();const headers={};if(token)headers.Authorization=`Bearer ${token}`;if(body)headers['Content-Type']='application/json';const response=await archive.fetch(new Request(`https://game.example${path}`,{method,headers,body:body?JSON.stringify(body):undefined}));return{status:response.status,body:await response.json()};};
 return{sql,call};
}

test('Worker replays all seven interactive proofs, ignores invented client statistics and refuses replayed rewards',async t=>{
 const h=harness(t);
 for(const id of ACTIVITY_IDS_V44){
  const token=randomBytes(32).toString('hex');assert.equal((await h.call('/api/player',{method:'POST',body:{token}})).status,200);
  const source=before(id),pending=E.applyActivityPlay(source,strong[id]),run=E.advance(pending),runId=randomUUID(),body={...proof(run),runId,stats:{energy:100,cash:9999},characters:[{id:'sonny',realHits:9999}],activityOutcome:{score:999}};
  const response=await h.call('/api/characters',{method:'POST',token,body});
  assert.equal(response.status,200,id);assert.equal(response.body.verified,true,id);assert.equal(response.body.totalRuns,0,id);
  assert.deepEqual(response.body.characters,deriveCharacterStats(run),id);
  const duplicate={...body,actions:[...run.actions,action(source,strong[id])]};
  const rejected=await h.call('/api/characters',{method:'POST',token,body:duplicate});
  assert.equal(rejected.status,400,id);assert.equal(rejected.body.error,'invalid_replay',id);
  const suppliedGrade={...body,actions:[...source.actions,action(source,{...strong[id],grade:2})]};
  const bad=await h.call('/api/characters',{method:'POST',token,body:suppliedGrade});assert.equal(bad.status,400,id);assert.equal(bad.body.error,'invalid_actions',id);
 }
 assert.equal((await h.call('/api/stats')).body.totalRuns,0,'partial activity proofs never create completed lives');
});
