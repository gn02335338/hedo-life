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
import {EVENTS} from '../dist/events.js';
import {CHARACTER_IDS,CHARACTER_METRICS,deriveCharacterStats} from '../dist/character-stats.js';
import {deriveAchievements} from '../dist/achievements.js';

const source=readFileSync(new URL('../worker/index.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export class HedoArchive','globalThis.HedoArchive=class HedoArchive').replace('export default','globalThis.worker=');
const fixture=JSON.parse(readFileSync(new URL('./fixtures/cast-player-routes-v35.json',import.meta.url),'utf8'));
const {routes}=fixture;
const proof=(route,runId,actions=route.actions)=>({runId,roleId:route.roleId,seed:route.seed,actions});
function harness(t){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());db.exec('PRAGMA foreign_keys = ON');
 const sql={exec(query,...args){let rows=[];if(!args.length&&query.includes(';'))db.exec(query);else{const statement=db.prepare(query);if(statement.columns().length)rows=statement.all(...args);else statement.run(...args);}return{toArray:()=>rows,one:()=>{assert.equal(rows.length,1);return rows[0];}};}};
 const storage={sql,transactionSync(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}},async getAlarm(){return null;},async setAlarm(){}};
 const context=vm.createContext({DurableObject:class{constructor(ctx){this.ctx=ctx;}},replayRun:engine.replayRun,VERSION:engine.VERSION,MAX_TURNS:engine.MAX_TURNS,ROLE_MAP,ENDINGS,...http,validateFeedback,validatePublisherToken,FeedbackStore,AchievementStore,CharacterStore,ObservationStore,crypto,Response,Request,URL,Date});
 vm.runInContext(source,context);const archive=new context.HedoArchive({storage,blockConcurrencyWhile:fn=>fn()},{ });
 const call=async(path,{method='GET',token,body}={})=>{
  archive.rate=new http.RateGuard();const headers={};if(token)headers.Authorization=`Bearer ${token}`;if(body)headers['Content-Type']='application/json';
  const response=await archive.fetch(new Request(`https://game.example${path}`,{method,headers,body:body?JSON.stringify(body):undefined}));return{status:response.status,body:await response.json()};
 };
 const register=async()=>{const token=randomBytes(32).toString('hex'),response=await call('/api/player',{method:'POST',body:{token}});assert.equal(response.status,200);return{token,id:response.body.playerId};};
 const post=(player,route,runId,actions=route.actions,path='/api/characters',extra={})=>call(path,{method:'POST',token:player.token,body:{...proof(route,runId,actions),...extra}});
 return{sql,call,register,post};
}


const projection=(response,run,{badges=false}={})=>{
 assert.equal(response.status,200);assert.deepEqual(response.body.characters,deriveCharacterStats(run));
 if(badges)assert.deepEqual(response.body.achievements.map(row=>row.id).sort(),deriveAchievements(run).sort());
};
const coverage=new Set(fixture.newEventCoverage);

