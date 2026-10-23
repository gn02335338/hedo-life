import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../dist/engine.js';
import {ACTIVITY_IDS_V44 as CURRENT_ACTIVITY_IDS_V44} from '../dist/activities-v44.js';
const ACTIVITY_IDS_V44=CURRENT_ACTIVITY_IDS_V44.filter(id=>id!=='camel'); // This fixture cohort published seven activities.
import {buildEndingReport} from '../dist/ending-report.js';
import {deriveAchievements} from '../dist/achievements.js';
import {CHARACTER_IDS,deriveCharacterStats} from '../dist/character-stats.js';

const copy=value=>JSON.parse(JSON.stringify(value));
const choose=(run,index)=>engine.advance(engine.applyChoice(run,index));
const nextRng=value=>{let result=value;result^=result<<13;result^=result>>>17;result^=result<<5;return result>>>0||1;};
const canonical=run=>assert.equal(engine.validRun(copy(run)),true,`${run.seed}/${run.eventId}/${run.pending?'pending':'ready'}`);
const sameReplay=run=>assert.deepEqual(engine.replayRun(run.roleId,run.seed,run.actions),run);
const natural=(predicate=()=>true,offset=0)=>{
 for(let index=offset;index<offset+200;index++){
  const run=choose(engine.createRun('system',`e39-activity-natural-${index}`),0);
  if(engine.canRequestActivity(run)&&predicate(run))return run;
 }
 throw new Error('No natural eligible activity fixture');
};
const finish=(source,id,policy=0,check=()=>{})=>{
 let run=engine.requestActivity(source,id),stages=0;
 assert.notEqual(run,source);
 while(run.activityContext){
  assert.ok(stages<8,`${id} must finish rather than loop`);
  const event=engine.getEvent(run),available=event.choices.flatMap((choice,index)=>choice.available===false?[]:[index]);
  assert.ok(available.length>=1,`${id}/${stages} remains playable`);
  const index=available[policy%available.length],pending=engine.applyChoice(run,index);
  check({run,event,index,pending,stage:stages});
  run=engine.advance(pending);stages++;
 }
 return {run,stages};
};

test('seven activity invitations are explicit, immutable and cost no RNG, money or workday to open',()=>{
 assert.deepEqual([...ACTIVITY_IDS_V44].sort(),['arm','diet','roadshow','dinner','banquet','basketball','review'].sort());
 const source=natural(),snapshot=copy(source),original=copy(engine.getEvent(source));canonical(source);
 const availability=engine.getActivityAvailability(source);
 assert.equal(availability.available,true);assert.equal(typeof availability.reason,'string');
 for(let index=0;index<6;index++){
  assert.equal(engine.canRequestActivity(source),true);assert.deepEqual(engine.getActivityAvailability(source),availability);
  assert.deepEqual(engine.getEvent(source),original);
 }
 assert.deepEqual(source,snapshot,'reading and closing the activity list cannot mutate the life');
 for(const id of ACTIVITY_IDS_V44){
  const opened=engine.requestActivity(source,id);
  assert.notEqual(opened,source);assert.equal(opened.pending,false);assert.equal(opened.turn,source.turn);
  assert.equal(opened.rng,source.rng);assert.deepEqual(opened.stats,source.stats);assert.deepEqual(opened.history,source.history);
  assert.deepEqual(opened.actions,[...source.actions,{type:'activity',version:1,activityId:id}]);
  assert.deepEqual(opened.activityContext,{version:1,id,stage:0,returnEventId:source.eventId,score:0,pressure:0,plan:'',picks:[]});
  assert.deepEqual(engine.requestActivity(source,id),opened);canonical(opened);sameReplay(opened);
 }
 assert.deepEqual(source,snapshot);
});

