import test from 'node:test';
import assert from 'node:assert/strict';
import {ACTIVITY_WINDOWS_V46 as CURRENT_ACTIVITY_WINDOWS_V46,scheduledActivityV46,getActivityInvitationEventV46,invitationResultV46,calendarDailyAllowedV46} from '../dist/activity-schedule-v46.js';
const ACTIVITY_WINDOWS_V46=Object.fromEntries(Object.entries(CURRENT_ACTIVITY_WINDOWS_V46).filter(([id])=>id!=='camel')); // Frozen seven-activity calendar.
import {PERSONAS} from '../dist/persona.js';
import {EVENTS} from '../dist/events.js';

const source=(seed='e39-calendar-1',turn=8,flags={})=>({seed,turn,roleId:'system',actualRoleId:'system',rng:123,flags:{activity46_enabled:1,...flags}});
const find=(id,turn,flags={})=>{
 for(let index=0;index<5000;index++){
  const run=source(`e39-calendar-${index}`,turn,flags);
  if(scheduledActivityV46(run)===id)return run;
 }
 throw new Error(`No schedule for ${id} at ${turn}`);
};

test('the schedule uses only deterministic game progress and never mutates or consumes RNG',()=>{
 for(let seed=0;seed<50;seed++)for(let turn=0;turn<24;turn++){
  const run=source(`e39-calendar-${seed}`,turn),before=structuredClone(run),id=scheduledActivityV46(run);
  assert.equal(scheduledActivityV46(run),id);assert.deepEqual(run,before);
  if(id){const [first,last]=ACTIVITY_WINDOWS_V46[id];assert.ok(turn>=first&&turn<=last,`${id}/${turn}`);}
 }
 for(const run of [null,{},source('e39-no-calendar',8,{activity46_enabled:0}),{...source(),turn:NaN},{...source(),turn:3.5}])assert.equal(scheduledActivityV46(run),null);
});

test('each activity has a reachable seeded invitation at both ends of its window',()=>{
 for(const [id,[first,last]]of Object.entries(ACTIVITY_WINDOWS_V46)){
  assert.equal(scheduledActivityV46(find(id,last,id==='banquet'?{}:{banquet_seen:1})),id);
  // Banquet has its own seed-selected due turn, including seeds due at 16.
  assert.equal(scheduledActivityV46(find(id,first)),id);
 }
});

test('declined or completed activities cannot repeat and three common invitations still allow year-end',()=>{
 for(const [id,[first]]of Object.entries(ACTIVITY_WINDOWS_V46)){
  const run=find(id,first);
  assert.notEqual(scheduledActivityV46({...run,flags:{...run.flags,[`activity46_seen_${id}`]:1}}),id);
  assert.notEqual(scheduledActivityV46({...run,flags:{...run.flags,[`activity44_${id}`]:1}}),id);
 }
 for(let turn=2;turn<16;turn++)for(let seed=0;seed<20;seed++)assert.equal(scheduledActivityV46(source(`e39-cap-${seed}`,turn,{activity46_count:3})),null);
 assert.equal(scheduledActivityV46(source('e39-year-end',19,{activity46_count:3})),'banquet');
 for(const flag of ['banquet_seen','banquet_attended'])assert.notEqual(scheduledActivityV46(source('e39-year-end',19,{[flag]:1})),'banquet');
});

test('cooldowns require two actual work turns; only last-chance banquet overrides them',()=>{
 const run=find('basketball',5);
 for(const key of ['activity46_last_turn','activity44_last_turn']){
  assert.equal(scheduledActivityV46({...run,flags:{...run.flags,[key]:6}}),null);
  assert.equal(scheduledActivityV46({...run,flags:{...run.flags,[key]:5}}),null);
  assert.equal(scheduledActivityV46({...run,flags:{...run.flags,[key]:4}}),'basketball');
 }
 const banquet=find('banquet',16);
 assert.equal(scheduledActivityV46({...banquet,flags:{...banquet.flags,activity46_last_turn:16}}),null);
 assert.equal(scheduledActivityV46(source('e39-year-end',19,{activity46_last_turn:20,activity44_last_turn:19,activity46_count:3})),'banquet');
});

