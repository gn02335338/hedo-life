import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {createRun,getEvent,getRageTargets,canRequestRage,requestRage,applyChoice,advance,requestExit,requestBreak,requestCareer,requestRaise,replayRun,validRun} from '../dist/engine.js';
import {deriveCharacterStats,CHARACTER_IDS,CHARACTER_METRICS} from '../dist/character-stats.js';
import {deriveAchievements} from '../dist/achievements.js';
import {validateCompletion} from '../worker/http.js';
import {rageParticipantsFor} from '../dist/rage-participants.js';

const GROUP=['erich','jenjen','sonny'];
const copy=value=>JSON.parse(JSON.stringify(value));
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const routes=()=>JSON.parse(readFileSync(new URL('./fixtures/rage-group-routes.json',import.meta.url))).routes;
const handlers={exit:requestExit,break:requestBreak,career:requestCareer,raise:requestRaise};
function play(route,{saved=false,actions=route.actions,hashes=false}={}){
 let run=createRun(route.roleId,route.seed);const trace=[],checkpoints=[];
 const checkpoint=()=>{if(saved)run=copy(run);assert.equal(validRun(run),true,`${route.id||route.ending}/${run.eventId}`);if(hashes)checkpoints.push(hash(run));};checkpoint();
 for(let index=0;index<actions.length;index++){
  const action=actions[index],before=copy(run);let pending=null;
  if(action.type==='choice'){
   assert.equal(run.eventId,action.eventId);run=applyChoice(run,action.index);checkpoint();pending=copy(run);
   if(!(actions[index+1]?.type==='rage'&&actions[index+1].phase==='result'))run=advance(run);
  }else if(action.type==='rage'){
   run=Object.hasOwn(action,'target')?requestRage(run,action.target):requestRage(run);assert.notEqual(run,before);checkpoint();pending=copy(run);run=advance(run);
  }else run=handlers[action.type](run);
  checkpoint();trace.push({action,before,pending,after:copy(run)});
 }
 return{run,trace,checkpoints};
}

test('HTTP rage envelopes accept an optional group target only in e14+ and reject undeclared fields',()=>{
 const proof={runId:randomUUID(),roleId:'system',seed:'e20-group-http',actions:[{type:'rage',phase:'event',eventId:'crisis-boss',target:'erich'}]};
 for(let cohort=14;cohort<=20;cohort++)for(const target of CHARACTER_IDS)assert.deepEqual(validateCompletion({...proof,seed:`e${cohort}-group-http`,actions:[{...proof.actions[0],target}]},{system:{}}).actions[0].target,target);
 assert.doesNotThrow(()=>validateCompletion({...proof,actions:[{type:'rage',phase:'result',eventId:'paperwork'}]},{system:{}}));
 assert.doesNotThrow(()=>validateCompletion({...proof,seed:'e13-old-http',actions:[{type:'rage'}]},{system:{}}));
 for(const action of [{...proof.actions[0],target:'nobody'},{...proof.actions[0],target:null},{...proof.actions[0],target:1},{...proof.actions[0],target:undefined},{...proof.actions[0],target:['erich']},{...proof.actions[0],extra:true},{...proof.actions[0],phase:'later'}])assert.throws(()=>validateCompletion({...proof,actions:[action]},{system:{}}),error=>error.status===400);
 for(const action of [{type:'rage',target:'erich'},{type:'rage',phase:'event'},{type:'rage',extra:true}])assert.throws(()=>validateCompletion({...proof,seed:'e13-old-http',actions:[action]},{system:{}}),error=>error.status===400);
});

