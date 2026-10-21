import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import * as engine from '../dist/engine.js';
import {CHARACTER_IDS} from '../dist/character-stats.js';
import {VERBAL_KINDS_V30} from '../dist/verbal-v30.js';
import {simulate,replayRoute} from '../tests/find-routes-v3.mjs';

const copy=value=>JSON.parse(JSON.stringify(value));
const choose=(run,index)=>engine.advance(engine.applyChoice(run,index));
const score=run=>(run.completed?10000:0)+run.stats.mood*1.5+run.stats.energy+run.stats.cash*.3+run.stats.boss*.5;
const found=new Map(),old=JSON.parse(readFileSync(new URL('../tests/fixtures/verbal-routes-v30.json',import.meta.url),'utf8')).routes;
const handlers={exit:engine.requestExit,break:engine.requestBreak,career:engine.requestCareer,raise:engine.requestRaise,'salary-advice':engine.requestSalaryAdvice};
function sourceBefore(route,position){
 let run=engine.createRun(route.roleId,route.seed);
 for(let index=0;index<position;index++){
  const action=route.actions[index],following=route.actions[index+1];
  if(action.type==='choice'){
   run=engine.applyChoice(run,action.index);
   if(!(['rage','verbal'].includes(following?.type)&&following.phase==='result'))run=engine.advance(run);
  }else if(action.type==='verbal')run=engine.advance(engine.requestVerbal(run,action.target,action.version));
  else if(action.type==='rage')run=engine.advance(engine.requestRage(run,action.target));
  else run=handlers[action.type](run);
 }
 return run;
}
function finish(run,depth=18){
 if(run.completed)return run;if(depth<=0)return null;
 const leave=engine.requestExit(run);if(leave!==run){const done=finish(leave,depth-1);if(done)return done;}
 const candidates=engine.getEvent(run).choices.map((choice,index)=>({choice,index})).filter(({choice})=>choice.available!==false)
  .map(({index})=>choose(run,index)).sort((a,b)=>score(b)-score(a));
 for(const candidate of candidates){const done=finish(candidate,depth-1);if(done)return done;}
 return null;
}
function attempt(source,target){
 if(!engine.canRequestVerbal(source))return null;
 const targets=engine.getVerbalTargets(source);if(!targets.includes(target))return null;
 const quote=engine.getVerbalLine(source,target),pending=engine.requestVerbal(source,targets.length>1?target:undefined,2);
 if(pending===source)return null;
 const resolved=engine.advance(pending),row=pending.history.at(-1),branch=row.verbalOutcome?.kind||pending.verbalContext?.outcome;
 return{source,target,quote,pending,resolved,branch};
}
function keep(id,kind,candidate,after=candidate.resolved,extra={}){
 if(found.has(id))return;
 const done=finish(after);if(!done)return;
 const {source,target,quote,pending,branch}=candidate;
 const row=pending.history.at(-1);
 found.set(id,{id,kind,version:2,roleId:source.roleId,seed:source.seed,sourceEventId:source.eventId,sourceKind:engine.getEvent(source).kind,
  phase:source.pending?'result':'event',target,branch,quote,baseActions:source.actions,actions:after.actions,releaseActions:pending.actions,completionActions:done.actions,endingId:done.endingId,
  expected:{eventId:after.eventId,turn:after.turn,pay:after.pay,completed:after.completed,endingId:after.endingId,historyEventId:row.eventId,choiceIndex:row.choiceIndex},...extra});
}
function inspectCandidate(candidate){
 if(!candidate)return;
 const {source,target,resolved,branch}=candidate,phase=source.pending?'result':'event',event=engine.getEvent(source);
 keep(`cohort-${source.seed.split('-')[0]}`,'cohort',candidate);
 keep(`target-${phase}-${target}`,'target',candidate);
 keep(`outcome-${branch}`,'outcome',candidate);
 if(engine.getVerbalTargets(source).join(',')==='erich,jenjen,sonny')keep(`group-${phase}-${target}`,'group',candidate);
 if(event.kind==='onboarding'){
  keep(`onboarding-${source.assignment}-${phase}`,'onboarding',candidate);
  if(resolved.completed)keep('onboarding-dismissed','onboarding',candidate);
  else if(resolved.eventId!=='onboarding')keep('onboarding-progressed','onboarding',candidate);
 }
 if(['daily','fantasy'].includes(event.kind)){
  if(['ignored','relationship','retort','support'].includes(branch))keep(`work-${phase}`,'work',candidate);
  if(phase==='event'&&event.choices[0]?.flags?.length&&['ignored','relationship','retort','support'].includes(branch))keep('work-unpicked-first-flags','work',candidate);
  if(target==='wing'&&phase==='event'&&[...found.values()].filter(row=>row.kind==='quote').length<4)keep(`wing-work-${source.eventId}`,'quote',candidate);
 }
 const contexts=[];
 if(/^pip-/.test(source.eventId))contexts.push(`pip-${source.eventId}`);
 if(source.pip?.active&&['daily','fantasy'].includes(event.kind))contexts.push('pip-work');
 if(/^salary-|^raise-|^low-pay/.test(source.eventId))contexts.push(`salary-${source.eventId}`);
 if(source.banquetReturnEventId)contexts.push(`banquet-${source.eventId}`);
 if(source.mealContext?.guest)contexts.push('meal');
 if(source.patronageContext)contexts.push('patronage');
 for(const name of contexts)keep(`${name}-${phase}`,'context',candidate);
 if(resolved.eventId==='verbal-v2-warning')for(const [index,choice]of engine.getEvent(resolved).choices.entries())if(choice.available!==false)keep(`warning-${index}`,'warning',candidate,choose(resolved,index),{followupActions:resolved.actions,followupIndex:index});
 if(resolved.eventId==='verbal-v2-decision')for(const [index,choice]of engine.getEvent(resolved).choices.entries())if(choice.available!==false)keep(`decision-${source.eventId}-${index}-${phase}`,'decision',candidate,choose(resolved,index),{followupActions:resolved.actions,followupIndex:index,sourceIndex:choice.sourceIndex});
 if(resolved.eventId==='verbal-v2-legal')for(const [index,choice]of engine.getEvent(resolved).choices.entries())if(choice.available!==false){
  const pending=engine.applyChoice(resolved,index),after=engine.advance(pending),verdict=pending.verbalContext?.legalResult;
  keep(`legal-${index}-${verdict}`,'legal',candidate,after,{legalActions:resolved.actions,legalIndex:index,legalResult:verdict});
 }
}
function inspect(source){
 if(!engine.canRequestVerbal(source))return;
 for(const target of engine.getVerbalTargets(source))inspectCandidate(attempt(source,target));
 if(!source.pending)for(const [index,choice]of engine.getEvent(source).choices.entries())if(choice.available!==false){
  const pending=engine.applyChoice(source,index);
  if(engine.canRequestVerbal(pending))for(const target of engine.getVerbalTargets(pending))inspectCandidate(attempt(pending,target));
 }
}

