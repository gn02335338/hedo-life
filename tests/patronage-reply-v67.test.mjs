import {CAST_IDS_V74} from '../dist/cast-v74.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {PERSONAS} from '../dist/persona.js';
import {patronageReplyOutcomesV43} from '../dist/patronage-reply-v43.js';
import {withPatronageOutcomesV67} from '../dist/patronage-reply-v67.js';

const seed=cohort=>`e39-r${cohort}-n-${'a'.repeat(22)}`;
const fresh=()=>({seed:seed(67),rng:13829,turn:5,stats:{mood:50,energy:40,boss:50,skill:60,slack:50,lick:70,cash:40,trust:50},patronage:{title:'乾兒子',historyIndex:0,fromPay:70,appointedPay:180},history:[],actions:[],flags:{}});
const work={id:'ordinary-work',kind:'daily',speaker:'sonny',title:'工作中的分工',body:'眼前的回覆仍等你自己決定。',choices:[{text:'我先問清楚。'},{text:'我選另一個方向。'}]};
const legacy=(run,target,event=work)=>patronageReplyOutcomesV43({...run,seed:seed(65)},event,target);
const outcomes=(run,target,event=work)=>withPatronageOutcomesV67(run,event,target,legacy(run,target,event));
const expectation=(rows,key)=>rows.reduce((sum,row)=>sum+row.weight*(row.delta[key]||0),0)/rows.reduce((sum,row)=>sum+row.weight,0);
const success=rows=>rows.filter(row=>['obliged','welcomed'].includes(row.reaction)).reduce((sum,row)=>sum+row.weight,0)/rows.reduce((sum,row)=>sum+row.weight,0);
const clone=value=>structuredClone(value);
const historicalTargets=Object.keys(PERSONAS).filter(target=>target!=='alice'&&!CAST_IDS_V74.includes(target));

test('only a strictly versioned new appointment receives benefits; historical and private responses retain object identity',()=>{
 const run=fresh(),old=legacy(run,'sonny'),before=clone(old);
 for(const unappointed of [undefined,null,false,true,[],0])assert.equal(withPatronageOutcomesV67({...run,patronage:unappointed},work,'sonny',old),old);
 for(const value of [seed(65),seed(66),'e39-r67-n-'+'a'.repeat(21),'e39-r67-x-'+'a'.repeat(22),'e39-r67-n-'+'a'.repeat(23),'e39-r67-n-'+'A'.repeat(22),'e39-r67-n-'+'g'.repeat(22),'e39-r67-n-'+ 'a'.repeat(22)+'-extra'])assert.equal(withPatronageOutcomesV67({...run,seed:value},work,'sonny',old),old);
 for(const scene of [{...work,scope:'private'},{...work,privateContext:true},{id:'meal-with-sonny'},{id:'meal-guests-a'},{id:'kind-workday'},{id:'kind-break'},{id:'banquet-afterparty'},{id:'self-care'}])assert.equal(withPatronageOutcomesV67(run,scene,'sonny',old),old);
 for(const target of ['self','__proto__','constructor','toString','hidden-visitor',null,undefined])assert.equal(withPatronageOutcomesV67(run,work,target,old),old);
 assert.equal(withPatronageOutcomesV67(run,work,'sonny',[]).length,0);
 const partial=old.slice(1);assert.equal(withPatronageOutcomesV67(run,work,'sonny',partial),partial);
 assert.deepEqual(old,before);
});

test('ordinary colleagues offer a meaningful effort advantage while most cooperation still costs personal goodwill',()=>{
 const run=fresh(),ordinary=historicalTargets.filter(target=>!['wing','spencer','rick','princess'].includes(target));
 assert.equal(ordinary.length,24);
 for(const target of ordinary){
  const rows=outcomes(run,target),old=legacy(run,target);
  assert.equal(rows.length,4,target);assert.equal(success(rows),.78,target);
  assert.ok(expectation(rows,'mood')>7,target);assert.ok(expectation(rows,'energy')>5,target);
  assert.ok(expectation(rows,'mood')>expectation(old,'mood'),target);assert.ok(expectation(rows,'energy')>expectation(old,'energy'),target);
  assert.ok(rows.reduce((sum,row)=>sum+row.weight*row.affinityDelta,0)<0,target);
  const complied=rows[0],cooperated=rows[3];
  assert.equal(complied.delta.mood,12);assert.equal(complied.delta.energy,8);assert.equal(complied.affinityDelta,-6);assert.ok(complied.delta.trust<0);
  assert.equal(cooperated.delta.mood,16);assert.equal(cooperated.delta.energy,10);assert.ok(cooperated.affinityDelta>0);
  assert.notEqual(complied.result,cooperated.result);assert.ok(complied.result.length>60);assert.ok(cooperated.result.length>60);
  for(const row of rows){assert.equal(row.delta.cash,undefined);assert.equal(row.pay,undefined);assert.equal(row.effect,undefined);assert.ok(row.weight>=2);assert.ok(row.affinityDelta>=-24&&row.affinityDelta<=12);assert.ok(row.result.length<300);}
 }
});

