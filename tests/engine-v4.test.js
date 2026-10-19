import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { EVENTS } from '../dist/events.js';
import { STAT_KEYS, createRun, getEvent, applyChoice, advance, requestExit, canRequestBreak, requestBreak, replayRun, validRun } from '../dist/engine.js';

const choose=(run,index)=>advance(applyChoice(run,index));
const copy=run=>JSON.parse(JSON.stringify(run));
const boundary=(eventId,stats={},extra={})=>{
 const run=createRun('system','e2-boundary');
 return {...run,eventId,assignment:'honest',rank:4,educationReviewed:true,salaryCutOffered:true,turn:3,...extra,stats:{...run.stats,energy:80,cash:70,mood:80,boss:70,...stats}};
};
const assertBreakdown=run=>{
 const last=run.history.at(-1),sum=Object.fromEntries(STAT_KEYS.map(key=>[key,0]));
 for(const part of last.breakdown)for(const [key,value]of Object.entries(part.delta))sum[key]+=value;
 assert.deepEqual(sum,last.delta,'Every displayed contribution must sum to the actual bounded change');
};

test('e2 PIP changes procedure without magically restoring boss mood',()=>{
 for(const eventId of ['crisis-boss','paperwork']){
  const run=boundary(eventId,{boss:4},{resumeEventId:EVENTS[0].id});
  const pending=applyChoice(run,2),next=advance(pending);
  assert.equal(pending.stats.boss,4);assert.equal(pending.history.at(-1).delta.boss,0);assertBreakdown(pending);
  assert.equal(next.pip.remaining,3);assert.equal(next.crisisCooldown,3);assert.equal(next.eventId,EVENTS[0].id);
 }
 for(const index of [1,2]){
  const pending=applyChoice(boundary('pip-passed',{boss:4},{pip:{active:false,remaining:0},pipCount:1,resumeEventId:EVENTS[0].id}),index);
  const next=advance(pending);
  assert.equal(pending.stats.boss,4);assert.equal(next.pip,null);assert.equal(next.crisisCooldown,3);assert.equal(next.eventId,EVENTS[0].id);assertBreakdown(pending);
 }
 const old=createRun('system','e1-pip-control');
 const legacy=applyChoice({...old,eventId:'crisis-boss',stats:{...old.stats,boss:0}},2);
 assert.equal(legacy.stats.boss,35);
});

test('e2 workdays drain mood even for choices without an explicit mood cost',()=>{
 const drains=new Set();
 for(let i=0;i<80;i++){
  const initial=boundary(EVENTS[0].id,{mood:70,energy:80,boss:90},{seed:`e2-workday-${i}`,rng:createRun('system',`e2-workday-${i}`).rng});
  const pending=applyChoice(initial,1),row=pending.history.at(-1).breakdown.find(part=>part.source==='workday');
  assert.ok(pending.stats.mood<initial.stats.mood);assert.ok(row.delta.mood<=-4&&row.delta.mood>=-7);drains.add(row.delta.mood);assertBreakdown(pending);
 }
 assert.equal(drains.size,4);
 const stressful=boundary(EVENTS[0].id,{energy:22,mood:80},{pip:{active:true,remaining:3},salaryCut:{percent:20,from:60,to:48,status:'accepted'}});
 const pending=applyChoice(stressful,1),parts=pending.history.at(-1).breakdown;
 assert.equal(parts.find(x=>x.source==='pip-pressure').delta.mood,-3);
 assert.equal(parts.find(x=>x.source==='fatigue').delta.mood,-2);
 assert.equal(parts.find(x=>x.source==='pay-cut').delta.mood,-2);
 assert.equal(pending.pip.remaining,2);assertBreakdown(pending);
 const exhausted=applyChoice(boundary(EVENTS[0].id,{mood:3}),1);assert.equal(exhausted.stats.mood,0);assertBreakdown(exhausted);
});

