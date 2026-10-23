import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as E from '../dist/engine.js';
import {isEventDepartureOutcomeV63,withDeparturePipReviewV63} from '../dist/event-departure-v63.js';
import {deriveAchievements} from '../dist/achievements.js';
import {deriveAchievementsV61} from '../dist/achievements-v61.js';
import {deriveDepartureWay} from '../worker/departures.js';

const {routes,required,continuations=[]}=JSON.parse(readFileSync(new URL('./fixtures/event-departure-v63.json',import.meta.url),'utf8'));
const copy=value=>JSON.parse(JSON.stringify(value)),route=id=>{const row=routes.find(row=>row.id===id);assert.ok(row,id);return row;};
const replay=(row,actions=row.actions)=>E.replayRun(row.roleId,row.seed,actions),before=id=>{const row=route(id);return replay(row,row.beforeActions);};
const countWork=run=>run.history.filter(row=>['daily','fantasy'].includes(row.kind)).length;
const incomes=run=>run.history.flatMap(row=>row.breakdown||[]).filter(part=>part.source==='income').length;

test('departure descriptors expose only a decision and preserve RNG, while published lives have no new action',()=>{
 const run=before('work'),saved=JSON.stringify(run),view=E.getEventDepartureV63(run);
 assert.deepEqual(Object.keys(view).sort(),['available','detail','label','reason']);assert.equal(view.available,true);assert.ok(view.label&&view.detail);assert.doesNotMatch(JSON.stringify(view),/chance|delta|affinityDelta|ticket|\+\d+|\d+%/);assert.equal(JSON.stringify(run),saved);
 const old=E.enableActivitySchedule(E.createRun('system','e39-r62-n-0000000000000000000000'));assert.equal(E.getEventDepartureV63(old),null);assert.equal(E.requestEventDepartureV63(old),old);
 for(const source of [null,undefined,{},E.createRun('system','e13-old-scene')])assert.equal(E.getEventDepartureV63(source),null);
});

test('natural source, pending and resolved checkpoints have exact canonical actions and no invented completion marker',()=>{
 assert.ok(routes.length>=75);assert.deepEqual(required.filter(id=>!routes.some(row=>row.id===id)),[]);
 for(const row of routes){
  const source=replay(row,row.beforeActions),saved=copy(source),visible=E.getEvent(source),pending=E.requestEventDepartureV63(source),after=E.advance(pending);
  assert.deepEqual(source,saved,row.id);assert.equal(E.validRun(copy(source)),true,row.id);assert.equal(E.validRun(copy(pending)),true,row.id);assert.equal(E.validRun(copy(after)),true,row.id);
  assert.deepEqual(pending.actions.at(-1),{type:'event-departure',version:1,eventId:visible.id});assert.equal(pending.history.at(-1).kind,'event-departure');assert.equal(isEventDepartureOutcomeV63(pending,pending.history.at(-1)),true);assert.equal(pending.history.at(-1).departureOutcome.completed,false);
  assert.equal(E.getEvent(pending).kind,'event-departure');assert.deepEqual(E.getEvent(pending).choices,[]);assert.equal(E.getEventDepartureV63(pending).available,false);assert.equal(E.requestEventDepartureV63(pending),pending);
  assert.deepEqual(E.replayRun(row.roleId,row.seed,pending.actions),after,row.id);assert.deepEqual(replay(row),after,row.id);assert.equal(after.departureContext,undefined,row.id);assert.equal(after.stats.cash,source.stats.cash,row.id);
  for(const request of [E.requestBreak,E.requestExit,E.requestCareer,E.requestRaise,E.requestRage,E.requestVerbal,E.requestPatronageReply])assert.equal(request(pending),pending,row.id);
 }
});

test('departing a workday spends time with no completed delivery, salary, service or loan payment',()=>{
 for(const id of ['work','work-loan']){
  const source=before(id),pending=E.requestEventDepartureV63(source),after=E.advance(pending);
  assert.equal(after.turn,source.turn+1);assert.equal(countWork(after),countWork(source));assert.equal(incomes(after),incomes(source));assert.equal(after.stats.cash,source.stats.cash);assert.equal(after.pay,source.pay);assert.equal(after.rank,source.rank);assert.equal(after.flags.career_service,source.flags.career_service);assert.deepEqual(after.shareholderLoan,source.shareholderLoan);
  assert.equal(after.history.at(-1).departureOutcome.workDaySpent,true);assert.equal(after.history.at(-1).delta.energy,0);assert.equal(after.history.at(-1).delta.skill,0);assert.equal(after.history.at(-1).delta.lick,0);assert.equal(after.history.at(-1).delta.slack,0);
 }
});

