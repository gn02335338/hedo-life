import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as engine from '../dist/engine.js';
import {CHARACTER_IDS,deriveCharacterStats,characterAffinity} from '../dist/character-stats.js';
import {deriveAchievements} from '../dist/achievements.js';
import {derivePublishedAchievements} from './achievement-compat.mjs';
import {patronageWorkCountV29} from '../dist/patronage-v29.js';
import {replayRoute} from './find-routes-v3.mjs';
import {frozenCharacterProjection,ORIGINAL_CHARACTER_IDS_V37} from './character-compat.mjs';

const copy=value=>JSON.parse(JSON.stringify(value));
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fixtures=JSON.parse(readFileSync(new URL('./fixtures/patronage-routes-v29.json',import.meta.url),'utf8')).routes;
const base=gender=>fixtures.find(row=>row.id===`application-${gender}-success`);
const action=(eventId,index)=>({type:'choice',eventId,index});
const choose=(run,index)=>engine.advance(engine.applyChoice(run,index));
const from=(gender,suffix=[])=>{const route=base(gender);return engine.replayRun(route.roleId,route.seed,[...route.actions,...suffix]);};
const groupSuffix=['reading-list-rush','system-weekend','kind-workday','system-printer','jonathan-today-release'].map(id=>action(id,2));
const boardSuffix=[...groupSuffix,action('banquet-welcome',1)];
const hrSuffix=[...boardSuffix,action('banquet-draw',0),action('banquet-afterparty',3),action('helen-ghost-product-owner',2)];
const reviewSuffix=[...hrSuffix,action('crisis-boss',2),action('job-system-schema',2),action('video-referee-committee',2),action('disk-suitcase-cloud',2)];
// A natural current-rules appointment: no role, gender, RNG, stat, flag or
// appointment is injected. This also exercises a newly added public character.
const currentActions=[
 action('onboarding',0),action('sales21-demo-operator',2),action('sales21-handover-promise-version',2),{type:'career'},action('career-review',3),
 action('professor37-sales-professor-question',2),action('kind-workday',0),action('cast35-helen-office-mom-roster',1),action('cast39-joyce-sales-cost',2),action('patronage-application',0),
];
const currentSource=()=>engine.replayRun('sales','e39-reply-proof-1',currentActions);
const naturalSources=()=>[
 {name:'son talking to Wing',run:from('male'),target:'wing',mode:'flattery'},
 {name:'daughter talking to Helen',run:from('female'),target:'helen',mode:'entitled'},
 {name:'son talking to Rick in a group',run:from('male',groupSuffix),target:'rick',mode:'entitled'},
 {name:'son talking to Wing in the same group',run:from('male',groupSuffix),target:'wing',mode:'flattery'},
 {name:'son talking to the chairman',run:from('male',boardSuffix),target:'spencer',mode:'flattery'},
 {name:'current-rules son talking to the princess',run:currentSource(),target:'princess',mode:'entitled'},
];
const nextRng=value=>{let result=value;result^=result<<13;result^=result>>>17;result^=result<<5;return result>>>0||1;};
const eventSnapshot=run=>copy(engine.getEvent(run));
const originalChoiceIdentity=event=>event.choices.map(choice=>({text:choice.text,effect:choice.effect??null,mealTarget:choice.mealTarget??null}));
const assertCanonical=run=>assert.equal(engine.validRun(copy(run)),true,`${run.seed}/${run.eventId}/${run.pending?'pending':'ready'}`);

