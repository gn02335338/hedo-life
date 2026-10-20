import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {educationRisk} from '../dist/education-risk.js';
import {EVENTS} from '../dist/events.js';
import {CAREER_LEVELS,careerReadiness} from '../dist/career.js';
import {createRun,getEvent,applyChoice,advance,requestExit,requestBreak,requestCareer,canRequestCareer,replayRun,validRun,jobTitle} from '../dist/engine.js';
import {replayRoute} from './find-routes-v3.mjs';
const copy=value=>JSON.parse(JSON.stringify(value));
const choose=(run,index)=>advance(applyChoice(run,index));
const arts={id:'fcu-humanities-學士-歷史',school:'逢甲大學',schoolId:'fcu',department:'歷史',degree:'學士',sector:'private',region:'台灣',field:'humanities',wingBias:-22};
const technical={id:'nthu-stem-學士-資訊工程',school:'國立清華大學',schoolId:'nthu',department:'資訊工程',degree:'學士',sector:'public',region:'台灣',field:'stem',wingBias:0};
function boundary(attempt=0,extra={}){
 const initial=createRun('system',`e11-education-boundary-${attempt}`);
 return {...initial,eventId:EVENTS[0].id,actualRoleId:'system',assignment:'honest',education:arts,turn:1,lastPromotion:1,pay:76,offerPay:76,basePay:76,...extra,
  stats:{...initial.stats,energy:100,mood:100,cash:100,boss:90,...extra.stats},
  flags:{...initial.flags,career_service:0,education_risk_due:2,...extra.flags}};
}
function dispute(wanted){
 for(let attempt=0;attempt<200;attempt++){
  const run=choose(boundary(attempt),0);
  if(run.eventId!=='education-scrutiny')continue;
  for(let index=0;index<3;index++){
   const pending=applyChoice(run,index);
   if(pending.pendingEffect===wanted)return {run,index,pending,next:advance(pending)};
  }
 }
 throw Error(`Missing education branch ${wanted}`);
}

test('e11 education prejudice considers actual work, relevant subjects and the fictional boss’s preferences',()=>{
 const STEM=boundary(0,{education:technical});
 assert.equal(educationRisk(STEM).eligible,false,'high salary alone is not an education allegation');
 const privateSTEM=educationRisk({...STEM,education:{...technical,sector:'private',schoolId:'fcu'}});
 assert.equal(privateSTEM.schoolDisliked,true);assert.equal(privateSTEM.mismatch,false);assert.ok(privateSTEM.chance>=.8);
 const publicArts={...STEM,education:{...arts,sector:'public',schoolId:'nthu'}};
 assert.equal(educationRisk(publicArts).mismatch,true);assert.ok(educationRisk(publicArts).chance>=.88);
 const privateArts=educationRisk(boundary());assert.equal(privateArts.reasons,15);assert.ok(privateArts.chance>=.94);
 const information={...STEM,education:{...technical,department:'資訊管理',field:'business'}};
 assert.equal(educationRisk(information).mismatch,false,'information management is relevant to engineering');assert.equal(educationRisk(information).subjectDisliked,true);
 const reassigned={...STEM,roleId:'project',actualRoleId:'system',education:arts};assert.equal(educationRisk(reassigned).mismatch,true);
 assert.equal(educationRisk({...reassigned,actualRoleId:'design',education:{...technical,department:'視覺設計',field:'design'}}).eligible,false);
 const favorite={...publicArts,actualRoleId:'sales',education:{...publicArts.education,schoolId:'ntu'}};
 assert.ok(educationRisk(favorite).chance<educationRisk({...favorite,education:{...favorite.education,schoolId:'nthu'}}).chance);
 assert.equal(educationRisk({...favorite,actualRoleId:'system'}).chance,educationRisk(publicArts).chance,'school preference cannot erase an unrelated engineering degree');
 assert.equal(educationRisk({...STEM,education:{...technical,schoolId:'ntu',department:'高階經營管理',degree:'EMBA',field:'business'}}).favorite,false);
});

test('high-pay risk is proportional to actual role, assistant status and career stage',()=>{
 const staff=boundary(0,{pay:72});assert.equal(educationRisk(staff).highPay,true);
 const low={...staff,pay:48};assert.equal(educationRisk(low).highPay,false);assert.ok(educationRisk(staff).chance>educationRisk(low).chance);
 for(const rank of [1,2,3,4]){
  const promoted={...staff,rank,pay:staff.pay*CAREER_LEVELS[rank].payMultiplier};
  assert.ok(Math.abs(educationRisk(promoted).payPosition-educationRisk(staff).payPosition)<1e-12);
 }
 const assistant={...staff,assignment:'assistant',pay:staff.pay*.78};assert.equal(educationRisk(assistant).highPay,true);
 const executive={...staff,roleId:'executive',actualRoleId:'executive',rank:2,pay:205};assert.equal(educationRisk(executive).highPay,true);
 const director={...executive,rank:3,pay:205*CAREER_LEVELS[3].payMultiplier/CAREER_LEVELS[2].payMultiplier};
 assert.ok(Math.abs(educationRisk(director).payPosition-educationRisk(executive).payPosition)<1e-12);
});

