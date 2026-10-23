import {CAST_IDS_V39,CAST_PROFILES_V39} from './cast-v39.js';
import {characterHistoryChanges} from './character-stats.js';
import {MEAL_GUEST_IDS_V37,MEAL_EVENTS_V37,mealPageIdV37,getMealEventV37} from './professor-v37.js';
import {getPrincessDinnerV62} from './princess-dinner-v62.js';
export {CAST_IDS_V39} from './cast-v39.js';
export const MEAL_GUEST_IDS_V39=Object.freeze([...MEAL_GUEST_IDS_V37,...CAST_IDS_V39]);
export const MEAL_EVENTS_V39=Object.freeze([...MEAL_EVENTS_V37,...CAST_IDS_V39.map(id=>`meal-with-${id}`)]);
export const mealPageIdV39=mealPageIdV37;
const departments={system:'engineering',ai:'engineering',mis:'it',project:'project',product:'product',design:'product',bd:'business',sales:'sales',executive:'leadership',finance:'finance',accounting:'finance',hr:'people',admin:'admin'};
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const empty=(text,effect,extra={})=>({text,detail:'',result:'',delta:{},flags:[],effect,...extra});
const mealData=(run,id)=>id==='princess'&&getPrincessDinnerV62(run)||data[id];
export function castMealCostV39(run,id){const p=CAST_PROFILES_V39[id];if(!p)throw new Error('Unknown cast dinner guest');return id==='princess'&&getPrincessDinnerV62(run)?.cost||p.cost;}

