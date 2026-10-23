import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as E from '../dist/engine.js';
import {createAppHarnessV63,plain} from './app-ui-harness-v63.mjs';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/event-departure-v63.json',import.meta.url),'utf8')).routes;
const before=id=>{const row=fixture.find(row=>row.id===id);assert.ok(row,id);return E.replayRun(row.roleId,row.seed,row.beforeActions);};
const renderedView=app=>{const found=app.html().match(/data-action="event-departure" data-departure-view="(\d+)"/);assert.ok(found);return Number(found[1]);};

for(const mobile of [false,true]){
 const device=mobile?'mobile':'desktop';
 test(`${device}: ordinary, context-owned and specialized screens use their actual rendered revision and commit departure once`,async()=>{
  for(const id of ['work','shareholder-hearing','rest','treats','recruitment','hidden']){
   const app=await createAppHarnessV63(mobile);app.render(before(id));const source=plain(app.state()),view=renderedView(app);
   assert.equal(view,app.revision(),'the DOM button must use the revision assigned by view(), not the previous render');
   const button=app.html().match(/<button[^>]+data-action="event-departure"[^>]*>/)[0];assert.doesNotMatch(button,/ disabled/);assert.doesNotMatch(button,/delta|chance|\+\d+|\d+%/);
   const expected=E.requestEventDepartureV63(source);await app.leave(view);assert.deepEqual(plain(app.state()),plain(expected),id);assert.equal(app.state().pending,true);assert.equal(app.calls.departure,1);assert.equal(E.validRun(app.state()),true);
   assert.match(app.html(),/class="result-text"/);assert.match(app.html(),/data-action="next"/);assert.match(app.html(),/data-action="event-departure"[^>]+disabled/);
   const committed=plain(app.state());await app.leave(view);assert.deepEqual(plain(app.state()),committed);assert.equal(app.calls.departure,1,'the stale second click cannot call the engine again');assert.equal(app.choose(0),false);
   await app.action('next');assert.deepEqual(plain(app.state()),plain(E.advance(expected)),id);assert.equal(E.validRun(app.state()),true);
  }
 });

 test(`${device}: work-gap departure hides the next event and never spends a workday or answers it`,async()=>{
  const app=await createAppHarnessV63(mobile);app.render(before('gap'));const source=plain(app.state()),future=E.getEvent(source,true),html=app.html();
  assert.match(html,/data-work-gap/);assert.ok(!html.includes(future.title));assert.ok(!html.includes(future.body));assert.ok(!html.includes(`eventId="${source.eventId}"`));
  await app.leave();assert.deepEqual(plain(app.state().actions.at(-1)),{type:'event-departure',version:1,eventId:'work-gap-v50'});assert.equal(app.state().history.at(-1).departureOutcome.category,'gap');
  assert.equal(app.state().turn,source.turn);assert.deepEqual(plain(app.state().stats),source.stats);assert.ok(!app.html().includes(future.title));
  await app.action('next');assert.equal(E.isWorkGapOpenV50(app.state()),false);assert.equal(app.state().eventId,source.eventId);assert.equal(app.state().turn,source.turn);assert.deepEqual(plain(app.state().stats),source.stats);
 });

 test(`${device}: dialogs and stale page revisions block departure before any engine action or storage change`,async()=>{
  const app=await createAppHarnessV63(mobile);app.render(before('work'));const original=plain(app.state()),view=renderedView(app),saves=app.calls.save;
  app.node('#dialog').open=true;await app.leave(view);assert.deepEqual(plain(app.state()),original);assert.equal(app.calls.departure,0);assert.equal(app.calls.save,saves);
  app.node('#dialog').open=false;await app.leave(view-1);assert.deepEqual(plain(app.state()),original);assert.equal(app.calls.departure,0);
  await app.leave(view);assert.equal(app.state().pending,true);assert.equal(app.calls.departure,1);
 });

 test(`${device}: unsubmitted Roadshow drafts and running arm timers are cleaned without playing or completing them`,async()=>{
  for(const id of ['activity-roadshow-1','activity-arm-1']){
   const app=await createAppHarnessV63(mobile);app.render(before(id));const original=plain(app.state()),panel=app.node('[data-activity-play-v55]');
   if(id.includes('roadshow'))for(let i=0;i<6;i++){app.clickPlay('road-visitor',i);app.clickPlay('road-match',i%3);}else{app.clickPlay('start');assert.equal(app.frames.size,1);app.clickPlay('arm-tap');}
   assert.equal(app.calls.play,0);assert.deepEqual(plain(app.state()),original);const callback=app.playCallbacks.at(-1);assert.ok(callback);
   await app.leave();assert.equal(app.calls.play,0);assert.equal(panel.events.size,0);assert.equal(app.frames.size,0);assert.ok(!app.html().includes('data-activity-play-v55='));
   const saved=plain(app.state());assert.equal(callback({kind:'roadshow',matches:[0,1,2,1,0,2]}),false);assert.deepEqual(plain(app.state()),saved);assert.equal(app.calls.play,0);
   await app.action('next');assert.ok(!app.state().activityContext);assert.equal(app.state().flags[`activity44_${original.activityContext.id}`]||0,original.flags[`activity44_${original.activityContext.id}`]||0);assert.equal(app.state().actions.filter(row=>row.type==='activity-play').length,original.actions.filter(row=>row.type==='activity-play').length);
  }
 });

 test(`${device}: leaving onboarding explicitly declines the offer and the committed ending cannot be left again`,async()=>{
  const app=await createAppHarnessV63(mobile);app.render(before('onboarding'));await app.leave();assert.equal(app.state().completed,false);assert.equal(app.calls.complete,0);
  await app.action('next');assert.equal(app.state().completed,true);assert.match(app.html(),/你沒有接受這份任用/);assert.doesNotMatch(app.html(),/你主動提出離職|公司直接通知離場|data-action="event-departure"/);assert.equal(app.calls.complete,1);
  const completed=plain(app.state());await app.leave(0);assert.deepEqual(plain(app.state()),completed);assert.equal(app.calls.complete,1);assert.equal(E.validRun(app.state()),true);
 });
}
