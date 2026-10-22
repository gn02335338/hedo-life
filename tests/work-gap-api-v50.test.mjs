import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {AchievementStore} from '../worker/achievements.js';
import {CharacterStore} from '../worker/characters.js';
import {ObservationStore} from '../worker/observations.js';
import {FeedbackStore} from '../worker/feedback-store.js';
import {validateFeedback,validatePublisherToken} from '../worker/feedback.js';
import * as http from '../worker/http.js';
import {replayRun,VERSION,MAX_TURNS} from '../dist/engine.js';
import {ROLE_MAP} from '../dist/roles.js';
import {ENDINGS} from '../dist/endings.js';
import {deriveCharacterStats,CHARACTER_METRICS} from '../dist/character-stats.js';

const source=readFileSync(new URL('../worker/index.js',import.meta.url),'utf8')
 .replace(/^import .*;\n/gm,'').replace('export class HedoArchive','globalThis.HedoArchive=class HedoArchive').replace('export default','globalThis.worker=');
const {routes}=JSON.parse(readFileSync(new URL('./fixtures/work-gap-routes-v50.json',import.meta.url),'utf8'));
const proof=(row,runId,actions=row.actions)=>({runId,roleId:row.roleId,seed:row.seed,actions});
const find=id=>{const row=routes.find(row=>row.id===id);assert.ok(row,id);return row;};

// Production Worker and stores run against isolated in-memory SQLite. These
// artificial test lives never write to production collections or counters.
function harness(t){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());db.exec('PRAGMA foreign_keys = ON');
 const sql={exec(query,...args){let rows=[];
  if(!args.length&&query.includes(';'))db.exec(query);
  else{const statement=db.prepare(query);if(statement.columns().length)rows=statement.all(...args);else statement.run(...args);}
  return {toArray:()=>rows,one:()=>{assert.equal(rows.length,1);return rows[0];}};
 }};
 const storage={sql,transactionSync(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}},async getAlarm(){return null;},async setAlarm(){}};
 const context=vm.createContext({DurableObject:class{constructor(ctx){this.ctx=ctx;}},replayRun,VERSION,MAX_TURNS,ROLE_MAP,ENDINGS,
  ...http,validateFeedback,validatePublisherToken,FeedbackStore,AchievementStore,CharacterStore,ObservationStore,crypto,Response,Request,URL,Date});
 vm.runInContext(source,context);
 const archive=new context.HedoArchive({storage,blockConcurrencyWhile:fn=>fn()},{});
 const call=async(path,{method='GET',token,body}={})=>{
  archive.rate=new http.RateGuard();const headers={};if(token)headers.Authorization=`Bearer ${token}`;if(body)headers['Content-Type']='application/json';
  const response=await archive.fetch(new Request(`https://game.example${path}`,{method,headers,body:body?JSON.stringify(body):undefined}));
  return {status:response.status,body:await response.json()};
 };
 const register=async()=>{const token=randomBytes(32).toString('hex'),response=await call('/api/player',{method:'POST',body:{token}});assert.equal(response.status,200);return {token,id:response.body.playerId};};
 return {sql,call,register};
}

