import test from 'node:test';
import assert from 'node:assert/strict';
import {VIDEO_EVENTS} from '../dist/events-video.js';
import {armSceneContextHTMLV51,displayArmSceneEventV51,displayArmSceneHistoryV51} from '../dist/arm-scene-ui-v51.js';
import {activityProgressHTMLV44} from '../dist/activity-ui-v44.js';
import {getActivityEventV44} from '../dist/activities-v44.js';

const referee=()=>({...VIDEO_EVENTS.find(event=>event.id==='video-referee-committee'),kind:'daily'});
const activityRun=(stage=0,pending=false)=>({activityContext:{version:1,id:'arm',stage,score:0,pressure:0},pending,history:[],stats:{cash:50}});

test('the referee scene explains arriving at the table without claiming the full activity started',()=>{
 const event=referee(),run={flags:{},pending:false},before=JSON.stringify({event,run});
 const html=armSceneContextHTMLV51(run,event),shown=displayArmSceneEventV51(event);
 assert.match(html,/腕力賽場邊插曲/);
 assert.match(html,/路過休息區/);
 assert.match(html,/回應後再回去工作/);
 assert.doesNotMatch(html,/腕力大賽開始|第 1 \/ 3 幕|機率|三幕|尚未出賽世界冠軍/);
 assert.match(shown.body,/你路過休息區/);
 assert.doesNotMatch(shown.body,/早上|會議/);
 assert.equal(shown.id,event.id);
 assert.equal(shown.title,event.title);
 assert.equal(shown.kind,event.kind);
 assert.equal(shown.speaker,event.speaker);
 assert.equal(shown.choices,event.choices);
 assert.equal(shown.sourceIds,event.sourceIds);
 assert.equal(JSON.stringify({event,run}),before);
});

test('live arm scenes, the delayed schedule and video replay have distinct framing',()=>{
 const ids=['video-last-handshake','video-seven-clock','video-pizza-overtime','video-no-strength','video-referee-committee','video-designer-benchmark','video-rick-commentary','video-message-workout','video-wing-replay'];
 for(const id of ids){
  const event={id,kind:'daily'};
  for(const field of ['choices','draw','outcomes','result','futureEnding'])Object.defineProperty(event,field,{get(){throw new Error(`Read hidden ${field}`);}});
  const html=armSceneContextHTMLV51({},event);
  assert.match(html,/aria-label="腕力賽情境"/,id);
  assert.doesNotMatch(html,/腕力大賽開始/,id);
 }
 assert.match(armSceneContextHTMLV51({},{id:'video-seven-clock',kind:'daily'}),/還沒有開賽/);
 assert.match(armSceneContextHTMLV51({},{id:'video-wing-replay',kind:'daily'}),/比賽已經結束.*影片/);
 for(const id of ['video-toast-performance','unknown','onboarding'])assert.equal(armSceneContextHTMLV51({},{id,kind:'daily'}),'');
});

test('the scene banner stays out of invitations, activities and interrupted conversations',()=>{
 const event=referee();
 for(const kind of ['activity','activity-invitation','verbal','rage','rage-world','work-gap'])assert.equal(armSceneContextHTMLV51({},{...event,kind}),'');
 for(const key of ['verbalContext','rageContext','activityContext','activityInvitationContext','patronageReplyContext','hiddenEncounterContext'])assert.equal(armSceneContextHTMLV51({[key]:{}},event),'',key);
 assert.equal(armSceneContextHTMLV51({},null),'');
});

test('pending referee narration stays consistent without replacing committed choices or verbal evidence',()=>{
 const event=referee(),row={eventId:event.id,kind:'daily',title:event.title,body:event.body,choiceText:'原本選擇',result:'原本結果',choiceIndex:0,delta:{mood:5}};
 const before=JSON.stringify(row),shown=displayArmSceneHistoryV51(row);
 assert.equal(shown.body,displayArmSceneEventV51(event).body);
 assert.equal(shown.choiceText,row.choiceText);
 assert.equal(shown.result,row.result);
 assert.equal(shown.delta,row.delta);
 assert.equal(JSON.stringify(row),before);
 const verbalEvent={...event,title:'你把這句話說出口，事情接著往下走。',body:'真的說出口的話'};
 assert.equal(displayArmSceneEventV51(verbalEvent),verbalEvent);
 const verbalRow={...row,verbalOutcome:{version:2,kind:'ignored'},body:'已發生的口舌結果'};
 assert.equal(displayArmSceneHistoryV51(verbalRow),verbalRow);
 assert.equal(displayArmSceneEventV51(null),null);
 assert.equal(displayArmSceneHistoryV51(null),null);
});

test('only the first unanswered activity stage announces the wrist-wrestling activity start',()=>{
 for(const stage of [0,1,2]){
  const run=activityRun(stage),before=JSON.stringify(run),event=getActivityEventV44(run);
  const html=activityProgressHTMLV44(run,event);
  assert.match(html,new RegExp(`第 ${stage+1} / 3 幕`));
  assert.match(html,stage===0?/腕力大賽開始/:/腕力大賽進行中/);
  if(stage>0)assert.doesNotMatch(html,/腕力大賽開始/);
  assert.equal(JSON.stringify(run),before);
  const pending={...run,pending:true,history:[{activityOutcome:{score:3,pressure:2}}]};
  const result=activityProgressHTMLV44(pending,event);
  assert.match(result,/腕力大賽・本幕結果/);
  assert.doesNotMatch(result,/腕力大賽開始|腕力大賽進行中/);
  assert.match(result,/這些是剛才已發生的變化/);
 }
 assert.equal(activityProgressHTMLV44({},referee()),'');
});
