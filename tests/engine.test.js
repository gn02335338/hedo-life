import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ROLES, ROLE_MAP } from '../dist/roles.js';
import { EVENTS, FANTASY_EVENTS } from '../dist/events.js';
import { ENDINGS, FAMILIES } from '../dist/endings.js';
import { SOURCES } from '../dist/public-sources.js';
import { VERSION, MAX_TURNS, STAT_KEYS, createRun, getEvent, applyChoice, advance, requestExit, endingEligibility, jobTitle, validRun, replayRun } from '../dist/engine.js';
import { replayRoute } from './find-routes-v3.mjs';

const copy=x=>JSON.parse(JSON.stringify(x));
const choose=(run,index)=>advance(applyChoice(run,index));
const boundary=(roleId,eventId,stats={},extras={})=>{
 const run=createRun(roleId,'boundary');
 return {...run,eventId,educationReviewed:true,...extras,stats:{...run.stats,...stats}};
};
const findRun=(role,predicate)=>{
 for(let i=0;i<12000;i++){const r=createRun(role,`candidate-${i}`);if(predicate(r))return r;}
 throw new Error('No matching candidate');
};
const checkOutcome=(eventId,index,extras={},wanted='promote')=>{
 for(let i=0;i<500;i++){
  const r=createRun('system',`check-${i}`);
  const state={...r,eventId,educationReviewed:true,stats:{...r.stats,energy:90,cash:90,mood:90,boss:80,skill:85,lick:85},resumeEventId:EVENTS[0].id,...extras};
  const pending=applyChoice(state,index);if(pending.pendingEffect===wanted)return {initial:state,pending,final:advance(pending)};
 }
 throw new Error(`No ${wanted} check result`);
};

test('thirteen careers retain the published 377 endings and expand to an 883-card catalog with eight career stages',()=>{
 assert.equal(VERSION,3);assert.equal(ROLES.length,13);assert.equal(STAT_KEYS.length,9);
 assert.equal(FAMILIES.slice(0,16).length,16);assert.equal(ENDINGS.slice(0,144).length,144);
 assert.equal(FAMILIES.length,68);assert.equal(ENDINGS.length,883);
 for(const list of [ROLES,EVENTS,FANTASY_EVENTS,ENDINGS])assert.equal(new Set(list.map(x=>x.id)).size,list.length);
 assert.equal(EVENTS.filter(event=>(event.minRules||1)<26).length,323);assert.equal(EVENTS.length,323+EVENTS.filter(event=>event.minRules>=26).length);assert.equal(FANTASY_EVENTS.length,4);
 for(const role of ROLES){
  assert.deepEqual(Object.keys(role.stats).sort(),[...STAT_KEYS].sort());
  assert.equal(role.ladder.length,(role.minRules||1)<28?5:8);assert.ok(role.assistantTitle);
  assert.ok(role.payRange[1]>role.payRange[0]);
  assert.equal(ENDINGS.slice(0,144).filter(e=>e.roleId===role.id).length,(role.minRules||1)<28?16:0);
  assert.equal(ENDINGS.filter(e=>e.roleId===role.id).length,role.id==='executive'?67:68);
 }
 assert.equal(new Set(ENDINGS.map(e=>e.title)).size,ENDINGS.length);
 assert.equal(new Set(ENDINGS.map(e=>e.body)).size,ENDINGS.length);
 for(const event of [...EVENTS,...FANTASY_EVENTS]){
  assert.ok(event.title&&event.body&&event.choices.length>=3);
  for(const id of event.sourceIds||[])assert.ok(SOURCES[id],`${event.id}: ${id}`);
  for(const c of event.choices){assert.ok(c.text&&c.result&&c.delta);assert.ok(Object.keys(c.delta).every(k=>STAT_KEYS.includes(k)));assert.ok(Object.values(c.delta).every(Number.isFinite));}
 }
});

