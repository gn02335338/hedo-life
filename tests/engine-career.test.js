import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {ROLES} from '../dist/roles.js';
import {EVENTS,FANTASY_EVENTS} from '../dist/events.js';
import {ENDINGS} from '../dist/endings.js';
import {CAREER_FAMILIES,CAREER_LEVELS,CAREER_LADDERS,careerSalary,careerEndingAvailable} from '../dist/career.js';
import {eligibleStoryEndings} from '../dist/story-career.js';
import {STAT_KEYS,createRun,getEvent,applyChoice,advance,requestExit,requestBreak,requestCareer,replayRun,validRun,jobTitle} from '../dist/engine.js';
import {replayRoute} from './find-routes-v3.mjs';
const copy=value=>JSON.parse(JSON.stringify(value));
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const choose=(run,index)=>advance(applyChoice(run,index));
const byEffect=(run,effect)=>{const index=getEvent(run).choices.findIndex(c=>c.effect===effect&&c.available!==false);assert.ok(index>=0,`${run.eventId}/${effect}`);return choose(run,index);};
function assertRankContext(run){
 const event=getEvent(run);
 if(/^e(?:8|9|10|11|12)-/.test(run.seed)&&event?.kind==='daily'){
  assert.ok(run.rank>=(event.minRank??0),`${event.id} below minimum rank`);
  assert.ok(run.rank<=(event.maxRank??4),`${event.id} above maximum rank`);
 }
}
function boundary(rank=0,extras={}){
 const run=createRun('system','e8-career-boundary');
 return {...run,eventId:'career-review',assignment:'honest',rank,turn:6,educationReviewed:true,salaryCutOffered:true,resumeEventId:EVENTS[0].id,...extras,stats:{...run.stats,energy:90,cash:90,mood:90,skill:90,lick:90,trust:80,boss:85,...extras.stats},flags:{...run.flags,career_peak_rank:rank,...extras.flags}};
}
function outcome(rank,index,wanted,extras={}){
 for(let i=0;i<400;i++){
  const original=boundary(rank,{...extras,seed:`e8-career-check-${i}`,rng:createRun('system',`e8-career-check-${i}`).rng});
  if(getEvent(original).choices[index].available===false)continue;
  const pending=applyChoice(original,index);
  if(pending.pendingEffect===wanted)return {original,pending,returned:advance(pending)};
 }
 throw new Error(`No ${rank}/${index}/${wanted} outcome`);
}
function checkpoints(route){
 let run=createRun(route.roleId,route.seed);const hashes=[digest(run)];
 for(const action of route.actions){
  if(action.type==='exit')run=requestExit(run);
  else if(action.type==='break')run=requestBreak(run);
  else if(action.type==='career')run=requestCareer(run);
  else{assert.equal(run.eventId,action.eventId);run=applyChoice(run,action.index);hashes.push(digest(run));run=advance(run);}
  hashes.push(digest(run));
 }
 return hashes;
}
function report(){return {routes:JSON.parse(readFileSync(new URL('./fixtures/legacy-e16-routes.json',import.meta.url),'utf8'))};}
function routeFor(ending){const route=report().routes.find(r=>r.ending===ending);assert.ok(route,`natural witness ${ending}`);assert.ok(route.seed.startsWith('e16-'));return route;}

test('e8 nine-role career ladders have five distinct stages while published role titles remain intact',()=>{
 assert.deepEqual(CAREER_LEVELS.map(x=>x.rank),[0,1,2,3,4]);
 assert.deepEqual(CAREER_FAMILIES,['career_staff','career_deputy','career_manager','career_director','career_chief']);
 for(const role of ROLES.filter(role=>(role.minRules||1)<28)){
  assert.equal(CAREER_LADDERS[role.id].length,5);assert.equal(new Set(CAREER_LADDERS[role.id]).size,5);
  for(let rank=0;rank<5;rank++){
   const current=boundary(rank,{roleId:role.id,actualRoleId:role.id});assert.equal(jobTitle(current),CAREER_LADDERS[role.id][rank]);
   assert.equal(jobTitle({...current,seed:'e7-published-ladder'}),role.ladder[rank]);
   assert.ok(ENDINGS.some(e=>e.id===`${CAREER_FAMILIES[rank]}-${role.id}`));
  }
 }
 const swapped=boundary(2,{roleId:'ai',actualRoleId:'system',assignment:'swapped'});
 assert.equal(jobTitle(swapped),'系統工程經理');
 assert.equal(jobTitle({...swapped,assignment:'assistant'}),'助理工程師');
});

