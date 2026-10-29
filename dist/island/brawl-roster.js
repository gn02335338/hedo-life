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
    skill('golden-left', '黃金左腳', 'strike', '翅膀扶穩拐杖，金色扇形正在腳邊展開。', '這一腳不用預算，醫藥費再另案簽核！', '看準金色扇形，往側面閃避；出腳後再反擊。', { damage: 21, range: 145, windup: 1.05, cooldown: 10, pose: 'kick', color: '#c7a355' }),
    skill('third-floor', '三樓人才自由落體', 'zone', '「去三樓跳下去啊！」翅膀把紙板三樓拍進場，落點開始發亮。', '人才往上走，責任往下掉；紙板先示範！', '離開標記圈；這是場地招式，別站著聽完訓話。', { damage: 20, radius: 78, windup: 1.4, cooldown: 17, range: 380 }),
    skill('sandalwood', '全身檀香', 'heal', '翅膀突然披上浴巾，檀香補給正在讀條。', '人事還沒超渡完，我先把自己薰成無責任狀態。', '在香氣讀條結束前貼近出手，打斷這次回血。', { heal: 20, trigger: 'hurt', once: true, pose: 'bath' }),
    skill('extra-demand', '順便做到投胎', 'projectile', '翅膀拿起追加需求單，紙張朝你對準。', '很簡單嘛，這一世做不完就交給下一世的你。', '橫向移動躲開需求單，不要沿著紙張的方向跑。', { damage: 11, cooldown: 9 }),
    skill('ten-minutes', '十分鐘無期徒談', 'slow', '翅膀攤開相談時段表，腳下出現倒數範圍。', '只耽誤你十分鐘；你的人生不算在計時裡。', '先走出相談範圍；被拖慢時保留閃避。', { duration: 2.3, cooldown: 16 }),
  ], [incident('chair-review', '椅子先過試用期', 'rush', '一張貼著績效表的紙椅滑向場中，翅膀準備跟著出腳。', '椅子每天都有到，你的貢獻有贏過它嗎？', '離開衝刺方向，等椅子和翅膀停下再靠近。', { at: 24, damage: 18, pose: 'kick' })], [
    'dist/events-quiz26-b.js#q26-chair-left-shoe', 'dist/events-quiz26-a.js#quiz26-ceo-first-talk', 'research/island-signature-skills.md#creator-brief',
  ]),
  spencer: profile('spencer', '董事長', '今天先談世界第一，再談你站在哪裡。', [
    skill('world-first', '世界第一大餅墳場', 'zone', '屎潘蛇把願景圖攤到地上，第一名的圓圈正在放大。', '營收還沒落地，大餅先圈好祖墳。', '在版圖落定前走出圈，別被願景卡住位置。', { radius: 74, damage: 15 }),
    skill('four-digits', '四位數只剩密碼', 'projectile', '四張數字紙牌在屎潘蛇手上排成一列。', '股價上不去沒關係，Wi-Fi 密碼已經四位數。', '左右移動避開紙牌，別在直線上追。', { damage: 11, cooldown: 10 }),
    skill('alumni-circle', '校友護體免責圈', 'guard', '屎潘蛇戴好圓眼鏡，校友名牌開始環繞。', '同學先進來，責任請留在校門外。', '等名牌盾消退再連擊，或趁讀條尚未完成打斷。', { shield: 17 }),
    skill('cofounder-card', '共同創辦共同超渡', 'strike', '屎潘蛇翻出多印一行的名片，手臂向後蓄力。', '名片再多一行，薪水請少問一句。', '退到名片扇形外，等揮完再貼近。', { range: 126, damage: 14, cooldown: 12 }),
  ], [incident('seat-table', '股東站票黃泉號', 'zone', '座位表忽然展開，空椅子的落點出現標記。', '錢已經進來了，人就不用全部進來。', '趁座位尚未落下換位置，不要被空椅圍住。', { at: 29, radius: 82, damage: 16 })], [
    'dist/events-quiz26-b.js#q26-spring-dinner-seats', 'dist/events-backoffice-v28.js#finance28-shares-invitation', 'dist/events-quiz26-a.js#quiz26-table-tea',
  ]),
  erich: profile('erich', '法務長', '先別急著動手，這一條我還沒念完。', [
    skill('redline', '生死狀修訂追蹤', 'zone', '法師在場地上拉出紅色修訂範圍。', '刪掉的權益會留紅線，方便你懷念。', '走出紅線圈，別為了追人停在修訂區。', { radius: 66, damage: 14 }),
    skill('registered-letter', '掛號直達陰曹', 'projectile', '法師把信封封好，朝你這邊抬手。', '附件太多，連鬼差都要補簽收。', '側移躲信封，利用障礙物阻擋來信。', { damage: 12, cooldown: 10 }),
    skill('clause-shield', '條款長過你的命', 'guard', '一整頁條款在法師面前摺成紙盾。', '還沒念到附件，你的試用期已經過完了。', '讀條時打斷，或等紙盾時效結束再交連段。', { shield: 18 }),
    skill('signature-sweep', '此處簽名往生', 'strike', '法師的筆尖停在簽名欄，近身扇形亮起。', '請簽這裡，日期填今天；夢想填過去式。', '繞到側邊，別站在筆尖的扇形內。', { damage: 12, cooldown: 12 }),
  ], [incident('three-piece', '離職三件套合體', 'guard', '文件夾、印章與權限單一起排上桌，法師開始點名。', '文件、印章、權限一起到，只有資遣費還在路上。', '趁程序讀條打斷，或先走位等三件紙盾消退。', { trigger: 'pressure', at: 4, shield: 18 })], [
    'dist/events-cast-v35-legal.js#cast35-erich-legal-redline', 'dist/events-jack.js#jack-departure-draft',
  ]),
  sonny: profile('sonny', 'MIS', '先講喔，我今天狀態不算正式出賽。', [
    skill('old-injury', '未開打先工傷', 'guard', '阿福扶著膝蓋慢慢躺下，舊傷聲明正在展開。', '我這個傷很有年資，不能用今天的比賽算！', '在聲明讀條時打斷；紙盾生效後先拉開等他起身。', { trigger: 'lowHp', once: true, shield: 18, duration: 2.5, windup: 1.1, pose: 'down' }),
    skill('pizza', '三片披薩詐傷餐', 'heal', '阿福掀開披薩盒，開始認真計算三片補給。', '手拉傷不能比，拿第三片披薩倒是復健得很好。', '在披薩讀條結束前近身打斷，別讓他安心吃完。', { trigger: 'hurt', heal: 20, once: true, pose: 'pizza' }),
    skill('excuse-chain', '輸不起無限續杯', 'projectile', '阿福把時間、地點和各種例外揉成一疊紙球。', '剛才是試打、重來、沒暖身；輸的那場不在本宇宙。', '持續橫向走位，讓理由球飛過身旁。', { damage: 10, cooldown: 9 }),
    skill('arm-world', '未出賽世界冠軍', 'strike', '阿福拉開架勢，腕力比賽的近身範圍亮起。', '只要不比，就永遠沒有人能證明我輸。', '等他把手揮完，再從側邊接近。', { range: 125, damage: 18, windup: 1.15, cooldown: 12 }),
    skill('printer-language', '雞鴨同鍋 PIP', 'slow', '印表機紙張在阿福身旁打轉，他開始分誰是雞、誰是鴨。', '先分清楚誰是雞誰是鴨，最後背鍋的反正不是我。', '離開紙張範圍，別站在原地回答分類題。', { cooldown: 15, duration: 2.4 }),
  ], [incident('breaking-news', '重大消息胎死腹中', 'guard', '阿福神秘地壓低聲音，要全場先停一下聽他講。', '我有重大消息……算了，保留給下一次重大消息。', '讀條時出手打斷，或趁紙盾期間重新找空檔。', { at: 25, shield: 14 })], [
    'dist/events-video.js#video-pizza-overtime', 'dist/events-quiz26-a.js#quiz26-arm-draw', 'dist/events-chronicle-v22.js#sonny-announcement-withdrawn', 'research/island-signature-skills.md#creator-brief',
  ]),
  jenjen: profile('jenjen', '行政長', '先把表格填完，下一個流程才輪得到你。', [
    skill('room-tetris', '會議室遺體拼圖', 'zone', '真真把臨時會議排成地面格子。', '人塞得進去就算有位子，呼吸不是場地需求。', '格子落定前換位，別留在重疊的會議區。', { radius: 70, damage: 13 }),
    skill('key-ring', '十八層地獄門禁', 'projectile', '真真把一串紙鑰匙繞了一圈，對準你的方向。', '每一層都有權限，沒有一層能讓你下班。', '側移躲開鑰匙，別沿著來路追。', { damage: 11 }),
    skill('attendance-stamp', '人沒到魂先簽', 'guard', '活動名單和簽到章在真真面前排成一面盾。', '活動可以不快樂，簽到表不能不完整。', '打斷蓋章讀條，或等名單盾消退再攻擊。', { shield: 16 }),
  ], [incident('receipt-roundtrip', '發票輪迴六道', 'projectile', '一張沒有主人的發票繞場回到真真手上。', '這張沒統編，請回去重新投胎。', '發票抬手後就橫向走開，別站著找簽名。', { at: 23, damage: 14 })], [
    'dist/events-backoffice-v28.js#admin28-room-tetris', 'dist/events-backoffice-v28.js#admin28-event-attendance', 'dist/events-backoffice-v28.js#accounting28-receipt-orphan',
  ]),
  rick: profile('rick', '老闆乾兒子', '這個你先做，不懂就再去問傑克。', [
    skill('call-jack', '有事傑克沒事乾爹', 'projectile', '瑞克舉起電話，一疊轉接單對準你。', '我負責答應，傑克負責讓宇宙遵守。', '橫向閃開轉接單，別一路跟著電話直線跑。', { damage: 11 }),
    skill('special-appointment', '血統防火牆', 'guard', '小皇冠轉了一圈，特別任用通知開始蓋章。', '技術債可以穿透系統，穿不透我的家譜。', '讀條中打斷；皇冠盾生效後保留大招。', { shield: 18 }),
    skill('push-broadcast', '推播遺產稅', 'zone', '瑞克圈起整片推播名單，通知範圍開始閃動。', '我已經交接了，沒人參加是你們的問題。', '離開推播圈，別為了追問交接停在原地。', { radius: 75, damage: 14, cooldown: 14 }),
    skill('shortcut-approval', '先上線再上香', 'rush', '瑞克指向前方，準備把待辦直接推到你面前。', '先說可以，後面的追思會請找傑克。', '看清方向往旁邊閃，等衝完再反擊。', { damage: 13, cooldown: 13 }),
  ], [incident('handover-complete', '雙方缺席交接法會', 'slow', '一封寫著交接完成的信展開，場上的待辦開始黏人。', '人都沒到，交接已經圓滿完成。', '走出郵件範圍，被拖慢時用閃避重新拉開。', { at: 26, duration: 2.5 })], [
    'dist/events-jack.js#jack-referral-loop', 'dist/events-ai-v31.js#ai31-auto-increment', 'dist/events-alice-v71.js#alice71-dupe-rick',
  ]),
  kind: profile('kind', '技術經理', '下班別急著走，我知道一條神秘路線。', [
    skill('mystery-route', '阿良帶路人間蒸發', 'rush', '阿良先看了一眼碼頭方向，腳邊亮起集合箭頭。', '地址到了再說；到了找不到我也別急。', '往集合箭頭的側邊閃，別跟著他衝。', { damage: 15, range: 260, cooldown: 11 }),
    skill('coat-seat', '外套代打招魂術', 'zone', '一件外套飄向預告落點，阿良本人還在說馬上到。', '外套有出席，我本人採遠端失蹤。', '離開外套落點，不要替衣服顧座位。', { radius: 70, damage: 12, cooldown: 13 }),
    skill('keyword-overseas', 'SEO 陰間關鍵字', 'projectile', '阿良把一排不該出現的搜尋字卡送向你。', '排名是上去了，客戶的搜尋紀錄不想承認。', '側移避開字卡，利用場地障礙擋住錯誤關鍵字。', { damage: 10 }),
    skill('next-stop', '續攤續到投胎', 'heal', '阿良打開路線補給包，正準備補滿下一攤的氣勢。', '這杯喝完就走，下一世那杯另算。', '在補給讀條結束前貼近打斷。', { trigger: 'hurt', heal: 18, once: true }),
  ], [incident('fifty-eight', '五十八度靈魂出竅', 'guard', '阿良把聚會行程排成一排，宣布今晚還很早。', '電池還有沒有電不知道，人先進省電模式。', '打斷行程讀條，或等氣氛盾結束再接連段。', { at: 30, shield: 16 })], [
    'dist/events-cast-v66.js#cast66-kind-coat-check', 'dist/events-quiz26-a.js#quiz26-keyword-audit', 'dist/events-quiz26-a.js#quiz26-toast-battery',
  ]),
  hope: profile('hope', 'HR長', '先自評一下，你覺得這場能拿幾分？', [
    skill('pip-calendar', 'PIP 頭七倒數', 'zone', '希望把改善時程攤成地面的紅色日期圈。', '改善目標還沒寫，倒數已經替你開始。', '在日期圈確認前走開，別被倒數追著站定位。', { radius: 72, damage: 14 }),
    skill('degree-review', '學歷驗屍報告', 'projectile', '希望抽出一排履歷索引，對準眼前的格子。', '薪水看你的學歷，工作看老闆的想像力。', '向側面閃開履歷卡，別沿直線倒退。', { damage: 11 }),
    skill('interview-room', '小房間告別式', 'guard', '面談紀錄本闔上，希望開始整理下一輪問題。', '先進來聊聊，椅子都幫你排成追思會了。', '讀條中打斷，或等面談紙盾消退再近身。', { shield: 16 }),
    skill('ten-point', '十分自評百分送終', 'slow', '十分的紙卡被放到桌上，周圍出現一圈追問範圍。', '你給自己十分？剩下九十分拿什麼改善？', '走出追問圈，被減速時留一個閃避。', { duration: 2.3, cooldown: 15 }),
  ], [incident('standards-next-time', '死因日後補件', 'zone', '改善標準那一欄仍是空白，另一個時限圈卻已出現。', '先簽改善表，怎樣算改善我們下次再補。', '先看地面的新圈，不要為了空白欄停住。', { at: 31, radius: 78, damage: 15 })], [
    'dist/events-jack.js#jack-pip-self-score', 'dist/events-backoffice-v28.js#hr28-trial-review-notice',
  ]),
  jack: profile('jack', '研發部經理', '鞋帶綁好了，會議筆記也記好了。來，打一場。', [
    skill('court-cut', '球鞋先走靈魂加班', 'rush', '傑克壓低重心，準備沿球場箭頭切進來。', '這球有空檔，會議紀錄沒有。', '看準切入方向側閃，等落步後再靠近。', { damage: 16, range: 250, cooldown: 10 }),
    skill('meeting-notes', '會議紀錄迴力鏢', 'projectile', '傑克翻開記事本，幾張決議卡正排成投擲路線。', '你說沒有講過？日期、版本、遺言都在這裡。', '持續橫移，不要和筆記卡站在同一條線。', { damage: 11, cooldown: 9 }),
    skill('sports-water', '加班遺體補水', 'heal', '傑克拿起運動水壺，準備趁空檔喝一口。', '先喝水，等等還要替三個人的交接活下去。', '在水壺讀條結束前貼近打斷。', { heal: 18, trigger: 'hurt', once: true }),
    skill('first-love-rematch', 'First Love 死不瞑目', 'strike', '傑克抓住紙麥克風，副歌的扇形節拍亮起。', '上次副歌被搶走，這次我連安可一起討！', '往麥克風扇形的側邊閃，等節拍完再出手。', { damage: 16, range: 136, cooldown: 13 }),
    skill('api-budget', 'API 帳單招魂盾', 'guard', '預算與停止條件的紙卡在傑克面前立起。', '你叫 AI 想辦法，AI 叫財務想辦法。', '讀條時打斷，或等額度紙盾消退再交大招。', { shield: 16 }),
  ], [incident('self-score', '九十分失蹤人口', 'guard', '傑克亮出十分自評表，剩下九十分的問號在旁邊打轉。', '我先報十分，剩下九十分請老闆協尋。', '趁問號成盾前打斷，或先繞位等紙盾結束。', { trigger: 'lowHp', at: .38, shield: 14 })], [
    'dist/events-jack.js#jack-notebook', 'dist/events-jack.js#jack-api-budget', 'dist/events-jack.js#jack-pip-self-score', 'dist/events-cast-v66.js#cast66-meimei-first-love-rematch', 'research/island-signature-skills.md#creator-brief',
  ]),
  meimei: profile('meimei', '業務經理', '名單帶了，麥克風也帶了，你先選要聽哪一個。', [
    skill('first-love', 'First Love 奪魂麥', 'strike', '水蛇把麥克風舉到面前，近身節拍圈開始亮起。', '你的第一句，我的整首歌！', '往扇形外側閃，別站在麥克風正前方。', { damage: 16, range: 133, cooldown: 11 }),
    skill('lead-list', '三百名單百鬼夜行', 'projectile', '水蛇把客戶名單摺成一疊飛行簡報。', '三百個客戶，兩百九十九個問你哪位。', '左右走位躲開簡報，別沿直線追名單。', { damage: 10 }),
    skill('whole-company-marketing', '行銷部全員冥職', 'zone', '沒有人的行銷部突然長出一整圈工作牌。', '行銷部沒有人，所以每個人都是行銷部。', '工作牌落下前離開圈，不要站著等分工。', { radius: 76, damage: 14 }),
    skill('prize-promise', '獎品紙紮先到貨', 'guard', '恭喜名單排成紙盾，獎品的包裹還沒到場。', '恭喜得獎！獎品目前存在於公告與信仰。', '在公告讀條結束前打斷，或等名單盾過期。', { shield: 15 }),
  ], [incident('duet-file', '勝負未定檔名先贏', 'projectile', '影片檔名被改成水蛇版本，一疊新檔案朝場中排開。', '裁判還在看影片，檔名已經寫我勝出了。', '橫移避開新版本檔案，別在原檔位置停留。', { at: 24, damage: 13 })], [
    'dist/events-cast-v66.js#cast66-meimei-first-love-rematch', 'dist/events-career-v71.js#career71-sales-leads-graveyard', 'dist/events-chronicle-v22.js#quiz-empty-marketing', 'dist/events-cast-v66.js#cast66-meimei-duet-file',
  ]),
  helen: profile('helen', '產品開發總監', '需求可以再談，SQL 先跑出同一個答案。', [
    skill('sql-query', 'SELECT 全體背鍋', 'projectile', '前女友把查詢結果排好，欄位卡朝你對齊。', 'WHERE 責任 IS NOT NULL，結果怎麼又只有我？', '向側面移動避開欄位卡，別在查詢直線上追。', { damage: 12 }),
    skill('door-release', '開門算一版產品', 'rush', '一扇紙門在前女友前方展開，她準備跨過門框。', '門終於打開，產品路線圖已經完成一半。', '離開門框箭頭的方向，等她停步後再反擊。', { damage: 14, range: 225, cooldown: 11 }),
    skill('handover-delay', '交接延到七月半', 'zone', '交接行事曆翻了一頁，新的日期圈落在場上。', '等大家都有空，連舊帳號都回魂了。', '新的日期圈亮起就換位，不要等它蓋章。', { radius: 70, damage: 14 }),
  ], [incident('account-not-contract', '離職帳號借屍還魂', 'guard', '帳號卡和合約分成兩疊，前女友開始逐項核對。', '人離職了，帳號還在替公司值班。', '趁核對時打斷，或繞位等權限紙盾消退。', { at: 28, shield: 16 })], [
    'dist/events-chronicle-v22.js#helen-sql-masterclass', 'dist/events-chronicle-v22.js#helen-door-release', 'dist/events-chronicle-v22.js#helen-slack-afterlife',
  ]),
  sophie: profile('sophie', '稽核主管', '叫我紅茶可以，少的附件還是要補。', [
    skill('tea-break', '紅茶超渡點心', 'heal', '紅茶先把杯子認領清楚，正準備喝一口。', '這杯是我的，誰動了先過稽核。', '在喝茶讀條結束前貼近打斷。', { heal: 18, trigger: 'hurt', once: true }),
    skill('attachment-shield', '附件子子孫孫', 'guard', '一份附件又長出一份附件，紙張開始層層疊起。', '一張附件生兩張，子子孫孫無窮匱也。', '紙盾成形前打斷，或等附件盾結束再連段。', { shield: 18 }),
    skill('cup-inventory', '二十杯失蹤兩魂', 'projectile', '杯數清單翻開，少的兩格變成對準你的紙卡。', '帳上二十個，櫃裡十八個，兩個請走失蹤人口程序。', '側移躲開清點卡，不要在數字前停住。', { damage: 11 }),
  ], [incident('printer-revive', '印表機冥婚再開機', 'zone', '印表機終於吐紙，列印落點開始在地面閃動。', '驅動裝好了，這次誰要跟印表機相守一生？', '在文件落地前離開標記，不要站在出紙範圍。', { at: 25, radius: 68, damage: 14 })], [
    'dist/events-backoffice-v28.js#accounting28-audit-breadcrumb', 'dist/events-cast-v66.js#cast66-sophie-cup-inventory', 'dist/events-cast-v66.js#cast66-sophie-printer-marriage',
  ]),
  jonathan: profile('jonathan', '助理工程師', '我先聲明，我只是助理工程師。', [
    skill('assistant-shield', '助理工程師免死牌', 'guard', '強哥把助理工程師名片頂在胸前，權限範圍正在成盾。', '職稱只有助理，怎麼每個事故都要我主祭？', '在名片盾成形前打斷，或等權限盾消退再追。', { shield: 18 }),
    skill('mantis', '螳螂拳靈魂三問', 'strike', '強哥抬起雙手，三個問號在近身扇形亮起。', '誰決定？誰收尾？為什麼最後都看著我？', '往問號扇形側面閃，等三問結束再反擊。', { damage: 17, range: 128, windup: 1.1, cooldown: 11 }),
    skill('nineteen-ten', '十九點十分斷魂腳', 'rush', '強哥瞄向時鐘，腳邊出現下班方向的箭頭。', '超過十九點十分，我的職稱正式改成下班人。', '看清箭頭向側邊閃，別站在他的下班路上。', { damage: 13, range: 245, cooldown: 12 }),
  ], [incident('spare-time-test', '閒暇時間服勞役', 'slow', '測試清單從工時表外側伸進來，拖慢範圍開始顯示。', '閒暇時間寫測試，呼吸時間寫報告。', '走出額外測試圈，留閃避解除位置壓力。', { at: 30, duration: 2.4 })], [
    'dist/events-colleagues-v23.js#jonathan-assistant-shield', 'dist/events-quiz26-a.js#quiz26-mantis-memo', 'dist/events-quiz26-b.js#q26-nineteen-ten', 'dist/events-colleagues-v23.js#jonathan-spare-time-qa',
  ]),
  owen: profile('owen', '商務開發總監', '方向我先說，等下可能還有更新版。', [
    skill('sunglasses-turn', '墨鏡一戴方向重開', 'rush', '歐文碰了一下頭頂墨鏡，合作箭頭突然換向。', '剛才那個方向已經離職，現在跟這個。', '以地面箭頭為準往側邊閃，別跟著前一版方向追。', { damage: 14, range: 250, cooldown: 11 }),
    skill('triple-followup', '跟進跟到頭七', 'projectile', '三份寫著已跟進的便條排好，歐文抬手準備送出。', '追一次沒回就追三次，客戶以為在催魂。', '橫向走位避開跟進便條，不要站在通知直線上。', { damage: 11 }),
    skill('parking-map', '豪車先佔骨灰位', 'zone', '一張停車場紙圖鋪開，預定車位開始發亮。', '車位先幫我留，合作案先幫我想。', '車位圈亮起就離開，不要停在他的預約格。', { radius: 74, damage: 15, cooldown: 14 }),
  ], [incident('calendar-chat', '聊聊聊到往生', 'slow', '議程的三大項藏進聊聊兩個字，範圍正在展開。', '就聊一下，三個議程各聊一個人生。', '走出聊聊圈，別停下等他把議程講完。', { at: 26, duration: 2.5 })], [
    'dist/events-cast-v66.js#cast66-owen-meeting-sunglasses', 'dist/events-colleagues-v23.js#owen-triple-followup', 'dist/events-colleagues-v23.js#owen-tesla-run', 'dist/events-colleagues-v23.js#owen-calendar-chat',
  ]),
  sam: profile('sam', '資深資料探勘工程師', '理論我知道，先等這一集和這一批跑完。', [
    skill('chips', '洋芋片靈壓補給', 'heal', '山姆把洋芋片袋打開，補給讀條開始。', '模型可以過擬合，洋芋片不能過期。', '趁他吃洋芋片前貼近打斷回血。', { trigger: 'hurt', heal: 18, once: true }),
    skill('degree-combo', '學士碩士壓棺石', 'projectile', '兩張學位紙卡接在一起，對準你的移動路線。', '學歷兩張都是真的，現在先讓它們砸下來。', '持續側移，讓連段紙卡從旁邊飛過。', { damage: 12, cooldown: 10 }),
    skill('autoplay', '下一集自動送終', 'zone', '畫面還沒播完，下一集預告區已在地上亮起。', '只看一集，演算法已經替你安排到退休。', '離開續播圈，不要站在下一集的落點。', { radius: 72, damage: 14 }),
  ], [incident('study-rival', '既生瑜何生 KPI', 'guard', '讀書會的理論卡與實作卡排成一堵牆，山姆準備辯論。', '瑜亮還能互相欣賞，這份 KPI 不行。', '成盾前打斷，或先繞過紙牆等它消退。', { trigger: 'pressure', at: 4, shield: 16 })], [
    'dist/events-colleagues-v23.js#sam-chip-study', 'dist/events-colleagues-v23.js#sam-pureblood-degree', 'dist/events-cast-v66.js#cast66-sam-streaming-owner', 'dist/events-quiz26-a.js#quiz26-study-rivals',
  ]),
  cindy: profile('cindy', '資深專案管理師', '先選交期、人力還是範圍，不要全部都丟我身上。', [
    skill('camel-load', 'PM 駱駝壓棺拳', 'strike', '辛蒂把工作包往肩上一放，負重扇形開始亮起。', '專案背到駝峰長出來，還說只是順便。', '退出負重揮擊的扇形，再從側面反擊。', { range: 130, damage: 17, windup: 1.1, cooldown: 11 }),
    skill('four-am', '凌晨四點催魂鐘', 'zone', '四點的專案訊息變成地面的日期圈。', '你的凌晨四點，我的第三個專案早安。', '日期圈顯示就換位置，不要留在提醒落點。', { radius: 72, damage: 14 }),
    skill('handover-shield', '交接文件墓誌銘', 'guard', '互斥的兩版排程在辛蒂手上摺成紙盾。', '這版寫清楚，免得我走後你們又說沒交代。', '讀條中打斷，或等排程盾結束後再連擊。', { shield: 17 }),
  ], [incident('office-mom', '四大天王第五具', 'projectile', '四大天王的活動表又長出第五件事，辛蒂把它抽了出來。', '四大天王有五件事，第五件剛好又歸我。', '橫移避開新增的工作卡，別站著接第五件。', { at: 25, damage: 13 })], [
    'dist/events-quiz26-a.js#quiz26-pm-camel', 'dist/events-quiz26-b.js#q26-cindy-unread-party', 'dist/events-cast-v66.js#cast66-cindy-handoff-weather', 'dist/events-quiz26-a.js#quiz26-office-mom',
  ]),
  professor: profile('professor', '電機領域教授／產學顧問', '今天只來半天，先把真正要問的問題拿出來。', [
    skill('half-day', '半天顧問七天供奉', 'slow', '林老師把半天時段框起來，等待範圍開始擴大。', '合約半天，問題單供奉一整週。', '離開等待圈，別把閃避也排進下一週。', { duration: 2.4, cooldown: 15 }),
    skill('namecard-shield', '電機名片鎮魂牌', 'guard', '顧問名片在林老師面前立起，紙盾正在成形。', '頭銜念完了，錯誤訊息可以放大了嗎？', '紙盾成形前打斷，或等它消退後再出招。', { shield: 17 }),
    skill('question-stack', '問題單排到來世', 'projectile', '排隊一整週的問題紙張被分成一疊，對準場中。', '每題都寫最急，你們是辦急診嗎？', '持續橫向走位避開問題紙，利用障礙物分流。', { damage: 11 }),
  ], [incident('calendar-gap', '顧問靈位全年在線', 'zone', '下次到訪日期還沒到，場上的任務表先亮起一圈。', '人只有週三到，表格希望我的靈魂全年駐點。', '任務圈落地前離開，不要站在表格預約的位置。', { at: 30, radius: 76, damage: 14 })], [
    'dist/events-professor-v37.js#professor37-half-day-queue', 'dist/events-professor-v37.js#professor37-name-card-experiment', 'dist/events-professor-v37.js#professor37-advisor-calendar-gap',
  ]),
  annie_yu: profile('annie_yu', '商務開發助理', '我是安妮余。要轉交以前，收件人先看清楚。', [
    skill('martin-help', '馬丁救我三連咒', 'projectile', '安妮余把幫忙便條一張張疊好，準備往前傳。', '馬丁幫我！附件還有三層，麻煩幫到底！', '側移避開幫忙便條，不要站著等整包附件。', { damage: 10 }),
    skill('same-name', '同名同姓不同命', 'zone', '一封寫著安妮的信在空中轉向，錯誤收件圈開始發亮。', '都是安妮，不能連需求都合葬。', '離開誤投圈，不要替同名信件站定位。', { radius: 66, damage: 14 }),
    skill('owen-forward', '整季轉寄往生包', 'guard', '歐文轉來的整季附件在安妮余面前排成盾。', '一封轉寄，附上整季未處理的人生。', '在附件讀條時打斷，或等紙盾結束再連段。', { shield: 16 }),
  ], [incident('middlemen', '六道中間人輪迴', 'slow', '轉介紹的名單拉成一圈，安妮余開始逐個核對窗口。', '轉了六個窗口，客戶本人還沒出生。', '走出轉接圈，避免被中間人的回覆拖慢。', { at: 24, duration: 2.2 })], [
    'dist/events-cast-v39-annie.js#cast39-annie_yu-martin-help', 'dist/events-cast-v39-annie.js#cast39-annie_yu-same-name', 'dist/events-cast-v39-annie.js#cast39-annie_yu-owen-forward', 'dist/events-career-v71.js#career71-bd-referral-chain',
  ]),
  princess: profile('princess', '資料探勘工程師', '先看程式和測試，別先替我的背景跑分。', [
    skill('copilot', 'Copilot 幻覺遺囑', 'projectile', '公主的筆電跑出一串補字卡，朝前方排好。', 'The code is confident. The tests are grieving.', '橫向走位避開補字卡，不要沿建議直線追。', { damage: 11 }),
    skill('robot-review', '機器人代班公祭', 'zone', '紙機器人把空位預約起來，評審區開始閃動。', 'The robot is here. Accountability is still loading.', '評審圈顯示後離開，別坐進預約空位。', { radius: 72, damage: 14 }),
    skill('test-first', '測試全紅靈堂燈', 'guard', '通過與未通過的測試卡在公主面前排成紙盾。', 'All red. Very festive. Please fix it.', '讀條中打斷，或等測試盾消退後再攻擊。', { shield: 17 }),
  ], [incident('variable-name', '變數不繼承家譜', 'strike', '公主把變數名稱重新圈好，近身修訂扇形亮起。', 'Your family tree is not a dependency.', '往修訂扇形側邊閃，再趁收招靠近。', { trigger: 'pressure', at: 3, damage: 15, range: 129 })], [
    'dist/events-cast-v39-princess.js#cast39-princess-copilot-choice', 'dist/events-cast-v39-princess.js#cast39-princess-robot-review', 'dist/events-cast-v39-princess.js#cast39-princess-variable-name',
  ]),
  joyce: profile('joyce', '業務總監', '914 在這裡。正式窗口、正式副本，一個都別少。', [
    skill('official-window', '正式窗口鬼打牆', 'guard', '914 把窗口名單立在面前，正式流程開始成盾。', '熟歸熟，流程還是要先繞完整座山。', '讀條中打斷，或等窗口盾消退再出手。', { shield: 18 }),
    skill('sales-deck', '成交喜報未收款', 'projectile', '成交簡報被摺成一排，914 準備送出新版數字。', '簡報已經開香檳，帳戶還在喝白開水。', '左右移動躲簡報，別在數字直線上追。', { damage: 12, cooldown: 10 }),
    skill('cc-everyone', 'CC 全體送肉粽', 'zone', '副本收件圈正在地面展開，名單越拉越長。', '副本全部掛上去，這鍋誰也別想不認識。', '通知圈落定前換位置，別停著讀完所有副本。', { radius: 78, damage: 14 }),
  ], [incident('commission-zero', '獎金胎教中', 'slow', '成交單上的獎金欄留白，追問範圍正在放大。', '案子都會走路了，獎金那欄還在照超音波。', '走出追問圈，保留閃避度過拖慢時間。', { at: 28, duration: 2.4 })], [
    'dist/events-cast-v39-joyce.js#cast39-joyce-same-name', 'dist/events-career-v71.js#career71-sales-commission-zero', 'dist/cast-v39.js#CAST_PROFILES_V39',
  ]),
  janet: profile('janet', '財會主管', '五千元也要對，差一張附件都不算對完。', [
    skill('five-thousand', '五千核銷地獄門', 'zone', 'Janet 把公費欄位一格格圈起，核銷區開始亮起。', '金額只有五千，附件已經長成一部大藏經。', '離開核銷圈，別為了看明細停在落點。', { radius: 70, damage: 14 }),
    skill('voucher-return', '憑證投胎重新來', 'projectile', '缺附件的憑證被蓋上退件章，Janet 抬手準備寄回。', '少一張附件，整份請重新輪迴。', '橫移躲開退件單，不要站在回件路上。', { damage: 11 }),
    skill('white-ledger', '白隊帳本照妖鏡', 'guard', '收支表和憑證在 Janet 面前疊成紙盾。', '朋友歸朋友，發票沒有交情可以對。', '帳本成盾前打斷，或等對帳盾結束再連擊。', { shield: 18 }),
    skill('cash-runway', '現金跑道直達陰間', 'rush', 'Janet 把付款行事曆拉出一條前進箭頭。', '願景飛得很高，現金跑道已經用完了。', '離開付款箭頭的方向，等她停步再反擊。', { damage: 13, cooldown: 13 }),
  ], [incident('new-form', '表單十八層還魂', 'slow', '剛填好的欄位被新版本覆蓋，修改範圍正在展開。', '才填完第十七版，第十八版已經在門口。', '走出改版圈，不要站著重新填表。', { at: 29, duration: 2.4 })], [
    'dist/events-cast-v39-janet.js#cast39-janet-white-team-budget', 'dist/events-cast-v39-janet.js#cast39-janet-wine-ledger', 'dist/events-career-v71.js#career71-finance-runway', 'dist/events-backoffice-v28.js#accounting28-final-form',
  ]),
  captain: profile('captain', '人資行政專員', '全船集合！位子不夠的部分，我們邊走邊想。', [
    skill('fifteen-seats', '十五椅二十五魂', 'zone', '二十五張名牌朝十五張椅子的圈裡集合。', '多十個人不用加椅子，先練靈魂出竅。', '圈亮起就換位置，別替空椅補人數。', { radius: 80, damage: 14 }),
    skill('one-star-delivery', '一點五星米其靈', 'projectile', '船長把外送菜單摺成紙船，準備送往你的位置。', '評分一點五，照片五顆星，誰吃誰懂。', '側移避開紙船菜單，不要沿航線後退。', { damage: 11 }),
    skill('all-aboard', '全船集合渡亡魂', 'strike', '船長高舉名單，集合扇形開始發亮。', '先全員上船，目的地由船長稍後發明。', '離開集合扇形，等她喊完再出手。', { damage: 16, range: 132, cooldown: 11 }),
    skill('coffee-roster', '咖啡濃到寫遺書', 'guard', '咖啡表和招募文案在船長面前排成紙盾。', '咖啡濃度是面試題，失眠是任用通知。', '讀條中打斷，或等咖啡題卡盾消退。', { shield: 15 }),
  ], [incident('route-update', '泰坦尼克臨時改線', 'rush', '活動名單突然換頁，船長的航線箭頭重新指向場中。', '原航線取消，新航線還在大家的想像裡。', '以新箭頭為準往側邊閃，不要追舊航線。', { at: 26, range: 260, damage: 15 })], [
    'dist/events-cast-v39-captain.js#cast39-captain-room-capacity', 'dist/events-career-v71.js#career71-admin-one-star', 'dist/events-career-v71.js#career71-hr-jd-coffee',
  ]),
  zoe: profile('zoe', '教育訓練專家主管／福委會會長', '麥克風測試，一二一。先集合，再來講規則。', [
    skill('outdoor-lineup', 'Outdoor 團體招魂', 'zone', '201 把分組名單攤開，集合範圍亮起。', '不是自由活動，是自由地聽我安排活動。', '圈落定前移開，不要為了等口令停在原地。', { radius: 76, damage: 14 }),
    skill('training-rollcall', '培訓簽到魂未到', 'projectile', '點名卡一張張排好，201 準備按部門送出。', '身體到就好，靈魂有空再補課。', '左右移動躲點名卡，別和名單站在同一直線。', { damage: 10 }),
    skill('welfare-pack', '福委會回魂包', 'heal', '201 打開活動補給箱，準備補回主持氣勢。', '福利先領，等一下還有一場活動要存活。', '在補給讀條結束前貼近打斷。', { heal: 18, trigger: 'hurt', once: true }),
  ], [incident('frozen-mic', '冷凍麥克風告別式', 'slow', '麥克風的通知燈忽然熄了一格，周圍變成冷色範圍。', '主持人還在，麥克風先進冷凍櫃。', '走出冷色圈，保留閃避度過拖慢時間。', { at: 27, duration: 2.5 })], [
    'dist/events-cast-v65.js#cast65-zoe-outdoor-mic', 'dist/events-cast-v65.js#cast65-zoe-training-hours', 'dist/events-cast-v65.js#cast65-zoe-cold-storage',
  ]),
  action: profile('action', '商務長', '先看看這張鏈，錢和交付我們等下再補。', [
    skill('blockchain', '區塊鏈骨牌靈堂', 'zone', '順哥把三個區塊連成地面範圍，箭頭越畫越粗。', '每一塊都連起來了，只有錢沒有連進來。', '區塊落定前離開圈，別被箭頭留在原地。', { radius: 78, damage: 15 }),
    skill('bottle-shelf', '高粱年份比營收老', 'guard', '酒櫃年份卡排成一面盾，順哥開始介紹下一瓶。', '酒越陳越香，專案越陳越像考古。', '讀條中打斷，或等收藏紙盾消退再接連段。', { shield: 18 }),
    skill('empty-budget', '白皮書紙錢炮', 'projectile', '收入那一格被箭頭蓋住，順哥把白皮書朝前翻出。', '預算一片空白，白皮書倒是夠燒一整晚。', '側移躲開白皮書，別沿箭頭直線追。', { damage: 11 }),
    skill('emba-link', 'EMBA 同學超渡會', 'strike', '同學的名片排成近身扇形，順哥往前踏了一步。', '先找同學來，營收等下再認親。', '往名片扇形側面閃，等他收招再靠近。', { range: 130, damage: 14, cooldown: 12 }),
  ], [incident('proof-of-bottle', 'Proof of 往生', 'slow', '技術白板與瓶身年份排成一圈，說明開始越講越長。', '共識還沒形成，高粱已經完成去中心化。', '走出說明圈，不要讓整段比喻拖住腳步。', { at: 29, duration: 2.4 })], [
    'dist/events-cast-v65.js#cast65-action-chain-whiteboard', 'dist/events-cast-v65.js#cast65-action-bottle-shelf', 'dist/events-cast-v65.js#cast65-action-emba-sync', 'dist/events-cast-v65.js#cast65-action-proof-of-bottle',
  ]),
  hester: profile('hester', '業務總監', '客戶說的、老闆答應的，我們先分成兩欄。', [
    skill('classmate-network', 'EMBA 百鬼通訊錄', 'projectile', '海姐把聯絡名片排成一串，準備逐張送出。', '同學很熟，報價還是要有。', '保持側移，別站在聯絡卡的直線上。', { damage: 11 }),
    skill('customer-scope', '承諾切割太平間', 'guard', '客戶條件與公司承諾分成兩面紙，海姐把中間撐開。', '客戶要的和老闆說的，請分兩個抽屜放。', '讀條中打斷，或等範圍盾消退再攻擊。', { shield: 17 }),
    skill('one-more-request', '需求海嘯送終潮', 'zone', '客戶的新增需求在地面疊成一個落點圈。', '先說只改一點，浪頭已經高過整個部門。', '追加圈亮起後換位，別站著接下整包。', { radius: 74, damage: 14 }),
  ], [incident('pilot-revenue', '免費試點試到頭七', 'rush', '試點計畫畫出一條前進箭頭，海姐開始確認下一段。', '都已經試到祖先認得產品了，可以談錢了嗎？', '閃到箭頭側邊，等她停步再找空檔。', { at: 26, damage: 14, range: 240 })], [
    'dist/events-cast-v65.js#cast65-hester-classmate-scope', 'dist/events-cast-v65.js#cast65-hester-customer-limits', 'dist/events-career-v71.js#career71-bd-pilot-revenue',
  ]),
  simon: profile('simon', '產品設計專員', '先講清楚改哪裡，最後別又說第一版最好。', [
    skill('version-one', '第八版回魂第一版', 'heal', '丁哥翻回第一張設計稿，準備把改過的氣勢補回來。', '八版改完，老闆終於想起第一版的好。', '在回版讀條結束前貼近打斷。', { trigger: 'hurt', heal: 18, once: true }),
    skill('logo-bigger', 'Logo 巨到蓋棺', 'zone', 'Logo 的紙樣在地面放大，資訊空間越來越小。', '再大一點，其他資訊剛好可以入土為安。', '放大圈亮起後移開，不要等它把位置吃完。', { radius: 82, damage: 14 }),
    skill('camel-start', '駱駝馱著需求跑', 'rush', '丁哥舉起主持旗，跑道箭頭開始亮起。', '駱駝會疊，需求也會疊，薪水不會。', '往跑道側邊閃，等旗子落下後再靠近。', { range: 250, damage: 14, cooldown: 11 }),
    skill('pixel-ruler', '像素級開棺驗稿', 'strike', '一把紙尺在丁哥手上展開，近身測量扇形亮起。', '差一個像素，也值得讓全案重新投胎。', '退出紙尺扇形，趁收尺後反擊。', { range: 135, damage: 14, cooldown: 12 }),
  ], [incident('twelve-jobs', '一份薪水十二牌位', 'projectile', '設計、前端與拍片便條一起飛到桌邊，丁哥把它們退了回來。', '設計前端拍片都會，所以每個職缺都來上香。', '橫向避開工作便條，別站著替十二件事簽收。', { at: 28, damage: 13 })], [
    'dist/events-cast-v65.js#cast65-simon-version-one', 'dist/events-cast-v65.js#cast65-simon-logo-map', 'dist/events-cast-v65.js#cast65-simon-camel-host', 'dist/events-cast-v65.js#cast65-simon-pixel-contract',
  ]),
  james: profile('james', '回鍋同事', '帳號又開好了？那我先試一下這版公司的操作。', [
    skill('seven-returns', '七進七出回魂術', 'rush', '詹姆士翻出回鍋通行卡，熟悉的路線箭頭亮起。', '離職像登出，下次更新又叫我登入。', '往箭頭側面閃，別站在他的回鍋路上。', { range: 270, damage: 15, cooldown: 11 }),
    skill('welcome-meal', '歡送歡迎同一鍋', 'heal', '歡迎餐和離職飯的紙盤被放到一起，補給開始讀條。', '今天這桌是歡迎還是歡送？看我的帳號有沒有開。', '趁用餐讀條結束前近身打斷。', { trigger: 'hurt', heal: 18, once: true }),
    skill('old-system', '舊系統託夢', 'projectile', '詹姆士把不同年代的操作卡分成一疊。', '這段我上次回鍋時見過，上上次也是。', '側移躲開舊版操作卡，利用障礙物擋住來路。', { damage: 11 }),
  ], [incident('same-computer', '電腦比本人更長壽', 'guard', '有舊貼紙的紙電腦被搬回場中，重新配發的讀條開始。', '我回鍋第七次，它還沒等到退休。', '在重新配發完成前打斷，或等設備盾消退。', { at: 27, shield: 16 })], [
    'dist/events-cast-v65.js#cast65-james-seventh-login', 'dist/events-cast-v65.js#cast65-james-farewell-credit', 'dist/events-cast-v65.js#cast65-james-company-version', 'dist/events-cast66-james.js#cast66-james-hardware-return',
  ]),
  johnny: profile('johnny', '專案管理師', '臨時加一件可以，先告訴我哪一件要拿掉。', [
    skill('one-more-cell', '排程骨灰再加一格', 'zone', '強尼的專案表又長出一格，新增區域開始閃動。', '每個新增格下面，都埋著一個原本的交期。', '新增格亮起後移開，別被追加排程占住位置。', { radius: 74, damage: 14 }),
    skill('midnight-question', '半夜問號催魂符', 'projectile', '手機通知變成一排問號紙卡，強尼準備送出狀態回報。', '一個問號，整個部門的睡眠一起復活。', '左右走位避開問號，別在通知直線上等回覆。', { damage: 11 }),
    skill('minutes-shield', '會議紀錄鎮魂牆', 'guard', '剛拍板的會議紀錄在強尼面前立起。', '先把決議貼好，免得半夜又有人借屍還魂。', '成盾前打斷，或等會議盾消退再近身。', { shield: 17 }),
  ], [incident('skip-level', '主管最後收訃聞', 'slow', '越級交辦的箭頭穿過原排程，強尼開始重算路徑。', '人已經被借走了，主管今天才知道專案往生。', '走出重排圈，留閃避處理短暫減速。', { at: 29, duration: 2.3 })], [
    'dist/events-cast-v65.js#cast65-johnny-one-more-task', 'dist/events-cast-v65.js#cast65-johnny-midnight-question', 'dist/events-cast-v65.js#cast65-johnny-meeting-minutes', 'dist/events-career-v71.js#career71-executive-skip-level',
  ]),
  alice: profile('alice', '移動手遊王', '這裡至少寫清楚保底。先看牌，再決定怎麼打。', [
    skill('ten-pull', '十連抽十張工單', 'projectile', '愛麗絲把十連卡包展開，紙牌對準前方。', '金光一閃，恭喜又抽到追加需求。', '持續側移躲開紙牌，不要沿著卡包方向追。', { damage: 12, cooldown: 10 }),
    skill('pity-counter', '保底不保命', 'heal', '抽數計數器停在保底格，愛麗絲準備領取本場補給。', '抽數有保底，職涯沒有。', '在領取讀條結束前貼近打斷。', { trigger: 'hurt', heal: 18, once: true }),
    skill('friend-raid', '好友共赴黃泉本', 'guard', '合作隊伍的兩張紙卡在愛麗絲面前合成盾。', '好友可以借角色，不能借肝。', '組隊讀條時打斷，或等合作盾結束再連段。', { shield: 16 }),
    skill('ssr-extra', 'SSR 稀有背鍋位', 'zone', 'SSR 紙卡翻面，追加需求的落點圈亮起。', '恭喜抽到 SSR，職稱是超稀有的全責窗口。', '新卡落地前走出圈，別站著讀完整張說明。', { radius: 76, damage: 15, cooldown: 14 }),
  ], [incident('duplicate-rick', '瑞克三幻神召喚', 'slow', '三張瑞克紙卡同時亮起，電話轉接圈開始展開。', '三張不同稀有度，一樣叫你去問傑克。', '走出轉接圈，別停著接完三通電話。', { at: 25, duration: 2.3 })], [
    'dist/events-alice-v71.js#alice71-first-pull', 'dist/events-alice-v71.js#alice71-pity-counter', 'dist/events-alice-v71.js#alice71-friend-raid', 'dist/events-alice-v71.js#alice71-boss-rarity', 'dist/events-alice-v71.js#alice71-dupe-rick',
  ]),
  wine: profile('wine', '系統工程師', '我叫 Wine，不是 Wing。系統怎樣？你先聽完整句。', [
    skill('let-crash', '讓它爆全村吃席', 'zone', '紅酒把故障圖圈起來，紅色事故區開始閃動。', '先讓它爆，至少這次全公司知道有這台系統。', '離開事故圈，不要站在故障核心等恢復。', { radius: 78, damage: 17, windup: 1.3, cooldown: 14 }),
    skill('restart', '重開機借屍還魂', 'heal', '紅酒開始重啟紙主機，恢復進度條正在前進。', '主機活回來了，值班的人還沒。', '在重啟讀條結束前貼近打斷。', { trigger: 'hurt', heal: 18, once: true }),
    skill('on-call', 'On-call 頭七守靈', 'projectile', '一排下班後的通知從紅酒手機彈出。', '系統有人守夜，工程師沒人守護。', '持續側移，讓通知卡從旁邊通過。', { damage: 11 }),
  ], [incident('wrong-recipient', 'Wine 誤收聖旨', 'guard', '寄錯老闆的郵件在紅酒手上摺成一面回信盾。', '一個字母寄錯，助理工程師差點登基。', '回信讀條時打斷，或等誤認盾消退。', { at: 24, shield: 16 })], [
    'dist/events-cast-v74.js#cast74-wine-let-crash', 'dist/events-cast-v74.js#cast74-wine-last-resort', 'dist/events-cast-v74.js#cast74-wine-name-ping',
  ]),
  peter: profile('peter', '助理工程師', '我先把遊戲視窗收起來。剛才那個是測試。', [
    skill('shortcut', '快捷鍵超渡十連', 'projectile', 'P 神按住快捷鍵，一排批次操作卡開始對準你。', '按十次不會比較正確，但很像有在工作。', '橫向走位避開批次卡，不要沿直線追快捷鍵。', { damage: 11 }),
    skill('patch-day', '遊戲更新免死金牌', 'guard', '更新條出現在 P 神面前，紙螢幕開始成盾。', '畫面是遊戲，任務管理員說是效能測試。', '讀條中打斷，或等更新盾消退再連段。', { shield: 17 }),
    skill('keyboard-guest', '鍵盤路過案發現場', 'rush', 'P 神看向旁邊的鍵盤，腳邊亮起插隊箭頭。', '我就幫你按一下，怎麼回復鍵也一起消失？', '往插隊方向側邊閃，等他離開鍵盤再出手。', { damage: 14, range: 230, cooldown: 11 }),
  ], [incident('one-plus-one', '一加一開壇驗算', 'zone', '計算機的大按鍵落點開始發亮，P 神正在確認結果。', '計算機開好了，現在這題具備法事等級的嚴謹。', '按鍵落地前走出圈，不要停在等號上。', { at: 26, radius: 68, damage: 14 })], [
    'dist/events-cast74-peter.js#cast74-peter-shortcut-macro', 'dist/events-cast-v74.js#cast74-peter-patch-day', 'dist/events-cast-v74.js#cast74-peter-keyboard-guest', 'dist/events-cast-v74.js#cast74-peter-calculator',
  ]),
  tony: profile('tony', '助理工程師', '叫我 8+9 也行，別又把上一個 Tony 的工作塞過來。', [
    skill('breakfast', '早餐先吃壓驚飯', 'heal', '8+9 把早餐袋打開，準備補回下一輪的力氣。', '昨天的事先別講，蛋餅冷掉才真的出事。', '趁早餐讀條結束前貼近打斷。', { trigger: 'hurt', heal: 18, once: true }),
    skill('straight-talk', '江湖直球超渡拳', 'strike', '8+9 捲起袖子，近身直球扇形開始亮起。', '兄弟歸兄弟，別把我的工時當義氣捐。', '往扇形側邊閃，等直球揮完再反擊。', { damage: 17, range: 127, windup: 1.05, cooldown: 11 }),
    skill('smoke-break', '煙休五分鐘還魂', 'rush', '8+9 看向休息區，離席箭頭在腳邊亮起。', '出去五分鐘，回來待辦已經自行繁殖。', '往離席箭頭的側面閃，不要追著他的路線跑。', { damage: 13, range: 255, cooldown: 12 }),
  ], [incident('old-tony-mail', '前任 Tony 陰魂信', 'projectile', '比本人年資還長的舊案郵件出現，8+9 把它退回場中。', '上一個 Tony 的案子，比我本人還有年資。', '橫移避開舊案紙信，別站著認領同名待辦。', { at: 25, damage: 13 })], [
    'dist/events-cast-v74.js#cast74-tony-old-mail', 'dist/events-cast-v74.js#cast74-tony-smoke-timer', 'dist/events-cast74-henry.js#cast74-henry-breakfast-rsvp',
  ]),
  henry: profile('henry', '技術總監', '圖可以先畫，權限、人力和預算也要一起畫進去。', [
    skill('architecture-arrow', '架構圖死後重畫', 'zone', '老大把跨系統箭頭展開，新的邊界圈亮起。', '這條線畫三秒，底下三個團隊重活三週。', '邊界圈落定前離開，不要站在新箭頭下面。', { radius: 76, damage: 15 }),
    skill('three-urgent', '三件最急三柱香', 'guard', '三張最急便條在老大面前排成盾。', '三件都最急，先問哪一件要優先上香。', '排序讀條時打斷，或等優先級盾消退再連段。', { shield: 18 }),
    skill('old-server', '退役主機英靈召喚', 'projectile', '老大把舊主機的測試卡攤開，準備把限制送到你面前。', '這台以前跑得動，當時公司也比較年輕。', '左右移動避開測試卡，利用障礙物分流。', { damage: 12, cooldown: 10 }),
  ], [incident('three-days', '三週三天陰陽曆', 'slow', '日曆上的週字被擦掉，趕工範圍開始展開。', '老闆把週擦成天，工程師把陽間排成陰間。', '走出趕工圈，別讓改單位拖慢移動。', { at: 28, duration: 2.4 })], [
    'dist/events-cast-v74.js#cast74-henry-arrow-edit', 'dist/events-cast-v74.js#cast74-henry-three-urgent', 'dist/events-cast-v74.js#cast74-henry-borrowed-server', 'dist/events-cast-v74.js#cast74-henry-estimate-question',
  ]),
  mia: profile('mia', '人資專員', '先確認這張名牌是你，後面的問題我們一題一題來。', [
    skill('welcome-card', '報到名牌生死簿', 'projectile', '米雅把報到名牌排好，準備逐張送到本人面前。', '名字先對好，別把新人印成前人的接班牌位。', '側移避開名牌卡，別站在寄送直線上。', { damage: 10 }),
    skill('consent-shield', '客氣不等於賣身契', 'guard', '需要本人確認的紙卡在米雅面前組成盾。', '我笑一下，不代表勞動契約自動追加三頁。', '確認讀條時打斷，或等同意盾消退再近身。', { shield: 17 }),
    skill('faq-book', 'FAQ 陰陽百科', 'zone', '一本厚厚的問題簿攤開，待答問題的落點圈亮起。', '這題上週問過，上上週也還沒超渡完。', '離開問題簿的落點圈，不要停著翻完整本。', { radius: 72, damage: 14 }),
  ], [incident('coffee-title', '人資兼任孟婆湯', 'slow', '人資名牌旁忽然多了一張咖啡便條，臨時分工圈展開。', '招募還沒做，咖啡已經讓我忘記當初應徵什麼。', '走出臨時分工圈，別讓順便兩字拖住位置。', { at: 24, duration: 2.2 })], [
    'dist/events-cast-v74.js#cast74-mia-welcome-card', 'dist/events-cast-v74.js#cast74-mia-faq-help', 'dist/events-cast-v74.js#cast74-mia-coffee-request', 'dist/cast-v74.js#CAST_PROFILES_V74',
  ]),
});

