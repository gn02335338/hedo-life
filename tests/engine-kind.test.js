import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {KIND_BREAK_CHANCE,KIND_BREAK_COST} from '../dist/kind-break.js';
import {STAT_KEYS,createRun,getEvent,applyChoice,advance,canRequestBreak,requestBreak,requestExit,replayRun,validRun} from '../dist/engine.js';
import {replayRoute} from './find-routes-v3.mjs';

const choose=(run,index)=>advance(applyChoice(run,index));
const copy=run=>JSON.parse(JSON.stringify(run));
const digest=run=>createHash('sha256').update(JSON.stringify(run)).digest('hex');
function naturalBreak(eventId,prefix='e6'){
 for(let index=0;index<1000;index++){
  const workday=choose(createRun('system',`${prefix}-kind-test-${index}`),0);
  if(!canRequestBreak(workday))continue;
  const menu=requestBreak(workday);
  if(menu.eventId===eventId)return {workday,menu};
 }
 throw new Error(`No natural ${prefix} ${eventId}`);
}

test('published e5 routes keep their complete state after the Kind invitation expansion',()=>{
 const fixtures=JSON.parse(readFileSync(new URL('./fixtures/legacy-e5-routes.json',import.meta.url),'utf8'));
 for(const fixture of fixtures){
  const run=replayRun(fixture.roleId,fixture.seed,fixture.actions);
  assert.equal(digest(run),fixture.stateSha256,fixture.ending);
  assert.equal(digest(replayRoute(fixture)),fixture.savedStateSha256,`${fixture.ending} saved`);
  assert.equal(validRun(copy(run)),true);
 }
});

test('e6 break invitations vary naturally and deterministically without spending on opening',()=>{
 let invitations=0,total=0;
 for(let index=0;index<600;index++){
  const run=choose(createRun('system',`e6-kind-lottery-${index}`),0);
  if(!canRequestBreak(run))continue;
  const snapshot=JSON.stringify(run),menu=requestBreak(run);
  assert.equal(JSON.stringify(run),snapshot);
  assert.deepEqual(requestBreak(run),menu);
  assert.deepEqual(menu.stats,run.stats);
  assert.equal(menu.history.length,run.history.length);
  assert.equal(menu.turn,run.turn);assert.deepEqual(menu.pip,run.pip);
  assert.equal(menu.breakReturnEventId,run.eventId);
  assert.equal(menu.lastBreakTurn,run.turn);assert.notEqual(menu.rng,run.rng);
  assert.equal(menu.actions.at(-1).type,'break');assert.equal(validRun(copy(menu)),true);
  if(menu.eventId==='kind-break')invitations++;
  else assert.equal(menu.eventId,'self-care');
  total++;
 }
 assert.ok(total>400);assert.ok(Math.abs(invitations/total-KIND_BREAK_CHANCE)<.07);
});

test('Kind acceptance charges only on choice, retains rest RNG, and records actual clamped recovery',()=>{
 const {menu}=naturalBreak('kind-break');
 const run={...menu,stats:{...menu.stats,cash:80,mood:20,slack:30,energy:40,boss:0},pip:{active:true,remaining:2}};
 const pending=applyChoice(run,0),history=pending.history.at(-1),rested=advance(pending);
 assert.equal(history.eventId,'kind-break');assert.equal(history.speaker,'kind');
 assert.equal(history.delta.cash,-KIND_BREAK_COST);assert.equal(history.delta.slack,16);assert.equal(history.delta.energy,10);
 assert.ok([52,55,58].includes(history.delta.mood));
 assert.ok(['lucky','ordinary','setback'].includes(history.chanceOutcome));
 assert.notEqual(pending.rng,run.rng);assert.equal(pending.stats.boss,0);
 assert.equal(pending.flags.kind_relaxed,1);
 assert.equal(rested.eventId,run.breakReturnEventId);assert.equal(rested.breakReturnEventId,null);
 assert.equal(rested.turn,run.turn);assert.deepEqual(rested.pip,run.pip);
 assert.equal(canRequestBreak(rested),false);assert.equal(validRun(copy(rested)),true);
 const totals=Object.fromEntries(STAT_KEYS.map(key=>[key,0]));
 for(const part of history.breakdown)for(const [key,value]of Object.entries(part.delta))totals[key]+=value;
 assert.deepEqual(totals,history.delta);
 const capped=applyChoice({...run,stats:{...run.stats,mood:99,slack:99,energy:99}},0).history.at(-1);
 assert.equal(capped.delta.mood,1);assert.equal(capped.delta.slack,1);assert.equal(capped.delta.energy,1);
});

