import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as E from '../dist/engine.js';
import {renderActivityPlayHTMLV55,mountActivityPlayV55} from '../dist/activity-play-ui-v55.js';
import {renderCamelActivityResultV65,dietTeamHTMLV65} from '../dist/activity-play-view-v65.js';
import {createAppHarnessV63,plain} from './app-ui-harness-v63.mjs';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/expansion-v65.json',import.meta.url),'utf8'));
const route=id=>{const row=fixture.routes.find(row=>row.id===id);assert.ok(row,id);return row;},source=id=>{const row=route(id);return E.replayRun(row.roleId,row.seed,row.actions);};
function controls(run,onCommit){
 const events=new Map(),documentEvents=new Map(),frames=new Map(),nodes=new Map(),commits=[];
 const node=selector=>{if(!nodes.has(selector))nodes.set(selector,{textContent:'',innerHTML:'',focus(){},setAttribute(){},disabled:false});return nodes.get(selector);};
 const doc={activeElement:null,hidden:false,addEventListener:(key,fn)=>documentEvents.set(key,fn),removeEventListener:(key,fn)=>{if(documentEvents.get(key)===fn)documentEvents.delete(key);},defaultView:{performance:{now:()=>0},requestAnimationFrame:fn=>{frames.set(1,fn);return 1;},cancelAnimationFrame:id=>frames.delete(id)}};
 const panel={ownerDocument:doc,innerHTML:renderActivityPlayHTMLV55(run,E.getEvent(run)),matches:()=>true,contains:()=>true,querySelector:node,querySelectorAll:()=>[],addEventListener:(key,fn)=>events.set(key,fn),removeEventListener:(key,fn)=>{if(events.get(key)===fn)events.delete(key);}};
 const cleanup=mountActivityPlayV55({root:panel,run,event:E.getEvent(run),onCommit:input=>{commits.push(input);return onCommit?onCommit(input):true;}});
 const click=(command,value)=>{const target={dataset:{playCommand:command,...(value===undefined?{}:{playValue:String(value)})},disabled:false};events.get('click')?.({target:{closest:()=>target},stopPropagation(){}});};
 return{panel,commits,events,documentEvents,frames,cleanup,click,nodes};
}

test('Camel offers an accessible untimed board, a rank plan and one support choice without leaking the next draw',()=>{
 const run=source('camel-play-0'),snapshot=JSON.stringify(run),html=renderActivityPlayHTMLV55(run,E.getEvent(run));
 assert.match(html,/已揭曉 0 \/ 6 輪/);assert.match(html,/由下往上/);assert.match(html,/紙名牌/);assert.match(html,/整場預測/);assert.match(html,/第 1 輪，你猜誰會領先/);
 assert.equal((html.match(/data-play-command="camel-support"/g)||[]).length,3);assert.equal((html.match(/data-play-command="camel-(?:up|down)"/g)||[]).length,6);
 assert.match(html,/data-play-command="commit" disabled/);assert.doesNotMatch(html,/data-play-command="start"|camel-result-v65|"bag"|"ticket"|"finalHits"|"die"|"color"|successRate|勝率|好感.*[+-]\d/);assert.equal(JSON.stringify(run),snapshot);
});

test('ranking, support and reset remain local; one explicit submit sends only the strict raw input',()=>{
 const run=source('camel-play-0'),saved=JSON.stringify(run),ui=controls(run);ui.click('commit');assert.equal(ui.commits.length,0);
 ui.click('camel-up',2);ui.click('camel-down',0);ui.click('camel-support',1);assert.equal(ui.commits.length,0);assert.equal(JSON.stringify(run),saved);assert.match(ui.panel.innerHTML,/這輪先支持強哥/);
 ui.click('reset');assert.match(ui.panel.innerHTML,/data-play-command="commit" disabled/);ui.click('camel-up',2);ui.click('camel-down',0);ui.click('camel-support',1);ui.click('commit');ui.click('commit');
 assert.deepEqual(ui.commits,[{kind:'camel',move:1,prediction:[2,0,1]}]);assert.equal(E.validRun(E.applyActivityPlay(run,ui.commits[0])),true);assert.equal(ui.frames.size,0);ui.cleanup();assert.equal(ui.events.size,0);assert.equal(ui.documentEvents.size,0);
});

test('later rounds preserve the sealed prediction while cleaned or rejected views cannot submit a stale draft',async()=>{
 const run=source('camel-play-2'),ui=controls(run,()=>false);assert.doesNotMatch(ui.panel.innerHTML,/data-play-command="camel-(?:up|down)"/);assert.match(ui.panel.innerHTML,/已經封存|已在第一輪送出/);
 ui.click('camel-up',2);ui.click('camel-support',0);ui.click('commit');await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(ui.commits[0],{kind:'camel',move:0,prediction:[2,1,0]});assert.match(ui.nodes.get('[data-play-feedback]').textContent,/進度已有變動/);
 ui.cleanup();ui.click('commit');assert.equal(ui.commits.length,1);assert.equal(ui.frames.size,0);assert.equal(run.activityContext.camel.round,2);
});