test('all seven activities play through multiple committed rounds and replay every pending result and return',()=>{
 for(const id of ACTIVITY_IDS_V44)for(let policy=0;policy<3;policy++){
  const source=natural(()=>true,policy*4),snapshot=copy(source),original=copy(engine.getEvent(source));
  const {run:after,stages}=finish(source,id,policy,({run,event,index,pending,stage})=>{
   const row=pending.history.at(-1);
   assert.equal(pending.pending,true);assert.equal(pending.turn,source.turn);
   assert.equal(pending.rng,nextRng(run.rng),`${id}/${stage}: one seeded result draw per selected option`);
   assert.equal(pending.history.length,run.history.length+1);assert.deepEqual(pending.history.slice(0,-1),run.history);
   assert.deepEqual(pending.actions.at(-1),{type:'choice',eventId:event.id,index});
   assert.equal(row.eventId,event.id);assert.equal(row.choiceIndex,index);assert.equal(row.choiceText,event.choices[index].text);
   assert.equal(row.activityOutcome.version,1);assert.equal(row.activityOutcome.id,id);assert.equal(row.activityOutcome.stage,stage);
   assert.equal(typeof row.activityOutcome.label,'string');assert.ok(row.activityOutcome.label.length>0);
   assert.equal(typeof row.result,'string');assert.ok(row.result.length>10);
   assert.equal(row.breakdown.some(part=>['income','workday','career-pressure','assignment','patronage-perk'].includes(part.source)),false,'activity rounds cannot silently pay or resolve an extra working day');
   for(const key of engine.STAT_KEYS){assert.ok(Number.isInteger(pending.stats[key]));assert.ok(pending.stats[key]>=0&&pending.stats[key]<=100,`${id}/${key}`);}
   assert.ok(pending.stats.skill+pending.stats.slack+pending.stats.lick<=180,'activity rewards obey the three-ability tradeoff');
   canonical(run);canonical(pending);assert.equal(engine.applyChoice(pending,index),pending,'double clicking the option cannot resolve it twice');
   const advanced=engine.advance(copy(pending));assert.equal(advanced.rng,pending.rng);assert.deepEqual(advanced.stats,pending.stats);
   assert.equal(advanced.turn,source.turn);canonical(advanced);sameReplay(advanced);
  });
  assert.equal(stages,id==='banquet'?4:3,`${id} has its own complete multi-round sequence`);
  assert.equal(after.eventId,source.eventId);assert.equal(after.pending,false);assert.equal(after.completed,false);
  assert.equal(after.flags[`activity44_${id}`],1);assert.equal(after.flags.activity44_last_turn,source.turn+1);
  assert.equal(after.turn,source.turn);assert.deepEqual(source,snapshot,'playing a copied branch cannot mutate the source');
  const restored=engine.getEvent(after);assert.equal(restored.id,original.id);
  assert.deepEqual(restored.choices.map(choice=>[choice.text,choice.effect??null]),original.choices.map(choice=>[choice.text,choice.effect??null]));
  for(const key of ['pay','offerPay','basePay','rank','actualRoleId','assignment','pip','pipCount','lastPromotion','seen','resumeEventId','breakReturnEventId','banquetReturnEventId'])assert.deepEqual(after[key],source[key],`${id}: restore ${key}`);
  canonical(after);sameReplay(after);assert.equal(engine.advance(after),after,'continue cannot accidentally answer the restored work event');
 }
});

