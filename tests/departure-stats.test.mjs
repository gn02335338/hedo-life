import test from 'node:test';
import assert from 'node:assert/strict';
import {ENDINGS} from '../dist/endings.js';
import {DEPARTURE_WAYS,departureWays} from '../worker/departures.js';

const expectedFamilies={
 voluntary:'ragequit assistant promotion slacker sycophant historian career_assistant career_staff career_senior career_principal career_deputy career_manager career_director career_chief second_offer handover_author alumni_network consultant rage_walkaway',
 forced_signed:'fired_signed',company_exit:'fired_refused layoff merged_out verbal_onboarding',
 pip_failed:'pip_fail',pip_passed_exit:'pip_exit',cold_storage:'cold_storage',
 labor_dispute:'mediation_settled mediation_pending',burnout:'burnout',cash_exhausted:'broke',
 startup:'venture_independent venture_restart',retirement:'retired_free retired_flexible',
 other:'nasdaq taiwan acquired rage_legal rage_defeated rage_coup rage_truce rage_meme nasdaq_failed taiwan_failed google_board google_ousted buyer_board buyer_ousted vietnam_core vietnam_afterdark verbal_wing_concession verbal_boardroom verbal_rick_awake verbal_hr_rewrite verbal_legal_letter verbal_sonny_statement verbal_kind_ghost verbal_colleague_solidarity verbal_viral verbal_mutual_mute verbal_apology',
};
const ids=['voluntary','forced_signed','company_exit','pip_failed','pip_passed_exit','cold_storage','labor_dispute','burnout','cash_exhausted','startup','retirement','other','unclassified'];
const published=ENDINGS.filter(ending=>(ending.minRules??1)<39);

test('departure contract always exposes all thirteen anonymous groups in stable order, including zero counts',()=>{
 assert.deepEqual(DEPARTURE_WAYS,ids);
 assert.deepEqual(departureWays([]),ids.map(id=>({id,count:0})));
});

test('all 805 published endings belong to exactly one departure group without treating career or fantasy endings as dismissals',()=>{
 assert.equal(published.length,805);
 const classifiedFamilies=Object.values(expectedFamilies).flatMap(value=>value.split(' '));
 assert.equal(new Set(classifiedFamilies).size,classifiedFamilies.length,'group families must be mutually exclusive');
 assert.deepEqual([...new Set(published.map(ending=>ending.family))].sort(),[...classifiedFamilies].sort(),'all published families are explicitly classified');
 const expected=Object.fromEntries(ids.map(id=>[id,0]));
 for(const ending of published){
  const matches=Object.entries(expectedFamilies).filter(([,families])=>families.split(' ').includes(ending.family));
  assert.equal(matches.length,1,ending.id);const group=matches[0][0];expected[group]++;
  assert.deepEqual(departureWays([{id:ending.id,count:1}]),ids.map(id=>({id,count:Number(id===group)})),ending.id);
 }
 const actual=departureWays(published.map(ending=>({id:ending.id,count:1})));
 assert.deepEqual(actual,ids.map(id=>({id,count:expected[id]})));
 assert.equal(actual.reduce((total,row)=>total+row.count,0),published.length);
 assert.equal(actual.find(row=>row.id==='unclassified').count,0);
});

test('grouped completion counts add correctly and unknown historical or future IDs expose no private text',()=>{
 const rows=[{id:'ragequit-system',count:4},{id:'rage_walkaway-sales',count:2},{id:'fired_signed-system',count:3},
  {id:'fired_refused-system',count:5},{id:'layoff-ai',count:7},{id:'merged_out-sales',count:1},
  {id:'private-unknown-ending-title',count:9},{id:'future-family-system',count:11},{id:'__proto__',count:13}];
 const result=departureWays(rows),byId=Object.fromEntries(result.map(row=>[row.id,row.count]));
 assert.equal(byId.voluntary,6);assert.equal(byId.forced_signed,3);assert.equal(byId.company_exit,13);assert.equal(byId.unclassified,33);
 assert.equal(result.reduce((total,row)=>total+row.count,0),rows.reduce((total,row)=>total+row.count,0));
 assert.ok(result.every(row=>Object.keys(row).join(',')==='id,count'));
 assert.doesNotMatch(JSON.stringify(result),/private-unknown|future-family|__proto__|ending|family/);
});
