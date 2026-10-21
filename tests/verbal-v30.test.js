import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRun,getEvent,applyChoice,advance,replayRun,validRun,requestVerbal,canRequestVerbal,getVerbalTargets,requestRage,requestExit,requestBreak,requestCareer,requestRaise} from '../dist/engine.js';
import {VERBAL_EVENTS_V30,VERBAL_KINDS_V30} from '../dist/verbal-v30.js';
import {CHARACTER_IDS,deriveCharacterStats,characterAffinity} from '../dist/character-stats.js';
import {deriveAchievements} from '../dist/achievements.js';
import {replayRoute} from './find-routes-v3.mjs';

const {routes}=JSON.parse(readFileSync(new URL('./fixtures/verbal-routes-v30.json',import.meta.url),'utf8'));
const copy=value=>JSON.parse(JSON.stringify(value));
function sourceFor(route){
 const actions=route.baseActions;
 if(route.phase==='result'){
  const action=actions.at(-1),before=replayRun(route.roleId,route.seed,actions.slice(0,-1));
  assert.equal(action.type,'choice');assert.equal(action.eventId,before.eventId);return applyChoice(before,action.index);
 }
 return replayRun(route.roleId,route.seed,actions);
}
const request=(run,target)=>getVerbalTargets(run).length>1?requestVerbal(run,target):requestVerbal(run);
const get=id=>{const row=routes.find(route=>route.id===id);assert.ok(row,id);return row;};
const family=run=>run.endingId?.slice(0,run.endingId.lastIndexOf('-'));

test('verbal actions belong only to e30 lives and do not introduce another character collection or ending catalogue',()=>{
 const run=createRun('sales','e30-verbal-contract');assert.equal(run.verbalContext,null);assert.equal(run.lastVerbalTurn,-1);assert.equal(validRun(copy(run)),true);
 assert.deepEqual(VERBAL_EVENTS_V30,['verbal-release','verbal-warning','verbal-legal','verbal-legal-result']);
 assert.deepEqual([...VERBAL_KINDS_V30].sort(),['ignored','relationship','retort','support','personnel','legal'].sort());
 for(const seed of ['unversioned','e20-verbal-old','e29-verbal-old']){
  const old=createRun('sales',seed);assert.equal(Object.hasOwn(old,'verbalContext'),false);assert.equal(Object.hasOwn(old,'lastVerbalTurn'),false);
  assert.equal(canRequestVerbal(old),false);assert.deepEqual(getVerbalTargets(old),[]);assert.equal(requestVerbal(old),old);
 }
 assert.equal(CHARACTER_IDS.length,17);
});

test('natural verbal witnesses cover every NPC and self in both phases, every outcome and every legal response/result',()=>{
 const targets=routes.filter(route=>route.kind==='target');assert.equal(targets.length,34);
 assert.deepEqual(targets.map(route=>route.id).sort(),['event','result'].flatMap(phase=>[...CHARACTER_IDS.filter(id=>id!=='professor'),'self'].map(id=>`target-${phase}-${id}`)).sort());
 assert.deepEqual(routes.filter(route=>route.kind==='outcome').map(route=>route.branch).sort(),[...VERBAL_KINDS_V30].sort());
 assert.deepEqual(routes.filter(route=>route.kind==='legal').map(route=>route.id).sort(),[0,1,2].flatMap(index=>['withdrawn','settled','pending'].map(result=>`legal-${index}-${result}`)).sort());
 let checkpoints=0;
 for(const route of routes.filter(route=>route.kind!=='blocked')){
  assert.match(route.seed,/^e30-/);const source=sourceFor(route);assert.equal(source.eventId,route.sourceEventId);assert.equal(source.pending,route.phase==='result');assert.equal(validRun(copy(source)),true,route.id);
  const direct=replayRun(route.roleId,route.seed,route.actions),saved=replayRoute({...route,ending:route.id},state=>{checkpoints++;assert.equal(validRun(state),true,`${route.id}/${state.eventId}`);});
  assert.deepEqual(saved,direct,route.id);assert.equal(direct.eventId,route.expected.eventId);assert.equal(direct.turn,route.expected.turn);
  const ended=replayRun(route.roleId,route.seed,route.completionActions);assert.equal(ended.completed,true);assert.equal(ended.endingId,route.endingId);assert.equal(validRun(copy(ended)),true);
 }
 assert.ok(checkpoints>1000);
});

