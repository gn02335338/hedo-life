import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ACHIEVEMENTS,ACHIEVEMENT_MAP,ACHIEVEMENT_GROUPS,deriveAchievements} from '../dist/achievements.js';
import {createRun,getEvent,applyChoice,advance,requestRage,replayRun,validRun} from '../dist/engine.js';

const copy=value=>JSON.parse(JSON.stringify(value));
const choose=(run,index)=>advance(applyChoice(run,index));

test('32 distinct illustrated achievements contain complete Traditional Chinese copy and safe local art',()=>{
 assert.equal(ACHIEVEMENTS.length,32);
 assert.equal(new Set(ACHIEVEMENTS.map(item=>item.id)).size,32);
 assert.deepEqual(Object.keys(ACHIEVEMENT_MAP),ACHIEVEMENTS.map(item=>item.id));
 const pictures=new Set();
 for(const achievement of ACHIEVEMENTS){
  assert.ok(Object.hasOwn(ACHIEVEMENT_GROUPS,achievement.group));
  assert.ok(achievement.title.trim().length>=4);assert.ok(achievement.description.trim().length>=15);
  assert.match(achievement.image,/^\.\/assets\/achievements\/[a-z-]+\.svg$/);
  const svg=readFileSync(new URL(`../dist/${achievement.image}`,import.meta.url),'utf8');
  assert.match(svg,/<svg\b/);assert.match(svg,/viewBox=/);
  assert.doesNotMatch(svg,/<script\b|\bon\w+=|javascript:|(?:href|src)=["']https?:\/\//i);
  pictures.add(svg);
 }
 assert.ok(pictures.size>=24,'the collection has distinct illustrations, rather than one repeated letter avatar');
});

test('derivation is deterministic and read-only; unopened choices, cancelled rage and supplied IDs earn nothing',()=>{
 for(const empty of [null,undefined,{},[],{history:[]}, {achievements:ACHIEVEMENTS.map(item=>item.id)}])assert.deepEqual(deriveAchievements(empty),[]);
 const run=createRun('system','e13-achievement-cancel'),original=copy(run);
 assert.deepEqual(deriveAchievements(run),[]);assert.deepEqual(run,original);
 const menu=requestRage(run);assert.deepEqual(deriveAchievements(menu),[]);
 const cancelled=choose(menu,getEvent(menu).choices.findIndex(choice=>!choice.rageTarget));
 assert.deepEqual(deriveAchievements(cancelled),[]);
 const pending=applyChoice(run,0),earned=deriveAchievements(pending);
 assert.ok(earned.includes('work-card'),'achievement appears only after the choice resolves');
 assert.deepEqual(deriveAchievements(copy(pending)),earned);
 assert.equal(new Set(earned).size,earned.length);
});

test('each rage target has a distinct badge, earned only by a committed natural attempt',()=>{
 const people=['wing','spencer','rick','hope','erich','jenjen','sonny','kind'];
 for(const [index,person]of people.entries()){
  const run=createRun('system',`e13-badge-${person}`),menu=requestRage(run);
  assert.ok(!deriveAchievements(menu).includes(`rage-${person}`));
  const pending=applyChoice(menu,index),resolved=advance(pending),before=copy(pending);
  const earned=deriveAchievements(pending);
  assert.ok(earned.includes(`rage-${person}`),person);
  assert.equal(earned.filter(id=>people.some(other=>id===`rage-${other}`)).length,1);
  assert.deepEqual(deriveAchievements(copy(pending)),earned);assert.deepEqual(pending,before);
  assert.equal(validRun(copy(pending)),true);
  assert.deepEqual(replayRun(resolved.roleId,resolved.seed,resolved.actions),resolved);
 }
});

test('career goals require accomplishments rather than an executive starting title',()=>{
 const executive=createRun('executive','e13-executive-not-earned');
 assert.equal(executive.rank,2);assert.ok(!deriveAchievements(executive).includes('manager'));
 const base={history:[],flags:{career_peak_rank:3},completed:false};
 assert.ok(!deriveAchievements(base).includes('director'));
 const promoted=deriveAchievements({...base,flags:{...base.flags,promotions:1}});
 for(const id of ['promotion','manager','director'])assert.ok(promoted.includes(id));
 assert.ok(!deriveAchievements({...base,flags:{promotions:1,career_peak_rank:1}}).includes('manager'));
 const care=indices=>({history:indices.map(choiceIndex=>({eventId:'self-care',choiceIndex})),flags:{}});
 assert.ok(!deriveAchievements(care([0,1])).includes('self-care'));
 assert.ok(!deriveAchievements(care([3,3,3])).includes('self-care'),'free cancellation is not paid recovery');
 assert.ok(deriveAchievements(care([0,1,2])).includes('self-care'));
 assert.ok(!deriveAchievements({endingId:'nasdaq-system',completed:false}).includes('nasdaq'));
 assert.ok(deriveAchievements({endingId:'nasdaq-system',completed:true}).includes('nasdaq'));
});

test('published complete routes derive real onboarding, PIP, salary and career achievements without changing saves',()=>{
 const fixtures=JSON.parse(readFileSync(new URL('./fixtures/legacy-e12-routes.json',import.meta.url),'utf8'));
 const covered=new Set();
 for(const fixture of fixtures){
  const run=replayRun(fixture.roleId,fixture.seed,fixture.actions),before=copy(run),earned=deriveAchievements(run);
  assert.deepEqual(deriveAchievements(copy(run)),earned);assert.deepEqual(copy(run),before);
  assert.ok(earned.includes('work-card'));assert.ok(earned.includes('first-ending'));
  for(const id of earned){assert.ok(Object.hasOwn(ACHIEVEMENT_MAP,id));covered.add(id);}
 }
 for(const id of ['assistant','switch','robot','promotion','manager','director','pip','pip-pass','pay-cut','education','kind-decline','nasdaq'])assert.ok(covered.has(id),`natural goal ${id}`);
});

test('natural banquet choices unlock attendance, sharing and Kind’s ghosting, without guessing a future lottery',()=>{
 const actions=[['onboarding',0],['pm-human-buffer',1],['education-scrutiny',0],['salary-cut',0],['crisis-mood',1],['video-designer-benchmark',1],['copy-master-late',1],['dp-job-three-conditions',2],['rick-architecture-relic',1],['crisis-mood',1],['attendance-accidental-admin',1],['video-message-workout',1],['rick-two-voices',1],['crisis-mood',1],['wing-message-lottery',1]].map(([eventId,index])=>({type:'choice',eventId,index}));
 let run=replayRun('system','e13-natural-party-0',actions);
 assert.equal(run.eventId,'banquet-welcome');assert.ok(!deriveAchievements(run).includes('banquet'));
 run=choose(run,0);assert.ok(deriveAchievements(run).includes('banquet'));
 assert.ok(!deriveAchievements(run).includes('kind-ghost'));
 run=choose(run,0);assert.equal(run.eventId,'banquet-afterparty');
 assert.ok(!deriveAchievements(run).includes('kind-ghost'),'the invite has not happened yet');
 const cash=run.stats.cash;run=choose(run,1);
 assert.equal(run.stats.cash,cash);assert.ok(deriveAchievements(run).includes('kind-ghost'));
 assert.equal(validRun(copy(run)),true);
 assert.deepEqual(deriveAchievements(replayRun(run.roleId,run.seed,run.actions)),deriveAchievements(run));
});