test('natural e35 cast lives cover every offered occupation and server-verified story interactions without invented counters',async t=>{
 const h=harness(t),roles=new Set(),encountered=new Set();
 const totals=Object.fromEntries(CHARACTER_IDS.map(id=>[id,Object.fromEntries(CHARACTER_METRICS.map(key=>[key,0]))]));
 assert.ok(routes.length>=13);assert.ok(coverage.size>=180,'representative natural lives cover most newly authored scenes');
 for(const route of routes){
  assert.match(route.seed,/^e35-/);roles.add(route.roleId);
  const run=engine.replayRun(route.roleId,route.seed,route.actions);
  assert.equal(engine.validRun(run),true);assert.equal(run.completed,true);assert.equal(run.endingId,route.ending);assert.equal(run.turn,route.turns);
  assert.deepEqual(deriveCharacterStats(run),route.expectedCharacterStats);assert.deepEqual(deriveAchievements(run),route.expectedAchievements);
  for(const id of route.newScenes)encountered.add(id);
  const player=await h.register(),runId=randomUUID();
  const next=route.actions.findIndex(action=>action.type==='choice'&&coverage.has(action.eventId));assert.ok(next>=0,'each representative meets the expanded cast');
  const prefix=route.actions.slice(0,next+1),ongoing=engine.replayRun(route.roleId,route.seed,prefix);
  const supplied={endingId:'nasdaq-system',stats:{cash:100,mood:100},characters:[{id:'wing',encounters:99999,affinityGained:99999}],flags:{promotions:999},rule_cohort:1,achievements:['nasdaq']};
  projection(await h.post(player,route,runId,prefix,'/api/characters',supplied),ongoing);
  projection(await h.post(player,route,runId,prefix,'/api/achievements',supplied),ongoing,{badges:true});
  const first=await h.post(player,route,runId,route.actions,'/api/complete',supplied);projection(first,run,{badges:true});
  assert.equal(first.body.endingId,route.ending);assert.equal(first.body.totalRuns,1);assert.equal(first.body.duplicate,false);
  const retry=await h.post(player,route,runId,route.actions,'/api/complete');projection(retry,run,{badges:true});assert.equal(retry.body.duplicate,true);assert.equal(retry.body.totalRuns,1);
  assert.deepEqual(retry.body.characters,first.body.characters);
  const observed=h.sql.exec('SELECT rule_cohort,career_scheme,final_rank FROM run_observations WHERE run_id=?',runId).one();
  assert.deepEqual({...observed},{rule_cohort:35,career_scheme:'full8',final_rank:run.rank});
  for(const row of deriveCharacterStats(run))for(const key of CHARACTER_METRICS)totals[row.id][key]+=row[key];
 }
 assert.deepEqual(roles,new Set(Object.keys(ROLE_MAP)));assert.deepEqual(encountered,coverage);
 const global=await h.call('/api/characters');assert.equal(global.status,200);
 for(const row of global.body.characters)for(const key of CHARACTER_METRICS)assert.equal(row[key],totals[row.id][key],`${row.id}/${key}`);
 assert.doesNotMatch(JSON.stringify(global.body),/playerId|runId|seed|actions|newScenes/);
 const stats=await h.call('/api/stats');assert.equal(stats.status,200);assert.equal(stats.body.totalRuns,routes.length);
 assert.equal(stats.body.observatory.recordedRuns,routes.length);assert.equal(stats.body.observatory.unclassifiedRuns,0);
});

test('e35 expanded-cast actions cannot be skipped, forked or claimed by another anonymous player',async t=>{
 const h=harness(t),player=await h.register(),other=await h.register(),route=routes[0],runId=randomUUID();
 const index=route.actions.findIndex(action=>action.type==='choice'&&coverage.has(action.eventId));assert.ok(index>=0);
 const actions=route.actions.slice(0,index+1),run=engine.replayRun(route.roleId,route.seed,actions);
 projection(await h.post(player,route,runId,actions),run);
 const foreign=await h.post(other,route,runId,actions);assert.equal(foreign.status,409);
 const different=routes.find(candidate=>candidate.seed!==route.seed);assert.ok(different);
 const fork=await h.post(player,different,runId,different.actions);assert.equal(fork.status,409);
 const skipped=await h.post(other,route,randomUUID(),[route.actions[index]]);assert.equal(skipped.status,400);
 const me=await h.call('/api/me',{token:other.token});assert.equal(me.status,200);assert.equal(me.body.totalRuns,0);assert.ok(me.body.characters.every(row=>CHARACTER_METRICS.every(key=>row[key]===0)));
 assert.equal((await h.call('/api/stats')).body.totalRuns,0);
});


