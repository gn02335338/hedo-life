import {writeFileSync} from 'node:fs';
import {ROLES} from '../dist/roles.js';
import {createRun,getEvent,applyChoice,advance,requestExit,replayRun,validRun,canRequestCareer,requestCareer,enableActivitySchedule,canRequestBreak,requestBreak,canRequestActivityInvitation,requestActivityInvitation} from '../dist/engine.js';
import {patronageEligibleV29} from '../dist/patronage-v29.js';
import {isPatronageV49,patronageEligibleV49} from '../dist/patronage-v49.js';

// All evidence starts at createRun and follows canonical public actions. The
// search may inspect available choices, but never injects a stat, flag, gender,
// appointment, role, workday, event, RNG state or private history field.
const seedPrefix='e39-cal46-kin49';
const choose=(run,index)=>advance(applyChoice(run,index));
const applications=new Map(),gates=new Map(),followups=new Map();
const required=['automatic','career'].flatMap(origin=>['male','female'].flatMap(gender=>
 ['formal-success','formal-setback','wild-success','wild-setback','cancel'].map(result=>`${origin}-${gender}-${result}`)));
const gateKeys=['low-lick','low-boss','both-low','eligible'];
const followupKeys=['male','female'];
const score=run=>(run.completed?-10000:0)+run.stats.energy*1.4+run.stats.mood*1.7+run.stats.cash*.8+run.stats.boss*1.1+run.stats.trust*.3;
const searchScore=run=>{
 const s=run.stats;
 return (run.completed||run.pendingFamily?-10000:0)+Math.min(s.lick,82)*5+Math.min(s.boss,85)*2.5+Math.min(s.energy,65)*.5+Math.min(s.mood,60)*.7+Math.min(s.cash,55)*.35
  +Math.min(0,s.energy-25)*8+Math.min(0,s.mood-30)*8+Math.min(0,s.cash-12)*8;
};
function finish(run,depth=10){
 if(run.completed)return run;
 if(depth<=0)return null;
 const leave=requestExit(run);
 if(leave!==run){const result=finish(leave,depth-1);if(result)return result;}
 const event=getEvent(run);
 if(!event)return null;
 const options=event.choices.map((choice,index)=>({choice,index})).filter(({choice})=>choice.available!==false)
  .map(({index})=>choose(run,index)).sort((a,b)=>(b.completed?10000:score(b))-(a.completed?10000:score(a)));
 for(const next of options){const result=finish(next,depth-1);if(result)return result;}
 return null;
}
function record(id,kind,before,index,resolved,extra={}){
 const ended=finish(resolved);if(!ended)return null;
 return {id,kind,roleId:before.roleId,seed:before.seed,characterGender:before.characterGender,
  eventId:before.eventId,index,beforeActions:before.actions,actions:resolved.actions,
  completionActions:ended.actions,endingId:ended.endingId,...extra};
}
function inspectApplication(run){
 if(run.eventId!=='patronage-application'||run.pending||run.completed)return;
 if(run.stats.lick<70||run.stats.boss<65)throw new Error(`Ungated natural invitation: ${run.seed}`);
 const origin=run.patronageContext.origin;
 for(const [index,choice]of getEvent(run).choices.entries()){
  if(choice.available===false)continue;
  const pending=applyChoice(run,index),resolved=advance(pending),result=index===2?'cancel':`${index===1?'wild':'formal'}-${pending.history.at(-1).chanceOutcome}`;
  const id=`${origin}-${run.characterGender}-${result}`;
  if(applications.has(id))continue;
  const row=record(id,'application',run,index,resolved,{origin});if(row)applications.set(id,row);
  if(resolved.patronage&&!followups.has(run.characterGender)){
   let working=resolved;
   for(let step=0;step<12&&!working.completed;step++){
    if(working.history.slice(resolved.history.length).some(part=>['daily','fantasy'].includes(part.kind))){
     const proof=record(`followup-${run.characterGender}`,'followup',resolved,null,working);
     if(proof)followups.set(run.characterGender,proof);break;
    }
    const options=getEvent(working).choices.map((choice,index)=>({choice,index})).filter(({choice})=>choice.available!==false)
     .map(({index})=>choose(working,index)).sort((a,b)=>score(b)-score(a));
    if(!options.length)break;working=options[0];
   }
  }
 }
}
function inspect(run){
 if(run.pending||run.completed)return;
 inspectApplication(run);
 if(!['daily','fantasy'].includes(getEvent(run)?.kind)||!canRequestCareer(run)||!patronageEligibleV29(run))return;
 const eligible=patronageEligibleV49(run),{lick,boss}=run.stats;
 const id=eligible?'eligible':lick<70&&boss<65?'both-low':lick<70?'low-lick':'low-boss';
 const review=requestCareer(run),entry=getEvent(review).choices.findIndex(choice=>choice.effect==='patronageApply'&&choice.available!==false);
 if(eligible!==Boolean(entry>=0))throw new Error(`Career gate drift: ${id} ${run.seed}`);
 if(!gates.has(id)){
  const resolved=choose(review,getEvent(review).choices.findIndex(choice=>choice.effect==='careerDefer'));
  const row=record(id,'career-gate',review,null,resolved,{eligible,entryBeforeActions:run.actions});if(row)gates.set(id,row);
 }
 if(entry>=0)inspectApplication(choose(review,entry));
}
function observeLife(role,attempt){
 // Compact role index keeps every seed under createRun's 32-character cap.
 const seed=`${seedPrefix}-${ROLES.indexOf(role).toString(36)}-${attempt.toString(36)}`;
 let run=enableActivitySchedule(createRun(role.id,seed));
 for(let step=0;step<180&&!run.completed;step++){
  inspect(run);
  if(canRequestActivityInvitation(run)){
   run=requestActivityInvitation(run);run=choose(run,1);continue;
  }
  if(run.eventId==='patronage-application'){run=choose(run,2);continue;}
  if(canRequestBreak(run)&&(run.stats.mood<45||run.stats.energy<35)&&run.stats.cash>=8){
   let menu=requestBreak(run);
   if(menu.eventId==='kind-break')menu=choose(menu,getEvent(menu).choices.findIndex(choice=>choice.effect==='kindDecline'));
   if(menu.eventId==='self-care'){
    const rests=getEvent(menu).choices.map((choice,index)=>({choice,index})).filter(({choice})=>choice.available!==false&&choice.effect==='finishBreak')
     .map(({index})=>({index,run:choose(menu,index)})).sort((a,b)=>searchScore(b.run)-searchScore(a.run));
    if(rests[0]&&searchScore(rests[0].run)>searchScore(run)){run=rests[0].run;continue;}
   }
  }
  const options=getEvent(run).choices.map((choice,index)=>({choice,index})).filter(({choice})=>choice.available!==false)
   .map(({index})=>({index,run:choose(run,index)}))
   .sort((a,b)=>searchScore(b.run)-searchScore(a.run));
  if(!options.length)break;
  run=options[0].run;
 }
}

