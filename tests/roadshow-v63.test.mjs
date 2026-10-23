import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as E from '../dist/engine.js';
import {getActivityEventV44,resolveActivityChoiceV44} from '../dist/activities-v44.js';
import {getActivityPlayV55,deriveActivityPlayV55,resolveActivityPlayV55,withActivityPlayEventV55} from '../dist/activity-play-v55.js';
import {getActivityInvitationEventV46,scheduledActivityV46} from '../dist/activity-schedule-v46.js';
import {ROADSHOW_PARTICIPANTS_V63} from '../dist/roadshow-v63.js';

const {routes,departures}=JSON.parse(readFileSync(new URL('./fixtures/roadshow-v63.json',import.meta.url),'utf8'));
const row=id=>{const value=routes.find(route=>route.id===id);assert.ok(value,id);return value;};
const replay=(route,actions=route.actions)=>E.replayRun(route.roleId,route.seed,actions);
const before=id=>replay(row(id));
const choose=(run,index)=>E.advance(E.applyChoice(run,index));
const sameClock=(next,run)=>{for(const key of ['turn','pay','pip','pipCount'])assert.deepEqual(next[key],run[key],key);};

test('48 natural sales, business-development and product-design Roadshow routes refresh and replay exactly',()=>{
 assert.equal(routes.length,48);assert.deepEqual([...new Set(routes.map(route=>route.roleId))].sort(),['bd','design','sales']);
 for(const route of routes){const run=replay(route);assert.equal(E.validRun(run),true,route.id);assert.equal(E.validRun(JSON.parse(JSON.stringify(run))),true,route.id);assert.deepEqual(replay(route),run,route.id);}
});

test('water-snake hosting is introduced before acceptance, with all-company attendance and the three named presenters',()=>{
 for(const role of ['sales','bd','design']){
  const invitation=before(`${role}-invitation`),event=E.getEvent(invitation),snapshot=structuredClone(invitation);assert.equal(event.speaker,'meimei');assert.match(event.body,/全公司/);for(const name of ['水蛇','翅膀','屎潘蛇','林老師'])assert.match(event.body,new RegExp(name));assert.doesNotMatch(event.body,/真真/);assert.equal(event.choices[2].wild,true);assert.ok(event.choices.every(choice=>Object.keys(choice.delta).length===0));assert.deepEqual(invitation,snapshot);
  for(const index of [1,2]){const declined=before(`${role}-decline-${index}`);assert.equal(declined.activityContext,undefined);assert.equal(declined.flags.activity44_roadshow||0,0);assert.equal(declined.flags.activity44_roadshow_completed||0,0);sameClock(declined,invitation);assert.notEqual(scheduledActivityV46(declined),'roadshow');}
 }
});

test('three Roadshow scenes show the company audience, unequal speaking quality and concrete, wild player responses',()=>{
 const sources=[before('sales-stage-0'),before('sales-play'),before('sales-strong')];
 for(const [stage,run] of sources.entries()){
  const event=E.getEvent(run);assert.equal(event.activity.stage,stage);assert.equal(event.activity.total,3);assert.match(event.body,/全公司/);for(const name of ['水蛇','翅膀','屎潘蛇','林老師','傑克','咖啡'])assert.match(event.body,new RegExp(name));assert.deepEqual(event.participants,ROADSHOW_PARTICIPANTS_V63);assert.equal(event.participants.includes('jack'),false,'a background coffee sighting does not expand the three presenters and host into new attack targets');assert.equal(event.choices[2].wild,true);assert.match(event.choices[2].text,/傑克|咖啡機/);assert.doesNotMatch(event.body,/真真|300\s*存款|請喝飲料/);assert.equal(event.scope,'work');
 }
 const first=E.getEvent(sources[0]),middle=E.getEvent(sources[1]),last=E.getEvent(sources[2]);assert.equal(first.speaker,'meimei');assert.match(first.body,/什麼場景都能做/);assert.match(first.body,/怎麼用卻沒有答案/);assert.match(first.body,/來賓.*咖啡喝到飽/);assert.match(first.body,/場地方單杯新台幣 300 元/);assert.match(first.wing,/員工先不要喝/);assert.equal(middle.speaker,'professor');assert.match(middle.body,/原理|資料、方法、測試條件和限制/);assert.match(middle.wing,/展示要對得上條件/);assert.match(middle.body,/趁水蛇轉頭又補滿一杯/);assert.equal(last.speaker,'meimei');assert.match(last.body,/Roadshow 準備結束/);assert.match(last.body,/杯蓋.*外帶/);
});

