import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as E from '../dist/engine.js';
import * as persona from '../dist/persona.js';
import * as titles from '../dist/job-titles-v42.js';
import * as princess from '../dist/princess-english-v47.js';
import * as arm from '../dist/arm-verbal-copy-v51.js';
import * as armScene from '../dist/arm-scene-ui-v51.js';
import * as contextCopy from '../dist/verbal-context-v52.js';
import {polishVerbalHistoryV41} from '../dist/verbal-presentation-v41.js';
import {isDeclinedArmSceneV66} from '../dist/scene-continuity-v66.js';
const rows=JSON.parse(readFileSync(new URL('./fixtures/verbal-context-v66.json',import.meta.url),'utf8')).routes;
const app=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8'),helpers=app.slice(app.indexOf('const playerTitle='),app.indexOf('const shownEnding='));

test('actual UI preview and history helpers retain r66 authored lines through event and result phases',()=>{
 assert.equal(rows.length,9);
 for(const route of rows)for(const phase of ['event','result']){
  const original=E.replayRun(route.roleId,route.seed,route.actions),source=phase==='result'?E.applyChoice(original,0):original;
  const event=E.getEvent(source),target=event.speaker,snapshot=structuredClone(source);assert.equal(E.validRun(source),true,route.id);assert.equal(E.canRequestVerbal(source),true,`${route.id}/${phase}`);
  const expected=E.getVerbalLine(source,target),sandbox=vm.createContext({...E,...persona,...titles,...princess,...arm,...armScene,...contextCopy,polishVerbalHistoryV41,run:source});
  vm.runInContext(`${helpers}\nglobalThis.preview=shownVerbalLine(run,'${target}');globalThis.project=shownHistory;`,sandbox);
  assert.equal(sandbox.preview,expected,`${route.id}/${phase}/preview`);
  const pending=E.requestVerbal(source,E.getVerbalTargets(source).length>1?target:undefined,2),raw=pending.history.at(-1);sandbox.run=pending;
  assert.equal(pending.verbalContext.line,expected);assert.equal(raw.choiceText,expected);assert.equal(sandbox.project(raw).choiceText,expected,`${route.id}/${phase}/history`);
  assert.equal(E.validRun(pending),true);assert.deepEqual(source,snapshot);
  const continued=E.advance(pending),past=continued.history[pending.history.length-1];sandbox.run=continued;assert.equal(sandbox.project(past).choiceText,expected,`${route.id}/${phase}/continued`);
  if(route.id==='arm-declined-video'){assert.equal(isDeclinedArmSceneV66(source,event),true);assert.match(event.body,/沒有到場記分/);assert.match(expected,/影片|座位/);assert.match(sandbox.project(past).choiceText,/影片|座位/);}
 }
});

test('the original after-hours Kind encounter stays private after a natural outburst rather than becoming an employment exit',()=>{
 const route=rows.find(row=>row.id==='voice-kind'),source=E.replayRun(route.roleId,route.seed,route.actions),event=E.getEvent(source);assert.equal(event.id,'cast66-kind-coat-check');assert.equal(event.scope,'private');
 const pending=E.requestVerbal(source,undefined,2);assert.equal(pending.pendingFamily,null);assert.ok(['ignored','relationship','retort','support','legal'].includes(pending.history.at(-1).verbalOutcome.kind));assert.equal(pending.flags.private39_verbal,1);assert.equal(E.validRun(pending),true);
});
