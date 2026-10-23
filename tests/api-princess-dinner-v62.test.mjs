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
const {routes}=JSON.parse(readFileSync(new URL('./fixtures/princess-dinner-v62.json',import.meta.url),'utf8'));
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

test('the anonymous Worker verifies free invitations, cancellation and all six 52-cost meal reactions using only canonical actions',async t=>{
 const h=harness(t);
 for(const route of routes.filter(route=>route.beforeActions)){
  const token=await h.register(),runId=randomUUID(),run=E.replayRun(route.roleId,route.seed,route.actions),before=E.replayRun(route.roleId,route.seed,route.beforeActions);
  const response=await h.call('/api/characters',{method:'POST',token,body:{...proof(route,runId),stats:{cash:100,mood:100},mealCost:14,mealContext:{guest:'wing'},mealOutcome:{target:'wing',reaction:'warm',affinityDelta:999},characters:[{id:'princess',encounters:999,affinityGained:999}]}});
  assert.equal(response.status,200,route.id);assert.equal(response.body.verified,true);assert.deepEqual(response.body.characters,deriveCharacterStats(run));assert.equal(response.body.totalRuns,0);
  const retry=await h.call('/api/characters',{method:'POST',token,body:proof(route,runId)});assert.equal(retry.status,200);assert.deepEqual(retry.body.characters,response.body.characters);
  const delayed=await h.call('/api/characters',{method:'POST',token,body:proof(route,runId,before.actions)});assert.equal(delayed.status,200);assert.deepEqual(delayed.body.characters,response.body.characters,'late pre-payment updates cannot roll back committed dinner results');
  const complete=await h.call('/api/complete',{method:'POST',token,body:{...proof(route,runId),completed:true,endingId:'nasdaq-system'}});assert.equal(complete.status,400);assert.equal(complete.body.error,'incomplete_run');
 }
 assert.equal((await h.call('/api/stats')).body.totalRuns,0);assert.doesNotMatch(JSON.stringify((await h.call('/api/characters')).body),/mealContext|mealOutcome|seed|actions|history|playerId|runId/);
});

test('the Worker rejects unaffordable, declined, stale or duplicate meal actions and does not let another player fork the paid dinner',async t=>{
 const h=harness(t),token=await h.register();
 const poor=row('poor-menu'),declined=row('declined'),paid=row('paid-0-warm'),before=E.replayRun(paid.roleId,paid.seed,paid.beforeActions);
 const attacks=[
  [poor,[...poor.actions,{type:'choice',eventId:'meal-guests-c',index:poor.invitationIndex}]],
  [poor,[...poor.actions,{type:'choice',eventId:'meal-with-princess',index:0}]],
  [declined,[...declined.actions,{type:'choice',eventId:'meal-with-princess',index:0}]],
  [paid,[...paid.actions,{type:'choice',eventId:'meal-with-princess',index:0}]],
  [paid,[...paid.actions,{type:'choice',eventId:'meal-guests-c',index:2}]],
  [paid,[...paid.beforeActions,{type:'meal',guest:'princess',cost:14,reaction:'warm'}]]
 ];
 for(const [route,actions] of attacks){const response=await h.call('/api/characters',{method:'POST',token,body:{...proof(route,randomUUID(),actions),stats:{cash:100},mealContext:{guest:'princess'},mealCost:14}});assert.equal(response.status,400);assert.match(response.body.error,/^invalid_(?:actions|replay)$/);}
 const runId=randomUUID();assert.equal((await h.call('/api/characters',{method:'POST',token,body:proof(paid,runId)})).status,200);
 const alternative=E.advance(E.applyChoice(before,1)),fork=await h.call('/api/characters',{method:'POST',token,body:proof(paid,runId,alternative.actions)});assert.equal(fork.status,409);
 const stranger=await h.register(),foreign=await h.call('/api/characters',{method:'POST',token:stranger,body:proof(paid,runId)});assert.equal(foreign.status,409);assert.equal((await h.call('/api/me',{token:stranger})).body.totalRuns,0);
 assert.equal((await h.call('/api/stats')).body.totalRuns,0);
});
