import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRun,getEvent,applyChoice,advance,replayRun,validRun,requestExit,requestBreak,requestCareer,requestRaise,requestRage,requestVerbal,requestSalaryAdvice,canRequestBreak,canRequestCareer,canRequestRaise,canRequestRage,canRequestVerbal,jobTitle} from '../dist/engine.js';
import {CHAPTER_FAMILIES_V38,RESOURCE_FAMILIES_V38,chapterDepartureCopyV38} from '../dist/chapters-v38.js';
import {ROLES} from '../dist/roles.js';
import {ENDINGS} from '../dist/endings.js';
import {deriveAchievements} from '../dist/achievements.js';
import {displayText} from '../dist/persona.js';
import {buildEndingTransition} from '../dist/ending-transition-v40.js';
import {simulate,replayRoute} from './find-routes-v3.mjs';

const fixture=JSON.parse(await readFile(new URL('./fixtures/chapters-e38-routes.json',import.meta.url),'utf8'));
const routeFor=(family,role='sales')=>fixture.routes.find(route=>route.target===family&&route.roleId===role);
const checkpoint=route=>replayRun(route.roleId,route.seed,route.actions.slice(0,-1));
const clone=value=>JSON.parse(JSON.stringify(value));

test('all thirteen occupations have naturally replayed continue-or-leave checkpoints for all fifteen milestones and two exhausted-resource departures',()=>{
 assert.deepEqual(fixture.missing,[]);assert.equal(fixture.routes.length,ROLES.length*(CHAPTER_FAMILIES_V38.length+RESOURCE_FAMILIES_V38.length));
 for(const route of fixture.routes){
  assert.ok(route.seed.startsWith('e38-'));
  const staged=checkpoint(route),before=JSON.stringify(staged),event=getEvent(staged);
  assert.equal(staged.completed,false,route.ending);assert.equal(staged.endingId,null,route.ending);assert.equal(staged.eventId,'chapter-resolution');
  assert.equal(staged.chapterContext.family,route.target);assert.equal(staged.flags.departure38_voluntary,undefined);
  assert.equal(event.choices[1].effect,'chapterExit');assert.match(event.choices[1].text,/離職/);assert.ok(event.resolvedChapter.result);
  assert.equal(JSON.stringify(staged),before,'reading the checkpoint never draws or changes it');assert.equal(validRun(clone(staged)),true,route.ending);
  for(const request of [requestExit,requestBreak,requestCareer,requestRaise,requestRage,requestVerbal,requestSalaryAdvice])assert.equal(request(staged),staged,`${route.ending}: no shortcut can skip employment consent`);
  for(const allowed of [canRequestBreak,canRequestCareer,canRequestRaise,canRequestRage,canRequestVerbal])assert.equal(allowed(staged),false);
  const finalChoice=applyChoice(staged,1);assert.equal(finalChoice.pending,true);assert.equal(finalChoice.completed,false);assert.equal(validRun(clone(finalChoice)),true,`${route.ending}: pending exit survives JSON save`);
  const finished=advance(finalChoice);assert.equal(finished.completed,true);assert.equal(finished.endingId,route.ending);assert.equal(finished.flags.departure38_voluntary,1);
  assert.equal(finished.chapterContext,null);assert.equal(finished.rng,staged.rng,'the exit confirmation draws no extra RNG');assert.equal(finished.turn,staged.turn,'confirming an exit is not a workday');
  assert.equal(validRun(clone(finished)),true,route.ending);assert.deepEqual(finished,replayRun(route.roleId,route.seed,finished.actions));
  assert.equal(buildEndingTransition(finished,ENDINGS.find(ending=>ending.id===finished.endingId)).employment.kind,'voluntary');
  const displayed=chapterDepartureCopyV38(finished,ENDINGS.find(ending=>ending.id===finished.endingId));assert.match(displayed.body,/提出離職|確認離職/);
 }
});