test('promotion checks require each tier’s actual thresholds and still resolve through seeded success or failure',()=>{
 const merit=[{skill:55,trust:35,boss:40},{skill:65,trust:45,boss:45},{skill:75,trust:50,boss:50},{skill:82,trust:60,boss:60}];
 const politics=[{lick:60,boss:60},{lick:70,boss:65},{lick:80,boss:75},{lick:88,boss:82}];
 for(let rank=0;rank<4;rank++)for(const [index,limits]of [[0,merit[rank]],[1,politics[rank]]]){
  const exact=boundary(rank,{stats:limits});assert.equal(getEvent(exact).choices[index].available,true);
  for(const [key,value]of Object.entries(limits)){
   const low={...exact,stats:{...exact.stats,[key]:value-1}};
   assert.equal(getEvent(low).choices[index].available,false,`${rank}/${index}/${key}`);
   assert.throws(()=>applyChoice(low,index),/Unavailable choice/);
  }
  const win=outcome(rank,index,'careerPromote',{stats:limits}),loss=outcome(rank,index,null,{stats:limits});
  assert.deepEqual(applyChoice(win.original,index),win.pending);assert.notEqual(win.pending.rng,win.original.rng);
  assert.equal(win.pending.rank,rank+1);assert.equal(loss.pending.rank,rank);
  assert.equal(loss.returned.turn,loss.original.turn);assert.equal(loss.returned.lastPromotion,loss.original.turn);
 }
 const pip=boundary(1,{pip:{active:true,remaining:2},pipCount:1});
 assert.equal(getEvent(pip).choices[0].available,false);assert.equal(getEvent(pip).choices[1].available,false);
});

test('assistants regularize before gaining a management rank and promotion salary follows the new ladder',()=>{
 const {original,pending,returned}=outcome(0,0,'careerRegularize',{assignment:'assistant',actualRoleId:'system',pay:40,basePay:60});
 assert.equal(pending.assignment,'honest');assert.equal(pending.rank,0);assert.equal(pending.pay,60);
 assert.equal(returned.eventId,original.resumeEventId);assert.equal(returned.turn,original.turn);
 for(const roleId of ['mis','project']){
  const reassigned=outcome(0,0,'careerRegularize',{roleId,assignment:'assistant',actualRoleId:'system',pay:40,basePay:60});
  assert.equal(reassigned.pending.assignment,'swapped');assert.equal(reassigned.pending.actualRoleId,'system');assert.equal(reassigned.pending.rank,0);
  assert.equal(jobTitle(reassigned.pending),'系統工程師');
 }
 for(let rank=0;rank<4;rank++){
  const result=outcome(rank,0,'careerPromote',{basePay:80,pay:careerSalary({basePay:80,rank})});
  assert.equal(result.pending.rank,rank+1);assert.equal(result.pending.pay,careerSalary({...result.pending,rank:rank+1}));
  assert.equal(result.pending.flags.career_peak_rank,rank+1);
  assert.equal(result.returned.eventId,`career-duty-${rank+1}`);assert.equal(result.returned.turn,result.original.turn);
  assert.match(result.pending.history.at(-1).result,/職稱變更/);assert.equal(result.pending.history.at(-1).pay,result.pending.pay);
 }
 assert.equal(careerSalary({basePay:300,rank:4}),500);
});

