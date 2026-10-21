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

const source=readFileSync(new URL('../worker/index.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export class HedoArchive','globalThis.HedoArchive=class HedoArchive').replace('export default','globalThis.worker=');
const {routes,refusals}=JSON.parse(readFileSync(new URL('./fixtures/meal-reactions-v36.json',import.meta.url),'utf8'));
const proof=(route,runId,actions=route.actions)=>({runId,roleId:route.roleId,seed:route.seed,actions});

function harness(t){
  const db=new DatabaseSync(':memory:');t.after(()=>db.close());db.exec('PRAGMA foreign_keys = ON');
  const sql={exec(query,...args){let rows=[];if(!args.length&&query.includes(';'))db.exec(query);else{const statement=db.prepare(query);if(statement.columns().length)rows=statement.all(...args);else statement.run(...args);}return{toArray:()=>rows,one:()=>{assert.equal(rows.length,1);return rows[0];}};}};
  const storage={sql,transactionSync(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}},async getAlarm(){return null;},async setAlarm(){}};
  const context=vm.createContext({DurableObject:class{constructor(ctx){this.ctx=ctx;}},replayRun:engine.replayRun,VERSION:engine.VERSION,MAX_TURNS:engine.MAX_TURNS,ROLE_MAP,ENDINGS,...http,validateFeedback,validatePublisherToken,FeedbackStore,AchievementStore,CharacterStore,ObservationStore,crypto,Response,Request,URL,Date});
  vm.runInContext(source,context);const archive=new context.HedoArchive({storage,blockConcurrencyWhile:fn=>fn()},{});
  const call=async(path,{method='GET',token,body}={})=>{
    archive.rate=new http.RateGuard();const headers={};if(token)headers.Authorization=`Bearer ${token}`;if(body)headers['Content-Type']='application/json';
    const response=await archive.fetch(new Request(`https://game.example${path}`,{method,headers,body:body?JSON.stringify(body):undefined}));return{status:response.status,body:await response.json()};
  };
  const register=async()=>{const token=randomBytes(32).toString('hex'),response=await call('/api/player',{method:'POST',body:{token}});assert.equal(response.status,200);return{token,id:response.body.playerId};};
  const post=(player,route,runId,{actions=route.actions,path='/api/characters',extra={}}={})=>call(path,{method:'POST',token:player.token,body:{...proof(route,runId,actions),...extra}});
  return{sql,call,register,post};
}

function assertProjection(response,run,badges=false){
  assert.equal(response.status,200);assert.deepEqual(response.body.characters,deriveCharacterStats(run));
  if(badges)assert.deepEqual(response.body.achievements.map(row=>row.id).sort(),deriveAchievements(run).sort());
}

test('all 96 natural meal reactions replay anonymously and retries do not multiply relationship or encounter statistics',async t=>{
  const h=harness(t),expected=Object.fromEntries(CHARACTER_IDS.map(id=>[id,Object.fromEntries(CHARACTER_METRICS.map(metric=>[metric,0]))]));
  for(const route of routes){
    const before=engine.replayRun(route.roleId,route.seed,route.actions.slice(0,-1)),run=engine.replayRun(route.roleId,route.seed,route.actions);
    const player=await h.register(),runId=randomUUID();
    assertProjection(await h.post(player,route,runId,{actions:before.actions}),before);
    const forged={stats:{cash:100,mood:100,boss:100},flags:{meal_shared:999},history:[{mealOutcome:{affinityDelta:999}}],characters:[{id:route.guest,encounters:9999,affinityGained:9999}],mealOutcome:{target:'wing',reaction:'warm',affinityDelta:999},mealContext:{guest:'wing'}};
    const response=await h.post(player,route,runId,{extra:forged});assertProjection(response,run);assert.equal(response.body.totalRuns,0);
    const retry=await h.post(player,route,runId);assertProjection(retry,run);assert.deepEqual(retry.body.characters,response.body.characters);
    const badges=await h.post(player,route,runId,{path:'/api/achievements',extra:forged});assertProjection(badges,run,true);
    const duplicate=await h.post(player,route,runId,{path:'/api/achievements'});assertProjection(duplicate,run,true);
    assert.deepEqual(duplicate.body.characters,badges.body.characters);assert.deepEqual(duplicate.body.achievements,badges.body.achievements);
    const old=deriveCharacterStats(before).find(row=>row.id===route.guest),actual=deriveCharacterStats(run).find(row=>row.id===route.guest);
    assert.equal(actual.encounters,old.encounters+1);assert.equal(actual.realHits+actual.imaginedHits,0);
    for(const row of deriveCharacterStats(run))for(const metric of CHARACTER_METRICS)expected[row.id][metric]+=row[metric];
  }
  const aggregate=await h.call('/api/characters');assert.equal(aggregate.status,200);
  for(const row of aggregate.body.characters)for(const metric of CHARACTER_METRICS)assert.equal(row[metric],expected[row.id][metric],`${row.id}/${metric}`);
  assert.doesNotMatch(JSON.stringify(aggregate.body),/playerId|runId|seed|actions|mealContext|mealOutcome/);
  assert.equal((await h.call('/api/stats')).body.totalRuns,0,'a meal progress report does not invent a completed life');
});

