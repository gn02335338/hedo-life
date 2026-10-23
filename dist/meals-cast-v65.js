import {CAST_IDS_V65,CAST_PROFILES_V65,isCastV65} from './cast-v65.js';
import {characterHistoryChanges} from './character-stats.js';
import {countsFriendlyPatronageEncounterV68} from './patronage-familiarity-v68.js';
import {MEAL_GUEST_IDS_V39,MEAL_EVENTS_V39,mealPageIdV39,getMealEventV39} from './meals-cast-v39.js';

export const MEAL_GUEST_IDS_V65=Object.freeze([...MEAL_GUEST_IDS_V39,...CAST_IDS_V65]);
export const MEAL_EVENTS_V65=Object.freeze([...MEAL_EVENTS_V39,'meal-guests-d',...CAST_IDS_V65.map(id=>`meal-with-${id}`)]);
export const mealPageIdV65=page=>page===3?'meal-guests-d':mealPageIdV39(page);
const departments={system:'engineering',ai:'engineering',mis:'it',project:'project',product:'product',design:'product',bd:'business',sales:'sales',executive:'leadership',finance:'finance',accounting:'finance',hr:'people',admin:'admin'};
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const empty=(text,effect,extra={})=>({text,detail:'',result:'',delta:{},flags:[],effect,...extra});

