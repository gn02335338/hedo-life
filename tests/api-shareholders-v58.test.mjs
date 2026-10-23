import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as E from '../dist/engine.js';
import {ROLE_MAP} from '../dist/roles.js';
import {ENDINGS} from '../dist/endings.js';
import {deriveCharacterStats} from '../dist/character-stats.js';
import {AchievementStore} from '../worker/achievements.js';
import {CharacterStore} from '../worker/characters.js';
import {ObservationStore} from '../worker/observations.js';
import {FeedbackStore} from '../worker/feedback-store.js';
import {validateFeedback,validatePublisherToken} from '../worker/feedback.js';
import * as http from '../worker/http.js';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/shareholder-routes-v58.json',import.meta.url),'utf8'));
const row=id=>{const value=fixture.routes.find(route=>route.id===id);assert.ok(value,id);return value;};
const proof=(route,runId=randomUUID(),actions=route.actions)=>({runId,roleId:route.roleId,seed:route.seed,actions});
const action=run=>({type:'shareholder-play',version:1,eventId:run.eventId,input:{mode:'press',statement:0,evidence:null}});
const invalidInputs=()=>[
 null,[],{},'present',{mode:'unknown',statement:0,evidence:null},
 {mode:'press',statement:0},{mode:'press',statement:0,evidence:'subscription'},
 {mode:'press',statement:-1,evidence:null},{mode:'press',statement:3,evidence:null},
 {mode:'press',statement:'0',evidence:null},{mode:'press',statement:1.5,evidence:null},
 {mode:'present',statement:0,evidence:null},{mode:'present',statement:0,evidence:''},
 {mode:'present',statement:0,evidence:'missing-document'},
 {mode:'present',statement:0,evidence:'x'.repeat(200)},
 {mode:'yield',statement:1,evidence:null},{mode:'yield',statement:0,evidence:'subscription'},
 {mode:'press',statement:0,evidence:null,score:99},
 {mode:'press',statement:0,evidence:null,correct:true},
 {mode:'press',statement:0,evidence:null,result:'won'},
 {mode:'press',statement:0,evidence:null,credibility:999},
];

// The actual Worker and stores run only against in-memory SQLite. These test
// participants never register on production or alter its public statistics.
function harness(t){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());db.exec('PRAGMA foreign_keys = ON');
 const sql={exec(query,...args){let rows=[];if(!args.length&&query.includes(';'))db.exec(query);else{const stmt=db.prepare(query);if(stmt.columns().length)rows=stmt.all(...args);else stmt.run(...args);}return{toArray:()=>rows,one:()=>{assert.equal(rows.length,1);return rows[0];}};}};
 const storage={sql,transactionSync(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}},async getAlarm(){return null;},async setAlarm(){}};
 const source=readFileSync(new URL('../worker/index.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export class HedoArchive','globalThis.HedoArchive=class HedoArchive').replace('export default','globalThis.worker=');
 const context=vm.createContext({DurableObject:class{constructor(ctx){this.ctx=ctx;}},replayRun:E.replayRun,VERSION:E.VERSION,MAX_TURNS:E.MAX_TURNS,ROLE_MAP,ENDINGS,...http,validateFeedback,validatePublisherToken,FeedbackStore,AchievementStore,CharacterStore,ObservationStore,crypto,Response,Request,URL,Date});
 vm.runInContext(source,context);const archive=new context.HedoArchive({storage,blockConcurrencyWhile:fn=>fn()},{});
 const call=async(path,{method='GET',token,body}={})=>{archive.rate=new http.RateGuard();const headers={};if(token)headers.Authorization=`Bearer ${token}`;if(body)headers['Content-Type']='application/json';const response=await archive.fetch(new Request(`https://game.example${path}`,{method,headers,body:body?JSON.stringify(body):undefined}));return{status:response.status,body:await response.json()};};
 const register=async()=>{const token=randomBytes(32).toString('hex');assert.equal((await call('/api/player',{method:'POST',body:{token}})).status,200);return token;};
 return{sql,call,register};
}

