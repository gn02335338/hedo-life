import test from 'node:test';
import assert from 'node:assert/strict';
import {ROLES} from '../dist/roles.js';
import {createRandomRecruiterV60} from '../dist/random-recruitment-v60.js';

const ordinary=ROLES.filter(role=>role.id!=='executive').map(role=>role.id);
function random(seed=0x603217){let n=seed>>>0;return()=>{n^=n<<13;n^=n>>>17;n^=n<<5;return(n>>>0)/4294967296;};}
const draws=(count=5000)=>{const recruiter=createRandomRecruiterV60(random());return Array.from({length:count},()=>recruiter.draw());};

test('the shared recruiter covers all ordinary jobs and rare entries without concentrating management appointments',()=>{
 const rows=draws(),counts=Object.fromEntries(['normal','executive','godson','goddaughter'].map(kind=>[kind,rows.filter(row=>row.kind===kind).length]));
 assert.ok(counts.normal>=4300&&counts.normal<=4700,JSON.stringify(counts));
 assert.ok(counts.executive>=130&&counts.executive<=270,JSON.stringify(counts));
 for(const kind of ['godson','goddaughter'])assert.ok(counts[kind]>=90&&counts[kind]<=210,JSON.stringify(counts));
 for(const row of rows){
  assert.deepEqual(Object.keys(row).sort(),['kind','roleId']);
  if(row.kind==='normal')assert.ok(ordinary.includes(row.roleId));
  else if(row.kind==='executive')assert.equal(row.roleId,'executive');
  else assert.equal(row.roleId,null,'direct appointments derive their underlying career from the canonical seed');
 }
 const normalCounts=ordinary.map(roleId=>rows.filter(row=>row.kind==='normal'&&row.roleId===roleId).length);
 assert.ok(Math.max(...normalCounts)-Math.min(...normalCounts)<=1,'a full ordinary bag covers every profession rather than repeatedly favoring a few');
});

test('rerolls continue the same ordinary bag, with no repeated ordinary profession inside a bag or at its boundary',()=>{
 const recruiter=createRandomRecruiterV60(random(0x3e6032)),sessions=Array.from({length:400},()=>Array.from({length:4},()=>recruiter.draw()));
 const normals=sessions.flat().filter(row=>row.kind==='normal');
 for(let start=0;start+ordinary.length<=normals.length;start+=ordinary.length)assert.deepEqual(normals.slice(start,start+ordinary.length).map(row=>row.roleId).sort(),[...ordinary].sort());
 for(let i=1;i<normals.length;i++)assert.notEqual(normals[i].roleId,normals[i-1].roleId,'the first ordinary card of a new bag must differ from the previous last card');
 const all=sessions.flat();for(let i=1;i<all.length;i++)if(all[i].kind!=='normal')assert.notEqual(all[i].kind,all[i-1].kind,'a rare appointment cannot repeat on the immediately following roll');
});

test('even a repeated rare random ticket finishes in bounded work rather than looping on reroll rejection',()=>{
 for(const ticket of [.01,.05,.08]){
  let calls=0;const recruiter=createRandomRecruiterV60(()=>{if(++calls>100)throw Error('unbounded recruitment retry');return ticket;});
  let previous=null;
  for(let i=0;i<30;i++){
   calls=0;const row=recruiter.draw();assert.ok(['normal','executive','godson','goddaughter'].includes(row.kind));
   if(row.kind!=='normal')assert.notEqual(row.kind,previous);previous=row.kind;
  }
 }
});