test('tier duties resolve without advancing work or PIP, while higher ranks add actual daily pressure',()=>{
 for(let rank=1;rank<=4;rank++){
  const duty=boundary(rank,{eventId:`career-duty-${rank}`,pip:{active:true,remaining:2},pipCount:1});
  const pending=applyChoice(duty,1),done=advance(pending);
  assert.equal(done.turn,duty.turn);assert.deepEqual(done.pip,duty.pip);assert.equal(done.flags[`career_duty_${rank}`],1);
  assert.equal(done.eventId,duty.resumeEventId);assert.equal(done.resumeEventId,null);
  const totals=Object.fromEntries(STAT_KEYS.map(k=>[k,0]));
  for(const part of pending.history.at(-1).breakdown)for(const [key,value]of Object.entries(part.delta))totals[key]+=value;
  assert.deepEqual(totals,pending.history.at(-1).delta);
 }
 const base=boundary(0,{eventId:EVENTS[0].id,resumeEventId:null,turn:2});
 const staff=applyChoice(base,0);
 for(let rank=1;rank<=4;rank++){
  const source={...copy(base),rank,flags:{...base.flags,career_peak_rank:rank}},pending=applyChoice(source,0),h=pending.history.at(-1);
  const pressure=h.breakdown.find(p=>p.source==='career-pressure');assert.ok(pressure);
  for(const [key,value]of Object.entries(CAREER_LEVELS[rank].pressure)){
   assert.equal(pending.stats[key]-staff.stats[key],value);
   if(value)assert.equal(pressure.delta[key],value);
  }
  assert.equal(pending.flags[`career_work_${rank}`],1);
  const totals=Object.fromEntries(STAT_KEYS.map(k=>[k,0]));
  for(const part of h.breakdown)for(const [key,value]of Object.entries(part.delta))totals[key]+=value;
  assert.deepEqual(totals,h.delta);
 }
});

test('promotion and voluntary step-down replace suspended work only when its rank no longer matches',()=>{
 const promotion=outcome(1,0,'careerPromote',{resumeEventId:'deputy-late-shift'});
 const promoted=byEffect(promotion.returned,'careerResume');
 assert.equal(promoted.rank,2);assert.notEqual(promoted.eventId,'deputy-late-shift');assertRankContext(promoted);
 assert.equal(promoted.turn,promotion.original.turn);assert.equal(promoted.resumeEventId,null);
 const manager=boundary(2,{eventId:'career-step-down',resumeEventId:null,exitReturnEventId:'manager-pip-signature',pip:{active:true,remaining:2},pipCount:1});
 const deputy=byEffect(manager,'careerDemoteDeputy');
 assert.equal(deputy.rank,1);assert.notEqual(deputy.eventId,'manager-pip-signature');assertRankContext(deputy);
 assert.equal(deputy.turn,manager.turn);assert.deepEqual(deputy.pip,manager.pip);assert.equal(deputy.exitReturnEventId,null);
 const unrestricted={...manager,exitReturnEventId:EVENTS[0].id};
 const unchanged=byEffect(unrestricted,'careerDemoteDeputy');
 assert.equal(unchanged.eventId,unrestricted.exitReturnEventId);assert.equal(unchanged.rng,unrestricted.rng);
});

test('tier endings need work at that tier; executive titles and voluntary step-down preserve real responsibilities',()=>{
 for(let rank=0;rank<5;rank++){
  const hub=boundary(rank,{eventId:'rank-exit',resumeEventId:null,turn:rank===0?2:6});
  assert.equal(careerEndingAvailable(hub),false);assert.equal(getEvent(hub).choices[0].available,false);
  assert.throws(()=>applyChoice(hub,0),/Unavailable choice/);
  const earned=rank===0?{...hub,turn:3}:{...hub,flags:{...hub.flags,[`career_duty_${rank}`]:1}};
  assert.equal(careerEndingAvailable(earned),true);assert.equal(choose(earned,0).endingId,`${CAREER_FAMILIES[rank]}-system`);
  assert.equal(careerEndingAvailable({...earned,assignment:'assistant'}),false);
 }
 const executive=createRun('executive','e8-executive-start');
 assert.equal(executive.rank,2);assert.equal(executive.flags.career_peak_rank,2);assert.equal(jobTitle(executive),'空降事業部經理');
 const earlyHub=byEffect(requestExit(executive),'careerExit');
 assert.equal(getEvent(earlyHub).choices.find(c=>c.effect==='careerStepDown').available,false,'reporting and initial briefing precede voluntary step-down');
 const intro=choose(executive,0);assert.equal(intro.eventId,'career-duty-2');assert.equal(getEvent(intro).choices.length,3);
 const work=choose(intro,1);assert.equal(work.turn,1);
 for(const [effect,rank]of [['careerDemoteStaff',0],['careerDemoteDeputy',1]]){
  const hub=byEffect(requestExit(work),'careerExit'),menu=byEffect(hub,'careerStepDown'),returned=byEffect(menu,effect);
  assert.equal(returned.rank,rank);assert.equal(returned.flags.career_peak_rank,2);
  assert.equal(returned.turn,work.turn);assert.equal(returned.eventId,work.eventId);assert.equal(returned.pay,Math.min(work.pay,careerSalary(returned)));
  assert.equal(returned.resumeEventId,null);assert.equal(returned.exitReturnEventId,null);assert.equal(validRun(copy(returned)),true);
  assert.deepEqual(replayRun(returned.roleId,returned.seed,returned.actions),returned);
 }
});

