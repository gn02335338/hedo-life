import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ACHIEVEMENTS,ACHIEVEMENT_MAP,ACHIEVEMENT_GROUPS,deriveAchievements} from '../dist/achievements.js';
import {ACHIEVEMENTS_V32,VERBAL_ACHIEVEMENTS_V32,COMPANY_ACHIEVEMENTS_V32,deriveAchievementsV32,hasCompanyFinaleV32} from '../dist/achievements-v32.js';
import {VERBAL_ENDING_IDS_V32} from '../dist/verbal-outcomes-v32.js';
import {COMPANY_ENDING_IDS_V32} from '../dist/company-v32.js';
import {createRun,getEvent,applyChoice,advance,requestVerbal,replayRun,validRun} from '../dist/engine.js';
import {deriveCharacterStats} from '../dist/character-stats.js';

const {routes}=JSON.parse(readFileSync(new URL('./fixtures/v32-routes.json',import.meta.url),'utf8'));
const milestones=JSON.parse(readFileSync(new URL('./fixtures/achievement-milestones-v32.json',import.meta.url),'utf8')).routes;
const copy=value=>JSON.parse(JSON.stringify(value));
const ids=ACHIEVEMENTS_V32.map(item=>item.id),idSet=new Set(ids);
const earned=run=>deriveAchievements(run).filter(id=>idSet.has(id));
// A search goal can incidentally discover a different RNG branch. The
// committed ending, rather than that goal, identifies the proof's family.
const runs=routes.map(route=>({route,family:route.ending.slice(0,-route.roleId.length-1),run:replayRun(route.roleId,route.seed,route.actions)}));
const endingIds=new Set([...VERBAL_ACHIEVEMENTS_V32.slice(0,12),...COMPANY_ACHIEVEMENTS_V32].map(item=>item.id));
const earnedEndings=run=>earned(run).filter(id=>endingIds.has(id));
const byFamily=new Map(runs.map(entry=>[entry.family,entry]));

test('twenty-six illustrated goals join the catalogue in a dedicated verbal collection without replacing old IDs',()=>{
 assert.equal(ACHIEVEMENTS_V32.length,26);
 assert.equal(VERBAL_ACHIEVEMENTS_V32.length,17);assert.equal(COMPANY_ACHIEVEMENTS_V32.length,9);
 assert.equal(ACHIEVEMENT_GROUPS.verbal,'口舌風波');
 assert.equal(new Set(ids).size,26);
 assert.deepEqual(ACHIEVEMENTS.slice(123,149),ACHIEVEMENTS_V32);
 for(const item of ACHIEVEMENTS_V32){
  assert.equal(ACHIEVEMENT_MAP[item.id],item);
  assert.equal(item.image,`./assets/achievements/${item.id}.svg`);
  assert.ok(item.title.trim().length>=4);assert.ok(item.description.trim().length>=25);
  assert.equal(item.group,item.id.startsWith('verbal-')?'verbal':'career');
 }
});

test('every new badge has its own accessible code-native illustration rather than an external photo or script',()=>{
 const artwork=new Set();
 for(const item of ACHIEVEMENTS_V32){
  const svg=readFileSync(new URL(`../dist/assets/achievements/${item.id}.svg`,import.meta.url),'utf8');
  assert.match(svg,/<svg[^>]+viewBox="0 0 240 200"/);
  assert.match(svg,/<title id="[^"]+">[^<]+<\/title>/);
  assert.match(svg,/<desc id="[^"]+">[^<]+<\/desc>/);
  assert.match(svg,/role="img" aria-labelledby="[^"]+"/);
  assert.doesNotMatch(svg,/<(?:script|foreignObject|image)\b|\bon\w+\s*=|(?:href|src)\s*=|https?:\/\/(?!www\.w3\.org\/2000\/svg)/i);
  artwork.add(svg);
 }
 assert.equal(artwork.size,26);
});

test('all 286 natural current-cohort company and verbal ending proofs derive their own completed branch and preserve canonical saves',()=>{
 assert.equal(routes.length,286);
 const covered=new Set();
 for(const {route,family,run}of runs){
  assert.match(route.seed,/^e32-/);
  assert.equal(run.completed,true,route.ending);assert.equal(run.endingId,route.ending);
  assert.equal(validRun(copy(run)),true,route.ending);
  const before=JSON.stringify(run),goals=earned(run);
  assert.deepEqual(deriveAchievementsV32(run),goals);
  assert.deepEqual(earned(copy(run)),goals);assert.equal(JSON.stringify(run),before);
  if(VERBAL_ENDING_IDS_V32.includes(family)){
   assert.equal(earnedEndings(run).length,1,route.ending);
   assert.ok(goals.includes('verbal-first-word'));
   assert.equal(run.history.at(-1).eventId,'verbal-v32-aftermath');
  }else{
   assert.ok(COMPANY_ENDING_IDS_V32.includes(family));
   assert.equal(earnedEndings(run).length,family==='nasdaq'?0:1,route.ending);
   assert.equal(hasCompanyFinaleV32(run,family),true,route.ending);
  }
  for(const id of goals)covered.add(id);
 }
 for(const route of milestones)for(const id of earned(replayRun(route.roleId,route.seed,route.actions)))covered.add(id);
 assert.deepEqual(ids.filter(id=>covered.has(id)),ids,'all 26 new goals have natural game-action evidence');
});

