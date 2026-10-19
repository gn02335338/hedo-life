import test from 'node:test';
import assert from 'node:assert/strict';
import {CAREER_LEVELS,careerReadiness,getCareerReview} from '../dist/career.js';
import {EVENTS,FANTASY_EVENTS} from '../dist/events.js';
import {createRun,getEvent,applyChoice,advance,validRun} from '../dist/engine.js';
const copy=value=>JSON.parse(JSON.stringify(value));
const choose=(run,index)=>advance(applyChoice(run,index));
function boundary(rank=0,extra={}){
 const run=createRun('system','e9-balance-boundary');
 return {...run,eventId:'career-review',assignment:'honest',rank,turn:18,educationReviewed:true,salaryCutOffered:true,resumeEventId:EVENTS[0].id,...extra,stats:{...run.stats,energy:90,cash:90,mood:90,skill:90,lick:90,trust:90,boss:90,...extra.stats},flags:{...run.flags,career_peak_rank:rank,career_service:10,...extra.flags}};
}
function outcome(rank,index,effect,extra={}){
 for(let i=0;i<500;i++){
  const run=boundary(rank,{...extra,seed:`e9-balance-outcome-${i}`,rng:createRun('system',`e9-balance-outcome-${i}`).rng});
  if(getEvent(run).choices[index].available===false)continue;
  const pending=applyChoice(run,index);if(pending.pendingEffect===effect)return{run,pending,next:advance(pending)};
 }
 throw new Error(`Missing seeded outcome ${rank}/${index}/${effect}`);
}

test('e9 tenure gates each next rank and assistant regularization without changing e8 reviews',()=>{
 const service=[2,3,4,5],turns=[4,8,13,18];
 assert.equal(createRun('system','e9-new-career').flags.career_service,0);
 assert.equal(createRun('system','e8-published-career').flags.career_service,undefined);
 for(let rank=0;rank<4;rank++){
  const earned=boundary(rank,{turn:turns[rank],flags:{career_service:service[rank]}}),readiness=careerReadiness(earned);
  assert.equal(readiness.target,rank+1);assert.equal(readiness.service,service[rank]);assert.equal(readiness.minService,service[rank]);assert.equal(readiness.minTurn,turns[rank]);assert.equal(readiness.ready,true);
  for(const short of [{...earned,turn:turns[rank]-1},{...earned,flags:{...earned.flags,career_service:service[rank]-1}}]){
   assert.equal(careerReadiness(short).ready,false);
   for(const index of [0,1]){assert.equal(getCareerReview(short).choices[index].available,false);assert.throws(()=>applyChoice(short,index),/Unavailable choice/);}
  }
  assert.equal(getCareerReview(earned).choices[0].available,true);assert.equal(getCareerReview(earned).choices[1].available,true);
  const old={...earned,seed:'e8-unchanged-review',turn:3,flags:{career_peak_rank:rank}};
  assert.equal(getCareerReview(old).choices[0].available,true);assert.equal(getCareerReview(old).choices[1].available,true);
 }
 const assistant=boundary(0,{assignment:'assistant',turn:3,flags:{career_service:2}}),readiness=careerReadiness(assistant);
 assert.equal(readiness.target,0);assert.equal(readiness.minTurn,3);assert.equal(readiness.minService,2);assert.equal(readiness.ready,true);
 for(const short of [{...assistant,turn:2},{...assistant,flags:{...assistant.flags,career_service:1}}])assert.equal(getCareerReview(short).choices[0].available,false);
});

test('e9 reviews wait for tenure as well as cooldown, workday and non-PIP eligibility',()=>{
 for(const [rank,minService,minTurn]of [[0,2,4],[1,3,8],[2,4,13],[3,5,18]]){
  const work=(turn,service,extra={})=>boundary(rank,{eventId:EVENTS[0].id,resumeEventId:null,turn,lastPromotion:-5,flags:{career_service:service},...extra});
  const tooEarly=choose(work(minTurn-2,minService),0);assert.notEqual(tooEarly.eventId,'career-review');
  const earned=choose(work(minTurn-1,minService-1),0);assert.equal(earned.eventId,'career-review');
  const cooldown=choose(work(minTurn-1,minService,{lastPromotion:minTurn-2}),0);assert.notEqual(cooldown.eventId,'career-review');
  const pip=choose(work(minTurn-1,minService,{pip:{active:true,remaining:3},pipCount:1}),0);assert.notEqual(pip.eventId,'career-review');
  const finale=choose(work(19,minService),0);assert.notEqual(finale.eventId,'career-review');
 }
});

