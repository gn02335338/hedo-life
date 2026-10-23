import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import * as E from '../dist/engine.js';
import {ACHIEVEMENTS,ACHIEVEMENT_MAP,deriveAchievements} from '../dist/achievements.js';
import {ACHIEVEMENTS_V48} from '../dist/achievements-v48.js';
import {ACHIEVEMENTS_V60,deriveAchievementsV60} from '../dist/achievements-v60.js';
import {deriveCharacterStats} from '../dist/character-stats.js';
import {AchievementStore} from '../worker/achievements.js';
import {directEntryV60} from '../dist/recruitment-v60.js';

const copy=value=>JSON.parse(JSON.stringify(value)),ids=ACHIEVEMENTS_V60.map(row=>row.id),idSet=new Set(ids);
const {routes}=JSON.parse(readFileSync(new URL('./fixtures/achievement-milestones-v60.json',import.meta.url),'utf8'));
const runs=routes.map(route=>({route,run:E.replayRun(route.roleId,route.seed,route.actions)}));
const earned=run=>deriveAchievements(run).filter(id=>idSet.has(id));
const fixture=(file,id)=>{const row=JSON.parse(readFileSync(new URL(`./fixtures/${file}.json`,import.meta.url),'utf8')).routes.find(row=>row.id===id);assert.ok(row,id);return E.replayRun(row.roleId,row.seed,row.actions);};
const byBadge=id=>{const found=runs.find(({run})=>deriveAchievementsV60(run).includes(id));assert.ok(found,id);return found;};