test('appointed sons and daughters receive role-aware replies without changing their original choices or preview RNG',()=>{
 for(const {name,run,target,mode} of naturalSources()){
  assert.ok(run.patronage,name);assertCanonical(run);
  const snapshot=copy(run),event=eventSnapshot(run),targets=engine.getPatronageReplyTargets(run);
  assert.equal(engine.canRequestPatronageReply(run),true,name);assert.ok(targets.includes(target),name);
  const line=engine.getPatronageReplyLine(run,target);
  assert.equal(typeof line,'string');assert.ok(line.length>12,name);assert.doesNotMatch(line,/[%％]|成功率|機率|[+-]\d+/);
  for(let index=0;index<6;index++){
   assert.deepEqual(engine.getPatronageReplyTargets(run),targets);assert.equal(engine.getPatronageReplyLine(run,target),line);
   assert.deepEqual(engine.getEvent(run),event);assert.equal(engine.canRequestPatronageReply(run),true);
  }
  assert.deepEqual(run,snapshot,'reading or cancelling a target picker cannot mutate RNG, stats, flags, actions or history');
  const pending=engine.requestPatronageReply(run,target),row=pending.history.at(-1);
  assert.equal(row.choiceText,line,name);assert.equal(row.patronageOutcome.mode,mode,name);
  assert.deepEqual(engine.getEvent(run).choices,event.choices,'special reply is not inserted among canonical base choices');
 }
});

test('one reply commits one seeded reaction, a replayable action and a single bounded selected-person ledger',()=>{
 for(const {name,run,target,mode} of naturalSources()){
  const snapshot=copy(run),pending=engine.requestPatronageReply(run,target),row=pending.history.at(-1),after=engine.advance(pending);
  assert.notEqual(pending,run);assert.deepEqual(run,snapshot);assert.equal(pending.pending,true);assert.equal(pending.eventId,'patronage-reply');
  assert.equal(pending.rng,nextRng(run.rng),`${name}: exactly one response draw`);
  assert.equal(pending.history.length,run.history.length+1);assert.deepEqual(pending.history.slice(0,-1),run.history);
  assert.deepEqual(pending.actions.slice(0,-1),run.actions);assert.deepEqual(pending.actions.at(-1),{type:'patronage-reply',version:1,eventId:run.eventId,target});
  assert.equal(row.eventId,'patronage-reply');assert.equal(row.kind,'patronage');assert.equal(row.speaker,target);assert.equal(row.choiceIndex,0);
  assert.deepEqual(Object.keys(row.patronageOutcome).sort(),['version','origin','target','mode','reaction','affinityDelta'].sort());
  assert.equal(row.patronageOutcome.version,1);assert.equal(row.patronageOutcome.origin,run.eventId);assert.equal(row.patronageOutcome.target,target);assert.equal(row.patronageOutcome.mode,mode);
  assert.ok(['obliged','retort','reported','welcomed'].includes(row.patronageOutcome.reaction));
  assert.ok(Number.isInteger(row.patronageOutcome.affinityDelta)&&row.patronageOutcome.affinityDelta>=-24&&row.patronageOutcome.affinityDelta<=12);
  assert.equal(row.eventOutcome.label,'自己人發話之後');assert.ok(row.eventOutcome.result.length>0);
  assert.equal(pending.flags.patronage_reply_last_turn,run.turn+1);assert.equal(pending.turn,run.turn);
  assert.deepEqual(pending.patronageReplyContext,{version:1,eventId:run.eventId,historyIndex:run.history.length});
  for(const key of engine.STAT_KEYS){assert.ok(Number.isInteger(pending.stats[key]));assert.ok(pending.stats[key]>=0&&pending.stats[key]<=100,`${name}/${key}`);}
  assert.ok(pending.stats.mood>=1&&pending.stats.energy>=1);assert.ok(pending.stats.skill+pending.stats.slack+pending.stats.lick<=180);
  assert.equal(row.breakdown.some(part=>['income','workday','career-pressure','assignment','patronage-perk'].includes(part.source)),false,'the interruption cannot pay or resolve a workday');
  assertCanonical(pending);assertCanonical(after);assert.deepEqual(engine.requestPatronageReply(run,target),pending,'same seed and action have the same committed response');
  assert.deepEqual(engine.replayRun(run.roleId,run.seed,pending.actions),after);
 }
});

