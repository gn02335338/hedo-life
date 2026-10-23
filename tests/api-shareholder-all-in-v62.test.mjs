import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as E from '../dist/engine.js';
import {ROLE_MAP} from '../dist/roles.js';
import {ENDINGS} from '../dist/endings.js';
import {AchievementStore} from '../worker/achievements.js';
import {CharacterStore} from '../worker/characters.js';
import {ObservationStore} from '../worker/observations.js';
import {FeedbackStore} from '../worker/feedback-store.js';
import {validateFeedback,validatePublisherToken} from '../worker/feedback.js';
import * as http from '../worker/http.js';
const {routes}=JSON.parse(readFileSync(new URL('./fixtures/shareholder-all-in-v62.json',import.meta.url),'utf8'));
const route=id=>routes.find(row=>row.id===id);
const proof=(row,runId=randomUUID())=>({runId,roleId:row.roleId,seed:row.seed,actions:row.actions});
function harness(t){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());db.exec('PRAGMA foreign_keys = ON');
 const sql={exec(query,...args){let rows=[];if(!args.length&&query.includes(';'))db.exec(query);else{const stmt=db.prepare(query);if(stmt.columns().length)rows=stmt.all(...args);else stmt.run(...args);}return {toArray:()=>rows,one:()=>{assert.equal(rows.length,1);return rows[0];}};}};
 const storage={sql,transactionSync(fn){db.exec('BEGIN IMMEDIATE');try{const value=fn();db.exec('COMMIT');return value;}catch(error){db.exec('ROLLBACK');throw error;}},async getAlarm(){return null;},async setAlarm(){}};
 const source=readFileSync(new URL('../worker/index.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export class HedoArchive','globalThis.HedoArchive=class HedoArchive').replace('export default','globalThis.worker=');
 const context=vm.createContext({DurableObject:class{constructor(ctx){this.ctx=ctx;}},replayRun:E.replayRun,VERSION:E.VERSION,MAX_TURNS:E.MAX_TURNS,ROLE_MAP,ENDINGS,...http,validateFeedback,validatePublisherToken,FeedbackStore,AchievementStore,CharacterStore,ObservationStore,crypto,Response,Request,URL,Date});
 vm.runInContext(source,context);const archive=new context.HedoArchive({storage,blockConcurrencyWhile:fn=>fn()},{});
 const call=async(path,{token,body}={})=>{archive.rate=new http.RateGuard();const headers={'Content-Type':'application/json'};if(token)headers.Authorization=`Bearer ${token}`;const response=await archive.fetch(new Request(`https://game.example${path}`,{method:'POST',headers,body:JSON.stringify(body)}));return {status:response.status,body:await response.json()};};
 const register=async()=>{const token=randomBytes(32).toString('hex');assert.equal((await call('/api/player',{body:{token}})).status,200);return token;};
 return {call,register};
}
test('the actual Worker accepts raw all-in, attendance and repayment proofs but never trusts client funding or debt values',async t=>{
 const h=harness(t),token=await h.register(),runId=randomUUID();
 for(const id of ['purchased','meeting-hearing','first-payment']){
  const row=route(id),result=await h.call('/api/characters',{token,body:{...proof(row,runId),shareholderLoan:{remaining:0,paid:48},cash:100,boss:100,shareholder58_owned:999}});
  assert.equal(result.status,200,`${id}: ${JSON.stringify(result.body)}`);
  assert.doesNotMatch(JSON.stringify(result.body),/shareholderLoan|shareholder58_owned|financing|loanPrincipal/);
 }
 const row=route('purchased'),replacement=row.actions.map(action=>action.eventId==='shareholder58-offer'&&action.type==='choice'?{...action,index:0}:action);
 const forkId=randomUUID();assert.equal((await h.call('/api/characters',{token,body:proof(row,forkId)})).status,200);
 assert.equal((await h.call('/api/characters',{token,body:{...proof(row,forkId),actions:replacement}})).status,409);
 const completed=route('completed-paid-off');
 assert.equal((await h.call('/api/complete',{token,body:{...proof(completed),shareholderLoan:{remaining:0},cash:100}})).status,200);
 const old={...proof(route('purchased')),seed:route('purchased').seed.replace('r62','r61')};
 assert.equal((await h.call('/api/characters',{token,body:old})).status,400);
});
