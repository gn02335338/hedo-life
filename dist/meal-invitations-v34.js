import { PERSONAS } from './persona.js';
import { characterHistoryChanges } from './character-stats.js';

// The invitation belongs to this life. Archive totals and client-supplied
// relationship counters never influence a seeded reply.
const roleDepartments=Object.freeze({
 system:'engineering',ai:'engineering',mis:'it',project:'project',
 product:'product',design:'product',bd:'business',sales:'sales',
 executive:'leadership',finance:'finance',accounting:'finance',hr:'people',admin:'admin'
});
const guests=Object.freeze({
 wing:['leadership','ceo'],spencer:['leadership','chair'],erich:['legal','chief'],
 sonny:['it','colleague'],jenjen:['admin','chief'],rick:['engineering','manager'],
 kind:['engineering','manager'],hope:['people','chief'],jack:['engineering','manager'],
 meimei:['sales','manager'],helen:['product','director'],sophie:['finance','manager'],
 jonathan:['engineering','colleague'],owen:['business','director'],
 sam:['engineering','colleague'],cindy:['project','colleague']
});
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export function invitationProfileV34(run,id){
 if(!Object.hasOwn(guests,id))throw new Error('Unknown meal guest');
 const [department,seniority]=guests[id],playerDepartment=roleDepartments[run?.actualRoleId]||null;
 const changes=characterHistoryChanges(run).filter(change=>change.id===id);
 let familiarity=0,realHits=0,recentInsults=0,affinity=50;
 for(const change of changes){
  const row=run.history[change.historyIndex];
  affinity+=change.affinityDelta;realHits+=change.realHits;
  // Dreams, fights and their aftermaths are not friendly time together.
  if(!change.imaginedHits&&!change.realHits&&!['rage','rage-world','verbal'].includes(row.kind)&&!row.verbalOutcome)familiarity++;
  const recent=Number.isInteger(row.turn)&&Number.isInteger(run.turn)?run.turn-row.turn<=3:change.historyIndex>=run.history.length-6;
  if(recent&&row.verbalOutcome&&change.affinityDelta<0)recentInsults++;
 }
 const sameDepartment=department===playerDepartment,leader=['ceo','chair'].includes(seniority);
 const base=seniority==='ceo'?.08:seniority==='chair'?.06:seniority==='chief'?(sameDepartment?.20:.12):seniority==='director'?(sameDepartment?.24:.13):seniority==='manager'?(sameDepartment?.30:.17):(sameDepartment?.56:.44);
 const familiarityBonus=Math.min(familiarity,6)*(leader?.035:.065);
 const affinityBonus=(affinity-50)*(leader?.002:.004);
 const rankBonus=leader?.005*Math.max(0,(run?.rank||0)-3):.015*Math.max(0,(run?.rank||0)-3);
 const hitPenalty=Math.min(.75,realHits*.4),insultPenalty=Math.min(.30,recentInsults*.12);
 const maximum=seniority==='ceo'?.40:seniority==='chair'?.30:seniority==='chief'?.60:seniority==='director'?.68:seniority==='manager'?.80:.85;
 const acceptChance=clamp(base+familiarityBonus+affinityBonus+rankBonus-hitPenalty-insultPenalty,leader?.01:.03,maximum);
 return {acceptChance,familiarity,affinity,department,playerDepartment,sameDepartment,seniority,realHits,recentInsults};
}

