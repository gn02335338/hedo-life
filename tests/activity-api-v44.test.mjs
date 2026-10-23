import test from 'node:test';
import assert from 'node:assert/strict';
import {ROLE_MAP} from '../dist/roles.js';
import {ACTIVITY_IDS_V44 as CURRENT_ACTIVITY_IDS_V44} from '../dist/activities-v44.js';
const ACTIVITY_IDS_V44=CURRENT_ACTIVITY_IDS_V44.filter(id=>id!=='camel'); // This fixture cohort published seven activities.
import {ApiError,validateCompletion} from '../worker/http.js';

const proof=(action,seed='e39-activity-envelope')=>({runId:'50abfbe0-fd37-498a-af91-d5542de39b87',roleId:'system',seed,actions:[action]});
const request=()=>({type:'activity',version:1,activityId:'arm'});
const rejected=body=>assert.throws(()=>validateCompletion(body,ROLE_MAP),error=>error instanceof ApiError&&error.code==='invalid_actions');

test('HTTP accepts only exact current-cohort activity invitations and the seven public activity IDs',()=>{
 for(const activityId of ACTIVITY_IDS_V44){const body=proof({...request(),activityId});assert.deepEqual(validateCompletion(body,ROLE_MAP).actions,body.actions);}
 for(const patch of [
  {version:0},{version:2},{version:'1'},{activityId:''},{activityId:'ARM'},{activityId:'missing'},{activityId:null},
  {eventId:'onboarding'},{score:99},{stage:2},{result:'通過'},{target:'wing'},{chance:1},
 ])rejected(proof({...request(),...patch}));
 for(const field of ['version','activityId']){const invalid=request();delete invalid[field];rejected(proof(invalid));}
 for(const seed of ['old','e38-old','e40-future','e390-typo','e29-old'])rejected(proof(request(),seed));
});
