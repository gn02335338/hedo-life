import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as E from '../dist/engine.js';
import {CAST_EVENTS_V66} from '../dist/events-cast-v66.js';
import {HIDDEN_STORIES_V66,hiddenStoryCountV66,hiddenStoryV66} from '../dist/hidden-stories-v66.js';
import {isExpansionV66} from '../dist/expansion-profile-v66.js';
import {isExpansionV65} from '../dist/expansion-profile-v65.js';
import {isLifeBalanceV62} from '../dist/life-balance-v62.js';
import {isParticipationV63} from '../dist/participation-profile-v63.js';
import {isOfficeTreatsV61} from '../dist/office-treats-v61.js';
import {isRecruitmentV60,recruitmentSeedV60} from '../dist/seed-profile-v60.js';
import {castVerbalLineV66} from '../dist/verbal-cast-v66.js';
import {auditCastV66} from '../scripts/audit-cast-v66.mjs';
import {validateCompletion} from '../worker/http.js';
import {ROLE_MAP} from '../dist/roles.js';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/cast-v66.json',import.meta.url),'utf8'));
const replay=row=>E.replayRun(row.roleId,row.seed,row.actions),copy=structuredClone;

test('all 28 public speakers and the anonymous hidden character exceed 30 distinct authored stories',()=>{
 const report=auditCastV66();assert.equal(report.publicCharacters,28);assert.equal(report.characters.length,29);assert.equal(report.addedDaily,160);assert.equal(report.addedHidden,23);
 for(const row of report.characters){assert.ok(row.after>=31,row.id);assert.equal(row.before+row.added,row.after);assert.equal(new Set([...row.beforeIds,...row.addedIds]).size,row.after);}
 assert.equal(report.characters.at(-1).name,'公司神秘人物');assert.doesNotMatch(JSON.stringify(report),/魚酥|Frans/i);
 assert.equal(CAST_EVENTS_V66.length,160);assert.equal(HIDDEN_STORIES_V66.length,23);
 assert.equal(report.characters.find(row=>row.id==='sophie').excludedLegacy.length,1);assert.equal(report.characters.find(row=>row.id==='meimei').excludedLegacy.length,3);assert.equal(report.characters.find(row=>row.id==='wing').excludedLegacy.length,1);
 for(const event of CAST_EVENTS_V66){assert.equal(event.requiresCastV66,true);assert.equal(event.choices.length,3);assert.ok(event.choices.some(choice=>choice.wild));assert.equal(new Set(event.choices.map(choice=>choice.text)).size,3);assert.ok(event.body.length>35);assert.ok(event.verbalLinesV66.every(line=>line.length>25));}
 const princess=CAST_EVENTS_V66.find(event=>event.speaker==='princess');assert.doesNotMatch(princess.wing,/[\u3400-\u9fff]/);assert.match(princess.wing,/testing/);
});

test('r66 keeps the complete inherited profile without accepting malformed or future seeds',()=>{
 for(const marker of ['n','s','d']){
  const seed=`e39-r66-${marker}-${'a'.repeat(22)}`;
  for(const check of [isRecruitmentV60,isExpansionV65,isExpansionV66,isOfficeTreatsV61,isLifeBalanceV62,isParticipationV63])assert.equal(check(seed),true);
  assert.equal(recruitmentSeedV60('a'.repeat(32),marker==='n'?'normal':marker==='s'?'godson':'goddaughter',66),seed);
  assert.equal(hiddenStoryCountV66(seed),31);
 }
 for(const seed of ['e39-r65-n-'+'a'.repeat(22),'e39-r69-n-'+'a'.repeat(22),'e39-r66-x-'+'a'.repeat(22),'e39-r66-n-'+'a'.repeat(21),'e39-r66-n-'+'a'.repeat(23)])assert.equal(isExpansionV66(seed),false);
 for(const marker of ['n','s','d']){
  const seed=`e39-r67-${marker}-${'a'.repeat(22)}`;
  for(const check of [isRecruitmentV60,isExpansionV65,isExpansionV66,isOfficeTreatsV61,isLifeBalanceV62,isParticipationV63])assert.equal(check(seed),true);
  assert.equal(recruitmentSeedV60('a'.repeat(32),marker==='n'?'normal':marker==='s'?'godson':'goddaughter',67),seed);assert.equal(hiddenStoryCountV66(seed),31);
 }
 const old={seed:'e39-r65-n-'+'b'.repeat(22)};assert.equal(hiddenStoryCountV66(old),8);assert.equal(hiddenStoryV66(old,8),null);
});

