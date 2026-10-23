import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomBytes,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import vm from 'node:vm';
import * as E from '../dist/engine.js';
import {ROLE_MAP} from '../dist/roles.js';
import {ENDINGS} from '../dist/endings.js';
import {deriveAchievements} from '../dist/achievements.js';
import {deriveCharacterStats} from '../dist/character-stats.js';
import {AchievementStore} from '../worker/achievements.js';
import {CharacterStore} from '../worker/characters.js';
import {ObservationStore} from '../worker/observations.js';
import {FeedbackStore} from '../worker/feedback-store.js';
import {validateFeedback,validatePublisherToken} from '../worker/feedback.js';
import * as http from '../worker/http.js';

const workerSource=readFileSync(new URL('../worker/index.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export class HedoArchive','globalThis.HedoArchive=class HedoArchive').replace('export default','globalThis.worker=');
const {routes,continuations=[]}=JSON.parse(readFileSync(new URL('./fixtures/event-departure-v63.json',import.meta.url),'utf8'));
const row=id=>{const found=routes.find(route=>route.id===id);assert.ok(found,id);return found;};
const proof=(route,runId=randomUUID(),actions=route.actions)=>({runId,roleId:route.roleId,seed:route.seed,actions});
function harness(t){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());db.exec('PRAGMA foreign_keys = ON');
 const sql={exec(query,...args){let rows=[];if(!args.length&&query.includes(';'))db.exec(query);else{const statement=db.prepare(query);if(statement.columns().length)rows=statement.all(...args);else statement.run(...args);}return {toArray:()=>rows,one:()=>{assert.equal(rows.length,1);return rows[0];}};}};
 const storage={sql,transactionSync(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}},async getAlarm(){return null;},async setAlarm(){}};
 const context=vm.createContext({DurableObject:class{constructor(ctx){this.ctx=ctx;}},replayRun:E.replayRun,VERSION:E.VERSION,MAX_TURNS:E.MAX_TURNS,ROLE_MAP,ENDINGS,...http,validateFeedback,validatePublisherToken,FeedbackStore,AchievementStore,CharacterStore,ObservationStore,crypto,Response,Request,URL,Date});
 vm.runInContext(workerSource,context);const archive=new context.HedoArchive({storage,blockConcurrencyWhile:fn=>fn()},{});
 const call=async(path,{method='GET',token,body}={})=>{archive.rate=new http.RateGuard();const headers={};if(token)headers.Authorization=`Bearer ${token}`;if(body)headers['Content-Type']='application/json';const response=await archive.fetch(new Request(`https://game.example${path}`,{method,headers,body:body?JSON.stringify(body):undefined}));return {status:response.status,body:await response.json()};};
 const register=async()=>{const token=randomBytes(32).toString('hex');assert.equal((await call('/api/player',{method:'POST',body:{token}})).status,200);return token;};
 return {sql,call,register};
}

test('the production Worker verifies departures using canonical actions, not supplied outcomes, money or completion claims',async t=>{
 const h=harness(t),representatives=[...new Map(routes.map(route=>[route.category,route])).values()];assert.ok(representatives.length>=19);
 for(const route of representatives){
  const token=await h.register(),runId=randomUUID(),run=E.replayRun(route.roleId,route.seed,route.actions),body={...proof(route,runId),completed:true,endingId:'nasdaq-system',stats:{cash:999,mood:100},departureOutcome:{completed:true,category:'company'},characters:[{id:'wing',affinityGained:999}]};
  const response=await h.call('/api/characters',{method:'POST',token,body});assert.equal(response.status,200,route.id);assert.equal(response.body.verified,true);assert.deepEqual(response.body.characters,deriveCharacterStats(run));assert.equal(response.body.totalRuns,0);
  const badge=await h.call('/api/achievements',{method:'POST',token,body});assert.equal(badge.status,200,route.id);assert.deepEqual(badge.body.achievements.map(row=>row.id).sort(),deriveAchievements(run).sort());assert.equal(badge.body.totalRuns,0);
  const retry=await h.call('/api/characters',{method:'POST',token,body:proof(route,runId)});assert.equal(retry.status,200);assert.deepEqual(retry.body.characters,response.body.characters);
  const delayed=await h.call('/api/characters',{method:'POST',token,body:proof(route,runId,route.beforeActions)});assert.equal(delayed.status,200);assert.deepEqual(delayed.body.characters,response.body.characters,'earlier proof cannot undo the recorded departure');
  if(!run.completed){const complete=await h.call('/api/complete',{method:'POST',token,body});assert.equal(complete.status,400);assert.equal(complete.body.error,'incomplete_run');}
 }
 const stats=(await h.call('/api/stats')).body;assert.equal(stats.totalRuns,0);assert.doesNotMatch(JSON.stringify(stats),/departureOutcome|departureContext|sourceEventId|history|actions|seed|runId|playerId/);
});

