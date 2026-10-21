import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {replayRun,getEvent,applyChoice,advance,validRun} from '../dist/engine.js';
import {ROLES} from '../dist/roles.js';
import {COMPANY_ENDING_IDS_V32} from '../dist/company-v32.js';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/company-player-routes-v33.json',import.meta.url)));
const plans=[
 ['nasdaq',0,0,['nasdaq','nasdaq_failed']],
 ['taiwan',0,1,['taiwan','taiwan_failed']],
 ['market_goose',0,2,['taiwan','taiwan_failed']],
 ['google',1,0,['google_board','google_ousted']],
 ['buyer',1,1,['buyer_board','buyer_ousted']],
 ['buyer_trial',1,2,['buyer_board','buyer_ousted']],
 ['vietnam_core',2,0,['vietnam_core']],
 ['vietnam_afterdark',2,1,['vietnam_afterdark']],
 ['vietnam_mix',2,2,['vietnam_core','vietnam_afterdark']]
];

// These starts came from a visible-text player policy, not the ending finder.
// Forking only at the naturally reached plan table measures the actual final
// draw without confusing an intentional market choice with random redirection.
test('natural e33 company survivors cover every profession and preserve all ten player-directed outcomes',()=>{
 assert.equal(fixture.totalSimulated,3510);
 assert.ok(fixture.routes.length>=150);
 assert.equal(new Set(fixture.routes.map(row=>row.seed)).size,fixture.routes.length);
 assert.deepEqual(new Set(fixture.routes.map(row=>row.roleId)),new Set(ROLES.map(role=>role.id)));
 const observed=new Set(),draws=Object.fromEntries(plans.map(([name])=>[name,{count:0,counts:{},expected:{},variance:{}}]));
 let lowestRank=99,highestRank=0;
 for(const route of fixture.routes){
  assert.match(route.seed,/^e33-/);assert.ok(route.seed.length<=32);
  const source=replayRun(route.roleId,route.seed,route.actions);
  assert.equal(validRun(source),true,route.seed);
  assert.equal(source.eventId,'finale');assert.equal(source.completed,false);
  assert.ok(source.turn>=23);lowestRank=Math.min(lowestRank,source.rank);highestRank=Math.max(highestRank,source.rank);
  const plansAtTable=getEvent(source);
  for(const [name,entry,index,allowed]of plans){
   const entryPending=applyChoice(source,entry),menu=advance(entryPending),event=getEvent(menu),choice=event.choices[index];
   assert.deepEqual(entryPending.stats,source.stats,'browsing must not drain more resources');
   assert.equal(entryPending.rng,source.rng,'browsing must not consume a plan draw');
   assert.equal(menu.turn,source.turn);assert.equal(choice.available,true);
   assert.ok(choice.draw);assert.deepEqual(new Set(choice.draw.outcomes.map(row=>row.effect)),new Set(allowed));
   assert.doesNotMatch(choice.text,/\d+%|機率|結局：/);
   const row=draws[name],total=choice.draw.outcomes.reduce((sum,outcome)=>sum+outcome.weight,0);row.count++;
   for(const outcome of choice.draw.outcomes){
    const p=outcome.weight/total;assert.ok(p>0&&p<=1);
    row.expected[outcome.effect]=(row.expected[outcome.effect]||0)+p;
    row.variance[outcome.effect]=(row.variance[outcome.effect]||0)+p*(1-p);
   }
   const pending=applyChoice(menu,index),completed=advance(pending),family=completed.endingId?.slice(0,-route.roleId.length-1);
   assert.equal(completed.completed,true);assert.equal(validRun(completed),true);
   assert.ok(allowed.includes(family),`${name} must respect the selected plan`);
   row.counts[family]=(row.counts[family]||0)+1;observed.add(family);
   assert.equal(completed.companyContext,null);assert.equal(source.eventId,plansAtTable.id);
  }
 }
 assert.ok(lowestRank<=1,'professional staff can reach company stories');
 assert.ok(highestRank<=5,'no C-level requirement is hidden in the survivor fixtures');
 assert.deepEqual(observed,new Set(COMPANY_ENDING_IDS_V32));
 for(const [name,row]of Object.entries(draws)){
  assert.equal(row.count,fixture.routes.length);
  for(const [family,expected]of Object.entries(row.expected)){
   const actual=row.counts[family]||0;
   if(Object.keys(row.expected).length>1){
    assert.ok(actual>=10,`${name}/${family}: no practically missing side`);
    assert.ok(actual/row.count>=.1&&actual/row.count<=.9,`${name}/${family}: no dominating result`);
   }
   // A broad five-sigma guard catches a stuck/biased RNG without enforcing
   // equal shares on choices with intentionally different or stat-based odds.
   assert.ok(Math.abs(actual-expected)<=5*Math.sqrt(row.variance[family]||0)+2,`${name}/${family}: ${actual} vs ${expected}`);
  }
 }
 assert.equal(draws.vietnam_core.counts.vietnam_core,fixture.routes.length);
 assert.equal(draws.vietnam_afterdark.counts.vietnam_afterdark,fixture.routes.length);
});

test('ten independent fresh-life company completion examples replay exactly without supplied results',()=>{
 assert.equal(fixture.completions.length,10);
 const families=new Set();
 for(const route of fixture.completions){
  const run=replayRun(route.roleId,route.seed,route.actions);
  assert.equal(run.completed,true);assert.equal(run.endingId,route.ending);assert.equal(validRun(run),true);
  families.add(run.endingId.slice(0,-route.roleId.length-1));
 }
 assert.deepEqual(families,new Set(COMPANY_ENDING_IDS_V32));
});
