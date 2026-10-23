import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import * as E from '../dist/engine.js';
import {ROLES,RANDOM_BASE_ROLE_IDS_V60} from '../dist/roles.js';
import {directEntryV60} from '../dist/recruitment-v60.js';
import {patronageEligibleV49} from '../dist/patronage-v49.js';

export const AUDIT_METHOD_V67='Goal-directed legal play from createRun, with the same calendar and catch-up hooks as the app. Seed selection observes generated gender/profession, never changes them. Choice previews guide the test driver; these are reachability and paired-policy balance checks, not estimates of uninformed players’ probabilities. No stat, RNG, event, appointment, flag or history injection.';
export const auditSeedV67=(role,kind,attempt,profile=67)=>`e39-r${profile}-${{normal:'n',son:'s',daughter:'d'}[kind]}-`+createHash('sha256').update(`patronage-audit:${role}:${kind}:${attempt}`).digest('hex').slice(0,22);
export function advanceAuditV67(run){
 const navigation=['mealOpen','mealPage','mealCancel'].includes(run.pendingEffect)&&!run.pendingFamily;
 const skip=run.treatsContext||run.departureContext||run.blockchainContext||navigation;
 let next=E.advance(run);
 if(!skip&&!next.completed){
  next=E.requestSalaryAdvice(next);next=E.enableActivitySchedule(next);
  if(E.canRequestActivityInvitation(next))next=E.requestActivityInvitation(next);
  next=E.requestHiddenEncounter(next);
 }
 return next;
}
export const chooseAuditV67=(run,index)=>advanceAuditV67(E.applyChoice(run,index));
const basicScore=run=>{
 const s=run.stats;
 return (run.completed?-100000:0)+s.mood*1.8+s.energy*1.6+s.cash*.8+s.boss*.7+s.trust*.2
  +Math.min(0,s.mood-30)*6+Math.min(0,s.energy-25)*6+Math.min(0,s.cash-12)*6;
};
const applicationScore=run=>{
 const s=run.stats;
 return basicScore(run)+Math.min(s.lick,82)*5+Math.min(s.boss,85)*4;
};
const unwantedExit=new Set(['ragequit','escape','burnout','broke','careerExit','legacyCareer','storyCareer','chapterExit','exitVoluntary','verbalResign','wealthPlan','wealthStart','wealthRetire','wealthBack','wealthReturn']);
const availableChoices=event=>event.choices.map((choice,index)=>({choice,index})).filter(({choice})=>choice.available!==false);

export function startAuditV67({roleId,kind='normal',attempt=0,profile=67}){
 const seed=auditSeedV67(roleId,kind,attempt,profile),entry=directEntryV60(seed);
 if(kind!=='normal'&&entry?.roleId!==roleId)return null;
 return E.enableActivitySchedule(E.createRun(roleId,seed));
}

// The only optional controls used here are actually available in the UI.
// Trying an unavailable control never becomes part of a stored route.
export function auditStepV67(run,{seekAppointment=false,useAuthority=false,authorityTarget=null}={}){
 if(run.pending)return advanceAuditV67(run);
 if(run.completed)return run;
 const event=E.getEvent(run),score=seekAppointment&&!run.patronage?applicationScore:basicScore;
 if(useAuthority&&run.patronage&&E.canRequestPatronageReply(run)){
  const targets=E.getPatronageReplyTargets(run),target=authorityTarget&&targets.includes(authorityTarget)?authorityTarget:targets.find(id=>!['wing','spencer'].includes(id))||targets[0];
  if(target)return advanceAuditV67(E.requestPatronageReply(run,target));
 }
 if(run.activityInvitationContext)return chooseAuditV67(run,1);
 if(E.getShareholderPlayV58(run))return advanceAuditV67(E.applyShareholderPlay(run,{mode:'yield',statement:0,evidence:null}));
 if(E.getActivityPlayV55(run)&&E.getEventDepartureV63(run)?.available)return advanceAuditV67(E.requestEventDepartureV63(run));
 if(run.shareholderContext?.stage==='offer')return chooseAuditV67(run,2);
 if(event.id==='wealth-plan')return chooseAuditV67(run,event.choices.findIndex(choice=>choice.effect==='wealthReturn'));
 if(['wealth-startup','wealth-retire'].includes(event.id))return chooseAuditV67(run,event.choices.findIndex(choice=>choice.effect==='wealthBack'));
 if(event.id==='finale')return chooseAuditV67(run,event.choices.findIndex(choice=>choice.effect==='careerExit'));
 if(event.id==='rank-exit')return chooseAuditV67(run,event.choices.findIndex(choice=>choice.available!==false&&(/^career_/.test(choice.effect)||choice.effect==='ragequit')));
 if(event.id==='chapter-resolution')return chooseAuditV67(run,event.choices.findIndex(choice=>choice.effect==='chapterExit'));
 if(event.id==='onboarding'||run.recruitmentContext)return chooseAuditV67(run,0);
 if(event.id==='patronage-application')return chooseAuditV67(run,0);
 if(seekAppointment&&!run.patronage&&patronageEligibleV49(run)&&E.canRequestCareer(run)){
  const review=E.requestCareer(run),index=E.getEvent(review).choices.findIndex(choice=>choice.available!==false&&choice.effect==='patronageApply');
  if(index>=0)return chooseAuditV67(review,index);
 }
 if(E.canRequestBreak(run)&&(run.stats.mood<=30||run.stats.energy<=30)&&run.stats.cash>8){
  const menu=E.requestBreak(run);
  if(menu!==run){
   if(menu.eventId==='kind-break')return chooseAuditV67(menu,E.getEvent(menu).choices.findIndex(choice=>choice.effect==='kindDecline'));
   if(menu.eventId==='self-care'){
    const options=availableChoices(E.getEvent(menu)).filter(({choice})=>choice.effect==='finishBreak')
     .map(({index})=>({index,next:chooseAuditV67(menu,index)})).sort((a,b)=>score(b.next)-score(a.next));
    if(options[0])return options[0].next;
   }
  }
 }
 const picks=availableChoices(event).map(({choice,index})=>({choice,index,next:chooseAuditV67(run,index)}));
 const preferred=picks.filter(({choice,next})=>!unwantedExit.has(choice.effect)&&!next.completed&&!next.pendingFamily);
 const candidates=preferred.length?preferred:picks;
 candidates.sort((a,b)=>score(b.next)-score(a.next)||a.index-b.index);
 if(!candidates.length)throw new Error(`No legal continuation ${run.seed}/${event.id}`);
 return candidates[0].next;
}

