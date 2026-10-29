import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../dist/engine.js';
import {ROLE_MAP} from '../dist/roles.js';
import {validateCompletion} from '../worker/http.js';
import {characterHistoryChanges,deriveCharacterStats} from '../dist/character-stats.js';
import {
 DUEL_FRAME_LIMIT_V75,DUEL_STEP_V75,encodeDuelInputV75,decodeDuelInputV75,
 validateDuelProofV75,replayCareerDuelV75,createCareerDuelModelV75,
 settleCareerDuelStateV75,duelCompanyIssueV75
} from '../dist/career-duel-v75.js';

const copy=value=>JSON.parse(JSON.stringify(value));
const seed=index=>'e39-r75-n-'+index.toString(16).padStart(22,'0');
function source(index=1){
 let run=E.enableActivitySchedule(E.createRun('system',seed(index)));
 return E.advance(E.applyChoice(run,0));
}
const accepted=(index=1,target='simon')=>{
 const run=E.requestDuelV75(source(index),target);
 assert.equal(run.duelContextV75.accepted,true);
 return E.advance(run);
};
const proof=run=>({runId:'75757575-7575-4757-8757-757575757575',roleId:run.roleId,seed:run.seed,actions:run.actions});
function canonical(run){
 assert.equal(E.validRun(copy(run)),true,`${run.eventId}/${run.pending}`);
 assert.doesNotThrow(()=>validateCompletion(proof(run),ROLE_MAP));
 if(!run.pending)assert.deepEqual(E.replayRun(run.roleId,run.seed,run.actions),run);
}
function counterplay(state){
 const x=state.opponent.x-state.player.x,y=state.opponent.y-state.player.y,distance=Math.hypot(x,y);
 const dodge=state.opponent.telegraphRemaining>0&&state.opponent.telegraphRemaining<.23&&distance<135;
 return {x:dodge?-x:distance>65?x:0,y:dodge?-y:distance>65?y:0,
  attack:state.opponent.telegraphRemaining===0,dodge,special:state.player.energy>=100&&distance<140};
}
function recordedBattle(run,policy=counterplay){
 const context=run.duelContextV75,model=createCareerDuelModelV75({opponentId:context.target,seed:context.seed});
 let state=model.start();
 for(let frame=0;frame<DUEL_FRAME_LIMIT_V75&&state.phase==='playing';frame++)state=model.step(DUEL_STEP_V75,policy(state,frame));
 assert.equal(state.phase,'finished');
 return {state,input:model.getProof()};
}
function finishAftercare(run,index=0){
 const aftercare=E.advance(run);assert.equal(aftercare.duelContextV75.stage,'aftercare');canonical(aftercare);
 const pending=E.applyChoice(aftercare,index);assert.equal(pending.duelContextV75.stage,'closing');
 assert.doesNotThrow(()=>E.getEvent(pending));canonical(pending);
 const returned=E.advance(copy(pending));canonical(returned);return returned;
}

test('recorded controls replay the same combat, and pausing does not create time or phantom inputs',()=>{
 const game=createCareerDuelModelV75({opponentId:'wing',seed:'career-duel-recording'});
 game.start();game.step(1/60,{x:1,special:true});
 const before=game.getState(),proofBefore=game.getProof();
 game.pause();for(let i=0;i<90;i++)game.step(1/30,{attack:true});
 assert.equal(game.getState().elapsed,before.elapsed);assert.deepEqual(game.getProof(),proofBefore);
 game.resume();for(let i=0;i<30;i++)game.step(1/30,{x:-1,y:1,attack:i%2===0});
 game.forfeit();const input=game.getProof(),state=game.getState();
 assert.equal(input.forfeit,true);assert.ok(input.frames.length>0);
 assert.deepEqual(replayCareerDuelV75('wing','career-duel-recording',input),state);
 const detached=game.getProof();detached.frames='';assert.equal(game.getProof().frames,input.frames);
 for(let direction=0;direction<9;direction++)for(let buttons=0;buttons<16;buttons++){
  const hex=(direction*16+buttons).toString(16).padStart(2,'0');
  assert.equal(encodeDuelInputV75(decodeDuelInputV75(hex)),hex);
 }
});

