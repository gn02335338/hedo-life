import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ROLES,ROLE_MAP} from '../dist/roles.js';
import {BACKOFFICE_ROLES_V28,BACKOFFICE_LADDERS_V28,BACKOFFICE_ROLE_IDS_V28} from '../dist/roles-v28.js';
import {EVENTS} from '../dist/events.js';
import {ENDINGS,FAMILIES} from '../dist/endings.js';
import {SOURCES} from '../dist/public-sources.js';
import {createRun,getEvent,applyChoice,advance,replayRun,validRun,jobTitle,STAT_KEYS,getRageTargets,requestRage,canRequestRage} from '../dist/engine.js';
import {careerMaxRank,careerReadiness} from '../dist/career-api.js';
import {deriveAchievements} from '../dist/achievements.js';
import {replayRoute} from './find-routes-v3.mjs';

const copy=value=>JSON.parse(JSON.stringify(value));
const fixture=()=>JSON.parse(readFileSync(new URL('./fixtures/backoffice-routes-v28.json',import.meta.url),'utf8'));
const events=()=>EVENTS.filter(event=>event.minRules===28);

test('four backoffice occupations have distinct offers and full eight-rank ladders, available only from e28',()=>{
 assert.equal(ROLES.length,13);
 assert.deepEqual(BACKOFFICE_ROLE_IDS_V28,['finance','accounting','hr','admin']);
 assert.deepEqual(BACKOFFICE_ROLES_V28.map(role=>role.name),['財務專員','會計專員','人資專員','行政專員']);
 for(const role of BACKOFFICE_ROLES_V28){
  assert.equal(role.minRules,28);assert.equal(BACKOFFICE_LADDERS_V28[role.id].length,8);
  assert.equal(new Set(BACKOFFICE_LADDERS_V28[role.id]).size,8);
  for(let index=0;index<80;index++){
   const run=createRun(role.id,`e28-offer-${index}`),before=copy(run);
   assert.equal(run.roleId,role.id);assert.equal(careerMaxRank(run),7);
   assert.ok(run.offerPay>=role.payRange[0]&&run.offerPay<=role.payRange[1]);
   assert.ok(BACKOFFICE_ROLE_IDS_V28.includes(run.actualRoleId));
   assert.equal(jobTitle(run),BACKOFFICE_LADDERS_V28[run.actualRoleId][run.rank]);
   assert.ok(run.stats.skill+run.stats.slack+run.stats.lick<=180);
   assert.equal(validRun(copy(run)),true);assert.deepEqual(run,before);
   assert.equal(careerReadiness(run).ready,false,'a first-day title never permits an immediate promotion');
  }
  for(const seed of ['unversioned','e17-no-new-role','e26-no-new-role','e27-no-new-role'])assert.throws(()=>createRun(role.id,seed),/role|職業/i);
 }
 const old=createRun('system','e27-forged-new-occupation');
 for(const roleId of BACKOFFICE_ROLE_IDS_V28){
  assert.equal(validRun({...old,roleId}),false);
  assert.equal(validRun({...old,actualRoleId:roleId}),false);
 }
});

test('HR and admin can be reassigned in either direction while in-service dual duties remain story choices',()=>{
 for(const [roleId,target]of [['hr','admin'],['admin','hr']]){
  const seen=new Set();
  for(let index=0;index<200;index++){
   const run=createRun(roleId,`e28-dual-entry-${index}`);seen.add(`${run.actualRoleId}/${run.assignment}`);
   assert.equal(validRun(copy(run)),true);
  }
  assert.ok(seen.has(`${target}/swapped`));assert.ok(seen.has(`${roleId}/honest`));assert.ok(seen.has(`${roleId}/assistant`));
 }
 const hr=events().filter(event=>event.roles?.includes('hr'));
 const admin=events().filter(event=>event.roles?.includes('admin'));
 assert.ok(hr.some(event=>/咖啡/.test(event.body+event.title)),'HR has a coffee interruption');
 assert.ok(hr.some(event=>/行政/.test(event.body+event.title)),'HR also faces administrative work');
 assert.ok(admin.some(event=>/人資|招募|面試/.test(event.body+event.title)),'administration also faces personnel work');
});

test('32 original role-specific scenes keep choice outcomes hidden and give each occupation eight different duties',()=>{
 assert.equal(events().length,32);assert.equal(EVENTS.length,450);
 for(const roleId of BACKOFFICE_ROLE_IDS_V28)assert.equal(events().filter(event=>event.roles?.[0]===roleId).length,8);
 for(const event of events()){
  assert.equal(event.roles.length,1);assert.ok(ROLE_MAP[event.roles[0]]);assert.equal(event.choices.length,3);
  assert.ok(event.sourceIds.length&&event.sourceIds.every(id=>SOURCES[id]));
  assert.ok(event.choices.some(choice=>choice.wild===true),event.id);
  for(const choice of event.choices){
   assert.equal(choice.detail,'');assert.ok(choice.text.length>5&&choice.result.length>15);
   assert.doesNotMatch(choice.text,/成功率|機率|[%％]|[+-]\d+/);
   assert.ok(Object.entries(choice.delta).every(([key,value])=>STAT_KEYS.includes(key)&&Number.isInteger(value)));
  }
 }
});

