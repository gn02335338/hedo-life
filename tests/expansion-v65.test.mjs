import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as E from '../dist/engine.js';
import {deriveCamelInputV65,CAMEL_NAMES_V65} from '../dist/camel-v65.js';
import {isExpansionV65} from '../dist/expansion-profile-v65.js';
import {DIET_TEAMS_V65} from '../dist/diet-v65.js';
import {CAST_IDS_V65} from '../dist/cast-v65.js';
import {isBlockchainOutcomeV65} from '../dist/blockchain-v65.js';
import {buildEndingReport} from '../dist/ending-report.js';
import {deriveAchievements} from '../dist/achievements.js';
import {deriveCharacterStats} from '../dist/character-stats.js';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/expansion-v65.json',import.meta.url),'utf8'));
const named=id=>{const row=fixture.routes.find(row=>row.id===id);assert.ok(row,id);return row;};
const replay=(row,actions=row.actions)=>E.replayRun(row.roleId,row.seed,actions),copy=structuredClone;
const before=id=>{const row=named(id);return replay(row,row.beforeActions);};
const noWork=run=>({turn:run.turn,pay:run.pay,pip:run.pip,loan:run.shareholderLoan,cash:run.stats.cash,service:run.flags.career_service});
const play=(run,move=0)=>({kind:'camel',move,prediction:E.getActivityPlayV55(run).prediction||[2,1,0]});

test('all expansion witnesses start naturally, keep their cohort and replay without trusting serialized states',()=>{
 assert.deepEqual(fixture.required.filter(id=>!fixture.routes.some(row=>row.id===id)),[]);
 for(const row of fixture.routes){const run=replay(row);assert.equal(isExpansionV65(run),true,row.id);assert.equal(E.validRun(copy(run)),true,row.id);assert.deepEqual(E.replayRun(row.roleId,row.seed,copy(run.actions)),run,row.id);}
 for(const marker of ['n','s','d'])assert.equal(isExpansionV65(`e39-r65-${marker}-0000000000000000000000`),true);
 for(const seed of ['e39-r63-n-0000000000000000000000','e39-r64-n-0000000000000000000000','e39-r65-n-000','e39-r65-x-0000000000000000000000'])assert.equal(isExpansionV65(seed),false);
});

test('six Camel submissions draw a fair color bag, move the full upper stack and reveal points only after commitment',()=>{
 const outcomes=[];
 for(let round=0;round<6;round++){
  const source=replay(named(`camel-play-${round}`)),snapshot=copy(source),descriptor=E.getActivityPlayV55(source);
  assert.equal(descriptor.round,round);assert.equal(descriptor.steps,6);assert.deepEqual(descriptor.names,CAMEL_NAMES_V65);assert.doesNotMatch(JSON.stringify(descriptor),/"(?:bag|die|color|ticket|hit|finalHits|ranking)"/);
  const pending=E.applyActivityPlay(source,play(source,round%3)),outcome=pending.history.at(-1).activityOutcome.camel,after=E.advance(pending);outcomes.push(outcome);
  assert.deepEqual(source,snapshot);assert.equal(outcome.round,round+1);assert.equal(outcome.done,round===5);assert.ok(outcome.die>=1&&outcome.die<=3);assert.equal(outcome.hit,outcome.move===outcome.ranking[0]);
  const board=copy(outcome.before),cell=board.find(row=>row.stack.includes(outcome.color)),index=cell.stack.indexOf(outcome.color),carried=cell.stack.splice(index),position=cell.position+outcome.die;
  let expected=board.filter(row=>row.stack.length),target=expected.find(row=>row.position===position);if(!target){target={position,stack:[]};expected.push(target);}target.stack.push(...carried);expected.sort((a,b)=>a.position-b.position);
  assert.deepEqual(outcome.after,expected);assert.deepEqual(outcome.ranking,[...expected].sort((a,b)=>b.position-a.position).flatMap(row=>[...row.stack].reverse()));
  assert.deepEqual(noWork(after),noWork(source));assert.equal(E.validRun(pending),true);assert.equal(E.applyActivityPlay(pending,play(source)),pending);assert.deepEqual(E.replayRun(source.roleId,source.seed,pending.actions),after);
  assert.equal(after.activityContext.stage,round===5?2:1);assert.equal(after.history.at(-1).activityOutcome.performance.score,0);
 }
 for(const offset of [0,3])assert.deepEqual(outcomes.slice(offset,offset+3).map(row=>row.color).sort(),[0,1,2]);
 assert.equal(outcomes.at(-1).points,outcomes.reduce((sum,row)=>sum+Number(row.hit),0)+outcomes.at(-1).finalHits*2);
});

