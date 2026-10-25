import test from 'node:test';
import assert from 'node:assert/strict';
import {EVENTS} from '../dist/events.js';
import {PERSONAS} from '../dist/persona.js';
import {ROLES} from '../dist/roles.js';
import {SOURCES} from '../dist/public-sources.js';
import {CAST_EVENTS_V74,ALICE_HYGIENE_EVENTS_V74} from '../dist/events-cast-v74.js';
import {CAST_IDS_V74} from '../dist/cast-v74.js';
import {auditCastV74} from '../scripts/audit-cast-v74.mjs';

test('five new colleagues each have 31 independent authored scenes, with one additional anonymous Alice incident',()=>{
 assert.deepEqual(CAST_IDS_V74,['wine','peter','tony','henry','mia']);
 assert.equal(CAST_EVENTS_V74.length,156);
 for(const key of ['id','title','body'])assert.equal(new Set(CAST_EVENTS_V74.map(row=>row[key])).size,156,key);
 for(const id of CAST_IDS_V74)assert.equal(CAST_EVENTS_V74.filter(row=>row.speaker===id).length,31,id);
 assert.equal(ALICE_HYGIENE_EVENTS_V74.length,1);
 const scene=ALICE_HYGIENE_EVENTS_V74[0];assert.equal(scene.speaker,'alice');assert.match(scene.body,/鼻孔|痘痘/);assert.match(scene.body,/共用滑鼠/);
 assert.doesNotMatch([scene.title,scene.body,scene.wing].join(' '),/William|威廉|紅酒|P神|Peter|Tony|米雅|Henry/);
 assert.equal(EVENTS.length,new Set(EVENTS.map(row=>row.id)).size);
});

test('every new scene has contextual speech, actual participant identities, a wild response and hidden outcome details',()=>{
 const roleIds=new Set(ROLES.map(row=>row.id));
 for(const event of CAST_EVENTS_V74){
  assert.equal(event.requiresCastV74,true);assert.equal(event.minRules,39);assert.ok(EVENTS.includes(event));
  assert.ok(PERSONAS[event.speaker]);assert.equal(event.choices.length,3);assert.equal(event.verbalLinesV74.length,2);
  for(const line of event.verbalLinesV74)assert.ok(line.length>20,event.id);
  assert.equal(new Set(event.choices.map(choice=>choice.text)).size,3,event.id);
  assert.ok(event.choices.some(choice=>choice.wild),event.id);
  for(const choice of event.choices){assert.equal(choice.detail,'');assert.ok(choice.result.length>15);assert.doesNotMatch(choice.text,/成功率|機率[:：]|\d+%|好感[+−-]/);}
  for(const id of event.participants||[])assert.ok(Object.hasOwn(PERSONAS,id),`${event.id}/${id}`);
  if(event.participants){assert.ok(event.participants.includes(event.speaker),event.id);assert.equal(new Set(event.participants).size,event.participants.length);}
  for(const role of event.roles||[])assert.ok(roleIds.has(role),`${event.id}/${role}`);
  for(const source of event.sourceIds)assert.ok(SOURCES[source],source);
  const publicCopy=[event.title,event.body,event.wing,...event.verbalLinesV74,...event.choices.flatMap(choice=>[choice.text,choice.result])].join(' ');
  assert.doesNotMatch(publicCopy,/https?:\/\/|\/Users\/|notion\.so|notion\.com|X-Amz-|(?:password|api[_-]?key)\s*[:=]|[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}/i);
 }
});

test('the current inventory counts story IDs rather than answer permutations and preserves the hidden-character mask',()=>{
 const report=auditCastV74();
 assert.equal(report.publicCharacters,34);assert.equal(report.minimumPublicStories,31);assert.equal(report.addedDaily,156);
 assert.equal(report.characters.length,34);
 for(const row of report.characters){assert.ok(row.total>=31,row.id);assert.equal(row.total,row.eventIds.length);assert.equal(row.total,new Set(row.eventIds).size);}
 for(const id of CAST_IDS_V74){const row=report.characters.find(row=>row.id===id);assert.equal(row.added,31);assert.equal(row.existing,0);}
 assert.equal(report.characters.find(row=>row.id==='alice').added,1);
 assert.equal(report.hidden.name,'公司神秘人物');assert.equal(report.hidden.total,31);assert.doesNotMatch(JSON.stringify(report.hidden),/魚酥|Frans/i);
});
