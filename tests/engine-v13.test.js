import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {EVENTS} from '../dist/events.js';
import {RAGE_TARGETS} from '../dist/rage.js';
import {
 STAT_KEYS,createRun,getEvent,applyChoice,advance,requestExit,requestBreak,
 requestCareer,canRequestRage,requestRage,replayRun,validRun
} from '../dist/engine.js';

const copy=value=>JSON.parse(JSON.stringify(value));
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const sorted=value=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,sorted(value[key])])):value;
const choose=(run,index)=>advance(applyChoice(run,index));
const cancelIndex=run=>getEvent(run).choices.findIndex(choice=>!choice.rageTarget&&choice.effect==='rageReturn');
const pointerKeys=['eventId','turn','rng','stats','pip','pipCount','resumeEventId','exitReturnEventId','breakReturnEventId','banquetReturnEventId','lastBreakTurn','lastKindInviteTurn','lastPromotion'];
const snapshot=run=>Object.fromEntries(pointerKeys.map(key=>[key,copy(run[key])]));

// An actual, unmodified game path. This witness enters the party after ten
// working days; no fixture state is injected to manufacture attendance.
export const BANQUET_WITNESS={roleId:'system',seed:'e13-natural-party-0',actions:[
 {type:'choice',eventId:'onboarding',index:0},
 {type:'choice',eventId:'pm-human-buffer',index:1},
 {type:'choice',eventId:'education-scrutiny',index:0},
 {type:'choice',eventId:'salary-cut',index:0},
 {type:'choice',eventId:'crisis-mood',index:1},
 {type:'choice',eventId:'video-designer-benchmark',index:1},
 {type:'choice',eventId:'copy-master-late',index:1},
 {type:'choice',eventId:'dp-job-three-conditions',index:2},
 {type:'choice',eventId:'rick-architecture-relic',index:1},
 {type:'choice',eventId:'crisis-mood',index:1},
 {type:'choice',eventId:'attendance-accidental-admin',index:1},
 {type:'choice',eventId:'video-message-workout',index:1},
 {type:'choice',eventId:'rick-two-voices',index:1},
 {type:'choice',eventId:'crisis-mood',index:1},
 {type:'choice',eventId:'wing-message-lottery',index:1}
]};

function replayCheckpoints(route,jsonRoundTrip=false){
 let run=createRun(route.roleId,route.seed),hashes=[],canonicalHashes=[];
 const checkpoint=()=>{
  if(jsonRoundTrip)run=copy(run);
  assert.equal(validRun(run),true,`${route.seed}/${run.eventId}: invalid checkpoint`);
  hashes.push(digest(run));
  if(route.seed.startsWith('e13-'))canonicalHashes.push(digest(sorted(copy(run))));
 };
 checkpoint();
 for(const action of route.actions){
  if(action.type==='exit')run=requestExit(run);
  else if(action.type==='break')run=requestBreak(run);
  else if(action.type==='career')run=requestCareer(run);
  else if(action.type==='rage')run=requestRage(run);
  else{
   assert.equal(run.eventId,action.eventId);
   run=applyChoice(run,action.index);checkpoint();run=advance(run);
  }
  checkpoint();
 }
 return {run,hashes,canonicalHashes};
}

function boundary(eventId=EVENTS[0].id,extras={}){
 const run=createRun('system','e13-rage-boundary');
 return {...run,eventId,turn:6,educationReviewed:true,salaryCutOffered:true,...extras,
  stats:{...run.stats,energy:90,cash:80,mood:50,boss:60,...extras.stats},
  flags:{...run.flags,education_risk_checked:1,career_service:5,...extras.flags}};
}
function assertLedger(before,pending){
 const last=pending.history.at(-1),sum=Object.fromEntries(STAT_KEYS.map(key=>[key,0]));
 for(const item of last.breakdown)for(const [key,amount]of Object.entries(item.delta))sum[key]+=amount;
 assert.deepEqual(sum,last.delta);
 assert.deepEqual(last.delta,Object.fromEntries(STAT_KEYS.map(key=>[key,pending.stats[key]-before.stats[key]])));
 for(const value of Object.values(pending.stats))assert.ok(value>=0&&value<=100);
}

