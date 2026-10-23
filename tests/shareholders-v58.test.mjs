import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as E from '../dist/engine.js';
import * as S from '../dist/shareholders-v58.js';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/shareholder-routes-v58.json',import.meta.url),'utf8'));
const copy=value=>JSON.parse(JSON.stringify(value));
const row=id=>{const value=fixture.routes.find(route=>route.id===id);assert.ok(value,id);return value;};
const load=id=>{const route=row(id);return E.replayRun(route.roleId,route.seed,route.actions);};
const choose=(run,index)=>E.advance(E.applyChoice(run,index));
const proof=run=>E.replayRun(run.roleId,run.seed,copy(run.actions));
const press=(statement=0)=>({mode:'press',statement,evidence:null});
const yieldRound=()=>({mode:'yield',statement:0,evidence:null});
const forbidInterrupt=run=>{
 for(const [can,request]of [[E.canRequestBreak,E.requestBreak],[E.canRequestCareer,E.requestCareer],[E.canRequestRaise,E.requestRaise],[E.canRequestActivityInvitation,E.requestActivityInvitation],[E.canRequestHiddenEncounter,E.requestHiddenEncounter]]){
  assert.equal(can(run),false);assert.equal(request(run),run);
 }
 assert.equal(E.requestExit(run),run);assert.equal(E.isWorkGapOpenV50(run),false);
};

test('employee subscription and the shareholder meeting arise in natural new-cohort play, without edited ownership or random state',()=>{
 assert.ok(fixture.offers.length>=12);assert.ok(fixture.gates.length>=12);
 for(const route of fixture.routes){
  assert.match(route.seed,/^e39-cal46-kin49-g-e-s-m-h-[a-f0-9]{6}$/);assert.equal(route.seed.length,32);
  const run=E.replayRun(route.roleId,route.seed,copy(route.actions));assert.equal(S.isShareholderV58(run),true,route.id);assert.equal(E.validRun(run),true,route.id);assert.equal(E.validRun(copy(run)),true,`${route.id}/JSON save`);assert.deepEqual(proof(run),run,route.id);
 }
 const offer=load('offer');assert.equal(offer.eventId,'shareholder58-offer');assert.equal(offer.flags.shareholder58_owned||0,0);
 assert.match(E.getEvent(offer).body,/大企業|企業|入股/);assert.match(E.getEvent(offer).body,/機會|認股/);
 const gate=load('gate');assert.ok([35,50].includes(gate.flags.shareholder58_owned));assert.equal(gate.eventId,'shareholder58-gate');assert.match(E.getEvent(gate).body,/真真/);
 const hearing=load('hearing');assert.ok(hearing.flags.shareholder58_owned>0);assert.ok(hearing.flags.shareholder58_meeting_seen);assert.ok(hearing.flags.shareholder58_attended||hearing.flags.shareholder58_meeting_attended);
});

test('subscription charges the displayed investment exactly once, while declining and timid admission do not create free stock',()=>{
 const route=row('stock-paid'),before=E.replayRun(route.roleId,route.seed,route.beforeActions),after=E.replayRun(route.roleId,route.seed,route.actions),pending=E.applyChoice(before,route.index);
 assert.equal(before.flags.shareholder58_owned||0,0);assert.equal(pending.pending,true);
 assert.equal(before.stats.cash-pending.stats.cash,pending.flags.shareholder58_owned,'paid cash matches recorded investment, not a client ownership flag');
 assert.ok([35,50].includes(pending.flags.shareholder58_owned));assert.equal(pending.flags.shareholder58_purchase_turn,before.turn);
 for(const key of ['turn','pay','pip','pipCount'])assert.deepEqual(pending[key],before[key],key);
 assert.deepEqual(proof(pending),after);assert.equal(E.validRun(pending),true);
 assert.throws(()=>E.applyShareholderPlay(before,press()),'a subscription offer is not a hearing');
 assert.throws(()=>E.replayRun(before.roleId,before.seed,[...after.actions,{type:'choice',eventId:'shareholder58-offer',index:route.index}]),'old offer cannot charge twice');
 const declined=fixture.routes.filter(route=>/^offer-choice-/.test(route.id)).map(route=>E.replayRun(route.roleId,route.seed,route.actions)).filter(run=>!run.flags.shareholder58_owned);
 assert.ok(declined.length>0,'there is a genuine decline path');
 for(const run of declined){assert.equal(E.getShareholderPlayV58(run),null);assert.equal(run.flags.shareholder58_attended||0,0);}
 const denied=fixture.routes.filter(route=>/^gate-choice-/.test(route.id)).map(route=>E.replayRun(route.roleId,route.seed,route.actions)).filter(run=>!E.getShareholderPlayV58(run));
 assert.ok(denied.length>0,'agreeing to leave at the door does not enter the meeting');
 for(const run of denied)assert.equal(E.getShareholderPlayV58(run),null);
 const limited=load('offer-no-upsize');assert.ok(limited.stats.cash>=44&&limited.stats.cash<59);assert.equal(E.getEvent(limited).choices[0].available,true);assert.equal(E.getEvent(limited).choices[1].available,false);assert.throws(()=>E.applyChoice(limited,1),'an unavailable upsized subscription cannot spend the protected living allowance');
});

