import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as E from '../dist/engine.js';
import {ENERGY_REST_WARNING_V53,isEnergyRestV53,energyRestWarningV53,getEnergyRestEventV53} from '../dist/energy-rest-v53.js';
import {renderWorkGapHTMLV50} from '../dist/work-gap-ui-v50.js';

const {routes,required}=JSON.parse(readFileSync(new URL('./fixtures/energy-rest-routes-v53.json',import.meta.url),'utf8'));
const legacy=JSON.parse(readFileSync(new URL('./fixtures/work-gap-routes-v50.json',import.meta.url),'utf8')).routes;
const copy=value=>JSON.parse(JSON.stringify(value));
const row=id=>{const value=routes.find(route=>route.id===id);assert.ok(value,id);return value;};
const replay=(route,actions=route.actions)=>E.replayRun(route.roleId,route.seed,actions);
const choose=(run,index)=>E.advance(E.applyChoice(run,index));
const sameWork=(before,after)=>{
 for(const key of ['turn','pay','pip'])assert.deepEqual(after[key],before[key],key);
 assert.equal(after.history.filter(part=>['daily','fantasy'].includes(part.kind)).length,before.history.filter(part=>['daily','fantasy'].includes(part.kind)).length);
 assert.equal(after.history.filter(part=>part.breakdown?.some(change=>change.source==='income')).length,before.history.filter(part=>part.breakdown?.some(change=>change.source==='income')).length);
};

test('the new-life marker gates energy-only rest at the inclusive warning boundary',()=>{
 assert.equal(ENERGY_REST_WARNING_V53,30);
 for(const seed of ['e39-cal46-kin49-g-e-0123456789ab','e39-cal46-kin49-g-e-proof']){
  assert.equal(isEnergyRestV53(seed),true);assert.equal(isEnergyRestV53({seed}),true);
 }
 for(const seed of ['e39-cal46-kin49-g-0123456789abcd','e39-cal46-kin49-g-e0-proof','e39-cal46-kin49-proof','e38-cal46-kin49-g-e-proof'])assert.equal(isEnergyRestV53({seed}),false);
 for(const energy of [1,15,30])assert.equal(energyRestWarningV53({stats:{energy}}),true,`${energy} energy`);
 for(const energy of [0,-1,31,100,NaN,Infinity,undefined])assert.equal(energyRestWarningV53({stats:{energy}}),false,`${energy} energy`);
 assert.equal(energyRestWarningV53({stats:{energy:80,mood:15}}),false,'mood warning alone does not interrupt healthy work');
});

test('natural energy/rest witnesses survive refresh and strict deterministic server replay',()=>{
 assert.ok(required.length>=8);assert.equal(required.filter(id=>!routes.some(route=>route.id===id)).length,0);
 for(const route of routes){
  assert.equal(isEnergyRestV53(route.seed),true,route.id);assert.equal(route.seed.length,32,route.id);
  for(const actions of [route.beforeActions,route.actions]){
   const run=replay(route,actions),saved=copy(run);
   assert.equal(E.validRun(run),true,route.id);assert.equal(E.validRun(saved),true,`${route.id}/refresh`);
   assert.deepEqual(replay(route,saved.actions),saved,`${route.id}/replay`);
  }
 }
});

test('healthy reporting and work proceed directly to the next scene without a rest screen or extra click',()=>{
 for(const id of ['healthy-onboarding','healthy-work','mood-warning-only']){
  const route=row(id),before=replay(route,route.beforeActions),after=replay(route);
  assert.ok(after.stats.energy>30,id);assert.equal(after.flags.work_gap_open,0,id);
  assert.equal(E.isWorkGapOpenV50(after),false,id);assert.ok(['daily','fantasy'].includes(E.getEvent(after).kind),id);
  assert.equal(E.getEvent(after).id,after.eventId,id);assert.equal(E.canRequestBreak(after),false,id);assert.equal(E.requestBreak(after),after,id);
  assert.equal(after.turn,before.turn+1,id);
  assert.throws(()=>replay(route,[...after.actions,{type:'choice',eventId:'work-gap-v50',index:0}]),/Replay event mismatch/,id);
  assert.throws(()=>replay(route,[...after.actions,{type:'break'}]),/Unavailable break/,id);
  assert.equal(E.validRun({...after,flags:{...after.flags,work_gap_open:1}}),false,`${id}/invented gap`);
 }
 const mood=replay(row('mood-warning-only'));assert.ok(mood.stats.mood>0&&mood.stats.mood<=30);
});

