import {ObservationStore} from '../worker/observations.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {CharacterStore} from '../worker/characters.js';
import {AchievementStore} from '../worker/achievements.js';
import {FeedbackStore} from '../worker/feedback-store.js';
import {validateFeedback,validatePublisherToken} from '../worker/feedback.js';
import * as http from '../worker/http.js';
import {replayRun,createRun,getEvent,applyChoice,advance,VERSION,MAX_TURNS} from '../dist/engine.js';
import {ROLE_MAP} from '../dist/roles.js';
import {ENDINGS} from '../dist/endings.js';
import {CHARACTER_IDS,CHARACTER_METRICS,deriveCharacterStats} from '../dist/character-stats.js';

const source=readFileSync(new URL('../worker/index.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export class HedoArchive','globalThis.HedoArchive=class HedoArchive').replace('export default','globalThis.worker=');
const now='2026-10-21T00:00:00.000Z';
const conflict=error=>error.status===409;
function harness(){
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys = ON');
 const sql={exec(query,...args){let rows=[];if(!args.length&&query.includes(';'))db.exec(query);else{const statement=db.prepare(query);if(statement.columns().length)rows=statement.all(...args);else statement.run(...args);}return{toArray:()=>rows,one:()=>{assert.equal(rows.length,1);return rows[0];}};}};
 const storage={sql,transactionSync(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}},async getAlarm(){return null;},async setAlarm(){}};
 const ctx={storage,blockConcurrencyWhile:fn=>fn()};
 const scope=vm.createContext({DurableObject:class{constructor(context){this.ctx=context;}},replayRun,VERSION,MAX_TURNS,ROLE_MAP,ENDINGS,...http,validateFeedback,validatePublisherToken,FeedbackStore,AchievementStore,CharacterStore,ObservationStore,crypto,Response,Request,URL,Date});
 vm.runInContext(source,scope);const archive=new scope.HedoArchive(ctx,{});
 sql.exec('INSERT INTO players (id,token_hash,created_at) VALUES (?,?,?)','owner','owner-hash',now);
 sql.exec('INSERT INTO players (id,token_hash,created_at) VALUES (?,?,?)','other','other-hash',now);
 const store=new CharacterStore(sql,storage,now);
 const call=async(path,{method='GET',token,body}={})=>{
  archive.rate=new http.RateGuard();const headers={};if(token)headers.Authorization=`Bearer ${token}`;if(body)headers['Content-Type']='application/json';
  const response=await archive.fetch(new Request(`https://game.example${path}`,{method,headers,body:body?JSON.stringify(body):undefined}));return{status:response.status,body:await response.json()};
 };
 const register=async(token='a'.repeat(64))=>{const response=await call('/api/player',{method:'POST',body:{token}});assert.equal(response.status,200);return{token,id:response.body.playerId};};
 return{db,sql,storage,store,archive,call,register,reopen:()=>new CharacterStore(sql,storage,'2030-01-01T00:00:00.000Z')};
}
const entered=(seed='e20-character-prefix')=>advance(applyChoice(createRun('system',seed),0));
const next=run=>{const index=getEvent(run).choices.findIndex(choice=>choice.available!==false&&choice.effect!=='ragequit');return advance(applyChoice(run,index));};
const proof=(run,id=randomUUID())=>({runId:id,roleId:run.roleId,seed:run.seed,actions:run.actions});
const cleanRows=rows=>rows.map(row=>({...row}));
const addRows=(...sets)=>CHARACTER_IDS.map(id=>({id,...Object.fromEntries(CHARACTER_METRICS.map(metric=>[metric,sets.reduce((sum,rows)=>sum+(rows.find(row=>row.id===id)?.[metric]||0),0)]))}));
const coldRoute=()=>JSON.parse(readFileSync(new URL('./fixtures/personnel-routes-v20.json',import.meta.url))).routes.find(route=>route.id==='ending-cold_storage-system');

test('unfinished canonical prefixes count once, extend by their delta, and never create completed games',async()=>{
 const h=harness(),first=entered(),later=next(first),id=randomUUID();
 assert.equal((await h.store.record('owner',id,first,now)).recorded,true);
 assert.deepEqual(cleanRows(h.store.snapshot('owner')),deriveCharacterStats(first));
 assert.equal((await h.store.record('owner',id,first)).duplicate,true);
 assert.equal((await h.store.record('owner',id,later)).recorded,true);
 assert.deepEqual(cleanRows(h.store.snapshot('owner')),deriveCharacterStats(later));
 assert.deepEqual(cleanRows(h.store.global().characters),deriveCharacterStats(later));
 assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM runs').one().n,0);
 assert.equal(h.store.snapshot('other').every(row=>CHARACTER_METRICS.every(key=>row[key]===0)),true);
 h.db.close();
});

