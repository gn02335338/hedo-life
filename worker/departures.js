import {ENDINGS} from '../dist/endings.js';

// These are coarse outcome groups, not ending titles or unlock hints. Keep the
// explicit family list so future endings cannot silently become resignations.
const groups={
 voluntary:['ragequit','assistant','promotion','slacker','sycophant','historian',
  'career_assistant','career_staff','career_senior','career_principal','career_deputy','career_manager','career_director','career_chief',
  'second_offer','handover_author','alumni_network','consultant','rage_walkaway'],
 forced_signed:['fired_signed'],
 company_exit:['fired_refused','layoff','merged_out','verbal_onboarding','company_closed','company_taiwan_exit','company_shell_brand'],
 pip_failed:['pip_fail'],
 pip_passed_exit:['pip_exit'],
 cold_storage:['cold_storage'],
 labor_dispute:['mediation_settled','mediation_pending','company_wage_arrears'],
 burnout:['burnout'],
 cash_exhausted:['broke'],
 startup:['venture_independent','venture_restart'],
 retirement:['retired_free','retired_flexible'],
 other:['nasdaq','taiwan','acquired','rage_legal','rage_defeated','rage_coup','rage_truce','rage_meme',
  'nasdaq_failed','taiwan_failed','google_board','google_ousted','buyer_board','buyer_ousted','vietnam_core','vietnam_afterdark','company_stagnation','company_restructured',
  'verbal_wing_concession','verbal_boardroom','verbal_rick_awake','verbal_hr_rewrite','verbal_legal_letter','verbal_sonny_statement','verbal_kind_ghost','verbal_colleague_solidarity','verbal_viral','verbal_mutual_mute','verbal_apology'],
};

export const DEPARTURE_WAYS=Object.freeze([...Object.keys(groups),'unclassified']);
const familyWays=new Map(Object.entries(groups).flatMap(([way,families])=>families.map(family=>[family,way])));
const endingWays=new Map(ENDINGS.map(ending=>[ending.id,familyWays.get(ending.family)||'unclassified']));
const endingFamilies=new Map(ENDINGS.map(ending=>[ending.id,ending.family]));

// Only a canonical e38/e39 replay can establish the explicit departure from a
// previously nonterminal chapter. Historical completions keep their fallback.
export function deriveDepartureWay(run){
 if(!run?.completed||!/^e(?:38|39)-/.test(run.seed||'')||!endingWays.has(run.endingId))return null;
 const family=endingFamilies.get(run.endingId);
 const choseDeparture=run.flags?.departure38_voluntary===1&&run.history?.some(row=>row.eventId==='chapter-resolution'&&row.choiceIndex===1);
 if(choseDeparture&&!['burnout','broke'].includes(family))return 'voluntary';
 return endingWays.get(run.endingId);
}

// Grouped SQL rows include every archived completion, including lives that
// predate observation tracking. Never return unknown IDs or narrative strings.
export function departureWays(rows){
 const counts=Object.fromEntries(DEPARTURE_WAYS.map(id=>[id,0]));
 for(const row of rows){
  const fallback=endingWays.get(row.id)||'unclassified';
  const way=endingWays.has(row.id)&&DEPARTURE_WAYS.includes(row.way)?row.way:fallback;
  counts[way]+=row.count;
 }
 return DEPARTURE_WAYS.map(id=>({id,count:counts[id]}));
}
