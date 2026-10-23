import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ACHIEVEMENTS,ACHIEVEMENT_MAP,deriveAchievements} from '../dist/achievements.js';
import {ACHIEVEMENTS_V48,deriveAchievementsV48} from '../dist/achievements-v48.js';
import {createRun,replayRun,validRun} from '../dist/engine.js';

const {routes}=JSON.parse(readFileSync(new URL('./fixtures/achievement-milestones-v48.json',import.meta.url),'utf8'));
const copy=value=>JSON.parse(JSON.stringify(value));
const ids=ACHIEVEMENTS_V48.map(item=>item.id);
const newIds=new Set(ids);
const earned=run=>deriveAchievements(run).filter(id=>newIds.has(id));
const runs=routes.map(route=>({route,run:replayRun(route.roleId,route.seed,route.actions)}));

test('sixty illustrated milestones append after every published achievement ID',()=>{
 assert.equal(ACHIEVEMENTS_V48.length,60);
 assert.equal(new Set(ids).size,60);
 assert.deepEqual(ACHIEVEMENTS.slice(149,209),ACHIEVEMENTS_V48);
 const artwork=new Set();
 for(const item of ACHIEVEMENTS_V48){
  assert.equal(ACHIEVEMENT_MAP[item.id],item);
  assert.match(item.id,/^[a-z]+(?:-[a-z]+)+$/);
  assert.ok(item.title.trim().length>=4);
  assert.ok(item.description.trim().length>=20);
  assert.equal(item.image,`./assets/achievements/${item.id}.svg`);
  const svg=readFileSync(new URL(`../dist/${item.image}`,import.meta.url),'utf8');
  assert.match(svg,/<svg[^>]+viewBox="0 0 240 200"/);
  assert.match(svg,/<title id="[^"]+">[^<]+<\/title>/);
  assert.match(svg,/<desc id="[^"]+">[^<]+<\/desc>/);
  assert.match(svg,/role="img" aria-labelledby="[^"]+"/);
  assert.doesNotMatch(svg,/<(?:script|foreignObject|image)\b|\bon\w+=|javascript:|(?:href|src)=["']https?:\/\//i);
  artwork.add(svg);
 }
 assert.equal(artwork.size,60);
});

test('all sixty new goals have canonical natural actions, valid saves and identical browser/server projections',()=>{
 const covered=new Set();
 for(const {route,run} of runs){
  assert.match(route.seed,/^e39-/);
  assert.ok(route.actions.length>0&&route.actions.length<=300);
  const saved=copy(run),before=JSON.stringify(saved);
  assert.equal(validRun(saved),true,route.id||route.seed);
  assert.deepEqual(deriveAchievementsV48(saved),route.expectedAchievements,route.id||route.seed);
  assert.deepEqual(earned(saved),route.expectedAchievements);
  assert.equal(JSON.stringify(saved),before,'deriving a badge never changes the canonical life');
  assert.deepEqual(replayRun(saved.roleId,saved.seed,saved.actions),saved);
  route.expectedAchievements.forEach(id=>covered.add(id));
 }
 assert.deepEqual([...covered].sort(),[...ids].sort());
});

test('menus, forged lists, broad counters and ending names do not grant expanded badges',()=>{
 for(const value of [null,undefined,{},[],{seed:'e39-forged',achievements:ids,history:[],flags:{verbal_count:99,rage_real:99,rage_imagined:99},completed:true,endingId:'rage_truce-system'}])assert.deepEqual(deriveAchievementsV48(value),[]);
 const initial=createRun('system','e39-new-milestones');
 assert.deepEqual(deriveAchievementsV48(initial),[]);
 for(const {run} of runs){
  assert.deepEqual(deriveAchievementsV48({...run,history:[],achievements:ids}),[]);
  assert.deepEqual(deriveAchievementsV48({...run,seed:run.seed.replace(/^e39-/,'e38-')}),[],'historical cohorts retain their published awards');
  assert.deepEqual(deriveAchievementsV48({...run,history:run.history.map(row=>({...row,choiceIndex:-1}))}),[],'uncommitted rows are not evidence');
 }
});

test('checking achievements at saved action boundaries cannot change subsequent draws or replay',()=>{
 for(const {route,run} of runs){
  for(const length of [...new Set([1,Math.floor(route.actions.length/2),route.actions.length-1])].filter(length=>length>0)){
   const prefix=replayRun(route.roleId,route.seed,route.actions.slice(0,length)),saved=copy(prefix),before=JSON.stringify(saved);
   assert.equal(validRun(saved),true);
   assert.deepEqual(deriveAchievementsV48(saved),deriveAchievementsV48(copy(saved)));
   assert.equal(JSON.stringify(saved),before);
  }
  assert.deepEqual(replayRun(route.roleId,route.seed,route.actions),run);
 }
});

test('a dreamed attempt cannot stand in for an actual hit, and survival requires later committed work',()=>{
 const actualIds=ACHIEVEMENTS_V48.filter(item=>item.mode==='real').map(item=>item.id);
 const dreamIds=ACHIEVEMENTS_V48.filter(item=>item.mode==='imagined').map(item=>item.id);
 const survivalIds=['verbal-still-here-three','verbal-still-here-five','verbal-still-here-eight',...actualIds];
 for(const {run}of runs){
  const dreamsOnly={...run,history:run.history.map(row=>row.eventId==='rage-release'?{...row,eventOutcome:{...row.eventOutcome,result:'腦內劇場'}}:row)};
  assert.ok(actualIds.every(id=>!deriveAchievementsV48(dreamsOnly).includes(id)));
  const realOnly={...run,history:run.history.map(row=>row.eventId==='rage-release'?{...row,eventOutcome:{...row.eventOutcome,result:'真的失控了'}}:row)};
  assert.ok(dreamIds.every(id=>!deriveAchievementsV48(realOnly).includes(id)));
  const noWork={...run,completed:false,history:run.history.filter(row=>!['daily','fantasy'].includes(row.kind)||row.verbalOutcome)};
  assert.ok(survivalIds.every(id=>!deriveAchievementsV48(noWork).includes(id)),'an unresolved open life is not a safe return to work');
 }
});
