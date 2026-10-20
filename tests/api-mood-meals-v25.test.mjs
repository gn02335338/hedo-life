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
import { replayRun, VERSION, MAX_TURNS } from '../dist/engine.js';
import { ROLE_MAP } from '../dist/roles.js';
import { ENDINGS } from '../dist/endings.js';
import { CHARACTER_IDS, CHARACTER_METRICS, deriveCharacterStats } from '../dist/character-stats.js';

const source = readFileSync(new URL('../worker/index.js', import.meta.url), 'utf8')
  .replace(/^import .*;\n/gm, '')
  .replace('export class HedoArchive', 'globalThis.HedoArchive=class HedoArchive')
  .replace('export default', 'globalThis.worker=');
const { routes } = JSON.parse(readFileSync(new URL('./fixtures/mood-meals-routes-v25.json', import.meta.url), 'utf8'));
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

test('e25 meals and self-destruct replay through anonymous progress/completion without duplicate totals or invented hits',async t=>{
 const h=harness(t);
 const selected=routes.filter(row=>/^meal-.*-reply-[01]$/.test(row.id)||/^self-destruct-[1-4]-reply-[012]$/.test(row.id));
 assert.ok(selected.length>=40);
 for(const route of selected){
  const player=await h.register(),runId=randomUUID(),run=replayRun(route.roleId,route.seed,route.actions);
  const payload={...proof(route,runId),stats:{mood:100},flags:{mood_crash_count:999},characters:[{id:'wing',realHits:9999}],mealContext:{guest:'wing'}};
  const initial=await h.call('/api/characters',{method:'POST',token:player.token,body:payload});
  assert.equal(initial.status,200,route.id);assert.deepEqual(initial.body.characters,deriveCharacterStats(run));
  assert.equal(initial.body.characters.reduce((n,x)=>n+x.realHits+x.imaginedHits,0),0,route.id);
  const retry=await h.call('/api/characters',{method:'POST',token:player.token,body:proof(route,runId)});
  assert.equal(retry.status,200);assert.deepEqual(retry.body.characters,initial.body.characters);
  const full={...route,actions:route.completionActions},ended=replayRun(full.roleId,full.seed,full.actions);
  assert.equal(ended.completed,true,route.id);
  const receipt=await h.call('/api/complete',{method:'POST',token:player.token,body:proof(full,runId)});
  assert.equal(receipt.status,200,route.id);assert.equal(receipt.body.totalRuns,1);assert.equal(receipt.body.endingId,ended.endingId);
  assert.deepEqual(receipt.body.characters,deriveCharacterStats(ended));
  const duplicate=await h.call('/api/complete',{method:'POST',token:player.token,body:proof(full,runId)});
  assert.equal(duplicate.status,200);assert.equal(duplicate.body.duplicate,true);assert.equal(duplicate.body.totalRuns,1);
 }
 const aggregate=await h.call('/api/characters');
 assert.equal(aggregate.status,200);assert.equal(aggregate.body.characters.length,CHARACTER_IDS.length);
 assert.equal(aggregate.body.characters.reduce((n,x)=>n+x.realHits+x.imaginedHits,0),0);
 assert.doesNotMatch(JSON.stringify(aggregate.body),/playerId|runId|seed|actions|mealContext|mood_crash_count/);
});

test('meal guest/response changes cannot replace a committed branch or affect another anonymous player',async t=>{
 const h=harness(t),player=await h.register(),other=await h.register(),runId=randomUUID();
 const original=routes.find(row=>row.id==='meal-jack-reply-0'),fork=routes.find(row=>row.id==='meal-jack-reply-1');
 assert.equal(original.seed,fork.seed);
 const accepted=await h.call('/api/characters',{method:'POST',token:player.token,body:proof(original,runId)});assert.equal(accepted.status,200);
 const conflict=await h.call('/api/characters',{method:'POST',token:player.token,body:proof(fork,runId)});assert.equal(conflict.status,409);
 const foreign=await h.call('/api/characters',{method:'POST',token:other.token,body:proof(original,runId)});assert.equal(foreign.status,409);
 const untouched=await h.call('/api/me',{token:other.token});assert.equal(untouched.status,200);
 assert.ok(untouched.body.characters.every(row=>CHARACTER_METRICS.every(key=>row[key]===0)));
 for(const actions of [
  [{type:'choice',eventId:'mood-collapse',index:3}],
  [{type:'choice',eventId:'meal-with-jack',index:0}],
  [...original.actions,{type:'choice',eventId:'meal-with-jack',index:0}],
 ]){
  const bad=await h.call('/api/characters',{method:'POST',token:player.token,body:{...proof(original,randomUUID()),actions}});
  assert.equal(bad.status,400);
 }
});
