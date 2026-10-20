import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {replayRun} from '../dist/engine.js';
import {CHARACTER_IDS,CHARACTER_METRICS,deriveCharacterStats} from '../dist/character-stats.js';

const base=(process.env.API_BASE||'http://127.0.0.1:4179').replace(/\/$/,'');
const origin=new URL(base);
if(origin.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(origin.hostname)||origin.port!=='4179'||origin.username||origin.password||origin.search||origin.hash||origin.pathname!=='/'){
 throw new Error('Group-rage smoke creates anonymous records; only localhost HTTP on port 4179 is allowed.');
}
const summary={localOnly:true,naturalCases:0,completedCases:0,rejectedForgeries:0,rejectedForks:0,rejectedCompletionForks:0,rateRetries:0};
const zero=()=>CHARACTER_IDS.map(id=>({id,...Object.fromEntries(CHARACTER_METRICS.map(key=>[key,0]))}));
const add=(...collections)=>CHARACTER_IDS.map(id=>({id,...Object.fromEntries(CHARACTER_METRICS.map(key=>[key,collections.reduce((sum,rows)=>sum+(rows.find(row=>row.id===id)?.[key]||0),0)]))}));
const metrics=run=>deriveCharacterStats(run);
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
const expect=(response,status)=>{assert.equal(response.status,status,JSON.stringify(response.data));return response.data;};
const proof=(route,runId,actions)=>({runId,roleId:route.roleId,seed:route.seed,actions});
const statsOf=payload=>metrics(replayRun(payload.roleId,payload.seed,payload.actions));
const data=JSON.parse(readFileSync(new URL('../tests/fixtures/rage-group-routes.json',import.meta.url),'utf8'));
assert.match(data.method,/no state injection|no injected|natural/i);
const cases=data.routes;
assert.equal(cases.length,12,'three present targets × event/result × imagined/real');
assert.equal(new Set(cases.map(route=>`${route.phase}/${route.target}/${route.mode}`)).size,12);
expect(await call('/api/health'),200);
const before=expect(await call('/api/characters'),200),expectedTotals=[],privateValues=[];
assert.equal(before.version,1);assert.ok(Number.isFinite(Date.parse(before.trackingSince)));