test('3d6 abilities, school/department and salary are reproducible rolls with variety',()=>{
 const schools=new Set(),salary=new Set(),abilities=new Set(),fields=new Set();
 for(let i=0;i<1000;i++){
  const run=createRun('ai',`dice-${i}`);schools.add(run.education.school);fields.add(run.education.field);salary.add(run.offerPay);abilities.add(run.stats.skill);
  for(const key of ['skill','slack','lick']){
   assert.equal(run.abilityDice[key].length,3);
   assert.ok(run.abilityDice[key].every(n=>n>=1&&n<=6));
   assert.equal(run.stats[key],25+(run.abilityDice[key].reduce((a,b)=>a+b,0)-3)*4);
  }
  assert.ok(run.offerPay>=ROLE_MAP.ai.payRange[0]&&run.offerPay<=ROLE_MAP.ai.payRange[1]);
  assert.ok(run.education.department&&run.education.degree);assert.equal(validRun(copy(run)),true);
 }
 assert.ok(schools.size>=20);assert.equal(fields.size,4);assert.ok(salary.size>30);assert.ok(abilities.size>=14);
 for(const seed of ['same-seed',0,123456,'長'.repeat(80)]){
  const run=createRun('ai',seed);assert.deepEqual(createRun('ai',seed),run);assert.deepEqual(createRun('ai',run.seed),run);
 }
});

test('all careers remain accessible regardless of education; bias belongs only to boss mood',()=>{
 const ntu=findRun('system',r=>r.education.schoolId==='ntu'&&r.education.field==='stem'&&r.education.degree!=='EMBA');
 const ntuEmba=findRun('system',r=>r.education.schoolId==='ntu'&&r.education.degree==='EMBA');
 const privateArts=findRun('system',r=>r.education.sector==='private'&&r.education.field==='humanities');
 assert.ok(ntu.education.wingBias>0);assert.ok(ntuEmba.education.wingBias<0);assert.ok(privateArts.education.wingBias<0);
 for(const role of ROLES.filter(role=>(role.minRules||1)<28)){const run=createRun(role.id,privateArts.seed);assert.equal(run.roleId,role.id);assert.equal(run.education.school,privateArts.education.school);}
 assert.equal(ntu.stats.boss,ROLE_MAP.system.stats.boss+ntu.education.wingBias);
});

test('AI bait-switch, varied project assignments and MIS assistant naming are real assignments',()=>{
 let swapped=0,assistant=0;const pm=new Set();
 for(let i=0;i<10000;i++){
  const ai=createRun('ai',`assignment-${i}`);if(ai.assignment==='swapped'){swapped++;assert.equal(ai.actualRoleId,'system');}if(ai.assignment==='assistant'){assistant++;assert.equal(jobTitle(ai),'助理工程師');}
  const project=createRun('project',`assignment-${i}`);pm.add(`${project.actualRoleId}/${project.assignment}`);
 }
 assert.ok(Math.abs(swapped/10000-.75)<.025);assert.ok(Math.abs(assistant/10000-.15)<.025);
 for(const key of ['system/assistant','product/swapped','sales/swapped','sales/assistant','design/swapped','project/honest'])assert.ok(pm.has(key),key);
 const mis=findRun('mis',r=>r.assignment==='assistant');assert.equal(mis.actualRoleId,'system');assert.equal(jobTitle(mis),'助理工程師');
 const sales=findRun('sales',r=>r.assignment==='assistant');assert.equal(jobTitle(sales),'業務助理');
 assert.equal(sales.pay,Math.round(sales.offerPay*.78));
});

