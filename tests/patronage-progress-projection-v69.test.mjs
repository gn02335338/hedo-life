import test from 'node:test';
import assert from 'node:assert/strict';
import {CHARACTER_IDS,isPatronageOutcomeV43,deriveCharacterStats,characterAffinity} from '../dist/character-stats.js';
import {deriveAchievementsV60} from '../dist/achievements-v60.js';
import {buildEndingReport} from '../dist/ending-report.js';
import * as E from '../dist/engine.js';
import {recruitmentSeedV60} from '../dist/seed-profile-v60.js';
import {directEntryV60} from '../dist/recruitment-v60.js';
import {patronageReplyOutcomesV43} from '../dist/patronage-reply-v43.js';
import {scopedBossDeltaV18} from '../dist/relationships-v18.js';

// These are deliberately pure projection fixtures, not claimed to be playable
// saves. The engine's canonical tests separately prove appointment, actor
// presence, exact virtual option index and the chosen scene's continuation.
const seed=profile=>`e39-r${profile}-s-0000000000000000000001`;
const keys=['energy','cash','trust','dream','boss','mood','skill','slack','lick'];
const copy=value=>structuredClone(value);
const row=({target='rick',mode=target==='wing'||target==='spencer'?'flattery':'entitled',reaction='retort',affinityDelta=-12,eventId='meeting-ten-minutes',kind='daily',choiceIndex=3,version=2}={})=>({
 eventId,kind,title:'原本的工作事件',body:'眼前的對話。',wing:'',speaker:target,sourceIds:['characterFiction'],turn:1,choiceIndex,
 choiceText:'這件事先把負責範圍說清楚。',result:'這句話已經說出口，對方也回了話。',chanceOutcome:'ordinary',
 delta:Object.fromEntries(keys.map(key=>[key,0])),weather:null,jobTitle:'乾兒子',pay:180,
 // Trust and boss values deliberately differ from the explicit relationship
 // evidence. Neither daily weather nor team trust should be counted twice.
 breakdown:[{source:'choice',label:'自己人發話之後',delta:{trust:-20,boss:25}}],
 eventOutcome:{label:'自己人發話之後',result:'當面頂回來'},
 patronageOutcome:{version,origin:eventId,target,mode,reaction,affinityDelta}
});
const action=proof=>({type:'patronage-reply',version:proof.patronageOutcome.version,eventId:proof.patronageOutcome.origin,target:proof.speaker});
const runFor=(proof,profile=69)=>({seed:seed(profile),turn:2,stats:Object.fromEntries(keys.map(key=>[key,50])),history:[proof],actions:[action(proof)]});
const allZero=run=>deriveCharacterStats(run).every(item=>Object.entries(item).every(([key,value])=>key==='id'||value===0));

test('r69 source rows retain selected-person affinity once without inventing attacks or another actor',()=>{
 for(const target of ['rick','wing','spencer','princess','zoe','johnny']){
  const proof=row({target}),run=runFor(proof),snapshot=copy(run);
  assert.equal(isPatronageOutcomeV43(run,proof),true,target);
  const ledger=deriveCharacterStats(run);
  assert.equal(ledger.length,CHARACTER_IDS.length);
  for(const item of ledger){
   assert.equal(item.imaginedHits,0);assert.equal(item.realHits,0);
   assert.equal(item.encounters,Number(item.id===target));
   assert.equal(item.affinityGained,0);assert.equal(item.affinityUpEvents,0);
   assert.equal(item.affinityLost,item.id===target?12:0);
   assert.equal(item.affinityDownEvents,Number(item.id===target));
  }
  assert.equal(characterAffinity(run,target).score,38);
  assert.deepEqual(run,snapshot,'relationship and report projections cannot mutate a save');
 }
});

