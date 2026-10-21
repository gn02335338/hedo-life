import { MEAL_FLAVOR_V36 } from './meal-flavor-v36.js';
import { invitationProfileV34 } from './meal-invitations-v34.js';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
// These are the two existing conversation choices, not keywords inferred from
// the player's identity. A joke can be welcome without being a safe topic.
const topicRisk=Object.freeze({
 wing:[0,.22],spencer:[0,.03],erich:[0,-.03],sonny:[0,.12],
 jenjen:[0,-.02],rick:[0,.19],kind:[0,.04],hope:[.04,.17],
 jack:[0,-.04],meimei:[0,.04],helen:[-.02,.03],sophie:[-.02,.17],
 jonathan:[0,.06],owen:[0,.02],sam:[0,.14],cindy:[0,.01]
});
const reactions=Object.freeze([
 ['warm','聊得很開'],['neutral','平常吃飯'],['mine','不小心踩雷']
]);

// Reading the menu calculates probabilities only. The engine owns the single
// seeded draw, at the moment a paid conversation is actually committed.
export function mealChatProfileV36(run,id,replyIndex){
 const persona=MEAL_FLAVOR_V36[id];
 if(!persona||![0,1].includes(replyIndex))throw new Error('Unknown meal conversation');
 const {familiarity,affinity,realHits,recentInsults}=invitationProfileV34(run,id);
 const familiar=Math.min(familiarity,6),sensitivity=persona.sensitivity;
 const mineChance=clamp(.18+sensitivity+topicRisk[id][replyIndex]-familiar*.018-(affinity-50)*.001+Math.min(.20,realHits*.10)+Math.min(.12,recentInsults*.06),.06,.58);
 const warmChance=Math.min(1-mineChance-.12,clamp(.40-sensitivity*.7+(replyIndex===0?.06:.02)+familiar*.025+(affinity-50)*.0012-Math.min(realHits,2)*.05-Math.min(recentInsults,2)*.035,.18,.72));
 const reply=replyIndex===0?'normal':'wild';
 return {warmChance,mineChance,neutralChance:1-warmChance-mineChance,familiarity,affinity,reply,topic:persona[reply].topic};
}

export function withMealReactionsV36(event,run){
 if(!/^e36-/.test(run?.seed||'')||event?.kind!=='self-care'||!run.mealContext?.guest)return event;
 const id=run.mealContext.guest,persona=MEAL_FLAVOR_V36[id];
 if(!persona||event.id!==`meal-with-${id}`||event.speaker!==id)return event;
 return {...event,choices:event.choices.map((choice,replyIndex)=>{
  if(replyIndex>1||choice.effect!=='mealFinish'||!Number.isInteger(choice.mealCost)||choice.mealCost<1)return choice;
  const profile=mealChatProfileV36(run,id,replyIndex),flavor=persona[profile.reply];
  const gain=Math.min(12,7+Math.min(3,profile.familiarity)+(replyIndex===0?1:2));
  const loss=-clamp(6+Math.round(persona.sensitivity*20)+(replyIndex===1?2:0),4,12);
  const weights=[profile.warmChance,profile.neutralChance,profile.mineChance];
  return {...choice,draw:{label:'餐桌氣氛',outcomes:reactions.map(([reaction,label],at)=>{
   const affinityDelta=reaction==='warm'?gain:reaction==='mine'?loss:0;
   return {
    weight:weights[at],label,result:`${choice.result} ${flavor[reaction]}`,
    delta:{...choice.delta,...(id==='wing'?{boss:affinityDelta}:{})},
    mealOutcome:{version:1,target:id,replyIndex,reaction,affinityDelta}
   };
  })}};
 })};
}
