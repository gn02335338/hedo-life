import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as E from '../dist/engine.js';
import {isWorkGapV50,getWorkGapEventV50} from '../dist/work-gap-v50.js';
import {renderWorkGapHTMLV50} from '../dist/work-gap-ui-v50.js';

const {routes,required}=JSON.parse(readFileSync(new URL('./fixtures/work-gap-routes-v50.json',import.meta.url),'utf8'));
const old=JSON.parse(readFileSync(new URL('./fixtures/patronage-routes-v49.json',import.meta.url),'utf8')).routes;
const copy=value=>JSON.parse(JSON.stringify(value));
const route=id=>{const found=routes.find(row=>row.id===id);assert.ok(found,id);return found;};
const from=(row,actions=row.actions)=>E.replayRun(row.roleId,row.seed,actions);
const choose=(run,index)=>E.advance(E.applyChoice(run,index));
const workCount=run=>run.history.filter(row=>['daily','fantasy'].includes(row.kind)).length;
const unchangedWork=(before,after,label)=>{
 assert.equal(after.turn,before.turn,`${label}: workday`);
 assert.equal(after.pay,before.pay,`${label}: salary`);
 assert.deepEqual(after.pip,before.pip,`${label}: PIP`);
 assert.equal(workCount(after),workCount(before),`${label}: completed work`);
 assert.equal(after.history.filter(row=>row.breakdown?.some(item=>item.source==='income')).length,before.history.filter(row=>row.breakdown?.some(item=>item.source==='income')).length,`${label}: income`);
};

test('only the new life marker changes rest timing; published lives retain their original scenes and break permission',()=>{
 for(const seed of ['e39-cal46-kin49-g-natural','e39-cal46-kin49-g-0123456789abcd'])assert.equal(isWorkGapV50({seed}),true);
 for(const seed of ['e39-natural','e39-cal46-natural','e39-cal46-kin49-natural','e39-cal46-kin49-g0-natural','e39-kin49-g-natural','e38-cal46-kin49-g-natural'])assert.equal(isWorkGapV50({seed}),false);
 const legacy=old.find(row=>{
  const run=from(row,row.entryBeforeActions||row.beforeActions);
  return ['daily','fantasy'].includes(E.getEvent(run)?.kind)&&E.canRequestBreak(run);
 });
 assert.ok(legacy,'an existing life permits its original mid-scene break');
 const before=from(legacy,legacy.entryBeforeActions||legacy.beforeActions);
 assert.equal(before.flags.work_gap_open,undefined);
 assert.notEqual(E.getEvent(before).id,'work-gap-v50');
 assert.notEqual(E.requestBreak(before),before);
 assert.equal(E.validRun(from(legacy)),true);
});

test('natural fixtures cover all required returns and survive refresh plus deterministic server replay',()=>{
 assert.ok(required.length>=20);
 assert.deepEqual(new Set(required.filter(id=>!routes.some(row=>row.id===id))),new Set());
 for(const row of routes){
  assert.ok(row.seed.startsWith('e39-cal46-kin49-g-'));assert.ok(row.seed.length<=32);
  for(const actions of [row.beforeActions,row.actions,...(row.completionActions?[row.completionActions]:[])]){
   const run=from(row,actions),saved=copy(run);
   assert.equal(E.validRun(run),true,row.id);assert.equal(E.validRun(saved),true,`${row.id}/refresh`);
   assert.deepEqual(from(row,saved.actions),saved,`${row.id}/replay`);
  }
 }
});

