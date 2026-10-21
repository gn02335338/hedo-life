import {ObservationStore} from '../worker/observations.js';
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
import {replayRun,getEvent,applyChoice,advance,getRageTargets,requestRage,VERSION,MAX_TURNS} from '../dist/engine.js';
import {ROLE_MAP} from '../dist/roles.js';
import {ENDINGS} from '../dist/endings.js';
import {CHARACTER_IDS,CHARACTER_METRICS,deriveCharacterStats} from '../dist/character-stats.js';

const source=readFileSync(new URL('../worker/index.js',import.meta.url),'utf8')
 .replace(/^import .*;\n/gm,'')
 .replace('export class HedoArchive','globalThis.HedoArchive=class HedoArchive')
 .replace('export default','globalThis.worker=');
const {routes}=JSON.parse(readFileSync(new URL('./fixtures/patronage-routes-v29.json',import.meta.url),'utf8'));
const proof=(route,runId,actions=route.actions)=>({runId,roleId:route.roleId,seed:route.seed,actions});

// The production Worker runs against isolated SQLite. Synthetic playthroughs
// never enter the real anonymous collection or its public counters.
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
  ...http,validateFeedback,validatePublisherToken,FeedbackStore,AchievementStore,CharacterStore,ObservationStore,crypto,Response,Request,URL,Date});
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

test('gender scenes and every recruitment outcome are replay-verified without trusting supplied gender, job title, patronage or salary',async t=>{
 const h=harness(t),stranger=await h.register(),before=await h.call('/api/characters');
 const witnesses=routes.filter(route=>(route.kind==='scene'&&route.index===0)||['application','manual-entry'].includes(route.kind));
 assert.ok(witnesses.filter(route=>route.kind==='scene').length>=12);
 assert.ok(witnesses.some(route=>route.kind==='application'&&replayRun(route.roleId,route.seed,route.actions).patronage));
 const expected=Object.fromEntries(CHARACTER_IDS.map(id=>[id,Object.fromEntries(CHARACTER_METRICS.map(key=>[key,0]))]));
 for(const route of witnesses){
  const player=await h.register(),runId=randomUUID(),prefix=route.beforeActions;
  const initial=await h.call('/api/characters',{method:'POST',token:player.token,body:proof(route,runId,prefix)});
  assert.equal(initial.status,200,route.id);assert.equal(initial.body.totalRuns,0);
  const resolved=replayRun(route.roleId,route.seed,route.actions);
  const recorded=await h.call('/api/characters',{method:'POST',token:player.token,body:{...proof(route,runId),
   characterGender:resolved.characterGender==='male'?'female':'male',jobTitle:'董事長',pay:499,
   patronage:{title:'乾女兒',fromPay:1,appointedPay:499,historyIndex:0},
   stats:{cash:100,mood:100,boss:100},characters:[{id:'wing',realHits:9999}],
  }});
  assert.equal(recorded.status,200,route.id);assert.equal(recorded.body.verified,true);assert.equal(recorded.body.totalRuns,0);
  assert.deepEqual(recorded.body.characters,deriveCharacterStats(resolved));
  const again=await h.call('/api/characters',{method:'POST',token:player.token,body:proof(route,runId)});
  assert.equal(again.status,200);assert.deepEqual(again.body.characters,recorded.body.characters);
  const ended=replayRun(route.roleId,route.seed,route.completionActions);
  assert.equal(ended.completed,true,route.id);
  const complete=await h.call('/api/complete',{method:'POST',token:player.token,body:{...proof(route,runId,route.completionActions),pay:499,jobTitle:'董事長',characterGender:'invented',patronage:{appointedPay:499}}});
  assert.equal(complete.status,200,route.id);assert.equal(complete.body.endingId,ended.endingId);assert.equal(complete.body.recorded,true);assert.equal(complete.body.totalRuns,1);
  assert.deepEqual(complete.body.characters,deriveCharacterStats(ended));
  const saved=h.sql.exec('SELECT role_id,actual_role_id,rank,salary FROM runs WHERE id = ?',runId).one();
  assert.deepEqual({...saved},{role_id:ended.roleId,actual_role_id:ended.actualRoleId,rank:ended.rank,salary:ended.pay});
  const duplicate=await h.call('/api/complete',{method:'POST',token:player.token,body:proof(route,runId,route.completionActions)});
  assert.equal(duplicate.status,200);assert.equal(duplicate.body.duplicate,true);assert.equal(duplicate.body.totalRuns,1);
  const delayed=await h.call('/api/characters',{method:'POST',token:player.token,body:proof(route,runId,prefix)});
  assert.equal(delayed.status,200);assert.deepEqual(delayed.body.characters,complete.body.characters);
  const stolen=await h.call('/api/complete',{method:'POST',token:stranger.token,body:proof(route,runId,route.completionActions)});
  assert.equal(stolen.status,409);
  for(const row of complete.body.characters)for(const key of CHARACTER_METRICS)expected[row.id][key]+=row[key];
 }
 const after=await h.call('/api/characters');assert.equal(after.body.trackingSince,before.body.trackingSince);
 for(const row of after.body.characters)for(const key of CHARACTER_METRICS)assert.equal(row[key],expected[row.id][key],`${row.id}/${key}`);
 assert.doesNotMatch(JSON.stringify(after.body),/characterGender|patronage|playerId|runId|seed|actions|history/);
 const untouched=await h.call('/api/me',{token:stranger.token});assert.equal(untouched.body.totalRuns,0);
 assert.ok(untouched.body.characters.every(row=>CHARACTER_METRICS.every(key=>row[key]===0)));
});

