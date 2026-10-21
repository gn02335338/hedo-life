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
import {ACHIEVEMENTS_V32} from '../dist/achievements-v32.js';
import {DEPARTURE_WAYS,departureWays} from '../worker/departures.js';

const source=readFileSync(new URL('../worker/index.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export class HedoArchive','globalThis.HedoArchive=class HedoArchive').replace('export default','globalThis.worker=');
const {routes}=JSON.parse(readFileSync(new URL('./fixtures/v32-routes.json',import.meta.url),'utf8'));
const oldRoutes=JSON.parse(readFileSync(new URL('./fixtures/legacy-e31-routes.json',import.meta.url),'utf8'));
const freshIds=new Set(ACHIEVEMENTS_V32.map(item=>item.id));
const proof=(route,runId=randomUUID(),actions=route.actions)=>({runId,roleId:route.roleId,seed:route.seed,actions});
const replay=(route,actions=route.actions)=>{try{return engine.replayRun(route.roleId,route.seed,actions);}catch(error){error.message=`${route.id}: ${error.message}`;throw error;}};
const ids=response=>response.body.achievements.map(row=>row.id);
const row=id=>{const route=routes.find(route=>route.id===id);assert.ok(route,`Missing natural scene-verbal fixture ${id}`);return route;};
const speech=run=>run.history.findLast(entry=>entry.verbalOutcome?.version===2);

// The actual Worker handlers run against isolated SQLite. No generated proof,
// dialogue, anonymous player or archive count is sent to the live service.
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
 const post=(player,route,runId,actions=route.actions,path='/api/achievements',extra={})=>call(path,{method:'POST',token:player.token,body:{...proof(route,runId,actions),...extra}});
 return{sql,call,register,post};
}


test('all 286 new-cohort ending witnesses verify on the real API and retain anonymous aggregate partitions on retry',async t=>{
 const h=harness(t),families=new Map();assert.ok(routes.length>=286);
 for(const route of routes){
  assert.match(route.seed,/^e32-/);const player=await h.register(),runId=randomUUID(),run=replay(route);
  assert.equal(run.completed,true,route.ending);assert.equal(run.endingId,route.ending);families.set(route.target||run.endingId.slice(0,run.endingId.lastIndexOf('-')),true);
  const prefix=route.actions.slice(0,-1);if(prefix.length){const progress=await h.post(player,route,runId,prefix);assert.equal(progress.status,200,route.ending);assert.equal(progress.body.totalRuns,0);}
  const forged={endingId:'nasdaq-system',departureWay:'retirement',achievements:[...freshIds],companyContext:{route:'buyer'},verbalOutcome:{target:'wing',kind:'support'}};
  const response=await h.post(player,route,runId,route.actions,'/api/complete',forged);
  assert.equal(response.status,200,route.ending);assert.equal(response.body.endingId,route.ending);assert.equal(response.body.totalRuns,1);assert.equal(response.body.duplicate,false);
  assert.deepEqual(response.body.characters,deriveCharacterStats(run));assert.deepEqual([...ids(response)].sort(),[...deriveAchievements(run)].sort());
  assert.ok(ids(response).some(id=>freshIds.has(id))||run.endingId.startsWith('nasdaq-'),'the reached company/verbal branch has a verified badge');
  const repeated=await h.post(player,route,runId,route.actions,'/api/complete');assert.equal(repeated.status,200);assert.equal(repeated.body.duplicate,true);assert.equal(repeated.body.totalRuns,1);assert.deepEqual(repeated.body.characters,response.body.characters);assert.deepEqual(repeated.body.achievements,response.body.achievements);
  if(prefix.length){const older=await h.post(player,route,runId,prefix,'/api/characters');assert.equal(older.status,200);assert.deepEqual(older.body.characters,response.body.characters);}
  const retained=JSON.stringify([...h.sql.exec('SELECT * FROM character_runs WHERE id=?',runId).toArray(),...h.sql.exec('SELECT * FROM achievement_runs WHERE id=?',runId).toArray()]);
  assert.ok(!retained.includes(route.seed));assert.ok(!retained.includes(player.token));
  if(run.endingId.startsWith('verbal_'))assert.ok(response.body.characters.every(row=>row.realHits===0&&row.imaginedHits===0),'speech cannot count as either kind of hit');
 }
 const stats=(await h.call('/api/stats')).body;assert.equal(stats.totalRuns,routes.length);assert.equal(families.size,22);
 assert.deepEqual(stats.observatory.departureWays.map(row=>row.id),DEPARTURE_WAYS);assert.deepEqual(stats.observatory.departureWays,departureWays(stats.endings));
 assert.equal(stats.observatory.departureWays.reduce((sum,row)=>sum+row.count,0),stats.totalRuns);assert.equal(stats.observatory.departureWays.find(row=>row.id==='unclassified').count,0);
 assert.doesNotMatch(JSON.stringify(stats.observatory),/runId|playerId|seed|actions|history|companyContext|verbalContext/);
});

test('new resolutions cannot be claimed from an old-cohort proof or an unopened source scene',async t=>{
 const h=harness(t),player=await h.register(),old=oldRoutes.find(row=>row.ending==='ragequit-system');assert.ok(old);
 const response=await h.post(player,old,randomUUID(),old.actions,'/api/complete',{endingId:'verbal_boardroom-system',achievements:[...freshIds]});
 assert.equal(response.status,200);assert.equal(response.body.endingId,old.ending);assert.ok(ids(response).every(id=>!freshIds.has(id)));
 const fresh=routes.find(row=>row.ending.startsWith('verbal_onboarding-'));assert.ok(fresh);
 for(const actions of [[{type:'choice',eventId:'verbal-v32-aftermath',index:0}],[{type:'choice',eventId:'company-v32-buyer',index:0}],[{type:'verbal',phase:'event',eventId:'onboarding',version:2,severity:3}],[{type:'verbal',phase:'event',eventId:'onboarding',version:2,family:'verbal_boardroom'}]]){
  const rejected=await h.post(player,fresh,randomUUID(),actions);assert.equal(rejected.status,400);assert.ok(['invalid_actions','invalid_replay'].includes(rejected.body.error));
 }
 const future=await h.call('/api/achievements',{method:'POST',token:player.token,body:{runId:randomUUID(),roleId:'system',seed:'e34-not-supported',actions:[{type:'verbal',phase:'event',eventId:'onboarding',version:2}]}});
 assert.equal(future.status,400);assert.equal(future.body.error,'invalid_actions');
});

test('a committed new ending remains bound to its anonymous owner and exact branch',async t=>{
 const h=harness(t),player=await h.register(),stranger=await h.register(),route=routes.find(row=>row.ending==='verbal_onboarding-system'),other=routes.find(row=>row.ending==='verbal_viral-system');assert.ok(route&&other);
 const runId=randomUUID(),response=await h.post(player,route,runId,route.actions,'/api/complete');assert.equal(response.status,200);
 const foreign=await h.post(stranger,route,runId,route.actions,'/api/complete');assert.equal(foreign.status,409);
 const fork=await h.post(player,other,runId,other.actions,'/api/complete');assert.equal(fork.status,409);
 const after=(await h.call('/api/me',{token:player.token})).body;assert.equal(after.totalRuns,1);assert.deepEqual(after.characters,response.body.characters);assert.deepEqual(after.achievements,response.body.achievements);
 assert.equal((await h.call('/api/me',{token:stranger.token})).body.totalRuns,0);
});