test('all 234 published e12 routes retain every direct and JSON checkpoint byte for byte',()=>{
 const fixtures=JSON.parse(readFileSync(new URL('./fixtures/legacy-e12-routes.json',import.meta.url),'utf8'));
 assert.equal(fixtures.length,234);
 let checkpointCount=0;
 for(const fixture of fixtures){
  const direct=replayCheckpoints(fixture),saved=replayCheckpoints(fixture,true);
  assert.equal(digest(direct.run),fixture.stateSha256,fixture.ending);
  assert.equal(digest(saved.run),fixture.savedStateSha256,fixture.ending);
  assert.deepEqual(direct.hashes,fixture.directCheckpoints,fixture.ending);
  assert.deepEqual(saved.hashes,fixture.savedCheckpoints,fixture.ending);
  assert.deepEqual(replayRun(fixture.roleId,fixture.seed,fixture.actions),direct.run);
  checkpointCount+=direct.hashes.length;
 }
 assert.equal(checkpointCount,10172);
});

test('rage is available during onboarding, work and nested notifications; cancelling preserves each suspended scene',()=>{
 const scenes=[
  createRun('system','e13-rage-onboarding'),boundary(),
  boundary('salary-cut',{resumeEventId:EVENTS[0].id,salaryCut:{from:80,to:60,percent:25,status:'pending'}}),
  boundary('pip-review',{pip:{active:true,remaining:0},pipCount:1,resumeEventId:EVENTS[0].id}),
  boundary('career-review',{resumeEventId:EVENTS[0].id}),
  boundary('career-duty-1',{rank:1,resumeEventId:EVENTS[0].id,flags:{career_peak_rank:1}}),
  requestExit(boundary()),
  requestBreak(boundary()),
  replayRun(BANQUET_WITNESS.roleId,BANQUET_WITNESS.seed,BANQUET_WITNESS.actions)
 ];
 for(const original of scenes){
  assert.equal(validRun(original),true,original.eventId);
  assert.equal(canRequestRage(original),true,original.eventId);
  const menu=requestRage(original);
  assert.equal(menu.eventId,'rage-menu');assert.equal(menu.rng,original.rng);
  assert.equal(validRun(copy(menu)),true,original.eventId);
  assert.strictEqual(requestRage(menu),menu,'opening an existing overlay cannot reroll it');
  const index=cancelIndex(menu);assert.ok(index>=0);
  const pending=applyChoice(menu,index),returned=advance(pending);
  assert.equal(validRun(copy(pending)),true);assert.equal(validRun(copy(returned)),true);
  assert.deepEqual(snapshot(returned),snapshot(original),original.eventId);
  assert.equal(returned.rageContext,null);
  assert.deepEqual(returned.flags,original.flags,'cancelling earns nothing');
 }
 for(const old of ['e12-rage-old','e8-rage-old','unprefixed-rage-old']){
  const run=createRun('system',old);assert.equal(canRequestRage(run),false);assert.strictEqual(requestRage(run),run);
 }
});

test('opening rage after a revealed result advances it once and remains identical to canonical replay',()=>{
 const initial=createRun('system','e13-rage-revealed'),pending=applyChoice(initial,0),settled=advance(pending);
 const menu=requestRage(pending),direct=requestRage(settled);
 assert.deepEqual(menu,direct);
 assert.equal(menu.turn,1);assert.equal(menu.history.length,1);
 assert.equal(menu.history[0].eventId,'onboarding');
 const returned=choose(menu,cancelIndex(menu));
 assert.deepEqual(replayRun(returned.roleId,returned.seed,returned.actions),returned);
 const terminal=applyChoice(createRun('system','e13-rage-terminal'),2);
 assert.equal(canRequestRage(terminal),false);assert.strictEqual(requestRage(terminal),terminal);
 const finished=advance(terminal);assert.equal(canRequestRage(finished),false);assert.strictEqual(requestRage(finished),finished);
});

