import {writeFileSync} from 'node:fs';
import {FAMILIES} from '../dist/endings.js';
import {createRun,getEvent,applyChoice,advance,requestExit,requestRage,requestVerbal,canRequestSalaryAdvice,requestSalaryAdvice,replayRun,validRun} from '../dist/engine.js';
import {simulate,replayRoute} from '../tests/find-routes-v3.mjs';

const choose=(run,index)=>advance(applyChoice(run,index)),found=new Map();
const copy=value=>JSON.parse(JSON.stringify(value));
function complete(run,depth=12){
 if(run.completed)return run;if(depth<=0)return null;
 const leave=requestExit(run);if(leave!==run){const done=complete(leave,depth-1);if(done)return done;}
 const next=getEvent(run).choices.map((choice,index)=>({choice,index})).filter(({choice})=>choice.available!==false)
  .map(({index})=>choose(run,index)).sort((a,b)=>{
   const score=state=>(state.completed?10000:0)+state.stats.mood*1.5+state.stats.energy+state.stats.cash*.3+state.stats.boss*.5;
   return score(b)-score(a);
  });
 for(const candidate of next){const done=complete(candidate,depth-1);if(done)return done;}
 return null;
}
function safeContinuation(run,depth=10){
 if(canRequestSalaryAdvice(run))return run;
 if(depth<=0||run.completed||run.salaryAdvice!==null||run.pendingFamily)return null;
 if(['daily','fantasy'].includes(getEvent(run).kind)&&run.stats.mood>0&&run.stats.energy>0)return null;
 for(const [index,choice]of getEvent(run).choices.entries())if(choice.available!==false){
  const safe=safeContinuation(choose(run,index),depth-1);if(safe)return safe;
 }
 return null;
}
function row(id,kind,run,extra={}){
 return{id,kind,roleId:run.roleId,seed:run.seed,startPay:createRun(run.roleId,run.seed).pay,actions:run.actions,
  expected:{eventId:run.eventId,pay:run.pay,eligible:canRequestSalaryAdvice(run),salaryAdvice:run.salaryAdvice},...extra};
}
function profile(id,roleId,cohort,predicate){
 for(let index=0;index<5000;index++){
  const initial=createRun(roleId,`${cohort}-start-pay-${index.toString(36)}`);if(!predicate(initial))continue;
  const run=choose(initial,0);if(!['daily','fantasy'].includes(getEvent(run)?.kind))continue;
  const eligible=canRequestSalaryAdvice(run),opened=eligible?requestSalaryAdvice(run):null;
  const entry=row(id,eligible?'eligible':'boundary',run,opened?{openActions:opened.actions}:{});found.set(id,entry);return run;
 }
 throw new Error(`No natural salary profile ${id}`);
}
const baseline=profile('admin-27','admin','e31',run=>run.pay===27);
profile('admin-28','admin','e31',run=>run.pay===28);
profile('admin-29','admin','e31',run=>run.pay===29);
profile('admin-30','admin','e31',run=>run.pay===30);
profile('assistant-low','accounting','e31',run=>run.assignment==='assistant'&&run.pay<30);
profile('normal-high','admin','e31',run=>run.assignment==='honest'&&run.pay>=30);
for(const cohort of ['e28','e29','e30','e31'])profile(`cohort-${cohort}`,'admin',cohort,run=>run.pay===27);
for(const mode of ['dream','verbal']){
 const id=`onboarding-after-${mode}`;
 for(let index=0;index<2000&&!found.has(id);index++){
  const initial=createRun('admin',`e31-start-${mode}-${index.toString(36)}`);if(initial.pay>=30)continue;
  const pending=mode==='dream'?requestRage(initial):requestVerbal(initial);
  if(pending===initial||(mode==='dream'?pending.rageContext?.mode!=='imagined':!['ignored','relationship','retort','support'].includes(pending.verbalContext?.outcome)))continue;
  const returned=advance(pending);if(returned.eventId!=='onboarding')continue;
  const run=choose(returned,0);if(!canRequestSalaryAdvice(run))continue;
  found.set(id,row(id,'eligible',run,{openActions:requestSalaryAdvice(run).actions}));
 }
 if(!found.has(id))throw new Error(`No natural pre-onboarding interruption ${id}`);
}
const opened=requestSalaryAdvice(baseline);
for(const index of [0,1,2]){
 const resolved=choose(opened,index),done=complete(resolved);if(!done)throw new Error(`No completion for starting-pay response ${index}`);
 found.set(`reply-${index}`,row(`reply-${index}`,'reply',resolved,{index,beforeActions:baseline.actions,openActions:opened.actions,completionActions:done.actions,endingId:done.endingId}));
}
function inspect(run){
 if(run.completed||run.pending||run.salaryAdvice!==null||createRun(run.roleId,run.seed).pay>=30)return;
 if(run.pay>=30){
  if(!found.has('raised-above-threshold')&&['daily','fantasy'].includes(getEvent(run)?.kind))found.set('raised-above-threshold',row('raised-above-threshold','boundary',run));
  return;
 }
 const event=getEvent(run),id=run.stats.mood===0?'deferred-mood':!['daily','fantasy','onboarding'].includes(event.kind)?'deferred-hr':run.pip?.active?'active-pip':null;
 if(!id||found.has(id))return;
 if(id==='deferred-hr'&&!['crisis-boss','paperwork','education-scrutiny','salary-cut','salary-final','pip-review','pip-passed'].includes(run.eventId))return;
 const safe=safeContinuation(run);if(!safe)return;
 const open=requestSalaryAdvice(safe),done=complete(choose(open,0));if(!done)return;
 found.set(id,row(id,id==='active-pip'?'eligible':'deferred',run,{resumeActions:safe.actions,openActions:open.actions,completionActions:done.actions,endingId:done.endingId}));
}
const maxAttempts=Number(process.argv[2]||1500),targets=['pip_exit','burnout','nasdaq','historian','cold_storage','promotion'];
for(let attempt=0;attempt<maxAttempts&&['deferred-hr','deferred-mood','active-pip','raised-above-threshold'].some(id=>!found.has(id));attempt++){
 for(const roleId of ['admin','accounting','hr'])for(const target of targets){
  const seed=`e31-${roleId}-${FAMILIES.findIndex(family=>family.id===target).toString(36)}-${attempt.toString(36)}`;
  if(createRun(roleId,seed).pay>=30)continue;
  const {route}=simulate(roleId,target,attempt,{seedPrefix:'e31'});replayRoute(route,inspect);
 }
}
const missing=['deferred-hr','deferred-mood','active-pip','raised-above-threshold'].filter(id=>!found.has(id));if(missing.length)throw new Error(`Missing natural starting-pay contexts: ${missing.join(', ')}`);
const routes=[...found.values()];
for(const route of routes){
 const run=replayRun(route.roleId,route.seed,route.actions);if(!validRun(copy(run))||run.pay!==route.expected.pay||run.eventId!==route.expected.eventId)throw new Error(`Invalid starting-pay proof ${route.id}`);
 if(route.openActions){const open=replayRun(route.roleId,route.seed,route.openActions);if(!validRun(copy(open))||open.eventId!=='low-pay-tip'||open.salaryAdvice?.origin!=='starting-pay')throw new Error(`Invalid starting-pay open ${route.id}`);}
 if(route.completionActions){const done=replayRun(route.roleId,route.seed,route.completionActions);if(!done.completed||done.endingId!==route.endingId||!validRun(copy(done)))throw new Error(`Invalid starting-pay completion ${route.id}`);}
}
writeFileSync(new URL('../tests/fixtures/starting-salary-advice-routes.json',import.meta.url),JSON.stringify({
 method:'Natural e28–e31 initial pay draws, canonical onboarding/work choices and explicit salary-advice actions only. Boundaries include 27/28/29/30K, deferred urgent scenes and active PIP. No pay, role, scene, stat, flag, history or RNG state is injected.',routes
},null,2)+'\n');
console.log(JSON.stringify({profiles:routes.length,replies:3,missing}));
