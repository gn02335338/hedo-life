import test from 'node:test';
import assert from 'node:assert/strict';
import {PERSONAS} from '../dist/persona.js';
import {CAST_IDS_V65} from '../dist/cast-v65.js';
import {patronageReplyModeV43,patronageReplyLineV43,patronageReplyOutcomesV43} from '../dist/patronage-reply-v43.js';
const run={stats:{boss:50,mood:50}},work={id:'ordinary-work',kind:'daily'},social={id:'private-conversation',scope:'private'};
// This fixture predates both the six r65 guests and the separately gated Alice.
const legacyTargets=Object.keys(PERSONAS).filter(id=>id!=='alice'&&!CAST_IDS_V65.includes(id));
test('historical public characters retain distinct appointment lines and four bounded reactions, with authority aimed at the actual person',()=>{
 assert.equal(legacyTargets.length,22);
 const lines=new Set();
 for(const target of legacyTargets){
  const before=JSON.stringify(run),line=patronageReplyLineV43(run,work,target),outcomes=patronageReplyOutcomesV43(run,work,target);
  assert.ok(line.length>15);lines.add(line);assert.equal(outcomes.length,4);
  assert.deepEqual(outcomes.map(row=>row.reaction),['obliged','retort','reported','welcomed']);
  for(const row of outcomes){assert.ok(row.weight>0);assert.ok(row.result.length>20);assert.ok(row.result.length<300);assert.ok(row.affinityDelta>=-24&&row.affinityDelta<=12);assert.equal(row.delta.cash,undefined);}
  assert.equal(patronageReplyModeV43(target),['wing','spencer'].includes(target)?'flattery':'entitled');
  if(target==='spencer')assert.ok(outcomes.every(row=>!row.delta.boss),'the chairman is not Wing');
  assert.equal(JSON.stringify(run),before);
 }
 assert.equal(lines.size,legacyTargets.length);assert.equal(patronageReplyLineV43(run,work,'self'),'');assert.deepEqual(patronageReplyOutcomesV43(run,work,'private-character'),[]);
});
test('private scene markers and meal/afterparty encounters keep reports social and do not change another person\'s boss mood',()=>{
 for(const scene of [social,{id:'meal-with-sonny'},{id:'kind-workday'},{id:'banquet-afterparty'}]){
  for(const target of legacyTargets){
   const outcomes=patronageReplyOutcomesV43(run,scene,target);
   assert.ok(outcomes.every(row=>['給面子但冷場','下班不吃這套','話題繞過你','架子收成玩笑'].includes(row.label)));
   if(target!=='wing')assert.ok(outcomes.every(row=>!row.delta.boss),`${scene.id}/${target}`);
  }
 }
 assert.notEqual(patronageReplyLineV43(run,social,'sonny'),patronageReplyLineV43(run,work,'sonny'));
});
test('fresh r65 appointments can address each new colleague with a distinct voice and four bounded, contextual replies',()=>{
 const fresh={seed:'e39-r65-s-'+'a'.repeat(22),stats:{boss:50,mood:50}},before=JSON.stringify(fresh),lines=new Set(),keywords={zoe:/福委/,action:/資源/,hester:/客戶/,simon:/這版/,james:/回鍋/,johnny:/優先/};
 for(const target of CAST_IDS_V65){
  assert.equal(patronageReplyModeV43(target),'entitled');
  const line=patronageReplyLineV43(fresh,work,target),privateLine=patronageReplyLineV43(fresh,social,target);
  assert.ok(line.length>15);assert.match(line,keywords[target]);assert.notEqual(line,privateLine);lines.add(line);
  const results=[];
  for(const scene of [work,social,{id:`meal-with-${target}`}]){
   const outcomes=patronageReplyOutcomesV43(fresh,scene,target);
   assert.deepEqual(outcomes.map(row=>row.reaction),['obliged','retort','reported','welcomed']);
   assert.equal(new Set(outcomes.map(row=>row.result)).size,4);
   for(const row of outcomes){
    assert.ok(row.weight>0);assert.ok(row.result.length>20&&row.result.length<300);
    assert.ok(row.affinityDelta>=-24&&row.affinityDelta<=12);
    assert.equal(row.delta.cash,undefined);assert.equal(row.delta.boss,undefined,'colleague reactions do not silently change Wing mood');
    assert.ok(Object.values(row.delta).every(value=>Number.isInteger(value)&&Math.abs(value)<=10));
   }
   results.push(outcomes.map(row=>row.result));
   if(scene!==work)assert.deepEqual(outcomes.map(row=>row.label),['給面子但冷場','下班不吃這套','話題繞過你','架子收成玩笑']);
  }
  assert.notDeepEqual(results[0],results[1]);assert.deepEqual(results[1],results[2]);
  for(const old of [run,{...fresh,seed:'e39-r64-s-'+'a'.repeat(22)},{...fresh,seed:'e39-r65-s-'+'a'.repeat(21)}]){
   assert.equal(patronageReplyLineV43(old,work,target),'');assert.deepEqual(patronageReplyOutcomesV43(old,work,target),[]);
  }
  const weights=affinity=>patronageReplyOutcomesV43(fresh,work,target,{affinity}).map(row=>row.weight);
  assert.notDeepEqual(weights(20),weights(80));
 }
 assert.equal(lines.size,6);assert.equal(JSON.stringify(fresh),before);
});
test('r65 expansion does not rewrite any historical character reply',()=>{
 const fresh={...run,seed:'e39-r65-n-'+'b'.repeat(22)};
 for(const target of legacyTargets)for(const scene of [work,social,{id:'pip-review'}, {id:'salary-cut'},{id:'career-promotion'}]){
  assert.equal(patronageReplyLineV43(fresh,scene,target),patronageReplyLineV43(run,scene,target));
  assert.deepEqual(patronageReplyOutcomesV43(fresh,scene,target),patronageReplyOutcomesV43(run,scene,target));
 }
});
test('relationship, own mood and Wing mood adjust odds without drawing a result or making every reply succeed',()=>{
 const weights=(state,target,affinity)=>patronageReplyOutcomesV43(state,work,target,{affinity}).map(row=>row.weight);
 assert.notDeepEqual(weights(run,'helen',20),weights(run,'helen',80));
 assert.notDeepEqual(weights(run,'rick',50),weights({stats:{boss:50,mood:10}},'rick',50));
 assert.notDeepEqual(weights({stats:{boss:10,mood:50}},'wing',50),weights({stats:{boss:90,mood:50}},'wing',50));
 assert.deepEqual(weights({stats:{boss:10,mood:50}},'spencer',50),weights({stats:{boss:90,mood:50}},'spencer',50));
});