test('e11 schedules one early assessment after actual work, never automatically at reporting',()=>{
 const due=new Set();let saw=0,escaped=0;
 for(let attempt=0;attempt<120;attempt++){
  const initial=createRun('system',`e11-education-due-${attempt}`);due.add(initial.flags.education_risk_due);
  const onboarding=choose(initial,0);assert.notEqual(onboarding.eventId,'education-scrutiny');assert.equal(onboarding.flags.education_risk_checked,0);
  const before=choose(boundary(attempt,{flags:{education_risk_due:4}}),0);assert.notEqual(before.eventId,'education-scrutiny');assert.equal(before.flags.education_risk_checked,0);
  const assessed=choose(boundary(attempt),0);assert.equal(assessed.flags.education_risk_checked,1);
  if(assessed.eventId==='education-scrutiny'){saw++;assert.equal(assessed.turn,2);assert.equal(assessed.educationReviewed,true);assert.equal(assessed.flags.boss_crisis_armed,0);assert.ok(assessed.resumeEventId);}
  else escaped++;
 }
 assert.deepEqual([...due].sort(),[2,3,4]);assert.ok(saw>100);assert.ok(escaped>0,'high risk still leaves a seeded chance of avoiding the incident');
 for(const dueTurn of [2,3,4]){
  const candidate=choose(boundary(0,{turn:dueTurn-1,lastPromotion:dueTurn-1,flags:{education_risk_due:dueTurn}}),0);
  assert.equal(candidate.flags.education_risk_checked,1);assert.ok(candidate.turn<=4);
 }
 const late=choose(boundary(0,{turn:4,lastPromotion:4,flags:{education_risk_due:4}}),0);assert.notEqual(late.eventId,'education-scrutiny');assert.equal(late.flags.education_risk_checked,1);
 const safe=choose(boundary(0,{education:technical}),0);assert.notEqual(safe.eventId,'education-scrutiny');assert.equal(safe.flags.education_risk_checked,1);
});

test('education assessment does not interrupt PIP, mood crises or existing modal return paths',()=>{
 const active=choose(boundary(0,{pip:{active:true,remaining:3},pipCount:1}),0);assert.notEqual(active.eventId,'education-scrutiny');assert.equal(active.pip.remaining,2);
 const moody=choose(boundary(0,{stats:{mood:0}}),0);assert.equal(moody.eventId,'crisis-mood');assert.equal(moody.flags.education_risk_checked,0);
 const offered=choose(boundary(0,{salaryCutOffered:true}),0);assert.notEqual(offered.eventId,'education-scrutiny');
 for(const eventId of ['education-review','career-review']){
  const menu={...boundary(),eventId,resumeEventId:EVENTS[0].id};
  const after=choose(menu,eventId==='career-review'?2:0);assert.notEqual(after.eventId,'education-scrutiny');assert.equal(after.flags.education_risk_checked,0);
 }
 const imminent=choose(boundary(0,{stats:{boss:0},flags:{education_risk_due:4}}),0);
 assert.equal(imminent.flags.education_risk_checked,1,'an imminent ordinary dispute still evaluates its education cause');
});

test('education conversation has hidden seeded consequences and preserves its workday and waiting story',()=>{
 for(const effect of ['educationSalary','educationDismissal']){
  const {run,index,pending,next}=dispute(effect),before=copy(run),event=getEvent(run);
  assert.deepEqual(applyChoice(run,index),pending);assert.deepEqual(run,before);assert.equal(pending.turn,run.turn);assert.equal(pending.resumeEventId,run.resumeEventId);
  assert.equal(event.body.indexOf('哪裡畢業的')<event.body.indexOf(run.education.school),true);assert.ok(event.body.includes(jobTitle(run)));
  assert.ok(event.choices.every(choice=>!choice.check&&!choice.draw&&!choice.detail));
  assert.equal(pending.history.at(-1).eventOutcome.label,'Wing的臨時決定');assert.equal(validRun(copy(pending)),true);assert.equal(validRun(copy(next)),true);
  assert.equal(next.eventId,effect==='educationSalary'?'salary-cut':'crisis-boss');assert.equal(next.turn,run.turn);assert.equal(next.resumeEventId,run.resumeEventId);
  assert.equal(next.flags.education_outcome,effect==='educationSalary'?1:2);
  assert.equal(requestBreak(run),run);assert.equal(requestCareer(run),run);assert.equal(canRequestCareer(run),false);
  const exit=requestExit(run),returned=choose(exit,2);assert.equal(returned.eventId,run.eventId);assert.equal(returned.rng,run.rng);assert.equal(returned.resumeEventId,run.resumeEventId);
 }
});

