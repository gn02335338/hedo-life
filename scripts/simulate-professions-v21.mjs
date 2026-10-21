import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {ROLES as ALL_ROLES} from '../dist/roles.js';
import {EVENTS} from '../dist/events.js';
import {createRun,getEvent,applyChoice,advance,canRequestBreak,requestBreak,canRequestCareer,requestCareer,replayRun,validRun} from '../dist/engine.js';
const ROLES=ALL_ROLES.filter(role=>(role.minRules||1)<=21);

// Decisions use the visible event/choice text and current meters only. Outcome
// inspection is reserved for reporting after a choice has been committed.
const count=Number(process.argv[2]||100);
assert.ok(Number.isInteger(count)&&count>=1&&count<=1000);
const byId=new Map(EVENTS.map(event=>[event.id,event]));
const witnesses=new Map(),totals=[];
function pick(event,stats,policy,turn){
 const choices=event.choices.filter(choice=>choice.available),has=i=>choices.some(choice=>choice.index===i);
 const named=pattern=>choices.find(choice=>pattern.test(choice.text))?.index;
 if(event.id==='onboarding')return 0;
 if(event.id==='self-care')return named(stats.energy<32?/補.*覺|補眠|安靜的房間/:/喜歡的飲料/)??named(/先把錢留著/)??choices[0].index;
 if(event.id==='kind-break'||event.id==='kind-workday')return named(/太髒|不參加|不跟|拒絕/)??1;
 if(event.id==='mood-collapse')return has(0)?0:1;
 if(event.id==='crisis-mood')return has(1)?1:2;
 if(event.id==='education-scrutiny')return policy==='politics'?1:0;
 if(event.id==='education-review')return policy==='politics'?2:0;
 if(event.id==='salary-cut')return 0;
 if(event.id==='salary-final')return 0;
 if(event.id==='crisis-boss')return has(2)?2:0;
 if(event.id==='paperwork')return has(2)?2:1;
 if(event.id==='pip-review')return stats.skill>=stats.lick?0:1;
 if(event.id==='pip-passed')return 1;
 if(event.id==='floor-notice')return 0;
 if(event.id==='watch-review'||event.id==='watch-future')return 0;
 if(event.id==='dismissal-final')return 0;
 if(event.id==='career-review')return policy==='politics'&&has(1)?1:has(0)?0:has(2)?2:choices[0].index;
 if(event.id==='rank-exit')return choices[0].index;
 if(event.id==='final-shortfall')return 0;
 if(event.kind==='daily')return policy==='work'?choices[0].index:policy==='politics'?(has(1)?1:choices[0].index):choices[turn%choices.length].index;
 return choices[0].index;
}
for(const cohort of ['e20','e21'])for(const role of ROLES)for(const policy of ['work','politics','mixed']){
 const row={cohort,roleId:role.id,policy,runs:count,completed:0,workScenes:0,exclusive:0,related:0,shared:0,newScenes:0,firstExclusive:0,longestSharedStreak:0,repeats:0,pipRuns:0,pipEntries:0,maxPip:0,salaryCuts:0,directDismissals:0,burnouts:0,chiefs:0,days:0};
 for(let attempt=0;attempt<count;attempt++){
  let run=createRun(role.id,`${cohort}-jobs-${role.id}-${attempt}`),streak=0,first=true,seen=new Set(),hasNewOwn=false;
  for(let step=0;step<180&&!run.completed;step++){
   if(canRequestBreak(run)&&run.stats.cash>=12&&(run.stats.energy<32||run.stats.mood<38))run=requestBreak(run);
   else if(canRequestCareer(run)&&run.stats.energy>30&&run.stats.mood>35)run=requestCareer(run);
   const full=getEvent(run),event={id:full.id,kind:full.kind,title:full.title,body:full.body,choices:full.choices.map((choice,index)=>({index,text:choice.text,available:choice.available!==false}))};
   const authored=byId.get(event.id);
   if(event.kind==='daily'&&authored){
    row.workScenes++;const exclusive=authored.roles?.length===1&&authored.roles[0]===run.actualRoleId;
    if(first){row.firstExclusive+=Number(exclusive);first=false;}
    if(exclusive)row.exclusive++;else if(authored.roles)row.related++;else row.shared++;
    streak=authored.roles?0:streak+1;row.longestSharedStreak=Math.max(streak,row.longestSharedStreak);
    row.repeats+=Number(seen.has(event.id));seen.add(event.id);
    if(authored.minRules===21){row.newScenes++;if(run.actualRoleId===role.id)hasNewOwn=true;}
   }
   const index=pick(event,{...run.stats},policy,run.turn);
   assert.ok(event.choices.some(choice=>choice.index===index&&choice.available),`${event.id}/${index}`);
   run=advance(applyChoice(run,index));
   assert.equal(validRun(run),true,`${run.seed}/${event.id}`);
  }
  assert.equal(run.completed,true,run.seed);
  if(attempt===0||hasNewOwn&&!witnesses.has(role.id))assert.deepEqual(replayRun(role.id,run.seed,run.actions),run);
  if(cohort==='e21'&&hasNewOwn&&!witnesses.has(role.id))witnesses.set(role.id,{roleId:role.id,seed:run.seed,actions:run.actions,ending:run.endingId});
  row.completed++;row.pipRuns+=Number(run.pipCount>0);row.pipEntries+=run.pipCount;row.maxPip=Math.max(row.maxPip,run.pipCount);
  row.salaryCuts+=Number(run.salaryCut?.status==='accepted');row.directDismissals+=Number(run.history.some(item=>item.eventId==='dismissal-final'));
  row.burnouts+=Number(run.endingId.startsWith('burnout-'));row.chiefs+=Number((run.flags.career_peak_rank||0)===7);row.days+=run.turn+1;
 }
 totals.push(row);
}
assert.equal(witnesses.size,ROLES.length,'each original profession has a natural new work scene and valid completion');
for(const row of totals.filter(row=>row.cohort==='e21')){
 assert.ok(row.maxPip<=2);assert.ok(row.longestSharedStreak<=2);assert.equal(row.repeats,0);assert.ok((row.exclusive+row.related)/row.workScenes>.5,`${row.roleId}/${row.policy} profession frequency`);
}
mkdirSync('artifacts/jobs-v21',{recursive:true});
writeFileSync('artifacts/jobs-v21/simulation.json',JSON.stringify({method:'Visible choices and resource meters only; no outcome or RNG peeking before commitment.',count,totals},null,2)+'\n');
writeFileSync('artifacts/jobs-v21/api-witnesses.json',JSON.stringify({method:'Natural createRun and ordinary engine actions only; no injected state.',routes:[...witnesses.values()]},null,2)+'\n');
for(const cohort of ['e20','e21']){
 const rows=totals.filter(row=>row.cohort===cohort),sum=key=>rows.reduce((total,row)=>total+row[key],0);
 console.log(JSON.stringify({cohort,runs:sum('runs'),completed:sum('completed'),workScenes:sum('workScenes'),jobShare:(sum('exclusive')+sum('related'))/sum('workScenes'),exclusiveShare:sum('exclusive')/sum('workScenes'),newScenes:sum('newScenes'),pipRuns:sum('pipRuns'),salaryCuts:sum('salaryCuts'),directDismissals:sum('directDismissals'),chiefs:sum('chiefs'),longestSharedStreak:Math.max(...rows.map(row=>row.longestSharedStreak)),repeats:sum('repeats')}));
}