test('rank and story hubs preserve suspended notifications, return safely, and cannot skip review targets at the finale',()=>{
 const working=boundary(1,{eventId:EVENTS[0].id,resumeEventId:null,flags:{career_duty_1:1}});
 const hub=byEffect(requestExit(working),'careerExit');assert.equal(hub.eventId,'rank-exit');
 const legacy=byEffect(hub,'legacyCareer');assert.equal(legacy.eventId,'career-exit');
 const returned=byEffect(legacy,'return');assert.equal(returned.eventId,working.eventId);assert.equal(returned.exitReturnEventId,null);
 assert.equal(returned.turn,working.turn);assert.equal(returned.rng,working.rng);
 const notification=boundary(1,{eventId:'career-duty-1'}),notifyHub=byEffect(requestExit(notification),'careerExit');
 assert.equal(getEvent(notifyHub).choices.find(c=>c.effect==='careerStepDown').available,false);
 const notifyReturn=byEffect(notifyHub,'return');assert.equal(notifyReturn.eventId,notification.eventId);assert.equal(notifyReturn.resumeEventId,notification.resumeEventId);
 const finale=boundary(4,{eventId:FANTASY_EVENTS[3].id,resumeEventId:null,turn:23,flags:{career_duty_4:1}}),last=getEvent(finale).choices.findIndex(c=>c.effect==='careerExit');
 assert.ok(last>=0);const finalHub=choose(finale,last);assert.equal(finalHub.eventId,'rank-exit');assert.equal(finalHub.turn,finale.turn);
 assert.equal(getEvent({...finalHub,turn:24}).choices.some(c=>c.effect==='return'),false);
});

test('story ending conditions are earned independently and unavailable paths reject forged clicks',()=>{
 const rules=[
  ['second_offer',{offer_checked:2,alumni_links:2},{skill:55}],
  ['handover_author',{handover_notes:3,archive:2},{}],
  ['alumni_network',{alumni_links:3},{trust:60}],
  ['consultant',{consultant_offer:1},{}],
  ['merged_out',{merge_notice:1},{}]
 ];
 const empty=boundary(2,{eventId:'story-exit',flags:{},stats:{skill:54,trust:59}});
 assert.deepEqual(eligibleStoryEndings(empty),[]);
 for(let i=0;i<rules.length;i++){
  const [family,flags,stats]=rules[i],earned=boundary(2,{eventId:'story-exit',flags,stats});
  assert.ok(eligibleStoryEndings(earned).includes(family));assert.equal(choose(earned,i).endingId,`${family}-system`);
  assert.throws(()=>applyChoice(empty,i),/Unavailable choice/);
  for(const [key,value]of Object.entries(flags))assert.ok(!eligibleStoryEndings({...earned,flags:{...earned.flags,[key]:value-1}}).includes(family));
 }
 const consultant=boundary(1,{flags:{consultant_offer:1}});assert.ok(!eligibleStoryEndings(consultant).includes('consultant'));
 assert.ok(!eligibleStoryEndings({...consultant,rank:2,assignment:'assistant'}).includes('consultant'));
 assert.ok(!eligibleStoryEndings(boundary(2,{flags:{role_merge:3}})).includes('merged_out'),'extra duties alone do not prove an abolished position');
});

test('published e7 fixtures retain complete states and every direct/JSON checkpoint hash',()=>{
 const fixtures=JSON.parse(readFileSync(new URL('./fixtures/legacy-e7-routes.json',import.meta.url),'utf8'));
 for(const fixture of fixtures){
  const direct=replayRun(fixture.roleId,fixture.seed,fixture.actions),savedHashes=[];
  assert.equal(digest(direct),fixture.stateSha256);assert.equal(digest(replayRoute(fixture,state=>savedHashes.push(digest(state)))),fixture.savedStateSha256);
  assert.deepEqual(checkpoints(fixture),fixture.directCheckpoints);assert.deepEqual(savedHashes,fixture.savedCheckpoints);assert.equal(validRun(copy(direct)),true);
 }
});

