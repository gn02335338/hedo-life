import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {replayRoute} from './find-routes-v3.mjs';
import {validRun} from '../dist/engine.js';
import {deriveAchievements} from '../dist/achievements.js';
import {deriveCharacterStats} from '../dist/character-stats.js';
import {assertFrozenCharacterStats} from './character-compat.mjs';
const hash=state=>createHash('sha256').update(JSON.stringify(state)).digest('hex');

test('published e36 saves retain all 17860 exact boundaries and original sixteen character histories when professor is appended',()=>{
 const fixture=JSON.parse(readFileSync(new URL('./fixtures/legacy-e36-routes.json',import.meta.url)));
 assert.equal(fixture.sourceCommit,'6c78ce97a167081153f9316b8e0845668fd3cae6');
 assert.equal(fixture.characterIds.length,16);assert.equal(fixture.routes.length,474);
 assert.equal(fixture.routes.filter(route=>route.kind==='ending').length,286);
 assert.equal(new Set(fixture.routes.map(route=>route.roleId)).size,13);
 let count=0,pending=0,meals=0,reactions=0,interruptions=0;
 for(const route of fixture.routes){
  assert.match(route.seed,/^e36-/);const checkpoints=[];
  const run=replayRoute(route,state=>{
   assert.equal(validRun(state),true,`${route.id}/${state.eventId}`);checkpoints.push(hash(state));
   pending+=Number(Boolean(state.pending));meals+=Number(Boolean(state.mealContext));
   reactions+=Number(state.history.some(row=>row.mealOutcome));interruptions+=Number(Boolean(state.rageContext||state.verbalContext));
  });
  assert.deepEqual(checkpoints,route.checkpoints,route.id);assert.equal(hash(run),route.stateSha256,route.id);
  assert.equal(run.completed,route.completed,route.id);assert.equal(run.endingId,route.ending,route.id);
  assert.deepEqual(deriveAchievements(run),route.achievements,route.id);
  assertFrozenCharacterStats(deriveCharacterStats(run),route.characterStats,route.id);count+=checkpoints.length;
 }
 assert.equal(count,fixture.boundaryCount);assert.equal(count,17860);assert.ok(pending>0&&meals>0&&reactions>0&&interruptions>0);
 assert.equal(fixture.routes.filter(route=>/^meal-(?!cancel-|interrupt-|completed-)/.test(route.id)).length,96);
 assert.equal(fixture.routes.filter(route=>/^refused-(?!cancel-)/.test(route.id)).length,16);
 assert.equal(fixture.routes.filter(route=>route.id.startsWith('meal-cancel-')).length,16);
 assert.equal(fixture.routes.filter(route=>route.id.startsWith('meal-interrupt-')).length,16);
});
