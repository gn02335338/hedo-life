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
const proof=(route,runId=randomUUID(),actions=route.actions)=>({runId,roleId:route.roleId,seed:route.seed,actions});
const badgeIds=response=>response.body.achievements.map(row=>row.id).sort();
const finaleBadges=new Set(ACHIEVEMENTS_V32.filter(row=>!['verbal-first-word','verbal-many-ears','verbal-late-reply','verbal-pip-microphone','verbal-exit-team'].includes(row.id)).map(row=>row.id));
const archived=JSON.parse(readFileSync(new URL('./fixtures/legacy-e32-routes.json',import.meta.url),'utf8')).routes;

function naturalContinuation(roleId,{phase='event',assignment=null}={}){
 for(let index=0;index<1000;index++){
  let start=engine.createRun(roleId,`e33-api-${roleId}-${phase[0]}-${index.toString(36)}`);
  if(assignment&&start.assignment!==assignment)continue;
  const original=phase==='result'?engine.applyChoice(start,0):start;
  const speech=engine.advance(engine.requestVerbal(original,undefined,2));
  if(speech.eventId!=='verbal-v32-aftermath'||speech.verbalContext?.outcome==='personnel'||speech.verbalContext?.outcome==='legal')continue;
  const pending=engine.applyChoice(speech,0);
  if(pending.pendingFamily||pending.pendingEffect!=='verbalV32Continue')continue;
  const continued=engine.advance(pending);
  if(continued.completed||continued.pendingFamily)continue;
  return {start,original,speech,pending,continued};
 }
 throw new Error(`Missing natural e33 ${roleId}/${phase}/${assignment||'any'} continuation`);
}
const asRoute=run=>({roleId:run.roleId,seed:run.seed,actions:run.actions});
const assertProjection=(response,run)=>{
 assert.equal(response.status,200);
 assert.deepEqual(response.body.characters,deriveCharacterStats(run));
 assert.deepEqual(badgeIds(response),deriveAchievements(run).sort());
 assert.ok(response.body.characters.every(row=>row.realHits===0&&row.imaginedHits===0),'a spoken response never proves a hit');
};

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

test('e33 calm spoken replies verify as ongoing lives for all professions without accepting changed offers or manufacturing endings',async t=>{
 const h=harness(t),assignmentCases=new Set();
 for(const roleId of Object.keys(ROLE_MAP)){
  const {start,speech,continued}=naturalContinuation(roleId);
  assert.equal(engine.validRun(continued),true,roleId);
  assignmentCases.add(start.assignment);
  const player=await h.register(),runId=randomUUID(),route=asRoute(continued);
  const spoken=await h.post(player,route,runId,speech.actions);assertProjection(spoken,speech);
  assert.equal(spoken.body.totalRuns,0);
  const forged={completed:true,endingId:`verbal_onboarding-${roleId}`,achievements:[...finaleBadges],verbalContext:{outcome:'support'},companyContext:{route:'buyer'}};
  const progress=await h.post(player,route,runId,route.actions,'/api/achievements',forged);assertProjection(progress,continued);
  assert.equal(progress.body.totalRuns,0);assert.ok(badgeIds(progress).includes('verbal-first-word'));
  assert.ok(badgeIds(progress).every(id=>!finaleBadges.has(id)));
  const duplicate=await h.post(player,route,runId);assertProjection(duplicate,continued);assert.deepEqual(duplicate.body.characters,progress.body.characters);assert.deepEqual(duplicate.body.achievements,progress.body.achievements);
  const invalidCompletion=await h.post(player,route,runId,route.actions,'/api/complete',forged);
  assert.equal(invalidCompletion.status,400);assert.equal(invalidCompletion.body.error,'incomplete_run');
  if(start.assignment!=='honest'){
   assert.equal(continued.eventId,'verbal-v2-decision',roleId);
   assert.equal(continued.verbalContext.stage,'decision');
   assert.equal(continued.actualRoleId,start.actualRoleId);assert.equal(continued.pay,start.pay);assert.equal(continued.rank,start.rank);
   const accepted=engine.advance(engine.applyChoice(continued,0));
   assert.equal(engine.validRun(accepted),true);assert.equal(accepted.completed,false);
   const acceptance=await h.post(player,route,runId,accepted.actions);assertProjection(acceptance,accepted);assert.equal(acceptance.body.totalRuns,0);
   const stale=await h.post(player,route,runId,route.actions,'/api/characters');assert.equal(stale.status,200);assert.deepEqual(stale.body.characters,acceptance.body.characters);
  }else{
   assert.equal(continued.verbalContext,null);
   assert.notEqual(continued.eventId,'verbal-v32-aftermath');
  }
  const observation=h.sql.exec('SELECT COUNT(*) AS n FROM run_observations').one();assert.equal(observation.n,0);
 }
 assert.ok(assignmentCases.has('honest'));assert.ok(assignmentCases.has('assistant')||assignmentCases.has('swapped'));
 assert.equal((await h.call('/api/stats')).body.totalRuns,0);
});

