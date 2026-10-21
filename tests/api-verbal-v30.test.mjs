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
import {replayRun,VERSION,MAX_TURNS} from '../dist/engine.js';
import {ROLE_MAP} from '../dist/roles.js';
import {ENDINGS} from '../dist/endings.js';
import {CHARACTER_IDS,CHARACTER_METRICS,deriveCharacterStats} from '../dist/character-stats.js';

const source=readFileSync(new URL('../worker/index.js',import.meta.url),'utf8')
 .replace(/^import .*;\n/gm,'').replace('export class HedoArchive','globalThis.HedoArchive=class HedoArchive').replace('export default','globalThis.worker=');
const {routes}=JSON.parse(readFileSync(new URL('./fixtures/verbal-routes-v30.json',import.meta.url),'utf8'));
const proof=(route,runId,actions=route.actions)=>({runId,roleId:route.roleId,seed:route.seed,actions});

// Replay the real Worker in isolated SQLite; generated conversations never
// enter production player collections, character counters or observations.
function harness(t){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());db.exec('PRAGMA foreign_keys = ON');
 const sql={exec(query,...args){
  let rows=[];
  if(!args.length&&query.includes(';'))db.exec(query);
  else{const statement=db.prepare(query);if(statement.columns().length)rows=statement.all(...args);else statement.run(...args);}
  return {toArray:()=>rows,one:()=>{assert.equal(rows.length,1);return rows[0];}};
 }};
 const storage={sql,transactionSync(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}},async getAlarm(){return null;},async setAlarm(){}};
 const context=vm.createContext({DurableObject:class{constructor(ctx){this.ctx=ctx;}},replayRun,VERSION,MAX_TURNS,ROLE_MAP,ENDINGS,
  ...http,validateFeedback,validatePublisherToken,FeedbackStore,AchievementStore,CharacterStore,ObservationStore,crypto,Response,Request,URL,Date});
 vm.runInContext(source,context);const archive=new context.HedoArchive({storage,blockConcurrencyWhile:fn=>fn()},{});
 const call=async(path,{method='GET',token,body}={})=>{
  archive.rate=new http.RateGuard();const headers={};if(token)headers.Authorization=`Bearer ${token}`;if(body)headers['Content-Type']='application/json';
  const response=await archive.fetch(new Request(`https://game.example${path}`,{method,headers,body:body?JSON.stringify(body):undefined}));
  return {status:response.status,body:await response.json()};
 };
 const register=async()=>{const token=randomBytes(32).toString('hex'),response=await call('/api/player',{method:'POST',body:{token}});assert.equal(response.status,200);return {token,id:response.body.playerId};};
 return {sql,call,register};
}

