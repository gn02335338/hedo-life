import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as engine from '../dist/engine.js';
import {ACTIVITY_IDS_V44,ACTIVITY_META_V44} from '../dist/activities-v44.js';
import {activityProgressHTMLV44} from '../dist/activity-ui-v44.js';
import {activityPhaseV52,activityPhaseNoticeHTMLV52,activityReturnNoticeHTMLV52} from '../dist/activity-phases-v52.js';

const copy=value=>JSON.parse(JSON.stringify(value));
const choose=(run,index=0)=>engine.advance(engine.applyChoice(run,index));
const naturalSource=()=>{
 for(let index=0;index<100;index++){
  const run=choose(engine.createRun('system',`e39-activity-natural-${index}`));
  if(engine.canRequestActivity(run))return run;
 }
 throw new Error('No natural activity source');
};
const source=naturalSource();
const paths=new Map();
for(const id of ACTIVITY_IDS_V44){
 let run=engine.requestActivity(source,id);const stages=[];
 assert.notEqual(run,source,id);
 while(run.activityContext){
  assert.ok(stages.length<5);
  const event=engine.getEvent(run),index=event.choices.findIndex(choice=>choice.available!==false),pending=engine.applyChoice(run,index);
  stages.push({run,event,pending});run=engine.advance(pending);
 }
 paths.set(id,{stages,returned:run});
}

for(const id of ACTIVITY_IDS_V44)test(`${id}: accepted activity marks its start, every later stage and the committed finish`,()=>{
 const {stages,returned}=paths.get(id),name=id==='basketball'?'下班球局':ACTIVITY_META_V44[id].name;
 for(const {run,event,pending}of stages){
  const snapshot=JSON.stringify({run,event,pending}),number=event.activity.stage;
  assert.equal(engine.validRun(copy(run)),true);
  assert.equal(engine.validRun(copy(pending)),true);
  const phase=activityPhaseV52(run,event),html=activityProgressHTMLV44(run,event);
  assert.equal(phase.phase,number===0?'start':'progress');
  assert.equal(phase.title,`${name}${number===0?'開始':'進行中'}`);
  assert.ok(html.includes(`第 ${number+1} / ${stages.length} 幕`));
  assert.doesNotMatch(html,/activity-phase-end/,'viewing the last unanswered stage cannot end it');
  assert.doesNotMatch(html,/機率|觸發率|成功率/);
  const after=activityPhaseV52(pending,event),result=activityProgressHTMLV44(pending,event);
  assert.equal(after.phase,number===stages.length-1?'end':'result');
  assert.equal(after.title,number===stages.length-1?`${name}結束`:`${name}・本幕結果`);
  assert.doesNotMatch(result,new RegExp(`${name}開始|${name}進行中`));
  assert.ok(result.includes('這些是剛才已發生的變化。'));
  if(number===stages.length-1){
   assert.match(result,/活動結束/);
   assert.ok(result.includes(name));
  }else assert.doesNotMatch(result,/activity-phase-end|活動結束/);
  for(let repeat=0;repeat<3;repeat++){activityProgressHTMLV44(run,event);activityPhaseNoticeHTMLV52(pending,event);}
  assert.equal(JSON.stringify({run,event,pending}),snapshot,'rendering never changes the stream, answers or context');
 }
 assert.equal(engine.validRun(copy(returned)),true);
 assert.deepEqual(engine.replayRun(returned.roleId,returned.seed,returned.actions),returned);
 const snapshot=JSON.stringify(returned),notice=activityReturnNoticeHTMLV52(returned,engine.getEvent(returned));
 assert.ok(notice.includes(`${name}已結束`),`${id}: immediate return retains a visible finished cue`);
 assert.ok(notice.includes('活動前尚未處理的那一幕'));
 assert.equal(returned.turn,source.turn);
 assert.equal(JSON.stringify(returned),snapshot);
});

test('a done flag only ends its own final committed activity row',()=>{
 const {stages}=paths.get('diet'),last=stages.at(-1),earlier=stages[0];
 for(const patch of [
  row=>delete row.activityOutcome.done,
  row=>row.activityOutcome.done=false,
  row=>row.activityOutcome.id='dinner',
  row=>row.activityOutcome.stage=0,
  row=>row.eventId='unrelated-event',
  row=>row.kind='daily'
 ]){
  const run=copy(last.pending);patch(run.history.at(-1));
  assert.equal(activityPhaseV52(run,last.event).phase,'result');
  assert.doesNotMatch(activityProgressHTMLV44(run,last.event),/減肥比賽結束|活動結束/);
 }
 const early=copy(earlier.pending);early.history.at(-1).activityOutcome.done=true;
 assert.equal(activityPhaseV52(early,earlier.event).phase,'result');
 const run=copy(last.run);run.activityContext.stage--;
 assert.equal(activityPhaseV52(run,last.event),null);
 assert.equal(activityProgressHTMLV44(run,last.event),'');
});

test('daily side stories, invitations and other interruptions never pose as formal activity starts',()=>{
 const run=paths.get('arm').stages[0].run;
 for(const event of [
  {id:'arm-jury',kind:'daily',title:'兩個選手，十二個裁判。'},
  {id:'activity46-invite-diet',kind:'activity-invitation'},
  {id:'mood-collapse',kind:'crisis'},
  {id:'banquet-welcome',kind:'daily'},
  null
 ]){
  assert.equal(activityPhaseV52(run,event),null);
  assert.equal(activityProgressHTMLV44(run,event),'');
  assert.equal(activityReturnNoticeHTMLV52(run,event),'');
 }
 assert.equal(activityProgressHTMLV44({},{}),'');
});