test('rage target and mood affect seeded reactions while visible choices keep outcomes unrevealed',()=>{
 assert.deepEqual(RAGE_TARGETS,['wing','spencer','rick','hope','erich','jenjen','sonny','kind']);
 const hot=requestRage(boundary('onboarding',{stats:{mood:10,boss:10}}));
 const calm=requestRage(boundary('onboarding',{stats:{mood:90,boss:90}}));
 const hotChoices=getEvent(hot).choices,calmChoices=getEvent(calm).choices;
 assert.notDeepEqual(hotChoices[0].draw.outcomes,calmChoices[0].draw.outcomes,'mood changes the actual reaction distribution');
 assert.notDeepEqual(hotChoices[0].draw.outcomes,hotChoices[2].draw.outcomes,'targets have different stories and effects');
 for(const choice of hotChoices){
  assert.equal(choice.detail,'');assert.doesNotMatch(choice.text,/[+-]\s*\d|\d\s*%|機率/);
  for(const outcome of choice.draw?.outcomes||[])assert.ok(!getEvent(hot).body.includes(outcome.result));
 }
 // Identical input is immutable and deterministic; choosing, rather than
 // opening the menu, is what commits the random result.
 const before=copy(hot),first=applyChoice(hot,0),again=applyChoice(hot,0);
 assert.deepEqual(hot,before);assert.deepEqual(first,again);assert.notEqual(first.rng,hot.rng);
 assert.equal(first.flags.rage_target_wing,1);assert.equal(first.flags.rage_attempts,1);
 assert.equal(first.history.at(-1).eventOutcome.label,'辦公室卡通時間');
 assertLedger(hot,first);
});

test('all eight targets resolve with clamped actual ledgers, and the same workday cannot farm or reroll',()=>{
 for(let i=0;i<RAGE_TARGETS.length;i++){
  // Every target gets both an on-screen presence and an off-screen attempt.
  for(const speaker of [RAGE_TARGETS[i],'self']){
   const menu=requestRage(boundary('onboarding',{stats:{mood:99,energy:2,boss:1,slack:99,trust:99}}));
   menu.rageContext.speaker=speaker;
   const pending=applyChoice(menu,i);assertLedger(menu,pending);
   assert.equal(pending.flags[`rage_target_${RAGE_TARGETS[i]}`],1);
   assert.ok(pending.history.at(-1).result.length>30);
   // A second, healthy attempt exercises the repeat guard independently of
   // the deliberately exhausted clamp boundary above.
   const healthy=requestRage(boundary('onboarding'));
   healthy.rageContext.speaker='self';
   const returned=choose(healthy,i);
   assert.equal(returned.completed,false);
   const repeated=requestRage(returned),choices=getEvent(repeated).choices;
   assert.equal(choices.length,1);assert.equal(choices[0].rageTarget,undefined);
   const cancelled=choose(repeated,0);
   assert.deepEqual(snapshot(cancelled),snapshot(returned));
   assert.deepEqual(cancelled.flags,returned.flags);
  }
 }
});

test('a natural rage run validates and replays through every direct and saved checkpoint',()=>{
 const route={roleId:'system',seed:'e13-natural-rage',actions:[
  {type:'rage'},{type:'choice',eventId:'rage-menu',index:2},
  {type:'choice',eventId:'onboarding',index:0},
  {type:'rage'},{type:'choice',eventId:'rage-menu',index:7},
  {type:'exit'},{type:'choice',eventId:'exit-menu',index:0}
 ]};
 const direct=replayCheckpoints(route),saved=replayCheckpoints(route,true);
 assert.deepEqual(saved,direct);assert.deepEqual(replayRun(route.roleId,route.seed,route.actions),direct.run);
 assert.equal(direct.run.completed,true);
 assert.equal(direct.run.flags.rage_target_rick,1);assert.equal(direct.run.flags.rage_target_kind,1);
 assert.throws(()=>replayRun('system','e12-no-rage',[{type:'rage'}]),/Unavailable rage/);
 assert.throws(()=>replayRun('system','e13-nested-rage',[{type:'rage'},{type:'rage'}]),/Unavailable rage/);
 assert.throws(()=>replayRun('system','e13-bad-rage',[{type:'rage'},{type:'choice',eventId:'rage-menu',index:9}]),/Unavailable choice/);
 const forged=copy(requestRage(createRun('system','e13-bad-context')));forged.rageContext.eventId='rage-menu';assert.equal(validRun(forged),false);
});

