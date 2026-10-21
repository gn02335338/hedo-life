import {writeFileSync} from 'node:fs';
import {ROLES as ALL_ROLES} from '../dist/roles.js';
import {getEvent,applyChoice,advance,requestExit,replayRun,validRun} from '../dist/engine.js';
import {wealthEligibilityV27} from '../dist/wealth-exit-v27.js';
import {simulate,replayRoute} from '../tests/find-routes-v3.mjs';
const ROLES=ALL_ROLES.filter(role=>(role.minRules||1)<=27);

// Every prefix below comes from a fresh life and canonical public actions. A
// menu may be inspected or declined, but neither resources nor RNG are injected.
const families=['venture_independent','venture_restart','retired_free','retired_flexible'];
const found=new Map(),features=new Map();
const choose=(run,index)=>advance(applyChoice(run,index));
function planFrom(run){
 if(run.eventId==='wealth-plan')return run;
 let menu=run;
 if(!['exit-menu','career-exit','rank-exit'].includes(menu.eventId))menu=requestExit(menu);
 const index=getEvent(menu)?.choices.findIndex(choice=>choice.effect==='wealthPlan'&&choice.available!==false);
 return index>=0?choose(menu,index):null;
}
function row(id,run,extra={}){
 return {id,roleId:run.roleId,actualRoleId:run.actualRoleId,seed:run.seed,eventId:run.eventId,actions:run.actions,...extra};
}
function inspect(run){
 if(run.pending||run.completed)return;
 const eligibility=wealthEligibilityV27(run);
 if(run.pip?.active&&run.stats.cash>=75&&eligibility.workDays>=6&&!features.has('wealth-waits-for-pip'))features.set('wealth-waits-for-pip',row('wealth-waits-for-pip',run,{kind:'blocked-pip'}));
 if(!eligibility.eligible)return;
 const plan=planFrom(run);
 if(!plan||plan.eventId!=='wealth-plan')return;
 for(const index of [0,1]){
  if(getEvent(plan).choices[index]?.available===false)continue;
  const scene=choose(plan,index);
  const type=index===0?'startup':'retire';
  if(!features.has(`${type}-view`))features.set(`${type}-view`,row(`${type}-view`,scene,{kind:'view',originEventId:run.eventId}));
  for(const [reply,choice]of getEvent(scene).choices.entries()){
   if(choice.available===false)continue;
   const resolved=choose(scene,reply);
   if(resolved.completed&&families.some(family=>resolved.endingId===`${family}-${run.roleId}`)){
    const id=resolved.endingId;
    if(!found.has(id))found.set(id,row(id,resolved,{kind:'ending',family:families.find(family=>id===`${family}-${run.roleId}`),sceneId:scene.eventId,index:reply,planActions:plan.actions,choiceActions:scene.actions}));
   }
   if(choice.effect==='wealthBack'&&!features.has(`${type}-back`))features.set(`${type}-back`,row(`${type}-back`,resolved,{kind:'back',sceneId:scene.eventId,index:reply,planActions:plan.actions,choiceActions:scene.actions,originEventId:run.eventId}));
  }
 }
 if(!features.has('plan-return')){
  const index=getEvent(plan).choices.findIndex(choice=>choice.effect==='wealthReturn');
  if(index>=0){const returned=choose(plan,index);features.set('plan-return',row('plan-return',returned,{kind:'return',planActions:plan.actions,index,originEventId:run.eventId}));}
 }
 if(run.eventId==='wealth-plan'){
  const id=run.flags.wealth_retire_notice?'notice-retirement':'notice-startup';
  if(!features.has(id))features.set(id,row(id,run,{kind:'notice'}));
 }
}
const maxAttempts=Number(process.argv[2]||500);
const targets=['retired_free','venture_independent','retired_flexible','venture_restart','nasdaq','taiwan','acquired'];
for(let attempt=0;attempt<maxAttempts&&found.size<ROLES.length*families.length;attempt++){
 for(const role of ROLES){
  if(families.every(family=>found.has(`${family}-${role.id}`)))continue;
  const {route}=simulate(role.id,targets[attempt%targets.length],attempt,{seedPrefix:'e27'});
  replayRoute(route,inspect);
 }
 if(attempt%25===24)console.log(JSON.stringify({attempts:attempt+1,found:found.size,expected:ROLES.length*families.length,features:[...features.keys()]}));
}
const missing=ROLES.flatMap(role=>families.map(family=>`${family}-${role.id}`)).filter(id=>!found.has(id));
if(missing.length)throw new Error(`Missing natural wealth exits: ${missing.join(', ')}`);
const missingFeatures=['startup-view','startup-back','retire-view','retire-back','plan-return','notice-startup','notice-retirement','wealth-waits-for-pip'].filter(id=>!features.has(id));
if(missingFeatures.length)throw new Error(`Missing natural wealth features: ${missingFeatures.join(', ')}`);
const routes=[...found.values(),...features.values()];
for(const route of routes){
 const run=replayRun(route.roleId,route.seed,route.actions);
 if(!validRun(run)||run.endingId!==(route.family?route.id:null)||run.eventId!==route.eventId)throw new Error(`Invalid witness ${route.id}`);
}
writeFileSync(new URL('../tests/fixtures/wealth-routes-v27.json',import.meta.url),JSON.stringify({
 method:'Natural e27 createRun lives and canonical choice/exit/break/career actions only. Every new ending has a replayable life; no role, event, stat, flag, history, turn or RNG state is injected.',
 families,routes
},null,2)+'\n');
console.log(JSON.stringify({endings:found.size,features:[...features.keys()],routes:routes.length,missing}));
