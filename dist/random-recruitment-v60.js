import {ROLES} from './roles.js';

// This recruiter is browser presentation state, never evidence for a score,
// appointment or unlock. Canonical run construction verifies those separately.
const ordinaryIds=Object.freeze(ROLES.filter(role=>role.id!=='executive').map(role=>role.id));
export function createRandomRecruiterV60(random=Math.random){
 let bag=[],lastOrdinary=null,lastKind=null;
 const drawUnit=()=>{
  const value=random();
  if(!Number.isFinite(value)||value<0||value>=1)throw new Error('Invalid recruitment random source');
  return value;
 };
 function ordinary(){
  if(!bag.length){
   bag=[...ordinaryIds];
   for(let i=bag.length-1;i>0;i--){const j=Math.floor(drawUnit()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}
   if(bag.length>1&&bag.at(-1)===lastOrdinary)[bag[0],bag[bag.length-1]]=[bag.at(-1),bag[0]];
  }
  lastOrdinary=bag.pop();
  return lastOrdinary;
 }
 return Object.freeze({draw(){
  const ticket=drawUnit();
  let kind=ticket<.04?'executive':ticket<.07?'godson':ticket<.10?'goddaughter':'normal';
  // A rare draw never immediately repeats itself. Do not redraw indefinitely
  // or consume a second hidden roll when a test/browser source repeats a value.
  if(kind!=='normal'&&kind===lastKind)kind='normal';
  const roleId=kind==='normal'?ordinary():kind==='executive'?'executive':null;
  lastKind=kind;
  return {kind,roleId};
 }});
}
