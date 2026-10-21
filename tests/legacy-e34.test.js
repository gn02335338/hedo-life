import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {replayRoute} from './find-routes-v3.mjs';
import {validRun,replayRun} from '../dist/engine.js';
import {deriveAchievements} from '../dist/achievements.js';
import {deriveCharacterStats} from '../dist/character-stats.js';
import {assertFrozenCharacterStats} from './character-compat.mjs';

const hash=state=>createHash('sha256').update(JSON.stringify(state)).digest('hex');

test('published e34 company and spoken lives preserve all 17706 JSON boundaries, badges and character counters',()=>{
 const {routes,boundaryCount}=JSON.parse(readFileSync(new URL('./fixtures/legacy-e34-routes.json',import.meta.url)));
 assert.equal(routes.length,414);
 assert.equal(routes.filter(route=>route.kind==='ending').length,286);
 assert.equal(routes.filter(route=>route.kind==='milestone').length,128);
 assert.equal(new Set(routes.map(route=>route.roleId)).size,13);
 let count=0,pending=0,company=0,spoken=0;
 for(const route of routes){
  assert.match(route.seed,/^e34-/);
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
 assert.equal(count,17706);
 assert.ok(pending>0,'frozen hashes include unresolved choices');
 assert.ok(company>0,'frozen hashes include company navigation and results');
 assert.ok(spoken>0,'frozen hashes include interrupted verbal contexts');
 assert.equal(routes.filter(route=>route.id.startsWith('invite-')&&!route.id.startsWith('invite-completed-')).length,32,'every guest keeps both committed invitation outcomes');
 assert.equal(routes.filter(route=>route.id.startsWith('dinner-')).length,48,'paid and cancelled meals retain their exact effects');
 assert.ok(routes.some(route=>route.id==='crisis-solo-recovered'),'low-savings crisis can retain its guaranteed solo recovery');
});
