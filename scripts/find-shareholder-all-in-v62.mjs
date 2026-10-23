import {writeFileSync} from 'node:fs';
import * as E from '../dist/engine.js';
import {shareholderWorkCountV62} from '../dist/shareholders-v58.js';
const prefix='e39-r62-n-',routes=new Map();
const snapshot=(id,run,extra={})=>({id,roleId:run.roleId,seed:run.seed,actions:structuredClone(run.actions),...extra});
const capture=(id,run,extra={})=>{if(!routes.has(id))routes.set(id,snapshot(id,run,extra));};
const score=run=>run.completed||run.chapterContext||run.pendingFamily?-1e7:Math.min(run.stats.mood,run.stats.energy)*10+run.stats.mood*2+run.stats.energy*2+run.stats.cash*2+Math.min(run.stats.boss,80)*.4+run.stats.trust*.3-(run.pip?.active?100:0);
const choose=(run,index)=>E.advance(E.applyChoice(run,index));
function nextStep(run){
 if(run.pending)return E.advance(run);
 const event=E.getEvent(run);
 if(event.id==='shareholder58-offer')return choose(run,4);
 if(event.id==='shareholder58-gate')return choose(run,1);
 if(event.id.startsWith('shareholder58-hearing-'))return E.advance(E.applyShareholderPlay(run,{mode:'yield',statement:0,evidence:null}));
 if(event.id==='shareholder58-finish')return choose(run,0);
 if(run.activityInvitationContext)return choose(run,1);
 if(E.isWorkGapOpenV50(run)){
  if(E.canRequestBreak(run)&&run.stats.cash>=8)return E.requestBreak(run);
  return E.applyChoice(run,0);
 }
 if(E.canRequestSalaryAdvice(run))return E.requestSalaryAdvice(run);
 if(E.canRequestActivityInvitation(run))return E.requestActivityInvitation(run);
 const options=event.choices.map((choice,index)=>({choice,index})).filter(({choice})=>choice.available!==false);
 if(event.id==='kind-break')return choose(run,options.find(row=>row.choice.effect==='kindDecline').index);
 if(event.id==='kind-workday')return choose(run,options.find(row=>row.choice.effect==='kindWorkDecline').index);
 const played=options.map(row=>({...row,after:choose(run,row.index)}));
 return played.sort((a,b)=>score(b.after)-score(a.after))[0]?.after||run;
}
const budget=Number(process.argv[2]||300);
for(let attempt=0;attempt<budget;attempt++){
 const roleId=['executive','finance','system','bd','design'][attempt%5];
 let run=E.enableActivitySchedule(E.createRun(roleId,prefix+attempt.toString(16).padStart(22,'0')));
 for(let step=0;step<220&&!run.completed&&run.actions.length<280;step++){
  const event=E.getEvent(run);
  if(event.id==='shareholder58-offer')capture('offer',run);
  if(run.shareholderLoan){
   if(!run.shareholderContext&&run.shareholderLoan.paid===0)capture('purchased',run,{work:shareholderWorkCountV62(run)});
   if(event.id==='shareholder58-gate')capture('meeting-door',run);
   if(event.id==='shareholder58-hearing-0')capture('meeting-hearing',run);
   if(event.id==='shareholder58-finish')capture('meeting-finished',run);
   if(run.shareholderLoan.paid>=12)capture('first-payment',run);
   if(run.shareholderLoan.paid>=24)capture('second-payment',run);
   if(run.shareholderLoan.remaining===0)capture('paid-off',run);
  }
  const next=nextStep(run);if(next===run)break;run=next;
 }
 if(run.completed&&run.shareholderLoan){capture('completed-with-loan',run);if(run.shareholderLoan.remaining===0)capture('completed-paid-off',run);}
 if(['offer','purchased','meeting-door','meeting-hearing','meeting-finished','first-payment','paid-off','completed-with-loan'].every(id=>routes.has(id)))break;
}
for(const route of routes.values()){const replay=E.replayRun(route.roleId,route.seed,route.actions);if(!E.validRun(replay))throw new Error(`Invalid canonical route ${route.id}`);}
const output={version:1,profile:62,routes:[...routes.values()]};
writeFileSync(new URL('../tests/fixtures/shareholder-all-in-v62.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({routes:[...routes.keys()],count:routes.size}));