test('self-care spends real savings, preserves the work event and supports deterministic completion replay',()=>{
 const first=createRun('system','e2-break-replay'),daily=choose(first,0);
 assert.equal(canRequestBreak(first),false);assert.equal(canRequestBreak(daily),true);
 const menu=requestBreak(daily);assert.equal(menu.eventId,'self-care');assert.equal(getEvent(menu).kind,'self-care');assert.equal(validRun(copy(menu)),true);
 assert.equal(requestBreak(menu),menu);assert.equal(requestExit(menu),menu);assert.equal(menu.turn,daily.turn);
 const pending=applyChoice(menu,1),next=advance(pending);
 assert.equal(pending.stats.cash,daily.stats.cash-12);assert.ok(pending.stats.mood>daily.stats.mood);
 assert.equal(pending.history.at(-1).breakdown[0].delta.cash,-12);assert.ok(['lucky','setback','ordinary'].includes(pending.history.at(-1).chanceOutcome));assertBreakdown(pending);
 assert.equal(next.eventId,daily.eventId);assert.equal(next.turn,daily.turn);assert.equal(next.breakReturnEventId,null);assert.equal(canRequestBreak(next),false);assert.equal(requestBreak(next),next);
 assert.equal(validRun(copy(pending)),true);assert.equal(validRun(copy(next)),true);
 const completed=choose(requestExit(next),0);assert.equal(completed.completed,true);
 assert.deepEqual(replayRun(first.roleId,first.seed,completed.actions),completed);
 assert.throws(()=>replayRun(first.roleId,first.seed,[...daily.actions,{type:'break'},{type:'choice',eventId:'self-care',index:1},{type:'break'}]),/Unavailable break/);
 assert.throws(()=>replayRun(first.roleId,first.seed,[{type:'break'}]),/Unavailable break/);
 assert.throws(()=>replayRun(first.roleId,'e1-break-replay',[{type:'break'}]),/Unavailable break/);
});

test('self-care affordability, cancellation and interruption guards prevent free or repeated recovery',()=>{
 const low=boundary(EVENTS[0].id,{cash:6}),menu=requestBreak(low),options=getEvent(menu).choices;
 assert.deepEqual(options.slice(0,3).map(c=>c.available),[false,false,false]);
 for(const index of [0,1,2])assert.throws(()=>applyChoice(menu,index),/Unavailable choice/);
 const cancelled=choose(menu,3);assert.deepEqual(cancelled.stats,low.stats);assert.equal(cancelled.rng,low.rng);assert.equal(cancelled.turn,low.turn);assert.equal(canRequestBreak(cancelled),false);
 const afterWork=choose({...cancelled,stats:{...cancelled.stats,cash:70}},0);assert.equal(afterWork.turn,low.turn+1);assert.equal(canRequestBreak(afterWork),true);
 for(const eventId of ['onboarding','education-review','promotion-review','crisis-boss','crisis-mood','paperwork','pip-review','pip-passed','salary-cut','exit-menu','career-exit']){
  const run=boundary(eventId,{}, {salaryCut:{percent:20,from:60,to:48,status:'pending'}});assert.equal(canRequestBreak(run),false,eventId);assert.equal(requestBreak(run),run);
 }
 assert.equal(canRequestBreak(applyChoice(low,0)),false);
 assert.equal(canRequestBreak({...low,resumeEventId:EVENTS[1].id}),false);
 assert.equal(canRequestBreak({...low,exitReturnEventId:EVENTS[1].id}),false);
 const duringPip=boundary(EVENTS[0].id,{}, {pip:{active:true,remaining:2}}),rested=choose(requestBreak(duringPip),0);
 assert.equal(rested.pip.remaining,2);assert.equal(rested.turn,duringPip.turn);assert.equal(rested.history.at(-1).breakdown.some(x=>x.source==='workday'),false);
 for(let i=0;i<30;i++){
  const almostFull=boundary(EVENTS[0].id,{mood:98},{seed:`e2-full-rest-${i}`,rng:createRun('system',`e2-full-rest-${i}`).rng});
  const recovered=applyChoice(requestBreak(almostFull),0);assert.equal(recovered.stats.mood,100);assertBreakdown(recovered);
 }
 for(const change of [{lastBreakTurn:NaN},{lastBreakTurn:99},{breakReturnEventId:'no-such-event'}])assert.equal(validRun({...low,...change}),false);
});

