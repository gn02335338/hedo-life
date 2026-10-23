import test from 'node:test';
import assert from 'node:assert/strict';
import {isPatronageBenefitsV67,appointmentPayV67,PATRONAGE_APPOINTMENT_CASH_V67,PATRONAGE_ALLOWANCE_CASH_V67,patronageAllowanceDueV67,PATRONAGE_EXCLUDED_DAILY_IDS_V67,patronageDailyAllowedV67} from '../dist/patronage-benefits-v67.js';
import {PATRONAGE_EVENTS_V67,getPatronageEventV67} from '../dist/patronage-events-v67.js';
import {EVENTS,FANTASY_EVENTS} from '../dist/events.js';
import {SOURCES} from '../dist/public-sources.js';

const seed=`e39-r67-s-${'a'.repeat(22)}`;
const appointment={eventId:'onboarding',kind:'onboarding',turn:0,choiceIndex:0,jobTitle:'乾兒子',pay:180};
const work=(turn,id=`work-${turn}`,extra={})=>({eventId:id,kind:'daily',turn,choiceIndex:0,...extra});
const run=(history=[appointment],extra={})=>({seed,history,patronage:{title:'乾兒子',historyIndex:0,fromPay:52,appointedPay:180},education:{school:'逢甲大學',department:'企業管理',degree:'學士'},pay:180,...extra});

test('v67 benefits use only the exact fresh seed grammar',()=>{
 for(const marker of ['n','s','d']){
  const profile=`e39-r67-${marker}-${'0'.repeat(22)}`;
  assert.equal(isPatronageBenefitsV67(profile),true);assert.equal(isPatronageBenefitsV67({seed:profile}),true);
 }
 for(const bad of [null,undefined,'',seed.replace('r67','r66'),seed+'a',seed.slice(0,-1),seed.replace('-s-','-x-'),seed.replace('aaa','AAA'),`e39-r67-s-${'a'.repeat(21)}g`])assert.equal(isPatronageBenefitsV67(bad),false);
});

test('appointment pay becomes substantial without changing any historical salary formula',()=>{
 const examples=[[27,180],[52,180],[85,187],[150,330],[220,484],[250,500],[500,500]];
 for(const [previous,expected]of examples){
  assert.equal(appointmentPayV67(run(),previous),expected);
  assert.equal(appointmentPayV67({seed:seed.replace('r67','r66')},previous),Math.min(500,Math.max(previous+8,Math.round(previous*1.15))));
 }
 for(const bad of [0,-1,501,Infinity,NaN,1.5,'52',null])assert.throws(()=>appointmentPayV67(run(),bad),/Invalid appointment salary/);
 assert.equal(PATRONAGE_APPOINTMENT_CASH_V67,24);assert.equal(PATRONAGE_ALLOWANCE_CASH_V67,6);
});

test('allowances start after appointment and pay once per two distinct delivered work scenes',()=>{
 let state=run();
 for(let turn=1;turn<=10;turn++){
  const row=work(turn),snapshot=structuredClone(state);
  assert.equal(patronageAllowanceDueV67(state,row),turn%2===0?6:0);
  assert.deepEqual(state,snapshot,'a benefits preview must not modify savings, history or RNG');
  state={...state,history:[...state.history,row]};
  assert.equal(patronageAllowanceDueV67(state,row),0,'the same committed row cannot be paid again');
 }
 assert.equal(patronageAllowanceDueV67(run([work(1),work(2),appointment],{patronage:{...run().patronage,historyIndex:2}}),work(3)),0,'pre-appointment service is not back pay');
 assert.equal(patronageAllowanceDueV67(run([appointment,work(1),work(1)]),work(2)),6,'a duplicated old row does not move the pay period');
 assert.equal(patronageAllowanceDueV67(run([appointment,work(1,'same'),work(2,'same')]),work(3,'different')),0,'a later genuine workday may reuse an event ID');
 assert.equal(patronageAllowanceDueV67(run([appointment,work(1)]),work(1,'different')),6,'separate delivered scenes retain their turn:event identity');
 assert.equal(patronageAllowanceDueV67(run([appointment,work(1)]),work(20,'road',{kind:'fantasy'})),6,'final work scenes still count');
});

