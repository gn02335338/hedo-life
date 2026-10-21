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
import {createRun,applyChoice,advance,replayRun,VERSION,MAX_TURNS} from '../dist/engine.js';
import {ROLE_MAP} from '../dist/roles.js';
import {ENDINGS} from '../dist/endings.js';
import {deriveCharacterStats} from '../dist/character-stats.js';

const badgeId='ai-auto-increment',eventId='ai31-auto-increment';
const {routes}=JSON.parse(readFileSync(new URL('./fixtures/ai-routes-v31.json',import.meta.url),'utf8'));
const source=readFileSync(new URL('../worker/index.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export class HedoArchive','globalThis.HedoArchive=class HedoArchive').replace('export default','globalThis.worker=');
const proof=(route,runId,actions=route.actions)=>({runId,roleId:route.roleId,seed:route.seed,actions});
const ids=response=>response.body.achievements.map(row=>row.id);

// Actual Worker handlers, isolated SQLite and synthetic replay proofs only.
// These test runs are never sent to production collections or observations.
function harness(t){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());db.exec('PRAGMA foreign_keys = ON');
 const sql={exec(query,...args){let rows=[];if(!args.length&&query.includes(';'))db.exec(query);else{const statement=db.prepare(query);if(statement.columns().length)rows=statement.all(...args);else statement.run(...args);}return{toArray:()=>rows,one:()=>{assert.equal(rows.length,1);return rows[0];}};}};
 const storage={sql,transactionSync(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}},async getAlarm(){return null;},async setAlarm(){}};
 const scope=vm.createContext({DurableObject:class{constructor(ctx){this.ctx=ctx;}},replayRun,VERSION,MAX_TURNS,ROLE_MAP,ENDINGS,...http,validateFeedback,validatePublisherToken,FeedbackStore,AchievementStore,CharacterStore,ObservationStore,crypto,Response,Request,URL,Date});
 vm.runInContext(source,scope);const archive=new scope.HedoArchive({storage,blockConcurrencyWhile:fn=>fn()},{});
 const call=async(path,{method='GET',token,body}={})=>{
  archive.rate=new http.RateGuard();const headers={};if(token)headers.Authorization=`Bearer ${token}`;if(body)headers['Content-Type']='application/json';
  const response=await archive.fetch(new Request(`https://game.example${path}`,{method,headers,body:body?JSON.stringify(body):undefined}));return{status:response.status,body:await response.json()};
 };
 const register=async()=>{const token=randomBytes(32).toString('hex'),response=await call('/api/player',{method:'POST',body:{token}});assert.equal(response.status,200);return{token,id:response.body.playerId};};
 return{sql,call,register};
}

test('all three actual AI responses earn the badge only after resolution; progress and completion preserve anonymous identity and first-earned times',async t=>{
 const h=harness(t);assert.equal(routes.length,3);
 for(const route of routes){
  const player=await h.register(),other=await h.register(),runId=randomUUID(),identity=h.sql.exec('SELECT * FROM players WHERE id=?',player.id).one();
  const before=await h.call('/api/achievements',{method:'POST',token:player.token,body:{...proof(route,runId,route.beforeActions),
   achievements:[badgeId],flags:{ai_auto_increment:999},actualRoleId:'ai',
   history:[{eventId,kind:'daily',speaker:'rick',choiceIndex:route.index,result:'AUTO_INCREMENT 已揭曉'}],
  }});
  assert.equal(before.status,200);assert.ok(!ids(before).includes(badgeId),'reaching the unanswered scene and supplying a flag is not proof');assert.equal(before.body.totalRuns,0);
  const resolved=replayRun(route.roleId,route.seed,route.actions),earned=await h.call('/api/achievements',{method:'POST',token:player.token,body:proof(route,runId)});
  assert.equal(earned.status,200,route.id);assert.equal(earned.body.verified,true);assert.ok(ids(earned).includes(badgeId));assert.ok(earned.body.newlyUnlocked.includes(badgeId));assert.equal(earned.body.totalRuns,0);
  assert.deepEqual(earned.body.characters,deriveCharacterStats(resolved));
  for(let retry=0;retry<2;retry++){
   const duplicate=await h.call('/api/achievements',{method:'POST',token:player.token,body:proof(route,runId)});assert.equal(duplicate.status,200);assert.deepEqual(duplicate.body.newlyUnlocked,[]);assert.deepEqual(duplicate.body.achievements,earned.body.achievements);assert.deepEqual(duplicate.body.characters,earned.body.characters);
  }
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM player_achievements WHERE player_id=? AND achievement_id=?',player.id,badgeId).one().n,1);
  const completed=await h.call('/api/complete',{method:'POST',token:player.token,body:proof(route,runId,route.completionActions)});assert.equal(completed.status,200);assert.equal(completed.body.endingId,route.endingId);assert.equal(completed.body.totalRuns,1);assert.ok(ids(completed).includes(badgeId));
  assert.equal(completed.body.achievements.find(row=>row.id===badgeId).unlockedAt,earned.body.achievements.find(row=>row.id===badgeId).unlockedAt);
  const completedAgain=await h.call('/api/complete',{method:'POST',token:player.token,body:proof(route,runId,route.completionActions)});assert.equal(completedAgain.status,200);assert.equal(completedAgain.body.duplicate,true);assert.equal(completedAgain.body.totalRuns,1);
  const foreign=await h.call('/api/achievements',{method:'POST',token:other.token,body:proof(route,runId)});assert.equal(foreign.status,409);
  assert.deepEqual(h.sql.exec('SELECT * FROM players WHERE id=?',player.id).one(),identity);
  const untouched=await h.call('/api/me',{token:other.token});assert.ok(!ids(untouched).includes(badgeId));assert.equal(untouched.body.totalRuns,0);
  const retained=JSON.stringify([...h.sql.exec('SELECT * FROM achievement_runs').toArray(),...h.sql.exec('SELECT * FROM character_runs').toArray()]);assert.ok(!retained.includes(route.seed));assert.ok(!retained.includes(player.token));assert.ok(!retained.includes(eventId));
 }
 const stats=await h.call('/api/stats');assert.equal(stats.body.totalRuns,3);assert.ok(!JSON.stringify(stats.body).includes(badgeId));
});