test('parachuted managers retain their position and high salary but face faster loss of favor',()=>{
 for(let i=0;i<1000;i++){const r=createRun('executive',`exec-${i}`);assert.equal(r.actualRoleId,'executive');assert.equal(r.assignment,'honest');assert.ok(r.pay>=105&&r.pay<=220);}
 const executive=boundary('executive',EVENTS[0].id,{boss:80,mood:80,energy:80},{turn:3});
 const control={...copy(executive),roleId:'system',actualRoleId:'system'};
 const a=applyChoice(executive,0),b=applyChoice(control,0);assert.equal(a.stats.boss,b.stats.boss-12);
 const powerless=boundary('executive','career-exit',{boss:40},{turn:4});assert.equal(getEvent(powerless).choices[0].available,true);assert.equal(jobTitle(powerless),'空降主管');
 assert.equal(choose(powerless,0).endingId,'assistant-executive');
});

test('action resolution rolls after selection and can produce different outcomes for equal capability',()=>{
 const outcomes=new Set(),deltas=new Set(),checks=new Set();
 for(let i=0;i<100;i++){
  let r=createRun('system',`chance-${i}`);r={...r,eventId:EVENTS[0].id,stats:{...r.stats,energy:75,cash:70,mood:70,boss:70,skill:65,slack:65,lick:65}};
  const before=copy(r),p=applyChoice(r,0);outcomes.add(p.history.at(-1).chanceOutcome);deltas.add(JSON.stringify(p.history.at(-1).delta));assert.deepEqual(r,before);
  const review={...r,eventId:'promotion-review'};assert.equal(getEvent(review).choices[0].check.passed,undefined);checks.add(applyChoice(review,0).pendingEffect);
 }
 for(const outcome of ['ordinary','lucky','setback'])assert.ok(outcomes.has(outcome));
 assert.ok(deltas.size>5);assert.ok(checks.has('promote')&&checks.has(null));
});

test('pending consequences prevent duplicate choices; replay records choices and explicit exit overlays',()=>{
 const first=createRun('system','actions');assert.equal(advance(first),first);
 const pending=applyChoice(first,0);assert.equal(applyChoice(pending,1),pending);assert.equal(requestExit(pending),pending);
 const next=advance(pending);assert.equal(next.turn,1);assert.equal(next.eventId,'education-review');
 const exit=requestExit(next),back=choose(exit,2);assert.equal(back.eventId,'education-review');assert.equal(back.rng,next.rng);
 assert.deepEqual(replayRun(first.roleId,first.seed,back.actions),back);
 assert.deepEqual(back.actions,[{type:'choice',eventId:'onboarding',index:0},{type:'exit'},{type:'choice',eventId:'exit-menu',index:2}]);
 assert.throws(()=>replayRun('ai','seed',[{type:'choice',eventId:'wrong',index:0}]),/mismatch/);
 assert.throws(()=>replayRun('ai','seed',[{type:'exit'},{type:'exit'}]),/Duplicate/);
 assert.throws(()=>replayRun('ai','seed',[{type:'choice',eventId:'onboarding',index:2},{type:'exit'}]),/Invalid/);
 assert.throws(()=>replayRun('ai','seed',Array(301).fill({type:'exit'})),/Invalid/);
 for(const index of [-1,99,.2,NaN])assert.throws(()=>applyChoice(first,index),/Unavailable/);
});

test('published v3 seeds preserve the original education timing and completed replay results',()=>{
 const old=createRun('system','published-v3-seed');
 assert.equal(choose(old,0).eventId,'education-review');
 assert.equal(validRun(copy(old)),true);
 const fixtures=JSON.parse(readFileSync(new URL('./fixtures/legacy-v3-routes.json',import.meta.url),'utf8'));
 for(const fixture of fixtures){
  assert.equal(fixture.seed.startsWith('e1-'),false);
  const run=replayRun(fixture.roleId,fixture.seed,fixture.actions);
  assert.equal(run.endingId,fixture.ending);assert.equal(run.turn,fixture.turns);assert.equal(run.rank,fixture.rank);assert.deepEqual(run.stats,fixture.stats);assert.equal(validRun(copy(run)),true);
 }
});

