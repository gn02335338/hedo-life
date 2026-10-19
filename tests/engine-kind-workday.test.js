import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {KIND_BREAK_COST,KIND_WORKDAY_CHANCE,KIND_WORKDAY_COOLDOWN} from '../dist/kind-break.js';
import {EVENTS} from '../dist/events.js';
import {STAT_KEYS,createRun,getEvent,applyChoice,advance,canRequestBreak,requestBreak,requestExit,replayRun,validRun} from '../dist/engine.js';
import {replayRoute} from './find-routes-v3.mjs';
const copy=run=>JSON.parse(JSON.stringify(run));
const digest=run=>createHash('sha256').update(JSON.stringify(run)).digest('hex');
const choose=(run,index)=>advance(applyChoice(run,index));
function bestChoice(run){
 return getEvent(run).choices.map((c,index)=>({c,index})).filter(({c})=>c.available!==false).map(({index})=>{
  const next=choose(run,index),s=next.stats;
  return{index,score:(next.completed?-10000:0)+s.energy*1.6+s.mood*1.9+s.cash*1.4+s.boss*1.2+(s.slack+s.skill)*.2};
 }).sort((a,b)=>b.score-a.score)[0].index;
}
function naturalInvitation({poor=false}={}){
 for(let i=0;i<300;i++){
  let run=createRun('sales',`e7-kind-workday-${i}`);
  for(let n=0;n<100&&!run.completed;n++){
   if(run.eventId==='kind-workday'){
    if(poor?run.stats.cash<KIND_BREAK_COST:run.stats.cash>KIND_BREAK_COST)return run;
    run=choose(run,getEvent(run).choices[0].available?0:1);continue;
   }
   run=choose(run,bestChoice(run));
  }
 }
 throw new Error(`No natural ${poor?'poor':'paid'} workday invitation`);
}
function daily(seed,extras={}){
 const initial=createRun('system',seed);
 return{...initial,eventId:EVENTS[0].id,turn:2,rank:4,educationReviewed:true,salaryCutOffered:true,lastKindInviteTurn:-1,stats:{...initial.stats,boss:70,mood:90,energy:90,cash:90},...extras};
}

test('published e6 complete states survive e7 automatic invitations, directly and through JSON saves',()=>{
 const fixtures=JSON.parse(readFileSync(new URL('./fixtures/legacy-e6-routes.json',import.meta.url),'utf8'));
 for(const fixture of fixtures){
  const run=replayRun(fixture.roleId,fixture.seed,fixture.actions);
  assert.equal(digest(run),fixture.stateSha256,fixture.ending);
  assert.equal(digest(replayRoute(fixture)),fixture.savedStateSha256,`${fixture.ending} saved`);
  assert.equal(validRun(copy(run)),true);
  assert.equal('lastKindInviteTurn' in run,false);
 }
});

test('ordinary work can trigger a deterministic Kind invitation without any break action',()=>{
 const menu=naturalInvitation();
 assert.equal(menu.eventId,'kind-workday');assert.equal(getEvent(menu).kind,'self-care');assert.equal(getEvent(menu).speaker,'kind');
 assert.equal(menu.actions.some(a=>a.type==='break'),false);
 assert.equal(menu.history.at(-1).kind,'daily');assert.equal(menu.turn,menu.history.at(-1).turn+1);
 assert.equal(menu.lastKindInviteTurn,menu.turn);assert.notEqual(menu.lastBreakTurn,menu.turn);
 assert.equal(getEvent({...menu,eventId:menu.breakReturnEventId}).kind,'daily');
 assert.equal(validRun(copy(menu)),true);assert.deepEqual(replayRun(menu.roleId,menu.seed,menu.actions),menu);
 assert.equal(canRequestBreak(menu),false);assert.equal(requestBreak(menu),menu);assert.equal(requestExit(menu),menu);
});

test('eligible workdays have varied invite results while cooldown blocks the extra RNG draw',()=>{
 let invitations=0;const total=600;
 for(let i=0;i<total;i++){
  const before=daily(`e7-kind-odds-${i}`),snapshot=copy(before),next=choose(before,0);
  assert.deepEqual(before,snapshot);assert.deepEqual(choose(before,0),next);
  if(next.eventId==='kind-workday')invitations++;
  else assert.equal(getEvent(next).kind,'daily');
  const cooling=choose({...before,lastKindInviteTurn:before.turn},0);
  assert.notEqual(cooling.eventId,'kind-workday');
  const blocked=choose({...before,lastKindInviteTurn:before.turn-1},0);
  assert.notEqual(blocked.eventId,'kind-workday');assert.equal(blocked.rng,cooling.rng);
 }
 assert.ok(Math.abs(invitations/total-KIND_WORKDAY_CHANCE)<.055,`${invitations}/${total}`);
 const turns=[];
 for(let i=0;i<80;i++){
  let run=createRun('sales',`e7-kind-spacing-${i}`),last=null;
  for(let n=0;n<80&&!run.completed;n++){
   if(run.eventId==='kind-workday'){
    if(last!==null){assert.ok(run.turn-last>=KIND_WORKDAY_COOLDOWN);turns.push(run.turn-last);}
    last=run.turn;run=choose(run,1);
   }else run=choose(run,bestChoice(run));
  }
 }
 assert.ok(turns.length>5,'natural runs contain repeated invitations with cooldown');
});