test('support does not choose a dice color, first-round predictions lock, and malformed client outcomes are rejected',()=>{
 const first=replay(named('camel-play-0')),variants=[0,1,2].map(move=>E.applyActivityPlay(first,play(first,move)).history.at(-1).activityOutcome.camel);
 assert.equal(new Set(variants.map(row=>`${row.color}/${row.die}`)).size,1);assert.ok(variants.every(row=>JSON.stringify(row.after)===JSON.stringify(variants[0].after)));
 const next=replay(named('camel-play-1'));assert.deepEqual(E.getActivityPlayV55(next).prediction,[2,1,0]);assert.throws(()=>E.applyActivityPlay(next,{kind:'camel',move:0,prediction:[0,1,2]}));
 for(const input of [{kind:'camel',move:3,prediction:[0,1,2]},{kind:'camel',move:'0',prediction:[0,1,2]},{kind:'camel',move:0,prediction:[0,0,2]},{kind:'camel',move:0,prediction:['0',1,2]},{kind:'camel',move:0,prediction:[0,1]},{kind:'camel',move:0,prediction:[0,1,2],die:3},{kind:'camel',move:0,prediction:[0,1,2],score:12}])assert.throws(()=>deriveCamelInputV65(input));
 const pending=E.applyActivityPlay(first,play(first));
 for(const change of [run=>{const c=run.history.at(-1).activityOutcome.camel;c.die=c.die%3+1;},run=>{run.history.at(-1).activityOutcome.camel.points=12;},run=>{run.activityContext.pendingStep.camelState.prediction=[0,1,2];}]){const forged=copy(pending);change(forged);assert.equal(E.validRun(forged),false,'a serialized save cannot invent dice, points or a sealed prediction');}
});

test('Camel interruption retains committed rounds but never finishes them or refunds earlier history',()=>{
 const source=before('camel-departure'),after=replay(named('camel-departure'));assert.equal(source.activityContext.camel.round,2);assert.ok(!after.activityContext);assert.deepEqual(noWork(after),noWork(source));
 assert.deepEqual(after.history.slice(0,source.history.length),source.history);assert.equal(after.history.filter(row=>row.activityOutcome?.camel).length,2);assert.equal(after.flags.activity44_camel_completed||0,0);
 assert.ok(!after.history.some(row=>row.activityOutcome?.camel?.done));assert.ok(deriveAchievements(source).every(id=>deriveAchievements(after).includes(id)));
 const stale={type:'activity-play',version:1,eventId:'activity44-camel-1',index:1,input:play(source)};assert.throws(()=>E.replayRun(source.roleId,source.seed,[...after.actions,stale]));
});

test('the three diet teams retain the original seven-day input format and finish without collecting body data',()=>{
 for(const team of DIET_TEAMS_V65){
  const row=named(`diet-play-${team.id}`),source=replay(row),descriptor=E.getActivityPlayV55(source);assert.equal(descriptor.team,team.id);assert.deepEqual(descriptor.teams,DIET_TEAMS_V65);
  const finished=replay(named(`diet-finish-${team.id}`));assert.match(finished.history.at(-1).result,/傑克|Johnny|安妮余|阿福/);assert.equal(finished.actions.at(-1).input.days.length,7);assert.deepEqual(noWork(finished),noWork(source));
  const returned=replay(named(`diet-return-${team.id}`));assert.ok(!returned.activityContext);assert.equal(returned.flags.activity44_diet_completed,1);assert.doesNotMatch(JSON.stringify(finished.actions.at(-1).input),/weight|height|calories|bmi/i);
 }
});

test('the four Blockchain scenes have real stage-specific commitments and return to the same work without another payroll day',()=>{
 const start=replay(named('blockchain-0'));
 for(let stage=0;stage<4;stage++)for(const index of [0,1,2]){
  const row=named(`blockchain-${stage}-choice-${index}`),source=replay(row,row.beforeActions),after=replay(row),last=after.history.at(-1);
  assert.equal(isBlockchainOutcomeV65(after,last),true);assert.equal(last.blockchainOutcome.stage,stage);assert.equal(last.blockchainOutcome.done,stage===3);assert.deepEqual(noWork(after),noWork(source));
 }
 const returned=replay(named('blockchain-return'));assert.ok(!returned.blockchainContext);assert.equal(returned.turn,start.turn);assert.equal(returned.eventId,start.blockchainContext.returnEventId);
 const left=replay(named('blockchain-departure'));assert.ok(!left.blockchainContext);assert.ok(!left.history.some(row=>row.blockchainOutcome?.done));assert.equal(left.turn,start.turn);
});

test('all six new colleagues are naturally encountered and their committed answers contribute character interactions',()=>{
 for(const id of CAST_IDS_V65){
  const source=replay(named(`cast-${id}`));assert.equal(E.getEvent(source).speaker,id);assert.ok(E.getRageTargets(source).includes(id));assert.ok(E.getVerbalTargets(source).includes(id));
  for(const index of [0,1,2]){const after=replay(named(`cast-${id}-choice-${index}`));assert.equal(after.history.at(-1).speaker,id);assert.ok(deriveCharacterStats(after).find(row=>row.id===id).encounters>0);}
 }
});

test('completed Camel and Blockchain lives preserve reports, exact resource origins and canonical endings',()=>{
 for(const id of ['camel-completed','blockchain-completed']){
  const run=replay(named(id)),snapshot=JSON.stringify(run),report=buildEndingReport(run);assert.equal(run.completed,true);assert.equal(report.metadata.complete,true,id);assert.deepEqual(report.samples[0].stats,E.createRun(run.roleId,run.seed).stats,id);assert.deepEqual(report.samples.at(-1).stats,run.stats,id);assert.equal(report.samples.length,run.history.length+1);assert.equal(JSON.stringify(run),snapshot);
 }
});