test('v2 projection accepts only supported source kinds and rejects a v2 envelope on r68',()=>{
 for(const [kind,eventId]of [
  ['daily','meeting-ten-minutes'],['fantasy','road'],['fantasy','runway'],['fantasy','audit'],
  ['career','patronage67-education'],['career','patronage67-pay-review'],['career','patronage67-smalltalk'],
  ['self-care','kind-break'],['self-care','kind-workday'],['banquet','banquet-afterparty']
 ]){
  const proof=row({kind,eventId});assert.equal(isPatronageOutcomeV43(runFor(proof),proof),true,`${kind}/${eventId}`);
 }
 const proof=row(),old=runFor(proof,68);
 assert.equal(isPatronageOutcomeV43(old,proof),false);assert.equal(allZero(old),true);
 assert.equal(buildEndingReport(old).metadata.complete,false);
 for(const change of [
  item=>{item.kind='rage';},item=>{item.kind='onboarding';},item=>{item.kind='verbal';},
  item=>{item.kind='patronage';},item=>{item.kind='career';},item=>{item.kind='self-care';},
  item=>{item.kind='banquet';},item=>{item.kind='fantasy';},
  item=>{item.kind='fantasy';item.eventId=item.patronageOutcome.origin='finale';},
  item=>{item.eventId='unrelated-source';},item=>{item.choiceIndex=0;},item=>{item.choiceIndex=1.5;},
  item=>{item.speaker='wing';},item=>{item.patronageOutcome.mode='flattery';},
  item=>{item.patronageOutcome.target='unknown';},item=>{item.patronageOutcome.affinityDelta=-25;},
  item=>{item.patronageOutcome.extra=true;},item=>{item.patronageOutcome.version=3;},
  item=>{item.verbalOutcome={version:2};},item=>{item.mealOutcome={version:1};},
  item=>{item.activityOutcome={version:1};},item=>{item.departureOutcome={version:1};}
 ]){
  const invalid=copy(proof);change(invalid);const run=runFor(invalid);
  assert.equal(isPatronageOutcomeV43(run,invalid),false,JSON.stringify(invalid));
  assert.equal(allZero(run),true,'invalid source evidence must not fall back to generic actor or trust changes');
  assert.equal(buildEndingReport(run).metadata.complete,false);
 }
});

test('v2 matching actions retain patronage achievements and complete report curves',()=>{
 for(const options of [
  {target:'wing',reaction:'welcomed',affinityDelta:8,badge:'kin-upward-applause'},
  {target:'rick',reaction:'retort',affinityDelta:-12,badge:'kin-downward-rebound'},
  {target:'hope',reaction:'reported',affinityDelta:-10,badge:'kin-downward-rebound'}
 ]){
  const proof=row(options),run=runFor(proof),report=buildEndingReport(run);
  assert.ok(deriveAchievementsV60(run).includes(options.badge));
  assert.equal(report.metadata.complete,true);
  assert.equal(report.metadata.decisionCount,1,'one action is one result, including completed work');
  assert.equal(report.samples.at(-1).label,'自己人發話');
  assert.deepEqual(report.samples.at(-1).stats,run.stats);
  assert.ok(report.trends.every(item=>item.available&&item.points.length===2));
  for(const mutate of [
   item=>{item.actions[0].version=1;},item=>{item.actions[0].version=3;},
   item=>{item.actions[0].eventId='some-other-event';},item=>{item.actions[0].target='sonny';},
   item=>{item.actions=[];}
  ]){
   const invalid=copy(run);mutate(invalid);
   assert.equal(deriveAchievementsV60(invalid).includes(options.badge),false);
   const broken=buildEndingReport(invalid);
   assert.equal(broken.metadata.complete,false);
   assert.ok(broken.trends.every(item=>!item.available&&item.points.length===0));
  }
 }
});

