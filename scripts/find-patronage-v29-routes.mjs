import {writeFileSync} from 'node:fs';
import {ROLES} from '../dist/roles.js';
import {GENDER_EVENTS_V29} from '../dist/events-gender-v29.js';
import {getEvent,applyChoice,advance,requestExit,replayRun,validRun,canRequestCareer,requestCareer} from '../dist/engine.js';
import {patronageEligibleV29} from '../dist/patronage-v29.js';
import {simulate,replayRoute} from '../tests/find-routes-v3.mjs';

// Observe fresh lives and fork only canonical public choices. None of these
// proofs supplies a role reassignment, gender, title, flag, stat or RNG state.
const choose=(run,index)=>advance(applyChoice(run,index));
const events=new Map(GENDER_EVENTS_V29.map(event=>[event.id,event]));
const scenes=new Map(),applications=new Map(),features=new Map();
const required=GENDER_EVENTS_V29.flatMap(event=>event.choices.map((choice,index)=>`${event.id}-choice-${index}`));
const appKeys=['male','female'].flatMap(gender=>['success','setback','declined','wild-success','wild-setback'].map(outcome=>`application-${gender}-${outcome}`));
const featureKeys=['retention-male','retention-female','manual-male','manual-female'];
const score=run=>(run.completed?-10000:0)+run.stats.energy*1.4+run.stats.mood*1.7+run.stats.cash*.8+run.stats.boss*1.1+run.stats.trust*.3;
function finish(run,depth=10){
 if(run.completed)return run;if(depth<=0)return null;
 const leave=requestExit(run);
 if(leave!==run){const result=finish(leave,depth-1);if(result)return result;}
 const options=getEvent(run).choices.map((choice,index)=>({choice,index})).filter(({choice})=>choice.available!==false)
  .map(({index})=>choose(run,index)).sort((a,b)=>(b.completed?10000:score(b))-(a.completed?10000:score(a)));
 for(const next of options){const result=finish(next,depth-1);if(result)return result;}
 return null;
}
function record(kind,id,before,index,resolved){
 const ended=finish(resolved);if(!ended)return null;
 return {id,kind,eventId:before.eventId,index,roleId:before.roleId,actualRoleId:before.actualRoleId,
  seed:before.seed,characterGender:before.characterGender,beforeActions:before.actions,actions:resolved.actions,
  completionActions:ended.actions,endingId:ended.endingId};
}
function retention(appointed){
 const gender=appointed.characterGender,id=`retention-${gender}`;
 if(features.has(id))return;
 let run=appointed;
 for(let step=0;step<35&&!run.completed;step++){
  const subsequent=run.history.slice(appointed.patronage.historyIndex+1);
  if(subsequent.some(row=>row.breakdown?.some(part=>part.source==='income'))&&subsequent.some(row=>row.breakdown?.some(part=>part.source==='patronage-perk'))){
   const ended=finish(run);if(!ended)return;
   features.set(id,{id,kind:'retention',roleId:run.roleId,actualRoleId:run.actualRoleId,seed:run.seed,
    characterGender:gender,beforeActions:appointed.actions,actions:run.actions,completionActions:ended.actions,endingId:ended.endingId});return;
  }
  const options=getEvent(run).choices.map((choice,index)=>({choice,index})).filter(({choice})=>choice.available!==false)
   .map(({index})=>({index,run:choose(run,index)})).sort((a,b)=>score(b.run)-score(a.run));
  run=options[0].run;
 }
}
function inspect(run){
 if(run.pending||run.completed)return;
 if(patronageEligibleV29(run)&&canRequestCareer(run)&&!features.has(`manual-${run.characterGender}`)){
  const review=requestCareer(run),index=getEvent(review).choices.findIndex(choice=>choice.effect==='patronageApply'&&choice.available!==false);
  if(index>=0){
   const scene=choose(review,index),resolved=choose(scene,2),id=`manual-${run.characterGender}`;
   const row=record('manual-entry',id,scene,2,resolved);if(row)features.set(id,row);
  }
 }
 if(events.has(run.eventId)){
  for(const [index,choice]of getEvent(run).choices.entries()){
   const id=`${run.eventId}-choice-${index}`;if(scenes.has(id)||choice.available===false)continue;
   const row=record('scene',id,run,index,choose(run,index));if(row)scenes.set(id,row);
  }
 }
 if(run.eventId==='patronage-application'){
  for(const [index,choice]of getEvent(run).choices.entries()){
   if(choice.available===false)continue;
   const pending=applyChoice(run,index),resolved=advance(pending),outcome=index===2?'declined':pending.history.at(-1).chanceOutcome;
   const id=`application-${run.characterGender}-${index===1?'wild-':''}${outcome}`;
   if(!applications.has(id)){const row=record('application',id,run,index,resolved);if(row)applications.set(id,row);}
   if(resolved.patronage)retention(resolved);
  }
 }
}
const targets=['nasdaq','taiwan','acquired','slacker','promotion','second_offer','sycophant','historian','pip_exit','cold_storage'];
const maxAttempts=Number(process.argv[2]||1000);
for(let attempt=0;attempt<maxAttempts&&(scenes.size<required.length||appKeys.some(id=>!applications.has(id))||featureKeys.some(id=>!features.has(id)));attempt++){
 for(const role of ROLES){
  const {route}=simulate(role.id,targets[attempt%targets.length],attempt,{seedPrefix:'e29'});
  replayRoute(route,inspect);
 }
 if(attempt%50===49)console.log(JSON.stringify({attempts:attempt+1,choices:scenes.size,expected:required.length,applications:[...applications.keys()],features:[...features.keys()],missing:required.filter(id=>!scenes.has(id))}));
}
const missing=[...required.filter(id=>!scenes.has(id)),...appKeys.filter(id=>!applications.has(id)),...featureKeys.filter(id=>!features.has(id))];
if(missing.length)throw new Error(`Missing natural e29 witnesses: ${missing.join(', ')}`);
const routes=[...scenes.values(),...applications.values(),...features.values()];
for(const route of routes){
 const run=replayRun(route.roleId,route.seed,route.actions),ended=replayRun(route.roleId,route.seed,route.completionActions);
 if(!validRun(run)||!validRun(ended)||!ended.completed||ended.endingId!==route.endingId||run.characterGender!==route.characterGender)throw new Error(`Invalid e29 witness ${route.id}`);
}
writeFileSync(new URL('../tests/fixtures/patronage-routes-v29.json',import.meta.url),JSON.stringify({
 method:'Natural e29 createRun lives and canonical actions only. Each of the 36 new scene choices, both genders and three application outcomes has a save-safe prefix and completed continuation. No gender, title, role, stat, flag, history or RNG state is injected.',
 eventCount:GENDER_EVENTS_V29.length,choiceCount:required.length,routes
},null,2)+'\n');
console.log(JSON.stringify({events:GENDER_EVENTS_V29.length,choices:scenes.size,applications:applications.size,features:features.size,routes:routes.length,missing}));