// This optional final encounter remains separate from the 34 public colleagues.
// Only the story-challenge controller decides when its identity may be shown.
export const HIDDEN_BRAWL_ID = 'hidden-visitor';
export const HIDDEN_BRAWL_PROFILE = profile(HIDDEN_BRAWL_ID, '辦公室支援角色', '大家的最後一版我都收到了。現在，輪到你說清楚這一場的範圍。', [
  skill('punctuation-boundary', '逗點一撇責任超渡', 'strike', '魚酥姐把逗點與新增保證分開，紅色校訂筆正在近身畫線。', '只差一個逗點，就把翻譯寫成全案保人。', '離開校訂筆的扇形，等她收筆後再靠近。', { damage: 19, range: 138, windup: 1.05, cooldown: 10, color: '#bd7680' }),
  skill('final-new-volley', 'Final Final 遺稿連發', 'projectile', '一疊 final、new、最新版的紙稿排成直線，魚酥姐正對齊最後一份。', '第八份最後版已經出殯，第九份正在趕來。', '往側面移動躲稿件，別沿著版本直線往後退。', { damage: 14, range: 420, windup: 1.1, cooldown: 10, color: '#7d93b0' }),
  skill('scope-outside-frame', '鏡頭外全員陪葬', 'zone', '鏡頭沒拍到的工單一張張落向地面，真正的工作範圍開始發亮。', '鏡頭只拍得到三分鐘，修改單有三個人的一生。', '在工單落地前走出標記圈，不要站著等鏡頭轉過來。', { damage: 20, radius: 84, windup: 1.4, cooldown: 15, color: '#b4917e' }),
  skill('snack-state-table', '魚酥開封驗屍表', 'slow', '已開封、未開封與待確認三張標籤，在你腳邊排出分類範圍。', '已開封和未開封都分不清，還想管理產品版本？', '離開分類圈；被拖慢時仍可閃避，不必留在原地替標籤作答。', { damage: 6, radius: 76, duration: 2.3, windup: 1.25, cooldown: 14, color: '#a39d70' }),
  skill('shelf-restock', '魚酥還魂補給櫃', 'heal', '魚酥姐打開已標好日期的補給盒，準備趁整理空檔吃一口。', '別的承諾可能是空的，這盒魚酥有進貨。', '在補給讀條結束前近身打斷；每場只補給一次。', { trigger: 'hurt', once: true, heal: 22, windup: 1.5, cooldown: 18, pose: 'heal', color: '#8ba17e' }),
  skill('confirmed-scope-shield', '支援範圍鎮魂符', 'guard', '原文、改寫與未確認承諾分成三欄，紙張正在魚酥姐面前組成護盾。', '請問你的「順便」，有含我的下一世嗎？', '讀條時打斷，或等護盾消退再交連段；別把大招全打在盾上。', { shield: 20, duration: 2.4, windup: 1.1, cooldown: 17, color: '#8798ad' }),
], [
  incident('eight-final-meeting', '八版遺稿同場頭七', 'zone', '八張都寫著最後版的紙稿一起攤開，真正有效的那一圈即將蓋章。', '八個最後版，只有一個能安息。', '走出蓋章圈，等八份文件落定再反擊。', { at: 28, damage: 22, radius: 88, windup: 1.5, color: '#b68e83' }),
  incident('three-access-cards', '一人三職三魂七魄', 'rush', '翻譯、行銷與零食管理三張門禁卡排成一線，魚酥姐準備把排程推回原窗口。', '翻譯行銷零食都我管，薪水怎麼只認一個人？', '往排程箭頭的側邊閃，利用障礙物讓衝刺停下。', { trigger: 'pressure', at: 4, damage: 20, range: 220, radius: 42, windup: 1.3, color: '#8a9f9d' }),
], [
  'dist/hidden-encounter-v45.js#HIDDEN_PERSONAS_V45',
  'dist/hidden-encounter-v45.js#getHiddenEncounterEventV45',
  'dist/hidden-stories-v66.js#HIDDEN_STORIES_V66',
]);

export function getBrawlProfile(id) {
  if (id === HIDDEN_BRAWL_ID) return HIDDEN_BRAWL_PROFILE;
  return Object.hasOwn(BRAWL_ROSTER, id) ? BRAWL_ROSTER[id] : null;
}