test('legacy v1 projection, achievements and report evidence retain their historical envelope',()=>{
 for(const profile of [67,68,69]){
  const proof=row({eventId:'patronage-reply',kind:'patronage',choiceIndex:0,version:1});
  proof.patronageOutcome.origin='meeting-ten-minutes';
  const run=runFor(proof,profile);
  assert.equal(isPatronageOutcomeV43(run,proof),true);
  assert.equal(characterAffinity(run,'rick').score,38);
  assert.ok(deriveAchievementsV60(run).includes('kin-downward-rebound'));
  assert.equal(buildEndingReport(run).metadata.complete,true);
  const forged=copy(run);forged.actions[0].version=2;
  assert.equal(buildEndingReport(forged).metadata.complete,false);
  assert.equal(deriveAchievementsV60(forged).includes('kin-downward-rebound'),false);
 }
});

function firstNaturalSource(kind,entropy){
 const actualSeed=recruitmentSeedV60(entropy,kind,69),entry=directEntryV60(actualSeed);
 let run=E.enableActivitySchedule(E.createRun(entry.roleId,actualSeed));
 for(let step=0;step<12&&!run.completed;step++){
  if(E.getPatronageReplyTargets(run).length)return run;
  const event=E.getEvent(run),index=event.choices.findIndex(choice=>choice.available!==false);
  assert.ok(index>=0,'ordinary onboarding introductions have an available answer');
  run=E.advance(E.applyChoice(run,index));
 }
 throw new Error('Natural special appointment did not reach its first work scene');
}

test('natural r69 son and daughter replies preserve full report traces and exactly one selected-person relationship',()=>{
 for(const kind of ['godson','goddaughter']){
  const source=firstNaturalSource(kind,'abcd'.repeat(8)),before=deriveCharacterStats(source);
  for(const target of E.getPatronageReplyTargets(source)){
   const pending=E.requestPatronageReply(source,target),proof=pending.history.at(-1),after=E.advance(pending);
   assert.equal(E.validRun(pending),true);assert.equal(E.validRun(after),true);
   assert.deepEqual(E.replayRun(source.roleId,source.seed,after.actions),after);
   assert.equal(proof.eventId,source.eventId);assert.equal(proof.patronageOutcome.version,2);
   assert.equal(proof.choiceIndex,E.getEvent(source).choices.length);
   assert.equal(pending.history.length,source.history.length+1);
   assert.equal(isPatronageOutcomeV43(pending,proof),true);
   const ledger=deriveCharacterStats(pending),delta=proof.patronageOutcome.affinityDelta;
   for(const item of ledger){
    const old=before.find(prior=>prior.id===item.id);
    assert.equal(item.encounters-old.encounters,Number(item.id===target));
    assert.equal(item.imaginedHits,old.imaginedHits);assert.equal(item.realHits,old.realHits);
    if(item.id!==target)assert.deepEqual(item,old);
   }
   const score=characterAffinity(source,target).score;
   assert.equal(characterAffinity(pending,target).score,Math.max(0,Math.min(100,score+delta)));
   for(const state of [pending,after]){
    const report=buildEndingReport(state);
    assert.equal(report.metadata.complete,true);
    assert.equal(report.samples.at(-1).label,'自己人發話');
    assert.deepEqual(report.samples[0].stats,E.createRun(source.roleId,source.seed).stats);
    assert.deepEqual(report.samples.at(-1).stats,state.stats);
    assert.ok(report.trends.every(item=>item.available&&item.points.length===state.history.length+1));
   }
  }
 }
});

test('natural r69 reactions still unlock both of the versioned patronage reply achievements',()=>{
 const found=new Set();
 for(let sample=1;sample<=24&&found.size<2;sample++){
  const source=firstNaturalSource(sample%2?'godson':'goddaughter',sample.toString(16).padStart(22,'0'));
  for(const target of E.getPatronageReplyTargets(source)){
   const pending=E.requestPatronageReply(source,target),proof=pending.history.at(-1).patronageOutcome;
   const expected=proof.mode==='flattery'&&proof.reaction==='welcomed'&&proof.affinityDelta>0?'kin-upward-applause':
    proof.mode==='entitled'&&['retort','reported'].includes(proof.reaction)&&proof.affinityDelta<0?'kin-downward-rebound':null;
   if(!expected)continue;
   assert.equal(E.validRun(pending),true);
   assert.ok(deriveAchievementsV60(pending).includes(expected));
   found.add(expected);
  }
 }
 assert.deepEqual([...found].sort(),['kin-downward-rebound','kin-upward-applause']);
});

