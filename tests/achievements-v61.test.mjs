import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as E from '../dist/engine.js';
import {ACHIEVEMENTS,ACHIEVEMENT_MAP,deriveAchievements} from '../dist/achievements.js';
import {ACHIEVEMENTS_V60} from '../dist/achievements-v60.js';
import {ACHIEVEMENTS_V61,deriveAchievementsV61} from '../dist/achievements-v61.js';
import {deriveCharacterStats} from '../dist/character-stats.js';

const copy=value=>JSON.parse(JSON.stringify(value)),ids=ACHIEVEMENTS_V61.map(row=>row.id),idSet=new Set(ids);
const {routes}=JSON.parse(readFileSync(new URL('./fixtures/achievement-milestones-v61.json',import.meta.url),'utf8'));
const storyRoutes=JSON.parse(readFileSync(new URL('./fixtures/office-treats-routes-v61.json',import.meta.url),'utf8')).routes;
const fixture=id=>{const row=storyRoutes.find(row=>row.id===id);assert.ok(row,id);return E.replayRun(row.roleId,row.seed,row.actions);};
const earned=run=>deriveAchievements(run).filter(id=>idSet.has(id));
const newStoryRows=run=>run.history.filter(row=>row.kind==='office-treat');

test('nine original illustrated food-story badges append to the unchanged published collection',()=>{
 assert.equal(ACHIEVEMENTS_V61.length,9);assert.deepEqual(ACHIEVEMENTS.slice(241),ACHIEVEMENTS_V61);assert.deepEqual(ACHIEVEMENTS.slice(209,241),ACHIEVEMENTS_V60);
 assert.equal(ACHIEVEMENTS.length,250);assert.equal(new Set(ACHIEVEMENTS.map(row=>row.id)).size,250);
 const art=new Set();
 for(const row of ACHIEVEMENTS_V61){
  assert.equal(ACHIEVEMENT_MAP[row.id],row);assert.ok(row.title.length>=4);assert.ok(row.description.length>=25);assert.equal(row.image,`./assets/achievements/${row.id}.svg`);assert.equal(row.mode,undefined);
  const svg=readFileSync(new URL(`../dist/${row.image}`,import.meta.url),'utf8');art.add(svg);
  assert.match(svg,/<svg[^>]+viewBox="0 0 240 200"/);assert.match(svg,/role="img" aria-labelledby="[^"]+"/);assert.ok(svg.includes(`<title id="${row.id}-title">`));assert.match(svg,/<desc id="[^"]+">[^<]+<\/desc>/);assert.match(svg,/data-art-version="61"/);
  assert.doesNotMatch(svg,/<(?:script|foreignObject|image)\b|\bon\w+=|javascript:|(?:href|src)=["']https?:\/\//i);
 }
 assert.equal(art.size,9);
});

test('all nine goals have natural canonical witnesses and identical read-only browser/server projections',()=>{
 const covered=new Set();assert.equal(routes.length,6);
 for(const route of routes){
  assert.deepEqual(Object.keys(route).sort(),['actions','expectedAchievements','id','roleId','seed']);assert.match(route.seed,/^e39-r61-[nsd]-[a-f0-9]{22}$/);
  const run=E.replayRun(route.roleId,route.seed,route.actions),saved=copy(run),before=JSON.stringify(saved);
  assert.equal(E.validRun(saved),true,route.id);assert.deepEqual(E.replayRun(saved.roleId,saved.seed,saved.actions),saved);
  assert.deepEqual(deriveAchievementsV61(saved),route.expectedAchievements,route.id);assert.deepEqual(earned(saved),route.expectedAchievements,route.id);assert.equal(JSON.stringify(saved),before);
  route.expectedAchievements.forEach(id=>covered.add(id));
 }
 assert.deepEqual([...covered].sort(),[...ids].sort());
});

test('reading a menu or supplying flags and rewards cannot earn an unresolved badge',()=>{
 for(const run of [null,undefined,{},[],{history:[]},{history:[],actions:[],flags:{treats61_seen_company_tea:1,treats61_company_tea_cancelled:1},achievements:ids}])assert.deepEqual(deriveAchievementsV61(run),[]);
 for(const id of ['company-tea-0-0','jack-drinks-0-0','birthday-cake-0-0']){
  const route=storyRoutes.find(row=>row.id===id),run=E.replayRun(route.roleId,route.seed,route.beforeActions),before=JSON.stringify(run);
  const ownIds=id.startsWith('company')?['tea-star-and-half','tea-name-check','tea-no-scapegoat']:id.startsWith('jack')?['treat-jack-drink','treat-jack-decline','treat-jonathan-toppings']:['cake-jack-relief','cake-let-it-thaw','cake-goose-chair'];
  assert.ok(ownIds.every(id=>!deriveAchievementsV61(run).includes(id)));assert.equal(JSON.stringify(run),before);
 }
 for(const route of routes){
  const run=E.replayRun(route.roleId,route.seed,route.actions);
  assert.deepEqual(deriveAchievementsV61({...run,history:[],achievements:ids}),[]);assert.deepEqual(deriveAchievementsV61({...run,actions:[],achievements:ids}),[]);
  assert.deepEqual(deriveAchievementsV61({...run,history:run.history.map(row=>({...row,choiceIndex:-1}))}),[]);
 }
});

test('a drink requires a real order and delivery; refusing either invitation or menu is also a specific goal',()=>{
 for(const index of [0,1,3]){
  const ordered=fixture(`jack-drinks-1-${index}`);assert.ok(!deriveAchievementsV61(ordered).includes('treat-jack-drink'));assert.ok(deriveAchievementsV61(ordered).includes('treat-jonathan-toppings'));
  const arrived=E.applyChoice(ordered,0);assert.equal(arrived.pending,true);assert.equal(arrived.history.at(-1).treatsOutcome.done,true);assert.ok(deriveAchievementsV61(arrived).includes('treat-jack-drink'));assert.equal(E.validRun(copy(arrived)),true);
  assert.equal(arrived.history.at(-1).delta.cash||0,0,'Jack pays; the player is not charged for Jonathan’s cup');
 }
 const noDrink=fixture('jack-drinks-1-2');assert.ok(deriveAchievementsV61(noDrink).includes('treat-jack-decline'));assert.ok(deriveAchievementsV61(noDrink).includes('treat-jonathan-toppings'));
 const water=E.applyChoice(noDrink,0);assert.equal(water.history.at(-1).treatsOutcome.result,'drinks-delivered-none');assert.ok(!deriveAchievementsV61(water).includes('treat-jack-drink'));assert.equal(E.validRun(water),true);
 const refused=fixture('jack-drinks-0-1');assert.ok(deriveAchievementsV61(refused).includes('treat-jack-decline'));assert.ok(!deriveAchievementsV61(refused).includes('treat-jonathan-toppings'));
 assert.match(ACHIEVEMENT_MAP['treat-jonathan-toppings'].description,/見識強哥/);
});

test('the tea badges distinguish observing the rating, checking names and finishing without an invented culprit',()=>{
 for(const index of [0,1,2])assert.ok(deriveAchievementsV61(fixture(`company-tea-0-${index}`)).includes('tea-star-and-half'));
 assert.ok(deriveAchievementsV61(fixture('company-tea-1-0')).includes('tea-name-check'));
 for(const index of [1,2])assert.ok(!deriveAchievementsV61(fixture(`company-tea-1-${index}`)).includes('tea-name-check'));
 assert.ok(deriveAchievementsV61(fixture('company-tea-2-0')).includes('tea-no-scapegoat'));
 for(const index of [1,2])assert.ok(!deriveAchievementsV61(fixture(`company-tea-2-${index}`)).includes('tea-no-scapegoat'));
 const before=fixture('company-tea-1-0');assert.ok(!deriveAchievementsV61(before).includes('tea-no-scapegoat'));
 const history=newStoryRows(fixture('company-tea-2-0'));assert.ok(history.every(row=>row.treatsOutcome.id==='company-tea'));
 assert.match(history.find(row=>row.treatsOutcome.stage===1).result,/沒有把別人的失誤硬寫成你的錯/);
});

test('birthday goals follow the chosen stage-one plan and require the actual final scene',()=>{
 const plans=['cake-jack-relief','cake-let-it-thaw','cake-goose-chair'];
 for(const index of [0,1,2]){
  const selected=fixture(`birthday-cake-1-${index}`);assert.ok(plans.every(id=>!deriveAchievementsV61(selected).includes(id)));
  const done=E.applyChoice(selected,0);assert.equal(done.pending,true);assert.equal(E.validRun(copy(done)),true);assert.deepEqual(deriveAchievementsV61(done).filter(id=>plans.includes(id)),[plans[index]]);
  const changed=copy(done);changed.history.at(-1).treatsOutcome.result=`cake-shared-${['wait','goose','help'][index]}`;
  assert.ok(plans.every(id=>!deriveAchievementsV61(changed).includes(id)));assert.equal(E.validRun(changed),false);
 }
 const firstGoose=fixture('birthday-cake-0-2'),thenHelp=E.advance(E.applyChoice(firstGoose,0)),finished=E.applyChoice(thenHelp,0);
 assert.ok(deriveAchievementsV61(finished).includes('cake-jack-relief'));assert.ok(!deriveAchievementsV61(finished).includes('cake-goose-chair'),'an early wild pause does not substitute for choosing and completing the goose plan');assert.equal(E.validRun(finished),true);
});

test('raw actions and exact resolved outcome fields must agree with each claimed stage',()=>{
 const final=routes.find(row=>row.id==='company-tea-2-0'),run=E.replayRun(final.roleId,final.seed,final.actions);
 const attacks=[
  value=>value.actions.pop(),
  value=>value.actions.at(-1).index=1,
  value=>value.actions.at(-1).eventId='onboarding',
  value=>value.actions.at(-1).reward='tea-no-scapegoat',
  value=>value.history.at(-1).choiceIndex=-1,
  value=>value.history.at(-1).treatsOutcome.version=2,
  value=>value.history.at(-1).treatsOutcome.done=false,
  value=>value.history.at(-1).treatsOutcome.accepted=false,
  value=>value.history.at(-1).treatsOutcome.target='jack',
  value=>value.history.at(-1).treatsOutcome.affinityDelta=99,
  value=>value.history.at(-1).treatsOutcome.result='cake-shared-help',
  value=>value.history.at(-1).treatsOutcome.reward='tea-no-scapegoat',
  value=>value.history.at(-1).verbalOutcome={version:2,kind:'ignored'},
  value=>value.history.at(-1).kind='daily',
  value=>value.history.at(-1).result='',
  value=>value.history.at(-1).choiceText='',
  value=>value.history.at(-1).breakdown=null,
 ];
 for(const attack of attacks){const forged=copy(run);attack(forged);assert.ok(!deriveAchievementsV61(forged).includes('tea-no-scapegoat'));assert.equal(E.validRun(forged),false);}
 const skipped=copy(run);skipped.history=skipped.history.filter(row=>row.eventId!=='treats61-company-tea-1');assert.ok(!deriveAchievementsV61(skipped).includes('tea-no-scapegoat'));assert.equal(E.validRun(skipped),false);
});

test('new goals are limited to r61 and cannot turn food stories into real or imagined hits',()=>{
 const source=E.replayRun(routes.at(-1).roleId,routes.at(-1).seed,routes.at(-1).actions);
 for(const seed of ['e39-r60-n-675df9dafeb46694ddfaa6','e39-r61-n-short','e39-r61-n-675df9dafeb46694ddfaa6-extra','e39-r60-s-0000000000000000000000'])assert.deepEqual(deriveAchievementsV61({...source,seed}),[]);
 const old=JSON.parse(readFileSync(new URL('./fixtures/achievement-milestones-v60.json',import.meta.url),'utf8')).routes;
 for(const row of old){const run=E.replayRun(row.roleId,row.seed,row.actions);assert.deepEqual(deriveAchievementsV61(run),[]);assert.equal(E.validRun(run),true);}
 assert.ok(deriveCharacterStats(source).every(row=>row.realHits===0&&row.imaginedHits===0));assert.ok(!deriveAchievements(source).some(id=>id==='rage-real'||id.startsWith('real-hit-')||id.startsWith('dream-')));
});

test('prefixes and pending feedback remain deterministic without advancing or redrawing the game',()=>{
 for(const route of routes){
  for(const length of [...new Set([0,1,Math.floor(route.actions.length/2),route.actions.length-1])]){
   const partial=E.replayRun(route.roleId,route.seed,route.actions.slice(0,length)),before=JSON.stringify(partial);assert.equal(E.validRun(copy(partial)),true);assert.deepEqual(deriveAchievementsV61(partial),deriveAchievementsV61(copy(partial)));assert.equal(JSON.stringify(partial),before);
  }
  const prior=E.replayRun(route.roleId,route.seed,route.actions.slice(0,-1)),last=route.actions.at(-1),pending=E.applyChoice(prior,last.index),before=JSON.stringify(pending);
  assert.equal(pending.pending,true);assert.deepEqual(deriveAchievementsV61(pending),route.expectedAchievements);assert.equal(JSON.stringify(pending),before);assert.deepEqual(E.advance(pending),E.replayRun(route.roleId,route.seed,route.actions));
 }
});
