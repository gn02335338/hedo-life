import {writeFileSync} from 'node:fs';
import * as E from '../dist/engine.js';
import {ACTIVITY_IDS_V44} from '../dist/activities-v44.js';

// Search alternatives solely to find reproducible public-action witnesses.
// No character stats, flags, date, event, invitation or random state is edited.
const PREFIX='e39-cal46-kin49-g-e-s-m-';
const routes=new Map();
const basketballWitnesses=[];
const ev=run=>E.getEvent(run);
const choices=run=>ev(run).choices.map((choice,index)=>({choice,index})).filter(({choice})=>choice.available!==false);
const choose=(run,index)=>E.advance(E.applyChoice(run,index));
const score=run=>run.completed||run.chapterContext||run.pendingFamily?-1e6:
 Math.min(run.stats.energy,run.stats.mood)*5+run.stats.energy+run.stats.mood+
 run.stats.cash*.6+Math.min(run.stats.boss,65)*.8+run.stats.trust*.2-(run.pip?.active?100:0);
function resilient(run){
 const options=choices(run).map(row=>({...row,after:choose(run,row.index)}));
 if(ev(run).id==='kind-break')return options.find(row=>row.choice.effect==='kindDecline')?.after;
 if(ev(run).id==='kind-workday')return options.find(row=>row.choice.effect==='kindWorkDecline')?.after;
 if(ev(run).id==='self-care')return options.filter(row=>row.choice.effect==='finishBreak').sort((a,b)=>score(b.after)-score(a.after))[0]?.after;
 return options.sort((a,b)=>score(b.after)-score(a.after))[0]?.after;
}
function hooks(run){
 if(E.canRequestSalaryAdvice(run))return E.requestSalaryAdvice(run);
 if(E.canRequestActivityInvitation(run))return E.requestActivityInvitation(run);
 return run;
}
function discover(target,attempt){
 const seed=PREFIX+attempt.toString(16).padStart(8,'0');
 let run=E.enableActivitySchedule(E.createRun('system',seed));
 for(let step=0;step<160&&!run.completed&&run.turn<20&&run.actions.length<260;step++){
  run=hooks(run);
  if(run.activityContext?.id===target&&run.activityContext.stage===1){
   const row={id:target,roleId:run.roleId,seed:run.seed,beforePlayActions:run.actions};
   if(!routes.has(target))routes.set(target,row);
   return row;
  }
  if(run.activityInvitationContext){run=choose(run,run.activityInvitationContext.id===target?0:1);continue;}
  if(E.isWorkGapOpenV50(run)){
   if(E.canRequestBreak(run)&&run.stats.cash>=8){run=E.requestBreak(run);continue;}
   run=E.applyChoice(run,0);continue;
  }
  const after=resilient(run);if(!after)break;run=after;
 }
}
const maxAttempts=Math.max(1,Number(process.argv[2]||180));
for(let attempt=0;attempt<maxAttempts&&routes.size<ACTIVITY_IDS_V44.length;attempt++){
 for(const target of ACTIVITY_IDS_V44)if(!routes.has(target))discover(target,attempt);
 if((attempt+1)%10===0||routes.size===ACTIVITY_IDS_V44.length)console.log(JSON.stringify({attempts:attempt+1,found:[...routes.keys()],missing:ACTIVITY_IDS_V44.filter(id=>!routes.has(id))}));
}
const missing=ACTIVITY_IDS_V44.filter(id=>!routes.has(id));
if(missing.length)throw Error(`Missing natural interactive activities: ${missing.join(', ')}`);
for(let attempt=0;attempt<maxAttempts&&basketballWitnesses.length<24;attempt++){
 const witness=discover('basketball',attempt);
 if(witness)basketballWitnesses.push(witness);
}
if(basketballWitnesses.length<24)throw Error('Missing enough natural basketball lives for injury distribution');
for(const row of [...routes.values(),...basketballWitnesses]){
 const run=E.replayRun(row.roleId,row.seed,row.beforePlayActions);
 if(!E.validRun(run)||run.activityContext?.id!==row.id||run.activityContext.stage!==1)throw Error(`Invalid activity witness: ${row.id}`);
}
writeFileSync(new URL('../tests/fixtures/activity-play-routes-v55.json',import.meta.url),JSON.stringify({method:'Natural createRun lives under e39-cal46-kin49-g-e-s-m-. Search resolves alternatives only to find witnesses. Canonical public actions only, with no injected stats, flags, dates, events or RNG.',routes:[...routes.values()],basketballWitnesses},null,2)+'\n');
console.log(JSON.stringify({routes:routes.size,basketballWitnesses:basketballWitnesses.length,missing}));