test('published e8 fixtures retain complete states and every direct/JSON checkpoint hash',()=>{
 const fixtures=JSON.parse(readFileSync(new URL('./fixtures/legacy-e8-routes.json',import.meta.url),'utf8'));
 for(const fixture of fixtures){
  const direct=replayRun(fixture.roleId,fixture.seed,fixture.actions),savedHashes=[];
  assert.equal(digest(direct),fixture.stateSha256);assert.equal(digest(replayRoute(fixture,state=>savedHashes.push(digest(state)))),fixture.savedStateSha256);
  assert.deepEqual(checkpoints(fixture),fixture.directCheckpoints);assert.deepEqual(savedHashes,fixture.savedCheckpoints);assert.equal(validRun(copy(direct)),true);
 }
});

test('published e9 fixtures retain complete states and every direct/JSON checkpoint hash',()=>{
 const fixtures=JSON.parse(readFileSync(new URL('./fixtures/legacy-e9-routes.json',import.meta.url),'utf8'));
 for(const fixture of fixtures){
  const direct=replayRun(fixture.roleId,fixture.seed,fixture.actions),savedHashes=[];
  assert.equal(digest(direct),fixture.stateSha256);assert.equal(digest(replayRoute(fixture,state=>savedHashes.push(digest(state)))),fixture.savedStateSha256);
  assert.deepEqual(checkpoints(fixture),fixture.directCheckpoints);assert.deepEqual(savedHashes,fixture.savedCheckpoints);assert.equal(validRun(copy(direct)),true);
 }
});

test('published e10 fixtures retain complete states and every direct/JSON checkpoint hash',()=>{
 const fixtures=JSON.parse(readFileSync(new URL('./fixtures/legacy-e10-routes.json',import.meta.url),'utf8'));
 for(const fixture of fixtures){
  const direct=replayRun(fixture.roleId,fixture.seed,fixture.actions),savedHashes=[];
  assert.equal(digest(direct),fixture.stateSha256);assert.equal(digest(replayRoute(fixture,state=>savedHashes.push(digest(state)))),fixture.savedStateSha256);
  assert.deepEqual(checkpoints(fixture),fixture.directCheckpoints);assert.deepEqual(savedHashes,fixture.savedCheckpoints);assert.equal(validRun(copy(direct)),true);
 }
});

test('published e11 fixtures retain complete states and every direct/JSON checkpoint hash',()=>{
 const fixtures=JSON.parse(readFileSync(new URL('./fixtures/legacy-e11-routes.json',import.meta.url),'utf8'));
 for(const fixture of fixtures){
  const direct=replayRun(fixture.roleId,fixture.seed,fixture.actions),savedHashes=[];
  assert.equal(digest(direct),fixture.stateSha256);assert.equal(digest(replayRoute(fixture,state=>savedHashes.push(digest(state)))),fixture.savedStateSha256);
  assert.deepEqual(checkpoints(fixture),fixture.directCheckpoints);assert.deepEqual(savedHashes,fixture.savedCheckpoints);assert.equal(validRun(copy(direct)),true);
 }
});

test('natural e13 witnesses prove every role can finish all five tiers and preserve saved replays',()=>{
 for(const role of ROLES.filter(role=>(role.minRules||1)<28))for(const family of CAREER_FAMILIES){
  const route=routeFor(`${family}-${role.id}`),run=replayRoute(route,state=>{assert.equal(validRun(copy(state)),true);assertRankContext(state);});
  assert.equal(run.endingId,`${family}-${role.id}`);assert.deepEqual(replayRun(run.roleId,run.seed,run.actions),run);
  assert.ok(run.actions.length<=160);
 }
 const executive=routeFor('career_staff-executive');assert.ok(executive.actions.some(a=>a.eventId==='career-step-down'));
 const staff=routeFor('career_deputy-executive');assert.ok(staff.actions.some(a=>a.eventId==='career-step-down'));
 for(const family of ['second_offer','handover_author','alumni_network','consultant','merged_out']){
  const route=routeFor(`${family}-system`),finished=replayRoute(route);
  assert.equal(finished.endingId,route.ending);assert.deepEqual(replayRun(finished.roleId,finished.seed,finished.actions),finished);
  const index=finished.actions.findIndex(a=>a.eventId==='story-exit');
  if(index>=0){const forged=copy(finished.actions);forged[index]={...forged[index],index:99};assert.throws(()=>replayRun(finished.roleId,finished.seed,forged),/Unavailable choice/);}
 }
});