test('returning from a patronage reply restores the still undecided scene without charging a day, PIP, income or original choice',()=>{
 for(const {name,run,target} of naturalSources()){
  const event=eventSnapshot(run),pending=engine.requestPatronageReply(run,target),rng=pending.rng,after=engine.advance(copy(pending));
  assert.equal(after.eventId,run.eventId,name);assert.equal(after.pending,false);assert.equal(after.turn,run.turn);
  assert.equal(after.rng,rng,'revealing/continuing cannot reroll the reaction');assert.deepEqual(after.stats,pending.stats);
  const returned=engine.getEvent(after);assert.equal(returned.id,event.id);assert.equal(returned.title,event.title);
  assert.deepEqual(originalChoiceIdentity(returned),originalChoiceIdentity(event),'the original response indices and effects survive; derived chances can reflect the new stats');
  for(const key of ['pay','basePay','offerPay','rank','actualRoleId','assignment','pip','pipCount','lastPromotion','crisisCooldown','seen','mealContext','patronage','patronageContext','personnelPending','resumeEventId','breakReturnEventId'])assert.deepEqual(after[key],run[key],`${name}/${key}`);
  assert.equal(patronageWorkCountV29(after),patronageWorkCountV29(run));assert.equal(after.flags.career_service,run.flags.career_service);
  assert.equal(Object.hasOwn(after,'patronageReplyContext'),false);
  assert.equal(engine.canRequestPatronageReply(after),false,'same workturn cannot farm another exchange or affinity');
  assert.equal(engine.requestPatronageReply(after,target),after);
  assert.equal(engine.advance(after),after,'an extra continue cannot silently choose the restored scene');
  const index=event.choices.findIndex(choice=>choice.available!==false),chosen=engine.applyChoice(after,index),continued=engine.advance(chosen);
  assert.equal(chosen.history.at(-1).eventId,event.id);assert.equal(chosen.history.at(-1).choiceIndex,index);
  assertCanonical(chosen);assertCanonical(continued);assert.deepEqual(engine.replayRun(run.roleId,run.seed,continued.actions),continued);
 }
});

test('only the selected group participant receives relationship evidence and a reply is neither a hit nor a verbal-outburst badge',()=>{
 const source=from('male',groupSuffix);assert.deepEqual(engine.getPatronageReplyTargets(source),['rick','wing']);
 for(const target of ['rick','wing']){
  const pending=engine.requestPatronageReply(source,target),outcome=pending.history.at(-1).patronageOutcome,before=deriveCharacterStats(source),after=deriveCharacterStats(pending);
  const beforeBadges=deriveAchievements(source),afterBadges=deriveAchievements(pending);
  for(const id of CHARACTER_IDS){
   const old=before.find(row=>row.id===id),next=after.find(row=>row.id===id);
   assert.equal(next.imaginedHits,old.imaginedHits);assert.equal(next.realHits,old.realHits);
   if(id!==target){assert.deepEqual(next,old,`${target}/${id}: no incidental group affinity`);continue;}
   const affinity=characterAffinity(source,id).score,actual=Math.max(0,Math.min(100,affinity+outcome.affinityDelta))-affinity;
   assert.equal(next.encounters,old.encounters+1);assert.equal(next.affinityGained-old.affinityGained,Math.max(0,actual));assert.equal(next.affinityLost-old.affinityLost,Math.max(0,-actual));
   assert.equal(next.affinityUpEvents-old.affinityUpEvents,Number(actual>0));assert.equal(next.affinityDownEvents-old.affinityDownEvents,Number(actual<0));
  }
  const actionBadges=ids=>ids.filter(id=>/^(?:verbal-|rage-|real-hit-|dream-)/.test(id));
  assert.deepEqual(actionBadges(afterBadges),actionBadges(beforeBadges),'the new tone cannot borrow a verbal, dream-hit or real-hit achievement; stat achievements can reflect its actual delta');
 }
});