test('finished banners disappear after a real next choice or a new action and do not cover mandatory crises',()=>{
 const source=paths.get('dinner').returned,event=engine.getEvent(source);
 assert.match(activityReturnNoticeHTMLV52(source,event),/公司聚餐已結束/);
 const pending=engine.applyChoice(source,0);
 assert.equal(activityReturnNoticeHTMLV52(pending,engine.getEvent(pending)),'');
 const next=engine.advance(pending);
 assert.equal(activityReturnNoticeHTMLV52(next,engine.getEvent(next)),'');
 for(const patch of [
  {actions:[...source.actions,{type:'break'}]},
  {turn:source.turn+1},
  {completed:true},
  {pending:true},
  {pendingFamily:'burnout'},
  {activityInvitationContext:{}},{hiddenEncounterContext:{}},{chapterContext:{}},{companyContext:{}},
  {rageContext:{}},{verbalContext:{}},{patronageReplyContext:{}},{raiseContext:{}},{mealContext:{}},
  {personnelPending:{}},{resumeEventId:'source'},{banquetReturnEventId:'source'},
  {salaryAdvice:{status:'open'}},{salaryAdvice:{status:'queued'}},
  {stats:{...source.stats,mood:0}},{stats:{...source.stats,energy:0}},{stats:{...source.stats,cash:0}}
 ])assert.equal(activityReturnNoticeHTMLV52({...source,...patch},event),'',JSON.stringify(patch));
 for(const kind of ['crisis','career','company','verbal','rage','hidden','self-care','activity-invitation']){
  assert.equal(activityReturnNoticeHTMLV52(source,{...event,kind}),'',kind);
 }
 const gap=activityReturnNoticeHTMLV52(source,{id:'work-gap-v50',kind:'work-gap'});
 assert.match(gap,/下一件事還沒開始/);
});

test('the original three-scene banquet also has exact boundaries without changing its replay state',()=>{
 // These are projection-only snapshots: the legacy protocol has no activity
 // context or done field, so its committed banquetFinish effect is the marker.
 const ids=['banquet-welcome','banquet-draw','banquet-afterparty'];
 for(const [stage,id]of ids.entries()){
  const run={banquetReturnEventId:'work',pending:false,history:[]},event={id,kind:'banquet'};
  const snapshot=JSON.stringify(run),phase=activityPhaseV52(run,event);
  assert.equal(phase.phase,stage===0?'start':'progress');assert.equal(phase.total,3);
  assert.ok(activityProgressHTMLV44(run,event).includes(`第 ${stage+1} / 3 幕`));
  assert.equal(JSON.stringify(run),snapshot);
  const pending={...run,pending:true,pendingEffect:stage===2?'banquetFinish':'banquetDraw',history:[{eventId:id,kind:'banquet'}]};
  assert.equal(activityPhaseV52(pending,event).phase,stage===2?'end':'result');
  if(stage===2){
   const unfinished={...pending,pendingEffect:'banquetDraw'};
   assert.equal(activityPhaseV52(unfinished,event).phase,'result');
  }
 }
 const returned={turn:12,pending:false,completed:false,stats:{mood:35,energy:30,cash:55},history:[{eventId:'banquet-afterparty',kind:'banquet',turn:12,choiceIndex:3}],actions:[{type:'choice',eventId:'banquet-afterparty',index:3}]};
 assert.match(activityReturnNoticeHTMLV52(returned,{kind:'daily'}),/尾牙已結束/);
 assert.equal(activityReturnNoticeHTMLV52({...returned,banquetReturnEventId:'work'},{kind:'daily'}),'');
});

test('the result area itself announces the completed activity and offers a clear return action',()=>{
 const app=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
 const helpers=app.slice(app.indexOf('function activityProgress('),app.indexOf('function mobileWorkbar('));
 const resultArea=app.slice(app.indexOf('<div class="consequence'),app.indexOf('<div class="rage-result-action'));
 assert.ok(resultArea.includes('${activityEndNotice(ev)}'),'the banner is inside the automatically focused result area');
 assert.ok(resultArea.includes('activityNextLabel(ev)'),'the existing continue action names its actual next step');
 for(const id of ACTIVITY_IDS_V44){
  const path=paths.get(id),first=path.stages[0],last=path.stages.at(-1);
  const context=vm.createContext({run:first.run,activityPhaseV52,activityPhaseNoticeHTMLV52,activityReturnNoticeHTMLV52,activityProgressHTMLV44});
  vm.runInContext(helpers,context);
  assert.equal(context.activityEndNotice(first.event),'',id);
  context.run=first.pending;assert.equal(context.activityEndNotice(first.event),'',id);
  assert.equal(context.activityNextLabel(first.event),'繼續活動',id);
  context.run=last.pending;
  assert.match(context.activityEndNotice(last.event),/活動結束/,id);
  assert.equal(context.activityNextLabel(last.event),'回到原本的事',id);
  context.run=path.returned;
  assert.equal(context.activityNextLabel(engine.getEvent(path.returned)),'繼續',id);
 }
});
