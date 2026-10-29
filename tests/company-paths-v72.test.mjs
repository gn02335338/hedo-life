import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../dist/engine.js';
import {FANTASY_EVENTS} from '../dist/events.js';
import {isLifeSystemsV72} from '../dist/life-systems-v72.js';
import {companyEvidenceV72,companyPathWeightsV72,selectCompanyDossierV72,getCompanyEventV72,withCompanyEntryV72,withCompanyPreparationCopyV72} from '../dist/company-paths-v72.js';
import {COMPANY_ENDING_IDS_V32} from '../dist/company-v32.js';
import {COMPANY_ENDING_IDS_V39} from '../dist/company-v39.js';
import {companySampleV72} from '../scripts/audit-company-paths-v72.mjs';
import {readFile} from 'node:fs/promises';

const seed='e39-r72-n-'+'a'.repeat(22);
const baseline=()=>({seed,roleId:'sales',actualRoleId:'sales',stats:{energy:60,cash:60,mood:60,trust:60,skill:60,dream:60,boss:60},flags:{},history:[]});
// Pure-rule fixtures isolate thresholds; they are not claimed as replay routes.
const contact=(id,index,trust=10,body='合作資料已核對')=>({eventId:`test-${id}-${index}`,speaker:id,kind:'daily',choiceIndex:0,turn:index,title:'合作紀錄',body,result:'交付完成',delta:{trust},breakdown:[{source:'choice',delta:{trust}}]});
let cached;
function naturalDesk(){
 if(cached)return structuredClone(cached);
 for(let attempt=0;attempt<60;attempt++){
  const run=companySampleV72('sales',attempt);if(!run.companyDossierV72)continue;
  for(let count=1;count<run.actions.length;count++){
   const prefix=E.replayRun(run.roleId,run.seed,run.actions.slice(0,count));
   if(E.getEvent(prefix)?.id==='finale'&&!prefix.companyDossierV72){cached=prefix;return structuredClone(prefix);}
  }
 }
 throw Error('No naturally reached current company desk');
}
const resolve=run=>E.advance(E.applyChoice(run,0));

test('exact r72 and inherited r73–r75 profiles enable emergent company rules',()=>{
 for(const profile of [72,73,74,75])for(const marker of ['n','s','d'])assert.equal(isLifeSystemsV72(`e39-r${profile}-${marker}-`+'0'.repeat(22)),true);
 for(const value of [null,'e39-r71-n-'+'a'.repeat(22),'e39-r76-n-'+'a'.repeat(22),'e39-r72-x-'+'a'.repeat(22),'e39-r72-n-'+'a'.repeat(21),seed+'a',seed.toUpperCase()])assert.equal(isLifeSystemsV72(value),false);
 const event=FANTASY_EVENTS[3];assert.equal(withCompanyEntryV72(event,{...baseline(),seed:'e39-r71-n-'+'a'.repeat(22)},event.id),event);
});

test('r72 road choices describe work preparation while preserving every mechanical field and evidence weight',()=>{
 const road=FANTASY_EVENTS[0],old={...baseline(),seed:'e39-r71-n-'+'a'.repeat(22)},current=withCompanyPreparationCopyV72(road,baseline());
 assert.equal(withCompanyPreparationCopyV72(road,old),road);assert.equal(withCompanyPreparationCopyV72(FANTASY_EVENTS[1],baseline()),FANTASY_EVENTS[1]);
 assert.doesNotMatch([current.title,current.body,current.wing,...current.choices.flatMap(choice=>[choice.text,choice.detail,choice.result])].join(' '),/NASDAQ|Google|台灣|越南|紐約|納斯達克|收購|選擇航道|鐘要在哪裡/);
 const mechanics=event=>({...event,title:undefined,body:undefined,wing:undefined,era:undefined,choices:event.choices.map(choice=>({...choice,text:undefined,detail:undefined,result:undefined}))});
 assert.deepEqual(mechanics(current),mechanics(road));
 for(let index=0;index<road.choices.length;index++){
  const history=event=>[{eventId:event.id,title:event.title,body:event.body,speaker:'wing',kind:'fantasy',choiceIndex:index,choiceText:event.choices[index].text,result:event.choices[index].result,delta:event.choices[index].delta}];
  assert.deepEqual(companyPathWeightsV72({...baseline(),history:history(current)}),companyPathWeightsV72({...baseline(),history:history(road)}));
 }
});