test('the holding badge waits for the player to decide at the meeting door before reporting non-attendance',()=>{
 const waiting=load('stock-paid'),gate=load('gate'),snapshot=copy(gate);
 assert.equal(S.getShareholderStatusV58(waiting).label,'已認股，等候股東會安排');
 assert.equal(S.getShareholderStatusV58(gate).label,'收到股東會通知，正在確認出席');
 assert.equal(S.getShareholderStatusV58(gate).attended,false);
 assert.doesNotMatch(S.getShareholderStatusV58(gate).label,/未親自出席|已親自出席/,'the unresolved door choice cannot forecast admission or rejection');
 assert.deepEqual(gate,snapshot,'reading the badge leaves the uncommitted decision untouched');
 const declined=E.applyChoice(gate,0);
 assert.equal(declined.pending,true);assert.equal(S.getShareholderStatusV58(declined).label,'已認股，這次未親自出席','the confirmed soft refusal can be shown while its result is open');
 const returned=E.advance(copy(declined));
 assert.equal(returned.shareholderContext,undefined);assert.equal(S.getShareholderStatusV58(returned).label,'已認股，這次未親自出席');
 for(const index of [1,2]){
  const admitted=E.applyChoice(gate,index);assert.equal(S.getShareholderStatusV58(admitted).label,'已親自出席股東會');assert.equal(S.getShareholderStatusV58(E.advance(admitted)).label,'已親自出席股東會');
 }
});

test('all four cross-examinations offer statements and documents without exposing answers or drawing a result on read',()=>{
 for(let round=0;round<4;round++){
  const source=load(`round-${round}`),snapshot=copy(source),play=E.getShareholderPlayV58(source);
  assert.ok(play);assert.equal(play.round,round);assert.equal(play.eventId,source.eventId);assert.equal(play.version,1);
  assert.equal(play.statements.length,3);assert.ok(play.evidence.length>=3);assert.ok(play.jackHint.length>8);
  assert.ok(play.statements.every((statement,index)=>statement.id===index&&typeof statement.text==='string'&&statement.text.length>8));
  assert.ok(play.evidence.every(file=>typeof file.id==='string'&&file.title.length>2&&file.body.length>8));
  assert.doesNotMatch(JSON.stringify(play),/correct(?:Index|Evidence|Statement)?|answer|successRate|winChance|guaranteed|機率\s*\d|好感\s*[+-]\d/);
  for(let read=0;read<4;read++)assert.deepEqual(E.getShareholderPlayV58(source),play);
  assert.deepEqual(source,snapshot,'opening a document is presentation only');
  assert.equal(E.getShareholderPlayV58({...source,pending:true}),null);assert.equal(E.getShareholderPlayV58({...source,completed:true}),null);
  assert.deepEqual(E.getEvent(source).choices,[],'normal number choices cannot bypass evidence selection');
  forbidInterrupt(source);
 }
});

