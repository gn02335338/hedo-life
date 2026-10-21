import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {AchievementStore} from '../worker/achievements.js';
import {CharacterStore} from '../worker/characters.js';
import {ObservationStore,deriveObservation} from '../worker/observations.js';
import {FeedbackStore} from '../worker/feedback-store.js';
import {validateFeedback,validatePublisherToken} from '../worker/feedback.js';
import * as http from '../worker/http.js';
import {createRun,applyChoice,advance,requestExit,replayRun,VERSION,MAX_TURNS} from '../dist/engine.js';
import {ROLE_MAP} from '../dist/roles.js';
import {ENDINGS} from '../dist/endings.js';

const source=readFileSync(new URL('../worker/index.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'')
 .replace('export class HedoArchive','globalThis.HedoArchive=class HedoArchive').replace('export default','globalThis.worker=');
const legacy=JSON.parse(readFileSync(new URL('./fixtures/legacy-e27-routes.json',import.meta.url),'utf8'));
const patronage=JSON.parse(readFileSync(new URL('./fixtures/patronage-routes-v29.json',import.meta.url),'utf8')).routes;
const proof=(run,runId=randomUUID())=>({runId,roleId:run.roleId,seed:run.seed,actions:run.actions});
const completed=fixture=>replayRun(fixture.roleId,fixture.seed,fixture.completionActions||fixture.actions);
const appointee=gender=>completed(patronage.find(row=>row.id===`application-${gender}-success`));
function early(cohort,rank=0){
 for(let n=0;n<100;n++){
  let run=createRun('system',`e${cohort}-observatory-${n}`);if(run.rank!==rank)continue;
  run=advance(applyChoice(run,0));run=requestExit(run);if(run.eventId!=='exit-menu')continue;
  run=advance(applyChoice(run,0));if(run.completed)return run;
 }
 throw new Error(`No natural e${cohort} rank ${rank} departure`);
}

function harness(t,{before}={}){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());db.exec('PRAGMA foreign_keys = ON');
 const sql={exec(query,...args){
  let rows=[];
  if(!args.length&&query.includes(';'))db.exec(query);
  else{const statement=db.prepare(query);if(statement.columns().length)rows=statement.all(...args);else statement.run(...args);}
  return {toArray:()=>rows,one:()=>{assert.equal(rows.length,1);return rows[0];}};
 }};
 before?.(sql);
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
 const register=async()=>{
  const token=randomBytes(32).toString('hex'),response=await call('/api/player',{method:'POST',body:{token}});
  assert.equal(response.status,200);return {token,id:response.body.playerId};
 };
 return {sql,call,register,reopen(){archive=instantiate();},observatory:async()=>(await call('/api/stats')).body.observatory};
}

test('empty observations expose the versioned zero-filled contract and preserve all existing public stats keys',async t=>{
 const h=harness(t),stats=await h.call('/api/stats');assert.equal(stats.status,200);
 assert.deepEqual(Object.keys(stats.body).sort(),['players','totalRuns','uniqueEndings','averageTurns','roles','endings','daily','observatory'].sort());
 assert.deepEqual(stats.body.observatory,{
  version:1,trackingSince:null,recordedRuns:0,unclassifiedRuns:0,
  career:{full8:Array.from({length:8},(_,rank)=>({rank,count:0})),legacy5:Array.from({length:5},(_,rank)=>({rank,count:0})),special:[{id:'son',count:0},{id:'daughter',count:0}]},
  actualRoles:[],reassignments:0,endingTypes:['good','normal','bad','secret'].map(id=>({id,count:0})),
  tenure:['1-3','4-7','8-12','13-19','20-24'].map(id=>({id,count:0})),
  salary:{average:0,bands:['under30','30-49','50-79','80-119','120plus'].map(id=>({id,count:0}))},
  experiences:{pip:0,promoted:0,payCut:0,collapse:0,appointed:0},
 });
 h.reopen();assert.deepEqual(await h.observatory(),stats.body.observatory,'schema startup is idempotent');
});

test('historical SQL databases migrate additively without guessing a career scheme or leaking an unknown ending name',async t=>{
 const run=early(17),runId=randomUUID(),otherId=randomUUID(),created='2001-02-03T04:05:06.000Z';
 const h=harness(t,{before(sql){
  sql.exec(`CREATE TABLE players(id TEXT PRIMARY KEY,token_hash TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL);
   CREATE TABLE runs(id TEXT PRIMARY KEY,player_id TEXT NOT NULL REFERENCES players(id),ending_id TEXT NOT NULL,role_id TEXT NOT NULL,actual_role_id TEXT NOT NULL,rank INTEGER NOT NULL,salary INTEGER NOT NULL,turns INTEGER NOT NULL,game_version INTEGER NOT NULL,created_at TEXT NOT NULL);`);
  sql.exec('INSERT INTO players VALUES (?,?,?)','historical-player','historical-hash',created);
  sql.exec('INSERT INTO runs VALUES (?,?,?,?,?,?,?,?,?,?)',runId,'historical-player',run.endingId,run.roleId,run.actualRoleId,run.rank,run.pay,2,3,created);
  sql.exec('INSERT INTO runs VALUES (?,?,?,?,?,?,?,?,?,?)',otherId,'historical-player','unknown-private-ending-name','project','design',7,130,24,3,created);
 }});
 const before=h.sql.exec('SELECT * FROM runs ORDER BY id').toArray().map(row=>({...row}));h.reopen();
 assert.deepEqual(h.sql.exec('SELECT * FROM runs ORDER BY id').toArray().map(row=>({...row})),before);
 const stats=await h.observatory();assert.equal(stats.recordedRuns,0);assert.equal(stats.unclassifiedRuns,2);assert.equal(stats.trackingSince,null);
 assert.ok([...stats.career.full8,...stats.career.legacy5,...stats.career.special].every(row=>row.count===0));
 assert.deepEqual(stats.actualRoles,[{id:'design',count:1},{id:'system',count:1}]);assert.equal(stats.reassignments,1);
 assert.equal(stats.tenure.find(row=>row.id==='1-3').count,1);assert.equal(stats.tenure.find(row=>row.id==='20-24').count,1);
 assert.equal(stats.endingTypes.find(row=>row.id===ENDINGS.find(ending=>ending.id===run.endingId).type).count,1);
 assert.doesNotMatch(JSON.stringify(stats),/unknown-private-ending-name|historical-player|historical-hash|2001-02-03|seed|actions|history|playerId|runId/);
 assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM run_observations').one().n,0);
});

test('canonical same-rank five/eight-stage careers and the two special appointments remain distinct without storing gender',async t=>{
 const h=harness(t),player=await h.register(),runs=[early(16),early(17),appointee('male'),appointee('female')];
 assert.equal(runs[0].rank,runs[1].rank);
 for(const run of runs){
  const response=await h.call('/api/complete',{method:'POST',token:player.token,body:{...proof(run),rank:7,career_scheme:'full8',appointment:'son',characterGender:'invented',pip_count:999,promotions:999,pay_cuts:999,mood_collapses:999}});
  assert.equal(response.status,200);assert.equal(response.body.duplicate,false);
 }
 const stats=await h.observatory();assert.equal(stats.recordedRuns,4);assert.equal(stats.unclassifiedRuns,0);
 assert.equal(stats.career.full8[0].count,1);assert.equal(stats.career.legacy5[0].count,1);
 assert.equal(stats.career.full8.reduce((sum,row)=>sum+row.count,0),1,'special roles are not counted as normal career ranks');
 assert.deepEqual(stats.career.special,[{id:'son',count:1},{id:'daughter',count:1}]);assert.equal(stats.experiences.appointed,2);
 assert.ok(Number.isFinite(Date.parse(stats.trackingSince)));
 const rows=h.sql.exec('SELECT * FROM run_observations ORDER BY rule_cohort').toArray();
 assert.deepEqual(rows.map(row=>row.rule_cohort),[16,17,29,29]);assert.deepEqual(rows.map(row=>row.career_scheme),['legacy5','full8','full8','full8']);
 assert.deepEqual(Object.keys(rows[0]).sort(),['run_id','rule_cohort','career_scheme','final_rank','appointment','pip_count','promotions','pay_cuts','mood_collapses','created_at'].sort());
 assert.doesNotMatch(JSON.stringify(rows),/characterGender|"male"|"female"|seed|actions|history|乾兒子|乾女兒/);
 assert.doesNotMatch(JSON.stringify(stats),/playerId|runId|run_id|seed|actions|history|characterGender|appointedPay|fromPay/);
});

test('all-run occupation, reassignment, salary, ending-type and tenure charts coexist with canonical per-life experience counts',async t=>{
 const h=harness(t),player=await h.register();
 const selected=['fired_signed-system','pip_fail-system','burnout-ai','promotion-system'].map(id=>completed(legacy.find(route=>route.ending===id)));
 for(const run of selected){const result=await h.call('/api/complete',{method:'POST',token:player.token,body:proof(run)});assert.equal(result.status,200);}
 const stats=await h.observatory(),expected={pip:0,promoted:0,payCut:0,collapse:0,appointed:0};
 for(const run of selected){
  expected.pip+=Number(run.pipCount>0);expected.promoted+=Number((run.flags.promotions||0)>0);
  expected.payCut+=Number(run.history.some((row,index)=>index>0&&row.pay<run.history[index-1].pay));
  expected.collapse+=Number((run.flags.mood_crash_count||0)>0);
 }
 assert.ok(Object.values(expected).slice(0,4).every(value=>value>0));assert.deepEqual(stats.experiences,expected);
 assert.equal(stats.recordedRuns,4);assert.equal(stats.actualRoles.reduce((sum,row)=>sum+row.count,0),4);
 assert.equal(stats.reassignments,selected.filter(run=>run.roleId!==run.actualRoleId).length);
 assert.equal(stats.endingTypes.reduce((sum,row)=>sum+row.count,0),4);assert.equal(stats.tenure.reduce((sum,row)=>sum+row.count,0),4);
 assert.equal(stats.salary.bands.reduce((sum,row)=>sum+row.count,0),4);assert.equal(stats.salary.average,Math.round(selected.reduce((sum,run)=>sum+run.pay,0)/4*10)/10);
 const row=h.sql.exec('SELECT * FROM run_observations WHERE pay_cuts > 0').toArray()[0];assert.ok(row);
 assert.ok(stats.experiences.payCut<=stats.recordedRuns,'experience charts count lives, not the number of incidents');
 assert.equal(deriveObservation({...selected[0],completed:false}),null);
});

test('valid committed completion retries backfill once at collection time, while forks, partial records and foreign owners cannot backfill',async t=>{
 const h=harness(t),player=await h.register(),other=await h.register();
 const fixture=patronage.find(row=>row.id==='application-male-success'),run=completed(fixture),runId=randomUUID();
 const body=proof(run,runId),first=await h.call('/api/complete',{method:'POST',token:player.token,body});assert.equal(first.status,200);
 h.sql.exec('DELETE FROM run_observations WHERE run_id = ?',runId);
 h.sql.exec('UPDATE runs SET created_at = ? WHERE id = ?','2001-01-01T00:00:00.000Z',runId);
 for(const attempted of [
  {token:other.token,body},
  {token:player.token,body:{...body,actions:completed(patronage.find(row=>row.id==='application-male-wild-success')).actions}},
 ]){
  const rejected=await h.call('/api/complete',{method:'POST',...attempted});assert.equal(rejected.status,409);
  assert.equal((await h.observatory()).recordedRuns,0);
 }
 const invalid=await h.call('/api/complete',{method:'POST',token:player.token,body:{...body,actions:[{type:'choice',eventId:'not-a-real-scene',index:0}],completed:true,appointment:'daughter'}});
 assert.equal(invalid.status,200);assert.equal(invalid.body.duplicate,true);assert.equal((await h.observatory()).recordedRuns,0);
 const partial=await h.call('/api/complete',{method:'POST',token:player.token,body:{...body,actions:fixture.actions,endingId:run.endingId}});
 assert.equal(partial.status,200);assert.equal((await h.observatory()).recordedRuns,0);
 const retry=await h.call('/api/complete',{method:'POST',token:player.token,body});assert.equal(retry.status,200);assert.equal(retry.body.duplicate,true);assert.equal(retry.body.totalRuns,1);
 const backfilled=await h.observatory();assert.equal(backfilled.recordedRuns,1);assert.equal(backfilled.unclassifiedRuns,0);
 assert.ok(Date.parse(backfilled.trackingSince)>Date.parse('2001-01-01T00:00:00.000Z'));
 const repeated=await h.call('/api/complete',{method:'POST',token:player.token,body});assert.equal(repeated.status,200);assert.deepEqual(await h.observatory(),backfilled);
 const stranger=await h.call('/api/me',{token:other.token});assert.equal(stranger.body.totalRuns,0);
});

test('historical completions without an action commitment cannot be reclassified by a newly supplied same-ending replay',async t=>{
 const h=harness(t),player=await h.register(),run=early(17),runId=randomUUID();
 h.sql.exec('INSERT INTO runs VALUES (?,?,?,?,?,?,?,?,?,?)',runId,player.id,run.endingId,run.roleId,run.actualRoleId,run.rank,run.pay,Math.min(run.turn+1,24),3,'2001-01-01T00:00:00.000Z');
 const response=await h.call('/api/complete',{method:'POST',token:player.token,body:{...proof(run,runId),career_scheme:'full8',appointment:'daughter'}});
 assert.equal(response.status,200);assert.equal(response.body.duplicate,true);assert.equal(response.body.totalRuns,1);
 const stats=await h.observatory();assert.equal(stats.recordedRuns,0);assert.equal(stats.unclassifiedRuns,1);assert.equal(stats.trackingSince,null);
 assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM character_runs').one().n,0);
});
