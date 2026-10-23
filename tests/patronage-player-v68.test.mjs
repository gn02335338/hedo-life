import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../dist/engine.js';
import {directEntryV60} from '../dist/recruitment-v60.js';
import {recruitmentSeedV60,isRecruitmentV60} from '../dist/seed-profile-v60.js';
import {isExpansionV65} from '../dist/expansion-profile-v65.js';
import {isExpansionV66} from '../dist/expansion-profile-v66.js';
import {isOfficeTreatsV61} from '../dist/office-treats-v61.js';
import {isLifeBalanceV62} from '../dist/life-balance-v62.js';
import {isParticipationV63} from '../dist/participation-profile-v63.js';
import {isPatronageBenefitsV67} from '../dist/patronage-benefits-v67.js';
import {patronageLegacyNoticeV68} from '../dist/patronage-notice-v68.js';

test('fresh r68 ordinary and family seeds inherit current work, rest, participation and benefits profiles',()=>{
 for(const kind of ['normal','godson','goddaughter']){
  const seed=recruitmentSeedV60('ab'.repeat(16),kind,68);
  assert.match(seed,/^e39-r68-[nsd]-[0-9a-f]{22}$/);
  for(const gate of [isRecruitmentV60,isExpansionV65,isExpansionV66,isOfficeTreatsV61,isLifeBalanceV62,isParticipationV63,isPatronageBenefitsV67])assert.equal(gate(seed),true);
 }
});

test('both fresh special entries really appoint at the improved salary and replay with a single cash subsidy',()=>{
 for(const kind of ['godson','goddaughter']){
  const seed=recruitmentSeedV60('abcd'.repeat(8),kind,68),entry=directEntryV60(seed);
  const start=E.enableActivitySchedule(E.createRun(entry.roleId,seed)),copy=structuredClone(start);
  const pending=E.applyChoice(start,0),run=E.advance(pending);
  assert.deepEqual(start,copy);assert.equal(run.patronage.title,entry.title);assert.ok(run.pay>=180&&run.pay<=500);
  assert.equal(pending.history[0].breakdown.filter(part=>part.source==='patronage-appointment').length,1);
  assert.equal(run.stats.cash,Math.min(100,start.stats.cash+24));
  assert.deepEqual(E.replayRun(run.roleId,seed,run.actions),run);assert.equal(E.validRun(run),true);
  assert.equal(patronageLegacyNoticeV68(run),'');
 }
});

test('a continued old appointment receives an explicit restart explanation without altering its stored life',()=>{
 const seed=recruitmentSeedV60('abcd'.repeat(8),'godson',66),entry=directEntryV60(seed);
 const run=E.advance(E.applyChoice(E.enableActivitySchedule(E.createRun(entry.roleId,seed)),0)),before=structuredClone(run);
 assert.ok(run.pay<180);const html=patronageLegacyNoticeV68(run);
 assert.match(html,/舊版特殊任用規則/);assert.match(html,/重新應徵/);assert.match(html,/已收藏的結局和成就會保留/);
 assert.match(html,/data-action="new"/);assert.deepEqual(run,before);assert.equal(E.validRun(run),true);
 assert.equal(patronageLegacyNoticeV68({...run,completed:true}),'');
 assert.equal(patronageLegacyNoticeV68({...run,patronage:null}),'');
});

test('the r67 appointment already has improved benefits and never receives the obsolete-treatment warning',()=>{
 const seed=recruitmentSeedV60('abcd'.repeat(8),'goddaughter',67),entry=directEntryV60(seed);
 const run=E.advance(E.applyChoice(E.enableActivitySchedule(E.createRun(entry.roleId,seed)),0));
 assert.ok(run.pay>=180);assert.equal(patronageLegacyNoticeV68(run),'');assert.equal(E.validRun(run),true);
});
