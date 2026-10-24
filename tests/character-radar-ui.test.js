import test from 'node:test';
import assert from 'node:assert/strict';
import {characterBookHTML,createCharacterBook} from '../dist/character-book.js';
import {CHARACTER_IDS,CHARACTER_METRICS,deriveCharacterStats} from '../dist/character-stats.js';
import {createRun} from '../dist/engine.js';

const zeroRow=id=>({id,...Object.fromEntries(CHARACTER_METRICS.map(key=>[key,0]))});
const rows=(overrides={})=>CHARACTER_IDS.map(id=>({...zeroRow(id),...overrides[id]}));
const totals=characters=>({version:1,characters});
const attr=(tag,name)=>tag.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`))?.[1];
const selectedMetric=html=>{
  const select=html.match(/<select\b[^>]*\bid="character-metric"[^>]*>([\s\S]*?)<\/select>/)?.[1];
  assert.ok(select,'the ranking remains an accessible select');
  const options=[...select.matchAll(/<option\b([^>]*)>([^<]*)<\/option>/g)];
  return {value:attr(options.find(([,attributes])=>/\bselected\b/.test(attributes))?.[1]||'','value'),options:options.map(([,attributes,text])=>({value:attr(attributes,'value'),text}))};
};
const rankRows=html=>[...html.matchAll(/<li><button\b[^>]*data-character-focus="([^"]+)"[\s\S]*?<b>([\s\S]*?)<\/b><\/li>/g)].map(([,id,value])=>({id,value:value.replace(/<small>[\s\S]*?<\/small>/g,'').replace(/<[^>]*>/g,'')}));
const svgFor=(html,id)=>[...html.matchAll(/<svg\b([^>]*)>([\s\S]*?)<\/svg>/g)].find(([,attributes])=>attr(attributes,'data-radar-character')===id);
const seriesFor=(html,id,scope)=>{
  const svg=svgFor(html,id);assert.ok(svg,`radar for ${id}`);
  const polygon=[...svg[2].matchAll(/<polygon\b([^>]*)\/?\s*>/g)].find(([,attributes])=>attr(attributes,'data-radar-series')===scope);
  if(!polygon)return null;
  return {
    values:attr(polygon[1],'data-radar-values').split(',').map(Number),
    rates:attr(polygon[1],'data-radar-rates').split(',').map(Number),
    scores:attr(polygon[1],'data-radar-scores').split(',').map(Number),
    points:attr(polygon[1],'points').trim().split(/\s+/).map(pair=>pair.split(',').map(Number)),
  };
};
const distance=(point,center)=>Math.hypot(point[0]-center[0],point[1]-center[1]);

function bookHarness(personal,global){
  const handlers=new Map();let html='';
  const dialog={open:false,scrollTop:0,querySelector(selector){
    if(selector==='[data-character-book]')return html.includes('data-character-book')?{}:null;
    return {focus(){},scrollIntoView(){}};
  },addEventListener(type,callback){handlers.set(type,callback);}};
  const cloud={state:{status:'online',characters:personal,pending:0},init:async()=>({characters:personal}),characters:async()=>global};
  const book=createCharacterBook({dialog,cloud,getRun:()=>null,storage:{getItem:()=>null,setItem(){}},openDialog(value){html=value;dialog.open=true;}});
  return {book,get html(){return html;},change(value){handlers.get('change')({target:{id:'character-metric',value}});}};
}

test('combined hits is the first and default ranking while each original metric remains selectable',async()=>{
  const global=totals(rows({wing:{encounters:80,imaginedHits:8},meimei:{encounters:3,realHits:3}}));
  for(const metric of [undefined,'not-a-metric','__proto__']){
    const html=characterBookHTML({global,...(metric===undefined?{}:{metric})});
    const selected=selectedMetric(html);
    assert.equal(selected.value,'combinedHits');
    assert.equal(selected.options[0].value,'combinedHits');
    assert.equal(selected.options[0].text,'幻想扁人＋真的被扁');
    assert.deepEqual(selected.options.slice(1).map(option=>option.value),CHARACTER_METRICS);
    assert.deepEqual(rankRows(html).slice(0,2),[{id:'wing',value:'8'},{id:'meimei',value:'3'}]);
  }
  const app=bookHarness(rows(),global);await app.book.open();
  assert.equal(selectedMetric(app.html).value,'combinedHits');
  for(const metric of CHARACTER_METRICS){
    app.change(metric);assert.equal(selectedMetric(app.html).value,metric);
    if(metric==='realHits')assert.equal(rankRows(app.html)[0].id,'meimei');
  }
  app.change('combinedHits');assert.equal(rankRows(app.html)[0].id,'wing');
  app.change('invalid');assert.equal(selectedMetric(app.html).value,'combinedHits');
});

test('combined counts and sorting stay exact above Number.MAX_SAFE_INTEGER and stable on ties',()=>{
  const max=Number.MAX_SAFE_INTEGER;
  const global=totals(rows({wing:{encounters:max,imaginedHits:max,realHits:max-1},spencer:{encounters:max,imaginedHits:max,realHits:max},erich:{encounters:10,imaginedHits:2,realHits:5},sonny:{encounters:10,imaginedHits:4,realHits:3}}));
  const html=characterBookHTML({global});
  const actual=rankRows(html);
  assert.deepEqual(actual.slice(0,4),[
    {id:'spencer',value:(2n*BigInt(max)).toLocaleString('zh-TW')},
    {id:'wing',value:(2n*BigInt(max)-1n).toLocaleString('zh-TW')},
    {id:'erich',value:'7'},{id:'sonny',value:'7'},
  ]);
  assert.doesNotMatch(html,/NaN|Infinity/);
  const partial=characterBookHTML({global:totals([zeroRow('wing')])});
  assert.deepEqual(rankRows(partial).find(row=>row.id==='wing'),{id:'wing',value:'0'});
  assert.deepEqual(rankRows(partial).find(row=>row.id==='helen'),{id:'helen',value:'—'});
});

test('each public character has a six-axis graph and exact counters remain available in details',()=>{
  const personal=rows({wing:{encounters:12,imaginedHits:1,realHits:2,affinityUpEvents:3,affinityDownEvents:4,affinityLost:5,affinityGained:6}});
  const global=totals(rows({wing:{encounters:30,imaginedHits:7,realHits:8,affinityUpEvents:9,affinityDownEvents:10,affinityLost:11,affinityGained:12}}));
  const html=characterBookHTML({personal,global});
  assert.equal([...html.matchAll(/data-radar-character="/g)].length,CHARACTER_IDS.length);
  assert.equal([...html.matchAll(/<details class="character-data-details"/g)].length,CHARACTER_IDS.length);
  assert.match(html,/<details class="character-data-details"><summary>查看實際數字<\/summary><table class="character-comparison">/);
  assert.deepEqual(seriesFor(html,'wing','personal').values,[1,2,3,4,5,6]);
  assert.deepEqual(seriesFor(html,'wing','global').values,[7,8,9,10,11,12]);
  for(const id of CHARACTER_IDS)for(const scope of ['personal','global']){
    const series=seriesFor(html,id,scope);
    assert.equal(series.values.length,6);assert.equal(series.rates.length,6);assert.equal(series.scores.length,6);assert.equal(series.points.length,6);
    assert.ok(series.rates.every(value=>Number.isFinite(value)&&value>=0));
    assert.ok(series.scores.every(value=>Number.isFinite(value)&&value>=0&&value<=100));
    assert.ok(series.points.every(point=>point.length===2&&point.every(Number.isFinite)),`${id}/${scope}: finite six vertices`);
  }
  assert.match(html,/<th scope="row">完成互動<\/th><td>12<small>次<\/small><\/td><td>30<small>次<\/small><\/td>/);
});

test('real zero graphs stay centered and unavailable or malformed rows never become fake zero series',()=>{
  const zero=characterBookHTML({personal:rows(),global:totals(rows()),filter:'wing'});
  const center=seriesFor(zero,'wing','personal').points[0];
  assert.ok(seriesFor(zero,'wing','personal').points.every(point=>distance(point,center)===0));
  assert.deepEqual(seriesFor(zero,'wing','global').points,seriesFor(zero,'wing','personal').points);
  assert.match(zero,/尚無這類互動/);
  for(const personal of [null,[{id:'wing',encounters:99}],[{...zeroRow('wing'),realHits:-1}],[{...zeroRow('wing'),realHits:1.5}]]){
    const html=characterBookHTML({personal,global:null,filter:'wing'});
    assert.equal(seriesFor(html,'wing','personal'),null);
    assert.equal(seriesFor(html,'wing','global'),null);
    assert.match(html,/尚未取得/);
    assert.doesNotMatch(html,/data-radar-series="(?:personal|global)"/);
  }
  const mixed=characterBookHTML({personal:rows(),global:null,filter:'wing'});
  assert.ok(seriesFor(mixed,'wing','personal'));
  assert.equal(seriesFor(mixed,'wing','global'),null);
});

test('Wing encounter volume cannot dwarf equal-rate characters and filters preserve the common normalized scale',()=>{
  // Wing has ten thousand times as many completed interactions as Jack, but
  // players make the same choices at the same rates. Raw volume must not make
  // Jack's polygon disappear, nor should personal and global scopes diverge.
  const personal=rows({
    wing:{encounters:1000,imaginedHits:200,realHits:100,affinityUpEvents:300,affinityDownEvents:400,affinityLost:5000,affinityGained:8000},
    jack:{encounters:10,imaginedHits:2,realHits:1,affinityUpEvents:3,affinityDownEvents:4,affinityLost:50,affinityGained:80},
  });
  const global=totals(rows({
    wing:{encounters:100000,imaginedHits:20000,realHits:10000,affinityUpEvents:30000,affinityDownEvents:40000,affinityLost:500000,affinityGained:800000},
    jack:{encounters:1000,imaginedHits:200,realHits:100,affinityUpEvents:300,affinityDownEvents:400,affinityLost:5000,affinityGained:8000},
    helen:{encounters:20,imaginedHits:2,realHits:1,affinityUpEvents:3,affinityDownEvents:4,affinityLost:50,affinityGained:80},
  }));
  const all=characterBookHTML({personal,global});
  const filtered=characterBookHTML({personal,global,filter:'wing'});
  for(const scope of ['personal','global'])assert.deepEqual(seriesFor(filtered,'wing',scope),seriesFor(all,'wing',scope),'selecting a character does not rescale their graph');
  const center=seriesFor(all,'spencer','personal').points[0];
  const wing=seriesFor(all,'wing','global');
  assert.deepEqual(wing.rates,[20,10,30,40,500,800],'rates describe a hundred completed interactions, including point intensity');
  assert.deepEqual(wing.scores,[100,100,100,100,100,100]);
  for(const [id,scope] of [['wing','personal'],['jack','personal'],['jack','global']]){
    const series=seriesFor(all,id,scope);
    assert.deepEqual(series.rates,wing.rates,`${id}/${scope}: identical behavior rates`);
    assert.deepEqual(series.scores,wing.scores,`${id}/${scope}: identical scores across both scopes`);
    assert.deepEqual(series.points,wing.points,`${id}/${scope}: identical polygon regardless of sample volume`);
  }
  const lessFrequent=seriesFor(all,'helen','global');
  assert.deepEqual(lessFrequent.scores,[50,50,50,50,50,50]);
  for(let axis=0;axis<6;axis++){
    const full=distance(wing.points[axis],center);
    assert.ok(full>0);
    assert.ok(Math.abs(distance(lessFrequent.points[axis],center)/full-0.5)<0.001,`axis ${axis}: a lower rate has a smaller polygon`);
  }
  assert.deepEqual(rankRows(all).slice(0,3),[{id:'wing',value:'30,000'},{id:'jack',value:'300'},{id:'helen',value:'3'}],'the public ranking remains the requested raw combined counter');
});

test('normalization keeps extreme valid counters finite and bounded without erasing low-frequency data',()=>{
  const max=Number.MAX_SAFE_INTEGER;
  const personal=rows({wing:{encounters:1,imaginedHits:1,affinityGained:max},jack:{encounters:max,imaginedHits:1,affinityGained:1}});
  const global=totals(rows({spencer:{encounters:max,imaginedHits:max,affinityGained:max}}));
  const html=characterBookHTML({personal,global});
  for(const id of CHARACTER_IDS)for(const scope of ['personal','global']){
    const series=seriesFor(html,id,scope);
    assert.ok(series.rates.every(value=>Number.isFinite(value)&&value>=0),`${id}/${scope}: finite rates`);
    assert.ok(series.scores.every(value=>Number.isFinite(value)&&value>=0&&value<=100),`${id}/${scope}: bounded scores`);
    assert.ok(series.points.every(point=>point.every(Number.isFinite)),`${id}/${scope}: finite vertices`);
  }
  assert.equal(seriesFor(html,'wing','personal').rates[5],max*100,'a hundred-interaction intensity can legitimately exceed 100');
  assert.ok(seriesFor(html,'jack','personal').rates[0]>0,'tiny valid rates are not rounded to an invented zero');
  assert.ok(seriesFor(html,'jack','personal').scores[0]>0);
  assert.doesNotMatch(html,/NaN|Infinity/);
});

test('each axis uses the same personal-plus-global reference even when its highest rate belongs to a different scope',()=>{
  const personal=rows({
    wing:{encounters:20,imaginedHits:2,realHits:1,affinityUpEvents:6,affinityDownEvents:4,affinityLost:100,affinityGained:160},
    jack:{encounters:10,imaginedHits:2,realHits:1,affinityUpEvents:3,affinityDownEvents:2,affinityLost:50,affinityGained:80},
  });
  const global=totals(rows({
    wing:{encounters:20000,imaginedHits:2000,realHits:1000,affinityUpEvents:6000,affinityDownEvents:4000,affinityLost:100000,affinityGained:160000},
    spencer:{encounters:100,imaginedHits:10,realHits:5,affinityUpEvents:60,affinityDownEvents:40,affinityLost:1000,affinityGained:1600},
  }));
  const html=characterBookHTML({personal,global});
  assert.deepEqual(seriesFor(html,'wing','personal').scores,[50,50,50,50,50,50]);
  assert.deepEqual(seriesFor(html,'wing','global').scores,[50,50,50,50,50,50]);
  assert.deepEqual(seriesFor(html,'jack','personal').scores,[100,100,50,50,50,50],'personal Jack supplies only the first two outer-ring rates');
  assert.deepEqual(seriesFor(html,'spencer','global').scores,[50,50,100,100,100,100],'global Spencer supplies the remaining four outer-ring rates');
});

test('a zero encounter denominator with positive counters has no rate series but retains raw history',()=>{
  const personal=rows({wing:{encounters:10,imaginedHits:2}});
  const global=totals(rows({wing:{encounters:100,imaginedHits:20}}));
  const baseline=characterBookHTML({personal,global,filter:'wing'});
  const inconsistent={...zeroRow('spencer'),imaginedHits:9000,realHits:8000,affinityGained:7000};
  const updated=characterBookHTML({personal:[...personal.filter(row=>row.id!=='spencer'),inconsistent],global});
  for(const scope of ['personal','global'])assert.deepEqual(seriesFor(updated,'wing',scope),seriesFor(baseline,'wing',scope),'an incomparable legacy row cannot change a valid character scale');
  assert.equal(seriesFor(updated,'spencer','personal'),null,'a missing denominator is never replaced with one');
  assert.ok(seriesFor(updated,'spencer','global'),'the valid all-zero scope remains visible');
  const spencer=characterBookHTML({personal:[inconsistent],global:null,filter:'spencer'});
  assert.match(spencer,/<th scope="row">完成互動<\/th><td>0<small>次<\/small><\/td><td>—<\/td>/);
  assert.match(spencer,/<th scope="row">幻想扁人<\/th><td>9,000<small>次<\/small><\/td><td>—<\/td>/);
  assert.match(spencer,/<th scope="row">真的被扁<\/th><td>8,000<small>次<\/small><\/td><td>—<\/td>/);
  assert.match(spencer,/\+7,000 點/);
  assert.doesNotMatch(spencer,/NaN|Infinity|data-radar-series="personal"/);
});

test('one to nine completed interactions are identified as small samples without hiding their verified rates',()=>{
  for(const encounters of [1,9]){
    const html=characterBookHTML({personal:[{...zeroRow('jack'),encounters,imaginedHits:1}],filter:'jack'});
    assert.match(html,/樣本較少/);
    assert.ok(seriesFor(html,'jack','personal'));
    assert.equal(seriesFor(html,'jack','personal').values[0],1);
  }
  const sufficient=characterBookHTML({personal:[{...zeroRow('jack'),encounters:10,imaginedHits:1}],filter:'jack'});
  assert.doesNotMatch(sufficient,/樣本較少/);
});

test('hidden identities, unknown rows and unverified current-run previews cannot alter verified radar series',()=>{
  const personal=rows({wing:{encounters:10,imaginedHits:2,affinityGained:4}}),global=totals(rows({wing:{encounters:20,imaginedHits:4,affinityGained:8}}));
  const baseline=characterBookHTML({personal,global,filter:'wing'});
  const hidden={...zeroRow('hidden-visitor'),...Object.fromEntries(CHARACTER_METRICS.map(key=>[key,Number.MAX_SAFE_INTEGER]))};
  const invalid={...zeroRow('spencer'),imaginedHits:NaN,realHits:Number.MAX_SAFE_INTEGER};
  const run=createRun('system','e20-character-radar-preview');
  run.history=[{kind:'rage',eventId:'rage-release',choiceIndex:0,speaker:'wing',eventOutcome:{result:'真的失控了'}}];
  assert.equal(deriveCharacterStats(run).find(row=>row.id==='wing').realHits,1,'fixture contains a real, separate run preview');
  const withPreview=characterBookHTML({personal:[...personal,hidden],global:totals([...global.characters.filter(row=>row.id!=='spencer'),hidden,invalid]),currentRun:run,filter:'wing'});
  for(const scope of ['personal','global'])assert.deepEqual(seriesFor(withPreview,'wing',scope),seriesFor(baseline,'wing',scope));
  assert.doesNotMatch(withPreview,/data-radar-character="hidden-visitor"|魚酥|Frans/);
  assert.match(withPreview,/這局預覽/);
  const raw=JSON.stringify({personal,global});
  characterBookHTML({personal,global,currentRun:run});
  assert.equal(JSON.stringify({personal,global}),raw,'rendering never mutates verified snapshots');
});