test('reporting and an active event cannot be interrupted; a gap starts the next scene without a result or extra work',()=>{
 const row=route('onboarding-gap'),onboarding=from(row,row.beforeActions),pending=E.applyChoice(onboarding,row.index),gap=from(row);
 assert.equal(E.getEvent(onboarding).kind,'onboarding');
 for(const run of [onboarding,pending]){assert.equal(E.canRequestBreak(run),false);assert.equal(E.requestBreak(run),run);}
 assert.equal(E.isWorkGapOpenV50(gap),true);
 const shown=E.getEvent(gap);
 assert.equal(shown.id,'work-gap-v50');assert.equal(shown.kind,'work-gap');assert.equal(shown.speaker,'self');
 assert.deepEqual(shown,getWorkGapEventV50());assert.equal(shown.choices.length,1);
 assert.equal(shown.choices[0].effect,'workGapStart');
 for(const invoke of [E.requestRage,E.requestVerbal,E.requestPatronageReply])assert.equal(invoke(gap),gap);
 assert.throws(()=>E.applyChoice(gap,1),/Unavailable work gap choice/);
 assert.throws(()=>E.applyChoice(gap,-1),/Unavailable work gap choice/);
 const before=copy(gap),started=E.applyChoice(gap,0);
 assert.equal(started.pending,false);assert.equal(E.advance(started),started);
 assert.deepEqual(started.actions.at(-1),{type:'choice',eventId:'work-gap-v50',index:0});
 assert.equal(started.actions.length,gap.actions.length+1);
 for(const key of ['turn','rng','pay','stats','history','pip','seen','lastWeather'])assert.deepEqual(started[key],gap[key],key);
 assert.equal(E.isWorkGapOpenV50(started),false);assert.equal(E.canRequestBreak(started),false);assert.equal(E.requestBreak(started),started);
 assert.deepEqual(E.replayRun(started.roleId,started.seed,started.actions),started);
 assert.deepEqual(gap,before,'starting a scene does not mutate the saved gap');
 assert.equal(E.validRun({...started,flags:{...started.flags,work_gap_open:1}}),false,'a modified local flag cannot manufacture another gap');
 assert.equal(E.validRun({...gap,flags:{...gap.flags,work_gap_open:true}}),false,'the marker is a canonical integer flag');
 const working=E.applyChoice(started,0);
 assert.equal(working.pending,true);assert.equal(E.canRequestBreak(working),false);assert.equal(E.requestBreak(working),working);
});

test('a complete natural loop works, rests in the same interval and starts another task without workday or salary duplication',()=>{
 const row=route('basic-loop'),first=from(row,row.firstGapActions),second=from(row,row.secondGapActions),rested=from(row,row.restedActions),working=from(row);
 assert.equal(E.isWorkGapOpenV50(first),true);assert.equal(E.isWorkGapOpenV50(second),true);
 assert.equal(second.turn,first.turn+1);assert.equal(workCount(second),workCount(first)+1);
 assert.equal(E.isWorkGapOpenV50(rested),true);assert.equal(rested.eventId,second.eventId);
 unchangedWork(second,rested,'paid rest');assert.ok(rested.stats.cash<second.stats.cash);
 assert.equal(E.canRequestBreak(rested),false);assert.equal(E.requestBreak(rested),rested);
 assert.equal(E.isWorkGapOpenV50(working),false);unchangedWork(rested,working,'continue');
 assert.deepEqual(working.history,rested.history);assert.equal(working.rng,rested.rng);
 const complete=from(row,row.completionActions);assert.equal(complete.completed,true);assert.equal(complete.endingId,row.endingId);
});

test('paid rest, cancelled plans, dinner and Kind all return to the original gap and cannot be repeated for free',()=>{
 for(const id of ['rest-paid','rest-cancel','meal-paid','meal-declined','kind-break-paid','pip-rest']){
  const row=route(id),before=from(row,row.beforeActions),after=from(row);
  assert.equal(E.isWorkGapOpenV50(before),true,id);assert.equal(E.isWorkGapOpenV50(after),true,id);
  assert.equal(after.eventId,before.eventId,id);unchangedWork(before,after,id);
  assert.equal(after.lastBreakTurn,after.turn,id);assert.equal(E.canRequestBreak(after),false,id);assert.equal(E.requestBreak(after),after,id);
  const choices=after.history.slice(before.history.length);
  assert.ok(choices.length>=1);assert.ok(choices.every(part=>!['daily','fantasy','onboarding'].includes(part.kind)),id);
  if(id==='rest-cancel'||id==='meal-declined')assert.equal(after.stats.cash,before.stats.cash,id);
  else assert.ok(after.stats.cash<before.stats.cash,id);
  const resumed=choose(after,0);assert.equal(E.canRequestBreak(resumed),false,id);unchangedWork(after,resumed,id);
 }
});