test('client metadata cannot create an appointment, inject a female dark invitation or rewrite a committed recruitment decision',async t=>{
 const h=harness(t),player=await h.register();
 const route=routes.find(row=>row.kind==='application'&&replayRun(row.roleId,row.seed,row.actions).patronage);
 assert.ok(route);const runId=randomUUID(),accepted=await h.call('/api/characters',{method:'POST',token:player.token,body:proof(route,runId)});
 assert.equal(accepted.status,200);
 const alternate=[...route.beforeActions,{type:'choice',eventId:'patronage-application',index:2}];
 const conflict=await h.call('/api/characters',{method:'POST',token:player.token,body:proof(route,runId,alternate)});
 assert.equal(conflict.status,409);
 for(const actions of [
  [{type:'choice',eventId:'patronage-application',index:0}],
  [...route.beforeActions,{type:'choice',eventId:'patronage-application',index:99}],
 ]){
  const rejected=await h.call('/api/characters',{method:'POST',token:player.token,body:proof(route,randomUUID(),actions)});
  assert.equal(rejected.status,400);assert.match(rejected.body.error,/invalid_actions|invalid_replay/);
 }
 const canonical=await h.call('/api/characters',{method:'POST',token:player.token,body:proof(route,runId,[
  ...route.beforeActions,{type:'choice',eventId:'patronage-application',index:route.index,characterGender:'invented',patronage:{appointedPay:499}},
 ])});
 assert.equal(canonical.status,200);assert.deepEqual(canonical.body.characters,deriveCharacterStats(replayRun(route.roleId,route.seed,route.actions)),'extra choice metadata is discarded rather than treated as game state');
 const female=routes.find(row=>row.characterGender==='female');assert.ok(female);
 const dark=await h.call('/api/characters',{method:'POST',token:player.token,body:proof(female,randomUUID(),[...female.beforeActions,{type:'choice',eventId:'kind-workday',index:0}])});
 assert.equal(dark.status,400);assert.equal(dark.body.error,'invalid_replay');
 const incomplete=await h.call('/api/complete',{method:'POST',token:player.token,body:{...proof(route,randomUUID(),route.beforeActions),completed:true,endingId:route.endingId,patronage:{title:'乾兒子'},pay:499}});
 assert.equal(incomplete.status,400);assert.equal(incomplete.body.error,'incomplete_run');
 assert.equal((await h.call('/api/stats')).body.totalRuns,0);
});

test('every co-present application or Rick scene target verifies independently without crediting absent colleagues',async t=>{
 const h=harness(t),groups={
  'patronage-application':['wing','hope','rick'],
  'rick29-protected-report':['rick','owen'],
  'rick29-pm-family-tree':['rick','cindy'],
 };
 for(const [eventId,targets]of Object.entries(groups)){
  const route=routes.find(row=>row.eventId===eventId&&row.index===0);assert.ok(route,eventId);
  const before=replayRun(route.roleId,route.seed,route.beforeActions),pending=applyChoice(before,0);
  for(const state of [before,pending])for(const target of targets){
   assert.deepEqual(getRageTargets(state),targets,eventId);
   const player=await h.register(),runId=randomUUID(),raging=requestRage(state,target),resolved=advance(raging);
   const baseline=await h.call('/api/characters',{method:'POST',token:player.token,body:proof(route,runId,state.actions)});
   assert.equal(baseline.status,200);
   const accepted=await h.call('/api/characters',{method:'POST',token:player.token,body:{...proof(route,runId,resolved.actions),characters:[{id:'wing',realHits:9999}],target:'wing'}});
   assert.equal(accepted.status,200,`${eventId}/${target}`);assert.equal(accepted.body.totalRuns,0);
   assert.deepEqual(accepted.body.characters,deriveCharacterStats(resolved));
   const old=deriveCharacterStats(state);
   for(const row of accepted.body.characters){
    const previous=old.find(person=>person.id===row.id),selected=row.id===target;
    assert.equal(row.encounters-previous.encounters,Number(selected));
    assert.equal(row.imaginedHits-previous.imaginedHits,Number(selected&&raging.rageContext.mode==='imagined'));
    assert.equal(row.realHits-previous.realHits,Number(selected&&raging.rageContext.mode==='real'));
   }
   const duplicate=await h.call('/api/characters',{method:'POST',token:player.token,body:proof(route,runId,resolved.actions)});
   assert.equal(duplicate.status,200);assert.deepEqual(duplicate.body.characters,accepted.body.characters);
   const action=raging.actions.at(-1),invented=[...state.actions,{...action,target:'sam'}];
   const rejected=await h.call('/api/characters',{method:'POST',token:player.token,body:proof(route,randomUUID(),invented)});
   assert.equal(rejected.status,400);assert.equal(rejected.body.error,'invalid_replay');
  }
 }
 assert.equal((await h.call('/api/stats')).body.totalRuns,0);
});