test('e9 service counts work decisions once, including assistants, while menus and onboarding add none',()=>{
 const entered=choose(createRun('system','e9-service-onboarding'),0);assert.equal(entered.flags.career_service,0);
 for(const assignment of ['honest','assistant'])for(const eventId of [EVENTS[0].id,FANTASY_EVENTS[0].id]){
  const run=boundary(assignment==='assistant'?0:4,{eventId,resumeEventId:null,turn:2,assignment,flags:{career_service:0}}),pending=applyChoice(run,0),next=advance(pending);
  assert.equal(next.flags.career_service,1);assert.equal(next.turn,run.turn+1);assert.equal(validRun(copy(next)),true);
  assert.equal(advance(next),next,'advancing an already-resolved workday cannot add service');
 }
 for(const index of [2,3]){
  const run=boundary(1,{flags:{career_service:3}}),next=choose(run,index);
  assert.equal(next.flags.career_service,3);assert.equal(next.turn,run.turn);assert.equal(next.lastPromotion,run.turn);
 }
 const duty=boundary(2,{eventId:'career-duty-2',flags:{career_service:0}});assert.equal(choose(duty,1).flags.career_service,0);
});

test('e9 success and voluntary step-down reset tenure but failure or training preserve it',()=>{
 for(const effect of ['careerPromote','careerRegularize']){
  const extra=effect==='careerRegularize'?{assignment:'assistant'}:{};
  const result=outcome(0,0,effect,extra);assert.equal(result.pending.flags.career_service,0);assert.equal(result.next.flags.career_service,0);
  assert.equal(result.next.rank,effect==='careerPromote'?1:0);
 }
 const failure=outcome(2,0,null,{flags:{career_service:7}});assert.equal(failure.pending.flags.career_service,7);assert.equal(failure.next.flags.career_service,7);
 for(const [effect,rank]of [['careerDemoteStaff',0],['careerDemoteDeputy',1]]){
  const run=boundary(3,{eventId:'career-step-down',resumeEventId:null,exitReturnEventId:EVENTS[0].id}),index=getEvent(run).choices.findIndex(c=>c.effect===effect),next=choose(run,index);
  assert.equal(next.rank,rank);assert.equal(next.flags.career_service,0);assert.equal(next.turn,run.turn);
 }
 const train=applyChoice(boundary(1,{stats:{skill:70,lick:70,trust:70,energy:70,mood:70}}),2),delta=train.history.at(-1).delta;
 assert.equal(delta.skill,5);assert.equal(delta.lick,2);assert.equal(delta.trust,3);assert.equal(delta.energy,-4);assert.equal(delta.mood,-3);
});

test('e9 upper-rank checks stay seeded and materially harder than the published e8 checks',()=>{
 for(let rank=0;rank<4;rank++)for(const index of [0,1]){
  const run=boundary(rank,{stats:{skill:80,lick:80,trust:80,boss:80}}),old=getCareerReview({...run,seed:'e8-chance-control'}).choices[index].check.chance,modern=getCareerReview(run).choices[index].check.chance;
  const reduction=rank===2?(index===0?.10:.15):rank===3?(index===0?.22:.30):0;
  assert.ok(Math.abs(modern-(old-reduction))<1e-10,`${rank}/${index} reduction`);
 }
 for(const [rank,meritCap,politicsCap]of [[2,.70,.68],[3,.55,.50]]){
  const run=boundary(rank,{stats:{skill:100,lick:100,trust:100,boss:100}}),choices=getCareerReview(run).choices;
  assert.equal(choices[0].check.chance,meritCap);assert.equal(choices[1].check.chance,politicsCap);
  for(const index of [0,1]){
   const win=outcome(rank,index,'careerPromote'),loss=outcome(rank,index,null);
   assert.deepEqual(applyChoice(win.run,index),win.pending);assert.notEqual(win.run.rng,win.pending.rng);assert.equal(win.pending.rank,rank+1);assert.equal(loss.pending.rank,rank);
  }
 }
});

test('e9 PIP pass protects six real workdays without raising boss mood or counting menus',()=>{
 for(const index of [1,2]){
  const passed=boundary(4,{eventId:'pip-passed',turn:8,pip:{active:false,remaining:0},pipCount:1,stats:{energy:100,mood:100,boss:4},flags:{career_service:5}}),pending=applyChoice(passed,index),resumed=advance(pending);
  assert.equal(pending.stats.boss,4);assert.equal(pending.history.at(-1).delta.boss,0);assert.equal(resumed.crisisCooldown,6);assert.equal(resumed.pip,null);assert.equal(resumed.flags.career_service,5);
  assert.equal(choose({...resumed,eventId:'career-review'},3).crisisCooldown,6,'a career menu does not spend protected workdays');
  let run=resumed;
  for(let day=1;day<=6;day++){
   run=choose({...run,eventId:EVENTS[0].id,resumeEventId:null},1);assert.equal(run.crisisCooldown,6-day);
   assert.ok(run.stats.boss<=12);assert.equal(run.eventId==='crisis-boss',day===6,`protection day ${day}`);
  }
  const old=choose({...passed,seed:'e8-pip-protection'},index);assert.equal(old.crisisCooldown,3);
 }
});
