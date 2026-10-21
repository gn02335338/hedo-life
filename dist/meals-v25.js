import { PERSONAS } from './persona.js';

// A meal is a separate, deterministic break. Browsing the guest list and
// picking a guest never spends money or resolves an interaction with them.
export const MEAL_GUEST_IDS_V25 = Object.freeze([
 'wing','spencer','erich','sonny','jenjen','rick','kind','hope',
 'jack','meimei','helen','sophie','jonathan','owen','sam','cindy'
]);
export const MEAL_EVENTS_V25 = Object.freeze([
 'meal-guests-a','meal-guests-b',...MEAL_GUEST_IDS_V25.map(id=>`meal-with-${id}`)
]);

const dinners = {
 wing: {
  cost:26, title:'菜還沒上，格局先上桌。',
  body:'翅膀把菜單翻了兩頁，問你最近讀了什麼書。你試著介紹招牌菜，他說吃飯也要有想法。服務生來問要不要加飯，你第一次覺得這個問題很容易回答。',
  line:'「下班就不讀書了？人要一直成長，不能只有肚子在長。」',
  normal:['先讓他講完，把晚餐完整吃進肚子。','你在每個停頓都點一下頭，終於把飯吃完。翅膀說今天聊得不錯；你看著空碗，覺得自己又加了一場沒有打卡的班。',{mood:-6,energy:14,lick:7,boss:6}],
  wild:['請服務生把白飯升格為台大電機博士，負責回答讀書問題。','你替飯碗辦了一場口試。翅膀問你是不是又在頂嘴，你說它只是還沒找到林澤教授。這頓飯沒有拿到學位，你倒是笑了出來。',{mood:15,energy:8,boss:-9,trust:2}]
 },
 spencer: {
  cost:24, title:'董事長點了掛牌前的那一道。',
  body:'屎潘蛇把餐巾鋪得很平，談到未來的慶功宴，連納斯達克敲鐘後要坐哪裡都快排好了。服務生提醒這裡只收現金，未來股價暫時不能結帳。',
  line:'「等到那一天，今天這頓飯會很有紀念價值。」',
  normal:['陪他聊完願景，再確認今天的帳單。','你聽完一輪上市規劃，餐廳仍然沒有改收股票。屎潘蛇對未來很有信心，你對今天的白飯比較有把握。',{mood:5,energy:16,dream:9,trust:4}],
  wild:['拿湯匙敲杯子，宣布牛肉麵已在小菜市場掛牌。','你敲了三下，隔壁桌以為有人生日。屎潘蛇說場面可以再大一點，你請店員加了一碟海帶，完成本日晚餐擴張。',{mood:24,energy:12,dream:-7,trust:3}]
 },
 erich: {
  cost:12, title:'今天先吃飯，文件放旁邊。',
  body:'法師坐下前，先把菜單正反面都看過一遍。你說今天只想吃飯，他點頭，把筆收回口袋。直到服務生遞上點餐單，他的手又習慣性摸了過去。',
  line:'「不用每張紙都簽。這張你只要勾想吃的就好。」',
  normal:['邊吃邊整理最近的事，請他幫忙分清事實與說法。','你把事情一件件講完，法師只問日期、信件和原本怎麼約定。晚餐沒有替你解決所有麻煩，但那些事終於不再全擠成一團。',{mood:32,energy:16,trust:8}],
  wild:['請炸豆腐作證，證明今天沒有自願加班。','你把豆腐擺到盤子中央，宣布開始交互詰問。法師說它沒有回應義務，然後替它夾了一口醬。你們總算聊到一件不需要留底的事。',{mood:35,energy:12,trust:6}]
 },
 sonny: {
  cost:10, title:'這碗麵，他還沒決定要不要比。',
  body:'阿福研究著隔壁桌的超大碗挑戰，先說自己以前吃得完，再解釋今天為什麼不適合。他連筷子都還沒拆，已經補充到第三個原因。',
  line:'「不是不能吃，主要是這個碗的設計會影響發揮。」',
  normal:['陪他吃普通份量，順便聽完所有但書。','你們正常吃完一餐。阿福宣布自己保留挑戰實力，還說剛才那雙筷子握起來不太對。至少今天沒有需要維修的印表機。',{mood:21,energy:19,slack:5,trust:6}],
  wild:['替他召開尚未開吃世界冠軍記者會。','你拿紙巾當麥克風，請他說明退賽原因。阿福談了碗、桌高與手腕，你認真記到第五點，兩個人終於都笑了。冠軍餐費仍照普通份量算。',{mood:33,energy:12,trust:2}]
 },
 jenjen: {
  cost:12, title:'真真把訂餐群組先靜音。',
  body:'真真坐下來，先問你吃不吃香菜，沒問筆電還了沒。你愣了一下才回答。她把手機翻面，說今天少一個群組通知，飯比較容易趁熱吃。',
  line:'「今天自己點自己的，不用再等全公司回覆。」',
  normal:['聊點公司外面的事，吃一頓不用統計的飯。','你們聊到附近哪家店比較不會踩雷。真真沒有開試算表，你也沒有替自己的口味填理由。吃完時，手機上還是有訊息，但你暫時沒那麼怕看它。',{mood:34,energy:18,trust:7}],
  wild:['宣布本桌成立便當共和國，香菜採公投決定。','你把醬油瓶排成議會。真真替你們訂下唯一一條規則：想吃的人自己加。這場會議五秒結束，沒有會後補充需求。',{mood:37,energy:12,trust:5}]
 },
 rick: {
  cost:16, title:'乾兒子的電話，比上菜還準時。',
  body:'老闆乾兒子剛坐穩就開始打瞌睡。電話一響，他立刻挺直：「對對對，老闆說得對。」你等他掛掉，發現剛才服務生問的湯麵粗細還沒得到答案。',
  line:'「等一下，我先接個重要的。你剛說要哪個口味？」',
  normal:['趁電話還沒再響，問他怎麼在公司保留電量。','他說到休息很有心得，說到工作又接起電話。你趁空檔安靜吃飯，學到的第一件事，是別把每個停頓都拿來補工作。',{mood:17,energy:23,slack:8,trust:5}],
  wild:['替手機點一份套餐，請乾兒子讓出主要用餐席。','你把手機放到空椅子前，說今天大家輪流接電話。乾兒子問這有什麼意義，你說至少主角終於有座位。你們的飯吃完了，手機還在忙。',{mood:31,energy:14,trust:-4}]
 },
 kind: {
  cost:20, title:'阿良這次有坐到主餐結束。',
  body:'阿良把菜單往你面前推，說先吃飽，後面再安排。你提醒他上次續攤人不見了，他說那次有特殊狀況，接著又很有把握地說今天一定沒問題。',
  line:'「放心啦，等一下我帶你去。你先慢慢吃。」',
  normal:['好好吃完這頓，續攤就等阿良開路。','主餐吃完，阿良說出去接一下電話。你把最後一口湯喝完，等到店員收盤才發現他已經消失。飯是真的吃到了，續攤仍然只存在他的承諾裡。',{mood:39,energy:19,slack:9,trust:5}],
  wild:['替續攤設簽到處，第一位請阿良本人報到。','阿良笑著說一定到，還在紙巾上畫了一個勾。十分鐘後，你拿著那張紙巾站在店門口，本人已無法聯繫。你決定先回家，這次至少沒有追著承諾搭車。',{mood:42,energy:15,slack:7,trust:3}]
 },
 hope: {
  cost:14, title:'沒有自評表的餐桌，先確認一下。',
  body:'希望問你最近還好嗎。你看了看桌上，只有菜單和水杯，沒看到改善計畫。她說今天只是吃飯；你仍然等到服務生收走菜單，才放心把肩膀放下來。',
  line:'「先吃。今天不用替這頓飯設定三項可衡量目標。」',
  normal:['說說最近哪裡撐不住，不把每句話寫成自評。','你沒有替難受補上漂亮的結尾，希望也沒有立刻替你填下一期目標。你們把飯吃完，今天先讓一句「我很累」留在原本的意思。',{mood:29,energy:17,trust:6}],
  wild:['提議先改善白飯績效，限三口內交出飽足感。','希望說白飯應該不需要PIP。你指著空碗問，那員工為什麼每件事都要。她停了一下，把話題轉回要不要加湯；至少你終於把那句話講了出來。',{mood:34,energy:12,trust:2}]
 },
 jack: {
  cost:14, title:'傑克說這段先不用寫進交接。',
  body:'傑克聽你講完今天的事，先問你吃了沒。他把兩份餐具拆開，說故事可以慢慢補，飯冷掉就真的不好吃了。你第一次把敘事順序讓給晚餐。',
  line:'「先吃。日期等一下再對，別讓這份工作連飯都吃掉。」',
  normal:['把最近的荒謬講給他聽，也聽聽他怎麼撐過來。','傑克聽得懂你省略的那些細節。你不用把每個前情再解釋一次；吃完之後，事情還沒消失，你卻不再覺得只有自己在經歷這些。',{mood:43,energy:19,trust:10}],
  wild:['請湯碗擔任史官，替今天這頓飯立一篇本紀。','你唸出「本日無人催交付」，傑克替你補上「亦無人逼簽自願離席」。湯碗沒有意見，店員只提醒打烊時間。這段不用改第三版。',{mood:46,energy:14,trust:8}]
 },
 meimei: {
  cost:18, title:'今天的麥克風換成筷子。',
  body:'水蛇哼了兩句First Love，你問她是不是又要跟傑克決鬥。她看了看店裡的背景音樂，說先讓原唱唱完；今晚至少沒人能把點餐機當成搶麥入口。',
  line:'「先吃啦。真的要唱，至少等嘴巴這口吞完。」',
  normal:['聊聊業務現場那些只有同事才懂的場面。','你們從客戶改口聊到誰又替誰答應了交期。水蛇一口一個，筷子和吐槽都沒停；你原本憋著的那股氣，總算有地方慢慢散掉。',{mood:39,energy:18,trust:9}],
  wild:['拿菜單辦First Love搶麥資格賽，冠軍負責加點。','你唱了半句就被她接走。店員過來問要點什麼，水蛇用最後一句的氣勢喊了一份炸物。今晚沒有尾牙獎金，倒是順利完成了加點。',{mood:44,energy:12,trust:7}]
 },
 helen: {
  cost:18, title:'前女友這桌，先不談交接。',
  body:'前女友剛坐下，手機就跳出一個「再確認一下」的訊息。她把通知滑掉，說有些交接像點餐，一直說最後一項，下一頁卻還在長。你們決定先只看一張菜單。',
  line:'「這餐吃完就算吃完。不要再替我加一個待確認。」',
  normal:['聊聊產品之外的事，把那些延長線先拔掉。','你們真的聊了旅遊、口味和週末。飯後有人又問一件舊事，她說明天再回。你也跟著把自己的通知關掉，讓晚餐有一個正常的結束。',{mood:37,energy:19,trust:8}],
  wild:['替交接清單點一份兒童餐，規定它今晚不准長大。','她把菜單闔起來，宣布需求已進入睡眠時間。你替它蓋上一張餐巾，兩個人安靜吃完甜點。今晚沒有任何人被臨時加進交接群組。',{mood:42,energy:14,trust:6}]
 },
 sophie: {
  cost:12, title:'紅茶點了紅茶，先聲明一次。',
  body:'紅茶特別提醒服務生，自己要的是紅茶。你忍住沒接那句辦公室老梗，轉而問她印表機後來怎樣了。她說先吃飯，那台機器今天不在本桌稽核範圍。',
  line:'「紅茶，謝謝。其他人亂取的關係，今天也不用幫我查核。」',
  normal:['把茶水間的傳聞放下，好好聊聊各自的近況。','你們交換了一些工作裡卡住的事。沒人替她和阿福的傳聞蓋章，倒是把誰說過什麼分得很清楚。今天的飯比群組裡的對話容易消化。',{mood:35,energy:17,trust:9}],
  wild:['替茶壺核發單身證明，禁止印表機充當婚姻證人。','紅茶說茶壺到底跟這件事有什麼關係，你說所以才需要澄清。她笑完把印表機列為不適格證人，還替你倒滿一杯。傳聞仍然沒有查證結論。',{mood:40,energy:12,trust:6}]
 },
 jonathan: {
  cost:12, title:'助理工程師今天只負責自己的胃。',
  body:'強哥指著菜單，說點餐不是助理工程師能決定的事。你問那誰決定，他已經勾好自己的主餐。這套職責切割速度，比工程排程會議快多了。',
  line:'「我是助理工程師耶。大家晚餐吃什麼也要我扛？」',
  normal:['各點各的，聊聊怎麼把工作範圍講清楚。','你們把「幫一下」和「全交給你」之間的差別拆開來講。強哥對職稱的堅持偶爾讓人想翻白眼，但今晚你確實學到一句可以少背鍋的問法。',{mood:35,energy:19,trust:8,skill:5}],
  wild:['頒給他首席助理工程師餐具組，宣布鍋具一律不歸他。','你把湯匙排成勳章，強哥當場補充：頒獎台也不在助理工程師的責任範圍。你們誰都沒接下那口想像中的鍋，飯倒是一口沒少吃。',{mood:41,energy:13,trust:7}]
 },
 owen: {
  cost:22, title:'歐文把墨鏡放在菜單旁。',
  body:'歐文坐下時還戴著墨鏡，金項鏈在店裡燈下晃了一下。你問這次離職倒數到哪裡，他說先別急，晚餐吃完還能約跑。外面的特斯拉安靜停著，比你們兩個都像已經下班。',
  line:'「工作先放一下。吃完走走，你總不能只在辦公室裡繞。」',
  normal:['陪他吃飯聊合作，飯後真的離開辦公室附近。','歐文又提了一次離職，這回你沒有幫他算日期。你們飯後走了一段路，沒有簡報，也沒人突然要求補商業模式。你終於發現今晚的路可以自己選。',{mood:39,energy:13,trust:10}],
  wild:['替離職倒數發行月曆，請歐文挑一天當國定假日。','他說日期還要再看，你乾脆把每一頁都印成「快了」。歐文笑著收下構想，這份日曆不用募資，你們也不用當場寫下一年的目標。',{mood:44,energy:10,trust:7}]
 },
 sam: {
  cost:14, title:'山姆先確認你看過哪幾部。',
  body:'山姆提起成大學士加碩士，又順手把Netflix的推薦清單滑給你看。他說有些人基礎不夠，講了也聽不懂。你看著畫面，決定先問那部影集第二季到底好不好看。',
  line:'「先別跳著看。前面沒看懂，後面當然跟不上。」',
  normal:['把話題留在影集和晚餐，不把自己送進口試。','你們聊了幾集劇情，山姆總算不用拿誰的學歷當前情提要。吃到一半他打了個呵欠，你提醒還有湯；今天至少沒有睡掉整場讀書會。',{mood:27,energy:21,trust:5,slack:5}],
  wild:['請影集跳出「您是否還在上班」，邀山姆親自按否。','你拿紙巾畫了一個確認視窗。山姆看了一眼，說這個功能應該早點有。你們按下想像中的「否」，接著把剩下的工作話題一併跳過。',{mood:36,energy:14,trust:3}]
 },
 cindy: {
  cost:16, title:'辛蒂沒有替這頓飯排里程碑。',
  body:'辛蒂說店裡換過幾個主廚，她還記得哪一任比較好吃。你聽著聽著差點以為在開專案會議。她把菜單轉向你，說今晚不用猜哪位主管下一個離場。',
  line:'「先點你想吃的。這個決定不需要等誰今天喜歡誰。」',
  normal:['聊聊怎麼在反覆改口的日子裡保留自己的節奏。','辛蒂沒有替每一任主管下結論，只提醒你把確認過的事留清楚。你們聊完近況，飯後各自回家；今晚沒有一頓飯需要等到最後一個人點頭才算完成。',{mood:38,energy:18,trust:9}],
  wild:['替每道菜掛上主管名牌，宣布主廚異動不影響準時開飯。','辛蒂把名牌全收走，說菜又沒做錯事。你們直接開吃，沒等任何一任主管加入群組。這次的時程表只有一條：趁熱。',{mood:43,energy:13,trust:6}]
 }
};