test('acceptance costs one daily rest, returns to the same workday, and keeps actual recovery breakdowns',()=>{
 const menu=naturalInvitation(),before=copy(menu),pending=applyChoice(menu,0),returned=advance(pending),history=pending.history.at(-1);
 assert.deepEqual(menu,before);assert.equal(history.eventId,'kind-workday');assert.equal(history.speaker,'kind');
 assert.equal(history.delta.cash,-KIND_BREAK_COST);assert.equal(history.delta.slack,Math.min(16,100-before.stats.slack));
 assert.ok(history.delta.mood>0);assert.equal(history.delta.boss,0);
 assert.equal(pending.lastBreakTurn,menu.turn);assert.equal(returned.lastBreakTurn,menu.turn);
 assert.equal(returned.eventId,menu.breakReturnEventId);assert.equal(returned.breakReturnEventId,null);
 assert.equal(returned.turn,menu.turn);assert.deepEqual(returned.pip,menu.pip);assert.equal(canRequestBreak(returned),false);
 const totals=Object.fromEntries(STAT_KEYS.map(key=>[key,0]));
 for(const part of history.breakdown)for(const [key,value]of Object.entries(part.delta))totals[key]+=value;
 assert.deepEqual(totals,history.delta);assert.equal(validRun(copy(pending)),true);assert.equal(validRun(copy(returned)),true);
 assert.equal(applyChoice(pending,1),pending);assert.equal(requestExit(pending),pending);
});

test('both free refusals go directly back to work and preserve the ordinary rest allowance',()=>{
 const menu=naturalInvitation();
 for(const index of [1,2]){
  const pending=applyChoice(menu,index),returned=advance(pending);
  assert.equal(pending.pendingEffect,'kindWorkDecline');assert.deepEqual(pending.stats,menu.stats);
  assert.equal(pending.rng,menu.rng);assert.equal(returned.rng,menu.rng);
  assert.equal(returned.eventId,menu.breakReturnEventId);assert.equal(returned.breakReturnEventId,null);
  assert.equal(returned.turn,menu.turn);assert.deepEqual(returned.pip,menu.pip);
  assert.equal(returned.lastBreakTurn,menu.lastBreakTurn);assert.equal(returned.lastKindInviteTurn,menu.turn);
  assert.equal(canRequestBreak(returned),true);
  const rest=requestBreak(returned);assert.equal(rest.eventId,'self-care','manual rest cannot invite Kind again on the same workday');
  assert.equal(rest.rng,returned.rng,'same-day ordinary rest does not roll another invitation');
  assert.equal(validRun(copy(returned)),true);assert.equal(validRun(copy(rest)),true);
 }
});

test('PIP review, crises, notices, onboarding, and fantasy transitions take priority over invitations',()=>{
 for(let i=0;i<80;i++){
  const source=daily(`e7-kind-priority-${i}`);
  const pip=choose({...source,pip:{active:true,remaining:1},pipCount:1},0);
  assert.equal(pip.eventId,'pip-review');assert.equal(pip.pip.remaining,0);
  const mood=choose({...source,stats:{...source.stats,mood:0}},1);assert.equal(mood.eventId,'crisis-mood');
  const boss=choose({...source,stats:{...source.stats,boss:0}},1);assert.equal(boss.eventId,'crisis-boss');
  const onboarding=choose(createRun('system',`e7-kind-onboarding-${i}`),0);assert.notEqual(onboarding.eventId,'kind-workday');
  const promotion=choose({...source,turn:5,rank:0},0);assert.equal(promotion.eventId,'promotion-review');
  const fantasy=choose({...source,turn:19},0);assert.equal(getEvent(fantasy).kind,'fantasy');
  const returnSource={...source,eventId:'education-review',resumeEventId:EVENTS[0].id};
  assert.notEqual(choose(returnSource,0).eventId,'kind-workday');
 }
 const menu=naturalInvitation(),duringPip={...menu,pip:{active:true,remaining:2},pipCount:1};
 assert.deepEqual(choose(duringPip,0).pip,duringPip.pip);assert.deepEqual(choose(duringPip,1).pip,duringPip.pip);
});

test('poor natural invitations hide spending and reject forged clicks; saved routes replay both outcomes',()=>{
 const poor=naturalInvitation({poor:true});
 assert.equal(getEvent(poor).choices[0].available,false);assert.throws(()=>applyChoice(poor,0),/Unavailable choice/);
 assert.equal(choose(poor,1).eventId,poor.breakReturnEventId);
 for(const index of [0,1,2]){
  const menu=naturalInvitation(),pending=applyChoice(copy(menu),index),returned=advance(copy(pending));
  assert.equal(validRun(copy(pending)),true);assert.deepEqual(replayRun(returned.roleId,returned.seed,returned.actions),returned);
  const finished=choose(requestExit(copy(returned)),0);assert.equal(finished.completed,true);
  assert.deepEqual(replayRun(finished.roleId,finished.seed,finished.actions),finished);
  assert.deepEqual(replayRoute({...finished,ending:finished.endingId}),finished);
  const forged=finished.actions.map(a=>a.eventId==='kind-workday'?{...a,eventId:'kind-break'}:a);
  assert.throws(()=>replayRun(finished.roleId,finished.seed,forged),/Replay event mismatch/);
 }
 const menu=naturalInvitation();
 for(const bad of [undefined,null,-10,menu.turn+1,1.5])assert.equal(validRun({...menu,lastKindInviteTurn:bad}),false);
 assert.equal(validRun({...menu,breakReturnEventId:null}),false);
 assert.equal(validRun({...menu,breakReturnEventId:'kind-workday'}),false);
 for(const prefix of ['legacy','e1','e2','e3','e4','e5','e6']){
  const old=createRun('system',`${prefix}-kind-workday-guard`);
  assert.equal('lastKindInviteTurn' in old,false);
  assert.throws(()=>getEvent({...old,eventId:'kind-workday',breakReturnEventId:EVENTS[0].id}),/Invalid Kind/);
 }
});
