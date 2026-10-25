import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as E from '../dist/engine.js';
import {CAST_IDS_V74} from '../dist/cast-v74.js';
import {deriveCharacterStats,characterAffinity,isPatronageOutcomeV43} from '../dist/character-stats.js';
import {workCount} from '../dist/salary-raise-v19.js';
import {isPrivateCastSceneV74,privateCastSceneAllowedV74} from '../dist/cast-interactions-v74.js';

const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/cast-v74-natural.json',import.meta.url),'utf8'));
const source=key=>{const f=fixture.cases[key];assert.ok(f,`Missing canonical witness ${key}`);return E.replayRun(f.roleId,f.seed,f.actions);};
const canonical=run=>{assert.equal(E.validRun(run),true,`${run.eventId} pending=${run.pending} effect=${run.pendingEffect}`);if(!run.pending)assert.deepEqual(E.replayRun(run.roleId,run.seed,run.actions),run);return run;};
const choose=(run,index=0)=>canonical(E.advance(canonical(E.applyChoice(run,index))));
function settlePrivate(run){
 for(let step=0;step<15&&(run.rageContext||run.verbalContext);step++){
  canonical(run);run=run.pending?E.advance(run):choose(run,0);
 }
 assert.ok(!run.rageContext&&!run.verbalContext,'personal aftermath should close');return canonical(run);
}
const unchangedJob=(before,after)=>{assert.equal(after.completed,false);assert.equal(after.turn,before.turn);assert.equal(after.pay,before.pay);assert.deepEqual(after.pip,before.pip);assert.equal(workCount(after),workCount(before));};

test('every new colleague and the anonymous Alice hygiene scene are reachable through saved public actions',()=>{
 for(const [key,f]of Object.entries(fixture.cases)){
  const run=canonical(source(key));assert.equal(E.getEvent(run).id,f.expected.eventId,key);assert.equal(run.turn,f.expected.turn,key);
 }
 for(const id of CAST_IDS_V74){
  const run=source(`person_${id}`),event=E.getEvent(run),prior=deriveCharacterStats(run).find(row=>row.id===id);
  assert.equal(event.speaker,id);assert.equal(event.requiresCastV74,true);assert.equal(event.choices.length,3);assert.ok(event.choices.some(choice=>choice.wild));
  const result=canonical(E.applyChoice(run,0)),person=deriveCharacterStats(result).find(row=>row.id===id);
  assert.equal(person.encounters,prior.encounters+1);assert.equal(result.history.at(-1).speaker,id);
 }
 const hygieneRun=source('alice_hygiene'),hygiene=E.getEvent(hygieneRun);assert.equal(hygiene.speaker,'alice');assert.match(hygiene.body,/鼻|痘/);assert.doesNotMatch(hygiene.body,/Peter|紅酒|Wine|8\+9|Tony|老大|Henry|米雅|Mia/);
 const left=canonical(E.requestEventDepartureV63(hygieneRun));assert.equal(left.history.at(-1).departureOutcome.target,'alice');
});

test('all ordinary private replies end only this gathering and never earn a workday, pay, PIP tick or second gathering',()=>{
 const before=canonical(source('private')),event=E.getEvent(before);
 assert.equal(event.kind,'private-social');assert.equal(isPrivateCastSceneV74(before,event),true);assert.equal(privateCastSceneAllowedV74(before,event),true);
 assert.equal(E.requestExit(before),before);assert.equal(E.canRequestRaise(before),false);assert.equal(E.canRequestCareer(before),false);assert.equal(E.canRequestBreak(before),false);
 for(let index=0;index<event.choices.length;index++){
  const pending=canonical(E.applyChoice(before,index)),row=pending.history.at(-1);
  assert.equal(row.kind,'private-social');assert.equal(row.weather,null);
  assert.ok(row.breakdown.every(part=>!['workday','weather','income','career-pressure','shareholder-loan','patronage-allowance'].includes(part.source)));
  const after=canonical(E.advance(pending));unchangedJob(before,after);
  assert.equal(after.flags.cast74_private_last_turn,before.turn+1);assert.ok(after.seen.includes(event.id));
  assert.notEqual(E.getEvent(after,true).kind,'private-social');
 }
});

test('early departure from a private cast scene is a private exit with no hidden resignation or gain',()=>{
 const before=canonical(source('private')),event=E.getEvent(before),descriptor=E.getEventDepartureV63(before);
 assert.equal(descriptor.available,true);assert.match(descriptor.label,/這攤|先走/);
 const pending=canonical(E.requestEventDepartureV63(before)),outcome=pending.history.at(-1).departureOutcome;
 assert.equal(outcome.category,'private');assert.equal(outcome.workDaySpent,false);assert.equal(outcome.target,event.speaker);
 assert.ok(Object.values(pending.history.at(-1).delta).every(value=>value<=0));
 const after=canonical(E.advance(pending));unchangedJob(before,after);assert.ok(after.seen.includes(event.id));assert.notEqual(E.getEvent(after,true).kind,'private-social');
});