test('choosing to continue retains the job, pay and committed source history, resumes its original work only once, and keeps earned speech milestones',()=>{
 for(const route of fixture.routes.filter(route=>CHAPTER_FAMILIES_V38.includes(route.target))){
  const staged=checkpoint(route),context=clone(staged.chapterContext),before=clone(staged.history),pay=staged.pay,title=jobTitle(staged),rank=staged.rank;
  const pending=applyChoice(staged,0);assert.equal(pending.pending,true);assert.equal(validRun(clone(pending)),true,`${route.ending}: pending continue survives JSON save`);
  const next=advance(pending);assert.equal(next.completed,false,route.ending);assert.equal(next.endingId,null);assert.equal(next.chapterContext,null);assert.equal(next.flags.departure38_voluntary,undefined);
  assert.equal(next.pay,pay);assert.equal(next.rank,rank);assert.equal(jobTitle(next),title);assert.deepEqual(next.history.slice(0,before.length),before);
  assert.equal(next.history.length,before.length+1);assert.equal(next.history.at(-1).eventId,'chapter-resolution');assert.equal(next.actions.length,staged.actions.length+1);
  assert.deepEqual(next.stats,staged.stats,'the checkpoint neither restores nor drains resources');assert.ok(next.turn>=staged.turn&&next.turn<=staged.turn+1,'only the suspended source may complete a workday');
  if(context.rage?.phase==='event')assert.equal(next.turn,staged.turn,'a real outburst before answering returns to the unanswered source');
  if(context.verbal?.phase==='event'&&['daily','fantasy'].includes(context.verbal.sourceKind))assert.equal(next.turn,staged.turn+1,'an actual work-scene response finishes exactly one workday');
  assert.equal(validRun(clone(next)),true,route.ending);assert.deepEqual(next,replayRun(next.roleId,next.seed,next.actions));
  assert.equal(advance(next),next,'a stale continue does not resume the source twice');
  if(route.target.startsWith('verbal_'))assert.ok(deriveAchievements(staged).some(id=>id.startsWith('verbal-')),'the already resolved speech is a mid-story achievement');
 }
});

test('exhausted resources do not fabricate a dismissal or silently end a life before its explicit departure response',()=>{
 for(const family of RESOURCE_FAMILIES_V38){
  const staged=checkpoint(routeFor(family));assert.equal(staged.completed,false);assert.ok(staged.stats[family==='burnout'?'energy':'cash']===0);
  for(const index of [0,1]){
   const pending=applyChoice(staged,index);assert.equal(pending.completed,false);assert.equal(pending.flags.departure38_voluntary,1);
   const final=advance(pending);assert.equal(final.completed,true);assert.equal(final.endingId,`${family}-${staged.roleId}`);
  }
 }
});

test('mood-zero, exhausted-resource and active-PIP checkpoints cannot be overwritten by a secondary crisis or consume a PIP tick',()=>{
 const risky=fixture.routes.map(route=>({route,run:checkpoint(route)})).filter(({run})=>run.stats.mood===0||run.pip?.active);
 assert.ok(risky.some(({run})=>run.stats.mood===0));assert.ok(risky.some(({run})=>run.pip?.active));
 for(const {run} of risky){
  assert.equal(run.eventId,'chapter-resolution');assert.equal(getEvent(run).id,'chapter-resolution');
  const before=JSON.stringify(run);assert.equal(advance(run),run);assert.equal(JSON.stringify(run),before);assert.equal(validRun(clone(run)),true);
  const pending=applyChoice(run,1);assert.equal(pending.eventId,'chapter-resolution');assert.equal(validRun(clone(pending)),true);
  const completed=advance(pending);assert.equal(completed.completed,true);assert.equal(completed.pip?.remaining,run.pip?.remaining);assert.equal(completed.flags.mood_crash_count,run.flags.mood_crash_count);
 }
});

test('continuing a salary, promotion or labor milestone returns to explicit source consent without granting the proposal',()=>{
 for(const origin of ['salary-cut','career-review','labor-mediation']){
  const route=fixture.routes.find(route=>checkpoint(route).chapterContext.verbal?.eventId===origin);assert.ok(route,origin);
  const staged=checkpoint(route),before={pay:staged.pay,rank:staged.rank,salaryCut:clone(staged.salaryCut),history:clone(staged.history)};
  const next=advance(applyChoice(staged,0));assert.equal(next.completed,false);assert.equal(next.eventId,'verbal-v2-decision',origin);
  assert.equal(next.pay,before.pay);assert.equal(next.rank,before.rank);assert.deepEqual(next.salaryCut,before.salaryCut);assert.deepEqual(next.history.slice(0,before.history.length),before.history);
  assert.ok(getEvent(next).choices.every(choice=>choice.effect==='verbalV2Choose'));assert.equal(validRun(clone(next)),true);
 }
});

function resultCheckpoint(kind){
 for(let attempt=0;attempt<100;attempt++){
  let source=advance(applyChoice(createRun('sales',`e38-result-${kind}-${attempt}`),0));
  if(getEvent(source).kind!=='daily')continue;
  source=applyChoice(source,0);if(!(kind==='rage'?canRequestRage(source):canRequestVerbal(source)))continue;
  const opened=advance(kind==='rage'?requestRage(source):requestVerbal(source,undefined,2));
  const search=(run,depth)=>{
   if(run.chapterContext&&CHAPTER_FAMILIES_V38.includes(run.chapterContext.family))return run;
   if(run.completed||depth===0||kind==='rage'&&!run.rageContext||kind==='verbal'&&!run.verbalContext)return null;
   const event=getEvent(run);
   for(let index=0;index<event.choices.length;index++)if(event.choices[index].available!==false){const found=search(advance(applyChoice(run,index)),depth-1);if(found)return found;}
   return null;
  };
  const staged=search(opened,kind==='rage'?4:2);if(staged)return {source,staged};
 }
 throw new Error(`Missing natural ${kind} after-result checkpoint`);
}

