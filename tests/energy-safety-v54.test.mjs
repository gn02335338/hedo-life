import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as E from '../dist/engine.js';
import {ENERGY_SAFETY_OWED_V54 as OWED,isEnergySafetyV54,energySafetyChoiceV54,energySafetyReturnedBoundaryV54,energySafetyBoundaryV54} from '../dist/energy-safety-v54.js';

const {routes,required}=JSON.parse(readFileSync(new URL('./fixtures/energy-safety-routes-v54.json',import.meta.url),'utf8'));
const legacy=JSON.parse(readFileSync(new URL('./fixtures/energy-rest-routes-v53.json',import.meta.url),'utf8')).routes;
const row=id=>{const value=routes.find(route=>route.id===id);assert.ok(value,id);return value;};
const replay=(route,actions=route.actions)=>E.replayRun(route.roleId,route.seed,actions);
const pair=id=>{const route=row(id);return{route,before:replay(route,route.beforeActions),after:replay(route)}};
const copy=value=>JSON.parse(JSON.stringify(value));
const forbidden=run=>{assert.equal(E.canRequestBreak(run),false);assert.equal(E.requestBreak(run),run);};
const ledgerEnergy=run=>run.history.at(-1).breakdown.reduce((sum,part)=>sum+(part.delta.energy||0),0);
function correction(before,energy,kind='daily',owed=0,seed='e39-cal46-kin49-g-e-s-unitproof0'){
 const run={seed,flags:{[OWED]:owed},stats:{energy:before,cash:23,mood:77},rng:123};
 const next=structuredClone(run);next.stats.energy=energy;const ledger=[];
 energySafetyChoiceV54(run,next,{kind},(source,label,delta)=>{const value=delta.energy;next.stats.energy+=value;ledger.push({source,label,delta});});
 return {run,next,ledger};
}

test('the new safety cohort preserves a visible warning instead of losing more than 30 energy in one healthy workday',()=>{
 assert.equal(isEnergySafetyV54('e39-cal46-kin49-g-e-s-0123456789'),true);
 for(const seed of ['e39-cal46-kin49-g-e-0123456789ab','e39-cal46-kin49-g-e-safe-proof','e39-cal46-kin49-g-proof'])assert.equal(isEnergySafetyV54(seed),false);
 for(const [before,raw,expected]of [[31,0,1],[45,0,15],[60,20,30],[80,40,50],[100,95,95]]){
  const {run,next,ledger}=correction(before,raw);
  assert.equal(next.stats.energy,expected);assert.equal(next.stats.cash,run.stats.cash);assert.equal(next.stats.mood,run.stats.mood);assert.equal(next.rng,run.rng);
  assert.equal(next.flags[OWED],Number(expected<=30));
  if(expected!==raw){assert.equal(ledger.length,1);assert.equal(ledger[0].source,'fatigue-buffer');assert.equal(ledger[0].delta.energy,expected-raw);}
 }
 const old=correction(31,0,'daily',0,'e39-cal46-kin49-g-e-old-proof');assert.equal(old.next.stats.energy,0);assert.equal(old.ledger.length,0);
});

test('one reserved energy lasts only until a first usable warning interval, and recovery rearms a later episode',()=>{
 for(const kind of ['daily','activity','crisis','hidden']){
  const protectedChoice=correction(9,0,kind,1);assert.equal(protectedChoice.next.stats.energy,1,kind);assert.equal(protectedChoice.next.flags[OWED],1,kind);
  assert.equal(protectedChoice.ledger[0].delta.energy,1,kind);
  const ignored=correction(9,0,kind,0);assert.equal(ignored.next.stats.energy,0,kind);assert.equal(ignored.ledger.length,0,kind);
 }
 const recovered=correction(9,51,'self-care',1);assert.equal(recovered.next.flags[OWED],0);
 const crossed=correction(31,29,'activity',0);assert.equal(crossed.next.flags[OWED],1);assert.equal(crossed.next.stats.energy,29);
});

