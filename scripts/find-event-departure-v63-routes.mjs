import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {ROLES} from '../dist/roles.js';
import * as E from '../dist/engine.js';
import {eventDepartureCategoryV63} from '../dist/event-departure-v63.js';
import {directEntryV60} from '../dist/recruitment-v60.js';

// Reproducible discovery with public engine actions only. A bounded local
// search explores ordinary alternatives, never edits a life or its RNG.
const routes=new Map(),sources=new Map(),seen=new Set(),failures=[];
const required=['onboarding','work','gap','invitation','activity','treats','shareholder','recruitment','hidden','meal','rest','salary','personnel','collapse','verbal','rage','company','wealth','career','patronage'];
const event=run=>E.getEvent(run),choose=(run,index)=>E.advance(E.applyChoice(run,index));
const options=run=>(event(run)?.choices||[]).map((choice,index)=>({choice,index})).filter(row=>row.choice.available!==false);
const score=(run,mode=0)=>run.completed||run.chapterContext||run.pendingFamily?-1e6:run.stats.energy*1.5+run.stats.mood*(mode===3?-2.5:1.6)+run.stats.cash*(mode===2?1.7:.6)+run.stats.boss*(mode===1?-1.7:mode===4?1.4:.4)+run.stats.lick*(mode===4?2:0)+run.stats.trust*.3;
const play={arm:{kind:'arm',mode:'steady',taps:Array.from({length:8},(_,i)=>500+i*1000)},diet:{kind:'diet',days:Array.from({length:7},()=>({meal:0,exercise:0}))},roadshow:{kind:'roadshow',matches:[0,1,2,1,0,2]},dinner:{kind:'dinner',plates:[0,1,2,0,1,1]},banquet:{kind:'banquet',beats:Array.from({length:12},(_,i)=>500+i*600)},basketball:{kind:'basketball',moves:[0,2,1,2,0]},review:{kind:'review',evidence:[0,1,2,0]}};
function labels(run,category){
 const ev=event(run),list=[category];
 if(category==='activity')list.push(`activity-${run.activityContext.id}-${run.activityContext.stage}`);
 if(category==='invitation')list.push(`invitation-${run.activityInvitationContext.id}`);
 if(category==='treats')list.push(`treats-${run.treatsContext.id}-${run.treatsContext.stage}`);
 if(category==='shareholder')list.push(`shareholder-${run.shareholderContext.stage}`);
 if(category==='recruitment')list.push(`recruitment-${run.recruitmentContext.stage}`);
 if(category==='meal')list.push(run.mealContext.guest?`meal-${run.mealContext.guest}`:'meal-list');
 if(category==='personnel'||category==='salary'||category==='collapse'||category==='career'||category==='wealth')list.push(ev.id);
 if(category==='verbal')list.push(`verbal-${run.verbalContext.stage}`,`verbal-${run.verbalContext.phase}`);
 if(category==='rage')list.push(`rage-${run.rageContext.mode}`,`rage-${run.rageContext.phase}`);
 if(['rage','verbal'].includes(category)){
  const c=run[`${category}Context`],committed=run.history[c.historyLength-1];
  if(c.phase==='result'&&committed?.delta?.cash<0)list.push(`${category}-paid-result`);
  if(c.phase==='result'&&committed?.delta?.cash<0&&/^meal-with-/.test(c.eventId))list.push(`${category}-paid-meal-result`);
  if(c.phase==='result'&&c.eventId==='onboarding')list.push(`${category}-onboarding-result-${run.seed[8]}`);
 }
 if(category==='chapter')list.push(`chapter-${run.chapterContext.family}`);
 if(category==='work'&&run.pip?.active)list.push('work-pip');
 if(category==='work'&&run.shareholderLoan?.remaining>0)list.push('work-loan');
 if(category==='gap'&&run.lastBreakTurn===run.turn)list.push('gap-after-rest');
 return [...new Set(list)];
}
function capture(run){
 if(!E.getEventDepartureV63(run)?.available)return;
 const category=eventDepartureCategoryV63(run,event(run)),wanted=labels(run,category).filter(id=>!routes.has(id));if(!wanted.length)return;
 try{
  const pending=E.requestEventDepartureV63(run),after=E.advance(pending);
  if(!E.validRun(run)||!E.validRun(pending)||!E.validRun(after))throw Error('Noncanonical departure state');
  for(const id of wanted)routes.set(id,{id,category,roleId:run.roleId,seed:run.seed,beforeActions:run.actions,actions:after.actions});
  if(!sources.has(category))sources.set(category,run);
 }catch(error){failures.push({category,eventId:event(run)?.id,message:error.message,roleId:run.roleId,seed:run.seed,actions:run.actions});}
}
function explore(run,depth=0){
 if(!run||run.completed||run.pending||run.actions.length>275)return;
 const key=`${run.seed}:${JSON.stringify(run.actions)}`;if(seen.has(key))return;seen.add(key);capture(run);
 if(run.mealContext?.guest&&(!routes.has('rage-paid-meal-result')||!routes.has('verbal-paid-meal-result')))for(const {index}of options(run).filter(row=>[0,1].includes(row.index))){
  const paid=E.applyChoice(run,index);if(!paid.pending||paid.stats.cash>=run.stats.cash)continue;
  for(const invoke of [E.requestRage,E.requestVerbal])try{const opened=invoke===E.requestVerbal?invoke(paid,undefined,2):invoke(paid);if(opened!==paid)explore(opened.pending?E.advance(opened):opened,3);}catch{}
 }
 const kind=event(run)?.kind;
 if(depth>=5||depth>=3&&!['self-care','verbal','rage-world'].includes(kind))return;
 if(E.getActivityPlayV55(run)){explore(E.advance(E.applyActivityPlay(run,play[run.activityContext.id])),depth+1);return;}
 if(!['daily','fantasy'].includes(kind))for(const {index}of options(run)){
  const pending=E.applyChoice(run,index);explore(E.advance(pending),depth+1);
  if(kind==='self-care'&&pending.pending&&!pending.pendingFamily&&pending.stats.cash<run.stats.cash)for(const invoke of [E.requestRage,E.requestVerbal])try{
   const opened=invoke===E.requestVerbal?invoke(pending,undefined,2):invoke(pending);if(opened!==pending)explore(opened.pending?E.advance(opened):opened,2);
  }catch{}
 }
 for(const [can,request]of [[E.canRequestBreak,E.requestBreak],[E.canRequestSalaryAdvice,E.requestSalaryAdvice],[E.canRequestHiddenEncounter,E.requestHiddenEncounter],[E.canRequestActivityInvitation,E.requestActivityInvitation],[E.canRequestCareer,E.requestCareer],[E.canRequestRaise,E.requestRaise]])if(typeof can==='function'&&can(run))explore(request(run),depth+1);
 if(['daily','fantasy','onboarding'].includes(kind)){
  for(const invoke of [E.requestExit,E.requestRage,E.requestVerbal]){
   try{const opened=invoke===E.requestVerbal?invoke(run,undefined,2):invoke(run);if(opened!==run)explore(opened.pending?E.advance(opened):opened,depth+(invoke===E.requestExit?0:1));}catch{}
  }
 }
}
const known=JSON.parse(readFileSync(new URL('../tests/fixtures/roadshow-v63.json',import.meta.url),'utf8')).routes;
for(const row of JSON.parse(readFileSync(new URL('../tests/fixtures/event-departure-sources-v63.json',import.meta.url),'utf8')).routes)explore(E.replayRun(row.roleId,row.seed,row.actions),0);
for(const row of known){
 for(const length of [...new Set([1,...row.actions.map((_,i)=>i+1)])]){
  const run=E.replayRun(row.roleId,row.seed,row.actions.slice(0,length));explore(run,2);
 }
}
for(const marker of ['s','d']){
 const seed=`e39-r63-${marker}-${'0'.repeat(22)}`;
 let run=E.enableActivitySchedule(E.createRun(directEntryV60(seed).roleId,seed));
 const accepted=E.applyChoice(run,0);
 for(const invoke of [E.requestRage,E.requestVerbal])try{const opened=invoke===E.requestVerbal?invoke(accepted,undefined,2):invoke(accepted);if(opened!==accepted)explore(opened.pending?E.advance(opened):opened,0);}catch{}
 for(let step=0;step<4&&!run.completed;step++){explore(run,0);const picks=options(run);if(!picks.length)break;run=choose(run,0);}
}
const maximum=Number(process.argv[2]||35);
for(let attempt=0;attempt<maximum;attempt++){
 for(const mode of [0,1,2,3,4]){
  const seed='e39-r63-n-'+createHash('sha256').update(`event-departure-${attempt}-${mode}`).digest('hex').slice(0,22);let run=E.enableActivitySchedule(E.createRun(ROLES[attempt%ROLES.length].id,seed));
  for(let step=0;step<180&&!run.completed&&run.actions.length<270;step++){
   explore(run,mode===2?1:2);
   if(E.canRequestSalaryAdvice(run)){run=E.requestSalaryAdvice(run);continue;}
   if(E.canRequestActivityInvitation(run)){run=E.requestActivityInvitation(run);continue;}
   if(E.canRequestHiddenEncounter(run)){run=E.requestHiddenEncounter(run);continue;}
   if(E.isWorkGapOpenV50(run)){
    if(E.canRequestBreak(run)&&run.stats.cash>=8&&![2,3].includes(mode)){run=E.requestBreak(run);continue;}run=E.applyChoice(run,0);continue;
   }
   if(E.getActivityPlayV55(run)){run=E.advance(E.applyActivityPlay(run,play[run.activityContext.id]));continue;}
   const choices=options(run).map(row=>{const pending=E.applyChoice(run,row.index);return {...row,pending,after:E.advance(pending)};});if(!choices.length)break;
   for(const row of choices)capture(row.after);
   if(['daily','fantasy','self-care'].includes(event(run)?.kind))for(const row of choices)if(row.pending.pending&&!row.pending.pendingFamily){
    for(const invoke of [E.requestRage,E.requestVerbal])try{const opened=invoke===E.requestVerbal?invoke(row.pending,undefined,2):invoke(row.pending);if(opened!==row.pending)explore(opened.pending?E.advance(opened):opened,2);}catch{}
   }
   let picked;
   if(run.activityInvitationContext)picked=choices.find(row=>row.index===0);
   if(run.shareholderContext?.stage==='offer')picked=choices.find(row=>row.index===(mode===2?1:2));
   if(run.shareholderContext?.stage==='gate')picked=choices.find(row=>row.index===1);
   if(event(run).id==='kind-break')picked=choices.find(row=>row.choice.effect==='kindDecline');
   if(event(run).id==='kind-workday')picked=choices.find(row=>row.choice.effect==='kindWorkDecline');
   if(event(run).id==='self-care')picked=choices.filter(row=>row.choice.effect==='finishBreak').sort((a,b)=>score(b.after,mode)-score(a.after,mode))[0];
   if(!picked)picked=choices.find(row=>row.choice.effect==='startPip')||choices.find(row=>['finishPip','companyMarket','wealthReturn'].includes(row.choice.effect));
   run=(picked||choices.sort((a,b)=>score(b.after,mode)-score(a.after,mode))[0]).after;
  }
 }
 if((attempt+1)%5===0)console.log(JSON.stringify({attempts:attempt+1,routes:routes.size,missing:required.filter(id=>!routes.has(id)),failures:failures.length}));
 if(required.every(id=>routes.has(id))&&routes.has('work-pip')&&routes.has('shareholder-hearing'))break;
}
const continuations=[];
for(const row of [...routes.values()].filter(row=>/^treats-[a-z-]+-0$/.test(row.id))){
 let run=E.replayRun(row.roleId,row.seed,row.actions),abortedStory=E.replayRun(row.roleId,row.seed,row.beforeActions).treatsContext.id,completedStory=null;
 for(let step=0;step<180&&!run.completed&&run.actions.length<280;step++){
  if(run.treatsContext&&run.treatsContext.id!==abortedStory){completedStory=run.treatsContext.id;run=choose(run,0);if(!run.treatsContext){continuations.push({id:'treat-after-abort',roleId:row.roleId,seed:row.seed,beforeActions:row.actions,actions:run.actions,abortedStory,completedStory});break;}continue;}
  if(E.canRequestSalaryAdvice(run)){run=E.requestSalaryAdvice(run);continue;}
  if(E.canRequestActivityInvitation(run)){run=choose(E.requestActivityInvitation(run),1);continue;}
  if(E.isWorkGapOpenV50(run)){if(E.canRequestBreak(run)&&run.stats.cash>=8){run=E.requestBreak(run);continue;}run=E.applyChoice(run,0);continue;}
  if(E.getActivityPlayV55(run)){run=E.advance(E.applyActivityPlay(run,play[run.activityContext.id]));continue;}
  const choices=options(run).map(option=>({...option,after:choose(run,option.index)}));if(!choices.length)break;
  let picked;if(run.shareholderContext?.stage==='offer')picked=choices.find(option=>option.index===2);
  if(event(run).id==='kind-break')picked=choices.find(option=>option.choice.effect==='kindDecline');
  if(event(run).id==='kind-workday')picked=choices.find(option=>option.choice.effect==='kindWorkDecline');
  if(event(run).id==='self-care')picked=choices.filter(option=>option.choice.effect==='finishBreak').sort((a,b)=>score(b.after)-score(a.after))[0];
  run=(picked||choices.sort((a,b)=>score(b.after)-score(a.after))[0]).after;
 }
 if(continuations.length)break;
}
for(const row of continuations)if(!E.validRun(E.replayRun(row.roleId,row.seed,row.actions)))throw Error('Noncanonical continuation');
writeFileSync(new URL('../tests/fixtures/event-departure-v63.json',import.meta.url),JSON.stringify({method:'Natural r63 createRun lives and bounded public-action lookahead. No injected resources, calendar, contexts, history or RNG. Each route records its before-actions and one exact event-departure action.',required,routes:[...routes.values()],continuations},null,2)+'\n');
if(failures.length)writeFileSync(new URL('../artifacts/event-departure-failures-v63.json',import.meta.url),JSON.stringify(failures,null,2)+'\n');
console.log(JSON.stringify({routes:routes.size,missing:required.filter(id=>!routes.has(id)),failures:failures.length,continuations:continuations.length}));