test('only present people in an unanswered current-life scene can receive one invitation per work turn',()=>{
 const run=source(0),before=copy(run),targets=E.getDuelTargetsV75(run);
 assert.deepEqual(targets,['princess','rick']);assert.equal(E.canRequestDuelV75(run),true);
 for(const invalid of ['wing','hidden-visitor','__proto__',undefined,null])assert.equal(E.requestDuelV75(run,invalid),run);
 const pending=E.requestDuelV75(run,'princess');assert.equal(pending.duelContextV75.accepted,false);canonical(pending);
 assert.deepEqual(run,before);assert.equal(pending.turn,run.turn);assert.equal(pending.pay,run.pay);
 assert.deepEqual(E.getDuelTargetsV75(pending),[]);assert.equal(E.requestDuelV75(pending,'rick'),pending);
 const returned=E.advance(pending);canonical(returned);
 assert.equal(returned.eventId,run.eventId);assert.equal(returned.duelContextV75,undefined);
 assert.deepEqual(E.getDuelTargetsV75(returned),[]);assert.equal(returned.flags.duel75_count,1);
 for(const unavailable of [null,E.createRun('system',seed(1)),{...run,seed:run.seed.replace('r75','r74')},{...run,pip:{active:true}},{...run,personnelPending:{}},{...run,pending:true}])assert.equal(E.canRequestDuelV75(unavailable),false);
});

test('accepted invitation, zero-contact surrender and all three aftercare choices preserve the suspended work',()=>{
 for(const index of [0,1,2]){
  const original=source(),invitation=E.requestDuelV75(original,'simon');canonical(invitation);
  const battle=E.advance(invitation);canonical(battle);
  assert.equal(E.getEvent(battle).kind,'duel-battle');assert.equal(battle.turn,original.turn);
  const result=E.applyDuelPlayV75(battle,{frames:'',forfeit:true});canonical(result);
  assert.equal(result.duelContextV75.outcome,'lose');assert.equal(result.duelContextV75.playerStatus,'free');
  assert.equal(result.duelContextV75.targetStatus,'free');assert.equal(result.duelContextV75.issue,null);
  assert.equal(E.applyDuelPlayV75(result,{frames:'',forfeit:true}),result);
  const returned=finishAftercare(result,index);
  assert.equal(returned.eventId,original.eventId);assert.equal(returned.turn,original.turn);assert.equal(returned.pay,original.pay);
  assert.deepEqual(returned.pip,original.pip);assert.equal(returned.completed,false);
  assert.equal(returned.history.filter(row=>row.kind==='duel').length,3);
  assert.equal(returned.stats.cash,original.stats.cash-(index===1?8:0));
  assert.deepEqual(E.getEvent(returned).choices.map(row=>row.text),E.getEvent(original).choices.map(row=>row.text));
 }
});

test('active invitations, combat and aftercare cannot be replaced by a menu or another side action',()=>{
 const invitation=E.requestDuelV75(source(),'simon'),battle=E.advance(invitation),result=E.applyDuelPlayV75(battle,{frames:'',forfeit:true}),aftercare=E.advance(result);
 for(const run of [invitation,battle,result,aftercare]){
  for(const op of [E.requestBreak,E.requestCareer,E.requestRaise,E.requestExit,E.requestVerbal,E.requestRage,E.requestSalaryAdvice,E.requestPatronageReply,E.requestHiddenEncounter])assert.equal(op(run),run,op.name);
  assert.equal(E.requestActivity(run,'arm'),run);assert.equal(E.requestDuelV75(run,'wing'),run);
  assert.equal(E.canRequestDuelV75(run),false);assert.equal(E.canRequestBreak(run),false);
 }
});

test('a second workday allows one more invitation, and the life limit prevents farming a third duel',()=>{
 let run=source(0);
 for(let count=1;count<=2;count++){
  const targets=E.getDuelTargetsV75(run);assert.ok(targets.length);
  run=E.advance(E.requestDuelV75(run,targets[0]));
  if(run.duelContextV75)run=finishAftercare(E.applyDuelPlayV75(run,{frames:'',forfeit:true}));
  assert.equal(run.flags.duel75_count,count);assert.equal(E.canRequestDuelV75(run),false);
  run=E.advance(E.applyChoice(run,0));canonical(run);
 }
 for(let step=0;step<12&&E.getEvent(run).kind!=='daily';step++)run=E.advance(E.applyChoice(run,0));
 assert.ok(run.turn>=3);assert.equal(E.getEvent(run).kind,'daily');
 assert.equal(E.canRequestDuelV75(run),false);assert.deepEqual(E.getDuelTargetsV75(run),[]);
 assert.ok(E.canRequestDuelV75({...run,flags:{...run.flags,duel75_count:1}}),'the life limit is the only remaining invitation blocker');
 assert.equal(E.requestDuelV75(run,E.getEvent(run).speaker),run);
});

