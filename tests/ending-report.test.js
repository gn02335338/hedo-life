import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ENDINGS} from '../dist/endings.js';
import {buildEndingReport} from '../dist/ending-report.js';
import {createRun,replayRun,STAT_KEYS} from '../dist/engine.js';
import {replayRoute} from './find-routes-v3.mjs';

const {routes}=JSON.parse(readFileSync(new URL('../research/reachability-v3.json',import.meta.url)));
const {routes:mealRoutes}=JSON.parse(readFileSync(new URL('./fixtures/mood-meals-routes-v25.json',import.meta.url)));
const copy=value=>structuredClone(value);
const stat=(report,key)=>report.stats.find(item=>item.key===key);

test('all natural legacy and current endings report the actual initial and committed states, including day-one exits and clamped limits',()=>{
 assert.equal(routes.length,ENDINGS.length);
 let boundaryValues=0,dayOneEndings=0;
 for(const route of routes){
  assert.match(route.seed,/^e(?:31|32|33|34|35|36|37)-/);
  const expected=new Map();
  const run=replayRoute(route,state=>expected.set(state.history.length,{...state.stats}));
  const before=JSON.stringify(run),report=buildEndingReport(run),initial=createRun(route.roleId,route.seed);
  assert.equal(report.metadata.complete,true,route.ending);
  assert.equal(report.metadata.workTurns,run.turn);
  assert.equal(report.metadata.decisionCount,run.history.length);
  assert.equal(report.metadata.axisLabel,'選擇進程');
  assert.equal(report.samples.length,run.history.length+1);
  assert.deepEqual(report.samples[0].stats,initial.stats);
  assert.deepEqual(report.samples.at(-1).stats,run.stats);
  for(const sample of report.samples){
   assert.deepEqual(sample.stats,expected.get(sample.decisionIndex),`${route.ending}/${sample.decisionIndex}`);
   if(sample.eventId?.startsWith('wealth-'))assert.equal(sample.label,'離職後規劃');
   if(sample.decisionIndex)assert.equal(sample.turn,run.history[sample.decisionIndex-1].turn);
   boundaryValues+=Object.values(sample.stats).filter(value=>value===0||value===100).length;
  }
  for(const key of STAT_KEYS){
   const item=stat(report,key);
   assert.equal(item.start,initial.stats[key]);
   assert.equal(item.end,run.stats[key]);
   assert.equal(item.delta,run.history.reduce((total,row)=>total+row.delta[key],0));
  }
  if(run.turn===0){dayOneEndings++;assert.ok(report.metadata.decisionCount>0);}
  assert.equal(JSON.stringify(run),before,'reporting must not alter a run');
 }
 assert.ok(boundaryValues>100,'real routes exercise both clipped limits');
 assert.ok(dayOneEndings>0);
});

test('natural meal, PIP, recovery and self-destruct steps retain their decision positions without inventing workdays',()=>{
 const dinner=mealRoutes.find(route=>route.id==='meal-jack-reply-0');
 const run=replayRun(dinner.roleId,dinner.seed,dinner.actions),report=buildEndingReport(run);
 const mealPoints=report.samples.filter(sample=>sample.eventId?.startsWith('meal-'));
 assert.ok(mealPoints.length>=2);
 assert.ok(mealPoints.every(sample=>sample.label==='飯局'));
 assert.equal(new Set(mealPoints.map(sample=>sample.turn)).size,1);
 assert.ok(new Set(mealPoints.map(sample=>sample.decisionIndex)).size>1);
 assert.equal(report.metadata.workTurns,run.turn);
 assert.ok(report.metadata.decisionCount>report.metadata.workTurns);
 assert.ok(report.samples.some(sample=>sample.label==='休整'));
 for(const point of mealPoints){
  for(const trend of report.trends)assert.equal(trend.points[point.decisionIndex].turn,point.turn);
 }
 const exploded=mealRoutes.find(route=>route.id==='self-destruct-2-reply-0');
 const recovery=buildEndingReport(replayRun(exploded.roleId,exploded.seed,exploded.actions));
 assert.ok(recovery.samples.some(sample=>sample.label==='崩潰'));
 assert.ok(recovery.samples.some(sample=>sample.label==='自爆'));
 const pipRoute=routes.find(route=>route.actions.some(action=>action.eventId==='pip-review'));
 assert.ok(buildEndingReport(replayRoute(pipRoute)).samples.some(sample=>sample.label==='PIP'));
});

test('missing deltas, invalid final values and impossible reverse states suppress only affected origins and trends',()=>{
 const stats=Object.fromEntries(STAT_KEYS.map(key=>[key,50]));
 const delta=Object.fromEntries(STAT_KEYS.map(key=>[key,0]));
 delete delta.mood;
 delta.cash=NaN;
 delta.energy=90; // A 50 endpoint minus 90 cannot be an actual previous value.
 stats.boss=Infinity;
 const report=buildEndingReport({stats,turn:2,history:[{eventId:'work',kind:'daily',turn:1,delta}]});
 for(const key of ['mood','cash','energy','boss']){
  const item=stat(report,key);
  assert.equal(item.available,false);
  assert.equal(item.start,null);
  assert.equal(item.delta,null);
  assert.ok(report.samples.every(sample=>sample.stats[key]===null));
 }
 assert.equal(stat(report,'boss').end,null);
 assert.equal(stat(report,'mood').end,50);
 assert.equal(stat(report,'energy').reason,'out-of-range');
 assert.ok(report.trends.every(trend=>trend.points.length===0));
 assert.deepEqual(report.metadata.unavailableKeys,['energy','cash','boss','mood']);
 assert.equal(report.metadata.complete,false);
 assert.equal(stat(report,'dream').start,50);
 assert.equal(stat(report,'dream').delta,0);
 assert.equal(stat(report,'trust').available,true);
});

test('absent and shortened history shows known endpoints without fabricating a starting state; self-contained older rows remain usable',()=>{
 const route=routes.find(route=>route.turns>10),run=replayRoute(route);
 for(const history of [undefined,[],run.history.slice(1)]){
  const report=buildEndingReport({...run,history});
  assert.equal(report.metadata.complete,false);
  assert.ok(report.stats.every(item=>item.start===null&&item.delta===null&&item.end===run.stats[item.key]));
  assert.ok(report.trends.every(trend=>!trend.available&&trend.points.length===0));
 }
 const {actions,...older}=run;
 assert.equal(buildEndingReport(older).metadata.complete,true);
 const unknown=buildEndingReport(null);
 assert.equal(unknown.metadata.workTurns,null);
 assert.ok(unknown.stats.every(item=>item.start===null&&item.end===null&&item.delta===null));
});

test('reporting frozen old data consumes no RNG, preserves neutral metric changes and owns its output values',()=>{
 const old=replayRoute(routes.find(route=>route.actions.length>5));
 const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
 const run=freeze(copy(old)),random=Math.random;
 let report;
 try{Math.random=()=>{throw new Error('reporting must not draw randomness');};report=buildEndingReport(run);}
 finally{Math.random=random;}
 assert.deepEqual(report.abilities.map(item=>item.key),['skill','slack','lick']);
 assert.deepEqual(report.trends.map(item=>item.key),['mood','energy','cash']);
 for(const key of ['boss','dream'])assert.deepEqual(Object.keys(stat(report,key)),['key','label','start','end','delta','available','reason']);
 report.samples.at(-1).stats.cash=-1;
 assert.equal(run.stats.cash,old.stats.cash);
 assert.equal(buildEndingReport(run).samples.at(-1).stats.cash,old.stats.cash);
});
