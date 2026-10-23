import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../dist/engine.js';
import {ACTIVITY_IDS_V44 as CURRENT_ACTIVITY_IDS_V44} from '../dist/activities-v44.js';
const ACTIVITY_IDS_V44=CURRENT_ACTIVITY_IDS_V44.filter(id=>id!=='camel'); // This fixture cohort published seven activities.
import {scheduledActivityV46} from '../dist/activity-schedule-v46.js';
import {validateCompletion} from '../worker/http.js';
import {ROLE_MAP} from '../dist/roles.js';

const copy=value=>JSON.parse(JSON.stringify(value));
const choose=(run,index)=>engine.advance(engine.applyChoice(run,index));
const canonical=run=>assert.equal(engine.validRun(copy(run)),true,`${run.seed}/${run.eventId}/${run.pending?'pending':'ready'}`);
const sameReplay=run=>assert.deepEqual(engine.replayRun(run.roleId,run.seed,run.actions),run);
const score=run=>run.completed?-1e6:
 Math.min(run.stats.energy,run.stats.mood)*5+run.stats.energy+run.stats.mood+Math.min(run.stats.boss,60)*.9+run.stats.cash*.35+run.stats.trust*.15-
 (run.pip?.active?70:0)-(run.flags.floor_watch?100:0)-(run.chapterContext?60:0);
const resilientChoice=run=>{
 const event=engine.getEvent(run),options=event.choices.flatMap((choice,index)=>choice.available===false?[]:[index]);
 let best=null;
 for(const index of options){
  try{const after=choose(run,index),value=score(after);if(!best||value>best.value)best={index,after,value};}catch{}
 }
 if(!best)throw new Error(`No safe choice: ${run.seed}/${run.eventId}`);
 return best.after;
};

// The fixtures below are complete, naturally replayable lives. No stats, flags,
// dates, context or selected invitation is injected to reach a desired activity.
const sources=new Map(),itineraries=[];
for(let index=0;index<160&&(sources.size<ACTIVITY_IDS_V44.length||itineraries.length<12);index++){
 let run=engine.enableActivitySchedule(engine.createRun('system',`e39-cal46-test-${index}`));
 const invitations=[];
 for(let step=0;step<130&&!run.completed&&run.turn<20;step++){
  if(engine.canRequestActivityInvitation(run)){
   const opened=engine.requestActivityInvitation(run),id=opened.activityInvitationContext.id;
   if(!sources.has(id))sources.set(id,copy(run));
   invitations.push({id,turn:run.turn,prior:copy(run.flags)});
   run=choose(opened,1);
   continue;
  }
  if(engine.canRequestBreak(run)&&(run.stats.energy<47||run.stats.mood<47)){
   run=resilientChoice(engine.requestBreak(run));
   continue;
  }
  run=resilientChoice(run);
 }
 itineraries.push({seed:run.seed,invitations,run});
}
assert.deepEqual([...sources.keys()].sort(),[...ACTIVITY_IDS_V44].sort(),'all seven invitations occur in naturally playable lives');

test('the new calendar is explicitly versioned and enabling it changes no random stream or work result',()=>{
 const fresh=engine.createRun('system','e39-cal46-enroll'),snapshot=copy(fresh),enabled=engine.enableActivitySchedule(fresh);
 assert.notEqual(enabled,fresh);assert.deepEqual(fresh,snapshot);
 assert.deepEqual(enabled.actions,[...fresh.actions,{type:'activity-schedule',version:1}]);
 assert.equal(enabled.flags.activity46_enabled,1);
 for(const key of ['rng','turn','pay','history','stats','eventId','pip','pipCount','seen'])assert.deepEqual(enabled[key],fresh[key],key);
 assert.equal(engine.enableActivitySchedule(enabled),enabled);canonical(enabled);sameReplay(enabled);
 for(const seed of ['e39-legacy-calendar','e38-calendar']){
  const old=engine.createRun('system',seed);assert.equal(engine.enableActivitySchedule(old),old);
  assert.equal(engine.canRequestActivityInvitation(old),false);assert.equal(engine.requestActivityInvitation(old),old);
 }
 for(const patch of [{pending:true},{completed:true}]){
  const blocked={...fresh,...patch};assert.equal(engine.enableActivitySchedule(blocked),blocked);
 }
 const unregisteredChoice=engine.applyChoice(fresh,0);
 assert.equal(engine.enableActivitySchedule(unregisteredChoice),unregisteredChoice,'calendar enrollment cannot be inserted into an already started proof');
 assert.equal(engine.validRun(copy(unregisteredChoice)),false,'pending saves cannot skip the required first enrollment action');
 assert.equal(engine.validRun(copy(engine.advance(unregisteredChoice))),false,'advancing a save cannot hide the missing enrollment action');
 assert.throws(()=>engine.replayRun(fresh.roleId,fresh.seed,[{type:'choice',eventId:fresh.eventId,index:0}]));
 assert.throws(()=>engine.replayRun(fresh.roleId,fresh.seed,[{type:'activity-schedule',version:1},{type:'activity-schedule',version:1}]));
});

