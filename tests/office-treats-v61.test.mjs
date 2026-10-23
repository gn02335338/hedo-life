import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as E from '../dist/engine.js';
import {directEntryV60,isRecruitmentV60} from '../dist/recruitment-v60.js';
import {isOfficeTreatsV61,isOfficeTreatOutcomeV61} from '../dist/office-treats-v61.js';
import {isWorkGapV50} from '../dist/work-gap-v50.js';
import {isEnergyRestV53} from '../dist/energy-rest-v53.js';
import {isEnergySafetyV54} from '../dist/energy-safety-v54.js';
import {isActivityPlayV55} from '../dist/activity-play-v55.js';
import {isShareholderV58} from '../dist/shareholders-v58.js';
import {isPatronageV49} from '../dist/patronage-v49.js';
import {leaderboardEligibilityV56} from '../dist/leaderboard-score-v56.js';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/office-treats-routes-v61.json',import.meta.url),'utf8'));
const ids=['jack-drinks','company-tea','birthday-cake'],copy=value=>JSON.parse(JSON.stringify(value));
const row=id=>{const route=fixture.routes.find(route=>route.id===id);assert.ok(route,id);return route;};
const load=(id,before=false)=>{const route=row(id);return E.replayRun(route.roleId,route.seed,before?route.beforeActions:route.actions);};
const choose=(run,index)=>E.advance(E.applyChoice(run,index));
const exact=run=>E.replayRun(run.roleId,run.seed,copy(run.actions));
const noMenus=run=>{
 for(const [can,request]of [[E.canRequestBreak,E.requestBreak],[E.canRequestCareer,E.requestCareer],[E.canRequestRaise,E.requestRaise],[E.canRequestActivityInvitation,E.requestActivityInvitation],[E.canRequestHiddenEncounter,E.requestHiddenEncounter]]){assert.equal(can(run),false);assert.equal(request(run),run);}
 assert.equal(E.requestExit(run),run);assert.equal(E.canRequestVerbal(run),false);assert.equal(E.canRequestRage(run),false);assert.equal(E.canRequestPatronageReply(run),false);assert.equal(E.isWorkGapOpenV50(run),false);
 assert.equal(E.canRequestSalaryAdvice(run),false);assert.equal(E.requestSalaryAdvice(run),run);assert.equal(E.requestVerbal(run,undefined,2),run);assert.equal(E.requestRage(run),run);assert.equal(E.requestPatronageReply(run,'wing'),run);
};

test('all three office interludes and every branch are reached by natural fresh-profile public actions',()=>{
 assert.deepEqual(fixture.sources.map(row=>row.id).sort(),[...ids].sort());
 for(const route of fixture.routes){
  const run=E.replayRun(route.roleId,route.seed,route.actions);assert.match(run.seed,/^e39-r61-[nsd]-[a-f0-9]{22}$/);assert.equal(isOfficeTreatsV61(run),true,route.id);assert.equal(E.validRun(run),true,route.id);assert.equal(E.validRun(copy(run)),true,route.id);assert.deepEqual(exact(run),run,route.id);
 }
 for(const id of ids)for(const stage of [0,1,2]){
  const source=load(`${id}-${stage}-0`,true),event=E.getEvent(source),snapshot=copy(source);
  assert.equal(source.treatsContext.id,id);assert.equal(source.treatsContext.stage,stage);assert.equal(event.id,`treats61-${id}-${stage}`);assert.equal(event.kind,'office-treat');assert.ok(event.choices.length>=3);assert.equal(source.flags[`treats61_seen_${id}`],1);
  for(let read=0;read<3;read++)assert.deepEqual(E.getEvent(source),event);assert.deepEqual(source,snapshot,'reading a story does not draw another outcome');
  noMenus(source);
  for(const [index,choice]of event.choices.entries())if(choice.available!==false)assert.ok(fixture.routes.some(row=>row.id===`${id}-${stage}-${index}`),'every enabled player response has a reproducible witness');
 }
});

test('Jack’s drink invitation can be accepted or declined, while Jonathan’s full-topping cup stays on Jack’s bill',()=>{
 const source=load('jack-drinks-0-0',true),declined=choose(source,1);assert.ok(declined.treatsContext==null);assert.equal(declined.stats.cash,source.stats.cash);assert.equal(declined.history.at(-1).treatsOutcome.done,true);assert.equal(declined.history.at(-1).treatsOutcome.accepted,false);
 const drinks=load('jack-drinks-1-0',true);assert.equal(E.getEvent(drinks).choices.length,4);
 const declinedCup=choose(drinks,2);assert.equal(declinedCup.stats.cash,drinks.stats.cash);assert.equal(E.validRun(declinedCup),true);
 const text=fixture.routes.filter(row=>row.storyId==='jack-drinks').map(route=>{const run=E.replayRun(route.roleId,route.seed,route.actions);return `${run.history.at(-1).body} ${run.history.at(-1).result}`;}).join('\n');
 assert.match(text,/強哥|助理工程師/);assert.match(text,/滿料|加料|配料/);assert.match(text,/傑克.*(?:買單|付錢|付款|請客)|(?:買單|付款).*傑克/);
});

