import {isExpansionV66} from './expansion-profile-v66.js';

// A presentation/statistics projection of a committed refusal, never a new
// outcome. Canonical replay remains the authority before server persistence.
export function isOnboardingDeclineV66(run){
 if(!isExpansionV66(run)||!run.completed||run.turn!==0||run.endingId!==`ragequit-${run.roleId}`)return false;
 const row=run.history?.at(-1),action=run.actions?.at(-1);
 return row?.eventId==='onboarding'&&row.kind==='onboarding'&&row.choiceIndex===2&&!row.verbalOutcome&&!row.departureOutcome&&action?.type==='choice'&&action.eventId==='onboarding'&&action.index===2;
}