test('schedules vary across lives, do not repeat, preserve a cooldown and leave year-end activities until late in the year',()=>{
 const windows={arm:[2,15],diet:[4,11],roadshow:[6,15],dinner:[3,17],basketball:[2,17],review:[8,18],banquet:[16,19]};
 for(const {seed,invitations}of itineraries){
  assert.equal(new Set(invitations.map(row=>row.id)).size,invitations.length,seed);
  assert.ok(invitations.filter(row=>row.id!=='banquet').length<=3,seed);
  assert.ok(invitations.length<=4,seed);
  for(let index=0;index<invitations.length;index++){
   const row=invitations[index],[start,end]=windows[row.id];
   assert.ok(row.turn>=start&&row.turn<=end,`${seed}/${row.id}/${row.turn}`);
   assert.equal(!!row.prior[`activity46_seen_${row.id}`],false);
   if(index&&!(row.id==='banquet'&&row.turn===19))assert.ok(row.turn-invitations[index-1].turn>=2,`${seed}: invitations need two working turns between them, except the final year-end deadline`);
  }
 }
 assert.ok(itineraries.some(row=>row.invitations.some(invite=>invite.id==='banquet')));
 const firsts=new Set(itineraries.map(row=>row.invitations[0]?.id).filter(Boolean));
 assert.ok(firsts.size>=3,'different lives should not always start with the same activity');
});

test('the invitation is selected by the schedule; previews and opening consume no RNG, resources or workday',()=>{
 for(const [id,source]of sources){
  const snapshot=copy(source),event=copy(engine.getEvent(source));
  for(let repeat=0;repeat<4;repeat++){
   assert.equal(engine.canRequestActivityInvitation(source),true);
   assert.equal(scheduledActivityV46(source),id);
   assert.deepEqual(engine.getEvent(source),event);
  }
  const opened=engine.requestActivityInvitation(source),invitation=engine.getEvent(opened);
  assert.deepEqual(source,snapshot);assert.equal(opened.eventId,`activity46-invite-${id}`);
  assert.deepEqual(opened.activityInvitationContext,{version:1,id,returnEventId:source.eventId});
  assert.deepEqual(opened.actions.at(-1),{type:'activity-invitation',version:1,eventId:source.eventId});
  for(const key of ['rng','turn','pay','history','stats','pip','pipCount','seen'])assert.deepEqual(opened[key],source[key],`${id}/${key}`);
  assert.equal(opened.flags[`activity46_seen_${id}`],1);assert.equal(opened.flags.activity46_last_turn,source.turn+1);
  assert.equal(opened.flags.activity46_count||0,(source.flags.activity46_count||0)+(id==='banquet'?0:1));
  if(id==='banquet')assert.equal(opened.flags.banquet_seen,1);
  assert.equal(invitation.kind,'activity-invitation');assert.equal(invitation.choices.length,3);
  assert.equal(invitation.choices[2].wild,true);
  assert.equal(engine.requestActivityInvitation(opened),opened);canonical(opened);sameReplay(opened);
 }
});

