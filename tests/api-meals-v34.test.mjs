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
import {CHARACTER_IDS,CHARACTER_METRICS,deriveCharacterStats} from '../dist/character-stats.js';
import {deriveAchievements} from '../dist/achievements.js';
import {MEAL_GUEST_IDS_V25} from '../dist/meals-v25.js';

const source=readFileSync(new URL('../worker/index.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export class HedoArchive','globalThis.HedoArchive=class HedoArchive').replace('export default','globalThis.worker=');
const {routes}=JSON.parse(readFileSync(new URL('./fixtures/meal-invitations-v34.json',import.meta.url),'utf8'));
const proof=(route,runId,actions=route.actions)=>({runId,roleId:route.roleId,seed:route.seed,actions});

function harness(t){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());db.exec('PRAGMA foreign_keys = ON');
 const sql={exec(query,...args){let rows=[];if(!args.length&&query.includes(';'))db.exec(query);else{const statement=db.prepare(query);if(statement.columns().length)rows=statement.all(...args);else statement.run(...args);}return{toArray:()=>rows,one:()=>{assert.equal(rows.length,1);return rows[0];}};}};
 const storage={sql,transactionSync(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}},async getAlarm(){return null;},async setAlarm(){}};
 const context=vm.createContext({DurableObject:class{constructor(ctx){this.ctx=ctx;}},replayRun:engine.replayRun,VERSION:engine.VERSION,MAX_TURNS:engine.MAX_TURNS,ROLE_MAP,ENDINGS,...http,validateFeedback,validatePublisherToken,FeedbackStore,AchievementStore,CharacterStore,ObservationStore,crypto,Response,Request,URL,Date});
 vm.runInContext(source,context);const archive=new context.HedoArchive({storage,blockConcurrencyWhile:fn=>fn()},{ });
 const call=async(path,{method='GET',token,body}={})=>{
  archive.rate=new http.RateGuard();const headers={};if(token)headers.Authorization=`Bearer ${token}`;if(body)headers['Content-Type']='application/json';
  const response=await archive.fetch(new Request(`https://game.example${path}`,{method,headers,body:body?JSON.stringify(body):undefined}));return{status:response.status,body:await response.json()};
 };
 const register=async()=>{const token=randomBytes(32).toString('hex'),response=await call('/api/player',{method:'POST',body:{token}});assert.equal(response.status,200);return{token,id:response.body.playerId};};
 const post=(player,route,runId,actions=route.actions,path='/api/characters',extra={})=>call(path,{method:'POST',token:player.token,body:{...proof(route,runId,actions),...extra}});
 return{sql,call,register,post};
}

function beforeInvitation(route){
 for(let index=route.actions.length-1;index>=0;index--){
  const action=route.actions[index];if(action.type!=='choice'||!/^meal-guests-[ab]$/.test(action.eventId))continue;
  const run=engine.replayRun(route.roleId,route.seed,route.actions.slice(0,index));
  if(engine.getEvent(run).choices[action.index]?.mealTarget===route.guest)return run;
 }
 throw new Error(`Missing ${route.id} invitation`);
}
function assertProjection(response,run,badges=false){
 assert.equal(response.status,200);assert.deepEqual(response.body.characters,deriveCharacterStats(run));
 if(badges)assert.deepEqual(response.body.achievements.map(row=>row.id).sort(),deriveAchievements(run).sort());
}

