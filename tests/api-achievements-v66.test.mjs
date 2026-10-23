import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomBytes,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import vm from 'node:vm';
import * as E from '../dist/engine.js';
import {ROLE_MAP} from '../dist/roles.js';
import {ENDINGS} from '../dist/endings.js';
import {deriveAchievements,ACHIEVEMENTS} from '../dist/achievements.js';
import {ACHIEVEMENT_RULES_V66} from '../dist/achievements-v66.js';
import {deriveCharacterStats} from '../dist/character-stats.js';
import {AchievementStore} from '../worker/achievements.js';
import {CharacterStore} from '../worker/characters.js';
import {ObservationStore} from '../worker/observations.js';
import {FeedbackStore} from '../worker/feedback-store.js';
import {validateFeedback,validatePublisherToken} from '../worker/feedback.js';
import * as http from '../worker/http.js';

const workerSource=readFileSync(new URL('../worker/index.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export class HedoArchive','globalThis.HedoArchive=class HedoArchive').replace('export default','globalThis.worker=');
const fixture=JSON.parse(readFileSync(new URL('./fixtures/achievement-milestones-v66.json',import.meta.url),'utf8'));
const named=id=>{const row=fixture.routes.find(row=>row.id===id);assert.ok(row,id);return row;};
const proof=(row,runId=randomUUID(),actions=row.actions)=>({runId,roleId:row.roleId,seed:row.seed,actions});
function harness(t){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());db.exec('PRAGMA foreign_keys = ON');
 const sql={exec(query,...args){let rows=[];if(!args.length&&query.includes(';'))db.exec(query);else{const statement=db.prepare(query);if(statement.columns().length)rows=statement.all(...args);else statement.run(...args);}return{toArray:()=>rows,one:()=>{assert.equal(rows.length,1);return rows[0];}};}};
 const storage={sql,transactionSync(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}},async getAlarm(){return null;},async setAlarm(){}};
 const context=vm.createContext({DurableObject:class{constructor(ctx){this.ctx=ctx;}},replayRun:E.replayRun,VERSION:E.VERSION,MAX_TURNS:E.MAX_TURNS,ROLE_MAP,ENDINGS,...http,validateFeedback,validatePublisherToken,FeedbackStore,AchievementStore,CharacterStore,ObservationStore,crypto,Response,Request,URL,Date});
 vm.runInContext(workerSource,context);const archive=new context.HedoArchive({storage,blockConcurrencyWhile:fn=>fn()},{});
 const call=async(path,{method='GET',token,body}={})=>{archive.rate=new http.RateGuard();const headers={};if(token)headers.Authorization=`Bearer ${token}`;if(body)headers['Content-Type']='application/json';const response=await archive.fetch(new Request(`https://game.example${path}`,{method,headers,body:body?JSON.stringify(body):undefined}));return{status:response.status,body:await response.json()};};
 const register=async()=>{const token=randomBytes(32).toString('hex');assert.equal((await call('/api/player',{method:'POST',body:{token}})).status,200);return token;};return{sql,call,register};
}

test('Worker replays each new achievement kind and refuses client-supplied unlocks, including a salary regression',async t=>{
 const h=harness(t),used=new Set();
 for(const kind of ['character','profession','social','activity','advanced']){
  const row=fixture.routes.find(row=>!used.has(row.id)&&row.expected.some(id=>ACHIEVEMENT_RULES_V66.find(s=>s.id===id)?.kind===kind));assert.ok(row,kind);used.add(row.id);
  const token=await h.register(),run=E.replayRun(row.roleId,row.seed,row.actions),runId=randomUUID(),body={...proof(row,runId),achievements:ACHIEVEMENTS.map(a=>a.id),flags:{rage_real:999,promotions:999},history:[{eventId:'onboarding',choiceIndex:0}],stats:{cash:999,skill:999}};
  const response=await h.call('/api/achievements',{method:'POST',token,body});assert.equal(response.status,200,kind);assert.deepEqual(response.body.achievements.map(a=>a.id).sort(),deriveAchievements(run).sort());assert.ok(response.body.achievements.length<1000);
  const repeat=await h.call('/api/achievements',{method:'POST',token,body:proof(row,runId)});assert.equal(repeat.status,200);assert.deepEqual(repeat.body.achievements,response.body.achievements);assert.equal(repeat.body.totalRuns,0);
  const other=await h.register();assert.equal((await h.call('/api/achievements',{method:'POST',token:other,body:proof(row,runId)})).status,409);
 }
 const salary=JSON.parse(readFileSync(new URL('./fixtures/event-departure-v63.json',import.meta.url),'utf8')).routes.find(row=>row.id==='salary'),token=await h.register();assert.ok(salary);assert.equal((await h.call('/api/achievements',{method:'POST',token,body:proof(salary)})).status,200,'a pay-change history must not throw and become unavailable');
 assert.equal((await h.call('/api/stats')).body.totalRuns,0);
});

test('the authenticated collection returns all 1000 retained records without a historical 250-item truncation',async t=>{
 const h=harness(t),token=await h.register(),me=await h.call('/api/me',{token}),time='2026-10-23T01:02:03.000Z';assert.equal(me.status,200);
 // Schema/read-path coverage: these stand in for already-validated records
 // from many lives. A submitted client list cannot perform this operation.
 for(const card of ACHIEVEMENTS)h.sql.exec('INSERT INTO player_achievements (player_id, achievement_id, first_seen_at) VALUES (?, ?, ?)',me.body.playerId,card.id,time);
 const snapshot=await h.call('/api/me',{token});assert.equal(snapshot.status,200);assert.equal(snapshot.body.achievements.length,1000);assert.deepEqual(snapshot.body.achievements.map(x=>x.id).sort(),ACHIEVEMENTS.map(x=>x.id).sort());assert.ok(snapshot.body.achievements.every(row=>row.unlockedAt===time));
 const other=await h.register();assert.deepEqual((await h.call('/api/me',{token:other})).body.achievements,[]);
 assert.doesNotMatch(JSON.stringify(snapshot.body),/"(?:actions|history|seed|flags|stats|description|title|image)":/);
});

test('tampered source indices, actions and unsafe extra fields cannot claim a fabricated new story badge',async t=>{
 const h=harness(t),token=await h.register(),source=fixture.sources.find(row=>/^e39-/.test(row.seed)),run=E.replayRun(source.roleId,source.seed,source.actions),action={type:'choice',eventId:source.eventId,index:0};assert.equal(E.getEvent(run).id,source.eventId);
 for(const invalid of [{...action,index:-1},{...action,index:999},{...action,eventId:'nonexistent-story'}]){
  const result=await h.call('/api/achievements',{method:'POST',token,body:proof(source,randomUUID(),[...source.actions,invalid])});assert.equal(result.status,400);assert.match(result.body.error,/invalid_(?:actions|replay)/);
 }
 assert.deepEqual((await h.call('/api/me',{token})).body.achievements,[]);
 const sanitized=await h.call('/api/achievements',{method:'POST',token,body:proof(source,randomUUID(),[...source.actions,{...action,achievement:'tale-wing-a-first'}])});assert.equal(sanitized.status,200);assert.deepEqual(sanitized.body.achievements.map(a=>a.id).sort(),deriveAchievements(E.advance(E.applyChoice(run,0))).sort());
});
