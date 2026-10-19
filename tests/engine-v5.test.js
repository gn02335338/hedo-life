import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {EVENTS} from '../dist/events.js';
import {STAT_KEYS,createRun,getEvent,applyChoice,advance,requestBreak,requestExit,replayRun,validRun} from '../dist/engine.js';
const choose=(run,index)=>advance(applyChoice(run,index));

test('published e3 saves keep their complete state after image-story expansion',()=>{
 const fixtures=JSON.parse(readFileSync(new URL('./fixtures/legacy-e3-routes.json',import.meta.url),'utf8'));
 for(const fixture of fixtures){
  const run=replayRun(fixture.roleId,fixture.seed,fixture.actions);
  assert.equal(createHash('sha256').update(JSON.stringify(run)).digest('hex'),fixture.stateSha256,fixture.ending);
  assert.equal(validRun(JSON.parse(JSON.stringify(run))),true);
 }
});

test('group-message lottery resolves after choice, varies outcomes and accounts for actual stat changes',()=>{
 const outcomes=new Set();
 for(let i=0;i<90;i++){
  const initial=createRun('system',`e4-message-${i}`);
  const run={...initial,eventId:'wing-message-lottery',turn:4,stats:{...initial.stats,mood:85,boss:75,energy:85,cash:70}};
  const snapshot=JSON.stringify(run),event=getEvent(run);
  assert.equal(event.eventOutcome,undefined);assert.equal(run.history.length,0);
  const pending=applyChoice(run,0),last=pending.history.at(-1);
  assert.equal(JSON.stringify(run),snapshot);
  assert.equal(last.eventOutcome.label,'群組抽籤');outcomes.add(last.eventOutcome.result);
  assert.deepEqual(applyChoice(run,0),pending);
  assert.equal(validRun(JSON.parse(JSON.stringify(pending))),true);
  const totals=Object.fromEntries(STAT_KEYS.map(k=>[k,0]));
  for(const part of last.breakdown)for(const [key,value]of Object.entries(part.delta))totals[key]+=value;
  assert.deepEqual(totals,last.delta);
 }
 assert.deepEqual([...outcomes].sort(),['留言存活','整則消失','只剩標註通知'].sort());
});

test('PIP-only image scenes cannot be drawn outside PIP, including exhausted-pool fallback',()=>{
 const probe={...EVENTS.find(e=>e.id==='pip-lucky-mushroom'),id:'test-pip-image',weight:1e12};EVENTS.push(probe);
 try{
  for(const seen of [[],EVENTS.map(e=>e.id)]){
   const initial=createRun('system','e4-pip-context');
   const base={...initial,eventId:EVENTS[0].id,turn:3,seen,rank:4,educationReviewed:true,salaryCutOffered:true,stats:{...initial.stats,energy:90,cash:80,boss:90,mood:90}};
   assert.notEqual(choose(base,0).eventId,probe.id);
   const active=choose({...base,pip:{active:true,remaining:3}},0);
   assert.equal(active.eventId,probe.id);
   const pending=applyChoice(active,0);
   assert.equal(pending.pip.active,true);assert.equal(pending.pip.remaining,1);
   assert.equal(pending.pendingEffect,undefined);assert.equal(pending.flags.pip_passed,undefined);
  }
 }finally{EVENTS.pop();}
});

test('image-story cohort is unavailable to older saves and replays self-care correctly',()=>{
 const probe={...EVENTS[0],id:'test-rules4-only',minRules:4,weight:1e12};EVENTS.push(probe);
 try{
  for(let i=0;i<12;i++){
   for(const prefix of ['legacy','e1','e2','e3']){
    const run=choose(createRun('system',`${prefix}-v5-${i}`),0);
    assert.notEqual(run.eventId,probe.id);
    assert.throws(()=>getEvent({...run,eventId:probe.id}),/Unknown event/);
    const exhausted={...run,eventId:EVENTS[0].id,seen:EVENTS.map(e=>e.id),turn:2,rank:4,educationReviewed:true,salaryCutOffered:true,stats:{...run.stats,mood:90,energy:90,boss:90,cash:90}};
    assert.notEqual(choose(exhausted,0).eventId,probe.id);
   }
   const run=choose(createRun('system',`e4-v5-${i}`),0);
   assert.equal(run.eventId,probe.id);
   const rested=choose(requestBreak(run),0);
   assert.equal(rested.eventId,probe.id);
   const finished=choose(requestExit(rested),0);
   assert.deepEqual(replayRun(finished.roleId,finished.seed,finished.actions),finished);
  }
 }finally{EVENTS.pop();}
});
