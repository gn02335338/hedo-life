import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as E from '../dist/engine.js';
import {ROLES} from '../dist/roles.js';

// Route discovery may compare ordinary story alternatives, but every saved
// witness consists solely of real public engine actions. No state injection.
const ids=['jack-drinks','company-tea','birthday-cake'],routes=new Map(),sources=new Map();
const clone=value=>JSON.parse(JSON.stringify(value));
const choose=(run,index)=>E.advance(E.applyChoice(run,index));
const score=run=>run.completed||run.chapterContext||run.pendingFamily?-1e6:Math.min(run.stats.energy,run.stats.mood)*6+run.stats.energy+run.stats.mood+run.stats.cash*.8+Math.min(run.stats.boss,70)+run.stats.trust*.2-(run.pip?.active?120:0);
const available=run=>E.getEvent(run).choices.map((choice,index)=>({choice,index})).filter(row=>row.choice.available!==false);
function next(run){
 const choices=available(run).map(row=>({...row,run:choose(run,row.index)})),id=E.getEvent(run).id;
 if(id==='kind-break')return choices.find(row=>row.choice.effect==='kindDecline')?.run;
 if(id==='kind-workday')return choices.find(row=>row.choice.effect==='kindWorkDecline')?.run;
 if(id==='self-care')return choices.filter(row=>row.choice.effect==='finishBreak').sort((a,b)=>score(b.run)-score(a.run))[0]?.run;
 return choices.sort((a,b)=>score(b.run)-score(a.run))[0]?.run;
}
const capture=(id,run,extra={})=>{if(!routes.has(id))routes.set(id,{id,roleId:run.roleId,seed:run.seed,actions:clone(run.actions),...extra});};
const limit=Math.max(1,Number(process.argv[2])||160);
for(let attempt=0;attempt<limit;attempt++){
 const seed='e39-r61-n-'+createHash('sha256').update(`office-treat-witness-${attempt}`).digest('hex').slice(0,22);
 let run=E.enableActivitySchedule(E.createRun(ROLES[attempt%ROLES.length].id,seed));
 for(let step=0;step<190&&!run.completed&&run.actions.length<275;step++){
  if(run.pending)run=E.advance(run);
  if(E.canRequestSalaryAdvice(run)){run=E.requestSalaryAdvice(run);continue;}
  if(E.canRequestActivityInvitation(run)){run=E.requestActivityInvitation(run);continue;}
  if(run.pip?.active)capture('guard-pip',run);
  if(run.activityInvitationContext){capture('guard-invitation',run);capture('guard-activity',choose(run,0));run=choose(run,1);continue;}
  if(run.eventId==='self-care')capture('guard-rest',run);
  if(run.treatsContext){
   const {id,stage}=run.treatsContext;
   if(!sources.has(id))sources.set(id,{id,roleId:run.roleId,seed:run.seed,actions:clone(run.actions)});
   if(id==='jack-drinks'&&run.flags.treats61_company_tea_cancelled)capture('private-jack-after-company-cancelled',run,{storyId:id,stage});
   for(const {index}of available(run)){
    const after=choose(run,index);capture(`${id}-${stage}-${index}`,after,{storyId:id,stage,index,beforeActions:clone(run.actions)});
   }
   run=choose(run,0);continue;
  }
  if(run.shareholderContext){run=choose(run,run.shareholderContext.stage==='offer'?2:0);continue;}
  if(E.isWorkGapOpenV50(run)){
   if(E.canRequestBreak(run)&&run.stats.cash>=8){run=E.requestBreak(run);continue;}
   run=E.applyChoice(run,0);continue;
  }
  const after=next(run);if(!after||after===run)break;run=after;
 }
 const complete=ids.every(id=>[0,1,2].every(stage=>routes.has(`${id}-${stage}-0`)));
 if((attempt+1)%10===0)console.log(JSON.stringify({attempts:attempt+1,routes:routes.size,sources:[...sources.keys()],cancelThenJack:routes.has('private-jack-after-company-cancelled')}));
 if(complete&&routes.has('private-jack-after-company-cancelled')&&['guard-pip','guard-activity','guard-rest'].every(id=>routes.has(id)))break;
}
for(const route of [...routes.values(),...sources.values()]){
 const run=E.replayRun(route.roleId,route.seed,route.actions);if(!E.validRun(run))throw Error(`Invalid office treat route: ${route.id}`);
 if(JSON.stringify(E.replayRun(run.roleId,run.seed,run.actions))!==JSON.stringify(run))throw Error(`Unstable replay: ${route.id}`);
}
for(const id of ids)for(const stage of [0,1,2])if(!routes.has(`${id}-${stage}-0`))throw Error(`Missing ${id} stage ${stage}`);
if(!routes.has('private-jack-after-company-cancelled'))throw Error('Private Jack invitation never appeared after the company tea cancellation');
writeFileSync(new URL('../tests/fixtures/office-treats-routes-v61.json',import.meta.url),JSON.stringify({method:'Natural new r61 createRun lives. Every branch uses public choice actions; discovery lookahead finds reproducible prefixes without editing stats, flags, dates, contexts or RNG. Company-tea cancellation and subsequent private Jack invitation occur in the same canonical life.',sources:[...sources.values()],routes:[...routes.values()]},null,2)+'\n');
console.log(JSON.stringify({routes:routes.size,sources:sources.size,cancelThenJack:true}));
