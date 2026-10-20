import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ACHIEVEMENTS,ACHIEVEMENT_MAP,ACHIEVEMENT_GROUPS,LEGACY_RAGE_ACHIEVEMENT_MAP,deriveAchievements} from '../dist/achievements.js';
import {createRun,getEvent,applyChoice,advance,requestRage,replayRun,validRun} from '../dist/engine.js';

const copy=value=>JSON.parse(JSON.stringify(value));
const choose=(run,index)=>advance(applyChoice(run,index));

test('118 distinct illustrated achievements contain complete Traditional Chinese copy and safe local art',()=>{
 assert.equal(ACHIEVEMENTS.length,118);
 assert.equal(new Set(ACHIEVEMENTS.map(item=>item.id)).size,118);
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
 assert.ok(pictures.size>=100,'the expanded collection has distinct illustrations, rather than repeated letter avatars');
});

test('unambiguous original badges retain their IDs while mixed rage badges are archived',()=>{
 const published=['work-card','switch','assistant','robot','promotion','manager','director','pip','pip-pass','pay-cut','salary-save','education','self-care','kind-decline','rage-wing','rage-spencer','rage-rick','rage-hope','rage-erich','rage-jenjen','rage-sonny','rage-kind','rage-catharsis','rage-absent','rage-documented','banquet','banquet-prize','banquet-stage','banquet-shared','kind-ghost','first-ending','rage-jack','nasdaq','rage-imagined','rage-real','rage-first-day','rage-legal','rage-defeated','rage-coup'];
 for(const id of published)assert.ok(ACHIEVEMENT_MAP[id]||LEGACY_RAGE_ACHIEVEMENT_MAP[id],id);
 const replacements={'rage-catharsis':'dream-catharsis','rage-absent':'dream-absent','rage-documented':'real-documented','rage-first-day':'real-first-day'};
 assert.deepEqual(ACHIEVEMENTS.slice(0,39).map(item=>item.id),published.map(id=>replacements[id]||(LEGACY_RAGE_ACHIEVEMENT_MAP[id]?id.replace('rage-','real-hit-'):id)));
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

test('older cartoon attempts remain valid replays without proving a modern real or dreamed hit',()=>{
 const people=['wing','spencer','rick','hope','erich','jenjen','sonny','kind'];
 for(const [index,person]of people.entries()){
  const run=createRun('system',`e13-badge-${person}`),menu=requestRage(run);
  assert.ok(!deriveAchievements(menu).includes(`rage-${person}`));
  const pending=applyChoice(menu,index),resolved=advance(pending),before=copy(pending);
  const earned=deriveAchievements(pending);
  assert.ok(!earned.some(id=>id.startsWith('real-hit-')||id.startsWith('dream-')||id==='rage-real'),person);
  assert.equal(pending.flags[`rage_target_${person}`],1);
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

test('published e18, strict-rage and chronicle routes prove all current achievements without injected state',()=>{
 const routes=JSON.parse(readFileSync(new URL('./fixtures/achievement-routes-v18.json',import.meta.url),'utf8'));
 const covered=new Set();
 assert.ok(routes.length>0);
 for(const route of routes){
  assert.deepEqual(Object.keys(route).sort(),['actions','expectedAchievements','roleId','seed'],'public proofs contain only replay inputs and earned IDs');
  assert.match(route.seed,/^e18-/,'all badges are attainable in the current cohort');
  const run=replayRun(route.roleId,route.seed,route.actions),saved=copy(run);
  assert.equal(validRun(saved),true,`${route.seed} survives JSON save validation`);
  assert.deepEqual(deriveAchievements(saved),route.expectedAchievements,`${route.seed} derives its actual earned badges`);
  assert.deepEqual(replayRun(saved.roleId,saved.seed,saved.actions),saved,`${route.seed} has a deterministic canonical replay`);
  if(route.expectedAchievements.includes('dream-absent'))assert.ok(saved.history.some(item=>item.eventId==='rage-release'&&item.speaker==='kind'&&item.eventOutcome?.result==='腦內劇場'),'the current absence badge follows the resolved imaginary Kind chase');
  if(route.expectedAchievements.includes('real-documented'))assert.ok(saved.history.some(item=>item.eventId==='rage-legal'&&Number.isInteger(item.choiceIndex)&&item.choiceIndex>=0),'the current documentation badge follows an actual formal-record decision');
  for(const id of route.expectedAchievements)covered.add(id);
 }
 const rageRoutes=JSON.parse(readFileSync(new URL('./fixtures/rage-achievement-routes.json',import.meta.url),'utf8')).routes;
 for(const route of rageRoutes)for(const id of deriveAchievements(replayRun(route.roleId,route.seed,route.actions)))covered.add(id);
 const chronicleRoutes=JSON.parse(readFileSync(new URL('./fixtures/chronicle-achievement-routes.json',import.meta.url),'utf8')).routes;
 for(const route of chronicleRoutes)for(const id of deriveAchievements(replayRun(route.roleId,route.seed,route.actions)))covered.add(id);
 assert.equal(covered.size,118);
 assert.deepEqual(ACHIEVEMENTS.filter(item=>covered.has(item.id)).map(item=>item.id),ACHIEVEMENTS.map(item=>item.id));
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

const workHistory=count=>Array.from({length:count},(_,turn)=>({eventId:`work-${turn}`,kind:'daily',turn,choiceIndex:0,delta:{}}));

test('role and school badges require resolved work; titles and impressive initial stats are insufficient',()=>{
 const run={seed:'e18-badge-work',actualRoleId:'mis',education:{schoolId:'ntu',degree:'EMBA',sector:'private',field:'business'},stats:{skill:100,slack:100,lick:100,trust:100},rank:7,flags:{career_peak_rank:7},history:[]};
 assert.deepEqual(deriveAchievements(run),[]);
 const two={...run,history:workHistory(2)};
 assert.ok(!deriveAchievements(two).includes('role-mis'));
 const three={...run,history:workHistory(3)};
 assert.ok(deriveAchievements(three).includes('role-mis'));
 assert.ok(!deriveAchievements(three).some(id=>id.startsWith('school-')));
 const five=deriveAchievements({...run,history:workHistory(5)});
 for(const id of ['school-private-proof','school-cross-field','school-emba-proof','trust-ninety'])assert.ok(five.includes(id),id);
 assert.ok(!five.includes('school-ntu-proof'),'EMBA is not treated as the character’s preferred NTU degree');
 for(const role of ['system','ai','project','product','design','bd','sales','mis','executive'])assert.ok(deriveAchievements({...three,actualRoleId:role}).includes(`role-${role}`));
 const overseas=deriveAchievements({...run,history:workHistory(5),education:{schoolId:'ucl',sector:'overseas',field:'stem',degree:'學士'}});
 assert.ok(overseas.includes('school-overseas-proof'));
 assert.ok(!overseas.includes('school-private-proof'));
});

test('eight rank badges require work or responsibility at that rank and never confuse legacy rank meanings',()=>{
 const names=['assistant','staff','senior','principal','deputy','manager','director','chief'];
 for(const seed of ['e17-rank-badges','e18-rank-badges']){
  for(const [rank,name]of names.entries()){
   const base={seed,rank,history:[],flags:{career_peak_rank:rank}};
   assert.ok(!deriveAchievements(base).includes(`rank-${name}-work`),'starting title alone is not a completed responsibility');
   const required=rank<=1?3:2;
   assert.ok(!deriveAchievements({...base,flags:{...base.flags,[`career_work_${rank}`]:required-1}}).includes(`rank-${name}-work`));
   assert.ok(deriveAchievements({...base,flags:{...base.flags,[`career_work_${rank}`]:required}}).includes(`rank-${name}-work`));
   if(rank>1)assert.ok(deriveAchievements({...base,flags:{...base.flags,[`career_duty_${rank}`]:1}}).includes(`rank-${name}-work`));
  }
 }
 assert.ok(!deriveAchievements({seed:'e16-old-manager',flags:{career_work_2:20,career_duty_2:1}}).includes('rank-senior-work'));
 assert.ok(!deriveAchievements({seed:'e18-no-promotion',flags:{career_peak_rank:5}}).includes('manager'));
 assert.ok(deriveAchievements({seed:'e18-promoted',flags:{promotions:1,career_peak_rank:5,career_promoted_peak:5}}).includes('manager'));
 assert.ok(!deriveAchievements({seed:'e18-executive-demoted',flags:{promotions:1,career_peak_rank:5,career_promoted_peak:2}}).includes('manager'));
 assert.ok(!deriveAchievements({seed:'e18-not-director',flags:{promotions:1,career_peak_rank:5}}).includes('director'));
});

test('new paid choices count as self-care without treating cancellation as spending or revealing a future recovery',()=>{
 const care=(seed,indices,flags={})=>({seed,flags,history:indices.map(choiceIndex=>({eventId:'self-care',choiceIndex}))});
 assert.ok(deriveAchievements(care('e18-new-care',[3,5,6])).includes('self-care'));
 assert.ok(!deriveAchievements(care('e18-cancel-care',[7,7,7])).includes('self-care'));
 assert.ok(!deriveAchievements(care('e17-old-care',[3,3,3])).includes('self-care'));
 const flags={spend_mood:1,spend_training:1,spend_evidence:1,cash_spent_total:30};
 const earned=deriveAchievements({flags});
 for(const id of ['wallet-mood','wallet-training','wallet-evidence','wallet-thirty'])assert.ok(earned.includes(id),id);
 assert.ok(!earned.includes('wallet-variety'),'categories without three actual purchases are not different paid arrangements');
 const paid=[{eventId:'crisis-mood',choiceIndex:1,delta:{cash:-14}},{eventId:'mood-collapse',choiceIndex:0,delta:{cash:-18}}];
 assert.ok(!deriveAchievements({flags,history:paid}).includes('wallet-variety'));
 assert.ok(!deriveAchievements({flags,history:[...paid,paid[0]]}).includes('wallet-variety'));
 assert.ok(deriveAchievements({flags,history:[...paid,{eventId:'self-care',kind:'self-care',choiceIndex:2,delta:{cash:-18}}]}).includes('wallet-variety'));
 assert.ok(!earned.includes('wallet-energy'));
 assert.ok(!earned.includes('mood-rebound'),'paying does not prove an unrevealed result exceeded a recovery threshold');
 assert.ok(!deriveAchievements({flags:{cash_spent_total:29}}).includes('wallet-thirty'));
 assert.ok(deriveAchievements({flags:{cash_spent_total:10000}}).includes('wallet-thirty'));
});

test('ability tradeoffs and mood badges depend on actual friction or resolved changes',()=>{
 for(const skill of ['skill','slack','lick']){
  const stats=Object.fromEntries(['skill','slack','lick'].map(key=>[key,key===skill?90:60]));
  assert.ok(!deriveAchievements({stats}).includes(`craft-${skill}`),'a lucky roll is not a trained specialization');
  assert.ok(deriveAchievements({stats,flags:{resource_friction_count:3}}).includes(`craft-${skill}`));
 }
 assert.ok(!deriveAchievements({stats:{skill:100,slack:100,lick:100},flags:{resource_friction_count:8}}).includes('craft-skill'));
 const history=[{choiceIndex:0,delta:{mood:25,energy:20}},{choiceIndex:0,delta:{mood:-20}}];
 const earned=deriveAchievements({history,flags:{resource_friction_count:8,mood_crash_count:1}});
 for(const id of ['craft-tradeoff','mood-rebound','energy-rebound','mood-shock','mood-zero'])assert.ok(earned.includes(id),id);
 assert.ok(!earned.includes('mood-zero-finish'));
 assert.ok(deriveAchievements({history,flags:{mood_crash_count:1},completed:true}).includes('mood-zero-finish'));
 assert.ok(!deriveAchievements({history:[{choiceIndex:-1,delta:{mood:100,energy:100}}]}).includes('mood-rebound'));
});

test('dream badges match the resolved person and outcome from the same attempt',()=>{
 const run={flags:{rage_target_wing:1,rage_target_jack:1,rage_imagined:1,rage_real:1},history:[{eventId:'rage-release',kind:'rage',speaker:'wing',choiceIndex:0,eventOutcome:{label:'剛才發生了什麼',result:'真的失控了'}},{eventId:'rage-release',kind:'rage',speaker:'jack',choiceIndex:0,eventOutcome:{label:'剛才發生了什麼',result:'腦內劇場'}}]};
 const earned=deriveAchievements(run);
 assert.ok(earned.includes('dream-jack'));
 assert.ok(!earned.includes('dream-wing'),'a real attempt on one person cannot borrow a later imagined attempt on somebody else');
 assert.ok(!deriveAchievements({...run,history:[]}).some(id=>id.startsWith('dream-')));
 for(const person of ['wing','spencer','rick','hope','erich','jenjen','sonny','kind','jack'])assert.ok(deriveAchievements({history:[{eventId:'rage-release',kind:'rage',speaker:person,choiceIndex:0,eventOutcome:{label:'剛才發生了什麼',result:'腦內劇場'}}]}).includes(`dream-${person}`));
 const natural=advance(requestRage(createRun('system','e18-example-1')));
 assert.equal(natural.history.at(-1).eventOutcome.result,'腦內劇場');
 assert.ok(deriveAchievements(natural).includes('dream-wing'));
 assert.equal(validRun(copy(natural)),true);
 assert.deepEqual(deriveAchievements(replayRun(natural.roleId,natural.seed,natural.actions)),deriveAchievements(natural));
});

test('Water Snake achievements follow a committed target and the same resolved imagined attempt',()=>{
 const newIds=run=>deriveAchievements(run).filter(id=>id.endsWith('-meimei'));
 assert.deepEqual(newIds({achievements:['rage-meimei','dream-meimei'],eventId:'rage-release',rageContext:{target:'meimei'},history:[],flags:{}}),[]);
 assert.deepEqual(newIds({flags:{rage_target_meimei:1}}),[]);
 const history=[
  {eventId:'rage-release',kind:'rage',speaker:'meimei',choiceIndex:0,eventOutcome:{label:'剛才發生了什麼',result:'真的失控了'}},
  {eventId:'rage-release',kind:'rage',speaker:'jack',choiceIndex:0,eventOutcome:{label:'剛才發生了什麼',result:'腦內劇場'}}
 ];
 assert.deepEqual(newIds({flags:{rage_target_meimei:1,rage_real:1,rage_imagined:1},history}),['real-hit-meimei']);
 const imagined={eventId:'rage-release',kind:'rage',speaker:'meimei',choiceIndex:0,eventOutcome:{label:'剛才發生了什麼',result:'腦內劇場'}};
 assert.deepEqual(newIds({history:[imagined]}),['dream-meimei']);
 assert.deepEqual(newIds({flags:{rage_target_meimei:1},history:[imagined]}),['dream-meimei']);
 assert.deepEqual(newIds({history:[{...imagined,eventOutcome:{label:'腦內劇場',result:'真的失控了'}}]}),['real-hit-meimei'],'the committed result, rather than the label or flags, determines the mode');
 for(const invalid of [
  {...imagined,choiceIndex:-1},
  {...imagined,eventId:'meimei-workday'},
  {...imagined,kind:'daily'},
  {...imagined,eventOutcome:{label:'腦內劇場'}}
 ])assert.deepEqual(newIds({history:[invalid]}),[],'unresolved or unrelated records do not earn the dream badge');
});

test('personnel, exploration and banquet combinations use completed decisions rather than menu presence',()=>{
 const accepted={eventId:'salary-cut',choiceIndex:0,turn:3,kind:'career',speaker:'hope'};
 assert.ok(!deriveAchievements({flags:{pay_cut:1},history:[...workHistory(2),accepted,...workHistory(1)]}).includes('cut-and-work'));
 const after=workHistory(2).map((item,index)=>({...item,turn:accepted.turn+index}));
 assert.ok(deriveAchievements({flags:{pay_cut:1},history:[accepted,...after]}).includes('cut-and-work'));
 assert.ok(deriveAchievements({history:[{eventId:'salary-final',choiceIndex:1}]}).includes('cut-refusal'));
 assert.ok(!deriveAchievements({eventId:'salary-final'}).includes('cut-refusal'));
 const history=workHistory(15).map((item,index)=>({...item,speaker:'hope',chanceOutcome:index<3?'success':index<6?'setback':'ordinary',...(index<5?{eventOutcome:{label:'已經發生'}}:{})}));
 const earned=deriveAchievements({history,flags:{pip_passed:1,evidence:5,jack_notes:3},pipCount:2,completed:true});
 for(const id of ['hope-regular','pip-repeat','pip-dossier','pip-finish','luck-streak','setback-streak','rng-five','jack-notes','office-explorer'])assert.ok(earned.includes(id),id);
 assert.ok(!deriveAchievements({history:[{eventId:'banquet-welcome',choiceIndex:0},{eventId:'banquet-draw',choiceIndex:0}]}).includes('banquet-complete'));
 assert.ok(deriveAchievements({history:['banquet-welcome','banquet-draw','banquet-afterparty'].map(eventId=>({eventId,choiceIndex:0}))}).includes('banquet-complete'));
});
