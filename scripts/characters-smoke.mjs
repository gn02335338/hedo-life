import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {replayRun,getEvent} from '../dist/engine.js';
import {CHARACTER_IDS,CHARACTER_METRICS,deriveCharacterStats} from '../dist/character-stats.js';

const base=(process.env.API_BASE||'http://127.0.0.1:4178').replace(/\/$/,'');
const origin=new URL(base);
if(origin.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(origin.hostname)||origin.port!=='4178'||origin.username||origin.password||origin.search||origin.hash||origin.pathname!=='/'){
 throw new Error('Character smoke creates anonymous records; only a localhost HTTP origin on port 4178 is allowed.');
}
const summary={localOnly:true,rateRetries:0,naturalProofs:0,rejectedForks:0};
const zero=()=>CHARACTER_IDS.map(id=>({id,...Object.fromEntries(CHARACTER_METRICS.map(key=>[key,0]))}));
const add=(...collections)=>CHARACTER_IDS.map(id=>({id,...Object.fromEntries(CHARACTER_METRICS.map(key=>[key,collections.reduce((sum,rows)=>sum+(rows.find(row=>row.id===id)?.[key]||0),0)]))}));
async function call(path,token,body){
 for(let attempt=0;attempt<4;attempt++){
  const response=await fetch(`${base}${path}`,{
   method:body===undefined?'GET':'POST',redirect:'error',signal:AbortSignal.timeout(20_000),
   headers:{...(token?{Authorization:`Bearer ${token}`}:{}),...(body===undefined?{}:{Origin:origin.origin,'Content-Type':'application/json'})},
   ...(body===undefined?{}:{body:JSON.stringify(body)})
  });
  assert.match(response.headers.get('Cache-Control')||'',/no-store/);
  const data=await response.json();
  if(response.status!==429||attempt===3)return{status:response.status,data};
  const seconds=Number(response.headers.get('Retry-After'));
  assert.ok(Number.isFinite(seconds)&&seconds>=0&&seconds<=60,'bounded retry delay');
  summary.rateRetries++;await new Promise(resolve=>setTimeout(resolve,seconds*1000+100));
 }
}
const expect=(result,status)=>{assert.equal(result.status,status,JSON.stringify(result.data));return result.data;};
const proof=(route,actions=route.actions,runId=randomUUID())=>({runId,roleId:route.roleId,seed:route.seed,actions});
const stats=payload=>deriveCharacterStats(replayRun(payload.roleId,payload.seed,payload.actions));
const characterRows=data=>{
 assert.ok(Array.isArray(data.characters));assert.deepEqual(data.characters.map(row=>row.id),CHARACTER_IDS);
 for(const row of data.characters){assert.deepEqual(Object.keys(row).sort(),['id',...CHARACTER_METRICS].sort());for(const key of CHARACTER_METRICS)assert.ok(Number.isSafeInteger(row[key])&&row[key]>=0);}
 return data.characters;
};
async function player(){
 const token=randomBytes(32).toString('hex'),snapshot=expect(await call('/api/player',null,{token}),200);
 assert.deepEqual(characterRows(snapshot),zero());assert.equal(snapshot.totalRuns,0);
 return{token,playerId:snapshot.playerId};
}
function assertPrivate(data,secrets=[]){
 const serialized=JSON.stringify(data);
 for(const value of secrets)assert.ok(!serialized.includes(value),'aggregate does not expose identity or proof material');
 for(const key of ['playerId','token','seed','actions','history','runId','players','achievements'])assert.ok(!Object.hasOwn(data,key),`public characters do not expose ${key}`);
}

expect(await call('/api/health'),200);
const before=expect(await call('/api/characters'),200);
assert.equal(before.version,1);assert.ok(Number.isFinite(Date.parse(before.trackingSince)));
assert.deepEqual(Object.keys(before).sort(),['version','characters','trackingSince'].sort());characterRows(before);assertPrivate(before);
const a=await player(),b=await player();
expect(await call('/api/me'),401);

const report=JSON.parse(readFileSync(new URL('../research/reachability-v3.json',import.meta.url),'utf8'));
const route=report.routes.find(item=>item.ending==='mediation_settled-system');
assert.ok(route&&/^e20-/.test(route.seed),'a natural current personnel witness is required');
const runId=randomUUID(),first=proof(route,route.actions.slice(0,1),runId),extended=proof(route,route.actions.slice(0,2),runId),complete=proof(route,route.actions,runId);
assert.equal(replayRun(route.roleId,route.seed,complete.actions).completed,true);
expect(await call('/api/characters',null,first),401);
const started=expect(await call('/api/characters',a.token,{...first,characters:[{id:'wing',realHits:999999}]}),200);
assert.equal(started.verified,true);assert.equal(started.totalRuns,0);assert.deepEqual(characterRows(started),stats(first));summary.naturalProofs++;
assert.deepEqual(characterRows(expect(await call('/api/me',b.token),200)),zero(),'another player has no access to this private progress');

