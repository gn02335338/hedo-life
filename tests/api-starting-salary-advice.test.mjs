import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {AchievementStore} from '../worker/achievements.js';
import {CharacterStore} from '../worker/characters.js';
import {FeedbackStore} from '../worker/feedback-store.js';
import {ObservationStore} from '../worker/observations.js';
import {validateFeedback,validatePublisherToken} from '../worker/feedback.js';
import * as http from '../worker/http.js';
import * as engine from '../dist/engine.js';
import {ROLE_MAP} from '../dist/roles.js';
import {ENDINGS} from '../dist/endings.js';
import {deriveCharacterStats,CHARACTER_IDS,CHARACTER_METRICS} from '../dist/character-stats.js';
import {deriveAchievements} from '../dist/achievements.js';

const source=readFileSync(new URL('../worker/index.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export class HedoArchive','globalThis.HedoArchive=class HedoArchive').replace('export default','globalThis.worker=');
const proof=(route,runId=randomUUID(),actions=route.actions)=>({runId,roleId:route.roleId,seed:route.seed,actions});
const ids=response=>response.body.achievements.map(row=>row.id);
const replay=(route,actions=route.actions)=>engine.replayRun(route.roleId,route.seed,actions);
const {routes}=JSON.parse(readFileSync(new URL('./fixtures/starting-salary-advice-routes.json',import.meta.url),'utf8'));
const replies=routes.filter(route=>route.kind==='reply').sort((a,b)=>a.index-b.index);
const oldCuts=JSON.parse(readFileSync(new URL('./fixtures/lowpay-routes-v24.json',import.meta.url),'utf8')).routes;

// Use real Worker handlers and isolated SQLite; no test records leave the
// process and all salary, history and achievement facts come from replay.
function harness(t){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());db.exec('PRAGMA foreign_keys = ON');
 const sql={exec(query,...args){let rows=[];if(!args.length&&query.includes(';'))db.exec(query);else{const statement=db.prepare(query);if(statement.columns().length)rows=statement.all(...args);else statement.run(...args);}return{toArray:()=>rows,one:()=>{assert.equal(rows.length,1);return rows[0];}};}};
 const storage={sql,transactionSync(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}},async getAlarm(){return null;},async setAlarm(){}};
 const scope=vm.createContext({DurableObject:class{constructor(ctx){this.ctx=ctx;}},replayRun:engine.replayRun,VERSION:engine.VERSION,MAX_TURNS:engine.MAX_TURNS,ROLE_MAP,ENDINGS,...http,validateFeedback,validatePublisherToken,FeedbackStore,AchievementStore,CharacterStore,ObservationStore,crypto,Response,Request,URL,Date});
 vm.runInContext(source,scope);const archive=new scope.HedoArchive({storage,blockConcurrencyWhile:fn=>fn()},{});
 const call=async(path,{method='GET',token,body}={})=>{
  archive.rate=new http.RateGuard();const headers={};if(token)headers.Authorization=`Bearer ${token}`;if(body)headers['Content-Type']='application/json';
  const response=await archive.fetch(new Request(`https://game.example${path}`,{method,headers,body:body?JSON.stringify(body):undefined}));return{status:response.status,body:await response.json()};
 };
 const register=async()=>{const token=randomBytes(32).toString('hex'),response=await call('/api/player',{method:'POST',body:{token}});assert.equal(response.status,200);return{token,id:response.body.playerId};};
 const post=(player,route,runId,actions=route.actions,path='/api/achievements',extra={})=>call(path,{method:'POST',token:player.token,body:{...proof(route,runId,actions),...extra}});
 return{sql,call,register,post};
}

