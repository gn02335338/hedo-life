import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {AchievementStore} from '../worker/achievements.js';
import {CharacterStore} from '../worker/characters.js';
import {FeedbackStore} from '../worker/feedback-store.js';
import {ObservationStore} from '../worker/observations.js';
import {validateFeedback,validatePublisherToken} from '../worker/feedback.js';
import * as http from '../worker/http.js';
import * as engine from '../dist/engine.js';
import {ROLE_MAP} from '../dist/roles.js';
import {ENDINGS} from '../dist/endings.js';
import {CHARACTER_IDS,CHARACTER_METRICS,deriveCharacterStats} from '../dist/character-stats.js';
import {deriveAchievements} from '../dist/achievements.js';

const source=readFileSync(new URL('../worker/index.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export class HedoArchive','globalThis.HedoArchive=class HedoArchive').replace('export default','globalThis.worker=');
const {routes}=JSON.parse(readFileSync(new URL('./fixtures/verbal-scene-routes.json',import.meta.url),'utf8'));
const oldRoutes=JSON.parse(readFileSync(new URL('./fixtures/verbal-routes-v30.json',import.meta.url),'utf8')).routes;
const proof=(route,runId=randomUUID(),actions=route.actions)=>({runId,roleId:route.roleId,seed:route.seed,actions});
const replay=(route,actions=route.actions)=>{try{return engine.replayRun(route.roleId,route.seed,actions);}catch(error){error.message=`${route.id}: ${error.message}`;throw error;}};
const ids=response=>response.body.achievements.map(row=>row.id);
const row=id=>{const route=routes.find(route=>route.id===id);assert.ok(route,`Missing natural scene-verbal fixture ${id}`);return route;};
const speech=run=>run.history.findLast(entry=>entry.verbalOutcome?.version===2);

// The actual Worker handlers run against isolated SQLite. No generated proof,
// dialogue, anonymous player or archive count is sent to the live service.
function harness(t){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());db.exec('PRAGMA foreign_keys = ON');
 const sql={exec(query,...args){let rows=[];if(!args.length&&query.includes(';'))db.exec(query);else{const statement=db.prepare(query);if(statement.columns().length)rows=statement.all(...args);else statement.run(...args);}return{toArray:()=>rows,one:()=>{assert.equal(rows.length,1);return rows[0];}};}};
 const storage={sql,transactionSync(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}},async getAlarm(){return null;},async setAlarm(){}};
 const context=vm.createContext({DurableObject:class{constructor(ctx){this.ctx=ctx;}},replayRun:engine.replayRun,VERSION:engine.VERSION,MAX_TURNS:engine.MAX_TURNS,ROLE_MAP,ENDINGS,...http,validateFeedback,validatePublisherToken,FeedbackStore,AchievementStore,CharacterStore,ObservationStore,crypto,Response,Request,URL,Date});
 vm.runInContext(source,context);const archive=new context.HedoArchive({storage,blockConcurrencyWhile:fn=>fn()},{});
 const call=async(path,{method='GET',token,body}={})=>{
  archive.rate=new http.RateGuard();const headers={};if(token)headers.Authorization=`Bearer ${token}`;if(body)headers['Content-Type']='application/json';
  const response=await archive.fetch(new Request(`https://game.example${path}`,{method,headers,body:body?JSON.stringify(body):undefined}));return{status:response.status,body:await response.json()};
 };
 const register=async()=>{const token=randomBytes(32).toString('hex'),response=await call('/api/player',{method:'POST',body:{token}});assert.equal(response.status,200);return{token,id:response.body.playerId};};
 const post=(player,route,runId,actions=route.actions,path='/api/achievements',extra={})=>call(path,{method:'POST',token:player.token,body:{...proof(route,runId,actions),...extra}});
 return{sql,call,register,post};
}