const continued=expect(await call('/api/achievements',a.token,extended),200);
assert.deepEqual(characterRows(continued),stats(extended));assert.equal(continued.totalRuns,0);summary.naturalProofs++;
const duplicate=expect(await call('/api/characters',a.token,extended),200);
assert.deepEqual(characterRows(duplicate),stats(extended));
const delayed=expect(await call('/api/characters',a.token,first),200);
assert.deepEqual(characterRows(delayed),stats(extended),'a delayed shorter proof does not subtract or add counters');

const prefixRun=replayRun(route.roleId,route.seed,first.actions),event=getEvent(prefixRun);
const alternative=event.choices.findIndex((choice,index)=>choice.available!==false&&index!==extended.actions[1].index);
assert.ok(alternative>=0);
const fork={...extended,actions:[...first.actions,{type:'choice',eventId:event.id,index:alternative}]};
replayRun(fork.roleId,fork.seed,fork.actions); // The alternative is legal play, but cannot replace an already recorded branch.
expect(await call('/api/characters',a.token,fork),409);summary.rejectedForks++;
expect(await call('/api/achievements',a.token,fork),409);summary.rejectedForks++;
expect(await call('/api/characters',b.token,extended),409);

const finished=expect(await call('/api/complete',a.token,complete),200);
assert.equal(finished.recorded,true);assert.equal(finished.duplicate,false);assert.equal(finished.totalRuns,1);
assert.deepEqual(characterRows(finished),stats(complete));summary.naturalProofs++;
const repeated=expect(await call('/api/complete',a.token,complete),200);
assert.equal(repeated.duplicate,true);assert.equal(repeated.totalRuns,1);assert.deepEqual(characterRows(repeated),stats(complete));
assert.deepEqual(characterRows(expect(await call('/api/characters',a.token,complete),200)),stats(complete));
assert.deepEqual(characterRows(expect(await call('/api/me',b.token),200)),zero());

const personnel=JSON.parse(readFileSync(new URL('../tests/fixtures/personnel-routes-v20.json',import.meta.url),'utf8')).routes;
const bExpected=[];
for(const mode of ['imagined','real']){
 const target=personnel.find(item=>item.id===`meimei-rage-${mode}`);assert.ok(target);
 const payload=proof(target),expected=stats(payload),result=expect(await call('/api/characters',b.token,payload),200);
 bExpected.push(expected);assert.deepEqual(characterRows(result),add(...bExpected));assert.equal(result.totalRuns,0);
 assert.equal(expected.find(row=>row.id==='meimei')[mode==='real'?'realHits':'imaginedHits'],1);summary.naturalProofs++;
}
assert.deepEqual(characterRows(expect(await call('/api/me',a.token),200)),stats(complete),'B progress does not change A personal counters');
const after=expect(await call('/api/characters'),200);
assert.equal(after.version,1);assert.equal(after.trackingSince,before.trackingSince);
assert.deepEqual(characterRows(after),add(before.characters,stats(complete),...bExpected),'progress, achievements, duplicates and completion count each resolved interaction once');
assertPrivate(after,[a.token,b.token,a.playerId,b.playerId,runId,route.seed]);
assert.deepEqual(expect(await call('/api/characters',a.token),200),after,'public aggregate is independent of bearer identity');

// A pre-feature completed row cannot be created through the current public API:
// new completions create their character proof atomically. Migration/unit tests
// cover rejection of historical backfill and the unchanged 200 duplicate path.
summary.passed=true;summary.checkedAt=new Date().toISOString();summary.characters=CHARACTER_IDS.length;
mkdirSync(new URL('../artifacts/feature-characters/',import.meta.url),{recursive:true});
writeFileSync(new URL('../artifacts/feature-characters/api-smoke.json',import.meta.url),JSON.stringify(summary,null,2)+'\n');
console.log(`Character API smoke passed: ${summary.naturalProofs} natural proofs, ten aggregate rows, authenticated personal isolation, append-only progress, ${summary.rejectedForks} rejected branch changes, shorter-proof no-op, completion deduplication and private public totals; ${summary.rateRetries} rate retries.`);