test('only explicit co-present groups offer multiple targets, without promoting mentioned names into the room',()=>{
 const groups={
  'meimei-missing-ticket':['meimei','jack'],'floor-notice':['hope','sonny'],'banquet-welcome':['rick','wing'],
  'dp-kpi-patch':['jenjen','erich'],'dp-retention-bonus':['rick','hope'],
 };
 for(const [id,people]of Object.entries(groups)){
  assert.deepEqual(rageParticipantsFor({id,speaker:people[0]},people[0]),people);
  assert.deepEqual(rageParticipantsFor({id,speaker:'spencer'},'spencer'),['spencer']);
 }
 assert.deepEqual(rageParticipantsFor({id:'crisis-boss',speaker:'exit-team'},'erich'),GROUP);
 assert.deepEqual(rageParticipantsFor({id:'unregistered-scene',speaker:'wing',body:'法師、希望和阿福的名字都出現在這封信裡。'},'wing'),['wing']);
 assert.deepEqual(rageParticipantsFor({speaker:'exit-team'},null),[]);
 const found=new Set(),report=JSON.parse(readFileSync(new URL('../research/reachability-v3.json',import.meta.url)));
 for(const route of report.routes){
  for(const {before}of play(route).trace){
   const expected=groups[before.eventId];if(!expected||found.has(before.eventId)||!canRequestRage(before))continue;
   assert.deepEqual(getRageTargets(before),expected,before.eventId);
   for(const target of expected){const selected=requestRage(before,target);assert.notEqual(selected,before);assert.equal(selected.rageContext.target,target);assert.equal(selected.history.at(-1).speaker,target);assert.equal(validRun(copy(selected)),true);}
   found.add(before.eventId);
  }
  if(found.size===Object.keys(groups).length)break;
 }
 assert.deepEqual([...found].sort(),Object.keys(groups).sort());
});

test('natural group witnesses cover event/result, all three participants, and imagined/real outcomes',()=>{
 const fixtures=routes();assert.equal(fixtures.length,12);
 assert.deepEqual(fixtures.map(route=>route.id).sort(),['event','result'].flatMap(phase=>GROUP.flatMap(target=>['imagined','real'].map(mode=>`${phase}-${target}-${mode}`))).sort());
 for(const route of fixtures){
  const direct=play(route),saved=play(route,{saved:true});assert.deepEqual(saved.run,direct.run,route.id);
  assert.deepEqual(replayRun(route.roleId,route.seed,route.actions),direct.run,route.id);
  assert.deepEqual({eventId:direct.run.eventId,turn:direct.run.turn,endingId:direct.run.endingId,completed:direct.run.completed},route.expected);
  const selected=direct.trace.findLast(row=>row.action.type==='rage'&&Object.hasOwn(row.action,'target'));assert.ok(selected);
  assert.deepEqual(getRageTargets(selected.before),GROUP);assert.equal(canRequestRage(selected.before),true);
  assert.equal(selected.pending.rageContext.target,route.target);assert.equal(selected.pending.rageContext.mode,route.mode);assert.equal(selected.pending.rageContext.phase,route.phase);
  assert.equal(selected.pending.history.at(-1).speaker,route.target);assert.equal(getEvent(selected.pending).speaker,route.target);
  assert.deepEqual(Object.keys(selected.action).sort(),['type','phase','eventId','target'].sort());
  assert.deepEqual(route.baseActions,route.actions.slice(0,-1));
  assert.deepEqual(route.completionActions.slice(0,route.actions.length),route.actions);
  const ended=play(route,{saved:true,actions:route.completionActions}).run;assert.equal(ended.completed,true);assert.deepEqual(replayRun(route.roleId,route.seed,route.completionActions),ended);
 }
});

test('a group hit changes only the selected participant, preserving other character counts and badges',()=>{
 for(const route of routes()){
  const {trace}=play(route),step=trace.findLast(row=>row.action.type==='rage'&&Object.hasOwn(row.action,'target'));
  const before=deriveCharacterStats(step.before),after=deriveCharacterStats(step.pending);
  for(const id of CHARACTER_IDS){
   const a=before.find(row=>row.id===id),b=after.find(row=>row.id===id);
   if(id!==route.target){assert.deepEqual(b,a,`${route.id}/${id}`);assert.equal(step.pending.flags[`rage_target_${id}`]||0,step.before.flags[`rage_target_${id}`]||0);continue;}
   assert.equal(b.encounters,a.encounters+1);assert.equal(b.imaginedHits,a.imaginedHits+Number(route.mode==='imagined'));assert.equal(b.realHits,a.realHits+Number(route.mode==='real'));
   assert.equal(step.pending.flags[`rage_target_${id}`],(step.before.flags[`rage_target_${id}`]||0)+1);assert.ok(deriveAchievements(step.pending).includes(`rage-${id}`));
   for(const metric of CHARACTER_METRICS)assert.ok(b[metric]>=a[metric]);
  }
 }
});