test('same-step forks and longer forked proofs are rejected instead of maximizing counters',async()=>{
 const h=harness(),first=entered(),later=next(first),id=randomUUID();
 const fork=advance(applyChoice(createRun('system',first.seed),1)),longFork=next(fork);
 await h.store.record('owner',id,first);const before=h.store.global();
 await assert.rejects(h.store.record('owner',id,fork),conflict);
 await assert.rejects(h.store.record('owner',id,longFork),conflict);
 assert.deepEqual(h.store.global(),before);
 await h.store.record('owner',id,later);
 await h.store.record('owner',randomUUID(),longFork);
 assert.deepEqual(cleanRows(h.store.snapshot('owner')),addRows(deriveCharacterStats(later),deriveCharacterStats(longFork)));
 h.db.close();
});

test('out-of-order and concurrent duplicate prefixes cannot decrease or double the aggregate',async()=>{
 const h=harness(),first=entered(),later=next(first),id=randomUUID();
 await Promise.all([later,first,later,later,first].map(run=>h.reopen().record('owner',id,run)));
 const before=h.store.global();assert.deepEqual(cleanRows(before.characters),deriveCharacterStats(later));
 const old=await h.store.record('owner',id,first);assert.equal(old.outdated,true);assert.equal(old.recorded,false);
 assert.deepEqual(h.store.global(),before);assert.equal(h.store.progress(id).action_count,later.actions.length);
 h.db.close();
});

test('run IDs bind owner, role and seed across character and achievement endpoints',async()=>{
 const h=harness(),run=entered(),id=randomUUID();await h.store.record('owner',id,run);
 await assert.rejects(h.store.record('other',id,run),conflict);
 await assert.rejects(h.store.record('owner',id,{...run,roleId:'sales'}),conflict);
 await assert.rejects(h.store.record('owner',id,entered('e20-different-seed')),conflict);
 assert.equal(h.sql.exec('SELECT player_id FROM achievement_runs WHERE id = ?',id).one().player_id,'owner');
 const achievementId=randomUUID();await h.archive.achievements.record('other',achievementId,run);
 await assert.rejects(h.store.record('owner',achievementId,run),conflict);
 const seedId=randomUUID();await h.archive.achievements.record('owner',seedId,entered('e20-seed-already-bound'));
 await assert.rejects(h.store.record('owner',seedId,run),conflict);
 h.db.close();
});

test('completed proofs cannot be replaced with another ending or extended after completion',async()=>{
 const h=harness(),route=coldRoute(),run=replayRun(route.roleId,route.seed,route.actions),id=randomUUID();
 const alternative=advance(applyChoice(createRun(run.roleId,run.seed),2));assert.notEqual(alternative.endingId,run.endingId);
 await h.store.record('owner',id,run);const before=h.store.global();
 await assert.rejects(h.store.record('owner',id,alternative),conflict);
 await assert.rejects(h.store.record('owner',id,{...run,actions:[...run.actions,{type:'exit'}]}),conflict);
 assert.deepEqual(h.store.global(),before);
 h.sql.exec('INSERT INTO runs (id,player_id,ending_id,role_id,actual_role_id,rank,salary,turns,game_version,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',id,'owner',run.endingId,run.roleId,run.actualRoleId,run.rank,run.pay,run.turn,VERSION,now);
 await assert.rejects(h.store.record('other',id,run),conflict);
 await assert.rejects(h.store.record('owner',id,alternative),conflict);
 assert.equal((await h.store.record('owner',id,run)).duplicate,true);
 assert.equal((await h.store.record('owner',id,replayRun(run.roleId,run.seed,run.actions.slice(0,1)))).outdated,true);
 h.db.close();
});

