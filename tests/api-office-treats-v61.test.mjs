import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as E from '../dist/engine.js';
import {ROLE_MAP,ROLES} from '../dist/roles.js';
import {ENDINGS} from '../dist/endings.js';
import {deriveCharacterStats} from '../dist/character-stats.js';
import {AchievementStore} from '../worker/achievements.js';
import {CharacterStore} from '../worker/characters.js';
import {ObservationStore} from '../worker/observations.js';
import {FeedbackStore} from '../worker/feedback-store.js';
import {validateFeedback,validatePublisherToken} from '../worker/feedback.js';
import * as http from '../worker/http.js';

const source=readFileSync(new URL('../worker/index.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export class HedoArchive','globalThis.HedoArchive=class HedoArchive').replace('export default','globalThis.worker=');
const fixture=JSON.parse(readFileSync(new URL('./fixtures/office-treats-routes-v61.json',import.meta.url),'utf8'));
const ids=['jack-drinks','company-tea','birthday-cake'];
const route=id=>{const row=fixture.routes.find(row=>row.id===id);assert.ok(row,id);return row;};
const before=id=>{const row=route(id);return E.replayRun(row.roleId,row.seed,row.beforeActions);};
const choose=(run,index)=>E.advance(E.applyChoice(run,index));
const proof=(run,runId=randomUUID(),actions=run.actions)=>({runId,roleId:run.roleId,seed:run.seed,actions});
// Real production routing and stores, isolated from production collections.
function harness(t){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());db.exec('PRAGMA foreign_keys = ON');
 const sql={exec(query,...args){let rows=[];if(!args.length&&query.includes(';'))db.exec(query);else{const stmt=db.prepare(query);if(stmt.columns().length)rows=stmt.all(...args);else stmt.run(...args);}return{toArray:()=>rows,one:()=>{assert.equal(rows.length,1);return rows[0];}};}};
 const storage={sql,transactionSync(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}},async getAlarm(){return null;},async setAlarm(){}};
 const context=vm.createContext({DurableObject:class{constructor(ctx){this.ctx=ctx;}},replayRun:E.replayRun,VERSION:E.VERSION,MAX_TURNS:E.MAX_TURNS,ROLE_MAP,ENDINGS,...http,validateFeedback,validatePublisherToken,FeedbackStore,AchievementStore,CharacterStore,ObservationStore,crypto,Response,Request,URL,Date});
 vm.runInContext(source,context);const archive=new context.HedoArchive({storage,blockConcurrencyWhile:fn=>fn()},{});
 const call=async(path,{method='GET',token,body}={})=>{archive.rate=new http.RateGuard();const headers={};if(token)headers.Authorization=`Bearer ${token}`;if(body)headers['Content-Type']='application/json';const response=await archive.fetch(new Request(`https://game.example${path}`,{method,headers,body:body?JSON.stringify(body):undefined}));return{status:response.status,body:await response.json()};};
 const register=async()=>{const token=randomBytes(32).toString('hex');assert.equal((await call('/api/player',{method:'POST',body:{token}})).status,200);return token;};
 return{sql,call,register};
}