test('one click resolves a single seeded verbal response while preserving every already committed choice',()=>{
 for(const route of routes.filter(route=>route.kind==='target')){
  const source=sourceFor(route),before=copy(source),pending=request(source,route.target),row=pending.history.at(-1);
  assert.deepEqual(source,before);assert.notEqual(pending,source);assert.equal(pending.pending,true);assert.equal(pending.eventId,'verbal-release');
  assert.equal(pending.history.length,source.history.length+1);assert.deepEqual(pending.history.slice(0,-1),source.history);
  assert.equal(pending.actions.length,source.actions.length+1);assert.deepEqual(pending.actions.slice(0,-1),source.actions);
  assert.deepEqual(pending.actions.at(-1),{type:'verbal',phase:route.phase,eventId:source.eventId,...(getVerbalTargets(source).length>1?{target:route.target}:{})});
  assert.equal(row.eventId,'verbal-release');assert.equal(row.kind,'verbal');assert.equal(row.choiceIndex,0);assert.equal(row.speaker,route.target);
  assert.equal(row.verbalOutcome.kind,route.branch);assert.equal(row.verbalOutcome.target,route.target);assert.equal(row.verbalOutcome.origin,source.eventId);assert.equal(row.verbalOutcome.phase,route.phase);
  assert.ok(Number.isInteger(row.verbalOutcome.affinityDelta)&&row.verbalOutcome.affinityDelta>=-60&&row.verbalOutcome.affinityDelta<=12);
  assert.equal(pending.verbalContext.eventId,source.eventId);assert.equal(pending.verbalContext.phase,route.phase);assert.equal(pending.verbalContext.pendingEffect,source.pendingEffect);assert.equal(pending.verbalContext.pendingFamily,source.pendingFamily);
  assert.equal(pending.lastVerbalTurn,source.turn);assert.equal(pending.turn,source.turn);assert.notEqual(pending.rng,source.rng);assert.equal(validRun(copy(pending)),true);
  assert.deepEqual(request(source,route.target),pending,'the same seed and action resolve identically');
  assert.deepEqual(replayRun(route.roleId,route.seed,pending.actions),advance(pending));
 }
});

test('verbal relationships belong only to the selected person and never count as an imagined or real hit',()=>{
 for(const route of routes.filter(route=>route.kind==='target')){
  const source=sourceFor(route),pending=request(source,route.target),outcome=pending.history.at(-1).verbalOutcome;
  const before=deriveCharacterStats(source),after=deriveCharacterStats(pending),badges=deriveAchievements(pending),oldBadges=deriveAchievements(source);
  for(const id of CHARACTER_IDS){
   const old=before.find(row=>row.id===id),next=after.find(row=>row.id===id);
   assert.equal(next.imaginedHits,old.imaginedHits);assert.equal(next.realHits,old.realHits);
   assert.equal(badges.includes(`real-hit-${id}`),oldBadges.includes(`real-hit-${id}`));assert.equal(badges.includes(`dream-${id}`),oldBadges.includes(`dream-${id}`));
   if(id!==route.target){assert.deepEqual(next,old,`${route.id}/${id}`);continue;}
   const affinity=characterAffinity(source,id).score,actual=Math.max(0,Math.min(100,affinity+outcome.affinityDelta))-affinity;
   assert.equal(next.encounters-old.encounters,1);assert.equal(next.affinityGained-old.affinityGained,Math.max(0,actual));assert.equal(next.affinityLost-old.affinityLost,Math.max(0,-actual));
   assert.equal(next.affinityUpEvents-old.affinityUpEvents,Number(actual>0));assert.equal(next.affinityDownEvents-old.affinityDownEvents,Number(actual<0));
  }
  if(route.target==='self')assert.deepEqual(after,before,'air is not secretly another character');
 }
});

