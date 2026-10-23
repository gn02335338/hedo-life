import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as E from '../dist/engine.js';
import {CAST_IDS_V65} from '../dist/cast-v65.js';
import {MEAL_GUEST_IDS_V39} from '../dist/meals-cast-v39.js';

// Start from a real work warning in the shared natural witness catalogue.
// All later invitation attempts and cancellations are public player actions;
// declined or cancelled invitations are free. No wallet, RNG or affinity edit.
const catalogue=JSON.parse(readFileSync(new URL('../tests/fixtures/expansion-v65.json',import.meta.url),'utf8'));
const routes=new Map();
const choose=(run,index)=>E.advance(E.applyChoice(run,index));
const ev=run=>E.getEvent(run);
const save=(id,run,before=null,index=null)=>{if(!routes.has(id))routes.set(id,{id,roleId:run.roleId,seed:run.seed,actions:run.actions,...(before?{beforeActions:before.actions}:{}),...(index!==null?{index}:{})});};
function menuFor(source,guest){
 let run=source;
 if(run.mealContext?.guest)run=choose(run,ev(run).choices.findIndex(choice=>choice.effect==='mealCancel'));
 if(ev(run).id==='self-care')run=choose(run,ev(run).choices.findIndex(choice=>choice.effect==='mealOpen'));
 for(let page=0;page<5;page++){
  if(ev(run).choices.some(choice=>choice.mealTarget===guest))return run;
  const next=ev(run).choices.findIndex(choice=>choice.effect==='mealPage'&&choice.mealPage===(run.mealContext.page+1));
  if(next<0)throw Error(`Cannot find page for ${guest}`);run=choose(run,next);
 }
 throw Error(`Missing ${guest} meal page`);
}
function findCare(route){
 for(let length=0;length<=route.actions.length;length++){
  const run=E.replayRun(route.roleId,route.seed,route.actions.slice(0,length));
  if(E.canRequestBreak(run)&&run.stats.cash>=25){let care=E.requestBreak(run);if(care.eventId==='kind-break')care=choose(care,ev(care).choices.findIndex(choice=>choice.effect==='kindDecline'));if(care.eventId==='self-care')return care;}
 }
 return null;
}
function collectCare(initial){
 let source=initial;
 for(let offset=0;offset<=MEAL_GUEST_IDS_V39.length;offset++){
  for(const guest of CAST_IDS_V65){
   const menu=menuFor(source,guest),index=ev(menu).choices.findIndex(choice=>choice.mealTarget===guest);if(ev(menu).choices[index].available===false)continue;
   save(`menu-${guest}`,menu);const pending=E.applyChoice(menu,index),after=E.advance(pending),accepted=pending.pendingEffect==='mealPick';save(`${accepted?'accepted':'declined'}-${guest}`,after,menu,index);
   if(accepted){save(`cancelled-${guest}`,choose(after,2),after,2);for(const reply of [0,1]){const paid=choose(after,reply),reaction=paid.history.at(-1).mealOutcome.reaction;save(`paid-${guest}-${reply}-${reaction}`,paid,after,reply);}}
  }
  if(offset===MEAL_GUEST_IDS_V39.length)break;
  const old=MEAL_GUEST_IDS_V39[offset],menu=menuFor(source,old),index=ev(menu).choices.findIndex(choice=>choice.mealTarget===old);if(ev(menu).choices[index].available===false)continue;
  source=choose(menu,index);if(source.mealContext?.guest)source=choose(source,2);
  // Reopening starts at page a. Never invent a guest or bypass a refusal.
  if(source.mealContext)source=choose(source,ev(source).choices.findIndex(choice=>choice.effect==='mealCancel'));
 }
}
for(const route of catalogue.routes.filter(route=>/^cast-(?:zoe|action|hester|simon|james|johnny)$/.test(route.id))){const care=findCare(route);if(care)collectCare(care);}
const required=CAST_IDS_V65.flatMap(guest=>[`menu-${guest}`,`accepted-${guest}`,`declined-${guest}`,`cancelled-${guest}`,...[0,1].flatMap(reply=>['warm','neutral','mine'].map(reaction=>`paid-${guest}-${reply}-${reaction}`))]);
const resilience=run=>run.completed||run.chapterContext||run.pendingFamily?-1e6:Math.min(run.stats.energy,run.stats.mood)*5+run.stats.energy+run.stats.mood+run.stats.cash*.6+Math.min(run.stats.boss,65)*.8-(run.pip?.active?100:0);
for(let attempt=0;attempt<60&&required.some(id=>!routes.has(id));attempt++){
 let run=E.enableActivitySchedule(E.createRun(['project','system','hr'][attempt%3],'e39-r65-n-'+createHash('sha256').update(`cast-meal-${attempt}`).digest('hex').slice(0,22)));
 for(let step=0;step<140&&!run.completed&&run.turn<19;step++){
  if(E.canRequestBreak(run)&&run.stats.cash>=25){let care=E.requestBreak(run);if(care.eventId==='kind-break')care=choose(care,ev(care).choices.findIndex(choice=>choice.effect==='kindDecline'));if(care.eventId==='self-care'){collectCare(care);break;}}
  if(E.canRequestSalaryAdvice(run))run=E.requestSalaryAdvice(run);
  if(E.canRequestActivityInvitation(run))run=E.requestActivityInvitation(run);
  if(run.activityInvitationContext){run=choose(run,1);continue;}
  if(E.isWorkGapOpenV50(run)){run=E.applyChoice(run,0);continue;}
  if(run.shareholderContext?.stage==='offer'){run=choose(run,2);continue;}
  const candidates=ev(run).choices.map((choice,index)=>({choice,index})).filter(row=>row.choice.available!==false).map(row=>({...row,after:choose(run,row.index)}));if(!candidates.length)break;run=candidates.sort((a,b)=>resilience(b.after)-resilience(a.after))[0].after;
 }
}
for(const id of required)if(!routes.has(id))throw Error(`Missing ${id}`);
for(const route of routes.values()){const run=E.replayRun(route.roleId,route.seed,route.actions);if(!E.validRun(run))throw Error(`Invalid ${route.id}`);}
writeFileSync(new URL('../tests/fixtures/cast-meals-v65.json',import.meta.url),JSON.stringify({method:'Canonical work-warning prefixes from expansion-v65, followed by ordinary invitations, cancellations and table choices. No injected stats, dates, RNG, contexts or affinity. Earlier free invitations supply independent natural RNG positions.',routes:[...routes.values()]},null,2)+'\n');
console.log(JSON.stringify({routes:routes.size,guests:CAST_IDS_V65}));