test('only committed Camel results reveal dice, the new board, points and final ranking',()=>{
 for(let round=1;round<=6;round++){
  const row=source(`camel-round-${round}`).history.at(-1),c=row.activityOutcome.camel,html=renderCamelActivityResultV65(row);
  assert.match(html,new RegExp(`第${round}輪已揭曉賽況`));assert.ok(html.includes(`走 ${c.die} 格`));assert.ok(html.includes(`目前活動點 ${c.points}`));assert.match(html,/camel-board/);assert.equal(html.includes('整場名次預測命中'),round===6);
  assert.doesNotMatch(renderCamelActivityResultV65(row,true),/class="camel-board"/,'compact history should not require another full board');
 }
 assert.equal(renderCamelActivityResultV65(source('camel-play-0').history.at(-1)),'');const bad=plain(source('camel-round-1').history.at(-1));bad.activityOutcome.camel.die=99;assert.equal(renderCamelActivityResultV65(bad),'');
});

test('each diet team appears with its chosen calendar and the raw seven-day controls remain unchanged',()=>{
 for(const id of ['johnny','annie_yu','sonny']){
  const run=source(`diet-play-${id}`),ui=controls(run),html=ui.panel.innerHTML;assert.match(html,/傑克揪的比賽/);assert.equal((html.match(/aria-current="true"/g)||[]).length,1);assert.match(html,/強尼隊/);assert.match(html,/安妮余隊/);assert.match(html,/阿福隊/);assert.equal((html.match(/data-play-command="diet-day"/g)||[]).length,7);
  ui.click('diet-meal',0);ui.click('diet-exercise',0);ui.click('diet-copy');ui.click('commit');assert.deepEqual(ui.commits[0],{kind:'diet',days:Array.from({length:7},()=>({meal:0,exercise:0}))});assert.equal(E.validRun(E.applyActivityPlay(run,ui.commits[0])),true);ui.cleanup();
 }
 const escaped=dietTeamHTMLV65({teams:[{id:'johnny',name:'<script>alert(1)</script>'},{id:'annie_yu',name:'A'},{id:'sonny',name:'S'}],team:'johnny'});assert.match(escaped,/&lt;script&gt;/);assert.doesNotMatch(escaped,/<script>/);
});

for(const mobile of [false,true]){
 const device=mobile?'mobile':'desktop';
 test(`${device}: actual app advances six rounds, shows only committed dice and rejects callbacks from the prior round`,async()=>{
  const app=await createAppHarnessV63(mobile);app.render(source('camel-play-0'));let previousCallback=null;
  for(let round=0;round<6;round++){
   assert.equal(E.getActivityPlayV55(app.state()).round,round);assert.match(app.html(),new RegExp(`第 ${round+1} 輪，你猜誰會領先`));const before=plain(app.state()),callback=app.playCallbacks.at(-1);
   if(previousCallback)assert.equal(previousCallback({kind:'camel',move:0,prediction:[0,1,2]}),false);
   app.choose(1);assert.deepEqual(plain(app.state()),before,'generic choices cannot bypass an interactive round');app.clickPlay('camel-support',round%3);app.clickPlay('commit');app.clickPlay('commit');
   assert.equal(app.state().pending,true);assert.equal(app.calls.play,round+1);assert.match(app.html(),/camel-result-v65/);assert.equal(app.state().history.filter(row=>row.activityOutcome?.camel).length,round+1);
   await app.action('next');assert.equal(app.state().pending,false);previousCallback=callback;
  }
  assert.equal(app.state().activityContext.stage,2);assert.equal(E.validRun(plain(app.state())),true);assert.match(app.html(),/真人駱駝大賽結束/);
 });
 test(`${device}: leaving an unsubmitted Camel draft cleans its handlers without drawing a die or completing the activity`,async()=>{
  const app=await createAppHarnessV63(mobile),run=source('camel-play-1');app.render(run);const callback=app.playCallbacks.at(-1);app.clickPlay('camel-support',2);const length=run.actions.length;
  await app.leave();assert.equal(app.calls.play,0);assert.equal(app.calls.departure,1);assert.equal(app.state().actions.length,length+1);assert.equal(callback({kind:'camel',move:2,prediction:[2,1,0]}),false);assert.equal(app.state().history.filter(row=>row.activityOutcome?.camel).length,1);
  await app.action('next');assert.ok(!app.state().activityContext);assert.equal(app.state().flags.activity44_camel_completed||0,0);assert.equal(app.state().turn,run.turn);
 });
}
