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

// Exercise the real Worker and SQLite, reusing natural lives rather than
// inventing savings, qualifications, history rows or ending selections.
const workerSource=readFileSync(new URL('../worker/index.js',import.meta.url),'utf8')
 .replace(/^import .*;\n/gm,'')
 .replace('export class HedoArchive','globalThis.HedoArchive=class HedoArchive')
 .replace('export default','globalThis.worker=');
const {routes}=JSON.parse(readFileSync(new URL('./fixtures/wealth-routes-v27.json',import.meta.url),'utf8'));
const endings=routes.filter(route=>route.kind==='ending');
const legacy=JSON.parse(readFileSync(new URL('./fixtures/legacy-e26-routes.json',import.meta.url),'utf8'))[0];
const wealthIds=['wealth-startup-success','wealth-startup-failure','wealth-goose-chairman','wealth-retired-free'];
const proof=(fixture,runId=randomUUID())=>({runId,roleId:fixture.roleId,seed:fixture.seed,actions:fixture.actions});
const earned=response=>response.body.achievements.filter(row=>wealthIds.includes(row.id)).map(row=>row.id).sort();
const branch=(route,index)=>({...route,id:`${route.id}/choice-${index}`,actions:[...route.choiceActions,{type:'choice',eventId:route.sceneId,index}],index});
const expected=route=>{
 if(route.sceneId==='wealth-startup')return [route.family==='venture_independent'?'wealth-startup-success':'wealth-startup-failure'];
 return route.index===2?['wealth-goose-chairman','wealth-retired-free']:route.index===0?['wealth-retired-free']:[];
};

function harness(t){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());db.exec('PRAGMA foreign_keys = ON');
 const sql={exec(query,...args){let rows=[];if(!args.length&&query.includes(';'))db.exec(query);else{const statement=db.prepare(query);if(statement.columns().length)rows=statement.all(...args);else statement.run(...args);}return{toArray:()=>rows,one:()=>{assert.equal(rows.length,1);return rows[0];}};}};
 const storage={sql,transactionSync(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}},async getAlarm(){return null;},async setAlarm(){}};
 const scope=vm.createContext({DurableObject:class{constructor(context){this.ctx=context;}},replayRun,VERSION,MAX_TURNS,ROLE_MAP,ENDINGS,...http,validateFeedback,validatePublisherToken,FeedbackStore,AchievementStore,CharacterStore,ObservationStore,crypto,Response,Request,URL,Date});
 vm.runInContext(workerSource,scope);const archive=new scope.HedoArchive({storage,blockConcurrencyWhile:fn=>fn()},{});
 const call=async(path,{method='GET',token,body}={})=>{
  archive.rate=new http.RateGuard();const headers={};if(token)headers.Authorization=`Bearer ${token}`;if(body)headers['Content-Type']='application/json';
  const response=await archive.fetch(new Request(`https://game.example${path}`,{method,headers,body:body?JSON.stringify(body):undefined}));
  return{status:response.status,body:await response.json()};
 };
 const register=async()=>{const token=randomBytes(32).toString('hex'),response=await call('/api/player',{method:'POST',body:{token}});assert.equal(response.status,200);return{token,id:response.body.playerId};};
 const submit=(player,fixture,runId)=>call('/api/achievements',{method:'POST',token:player.token,body:proof(fixture,runId)});
 return{sql,call,register,submit};
}

