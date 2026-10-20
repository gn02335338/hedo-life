import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { AchievementStore } from '../worker/achievements.js';
import { CharacterStore } from '../worker/characters.js';
import { FeedbackStore } from '../worker/feedback-store.js';
import { validateFeedback, validatePublisherToken } from '../worker/feedback.js';
import * as http from '../worker/http.js';
import { applyChoice, advance, getEvent, requestRage, canRequestRage, replayRun, VERSION, MAX_TURNS } from '../dist/engine.js';
import { ROLE_MAP } from '../dist/roles.js';
import { ENDINGS } from '../dist/endings.js';
import { EVENTS } from '../dist/events.js';
import {QUIZ_GROUPS} from './quiz-v26-groups.js';
import { CHARACTER_IDS, CHARACTER_METRICS, deriveCharacterStats } from '../dist/character-stats.js';

const source = readFileSync(new URL('../worker/index.js', import.meta.url), 'utf8')
  .replace(/^import .*;\n/gm, '')
  .replace('export class HedoArchive', 'globalThis.HedoArchive=class HedoArchive')
  .replace('export default', 'globalThis.worker=');
const { routes } = JSON.parse(readFileSync(new URL('./fixtures/quiz-routes-v26.json', import.meta.url), 'utf8'));
const proof = (fixture, runId) => ({ runId, roleId: fixture.roleId, seed: fixture.seed, actions: fixture.actions });

