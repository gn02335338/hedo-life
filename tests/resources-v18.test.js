import test from 'node:test';
import assert from 'node:assert/strict';
import {ABILITY_KEYS_V18,ABILITY_BUDGET_V18,normalizeAbilitiesV18,abilityRebalanceV18,getSelfCareV18,moodEnergyPulseV18} from '../dist/resources-v18.js';

const abilities=values=>Object.fromEntries(ABILITY_KEYS_V18.map((key,index)=>[key,values[index]]));
const rebalance=(before,after)=>{
 const correction=abilityRebalanceV18(before,after);
 return Object.fromEntries(ABILITY_KEYS_V18.map(key=>[key,after[key]+correction[key]]));
};

test('e18 starting abilities retain proportions, fit the budget and leave other resources alone',()=>{
 const original={...abilities([85,85,85]),mood:67,cash:44};
 const normalized=normalizeAbilitiesV18(original);
 assert.deepEqual(normalized,{...abilities([60,60,60]),mood:67,cash:44});
 assert.deepEqual(original,{...abilities([85,85,85]),mood:67,cash:44});
 const unequal=normalizeAbilitiesV18(abilities([100,80,60]));
 assert.deepEqual(unequal,abilities([75,60,45]));
 assert.deepEqual(normalizeAbilitiesV18(abilities([49,50,51])),abilities([49,50,51]));
 for(let skill=25;skill<=85;skill+=4)for(let slack=25;slack<=85;slack+=4)for(let lick=25;lick<=85;lick+=4){
  const result=normalizeAbilitiesV18({skill,slack,lick}),total=Object.values(result).reduce((a,b)=>a+b,0);
  assert.ok(total<=ABILITY_BUDGET_V18);
  assert.ok(Object.values(result).every(value=>Number.isInteger(value)&&value>=0&&value<=100));
 }
});

test('e18 growth has a real cost to both other abilities, including simultaneous rewards',()=>{
 const before=abilities([50,50,50]);
 assert.deepEqual(rebalance(before,abilities([64,50,50])),abilities([64,43,43]));
 assert.deepEqual(rebalance(before,abilities([52,60,59])),abilities([45,60,45]));
 assert.deepEqual(rebalance(before,abilities([65,65,65])),abilities([65,42,42]));
 assert.deepEqual(rebalance(before,abilities([64,30,40])),abilities([64,30,40]),'larger authored losses are preserved');
 assert.deepEqual(rebalance(abilities([2,3,70]),abilities([2,3,90])),abilities([0,0,90]),'cost bottoms out at zero');
 assert.deepEqual(abilityRebalanceV18(before,abilities([40,30,20])),abilities([0,0,0]),'losses do not create an unrelated tax');
 assert.deepEqual(rebalance(abilities([100,100,100]),abilities([100,100,100])),abilities([60,60,60]));
});

test('e18 every skill focus remains mutually exclusive and bounded through repeated multi-gain rewards',()=>{
 let current=normalizeAbilitiesV18(abilities([85,77,81]));
 for(let index=0;index<1000;index++){
  const before={...current},focus=ABILITY_KEYS_V18[index%3];
  const after=Object.fromEntries(ABILITY_KEYS_V18.map(key=>[key,Math.min(100,before[key]+(key===focus?14:7))]));
  current=rebalance(before,after);
  assert.ok(Object.values(current).reduce((a,b)=>a+b,0)<=180);
  assert.ok(ABILITY_KEYS_V18.filter(key=>current[key]>before[key]).length<=1);
  assert.ok(Object.values(current).every(value=>value>=0&&value<=100));
 }
});

test('e18 self-care accepts the exact price, charges only affordable purchases and always permits leaving',()=>{
 for(const cash of [0,7,8,12,14,16,18,20,30,100]){
  const run={stats:{cash}},snapshot=structuredClone(run),event=getSelfCareV18(run);
  assert.equal(event.choices.length,8);assert.equal(event.speaker,'self');
  assert.deepEqual(run,snapshot);
  for(const choice of event.choices.filter(choice=>choice.effect==='finishBreak')){
   const cost=-choice.delta.cash;
   assert.equal(choice.available,cash>=cost);
   assert.ok(cost>=8&&cost<=30);assert.ok(choice.text.includes(`花費 ${cost} 存款`));
   assert.equal(choice.detail,'');assert.equal(choice.check,undefined);assert.equal(choice.draw,undefined);
   if(choice.available)assert.ok(cash+choice.delta.cash>=0);
  }
  const leave=event.choices.at(-1);
  assert.equal(leave.available,true);assert.equal(leave.effect,'cancelBreak');assert.deepEqual(leave.delta,{});
 }
 const paid=getSelfCareV18({stats:{cash:100}}).choices.filter(choice=>choice.effect==='finishBreak');
 for(const flag of ['spend_mood','spend_energy','spend_training','spend_evidence','spend_network','spend_sabbatical'])assert.ok(paid.some(choice=>choice.flags.includes(flag)),flag);
 assert.ok(paid.some(choice=>choice.flags.includes('archive')&&choice.flags.includes('evidence')));
 assert.ok(paid.some(choice=>choice.flags.includes('alumni_links')));
 assert.ok(paid.some(choice=>choice.delta.mood>=45&&choice.delta.energy>=35));
 assert.ok(paid.some(choice=>choice.flags.includes('goose_manager')));
});

test('e18 resource pulses have both harsh and helpful days with no hidden RNG or boss delta',()=>{
 const outcomes=[0,.25,.5,.75].map(moodEnergyPulseV18);
 assert.equal(new Set(outcomes.map(item=>item.label)).size,4);
 assert.ok(outcomes.some(item=>item.delta.mood<=-10&&item.delta.energy<=-7));
 assert.ok(outcomes.some(item=>item.delta.mood>=12&&item.delta.energy>=10));
 for(const draw of [0,.249999,.25,.499999,.5,.749999,.75,.999999]){
  const result=moodEnergyPulseV18(draw);assert.deepEqual(result,moodEnergyPulseV18(draw));
  assert.deepEqual(Object.keys(result.delta).sort(),['energy','mood']);
 }
});
