import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {EVENTS} from '../dist/events.js';
import * as E from '../dist/engine.js';
import {displayJanetSceneV70} from '../dist/janet-scene-copy-v70.js';

const scene=EVENTS.find(event=>event.id==='quiz26-white-team-wallet');
const routes=JSON.parse(await readFile(new URL('./fixtures/quiz-routes-v26.json',import.meta.url),'utf8')).routes.filter(row=>row.eventId===scene.id);
const replacement=value=>value.replaceAll('阿福找到聯絡窗口','阿福找到 Janet 一起核對').replaceAll('朋友有處理','Janet 有處理');

test('the actual white-team scene identifies Janet without modifying its source or choices',()=>{
 assert.ok(scene);const before=structuredClone(scene),shown=displayJanetSceneV70(scene);
 assert.match(shown.body,/財會主管 Janet，也就是阿福口中的「朋友」/);
 assert.doesNotMatch(shown.body,/朋友卻沒在工作群組/);
 assert.equal(shown.wing,'Janet 有幫忙啦，錢的部分我再跟她核對。');
 assert.equal(shown.choices,scene.choices);assert.deepEqual(scene,before);
 assert.equal(shown.speaker,scene.speaker);assert.equal(shown.id,scene.id);
 assert.equal(displayJanetSceneV70(shown),shown,'displayed copy is stable on a second render');
});

test('all three published quiz replays retain their outcomes, RNG suffixes and stored history',()=>{
 assert.equal(routes.length,3);
 for(const route of routes){
  const run=E.replayRun(route.roleId,route.seed,route.actions),before=structuredClone(run),raw=run.history.find(row=>row.eventId===scene.id),shown=displayJanetSceneV70(raw);
  assert.ok(raw);assert.equal(E.validRun(run),true);
  assert.match(shown.body,/財會主管 Janet/);assert.match(shown.wing,/跟她核對/);
  assert.equal(shown.result,replacement(raw.result));
  const authored=scene.choices[route.index].result;
  assert.ok(raw.result.startsWith(authored));const suffix=raw.result.slice(authored.length);
  assert.ok(suffix.length>0,'this real replay includes additional seeded outcome narration');
  assert.equal(shown.result.slice(replacement(authored).length),suffix);
  for(const key of ['delta','weather','chanceOutcome','breakdown','choiceIndex','speaker','pay'])assert.equal(shown[key],raw[key],key);
  assert.deepEqual(run,before);assert.equal(E.validRun(run),true);
 }
});

test('presentation preserves lazy outcome descriptors and never reads or clones hidden choice results',()=>{
 let reads=0;const hidden=()=>{reads++;throw new Error('Unrevealed choice was evaluated');};
 const choices=scene.choices.map(choice=>Object.defineProperties({...choice},{result:{get:hidden,enumerable:true,configurable:true},draw:{get:hidden,enumerable:true,configurable:true}}));
 const prototype={presentationRecord:true};
 const record=Object.create(prototype,{...Object.getOwnPropertyDescriptors(scene),choices:{value:choices,enumerable:true},result:{get:hidden,enumerable:true},secret:{get:hidden,enumerable:false}});
 const shown=displayJanetSceneV70(record);
 assert.equal(reads,0);assert.equal(shown.choices,choices);assert.equal(Object.getPrototypeOf(shown),prototype);
 for(const key of ['choices','result','secret'])assert.deepEqual(Object.getOwnPropertyDescriptor(shown,key),Object.getOwnPropertyDescriptor(record,key));
 assert.match(shown.body,/財會主管 Janet/);
 const entirelyLazy=Object.create(prototype,{...Object.getOwnPropertyDescriptors(scene),choices:{get:hidden,enumerable:true}}),lazyShown=displayJanetSceneV70(entirelyLazy);
 assert.equal(reads,0);assert.deepEqual(Object.getOwnPropertyDescriptor(lazyShown,'choices'),Object.getOwnPropertyDescriptor(entirelyLazy,'choices'));
});

test('unrelated scenes retain identity and a replaced verbal narration is not overwritten',()=>{
 const unrelated=EVENTS.find(event=>event.id!==scene.id);
 for(const value of [null,undefined,0,'',unrelated])assert.equal(displayJanetSceneV70(value),value);
 const exchanged={...scene,body:'已進入口角後續。',wing:'請先把話說清楚。'};
 assert.equal(displayJanetSceneV70(exchanged),exchanged);
});

test('the browser applies the correction to events and journals, while historical harnesses can omit it',async()=>{
 const app=await readFile(new URL('../dist/app.js',import.meta.url),'utf8'),wrappers=app.slice(app.indexOf('const shownEvent='),app.indexOf('const shownVerbalLine='));
 const identity=value=>value;
 const context={run:null,displayChronicleEvent:identity,displayChronicleHistory:identity};
 const old=vm.runInNewContext(wrappers+'({shownEvent,shownHistory})',context);
 assert.equal(old.shownEvent(scene),scene);
 const current=vm.runInNewContext(wrappers+'({shownEvent,shownHistory})',{...context,displayJanetSceneV70});
 assert.match(current.shownEvent(scene).body,/財會主管 Janet/);
 const route=routes[0],run=E.replayRun(route.roleId,route.seed,route.actions),row=run.history.find(item=>item.eventId===scene.id);
 assert.equal(current.shownHistory(row).result,replacement(row.result));
});
