import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as E from '../dist/engine.js';
import {ROLES,RANDOM_BASE_ROLE_IDS_V60} from '../dist/roles.js';
import {directEntryV60} from '../dist/recruitment-v60.js';
import {characterAffinity} from '../dist/character-stats.js';
import {isPatronageBenefitsV67,appointmentPayV67,PATRONAGE_EXCLUDED_DAILY_IDS_V67} from '../dist/patronage-benefits-v67.js';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/patronage-lifecycle-v67.json',import.meta.url),'utf8'));
const copy=value=>structuredClone(value);
const from=route=>E.replayRun(route.roleId,route.seed,route.actions||route.beforeActions);
const sourceAmount=(row,source)=>(row?.breakdown||[]).filter(part=>part.source===source).reduce((n,part)=>n+(part.delta?.cash||0),0);

// Step only the fixture's genuine public actions, without automatic browser
// hooks: those hooks are already explicit later actions in the stored proof.
function walk(route){
 let run=E.createRun(route.roleId,route.seed);const steps=[];
 for(const action of route.actions){
  const before=run;let pending=null;
  switch(action.type){
   case 'activity-schedule':run=E.enableActivitySchedule(run);break;
   case 'activity-invitation':run=E.requestActivityInvitation(run);break;
   case 'hidden-encounter':run=E.requestHiddenEncounter(run);break;
   case 'salary-advice':run=E.requestSalaryAdvice(run);break;
   case 'break':run=E.requestBreak(run);break;
   case 'career':run=E.requestCareer(run);break;
   case 'choice':pending=E.applyChoice(run,action.index);run=E.advance(pending);break;
   case 'event-departure':pending=E.requestEventDepartureV63(run);run=E.advance(pending);break;
   case 'patronage-reply':pending=E.requestPatronageReply(run,action.target);run=E.advance(pending);break;
   case 'shareholder-play':pending=E.applyShareholderPlay(run,action.input);run=E.advance(pending);break;
   default:throw new Error(`Unsupported evidence action ${action.type}`);
  }
  assert.notEqual(run,before,`Every recorded control must be available: ${route.seed}/${action.type}`);
  steps.push({before,pending,after:run,action});
 }
 assert.deepEqual(run,from(route));return {run,steps};
}

test('fifty genuine current lives cover thirteen ordinary careers, both generated genders and both special entry variants',()=>{
 assert.equal(fixture.profile,67);assert.equal(fixture.routes.length,50);
 const covered=new Set();let normalAppointments=0;
 for(const route of fixture.routes){
  assert.match(route.seed,/^e39-r67-[nsd]-[0-9a-f]{22}$/);assert.equal(route.actions[0].type,'activity-schedule');
  const run=from(route);assert.equal(E.validRun(run),true);assert.equal(run.completed,true);assert.equal(run.characterGender,route.gender);
  covered.add(`${route.kind}:${route.roleId}:${route.gender}`);
  if(route.kind==='normal'){assert.equal(directEntryV60(run),null);if(run.patronage)normalAppointments++;}
  else{assert.equal(run.patronage?.title,route.kind==='son'?'乾兒子':'乾女兒');assert.equal(directEntryV60(run).roleId,route.roleId);assert.equal(run.flags.recruitment60_appointed,1);}
 }
 for(const role of ROLES)for(const gender of ['male','female'])assert.ok(covered.has(`normal:${role.id}:${gender}`));
 for(const role of RANDOM_BASE_ROLE_IDS_V60)for(const [kind,gender]of [['son','male'],['daughter','female']])assert.ok(covered.has(`${kind}:${role}:${gender}`));
 assert.ok(normalAppointments>=2,'ordinary employees also actually obtain the appointment after working');
});

test('direct acceptance records the new salary and one clamped 24-point subsidy; introductions do not become paydays or work',()=>{
 for(const route of fixture.routes.filter(row=>row.kind!=='normal')){
  const start=E.enableActivitySchedule(E.createRun(route.roleId,route.seed)),before=copy(start);
  for(const index of [0,1]){
   const pending=E.applyChoice(start,index),row=pending.history.at(-1),pay=appointmentPayV67(start,start.pay);
   assert.deepEqual(start,before);assert.equal(pay>=180&&pay<=500,true);assert.equal(pending.pay,pay);assert.equal(row.pay,pay);
   assert.equal(pending.patronage.appointedPay,pay);assert.equal(pending.patronage.fromPay,start.pay);assert.equal(pending.patronage.historyIndex,0);
   assert.equal(sourceAmount(row,'patronage-appointment'),Math.min(24,100-start.stats.cash));
   assert.equal(sourceAmount(row,'patronage-allowance'),0);assert.equal(E.validRun(pending),true);
   let welcome=E.advance(pending);assert.equal(welcome.turn,1);const capital=welcome.stats.cash,appointedPay=welcome.pay;
   for(let stage=0;stage<2;stage++){
    assert.equal(welcome.recruitmentContext.stage,stage);const joined=E.applyChoice(welcome,0),introduced=E.advance(joined);
    assert.equal(joined.stats.cash,capital);assert.equal(introduced.stats.cash,capital);assert.equal(introduced.pay,appointedPay);assert.equal(introduced.turn,1);
    assert.deepEqual(introduced.pip,welcome.pip);assert.equal(sourceAmount(joined.history.at(-1),'patronage-appointment'),0);assert.equal(sourceAmount(joined.history.at(-1),'patronage-allowance'),0);
    assert.equal(E.validRun(joined),true);welcome=introduced;
   }
   assert.equal(welcome.recruitmentContext,null);
  }
  const declined=E.advance(E.applyChoice(start,2));assert.equal(declined.patronage,null);assert.equal(declined.pay,start.pay);assert.equal(sourceAmount(declined.history.at(-1),'patronage-appointment'),0);
 }
});

