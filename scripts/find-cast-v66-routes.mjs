import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import * as E from '../dist/engine.js';
import {CAST_EVENTS_V66} from '../dist/events-cast-v66.js';
import {HIDDEN_STORIES_V66} from '../dist/hidden-stories-v66.js';
const wanted=new Set([...CAST_EVENTS_V66.map(event=>event.id),...HIDDEN_STORIES_V66.map((_,index)=>`hidden45-${index+8}-0`)]),routes=new Map();
const roles=['system','ai','mis','project','product','design','bd','sales','finance','accounting','hr','admin','executive'];
try{
 const cached=JSON.parse(readFileSync(new URL('../tests/fixtures/cast-v66.json',import.meta.url),'utf8'));
 for(const row of cached.routes||[])try{if(wanted.has(row.id)&&E.getEvent(E.replayRun(row.roleId,row.seed,row.actions)).id===row.id)routes.set(row.id,row);}catch{}
}catch{}
const event=run=>E.getEvent(run),choose=(run,index)=>E.advance(E.applyChoice(run,index));
const score=run=>run.completed||run.chapterContext||run.pendingFamily?-1e6:Math.min(run.stats.energy,run.stats.mood)*5+run.stats.energy+run.stats.mood+run.stats.cash*.65+Math.min(run.stats.boss,65)*.8+run.stats.trust*.2-(run.pip?.active?100:0);
function life(attempt,role){
 const seed='e39-r66-n-'+createHash('sha256').update(`cast66-${role}-${attempt}`).digest('hex').slice(0,22);let run=E.enableActivitySchedule(E.createRun(role,seed));
 for(let step=0;step<180&&!run.completed&&run.actions.length<275;step++){
  if(E.canRequestSalaryAdvice(run))run=E.requestSalaryAdvice(run);
  if(E.canRequestActivityInvitation(run))run=E.requestActivityInvitation(run);
  if(E.canRequestHiddenEncounter(run))run=E.requestHiddenEncounter(run);
  const scene=event(run);
  if(wanted.has(scene.id)&&!routes.has(scene.id))routes.set(scene.id,{id:scene.id,roleId:run.roleId,seed:run.seed,actions:run.actions});
  if(run.turn>=20&&!run.activityContext&&!run.hiddenEncounterContext&&!run.treatsContext&&!run.blockchainContext)break;
  if(run.activityInvitationContext){run=choose(run,1);continue;}
  if(E.isWorkGapOpenV50(run)){
   if(E.canRequestBreak(run)&&run.stats.cash>=8){run=E.requestBreak(run);continue;}
   run=E.applyChoice(run,0);continue;
  }
  if(run.shareholderContext?.stage==='offer'){run=choose(run,2);continue;}
  let choices=(scene.choices||[]).map((choice,index)=>({choice,index})).filter(row=>row.choice.available!==false);
  if(run.hiddenEncounterContext)choices=choices.filter(row=>row.index<3);
  if(scene.id==='kind-break'){run=choose(run,choices.find(row=>row.choice.effect==='kindDecline')?.index??0);continue;}
  if(scene.id==='kind-workday'){run=choose(run,choices.find(row=>row.choice.effect==='kindWorkDecline')?.index??0);continue;}
  if(scene.id==='self-care')choices=choices.filter(row=>row.choice.effect==='finishBreak');
  if(!choices.length)break;
  const candidates=choices.map(row=>({...row,after:choose(run,row.index)}));run=candidates.sort((a,b)=>score(b.after)-score(a.after))[0].after;
 }
}
const maximum=Math.max(1,Number(process.argv[2]||600));
for(let attempt=0;attempt<maximum&&routes.size<wanted.size;attempt++){
 for(const role of roles)life(attempt,role);
 if(attempt%10===0||routes.size===wanted.size)console.log(JSON.stringify({attempt:attempt+1,found:routes.size,total:wanted.size,missing:[...wanted].filter(id=>!routes.has(id))}));
}
const missing=[...wanted].filter(id=>!routes.has(id));
if(missing.length)throw Error(`Missing natural cast stories: ${missing.join(',')}`);
for(const row of routes.values()){
 const source=E.replayRun(row.roleId,row.seed,row.actions);
 if(event(source).id!==row.id||!E.validRun(source))throw Error(`Invalid natural source ${row.id}`);
}
writeFileSync(new URL('../tests/fixtures/cast-v66.json',import.meta.url),JSON.stringify({method:'Fresh r66 createRun lives, automatic calendar/hidden opportunities, and bounded lookahead of public choices. No injected IDs, resources, contexts, relationships, RNG or history.',required:[...wanted],routes:[...routes.values()]},null,2)+'\n');
console.log(JSON.stringify({routes:routes.size,missing}));
