import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ROLES} from '../dist/roles.js';
import {ENDINGS} from '../dist/endings.js';
import {COMPANY_ENDING_IDS_V32} from '../dist/company-v32.js';
import {COMPANY_ENDING_IDS_V39,companyFinaleEmploymentV39} from '../dist/company-v39.js';
import {COMPANY_FAMILIES_V39,COMPANY_ENDINGS_V39} from '../dist/endings-company-v39.js';
import {getEvent,replayRun,validRun,applyChoice,advance} from '../dist/engine.js';
import {replayRoute} from './find-routes-v3.mjs';

const fixture=JSON.parse(await readFile(new URL('./fixtures/company-e39-routes.json',import.meta.url),'utf8'));
const clone=value=>JSON.parse(JSON.stringify(value));
const menu=route=>replayRun(route.roleId,route.seed,route.actions.slice(0,-1));

test('six new company families append 78 occupation-specific cards without replacing the original 805 IDs',()=>{
 assert.equal(ENDINGS.length,883);assert.equal(COMPANY_ENDINGS_V39.length,ROLES.length*6);assert.equal(COMPANY_FAMILIES_V39.length,6);
 assert.equal(new Set(ENDINGS.map(ending=>ending.id)).size,ENDINGS.length);
 assert.deepEqual(ENDINGS.slice(-78),COMPANY_ENDINGS_V39);
 for(const family of COMPANY_ENDING_IDS_V39){
  const endings=COMPANY_ENDINGS_V39.filter(ending=>ending.family===family);
  assert.deepEqual(new Set(endings.map(ending=>ending.roleId)),new Set(ROLES.map(role=>role.id)));
  assert.ok(endings.every(ending=>ending.minRules===39&&ending.body.length>150));assert.ok(companyFinaleEmploymentV39(family));
 }
});

test('all thirteen occupations can naturally reach the prior ten company futures and all six non-success or operating futures',()=>{
 assert.deepEqual(fixture.missing,[]);assert.equal(fixture.routes.length,ROLES.length*16);
 for(const role of ROLES){
  const routes=fixture.routes.filter(route=>route.roleId===role.id);
  assert.deepEqual(new Set(routes.map(route=>route.target)),new Set([...COMPANY_ENDING_IDS_V32,...COMPANY_ENDING_IDS_V39]));
 }
 let boundaries=0;
 for(const route of fixture.routes){
  assert.match(route.seed,/^e39-/);
  const run=replayRoute(route,state=>{boundaries++;assert.equal(validRun(clone(state)),true,`${route.ending}: ${state.eventId}`);});
  assert.equal(run.completed,true);assert.equal(run.endingId,route.ending);assert.equal(run.chapterContext,null);
  assert.deepEqual(run,replayRun(route.roleId,route.seed,route.actions));
  assert.equal(run.flags.departure38_voluntary,undefined,'a company future does not invent a voluntary resignation');
  if(COMPANY_ENDING_IDS_V39.includes(route.target))assert.equal(run.flags[`company39_finish_${route.target}`],1);
 }
 assert.ok(boundaries>5000,'the proof includes actual source and pending-save boundaries');
});

test('market, buyer and Vietnam proposals all retain both prior futures and seeded operational risks; Vietnam is never a guaranteed listing',()=>{
 const visited=new Set();
 for(const route of fixture.routes){
  const run=menu(route),event=getEvent(run);if(visited.has(event.id))continue;visited.add(event.id);
  const before=JSON.stringify(run);
  for(const choice of event.choices.filter(choice=>choice.draw)){
   const total=choice.draw.outcomes.reduce((sum,outcome)=>sum+outcome.weight,0);
   const risks=choice.draw.outcomes.filter(outcome=>COMPANY_ENDING_IDS_V39.includes(outcome.effect));
   const riskMass=risks.reduce((sum,outcome)=>sum+outcome.weight,0)/total;
   assert.equal(risks.length,6);assert.ok(risks.every(outcome=>outcome.weight>0));assert.ok(riskMass>=.2&&riskMass<=.55);
   assert.ok(choice.draw.outcomes.some(outcome=>!COMPANY_ENDING_IDS_V39.includes(outcome.effect)&&outcome.weight>0),'the old company direction remains possible');
   assert.doesNotMatch(choice.text,/\d+%|機率|結局：/);
   for(const outcome of choice.draw.outcomes)assert.ok(!choice.text.includes(outcome.label),'selection text never reveals the drawn outcome');
  }
  assert.equal(JSON.stringify(run),before,'reading proposals does not draw or reroll');
 }
 assert.deepEqual(visited,new Set(['company-v32-market','company-v32-buyer','company-v32-vietnam']));
});

test('one committed company proposal draws once, adds no workday, and finishes without a second confirmation draw',()=>{
 for(const family of COMPANY_ENDING_IDS_V39){
  const route=fixture.routes.find(route=>route.target===family),run=menu(route),action=route.actions.at(-1),before=clone(run);
  const pending=applyChoice(run,action.index);assert.equal(pending.completed,false);assert.equal(pending.pending,true);assert.equal(pending.pendingFamily,family);
  assert.notEqual(pending.rng,before.rng);assert.equal(pending.turn,before.turn);assert.deepEqual(pending.stats,before.stats);
  assert.equal(validRun(clone(pending)),true);const finished=advance(pending);
  assert.equal(finished.rng,pending.rng);assert.equal(finished.turn,before.turn);assert.equal(finished.endingId,route.ending);
  assert.equal(advance(finished),finished);
 }
});

test('company failure metadata distinguishes company termination, retained employment and unpaid wages',()=>{
 for(const family of ['company_closed','company_taiwan_exit','company_shell_brand'])assert.equal(companyFinaleEmploymentV39(family).kind,'company-exit');
 for(const family of ['company_stagnation','company_restructured'])assert.equal(companyFinaleEmploymentV39(family).kind,'employed');
 const arrears=companyFinaleEmploymentV39('company_wage_arrears');assert.equal(arrears.kind,'wage-dispute');assert.match(arrears.label,/仍在職/);
 assert.equal(companyFinaleEmploymentV39('unplayed-client-family'),null);
 const record=companyFinaleEmploymentV39('company_closed');record.kind='voluntary';assert.equal(companyFinaleEmploymentV39('company_closed').kind,'company-exit','callers cannot mutate the canonical projection');
 const crossBorder=COMPANY_ENDINGS_V39.filter(ending=>ending.family==='company_taiwan_exit');
 assert.ok(crossBorder.every(ending=>ending.body.includes('公司的')&&ending.body.includes('越南同事沒有替高層做這個決定')));
});
