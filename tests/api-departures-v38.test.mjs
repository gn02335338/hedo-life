import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {AchievementStore} from '../worker/achievements.js';
import {CharacterStore} from '../worker/characters.js';
import {ObservationStore} from '../worker/observations.js';
import {deriveDepartureWay} from '../worker/departures.js';
import {FeedbackStore} from '../worker/feedback-store.js';
import {validateFeedback,validatePublisherToken} from '../worker/feedback.js';
import * as http from '../worker/http.js';
import {replayRun,VERSION,MAX_TURNS} from '../dist/engine.js';
import {ROLE_MAP} from '../dist/roles.js';
import {ENDINGS} from '../dist/endings.js';

const source=readFileSync(new URL('../worker/index.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'')
 .replace('export class HedoArchive','globalThis.HedoArchive=class HedoArchive').replace('export default','globalThis.worker=');
const legacy=JSON.parse(readFileSync(new URL('./fixtures/v37-routes.json',import.meta.url),'utf8')).routes
 .find(route=>route.ending==='verbal_wing_concession-sales');
const chapters=JSON.parse(readFileSync(new URL('./fixtures/chapters-e38-routes.json',import.meta.url),'utf8')).routes;
const actions=[{type:'choice',eventId:'onboarding',index:0},
 {type:'verbal',phase:'event',eventId:'sales-assistant',version:2},
 {type:'choice',eventId:'verbal-v32-aftermath',index:0},
 {type:'choice',eventId:'chapter-resolution',index:1}];
const proof=(selected=actions,runId=randomUUID())=>({runId,roleId:'sales',seed:'e38-sales-v17-16',actions:selected});
const familyCount=(stats,id)=>stats.observatory.departureWays.find(row=>row.id===id).count;

function harness(t){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());db.exec('PRAGMA foreign_keys = ON');
 let failQuery=null;
 const sql={exec(query,...args){
  if(failQuery&&query.includes(failQuery)){failQuery=null;throw new Error('Simulated classification write failure');}
  let rows=[];
  if(!args.length&&query.includes(';'))db.exec(query);
  else{const statement=db.prepare(query);if(statement.columns().length)rows=statement.all(...args);else statement.run(...args);}
  return {toArray:()=>rows,one:()=>{assert.equal(rows.length,1);return rows[0];}};
 }};
 const storage={sql,transactionSync(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}},async getAlarm(){return null;},async setAlarm(){}};
 const context=vm.createContext({DurableObject:class{constructor(ctx){this.ctx=ctx;}},replayRun,VERSION,MAX_TURNS,ROLE_MAP,ENDINGS,
  ...http,validateFeedback,validatePublisherToken,FeedbackStore,AchievementStore,CharacterStore,ObservationStore,crypto,Response,Request,URL,Date});
 vm.runInContext(source,context);
 const instantiate=()=>new context.HedoArchive({storage,blockConcurrencyWhile:fn=>fn()},{});
 let archive=instantiate();
 const call=async(path,{method='GET',token,body}={})=>{
  archive.rate=new http.RateGuard();const headers={};if(token)headers.Authorization=`Bearer ${token}`;if(body)headers['Content-Type']='application/json';
  const response=await archive.fetch(new Request(`https://game.example${path}`,{method,headers,body:body?JSON.stringify(body):undefined}));
  return {status:response.status,body:await response.json()};
 };
 const register=async()=>{const token=randomBytes(32).toString('hex'),response=await call('/api/player',{method:'POST',body:{token}});assert.equal(response.status,200);return {token,id:response.body.playerId};};
 return {sql,call,register,reopen(){archive=instantiate();},failNext(query){failQuery=query;},stats:async()=>(await call('/api/stats')).body};
}