test('refusing onboarding is not voluntary resignation, and forced HR departures retain their actual coarse category',async t=>{
 const h=harness(t),token=await h.register();
 for(const [id,way]of [['onboarding','other'],['paperwork','company_exit'],['dismissal-final','company_exit'],['labor-claim','labor_dispute'],['labor-mediation','labor_dispute'],['pip-review','pip_failed']]){
  const route=row(id),run=E.replayRun(route.roleId,route.seed,route.actions),body={...proof(route),departureWay:'voluntary',endingId:'nasdaq-system'},response=await h.call('/api/complete',{method:'POST',token,body});
  assert.equal(run.completed,true,id);assert.equal(response.status,200,id);assert.equal(response.body.endingId,run.endingId);assert.equal(response.body.duplicate,false);assert.equal(h.sql.exec('SELECT way FROM run_departures WHERE run_id = ?',body.runId).one().way,way);
  const duplicate=await h.call('/api/complete',{method:'POST',token,body});assert.equal(duplicate.status,200);assert.equal(duplicate.body.duplicate,true);
  if(id==='onboarding')for(const id of ['work-card','switch','assistant','robot'])assert.ok(!response.body.achievements.some(row=>row.id===id));
 }
 assert.equal((await h.call('/api/stats')).body.totalRuns,6);assert.equal((await h.call('/api/me',{token})).body.totalRuns,6);
});

test('HTTP grammar and server replay reject fabricated, duplicate, stale and old-profile departure actions',async t=>{
 const h=harness(t),token=await h.register(),route=row('gap'),source=E.replayRun(route.roleId,route.seed,route.beforeActions),action={type:'event-departure',version:1,eventId:'work-gap-v50'};
 const attacks=[
  [...route.beforeActions,{...action,version:2}],
  [...route.beforeActions,{...action,category:'work'}],
  [...route.beforeActions,{...action,delta:{cash:100}}],
  [...route.beforeActions,{...action,eventId:source.eventId}],
  [...route.beforeActions,{...action,eventId:''}],
  [...route.actions,action]
 ];
 for(const actions of attacks){const response=await h.call('/api/characters',{method:'POST',token,body:proof(route,randomUUID(),actions)});assert.equal(response.status,400);assert.match(response.body.error,/^invalid_(?:actions|replay)$/);}
 const old=await h.call('/api/characters',{method:'POST',token,body:{runId:randomUUID(),roleId:'system',seed:'e39-r62-n-0000000000000000000000',actions:[{type:'activity-schedule',version:1},{type:'event-departure',version:1,eventId:'onboarding'}]}});assert.equal(old.status,400);assert.equal(old.body.error,'invalid_actions');
 const runId=randomUUID(),accepted=await h.call('/api/characters',{method:'POST',token,body:proof(route,runId)});assert.equal(accepted.status,200);
 const stranger=await h.register(),foreign=await h.call('/api/characters',{method:'POST',token:stranger,body:proof(route,runId)});assert.equal(foreign.status,409);assert.equal((await h.call('/api/me',{token:stranger})).body.totalRuns,0);
 assert.equal((await h.call('/api/stats')).body.totalRuns,0);
});

test('server progress retains accepted appointments and unlocks a later finished treat after an earlier aborted one',async t=>{
 const h=harness(t);
 for(const marker of ['s','d']){
  const route=row(`verbal-onboarding-result-${marker}`),token=await h.register(),runId=randomUUID(),run=E.replayRun(route.roleId,route.seed,route.actions);
  const source=await h.call('/api/characters',{method:'POST',token,body:proof(route,runId,route.beforeActions)});assert.equal(source.status,200);
  const response=await h.call('/api/achievements',{method:'POST',token,body:proof(route,runId)});assert.equal(response.status,200);assert.ok(response.body.achievements.some(row=>row.id===(marker==='s'?'kin-direct-son':'kin-direct-daughter')));assert.equal(run.completed,false);assert.ok(run.patronage);assert.ok(!run.flags.departure63_onboarding_declined);
  assert.equal((await h.call('/api/complete',{method:'POST',token,body:{...proof(route,runId),completed:true}})).body.error,'incomplete_run');
 }
 const route=continuations.find(row=>row.id==='treat-after-abort');assert.ok(route);const token=await h.register(),runId=randomUUID();
 const earlier=await h.call('/api/achievements',{method:'POST',token,body:proof(route,runId,route.beforeActions)});assert.equal(earlier.status,200);assert.ok(!earlier.body.achievements.some(row=>row.id==='treat-jack-drink'));
 const later=await h.call('/api/achievements',{method:'POST',token,body:proof(route,runId)});assert.equal(later.status,200);assert.ok(later.body.achievements.some(row=>row.id==='cake-jack-relief'));assert.ok(!later.body.achievements.some(row=>row.id==='treat-jack-drink'));assert.equal(later.body.totalRuns,0);
 assert.equal((await h.call('/api/stats')).body.totalRuns,0);
});