test('meal reaction claims cannot replace a committed reply or transfer its anonymous ownership',async t=>{
  const h=harness(t),route=routes.find(row=>row.guest==='jack'&&row.replyIndex===0&&row.reaction==='mine');
  const run=engine.replayRun(route.roleId,route.seed,route.actions),player=await h.register(),other=await h.register(),runId=randomUUID();
  assertProjection(await h.post(player,route,runId),run);
  assert.equal((await h.post(other,route,runId)).status,409);
  const untouched=await h.call('/api/me',{token:other.token});assert.equal(untouched.status,200);
  assert.ok(untouched.body.characters.every(row=>CHARACTER_METRICS.every(metric=>row[metric]===0)));
  for(const forged of [
    {reaction:'warm',affinityDelta:12},{mealOutcome:{version:1,target:'wing',replyIndex:0,reaction:'warm',affinityDelta:12}},
    {rng:1,selectedOutcome:0,result:'聊得很開'}
  ]){
    const actions=structuredClone(route.actions);Object.assign(actions.at(-1),forged);
    const response=await h.post(player,route,runId,{actions});assertProjection(response,run);
  }
  const before=engine.replayRun(route.roleId,route.seed,route.actions.slice(0,-1));
  const fork=engine.advance(engine.applyChoice(before,1));
  assert.equal((await h.post(player,route,runId,{actions:fork.actions})).status,409,'a committed table reply cannot be overwritten');
  const invented=await h.post(other,route,randomUUID(),{actions:[{type:'choice',eventId:`meal-with-${route.guest}`,index:route.replyIndex}]});
  assert.equal(invented.status,400);
});

test('refusals and cancelled accepted dinners do not become paid meal relationships in anonymous projections',async t=>{
  const h=harness(t);
  for(const route of refusals){
    const player=await h.register(),runId=randomUUID(),run=engine.replayRun(route.roleId,route.seed,route.actions);
    const before=engine.replayRun(route.roleId,route.seed,route.actions.slice(0,-1));
    assert.deepEqual(deriveCharacterStats(run),deriveCharacterStats(before));
    assertProjection(await h.post(player,route,runId,{extra:{mealOutcome:{reaction:'warm',affinityDelta:12}}}),run);
    const index=engine.getEvent(run).choices.findIndex(c=>c.effect==='mealCancel'),cancelled=engine.advance(engine.applyChoice(run,index));
    assertProjection(await h.post(player,route,runId,{actions:cancelled.actions}),cancelled);
    assert.deepEqual(deriveCharacterStats(cancelled),deriveCharacterStats(before));
  }
  for(const guest of CHARACTER_IDS){
    const route=routes.find(row=>row.guest===guest),before=engine.replayRun(route.roleId,route.seed,route.actions.slice(0,-1));
    const cancelled=engine.advance(engine.applyChoice(before,2)),player=await h.register(),runId=randomUUID();
    assertProjection(await h.post(player,route,runId,{actions:cancelled.actions}),cancelled);
    assert.deepEqual(deriveCharacterStats(cancelled),deriveCharacterStats(before));assert.equal(cancelled.stats.cash,before.stats.cash);
  }
});

test('every reaction type completes with canonical badges and observations, while duplicate completion remains idempotent',async t=>{
  const h=harness(t);let completedCount=0;
  for(const guest of CHARACTER_IDS)for(const reaction of ['warm','neutral','mine']){
    const route=routes.find(row=>row.guest===guest&&row.reaction===reaction),player=await h.register(),runId=randomUUID();
    const progress=engine.replayRun(route.roleId,route.seed,route.actions),ended=engine.replayRun(route.roleId,route.seed,route.completionActions);
    assert.equal(ended.completed,true);assert.equal(engine.validRun(ended),true);assertProjection(await h.post(player,route,runId),progress);
    const response=await h.post(player,route,runId,{actions:route.completionActions,path:'/api/complete',extra:{endingId:'nasdaq-system',mealOutcome:{affinityDelta:100}}});
    assertProjection(response,ended,true);assert.equal(response.body.endingId,ended.endingId);assert.equal(response.body.totalRuns,1);assert.equal(response.body.duplicate,false);
    const duplicate=await h.post(player,route,runId,{actions:route.completionActions,path:'/api/complete'});assertProjection(duplicate,ended,true);
    assert.equal(duplicate.body.duplicate,true);assert.equal(duplicate.body.totalRuns,1);assert.deepEqual(duplicate.body.characters,response.body.characters);
    assert.equal(h.sql.exec('SELECT rule_cohort FROM run_observations WHERE run_id=?',runId).one().rule_cohort,36);
    completedCount++;
  }
  assert.equal(completedCount,48);assert.equal((await h.call('/api/stats')).body.totalRuns,48);
});
