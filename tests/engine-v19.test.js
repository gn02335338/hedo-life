import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ROLES} from '../dist/roles.js';
import {careerLevels} from '../dist/career-api.js';
import {workCount,raisePayCeiling} from '../dist/salary-raise-v19.js';
import {createRun,getEvent,applyChoice,advance,requestExit,requestBreak,requestCareer,requestRaise,canRequestRaise,raiseAvailability,requestRage,canRequestRage,validRun,replayRun,STAT_KEYS} from '../dist/engine.js';

const copy=value=>JSON.parse(JSON.stringify(value));
const report=JSON.parse(readFileSync(new URL('./fixtures/raise-routes-v19.json',import.meta.url)));
const routeFor=id=>{const route=report.routes.find(item=>item.id===id);assert.ok(route,`missing natural witness ${id}`);return route;};

function replay(route,{saved=false,stopBeforeFirstRaise=false}={}){
 let run=createRun(route.roleId,route.seed);const trace=[];
 const checkpoint=()=>{
  if(saved)run=copy(run);
  assert.equal(validRun(run),true,`${route.id}: ${run.eventId}/${run.pendingEffect}`);
  assert.ok(run.pay>=1&&run.pay<=500);assert.ok(run.basePay>=1&&run.basePay<=300);
  assert.ok(run.stats.skill+run.stats.slack+run.stats.lick<=180);
 };
 checkpoint();
 for(let index=0;index<route.actions.length;index++){
  const action=route.actions[index],before=copy(run);
  if(stopBeforeFirstRaise&&action.type==='raise')break;
  if(action.type==='choice'){
   assert.equal(run.eventId,action.eventId);
   run=applyChoice(run,action.index);checkpoint();
   const pending=copy(run),last=run.history.at(-1);
   for(const key of STAT_KEYS)assert.equal(last.breakdown.reduce((sum,row)=>sum+(row.delta[key]||0),0),last.delta[key],`${action.eventId}/${key}`);
   if(!(route.actions[index+1]?.type==='rage'&&route.actions[index+1].phase==='result'))run=advance(run);
   trace.push({action,before,pending,after:copy(run)});
  }else if(action.type==='rage'){
   assert.equal(canRequestRage(run),true);run=requestRage(run);checkpoint();
   const pending=copy(run);run=advance(run);trace.push({action,before,pending,after:copy(run)});
  }else{
   const handlers={exit:requestExit,break:requestBreak,career:requestCareer,raise:requestRaise};
   if(action.type==='raise')assert.equal(canRequestRaise(run),true,route.id);
   const prior=run;run=handlers[action.type](run);assert.notEqual(run,prior);trace.push({action,before,after:copy(run)});
  }
  checkpoint();
 }
 return {run,trace};
}

test('natural raise witnesses cover every profession and all three initial responses without state injection',()=>{
 assert.deepEqual([...new Set(report.routes.filter(route=>route.id.startsWith('role-')).map(route=>route.roleId))].sort(),ROLES.filter(role=>(role.minRules||1)<=19).map(role=>role.id).sort());
 for(const id of ['offer','promise','fury']){
  const route=routeFor(`initial-${id}`),{run,trace}=replay(route,{saved:true});
  const opened=trace.find(item=>item.action.type==='raise');
  assert.equal(run.eventId,'raise-response');assert.equal(run.raiseContext.outcome,id);
  assert.equal(run.pay,opened.before.pay);assert.equal(run.rank,opened.before.rank);
  assert.equal(run.turn,opened.before.turn);assert.equal(run.flags.raise_attempts,1);
  assert.equal(run.flags.raise_last_work,workCount(opened.before));
 }
});

test('every raise witness survives each direct and JSON checkpoint and matches canonical replay',()=>{
 for(const route of report.routes){
  assert.match(route.seed,/^e19-/);assert.ok(route.actions.some(action=>action.type==='raise'));
  const direct=replay(route).run,saved=replay(route,{saved:true}).run;
  assert.deepEqual(saved,direct,route.id);assert.deepEqual(replayRun(route.roleId,route.seed,route.actions),direct,route.id);
  assert.deepEqual({eventId:direct.eventId,completed:direct.completed,pay:direct.pay,basePay:direct.basePay,rank:direct.rank,raises:direct.flags.raises||0,attempts:direct.flags.raise_attempts||0},route.expected,route.id);
 }
});

