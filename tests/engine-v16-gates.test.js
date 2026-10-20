import test from 'node:test';
import assert from 'node:assert/strict';
import {ROLES} from '../dist/roles.js';
import {createRun,getEvent,canRequestCareer,requestCareer} from '../dist/engine.js';
import {getCareerReview,careerInvitationEligible} from '../dist/career.js';

function candidate(roleId='system',rank=2){
 const run=createRun(roleId,'e16-balanced-career');
 return {...run,actualRoleId:roleId,assignment:'honest',rank,turn:19,lastPromotion:10,
  eventId:'meeting-ten-minutes',educationReviewed:true,salaryCutOffered:true,
  stats:{...run.stats,skill:95,lick:95,trust:90,boss:90,energy:90,mood:90,cash:90},
  flags:{...run.flags,career_service:10,career_peak_rank:rank,education_risk_checked:1}};
}
const cohort=(run,prefix)=>({...run,seed:`${prefix}-balanced-career`});

test('e16 high-rank checks restore the e12 caps for all roles without rewriting e15 balance',()=>{
 for(const role of ROLES)for(const rank of [2,3]){
  const run=candidate(role.id,rank),modern=getCareerReview(run),balanced=getCareerReview(cohort(run,'e12')),published=getCareerReview(cohort(run,'e15'));
  for(const index of [0,1]){
   assert.equal(modern.choices[index].available,true,`${role.id}/${rank}/${index}`);
   assert.equal(modern.choices[index].check.chance,balanced.choices[index].check.chance);
   assert.ok(modern.choices[index].check.chance<published.choices[index].check.chance);
   assert.ok(modern.choices[index].check.chance<=(rank===2?(index===0?.70:.68):(index===0?.55:.50)));
  }
  assert.deepEqual(modern.choices[2].delta,balanced.choices[2].delta);
  assert.equal(modern.choices[2].delta.skill,5);assert.equal(published.choices[2].delta.skill,8);
  const visible=getEvent({...run,eventId:'career-review'});
  assert.deepEqual(visible.choices.slice(0,2).map(choice=>choice.check.chance),balanced.choices.slice(0,2).map(choice=>choice.check.chance));
 }
});

test('e16 automatic invitations respect service, earliest turn, review cooldown, deferral, abilities and active PIP',()=>{
 const base=candidate();base.turn=13;base.lastPromotion=8;base.flags.career_service=4;
 assert.equal(careerInvitationEligible(base),true);
 assert.equal(careerInvitationEligible(cohort(base,'e12')),true);
 assert.equal(careerInvitationEligible(cohort(base,'e15')),false,'published e15 invitation behavior stays unchanged');
 const cases=[
  {...base,flags:{...base.flags,career_service:3}},
  {...base,turn:12},
  {...base,lastPromotion:11},
  {...base,flags:{...base.flags,career_defer_until:14}},
  {...base,pip:{active:true,remaining:2}},
  {...base,stats:{...base.stats,skill:20,lick:20}},
 ];
 for(const run of cases)assert.equal(careerInvitationEligible(run),false);
 const unready=cases[0];assert.equal(canRequestCareer(unready),true,'manual preparation remains available before promotion readiness');
 const preparation=requestCareer(unready),event=getEvent(preparation);
 assert.equal(preparation.turn,unready.turn);assert.equal(preparation.rng,unready.rng);
 assert.match(event.title,/先整理籌碼/);assert.ok(event.choices.slice(0,2).every(choice=>choice.available===false));
 assert.equal(event.choices[2].effect,'careerTrain');assert.equal(event.choices[3].effect,'careerDefer');
 const deferred={...base,flags:{...base.flags,career_last_review_target:4,career_last_review_result:2}};
 assert.match(getCareerReview(deferred).title,/上次說先不要/);
});

test('e16 early education salary and dismissal scenes keep their cause and do not claim probation has passed',()=>{
 const run=candidate('mis',0);run.turn=2;run.flags.education_case_active=1;run.flags.education_dispute=6;
 run.education={...run.education,department:'外國語文',field:'humanities'};
 run.salaryCut={from:60,to:42,percent:30,status:'pending',reason:'education'};
 const proposal=getEvent({...run,eventId:'salary-cut'});
 assert.match(proposal.title,/還沒過試用期/);assert.match(proposal.body,/外國語文也來做工程/);
 assert.match(proposal.body,/60K/);assert.match(proposal.body,/42K/);
 assert.doesNotMatch(proposal.body,/通過了試用期|Wing|Hope/);assert.match(proposal.body,/翅膀沒有出現/);
 const final=getEvent({...run,eventId:'salary-final'});
 assert.match(final.body,/學歷與身價/);assert.match(final.body,/60K/);assert.match(final.body,/42K/);
 const dismissal=getEvent({...run,eventId:'crisis-boss'});
 assert.equal(dismissal.title,'學歷問完，人事就到了。');
 for(const alias of ['法師','Moon Dog','阿福'])assert.ok(dismissal.body.includes(alias));
 assert.match(dismissal.body,/背景不適合/);assert.match(dismissal.body,/自願離職書/);
 const published=getEvent({...cohort(run,'e15'),eventId:'salary-cut'});
 assert.match(published.body,/通過了試用期/,'published wording is retained for replay compatibility');
 const normal=getEvent({...run,eventId:'salary-cut',salaryCut:{...run.salaryCut,reason:undefined}});
 assert.match(normal.body,/通過了試用期/,'ordinary later salary reviews keep their existing context');
});
