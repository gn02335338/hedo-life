import test from 'node:test';
import assert from 'node:assert/strict';
import {ROLES} from '../dist/roles.js';
import {createRun,getEvent,requestVerbal,canRequestVerbal,applyChoice,advance,validRun,replayRun} from '../dist/engine.js';
import {getVerbalAftermathV32,verbalSeverityV32} from '../dist/verbal-outcomes-v32.js';
import {getVerbalAftermathV33} from '../dist/verbal-outcomes-v33.js';

const spoken=source=>advance(requestVerbal(source,undefined,2));
const finishChance=choice=>{
 const outcomes=choice.draw.outcomes,total=outcomes.reduce((sum,outcome)=>sum+outcome.weight,0);
 return outcomes.filter(outcome=>outcome.effect!=='verbalV32Continue').reduce((sum,outcome)=>sum+outcome.weight,0)/total;
};
const withdrawn=run=>run.verbalContext.eventId==='onboarding'&&run.verbalContext.phase==='event'&&run.verbalContext.outcome==='personnel';

test('e33 replies keep rare target endings while ordinary continuations grow risk with actual severity',()=>{
 const severities=new Map();
 for(let i=0;i<300&&severities.size<3;i++){
  const run=spoken(createRun('sales',`e33-verbal-weight-${i}`));
  assert.equal(validRun(run),true);
  if(!withdrawn(run))severities.set(verbalSeverityV32(run),run);
 }
 assert.equal(severities.size,3,'natural initial reactions cover all severities');
 const rates=[[.04,.07,.12],[.18,.30,.45],[.08,.13,.22]];
 for(const [severity,run]of severities){
  const original=JSON.stringify(getVerbalAftermathV32(run)),event=getVerbalAftermathV33(run);
  assert.equal(JSON.stringify(getVerbalAftermathV32(run)),original,'frozen e32 event is not mutated');
  assert.equal(event.id,'verbal-v32-aftermath');assert.equal(event.choices.length,4);
  for(let index=0;index<3;index++){
   const choice=event.choices[index];assert.equal(finishChance(choice),rates[index][severity-1]);
   assert.ok(choice.draw.outcomes.some(outcome=>outcome.effect==='verbalV32Continue'&&outcome.weight>0));
   assert.ok(choice.draw.outcomes.some(outcome=>outcome.effect==='verbal_onboarding'&&outcome.weight>0),'dedicated finale remains reachable');
   assert.equal(choice.detail,'');assert.doesNotMatch(choice.text,/[0-9]+%|結局：|機率/);
   const continuation=choice.draw.outcomes.at(-1);assert.deepEqual(continuation.flags,[]);assert.deepEqual(continuation.delta,{});
  }
  assert.equal(event.choices[3].effect,'verbalV32Continue');assert.equal(event.choices[3].draw,undefined);
 }
});

test('a job already withdrawn by the revealed reaction is not silently restored by a calm reply',()=>{
 let run;
 for(let i=0;i<100;i++){
  const candidate=spoken(createRun('sales',`e33-verbal-withdrawn-${i}`));
  if(withdrawn(candidate)){run=candidate;break;}
 }
 assert.ok(run);const event=getEvent(run);
 assert.match(event.body,/任用已經撤回/);
 for(const index of [0,1,2]){
  assert.equal(finishChance(event.choices[index]),1);
  const done=advance(applyChoice(run,index));
  assert.equal(done.completed,true);assert.equal(done.endingId,'verbal_onboarding-sales');
  assert.equal(validRun(done),true);assert.deepEqual(replayRun(done.roleId,done.seed,done.actions),done);
 }
 const done=advance(applyChoice(run,3));assert.equal(done.completed,true);assert.equal(done.endingId,'layoff-sales');
});

test('natural onboarding and daily replies usually continue; calming down does not become a guaranteed life ending',()=>{
 const sample={onboarding:0,onboardingContinued:0,nonWithdrawn:0,nonWithdrawnContinued:0,work:0,workContinued:0,result:0,resultContinued:0,rareFinales:0};
 for(const role of ROLES)for(let i=0;i<30;i++){
  const source=createRun(role.id,`e33-verbal-player-${role.id}-${i}`),after=spoken(source),calm=advance(applyChoice(after,0));
  sample.onboarding++;sample.onboardingContinued+=Number(!calm.completed);
  if(!withdrawn(after)){sample.nonWithdrawn++;sample.nonWithdrawnContinued+=Number(!calm.completed);}
  sample.rareFinales+=Number(Boolean(calm.endingId?.startsWith('verbal_')));
  assert.equal(validRun(calm),true);
  if(i===0)assert.deepEqual(replayRun(calm.roleId,calm.seed,calm.actions),calm);
  // A different, ordinary life prefix supplies actual work and a committed
  // result. No edited stats, flags, source events or RNG supply the samples.
  let work=advance(applyChoice(source,0));
  for(let step=0;step<14&&!work.completed&&!['daily','fantasy'].includes(getEvent(work).kind);step++)work=advance(applyChoice(work,0));
  if(work.completed||!['daily','fantasy'].includes(getEvent(work).kind))continue;
  const workReply=spoken(work);if(workReply.completed)continue;
  const workAfter=advance(applyChoice(workReply,0));sample.work++;sample.workContinued+=Number(!workAfter.completed);
  assert.equal(validRun(workAfter),true);
  const result=applyChoice(work,0);if(!canRequestVerbal(result))continue;
  const resultReply=spoken(result);if(resultReply.completed)continue;
  const resultAfter=advance(applyChoice(resultReply,0));sample.result++;sample.resultContinued+=Number(!resultAfter.completed);
  assert.equal(validRun(resultAfter),true);
 }
 assert.equal(sample.onboarding,390);
 assert.ok(sample.onboardingContinued/sample.onboarding>.60,JSON.stringify(sample));
 assert.ok(sample.nonWithdrawnContinued/sample.nonWithdrawn>.83,JSON.stringify(sample));
 assert.ok(sample.work>=300&&sample.workContinued/sample.work>.83,JSON.stringify(sample));
 assert.ok(sample.result>=300&&sample.resultContinued/sample.result>.83,JSON.stringify(sample));
 assert.ok(sample.rareFinales>0,'rare illustrated finales remain naturally reachable');
});