test('opening and canceling consume no RNG, workday, salary, promotion readiness or formal attempt',()=>{
 let run=replay(routeFor('cancel'),{stopBeforeFirstRaise:true}).run;
 for(let repeat=0;repeat<8;repeat++){
  const before=copy(run),menu=requestRaise(run);assert.equal(menu.rng,before.rng);assert.equal(menu.turn,before.turn);
  assert.equal(requestRaise(menu),menu);assert.equal(requestCareer(menu),menu);assert.equal(requestBreak(menu),menu);assert.equal(requestExit(menu),menu);
  const pending=applyChoice(menu,3);assert.equal(pending.pendingEffect,'raiseCancel');run=advance(pending);
  assert.equal(validRun(copy(run)),true);assert.equal(run.eventId,before.eventId);assert.equal(run.raiseContext,null);
  for(const key of ['rng','turn','rank','pay','basePay','lastPromotion'])assert.equal(run[key],before[key],key);
  assert.deepEqual(run.stats,before.stats);assert.deepEqual(run.flags,before.flags);assert.equal(workCount(run),workCount(before));assert.equal(canRequestRaise(run),true);
 }
});

test('written approval changes real salary and base salary, while role and promotion remain independent',()=>{
 for(const route of report.routes.filter(item=>item.id.startsWith('role-'))){
  const {trace}=replay(route,{saved:true});const grant=trace.find(item=>item.pending?.pendingEffect==='raiseGrant');assert.ok(grant,route.id);
  const {before,pending,after}=grant;
  assert.equal(pending.pay,before.raiseContext.offerPay);assert.ok(pending.pay>before.pay);assert.ok(pending.pay<=raisePayCeiling(pending));
  assert.equal(pending.basePay,Math.max(1,Math.round(pending.pay/careerLevels(pending)[pending.rank].payMultiplier)));
  for(const key of ['rank','turn','lastPromotion','roleId','actualRoleId','assignment'])assert.equal(pending[key],before[key],`${route.id}/${key}`);
  for(const key of ['promotions','career_service','career_defer_until'])assert.equal(pending.flags[key],before.flags[key],key);
  assert.equal(after.raiseContext,null);assert.equal(after.flags.raises,(before.flags.raises||0)+1);
 }
 const {run,trace}=replay(routeFor('raised-pay-persists-to-income'));
 const grant=trace.find(item=>item.pending?.pendingEffect==='raiseGrant');assert.ok(grant);
 const income=trace.find(item=>item.before.history.length>=grant.after.history.length&&item.pending?.history.at(-1).breakdown.some(row=>row.source==='income'));
 assert.ok(income);assert.equal(income.before.pay,grant.pending.pay);assert.equal(run.pay,grant.pending.pay);assert.equal(run.basePay,grant.pending.basePay);
 const row=income.pending.history.at(-1).breakdown.find(item=>item.source==='income');
 assert.equal(row.delta.cash,Math.min(100-income.before.stats.cash,Math.max(4,Math.round(grant.pending.pay/10))));
});

test('offset is a disclosed separate cost, and rejecting it keeps the original salary',()=>{
 for(const [id,accepted] of [['offset-accepted',true],['offset-refused',false]]){
  const {trace}=replay(routeFor(id),{saved:true});
  const last=trace.find(item=>item.before.eventId==='raise-confirmation'&&item.before.raiseContext?.view==='offset');assert.ok(last);
  assert.match(getEvent(last.before).body,/其他給付/);
  if(accepted){assert.equal(last.pending.pay,last.before.raiseContext.offerPay);assert.equal(last.pending.stats.cash,last.before.stats.cash-12);assert.equal(last.pending.flags.raise_offset_accepted,1);}
  else{assert.equal(last.pending.pay,last.before.pay);assert.equal(last.pending.stats.cash,last.before.stats.cash);assert.equal(last.pending.flags.raise_offset_refused,1);}
 }
});