test('pressing testimony records one bounded raw action, reveals feedback and survives refresh without charging work, PIP or another subscription',()=>{
 const source=load('hearing'),snapshot=copy(source),input=press(),pending=E.applyShareholderPlay(source,input),last=pending.history.at(-1);
 assert.deepEqual(source,snapshot);assert.equal(pending.pending,true);assert.equal(pending.actions.length,source.actions.length+1);
 assert.deepEqual(pending.actions.at(-1),{type:'shareholder-play',version:1,eventId:source.eventId,input});
 assert.ok(last.result.length>20);assert.equal(E.validRun(pending),true);assert.equal(E.validRun(copy(pending)),true);forbidInterrupt(pending);
 for(const key of ['turn','pay','pip','pipCount'])assert.deepEqual(pending[key],source[key],key);
 assert.equal(pending.stats.cash,source.stats.cash);assert.equal(pending.flags.shareholder58_owned,source.flags.shareholder58_owned);
 assert.throws(()=>E.applyShareholderPlay(pending,input),'a revealed result cannot submit a second answer');
 const after=E.advance(copy(pending));assert.deepEqual(proof(pending),after);assert.equal(after.rng,pending.rng,'Continue cannot draw the same consequence again');
 assert.equal(E.validRun(after),true);assert.ok(E.getShareholderPlayV58(after).statements[0].pressed);
 assert.throws(()=>E.applyShareholderPlay(after,input),'the same statement cannot be pressed repeatedly');
 assert.throws(()=>E.replayRun(after.roleId,after.seed,[...after.actions,pending.actions.at(-1)]),'server replay refuses repeated press');
 let run=after;
 for(const statement of [1,2])run=E.advance(E.applyShareholderPlay(run,press(statement)));
 const play=E.getShareholderPlayV58(run);assert.ok(play.statements.every(statement=>statement.pressed));assert.ok(run.actions.length<=source.actions.length+3);
 assert.ok(E.getShareholderPlayV58(E.advance(E.applyShareholderPlay(run,yieldRound()))).round>0,'a witness with every line pressed still has an exit');
});

test('four rounds and final minutes return to the exact suspended work event, without adding a day or completing this life',()=>{
 for(const policy of ['prepared','wrong','yield']){
  const before=load('hearing'),finished=load(`finish-${policy}`),returned=load(`returned-${policy}`);
  assert.equal(finished.eventId,'shareholder58-finish');assert.equal(finished.completed,false);assert.equal(E.getShareholderPlayV58(finished),null);forbidInterrupt(finished);
  assert.equal(returned.shareholderContext,undefined);assert.equal(returned.completed,false);assert.ok(returned.flags.shareholder58_owned>0);
  for(const key of ['turn','pay','pip','pipCount'])assert.deepEqual(returned[key],before[key],`${policy}/${key}`);
  assert.equal(returned.stats.cash,before.stats.cash,'a prepared or bad argument cannot mint money or recharge admission');
  assert.equal(returned.eventId,before.shareholderContext.returnEventId);assert.equal(E.validRun(returned),true);assert.deepEqual(proof(returned),returned);
  assert.ok(returned.history.some(history=>history.kind==='shareholder'||history.shareholderOutcome),'the result remains in the ordinary player ledger');
 }
 assert.notDeepEqual(load('finish-prepared').history.at(-1),load('finish-wrong').history.at(-1),'document choices affect the meeting');
});

test('gathering a missing attachment is necessary, three bad objections close the case and yielding remains a bounded alternative',()=>{
 const source=load('hearing');assert.throws(()=>E.applyShareholderPlay(source,{mode:'present',statement:0,evidence:'investment'}),'a correct document ID alone cannot substitute for acquiring the attachment');
 let run=source;
 for(let mistake=0;mistake<3;mistake++){
  run=E.advance(E.applyShareholderPlay(run,{mode:'present',statement:0,evidence:'receipt'}));
  assert.equal(run.shareholderContext.credibility,2-mistake);assert.equal(E.validRun(run),true);
 }
 assert.equal(run.eventId,'shareholder58-finish');assert.equal(run.shareholderContext.result,'ejected');assert.equal(run.actions.length,source.actions.length+3);assert.equal(run.completed,false);assert.equal(run.flags.shareholder58_owned,source.flags.shareholder58_owned);
 assert.throws(()=>E.applyShareholderPlay(run,press()),'the closed case cannot farm another result');
 for(const [policy,result]of Object.entries({prepared:'minutes',partial:'followup',yield:'adjourned',wrong:'ejected'})){
  const finished=load(`finish-${policy}`);assert.equal(finished.flags.shareholder58_finished,1);assert.equal(finished.flags.shareholder58_result,result);assert.equal(finished.flags[`shareholder58_result_${result}`],1);assert.equal(finished.shareholderContext.result,result);assert.equal(finished.stats.energy,source.stats.energy,'an evidence puzzle cannot cause an unannounced energy collapse');
 }
 assert.equal(load('finish-yield').actions.length,source.actions.length+4,'four yields end the four-round meeting rather than cycling forever');
});