test('the Worker verifies a natural work/rest loop, saves only canonical results and deduplicates completion',async t=>{
 const h=harness(t),player=await h.register(),stranger=await h.register(),row=find('basic-loop'),runId=randomUUID();
 for(const actions of [row.firstGapActions,row.secondGapActions,row.restedActions,row.actions]){
  const run=replayRun(row.roleId,row.seed,actions);
  const result=await h.call('/api/characters',{method:'POST',token:player.token,body:{...proof(row,runId,actions),
   flags:{work_gap_open:1},stats:{mood:100,cash:9999},turn:0,pip:{remaining:999},characters:[{id:'wing',realHits:9999}]
  }});
  assert.equal(result.status,200);assert.equal(result.body.verified,true);assert.equal(result.body.totalRuns,0);
  assert.deepEqual(result.body.characters,deriveCharacterStats(run));
 }
 const ended=replayRun(row.roleId,row.seed,row.completionActions);
 const completed=await h.call('/api/complete',{method:'POST',token:player.token,body:{...proof(row,runId,row.completionActions),endingId:'nasdaq-system',pay:499,rank:7,turn:0}});
 assert.equal(completed.status,200);assert.equal(completed.body.endingId,ended.endingId);assert.equal(completed.body.recorded,true);assert.equal(completed.body.totalRuns,1);
 assert.deepEqual(completed.body.characters,deriveCharacterStats(ended));
 const saved=h.sql.exec('SELECT ending_id,salary,rank,turns FROM runs WHERE id = ?',runId).one();
 assert.equal(saved.ending_id,ended.endingId);assert.equal(saved.salary,ended.pay);assert.equal(saved.rank,ended.rank);assert.equal(saved.turns,Math.min(ended.turn+1,MAX_TURNS));
 const duplicate=await h.call('/api/complete',{method:'POST',token:player.token,body:proof(row,runId,row.completionActions)});
 assert.equal(duplicate.status,200);assert.equal(duplicate.body.duplicate,true);assert.equal(duplicate.body.totalRuns,1);
 const delayed=await h.call('/api/characters',{method:'POST',token:player.token,body:proof(row,runId,row.firstGapActions)});
 assert.equal(delayed.status,200);assert.deepEqual(delayed.body.characters,completed.body.characters);
 assert.equal((await h.call('/api/complete',{method:'POST',token:stranger.token,body:proof(row,runId,row.completionActions)})).status,409);
 const isolated=await h.call('/api/me',{token:stranger.token});assert.equal(isolated.body.totalRuns,0);
 assert.ok(isolated.body.characters.every(person=>CHARACTER_METRICS.every(key=>person[key]===0)));
 const stats=await h.call('/api/stats');assert.equal(stats.body.totalRuns,1);
 assert.doesNotMatch(JSON.stringify(stats.body),/work_gap_open|playerId|runId|seed|actions|history/);
});

test('the Worker rejects mid-event, pending-decision and repeated rest or skipped work-gap actions',async t=>{
 const h=harness(t),player=await h.register(),basic=find('basic-loop'),onboarding=find('onboarding-gap');
 const rawGap=replayRun(basic.roleId,basic.seed,basic.firstGapActions);
 const invalid=[
  {row:basic,actions:[...basic.actions,{type:'break'}],label:'mid-event break'},
  {row:basic,actions:[...basic.restedActions,{type:'break'}],label:'second break in one interval'},
  {row:basic,actions:[...basic.firstGapActions,{type:'choice',eventId:rawGap.eventId,index:0}],label:'skip gap start'},
  {row:basic,actions:[...basic.firstGapActions,{type:'choice',eventId:'work-gap-v50',index:1}],label:'invented gap option'},
  {row:onboarding,actions:[...onboarding.beforeActions,{type:'choice',eventId:'work-gap-v50',index:0}],label:'gap before reporting'},
  {row:basic,actions:[...basic.firstGapActions,{type:'choice',eventId:'work-gap-v50',index:0},{type:'choice',eventId:'work-gap-v50',index:0}],label:'duplicate gap start'},
 ];
 for(const id of ['mood-collapse','salary-cut','low-pay-tip','pip-start','pip-review','patronage-application']){
  const row=find(id);invalid.push({row,actions:[...row.beforeActions,{type:'break'}],label:`skip ${id}`});
 }
 for(const {row,actions,label}of invalid){
  const response=await h.call('/api/characters',{method:'POST',token:player.token,body:proof(row,randomUUID(),actions)});
  assert.equal(response.status,400,label);assert.equal(response.body.error,'invalid_replay',label);
 }
 const unfinished=await h.call('/api/complete',{method:'POST',token:player.token,body:{...proof(basic,randomUUID(),basic.restedActions),completed:true,endingId:basic.endingId}});
 assert.equal(unfinished.status,400);assert.equal(unfinished.body.error,'incomplete_run');
 assert.equal((await h.call('/api/stats')).body.totalRuns,0);
});

test('canonical meals, Kind, activity, PIP, appointment and dream returns sync without invented work or character counts',async t=>{
 const h=harness(t);
 for(const id of ['meal-paid','meal-declined','kind-break-paid','kind-workday-return','pip-work-gap','patronage-application','activity-completed','rage-event-imagined','rage-result-imagined','exit-return']){
  const player=await h.register(),row=find(id),runId=randomUUID(),before=await h.call('/api/characters',{method:'POST',token:player.token,body:proof(row,runId,row.beforeActions)});
  assert.equal(before.status,200,id);
  const response=await h.call('/api/characters',{method:'POST',token:player.token,body:proof(row,runId)});
  assert.equal(response.status,200,id);assert.equal(response.body.verified,true,id);assert.equal(response.body.totalRuns,0,id);
  const run=replayRun(row.roleId,row.seed,row.actions);
  assert.deepEqual(response.body.characters,deriveCharacterStats(run),id);
 }
 assert.equal((await h.call('/api/stats')).body.totalRuns,0);
});
