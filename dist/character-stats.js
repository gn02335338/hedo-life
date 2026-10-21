import { PERSONAS } from './persona.js';

// A projection of committed history, independent of game rules and RNG. A
// character's relationship score is distinct from Wing's weather and team trust.
export const CHARACTER_STATS_VERSION=1;
export const CHARACTER_IDS=Object.freeze(Object.keys(PERSONAS));
export const CHARACTER_METRICS=Object.freeze(['encounters','imaginedHits','realHits','affinityGained','affinityLost','affinityUpEvents','affinityDownEvents']);
const known=id=>CHARACTER_IDS.includes(id);
const verbalKinds=new Set(['ignored','relationship','retort','support','personnel','legal']);
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const choiceDelta=row=>{
 const parts=Array.isArray(row.breakdown)?row.breakdown.filter(part=>part?.source==='choice'):[];
 return parts.reduce((total,part)=>({boss:total.boss+(Number.isFinite(part.delta?.boss)?part.delta.boss:0),trust:total.trust+(Number.isFinite(part.delta?.trust)?part.delta.trust:0)}),{boss:0,trust:0});
};

export function characterHistoryChanges(run){
 const scores=Object.fromEntries(CHARACTER_IDS.map(id=>[id,50])),changes=[];
 for(const [historyIndex,row] of (Array.isArray(run?.history)?run.history:[]).entries()){
  if(!row||!Number.isInteger(row.choiceIndex)||row.choiceIndex<0)continue;
  let ids=known(row.speaker)?[row.speaker]:row.speaker==='exit-team'?['erich','jenjen','sonny']:[];
  if(!ids.length)continue;
  let mode=null,verbal=null;
  if(row.verbalOutcome?.version===2){
   const evidence=row.verbalOutcome;
   if(!/^e(?:30|31)-/.test(run.seed||'')||evidence.origin!==row.eventId||evidence.target!==row.speaker||!verbalKinds.has(evidence.kind)||!Number.isInteger(evidence.affinityDelta)||evidence.affinityDelta< -60||evidence.affinityDelta>12||!['event','result'].includes(evidence.phase)||!['daily','fantasy','onboarding','verbal'].includes(row.kind)||evidence.phase==='result'&&row.kind!=='verbal')continue;
   verbal=evidence;
  }else if(row.eventId==='verbal-release'){
   const evidence=row.verbalOutcome;
   if(!/^e(?:30|31)-/.test(run.seed||'')||row.kind!=='verbal'||row.choiceIndex!==0||!evidence||evidence.target!==row.speaker||!verbalKinds.has(evidence.kind)||!Number.isInteger(evidence.affinityDelta)||evidence.affinityDelta< -60||evidence.affinityDelta>12||typeof evidence.origin!=='string'||!['event','result'].includes(evidence.phase))continue;
   verbal=evidence;
  }
  if(row.eventId==='rage-release'){
   if(row.kind!=='rage'||row.choiceIndex!==0||!known(row.speaker))continue;
   mode=row.eventOutcome?.result==='腦內劇場'?'imagined':row.eventOutcome?.result==='真的失控了'?'real':null;
   if(!mode)continue;
   ids=[row.speaker];
  }else if(row.kind==='rage')continue; // Older cartoon scenes do not prove a real or imagined hit.
  const delta=choiceDelta(row);
  for(const id of ids){
   // Only the already resolved choice contributes. Neither incidental luck nor
   // daily weather is another character's opinion. Historical rows without a
   // choice ledger retain their encounters, without inventing an affinity delta.
   const requested=verbal?verbal.affinityDelta:mode==='real'?-25:mode==='imagined'||row.kind==='rage-world'?0:clamp(Math.round(id==='wing'?delta.boss:delta.trust),-12,12);
   const score=clamp(scores[id]+requested,0,100),affinityDelta=score-scores[id];scores[id]=score;
   changes.push({historyIndex,id,encounters:1,imaginedHits:mode==='imagined'?1:0,realHits:mode==='real'?1:0,affinityDelta});
  }
 }
 return changes;
}

export function deriveCharacterStats(run){
 const rows=Object.fromEntries(CHARACTER_IDS.map(id=>[id,{id,...Object.fromEntries(CHARACTER_METRICS.map(key=>[key,0]))}]));
 for(const change of characterHistoryChanges(run)){
  const row=rows[change.id];
  row.encounters+=change.encounters;row.imaginedHits+=change.imaginedHits;row.realHits+=change.realHits;
  if(change.affinityDelta>0){row.affinityGained+=change.affinityDelta;row.affinityUpEvents++;}
  if(change.affinityDelta<0){row.affinityLost-=change.affinityDelta;row.affinityDownEvents++;}
 }
 return CHARACTER_IDS.map(id=>rows[id]);
}

export function characterAffinity(run,id){
 const row=deriveCharacterStats(run).find(row=>row.id===id);
 return {score:row?50+row.affinityGained-row.affinityLost:50,start:50,gained:row?.affinityGained||0,lost:row?.affinityLost||0};
}