test('unappointed lives, resolved results, menus, absent people and recursive interruptions cannot use a patronage reply',()=>{
 for(const seed of ['unversioned','e28-reply-old','e29-reply-new','e39-reply-current']){
  const run=engine.createRun('sales',seed),snapshot=copy(run);
  assert.equal(engine.canRequestPatronageReply(run),false);assert.deepEqual(engine.getPatronageReplyTargets(run),[]);
  assert.equal(engine.requestPatronageReply(run,'wing'),run);assert.deepEqual(run,snapshot);
 }
 const source=from('female'),pending=engine.requestPatronageReply(source,'helen'),breakMenu=engine.requestBreak(source),exitMenu=engine.requestExit(source);
 const guestMenu=choose(breakMenu,engine.getEvent(breakMenu).choices.findIndex(choice=>choice.effect==='mealOpen'));
 assert.equal(guestMenu.eventId,'meal-guests-a');
 for(const state of [pending,engine.applyChoice(source,0),breakMenu,guestMenu,exitMenu]){
  assert.equal(engine.canRequestPatronageReply(state),false,state.eventId);assert.deepEqual(engine.getPatronageReplyTargets(state),[]);
  assert.equal(engine.requestPatronageReply(state,'helen'),state);
 }
 const ended=choose(exitMenu,0);assert.equal(ended.completed,true);assertCanonical(ended);
 assert.equal(engine.canRequestPatronageReply(ended),false);assert.equal(engine.requestPatronageReply(ended,'helen'),ended);
 // These deliberately malformed boundaries test the guard, not an earned
 // appointment or accepted save; all accepted replay witnesses above are real.
 for(const key of ['mood','energy','cash']){const exhausted=copy(source);exhausted.stats[key]=0;assert.equal(engine.canRequestPatronageReply(exhausted),false);assert.equal(engine.requestPatronageReply(exhausted,'helen'),exhausted);}
 for(const target of [undefined,null,1,'self','wing','__proto__','fish','does-not-exist']){
  assert.equal(engine.getPatronageReplyLine(source,target),'');assert.equal(engine.requestPatronageReply(source,target),source);
 }
 for(const operation of [engine.requestBreak,engine.requestCareer,engine.requestRaise,engine.requestExit,engine.requestVerbal,engine.requestRage])assert.equal(operation(pending),pending,'another action cannot replace the committed reply');
 assert.equal(engine.applyChoice(pending,0),pending,'the internal reply is not a separately selectable scene');
});

test('formal personnel and PIP conversations remain unresolved after answering from the protected position',()=>{
 for(const [suffix,eventId,targets] of [[hrSuffix,'crisis-boss',['erich','jenjen','sonny']],[reviewSuffix,'pip-review',['hope']]]){
  const source=from('male',suffix);assert.equal(source.eventId,eventId);assertCanonical(source);
  assert.deepEqual(engine.getPatronageReplyTargets(source),targets);
  for(const target of targets){
   const pending=engine.requestPatronageReply(source,target),after=engine.advance(pending);
   assert.equal(after.eventId,eventId);assert.deepEqual(after.pip,source.pip);assert.equal(after.pipCount,source.pipCount);
   assert.deepEqual(after.personnelPending,source.personnelPending);assert.equal(after.turn,source.turn);assert.equal(after.completed,false);assert.equal(after.pendingFamily,null);
   assertCanonical(pending);assertCanonical(after);
   const selected=engine.applyChoice(after,0),resolved=engine.advance(selected);assertCanonical(selected);assertCanonical(resolved);
   assert.deepEqual(engine.replayRun(source.roleId,source.seed,resolved.actions),resolved);
  }
 }
});