test('reaching a follow-up or resolving its draw is insufficient until that distinct ending actually completes',()=>{
 for(const {route,run}of byFamily.values()){
  const menu=replayRun(route.roleId,route.seed,route.actions.slice(0,-1)),last=route.actions.at(-1);
  assert.equal(last.type,'choice');assert.equal(menu.eventId,last.eventId);
  assert.deepEqual(earnedEndings(menu),[]);
  const pending=applyChoice(menu,last.index);
  assert.equal(pending.pending,true);assert.equal(pending.completed,false);
  assert.deepEqual(earnedEndings(pending),[]);
  assert.deepEqual(earnedEndings(advance(pending)),earnedEndings(run));
 }
});

test('ending IDs, flags, a supplied achievement list and unfinished menus cannot manufacture new goals',()=>{
 for(const family of [...VERBAL_ENDING_IDS_V32,...COMPANY_ENDING_IDS_V32]){
  const supplied={seed:'e32-supplied-badges',roleId:'system',completed:true,endingId:`${family}-system`,achievements:ids,flags:{[`verbal32_finish_${family}`]:1,[`company32_finish_${family}`]:1,verbal32_severity_3:1}};
  assert.deepEqual(earned(supplied),[]);
  assert.equal(hasCompanyFinaleV32(supplied,family),false);
 }
 for(const empty of [null,undefined,{},[],{seed:'e32-no-history'},{seed:'e32-wrong-history',history:{}},{seed:'e32-bad-role',completed:true,endingId:'verbal_viral-undefined',history:[]}])assert.deepEqual(deriveAchievementsV32(empty),[]);
 assert.deepEqual(earned(createRun('system','e32-no-choice-yet')),[]);
});

test('a finale cannot borrow a different source, speaker, branch draw or uncommitted response',()=>{
 for(const [family,{run}]of byFamily){
  if(family==='nasdaq')continue;
  const last=run.history.at(-1);
  const invalid=[
   {...last,eventId:'unrelated-scene'}, {...last,kind:'daily'},
   {...last,speaker:last.speaker==='wing'?'rick':'wing'},
   {...last,choiceIndex:3}, {...last,choiceIndex:-1}, {...last,choiceIndex:'0'},
   {...last,result:''}, {...last,result:'   '}, {...last,result:null},
   {...last,turn:-1}, {...last,turn:'0'}, {...last,breakdown:null},
   {...last,eventOutcome:{label:last.eventOutcome.result,result:last.eventOutcome.result}},
   {...last,eventOutcome:{label:last.eventOutcome.label,result:'尚未抽出'}},
  ];
  for(const row of invalid)assert.deepEqual(earnedEndings({...run,history:[...run.history.slice(0,-1),row]}),[],family);
  assert.deepEqual(earnedEndings({...run,completed:false}),[],family);
  assert.deepEqual(earnedEndings({...run,roleId:'another-role'}),[],family);
  assert.deepEqual(earnedEndings({...run,history:[...run.history,{...last,eventId:'later-unrelated-scene'}]}),[],family);
 }
});

test('spoken finales bind to the nearest resolved actual speaker and timing rather than an earlier person or broad flag',()=>{
 for(const family of VERBAL_ENDING_IDS_V32){
  const {run}=byFamily.get(family),at=run.history.findLastIndex(row=>row.verbalOutcome?.version===2),source=run.history[at];
  assert.ok(at>=0);
  const replace=row=>({...run,history:run.history.map((item,index)=>index===at?row:item)});
  for(const row of [
   {...source,verbalOutcome:undefined},
   {...source,choiceIndex:0}, {...source,choiceText:''},
   {...source,eventOutcome:{label:'這句話說出口之後',result:'未揭曉'}},
   {...source,verbalOutcome:{...source.verbalOutcome,target:source.speaker==='wing'?'rick':'wing'}},
   {...source,verbalOutcome:{...source.verbalOutcome,origin:'another-scene'}},
   {...source,verbalOutcome:{...source.verbalOutcome,phase:'tomorrow'}},
   {...source,verbalOutcome:{...source.verbalOutcome,affinityDelta:-1000}},
  ])assert.deepEqual(earnedEndings(replace(row)),[],family);
  const other=copy(source);other.speaker=source.speaker==='wing'?'rick':'wing';other.verbalOutcome.target=other.speaker;
  assert.deepEqual(earnedEndings({...run,history:[...run.history.slice(0,-1),other,run.history.at(-1)]}),[],`${family}: no borrowing a different person's speech`);
 }
});