test('HTTP accepts exact current-cohort shareholder controls and rejects supplied answers, results and extra fields',()=>{
 const route=row('hearing'),run=E.replayRun(route.roleId,route.seed,route.actions),valid=action(run);
 const inputs=[valid.input,{mode:'yield',statement:0,evidence:null},...E.getShareholderPlayV58(run).evidence.map(file=>({mode:'present',statement:2,evidence:file.id}))];
 for(const input of inputs)assert.doesNotThrow(()=>http.validateCompletion(proof(route,randomUUID(),[{...valid,input}]),ROLE_MAP));
 for(const input of invalidInputs())assert.throws(()=>http.validateCompletion(proof(route,randomUUID(),[{...valid,input}]),ROLE_MAP),error=>error instanceof http.ApiError&&error.code==='invalid_actions');
 for(const patch of [{version:2},{version:'1'},{eventId:''},{eventId:'x'.repeat(101)},{index:0},{round:0},{score:99},{result:'won'}])assert.throws(()=>http.validateCompletion(proof(route,randomUUID(),[{...valid,...patch}]),ROLE_MAP));
 for(const key of ['version','eventId','input']){const bad={...valid};delete bad[key];assert.throws(()=>http.validateCompletion(proof(route,randomUUID(),[bad]),ROLE_MAP));}
 for(const seed of ['e39-cal46-kin49-g-e-s-m-00000000','e39-cal46-kin49-g-e-s-0123456789','e39-old','e38-old','e40-future'])assert.throws(()=>http.validateCompletion({...proof(route,randomUUID(),[valid]),seed},ROLE_MAP));
});

test('Worker replays paid ownership, firm admission and cross-examination while ignoring supplied client stock or verdicts',async t=>{
 const h=harness(t);
 for(const id of ['offer','stock-paid','gate','hearing','round-1','round-2','round-3','finish-prepared','returned-prepared']){
  const token=await h.register(),route=row(id),run=E.replayRun(route.roleId,route.seed,route.actions);
  // Each witness may use a distinct natural prefix; immutable proof ownership
  // is tested below on a single route, not fabricated by combining runs.
  const result=await h.call('/api/characters',{method:'POST',token,body:{...proof(route),flags:{shareholder58_owned:999},stats:{cash:100},shareholderContext:{stage:'finish',credibility:99},shareholderOutcome:{result:'won'},characters:[{id:'wing',realHits:9999}]}});
  assert.equal(result.status,200,id);assert.equal(result.body.verified,true,id);assert.equal(result.body.totalRuns,0,id);assert.deepEqual(result.body.characters,deriveCharacterStats(run),id);
 }
 const token=await h.register(),route=row('returned-prepared'),id=randomUUID(),canonical=E.replayRun(route.roleId,route.seed,route.actions);
 const once=await h.call('/api/characters',{method:'POST',token,body:proof(route,id)});assert.equal(once.status,200);
 const twice=await h.call('/api/characters',{method:'POST',token,body:proof(route,id)});assert.equal(twice.status,200);assert.deepEqual(twice.body.characters,deriveCharacterStats(canonical));
 const stranger=await h.register();assert.equal((await h.call('/api/characters',{method:'POST',token:stranger,body:proof(route,id)})).status,409);
 const stats=await h.call('/api/stats');assert.equal(stats.body.totalRuns,0);assert.doesNotMatch(JSON.stringify(stats.body),/shareholderContext|shareholder58_owned|seed|actions|history|playerId|runId/);
});

