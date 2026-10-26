// Original island fight fiction. Motifs come from already-published game scenes
// and this update's creator brief; never from a published raw private question bank.
const THEMES = Object.freeze({
  strike: { windup: .85, cooldown: 8, range: 118, radius: 44, damage: 13, duration: 1.2, color: '#bd865b' },
  rush: { windup: 1, cooldown: 11, range: 230, radius: 38, damage: 14, duration: 1.3, color: '#769e91' },
  projectile: { windup: .95, cooldown: 9, range: 420, radius: 34, damage: 10, duration: 1.4, color: '#849bb3' },
  zone: { windup: 1.2, cooldown: 13, range: 360, radius: 64, damage: 14, duration: 1.8, color: '#bb8b79' },
  heal: { windup: 1.4, cooldown: 18, range: 160, radius: 48, heal: 18, duration: 1.5, color: '#88a77a', pose: 'heal' },
  guard: { windup: .9, cooldown: 15, range: 155, radius: 52, shield: 16, duration: 2.2, color: '#a2a3bd' },
  slow: { windup: 1.15, cooldown: 14, range: 290, radius: 68, damage: 5, duration: 2.2, color: '#a3a681' },
});
const skill = (id, name, kind, tell, line, counter, extra = {}) => ({ id, name, kind, tell, line, counter, trigger: 'always', ...THEMES[kind], ...extra });
const incident = (id, name, kind, tell, line, counter, extra = {}) => ({
  ...skill(id, name, kind, tell, line, counter), trigger: 'time', at: 27, cooldown: 99, once: true, ...extra,
});
const profile = (id, title, opening, skills, events, sources) => Object.freeze({
  id, title, opening,
  skills: Object.freeze(skills.map(item => Object.freeze({ ...item, id: `${id}-${item.id}` }))),
  events: Object.freeze(events.map(item => Object.freeze({ ...item, id: `${id}-event-${item.id}` }))),
  sources: Object.freeze(sources),
});