test('e33 result-phase continuation preserves an already selected onboarding choice and retries cannot duplicate its character evidence',async t=>{
 const h=harness(t);
 for(const assignment of ['honest','swapped','assistant']){
  const {original,speech,continued}=naturalContinuation('sales',{phase:'result',assignment});
  assert.deepEqual(continued.history[0],original.history[0]);
  assert.equal(continued.history.filter(row=>row.eventId==='onboarding'&&row.kind==='onboarding').length,1);
  assert.equal(continued.verbalContext,null);assert.equal(continued.pay,original.pay);assert.equal(continued.actualRoleId,original.actualRoleId);assert.equal(continued.assignment,original.assignment);
  const player=await h.register(),runId=randomUUID(),route=asRoute(continued);
  const first=await h.post(player,route,runId,speech.actions);assertProjection(first,speech);
  const response=await h.post(player,route,runId);assertProjection(response,continued);
  assert.ok(badgeIds(response).includes('verbal-late-reply'));assert.equal(response.body.totalRuns,0);
  const repeated=await h.post(player,route,runId);assert.deepEqual(repeated.body.characters,response.body.characters);assert.deepEqual(repeated.body.achievements,response.body.achievements);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM runs').one().n,0);
 }
});

test('the e33 API still honors frozen e32 endings and rejects future, supplied and unplayed outcomes',async t=>{
 const h=harness(t),player=await h.register(),old=archived.find(route=>route.ending==='verbal_onboarding-system');assert.ok(old);
 const existing=await h.post(player,old,randomUUID(),old.actions,'/api/complete');
 assert.equal(existing.status,200);assert.equal(existing.body.endingId,old.ending);assert.equal(existing.body.totalRuns,1);
 assert.deepEqual(badgeIds(existing),[...old.achievements].sort());assert.deepEqual(existing.body.characters,old.characterStats);
 const fresh=await h.register(),{continued}=naturalContinuation('sales'),route=asRoute(continued);
 for(const actions of [
  [{type:'choice',eventId:'verbal-v32-aftermath',index:0}],
  [{type:'choice',eventId:'company-v32-buyer',index:0}],
  [{type:'verbal',phase:'event',eventId:'onboarding',version:2,severity:3}],
  [{type:'verbal',phase:'event',eventId:'onboarding',version:2,family:'verbal_boardroom'}]
 ]){
  const invalid=await h.post(fresh,route,randomUUID(),actions);assert.equal(invalid.status,400);assert.ok(['invalid_actions','invalid_replay'].includes(invalid.body.error));
 }
 const future=await h.call('/api/achievements',{method:'POST',token:fresh.token,body:{runId:randomUUID(),roleId:'sales',seed:'e37-still-unsupported',actions:[{type:'verbal',phase:'event',eventId:'onboarding',version:2}]}});
 assert.equal(future.status,400);assert.equal(future.body.error,'invalid_actions');
 assert.equal((await h.call('/api/me',{token:fresh.token})).body.totalRuns,0);
});

test('all ten naturally reached e33 company directions verify independently and retries preserve anonymous aggregates',async t=>{
 const h=harness(t),{completions}=JSON.parse(readFileSync(new URL('./fixtures/company-player-routes-v33.json',import.meta.url),'utf8'));
 const families=new Set();assert.equal(completions.length,10);
 for(const route of completions){
  assert.match(route.seed,/^e33-/);
  const run=engine.replayRun(route.roleId,route.seed,route.actions);
  assert.equal(engine.validRun(run),true);assert.equal(run.completed,true);assert.equal(run.endingId,route.ending);
  families.add(route.ending.slice(0,-route.roleId.length-1));
  const player=await h.register(),runId=randomUUID(),prefix=route.actions.slice(0,-1),open=engine.replayRun(route.roleId,route.seed,prefix);
  assert.equal(open.completed,false);assert.ok(open.companyContext);
  const progress=await h.post(player,route,runId,prefix);assertProjection(progress,open);assert.equal(progress.body.totalRuns,0);
  const complete=await h.post(player,route,runId,route.actions,'/api/complete',{endingId:'google_board-system',achievements:[...finaleBadges],companyContext:{route:'buyer'}});
  assertProjection(complete,run);assert.equal(complete.body.endingId,route.ending);assert.equal(complete.body.totalRuns,1);assert.equal(complete.body.duplicate,false);
  const duplicate=await h.post(player,route,runId,route.actions,'/api/complete');
  assert.equal(duplicate.status,200);assert.equal(duplicate.body.duplicate,true);assert.equal(duplicate.body.totalRuns,1);
  assert.deepEqual(duplicate.body.achievements,complete.body.achievements);assert.deepEqual(duplicate.body.characters,complete.body.characters);
  const observation=h.sql.exec('SELECT rule_cohort FROM run_observations WHERE run_id=?',runId).one();assert.equal(observation.rule_cohort,33);
 }
 assert.deepEqual([...families].sort(),['nasdaq','nasdaq_failed','taiwan','taiwan_failed','google_board','google_ousted','buyer_board','buyer_ousted','vietnam_core','vietnam_afterdark'].sort());
 const stats=(await h.call('/api/stats')).body;
 assert.equal(stats.totalRuns,10);assert.equal(stats.uniqueEndings,10);
 assert.deepEqual(stats.observatory.departureWays.map(row=>row.id),DEPARTURE_WAYS);
 assert.deepEqual(stats.observatory.departureWays,departureWays(stats.endings));
 assert.equal(stats.observatory.departureWays.reduce((sum,row)=>sum+row.count,0),10);
 assert.equal(stats.observatory.departureWays.find(row=>row.id==='unclassified').count,0);
 assert.doesNotMatch(JSON.stringify(stats.observatory),/runId|playerId|seed|actions|history|companyContext|verbalContext/);
});
