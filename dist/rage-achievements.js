import { PERSONAS } from './persona.js';

// Modern rage actions resolve their release immediately, without a separate
// choice action. Pair each release with that attempt's origin, never cumulative
// target/mode flags from potentially different attempts. This only reads facts
// already committed by the engine and does not affect replay or RNG.
export function resolvedRageAttempts(run) {
 const actions=(Array.isArray(run?.actions)?run.actions:[]).filter(action=>action?.type==='rage'&&['event','result'].includes(action.phase)&&typeof action.eventId==='string');
 const attempts=[];
 let index=0;
 for(const [historyIndex,row] of (Array.isArray(run?.history)?run.history:[]).entries()){
  if(row?.eventId!=='rage-release')continue;
  const action=actions[index++];
  if(row.kind!=='rage'||row.choiceIndex!==0||!Object.hasOwn(PERSONAS,row.speaker))continue;
  const mode=row.eventOutcome?.result==='腦內劇場'?'imagined':row.eventOutcome?.result==='真的失控了'?'real':null;
  if(!mode)continue;
  const origin=action&&(!action.target||action.target===row.speaker)?action.eventId:null;
  attempts.push({historyIndex,person:row.speaker,mode,origin});
 }
 return attempts;
}
