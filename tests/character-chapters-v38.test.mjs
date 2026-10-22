import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {replayRun,applyChoice,advance} from '../dist/engine.js';
import {deriveCharacterStats} from '../dist/character-stats.js';

const routes=JSON.parse(readFileSync(new URL('./fixtures/chapters-e38-routes.json',import.meta.url),'utf8')).routes;

test('continuing work and confirming departure do not count a second NPC encounter or affinity event',()=>{
 assert.equal(routes.length,221);
 for(const route of routes){
  const staged=replayRun(route.roleId,route.seed,route.actions.slice(0,-1));
  assert.equal(staged.eventId,'chapter-resolution');
  const before=deriveCharacterStats(staged);
  assert.ok(before.some(row=>row.encounters>0),'the resolved source conversation remains counted');
  for(const index of [0,1]){
   const pending=applyChoice(staged,index),resolved=advance(pending);
   assert.equal(pending.history.at(-1).eventId,'chapter-resolution');
   assert.deepEqual(deriveCharacterStats(pending),before,`${route.ending}: confirmation ${index} pending`);
   assert.deepEqual(deriveCharacterStats(resolved),before,`${route.ending}: confirmation ${index} resolved`);
  }
 }
});
