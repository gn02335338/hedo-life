import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as E from '../dist/engine.js';
import {ROLES,ROLE_MAP} from '../dist/roles.js';
import {directEntryV60,entryLabelV60,isRecruitmentV60,isRecruitmentOutcomeV60} from '../dist/recruitment-v60.js';
import {recruitmentSeedV60} from '../dist/seed-profile-v60.js';
import {deriveCharacterStats} from '../dist/character-stats.js';
import {isWorkGapV50} from '../dist/work-gap-v50.js';
import {isEnergyRestV53} from '../dist/energy-rest-v53.js';
import {isEnergySafetyV54} from '../dist/energy-safety-v54.js';
import {isActivityPlayV55} from '../dist/activity-play-v55.js';
import {isShareholderV58} from '../dist/shareholders-v58.js';
import {isPatronageV49} from '../dist/patronage-v49.js';
import {leaderboardEligibilityV56} from '../dist/leaderboard-score-v56.js';
import {validateCompletion,ApiError} from '../worker/http.js';

const copy=value=>JSON.parse(JSON.stringify(value));
const seed=(kind,index=0)=>recruitmentSeedV60(createHash('sha256').update(`entry-v60-${index}`).digest('hex'),kind);
const candidate=(kind,index=0)=>{const profile=seed(kind,index),entry=directEntryV60(profile);return E.createRun(entry?.roleId||'system',profile);};
const start=run=>E.enableActivitySchedule(run);
const choose=(run,index)=>E.advance(E.applyChoice(run,index));
const replay=run=>E.replayRun(run.roleId,run.seed,copy(run.actions));
const forbidMenus=run=>{
 for(const [can,request]of [[E.canRequestBreak,E.requestBreak],[E.canRequestCareer,E.requestCareer],[E.canRequestRaise,E.requestRaise],[E.canRequestActivityInvitation,E.requestActivityInvitation],[E.canRequestHiddenEncounter,E.requestHiddenEncounter]]){assert.equal(can(run),false);assert.equal(request(run),run);}
 assert.equal(E.requestExit(run),run);assert.equal(E.canRequestVerbal(run),false);assert.equal(E.canRequestRage(run),false);assert.equal(E.canRequestPatronageReply(run),false);
};

test('compact profiles retain 88 entropy bits, derive both direct-entry genders and hide the appointment in the rolled label',()=>{
 for(const kind of ['normal','executive','godson','goddaughter']){
  const profile=seed(kind);assert.equal(profile.length,32);assert.equal(isRecruitmentV60(profile),true);assert.match(profile,/^e39-r60-[nsd]-[a-f0-9]{22}$/);
  const entry=directEntryV60(profile);
  if(['normal','executive'].includes(kind)){assert.equal(entry,null);continue;}
  assert.equal(entry.kind,kind==='godson'?'son':'daughter');assert.equal(entry.gender,kind==='godson'?'male':'female');assert.equal(entry.title,kind==='godson'?'乾兒子':'乾女兒');assert.ok(ROLES.some(role=>role.id===entry.roleId));assert.notEqual(entry.roleId,'executive');
  const run=E.createRun(entry.roleId,profile);assert.equal(run.characterGender,entry.gender);assert.equal(run.patronage,null);assert.equal(entryLabelV60(run),'特別任用職缺');assert.equal(E.validRun(copy(run)),true);assert.deepEqual(replay(run),run);
  for(const other of ROLES.filter(role=>role.id!==entry.roleId))assert.throws(()=>E.createRun(other.id,profile),'a client cannot choose a better underlying career for the same special ticket');
 }
 for(const malformed of ['e39-r60-s-123','e39-r60-x-'+'a'.repeat(22),'e39-r60-s-'+'A'.repeat(22),'e39-cal46-kin49-g-e-s-m-h-a1b2c3'])assert.equal(isRecruitmentV60(malformed),false);
 for(const [entropy,kind]of [['short','normal'],['a'.repeat(22),'missing'],[null,'godson']])assert.throws(()=>recruitmentSeedV60(entropy,kind));
});