for(const route of old){
 const position=route.actions.findIndex(action=>action.type==='verbal');if(position<0)continue;
 for(let index=0;index<position;index++)inspect(sourceBefore(route,index));
 const source=sourceBefore(route,position);inspectCandidate(attempt(source,route.target));
}
for(const cohort of ['e30','e31'])for(let attemptNumber=0;attemptNumber<300;attemptNumber++){
 const source=engine.createRun('system',`${cohort}-scene-first-${attemptNumber.toString(36)}`);
 inspect(source);
 if(found.has('onboarding-dismissed')&&found.has('onboarding-progressed')&&found.has('onboarding-swapped-event')&&found.has('onboarding-assistant-event'))break;
}
const required=[...['event','result'].flatMap(phase=>[...CHARACTER_IDS,'self'].map(target=>`target-${phase}-${target}`)),...VERBAL_KINDS_V30.map(kind=>`outcome-${kind}`),'cohort-e30','cohort-e31','work-event','work-result','work-unpicked-first-flags','onboarding-dismissed','onboarding-progressed','pip-pip-review-event','pip-pip-passed-event','pip-work-event','salary-salary-cut-event','salary-raise-request-event','banquet-banquet-welcome-event','banquet-banquet-draw-event',...['erich','jenjen','sonny'].map(target=>`group-event-${target}`)];
const missing=()=>required.filter(id=>!found.has(id));
const goals=['nasdaq','pip_exit','cold_storage','promotion','fired_refused','burnout','broke','career_chief'];
const maxAttempts=Number(process.argv[2]||150);
for(let attemptNumber=0;attemptNumber<maxAttempts&&(missing().length||[...found.values()].filter(row=>row.kind==='quote').length<2);attemptNumber++){
 for(const [index,roleId]of ['system','sales','hr','executive'].entries()){
  const {route}=simulate(roleId,goals[(attemptNumber+index)%goals.length],attemptNumber,{seedPrefix:'e31',raise:attemptNumber%2===0});
  replayRoute(route,inspect);
 }
 if(attemptNumber%10===9)console.log(JSON.stringify({attempts:attemptNumber+1,routes:found.size,missing:missing()}));
}
if(missing().length)throw new Error(`Missing natural scene-verbal witnesses: ${missing().join(', ')}`);
const rows=[...found.values()],invalid=[];
for(const route of rows){
 const run=engine.replayRun(route.roleId,route.seed,route.actions),done=engine.replayRun(route.roleId,route.seed,route.completionActions);
 if(!engine.validRun(copy(run))||!engine.validRun(copy(done))||!done.completed||done.endingId!==route.endingId){
  invalid.push({route,validRun:engine.validRun(copy(run)),validDone:engine.validRun(copy(done)),run,done});
 }
 if(!route.actions.some(action=>action.type==='verbal'&&action.version===2))throw new Error(`Missing opt-in action ${route.id}`);
}
if(invalid.length){
 mkdirSync(new URL('../artifacts',import.meta.url),{recursive:true});
 writeFileSync(new URL('../artifacts/invalid-verbal-scene-route.json',import.meta.url),JSON.stringify(invalid[0],null,2)+'\n');
 writeFileSync(new URL('../artifacts/invalid-verbal-scene-routes.json',import.meta.url),JSON.stringify(invalid,null,2)+'\n');
 throw new Error(`Invalid scene-verbal proofs: ${invalid.map(item=>item.route.id).join(', ')}; details: artifacts/invalid-verbal-scene-routes.json`);
}
writeFileSync(new URL('../tests/fixtures/verbal-scene-routes.json',import.meta.url),JSON.stringify({
 method:'Natural e30/e31 lives and opt-in version:2 spoken responses. Sources are reconstructed with committed pending timing, new endings are completed afresh, and all proofs replay without scene, quote, effect, role, stat, history or RNG injection.',routes:rows
},null,2)+'\n');
console.log(JSON.stringify({routes:rows.length,missing:missing()}));