test('all scene-aware spoken responses replay, complete and deduplicate without adding real or imagined hits',async t=>{
 const h=harness(t),totals=Object.fromEntries(CHARACTER_IDS.map(id=>[id,Object.fromEntries(CHARACTER_METRICS.map(metric=>[metric,0]))]));
 assert.ok(routes.length>=40);assert.ok(routes.some(route=>route.seed.startsWith('e30-')));assert.ok(routes.some(route=>route.seed.startsWith('e31-')));
 for(const route of routes){
  const player=await h.register(),runId=randomUUID();
  if(route.baseActions.length){const prefix=await h.post(player,route,runId,route.baseActions,'/api/characters');assert.equal(prefix.status,200,`${route.id}/existing-prefix`);}
  const run=replay(route),accepted=await h.post(player,route,runId);
  assert.equal(accepted.status,200,route.id);assert.equal(accepted.body.verified,true);assert.equal(accepted.body.playerId,player.id);assert.equal(accepted.body.totalRuns,0);
  assert.deepEqual(accepted.body.characters,deriveCharacterStats(run));assert.deepEqual([...ids(accepted)].sort(),[...deriveAchievements(run)].sort());
  const release=speech(run);assert.ok(release,route.id);assert.equal(release.choiceText,route.quote);assert.equal(release.verbalOutcome.origin,route.sourceEventId);assert.equal(release.verbalOutcome.target,route.target);
  for(const character of accepted.body.characters){assert.equal(character.realHits,0,route.id);assert.equal(character.imaginedHits,0,route.id);}
  for(const endpoint of ['/api/characters','/api/achievements']){
   const duplicate=await h.post(player,route,runId,route.actions,endpoint);assert.equal(duplicate.status,200);assert.deepEqual(duplicate.body.characters,accepted.body.characters);assert.deepEqual(duplicate.body.achievements,accepted.body.achievements);if(endpoint==='/api/achievements')assert.deepEqual(duplicate.body.newlyUnlocked,[]);
  }
  const done=replay(route,route.completionActions),receipt=await h.post(player,route,runId,route.completionActions,'/api/complete',{endingId:'nasdaq-executive',title:'FORGED_LOCKED_TITLE',completed:true});
  assert.equal(done.completed,true);assert.equal(receipt.status,200,`${route.id}/complete`);assert.equal(receipt.body.endingId,done.endingId);assert.equal(receipt.body.totalRuns,1);assert.equal(receipt.body.duplicate,false);assert.deepEqual(receipt.body.characters,deriveCharacterStats(done));
  assert.ok(!JSON.stringify(receipt.body).includes('FORGED_LOCKED_TITLE'));
  for(const badge of accepted.body.achievements)assert.equal(receipt.body.achievements.find(entry=>entry.id===badge.id)?.unlockedAt,badge.unlockedAt);
  const repeated=await h.post(player,route,runId,route.completionActions,'/api/complete');assert.equal(repeated.status,200);assert.equal(repeated.body.duplicate,true);assert.equal(repeated.body.totalRuns,1);assert.deepEqual(repeated.body.characters,receipt.body.characters);
  if(route.baseActions.length){const older=await h.post(player,route,runId,route.baseActions,'/api/characters');assert.equal(older.status,200);assert.deepEqual(older.body.characters,receipt.body.characters);}
  for(const character of receipt.body.characters)for(const metric of CHARACTER_METRICS)totals[character.id][metric]+=character[metric];
  const retained=JSON.stringify([...h.sql.exec('SELECT * FROM character_runs WHERE id=?',runId).toArray(),...h.sql.exec('SELECT * FROM achievement_runs WHERE id=?',runId).toArray()]);
  for(const secret of [route.seed,player.token,route.quote,'FORGED_LOCKED_TITLE'])assert.ok(!retained.includes(secret));
 }
 const global=await h.call('/api/characters');for(const character of global.body.characters)for(const metric of CHARACTER_METRICS)assert.equal(character[metric],totals[character.id][metric]);
 assert.equal((await h.call('/api/stats')).body.totalRuns,routes.length);assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM runs').one().n,routes.length);
 assert.doesNotMatch(JSON.stringify(global.body),/version:2|verbalOutcome|playerId|runId|seed|actions|history|quote/);
});

test('legacy versionless proofs retain their published branch while explicit version 2 is the only accepted opt-in',async t=>{
 const h=harness(t);
 for(const old of oldRoutes.filter(route=>route.kind==='outcome')){
  const player=await h.register(),runId=randomUUID(),run=replay(old),response=await h.post(player,old,runId);
  assert.equal(response.status,200,old.id);assert.equal(run.eventId,old.expected.eventId);assert.equal(run.turn,old.expected.turn);
  assert.ok(run.actions.filter(action=>action.type==='verbal').every(action=>!Object.hasOwn(action,'version')));
  assert.ok(run.history.filter(entry=>entry.verbalOutcome).every(entry=>!Object.hasOwn(entry.verbalOutcome,'version')));
  assert.deepEqual(response.body.characters,deriveCharacterStats(run));
  const index=old.actions.findIndex(action=>action.type==='verbal'),changed=old.actions.map((action,position)=>position===index?{...action,version:2}:action);
  const fork=await h.post(player,old,runId,changed);assert.equal(fork.status,409,'a committed legacy action cannot be relabeled as the new version');
 }
 const route=row('work-event'),action=route.actions.findLast(action=>action.type==='verbal'),position=route.actions.lastIndexOf(action),prefix=route.actions.slice(0,position),player=await h.register(),untouched=await h.call('/api/me',{token:player.token});
 for(const version of [null,1,0,3,'2',true,{},[]]){
  const response=await h.post(player,route,randomUUID(),[...prefix,{...action,version}]);assert.equal(response.status,400,JSON.stringify(version));assert.equal(response.body.error,'invalid_actions');
 }
 for(const seed of ['e29-scene-forged','e33-scene-forged']){
  const response=await h.call('/api/achievements',{method:'POST',token:player.token,body:{runId:randomUUID(),roleId:'system',seed,actions:[{type:'verbal',phase:'event',eventId:'onboarding',version:2}]}});
  assert.equal(response.status,400);assert.equal(response.body.error,'invalid_actions');
 }
 assert.deepEqual((await h.call('/api/me',{token:player.token})).body,untouched.body);
});

