import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {ROLES} from '../dist/roles.js';
import {ENDINGS} from '../dist/endings.js';
import {deriveAchievements} from '../dist/achievements.js';
import {personnelDecision,freshPersonnelProvocation,personnelSafe,watchNextEvent,WATCH_DAILY_IDS} from '../dist/personnel-v20.js';
import {createRun,getEvent,applyChoice,advance,requestExit,requestBreak,requestCareer,requestRaise,requestRage,canRequestCareer,canRequestRaise,validRun,replayRun,STAT_KEYS} from '../dist/engine.js';

const copy=value=>JSON.parse(JSON.stringify(value));
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fixtures=name=>JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`,import.meta.url)));
const handlers={exit:requestExit,break:requestBreak,career:requestCareer,raise:requestRaise};
const personnelRoute=id=>{const route=fixtures('personnel-routes-v20').routes.find(item=>item.id===id);assert.ok(route,`missing personnel witness ${id}`);return route;};
const personnelRun=id=>traceRoute(personnelRoute(id),{saved:true}).run;

function traceRoute(route,{saved=false,hashes=false}={}){
 let run=createRun(route.roleId,route.seed);const trace=[],checkpoints=[];
 const checkpoint=()=>{
  if(saved)run=copy(run);
  assert.equal(validRun(run),true,`${route.id||route.ending}: ${run.eventId}/${run.pendingEffect}`);
  if(hashes)checkpoints.push(hash(run));
 };
 checkpoint();
 for(let index=0;index<route.actions.length;index++){
  const action=route.actions[index],before=copy(run);let pending=null;
  if(action.type==='choice'){
   assert.equal(run.eventId,action.eventId);
   run=applyChoice(run,action.index);checkpoint();pending=copy(run);
   const last=run.history.at(-1);
   for(const key of STAT_KEYS)assert.equal(last.breakdown.reduce((sum,row)=>sum+(row.delta[key]||0),0),last.delta[key],`${action.eventId}/${key}`);
   if(!(route.actions[index+1]?.type==='rage'&&route.actions[index+1].phase==='result'))run=advance(run);
  }else if(action.type==='rage'){
   run=requestRage(run);checkpoint();pending=copy(run);run=advance(run);
  }else{
   const previous=run;run=handlers[action.type](run);assert.notEqual(run,previous,`${action.type} unavailable`);
  }
  checkpoint();trace.push({action,before,pending,after:copy(run)});
 }
 return {run,trace,checkpoints};
}

test('all 347 e19 routes retain 14511 exact direct and JSON checkpoints, including salary negotiation',()=>{
 const routes=fixtures('legacy-e19-routes');assert.equal(routes.length,347);let count=0;
 for(const route of routes)for(const saved of [false,true]){
  const {run,checkpoints}=traceRoute(route,{saved,hashes:true});
  assert.deepEqual(checkpoints,saved?route.savedCheckpoints:route.directCheckpoints,route.ending);
  assert.equal(hash(run),saved?route.savedStateSha256:route.stateSha256,route.ending);
  assert.deepEqual(replayRun(route.roleId,route.seed,route.actions),run,route.ending);
  if(!saved)count+=checkpoints.length;
 }
 assert.equal(count,14511);
});

test('the three personnel endings exist for all nine professions without replacing their career titles',()=>{
 for(const role of ROLES)for(const family of ['cold_storage','mediation_settled','mediation_pending'])assert.ok(ENDINGS.some(ending=>ending.id===`${family}-${role.id}`));
 assert.equal(ENDINGS.length,341);
});

test('personnel decisions keep ordinary PIP possible and only rarely offer a second improvement period',()=>{
 const run={...createRun('system','e20-decisions'),turn:6,pipCount:1,flags:{},stats:{boss:10}};
 assert.equal(personnelDecision(run,'passed',0,.359),'freeze');assert.equal(personnelDecision(run,'passed',0,.36),null);
 assert.equal(personnelDecision(run,'first',14,.24),'direct');assert.equal(personnelDecision(run,'first',14,.25),'ordinary');
 assert.equal(personnelDecision({...run,stats:{boss:2}},'first',14,.64),'direct');assert.equal(personnelDecision(run,'first',24,.64),'direct');
 assert.equal(personnelDecision(run,'post-pip',10,.649),'direct');assert.equal(personnelDecision(run,'post-pip',10,.65),'freeze');
 assert.equal(personnelDecision(run,'post-pip',10,.949),'freeze');assert.equal(personnelDecision(run,'post-pip',10,.95),'ordinary');
 assert.equal(personnelDecision({...run,flags:{floor_watch:1}},'post-pip',10,.7),'direct');
 assert.equal(personnelDecision({...run,pipCount:2},'post-pip',10,.99),'direct');assert.equal(personnelDecision({...run,turn:21},'post-pip',10,.99),'direct');
});

test('fresh provocation uses only the resolved Wing choice, never a persistent low mood or an HR response',()=>{
 const run={...createRun('system','e20-provocation'),flags:{post_pip_tolerance:1},stats:{boss:0}};
 const event={id:'education-review',kind:'career'};
 assert.equal(freshPersonnelProvocation(run,event,{boss:0}),null);
 assert.equal(freshPersonnelProvocation(run,event,{boss:4}),null);
 assert.deepEqual(freshPersonnelProvocation(run,event,{boss:-1}),{reason:'post-pip',strength:1,source:'education-review'});
 assert.equal(freshPersonnelProvocation({...run,pip:{active:true,remaining:2}},event,{boss:-30}),null);
 for(const kind of ['crisis','self-care','rage','rage-world','banquet'])assert.equal(freshPersonnelProvocation(run,{...event,kind},{boss:-30}),null);
 for(const id of ['pip-review','pip-passed','paperwork','floor-notice','dismissal-final'])assert.equal(freshPersonnelProvocation(run,{...event,id},{boss:-30}),null);
 assert.equal(freshPersonnelProvocation({...run,flags:{},stats:{boss:10}},event,{boss:-8}),null);
 assert.deepEqual(freshPersonnelProvocation({...run,flags:{},stats:{boss:20}},event,{boss:-14}),{reason:'first',strength:14,source:'education-review'});
});

test('deferred personnel actions wait for every nested scene and watch reviews use three real workdays',()=>{
 const run={pending:false,completed:false,raiseContext:null,rageContext:null,meltdownReturnEventId:null,resumeEventId:null,exitReturnEventId:null,breakReturnEventId:null,banquetReturnEventId:null};
 assert.equal(personnelSafe(run,{kind:'daily'}),true);assert.equal(personnelSafe(run,{kind:'fantasy'}),true);
 for(const key of ['raiseContext','rageContext','meltdownReturnEventId','resumeEventId','exitReturnEventId','breakReturnEventId','banquetReturnEventId'])assert.equal(personnelSafe({...run,[key]:'pending'},{kind:'daily'}),false,key);
 assert.equal(personnelSafe({...run,pending:true},{kind:'daily'}),false);assert.equal(personnelSafe({...run,completed:true},{kind:'daily'}),false);
 for(const kind of ['crisis','career','self-care','banquet','rage-world'])assert.equal(personnelSafe(run,{kind}),false,kind);
 for(let day=0;day<3;day++)assert.equal(watchNextEvent({turn:10,flags:{floor_watch_days:day}}),WATCH_DAILY_IDS[day]);
 assert.equal(watchNextEvent({turn:10,flags:{floor_watch_days:3}}),'watch-future');
 assert.notEqual(watchNextEvent({turn:10,flags:{floor_watch_days:3,watch_next_review:6}}),'watch-future');
 assert.equal(watchNextEvent({turn:24,flags:{floor_watch_days:1}}),'watch-future');
});

test('natural personnel witnesses survive direct play, JSON saves and canonical replay',()=>{
 const report=fixtures('personnel-routes-v20');
 assert.match(report.method,/no state injection/i);
 assert.ok(report.routes.length>=27);
 for(const route of report.routes){
  assert.match(route.seed,/^e20-/);
  const direct=traceRoute(route).run,saved=traceRoute(route,{saved:true}).run;
  assert.deepEqual(saved,direct,route.id||route.ending);
  assert.deepEqual(replayRun(route.roleId,route.seed,route.actions),direct,route.id||route.ending);
  if(route.ending)assert.equal(direct.endingId,route.ending);
  assert.deepEqual({eventId:direct.eventId,endingId:direct.endingId,turn:direct.turn,pipCount:direct.pipCount,floorWatch:direct.flags.floor_watch||0,floorDays:direct.flags.floor_watch_days||0},route.expected);
 }
});

test('passing PIP gives a real choice to leave; only staying may draw the three-floor assignment',()=>{
 const notice=personnelRun('pip-passed-notice');assert.equal(notice.flags.post_pip_tolerance,1);
 const quit=advance(applyChoice(notice,0));assert.equal(quit.endingId,`pip_exit-${notice.roleId}`);assert.equal(quit.personnelPending,null);assert.equal(quit.rng,notice.rng);
 const outcomes=[1,2].map(index=>advance(applyChoice(notice,index)));
 assert.equal(outcomes[0].rng,outcomes[1].rng);assert.equal(outcomes[0].eventId==='floor-notice',outcomes[1].eventId==='floor-notice');
 for(const run of outcomes){assert.equal(run.pip,null);assert.equal(run.turn,notice.turn);assert.equal(run.pay,notice.pay);assert.equal(run.rank,notice.rank);assert.equal(run.actualRoleId,notice.actualRoleId);assert.equal(validRun(copy(run)),true);}
 const frozen=personnelRun('floor-after-pip');assert.equal(frozen.eventId,'floor-notice');assert.equal(frozen.history.at(-1).eventId,'pip-passed');
 assert.match(getEvent(frozen).body,/三樓/);assert.match(getEvent(frozen).body,/五樓/);assert.equal(requestExit(frozen),frozen);
 const ordinary=personnelRun('passed-back-at-work');assert.equal(ordinary.flags.floor_watch||0,0);assert.ok(['daily','fantasy'].includes(getEvent(ordinary).kind));
});

test('three-floor work preserves title and pay but does not earn promotion service, and review choices do not spend workdays',()=>{
 let sawIncome=false,dailyCount=0;
 for(const route of fixtures('personnel-routes-v20').routes.filter(item=>item.id.startsWith('ending-cold_storage-'))){
  const {trace}=traceRoute(route,{saved:true});
  for(const {before,pending,after}of trace){
   if(!pending)continue;
   if(pending.pendingEffect==='watchStart')for(const key of ['pay','rank','actualRoleId','assignment'])assert.equal(after[key],before[key],key);
   if(!WATCH_DAILY_IDS.includes(before.eventId))continue;
   dailyCount++;
   assert.equal(pending.flags.floor_watch_days,(before.flags.floor_watch_days||0)+1);assert.equal(after.turn,before.turn+1);
   assert.equal(pending.flags.career_service,before.flags.career_service);
   assert.equal(pending.flags[`career_work_${before.rank}`],before.flags[`career_work_${before.rank}`]);
   for(const key of ['pay','rank','actualRoleId','assignment'])assert.equal(pending[key],before[key],key);
   assert.equal(canRequestCareer(before),false);assert.equal(canRequestRaise(before),false);
   const income=pending.history.at(-1).breakdown.find(row=>row.source==='income');
   if(income){sawIncome=true;assert.equal(income.delta.cash,Math.min(100-before.stats.cash,Math.max(4,Math.round(before.pay/10))));}
  }
 }
 assert.ok(dailyCount>=18);assert.equal(sawIncome,true);
 const review=personnelRun('watch-three-days');assert.equal(review.flags.floor_watch_days,3);
 const continued=personnelRun('watch-continue');assert.equal(continued.turn,review.turn);assert.equal(continued.flags.watch_next_review,6);assert.equal(continued.eventId,'watch-empty-corridor');
 const recalled=personnelRun('watch-recalled');assert.equal(recalled.flags.floor_watch,0);assert.equal(recalled.flags.post_pip_tolerance,1);assert.ok(!WATCH_DAILY_IDS.includes(recalled.eventId));
 const refused=personnelRun('watch-dismissed');assert.equal(refused.eventId,'dismissal-final');assert.equal(refused.personnelPending,null);
});

test('direct dismissals cannot reopen PIP through the document or mediation routes',()=>{
 for(const id of ['direct-without-pip','direct-after-pip']){
  const dismissed=personnelRun(id);assert.equal(dismissed.eventId,'dismissal-final');assert.equal(dismissed.flags.hr_pip_allowed,0);
  assert.equal(getEvent(dismissed).choices.some(choice=>choice.effect==='startPip'&&choice.available!==false),false);
  for(const choiceIndex of [1,2]){
   const claim=advance(applyChoice(dismissed,choiceIndex));assert.equal(claim.eventId,'labor-claim');
   for(let index=0;index<getEvent(claim).choices.length;index++){
    const meeting=advance(applyChoice(claim,index));assert.equal(meeting.eventId,'labor-mediation');assert.equal(meeting.pipCount,dismissed.pipCount);
    assert.equal(getEvent(meeting).choices.some(choice=>choice.effect==='startPip'&&choice.available!==false),false);
    for(let final=0;final<getEvent(meeting).choices.length;final++){
     const ended=advance(applyChoice(meeting,final));assert.ok(['mediation_settled','mediation_pending'].some(family=>ended.endingId===`${family}-${ended.roleId}`));assert.equal(ended.personnelPending,null);assert.equal(validRun(copy(ended)),true);
    }
   }
  }
  assert.equal(advance(dismissed),dismissed);
 }
});

test('after PIP weather and a persistent zero boss mood do not create a fresh personnel punishment',()=>{
 const source=personnelRun('passed-back-at-work');let weatherChanges=0;
 for(let index=0;index<24;index++){
  const boundary={...copy(source),rng:createRun('system',`e20-weather-control-${index}`).rng,eventId:'jack-notebook',personnelPending:null,resumeEventId:null,stats:{...source.stats,boss:0,mood:90,energy:90,cash:90}};
  const pending=applyChoice(boundary,0);assert.equal(pending.personnelPending,null);
  weatherChanges+=Number(pending.lastWeather.delta!==0);
  const next=advance(pending);assert.ok(!['dismissal-final','floor-notice','crisis-boss'].includes(next.eventId),next.eventId);assert.equal(validRun(copy(next)),true);
 }
 assert.ok(weatherChanges>0);
});

test('new post-PIP provocations can dismiss or freeze the player, while the rare repeat PIP stays bounded',()=>{
 const repeated=personnelRun('rare-second-pip');assert.equal(repeated.pipCount,2);assert.equal(repeated.pip.active,true);assert.equal(repeated.pip.remaining,3);
 const frozen=personnelRun('floor-after-provocation');assert.equal(frozen.flags.post_pip_tolerance,1);assert.notEqual(frozen.history.at(-1).eventId,'pip-passed');
 const source=personnelRun('passed-back-at-work'),outcomes=new Set();
 for(let index=0;index<60;index++){
  const boundary={...copy(source),rng:createRun('system',`e20-provocation-control-${index}`).rng,eventId:'education-review',resumeEventId:null,personnelPending:null,stats:{...source.stats,boss:0,mood:90,energy:90,cash:90}};
  const pending=applyChoice(boundary,1);assert.equal(pending.personnelPending.reason,'post-pip');assert.equal(pending.personnelPending.strength,15);
  const next=advance(pending);outcomes.add(next.eventId);assert.equal(next.personnelPending,null);assert.equal(validRun(copy(next)),true);assert.equal(advance(next),next);
 }
 assert.ok(outcomes.has('dismissal-final'));assert.ok(outcomes.has('floor-notice'));
});

test('an active improvement period keeps all three work scenes without a nested dismissal or floor notice',()=>{
 const source=personnelRun('rare-second-pip');
 let run={...copy(source),eventId:'education-review',resumeEventId:null,personnelPending:null,stats:{...source.stats,boss:0,mood:100,energy:100,cash:90}};
 const discussed=applyChoice(run,1);assert.equal(discussed.personnelPending,null);assert.equal(discussed.pip.remaining,3);run=advance(discussed);
 assert.equal(run.pip.remaining,3);assert.ok(!['floor-notice','dismissal-final'].includes(run.eventId));
 for(let step=0;step<3;step++){
  run={...run,eventId:'jack-notebook'};const before=run,pending=applyChoice(run,0);assert.equal(pending.personnelPending,null);assert.equal(pending.pip.remaining,2-step);
  run=advance(pending);assert.equal(run.turn,before.turn+1);assert.equal(validRun(copy(run)),true);
  if(step<2)assert.ok(!['floor-notice','dismissal-final','pip-review'].includes(run.eventId));
 }
 assert.equal(run.eventId,'pip-review');assert.equal(run.pipCount,2);
});

test('salary, dream and zero-mood interruptions preserve a queued personnel reaction until it is safe',()=>{
 const raised=traceRoute(personnelRoute('raise-to-personnel'),{saved:true});let queuedDuringRaise=false;
 for(const {pending,after}of raised.trace)if(pending?.personnelPending&&pending.raiseContext){
  queuedDuringRaise=true;
  if(after.raiseContext){assert.ok(after.eventId.startsWith('raise-')||after.eventId==='mood-collapse');assert.ok(after.personnelPending);}
 }
 assert.equal(queuedDuringRaise,true);assert.equal(raised.run.raiseContext,null);assert.equal(raised.run.personnelPending,null);
 const dreamed=traceRoute(personnelRoute('dream-result-restores-personnel'),{saved:true});const rage=dreamed.trace.find(item=>item.action.type==='rage');assert.ok(rage);
 assert.equal(rage.pending.rageContext.mode,'imagined');assert.equal(rage.after.rageContext,null);
 assert.equal(rage.after.turn,rage.before.turn+Number(['daily','fantasy','onboarding'].includes(rage.before.history.at(-1).kind)));
 assert.ok(rage.after.personnelPending||['crisis-boss','floor-notice','dismissal-final'].includes(rage.after.eventId));
 const collapsed=personnelRun('meltdown-with-personnel');assert.equal(collapsed.eventId,'mood-collapse');assert.ok(collapsed.personnelPending||['crisis-boss','floor-notice','dismissal-final'].includes(collapsed.meltdownReturnEventId));
 for(const index of [0,1])if(getEvent(collapsed).choices[index].available!==false){
  const next=advance(applyChoice(collapsed,index));assert.equal(next.turn,collapsed.turn);assert.equal(next.meltdownReturnEventId,null);assert.equal(validRun(copy(next)),true);
  if(next.completed){assert.equal(next.endingId,`broke-${next.roleId}`);assert.equal(next.personnelPending,null);}
  else assert.ok(next.personnelPending||['crisis-boss','floor-notice','dismissal-final'].includes(next.eventId));
  assert.equal(advance(next),next);
 }
 const ended=advance(applyChoice(collapsed,2));assert.equal(ended.completed,true);assert.equal(ended.personnelPending,null);
});

test('natural conversations with the sales manager reach both new illustrated achievements',()=>{
 for(const mode of ['imagined','real']){
  const {run,trace}=traceRoute(personnelRoute(`meimei-rage-${mode}`),{saved:true}),rage=trace.findLast(item=>item.action.type==='rage');assert.ok(rage);
  assert.equal(rage.pending.rageContext.target,'meimei');assert.equal(rage.pending.rageContext.mode,mode);
  assert.ok(deriveAchievements(run).includes('rage-meimei'));
  assert.equal(deriveAchievements(run).includes('dream-meimei'),mode==='imagined');
 }
});

test('saved personnel state rejects malformed queues, impossible floor flags and a third PIP',()=>{
 const source=personnelRun('passed-back-at-work');
 for(const personnelPending of [{reason:'invented',source:'pip-passed',strength:0},{reason:'passed',source:'pip-passed',strength:1},{reason:'first',source:'invented-event',strength:12},{reason:'post-pip',source:'pip-passed',strength:-1},{reason:'post-pip',source:'pip-passed',strength:8,extra:true}])assert.equal(validRun({...copy(source),personnelPending}),false,JSON.stringify(personnelPending));
 for(const flags of [{floor_watch:2},{post_pip_tolerance:2},{hr_pip_allowed:2},{floor_watch_days:25},{watch_next_review:28}])assert.equal(validRun({...copy(source),flags:{...source.flags,...flags}}),false,JSON.stringify(flags));
 assert.equal(validRun({...copy(source),pipCount:3}),false);
 assert.equal(validRun({...copy(source),eventId:'watch-empty-corridor',flags:{...source.flags,floor_watch:0}}),false);
});

test('published e20 routes retain every personnel family for every profession',()=>{
 const routes=fixtures('legacy-e20-routes');
 for(const family of ['cold_storage','mediation_settled','mediation_pending'])for(const role of ROLES){
  const route=routes.find(item=>item.ending===`${family}-${role.id}`);assert.ok(route,`${family}-${role.id}`);
  assert.match(route.seed,/^e20-/);assert.equal(replayRun(route.roleId,route.seed,route.actions).endingId,route.ending);
 }
});