test('pending personnel decisions, active PIP, activities and warning rest keep their own screen until their existing flow finishes',()=>{
 for(const id of ['guard-pip','guard-activity','guard-rest','guard-invitation']){
  const source=load(id);assert.equal(source.shareholderContext,undefined,id);assert.equal(E.getShareholderPlayV58(source),null,id);
  for(const [index,choice]of E.getEvent(source).choices.entries())if(choice.available!==false){
   const pending=E.applyChoice(source,index);assert.equal(pending.shareholderContext,undefined,`${id}/pending`);assert.equal(E.getShareholderPlayV58(pending),null,id);
   const next=E.advance(pending);
   if(next.pip?.active||next.activityContext||next.activityInvitationContext||next.breakReturnEventId||next.pending||next.completed)assert.equal(next.shareholderContext,undefined,`${id}/continuation`);
   assert.equal(E.validRun(next),true,`${id}/save`);
  }
 }
});

test('forged stock, context, evidence, verdict or stale event fails exact save and replay validation',()=>{
 const source=load('hearing'),input=press(),valid={type:'shareholder-play',version:1,eventId:source.eventId,input};
 for(const index of [0,1,2])assert.throws(()=>E.applyChoice(source,index));
 for(const patch of [{version:2},{version:'1'},{eventId:'shareholder58-hearing-3'},{index:0},{score:999},{result:'win'},{input:{...input,correct:true}}])assert.throws(()=>E.replayRun(source.roleId,source.seed,[...source.actions,{...valid,...patch}]));
 const pending=E.applyShareholderPlay(source,input);
 for(const mutate of [run=>run.flags.shareholder58_owned=999,run=>run.stats.cash=(run.stats.cash+1)%101,run=>run.shareholderContext.round=3,run=>run.history.at(-1).result+=' forged',run=>run.actions.at(-1).input.statement=2]){const forged=copy(pending);mutate(forged);assert.equal(E.validRun(forged),false);}
 for(const id of ['offer','stock-paid','gate','returned-prepared']){
  const before=load(id);assert.throws(()=>E.applyShareholderPlay(before,input),id);assert.throws(()=>E.replayRun(before.roleId,before.seed,[...before.actions,{...valid,eventId:before.eventId}]),id);
 }
});

test('published activity, PIP and warning lives retain their exact pre-shareholder save hashes',()=>{
 const old=JSON.parse(readFileSync(new URL('./fixtures/energy-safety-routes-v54.json',import.meta.url),'utf8')).routes;
 const hashes={'activity-return-arm':'53a43ccecd5e22e0438e3ad483a651b74a4269294633e528b29755a605ed24e5','activity-return-basketball':'6ba25b861eb2d7cd39fd2f55b75f8b76c0336708ff9e6af1bf4774b896d11713','pip-start-gap':'ffc8ea151761421eb071f74c7c89a90decb37c4b7f214478356c8a56368c14a1','owed-floor':'f67c5e330f565e518607e54f11e7f79d8fedd3990f0ddd40cd78dc60af111602'};
 for(const [id,expected]of Object.entries(hashes)){
  const route=old.find(route=>route.id===id),run=E.replayRun(route.roleId,route.seed,route.actions);assert.equal(S.isShareholderV58(run),false);assert.equal(E.getShareholderPlayV58(run),null);assert.equal(run.shareholderContext,undefined);assert.equal(E.validRun(run),true);assert.equal(createHash('sha256').update(JSON.stringify(run)).digest('hex'),expected,id);
 }
});