for(const kind of ['godson','goddaughter'])for(const index of [0,1])test(`${kind} onboarding ${index}: accepting creates the existing special appointment, then both introductions return without extra work`,()=>{
 const original=start(candidate(kind)),entry=directEntryV60(original),before=copy(original),pending=E.applyChoice(original,index);
 assert.deepEqual(original,before);assert.equal(pending.pending,true);assert.equal(pending.patronage.title,entry.title);assert.deepEqual(Object.keys(pending.patronage).sort(),['appointedPay','fromPay','historyIndex','title']);assert.equal(pending.patronage.historyIndex,0);
 assert.equal(pending.patronage.fromPay,original.offerPay);assert.equal(pending.pay,Math.min(500,Math.max(original.offerPay+8,Math.round(original.offerPay*1.15))));assert.equal(pending.patronage.appointedPay,pending.pay);assert.equal(E.jobTitle(pending),entry.title);
 assert.equal(pending.history[0].recruitmentOutcome.kind,'appointment');assert.equal(pending.history[0].recruitmentOutcome.affinityDelta,-18);assert.equal(isRecruitmentOutcomeV60(pending,pending.history[0]),true);assert.equal(E.validRun(pending),true);
 const first=E.advance(copy(pending));assert.deepEqual(replay(pending),first);assert.equal(first.eventId,'recruitment60-rick');assert.equal(first.turn,1);forbidMenus(first);
 const turn=first.turn,pay=first.pay,rank=first.rank,capital=first.stats.cash,returnId=first.recruitmentContext.returnEventId;
 let run=first;
 for(const [stage,eventId]of ['recruitment60-rick','recruitment60-princess'].entries()){
  assert.equal(run.eventId,eventId);assert.equal(run.recruitmentContext.stage,stage);assert.equal(E.getEvent(run).choices.length,3);assert.equal(E.getEvent(run).kind,'recruitment');
  const saved=copy(run),result=E.applyChoice(run,0);assert.deepEqual(run,saved);assert.equal(result.pending,true);forbidMenus(result);assert.equal(result.history.at(-1).recruitmentOutcome.kind,'welcome');assert.equal(isRecruitmentOutcomeV60(result,result.history.at(-1)),true);assert.equal(E.validRun(copy(result)),true);
  for(const key of ['turn','pay','rank','pip','pipCount'])assert.deepEqual(result[key],run[key],key);
  run=E.advance(copy(result));assert.deepEqual(replay(result),run);assert.equal(run.turn,turn);assert.equal(run.pay,pay);assert.equal(run.rank,rank);assert.equal(run.stats.cash,capital);assert.equal(E.validRun(run),true);
 }
 assert.equal(run.recruitmentContext,null);assert.equal(run.eventId,returnId);assert.equal(run.completed,false);assert.equal(run.characterGender,entry.gender);assert.equal(E.jobTitle(run),entry.title);
 const rick=deriveCharacterStats(run).find(person=>person.id==='rick');assert.ok(rick.affinityLost>=18,'the appointment itself records Rick’s jealousy, independently of later replies');
 assert.ok(deriveCharacterStats(run).find(person=>person.id==='princess').encounters>0,'the mandatory princess introduction is actually observed');
});

test('declining the special job at reporting does not appoint the player or force the welcome scenes',()=>{
 for(const kind of ['godson','goddaughter']){
  const run=choose(start(candidate(kind)),2);assert.equal(run.completed,true);assert.equal(run.patronage,null);assert.equal(run.recruitmentContext,null);assert.equal(run.history[0].recruitmentOutcome.kind,'declined');assert.equal(run.history[0].recruitmentOutcome.affinityDelta,0);assert.equal(E.validRun(run),true);assert.deepEqual(replay(run),run);
 }
});

test('normal recruitment profiles still admit all thirteen occupations without silently granting a special title',()=>{
 for(const role of ROLES){const run=E.createRun(role.id,seed('normal',1));assert.equal(run.roleId,role.id);assert.equal(directEntryV60(run),null);assert.equal(run.patronage,null);assert.equal(E.validRun(run),true);assert.deepEqual(replay(run),run);assert.notEqual(entryLabelV60(run),'特別任用職缺');}
});