export function castInvitationProfileV65(run,id){
 const p=CAST_PROFILES_V65[id];if(!p)throw Error('Unknown v65 dinner guest');
 let familiarity=0,realHits=0,recentInsults=0,affinity=50;
 for(const change of characterHistoryChanges(run).filter(change=>change.id===id)){
  const row=run.history[change.historyIndex];affinity+=change.affinityDelta;realHits+=change.realHits;
  if(!change.imaginedHits&&!change.realHits&&!['rage','rage-world','verbal'].includes(row.kind)&&!row.verbalOutcome&&countsFriendlyPatronageEncounterV68(run,row))familiarity++;
  if(row.verbalOutcome&&change.affinityDelta<0&&Number.isInteger(row.turn)&&run.turn-row.turn<=3)recentInsults++;
 }
 const playerDepartment=departments[run.actualRoleId]||null,sameDepartment=p.department===playerDepartment||id==='zoe'&&['hr','admin'].includes(run.actualRoleId);
 const base=p.seniority==='director'?(sameDepartment?.24:.13):p.seniority==='manager'?(sameDepartment?.30:.17):(sameDepartment?.56:.44),maximum=p.seniority==='director'?.68:p.seniority==='manager'?.80:.85;
 return {acceptChance:clamp(base+Math.min(familiarity,6)*.065+(affinity-50)*.004+.015*Math.max(0,(run.rank||0)-3)-Math.min(.75,realHits*.4)-Math.min(.30,recentInsults*.12),.03,maximum),affinity,familiarity,realHits,recentInsults,department:p.department,playerDepartment,sameDepartment,seniority:p.seniority};
}
export function castMealChatProfileV65(run,id,replyIndex){
 if(![0,1].includes(replyIndex))throw Error('Unknown v65 dinner reply');
 const p=CAST_PROFILES_V65[id],{affinity,familiarity,realHits,recentInsults}=castInvitationProfileV65(run,id),familiar=Math.min(familiarity,6);
 const mineChance=clamp(.14+p.sensitivity+(replyIndex===1?.11:0)-familiar*.018-(affinity-50)*.001+Math.min(.20,realHits*.1)+Math.min(.12,recentInsults*.06),.05,.54);
 const warmChance=Math.min(1-mineChance-.15,clamp(.48-(replyIndex===1?.04:0)+familiar*.025+(affinity-50)*.0012-Math.min(2,realHits)*.05-Math.min(2,recentInsults)*.035,.18,.74));
 return {warmChance,neutralChance:1-warmChance-mineChance,mineChance,affinity,familiarity,reply:replyIndex===0?'normal':'wild'};
}
const data={
 zoe:{title:'今天的桌位，不按老闆的溫度排。',body:'201把活動流程留在包裡。這餐不用主持，也不查誰最近有沒有被叫去重要會議，她只想先挑一道真的想吃的菜。',quote:'今晚先不排座位，也不用替整桌填滿意度。',normal:'問她想吃什麼，先把工作和主管動向留在門外。',wild:'替便當頒「本席不受冷凍」證書，請湯匙主持解凍典禮。',
  flavor:{normal:['201講起幾個自己喜歡的口味，你也沒有把話題帶回誰最近受寵。她聽完你的近況，幫你留了一口剛端上來的熱菜。','你們聊了店家與餐點，沒有談開所有近況。這頓飯平穩吃完，不必用全場好評證明今晚值得。','你本想表示關心，問她最近是不是又被冷凍。201放下筷子，說今天不想再替老闆的表情報氣象；後半餐客氣了些。'],wild:['201用湯匙敲了一下碗，宣布主持人本人也可以先吃飯。你們笑著把證書壓在杯底，這次沒有人需要等主管宣布回溫。','201笑說證書可以先放桌上，菜再不吃真的要冷了。典禮到此結束，兩個人照自己的速度把飯吃完。','201問你是不是連晚餐也只記得她被冷凍。你本想逗她笑，卻把她想暫時放下的事又端到桌上。']}},
 action:{title:'這餐可以只談口味，不談下一個機會。',body:'順哥坐下看菜單，高粱收藏和區塊鏈都沒有先占一張椅子。你們約好今晚普通吃飯，沒有個人資金需要在餐桌上表態。',quote:'想吃什麼就點，今天不用先聽一份新提案。',normal:'聊附近的店與自己的生活，不替投資構想點頭。',wild:'請飲水機獲頒最佳流動性獎，附註不接受募資。',
  flavor:{normal:['順哥講起一間常去的小店，也認真問你最近過得怎樣。這餐沒有新增合作，倒是比工作會議多聽見一點彼此的生活。','你們交換幾個餐點意見，話題沒走得很深。沒有新提案也沒有資金承諾，晚餐就按原本那份菜單結束。','你提到某個計畫的疑問，順哥以為今晚又要繼續說明。你把話題拉回餐點，兩邊仍花了一點時間才放下那份提案。'],wild:['順哥替白開水鼓掌，說至少它今天確實能流動。你們把玩笑留在杯裡，沒有替任何人的存款加上合作欄位。','順哥笑了一下，接著問青菜要不要再點。飲水機沒有得獎，這一餐也沒有被演成完整的商務簡報。','順哥覺得你在暗酸他的構想。你說只是想替白開水頒獎，對話卻一度變成解釋自己到底站在哪一邊。']}},
 hester:{title:'海姐把客戶電話留到明天。',body:'海姐先確認今晚不用順便談案子。你把工作通知收起，桌上只有菜單，不用以同學、挖角或職稱替這餐找到商務理由。',quote:'今天先吃飯，有案子的事另外約。',normal:'聊她願意分享的近況，不追問業績與老闆評價。',wild:'替菜單訂下反挖角條款：好吃可以帶朋友，不必帶整隊業務。',
  flavor:{normal:['海姐講完一件生活小事，也把問題問回來。你沒有把她的每句近況拆成客戶線索，這頓飯因此聊得比簡報自然。','你們聊了幾道菜，沒有急著變成很熟的朋友。飯吃完了，明天的客戶問題也安穩留在明天。','你順口問翅膀最近滿不滿意她的表現，海姐以為又是一場試探。你換了話題，桌上的距離還是多了一點。'],wild:['海姐笑說這家如果被整隊挖走，廚房可能要先談人力。你們越講越離譜，最後只真的加了一道大家想吃的菜。','海姐說好吃可以推薦，其他條款先不用簽。你把玩笑收好，後半餐還是照各自喜歡的口味吃。','海姐聽成你在笑她的挖角經歷，問你是不是覺得她只靠介紹。你本來談餐廳，卻得先把一句失準的比喻收回來。']}},
 simon:{title:'丁哥今天不評圖，也不接受綽號加班。',body:'丁哥挑了個不用盯投影幕的位置，手機裡的設計稿先關掉。這一餐只問口味，沒有誰要試用主管，也不用他順便替菜單改版。',quote:'今天這張菜單，我只決定要吃哪一道。',normal:'聊下班想做的事，讓他自己選要講的部分。',wild:'頒給筷子全才副理頭銜，但權限僅限夾自己的菜。',
  flavor:{normal:['丁哥講起自己真正想做的一件事，你聽完沒有替他加上一句你很有主管潛力。他也耐心聽你的煩惱，這回不用拿作品互相證明。','你們安穩吃完，沒有聊到所有想法。丁哥沒有當評審，你也沒有交稿，今晚的停頓不需要修成更有層次。','你以為安慰他，說下次主管考核一定會過。丁哥說今天沒打算談那個，後半餐卻又花了幾句解釋以前的事。'],wild:['丁哥替筷子畫了一張小名片，特別把加班權限劃掉。你們笑著讓它只夾眼前的菜，誰都不必靠全才兩字多做一輪。','丁哥笑完把筷子拿起來，說這個職缺他願意讓出。名片沒有真的印，飯倒是準時吃完了。','丁哥以為你又拿全才副理的綽號提醒他沒過的考核。你把玩笑停下來，才發現同樣一句稱呼今天不適合再加薪資欄。']}},
 james:{title:'一張訂位，歡迎與再見都先不用。',body:'詹姆士按約好的時間來，這次沒有歡迎餐也沒有離職飯。兩個人只訂一張桌，今晚不需要他承諾下一次何時再來。',quote:'今天是普通吃飯，不用數我第幾次回來。',normal:'問他最近的生活，別把每句話猜成離職預告。',wild:'給餐桌一張永久門禁卡，集點只換青菜，不換工作。',
  flavor:{normal:['詹姆士把近況講完，你也不必替他預測下一份工作。兩人交換幾個真心喜歡的地方，這一餐終於沒有誰負責辦歡送。','話題停在餐點與最近的生活，你們沒有把彼此的故事全問完。這次坐下吃飯，就算一頓，不必併進任何進出紀錄。','你隨口問這次會待多久，詹姆士聽成又要對自己的去留作保。你說只是關心，他後來的回答仍短了一些。'],wild:['詹姆士在餐巾上替門禁卡畫了七格，說集滿最多送一盤菜。你們笑完決定不用真的集，今天這一頓已經夠完整。','詹姆士笑著把卡推回來，說下次想吃就再約。餐桌沒有正式入職，你們也沒有替晚餐預排交接。','詹姆士說門禁笑話他今天已經聽過好幾次。你原本想接他的梗，卻忘了他也可能只想有一頓不被點名回鍋的飯。']}},
 johnny:{title:'強尼的晚餐，終於不是排程裡剩下的空格。',body:'強尼把手機調成靜音，說今晚不替任何專案追進度。桌上沒放甘特圖，你們可以慢慢看菜單，不必先給一個對老闆方便的完成時間。',quote:'這頓我只負責把自己的飯吃完。',normal:'問他想怎麼休息，先不追加任何工作問題。',wild:'替便當簽需求凍結：吃到一半不准追加三個主管。',
  flavor:{normal:['強尼說起最近終於做成的一件小事，你沒有把它轉成下一個任務。他聽完你的近況，連手機亮起來都先放著，這頓飯真的留給眼前兩個人。','你們平靜聊了幾句，剩下的時間各自吃熱飯。沒有每一格都要填滿，今晚不說話也不算進度落後。','你問起某案順便怎樣，強尼以為晚餐又被切回會議。他收起笑臉回答完，你才發現那句順便已經搶走一半休息。'],wild:['強尼拿筷子替便當畫了封鎖線，說新增主管請走明天的變更程序。你們接著亂講了幾句，餐點卻真的沒有再被打斷。','強尼笑說便當已經同意原始範圍，請正常吃飯。這一輪玩笑結案，沒有人需要補會議紀錄。','強尼覺得連吃飯也在演白天的追殺。你把需求凍結的玩笑收回來，讓剩下的時間不要再有任何專案名詞。']}}
};
function invitation(run,id){
 const p=CAST_PROFILES_V65[id],flag=`meal_invite_${id}_day_${run.turn}`,attempted=!!run.flags?.[flag],{acceptChance}=castInvitationProfileV65(run,id);
 return empty(attempted?`${p.name}今天已經問過了。`:`傳訊息約${p.name}吃飯（成行餐費 ${p.cost} 存款）`,'mealPick',{mealTarget:id,mealCost:p.cost,available:!attempted&&run.stats.cash>=p.cost,draw:{label:'飯局邀請回覆',outcomes:[
  {weight:acceptChance,label:'答應赴約',result:`${p.name}回覆剛好有空，和你先確認時間、地點。這次只約吃飯，還沒下單，也沒有付餐費。`,delta:{},flags:[flag],effect:'mealPick'},
  {weight:1-acceptChance,label:'今天約不到',result:`${p.name}說今天另有安排，這次先不赴約。你收起訂位頁，沒有用餐或付費，也不把拒絕改成下一場工作邀請。`,delta:{},flags:[flag],effect:'mealDeclined'}
 ]}});
}
function dinner(run,id){
 if(run.mealContext?.page!==3||run.mealContext?.guest!==id)throw Error('Invalid v65 dinner context');
 const p=CAST_PROFILES_V65[id],d=data[id];
 return {id:`meal-with-${id}`,speaker:id,kind:'self-care',minRules:39,privateContext:true,era:'下班飯局',sourceIds:['castFictionV65','characterFiction'],title:d.title,body:d.body,wing:d.quote,choices:[...[d.normal,d.wild].map((text,replyIndex)=>{
  const profile=castMealChatProfileV65(run,id,replyIndex),delta={cash:-p.cost,mood:replyIndex?33:30,energy:replyIndex?14:16,trust:replyIndex?4:6,...(replyIndex?{slack:6}:{})},gain=Math.min(12,8+replyIndex+Math.min(3,profile.familiarity)),loss=replyIndex?-9:-6;
  return {text:`${text}（花費 ${p.cost} 存款）`,detail:'',result:'',delta,flags:['spend_mood','spend_network','meal_shared',`meal_guest_${id}`],effect:'mealFinish',mealCost:p.cost,available:run.stats.cash>=p.cost,...(replyIndex?{wild:true}:{}),draw:{label:'餐桌氣氛',outcomes:[['warm','聊得很開',profile.warmChance,gain],['neutral','平常吃飯',profile.neutralChance,0],['mine','不小心踩雷',profile.mineChance,loss]].map(([reaction,label,weight,affinityDelta],index)=>({weight,label,result:d.flavor[profile.reply][index],delta:{...delta},mealOutcome:{version:1,target:id,replyIndex,reaction,affinityDelta}}))}};
 }),empty('今天先不吃，改天再約。','mealCancel',{result:`你向${p.name}說今天先取消，兩人收起菜單。這次沒有用餐，也沒有付餐費。`})]};
}
export function getMealEventV65(run){
 if(!isCastV65(run))return getMealEventV39(run);
 if(!['self-care','crisis-mood'].includes(run.mealContext?.origin))throw Error('Invalid v65 meal origin');
 const id=run.mealContext?.guest;if(CAST_IDS_V65.includes(id)&&run.eventId===`meal-with-${id}`)return dinner(run,id);
 if(run.eventId==='meal-guests-d'){
  if(run.mealContext.page!==3||id!==null)throw Error('Invalid v65 dinner menu');
  return {id:'meal-guests-d',speaker:'self',kind:'self-care',minRules:39,privateContext:true,era:'找人吃飯',sourceIds:['castFictionV65','characterFiction'],title:'第四頁，先問本人今晚有沒有空。',body:'這裡有六位同事，熟悉程度、職位與這局留下的印象會影響回覆。不熟或跨部門的主管通常較難約，同一工作回合只問一次；正式坐下選擇聊天才付餐費。',wing:`邀約名單 4 / 4 · 目前存款 ${run.stats.cash}`,choices:[...CAST_IDS_V65.map(guest=>invitation(run,guest)),empty('回到第一頁，看看其他人。','mealPage',{mealPage:0,result:'你翻回第一頁，沒有新增邀約或用餐。'}),empty('先不約，回去看看其他安排。','mealCancel',{result:'你收起第四頁名單，沒有替任何人訂位或付費。'}),empty('自己買便當，今天不排任何會議。（花費 8 存款）','mealFinish',{result:'你買了便當慢慢吃，手機先留在口袋。今晚沒有別人需要配合，也沒有一口飯要先等哪位主管發言。',delta:{cash:-8,mood:22,energy:12},flags:['spend_mood','spend_solo'],mealCost:8,available:run.stats.cash>8})]};
 }
 const event=getMealEventV39(run);
 if(event.id==='meal-guests-c')return {...event,wing:`邀約名單 3 / 4 · 目前存款 ${run.stats.cash}`,choices:[...event.choices,empty('翻到第四頁，看看其他同事。','mealPage',{mealPage:3,result:'你翻到六位同事的名單，還沒有傳訊息或付餐費。'})]};
 if(['meal-guests-a','meal-guests-b'].includes(event.id))return {...event,wing:event.wing.replace('/ 3','/ 4')};
 return event;
}
