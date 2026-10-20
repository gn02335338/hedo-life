import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRun, requestRage, applyChoice, advance, replayRun } from '../dist/engine.js';

const base=(process.env.API_BASE||'http://127.0.0.1:4177').replace(/\/$/,'');
const origin=new URL(base);
if(!['localhost','127.0.0.1','[::1]'].includes(origin.hostname))throw new Error('Feature smoke writes test records; localhost only.');
const owner=randomBytes(32).toString('hex'),other=randomBytes(32).toString('hex');
async function call(path,auth,body){
 const response=await fetch(`${base}${path}`,{method:body?'POST':'GET',headers:{...(auth?{Authorization:`Bearer ${auth}`} :{}),...(body?{'Content-Type':'application/json',Origin:origin.origin}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const data=await response.json();return{status:response.status,data};
}
const expect=(response,status)=>{assert.equal(response.status,status,JSON.stringify(response.data));return response.data;};
expect(await call('/api/player',null,{token:owner}),200);
expect(await call('/api/player',null,{token:other}),200);
const before=expect(await call('/api/stats'),200);
let run=advance(applyChoice(requestRage(createRun('system',`e13-smoke-${Date.now()}`)),2));
const id=randomUUID(),proof={runId:id,roleId:run.roleId,seed:run.seed,actions:run.actions};
expect(await call('/api/achievements',null,proof),401);
const first=expect(await call('/api/achievements',owner,{...proof,achievements:['nasdaq'],stats:{mood:100}}),200);
assert.ok(first.achievements.some(row=>row.id==='rage-rick'));assert.ok(!first.achievements.some(row=>row.id==='nasdaq'));assert.equal(first.totalRuns,0);
const retry=expect(await call('/api/achievements',owner,proof),200);
assert.deepEqual(retry.newlyUnlocked,[]);assert.deepEqual(retry.achievements,first.achievements);
expect(await call('/api/achievements',other,proof),409);
assert.deepEqual(expect(await call('/api/me',other),200).achievements,[]);
expect(await call('/api/achievements',owner,{...proof,actions:[...proof.actions,{type:'choice',eventId:'forged-scene',index:0}]}),400);
expect(await call('/api/complete',owner,proof),400);
run=advance(applyChoice(run,2));assert.ok(run.completed);
const finished=expect(await call('/api/complete',owner,{...proof,actions:run.actions}),200);
assert.ok(finished.achievements.some(row=>row.id==='first-ending'));assert.equal(finished.totalRuns,1);

const routes=JSON.parse(readFileSync(new URL('../research/reachability-v3.json',import.meta.url),'utf8')).routes;
const route=routes.find(row=>row.actions.some(action=>action.eventId==='banquet-afterparty'));
assert.ok(route,'a natural banquet route must exist');
const index=route.actions.findIndex(action=>action.eventId==='banquet-afterparty');
const partyActions=[...route.actions.slice(0,index),{type:'choice',eventId:'banquet-afterparty',index:1}];
const party=replayRun(route.roleId,route.seed,partyActions);assert.ok(party.flags.kind_afterparty_ghost);
const ghost=expect(await call('/api/achievements',owner,{runId:randomUUID(),roleId:route.roleId,seed:route.seed,actions:partyActions}),200);
assert.ok(ghost.achievements.some(row=>row.id==='kind-ghost'));
assert.ok(ghost.achievements.some(row=>row.id==='banquet'));
const me=expect(await call('/api/me',owner),200);
assert.deepEqual(me.achievements,ghost.achievements);
assert.ok(!JSON.stringify(me).includes(route.seed));assert.ok(!Object.hasOwn(me,'actions'));
const after=expect(await call('/api/stats'),200);assert.equal(after.totalRuns,before.totalRuns+1);
assert.ok(!JSON.stringify(after).includes('rage-rick'));
console.log('e13 API smoke passed: partial replay-derived achievements, spoof rejection, idempotence, ownership, completed-game counting, rage choices, natural banquet/Kind ghost, and private transcripts.');