test('quotes, source effects, chosen outcomes and client character totals are derived rather than supplied',async t=>{
 const h=harness(t),player=await h.register(),route=row('work-event'),runId=randomUUID(),run=replay(route),action=route.actions.findLast(action=>action.type==='verbal'),position=route.actions.lastIndexOf(action),prefix=route.actions.slice(0,position);
 const response=await h.post(player,route,runId,route.actions,'/api/achievements',{
  quote:'FORGED_SPOKEN_LINE',line:'FORGED_SPOKEN_LINE',effect:'nasdaq',pay:500,completed:true,endingId:'nasdaq-executive',title:'FORGED_LOCKED_TITLE',
  verbalContext:{version:2,outcome:'support',target:'wing',effect:'promotion'},verbalOutcome:{version:2,kind:'support',target:'wing',affinityDelta:999},
  characters:[{id:'wing',realHits:9999,imaginedHits:9999,affinityGained:9999}],flags:{promotions:99},history:[{eventId:route.sourceEventId,choiceIndex:99,choiceText:'FORGED_SPOKEN_LINE',result:'FORGED_RESULT'}],
 });
 assert.equal(response.status,200);assert.deepEqual(response.body.characters,deriveCharacterStats(run));assert.deepEqual([...ids(response)].sort(),[...deriveAchievements(run)].sort());assert.equal(response.body.totalRuns,0);
 assert.doesNotMatch(JSON.stringify(response.body),/FORGED_SPOKEN_LINE|FORGED_RESULT|FORGED_LOCKED_TITLE/);
 for(const extra of [{quote:'FORGED_SPOKEN_LINE'},{line:'FORGED_SPOKEN_LINE'},{effect:'promotion'},{outcome:'support'},{affinityDelta:12},{choiceIndex:0},{result:'FORGED_RESULT'}]){
  const rejected=await h.post(player,route,randomUUID(),[...prefix,{...action,...extra}]);assert.equal(rejected.status,400);assert.equal(rejected.body.error,'invalid_actions');
 }
 for(const extra of [{phase:'later'},{phase:action.phase==='event'?'result':'event'},{eventId:'onboarding'}]){
  const rejected=await h.post(player,route,randomUUID(),[...prefix,{...action,...extra}]);assert.equal(rejected.status,400);assert.match(rejected.body.error,/invalid_actions|invalid_replay/);
 }
 const incomplete=await h.post(player,route,randomUUID(),route.baseActions,'/api/complete',{endingId:'nasdaq-executive',title:'FORGED_LOCKED_TITLE',completed:true});
 assert.equal(incomplete.status,400);assert.equal(incomplete.body.error,'incomplete_run');assert.equal((await h.call('/api/stats')).body.totalRuns,0);
 const decision=routes.find(route=>route.kind==='decision'&&route.sourceEventId==='salary-cut'),decisionPlayer=await h.register();assert.ok(decision);
 const injected=decision.actions.map(action=>action.type==='choice'&&action.eventId==='verbal-v2-decision'?{...action,sourceIndex:999,effect:'nasdaq',result:'FORGED_RESULT'}:action);
 const actual=replay(decision),decided=await h.post(decisionPlayer,decision,randomUUID(),injected);
 assert.equal(decided.status,200);assert.deepEqual(decided.body.characters,deriveCharacterStats(actual));assert.deepEqual([...ids(decided)].sort(),[...deriveAchievements(actual)].sort());
 assert.ok(actual.history.some(entry=>entry.eventId==='salary-cut'&&entry.choiceIndex===decision.sourceIndex),'the server resolves the authored explicit decision, not a client-supplied source index');
});

