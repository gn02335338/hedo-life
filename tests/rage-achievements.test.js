import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as achievements from '../dist/achievements.js';
import {createRun,getEvent,applyChoice,advance,requestRage,replayRun,validRun} from '../dist/engine.js';

const {deriveAchievements}=achievements;
const people=['wing','spencer','rick','hope','erich','jenjen','sonny','kind','jack','meimei'];
const fixtures=JSON.parse(readFileSync(new URL('./fixtures/rage-achievement-routes.json',import.meta.url),'utf8'));
const routes=Object.fromEntries(fixtures.routes.map(route=>[route.id,route]));
const copy=value=>JSON.parse(JSON.stringify(value));
const replay=id=>{const route=routes[id];assert.ok(route,`natural proof ${id}`);return replayRun(route.roleId,route.seed,route.actions);};
const relevant=run=>deriveAchievements(run).filter(id=>/^(?:real-hit-|real-first-day$|real-documented$|dream-|rage-(?:imagined|real|legal|defeated|coup)$)/.test(id));
const release=(person,mode)=>copy(replay(`${person}-${mode}`).history.findLast(row=>row.eventId==='rage-release'));

test('natural e21 proofs distinguish the same ten targets in dreams and reality without changing replay state',()=>{
 assert.equal(fixtures.routes.length,26);
 for(const route of fixtures.routes){
  assert.match(route.seed,/^e21-/);
  assert.deepEqual(Object.keys(route).sort(),['id','roleId','seed','actions',...(route.target?['target','mode','origin']:[]),...(route.endingId?['endingId']:[])].sort());
  const run=replayRun(route.roleId,route.seed,route.actions),saved=copy(run),before=copy(run);
  assert.equal(validRun(saved),true,route.id);
  assert.deepEqual(replayRun(saved.roleId,saved.seed,saved.actions),saved,route.id);
  assert.deepEqual(deriveAchievements(saved),deriveAchievements(run),route.id);
  assert.deepEqual(run,before,`${route.id}: deriving never mutates canonical state`);
  if(!route.target)continue;
  const row=run.history.findLast(item=>item.eventId==='rage-release');
  assert.equal(row.speaker,route.target);assert.equal(row.kind,'rage');assert.equal(row.choiceIndex,0);
  assert.equal(row.eventOutcome.result,route.mode==='real'?'真的失控了':'腦內劇場');
  const earned=deriveAchievements(saved);
  if(route.mode==='real'){
   assert.ok(earned.includes(`real-hit-${route.target}`),route.id);
   assert.ok(earned.includes('rage-real'),route.id);
   assert.ok(!earned.includes(`dream-${route.target}`),route.id);
   assert.ok(!earned.includes('rage-imagined'),route.id);
   assert.ok(!earned.includes('dream-catharsis'),route.id);
  }else{
   assert.ok(earned.includes(`dream-${route.target}`),route.id);
   assert.ok(earned.includes('rage-imagined'),route.id);
   assert.ok(earned.includes('dream-catharsis'),route.id);
   assert.ok(!earned.includes(`real-hit-${route.target}`),route.id);
   assert.ok(!earned.includes('rage-real'),route.id);
  }
 }
});

test('onboarding reality and dream badges use the origin of that same resolved Wing attempt',()=>{
 for(const mode of ['real','imagined']){
  const run=replay(`first-day-${mode}`),earned=deriveAchievements(run);
  const yes=mode==='real'?'real-first-day':'dream-first-day',no=mode==='real'?'dream-first-day':'real-first-day';
  assert.ok(earned.includes(yes));assert.ok(!earned.includes(no));
  // Day zero also permits opening the leave dialogue. It is not the reporting-in scene.
  const wrongOrigin=copy(run);wrongOrigin.actions.at(-1).eventId='exit-menu';
  assert.ok(!deriveAchievements(wrongOrigin).includes(yes),'turn zero and a first-day flag do not substitute for onboarding');
 }
 const dream=release('wing','imagined'),actual=release('rick','real');
 const mixed={seed:'e21-mixed-first-day',flags:{rage_first_day:1,rage_target_wing:1,rage_target_rick:1,rage_real:1,rage_imagined:1},
  actions:[{type:'rage',phase:'event',eventId:'onboarding'},{type:'rage',phase:'event',eventId:'job-system-phone-monitor'}],history:[dream,actual]};
 assert.ok(!deriveAchievements(mixed).includes('real-first-day'),'a later real hit cannot turn the onboarding dream into reality');
 assert.ok(deriveAchievements(mixed).includes('dream-first-day'));
});

