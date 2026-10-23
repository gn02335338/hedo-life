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
const {routes}=JSON.parse(readFileSync(new URL('./fixtures/roadshow-v63.json',import.meta.url),'utf8'));
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

test('the anonymous Worker replays both Roadshow control traces and all three conclusions across three careers',async t=>{
 const h=harness(t);
 for(const role of ['sales','bd','design'])for(const name of ['strong','weak'])for(const index of [0,1,2]){
  const route=row(`${role}-${name}-finish-${index}`),token=await h.register(),runId=randomUUID(),run=E.replayRun(route.roleId,route.seed,route.actions);
  const response=await h.call('/api/characters',{method:'POST',token,body:{...proof(route,runId),stats:{skill:100,mood:100},activityContext:{id:'roadshow',score:999,stage:2},activityOutcome:{id:'roadshow',done:true,performance:{score:100}},characters:[{id:'professor',affinityGained:999}]}});
  assert.equal(response.status,200,route.id);assert.equal(response.body.verified,true);assert.deepEqual(response.body.characters,deriveCharacterStats(run));assert.equal(response.body.totalRuns,0);
  const duplicate=await h.call('/api/characters',{method:'POST',token,body:proof(route,runId)});assert.equal(duplicate.status,200);assert.deepEqual(duplicate.body.characters,response.body.characters);
  const play=row(`${role}-play`),delayed=await h.call('/api/characters',{method:'POST',token,body:proof(route,runId,play.actions)});assert.equal(delayed.status,200);assert.deepEqual(delayed.body.characters,response.body.characters);
  const complete=await h.call('/api/complete',{method:'POST',token,body:{...proof(route,runId),completed:true,endingId:'nasdaq-system'}});assert.equal(complete.status,400);assert.equal(complete.body.error,'incomplete_run');
 }
 assert.equal((await h.call('/api/stats')).body.totalRuns,0);assert.doesNotMatch(JSON.stringify((await h.call('/api/characters')).body),/activityContext|activityOutcome|seed|actions|history|playerId|runId/);
});

test('the Worker rejects forged grades, skipped Roadshow stages, stale submissions and replay forks',async t=>{
 const h=harness(t),token=await h.register(),play=row('sales-play'),strong=row('sales-strong'),finish=row('sales-strong-finish-0');
 const valid={type:'activity-play',version:1,eventId:'activity44-roadshow-1',index:1,input:{kind:'roadshow',matches:[0,1,2,1,0,2]}};
 const malformed=[
  {...valid,score:100},
  {...valid,eventId:'activity44-roadshow-0'},
  {...valid,input:{...valid.input,grade:2}},
  {...valid,input:{kind:'roadshow',matches:[0,1,2,1,0]}},
  {...valid,input:{kind:'roadshow',matches:[0,1,2,1,0,3]}}
 ];
 const attacks=[...malformed.map(action=>[...play.actions,action]),[...strong.actions,valid],[...finish.actions,valid],[...play.actions,{type:'choice',eventId:'activity44-roadshow-2',index:0}]];
 for(const actions of attacks){const response=await h.call('/api/characters',{method:'POST',token,body:proof(play,randomUUID(),actions)});assert.equal(response.status,400);assert.match(response.body.error,/^invalid_(?:actions|replay)$/);}
 const runId=randomUUID();assert.equal((await h.call('/api/characters',{method:'POST',token,body:proof(strong,runId)})).status,200);
 const fork=await h.call('/api/characters',{method:'POST',token,body:proof(row('sales-weak'),runId)});assert.equal(fork.status,409);
 const stranger=await h.register(),foreign=await h.call('/api/characters',{method:'POST',token:stranger,body:proof(strong,runId)});assert.equal(foreign.status,409);assert.equal((await h.call('/api/stats')).body.totalRuns,0);
});
