import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as E from '../dist/engine.js';
import {ROLE_MAP} from '../dist/roles.js';
import {ENDINGS} from '../dist/endings.js';
import {CHARACTER_IDS,CHARACTER_METRICS,deriveCharacterStats} from '../dist/character-stats.js';
import {createCareerDuelModelV75,DUEL_STEP_V75,DUEL_FRAME_LIMIT_V75} from '../dist/career-duel-v75.js';
import {FeedbackStore} from '../worker/feedback-store.js';
import {AchievementStore} from '../worker/achievements.js';
import {CharacterStore} from '../worker/characters.js';
import {ObservationStore} from '../worker/observations.js';
import {validateFeedback,validatePublisherToken} from '../worker/feedback.js';
import * as http from '../worker/http.js';

const workerSource=readFileSync(new URL('../worker/index.js',import.meta.url),'utf8')
 .replace(/^import .*;\n/gm,'').replace('export class HedoArchive','globalThis.HedoArchive=class HedoArchive').replace('export default','globalThis.worker=');

// Execute the shipped Worker handlers and real stores with isolated SQLite.
// No production service, credentials, player records or network are involved.
function harness(t){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());db.exec('PRAGMA foreign_keys=ON');
 const sql={exec(query,...args){let rows=[];if(!args.length&&query.includes(';'))db.exec(query);else{const statement=db.prepare(query);if(statement.columns().length)rows=statement.all(...args);else statement.run(...args);}return {toArray:()=>rows,one:()=>{assert.equal(rows.length,1);return rows[0];}};}};
 const storage={sql,transactionSync(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}},async getAlarm(){return null;},async setAlarm(){}};
 const scope=vm.createContext({DurableObject:class{constructor(ctx){this.ctx=ctx;}},replayRun:E.replayRun,VERSION:E.VERSION,MAX_TURNS:E.MAX_TURNS,ROLE_MAP,ENDINGS,
  ...http,validateFeedback,validatePublisherToken,FeedbackStore,AchievementStore,CharacterStore,ObservationStore,crypto,Response,Request,URL,Date});
 vm.runInContext(workerSource,scope);const context={storage,blockConcurrencyWhile:fn=>fn()};let archive=new scope.HedoArchive(context,{});
 const call=async(path,{method='GET',token,body}={})=>{
  archive.rate=new http.RateGuard();
  const response=await archive.fetch(new Request(`https://game.example${path}`,{method,headers:{...(token?{Authorization:`Bearer ${token}`}:{ }),...(body?{'Content-Type':'application/json',Origin:'https://game.example'}:{})},...(body?{body:JSON.stringify(body)}:{})}));
  return {status:response.status,body:await response.json(),headers:response.headers};
 };
 const register=async()=>{const token=randomBytes(32).toString('hex'),response=await call('/api/player',{method:'POST',body:{token}});assert.equal(response.status,200);return {token,id:response.body.playerId};};
 return {sql,call,register,restart(){archive=new scope.HedoArchive(context,{});}};
}
const proof=(run,runId)=>({runId,roleId:run.roleId,seed:run.seed,actions:run.actions});
const post=(h,path,player,run,runId,extra={})=>h.call(path,{method:'POST',token:player.token,body:{...proof(run,runId),...extra}});
function ordinary(){
 const run=E.enableActivitySchedule(E.createRun('system','e39-r75-n-0000000000000000000024'));
 return E.advance(E.applyChoice(run,0));
}
function counterplay(state){
 const x=state.opponent.x-state.player.x,y=state.opponent.y-state.player.y,distance=Math.hypot(x,y),dodge=state.opponent.telegraphRemaining>0&&state.opponent.telegraphRemaining<.23&&distance<135;
 return {x:dodge?-x:distance>65?x:0,y:dodge?-y:distance>65?y:0,attack:state.opponent.telegraphRemaining===0,dodge,special:state.player.energy>=100&&distance<140};
}
function hitThenSurrender(battle){
 const context=battle.duelContextV75,model=createCareerDuelModelV75({opponentId:context.target,seed:context.seed});let state=model.start();
 for(let frame=0;frame<DUEL_FRAME_LIMIT_V75&&state.phase==='playing'&&state.player.hp>0;frame++){
  state=model.step(DUEL_STEP_V75,counterplay(state));
  if(state.summary?.damageDealt>0)break;
  // Active combat exposes cumulative damage through the opponent HP.
  if(state.opponent.hp<state.opponent.maxHp)break;
 }
 assert.ok(state.opponent.hp<state.opponent.maxHp,'the recorded player input landed a real hit');
 if(state.phase==='playing')model.forfeit();
 return E.applyDuelPlayV75(battle,model.getProof());
}
const aftercare=result=>E.advance(E.applyChoice(E.advance(result),0));