test('urgent mood, salary, PIP, appointment and personnel decisions cannot be bypassed by opening rest',()=>{
 for(const id of ['mood-collapse','salary-cut','low-pay-tip','pip-start','pip-review','patronage-application','kind-workday-return']){
  const row=route(id),before=from(row,row.beforeActions),pending=E.applyChoice(before,row.index),after=from(row);
  assert.notEqual(E.getEvent(before).kind,'work-gap',id);
  for(const state of [before,pending]){assert.equal(E.canRequestBreak(state),false,id);assert.equal(E.requestBreak(state),state,id);}
  assert.equal(after.turn,before.turn,id);assert.equal(workCount(after),workCount(before),id);
  assert.equal(E.validRun(after),true,id);
 }
 const row=route('pip-work-gap'),before=from(row,row.beforeActions),started=choose(before,0),after=from(row);
 assert.equal(before.pip.active,true);assert.equal(E.isWorkGapOpenV50(before),true);
 assert.equal(started.pip.remaining,before.pip.remaining,'continuing work does not spend a PIP turn');
 assert.equal(after.pip.remaining,before.pip.remaining-1,'only the actual work choice spends one PIP turn');
 assert.equal(after.turn,before.turn+1);assert.equal(workCount(after),workCount(before)+1);
});

test('spontaneous activities shown after starting work return to that active task and do not create another rest interval',()=>{
 for(const id of ['activity-declined','activity-completed']){
  const row=route(id),before=from(row,row.beforeActions),after=from(row);
  assert.ok(['activity-invitation','activity'].includes(E.getEvent(before).kind),id);
  assert.equal(E.canRequestBreak(before),false,id);assert.equal(E.requestBreak(before),before,id);
  assert.equal(E.isWorkGapOpenV50(after),false,id);assert.equal(E.canRequestBreak(after),false,id);unchangedWork(before,after,id);
  assert.ok(!after.activityContext,id);assert.ok(!after.activityInvitationContext,id);
 }
});

test('dreaming during an event returns to that unfinished event; dreaming after a result settles the original work exactly once',()=>{
 const active=route('rage-event-imagined'),before=from(active,active.beforeActions),after=from(active);
 assert.equal(after.eventId,before.eventId);assert.equal(E.isWorkGapOpenV50(after),false);assert.equal(E.canRequestBreak(after),false);
 unchangedWork(before,after,'event dream');assert.equal(after.rageContext,null);
 assert.ok(after.history.slice(before.history.length).some(row=>row.rageOutcome?.mode==='imagined'||row.kind==='rage'));
 const result=route('rage-result-imagined'),original=from(result,result.beforeActions),resumed=from(result);
 assert.equal(E.isWorkGapOpenV50(resumed),true);assert.equal(resumed.turn,original.turn+1);assert.equal(workCount(resumed),workCount(original)+1);
 const chosen=E.applyChoice(original,result.index),raging=E.requestRage(chosen);
 assert.equal(raging.rageContext.mode,'imagined');assert.equal(raging.rageContext.phase,'result');
 assert.deepEqual(E.advance(raging),resumed);assert.equal(E.advance(resumed),resumed);
});

test('career and salary-plan navigation can return to the same idle gap without spending the rest allowance',()=>{
 for(const id of ['career-return','raise-return','exit-return']){
  const row=route(id),before=from(row,row.beforeActions),after=from(row);
  assert.equal(E.isWorkGapOpenV50(before),true,id);assert.equal(E.isWorkGapOpenV50(after),true,id);
  assert.equal(before.eventId,after.eventId,id);unchangedWork(before,after,id);
  assert.equal(after.lastBreakTurn,before.lastBreakTurn,id);assert.equal(E.canRequestBreak(after),E.canRequestBreak(before),id);
 }
});