test('new prefixed runs have an occasional mid-career education chat without spoiling its question order',()=>{
 const daily=(seed,turn,extras={})=>{const r=createRun('system',seed);return {...r,eventId:EVENTS[0].id,rank:4,turn,salaryCutOffered:true,stats:{...r.stats,boss:70,mood:90,energy:90,cash:90},...extras};};
 let count=0,sample=null;
 for(let i=0;i<1000;i++){
  const seed=`e1-education-${i}`,first=createRun('system',seed);
  assert.notEqual(choose(first,0).eventId,'education-review');
  const middle=choose(daily(seed,6),0);
  if(middle.eventId==='education-review'){count++;sample=middle;}
 }
 assert.ok(count>30&&count<200,`${count}/1000 eligible mid-career chats`);
 for(const turn of [0,1,2,3,16,17,18,19])for(let i=0;i<20;i++){
  const before=daily(`e1-window-${i}`,turn),eligible=choose(before,0),suppressed=choose({...before,educationReviewed:true},0);
  assert.notEqual(eligible.eventId,'education-review');assert.equal(eligible.rng,suppressed.rng,'No education RNG draw outside its window');
 }
 const event=getEvent(sample),question=event.body.indexOf('你哪裡畢業的？'),answer=event.body.indexOf('你照實回答');
 assert.ok(question>=0&&answer>question);assert.ok(event.body.includes(sample.education.school));assert.ok(event.body.includes(sample.education.department));
 assert.doesNotMatch(event.body,/履歷|掃過|翻閱|看見校名/);
 const resumed=choose(sample,0);assert.equal(resumed.eventId,sample.resumeEventId);assert.equal(resumed.turn,sample.turn);assert.equal(resumed.educationReviewed,true);assert.equal(validRun(copy(resumed)),true);
 for(let i=0;i<50;i++)assert.notEqual(choose(daily(`e1-repeat-${i}`,8,{educationReviewed:true}),0).eventId,'education-review');
});

test('new education scheduling never interrupts PIP, promotion, salary negotiation, or exit overlays',()=>{
 for(let i=0;i<80;i++){
  const r=createRun('system',`e1-priority-${i}`),normal={...r,eventId:EVENTS[0].id,turn:5,salaryCutOffered:true,stats:{...r.stats,boss:70,mood:90,energy:90,cash:90}};
  const duringPip={...normal,pip:{active:true,remaining:2},pipCount:1};
  const pip=choose(duringPip,0),pipControl=choose({...duringPip,educationReviewed:true},0);
  assert.notEqual(pip.eventId,'education-review');assert.equal(pip.pip.remaining,1);assert.equal(pip.rng,pipControl.rng);
  const promotion=choose(normal,0),promotionControl=choose({...normal,educationReviewed:true},0);
  assert.equal(promotion.eventId,'promotion-review');assert.equal(promotion.rng,promotionControl.rng);
 }
 const salaryCut={percent:20,from:60,to:48,status:'pending'};
 for(const eventId of ['education-review','promotion-review','pip-review','salary-cut','salary-final']){
  const r=createRun('system',`e1-overlay-${eventId}`),state={...r,eventId,turn:7,resumeEventId:EVENTS[0].id,salaryCut};
  const back=choose(requestExit(state),2);assert.equal(back.eventId,eventId);assert.equal(back.resumeEventId,EVENTS[0].id);assert.equal(back.rng,state.rng);
 }
 const r=createRun('system','e1-salary-return'),salary={...r,eventId:'salary-cut',turn:7,resumeEventId:EVENTS[0].id,salaryCut,salaryCutOffered:true,stats:{...r.stats,boss:70,mood:90}};
 const resumed=choose(salary,0);assert.equal(resumed.eventId,EVENTS[0].id);assert.equal(resumed.educationReviewed,false);
});