test('all recruitment profiles retain warning rest, safety, calendar controls, shareholder scenes, patronage gates and leaderboard eligibility',()=>{
 for(const kind of ['normal','executive','godson','goddaughter']){
  const raw=candidate(kind),run=start(raw),body={runId:'5d68182c-35b3-4ccf-a15c-8171d1fd6b43',roleId:run.roleId,seed:run.seed,actions:run.actions};
  for(const enabled of [isWorkGapV50,isEnergyRestV53,isEnergySafetyV54,isActivityPlayV55,isShareholderV58,isPatronageV49])assert.equal(enabled(run),true,`${kind}/${enabled.name}`);
  assert.equal(run.flags.activity46_enabled,1);assert.deepEqual(run.actions,[{type:'activity-schedule',version:1}]);assert.equal(run.flags.work_gap_open,0);assert.equal(run.flags.energy54_rest_owed,0);assert.doesNotThrow(()=>validateCompletion(body,ROLE_MAP));
  assert.throws(()=>E.replayRun(raw.roleId,raw.seed,[{type:'choice',eventId:'onboarding',index:0}]),'new profiles still require their initial calendar commitment');
  for(const activityId of ['arm','diet','roadshow','dinner','banquet','basketball','review']){
   assert.equal(E.canRequestActivity(run,activityId),false);assert.equal(E.requestActivity(run,activityId),run);
   assert.throws(()=>validateCompletion({...body,actions:[{type:'activity',version:1,activityId}]},ROLE_MAP),error=>error instanceof ApiError&&error.code==='invalid_actions','manual activities cannot bypass the scheduled invitation policy');
  }
  for(const action of [{type:'activity-invitation',version:1,eventId:'onboarding'},{type:'activity-play',version:1,eventId:'activity44-basketball-1',index:1,input:{kind:'basketball',moves:[0,2,1,2,0]}},{type:'shareholder-play',version:1,eventId:'shareholder58-hearing-0',input:{mode:'yield',statement:0,evidence:null}}])assert.doesNotThrow(()=>validateCompletion({...body,actions:[action]},ROLE_MAP),'existing bounded control grammars accept the new profile, with actual availability still decided by replay');
  const ended=choose(run,2);assert.equal(ended.completed,true);assert.equal(leaderboardEligibilityV56(ended).eligible,true);assert.equal(E.validRun(ended),true);
 }
});

test('candidate, appointment and welcome save validation refuses invented recruitment state and stale scene choices',()=>{
 const raw=candidate('godson'),entered=choose(start(raw),0),pending=E.applyChoice(entered,0),after=E.advance(pending);
 for(const source of [raw,entered,pending,after]){
  for(const mutate of [run=>run.characterGender='female',run=>run.pay=499,run=>run.roleId=ROLES.find(role=>role.id!==run.roleId).id,run=>run.patronage={title:'乾兒子',historyIndex:0,fromPay:1,appointedPay:499}]){const forged=copy(source);mutate(forged);assert.equal(E.validRun(forged),false);}
 }
 for(const mutate of [run=>run.recruitmentContext.stage=1,run=>run.history[0].recruitmentOutcome.affinityDelta=999,run=>run.history[0].recruitmentOutcome.variant='daughter',run=>run.history.at(-1).result+=' forged']){const forged=copy(pending);mutate(forged);assert.equal(E.validRun(forged),false);}
 assert.throws(()=>E.replayRun(raw.roleId,raw.seed,[...after.actions,{type:'choice',eventId:'recruitment60-rick',index:0}]),'Rick cannot be replayed after the princess introduction starts');
 assert.throws(()=>E.replayRun(raw.roleId,raw.seed,[...entered.actions,{type:'choice',eventId:'recruitment60-princess',index:0}]),'the second introduction cannot skip the first');
 assert.throws(()=>E.replayRun(raw.roleId,raw.seed,[...entered.actions,{type:'exit'}]),'mandatory introductions cannot be escaped by a forged menu action');
});

test('the published shareholder cohort retains its exact candidate hashes and cannot gain a supplied direct-entry flag',()=>{
 const hashes={system:'d2871643e423e39638ad0d71a528d402f6749af09b3428086bb6ac38acd9ad33',sales:'c21af29c8b798b6d377502d5783ba791bc2bd2e6a7e6ce4bfd4a61e5fd288944',executive:'68dad9017b9f4ddcf1454433352c51a40688d95d093558155242cc5320a5953e'};
 for(const [role,expected]of Object.entries(hashes)){
  const run=E.createRun(role,'e39-cal46-kin49-g-e-s-m-h-a1b2c3');assert.equal(directEntryV60(run),null);assert.equal(createHash('sha256').update(JSON.stringify(run)).digest('hex'),expected);assert.equal(E.validRun(run),true);
  const forged=copy(run);forged.recruitmentContext={version:1,stage:0,returnEventId:'onboarding'};assert.equal(E.validRun(forged),false);
 }
});