test('new character invitations both accept and refuse canonically; accepted meals charge only when consumed',()=>{
 for(const id of CAST_IDS_V74){
  const before=canonical(source(`meal_${id}`)),event=E.getEvent(before),cost=event.choices[0].mealCost,affinity=characterAffinity(before,id).score;
  assert.equal(event.id,`meal-with-${id}`);assert.equal(before.mealContext.page,4);assert.ok(before.history.some(row=>row.eventId==='meal-guests-e'&&row.eventOutcome?.result==='答應赴約'));
  const pending=canonical(E.applyChoice(before,0)),row=pending.history.at(-1);assert.equal(pending.stats.cash,before.stats.cash-cost);assert.equal(row.mealOutcome.target,id);
  const expected=Math.max(0,Math.min(100,affinity+row.mealOutcome.affinityDelta));assert.equal(characterAffinity(pending,id).score,expected);
  const after=canonical(E.advance(pending));unchangedJob(before,after);assert.equal(after.mealContext,null);
  const cancelled=choose(before,2);assert.equal(cancelled.stats.cash,before.stats.cash);assert.equal(cancelled.mealContext,null);
 }
 const refused=canonical(source('meal_refused')),row=refused.history.at(-1);assert.equal(row.eventOutcome.result,'今天約不到');assert.equal(refused.mealContext.guest,null);assert.ok(row.delta.cash===0);
 const menu=E.getEvent(refused),target=fixture.cases.meal_refused.expected.target;
 assert.equal(menu.choices.find(choice=>choice.mealTarget===target).available,false);
});

test('group targeting uses actual presence and private spoken or imagined blows close this social scene',()=>{
 const before=canonical(source('private_group')),event=E.getEvent(before),targets=E.getRageTargets(before);
 assert.ok(targets.length>1);assert.deepEqual(E.getVerbalTargets(before),targets);assert.ok(targets.includes(event.speaker));
 assert.equal(E.requestRage(before,'outside-person'),before);assert.equal(E.requestVerbal(before,'outside-person',2),before);
 for(const target of targets){
  const rage=canonical(E.requestRage(before,target));assert.equal(rage.history.at(-1).speaker,target);
  const afterRage=settlePrivate(rage);unchangedJob(before,afterRage);assert.ok(afterRage.seen.includes(event.id));
  const verbal=canonical(E.requestVerbal(before,target,2));assert.equal(verbal.history.at(-1).speaker,target);assert.notEqual(verbal.verbalContext.outcome,'personnel');
  const afterVerbal=settlePrivate(verbal);unchangedJob(before,afterVerbal);assert.ok(afterVerbal.seen.includes(event.id));
 }
});

test('result-phase private interruptions preserve a committed reply exactly once',()=>{
 const before=canonical(source('private_group')),event=E.getEvent(before),pending=canonical(E.applyChoice(before,2));
 for(const kind of ['rage','verbal']){
  const interrupted=kind==='rage'?E.requestRage(pending):E.requestVerbal(pending,undefined,2);
  assert.notEqual(interrupted,pending);assert.equal(interrupted[`${kind}Context`].phase,'result');
  const after=settlePrivate(interrupted);unchangedJob(before,after);
  assert.equal(after.history.filter(row=>row.eventId===event.id&&row.kind==='private-social').length,1);
  assert.equal(after.flags.cast74_private_last_turn,before.turn+1);
 }
});

test('natural private actual hits and legal outbursts finish their own aftermath without ending employment',()=>{
 const real=canonical(source('private_rage_real')),target=E.getEvent(real).speaker,prior=deriveCharacterStats(real).find(row=>row.id===target);
 const rage=canonical(E.requestRage(real));assert.equal(rage.rageContext.mode,'real');
 const afterRage=settlePrivate(rage);unchangedJob(real,afterRage);
 assert.ok(afterRage.history.slice(real.history.length).every(row=>!/[今這]晚|這一晚|整晚/.test([row.body,row.result].join(' '))),'daytime private aftermath must not turn into tonight');
 assert.equal(deriveCharacterStats(afterRage).find(row=>row.id===target).realHits,prior.realHits+1);
 assert.ok(afterRage.history.some(row=>row.eventId==='rage-legal'));assert.ok(afterRage.seen.includes(E.getEvent(real).id));
 const legal=canonical(source('private_verbal_legal')),spoken=canonical(E.requestVerbal(legal,undefined,2));
 assert.equal(spoken.verbalContext.outcome,'legal');const afterVerbal=settlePrivate(spoken);unchangedJob(legal,afterVerbal);
 assert.ok(afterVerbal.history.some(row=>row.eventId==='verbal-v2-legal'));assert.ok(afterVerbal.history.every(row=>row.eventId!=='verbal-v2-warning'));
});

