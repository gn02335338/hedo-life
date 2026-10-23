import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import * as E from '../dist/engine.js';

// Only public createRun/actions form these witnesses. Alternative resolutions
// search for routes; no stats, calendar, RNG, relationships or contexts change.
const routes=new Map(),roles=['sales','bd','design'];
const event=run=>E.getEvent(run);
const choose=(run,index)=>E.advance(E.applyChoice(run,index));
const score=run=>run.completed||run.chapterContext||run.pendingFamily?-1e6:Math.min(run.stats.energy,run.stats.mood)*5+run.stats.energy+run.stats.mood+run.stats.cash*.6+Math.min(run.stats.boss,65)*.8+run.stats.trust*.2-(run.pip?.active?100:0);
const save=(id,run,before=null,index=null)=>{if(!E.validRun(run))throw Error(`Noncanonical ${id}`);if(!routes.has(id))routes.set(id,{id,roleId:run.roleId,seed:run.seed,actions:run.actions,...(before?{beforeActions:before.actions}:{}),...(index!==null?{index}:{})});};
function expand(invite){
 const role=invite.roleId;save(`${role}-invitation`,invite);
 for(const index of [1,2])save(`${role}-decline-${index}`,choose(invite,index),invite,index);
 const first=choose(invite,0);save(`${role}-stage-0`,first,invite,0);
 for(const index of [0,1,2])save(`${role}-setup-${index}`,choose(first,index),first,index);
 const play=choose(first,0);save(`${role}-play`,play);
 for(const [name,matches] of [['strong',[0,1,2,1,0,2]],['weak',[2,2,0,0,1,1]]]){
  const input={kind:'roadshow',matches},pending=E.applyActivityPlay(play,input),next=E.advance(pending);save(`${role}-${name}`,next,play);routes.get(`${role}-${name}`).input=input;
  for(const index of [0,1,2])save(`${role}-${name}-finish-${index}`,choose(next,index),next,index);
 }
}
function discover(role,attempt){
 const seed='e39-r63-n-'+createHash('sha256').update(`roadshow-${role}-${attempt}`).digest('hex').slice(0,22);let run=E.enableActivitySchedule(E.createRun(role,seed));
 for(let step=0;step<170&&!run.completed&&run.turn<20&&run.actions.length<260;step++){
  if(E.canRequestSalaryAdvice(run))run=E.requestSalaryAdvice(run);
  if(E.canRequestActivityInvitation(run))run=E.requestActivityInvitation(run);
  if(run.activityInvitationContext?.id==='roadshow'){expand(run);return true;}
  if(run.activityInvitationContext){run=choose(run,1);continue;}
  if(E.isWorkGapOpenV50(run)){
   if(E.canRequestBreak(run)&&run.stats.cash>=8){run=E.requestBreak(run);continue;}
   run=E.applyChoice(run,0);continue;
  }
  const choices=event(run).choices.map((choice,index)=>({choice,index})).filter(({choice})=>choice.available!==false);
  if(!choices.length)break;
  if(event(run).id==='kind-break'){run=choose(run,choices.find(row=>row.choice.effect==='kindDecline')?.index??0);continue;}
  if(event(run).id==='kind-workday'){run=choose(run,choices.find(row=>row.choice.effect==='kindWorkDecline')?.index??0);continue;}
  if(run.shareholderContext?.stage==='offer'){run=choose(run,2);continue;}
  const options=choices.map(row=>({...row,after:choose(run,row.index)}));
  const safe=event(run).id==='self-care'?options.filter(row=>row.choice.effect==='finishBreak'):options;
  const next=safe.sort((a,b)=>score(b.after)-score(a.after))[0]?.after;if(!next)break;run=next;
 }
 return false;
}
const maximum=Math.max(1,Number(process.argv[2]||180));
for(const role of roles){let found=false;for(let attempt=0;attempt<maximum&&!found;attempt++)found=discover(role,attempt);if(!found)throw Error(`No natural Roadshow for ${role}`);console.log(JSON.stringify({role,routes:routes.size}));}
for(const row of routes.values()){const run=E.replayRun(row.roleId,row.seed,row.actions);if(!E.validRun(run))throw Error(`Invalid ${row.id}`);}
const departures=[];
for(const role of roles)for(const [stage,name] of [[0,'stage-0'],[1,'play'],[2,'strong']]){
 const row=routes.get(`${role}-${name}`),source=E.replayRun(row.roleId,row.seed,row.actions),left=E.advance(E.requestEventDepartureV63(source));
 if(!E.validRun(left)||left.flags.activity44_roadshow_completed)throw Error(`Invalid Roadshow departure ${role}/${stage}`);
 departures.push({id:`${role}-leave-${stage}`,roleId:row.roleId,seed:row.seed,beforeActions:source.actions,actions:left.actions});
}
writeFileSync(new URL('../tests/fixtures/roadshow-v63.json',import.meta.url),JSON.stringify({method:'Natural r63 createRun lives across sales, business development and product design. Public actions only; search comparisons find witnesses without injecting stats, dates, RNG, contexts or invitations.',routes:[...routes.values()],departures},null,2)+'\n');
console.log(JSON.stringify({routes:routes.size,departures:departures.length,roles}));