test('unaffordable Kind choices reject forged clicks and spending the last funds follows the existing ending rule',()=>{
 const {menu}=naturalBreak('kind-break');
 const poor={...menu,stats:{...menu.stats,cash:KIND_BREAK_COST-1}};
 assert.equal(getEvent(poor).choices[0].available,false);
 assert.throws(()=>applyChoice(poor,0),/Unavailable choice/);
 assert.deepEqual(choose(poor,2).stats,poor.stats);
 const exact={...menu,stats:{...menu.stats,cash:KIND_BREAK_COST}};
 assert.equal(getEvent(exact).choices[0].available,true);
 const ending=choose(exact,0);assert.equal(ending.endingId,'broke-system');assert.equal(ending.completed,true);
});

test('either rejection returns to ordinary self-care without cost, extra rolls, or a second break',()=>{
 const {menu}=naturalBreak('kind-break');
 for(const index of [1,2]){
  const pending=applyChoice(menu,index),declined=advance(pending);
  assert.equal(pending.pendingEffect,'kindDecline');
  assert.deepEqual(declined.stats,menu.stats);assert.equal(declined.rng,menu.rng);
  assert.equal(declined.flags.kind_declined,1);assert.equal(declined.eventId,'self-care');
  assert.equal(declined.breakReturnEventId,menu.breakReturnEventId);
  assert.equal(declined.turn,menu.turn);assert.deepEqual(declined.pip,menu.pip);
  assert.equal(declined.actions.filter(action=>action.type==='break').length,1);
  assert.equal(canRequestBreak(declined),false);assert.equal(requestBreak(declined),declined);
  assert.equal(requestExit(declined),declined);assert.equal(validRun(copy(declined)),true);
  const normalRest=choose(declined,0);
  assert.equal(normalRest.stats.cash,menu.stats.cash-6);
  assert.equal(normalRest.eventId,menu.breakReturnEventId);assert.equal(normalRest.turn,menu.turn);
  assert.equal(canRequestBreak(normalRest),false);
 }
});

test('pending and open invitations guard against duplicate actions and invalid return states',()=>{
 const {menu}=naturalBreak('kind-break');
 assert.equal(canRequestBreak(menu),false);assert.equal(requestBreak(menu),menu);assert.equal(requestExit(menu),menu);
 const pending=applyChoice(menu,0);
 assert.equal(applyChoice(pending,1),pending);assert.equal(requestBreak(pending),pending);assert.equal(requestExit(pending),pending);
 assert.equal(validRun({...menu,breakReturnEventId:null}),false);
 assert.equal(validRun({...menu,breakReturnEventId:'kind-break'}),false);
 assert.equal(validRun({...menu,breakReturnEventId:'exit-menu'}),false);
 const back=choose(choose(menu,1),3);
 assert.equal(back.eventId,menu.breakReturnEventId);assert.equal(back.rng,menu.rng);
 assert.equal(canRequestBreak(back),false);assert.equal(requestBreak(back),back);
});

test('accepted and rejected natural e6 invitations replay identically through JSON saves and completion',()=>{
 for(const index of [0,1,2]){
  const {menu}=naturalBreak('kind-break');
  let run=choose(copy(menu),index);
  if(index!==0)run=choose(copy(run),0);
  run=choose(requestExit(copy(run)),0);
  assert.equal(run.completed,true);assert.equal(validRun(copy(run)),true);
  const direct=replayRun(run.roleId,run.seed,run.actions);
  assert.deepEqual(copy(direct),copy(run));
  const saved=replayRoute({...run,ending:run.endingId});
  assert.deepEqual(saved,copy(run));
  const forged=run.actions.map(action=>action.type==='choice'&&action.eventId==='kind-break'?{...action,eventId:'self-care'}:action);
  assert.throws(()=>replayRun(run.roleId,run.seed,forged),/Replay event mismatch/);
 }
});

test('published cohorts never see Kind or consume invitation RNG during self-care',()=>{
 for(const prefix of ['e2','e3','e4','e5']){
  const {workday,menu}=naturalBreak('self-care',prefix);
  assert.equal(menu.rng,workday.rng);
  assert.equal(menu.eventId,'self-care');
  assert.throws(()=>getEvent({...menu,eventId:'kind-break'}),/Invalid Kind break/);
  assert.equal(validRun({...menu,eventId:'kind-break'}),false);
  assert.equal(choose(menu,0).eventId,workday.eventId);
 }
 for(const prefix of ['legacy','e1']){
  const run=choose(createRun('system',`${prefix}-kind-guard`),0);
  assert.equal(canRequestBreak(run),false);assert.equal(requestBreak(run),run);
  assert.throws(()=>getEvent({...run,eventId:'kind-break'}),/Invalid Kind break/);
 }
});
