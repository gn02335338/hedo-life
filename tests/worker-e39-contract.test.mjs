import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCompletion} from '../worker/http.js';
import {deriveObservation} from '../worker/observations.js';
import {departureWays,deriveDepartureWay,DEPARTURE_WAYS} from '../worker/departures.js';
import {ROLE_MAP} from '../dist/roles.js';
import {ENDINGS} from '../dist/endings.js';
import {createRun,applyChoice,advance,requestExit} from '../dist/engine.js';

const proof=actions=>({runId:'7ce894aa-4605-4bca-b31d-5317d32bb12e',roleId:'admin',seed:'e39-worker-contract',actions});
test('e39 HTTP envelope retains all existing actions and only the five new public target IDs',()=>{
 for(const action of [{type:'exit'},{type:'break'},{type:'career'},{type:'raise'},{type:'salary-advice'},
  ...['annie_yu','princess','joyce','janet','captain'].flatMap(target=>[
   {type:'rage',phase:'event',eventId:'synthetic-group',target},
   {type:'verbal',phase:'event',eventId:'synthetic-group',target,version:2}
  ])])assert.deepEqual(validateCompletion(proof([action]),ROLE_MAP),proof([action]));
 for(const target of ['private-sealed','__proto__','unpublished-person'])assert.throws(()=>validateCompletion(proof([{type:'rage',phase:'event',eventId:'synthetic-group',target}]),ROLE_MAP),error=>error.status===400);
 assert.throws(()=>validateCompletion({...proof([{type:'raise'}]),seed:'e40-unsupported'},ROLE_MAP),error=>error.status===400);
});

test('six new company outcomes classify actual employment without changing the thirteen aggregate groups',()=>{
 const expected={company_closed:'company_exit',company_taiwan_exit:'company_exit',company_shell_brand:'company_exit',company_wage_arrears:'labor_dispute',company_stagnation:'other',company_restructured:'other'};
 const added=ENDINGS.filter(ending=>(ending.minRules??1)>=39);assert.equal(added.length,78);
 assert.deepEqual([...new Set(added.map(ending=>ending.family))].sort(),Object.keys(expected).sort());
 for(const ending of added){
  const way=expected[ending.family],result=departureWays([{id:ending.id,count:1}]);
  assert.deepEqual(result,DEPARTURE_WAYS.map(id=>({id,count:Number(id===way)})),ending.id);
  assert.equal(deriveDepartureWay({completed:true,seed:'e39-unit',endingId:ending.id,flags:{},history:[]}),way);
 }
 const summed=departureWays(added.map(ending=>({id:ending.id,count:1})));
 assert.equal(summed.find(row=>row.id==='voluntary').count,0);
 assert.equal(summed.find(row=>row.id==='company_exit').count,39);
 assert.equal(summed.find(row=>row.id==='labor_dispute').count,13);
 assert.equal(summed.find(row=>row.id==='other').count,26);
 assert.equal(summed.find(row=>row.id==='unclassified').count,0);
});

test('a natural e39 resignation keeps cohort39, the eight-stage ladder and server-derived departure classification',()=>{
 let run;
 for(let n=0;n<30&&!run;n++){
  let candidate=createRun('system',`e39-worker-observation-${n}`);candidate=advance(applyChoice(candidate,0));candidate=requestExit(candidate);
  if(candidate.eventId!=='exit-menu')continue;
  candidate=advance(applyChoice(candidate,0));if(candidate.completed)run=candidate;
 }
 assert.ok(run);const observation=deriveObservation(run);
 assert.equal(observation.rule_cohort,39);assert.equal(observation.career_scheme,'full8');
 assert.equal(deriveDepartureWay(run),'voluntary');
});