test('the one-and-a-half-star company tea accident cancels only company tea, preserving a later private Jack invitation',()=>{
 const initial=load('company-tea-0-0',true),tea=load('company-tea-1-0',true);assert.match(E.getEvent(initial).body,/1\.5|一點五|一星半/);assert.equal(initial.flags.treats61_company_tea_cancelled||0,0);assert.equal(E.applyChoice(initial,0).flags.treats61_company_tea_cancelled||0,0,'the first result cannot reveal the next scene’s cancellation');assert.equal(tea.flags.treats61_company_tea_cancelled,1,'the announced cancellation is already real before the player handles the aftermath');
 const text=fixture.routes.filter(route=>route.storyId==='company-tea').map(route=>{const run=E.replayRun(route.roleId,route.seed,route.actions);return `${run.history.at(-1).body} ${run.history.at(-1).result}`;}).join('\n');
 assert.match(text,/翅膀/);assert.match(text,/拿錯|誤拿|喝錯/);assert.match(text,/取消/);
 const later=load('private-jack-after-company-cancelled');assert.equal(later.flags.treats61_company_tea_cancelled,1);assert.equal(later.treatsContext.id,'jack-drinks');assert.equal(later.treatsContext.stage,0);
 const accepted=choose(later,0);assert.equal(accepted.treatsContext.id,'jack-drinks');assert.equal(accepted.treatsContext.stage,1);assert.equal(accepted.stats.cash,later.stats.cash);
});

test('the birthday story establishes the three-person photo and Jack’s painful solo cutting before asking the player to help',()=>{
 const source=load('birthday-cake-0-0',true),event=E.getEvent(source);assert.match(event.body,/翅膀/);assert.match(event.body,/水蛇/);assert.match(event.body,/傑克/);assert.match(event.body,/合照|拍照/);assert.match(event.body,/退冰|冰淇淋/);assert.match(event.body,/手.*(?:痛|酸)|(?:痛|酸).*手/);
 const options=event.choices.map(row=>row.text).join('\n');assert.match(options,/幫|接手|一起/);assert.match(options,/退冰/);assert.match(options,/鵝/);
});

test('every committed interlude choice preserves days, salary, PIP, energy and player cash, and pending results survive refresh exactly once',()=>{
 for(const route of fixture.routes.filter(route=>route.beforeActions)){
  const before=E.replayRun(route.roleId,route.seed,route.beforeActions),snapshot=copy(before),pending=E.applyChoice(before,route.index),result=pending.history.at(-1);
  assert.deepEqual(before,snapshot);assert.equal(pending.pending,true);assert.equal(result.kind,'office-treat');assert.equal(isOfficeTreatOutcomeV61(pending,result),true,route.id);assert.ok(result.result.length>15);assert.equal(result.delta.cash,0);assert.equal(result.delta.energy,0);assert.equal(pending.stats.cash,before.stats.cash);assert.equal(pending.stats.energy,before.stats.energy);assert.equal(pending.actions.length,before.actions.length+1);
  assert.deepEqual(pending.actions.at(-1),{type:'choice',eventId:before.eventId,index:route.index});
  for(const key of ['turn','pay','rank','pip','pipCount'])assert.deepEqual(pending[key],before[key],`${route.id}/${key}`);
  assert.equal(E.validRun(copy(pending)),true,route.id);noMenus(pending);assert.equal(E.applyChoice(pending,route.index),pending,'a displayed result cannot settle again');
  const after=E.advance(copy(pending));assert.deepEqual(exact(pending),after);assert.equal(after.rng,pending.rng,'continuing an already settled scene cannot draw its consequences again');
  for(const key of ['turn','pay','rank','pip','pipCount'])assert.deepEqual(after[key],before[key],`${route.id}/${key}/advance`);
  assert.equal(after.stats.cash,before.stats.cash);assert.equal(after.stats.energy,before.stats.energy);assert.equal(after.completed,false);
  if(result.treatsOutcome.done){assert.ok(after.treatsContext==null);assert.equal(after.eventId,before.treatsContext.returnEventId);}else{assert.equal(after.treatsContext.id,before.treatsContext.id);assert.equal(after.treatsContext.stage,before.treatsContext.stage+1);}
 }
});

