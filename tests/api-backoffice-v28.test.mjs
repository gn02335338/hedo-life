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
import {replayRun,getEvent,applyChoice,advance,requestRage,canRequestRage,getRageTargets,VERSION,MAX_TURNS} from '../dist/engine.js';
import {ROLE_MAP} from '../dist/roles.js';
import {BACKOFFICE_ROLE_IDS_V28} from '../dist/roles-v28.js';
import {BACKOFFICE_EVENTS_V28} from '../dist/events-backoffice-v28.js';
import {ENDINGS} from '../dist/endings.js';
import {CHARACTER_IDS,CHARACTER_METRICS,deriveCharacterStats} from '../dist/character-stats.js';

const source=readFileSync(new URL('../worker/index.js',import.meta.url),'utf8')
 .replace(/^import .*;\n/gm,'')
 .replace('export class HedoArchive','globalThis.HedoArchive=class HedoArchive')
 .replace('export default','globalThis.worker=');
const {routes}=JSON.parse(readFileSync(new URL('./fixtures/backoffice-routes-v28.json',import.meta.url),'utf8'));
const scenes=routes.filter(route=>route.index===0&&!route.id.startsWith('role-'));
const proof=(route,runId,actions=route.actions)=>({runId,roleId:route.roleId,seed:route.seed,actions});
const groups={
 'accounting28-final-form':['sophie','sonny'],
 'hr28-coffee-jd':['wing','hope'],
 'hr28-onboarding-notice':['wing','sonny'],
 'hr28-attendance-access':['jack','meimei'],
 'admin28-extension-grandeur':['wing','jenjen','erich','sonny'],
 'admin28-supply-minimum':['wing','jenjen'],
 'admin28-seat-key':['sophie','sonny'],
};

// All requests exercise the actual Worker against isolated, in-memory SQLite.
// They never send invented runs or counters to the production observation store.
function harness(t){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());db.exec('PRAGMA foreign_keys = ON');
 const sql={exec(query,...args){
  let rows=[];
  if(!args.length&&query.includes(';'))db.exec(query);
  else{const statement=db.prepare(query);if(statement.columns().length)rows=statement.all(...args);else statement.run(...args);}
  return {toArray:()=>rows,one:()=>{assert.equal(rows.length,1);return rows[0];}};
 }};
 const storage={sql,transactionSync(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}},async getAlarm(){return null;},async setAlarm(){}};
 const context=vm.createContext({DurableObject:class{constructor(ctx){this.ctx=ctx;}},replayRun,VERSION,MAX_TURNS,ROLE_MAP,ENDINGS,
  ...http,validateFeedback,validatePublisherToken,FeedbackStore,AchievementStore,CharacterStore,crypto,Response,Request,URL,Date});
 vm.runInContext(source,context);
 const archive=new context.HedoArchive({storage,blockConcurrencyWhile:fn=>fn()},{});
 const call=async(path,{method='GET',token,body}={})=>{
  archive.rate=new http.RateGuard();const headers={};
  if(token)headers.Authorization=`Bearer ${token}`;if(body)headers['Content-Type']='application/json';
  const response=await archive.fetch(new Request(`https://game.example${path}`,{method,headers,body:body?JSON.stringify(body):undefined}));
  return {status:response.status,body:await response.json()};
 };
 const register=async()=>{
  const token=randomBytes(32).toString('hex'),response=await call('/api/player',{method:'POST',body:{token}});
  assert.equal(response.status,200);return {token,id:response.body.playerId};
 };
 return {sql,call,register};
}