test('a retained valid AI proof backfills the missing badge without repeating character counts or replacing the legacy assistant souvenir',async t=>{
 const h=harness(t),player=await h.register(),route=routes[0],runId=randomUUID(),oldTime='2026-10-01T00:00:00.000Z';
 h.sql.exec('INSERT INTO player_achievements (player_id,achievement_id,first_seen_at) VALUES (?,?,?)',player.id,'assistant',oldTime);
 const first=await h.call('/api/achievements',{method:'POST',token:player.token,body:proof(route,runId)});assert.equal(first.status,200);
 h.sql.exec('DELETE FROM player_achievements WHERE player_id=? AND achievement_id=?',player.id,badgeId);
 const restored=await h.call('/api/achievements',{method:'POST',token:player.token,body:proof(route,runId)});assert.equal(restored.status,200);assert.deepEqual(restored.body.newlyUnlocked,[badgeId]);assert.deepEqual(restored.body.characters,first.body.characters);assert.equal(restored.body.totalRuns,0);
 assert.equal(restored.body.achievements.find(row=>row.id==='assistant').unlockedAt,oldTime);assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM runs').one().n,0);
});

test('old cohorts, reassigned AI offers and forged event actions cannot obtain the new badge or rewrite a committed choice',async t=>{
 const h=harness(t),player=await h.register(),route=routes[0],runId=randomUUID();
 const first=await h.call('/api/achievements',{method:'POST',token:player.token,body:proof(route,runId)});assert.equal(first.status,200);
 const fork=routes.find(row=>row.index===1);assert.equal(fork.seed,route.seed);assert.deepEqual(fork.beforeActions,route.beforeActions);
 assert.equal((await h.call('/api/achievements',{method:'POST',token:player.token,body:proof(fork,runId)})).status,409);
 for(const cohort of ['e17','e29','e30']){
  const old={runId:randomUUID(),roleId:'ai',seed:`${cohort}-ai-badge-forged`,actions:[{type:'choice',eventId:'onboarding',index:0},{type:'choice',eventId,index:0}]};
  const response=await h.call('/api/achievements',{method:'POST',token:player.token,body:{...old,achievements:[badgeId],flags:{ai_auto_increment:999}}});assert.equal(response.status,400);assert.equal(response.body.error,'invalid_replay');
 }
 let reassigned;
 for(let index=0;index<50;index++){const run=createRun('ai',`e31-ai-api-reassign-${index}`);if(run.actualRoleId!=='ai'){reassigned=advance(applyChoice(run,0));break;}}
 assert.ok(reassigned);const other=await h.register(),payload={runId:randomUUID(),roleId:reassigned.roleId,seed:reassigned.seed,actions:reassigned.actions};
 const supplied=await h.call('/api/achievements',{method:'POST',token:other.token,body:{...payload,actualRoleId:'ai',achievements:[badgeId],flags:{ai_auto_increment:1},history:[{eventId,kind:'daily',speaker:'rick',choiceIndex:0,result:'fake'}]}});assert.equal(supplied.status,200);assert.ok(!ids(supplied).includes(badgeId));
 const invalid=await h.call('/api/achievements',{method:'POST',token:other.token,body:{...payload,runId:randomUUID(),actions:[{type:'choice',eventId,index:0}]}});assert.equal(invalid.status,400);assert.equal(invalid.body.error,'invalid_replay');
 assert.equal((await h.call('/api/stats')).body.totalRuns,0);
});
