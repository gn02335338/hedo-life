// Original consultant dinner scenes. The professor is an external guest, not a
// new manager with invented authority over the player's pay or employment.
import {characterHistoryChanges} from './character-stats.js';
import {MEAL_GUEST_IDS_V25,MEAL_EVENTS_V25,getMealV25} from './meals-v25.js';
import {withMealInvitationsV34} from './meal-invitations-v34.js';
import {withMealReactionsV36} from './meal-reactions-v36.js';

export const PROFESSOR_ID_V37='professor';
export const MEAL_GUEST_IDS_V37=Object.freeze([...MEAL_GUEST_IDS_V25,PROFESSOR_ID_V37]);
export const MEAL_EVENTS_V37=Object.freeze([...MEAL_EVENTS_V25,'meal-guests-c','meal-with-professor']);
export const mealPageIdV37=page=>['meal-guests-a','meal-guests-b','meal-guests-c'][page]||null;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const empty=(text,effect,extra={})=>({text,detail:'',result:'',delta:{},flags:[],effect,...extra});
const name='林澤教授',cost=18;

export function professorInvitationProfileV37(run){
  const changes=characterHistoryChanges(run).filter(row=>row.id===PROFESSOR_ID_V37);
  let affinity=50,familiarity=0,realHits=0,recentInsults=0;
  for(const change of changes){
    const row=run.history[change.historyIndex];affinity+=change.affinityDelta;realHits+=change.realHits;
    if(!change.imaginedHits&&!change.realHits&&!['rage','rage-world','verbal'].includes(row.kind)&&!row.verbalOutcome)familiarity++;
    if(row.verbalOutcome&&change.affinityDelta<0&&Number.isInteger(row.turn)&&run.turn-row.turn<=3)recentInsults++;
  }
  const researchRole=['ai','system','product'].includes(run?.actualRoleId);
  const acceptChance=clamp((researchRole?.14:.10)+Math.min(familiarity,6)*.055+(affinity-50)*.003-Math.min(.65,realHits*.4)-Math.min(.3,recentInsults*.12),.02,.62);
  return {acceptChance,affinity,familiarity,realHits,recentInsults,department:'academia',sameDepartment:false,seniority:'external-consultant'};
}

export function professorMealChatProfileV37(run,replyIndex){
  if(![0,1].includes(replyIndex))throw new Error('Unknown professor meal conversation');
  const {affinity,familiarity,realHits,recentInsults}=professorInvitationProfileV37(run);
  const familiar=Math.min(familiarity,6);
  const mineChance=clamp(.18+(replyIndex===1?.12:0)-familiar*.018-(affinity-50)*.001+Math.min(.20,realHits*.1)+Math.min(.12,recentInsults*.06),.06,.52);
  const warmChance=Math.min(1-mineChance-.15,clamp(.46-(replyIndex===1?.04:0)+familiar*.025+(affinity-50)*.0012-Math.min(2,realHits)*.05-Math.min(2,recentInsults)*.035,.18,.72));
  return {warmChance,neutralChance:1-warmChance-mineChance,mineChance,affinity,familiarity,reply:replyIndex===0?'normal':'wild',topic:replyIndex===0?'先吃飯，研究問題明天談':'白飯的參考文獻'};
}

const flavor={
  normal:{
    warm:'林澤教授聽你說完，沒有把每個煩惱都變成一道研究題。他也提起今天忙到忘了吃飯，你們交換了兩家小店的口味，這次記住的不只有誰該補哪一段實驗。',
    neutral:'林澤教授把筷子拿起來，話題停在附近的店和天氣。你們沒有交換新的研究承諾，也沒有突然變熟；今天只是一頓能完整吃完、不需要補附錄的飯。',
    mine:'你說研究問題明天再談，林澤教授以為你在婉拒剛才的建議。你補充只是想好好吃飯，他也點頭，後半餐卻客氣了些；同一句界線，還是可能被聽成另一種意思。'
  },
  wild:{
    warm:'林澤教授替白飯補上一筆引用，作者寫農夫，年份寫剛剛。他又請湯匙說明取樣方法，你們把這場小口試演完，終於有一句不需要翅膀轉述的共同笑話。',
    neutral:'林澤教授看完白飯的引用，笑了一下就把飯吃完。玩笑順利結案，沒有衍生成新的作業；你們都保留了自己的安靜，今晚的參考文獻只有餐廳地址。',
    mine:'白飯的引用越寫越長，林澤教授問你是不是覺得研究只是補格式。你原本只想開玩笑，卻還得解釋自己沒有在笑他的工作；這次湯匙沒有答辯，換你重新找一句合適的話。'
  }
};

