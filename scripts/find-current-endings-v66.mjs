import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,readdirSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {simulate} from '../tests/find-routes-v3.mjs';
import * as E from '../dist/engine.js';
import {ENDINGS,FAMILIES} from '../dist/endings.js';
import {ROLES} from '../dist/roles.js';
import {isExpansionV65} from '../dist/expansion-profile-v65.js';
import {isPrivateSceneV39} from '../dist/private-scenes-v39.js';
import {VERBAL_ENDING_IDS_V32} from '../dist/verbal-outcomes-v32.js';

export const CURRENT_ENDING_SEARCH_VERSION_V66=6;
export const CURRENT_ENDING_METHOD_V66='Current r66 starts with the app activity calendar and automatic catch-up hooks. Public actions only, no state or RNG injection; each completed life passes canonical replay and save validation. 目標導向合法操作，不代表一般玩家隨機就能碰齊。';
export const currentSourceSha256V66=()=>Object.fromEntries(readdirSync(new URL('../dist/',import.meta.url)).filter(name=>name.endsWith('.js')).sort().map(name=>[name,createHash('sha256').update(readFileSync(new URL(`../dist/${name}`,import.meta.url))).digest('hex')]));

// Unlike the historical compatibility witnesses, every life here uses the
// currently offered seed and the app's automatic salary/invitation/encounter
// hooks. Public choices may be inspected for search, never injected as state.
export function advanceCurrentV66(run){
 const navigation=['mealOpen','mealPage','mealCancel'].includes(run.pendingEffect)&&!run.pendingFamily;
 const skip=run.treatsContext||run.departureContext||run.blockchainContext||navigation;
 let next=E.advance(run);
 if(!skip&&!next.completed){
  next=E.requestSalaryAdvice(next);
  next=E.enableActivitySchedule(next);
  if(E.canRequestActivityInvitation(next))next=E.requestActivityInvitation(next);
  next=E.requestHiddenEncounter(next);
 }
 return next;
}
export const currentSeedV66=(role,target,attempt)=>'e39-r66-n-'+createHash('sha256').update(`current66:${role}:${target}:${attempt}`).digest('hex').slice(0,22);
// The default remains the published r66 search. New cohorts may reuse the
// same public navigation strategy with their own strict seed and proof label.
const DEFAULT_PROFILE_V66=Object.freeze({id:'e39-r66-n',strategyVersion:CURRENT_ENDING_SEARCH_VERSION_V66,method:CURRENT_ENDING_METHOD_V66,seedFactory:currentSeedV66,isEnabled:isExpansionV65,testSeed:seed=>/^e39-r66-n-[0-9a-f]{22}$/.test(seed||'')});
const checkedProfile=profile=>{
 const selected=profile||DEFAULT_PROFILE_V66;
 if(typeof selected.id!=='string'||!Number.isSafeInteger(selected.strategyVersion)||selected.strategyVersion<1||typeof selected.method!=='string'||!['seedFactory','isEnabled','testSeed'].every(key=>typeof selected[key]==='function')||selected.beforeStep!==undefined&&typeof selected.beforeStep!=='function')throw new Error('Invalid current search profile');
 return selected;
};
const VERBAL_GUESTS=Object.freeze({verbal_wing_concession:'wing',verbal_boardroom:'spencer',verbal_rick_awake:'rick',verbal_hr_rewrite:'hope',verbal_legal_letter:'erich',verbal_sonny_statement:'sonny',verbal_kind_ghost:'kind',verbal_colleague_solidarity:'jack',verbal_viral:'wing',verbal_mutual_mute:'wing',verbal_apology:'wing'});
export function stepCurrentV66(run,target,{attempt=0}={}){
 if(target==='merged_out'&&run.roleId==='executive'&&attempt%2===1&&!run.flags.merge_notice&&(run.flags.departure63_work||0)<4){
  const event=E.getEvent(run);
  if(event.kind==='daily'&&event.speaker==='jenjen'&&!event.choices.some(choice=>choice.flags?.includes('merge_notice'))&&E.getEventDepartureV63(run)?.available){
   const left=E.requestEventDepartureV63(run);if(left.stats.boss>20)return advanceCurrentV66(left);
  }
 }
 if(target==='consultant'&&!run.flags.consultant_offer&&run.rank>=5){
  const source=E.getEvent(run),offer=event=>event?.choices.findIndex(choice=>choice.available!==false&&choice.effect==='storyCareer'&&choice.flags?.includes('consultant_offer'));
  if(source.id==='rank-exit'){const index=offer(source);if(index>=0)return advanceCurrentV66(E.applyChoice(run,index));}
  // Open the real departure menus on a copy. Only follow this public route
  // when it actually offers the current cohort's bounded advisory proposal.
  const exited=E.requestExit(run);
  if(exited!==run){const menu=E.getEvent(exited),index=menu.choices.findIndex(choice=>choice.effect==='careerExit'&&choice.available!==false);
   if(index>=0){const ranked=advanceCurrentV66(E.applyChoice(exited,index)),event=E.getEvent(ranked);if(event?.id==='rank-exit'&&offer(event)>=0)return ranked;}
  }
 }
 if(run.shareholderContext?.stage==='offer'&&target!=='broke')return advanceCurrentV66(E.applyChoice(run,2));
 if(E.getShareholderPlayV58(run))return advanceCurrentV66(E.applyShareholderPlay(run,{mode:'yield',statement:0,evidence:null}));
 // An unwanted mini-game can be left through the same public button as in
 // the app. It is never forged as a played or completed activity.
 if(E.getActivityPlayV55(run)&&E.getEventDepartureV63(run)?.available)return advanceCurrentV66(E.requestEventDepartureV63(run));
 if(!VERBAL_ENDING_IDS_V32.includes(target)||!E.canRequestVerbal(run))return null;
 const event=E.getEvent(run),onboarding=event.id==='onboarding';
 if(target==='verbal_onboarding'?!onboarding:onboarding||isPrivateSceneV39(event))return null;
 const guests=E.getVerbalTargets(run),guest=VERBAL_GUESTS[target];
 if(target!=='verbal_onboarding'&&!guests.includes(guest))return null;
 if(!guests.length)return null;
 const spoken=E.requestVerbal(run,guests.length>1?guest:undefined,2);
 return spoken===run?null:advanceCurrentV66(spoken);
}
export function currentUtilityBonusV66(run,preview,target){
 if(target==='promotion'&&run.roleId==='executive'){
  const readiness=s=>Math.max(0,Math.min(s.skill,90)-65)*2+Math.max(0,Math.min(s.boss,82)-50)*2;
  return readiness(preview.stats)-readiness(run.stats);
 }
 if(!['venture_independent','venture_restart','retired_free','retired_flexible'].includes(target))return 0;
 const remainingPaydays=Math.max(0,Math.floor((24-run.turn)/3));
 return (Math.round(preview.pay/10)-Math.round(run.pay/10))*remainingPaydays*6;
}
export function simulateCurrentV66(role,target,attempt,{profile=null}={}){
 const selected=checkedProfile(profile),seed=selected.seedFactory(role,target,attempt);
 if(!selected.testSeed(seed)||!selected.isEnabled(seed))throw new Error('Current profile is not enabled yet');
 const result=simulate(role,target,attempt,{seedPrefix:'e39',seedFactory:selected.seedFactory,initialiseRun:E.enableActivitySchedule,advanceRun:advanceCurrentV66,beforeStep:(run,target)=>(selected.beforeStep||stepCurrentV66)(run,target,{attempt}),utilityBonus:currentUtilityBonusV66,genericVerbal:true});
 if(result.run.actions[0]?.type!=='activity-schedule')throw new Error('Missing current calendar');
 return {...result,route:{...result.route,actions:result.run.actions}};
}
export function findCurrentEndingsV66({maxAttempts=100,roles=ROLES.map(row=>row.id),families=FAMILIES.map(row=>row.id),resume=null,discardDriftedResume=false,onProgress=console.log,onCheckpoint=()=>{},profile=null}={}){
 const selected=checkedProfile(profile);
 if(!Number.isSafeInteger(maxAttempts)||maxAttempts<1)throw new Error('maxAttempts must be a positive integer');
 if(!roles.length||roles.some(role=>!ROLES.some(row=>row.id===role))||!families.length||families.some(family=>!FAMILIES.some(row=>row.id===family)))throw new Error('Unknown role or ending family');
 if(!selected.isEnabled(selected.seedFactory(roles[0],families[0],0)))throw new Error('Current profile is not enabled yet');
 const found=new Map(),attempts=new Map(),discardedResume=[],discardedTargets=new Set(),expected=ENDINGS.filter(row=>roles.includes(row.roleId)&&families.includes(row.family));
 for(const route of resume?.routes||[]){
  try{
   if(!selected.testSeed(route.seed)||!ENDINGS.some(row=>row.id===route.ending&&row.roleId===route.roleId))throw new Error('Invalid current resume route');
   const replay=E.replayRun(route.roleId,route.seed,route.actions);
   if(!replay.completed||replay.endingId!==route.ending||!E.validRun(replay))throw new Error(`Invalid resumed witness ${route.ending}`);
   found.set(route.ending,{...route,turn:replay.turn,rank:replay.rank,stats:replay.stats});
  }catch(error){
   if(!discardDriftedResume)throw error;
   discardedResume.push({ending:route.ending,error:error.message});
   const ending=ENDINGS.find(row=>row.id===route.ending);if(ending)discardedTargets.add(`${ending.roleId}:${ending.family}`);
  }
 }
 for(const row of resume?.strategyVersion===selected.strategyVersion&&(!resume.profile||resume.profile===selected.id)?resume.attempts||[]:[]){
  const key=`${row.roleId}:${row.family}`;
  if(!discardedTargets.has(key)&&Number.isSafeInteger(row.attempts)&&row.attempts>=0)attempts.set(key,row);
 }
 const sourceSha256=currentSourceSha256V66();
 const report=()=>{
  const missing=expected.filter(row=>!found.has(row.id)).map(row=>row.id);
  return {method:selected.method,profile:selected.id,strategyVersion:selected.strategyVersion,complete:missing.length===0,expected:expected.length,found:found.size,missing,attempts:[...attempts.values()],...(discardedResume.length?{discardedResume}:{}),sourceSha256,routes:[...found.values()].sort((a,b)=>a.ending.localeCompare(b.ending))};
 };
 const save=run=>{
  if(!run.completed||found.has(run.endingId))return;
  const replay=E.replayRun(run.roleId,run.seed,run.actions);
  if(!E.validRun(run)||JSON.stringify(replay)!==JSON.stringify(run))throw new Error(`Invalid current witness ${run.endingId}`);
  found.set(run.endingId,{ending:run.endingId,roleId:run.roleId,seed:run.seed,actions:run.actions,turn:run.turn,rank:run.rank,stats:run.stats});
 };
 for(const role of roles)for(const family of families){
  const ending=`${family}-${role}`,key=`${role}:${family}`;if(!ENDINGS.some(row=>row.id===ending)||found.has(ending))continue;
  let attempt=attempts.get(key)?.attempts||0;
  for(;attempt<maxAttempts&&!found.has(ending);attempt++){
   const {run}=simulateCurrentV66(role,family,attempt,{profile:selected});save(run);
   if((attempt+1)%25===0){attempts.set(key,{roleId:role,family,attempts:attempt+1,found:found.has(ending),total:found.size});onCheckpoint(report());}
  }
  const row={roleId:role,family,attempts:attempt,found:found.has(ending),total:found.size};attempts.set(key,row);onProgress(JSON.stringify(row));onCheckpoint(report());
 }
 return report();
}
export function currentEndingFixtureV66(report,{profile=null}={}){
 const selected=checkedProfile(profile);
 const ids=new Set(report?.routes?.map(route=>route.ending)||[]);
 if(!report?.complete||report.expected!==ENDINGS.length||report.routes.length!==ENDINGS.length||ids.size!==ENDINGS.length||ENDINGS.some(ending=>!ids.has(ending.id)))throw new Error('Current catalog proof is incomplete');
 for(const route of report.routes){
  if(!selected.testSeed(route.seed)||route.actions?.[0]?.type!=='activity-schedule')throw new Error(`Invalid current witness ${route.ending}`);
  const replay=E.replayRun(route.roleId,route.seed,route.actions);
  if(!replay.completed||replay.endingId!==route.ending||!E.validRun(replay))throw new Error(`Invalid current witness ${route.ending}`);
 }
 return {method:selected.method,profile:report.profile,strategyVersion:report.strategyVersion,choiceIndexBase:0,sourceSha256:currentSourceSha256V66(),routes:report.routes.map(({ending,roleId,seed,actions})=>({ending,roleId,seed,actions}))};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const arg=name=>{const prefix=`--${name}=`;return process.argv.find(value=>value.startsWith(prefix))?.slice(prefix.length);};
 const output=arg('output')||'artifacts/current-endings-v66.json',resume=arg('resume'),fixture=arg('fixture'),attempts=arg('attempts');
 mkdirSync(dirname(output),{recursive:true});
 const checkpoint=report=>writeFileSync(output,JSON.stringify(report,null,2)+'\n');
 const report=findCurrentEndingsV66({onCheckpoint:checkpoint,discardDriftedResume:process.argv.includes('--discard-drifted-resume'),maxAttempts:attempts===undefined?100:Number(attempts),...(arg('roles')?{roles:arg('roles').split(',')}:{}),...(arg('families')?{families:arg('families').split(',')}:{}),...(resume?{resume:JSON.parse(readFileSync(resume,'utf8'))}:{})});
 writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({complete:report.complete,expected:report.expected,found:report.found,missing:report.missing}));
 if(report.complete&&fixture){mkdirSync(dirname(fixture),{recursive:true});writeFileSync(fixture,JSON.stringify(currentEndingFixtureV66(report),null,2)+'\n');}
 if(!report.complete)process.exitCode=1;
}
