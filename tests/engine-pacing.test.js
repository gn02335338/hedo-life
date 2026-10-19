import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CAREER_LEVELS,careerReadiness,careerReviewWait,careerInvitationEligible,getCareerReview} from '../dist/career.js';
import {EVENTS,FANTASY_EVENTS} from '../dist/events.js';
import {createRun,getEvent,applyChoice,advance,requestExit,requestBreak,canRequestCareer,requestCareer,replayRun,validRun} from '../dist/engine.js';
import {replayRoute} from './find-routes-v3.mjs';

const copy=value=>JSON.parse(JSON.stringify(value));
const choose=(run,index)=>advance(applyChoice(run,index));
function boundary(extra={}){
 const initial=createRun('system','e10-pacing-boundary');
 return {...initial,eventId:EVENTS[0].id,assignment:'honest',turn:8,educationReviewed:true,salaryCutOffered:true,...extra,
  stats:{...initial.stats,energy:90,mood:90,cash:90,boss:80,skill:90,lick:90,trust:90,...extra.stats},
  flags:{...initial.flags,career_service:10,...extra.flags}};
}
// Isolate the crisis trigger from fatigue and random future event selection.
const nextLowWork=run=>choose({...run,eventId:EVENTS[0].id,resumeEventId:null,exitReturnEventId:null,breakReturnEventId:null,stats:{...run.stats,energy:100,mood:100,cash:100,boss:0}},1);

test('e10 handles a prolonged low boss mood as one dispute until actual work establishes recovery',()=>{
 const initial=boundary({flags:{boss_crisis_armed:1},stats:{boss:0}}),crisis=nextLowWork(initial);
 assert.equal(crisis.eventId,'crisis-boss');assert.equal(crisis.flags.boss_crisis_armed,0);
 const pip=choose(crisis,2);assert.equal(pip.pipCount,1);assert.equal(pip.pip.remaining,3);assert.equal(pip.flags.boss_crisis_armed,0);
 const passed=boundary({eventId:'pip-passed',pip:{active:false,remaining:0},pipCount:1,flags:{boss_crisis_armed:0},stats:{boss:4}});
 let run=choose(passed,1);assert.equal(run.crisisCooldown,6);assert.equal(run.stats.boss,4);
 for(let day=0;day<8;day++){run=nextLowWork(run);assert.notEqual(run.eventId,'crisis-boss');assert.equal(run.flags.boss_crisis_armed,0);assert.equal(run.pipCount,1);}
 assert.equal(run.crisisCooldown,0);
 const recovered=choose({...run,eventId:EVENTS[0].id,resumeEventId:null,stats:{...run.stats,energy:100,mood:100,boss:80}},0);
 assert.ok(recovered.stats.boss>=35);assert.equal(recovered.flags.boss_crisis_armed,1);
 const freshDispute=nextLowWork(recovered);assert.equal(freshDispute.eventId,'crisis-boss');assert.equal(freshDispute.flags.boss_crisis_armed,0);
 assert.equal(choose(freshDispute,2).pipCount,2);
});

test('e10 only rearms boss disputes after non-PIP work, never from a menu or active-PIP recovery',()=>{
 const unarmed=boundary({eventId:'career-review',resumeEventId:EVENTS[0].id,flags:{boss_crisis_armed:0}});
 assert.equal(choose(unarmed,2).flags.boss_crisis_armed,0);
 const active=boundary({pip:{active:true,remaining:3},pipCount:1,flags:{boss_crisis_armed:0}}),pending=applyChoice(active,0);
 assert.ok(pending.stats.boss>=35);assert.equal(pending.flags.boss_crisis_armed,0);assert.equal(pending.pip.remaining,2);
 const low=applyChoice(boundary({stats:{boss:0},flags:{boss_crisis_armed:0}}),1);
 assert.ok(low.stats.boss<35);assert.equal(low.flags.boss_crisis_armed,0);
 const modern=createRun('system','e10-new-dispute'),old=createRun('system','e9-old-dispute');
 assert.equal(modern.flags.boss_crisis_armed,1);assert.equal(old.flags.boss_crisis_armed,undefined);
 assert.equal(validRun({...modern,flags:{...modern.flags,boss_crisis_armed:2}}),false);
});

