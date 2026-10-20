import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ACHIEVEMENT_MAP,deriveAchievements} from '../dist/achievements.js';
import {applyChoice,advance,getEvent,replayRun,validRun} from '../dist/engine.js';
import {displayChronicleHistory} from '../dist/chronicle-scene-copy.js';

const {routes}=JSON.parse(readFileSync(new URL('./fixtures/chronicle-achievement-routes.json',import.meta.url),'utf8'));
const ids=['banquet-first-love','sonny-press-conference','sonny-unplayed-champion'];
const copy=value=>JSON.parse(JSON.stringify(value));
const earned=run=>deriveAchievements(run).filter(id=>ids.includes(id));
const menuFor=route=>replayRun(route.roleId,route.seed,route.actions.slice(0,-1));
const rowFor=route=>applyChoice(menuFor(route),route.choiceIndex).history.at(-1);

test('natural e21 replay witnesses cover both First Love draws and both exclusive pizza responses',()=>{
 assert.equal(routes.length,4);
 assert.deepEqual(new Set(routes.map(route=>route.achievementId)),new Set(ids));
 assert.deepEqual(new Set(routes.filter(route=>route.eventId==='banquet-welcome').map(route=>route.outcome)),new Set(['成功搶麥','被夢想插播']));
 for(const route of routes){
  assert.match(route.seed,/^e21-/);
  assert.ok(Object.hasOwn(ACHIEVEMENT_MAP,route.achievementId));
  assert.deepEqual(route.actions.at(-1),{type:'choice',eventId:route.eventId,index:route.choiceIndex});
  const menu=menuFor(route);
  assert.equal(menu.eventId,route.eventId,route.id);
  assert.ok(getEvent(menu).choices[route.choiceIndex].available!==false);
  assert.deepEqual(earned(menu),[],`${route.id}: reaching the scene does not earn its answer`);
  const pending=applyChoice(menu,route.choiceIndex),saved=copy(pending),last=pending.history.at(-1);
  assert.deepEqual(earned(pending),[route.achievementId],`${route.id}: committed result earns only its branch`);
  if(route.outcome)assert.equal(last.eventOutcome.result,route.outcome);
  assert.equal(validRun(saved),true,`${route.id}: result is a valid anonymous save`);
  const resolved=advance(pending),replayed=replayRun(route.roleId,route.seed,route.actions);
  assert.deepEqual(replayed,resolved,`${route.id}: canonical replay recreates the choice exactly`);
  assert.equal(validRun(copy(replayed)),true);
  assert.deepEqual(earned(replayed),[route.achievementId]);
  assert.deepEqual(copy(pending),saved,`${route.id}: derivation and advancing do not rewrite the committed result`);
 }
});

test('chronicle badges require the resolved actor, scene and response rather than flags or supplied badge IDs',()=>{
 const supplied={achievements:ids,flags:{banquet_stage:1,banquet_attended:1,archive:1,evidence:1,sonny_press_conference:1,sonny_unplayed_champion:1}};
 assert.deepEqual(earned(supplied),[]);
 for(const route of routes){
  const row=rowFor(route);
  assert.deepEqual(earned({history:[row]}),[route.achievementId]);
  const invalid=[
   {...row,eventId:route.eventId==='banquet-welcome'?'banquet-draw':'another-office-event'},
   {...row,kind:row.kind==='banquet'?'daily':'banquet'},
   {...row,speaker:'wing'},
   {...row,choiceIndex:0},
   {...row,choiceIndex:-1},
   {...row,choiceIndex:null},
   {...row,choiceIndex:'1'},
   {...row,result:''},
   {...row,result:'   '},
   {...row,result:null},
  ];
  const missingChoice={...row};delete missingChoice.choiceIndex;invalid.push(missingChoice);
  const missingResult={...row};delete missingResult.result;invalid.push(missingResult);
  for(const incomplete of invalid)assert.deepEqual(earned({...supplied,history:[incomplete]}),[],`${route.id}: incomplete or unrelated history is insufficient`);
  assert.deepEqual(earned({...supplied,eventId:route.eventId,history:[]}),[]);
 }
});

test('First Love uses the committed canonical draw and never a guessed or renamed outcome',()=>{
 for(const route of routes.filter(route=>route.eventId==='banquet-welcome')){
  const row=rowFor(route);
  for(const eventOutcome of [undefined,null,{}, {label:'尾牙點歌台'}, {label:'First Love 搶麥決鬥',result:route.outcome}, {label:'尾牙點歌台',result:'尚未抽出'}, {label:'尾牙點歌台',result:'傑克搶麥成功'}]){
   assert.deepEqual(earned({history:[{...row,eventOutcome}]}),[],'only a recognized canonical resolved draw is proof');
  }
  const shown=displayChronicleHistory(row);
  assert.notDeepEqual(shown.eventOutcome,row.eventOutcome,'player-facing draw names are a separate presentation');
  assert.deepEqual(earned({history:[row]}),['banquet-first-love']);
  const menu=menuFor(route);
  for(const index of [0,2,3])assert.ok(!earned(applyChoice(menu,index)).includes('banquet-first-love'),`banquet choice ${index} is not the duel`);
 }
});

test('the press conference and unplayed trophy are distinct from timing a match or a physical rage hit',()=>{
 const press=routes.find(route=>route.achievementId==='sonny-press-conference');
 const menu=menuFor(press);
 assert.deepEqual(earned(applyChoice(menu,0)),[],'keeping time is neither the press conference nor the unplayed trophy');
 assert.deepEqual(earned(applyChoice(menu,1)),['sonny-press-conference']);
 assert.deepEqual(earned(applyChoice(menu,2)),['sonny-unplayed-champion']);
 for(const index of [0,1,2]){
  const row=applyChoice(menu,index).history.at(-1),badges=deriveAchievements({history:[row]});
  assert.ok(!badges.some(id=>id.startsWith('real-hit-')||id.startsWith('dream-')||id==='rage-real'),'a party wrestling response is not a rage attack');
 }
});

test('chronicle badge collection is read-only, idempotent and independent of display prose',()=>{
 for(const route of routes){
  const run=replayRun(route.roleId,route.seed,route.actions),before=JSON.stringify(run);
  const expected=deriveAchievements(run);
  assert.deepEqual(deriveAchievements(copy(run)),expected);
  assert.deepEqual(deriveAchievements(run),expected);
  assert.equal(JSON.stringify(run),before,'collection cannot consume RNG or rewrite actions, prose, stats or history');
  const row=rowFor(route),renamed={...row,title:'只改畫面標題',choiceText:'只改畫面選項',result:'已結算的劇情內容。'};
  assert.deepEqual(earned({history:[renamed]}),[route.achievementId],'localized prose is not the branch identity');
  assert.deepEqual(earned({history:[row,row,copy(row)]}),[route.achievementId],'repeated collection never duplicates one badge');
 }
});