test('Vietnam proposals need committed links; the night-business route additionally needs strong Kind affinity and a real introduction',()=>{
 const base=baseline();assert.equal(companyPathWeightsV72(base).vietnam_core,0);assert.equal(companyPathWeightsV72(base).vietnam_afterdark,0);
 const delivered={...base,history:[contact('johnny',1,4,'越南團隊的產品交付，承接窗口確認')]};
 assert.ok(companyPathWeightsV72(delivered).vietnam_core>0);assert.equal(companyPathWeightsV72(delivered).vietnam_afterdark,0);
 const close={...base,history:[contact('kind',1),contact('kind',2)],flags:{kind_relaxed:1}};
 assert.equal(companyEvidenceV72(close).affinity.kind,70);assert.ok(companyPathWeightsV72(close).vietnam_afterdark>0);
 assert.equal(companyPathWeightsV72({...close,history:[contact('kind',1,5)]}).vietnam_afterdark,0);
 assert.equal(companyPathWeightsV72({...close,flags:{}}).vietnam_afterdark,0);
 const network={...close,flags:{relationship72_kind_network:1}};assert.ok(companyPathWeightsV72(network).vietnam_afterdark>0);
});

test('work, accounts and trustworthy contacts shape different path weights without making any eligible path certain',()=>{
 const base=baseline(),weights=companyPathWeightsV72(base);
 const technical={...base,history:[contact('professor',1,10,'海外產品交付'),contact('professor',2,10,'跨境技術驗收')],flags:{evidence:4}};
 const commercial={...base,history:[contact('owen',1,10,'客戶合約與合作營收'),contact('owen',2,10,'續約合作')]};
 assert.ok(companyPathWeightsV72(technical).nasdaq>weights.nasdaq);assert.ok(companyPathWeightsV72(commercial).buyer>weights.buyer);
 const paths=new Set(Array.from({length:100},(_,i)=>selectCompanyDossierV72(technical,()=>i/100).path));
 for(const id of ['taiwan','nasdaq','buyer','google'])assert.ok(paths.has(id));
 assert.ok(!paths.has('vietnam_afterdark'));
});

test('company proposals keep all sixteen families possible while high preparation never guarantees success',()=>{
 const run={...baseline(),history:[contact('kind',1),contact('kind',2),contact('professor',3),contact('professor',4)],flags:{kind_relaxed:1,evidence:10}};
 const families=new Set();
 for(let n=0;n<400;n++){
  const dossier=selectCompanyDossierV72(run,()=>n/400),shown=getCompanyEventV72({...run,companyDossierV72:dossier,companyContext:{version:72,route:dossier.route},eventId:`company-v32-${dossier.route}`});
  for(const choice of shown.choices.filter(choice=>choice.draw))for(const outcome of choice.draw.outcomes){assert.ok(outcome.weight>0);families.add(outcome.effect);}
  assert.ok(shown.choices[0].draw.outcomes.some(outcome=>COMPANY_ENDING_IDS_V39.includes(outcome.effect)));
 }
 assert.deepEqual(families,new Set([...COMPANY_ENDING_IDS_V32,...COMPANY_ENDING_IDS_V39]));
});

