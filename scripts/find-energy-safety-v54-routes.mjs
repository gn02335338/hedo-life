import {writeFileSync} from 'node:fs';
import {ROLES} from '../dist/roles.js';
import * as E from '../dist/engine.js';
import {ENERGY_SAFETY_OWED_V54 as OWED} from '../dist/energy-safety-v54.js';

// Route search resolves candidates only to discover reproducible checkpoints.
// Every saved witness begins at createRun and uses public actions, never edits
// resources, flags, event IDs, history, workdays or the engine's random state.
const PREFIX='e39-cal46-kin49-g-e-s-';
const ACTIVITY_IDS=['arm','diet','roadshow','dinner','banquet','basketball','review'];
const required=['healthy-work','buffered-work','warning-gap','paid-recovery','ignored-chance-burnout','hidden-return-gap','mandatory-return-gap','pip-notice-warning','pip-start-gap','pip-review-warning','pip-paid-recovery','same-turn-rest-cap','owed-floor','rearmed-warning',...ACTIVITY_IDS.filter(id=>id!=='dinner').map(id=>`activity-return-${id}`),'activity-dinner-restores'];
const routes=new Map();
const event=run=>E.getEvent(run);
const gap=run=>E.isWorkGapOpenV50(run);
const options=run=>event(run)?.choices.map((choice,index)=>({choice,index})).filter(({choice})=>choice.available!==false)||[];
const choose=(run,index)=>E.advance(E.applyChoice(run,index));
const warning=run=>run.stats.energy>0&&run.stats.energy<=30;
function remember(id,before,after,extra={}){
 if(routes.has(id)||after.actions.length>285)return;
 routes.set(id,{id,roleId:before.roleId,seed:before.seed,beforeActions:before.actions,actions:after.actions,...extra});
}
function restEvidence(before){
 if(!E.canRequestBreak(before))return;
 let menu=E.requestBreak(before);
 if(event(menu).id==='kind-break'){
  const decline=options(menu).find(({choice})=>choice.effect==='kindDecline');
  if(!decline)return;menu=choose(menu,decline.index);
 }
 if(event(menu).id!=='self-care')return;
 for(const {choice,index}of options(menu)){
  if(choice.effect!=='finishBreak'||(choice.delta?.energy||0)<=0)continue;
  const after=choose(menu,index);
  if(after.completed||!gap(after)||after.stats.energy<=30)continue;
  remember('paid-recovery',before,after,{purchaseIndex:index});
  if(before.pip?.active)remember('pip-paid-recovery',before,after,{purchaseIndex:index});
 }
 const continued=E.applyChoice(before,0);
 if(['daily','fantasy'].includes(event(continued)?.kind))for(const option of options(continued)){
  const pending=E.applyChoice(continued,option.index);
  const exhausted=E.advance(pending);
  if(pending.stats.energy===0&&exhausted.chapterContext?.family==='burnout')remember('ignored-chance-burnout',before,exhausted,{index:option.index,skippedGap:true});
 }
}
function inspect(before,index,pending,after){
 const source=event(before),last=pending.history.at(-1);
 if(before.stats.energy>30&&['daily','fantasy'].includes(source.kind)&&after.turn>before.turn&&!after.completed&&!gap(after)&&after.stats.energy>30)remember('healthy-work',before,after,{index});
 if(last?.breakdown?.some(part=>part.source==='fatigue-buffer')){
  if(before.stats.energy>30&&['daily','fantasy'].includes(source.kind))remember('buffered-work',before,after,{index});
  if(before.stats.energy<=30&&pending.stats.energy===1&&before.flags[OWED]===1)remember('owed-floor',before,after,{index});
 }
 if(!after.completed&&gap(after)&&warning(after)){
  remember('warning-gap',before,after,{index});restEvidence(after);
  if(before.stats.energy>30&&after.flags[OWED]===0&&before.history.some(row=>row.kind==='self-care'&&row.delta.energy>0))remember('rearmed-warning',before,after,{index});
  if(before.hiddenEncounterContext&&!after.hiddenEncounterContext)remember('hidden-return-gap',before,after,{index});
  if(before.activityContext&&!after.activityContext)remember(`activity-return-${before.activityContext.id}`,before,after,{index});
  if(after.turn===before.turn&&!before.activityContext&&!before.hiddenEncounterContext&&!['self-care','kind-break','kind-workday'].includes(source.id)&&(before.resumeEventId||before.meltdownReturnEventId||before.salaryAdvice?.status==='open'))remember('mandatory-return-gap',before,after,{index});
  if(source.id==='crisis-boss'&&after.pip?.active)remember('pip-start-gap',before,after,{index});
 }
 if(before.activityContext?.id==='dinner'&&!after.activityContext&&after.stats.energy>30&&!gap(after))remember('activity-dinner-restores',before,after,{index});
 if(before.activityContext&&!after.activityContext&&warning(after)&&after.flags[OWED]===1&&after.lastBreakTurn===after.turn&&!gap(after)&&['daily','fantasy'].includes(event(after)?.kind))remember('same-turn-rest-cap',before,after,{index});
}
function score(run,mode){
 if(run.completed||run.pendingFamily||run.chapterContext)return -10000;
 const s=run.stats;
 let value=s.mood*1.5+s.cash*.5+s.boss*.3+s.energy*.5;
 if(mode===1)value-=s.energy*2.8;
 if(mode===2)value+=Math.max(0,35-s.boss)*3-s.energy*.9;
 if(mode===3)value+=s.energy*1.1+s.trust*.5;
 value+=Math.min(0,s.mood-15)*14+Math.min(0,s.cash-8)*8;
 return value;
}
function hooks(run){
 if(E.canRequestSalaryAdvice(run))return E.requestSalaryAdvice(run);
 if(E.canRequestActivityInvitation(run))return E.requestActivityInvitation(run);
 if(E.canRequestHiddenEncounter(run))return E.requestHiddenEncounter(run);
 return run;
}
function life(role,attempt,mode){
 const suffix=`${ROLES.indexOf(role).toString(36)}${attempt.toString(36).padStart(5,'0')}${mode}nat`;
 let run=E.enableActivitySchedule(E.createRun(role.id,`${PREFIX}${suffix}`));
 for(let step=0;step<190&&!run.completed&&run.actions.length<280;step++){
  run=hooks(run);const ev=event(run);if(!ev)break;
  if(['crisis-boss','pip-review'].includes(ev.id)&&warning(run))remember(ev.id==='crisis-boss'?'pip-notice-warning':'pip-review-warning',run,run);
  if(gap(run)){
   restEvidence(run);
   if(E.canRequestBreak(run)&&run.stats.cash>=12&&mode!==2){run=E.requestBreak(run);continue;}
   run=E.applyChoice(run,0);continue;
  }
  const candidates=options(run).map(({choice,index})=>{const pending=E.applyChoice(run,index);return{choice,index,pending,after:E.advance(pending)}});
  if(!candidates.length)break;
  for(const option of candidates)inspect(run,option.index,option.pending,option.after);
  let picked;
  if(ev.kind==='activity-invitation')picked=candidates.find(row=>row.index===0);
  else if(ev.id==='kind-break')picked=candidates.find(row=>row.choice.effect==='kindDecline');
  else if(ev.id==='kind-workday')picked=candidates.find(row=>row.choice.effect==='kindWorkDecline');
  else if(ev.id==='self-care')picked=(mode===0&&run.stats.energy>=25?candidates.find(row=>row.choice.effect==='finishBreak'&&row.choice.delta?.energy===6):null)||candidates.find(row=>row.choice.effect==='finishBreak'&&row.choice.delta?.energy===42);
  else if(run.activityContext)picked=candidates.filter(row=>!row.after.chapterContext&&row.after.stats.mood>8).sort((a,b)=>a.after.stats.energy-b.after.stats.energy||score(b.after,mode)-score(a.after,mode))[0];
  const pip=candidates.find(row=>row.choice.effect==='startPip');
  const back=candidates.find(row=>['patronageReturn','wealthReturn','wealthBack','raiseCancel'].includes(row.choice.effect));
  picked= picked||pip||back||candidates.sort((a,b)=>score(b.after,mode)-score(a.after,mode))[0];
  run=picked.after;
 }
}
const maxAttempts=Math.max(1,Number(process.argv[2]||100));
for(let attempt=0;attempt<maxAttempts&&required.some(id=>!routes.has(id));attempt++){
 for(const role of ROLES)for(const mode of [0,1,2,3])life(role,attempt,mode);
 console.log(JSON.stringify({attempts:attempt+1,routes:routes.size,missing:required.filter(id=>!routes.has(id))}));
 writeFileSync(new URL('../artifacts/energy-safety-routes-v54-partial.json',import.meta.url),JSON.stringify({required,routes:[...routes.values()]},null,2)+'\n');
}
const missing=required.filter(id=>!routes.has(id));
if(missing.length)throw new Error(`Missing natural energy/safety witnesses: ${missing.join(', ')}`);
for(const row of routes.values())for(const actions of [row.beforeActions,row.actions]){
 const run=E.replayRun(row.roleId,row.seed,actions);
 if(!E.validRun(run))throw new Error(`Invalid canonical witness: ${row.id}`);
}
writeFileSync(new URL('../tests/fixtures/energy-safety-routes-v54.json',import.meta.url),JSON.stringify({method:'Natural createRun lives under e39-cal46-kin49-g-e-s-. Route search resolves alternatives only to find witnesses. Canonical public actions only; no injected resources, flags, events, history, workday or RNG.',required,routes:[...routes.values()]},null,2)+'\n');
console.log(JSON.stringify({routes:routes.size,missing}));