test('all sixteen e34 meal acceptance/refusal replies verify anonymously without charging or creating physical encounters',async t=>{
 const h=harness(t),covered=new Set();
 for(const guest of MEAL_GUEST_IDS_V25)for(const outcome of ['accepted','declined']){
  const route=routes.find(row=>row.guest===guest&&row.outcome===outcome);assert.ok(route,`${guest}/${outcome}`);covered.add(`${guest}/${outcome}`);
  const before=beforeInvitation(route),run=engine.replayRun(route.roleId,route.seed,route.actions);
  assert.equal(engine.validRun(run),true);assert.equal(run.stats.cash,before.stats.cash);assert.equal(run.turn,before.turn);
  assert.deepEqual(deriveCharacterStats(run),deriveCharacterStats(before),'invitation messages do not become physical dinner encounters');
  const player=await h.register(),runId=randomUUID(),extra={stats:{cash:100,mood:100},characters:[{id:guest,encounters:9999,realHits:9999}],mealContext:{guest},flags:{meal_shared:999},outcome:'accepted'};
  const progress=await h.post(player,route,runId,route.actions,'/api/characters',extra);assertProjection(progress,run);
  assert.equal(progress.body.totalRuns,0);
  const retry=await h.post(player,route,runId);assertProjection(retry,run);assert.deepEqual(retry.body.characters,progress.body.characters);
  const badges=await h.post(player,route,runId,route.actions,'/api/achievements',extra);assertProjection(badges,run,true);
  if(outcome==='declined'){
   assert.match(run.eventId,/^meal-guests-[ab]$/);assert.equal(run.mealContext.guest,null);
   const invented=await h.post(player,route,runId,[...route.actions,{type:'choice',eventId:`meal-with-${guest}`,index:0}]);
   assert.equal(invented.status,400,'a rejected invitation cannot manufacture a dinner');
  }else{
   assert.equal(run.eventId,`meal-with-${guest}`);
   const reply=engine.getEvent(run).choices.findIndex(choice=>choice.effect==='mealFinish');assert.ok(reply>=0);
   const paid=engine.advance(engine.applyChoice(run,reply));assert.equal(engine.validRun(paid),true);assert.ok(paid.stats.cash<run.stats.cash);
   const dinner=await h.post(player,route,runId,paid.actions);assertProjection(dinner,paid);
   const paidRetry=await h.post(player,route,runId,paid.actions);assertProjection(paidRetry,paid);assert.deepEqual(paidRetry.body.characters,dinner.body.characters);
   const original=deriveCharacterStats(run).find(row=>row.id===guest),actual=deriveCharacterStats(paid).find(row=>row.id===guest);
   assert.equal(actual.encounters,original.encounters+1,'the actual table conversation adds one encounter');
  }
 }
 assert.equal(covered.size,32);
 const aggregate=await h.call('/api/characters');assert.equal(aggregate.status,200);assert.equal(aggregate.body.characters.length,CHARACTER_IDS.length);
 assert.ok(aggregate.body.characters.every(row=>row.realHits===0&&row.imaginedHits===0));
 assert.doesNotMatch(JSON.stringify(aggregate.body),/playerId|runId|seed|actions|mealContext|outcome/);
 assert.equal((await h.call('/api/stats')).body.totalRuns,0,'progress never manufactures a completed life');
});

test('e34 meal proofs cannot inject acceptance or transfer a committed invitation to another anonymous player',async t=>{
 const h=harness(t),player=await h.register(),other=await h.register();
 const route=routes.find(row=>row.outcome==='declined');assert.ok(route);const runId=randomUUID(),run=engine.replayRun(route.roleId,route.seed,route.actions);
 assertProjection(await h.post(player,route,runId),run);
 const foreign=await h.post(other,route,runId);assert.equal(foreign.status,409);
 const untouched=await h.call('/api/me',{token:other.token});assert.equal(untouched.status,200);
 assert.ok(untouched.body.characters.every(row=>CHARACTER_METRICS.every(key=>row[key]===0)));
 const index=route.actions.findLastIndex(action=>action.type==='choice'&&/^meal-guests-[ab]$/.test(action.eventId));assert.ok(index>=0);
 for(const extra of [{effect:'mealPick'},{accepted:true},{target:route.guest},{mealTarget:route.guest},{result:'accepted'}]){
  const actions=structuredClone(route.actions);Object.assign(actions[index],extra);
  const unchanged=await h.post(player,route,runId,actions);assertProjection(unchanged,run);
  assert.deepEqual(unchanged.body.characters,deriveCharacterStats(beforeInvitation(route)),'supplied choice metadata never changes the canonical refusal into a meal');
 }
 const invented=await h.post(other,route,randomUUID(),[{type:'choice',eventId:`meal-with-${route.guest}`,index:0}]);assert.equal(invented.status,400);
 assert.equal((await h.call('/api/me',{token:other.token})).body.totalRuns,0);
});