test('boss crisis uses the exit team and preserves signed/refused/no-PIP departures',()=>{
 const crisis=choose(boundary('system','onboarding',{boss:0,mood:70}),0);assert.equal(crisis.eventId,'crisis-boss');assert.equal(getEvent(crisis).speaker,'exit-team');
 assert.equal(choose(crisis,0).endingId,'fired_signed-system');
 const paperwork=choose(crisis,1);assert.equal(paperwork.eventId,'paperwork');assert.equal(getEvent(paperwork).speaker,'exit-team');
 assert.equal(choose(paperwork,0).endingId,'fired_refused-system');
 const layoff=choose(paperwork,1);assert.equal(layoff.endingId,'layoff-system');assert.equal(layoff.pipCount,0);
});

test('Hope hosts three-work-turn PIP, which can pass or fail on an actual roll',()=>{
 let run=boundary('system','crisis-boss',{boss:0,mood:100,energy:100,cash:100,skill:80},{resumeEventId:EVENTS[0].id});
 run=choose(run,2);assert.equal(run.pip.remaining,3);assert.equal(run.pipCount,1);
 for(let i=0;i<3;i++){
  const event=getEvent(run);assert.ok(['daily','fantasy'].includes(event.kind));
  const choices=event.choices.map((c,index)=>({index,p:applyChoice(run,index)})).filter(x=>!x.p.pendingFamily);
  choices.sort((a,b)=>(b.p.stats.energy+b.p.stats.mood)-(a.p.stats.energy+a.p.stats.mood));
  run=advance(choices[0].p);assert.equal(run.pip.remaining,2-i);
  if(run.eventId==='crisis-mood')run=choose(run,2);
 }
 assert.equal(run.eventId,'pip-review');assert.equal(getEvent(run).speaker,'hope');
 const extras={flags:{evidence:3},pip:{active:true,remaining:0},pipCount:1};
 const pass=checkOutcome('pip-review',0,extras,'pipPassed').final;assert.equal(pass.eventId,'pip-passed');assert.equal(getEvent(pass).speaker,'hope');assert.equal(choose(pass,0).endingId,'pip_exit-system');
 const failure=checkOutcome('pip-review',0,extras,'pip_fail').final;assert.equal(failure.endingId,'pip_fail-system');
 const continued=choose(pass,1);assert.equal(continued.completed,false);assert.equal(continued.pip,null);assert.equal(continued.eventId,EVENTS[0].id);
});

test('salary cut appears only after probation, can be refused, negotiated, or accepted with changed pay',()=>{
 let offered=null;
 for(let i=0;i<1000&&!offered;i++){
  const r=createRun('system',`salary-${i}`);
  const state={...r,eventId:EVENTS[0].id,educationReviewed:true,turn:4,stats:{...r.stats,boss:35,mood:90,energy:90,cash:90}};
  const next=choose(state,0);if(next.eventId==='salary-cut')offered=next;
 }
 assert.ok(offered);assert.equal(offered.turn,5);assert.equal(getEvent(offered).speaker,'hope');
 assert.ok(offered.salaryCut.percent>=15&&offered.salaryCut.percent<=35);assert.ok(offered.salaryCut.to<offered.pay);
 const accepted=choose(offered,0);assert.equal(accepted.pay,offered.salaryCut.to);assert.equal(accepted.salaryCut.status,'accepted');assert.equal(accepted.flags.pay_cut,1);
 assert.equal(choose(offered,1).endingId,'ragequit-system');
 const won=checkOutcome('salary-cut',2,{salaryCut:offered.salaryCut,salaryCutOffered:true},'salaryRescind').final;assert.equal(won.salaryCut.status,'rescinded');
 const lost=checkOutcome('salary-cut',2,{salaryCut:offered.salaryCut,salaryCutOffered:true},'salaryFinal').final;assert.equal(lost.eventId,'salary-final');assert.equal(choose(lost,0).pay,offered.salaryCut.to);
});

