import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {replayRoute} from './find-routes-v3.mjs';
import {validRun,replayRun} from '../dist/engine.js';
const hash=state=>createHash('sha256').update(JSON.stringify(state)).digest('hex');
test('published optional verbal-v1 and starting-pay proofs retain 267 prefixes and 4040 exact JSON boundaries',()=>{
 const {routes,boundaryCount}=JSON.parse(readFileSync(new URL('./fixtures/legacy-verbal-starting-pay-routes.json',import.meta.url)));
 assert.equal(routes.length,267);let count=0;
 for(const route of routes){const checkpoints=[];const run=replayRoute(route,state=>{assert.equal(validRun(state),true,route.id+'/'+state.eventId);checkpoints.push(hash(state));});
 assert.deepEqual(checkpoints,route.checkpoints,route.id);assert.equal(hash(run),route.stateSha256,route.id);assert.deepEqual(replayRun(route.roleId,route.seed,route.actions),run,route.id);count+=checkpoints.length;}
 assert.equal(count,boundaryCount);assert.equal(count,4040);
});
