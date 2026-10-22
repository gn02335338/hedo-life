import test from 'node:test';
import assert from 'node:assert/strict';
import {displayOccupationTextV47 as shown} from '../dist/occupation-copy-v47.js';
import {ROLES} from '../dist/roles.js';
import {CAREER_LADDERS_V17,careerTitleV17,getCareerReviewV17} from '../dist/career-v17.js';
import {ENDINGS} from '../dist/endings.js';
import {displayText,publishedDisplayText} from '../dist/persona.js';

test('product design labels cover the career family while leaving the C-level title intact',()=>{
 const role=ROLES.find(role=>role.id==='design');
 assert.equal(shown(role.name),'產品設計');
 assert.equal(shown(role.assistantTitle),'助理產品設計');
 assert.deepEqual(CAREER_LADDERS_V17.design.map(shown),[
  '助理產品設計','產品設計','資深產品設計','主任產品設計',
  '產品設計副理','產品設計經理','產品設計總監','創意長 CCO',
 ]);
 assert.equal(shown('設計主管／設計長／創意總監'),'產品設計主管／產品設計長／創意總監');
});

test('current work titles and promotion dialogue use the new occupation wording',()=>{
 const run={actualRoleId:'design',rank:1,assignment:'original',turn:5,lastPromotion:0,flags:{career_service:3},stats:{energy:90,mood:90,skill:90,trust:90,boss:90,lick:90}};
 const before=JSON.stringify(run),event=getCareerReviewV17(run);
 assert.equal(shown(careerTitleV17(run)),'產品設計');
 assert.match(shown(event.body),/目前是產品設計/);
 assert.match(shown(event.body),/資深產品設計/);
 assert.doesNotMatch(shown(event.body),/設計師/);
 assert.match(shown(event.choices[0].check.success.result),/資深產品設計/);
 assert.equal(JSON.stringify(run),before,'rendering a promotion never changes the saved run');
});

test('saved history, ending titles and source-guide prose share one text projection',()=>{
 assert.equal(shown('應徵設計師，報到後改成助理設計師。'),'應徵產品設計，報到後改成助理產品設計。');
 assert.equal(shown('設計經理先接住回覆｜設計師'),'產品設計經理先接住回覆｜產品設計');
 assert.equal(shown('設計師的工作事件：UI設計、設計稿、設計軟體。'),'產品設計的工作事件：UI設計、設計稿、設計軟體。');
 const selected=ENDINGS.filter(ending=>ending.roleId==='design');
 assert.ok(selected.length>=40);
 for(const ending of selected)for(const key of ['title','subtitle','body','hint']){
  if(typeof ending[key]==='string')assert.doesNotMatch(shown(ending[key]),/設計師|(?<!產品)設計(?:副理|經理|總監|主管)/,`${ending.id}.${key}`);
 }
});

test('the occupation projection is idempotent and avoids duplicate product prefixes',()=>{
 const samples=['設計師','產品設計師','產品設計','助理設計師','資深產品設計師','主任設計師','設計經理','產品設計總監','設計師與產品設計師一起看UI設計稿。','Wing請林澤教授找設計師。'];
 for(const text of samples){
  assert.equal(shown(shown(text)),shown(text),text);
  assert.doesNotMatch(shown(text),/產品產品/);
 }
 assert.equal(shown('產品設計師／產品設計經理'),'產品設計／產品設計經理');
 assert.equal(shown(), '');
});

test('URLs, file paths and stable role identifiers are not rewritten',()=>{
 const protectedText='design event_design role_設計師 設計師_id design-設計主管 ./assets/設計師.png ../archive/設計經理-Wing.json /Users/jack/設計師/notes.md 設計師.webp https://example.test/設計師?role=設計經理#Wing';
 assert.equal(shown(protectedText),protectedText);
 assert.equal(shown('https://example.test/設計師。設計師回來了。'),'https://example.test/設計師。產品設計回來了。');
 assert.equal(shown('業務／設計師／商務開發；業務/設計師/商務開發'),'業務／產品設計／商務開發；業務/產品設計/商務開發');
});

test('character aliases compose with the new wording without changing frozen canonical copy',()=>{
 const original='Wing找設計師與林澤教授，Moon Dog留下紀錄。';
 assert.equal(shown(original),'翅膀找產品設計與林老師，真真留下紀錄。');
 assert.equal(displayText(original),'翅膀找設計師與林老師，真真留下紀錄。');
 assert.equal(publishedDisplayText(original),'翅膀找設計師與林澤教授，真真留下紀錄。');
 const before=JSON.stringify({roles:ROLES,ladder:CAREER_LADDERS_V17.design,endings:ENDINGS});
 for(const value of [ROLES.find(role=>role.id==='design').name,...CAREER_LADDERS_V17.design,...ENDINGS.map(ending=>ending.title)])shown(value);
 assert.equal(JSON.stringify({roles:ROLES,ladder:CAREER_LADDERS_V17.design,endings:ENDINGS}),before);
 assert.equal(ROLES.find(role=>role.id==='design').name,'設計師');
 assert.equal(CAREER_LADDERS_V17.design[1],'設計師');
});
