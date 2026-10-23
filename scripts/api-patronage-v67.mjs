import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {replayRun,validRun} from '../dist/engine.js';
import {deriveCharacterStats} from '../dist/character-stats.js';
import {deriveAchievements} from '../dist/achievements.js';
import {deriveLeaderboardScoreV56} from '../dist/leaderboard-score-v56.js';

// This probe intentionally creates test completions and temporarily publishes
// their scores. Refuse remote hosts and redirects before making any request.
const base=(process.env.API_BASE||'http://127.0.0.1:4227').replace(/\/$/,''),parsed=new URL(base);
if(parsed.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(parsed.hostname)||parsed.pathname!=='/'||parsed.username||parsed.password||parsed.search||parsed.hash)throw new Error('This probe writes anonymous test records. Use only a local Wrangler HTTP origin.');
const fixture=JSON.parse(readFileSync(new URL('../tests/fixtures/patronage-lifecycle-v67.json',import.meta.url),'utf8'));
const sceneIds=['patronage67-education','patronage67-pay-review','patronage67-smalltalk'];
const all=fixture.routes.map(route=>({route,run:replayRun(route.roleId,route.seed,route.actions)}));
const selected=['normal','son','daughter'].map(kind=>{
 const candidates=all.filter(({route,run})=>route.kind===kind&&run.completed&&run.patronage).sort((a,b)=>sceneIds.filter(id=>b.run.history.some(row=>row.eventId===id)).length-sceneIds.filter(id=>a.run.history.some(row=>row.eventId===id)).length);
 assert.ok(candidates[0],`Missing completed ${kind} appointment evidence`);return candidates[0];
});
const seen=new Set(selected.flatMap(({run})=>run.history.map(row=>row.eventId)).filter(id=>sceneIds.includes(id)));
assert.deepEqual([...seen].sort(),[...sceneIds].sort(),'the three true completion proofs include all new event kinds');

let requests=0;
async function call(path,{method='GET',token,body}={}){
 requests++;
 const response=await fetch(`${base}${path}`,{method,redirect:'error',signal:AbortSignal.timeout(30000),headers:{...(token?{Authorization:`Bearer ${token}`}:{ } ),...(method!=='GET'?{Origin:parsed.origin,'Content-Type':'application/json'}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 assert.match(response.headers.get('Cache-Control')||'',/no-store/);
 return {status:response.status,body:await response.json()};
}
const expect=(response,status)=>assert.equal(response.status,status,JSON.stringify(response.body));
const health=await call('/api/health');expect(health,200);assert.deepEqual(health.body,{ok:true,version:3});
let snapshot=await call('/api/stats');expect(snapshot,200);const startTotal=snapshot.body.totalRuns,results=[];
for(const {route,run}of selected){
 assert.equal(validRun(run),true);assert.ok(run.pay>=180);assert.ok(run.stats.cash>1);
 const token=randomBytes(32).toString('hex'),runId=randomUUID(),proof={runId,roleId:route.roleId,seed:route.seed,actions:route.actions};
 const player=await call('/api/player',{method:'POST',body:{token}});expect(player,200);assert.equal(player.body.totalRuns,0);
 const forgedAction=await call('/api/complete',{method:'POST',token,body:{...proof,runId:randomUUID(),actions:[route.actions[0],{type:'patronage-appointment',version:67,title:'乾兒子',pay:499},...route.actions.slice(1)]}});
 expect(forgedAction,400);assert.equal(forgedAction.body.error,'invalid_actions');
 const forgedChoice=await call('/api/complete',{method:'POST',token,body:{...proof,runId:randomUUID(),actions:[route.actions[0],{type:'choice',eventId:'patronage-application',index:0},...route.actions.slice(1)]}});
 expect(forgedChoice,400);assert.equal(forgedChoice.body.error,'invalid_replay');
 const saved=await call('/api/complete',{method:'POST',token,body:{...proof,pay:499,salary:499,rank:7,stats:{cash:1,mood:1,energy:1,skill:100,slack:100,lick:100,boss:100,trust:100,dream:100},endingId:'nasdaq-ai',characterGender:'invented',patronage:{title:'董事長',fromPay:1,appointedPay:499},history:[]}});
 expect(saved,200);assert.equal(saved.body.recorded,true);assert.equal(saved.body.duplicate,false);assert.equal(saved.body.totalRuns,1);assert.equal(saved.body.endingId,run.endingId);
 assert.deepEqual(saved.body.characters,deriveCharacterStats(run));
 assert.deepEqual(saved.body.achievements.map(row=>row.id).sort(),[...deriveAchievements(run)].sort());
 const duplicate=await call('/api/complete',{method:'POST',token,body:proof});expect(duplicate,200);assert.equal(duplicate.body.duplicate,true);assert.equal(duplicate.body.totalRuns,1);assert.equal(duplicate.body.endingId,run.endingId);assert.deepEqual(duplicate.body.characters,saved.body.characters);
 const after=await call('/api/stats');expect(after,200);assert.equal(after.body.totalRuns,snapshot.body.totalRuns+1,'invalid and duplicate submissions never create extra runs');
 // The completion receipt deliberately omits private salary/stat fields.
 // Its persisted salary is observable through the public rounded aggregate.
 const previousTotal=snapshot.body.totalRuns,impliedPay=after.body.observatory.salary.average*(previousTotal+1)-snapshot.body.observatory.salary.average*previousTotal;
 const roundingBound=.051*(2*previousTotal+1);
 assert.ok(roundingBound<Math.abs(499-run.pay)/2,'use a fresh local archive for a decisive salary aggregate check');
 assert.ok(Math.abs(impliedPay-run.pay)<=roundingBound,`Stored salary follows the canonical ${run.pay}K replay, not submitted 499K`);
 const score=deriveLeaderboardScoreV56(run);
 let published=false;
 try{
  const ranked=await call('/api/leaderboard',{method:'POST',token,body:{...proof,nickname:`本機任用測試${route.kind==='normal'?'甲':route.kind==='son'?'乙':'丙'}`}});
  expect(ranked,200);published=true;assert.equal(ranked.body.published,true);assert.equal(ranked.body.entry.total,score.total);assert.deepEqual(ranked.body.entry.metrics,score.metrics);assert.equal(ranked.body.entry.metrics.cash,run.stats.cash);assert.notEqual(ranked.body.entry.metrics.cash,1);
  const mine=await call('/api/leaderboard/mine',{token});expect(mine,200);assert.equal(mine.body.entries.length,1);assert.deepEqual(mine.body.entries[0].metrics,score.metrics);
 }finally{
  if(published){const removed=await call(`/api/leaderboard/${runId}`,{method:'DELETE',token});expect(removed,200);assert.equal(removed.body.removed,true);}
 }
 const withdrawn=await call('/api/leaderboard/mine',{token});expect(withdrawn,200);assert.equal(withdrawn.body.entries.length,0);
 results.push({kind:route.kind,roleId:route.roleId,pay:run.pay,cash:run.stats.cash,replacementKinds:sceneIds.filter(id=>run.history.some(row=>row.eventId===id)),completed:true,duplicateIdempotent:true,forgedActionsRejected:true,clientMetadataIgnored:true,canonicalCashScore:true,temporaryLeaderboardEntryWithdrawn:true});
 snapshot=after;
}
assert.equal(snapshot.body.totalRuns,startTotal+3);
const report={ok:true,origin:parsed.origin,localOnly:true,completedRoutes:results.length,replacementKinds:[...seen].sort(),requests,results};
mkdirSync(new URL('../artifacts/',import.meta.url),{recursive:true});writeFileSync(new URL('../artifacts/api-patronage-v67.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