test('activity scheduling cannot bypass personnel scenes, pending choices or exhausted resources',()=>{
 const source=natural(),opened=engine.requestActivity(source,'arm'),pending=engine.applyChoice(opened,0);
 for(const state of [engine.createRun('system','e39-activity-onboarding'),opened,pending,engine.applyChoice(source,0),engine.requestBreak(source),engine.requestExit(source)]){
  assert.equal(engine.canRequestActivity(state),false,state.eventId);assert.equal(engine.getActivityAvailability(state).available,false);
  for(const id of ACTIVITY_IDS_V44)assert.equal(engine.requestActivity(state,id),state);
 }
 // Boundary guards are intentionally tested separately from accepted saves;
 // the actual accepted trajectories above never inject stats or contexts.
 const blocked=[{pip:{active:true}},{flags:{...source.flags,floor_watch:1}},{chapterContext:{}},{companyContext:{}},{verbalContext:{}},{rageContext:{}},{patronageReplyContext:{}}];
 for(const patch of blocked){const state={...source,...patch};assert.equal(engine.canRequestActivity(state),false);assert.equal(engine.requestActivity(state,'arm'),state);}
 for(const key of ['mood','energy'])for(const value of [0,15]){
  const state={...source,stats:{...source.stats,[key]:value}};assert.equal(engine.canRequestActivity(state),false);assert.equal(engine.requestActivity(state,'arm'),state);
 }
 const broke={...source,stats:{...source.stats,cash:0}};assert.equal(engine.canRequestActivity(broke),false);
 for(const operation of [engine.requestBreak,engine.requestCareer,engine.requestRaise,engine.requestExit,engine.requestVerbal,engine.requestRage,engine.requestSalaryAdvice,engine.requestPatronageReply]){
  assert.equal(operation(opened),opened,'an unrelated menu cannot replace the active sequence');assert.equal(operation(pending),pending);
 }
 for(const id of [null,undefined,0,'','__proto__','not-an-activity'])assert.equal(engine.requestActivity(source,id),source);
});

test('an activity cannot repeat or be farmed between consecutive work turns',()=>{
 const source=natural(),after=finish(source,'arm').run;
 assert.equal(engine.canRequestActivity(after),false);assert.ok(engine.getActivityAvailability(after).reason.length>0);
 for(const id of ACTIVITY_IDS_V44)assert.equal(engine.requestActivity(after,id),after);
 let witnessed=false;
 for(let seed=0;seed<30&&!witnessed;seed++){
  const start=natural(()=>true,seed),finished=finish(start,'arm').run;let run=finished;
  for(let step=0;step<10&&!run.completed;step++){
   if(engine.canRequestActivity(run)){
    assert.ok(run.turn>=start.turn+2,'two real work turns must pass before another activity');
    assert.equal(engine.requestActivity(run,'arm'),run,'each activity is once per life even after the cooldown');
    assert.notEqual(engine.requestActivity(run,'diet'),run);canonical(run);witnessed=true;break;
   }
   const event=engine.getEvent(run),index=event.choices.findIndex(choice=>choice.available!==false);
   if(index<0)break;run=choose(run,index);
   if(run.turn<start.turn+2)assert.equal(engine.canRequestActivity(run),false);
  }
 }
 assert.equal(witnessed,true,'a normal life can attend another activity after working rather than staying permanently locked');
});

test('private basketball remains a social activity and never advances PIP or substitutes a workday',()=>{
 const source=natural(),opened=engine.requestActivity(source,'basketball');
 assert.equal(engine.getEvent(opened).scope,'private');
 const result=finish(source,'basketball',1).run;
 assert.equal(result.completed,false);assert.equal(result.turn,source.turn);assert.equal(result.pip,source.pip);
 assert.equal(result.rank,source.rank);assert.equal(result.pay,source.pay);
 const rows=result.history.slice(source.history.length);assert.equal(rows.length,3);
 assert.ok(rows.some(row=>/傑克/.test(`${row.title}${row.body}${row.result}`)),'Jack actually hosts the after-work game');
 assert.equal(rows.some(row=>row.kind==='daily'||row.kind==='fantasy'),false);
 canonical(result);sameReplay(result);
});

test('paid activity extras require enough cash and record exactly the amount actually spent',()=>{
 for(const id of ['basketball','dinner','banquet']){
  let run=engine.requestActivity(natural(),id),witnessed=false;
  while(run.activityContext){
   const event=engine.getEvent(run),poor={...run,stats:{...run.stats,cash:1}},poorEvent=engine.getEvent(poor);
   const index=event.choices.findIndex((choice,index)=>choice.available!==false&&poorEvent.choices[index].available===false);
   if(index>=0){
    assert.throws(()=>engine.applyChoice(poor,index),/Unavailable/,'a disabled extra cannot overdraw a one-dollar balance');
    const pending=engine.applyChoice(run,index),spent=run.stats.cash-pending.stats.cash;
    assert.ok(spent>0,`${id} paid extra really spends money`);
    assert.equal((pending.flags.cash_spent_total||0)-(run.flags.cash_spent_total||0),spent);
    const continued=engine.advance(pending);assert.equal(continued.stats.cash,pending.stats.cash,'continuing cannot charge the extra twice');
    canonical(pending);canonical(continued);sameReplay(continued);witnessed=true;break;
   }
   run=choose(run,0);
  }
  assert.equal(witnessed,true,`${id} has a meaningful optional expense and a visible affordability guard`);
 }
});

