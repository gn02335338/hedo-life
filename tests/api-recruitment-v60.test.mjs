import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as E from '../dist/engine.js';
import {ROLE_MAP,ROLES} from '../dist/roles.js';
import {ENDINGS} from '../dist/endings.js';
import {directEntryV60} from '../dist/recruitment-v60.js';
import {recruitmentSeedV60} from '../dist/seed-profile-v60.js';
import {deriveCharacterStats} from '../dist/character-stats.js';
import {AchievementStore} from '../worker/achievements.js';
import {CharacterStore} from '../worker/characters.js';
import {ObservationStore} from '../worker/observations.js';
import {FeedbackStore} from '../worker/feedback-store.js';
import {validateFeedback,validatePublisherToken} from '../worker/feedback.js';
import * as http from '../worker/http.js';

const source=readFileSync(new URL('../worker/index.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export class HedoArchive','globalThis.HedoArchive=class HedoArchive').replace('export default','globalThis.worker=');
const choose=(run,index)=>E.advance(E.applyChoice(run,index));
const proof=(run,runId=randomUUID(),actions=run.actions)=>({runId,roleId:run.roleId,seed:run.seed,actions});
const begin=(kind,index=0)=>{
 const seed=recruitmentSeedV60(createHash('sha256').update(`api-entry-v60-${index}`).digest('hex'),kind),entry=directEntryV60(seed);
 return E.enableActivitySchedule(E.createRun(entry?.roleId||'system',seed));
};
const introductions=run=>choose(choose(choose(run,0),0),0);

// Real production routing and stores, isolated from production collections.
function harness(t){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());db.exec('PRAGMA foreign_keys = ON');
 const sql={exec(query,...args){let rows=[];if(!args.length&&query.includes(';'))db.exec(query);else{const stmt=db.prepare(query);if(stmt.columns().length)rows=stmt.all(...args);else stmt.run(...args);}return{toArray:()=>rows,one:()=>{assert.equal(rows.length,1);return rows[0];}};}};
 const storage={sql,transactionSync(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}},async getAlarm(){return null;},async setAlarm(){}};
 const context=vm.createContext({DurableObject:class{constructor(ctx){this.ctx=ctx;}},replayRun:E.replayRun,VERSION:E.VERSION,MAX_TURNS:E.MAX_TURNS,ROLE_MAP,ENDINGS,...http,validateFeedback,validatePublisherToken,FeedbackStore,AchievementStore,CharacterStore,ObservationStore,crypto,Response,Request,URL,Date});
 vm.runInContext(source,context);const archive=new context.HedoArchive({storage,blockConcurrencyWhile:fn=>fn()},{});
 const call=async(path,{method='GET',token,body}={})=>{archive.rate=new http.RateGuard();const headers={};if(token)headers.Authorization=`Bearer ${token}`;if(body)headers['Content-Type']='application/json';const response=await archive.fetch(new Request(`https://game.example${path}`,{method,headers,body:body?JSON.stringify(body):undefined}));return{status:response.status,body:await response.json()};};
 const register=async()=>{const token=randomBytes(32).toString('hex');assert.equal((await call('/api/player',{method:'POST',body:{token}})).status,200);return token;};
 return{sql,call,register};
}

test('new seed profiles use existing bounded actions and the normal HTTP role envelope',()=>{
 for(const kind of ['normal','executive','godson','goddaughter']){
  const run=begin(kind);assert.doesNotThrow(()=>http.validateCompletion(proof(run),ROLE_MAP));
  const entered=choose(run,0);assert.doesNotThrow(()=>http.validateCompletion(proof(entered),ROLE_MAP));
 }
 const run=begin('godson');assert.throws(()=>http.validateCompletion(proof(run,randomUUID(),[{type:'recruitment',title:'乾兒子',salary:499}]),ROLE_MAP),'there is no client-supplied appointment command');
});

