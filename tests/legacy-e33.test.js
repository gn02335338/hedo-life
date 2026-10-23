import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {replayRoute} from './find-routes-v3.mjs';
import {validRun,replayRun} from '../dist/engine.js';
import {derivePublishedAchievements as deriveAchievements} from './achievement-compat.mjs';
import {deriveCharacterStats} from '../dist/character-stats.js';
import {assertFrozenCharacterStats} from './character-compat.mjs';

const hash=state=>createHash('sha256').update(JSON.stringify(state)).digest('hex');

test('published e33 company and spoken lives preserve all 15914 JSON boundaries, badges and character counters',()=>{
 const {routes,boundaryCount}=JSON.parse(readFileSync(new URL('./fixtures/legacy-e33-routes.json',import.meta.url)));
 assert.equal(routes.length,365);
 assert.equal(routes.filter(route=>route.kind==='ending').length,286);
 assert.equal(routes.filter(route=>route.kind==='milestone').length,79);
 assert.equal(new Set(routes.map(route=>route.roleId)).size,13);
 let count=0,pending=0,company=0,spoken=0;
 for(const route of routes){
  assert.match(route.seed,/^e33-/);
  const checkpoints=[];
  const run=replayRoute(route,state=>{
   assert.equal(validRun(state),true,`${route.id}/${state.eventId}`);
   checkpoints.push(hash(state));
   pending+=Number(Boolean(state.pending));
   company+=Number(Boolean(state.companyContext));
   spoken+=Number(Boolean(state.verbalContext));
  });
  assert.deepEqual(checkpoints,route.checkpoints,route.id);
  assert.equal(hash(run),route.stateSha256,route.id);
  assert.equal(run.completed,route.completed,route.id);
  assert.equal(run.endingId,route.ending,route.id);
  assert.deepEqual(deriveAchievements(run),route.achievements,route.id);
  assertFrozenCharacterStats(deriveCharacterStats(run),route.characterStats,route.id);
  assert.deepEqual(replayRun(route.roleId,route.seed,route.actions),run,route.id);
  count+=checkpoints.length;
 }
 assert.equal(count,boundaryCount);
 assert.equal(count,15914);
 assert.ok(pending>0,'frozen hashes include unresolved choices');
 assert.ok(company>0,'frozen hashes include company navigation and results');
 assert.ok(spoken>0,'frozen hashes include interrupted verbal contexts');
 assert.equal(routes.filter(route=>route.id.startsWith('meal-seat-')).length,16,'every original guest keeps the already accepted meal semantics');
});
