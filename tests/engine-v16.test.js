import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRun,getEvent,jobTitle,applyChoice,advance,requestExit,requestBreak,requestCareer,requestRage,canRequestRage,replayRun,validRun,STAT_KEYS} from '../dist/engine.js';
import {JACK_EVENTS} from '../dist/events-jack.js';
import {deriveAchievements,ACHIEVEMENTS} from '../dist/achievements.js';
import {displayText,replayText} from '../dist/persona.js';
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
test('all 288 e15 endings and four direct modes preserve 10470 original and JSON save checkpoints',()=>{
 const fixtures=JSON.parse(readFileSync(new URL('./fixtures/legacy-e15-routes.json',import.meta.url)));
 assert.equal(fixtures.length,292);let count=0;
 for(const route of fixtures){const direct=checkpoints(route,false),saved=checkpoints(route,true);
  assert.equal(hash(direct.run),route.stateSha256,route.ending);assert.equal(hash(saved.run),route.savedStateSha256,route.ending);
  assert.deepEqual(direct.hashes,route.directCheckpoints,route.ending);assert.deepEqual(saved.hashes,route.savedCheckpoints,route.ending);
  assert.deepEqual(replayRun(route.roleId,route.seed,route.actions),direct.run);count+=direct.hashes.length;
 }
 assert.equal(count,10470);
});

test('new senior executive name and histories use aliases while role IDs and legacy titles remain compatible',()=>{
 const modern=createRun('executive','e16-executive-name'),legacy=createRun('executive','e15-executive-name');
 assert.equal(modern.roleId,'executive');assert.equal(modern.rank,2);assert.equal(modern.actualRoleId,'executive');
 assert.equal(jobTitle(modern),'事業部經理');assert.equal(jobTitle(legacy),'空降事業部經理');
 assert.equal(displayText(jobTitle(legacy)),'事業部經理');
 const event=getEvent(modern);assert.doesNotMatch(event.body,/Wing|空降主管/);
 const pending=applyChoice(modern,0);for(const field of ['title','body','choiceText','result','jobTitle'])assert.equal(displayText(pending.history[0][field]),pending.history[0][field],field);
 assert.equal(validRun(copy(pending)),true);assert.deepEqual(replayRun(modern.roleId,modern.seed,pending.actions),advance(pending));
});

test('six Jack colleague scenes have valid aliases, evidence choices and an eligible nine-character conversation',()=>{
 assert.equal(JACK_EVENTS.length,6);assert.ok(ACHIEVEMENTS.length>=100);
 for(const scene of JACK_EVENTS){
  assert.equal(scene.minRules,16);assert.equal(scene.choices.length,3);assert.deepEqual(scene.sourceIds,['characterFiction']);
  assert.doesNotMatch(JSON.stringify(scene),/notion\.so|notion\.site/);
  assert.throws(()=>getEvent({...createRun('system','e15-no-jack'),eventId:scene.id}));
  const base=createRun('system','e16-jack-scene');
  const run={...base,turn:8,eventId:scene.id,stats:{...base.stats,mood:70,energy:90,cash:80,boss:60},...(scene.context==='pip'?{pip:{active:true,remaining:3},pipCount:1}:{})};
  assert.equal(validRun(copy(run)),true);assert.equal(canRequestRage(run),true);
  const release=requestRage(run);assert.equal(release.rageContext.target,scene.speaker);
  assert.equal(validRun(copy(release)),true);assert.equal(validRun(copy(advance(release))),true);
  if(scene.speaker==='jack'){
   const real=release.history.at(-1).eventOutcome.result==='真的失控了',achievements=deriveAchievements(release);
   assert.equal(achievements.includes('real-hit-jack'),real);
   assert.equal(achievements.includes('rage-imagined'),!real);
   assert.ok(!achievements.includes('rage-jack'));
  }
  for(let index=0;index<3;index++){
   const pending=applyChoice(run,index),next=advance(pending);assert.equal(validRun(copy(pending)),true);assert.equal(validRun(copy(next)),true);
   assert.equal(next.turn,run.turn+1,scene.id);
   if(scene.context==='pip'){assert.equal(next.pip.remaining,2);assert.ok(!pending.pendingEffect?.includes('pipPassed'));}
   for(const value of Object.values(pending.stats))assert.ok(value>=0&&value<=100);
  }
 }
});

test('published e16 histories retain canonical aliases while the current display name stays separate',()=>{
 const routes=JSON.parse(readFileSync(new URL('./fixtures/legacy-e16-routes.json',import.meta.url))).filter(route=>!route.ending.startsWith('feature-'));
 for(const route of routes){
  assert.ok(route.seed.startsWith('e16-'));
  const run=replayRun(route.roleId,route.seed,route.actions);assert.equal(run.completed,true);
  for(const h of run.history)for(const field of ['title','body','choiceText','result','jobTitle']){
   assert.equal(replayText(h[field]),h[field],route.ending+'/'+field);
   const shown=displayText(h[field]);
   assert.doesNotMatch(shown,/Moon Dog/);
   if(h[field].includes('Moon Dog'))assert.ok(shown.includes('真真'));
  }
 }
});

test('e16 freeform API remains unconfigured while ordinary verified replay accepts the new cohort',()=>{
 const body={runId:'7ce894aa-4605-4bca-b31d-5317d32bb12e',roleId:'system',seed:'e16-api-proof',actions:[{type:'rage',phase:'event',eventId:'onboarding'}]};
 assert.deepEqual(validateCompletion(body,{system:{}}),body);
 assert.throws(()=>validateCompletion({...body,actions:[{type:'freeform',text:'anything'}]},{system:{}}));
 assert.throws(()=>replayRun('system',body.seed,[{type:'freeform',text:'anything'}]));
 const pending=requestRage(createRun('system',body.seed));assert.equal(validRun(copy(pending)),true);
 assert.deepEqual(replayRun('system',body.seed,pending.actions),advance(pending));
});