test('the Worker replays all three sponsored office stories without trusting client order, sponsor, costs or relationship counters',async t=>{
 const h=harness(t);
 for(const story of ids){
  const token=await h.register(),runId=randomUUID();let run=before(`${story}-0-0`),start=run;
  for(let stage=0;stage<3;stage++){
   assert.equal(run.treatsContext.id,story);assert.equal(run.treatsContext.stage,stage);run=choose(run,0);
   const response=await h.call('/api/characters',{method:'POST',token,body:{...proof(run,runId),stats:{cash:100,energy:100},treatsContext:{version:1,id:story,stage:99,returnEventId:'finale'},treatsOutcome:{version:1,done:true,result:'invented',affinityDelta:999},characters:[{id:'jack',affinityGained:9999}]}});
   assert.equal(response.status,200,`${story}/${stage}`);assert.equal(response.body.verified,true);assert.equal(response.body.totalRuns,0);assert.deepEqual(response.body.characters,deriveCharacterStats(run));
  }
  assert.ok(run.treatsContext==null);assert.equal(run.stats.cash,start.stats.cash);assert.equal(run.pay,start.pay);assert.equal(run.turn,start.turn);
  const duplicate=await h.call('/api/characters',{method:'POST',token,body:proof(run,runId)});assert.equal(duplicate.status,200);assert.deepEqual(duplicate.body.characters,deriveCharacterStats(run));
  const delayed=await h.call('/api/characters',{method:'POST',token,body:proof(start,runId)});assert.equal(delayed.status,200);assert.deepEqual(delayed.body.characters,duplicate.body.characters);
  const incomplete=await h.call('/api/complete',{method:'POST',token,body:{...proof(run,runId),completed:true,endingId:'nasdaq-system'}});assert.equal(incomplete.status,400);assert.equal(incomplete.body.error,'incomplete_run');
 }
 assert.equal((await h.call('/api/stats')).body.totalRuns,0);assert.doesNotMatch(JSON.stringify((await h.call('/api/characters')).body),/treatsContext|treatsOutcome|seed|actions|history|playerId|runId/);
});

test('the Worker rejects skipped stages, stale invitations, forged menu actions and divergent office responses on an existing run',async t=>{
 const h=harness(t),token=await h.register();
 for(const story of ids){
  const initial=before(`${story}-0-0`),middle=choose(initial,0),ended=E.replayRun(route(`${story}-2-0`).roleId,route(`${story}-2-0`).seed,route(`${story}-2-0`).actions);
  const attacks=[
   [...initial.actions,{type:'choice',eventId:`treats61-${story}-2`,index:0}],
   [...middle.actions,{type:'choice',eventId:`treats61-${story}-0`,index:0}],
   [...ended.actions,{type:'choice',eventId:`treats61-${story}-0`,index:0}],
   ...[{type:'exit'},{type:'break'},{type:'career'},{type:'raise'},{type:'activity-invitation',version:1,eventId:initial.eventId}].map(action=>[...initial.actions,action])
  ];
  for(const actions of attacks){const result=await h.call('/api/characters',{method:'POST',token,body:proof(initial,randomUUID(),actions)});assert.equal(result.status,400);assert.match(result.body.error,/^invalid_(?:actions|replay)$/);}
  const runId=randomUUID();assert.equal((await h.call('/api/characters',{method:'POST',token,body:proof(middle,runId)})).status,200);
  const alternate=choose(initial,2),fork=await h.call('/api/characters',{method:'POST',token,body:proof(alternate,runId)});assert.equal(fork.status,409);
  const stranger=await h.register();assert.equal((await h.call('/api/characters',{method:'POST',token:stranger,body:proof(middle,runId)})).status,409);
 }
 assert.equal((await h.call('/api/stats')).body.totalRuns,0);
});

test('ordinary choice metadata cannot manufacture a sponsored story or a company-tea cancellation on an older cohort',async t=>{
 const h=harness(t),token=await h.register(),run=choose(E.enableActivitySchedule(E.createRun('system','e39-r60-n-'+'a'.repeat(22))),0);
 assert.equal(run.treatsContext,undefined);const response=await h.call('/api/characters',{method:'POST',token,body:{...proof(run),flags:{treats61_company_tea_cancelled:1},treatsOutcome:{version:1,id:'birthday-cake',stage:2,target:'jack',affinityDelta:999,accepted:true,done:true,result:'invented'}}});
 assert.equal(response.status,200);assert.deepEqual(response.body.characters,deriveCharacterStats(run));assert.equal(response.body.totalRuns,0);
 const forged=await h.call('/api/characters',{method:'POST',token,body:proof(run,randomUUID(),[...run.actions,{type:'choice',eventId:'treats61-birthday-cake-0',index:0}])});assert.equal(forged.status,400);assert.equal(forged.body.error,'invalid_replay');
});
