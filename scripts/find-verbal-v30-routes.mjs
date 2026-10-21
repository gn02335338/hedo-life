import {writeFileSync} from 'node:fs';
import {CHARACTER_IDS} from '../dist/character-stats.js';
import {VERBAL_KINDS_V30} from '../dist/verbal-v30.js';
import {createRun,getEvent,applyChoice,advance,requestExit,requestBreak,canRequestBreak,requestVerbal,canRequestVerbal,getVerbalTargets,replayRun,validRun} from '../dist/engine.js';
import {simulate,replayRoute} from '../tests/find-routes-v3.mjs';

const choose=(run,index)=>advance(applyChoice(run,index));
const targetRows=new Map(),outcomes=new Map(),legalRows=new Map(),warningRows=new Map(),groupRows=new Map(),contexts=new Map();
const mild=new Set(['ignored','relationship','retort','support']);
const targetKeys=['event','result'].flatMap(phase=>[...CHARACTER_IDS,'self'].map(target=>`target-${phase}-${target}`));
const legalKeys=[0,1,2].flatMap(index=>['withdrawn','settled','pending'].map(result=>`legal-${index}-${result}`));
const groupKeys=['event','result'].flatMap(phase=>['erich','jenjen','sonny'].map(target=>`group-${phase}-${target}`));
const contextKeys=['meal-event','meal-result','patronage-event','patronage-result','raise-event','raise-result','pip-event','pip-result','banquet-event','banquet-result','meltdown-result','post-pip-personnel','zero-mood','resource-ending'];
const copy=value=>JSON.parse(JSON.stringify(value));
const score=run=>(run.completed?10000:0)+run.stats.mood*1.5+run.stats.energy+run.stats.cash*.3+run.stats.boss*.5;
function finish(run,depth=15){
 if(run.completed)return run;if(depth<=0)return null;
 const leave=requestExit(run);if(leave!==run){const done=finish(leave,depth-1);if(done)return done;}
 const next=getEvent(run).choices.map((choice,index)=>({choice,index})).filter(({choice})=>choice.available!==false)
  .map(({index})=>choose(run,index)).sort((a,b)=>score(b)-score(a));
 for(const candidate of next){const done=finish(candidate,depth-1);if(done)return done;}
 return null;
}
function attempt(source,target){
 const targets=getVerbalTargets(source);
 if(!canRequestVerbal(source)||!targets.includes(target))return null;
 const pending=targets.length>1?requestVerbal(source,target):requestVerbal(source),resolved=advance(pending);
 if(pending===source)return null;
 return {source,target,pending,resolved,branch:pending.history.at(-1).verbalOutcome?.kind||pending.verbalContext?.outcome};
}
function row(id,kind,candidate,after=candidate.resolved,extra={}){
 const done=finish(after);if(!done)return null;
 const {source,target,pending,branch}=candidate;
 return {id,kind,roleId:source.roleId,seed:source.seed,sourceEventId:source.eventId,phase:source.pending?'result':'event',target,branch,
  baseActions:source.actions,actions:after.actions,completionActions:done.actions,endingId:done.endingId,
  expected:{eventId:after.eventId,turn:after.turn,endingId:after.endingId,affinityDelta:pending.history.at(-1).verbalOutcome?.affinityDelta},...extra};
}
function keep(map,id,kind,candidate,after,extra){
 if(map.has(id))return;const entry=row(id,kind,candidate,after,extra);if(entry)map.set(id,entry);
}
function inspectCandidate(candidate){
 if(!candidate)return;
 const {source,target,resolved,branch}=candidate,phase=source.pending?'result':'event';
 keep(targetRows,`target-${phase}-${target}`,'target',candidate);
 keep(outcomes,`outcome-${branch}`,'outcome',candidate);
 if(getVerbalTargets(source).join(',')==='erich,jenjen,sonny')keep(groupRows,`group-${phase}-${target}`,'group',candidate);
 if(mild.has(branch)){
  const names=[];
  if(source.mealContext?.guest)names.push('meal');
  if(source.patronageContext)names.push('patronage');
  if(source.raiseContext)names.push('raise');
  if(source.pip?.active)names.push('pip');
  if(source.banquetReturnEventId)names.push('banquet');
  if(source.meltdownReturnEventId)names.push('meltdown');
  for(const name of names)keep(contexts,`${name}-${phase}`,'context',candidate);
 }
 if(branch==='personnel'&&source.flags.post_pip_tolerance)keep(contexts,'post-pip-personnel','context',candidate);
 if(resolved.completed&&['burnout','breakdown','broke'].some(family=>resolved.endingId?.startsWith(`${family}-`)))keep(contexts,'resource-ending','context',candidate);
 if(resolved.eventId==='verbal-warning')for(const [index,choice]of getEvent(resolved).choices.entries())if(choice.available!==false){
  const next=choose(resolved,index);keep(warningRows,`warning-${index}`,'warning',candidate,next,{followupActions:resolved.actions,followupIndex:index});
 }
 if(resolved.eventId==='verbal-legal')for(const [index,choice]of getEvent(resolved).choices.entries())if(choice.available!==false){
  const pending=applyChoice(resolved,index),next=advance(pending),verdict=pending.verbalContext?.legalResult;
  keep(legalRows,`legal-${index}-${verdict}`,'legal',candidate,next,{legalActions:resolved.actions,legalIndex:index,legalResult:verdict});
 }
}
function inspect(source){
 if(source.completed)return;
 if(source.stats.mood===0&&!contexts.has('zero-mood')){
  contexts.set('zero-mood',{id:'zero-mood',kind:'blocked',roleId:source.roleId,seed:source.seed,sourceEventId:source.eventId,
   phase:source.pending?'result':'event',baseActions:source.actions,actions:source.actions});
 }
 if(!canRequestVerbal(source))return;
 for(const target of getVerbalTargets(source))inspectCandidate(attempt(source,target));
 if(!source.pending){
  for(const [index,choice]of getEvent(source).choices.entries())if(choice.available!==false)inspectResult(applyChoice(source,index));
 }
}
function inspectResult(source){
 if(source.stats.mood===0&&!contexts.has('zero-mood'))inspect(source);
 if(canRequestVerbal(source))for(const target of getVerbalTargets(source))inspectCandidate(attempt(source,target));
}
function tables(attemptNumber){
 const seed=`e30-verbal-tables-${attemptNumber}`;
 let run=choose(createRun('sales',seed),0);
 if(!canRequestBreak(run))return;
 let care=requestBreak(run);if(care.eventId==='kind-break')care=choose(care,1);
 if(care.eventId!=='self-care')return;
 inspect(care);
 const open=getEvent(care).choices.findIndex(choice=>choice.effect==='mealOpen'&&choice.available!==false);if(open<0)return;
 let first=choose(care,open),second=null;
 for(const target of CHARACTER_IDS){
  let menu=first,index=getEvent(menu).choices.findIndex(choice=>choice.mealTarget===target&&choice.available!==false);
  if(index<0){
   if(!second){const page=getEvent(first).choices.findIndex(choice=>choice.effect==='mealPage');second=choose(first,page);}
   menu=second;index=getEvent(menu).choices.findIndex(choice=>choice.mealTarget===target&&choice.available!==false);
  }
  if(index<0)continue;const table=choose(menu,index);
  inspect(table);
 }
}
const needed=()=>targetKeys.some(id=>!targetRows.has(id))||VERBAL_KINDS_V30.some(kind=>!outcomes.has(`outcome-${kind}`))||legalKeys.some(id=>!legalRows.has(id))||groupKeys.some(id=>!groupRows.has(id))||contextKeys.some(id=>!contexts.has(id))||warningRows.size<3;
const targets=['nasdaq','pip_exit','cold_storage','promotion','fired_refused','burnout','broke','career_chief'];
const maxAttempts=Number(process.argv[2]||300);
for(let attemptNumber=0;attemptNumber<maxAttempts&&needed();attemptNumber++){
 if(targetKeys.some(id=>!targetRows.has(id))||legalKeys.some(id=>!legalRows.has(id))||VERBAL_KINDS_V30.some(kind=>!outcomes.has(`outcome-${kind}`)))tables(attemptNumber);
 for(const [index,roleId]of ['system','sales','hr','executive'].entries()){
  const {route}=simulate(roleId,targets[(attemptNumber+index)%targets.length],attemptNumber,{seedPrefix:'e30',raise:attemptNumber%2===0});
  replayRoute(route,inspect);
 }
 if(attemptNumber%10===9)console.log(JSON.stringify({attempts:attemptNumber+1,targets:targetRows.size,outcomes:[...outcomes.keys()],legal:[...legalRows.keys()],groups:groupRows.size,contexts:[...contexts.keys()]}));
}
const missing=[...targetKeys.filter(id=>!targetRows.has(id)),...VERBAL_KINDS_V30.filter(kind=>!outcomes.has(`outcome-${kind}`)).map(kind=>`outcome-${kind}`),...legalKeys.filter(id=>!legalRows.has(id)),...groupKeys.filter(id=>!groupRows.has(id)),...contextKeys.filter(id=>!contexts.has(id)),...[0,1,2].filter(index=>!warningRows.has(`warning-${index}`)).map(index=>`warning-${index}`)];
if(missing.length)throw new Error(`Missing natural verbal witnesses: ${missing.join(', ')}`);
const routes=[...targetRows.values(),...outcomes.values(),...legalRows.values(),...warningRows.values(),...groupRows.values(),...contexts.values()];
for(const route of routes){
 if(route.kind==='blocked')continue;
 const resolved=replayRun(route.roleId,route.seed,route.actions),done=replayRun(route.roleId,route.seed,route.completionActions);
 if(!validRun(copy(resolved))||!validRun(copy(done))||!done.completed||done.endingId!==route.endingId)throw new Error(`Invalid verbal proof ${route.id}`);
}
writeFileSync(new URL('../tests/fixtures/verbal-routes-v30.json',import.meta.url),JSON.stringify({
 method:'Natural e30 createRun lives and canonical actions only. Meal tables reach every character, seeded full lives reach personnel/career/banquet contexts, and each verbal response/continuation is replayable without injecting gender, role, stats, events, history, flags or RNG.',
 routes
},null,2)+'\n');
console.log(JSON.stringify({targets:targetRows.size,outcomes:outcomes.size,legal:legalRows.size,warning:warningRows.size,groups:groupRows.size,contexts:contexts.size,routes:routes.length,missing}));