test('a promise stays unpaid until later written approval; anger can reach existing HR consequences',()=>{
 const promised=replay(routeFor('promise-remains-promise'));const opened=promised.trace.find(item=>item.action.type==='raise');
 assert.equal(promised.run.pay,opened.before.pay);assert.equal(promised.run.flags.raises,undefined);assert.equal(promised.run.flags.raise_promise,1);
 const confirmed=replay(routeFor('promise-written-confirmation'));assert.ok(confirmed.trace.some(item=>item.before.eventId==='raise-confirmation'&&item.pending?.pendingEffect==='raiseGrant'));
 const fury=replay(routeFor('promise-to-fury-confirmation')).run;assert.equal(fury.eventId,'raise-confirmation');assert.equal(fury.raiseContext.view,'fury');
 const fired=replay(routeFor('fury-to-hr'),{saved:true}).run;assert.equal(fired.eventId,'crisis-boss');assert.equal(fired.raiseContext,null);assert.ok(fired.flags.raise_fury);
 for(const index of [0,1,2])if(getEvent(fired).choices[index].available!==false){const pending=applyChoice(fired,index);assert.equal(validRun(copy(pending)),true);assert.equal(validRun(copy(advance(pending))),true);}
});

test('five actual workdays separate formal attempts and no more than three formal attempts are allowed',()=>{
 const {run,trace}=replay(routeFor('max-three-formal'),{saved:true});
 const formal=trace.filter(item=>item.before.eventId==='raise-request'&&item.pending?.pendingEffect!=='raiseCancel');assert.equal(formal.length,3);
 for(let index=1;index<formal.length;index++)assert.ok(workCount(formal[index].before)-workCount(formal[index-1].before)>=5);
 assert.equal(run.flags.raise_attempts,3);assert.equal(canRequestRaise(run),false);assert.match(raiseAvailability(run).reason,/三次/);assert.equal(requestRaise(run),run);
 const first=replay(routeFor('actual-raise')).run;assert.equal(canRequestRaise(first),false);assert.match(raiseAvailability(first).reason,/5 個工作回合/);
 const before=replay(routeFor('actual-raise'),{stopBeforeFirstRaise:true}).run;
 const cooldown={...before,flags:{...before.flags,raise_attempts:1,raise_last_work:workCount(before)}};
 for(let count=0;count<6;count++){
  const candidate={...cooldown,history:[...cooldown.history,...Array.from({length:count},()=>({kind:'daily',choiceIndex:0}))]};
  assert.equal(canRequestRaise(candidate),count>=5,`actual completed work count ${count}`);
 }
});

test('raise eligibility rejects legacy lives, PIP, pending pay cuts and every modal without mutating them',()=>{
 const before=replay(routeFor('actual-raise'),{stopBeforeFirstRaise:true}).run;assert.equal(canRequestRaise(before),true);
 const blocked=[{seed:'e18-no-manual-raise'},{completed:true},{pending:true},{pip:{active:true,remaining:2}},{salaryCut:{status:'pending'}},{resumeEventId:'jack-notebook'},{exitReturnEventId:'jack-notebook'},{breakReturnEventId:'jack-notebook'},{banquetReturnEventId:'jack-notebook'},{rageContext:{}},{meltdownReturnEventId:'jack-notebook'},{raiseContext:{}},{eventId:'career-review'},{eventId:'mood-collapse'},{pay:raisePayCeiling(before)},{flags:{...before.flags,raise_attempts:3}}];
 for(const change of blocked){const candidate={...copy(before),...change};assert.equal(canRequestRaise(candidate),false,JSON.stringify(change));assert.equal(requestRaise(candidate),candidate);}
 const fewer={...copy(before),history:before.history.filter(item=>!['daily','fantasy'].includes(item.kind))};assert.equal(canRequestRaise(fewer),false);assert.match(raiseAvailability(fewer).reason,/三個工作回合/);
});