test('a natural banquet is a single three-stage interlude; every Kind invitation agrees, ghosts and costs nothing',()=>{
 const direct=replayCheckpoints(BANQUET_WITNESS),saved=replayCheckpoints(BANQUET_WITNESS,true);
 // A save can drop an undefined pendingEffect and reinsert it later in a
 // different property order, so compare new checkpoints after canonicalization.
 assert.deepEqual(saved.canonicalHashes,direct.canonicalHashes);
 assert.deepEqual(saved.run,copy(direct.run));const start=direct.run;
 assert.equal(start.eventId,'banquet-welcome');assert.equal(start.turn,10);assert.equal(start.flags.banquet_seen,1);
 assert.equal(getEvent({...start,eventId:start.banquetReturnEventId}).kind,'daily');
 for(const first of [0,1,2,3])for(const draw of [0,1,2,3])for(const invite of [0,1]){
  let current=copy(start);const initialTurn=current.turn,initialPip=copy(current.pip),returnTo=current.banquetReturnEventId;
  for(const [index,nextId]of [[first,'banquet-draw'],[draw,'banquet-afterparty']]){
   const before=current,pending=applyChoice(current,index);assertLedger(before,pending);
   assert.equal(pending.turn,initialTurn);assert.deepEqual(pending.pip,initialPip);
   current=advance(pending);assert.equal(current.eventId,nextId);assert.equal(validRun(copy(current)),true);
  }
  const cash=current.stats.cash,pending=applyChoice(current,invite);assertLedger(current,pending);
  assert.equal(pending.stats.cash,cash);assert.match(pending.history.at(-1).result,/答應/);
  assert.match(pending.history.at(-1).result,/消失|不見|先走|只剩.*椅子/);
  current=advance(pending);assert.equal(current.eventId,returnTo);assert.equal(current.banquetReturnEventId,null);
  assert.equal(current.turn,initialTurn);assert.deepEqual(current.pip,initialPip);
  assert.equal(current.flags.kind_afterparty_ghost,1);assert.equal(current.flags.banquet_attended,1);
  assert.deepEqual(replayRun(current.roleId,current.seed,current.actions),current);
  assert.equal(validRun(copy(current)),true);
 }
});

test('party lottery is seeded, has multiple natural outcomes, and never interrupts active or expired PIP',()=>{
 const results=new Set();
 const start=replayRun(BANQUET_WITNESS.roleId,BANQUET_WITNESS.seed,BANQUET_WITNESS.actions);
 for(let i=0;i<100;i++){
  const rng=createRun('system',`e13-lottery-${i}`).rng;
  const draw={...copy(start),eventId:'banquet-draw',rng};
  const pending=applyChoice(draw,0);results.add(pending.history.at(-1).eventOutcome.result);
  assert.deepEqual(applyChoice(draw,0),pending);assertLedger(draw,pending);
 }
 assert.equal(results.size,3);
 let ordinaryParty=0;
 for(let i=0;i<100;i++){
  const base=boundary(EVENTS[0].id,{turn:11,rng:createRun('system',`e13-party-pip-${i}`).rng,stats:{mood:80,boss:80,energy:90,cash:90}});
  const ordinary=choose(base,0);if(ordinary.eventId==='banquet-welcome')ordinaryParty++;
  for(const remaining of [1,2,3]){
   const pip={...copy(base),pip:{active:true,remaining},pipCount:1};
   const continued=choose(pip,0);
   assert.notEqual(continued.eventId,'banquet-welcome');
   if(remaining===1)assert.equal(continued.eventId,'pip-review');
   else assert.equal(continued.pip.remaining,remaining-1);
  }
  const attended={...copy(base),flags:{...base.flags,banquet_seen:1}};
  assert.notEqual(choose(attended,0).eventId,'banquet-welcome','a finished party cannot be drawn twice');
 }
 assert.ok(ordinaryParty>10&&ordinaryParty<70,`party occurred in ${ordinaryParty} of 100 eligible workdays`);
});

test('leaving a party after stepping down replaces suspended work that no longer fits the rank',()=>{
 const managerTask=EVENTS.find(event=>event.minRank>=2);assert.ok(managerTask);
 const party=boundary('banquet-afterparty',{turn:12,banquetReturnEventId:managerTask.id,rank:0,flags:{banquet_seen:1,banquet_attended:1,career_peak_rank:2}});
 assert.equal(validRun(party),true);
 const returned=choose(party,3),event=getEvent(returned);
 assert.equal(event.kind,'daily');assert.ok((event.minRank??0)<=returned.rank);
 assert.ok((event.maxRank??4)>=returned.rank);assert.notEqual(event.id,managerTask.id);
 assert.equal(returned.turn,party.turn);assert.equal(returned.banquetReturnEventId,null);
 assert.equal(validRun(copy(returned)),true);
});
