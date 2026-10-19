// Original fictional scenes inspired by privately reviewed video and audio.
// Dialogue and named-character reactions are written for the game, not transcripts.
const c=(text,result,delta,flags=[])=>({text,detail:'',result,delta,flags});

export const VIDEO_EVENTS=[
 {
  id:'video-toast-performance',title:'敬酒，也要評績效',era:'影音史冊・杯底見真章',speaker:'wing',sourceIds:['videoOffice','characterFiction'],minTurn:3,
  body:'同事聚餐的影片傳回群組。原本只是走過去敬杯酒，畫面一配上「強勢出擊」，忽然像業務戰報。Wing 看完說，工作也要拿出這種氣勢。你看著手上的飲料，擔心下次連無糖綠茶都要附成交率。',
  wing:'聚餐都這麼主動了，平常開發客戶怎麼沒有？',
  choices:[
   c('笑一下，把話題帶回今天的菜。','大家開始討論哪一道最好吃，總算不用解釋為什麼敬酒不能算轉換率。Wing 說你很會岔題，你當作今天少開了一場會。',{slack:8,trust:8,boss:-9,mood:5},['archive']),
   c('順著稱讚他的帶隊氣勢。','Wing 講起團隊向心力，講到服務生來收空盤。你成功避開自己的業績，也錯過了最後一塊肉。',{lick:9,boss:12,energy:-7,mood:-7}),
   c('等聚餐結束，再跟同事剪一支只留笑場的版本。','工作群組裡是強勢出擊，朋友群組裡是拿錯杯子。你們留住了後者，沒有幫每個笑聲寫商業價值。',{trust:12,mood:7,energy:-5},['archive'])
  ]
 },
 {
  id:'video-last-handshake',title:'最後一場一對一，不在會議室',era:'影音史冊・離場加賽',speaker:'self',sourceIds:['videoOffice'],minTurn:4,weight:1.2,
  body:'準備離開的同事和主管坐到桌邊，最後一場一對一居然是比腕力。兩隻手僵在半空，旁邊的人還提醒他想想最近受的委屈、想想為什麼要走。你原本來看交接，現在得努力忍住笑：離職理由竟然也能拿來補體力。',
  wing:'交接表沒寫這一項，大家倒是全到齊了。',
  choices:[
   c('幫忙計時，到點就請兩邊放手。','最後算平手，雙方都保住面子。同事把手收回來，笑著說剩下的事情就照交接表走；這次終於不用再較勁。',{trust:11,skill:5,mood:7,energy:-4},['archive']),
   c('站在旁邊加油，把離職理由全部轉成音量。','場邊越喊越熱鬧，手臂卻還卡在原地。你發現大家記得的事情很多，能不能下班倒不是靠這場比賽決定。',{trust:9,mood:8,energy:-7,boss:-6},['archive']),
   c('等他比完，陪他把最後幾項交接收掉。','桌邊的人散了，你們把帳號、文件和待辦逐項確認。最後一起走出門的時候，他不用再證明自己比誰有力。',{trust:13,skill:8,mood:5,energy:-7},['evidence','archive'])
  ]
 },
 {
  id:'video-seven-clock',title:'BD 先輸給七點鐘',era:'影音史冊・賽程插單',speaker:'rick',sourceIds:['videoOffice','rickLore','characterFiction'],minTurn:3,
  body:'BD 開會開到七點，原本排好的三組腕力賽全沒打成。你們討論要不要替他留披薩，讓在場的人先玩別場。Rick 路過，問既然都在這裡，能不能順便同步一下客戶進度。大家剛等完一場會議，現在又有人想開一場。',
  wing:'不用正式開會，大家快速講一下就好。',
  choices:[
   c('替 BD 留幾片披薩，請在場的人先玩。','Rick 說只是確認一下，你提醒大家已經等了一場會議。披薩先留下，其他人總算開始下一場；今天不想再為「等一下」繼續等。',{trust:12,boss:-12,mood:4,skill:5},['evidence']),
   c('打開進度表，真的快速講一次。','你講完客戶，Rick 接著問其他案子。比賽已經收桌，這場「不用正式開會」還在延長賽。',{skill:7,lick:5,boss:10,energy:-13,mood:-11},['loop']),
   c('請他把想問的問題寫在共用表裡。','Rick 問能不能請你先整理。你把空白欄位留給他，同事則把對戰表收好；至少兩張表的負責人都有名字。',{skill:9,trust:8,boss:-10,energy:-5,mood:3},['evidence'])
  ]
 },
 {
  id:'video-pizza-overtime',title:'三片披薩，十秒鐘人情',era:'影音史冊・補給條款',speaker:'sonny',sourceIds:['videoOffice','characterFiction'],minTurn:2,
  body:'Sonny 吃完披薩，有人邀他下場比腕力。大家開始談條件：先讓幾秒、能不能錄影、剛吃那幾片算不算補給。你平常排一個需求要問三輪，今天大家倒是很快知道哪些條件必須先講清楚。',
  wing:'先講好喔，不要比完才改規則。',
  choices:[
   c('先問清楚能不能拍，再幫忙計時。','同意的才拍，有人不想被拍，就把手機收起來。規則花了半分鐘講完，比平常確認一個按鈕要放哪裡快得多。',{trust:12,skill:7,mood:5,energy:-4},['evidence']),
   c('自己也拿片披薩，坐旁邊看就好。','你沒有參加，仍然順利吃到補給。今天的觀眾席沒有考核，胃口也不用證明自己值得。',{slack:9,mood:7,energy:6,trust:4}),
   c('提議大家輪流休息，別拿手腕硬撐。','比賽多了幾次休息，笑聲沒有變少。有人說公司排工作也該這樣，你們決定先不要把快樂弄得太複雜。',{trust:11,skill:5,mood:6,energy:4},['archive'])
  ]
 },
 {
  id:'video-no-strength',title:'他說沒力，手卻沒有鬆',era:'影音史冊・口頭資源',speaker:'self',sourceIds:['videoOffice'],minTurn:3,
  body:'兩個人僵持好一陣子，其中一位開始喊沒力了，手卻一點也沒鬆。場邊有人忍不住吐槽。你聽著覺得耳熟：平常也常有人說資源很緊、大家都很辛苦，交辦事情時倒是從來沒少一項。',
  wing:'嘴上說沒力，手上的要求還是很有力。',
  choices:[
   c('看手的位置判勝負，不靠喊話。','叫得比較累的人沒有因此獲勝。你替這條規則鼓掌，也希望下次排工作時，大家願意看剩餘工時。',{skill:8,trust:8,mood:5,boss:-5},['evidence']),
   c('幫他喊加油，把這局撐到底。','他終於放手，說自己早就沒力了。你也喊到喉嚨乾，支援別人果然也得消耗自己的體力。',{trust:9,energy:-10,mood:4}),
   c('問兩邊要不要平手，下一組還在等。','大家笑著鬆手，沒有誰需要寫檢討。後面的人接著上場，你第一次覺得主動停下來也能讓事情繼續。',{slack:8,trust:10,mood:7,energy:3},['archive'])
  ]
 },
 {
  id:'video-referee-committee',title:'裁判人數，超過參賽人數',era:'影音史冊・人人有意見',speaker:'self',sourceIds:['videoOffice'],minTurn:2,
  body:'桌邊只有兩個人比腕力，旁邊卻同時有人數秒、有人喊開始、有人說還不算。選手還沒分出輸贏，裁判先有三種版本。你站在人群裡，想起早上那場每個人都能追加一句、沒人肯拍板的會議。',
  wing:'先等一下，剛才到底是誰喊開始？',
  choices:[
   c('請大家只留一位裁判，其他人負責加油。','倒數終於只有一個聲音，比賽也總算開始。你沒有得到什麼職稱，卻替整桌省了好幾輪對齊。',{skill:10,trust:10,mood:5,energy:-5},['evidence']),
   c('加入倒數，喊得比其他人更大聲。','你的版本成功被聽見，又立刻被另一個聲音蓋過。這場比賽還沒動手，你已經體驗完跨部門協作。',{lick:3,trust:4,energy:-9,mood:-5},['loop']),
   c('站遠一點拍全景，留給大家自己看。','回放裡每個人都像總指揮，選手反而最安靜。大家看完笑成一團，這次沒人要求你整理會議紀錄。',{slack:8,trust:10,mood:7,energy:-4},['archive'])
  ]
 },
 {
  id:'video-designer-benchmark',title:'工程師跑分，設計師比腕力',era:'影音史冊・跨部門對決',speaker:'self',sourceIds:['videoOffice'],minTurn:2,
  body:'工程和設計坐到桌子兩邊，同事把這場比賽喊成跨部門對決。平常吵的是按鈕能不能做、畫面能不能改，今天大家終於同意只看手先碰到哪一邊。你的電腦跑分很高，對這場比賽沒有任何幫助。',
  wing:'這次沒有「技術上可行，但需要一點時間」。',
  choices:[
   c('替設計加油，今天讓改稿的人贏一回。','工程師抗議你選邊，設計師笑得很開心。你們沒有因此少一輪修改，但下次開需求會，至少多了一個能拿來破冰的梗。',{trust:10,mood:7,energy:-5},['archive']),
   c('兩邊都加油，誰贏都請他分享心得。','心得是記得吃飯、不要硬撐。這份跨部門共識意外簡短，大家也真的接受了。',{trust:12,skill:5,mood:6,energy:3}),
   c('把勝負記在白板，拒絕追加規格。','白板第一次只用一行就結案。有人說還能三戰兩勝，你指著已經寫好的結果，難得守住了一次範圍。',{skill:8,slack:7,trust:7,mood:5},['evidence'])
  ]
 },
 {
  id:'video-rick-commentary',title:'Rick 不上場，戰報照樣歸他',era:'影音史冊・戰略觀戰席',speaker:'rick',sourceIds:['videoOffice','rickLore','characterFiction'],minTurn:4,weight:1.25,
  body:'辦公室腕力賽正熱鬧，Rick 坐在旁邊說自己負責看全局。你以為他的任務是加油，他卻請你記下每場結果，等一下好跟 Wing 報告團隊氣氛。上場的人出力，場邊的人交影片，技術資深經理準備發表心得。',
  wing:'我先觀察。你比完把重點整理給我，我幫大家往上報。',
  choices:[
   c('把白板轉向他，請他自己記觀察。','Rick 說不用弄得那麼正式，你把筆也遞過去。最後戰報只有一句「大家很投入」，原來他的全局觀真的可以一眼看完。',{skill:8,trust:10,boss:-12,mood:5},['evidence']),
   c('剪片、記分、整理成一頁報告交給他。','Rick 把報告轉給 Wing，附上一句「今天帶大家活動一下」。你看見自己的檔名留在附件，作者那一欄倒是沒有跟著往上走。',{skill:6,lick:7,boss:12,energy:-13,mood:-11},['loop']),
   c('只把大家同意分享的合照傳進同事群組。','比賽留在大家的回憶裡，沒有長成一份主管成果。Rick 問報告呢，你說結果都寫在白板上，手機也沒有替他再開一個專案。',{trust:13,slack:7,boss:-10,mood:6},['archive'])
  ]
 },
 {
  id:'video-message-workout',title:'未讀訊息，是你的重訓教練',era:'影音史冊・情緒補給',speaker:'self',sourceIds:['videoOffice'],minTurn:3,weight:1.15,
  body:'腕力僵住了，場邊有人提議先想想平常螢幕裡那些內容，再看看手機訊息是誰傳的。你本來只想幫忙加油，腦袋卻自動跳出好幾個通知音。原來同一支手機，上班負責消耗體力，下班還能拿來補鬥志。',
  wing:'先別點開。光看寄件人，好像就夠了。',
  choices:[
   c('把手機翻面，專心看這場比賽。','你沒有回訊息，也沒有再多想一場會議。手腕的輸贏留給桌邊兩個人，難得的休息先留給自己。',{slack:8,mood:9,energy:5,boss:-7}),
   c('把那個寄件人講出來，大家一起笑。','不用念內容，旁邊已經有人懂了。你們沒回任何一則訊息，笑完就把話題轉回比賽；今天先不免費加班。',{trust:12,mood:8,energy:-4},['archive']),
   c('真的打開通知，把需要回的事記到明天。','你只記待辦，沒有現在開工。清單多了一行，今晚至少不用一直提醒自己還有一件事沒處理。',{skill:8,slack:5,mood:5,energy:-3},['evidence'])
  ]
 },
 {
  id:'video-wing-replay',title:'回放很熱鬧，檢討照常開',era:'影音史冊・影片驗收',speaker:'wing',sourceIds:['videoOffice','characterFiction'],minTurn:4,
  body:'同事把腕力賽剪成短片，大家笑著回看。Wing 問：「怎麼有時間做這個，工作進度呢？」你把進度表打開，他又問團隊怎麼都沒有活力。你看看正在暫停的笑臉，開始思考這份活力到底要從哪一秒交起。',
  wing:'我沒有說不能玩。你們要知道什麼時間該做什麼事。',
  choices:[
   c('把活動時間和完成的工作分開列清楚。','Wing 說不用每件事都講那麼細，你仍把時間留在表上。至少下次回放，不必順便重演一次工時辯論。',{skill:9,trust:8,boss:-12,energy:-6,mood:-4},['evidence']),
   c('替影片加上「團隊凝聚」四個字再送一次。','Wing 說這樣看起來比較有意義。片子一秒都沒改，同事的腕力倒是突然有了公司的用途。',{lick:10,boss:12,mood:-9,energy:-6},['archive']),
   c('收起影片，留到和同事吃飯時再看。','工作群組安靜了，飯桌上的笑聲沒有消失。這支片不用再交第二版，也不用替每個笑臉補一段成果說明。',{trust:12,slack:7,mood:7,boss:-8},['archive'])
  ]
 }
].map(event=>({minRules:5,...event}));