test('banquet afterparty preserves gender-specific invitations, Kind ghosting and zero charge for no trip',()=>{
 for(const gender of ['male','female'])for(const choice of [0,1]){
  const source=natural(run=>run.characterGender===gender);let run=engine.requestActivity(source,'banquet');
  for(let stage=0;stage<3;stage++)run=choose(run,0);
  assert.equal(run.activityContext.stage,3);const event=engine.getEvent(run),cash=run.stats.cash;
  assert.equal(event.speaker,'kind');
  if(gender==='male')assert.match(event.choices[0].text,/暗黑/);
  else{assert.match(event.choices[0].text,/甜點/);assert.doesNotMatch(event.choices[0].text,/暗黑|鋼琴/);}
  const pending=engine.applyChoice(run,choice),row=pending.history.at(-1),after=engine.advance(pending);
  assert.equal(pending.stats.cash,cash,'a vanished host cannot charge a trip that never happened');
  assert.match(row.result,/先走|消失|不見|下次|離線|找不到/);assert.equal(after.flags.kind_afterparty_ghost,1);
  assert.equal(after.eventId,source.eventId);assert.equal(after.completed,false);canonical(pending);canonical(after);sameReplay(after);
 }
});

test('activity conversations count the actual public character without awarding imagined or real hits',()=>{
 for(const id of ACTIVITY_IDS_V44)finish(natural(),id,0,({run,event,pending,stage})=>{
  assert.ok(CHARACTER_IDS.includes(event.speaker),`${id}/${stage}: speaker maps to a public character`);
  if(id==='diet'&&[0,2].includes(stage))assert.equal(event.speaker,'annie_yu','Annie Yu cannot be mistaken for the princess or an unknown name');
  const before=deriveCharacterStats(run),after=deriveCharacterStats(pending);
  for(const person of CHARACTER_IDS){
   const old=before.find(row=>row.id===person),next=after.find(row=>row.id===person);
   if(person!==event.speaker)assert.deepEqual(next,old,`${id}/${stage}: incidental names do not receive a conversation`);
   else assert.equal(next.encounters,old.encounters+1);
   assert.equal(next.imaginedHits,old.imaginedHits);assert.equal(next.realHits,old.realHits);
  }
 });
});

test('resolved First Love and arm-wrestling options earn the existing dedicated badges without revealing them in advance',()=>{
 const dedicated=['banquet-first-love','sonny-press-conference','sonny-unplayed-champion'];
 const earned=run=>deriveAchievements(run).filter(id=>dedicated.includes(id));
 const source=natural(),banquet=engine.requestActivity(source,'banquet');
 assert.deepEqual(earned(source),[]);assert.deepEqual(earned(banquet),[]);
 for(let index=0;index<3;index++){
  const pending=engine.applyChoice(banquet,index);
  assert.deepEqual(earned(pending),['banquet-first-love']);assert.ok(deriveAchievements(pending).includes('banquet'));
  canonical(pending);
  for(const mutate of [
   run=>{run.history.at(-1).activityOutcome.version=2;},
   run=>{run.history.at(-1).activityOutcome.stage=1;},
   run=>{run.history.at(-1).eventId='unrelated-activity';},
   run=>{run.history.at(-1).kind='daily';},run=>{run.seed='e38-activity-old';},
  ]){const invalid=copy(pending);mutate(invalid);assert.deepEqual(earned(invalid),[]);}
 }
 let arm=engine.requestActivity(source,'arm');arm=choose(choose(arm,0),0);assert.equal(arm.activityContext.stage,2);
 assert.deepEqual(earned(arm),[]);assert.deepEqual(earned(engine.applyChoice(arm,0)),[]);
 assert.deepEqual(earned(engine.applyChoice(arm,1)),['sonny-press-conference']);
 assert.deepEqual(earned(engine.applyChoice(arm,2)),[],'a completed bout cannot count as genuinely unplayed');
 const cancelled=choose(choose(engine.requestActivity(source,'arm'),0),2);assert.equal(cancelled.activityContext.plan,'unplayed');
 const crowned=engine.applyChoice(cancelled,2);assert.equal(crowned.history.at(-1).activityOutcome.label,'尚未出賽世界冠軍');
 assert.deepEqual(earned(crowned),['sonny-unplayed-champion']);canonical(crowned);sameReplay(engine.advance(crowned));
});