export function simulatePatronageV67({roleId,kind='normal',attempt=0,profile=67,gender=null,seekAppointment=true,useAuthority=false,maxSteps=220}={}){
 let run=startAuditV67({roleId,kind,attempt,profile});
 if(!run||gender&&run.characterGender!==gender)return null;
 let appointedAt=null;
 const observations=[];
 for(let step=0;step<maxSteps&&!run.completed&&run.actions.length<290;step++){
  const before=run,event=E.getEvent(run);
  run=auditStepV67(run,{seekAppointment,useAuthority});
  if(!appointedAt&&run.patronage)appointedAt={actions:run.actions.length,history:run.history.length,turn:run.turn,fromPay:run.patronage.fromPay,pay:run.pay};
  observations.push({eventId:event.id,kind:event.kind,pay:run.pay,cash:run.stats.cash,mood:run.stats.mood,energy:run.stats.energy,turn:run.turn,appointed:!!run.patronage,pip:!!run.pip?.active,addedRows:run.history.length-before.history.length});
  if(run===before)throw new Error(`Stalled audit ${run.seed}/${event.id}`);
 }
 const replay=E.replayRun(roleId,run.seed,run.actions);
 if(!E.validRun(run)||JSON.stringify(replay)!==JSON.stringify(run))throw new Error(`Noncanonical audit ${run.seed}`);
 const post=appointedAt?run.history.slice(appointedAt.history):[];
 return {roleId,seed:run.seed,kind,gender:run.characterGender,attempt,actions:run.actions,sha256:createHash('sha256').update(JSON.stringify(run)).digest('hex'),appointedAt,completed:run.completed,endingId:run.endingId,turn:run.turn,pay:run.pay,cash:run.stats.cash,mood:run.stats.mood,energy:run.stats.energy,work:run.history.filter(row=>['daily','fantasy'].includes(row.kind)).length,
  afterAppointmentWork:post.filter(row=>['daily','fantasy'].includes(row.kind)).length,
  postAppointmentOrdinaryEducation:post.filter(row=>['education-review','education-scrutiny','salary-cut','salary-final'].includes(row.eventId)).map(row=>row.eventId),
  afterAppointmentPip:post.filter(row=>row.eventId==='pip-review').length,
  cashFailure:run.endingId?.startsWith('broke-')||false,observations};
}

