import {writeFileSync} from 'node:fs';
import {ROLES} from '../dist/roles.js';
import {EVENTS} from '../dist/events.js';
import {getEvent,applyChoice,advance,requestExit,replayRun,validRun} from '../dist/engine.js';
import {simulate,replayRoute} from '../tests/find-routes-v3.mjs';

// Witnesses come only from ordinary createRun/choice/request actions. Replaying
// complete games also lets this finder inspect every real saved boundary.
const events=EVENTS.filter(event=>event.minRules===26),byId=new Map(events.map(event=>[event.id,event]));
if(!events.length)throw new Error('No e26 quiz scenes registered');
const found=new Map(),roles=new Map();
const choose=(run,index)=>advance(applyChoice(run,index));
function complete(run,depth=10){
 if(run.completed)return run;
 if(depth<=0)return null;
 const leave=requestExit(run);
 if(leave!==run){
  const result=complete(leave,depth-1);if(result)return result;
 }
 const options=getEvent(run).choices.map((choice,index)=>({choice,index})).filter(({choice})=>choice.available!==false)
  .map(({index})=>{const next=choose(run,index);return {next,score:(next.completed?10000:0)+(next.pendingFamily?500:0)+next.stats.mood+next.stats.energy+next.stats.cash*.2};})
  .sort((a,b)=>b.score-a.score);
 for(const {next} of options){const result=complete(next,depth-1);if(result)return result;}
 return null;
}
function inspect(run){
 if(run.pending||run.completed||!byId.has(run.eventId))return;
 const event=getEvent(run);
 for(const [index,choice] of event.choices.entries()){
  const id=`${event.id}-choice-${index}`;
  if(found.has(id)||choice.available===false)continue;
  const resolved=choose(run,index),ended=complete(resolved);
  if(!ended)continue;
  found.set(id,{id,eventId:event.id,index,roleId:run.roleId,actualRoleId:run.actualRoleId,seed:run.seed,
   actions:resolved.actions,completionActions:ended.actions,endingId:ended.endingId});
 }
 if(!roles.has(run.actualRoleId)){
  const row=[...found.values()].find(route=>route.eventId===event.id&&route.seed===run.seed);
  if(row)roles.set(run.actualRoleId,{...row,id:`role-${run.actualRoleId}`});
 }
}
const targets=['nasdaq','taiwan','acquired','slacker','promotion','second_offer','sycophant','historian','pip_exit','pip_fail','cold_storage'];
const required=events.flatMap(event=>event.choices.map((choice,index)=>`${event.id}-choice-${index}`));
const maxAttempts=Number(process.argv[2]||2500);
for(let attempt=0;attempt<maxAttempts&&(found.size<required.length||roles.size<ROLES.length);attempt++){
 for(const role of ROLES){
  const {route}=simulate(role.id,targets[attempt%targets.length],attempt,{seedPrefix:'e26'});
  replayRoute(route,inspect);
 }
 if(attempt%100===99)console.log(JSON.stringify({attempts:attempt+1,choices:found.size,expected:required.length,roles:roles.size,missing:required.filter(id=>!found.has(id))}));
}
const missing=required.filter(id=>!found.has(id));
const missingRoles=ROLES.map(role=>role.id).filter(id=>!roles.has(id));
if(missing.length||missingRoles.length)throw new Error(`Missing natural e26 witnesses: ${JSON.stringify({missing,missingRoles})}`);
const routes=[...found.values(),...roles.values()];
for(const route of routes){
 const before=replayRun(route.roleId,route.seed,route.actions.slice(0,-1));
 if(before.eventId!==route.eventId||before.actualRoleId!==route.actualRoleId)throw new Error(`Invalid scene prefix ${route.id}`);
 const resolved=replayRun(route.roleId,route.seed,route.actions),ended=replayRun(route.roleId,route.seed,route.completionActions);
 if(!validRun(resolved)||!validRun(ended)||!ended.completed||ended.endingId!==route.endingId)throw new Error(`Invalid completion ${route.id}`);
}
writeFileSync(new URL('../tests/fixtures/quiz-routes-v26.json',import.meta.url),JSON.stringify({
 method:'Natural e26 createRun lives and canonical actions only. Every new scene response has a replayable prefix and completed continuation; no role, event, stat, flag, history or RNG state is injected.',
 eventCount:events.length,choiceCount:required.length,routes
},null,2)+'\n');
console.log(JSON.stringify({events:events.length,choices:found.size,roles:roles.size,routes:routes.length,missing}));