test('rage and both verbal protocols can interrupt a revealed r69 reply without losing or settling its work twice',()=>{
 const source=firstNaturalSource('godson','abcd'.repeat(8)),target=E.getPatronageReplyTargets(source)[0];
 for(const [label,interrupt]of [
  ['imagined hit',state=>E.requestRage(state)],
  ['legacy verbal',state=>E.requestVerbal(state)],
  ['versioned verbal',state=>E.requestVerbal(state,undefined,2)]
 ]){
  const pending=E.requestPatronageReply(source,target),sourceRow=copy(pending.history.at(-1));
  assert.equal(pending.pending,true);assert.equal(pending.turn,source.turn);
  let run=interrupt(pending);
  assert.notEqual(run,pending,label);assert.equal(run.actions.at(-1).phase,'result',label);
  if(label==='imagined hit')assert.equal(run.rageContext.mode,'imagined','this naturally seeded witness returns to work');
  assert.equal(run.turn,source.turn,'an interruption before continuing cannot settle its source day yet');
  for(let step=0;step<12;step++){
   assert.equal(E.validRun(run),true,`${label}/${step}/${run.eventId}`);
   assert.deepEqual(E.replayRun(run.roleId,run.seed,run.actions),run.pending?E.advance(run):run,`${label}/${step}/replay`);
   assert.deepEqual(run.history[source.history.length],sourceRow,'a second response cannot change the committed reply result or income ledger');
   assert.equal(run.history.filter(item=>item.eventId===source.eventId&&item.patronageOutcome?.version===2).length,1);
   assert.ok(buildEndingReport(run).metadata.complete,`${label}/${step}/report`);
   if(!run.rageContext&&!run.verbalContext)break;
   if(run.pending)run=E.advance(run);
   else{
    const event=E.getEvent(run),index=event.choices.findIndex(choice=>choice.effect==='verbalV32Continue'&&!choice.draw&&choice.available!==false);
    assert.ok(index>=0,`${label}: use the visible stop-arguing answer, without choosing a departure`);
    run=E.advance(E.applyChoice(run,index));
   }
  }
  assert.equal(run.completed,false,label);assert.equal(run.pending,false,label);
  assert.equal(run.rageContext,null);assert.equal(run.verbalContext,null);
  assert.equal(run.turn,source.turn+1,'the already resolved work advances once when its interruption closes');
  assert.notEqual(run.eventId,source.eventId,'the same source choices cannot return');
  assert.equal(run.history.filter(item=>['daily','fantasy'].includes(item.kind)&&item.turn===source.turn).length,1);
  assert.deepEqual(run.history.filter(item=>(item.breakdown||[]).some(part=>['income','patronage-allowance','patronage-appointment'].includes(part.source))),
   pending.history.filter(item=>(item.breakdown||[]).some(part=>['income','patronage-allowance','patronage-appointment'].includes(part.source))),
   'the interruption and its return cannot mint another salary, allowance or appointment subsidy');
  const snapshot=copy(run);assert.equal(E.advance(run),run);assert.deepEqual(run,snapshot);
 }
});

