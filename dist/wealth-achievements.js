// Shared display and replay-derived goals. Neither a supplied badge ID nor an
// ending/flag on its own proves that the player committed to a departure.
const badge=(id,title,description)=>Object.freeze({id,title,description,group:'wallet',image:`./assets/achievements/${id}.svg`});
export const WEALTH_ACHIEVEMENTS=Object.freeze([
 badge('wealth-startup-success','第一張帳單，真的有人付。','離職創業後，讓工作室或玩具鵝生意站穩第一步。這次進帳的不是願景，是客戶真的付的錢。'),
 badge('wealth-startup-failure','收攤，也算有把門帶上。','離職創業沒有成功，在生活預備金用完以前收攤。帳算完了，下一次不用再把稱讚當訂單。'),
 badge('wealth-goose-chairman','玩具鵝董事長','讓玩具鵝主持董事會，通過自己的永久休假案。全場沒有臨時動議，董事長只負責叫一聲。'),
 badge('wealth-retired-free','爽爽退休，鬧鐘自己辭職。','存好離開的底氣，交回門禁卡，正式退休。明天醒來的第一件事，是確認今天不用做第一件事。')
]);

const resolved=row=>row?.kind==='career'&&row.speaker==='self'&&Number.isInteger(row.choiceIndex)&&row.choiceIndex>=0&&typeof row.result==='string'&&Boolean(row.result.trim())&&Array.isArray(row.breakdown);
const paid=(row,cost)=>row.delta?.cash===-cost&&row.breakdown.some(part=>part?.source==='choice'&&part.delta?.cash===-cost);
const noSpend=row=>row.delta?.cash===0&&row.breakdown.every(part=>part?.delta&&(part.delta.cash===undefined||part.delta.cash===0));

export function deriveWealthAchievements(run){
 if(!/^e(?:27|28|29|30|31)-/.test(run?.seed||''))return [];
 const history=Array.isArray(run.history)?run.history:[],ids=new Set();
 for(const row of history){
  if(!resolved(row))continue;
  if(row.eventId==='wealth-startup'&&[0,1].includes(row.choiceIndex)&&paid(row,row.choiceIndex===0?35:40)){
   if(row.chanceOutcome==='success')ids.add('wealth-startup-success');
   if(row.chanceOutcome==='setback')ids.add('wealth-startup-failure');
  }
  if(row.eventId==='wealth-retire'&&[0,2].includes(row.choiceIndex)&&row.chanceOutcome===null&&noSpend(row)){
   ids.add('wealth-retired-free');
   if(row.choiceIndex===2)ids.add('wealth-goose-chairman');
  }
 }
 return WEALTH_ACHIEVEMENTS.filter(item=>ids.has(item.id)).map(item=>item.id);
}