const emptyChoice=(text,effect,extra={})=>({text,detail:'',result:'',delta:{},flags:[],effect,available:true,...extra});

// Overlay only the e25 entry. Older modules and replay-authored prose stay
// frozen; callers may supply the new mood-warning copy before applying this.
export function withMealEntryV25(event){
 if(!event||!['self-care','crisis-mood'].includes(event.id))return event;
 const index=event.id==='self-care'?4:1;
 const entry=emptyChoice('找人吃飯，先看看誰有空。','mealOpen',{
  result:'你打開邀約名單。先決定約誰，再看看今天想怎麼聊；現在還沒有花錢。'
 });
 return {...event,choices:event.choices.map((choice,at)=>at===index?entry:choice)};
}

export function getMealV25(run){
 const context=run?.mealContext;
 if(!context||!['self-care','crisis-mood'].includes(context.origin))throw new Error('Invalid meal context');
 const menu=['meal-guests-a','meal-guests-b'].indexOf(run.eventId);
 if(menu>=0){
  if(context.page!==menu||context.guest!==null)throw new Error('Invalid meal menu');
  const guests=MEAL_GUEST_IDS_V25.slice(menu*8,menu*8+8);
  return {
   id:run.eventId,kind:'self-care',speaker:'self',era:'找人吃飯',sourceIds:['characterFiction'],
   title:menu===0?'今晚想找誰一起吃飯？':'翻到另一頁，還有這些人。',
   body:`${context.origin==='crisis-mood'?'你先把工作通知靜音，想找個人陪自己喘口氣。':'你打開聯絡名單，想找個人一起吃晚餐。'}邀約名單不收錢；選好人、決定正式用餐時才會扣餐費。每桌聊的事不同，吃完再決定值不值得。`,
   wing:`邀約名單 ${menu+1} / 2 · 目前存款 ${run.stats.cash}`,
   choices:[
    ...guests.map(id=>emptyChoice(`約${(id==='rick'&&!/^e(?:29|30|31|32)-/.test(run.seed)?'老闆乾兒子':PERSONAS[id].name)}吃飯（花費 ${dinners[id].cost} 存款）`,'mealPick',{
     mealTarget:id,mealCost:dinners[id].cost,available:run.stats.cash>=dinners[id].cost,
     result:`你傳了訊息，和${(id==='rick'&&!/^e(?:29|30|31|32)-/.test(run.seed)?'老闆乾兒子':PERSONAS[id].name)}約在附近吃飯。餐費還沒付，坐下後再決定要聊什麼。`
    })),
    emptyChoice(menu===0?'翻到下一頁，看看其他人。':'回到上一頁。','mealPage',{
     mealPage:menu===0?1:0,result:'你換了一頁名單，還沒有付錢，也還沒跟誰開聊。'
    }),
    emptyChoice('先不約，回去看看還能怎麼安排。','mealCancel',{
     result:'你把邀約名單收起來，這次沒有訂位，也沒有花錢。'
    })
   ]
  };
 }
 const id=context.guest,meal=dinners[id];
 if(!MEAL_GUEST_IDS_V25.includes(id)||run.eventId!==`meal-with-${id}`||context.page!==Math.floor(MEAL_GUEST_IDS_V25.indexOf(id)/8))throw new Error('Invalid meal guest');
 const paid=(response,wild=false)=>({
  text:`${response[0]}（花費 ${meal.cost} 存款）`,detail:'',result:response[1],
  delta:{cash:-meal.cost,...response[2]},flags:['spend_mood','spend_network','meal_shared',`meal_guest_${id}`],
  effect:'mealFinish',mealCost:meal.cost,available:run.stats.cash>=meal.cost,...(wild?{wild:true}:{})
 });
 return {
  id:run.eventId,kind:'self-care',speaker:id,era:'下班飯局',sourceIds:['characterFiction'],
  title:meal.title,body:meal.body,wing:meal.line,
  choices:[paid(meal.normal),paid(meal.wild,true),emptyChoice('今天先不吃，改天再約。','mealCancel',{
   result:'你說今天的狀態還不太適合坐下來吃飯，決定改天再約。這次沒有付餐費。'
  })]
 };
}

