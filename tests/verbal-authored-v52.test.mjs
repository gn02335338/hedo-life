import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {hasAuthoredVerbalV52,AUTHORED_VERBAL_METADATA_V52 as metadata} from '../dist/verbal-authored-v52.js';
import {verbalSceneLine} from '../dist/verbal-scene-copy.js';

const run={seed:'e39-authored-metadata',roleId:'sales',actualRoleId:'sales',assignment:'honest'};

test('v52 protects exact authored work scenes from unrelated keyword substitutions',()=>{
 const event={id:'bd21-mou-annex',speaker:'spencer',title:'合照拍好了，附件終於有人打開',body:'兩個Logo，拍照與附件'};
 assert.equal(hasAuthoredVerbalV52(event,'spencer'),true);
 assert.match(verbalSceneLine({event,target:'spencer',run}),/兩個Logo貼在一起不會自己生出合作/);
 assert.equal(hasAuthoredVerbalV52(event,'rick'),false);
 assert.equal(hasAuthoredVerbalV52(event,'self'),false);
 assert.equal(hasAuthoredVerbalV52('bd21-mou-annex','spencer','spencer'),true);
 assert.equal(hasAuthoredVerbalV52('bd21-mou-annex','spencer'),false);
});

test('v52 preserves every explicitly written group participant without borrowing a principal voice',()=>{
 const event={id:'q26-pip-mentor-paradox',speaker:'hope'};
 for(const target of ['hope','rick','jack'])assert.equal(hasAuthoredVerbalV52(event,target),true);
 for(const target of ['wing','erich','self','professor'])assert.equal(hasAuthoredVerbalV52(event,target),false);
 assert.equal(hasAuthoredVerbalV52({id:'watch-empty-corridor',speaker:'self'},'self'),true);
 assert.equal(hasAuthoredVerbalV52({id:'watch-invisible-invite',speaker:'meimei'},'self'),false);
});

test('v52 identifies contextual pay, onboarding and private lines but excludes generic character templates',()=>{
 for(const [id,speaker] of [['onboarding','wing'],['low-pay-tip','erich'],['raise-response','hope'],['banquet-afterparty','kind'],['self-care','self'],['wealth-retire','self']]){
  assert.equal(hasAuthoredVerbalV52({id,speaker},speaker),true,id);
  assert.equal(hasAuthoredVerbalV52({id,speaker},'sonny'),false,id);
 }
 assert.equal(hasAuthoredVerbalV52({id:'meal-with-kind',speaker:'kind'},'kind'),true);
 assert.equal(hasAuthoredVerbalV52({id:'meal-with-kind',speaker:'kind'},'rick'),false);
 assert.equal(hasAuthoredVerbalV52({id:'meal-with-professor',speaker:'professor'},'professor'),true);
 assert.equal(hasAuthoredVerbalV52({id:'meal-guests-c',speaker:'self'},'self'),true);
 for(const target of ['annie_yu','princess','joyce','janet','captain']){
  assert.equal(hasAuthoredVerbalV52({id:'cast39-'+target+'-anything',speaker:target},target),false);
  assert.equal(hasAuthoredVerbalV52({id:'meal-with-'+target,speaker:target},target),false);
 }
 assert.equal(hasAuthoredVerbalV52({id:'professor37-last-minute-question',speaker:'professor'},'professor'),false);
 assert.equal(hasAuthoredVerbalV52({id:'video-designer-benchmark',speaker:'self'},'self'),false);
});

test('v52 authorship reads no body keywords, random outcomes or future choices',()=>{
 const event={id:'rick-author-name',speaker:'rick'};
 for(const field of ['title','body','wing','choices','result','draw','stats'])Object.defineProperty(event,field,{get(){throw new Error('forbidden read: '+field)}});
 assert.equal(hasAuthoredVerbalV52(event,'rick'),true);
 assert.equal(hasAuthoredVerbalV52({id:'unwritten-scene',speaker:'rick'},'rick'),false);
 for(const value of [null,undefined,{},'unknown'])assert.equal(hasAuthoredVerbalV52(value,'rick'),false);
});

test('v52 static metadata stays aligned with actual explicit tables, not the broad legacy coverage list',async()=>{
 const text=await readFile(new URL('../dist/verbal-scene-copy.js',import.meta.url),'utf8');
 const section=name=>text.slice(text.indexOf('const '+name+'={'),text.indexOf('\n};',text.indexOf('const '+name+'={')));
 const sceneIds=[...section('sceneRows').matchAll(/^ '([^']+)':pair\(/gm)].map(match=>match[1]);
 const mealTargets=[...section('mealRows').matchAll(/^ (\w+):pair\(/gm)].map(match=>match[1]);
 const groupTargets={};let id;
 for(const line of section('groupRows').split('\n')){
  const key=line.match(/^ (?:'([^']+)'|(\w+)):\{/);if(key){id=key[1]||key[2];groupTargets[id]=[];continue;}
  const actor=line.match(/^  (\w+):(?:pair\(|sceneRows\[)/);if(actor)groupTargets[id].push(actor[1]);
 }
 assert.deepEqual(metadata.sceneIds,sceneIds);
 assert.deepEqual(metadata.groupTargets,groupTargets);
 assert.deepEqual(metadata.mealTargets,mealTargets);
 assert.equal(Object.isFrozen(metadata),true);
 for(const value of [metadata.sceneIds,metadata.groupTargets,metadata.mealTargets,metadata.contextIds,...Object.values(metadata.groupTargets)])assert.equal(Object.isFrozen(value),true);
});