test('earned formal and absurd applications can succeed or fail for either gender, and only a successful appointment pays benefits',()=>{
 const observed=new Set();
 for(const route of fixture.applications){
  const before=from(route),saved=copy(before),pending=E.applyChoice(before,route.index),row=pending.history.at(-1),success=route.result==='success';
  assert.equal(before.eventId,'patronage-application');assert.equal(before.patronage,null);assert.ok(before.stats.lick>=70&&before.stats.boss>=65);
  assert.deepEqual(before,saved);assert.equal(E.validRun(before),true);assert.equal(E.validRun(pending),true);
  assert.equal(Boolean(pending.patronage),success);assert.equal(pending.pay,success?appointmentPayV67(before,before.pay):before.pay);
  assert.equal(row.pay,pending.pay);assert.equal(sourceAmount(row,'patronage-appointment')>0,success&&before.stats.cash<100);
  assert.equal(sourceAmount(row,'patronage-allowance'),0);assert.equal(E.advance(pending).turn,before.turn);assert.deepEqual(pending.pip,before.pip);
  if(route.index<2)assert.ok(characterAffinity(pending,'rick').lost>characterAffinity(before,'rick').lost,'Rick resents either actual application result');
  observed.add(`${before.characterGender}:${route.index}:${route.result}`);
 }
 for(const gender of ['male','female'])for(const [index,result]of [[0,'success'],[0,'setback'],[1,'success'],[1,'setback'],[2,'cancel']])assert.ok(observed.has(`${gender}:${index}:${result}`));
});

test('surviving a reporting insult still requires explicit acceptance before granting the new special salary or subsidy',()=>{
 const proven=new Set();
 for(const route of fixture.routes.filter(row=>row.kind!=='normal')){
  if(proven.has(route.gender))continue;
  const start=E.enableActivitySchedule(E.createRun(route.roleId,route.seed)),spoken=E.requestVerbal(start,undefined,2);
  if(spoken===start||spoken.verbalContext.outcome==='personnel')continue;
  let decision=E.advance(E.applyChoice(E.advance(spoken),3));
  for(let step=0;step<8&&!decision.completed&&decision.verbalContext?.stage!=='decision';step++)decision=E.advance(E.applyChoice(decision,0));
  if(decision.completed||decision.verbalContext?.stage!=='decision')continue;
  assert.equal(E.validRun(decision),true);assert.equal(decision.patronage,null);assert.equal(decision.pay,start.offerPay);
  const event=E.getEvent(decision),accept=event.choices.findIndex(choice=>choice.sourceIndex===0),decline=event.choices.findIndex(choice=>choice.sourceIndex===2);
  assert.ok(accept>=0&&decline>=0);assert.ok(event.body.includes(`月薪才會調整為${appointmentPayV67(decision,decision.pay)}K`));
  const accepted=E.applyChoice(decision,accept),row=accepted.history.at(-1),introduced=E.advance(accepted);
  assert.ok(accepted.patronage);assert.equal(accepted.pay,appointmentPayV67(decision,decision.pay));assert.equal(row.pay,accepted.pay);
  assert.equal(sourceAmount(row,'patronage-appointment'),Math.min(24,100-decision.stats.cash));assert.equal(E.validRun(accepted),true);
  assert.equal(introduced.recruitmentContext.stage,0);assert.equal(introduced.turn,1);
  assert.deepEqual(E.replayRun(route.roleId,route.seed,accepted.actions),introduced);
  const withdrawn=E.advance(E.applyChoice(decision,decline));assert.equal(withdrawn.patronage,null);assert.equal(withdrawn.pay,start.offerPay);assert.equal(E.validRun(withdrawn),true);
  assert.equal(sourceAmount(withdrawn.history.at(-1),'patronage-appointment'),0);proven.add(route.gender);
 }
 assert.deepEqual([...proven].sort(),['female','male']);
});

