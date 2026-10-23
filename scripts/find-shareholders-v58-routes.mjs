import {writeFileSync} from 'node:fs';
import * as E from '../dist/engine.js';

// Public-action route discovery only. Lookahead finds reproducible witnesses;
// it never alters salary, stats, flags, ownership, dates, evidence or RNG.
const PREFIX='e39-cal46-kin49-g-e-s-m-h-';
const routes=new Map(),offers=[],gates=[];
const copy=value=>JSON.parse(JSON.stringify(value));
const witness=(id,run,extra={})=>({id,roleId:run.roleId,seed:run.seed,actions:copy(run.actions),...extra});
const capture=(id,run,extra={})=>{if(!routes.has(id))routes.set(id,witness(id,run,extra));};
const event=run=>E.getEvent(run);
const available=run=>event(run).choices.map((choice,index)=>({choice,index})).filter(({choice})=>choice.available!==false);
const choose=(run,index)=>E.advance(E.applyChoice(run,index));
const health=run=>run.completed||run.chapterContext||run.pendingFamily?-1e6:
  Math.min(run.stats.energy,run.stats.mood)*6+run.stats.energy+run.stats.mood+run.stats.cash*1.5+
  Math.min(run.stats.boss,70)*1.1+run.stats.trust*.3-(run.pip?.active?150:0);
function resilient(run){
 const options=available(run).map(row=>({...row,after:choose(run,row.index)}));
 if(event(run).id==='kind-break')return options.find(row=>row.choice.effect==='kindDecline')?.after;
 if(event(run).id==='kind-workday')return options.find(row=>row.choice.effect==='kindWorkDecline')?.after;
 if(event(run).id==='self-care')return options.filter(row=>row.choice.effect==='finishBreak').sort((a,b)=>health(b.after)-health(a.after))[0]?.after;
 return options.sort((a,b)=>health(b.after)-health(a.after))[0]?.after;
}
function hooks(run){
 if(E.canRequestSalaryAdvice(run))return E.requestSalaryAdvice(run);
 if(E.canRequestActivityInvitation(run))return E.requestActivityInvitation(run);
 return run;
}
function navigate(run,stop,limit=180){
 for(let step=0;step<limit&&!run.completed&&run.actions.length<270;step++){
  if(run.pending)run=E.advance(run);
  run=hooks(run);
  if(run.pip?.active)capture('guard-pip',run);
  if(run.activityInvitationContext){capture('guard-invitation',run);capture('guard-activity',choose(run,0));}
  if(run.eventId==='self-care')capture('guard-rest',run);
  if(stop(run))return run;
  if(run.shareholderContext)return run;
  if(run.activityInvitationContext){run=choose(run,1);continue;}
  if(E.isWorkGapOpenV50(run)){
   if(E.canRequestBreak(run)&&run.stats.cash>=8){run=E.requestBreak(run);continue;}
   run=E.applyChoice(run,0);continue;
  }
  const next=resilient(run);if(!next||next===run)return run;run=next;
 }
 return run;
}