test('same ending preserves the legacy workplace chapter but records an e38 explicit resignation only after confirmation',async t=>{
 const h=harness(t),player=await h.register();
 const old=await h.call('/api/complete',{method:'POST',token:player.token,body:{runId:randomUUID(),roleId:legacy.roleId,seed:legacy.seed,actions:legacy.actions}});
 assert.equal(old.status,200);assert.equal(old.body.endingId,'verbal_wing_concession-sales');
 for(const incomplete of [actions.slice(0,-1),[...actions.slice(0,-1),{type:'choice',eventId:'chapter-resolution',index:0}]]){
  const run=replayRun('sales','e38-sales-v17-16',incomplete);assert.equal(run.completed,false);
  const result=await h.call('/api/complete',{method:'POST',token:player.token,body:{...proof(incomplete),completed:true,flags:{departure38_voluntary:1},departureWay:'voluntary'}});
  assert.equal(result.status,400);assert.equal(result.body.error,'incomplete_run');
 }
 assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM run_departures').one().n,0);
 const body=proof(),submitted=await h.call('/api/complete',{method:'POST',token:player.token,body});
 assert.equal(submitted.status,200);assert.equal(submitted.body.endingId,old.body.endingId);
 const stats=await h.stats();assert.equal(stats.totalRuns,2);assert.equal(stats.uniqueEndings,1);
 assert.equal(familyCount(stats,'other'),1);assert.equal(familyCount(stats,'voluntary'),1);
 assert.equal(stats.observatory.departureWays.reduce((sum,row)=>sum+row.count,0),2);
 const stored=h.sql.exec('SELECT * FROM run_departures').one();
 assert.equal(stored.run_id,body.runId);assert.equal(stored.way,'voluntary');
 assert.deepEqual(Object.keys(stored).sort(),['created_at','run_id','way']);
 assert.deepEqual({...h.sql.exec('SELECT rule_cohort,career_scheme FROM run_observations WHERE run_id = ?',body.runId).one()},{rule_cohort:38,career_scheme:'full8'});
 assert.doesNotMatch(JSON.stringify(stats.observatory),/run_id|runId|seed|actions|history|departure38|chapter-resolution/);
 h.reopen();assert.deepEqual(await h.stats(),stats,'additive table startup preserves existing totals and classifications');
});

test('a resolved speech milestone verifies its achievement while still employed, without collecting an ending or duplicating character progress',async t=>{
 const h=harness(t),player=await h.register(),runId=randomUUID(),prefix=proof(actions.slice(0,-1),runId);
 const staged=replayRun(prefix.roleId,prefix.seed,prefix.actions);assert.equal(staged.completed,false);assert.equal(staged.eventId,'chapter-resolution');
 const progress=await h.call('/api/achievements',{method:'POST',token:player.token,body:prefix});
 assert.equal(progress.status,200);assert.equal(progress.body.verified,true);
 assert.ok(progress.body.achievements.some(row=>row.id==='verbal-wing-concession'));
 assert.equal(progress.body.totalRuns,0);assert.deepEqual(progress.body.unlocked,[]);
 for(let n=0;n<2;n++){
  const characters=await h.call('/api/characters',{method:'POST',token:player.token,body:prefix});assert.equal(characters.status,200);
  assert.deepEqual(characters.body.characters,progress.body.characters,'checkpoint proof retries add no encounters or affinity');
 }
 const incomplete=await h.call('/api/complete',{method:'POST',token:player.token,body:prefix});assert.equal(incomplete.status,400);assert.equal(incomplete.body.error,'incomplete_run');
 for(const table of ['runs','player_endings','run_departures'])assert.equal(h.sql.exec(`SELECT COUNT(*) AS n FROM ${table}`).one().n,0);
 const completed=await h.call('/api/complete',{method:'POST',token:player.token,body:proof(actions,runId)});
 assert.equal(completed.status,200);assert.equal(completed.body.totalRuns,1);assert.deepEqual(completed.body.unlocked,['verbal_wing_concession-sales']);
 assert.deepEqual(completed.body.characters,progress.body.characters,'the employment confirmation itself adds no NPC interaction');
 assert.ok(completed.body.achievements.some(row=>row.id==='verbal-wing-concession'));
});