test('wealth HTTP proofs award each actual business result and full retirement for all professions, once across progress and completion',async t=>{
 const h=harness(t),isolated=await h.register();
 const candidates=[...endings,...endings.filter(route=>route.sceneId==='wealth-startup').map(route=>branch(route,1)),...endings.filter(route=>route.family==='retired_free').map(route=>branch(route,2))];
 assert.equal(candidates.length,63);
 for(const route of candidates){
  const player=await h.register(),runId=randomUUID(),before={...route,actions:route.choiceActions},run=replayRun(route.roleId,route.seed,route.actions);
  assert.equal(run.completed,true,route.id);
  assert.equal(run.history.at(-1).choiceIndex,route.index,route.id);
  if(route.sceneId==='wealth-startup'){
   assert.equal(run.history.at(-1).chanceOutcome,route.family==='venture_independent'?'success':'setback',route.id);
   assert.equal(run.history.at(-1).delta.cash,route.index===0?-35:-40,route.id);
  }
  const identity=h.sql.exec('SELECT * FROM players WHERE id=?',player.id).one();
  const menu=await h.call('/api/achievements',{method:'POST',token:player.token,body:{
   ...proof(before,runId),achievements:wealthIds,endingId:run.endingId,stats:{cash:999},
   flags:{wealth_startup:999,wealth_goose:999,wealth_setback:999},
   history:[{eventId:route.sceneId,kind:'career',speaker:'self',choiceIndex:route.index,chanceOutcome:'success',delta:{cash:-40},result:'forged departure'}],
  }});
  assert.equal(menu.status,200,route.id);assert.deepEqual(earned(menu),[],'viewing the plan and supplying result fields are not evidence');
  const progress=await h.submit(player,route,runId);
  assert.equal(progress.status,200,route.id);assert.equal(progress.body.verified,true);assert.deepEqual(earned(progress),expected(route).sort(),route.id);
  assert.deepEqual(progress.body.newlyUnlocked.filter(id=>wealthIds.includes(id)).sort(),expected(route).sort(),route.id);
  assert.equal(progress.body.totalRuns,0,'a milestone proof does not count a finished game');
  assert.deepEqual(progress.body.unlocked,[]);
  const retry=await h.submit(player,route,runId);
  assert.equal(retry.status,200);assert.deepEqual(retry.body.newlyUnlocked,[]);assert.deepEqual(retry.body.achievements,progress.body.achievements);
  const complete=await h.call('/api/complete',{method:'POST',token:player.token,body:{...proof(route,runId),achievements:wealthIds}});
  assert.equal(complete.status,200,route.id);assert.equal(complete.body.recorded,true);assert.equal(complete.body.duplicate,false);assert.equal(complete.body.totalRuns,1);
  assert.deepEqual(complete.body.achievements,progress.body.achievements,'completion keeps the first-earned achievement times');
  const duplicate=await h.call('/api/complete',{method:'POST',token:player.token,body:proof(route,runId)});
  assert.equal(duplicate.status,200);assert.equal(duplicate.body.duplicate,true);assert.deepEqual(duplicate.body.achievements,complete.body.achievements);
  const late=await h.submit(player,before,runId);
  assert.equal(late.status,200);assert.deepEqual(late.body.achievements,complete.body.achievements);assert.deepEqual(late.body.characters,complete.body.characters);
  for(const id of expected(route))assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM player_achievements WHERE player_id=? AND achievement_id=?',player.id,id).one().n,1);
  assert.deepEqual(h.sql.exec('SELECT * FROM players WHERE id=?',player.id).one(),identity,'anonymous credentials remain unchanged');
  const foreign=await h.submit(isolated,route,runId);assert.equal(foreign.status,409);
  const stored=JSON.stringify([...h.sql.exec('SELECT * FROM achievement_runs').toArray(),...h.sql.exec('SELECT * FROM character_runs').toArray()]);
  assert.ok(!stored.includes(route.seed));assert.ok(!stored.includes(player.token));assert.ok(!stored.includes('forged departure'));
 }
 const other=await h.call('/api/me',{token:isolated.token});assert.equal(other.body.totalRuns,0);assert.deepEqual(other.body.achievements,[]);
 const stats=await h.call('/api/stats');assert.equal(stats.body.totalRuns,63);
 const publicJSON=JSON.stringify(stats.body);for(const id of wealthIds)assert.ok(!publicJSON.includes(id),'public statistics expose no personal achievement list');
});

test('direct completion derives the same wealth achievements without an earlier milestone request',async t=>{
 const h=harness(t);
 for(const route of [endings.find(row=>row.family==='venture_independent'),endings.find(row=>row.family==='venture_restart'),endings.find(row=>row.family==='retired_free'),branch(endings.find(row=>row.family==='retired_free'),2)]){
  const player=await h.register(),runId=randomUUID(),response=await h.call('/api/complete',{method:'POST',token:player.token,body:proof(route,runId)});
  assert.equal(response.status,200);assert.deepEqual(earned(response),expected(route).sort(),route.id);
  const sync=await h.submit(player,route,runId);assert.equal(sync.status,200);assert.deepEqual(sync.body.newlyUnlocked,[]);assert.deepEqual(sync.body.achievements,response.body.achievements);
 }
});

