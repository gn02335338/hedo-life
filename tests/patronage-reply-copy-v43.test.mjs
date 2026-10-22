import test from 'node:test';
import assert from 'node:assert/strict';
import {PERSONAS} from '../dist/persona.js';
import {patronageReplyModeV43,patronageReplyLineV43,patronageReplyOutcomesV43} from '../dist/patronage-reply-v43.js';
const run={stats:{boss:50,mood:50}},work={id:'ordinary-work',kind:'daily'},social={id:'private-conversation',scope:'private'};
test('all public characters have distinct appointment lines and four bounded reactions, with authority aimed at the actual person',()=>{
 const lines=new Set();
 for(const target of Object.keys(PERSONAS)){
  const before=JSON.stringify(run),line=patronageReplyLineV43(run,work,target),outcomes=patronageReplyOutcomesV43(run,work,target);
  assert.ok(line.length>15);lines.add(line);assert.equal(outcomes.length,4);
  assert.deepEqual(outcomes.map(row=>row.reaction),['obliged','retort','reported','welcomed']);
  for(const row of outcomes){assert.ok(row.weight>0);assert.ok(row.result.length>20);assert.ok(row.result.length<300);assert.ok(row.affinityDelta>=-24&&row.affinityDelta<=12);assert.equal(row.delta.cash,undefined);}
  assert.equal(patronageReplyModeV43(target),['wing','spencer'].includes(target)?'flattery':'entitled');
  if(target==='spencer')assert.ok(outcomes.every(row=>!row.delta.boss),'the chairman is not Wing');
  assert.equal(JSON.stringify(run),before);
 }
 assert.equal(lines.size,Object.keys(PERSONAS).length);assert.equal(patronageReplyLineV43(run,work,'self'),'');assert.deepEqual(patronageReplyOutcomesV43(run,work,'private-character'),[]);
});
test('private scene markers and meal/afterparty encounters keep reports social and do not change another person\'s boss mood',()=>{
 for(const scene of [social,{id:'meal-with-sonny'},{id:'kind-workday'},{id:'banquet-afterparty'}]){
  for(const target of Object.keys(PERSONAS)){
   const outcomes=patronageReplyOutcomesV43(run,scene,target);
   assert.ok(outcomes.every(row=>['給面子但冷場','下班不吃這套','話題繞過你','架子收成玩笑'].includes(row.label)));
   if(target!=='wing')assert.ok(outcomes.every(row=>!row.delta.boss),`${scene.id}/${target}`);
  }
 }
 assert.notEqual(patronageReplyLineV43(run,social,'sonny'),patronageReplyLineV43(run,work,'sonny'));
});
test('relationship, own mood and Wing mood adjust odds without drawing a result or making every reply succeed',()=>{
 const weights=(state,target,affinity)=>patronageReplyOutcomesV43(state,work,target,{affinity}).map(row=>row.weight);
 assert.notDeepEqual(weights(run,'helen',20),weights(run,'helen',80));
 assert.notDeepEqual(weights(run,'rick',50),weights({stats:{boss:50,mood:10}},'rick',50));
 assert.notDeepEqual(weights({stats:{boss:10,mood:50}},'wing',50),weights({stats:{boss:90,mood:50}},'wing',50));
 assert.deepEqual(weights({stats:{boss:10,mood:50}},'spencer',50),weights({stats:{boss:90,mood:50}},'spencer',50));
});