const maxAttempts=Number(process.argv[2]||600);
for(let attempt=0;attempt<maxAttempts&&(required.some(id=>!applications.has(id))||gateKeys.some(id=>!gates.has(id))||followupKeys.some(id=>!followups.has(id)));attempt++){
 for(const role of ROLES){
  observeLife(role,attempt);
 }
 if(attempt%10===9)console.log(JSON.stringify({attempts:attempt+1,applications:applications.size,gates:[...gates.keys()],missing:required.filter(id=>!applications.has(id))}));
}
const missing=[...required.filter(id=>!applications.has(id)),...gateKeys.filter(id=>!gates.has(id)),...followupKeys.filter(id=>!followups.has(id)).map(id=>`followup-${id}`)];
if(missing.length)throw new Error(`Missing natural kin49 witnesses: ${missing.join(', ')}`);
const routes=[...applications.values(),...gates.values(),...followups.values()];
for(const route of routes){
 const before=replayRun(route.roleId,route.seed,route.beforeActions),run=replayRun(route.roleId,route.seed,route.actions),ended=replayRun(route.roleId,route.seed,route.completionActions);
 if(!isPatronageV49(before)||!validRun(before)||!validRun(run)||!validRun(ended)||!ended.completed||ended.endingId!==route.endingId||run.characterGender!==route.characterGender)throw new Error(`Invalid kin49 witness ${route.id}`);
}
writeFileSync(new URL('../tests/fixtures/patronage-routes-v49.json',import.meta.url),JSON.stringify({
 method:'Natural e39-cal46-kin49 createRun lives, canonical public actions and completed continuations only. Both genders, automatic/career entry, formal/wild success/rejection, cancellation and every threshold quadrant are observed without injecting stats, flags, role, gender, event, appointment, history or RNG state.',
 applications:applications.size,gates:gates.size,followups:followups.size,routes
},null,2)+'\n');
console.log(JSON.stringify({applications:applications.size,gates:gates.size,routes:routes.length,missing}));
