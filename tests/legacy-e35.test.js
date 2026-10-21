import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {replayRoute} from './find-routes-v3.mjs';
import {validRun} from '../dist/engine.js';
import {deriveAchievements} from '../dist/achievements.js';
import {deriveCharacterStats} from '../dist/character-stats.js';
const hash=state=>createHash('sha256').update(JSON.stringify(state)).digest('hex');

test('published e35 dinner, character, company and spoken lives preserve all 23671 JSON boundaries, badges and character counters',()=>{
 const {routes,boundaryCount}=JSON.parse(readFileSync(new URL('./fixtures/legacy-e35-routes.json',import.meta.url)));
 assert.equal(routes.length,466);assert.equal(routes.filter(route=>route.kind==='ending').length,286);
 assert.equal(routes.filter(route=>route.id.startsWith('natural-cast-')).length,60);
 assert.equal(new Set(routes.map(route=>route.roleId)).size,13);
 let count=0,pending=0,meals=0,interruptions=0;
 for(const route of routes){
  assert.match(route.seed,/^e35-/);const checkpoints=[];
  const run=replayRoute(route,state=>{
   assert.equal(validRun(state),true,`${route.id}/${state.eventId}`);checkpoints.push(hash(state));
   pending+=Number(Boolean(state.pending));meals+=Number(Boolean(state.mealContext));interruptions+=Number(Boolean(state.rageContext||state.verbalContext));
  });
  assert.deepEqual(checkpoints,route.checkpoints,route.id);assert.equal(hash(run),route.stateSha256,route.id);
  assert.equal(run.completed,route.completed,route.id);assert.equal(run.endingId,route.ending,route.id);
  assert.deepEqual(deriveAchievements(run),route.achievements,route.id);assert.deepEqual(deriveCharacterStats(run),route.characterStats,route.id);
  // Every original pending/resolved boundary above remains frozen exactly.
  // Canonical second replays are covered by the ending/cast/meal API suites.
  count+=checkpoints.length;
 }
 assert.equal(count,boundaryCount);assert.equal(count,23671);assert.ok(pending>0&&meals>0&&interruptions>0);
 assert.equal(routes.filter(route=>route.id.startsWith('invite-')&&!route.id.startsWith('invite-interrupt-')).length,32);
 assert.equal(routes.filter(route=>/^meal-(?:wing|spencer|erich|sonny|jenjen|rick|kind|hope|jack|meimei|helen|sophie|jonathan|owen|sam|cindy)-[012]$/.test(route.id)).length,48);
 assert.equal(routes.filter(route=>route.id.startsWith('refused-cancel-')).length,16);
 assert.equal(routes.filter(route=>route.id.startsWith('meal-interrupt-')).length,16);
 assert.equal(routes.filter(route=>route.id.startsWith('invite-interrupt-')).length,8);
});