test('closed mandatory bundles hand back a usable interval, while unfinished activity and confrontation contexts keep ownership',()=>{
 // These are isolated boundary-predicate inputs, not fabricated playable
 // saves. Natural full-run proofs below cover the engine and replay contract.
 const base={seed:'e39-cal46-kin49-g-e-s-unitproof0',turn:5,lastBreakTurn:4,flags:{work_gap_open:0,[OWED]:1},stats:{energy:9,mood:65,cash:24}};
 const source={kind:'daily'};
 for(const key of ['activityContext','hiddenEncounterContext','companyContext','raiseContext','mealContext','patronageContext','resumeEventId','meltdownReturnEventId','breakReturnEventId','banquetReturnEventId','wealthReturnEventId','exitReturnEventId']){
  const before={...copy(base),[key]:{active:true}},after=copy(base);
  assert.equal(energySafetyReturnedBoundaryV54(before,after),true,key);
  energySafetyBoundaryV54(before,after,source);assert.equal(after.flags.work_gap_open,1,key);assert.equal(after.flags[OWED],0,key);
  const ongoing=copy(before);energySafetyBoundaryV54(before,ongoing,source);assert.equal(ongoing.flags.work_gap_open,0,`${key}/unfinished`);assert.equal(ongoing.flags[OWED],1,key);
 }
 for(const key of ['rageContext','verbalContext','patronageReplyContext']){
  const before={...copy(base),[key]:{phase:'event'}},after={...copy(base),flags:{...base.flags,work_gap_open:0}};
  assert.equal(energySafetyReturnedBoundaryV54(before,after),false,key);
  energySafetyBoundaryV54(before,after,source);assert.equal(after.flags.work_gap_open,0,key);assert.equal(after.flags[OWED],1,key);
 }
 const before={...copy(base),salaryAdvice:{status:'open'}},after={...copy(base),salaryAdvice:{status:'done'}};
 energySafetyBoundaryV54(before,after,source);assert.equal(after.flags.work_gap_open,1);assert.equal(after.flags[OWED],0);
 const occupied={...copy(base),activityContext:{id:'basketball'}},held={...copy(occupied),turn:6};
 energySafetyBoundaryV54(occupied,held,source);assert.equal(held.flags.work_gap_open,0,'even an artificial turn increase does not interrupt an owned activity');
});

test('all new checkpoints are natural canonical lives and survive refresh without client-edited safety flags',()=>{
 assert.ok(required.length>=20);assert.deepEqual(required.filter(id=>!routes.some(route=>route.id===id)),[]);
 for(const route of routes){
  assert.equal(route.seed.length,32,route.id);assert.equal(isEnergySafetyV54(route.seed),true,route.id);
  for(const actions of [route.beforeActions,route.actions]){
   const run=replay(route,actions),saved=copy(run);
   assert.equal(E.validRun(run),true,route.id);assert.equal(E.validRun(saved),true,`${route.id}/refresh`);
   assert.deepEqual(replay(route,saved.actions),saved,`${route.id}/canonical replay`);
  }
 }
 const {after}=pair('warning-gap');
 assert.equal(E.validRun({...after,flags:{...after.flags,[OWED]:1}}),false,'the browser cannot invent an unpaid rescue');
 assert.equal(E.validRun({...after,stats:{...after.stats,energy:100}}),false,'a displayed warning cannot be replaced with invented energy');
});

test('a demanding natural work choice reports its actual capped loss and cannot open rest before its result is finished',()=>{
 const {route,before,after}=pair('buffered-work'),pending=E.applyChoice(before,route.index),last=pending.history.at(-1);
 assert.ok(before.stats.energy>30);assert.ok(['daily','fantasy'].includes(E.getEvent(before).kind));
 assert.ok(pending.stats.energy>0);assert.ok(before.stats.energy-pending.stats.energy<=30);
 assert.ok(last.breakdown.some(part=>part.source==='fatigue-buffer'&&part.delta.energy>0));
 assert.equal(ledgerEnergy(pending),pending.stats.energy-before.stats.energy);assert.equal(last.delta.energy,pending.stats.energy-before.stats.energy);
 forbidden(before);forbidden(pending);assert.equal(pending.pending,true);
 assert.equal(after.turn,before.turn+1);assert.equal(E.isWorkGapOpenV50(after),true);assert.equal(E.canRequestBreak(after),true);assert.equal(after.flags[OWED],0);
});

for(const id of ['arm','diet','roadshow','banquet','basketball','review'])test(`${id} finishes every stage and shows its result before offering the first warning rest`,()=>{
 const {route,before,after}=pair(`activity-return-${id}`),pending=E.applyChoice(before,route.index);
 assert.equal(before.activityContext.id,id);assert.equal(E.getEvent(before).kind,'activity');forbidden(before);forbidden(pending);
 assert.equal(pending.pending,true);assert.equal(pending.history.at(-1).activityOutcome.done,true);
 assert.equal(after.activityContext,undefined);assert.equal(after.turn,before.turn);assert.deepEqual(after.pip,before.pip);
 assert.ok(after.stats.energy>0&&after.stats.energy<=30);assert.equal(E.isWorkGapOpenV50(after),true);assert.equal(E.canRequestBreak(after),true);assert.equal(after.flags[OWED],0);
 assert.equal(after.rng,pending.rng,'the between-scene warning does not draw another result');
});

test('the restorative company dinner returns normally without an unnecessary rest interruption',()=>{
 const {route,before,after}=pair('activity-dinner-restores'),pending=E.applyChoice(before,route.index);
 assert.equal(before.activityContext.id,'dinner');forbidden(before);forbidden(pending);
 assert.equal(pending.history.at(-1).activityOutcome.done,true);assert.equal(after.activityContext,undefined);
 assert.ok(after.stats.energy>30);assert.ok(after.stats.energy>=before.stats.energy);assert.equal(E.isWorkGapOpenV50(after),false);forbidden(after);
 assert.equal(after.turn,before.turn);assert.deepEqual(after.pip,before.pip);
});

