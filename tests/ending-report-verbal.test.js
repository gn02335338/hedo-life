import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildEndingReport} from '../dist/ending-report.js';
import {createRun,STAT_KEYS} from '../dist/engine.js';
import {replayRoute} from './find-routes-v3.mjs';

const load=name=>JSON.parse(readFileSync(new URL(`./fixtures/${name}`,import.meta.url))).routes;
const sceneRoutes=load('verbal-scene-routes.json');
const legacyRoutes=load('verbal-routes-v30.json').filter(route=>route.kind!=='blocked');

function verifyReport(route,actions){
 const expected=new Map();
 const run=replayRoute({...route,actions},state=>expected.set(state.history.length,{...state.stats}));
 const before=JSON.stringify(run),report=buildEndingReport(run);
 assert.equal(report.metadata.complete,true,route.id);
 assert.equal(report.metadata.decisionCount,run.history.length,route.id);
 assert.deepEqual(report.samples[0].stats,createRun(route.roleId,route.seed).stats,route.id);
 for(const sample of report.samples)assert.deepEqual(sample.stats,expected.get(sample.decisionIndex),`${route.id}/${sample.decisionIndex}`);
 for(const key of STAT_KEYS){
  const metric=report.stats.find(item=>item.key===key);
  assert.equal(metric.delta,run.history.reduce((sum,row)=>sum+row.delta[key],0),`${route.id}/${key}`);
 }
 assert.equal(JSON.stringify(run),before,'report projection does not change a save');
 return run;
}

test('natural v1 and scene-aware verbal event/result responses retain exact report origins through completion',()=>{
 assert.ok(sceneRoutes.some(route=>route.phase==='event'));
 assert.ok(sceneRoutes.some(route=>route.phase==='result'));
 assert.ok(sceneRoutes.some(route=>route.id==='onboarding-dismissed'));
 for(const route of [...legacyRoutes,...sceneRoutes]){
  verifyReport(route,route.actions);
  const done=verifyReport(route,route.completionActions);
  assert.equal(done.completed,true,route.id);
 }
});

test('explicit verbal decisions project their real source indices, including the second onboarding answer',()=>{
 const decisions=sceneRoutes.filter(route=>route.kind==='decision');
 assert.ok(decisions.length>20);
 const onboarding=decisions.find(route=>route.id==='decision-onboarding-1-event');
 assert.equal(onboarding.sourceIndex,2);
 assert.equal(onboarding.actions.at(-1).index,1);
 for(const route of decisions){
  const run=verifyReport(route,route.actions);
  assert.equal(run.history.at(-1).eventId,route.sourceEventId,route.id);
  assert.equal(run.history.at(-1).choiceIndex,route.sourceIndex,route.id);
 }
});

test('verbal reports still reject truncated, reordered or incorrectly mapped action history',()=>{
 for(const id of ['onboarding-dismissed','work-result','decision-onboarding-1-event','decision-salary-cut-0-event']){
  const route=sceneRoutes.find(route=>route.id===id);assert.ok(route,id);
  const run=replayRoute({...route,actions:route.completionActions});
  const speechIndex=run.history.findIndex(row=>row.verbalOutcome?.version===2);assert.ok(speechIndex>=0);
  const shortened=structuredClone(run);shortened.history.splice(speechIndex,1);
  const report=buildEndingReport(shortened);
  assert.equal(report.metadata.complete,false,id);
  const reason=shortened.history.length?'incomplete-history':'no-history';
  assert.ok(report.stats.every(metric=>metric.reason===reason&&metric.start===null&&metric.end===run.stats[metric.key]),id);
  const changed=structuredClone(run);changed.history[speechIndex].verbalOutcome.origin='unrelated-scene';
  assert.equal(buildEndingReport(changed).metadata.complete,false,id);
 }
 const route=sceneRoutes.find(route=>route.id==='decision-onboarding-1-event');
 const wrongIndex=replayRoute({...route,actions:route.actions});wrongIndex.history.at(-1).choiceIndex=1;
 assert.equal(buildEndingReport(wrongIndex).metadata.complete,false,'wrapper index 1 is not source onboarding index 1');
 const reordered=replayRoute({...route,actions:route.actions});
 [reordered.history[0],reordered.history[1]]=[reordered.history[1],reordered.history[0]];
 assert.equal(buildEndingReport(reordered).metadata.complete,false);
});