test('only co-present people can be selected and solo or self scenes keep their one-click default',()=>{
 for(const route of routes.filter(route=>route.kind==='group')){
  const source=sourceFor(route);assert.deepEqual(getVerbalTargets(source),['erich','jenjen','sonny']);
  const pending=requestVerbal(source,route.target);assert.equal(pending.verbalContext.target,route.target);
  for(const target of ['wing','sam','unknown','__proto__',null,1])assert.equal(requestVerbal(source,target),source);
 }
 for(const id of ['target-event-wing','target-result-wing','target-event-self','target-result-self']){
  const route=get(id),source=sourceFor(route);assert.deepEqual(getVerbalTargets(source),[route.target]);
  assert.equal(requestVerbal(source,route.target),source,'optional explicit targets belong only to multi-person conversations');
  assert.equal(requestVerbal(source).verbalContext.target,route.target);
 }
});

test('recursive actions, exhausted mood, completed lives and already decided endings cannot create a new verbal exchange',()=>{
 const zero=sourceFor(get('zero-mood'));assert.equal(zero.stats.mood,0);assert.equal(canRequestVerbal(zero),false);assert.equal(requestVerbal(zero),zero);
 for(const route of routes.filter(route=>route.kind==='outcome')){
  const source=sourceFor(route),pending=request(source,route.target);
  assert.equal(canRequestVerbal(pending),false);assert.equal(requestVerbal(pending),pending);assert.equal(requestRage(pending),pending);
  for(const operation of [requestExit,requestBreak,requestCareer,requestRaise])assert.equal(operation(pending),pending);
  const ended=replayRun(route.roleId,route.seed,route.completionActions);assert.equal(canRequestVerbal(ended),false);assert.equal(requestVerbal(ended),ended);
 }
 const source=sourceFor(get('target-event-wing')),rage=requestRage(source);assert.equal(canRequestVerbal(rage),false);assert.equal(requestVerbal(rage),rage);
 const ending=applyChoice(createRun('sales','e30-verbal-decided'),2);assert.ok(ending.pendingFamily);assert.equal(canRequestVerbal(ending),false);assert.equal(requestVerbal(ending),ending);
});

test('the per-turn limit prevents repeated gain while event- and result-phase restoration resolve original work only once',()=>{
 for(const route of routes.filter(route=>route.kind==='target')){
  const source=sourceFor(route),pending=request(source,route.target),after=advance(pending);
  assert.equal(requestVerbal(pending),pending);
  if(after.turn===source.turn){assert.equal(canRequestVerbal(after),false);assert.equal(requestVerbal(after),after);}
  if(['ignored','relationship','retort','support'].includes(route.branch)){
   assert.equal(after.verbalContext,null);
   if(route.phase==='event'){assert.equal(after.eventId,source.eventId);assert.equal(after.turn,source.turn);}
   else{const plain=advance(source);assert.equal(after.turn,plain.turn);assert.deepEqual(after.pip,plain.pip);assert.equal(after.pipCount,plain.pipCount);}
  }
 }
});

test('meal, appointment, salary, PIP and banquet continuations retain their real context across a mild verbal interruption',()=>{
 for(const name of ['meal','patronage','raise','pip','banquet'])for(const phase of ['event','result']){
  const route=get(`${name}-${phase}`),source=sourceFor(route),pending=request(source,route.target),after=advance(pending),plain=phase==='result'?advance(source):source;
  assert.ok(['ignored','relationship','retort','support'].includes(route.branch));assert.equal(after.verbalContext,null);
  for(const key of ['mealContext','patronage','patronageContext','raiseContext','pip','banquetReturnEventId']){
   assert.deepEqual(pending[key],source[key],`${name}/${phase}/${key}/pending`);assert.deepEqual(after[key],plain[key],`${name}/${phase}/${key}/return`);
  }
  assert.equal(after.turn,plain.turn);assert.deepEqual(after.history.slice(0,source.history.length),source.history);
 }
});

test('a resolved mood-collapse recovery can speak before continuing without losing or replaying its recovery payment',()=>{
 const route=get('meltdown-result'),source=sourceFor(route);assert.equal(source.eventId,'mood-collapse');assert.equal(source.pending,true);assert.ok(source.stats.mood>0);assert.ok(source.meltdownReturnEventId);
 const pending=request(source,route.target),after=advance(pending),plain=advance(source);
 assert.ok(['ignored','relationship','retort','support'].includes(route.branch));assert.equal(validRun(copy(pending)),true);assert.equal(validRun(copy(after)),true);
 assert.deepEqual(pending.history.slice(0,source.history.length),source.history);assert.equal(pending.meltdownReturnEventId,source.meltdownReturnEventId);
 assert.equal(after.meltdownReturnEventId,plain.meltdownReturnEventId);assert.equal(after.eventId,plain.eventId);assert.equal(after.turn,plain.turn);assert.equal(after.stats.cash,source.stats.cash);
 assert.deepEqual(replayRun(route.roleId,route.seed,pending.actions),after);
});