test('all 32 back-office scenes verify naturally through progress and completion, with anonymous counters remaining replay-derived and idempotent',async t=>{
 const h=harness(t),isolated=await h.register(),before=await h.call('/api/characters');
 assert.equal(scenes.length,32);assert.deepEqual(scenes.map(route=>route.eventId).sort(),BACKOFFICE_EVENTS_V28.map(event=>event.id).sort());
 const expected=Object.fromEntries(CHARACTER_IDS.map(id=>[id,Object.fromEntries(CHARACTER_METRICS.map(key=>[key,0]))]));
 for(const route of scenes){
  const player=await h.register(),runId=randomUUID(),prefix=route.actions.slice(0,-1);
  const first=await h.call('/api/characters',{method:'POST',token:player.token,body:proof(route,runId,prefix)});
  assert.equal(first.status,200,route.id);assert.deepEqual(first.body.characters,deriveCharacterStats(replayRun(route.roleId,route.seed,prefix)));
  const run=replayRun(route.roleId,route.seed,route.actions);
  const resolved=await h.call('/api/characters',{method:'POST',token:player.token,body:{...proof(route,runId),
   role:'executive',actualRoleId:'executive',stats:{cash:999,mood:100},rank:7,pay:999,
   endingId:'nasdaq-executive',characters:CHARACTER_IDS.map(id=>({id,realHits:9999,encounters:9999})),
   history:[{eventId:route.eventId,result:'invented',speaker:'wing'}],
  }});
  assert.equal(resolved.status,200,route.id);assert.equal(resolved.body.verified,true);assert.equal(resolved.body.totalRuns,0);
  assert.deepEqual(resolved.body.characters,deriveCharacterStats(run));
  for(const endpoint of ['/api/characters','/api/achievements']){
   const retry=await h.call(endpoint,{method:'POST',token:player.token,body:proof(route,runId)});
   assert.equal(retry.status,200,route.id);assert.deepEqual(retry.body.characters,resolved.body.characters);
  }
  const ended=replayRun(route.roleId,route.seed,route.completionActions);assert.equal(ended.completed,true,route.id);
  assert.equal(ended.endingId,route.endingId);assert.ok(BACKOFFICE_ROLE_IDS_V28.includes(ended.roleId));
  const completed=await h.call('/api/complete',{method:'POST',token:player.token,body:{...proof(route,runId,route.completionActions),pay:999,actualRoleId:'executive'}});
  assert.equal(completed.status,200,route.id);assert.equal(completed.body.endingId,ended.endingId);
  assert.equal(completed.body.recorded,true);assert.equal(completed.body.duplicate,false);assert.equal(completed.body.totalRuns,1);
  assert.deepEqual(completed.body.characters,deriveCharacterStats(ended));
  const saved=h.sql.exec('SELECT role_id,actual_role_id,rank,salary FROM runs WHERE id = ?',runId).one();
  assert.deepEqual({...saved},{role_id:ended.roleId,actual_role_id:ended.actualRoleId,rank:ended.rank,salary:ended.pay});
  const repeated=await h.call('/api/complete',{method:'POST',token:player.token,body:proof(route,runId,route.completionActions)});
  assert.equal(repeated.status,200);assert.equal(repeated.body.duplicate,true);assert.equal(repeated.body.totalRuns,1);
  const delayed=await h.call('/api/characters',{method:'POST',token:player.token,body:proof(route,runId,prefix)});
  assert.equal(delayed.status,200);assert.deepEqual(delayed.body.characters,completed.body.characters);
  const foreign=await h.call('/api/complete',{method:'POST',token:isolated.token,body:proof(route,runId,route.completionActions)});
  assert.equal(foreign.status,409);
  for(const row of completed.body.characters)for(const key of CHARACTER_METRICS)expected[row.id][key]+=row[key];
  const retained=JSON.stringify(h.sql.exec('SELECT * FROM character_runs').toArray());
  assert.ok(!retained.includes(route.seed));assert.ok(!retained.includes(player.token));
 }
 const aggregate=await h.call('/api/characters');assert.equal(aggregate.status,200);
 assert.equal(aggregate.body.trackingSince,before.body.trackingSince);assert.equal(aggregate.body.characters.length,CHARACTER_IDS.length);
 for(const row of aggregate.body.characters)for(const key of CHARACTER_METRICS)assert.equal(row[key],expected[row.id][key],`${row.id}/${key}`);
 assert.doesNotMatch(JSON.stringify(aggregate.body),/playerId|runId|seed|actions|history|completionActions/);
 assert.equal((await h.call('/api/stats')).body.totalRuns,32);
 const untouched=await h.call('/api/me',{token:isolated.token});assert.equal(untouched.body.totalRuns,0);
 assert.ok(untouched.body.characters.every(row=>CHARACTER_METRICS.every(key=>row[key]===0)));
});

test('all four new occupations have accepted natural prefixes and cannot be added retroactively to old cohorts',async t=>{
 const h=harness(t),player=await h.register(),occupations=routes.filter(route=>route.id.startsWith('role-'));
 assert.deepEqual(occupations.map(route=>route.actualRoleId).sort(),[...BACKOFFICE_ROLE_IDS_V28].sort());
 for(const route of occupations){
  const accepted=await h.call('/api/characters',{method:'POST',token:player.token,body:proof(route,randomUUID())});
  assert.equal(accepted.status,200,route.id);assert.equal(accepted.body.verified,true);
  for(const cohort of ['e1','e17','e26','e27']){
   const rejected=await h.call('/api/characters',{method:'POST',token:player.token,body:{...proof(route,randomUUID()),seed:`${cohort}-unsupported-backoffice`,actions:[{type:'choice',eventId:'onboarding',index:0}]}});
   assert.equal(rejected.status,400,`${route.roleId}/${cohort}`);assert.equal(rejected.body.error,'invalid_role');
  }
 }
 assert.equal((await h.call('/api/stats')).body.totalRuns,0);
});

