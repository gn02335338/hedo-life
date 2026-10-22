import {writeFileSync} from 'node:fs';
import {ROLES} from '../dist/roles.js';
import * as E from '../dist/engine.js';

// Every witness starts at createRun and uses public actions. No resources,
// flags, history, workdays, events or RNG state are injected by this search.
const routes=new Map();
const required=['healthy-onboarding','healthy-work','warning-gap','paid-recovery','cancel-return','critical-gap','pip-warning-gap','pip-paid-recovery','exhaustion','mood-warning-only'];
const event=run=>E.getEvent(run);
const gap=run=>E.isWorkGapOpenV50(run);
const choose=(run,index)=>E.advance(E.applyChoice(run,index));
const options=run=>event(run)?.choices.map((choice,index)=>({choice,index})).filter(({choice})=>choice.available!==false)||[];
function remember(id,before,after,extra={}){
 if(routes.has(id)||after.actions.length>285)return;
 routes.set(id,{id,roleId:before.roleId,seed:before.seed,beforeActions:before.actions,actions:after.actions,...extra});
}
function score(run,mode){
 if(run.completed||run.pendingFamily||run.chapterContext)return -10000;
 const s=run.stats;
 let value=s.mood*1.5+s.cash*.45+s.boss*.45+s.energy*.2;
 if(mode===0)value-=s.energy*1.4;
 if(mode===1)value-=s.energy*3.5;
 if(mode===2)value-=s.mood*2.3;
 if(mode===3)value+=Math.max(0,35-s.boss)*5;
 value+=Math.min(0,s.energy-3)*30+Math.min(0,s.cash-7)*10;
 if(mode!==2)value+=Math.min(0,s.mood-15)*15;
 return value;
}
function restEvidence(before){
 if(!E.canRequestBreak(before))return;
 let menu=E.requestBreak(before);
 if(event(menu).id==='kind-break'){
  const decline=options(menu).find(({choice})=>choice.effect==='kindDecline');
  if(!decline)return;
  menu=choose(menu,decline.index);
 }
 if(event(menu).id!=='self-care')return;
 for(const {choice,index}of options(menu)){
  if(!['finishBreak','cancelBreak'].includes(choice.effect))continue;
  const after=choose(menu,index);if(after.completed||!gap(after))continue;
  if(choice.effect==='cancelBreak')remember('cancel-return',before,after,{purchaseIndex:index});
  else if(after.stats.energy>30&&after.stats.cash<before.stats.cash){
   remember('paid-recovery',before,after,{purchaseIndex:index});
   if(before.pip?.active)remember('pip-paid-recovery',before,after,{purchaseIndex:index});
  }
 }
}
function inspect(before,index,after){
 const source=event(before);
 if(source.kind==='onboarding'&&!after.completed&&!gap(after)&&['daily','fantasy'].includes(event(after)?.kind)&&after.stats.energy>30)remember('healthy-onboarding',before,after,{index});
 if(['daily','fantasy'].includes(source.kind)&&after.turn>before.turn&&!after.completed&&!gap(after)&&['daily','fantasy'].includes(event(after)?.kind)&&after.stats.energy>30)remember('healthy-work',before,after,{index});
 if(!after.completed&&gap(after)&&after.stats.energy>0&&after.stats.energy<=30){
  remember('warning-gap',before,after,{index});
  if(after.stats.energy<=15)remember('critical-gap',before,after,{index});
  if(after.pip?.active)remember('pip-warning-gap',before,after,{index});
  restEvidence(after);
 }
 if(!after.completed&&!gap(after)&&['daily','fantasy'].includes(event(after)?.kind)&&after.stats.energy>30&&after.stats.mood>0&&after.stats.mood<=30)remember('mood-warning-only',before,after,{index});
 const pending=E.applyChoice(before,index);
 if(pending.pending&&pending.stats.energy===0)remember('exhaustion',before,after,{index,pendingEnergy:pending.stats.energy});
}
function life(role,attempt,mode){
 const suffix=`${ROLES.indexOf(role).toString(36)}${attempt.toString(36).padStart(5,'0')}${mode}proof`;
 let run=E.enableActivitySchedule(E.createRun(role.id,`e39-cal46-kin49-g-e-${suffix}`));
 for(let step=0;step<170&&!run.completed&&run.actions.length<275;step++){
  if(E.canRequestSalaryAdvice(run)){run=E.requestSalaryAdvice(run);continue;}
  if(gap(run)){
   restEvidence(run);
   if(E.canRequestBreak(run)&&run.stats.cash>=8&&mode!==1){
    let menu=E.requestBreak(run);
    if(event(menu).id==='kind-break'){
     const decline=options(menu).find(({choice})=>choice.effect==='kindDecline');
     if(decline)menu=choose(menu,decline.index);
    }
    const paid=options(menu).find(({choice})=>choice.effect==='finishBreak'&&choice.delta?.energy>0&&choice.available!==false);
    if(paid){run=choose(menu,paid.index);continue;}
   }
   run=choose(run,0);continue;
  }
  const available=options(run);if(!available.length)break;
  const ranked=available.map(({choice,index})=>({choice,index,next:choose(run,index)})).sort((a,b)=>score(b.next,mode)-score(a.next,mode));
  for(const row of ranked)inspect(run,row.index,row.next);
  const pip=ranked.find(({choice})=>choice.effect==='startPip');
  const back=ranked.find(({choice})=>['patronageReturn','kindWorkDecline','wealthReturn'].includes(choice.effect));
  const picked=pip||back||ranked[0];run=picked.next;
 }
}
const maxAttempts=Number(process.argv[2]||30);
for(let attempt=0;attempt<maxAttempts&&required.some(id=>!routes.has(id));attempt++){
 for(const role of ROLES)for(const mode of [0,1,2,3])life(role,attempt,mode);
 console.log(JSON.stringify({attempts:attempt+1,routes:routes.size,missing:required.filter(id=>!routes.has(id))}));
}
const missing=required.filter(id=>!routes.has(id));
if(missing.length)throw new Error(`Missing natural energy/rest witnesses: ${missing.join(', ')}`);
for(const row of routes.values())for(const actions of [row.beforeActions,row.actions]){
 const run=E.replayRun(row.roleId,row.seed,actions);
 if(!E.validRun(run))throw new Error(`Invalid canonical witness: ${row.id}`);
}
writeFileSync(new URL('../tests/fixtures/energy-rest-routes-v53.json',import.meta.url),JSON.stringify({method:'Natural createRun lives under e39-cal46-kin49-g-e-. Canonical public actions only; no injected resources, flags, events, history, workday or RNG.',required,routes:[...routes.values()]},null,2)+'\n');
console.log(JSON.stringify({routes:routes.size,missing}));
