// Original fictional workplace scenes. Private source images are not distributed.
const c=(text,result,delta,flags=[])=>({text,detail:'',result,delta,flags});

export const WING_IMAGE_SCENES=[
 {
  id:'wing-icons-worldwide',title:'全球化第一步，把字全部刪掉',era:'圖像史冊・地球級設計',speaker:'wing',sourceIds:['imageWing'],minTurn:2,
  body:'Wing 看了一眼畫面，要求把按鈕上的文字改成圖示，因為產品要面向全世界。你把「送出」換成紙飛機，他說太像聊天；換成火箭，他問為什麼這麼幼稚。地球很大，目前只有他的腦內圖庫可以使用。',
  wing:'不要每次都要用文字解釋。你們的視野要再打開一點。',
  choices:[
   c('拿幾張圖示給隔壁同事猜用途。','同事把刪除猜成回收，把儲存猜成販賣機。你帶著答案回來，替按鈕保住四個字；Wing 要你把那四個字寫得更有國際感。',{skill:10,trust:8,boss:-8,energy:-6,mood:-3},['evidence']),
   c('把整頁改成圖示，再加一個說明入口。','Wing 說這次終於簡潔。使用者點開說明，看到一篇比原本介面更長的圖示對照表。全球化完成，閱讀量也完成擴張。',{boss:10,lick:5,skill:4,energy:-10,mood:-7}),
   c('先畫三款紙飛機，請他圈一款。','他沒有圈，而是問為什麼只想到飛機。你的紙飛機在會議桌上繞了一圈，唯一沒能起飛的是下班時間。',{slack:7,boss:-9,energy:-5,mood:-6},['archive'])
  ]
 },
 {
  id:'boss-mode-migration',title:'軟體可以搬家，老闆模式要保留',era:'圖像史冊・協作搬遷',speaker:'wing',sourceIds:['imageWing','imageOffice'],minTurn:3,
  body:'公司準備換聊天軟體。訊息、檔案、群組都有搬遷清單，Wing 另外要求保留他的「boss mode」：你負責排進度，Sonny 負責搬，其他人負責配合。你研究半天，兩套軟體都沒有這個選項；原來要移植的是組織習慣。',
  wing:'工具換了，管理不能斷。星期一就開始用。',
  choices:[
   c('先找一個小群組試搬，確認檔案找得到。','測試抓出幾個斷掉的連結。Wing 問為什麼別組還沒搬，你把問題修完才放行；星期一大家至少只需要找一次檔案。',{skill:11,trust:9,boss:-8,energy:-7,mood:-4},['evidence']),
   c('照白板順序建好所有群組與提醒。','新軟體一開，全公司同時收到提醒。Wing 很滿意管理沒有斷，你發現大家連上一套軟體的未讀焦慮都完整搬過來了。',{boss:12,lick:6,energy:-12,mood:-8}),
   c('替同事留一張舊頻道與新群組的對照表。','大家很快找到新位置，也很快找到靜音按鈕。你收到的感謝，比那份搬遷專案結案報告多；老闆模式依然不能靜音。',{trust:12,skill:5,slack:5,energy:-4,mood:3},['archive'])
  ]
 },
 {
  id:'exit-family-plan',title:'公司說是一家人，軟體先退你家族',era:'圖像史冊・數位告別',speaker:'sonny',sourceIds:['imageExit'],minTurn:4,
  body:'離職同事最後一天來交接，信箱先跳出一封軟體通知：公司不再與他共用家庭方案。開頭寫得很親切，按鈕卻是「立即訂閱」。他把螢幕轉給你看，你們第一次知道公司的家庭關係，有一個可以準時到期的地方。',
  wing:'先看交接清單，別只看那封信的問候語。',
  choices:[
   c('陪他確認工作文件都交到指定位置。','文件交完，他把一份自己的履歷留好。離職流程終於有一格真正打了勾，你們笑著說：家庭方案退了，朋友方案沒有到期。',{trust:12,skill:5,energy:-5,mood:5},['evidence','archive']),
   c('請他喝杯飲料，聽他說新工作的事。','他講到新環境時，語速忽然慢了下來。你付了兩杯飲料的錢，換到一個很久沒在辦公室聽到的字：期待。',{cash:-5,trust:10,dream:8,mood:8,energy:3},['archive']),
   c('回座位，檢查自己還有哪些公司共用帳號。','你整理出一張清單，也想起自己的履歷幾個月沒更新。軟體授權還在，你先替未來的自己保留一點選擇。',{skill:6,slack:5,dream:5,energy:-4,mood:-3},['evidence'])
  ]
 },
 {
  id:'gratitude-admission',title:'先交感謝卡，才有午餐',era:'圖像史冊・感恩驗票',speaker:'jenjen',sourceIds:['imageOffice'],minTurn:2,
  body:'感恩餐會的海報寫著感謝大家辛勤付出，下面的小字要求先交一張署名感謝卡，才能取得入場資格。你上午已經交了報表，現在還要交一份心意。午餐第一次同時需要胃口、文筆，以及一個可以被感謝的人。',
  wing:'寫一句就好，大家平常有很多謝謝沒說出口吧。',
  choices:[
   c('寫給昨天幫你接住爛攤子的同事。','同事收到卡片，回你一句「下次記得先吃飯」。你們坐在一起吃完午餐，這張卡終於不是另一份交差文件。',{trust:14,mood:7,energy:6},['archive']),
   c('認真寫一段對公司願景的感謝。','你的卡被放在很顯眼的位置，Wing 看完點了頭。午餐很好吃，你只是希望他下次也願意看完你寫的需求風險。',{lick:10,boss:11,dream:-5,mood:-5,energy:4}),
   c('寫「謝謝今天準時開飯」，再畫一個便當。','工作人員看了三秒，還是收下卡片。你拿到餐點，也被提醒下次可以再真誠一點；你覺得肚子剛才已經很真誠了。',{slack:8,trust:5,boss:-7,mood:4,energy:5},['archive'])
  ]
 },
 {
  id:'campus-double-standard',title:'昨天嫌的學校，今天去擺攤',era:'圖像史冊・徵才雙標',speaker:'wing',sourceIds:['imageWing'],minTurn:3,
  body:'Wing 前幾天才嫌某間大學的背景不夠好，今天行事曆卻多了一場同校徵才。你被叫去準備介紹公司的說詞。螢幕一邊是他對學歷的評語，一邊是歡迎優秀人才的海報，兩個視窗誰也不肯最小化。',
  wing:'我們是去找有潛力的人。不要把事情想得這麼死。',
  choices:[
   c('請各部門提供真正會做的工作，寫進介紹。','學生問得很實際，你也回答得很實際。幾個人留下履歷，幾個人禮貌道謝就走了；你覺得這樣至少比較像雙向選擇。',{skill:8,trust:9,boss:-8,dream:5,energy:-6,mood:2},['evidence']),
   c('背熟公司介紹，把現場氣氛炒熱。','Wing 誇今天攤位很有活力。你看著一疊履歷，忍不住想：明年站在這裡講同一套話的人，會不會就在這一疊裡。',{lick:9,boss:12,energy:-10,mood:-7,dream:-4}),
   c('請 Wing 錄一段歡迎該校同學加入的短片。','他錄得十分熱情。你替影片加上字幕，同事在旁邊看到校名那一行，努力把笑聲包裝成咳嗽。',{skill:5,trust:7,boss:4,mood:4,energy:-5},['archive'])
  ]
 },
 {
  id:'license-group-size',title:'團體版，不是團體吃到飽',era:'圖像史冊・帳號經濟學',speaker:'wing',sourceIds:['imageWing','imageOffice'],minTurn:2,
  body:'Sonny 帶來軟體報價，Wing 指著「團體版」三個字，問怎麼還要乘上使用人數。你解釋每人需要一個帳號，他問能不能買個人版。這場討論已經花掉四個人的時間，唯一還沒列進報價的就是這四個人。',
  wing:'都寫團體了，怎麼不是整個團體一起用？',
  choices:[
   c('請各組確認真正需要使用的人數。','名單從「全部都要」縮成實際需求。報價終於少了一截，Sonny 把表格收好；這次省下來的是授權費，不是誰的午休。',{skill:10,trust:8,boss:6,energy:-6,mood:-2},['evidence']),
   c('找替代工具，拿同一份工作測一次。','替代工具能完成大半工作，最後那一小段需要繞路。Wing 說早就該這樣想，你請大家記下繞路花的時間，留給下次報價一起看。',{skill:10,trust:5,boss:8,energy:-10,mood:-5},['evidence']),
   c('約廠商來說明帳號、席次和方案。','廠商又講了一遍，Wing 問他能不能找有決定權的人來。你看看正在接電話的業務，第一次想請他一起加入前員工群。',{slack:7,trust:5,boss:-10,energy:-7,mood:-6},['archive'])
  ]
 },
 {
  id:'aircon-brand-review',title:'冷氣關了嗎，品牌還沒下班',era:'圖像史冊・告示牌專案',speaker:'wing',sourceIds:['imageWing','imageOffice'],minTurn:3,
  body:'行政貼了一張下班記得關冷氣的紙。Wing 覺得質感不好，請 PM 找 UIUX 出視覺。紙還沒拆，群組已經在討論品牌色、字體和構圖。你只是想提醒最後一個人按開關，現在得先決定那個人要接受什麼品牌體驗。',
  wing:'這也是公司的門面，不是印幾個字貼上去就好。',
  choices:[
   c('把文字放大，請晚走的同事站遠一點試讀。','同事一眼就看懂。Wing 問能不能再有設計感，你保住大字，把 Logo 放在旁邊；冷氣終於有機會比設計師早下班。',{skill:11,trust:8,boss:-6,energy:-6,mood:-3},['evidence']),
   c('做兩款品牌色版本，安排一次確認。','兩款都得到新的修改方向。你替資料夾命名「冷氣提醒最終版」，想到電費正在隨著審稿次數慢慢增加。',{boss:9,lick:5,skill:5,energy:-12,mood:-9}),
   c('先保留原紙，跟行政一起確認每天誰收尾。','今天冷氣準時關掉了。Wing 隔天還在追新版告示，你們至少證明這件事的完成條件，不是圖片成功匯出。',{trust:12,skill:5,boss:-9,energy:-3,mood:3},['archive'])
  ]
 },
 {
  id:'rick-assistant-stack',title:'大家協助 Rick，Rick 協助點頭',era:'圖像史冊・支援再支援',speaker:'rick',sourceIds:['imageRick','imageWing'],minTurn:4,weight:1.25,
  body:'Wing 列出一份協助 Rick 的清單：找人記會議、每天追 PM 進度、安排工程與業務同步。Rick 把它轉給你，希望你先協助協助他的同事。你把支援關係畫成圖，箭頭最後全指向下面，最上面的技術資深經理只需要接住整理好的結論。',
  wing:'大家把資訊準備好，我才有辦法幫你們跟 Wing 溝通。',
  choices:[
   c('把待決定的問題留給 Rick，其餘幫忙整理。','Rick 看著那幾格自己的名字，問能不能先幫他想一下。你準備兩個可選方案，然後停在需要他選擇的地方。這次箭頭沒有再往下長。',{skill:11,trust:10,boss:-10,energy:-7,mood:-4},['evidence']),
   c('接下追進度、排會議與整理報告。','Rick 向 Wing 說團隊終於運作順暢。你從早忙到晚，把大家管得清清楚楚，唯獨自己的職稱和薪資沒有跟著管理範圍一起更新。',{skill:6,lick:8,boss:12,energy:-15,mood:-11,dream:-5}),
   c('拉同事共用一份進度表，每人只更新自己的欄位。','大家少回答了好幾輪相同的問題。Rick 問誰能每天幫他截圖，你們把表格設成他的瀏覽器首頁；現在連開啟報告都只剩一步。',{skill:9,trust:12,slack:5,boss:-5,energy:-5,mood:4},['archive'])
  ]
 }
];