test('absence, navigation, speech, rest, mini-games and appointment paperwork never generate an allowance',()=>{
 const state=run([appointment,work(1)]);
 for(const kind of ['onboarding','career','crisis','patronage','verbal','event-departure','self-care','activity','office-treat','recruitment','shareholder','hidden','activity-invitation'])assert.equal(patronageAllowanceDueV67(state,work(2,'not-work',{kind})),0,kind);
 for(const extra of [{choiceIndex:-1},{choiceIndex:undefined},{choiceIndex:0.5},{turn:0},{turn:24},{turn:NaN},{eventId:''},{completed:false},{departureOutcome:{completed:false}},{verbalOutcome:{kind:'ignored'}}])assert.equal(patronageAllowanceDueV67(state,work(2,'work',extra)),0,JSON.stringify(extra));
 assert.equal(patronageAllowanceDueV67({...state,patronage:null},work(2)),0);
 assert.equal(patronageAllowanceDueV67({...state,seed:seed.replace('r67','r66')},work(2)),0);
 for(const index of [-1,1.5,99,undefined])assert.equal(patronageAllowanceDueV67({...state,patronage:{...state.patronage,historyIndex:index}},work(2)),0);
 const withNoise=run([appointment,...['career','self-care','activity','patronage','event-departure'].map((kind,index)=>work(index+1,kind,{kind})),work(6),work(7,'spoken',{verbalOutcome:{kind:'retort'}})]);
 assert.equal(patronageAllowanceDueV67(withNoise,work(8)),6);
});

test('company plan navigation and its historical fantasy rows neither pay nor advance the allowance period',()=>{
 const finale=FANTASY_EVENTS[3];assert.equal(finale.id,'finale');
 const state=run([appointment,work(22)]),snapshot=structuredClone(state);
 for(const index of [0,1,2,3]){
  const navigation=work(23,finale.id,{kind:'fantasy',choiceIndex:index});
  assert.equal(Object.hasOwn(navigation,'effect'),false,'committed history does not preserve navigation effects');
  assert.equal(patronageAllowanceDueV67(state,navigation),0,'picking or reopening a company plan is not work');
  const withNavigation={...state,history:[...state.history,navigation]};
  assert.equal(patronageAllowanceDueV67(withNavigation,work(23,'actual-work')),6,'an old finale row does not change which workday earns the next allowance');
 }
 const onlyMenus=run([appointment,...[0,1,2,3].map(index=>work(23,finale.id,{kind:'fantasy',choiceIndex:index}))]);
 assert.equal(patronageAllowanceDueV67(onlyMenus,work(23,'first-real-work')),0,'repeated plan visits do not become pre-existing service');
 assert.deepEqual(state,snapshot);
});

test('the targeted daily filter preserves other people’s school stories and all published lives',()=>{
 assert.ok(PATRONAGE_EXCLUDED_DAILY_IDS_V67.length>=3);
 for(const id of PATRONAGE_EXCLUDED_DAILY_IDS_V67){
  const event=EVENTS.find(row=>row.id===id);assert.ok(event,`${id} is a real authored scene`);
  assert.equal(patronageDailyAllowedV67(run(),event),false);
  assert.equal(patronageDailyAllowedV67(run(undefined,{patronage:null}),event),true);
  assert.equal(patronageDailyAllowedV67(run(undefined,{seed:seed.replace('r67','r66')}),event),true);
 }
 for(const id of ['degree-ntu-footnote','q26-diploma-undergraduate','q26-degree-double-standard','sam-pureblood-degree','jonathan-assistant-shield','cast39-princess-diploma-test'])assert.equal(patronageDailyAllowedV67(run(),EVENTS.find(row=>row.id===id)),true,id);
});

test('the three protected-appointment scenes keep outcomes hidden and return without another payout',()=>{
 assert.equal(PATRONAGE_EVENTS_V67.length,3);
 for(const title of ['乾兒子','乾女兒'])for(const id of PATRONAGE_EVENTS_V67){
  const state=run(undefined,{patronage:{...run().patronage,title}}),snapshot=structuredClone(state),event=getPatronageEventV67(state,id);
  assert.equal(event.id,id);assert.equal(event.kind,'career');assert.equal(event.scope,'work');assert.equal(event.speaker,'wing');
  assert.equal(event.choices.length,3);assert.ok(event.body.includes(title));assert.ok(event.choices.some(choice=>choice.wild));
  assert.ok(event.sourceIds.length&&event.sourceIds.every(source=>SOURCES[source]));
  for(const choice of event.choices){
   assert.equal(choice.detail,'');assert.equal(choice.effect,'patronage67Return');
   assert.equal(choice.delta.cash,undefined);assert.ok(choice.result.length>40);
   assert.doesNotMatch(choice.text,/成功率|機率|[%％]|[+-]\d+/);
   assert.ok(Object.values(choice.delta).every(Number.isInteger));
   assert.ok(choice.flags.every(flag=>typeof flag==='string'));
  }
  assert.deepEqual(state,snapshot);assert.deepEqual(getPatronageEventV67(state,id),event);
 }
 for(const id of PATRONAGE_EVENTS_V67){
  assert.throws(()=>getPatronageEventV67(run(undefined,{patronage:null}),id),/Invalid patronage benefits event/);
  assert.throws(()=>getPatronageEventV67(run(undefined,{seed:seed.replace('r67','r66')}),id),/Invalid patronage benefits event/);
 }
 assert.throws(()=>getPatronageEventV67(run(),'salary-cut'),/Invalid patronage benefits event/);
});
