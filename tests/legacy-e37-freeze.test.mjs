import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {replayRoute} from './find-routes-v3.mjs';
import {validRun} from '../dist/engine.js';
import {deriveAchievements} from '../dist/achievements.js';
import {deriveCharacterStats} from '../dist/character-stats.js';
import {frozenCharacterProjection,ORIGINAL_CHARACTER_IDS_V37} from './character-compat.mjs';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/legacy-e37-routes.json',import.meta.url),'utf8'));
// One digest covers every saved engine field, earned-badge order and all
// seventeen character projections. The expected hashes came from the
// isolated published commit, never from the current e38 implementation.
const hash=state=>createHash('sha256').update(JSON.stringify({
 engine:state,achievements:deriveAchievements(state),characters:frozenCharacterProjection(deriveCharacterStats(state),ORIGINAL_CHARACTER_IDS_V37)
})).digest('hex');

test('published e37 keeps all 16105 saved boundaries, achievements and seventeen-character counters unchanged',()=>{
 assert.equal(fixture.sourceCommit,'397239207c7c3c270e41dcac185059c3e6eac825');
 assert.equal(fixture.sourceRoutesSha256,'d77329a00d816bd825a93537f660421f19c590ae6263f6108b35f8c9382823bc');
 assert.deepEqual(fixture.projection,['engine','achievements','characters']);
 assert.equal(fixture.characterCount,17);
 assert.equal(fixture.routes.length,286);
 assert.equal(new Set(fixture.routes.map(route=>route.roleId)).size,13);
 assert.equal(new Set(fixture.routes.map(route=>route.ending)).size,286);
 let boundaries=0,pending=0,interruptions=0;
 for(const route of fixture.routes){
  assert.match(route.seed,/^e37-/);
  let index=0;
  const final=replayRoute(route,state=>{
   assert.equal(validRun(state),true,`${route.id}/${index}: saved life stays valid`);
   assert.equal(hash(state),route.checkpoints[index],`${route.id}/${index}: frozen boundary`);
   pending+=Number(state.pending);
   interruptions+=Number(Boolean(state.rageContext||state.verbalContext));
   index++;boundaries++;
  });
  assert.equal(index,route.checkpoints.length,`${route.id}: boundary count`);
  assert.equal(final.completed,true,route.id);
  assert.equal(final.endingId,route.ending,route.id);
 }
 assert.equal(boundaries,fixture.boundaryCount);
 assert.equal(boundaries,16105);
 assert.ok(pending>0&&interruptions>0,'freeze pending outcomes and interrupted conversations too');
});
