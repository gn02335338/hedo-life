import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as E from '../dist/engine.js';
import {getCompanyEventV39} from '../dist/company-v39.js';
import {withEmployeeAcquisitionV66,withConsultantInvitationV66,consultantInvitationAvailableV66} from '../dist/company-v66.js';
import {withSceneContinuityV66,isDeclinedArmSceneV66} from '../dist/scene-continuity-v66.js';
import {castVerbalLineV66} from '../dist/verbal-cast-v66.js';
import {EVENTS} from '../dist/events.js';
import {ROLE_MAP} from '../dist/roles.js';
import {validateCompletion} from '../worker/http.js';
const routes=JSON.parse(readFileSync(new URL('./fixtures/company-outlets-v66.json',import.meta.url),'utf8')).routes;
const replay=(row,actions=row.actions)=>E.replayRun(row.roleId,row.seed,actions);
function prefix(id,predicate){const row=routes.find(row=>row.id===id);for(let length=0;length<row.actions.length;length++){const run=replay(row,row.actions.slice(0,length));if(predicate(run))return run;}throw Error(`Missing ${id} source`);}

test('current acquisition and consultant endings are reachable from natural r66 public-action histories',()=>{
 assert.deepEqual(routes.map(row=>row.id).sort(),['acquired','consultant']);
 for(const row of routes){const run=replay(row);assert.equal(run.completed,true);assert.equal(run.endingId,`${row.id}-${row.roleId}`);assert.equal(E.validRun(run),true);assert.deepEqual(validateCompletion({runId:'bec7782e-9e17-4191-9f93-fca529effe66',roleId:row.roleId,seed:row.seed,actions:row.actions},ROLE_MAP).actions,row.actions);}
});

test('employee-focused acquisition leaves all original draw choices, weights and return indices intact',()=>{
 const run=prefix('acquired',run=>!run.completed&&E.getEvent(run).id==='company-v32-buyer'),base=getCompanyEventV39(run),shown=E.getEvent(run);
 assert.equal(shown.choices.length,base.choices.length+1);assert.deepEqual(shown.choices.slice(0,base.choices.length),base.choices);assert.equal(shown.choices[4].effect,'acquired');
 assert.equal(withEmployeeAcquisitionV66(base,{...run,seed:run.seed.replace('r66','r65')}),base);
 const pending=E.applyChoice(run,4),after=E.advance(pending);assert.match(pending.history.at(-1).result,/結束原公司.*全職任用/);assert.match(pending.history.at(-1).result,/收購方/);assert.equal(after.endingId,'acquired-system');assert.equal(after.turn,run.turn);assert.equal(after.pay,run.pay);assert.equal(after.stats.cash,run.stats.cash);assert.equal(E.validRun(pending),true);
 for(const key of ['energy','cash']){const unsafe={...run,stats:{...run.stats,[key]:8}};assert.equal(withEmployeeAcquisitionV66(base,unsafe).choices[4].available,false);}
});

test('a consultant invitation requires earned senior experience and does not itself leave, pay or appoint the player',()=>{
 const run=prefix('consultant',run=>!run.completed&&E.getEvent(run).id==='rank-exit'&&E.getEvent(run).choices.some(choice=>choice.flags?.includes('consultant66_discussed')));
 assert.equal(consultantInvitationAvailableV66(run),true);const scene=E.getEvent(run),index=scene.choices.findIndex(choice=>choice.flags?.includes('consultant66_discussed'));
 const pending=E.applyChoice(run,index),after=E.advance(pending);assert.equal(after.eventId,'story-exit');assert.equal(after.completed,false);assert.equal(after.flags.consultant_offer,1);assert.equal(after.turn,run.turn);assert.equal(after.pay,run.pay);assert.deepEqual(after.stats,run.stats);assert.equal(E.validRun(pending),true);assert.equal(E.validRun(after),true);
 assert.match(pending.history.at(-1).result,/還沒有離職/);assert.match(pending.history.at(-1).result,/另簽/);
 const start=E.createRun('executive','e39-r66-n-'+'a'.repeat(22));assert.equal(consultantInvitationAvailableV66(start),false);
 for(const patch of [{rank:4},{assignment:'assistant'},{patronage:{title:'乾兒子'}},{history:[]},{pip:{active:true}},{flags:{...run.flags,floor_watch:1}},{flags:{...run.flags,consultant_offer:1}},{seed:run.seed.replace('r66','r65')}])assert.equal(consultantInvitationAvailableV66({...run,...patch}),false);
 for(const [key,value]of [['skill',54],['trust',44],['energy',15],['cash',8]])assert.equal(consultantInvitationAvailableV66({...run,stats:{...run.stats,[key]:value}}),false);
 const old={...run,seed:run.seed.replace('r66','r65')},plain={id:'rank-exit',choices:[]};assert.equal(withConsultantInvitationV66(plain,old),plain);
});

test('a declined arm invitation keeps the short tie scene at the desk, with matching options, results and outburst copy',()=>{
 const base=EVENTS.find(event=>event.id==='quiz26-arm-draw'),fresh={seed:'e39-r66-n-'+'a'.repeat(22),history:[{kind:'activity-invitation',activityInvitationOutcome:{id:'arm',accepted:false}}]};
 assert.equal(isDeclinedArmSceneV66(fresh,base),true);const shown=withSceneContinuityV66(base,fresh);assert.match(shown.body,/婉拒/);assert.match(shown.body,/沒有到場記分/);assert.match(shown.title,/影片/);assert.equal(shown.speaker,'sonny');assert.equal(shown.choices.length,base.choices.length);
 for(let index=0;index<3;index++){assert.deepEqual(shown.choices[index].delta,base.choices[index].delta);assert.deepEqual(shown.choices[index].flags,base.choices[index].flags);assert.equal(shown.choices[index].effect,base.choices[index].effect);assert.match(shown.choices[index].result,/影片|群組/);}
 for(const phase of ['event','result'])assert.match(castVerbalLineV66(fresh,shown,'sonny',phase),/影片|座位/);
 for(const run of [{...fresh,seed:fresh.seed.replace('r66','r65')},{...fresh,history:[]},{...fresh,history:[{kind:'activity-invitation',activityInvitationOutcome:{id:'arm',accepted:true}}]}])assert.equal(withSceneContinuityV66(base,run),base);
});
