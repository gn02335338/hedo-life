import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {ROLES} from '../dist/roles.js';
import * as E from '../dist/engine.js';
import {moodRestWarningV62} from '../dist/life-balance-v62.js';

// Lookahead discovers natural checkpoints. Every saved life starts at
// createRun and contains only public actions, never edited resources/state.
const required=['mood-only-gap','paid-mood-recovery','cancel-mood-return','zero-mood-collapse','pip-mood-gap','activity-mood-return','treat-mood-return'];
const routes=new Map(),event=run=>E.getEvent(run),gap=run=>E.isWorkGapOpenV50(run),choose=(run,index)=>E.advance(E.applyChoice(run,index));
const options=run=>(event(run)?.choices||[]).map((choice,index)=>({choice,index})).filter(({choice})=>choice.available!==false);
const inputs={
 arm:[{kind:'arm',mode:'tap',taps:[]},{kind:'arm',mode:'steady',taps:Array.from({length:8},(_,i)=>500+i*1000)}],
 diet:[{kind:'diet',days:Array.from({length:7},()=>({meal:2,exercise:2}))},{kind:'diet',days:Array.from({length:7},(_,i)=>({meal:i%2,exercise:i===2||i===5?2:i%2}))}],
 roadshow:[{kind:'roadshow',matches:[2,2,0,0,1,1]},{kind:'roadshow',matches:[0,1,2,1,0,2]}],
 dinner:[{kind:'dinner',plates:[3,3,3,3,3,3]},{kind:'dinner',plates:[0,1,2,0,1,1]}],
 banquet:[{kind:'banquet',beats:[]},{kind:'banquet',beats:Array.from({length:12},(_,i)=>500+i*600)}],
 basketball:[{kind:'basketball',moves:[1,1,1,1,1]},{kind:'basketball',moves:[0,2,1,2,0]}],
 review:[{kind:'review',evidence:[2,2,1,1]},{kind:'review',evidence:[0,1,2,0]}]
};
function remember(id,before,after,extra={}){
 if(routes.has(id)||after.actions.length>285)return;
 routes.set(id,{id,roleId:before.roleId,seed:before.seed,beforeActions:before.actions,actions:after.actions,...extra});
}
function restEvidence(before){
 if(!E.canRequestBreak(before))return;
 let menu=E.requestBreak(before);
 if(event(menu).id==='kind-break'){
  const option=options(menu).find(({choice})=>choice.effect==='kindDecline');if(!option)return;menu=choose(menu,option.index);
 }
 if(event(menu).id!=='self-care')return;
 for(const {choice,index}of options(menu)){
  if(!['finishBreak','cancelBreak'].includes(choice.effect))continue;
  const after=choose(menu,index);if(after.completed||!gap(after))continue;
  if(choice.effect==='cancelBreak'&&moodRestWarningV62(before))remember('cancel-mood-return',before,after,{purchaseIndex:index});
  if(choice.effect==='finishBreak'&&moodRestWarningV62(before)&&before.stats.energy>30&&after.stats.mood>30&&after.stats.cash<before.stats.cash)remember('paid-mood-recovery',before,after,{purchaseIndex:index});
 }
}
function inspect(before,index,pending,after){
 if(!after.completed&&gap(after)&&moodRestWarningV62(after)){
  if(after.stats.energy>30)remember('mood-only-gap',before,after,{index});
  if(after.pip?.active)remember('pip-mood-gap',before,after,{index});
  if(before.activityContext&&!after.activityContext)remember('activity-mood-return',before,after,{index});
  if(before.treatsContext&&!after.treatsContext)remember('treat-mood-return',before,after,{index});
  restEvidence(after);
 }
 if(pending.pending&&pending.stats.mood===0&&['mood-collapse','mood-self-destruct'].includes(after.eventId))remember('zero-mood-collapse',before,after,{index});
}
function inspectTreats(run,depth=0){
 if(!run.treatsContext||depth>2||routes.has('treat-mood-return'))return;
 if(moodRestWarningV62(run))remember('treat-mood-guard',run,run);
 for(const {index}of options(run)){
  const pending=E.applyChoice(run,index),after=E.advance(pending);inspect(run,index,pending,after);inspectTreats(after,depth+1);
 }
}
function score(run,mode){
 if(run.completed||run.pendingFamily||run.chapterContext)return -10000;
 const s=run.stats;let result=s.energy*1.2+s.cash*.6+s.boss*.35+s.trust*.1;
 if(mode===0)result-=s.mood*2.5;
 if(mode===1)result-=s.mood*6;
 if(mode===2)result-=Math.abs(s.mood-24)*3;
 if(mode===3)result+=s.mood*.9+Math.max(0,30-s.boss)*6;
 if(mode!==1)result+=Math.min(0,s.mood-7)*30;
 result+=Math.min(0,s.energy-10)*15+Math.min(0,s.cash-8)*15;
 return result;
}
function life(attempt,mode){
 const seed='e39-r62-n-'+createHash('sha256').update(`mood-rest-witness-${attempt}-${mode}`).digest('hex').slice(0,22),role=ROLES[attempt%ROLES.length];
 let run=E.enableActivitySchedule(E.createRun(role.id,seed));
 for(let step=0;step<180&&!run.completed&&run.actions.length<275;step++){
  if(E.canRequestSalaryAdvice(run)){run=E.requestSalaryAdvice(run);continue;}
  if(E.canRequestActivityInvitation(run)){run=E.requestActivityInvitation(run);continue;}
  if(run.treatsContext)inspectTreats(run);
  if(gap(run)){
   restEvidence(run);
   if(E.canRequestBreak(run)&&run.stats.cash>=8&&(run.stats.energy<=15||mode===3&&run.stats.mood<=12)){run=E.requestBreak(run);continue;}
   run=E.applyChoice(run,0);continue;
  }
  if(moodRestWarningV62(run))for(const [key,id]of [['activityContext','activity-mood-guard'],['treatsContext','treat-mood-guard']])if(run[key])remember(id,run,run);
  const interactive=E.getActivityPlayV55(run);
  if(interactive){
   const candidates=inputs[run.activityContext.id].map(input=>{const pending=E.applyActivityPlay(run,input);return {pending,after:E.advance(pending)};});
   for(const row of candidates)inspect(run,null,row.pending,row.after);run=candidates.sort((a,b)=>score(b.after,mode)-score(a.after,mode))[0].after;continue;
  }
  const candidates=options(run).map(({choice,index})=>{const pending=E.applyChoice(run,index);return {choice,index,pending,after:E.advance(pending)};});
  if(!candidates.length)break;
  for(const row of candidates)inspect(run,row.index,row.pending,row.after);
  let picked;
  if(run.activityInvitationContext)picked=candidates.find(row=>row.index===0);
  else if(run.shareholderContext)picked=candidates.find(row=>row.index===2);
  else if(event(run).id==='kind-break')picked=candidates.find(row=>row.choice.effect==='kindDecline');
  else if(event(run).id==='kind-workday')picked=candidates.find(row=>row.choice.effect==='kindWorkDecline');
  else if(event(run).id==='self-care')picked=candidates.filter(row=>row.choice.effect==='finishBreak').sort((a,b)=>b.after.stats.energy-a.after.stats.energy||score(b.after,mode)-score(a.after,mode))[0];
  const pip=candidates.find(row=>row.choice.effect==='startPip'),back=candidates.find(row=>['patronageReturn','wealthReturn','wealthBack','raiseCancel'].includes(row.choice.effect));
  run=(picked||pip||back||candidates.sort((a,b)=>score(b.after,mode)-score(a.after,mode))[0]).after;
 }
}
const maxAttempts=Number(process.argv[2]||80);
for(let attempt=0;attempt<maxAttempts&&required.some(id=>!routes.has(id));attempt++){
 for(const mode of [0,1,2,3])life(attempt,mode);
 if((attempt+1)%5===0)console.log(JSON.stringify({attempts:attempt+1,routes:routes.size,missing:required.filter(id=>!routes.has(id))}));
}
const missing=required.filter(id=>!routes.has(id));if(missing.length)throw Error(`Missing natural mood-rest routes: ${missing.join(', ')}`);
for(const route of routes.values())for(const actions of [route.beforeActions,route.actions]){
 const run=E.replayRun(route.roleId,route.seed,actions);if(!E.validRun(run))throw Error(`Invalid canonical route: ${route.id}`);
}
writeFileSync(new URL('../tests/fixtures/mood-rest-routes-v62.json',import.meta.url),JSON.stringify({method:'Natural r62 createRun lives using enableActivitySchedule and public actions only. Lookahead selects deterministic inputs; no injected stats, flags, dates, contexts, histories or RNG.',required,routes:[...routes.values()]},null,2)+'\n');
console.log(JSON.stringify({routes:routes.size,missing}));