function harness(t) {
  const db = new DatabaseSync(':memory:'); t.after(() => db.close()); db.exec('PRAGMA foreign_keys = ON');
  const sql = { exec(query, ...args) {
    let rows = [];
    if (!args.length && query.includes(';')) db.exec(query);
    else { const statement = db.prepare(query); if (statement.columns().length) rows = statement.all(...args); else statement.run(...args); }
    return { toArray: () => rows, one: () => { assert.equal(rows.length, 1); return rows[0]; } };
  } };
  const storage = { sql, transactionSync(fn) {
    db.exec('BEGIN IMMEDIATE'); try { const result = fn(); db.exec('COMMIT'); return result; } catch (error) { db.exec('ROLLBACK'); throw error; }
  }, async getAlarm() { return null; }, async setAlarm() {} };
  const scope = vm.createContext({
    DurableObject: class { constructor(context) { this.ctx = context; } }, replayRun, VERSION, MAX_TURNS, ROLE_MAP, ENDINGS,
    ...http, validateFeedback, validatePublisherToken, FeedbackStore, AchievementStore, CharacterStore, crypto, Response, Request, URL, Date,
  });
  vm.runInContext(source, scope);
  const archive = new scope.HedoArchive({ storage, blockConcurrencyWhile: fn => fn() }, {});
  const call = async (path, { method = 'GET', token, body } = {}) => {
    archive.rate = new http.RateGuard(); const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body) headers['Content-Type'] = 'application/json';
    const response = await archive.fetch(new Request(`https://game.example${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }));
    return { status: response.status, body: await response.json() };
  };
  const register = async () => {
    const token = randomBytes(32).toString('hex'), result = await call('/api/player', { method: 'POST', body: { token } });
    assert.equal(result.status, 200); return { token, id: result.body.playerId };
  };
  return { sql, call, register };
}

test('each new quiz scene replays through anonymous progress and completion without trusting supplied numbers or counting retries twice',async t=>{
 const h=harness(t),scenes=routes.filter(route=>route.index===0&&!route.id.startsWith('role-'));
 assert.equal(scenes.length,EVENTS.filter(event=>event.minRules===26).length);assert.ok(scenes.length>0);
 const expected=Object.fromEntries(CHARACTER_IDS.map(id=>[id,Object.fromEntries(CHARACTER_METRICS.map(key=>[key,0]))]));
 const publicBefore=await h.call('/api/characters');
 for(const route of scenes){
  const player=await h.register(),runId=randomUUID(),prefix={...route,actions:route.actions.slice(0,-1)},before=replayRun(prefix.roleId,prefix.seed,prefix.actions);
  const first=await h.call('/api/characters',{method:'POST',token:player.token,body:proof(prefix,runId)});
  assert.equal(first.status,200,route.id);assert.deepEqual(first.body.characters,deriveCharacterStats(before));
  const run=replayRun(route.roleId,route.seed,route.actions);
  const earned=await h.call('/api/characters',{method:'POST',token:player.token,body:{
   ...proof(route,runId),stats:{mood:100,boss:100},rank:7,pay:500,
   characters:CHARACTER_IDS.map(id=>({id,realHits:9999,encounters:9999})),
   history:[{eventId:route.eventId,speaker:'wing',result:'invented'}],
  }});
  assert.equal(earned.status,200,route.id);assert.equal(earned.body.verified,true);assert.equal(earned.body.totalRuns,0);
  assert.deepEqual(earned.body.characters,deriveCharacterStats(run));
  for(const endpoint of ['/api/characters','/api/achievements']){
   const retry=await h.call(endpoint,{method:'POST',token:player.token,body:proof(route,runId)});
   assert.equal(retry.status,200,route.id);assert.deepEqual(retry.body.characters,earned.body.characters);
  }
  const full={...route,actions:route.completionActions},ended=replayRun(full.roleId,full.seed,full.actions);
  assert.equal(ended.completed,true);
  const receipt=await h.call('/api/complete',{method:'POST',token:player.token,body:proof(full,runId)});
  assert.equal(receipt.status,200,route.id);assert.equal(receipt.body.recorded,true);assert.equal(receipt.body.duplicate,false);
  assert.equal(receipt.body.endingId,ended.endingId);assert.equal(receipt.body.totalRuns,1);
  assert.deepEqual(receipt.body.characters,deriveCharacterStats(ended));
  const duplicate=await h.call('/api/complete',{method:'POST',token:player.token,body:proof(full,runId)});
  assert.equal(duplicate.status,200);assert.equal(duplicate.body.duplicate,true);assert.equal(duplicate.body.totalRuns,1);
  const delayed=await h.call('/api/characters',{method:'POST',token:player.token,body:proof(prefix,runId)});
  assert.equal(delayed.status,200);assert.deepEqual(delayed.body.characters,receipt.body.characters);
  for(const row of receipt.body.characters)for(const key of CHARACTER_METRICS)expected[row.id][key]+=row[key];
  const stored=JSON.stringify(h.sql.exec('SELECT * FROM character_runs').toArray());
  assert.ok(!stored.includes(route.seed));assert.ok(!stored.includes(player.token));
 }
 const aggregate=await h.call('/api/characters');assert.equal(aggregate.status,200);
 assert.equal(aggregate.body.trackingSince,publicBefore.body.trackingSince);
 for(const row of aggregate.body.characters)for(const key of CHARACTER_METRICS)assert.equal(row[key],expected[row.id][key],`${row.id}/${key}`);
 assert.doesNotMatch(JSON.stringify(aggregate.body),/playerId|runId|seed|actions|history|completionActions/);
 assert.equal((await h.call('/api/stats')).body.totalRuns,scenes.length);
 const isolated=await h.register(),me=await h.call('/api/me',{token:isolated.token});
 assert.ok(me.body.characters.every(row=>CHARACTER_METRICS.every(key=>row[key]===0)));
});

test('actual-role replay is accepted for all occupations while replaced branches, foreign owners and invented scenes are rejected',async t=>{
 const h=harness(t),player=await h.register(),other=await h.register();
 const occupations=routes.filter(route=>route.id.startsWith('role-'));
 assert.deepEqual(occupations.map(route=>route.actualRoleId).sort(),Object.keys(ROLE_MAP).sort());
 for(const route of occupations){
  const result=await h.call('/api/characters',{method:'POST',token:player.token,body:proof(route,randomUUID())});
  assert.equal(result.status,200,route.id);assert.equal(result.body.verified,true);
 }
 const route=routes.find(route=>route.index===0&&!route.id.startsWith('role-'));
 const fork=routes.find(candidate=>candidate.eventId===route.eventId&&candidate.index===1);
 assert.ok(fork);assert.equal(route.seed,fork.seed);assert.deepEqual(route.actions.slice(0,-1),fork.actions.slice(0,-1));
 const runId=randomUUID(),accepted=await h.call('/api/characters',{method:'POST',token:player.token,body:proof(route,runId)});assert.equal(accepted.status,200);
 const conflict=await h.call('/api/characters',{method:'POST',token:player.token,body:proof(fork,runId)});assert.equal(conflict.status,409);
 const foreign=await h.call('/api/characters',{method:'POST',token:other.token,body:proof(route,runId)});assert.equal(foreign.status,409);
 for(const actions of [
  [{type:'choice',eventId:route.eventId,index:0}],
  [...route.actions.slice(0,-1),{type:'choice',eventId:route.eventId,index:9}],
  [{type:'rage',phase:'event',eventId:'onboarding',target:'erich'}],
 ]){
  const bad=await h.call('/api/characters',{method:'POST',token:player.token,body:{...proof(route,randomUUID()),actions}});
  assert.equal(bad.status,400);assert.equal(bad.body.error,'invalid_replay');
 }
 const untouched=await h.call('/api/me',{token:other.token});
 assert.ok(untouched.body.characters.every(row=>CHARACTER_METRICS.every(key=>row[key]===0)));
});

test('each present target in fifteen quiz groups verifies from event/result phases while absent targets are rejected',async t=>{
 const h=harness(t);
 for(const [eventId,targets]of Object.entries(QUIZ_GROUPS)){
  const fixture=routes.find(route=>route.eventId===eventId&&route.index===0);assert.ok(fixture,eventId);
  const before=replayRun(fixture.roleId,fixture.seed,fixture.actions.slice(0,-1));
  const result=getEvent(before).choices.map((choice,index)=>applyChoice(before,index)).find(canRequestRage);assert.ok(result,eventId);
  for(const context of [before,result])for(const target of targets){
   const player=await h.register(),pending=requestRage(context,target),run=advance(pending),runId=randomUUID();
   const submitted={...fixture,actions:run.actions};
   const initial=await h.call('/api/characters',{method:'POST',token:player.token,body:proof({...fixture,actions:context.actions},runId)});
   assert.equal(initial.status,200,`${eventId}/${target}/prefix`);
   const resolved=await h.call('/api/characters',{method:'POST',token:player.token,body:proof(submitted,runId)});
   assert.equal(resolved.status,200,`${eventId}/${target}`);assert.deepEqual(resolved.body.characters,deriveCharacterStats(run));
   const prior=deriveCharacterStats(context),actual=deriveCharacterStats(run);
   for(const old of prior){
    const next=actual.find(row=>row.id===old.id),selected=old.id===target;
    assert.equal(next.imaginedHits-old.imaginedHits,Number(selected&&pending.rageContext.mode==='imagined'));
    assert.equal(next.realHits-old.realHits,Number(selected&&pending.rageContext.mode==='real'));
   }
   const duplicate=await h.call('/api/characters',{method:'POST',token:player.token,body:proof(submitted,runId)});
   assert.equal(duplicate.status,200);assert.deepEqual(duplicate.body.characters,resolved.body.characters);
   const absent=CHARACTER_IDS.find(id=>!targets.includes(id)),badActions=[...context.actions,{...pending.actions.at(-1),target:absent}];
   const bad=await h.call('/api/characters',{method:'POST',token:player.token,body:proof({...fixture,actions:badActions},randomUUID())});
   assert.equal(bad.status,400);assert.equal(bad.body.error,'invalid_replay');
  }
 }
});
