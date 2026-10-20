// Original design-work satire. Public chapter IDs identify inspiration only;
// these situations, dialogue and outcomes are fictional game writing.
const c = (text, result, delta, flags = [], extra = {}) => ({
  text, detail: '', result, delta, flags, ...extra
});
const scene = (id, title, speaker, body, wing, choices, extra = {}) => ({
  id, title, speaker, body, wing, choices,
  era: '原創・設計師的像素人生', sourceIds: ['designLore', 'characterFiction'],
  roles: ['design'], minRules: 21, minTurn: 0, weight: 1.15, ...extra
});

export const DESIGN_EVENTS_V21 = [
  scene('design-v21-typeface-mood', '這個字體，要有讀過書的感覺', 'wing',
    '翅膀盯著標題說不夠有學問。你換上明體，他又嫌像論文；改成黑體，他說沒有文化底蘊。產品名稱只有六個字，今天已經被要求同時擁有博士學位和國際業務經驗。',
    '你是設計師，字體有沒有水準看不出來嗎？不要什麼都要我教。', [
      c('用同一段文字比較三種字體，請他確認閱讀情境。',
        '你把手機、投影和網頁的樣張排開，終於定下一種。翅膀說早點拿這個來就好了；你把昨天寄的樣張信留在原處，今天先不追加閱讀測驗。',
        { skill: 7, trust: 5, boss: -4, energy: -6, mood: -3 }, ['evidence']),
      c('把原字體改名「國際研究院特選」，再交一次。',
        '翅膀看完說這次有做功課。你保住了版面，也多維護一個只存在簡報裡的字體名稱；同事問哪裡下載，你只好私訊說明。',
        { lick: 7, boss: 7, skill: -2, energy: -5, mood: -5 }, ['loop']),
      c('召開字體口試，請六個字輪流報告自己的學歷。',
        '你替每個字寫了一段荒謬自傳，唸到「產」字在等畢業證書時，同事笑了。翅膀叫你少玩一點；你刪掉自傳，標題倒是終於獲准留下。',
        { slack: 7, trust: 4, boss: -6, energy: -5, mood: 3 }, ['archive'], { wild: true })
    ], { weight: 1.2 }),

  scene('design-v21-handoff-inspector', 'Figma 開放檢視，進度開放想像', 'jack',
    '傑克拿著前端問題來找你：截圖看得見按鈕，卻看不到點下去之後發生什麼。你打開交付頁，發現先前傳出去的是一張漂亮封面，互動狀態和尺寸規格還在沒人點開的分頁。',
    '可以幫我補一下載入、失敗跟空資料嗎？現在每個畫面都長得像一切順利。', [
      c('補齊互動狀態、元件尺寸和工程可讀的交付頁。',
        '傑克照著狀態表把問題逐個勾掉，少了幾輪猜測。你今天畫出的灰色空畫面，比昨天那張漂亮封面更像真的產品。',
        { skill: 8, trust: 6, energy: -7, mood: -2 }, ['evidence', 'handover_notes']),
      c('先切一批圖給他，說其他狀態照主畫面延伸。',
        '傑克收到圖後，又帶著更多問題回來。你省下的標註時間，被切成十幾則訊息送回來，還每則都附一張截圖。',
        { slack: 5, trust: -5, skill: -2, energy: -6, mood: -4 }, ['loop']),
      c('把游標命名為實習生，請它現場代班演出所有錯誤。',
        '你用游標演了一次網路斷線、按錯按鈕和資料失蹤。傑克一邊笑一邊補工單；實習游標沒有薪水，你則得把即興演出補回正式規格。',
        { slack: 7, trust: 5, energy: -6, mood: 3 }, ['archive', 'handover_notes'], { wild: true })
    ], { minTurn: 1 }),

  scene('design-v21-png-source', '一張 PNG，請包含全部原始碼', 'wing',
    '翅膀把群組裡轉傳三次的 PNG 丟回來，叫你改掉其中一句話，順便把被裁掉的背景接回去。你問能不能拿到原始檔，他回你：圖片都在這裡了，還要什麼檔？',
    '不要一直講格式。你們做設計的，不就是負責把圖改好？', [
      c('找到可編輯原稿，另建交付檔與修改紀錄。',
        '你從舊資料夾找到原稿，把圖修好，也標上這次的版本。翅膀覺得你找檔案太久；至少下次不用再向一張截圖逼供。',
        { skill: 7, trust: 5, boss: -5, energy: -7, mood: -3 }, ['evidence', 'handover_notes']),
      c('先硬修這張圖，說這種問題難不倒你。',
        '縮小看還能過關，放上大螢幕就露出補過的邊。翅膀稱讚你處理很快，接著宣布以後都照這樣做；你第一次希望自己的修圖不要那麼成功。',
        { lick: 7, boss: 6, skill: -2, energy: -7, mood: -5 }, ['loop']),
      c('替 PNG 接上心電圖，宣布它目前沒有圖層生命跡象。',
        '你播放滴滴聲，將扁平圖片的構造講完。翅膀嫌你演太久，卻終於去問原始檔在哪；儀器是假的，追回檔案的工夫還是真的。',
        { slack: 7, trust: 4, boss: -6, energy: -5, mood: 3 }, ['archive', 'evidence'], { wild: true })
    ], { sourceIds: ['debate', 'cloud', 'characterFiction'], minTurn: 1, weight: 1.2 }),

  scene('design-v21-component-throne', '設計系統，先設計誰最大', 'rick',
    '老闆乾兒子要你整理共用元件，打開檔案後卻先問 Logo 能不能再突出一點。按鈕、表單和字級還沒討論完，首頁已經出現三個不同尺寸的 Logo；他說先把最重要的東西做好。',
    '翅膀看第一眼要有感覺。那些按鈕等一下再講，又不是不能點。', [
      c('分開品牌展示和操作元件，補上使用規則。',
        '你留出品牌區，把其餘元件整理回可維護的版本。老闆乾兒子說架構方向他早就想到了；同事至少不用再從三個 Logo 裡猜哪個能返回首頁。',
        { skill: 8, trust: 5, energy: -7, mood: -3 }, ['evidence', 'handover_notes']),
      c('新增「執行長特選」元件，全部套上大 Logo。',
        '老闆乾兒子很滿意，當場截圖轉傳。你的共用元件很快普及，之後每次想改一個按鈕，都得順便確認老闆的標誌有沒有被擠到。',
        { lick: 7, boss: 6, skill: -3, energy: -6, mood: -5 }, ['loop']),
      c('把 Logo 設成元件國王，請按鈕上奏它們太擠了。',
        '你用原型做了一場像素朝會，按鈕輪流告狀。老闆乾兒子笑完問能不能拿去展示；你用午休換到一次縮小 Logo 的准奏，還欠一版展示動畫。',
        { slack: 7, trust: 4, energy: -7, mood: 2 }, ['archive'], { wild: true })
    ], { sourceIds: ['rickLore', 'designLore', 'characterFiction'], minTurn: 2 }),

  scene('design-v21-responsive-banner', '一張主視覺，要住進所有尺寸', 'meimei',
    '水蛇送來六種廣告版位，要你沿用同一張橫式主視覺。最窄的手機版只剩一句標題和半顆人頭，她問能不能全部保留，最好不要縮小字，也不要重新排。',
    '客戶六個尺寸都要，明天就用。你幫我想一下，不然我沒辦法回。', [
      c('依版位重排層級，確認哪些內容能分批呈現。',
        '水蛇把必留文字問清楚，你完成六個能讀的版本。主視覺沒辦法一鍵搬家，但這次不用讓半顆人頭替產品代言。',
        { skill: 8, trust: 6, energy: -8, mood: -3 }, ['evidence', 'handover_notes']),
      c('直接拉伸成六張，先把交件數量湊齊。',
        '水蛇順利回覆已交件，預覽裡的人卻忽胖忽瘦。客戶晚點要求全修，你交出的六張圖，變成六張有期限的待辦。',
        { slack: 6, trust: -5, skill: -2, energy: -6, mood: -4 }, ['loop']),
      c('替標題辦縮骨功招生，報名資格是不得換行。',
        '你把最擠的版本做成武功示範，水蛇一眼看懂問題。她去刪掉一段文案；你付出的代價是把整份示範重新排成正常簡報。',
        { slack: 7, trust: 5, energy: -6, mood: 3 }, ['archive', 'evidence'], { wild: true })
    ], { minTurn: 0, weight: 1.25 }),

  scene('design-v21-brand-red', '不是這個紅，是上次那個紅', 'wing',
    '翅膀用自己的手機看新頁面，說品牌色不對。你拿出色碼，他說別跟他講數字；你拿上次的圖，他又嫌沒有新意。螢幕還開著護眼模式，紅色正在替整間辦公室接受考核。',
    '我要有記憶點，但不要那麼刺眼。這種基本的感覺還要解釋？', [
      c('固定預覽條件，比對色碼、對比和品牌範例。',
        '關掉護眼模式後，兩張圖終於比較像同一個世界。翅膀仍調了幾次深淺，你至少把最後確認的樣張和色碼一起存下來。',
        { skill: 7, trust: 4, boss: -4, energy: -6, mood: -3 }, ['evidence']),
      c('稱讚他眼光精準，逐格調到他點頭。',
        '翅膀挑中一個幾乎和原本相同的紅，說總算對了。你記下色碼，也記下今天的手機亮度；品牌手冊開始像氣象觀測日誌。',
        { lick: 8, boss: 7, energy: -7, mood: -5 }, ['loop']),
      c('讓 RGB 三位證人各自陳述，請護眼模式暫時離席。',
        '你用三個色塊演出一場調解，翅膀沒耐心看完，先把護眼模式關了。問題很快縮小成兩個色碼，你還得收拾那份過度認真的開庭動畫。',
        { slack: 7, trust: 3, boss: -5, energy: -6, mood: 2 }, ['archive', 'evidence'], { wild: true })
    ], { minTurn: 2, weight: 1.2 }),

  scene('design-v21-approval-checkmark', '按了 OK，沒有批准上線', 'wing',
    '你照確認過的畫面上線，翅膀卻說這版他沒有同意。聊天紀錄裡那個 OK 手勢還亮著，他解釋那是收到，不是批准。設計稿的狀態很完整，唯獨確認本身還缺一份確認。',
    '我看到跟我認同是兩回事，你做事情不要自己想當然耳。', [
      c('列出已確認版本，請他明確標記待改和可上線。',
        '翅膀嫌你流程太多，還是圈出兩個地方。你把這次的確認留在交付頁，今天花在按鈕文字上的時間，比改按鈕本身還久。',
        { skill: 6, trust: 6, boss: -7, energy: -6, mood: -4 }, ['evidence']),
      c('先說自己理解不夠，立刻撤回重改。',
        '翅膀覺得你的態度進步了。畫面回到上一版，排程也跟著倒退；下次收到同一個手勢，你仍得猜它這回在哪個階段。',
        { lick: 7, boss: 7, trust: -3, energy: -7, mood: -5 }, ['loop']),
      c('設計一組新手勢：收到、同意、我明天會忘記。',
        '翅膀看到第三個圖示就叫你收起來。同事私下問能不能存貼圖，你得到一點安慰，以及一份必須重新確認的正式設計稿。',
        { slack: 7, trust: 5, boss: -8, energy: -5, mood: 3 }, ['archive'], { wild: true })
    ], { sourceIds: ['designLore', 'meetingLore', 'characterFiction'], minTurn: 3 }),

  scene('design-v21-invisible-button', '字再淡一點，讓使用者自己領悟', 'rick',
    '老闆乾兒子說頁面要高級，把說明文字調成淺灰，錯誤提示也想拿掉。你試著用鍵盤走一次流程，焦點不知道停在哪；畫面很安靜，安靜到連操作失敗都不願意打擾人。',
    '不要弄那麼多框框紅字，看起來很不成熟。使用者應該會用吧？', [
      c('示範鍵盤操作和看不清楚的狀態，再調整提示。',
        '老闆乾兒子自己按錯兩次後，同意保留提示。你把外框做得整齊些，終於交出一個不用先猜老闆心情就能操作的畫面。',
        { skill: 8, trust: 6, energy: -7, mood: -2 }, ['evidence', 'handover_notes']),
      c('照他的審美拿掉提示，先完成這輪展示。',
        '畫面獲得一句乾淨俐落，測試同事則連送三張不知道怎麼繼續的截圖。你只好在旁邊口頭導覽，成為產品暫時外接的說明文字。',
        { lick: 7, boss: 5, trust: -5, energy: -7, mood: -5 }, ['loop']),
      c('蒙住自己的眼睛主持體驗會，讓滑鼠改當占卜棒。',
        '你第一次點錯，第二次把整頁關掉，老闆乾兒子終於叫你把提示加回來。你摘下眼罩，還得用剩下的時間把玩笑改成正式測試紀錄。',
        { slack: 7, trust: 5, energy: -6, mood: 3 }, ['archive', 'evidence'], { wild: true })
    ], { sourceIds: ['designLore', 'rickLore', 'characterFiction'], minTurn: 2 }),

  scene('design-v21-microanimation', '這顆按鈕，要有上市的氣勢', 'wing',
    '翅膀說按鈕出現時沒有氣勢，傳來一支電影預告當參考。你問要參考節奏還是顏色，他說全部；這顆按鈕目前的任務，只是讓人儲存聯絡資料。',
    '人家做得到，你為什麼先跟我講限制？我要的是一看就覺得厲害。', [
      c('做一段短動效，確認讀取、操作和較少動態的版本。',
        '按鈕有了清楚回饋，畫面也沒有因此卡住。翅膀嫌少了一點震撼，你留下一版能上線的檔案，電影級的宇宙先放在參考區。',
        { skill: 8, trust: 5, boss: -5, energy: -8, mood: -3 }, ['evidence']),
      c('先堆滿光暈和旋轉，讓簡報當場發亮。',
        '翅膀很滿意，接著問手機版何時能用。你關掉錄影，才發現儲存兩個字得等星球繞完一圈；下一輪工作是替自己的特效減重。',
        { lick: 7, boss: 7, skill: -2, energy: -7, mood: -5 }, ['loop']),
      c('讓按鈕先敲鐘再提交，旁白宣布本次共儲存一筆資料。',
        '示範播到鐘聲時，同事差點把水噴出來。翅膀說正經一點，要求改回正常版；你用半個下午換到一次小型上市，最後還是得交按鈕。',
        { slack: 8, trust: 4, boss: -7, energy: -7, mood: 3 }, ['archive'], { wild: true })
    ], { sourceIds: ['designLore', 'dream', 'characterFiction'], minTurn: 4, weight: 1.1 }),

  scene('design-v21-stock-watermark', '浮水印可不可以設計掉', 'jenjen',
    'Moon Dog 找到一張很適合主視覺的圖，預覽中央掛著大片浮水印。你確認授權預算，她說這季先節省，問能不能靠設計處理；你看著滑鼠上的修補工具，覺得它今天被交付了奇怪的職涯期待。',
    '先幫忙找個能用的版本，別讓這張圖卡住整個活動。', [
      c('改找授權條件清楚的素材，把使用範圍一起交付。',
        '你找到另一張適用的圖，重新調整構圖。Moon Dog 把素材資料留下，主視覺總算不用靠修補工具替預算做決定。',
        { skill: 7, trust: 6, energy: -7, mood: -3 }, ['evidence', 'handover_notes']),
      c('自己買下授權，先把活動交出去。（花費 5 存款）',
        'Moon Dog 收到圖，說你很會處理事情。活動照常走，你的存款先少了一筆，報支附件多了一張等待回覆的收據。',
        { lick: 6, trust: 3, cash: -5, energy: -5, mood: -5 }, ['loop']),
      c('把整張主視覺改成水印風格，提案「本季主打尚未取得」。',
        '滿版斜線讓 Moon Dog 看了三秒才笑出來。這版沒有通過，你獲准換一張正常素材；玩笑做完，重排工作的份量也很正常。',
        { slack: 7, trust: 4, energy: -6, mood: 3 }, ['archive'], { wild: true })
    ], { sourceIds: ['resourceLore', 'designLore', 'characterFiction'], minTurn: 3 }),

  scene('design-v21-chairman-portrait', '一張照片，同時年輕又有資歷', 'spencer',
    '屎潘蛇挑投資簡報的照片，要求年輕、有經驗、親切又有威嚴。你調好光線，他又問能不能把背後那張辦公椅換得更氣派。產品頁還沒輪到，董事長的椅子已經進入第二輪提案。',
    '你看著調一下，我不要太刻意，但人家第一眼就要知道我是董事長。', [
      c('保留人物原貌，整理光線、構圖和簡報一致的版式。',
        '屎潘蛇挑了一張正式版本，繼續研究椅背要不要再高一點。你把選定照片放進母版，總算讓其他投影片也分到一點上班時間。',
        { skill: 7, trust: 4, energy: -6, mood: -3 }, ['evidence']),
      c('把背景換成敲鐘現場，說這張最有未來感。',
        '屎潘蛇看得很高興，卻要求再做另外兩個交易所版本。這些只供內部玩梗的合成圖，花掉的時間倒是已經正式入帳。',
        { lick: 7, boss: 2, energy: -7, mood: -5 }, ['loop']),
      c('製作董事長轉職動畫，讓辦公椅升階成王座。',
        '椅子長出扶手再長出光環，屎潘蛇笑著看了兩遍。動畫沒進正式簡報，你得到一段放鬆的時間，和一張仍然需要正常修好的照片。',
        { slack: 7, trust: 3, energy: -6, mood: 3 }, ['archive'], { wild: true })
    ], { sourceIds: ['spring', 'designLore', 'characterFiction'], minTurn: 4, weight: 1.1 }),

  scene('design-v21-wireframe-switch', '昨天要像真的，今天嫌太像真的', 'wing',
    '昨天翅膀說線框圖太粗，無法討論，你熬了一輪精稿。今天他又問怎麼一開始就畫那麼細，流程都還沒想清楚。你看著同一份 Figma，思考要把哪一層關掉，才能跟上這場每天重新報到的需求。',
    '做事情要有方法，不要一頭就下去畫。線框圖這種基本的你應該會吧？', [
      c('切回流程層，逐步確認後再鎖定本輪交付範圍。',
        '你關掉裝飾層，把昨天的精稿還原成今天能討論的線框。流程補了一個缺口，修改清單也補上日期；同一份檔案總算能證明自己活過昨天。',
        { skill: 8, trust: 5, boss: -6, energy: -7, mood: -4 }, ['evidence', 'handover_notes']),
      c('說他提醒得對，把精稿全部換成灰色再匯報。',
        '翅膀說這樣就對了，開始重新挑選早已選過的欄位。你沒有重畫，卻得重講一次；新的進度是舊的進度終於得到新名字。',
        { lick: 7, boss: 7, energy: -6, mood: -5 }, ['loop']),
      c('加裝「昨日／今日」切換鈕，讓設計稿自己穿越。',
        '你按一下變線框，再按一下變精稿。翅膀說你有空做這個不如趕快改，但最後用切換鈕講完了流程；你留下這顆沒人願意認領的時光機。',
        { slack: 7, trust: 4, boss: -7, energy: -6, mood: 3 }, ['archive', 'evidence'], { wild: true })
    ], { minTurn: 5, weight: 1.2 })
];