test('e10 stops offering PIP after the last three-workday window and rejects forged late choices',()=>{
 for(const eventId of ['crisis-boss','paperwork']){
  const last=boundary({eventId,turn:20,resumeEventId:FANTASY_EVENTS[0].id});
  assert.equal(getEvent(last).choices[2].available,true);assert.equal(choose(last,2).pip.remaining,3);
  for(const turn of [21,22,23,24]){
   const late={...last,turn};assert.equal(getEvent(late).choices[2].available,false);assert.throws(()=>applyChoice(late,2),/Unavailable choice/);
  }
  const old={...last,seed:'e9-published-late-pip',turn:23};assert.notEqual(getEvent(old).choices[2].available,false);
 }
 let run=choose(boundary({eventId:'crisis-boss',turn:20,resumeEventId:FANTASY_EVENTS[0].id,flags:{boss_crisis_armed:0}}),2);
 for(let day=0;day<3;day++){
  // These are actual fantasy work events, rather than menu decisions.
  assert.equal(getEvent(run).kind,'fantasy');run=choose(run,0);
 }
 assert.equal(run.turn,23);assert.equal(run.pip.remaining,0);assert.equal(run.eventId,'pip-review');
});

test('e10 resolves expired PIP before the final career list or unmet fantasy goal',()=>{
 for(const mode of ['career','shortfall']){
  const run=boundary({eventId:FANTASY_EVENTS[3].id,turn:23,pip:{active:true,remaining:1},pipCount:1,flags:{boss_crisis_armed:0},stats:{skill:66,dream:0,trust:60}});
  const index=mode==='career'?getEvent(run).choices.findIndex(c=>c.effect==='careerExit'):0;
  const pending=applyChoice(run,index),review=advance(pending);
  assert.equal(pending.pip.remaining,0);assert.equal(review.eventId,'pip-review');assert.equal(review.completed,false);
  assert.equal(review.resumeEventId,mode==='career'?'rank-exit':'final-shortfall');
  // Keep this boundary deterministic while exercising the complete assessment.
  const proof={...review,stats:{...review.stats,skill:90},flags:{...review.flags,evidence:3}};
  const passed=choose(proof,0);assert.equal(passed.eventId,'pip-passed');
  const resumed=choose(passed,1);assert.equal(resumed.pip,null);assert.equal(resumed.eventId,mode==='career'?'rank-exit':'final-shortfall');
  const finished=mode==='career'?choose(resumed,0):choose(resumed,1);assert.equal(finished.completed,true);assert.equal(validRun(copy(finished)),true);
 }
});

test('e10 automatic reviews require both earned tenure and an available application',()=>{
 const earned=boundary({turn:8,stats:{skill:20,lick:20,boss:80,trust:20}});
 assert.equal(careerReadiness(earned).ready,true);assert.equal(careerInvitationEligible(earned),false);
 assert.equal(getCareerReview(earned).choices.slice(0,2).some(c=>c.available),false);
 assert.notEqual(choose(earned,0).eventId,'career-review');
 const old={...earned,seed:'e9-still-invites-training'};assert.equal(choose(old,0).eventId,'career-review');
 assert.equal(careerInvitationEligible(boundary()),true);
 for(const changes of [{turn:2},{turn:20},{rank:4,flags:{career_peak_rank:4}},{pip:{active:true,remaining:2}},{lastPromotion:7},{flags:{career_service:0}},{flags:{career_defer_until:9}}]){
  assert.equal(careerInvitationEligible(boundary(changes)),false,JSON.stringify(changes));
 }
});

test('e10 voluntary deferral gives six workdays and cannot be reopened early through manual review',()=>{
 const start=boundary({eventId:'career-review',turn:8,resumeEventId:EVENTS[0].id});
 const deferred=choose(start,3);assert.equal(deferred.turn,8);assert.equal(deferred.flags.career_defer_until,14);
 assert.equal(deferred.flags.career_reviews,1);assert.equal(deferred.flags.career_last_review_result,2);assert.equal(deferred.flags.career_last_review_target,2);
 for(let turn=9;turn<14;turn++){
  const waiting={...deferred,eventId:EVENTS[0].id,resumeEventId:null,turn};assert.equal(careerReviewWait(waiting),false);assert.equal(canRequestCareer(waiting),false);assert.equal(requestCareer(waiting),waiting);
 }
 const ready={...deferred,eventId:EVENTS[0].id,resumeEventId:null,turn:14};assert.equal(careerReviewWait(ready),true);assert.equal(canRequestCareer(ready),true);
 let working=deferred;
 for(let day=1;day<=6;day++){
  working=choose({...working,eventId:EVENTS[0].id,resumeEventId:null,breakReturnEventId:null},0);
  assert.equal(working.turn,8+day);assert.equal(working.eventId==='career-review',day===6,`deferred workday ${day}`);
 }
 const training=choose(requestCareer(ready),2);assert.equal(training.flags.career_reviews,2);assert.equal(training.flags.career_last_review_result,1);assert.equal(training.lastPromotion,14);assert.equal(training.turn,14);
 assert.equal(canRequestCareer({...training,turn:16}),false);assert.equal(canRequestCareer({...training,turn:17}),true);
});

