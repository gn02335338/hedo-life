import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {replayRoute} from './find-routes-v3.mjs';
import {validRun} from '../dist/engine.js';
import {derivePublishedAchievements as deriveAchievements} from './achievement-compat.mjs';
import {deriveCharacterStats} from '../dist/character-stats.js';
import {frozenCharacterProjection,ORIGINAL_CHARACTER_IDS_V37} from './character-compat.mjs';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/legacy-e38-routes.json',import.meta.url),'utf8'));
// Original digests came only from the isolated published e38 commit. Extra
// encyclopedia entries must stay zero before comparison with its old roster.
const hash=state=>createHash('sha256').update(JSON.stringify({
 engine:state,achievements:deriveAchievements(state),
 characters:frozenCharacterProjection(deriveCharacterStats(state),ORIGINAL_CHARACTER_IDS_V37)
})).digest('hex');

test('published e38 retains all 7668 exact boundaries across checkpoints, continued jobs, resource exits and company finales',()=>{
 assert.equal(fixture.sourceCommit,'0c355205c6a4fa7cc0e0798a2d18a8aa2eb1479b');
 assert.equal(fixture.sourceFixtureSha256,'f1ea99d120cb0fa3879a554864df5d607fe9b879a23940c34ad27572eb44897e');
 assert.deepEqual(fixture.projection,['engine','achievements','characters']);
 assert.deepEqual(fixture.characterIds,ORIGINAL_CHARACTER_IDS_V37);
 assert.equal(fixture.routes.length,249);
 assert.equal(new Set(fixture.routes.map(route=>route.id)).size,249);
 assert.equal(new Set(fixture.routes.map(route=>route.roleId)).size,13);
 assert.deepEqual(Object.fromEntries(['chapter-exit','chapter-continue','resource-alternate','company-finale'].map(kind=>[kind,fixture.routes.filter(route=>route.kind===kind).length])),{'chapter-exit':221,'chapter-continue':15,'resource-alternate':2,'company-finale':11});
 let boundaries=0,pending=0,checkpoints=0;
 for(const route of fixture.routes){
  assert.match(route.seed,/^e38-/);let index=0;
  const run=replayRoute(route,state=>{
   assert.equal(validRun(state),true,`${route.id}/${index}: saved life remains valid`);
   assert.equal(hash(state),route.checkpoints[index],`${route.id}/${index}: immutable boundary`);
   pending+=Number(state.pending);checkpoints+=Number(Boolean(state.chapterContext));index++;boundaries++;
  });
  assert.equal(index,route.checkpoints.length,route.id);
  assert.equal(run.completed,route.completed,route.id);assert.equal(run.endingId,route.ending,route.id);
  if(route.kind==='chapter-continue'){assert.equal(run.completed,false);assert.equal(run.chapterContext,null);assert.equal(run.flags.departure38_voluntary,undefined);}
  else if(route.kind==='company-finale')assert.equal(run.flags.departure38_voluntary,undefined,'company grand finale does not fabricate resignation');
  else assert.equal(run.flags.departure38_voluntary,1,'personal life ends only after its confirmed departure');
 }
 assert.equal(boundaries,fixture.boundaryCount);assert.equal(boundaries,7668);assert.ok(pending>0&&checkpoints>0);
});
