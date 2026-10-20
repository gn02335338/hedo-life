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
import {CHARACTER_IDS,CHARACTER_METRICS,deriveCharacterStats} from '../dist/character-stats.js';

const source=readFileSync(new URL('../worker/index.js',import.meta.url),'utf8')
 .replace(/^import .*;\n/gm,'')
 .replace('export class HedoArchive','globalThis.HedoArchive=class HedoArchive')
 .replace('export default','globalThis.worker=');
const {routes}=JSON.parse(readFileSync(new URL('./fixtures/wealth-routes-v27.json',import.meta.url),'utf8'));
const endings=routes.filter(route=>route.kind==='ending');
const proof=(route,runId)=>({runId,roleId:route.roleId,seed:route.seed,actions:route.actions});
function harness(t){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());db.exec('PRAGMA foreign_keys = ON');
 const sql={exec(query,...args){
  let rows=[];
  if(!args.length&&query.includes(';'))db.exec(query);
  else {const statement=db.prepare(query);if(statement.columns().length)rows=statement.all(...args);else statement.run(...args);}
  return {toArray:()=>rows,one:()=>{assert.equal(rows.length,1);return rows[0];}};
 }};
 const storage={sql,transactionSync(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}},async getAlarm(){return null;},async setAlarm(){}};
 const scope=vm.createContext({DurableObject:class {constructor(context){this.ctx=context;}},replayRun,VERSION,MAX_TURNS,ROLE_MAP,ENDINGS,
  ...http,validateFeedback,validatePublisherToken,FeedbackStore,AchievementStore,CharacterStore,crypto,Response,Request,URL,Date});
 vm.runInContext(source,scope);
 const archive=new scope.HedoArchive({storage,blockConcurrencyWhile:fn=>fn()},{});
 const call=async(path,{method='GET',token,body}={})=>{
  archive.rate=new http.RateGuard();const headers={};if(token)headers.Authorization=`Bearer ${token}`;if(body)headers['Content-Type']='application/json';
  const response=await archive.fetch(new Request(`https://game.example${path}`,{method,headers,body:body?JSON.stringify(body):undefined}));
  return {status:response.status,body:await response.json()};
 };
 const register=async()=>{const token=randomBytes(32).toString('hex');const result=await call('/api/player',{method:'POST',body:{token}});assert.equal(result.status,200);return {token,id:result.body.playerId};};
 return {sql,call,register};
}

test('all 36 wealth endings are replay-verified and count once without accepting supplied wealth or changing another player',async t=>{
 const h=harness(t);assert.equal(endings.length,36);
 const isolated=await h.register();
 for(const route of endings){
  const player=await h.register(),runId=randomUUID(),run=replayRun(route.roleId,route.seed,route.actions);
  const prefix={...route,actions:route.choiceActions};
  const progress=await h.call('/api/characters',{method:'POST',token:player.token,body:{...proof(prefix,runId),stats:{cash:999,mood:100},flags:{wealth_retire_notice:999},endingId:route.id}});
  assert.equal(progress.status,200,route.id);assert.equal(progress.body.totalRuns,0);
  const receipt=await h.call('/api/complete',{method:'POST',token:player.token,body:{...proof(route,runId),stats:{cash:999},endingId:'nasdaq-system',characters:[{id:'wing',realHits:9999}]}});
  assert.equal(receipt.status,200,route.id);assert.equal(receipt.body.recorded,true);assert.equal(receipt.body.duplicate,false);
  assert.equal(receipt.body.endingId,route.id);assert.equal(receipt.body.totalRuns,1);assert.deepEqual(receipt.body.characters,deriveCharacterStats(run));
  const duplicate=await h.call('/api/complete',{method:'POST',token:player.token,body:proof(route,runId)});
  assert.equal(duplicate.status,200);assert.equal(duplicate.body.duplicate,true);assert.equal(duplicate.body.totalRuns,1);
  const delayed=await h.call('/api/characters',{method:'POST',token:player.token,body:proof(prefix,runId)});
  assert.equal(delayed.status,200);assert.deepEqual(delayed.body.characters,receipt.body.characters);
  const foreign=await h.call('/api/complete',{method:'POST',token:isolated.token,body:proof(route,runId)});
  assert.equal(foreign.status,409,route.id);
 }
 assert.equal((await h.call('/api/stats')).body.totalRuns,36);
 const other=await h.call('/api/me',{token:isolated.token});assert.equal(other.status,200);assert.equal(other.body.totalRuns,0);
 assert.ok(other.body.characters.every(row=>CHARACTER_METRICS.every(key=>row[key]===0)));
 const publicCharacters=await h.call('/api/characters');assert.equal(publicCharacters.body.characters.length,CHARACTER_IDS.length);
 assert.doesNotMatch(JSON.stringify(publicCharacters.body),/seed|actions|wealthReturnEventId|playerId|runId/);
});

test('wealth views, invented qualifications, invalid scene ordering and conflicting committed branches cannot forge an ending',async t=>{
 const h=harness(t),player=await h.register(),route=endings.find(row=>row.family==='retired_free');assert.ok(route);
 const early={...route,actions:[]},incomplete={...route,actions:route.choiceActions};
 for(const candidate of [early,incomplete]){
  const response=await h.call('/api/complete',{method:'POST',token:player.token,body:{...proof(candidate,randomUUID()),endingId:route.id,stats:{cash:100},history:Array.from({length:20},()=>({kind:'daily'})),flags:{wealth_retire_notice:1}}});
  assert.equal(response.status,400);assert.equal(response.body.error,candidate.actions.length?'incomplete_run':'invalid_actions');
 }
 for(const actions of [
  [{type:'choice',eventId:'wealth-plan',index:1}],
  [{type:'choice',eventId:'wealth-startup',index:0}],
  [{type:'choice',eventId:'wealth-retire',index:0}],
  [...route.choiceActions,{type:'choice',eventId:'wealth-retire',index:99}],
 ]){
  const response=await h.call('/api/characters',{method:'POST',token:player.token,body:{...proof(route,randomUUID()),actions}});
  assert.equal(response.status,400);assert.equal(response.body.error,actions.at(-1).index===99?'invalid_actions':'invalid_replay');
 }
 const fork=endings.find(candidate=>candidate.family==='retired_flexible'&&candidate.roleId===route.roleId&&candidate.seed===route.seed&&JSON.stringify(candidate.choiceActions)===JSON.stringify(route.choiceActions));
 assert.ok(fork,'the two explicit retirement choices share one authentic branch');
 const runId=randomUUID(),accepted=await h.call('/api/complete',{method:'POST',token:player.token,body:proof(route,runId)});assert.equal(accepted.status,200);
 const conflict=await h.call('/api/complete',{method:'POST',token:player.token,body:proof(fork,runId)});assert.equal(conflict.status,409);
 assert.equal((await h.call('/api/stats')).body.totalRuns,1);
});