test('e10 manual career review is an explicit zero-time zero-RNG action with all modal guards',()=>{
 const work=boundary({turn:3,stats:{skill:20,lick:20,boss:20,trust:20},flags:{career_service:0}}),snapshot=copy(work);
 assert.equal(canRequestCareer(work),true);const menu=requestCareer(work);
 assert.deepEqual(work,snapshot);assert.equal(menu.eventId,'career-review');assert.equal(menu.resumeEventId,work.eventId);
 assert.deepEqual(menu.actions.at(-1),{type:'career'});assert.equal(menu.turn,work.turn);assert.equal(menu.rng,work.rng);assert.deepEqual(menu.stats,work.stats);assert.equal(validRun(copy(menu)),true);
 assert.equal(getEvent(menu).choices[0].available,false);assert.equal(getEvent(menu).choices[1].available,false);assert.throws(()=>applyChoice(menu,0),/Unavailable choice/);
 for(const state of [null,{...work,seed:'e9-no-manual-review'},{...work,pending:true},{...work,completed:true},{...work,pip:{active:true,remaining:3}},{...work,rank:4},{...work,turn:2},{...work,lastPromotion:2},{...work,flags:{...work.flags,career_defer_until:4}},{...work,resumeEventId:EVENTS[1].id},{...work,exitReturnEventId:EVENTS[1].id},{...work,breakReturnEventId:EVENTS[1].id},{...work,eventId:'crisis-boss'}]){
  assert.equal(canRequestCareer(state),false);assert.equal(requestCareer(state),state);
 }
 assert.equal(canRequestCareer({...work,eventId:FANTASY_EVENTS[0].id,turn:20}),false,'the fantasy finale cannot extend the original review window');
 assert.equal(requestCareer(menu),menu);assert.equal(requestBreak(menu),menu);
});

test('e10 review difficulty and tenure remain equal to e9 instead of undoing the hard promotion balance',()=>{
 for(let rank=0;rank<4;rank++){
  const modern=boundary({eventId:'career-review',rank,turn:18,flags:{career_peak_rank:rank}}),old={...modern,seed:'e9-same-career-balance'};
  assert.deepEqual(careerReadiness(modern),careerReadiness(old));
  for(let i=0;i<2;i++){assert.equal(getCareerReview(modern).choices[i].check.chance,getCareerReview(old).choices[i].check.chance);assert.equal(getCareerReview(modern).choices[i].available,getCareerReview(old).choices[i].available);}
  assert.deepEqual(getCareerReview(modern).choices[2].delta,getCareerReview(old).choices[2].delta);
 }
 assert.deepEqual(CAREER_LEVELS.map(stage=>stage.payMultiplier),[1,1.25,1.6,2.1,2.7]);
});

test('natural e10 witnesses validate manual career actions and every saved checkpoint without injection',()=>{
 const routes=JSON.parse(readFileSync(new URL('../research/reachability-v3.json',import.meta.url),'utf8')).routes;
 const route=routes.find(r=>r.actions.some(a=>a.type==='career'));assert.ok(route,'expected a natural manual-review witness');
 const finished=replayRoute(route,state=>assert.equal(validRun(copy(state)),true));assert.deepEqual(finished,replayRun(route.roleId,route.seed,route.actions));
 assert.equal(finished.endingId,route.ending);
 const injected=[{type:'career'},...route.actions];assert.throws(()=>replayRun(route.roleId,route.seed,injected),/Unavailable career/);
 const duplicate=copy(route.actions),at=duplicate.findIndex(a=>a.type==='career');duplicate.splice(at,0,{type:'career'});assert.throws(()=>replayRun(route.roleId,route.seed,duplicate),/Unavailable career/);
});

test('a natural e10 last-window PIP completes all three fantasy workdays and assessment before ending',()=>{
 const route=JSON.parse(readFileSync(new URL('./fixtures/pacing-e10-routes.json',import.meta.url),'utf8'))[0],states=[];
 const finished=replayRoute(route,state=>{assert.equal(validRun(copy(state)),true);states.push(copy(state));});
 const entry=states.find(state=>state.eventId==='crisis-boss');assert.equal(entry.turn,20);
 const pipWork=finished.history.filter(history=>history.kind==='fantasy');assert.deepEqual(pipWork.map(history=>history.turn),[20,21,22,23]);
 const review=states.find(state=>state.eventId==='pip-review');assert.equal(review.turn,23);assert.equal(review.pip.remaining,0);
 assert.ok(finished.history.some(history=>history.eventId==='pip-passed'));assert.ok(states.some(state=>state.eventId===FANTASY_EVENTS[3].id&&state.pip===null));assert.equal(finished.pipCount,1);assert.equal(finished.endingId,route.ending);
 assert.deepEqual(finished,replayRun(route.roleId,route.seed,route.actions));
});