test('Worker derives both gendered appointments and introduction relationships from seed and choices, then deduplicates the real departure',async t=>{
 const h=harness(t);
 for(const kind of ['godson','goddaughter']){
  const token=await h.register(),initial=begin(kind),runId=randomUUID();let run=initial;
  for(let stage=0;stage<4;stage++){
   const response=await h.call('/api/characters',{method:'POST',token,body:{...proof(run,runId),characterGender:'invented',jobTitle:'執行長',pay:499,patronage:{title:'乾兒子',fromPay:1,appointedPay:499,historyIndex:0},recruitmentContext:{version:1,stage:99,returnEventId:'finale'},characters:[{id:'rick',affinityGained:9999}]}});
   assert.equal(response.status,200,`${kind}/${stage}`);assert.equal(response.body.verified,true);assert.equal(response.body.totalRuns,0);assert.deepEqual(response.body.characters,deriveCharacterStats(run));
   if(stage<3)run=choose(run,0);
  }
  assert.equal(run.recruitmentContext,null);assert.equal(run.completed,false);assert.ok(deriveCharacterStats(run).find(person=>person.id==='rick').affinityLost>=18);
  const noEnding=await h.call('/api/complete',{method:'POST',token,body:{...proof(run,runId),completed:true,endingId:'nasdaq-system'}});assert.equal(noEnding.status,400);assert.equal(noEnding.body.error,'incomplete_run');
  const ended=choose(E.requestExit(run),0);assert.equal(ended.completed,true);
  const complete=await h.call('/api/complete',{method:'POST',token,body:{...proof(ended,runId),salary:499,rank:7}});assert.equal(complete.status,200);assert.equal(complete.body.endingId,ended.endingId);assert.equal(complete.body.recorded,true);assert.equal(complete.body.totalRuns,1);assert.deepEqual(complete.body.characters,deriveCharacterStats(ended));
  const duplicate=await h.call('/api/complete',{method:'POST',token,body:proof(ended,runId)});assert.equal(duplicate.status,200);assert.equal(duplicate.body.duplicate,true);assert.equal(duplicate.body.totalRuns,1);
  const delayed=await h.call('/api/characters',{method:'POST',token,body:proof(initial,runId)});assert.equal(delayed.status,200);assert.deepEqual(delayed.body.characters,complete.body.characters);
  const saved=h.sql.exec('SELECT role_id,actual_role_id,salary,rank FROM runs WHERE id = ?',runId).one();assert.equal(saved.role_id,ended.roleId);assert.equal(saved.actual_role_id,ended.actualRoleId);assert.equal(saved.salary,ended.pay);assert.equal(saved.rank,ended.rank);
 }
 const stats=await h.call('/api/stats');assert.equal(stats.body.totalRuns,2);assert.doesNotMatch(JSON.stringify(stats.body),/recruitmentContext|recruitmentOutcome|patronage|playerId|runId|seed|actions|history/);
});

test('Worker rejects a different seed-derived career, skipped or repeated welcomes and diverging choices on an existing anonymous run',async t=>{
 const h=harness(t),token=await h.register(),initial=begin('godson'),rick=choose(initial,0),princess=choose(rick,0),done=choose(princess,0);
 const wrongRole=ROLES.find(role=>role.id!==initial.roleId).id;
 const forgedRole=await h.call('/api/characters',{method:'POST',token,body:{...proof(initial),roleId:wrongRole,patronage:{title:'乾兒子',fromPay:1,appointedPay:499,historyIndex:0}}});assert.equal(forgedRole.status,400);assert.equal(forgedRole.body.error,'invalid_replay');
 const attacks=[
  [...initial.actions,{type:'choice',eventId:'recruitment60-rick',index:0}],
  [...rick.actions,{type:'choice',eventId:'recruitment60-princess',index:0}],
  [...princess.actions,{type:'choice',eventId:'recruitment60-rick',index:0}],
  [...done.actions,{type:'choice',eventId:'recruitment60-princess',index:0}],
  [...rick.actions,{type:'exit'}],
  [...rick.actions,{type:'break'}],
  [...rick.actions,{type:'choice',eventId:'recruitment60-rick',index:99}],
 ];
 for(const actions of attacks){const response=await h.call('/api/characters',{method:'POST',token,body:proof(initial,randomUUID(),actions)});assert.equal(response.status,400);assert.match(response.body.error,/^invalid_(?:actions|replay)$/);}
 const id=randomUUID();assert.equal((await h.call('/api/characters',{method:'POST',token,body:proof(princess,id)})).status,200);
 const alternate=choose(rick,1),fork=await h.call('/api/characters',{method:'POST',token,body:proof(alternate,id)});assert.equal(fork.status,409);
 const stranger=await h.register();assert.equal((await h.call('/api/characters',{method:'POST',token:stranger,body:proof(princess,id)})).status,409);
 assert.equal((await h.call('/api/stats')).body.totalRuns,0);
});

test('supplying appointment metadata on an ordinary or historical life never produces a special job or jealousy record',async t=>{
 const h=harness(t);
 for(const initial of [begin('normal'),E.enableActivitySchedule(E.createRun('system','e39-cal46-kin49-g-e-s-m-h-a1b2c3'))]){
  const token=await h.register(),run=choose(initial,0);assert.equal(run.patronage,null);
  const response=await h.call('/api/characters',{method:'POST',token,body:{...proof(run),patronage:{title:'乾女兒',historyIndex:0,fromPay:1,appointedPay:499},recruitmentOutcome:{version:1,kind:'appointment',variant:'daughter',target:'rick',affinityDelta:999},flags:{directPatronage:true},pay:499}});
  assert.equal(response.status,200);assert.deepEqual(response.body.characters,deriveCharacterStats(run));assert.equal(response.body.totalRuns,0);
 }
});