test('cumulative target and mode flags cannot borrow evidence from another person or attempt',()=>{
 const run={seed:'e21-cross-attempt',flags:Object.fromEntries(['rage_real','rage_imagined','rage_first_day','rage_catharsis','rage_absent','rage_documented',...people.map(person=>`rage_target_${person}`)].map(key=>[key,20])),
  history:[release('wing','real'),release('jack','imagined')],actions:[]};
 const earned=deriveAchievements(run);
 assert.ok(earned.includes('real-hit-wing'));assert.ok(earned.includes('dream-jack'));
 assert.ok(!earned.includes('real-hit-jack'));assert.ok(!earned.includes('dream-wing'));
 assert.deepEqual(earned.filter(id=>id.startsWith('real-hit-')),['real-hit-wing']);
 assert.ok(!earned.includes('real-documented'));
 assert.ok(!earned.includes('dream-absent'));
 assert.deepEqual(relevant({...run,history:[]}),[],'flags and a menu without committed history cannot earn these badges');
 for(const person of people)assert.ok(!earned.includes(`rage-${person}`),'the legacy attempt chapter is never newly earned');
});

test('unresolved, malformed and unrelated history cannot prove a dreamed or real hit',()=>{
 for(const mode of ['real','imagined']){
  const row=release('wing',mode);
  for(const invalid of [
   {...row,choiceIndex:-1},{...row,choiceIndex:1},{...row,choiceIndex:undefined},
   {...row,kind:'daily'},{...row,eventId:'onboarding'},
   {...row,eventOutcome:{label:row.eventOutcome.result}},{...row,eventOutcome:{result:'這次不知道'}},
   {...row,speaker:'not-a-person'}
  ])assert.deepEqual(relevant({history:[invalid],flags:{rage_real:1,rage_imagined:1,rage_target_wing:1}}),[]);
 }
 const fresh=createRun('system',routes['first-day-real'].seed);
 assert.deepEqual(relevant(fresh),[]);
 const pending=requestRage(fresh);
 assert.equal(pending.pending,true,'the button commits the draw before the result is continued');
 assert.ok(deriveAchievements(pending).includes('real-hit-wing'),'a resolved result counts immediately, without waiting for the next scene');
});

test('a Kind dream earns disappearance without granting an actual hit',()=>{
 const dream=deriveAchievements(replay('kind-imagined'));
 assert.ok(dream.includes('dream-kind'));assert.ok(dream.includes('dream-absent'));assert.ok(dream.includes('dream-catharsis'));
 assert.ok(!dream.includes('real-hit-kind'));
 const real=deriveAchievements(replay('kind-real'));
 assert.ok(real.includes('real-hit-kind'));assert.ok(!real.includes('dream-kind'));assert.ok(!real.includes('dream-absent'));
});

test('formal documentation and real aftermath endings require an actual preceding hit',()=>{
 const run=replay('real-documented'),earned=deriveAchievements(run);
 assert.ok(earned.includes('real-documented'));
 const at=run.history.findIndex(row=>row.eventId==='rage-legal');assert.ok(at>=0);
 const before={...run,history:run.history.slice(0,at)};
 assert.ok(!deriveAchievements(before).includes('real-documented'),'opening the formal process is not a resolved decision');
 const unresolved={...run,history:run.history.map(row=>row.eventId==='rage-legal'?{...row,choiceIndex:-1}:row)};
 assert.ok(!deriveAchievements(unresolved).includes('real-documented'));
 const noHit={...run,history:run.history.filter(row=>row.eventId!=='rage-release')};
 assert.ok(!deriveAchievements(noHit).includes('real-documented'),'a legal row alone cannot invent a real hit');
 for(const family of ['legal','defeated','coup']){
  const end=replay(`rage_${family}`),badge=`rage-${family}`;
  assert.equal(end.endingId,routes[`rage_${family}`].endingId);assert.ok(end.completed);assert.ok(deriveAchievements(end).includes(badge));
  assert.ok(!deriveAchievements({...end,completed:false}).includes(badge));
  assert.ok(!deriveAchievements({...end,history:[]}).includes(badge));
  assert.ok(!deriveAchievements({...end,history:[release('wing','imagined')]}).includes(badge));
 }
});

test('e13 cartoon attempts remain valid historical games without becoming proof of actual violence',()=>{
 for(const [index,person]of people.slice(0,8).entries()){
  const run=createRun('system',`e13-achievement-legacy-${person}`),menu=requestRage(run);
  const resolved=advance(applyChoice(menu,index));
  assert.ok(resolved.flags[`rage_target_${person}`]>0);
  assert.equal(validRun(copy(resolved)),true);
  assert.deepEqual(replayRun(resolved.roleId,resolved.seed,resolved.actions),resolved);
  assert.deepEqual(relevant(resolved),[]);
 }
 const legacyIds=achievements.LEGACY_RAGE_ACHIEVEMENTS.map(item=>item.id);
 assert.equal(legacyIds.length,14);
 assert.ok(legacyIds.includes('rage-wing'));assert.ok(legacyIds.includes('rage-first-day'));assert.ok(legacyIds.includes('rage-documented'));
 assert.ok(legacyIds.every(id=>!achievements.ACHIEVEMENTS.some(item=>item.id===id)),'old memorabilia never occupies a new reality badge ID');
});
