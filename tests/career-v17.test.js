import test from 'node:test';
import assert from 'node:assert/strict';
import {ROLE_MAP} from '../dist/roles.js';
import {
 CAREER_FAMILIES_V17,CAREER_LEVELS_V17,CAREER_LADDERS_V17,
 careerTitleV17,careerInfoV17,careerSalaryV17,careerEndingAvailableV17,
 careerReadinessV17,careerReviewWaitV17,careerInvitationEligibleV17,
 getCareerReviewV17,getCareerDutyV17,getRankExitV17,getCareerStepDownV17,
 legacyCareerRankV17
} from '../dist/career-v17.js';

const run=(rank=1,extras={})=>({seed:'e17-career-module',actualRoleId:'system',roleId:'system',assignment:rank===0?'assistant':'honest',rank,basePay:60,pay:60,turn:22,lastPromotion:0,eventId:'career-review',resumeEventId:null,pip:null,...extras,flags:{career_service:4,...extras.flags},stats:{skill:100,lick:100,boss:100,trust:100,mood:90,energy:90,...extras.stats}});

test('current careers have eight real ranks in every role, with a professional track before management',()=>{
 assert.deepEqual(CAREER_LEVELS_V17.map(level=>level.rank),[0,1,2,3,4,5,6,7]);
 assert.deepEqual(CAREER_FAMILIES_V17,['career_assistant','career_staff','career_senior','career_principal','career_deputy','career_manager','career_director','career_chief']);
 assert.deepEqual(CAREER_LADDERS_V17.system,['助理工程師','工程師','資深工程師','主任工程師','工程副理','工程經理','工程總監','技術長 CTO']);
 assert.equal(Object.keys(CAREER_LADDERS_V17).length,13);
 for(const [roleId,ladder] of Object.entries(CAREER_LADDERS_V17)){
  assert.equal(ladder.length,8);assert.equal(new Set(ladder).size,8);
  for(let rank=0;rank<8;rank++){
   const current=run(rank,{actualRoleId:roleId,roleId,seed:ROLE_MAP[roleId].minRules===28?'e28-career-module':'e17-career-module'});
   assert.equal(careerTitleV17(current),ladder[rank]);
   assert.equal(careerInfoV17(current).nextTitle,ladder[rank+1]||null);
   assert.equal(careerSalaryV17(current),Math.round(60*CAREER_LEVELS_V17[rank].payMultiplier));
  }
 }
 assert.deepEqual(CAREER_LEVELS_V17.map(level=>legacyCareerRankV17(level.rank)),[0,0,0,0,1,2,3,4]);
 assert.equal(careerInfoV17(run(1,{actualRoleId:'project'})).label,'專業員工');
 assert.equal(careerTitleV17(run(1,{actualRoleId:'project'})),'專案經理');
 assert.equal(careerSalaryV17(run(7,{basePay:300})),500);
});

test('e17 reviews require work in each rank and leave time for an ideal eight-stage career',()=>{
 let day=1;
 for(let rank=0;rank<7;rank++){
  const readiness=careerReadinessV17(run(rank));
  day=Math.max(day+readiness.minService,readiness.minTurn);
  const ready=run(rank,{turn:day,flags:{career_service:readiness.minService}});
  assert.equal(careerReadinessV17(ready).ready,true);
  assert.equal(careerReadinessV17({...ready,flags:{...ready.flags,career_service:readiness.minService-1}}).ready,false);
  assert.equal(careerReadinessV17({...ready,turn:readiness.minTurn-1}).ready,false);
  assert.equal(careerInvitationEligibleV17(ready),true);
 }
 assert.ok(day<=24,`chief earliest day ${day}`);
 assert.equal(careerReadinessV17(run(7)).ready,false);
 for(const rank of [0,1,2,3,4,5,6]){
  const waiting=rank<=3?2:3,current=run(rank,{lastPromotion:22-waiting});
  assert.equal(careerReviewWaitV17(current),true);
  assert.equal(careerReviewWaitV17({...current,lastPromotion:current.lastPromotion+1}),false);
  assert.equal(careerReviewWaitV17({...current,flags:{...current.flags,career_defer_until:23}}),false);
 }
 assert.equal(careerInvitationEligibleV17(run(6,{turn:24})),false);
 assert.equal(careerInvitationEligibleV17(run(6,{pip:{active:true}})),false);
});