for(const route of cases){
 assert.ok(['erich','jenjen','sonny'].includes(route.target));assert.ok(['event','result'].includes(route.phase));assert.ok(['imagined','real'].includes(route.mode));
 assert.deepEqual(route.actions.slice(0,route.baseActions.length),route.baseActions,'the new target action extends the already committed prefix');
 assert.deepEqual(route.completionActions.slice(0,route.actions.length),route.actions,'completion continues the same chosen target');
 const rage=route.actions.at(-1);
 assert.deepEqual(Object.keys(rage).sort(),['type','phase','eventId','target'].sort());
 assert.equal(rage.type,'rage');assert.equal(rage.target,route.target);assert.equal(rage.phase,route.phase);
 const baseRun=replayRun(route.roleId,route.seed,route.baseActions),run=replayRun(route.roleId,route.seed,route.actions);
 const beforeRows=metrics(baseRun),afterRows=metrics(run);
 const release=run.history.findLast(row=>row.eventId==='rage-release');
 assert.equal(release.speaker,route.target);assert.equal(release.eventOutcome.result,route.mode==='imagined'?'腦內劇場':'真的失控了');
 for(const id of CHARACTER_IDS){
  const original=beforeRows.find(row=>row.id===id),next=afterRows.find(row=>row.id===id);
  if(id===route.target){
   assert.equal(next.encounters,original.encounters+1);
   assert.equal(next.imaginedHits,original.imaginedHits+(route.mode==='imagined'?1:0));
   assert.equal(next.realHits,original.realHits+(route.mode==='real'?1:0));
  }else assert.deepEqual(next,original,'unselected people do not receive another hit or encounter');
 }
 const token=randomBytes(32).toString('hex'),runId=randomUUID();
 const player=expect(await call('/api/player',null,{token}),200);assert.deepEqual(player.characters,zero());
 privateValues.push(token,runId,player.playerId,route.seed);
 const initial=proof(route,runId,route.baseActions),partial=proof(route,runId,route.actions),complete=proof(route,runId,route.completionActions);
 const first=expect(await call('/api/characters',token,initial),200);
 assert.equal(first.totalRuns,0);assert.deepEqual(first.characters,beforeRows);
 const extended=expect(await call('/api/characters',token,partial),200);
 assert.equal(extended.verified,true);assert.equal(extended.totalRuns,0);assert.deepEqual(extended.characters,afterRows);
 const achievement=expect(await call('/api/achievements',token,partial),200);
 assert.deepEqual(achievement.characters,afterRows);assert.equal(achievement.totalRuns,0);
 assert.deepEqual(expect(await call('/api/characters',token,partial),200).characters,afterRows);

 const alternative=['erich','jenjen','sonny'].find(id=>id!==route.target);
 const fork={...partial,actions:partial.actions.map((action,index)=>index===partial.actions.length-1?{...action,target:alternative}:action)};
 replayRun(fork.roleId,fork.seed,fork.actions); // A legal alternative cannot replace an already recorded branch.
 expect(await call('/api/characters',token,fork),409);summary.rejectedForks++;
 const outside={...partial,actions:partial.actions.map((action,index)=>index===partial.actions.length-1?{...action,target:'wing'}:action)};
 assert.throws(()=>replayRun(outside.roleId,outside.seed,outside.actions));
 expect(await call('/api/achievements',token,outside),400);summary.rejectedForgeries++;

 const completed=replayRun(complete.roleId,complete.seed,complete.actions);assert.equal(completed.completed,true);
 const recorded=expect(await call('/api/complete',token,complete),200);
 assert.equal(recorded.recorded,true);assert.equal(recorded.duplicate,false);assert.equal(recorded.totalRuns,1);
 assert.deepEqual(recorded.characters,metrics(completed));
 const repeated=expect(await call('/api/complete',token,complete),200);
 assert.equal(repeated.duplicate,true);assert.equal(repeated.totalRuns,1);assert.deepEqual(repeated.characters,metrics(completed));
 const changedCompletion={...complete,actions:complete.actions.map((action,index)=>index===route.baseActions.length?{...action,target:alternative}:action)};
 const alternativeEnding=replayRun(changedCompletion.roleId,changedCompletion.seed,changedCompletion.actions);
 assert.equal(alternativeEnding.completed,true,'an alternate in-room target remains valid play but cannot replace this completed UUID');
 expect(await call('/api/complete',token,changedCompletion),409);summary.rejectedCompletionForks++;
 expectedTotals.push(metrics(completed));summary.naturalCases++;summary.completedCases++;
}

const after=expect(await call('/api/characters'),200);
assert.equal(after.version,1);assert.equal(after.trackingSince,before.trackingSince);
assert.deepEqual(after.characters,add(before.characters,...expectedTotals),'prefix, achievements and completion each count one committed history');
assert.deepEqual(Object.keys(after).sort(),['version','characters','trackingSince'].sort());
for(const value of privateValues)assert.ok(!JSON.stringify(after).includes(value),'public aggregate contains no proof or identity');
summary.passed=true;summary.checkedAt=new Date().toISOString();
mkdirSync(new URL('../artifacts/feature-rage-group/',import.meta.url),{recursive:true});
writeFileSync(new URL('../artifacts/feature-rage-group/api-smoke.json',import.meta.url),JSON.stringify(summary,null,2)+'\n');
console.log(`Group-rage API smoke passed: ${summary.naturalCases} natural target/phase/mode cases, ${summary.completedCases} deduplicated completions, ${summary.rejectedForks} rejected same-run target changes, ${summary.rejectedCompletionForks} rejected completed-target replacements, ${summary.rejectedForgeries} rejected out-of-room targets, selected-only character counters and private aggregates; ${summary.rateRetries} rate retries.`);