test('promotion changes job title and raises salary while assistants first become regular staff',()=>{
 const promoted=checkOutcome('promotion-review',0,{assignment:'honest',actualRoleId:'system'});assert.equal(promoted.final.rank,1);assert.equal(jobTitle(promoted.final),'資深系統工程師');assert.ok(promoted.final.pay>promoted.initial.pay);
 const assistant=checkOutcome('promotion-review',0,{assignment:'assistant',actualRoleId:'system',pay:40,basePay:60});assert.equal(assistant.final.assignment,'honest');assert.equal(assistant.final.rank,0);assert.equal(assistant.final.pay,60);
 const failed=checkOutcome('promotion-review',0,{turn:6},null);assert.equal(failed.final.lastPromotion,6);assert.equal(failed.final.rank,0);
});

test('returning from the exit menu preserves every suspended human-resources subflow',()=>{
 const salaryCut={percent:20,from:60,to:48,status:'pending'};
 for(const eventId of ['promotion-review','crisis-mood','crisis-boss','pip-review','education-review','salary-cut','salary-final']){
  const run=boundary('system',eventId,{}, {resumeEventId:EVENTS[0].id,salaryCut});
  const menu=requestExit(run),back=choose(menu,2);assert.equal(back.eventId,eventId);assert.equal(back.resumeEventId,EVENTS[0].id);assert.equal(back.rng,run.rng);assert.equal(back.turn,run.turn);
  const career=choose(menu,1),idx=getEvent(career).choices.findIndex(c=>c.effect==='return');const again=choose(career,idx);assert.equal(again.eventId,eventId);assert.equal(again.resumeEventId,EVENTS[0].id);
 }
});

test('low mood offers an early exit; zero energy/cash terminate without waiting for the finale',()=>{
 const mood=choose(boundary('system','onboarding',{mood:0,boss:70}),0);assert.equal(mood.eventId,'crisis-mood');assert.equal(choose(mood,0).endingId,'ragequit-system');assert.equal(choose(mood,1).completed,false);
 assert.equal(choose(boundary('system','onboarding',{energy:0}),0).endingId,'burnout-system');
 assert.equal(choose(boundary('system','career-exit',{cash:0}),5).endingId,'ragequit-system');
 assert.equal(choose(boundary('system','education-review',{cash:0}),0).endingId,'broke-system');
 assert.equal(choose(createRun('ai','early'),2).turn,0);
});

test('history stores actual bounded deltas and no forbidden nickname exists in the engine',()=>{
 const run=boundary('system',EVENTS[0].id,{mood:99,boss:2,skill:99,cash:99});const next=applyChoice(run,0);
 for(const key of STAT_KEYS){assert.ok(next.stats[key]>=0&&next.stats[key]<=100);assert.equal(next.history[0].delta[key],next.stats[key]-run.stats[key]);}
 assert.equal(typeof next.history[0].speaker,'string');assert.equal(typeof next.history[0].chanceOutcome,'string');
 assert.equal(readFileSync(new URL('../dist/engine.js',import.meta.url),'utf8').includes('掰咖'),false);
});

test('fantasy gates still require resources; unavailable outcomes remain guarded',()=>{
 const run=boundary('system','onboarding',{energy:20,cash:30,skill:65,trust:55,dream:70});assert.equal(endingEligibility(run,'nasdaq'),true);assert.equal(endingEligibility(run,'taiwan'),true);
 for(const key of ['energy','cash','skill','trust','dream']){const low=copy(run);low.stats[key]--;assert.equal(endingEligibility(low,'nasdaq'),false,key);}
 const unavailable=boundary('system','career-exit',{slack:20});assert.throws(()=>applyChoice(unavailable,2),/Unavailable/);
});

