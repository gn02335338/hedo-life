import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildEndingReport} from '../dist/ending-report.js';
import {createRun,replayRun,requestPatronageReply,advance,requestExit,applyChoice,STAT_KEYS,validRun} from '../dist/engine.js';

const {routes}=JSON.parse(readFileSync(new URL('./fixtures/patronage-routes-v29.json',import.meta.url),'utf8'));
const appointed=gender=>{
 const route=routes.find(item=>item.id===`application-${gender}-success`);
 return replayRun(route.roleId,route.seed,route.actions);
};
const verify=run=>{
 assert.equal(validRun(run),true);
 const original=JSON.stringify(run),report=buildEndingReport(run),initial=createRun(run.roleId,run.seed);
 assert.equal(report.metadata.complete,true);
 assert.equal(report.metadata.decisionCount,run.history.length);assert.equal(report.metadata.workTurns,run.turn);
 assert.deepEqual(report.samples[0].stats,initial.stats);assert.deepEqual(report.samples.at(-1).stats,run.stats);
 for(const key of STAT_KEYS){
  const metric=report.stats.find(item=>item.key===key);
  assert.equal(metric.available,true,key);assert.equal(metric.reason,null,key);
  assert.equal(metric.delta,run.history.reduce((sum,row)=>sum+row.delta[key],0),key);
 }
 for(const trend of report.trends){assert.equal(trend.available,true);assert.equal(trend.points.length,run.history.length+1);}
 assert.equal(JSON.stringify(run),original,'reporting must never change a pending reply or completed life');
 return report;
};

test('natural pending patronage replies and completed lives keep full visual report histories',()=>{
 for(const [gender,target] of [['male','wing'],['female','helen']]){
  const source=appointed(gender);assert.ok(source.patronage);
  const pending=requestPatronageReply(source,target),pendingReport=verify(pending);
  assert.notEqual(pending,source);assert.equal(pending.pending,true);
  assert.equal(pendingReport.samples.at(-1).label,'自己人發話');
  assert.equal(pendingReport.samples.at(-1).turn,source.turn);
  assert.deepEqual(pendingReport.samples.at(-2).stats,source.stats);
  const resumed=advance(pending);verify(resumed);assert.equal(resumed.turn,source.turn);
  const exit=requestExit(resumed);assert.notEqual(exit,resumed);
  const leaving=applyChoice(exit,0);verify(leaving);
  const completed=advance(leaving);assert.equal(completed.completed,true);verify(completed);
  assert.deepEqual(replayRun(completed.roleId,completed.seed,completed.actions),completed);
 }
});

test('missing, misdirected and malformed patronage evidence suppresses invented report origins',()=>{
 const source=appointed('female'),pending=requestPatronageReply(source,'helen');
 assert.notEqual(pending,source);verify(pending);
 for(const change of [
  run=>{run.history.pop();},
  run=>{run.actions.pop();},
  run=>{run.history.at(-1).patronageOutcome.origin='unrelated';},
  run=>{run.history.at(-1).patronageOutcome.target='wing';},
  run=>{run.history.at(-1).patronageOutcome.mode='flattery';},
  run=>{run.history.at(-1).patronageOutcome.version=2;},
  run=>{run.actions.at(-1).version=2;},
  run=>{run.actions.at(-1).target='wing';},
 ]){
  const invalid=structuredClone(pending);change(invalid);
  const report=buildEndingReport(invalid);
  assert.equal(report.metadata.complete,false);
  assert.ok(report.stats.every(item=>item.reason==='incomplete-history'&&item.start===null&&item.delta===null));
  assert.ok(report.trends.every(item=>item.available===false&&item.points.length===0));
 }
});
