import {ENERGY_REST_WARNING_V53,energyRestWarningV53} from './energy-rest-v53.js';
import {workGapSurfaceSafeV50} from './work-gap-v50.js';
import {isRecruitmentV60} from './seed-profile-v60.js';

// Keep published rest timing and proofs frozen. Only this new seed cohort
// gets enough warning to reach its first usable, between-scene rest interval.
export const ENERGY_SAFETY_OWED_V54='energy54_rest_owed';
export const isEnergySafetyV54=run=>isRecruitmentV60(run)||/^e39-cal46-kin49-g-e-s-/.test(typeof run==='string'?run:run?.seed||'');

export function energySafetyReturnedBoundaryV54(run,next){
 if(next.turn>run.turn)return true;
 if(run.rageContext||run.verbalContext||run.patronageReplyContext)return false;
 return next.flags.work_gap_open===1||Boolean(
  ['captainVoyageContext','blockchainContext','treatsContext','recruitmentContext','activityContext','hiddenEncounterContext','companyContext','raiseContext','mealContext','patronageContext',
   'resumeEventId','meltdownReturnEventId','breakReturnEventId','banquetReturnEventId','wealthReturnEventId','exitReturnEventId']
   .some(key=>run[key]&&!next[key])||
  run.salaryAdvice?.status==='open'&&next.salaryAdvice?.status==='done'
 );
}

export function energySafetyChoiceV54(run,next,event,change){
 if(!isEnergySafetyV54(run))return;
 const before=run.stats.energy;
 // An otherwise healthy workday cannot skip the entire warning range in one
 // draw. This is a final, visible correction; cash, other stats and RNG stay
 // exactly as resolved. Continuing work after an offered warning is risky.
 if(before>ENERGY_REST_WARNING_V53&&['daily','fantasy'].includes(event.kind)){
  const floor=before-ENERGY_REST_WARNING_V53;
  if(next.stats.energy<floor)change('fatigue-buffer','體力警訊：工作先收尾',{energy:floor-next.stats.energy});
 }
 if(next.stats.energy>ENERGY_REST_WARNING_V53){next.flags[ENERGY_SAFETY_OWED_V54]=0;return;}
 if(before>ENERGY_REST_WARNING_V53)next.flags[ENERGY_SAFETY_OWED_V54]=1;
 // A warning may arrive inside an activity or a required HR conversation.
 // Finish that bundle before offering rest, with only one point held in
 // reserve. Once a usable interval was offered, this protection is gone.
 if(next.flags[ENERGY_SAFETY_OWED_V54]===1&&next.stats.energy<1)change('fatigue-buffer','先緩一口氣，撐到這段事情告一段落',{energy:1-next.stats.energy});
}

export function energySafetyBoundaryV54(run,next,source){
 if(!isEnergySafetyV54(run)||next===run)return;
 if(next.completed){next.flags[ENERGY_SAFETY_OWED_V54]=0;return;}
 if(next.stats.energy>ENERGY_REST_WARNING_V53){next.flags[ENERGY_SAFETY_OWED_V54]=0;return;}
 if(!energyRestWarningV53(next))return;
 const owes=next.flags[ENERGY_SAFETY_OWED_V54]===1;
 // A spontaneous Kind invitation may sit in front of the first queued gap.
 // Accepting it spends this turn's allowance. Do not expose a fresh, empty
 // gap afterwards; the warning remains owed for the next actual workday.
 if(owes&&next.lastBreakTurn===next.turn&&run.eventId==='kind-workday'&&!next.breakReturnEventId)next.flags.work_gap_open=0;
 // Rage/verbal answers can return to the middle of an unanswered scene.
 // They never manufacture an interval, even when their meter crossed 30.
 if(owes&&energySafetyReturnedBoundaryV54(run,next)&&next.lastBreakTurn!==next.turn){
  const candidate={...next,flags:{...next.flags,work_gap_open:1}};
  if(workGapSurfaceSafeV50(candidate,source)){
   next.flags.work_gap_open=1;next.flags[ENERGY_SAFETY_OWED_V54]=0;
  }
 }
 // A new no-turn activity does not grant a second paid-rest allowance. Keep
 // its warning owed until the next actual workday, rather than showing an
 // empty interval or exhausting the player before any usable rest choice.
}
