import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {replayRoute} from './find-routes-v3.mjs';
import {validRun,replayRun} from '../dist/engine.js';

const hash=state=>createHash('sha256').update(JSON.stringify(state)).digest('hex');
test('all 545 published e30 lives retain 24245 exact save boundaries and server replay states',()=>{
 const routes=JSON.parse(readFileSync(new URL('./fixtures/legacy-e30-routes.json',import.meta.url)));
 assert.equal(routes.length,545);let count=0;
 for(const route of routes){
  assert.match(route.seed,/^e30-/);const checkpoints=[];
  const run=replayRoute(route,state=>{
   assert.equal(validRun(state),true,`${route.ending}/${state.eventId}`);
   checkpoints.push(hash(state));
  });
  assert.deepEqual(checkpoints,route.checkpoints,route.ending);
  assert.equal(hash(run),route.stateSha256,route.ending);
  assert.equal(run.endingId,route.ending);
  assert.deepEqual(replayRun(route.roleId,route.seed,route.actions),run,route.ending);
  count+=checkpoints.length;
 }
 assert.equal(count,24245);
});