test('dinner budget and basketball fatigue each change later play through reachable earlier choices',()=>{
 const source=natural();
 const playFirstTwo=(id,choices)=>choices.reduce((run,index)=>choose(run,index),engine.requestActivity(source,id));
 const dinnerTight=playFirstTwo('dinner',[1,0]),dinnerRoom=playFirstTwo('dinner',[0,1]);
 canonical(dinnerTight);canonical(dinnerRoom);
 assert.ok(dinnerTight.activityContext.pressure>dinnerRoom.activityContext.pressure);
 const denied=engine.applyChoice(dinnerTight,0),approved=engine.applyChoice(dinnerRoom,0);
 assert.equal(denied.history.at(-1).activityOutcome.label,'第三盤沒有核准');
 assert.equal(approved.history.at(-1).activityOutcome.label,'留的預算派上用場');
 assert.equal(denied.stats.cash,dinnerTight.stats.cash);assert.equal(approved.stats.cash,dinnerRoom.stats.cash,'shared budget is distinct from spending player cash');
 assert.ok(approved.history.at(-1).delta.mood>denied.history.at(-1).delta.mood);
 const basketballTired=playFirstTwo('basketball',[0,1]),basketballRested=playFirstTwo('basketball',[0,0]);
 canonical(basketballTired);canonical(basketballRested);
 assert.ok(basketballTired.activityContext.pressure>basketballRested.activityContext.pressure);
 const tiring=engine.applyChoice(basketballTired,0),rested=engine.applyChoice(basketballRested,0);
 assert.ok(tiring.history.at(-1).delta.energy<rested.history.at(-1).delta.energy,'chasing shots instead of sharing the ball has a real later fatigue cost');
 for(const pending of [denied,approved,tiring,rested]){canonical(pending);sameReplay(engine.advance(pending));}
});

test('a naturally exhausted player sees an explicit departure decision after the match instead of silently ending',()=>{
 const actions=[
  ['onboarding',0],['system-backup',2],['education-scrutiny',0],['salary-cut',0],['sophie-one-minute-exit',1],
  ['crisis-mood',2],['crisis-mood',2],['job-system-credit-expiry',1],['career-review',2],['legal-title-sync',2],
 ].map(([eventId,index])=>({type:'choice',eventId,index}));
 const source=engine.replayRun('system','e39-activity-low-2',actions);assert.equal(source.stats.energy,16);assert.equal(engine.canRequestActivity(source),true);canonical(source);
 let run=engine.requestActivity(source,'basketball');for(const index of [0,1,0])run=choose(run,index);
 assert.equal(run.stats.energy,0);assert.equal(run.eventId,'chapter-resolution');assert.equal(run.chapterContext.family,'burnout');
 assert.equal(run.completed,false,'an activity can exhaust a player, but it cannot silently resign on their behalf');
 assert.equal(run.turn,source.turn);canonical(run);sameReplay(run);
 const finished=choose(run,0);assert.equal(finished.completed,true);assert.equal(finished.endingId,'burnout-system');canonical(finished);sameReplay(finished);
});