test('players can accept, decline or give a wild refusal; the answer is committed before any activity begins',()=>{
 for(const [id,source]of sources)for(let index=0;index<3;index++){
  const opened=engine.requestActivityInvitation(source),event=engine.getEvent(opened),pending=engine.applyChoice(opened,index),row=pending.history.at(-1);
  assert.equal(pending.pending,true);assert.equal(pending.pendingEffect,'activityInvitationContinue');
  assert.equal(pending.activityContext,undefined,'an invitation does not force the player to participate');
  assert.deepEqual(row.activityInvitationOutcome,{version:1,id,accepted:index===0});
  assert.equal(row.kind,'activity-invitation');assert.equal(row.eventId,event.id);assert.equal(row.choiceText,event.choices[index].text);
  assert.ok(row.result.length>10);assert.ok(Object.values(row.delta).every(value=>value===0));
  assert.ok(!row.breakdown?.length,'RSVP is not another workday or a hidden payment');
  for(const key of ['rng','turn','pay','stats','pip','pipCount','seen'])assert.deepEqual(pending[key],source[key],`${id}/${index}/${key}`);
  assert.equal(engine.applyChoice(pending,index),pending);canonical(pending);
  const next=engine.advance(copy(pending));canonical(next);sameReplay(next);
  assert.equal(next.activityInvitationContext,undefined);
  for(const key of ['rng','turn','pay','stats','pip','pipCount','seen'])assert.deepEqual(next[key],source[key],`${id}/${index}/advanced/${key}`);
  if(index===0){
   assert.deepEqual(next.activityContext,{version:1,id,stage:0,returnEventId:source.eventId,score:0,pressure:0,plan:'',picks:[]});
   assert.equal(next.eventId,`activity44-${id}-0`);
  }else{
   assert.equal(next.activityContext,undefined);assert.equal(next.eventId,source.eventId);
   assert.deepEqual(engine.getEvent(next),engine.getEvent(source));
   assert.equal(engine.canRequestActivityInvitation(next),false,'declining cannot reroll the same working turn');
   assert.equal(engine.advance(next),next);
  }
 }
});

test('accepted activities retain their complete existing gameplay and return to the unanswered work event',()=>{
 for(const [id,source]of sources){
  let run=choose(engine.requestActivityInvitation(source),0),stages=0;
  while(run.activityContext){
   assert.ok(stages++<5,`${id}: no activity loop`);
   const event=engine.getEvent(run),index=event.choices.findIndex(choice=>choice.available!==false),pending=engine.applyChoice(run,index);
   assert.equal(pending.turn,source.turn);assert.equal(pending.pay,source.pay);
   assert.deepEqual(pending.pip,source.pip);assert.equal(pending.pipCount,source.pipCount);
   assert.equal(pending.history.at(-1).activityOutcome.id,id);canonical(pending);
   run=engine.advance(copy(pending));canonical(run);sameReplay(run);
  }
  assert.equal(stages,id==='banquet'?4:3);assert.equal(run.eventId,source.eventId);assert.equal(run.completed,false);
  assert.equal(run.flags[`activity44_${id}`],1);assert.equal(run.flags[`activity46_seen_${id}`],1);
  assert.equal(run.turn,source.turn);assert.equal(run.pay,source.pay);assert.equal(run.pending,false);
  assert.deepEqual(engine.getEvent(run).choices.map(choice=>choice.text),engine.getEvent(source).choices.map(choice=>choice.text));
 }
});

test('an invitation blocks unrelated menus, cannot bypass a personnel crisis and is never manually selected',()=>{
 const source=sources.values().next().value,opened=engine.requestActivityInvitation(source),pending=engine.applyChoice(opened,0);
 for(const state of [opened,pending]){
  for(const operation of [engine.requestBreak,engine.requestCareer,engine.requestRaise,engine.requestExit,engine.requestVerbal,engine.requestRage,engine.requestSalaryAdvice,engine.requestPatronageReply,engine.requestHiddenEncounter])assert.equal(operation(state),state);
  for(const id of ACTIVITY_IDS_V44)assert.equal(engine.requestActivity(state,id),state);
  assert.equal(engine.canRequestActivityInvitation(state),false);
 }
 const patches=[{pending:true},{completed:true},{pip:{active:true}},{flags:{...source.flags,floor_watch:1}},
  {activityContext:{}},{hiddenEncounterContext:{}},{chapterContext:{}},{companyContext:{}},{verbalContext:{}},{rageContext:{}},
  {patronageReplyContext:{}},{personnelPending:{}},{turn:0},{turn:20},
  {stats:{...source.stats,mood:15}},{stats:{...source.stats,energy:15}},{stats:{...source.stats,cash:0}}];
 for(const patch of patches){
  const state={...source,...patch};assert.equal(engine.canRequestActivityInvitation(state),false);assert.equal(engine.requestActivityInvitation(state),state);
 }
 const unscheduled=engine.createRun('system','e39-cal46-manual');
 for(const state of [source,unscheduled])for(const id of ACTIVITY_IDS_V44){assert.equal(engine.canRequestActivity(state,id),false);assert.equal(engine.requestActivity(state,id),state);}
 const legacy=choose(engine.createRun('system','e39-activity-natural-0'),0);
 assert.equal(engine.canRequestActivity(legacy),true,'the published manual-activity protocol remains replayable');
 const manual=engine.requestActivity(legacy,'banquet');assert.notEqual(manual,legacy);canonical(manual);sameReplay(manual);
});

