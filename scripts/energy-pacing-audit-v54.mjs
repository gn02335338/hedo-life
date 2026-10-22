import {mkdirSync,writeFileSync} from 'node:fs';
import {ROLES} from '../dist/roles.js';
import * as E from '../dist/engine.js';

// Bounded, deterministic player runs. Each action is selected from the current
// visible scene; never resolve competing choices to inspect future RNG/state.
// Every witness begins at createRun, with the same catch-up hooks as the app.
// Usage: node scripts/energy-pacing-audit-v54.mjs [attempts-per-role/strategy]
//        [seed-marker] [ignored-report-label]. Findings count transitions,
// including repeated returns within one life, rather than distinct players.
const attempts=Math.max(1,Math.min(300,Number(process.argv[2]||30)));
const prefix=process.argv[3]||'e39-cal46-kin49-g-e-';
const reportLabel=(process.argv[4]||'audit').replace(/[^a-z0-9-]/gi,'').slice(0,40)||'audit';
if(prefix.length>24)throw new Error('Seed marker must leave room for a unique role/attempt/strategy suffix');
const strategies=['steady','varied','activities'];
const report={method:'Natural canonical lives, all thirteen starting roles. Ordinary decisions use current scene and rotating indices, not simulated future outcomes. PIP is accepted when offered, then continued when passed. Every available rest at energy 1–30 is accepted; rest menu follows the visible sleep/weekend wording, and mood warning meals are used when affordable. App salary/activity/hidden catch-up hooks are included.',prefix,attempts,strategies,lives:0,steps:0,workdays:0,restOpportunities:0,restsPurchased:0,pipRestOpportunities:0,activityStages:0,pipWorkdays:0,minEnergy:100,fatigueBuffers:{},failures:{},failureDetails:{},perRole:{},witnesses:[]};
const choices=run=>E.getEvent(run)?.choices.map((choice,index)=>({choice,index})).filter(({choice})=>choice.available!==false)||[];
const hash=value=>{let result=2166136261;for(const char of String(value))result=Math.imul(result^char.charCodeAt(0),16777619)>>>0;return result;};
const named=(rows,pattern)=>rows.find(({choice})=>pattern.test(choice.text||''));
const effects=(rows,names)=>rows.find(({choice})=>names.includes(choice.effect));
const safeContext=run=>({eventId:E.getEvent(run)?.id||null,kind:E.getEvent(run)?.kind||null,turn:run.turn,energy:run.stats.energy,mood:run.stats.mood,cash:run.stats.cash,pip:run.pip?{...run.pip}:null,gap:E.isWorkGapOpenV50(run),canRest:E.canRequestBreak(run),resume:run.resumeEventId,breakReturn:run.breakReturnEventId,activity:run.activityContext?.id||null,hidden:!!run.hiddenEncounterContext,personnel:run.personnelPending||null});
function failure(kind,run,trace,extra={}){
 report.failures[kind]=(report.failures[kind]||0)+1;
 const last=trace.at(-1),cause=last?.before?.kind||'unknown',cash=last?.before?.cash>=12?'cash12+':'cash<12';
 const detail=`${kind}|${cause}|${cash}|${last?.before?.pip?.active?'pip':'no-pip'}`;
 report.failureDetails[detail]=(report.failureDetails[detail]||0)+1;
 if(report.witnesses.filter(row=>row.detail===detail).length>=3)return;
 const replay=E.replayRun(run.roleId,run.seed,run.actions);
 if(!E.validRun(replay))throw new Error(`Invalid witness ${kind}`);
 report.witnesses.push({kind,detail,roleId:run.roleId,seed:run.seed,actions:run.actions,trace:trace.slice(-12),...extra});
}
function pick(run,strategy,step){
 const ev=E.getEvent(run),rows=choices(run);
 if(!rows.length)return null;
 if(E.isWorkGapOpenV50(run))return rows[0];
 if(ev.id==='self-care'){
  // Wording reveals the purpose and upfront cost, without hidden numeric gains.
  return (run.stats.mood<35?named(rows,/整個週末/):null)||named(rows,/補一場|睡|認真休息/)||named(rows,/飲料/)||rows.at(-1);
 }
 if(ev.id==='kind-break')return effects(rows,['kindDecline'])||rows.at(-1);
 if(ev.id==='kind-workday')return effects(rows,['kindWorkDecline'])||rows.at(-1);
 if(ev.kind==='activity-invitation')return rows[strategy==='activities'||run.stats.energy>=45?0:1]||rows[0];
 if(ev.id==='mood-collapse'||ev.id==='mood-self-destruct')return effects(rows,['moodRecover','moodUnpaidLeave'])||rows[0];
 if(ev.id==='crisis-mood')return (run.stats.cash>8?effects(rows,['mealOpen']):null)||effects(rows,['resume'])||named(rows,/休|放|省電/)||rows[0];
 if(ev.id.startsWith('meal-guests-'))return effects(rows,['mealFinish'])||rows.find(({choice})=>choice.mealTarget&&!['wing','spencer','erich'].includes(choice.mealTarget))||effects(rows,['mealCancel'])||rows[0];
 if(ev.id.startsWith('meal-with-'))return effects(rows,['mealFinish'])||effects(rows,['mealCancel'])||rows[0];
 if(ev.id==='pip-passed')return effects(rows,['finishPip'])||rows[0];
 const pip=effects(rows,['startPip']);if(pip)return pip;
 const back=effects(rows,['patronageReturn','wealthReturn','wealthBack','raiseCancel','careerDefer']);if(back)return back;
 if(ev.id==='chapter-resolution')return effects(rows,['chapterContinue'])||rows[0];
 const nonterminal=rows.filter(({choice})=>!['ragequit','quit','layoff','fired_refused','pip_exit','pip_fail','careerExit','legacyCareer','storyCareer','rankHub'].includes(choice.effect));
 const available=nonterminal.length?nonterminal:rows;
 return available[strategy==='steady'?0:hash(`${run.seed}:${step}:${ev.id}`)%available.length];
}
function hooks(run){
 if(run.pending||run.completed)return run;
 if(E.canRequestSalaryAdvice(run))return E.requestSalaryAdvice(run);
 if(E.canRequestActivityInvitation(run))return E.requestActivityInvitation(run);
 if(E.canRequestHiddenEncounter(run))return E.requestHiddenEncounter(run);
 return run;
}
function life(role,attempt,strategy){
 const suffix=`${ROLES.indexOf(role).toString(36)}${attempt.toString(36).padStart(5,'0')}${strategies.indexOf(strategy)}audit`;
 let run=E.enableActivitySchedule(E.createRun(role.id,`${prefix}${suffix.slice(0,32-prefix.length)}`));
 let trace=[],episodeRestOpportunity=false,episodePurchased=false,everRest=false,unaffordable=false,lowNonrestSteps=0;
 const summary={lives:1,steps:0,restOpportunities:0,burnouts:0,finished:0};
 for(let step=0;step<180&&!run.completed&&run.actions.length<290;step++){
  report.steps++;summary.steps++;
  run=hooks(run);
  const before=safeContext(run),ev=E.getEvent(run);
  if(!ev)break;
  report.minEnergy=Math.min(report.minEnergy,run.stats.energy);
  if(run.stats.energy>30){episodeRestOpportunity=false;episodePurchased=false;unaffordable=false;lowNonrestSteps=0;}
  if(E.canRequestBreak(run)&&(run.activityContext||run.activityInvitationContext||run.hiddenEncounterContext||run.resumeEventId||run.pending||run.chapterContext))failure('rest-interrupts-owned-scene',run,trace);
  if(E.canRequestBreak(run)&&run.stats.energy>0&&run.stats.energy<=30){
   report.restOpportunities++;summary.restOpportunities++;episodeRestOpportunity=true;everRest=true;
   if(run.pip?.active)report.pipRestOpportunities++;
   trace.push({action:'request-rest',before});
   run=E.requestBreak(run);continue;
  }
  const selected=pick(run,strategy,step);if(!selected)break;
  if(ev.id==='self-care'&&selected.choice.effect==='cancelBreak')unaffordable=true;
  const chosen=E.applyChoice(run,selected.index),after=E.advance(chosen);
  trace.push({action:'choice',index:selected.index,text:selected.choice.text,before,pending:safeContext(chosen),after:safeContext(after),result:chosen.history.at(-1)?.result,breakdown:chosen.history.at(-1)?.breakdown});
  if(ev.kind==='activity')report.activityStages++;
  if(chosen.history.length>run.history.length)for(const item of chosen.history.at(-1)?.breakdown||[]){
   if(item.source==='fatigue-buffer')report.fatigueBuffers[item.label]=(report.fatigueBuffers[item.label]||0)+1;
  }
  if(after.turn>run.turn)report.workdays+=after.turn-run.turn;
  if(run.pip?.active&&['daily','fantasy'].includes(ev.kind))report.pipWorkdays++;
  if(['self-care','activity','activity-invitation','hidden'].includes(ev.kind)&&run.pip?.active&&after.pip?.active&&after.pip.remaining!==run.pip.remaining)failure('no-work-pip-tick',after,trace,{beforePip:run.pip,afterPip:after.pip});
  if(chosen.pending&&(E.canRequestBreak(chosen)||E.requestBreak(chosen)!==chosen))failure('rest-interrupts-pending-result',after,trace);
  if(ev.id==='self-care'&&selected.choice.effect==='finishBreak'){report.restsPurchased++;episodePurchased=true;}
  if(run.stats.energy>0&&chosen.stats.energy===0){
   summary.burnouts++;
   const kind=run.stats.energy>30?'healthy-to-zero-single-choice':unaffordable?'warning-rest-unaffordable':episodeRestOpportunity?'exhausted-after-rest-opportunity':run.activityContext?'warning-exhausted-inside-activity':run.hiddenEncounterContext?'warning-exhausted-inside-hidden':'warning-exhausted-before-rest-opportunity';
   failure(kind,after,trace,{before:before,everRest,episodePurchased,lowNonrestSteps});
  }
  if(chosen.stats.energy>0&&chosen.stats.energy<=30&&!E.canRequestBreak(after)&&!E.isWorkGapOpenV50(after)&&!after.completed&&!after.pendingFamily&&!after.chapterContext){
   lowNonrestSteps++;
   if(!episodeRestOpportunity&&['daily','fantasy'].includes(E.getEvent(after)?.kind)&&after.lastBreakTurn!==after.turn)failure('warning-back-to-work-no-gap',after,trace,{lowNonrestSteps});
  }
  run=after;
 }
 summary.finished=Number(run.completed);
 report.lives++;
 const current=report.perRole[role.id]||Object.fromEntries(Object.keys(summary).map(key=>[key,0]));
 for(const [key,value]of Object.entries(summary))current[key]+=value;
 report.perRole[role.id]=current;
}
for(let attempt=0;attempt<attempts;attempt++){
 for(const role of ROLES)for(const strategy of strategies)life(role,attempt,strategy);
 if((attempt+1)%10===0)console.log(JSON.stringify({attempt:attempt+1,lives:report.lives,rests:report.restsPurchased,failures:report.failures}));
}
mkdirSync(new URL('../artifacts/',import.meta.url),{recursive:true});
const target=new URL(`../artifacts/energy-pacing-${reportLabel}-v54.json`,import.meta.url);
writeFileSync(target,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,witnesses:report.witnesses.map(({kind,roleId,seed,actions})=>({kind,roleId,seed,actions:actions.length}))},null,2));