test('post-PIP personnel responses do not invent a fresh improvement plan and warnings offer three real decisions',()=>{
 const route=get('post-pip-personnel'),source=sourceFor(route),pending=request(source,route.target),after=advance(pending);
 assert.ok(source.flags.post_pip_tolerance);assert.equal(route.branch,'personnel');assert.equal(after.eventId,'dismissal-final');assert.equal(after.pipCount,source.pipCount);assert.ok(!after.pip?.active);
 for(const index of [0,1,2]){
  const route=get(`warning-${index}`),warning=replayRun(route.roleId,route.seed,route.followupActions);assert.equal(warning.eventId,'verbal-warning');assert.equal(getEvent(warning).choices.length,3);
  const selected=applyChoice(warning,index),resolved=advance(selected);assert.equal(selected.history.at(-1).choiceIndex,index);assert.equal(selected.pipCount,warning.pipCount);
  if(index===2){assert.equal(resolved.completed,true);assert.equal(family(resolved),'ragequit');}else assert.equal(resolved.verbalContext,null);
 }
});

test('all legal responses have withdrawn, settled and pending outcomes and a lawyer fee is charged exactly once',()=>{
 for(const index of [0,1,2])for(const result of ['withdrawn','settled','pending']){
  const route=get(`legal-${index}-${result}`),legal=replayRun(route.roleId,route.seed,route.legalActions);assert.equal(legal.eventId,'verbal-legal');assert.equal(getEvent(legal).choices.length,3);
  const pending=applyChoice(legal,index),after=advance(pending);assert.equal(pending.verbalContext.legalResult,result);assert.equal(after.eventId,'verbal-legal-result');assert.equal(getEvent(after).choices.length,1);
  assert.equal(pending.stats.cash,legal.stats.cash-(index===2?12:0));assert.equal(applyChoice(pending,index),pending);assert.equal(pending.turn,legal.turn);assert.equal(pending.pipCount,legal.pipCount);
  assert.equal(validRun(copy(pending)),true);assert.deepEqual(replayRun(route.roleId,route.seed,after.actions),after);
  const closed=advance(applyChoice(after,0));assert.equal(closed.verbalContext,null);assert.equal(validRun(copy(closed)),true);
 }
});

test('forged action phases, targets, scenes, result metadata and direct internal release choices fail replay validation',()=>{
 const route=get('group-result-sonny'),source=sourceFor(route),pending=request(source,'sonny'),actions=copy(pending.actions);
 const rejected=[
  {...actions.at(-1),phase:'event'}, {...actions.at(-1),phase:'later'}, {...actions.at(-1),target:'wing'},
  {...actions.at(-1),eventId:'onboarding'}, {...actions.at(-1),outcome:'support'}, {...actions.at(-1),extra:true},
 ];
 for(const action of rejected)assert.throws(()=>replayRun(route.roleId,route.seed,[...actions.slice(0,-1),action]));
 assert.throws(()=>replayRun(route.roleId,route.seed,[...source.actions,{type:'choice',eventId:'verbal-release',index:0}]));
 for(const change of [state=>{state.verbalContext.target='wing';},state=>{state.verbalContext.phase='event';},state=>{state.history.at(-1).verbalOutcome.target='wing';},state=>{state.lastVerbalTurn=state.turn+1;}]){
  const forged=copy(pending);change(forged);assert.equal(validRun(forged),false);
 }
});

test('a verbal response cannot strand an already exhausted character ahead of the ordinary resource ending',()=>{
 const route=get('resource-ending'),run=replayRun(route.roleId,route.seed,route.actions);assert.equal(run.completed,true);
 assert.ok(['burnout','breakdown','broke'].includes(family(run)));assert.equal(run.verbalContext,null);assert.equal(validRun(copy(run)),true);
});