export const BRAWL_ROSTER = Object.freeze({
  wing: profile('wing', '執行長', '進度呢？先別看拐杖，注意我這一腳。', [
    skill('golden-left', '黃金左腳', 'strike', '翅膀扶穩拐杖，金色扇形正在腳邊展開。', '左腳很短，追進度的距離可沒有！', '看準金色扇形，往側面閃避；出腳後再反擊。', { damage: 21, range: 145, windup: 1.05, cooldown: 10, pose: 'kick', color: '#c7a355' }),
    skill('third-floor', '三樓震撼教育', 'zone', '「去三樓跳下去啊！」翅膀把紙板三樓拍進場，落點開始發亮。', '紙板樓層落地，只有場上的紙屑在飛。', '離開標記圈；這是場地招式，別站著聽完訓話。', { damage: 20, radius: 78, windup: 1.4, cooldown: 17, range: 380 }),
    skill('sandalwood', '全身檀香', 'heal', '翅膀突然披上浴巾，檀香補給正在讀條。', '洗完這一身檀香，會議還能繼續。', '在香氣讀條結束前貼近出手，打斷這次回血。', { heal: 20, trigger: 'hurt', once: true, pose: 'bath' }),
    skill('extra-demand', '需求再加一項', 'projectile', '翅膀拿起追加需求單，紙張朝你對準。', '很簡單嘛，就順便一起做。', '橫向移動躲開需求單，不要沿著紙張的方向跑。', { damage: 11, cooldown: 9 }),
    skill('ten-minutes', '十分鐘相談', 'slow', '翅膀攤開相談時段表，腳下出現倒數範圍。', '什麼都能談，時間先照我的。', '先走出相談範圍；被拖慢時保留閃避。', { duration: 2.3, cooldown: 16 }),
  ], [incident('chair-review', '辦公椅的績效', 'rush', '一張貼著績效表的紙椅滑向場中，翅膀準備跟著出腳。', '椅子先交付了，換你回答！', '離開衝刺方向，等椅子和翅膀停下再靠近。', { at: 24, damage: 18, pose: 'kick' })], [
    'dist/events-quiz26-b.js#q26-chair-left-shoe', 'dist/events-quiz26-a.js#quiz26-ceo-first-talk', 'research/island-signature-skills.md#creator-brief',
  ]),
  spencer: profile('spencer', '董事長', '今天先談世界第一，再談你站在哪裡。', [
    skill('world-first', '世界第一版圖', 'zone', '屎潘蛇把願景圖攤到地上，第一名的圓圈正在放大。', '這一圈，先算我們的市場。', '在版圖落定前走出圈，別被願景卡住位置。', { radius: 74, damage: 15 }),
    skill('four-digits', '四位數股價', 'projectile', '四張數字紙牌在屎潘蛇手上排成一列。', '四位數看清楚，下一張還有。', '左右移動避開紙牌，別在直線上追。', { damage: 11, cooldown: 10 }),
    skill('alumni-circle', '成大校友圈', 'guard', '屎潘蛇戴好圓眼鏡，校友名牌開始環繞。', '原來都是同學，先坐下聊。', '等名牌盾消退再連擊，或趁讀條尚未完成打斷。', { shield: 17 }),
    skill('cofounder-card', '共同創辦人名片', 'strike', '屎潘蛇翻出多印一行的名片，手臂向後蓄力。', '這一行，大家都要看見。', '退到名片扇形外，等揮完再貼近。', { range: 126, damage: 14, cooldown: 12 }),
  ], [incident('seat-table', '股東會椅子不足', 'zone', '座位表忽然展開，空椅子的落點出現標記。', '名單很長，椅子先排這幾張。', '趁座位尚未落下換位置，不要被空椅圍住。', { at: 29, radius: 82, damage: 16 })], [
    'dist/events-quiz26-b.js#q26-spring-dinner-seats', 'dist/events-backoffice-v28.js#finance28-shares-invitation', 'dist/events-quiz26-a.js#quiz26-table-tea',
  ]),
  erich: profile('erich', '法務長', '先別急著動手，這一條我還沒念完。', [
    skill('redline', '合約紅線', 'zone', '法師在場地上拉出紅色修訂範圍。', '新增的這一段，也請一併確認。', '走出紅線圈，別為了追人停在修訂區。', { radius: 66, damage: 14 }),
    skill('registered-letter', '存證信函', 'projectile', '法師把信封封好，朝你這邊抬手。', '附件已寄，請查收。', '側移躲信封，利用障礙物阻擋來信。', { damage: 12, cooldown: 10 }),
    skill('clause-shield', '逐條確認', 'guard', '一整頁條款在法師面前摺成紙盾。', '這份還沒確認，先不要直接算通過。', '讀條時打斷，或等紙盾時效結束再交連段。', { shield: 18 }),
    skill('signature-sweep', '簽名欄橫掃', 'strike', '法師的筆尖停在簽名欄，近身扇形亮起。', '請在這裡留下你的回覆。', '繞到側邊，別站在筆尖的扇形內。', { damage: 12, cooldown: 12 }),
  ], [incident('three-piece', '三件套到齊', 'guard', '文件夾、印章與權限單一起排上桌，法師開始點名。', '人都到了，程序也得一起到。', '趁程序讀條打斷，或先走位等三件紙盾消退。', { trigger: 'pressure', at: 4, shield: 18 })], [
    'dist/events-cast-v35-legal.js#cast35-erich-legal-redline', 'dist/events-jack.js#jack-departure-draft',
  ]),
  sonny: profile('sonny', 'MIS', '先講喔，我今天狀態不算正式出賽。', [
    skill('old-injury', '舊傷躺平', 'guard', '阿福扶著膝蓋慢慢躺下，舊傷聲明正在展開。', '我有舊傷！剛才那段不能這樣算！', '在聲明讀條時打斷；紙盾生效後先拉開等他起身。', { trigger: 'lowHp', once: true, shield: 18, duration: 2.5, windup: 1.1, pose: 'down' }),
    skill('pizza', '三片披薩補給', 'heal', '阿福掀開披薩盒，開始認真計算三片補給。', '吃完這三片，再來才算。', '在披薩讀條結束前近身打斷，別讓他安心吃完。', { trigger: 'hurt', heal: 20, once: true, pose: 'pizza' }),
    skill('excuse-chain', '理由伯連發', 'projectile', '阿福把時間、地點和各種例外揉成一疊紙球。', '不是我輸，是剛才那個條件沒有講清楚。', '持續橫向走位，讓理由球飛過身旁。', { damage: 10, cooldown: 9 }),
    skill('arm-world', '未出賽世界冠軍', 'strike', '阿福拉開架勢，腕力比賽的近身範圍亮起。', '我如果認真，結果就不一樣了！', '等他把手揮完，再從側邊接近。', { range: 125, damage: 18, windup: 1.15, cooldown: 12 }),
    skill('printer-language', '雞同鴨講', 'slow', '印表機紙張在阿福身旁打轉，他開始分誰是雞、誰是鴨。', '先說清楚，現在到底誰是雞？', '離開紙張範圍，別站在原地回答分類題。', { cooldown: 15, duration: 2.4 }),
  ], [incident('breaking-news', '重大消息另行通知', 'guard', '阿福神秘地壓低聲音，要全場先停一下聽他講。', '算了，現在先不說。', '讀條時出手打斷，或趁紙盾期間重新找空檔。', { at: 25, shield: 14 })], [
    'dist/events-video.js#video-pizza-overtime', 'dist/events-quiz26-a.js#quiz26-arm-draw', 'dist/events-chronicle-v22.js#sonny-announcement-withdrawn', 'research/island-signature-skills.md#creator-brief',
  ]),
  jenjen: profile('jenjen', '行政長', '先把表格填完，下一個流程才輪得到你。', [
    skill('room-tetris', '會議室俄羅斯方塊', 'zone', '真真把臨時會議排成地面格子。', '每一場都說重要，這格先借一下。', '格子落定前換位，別留在重疊的會議區。', { radius: 70, damage: 13 }),
    skill('key-ring', '總務鑰匙串', 'projectile', '真真把一串紙鑰匙繞了一圈，對準你的方向。', '門要開，領用紀錄也要有。', '側移躲開鑰匙，別沿著來路追。', { damage: 11 }),
    skill('attendance-stamp', '活動簽到盾', 'guard', '活動名單和簽到章在真真面前排成一面盾。', '活動辦完，打卡單還沒散會。', '打斷蓋章讀條，或等名單盾消退再攻擊。', { shield: 16 }),
  ], [incident('receipt-roundtrip', '發票再跑一圈', 'projectile', '一張沒有主人的發票繞場回到真真手上。', '這張是誰的？請本人來認領。', '發票抬手後就橫向走開，別站著找簽名。', { at: 23, damage: 14 })], [
    'dist/events-backoffice-v28.js#admin28-room-tetris', 'dist/events-backoffice-v28.js#admin28-event-attendance', 'dist/events-backoffice-v28.js#accounting28-receipt-orphan',
  ]),
  rick: profile('rick', '老闆乾兒子', '這個你先做，不懂就再去問傑克。', [
    skill('call-jack', '電話請找傑克', 'projectile', '瑞克舉起電話，一疊轉接單對準你。', '我已經講完了，細節找傑克。', '橫向閃開轉接單，別一路跟著電話直線跑。', { damage: 11 }),
    skill('special-appointment', '特別任用', 'guard', '小皇冠轉了一圈，特別任用通知開始蓋章。', '這個決定，先照我說的。', '讀條中打斷；皇冠盾生效後保留大招。', { shield: 18 }),
    skill('push-broadcast', '推播整包轉交', 'zone', '瑞克圈起整片推播名單，通知範圍開始閃動。', '系統不是已經交接完成了嗎？', '離開推播圈，別為了追問交接停在原地。', { radius: 75, damage: 14, cooldown: 14 }),
    skill('shortcut-approval', '先說可以', 'rush', '瑞克指向前方，準備把待辦直接推到你面前。', '先上線，之後再補。', '看清方向往旁邊閃，等衝完再反擊。', { damage: 13, cooldown: 13 }),
  ], [incident('handover-complete', '兩人都沒參加的交接', 'slow', '一封寫著交接完成的信展開，場上的待辦開始黏人。', '信都寄了，怎麼還沒接完？', '走出郵件範圍，被拖慢時用閃避重新拉開。', { at: 26, duration: 2.5 })], [
    'dist/events-jack.js#jack-referral-loop', 'dist/events-ai-v31.js#ai31-auto-increment', 'dist/events-alice-v71.js#alice71-dupe-rick',
  ]),
  kind: profile('kind', '技術經理', '下班別急著走，我知道一條神秘路線。', [
    skill('mystery-route', '阿良神秘行程', 'rush', '阿良先看了一眼碼頭方向，腳邊亮起集合箭頭。', '跟上，下一站到了再說。', '往集合箭頭的側邊閃，別跟著他衝。', { damage: 15, range: 260, cooldown: 11 }),
    skill('coat-seat', '外套先到場', 'zone', '一件外套飄向預告落點，阿良本人還在說馬上到。', '位置我先佔好了，人等一下。', '離開外套落點，不要替衣服顧座位。', { radius: 70, damage: 12, cooldown: 13 }),
    skill('keyword-overseas', '關鍵字先出海', 'projectile', '阿良把一排不該出現的搜尋字卡送向你。', '這個 SEO，我們先測看看。', '側移避開字卡，利用場地障礙擋住錯誤關鍵字。', { damage: 10 }),
    skill('next-stop', '下一攤補給', 'heal', '阿良打開路線補給包，正準備補滿下一攤的氣勢。', '這裡坐一下，等下再出發。', '在補給讀條結束前貼近打斷。', { trigger: 'hurt', heal: 18, once: true }),
  ], [incident('fifty-eight', '五十八度的續航測試', 'guard', '阿良把聚會行程排成一排，宣布今晚還很早。', '撐不撐得住，先不要只靠嘴。', '打斷行程讀條，或等氣氛盾結束再接連段。', { at: 30, shield: 16 })], [
    'dist/events-cast-v66.js#cast66-kind-coat-check', 'dist/events-quiz26-a.js#quiz26-keyword-audit', 'dist/events-quiz26-a.js#quiz26-toast-battery',
  ]),
  hope: profile('hope', 'HR長', '先自評一下，你覺得這場能拿幾分？', [
    skill('pip-calendar', 'PIP 倒數表', 'zone', '希望把改善時程攤成地面的紅色日期圈。', '時間到了，成果請照表交。', '在日期圈確認前走開，別被倒數追著站定位。', { radius: 72, damage: 14 }),
    skill('degree-review', '學歷比對', 'projectile', '希望抽出一排履歷索引，對準眼前的格子。', '這一欄，我們再確認一次。', '向側面閃開履歷卡，別沿直線倒退。', { damage: 11 }),
    skill('interview-room', '面談結界', 'guard', '面談紀錄本闔上，希望開始整理下一輪問題。', '先不要急，這段還沒談完。', '讀條中打斷，或等面談紙盾消退再近身。', { shield: 16 }),
    skill('ten-point', '十分自評', 'slow', '十分的紙卡被放到桌上，周圍出現一圈追問範圍。', '你確定，你只給自己這樣的分數？', '走出追問圈，被減速時留一個閃避。', { duration: 2.3, cooldown: 15 }),
  ], [incident('standards-next-time', '標準下次再補', 'zone', '改善標準那一欄仍是空白，另一個時限圈卻已出現。', '我們先把這次的時間記下來。', '先看地面的新圈，不要為了空白欄停住。', { at: 31, radius: 78, damage: 15 })], [
    'dist/events-jack.js#jack-pip-self-score', 'dist/events-backoffice-v28.js#hr28-trial-review-notice',
  ]),
  jack: profile('jack', '研發部經理', '鞋帶綁好了，會議筆記也記好了。來，打一場。', [
    skill('court-cut', '球場切入', 'rush', '傑克壓低重心，準備沿球場箭頭切進來。', '這一球，先從空檔過。', '看準切入方向側閃，等落步後再靠近。', { damage: 16, range: 250, cooldown: 10 }),
    skill('meeting-notes', '會議筆記反擊', 'projectile', '傑克翻開記事本，幾張決議卡正排成投擲路線。', '日期、版本和誰拍板，我都有記。', '持續橫移，不要和筆記卡站在同一條線。', { damage: 11, cooldown: 9 }),
    skill('sports-water', '運動補水', 'heal', '傑克拿起運動水壺，準備趁空檔喝一口。', '補點水，等下再跑。', '在水壺讀條結束前貼近打斷。', { heal: 18, trigger: 'hurt', once: true }),
    skill('first-love-rematch', 'First Love 申覆', 'strike', '傑克抓住紙麥克風，副歌的扇形節拍亮起。', '上次那段不算，這次讓我唱完！', '往麥克風扇形的側邊閃，等節拍完再出手。', { damage: 16, range: 136, cooldown: 13 }),
    skill('api-budget', 'API 額度上限', 'guard', '預算與停止條件的紙卡在傑克面前立起。', '先看誰付錢，不要只看它能不能跑。', '讀條時打斷，或等額度紙盾消退再交大招。', { shield: 16 }),
  ], [incident('self-score', '研發經理自評十分', 'guard', '傑克亮出十分自評表，剩下九十分的問號在旁邊打轉。', '那另外九十分，到底評的是哪一件？', '趁問號成盾前打斷，或先繞位等紙盾結束。', { trigger: 'lowHp', at: .38, shield: 14 })], [
    'dist/events-jack.js#jack-notebook', 'dist/events-jack.js#jack-api-budget', 'dist/events-jack.js#jack-pip-self-score', 'dist/events-cast-v66.js#cast66-meimei-first-love-rematch', 'research/island-signature-skills.md#creator-brief',
  ]),
  meimei: profile('meimei', '業務經理', '名單帶了，麥克風也帶了，你先選要聽哪一個。', [
    skill('first-love', 'First Love 搶麥', 'strike', '水蛇把麥克風舉到面前，近身節拍圈開始亮起。', '這段先讓我來，副歌還沒到！', '往扇形外側閃，別站在麥克風正前方。', { damage: 16, range: 133, cooldown: 11 }),
    skill('lead-list', '三百個客戶名單', 'projectile', '水蛇把客戶名單摺成一疊飛行簡報。', '先聯絡看看，總會有人回。', '左右走位躲開簡報，別沿直線追名單。', { damage: 10 }),
    skill('whole-company-marketing', '全公司行銷', 'zone', '沒有人的行銷部突然長出一整圈工作牌。', '大家一起想，這格先分給你。', '工作牌落下前離開圈，不要站著等分工。', { radius: 76, damage: 14 }),
    skill('prize-promise', '獎品已公告', 'guard', '恭喜名單排成紙盾，獎品的包裹還沒到場。', '先讓大家開心，細節再追。', '在公告讀條結束前打斷，或等名單盾過期。', { shield: 15 }),
  ], [incident('duet-file', '決鬥影片改檔名', 'projectile', '影片檔名被改成水蛇版本，一疊新檔案朝場中排開。', '檔名我先寫好了，裁判等下再補。', '橫移避開新版本檔案，別在原檔位置停留。', { at: 24, damage: 13 })], [
    'dist/events-cast-v66.js#cast66-meimei-first-love-rematch', 'dist/events-career-v71.js#career71-sales-leads-graveyard', 'dist/events-chronicle-v22.js#quiz-empty-marketing', 'dist/events-cast-v66.js#cast66-meimei-duet-file',
  ]),
  helen: profile('helen', '產品開發總監', '需求可以再談，SQL 先跑出同一個答案。', [
    skill('sql-query', 'SQL 查詢波', 'projectile', '前女友把查詢結果排好，欄位卡朝你對齊。', '同一欄資料，先別各說各話。', '向側面移動避開欄位卡，別在查詢直線上追。', { damage: 12 }),
    skill('door-release', '產品開門', 'rush', '一扇紙門在前女友前方展開，她準備跨過門框。', '這次版本，先新增能開門。', '離開門框箭頭的方向，等她停步後再反擊。', { damage: 14, range: 225, cooldown: 11 }),
    skill('handover-delay', '交接日期再延期', 'zone', '交接行事曆翻了一頁，新的日期圈落在場上。', '哪一天交完，請先說清楚。', '新的日期圈亮起就換位，不要等它蓋章。', { radius: 70, damage: 14 }),
  ], [incident('account-not-contract', '帳號不等於合約', 'guard', '帳號卡和合約分成兩疊，前女友開始逐項核對。', '可以登入，不代表所有事都還歸我。', '趁核對時打斷，或繞位等權限紙盾消退。', { at: 28, shield: 16 })], [
    'dist/events-chronicle-v22.js#helen-sql-masterclass', 'dist/events-chronicle-v22.js#helen-door-release', 'dist/events-chronicle-v22.js#helen-slack-afterlife',
  ]),
  sophie: profile('sophie', '稽核主管', '叫我紅茶可以，少的附件還是要補。', [
    skill('tea-break', '紅茶補給', 'heal', '紅茶先把杯子認領清楚，正準備喝一口。', '這杯是我的，先讓我喝完。', '在喝茶讀條結束前貼近打斷。', { heal: 18, trigger: 'hurt', once: true }),
    skill('attachment-shield', '附件的附件', 'guard', '一份附件又長出一份附件，紙張開始層層疊起。', '依據在哪裡，附件請一起放。', '紙盾成形前打斷，或等附件盾結束再連段。', { shield: 18 }),
    skill('cup-inventory', '十八個杯子的盤點', 'projectile', '杯數清單翻開，少的兩格變成對準你的紙卡。', '二十個寫在表上，十八個在櫃子裡。', '側移躲開清點卡，不要在數字前停住。', { damage: 11 }),
  ], [incident('printer-revive', '印表機復活', 'zone', '印表機終於吐紙，列印落點開始在地面閃動。', '驅動我自己重裝好了，紙請拿走。', '在文件落地前離開標記，不要站在出紙範圍。', { at: 25, radius: 68, damage: 14 })], [
    'dist/events-backoffice-v28.js#accounting28-audit-breadcrumb', 'dist/events-cast-v66.js#cast66-sophie-cup-inventory', 'dist/events-cast-v66.js#cast66-sophie-printer-marriage',
  ]),
  jonathan: profile('jonathan', '助理工程師', '我先聲明，我只是助理工程師。', [
    skill('assistant-shield', '助理工程師防護罩', 'guard', '強哥把助理工程師名片頂在胸前，權限範圍正在成盾。', '這段我能看，不代表全案我簽。', '在名片盾成形前打斷，或等權限盾消退再追。', { shield: 18 }),
    skill('mantis', '螳螂拳三問', 'strike', '強哥抬起雙手，三個問號在近身扇形亮起。', '誰決定？誰接手？誰寫清楚？', '往問號扇形側面閃，等三問結束再反擊。', { damage: 17, range: 128, windup: 1.1, cooldown: 11 }),
    skill('nineteen-ten', '十九點十分', 'rush', '強哥瞄向時鐘，腳邊出現下班方向的箭頭。', '這個時間，我的職稱沒有升級。', '看清箭頭向側邊閃，別站在他的下班路上。', { damage: 13, range: 245, cooldown: 12 }),
  ], [incident('spare-time-test', '閒暇時間做測試', 'slow', '測試清單從工時表外側伸進來，拖慢範圍開始顯示。', '要用心可以，先告訴我算哪段時間。', '走出額外測試圈，留閃避解除位置壓力。', { at: 30, duration: 2.4 })], [
    'dist/events-colleagues-v23.js#jonathan-assistant-shield', 'dist/events-quiz26-a.js#quiz26-mantis-memo', 'dist/events-quiz26-b.js#q26-nineteen-ten', 'dist/events-colleagues-v23.js#jonathan-spare-time-qa',
  ]),
  owen: profile('owen', '商務開發總監', '方向我先說，等下可能還有更新版。', [
    skill('sunglasses-turn', '墨鏡轉向', 'rush', '歐文碰了一下頭頂墨鏡，合作箭頭突然換向。', '剛剛那個先放著，現在走這邊。', '以地面箭頭為準往側邊閃，別跟著前一版方向追。', { damage: 14, range: 250, cooldown: 11 }),
    skill('triple-followup', '三重跟進', 'projectile', '三份寫著已跟進的便條排好，歐文抬手準備送出。', '這件有人跟嗎？再幫我追一下。', '橫向走位避開跟進便條，不要站在通知直線上。', { damage: 11 }),
    skill('parking-map', '豪車停車格', 'zone', '一張停車場紙圖鋪開，預定車位開始發亮。', '車先停這裡，合作再慢慢聊。', '車位圈亮起就離開，不要停在他的預約格。', { radius: 74, damage: 15, cooldown: 14 }),
  ], [incident('calendar-chat', '行事曆只寫聊聊', 'slow', '議程的三大項藏進聊聊兩個字，範圍正在展開。', '沒有很久，我們就聊一下。', '走出聊聊圈，別停下等他把議程講完。', { at: 26, duration: 2.5 })], [
    'dist/events-cast-v66.js#cast66-owen-meeting-sunglasses', 'dist/events-colleagues-v23.js#owen-triple-followup', 'dist/events-colleagues-v23.js#owen-tesla-run', 'dist/events-colleagues-v23.js#owen-calendar-chat',
  ]),
  sam: profile('sam', '資深資料探勘工程師', '理論我知道，先等這一集和這一批跑完。', [
    skill('chips', '洋芋片補給', 'heal', '山姆把洋芋片袋打開，補給讀條開始。', '這包還沒吃完，結論先不要催。', '趁他吃洋芋片前貼近打斷回血。', { trigger: 'hurt', heal: 18, once: true }),
    skill('degree-combo', '學碩連段', 'projectile', '兩張學位紙卡接在一起，對準你的移動路線。', '背景先介紹完，這段我有研究。', '持續側移，讓連段紙卡從旁邊飛過。', { damage: 12, cooldown: 10 }),
    skill('autoplay', '影集自動續播', 'zone', '畫面還沒播完，下一集預告區已在地上亮起。', '下一集都開始了，先把這段看完。', '離開續播圈，不要站在下一集的落點。', { radius: 72, damage: 14 }),
  ], [incident('study-rival', '瑜亮讀書會', 'guard', '讀書會的理論卡與實作卡排成一堵牆，山姆準備辯論。', '先講清楚，這個到底算不算資料科學？', '成盾前打斷，或先繞過紙牆等它消退。', { trigger: 'pressure', at: 4, shield: 16 })], [
    'dist/events-colleagues-v23.js#sam-chip-study', 'dist/events-colleagues-v23.js#sam-pureblood-degree', 'dist/events-cast-v66.js#cast66-sam-streaming-owner', 'dist/events-quiz26-a.js#quiz26-study-rivals',
  ]),
  cindy: profile('cindy', '資深專案管理師', '先選交期、人力還是範圍，不要全部都丟我身上。', [
    skill('camel-load', 'PM 駱駝負重', 'strike', '辛蒂把工作包往肩上一放，負重扇形開始亮起。', '專案已經背成這樣，還要再加鞍？', '退出負重揮擊的扇形，再從側面反擊。', { range: 130, damage: 17, windup: 1.1, cooldown: 11 }),
    skill('four-am', '凌晨四點排程', 'zone', '四點的專案訊息變成地面的日期圈。', '先確認版本，聚會等我自己決定。', '日期圈顯示就換位置，不要留在提醒落點。', { radius: 72, damage: 14 }),
    skill('handover-shield', '交接文件盾', 'guard', '互斥的兩版排程在辛蒂手上摺成紙盾。', '這次能不能先說到底以哪一版為準？', '讀條中打斷，或等排程盾結束後再連擊。', { shield: 17 }),
  ], [incident('office-mom', '第五件事也歸她', 'projectile', '四大天王的活動表又長出第五件事，辛蒂把它抽了出來。', '這個稱呼，有包含下午的專案嗎？', '橫移避開新增的工作卡，別站著接第五件。', { at: 25, damage: 13 })], [
    'dist/events-quiz26-a.js#quiz26-pm-camel', 'dist/events-quiz26-b.js#q26-cindy-unread-party', 'dist/events-cast-v66.js#cast66-cindy-handoff-weather', 'dist/events-quiz26-a.js#quiz26-office-mom',
  ]),
  professor: profile('professor', '電機領域教授／產學顧問', '今天只來半天，先把真正要問的問題拿出來。', [
    skill('half-day', '半天顧問時段', 'slow', '林老師把半天時段框起來，等待範圍開始擴大。', '背景先講到這裡，第一題是什麼？', '離開等待圈，別把閃避也排進下一週。', { duration: 2.4, cooldown: 15 }),
    skill('namecard-shield', '電機名片盾', 'guard', '顧問名片在林老師面前立起，紙盾正在成形。', '頭銜講完了，錯誤訊息請放大。', '紙盾成形前打斷，或等它消退後再出招。', { shield: 17 }),
    skill('question-stack', '一整週的問題', 'projectile', '排隊一整週的問題紙張被分成一疊，對準場中。', '一題一題來，不要每份都寫最急。', '持續橫向走位避開問題紙，利用障礙物分流。', { damage: 11 }),
  ], [incident('calendar-gap', '顧問欄位沒有下班', 'zone', '下次到訪日期還沒到，場上的任務表先亮起一圈。', '週三的事，不能先把我寫成整週在線。', '任務圈落地前離開，不要站在表格預約的位置。', { at: 30, radius: 76, damage: 14 })], [
    'dist/events-professor-v37.js#professor37-half-day-queue', 'dist/events-professor-v37.js#professor37-name-card-experiment', 'dist/events-professor-v37.js#professor37-advisor-calendar-gap',
  ]),
  annie_yu: profile('annie_yu', '商務開發助理', '我是安妮余。要轉交以前，收件人先看清楚。', [
    skill('martin-help', '馬丁幫我', 'projectile', '安妮余把幫忙便條一張張疊好，準備往前傳。', '這個先幫我看一下，後面還有附件。', '側移避開幫忙便條，不要站著等整包附件。', { damage: 10 }),
    skill('same-name', '同名信件誤投', 'zone', '一封寫著安妮的信在空中轉向，錯誤收件圈開始發亮。', '部門不一樣，這封不是寄給公主的。', '離開誤投圈，不要替同名信件站定位。', { radius: 66, damage: 14 }),
    skill('owen-forward', '主管整季轉寄', 'guard', '歐文轉來的整季附件在安妮余面前排成盾。', '先講幫哪一段，不然這包沒有底。', '在附件讀條時打斷，或等紙盾結束再連段。', { shield: 16 }),
  ], [incident('middlemen', '六位中間人', 'slow', '轉介紹的名單拉成一圈，安妮余開始逐個核對窗口。', '先找到客戶本人，別再多轉一手。', '走出轉接圈，避免被中間人的回覆拖慢。', { at: 24, duration: 2.2 })], [
    'dist/events-cast-v39-annie.js#cast39-annie_yu-martin-help', 'dist/events-cast-v39-annie.js#cast39-annie_yu-same-name', 'dist/events-cast-v39-annie.js#cast39-annie_yu-owen-forward', 'dist/events-career-v71.js#career71-bd-referral-chain',
  ]),
  princess: profile('princess', '資料探勘工程師', '先看程式和測試，別先替我的背景跑分。', [
    skill('copilot', 'Copilot 自動補字', 'projectile', '公主的筆電跑出一串補字卡，朝前方排好。', '工具會接話，不代表每句都能直接合併。', '橫向走位避開補字卡，不要沿建議直線追。', { damage: 11 }),
    skill('robot-review', '機器人評審席', 'zone', '紙機器人把空位預約起來，評審區開始閃動。', '人還沒來，空位先不要替他同意。', '評審圈顯示後離開，別坐進預約空位。', { radius: 72, damage: 14 }),
    skill('test-first', '先跑測試', 'guard', '通過與未通過的測試卡在公主面前排成紙盾。', '測試跑完，再來看誰說沒問題。', '讀條中打斷，或等測試盾消退後再攻擊。', { shield: 17 }),
  ], [incident('variable-name', '變數不會自動認親', 'strike', '公主把變數名稱重新圈好，近身修訂扇形亮起。', '名稱寫清楚，程式不會幫你猜家譜。', '往修訂扇形側邊閃，再趁收招靠近。', { trigger: 'pressure', at: 3, damage: 15, range: 129 })], [
    'dist/events-cast-v39-princess.js#cast39-princess-copilot-choice', 'dist/events-cast-v39-princess.js#cast39-princess-robot-review', 'dist/events-cast-v39-princess.js#cast39-princess-variable-name',
  ]),
  joyce: profile('joyce', '業務總監', '914 在這裡。正式窗口、正式副本，一個都別少。', [
    skill('official-window', '總監正式窗口', 'guard', '914 把窗口名單立在面前，正式流程開始成盾。', '先走正式窗口，熟也一樣。', '讀條中打斷，或等窗口盾消退再出手。', { shield: 18 }),
    skill('sales-deck', '成交簡報', 'projectile', '成交簡報被摺成一排，914 準備送出新版數字。', '報喜以前，這幾欄要先對齊。', '左右移動躲簡報，別在數字直線上追。', { damage: 12, cooldown: 10 }),
    skill('cc-everyone', '副本全體通知', 'zone', '副本收件圈正在地面展開，名單越拉越長。', '相關的人都一起看，這次不要漏。', '通知圈落定前換位置，別停著讀完所有副本。', { radius: 78, damage: 14 }),
  ], [incident('commission-zero', '獎金欄還沒出生', 'slow', '成交單上的獎金欄留白，追問範圍正在放大。', '案子先確認，這一格還要再問。', '走出追問圈，保留閃避度過拖慢時間。', { at: 28, duration: 2.4 })], [
    'dist/events-cast-v39-joyce.js#cast39-joyce-same-name', 'dist/events-career-v71.js#career71-sales-commission-zero', 'dist/cast-v39.js#CAST_PROFILES_V39',
  ]),
  janet: profile('janet', '財會主管', '五千元也要對，差一張附件都不算對完。', [
    skill('five-thousand', '五千元核銷圈', 'zone', 'Janet 把公費欄位一格格圈起，核銷區開始亮起。', '再核一次，這次是哪一張少了？', '離開核銷圈，別為了看明細停在落點。', { radius: 70, damage: 14 }),
    skill('voucher-return', '憑證退件', 'projectile', '缺附件的憑證被蓋上退件章，Janet 抬手準備寄回。', '補齊再送，不能只寫大家知道。', '橫移躲開退件單，不要站在回件路上。', { damage: 11 }),
    skill('white-ledger', '白隊公費帳本', 'guard', '收支表和憑證在 Janet 面前疊成紙盾。', '朋友的名字不能代替憑證。', '帳本成盾前打斷，或等對帳盾結束再連擊。', { shield: 18 }),
    skill('cash-runway', '現金跑道', 'rush', 'Janet 把付款行事曆拉出一條前進箭頭。', '錢什麼時候進來，不能用願景回答。', '離開付款箭頭的方向，等她停步再反擊。', { damage: 13, cooldown: 13 }),
  ], [incident('new-form', '表單又改一版', 'slow', '剛填好的欄位被新版本覆蓋，修改範圍正在展開。', '這次以新版為準，附件請一起更新。', '走出改版圈，不要站著重新填表。', { at: 29, duration: 2.4 })], [
    'dist/events-cast-v39-janet.js#cast39-janet-white-team-budget', 'dist/events-cast-v39-janet.js#cast39-janet-wine-ledger', 'dist/events-career-v71.js#career71-finance-runway', 'dist/events-backoffice-v28.js#accounting28-final-form',
  ]),
  captain: profile('captain', '人資行政專員', '全船集合！位子不夠的部分，我們邊走邊想。', [
    skill('fifteen-seats', '十五座位結界', 'zone', '二十五張名牌朝十五張椅子的圈裡集合。', '先進來，大家擠一下就有位子。', '圈亮起就換位置，別替空椅補人數。', { radius: 80, damage: 14 }),
    skill('one-star-delivery', '一點五星下午茶', 'projectile', '船長把外送菜單摺成紙船，準備送往你的位置。', '照片看起來不錯，評分等下再看。', '側移避開紙船菜單，不要沿航線後退。', { damage: 11 }),
    skill('all-aboard', '全船集合', 'strike', '船長高舉名單，集合扇形開始發亮。', '人先到齊，行程再更新！', '離開集合扇形，等她喊完再出手。', { damage: 16, range: 132, cooldown: 11 }),
    skill('coffee-roster', '咖啡濃度試題', 'guard', '咖啡表和招募文案在船長面前排成紙盾。', '先幫我看一下，這杯到底夠不夠濃？', '讀條中打斷，或等咖啡題卡盾消退。', { shield: 15 }),
  ], [incident('route-update', '新航線另行通知', 'rush', '活動名單突然換頁，船長的航線箭頭重新指向場中。', '原本那站先不去，我們現在改走這邊。', '以新箭頭為準往側邊閃，不要追舊航線。', { at: 26, range: 260, damage: 15 })], [
    'dist/events-cast-v39-captain.js#cast39-captain-room-capacity', 'dist/events-career-v71.js#career71-admin-one-star', 'dist/events-career-v71.js#career71-hr-jd-coffee',
  ]),
  zoe: profile('zoe', '教育訓練專家主管／福委會會長', '麥克風測試，一二一。先集合，再來講規則。', [
    skill('outdoor-lineup', 'Outdoor 集合', 'zone', '201 把分組名單攤開，集合範圍亮起。', '先不要動，等我說開始。', '圈落定前移開，不要為了等口令停在原地。', { radius: 76, damage: 14 }),
    skill('training-rollcall', '培訓點名', 'projectile', '點名卡一張張排好，201 準備按部門送出。', '培訓一小時，請準時到場。', '左右移動躲點名卡，別和名單站在同一直線。', { damage: 10 }),
    skill('welfare-pack', '福委會補給', 'heal', '201 打開活動補給箱，準備補回主持氣勢。', '休息一下，下一個活動還沒開場。', '在補給讀條結束前貼近打斷。', { heal: 18, trigger: 'hurt', once: true }),
  ], [incident('frozen-mic', '冷凍麥克風', 'slow', '麥克風的通知燈忽然熄了一格，周圍變成冷色範圍。', '我還在名單上，這支麥克風先別收。', '走出冷色圈，保留閃避度過拖慢時間。', { at: 27, duration: 2.5 })], [
    'dist/events-cast-v65.js#cast65-zoe-outdoor-mic', 'dist/events-cast-v65.js#cast65-zoe-training-hours', 'dist/events-cast-v65.js#cast65-zoe-cold-storage',
  ]),
  action: profile('action', '商務長', '先看看這張鏈，錢和交付我們等下再補。', [
    skill('blockchain', '區塊鏈連線', 'zone', '順哥把三個區塊連成地面範圍，箭頭越畫越粗。', '鏈上都接好了，剩下就是執行。', '區塊落定前離開圈，別被箭頭留在原地。', { radius: 78, damage: 15 }),
    skill('bottle-shelf', '高粱收藏盾', 'guard', '酒櫃年份卡排成一面盾，順哥開始介紹下一瓶。', '這一排有故事，提案先放旁邊。', '讀條中打斷，或等收藏紙盾消退再接連段。', { shield: 18 }),
    skill('empty-budget', '空白預算書', 'projectile', '收入那一格被箭頭蓋住，順哥把白皮書朝前翻出。', '方向有了，預算我們先研究。', '側移躲開白皮書，別沿箭頭直線追。', { damage: 11 }),
    skill('emba-link', 'EMBA 連段', 'strike', '同學的名片排成近身扇形，順哥往前踏了一步。', '都是同學，先做一版看看。', '往名片扇形側面閃，等他收招再靠近。', { range: 130, damage: 14, cooldown: 12 }),
  ], [incident('proof-of-bottle', 'Proof of 高粱', 'slow', '技術白板與瓶身年份排成一圈，說明開始越講越長。', 'Proof of work，我們用這個比喻。', '走出說明圈，不要讓整段比喻拖住腳步。', { at: 29, duration: 2.4 })], [
    'dist/events-cast-v65.js#cast65-action-chain-whiteboard', 'dist/events-cast-v65.js#cast65-action-bottle-shelf', 'dist/events-cast-v65.js#cast65-action-emba-sync', 'dist/events-cast-v65.js#cast65-action-proof-of-bottle',
  ]),
  hester: profile('hester', '業務總監', '客戶說的、老闆答應的，我們先分成兩欄。', [
    skill('classmate-network', 'EMBA 聯絡網', 'projectile', '海姐把聯絡名片排成一串，準備逐張送出。', '窗口我來問，條件請你補清楚。', '保持側移，別站在聯絡卡的直線上。', { damage: 11 }),
    skill('customer-scope', '客戶範圍盾', 'guard', '客戶條件與公司承諾分成兩面紙，海姐把中間撐開。', '這兩套，不能直接寫成同一套。', '讀條中打斷，或等範圍盾消退再攻擊。', { shield: 17 }),
    skill('one-more-request', '追加需求潮', 'zone', '客戶的新增需求在地面疊成一個落點圈。', '這段要不要做，先把代價一起說。', '追加圈亮起後換位，別站著接下整包。', { radius: 74, damage: 14 }),
  ], [incident('pilot-revenue', '免費試點的下一步', 'rush', '試點計畫畫出一條前進箭頭，海姐開始確認下一段。', '免費試點不能永遠免費，下一步要定了。', '閃到箭頭側邊，等她停步再找空檔。', { at: 26, damage: 14, range: 240 })], [
    'dist/events-cast-v65.js#cast65-hester-classmate-scope', 'dist/events-cast-v65.js#cast65-hester-customer-limits', 'dist/events-career-v71.js#career71-bd-pilot-revenue',
  ]),
  simon: profile('simon', '產品設計專員', '先講清楚改哪裡，最後別又說第一版最好。', [
    skill('version-one', '還是第一版', 'heal', '丁哥翻回第一張設計稿，準備把改過的氣勢補回來。', '八版改完了，現在回到第一版。', '在回版讀條結束前貼近打斷。', { trigger: 'hurt', heal: 18, once: true }),
    skill('logo-bigger', 'Logo 再大一點', 'zone', 'Logo 的紙樣在地面放大，資訊空間越來越小。', '再大就只剩這個了，你確定？', '放大圈亮起後移開，不要等它把位置吃完。', { radius: 82, damage: 14 }),
    skill('camel-start', '駱駝賽開跑', 'rush', '丁哥舉起主持旗，跑道箭頭開始亮起。', '規則先講好，今天誰喊停？', '往跑道側邊閃，等旗子落下後再靠近。', { range: 250, damage: 14, cooldown: 11 }),
    skill('pixel-ruler', '像素尺橫掃', 'strike', '一把紙尺在丁哥手上展開，近身測量扇形亮起。', '差這幾個像素，不能叫我順便修十二項。', '退出紙尺扇形，趁收尺後反擊。', { range: 135, damage: 14, cooldown: 12 }),
  ], [incident('twelve-jobs', '全才副理十二合一', 'projectile', '設計、前端與拍片便條一起飛到桌邊，丁哥把它們退了回來。', '全才副理是綽號，不是十二合一職缺。', '橫向避開工作便條，別站著替十二件事簽收。', { at: 28, damage: 13 })], [
    'dist/events-cast-v65.js#cast65-simon-version-one', 'dist/events-cast-v65.js#cast65-simon-logo-map', 'dist/events-cast-v65.js#cast65-simon-camel-host', 'dist/events-cast-v65.js#cast65-simon-pixel-contract',
  ]),
  james: profile('james', '回鍋同事', '帳號又開好了？那我先試一下這版公司的操作。', [
    skill('seven-returns', '七進七出', 'rush', '詹姆士翻出回鍋通行卡，熟悉的路線箭頭亮起。', '這條路我走過，版本可能不一樣。', '往箭頭側面閃，別站在他的回鍋路上。', { range: 270, damage: 15, cooldown: 11 }),
    skill('welcome-meal', '歡迎餐補給', 'heal', '歡迎餐和離職飯的紙盤被放到一起，補給開始讀條。', '這頓先算歡迎，日期不要填錯。', '趁用餐讀條結束前近身打斷。', { trigger: 'hurt', heal: 18, once: true }),
    skill('old-system', '舊系統記憶', 'projectile', '詹姆士把不同年代的操作卡分成一疊。', '以前是這樣，不代表這版還一樣。', '側移躲開舊版操作卡，利用障礙物擋住來路。', { damage: 11 }),
  ], [incident('same-computer', '電腦也辦回鍋', 'guard', '有舊貼紙的紙電腦被搬回場中，重新配發的讀條開始。', '同一台，也得重新確認環境。', '在重新配發完成前打斷，或等設備盾消退。', { at: 27, shield: 16 })], [
    'dist/events-cast-v65.js#cast65-james-seventh-login', 'dist/events-cast-v65.js#cast65-james-farewell-credit', 'dist/events-cast-v65.js#cast65-james-company-version', 'dist/events-cast66-james.js#cast66-james-hardware-return',
  ]),
  johnny: profile('johnny', '專案管理師', '臨時加一件可以，先告訴我哪一件要拿掉。', [
    skill('one-more-cell', '多一格排程', 'zone', '強尼的專案表又長出一格，新增區域開始閃動。', '時間、人力、範圍，總得選一個能動。', '新增格亮起後移開，別被追加排程占住位置。', { radius: 74, damage: 14 }),
    skill('midnight-question', '半夜一個問號', 'projectile', '手機通知變成一排問號紙卡，強尼準備送出狀態回報。', '這個問號，是問進度還是要我重新上班？', '左右走位避開問號，別在通知直線上等回覆。', { damage: 11 }),
    skill('minutes-shield', '會議紀錄盾', 'guard', '剛拍板的會議紀錄在強尼面前立起。', '口頭改版也可以，請把新的版本留清楚。', '成盾前打斷，或等會議盾消退再近身。', { shield: 17 }),
  ], [incident('skip-level', '主管最後才知道', 'slow', '越級交辦的箭頭穿過原排程，強尼開始重算路徑。', '人已經被叫走了，現在這張表要誰負責？', '走出重排圈，留閃避處理短暫減速。', { at: 29, duration: 2.3 })], [
    'dist/events-cast-v65.js#cast65-johnny-one-more-task', 'dist/events-cast-v65.js#cast65-johnny-midnight-question', 'dist/events-cast-v65.js#cast65-johnny-meeting-minutes', 'dist/events-career-v71.js#career71-executive-skip-level',
  ]),
  alice: profile('alice', '移動手遊王', '這裡至少寫清楚保底。先看牌，再決定怎麼打。', [
    skill('ten-pull', '十連抽紙牌', 'projectile', '愛麗絲把十連卡包展開，紙牌對準前方。', '先別急著說歐，這輪還沒抽完。', '持續側移躲開紙牌，不要沿著卡包方向追。', { damage: 12, cooldown: 10 }),
    skill('pity-counter', '保底補給', 'heal', '抽數計數器停在保底格，愛麗絲準備領取本場補給。', '這一格至少寫得很清楚。', '在領取讀條結束前貼近打斷。', { trigger: 'hurt', heal: 18, once: true }),
    skill('friend-raid', '好友副本護盾', 'guard', '合作隊伍的兩張紙卡在愛麗絲面前合成盾。', '位置留好了，這輪先一起過。', '組隊讀條時打斷，或等合作盾結束再連段。', { shield: 16 }),
    skill('ssr-extra', 'SSR 追加需求', 'zone', 'SSR 紙卡翻面，追加需求的落點圈亮起。', '稀有度很高，技能怎麼還是追加？', '新卡落地前走出圈，別站著讀完整張說明。', { radius: 76, damage: 15, cooldown: 14 }),
  ], [incident('duplicate-rick', '又抽到同一通電話', 'slow', '三張瑞克紙卡同時亮起，電話轉接圈開始展開。', '三張不同版本，怎麼都叫我去問傑克？', '走出轉接圈，別停著接完三通電話。', { at: 25, duration: 2.3 })], [
    'dist/events-alice-v71.js#alice71-first-pull', 'dist/events-alice-v71.js#alice71-pity-counter', 'dist/events-alice-v71.js#alice71-friend-raid', 'dist/events-alice-v71.js#alice71-boss-rarity', 'dist/events-alice-v71.js#alice71-dupe-rick',
  ]),
  wine: profile('wine', '系統工程師', '我叫 Wine，不是 Wing。系統怎樣？你先聽完整句。', [
    skill('let-crash', '讓它爆', 'zone', '紅酒把故障圖圈起來，紅色事故區開始閃動。', '讓它爆之前，先看這裡到底卡什麼。', '離開事故圈，不要站在故障核心等恢復。', { radius: 78, damage: 17, windup: 1.3, cooldown: 14 }),
    skill('restart', '系統重新啟動', 'heal', '紅酒開始重啟紙主機，恢復進度條正在前進。', '能開機和能扛住，是兩件事。', '在重啟讀條結束前貼近打斷。', { trigger: 'hurt', heal: 18, once: true }),
    skill('on-call', '值班通知', 'projectile', '一排下班後的通知從紅酒手機彈出。', '我會修，不代表整夜都自動算我的。', '持續側移，讓通知卡從旁邊通過。', { damage: 11 }),
  ], [incident('wrong-recipient', 'Wine 還是 Wing', 'guard', '寄錯老闆的郵件在紅酒手上摺成一面回信盾。', '收件人看清楚，這封不是執行長回的。', '回信讀條時打斷，或等誤認盾消退。', { at: 24, shield: 16 })], [
    'dist/events-cast-v74.js#cast74-wine-let-crash', 'dist/events-cast-v74.js#cast74-wine-last-resort', 'dist/events-cast-v74.js#cast74-wine-name-ping',
  ]),
  peter: profile('peter', '助理工程師', '我先把遊戲視窗收起來。剛才那個是測試。', [
    skill('shortcut', '快捷鍵十連發', 'projectile', 'P 神按住快捷鍵，一排批次操作卡開始對準你。', '這招很快，先讓我試十次。', '橫向走位避開批次卡，不要沿直線追快捷鍵。', { damage: 11 }),
    skill('patch-day', '遊戲更新護盾', 'guard', '更新條出現在 P 神面前，紙螢幕開始成盾。', '系統正在更新，真的。', '讀條中打斷，或等更新盾消退再連段。', { shield: 17 }),
    skill('keyboard-guest', '鍵盤路過', 'rush', 'P 神看向旁邊的鍵盤，腳邊亮起插隊箭頭。', '我幫你按一下，很快。', '往插隊方向側邊閃，等他離開鍵盤再出手。', { damage: 14, range: 230, cooldown: 11 }),
  ], [incident('one-plus-one', '計算機的一加一', 'zone', '計算機的大按鍵落點開始發亮，P 神正在確認結果。', '我有開計算機，這個很精準。', '按鍵落地前走出圈，不要停在等號上。', { at: 26, radius: 68, damage: 14 })], [
    'dist/events-cast74-peter.js#cast74-peter-shortcut-macro', 'dist/events-cast-v74.js#cast74-peter-patch-day', 'dist/events-cast-v74.js#cast74-peter-keyboard-guest', 'dist/events-cast-v74.js#cast74-peter-calculator',
  ]),
  tony: profile('tony', '助理工程師', '叫我 8+9 也行，別又把上一個 Tony 的工作塞過來。', [
    skill('breakfast', '早餐揪團補給', 'heal', '8+9 把早餐袋打開，準備補回下一輪的力氣。', '這家真的可以，先吃再講。', '趁早餐讀條結束前貼近打斷。', { trigger: 'hurt', heal: 18, once: true }),
    skill('straight-talk', '江湖直球', 'strike', '8+9 捲起袖子，近身直球扇形開始亮起。', '話先講清楚，別又一句兄弟就全丟我。', '往扇形側邊閃，等直球揮完再反擊。', { damage: 17, range: 127, windup: 1.05, cooldown: 11 }),
    skill('smoke-break', '五分鐘煙休', 'rush', '8+9 看向休息區，離席箭頭在腳邊亮起。', '出去一下，別把我直接設成外勤。', '往離席箭頭的側面閃，不要追著他的路線跑。', { damage: 13, range: 255, cooldown: 12 }),
  ], [incident('old-tony-mail', '上一個 Tony 的信', 'projectile', '比本人年資還長的舊案郵件出現，8+9 把它退回場中。', '名字一樣，不代表這案子是我接的。', '橫移避開舊案紙信，別站著認領同名待辦。', { at: 25, damage: 13 })], [
    'dist/events-cast-v74.js#cast74-tony-old-mail', 'dist/events-cast-v74.js#cast74-tony-smoke-timer', 'dist/events-cast74-henry.js#cast74-henry-breakfast-rsvp',
  ]),
  henry: profile('henry', '技術總監', '圖可以先畫，權限、人力和預算也要一起畫進去。', [
    skill('architecture-arrow', '架構箭頭重畫', 'zone', '老大把跨系統箭頭展開，新的邊界圈亮起。', '線很短，跨過去的工夫要一起算。', '邊界圈落定前離開，不要站在新箭頭下面。', { radius: 76, damage: 15 }),
    skill('three-urgent', '三件最高優先', 'guard', '三張最急便條在老大面前排成盾。', '我沒有三雙手，先排誰先。', '排序讀條時打斷，或等優先級盾消退再連段。', { shield: 18 }),
    skill('old-server', '退役主機投影', 'projectile', '老大把舊主機的測試卡攤開，準備把限制送到你面前。', '以前能開，不能直接寫成今天都能扛。', '左右移動避開測試卡，利用障礙物分流。', { damage: 12, cooldown: 10 }),
  ], [incident('three-days', '三週改成三天', 'slow', '日曆上的週字被擦掉，趕工範圍開始展開。', '真要快，得一起選少做什麼。', '走出趕工圈，別讓改單位拖慢移動。', { at: 28, duration: 2.4 })], [
    'dist/events-cast-v74.js#cast74-henry-arrow-edit', 'dist/events-cast-v74.js#cast74-henry-three-urgent', 'dist/events-cast-v74.js#cast74-henry-borrowed-server', 'dist/events-cast-v74.js#cast74-henry-estimate-question',
  ]),
  mia: profile('mia', '人資專員', '先確認這張名牌是你，後面的問題我們一題一題來。', [
    skill('welcome-card', '報到名牌', 'projectile', '米雅把報到名牌排好，準備逐張送到本人面前。', '名字對了，才知道下一個窗口在哪裡。', '側移避開名牌卡，別站在寄送直線上。', { damage: 10 }),
    skill('consent-shield', '本人同意盾', 'guard', '需要本人確認的紙卡在米雅面前組成盾。', '客氣不是自動同意，這段先問本人。', '確認讀條時打斷，或等同意盾消退再近身。', { shield: 17 }),
    skill('faq-book', '整本 FAQ', 'zone', '一本厚厚的問題簿攤開，待答問題的落點圈亮起。', '可以問，但先把同一題放在同一頁。', '離開問題簿的落點圈，不要停著翻完整本。', { radius: 72, damage: 14 }),
  ], [incident('coffee-title', '先幫忙泡咖啡', 'slow', '人資名牌旁忽然多了一張咖啡便條，臨時分工圈展開。', '這件要幫忙，可以先把範圍說清楚。', '走出臨時分工圈，別讓順便兩字拖住位置。', { at: 24, duration: 2.2 })], [
    'dist/events-cast-v74.js#cast74-mia-welcome-card', 'dist/events-cast-v74.js#cast74-mia-faq-help', 'dist/events-cast-v74.js#cast74-mia-coffee-request', 'dist/cast-v74.js#CAST_PROFILES_V74',
  ]),
});