test('the new six-card control descriptor is contextual but carries no answers, outcome probabilities or trusted scores',()=>{
 const run=before('sales-play'),snapshot=structuredClone(run),descriptor=getActivityPlayV55(run);assert.equal(descriptor.cards.length,6);assert.equal(descriptor.options.length,3);assert.equal(descriptor.optionDetails.length,3);for(const name of ['翅膀','屎潘蛇','林老師'])assert.match(descriptor.cards.join(' '),new RegExp(name));assert.match(descriptor.instructions,/水蛇/);assert.doesNotMatch(JSON.stringify(descriptor),/targets|successRate|chanceOutcome|affinityDelta|grade|score/);assert.deepEqual(run,snapshot);
 const strong={kind:'roadshow',matches:[0,1,2,1,0,2]},weak={kind:'roadshow',matches:[2,2,0,0,1,1]};assert.ok(deriveActivityPlayV55(strong,'roadshow').grade>deriveActivityPlayV55(weak,'roadshow').grade);
 for(const input of [strong,weak])for(const ticket of [.01,.99]){const resolved=resolveActivityPlayV55(run,input,ticket);assert.match(resolved.result,/林老師/);assert.match(resolved.result,/水蛇/);assert.match(resolved.result,/翅膀/);assert.match(resolved.result,/屎潘蛇/);assert.doesNotMatch(resolved.result,/真真/);assert.match(resolved.choiceText,/六張現場問題卡/);assert.equal(resolved.done,false);}
 for(const input of [{kind:'roadshow',matches:[0,1,2,1,0]},{kind:'roadshow',matches:[0,1,2,1,0,3]},{kind:'roadshow',matches:[0,1,2,1,0,2],score:100}])assert.throws(()=>E.applyActivityPlay(run,input));
});

test('real controls resolve once, keep work/PIP time still, and only the final scene marks the Roadshow completed',()=>{
 for(const role of ['sales','bd','design'])for(const name of ['strong','weak']){
  const route=row(`${role}-${name}`),run=replay(route,route.beforeActions),pending=E.applyActivityPlay(run,route.input),next=E.advance(JSON.parse(JSON.stringify(pending)));sameClock(pending,run);sameClock(next,run);assert.equal(E.validRun(pending),true);assert.deepEqual(E.applyActivityPlay(pending,route.input),pending);assert.equal(getActivityPlayV55(pending),null);assert.deepEqual(next,replay(route));assert.equal(next.rng,pending.rng);assert.equal(next.flags.activity44_roadshow||0,0);assert.equal(next.flags.activity44_roadshow_completed||0,0);assert.equal(E.canRequestBreak(next),false);
  assert.equal(pending.stats.cash,run.stats.cash,'the venue coffee price is not charged as player savings');
  for(const index of [0,1,2]){const final=before(`${role}-${name}-finish-${index}`);sameClock(final,run);assert.equal(final.stats.cash,run.stats.cash,'no coffee charge appears during cleanup either');assert.equal(final.activityContext,undefined);assert.equal(final.eventId,run.activityContext.returnEventId);assert.equal(final.flags.activity44_roadshow,1);assert.equal(final.flags.activity44_roadshow_completed,1);assert.equal(final.history.at(-1).activityOutcome.done,true);assert.match(final.history.at(-1).result,/Roadshow 結束/);assert.match(final.history.at(-1).result,/傑克.*咖啡外帶|傑克.*咖啡.*外帶/);assert.notEqual(scheduledActivityV46(final),'roadshow');}
 }
});

