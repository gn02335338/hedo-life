// Original fictional scenes inspired by privately reviewed image material.
// Raw screenshots, messages, identifying details and source URLs are not distributed.
import { WING_IMAGE_SCENES } from './image-scenes-wing.js';
const c=(text,result,delta,flags=[])=>({text,detail:'',result,delta,flags});

export const IMAGE_EVENTS=[
 {
  id:'rick-cheer-clock',title:'加油貼圖，不能刷下班卡',era:'圖像史冊・父子接力',speaker:'rick',sourceIds:['imageRick'],minTurn:2,weight:1.35,
  body:'Wing 在群組貼了一個加油表情，說知道大家最近很辛苦。你正想收電腦，Rick 緊接著補上：今天的結果還沒出來，先不要走。上面那則訊息像慰問，下面那則才有執行權。你盯著兩個相鄰的頭像，第一次覺得聊天軟體應該支援左右聲道。',
  wing:'老闆都這麼體諒大家了，我們也要拿出一點成果吧。',
  choices:[
   c('把剩餘工作與明早能交的項目寫清楚。','Rick 回了「我再跟 Wing 說」。你把今晚能完成的部分交出去，也把明天從今晚救回來。那個加油貼圖終於有了下班時間。',{skill:9,trust:8,boss:-13,mood:4,energy:5},['evidence']),
   c('回一個更大的加油貼圖，留下來。','你的貼圖比 Wing 的大，螢幕上的工作卻一項也沒縮小。Rick 說團隊有你真好，然後請你順便幫他整理明天要報告的版本。',{lick:9,boss:12,energy:-15,mood:-12}),
   c('問同事要不要先吃飯，再一起列真正的卡點。','大家終於發現卡住的是一個尚未拍板的需求，不是誰不夠努力。晚餐還是自己付，至少這次沒有拿表情符號配飯。',{cash:-5,trust:12,skill:5,energy:7,mood:6,boss:-8},['archive'])
  ]
 },
 {
  id:'rick-traffic-diet',title:'帳單要瘦，流量要胖',era:'圖像史冊・雙向管理',speaker:'rick',sourceIds:['imageRick'],minTurn:3,
  body:'Wing 要推播加量、成效起飛；Rick 把同一張需求單轉給你，附上「成本再壓一下」。你把兩句話放進試算表，發現最省錢的方案是不要發，成效最好的方案是不要看帳單。技術資深經理看完，只把兩個目標都改成了紅字。',
  wing:'成本要降，效果也要有。這就是你們專業要處理的地方。',
  choices:[
   c('列出三種投放規模，請他選一種。','Rick 問能不能把最便宜和最多量的那兩格合併。你保留原表，另外加了一欄「需要取捨」。這張表終於開始描述現實。',{skill:11,trust:7,boss:-12,energy:-6,mood:-5},['evidence']),
   c('先答應都做到，再自己調整與補洞。','報表暫時漂亮，Rick 說成本控制有成。你多維護兩套設定，成為整張預算裡唯一不需要重新報價的資源。',{boss:12,lick:5,skill:5,energy:-15,mood:-11}),
   c('找同事先做小範圍測試，帶數字回來。','測試讓兩種要求第一次出現在同一張圖上。Rick 把圖往上轉，刪掉了「先做小範圍」五個字。你把完整版本留在團隊裡。',{skill:10,trust:9,energy:-7,boss:-6,mood:-4},['archive','evidence'])
  ]
 },
 {
  id:'wing-self-reminder',title:'會議是他開的，寂寞也是',era:'圖像史冊・找老闆任務',sourceIds:['imageWing'],
  body:'Wing 在群組宣布要看流程圖，你準時進了會議連結。幾分鐘後，群組跳出他的新訊息：怎麼都沒有人找我？你看看有他的邀請名單，再看看沒有他的會議室，開始懷疑行事曆只是某種邀請大家猜心的裝置。',
  wing:'事情是你們要主動推，不是每次都等我。',
  choices:[
   c('打電話請他入場，再寄一次同一個連結。','Wing 進場後說大家效率要提高。你把「邀請老闆參加老闆的會議」加進準備清單，這份專案計畫終於反映真實工作量。',{lick:7,boss:10,energy:-8,mood:-8}),
   c('把連結、時間和待確認項目一起貼回群組。','資訊已經無法更齊全。Wing 說不用把事情講得那麼複雜，你確認最後一個阻塞項目確實不在流程圖裡。',{skill:8,trust:7,boss:-11,mood:-5},['evidence']),
   c('請同事繼續討論，自己去找人。','流程圖在沒有老闆的十分鐘裡完成大半。你回來時，他說討論怎麼可以漏掉他；大家把剛剛的結論重新講了一遍。',{trust:10,slack:6,boss:-6,energy:-6,mood:-4},['archive'])
  ]
 },
 {
  id:'wing-hello-integration',title:'串接進度：哈囉，Wing',era:'圖像史冊・問候已上線',sourceIds:['imageWing'],roles:['system','ai','mis','project','product','bd','sales'],
  body:'展示日期逼近，Wing 在對接群組催資料、催測試，也催對方回覆。窗口終於出現，先熱情地向 Wing 問好，然後沒有然後。群組從未讀變已讀，整合進度從零變成有禮貌。你被問能不能先安排展示。',
  wing:'對方不是已經回了？你們還卡在哪裡？',
  choices:[
   c('把缺少的資料列成三個可以回答的問題。','第二封回覆終於有了內容。Wing 問為什麼不早這樣問，你沒有解釋第一封其實也有問題，只是招呼比較搶眼。',{skill:10,trust:7,energy:-6,boss:-8,mood:-4},['evidence']),
   c('先做假資料展示，註明尚未完成串接。','畫面可以操作，Wing 對展示很滿意，對「尚未完成」四個字不太滿意。你把註記留著，免得下週連問候都被算成正式交付。',{skill:8,boss:7,energy:-10,mood:-6},['evidence']),
   c('回一個同樣熱情的招呼，等真正的答案。','整個群組非常友善，系統仍然不認識彼此。你替同事存下這段對話，命名為「社交成功，技術待辦」。',{slack:9,trust:5,boss:-12,mood:3},['archive'])
  ]
 },
 {
  id:'wing-ranked-architecture',title:'系統架構，突然開始排位',era:'圖像史冊・技術段位',sourceIds:['imageWing'],roles:['system','ai','mis','project','product','executive'],
  body:'你把服務分成四個角色，詢問 Wing 哪一層負責什麼。他回來一串像遊戲段位的名稱，要你照重要程度排好。工程師在問依賴關係，老闆在排鑽石、黃金、白銀。投影片倒是第一次出現這麼明確的階級。',
  wing:'你先把層級分清楚，不要什麼東西都放在一起。',
  choices:[
   c('保留他的名稱，補上真正的職責與資料流。','架構終於能用了。大家私下仍叫它排位圖，因為最底層承接最多工作，最上層只負責發光。',{skill:12,trust:8,boss:5,energy:-9,mood:-5}),
   c('問清楚升一個牌位，需要增加哪個功能。','Wing 說你不要一直鑽牛角尖。你認真把「鑽」字從圖上拿掉，這是今天唯一完成的需求變更。',{skill:6,trust:7,boss:-17,mood:5},['archive','evidence']),
   c('先把圖做得像豪華會員方案。','漸層、金框和閃亮圖示都有了。Wing 終於點頭，開發團隊則需要另一張沒有美術特效的圖才能開工。',{lick:9,boss:12,skill:-3,energy:-7,mood:-8})
  ]
 },
 {
  id:'wing-three-status-channels',title:'同一個進度，三個人各催一次',era:'圖像史冊・重工協作',sourceIds:['imageWing'],minTurn:2,
  body:'你已經追過客戶，也更新了群組。兩位主管另開一個對接視窗，取得相同消息後，再請你去追一次。三邊都覺得自己正在推動事情，你則成為唯一必須在三個地方證明事情有被推動的人。',
  wing:'我們都在幫你追了，你自己也要更積極一點。',
  choices:[
   c('把三條訊息合成一份狀態，請大家共用。','同事終於不用對照三個版本。Wing 問你是不是在限制大家溝通，你說只是想讓同一個答案不用升級成三個專案。',{skill:10,trust:10,boss:-12,energy:-5,mood:-5},['evidence']),
   c('在三個群組分別回「已追蹤」。','你的回覆速度非常快，因為內容完全一樣。今天完成九次回報、一次工作，工作量看起來終於符合主管期待。',{slack:10,lick:5,boss:9,energy:-8,mood:-8},['loop']),
   c('直接約一場共同確認，讓窗口只答一次。','答案第一次同時抵達所有人。散會後仍有一位主管私訊問你進度，你把共同確認的紀錄傳回去，練習一種沒有聲音的耐心。',{skill:8,trust:7,boss:-6,energy:-6,mood:-3},['archive'])
  ]
 },
 {
  id:'wing-leave-forecast',title:'需求可以明天改，特休今天就要猜',era:'圖像史冊・人生預報',speaker:'hope',sourceIds:['imageWing','imageExit'],minTurn:3,
  body:'下個月的需求還沒確定，行政通知卻要你今天填好下個月會休哪幾天。空白的欄位會被當成沒有安排。你的人生突然比產品路線圖更需要提前鎖版；臨時發生的事，似乎也應該先預約。',
  wing:'先把安排填清楚，這樣大家才好作業。',
  choices:[
   c('先填已確定的日期，註明其他安排待確認。','表格多了幾個「待確認」，看起來很像公司的需求文件。你總算找到一種組織已經很熟悉的表達方式。',{skill:7,slack:6,boss:-7,mood:4},['evidence']),
   c('把可能用到的日子全部先填上去。','Hope 問你怎麼安排這麼多。你說只是提前規劃，她說規劃也要合理；未來的你還沒出場，已經先被約談。',{slack:10,boss:-12,mood:-5,energy:-4}),
   c('先配合填完，再和同事整理調整窗口。','大家知道該找誰處理變動，少了一點通靈。表格還是不接受未來不可預測，至少同事接受。',{trust:11,skill:7,energy:-6,mood:-3},['archive'])
  ]
 },
 {
  id:'rick-credit-heirloom',title:'免費額度，不是傳家寶',era:'圖像史冊・雲端理財課',speaker:'rick',sourceIds:['imageRick'],roles:['system','ai','mis','project','product'],minTurn:3,
  body:'雲端試用額度快用完了，你把到期提醒轉給 Rick。他翻出很久以前的申請成功通知，問為什麼不是一直免費。那封信被轉過太多次，裡面的抵用金看起來已經有了永久居留權。',
  wing:'不是已經申請過了？那筆額度怎麼會沒有？',
  choices:[
   c('把起算日、使用量與剩餘額度畫在一起。','Rick 終於看出額度會減少，接著問能不能再申請一次。你的圖很成功，把技術問題轉回了許願問題。',{skill:11,trust:6,boss:-10,energy:-6,mood:-5},['evidence']),
   c('先把低使用量的服務降規，減少支出。','帳單暫時變小。Rick 回報自己已經協調好成本，你回報服務哪些部分會變慢；兩份報告，剛好各自擁有一半現實。',{skill:9,boss:9,energy:-10,mood:-8}),
   c('請他一起選擇續用或停用，不先替人答應。','會議忽然需要更多時間。至少這一次，免費額度用完後，沒有自動接上你的免費晚上。',{slack:7,trust:6,boss:-12,mood:5,energy:4},['archive','evidence'])
  ]
 },
 {
  id:'rick-forwarded-owner',title:'轉寄一次，責任就換人了',era:'圖像史冊・溝通句型班',speaker:'rick',sourceIds:['imageRick'],minTurn:3,
  body:'Rick 把一封尚未處理的信轉給你，說只是先讓你知道。隔天被問進度時，他表示已經交由你負責。你回頭找原信，沒有需求、沒有期限，只有一句「參考」。原來在這裡，知會可以隔夜熟成為承諾。',
  wing:'我都轉給你了，你怎麼沒有主動接起來？',
  choices:[
   c('回信列出誰決定、誰執行，以及還缺什麼。','Rick 說你寫得很像公文。你以前也覺得不用寫這麼清楚，直到「給你看看」開始算工作分配。',{skill:9,trust:8,boss:-13,energy:-5,mood:-5},['evidence']),
   c('先把事情做完，再把完整經過補到信裡。','事情解決了，Rick 對上回報「已處理」。至少同事看得見是誰處理的，你把這當成目前唯一有同步成功的欄位。',{skill:8,trust:10,boss:7,energy:-14,mood:-8}),
   c('把那句「參考」做成自己的責任確認範本。','下次收到轉寄，你只回三個問題。Rick 說你最近很難溝通，同事卻紛紛來要範本。這堂溝通課終於有人學會保護自己。',{slack:8,trust:10,boss:-11,mood:5},['archive'])
  ]
 },
 {
  id:'rick-resurrected-instance',title:'主機復活了，責任找離職的人',era:'圖像史冊・復活帳單',speaker:'rick',sourceIds:['imageRick','imageExit'],roles:['system','ai','mis','project','product'],minTurn:4,
  body:'交接表寫著服務已停用，新的帳單卻顯示它又活了。Rick 在群組詢問離職同事當初怎麼處理的，彷彿走出公司的人還隨身攜帶電源開關。你看著後來的操作紀錄，覺得真正需要交接的是時間先後順序。',
  wing:'先問清楚前一個人，不要到最後又變成沒人知道。',
  choices:[
   c('先查重新啟用的時間與用途，再決定下一步。','你找到最近一次變更。Rick 說不用追究誰做的，先處理就好；這個原則總是在紀錄查完之後才出現。',{skill:12,trust:9,boss:-12,energy:-7,mood:-5},['evidence']),
   c('把未使用的部分關掉，補上確認流程。','帳單下個月有機會正常。Rick 說交接果然要盯緊，你把「誰可以再打開」也寫進流程，免得月底又有復活節。',{skill:10,boss:6,energy:-9,mood:-6},['evidence']),
   c('替離職同事整理交接紀錄，請現任窗口接手。','這次沒有再問已經離開的人要不要順便修一下。Rick 不太高興，對方倒是回了你一個真心的謝謝。',{trust:14,mood:7,boss:-16,energy:-5},['archive'])
  ]
 },
 {
  id:'exit-bot-acknowledgment',title:'離職流程裡，機器人最積極',era:'圖像史冊・自動回覆',speaker:'sonny',sourceIds:['imageExit'],minTurn:3,
  body:'同事要離開了，人事群組還在確認收卡、交接與文件。自動排程機器人卻已經把提醒完整重貼一次，並準時表示收到。Wing 不在場，Erich 等文件、JenJen 等確認、Sonny 等帳號清單；唯一不需要再催的人，沒有員工編號。',
  wing:'先確認該確認的人真的看過，不要只看到機器人回覆。',
  choices:[
   c('把各項負責人與完成狀態重新列清楚。','機器人的「收到」被移出完成欄。真人終於開始回覆，你發現流程最大的自動化成果，是讓大家承認還有人要做事。',{skill:10,trust:10,energy:-7,mood:-4},['evidence']),
   c('先回「收到」，讓自己的訊息排在機器人旁邊。','群組看起來相當有效率，待辦一項沒少。你學會了這間公司最容易被驗收的功能：有回應。',{slack:9,lick:5,boss:8,mood:-7,trust:-4},['loop']),
   c('私下提醒同事確認實際文件，不只看已讀。','對方逐項確認後，終於不用猜哪個「好了」真的代表好了。這次道別至少多了一個把人當人的窗口。',{trust:14,mood:6,boss:-7,energy:-5},['archive'])
  ]
 },
 {
  id:'farewell-perfect-attendance',title:'唯一全員自願出席的聚會，是歡送會',era:'圖像史冊・下班出席率',sourceIds:['imageExit','imageOffice'],speaker:'self',minTurn:3,
  body:'平常約會議要追三次，離職同事的飯局卻一下就湊齊了。沒有人做簡報，也沒有人問要怎麼量化這頓飯的效益。合照裡大家笑得特別自然，你突然理解：原來團隊凝聚力一直都在，只是不一定想留在辦公室。',
  wing:'這次沒有待辦，誰餓了就先吃。',
  choices:[
   c('到場吃飯，認真祝對方下一站順利。','大家交換近況，笑到不需要解釋前因後果。帳單自己分，這次每個人都覺得有花在值得的地方。',{cash:-7,trust:15,mood:13,energy:7}),
   c('替大家整理一本只有同事看得懂的留言簿。','有人只寫一個時間，有人畫了一張椅子，每一頁卻都有人笑出來。你沒有留下客戶資料，留下的是大家怎麼一起撐過來。',{trust:13,mood:10,energy:-5},['archive']),
   c('今天先休息，傳一段不用客套的祝福。','對方說下次再約，不需要你補交缺席報告。你把手機放下，享受一場終於可以自由決定參不參加的活動。',{mood:9,energy:13,trust:5,slack:5})
  ]
 },
 {
  id:'wing-growth-empty-seats',title:'公司持續成長，座位持續變空',era:'圖像史冊・成長公告',speaker:'hope',sourceIds:['imageWing','imageExit'],minTurn:4,
  body:'Wing 的公告說大家是一起成長的夥伴，Hope 接著通知組織調整正在進行。你回座位才發現，同事的交接清單已經寄過來。兩則訊息都很正面，只有待辦清單看起來知道發生了什麼事。Wing 沒有參加後面的說明會。',
  wing:'調整是為了團隊更好，手上的事情還是要持續往前。',
  choices:[
   c('先確認留下的工作，哪些真的有人接。','你把名字和工作一個個對上，表格空白比公告誠實。Hope 說會再協調，至少這次缺口有被寫出來。',{skill:9,trust:10,boss:-12,energy:-7,mood:-8},['evidence']),
   c('在公告底下回覆感謝公司安排。','你的文字跟公告一樣穩定，心情則不在同一個版本。隔天又多了一份交接，你獲得成長最直接的證據。',{lick:10,boss:12,trust:-6,energy:-10,mood:-12}),
   c('幫離開的同事把交接範圍畫出終點。','離開的人不用無限期回覆，留下的人也知道去哪裡找資料。你們沒有替公告補掌聲，替彼此補了一點邊界。',{trust:14,skill:7,boss:-10,mood:4,energy:-6},['archive','evidence'])
  ]
 },
 {
  id:'rick-fault-friendship',title:'系統故障，先檢查你的人緣',era:'圖像史冊・有溫度的除錯',speaker:'rick',sourceIds:['imageRick'],roles:['system','ai','mis','project','product'],minTurn:2,weight:1.3,
  body:'你在群組追問故障原因，Rick 還沒提供資訊，話題先轉成你的文字太冷。Wing 希望大家多用有溫度的溝通。監控圖上明明是服務異常，會議最後卻在檢討你是不是人緣不好。機房冷氣不用修，修你的語氣就好。',
  wing:'你不要每次都用文字追，有時候一通電話就能解決。',
  choices:[
   c('打電話確認，再把時間線補回工單。','電話很有溫度，故障原因仍然需要文字。你把資訊整理好，讓下一個接手的人不用先和每位主管建立友誼。',{skill:11,trust:9,energy:-7,boss:-7,mood:-5},['evidence']),
   c('每個問題前面都加一個笑臉。','Rick 說這樣溝通就好多了。同一個錯誤訊息，附上微笑後竟然順利進入待辦；系統沒有修好，人類介面先通過測試。',{lick:9,slack:6,boss:10,mood:-8}),
   c('請 Rick 一起對照監控，先把服務救回來。','他開始描述要如何對上報告，你把游標留在故障時間。系統恢復之後，你們終於有了一件共同知道的事：這原本是技術問題。',{skill:10,trust:10,boss:-12,energy:-10,mood:3},['archive'])
  ]
 },
 {
  id:'rick-bot-committee',title:'機器人補習班，原作者不用出席',era:'圖像史冊・五人救援',speaker:'rick',sourceIds:['imageRick'],roles:['system','ai','mis','project','product'],minTurn:3,
  body:'機器人答錯問題，Rick 找了五個人來檢查、抄寫、補資料。你提議問一下寫這套系統的同事，他說先不用找。會議排得很完整，懂問題的人則被完整地排除在外。你不知道這是在教機器人，還是在讓人類重修打字。',
  wing:'大家先一起做，不要什麼事都只找同一個人。',
  choices:[
   c('請原作者花十分鐘說明資料應該放哪裡。','一個設定問題解釋完，半張手工清單不必再填。Rick 說他本來也是這個方向，你把省下的時間還給真正需要做事的人。',{skill:11,trust:12,boss:-10,energy:5,mood:5},['evidence']),
   c('先跟大家手動補十題，確認會不會真的改善。','十題裡有七題根本不是缺答案。你們停止大量輸入，留下可重現的問題；至少機器人補習班這次有考試範圍。',{skill:9,trust:9,energy:-8,mood:-4},['evidence']),
   c('做一張漂亮的五人分工表。','Rick 看見分工就放心了，機器人仍然只認得舊資料。你成功讓一個問題擁有五個窗口，以及一位負責報告分工的主管。',{lick:8,boss:11,trust:-5,energy:-7,mood:-9},['loop'])
  ]
 },
 {
  id:'rick-attitude-update',title:'Rick 更新完成，請勿重新啟動',era:'圖像史冊・平行職場',speaker:'rick',sourceIds:['imageRick','characterFiction'],minTurn:3,
  body:'這一回的平行職場裡，Rick 剛才還說你的問題不是問題，接完 Wing 的電話後，忽然開始討論如何改善溝通。他的語氣和十分鐘前完全不同，像收到一個只對上級開放的更新檔。你想知道這次修正能維持到哪一版。',
  wing:'剛才可能有些誤會，我們還是把事情一起做好。',
  choices:[
   c('接受這個開場，直接確認接下來誰做什麼。','這次確實談出幾項安排。你沒有替他的改變寫頒獎詞，只把難得能正常工作的時段用在工作上。',{skill:8,trust:8,boss:5,energy:4,mood:6}),
   c('把改善事項記下來，約好下次確認時間。','Rick 說不用這麼正式。你說只是怕好不容易更新成功，下次登入又回到預設值。承諾終於有了可以打勾的地方。',{skill:10,trust:10,boss:-11,energy:-4,mood:5},['evidence']),
   c('稱讚他這次真的很有主管風範。','Rick 立刻恢復自信，開始分享自己一直以來的管理理念。道歉只花兩分鐘，理念花了二十分鐘；你對版本回退有了具體理解。',{lick:10,boss:12,energy:-9,mood:-9},['archive'])
  ]
 },
 {
  id:'rick-meeting-semantics',title:'我說不能到，他說我取消了',era:'圖像史冊・會議語意學',speaker:'rick',sourceIds:['imageRick'],minTurn:2,
  body:'你按原流程通知排程窗口，說這次會議無法出席。Rick 卻問你為什麼擅自取消會議。你指出會議還在，他立刻把「取消」換成「不能參加」，繼續要求你檢討。字改了，責任沒有；議程新增一場討論缺席的會議。',
  wing:'不管你叫它什麼，你都應該先讓 Wing 知道。',
  choices:[
   c('把原通知與會議狀態並列，確認這次缺哪一步。','討論終於從你的態度回到通知流程。Rick 說你很愛咬文嚼字，你想那是因為這些字剛剛差點咬到你。',{skill:9,trust:7,boss:-14,mood:4,energy:-5},['evidence']),
   c('依新說法，把所有相關的人都通知一遍。','行政、主管、主持人都收到一樣的訊息。Rick 說這樣才完整；你的人生少了一點時間，大家的信箱多了一點團隊精神。',{lick:7,boss:11,energy:-9,mood:-8}),
   c('問清楚這場檢討會若改時間，要通知哪個窗口。','Rick 停了一下，開始重新解釋流程。同事把你剛問的句子記下來，列為以後開會前的共同檢查項目。',{slack:8,trust:10,boss:-15,mood:6},['archive'])
  ]
 },
 {
  id:'wing-four-word-review',title:'萬用驗收詞：亂七八糟',era:'圖像史冊・四字回饋',sourceIds:['imageWing'],weight:1.2,
  body:'簡報、功能、流程，各有各的問題，Wing 的回覆卻很一致：亂七八糟。你問哪裡要調整，他叫你自己想。你把幾次回覆排在一起，發現這間公司最穩定的產品，是老闆的驗收詞庫。',
  wing:'這還要我一個一個教？你自己看不出來嗎？',
  choices:[
   c('拿出兩個具體版本，請他指出比較接近的那個。','Wing 終於選了一個，附贈一句兩個都還有進步空間。你至少把修改範圍從整個宇宙縮到一張畫面。',{skill:10,trust:7,boss:-10,energy:-6,mood:-4},['evidence']),
   c('把排版整齊一點，重新送同樣的內容。','這次收到「好多了」。你仔細比對後確認，四個字有時候真的只是在評論間距。這項發現暫時不列入正式報告。',{slack:10,boss:10,skill:-3,mood:3},['archive']),
   c('先和同事確認實際使用時卡在哪裡。','你們找到三個能修的問題。Wing 還是不滿意，同事卻真的少做了幾次重工；今天的進度終於有了四個字以外的證明。',{skill:10,trust:12,boss:-9,energy:-8,mood:4},['evidence'])
  ]
 },
 {
  id:'office-chairman-mv',title:'行銷部今日出道，產品下週再推',era:'圖像史冊・生日專案',sourceIds:['imageOffice','imageWing'],minTurn:3,
  body:'你正趕產品活動，新的最高優先事項突然插進來：董事長生日影片。要有溫度、有創意，最好看起來大家都很開心。Spencer 的祝福片單開好了，產品宣傳還在等排程；你第一次知道行銷漏斗最上面那層叫壽星。',
  wing:'這也是企業文化，不要覺得只有產品才算工作。',
  choices:[
   c('做一支短版祝福，把時間留給原本活動。','影片準時完成，產品也沒有完全消失。Wing 問能不能再感人一點，你把長度守在大家還能真心祝福的範圍。',{skill:9,slack:7,boss:-7,energy:-7,mood:-4}),
   c('全力剪成年度鉅獻，連片尾都做動畫。','掌聲屬於壽星，凌晨屬於你。Wing 說這才像團隊，產品活動則成功學會在沒有行銷的情況下自立自強。',{lick:12,boss:16,energy:-16,mood:-11,dream:-5},['allin']),
   c('邀同事各講一句，保留真正的笑場。','片子沒有史詩配樂，倒是真的有人在笑。你們記住的是彼此講錯台詞的那幾秒，還有拍完終於可以回去做正事。',{trust:13,mood:7,skill:5,energy:-7,boss:-5},['archive'])
  ]
 },
 {
  id:'pip-lucky-mushroom',title:'續命蘑菇亮著，改善表還是要交',era:'圖像史冊・PIP限定',speaker:'hope',sourceIds:['imageExit'],context:'pip',minTurn:2,weight:5,
  body:'PIP 還在進行，同事在你桌上放了一盞綠色蘑菇小燈，說希望可以續命。你笑了一下，Hope 的提醒就到了。Wing 仍然不出席，表格卻準時上班。燈會發光，沒有自動填寫改善報告的功能。',
  wing:'大家的心意我理解，但這次還是請你提供具體成果。',
  choices:[
   c('讓它照著桌面，把交付與要求逐項整理。','你完成一份有時間、有成果的紀錄。蘑菇沒有替你改評分，至少陪你把該屬於自己的證據整理好了。',{skill:10,trust:6,mood:5,energy:-6},['evidence']),
   c('拍張只給同事看的照片，謝謝這份荒謬的祝福。','群組裡多了幾個笑臉，沒有任何主管通知。你知道它不是保證過關的道具，卻確實讓今天比較像自己的人生。',{trust:12,mood:12,energy:4},['archive']),
   c('請同事一起看報告，找出還缺哪一份資料。','有人幫你補上一段交接紀錄。原來真正能幫忙的不是蘑菇，是送蘑菇的人；Hope 的表格終於多了一項可確認的內容。',{skill:8,trust:13,mood:7,energy:-5},['evidence'])
  ]
 },
 {
  id:'wing-message-lottery',title:'你的留言，正在參加生存遊戲',era:'圖像史冊・群組抽籤',sourceIds:['imageWing'],minTurn:2,weight:1.5,
  body:'Wing 宣布要整理群組，部分留言會被隨機刪除。你剛打好的進度報告，突然比抽獎券還刺激。同事問以後要怎麼查紀錄，你看著輸入框，覺得這可能也是一則活不久的問題。',
  wing:'群組不要塞那麼多東西，重要的自己要知道。',
  choices:[
   {...c('照平常的格式，直接送出進度。','你送出留言，等待群組回應。',{}),draw:{label:'群組抽籤',outcomes:[
    {weight:1,label:'留言存活',result:'報告留在群組裡。Wing 問你為什麼還要另外通知他，你一時不知道該慶祝它有被看到，還是先為通知道歉。',delta:{skill:6,boss:6,mood:-3}},
    {weight:1,label:'整則消失',result:'剛剛的報告不見了。Wing 過一會兒問你怎麼沒有回報，你看著空白，理解了為什麼史冊不能只存一份。',delta:{energy:-7,mood:-10,boss:-7},flags:['archive']},
    {weight:1,label:'只剩標註通知',result:'內容不見，標註 Wing 的通知倒是活了下來。他問找他什麼事，你只好把已經回報過的事再講一次。',delta:{energy:-6,mood:-8,boss:-10}}
   ]}},
   {...c('先存完整紀錄，群組只貼摘要與連結。','你送出留言，等待群組回應。',{},['evidence']),draw:{label:'群組抽籤',outcomes:[
    {weight:1,label:'摘要存活',result:'摘要順利留下，同事從連結找到完整進度。今天的文件成功擁有一個不靠老闆心情維持的住址。',delta:{skill:10,trust:9,energy:-5,mood:4}},
    {weight:1,label:'摘要消失，備份還在',result:'摘要被清掉了，但完整紀錄還在。Wing 要你重新回報時，你貼回同一份連結；這次多做的準備，真的替你少做了一次白工。',delta:{skill:9,trust:9,energy:-6,boss:-8,mood:2}},
    {weight:1,label:'連結被嫌太多',result:'Wing 說不要什麼都丟連結。你保留文件，另外口頭說明；工作依然做了兩次，至少證據不用重新出生。',delta:{skill:7,trust:7,energy:-9,boss:-10,mood:-5}}
   ]}},
   {...c('先感謝 Wing 指導，再把進度放到後面。','你送出留言，等待群組回應。',{}),draw:{label:'群組抽籤',outcomes:[
    {weight:2,label:'整段保留',result:'感謝與進度都留下了。Wing 回了一個讚，同事研究了一下你的開場，彷彿找到新的檔案格式。',delta:{lick:11,boss:13,trust:-5,mood:-5}},
    {weight:1,label:'只記得感謝',result:'Wing 說你態度很好，接著問事情做到哪裡。你把同一段訊息的後半部再貼一次，練習感謝與交付分開存放。',delta:{lick:8,boss:7,energy:-7,mood:-7}},
    {weight:1,label:'感謝也沒保住',result:'整段一起消失了。你發現舔功能影響很多事，但今天的刪除鍵顯然不接受保證書。',delta:{lick:3,boss:-8,trust:-5,mood:-11}}
   ]}}
  ]
 }
 ,{
  id:'bonus-phishing-rehearsal',title:'獎金通知，比獎金先到',era:'圖像史冊・信箱驚喜',speaker:'hope',sourceIds:['imageOffice','imageExit'],minTurn:3,
  body:'信箱跳出一封季度獎金通知。你重新看了一遍主旨，確認不是去年的信，也不是自己搜尋紀錄留下的幻影。同事也收到了，辦公室出現一種久違的情緒：大家開始期待行政部門的下一個動作。',
  wing:'大家記得留意信箱，公司通知不要漏看。',
  choices:[
   c('先打開看看，今天也許真的有好消息。','畫面告訴你這是資安釣魚演練。你成功替公司提供了員工會期待獎金的研究資料，真正準時入帳的，是一堂教育訓練。',{skill:4,mood:-13,energy:-6,dream:-7}),
   c('先和同事確認來源，再決定要不要點。','你們確認這是演練信。大家沒有中招，卻也沒有因此收到獎金；至少失望這件事，有人陪著一起確認。',{skill:9,trust:12,mood:-4},['evidence']),
   c('直接問 Hope，這次什麼時候會入帳。','Hope 說這是在測試大家的資安意識。你順便問真正的獎金，對話開始沒有明確時間；原來假的通知比真的答案完整。',{skill:6,boss:-9,mood:-7,trust:7},['archive'])
  ]
 },...WING_IMAGE_SCENES
].map(event=>({minRules:4,...event}));