test('a result-phase target cannot undo or replace the already committed choice',()=>{
 for(const route of routes().filter(route=>route.phase==='result')){
  const {trace}=play(route),step=trace.findLast(row=>row.action.type==='rage'&&Object.hasOwn(row.action,'target'));
  assert.equal(step.before.pending,true);assert.equal(step.before.pendingFamily,null);assert.equal(step.before.eventId,step.action.eventId);
  assert.deepEqual(step.pending.history.slice(0,step.before.history.length),step.before.history);
  assert.deepEqual(step.pending.actions.slice(0,step.before.actions.length),step.before.actions);
  assert.equal(step.pending.rageContext.pendingEffect,step.before.pendingEffect);
  if(route.mode==='imagined'){
   assert.equal(step.after.rageContext,null);assert.deepEqual(step.after.history.slice(0,step.before.history.length),step.before.history);
   assert.equal(step.after.turn,step.before.turn+Number(['daily','fantasy','onboarding'].includes(step.before.history.at(-1).kind)));
  }else assert.equal(step.after.rageContext.mode,'real');
 }
});

test('explicit targets are rejected for solo conversations, absent people and forged action phases',()=>{
 const solo=createRun('system','e20-solo-group-rejection'),soloPending=applyChoice(solo,0);
 assert.deepEqual(getRageTargets(solo),['wing']);
 for(const run of [solo,soloPending])for(const target of ['wing',...GROUP,'spencer',null,1])assert.equal(requestRage(run,target),run);
 for(const route of routes()){
  const {trace}=play(route),step=trace.findLast(row=>row.action.type==='rage'&&Object.hasOwn(row.action,'target'));
  for(const target of ['wing','spencer','rick','unknown',null,1])assert.equal(requestRage(step.before,target),step.before);
  const changed=copy(route.actions);changed.at(-1).phase=route.phase==='event'?'result':'event';assert.throws(()=>replayRun(route.roleId,route.seed,changed));
  const foreign=copy(route.actions);foreign.at(-1).target='wing';assert.throws(()=>replayRun(route.roleId,route.seed,foreign));
  const scene=copy(route.actions);scene.at(-1).eventId='onboarding';assert.throws(()=>replayRun(route.roleId,route.seed,scene));
  const extra=copy(route.actions);extra.at(-1).otherTarget='sonny';assert.throws(()=>replayRun(route.roleId,route.seed,extra));
  for(const mutate of [run=>{run.rageContext.target='wing';},run=>{run.rageContext.speaker='wing';},run=>{run.actions.at(-1).target=GROUP.find(id=>id!==route.target);}]){const bad=copy(step.pending);mutate(bad);assert.equal(validRun(bad),false,route.id);}
 }
});

test('the old paperwork default remains Moon Dog while an explicit in-room target can select someone else',()=>{
 const report=JSON.parse(readFileSync(new URL('../research/reachability-v3.json',import.meta.url))),route=report.routes.find(row=>row.ending==='fired_refused-system');assert.ok(route);
 const source=play(route).trace.find(row=>row.before.eventId==='paperwork'&&canRequestRage(row.before))?.before;assert.ok(source);
 const old=requestRage(source);assert.equal(old.rageContext.target,'jenjen');assert.equal(Object.hasOwn(old.actions.at(-1),'target'),false);
 assert.deepEqual(getRageTargets(source),GROUP);
 for(const target of GROUP){const selected=requestRage(source,target);assert.equal(selected.rageContext.target,target);assert.equal(selected.history.at(-1).speaker,target);assert.equal(validRun(copy(selected)),true);}
});

test('omitting a target preserves the published default and every e20 direct/JSON checkpoint',()=>{
 const baseline=JSON.parse(readFileSync(new URL('./fixtures/legacy-e20-routes.json',import.meta.url)));assert.equal(baseline.length,389);let count=0;
 for(const route of baseline)for(const saved of [false,true]){
  assert.ok(route.actions.every(action=>action.type!=='rage'||!Object.hasOwn(action,'target')));
  const {run,checkpoints}=play(route,{saved,hashes:true});assert.deepEqual(checkpoints,saved?route.savedCheckpoints:route.directCheckpoints,route.ending);assert.equal(hash(run),saved?route.savedStateSha256:route.stateSha256,route.ending);if(!saved)count+=checkpoints.length;
 }
 assert.equal(count,16014);
 for(const route of routes()){
  const step=play(route).trace.findLast(row=>row.action.type==='rage'&&Object.hasOwn(row.action,'target')),old=requestRage(step.before);
  assert.equal(Object.hasOwn(old.actions.at(-1),'target'),false);assert.equal(old.rageContext.target,step.before.eventId==='paperwork'?'jenjen':'erich');
 }
});
