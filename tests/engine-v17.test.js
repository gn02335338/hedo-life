import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {ROLES} from '../dist/roles.js';
import {createRun,getEvent,applyChoice,advance,requestExit,requestBreak,requestCareer,requestRage,validRun,replayRun,jobTitle} from '../dist/engine.js';
import {CAREER_LEVELS_V17,CAREER_LADDERS_V17,CAREER_FAMILIES_V17} from '../dist/career-v17.js';
import {careerReadiness,legacyCareerRank} from '../dist/career-api.js';
import {deriveAchievements} from '../dist/achievements.js';
import {validateCompletion} from '../worker/http.js';
const copy=value=>JSON.parse(JSON.stringify(value));
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

test('all e16 endings and direct rage modes retain every published direct and JSON checkpoint',()=>{
 const fixtures=JSON.parse(readFileSync(new URL('./fixtures/legacy-e16-routes.json',import.meta.url)));
 assert.equal(fixtures.length,292);let count=0;
 for(const route of fixtures)for(const saved of [false,true]){
  let run=createRun(route.roleId,route.seed),hashes=[];
  const check=()=>{if(saved)run=copy(run);assert.equal(validRun(run),true,route.seed+'/'+run.eventId);hashes.push(hash(run));};check();
  for(let index=0;index<route.actions.length;index++){
   const action=route.actions[index];
   if(action.type==='exit')run=requestExit(run);else if(action.type==='break')run=requestBreak(run);else if(action.type==='career')run=requestCareer(run);
   else if(action.type==='rage'){run=requestRage(run);check();run=advance(run);}
   else{run=applyChoice(run,action.index);check();if(!(route.actions[index+1]?.type==='rage'&&route.actions[index+1].phase==='result'))run=advance(run);}
   check();
  }
  assert.deepEqual(hashes,saved?route.savedCheckpoints:route.directCheckpoints,route.ending);
  assert.equal(hash(run),saved?route.savedStateSha256:route.stateSha256,route.ending);
  assert.deepEqual(replayRun(route.roleId,route.seed,route.actions),run);
  if(!saved)count+=hashes.length;
 }
 assert.equal(count,10713);
});

test('all nine professions have eight real ranks, with assistant and executive entry correctly placed',()=>{
 assert.deepEqual(CAREER_LADDERS_V17.system,['助理工程師','工程師','資深工程師','主任工程師','工程副理','工程經理','工程總監','技術長 CTO']);
 const assignments=new Set();
 for(const role of ROLES){
  assert.equal(CAREER_LADDERS_V17[role.id].length,8);
  for(let index=0;index<60;index++){
   const run=createRun(role.id,`e17-entry-${index}`);assignments.add(run.assignment);
   assert.equal(run.rank,role.id==='executive'?5:run.assignment==='assistant'?0:1);
   assert.equal(jobTitle(run),CAREER_LADDERS_V17[run.actualRoleId][run.rank]);assert.equal(validRun(copy(run)),true);
   if(run.rank<4)assert.equal(legacyCareerRank(run),0);
  }
 }
 assert.deepEqual([...assignments].sort(),['assistant','honest','swapped']);
});

function review(rank,seed='e17-rank-review'){
 const run=createRun('system',seed);
 return {...run,rank,assignment:rank===0?'assistant':'honest',actualRoleId:'system',eventId:'career-review',turn:[3,4,7,10,13,16,20][rank],resumeEventId:'jack-notebook',flags:{...run.flags,career_peak_rank:rank,career_service:10},stats:Object.fromEntries(Object.keys(run.stats).map(key=>[key,100]))};
}
test('every adjacent promotion changes the real title, pay and duty while preserving workday and PIP',()=>{
 for(let rank=0;rank<7;rank++){
  let proof;
  for(let index=0;index<300&&!proof;index++){
   const run=review(rank,`e17-rank-${rank}-${index}`),pending=applyChoice(run,0);
   if(pending.pendingEffect===(rank===0?'careerRegularize':'careerPromote'))proof={run,pending,next:advance(pending)};
  }
  assert.ok(proof,'successful rank '+rank);
  const {run,pending,next}=proof;
  assert.equal(pending.rank,rank+1);assert.equal(jobTitle(pending),CAREER_LADDERS_V17.system[rank+1]);assert.ok(pending.pay>=run.pay);
  assert.equal(pending.flags.career_service,0);assert.equal(pending.flags.career_peak_rank,rank+1);
  assert.equal(next.turn,run.turn);assert.deepEqual(next.pip,run.pip);assert.equal(validRun(copy(next)),true);
  if(rank>0)assert.equal(next.eventId,`career-duty-${rank+1}`);
  const unready={...run,flags:{...run.flags,career_service:0}};
  assert.equal(careerReadiness(unready).ready,false);assert.equal(getEvent(unready).choices[0].available,false);assert.equal(getEvent(unready).choices[1].available,false);
 }
});

test('senior and principal work is not mistaken for managerial events or achievements',()=>{
 for(const rank of [2,3]){
  const run={...review(rank),eventId:`career-duty-${rank}`,flags:{...review(rank).flags,promotions:2}};
  const event=getEvent(run);assert.ok(event.body.includes(CAREER_LADDERS_V17.system[rank]));
  const done=advance(applyChoice(run,0));assert.equal(done.turn,run.turn);assert.equal(done.flags[`career_duty_${rank}`],1);
  assert.ok(!deriveAchievements(done).includes('manager'));assert.ok(!deriveAchievements(done).includes('director'));
 }
 const manager={...review(5),flags:{...review(5).flags,promotions:1}};assert.ok(deriveAchievements(manager).includes('manager'));assert.ok(!deriveAchievements(manager).includes('director'));
});

test('assistant onboarding negotiations restore a professional rank and preserve the advertised offer',()=>{
 for(const role of ['system','sales','project']){
  let proof;
  for(let index=0;index<500&&!proof;index++){
   const run=createRun(role,`e17-restore-${index}`);if(run.assignment!=='assistant')continue;
   const pending=applyChoice(run,1);if(pending.pendingEffect==='restoreJob')proof={run,pending};
  }
  assert.ok(proof);const {run,pending}=proof;
  assert.equal(pending.rank,1);assert.equal(pending.assignment,'honest');assert.equal(pending.actualRoleId,role);assert.equal(pending.pay,run.offerPay);assert.equal(validRun(copy(pending)),true);
 }
});

test('current natural witnesses verify all eight career stages and new cohort API envelopes',()=>{
 const report={routes:JSON.parse(readFileSync(new URL('./fixtures/legacy-e17-routes.json',import.meta.url))).filter(route=>!route.ending.startsWith('feature-'))};
 assert.equal(report.routes.length,314);
 const ranks=new Set();
 for(const route of report.routes){
  assert.ok(route.seed.startsWith('e17-'));const run=replayRun(route.roleId,route.seed,route.actions);assert.equal(run.completed,true);assert.equal(validRun(copy(run)),true);
  const tier=CAREER_FAMILIES_V17.indexOf(route.ending.slice(0,route.ending.lastIndexOf('-')));if(tier>=0){assert.equal(run.rank,tier,route.ending);ranks.add(tier);}
  validateCompletion({runId:'7ce894aa-4605-4bca-b31d-5317d32bb12e',roleId:run.roleId,seed:run.seed,actions:run.actions},Object.fromEntries(ROLES.map(role=>[role.id,role])));
 }
 assert.deepEqual([...ranks].sort(),CAREER_LEVELS_V17.map(level=>level.rank));
});
