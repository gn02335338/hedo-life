import test from 'node:test';
import assert from 'node:assert/strict';
import { PERSONAS } from '../dist/persona.js';
import { getSelfCareV18 } from '../dist/resources-v18.js';
import { getMoodWarningV18 } from '../dist/meltdown-v18.js';
import { MEAL_GUEST_IDS_V25, MEAL_EVENTS_V25, getMealV25, withMealEntryV25, withMealRageCopyV25 } from '../dist/meals-v25.js';

const menuRun=(page=0,cash=100,origin='self-care')=>({
 eventId:page===0?'meal-guests-a':'meal-guests-b',stats:{cash},mealContext:{origin,page,guest:null}
});
const guestRun=(guest,cash=100,origin='self-care')=>({
 eventId:`meal-with-${guest}`,stats:{cash},mealContext:{origin,page:Math.floor(MEAL_GUEST_IDS_V25.indexOf(guest)/8),guest}
});

test('e25 meal entry preserves frozen self-care and warning choices and starts without a charge',()=>{
 const run={stats:{cash:100}},care=getSelfCareV18(run),warning=getMoodWarningV18(run);
 for(const [source,index]of [[care,4],[warning,1]]){
  const before=structuredClone(source),event=withMealEntryV25(source),entry=event.choices[index];
  assert.deepEqual(source,before);assert.notEqual(event,source);
  assert.equal(entry.effect,'mealOpen');assert.equal(entry.available,true);assert.deepEqual(entry.delta,{});
  assert.deepEqual(entry.flags,[]);assert.match(entry.text,/找人吃飯/u);
  for(let at=0;at<source.choices.length;at++)if(at!==index)assert.equal(event.choices[at],source.choices[at]);
 }
 const other={id:'daily'};assert.equal(withMealEntryV25(other),other);assert.equal(withMealEntryV25(null),null);
});

test('e25 two guest pages expose all sixteen portraits without a charge or RNG and fit the action envelope',()=>{
 const listed=[];
 for(let page=0;page<2;page++){
  const run=menuRun(page),before=structuredClone(run),event=getMealV25(run);
  assert.deepEqual(run,before);assert.equal(event.speaker,'self');assert.equal(event.kind,'self-care');
  assert.equal(event.choices.length,10);
  for(const choice of event.choices){
   assert.deepEqual(choice.delta,{});assert.deepEqual(choice.flags,[]);assert.equal(choice.draw,undefined);assert.equal(choice.check,undefined);
   assert.equal(choice.available,true);
  }
  const guests=event.choices.filter(choice=>choice.mealTarget);
  assert.equal(guests.length,8);
  for(const choice of guests){
   const id=choice.mealTarget;listed.push(id);
   assert.ok(PERSONAS[id].image);assert.ok(choice.text.includes(PERSONAS[id].name));
   assert.ok(choice.text.includes(`${choice.mealCost} 存款`));assert.equal(choice.effect,'mealPick');
  }
  assert.equal(event.choices[8].effect,'mealPage');assert.equal(event.choices[8].mealPage,1-page);
  assert.equal(event.choices[9].effect,'mealCancel');
 }
 assert.deepEqual(listed,MEAL_GUEST_IDS_V25);assert.equal(new Set(listed).size,16);
 assert.deepEqual([...listed].sort(),Object.keys(PERSONAS).sort());
 assert.equal(new Set(MEAL_EVENTS_V25).size,18);
});

test('e25 unaffordable guests stay in the list and changing pages or cancelling is always free',()=>{
 for(let page=0;page<2;page++){
  for(const origin of ['self-care','crisis-mood']){
   const event=getMealV25(menuRun(page,0,origin));
   for(const choice of event.choices.slice(0,8))assert.equal(choice.available,false);
   for(const choice of event.choices.slice(8))assert.equal(choice.available,true);
   const price=event.choices[0].mealCost,exact=getMealV25(menuRun(page,price,origin));
   assert.equal(exact.choices[0].available,true);
  }
 }
});

test('e25 every guest has a distinct conversation, affordable responses and a wild option with costs disclosed',()=>{
 const titles=new Set(),bodies=new Set(),lines=new Set();
 for(const guest of MEAL_GUEST_IDS_V25){
  const run=guestRun(guest),before=structuredClone(run),event=getMealV25(run);
  assert.deepEqual(run,before);assert.equal(event.speaker,guest);assert.equal(event.kind,'self-care');
  assert.equal(event.choices.length,3);assert.deepEqual(event.sourceIds,['characterFiction']);
  titles.add(event.title);bodies.add(event.body);lines.add(event.wing);
  assert.equal(event.choices[1].wild,true);
  for(const choice of event.choices.slice(0,2)){
   assert.equal(choice.effect,'mealFinish');assert.equal(choice.available,true);
   assert.equal(choice.delta.cash,-choice.mealCost);assert.ok(choice.mealCost>=8&&choice.mealCost<=26);
   assert.ok(choice.text.includes(`花費 ${choice.mealCost} 存款`));assert.ok(choice.result.length>30);
   assert.ok(choice.flags.includes(`meal_guest_${guest}`));assert.ok(choice.flags.includes('meal_shared'));
   assert.equal(choice.draw,undefined);assert.equal(choice.check,undefined);assert.equal(choice.detail,'');
  }
  const price=event.choices[0].mealCost;
  for(const cash of [price-1,price]){
   const priced=getMealV25(guestRun(guest,cash));
   assert.equal(priced.choices[0].available,cash>=price);assert.equal(priced.choices[1].available,cash>=price);
   assert.equal(priced.choices[2].available,true);assert.equal(priced.choices[2].effect,'mealCancel');
   assert.deepEqual(priced.choices[2].delta,{});assert.deepEqual(priced.choices[2].flags,[]);
  }
 }
 assert.equal(titles.size,16);assert.equal(bodies.size,16);assert.equal(lines.size,16);
});

