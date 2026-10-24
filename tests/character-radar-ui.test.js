import test from 'node:test';
import assert from 'node:assert/strict';
import {characterBookHTML,createCharacterBook} from '../dist/character-book.js';
import {CHARACTER_IDS,CHARACTER_METRICS,deriveCharacterStats} from '../dist/character-stats.js';
import {createRun} from '../dist/engine.js';

const AXES=['imaginedHits','realHits','affinityUpEvents','affinityDownEvents','affinityLost','affinityGained'];
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
  return {values:attr(polygon[1],'data-radar-values').split(',').map(Number),points:attr(polygon[1],'points').trim().split(/\s+/).map(pair=>pair.split(',').map(Number))};
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
  const global=totals(rows({wing:{imaginedHits:8},meimei:{realHits:3}}));
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
  const global=totals(rows({wing:{imaginedHits:max,realHits:max-1},spencer:{imaginedHits:max,realHits:max},erich:{imaginedHits:2,realHits:5},sonny:{imaginedHits:4,realHits:3}}));
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
    assert.equal(series.values.length,6);assert.equal(series.points.length,6);
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

test('both scopes and every role filter share axis domains from all verified public characters',()=>{
  const values=multiplier=>Object.fromEntries(AXES.map((key,index)=>[key,(index+1)*multiplier]));
  const personal=rows({wing:values(1)}),global=totals(rows({wing:values(2),jack:values(4)}));
  const all=characterBookHTML({personal,global});
  const filtered=characterBookHTML({personal,global,filter:'wing'});
  for(const scope of ['personal','global'])assert.deepEqual(seriesFor(filtered,'wing',scope),seriesFor(all,'wing',scope),'selecting a character does not rescale their graph');
  const center=seriesFor(all,'spencer','personal').points[0];
  const own=seriesFor(all,'wing','personal'),total=seriesFor(all,'wing','global'),maximum=seriesFor(all,'jack','global');
  for(let axis=0;axis<6;axis++){
    const full=distance(maximum.points[axis],center);
    assert.ok(full>0);
    assert.ok(Math.abs(distance(own.points[axis],center)/full-0.25)<0.001,`axis ${axis}: personal and global share max`);
    assert.ok(Math.abs(distance(total.points[axis],center)/full-0.5)<0.001,`axis ${axis}: global maximum includes other characters`);
  }
});

test('hidden identities, unknown rows and unverified current-run previews cannot alter verified radar series',()=>{
  const personal=rows({wing:{imaginedHits:2,affinityGained:4}}),global=totals(rows({wing:{imaginedHits:4,affinityGained:8}}));
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
