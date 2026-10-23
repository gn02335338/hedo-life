import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as E from '../dist/engine.js';
import {ROLE_MAP} from '../dist/roles.js';
import {ENDINGS} from '../dist/endings.js';
import {deriveCharacterStats} from '../dist/character-stats.js';
import {AchievementStore} from '../worker/achievements.js';
import {CharacterStore} from '../worker/characters.js';
import {ObservationStore} from '../worker/observations.js';
import {FeedbackStore} from '../worker/feedback-store.js';
import {validateFeedback,validatePublisherToken} from '../worker/feedback.js';
import * as http from '../worker/http.js';

const source=readFileSync(new URL('../worker/index.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export class HedoArchive','globalThis.HedoArchive=class HedoArchive').replace('export default','globalThis.worker=');
const {routes}=JSON.parse(readFileSync(new URL('./fixtures/cast-meals-v65.json',import.meta.url),'utf8'));
const row=id=>{const value=routes.find(route=>route.id===id);assert.ok(value,id);return value;};
const proof=(route,runId=randomUUID(),actions=route.actions)=>({runId,roleId:route.roleId,seed:route.seed,actions});

// Use actual production HTTP handlers and stores in an isolated SQLite database.
function harness(t){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());db.exec('PRAGMA foreign_keys = ON');
 const sql={exec(query,...args){let rows=[];if(!args.length&&query.includes(';'))db.exec(query);else{const stmt=db.prepare(query);if(stmt.columns().length)rows=stmt.all(...args);else stmt.run(...args);}return{toArray:()=>rows,one:()=>{assert.equal(rows.length,1);return rows[0];}};}};
 const storage={sql,transactionSync(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}},async getAlarm(){return null;},async setAlarm(){}};
 const context=vm.createContext({DurableObject:class{constructor(ctx){this.ctx=ctx;}},replayRun:E.replayRun,VERSION:E.VERSION,MAX_TURNS:E.MAX_TURNS,ROLE_MAP,ENDINGS,...http,validateFeedback,validatePublisherToken,FeedbackStore,AchievementStore,CharacterStore,ObservationStore,crypto,Response,Request,URL,Date});
 vm.runInContext(source,context);const archive=new context.HedoArchive({storage,blockConcurrencyWhile:fn=>fn()},{});
 const call=async(path,{method='GET',token,body}={})=>{archive.rate=new http.RateGuard();const headers={};if(token)headers.Authorization=`Bearer ${token}`;if(body)headers['Content-Type']='application/json';const response=await archive.fetch(new Request(`https://game.example${path}`,{method,headers,body:body?JSON.stringify(body):undefined}));return{status:response.status,body:await response.json()};};
 const register=async()=>{const token=randomBytes(32).toString('hex');assert.equal((await call('/api/player',{method:'POST',body:{token}})).status,200);return token;};
 return{call,register};
}

test('the anonymous Worker verifies all six new guests and all 36 revealed meal reactions instead of supplied names, prices or friendship',async t=>{
 const h=harness(t);
 for(const route of routes.filter(route=>!route.id.startsWith('menu-'))){
  const run=E.replayRun(route.roleId,route.seed,route.actions),token=await h.register(),runId=randomUUID(),response=await h.call('/api/characters',{method:'POST',token,body:{...proof(route,runId),mealCost:0,mealTarget:'wing',stats:{cash:100},mealOutcome:{target:'wing',reaction:'warm',affinityDelta:999},characters:[{id:'johnny',encounters:999,affinityGained:999}]}});
  assert.equal(response.status,200,route.id);assert.equal(response.body.verified,true);assert.deepEqual(response.body.characters,deriveCharacterStats(run));assert.equal(response.body.totalRuns,0);
  if(route.id.startsWith('paid-')&&route.id.endsWith('-0-warm')){
   const duplicate=await h.call('/api/characters',{method:'POST',token,body:proof(route,runId)});assert.equal(duplicate.status,200);assert.deepEqual(duplicate.body.characters,response.body.characters);
   const before=E.replayRun(route.roleId,route.seed,route.beforeActions),delayed=await h.call('/api/characters',{method:'POST',token,body:proof(route,runId,before.actions)});assert.equal(delayed.status,200);assert.deepEqual(delayed.body.characters,response.body.characters);
   const completed=await h.call('/api/complete',{method:'POST',token,body:{...proof(route,runId),completed:true,endingId:'nasdaq-system'}});assert.equal(completed.status,400);assert.equal(completed.body.error,'incomplete_run');
  }
 }
 const publicStats=await h.call('/api/characters');assert.equal(publicStats.status,200);for(const id of ['zoe','action','hester','simon','james','johnny'])assert.ok(publicStats.body.characters.some(character=>character.id===id));assert.doesNotMatch(JSON.stringify(publicStats.body),/seed|actions|history|mealContext|mealOutcome|playerId|runId/);assert.equal((await h.call('/api/stats')).body.totalRuns,0);
});

test('new guest dinners cannot be invented after a refusal, paid twice, forked or transferred to another anonymous player',async t=>{
 const h=harness(t),token=await h.register();
 for(const guest of ['zoe','action','hester','simon','james','johnny']){
  const declined=row(`declined-${guest}`),paid=row(`paid-${guest}-0-warm`),actions=[
   [...declined.actions,{type:'choice',eventId:`meal-with-${guest}`,index:0}],
   [...paid.actions,{type:'choice',eventId:`meal-with-${guest}`,index:0}],
   [...declined.actions,{type:'meal',guest,cost:0,affinityDelta:100}]
  ];
  for(const forged of actions){const response=await h.call('/api/characters',{method:'POST',token,body:proof(paid,randomUUID(),forged)});assert.equal(response.status,400);assert.match(response.body.error,/^invalid_(?:actions|replay)$/);}
  const runId=randomUUID();assert.equal((await h.call('/api/characters',{method:'POST',token,body:proof(paid,runId)})).status,200);
  const before=E.replayRun(paid.roleId,paid.seed,paid.beforeActions),alternate=E.advance(E.applyChoice(before,1)),fork=await h.call('/api/characters',{method:'POST',token,body:proof(paid,runId,alternate.actions)});assert.equal(fork.status,409);
  const other=await h.register(),foreign=await h.call('/api/characters',{method:'POST',token:other,body:proof(paid,runId)});assert.equal(foreign.status,409);
 }
 assert.equal((await h.call('/api/stats')).body.totalRuns,0);
});
