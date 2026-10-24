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
import {isPatronageFamiliarityV68} from '../dist/patronage-familiarity-v68.js';

test('r68 and r69 ordinary and family seeds inherit current work, rest, participation, benefits and familiarity profiles',()=>{
 for(const profile of [68,69])for(const kind of ['normal','godson','goddaughter']){
  const seed=recruitmentSeedV60('ab'.repeat(16),kind,profile);
  assert.match(seed,new RegExp(`^e39-r${profile}-[nsd]-[0-9a-f]{22}$`));
  for(const gate of [isRecruitmentV60,isExpansionV65,isExpansionV66,isOfficeTreatsV61,isLifeBalanceV62,isParticipationV63,isPatronageBenefitsV67,isPatronageFamiliarityV68])assert.equal(gate(seed),true);
 }
});

test('both fresh special entries really appoint at the improved salary and replay with a single cash subsidy',()=>{
 for(const profile of [68,69])for(const kind of ['godson','goddaughter']){
  const seed=recruitmentSeedV60('abcd'.repeat(8),kind,profile),entry=directEntryV60(seed);
  const start=E.enableActivitySchedule(E.createRun(entry.roleId,seed)),copy=structuredClone(start);
  const pending=E.applyChoice(start,0),run=E.advance(pending);
  assert.deepEqual(start,copy);assert.equal(run.patronage.title,entry.title);assert.ok(run.pay>=180&&run.pay<=500);
  assert.equal(pending.history[0].breakdown.filter(part=>part.source==='patronage-appointment').length,1);
  assert.equal(run.stats.cash,Math.min(100,start.stats.cash+24));
  assert.deepEqual(E.replayRun(run.roleId,seed,run.actions),run);assert.equal(E.validRun(run),true);
  assert.equal(patronageLegacyNoticeV68(run)==='',profile===69);
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

test('r67 and r68 appointments receive only the new reply-flow notice without altering their valid lives',()=>{
 for(const profile of [67,68]){
  const seed=recruitmentSeedV60('abcd'.repeat(8),'goddaughter',profile),entry=directEntryV60(seed);
  const run=E.advance(E.applyChoice(E.enableActivitySchedule(E.createRun(entry.roleId,seed)),0)),before=structuredClone(run),html=patronageLegacyNoticeV68(run);
  assert.ok(run.pay>=180);assert.match(html,/這局保留原本的發話流程/);assert.match(html,/不必回來再選一次/);assert.match(html,/data-action="new"/);
  assert.doesNotMatch(html,/提高後的月薪|新版待遇/);assert.deepEqual(run,before);assert.equal(E.validRun(run),true);
 }
});
