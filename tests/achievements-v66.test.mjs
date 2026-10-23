import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as E from '../dist/engine.js';
import {ACHIEVEMENTS,ACHIEVEMENT_MAP,ACHIEVEMENT_GROUPS,deriveAchievements} from '../dist/achievements.js';
import {ACHIEVEMENTS_V66,ACHIEVEMENT_RULES_V66,ACHIEVEMENT_COUNTS_V66,deriveAchievementsV66} from '../dist/achievements-v66.js';
import {renderAchievementBadgeV66} from '../dist/achievement-badge-art-v66.js';
import {buildEndingReport} from '../dist/ending-report.js';
import {EVENTS} from '../dist/events.js';
import {calendarDailyAllowedV46} from '../dist/activity-schedule-v46.js';
import {officeTreatDailyAllowedV61} from '../dist/office-treats-v61.js';
import {isExpansionV66} from '../dist/expansion-profile-v66.js';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/achievement-milestones-v66.json',import.meta.url),'utf8'));
const copy=x=>JSON.parse(JSON.stringify(x));
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};

test('750 distinct new goals append to the unchanged 250-card collection, with 1000 distinct names and original safe vector art',()=>{
 assert.equal(ACHIEVEMENTS.length,1000);assert.equal(ACHIEVEMENTS_V66.length,750);assert.deepEqual(ACHIEVEMENTS.slice(250),ACHIEVEMENTS_V66);assert.equal(new Set(ACHIEVEMENTS.map(x=>x.id)).size,1000);assert.equal(new Set(ACHIEVEMENTS.map(x=>x.title)).size,1000);
 assert.deepEqual(ACHIEVEMENT_COUNTS_V66,{characterStories:336,professionStories:156,relationships:168,activities:48,finance:12,careerAndAbilities:15,otherMilestones:15});
 const pairs=new Set(),art=new Set(),visuals=new Set();
 for(const spec of ACHIEVEMENT_RULES_V66){const card=ACHIEVEMENT_MAP[spec.id];assert.ok(card.title.length>=4);assert.ok(card.description.length>=30);assert.ok(ACHIEVEMENT_GROUPS[card.group]);assert.equal(card.image,`./assets/achievements/${spec.id}.svg`);
  const svg=readFileSync(new URL(`../dist/${card.image}`,import.meta.url),'utf8');assert.equal(svg,renderAchievementBadgeV66(spec));assert.match(svg,/viewBox="0 0 240 200".*role="img"/);assert.match(svg,/data-art-version="66"/);assert.doesNotMatch(svg,/<(?:script|image|foreignObject)\b|\bon\w+=|javascript:|(?:href|src)=["']https?:/i);art.add(svg);visuals.add(svg.replace(/<title.*?<\/title>|<desc.*?<\/desc>/g,'').replace(/aria-labelledby="[^"]*"/,'').replace(/id="[^"]*"/g,''));
  if(['character','profession'].includes(spec.kind)){const key=`${spec.eventId}/${spec.choiceIndex}`;assert.ok(!pairs.has(key),key);pairs.add(key);assert.ok([0,1,2].includes(spec.choiceIndex));if(spec.kind==='profession')assert.ok(spec.owner);}
 }
 assert.equal(pairs.size,492);assert.equal(art.size,750);assert.ok(visuals.size>=300,'the badge system contains distinct graphical compositions, not only different metadata');
});

test('every authored story has a current r66 calendar window; replaced party scenes cannot become unreachable new badges',()=>{
 const probe={seed:'e39-r66-n-'+'0'.repeat(22),turn:19,flags:{activity46_enabled:1,activity44_banquet:1}},byId=new Map(EVENTS.map(event=>[event.id,event]));assert.equal(isExpansionV66(probe),true);
 for(const spec of ACHIEVEMENT_RULES_V66.filter(row=>['character','profession'].includes(row.kind))){const event=byId.get(spec.eventId);assert.ok(event,spec.id);assert.equal(calendarDailyAllowedV46(probe,event),true,spec.id);assert.equal(officeTreatDailyAllowedV61(probe,event),true,spec.id);assert.ok((event.minTurn??0)<=19&&Math.max(1,event.minTurn??0)<=(event.maxTurn??19),spec.id);}
 for(const group of ['a','b'])for(const choice of ['first','second','third']){const spec=ACHIEVEMENT_RULES_V66.find(row=>row.id===`tale-meimei-${group}-${choice}`);assert.match(spec.eventId,/^cast66-meimei-/);}
});

test('six retained water-snake IDs require their current r66 scenes and cannot be awarded by the replaced party snippets',()=>{
 const ids=new Set(ACHIEVEMENT_RULES_V66.filter(row=>/^tale-meimei-[ab]-/.test(row.id)).map(row=>row.id));assert.equal(ids.size,6);
 for(const source of fixture.sources.filter(row=>/^cast66-meimei-/.test(row.eventId))){const run=E.replayRun(source.roleId,source.seed,source.actions);assert.ok([...ids].every(id=>!deriveAchievementsV66(run).includes(id)));
  for(const index of [0,1,2]){const pending=E.applyChoice(run,index),earned=deriveAchievementsV66(pending).filter(id=>ids.has(id));assert.equal(earned.length,1);const older={...pending,seed:pending.seed.replace('-r66-','-r65-')};assert.ok(deriveAchievementsV66(older).every(id=>!ids.has(id)));}
 }
 for(const route of fixture.routes.filter(row=>row.actions.some(action=>['cast35-meimei-first-love-enlist','cast35-meimei-sober-label'].includes(action.eventId)))){const run=E.replayRun(route.roleId,route.seed,route.actions);assert.ok(deriveAchievementsV66(run).every(id=>!ids.has(id)));}
});

test('all 492 authored story choices have real public-action witnesses with explicit profession identity',()=>{
 const covered=new Set();assert.equal(fixture.sources.length,164);
 for(const source of fixture.sources){const run=E.replayRun(source.roleId,source.seed,source.actions);assert.equal(E.getEvent(run).id,source.eventId);assert.equal(E.isWorkGapOpenV50(run),false);
  for(const index of [0,1,2]){const pending=E.applyChoice(run,index),rule=ACHIEVEMENT_RULES_V66.find(s=>s.eventId===source.eventId&&s.choiceIndex===index);assert.ok(rule);assert.equal(pending.pending,true);assert.ok(deriveAchievementsV66(pending).includes(rule.id),rule.id);covered.add(rule.id);if(rule.kind==='profession')assert.equal(pending.actualRoleId,rule.owner);}
 }
 assert.equal(covered.size,492);
});

test('natural milestone proofs are canonical, read-only and cover each new kind without trusting client flags',()=>{
 const covered=new Set(),kinds=new Set();assert.ok(fixture.routes.length>=100);
 for(const route of fixture.routes){const run=E.replayRun(route.roleId,route.seed,route.actions),before=JSON.stringify(run),earned=deriveAchievementsV66(run);assert.deepEqual(earned,route.expected,route.id);assert.equal(buildEndingReport(run).metadata.complete,true);assert.equal(JSON.stringify(run),before);earned.forEach(id=>{covered.add(id);kinds.add(ACHIEVEMENT_RULES_V66.find(s=>s.id===id).kind);});}
 assert.deepEqual(fixture.missing,[]);assert.equal(covered.size,750);assert.deepEqual([...covered].sort(),ACHIEVEMENTS_V66.map(item=>item.id).sort());assert.deepEqual([...kinds].sort(),['activity','advanced','character','profession','social']);
 for(const empty of [null,{},[],{seed:'e39-r66-n-0000000000000000000000',history:[],actions:[],flags:{promotions:99,rage_real:99},achievements:ACHIEVEMENTS_V66.map(x=>x.id)}])assert.deepEqual(deriveAchievementsV66(empty),[]);
});

test('opening, cancelling or forging a choice cannot substitute for committed evidence',()=>{
 const source=fixture.sources.find(x=>/^e39-/.test(x.seed)),run=E.replayRun(source.roleId,source.seed,source.actions),rule=ACHIEVEMENT_RULES_V66.find(s=>s.eventId===source.eventId&&s.choiceIndex===0);assert.ok(!deriveAchievementsV66(run).includes(rule.id));
 const pending=E.applyChoice(run,0),earned=deriveAchievementsV66(pending);assert.ok(earned.includes(rule.id));
 for(const mutate of [x=>x.actions.pop(),x=>x.history.pop(),x=>x.actions.at(-1).index=2,x=>x.history.at(-1).choiceIndex=2,x=>x.history.at(-1).delta.energy=999]){const forged=copy(pending);mutate(forged);assert.deepEqual(deriveAchievementsV66(forged),[]);}
 const fake=copy(run);fake.flags={...fake.flags,rage_real:999,rage_imagined:999,verbal_count:999};fake.achievements=ACHIEVEMENTS_V66.map(x=>x.id);assert.deepEqual(deriveAchievementsV66(fake),deriveAchievementsV66(run));
});

test('dream and real aftermath souvenirs remain separate; reading a frozen save never redraws or advances it',()=>{
 const dreamRoute=fixture.routes.find(row=>row.expected.some(id=>id.endsWith('-dream-work'))),realRoute=fixture.routes.find(row=>row.expected.some(id=>id.endsWith('-real-work')));assert.ok(dreamRoute);assert.ok(realRoute);
 for(const route of [dreamRoute,realRoute]){const run=freeze(E.replayRun(route.roleId,route.seed,route.actions)),before=JSON.stringify(run),original=Math.random;Math.random=()=>{throw Error('achievement view must not draw RNG')};try{assert.deepEqual(deriveAchievementsV66(run),route.expected);assert.deepEqual(deriveAchievements(run).slice(-route.expected.length),route.expected);}finally{Math.random=original;}assert.equal(JSON.stringify(run),before);}
 const dream=E.replayRun(dreamRoute.roleId,dreamRoute.seed,dreamRoute.actions);for(const id of deriveAchievementsV66(dream).filter(x=>x.endsWith('-real-work'))){const person=ACHIEVEMENT_RULES_V66.find(x=>x.id===id).person;assert.ok(dream.history.some(row=>row.eventId==='rage-release'&&row.speaker===person&&row.eventOutcome?.result==='真的失控了'));}
});

test('salary reductions and raises do not throw when an older save backfills new finance goals',()=>{
 const routes=JSON.parse(readFileSync(new URL('./fixtures/event-departure-v63.json',import.meta.url),'utf8')).routes;
 for(const id of ['salary','career-review','raise-offer']){const row=routes.find(r=>r.id===id);if(!row)continue;const run=E.replayRun(row.roleId,row.seed,row.actions);assert.doesNotThrow(()=>deriveAchievements(run));}
});