test('the Worker accepts invitation and pending battle prefixes, extends through aftercare and completion exactly once',async t=>{
 const h=harness(t),player=await h.register(),runId=randomUUID(),before=ordinary(),invitation=E.requestDuelV75(before,'wing');
 assert.equal(invitation.duelContextV75.accepted,true);
 const first=await post(h,'/api/characters',player,invitation,runId);
 assert.equal(first.status,200);assert.equal(first.body.verified,true);assert.deepEqual(first.body.characters,deriveCharacterStats(invitation));assert.equal(first.body.totalRuns,0);
 const battle=E.advance(invitation),result=hitThenSurrender(battle);
 assert.equal(result.pending,true);assert.ok(result.history.at(-1).duelOutcome.summary.damageDealt>0);
 const extended=await post(h,'/api/achievements',player,result,runId);
 assert.equal(extended.status,200);assert.deepEqual(extended.body.characters,deriveCharacterStats(result));
 assert.equal(extended.body.characters.find(row=>row.id==='wing').realHits,1);
 const duplicate=await post(h,'/api/characters',player,result,runId);
 assert.equal(duplicate.status,200);assert.deepEqual(duplicate.body.characters,extended.body.characters);
 const returned=aftercare(result);assert.equal(returned.turn,before.turn);assert.equal(returned.eventId,before.eventId);
 const full=await post(h,'/api/characters',player,returned,runId);
 assert.equal(full.status,200);assert.deepEqual(full.body.characters,deriveCharacterStats(returned));assert.equal(full.body.totalRuns,0);
 const completed=E.advance(E.applyChoice(E.requestExit(returned),0));assert.equal(completed.completed,true);
 const receipt=await post(h,'/api/complete',player,completed,runId);
 assert.equal(receipt.status,200);assert.equal(receipt.body.duplicate,false);assert.equal(receipt.body.totalRuns,1);
 assert.deepEqual(receipt.body.characters,deriveCharacterStats(completed));
 const retry=await post(h,'/api/complete',player,completed,runId);
 assert.equal(retry.status,200);assert.equal(retry.body.duplicate,true);assert.deepEqual(retry.body.characters,receipt.body.characters);
 const delayed=await post(h,'/api/characters',player,invitation,runId);
 assert.equal(delayed.status,200);assert.deepEqual(delayed.body.characters,receipt.body.characters);
 assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM runs').one().n,1);
 h.restart();const personal=await h.call('/api/me',{token:player.token});assert.deepEqual(personal.body.characters,receipt.body.characters);
});

test('a committed recording cannot be swapped, supplied winners are rejected, and another anonymous player stays isolated',async t=>{
 const h=harness(t),player=await h.register(),other=await h.register(),runId=randomUUID();
 const battle=E.advance(E.requestDuelV75(ordinary(),'wing')),result=hitThenSurrender(battle);
 const response=await post(h,'/api/characters',player,result,runId,{outcome:'win',stats:{realHits:999},characters:[{id:'wing',realHits:999}],history:[{duelOutcome:{outcome:'win'}}]});
 assert.equal(response.status,200);assert.deepEqual(response.body.characters,deriveCharacterStats(result));
 const fork=E.applyDuelPlayV75(battle,{frames:'40',forfeit:true});assert.equal(E.validRun(fork),true);assert.equal(fork.actions.length,result.actions.length);
 const changed=await post(h,'/api/characters',player,fork,runId);assert.equal(changed.status,409);
 const foreign=await post(h,'/api/achievements',other,result,runId);assert.equal(foreign.status,409);
 const untouched=await h.call('/api/me',{token:other.token});assert.ok(untouched.body.characters.every(row=>CHARACTER_METRICS.every(metric=>row[metric]===0)));
 const invented=structuredClone(proof(result,randomUUID()));invented.actions.at(-1).input.outcome='win';
 assert.equal((await h.call('/api/characters',{method:'POST',token:player.token,body:invented})).status,400);
 const unfinished=structuredClone(proof(battle,randomUUID()));unfinished.actions.push({type:'duel-play',version:1,eventId:'duel75-battle',input:{frames:'40',forfeit:false}});
 const invalid=await h.call('/api/characters',{method:'POST',token:player.token,body:unfinished});assert.equal(invalid.status,400);assert.equal(invalid.body.error,'invalid_replay');
 assert.equal((await h.call('/api/characters',{method:'POST',body:proof(result,randomUUID())})).status,401);
 const publicStats=await h.call('/api/characters');assert.deepEqual(publicStats.body.characters,response.body.characters);
 const serialized=JSON.stringify(publicStats.body);for(const privateValue of [player.id,other.id,player.token,other.token,result.seed,runId,'duelOutcome','frames','actions','history'])assert.ok(!serialized.includes(privateValue));
});

test('a naturally accepted hidden-person duel replays on the Worker while its identity and hit stay outside public counters',async t=>{
 const h=harness(t),player=await h.register(),runId=randomUUID();
 const hidden=E.requestHiddenEncounter(E.replayRun('system','e39-r75-n-000000000000000000000b',[
  {type:'activity-schedule',version:1},{type:'choice',eventId:'onboarding',index:0},{type:'choice',eventId:'career71-project-risk-owner',index:0}
 ]));
 const invitation=E.requestDuelV75(hidden,'hidden-visitor');assert.equal(invitation.duelContextV75.accepted,true);
 assert.equal((await post(h,'/api/characters',player,invitation,runId)).status,200);
 const result=hitThenSurrender(E.advance(invitation)),returned=aftercare(result);
 assert.deepEqual(returned.hiddenEncounterContext,hidden.hiddenEncounterContext);
 const response=await post(h,'/api/achievements',player,returned,runId);
 assert.equal(response.status,200);assert.deepEqual(response.body.characters,deriveCharacterStats(hidden));
 assert.equal(response.body.characters.length,CHARACTER_IDS.length);assert.ok(!response.body.characters.some(row=>row.id==='hidden-visitor'));
 const publicStats=await h.call('/api/characters');assert.deepEqual(publicStats.body.characters,response.body.characters);
 assert.doesNotMatch(JSON.stringify(publicStats.body),/hidden-visitor|魚酥|duelOutcome|frames|actions|seed/);
 for(const table of ['character_runs','character_run_totals','player_characters','global_characters']){
  const persisted=JSON.stringify(h.sql.exec(`SELECT * FROM ${table}`).toArray());
  assert.ok(!persisted.includes(hidden.seed));assert.doesNotMatch(persisted,/hidden-visitor|魚酥|duelOutcome|"frames"|"actions"/);
 }
});