test('current-cohort NASDAQ success uses its actual company draw and failure never grants the old success badge',()=>{
 const success=byFamily.get('nasdaq').run,failure=byFamily.get('nasdaq_failed').run;
 assert.ok(deriveAchievements(success).includes('nasdaq'));
 assert.ok(!deriveAchievements(failure).includes('nasdaq'));
 assert.ok(!deriveAchievements({...success,history:[]}).includes('nasdaq'));
 assert.ok(!deriveAchievements({...success,completed:false}).includes('nasdaq'));
 assert.ok(deriveAchievements({seed:'e31-legacy-nasdaq',completed:true,endingId:'nasdaq-system'}).includes('nasdaq'),'legacy achievement derivation stays frozen');
});

test('four natural milestone routes prove actual selected people, PIP timing and speech after an already committed result',()=>{
 assert.deepEqual(new Set(milestones.map(route=>route.id)),new Set(['verbal-late-reply','verbal-pip-microphone','verbal-exit-team','verbal-many-ears']));
 for(const route of milestones){
  const run=replayRun(route.roleId,route.seed,route.actions),before=JSON.stringify(run);
  assert.equal(validRun(copy(run)),true);
  assert.deepEqual(earned(run),route.expectedAchievements);assert.ok(earned(run).includes(route.id));
  assert.equal(JSON.stringify(run),before);
  const speech=run.history.filter(row=>row.verbalOutcome?.version===2);
  if(route.id==='verbal-many-ears')assert.ok(new Set(speech.map(row=>row.speaker).filter(id=>id!=='self')).size>=3);
  if(route.id==='verbal-late-reply'){
   const at=run.history.findIndex(row=>row.verbalOutcome?.phase==='result');assert.ok(at>0);
   assert.equal(run.history[at-1].eventId,run.history[at].verbalOutcome.origin);
  }
  if(route.id==='verbal-pip-microphone')assert.ok(speech.some(row=>row.speaker==='hope'&&/^pip-/.test(row.eventId)));
  if(route.id==='verbal-exit-team'){
   assert.equal(speech.at(-1).speaker,'sonny');
   assert.equal(speech.at(-1).verbalOutcome.target,'sonny');
  }
  const people=deriveCharacterStats(run);
  assert.equal(people.reduce((sum,row)=>sum+row.imaginedHits+row.realHits,0),0,'speaking never becomes imagined or actual violence');
 }
});

test('repeated speech to one person cannot become three targets, and a named target cannot be replaced by a spectator',()=>{
 const route=milestones.find(item=>item.id==='verbal-many-ears'),run=replayRun(route.roleId,route.seed,route.actions),speech=run.history.filter(row=>row.verbalOutcome?.version===2);
 const repeated={seed:run.seed,history:Array.from({length:5},()=>copy(speech[0]))};
 assert.ok(!earned(repeated).includes('verbal-many-ears'));
 const triple=milestones.find(item=>item.id==='verbal-exit-team'),group=replayRun(triple.roleId,triple.seed,triple.actions),row=group.history.at(-1);
 assert.equal(row.speaker,'sonny');
 assert.ok(!earned({...group,history:[{...row,speaker:'erich'}]}).includes('verbal-exit-team'));
 assert.ok(!earned({...group,history:[{...row,verbalOutcome:{...row.verbalOutcome,target:'erich'}}]}).includes('verbal-exit-team'));
});

test('the three-person badge requires an explicit selected recipient in the matching canonical speech action',()=>{
 const route=milestones.find(item=>item.id==='verbal-exit-team');
 const prefix=replayRun(route.roleId,route.seed,route.actions.slice(0,-1));
 assert.equal(prefix.eventId,'crisis-boss');
 const defaulted=advance(requestVerbal(prefix,undefined,2));
 assert.equal(defaulted.history.at(-1).speaker,'erich');
 assert.equal(Object.hasOwn(defaulted.actions.at(-1),'target'),false);
 assert.equal(validRun(copy(defaulted)),true);
 assert.deepEqual(replayRun(defaulted.roleId,defaulted.seed,defaulted.actions),defaulted);
 assert.ok(earned(defaulted).includes('verbal-first-word'));
 assert.ok(!earned(defaulted).includes('verbal-exit-team'),'a default recipient is not an explicit pick');
 const selected=advance(requestVerbal(prefix,'erich',2));
 assert.equal(validRun(copy(selected)),true);
 assert.ok(earned(selected).includes('verbal-exit-team'));
 const unrelated={...defaulted,actions:[{type:'verbal',eventId:'another-scene',phase:'event',target:'erich',version:2},...defaulted.actions]};
 assert.ok(!earned(unrelated).includes('verbal-exit-team'),'a different speech action cannot lend its explicit target');
});

test('old cohorts keep their collection without being reinterpreted as new spoken or company achievements',()=>{
 for(const {run}of byFamily.values())for(const seed of [undefined,'old-run','e29-before-speech','e30-old-speech','e31-scene-speech'])assert.deepEqual(earned({...run,seed}),[]);
 for(const route of milestones){
  const run=replayRun(route.roleId,route.seed,route.actions);
  assert.deepEqual(earned({...run,seed:run.seed.replace(/^e32-/,'e31-')}),[]);
 }
});