test('all verbal targets, RNG branches, legal decisions and interrupted contexts verify through progress and completion exactly once',async t=>{
 const h=harness(t),stranger=await h.register(),baseline=await h.call('/api/characters');
 const expected=Object.fromEntries(CHARACTER_IDS.map(id=>[id,Object.fromEntries(CHARACTER_METRICS.map(key=>[key,0]))]));
 const witnesses=routes.filter(route=>route.kind!=='blocked');assert.ok(witnesses.length>=60);
 for(const route of witnesses){
  const player=await h.register(),runId=randomUUID();
  if(route.baseActions.length){
   const before=await h.call('/api/characters',{method:'POST',token:player.token,body:proof(route,runId,route.baseActions)});
   assert.equal(before.status,200,`${route.id}/prefix`);assert.equal(before.body.totalRuns,0);
  }
  const run=replayRun(route.roleId,route.seed,route.actions),accepted=await h.call('/api/characters',{method:'POST',token:player.token,body:{...proof(route,runId),
   verbalContext:{target:'wing',outcome:'support',legalResult:'withdrawn'},verbalOutcome:{kind:'support',target:'wing',affinityDelta:999},lastVerbalTurn:-1,
   characters:[{id:'wing',realHits:9999,imaginedHits:9999,affinityGained:9999}],history:[{kind:'verbal',speaker:'wing'}],stats:{cash:100,boss:100,mood:100},
  }});
  assert.equal(accepted.status,200,route.id);assert.equal(accepted.body.verified,true);assert.equal(accepted.body.totalRuns,0);
  assert.deepEqual(accepted.body.characters,deriveCharacterStats(run));
  for(const endpoint of ['/api/characters','/api/achievements']){
   const repeat=await h.call(endpoint,{method:'POST',token:player.token,body:proof(route,runId)});assert.equal(repeat.status,200);assert.deepEqual(repeat.body.characters,accepted.body.characters);
  }
  const ended=replayRun(route.roleId,route.seed,route.completionActions);assert.equal(ended.completed,true);
  const complete=await h.call('/api/complete',{method:'POST',token:player.token,body:{...proof(route,runId,route.completionActions),endingId:'nasdaq-executive',completed:true}});
  assert.equal(complete.status,200,`${route.id}/complete`);assert.equal(complete.body.endingId,ended.endingId);assert.equal(complete.body.recorded,true);assert.equal(complete.body.totalRuns,1);
  assert.deepEqual(complete.body.characters,deriveCharacterStats(ended));
  const duplicate=await h.call('/api/complete',{method:'POST',token:player.token,body:proof(route,runId,route.completionActions)});assert.equal(duplicate.status,200);assert.equal(duplicate.body.duplicate,true);assert.equal(duplicate.body.totalRuns,1);
  if(route.baseActions.length){const delayed=await h.call('/api/characters',{method:'POST',token:player.token,body:proof(route,runId,route.baseActions)});assert.equal(delayed.status,200);assert.deepEqual(delayed.body.characters,complete.body.characters);}
  const foreign=await h.call('/api/characters',{method:'POST',token:stranger.token,body:proof(route,runId)});assert.equal(foreign.status,409);
  for(const row of complete.body.characters)for(const key of CHARACTER_METRICS)expected[row.id][key]+=row[key];
  const stored=JSON.stringify(h.sql.exec('SELECT * FROM character_runs WHERE id = ?',runId).toArray());assert.ok(!stored.includes(route.seed));assert.ok(!stored.includes('verbal-release'));assert.ok(!stored.includes(player.token));
 }
 const publicAfter=await h.call('/api/characters');assert.equal(publicAfter.body.trackingSince,baseline.body.trackingSince);
 for(const row of publicAfter.body.characters)for(const key of CHARACTER_METRICS)assert.equal(row[key],expected[row.id][key],`${row.id}/${key}`);
 assert.doesNotMatch(JSON.stringify(publicAfter.body),/verbalContext|verbalOutcome|lastVerbalTurn|playerId|runId|seed|actions|history|legalResult/);
 const untouched=await h.call('/api/me',{token:stranger.token});assert.equal(untouched.body.totalRuns,0);assert.ok(untouched.body.characters.every(row=>CHARACTER_METRICS.every(key=>row[key]===0)));
 assert.equal((await h.call('/api/stats')).body.totalRuns,witnesses.length);
});

test('verbal replay rejects phase, target, scene, cohort and payload forgeries, and a committed target cannot be replaced',async t=>{
 const h=harness(t),player=await h.register(),other=await h.register(),route=routes.find(row=>row.id==='group-result-sonny');assert.ok(route);
 const id=randomUUID(),accepted=await h.call('/api/characters',{method:'POST',token:player.token,body:proof(route,id)});assert.equal(accepted.status,200);
 const verbal=route.actions.findLast(action=>action.type==='verbal'),prefix=route.actions.slice(0,route.actions.lastIndexOf(verbal));assert.ok(verbal);
 const fork=[...prefix,{...verbal,target:'erich'}];
 const changed=await h.call('/api/characters',{method:'POST',token:player.token,body:proof(route,id,fork)});assert.equal(changed.status,409);
 assert.equal((await h.call('/api/characters',{method:'POST',token:other.token,body:proof(route,id)})).status,409);
 for(const action of [
  {...verbal,target:'wing'}, {...verbal,target:'unknown'}, {...verbal,target:null}, {...verbal,phase:'event'},
  {...verbal,phase:'later'}, {...verbal,eventId:'onboarding'}, {...verbal,outcome:'support'}, {...verbal,affinityDelta:12},
 ]){
  const response=await h.call('/api/characters',{method:'POST',token:player.token,body:proof(route,randomUUID(),[...prefix,action])});assert.equal(response.status,400,JSON.stringify(action));assert.match(response.body.error,/invalid_actions|invalid_replay/);
 }
 const recursive=await h.call('/api/characters',{method:'POST',token:player.token,body:proof(route,randomUUID(),[...route.actions,verbal])});assert.equal(recursive.status,400);
 const old=await h.call('/api/characters',{method:'POST',token:player.token,body:{...proof(route,randomUUID(),[{type:'verbal',phase:'event',eventId:'onboarding'}]),seed:'e29-verbal-forged'}});assert.equal(old.status,400);assert.match(old.body.error,/invalid_actions|invalid_replay/);
 const incomplete=await h.call('/api/complete',{method:'POST',token:player.token,body:{...proof(route,randomUUID(),route.baseActions),completed:true,endingId:route.endingId,verbalOutcome:{kind:'support'}}});assert.equal(incomplete.status,400);assert.equal(incomplete.body.error,'incomplete_run');
 assert.equal((await h.call('/api/characters',{method:'POST',body:proof(route,randomUUID())})).status,401);assert.equal((await h.call('/api/stats')).body.totalRuns,0);
});