test('PIP misses consume three improvement days, award no work and cannot be turned into a passing assessment',()=>{
 let run=before('work-pip'),initial=countWork(run);assert.equal(run.pip.remaining,3);
 for(let missed=1;missed<=3;missed++){
  if(E.isWorkGapOpenV50(run))run=E.applyChoice(run,0);assert.ok(['daily','fantasy'].includes(E.getEvent(run).kind));
  const source=copy(run);run=E.advance(E.requestEventDepartureV63(run));assert.equal(run.turn,source.turn+1);assert.equal(run.pip.remaining,3-missed);assert.equal(run.flags.departure63_pip_missed,missed);assert.equal(countWork(run),initial);assert.equal(E.validRun(copy(run)),true);
 }
 assert.equal(run.eventId,'pip-review');assert.match(E.getEvent(run).body,/3 天擅離/);assert.ok(E.getEvent(run).choices.filter(choice=>choice.check).every(choice=>choice.check.chance===0));
 const failed=E.advance(E.applyChoice(run,0));assert.equal(failed.completed,true);assert.match(failed.endingId,/^pip_fail-/);assert.equal(deriveDepartureWay(failed),'pip_failed');
});

test('the PIP review presentation uses the current period counter, not older missed-day history',()=>{
 const source=before('pip-review'),event=E.getEvent(source),original=event.choices.filter(choice=>choice.check).map(choice=>choice.check.chance);
 // Presentation-unit inputs are separate from the canonical three-day proof
 // above: clearing this period's counter must leave earlier history harmless.
 for(const missed of [0,1,2,3]){
  const view=withDeparturePipReviewV63(event,{...source,flags:{...source.flags,departure63_pip_missed:missed}}),chances=view.choices.filter(choice=>choice.check).map(choice=>choice.check.chance);
  assert.deepEqual(chances,original.map(chance=>missed===3?0:Math.max(0,chance-missed*.2)));if(missed===0)assert.equal(view,event);else assert.ok(view.body.includes(`${missed} 天擅離`));
 }
});

test('aborted activity stages preserve earlier play and costs without inventing a completed activity or a fresh injury',()=>{
 const activity=routes.filter(row=>/^activity-(?:arm|diet|roadshow|dinner|banquet|basketball|review)-\d$/.test(row.id));assert.ok(activity.length>=21);
 for(const row of activity){
  const source=replay(row,row.beforeActions),after=replay(row),id=source.activityContext.id;
  assert.ok(!after.activityContext);assert.equal(after.turn,source.turn);assert.equal(after.stats.cash,source.stats.cash);assert.equal(after.stats.energy,source.stats.energy);assert.equal(after.flags[`activity44_${id}`]||0,source.flags[`activity44_${id}`]||0);assert.equal(after.flags[`activity44_${id}_completed`]||0,source.flags[`activity44_${id}_completed`]||0);
  assert.equal(after.actions.filter(action=>action.type==='activity-play').length,source.actions.filter(action=>action.type==='activity-play').length);assert.equal(after.history.filter(part=>part.activityOutcome?.done).length,source.history.filter(part=>part.activityOutcome?.done).length);
 }
});

test('leaving treats and shareholder stages cannot refund money or fabricate a delivered drink, final scene or hearing win',()=>{
 for(const row of routes.filter(row=>['treats','shareholder'].includes(row.category))){
  const source=replay(row,row.beforeActions),after=replay(row);assert.equal(after.turn,source.turn);assert.equal(after.stats.cash,source.stats.cash);assert.deepEqual(after.shareholderLoan,source.shareholderLoan);
  assert.equal(after.flags.shareholder58_owned||0,source.flags.shareholder58_owned||0);assert.equal(after.flags.shareholder58_finished||0,source.flags.shareholder58_finished||0);assert.deepEqual(deriveAchievementsV61(after),deriveAchievementsV61(source));
  assert.equal(after.history.filter(part=>part.treatsOutcome?.done||part.shareholderOutcome?.done).length,source.history.filter(part=>part.treatsOutcome?.done||part.shareholderOutcome?.done).length);
 }
});