test('early salary proposal uses Hope, changes pay only on acceptance and does not repeat the education interrogation',()=>{
 const {run,next}=dispute('educationSalary'),salary=next;
 assert.equal(getEvent(salary).speaker,'hope');assert.match(getEvent(salary).title,/試用期/);assert.equal(salary.salaryCut.reason,'education');assert.ok(salary.salaryCut.percent>=23&&salary.salaryCut.percent<=41);assert.equal(salary.pay,run.pay);
 const accepted=choose(salary,0);assert.equal(accepted.pay,salary.salaryCut.to);assert.equal(accepted.salaryCut.status,'accepted');assert.equal(accepted.flags.education_case_active,0);assert.equal(accepted.flags.education_risk_checked,1);assert.equal(accepted.eventId,run.resumeEventId);assert.equal(accepted.turn,run.turn);
 const declined=choose(salary,1);assert.equal(declined.completed,true);assert.equal(declined.endingId,'ragequit-system');
 for(let attempt=0;attempt<25;attempt++){
  const later=choose({...boundary(attempt),educationReviewed:accepted.educationReviewed,flags:{...accepted.flags},pay:accepted.pay,salaryCut:accepted.salaryCut,salaryCutOffered:true},0);
  assert.notEqual(later.eventId,'education-scrutiny');assert.equal(later.flags.education_risk_checked,1);
 }
 const normal={...salary,salaryCut:{...salary.salaryCut,reason:undefined},flags:{...salary.flags,education_case_active:0}};
 assert.notEqual(getEvent(normal).title,getEvent(salary).title,'ordinary post-probation copy is retained');
});

test('early dismissal stays with the exit team and allows a proper three-workday PIP without a boss boost',()=>{
 const {run,next}=dispute('educationDismissal');assert.equal(getEvent(next).speaker,'exit-team');assert.match(getEvent(next).body,/Wing.*不在/);
 const signed=choose(next,0);assert.equal(signed.endingId,'fired_signed-system');
 const paperwork=choose(next,1);assert.equal(paperwork.eventId,'paperwork');assert.equal(choose(paperwork,1).endingId,'layoff-system');
 const pip=choose(next,2);assert.equal(pip.flags.education_case_active,0);assert.equal(pip.pip.remaining,3);assert.equal(pip.pipCount,1);assert.equal(pip.stats.boss,next.stats.boss);assert.equal(pip.turn,run.turn);assert.equal(pip.eventId,run.resumeEventId);
});

test('e11 retains manual career preparation and the hard e10 promotion requirements',()=>{
 const modern=boundary(0,{turn:8,lastPromotion:1,flags:{career_service:10,education_risk_checked:1},stats:{skill:90,lick:90,trust:90}}),old={...modern,seed:'e10-education-comparison'};
 assert.deepEqual(careerReadiness(modern),careerReadiness(old));assert.equal(canRequestCareer(modern),true);
 const prepared=requestCareer(modern);assert.equal(prepared.eventId,'career-review');assert.equal(prepared.rng,modern.rng);assert.equal(prepared.turn,modern.turn);
 for(let index=0;index<2;index++)assert.equal(getEvent(prepared).choices[index].check.chance,getEvent({...prepared,seed:old.seed}).choices[index].check.chance);
});

test('new education state rejects malformed saves and old e10 saves do not acquire it',()=>{
 const initial=createRun('system','e11-education-validation');assert.equal(validRun(copy(initial)),true);
 for(const [key,value]of [['education_risk_due',1],['education_risk_due',5],['education_risk_due',2.5],['education_risk_checked',2],['education_case_active',2],['education_dispute',16],['education_outcome',3]])assert.equal(validRun({...initial,flags:{...initial.flags,[key]:value}}),false,`${key}/${value}`);
 const old=createRun('system','e10-before-education-risk');assert.equal(old.flags.education_risk_due,undefined);assert.equal(old.flags.education_case_active,undefined);assert.equal(validRun(old),true);
 assert.equal(validRun({...old,eventId:'education-scrutiny'}),false);
});

test('current natural routes prove education salary and dismissal branches survive JSON saves and server replay',()=>{
 const routes=JSON.parse(readFileSync(new URL('../research/reachability-v3.json',import.meta.url),'utf8')).routes;
 const examples={salary:null,dismissal:null};
 for(const route of routes){
  const at=route.actions.findIndex(action=>action.eventId==='education-scrutiny');if(at<0)continue;
  const next=route.actions[at+1]?.eventId;
  if(next==='salary-cut')examples.salary??=route;if(next==='dismissal-final')examples.dismissal??=route;
 }
 for(const [branch,route]of Object.entries(examples)){
  assert.ok(route,`natural ${branch} education witness`);assert.ok(route.seed.startsWith('e23-'));
  const finished=replayRoute(route,state=>assert.equal(validRun(copy(state)),true));assert.equal(finished.endingId,route.ending);assert.deepEqual(finished,replayRun(route.roleId,route.seed,route.actions));
  assert.equal(finished.history.filter(row=>row.eventId==='education-scrutiny').length,1);
  const forged=copy(route.actions),at=forged.findIndex(action=>action.eventId==='education-scrutiny');forged[at].eventId='education-review';assert.throws(()=>replayRun(route.roleId,route.seed,forged),/Replay event mismatch/);
 }
});