test('each setup and conclusion preserves the new presenter story rather than falling back to the legacy exhibition',()=>{
 for(const role of ['sales','bd','design']){
  for(const index of [0,1,2]){const result=before(`${role}-setup-${index}`).history.at(-1).result;assert.match(result,/水蛇/);assert.doesNotMatch(result,/真真/);assert.match(result,/林老師|全公司/);assert.match(result,/傑克.*咖啡/);assert.equal(before(`${role}-setup-${index}`).stats.cash,before(`${role}-stage-0`).stats.cash);}
  for(const name of ['strong','weak'])for(const index of [0,1,2]){const result=before(`${role}-${name}-finish-${index}`).history.at(-1).result;for(const name of ['水蛇','翅膀','屎潘蛇','林老師','全公司'])assert.match(result,new RegExp(name));}
 }
});

test('leaving any of the three Roadshow scenes aborts participation without completing the game or spending a work/PIP day',()=>{
 assert.equal(departures.length,9);
 for(const route of departures){
  const source=replay(route,route.beforeActions),pending=E.requestEventDepartureV63(source),left=E.advance(JSON.parse(JSON.stringify(pending)));assert.equal(E.getEventDepartureV63(source).available,true);assert.equal(pending.pending,true);assert.equal(E.getEventDepartureV63(pending).available,false);assert.deepEqual(E.requestEventDepartureV63(pending),pending);assert.equal(E.validRun(pending),true);assert.deepEqual(left,replay(route));assert.equal(E.validRun(left),true);assert.equal(left.activityContext,undefined);assert.equal(left.eventId,source.activityContext.returnEventId);sameClock(left,source);assert.equal(left.stats.cash,source.stats.cash);assert.equal(left.stats.energy,source.stats.energy);assert.equal(left.flags.departure63_activity_roadshow,1);assert.equal(left.flags.activity44_roadshow||0,0);assert.equal(left.flags.activity44_roadshow_completed||0,0);assert.equal(left.history.at(-1).kind,'event-departure');assert.equal(left.history.at(-1).departureOutcome.completed,false);assert.equal(left.history.at(-1).departureOutcome.workDaySpent,false);assert.equal(left.history.at(-1).activityOutcome,undefined);assert.equal(getActivityPlayV55(left),null);assert.deepEqual(E.applyActivityPlay(left,{kind:'roadshow',matches:[0,1,2,1,0,2]}),left);assert.notEqual(scheduledActivityV46(left),'roadshow');
  const oldControls={type:'activity-play',version:1,eventId:'activity44-roadshow-1',index:1,input:{kind:'roadshow',matches:[0,1,2,1,0,2]}};assert.throws(()=>replay(route,[...route.actions,oldControls]));
 }
});

test('the entire published r62 invitation, three scenes, every choice and strong/weak minigame result retain the exact pre-v63 hash',()=>{
 const state=stage=>({seed:'e39-r62-n-'+'a'.repeat(22),eventId:`activity44-roadshow-${stage}`,turn:8,pending:false,completed:false,roleId:'sales',actualRoleId:'sales',stats:{cash:70,mood:65,energy:70,boss:45,skill:60,slack:40,lick:50,trust:55},flags:{},activityContext:{version:1,id:'roadshow',stage,score:4,pressure:1,plan:'demo',returnEventId:'job-sales-pipeline'}});
 const value={invitation:getActivityInvitationEventV46({...state(0),activityInvitationContext:{version:1,id:'roadshow',returnEventId:'work'}}),stages:[0,1,2].map(stage=>{const run=state(stage);return{event:withActivityPlayEventV55(run,getActivityEventV44(run)),choices:[.1,.9].flatMap(ticket=>[0,1,2].map(index=>resolveActivityChoiceV44(run,index,ticket))),play:getActivityPlayV55(run),...(stage===1?{plays:[.1,.9].flatMap(ticket=>[[0,1,2,1,0,2],[2,2,0,0,1,1]].map(matches=>resolveActivityPlayV55(run,{kind:'roadshow',matches},ticket)))}:{})};})};
 assert.equal(createHash('sha256').update(JSON.stringify(value)).digest('hex'),'0dc5025f7e5db90d93764b294602613745b096de2f92967612c140586716440f');
});