test('thirty-two authored badges append without changing published IDs, illustrations or real/dream modes',()=>{
 assert.equal(ACHIEVEMENTS_V60.length,32);assert.deepEqual(ACHIEVEMENTS.slice(209),ACHIEVEMENTS_V60);assert.deepEqual(ACHIEVEMENTS.slice(149,209),ACHIEVEMENTS_V48);
 assert.equal(ACHIEVEMENTS.length,241);assert.equal(new Set(ACHIEVEMENTS.map(row=>row.id)).size,241);
 const art=new Set();
 for(const row of ACHIEVEMENTS_V60){
  assert.equal(ACHIEVEMENT_MAP[row.id],row);assert.match(row.id,/^[a-z]+(?:-[a-z]+)+$/);assert.ok(row.title.length>=4);assert.ok(row.description.length>=25);assert.equal(row.image,`./assets/achievements/${row.id}.svg`);
  const svg=readFileSync(new URL(`../dist/${row.image}`,import.meta.url),'utf8');art.add(svg);
  assert.match(svg,/<svg[^>]+viewBox="0 0 240 200"/);assert.match(svg,/role="img" aria-labelledby="[^"]+"/);assert.ok(svg.includes(`<title id="${row.id}-title">`));assert.match(svg,/<desc id="[^"]+">[^<]+<\/desc>/);assert.match(svg,/data-art-version="60"/);
  assert.doesNotMatch(svg,/<(?:script|foreignObject|image)\b|\bon\w+=|javascript:|(?:href|src)=["']https?:\/\//i);
  assert.equal(row.mode,undefined,'meeting arguments, status replies and accidental collisions are not actual or imagined punches');
 }
 assert.equal(art.size,32);
});

test('all new goals have canonical natural inputs, valid JSON saves and identical browser/server projections',()=>{
 const covered=new Set();assert.equal(routes.length,34);
 for(const {route,run}of runs){
  assert.deepEqual(Object.keys(route).sort(),['actions','expectedAchievements','id','roleId','seed']);assert.ok(route.actions.length>0&&route.actions.length<=300);
  const saved=copy(run),before=JSON.stringify(saved);assert.equal(E.validRun(saved),true,route.id);
  assert.deepEqual(deriveAchievementsV60(saved),route.expectedAchievements,route.id);assert.deepEqual(earned(saved),route.expectedAchievements,route.id);assert.equal(JSON.stringify(saved),before,'observing badges cannot spend, draw, change history or complete a life');
  assert.deepEqual(E.replayRun(saved.roleId,saved.seed,saved.actions),saved);route.expectedAchievements.forEach(id=>covered.add(id));
 }
 assert.deepEqual([...covered].sort(),[...ids].sort());
});

test('uncommitted menus, supplied badge lists, broad flags and names cannot manufacture these goals',()=>{
 for(const source of [null,undefined,{},[],{seed:'e39-forged',history:[],actions:[],flags:{recruitment60_appointed:1,shareholder58_owned:50,shareholder58_result:'minutes',activity55_basketball_bruise:1},achievements:ids,endingId:'nasdaq-system',completed:true}])assert.deepEqual(deriveAchievementsV60(source),[]);
 for(const {run}of runs){
  assert.deepEqual(deriveAchievementsV60({...run,history:[],achievements:ids}),[]);
  assert.deepEqual(deriveAchievementsV60({...run,actions:[],achievements:ids}),[]);
  assert.deepEqual(deriveAchievementsV60({...run,history:run.history.map(row=>({...row,choiceIndex:-1}))}),[]);
 }
 const entry=byBadge('kin-direct-son').run,raw=E.createRun(entry.roleId,entry.seed);
 assert.deepEqual(deriveAchievementsV60(raw),[]);assert.deepEqual(deriveAchievementsV60(E.enableActivitySchedule(raw)),[]);
 assert.equal(raw.patronage,null);assert.ok(directEntryV60(raw));
});

test('a receipt must prove its actual payment, a meeting its admission, and returning to work a later committed task',()=>{
 const offer=fixture('shareholder-routes-v58','offer');assert.deepEqual(deriveAchievementsV60(offer),[]);
 const paid=E.applyChoice(offer,0);assert.ok(deriveAchievementsV60(paid).includes('stock-receipt'));assert.ok(!deriveAchievementsV60(paid).includes('stock-heavy-bag'));assert.equal(E.validRun(copy(paid)),true);
 const lying={...paid,history:paid.history.map(row=>row.eventId==='shareholder58-offer'?{...row,delta:{...row.delta,cash:0}}:row)};
 assert.equal(deriveAchievementsV60(lying).includes('stock-receipt'),false);assert.equal(E.validRun(lying),false);
 const hearing=fixture('shareholder-routes-v58','hearing');assert.ok(deriveAchievementsV60(hearing).includes('shareholder-own-chair'));assert.ok(!deriveAchievementsV60(hearing).includes('shareholder-first-objection'));
 const noReceipt={...hearing,history:hearing.history.filter(row=>row.eventId!=='shareholder58-offer')};assert.ok(!deriveAchievementsV60(noReceipt).includes('shareholder-own-chair'));
 const finalBeforeConfirmation=fixture('shareholder-routes-v58','finish-prepared');assert.ok(!deriveAchievementsV60(finalBeforeConfirmation).includes('shareholder-four-minutes'));
 const final=E.applyChoice(finalBeforeConfirmation,0);assert.ok(deriveAchievementsV60(final).includes('shareholder-four-minutes'));assert.ok(!deriveAchievementsV60(final).includes('shareholder-back-to-work'));
 const returning=byBadge('shareholder-back-to-work').run;assert.ok(deriveAchievementsV60(returning).includes('shareholder-back-to-work'));
 assert.ok(!deriveAchievementsV60({...returning,history:returning.history.filter(row=>!['daily','fantasy'].includes(row.kind))}).includes('shareholder-back-to-work'));
});

test('interactive badges require measured raw inputs paired with the actual resolved performance',()=>{
 const interactiveIds=ids.filter(id=>id.startsWith('play-'));
 for(const {run}of runs.filter(({run})=>run.history.some(row=>row.activityOutcome?.performance))){
  const before=JSON.stringify(run),noActions={...run,actions:run.actions.filter(action=>action.type!=='activity-play')};assert.ok(interactiveIds.every(id=>!deriveAchievementsV60(noActions).includes(id)));
  const inflated={...run,history:run.history.map(row=>!row.activityOutcome?.performance?row:{...row,activityOutcome:{...row.activityOutcome,performance:{...row.activityOutcome.performance,score:999}}})};
  assert.ok(interactiveIds.every(id=>!deriveAchievementsV60(inflated).includes(id)));assert.equal(E.validRun(inflated),false);
  const clientGrade={...run,actions:run.actions.map(action=>action.type==='activity-play'?{...action,input:{...action.input,grade:2}}:action)};
  assert.ok(interactiveIds.every(id=>!deriveAchievementsV60(clientGrade).includes(id)));assert.equal(E.validRun(clientGrade),false);
  assert.equal(JSON.stringify(run),before);
 }
});

test('actual ball-court collisions earn rest badges only after sitting out, and never become a punched-person badge',()=>{
 for(const target of ['sonny','owen']){
  const {route,run}=byBadge(`play-basket-${target}-bench`),beforeRest=E.replayRun(route.roleId,route.seed,route.actions.slice(0,-1));
  assert.equal(beforeRest.eventId,'activity44-basketball-2');assert.equal(beforeRest.history.at(-1).activityOutcome.performance.injured,true);assert.equal(beforeRest.history.at(-1).activityOutcome.performance.injuryTarget,target);
  assert.ok(!deriveAchievementsV60(beforeRest).includes(`play-basket-${target}-bench`));
  const stayed=E.applyChoice(beforeRest,0);assert.ok(!deriveAchievementsV60(stayed).includes(`play-basket-${target}-bench`));assert.equal(E.validRun(stayed),true);
  const rested=E.applyChoice(beforeRest,1);assert.ok(deriveAchievementsV60(rested).includes(`play-basket-${target}-bench`));assert.equal(E.validRun(rested),true);
  assert.ok(deriveCharacterStats(run).every(row=>row.realHits===0&&row.imaginedHits===0));assert.ok(!deriveAchievements(run).some(id=>id.startsWith('real-hit-')||id==='rage-real'));
  const noCollision={...run,history:run.history.map(row=>!row.activityOutcome?.performance?row:{...row,activityOutcome:{...row.activityOutcome,performance:{...row.activityOutcome.performance,injured:false,injuryTarget:null}}})};
  assert.ok(!deriveAchievementsV60(noCollision).includes(`play-basket-${target}-bench`));assert.equal(E.validRun(noCollision),false);
 }
 const dreamed=JSON.parse(readFileSync(new URL('./fixtures/rage-achievement-routes.json',import.meta.url),'utf8')).routes;
 for(const route of dreamed){const run=E.replayRun(route.roleId,route.seed,route.actions);assert.ok(!deriveAchievementsV60(run).some(id=>id.startsWith('play-basket-')));}
});

test('direct appointments, rejected offers and welcome choices are awarded after their specific committed conversation',()=>{
 for(const kind of ['son','daughter']){
  const {route}=byBadge(`kin-direct-${kind}`),source=E.replayRun(route.roleId,route.seed,route.actions.slice(0,-1));assert.equal(source.eventId,'onboarding');assert.ok(!deriveAchievementsV60(source).includes(`kin-direct-${kind}`));
  const appointment=E.applyChoice(source,0);assert.ok(deriveAchievementsV60(appointment).includes(`kin-direct-${kind}`));assert.equal(E.validRun(appointment),true);assert.equal(appointment.history.at(-1).recruitmentOutcome.kind,'appointment');
  assert.ok(!deriveAchievementsV60(appointment).includes('kin-application-approved'),'direct entry cannot pretend an older earned application occurred');
 }
 for(const [id,eventId]of [['kin-rick-boundary','recruitment60-rick'],['kin-princess-english','recruitment60-princess']]){
  const {route}=byBadge(id),source=E.replayRun(route.roleId,route.seed,route.actions.slice(0,-1));assert.equal(source.eventId,eventId);assert.ok(!deriveAchievementsV60(source).includes(id));
  for(const index of [1,2])assert.ok(!deriveAchievementsV60(E.applyChoice(source,index)).includes(id),'other replies are legitimate stories, not the same specific feat');
  const answer=E.applyChoice(source,0);assert.ok(deriveAchievementsV60(answer).includes(id));assert.equal(E.validRun(answer),true);
 }
 const refused=byBadge('kin-offer-declined').run;assert.equal(refused.patronage,null);assert.ok(!deriveAchievementsV60(refused).some(id=>id==='kin-direct-son'||id==='kin-direct-daughter'));
});

test('a surviving onboarding outburst must commit its exact accept or decline decision before earning a direct-entry badge',()=>{
 const aliases=routes.filter(route=>route.id.startsWith('verbal-alias-'));assert.equal(aliases.length,4);
 for(const route of aliases){
  const run=E.replayRun(route.roleId,route.seed,route.actions),decision=route.actions.at(-1),source=E.replayRun(route.roleId,route.seed,route.actions.slice(0,-1));
  assert.equal(decision.eventId,'verbal-v2-decision');assert.ok([0,1].includes(decision.index));assert.equal(source.eventId,'verbal-v2-decision');assert.equal(source.patronage,null);assert.deepEqual(deriveAchievementsV60(source),[]);
  const expected=decision.index===1?'kin-offer-declined':`kin-direct-${run.history.at(-1).recruitmentOutcome.variant}`;
  assert.deepEqual(deriveAchievementsV60(run),[expected]);assert.ok(!route.actions.some(action=>action.type==='choice'&&action.eventId==='onboarding'));
  const pending=E.applyChoice(source,decision.index);assert.equal(pending.pending,true);assert.deepEqual(deriveAchievementsV60(pending),[expected]);assert.equal(E.validRun(copy(pending)),true);assert.deepEqual(E.advance(pending),run);
  const spoke=run.history.find(row=>row.verbalOutcome?.version===2);assert.equal(spoke.eventId,'onboarding');assert.equal(spoke.verbalOutcome.origin,'onboarding');assert.equal(spoke.verbalOutcome.phase,'event');
  const attacks=[
   value=>value.actions.pop(),
   value=>value.actions=value.actions.filter(action=>action.type!=='verbal'),
   value=>value.actions.find(action=>action.type==='verbal').phase='result',
   value=>value.actions.find(action=>action.type==='verbal').version=1,
   value=>value.actions.find(action=>action.type==='verbal').eventId='raise-request',
   value=>value.actions.find(action=>action.type==='verbal').target='not-present',
   value=>value.actions.at(-1).index=decision.index===0?1:0,
   value=>value.actions.at(-1).eventId='career-review',
   value=>value.history.find(row=>row.verbalOutcome?.version===2).verbalOutcome.phase='result',
   value=>value.history.find(row=>row.verbalOutcome?.version===2).verbalOutcome.origin='raise-request',
   value=>value.history=value.history.filter(row=>row.eventId!=='verbal-v32-aftermath'),
  ];
  for(const attack of attacks){const forged=copy(run);attack(forged);assert.ok(!deriveAchievementsV60(forged).includes(expected),route.id);assert.equal(E.validRun(forged),false,'the server also refuses this altered proof');}
 }
});

test('the onboarding decision alias also preserves an actually completed formal-explanation detour',()=>{
 let source;
 for(let i=0;i<100;i++){
  const seed=`e39-r60-s-${i.toString(16).padStart(22,'0')}`,entry=directEntryV60(seed),candidate=E.enableActivitySchedule(E.createRun(entry.roleId,seed)),spoken=E.requestVerbal(candidate,undefined,2);
  if(spoken.history.at(-1)?.verbalOutcome?.kind==='legal'){source=E.advance(spoken);break;}
 }
 assert.ok(source,'a real seeded formal-explanation witness exists');assert.equal(source.eventId,'verbal-v32-aftermath');
 let run=E.advance(E.applyChoice(source,3));assert.equal(run.eventId,'verbal-v2-legal');run=E.advance(E.applyChoice(run,0));assert.equal(run.eventId,'verbal-v2-legal-result');run=E.advance(E.applyChoice(run,0));assert.equal(run.eventId,'verbal-v2-decision');
 assert.deepEqual(deriveAchievementsV60(run),[]);const accepted=E.applyChoice(run,0);assert.deepEqual(deriveAchievementsV60(accepted),['kin-direct-son']);assert.equal(E.validRun(copy(accepted)),true);assert.deepEqual(E.replayRun(accepted.roleId,accepted.seed,accepted.actions),E.advance(accepted));
 const mismatched=copy(accepted),legal=mismatched.actions.find(action=>action.eventId==='verbal-v2-legal');legal.index=3;
 assert.ok(!deriveAchievementsV60(mismatched).includes('kin-direct-son'));assert.equal(E.validRun(mismatched),false);
});

test('application and status-reply proofs can earn new badges, including retained historical lives, without rewriting them',()=>{
 for(const id of ['kin-application-approved','kin-application-rejected','kin-upward-applause','kin-downward-rebound']){
  const {run}=byBadge(id),before=JSON.stringify(run);
  if(id!=='kin-upward-applause')assert.ok(!run.seed.startsWith('e39-r60-'),'these badges have genuine historical witnesses');
  assert.ok(deriveAchievementsV60(run).includes(id));assert.equal(E.validRun(copy(run)),true);assert.equal(JSON.stringify(run),before);assert.deepEqual(E.replayRun(run.roleId,run.seed,run.actions),run);
  const noEvidence={...run,history:run.history.map(row=>{const copy={...row};delete copy.patronageOutcome;delete copy.patronageApplicationOutcome;return copy;})};assert.ok(!deriveAchievementsV60(noEvidence).includes(id));
 }
});

test('saved action boundaries remain deterministic and achievements cannot move a pending game forward',()=>{
 for(const {route,run}of runs){
  for(const length of [...new Set([0,1,Math.floor(route.actions.length/2),route.actions.length-1])].filter(n=>n>=0)){
   const partial=E.replayRun(route.roleId,route.seed,route.actions.slice(0,length)),before=JSON.stringify(partial);assert.equal(E.validRun(copy(partial)),true);
   assert.deepEqual(deriveAchievementsV60(partial),deriveAchievementsV60(copy(partial)));assert.equal(JSON.stringify(partial),before);
  }
  assert.deepEqual(E.replayRun(route.roleId,route.seed,route.actions),run);
 }
});

test('the existing anonymous achievement store records the same new goals and deduplicates without retaining transcripts',async t=>{
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());db.exec('CREATE TABLE players (id TEXT PRIMARY KEY); CREATE TABLE runs (id TEXT PRIMARY KEY,player_id TEXT,role_id TEXT,ending_id TEXT);');
 const sql={exec(query,...values){let rows=[];if(!values.length&&query.includes(';'))db.exec(query);else{const statement=db.prepare(query);rows=statement.columns().length?statement.all(...values):(statement.run(...values),[]);}return {toArray:()=>rows};}};
 const storage={transactionSync(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}}};
 const store=new AchievementStore(sql,storage),player='anonymous-owner';sql.exec('INSERT INTO players (id) VALUES (?)',player);const covered=new Set();
 for(const {run}of runs){
  const runId=randomUUID(),now='2026-10-23T08:00:00.000Z',added=await store.record(player,runId,run,now);assert.ok(added.every(id=>ACHIEVEMENT_MAP[id]));
  assert.deepEqual(await store.record(player,runId,run,'2026-10-24T08:00:00.000Z'),[]);for(const row of store.snapshot(player))if(idSet.has(row.id)){covered.add(row.id);assert.equal(row.unlockedAt,now);}
 }
 assert.deepEqual([...covered].sort(),[...ids].sort());assert.deepEqual(store.snapshot('another-anonymous-owner'),[]);
 const columns=sql.exec('PRAGMA table_info(player_achievements)').toArray().map(row=>row.name);assert.deepEqual(columns,['player_id','achievement_id','first_seen_at']);
});