function summarise(rows){
 const defined=rows.filter(Boolean),appointed=defined.filter(row=>row.appointedAt),avg=key=>defined.length?Math.round(defined.reduce((n,row)=>n+row[key],0)/defined.length*100)/100:null;
 return {lives:defined.length,appointed:appointed.length,completed:defined.filter(row=>row.completed).length,cashFailures:defined.filter(row=>row.cashFailure).length,averageWork:avg('work'),averageFinalCash:avg('cash'),averageFinalPay:avg('pay'),ordinaryReviewsAfterAppointment:appointed.reduce((n,row)=>n+row.postAppointmentOrdinaryEducation.length,0),byRole:Object.fromEntries(ROLES.map(role=>[role.id,{lives:defined.filter(row=>row.roleId===role.id).length,appointments:appointed.filter(row=>row.roleId===role.id).length}]))};
}
export function auditPatronageV67({profile=67,samples=6,attemptCap=500,includeNormal=true,useAuthority=false,onProgress=()=>{}}={}){
 const rows=[],coverage=new Map();
 for(const kind of [...(includeNormal?['normal']:[]),'son','daughter'])for(const role of ROLES){
  if(kind!=='normal'&&!RANDOM_BASE_ROLE_IDS_V60.includes(role.id))continue;
  for(const gender of kind==='normal'?['male','female']:[kind==='son'?'male':'female']){
   let found=0;
   for(let attempt=0;attempt<attemptCap&&found<samples;attempt++){
    const raw=startAuditV67({roleId:role.id,kind,attempt,profile});if(!raw||raw.characterGender!==gender)continue;
    const row=simulatePatronageV67({roleId:role.id,kind,attempt,profile,gender,useAuthority});
    rows.push(row);found++;
    if(row.appointedAt&&!coverage.has(`${kind}:${role.id}:${gender}`))coverage.set(`${kind}:${role.id}:${gender}`,row);
   }
   if(found!==samples)throw new Error(`Insufficient legal seeds ${profile}/${kind}/${role.id}/${gender}: ${found}/${samples}`);
   onProgress({profile,kind,roleId:role.id,gender,samples:found,appointments:rows.filter(row=>row.kind===kind&&row.roleId===role.id&&row.gender===gender&&row.appointedAt).length});
  }
 }
 return {method:AUDIT_METHOD_V67,profile,samples,useAuthority,summary:summarise(rows),byKind:Object.fromEntries(['normal','son','daughter'].map(kind=>[kind,summarise(rows.filter(row=>row.kind===kind))])),coverage:[...coverage.keys()],routes:rows};
}

const compactRoute=row=>({roleId:row.roleId,seed:row.seed,kind:row.kind,gender:row.gender,actions:row.actions});
export function patronageFixtureV67(report,baseline){
 if(report.profile!==67||report.routes.some(row=>!row.completed))throw new Error('The current lifecycle audit must contain completed r67 lives');
 const byCell=new Map(),applications=new Map(),scenes=new Map();
 for(const row of report.routes){
  const cell=`${row.kind}:${row.roleId}:${row.gender}`,before=byCell.get(cell);
  if(!before||row.afterAppointmentWork>before.afterAppointmentWork)byCell.set(cell,row);
  for(const [at,action]of row.actions.entries()){
   if(action.type!=='choice')continue;
   if(action.eventId==='patronage-application'){
    const beforeActions=row.actions.slice(0,at),run=E.replayRun(row.roleId,row.seed,beforeActions);
    for(const index of [0,1,2]){
     const pending=E.applyChoice(run,index),result=index===2?'cancel':pending.history.at(-1).chanceOutcome;
     const id=`${row.gender}:${index}:${result}`;
     if(!applications.has(id))applications.set(id,{id,roleId:row.roleId,seed:row.seed,beforeActions,index,result});
    }
   }
   if(/^patronage67-/.test(action.eventId)&&!scenes.has(action.eventId))scenes.set(action.eventId,{roleId:row.roleId,seed:row.seed,beforeActions:row.actions.slice(0,at),eventId:action.eventId});
  }
 }
 if(byCell.size!==50)throw new Error(`Missing normal or direct-entry role/gender coverage: ${byCell.size}/50`);
 for(const gender of ['male','female'])for(const [index,result]of [[0,'success'],[0,'setback'],[1,'success'],[1,'setback'],[2,'cancel']])if(!applications.has(`${gender}:${index}:${result}`))throw new Error(`Missing natural application branch ${gender}/${index}/${result}`);
 for(const id of ['patronage67-education','patronage67-pay-review','patronage67-smalltalk'])if(!scenes.has(id))throw new Error(`Missing natural replacement ${id}`);
 const oldExamples=baseline?['normal','son','daughter'].map(kind=>baseline.routes.find(row=>row.kind===kind&&row.completed)).map(row=>{
  if(!/^[0-9a-f]{64}$/.test(row.sha256||''))throw new Error(`Missing pre-change frozen hash ${kind}`);
  return {...compactRoute(row),sha256:row.sha256};
 }):[];
 return {method:AUDIT_METHOD_V67,profile:67,baselineSummary:baseline?.summary||null,summary:report.summary,routes:[...byCell.values()].map(compactRoute),applications:[...applications.values()],scenes:[...scenes.values()],oldExamples};
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
 const arg=(name,fallback)=>process.argv.find(value=>value.startsWith(`--${name}=`))?.slice(name.length+3)||fallback;
 const output=arg('output','artifacts/patronage-v67-audit.json'),profile=Number(arg('profile','67')),samples=Number(arg('samples','6'));
 const report=auditPatronageV67({profile,samples,attemptCap:Number(arg('attempt-cap','500')),useAuthority:process.argv.includes('--authority'),includeNormal:!process.argv.includes('--direct-only'),onProgress:row=>console.log(JSON.stringify(row))});
 mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2)+'\n');
 const fixture=arg('fixture',null);
 if(fixture){
  const baselinePath=arg('baseline',null),baseline=baselinePath?JSON.parse(readFileSync(baselinePath,'utf8')):null;
  mkdirSync(dirname(fixture),{recursive:true});writeFileSync(fixture,JSON.stringify(patronageFixtureV67(report,baseline),null,2)+'\n');
 }
 console.log(JSON.stringify({output,...report.summary}));
}