test('a warning is acted on only after the current event and its result are complete',()=>{
 const route=row('warning-gap'),active=replay(route,route.beforeActions),pending=E.applyChoice(active,route.index),gap=replay(route);
 assert.equal(E.isWorkGapOpenV50(active),false);assert.equal(E.canRequestBreak(active),false);assert.equal(E.requestBreak(active),active);
 assert.equal(pending.pending,true);assert.equal(E.canRequestBreak(pending),false);assert.equal(E.requestBreak(pending),pending);
 assert.ok(gap.stats.energy>0&&gap.stats.energy<=30);assert.equal(E.isWorkGapOpenV50(gap),true);assert.equal(E.canRequestBreak(gap),true);
 assert.equal(gap.turn,active.turn+1);assert.deepEqual(E.getEvent(gap),getEnergyRestEventV53(gap));
 assert.equal(E.getEvent(gap).speaker,'self');assert.equal(E.getEvent(gap).choices.length,1);
 for(const invoke of [E.requestRage,E.requestVerbal,E.requestPatronageReply])assert.equal(invoke(gap),gap,'the future interlocutor stays hidden');
 const critical=replay(row('critical-gap'));assert.ok(critical.stats.energy>0&&critical.stats.energy<=15);assert.equal(E.isWorkGapOpenV50(critical),true);
});

test('paid recovery stays in the same interval even above 30 energy and cannot be repeated',()=>{
 const route=row('paid-recovery'),before=replay(route,route.beforeActions),after=replay(route);
 assert.equal(energyRestWarningV53(before),true);assert.ok(after.stats.energy>30);assert.equal(energyRestWarningV53(after),false);
 assert.equal(E.isWorkGapOpenV50(after),true);assert.equal(after.flags.work_gap_open,1);assert.equal(after.eventId,before.eventId);
 assert.ok(after.stats.cash<before.stats.cash);sameWork(before,after);
 assert.equal(E.canRequestBreak(after),false);assert.equal(E.requestBreak(after),after);assert.equal(after.lastBreakTurn,after.turn);
 assert.throws(()=>replay(route,[...after.actions,{type:'break'}]),/Unavailable break/);
 const original=copy(after),started=E.applyChoice(after,0);
 assert.equal(started.pending,false);assert.equal(E.advance(started),started);assert.equal(E.isWorkGapOpenV50(started),false);
 assert.equal(E.canRequestBreak(started),false);assert.equal(E.requestBreak(started),started);
 for(const key of ['rng','turn','stats','pay','pip','history','seen','lastWeather'])assert.deepEqual(started[key],after[key],key);
 assert.deepEqual(started.actions.at(-1),{type:'choice',eventId:'work-gap-v50',index:0});
 assert.deepEqual(replay(route,started.actions),started);assert.deepEqual(after,original,'continuing does not mutate the saved interval');
 assert.equal(E.validRun({...started,flags:{...started.flags,work_gap_open:1}}),false,'a local edit cannot reopen the interval');
 assert.equal(E.validRun({...after,flags:{...after.flags,work_gap_open:0}}),false,'recovery does not silently consume the explicit continue action');
});

test('declining rest returns to the same warning and consumes only that interval allowance',()=>{
 const route=row('cancel-return'),before=replay(route,route.beforeActions),after=replay(route);
 assert.equal(E.isWorkGapOpenV50(before),true);assert.equal(E.isWorkGapOpenV50(after),true);sameWork(before,after);
 assert.equal(after.stats.cash,before.stats.cash);assert.equal(after.eventId,before.eventId);
 assert.equal(E.canRequestBreak(after),false);assert.equal(after.lastBreakTurn,after.turn);
 const working=choose(after,0);assert.equal(E.isWorkGapOpenV50(working),false);sameWork(after,working);
});

test('PIP rest recovery and continuing never advance the PIP countdown, salary or workday',()=>{
 const warningRoute=row('pip-warning-gap'),personnel=replay(warningRoute,warningRoute.beforeActions),warning=replay(warningRoute);
 assert.equal(personnel.eventId,'crisis-boss');assert.ok(personnel.stats.energy<=30);assert.notEqual(E.getEvent(personnel).kind,'work-gap');
 assert.equal(E.canRequestBreak(personnel),false);assert.equal(E.requestBreak(personnel),personnel);
 const pending=E.applyChoice(personnel,warningRoute.index);assert.equal(E.canRequestBreak(pending),false);assert.equal(E.requestBreak(pending),pending);
 assert.equal(warning.turn,personnel.turn,'the urgent notice is answered before the waiting interval opens');
 assert.equal(warning.pip.active,true);assert.equal(E.isWorkGapOpenV50(warning),true);
 const route=row('pip-paid-recovery'),before=replay(route,route.beforeActions),after=replay(route);
 assert.equal(before.pip.active,true);assert.equal(after.pip.active,true);assert.ok(after.stats.energy>30);sameWork(before,after);
 const working=choose(after,0);sameWork(after,working);assert.equal(E.isWorkGapOpenV50(working),false);
});