test('back-office prefixes cannot be replaced, reassigned, claimed by another player or completed by supplied client fields',async t=>{
 const h=harness(t),player=await h.register(),other=await h.register(),route=scenes[0];assert.ok(route);
 const fork=routes.find(row=>row.eventId===route.eventId&&row.index===1);assert.ok(fork);
 assert.equal(route.seed,fork.seed);assert.deepEqual(route.actions.slice(0,-1),fork.actions.slice(0,-1));
 const runId=randomUUID(),accepted=await h.call('/api/characters',{method:'POST',token:player.token,body:proof(route,runId)});assert.equal(accepted.status,200);
 for(const [token,candidate]of [[player.token,fork],[other.token,route]]){
  const conflict=await h.call('/api/characters',{method:'POST',token,body:proof(candidate,runId)});assert.equal(conflict.status,409);
 }
 for(const actions of [
  [{type:'choice',eventId:route.eventId,index:0}],
  [...route.actions.slice(0,-1),{type:'choice',eventId:route.eventId,index:99}],
  [{type:'rage',phase:'event',eventId:'onboarding',target:'erich'}],
 ]){
  const rejected=await h.call('/api/characters',{method:'POST',token:player.token,body:proof(route,randomUUID(),actions)});
  assert.equal(rejected.status,400);assert.equal(rejected.body.error,actions.at(-1).index===99?'invalid_actions':'invalid_replay');
 }
 const incomplete=await h.call('/api/complete',{method:'POST',token:player.token,body:{...proof(route,randomUUID()),completed:true,endingId:route.endingId,rank:7,pay:999}});
 assert.equal(incomplete.status,400);assert.equal(incomplete.body.error,'incomplete_run');assert.equal((await h.call('/api/stats')).body.totalRuns,0);
 const otherSnapshot=await h.call('/api/me',{token:other.token});assert.equal(otherSnapshot.body.totalRuns,0);
 assert.ok(otherSnapshot.body.characters.every(row=>CHARACTER_METRICS.every(key=>row[key]===0)));
});

test('all seven shared back-office conversations verify each explicit target in event and result phases without crediting other people',async t=>{
 const h=harness(t);
 for(const[eventId,targets]of Object.entries(groups)){
  const fixture=scenes.find(route=>route.eventId===eventId);assert.ok(fixture,eventId);
  const before=replayRun(fixture.roleId,fixture.seed,fixture.actions.slice(0,-1));
  const result=getEvent(before).choices.map((choice,index)=>applyChoice(before,index)).find(canRequestRage);assert.ok(result,eventId);
  for(const context of [before,result])for(const target of targets){
   assert.deepEqual(getRageTargets(context),targets,`${eventId}/${context.pending?'result':'event'}`);
   const player=await h.register(),runId=randomUUID(),pending=requestRage(context,target),resolved=advance(pending);
   const action=pending.actions.at(-1),phase=context.pending?'result':'event';
   assert.deepEqual(action,{type:'rage',phase,eventId,target});
   const prefix=await h.call('/api/characters',{method:'POST',token:player.token,body:proof(fixture,runId,context.actions)});
   assert.equal(prefix.status,200,`${eventId}/${phase}/${target}/prefix`);
   const recorded=await h.call('/api/characters',{method:'POST',token:player.token,body:{...proof(fixture,runId,resolved.actions),characters:[{id:target,realHits:9999}]}});
   assert.equal(recorded.status,200,`${eventId}/${phase}/${target}`);assert.equal(recorded.body.verified,true);assert.equal(recorded.body.totalRuns,0);
   assert.deepEqual(recorded.body.characters,deriveCharacterStats(resolved));
   const prior=deriveCharacterStats(context),actual=deriveCharacterStats(resolved);
   for(const old of prior){
    const next=actual.find(row=>row.id===old.id),selected=old.id===target;
    assert.equal(next.encounters-old.encounters,Number(selected));
    assert.equal(next.imaginedHits-old.imaginedHits,Number(selected&&pending.rageContext.mode==='imagined'));
    assert.equal(next.realHits-old.realHits,Number(selected&&pending.rageContext.mode==='real'));
   }
   const duplicate=await h.call('/api/characters',{method:'POST',token:player.token,body:proof(fixture,runId,resolved.actions)});
   assert.equal(duplicate.status,200);assert.deepEqual(duplicate.body.characters,recorded.body.characters);
   const absent=CHARACTER_IDS.find(id=>!targets.includes(id)),invented=[...context.actions,{...action,target:absent}];
   const rejected=await h.call('/api/characters',{method:'POST',token:player.token,body:proof(fixture,randomUUID(),invented)});
   assert.equal(rejected.status,400);assert.equal(rejected.body.error,'invalid_replay');
  }
 }
 assert.equal((await h.call('/api/stats')).body.totalRuns,0,'interaction prefixes do not create completed games');
});
