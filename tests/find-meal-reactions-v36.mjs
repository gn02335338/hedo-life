import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createRun,getEvent,applyChoice,advance,requestBreak,canRequestBreak,requestExit,replayRun,validRun} from '../dist/engine.js';
import {MEAL_GUEST_IDS_V25} from '../dist/meals-v25.js';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const reactions = ['warm','neutral','mine'];
const roles = ['system','sales','product','design','bd','mis','ai'];
const resolve = (run,index) => advance(applyChoice(run,index));
const effectIndex = (run,effect) => getEvent(run).choices.findIndex(c=>c.effect===effect&&c.available!==false);

function finishByLeaving(run){
  if(run.completed)return run;
  const requested=requestExit(run);
  if(requested===run)return null;
  const index=getEvent(requested).choices.findIndex(c=>c.available!==false);
  if(index<0)return null;
  const ended=resolve(requested,index);
  return ended.completed?ended:null;
}

// Coverage is found by committing ordinary actions on fresh seeds. This finder
// never edits a stat, RNG value, relationship, history row or run context. Both
// visible table replies are tried before inspecting their committed reactions.
export function findMealReactionWitnessesV36({maxAttempts=4000,onProgress=()=>{}}={}){
  const found=new Map(),refusals=new Map();let attempted=0;
  for(let attempt=0;attempt<maxAttempts&&found.size<96;attempt++){
    attempted++;
    const roleId=roles[attempt%roles.length],seed=`e36-mchat-${attempt.toString(36)}`;
    let run=resolve(createRun(roleId,seed),0);
    if(!canRequestBreak(run))continue;
    run=requestBreak(run);
    if(run.eventId!=='self-care')continue;
    const open=effectIndex(run,'mealOpen');if(open<0)continue;
    const pageA=resolve(run,open),pageB=resolve(pageA,effectIndex(pageA,'mealPage'));
    for(const [position,guest] of MEAL_GUEST_IDS_V25.entries()){
      if(reactions.every(reaction=>[0,1].every(replyIndex=>found.has(`${guest}/${replyIndex}/${reaction}`)))&&refusals.has(guest))continue;
      const menu=position<8?pageA:pageB;
      const index=getEvent(menu).choices.findIndex(c=>c.mealTarget===guest&&c.available!==false);
      if(index<0)continue;
      const pending=applyChoice(menu,index),dinner=advance(pending);
      assert.equal(validRun(dinner),true,`${seed}/${guest}/invitation`);
      if(pending.pendingEffect==='mealDeclined'){
        if(!refusals.has(guest))refusals.set(guest,{id:`${guest}-declined`,guest,roleId,seed,actions:dinner.actions,stateHash:hash(dinner)});
        continue;
      }
      assert.equal(dinner.eventId,`meal-with-${guest}`);
      for(const replyIndex of [0,1]){
        const paid=applyChoice(dinner,replyIndex),row=paid.history.at(-1),meal=row.mealOutcome;
        assert.ok(meal,`${seed}/${guest}/${replyIndex}: missing committed meal reaction`);
        assert.ok(reactions.includes(meal.reaction));
        assert.equal(meal.target,guest);assert.equal(meal.replyIndex,replyIndex);
        const key=`${guest}/${replyIndex}/${meal.reaction}`;
        if(found.has(key))continue;
        const continued=advance(paid);assert.equal(validRun(continued),true,key);
        const canonical=replayRun(roleId,seed,continued.actions);assert.deepEqual(canonical,continued,key);
        const completion=finishByLeaving(continued);
        assert.ok(completion&&validRun(completion),`${key}: ordinary exit completion`);
        assert.deepEqual(replayRun(roleId,seed,completion.actions),completion);
        found.set(key,{
          id:`${guest}-reply-${replyIndex}-${meal.reaction}`,guest,replyIndex,reaction:meal.reaction,
          affinityDelta:meal.affinityDelta,roleId,seed,actions:continued.actions,stateHash:hash(continued),
          completionActions:completion.actions,endingId:completion.endingId
        });
      }
    }
    if(attempt%100===0)onProgress({attempt:attempt+1,found:found.size,refusals:refusals.size});
  }
  const missing=MEAL_GUEST_IDS_V25.flatMap(guest=>[0,1].flatMap(replyIndex=>reactions.map(reaction=>`${guest}/${replyIndex}/${reaction}`))).filter(key=>!found.has(key));
  if(missing.length)throw new Error(`Missing ${missing.length} meal reactions after ${attempted} seeds: ${missing.join(', ')}`);
  assert.equal(refusals.size,16);
  const routes=MEAL_GUEST_IDS_V25.flatMap(guest=>[0,1].flatMap(replyIndex=>reactions.map(reaction=>found.get(`${guest}/${replyIndex}/${reaction}`))));
  return {version:36,method:'Natural first-workday invitations and committed table replies; no state injection or RNG preview.',attemptedSeeds:attempted,routes,refusals:MEAL_GUEST_IDS_V25.map(guest=>refusals.get(guest))};
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const report=findMealReactionWitnessesV36({maxAttempts:Number(process.argv[2]||4000),onProgress:row=>process.stdout.write(JSON.stringify(row)+'\n')});
  writeFileSync(new URL('./fixtures/meal-reactions-v36.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
  process.stdout.write(JSON.stringify({routes:report.routes.length,refusals:report.refusals.length,attemptedSeeds:report.attemptedSeeds})+'\n');
}