test('activity saves reject forged context, outcomes, RNG, rewards and action envelopes',()=>{
 const source=natural(),opened=engine.requestActivity(source,'review'),pending=engine.applyChoice(opened,0),continued=engine.advance(pending),finished=finish(source,'review').run;
 for(const valid of [opened,pending,continued,finished])canonical(valid);
 const mutations=[
  run=>{run.rng=nextRng(run.rng);},run=>{run.stats.cash=Math.min(100,run.stats.cash+1);},
  run=>{run.activityContext.score+=1;},run=>{run.activityContext.stage+=1;},run=>{run.activityContext.returnEventId='onboarding';},
  run=>{run.activityContext.picks.push(2);},run=>{run.activityContext.unexpected=true;},run=>{run.activityContext.id='banquet';},
 ];
 for(const mutate of mutations){const invalid=copy(continued);mutate(invalid);assert.equal(engine.validRun(invalid),false);}
 for(const mutate of [
  run=>{run.history.at(-1).result='玩家自己補上一個通過審查結果';},
  run=>{run.history.at(-1).activityOutcome.score+=100;},
  run=>{run.history.at(-1).delta.cash=100;},run=>{run.flags.activity44_review=7;},
 ]){const invalid=copy(finished);mutate(invalid);assert.equal(engine.validRun(invalid),false);}
 for(const patch of [{version:2},{version:'1'},{activityId:'missing'},{activityId:'review',score:100},{activityId:'review',eventId:source.eventId}]){
  const actions=[...source.actions,{type:'activity',version:1,activityId:'review',...patch}];
  assert.throws(()=>engine.replayRun(source.roleId,source.seed,actions));
 }
 const injected=copy(source);injected.activityContext=copy(opened.activityContext);injected.eventId=opened.eventId;assert.equal(engine.validRun(injected),false);
});

test('completed lives after an activity retain a full visual report and replayable anonymous proof',()=>{
 for(const id of ACTIVITY_IDS_V44){
  const source=natural(),returned=finish(source,id).run,leaving=engine.requestExit(returned);
  assert.notEqual(leaving,returned);const finished=choose(leaving,0);
  assert.equal(finished.completed,true);canonical(finished);sameReplay(finished);
  const report=buildEndingReport(finished),snapshot=copy(finished);
  assert.equal(report.metadata.complete,true,`${id}: activity invitation does not become a missing decision`);
  assert.equal(report.metadata.decisionCount,finished.history.length);assert.equal(report.metadata.workTurns,finished.turn);
  assert.deepEqual(report.samples.at(-1).stats,finished.stats);
  for(const metric of report.stats){assert.equal(metric.available,true,`${id}/${metric.key}`);assert.equal(metric.reason,null);}
  for(const trend of report.trends){assert.equal(trend.available,true);assert.equal(trend.points.length,finished.history.length+1);}
  assert.deepEqual(finished,snapshot,'constructing a report cannot change the saved life');
 }
});

test('returning to work preserves result-phase verbal and rage replay semantics',()=>{
 const returned=finish(natural(),'roadshow').run;
 for(const phase of ['event','result'])for(const type of ['verbal','rage']){
  const ready=phase==='event'?returned:engine.applyChoice(returned,0);canonical(ready);
  const pending=type==='verbal'?engine.requestVerbal(ready,undefined,2):engine.requestRage(ready);
  assert.notEqual(pending,ready,`${type}/${phase} remains available after the activity`);
  assert.equal(pending.actions.at(-1).phase,phase);canonical(pending);
  const resolved=engine.advance(pending);canonical(resolved);sameReplay(resolved);
 }
});

test('published cohorts do not silently gain activity behavior and malformed requests cannot enter it',()=>{
 for(const seed of ['old-activity','e29-old-activity','e38-old-activity','e40-future-activity']){
  const source=choose(engine.createRun('system',seed),0),snapshot=copy(source);
  assert.equal(engine.canRequestActivity(source),false);
  for(const id of ACTIVITY_IDS_V44)assert.equal(engine.requestActivity(source,id),source);
  assert.deepEqual(source,snapshot);
  assert.throws(()=>engine.replayRun(source.roleId,source.seed,[...source.actions,{type:'activity',version:1,activityId:'arm'}]));
 }
});