test('job weighting preserves variety and makes relevant public-facing and review work more frequent',()=>{
 const counts=role=>{
  const value={};for(let seed=0;seed<3000;seed++){
   const id=scheduledActivityV46({...source(`e39-role-${seed}`,9),actualRoleId:role});if(id)value[id]=(value[id]||0)+1;
  }return value;
 };
 const sales=counts('sales'),engineer=counts('system'),design=counts('design');
 assert.ok(sales.roadshow>engineer.roadshow*1.6);
 assert.ok(design.roadshow>engineer.roadshow*1.6);
 assert.ok(engineer.review>sales.review*1.6);
 for(const countsForRole of [sales,engineer,design])for(const id of ['arm','diet','roadshow','dinner','basketball','review'])assert.ok(countsForRole[id]>0);
});

test('all seven invitations precede acceptance, expose three responses and keep outcomes separate',()=>{
 for(const id of Object.keys(ACTIVITY_WINDOWS_V46)){
  const run={...source(),activityInvitationContext:{version:1,id,returnEventId:'job-system-printer'}},before=structuredClone(run);
  const event=getActivityInvitationEventV46(run);
  assert.equal(event.id,`activity46-invite-${id}`);assert.equal(event.kind,'activity-invitation');assert.ok(PERSONAS[event.speaker]);assert.equal(event.scene,'office_day');assert.equal(event.scope,'work');
  assert.equal(event.choices.length,3);assert.equal(event.choices[2].wild,true);
  assert.doesNotMatch(event.choices.map(choice=>choice.text).join(' '),/\d+%|成功率|心情[+−-]|體力[+−-]/);
  for(let index=0;index<3;index++){
   assert.deepEqual(event.choices[index].delta,{});assert.equal(event.choices[index].result,invitationResultV46(run,index));
   assert.ok(!event.body.includes(event.choices[index].result));
  }
  assert.deepEqual(run,before);
 }
 for(const context of [undefined,{version:2,id:'arm',returnEventId:'work'},{version:1,id:'__proto__',returnEventId:'work'},{version:1,id:'arm',returnEventId:3}])assert.throws(()=>getActivityInvitationEventV46({...source(),activityInvitationContext:context}));
 const run={...source(),activityInvitationContext:{version:1,id:'arm',returnEventId:'work'}};
 for(const index of [-1,3,1.5,'0',null])assert.throws(()=>invitationResultV46(run,index));
});

test('calendar lives reserve current tailya scenes for the full scheduled party while old lives retain their deck',()=>{
 const live=['quiz26-banquet-cup','quiz26-toast-rule','cast35-meimei-first-love-enlist','cast35-meimei-sober-label'];
 for(const id of live){
  const event=EVENTS.find(item=>item.id===id);assert.ok(event,id);
  for(const turn of [0,8,16,19,23]){
   assert.equal(calendarDailyAllowedV46(source('e39-cal46-test',turn),event),false);
   assert.equal(calendarDailyAllowedV46(source('e39-legacy',turn,{activity46_enabled:0}),event),true);
  }
 }
 const special=new Set([...live,'cast35-kind-reservation-ghost','dp-prize-last-day']);
 for(const event of EVENTS)if(!special.has(event.id))assert.equal(calendarDailyAllowedV46(source(),event),true,event.id);
 for(const id of ['q26-spring-dinner-seats','cast35-sophie-spring-badge','cast35-helen-banquet-absence'])assert.ok(EVENTS.some(event=>event.id===id),id);
});

test('next-day party recollections require a completed attended banquet in the year-end window',()=>{
 for(const id of ['cast35-kind-reservation-ghost','dp-prize-last-day']){
  const event=EVENTS.find(item=>item.id===id);assert.ok(event,id);
  for(const turn of [0,8,15,16,19])for(const attended of [0,1]){
   assert.equal(calendarDailyAllowedV46(source('e39-cal46-test',turn,{activity44_banquet:attended}),event),turn>=16&&attended===1,`${id}/${turn}/${attended}`);
   assert.equal(calendarDailyAllowedV46(source('e39-legacy',turn,{activity46_enabled:0}),event),true);
  }
  for(const flags of [{activity46_seen_banquet:1},{banquet_seen:1},{banquet_attended:1}])assert.equal(calendarDailyAllowedV46(source('e39-cal46-declined',18,flags),event),false,'offer or partial participation is not completed attendance');
 }
});
