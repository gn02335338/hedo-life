import {CAST_IDS_V74,CAST_PROFILES_V74,isCastV74} from './cast-v74.js';
import {characterHistoryChanges} from './character-stats.js';
import {countsFriendlyPatronageEncounterV68} from './patronage-familiarity-v68.js';
import {MEAL_GUEST_IDS_V71,MEAL_EVENTS_V71,getMealEventV71} from './alice-interactions-v71.js';
import {mealPageIdV65} from './meals-cast-v65.js';

export const MEAL_GUEST_IDS_V74=Object.freeze([...MEAL_GUEST_IDS_V71,...CAST_IDS_V74]);
export const MEAL_EVENTS_V74=Object.freeze([...MEAL_EVENTS_V71,'meal-guests-e',...CAST_IDS_V74.map(id=>`meal-with-${id}`)]);
export const mealPageIdV74=page=>page===4?'meal-guests-e':mealPageIdV65(page);
const departments={system:'engineering',ai:'engineering',mis:'it',project:'project',product:'product',design:'product',bd:'business',sales:'sales',executive:'leadership',finance:'finance',accounting:'finance',hr:'people',admin:'admin'};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const empty=(text,effect,extra={})=>({text,detail:'',result:'',delta:{},flags:[],effect,...extra});
export function castInvitationProfileV74(run,id){
 const p=CAST_PROFILES_V74[id];if(!isCastV74(run)||!p)throw Error('Unknown v74 dinner guest');
 let familiarity=0,realHits=0,recentInsults=0,affinity=50;
 for(const change of characterHistoryChanges(run).filter(row=>row.id===id)){
  const row=run.history[change.historyIndex];affinity+=change.affinityDelta;realHits+=change.realHits;
  if(!change.imaginedHits&&!change.realHits&&!['rage','rage-world','verbal'].includes(row.kind)&&!row.verbalOutcome&&countsFriendlyPatronageEncounterV68(run,row))familiarity++;
  if(row.verbalOutcome&&change.affinityDelta<0&&Number.isInteger(row.turn)&&run.turn-row.turn<=3)recentInsults++;
 }
 const playerDepartment=departments[run.actualRoleId]||null,sameDepartment=p.department===playerDepartment||id==='mia'&&run.actualRoleId==='admin';
 const base=p.seniority==='director'?(sameDepartment?.24:.13):(sameDepartment?.56:.44),maximum=p.seniority==='director'?.68:.85;
 return {acceptChance:clamp(base+Math.min(familiarity,6)*.065+(affinity-50)*.004+.015*Math.max(0,(run.rank||0)-3)-Math.min(.75,realHits*.4)-Math.min(.30,recentInsults*.12),.03,maximum),affinity,familiarity,realHits,recentInsults,sameDepartment,playerDepartment,seniority:p.seniority};
}
export function castMealChatProfileV74(run,id,replyIndex){
 if(![0,1].includes(replyIndex))throw Error('Unknown v74 dinner reply');
 const p=CAST_PROFILES_V74[id],profile=castInvitationProfileV74(run,id),familiar=Math.min(profile.familiarity,6);
 const mineChance=clamp(.14+p.sensitivity+(replyIndex===1?.11:0)-familiar*.018-(profile.affinity-50)*.001+Math.min(.20,profile.realHits*.1)+Math.min(.12,profile.recentInsults*.06),.05,.54);
 const warmChance=Math.min(1-mineChance-.15,clamp(.48-(replyIndex===1?.04:0)+familiar*.025+(profile.affinity-50)*.0012-Math.min(2,profile.realHits)*.05-Math.min(2,profile.recentInsults)*.035,.18,.74));
 return {...profile,mineChance,warmChance,neutralChance:1-mineChance-warmChance};
}
const chats={
 wine:{title:'紅酒今天只接餐廳通知，不接系統告警。',body:'紅酒坐下先把工作群組靜音，確認這頓飯不是借晚餐外包值班。你們各自看菜單，名字不用再向服務生解釋成另一位主管。',quote:'今天先吃飯。真的要談工作，另外排時間。',normal:'聊最近想怎麼休息，工作細節等本人願意再談。',wild:'替白飯開一張零告警工單，服務等級只保證吃熱的。',flavor:[
 ['紅酒聊起最近終於準時做完的一件小事，也問你下班後怎麼過。兩人沒有把每一段停頓填成故障排查，晚餐難得真的留給自己。','你們交換幾個口味和近況，沒急著把所有事都聊完。這桌沒有告警，安靜吃熱飯也算完整的一餐。','你順口請他幫忙看一段工作訊息，紅酒把手機推回來。你把話題收回晚餐，後半餐的回答仍短了幾句。'],
 ['紅酒拿湯匙替工單簽收，附註加飯不算需求變更。你們把玩笑講完，白飯也準時交付，沒有第三輪主管驗收。','紅酒笑說飯快冷了，工單先別開。你把手機收起來，這輪玩笑剛好停在能好好吃飯的地方。','紅酒說今天不想連吃飯都演值班。你原本想逗他笑，卻又把他想放下的工單擺回桌上。']
 ]},
 peter:{title:'P神這餐沒有自動組隊。',body:'P神把手機放到旁邊，說今天可以聊遊戲，也可以什麼遊戲都不聊。你們先問想吃哪道菜，誰要加點都自己決定。',quote:'今天先吃飯，下一局等真的有空再說。',normal:'聊彼此願意分享的遊戲與生活，不追問辦公室傳聞。',wild:'替菜單開一個不用課金的副本，青菜保底真的會上桌。',flavor:[
 ['P神講起一個最近喜歡的玩法，也認真聽你說別的近況。手機整頓沒開新局，這桌卻多了幾段真的能接下去的話。','你們平常聊了幾句，飯也順順吃完。沒有每一段都很熱絡，今晚仍是一頓不用額外解釋的晚餐。','你把話題帶去問他跟誰比較熟，P神說今天不是關係盤點。你收回追問，才發現好好吃飯比知道誰跟誰怎樣更需要分寸。'],
 ['P神替青菜配了一段開箱音效，你替湯碗畫出補給點。你們笑完正常吃飯，副本沒有要求任何人加班。','P神笑著說一份主餐就夠，別再替整桌開任務。菜單收起來，晚餐也剛好回到舒服的速度。','P神今天想安靜吃，你卻每道菜都替他喊一次抽到什麼。你把音效收起來，這次玩笑已經比本人想玩的大聲。']
 ]},
 tony:{title:'8+9的晚餐，先不用揪全服。',body:'8+9挑好位置，說今天吃飯不用先找兩個陪同，也沒有早餐支線要臨時繞路。你們各點自己的餐，江湖消息留一點到本人想講的時候。',quote:'今天就這桌，別把普通吃飯排成公會出征。',normal:'聊他最近想玩的內容，也把自己的近況講一點。',wild:'替荷包蛋頒武林盟主，盟規只有不准替別人加點。',flavor:[
 ['8+9講完一段遊戲趣事，竟也耐心聽你說最近卡住什麼。這次沒有人被拖去另一家店，兩個人都把自己的飯吃完了。','你們聊了幾個遊戲和附近店家，話題沒有一路衝成大會。飯吃完各自回家，普通的一餐不用再找一句江湖結論。','你笑他是不是每次揪飯都有另一個目的，8+9把筷子停住。你只是想接梗，卻把這頓本人已說清楚的約又講成不可信。'],
 ['8+9替蛋黃加封號，你替青菜寫入門規，兩人越講越離譜。最後盟主只真的多分了一口菜，沒有替任何人多接一個任務。','8+9笑說盟主先別涼掉，你們各自把餐吃完。江湖沒有新增幫派，桌上倒是少了一盤剩菜。','8+9說自己今天不想連荷包蛋都被拿來演戲。你把盟主證書翻過去，這回需要先尊重的不是笑點，是對方想安靜吃飯。']
 ]},
 henry:{title:'老大這桌，不替下一季做技術決策。',body:'老大確認今晚是私人吃飯，沒有要你帶簡報或代替誰作主。你們先看菜單，想喝什麼各自選，沒有一杯需要替工作表態。',quote:'今天吃飯。有要談的工作，明天照正式時間來。',normal:'聊他願意分享的生活，先不問主管之間誰跟誰不合。',wild:'讓白開水當唯一技術委員，先審主餐到底能不能吃飽。',flavor:[
 ['老大講起一件工作之外的小事，也把問題問回來。你沒有把每句話拆成主管動向，這桌反而聊得比會議更直接。','你們普通聊了幾句，沒有把所有背景問完。飯吃完了，沒有新承諾，也沒有誰需要替私人聚餐補一份報告。','你順口追問他和翅膀到底誰對，老大把話停在這裡。你把問題收回去，才發現自己差點把晚餐變成一場要求站隊的會議。'],
 ['老大替水杯敲了一下桌面，宣布主餐需要先做實際驗證。你們笑著把菜分完，這次有結論，也沒有誰被追加工時。','老大笑說水杯先別主持，飯真的快冷了。你把玩笑收好，這桌很快又回到正常吃飯。','老大說今天不想再演技術審查，連水杯當主席都先不用。你原本想放鬆，卻又替他把整晚加上了熟悉的會議格式。']
 ]},
 mia:{title:'米雅的晚餐，沒有隨餐附個資表。',body:'米雅到場先問想坐哪邊，沒有拿出人資表格。你們只聊本人願意分享的近況，親切不用被解讀成什麼都能問。',quote:'今天先吃飯，想聊什麼都可以先問。',normal:'聊附近店家與下班安排，尊重她想保留的部分。',wild:'替湯碗寫一份最短同意書：我同意讓自己把湯喝熱。',flavor:[
 ['米雅講起自己喜歡的一間小店，也認真問你最近過得怎樣。你沒有把親切當成可以追問所有細節，兩人的話反而更自然地接下去。','你們安穩聊完餐點與幾段近況，沒有硬把每個停頓填滿。這餐沒有新增人事流程，也不需要熱絡到證明交情。','你以為熟了就連問幾個私人問題，米雅客氣地說今天先不談。你把問題收回來，才發現願意聊天和願意回答所有事是兩件事。'],
 ['米雅替湯匙畫了一個勾，宣布這份同意只管本人。你們笑完把湯喝熱，這次沒有一張紙要被轉寄給其他主管。','米雅笑說湯還是先喝，表格今天可以放假。你把餐巾收好，這輪玩笑沒占掉真正吃飯的時間。','米雅說今天不想再看到同意書，連湯碗也先不用填。你收起玩笑，讓後半餐不必繼續替白天的工作加班。']
 ]}
};
function invitation(run,id){
 const p=CAST_PROFILES_V74[id],flag=`meal_invite_${id}_day_${run.turn}`,asked=!!run.flags[flag],profile=castInvitationProfileV74(run,id);
 return empty(asked?`${p.name}今天已經問過了。`:`傳訊息約${p.name}吃飯（成行餐費 ${p.cost} 存款）`,'mealPick',{mealTarget:id,mealCost:p.cost,available:!asked&&run.stats.cash>=p.cost,draw:{label:'飯局邀請回覆',outcomes:[
  {weight:profile.acceptChance,label:'答應赴約',result:`${p.name}回覆今天剛好有空，先和你確認時間、地點。這次只答應吃飯，還沒有下單或付餐費。`,delta:{},flags:[flag],effect:'mealPick'},
  {weight:1-profile.acceptChance,label:'今天約不到',result:`${p.name}說今天已有自己的安排，這次先不赴約。你收起菜單，沒有用餐或付費，也沒有因為拒約自動扣一筆好感。`,delta:{},flags:[flag],effect:'mealDeclined'}
 ]}});
}
function dinner(run,id){
 if(run.mealContext?.page!==4||run.mealContext.guest!==id)throw Error('Invalid v74 dinner context');
 const p=CAST_PROFILES_V74[id],d=chats[id];
 return {id:`meal-with-${id}`,speaker:id,kind:'self-care',minRules:39,privateContext:true,requiresCastV74:true,era:'下班飯局',sourceIds:['castFictionV74','characterFiction'],title:d.title,body:d.body,wing:d.quote,choices:[...[d.normal,d.wild].map((text,replyIndex)=>{
  const profile=castMealChatProfileV74(run,id,replyIndex),delta={cash:-p.cost,mood:replyIndex?33:30,energy:replyIndex?14:16,trust:replyIndex?4:6,...(replyIndex?{slack:6}:{})},gain=Math.min(12,8+replyIndex+Math.min(3,profile.familiarity));
  return {text:`${text}（花費 ${p.cost} 存款）`,detail:'',result:'',delta,flags:['spend_mood','spend_network','meal_shared',`meal_guest_${id}`],effect:'mealFinish',mealCost:p.cost,available:run.stats.cash>=p.cost,...(replyIndex?{wild:true}:{}),draw:{label:'餐桌氣氛',outcomes:[['warm','聊得很開',profile.warmChance,gain],['neutral','平常吃飯',profile.neutralChance,0],['mine','不小心踩雷',profile.mineChance,replyIndex?-9:-6]].map(([reaction,label,weight,affinityDelta],at)=>({weight,label,result:d.flavor[replyIndex][at],delta:{...delta},mealOutcome:{version:1,target:id,replyIndex,reaction,affinityDelta}}))}};
 }),empty('今天先不吃，改天再約。','mealCancel',{result:`你向${p.name}說今天先取消，兩人收起菜單，沒有正式用餐或付餐費。`})]};
}
export function getMealEventV74(run){
 if(!isCastV74(run))return getMealEventV71(run);
 if(!['self-care','crisis-mood'].includes(run.mealContext?.origin))throw Error('Invalid v74 meal origin');
 const id=run.mealContext.guest;if(CAST_IDS_V74.includes(id)&&run.eventId===`meal-with-${id}`)return dinner(run,id);
 if(run.eventId==='meal-guests-e'){
  if(run.mealContext.page!==4||id!==null)throw Error('Invalid v74 dinner menu');
  return {id:'meal-guests-e',speaker:'self',kind:'self-care',minRules:39,privateContext:true,era:'找人吃飯',sourceIds:['castFictionV74','characterFiction'],title:'第五頁，先問本人今晚有沒有空。',body:'這裡有五位同事。熟悉程度、職位和這局的相處會影響回覆；不熟的主管通常更難約。成行後，選擇聊天才支付列明的餐費。',wing:`邀約名單 5 / 5 · 目前存款 ${run.stats.cash}`,choices:[...CAST_IDS_V74.map(guest=>invitation(run,guest)),empty('翻回第四頁，看看其他同事。','mealPage',{mealPage:3,result:'你翻回第四頁，沒有新增邀約或付餐費。'}),empty('回到第一頁，從前面再看看。','mealPage',{mealPage:0,result:'你翻回第一頁，沒有替任何人訂位。'}),empty('今天先不約，回去看看其他安排。','mealCancel',{result:'你收起名單，沒有新增飯局或付餐費。'})]};
 }
 const event=getMealEventV71(run),wing=typeof event.wing==='string'?event.wing.replace('/ 4','/ 5'):event.wing;
 return event.id==='meal-guests-d'?{...event,wing,choices:[...event.choices,empty('翻到第五頁，問問其他同事。','mealPage',{mealPage:4,result:'你翻到五位同事的名單，還沒有傳訊息或付餐費。'})]}:{...event,wing};
}