test('e25 meal setup rejects mismatched pages and out-of-room guests',()=>{
 assert.throws(()=>getMealV25({...menuRun(),mealContext:null}),/Invalid meal/u);
 assert.throws(()=>getMealV25({...menuRun(),mealContext:{origin:'onboarding',page:0,guest:null}}),/Invalid meal/u);
 assert.throws(()=>getMealV25({...menuRun(),eventId:'meal-guests-b'}),/Invalid meal/u);
 assert.throws(()=>getMealV25({...menuRun(),mealContext:{origin:'self-care',page:0,guest:'wing'}}),/Invalid meal/u);
 assert.throws(()=>getMealV25({...guestRun('wing'),eventId:'meal-with-spencer'}),/Invalid meal/u);
 assert.throws(()=>getMealV25({...guestRun('jack'),mealContext:{origin:'self-care',page:0,guest:'jack'}}),/Invalid meal/u);
});

test('e25 dinners retain the requested office jokes without certifying rumors as facts',()=>{
 const body=id=>getMealV25(guestRun(id));
 assert.match(body('kind').choices[0].result,/消失/u);
 assert.match(body('kind').choices[1].result,/無法聯繫/u);
 assert.match(body('meimei').body,/First Love.*傑克/u);
 assert.match(body('sonny').choices[1].result,/碗、桌高與手腕/u);
 assert.match(body('jonathan').wing,/助理工程師/u);
 assert.match(body('sam').body,/成大學士加碩士.*Netflix/u);
 assert.match(body('sophie').choices[0].result,/沒人.*傳聞蓋章/u);
 assert.match(body('sophie').choices[1].result,/沒有查證結論/u);
 assert.ok(body('wing').choices[0].delta.mood<0);
 for(const id of MEAL_GUEST_IDS_V25.filter(guest=>guest!=='wing')){
  for(const choice of body(id).choices)assert.equal(choice.delta.boss??0,0);
 }
});

test('e25 dinner rage copy changes only narration, keeps restaurant context and distinguishes already-paid results',()=>{
 const original={id:'rage-release',speaker:'wing',title:'受不了了，扁他。',kind:'rage',body:'原場景',wing:'原對白',choices:[{
  text:'受不了了，扁他。',rageTarget:'wing',delta:{},flags:[],effect:'rageReturn',draw:{label:'剛才發生了什麼',outcomes:[
   {weight:70,label:'腦內劇場',result:'原夢境',delta:{mood:9,boss:-2,energy:-3},effect:'rageReturn',flags:['rage_imagined','rage_catharsis']},
   {weight:30,label:'真的失控了',result:'原失控',delta:{mood:-8,boss:-32,energy:-11},effect:'rageAftermath',flags:['rage_real']}
  ]}
 }]};
 const mechanical=event=>({...event,body:'',wing:'',choices:event.choices.map(choice=>({...choice,draw:{...choice.draw,outcomes:choice.draw.outcomes.map(outcome=>({...outcome,result:''}))}}))});
 const before=structuredClone(original),dreams=new Set();
 for(const guest of MEAL_GUEST_IDS_V25)for(const phase of ['event','result'])for(const pendingEffect of ['mealFinish','mealCancel']){
  const run={seed:'e25-copy-test',rageContext:{target:guest,eventId:`meal-with-${guest}`,phase,pendingEffect}},edited=withMealRageCopyV25(original,run);
  assert.notEqual(edited,original);assert.deepEqual(original,before);assert.deepEqual(mechanical(edited),mechanical(original));
  assert.match(edited.body,/座位/u);assert.equal(edited.wing,getMealV25(guestRun(guest)).wing);
  const [imagined,real]=edited.choices[0].draw.outcomes;
  assert.match(imagined.result,/腦內.*餐桌.*帳單/u);assert.match(imagined.result,/沒有人挨打/u);
  assert.match(real.result,/店員.*餐桌/u);assert.doesNotMatch(real.result,/辦公室|印表機|工程排程/u);
  if(phase==='result'&&pendingEffect==='mealFinish'){
   assert.match(edited.body,/餐費已經付過/u);assert.match(imagined.result,/已結清/u);assert.match(real.result,/剛才付過的餐費沒有重算/u);
  }else assert.doesNotMatch(real.result,/付過的餐費/u);
  dreams.add(imagined.result);
 }
 assert.equal(dreams.size,32);
 for(const [event,run]of [
  [original,{seed:'e24-copy-test',rageContext:{target:'wing',eventId:'meal-with-wing'}}],
  [{...original,id:'rage-aftermath'},{seed:'e25-copy-test',rageContext:{target:'wing',eventId:'meal-with-wing'}}],
  [original,{seed:'e25-copy-test',rageContext:{target:'wing',eventId:'onboarding'}}],
  [original,{seed:'e25-copy-test',rageContext:{target:'jack',eventId:'meal-with-wing'}}]
 ])assert.equal(withMealRageCopyV25(event,run),event);
});
