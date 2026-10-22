import test from 'node:test';
import assert from 'node:assert/strict';
import {EVENTS} from '../dist/events.js';
import {PERSONAS} from '../dist/persona.js';
import {ROLE_MAP} from '../dist/roles.js';
import {SOURCES} from '../dist/public-sources.js';
import {CAST_EVENTS_V35_A} from '../dist/events-cast-v35-a.js';
import {CAST_EVENTS_V35_B} from '../dist/events-cast-v35-b.js';
import {verbalSceneLine} from '../dist/verbal-scene-copy.js';
import {rageParticipantsFor} from '../dist/rage-participants.js';
import {ORIGINAL_CHARACTER_IDS_V37} from './character-compat.mjs';

const added=[...CAST_EVENTS_V35_A,...CAST_EVENTS_V35_B];
const published=EVENTS.filter(event=>(event.minRules||1)<39);
const deficits={hope:3,spencer:14,sophie:18,helen:21,cindy:22,owen:23,meimei:7,jenjen:10,sam:23,jonathan:24,erich:25,kind:28};
const rawNames=/\b(?:Wing|Spencer|Rick|Sonny|Hope|Kind|JenJen|Erich|Jack|Jonathan|Owen|Sam|Cindy|Sophie|Helen)\b/;

test('218 original scenes bring every underrepresented main speaker to thirty, preserving the entire published daily catalogue',()=>{
 assert.equal(CAST_EVENTS_V35_A.length,101);assert.equal(CAST_EVENTS_V35_B.length,117);
 assert.equal(published.length,711);assert.equal(EVENTS.filter(event=>(event.minRules||1)<35).length,463);
 assert.equal(new Set(published.map(event=>event.id)).size,711);
 for(const [id,amount]of Object.entries(deficits))assert.equal(added.filter(event=>event.speaker===id).length,amount,id);
 for(const id of ORIGINAL_CHARACTER_IDS_V37){
  const total=published.filter(event=>(event.speaker||'wing')===id).length;
  assert.ok(total>=30,`${id} has only ${total}`);
  if(Object.hasOwn(deficits,id))assert.equal(total,30,id);
 }
});

test('each new scene has its own situation, dialogue, three authored consequences and a concealed absurd option',()=>{
 const titles=new Set(),choices=new Set(),results=new Set();
 for(const event of added){
  assert.ok(PERSONAS[event.speaker]);assert.equal(event.minRules,35);
  assert.ok((event.minTurn||0)<=1);assert.ok(!event.context,'ordinary cast stories must not hide behind PIP');
  assert.ok(event.sourceIds.length&&event.sourceIds.every(id=>SOURCES[id]),event.id);
  assert.equal(event.choices.length,3);assert.ok(event.choices.some(choice=>choice.wild),event.id);
  assert.ok(event.title.length>=5&&event.body.length>=40&&event.wing.length>=8,event.id);
  assert.ok(!titles.has(event.title),event.title);titles.add(event.title);
  if(event.roles)assert.ok(event.roles.length&&event.roles.every(id=>ROLE_MAP[id]),event.id);
  for(const choice of event.choices){
   assert.ok(choice.text.length>=8&&choice.result.length>=20,event.id);
   assert.ok(!choices.has(choice.text),`${event.id}: recycled answer`);choices.add(choice.text);
   assert.ok(!results.has(choice.result),`${event.id}: recycled consequence`);results.add(choice.result);
   assert.doesNotMatch(choice.text,/%|成功率|機率|[+-]\d+/);
   assert.ok(Object.values(choice.delta).every(Number.isInteger));
   const playerText=[event.title,event.body,event.wing,choice.text,choice.result].join('\n');
   assert.doesNotMatch(playerText,rawNames,event.id);
   assert.doesNotMatch(playerText,/https?:\/\/|notion\.so|jacktang|\/Users\//i,event.id);
  }
 }
});

test('rare characters remain available outside their home team while each profession still has its own work',()=>{
 for(const [id,amount]of Object.entries(deficits))if(amount>=18){
  assert.ok(added.filter(event=>event.speaker===id&&!event.roles).length>=8,`${id}: shared scenes`);
  assert.ok(added.some(event=>event.speaker===id&&event.roles?.length),`${id}: professional scenes`);
 }
 for(const id of Object.keys(ROLE_MAP)){
  const eligible=EVENTS.filter(event=>!event.roles||event.roles.includes(id));
  assert.ok(new Set(eligible.map(event=>event.speaker||'wing')).size>=12,id);
  assert.ok(eligible.some(event=>event.roles?.length===1&&event.roles[0]===id),id);
 }
});

test('new scenes retain context-specific verbal options without reading or revealing future choices',()=>{
 const run={roleId:'sales',actualRoleId:'sales'};
 for(const event of added)for(const phase of ['event','result']){
  const line=verbalSceneLine({event,target:event.speaker,run,phase});
  assert.ok(line.length>20&&line.length<500,event.id);
  assert.equal(line,verbalSceneLine({event:structuredClone(event),target:event.speaker,run,phase}));
  assert.doesNotMatch(line,/undefined|NaN|https?:\/\//);
 }
});

test('co-present cast members remain selectable while a remembered or remote character is not a target',()=>{
 const groups={
  'cast35-sophie-elevator-silence':['sophie','sonny'],
  'cast35-sophie-dessert-ownership':['sophie','sonny'],
  'cast35-sophie-print-page-trace':['sophie','sonny'],
  'cast35-erich-legal-extension':['erich','sonny'],
  'cast35-erich-legal-third-floor-line':['erich','jenjen','sonny'],
  'cast35-erich-legal-three-files':['erich','jenjen','sonny'],
  'cast35-erich-legal-successor-check':['erich','rick']
 };
 for(const event of added){
  const expected=groups[event.id]||[event.speaker];
  assert.deepEqual(rageParticipantsFor(event,event.speaker),expected,event.id);
  for(const target of expected)assert.deepEqual(rageParticipantsFor(event,target),expected,event.id);
 }
});
