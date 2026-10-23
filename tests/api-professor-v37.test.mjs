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
const fixture=JSON.parse(readFileSync(new URL('./fixtures/professor-v37.json',import.meta.url),'utf8'));
const routes=[...fixture.scenes,...fixture.meals,...fixture.rages,...fixture.verbals,fixture.accepted,fixture.declined];
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

test('the anonymous server replays all thirty professor scenes, six meal reactions and every sampled hit/spoken branch without trusting submitted totals',async t=>{
  const h=harness(t);assert.equal(routes.length,70);
  for(const route of routes){
    const run=engine.replayRun(route.roleId,route.seed,route.actions),player=await h.register(),runId=randomUUID();
    assert.equal(engine.validRun(run),true,route.id);
    const extra={characters:[{id:'professor',realHits:9999,affinityGained:9999}],history:[{speaker:'professor',mealOutcome:{affinityDelta:99}}],stats:{boss:100},flags:{meal_guest_professor:99},mealContext:{guest:'professor',page:2},reaction:'warm'};
    const first=await h.post(player,route,runId,{extra});assertProjection(first,run);assert.equal(first.body.characters.length,CHARACTER_IDS.length);assert.equal(first.body.totalRuns,0);
    const again=await h.post(player,route,runId);assertProjection(again,run);assert.deepEqual(again.body.characters,first.body.characters);
    const badges=await h.post(player,route,runId,{path:'/api/achievements',extra});assertProjection(badges,run,true);
    assert.equal(again.body.characters.find(row=>row.id==='professor').realHits,deriveCharacterStats(run).find(row=>row.id==='professor').realHits);
  }
  assert.equal((await h.call('/api/stats')).body.totalRuns,0);
  const aggregate=await h.call('/api/characters');assert.equal(aggregate.status,200);assert.equal(aggregate.body.characters.length,CHARACTER_IDS.length);
  assert.doesNotMatch(JSON.stringify(aggregate.body),/seed|actions|playerId|runId|mealContext/);
});

test('professor dinner choice commitments are immutable and absent or legacy-cohort professor targets cannot be forged',async t=>{
  const h=harness(t),route=fixture.meals.find(row=>row.replyIndex===0&&row.reaction==='mine'),player=await h.register(),other=await h.register(),runId=randomUUID();
  const run=engine.replayRun(route.roleId,route.seed,route.actions);assertProjection(await h.post(player,route,runId),run);
  assert.equal((await h.post(other,route,runId)).status,409);
  const before=engine.replayRun(route.roleId,route.seed,route.beforeActions),fork=engine.advance(engine.applyChoice(before,1));
  assert.equal((await h.post(player,route,runId,{actions:fork.actions})).status,409);
  const missing=await h.post(other,route,randomUUID(),{actions:[{type:'choice',eventId:'meal-with-professor',index:0}]});assert.equal(missing.status,400);
  const legacy={...route,seed:route.seed.replace(/^e37-/,'e36-')};assert.equal((await h.post(other,legacy,randomUUID())).status,400);
  const rejected=fixture.declined,claimed=await h.post(other,rejected,randomUUID(),{actions:[...rejected.actions,{type:'choice',eventId:'meal-with-professor',index:0}]});assert.equal(claimed.status,400);
  const untouched=await h.call('/api/me',{token:other.token});assert.ok(untouched.body.characters.every(row=>CHARACTER_METRICS.every(metric=>row[metric]===0)));
});

test('professor meal lives complete with the expanded public totals and idempotent e37 observations',async t=>{
  const h=harness(t);let count=0;
  for(const route of fixture.meals){
    const run=engine.replayRun(route.roleId,route.seed,route.actions),exit=engine.requestExit(run);assert.notEqual(exit,run);
    const index=engine.getEvent(exit).choices.findIndex(c=>c.available!==false),ended=engine.advance(engine.applyChoice(exit,index));assert.equal(ended.completed,true);assert.equal(engine.validRun(ended),true);
    const player=await h.register(),runId=randomUUID();assertProjection(await h.post(player,route,runId),run);
    const first=await h.post(player,route,runId,{actions:ended.actions,path:'/api/complete',extra:{endingId:'nasdaq-system',characters:[{id:'professor',affinityGained:999}]}});
    assertProjection(first,ended,true);assert.equal(first.body.endingId,ended.endingId);assert.equal(first.body.totalRuns,1);assert.equal(first.body.duplicate,false);
    const again=await h.post(player,route,runId,{actions:ended.actions,path:'/api/complete'});assertProjection(again,ended,true);assert.equal(again.body.duplicate,true);assert.deepEqual(again.body.characters,first.body.characters);
    assert.equal(h.sql.exec('SELECT rule_cohort FROM run_observations WHERE run_id=?',runId).one().rule_cohort,37);count++;
  }
  assert.equal(count,6);assert.equal((await h.call('/api/stats')).body.totalRuns,6);
});