// This optional final encounter remains separate from the 34 public colleagues.
// Only the story-challenge controller decides when its identity may be shown.
export const HIDDEN_BRAWL_ID = 'hidden-visitor';
export const HIDDEN_BRAWL_PROFILE = profile(HIDDEN_BRAWL_ID, '辦公室支援角色', '大家的最後一版我都收到了。現在，輪到你說清楚這一場的範圍。', [
  skill('punctuation-boundary', '標點責任切割', 'strike', '魚酥姐把逗點與新增保證分開，紅色校訂筆正在近身畫線。', '一個逗點，不能替整個產品多簽一張保證。', '離開校訂筆的扇形，等她收筆後再靠近。', { damage: 19, range: 138, windup: 1.05, cooldown: 10, color: '#bd7680' }),
  skill('final-new-volley', 'Final New 連投', 'projectile', '一疊 final、new、最新版的紙稿排成直線，魚酥姐正對齊最後一份。', '檔名排得再長，也要先指定真的要發布哪一版。', '往側面移動躲稿件，別沿著版本直線往後退。', { damage: 14, range: 420, windup: 1.1, cooldown: 10, color: '#7d93b0' }),
  skill('scope-outside-frame', '鏡頭外的工作圈', 'zone', '鏡頭沒拍到的工單一張張落向地面，真正的工作範圍開始發亮。', '畫面拍不到的修改，還是得算進交付。', '在工單落地前走出標記圈，不要站著等鏡頭轉過來。', { damage: 20, radius: 84, windup: 1.4, cooldown: 15, color: '#b4917e' }),
  skill('snack-state-table', '魚酥狀態分類表', 'slow', '已開封、未開封與待確認三張標籤，在你腳邊排出分類範圍。', '開過就是開過，這一格不能再靠大家都沒說。', '離開分類圈；被拖慢時仍可閃避，不必留在原地替標籤作答。', { damage: 6, radius: 76, duration: 2.3, windup: 1.25, cooldown: 14, color: '#a39d70' }),
  skill('shelf-restock', '零食櫃續航補給', 'heal', '魚酥姐打開已標好日期的補給盒，準備趁整理空檔吃一口。', '補給有記錄，下一輪也要有停止條件。', '在補給讀條結束前近身打斷；每場只補給一次。', { trigger: 'hurt', once: true, heal: 22, windup: 1.5, cooldown: 18, pose: 'heal', color: '#8ba17e' }),
  skill('confirmed-scope-shield', '已確認範圍護盾', 'guard', '原文、改寫與未確認承諾分成三欄，紙張正在魚酥姐面前組成護盾。', '支援到哪裡，先照已確認的範圍算。', '讀條時打斷，或等護盾消退再交連段；別把大招全打在盾上。', { shield: 20, duration: 2.4, windup: 1.1, cooldown: 17, color: '#8798ad' }),
], [
  incident('eight-final-meeting', '八份最後版同時開會', 'zone', '八張都寫著最後版的紙稿一起攤開，真正有效的那一圈即將蓋章。', '今天先指定一份，其餘七份請好好封存。', '走出蓋章圈，等八份文件落定再反擊。', { at: 28, damage: 22, radius: 88, windup: 1.5, color: '#b68e83' }),
  incident('three-access-cards', '同一人的三張門禁卡', 'rush', '翻譯、行銷與零食管理三張門禁卡排成一線，魚酥姐準備把排程推回原窗口。', '同一個人，不能同時坐在三個位置。', '往排程箭頭的側邊閃，利用障礙物讓衝刺停下。', { trigger: 'pressure', at: 4, damage: 20, range: 220, radius: 42, windup: 1.3, color: '#8a9f9d' }),
], [
  'dist/hidden-encounter-v45.js#HIDDEN_PERSONAS_V45',
  'dist/hidden-encounter-v45.js#getHiddenEncounterEventV45',
  'dist/hidden-stories-v66.js#HIDDEN_STORIES_V66',
]);

export function getBrawlProfile(id) {
  if (id === HIDDEN_BRAWL_ID) return HIDDEN_BRAWL_PROFILE;
  return Object.hasOwn(BRAWL_ROSTER, id) ? BRAWL_ROSTER[id] : null;
}
