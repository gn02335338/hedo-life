import { PERSONAS } from './persona.js';
import { isPatronageApplicationOutcomeV49 } from './patronage-v49.js';

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

// This is resolved evidence from the versioned patronage reply action, never
// team trust, a spoken-outburst counter, or a hit. Canonical replay validates
// the appointment and scene presence before the Worker projects these rows.
export function isPatronageOutcomeV43(run,row){
 const evidence=row?.patronageOutcome;
 return /^e(?:29|30|31|32|33|34|35|36|37|38|39)-/.test(run?.seed||'')&&Boolean(evidence)&&typeof evidence==='object'&&!Array.isArray(evidence)
  &&Object.keys(evidence).sort().join(',')==='affinityDelta,mode,origin,reaction,target,version'
  &&evidence.version===1&&known(evidence.target)&&row.speaker===evidence.target
  &&row.eventId==='patronage-reply'&&row.kind==='patronage'&&row.choiceIndex===0
  &&!Object.hasOwn(row,'verbalOutcome')&&!Object.hasOwn(row,'mealOutcome')
  &&typeof evidence.origin==='string'&&evidence.origin.trim().length>0&&evidence.origin.length<=100
  &&evidence.mode===(['wing','spencer'].includes(evidence.target)?'flattery':'entitled')
  &&['obliged','retort','reported','welcomed'].includes(evidence.reaction)
  &&Number.isInteger(evidence.affinityDelta)&&evidence.affinityDelta>=-24&&evidence.affinityDelta<=12
  &&row.eventOutcome?.label==='自己人發話之後'&&typeof row.eventOutcome.result==='string'&&row.eventOutcome.result.trim().length>0&&row.eventOutcome.result.length<=100;
}

export function isMealOutcomeV36(run,row){
 const evidence=row?.mealOutcome,labels={warm:'聊得很開',neutral:'平常吃飯',mine:'不小心踩雷'};
 return /^e(?:36|37|38|39)-/.test(run?.seed||'')&&Boolean(evidence)&&typeof evidence==='object'&&!Array.isArray(evidence)
  &&Object.keys(evidence).sort().join(',')==='affinityDelta,reaction,replyIndex,target,version'
  &&evidence.version===1&&known(evidence.target)&&(evidence.target!=='professor'||/^e(?:37|38|39)-/.test(run?.seed||''))&&row.speaker===evidence.target
  &&row.kind==='self-care'&&row.eventId===`meal-with-${evidence.target}`&&!row.verbalOutcome
  &&[0,1].includes(row.choiceIndex)&&evidence.replyIndex===row.choiceIndex
  &&Object.hasOwn(labels,evidence.reaction)&&row.eventOutcome?.label==='餐桌氣氛'&&row.eventOutcome.result===labels[evidence.reaction]
  &&Number.isInteger(evidence.affinityDelta)&&evidence.affinityDelta>=-12&&evidence.affinityDelta<=12
  &&(evidence.reaction==='warm'?evidence.affinityDelta>0:evidence.reaction==='mine'?evidence.affinityDelta<0:evidence.affinityDelta===0);
}

export function characterHistoryChanges(run){
 const scores=Object.fromEntries(CHARACTER_IDS.map(id=>[id,50])),changes=[];
 for(const [historyIndex,row] of (Array.isArray(run?.history)?run.history:[]).entries()){
  if(!row||!Number.isInteger(row.choiceIndex)||row.choiceIndex<0)continue;
  // The player's employment confirmation is not another NPC conversation.
  if(/^e(?:38|39)-/.test(run.seed||'')&&row.eventId==='chapter-resolution')continue;
  let application=null;
  if(Object.hasOwn(row,'patronageApplicationOutcome')||/^e39-cal46-kin49-/.test(run.seed||'')&&row.eventId==='patronage-application'&&[0,1].includes(row.choiceIndex)){
   if(!isPatronageApplicationOutcomeV49(run,row))continue;
   application=row.patronageApplicationOutcome;
  }
  let patronage=null;
  if(row.eventId==='patronage-reply'||row.kind==='patronage'||Object.hasOwn(row,'patronageOutcome')){
   if(!isPatronageOutcomeV43(run,row))continue;
   patronage=row.patronageOutcome;
  }
  let ids=known(row.speaker)?[row.speaker]:row.speaker==='exit-team'?['erich','jenjen','sonny']:[];
  if(application)ids.push('rick');
  if(!ids.length)continue;
  let mode=null,verbal=null,meal=null;
  if(row.mealOutcome!==undefined){
   if(!isMealOutcomeV36(run,row))continue;
   meal=row.mealOutcome;
  }else if(/^e(?:36|37|38|39)-/.test(run.seed||'')&&row.kind==='self-care'&&row.eventId===`meal-with-${row.speaker}`&&!row.verbalOutcome)continue;
  if(row.verbalOutcome?.version===2){
   const evidence=row.verbalOutcome;
   if(!/^e(?:30|31|32|33|34|35|36|37|38|39)-/.test(run.seed||'')||evidence.origin!==row.eventId||evidence.target!==row.speaker||!verbalKinds.has(evidence.kind)||!Number.isInteger(evidence.affinityDelta)||evidence.affinityDelta< -60||evidence.affinityDelta>12||!['event','result'].includes(evidence.phase)||!['daily','fantasy','onboarding','verbal'].includes(row.kind)||evidence.phase==='result'&&row.kind!=='verbal')continue;
   verbal=evidence;
  }else if(row.eventId==='verbal-release'){
   const evidence=row.verbalOutcome;
   if(!/^e(?:30|31|32|33|34|35|36|37|38|39)-/.test(run.seed||'')||row.kind!=='verbal'||row.choiceIndex!==0||!evidence||evidence.target!==row.speaker||!verbalKinds.has(evidence.kind)||!Number.isInteger(evidence.affinityDelta)||evidence.affinityDelta< -60||evidence.affinityDelta>12||typeof evidence.origin!=='string'||!['event','result'].includes(evidence.phase))continue;
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
   const requested=application&&id==='rick'?application.affinityDelta:patronage?patronage.affinityDelta:verbal?verbal.affinityDelta:meal?meal.affinityDelta:mode==='real'?-25:mode==='imagined'||row.kind==='rage-world'?0:clamp(Math.round(id==='wing'?delta.boss:delta.trust),-12,12);
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