export function castInvitationProfileV39(run,id){
 const p=CAST_PROFILES_V39[id];if(!p)throw new Error('Unknown cast dinner guest');
 let familiarity=0,realHits=0,recentInsults=0,affinity=50;
 for(const change of characterHistoryChanges(run).filter(row=>row.id===id)){
  const row=run.history[change.historyIndex];affinity+=change.affinityDelta;realHits+=change.realHits;
  if(!change.imaginedHits&&!change.realHits&&!['rage','rage-world','verbal'].includes(row.kind)&&!row.verbalOutcome)familiarity++;
  if(row.verbalOutcome&&change.affinityDelta<0&&Number.isInteger(row.turn)&&run.turn-row.turn<=3)recentInsults++;
 }
 const playerDepartment=departments[run?.actualRoleId]||null,sameDepartment=p.department===playerDepartment||id==='captain'&&['hr','admin'].includes(run?.actualRoleId);
 const base=p.seniority==='director'?(sameDepartment?.24:.13):p.seniority==='manager'?(sameDepartment?.30:.17):id==='princess'?(sameDepartment?.36:.25):(sameDepartment?.56:.44);
 const maximum=p.seniority==='director'?.68:p.seniority==='manager'?.80:id==='princess'?.72:.85;
 const acceptChance=clamp(base+Math.min(familiarity,6)*.065+(affinity-50)*.004+.015*Math.max(0,(run?.rank||0)-3)-Math.min(.75,realHits*.4)-Math.min(.30,recentInsults*.12),.03,maximum);
 return {acceptChance,affinity,familiarity,realHits,recentInsults,department:p.department,playerDepartment,sameDepartment,seniority:p.seniority};
}
export function castMealChatProfileV39(run,id,replyIndex){
 if(![0,1].includes(replyIndex))throw new Error('Unknown cast dinner reply');
 const {affinity,familiarity,realHits,recentInsults}=castInvitationProfileV39(run,id),familiar=Math.min(familiarity,6),p=CAST_PROFILES_V39[id];
 const mineChance=clamp(.14+p.sensitivity+(replyIndex===1?.11:0)-familiar*.018-(affinity-50)*.001+Math.min(.20,realHits*.1)+Math.min(.12,recentInsults*.06),.05,.54);
 const warmChance=Math.min(1-mineChance-.15,clamp(.48-(replyIndex===1?.04:0)+familiar*.025+(affinity-50)*.0012-Math.min(2,realHits)*.05-Math.min(2,recentInsults)*.035,.18,.74));
 return {warmChance,neutralChance:1-warmChance-mineChance,mineChance,affinity,familiarity,reply:replyIndex===0?'normal':'wild',topic:topics[id][replyIndex]};
}
const topics={annie_yu:['今晚沒有代辦主管的事','替手機設主管訊息宵禁'],princess:['不帶家譜與校名的晚餐','白飯的平等驗收'],joyce:['同學也可以不用談工作','取消總監套餐頭銜費'],janet:['各付各的普通晚餐','讓湯匙申請自己的預算'],captain:['自己選一間合口味的小店','筷子船員不准超賣']};
const data={
 annie_yu:{title:'助理下班了，主管的待辦先別進門。',body:'安妮余把手機翻過來，說今晚先不要講誰又請她幫忙。你們坐在普通的小店，不用替歐文等下一個新方向，也不用代替另一個同名安妮接電話。',quote:'你想吃什麼就說，這次不用先問主管。',normal:'聊自己最近喜歡的小店，不替任何人接工作。',wild:'替手機頒布主管訊息宵禁，筷子負責守門。',accept:'安妮余說剛好有空，先確認這次沒有歐文臨時加的一席。兩人約好碰面，還沒付餐費。',decline:'安妮余回覆今天另有安排，先不等她。你沒有再轉寄一份行事曆，這次不扣餐費。',flavor:{normal:['她講起自己真正想做的事，你也沒有順手替她排進度。今晚的幫忙只是互相遞了一次醬料，兩邊都覺得剛好。','你們交換幾家店名，沒有把近況全講開。飯吃得完整，交情留在下一次慢慢長。','你隨口問起歐文的新方向，她以為又要替主管回話。你解釋只是好奇，後半餐卻得花幾句把工作請回門外。'],wild:['安妮余把宵禁時間畫在紙巾上，連想像中的歐文也得明天再來。你們笑著把手機收好，今晚第一次沒有誰只是代理出席。','手機沒有真的被關，她看完玩笑就專心吃飯。這個小制度留在桌上，沒有變成新的共同任務。','她問你是不是也覺得她只會轉訊息。你把玩笑收回一半，才發現她今天最不想再演的，就是那個被當成轉接台的位置。']}},
 princess:{title:'今晚先當吃飯的人，不當誰的女兒。',body:'公主說最近想讀的東西很多，公司的問題卻總先繞去問背景。你們約好這餐只談自己願意談的事，醫科的念頭與程式的困擾都不用拿來當誰的宣傳。',quote:'你可以直接問我怎麼想，不用先猜我爸會怎麼說。',normal:'問她最近喜歡什麼，讓她自己選要講的部分。',wild:'替白飯訂平等驗收：誰都不能靠家譜多拿一顆蛋。',accept:'公主回覆可以，想找一間能安靜吃完飯的店。你們先約好時間，不拿學校或家人當入場券。',decline:'公主說今天想自己休息，這次先不赴約。你收起訂位頁，沒有追問她的行程，也不扣餐費。',flavor:{normal:['她把一件自己真的在意的事說完，你沒有替它下職涯結論。你也講了最近的困擾，兩個人都短暫離開了公司替自己安排的位置。','話題停在書、飯和最近睡得怎樣。你們沒有交換人生答案，也沒有覺得一定得交換才算吃過飯。','你多問一句未來打算，她卻聽成又要替她判斷適合哪條路。你放下追問，桌上的距離還是稍微拉開了。'],wild:['公主把雞蛋平分，說這個驗收她願意簽。你們替白飯守住同一套規則，笑點沒有再把她推回需要解釋身分的位置。','公主笑了一下，照原本份量把飯吃完。白飯的制度很平等，兩個人今天仍只熟到能一起開這個玩笑。','公主說她今天其實不想再聽家譜。你沒有惡意，卻把她想離開的話題又帶上桌，只好讓雞蛋先替大家安靜一下。']}},
 joyce:{title:'總監也會餓，晚餐不用先報好消息。',body:'914把工作通知關掉，說今天不開簡報。你想起水蛇提過以前同學聊天的節奏，這次沒有替誰重演舊交情，只準備聽眼前的人現在想說什麼。',quote:'這餐不用交管線預測，吃完也不用寄會議紀錄。',normal:'聊下班後的生活，不替同學關係評分。',wild:'請菜單取消總監套餐的頭銜費，白飯一律平價。',accept:'914回覆今晚有個空檔，請你直接傳餐廳地址。你們確定這是兩人吃飯，還沒有餐費或工作承諾。',decline:'914說今天已有安排，晚餐排不進去。你沒有把邀請改成需要她核准的工作，這次沒有花餐費。',flavor:{normal:['她講完一件跟業績無關的小事，還記得問你後來怎麼樣。你們沒有拿誰升官以前的樣子比較，反而聊得比會議裡自然。','914很客氣，也沒有把每個停頓補成下一段提案。你們把飯吃完，彼此的近況仍各自保留了一點。','你順口提到以前同學相處，她以為你也在問升官後變了多少。你換了話題，那句無意的比較還是讓晚餐多了一層職稱。'],wild:['914把頭銜費劃掉，替所有人加上一條禁止在湯裡投放簡報。你們輪流接了幾句，難得一起笑的不是別人的績效。','她認可平價白飯，接著就回去看甜點。玩笑順利結束，沒有替這頓飯簽成新的長期合作。','914問你是不是覺得她現在只剩職稱。你本來在玩菜單，最後卻得說明自己沒有替她的交情標價。']}},
 janet:{title:'這餐各付各的，附件只有菜單。',body:'Janet先確認各自點餐，不必替全桌統一報帳。你把工作表留在包裡，今天沒有哪筆預算要她代找下落，只有兩個人想吃熱飯。',quote:'自己的口味自己決定，這餐不用抄送我。',normal:'聊喜歡的口味，吃完按自己那份付款。',wild:'請湯匙申請兩口湯的預算，附件附一張空碗。',accept:'Janet說今晚可以，先問你能不能各點各的。你答應不帶核銷資料，餐費還沒付。',decline:'Janet回覆今天沒有空，請你別等她。你沒有把拒絕當成新的待補件，這次沒有用餐或付費。',flavor:{normal:['Janet記住你不吃的東西，你也把她講到一半的近況聽完。各付各的沒有算出距離，反而讓兩個人都輕鬆一點。','你們聊了幾家店，安穩吃完自己的那份。沒有工作爭議，也沒有突然熟到能替彼此回答問題。','你隨口問起一筆活動預算，她以為工作又跟著來了。你趕快把話收回菜單，後半餐仍有一點在對帳的感覺。'],wild:['Janet替湯匙蓋一個只准休息的章，你替空碗附上已吃完證明。你們終於能一起笑表格，沒把對方也列進待辦。','她看完空碗附件笑了一下，說湯確實可以再加。案件很快結束，剩下的時間照常吃飯。','Janet問你是不是連出來吃飯也要酸她的工作。你把湯匙放回碗邊，才知道同一個表格笑話今天不適合再加一輪。']}},
 captain:{title:'兩個人訂兩個位子，今天先穩穩靠岸。',body:'船長傳來自己挑的店，你也把菜單看過，確認有兩個人各自想吃的東西。這次沒有臨時全員加入、沒有包廂超載，也不用誰的戀愛或私人行程當笑話。',quote:'你不喜歡就直接講，我們可以換，不用真的跟船沉。',normal:'各自說清楚口味，別替對方決定喜不喜歡。',wild:'替筷子船員發船票，一張票只能坐一個人。',accept:'船長答應了，這次先把實際人數和訂位都確認好。兩個人兩張椅子，餐費還沒付。',decline:'船長說今天另有安排，這班先不出航。你不替未成行的飯局留座位，也沒有付餐費。',flavor:{normal:['船長聽見你不喜歡的口味，這次真的換了一道。你也沒有把以前的雷店連播一遍，兩個人先把今天這一餐吃對了。','你們各自點自己喜歡的東西，沒有發現新的共同愛好，也沒有互相勉強。船很小，今晚倒是準時靠岸。','你說某道菜普通，她以為又要聽自己總挑錯店。你想只講今天這一口，她卻開始替以前每次訂餐補說明。'],wild:['船長替湯匙安排救生衣，你替多出來的邀約放上候補。玩笑越講越離譜，人數卻第一次從頭到尾都對得起來。','船票很快收進口袋，船長把剩下的飯吃完。你們一起演了短短一段航海，沒有替彼此續訂下一季。','船長問你是不是覺得她連兩個人也數不清。你只是想逗她笑，卻剛好踩到她今天不想再當全公司活動梗的位置。']}}
};
function invitation(run,id){
 const p=CAST_PROFILES_V39[id],d=mealData(run,id),cost=castMealCostV39(run,id),flag=`meal_invite_${id}_day_${run.turn}`,attempted=Number(run.flags?.[flag]||0)>0,{acceptChance}=castInvitationProfileV39(run,id);
 return empty(attempted?`${p.name}今天已經問過了。`:`傳訊息約${p.name}吃飯（成行餐費 ${cost} 存款）`,'mealPick',{mealTarget:id,mealCost:cost,available:!attempted&&run.stats.cash>=cost,draw:{label:'飯局邀請回覆',outcomes:[{weight:acceptChance,label:'答應赴約',result:d.accept,delta:{},flags:[flag],effect:'mealPick'},{weight:1-acceptChance,label:'今天約不到',result:d.decline,delta:{},flags:[flag],effect:'mealDeclined'}]}});
}
function dinner(run,id){
 const p=CAST_PROFILES_V39[id],d=mealData(run,id),cost=castMealCostV39(run,id);if(run.mealContext?.guest!==id||run.mealContext.page!==2)throw new Error('Invalid cast dinner context');
 return {id:`meal-with-${id}`,speaker:id,kind:'self-care',minRules:39,privateContext:true,era:'下班飯局',sourceIds:['castFictionV39','characterFiction'],title:d.title,body:d.body,wing:d.quote,choices:[...[d.normal,d.wild].map((text,replyIndex)=>{
  const profile=castMealChatProfileV39(run,id,replyIndex),delta={cash:-cost,mood:replyIndex?33:30,energy:replyIndex?14:16,trust:replyIndex?4:6,...(replyIndex?{slack:6}:{})},gain=Math.min(12,8+replyIndex+Math.min(3,profile.familiarity)),loss=replyIndex?-9:-6;
  return {text:`${text}（花費 ${cost} 存款）`,detail:'',result:'',delta,flags:['spend_mood','spend_network','meal_shared',`meal_guest_${id}`],effect:'mealFinish',mealCost:cost,available:run.stats.cash>=cost,...(replyIndex?{wild:true}:{}),draw:{label:'餐桌氣氛',outcomes:[['warm','聊得很開',profile.warmChance,gain],['neutral','平常吃飯',profile.neutralChance,0],['mine','不小心踩雷',profile.mineChance,loss]].map(([reaction,label,weight,affinityDelta],index)=>({weight,label,result:d.flavor[profile.reply][index],delta:{...delta},mealOutcome:{version:1,target:id,replyIndex,reaction,affinityDelta}}))}};
 }),empty('今天先不吃，改天再約。','mealCancel',{result:`你把這餐先取消，${p.name}也收起菜單。沒有用餐或付餐費，下一次有空再問。`})]};
}
export function getMealEventV39(run){
 if(!/^e39-/.test(run?.seed||''))return getMealEventV37(run);
 if(!['self-care','crisis-mood'].includes(run.mealContext?.origin))throw new Error('Invalid cast meal origin');
 const id=run.mealContext?.guest;if(CAST_IDS_V39.includes(id)&&run.eventId===`meal-with-${id}`)return dinner(run,id);
 const event=getMealEventV37(run);
 if(event.id!=='meal-guests-c')return event;
 return {...event,minRules:39,privateContext:true,title:'第三頁，多幾位可以先問問的人。',body:'教授與五位同事都在這一頁。每個人的空檔、熟悉程度和這局留下的印象不同；主管與跨部門的人通常更難約。每人同一工作回合只問一次，正式坐下選擇聊天才扣餐費。',choices:[event.choices[0],...CAST_IDS_V39.map(guest=>invitation(run,guest)),...event.choices.slice(1)]};
}