test('all 96 backoffice responses have natural save-safe histories, actual-role routing and complete continuations',()=>{
 const {routes,eventCount,choiceCount}=fixture(),choices=routes.filter(route=>!route.id.startsWith('role-'));
 assert.equal(eventCount,32);assert.equal(choiceCount,96);assert.equal(choices.length,96);
 assert.deepEqual(choices.map(route=>route.id).sort(),events().flatMap(event=>event.choices.map((choice,index)=>`${event.id}-choice-${index}`)).sort());
 for(const route of choices){
  assert.match(route.seed,/^e28-/);
  const before=replayRun(route.roleId,route.seed,route.actions.slice(0,-1)),event=getEvent(before);
  assert.equal(event.id,route.eventId);assert.ok(event.roles.includes(before.actualRoleId));assert.equal(before.actualRoleId,route.actualRoleId);
  const pending=applyChoice(before,route.index),row=pending.history.at(-1);
  assert.equal(row.eventId,event.id);assert.equal(row.choiceIndex,route.index);assert.ok(row.result.startsWith(event.choices[route.index].result));
  assert.equal(pending.roleId,before.roleId);assert.equal(pending.actualRoleId,before.actualRoleId,'extra duties do not silently rewrite the main job');
  const resolved=advance(pending),replayed=replayRoute({...route,ending:route.id},state=>assert.equal(validRun(state),true,`${route.id}/${state.eventId}`));
  assert.deepEqual(replayed,resolved);assert.deepEqual(replayRun(route.roleId,route.seed,route.actions),resolved);
  assert.ok(resolved.stats.skill+resolved.stats.slack+resolved.stats.lick<=180);
  const done=replayRun(route.roleId,route.seed,route.completionActions);
  assert.equal(done.completed,true);assert.equal(done.endingId,route.endingId);assert.equal(validRun(copy(done)),true);
 }
});

test('the 168 new role endings append after all original377 and each family has an attainable e28 proof',()=>{
 const old=JSON.parse(readFileSync(new URL('./fixtures/legacy-e27-routes.json',import.meta.url),'utf8'));
 assert.equal(ENDINGS.length,545);assert.equal(FAMILIES.length,42);
 assert.deepEqual(ENDINGS.slice(0,377).map(ending=>ending.id),old.map(route=>route.ending));
 const appended=ENDINGS.slice(377);assert.equal(appended.length,168);
 assert.ok(appended.every(ending=>ending.minRules===28&&BACKOFFICE_ROLE_IDS_V28.includes(ending.roleId)));
 const report=JSON.parse(readFileSync(new URL('../research/reachability-v3.json',import.meta.url),'utf8'));
 assert.equal(report.complete,true);assert.equal(report.found,545);assert.deepEqual(report.missing,[]);
 for(const roleId of BACKOFFICE_ROLE_IDS_V28){
  const routes=report.routes.filter(route=>route.roleId===roleId);assert.equal(routes.length,42);
  assert.deepEqual(new Set(routes.map(route=>route.ending.slice(0,route.ending.lastIndexOf('-')))),new Set(FAMILIES.map(family=>family.id)));
  for(const route of routes){
   const run=replayRun(roleId,route.seed,route.actions);assert.equal(run.endingId,route.ending);assert.equal(validRun(copy(run)),true);
   assert.ok(deriveAchievements(run).includes('first-ending'));
  }
 }
});

const backofficeGroups={
 'accounting28-final-form':['sophie','sonny'], 'hr28-coffee-jd':['wing','hope'],
 'hr28-onboarding-notice':['wing','sonny'], 'hr28-attendance-access':['jack','meimei'],
 'admin28-extension-grandeur':['wing','jenjen','erich','sonny'],
 'admin28-supply-minimum':['wing','jenjen'], 'admin28-seat-key':['sophie','sonny'],
};
test('new multi-person conversations keep each co-present target selectable in both story and result phases',()=>{
 for(const [eventId,targets]of Object.entries(backofficeGroups)){
  const route=fixture().routes.find(route=>route.eventId===eventId&&route.index===0&&!route.id.startsWith('role-'));
  assert.ok(route,eventId);const before=replayRun(route.roleId,route.seed,route.actions.slice(0,-1));
  const pending=applyChoice(before,0);
  for(const run of [before,pending]){
   assert.equal(canRequestRage(run),true,eventId);assert.deepEqual(getRageTargets(run),targets,eventId);
   for(const target of targets){
    const attempt=requestRage(run,target);assert.notEqual(attempt,run,eventId);
    assert.equal(attempt.rageContext.target,target);assert.equal(attempt.turn,run.turn);
    assert.equal(attempt.history.at(-1).speaker,target);
    assert.equal(validRun(copy(attempt)),true);
    assert.deepEqual(replayRun(attempt.roleId,attempt.seed,attempt.actions),advance(attempt));
   }
   assert.equal(requestRage(run,'sam'),run,'mentioned or absent people are not targets');
  }
 }
});
