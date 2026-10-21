import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ACHIEVEMENT_MAP,deriveAchievements} from '../dist/achievements.js';
import {WEALTH_ACHIEVEMENTS,deriveWealthAchievements} from '../dist/wealth-achievements.js';
import {applyChoice,advance,getEvent,replayRun,validRun} from '../dist/engine.js';

const {routes}=JSON.parse(readFileSync(new URL('./fixtures/wealth-routes-v27.json',import.meta.url),'utf8'));
const endings=routes.filter(route=>route.kind==='ending');
const ids=WEALTH_ACHIEVEMENTS.map(item=>item.id);
const copy=value=>JSON.parse(JSON.stringify(value));
const earned=run=>deriveAchievements(run).filter(id=>ids.includes(id));
const menuFor=route=>replayRun(route.roleId,route.seed,route.choiceActions);
const studioSuccess=endings.find(route=>route.family==='venture_independent');
const studioFailure=endings.find(route=>route.family==='venture_restart');
const retirement=endings.find(route=>route.family==='retired_free');

test('four distinct illustrated wealth goals join the shared catalogue without exposing a new public state shape',()=>{
 assert.deepEqual(ids,['wealth-startup-success','wealth-startup-failure','wealth-goose-chairman','wealth-retired-free']);
 for(const item of WEALTH_ACHIEVEMENTS){
  assert.equal(ACHIEVEMENT_MAP[item.id],item);
  assert.equal(item.group,'wallet');
  assert.equal(item.image,`./assets/achievements/${item.id}.svg`);
  assert.ok(item.title.trim().length>=4);assert.ok(item.description.trim().length>=15);
 }
});

test('every natural wealth-ending witness earns its resolved branch at the result screen and after completion',()=>{
 assert.equal(endings.length,36);
 for(const route of endings){
  const menu=menuFor(route);
  assert.deepEqual(earned(menu),[],`${route.id}: opening the scene is not commitment`);
  const pending=applyChoice(menu,route.index),saved=copy(pending),completed=advance(pending);
  const expected=route.family==='venture_independent'?['wealth-startup-success']:route.family==='venture_restart'?['wealth-startup-failure']:route.family==='retired_free'?['wealth-retired-free']:[];
  assert.deepEqual(earned(pending),expected,`${route.id}: committed result`);
  assert.equal(validRun(saved),true);
  assert.deepEqual(earned(completed),expected,`${route.id}: completed ending`);
  assert.deepEqual(replayRun(route.roleId,route.seed,pending.actions),completed);
  assert.deepEqual(earned(replayRun(route.roleId,route.seed,route.actions)),expected);
  assert.deepEqual(copy(pending),saved,'derivation never rewrites a pending result');
 }
});

test('studio and toy-goose businesses can each succeed or fail; manufacturing a goose never makes it chairman',()=>{
 const outcomes=new Set();
 for(const route of endings.filter(candidate=>candidate.family.startsWith('venture_'))){
  const menu=menuFor(route);
  for(const index of [0,1]){
   const pending=applyChoice(menu,index),row=pending.history.at(-1),cost=index===0?35:40;
   assert.equal(row.delta.cash,-cost);assert.ok(row.breakdown.some(part=>part.source==='choice'&&part.delta.cash===-cost));
   const expected=row.chanceOutcome==='success'?'wealth-startup-success':'wealth-startup-failure';
   outcomes.add(`${index}/${row.chanceOutcome}`);
   assert.deepEqual(earned(pending),[expected]);
   assert.deepEqual(earned(advance(pending)),[expected]);
   assert.equal(validRun(copy(pending)),true);
  }
 }
 assert.deepEqual(outcomes,new Set(['0/success','1/success','0/setback','1/setback']));
});

test('toy-goose retirement earns both its chairman and full-retirement goals for all professions, while flexible consulting earns neither',()=>{
 for(const route of endings.filter(candidate=>candidate.family==='retired_free')){
  const menu=menuFor(route);
  for(const [index,expected]of [[0,['wealth-retired-free']],[1,[]],[2,['wealth-goose-chairman','wealth-retired-free']]]){
   const pending=applyChoice(menu,index),completed=advance(pending);
   assert.deepEqual(earned(pending),expected,`${route.roleId}/${index}`);
   assert.deepEqual(earned(completed),expected);
   assert.equal(pending.rng,menu.rng,'retirement does not invent an RNG success');
   assert.equal(pending.stats.cash,menu.stats.cash);
   assert.equal(validRun(copy(pending)),true);
   assert.deepEqual(replayRun(route.roleId,route.seed,pending.actions),completed);
  }
 }
});