test('e17 high-level promotions need ability, trust and boss support while keeping the RNG in the engine',()=>{
 const source=run(6),before=JSON.stringify(source),event=getCareerReviewV17(source);
 assert.equal(JSON.stringify(source),before);
 assert.deepEqual(getCareerReviewV17(source),event);
 assert.equal(event.choices[0].available,true);assert.equal(event.choices[1].available,true);
 assert.ok(event.choices[0].check.chance<=.44);assert.ok(event.choices[1].check.chance<=.38);
 assert.equal(getCareerReviewV17(run(6,{stats:{skill:79}})).choices[1].available,false,'licking alone cannot obtain the chief title');
 assert.equal(getCareerReviewV17(run(6,{stats:{trust:54}})).choices[1].available,false);
 assert.equal(getCareerReviewV17(run(6,{stats:{boss:71}})).choices[0].available,false);
 assert.equal(getCareerReviewV17(run(6,{flags:{career_service:3}})).choices[0].available,false);
 assert.equal(getCareerReviewV17(run(0)).choices[0].check.success.effect,'careerRegularize');
 assert.equal(getCareerReviewV17(run(1)).choices[0].check.success.effect,'careerPromote');
 assert.equal(getCareerReviewV17(run(1,{pip:{active:true}})).choices[0].available,false);
 for(let rank=0;rank<8;rank++){
  const review=getCareerReviewV17(run(rank));
  assert.equal(review.choices[2].available,undefined);assert.equal(review.choices[2].effect,'careerTrain');
  for(const choice of review.choices)assert.doesNotMatch(choice.text,/\d+%|機率|成功率/);
 }
});

test('e17 professional duties do not turn senior staff into managers and every rank keeps its own duty flag',()=>{
 for(const roleId of Object.keys(CAREER_LADDERS_V17))for(let rank=1;rank<8;rank++){
  const source=run(rank,{actualRoleId:roleId,eventId:`career-duty-${rank}`}),before=JSON.stringify(source),event=getCareerDutyV17(source);
  assert.equal(JSON.stringify(source),before);assert.equal(event.id,source.eventId);
  assert.ok(event.body.startsWith(`你目前是${careerTitleV17(source)}。`));
  assert.equal(event.speaker,rank===5?'hope':'wing');
  for(const choice of event.choices){
   assert.equal(choice.effect,'careerResume');assert.ok(choice.flags.includes(`career_duty_${rank}`));
  }
  assert.doesNotMatch(JSON.stringify(event),/Wing|Hope|空降/);
  if(rank===2)assert.match(event.body,/有經驗，並沒有因此多出第二雙手/);
  if(rank===3)assert.match(event.body,/沒有給你改期限或調人力的權限/);
 }
 assert.throws(()=>getCareerDutyV17(run(2,{eventId:'career-duty-3'})),/Invalid career duty/);
});

test('e17 assistant exits need actual work and voluntary step-down uses staff/deputy destinations',()=>{
 assert.equal(careerEndingAvailableV17(run(0,{turn:99,flags:{career_service:0}})),false);
 assert.equal(careerEndingAvailableV17(run(0,{flags:{career_service:3}})),true);
 assert.equal(careerEndingAvailableV17(run(0,{flags:{career_service:0,career_work_0:3}})),true);
 assert.equal(getRankExitV17(run(0)).choices[0].effect,'career_assistant');
 assert.equal(getRankExitV17(run(2)).choices.find(choice=>choice.effect==='careerStepDown').available,false);
 for(let rank=4;rank<8;rank++){
  const current=run(rank),menu=getCareerStepDownV17(current);
  assert.equal(menu.choices[0].effect,'careerDemoteStaff');assert.equal(menu.choices[0].available,true);
  assert.equal(menu.choices[1].effect,'careerDemoteDeputy');assert.equal(menu.choices[1].available,rank>4);
  assert.equal(menu.choices[2].effect,'rankHub');assert.equal(menu.choices[2].available,undefined);
 }
 assert.equal(getCareerStepDownV17(run(5,{resumeEventId:'career-duty-5'})).choices[0].available,false);
});
