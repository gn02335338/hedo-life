import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ROLES} from '../dist/roles.js';
import {ENDINGS} from '../dist/endings.js';
import {createRun,getEvent,requestVerbal,applyChoice,advance,replayRun,validRun,requestExit,requestBreak,requestCareer,requestRaise,requestRage,requestSalaryAdvice} from '../dist/engine.js';
import {replayRoute} from './find-routes-v3.mjs';
import {COMPANY_ENDING_IDS_V32,COMPANY_FINALE_LABELS_V32,companyEligibleV32} from '../dist/company-v32.js';
import {VERBAL_ENDING_IDS_V32,VERBAL_FINALE_LABELS_V32,getVerbalAftermathV32,verbalSeverityV32} from '../dist/verbal-outcomes-v32.js';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/v32-routes.json',import.meta.url)));
const familyOf=route=>route.ending.slice(0,-route.roleId.length-1);

test('all 286 current-cohort ending resolutions replay from natural starts through JSON save boundaries',()=>{
 assert.equal(fixture.routes.length,286);
 for(const role of ROLES){
  const roleRoutes=fixture.routes.filter(route=>route.roleId===role.id);
  assert.equal(roleRoutes.length,22,role.id);
  assert.deepEqual(new Set(roleRoutes.map(familyOf)),new Set([...VERBAL_ENDING_IDS_V32,...COMPANY_ENDING_IDS_V32]));
 }
 let checkpoints=0;
 for(const route of fixture.routes){
  assert.match(route.seed,/^e32-/);
  const run=replayRoute(route,state=>{checkpoints++;assert.equal(validRun(state),true,`${route.ending}: ${state.eventId}`);});
  assert.equal(run.completed,true);assert.equal(run.endingId,route.ending);
  assert.deepEqual(replayRun(route.roleId,route.seed,route.actions),run);
  const family=familyOf(route),last=run.history.at(-1);
  if(VERBAL_ENDING_IDS_V32.includes(family)){
   const spoken=run.history.findLast(row=>row.verbalOutcome?.version===2);
   assert.ok(spoken);assert.equal(last.speaker,spoken.speaker);assert.equal(last.eventId,'verbal-v32-aftermath');
   assert.ok(last.choiceIndex<=2);assert.equal(last.eventOutcome.label,'這場口角接著怎麼收尾');assert.equal(last.eventOutcome.result,VERBAL_FINALE_LABELS_V32[family]);
   assert.equal(run.rageContext,null);assert.equal(run.verbalContext,null);
  }else{
   assert.equal(last.kind,'company');assert.match(last.eventId,/^company-v32-/);
   assert.equal(last.eventOutcome.label,'計畫落地之後');assert.equal(last.eventOutcome.result,COMPANY_FINALE_LABELS_V32[family]);
   assert.equal(run.companyContext,null);assert.ok(run.rank<=5,'company story must not require a C-level promotion');
  }
 }
 assert.ok(checkpoints>2000);
});

test('new optional company plan blocks nested shortcuts and rejects forged plan state',()=>{
 const route=fixture.routes.find(route=>familyOf(route)==='google_board');
 const position=route.actions.findIndex(action=>action.eventId==='company-v32-buyer');
 const run=replayRun(route.roleId,route.seed,route.actions.slice(0,position));
 assert.equal(run.eventId,'company-v32-buyer');assert.equal(companyEligibleV32(run),true);assert.equal(validRun(run),true);
 for(const request of [requestExit,requestBreak,requestCareer,requestRaise,requestRage,requestSalaryAdvice])assert.equal(request(run),run);
 assert.equal(requestVerbal(run,undefined,2),run);
 assert.equal(validRun({...run,companyContext:{...run.companyContext,route:'market'}}),false);
 assert.equal(validRun({...run,companyContext:{...run.companyContext,guaranteed:true}}),false);
 assert.equal(validRun({...run,companyContext:null}),false);
 const back=advance(applyChoice(run,getEvent(run).choices.length-1));
 assert.equal(back.companyContext,null);assert.equal(validRun(back),true);
 assert.deepEqual(replayRun(back.roleId,back.seed,back.actions),back);
 // Browsing another plan is a menu operation, not another workday or salary.
 for(const index of [0,1,2]){
  const pending=applyChoice(back,index),menu=advance(pending);
  assert.deepEqual(pending.stats,back.stats);assert.equal(pending.rng,back.rng);
  assert.equal(menu.turn,back.turn);assert.equal(menu.pip?.remaining,back.pip?.remaining);
  const again=advance(applyChoice(menu,getEvent(menu).choices.length-1));
  assert.deepEqual(again.stats,back.stats);assert.equal(again.rng,back.rng);
  assert.equal(validRun(again),true);assert.deepEqual(replayRun(again.roleId,again.seed,again.actions),again);
 }
});

test('timing and actual reaction change severity without exposing an ending before a response',()=>{
 const source=createRun('sales','e32-severity-review');
 const spoken=advance(requestVerbal(source,undefined,2));
 assert.equal(spoken.eventId,'verbal-v32-aftermath');
 const mild={...spoken,flags:{...spoken.flags,post_pip_tolerance:0},verbalContext:{...spoken.verbalContext,outcome:'ignored',phase:'event'}};
 const severe={...mild,verbalContext:{...mild.verbalContext,outcome:'legal'}};
 const result={...mild,verbalContext:{...mild.verbalContext,phase:'result'}};
 assert.equal(verbalSeverityV32(mild),1);assert.equal(verbalSeverityV32(result),2);assert.equal(verbalSeverityV32(severe),3);
 assert.ok(getVerbalAftermathV32(severe).choices[0].draw.outcomes[0].weight<getVerbalAftermathV32(mild).choices[0].draw.outcomes[0].weight);
 const shown=getEvent(spoken);
 for(const choice of shown.choices){assert.equal(choice.detail,'');assert.doesNotMatch(choice.text,/\d+%|機率|結局：/);}
});

test('new company and verbal cards cannot be validated as old-cohort completed lives',()=>{
 assert.equal(Object.hasOwn(createRun('sales','e31-existing-life'),'companyContext'),false);
 const newEnding=ENDINGS.find(ending=>ending.family==='google_board'&&ending.roleId==='sales');
 assert.equal(newEnding.minRules,32);
 const old=createRun('sales','e31-existing-life');
 assert.equal(validRun({...old,eventId:null,completed:true,endingId:newEnding.id}),false);
});