test('all three starting-pay replies extend a previously recorded prefix, then complete and deduplicate verified collections',async t=>{
 const h=harness(t),totals=Object.fromEntries(CHARACTER_IDS.map(id=>[id,Object.fromEntries(CHARACTER_METRICS.map(metric=>[metric,0]))]));
 assert.deepEqual(replies.map(route=>route.index),[0,1,2]);
 for(const route of replies){
  const player=await h.register(),runId=randomUUID(),before=replay(route,route.beforeActions),open=replay(route,route.openActions),resolved=replay(route);
  assert.ok(engine.createRun(route.roleId,route.seed).pay<30);assert.ok(before.pay<30);assert.equal(engine.canRequestSalaryAdvice(before),true);
  assert.equal(open.eventId,'low-pay-tip');assert.equal(open.salaryAdvice.origin,'starting-pay');assert.equal(open.salaryAdvice.status,'open');
  const recorded=await h.post(player,route,runId,route.beforeActions,'/api/characters');
  assert.equal(recorded.status,200);assert.deepEqual(recorded.body.characters,deriveCharacterStats(before));
  const opened=await h.post(player,route,runId,route.openActions);
  assert.equal(opened.status,200,'an existing action commitment can extend with the new advisory action');
  assert.equal(opened.body.playerId,player.id);assert.equal(opened.body.totalRuns,0);assert.equal(opened.body.verified,true);
  assert.deepEqual(opened.body.characters,recorded.body.characters,'opening a conversation is not a resolved character encounter');
  assert.deepEqual([...ids(opened)].sort(),[...deriveAchievements(open)].sort());
  const earned=await h.post(player,route,runId);
  assert.equal(earned.status,200,route.id);assert.equal(earned.body.totalRuns,0);assert.equal(earned.body.playerId,player.id);
  assert.deepEqual(earned.body.characters,deriveCharacterStats(resolved));assert.deepEqual([...ids(earned)].sort(),[...deriveAchievements(resolved)].sort());
  assert.equal(resolved.salaryAdvice.origin,'starting-pay');assert.equal(resolved.salaryAdvice.status,'done');
  assert.equal(resolved.history.filter(row=>row.eventId==='low-pay-tip').length,1);
  const erichBefore=recorded.body.characters.find(row=>row.id==='erich'),erichAfter=earned.body.characters.find(row=>row.id==='erich');
  assert.equal(erichAfter.encounters,erichBefore.encounters+1);
  for(const row of earned.body.characters.filter(row=>row.id!=='erich'))assert.deepEqual(row,recorded.body.characters.find(old=>old.id===row.id));
  for(const endpoint of ['/api/characters','/api/achievements','/api/achievements']){
   const repeated=await h.post(player,route,runId,route.actions,endpoint);
   assert.equal(repeated.status,200);assert.deepEqual(repeated.body.characters,earned.body.characters);assert.deepEqual(repeated.body.achievements,earned.body.achievements);
   if(endpoint==='/api/achievements')assert.deepEqual(repeated.body.newlyUnlocked,[]);
  }
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM runs WHERE player_id=?',player.id).one().n,0);
  const complete=replay(route,route.completionActions),receipt=await h.post(player,route,runId,route.completionActions,'/api/complete');
  assert.equal(complete.completed,true);assert.equal(receipt.status,200,route.id);assert.equal(receipt.body.endingId,route.endingId);assert.equal(receipt.body.totalRuns,1);
  assert.equal(receipt.body.playerId,player.id);assert.equal(receipt.body.duplicate,false);assert.deepEqual(receipt.body.characters,deriveCharacterStats(complete));
  for(const badge of earned.body.achievements)assert.equal(receipt.body.achievements.find(row=>row.id===badge.id)?.unlockedAt,badge.unlockedAt);
  const duplicate=await h.post(player,route,runId,route.completionActions,'/api/complete');
  assert.equal(duplicate.status,200);assert.equal(duplicate.body.duplicate,true);assert.equal(duplicate.body.totalRuns,1);assert.deepEqual(duplicate.body.characters,receipt.body.characters);assert.deepEqual(duplicate.body.achievements,receipt.body.achievements);
  const older=await h.post(player,route,runId,route.beforeActions,'/api/characters');assert.equal(older.status,200);assert.deepEqual(older.body.characters,receipt.body.characters);
  for(const row of receipt.body.characters)for(const metric of CHARACTER_METRICS)totals[row.id][metric]+=row[metric];
 }
 const global=await h.call('/api/characters');for(const row of global.body.characters)for(const metric of CHARACTER_METRICS)assert.equal(row[metric],totals[row.id][metric],`${row.id}/${metric}`);
 assert.equal((await h.call('/api/stats')).body.totalRuns,3);assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM runs').one().n,3);
 assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM player_endings').one().n,3);
});