test('actual winning and losing input determines combat before seeded hospital, police and company outcomes',()=>{
 const battle=accepted(36,'wing'),winning=recordedBattle(battle),losing=recordedBattle(battle,()=>({}));
 assert.equal(winning.state.outcome,'win');assert.equal(winning.state.summary.reason,'knockout');
 assert.equal(losing.state.outcome,'lose');assert.equal(losing.state.summary.reason,'knockout');
 for(const record of [winning,losing]){
  const result=E.applyDuelPlayV75(battle,record.input);canonical(result);
  assert.equal(result.history.at(-1).duelOutcome.outcome,record.state.outcome);
  assert.deepEqual(result.history.at(-1).duelOutcome.summary,record.state.summary);
  const returned=finishAftercare(result);assert.equal(returned.turn,battle.turn);
 }
 const severeWin=settleCareerDuelStateV75(battle,winning.input,'系統工程師',()=>0);
 assert.equal(severeWin.duelContextV75.playerStatus,'police');assert.equal(severeWin.duelContextV75.targetStatus,'hospital');
 assert.equal(severeWin.duelContextV75.issue.kind,'approval');assert.match(severeWin.history.at(-1).result,/簽字|簽核/);
 const severeLoss=settleCareerDuelStateV75(battle,losing.input,'系統工程師',()=>0);
 assert.equal(severeLoss.duelContextV75.playerStatus,'hospital');assert.equal(severeLoss.duelContextV75.targetStatus,'police');
 assert.equal(severeLoss.duelContextV75.issue.kind,'approval');
 const separateRolls=[.999,0],uninjuredWinner=settleCareerDuelStateV75(battle,winning.input,'系統工程師',()=>separateRolls.shift());
 assert.equal(uninjuredWinner.duelContextV75.playerStatus,'free');assert.equal(uninjuredWinner.duelContextV75.targetStatus,'hospital');
 const absentBoss=E.getEvent(E.advance(uninjuredWinner));
 assert.match(absentBoss.body,/住院/);assert.doesNotMatch(absentBoss.body,/兩人都沒有被留下/,'a free player does not imply the opponent is also free');
 for(const input of [winning.input,losing.input]){
  const lucky=settleCareerDuelStateV75(battle,input,'系統工程師',()=>.999);
  assert.equal(lucky.duelContextV75.playerStatus,'free');assert.equal(lucky.duelContextV75.targetStatus,'free');assert.equal(lucky.duelContextV75.issue,null);
 }
 assert.equal(duelCompanyIssueV75('jack','hospital').kind,'delivery');
 assert.equal(duelCompanyIssueV75('janet','police').kind,'payroll');
 assert.equal(duelCompanyIssueV75('meimei','hospital').kind,'customer');
 assert.equal(duelCompanyIssueV75('wing','free'),null);
});

test('typed duel history changes only the opponent affinity and counts a real hit only when the player landed damage',()=>{
 const original=source(36),invitation=E.requestDuelV75(original,'wing'),battle=E.advance(invitation);
 const additions=run=>characterHistoryChanges(run).filter(change=>change.historyIndex>=original.history.length);
 assert.deepEqual(additions(invitation).map(({id,realHits,imaginedHits,affinityDelta})=>({id,realHits,imaginedHits,affinityDelta})),[
  {id:'wing',realHits:0,imaginedHits:0,affinityDelta:-3}
 ]);
 for(const [policy,expectedHits] of [[counterplay,1],[()=>({}),0]]){
  const record=recordedBattle(battle,policy),result=E.applyDuelPlayV75(battle,record.input),change=additions(result).at(-1);
  assert.ok(record.state.summary.damageTaken>0||record.state.summary.damageDealt>0);
  assert.equal(change.id,'wing');assert.equal(change.realHits,expectedHits);assert.equal(change.imaginedHits,0);
  assert.equal(change.affinityDelta,expectedHits?-16:-2);
  const returned=finishAftercare(result),rows=additions(returned);
  assert.equal(rows.length,3);assert.ok(rows.every(row=>row.id==='wing'));
  assert.equal(rows.reduce((sum,row)=>sum+row.realHits,0),expectedHits);
  assert.ok([3,-4].includes(rows.at(-1).affinityDelta));
  const before=deriveCharacterStats(original).find(row=>row.id==='wing'),after=deriveCharacterStats(returned).find(row=>row.id==='wing');
  assert.equal(after.realHits,before.realHits+expectedHits);assert.equal(after.encounters,before.encounters+3);
  assert.deepEqual(characterHistoryChanges(copy(returned)),characterHistoryChanges(returned));
 }
 const surrendered=E.applyDuelPlayV75(battle,{frames:'',forfeit:true}),surrenderChange=additions(surrendered).at(-1);
 assert.equal(surrenderChange.realHits,0);assert.equal(surrenderChange.affinityDelta,-2);
 const row=surrendered.history.at(-1),project=entry=>characterHistoryChanges({seed:original.seed,history:[entry]});
 for(const mutate of [r=>r.duelOutcome.version=2,r=>r.speaker='jack',r=>r.duelOutcome.summary.damageDealt=-1,r=>r.duelOutcome.extra=true,r=>delete r.duelOutcome]){
  const forged=copy(row);mutate(forged);assert.deepEqual(project(forged),[]);
 }
 const unrelated=copy(row);unrelated.delta.trust=99;unrelated.delta.boss=99;unrelated.breakdown=[{source:'choice',delta:{trust:99,boss:99}}];
 assert.deepEqual(project(unrelated),project(row),'team trust and boss weather never replace the typed opponent affinity');
 const hiddenInvitation=E.requestDuelV75(E.requestHiddenEncounter(E.replayRun('system','e39-r75-n-00000000000000000000f3',[
  {type:'activity-schedule',version:1},{type:'choice',eventId:'onboarding',index:0},{type:'choice',eventId:'professor37-notebook-server',index:0}
 ])),'hidden-visitor');
 assert.deepEqual(characterHistoryChanges({seed:hiddenInvitation.seed,history:[hiddenInvitation.history.at(-1)]}),[],'the hidden visitor never appears in public per-person counters');
});