test('personnel and legal notifications keep their actual company decision instead of becoming voluntary resignation',()=>{
 for(const [id,family,way]of [['paperwork','fired_refused','company_exit'],['dismissal-final','layoff','company_exit'],['labor-claim','mediation_pending','labor_dispute'],['labor-mediation','mediation_pending','labor_dispute'],['pip-review','pip_fail','pip_failed']]){
  const run=replay(route(id));assert.equal(run.completed,true,id);assert.match(run.endingId,new RegExp(`^${family}-`));assert.equal(deriveDepartureWay(run),way,id);assert.notEqual(deriveDepartureWay(run),'voluntary');
 }
 const notice=replay(route('crisis-boss'));assert.equal(notice.completed,false);assert.equal(notice.eventId,'dismissal-final');assert.equal(notice.flags.hr_pip_allowed,0);
});

test('private meal and rest cancellation preserves prior spending and does not reset an already used allowance',()=>{
 for(const row of routes.filter(row=>['meal','rest'].includes(row.category))){
  const source=replay(row,row.beforeActions),after=replay(row);assert.equal(after.stats.cash,source.stats.cash);assert.equal(after.stats.energy,source.stats.energy);assert.equal(after.turn,source.turn);assert.equal(after.lastBreakTurn,source.lastBreakTurn);assert.equal(after.mealContext,null);
  assert.equal(after.history.filter(part=>part.mealOutcome).length,source.history.filter(part=>part.mealOutcome).length);if(source.lastBreakTurn===source.turn)assert.equal(E.canRequestBreak(after),false);
 }
 const source=before('gap-after-rest'),after=replay(route('gap-after-rest'));assert.equal(after.lastBreakTurn,source.lastBreakTurn);assert.equal(E.canRequestBreak(after),false);assert.equal(after.stats.cash,source.stats.cash);
});

test('unaccepted salary, appointment and planning offers do not become accepted by departure',()=>{
 for(const row of routes.filter(row=>['salary','patronage','wealth','company'].includes(row.category))){
  const source=replay(row,row.beforeActions),after=replay(row);assert.equal(after.pay,source.pay);assert.equal(after.rank,source.rank);assert.deepEqual(after.patronage,source.patronage);assert.equal(after.stats.cash,source.stats.cash);assert.equal(after.turn,source.turn);
  assert.equal(after.history.filter(part=>part.patronageApplicationOutcome||part.recruitmentOutcome).length,source.history.filter(part=>part.patronageApplicationOutcome||part.recruitmentOutcome).length);
 }
});

test('departure rows never masquerade as onboarding, paid recovery or banquet choices; real prior achievements remain',()=>{
 const declined=replay(route('onboarding')),earned=deriveAchievements(declined);for(const id of ['work-card','switch','assistant','robot'])assert.ok(!earned.includes(id),id);assert.equal(declined.flags.departure63_onboarding_declined,1);assert.equal(deriveDepartureWay(declined),'other');
 for(const row of routes.filter(row=>['rest','salary','private','meal'].includes(row.category)||row.id.startsWith('activity-banquet-'))){
  const source=replay(row,row.beforeActions),after=replay(row),prior=deriveAchievements(source),now=deriveAchievements(after);for(const id of prior)assert.ok(now.includes(id),`${row.id}/${id}`);
  for(const id of ['self-care','salary-save','banquet','banquet-prize','banquet-shared','kind-ghost'])if(!prior.includes(id))assert.ok(!now.includes(id),`${row.id} must not manufacture ${id}`);
 }
});

test('an already accepted son or daughter appointment survives result-phase speech departure and advances onboarding once',()=>{
 for(const marker of ['s','d']){
  const id=`verbal-onboarding-result-${marker}`,source=before(id),context=source.verbalContext,after=replay(route(id));
  assert.equal(context.phase,'result');assert.equal(context.eventId,'onboarding');assert.ok(source.patronage);assert.deepEqual(after.patronage,source.patronage);assert.equal(after.pay,source.pay);assert.equal(after.turn,1);assert.equal(after.completed,false);assert.ok(!after.flags.departure63_onboarding_declined);assert.equal(after.history.filter(row=>row.recruitmentOutcome?.kind==='appointment').length,1);assert.equal(after.history.filter(row=>row.kind==='onboarding').length,1);
  assert.deepEqual(after.history.slice(0,source.history.length),source.history);assert.ok(deriveAchievements(after).includes(marker==='s'?'kin-direct-son':'kin-direct-daughter'));assert.equal(E.validRun(copy(after)),true);
 }
});

