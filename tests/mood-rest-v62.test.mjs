import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as E from '../dist/engine.js';
import {isLifeBalanceV62,MOOD_REST_WARNING_V62,moodRestWarningV62,restWarningV62} from '../dist/life-balance-v62.js';

const {routes,required}=JSON.parse(readFileSync(new URL('./fixtures/mood-rest-routes-v62.json',import.meta.url),'utf8'));
const copy=value=>JSON.parse(JSON.stringify(value));
const route=id=>{const row=routes.find(row=>row.id===id);assert.ok(row,id);return row;};
const replay=(row,actions=row.actions)=>E.replayRun(row.roleId,row.seed,actions);
const pendingFor=(row,before)=>{const action=row.actions.at(-1);return action.type==='activity-play'?E.applyActivityPlay(before,action.input):E.applyChoice(before,action.index);};
const workCount=run=>run.history.filter(row=>['daily','fantasy'].includes(row.kind)).length;
const sameWork=(before,after)=>{
 for(const key of ['turn','pay','pip'])assert.deepEqual(after[key],before[key],key);
 assert.equal(workCount(after),workCount(before));assert.equal(after.history.filter(row=>row.breakdown?.some(change=>change.source==='income')).length,before.history.filter(row=>row.breakdown?.some(change=>change.source==='income')).length);
};

test('new-life mood warnings match the existing inclusive 30 boundary without changing the energy predicate',()=>{
 const seed='e39-r62-n-0123456789abcdef012345';assert.equal(MOOD_REST_WARNING_V62,30);assert.equal(isLifeBalanceV62(seed),true);assert.equal(isLifeBalanceV62({seed}),true);
 for(const mood of [1,15,25,30])assert.equal(moodRestWarningV62({seed,stats:{mood,energy:80}}),true);
 for(const mood of [0,-1,31,100,NaN,Infinity,undefined])assert.equal(moodRestWarningV62({seed,stats:{mood,energy:80}}),false);
 for(const seed of ['e39-r61-n-0123456789abcdef012345','e39-r62-n-short','e39-r62-n-0123456789abcdef012345-more','e39-r62-x-0123456789abcdef012345']){
  assert.equal(isLifeBalanceV62(seed),false);assert.equal(moodRestWarningV62({seed,stats:{mood:15,energy:80}}),false);assert.equal(restWarningV62({seed,stats:{mood:15,energy:80}}),false);
 }
 assert.equal(restWarningV62({seed,stats:{mood:80,energy:30}}),true);assert.equal(restWarningV62({seed,stats:{mood:30,energy:80}}),true);assert.equal(restWarningV62({seed,stats:{mood:31,energy:31}}),false);
});

test('all natural mood-rest routes survive JSON saves and exact server replays without injected state',()=>{
 assert.ok(required.length>=7);assert.deepEqual(required.filter(id=>!routes.some(row=>row.id===id)),[]);
 for(const row of routes){
  assert.match(row.seed,/^e39-r62-[nsd]-[a-f0-9]{22}$/);assert.equal(row.seed.length,32);assert.deepEqual(row.actions[0],{type:'activity-schedule',version:1});
  for(const actions of [row.beforeActions,row.actions]){const run=replay(row,actions),saved=copy(run);assert.equal(E.validRun(saved),true,row.id);assert.deepEqual(replay(row,saved.actions),saved,row.id);}
 }
});

test('mood alone can open a usable interval only after the current work and committed result finish',()=>{
 const row=route('mood-only-gap'),before=replay(row,row.beforeActions),pending=pendingFor(row,before),after=replay(row);
 assert.ok(['daily','fantasy'].includes(E.getEvent(before).kind));assert.equal(E.isWorkGapOpenV50(before),false);assert.equal(E.canRequestBreak(before),false);assert.equal(E.requestBreak(before),before);
 assert.equal(pending.pending,true);assert.equal(E.canRequestBreak(pending),false);assert.equal(E.requestBreak(pending),pending);
 assert.ok(after.stats.energy>30);assert.equal(moodRestWarningV62(after),true);assert.equal(E.isWorkGapOpenV50(after),true);assert.equal(E.canRequestBreak(after),true);assert.equal(E.getEvent(after).kind,'work-gap');
 assert.equal(after.turn,before.turn+1);assert.equal(workCount(after),workCount(before)+1);assert.equal(E.getEvent(after).choices.length,1);
 for(const invoke of [E.requestRage,E.requestVerbal,E.requestPatronageReply])assert.equal(invoke(after),after,'the unrevealed next person cannot be targeted from a gap');
});

