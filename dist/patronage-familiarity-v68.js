import {isPatronageOutcomeV43} from './character-stats.js';

// Preserve the seeded meal replies of published lives. A fresh r68 life still
// records every encounter and every affinity loss in the character book, but
// an unwelcome assertion of special status is not friendly time together.
export const isPatronageFamiliarityV68=value=>/^e39-r(?:6[89]|70)-[nsd]-[0-9a-f]{22}$/.test(typeof value==='string'?value:value?.seed||'');
export function countsFriendlyPatronageEncounterV68(run,row){
 return !isPatronageFamiliarityV68(run)||!isPatronageOutcomeV43(run,row)||row.patronageOutcome.affinityDelta>=0;
}