test('a chapter after an already committed work result resumes that exact choice once, for speech and real rage',()=>{
 for(const kind of ['verbal','rage']){
  const {source,staged}=resultCheckpoint(kind),sourceHistory=clone(source.history),remaining=staged.pip?.remaining;
  assert.equal(staged.chapterContext[kind==='rage'?'rage':'verbal'].phase,'result');
  const pending=applyChoice(staged,0);assert.equal(validRun(clone(pending)),true);
  const next=advance(pending);assert.equal(next.completed,false);assert.equal(next.chapterContext,null);
  assert.equal(next.turn,advance(source).turn);assert.equal(next.pay,source.pay);assert.equal(next.rank,source.rank);assert.equal(next.pip?.remaining,remaining);
  assert.deepEqual(next.history.slice(0,sourceHistory.length),sourceHistory);assert.deepEqual(next.stats,staged.stats,'work effects and fees do not run again');
  assert.equal(validRun(clone(next)),true);assert.deepEqual(next,replayRun(next.roleId,next.seed,next.actions));
 }
});

test('tampered suspended contexts, milestones, source rows or claimed departures cannot pass saved-life validation',()=>{
 const staged=checkpoint(routeFor('verbal_wing_concession'));
 const variants=[
  run=>run.chapterContext.family='verbal_rick_awake',run=>run.chapterContext.historyIndex--,
  run=>run.chapterContext.actionIndex--,run=>run.chapterContext.verbal.line+=' forged',
  run=>run.chapterContext.extra=true,run=>run.chapterContext.runId='nested ignored field',
  run=>run.history.at(-1).result='invented result',run=>run.stats.mood++,
  run=>run.flags.departure38_voluntary=1,run=>run.flags.chapter38_verbal_wing_concession++,
  run=>run.actions.pop(),run=>run.rng=run.rng===1?2:1
 ];
 for(const mutate of variants){const forged=clone(staged);mutate(forged);assert.equal(validRun(forged),false,mutate.toString());}
});

test('company future finales still conclude at their real grand event; losing Wing is not a player dismissal',()=>{
 for(const target of ['nasdaq','taiwan','nasdaq_failed','taiwan_failed','google_board','google_ousted','buyer_board','buyer_ousted','vietnam_core','vietnam_afterdark','rage_coup']){
  let found;
  for(let attempt=0;attempt<400&&!found;attempt++){const result=simulate('sales',target,attempt,{seedPrefix:'e38'});if(result.run.completed&&result.run.endingId===`${target}-sales`)found=result;}
  assert.ok(found,target);assert.equal(found.run.chapterContext,null);assert.equal(found.run.flags.departure38_voluntary,undefined);assert.equal(validRun(clone(found.run)),true,target);
  assert.deepEqual(found.run,replayRoute(found.route));
 }
});

test('new ordinary career exit menus say departure explicitly and preserve the eight-stage career and professor features',()=>{
 let found;
 for(let attempt=0;attempt<100&&!found;attempt++){
  const result=simulate('sales','slacker',attempt,{seedPrefix:'e38'});if(result.run.endingId==='slacker-sales')found=result;
 }
 assert.ok(found);assert.equal(found.run.flags.departure38_voluntary,1);assert.match(found.run.history.at(-1).choiceText,/確認離職/);assert.match(found.run.history.at(-1).result,/明確確認離職/);
 assert.equal(createRun('executive','e38-full-eight').rank,5);assert.ok(createRun('admin','e38-backoffice').characterGender);
});

test('all 195 profession-specific milestone cards separate the old on-job episode from the actual new departure',()=>{
 for(const route of fixture.routes.filter(route=>CHAPTER_FAMILIES_V38.includes(route.target))){
  const run=replayRun(route.roleId,route.seed,route.actions),original=ENDINGS.find(ending=>ending.id===run.endingId),before=JSON.stringify(original);
  const copy=chapterDepartureCopyV38(run,original);
  assert.match(copy.body,/後來，你明確提出離職、確認交接，離開這份工作/);assert.match(copy.body,/這次，才是這段任職的最後一天/);
  assert.doesNotMatch(copy.body,/你仍在這間公司工作。|你仍得把工作做好|你仍在職/,'the main new departure is not written as continued employment');
  assert.equal(copy.retrospectiveBody,displayText(original.body),'the old profession-specific episode remains an explicitly historical section');
  assert.equal(JSON.stringify(original),before,'published ending objects stay unchanged');
 }
});
