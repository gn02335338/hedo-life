import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ROLES} from '../dist/roles.js';
import {validRun,replayRun} from '../dist/engine.js';
import {deriveAchievements} from '../dist/achievements.js';
import {replayRoute} from './find-routes-v3.mjs';
import {VERBAL_ENDING_IDS_V32} from '../dist/verbal-outcomes-v32.js';
import {COMPANY_ENDING_IDS_V32} from '../dist/company-v32.js';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/v34-routes.json',import.meta.url)));
const familyOf=route=>route.ending.slice(0,-route.roleId.length-1);
const companyBadges={nasdaq:'nasdaq',taiwan:'company-taiwan-listed',...Object.fromEntries(COMPANY_ENDING_IDS_V32.filter(id=>!['nasdaq','taiwan'].includes(id)).map(id=>[id,`company-${id.replaceAll('_','-')}`]))};

test('e34 inherits rarer spoken finales and all ten company directions remain naturally reachable and earn only their own current-cohort badge',()=>{
 assert.equal(fixture.routes.length,286);
 for(const role of ROLES){
  const routes=fixture.routes.filter(route=>route.roleId===role.id);
  assert.equal(routes.length,22);
  assert.deepEqual(new Set(routes.map(familyOf)),new Set([...VERBAL_ENDING_IDS_V32,...COMPANY_ENDING_IDS_V32]));
 }
 let checkpoints=0;
 for(const route of fixture.routes){
  assert.match(route.seed,/^e34-/);
  const run=replayRoute(route,state=>{checkpoints++;assert.equal(validRun(state),true,`${route.ending}: ${state.eventId}`);});
  assert.equal(run.completed,true);assert.equal(run.endingId,route.ending);
  assert.deepEqual(replayRun(route.roleId,route.seed,route.actions),run);
  const family=familyOf(route),earned=new Set(deriveAchievements(run));
  const badge=VERBAL_ENDING_IDS_V32.includes(family)?family.replaceAll('_','-'):companyBadges[family];
  assert.ok(earned.has(badge),`${route.ending}: missing ${badge}`);
  assert.equal(run.verbalContext,null);assert.equal(run.companyContext,null);
  assert.ok(!earned.has('rage-real')&&!earned.has('rage-imagined'),'a spoken finale is not a physical or imagined hit');
 }
 assert.ok(checkpoints>10000,'verify pending results as well as completed saves');
});
