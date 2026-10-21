import test from 'node:test';
import assert from 'node:assert/strict';
import {selectWorkEventV35} from '../dist/work-events-v35.js';

const scene=(id,speaker,roles,weight=1)=>({id,speaker,roles,weight});
const row=(event,turn)=>({eventId:event.id,kind:'daily',choiceIndex:0,turn});
const select=(run,pool,draws,all=pool)=>selectWorkEventV35(run,pool,()=>draws.shift()??.5,all);

test('e35 draws people before scenes so one hundred Wing scenes cannot drown out another eligible character',()=>{
 const wing=Array.from({length:100},(_,i)=>scene(`wing-${i}`,'wing'));
 const others=[scene('owen','owen'),scene('cindy','cindy'),scene('helen','helen')];
 const anchor=scene('anchor','jack',['sales']),run={actualRoleId:'sales',history:[row(anchor,0)]};
 const pool=[...wing,...others],all=[anchor,...pool];
 const counts={};
 for(let i=0;i<400;i++){
  const chosen=select(run,pool,[.9,(i+.5)/400,.3],all),id=chosen.startsWith('wing-')?'wing':chosen;
  counts[id]=(counts[id]||0)+1;
 }
 assert.deepEqual(counts,{wing:100,owen:100,cindy:100,helen:100});
});

test('the actual profession still opens every life and keeps the exclusive/related/shared work proportions',()=>{
 const exclusive=scene('sales','meimei',['sales']),related=scene('bd','owen',['sales','bd']),shared=scene('tea','sophie');
 const pool=[exclusive,related,shared],run={actualRoleId:'sales',roleId:'design',history:[]};
 assert.equal(select(run,pool,[.99,.99]),'sales');
 const anchor=scene('earlier','rick',['sales']);run.history=[row(anchor,0)];
 for(const [draw,id]of [[.1,'sales'],[.499,'sales'],[.5,'bd'],[.699,'bd'],[.7,'tea'],[.999,'tea']]){
  assert.equal(select(run,pool,[draw,.5,.5],[anchor,...pool]),id);
 }
});

test('new characters and recent speaker cooldowns prevent a large eligible archive repeating the same face',()=>{
 const a=scene('rick','rick'),b=scene('jack','jack'),c=scene('sonny','sonny');
 const run={actualRoleId:'sales',history:[row(a,0),row(b,1)]};
 assert.equal(select(run,[a,b,c],[.9,.01,.01]),'sonny');
 const old=scene('old','sonny',['sales']);
 assert.equal(select({actualRoleId:'sales',history:[row(old,0),row(a,1)]},[a,b,c],[.9,.01,.01],[old,a,b,c]),'jack');
});

test('a new-person safeguard can change the bucket after a drought while preserving the two-shared work safeguard',()=>{
 const old=scene('old','wing',['sales']),repeat=scene('repeat','rick',['sales']),fresh=scene('fresh','helen');
 const run={actualRoleId:'sales',history:[row(old,0),row(repeat,1),row(old,2),row(repeat,3)]};
 assert.equal(select(run,[old,repeat,fresh],[.01,.99,.99]),'fresh');
 const a=scene('shared-a','owen'),b=scene('shared-b','cindy');
 assert.equal(select({actualRoleId:'sales',history:[row(a,0),row(b,1)]},[old,fresh],[.99,.99],[a,b,old,fresh]),'old');
});

test('scene weights still matter within the selected character, and rare or exhausted pools remain playable',()=>{
 const a=scene('a','hope',['hr'],1),b=scene('b','hope',['hr'],3);
 for(const [ticket,id]of [[.1,'a'],[.5,'b'],[.99,'b']])assert.equal(select({actualRoleId:'hr',history:[]},[a,b],[.5,ticket]),id);
 const only=scene('only','kind');assert.equal(select({actualRoleId:'hr',history:[]},[only],[.01,.99,.99]),'only');
 assert.throws(()=>select({actualRoleId:'sales',history:[]},[],[]),/No eligible/);
});

test('only committed daily scenes count, duplicate rows and notifications cannot manipulate novelty or mutate inputs',()=>{
 const a=scene('a','wing',['sales']),b=scene('b','rick',['sales']),c=scene('c','helen');
 const base={actualRoleId:'sales',history:[row(a,0)]};
 const noisy={actualRoleId:'sales',history:[row(a,0),row(a,0),{...row(b,1),kind:'self-care'},{...row(c,2),choiceIndex:-1}]};
 const before=structuredClone(noisy),pool=[a,b,c],beforePool=structuredClone(pool);
 assert.equal(select(base,pool,[.9,.3,.2]),select(noisy,pool,[.9,.3,.2]));
 assert.deepEqual(noisy,before);assert.deepEqual(pool,beforePool);
});