test('the interval renderer shows current resources and no next-event identity, choices or outcomes',()=>{
 const html=renderWorkGapHTMLV50({day:5,stats:{mood:12,energy:27,cash:46},restAllowed:true,
  nextEvent:{title:'SHOULD_NOT_LEAK',speaker:'hidden-person',sourceIds:['PRIVATE_SOURCE'],choices:[{text:'NEXT_CHOICE',result:'SECRET_RESULT'}]},
  continueChoiceHTML:'<button data-choice="0">繼續上班</button>'});
 assert.match(html,/data-work-gap/);assert.match(html,/DAY 05/);assert.match(html,/data-gap-stat="mood"/);assert.match(html,/class="work-gap-stat critical"/);
 assert.match(html,/data-gap-stat="energy"/);assert.match(html,/class="work-gap-stat caution"/);assert.match(html,/存款怎麼花/);assert.match(html,/data-choice="0"/);
 assert.doesNotMatch(html,/SHOULD_NOT_LEAK|hidden-person|PRIVATE_SOURCE|NEXT_CHOICE|SECRET_RESULT|惡言相向|受不了了/);
 const spent=renderWorkGapHTMLV50({restReason:'<script>not allowed</script>'});
 assert.match(spent,/data-action="break" disabled aria-describedby="gap-rest-reason"/);
 assert.match(spent,/&lt;script&gt;not allowed&lt;\/script&gt;/);assert.doesNotMatch(spent,/<script>/);
});

test('the UI disables mid-event rest with a reason and runs deferred notifications only after the player leaves the gap',()=>{
 const app=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
 const availability=app.slice(app.indexOf('function actionAvailability('),app.indexOf('function sidebarAction('));
 const chooseSource=app.slice(app.indexOf('function choose('),app.indexOf('function catchUpActivityInvitation('));
 const row=route('basic-loop'),idle=from(row,row.firstGapActions),active=choose(idle,0),calls=[];
 const context=vm.createContext({...E,run:idle,isPersonnelNotice:()=>false,usesWorkGap:state=>isWorkGapV50(state??context.run),workGapIsOpen:E.isWorkGapOpenV50,
  screen:'game',dialog:{open:false},gameViewRevision:5,
  catchUpStartingSalaryAdvice:()=>calls.push('salary'),catchUpActivityInvitation:()=>calls.push('activity'),catchUpHiddenEncounter:()=>calls.push('hidden'),
  collectAchievements:()=>calls.push('achievements'),syncCharacterProof:()=>calls.push('proof'),save:()=>calls.push('save'),game:()=>calls.push('render')});
 vm.runInContext(`${availability}\n${chooseSource}`,context);
 assert.equal(context.actionAvailability('break',idle).allowed,true);
 const disabled=context.actionAvailability('break',active);assert.equal(disabled.allowed,false);assert.match(disabled.reason,/事件.*結果.*工作空檔/);
 const pending=E.applyChoice(active,0);assert.equal(context.actionAvailability('break',pending).allowed,false);
 assert.match(context.actionAvailability('break',pending).reason,/結果/);
 assert.equal(context.choose(0,4),false);assert.deepEqual(calls,[],'a stale click cannot start the next scene');
 assert.equal(context.choose(0,5),true);
 assert.deepEqual(calls,['salary','activity','hidden','achievements','proof','save','render']);
 assert.equal(context.run.eventId,idle.eventId);assert.equal(E.isWorkGapOpenV50(context.run),false);assert.equal(context.run.pending,false);
 calls.length=0;assert.equal(context.choose(0,5),true);
 assert.deepEqual(calls,['achievements','proof','save','render'],'an ordinary choice never reruns start-of-scene hooks');
});