test('academic, pay and smalltalk replacements all have three legal choices, keep salary intact and consume no work or PIP count',()=>{
 assert.deepEqual(fixture.scenes.map(row=>row.eventId).sort(),['patronage67-education','patronage67-pay-review','patronage67-smalltalk'].sort());
 for(const route of fixture.scenes){
  const before=from(route),event=E.getEvent(before);assert.ok(before.patronage);assert.equal(event.id,route.eventId);assert.equal(event.choices.length,3);
  for(const index of [0,1,2]){
   const pending=E.applyChoice(before,index),after=E.advance(pending),row=pending.history.at(-1);
   assert.equal(pending.pay,before.pay);assert.equal(after.pay,before.pay);assert.equal(pending.patronage.title,before.patronage.title);
   assert.equal(after.turn,before.turn);assert.deepEqual(after.pip,before.pip);assert.equal(sourceAmount(row,'patronage-appointment'),0);assert.equal(sourceAmount(row,'patronage-allowance'),0);
   assert.equal(E.validRun(pending),true);assert.equal(E.validRun(after),true);assert.equal(E.applyChoice(pending,index),pending,'repeated tapping a settled result is a no-op');
   assert.deepEqual(E.replayRun(route.roleId,route.seed,[...route.beforeActions,{type:'choice',eventId:event.id,index}]),after);
  }
 }
});

test('living allowances follow completed work pairs, never menu, introduction, rest, invitation or duplicate scene navigation',()=>{
 let paid=0,work=0,nonWork=0;
 for(const route of fixture.routes.filter(row=>row.kind!=='normal')){
  const {steps}=walk(route);let completedWork=0;
  for(const {before,pending,after}of steps){
   if(!pending||pending.history.length===before.history.length)continue;
   const row=pending.history.at(-1),credit=sourceAmount(row,'patronage-allowance');
   const actual=!!before.patronage&&['daily','fantasy'].includes(row.kind)&&!row.verbalOutcome&&row.departureOutcome?.completed!==false&&after.turn===before.turn+1;
   if(actual){completedWork++;work++;}else nonWork++;
   const due=actual&&completedWork%2===0;
   if(!due)assert.equal(credit,0,`${route.seed}/${row.eventId} is not a completed work-pair boundary`);
   else assert.ok(credit>=0&&credit<=6,`${route.seed}/${row.eventId} bounded cash credit`);
   if(credit){paid++;assert.ok(due);}
  }
 }
 assert.ok(work>150);assert.ok(nonWork>150);assert.ok(paid>30);
});

test('appointed lives replace personal academic and salary punishment while ordinary employees keep their existing risks',()=>{
 let appointments=0,afterWork=0,ordinary=0;
 for(const route of fixture.routes){
  const run=from(route);
  if(!run.patronage){ordinary+=run.history.filter(row=>['education-scrutiny','education-review','salary-cut','salary-final'].includes(row.eventId)).length;continue;}
  appointments++;
  for(const row of run.history.slice(run.patronage.historyIndex+1)){
   assert.ok(!['education-scrutiny','education-review','salary-cut','salary-final',...PATRONAGE_EXCLUDED_DAILY_IDS_V67].includes(row.eventId),`${run.seed}/${row.eventId}`);
   assert.ok(!(row.breakdown||[]).some(part=>part.source==='pay-cut'),'new pay does not continue carrying the old cut’s daily mood penalty');
   if(['daily','fantasy'].includes(row.kind))afterWork++;
  }
 }
 assert.ok(appointments>=26);assert.ok(afterWork>200);assert.ok(ordinary>10,'ordinary employees still face the original risk');
 // A PIP, dismissal or collapse is not bypassed simply because an appointment
 // exists. The ordinary canonical histories remain replay-validated above.
 assert.ok(fixture.summary.completed===fixture.summary.lives);
});

test('tampering with the salary, subsidy or appointment is rejected, and published r66 lives keep exact frozen results',()=>{
 const route=fixture.routes.find(row=>row.kind==='son'),initial=E.enableActivitySchedule(E.createRun(route.roleId,route.seed)),pending=E.applyChoice(initial,0);
 for(const mutate of [run=>run.pay++,run=>run.patronage.appointedPay++,run=>run.patronage.fromPay++,run=>run.stats.cash=Math.max(0,run.stats.cash-1),run=>run.history[0].breakdown.find(part=>part.source==='patronage-appointment').delta.cash++]){
  const forged=copy(pending);mutate(forged);assert.equal(E.validRun(forged),false);
 }
 assert.equal(fixture.oldExamples.length,3);
 for(const old of fixture.oldExamples){
  const run=from(old);assert.equal(isPatronageBenefitsV67(run),false);assert.equal(E.validRun(run),true);
  assert.equal(createHash('sha256').update(JSON.stringify(run)).digest('hex'),old.sha256);
  assert.ok(!run.history.some(row=>(row.breakdown||[]).some(part=>['patronage-appointment','patronage-allowance'].includes(part.source))));
 }
});