test('forged schedules, contexts, selected activities and invitation outcomes fail canonical replay',()=>{
 const source=sources.values().next().value,opened=engine.requestActivityInvitation(source),pending=engine.applyChoice(opened,0),other=ACTIVITY_IDS_V44.find(id=>id!==opened.activityInvitationContext.id);
 for(const mutate of [run=>run.activityInvitationContext.id=other,run=>run.activityInvitationContext.returnEventId='onboarding',run=>run.activityInvitationContext.extra=true,
  run=>run.rng++,run=>run.stats.cash--,run=>run.flags.activity46_count++,run=>run.actions.at(-1).activityId=other]){
  const forged=copy(opened);mutate(forged);assert.equal(engine.validRun(forged),false);
 }
 for(const mutate of [run=>run.history.at(-1).result+=' forged',run=>run.history.at(-1).activityInvitationOutcome.accepted=false,run=>run.history.at(-1).activityInvitationOutcome.id=other,run=>run.history.at(-1).delta.boss=20]){
  const forged=copy(pending);mutate(forged);assert.equal(engine.validRun(forged),false);
 }
 assert.equal(engine.validRun({...source,activityInvitationContext:copy(opened.activityInvitationContext)}),false);
 const plain=engine.createRun('system','e39-cal46-forged');
 assert.equal(engine.validRun({...plain,flags:{...plain.flags,activity46_enabled:1}}),false);
 for(const action of [{type:'activity-invitation',version:2,eventId:source.eventId},{type:'activity-invitation',version:1,eventId:'onboarding'},
  {type:'activity-invitation',version:1,eventId:source.eventId,activityId:other},{type:'activity-schedule',version:2},{type:'activity-schedule',version:1,enabled:true}]){
  assert.throws(()=>engine.replayRun(source.roleId,source.seed,[...source.actions,action]));
 }
 assert.throws(()=>engine.replayRun(source.roleId,source.seed,[{type:'activity-invitation',version:1,eventId:'onboarding'}]));
});

test('server action grammar accepts only calendar enrollment and the current event invitation; clients cannot choose an activity',()=>{
 const source=sources.values().next().value,opened=engine.requestActivityInvitation(source),body={runId:'22222222-2222-4222-8222-222222222222',roleId:source.roleId,seed:source.seed,actions:opened.actions};
 assert.doesNotThrow(()=>validateCompletion(body,ROLE_MAP));
 for(const action of [{type:'activity-schedule',version:2},{type:'activity-schedule',version:1,extra:true},{type:'activity-schedule'},
  {type:'activity-invitation',version:2,eventId:source.eventId},{type:'activity-invitation',version:1,eventId:''},
  {type:'activity-invitation',version:1,eventId:source.eventId,activityId:'banquet'},{type:'activity-invitation',eventId:source.eventId}]){
  assert.throws(()=>validateCompletion({...body,actions:[action]},ROLE_MAP));
 }
 for(const seed of ['e39-old-calendar','e38-old-calendar'])for(const action of [{type:'activity-schedule',version:1},{type:'activity-invitation',version:1,eventId:source.eventId}])assert.throws(()=>validateCompletion({...body,seed,actions:[action]},ROLE_MAP));
 assert.throws(()=>validateCompletion({...body,actions:[{type:'activity',version:1,activityId:'banquet'}]},ROLE_MAP));
});
