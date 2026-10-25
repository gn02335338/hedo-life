import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {randomUUID,webcrypto} from 'node:crypto';
import * as E from '../dist/engine.js';
import {ROLE_MAP} from '../dist/roles.js';
import {CAST_IDS_V74} from '../dist/cast-v74.js';
import {CHARACTER_IDS,CHARACTER_METRICS,deriveCharacterStats} from '../dist/character-stats.js';
import {validateCompletion} from '../worker/http.js';

const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/cast-v74-natural.json',import.meta.url),'utf8'));
const source=key=>{const f=fixture.cases[key];return E.replayRun(f.roleId,f.seed,f.actions);};
const proof=run=>({runId:randomUUID(),roleId:run.roleId,seed:run.seed,actions:run.actions});
const rows=()=>CHARACTER_IDS.map(id=>({id,...Object.fromEntries(CHARACTER_METRICS.map(key=>[key,0]))}));
const cloudSource=fs.readFileSync(new URL('../dist/cloud.js',import.meta.url),'utf8').replace('export const cloud=','globalThis.cloud=');
function client(responder,savedEntries=[]){
 const saved=new Map([['hedo-anonymous-v1','1'.repeat(64)],...savedEntries]),requests=[],timers=new Map();let timer=0;
 const context=vm.createContext({Response,AbortSignal,structuredClone,crypto:webcrypto,localStorage:{getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value)},window:{addEventListener(){}},setTimeout:(fn,delay)=>{timers.set(++timer,{fn,delay});return timer;},clearTimeout:id=>timers.delete(id),fetch:async(path,options)=>{requests.push({path,authorization:options.headers.Authorization});return responder(path);}});
 vm.runInContext(cloudSource,context);return {cloud:context.cloud,saved,requests};
}
const snapshot=characters=>Response.json({playerId:'v74-synthetic-player',characters,achievements:[],unlocked:[],totalRuns:0,characterTrackingSince:'2026-10-25T00:00:00.000Z'});
const plain=value=>JSON.parse(JSON.stringify(value));

test('HTTP accepts all five strict-r74 target envelopes and rejects them from older, malformed or future profiles',()=>{
 for(const target of CAST_IDS_V74){
  const actions=[{type:'rage',phase:'event',eventId:'cast74-henry-party-camera',target},{type:'verbal',version:2,phase:'event',eventId:'cast74-henry-party-camera',target},{type:'patronage-reply',version:2,eventId:'cast74-henry-party-camera',target}];
  for(const action of actions){
   const base={runId:randomUUID(),roleId:'system',seed:'e39-r74-n-'+'a'.repeat(22),actions:[action]};
   assert.doesNotThrow(()=>validateCompletion(base,ROLE_MAP));
   for(const seed of ['e39-r73-n-'+'a'.repeat(22),'e39-r75-n-'+'a'.repeat(22),'e39-r74-x-'+'a'.repeat(22),'e39-r74-n-'+'a'.repeat(21),'e39-r74-n-'+'A'.repeat(22)])assert.throws(()=>validateCompletion({...base,seed},ROLE_MAP),error=>error.code==='invalid_actions');
  }
 }
});

test('HTTP-admitted group rage, verbal and authority actions replay canonically for the new characters',()=>{
 const before=source('private_group'),event=E.getEvent(before),targets=E.getRageTargets(before);
 assert.ok(targets.includes('henry')&&targets.includes('tony'));
 for(const target of ['henry','tony']){
  for(const invoke of [run=>E.requestRage(run,target),run=>E.requestVerbal(run,target,2),run=>E.requestPatronageReply(run,target)]){
   const pending=invoke(before);assert.notEqual(pending,before);const accepted=validateCompletion(proof(pending),ROLE_MAP),replayed=E.replayRun(accepted.roleId,accepted.seed,accepted.actions);
   assert.equal(E.validRun(replayed),true);const final=E.advance(pending);assert.deepEqual(replayed,final);assert.ok(deriveCharacterStats(replayed).find(row=>row.id===target).encounters>deriveCharacterStats(before).find(row=>row.id===target).encounters);
  }
 }
 // Envelope validation deliberately leaves room membership to replay.
 for(const action of [{type:'rage',phase:'event',eventId:event.id,target:'mia'},{type:'verbal',version:2,phase:'event',eventId:event.id,target:'mia'},{type:'patronage-reply',version:2,eventId:event.id,target:'mia'}]){
  const forged={...proof(before),actions:[...before.actions,action]};assert.doesNotThrow(()=>validateCompletion(forged,ROLE_MAP));assert.throws(()=>E.replayRun(forged.roleId,forged.seed,forged.actions));
 }
});

test('full authenticated v74 character rows are accepted and remain intact across an offline reload',async()=>{
 const current=rows().map((row,index)=>CAST_IDS_V74.includes(row.id)?{...row,encounters:index,affinityGained:8,affinityUpEvents:1}:row),live=client(()=>snapshot(current));
 await live.cloud.init();assert.deepEqual(plain(live.cloud.state.characters),current);assert.equal(live.requests[0].authorization,'Bearer '+'1'.repeat(64));
 const cached=JSON.parse(live.saved.get('hedo-character-cache-v1'));assert.equal(cached.characters.length,34);assert.ok(!JSON.stringify(cached).includes('1'.repeat(64)));
 const offline=client(()=>{throw new TypeError('offline');},[...live.saved]);await offline.cloud.init();assert.deepEqual(plain(offline.cloud.state.characters),current);assert.equal(offline.cloud.state.charactersVerifiedAt,cached.verifiedAt);
});

test('historical 22- and 29-person verified caches stay sparse until an authenticated expanded snapshot arrives',async()=>{
 for(const size of [22,29]){
  const legacy=rows().slice(0,size).map((row,index)=>({...row,encounters:index+1})),old=client(()=>snapshot(legacy));await old.cloud.init();
  const serialized=old.saved.get('hedo-character-cache-v1'),oldOwner=JSON.parse(serialized).ownerHash;let online=false;
  const full=[...legacy,...rows().slice(size)],next=client(()=>{if(!online)throw new TypeError('offline');return snapshot(full);},[...old.saved]);await next.cloud.init();
  assert.deepEqual(plain(next.cloud.state.characters),legacy);assert.equal(next.saved.get('hedo-character-cache-v1'),serialized);assert.ok(CAST_IDS_V74.every(id=>!next.cloud.state.characters.some(row=>row.id===id)));
  online=true;await next.cloud.retry();assert.deepEqual(plain(next.cloud.state.characters),full);assert.equal(JSON.parse(next.saved.get('hedo-character-cache-v1')).ownerHash,oldOwner);
 }
});

test('malformed supplied new rows cannot be silently dropped or replace a verified historical snapshot',async()=>{
 const legacy=rows().slice(0,29),old=client(()=>snapshot(legacy));await old.cloud.init();const serialized=old.saved.get('hedo-character-cache-v1');
 for(const target of CAST_IDS_V74){
  const invalid=rows().map(row=>row.id===target?{...row,realHits:-1}:row),live=client(()=>snapshot(invalid),[...old.saved]);await live.cloud.init();
  assert.deepEqual(plain(live.cloud.state.characters),legacy);assert.equal(live.saved.get('hedo-character-cache-v1'),serialized);
  const bad={...JSON.parse(serialized),characters:invalid},offline=client(()=>{throw new TypeError('offline');},[...old.saved,['hedo-character-cache-v1',JSON.stringify(bad)]]);await offline.cloud.init();assert.deepEqual(plain(offline.cloud.state.characters),[]);
 }
});
