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
const fixture=JSON.parse(readFileSync(new URL('./fixtures/expansion-v65.json',import.meta.url),'utf8'));
const named=id=>{const row=fixture.routes.find(row=>row.id===id);assert.ok(row,id);return row;};
const proof=(row,runId=randomUUID(),actions=row.actions)=>({runId,roleId:row.roleId,seed:row.seed,actions});
function harness(t){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());db.exec('PRAGMA foreign_keys = ON');
 const sql={exec(query,...args){let rows=[];if(!args.length&&query.includes(';'))db.exec(query);else{const statement=db.prepare(query);if(statement.columns().length)rows=statement.all(...args);else statement.run(...args);}return{toArray:()=>rows,one:()=>{assert.equal(rows.length,1);return rows[0];}};}};
 const storage={sql,transactionSync(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}},async getAlarm(){return null;},async setAlarm(){}};
 const context=vm.createContext({DurableObject:class{constructor(ctx){this.ctx=ctx;}},replayRun:E.replayRun,VERSION:E.VERSION,MAX_TURNS:E.MAX_TURNS,ROLE_MAP,ENDINGS,...http,validateFeedback,validatePublisherToken,FeedbackStore,AchievementStore,CharacterStore,ObservationStore,crypto,Response,Request,URL,Date});
 vm.runInContext(workerSource,context);const archive=new context.HedoArchive({storage,blockConcurrencyWhile:fn=>fn()},{});
 const call=async(path,{method='GET',token,body}={})=>{archive.rate=new http.RateGuard();const headers={};if(token)headers.Authorization=`Bearer ${token}`;if(body)headers['Content-Type']='application/json';const response=await archive.fetch(new Request(`https://game.example${path}`,{method,headers,body:body?JSON.stringify(body):undefined}));return{status:response.status,body:await response.json()};};
 const register=async()=>{const token=randomBytes(32).toString('hex');assert.equal((await call('/api/player',{method:'POST',body:{token}})).status,200);return token;};return{sql,call,register};
}

test('Worker projects canonical Camel, three-team diet, new cast and Blockchain proofs, ignoring client-supplied wins',async t=>{
 const h=harness(t);
 for(const id of ['camel-round-6','camel-departure','diet-return-johnny','diet-return-annie_yu','diet-return-sonny','blockchain-return','blockchain-departure',...['zoe','action','hester','simon','james','johnny'].map(id=>`cast-${id}-choice-0`)]){
  const token=await h.register(),row=named(id),run=E.replayRun(row.roleId,row.seed,row.actions),runId=randomUUID(),body={...proof(row,runId),completed:true,endingId:'nasdaq-system',stats:{cash:9999},activityOutcome:{id:'camel',camel:{points:999,die:6}},characters:[{id:'sonny',realHits:9999}]};
  const response=await h.call('/api/characters',{method:'POST',token,body});assert.equal(response.status,200,id);assert.deepEqual(response.body.characters,deriveCharacterStats(run),id);assert.equal(response.body.totalRuns,0);
  const achievements=await h.call('/api/achievements',{method:'POST',token,body});assert.equal(achievements.status,200);assert.deepEqual(achievements.body.achievements.map(row=>row.id).sort(),deriveAchievements(run).sort());
  const repeat=await h.call('/api/characters',{method:'POST',token,body:proof(row,runId)});assert.deepEqual(repeat.body.characters,response.body.characters);assert.equal((await h.call('/api/complete',{method:'POST',token,body})).body.error,'incomplete_run');
 }
 assert.equal((await h.call('/api/stats')).body.totalRuns,0);
});

test('strict API grammar refuses supplied dice, scores, extra action keys, invalid permutations, stale scenes and a seventh roll',async t=>{
 const h=harness(t),token=await h.register(),row=named('camel-play-0'),input={kind:'camel',move:0,prediction:[2,1,0]},action={type:'activity-play',version:1,eventId:'activity44-camel-1',index:1,input};
 const badInputs=[{...input,die:3},{...input,color:0},{...input,score:12},{...input,moves:[0,1,2]},{...input,move:3},{...input,move:0.5},{...input,prediction:[0,0,2]},{...input,prediction:['0',1,2]}];
 for(const invalid of badInputs){const response=await h.call('/api/characters',{method:'POST',token,body:proof(row,randomUUID(),[...row.actions,{...action,input:invalid}])});assert.equal(response.status,400);assert.equal(response.body.error,'invalid_actions');}
 for(const invalid of [{...action,version:2},{...action,index:0},{...action,score:100},{...action,eventId:'activity44-camel-0'}]){const response=await h.call('/api/characters',{method:'POST',token,body:proof(row,randomUUID(),[...row.actions,invalid])});assert.equal(response.status,400);assert.match(response.body.error,/^invalid_(?:actions|replay)$/);}
 for(const id of ['camel-round-6','camel-departure']){const source=named(id),response=await h.call('/api/characters',{method:'POST',token,body:proof(source,randomUUID(),[...source.actions,action])});assert.equal(response.status,400);assert.equal(response.body.error,'invalid_replay');}
 const locked=named('camel-play-1'),wrongPrediction=await h.call('/api/characters',{method:'POST',token,body:proof(locked,randomUUID(),[...locked.actions,{...action,input:{...input,prediction:[0,1,2]}}])});assert.equal(wrongPrediction.status,400);assert.equal(wrongPrediction.body.error,'invalid_replay');
 for(const seed of ['e39-r63-n-0000000000000000000000','e39-r62-n-0000000000000000000000']){const body={...proof(row),seed,actions:[{type:'activity-schedule',version:1},{type:'choice',eventId:'onboarding',index:0},action]},response=await h.call('/api/characters',{method:'POST',token,body});assert.equal(response.status,400);assert.equal(response.body.error,'invalid_actions');}
});

test('duplicate completed lives stay single records and delayed prefixes cannot roll interaction progress backward',async t=>{
 const h=harness(t),token=await h.register();
 for(const id of ['camel-completed','blockchain-completed']){
  const row=named(id),runId=randomUUID(),body={...proof(row,runId),endingId:'nasdaq-system'},canonical=E.replayRun(row.roleId,row.seed,row.actions);assert.equal(canonical.completed,true);
  const done=await h.call('/api/complete',{method:'POST',token,body});assert.equal(done.status,200);assert.equal(done.body.duplicate,false);assert.equal(done.body.endingId,canonical.endingId);
  const retry=await h.call('/api/complete',{method:'POST',token,body});assert.equal(retry.status,200);assert.equal(retry.body.duplicate,true);
 }
 assert.equal((await h.call('/api/stats')).body.totalRuns,2);assert.equal((await h.call('/api/me',{token})).body.totalRuns,2);
 const row=named('camel-round-6'),runId=randomUUID(),latest=await h.call('/api/characters',{method:'POST',token,body:proof(row,runId)}),early=named('camel-play-1');
 const delayed=await h.call('/api/characters',{method:'POST',token,body:proof(row,runId,early.actions)});assert.equal(delayed.status,200);assert.deepEqual(delayed.body.characters,latest.body.characters);
 const other=await h.register();assert.equal((await h.call('/api/characters',{method:'POST',token:other,body:proof(row,runId)})).status,409);
 const stats=(await h.call('/api/stats')).body;assert.doesNotMatch(JSON.stringify(stats),/camelState|blockchainContext|history|actions|prediction|playerId|runId|seed/);
});
