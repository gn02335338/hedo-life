// Fresh appointments get new benefits; published salaries and histories stay
// unchanged. These helpers consume no RNG and never mutate canonical state.
export const isPatronageBenefitsV67=value=>/^e39-r6[789]-[nsd]-[0-9a-f]{22}$/.test(typeof value==='string'?value:value?.seed||'');
export const PATRONAGE_APPOINTMENT_CASH_V67=24;
export const PATRONAGE_ALLOWANCE_CASH_V67=6;
export const PATRONAGE_ALLOWANCE_WORK_V67=2;

// Keep stories about the company's bias toward other applicants/colleagues.
// These few scenes instead assume the current employee is still being
// personally tested, paid less, or promoted on an ordinary unpaid promise.
export const PATRONAGE_EXCLUDED_DAILY_IDS_V67=Object.freeze([
 'degree-weekly-question','reading-list-rush','quiz26-school-exception',
 'cast35-erich-legal-salary-papers','raise-title-only'
]);
const ordinaryOnly=new Set(PATRONAGE_EXCLUDED_DAILY_IDS_V67);
export const patronageDailyAllowedV67=(run,event)=>!isPatronageBenefitsV67(run)||!run.patronage||!ordinaryOnly.has(event?.id);

export function appointmentPayV67(run,fromPay){
 if(!Number.isInteger(fromPay)||fromPay<1||fromPay>500)throw new Error('Invalid appointment salary');
 return isPatronageBenefitsV67(run)
  ?Math.min(500,Math.max(180,Math.round(fromPay*2.2),fromPay+60))
  :Math.min(500,Math.max(fromPay+8,Math.round(fromPay*1.15)));
}

// The final fantasy card is a plan picker. Market/buyer/Vietnam navigation
// and a return to that same picker are never delivered work, even though the
// historical row retains kind=fantasy and carries no effect field.
const workKey=row=>row&&['daily','fantasy'].includes(row.kind)&&row.eventId!=='finale'&&Number.isInteger(row.turn)&&row.turn>=1&&row.turn<=23&&typeof row.eventId==='string'&&row.eventId.trim()&&Number.isInteger(row.choiceIndex)&&row.choiceIndex>=0&&row.completed!==false&&row.departureOutcome?.completed!==false&&!row.verbalOutcome?`${row.turn}:${row.eventId}`:null;

// Pass history BEFORE candidateRow is committed. The engine grants this
// amount in that one choice's existing cash breakdown. A wallet already at
// 100 gets no deferred credit; revisiting a scene is not another payday.
// Salary is measured in K, while this allowance uses the 0–100 cash index.
export function patronageAllowanceDueV67(run,candidateRow){
 if(!isPatronageBenefitsV67(run)||!run.patronage||!Array.isArray(run.history))return 0;
 const appointedAt=run.patronage.historyIndex,key=workKey(candidateRow);
 if(!Number.isInteger(appointedAt)||appointedAt<0||appointedAt>=run.history.length||!key)return 0;
 const worked=new Set(run.history.slice(appointedAt+1).map(workKey).filter(Boolean));
 if(worked.has(key))return 0;
 return (worked.size+1)%PATRONAGE_ALLOWANCE_WORK_V67===0?PATRONAGE_ALLOWANCE_CASH_V67:0;
}