test('paid mood recovery and refusing a plan both return to the same interval with one rest allowance',()=>{
 for(const id of ['paid-mood-recovery','cancel-mood-return']){
  const row=route(id),before=replay(row,row.beforeActions),after=replay(row);assert.equal(E.isWorkGapOpenV50(before),true);assert.equal(moodRestWarningV62(before),true);
  assert.equal(after.eventId,before.eventId);assert.equal(E.isWorkGapOpenV50(after),true);assert.equal(after.flags.work_gap_open,1);sameWork(before,after);
  assert.equal(after.lastBreakTurn,after.turn);assert.equal(E.canRequestBreak(after),false);assert.equal(E.requestBreak(after),after);
  if(id==='paid-mood-recovery'){assert.ok(before.stats.energy>30);assert.ok(after.stats.mood>30);assert.ok(after.stats.cash<before.stats.cash);}else assert.equal(after.stats.cash,before.stats.cash);
  const working=E.applyChoice(after,0);sameWork(after,working);assert.equal(working.pending,false);assert.equal(E.isWorkGapOpenV50(working),false);assert.equal(working.rng,after.rng);assert.deepEqual(working.history,after.history);assert.equal(E.canRequestBreak(working),false);assert.equal(E.validRun(copy(working)),true);
  assert.deepEqual(E.replayRun(working.roleId,working.seed,working.actions),working);assert.equal(E.validRun({...working,flags:{...working.flags,work_gap_open:1}}),false);
 }
});

test('activity, PIP and office interludes finish before mood recovery becomes available',()=>{
 for(const id of ['activity-mood-return','treat-mood-return','pip-mood-gap']){
  const row=route(id),before=replay(row,row.beforeActions),pending=pendingFor(row,before),after=replay(row);
  assert.equal(E.isWorkGapOpenV50(before),false,id);assert.equal(E.canRequestBreak(before),false,id);assert.equal(E.requestBreak(before),before,id);assert.equal(E.canRequestBreak(pending),false,id);
  assert.equal(moodRestWarningV62(after),true,id);assert.equal(E.isWorkGapOpenV50(after),true,id);assert.equal(E.canRequestBreak(after),true,id);assert.equal(after.turn,before.turn,id);
  if(id==='activity-mood-return'){assert.ok(before.activityContext);assert.ok(!after.activityContext);assert.equal(before.history.at(-1)?.activityOutcome?.done,false);}
  if(id==='treat-mood-return'){assert.ok(before.treatsContext);assert.ok(!after.treatsContext);assert.equal(after.history.at(-1).treatsOutcome.done,true);}
  if(id==='pip-mood-gap'){assert.ok(['crisis-boss','crisis-mood','pip-review'].includes(before.eventId));assert.equal(after.pip.active,true);const continued=E.applyChoice(after,0);assert.deepEqual(continued.pip,after.pip);assert.equal(continued.turn,after.turn);}
 }
 for(const id of ['activity-mood-guard','treat-mood-guard']){
  const row=routes.find(row=>row.id===id);if(!row)continue;const run=replay(row);assert.equal(moodRestWarningV62(run),true);assert.equal(E.isWorkGapOpenV50(run),false);assert.equal(E.canRequestBreak(run),false);
 }
});

test('a true zero mood still collapses and cannot be rescued by manufacturing an ordinary gap',()=>{
 const row=route('zero-mood-collapse'),before=replay(row,row.beforeActions),pending=pendingFor(row,before),after=replay(row);
 assert.equal(pending.stats.mood,0);assert.equal(pending.pending,true);assert.equal(E.canRequestBreak(pending),false);assert.ok(['mood-collapse','mood-self-destruct'].includes(after.eventId));
 assert.equal(moodRestWarningV62(after),false);assert.equal(E.isWorkGapOpenV50(after),false);assert.equal(E.canRequestBreak(after),false);assert.equal(E.requestBreak(after),after);
 const forced={...after,flags:{...after.flags,work_gap_open:1}};assert.equal(E.isWorkGapOpenV50(forced),false);assert.equal(E.canRequestBreak(forced),false,'an awaiting flag cannot bypass the collapse screen');
 assert.equal(E.validRun({...after,flags:{...after.flags,work_gap_open:2}}),false);
});

test('published r61 low-mood lives keep their original replay state and rest timing',()=>{
 const old=JSON.parse(readFileSync(new URL('./fixtures/office-treats-routes-v61.json',import.meta.url),'utf8')).routes;
 for(const row of old){const run=replay(row);assert.equal(isLifeBalanceV62(run),false);assert.equal(moodRestWarningV62(run),false);assert.equal(E.validRun(copy(run)),true);assert.deepEqual(replay(row,run.actions),run);}
});