const dinnerDreams=Object.freeze({
 wing:'白飯戴上台大電機的學位帽，說自己還在等林澤教授排口試。翅膀要求它先交讀書心得，飯碗把蓋子關了起來。',
 spencer:'屎潘蛇把餐廳燈光指成敲鐘現場，小菜們排隊掛牌，海帶宣布自己先做股價穩定措施。',
 erich:'法師請炸豆腐出庭，豆腐以正在吸醬為由拒絕作證。連湯匙都想先確認自己簽的是哪一張紙。',
 sonny:'阿福說餐桌高度影響發揮，碗太圓、筷子太滑，最後連餐巾紙都被列成尚未出賽的理由。',
 jenjen:'真真把醬油瓶排成議會，宣布今晚不再統計全公司的便當。香菜公投五秒結束，比任何群組回覆都快。',
 rick:'乾兒子的手機坐上主位，一邊吃飯一邊喊「老闆說得對」。本人縮到旁邊打瞌睡，連點餐都交給來電鈴聲。',
 kind:'阿良說續攤一定到，桌上的筷子卻先替他簽退。你轉頭看向門口，只剩一張寫著「等一下」的餐巾紙。',
 hope:'希望請白飯填三項改善目標。白飯問飽足感要由誰驗收，整桌的菜都先把自評表藏到盤底。',
 jack:'傑克拿湯匙替今晚立傳，第一句寫「本日無人催交付」。熱湯還沒喝完，旁邊的小菜已經排隊補史料。',
 meimei:'水蛇把筷子當麥克風，First Love前奏一響，連點餐機都開始辦搶麥資格賽。裁判先問到底誰負責加點。',
 helen:'前女友替每道菜掛上「交接完畢」，餐巾紙卻不停長出待確認事項。她直接把整張紙折成不接受新需求的小船。',
 sophie:'紅茶請茶壺出示色號，禁止炸豆腐把她和阿福排成套餐。所有關係一律待查，只有飲料確定是紅茶。',
 jonathan:'強哥舉起助理工程師餐具組，說砂鍋不在職責範圍。那口鍋自己滑到桌邊，連湯匙都不肯背。',
 owen:'歐文的墨鏡投影出跑道，金項鏈變成終點線。離職倒數月曆跑過整家餐廳，每一頁都還寫著「快了」。',
 sam:'山姆的菜單跳出「您是否還在上班」。兩張成大文憑輪流按暫停，Netflix卻開始自動播放下一道菜。',
 cindy:'辛蒂把菜單拉成甘特圖，每位主廚的名字一上桌就換色。她把名字全部收掉，宣布唯一的里程碑是趁熱吃。'
});