test('the HTTP action envelope accepts only a type-only salary-advice action for existing e28 through e31 cohorts',async t=>{
 const h=harness(t),player=await h.register(),positive=routes.filter(route=>/^cohort-e(?:28|29|30|31)$/.test(route.id));
 assert.deepEqual(positive.map(route=>route.seed.match(/^e\d+/)[0]).sort(),['e28','e29','e30','e31']);
 for(const route of positive){
  const payload=proof(route,randomUUID(),route.openActions);assert.deepEqual(http.validateCompletion(payload,ROLE_MAP),payload);
  const response=await h.post(player,route,payload.runId,route.openActions);assert.equal(response.status,200,route.id);
 }
 const route=replies[0],before=await h.call('/api/me',{token:player.token});
 for(const extra of [{pay:1},{origin:'starting-pay'},{eventId:'low-pay-tip'},{index:0},{result:'invented'},{history:[]},{returnEventId:'fake'}]){
  const actions=[...route.beforeActions,{type:'salary-advice',...extra}],payload=proof(route,randomUUID(),actions);
  assert.throws(()=>http.validateCompletion(payload,ROLE_MAP),error=>error.status===400&&error.code==='invalid_actions');
  const response=await h.post(player,route,payload.runId,actions);assert.equal(response.status,400);assert.equal(response.body.error,'invalid_actions');
 }
 for(const seed of ['old-advice','e24-advice','e27-advice','e37-advice']){
  const payload={runId:randomUUID(),roleId:'system',seed,actions:[{type:'salary-advice'}]};
  const response=await h.call('/api/achievements',{method:'POST',token:player.token,body:payload});assert.equal(response.status,400);assert.equal(response.body.error,'invalid_actions');
 }
 assert.deepEqual((await h.call('/api/me',{token:player.token})).body,before.body);
});

test('natural low-pay occupations wait through urgent HR or mood scenes, while an ordinary PIP work scene can ask without using a PIP day',async t=>{
 const h=harness(t);
 const selected=routes.filter(route=>/^(?:admin-2[789]|assistant-low|active-pip|deferred-(?:hr|mood))$/.test(route.id));
 assert.equal(selected.length,7);
 for(const route of selected){
  const player=await h.register(),runId=randomUUID(),before=replay(route),initial=await h.post(player,route,runId);
  assert.equal(initial.status,200,route.id);
  if(route.kind==='deferred'){
   assert.equal(engine.canRequestSalaryAdvice(before),false);
   const denied=await h.post(player,route,runId,[...route.actions,{type:'salary-advice'}]);assert.equal(denied.status,400);assert.equal(denied.body.error,'invalid_replay');
   assert.deepEqual((await h.call('/api/me',{token:player.token})).body.characters,initial.body.characters);
  }
  const open=replay(route,route.openActions),safe=replay(route,route.openActions.slice(0,-1));
  assert.equal(engine.canRequestSalaryAdvice(safe),true);assert.equal(open.salaryAdvice.origin,'starting-pay');assert.equal(open.salaryAdvice.status,'open');
  assert.equal(open.eventId,'low-pay-tip');assert.equal(open.turn,safe.turn);assert.equal(open.rng,safe.rng);assert.deepEqual(open.pip,safe.pip);assert.deepEqual(open.stats,safe.stats);assert.deepEqual(open.seen,safe.seen);
  const opened=await h.post(player,route,runId,route.openActions);assert.equal(opened.status,200,route.id);assert.deepEqual(opened.body.characters,deriveCharacterStats(safe));
  if(route.id==='active-pip')assert.equal(safe.pip.active,true);
  const responseActions=[...route.openActions,{type:'choice',eventId:'low-pay-tip',index:0}],resumed=replay(route,responseActions),reply=await h.post(player,route,runId,responseActions);
  assert.equal(reply.status,200);assert.equal(resumed.turn,safe.turn);assert.deepEqual(resumed.pip,safe.pip);assert.equal(resumed.eventId,safe.eventId);assert.equal(resumed.salaryAdvice.status,'done');
  assert.equal(reply.body.characters.find(row=>row.id==='erich').encounters,opened.body.characters.find(row=>row.id==='erich').encounters+1);
  assert.equal(reply.body.totalRuns,0);
 }
});