test('e2 result details disclose actual RNG and clamped net changes only after a decision',()=>{
 const seen=new Set();
 for(let i=0;i<120;i++){
  const run=boundary(EVENTS[0].id,{mood:98,boss:98,skill:98},{seed:`e2-results-${i}`,rng:createRun('system',`e2-results-${i}`).rng});
  const before=copy(run),event=getEvent(run),pending=applyChoice(run,0);seen.add(pending.history.at(-1).chanceOutcome);
  assert.equal(event.chanceOutcome,undefined);assert.equal(run.history.length,0);assert.deepEqual(run,before);assertBreakdown(pending);
  for(const key of STAT_KEYS)assert.equal(pending.history.at(-1).delta[key],pending.stats[key]-before.stats[key]);
 }
 for(const kind of ['ordinary','lucky','setback'])assert.ok(seen.has(kind));
 const payday=applyChoice(boundary(EVENTS[0].id,{cash:99},{turn:4,pay:60}),0),last=payday.history.at(-1);
 assert.equal(last.breakdown.find(part=>part.source==='income').delta.cash,1);
 assert.match(last.result,/存款實際 \+1。/);assertBreakdown(payday);
});

test('old and e1 runs cannot draw rules2 events, including the exhausted-pool fallback',()=>{
 const probe={...EVENTS[0],id:'test-rules2-only',minRules:2,weight:10000};EVENTS.push(probe);
 try {
  for(const seed of ['legacy','e1-legacy'])for(let i=0;i<30;i++){
   const initial=createRun('system',`${seed}-${i}`),state={...initial,eventId:EVENTS[0].id,educationReviewed:true,salaryCutOffered:true,rank:4,turn:2,seen:EVENTS.map(e=>e.id),stats:{...initial.stats,mood:90,energy:90,boss:90,cash:90}};
   assert.notEqual(choose(state,0).eventId,probe.id);
   assert.throws(()=>getEvent({...state,eventId:probe.id}),/Unknown event/);
  }
 }finally{EVENTS.pop();}
});

test('e1 persisted runs retain the full previous state, including RNG, history and completed results',()=>{
 const fixtures=JSON.parse(readFileSync(new URL('./fixtures/legacy-e1-routes.json',import.meta.url),'utf8'));
 assert.equal(fixtures.length,4);
 for(const fixture of fixtures){
  const run=replayRun(fixture.roleId,fixture.seed,fixture.actions);
  const actual=createHash('sha256').update(JSON.stringify(run)).digest('hex');
  assert.equal(actual,fixture.stateSha256,fixture.ending);assert.equal(validRun(copy(run)),true);
 }
});

test('published e2 runs retain their complete state after later chronicle additions',()=>{
 const fixtures=JSON.parse(readFileSync(new URL('./fixtures/legacy-e2-routes.json',import.meta.url),'utf8'));
 assert.equal(fixtures.length,4);
 for(const fixture of fixtures){
  const run=replayRun(fixture.roleId,fixture.seed,fixture.actions);
  assert.equal(createHash('sha256').update(JSON.stringify(run)).digest('hex'),fixture.stateSha256,fixture.ending);
  assert.equal(validRun(copy(run)),true);
 }
});

test('latest story cohort draws new scenes while e2 keeps its published pool and break replay',()=>{
 const probe={...EVENTS[0],id:'test-rules3-only',minRules:3,weight:1e12};EVENTS.push(probe);
 try{
  for(let i=0;i<20;i++){
   const older=choose(createRun('system',`e2-cohort-${i}`),0);
   assert.notEqual(older.eventId,probe.id);
   assert.throws(()=>getEvent({...older,eventId:probe.id}),/Unknown event/);
   const latest=choose(createRun('system',`e3-cohort-${i}`),0);
   assert.equal(latest.eventId,probe.id);assert.equal(canRequestBreak(latest),true);
   const rested=choose(requestBreak(latest),0);
   assert.equal(rested.eventId,probe.id);assert.equal(validRun(copy(rested)),true);
   const finished=choose(requestExit(rested),0);
   assert.deepEqual(replayRun(finished.roleId,finished.seed,finished.actions),finished);
  }
 }finally{EVENTS.pop();}
});
