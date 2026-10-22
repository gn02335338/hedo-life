import {writeFileSync} from 'node:fs';
import {ROLES} from '../dist/roles.js';
import * as E from '../dist/engine.js';

// Every witness starts at createRun. Branching only chooses public actions;
// the search never injects stats, flags, events, workdays, history or RNG state.
const routes=new Map(),seenStates=new Set();
const prefix='e39-cal46-kin49-g-';
const event=run=>E.getEvent(run);
const gap=run=>E.isWorkGapOpenV50(run);
const choose=(run,index)=>E.advance(E.applyChoice(run,index));
const available=run=>event(run).choices.map((choice,index)=>({choice,index})).filter(({choice})=>choice.available!==false);
const required=['onboarding-gap','work-gap','rest-paid','rest-cancel','meal-paid','meal-declined','kind-break-paid','kind-workday-return','mood-collapse','salary-cut','low-pay-tip','pip-start','pip-work-gap','pip-rest','pip-review','patronage-application','activity-declined','activity-completed','rage-event-imagined','rage-result-imagined','career-return','raise-return','exit-return','basic-loop'];
const interesting=new Set(['mood-collapse','crisis-mood','salary-cut','salary-final','low-pay-tip','crisis-boss','paperwork','pip-review','pip-passed','patronage-application','education-review','education-scrutiny','dismissal-final']);
function remember(id,before,after,extra={}){
 if(routes.has(id)||after.actions.length>285)return;
 routes.set(id,{id,roleId:before.roleId,seed:before.seed,beforeEventId:event(before)?.id||null,
  afterEventId:after.completed?null:event(after)?.id||null,beforeActions:before.actions,actions:after.actions,...extra});
}
function score(run,mode=0){
 if(run.completed||run.pendingFamily||run.chapterContext)return -10000;
 const s=run.stats;
 let value=s.energy*1.3+s.mood*1.65+s.cash*.55+s.boss*.3;
 if(mode===1)value+=Math.min(82,s.lick)*5+Math.min(85,s.boss)*2;
 if(mode===2)value+=Math.max(0,45-s.boss)*4;
 if(mode===3)value-=s.mood*2.8;
 value+=Math.min(0,s.energy-22)*15+Math.min(0,s.cash-8)*12;
 if(mode!==3)value+=Math.min(0,s.mood-20)*12;
 return value;
}
function inspectTransition(before,index,after){
 const source=event(before),selected=source.choices[index];
 if(source.kind==='onboarding'&&gap(after))remember('onboarding-gap',before,after,{index});
 if(['daily','fantasy'].includes(source.kind)&&gap(after))remember('work-gap',before,after,{index});
 if(interesting.has(source.id))remember(source.id,before,after,{index});
 if(selected.effect==='startPip')remember('pip-start',before,after,{index});
 if(source.id==='kind-workday'&&gap(after))remember('kind-workday-return',before,after,{index});
}
function mealEvidence(menu,sourceGap){
 const open=available(menu).find(({choice})=>choice.effect==='mealOpen');if(!open)return;
 const guestMenu=choose(menu,open.index);
 for(const {choice,index}of available(guestMenu).filter(({choice})=>choice.mealTarget)){
  const invited=choose(guestMenu,index);
  if(event(invited)?.id?.startsWith('meal-with-')&&!routes.has('meal-paid')){
   const dinner=available(invited).find(({choice})=>choice.effect==='mealFinish');
   if(dinner){const after=choose(invited,dinner.index);if(gap(after))remember('meal-paid',sourceGap,after,{guest:choice.mealTarget});}
  }else if(event(invited)?.id?.startsWith('meal-guests-')&&!routes.has('meal-declined')){
   const cancel=available(invited).find(({choice})=>choice.effect==='mealCancel');
   if(!cancel)continue;const back=choose(invited,cancel.index),leave=available(back).find(({choice})=>choice.effect==='cancelBreak');
   if(leave){const after=choose(back,leave.index);if(gap(after))remember('meal-declined',sourceGap,after,{guest:choice.mealTarget});}
  }
 }
}
function restEvidence(source){
 if(['rest-paid','rest-cancel','meal-paid','meal-declined','kind-break-paid','basic-loop'].every(id=>routes.has(id)))return;
 if(!E.canRequestBreak(source))return;
 let menu=E.requestBreak(source);
 if(event(menu).id==='kind-break'){
  const paid=available(menu).find(({choice})=>choice.effect==='finishBreak');
  if(paid){const after=choose(menu,paid.index);if(gap(after))remember('kind-break-paid',source,after);}
  const decline=available(menu).find(({choice})=>choice.effect==='kindDecline');
  if(decline)menu=choose(menu,decline.index);
 }
 if(event(menu).id!=='self-care')return;
 for(const {choice,index}of available(menu)){
  if(!['finishBreak','cancelBreak'].includes(choice.effect))continue;
  const after=choose(menu,index);if(gap(after))remember(choice.effect==='cancelBreak'?'rest-cancel':'rest-paid',source,after,{purchaseIndex:index});
 }
 if(!routes.has('meal-paid')||!routes.has('meal-declined'))mealEvidence(menu,source);
 if(!routes.has('basic-loop')){
  const firstWork=choose(source,0);
  if(!['daily','fantasy'].includes(event(firstWork)?.kind))return;
  for(const {index}of available(firstWork)){
   const next=choose(firstWork,index);if(!gap(next)||!E.canRequestBreak(next))continue;
   let self=E.requestBreak(next);
   if(event(self).id==='kind-break')self=choose(self,available(self).find(({choice})=>choice.effect==='kindDecline').index);
   const paid=available(self).find(({choice})=>choice.effect==='finishBreak'&&choice.delta.cash<0);if(!paid)continue;
   const rested=choose(self,paid.index);if(!gap(rested))continue;
   const secondWork=choose(rested,0);if(['daily','fantasy'].includes(event(secondWork)?.kind)){
    remember('basic-loop',source,secondWork,{workChoice:index,firstGapActions:source.actions,secondGapActions:next.actions,restedActions:rested.actions});break;
   }
  }
 }
}
function inspect(run){
 if(run.pending||run.completed||run.actions.length>260)return;
 const shown=event(run),key=`${run.seed}:${run.actions.length}:${shown.id}`;
 if(seenStates.has(key))return;seenStates.add(key);
 if(gap(run)){
  restEvidence(run);
  if(!routes.has('exit-return')){
   const opened=E.requestExit(run);
   if(opened!==run){const cancel=available(opened).find(({choice})=>choice.effect==='return');if(cancel){const after=choose(opened,cancel.index);if(gap(after))remember('exit-return',run,after);}}
  }
  if(run.pip?.active&&!routes.has('pip-work-gap')){
   const started=choose(run,0),chosen=available(started)[0];
   if(chosen)remember('pip-work-gap',run,choose(started,chosen.index),{index:chosen.index});
  }
  if(run.pip?.active&&E.canRequestBreak(run)&&!routes.has('pip-rest')){
   let menu=E.requestBreak(run);
   if(event(menu).id==='kind-break')menu=choose(menu,available(menu).find(({choice})=>choice.effect==='kindDecline').index);
   const paid=available(menu).find(({choice})=>choice.effect==='finishBreak');
   if(paid){const after=choose(menu,paid.index);if(gap(after))remember('pip-rest',run,after);}
  }
  for(const [can,request,effect,id]of [[E.canRequestCareer,E.requestCareer,'careerDefer','career-return'],[E.canRequestRaise,E.requestRaise,'raiseCancel','raise-return']]){
   if(routes.has(id)||!can(run))continue;
   const opened=request(run),back=available(opened).find(({choice})=>choice.effect===effect);
   if(back){const after=choose(opened,back.index);if(gap(after))remember(id,run,after);}
  }
 }
 if(['daily','fantasy'].includes(shown.kind)&&shown.scope!=='private'&&E.canRequestRage(run)){
  if(!routes.has('rage-event-imagined')){
   const pending=E.requestRage(run),after=E.advance(pending);
   if(pending.rageContext?.mode==='imagined'&&!after.completed&&after.eventId===run.eventId&&!gap(after))remember('rage-event-imagined',run,after);
  }
  if(!routes.has('rage-result-imagined'))for(const {index}of available(run)){
   const chosen=E.applyChoice(run,index);if(!E.canRequestRage(chosen))continue;
   const raging=E.requestRage(chosen),after=E.advance(raging);
   if(raging.rageContext?.mode==='imagined'&&gap(after)){remember('rage-result-imagined',run,after,{index});break;}
  }
 }
 for(const {index}of available(run)){
  const after=choose(run,index);inspectTransition(run,index,after);
  if(shown.kind==='activity-invitation'&&!after.activityInvitationContext&&!after.activityContext&&!after.completed&&['daily','fantasy'].includes(event(after)?.kind))remember('activity-declined',run,after,{index});
  if(shown.kind==='activity'&&!after.activityContext&&!after.completed&&['daily','fantasy'].includes(event(after)?.kind))remember('activity-completed',run,after,{index});
 }
}
function finish(run,depth=12){
 if(run.completed)return run;if(depth<=0)return null;
 const leave=E.requestExit(run);
 if(leave!==run){const result=finish(leave,depth-1);if(result)return result;}
 if(!event(run))return null;
 for(const next of available(run).map(({index})=>choose(run,index)).sort((a,b)=>(b.completed?10000:score(b))-(a.completed?10000:score(a)))){
  const result=finish(next,depth-1);if(result)return result;
 }
 return null;
}
function life(role,attempt,mode){
 let run=E.enableActivitySchedule(E.createRun(role.id,`${prefix}${ROLES.indexOf(role).toString(36)}-${attempt.toString(36)}-${mode}`));
 for(let step=0;step<170&&!run.completed&&run.actions.length<275;step++){
  inspect(run);
  if(E.canRequestSalaryAdvice(run)){run=E.requestSalaryAdvice(run);continue;}
  if(E.canRequestActivityInvitation(run)){run=E.requestActivityInvitation(run);continue;}
  if(gap(run)){
   if(E.canRequestBreak(run)&&(run.stats.mood<35||run.stats.energy<30)&&run.stats.cash>=8&&mode!==3){
    run=E.requestBreak(run);continue;
   }
   run=choose(run,0);continue;
  }
  const options=available(run);
  if(!options.length)break;
  const force=options.find(({choice})=>choice.effect==='startPip')
   ||(run.eventId==='patronage-application'?options.find(({choice})=>choice.effect==='patronageReturn'):null)
   ||(run.eventId==='kind-workday'?options.find(({choice})=>choice.effect==='kindWorkDecline'):null);
  const ranked=options.map(({choice,index})=>({choice,index,next:choose(run,index)})).sort((a,b)=>score(b.next,mode)-score(a.next,mode));
  const picked=force?ranked.find(row=>row.index===force.index):ranked[0];
  inspectTransition(run,picked.index,picked.next);run=picked.next;
 }
}
if(typeof E.isWorkGapOpenV50!=='function')throw new Error('Wait for the work-gap engine API before generating witnesses');
const maxAttempts=Number(process.argv[2]||100);
for(let attempt=0;attempt<maxAttempts&&required.some(id=>!routes.has(id));attempt++){
 for(const role of ROLES)for(const mode of [0,1,2,3])life(role,attempt,mode);
 console.log(JSON.stringify({attempts:attempt+1,routes:routes.size,missing:required.filter(id=>!routes.has(id))}));
}
const missing=required.filter(id=>!routes.has(id));
if(missing.length)throw new Error(`Missing natural work-gap witnesses: ${missing.join(', ')}`);
const basic=routes.get('basic-loop'),ended=finish(E.replayRun(basic.roleId,basic.seed,basic.actions));
if(!ended)throw new Error('Basic loop has no completed canonical continuation');
basic.completionActions=ended.actions;basic.endingId=ended.endingId;
for(const route of routes.values())for(const actions of [route.beforeActions,route.actions,...(route.completionActions?[route.completionActions]:[])]){
 const replay=E.replayRun(route.roleId,route.seed,actions);if(!E.validRun(replay))throw new Error(`Invalid natural work-gap witness ${route.id}`);
}
writeFileSync(new URL('../tests/fixtures/work-gap-routes-v50.json',import.meta.url),JSON.stringify({method:'Natural createRun lives under the e39-cal46-kin49-g- marker. Canonical actions only; no injected stats, flags, events, gender, workday, history or RNG. Includes completed continuation for the basic work/rest loop.',required,routes:[...routes.values()]},null,2)+'\n');
console.log(JSON.stringify({routes:routes.size,missing,completed:basic.endingId}));
