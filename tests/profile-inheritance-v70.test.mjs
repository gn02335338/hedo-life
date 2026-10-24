import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../dist/engine.js';
import {ROLE_MAP} from '../dist/roles.js';
import {directEntryV60} from '../dist/recruitment-v60.js';
import {recruitmentSeedV60,isRecruitmentV60} from '../dist/seed-profile-v60.js';
import {isExpansionV65} from '../dist/expansion-profile-v65.js';
import {isExpansionV66} from '../dist/expansion-profile-v66.js';
import {isOfficeTreatsV61} from '../dist/office-treats-v61.js';
import {isLifeBalanceV62} from '../dist/life-balance-v62.js';
import {isParticipationV63} from '../dist/participation-profile-v63.js';
import {isPatronageBenefitsV67} from '../dist/patronage-benefits-v67.js';
import {isPatronageFamiliarityV68} from '../dist/patronage-familiarity-v68.js';
import {isPatronageProgressV69} from '../dist/patronage-progress-v69.js';
import {isWorkGapV50} from '../dist/work-gap-v50.js';
import {isEnergyRestV53} from '../dist/energy-rest-v53.js';
import {isEnergySafetyV54} from '../dist/energy-safety-v54.js';
import {isActivityPlayV55} from '../dist/activity-play-v55.js';
import {isShareholderV58} from '../dist/shareholders-v58.js';
import {validateCompletion} from '../worker/http.js';

const gates=[isRecruitmentV60,isExpansionV65,isExpansionV66,isOfficeTreatsV61,isLifeBalanceV62,isParticipationV63,isPatronageBenefitsV67,isPatronageFamiliarityV68,isPatronageProgressV69,isWorkGapV50,isEnergyRestV53,isEnergySafetyV54,isActivityPlayV55,isShareholderV58];

test('r70 inherits current cast, work-gap safety, activities, finances and complete family replies',()=>{
 for(const kind of ['normal','godson','goddaughter']){
  const seed=recruitmentSeedV60('abcd'.repeat(8),kind,70);
  assert.equal(seed.length,32);
  for(const gate of gates){assert.equal(gate(seed),true,gate.name);assert.equal(gate({seed}),true,gate.name);}
 }
 const invalid=['e39-r71-s-'+'a'.repeat(22),'e39-r70-x-'+'a'.repeat(22),'e39-r70-s-'+'a'.repeat(21),'e39-r70-s-'+'a'.repeat(23),'e39-r70-s-'+'A'.repeat(22),'e39-r70-s-'+'a'.repeat(22)+'-extra'];
 for(const seed of invalid)for(const gate of gates)assert.equal(gate(seed),false,gate.name+'/'+seed);
 assert.throws(()=>recruitmentSeedV60('abcd'.repeat(8),'normal',71));
});

test('both natural r70 family entries answer a work scene once and submit version 2 proof to the Worker',()=>{
 for(const kind of ['godson','goddaughter']){
  const seed=recruitmentSeedV60('abcd'.repeat(8),kind,70),entry=directEntryV60(seed);
  let run=E.enableActivitySchedule(E.createRun(entry.roleId,seed));
  for(let i=0;i<3;i++)run=E.advance(E.applyChoice(run,0));
  assert.equal(E.getEvent(run).kind,'daily');assert.equal(E.canRequestPatronageReply(run),true);
  const before=structuredClone(run),target=E.getPatronageReplyTargets(run)[0],pending=E.requestPatronageReply(run,target),row=pending.history.at(-1),after=E.advance(pending);
  assert.equal(pending.pending,true);assert.equal(row.patronageOutcome.version,2);assert.equal(row.eventId,before.eventId);
  assert.deepEqual(pending.actions.at(-1),{type:'patronage-reply',version:2,eventId:before.eventId,target});
  assert.equal(after.turn,before.turn+1);assert.notEqual(after.eventId,before.eventId);assert.equal(after.patronageReplyContext,undefined);
  assert.equal(E.advance(after),after);assert.deepEqual(run,before);assert.equal(E.validRun(after),true);
  assert.deepEqual(E.replayRun(after.roleId,seed,after.actions),after);
  const proof={runId:'e319c6cf-fbf0-4dd4-8ee3-d4577790c235',roleId:after.roleId,seed,actions:after.actions};
  assert.doesNotThrow(()=>validateCompletion(proof,ROLE_MAP));
  const stale=structuredClone(proof);stale.actions.at(-1).version=1;
  assert.throws(()=>validateCompletion(stale,ROLE_MAP),error=>error.code==='invalid_actions');
 }
});