test('natural final desk offers preparation rather than a destination and resolves by canonical replay',()=>{
 const desk=naturalDesk(),view=E.getEvent(desk),snapshot=structuredClone(desk);
 assert.equal(view.id,'finale');assert.equal(view.choices.length,3);
 assert.doesNotMatch(view.choices.map(choice=>choice.text).join(' '),/NASDAQ|Google|台灣|越南/);
 assert.deepEqual(E.getEvent(desk),view);assert.deepEqual(desk,snapshot);
 const offer=resolve(desk),d=offer.companyDossierV72;
 assert.ok(d&&d.reasons.length);assert.equal(offer.companyContext.version,72);assert.equal(offer.turn,desk.turn);assert.equal(E.validRun(offer),true);
 assert.ok(E.getEvent(offer).body.includes(d.reasons[0]));
 const completed=resolve(offer);assert.equal(completed.completed,true);assert.equal(E.validRun(completed),true);assert.deepEqual(E.replayRun(completed.roleId,completed.seed,completed.actions),completed);
 assert.equal(completed.history.at(-1).companyOutcomeV72.path,d.path);
 assert.match(completed.history.at(-1).result,/在職|任用|離場|留任|見證/);
});

test('leaving and reopening a proposal reuses the original path without consuming another destination draw',()=>{
 const offer=resolve(naturalDesk()),first=structuredClone(offer.companyDossierV72),backIndex=E.getEvent(offer).choices.findIndex(choice=>choice.effect==='companyBack');
 const desk=E.advance(E.applyChoice(offer,backIndex));assert.equal(desk.eventId,'finale');assert.deepEqual(desk.companyDossierV72,first);
 const beforeRng=desk.rng,reopened=resolve(desk);assert.equal(reopened.rng,beforeRng);assert.deepEqual(reopened.companyDossierV72,first);
 assert.equal(E.validRun(reopened),true);assert.deepEqual(E.replayRun(reopened.roleId,reopened.seed,reopened.actions),reopened);
 const tampered=structuredClone(reopened);tampered.companyDossierV72.path=first.path==='nasdaq'?'taiwan':'nasdaq';assert.equal(E.validRun(tampered),false);
});

test('public preparation choices cannot override the already received destination',()=>{
 const offer=resolve(naturalDesk());
 const results=E.getEvent(offer).choices.map((choice,index)=>({choice,index})).filter(({choice})=>choice.draw&&choice.available!==false).map(({index})=>E.advance(E.applyChoice(offer,index)));
 assert.ok(results.length>=2);assert.ok(results.every(run=>run.companyDossierV72.path===offer.companyDossierV72.path));
 assert.ok(results.every(run=>run.completed&&E.validRun(run)));
});

test('natural Kind friendship unlocks a real night-business proposal while the company can still fail independently',async()=>{
 const report=JSON.parse(await readFile(new URL('./fixtures/company-kind-v72.json',import.meta.url),'utf8'));
 assert.deepEqual(new Set(report.routes.map(row=>row.path)),new Set(['vietnam_core','vietnam_afterdark']));
 for(const route of report.routes){
  const completed=E.replayRun(route.roleId,route.seed,route.actions);
  assert.equal(completed.completed,true);assert.equal(completed.endingId,route.ending);assert.equal(completed.companyDossierV72.path,route.path);assert.equal(E.validRun(completed),true);
  let offered;
  for(let count=1;count<=route.actions.length;count++){
   const run=E.replayRun(route.roleId,route.seed,route.actions.slice(0,count));
   if(run.companyDossierV72){offered=run;break;}
  }
  assert.ok(offered);const evidence=companyEvidenceV72(offered);
  if(route.path==='vietnam_afterdark'){
   assert.ok(evidence.affinity.kind>=68);assert.equal(evidence.kindNetwork,true);
   assert.ok(offered.history.some(row=>row.mealOutcome?.target==='kind'&&row.delta?.cash<0)||offered.flags.kind_relaxed||offered.flags.relationship72_kind_network);
  }else assert.equal(evidence.vietnamCoreEligible,true);
 }
});