test('restarts preserve totals and tracking date while storage retains no seed or transcript',async()=>{
 const h=harness(),run=next(entered('e20-private-raw-seed')),id=randomUUID();await h.store.record('owner',id,run);
 const before=h.store.global(),reopened=h.reopen();assert.deepEqual(reopened.global(),before);
 assert.equal((await reopened.record('owner',id,run)).duplicate,true);
 const tables=['character_runs','character_run_totals','player_characters','global_characters','character_meta'];
 const saved=Object.fromEntries(tables.map(name=>[name,h.sql.exec(`SELECT * FROM ${name}`).toArray()]));
 assert.ok(!JSON.stringify(saved).includes(run.seed));assert.ok(!JSON.stringify(saved).includes('onboarding'));
 const columns=h.sql.exec('PRAGMA table_info(character_runs)').toArray().map(row=>row.name);
 assert.ok(columns.includes('seed_hash'));assert.ok(columns.includes('action_hash'));assert.ok(columns.includes('action_count'));
 assert.ok(!columns.includes('actions'));assert.ok(!columns.includes('seed'));assert.ok(!columns.includes('history'));
 assert.match(before.trackingSince,/^\d{4}-\d{2}-\d{2}T/);
 h.db.close();
});

test('existing eleven-person character tables extend additively without losing totals or changing the tracking date',async()=>{
 const h=harness(),legacyIds=CHARACTER_IDS.slice(0,11),newIds=['sophie','jonathan','owen','sam','cindy'];
 const trackingSince=h.store.global().trackingSince;
 const legacy=legacyIds.map((id,index)=>({id,...Object.fromEntries(CHARACTER_METRICS.map(key=>[key,index+1]))}));
 const columns=CHARACTER_METRICS.join(','),placeholders=CHARACTER_METRICS.map(()=>'?').join(',');
 for(const row of legacy){
  const values=CHARACTER_METRICS.map(key=>row[key]);
  h.sql.exec(`INSERT INTO player_characters (player_id,character_id,${columns}) VALUES (?,?,${placeholders})`,'owner',row.id,...values);
  h.sql.exec(`INSERT INTO global_characters (character_id,${columns}) VALUES (?,${placeholders})`,row.id,...values);
 }
 const reopened=h.reopen(),personal=cleanRows(reopened.snapshot('owner')),publicBefore=reopened.global();
 assert.deepEqual(personal.slice(0,11),legacy);assert.deepEqual(cleanRows(publicBefore.characters).slice(0,11),legacy);
 for(const id of newIds){
  const expected={id,...Object.fromEntries(CHARACTER_METRICS.map(key=>[key,0]))};
  assert.deepEqual(personal.find(row=>row.id===id),expected);
  assert.deepEqual({...publicBefore.characters.find(row=>row.id===id)},expected);
 }
 assert.equal(publicBefore.trackingSince,trackingSince);
 assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM player_characters').one().n,11,'reading new zero counters does not rewrite old database rows');
 const run=entered('e22-old-table-extension');await reopened.record('owner',randomUUID(),run);
 assert.deepEqual(cleanRows(reopened.snapshot('owner')),addRows(legacy,deriveCharacterStats(run)));
 assert.deepEqual(cleanRows(reopened.global().characters),addRows(legacy,deriveCharacterStats(run)));
 assert.equal(reopened.global().trackingSince,trackingSince);assert.equal(reopened.snapshot('other').length,16);
 assert.ok(reopened.snapshot('other').every(row=>CHARACTER_METRICS.every(key=>row[key]===0)));
 h.db.close();
});

test('HTTP progress ignores client stats and keeps anonymous players isolated',async()=>{
 const h=harness(),a=await h.register(),b=await h.register('b'.repeat(64)),run=entered(),payload=proof(run);
 const response=await h.call('/api/characters',{method:'POST',token:a.token,body:{...payload,characters:[{id:'wing',realHits:9999}],stats:{realHits:9999},history:[{speaker:'wing'}]}});
 assert.equal(response.status,200);assert.equal(response.body.verified,true);assert.equal(response.body.totalRuns,0);
 assert.deepEqual(response.body.characters,deriveCharacterStats(run));
 const other=await h.call('/api/me',{token:b.token});assert.equal(other.body.characters.length,16);assert.ok(other.body.characters.every(row=>CHARACTER_METRICS.every(key=>row[key]===0)));
 assert.equal((await h.call('/api/characters',{method:'POST',token:b.token,body:payload})).status,409);
 const publicStats=await h.call('/api/characters');assert.equal(publicStats.status,200);assert.deepEqual(Object.keys(publicStats.body).sort(),['characters','trackingSince','version']);
 assert.equal(publicStats.body.version,1);assert.deepEqual(publicStats.body.characters,deriveCharacterStats(run));
 const serialized=JSON.stringify(publicStats.body);for(const secret of [a.id,b.id,a.token,b.token,run.seed,payload.runId,'actions','player_id','seed_hash'])assert.ok(!serialized.includes(secret));
 assert.equal((await h.call('/api/characters',{method:'POST',body:payload})).status,401);
 h.db.close();
});