test('story re-entry, skipped stages, invented orders, tampered outcomes and interleaved menu actions are rejected by exact replay',()=>{
 const before=load('jack-drinks-1-0',true),after=load('jack-drinks-1-0'),pending=E.applyChoice(before,0);
 for(const actions of [[...before.actions,{type:'choice',eventId:'treats61-jack-drinks-2',index:0}],[...after.actions,{type:'choice',eventId:before.eventId,index:0}],...[{type:'break'},{type:'exit'},{type:'career'},{type:'raise'},{type:'activity',version:1,activityId:'arm'}].map(action=>[...before.actions,action])])assert.throws(()=>E.replayRun(before.roleId,before.seed,actions));
 for(const mutate of [run=>run.treatsContext.stage=2,run=>run.flags['treats61_seen_jack-drinks']=99,run=>run.stats.cash=(run.stats.cash+1)%101,run=>run.history.at(-1).treatsOutcome.affinityDelta=999,run=>run.history.at(-1).result+=' forged']){const forged=copy(pending);mutate(forged);assert.equal(E.validRun(forged),false);}
 for(const id of ids){const ended=load(`${id}-2-0`);assert.ok(ended.treatsContext==null);assert.throws(()=>E.replayRun(ended.roleId,ended.seed,[...ended.actions,{type:'choice',eventId:`treats61-${id}-0`,index:0}]),'a finished story is not a repeatable reward menu');}
});

test('active PIP, scheduled activities and warning rest retain priority over office invitations',()=>{
 for(const id of ['guard-pip','guard-activity','guard-rest','guard-invitation']){
  const before=load(id);assert.ok(before.treatsContext==null,id);
  for(const [index,choice]of E.getEvent(before).choices.entries())if(choice.available!==false){const pending=E.applyChoice(before,index);assert.ok(pending.treatsContext==null,`${id}/pending`);const after=E.advance(pending);if(after.pip?.active||after.activityContext||after.activityInvitationContext||after.breakReturnEventId||after.pending||after.completed)assert.ok(after.treatsContext==null,`${id}/continuation`);assert.equal(E.validRun(after),true);}
 }
});

test('fresh office profiles preserve all previous feature gates and both special-entry variants',()=>{
 for(const marker of ['n','s','d']){
  const profile=`e39-r61-${marker}-${'a'.repeat(22)}`,entry=directEntryV60(profile),run=E.createRun(entry?.roleId||'system',profile);
  for(const enabled of [isRecruitmentV60,isOfficeTreatsV61,isWorkGapV50,isEnergyRestV53,isEnergySafetyV54,isActivityPlayV55,isShareholderV58,isPatronageV49])assert.equal(enabled(run),true,enabled.name);
  const scheduled=E.enableActivitySchedule(run);assert.equal(scheduled.flags.activity46_enabled,1);assert.equal(E.validRun(scheduled),true);
  const ended=choose(scheduled,2);assert.equal(ended.completed,true);assert.equal(leaderboardEligibilityV56(ended).eligible,true);assert.equal(E.validRun(ended),true);
  if(entry)assert.equal(run.characterGender,entry.gender);
 }
});

test('published r60 candidates and accepted reporting checkpoints keep their exact saved-state hashes',()=>{
 const hashes={n:['66150551b3220dcec7f49b9aa86bac40d2b8e686819cae34643220362ffe3e4d','3a31e9f36fb595875e69475471de552c67bc4cbcd7ab7cf309a2209843f78bdb'],s:['d295777cd667d18f73d3a68d484e96f32349176683db0ccb453123a7282947a4','ac66a73310d114a14af04a70e06304cb8d92c28ded80b0283628e9e8a93fc74a'],d:['283a34d64ea051f243fb377b607f39e24814b1e60665052cb7f537aaefa1be02','e90bb25f727396c7118c8e7db7114546fe11b041d2d87c686aa978dc8b466551']};
 for(const [marker,expected]of Object.entries(hashes)){
  const profile=`e39-r60-${marker}-${'a'.repeat(22)}`,entry=directEntryV60(profile),candidate=E.createRun(entry?.roleId||'system',profile),accepted=choose(E.enableActivitySchedule(candidate),0);
  for(const [index,run]of [candidate,accepted].entries()){assert.equal(isOfficeTreatsV61(run),false);assert.equal(run.treatsContext,undefined);assert.equal(createHash('sha256').update(JSON.stringify(run)).digest('hex'),expected[index]);assert.equal(E.validRun(run),true);}
 }
});