test('e34 meals retain canonical completion, anonymous observations and retry deduplication after both invitation results',async t=>{
 const h=harness(t);
 for(const outcome of ['accepted','declined']){
  const route=routes.find(row=>row.outcome===outcome&&Array.isArray(row.completionActions));assert.ok(route,`${outcome} completion proof`);
  const run=engine.replayRun(route.roleId,route.seed,route.completionActions);assert.equal(run.completed,true);assert.equal(engine.validRun(run),true);
  const player=await h.register(),runId=randomUUID();assertProjection(await h.post(player,route,runId),engine.replayRun(route.roleId,route.seed,route.actions));
  const completed=await h.post(player,route,runId,route.completionActions,'/api/complete',{endingId:'nasdaq-system',characters:[{id:'wing',realHits:1000}]});
  assertProjection(completed,run,true);assert.equal(completed.body.endingId,run.endingId);assert.equal(completed.body.totalRuns,1);assert.equal(completed.body.duplicate,false);
  const duplicate=await h.post(player,route,runId,route.completionActions,'/api/complete');assertProjection(duplicate,run,true);
  assert.equal(duplicate.body.duplicate,true);assert.equal(duplicate.body.totalRuns,1);assert.deepEqual(duplicate.body.characters,completed.body.characters);
  assert.equal(h.sql.exec('SELECT rule_cohort FROM run_observations WHERE run_id=?',runId).one().rule_cohort,34);
 }
 assert.equal((await h.call('/api/stats')).body.totalRuns,2);
});

test('the anonymous API verifies eleventh-choice solo recovery from a low-savings crisis and deduplicates its eventual completion',async t=>{
 const h=harness(t),route=JSON.parse(readFileSync(new URL('./fixtures/meal-crisis-v34.json',import.meta.url),'utf8'));
 let run=engine.replayRun(route.roleId,route.seed,route.actions);assert.equal(run.eventId,'crisis-mood');assert.equal(engine.validRun(run),true);
 const crisis=structuredClone(run),player=await h.register(),runId=randomUUID();
 assertProjection(await h.post(player,route,runId),run);
 const choose=effect=>{const index=engine.getEvent(run).choices.findIndex(choice=>choice.effect===effect);assert.ok(index>=0);run=engine.advance(engine.applyChoice(run,index));assert.equal(engine.validRun(run),true);};
 choose('mealOpen');const invite=engine.getEvent(run).choices.findIndex(choice=>choice.mealTarget==='erich');assert.ok(invite>=0);
 let pending=engine.applyChoice(run,invite);assert.equal(pending.pendingEffect,'mealDeclined');run=engine.advance(pending);
 assertProjection(await h.post(player,route,runId,run.actions),run);
 choose('mealCancel');assert.equal(run.eventId,'crisis-mood');choose('mealOpen');
 assert.equal(engine.getEvent(run).choices.find(choice=>choice.mealTarget==='erich').available,false);
 const before=structuredClone(run),solo=engine.getEvent(run).choices.findIndex(choice=>choice.effect==='mealFinish'&&!choice.mealTarget);assert.equal(solo,10);
 pending=engine.applyChoice(run,solo);assert.equal(engine.validRun(pending),true);run=engine.advance(pending);
 assert.equal(engine.validRun(run),true);assert.equal(run.completed,false);assert.equal(run.eventId,crisis.resumeEventId);
 assert.equal(run.stats.cash,5);assert.equal(run.stats.mood,23);assert.equal(run.stats.energy,26);assert.equal(run.rng,before.rng);assert.equal(run.turn,crisis.turn);
 assert.deepEqual(run.pip,crisis.pip);assert.deepEqual(deriveCharacterStats(run),deriveCharacterStats(before));
 assert.equal(run.flags.spend_solo,1);assert.equal(run.flags.meal_shared||0,crisis.flags.meal_shared||0);
 const progress=await h.post(player,route,runId,run.actions,'/api/achievements',{flags:{meal_shared:99},characters:[{id:'erich',encounters:999}]});
 assertProjection(progress,run,true);assert.equal(progress.body.totalRuns,0);
 const retry=await h.post(player,route,runId,run.actions,'/api/achievements');assertProjection(retry,run,true);
 assert.deepEqual(retry.body.characters,progress.body.characters);assert.deepEqual(retry.body.achievements,progress.body.achievements);
 const exit=engine.requestExit(run);assert.notEqual(exit,run);run=engine.advance(engine.applyChoice(exit,0));
 assert.equal(run.completed,true);assert.equal(engine.validRun(run),true);
 const completed=await h.post(player,route,runId,run.actions,'/api/complete');assertProjection(completed,run,true);assert.equal(completed.body.totalRuns,1);assert.equal(completed.body.duplicate,false);
 const duplicate=await h.post(player,route,runId,run.actions,'/api/complete');assertProjection(duplicate,run,true);assert.equal(duplicate.body.totalRuns,1);assert.equal(duplicate.body.duplicate,true);
 assert.deepEqual(duplicate.body.characters,completed.body.characters);assert.equal(h.sql.exec('SELECT rule_cohort FROM run_observations WHERE run_id=?',runId).one().rule_cohort,34);
 assert.equal((await h.call('/api/stats')).body.totalRuns,1);
});
