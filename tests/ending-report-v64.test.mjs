import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';
import * as E from '../dist/engine.js';
import {buildEndingReport} from '../dist/ending-report.js';
import {renderEndingReport} from '../dist/ending-report-view.js';

const fixture=name=>JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`,import.meta.url),'utf8'));
const departures=fixture('event-departure-v63'),shareholders=fixture('shareholder-routes-v58'),loans=fixture('shareholder-all-in-v62');
const activities=fixture('activity-play-routes-v55'),roadshows=fixture('roadshow-v63'),rests=fixture('mood-rest-routes-v62'),treats=fixture('office-treats-routes-v61');
const copy=value=>structuredClone(value),plain=value=>JSON.parse(JSON.stringify(value));
const replay=row=>E.replayRun(row.roleId,row.seed,row.actions);
const named=(data,id)=>{const row=data.routes.find(row=>row.id===id);assert.ok(row,id);return row;};

function verify(run,id='life'){
 const snapshot=JSON.stringify(run),report=buildEndingReport(run),initial=E.createRun(run.roleId,run.seed);
 assert.equal(report.metadata.complete,true,id);assert.deepEqual(report.metadata.unavailableKeys,[],id);
 assert.equal(report.metadata.decisionCount,run.history.length,id);assert.equal(report.metadata.workTurns,run.turn,id);
 assert.equal(report.samples.length,run.history.length+1,id);assert.deepEqual(report.samples[0].stats,initial.stats,id);assert.deepEqual(report.samples.at(-1).stats,run.stats,id);
 for(const key of E.STAT_KEYS){
  const metric=report.stats.find(item=>item.key===key);assert.equal(metric.available,true,`${id}/${key}`);assert.equal(metric.reason,null,`${id}/${key}`);
  assert.equal(metric.start,initial.stats[key],`${id}/${key}`);assert.equal(metric.delta,run.history.reduce((sum,row)=>sum+row.delta[key],0),`${id}/${key}`);
  for(let index=1;index<report.samples.length;index++)assert.equal(report.samples[index].stats[key]-report.samples[index-1].stats[key],run.history[index-1].delta[key],`${id}/${index}/${key}`);
 }
 for(const trend of report.trends){assert.equal(trend.available,true,id);assert.equal(trend.points.length,run.history.length+1,id);}
 assert.equal(JSON.stringify(run),snapshot,'reporting does not alter canonical data');return report;
}

test('a two-action r63 refusal retains its real origin and all three chart series',()=>{
 const run=E.replayRun('system','e39-r63-n-0000000000000000000000',[{type:'activity-schedule',version:1},{type:'event-departure',version:1,eventId:'onboarding'}]);
 assert.equal(run.completed,true);assert.equal(E.validRun(run),true);assert.equal(run.history.length,1);verify(run,'minimal-onboarding-departure');
 const html=renderEndingReport(run);assert.equal((html.match(/class="report-trend-line trend-/g)||[]).length,3);assert.doesNotMatch(html,/report-chart-empty|起點未記錄|沒有完整的變化過程|NaN|undefined|Infinity/);
});

test('every natural r63 departure, including pending results and nested paid speech, preserves each committed sample',()=>{
 assert.equal(departures.routes.length,147);
 for(const row of departures.routes){
  const source=E.replayRun(row.roleId,row.seed,row.beforeActions);
  if(source.history.length)verify(source,`${row.id}/before`);else assert.equal(buildEndingReport(source).metadata.hasHistory,false);
  verify(E.requestEventDepartureV63(source),`${row.id}/pending`);verify(replay(row),`${row.id}/resolved`);
 }
 for(const row of departures.continuations||[])verify(replay(row),row.id);
});

const playInputs={
 arm:{kind:'arm',mode:'steady',taps:Array.from({length:8},(_,i)=>500+i*1000)},
 diet:{kind:'diet',days:Array.from({length:7},(_,i)=>({meal:i%2,exercise:i===2||i===5?2:i%2}))},
 roadshow:{kind:'roadshow',matches:[0,1,2,1,0,2]},dinner:{kind:'dinner',plates:[0,1,2,0,1,1]},
 banquet:{kind:'banquet',beats:Array.from({length:12},(_,i)=>500+i*600)},basketball:{kind:'basketball',moves:[0,2,1,2,0]},review:{kind:'review',evidence:[0,1,2,0]}
};
test('all seven interactive activities record one sample per submitted game, while menu openings and local drafts record none',()=>{
 for(const row of activities.routes){
  const source=E.replayRun(row.roleId,row.seed,row.beforePlayActions),pending=E.applyActivityPlay(source,copy(playInputs[row.id]));
  const before=verify(source,`${row.id}/draft`),after=verify(pending,`${row.id}/submitted`);assert.equal(after.samples.length,before.samples.length+1);
  let run=E.advance(pending);verify(run,`${row.id}/stage-2`);
  while(run.activityContext)run=E.advance(E.applyChoice(run,0));verify(run,`${row.id}/returned`);
 }
 for(const row of roadshows.routes)verify(replay(row),`roadshow/${row.id}`);
});

test('shareholder press, presentation, yield and financed shares retain complete sample histories including loan payments',()=>{
 for(const data of [shareholders,loans])for(const row of data.routes)verify(replay(row),`shareholder/${row.id}`);
 const paid=replay(named(loans,'completed-paid-off'));assert.equal(paid.completed,true);assert.ok(paid.history.some(row=>row.breakdown?.some(part=>part.source==='shareholder-loan')));
 const html=renderEndingReport(paid);assert.equal((html.match(/class="report-trend-line trend-/g)||[]).length,3);assert.doesNotMatch(html,/report-chart-empty|起點未記錄|沒有完整的變化過程/);
});

test('warning-gap navigation, paid recovery, PIP and office treats do not invent or lose a decision sample',()=>{
 let gapChoices=0;
 for(const data of [rests,treats])for(const row of data.routes){const run=replay(row);verify(run,`${data===rests?'rest':'treat'}/${row.id}`);gapChoices+=run.actions.filter(action=>action.type==='choice'&&action.eventId==='work-gap-v50').length;}
 assert.ok(gapChoices>10);
 const row=named(departures,'gap'),gap=E.replayRun(row.roleId,row.seed,row.beforeActions),continued=E.applyChoice(gap,0);
 assert.equal(E.isWorkGapOpenV50(gap),true);assert.equal(continued.history.length,gap.history.length);assert.deepEqual(verify(continued,'continue-gap').samples,verify(gap,'open-gap').samples);
});

test('truncated, reordered and malformed new action evidence still produces an honest fallback',()=>{
 const departure=replay(named(departures,'work'));
 const activityRow=named(activities,'arm'),activity=E.applyActivityPlay(E.replayRun(activityRow.roleId,activityRow.seed,activityRow.beforePlayActions),copy(playInputs.arm));
 const shareholder=replay(named(shareholders,'round-1'));
 const cases=[
  [departure,run=>run.history.pop()],
  [departure,run=>{[run.history[0],run.history[1]]=[run.history[1],run.history[0]];}],
  [departure,run=>{run.history.at(-1).departureOutcome.sourceEventId='unrelated-event';}],
  [departure,run=>{run.history.at(-1).departureOutcome.completed=true;}],
  [departure,run=>{run.actions.at(-1).version=2;}],
  [activity,run=>{run.actions.at(-1).input={kind:'arm',mode:'steady',taps:['not-a-timestamp']};}],
  [activity,run=>{run.history.at(-1).activityOutcome.performance.score=-1;}],
  [activity,run=>{run.history.at(-1).activityOutcome.stage=0;}],
  [shareholder,run=>{run.actions.findLast(action=>action.type==='shareholder-play').input.mode='invented-mode';}],
  [shareholder,run=>{run.history.at(-1).shareholderOutcome.round=3;}],
  [shareholder,run=>{run.history.at(-1).shareholderOutcome.mode='invented-mode';}]
 ];
 for(const [source,mutate]of cases){const invalid=copy(source);mutate(invalid);const report=buildEndingReport(invalid);assert.equal(report.metadata.complete,false);assert.ok(report.stats.every(row=>row.start===null&&row.end===source.stats[row.key]));assert.ok(report.trends.every(trend=>trend.points.length===0));}
 const incomplete=copy(departure);delete incomplete.history.at(-1).delta.mood;const report=buildEndingReport(incomplete);assert.equal(report.stats.find(row=>row.key==='mood').available,false);assert.equal(report.stats.find(row=>row.key==='energy').available,true);
});

test('reporting frozen contemporary saves draws no randomness and owns its output arrays',()=>{
 const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
 const run=freeze(copy(replay(named(loans,'completed-with-loan')))),snapshot=JSON.stringify(run),random=Math.random;let report;
 try{Math.random=()=>{throw Error('Reports must not draw RNG');};report=buildEndingReport(run);assert.equal(report.metadata.complete,true);}
 finally{Math.random=random;}
 report.samples.at(-1).stats.cash=-999;report.trends[0].points[0].value=-999;assert.equal(JSON.stringify(run),snapshot);assert.equal(buildEndingReport(run).samples.at(-1).stats.cash,run.stats.cash);
});

const appURL=new URL('../dist/app.js',import.meta.url),appRaw=readFileSync(appURL,'utf8');
const appBindings=Object.assign({},...await Promise.all([...appRaw.matchAll(/^import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];$/gm)].filter(row=>row[2]!=='./cloud.js').map(async row=>{
 const module=await import(new URL(row[2],appURL));return Object.fromEntries(row[1].split(',').map(name=>name.trim()).filter(Boolean).map(name=>{const[original,alias]=name.split(/\s+as\s+/);return[alias||original,module[original]];}));
})));
async function reloadApp(run,mobile){
 const nodes=new Map(),listeners=new Map(),calls={save:0,complete:0},stored=JSON.stringify({run:plain(run),unlocked:[run.endingId],achievements:{}});
 const node=selector=>{if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',open:false,dataset:{},style:{},classList:{add(){},remove(){},toggle(){}},focus(){},scrollIntoView(){},setAttribute(){},addEventListener(){},querySelector:node,querySelectorAll:()=>[],showModal(){this.open=true;},close(){this.open=false;}});return nodes.get(selector);};
 const context=vm.createContext({...appBindings,crypto:webcrypto,structuredClone,setTimeout:()=>1,clearTimeout(){},window:{scrollTo(){},matchMedia:()=>({matches:mobile})},
  document:{querySelector:node,addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(fn);},body:{append(){}},activeElement:null},
  localStorage:{getItem:key=>key==='hedo-life-v3'?stored:null,setItem(){calls.save++;}},
  cloud:{state:{status:'local',achievements:[],characters:[]},subscribe(){},init:async()=>null,achievementProgress:async()=>null,characterProgress:async()=>null,complete:async()=>{calls.complete++;}},
  createFeedbackUI:()=>({open(){}}),createCharacterBook:()=>({open(){},onSnapshot(){},onRunChanged(){}}),createAdminArchiveUI:()=>({open(){}}),createLeaderboardUIV56:()=>({open(){},endingHTML:()=>'',mountEnding(){}}),renderSceneIllustration:()=>'',renderEndingIllustration:()=>''
 });
 vm.runInContext(appRaw.replace(/^import .*;\n/gm,''),context);await new Promise(resolve=>setImmediate(resolve));calls.save=0;calls.complete=0;
 const target={closest:selector=>selector==='[data-action]'?{dataset:{action:'continue'}}:null};for(const fn of listeners.get('click')||[])await fn({target});await new Promise(resolve=>setImmediate(resolve));
 return{html:node('#main').innerHTML,run:plain(vm.runInContext('run',context)),calls,stored};
}
for(const mobile of [false,true])test(`${mobile?'mobile':'desktop'}: reloading completed public saves renders all series without replaying the life or rewriting storage`,async()=>{
 for(const row of [named(departures,'onboarding'),named(loans,'completed-with-loan')]){
  const run=replay(row);assert.equal(run.completed,true);const loaded=await reloadApp(run,mobile);
  assert.deepEqual(loaded.run,run);assert.equal(loaded.calls.save,0);assert.equal(loaded.calls.complete,0);assert.equal((loaded.html.match(/class="report-trend-line trend-/g)||[]).length,3,row.id);assert.doesNotMatch(loaded.html,/report-chart-empty|起點未記錄|沒有完整的變化過程|NaN|undefined|Infinity/);
 }
});
