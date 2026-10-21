import {ObservationStore} from '../worker/observations.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {AchievementStore} from '../worker/achievements.js';
import {CharacterStore} from '../worker/characters.js';
import {FeedbackStore} from '../worker/feedback-store.js';
import {validateFeedback,validatePublisherToken} from '../worker/feedback.js';
import * as http from '../worker/http.js';
import {replayRun,VERSION,MAX_TURNS} from '../dist/engine.js';
import {ROLE_MAP} from '../dist/roles.js';
import {ENDINGS} from '../dist/endings.js';

// Real Worker handlers and in-memory SQLite: only natural, publicly replayable
// action prefixes establish milestones; client badge lists are never evidence.
const workerSource=readFileSync(new URL('../worker/index.js',import.meta.url),'utf8')
 .replace(/^import .*;\n/gm,'')
 .replace('export class HedoArchive','globalThis.HedoArchive=class HedoArchive')
 .replace('export default','globalThis.worker=');
const {routes}=JSON.parse(readFileSync(new URL('./fixtures/chronicle-achievement-routes.json',import.meta.url),'utf8'));
const newIds=['banquet-first-love','sonny-press-conference','sonny-unplayed-champion'];
const proof=(fixture,runId=randomUUID())=>({runId,roleId:fixture.roleId,seed:fixture.seed,actions:fixture.actions});
const ids=response=>response.body.achievements.map(row=>row.id);

function harness(t){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());db.exec('PRAGMA foreign_keys = ON');
 const sql={exec(query,...args){let rows=[];if(!args.length&&query.includes(';'))db.exec(query);else{const statement=db.prepare(query);if(statement.columns().length)rows=statement.all(...args);else statement.run(...args);}return{toArray:()=>rows,one:()=>{assert.equal(rows.length,1);return rows[0];}};}};
 const storage={sql,transactionSync(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}},async getAlarm(){return null;},async setAlarm(){}};
 const ctx={storage,blockConcurrencyWhile:fn=>fn()};
 const scope=vm.createContext({DurableObject:class{constructor(context){this.ctx=context;}},replayRun,VERSION,MAX_TURNS,ROLE_MAP,ENDINGS,...http,validateFeedback,validatePublisherToken,FeedbackStore,AchievementStore,CharacterStore,ObservationStore,crypto,Response,Request,URL,Date});
 vm.runInContext(workerSource,scope);const archive=new scope.HedoArchive(ctx,{});
 const call=async(path,{method='GET',token,body}={})=>{
  archive.rate=new http.RateGuard();const headers={};if(token)headers.Authorization=`Bearer ${token}`;if(body)headers['Content-Type']='application/json';
  const response=await archive.fetch(new Request(`https://game.example${path}`,{method,headers,body:body?JSON.stringify(body):undefined}));
  return{status:response.status,body:await response.json()};
 };
 const register=async()=>{const token=randomBytes(32).toString('hex'),response=await call('/api/player',{method:'POST',body:{token}});assert.equal(response.status,200);return{token,id:response.body.playerId};};
 const submit=(player,fixture,runId)=>call('/api/achievements',{method:'POST',token:player.token,body:proof(fixture,runId)});
 return{sql,call,register,submit};
}

test('chronicle HTTP proofs award both First Love branches and each 阿福 response only after resolution, idempotently',async t=>{
 const h=harness(t);
 for(const fixture of routes){
  const player=await h.register(),runId=randomUUID(),before={...fixture,actions:fixture.actions.slice(0,-1)};
  assert.equal(replayRun(before.roleId,before.seed,before.actions).eventId,fixture.eventId);
  const identity=h.sql.exec('SELECT * FROM players WHERE id=?',player.id).one();
  const menu=await h.call('/api/achievements',{method:'POST',token:player.token,body:{
   ...proof(before,runId),achievements:newIds,flags:{banquet_stage:999},
   history:[{eventId:fixture.eventId,kind:fixture.eventId==='banquet-welcome'?'banquet':'daily',speaker:fixture.eventId==='banquet-welcome'?'rick':'sonny',choiceIndex:fixture.choiceIndex,result:'fake result',eventOutcome:{label:'尾牙點歌台',result:'成功搶麥'}}],
  }});
  assert.equal(menu.status,200);assert.equal(menu.body.verified,true);
  assert.ok(!ids(menu).includes(fixture.achievementId),'unresolved menu and supplied evidence earn no badge');
  const earned=await h.submit(player,fixture,runId);
  assert.equal(earned.status,200,fixture.id);assert.equal(earned.body.verified,true);
  assert.ok(ids(earned).includes(fixture.achievementId));assert.ok(earned.body.newlyUnlocked.includes(fixture.achievementId));
  assert.equal(earned.body.totalRuns,0);assert.deepEqual(earned.body.unlocked,[]);
  for(let attempt=0;attempt<2;attempt++){
   const retry=await h.submit(player,fixture,runId);
   assert.equal(retry.status,200);assert.deepEqual(retry.body.newlyUnlocked,[]);
   assert.deepEqual(retry.body.achievements,earned.body.achievements,'first-earned times remain unchanged');
   assert.deepEqual(retry.body.characters,earned.body.characters,'retries do not repeat character interactions');
  }
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM player_achievements WHERE player_id=? AND achievement_id=?',player.id,fixture.achievementId).one().n,1);
  assert.deepEqual(h.sql.exec('SELECT * FROM players WHERE id=?',player.id).one(),identity,'anonymous identity and credential hash are unchanged');
  const me=await h.call('/api/me',{token:player.token});assert.equal(me.status,200);assert.equal(me.body.playerId,player.id);assert.equal(me.body.totalRuns,0);
  assert.deepEqual(me.body.achievements,earned.body.achievements);
  const stored=JSON.stringify([...h.sql.exec('SELECT * FROM achievement_runs').toArray(),...h.sql.exec('SELECT * FROM character_runs').toArray(),...h.sql.exec('SELECT * FROM player_achievements').toArray()]);
  assert.ok(!stored.includes(fixture.seed));assert.ok(!stored.includes(player.token));assert.ok(!stored.includes('fake result'));
 }
 assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM runs').one().n,0);
 assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM player_endings').one().n,0);
 const stats=await h.call('/api/stats');assert.equal(stats.status,200);assert.equal(stats.body.totalRuns,0);assert.equal(stats.body.uniqueEndings,0);
 const publicJSON=JSON.stringify(stats.body);for(const id of newIds)assert.ok(!publicJSON.includes(id),'public ending statistics reveal no personal badge list');
});

test('invalid replay cannot manufacture chronicle badges or change an existing anonymous collection',async t=>{
 const h=harness(t),player=await h.register(),fixture=routes.find(row=>row.achievementId==='sonny-press-conference');assert.ok(fixture);
 const before=await h.call('/api/me',{token:player.token}),forged=proof(fixture);
 forged.actions=[{type:'choice',eventId:'video-pizza-overtime',index:1}];
 const rejected=await h.call('/api/achievements',{method:'POST',token:player.token,body:{...forged,achievements:newIds}});
 assert.equal(rejected.status,400);assert.equal(rejected.body.error,'invalid_replay');
 assert.deepEqual((await h.call('/api/me',{token:player.token})).body,before.body);
 assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM player_achievements').one().n,0);
});