test('a committed onboarding remains the starting-pay proof after an earlier dream or verbal response',async t=>{
 const h=harness(t),selected=routes.filter(route=>/^onboarding-after-(?:dream|verbal)$/.test(route.id));assert.equal(selected.length,2);
 for(const route of selected){
  const player=await h.register(),runId=randomUUID(),before=replay(route),onboarding=before.history.find(row=>row.eventId==='onboarding');
  assert.ok(onboarding);assert.notEqual(before.history[0].eventId,'onboarding');assert.ok(onboarding.pay<30);assert.equal(engine.canRequestSalaryAdvice(before),true);
  const recorded=await h.post(player,route,runId);assert.equal(recorded.status,200,route.id);
  const open=replay(route,route.openActions),response=await h.post(player,route,runId,route.openActions);
  assert.equal(response.status,200,route.id);assert.equal(open.salaryAdvice.from,onboarding.pay);assert.equal(open.salaryAdvice.origin,'starting-pay');assert.deepEqual(response.body.characters,recorded.body.characters);
  const replyActions=[...route.openActions,{type:'choice',eventId:'low-pay-tip',index:0}],resolved=replay(route,replyActions),reply=await h.post(player,route,runId,replyActions);
  assert.equal(reply.status,200);assert.deepEqual(reply.body.characters,deriveCharacterStats(resolved));assert.equal(resolved.salaryAdvice.status,'done');
 }
});

test('30K and higher, incomplete onboarding, nested menus, duplicate advice and invented tip choices are rejected without storage changes',async t=>{
 const h=harness(t),player=await h.register(),route=replies[0],before=replay(route,route.beforeActions),breakRun=engine.requestBreak(before);
 assert.notEqual(breakRun,before);assert.equal(engine.canRequestSalaryAdvice(breakRun),false);
 const invalid=[
  {...route,actions:[{type:'salary-advice'}]},
  {...route,actions:[...breakRun.actions,{type:'salary-advice'}]},
  {...route,actions:[...route.openActions,{type:'salary-advice'}]},
  {...route,actions:[...route.actions,{type:'salary-advice'}]},
  {...route,actions:[...route.completionActions,{type:'salary-advice'}]},
  {...route,actions:[...route.beforeActions,{type:'choice',eventId:'low-pay-tip',index:0}]},
 ];
 const boundaries=routes.filter(row=>row.kind==='boundary'&&row.expected.pay>=30);assert.ok(boundaries.some(row=>row.startPay===30));assert.ok(boundaries.some(row=>row.startPay<30),'a low starter who has already reached 30K is ineligible too');
 for(const boundary of boundaries){const run=replay(boundary);assert.equal(engine.canRequestSalaryAdvice(run),false);invalid.push({...boundary,actions:[...boundary.actions,{type:'salary-advice'}]});}
 const untouched=await h.call('/api/me',{token:player.token});
 for(const item of invalid){
  const response=await h.post(player,item,randomUUID());assert.equal(response.status,400,item.id);assert.equal(response.body.error,'invalid_replay');
 }
 assert.deepEqual((await h.call('/api/me',{token:player.token})).body,untouched.body);
 for(const table of ['runs','achievement_runs','character_runs'])assert.equal(h.sql.exec(`SELECT COUNT(*) AS n FROM ${table}`).one().n,0);
});

test('client pay, advisory state, history and choice results are never authoritative replay evidence',async t=>{
 const h=harness(t),player=await h.register(),route=replies[0],runId=randomUUID(),before=replay(route,route.beforeActions);
 const fake={pay:1,salaryAdvice:{from:100,to:1,historyIndex:0,origin:'starting-pay',status:'done',returnEventId:null},
  achievements:['real-hit-erich'],characters:[{id:'erich',encounters:9999,realHits:9999}],
  history:[{eventId:'low-pay-tip',kind:'crisis',speaker:'erich',choiceIndex:0,pay:1,result:'FORGED_ADVICE_RESULT'}],
 };
 const baseline=await h.post(player,route,runId,route.beforeActions,'/api/achievements',fake);
 assert.equal(baseline.status,200);assert.deepEqual(baseline.body.characters,deriveCharacterStats(before));assert.deepEqual([...ids(baseline)].sort(),[...deriveAchievements(before)].sort());
 const injected=route.actions.map(action=>action.type==='choice'&&action.eventId==='low-pay-tip'?{...action,pay:1,result:'FORGED_ADVICE_RESULT',salaryAdvice:fake.salaryAdvice}:action);
 const resolved=replay(route),response=await h.post(player,route,runId,injected,'/api/achievements',fake);
 assert.equal(response.status,200);assert.deepEqual(response.body.characters,deriveCharacterStats(resolved));assert.deepEqual([...ids(response)].sort(),[...deriveAchievements(resolved)].sort());
 assert.ok(!JSON.stringify(response.body).includes('FORGED_ADVICE_RESULT'));
 const retry=await h.post(player,route,runId);assert.equal(retry.status,200);assert.deepEqual(retry.body.newlyUnlocked,[]);assert.deepEqual(retry.body.characters,response.body.characters);
 const retained=JSON.stringify([...h.sql.exec('SELECT * FROM achievement_runs').toArray(),...h.sql.exec('SELECT * FROM character_runs').toArray()]);
 for(const secret of [route.seed,player.token,'FORGED_ADVICE_RESULT','low-pay-tip','starting-pay'])assert.ok(!retained.includes(secret));
});