test('save validation rejects malformed dice, school, actions, salary and lifecycle states',()=>{
 const initial=createRun('ai','save'),pending=applyChoice(initial,0),next=advance(pending);
 for(const run of [initial,pending,next])assert.equal(validRun(copy(run)),true);
 const corrupt=[null,[],{}, {...initial,version:2},{...initial,roleId:'missing'},{...initial,actualRoleId:'missing'},
 {...initial,stats:{...initial.stats,mood:NaN}},{...initial,stats:{...initial.stats,mood:101}},
 {...initial,assignment:'intern'},{...initial,rank:5},{...initial,rng:0},{...initial,turn:MAX_TURNS+1},
 {...initial,eventId:'missing-event'},{...initial,flags:{x:-1}},{...initial,pip:{active:true,remaining:4}},
 {...pending,history:[null]},{...pending,history:[{...pending.history[0],delta:null}]},
 {...initial,abilityDice:{skill:[1,2,7],slack:[1,2,3],lick:[1,2,3]}},{...initial,education:null},{...initial,actions:[{type:'choice',index:.5}]},
 {...initial,salaryCut:{percent:20,from:60,to:80,status:'pending'}},{...initial,completed:true,endingId:'ragequit-ai'}];
 for(const value of corrupt){assert.doesNotThrow(()=>validRun(value));assert.equal(validRun(value),false);}
});

test('every ending has a natural replayable witness using only ordinary actions',()=>{
 const report=JSON.parse(readFileSync(new URL('../research/reachability-v3.json',import.meta.url),'utf8'));
 assert.equal(report.complete,true);assert.equal(report.found,ENDINGS.length);assert.deepEqual(report.missing,[]);
 for(const name of ['activity-play-v55','energy-safety-v54','energy-rest-v53','work-gap-v50','patronage-v49','activity-schedule-v46','hidden-encounter-v45','activities-v44','patronage-reply-v43','events-professor-v37','professor-v37','rage-v37','verbal-professor-v37','meal-reactions-v36','meal-flavor-v36','events-cast-v35-a','events-cast-v35-b','events-cast-v35-legal','work-events-v35','meal-invitations-v34','verbal-outcomes-v33','company-v32','verbal-outcomes-v32','endings-company-v32','endings-verbal-v32','achievements-v32','verbal-scenario-v2','verbal-scene-copy','salary-advice-v24','events-ai-v31','verbal-v30','verbal-copy-v30','character-stats','patronage-v29','events-gender-v29','wealth-exit-v27','endings-wealth-v27','events-quiz26-a','events-quiz26-b','events-chronicle-v22','rage-v22','events-commercial-v21','events-design-v21','events-professions-v21','work-events-v21','rage-participants','personnel-v20','endings-personnel-v20','events-meimei-v20','rage-v20','salary-raise-v19','resources-v18','relationships-v18','meltdown-v18','achievements-v18','career-api','career-v17','onboarding-v17','endings-career-v17','engine','persona','rage-v16','events-jack','copy-v15','events-advisor','rage','rage-v14','banquet','endings-rage','roles','education','education-risk','events','events-images','image-scenes-wing','events-video','copy-edits','engine-copy','wild-options','wild-base','wild-expanded','kind-break','career','story-career','endings','endings-career','endings-stories','events-departures']){
  const hash=createHash('sha256').update(readFileSync(new URL(`../dist/${name}.js`,import.meta.url))).digest('hex');assert.equal(report.sourceSha256[name],hash,`${name} changed after witnesses`);
 }
 assert.deepEqual(report.routes.map(r=>r.ending).sort(),ENDINGS.map(e=>e.id).sort());
 for(const route of report.routes){
  const finished=replayRoute(route,state=>assert.equal(validRun(copy(state)),true,`${route.ending}/${state.eventId}`));
  assert.equal(finished.completed,true);assert.equal(finished.endingId,route.ending);assert.deepEqual(finished.stats,route.stats);
  assert.deepEqual(replayRun(route.roleId,route.seed,finished.actions),finished);
  assert.equal(applyChoice(finished,0),finished);assert.equal(advance(finished),finished);assert.equal(validRun({...finished,pending:true}),false);
 }
});
