import {ENDINGS} from '../dist/endings.js';

// These are coarse outcome groups, not ending titles or unlock hints. Keep the
// explicit family list so future endings cannot silently become resignations.
const groups={
 voluntary:['ragequit','assistant','promotion','slacker','sycophant','historian',
  'career_assistant','career_staff','career_senior','career_principal','career_deputy','career_manager','career_director','career_chief',
  'second_offer','handover_author','alumni_network','consultant','rage_walkaway'],
 forced_signed:['fired_signed'],
 company_exit:['fired_refused','layoff','merged_out'],
 pip_failed:['pip_fail'],
 pip_passed_exit:['pip_exit'],
 cold_storage:['cold_storage'],
 labor_dispute:['mediation_settled','mediation_pending'],
 burnout:['burnout'],
 cash_exhausted:['broke'],
 startup:['venture_independent','venture_restart'],
 retirement:['retired_free','retired_flexible'],
 other:['nasdaq','taiwan','acquired','rage_legal','rage_defeated','rage_coup','rage_truce','rage_meme'],
};

export const DEPARTURE_WAYS=Object.freeze([...Object.keys(groups),'unclassified']);
const familyWays=new Map(Object.entries(groups).flatMap(([way,families])=>families.map(family=>[family,way])));
const endingWays=new Map(ENDINGS.map(ending=>[ending.id,familyWays.get(ending.family)||'unclassified']));

// Grouped SQL rows include every archived completion, including lives that
// predate observation tracking. Never return unknown IDs or narrative strings.
export function departureWays(rows){
 const counts=Object.fromEntries(DEPARTURE_WAYS.map(id=>[id,0]));
 for(const row of rows)counts[endingWays.get(row.id)||'unclassified']+=row.count;
 return DEPARTURE_WAYS.map(id=>({id,count:counts[id]}));
}