test('special reporting insults use one exact spoken line and every surviving reaction returns to an explicit appointment decision',()=>{
 const survivors=['ignored','relationship','retort','support','legal'];
 for(const kind of ['godson','goddaughter']){
  const outcomes=new Map();
  for(let i=0;i<200&&outcomes.size<6;i++){
   const profile=recruitmentSeedV60(i.toString(16).padStart(22,'0'),kind),entry=directEntryV60(profile),initial=start(E.createRun(entry.roleId,profile));
   const preview=E.getVerbalLine(initial,'wing'),pending=E.requestVerbal(initial,undefined,2);
   if(!outcomes.has(pending.verbalContext.outcome))outcomes.set(pending.verbalContext.outcome,{initial,pending,entry,preview});
  }
  assert.deepEqual([...outcomes.keys()].sort(),[...survivors,'personnel'].sort(),`${kind}: natural seeds cover every reporting reaction`);
  for(const outcome of survivors){
   const {initial,pending,entry,preview}=outcomes.get(outcome),spoken=pending.history.at(-1);
   assert.match(preview,/特別任用|家譜/);assert.doesNotMatch(preview,/會計|財務|工程師|商務開發|助理/,'the insult responds to the special offer rather than the underlying career');
   assert.equal(pending.verbalContext.phase,'event');assert.equal(preview,pending.verbalContext.line);assert.equal(preview,spoken.choiceText);assert.ok(spoken.result.includes(preview),'the committed consequence repeats the actual spoken sentence');
   assert.equal(pending.patronage,null);assert.equal(pending.pay,initial.offerPay);assert.equal(E.validRun(copy(pending)),true);
   let decision=choose(E.advance(pending),3);
   for(let step=0;step<6&&decision.verbalContext?.stage!=='decision'&&!decision.completed;step++)decision=choose(decision,0);
   assert.equal(decision.eventId,'verbal-v2-decision',`${kind}/${outcome}: surviving an insult cannot silently finish reporting`);assert.equal(decision.patronage,null);assert.equal(decision.pay,initial.offerPay);assert.equal(decision.turn,0);
   const event=E.getEvent(decision),offer=Math.min(500,Math.max(initial.offerPay+8,Math.round(initial.offerPay*1.15)));
   assert.match(event.body,/這份任用卻還沒有生效/);assert.ok(event.body.includes(`原先談的是${initial.offerPay}K`));assert.ok(event.body.includes(`月薪才會調整為${offer}K`));assert.equal(event.body.includes(ROLE_MAP[initial.roleId].name),false,'the decision concerns the special title, not a normal career name card');
   assert.equal(event.choices[0].sourceIndex,0);assert.equal(event.choices[1].sourceIndex,2);assert.ok(event.choices[0].text.includes(`任命後月薪${offer}K`));
   const accepted=E.applyChoice(decision,0);assert.equal(accepted.patronage.title,entry.title);assert.equal(accepted.patronage.fromPay,initial.offerPay);assert.equal(accepted.pay,offer);assert.equal(accepted.patronage.historyIndex,accepted.history.length-1);assert.equal(isRecruitmentOutcomeV60(accepted,accepted.history.at(-1)),true);assert.equal(E.validRun(accepted),true);
   const introduced=E.advance(copy(accepted));assert.equal(introduced.eventId,'recruitment60-rick');assert.deepEqual(replay(accepted),introduced);assert.equal(introduced.turn,1);
   const declined=choose(decision,1);assert.equal(declined.completed,true);assert.equal(declined.patronage,null);assert.equal(declined.recruitmentContext,null);assert.equal(declined.pay,initial.offerPay);assert.equal(declined.history.at(-1).recruitmentOutcome.kind,'declined');assert.equal(E.validRun(declined),true);assert.deepEqual(replay(declined),declined);
  }
  const withdrawn=outcomes.get('personnel'),ended=choose(E.advance(withdrawn.pending),3);assert.equal(ended.completed,true);assert.equal(ended.patronage,null);assert.equal(ended.recruitmentContext,null,'a withdrawn reporting offer never enters the introductions');
 }
});

test('insulting after accepting uses the confirmed-terms line and does not rewind an existing appointment',()=>{
 for(const kind of ['godson','goddaughter']){
  const initial=start(candidate(kind)),appointed=E.applyChoice(initial,0),appointment=copy(appointed.patronage),preview=E.getVerbalLine(appointed,'wing');
  assert.match(preview,/剛才才把任用條件寫下來/);assert.doesNotMatch(preview,/報到直接替我改輩分/);
  const pending=E.requestVerbal(appointed,undefined,2);assert.equal(pending.verbalContext.phase,'result');assert.equal(pending.verbalContext.line,preview);assert.equal(pending.history.at(-1).choiceText,preview);assert.ok(pending.history.at(-1).result.includes(preview));assert.deepEqual(pending.patronage,appointment);assert.equal(pending.pay,appointment.appointedPay);assert.equal(E.validRun(pending),true);
  let after=choose(E.advance(pending),3);
  for(let step=0;step<6&&after.verbalContext&&!after.completed;step++)after=choose(after,0);
  assert.deepEqual(after.patronage,appointment);assert.equal(after.pay,appointment.appointedPay);assert.equal(E.validRun(after),true);assert.deepEqual(replay(after),after);
 }
});