test('directly addressing Wing in somebody else’s group scene keeps his explicit reply and luck scope',()=>{
 const choice=(eventId,index)=>({type:'choice',eventId,index});
 // A reached prefix from the visible-information careful policy. This replay
 // includes its real camel match, basketball and paid rest; no actor, meter,
 // source scene or random state is injected to construct the group encounter.
 const actions=[
  {type:'activity-schedule',version:1},
  ...[['onboarding',0],['recruitment60-rick',0],['recruitment60-princess',0],['cast35-helen-banquet-absence',0],['treats61-jack-drinks-0',2],['treats61-jack-drinks-1',1],['treats61-jack-drinks-2',0],['cast65-zoe-family-draft',0]].map(([id,index])=>choice(id,index)),
  {type:'activity-invitation',version:1,eventId:'cast39-captain-meeting-snacks'},
  choice('activity46-invite-camel',0),choice('activity44-camel-0',0),
  ...[2,2,2,1,2,2].map(move=>({type:'activity-play',version:1,eventId:'activity44-camel-1',index:1,input:{kind:'camel',prediction:[2,1,0],move}})),
  ...[['activity44-camel-2',0],['cast39-captain-meeting-snacks',0],['patronage67-education',2],['cast66-johnny-approval-loop',0],['shareholder58-offer',2]].map(([id,index])=>choice(id,index)),
  {type:'activity-invitation',version:1,eventId:'professor37-visit-room-reservation'},
  choice('activity46-invite-basketball',0),choice('activity44-basketball-0',1),
  {type:'activity-play',version:1,eventId:'activity44-basketball-1',index:1,input:{kind:'basketball',moves:[0,2,1,2,0]}},
  choice('activity44-basketball-2',0),choice('professor37-visit-room-reservation',0),choice('kind-workday',1),
  {type:'break'},choice('self-care',1),choice('work-gap-v50',0)
 ];
 const source=E.replayRun('admin','e39-r69-s-43f030da6fce221f6dc00f',actions),event=E.getEvent(source),snapshot=copy(source);
 assert.equal(event.id,'cast39-joyce-anger-table');assert.equal(event.speaker,'joyce');
 assert.deepEqual(E.getPatronageReplyTargets(source),['joyce','wing']);assert.equal(E.validRun(source),true);
 const pending=E.requestPatronageReply(source,'wing'),proof=pending.history.at(-1),resolved=patronageReplyOutcomesV43(source,event,'wing',{affinity:characterAffinity(source,'wing').score}).find(item=>item.reaction===proof.patronageOutcome.reaction);
 const actualBoss=proof.breakdown.filter(part=>part.source==='choice').reduce((sum,part)=>sum+(part.delta.boss||0),0);
 assert.equal(resolved.reaction,'welcomed');assert.equal(resolved.delta.boss,10);
 assert.equal(actualBoss,Math.max(0,Math.min(100,source.stats.boss+resolved.delta.boss))-source.stats.boss,
  'the selected Wing response is already scoped and cannot be damped using Joyce as the speaker');
 assert.equal(proof.breakdown.find(part=>part.source==='rng').delta.boss,-10,
  'this natural bad-luck draw also addresses Wing directly, so its boss delta is not indirectly damped');
 assert.equal(E.validRun(pending),true);assert.deepEqual(E.replayRun(source.roleId,source.seed,pending.actions),E.advance(pending));
 const original=E.applyChoice(source,1),originalRow=original.history.at(-1),originalChoice=event.choices[1];
 const oldScope=scopedBossDeltaV18(event,originalChoice.delta.boss||0,{source:'choice',result:originalChoice.result,effect:originalChoice.effect});
 assert.equal(originalRow.breakdown.filter(part=>part.source==='choice').reduce((sum,part)=>sum+(part.delta.boss||0),0),oldScope);
 assert.equal(originalRow.breakdown.find(part=>part.source==='rng').delta.boss,undefined,
  'the original Joyce answer still scopes its own luck through Joyce, not the newly available Wing target');
 assert.equal(originalRow.patronageOutcome,undefined);assert.equal(original.actions.at(-1).type,'choice');
 assert.deepEqual(source,snapshot,'previewing and committing either branch cannot change its source');
 assert.deepEqual(E.getEvent(source).choices,event.choices);assert.equal(E.validRun(original),true);
});