test('every added daily and hidden story has a natural current-cohort source and all three ordinary answers replay canonically',()=>{
 assert.equal(fixture.required.length,183);assert.equal(fixture.routes.length,183);assert.equal(new Set(fixture.routes.map(row=>row.id)).size,183);
 for(const row of fixture.routes){
  const source=replay(row),snapshot=copy(source),event=E.getEvent(source);assert.equal(event.id,row.id);assert.equal(isExpansionV66(source),true);assert.equal(E.validRun(source),true,row.id);
  const authored=CAST_EVENTS_V66.find(event=>event.id===row.id);
  if(authored?.roles)assert.ok(authored.roles.includes(source.actualRoleId),row.id);
  for(const index of [0,1,2]){
   const pending=E.applyChoice(source,index),after=E.advance(pending),committed=pending.history.at(-1);
   assert.equal(committed.eventId,row.id);assert.equal(committed.choiceIndex,index);assert.ok(committed.result.length>10);assert.equal(E.validRun(pending),true,`${row.id}/${index}/pending`);assert.equal(E.validRun(after),true,`${row.id}/${index}/after`);
   assert.deepEqual(E.replayRun(source.roleId,source.seed,pending.actions),after);
   assert.deepEqual(E.applyChoice(pending,index),pending,'committed results cannot be rerolled');
   if(event.kind==='hidden'){assert.equal(after.turn,source.turn);assert.equal(after.pay,source.pay);assert.equal(after.stats.cash,source.stats.cash);assert.ok(!after.hiddenEncounterContext);}
  }
  assert.deepEqual(source,snapshot);
 }
});

test('each new daily uses its own event and result outburst wording and cannot be injected into a published r65 life',()=>{
 const fresh={seed:'e39-r66-n-'+'a'.repeat(22)},old={seed:'e39-r65-n-'+'a'.repeat(22)};
 for(const authored of CAST_EVENTS_V66){
  assert.equal(castVerbalLineV66(fresh,authored,authored.speaker,'event'),authored.verbalLinesV66[0]);
  assert.equal(castVerbalLineV66(fresh,authored,authored.speaker,'result'),authored.verbalLinesV66[1]);
  assert.equal(castVerbalLineV66(old,authored,authored.speaker),null);assert.equal(castVerbalLineV66(fresh,authored,'self'),null);
 }
 for(const row of fixture.routes.filter(row=>row.id.startsWith('cast66-'))){
  const source=replay(row),target=E.getEvent(source).speaker;if(!E.canRequestVerbal(source))continue;
  const preview=E.getVerbalLine(source,target),opened=E.requestVerbal(source,E.getVerbalTargets(source).length>1?target:undefined,2);assert.ok(preview.length>25,row.id);assert.equal(opened.verbalContext.line,preview,row.id);
  const forged={...source,seed:source.seed.replace('r66','r65')};assert.equal(E.validRun(forged),false);
 }
});

test('all natural r66 action envelopes validate and reject client-supplied story or result fields',()=>{
 for(const row of fixture.routes){
  const body={runId:'6df2f2b4-0bb2-4a84-a04e-87175b216a66',roleId:row.roleId,seed:row.seed,actions:row.actions};
  assert.deepEqual(validateCompletion(body,ROLE_MAP).actions,row.actions);
 }
 const source=replay(fixture.routes[0]),forged=copy(source);forged.history.push({eventId:CAST_EVENTS_V66[0].id,kind:'daily',choiceIndex:0,result:'made up'});assert.equal(E.validRun(forged),false);
});

test('published r65 activity, cast, and blockchain witnesses retain their exact replay paths',()=>{
 const old=JSON.parse(readFileSync(new URL('./fixtures/expansion-v65.json',import.meta.url),'utf8'));
 for(const row of old.routes){const run=replay(row);assert.equal(E.validRun(run),true,row.id);assert.ok(!run.history.some(item=>item.eventId.startsWith('cast66-')));assert.ok(!run.hiddenEncounterContext||run.hiddenEncounterContext.scene<8);}
});