const replies=Object.freeze({
 wing:[
  '翅膀回你：「剛好有空。吃飯可以，最近讀了什麼書，等一下講給我聽。」你先訂了位，還沒付錢，胃已經有點緊。',
  '翅膀回你：「我哪有那麼多時間吃飯？你先把工作做好。」你看著他剛傳來的讀書影片，把訂位頁關掉。今晚沒有約成，也沒有付餐費。'
 ],
 spencer:[
  '屎潘蛇回覆可以，順便問餐廳適不適合未來的掛牌慶功宴。你先約好時間；今天還沒掛牌，餐費也還沒付。',
  '屎潘蛇的行程窗口回覆：「董事長近期不便安排。」你本來只想約一碗麵，現在知道它還需要列入議程。沒有訂位，也沒有付餐費。'
 ],
 erich:[
  '法師回你：「可以，先說好，菜單不用帶三份。」你們約好附近碰面，這次沒有附件，餐費也還沒付。',
  '法師回覆：「今天不方便，改天再說。」訊息沒有附上可供討論的條款，你也沒追問。這次沒有約成，餐費留在口袋。'
 ],
 sonny:[
  '阿福先問店裡的椅子高不高，再問筷子重不重，最後總算答應。你們約好時間，今天先吃普通份量，餐費還沒付。',
  '阿福連傳三則訊息：今天有點累、午餐吃太飽、那家店的碗可能不適合。你還沒問要不要換店，他已宣布改天。沒有用餐，也沒有付錢。'
 ],
 jenjen:[
  '真真答應了，還特別確認這次不是要她統計全公司的訂餐。你說只有兩個人，她才把時間敲下來；餐費還沒付。',
  '真真說今天的行程已經排滿，沒辦法一起吃。你把她從訂餐統計裡放過，也把自己從等待名單裡放過。這次沒有花餐費。'
 ],
 rick:[
  '瑞克隔了好一會兒回：「可以，電話有來我還是要接喔。」你替兩個人訂位，手機不算一位；餐費還沒付。',
  '瑞克回你：「我在等老闆電話，下次啦。」電話還沒響，他已先替今晚保留待命席。你沒有訂位，也沒有付餐費。'
 ],
 kind:[
  '阿良說可以，還問吃完要不要續攤。你先把餐廳和碰面時間問清楚；這次約好的是晚餐，餐費還沒付。',
  '阿良回了一串「改天一定」，接著就沒有下文。你等到手機自動鎖定，決定不替這頓尚未成行的飯找續攤。沒有付餐費。'
 ],
 hope:[
  '希望回你：「可以，這次不用寫自評。」你先把餐廳地址傳過去，確定今天不是臨時會談；餐費還沒付。',
  '希望回覆：「今天沒有空檔，謝謝邀請。」你沒有把晚餐改寫成可衡量目標，也沒有繼續追問。這次沒有約成，不扣餐費。'
 ],
 jack:[
  '傑克說好，問你有沒有特別想吃的。你終於可以先回答這個問題，不用先交代前情；兩個人約好時間，餐費還沒付。',
  '傑克說今晚有事，沒辦法陪你吃，最後補一句：「你還是要記得吃飯。」你把店家收藏起來，這次沒有訂位，也沒有付錢。'
 ],
 meimei:[
  '水蛇答應了，先聲明今晚只吃飯，不跟誰比 First Love。你們約好餐廳，麥克風不用訂，餐費還沒付。',
  '水蛇說今晚另有安排，這場先不加入。你沒有把邀約變成業績追蹤，也沒再追加一輪說服。沒有用餐，不扣餐費。'
 ],
 helen:[
  '前女友說可以，但吃飯就是吃飯，別再多一個待確認。你們把時間地點一次講完，餐費還沒付。',
  '前女友回你：「今天不行，手上的事還沒結束。」你沒有再補一句「那順便聊交接」，把對話停在這裡。沒有約成，也沒有付錢。'
 ],
 sophie:[
  '紅茶答應了，提醒你她喝紅茶，其他傳聞不列入菜單。你們約好下班碰面，餐費還沒付。',
  '紅茶說今天不方便，改天有空再約。你沒有請印表機代為安排，也沒有替這句話加上任何傳聞。這次沒有付餐費。'
 ],
 jonathan:[
  '強哥先說安排聚餐不是助理工程師的工作，聽到你已找好店才說可以。你們約好各點各的，餐費還沒付。',
  '強哥回你：「我是助理工程師耶，又不是陪吃飯工程師。」你決定不替這句話開需求單，今晚先各自吃。沒有付餐費。'
 ],
 owen:[
  '歐文答應了，問你吃完還能不能走一段。你先把晚餐地點確定下來，離職倒數可以等上菜再聊；餐費還沒付。',
  '歐文說今晚已有安排，墨鏡和人都不會到。你收起還沒傳出去的菜單，這回沒有離職倒數，也沒有餐費。'
 ],
 sam:[
  '山姆答應了，附帶問你最近看到哪一季。你先確認他說的是影集，不是讀書進度；飯約好了，餐費還沒付。',
  '山姆回你今天不出門，下一集快開始了。你沒有跟片尾倒數競標他的時間，這次沒有約成，也沒有付餐費。'
 ],
 cindy:[
  '辛蒂說可以，餐廳你選就好，不用再等下一位主管核准。你們直接敲好時間，餐費還沒付。',
  '辛蒂說今天行程排不進去，先不要等她。你讓這頓飯保留正常的結束，沒有替它多開追蹤會。沒有用餐，不扣餐費。'
 ]
});

export function withMealInvitationsV34(event,run){
 if(!/^e(?:34|35|36|37|38)-/.test(run?.seed||'')||!['meal-guests-a','meal-guests-b'].includes(event?.id))return event;
 return {...event,
  body:`${run.mealContext?.origin==='crisis-mood'?'你想找個人陪自己喘口氣，先打開聯絡名單。':'你打開聯絡名單，想找個人一起吃晚餐。'}先傳訊息問時間，對方不一定會答應；不熟的人、高層與別部門主管，通常更難約。邀約不花錢，正式用餐才付餐費。同一天每人只問一次，沒約成可以換人，也可以自己吃，不必等誰回覆。`,
  choices:[...event.choices.map(choice=>{
   const id=choice.mealTarget;
   if(!Object.hasOwn(guests,id))return choice;
   const flag=`meal_invite_${id}_day_${run.turn}`,attempted=Number(run.flags?.[flag]||0)>0;
   const {acceptChance}=invitationProfileV34(run,id),[accepted,declined]=replies[id];
   const outcome=(weight,label,result,effect)=>({weight,label,result,delta:{},flags:[flag],effect});
   return {...choice,
    text:attempted?`${PERSONAS[id].name}今天已經問過了。`:`傳訊息約${PERSONAS[id].name}吃飯（成行餐費 ${choice.mealCost} 存款）`,
    result:'',delta:{},flags:[],available:!attempted&&run.stats.cash>=choice.mealCost,
    draw:{label:'飯局邀請回覆',outcomes:[
     outcome(acceptChance,'答應赴約',accepted,'mealPick'),
     outcome(1-acceptChance,'今天約不到',declined,'mealDeclined')
    ]}
   };
  }),{
   text:'自己買便當，請筷子擔任陪吃顧問。（花費 8 存款）',detail:'',
   result:'你不再等下一則回覆，買了便當坐下來吃。筷子沒有檢查你的學歷，也不會把休息列入改善計畫。沒有約到人，這頓飯仍然可以好好吃完。',
   delta:{cash:-8,mood:22,energy:12},effect:'mealFinish',flags:['spend_mood','spend_solo'],mealCost:8,available:run.stats.cash>8
  }]
 };
}