test('Worker refuses invented ownership, skipped setup, stale rounds, repeated press and divergent commitments',async t=>{
 const h=harness(t),token=await h.register(),route=row('hearing'),source=E.replayRun(route.roleId,route.seed,route.actions),valid=action(source);
 const pressed=E.advance(E.applyShareholderPlay(source,valid.input));
 const attacks=[
  {actions:[{type:'activity-schedule',version:1},valid],label:'no paid stock or gate'},
  {actions:[...row('offer').actions,valid],label:'offering is not ownership'},
  {actions:[...row('stock-paid').actions,valid],label:'ownership is not admission'},
  {actions:[...source.actions,{...valid,eventId:'shareholder58-hearing-3'}],label:'skip a round'},
  {actions:[...pressed.actions,valid],label:'press the same statement twice'},
  {actions:[...row('returned-prepared').actions,valid],label:'stale closed hearing'},
  {actions:[...source.actions,{type:'choice',eventId:source.eventId,index:0}],label:'ordinary choice bypass'},
 ];
 for(const attack of attacks){const response=await h.call('/api/characters',{method:'POST',token,body:{...proof(route,randomUUID(),attack.actions),flags:{shareholder58_owned:50},shareholderContext:{stage:'hearing',round:0}}});assert.equal(response.status,400,attack.label);assert.equal(response.body.error,'invalid_replay',attack.label);}
 const runId=randomUUID();assert.equal((await h.call('/api/characters',{method:'POST',token,body:proof(route,runId,pressed.actions)})).status,200);
 const changed=[...source.actions,{...valid,input:{mode:'press',statement:1,evidence:null}}];
 const fork=await h.call('/api/characters',{method:'POST',token,body:proof(route,runId,changed)});assert.equal(fork.status,409);
 const supplied=await h.call('/api/characters',{method:'POST',token,body:proof(route,randomUUID(),[...source.actions,{...valid,input:{...valid.input,credibility:99}}])});assert.equal(supplied.status,400);assert.equal(supplied.body.error,'invalid_actions');
 const incomplete=await h.call('/api/complete',{method:'POST',token,body:{...proof(route,randomUUID()),completed:true,endingId:'nasdaq-system',shareholder58_result:'won'}});assert.equal(incomplete.status,400);assert.equal(incomplete.body.error,'incomplete_run');
 assert.equal((await h.call('/api/stats')).body.totalRuns,0);
});

test('a shareholder meeting remains unfinished until the player separately leaves, then completion and achievement sync deduplicate normally',async t=>{
 const h=harness(t),token=await h.register(),id=randomUUID(),returned=row('returned-prepared'),finished=row('completed-prepared');
 const run=E.replayRun(finished.roleId,finished.seed,finished.actions);assert.equal(run.completed,true);assert.equal(run.flags.shareholder58_result,'minutes');
 const partial=await h.call('/api/characters',{method:'POST',token,body:proof(returned,id)});assert.equal(partial.status,200);assert.equal(partial.body.totalRuns,0);
 const premature=await h.call('/api/complete',{method:'POST',token,body:proof(returned,id)});assert.equal(premature.status,400);assert.equal(premature.body.error,'incomplete_run');
 const complete=await h.call('/api/complete',{method:'POST',token,body:{...proof(finished,id),endingId:'nasdaq-system',salary:999,turn:24,shareholder58_result:'imaginary-win'}});
 assert.equal(complete.status,200);assert.equal(complete.body.endingId,run.endingId);assert.equal(complete.body.totalRuns,1);assert.deepEqual(complete.body.characters,deriveCharacterStats(run));
 const duplicate=await h.call('/api/complete',{method:'POST',token,body:proof(finished,id)});assert.equal(duplicate.status,200);assert.equal(duplicate.body.duplicate,true);assert.equal(duplicate.body.totalRuns,1);
 const delayed=await h.call('/api/characters',{method:'POST',token,body:proof(returned,id)});assert.equal(delayed.status,200);assert.deepEqual(delayed.body.characters,complete.body.characters);
 const saved=h.sql.exec('SELECT ending_id,salary,turns FROM runs WHERE id = ?',id).one();assert.equal(saved.ending_id,run.endingId);assert.equal(saved.salary,run.pay);assert.equal(saved.turns,Math.min(run.turn+1,E.MAX_TURNS));assert.equal((await h.call('/api/stats')).body.totalRuns,1);
});