// These prefixes were actually played by the visible-text audit. Branch only
// through public rage/verbal actions; no stats, targets or RNG state are injected.
test('all seven new co-present groups keep every physical participant selectable and server-verified in event and result phases',async t=>{
 const h=harness(t),groups=EVENTS.filter(event=>event.minRules===35&&event.participants?.length>1);
 assert.equal(groups.length,7);
 let branches=0,results=0;
 for(const group of groups){
  const route=routes.find(candidate=>candidate.actions.some(action=>action.type==='choice'&&action.eventId===group.id));
  assert.ok(route,`natural fixture missing ${group.id}`);
  const position=route.actions.findIndex(action=>action.type==='choice'&&action.eventId===group.id);
  const source=engine.replayRun(route.roleId,route.seed,route.actions.slice(0,position));
  assert.equal(engine.validRun(source),true);assert.equal(source.eventId,group.id);assert.equal(source.pending,false);
  assert.deepEqual(engine.getEvent(source).participants,group.participants);
  const sources=[['event',source],['result',engine.applyChoice(source,0)]];
  for(const [phase,base]of sources){
   assert.equal(engine.validRun(base),true,`${group.id}/${phase}`);
   assert.equal(engine.canRequestRage(base),true,`${group.id}/${phase}: rage available`);
   assert.equal(engine.canRequestVerbal(base),true,`${group.id}/${phase}: verbal available`);
   const before=JSON.stringify(base);
   assert.deepEqual(engine.getRageTargets(base),group.participants);
   assert.deepEqual(engine.getVerbalTargets(base),group.participants);
   assert.equal(engine.requestRage(base,'wing'),base,'an absent boss is not an allowed physical target');
   assert.equal(engine.requestVerbal(base,'wing',2),base,'an absent boss is not an allowed spoken target');
   assert.equal(JSON.stringify(base),before,'reading targets or declining an invalid selection does not commit, advance or draw');
   for(const target of group.participants)for(const kind of ['rage','verbal']){
    const committed=kind==='rage'?engine.requestRage(base,target):engine.requestVerbal(base,target,2);
    assert.notEqual(committed,base);assert.equal(engine.validRun(committed),true,`${group.id}/${phase}/${kind}/${target}: pending`);
    const action=committed.actions.at(-1);
    assert.equal(action.type,kind);assert.equal(action.target,target);assert.equal(action.phase,phase);assert.equal(action.eventId,group.id);
    assert.equal(committed.actions.length,base.actions.length+1);
    const resolved=engine.advance(committed);assert.equal(engine.validRun(resolved),true,`${group.id}/${phase}/${kind}/${target}: resolved`);
    assert.deepEqual(engine.replayRun(route.roleId,route.seed,resolved.actions),resolved);
    if(kind==='rage'){
     const row=resolved.history.findLast(item=>item.eventId==='rage-release');assert.ok(row);assert.equal(row.speaker,target);
     assert.ok(['腦內劇場','真的失控了'].includes(row.eventOutcome?.result));
     const prior=deriveCharacterStats(base),after=deriveCharacterStats(resolved);
     for(const guest of CHARACTER_IDS){
      const a=after.find(item=>item.id===guest),b=prior.find(item=>item.id===guest);
      assert.equal(a.imaginedHits-b.imaginedHits,Number(guest===target&&row.eventOutcome.result==='腦內劇場'));
      assert.equal(a.realHits-b.realHits,Number(guest===target&&row.eventOutcome.result==='真的失控了'));
     }
    }else{
     const row=resolved.history.findLast(item=>item.verbalOutcome?.version===2);assert.ok(row);assert.equal(row.verbalOutcome.target,target);assert.equal(row.speaker,target);
     assert.equal(row.verbalOutcome.origin,group.id);assert.equal(row.verbalOutcome.phase,phase);
     assert.ok(deriveCharacterStats(resolved).every(item=>item.realHits===0&&item.imaginedHits===0),'speaking never earns physical or dream hits');
    }
    const player=await h.register(),runId=randomUUID(),payload={target:'wing',characters:[{id:'wing',realHits:999,affinityGained:999}],result:'forged'};
    projection(await h.post(player,route,runId,resolved.actions,'/api/characters',payload),resolved);
    projection(await h.post(player,route,runId,resolved.actions,'/api/achievements',payload),resolved,{badges:true});
    projection(await h.post(player,route,runId,resolved.actions),resolved);
    const absent={type:kind,phase,eventId:group.id,target:'wing',...(kind==='verbal'?{version:2}:{})};
    const rejected=await h.post(player,route,randomUUID(),[...base.actions,absent]);assert.equal(rejected.status,400,'known but absent people cannot be selected through API');
    const me=await h.call('/api/me',{token:player.token});projection(me,resolved);assert.equal(me.body.totalRuns,0);
    branches++;results+=Number(phase==='result');
   }
  }
 }
 assert.equal(branches,64);assert.equal(results,32);
 assert.equal((await h.call('/api/stats')).body.totalRuns,0,'branches remain in-progress character/achievement proofs');
});
