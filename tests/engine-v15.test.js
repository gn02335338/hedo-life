import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRun,getEvent,applyChoice,advance,requestExit,requestBreak,requestCareer,requestRage,replayRun,validRun} from '../dist/engine.js';
import {applyCopyV15,polishDreamText} from '../dist/copy-v15.js';
import {getRageV14,RAGE_NAMES} from '../dist/rage-v14.js';
import {ADVISOR_EVENTS} from '../dist/events-advisor.js';
import {validateCompletion} from '../worker/http.js';
const copy=x=>JSON.parse(JSON.stringify(x));
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
function checkpoints(route,saved){
 let run=createRun(route.roleId,route.seed),hashes=[];const check=()=>{if(saved)run=copy(run);assert.equal(validRun(run),true,route.seed+'/'+run.eventId);hashes.push(hash(run));};check();
 for(let i=0;i<route.actions.length;i++){
  const a=route.actions[i];
  if(a.type==='exit')run=requestExit(run);else if(a.type==='break')run=requestBreak(run);else if(a.type==='career')run=requestCareer(run);
  else if(a.type==='rage'){run=requestRage(run);check();run=advance(run);}
  else{run=applyChoice(run,a.index);check();if(!(route.actions[i+1]?.type==='rage'&&route.actions[i+1].phase==='result'))run=advance(run);}
  check();
 }
 return {run,hashes};
}
test('all 288 e14 endings and four direct event/result modes preserve every published checkpoint',()=>{
 const fixtures=JSON.parse(readFileSync(new URL('./fixtures/legacy-e14-routes.json',import.meta.url)));
 assert.equal(fixtures.length,292);let count=0;
 for(const route of fixtures){const direct=checkpoints(route,false),saved=checkpoints(route,true);
  assert.equal(hash(direct.run),route.stateSha256,route.ending);assert.equal(hash(saved.run),route.savedStateSha256,route.ending);
  assert.deepEqual(direct.hashes,route.directCheckpoints,route.ending);assert.deepEqual(saved.hashes,route.savedCheckpoints,route.ending);
  assert.deepEqual(replayRun(route.roleId,route.seed,route.actions),direct.run);count+=direct.hashes.length;
 }
 assert.equal(count,10931);
});

function scrutiny(reasons){
 const run=createRun('mis','e15-department-screenshot');
 run.eventId='education-scrutiny';run.flags.education_case_active=1;run.flags.education_dispute=reasons;
 run.education={...run.education,school:'倫敦大學學院',schoolId:'ucl',department:'外國語文',field:'humanities',sector:'overseas',degree:'學士'};
 return run;
}
test('the screenshot major-mismatch case answers the department complaint with NTU electrical engineering and Lin',()=>{
 for(const reasons of [4,6,12,14,5,7,15]){
  const run=scrutiny(reasons),event=getEvent(run),option=event.choices[1];
  assert.match(event.title,/科系/);assert.match(event.body,/本科/);
  assert.match(option.text,/台大電機/);assert.match(option.text,/林澤/);
  assert.doesNotMatch(option.text,/校門/);assert.match(option.result,/申請|報考/);assert.match(option.result,/等回覆|能不能錄取/);
  assert.doesNotMatch(event.choices[0].result,/先看了校名/);
  const pending=applyChoice(run,1);assert.match(pending.history.at(-1).result,/林澤/);assert.equal(validRun(copy(pending)),true);
 }
 // When Wing's spoken complaint is the school, do not silently swap it for a major complaint.
 const school=getEvent(scrutiny(1)),mixedSchool=getEvent(scrutiny(3));
 for(const event of [school,mixedSchool]){assert.match(event.body,/這個學校/);assert.match(event.choices[1].text,/校門/);}
 const subject=getEvent(scrutiny(2));assert.match(subject.title,/科系/);assert.match(subject.choices[1].text,/林澤/);
});

const displayKeys=new Set(['text','detail','result','label','title','body','wing','wild']);
const mechanics=value=>Array.isArray(value)?value.map(mechanics):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([key])=>!displayKeys.has(key)).map(([key,item])=>[key,mechanics(item)])):value;
test('the new prose edits only text; dream branches keep their exact seeded effects and no comic wording',()=>{
 for(const target of Object.keys(RAGE_NAMES))for(const eventId of ['onboarding','pip-review','salary-cut','education-scrutiny','banquet-draw','crisis-boss','kind-workday','workday'])for(const phase of ['event','result']){
  const run={...createRun('system','e15-dream-copy'),rageContext:{eventId,target,phase},turn:21};
  const original=getRageV14({...run,eventId:'rage-release'}),before=copy(original),edited=applyCopyV15(original,run);
  assert.deepEqual(mechanics(edited),mechanics(original));assert.deepEqual(original,before);
  const imagined=edited.choices[0].draw.outcomes.find(outcome=>outcome.flags.includes('rage_imagined'));
  assert.equal(imagined.label,'腦內劇場');assert.match(imagined.result,/沒有真的動手/);assert.doesNotMatch(imagined.result,/漫畫|對話框/);
  assert.strictEqual(applyCopyV15(original,{...run,seed:'e14-old-copy'}),original);
  assert.equal(polishDreamText(polishDreamText(imagined.result)),imagined.result);
 }
});

test('four advisor stories are e15-only original events and preserve playable choices and direct conversational targets',()=>{
 assert.equal(ADVISOR_EVENTS.length,4);assert.equal(new Set(ADVISOR_EVENTS.map(event=>event.id)).size,4);
 for(const event of ADVISOR_EVENTS){
  assert.equal(event.minRules,15);assert.equal(event.choices.length,3);assert.deepEqual(event.sourceIds,['characterFiction']);
  assert.match(event.body,/林澤/);assert.ok(Object.hasOwn(RAGE_NAMES,event.speaker));
  assert.doesNotMatch(JSON.stringify(event),/notion\.so|notion\.site|https?:\/\//);
  assert.throws(()=>getEvent({...createRun('mis','e14-old-advisor'),eventId:event.id}));
  const run={...createRun('mis','e15-advisor-case'),eventId:event.id,turn:6};
  for(let index=0;index<event.choices.length;index++)assert.equal(validRun(copy(applyChoice(run,index))),true,event.id);
 }
});

test('e15 anonymous replay envelopes retain direct rage and interlude limits',()=>{
 const body={runId:'7ce894aa-4605-4bca-b31d-5317d32bb12e',roleId:'mis',seed:'e15-api-proof',actions:[{type:'rage',phase:'event',eventId:'onboarding'}]};
 assert.deepEqual(validateCompletion(body,{mis:{}}),body);
 assert.doesNotThrow(()=>validateCompletion({...body,actions:Array(300).fill(body.actions[0])},{mis:{}}));
 assert.throws(()=>validateCompletion({...body,actions:[{type:'rage'}]},{mis:{}}));
 const pending=requestRage(createRun('mis',body.seed)),settled=advance(pending);
 assert.equal(validRun(copy(pending)),true);assert.deepEqual(replayRun('mis',body.seed,pending.actions),settled);
});