test('only a present group target can speak back; ownership, target forks and repeat source actions cannot alter a committed run',async t=>{
 const h=harness(t),player=await h.register(),other=await h.register(),route=row('group-event-sonny'),runId=randomUUID(),accepted=await h.post(player,route,runId);assert.equal(accepted.status,200);
 const before=deriveCharacterStats(replay(route,route.baseActions));
 for(const character of accepted.body.characters){const previous=before.find(entry=>entry.id===character.id);assert.equal(character.encounters,previous.encounters+Number(character.id===route.target));if(character.id!==route.target)assert.deepEqual(character,previous);}
 const action=route.actions.findLast(action=>action.type==='verbal'),position=route.actions.lastIndexOf(action),prefix=route.actions.slice(0,position);
 const fork=[...prefix,{...action,target:'erich'}];assert.doesNotThrow(()=>replay(route,fork));assert.equal((await h.post(player,route,runId,fork)).status,409);
 for(const target of ['wing','self','unknown',null,1,[]]){
  const rejected=await h.post(player,route,randomUUID(),[...prefix,{...action,target}]);assert.equal(rejected.status,400,JSON.stringify(target));assert.match(rejected.body.error,/invalid_actions|invalid_replay/);
 }
 const solo=row('work-event'),soloAction=solo.actions.findLast(action=>action.type==='verbal'),soloIndex=solo.actions.lastIndexOf(soloAction);
 assert.equal((await h.post(player,solo,randomUUID(),[...solo.actions.slice(0,soloIndex),{...soloAction,target:solo.target}])).status,400,'explicit target is forbidden in a solo conversation');
 assert.equal((await h.post(player,route,randomUUID(),[...route.actions,action])).status,400,'replaying the same source does not resolve it twice');
 for(const path of ['/api/characters','/api/achievements'])assert.equal((await h.post(other,route,runId,route.actions,path)).status,409);
 assert.equal((await h.call('/api/characters',{method:'POST',body:proof(route)})).status,401);
 const snapshot=await h.call('/api/me',{token:player.token});assert.deepEqual(snapshot.body.characters,accepted.body.characters);assert.deepEqual(snapshot.body.achievements,accepted.body.achievements);
 const isolated=await h.call('/api/me',{token:other.token});assert.equal(isolated.body.totalRuns,0);assert.deepEqual(isolated.body.achievements,[]);assert.ok(isolated.body.characters.every(character=>CHARACTER_METRICS.every(metric=>character[metric]===0)));
});

test('the actual spoken work response consumes its source once and a result-phase interruption preserves the committed answer',async t=>{
 const h=harness(t);
 for(const id of ['work-event','work-result','pip-work-event','pip-pip-review-event','pip-pip-passed-event','salary-salary-cut-event','salary-raise-request-event','banquet-banquet-welcome-event','banquet-banquet-draw-event']){
  const route=row(id),run=replay(route),release=speech(run),player=await h.register(),response=await h.post(player,route,randomUUID());assert.equal(response.status,200,id);
  assert.equal(release.verbalOutcome.version,2);assert.equal(release.verbalOutcome.origin,route.sourceEventId);assert.equal(release.choiceText,route.quote);
  if(route.kind==='work'&&route.phase==='event'){
   const base=replay(route,route.baseActions),event=engine.getEvent(base);assert.equal(release.eventId,route.sourceEventId);assert.equal(release.kind,event.kind);assert.equal(release.choiceIndex,event.choices.length);
   assert.equal(run.history.filter(entry=>entry.eventId===route.sourceEventId).length,base.history.filter(entry=>entry.eventId===route.sourceEventId).length+1);
   assert.equal(run.turn,base.turn+1);assert.notEqual(run.eventId,route.sourceEventId);
  }
  if(route.phase==='result'){
   const original=route.baseActions.at(-1);assert.equal(original.type,'choice');
   const matching=run.history.filter(entry=>entry.eventId===original.eventId&&entry.choiceIndex===original.index);assert.equal(matching.length,1);
   assert.equal(run.actions.filter(action=>action.type==='choice'&&action.eventId===original.eventId&&action.index===original.index).length,1);
  }
 }
 const quotes=routes.filter(route=>route.kind==='quote');assert.ok(quotes.length>=2);assert.ok(new Set(quotes.map(route=>route.sourceEventId)).size>=2);assert.ok(new Set(quotes.map(route=>route.quote)).size>=2,'the same character gets actual scene-specific wording');
 const unpicked=row('work-unpicked-first-flags'),before=replay(unpicked,unpicked.baseActions),event=engine.getEvent(before),after=replay(unpicked);assert.ok(event.choices[0].flags.length);
 for(const flag of event.choices[0].flags)assert.equal(after.flags[flag]||0,before.flags[flag]||0,`speaking is not choosing the original first answer: ${flag}`);
});