// Keep the published rage mechanics, including the seeded draw, intact. Only
// e25 dinner narration moves from the office into the actual restaurant.
export function withMealRageCopyV25(event,run){
 const context=run?.rageContext;
 if(!/^e(?:25|26|27|28|29|30|31|32)-/.test(run?.seed||'')||event?.id!=='rage-release'||!context?.eventId?.startsWith('meal-with-'))return event;
 const guest=context.eventId.slice('meal-with-'.length),meal=dinners[guest];
 if(!meal||context.target!==guest)return event;
 const name=guest==='rick'&&!/^e(?:29|30|31|32)-/.test(run.seed)?'老闆乾兒子':PERSONAS[guest].name,paid=context.phase==='result'&&context.pendingEffect==='mealFinish';
 const phase=paid?'這頓飯的餐費已經付過，剛才那句回應卻還卡在你心裡。':context.phase==='result'?'你剛說今天先不吃，正準備改天再約，火氣卻又湧了上來。':'這頓飯還沒正式開始，你已經聽得有點火大。';
 const imaginary=`你在腦內把餐桌變成擂台，帳單跳出來當裁判。${dinnerDreams[guest]} ${paid?'帳單舉著「已結清」提醒大家，不准再收一次餐費。':'裁判說歸說，現實裡並沒有因此加點或付錢。'}你眨了一下眼，雙手仍放在自己膝上。餐廳裡沒有人挨打，${name}還坐在對面；剛才整段只有你看見。`;
 const real=`你真的伸手朝${name}揮了過去，椅子向後擦出聲音。店員立刻過來，把你們隔到餐桌兩側，請其他客人先讓開。你等了一秒，卻沒有醒來。${paid?'剛才付過的餐費沒有重算，動手的事卻得另外說清楚。':'你還沒付餐費，現場已經得先處理剛才的衝突。'}對方的話和你動手的經過，都不能從後續紀錄裡刪掉。`;
 return {
  ...event,body:`${name}就在你對面的座位上。${phase}`,wing:meal.line,
  choices:event.choices.map(choice=>choice.draw?{
   ...choice,draw:{...choice.draw,outcomes:choice.draw.outcomes.map(outcome=>({
    ...outcome,result:outcome.effect==='rageReturn'?imaginary:outcome.effect==='rageAftermath'?real:outcome.result
   }))}
  }:choice)
 };
}