test('a paid dinner reply targets only its actual guest and never silently pays, cancels or finishes the meal',()=>{
 const source=from('female'),rest=engine.requestBreak(source),menu=choose(rest,engine.getEvent(rest).choices.findIndex(choice=>choice.effect==='mealOpen'));
 for(const guest of ['wing','spencer','erich','sonny','rick','kind','hope']){
  const index=engine.getEvent(menu).choices.findIndex(choice=>choice.mealTarget===guest),table=choose(menu,index);assert.equal(table.eventId,`meal-with-${guest}`);
  assert.deepEqual(engine.getPatronageReplyTargets(table),[guest]);
  const pending=engine.requestPatronageReply(table,guest),after=engine.advance(pending);
  assert.equal(pending.stats.cash,table.stats.cash);assert.equal(after.stats.cash,table.stats.cash);assert.deepEqual(after.mealContext,table.mealContext);
  assert.equal(after.eventId,table.eventId);assert.equal(after.turn,table.turn);assertCanonical(pending);assertCanonical(after);
  const finish=engine.getEvent(after).choices.findIndex(choice=>choice.effect==='mealFinish'&&choice.available!==false);
  assert.ok(finish>=0);const paid=engine.applyChoice(after,finish),returned=engine.advance(paid);
  assert.ok(paid.stats.cash<after.stats.cash);assert.equal(paid.history.filter(row=>row.eventId===table.eventId).length,1);
  assertCanonical(paid);assertCanonical(returned);assert.deepEqual(engine.replayRun(source.roleId,source.seed,returned.actions),returned);
 }
});

test('subsequent verbal or rage actions remain independently replayable after the reply returns to its original scene',()=>{
 // e29 predates verbal actions, so use its already proven rage path here.
 const source=from('male',groupSuffix),after=engine.advance(engine.requestPatronageReply(source,'rick'));
 for(const target of engine.getRageTargets(after)){
  const pending=engine.requestRage(after,target);assert.notEqual(pending,after);assertCanonical(pending);
  const resolved=engine.advance(pending);assertCanonical(resolved);assert.deepEqual(engine.replayRun(source.roleId,source.seed,resolved.actions),resolved);
 }
 const selected=engine.applyChoice(after,0);assert.equal(selected.pending,true);assertCanonical(selected);
 for(const target of engine.getRageTargets(selected)){
  const pending=engine.requestRage(selected,target);assert.notEqual(pending,selected);assert.equal(pending.rageContext.phase,'result');assertCanonical(pending);
  const resolved=engine.advance(pending);assertCanonical(resolved);assert.deepEqual(engine.replayRun(source.roleId,source.seed,resolved.actions),resolved);
 }
 const current=currentSource(),returned=engine.advance(engine.requestPatronageReply(current,'princess'));
 for(const phase of ['event','result']){
  const ready=phase==='event'?returned:engine.applyChoice(returned,0);assert.equal(ready.pending,phase==='result');assertCanonical(ready);
  const targets=engine.getVerbalTargets(ready);assert.deepEqual(targets,['princess']);
  for(const version of [undefined,2]){
   const pending=engine.requestVerbal(ready,undefined,version);assert.notEqual(pending,ready);assert.equal(pending.verbalContext.phase,phase);assertCanonical(pending);
   const resolved=engine.advance(pending);assertCanonical(resolved);assert.deepEqual(engine.replayRun(current.roleId,current.seed,resolved.actions),resolved);
  }
  const raging=engine.requestRage(ready);assert.notEqual(raging,ready);assert.equal(raging.rageContext.phase,phase);assertCanonical(raging);
  const resolved=engine.advance(raging);assertCanonical(resolved);assert.deepEqual(engine.replayRun(current.roleId,current.seed,resolved.actions),resolved);
 }
});

test('natural appointed trajectories really draw all four reactions rather than always granting the protected player a win',()=>{
 const counts=new Map(),witnesses=new Map();let samples=0;
 for(let policy=0;policy<8;policy++){
  let run=from(policy%2?'female':'male');
  for(let step=0;step<28&&!run.completed;step++){
   for(const target of engine.getPatronageReplyTargets(run)){
    const pending=engine.requestPatronageReply(run,target),reaction=pending.history.at(-1).patronageOutcome.reaction;
    counts.set(reaction,(counts.get(reaction)||0)+1);if(!witnesses.has(reaction))witnesses.set(reaction,pending);samples++;
   }
   if(engine.canRequestBreak(run)&&(run.stats.energy<35||run.stats.mood<35)&&run.stats.cash>=8){run=engine.requestBreak(run);continue;}
   const event=engine.getEvent(run),choices=event.choices.filter(choice=>choice.available!==false);if(!choices.length)break;
   run=choose(run,event.choices.indexOf(choices[(policy+step*3)%choices.length]));
  }
 }
 assert.ok(samples>80);assert.deepEqual([...counts.keys()].sort(),['obliged','retort','reported','welcomed'].sort());
 for(const [reaction,count] of counts){assert.ok(count>=5,`${reaction} has multiple natural witnesses`);assert.ok(count/samples<.8,`${reaction} does not swallow the whole sampled flow`);assertCanonical(witnesses.get(reaction));assertCanonical(engine.advance(witnesses.get(reaction)));}
});