test('Rick and the princess compete for the family seat rather than automatically obeying another appointee',()=>{
 const run=fresh();
 for(const target of ['rick','princess']){
  const rows=outcomes(run,target);
  assert.equal(success(rows),.5);assert.ok(success(rows)<success(outcomes(run,'sonny')));
  assert.ok(rows.every(row=>row.affinityDelta<0),'even reluctant cooperation can deepen rivalry');
  assert.ok(rows[1].affinityDelta<=-18);assert.ok(rows[2].affinityDelta<=-18);assert.equal(rows[2].delta.boss,-4);
 }
 for(const row of outcomes(run,'princess')){
  const lines=[...row.result.matchAll(/「([^」]+)」/g)].map(match=>match[1]);
  assert.ok(lines.length>0);assert.ok(lines.every(line=>/[A-Za-z]/.test(line)&&!/[\u3400-\u9fff]/.test(line)),row.result);
 }
});

test('upward flattery can secure genuine care and saved effort, and the chairman never controls Wing mood',()=>{
 const run=fresh();
 for(const target of ['wing','spencer']){
  const rows=outcomes(run,target);
  assert.equal(success(rows),.72);assert.ok(expectation(rows,'mood')>7);assert.ok(expectation(rows,'energy')>4);
  for(const index of [0,2,3]){assert.ok(rows[index].delta.energy>0);assert.ok(rows[index].affinityDelta>0);assert.match(rows[index].result,/資料|聯絡/);}
  assert.ok(rows.every(row=>row.delta.cash===undefined));
 }
 assert.ok(outcomes(run,'spencer').every(row=>row.delta.boss===undefined));
 const angry={...run,stats:{...run.stats,boss:10}},happy={...run,stats:{...run.stats,boss:90}};
 assert.deepEqual(outcomes(angry,'spencer'),outcomes(happy,'spencer'));
 assert.ok(success(outcomes(happy,'wing'))>success(outcomes(angry,'wing')));
});

test('committed relationship history and current mood influence the odds without consuming RNG or adding transient state',()=>{
 const run=fresh(),row=trust=>({eventId:'work-agreement',kind:'daily',speaker:'sonny',choiceIndex:0,breakdown:[{source:'choice',delta:{trust}}]});
 const friendly={...run,history:[row(12),row(12)]},distant={...run,history:[row(-12),row(-12)]};
 assert.ok(success(outcomes(friendly,'sonny'))>success(outcomes(distant,'sonny')));
 assert.ok(success(outcomes(run,'sonny'))>success(outcomes({...run,stats:{...run.stats,mood:10}},'sonny')));
 const snapshot=clone(run),event=clone(work),original=legacy(run,'sonny'),originalSnapshot=clone(original);
 for(let i=0;i<8;i++){
  assert.deepEqual(withPatronageOutcomesV67(run,work,'sonny',original),outcomes(run,'sonny'));
  assert.deepEqual(run,snapshot);assert.deepEqual(work,event);assert.deepEqual(original,originalSnapshot);
 }
});

test('a formal personnel conversation offers only help finding paperwork, never a resolved PIP or preselected response',()=>{
 for(const eventId of ['pip-review','pip-passed','salary-cut','salary-final','dismissal-final','crisis-boss','paperwork','floor-notice','watch-review','labor-mediation']){
  const run={...fresh(),pip:{active:true,progress:1,round:1},pipCount:1,personnelPending:{decision:'pip'},resumeEventId:'ordinary-work'},event={...work,id:eventId,kind:'crisis'},snapshot=clone(run);
  for(const target of ['hope','erich','sonny','jenjen','wing','spencer','rick','princess']){
   const rows=outcomes(run,target,event);
   for(const index of [0,3]){
    assert.match(rows[index].result,/眼前的考核、條件與文件仍要逐項回應/);
    assert.match(rows[index].result,/沒有撤掉程序/);
    assert.equal(rows[index].effect,undefined);assert.equal(rows[index].delta.cash,undefined);
   }
  }
  assert.deepEqual(run,snapshot);assert.deepEqual(event.choices,work.choices);
 }
});