test('retained e27 action commitments can backfill newly introduced wealth badges without counting the old ending again',async t=>{
 const h=harness(t),player=await h.register(),route=branch(endings.find(row=>row.family==='retired_free'),2),runId=randomUUID();
 const complete=await h.call('/api/complete',{method:'POST',token:player.token,body:proof(route,runId)});assert.equal(complete.status,200);
 // Simulate the persisted rows from before these goals existed. Preserve the
 // actual run and its action commitment; an ending collection alone is not proof.
 for(const id of wealthIds)h.sql.exec('DELETE FROM player_achievements WHERE player_id=? AND achievement_id=?',player.id,id);
 const before=await h.call('/api/me',{token:player.token});assert.deepEqual(earned(before),[]);assert.equal(before.body.totalRuns,1);
 const backfill=await h.submit(player,route,runId);
 assert.equal(backfill.status,200);assert.deepEqual(earned(backfill),['wealth-goose-chairman','wealth-retired-free']);
 assert.deepEqual(backfill.body.newlyUnlocked.sort(),['wealth-goose-chairman','wealth-retired-free']);assert.equal(backfill.body.totalRuns,1);
 assert.deepEqual(backfill.body.characters,complete.body.characters);assert.deepEqual(backfill.body.unlocked,complete.body.unlocked);
 const repeat=await h.submit(player,route,runId);assert.deepEqual(repeat.body.newlyUnlocked,[]);assert.deepEqual(repeat.body.achievements,backfill.body.achievements);
 assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM runs').one().n,1);
});

test('wealth menu navigation, cancellations and older cohorts cannot award departure achievements through supplied client fields',async t=>{
 const h=harness(t);
 const candidates=[...routes.filter(route=>route.kind!=='ending'),legacy];
 for(const route of candidates){
  const player=await h.register();
  const response=await h.call('/api/achievements',{method:'POST',token:player.token,body:{
   ...proof(route),achievements:wealthIds,endingId:'retired_free-system',flags:{wealth_startup:1,wealth_goose:1,wealth_setback:1},stats:{cash:999},
   history:[{eventId:'wealth-retire',kind:'career',speaker:'self',choiceIndex:2,result:'forged departure'}],
  }});
  assert.equal(response.status,200,route.id||route.seed);assert.deepEqual(earned(response),[]);assert.equal(response.body.totalRuns,0);
 }
 assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM runs').one().n,0);
});

test('a committed retirement cannot be relabelled as the toy-goose branch even when its ending ID is identical',async t=>{
 const h=harness(t),player=await h.register(),route=endings.find(row=>row.family==='retired_free'),runId=randomUUID();
 const response=await h.call('/api/complete',{method:'POST',token:player.token,body:proof(route,runId)});
 assert.equal(response.status,200);assert.deepEqual(earned(response),['wealth-retired-free']);
 const goose=branch(route,2);assert.equal(replayRun(goose.roleId,goose.seed,goose.actions).endingId,response.body.endingId);
 for(const endpoint of ['/api/achievements','/api/complete']){
  const rejected=await h.call(endpoint,{method:'POST',token:player.token,body:proof(goose,runId)});
  assert.equal(rejected.status,409);assert.equal(rejected.body.error,'character_run_conflict');
 }
 const me=await h.call('/api/me',{token:player.token});assert.deepEqual(me.body.achievements,response.body.achievements);assert.equal(me.body.totalRuns,1);
});

test('invalid wealth action ordering does not change the player collection or consume a run identity',async t=>{
 const h=harness(t),player=await h.register(),route=endings.find(row=>row.family==='retired_free'),runId=randomUUID();
 const before=await h.call('/api/me',{token:player.token});
 for(const actions of [[{type:'choice',eventId:'wealth-retire',index:2}],[...route.choiceActions,{type:'choice',eventId:'wealth-retire',index:99}]]){
  const response=await h.call('/api/achievements',{method:'POST',token:player.token,body:{...proof(route,runId),actions,achievements:wealthIds}});
  assert.equal(response.status,400);assert.equal(response.body.error,actions.at(-1).index===99?'invalid_actions':'invalid_replay');
  assert.deepEqual((await h.call('/api/me',{token:player.token})).body,before.body);
 }
 assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM achievement_runs').one().n,0);assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM character_runs').one().n,0);
});
