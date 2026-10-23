import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as E from '../dist/engine.js';
import {renderActivityPlayHTMLV55,mountActivityPlayV55} from '../dist/activity-play-ui-v55.js';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/roadshow-v63.json',import.meta.url),'utf8')).routes;
const legacy=JSON.parse(readFileSync(new URL('./fixtures/activity-play-routes-v55.json',import.meta.url),'utf8')).routes;
const source=role=>{const row=fixture.find(row=>row.id===`${role}-play`);assert.ok(row,role);return E.replayRun(row.roleId,row.seed,row.actions);};
function controls(run){
 const events=new Map(),documentEvents=new Map(),frames=new Map(),nodes=new Map(),commits=[];
 const node=selector=>{if(!nodes.has(selector))nodes.set(selector,{textContent:'',innerHTML:'',focus(){},setAttribute(){},disabled:false});return nodes.get(selector);};
 const doc={activeElement:null,hidden:false,addEventListener:(key,fn)=>documentEvents.set(key,fn),removeEventListener:(key,fn)=>{if(documentEvents.get(key)===fn)documentEvents.delete(key);},defaultView:{performance:{now:()=>0},requestAnimationFrame:fn=>{frames.set(1,fn);return 1;},cancelAnimationFrame:id=>frames.delete(id)}};
 const panel={ownerDocument:doc,innerHTML:renderActivityPlayHTMLV55(run,E.getEvent(run)),matches:()=>true,contains:()=>true,querySelector:node,querySelectorAll:()=>[],addEventListener:(key,fn)=>events.set(key,fn),removeEventListener:(key,fn)=>{if(events.get(key)===fn)events.delete(key);}};
 const cleanup=mountActivityPlayV55({root:panel,run,event:E.getEvent(run),onCommit:input=>{commits.push(input);return true;}});
 const click=(command,value)=>{const target={dataset:{playCommand:command,...(value===undefined?{}:{playValue:String(value)})},disabled:false};events.get('click')?.({target:{closest:()=>target},stopPropagation(){}});};
 return {panel,commits,events,documentEvents,frames,cleanup,click};
}

test('all three natural professions render the descriptor’s speakers, six cards, instructions and option details',()=>{
 for(const role of ['sales','bd','design']){
  const run=source(role),before=JSON.stringify(run),descriptor=E.getActivityPlayV55(run),html=renderActivityPlayHTMLV55(run,E.getEvent(run));
  assert.equal(E.validRun(run),true);assert.equal(JSON.stringify(run),before);assert.match(html,/台上三種講法，台下六個真問題/);assert.match(html,/待處理的現場問題/);assert.match(html,/第 1 題 \/ 現場回應/);
  for(const value of [descriptor.title,descriptor.instructions,...descriptor.cards,...descriptor.options,...descriptor.optionDetails])assert.ok(html.includes(value),value);
  assert.match(html,/翅膀/);assert.match(html,/屎潘蛇/);assert.match(html,/林老師/);assert.match(html,/水蛇/);assert.equal((html.match(/data-play-command="road-visitor"/g)||[]).length,6);assert.equal((html.match(/data-play-command="road-match"/g)||[]).length,3);
  assert.doesNotMatch(html,/人潮不是商機|先把問題接對|等待分流|接待第 1 位訪客|把問題交給適合的展位|correctAnswer|targets|成功率|命中率/);
  assert.match(html,/data-play-command="commit" disabled/);assert.doesNotMatch(html,/data-play-command="start"/,'the six cards do not impose a reaction timer');
 }
});

test('planning and resetting use descriptor copy while submitting only the bounded six public choices',()=>{
 const run=source('sales'),before=JSON.stringify(run),ui=controls(run);ui.click('commit');assert.equal(ui.commits.length,0);
 ui.click('road-visitor',1);ui.click('road-match',1);assert.match(ui.panel.innerHTML,/第 2 題先交給「承諾、範圍與限制」/);assert.equal(JSON.stringify(run),before);assert.equal(ui.commits.length,0);
 ui.click('reset');assert.match(ui.panel.innerHTML,/台上三種講法，台下六個真問題/);assert.match(ui.panel.innerHTML,/尚未安排/);assert.match(ui.panel.innerHTML,/data-play-command="commit" disabled/);
 const matches=[0,1,2,1,0,2];for(const [i,value]of matches.entries()){ui.click('road-visitor',i);ui.click('road-match',value);}
 assert.equal(ui.commits.length,0);assert.equal(JSON.stringify(run),before);ui.click('commit');ui.click('commit');assert.equal(ui.commits.length,1);assert.deepEqual(ui.commits[0],{kind:'roadshow',matches});
 const pending=E.applyActivityPlay(run,ui.commits[0]);assert.equal(E.validRun(pending),true);assert.equal(pending.pending,true);assert.equal(pending.history.at(-1).activityOutcome.performance.grade,2);ui.cleanup();
});

test('abandoning even a fully filled local draft removes listeners without submitting or completing the Roadshow',()=>{
 const run=source('design'),before=JSON.stringify(run),ui=controls(run);
 for(let i=0;i<6;i++){ui.click('road-visitor',i);ui.click('road-match',0);}
 assert.equal(ui.commits.length,0);ui.cleanup();assert.equal(ui.events.size,0);assert.equal(ui.documentEvents.size,0);assert.equal(ui.frames.size,0);ui.click('commit');assert.equal(ui.commits.length,0);
 assert.equal(JSON.stringify(run),before);assert.equal(run.flags.activity44_roadshow||0,0);assert.ok(!run.activityContext.performance);assert.equal(E.validRun(run),true);
});

test('all seven published minigame HTML snapshots remain byte-for-byte unchanged',()=>{
 const hashes={diet:'ff2a6d835a832a77a346ce30b62c2dec365be8cc4bd75361ee21a2c252ba1f86',arm:'9151fdae9390875c697075dd730ddc01a010fbfa6dbac5a1b1f2a072d1f6c9f8',dinner:'5a9bee9f0753b7979e30b955561d52a85427ae2d6755857b632140117c2b13b5',review:'250b8d573fd8c1b35463edad825cacc529ab0203717a7cf2b3b72f0d98e6e8bc',banquet:'97695d79f23471407ce62e37345f1bea0ff16c7dbb71a5f6fcf5f3a9b5a662f7',roadshow:'bac44a32246b26cce61c75a5aae3aede5ce36a2291acef7d31587e30b75cd9a0',basketball:'8ecc4c9407c4830664abddbc6fd0173241de5522b13d5e07f1d3715ae5ab60f6'};
 for(const row of legacy){const run=E.replayRun(row.roleId,row.seed,row.beforePlayActions),html=renderActivityPlayHTMLV55(run,E.getEvent(run));assert.equal(createHash('sha256').update(html).digest('hex'),hashes[row.id],row.id);}
});