test('a natural private reply crossing the warning threshold opens a usable rest interval immediately',()=>{
 const before=canonical(source('private_warning')),expected=fixture.cases.private_warning.expected;
 assert.equal(E.getEvent(before).kind,'private-social');assert.ok(before.stats.energy>30);assert.notEqual(before.lastBreakTurn,before.turn);
 const after=choose(before,expected.warningChoice);unchangedJob(before,after);
 assert.equal(after.stats.energy,expected.afterEnergy);assert.equal(after.stats.mood,expected.afterMood);assert.equal(E.getEvent(after).id,expected.afterEventId);
 assert.equal(E.canRequestBreak(after),true);assert.equal(after.flags.energy54_rest_owed,0);
 const resting=canonical(E.requestBreak(after));assert.notEqual(resting,after);assert.equal(resting.turn,before.turn);assert.ok(['self-care','kind-break'].includes(E.getEvent(resting).id));
});

test('a special appointment can speak with authority to new colleagues and then advance the private scene',()=>{
 const before=canonical(source('private_patronage')),event=E.getEvent(before);assert.ok(before.patronage);
 const targets=E.getPatronageReplyTargets(before);assert.ok(targets.includes(event.speaker));
 for(const target of targets){
  assert.doesNotMatch(E.getPatronageReplyLine(before,target),/今晚|這晚|整晚|下班/);
  const reply=canonical(E.requestPatronageReply(before,target));assert.doesNotMatch(reply.history.at(-1).result,/今晚|這晚|整晚|下班/);
 }
 const pending=canonical(E.requestPatronageReply(before,event.speaker)),row=pending.history.at(-1);
 assert.equal(row.kind,'private-social');assert.equal(row.patronageOutcome.version,2);assert.equal(isPatronageOutcomeV43(pending,row),true);assert.equal(row.speaker,event.speaker);
 const after=canonical(E.advance(pending));unchangedJob(before,after);assert.ok(after.seen.includes(event.id));assert.notEqual(E.getEvent(after,true).id,event.id);
});

test('new work targets get real and imagined hit counters separately and contextual legal replies replay',()=>{
 for(const key of ['rage_imagined','rage_real']){
  const before=canonical(source(key)),target=E.getEvent(before).speaker,prior=deriveCharacterStats(before).find(row=>row.id===target),rage=canonical(E.requestRage(before));
  assert.equal(rage.rageContext.mode,fixture.cases[key].expected.mode);const row=deriveCharacterStats(rage).find(row=>row.id===target);
  assert.equal(row.imaginedHits-prior.imaginedHits,key==='rage_imagined'?1:0);assert.equal(row.realHits-prior.realHits,key==='rage_real'?1:0);
 }
 const before=source('verbal_legal'),verbal=canonical(E.requestVerbal(before,undefined,2));assert.equal(verbal.verbalContext.outcome,'legal');assert.equal(verbal.history.at(-1).speaker,E.getEvent(before).speaker);
});

test('private eligibility gives urgent HR, PIP and warnings priority and legacy lives reject the new content',()=>{
 const run=source('private'),event=E.getEvent(run);
 // Isolated eligibility projections, not claimed as canonical game records.
 for(const patch of [{pip:{active:true}},{personnelPending:{reason:'first'}},{salaryAdvice:{status:'queued'}},{salaryAdvice:{status:'open'}},{stats:{...run.stats,energy:30}},{stats:{...run.stats,mood:30}},{stats:{...run.stats,boss:12}},{flags:{...run.flags,cast74_private_last_turn:run.turn+1}}])assert.equal(privateCastSceneAllowedV74({...run,...patch},event),false);
 const old=E.enableActivitySchedule(E.createRun('system','e39-r73-n-'+'b'.repeat(22)));assert.equal(E.validRun(old),true);
 assert.throws(()=>E.getEvent({...old,eventId:event.id}),/Unknown event/);
 assert.equal(E.validRun({...run,seed:run.seed.replace('-r74-','-r73-')}),false);
 assert.equal(E.validRun({...old,flags:{...old.flags,cast74_private_last_turn:1}}),false);
});