// The challenge solutions below are public, fictional game documents. Tests
// retain the raw player selections rather than injecting a derived verdict.
const correct=[{press:0,statement:0,evidence:'investment'},{press:1,statement:0,evidence:'receivables'},{press:1,statement:1,evidence:'roster'},{press:2,statement:2,evidence:'minutes'}];
const present=round=>({mode:'present',statement:correct[round].statement,evidence:correct[round].evidence});
const maxAttempts=Math.max(1,Number(process.argv[2]||180));
for(let attempt=0;attempt<maxAttempts;attempt++){
 const roleId=['system','sales','design','finance','executive'][attempt%5];
 let run=E.enableActivitySchedule(E.createRun(roleId,PREFIX+attempt.toString(16).padStart(6,'0')));
 run=navigate(run,value=>value.eventId==='shareholder58-offer');
 if(run.eventId!=='shareholder58-offer')continue;
 capture('offer',run);offers.push(witness('offer',run));
  if(run.stats.cash<59)capture('offer-no-upsize',run);
 for(const {index}of available(run)){
  const after=choose(run,index);
  capture(`offer-choice-${index}`,after,{beforeActions:copy(run.actions),index});
  if(!after.flags.shareholder58_owned)continue;
  capture('stock-paid',after,{beforeActions:copy(run.actions),index});
  let gate=navigate(after,value=>value.eventId==='shareholder58-gate');
  if(gate.eventId!=='shareholder58-gate')continue;
  capture('gate',gate);gates.push(witness('gate',gate));
  for(const {index:gateIndex}of available(gate)){
   let hearing=choose(gate,gateIndex);
   capture(`gate-choice-${gateIndex}`,hearing,{beforeActions:copy(gate.actions),index:gateIndex});
   if(!E.getShareholderPlayV58(hearing))continue;
   capture('hearing',hearing,{beforeActions:copy(gate.actions),index:gateIndex});
   for(const policy of ['prepared','partial','yield','wrong']){
    let current=hearing;
    for(let step=0;step<8&&E.getShareholderPlayV58(current);step++){
     const play=E.getShareholderPlayV58(current);
     const round=play.round;
     capture(`round-${round}`,current);
     const solve=policy==='prepared'||policy==='partial'&&round<2;
     if(solve)current=E.advance(E.applyShareholderPlay(current,{mode:'press',statement:correct[round].press,evidence:null}));
     const input=policy==='yield'||policy==='partial'&&!solve?{mode:'yield',statement:0,evidence:null}:policy==='wrong'?{mode:'present',statement:0,evidence:'receipt'}:present(round);
     current=E.advance(E.applyShareholderPlay(current,input));
    }
    if(current.eventId==='shareholder58-finish'){
     capture(`finish-${policy}`,current);
     const ended=choose(current,0);
     capture(`returned-${policy}`,ended,{beforeActions:copy(current.actions),index:0});
     const exit=E.requestExit(ended);
     if(exit!==ended){const completed=choose(exit,0);if(completed.completed)capture(`completed-${policy}`,completed);}
    }
   }
  }
 }
 if((attempt+1)%10===0)console.log(JSON.stringify({attempts:attempt+1,routes:[...routes.keys()],offers:offers.length,gates:gates.length}));
 if(routes.has('returned-prepared')&&routes.has('returned-yield')&&routes.has('returned-wrong')&&offers.length>=12&&gates.length>=12)break;
}
for(let attempt=0;attempt<48&&!routes.has('guard-pip');attempt++){
 let run=E.enableActivitySchedule(E.createRun('system',PREFIX+(0x800000+attempt).toString(16)));
 for(let step=0;step<110&&!run.completed&&run.actions.length<250;step++){
  if(run.pending)run=E.advance(run);run=hooks(run);
  if(run.pip?.active){capture('guard-pip',run);break;}
  if(run.shareholderContext){run=choose(run,run.shareholderContext.stage==='offer'?2:0);continue;}
  if(run.activityInvitationContext){run=choose(run,1);continue;}
  if(E.isWorkGapOpenV50(run)){if(E.canRequestBreak(run)&&run.stats.cash>=8){run=E.requestBreak(run);continue;}run=E.applyChoice(run,0);continue;}
  if(run.turn>=3&&E.canRequestVerbal(run)){run=E.requestVerbal(run,undefined,2);continue;}
  const options=available(run),pip=options.find(({choice})=>choice.effect==='startPip'||/PIP|改善計畫/.test(choice.text));
  const next=pip?choose(run,pip.index):resilient(run);if(!next||next===run)break;run=next;
 }
}
for(const row of routes.values()){
 const run=E.replayRun(row.roleId,row.seed,row.actions);
 if(!E.validRun(run))throw Error(`Invalid shareholder witness: ${row.id}`);
}
if(!routes.has('returned-prepared'))throw Error('No complete natural shareholder challenge found');
const output={method:'Natural createRun lives under e39-cal46-kin49-g-e-s-m-h-. Canonical public actions only; search lookahead chooses alternatives to find witnesses. No injected stats, flags, ownership, dates, evidence, results or RNG.',routes:[...routes.values()],offers,gates};
writeFileSync(new URL('../tests/fixtures/shareholder-routes-v58.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({routes:routes.size,offers:offers.length,gates:gates.length}));
