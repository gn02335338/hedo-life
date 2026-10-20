// Resource rules for e18 runs. Keep randomness in the engine: these helpers
// transform supplied values without consuming a replay's RNG or changing it.
export const ABILITY_KEYS_V18=Object.freeze(['skill','slack','lick']);
export const ABILITY_BUDGET_V18=180;
const clamp=value=>Math.max(0,Math.min(100,Number.isFinite(value)?Math.round(value):0));

export function normalizeAbilitiesV18(stats){
 const next={...stats};
 for(const key of ABILITY_KEYS_V18)next[key]=clamp(stats[key]);
 const total=ABILITY_KEYS_V18.reduce((sum,key)=>sum+next[key],0);
 if(total<=ABILITY_BUDGET_V18)return next;
 // Largest remainders keep the original proportions without rounding the
 // combined ability score above the budget. Key order resolves exact ties.
 const shares=ABILITY_KEYS_V18.map((key,index)=>({key,index,value:next[key]*ABILITY_BUDGET_V18/total}));
 for(const share of shares)next[share.key]=Math.floor(share.value);
 const spare=ABILITY_BUDGET_V18-ABILITY_KEYS_V18.reduce((sum,key)=>sum+next[key],0);
 shares.sort((a,b)=>(b.value-Math.floor(b.value))-(a.value-Math.floor(a.value))||a.index-b.index);
 for(let index=0;index<spare;index++)next[shares[index].key]++;
 return next;
}

// Call once after all authored outcomes, bonuses and clamps. The correction
// belongs in the outcome ledger, so the player sees the actual tradeoff.
export function abilityRebalanceV18(before,after){
 const target={...after};
 const focus=ABILITY_KEYS_V18.map((key,index)=>({key,index,gain:clamp(after[key])-clamp(before[key])}))
  .filter(item=>item.gain>0).sort((a,b)=>b.gain-a.gain||a.index-b.index)[0];
 if(focus){
  const cost=Math.ceil(focus.gain*.5);
  for(const key of ABILITY_KEYS_V18)if(key!==focus.key)target[key]=Math.min(clamp(target[key]),Math.max(0,clamp(before[key])-cost));
 }
 const normalized=normalizeAbilitiesV18(target);
 return Object.fromEntries(ABILITY_KEYS_V18.map(key=>[key,normalized[key]-clamp(after[key])]));
}

const purchase=(cash,cost,text,result,delta,flags)=>({
 text:`${text}（花費 ${cost} 存款）`,detail:'',result,
 delta:{cash:-cost,...delta},flags,effect:'finishBreak',available:cash>=cost
});

export function getSelfCareV18(run){
 const cash=run.stats.cash;
 return {
  id:'self-care',kind:'self-care',speaker:'self',era:'下班自救',sourceIds:['characterFiction'],
  title:'這筆錢，先不要拿來撐公司。',
  body:'存款不是只能陪你一起上班。你打開今天的空檔，想替自己買點休息、學點東西，或替下一步做準備。錢花出去就會扣掉，買什麼由你決定。',
  wing:'今天這筆預算，不需要翅膀簽核。',
  choices:[
   purchase(cash,8,'買杯喜歡的飲料，繞遠路回家。','你挑了平常嫌貴的那杯，沿著不用經過公司的路慢慢走。冰塊融完了，腦中的會議也終於散了。',{mood:30,energy:6},['spend_mood']),
   purchase(cash,12,'訂安靜的房間，補一場沒人叫醒的覺。','門一關，通知全靜音。這次醒來是因為睡夠了，不是因為有人在群組問「在嗎」。',{mood:12,energy:42},['spend_energy']),
   purchase(cash,18,'上自己選的實作課，把公司的事留在公司。','你花時間把一個問題真的弄懂，還做出能跑的東西。課程沒有要求你先讚美講師，這點已經比白天輕鬆多了。',{skill:14,mood:5,energy:-8},['spend_training']),
   purchase(cash,14,'買備份空間，把信件與工作紀錄整理好。','你把交付、指示、改口的日期各自歸檔，再留一份備份。檔案不會替你吵架，但下次有人說「我沒講過」，你至少不用只靠記憶。',{mood:16,trust:3},['spend_evidence','evidence','archive']),
   purchase(cash,16,'請老同學吃飯，聊聊公司外面的工作。','你們先聊近況，才聊職缺。對方傳來幾個連結，也說有需要可以介紹人認識；原來外面的世界還有別種開會方式。',{mood:18,trust:18},['spend_network','alumni_links']),
   purchase(cash,30,'留一整個週末給自己，吃飽、睡好、手機關機。','住宿、車票和好好吃飯的錢都付了。兩天裡你沒解釋過一次自己的產值；回來時工作還在，但你已經不再跟著每個通知一起抖。',{mood:50,energy:40},['spend_sabbatical']),
   purchase(cash,20,'包練團室，請玩具鵝擔任主管做績效檢討。','你報告完本週進度，按下玩具鵝。牠只回了一聲，沒加新需求。你們一致通過縮短會議，剩下的時間練習如何安靜放空。',{mood:38,energy:12,slack:10},['spend_mood','goose_manager']),
   {text:'先把錢留著，回去處理原本的事。',detail:'',result:'你把這些安排先留在清單上，今天沒有花錢。原本的事還在，你也還能決定下一步。',delta:{},flags:[],effect:'cancelBreak',available:true}
  ]
 };
}

// The supplied draw is one deterministic engine roll in [0,1). This pulse is
// separate from the ordinary workday drain and never changes boss sentiment.
export function moodEnergyPulseV18(draw){
 if(draw<.25)return {label:'今天特別耗人',text:'臨時插進來的事把休息時間吃掉了。你下班時連電梯裡的音樂都嫌吵。',delta:{mood:-10,energy:-7}};
 if(draw<.5)return {label:'瑣事連環來',text:'每件事都說只要五分鐘，湊在一起卻吃掉整段空檔。',delta:{mood:-4,energy:-5}};
 if(draw<.75)return {label:'人坐著，火還在',text:'會議取消讓你少跑一趟，但群組裡那句話還是讓你越想越氣。',delta:{mood:-6,energy:3}};
 return {label:'今天有一小段順風',text:'交辦比預期早結束，同事剛好替你擋下一輪追問。你空出一段時間，終於能好好吃飯。',delta:{mood:12,energy:10}};
}