test('client classifications, incomplete branches and foreign owners cannot backfill a committed e38 departure',async t=>{
 const h=harness(t),player=await h.register(),stranger=await h.register(),body=proof();
 const first=await h.call('/api/complete',{method:'POST',token:player.token,body:{...body,departureWay:'retirement',flags:{departure38_voluntary:0},way:'startup'}});
 assert.equal(first.status,200);assert.equal(familyCount(await h.stats(),'voluntary'),1);
 h.sql.exec('DELETE FROM run_departures WHERE run_id = ?',body.runId);
 const foreign=await h.call('/api/complete',{method:'POST',token:stranger.token,body});assert.equal(foreign.status,409);
 const forged=await h.call('/api/complete',{method:'POST',token:player.token,body:{...body,actions:actions.slice(0,-1),flags:{departure38_voluntary:1},departureWay:'voluntary'}});
 assert.equal(forged.status,200);assert.equal(forged.body.duplicate,true);
 assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM run_departures').one().n,0);
 const fork=await h.call('/api/complete',{method:'POST',token:player.token,body:{...body,seed:legacy.seed,actions:legacy.actions}});assert.equal(fork.status,409);
 const retry=await h.call('/api/complete',{method:'POST',token:player.token,body});assert.equal(retry.status,200);assert.equal(retry.body.duplicate,true);
 const before=await h.stats();assert.equal(before.totalRuns,1);assert.equal(familyCount(before,'voluntary'),1);
 assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM run_departures').one().n,1);
 for(let n=0;n<3;n++){const repeated=await h.call('/api/complete',{method:'POST',token:player.token,body});assert.equal(repeated.status,200);assert.equal(repeated.body.duplicate,true);}
 assert.deepEqual(await h.stats(),before);
 assert.equal((await h.call('/api/me',{token:stranger.token})).body.totalRuns,0);
});

test('classification persistence is atomic with completion and a failed write can be retried without losing earlier runs',async t=>{
 const h=harness(t),player=await h.register();
 assert.equal((await h.call('/api/complete',{method:'POST',token:player.token,body:{runId:randomUUID(),roleId:legacy.roleId,seed:legacy.seed,actions:legacy.actions}})).status,200);
 const before=await h.stats(),body=proof();h.failNext('INSERT OR IGNORE INTO run_departures');
 const failed=await h.call('/api/complete',{method:'POST',token:player.token,body});assert.equal(failed.status,503);
 assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM runs').one().n,1);
 for(const table of ['runs','run_observations','run_departures'])assert.equal(h.sql.exec(`SELECT COUNT(*) AS n FROM ${table} WHERE ${table==='runs'?'id':'run_id'} = ?`,body.runId).one().n,0);
 assert.deepEqual(await h.stats(),before,'failed new completion leaves all earlier charts readable');
 const retried=await h.call('/api/complete',{method:'POST',token:player.token,body});assert.equal(retried.status,200);assert.equal(retried.body.duplicate,false);
 const after=await h.stats();assert.equal(after.totalRuns,2);assert.equal(familyCount(after,'other'),1);assert.equal(familyCount(after,'voluntary'),1);
 assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM run_departures WHERE run_id = ?',body.runId).one().n,1);
});

test('e38 resource-confirmed departures retain exhaustion categories and ordinary resignations require canonical chapter evidence',async t=>{
 const h=harness(t),player=await h.register();
 for(const [family,way] of [['burnout','burnout'],['broke','cash_exhausted']]){
  const route=chapters.find(row=>row.ending===`${family}-admin`);assert.ok(route);
  assert.equal(route.actions.at(-1).eventId,'chapter-resolution');
  for(const index of [0,1]){
   const confirmed=[...route.actions.slice(0,-1),{...route.actions.at(-1),index}];
   const run=replayRun(route.roleId,route.seed,confirmed);assert.equal(run.completed,true);assert.equal(deriveDepartureWay(run),way);
   const response=await h.call('/api/complete',{method:'POST',token:player.token,body:{runId:randomUUID(),roleId:route.roleId,seed:route.seed,actions:confirmed,departureWay:'voluntary'}});assert.equal(response.status,200);
  }
 }
 const stats=await h.stats();assert.equal(stats.totalRuns,4);assert.equal(familyCount(stats,'burnout'),2);assert.equal(familyCount(stats,'cash_exhausted'),2);assert.equal(familyCount(stats,'voluntary'),0);
 const run=replayRun('sales','e38-sales-v17-16',actions);assert.equal(deriveDepartureWay(run),'voluntary');
 assert.equal(deriveDepartureWay({...run,seed:'e37-forged',flags:{departure38_voluntary:1}}),null);
 assert.equal(deriveDepartureWay({...run,history:run.history.filter(row=>row.eventId!=='chapter-resolution')}),'other');
 assert.equal(deriveDepartureWay({...run,completed:false}),null);
});