function professorDinner(run){
  const context=run.mealContext;
  if(context?.guest!==PROFESSOR_ID_V37||context.page!==2)throw new Error('Invalid professor dinner');
  const answers=[
    ['把研究問題留到明天，先聊附近好吃的店。','你把帶來的筆記收好，這一餐先不請誰代寫需求。林澤教授看了一眼菜單，你也終於能回答自己想吃什麼。',{cash:-cost,mood:30,energy:16,trust:6}],
    ['替白飯補上參考文獻，邀請湯匙擔任第二作者。','你在餐巾角落寫下白飯的引用格式，湯匙暫列共同作者。林澤教授接過餐巾，晚餐多了一份不必帶回辦公室的草稿。',{cash:-cost,mood:33,energy:14,trust:4,slack:6}]
  ];
  return {
    id:'meal-with-professor',speaker:PROFESSOR_ID_V37,kind:'self-care',minRules:37,era:'下班飯局',sourceIds:['schoolLore','characterFiction'],
    title:'飯先吃熱的，研究不必趁熱交。',
    body:'林澤教授把一疊筆記放進包裡，說今天先吃飯。你想起公司總有人把顧問說法轉成明天的交期，差點又把工作單拿出來。他指了指菜單，這次等你回答的是口味。',
    wing:'可以問問題，但這頓飯不用先交研究計畫。',
    choices:[...answers.map(([text,result,delta],replyIndex)=>{
      const profile=professorMealChatProfileV37(run,replyIndex),gain=Math.min(12,8+replyIndex+Math.min(3,profile.familiarity)),loss=replyIndex===0?-6:-9;
      return {text:`${text}（花費 ${cost} 存款）`,detail:'',result:'',delta,flags:['spend_mood','spend_network','meal_shared','meal_guest_professor'],effect:'mealFinish',mealCost:cost,available:run.stats.cash>=cost,...(replyIndex===1?{wild:true}:{}),draw:{label:'餐桌氣氛',outcomes:[['warm','聊得很開',profile.warmChance,gain],['neutral','平常吃飯',profile.neutralChance,0],['mine','不小心踩雷',profile.mineChance,loss]].map(([reaction,label,weight,affinityDelta])=>({weight,label,result:`${result} ${flavor[profile.reply][reaction]}`,delta:{...delta},mealOutcome:{version:1,target:PROFESSOR_ID_V37,replyIndex,reaction,affinityDelta}}))}};
    }),empty('今天先不吃，改天再約。','mealCancel',{result:'你說今天不適合坐下來吃飯，林澤教授收起菜單，請你不用急著另訂日期。這次沒有用餐，也沒有付餐費。'})]
  };
}

function professorMenu(run){
  const context=run.mealContext;
  if(context?.page!==2||context.guest!==null)throw new Error('Invalid professor meal menu');
  const flag=`meal_invite_professor_day_${run.turn}`,attempted=Number(run.flags?.[flag]||0)>0,{acceptChance}=professorInvitationProfileV37(run);
  const invitation=empty(attempted?'林澤教授今天已經問過了。':`傳訊息約${name}吃飯（成行餐費 ${cost} 存款）`,'mealPick',{
    mealTarget:PROFESSOR_ID_V37,mealCost:cost,available:!attempted&&run.stats.cash>=cost,
    draw:{label:'飯局邀請回覆',outcomes:[
      {weight:acceptChance,label:'答應赴約',result:'林澤教授回覆剛好有空，先問你有沒有不吃的東西。你們把時間和地點約好，研究問題不用先寄，餐費也還沒付。',delta:{},flags:[flag],effect:'mealPick'},
      {weight:1-acceptChance,label:'今天約不到',result:'林澤教授回覆今天另有安排，請你別等他。他沒有派一道閱讀作業補償缺席，你也沒有替這頓飯留空位；這次沒有付餐費。',delta:{},flags:[flag],effect:'mealDeclined'}
    ]}
  });
  return {id:'meal-guests-c',speaker:'self',kind:'self-care',minRules:37,era:'找人吃飯',sourceIds:['characterFiction'],title:'翻到顧問這一頁，先問時間。',body:'外部顧問不會因為在公司名單裡，就隨時有空陪吃飯。不熟時尤其難約，這局聊過的事與留下的印象會影響回覆。先問一次，約不成就換個安排；正式用餐才會付餐費。',wing:`邀約名單 3 / 3 · 目前存款 ${run.stats.cash}`,choices:[
    invitation,
    empty('回到第一頁，看看其他人。','mealPage',{mealPage:0,result:'你回到第一頁名單，沒有新增邀約，也沒有付錢。'}),
    empty('先不約，回去看看還能怎麼安排。','mealCancel',{result:'你把顧問這一頁收起來，這次沒有邀誰，也沒有花餐費。'}),
    empty('自己買便當，請筷子擔任陪吃顧問。（花費 8 存款）','mealFinish',{result:'你把邀約頁收起來，買了便當慢慢吃。筷子不用查行事曆，也不會請白飯補研究動機；今天一樣能吃一頓屬於自己的飯。',delta:{cash:-8,mood:22,energy:12},flags:['spend_mood','spend_solo'],mealCost:8,available:run.stats.cash>8})
  ]};
}

export function getMealEventV37(run){
  if(!/^e(?:37|38)-/.test(run?.seed||'')||!['self-care','crisis-mood'].includes(run.mealContext?.origin))throw new Error('Invalid v37 meal context');
  if(run.eventId==='meal-guests-c')return professorMenu(run);
  if(run.eventId==='meal-with-professor')return professorDinner(run);
  const event=withMealReactionsV36(withMealInvitationsV34(getMealV25(run),run),run);
  if(run.eventId==='meal-guests-b')return {...event,wing:`邀約名單 2 / 3 · 目前存款 ${run.stats.cash}`,choices:event.choices.map(choice=>choice.effect==='mealPage'?{...choice,text:'翻到下一頁，看看顧問有沒有空。',mealPage:2,result:'你翻到顧問這一頁，還沒有傳訊息，也沒有付錢。'}:choice)};
  if(run.eventId==='meal-guests-a')return {...event,wing:`邀約名單 1 / 3 · 目前存款 ${run.stats.cash}`};
  return event;
}