test('result-phase speech and real rage retain the original paid choice and settle it at most once',()=>{
 for(const id of ['verbal-result','rage-result','verbal-paid-result','rage-paid-result','verbal-paid-meal-result','rage-paid-meal-result']){
  const source=before(id),context=source.verbalContext||source.rageContext,original=source.history[context.historyLength-1],after=replay(route(id));assert.equal(context.phase,'result');assert.ok(original);
  assert.deepEqual(after.history.slice(0,source.history.length),source.history);assert.equal(after.stats.cash,source.stats.cash);assert.equal(incomes(after),incomes(source));assert.equal(countWork(after),countWork(source));assert.equal(after.history.filter(row=>row.kind===original.kind&&row.eventId===original.eventId).length,source.history.filter(row=>row.kind===original.kind&&row.eventId===original.eventId).length);
  assert.equal(after.turn,source.turn+(['daily','fantasy','onboarding'].includes(original.kind)?1:0));if(id.includes('paid-meal')){assert.match(original.eventId,/^meal-with-/);assert.ok(original.delta.cash<0);assert.equal(after.history.filter(row=>row.mealOutcome).length,source.history.filter(row=>row.mealOutcome).length);}
 }
});

test('leaving a legal follow-up never fabricates another paid workday or a successful legal outcome',()=>{
 for(const id of ['verbal-legal','verbal-legal-result']){
  const source=before(id),after=replay(route(id));assert.equal(after.stats.cash,source.stats.cash);assert.equal(incomes(after),incomes(source));assert.equal(countWork(after),countWork(source));assert.equal(after.flags.departure63_legal_pending,1);assert.ok(after.history.at(-1).result.includes('後續'));assert.equal(E.validRun(copy(after)),true);
 }
});

test('aborting one treat does not consume the next treat’s achievement proof cursor',()=>{
 const row=continuations.find(row=>row.id==='treat-after-abort');assert.ok(row);assert.notEqual(row.abortedStory,row.completedStory);
 const source=E.replayRun(row.roleId,row.seed,row.beforeActions),after=E.replayRun(row.roleId,row.seed,row.actions);assert.equal(E.validRun(source),true);assert.equal(E.validRun(after),true);
 assert.ok(source.history.some(part=>part.departureOutcome?.category==='treats'));assert.ok(!after.history.some(part=>part.treatsOutcome?.id===row.abortedStory&&part.treatsOutcome.done));assert.ok(after.history.some(part=>part.treatsOutcome?.id===row.completedStory&&part.treatsOutcome.done));
 assert.equal(row.completedStory,'birthday-cake');assert.ok(deriveAchievementsV61(after).includes('cake-jack-relief'));assert.ok(!deriveAchievementsV61(after).includes('treat-jack-drink'));
});

test('strict replay rejects wrong versions, extra answers, stale visible IDs, old profiles and duplicate departures',()=>{
 const row=route('gap'),source=replay(row,row.beforeActions),action={type:'event-departure',version:1,eventId:'work-gap-v50'};
 for(const malformed of [{...action,version:2},{...action,completed:true},{...action,index:0},{...action,eventId:source.eventId},{...action,eventId:''},{type:'event-departure',eventId:action.eventId}])assert.throws(()=>E.replayRun(row.roleId,row.seed,[...row.beforeActions,malformed]));
 assert.throws(()=>E.replayRun(row.roleId,row.seed,[...row.actions,action]));
 const old='e39-r62-n-0000000000000000000000';assert.throws(()=>E.replayRun('system',old,[{type:'activity-schedule',version:1},{type:'event-departure',version:1,eventId:'onboarding'}]));
 const pending=E.requestEventDepartureV63(source),forged=copy(pending);forged.history.at(-1).departureOutcome.completed=true;assert.equal(isEventDepartureOutcomeV63(forged,forged.history.at(-1)),false);assert.equal(E.validRun(forged),false);
});