test('achievement progress and completion update the same counters without double counting',async()=>{
 const h=harness(),player=await h.register(),route=coldRoute(),full=replayRun(route.roleId,route.seed,route.actions),partial=replayRun(route.roleId,route.seed,route.actions.slice(0,3)),id=randomUUID();
 const first=await h.call('/api/achievements',{method:'POST',token:player.token,body:proof(partial,id)});assert.equal(first.status,200);assert.equal(first.body.totalRuns,0);assert.deepEqual(first.body.characters,deriveCharacterStats(partial));
 const completed=await h.call('/api/complete',{method:'POST',token:player.token,body:proof(full,id)});assert.equal(completed.status,200);assert.equal(completed.body.totalRuns,1);assert.equal(completed.body.duplicate,false);assert.deepEqual(completed.body.characters,deriveCharacterStats(full));
 const duplicate=await h.call('/api/complete',{method:'POST',token:player.token,body:proof(full,id)});assert.equal(duplicate.status,200);assert.equal(duplicate.body.totalRuns,1);assert.equal(duplicate.body.duplicate,true);assert.deepEqual(duplicate.body.characters,completed.body.characters);
 const older=await h.call('/api/characters',{method:'POST',token:player.token,body:proof(partial,id)});assert.equal(older.status,200);assert.deepEqual(older.body.characters,completed.body.characters);
 const invalidRetry=await h.call('/api/complete',{method:'POST',token:player.token,body:{...proof(full,id),actions:[{type:'choice',eventId:'future-engine-scene',index:0}]}});assert.equal(invalidRetry.status,200);assert.equal(invalidRetry.body.duplicate,true);assert.deepEqual(invalidRetry.body.characters,completed.body.characters);
 const alternate=advance(applyChoice(createRun(full.roleId,full.seed),2));assert.equal((await h.call('/api/complete',{method:'POST',token:player.token,body:proof(alternate,id)})).status,409);
 h.db.close();
});

test('historical completed games keep their receipt and badges but cannot invent historical character counters',async()=>{
 const h=harness(),player=await h.register(),route=coldRoute(),run=replayRun(route.roleId,route.seed,route.actions),id=randomUUID();
 await h.archive.achievements.record(player.id,id,run);
 h.sql.exec('INSERT INTO runs (id,player_id,ending_id,role_id,actual_role_id,rank,salary,turns,game_version,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',id,player.id,run.endingId,run.roleId,run.actualRoleId,run.rank,run.pay,run.turn,VERSION,now);
 assert.equal((await h.call('/api/characters',{method:'POST',token:player.token,body:proof(run,id)})).status,409);
 const achievement=await h.call('/api/achievements',{method:'POST',token:player.token,body:proof(run,id)});assert.equal(achievement.status,200);assert.ok(achievement.body.achievements.length>0);assert.ok(achievement.body.characters.every(row=>CHARACTER_METRICS.every(key=>row[key]===0)));
 const receipt=await h.call('/api/complete',{method:'POST',token:player.token,body:proof(run,id)});assert.equal(receipt.status,200);assert.equal(receipt.body.totalRuns,1);assert.equal(receipt.body.duplicate,true);assert.equal(h.store.progress(id),null);
 const alternate=advance(applyChoice(createRun(run.roleId,run.seed),2));assert.notEqual(alternate.endingId,run.endingId);
 assert.equal((await h.call('/api/complete',{method:'POST',token:player.token,body:proof(alternate,id)})).status,409);
 const invalidRetry=await h.call('/api/complete',{method:'POST',token:player.token,body:{...proof(run,id),actions:[{type:'choice',eventId:'future-legacy-scene',index:0}]}});
 assert.equal(invalidRetry.status,200);assert.equal(invalidRetry.body.duplicate,true);assert.equal(invalidRetry.body.totalRuns,1);assert.equal(h.store.progress(id),null);
 assert.equal((await h.call('/api/complete',{method:'POST',token:player.token,body:{...proof(run,id),seed:'e20-wrong-history'}})).status,409);
 assert.equal((await h.call('/api/achievements',{method:'POST',token:player.token,body:{...proof(alternate,id),seed:'e20-wrong-history'}})).status,409);
 h.db.close();
});