test('zero energy keeps its committed exhaustion consequence and cannot manufacture a rescuing gap',()=>{
 const route=row('exhaustion'),before=replay(route,route.beforeActions),pending=E.applyChoice(before,route.index),after=replay(route);
 assert.equal(pending.stats.energy,0);assert.equal(pending.pending,true);assert.equal(E.canRequestBreak(pending),false);assert.equal(E.requestBreak(pending),pending);
 assert.equal(E.validRun(pending),true);assert.equal(E.isWorkGapOpenV50(after),false);assert.equal(E.canRequestBreak(after),false);assert.equal(E.requestBreak(after),after);
 assert.notEqual(E.getEvent(after)?.kind,'work-gap');
});

test('existing v50 lives retain healthy between-work pauses and canonical proofs unchanged',()=>{
 const route=legacy.find(route=>route.id==='onboarding-gap'),before=replay(route,route.beforeActions),gap=replay(route);
 assert.equal(isEnergyRestV53(gap),false);assert.ok(gap.stats.energy>30);assert.equal(E.isWorkGapOpenV50(gap),true);assert.equal(E.canRequestBreak(gap),true);
 assert.equal(E.validRun(gap),true);assert.equal(gap.turn,before.turn+1);assert.doesNotMatch(E.getEvent(gap).title,/體力.*警告/);
});

test('warning-only rest copy identifies the trigger and the already-completed recovery',()=>{
 const low=renderWorkGapHTMLV50({warningRest:true,stats:{energy:18,mood:44,cash:65},restAllowed:true});
 assert.match(low,/data-energy-rest/);assert.match(low,/體力進入警告/);assert.match(low,/data-action="break"/);
 const recovered=renderWorkGapHTMLV50({warningRest:true,stats:{energy:62,mood:70,cash:50},restReason:'這段空檔已安排過休息。'});
 assert.match(recovered,/體力回來一些/);assert.match(recovered,/disabled aria-describedby/);
 assert.doesNotMatch(recovered,/下一個角色|下一個事件的答案/);
});

test('the real app hides healthy and mid-event rest controls while warning messages describe the actual trigger',()=>{
 const app=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
 const controls=app.slice(app.indexOf('function actionAvailability('),app.indexOf('function careerControl('));
 const warnings=app.slice(app.indexOf('function resourceWarningHTML('),app.indexOf('function gameSidebarHTML('));
 const context=vm.createContext({...E,isEnergyRestV53,run:null,isPersonnelNotice:()=>false,esc:value=>String(value),STAT_LABELS:{energy:'體力',mood:'心情'}});
 vm.runInContext(`${controls}\n${warnings}`,context);
 for(const id of ['healthy-onboarding','healthy-work','mood-warning-only']){
  context.run=replay(row(id));assert.equal(context.breakControl(),'',id);
  assert.equal(context.actionAvailability('break').allowed,false,id);
 }
 context.run=replay(row('mood-warning-only'));
 const mood=context.resourceWarningHTML();
 assert.match(mood,/data-warning-stat="mood"/);assert.doesNotMatch(mood,/data-warning-stat="energy"|data-action="break"/);
 assert.match(mood,/只有體力也降到 30 以下.*才會出現休息空檔/);
 const route=row('warning-gap'),active=replay(route,route.beforeActions);
 context.run=active;assert.equal(context.breakControl(),'');
 context.run=E.applyChoice(active,route.index);assert.equal(context.breakControl(),'');
 const pendingWarning=context.resourceWarningHTML();
 assert.match(pendingWarning,/先看完這次結果/);assert.doesNotMatch(pendingWarning,/data-action="break"/);
 context.run=replay(route);
 const ready=context.breakControl();assert.match(ready,/data-action="break"/);assert.doesNotMatch(ready,/disabled/);
 assert.match(context.resourceWarningHTML(),/data-action="break"/);
 context.run=replay(row('paid-recovery'));
 assert.match(context.breakControl(),/disabled aria-describedby="break-availability-reason"/);
 assert.match(context.breakControl(),/體力進入警告時才會再出現/);
 const old=legacy.find(route=>route.id==='onboarding-gap');context.run=replay(old);
 assert.match(context.breakControl(),/data-action="break"/);assert.doesNotMatch(context.breakControl(),/disabled/);
});
