import test from 'node:test';
import assert from 'node:assert/strict';
import { applyOnboardingV17 } from '../dist/onboarding-v17.js';

function opening(){
 return {id:'onboarding',title:'old',body:'old',wing:'old',kind:'onboarding',speaker:'wing',sourceIds:[],choices:[
  {text:'old',detail:'old',result:'old',delta:{mood:-5,skill:5,cash:5},effect:null,flags:['endure']},
  {text:'old',detail:'old',result:'old',delta:{boss:-14,mood:8},effect:'restoreJob',flags:[],check:{chance:.42,success:{result:'old',delta:{boss:-14,mood:8},effect:'restoreJob'},failure:{result:'old',delta:{boss:-20,mood:-8},effect:null}}},
  {text:'old',detail:'old',result:'old',delta:{mood:20},effect:'ragequit',flags:[],available:true}
 ]};
}
function mechanics(value){
 if(Array.isArray(value))return value.map(mechanics);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!['title','body','wing','text','detail','result'].includes(key)).map(([key,item])=>[key,mechanics(item)]));
 return value;
}

test('honest, swapped and assistant onboarding offer distinct decisions without changing any checks or effects',()=>{
 const input=opening(),before=structuredClone(input),scenes=[];
 const cases=[
  {roleId:'system',actualRoleId:'system',assignment:'honest',offerPay:60,pay:60,title:'工程師'},
  {roleId:'ai',actualRoleId:'system',assignment:'swapped',offerPay:80,pay:80,title:'工程師'},
  {roleId:'project',actualRoleId:'system',assignment:'assistant',offerPay:50,pay:39,title:'助理工程師'}
 ];
 for(const run of cases){
  const scene=applyOnboardingV17(input,run,{jobTitle:()=>run.title});scenes.push(scene);
  assert.deepEqual(mechanics(scene),mechanics(input));
  assert.notEqual(scene.title,input.title);
  assert.equal(scene.choices[1].result,scene.choices[1].check.success.result);
  assert.notEqual(scene.choices[1].check.success.result,scene.choices[1].check.failure.result);
 }
 for(let index=0;index<3;index++)assert.equal(new Set(scenes.map(scene=>scene.choices[index].text)).size,3);
 assert.doesNotMatch(scenes[0].body,/沒有(?:被)?改派|鬆一口氣|職稱保住|職稱沒改/);
 assert.match(scenes[0].body,/系統工程師/);assert.match(scenes[0].body,/工程師/);
 assert.match(scenes[1].body,/AI工程師/);assert.match(scenes[1].body,/系統工程師/);assert.match(scenes[1].body,/舊系統/);
 assert.match(scenes[2].body,/專案經理/);assert.match(scenes[2].body,/助理工程師/);assert.match(scenes[2].body,/50K變成39K/);
 assert.deepEqual(input,before,'copy must not mutate the event used by replay');
});

test('onboarding copy leaves unrelated events and null untouched',()=>{
 const other={id:'other',choices:[]};
 assert.equal(applyOnboardingV17(other,{},{}),other);
 assert.equal(applyOnboardingV17(null,{},{}),null);
});