test('a recorded advisory reply binds its owner and branch while allowing the valid continuation',async t=>{
 const h=harness(t),player=await h.register(),other=await h.register(),route=replies[0],fork=replies[1],runId=randomUUID();
 assert.equal(fork.seed,route.seed);assert.deepEqual(fork.beforeActions,route.beforeActions);
 assert.equal((await h.post(player,route,runId,route.beforeActions,'/api/characters')).status,200);
 assert.equal((await h.post(player,route,runId,route.openActions)).status,200);
 const first=await h.post(player,route,runId);assert.equal(first.status,200);
 assert.equal((await h.post(player,fork,runId)).status,409,'same-length branch replacement is rejected');
 const longerFork=[...fork.actions,{type:'exit'},{type:'choice',eventId:'exit-menu',index:0}];
 assert.doesNotThrow(()=>replay(fork,longerFork));
 assert.equal((await h.post(player,fork,runId,longerFork)).status,409,'longer proofs cannot overwrite an already committed choice');
 for(const endpoint of ['/api/characters','/api/achievements'])assert.equal((await h.post(other,route,runId,route.actions,endpoint)).status,409);
 const after=await h.call('/api/me',{token:player.token});assert.deepEqual(after.body.characters,first.body.characters);assert.deepEqual(after.body.achievements,first.body.achievements);
 const isolated=await h.call('/api/me',{token:other.token});assert.equal(isolated.body.totalRuns,0);assert.deepEqual(isolated.body.achievements,[]);assert.ok(isolated.body.characters.every(row=>CHARACTER_METRICS.every(metric=>row[metric]===0)));
 const completed=await h.post(player,route,runId,route.completionActions,'/api/complete');assert.equal(completed.status,200);assert.equal(completed.body.totalRuns,1);
 assert.equal((await h.post(other,route,runId,route.completionActions,'/api/complete')).status,409);
});

test('legacy accepted-cut advice remains a distinct five-key replay with no new starting-pay action',async t=>{
 const h=harness(t),old=oldCuts.find(row=>row.id==='tip-choice-0');assert.ok(old);
 const published=JSON.parse(readFileSync(new URL('./fixtures/legacy-e31-routes.json',import.meta.url),'utf8')).find(row=>row.actions.some(action=>action.eventId==='low-pay-tip')&&engine.createRun(row.roleId,row.seed).pay>=30);assert.ok(published);
 const tipIndex=published.actions.findIndex(action=>action.eventId==='low-pay-tip');
 const modern={...published,actions:published.actions.slice(0,tipIndex+1),completionActions:published.actions};
 for(const route of [old,modern]){
  const player=await h.register(),runId=randomUUID(),index=route.actions.findIndex(action=>action.eventId==='low-pay-tip'),openActions=route.actions.slice(0,index),open=replay(route,openActions);
  assert.equal(open.eventId,'low-pay-tip');assert.ok(open.salaryAdvice.from>open.salaryAdvice.to);
  assert.deepEqual(Object.keys(open.salaryAdvice).sort(),['from','historyIndex','returnEventId','status','to']);
  assert.ok(!route.actions.some(action=>action.type==='salary-advice'));assert.equal(engine.canRequestSalaryAdvice(open),false);
  const original=JSON.stringify(open),initial=await h.post(player,route,runId,openActions);assert.equal(initial.status,200);assert.equal(JSON.stringify(replay(route,openActions)),original);
  const duplicateAdvice=await h.post(player,route,runId,[...openActions,{type:'salary-advice'}]);assert.equal(duplicateAdvice.status,400);
  const earned=await h.post(player,route,runId);assert.equal(earned.status,200);assert.deepEqual(earned.body.characters,deriveCharacterStats(replay(route)));
  const completed=await h.post(player,route,runId,route.completionActions,'/api/complete');assert.equal(completed.status,200);assert.equal(completed.body.totalRuns,1);
 }
});