test('forged action envelopes, RNG, statistics, relationships, context and direct release choices fail canonical replay',()=>{
 const source=from('female'),pending=engine.requestPatronageReply(source,'helen'),after=engine.advance(pending),action=copy(pending.actions.at(-1));
 const invalidActions=[
  {...action,version:2},{...action,version:undefined},{...action,eventId:'onboarding'},{...action,target:'wing'},
  {...action,target:null},{...action,extra:true},{...action,reaction:'obliged'},{...action,phase:'event'},
  {type:'patronage-reply',version:1,eventId:source.eventId},
 ];
 for(const invalid of invalidActions)assert.throws(()=>engine.replayRun(source.roleId,source.seed,[...source.actions,invalid]));
 assert.throws(()=>engine.replayRun(source.roleId,source.seed,[...pending.actions,action]));
 assert.throws(()=>engine.replayRun(source.roleId,source.seed,[...source.actions,{type:'choice',eventId:'patronage-reply',index:0}]));
 const changes=[
  run=>{run.rng=nextRng(run.rng);},run=>{run.stats.cash=(run.stats.cash+1)%101;},run=>{run.stats.boss=(run.stats.boss+1)%101;},
  run=>{run.flags.patronage_reply_last_turn++;},run=>{run.history.at(-1).patronageOutcome.affinityDelta++;},
  run=>{run.history.at(-1).patronageOutcome.target='wing';},run=>{run.history.at(-1).result+=' forged';},
  run=>{run.history.at(-1).choiceText+=' forged';},run=>{run.actions.at(-1).target='wing';},
 ];
 for(const original of [pending,after])for(const change of changes){const forged=copy(original);change(forged);assert.equal(engine.validRun(forged),false);}
 for(const change of [run=>{run.patronageReplyContext.historyIndex=0;},run=>{run.patronageReplyContext.eventId='onboarding';},run=>{run.patronageReplyContext.version=2;},run=>{delete run.patronageReplyContext;}]){
  const forged=copy(pending);change(forged);assert.equal(engine.validRun(forged),false);
 }
 const retained=copy(after);retained.patronageReplyContext=copy(pending.patronageReplyContext);assert.equal(engine.validRun(retained),false);
});

test('adding the optional reply preserves untouched published e29 and e38 save checkpoints byte for byte',()=>{
 for(const cohort of [29,38]){
  const fixture=JSON.parse(readFileSync(new URL(`./fixtures/legacy-e${cohort}-routes.json`,import.meta.url),'utf8')),routes=Array.isArray(fixture)?fixture:fixture.routes;
  const digest=state=>cohort===29?hash(state):hash({engine:state,achievements:derivePublishedAchievements(state),characters:frozenCharacterProjection(deriveCharacterStats(state),ORIGINAL_CHARACTER_IDS_V37)});
  for(const route of [routes[0],routes[Math.floor(routes.length/2)],routes.at(-1)]){
   const checkpoints=[],run=replayRoute(route,state=>{assertCanonical(state);checkpoints.push(digest(state));assert.equal(Object.hasOwn(state,'patronageReplyContext'),false);assert.equal(Object.hasOwn(state.flags,'patronage_reply_last_turn'),false);});
   assert.deepEqual(checkpoints,route.checkpoints);assert.equal(digest(run),cohort===29?route.stateSha256:route.checkpoints.at(-1));
  }
 }
});