test('the rare warehouse encounter can target either co-present person and returns to its still-unanswered scene',()=>{
 const base=E.replayRun('system','e39-r75-n-00000000000000000000f3',[
  {type:'activity-schedule',version:1},{type:'choice',eventId:'onboarding',index:0},{type:'choice',eventId:'professor37-notebook-server',index:0}
 ]),hidden=E.requestHiddenEncounter(base);
 assert.deepEqual(E.getDuelTargetsV75(hidden),['hidden-visitor','wing']);
 for(const target of E.getDuelTargetsV75(hidden)){
  const invite=E.requestDuelV75(hidden,target);canonical(invite);let returned=E.advance(invite);
  if(returned.duelContextV75)returned=finishAftercare(E.applyDuelPlayV75(returned,{frames:'',forfeit:true}));
  assert.deepEqual(returned.hiddenEncounterContext,hidden.hiddenEncounterContext);
  assert.equal(returned.eventId,hidden.eventId);assert.equal(returned.turn,hidden.turn);canonical(returned);
 }
});

test('proof grammar and canonical replay reject invented winners, incomplete recordings, off-scene targets and tampered saves',()=>{
 const run=source(),battle=accepted(),input={frames:'',forfeit:true};
 for(const bad of [null,{},[],{...input,outcome:'win'},{...input,forfeit:1},{...input,frames:'0'},{...input,frames:'90'},{...input,frames:'AF'},{...input,frames:'40'.repeat(DUEL_FRAME_LIMIT_V75+1)}]){
  assert.throws(()=>validateDuelProofV75(bad));assert.throws(()=>E.applyDuelPlayV75(battle,bad));
  const action={type:'duel-play',version:1,eventId:'duel75-battle',input:bad};
  assert.throws(()=>validateCompletion({...proof(battle),actions:[...battle.actions,action]},ROLE_MAP));
 }
 const incomplete={frames:'40',forfeit:false};assert.doesNotThrow(()=>validateDuelProofV75(incomplete));assert.throws(()=>E.applyDuelPlayV75(battle,incomplete));
 for(const action of [{type:'duel-invite',version:1,eventId:run.eventId,target:'wing'},
  {type:'duel-invite',version:1,eventId:'onboarding',target:'simon'},
  {type:'duel-play',version:1,eventId:'duel75-battle',input}])assert.throws(()=>E.replayRun(run.roleId,run.seed,[...run.actions,action]));
 const result=E.applyDuelPlayV75(battle,input);
 for(const mutate of [r=>r.duelContextV75.outcome='win',r=>r.history.at(-1).duelOutcome.playerStatus='hospital',r=>r.stats.cash++,r=>r.duelContextV75.seed+='changed']){
  const altered=copy(result);mutate(altered);assert.equal(E.validRun(altered),false);
 }
 for(const action of [{type:'duel-invite',version:2,eventId:run.eventId,target:'simon'},
  {type:'duel-invite',version:1,eventId:run.eventId,target:'simon',accepted:true},
  {type:'duel-play',version:1,eventId:'duel75-battle',input,outcome:'win'}])assert.throws(()=>validateCompletion({...proof(run),actions:[...run.actions,action]},ROLE_MAP));
 assert.throws(()=>validateCompletion({...proof(battle),seed:battle.seed.replace('r75','r74')},ROLE_MAP));
 const done=recordedBattle(battle),tooLate={frames:done.input.frames+'40',forfeit:false};
 assert.throws(()=>replayCareerDuelV75('simon',battle.duelContextV75.seed,tooLate));
});