test('planning, returning, cancelling and raw flags or ending IDs cannot award wealth goals',()=>{
 const supplied={seed:'e27-forged-goals',achievements:ids,flags:{wealth_startup:1,wealth_studio:1,wealth_goose:1,wealth_setback:1},completed:true,endingId:'retired_free-system'};
 assert.deepEqual(earned(supplied),[]);
 assert.deepEqual(earned({...supplied,endingId:'venture_independent-system'}),[]);
 assert.deepEqual(earned({...supplied,endingId:'venture_restart-system'}),[]);
 for(const route of [studioSuccess,studioFailure,retirement]){
  const plan=replayRun(route.roleId,route.seed,route.planActions),menu=menuFor(route);
  assert.deepEqual(earned(plan),[]);assert.deepEqual(earned(menu),[]);
  const cancel=getEvent(menu).choices.findIndex(choice=>choice.effect==='wealthBack');
  assert.ok(cancel>=0);assert.deepEqual(earned(applyChoice(menu,cancel)),[]);
  const back=advance(applyChoice(menu,cancel));assert.deepEqual(earned(back),[]);
  const returnIndex=getEvent(back).choices.findIndex(choice=>choice.effect==='wealthReturn');
  assert.deepEqual(earned(advance(applyChoice(back,returnIndex))),[]);
 }
});

test('startup evidence must resolve the same canonical choice, draw and exact paid cost',()=>{
 for(const route of [studioSuccess,studioFailure]){
  const pending=applyChoice(menuFor(route),0),row=pending.history.at(-1),base={seed:route.seed,history:[row]};
  const expected=route.family==='venture_independent'?'wealth-startup-success':'wealth-startup-failure';
  assert.deepEqual(earned(base),[expected]);
  const invalid=[
   {...row,eventId:'wealth-plan'}, {...row,kind:'daily'}, {...row,speaker:'wing'},
   {...row,choiceIndex:1}, {...row,choiceIndex:2}, {...row,choiceIndex:-1}, {...row,choiceIndex:'0'},
   {...row,result:''}, {...row,result:'   '}, {...row,result:null},
   {...row,chanceOutcome:null}, {...row,chanceOutcome:'lucky'}, {...row,chanceOutcome:'ordinary'},
   {...row,delta:{...row.delta,cash:0}}, {...row,delta:{...row.delta,cash:-40}},
   {...row,breakdown:[]}, {...row,breakdown:null},
   {...row,breakdown:[{source:'weather',delta:{cash:-35}}]},
   {...row,breakdown:[{source:'choice',delta:{cash:-40}}]}
  ];
  for(const key of ['eventId','kind','speaker','choiceIndex','result','chanceOutcome','delta','breakdown']){const missing={...row};delete missing[key];invalid.push(missing);}
  for(const incomplete of invalid)assert.deepEqual(earned({...base,history:[incomplete]}),[],'wrong or incomplete proof is insufficient');
  assert.deepEqual(earned({...base,history:[{...row,chanceOutcome:null},{...row,delta:{...row.delta,cash:0}}]}),[],'two incomplete rows cannot lend one another their payment or outcome');
 }
});

test('retirement requires its committed canonical choice rather than a renamed scene or unrelated paid goose break',()=>{
 const pending=applyChoice(menuFor(retirement),2),row=pending.history.at(-1),base={seed:retirement.seed,history:[row]};
 assert.deepEqual(earned(base),['wealth-goose-chairman','wealth-retired-free']);
 const invalid=[
  {...row,eventId:'wealth-plan'}, {...row,eventId:'wealth-startup'}, {...row,eventId:'self-care'},
  {...row,kind:'self-care'}, {...row,speaker:'spencer'}, {...row,choiceIndex:1}, {...row,choiceIndex:3},
  {...row,choiceIndex:'2'}, {...row,result:''}, {...row,chanceOutcome:'success'},
  {...row,delta:{...row.delta,cash:-1}}, {...row,breakdown:[{source:'choice',delta:{cash:-1}}]},
  {...row,breakdown:null}
 ];
 for(const incomplete of invalid)assert.deepEqual(earned({...base,history:[incomplete]}),[]);
});

test('wealth collection backfills retained e27 proof without changing saves, consumes no RNG, and does not reinterpret old cohorts',()=>{
 for(const route of [studioSuccess,studioFailure,retirement]){
  const pending=applyChoice(menuFor(route),route.index),before=JSON.stringify(pending),expected=earned(pending);
  assert.deepEqual(earned(copy(pending)),expected);assert.deepEqual(earned(pending),expected);
  assert.equal(JSON.stringify(pending),before);
  const row=pending.history.at(-1),renamed={...row,title:'顯示標題改了',choiceText:'顯示選項改了',result:'已結算的顯示敘述改了。'};
  assert.deepEqual(earned({seed:route.seed,history:[renamed,renamed]}),expected,'localized prose and repeated collection do not change a branch');
  for(const seed of [undefined,'e18-old-proof','e26-old-proof','unversioned'])assert.deepEqual(earned({seed,history:[row],completed:true,endingId:route.id}),[]);
 }
 for(const empty of [null,undefined,{},[],{seed:'e27-no-history'}, {seed:'e27-empty',history:[]},{seed:'e27-bad-history',history:{}}])assert.deepEqual(deriveWealthAchievements(empty),[]);
});