test('PIP notices and assessments keep the screen until answered, then allow a waiting rest without counting an extra workday',()=>{
 for(const id of ['pip-notice-warning','pip-review-warning']){
  const {before}=pair(id);assert.ok(before.stats.energy>0&&before.stats.energy<=30);assert.equal(before.flags[OWED],1);forbidden(before);
  for(const [index,choice]of E.getEvent(before).choices.entries())if(choice.available!==false)forbidden(E.applyChoice(before,index));
 }
 const {route,before,after}=pair('pip-start-gap'),pending=E.applyChoice(before,route.index);
 assert.equal(E.getEvent(before).id,'crisis-boss');assert.equal(before.flags[OWED],1);forbidden(before);forbidden(pending);
 assert.equal(after.pip.active,true);assert.equal(after.pip.remaining,3);assert.equal(after.turn,before.turn);assert.equal(after.pay,before.pay);
 assert.equal(E.isWorkGapOpenV50(after),true);assert.equal(E.canRequestBreak(after),true);assert.equal(after.flags[OWED],0);
 const recovery=pair('pip-paid-recovery');assert.equal(recovery.before.pip.active,true);assert.equal(recovery.after.pip.active,true);
 for(const key of ['turn','pay','pip'])assert.deepEqual(recovery.after[key],recovery.before[key],key);
 assert.ok(recovery.after.stats.energy>30);assert.equal(E.canRequestBreak(recovery.after),false);
});

test('hidden encounters and mandatory no-turn conversations can hand a waiting warning back to a safe interval',()=>{
 for(const id of ['hidden-return-gap','mandatory-return-gap']){
  const {route,before,after}=pair(id),pending=E.applyChoice(before,route.index);
  forbidden(before);forbidden(pending);assert.equal(after.turn,before.turn,id);assert.equal(after.pay,before.pay,id);
  assert.deepEqual(after.pip,before.pip,id);assert.equal(after.hiddenEncounterContext,undefined);
  assert.equal(E.isWorkGapOpenV50(after),true,id);assert.equal(E.canRequestBreak(after),true,id);assert.equal(after.flags[OWED],0,id);
 }
});

test('a second warning in the same workday waits without an empty rest screen, and the next finished workday makes its allowance usable',()=>{
 const capped=pair('same-turn-rest-cap');
 assert.equal(capped.after.lastBreakTurn,capped.after.turn);assert.equal(capped.after.flags[OWED],1);
 assert.ok(capped.after.stats.energy>0&&capped.after.stats.energy<=30);assert.equal(E.isWorkGapOpenV50(capped.after),false);forbidden(capped.after);
 const {route,before,after}=pair('owed-floor'),pending=E.applyChoice(before,route.index);
 assert.equal(before.lastBreakTurn,before.turn);assert.equal(before.flags[OWED],1);forbidden(before);forbidden(pending);
 assert.equal(pending.stats.energy,1);assert.ok(pending.history.at(-1).breakdown.some(part=>part.source==='fatigue-buffer'&&part.delta.energy>0));
 assert.equal(ledgerEnergy(pending),1-before.stats.energy);assert.equal(after.turn,before.turn+1);
 assert.equal(E.isWorkGapOpenV50(after),true);assert.equal(E.canRequestBreak(after),true);assert.equal(after.flags[OWED],0);
});

test('declining a real opportunity can still cause exhaustion, while full recovery allows a genuinely new warning',()=>{
 const ignored=pair('ignored-chance-burnout');
 assert.equal(E.canRequestBreak(ignored.before),true);assert.equal(ignored.before.flags[OWED],0);
 assert.equal(ignored.after.stats.energy,0);assert.equal(ignored.after.chapterContext.family,'burnout');assert.equal(ignored.after.flags[OWED],0);forbidden(ignored.after);
 const rearmed=pair('rearmed-warning');assert.ok(rearmed.before.stats.energy>30);
 assert.ok(rearmed.before.history.some(row=>row.kind==='self-care'&&row.delta.energy>0));
 assert.ok(rearmed.after.stats.energy>0&&rearmed.after.stats.energy<=30);assert.equal(E.canRequestBreak(rearmed.after),true);
 const paid=pair('paid-recovery');assert.ok(paid.after.stats.energy>30);assert.equal(paid.after.flags[OWED],0);assert.equal(E.isWorkGapOpenV50(paid.after),true);forbidden(paid.after);
 assert.throws(()=>replay(paid.route,[...paid.after.actions,{type:'break'}]),/Unavailable break/);
});

test('published v53 saves and their exhaustion outcomes retain the original rules and exact replay',()=>{
 for(const route of legacy){const run=replay(route);assert.equal(isEnergySafetyV54(run),false);assert.equal(run.flags[OWED],undefined);assert.equal(E.validRun(run),true);assert.deepEqual(replay(route,copy(run.actions)),run);}
 const route=legacy.find(row=>row.id==='exhaustion'),before=replay(route,route.beforeActions),pending=E.applyChoice(before,route.index);
 assert.equal(pending.stats.energy,0);assert.equal(pending.history.at(-1).breakdown.some(part=>part.source==='fatigue-buffer'),false);
});