test('dream and real rage work during both raise events and already committed raise results',()=>{
 for(const phase of ['event','result'])for(const mode of ['imagined','real']){
  const {run,trace}=replay(routeFor(`rage-${phase}-${mode}`),{saved:true});const rage=trace.find(item=>item.action.type==='rage');assert.ok(rage);
  assert.equal(rage.action.phase,phase);assert.equal(rage.pending.rageContext.mode,mode);assert.ok(rage.before.raiseContext);
  if(mode==='imagined'){assert.equal(run.rageContext,null);assert.ok(run.raiseContext);assert.ok(['raise-request','raise-response','raise-confirmation','mood-collapse'].includes(run.eventId));}
  else{assert.equal(run.eventId,'rage-aftermath');assert.equal(run.rageContext.mode,'real');for(let index=0;index<getEvent(run).choices.length;index++)if(getEvent(run).choices[index].available!==false)assert.equal(validRun(copy(advance(applyChoice(run,index)))),true);}
 }
});

test('natural zero mood collapse interrupts the negotiation and resumes it once without extra time or attempts',()=>{
 const run=replay(routeFor('meltdown-in-negotiation'),{saved:true}).run;assert.equal(run.eventId,'mood-collapse');assert.ok(run.raiseContext);assert.ok(run.meltdownReturnEventId.startsWith('raise-'));
 assert.equal(canRequestRaise(run),false);assert.equal(canRequestRage(run),false);
 for(const index of [0,1])if(getEvent(run).choices[index].available!==false){
  const pending=applyChoice(run,index);assert.equal(validRun(copy(pending)),true);const next=advance(pending);
  assert.equal(next.eventId,run.meltdownReturnEventId);assert.equal(next.meltdownReturnEventId,null);
  if(index===0)assert.deepEqual(next.raiseContext,run.raiseContext);
  else{
   assert.equal(next.pay,Math.round(run.pay*.9));assert.equal(next.raiseContext.fromPay,next.pay);
   for(const key of ['eventId','approach','outcome','view','percent'])assert.equal(next.raiseContext[key],run.raiseContext[key]);
  }
  assert.equal(next.turn,run.turn);assert.equal(next.flags.raise_attempts,run.flags.raise_attempts);assert.equal(validRun(copy(next)),true);
 }
 const quit=advance(applyChoice(run,2));assert.equal(quit.completed,true);assert.equal(quit.raiseContext,null);assert.equal(validRun(copy(quit)),true);
});

test('written raises at every rank keep both current pay and future base pay within replay limits',()=>{
 const original=replay(routeFor('initial-offer')).run;
 for(let rank=0;rank<=7;rank++){
  const boundary={...copy(original),rank,assignment:rank===0?'assistant':'honest',eventId:'raise-confirmation',flags:{...original.flags,career_peak_rank:rank},stats:{...original.stats,mood:65,energy:65,cash:65}};
  boundary.pay=raisePayCeiling(boundary)-1;boundary.basePay=Math.round(boundary.pay/careerLevels(boundary)[rank].payMultiplier);
  boundary.raiseContext={...boundary.raiseContext,fromPay:boundary.pay,offerPay:raisePayCeiling(boundary),percent:4,outcome:'offer',view:'offer'};
  assert.equal(validRun(copy(boundary)),true,`rank ${rank} before`);
  const pending=applyChoice(boundary,0),done=advance(pending);
  assert.equal(pending.pay,raisePayCeiling(pending));assert.ok(pending.basePay<=300);assert.equal(validRun(copy(pending)),true,`rank ${rank} pending`);assert.equal(validRun(copy(done)),true,`rank ${rank} after`);
 }
});

test('tampered raise replay payloads and malformed conversation contexts are rejected',()=>{
 const route=routeFor('actual-raise'),first=route.actions.findIndex(action=>action.type==='raise');
 const extra=copy(route.actions);extra[first].offerPay=500;assert.throws(()=>replayRun(route.roleId,route.seed,extra),/Invalid raise action/);
 const early=[{type:'raise'}];assert.throws(()=>replayRun(route.roleId,route.seed,early),/Unavailable raise/);
 const run=requestRaise(replay(route,{stopBeforeFirstRaise:true}).run);
 for(const change of [{eventId:'raise-request'},{eventId:'invented'},{fromPay:0},{offerPay:run.pay},{percent:99},{outcome:'invented'},{view:'invented'},{approach:'invented'},{extra:true}])assert.equal(validRun({...copy(run),raiseContext:{...run.raiseContext,...change}}),false,JSON.stringify(change));
});
