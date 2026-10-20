// Original fictional scenes inspired by workplace recollections and a departure chronicle.
// The player is Jack's colleague, never a substitute for the chronicle's author.
// Private notes, original quotations, identities and legal claims stay out of this module.
const c = (text, result, delta, flags = []) => ({ text, detail: '', result, delta, flags });
const scene = (id, title, speaker, body, wing, choices, extra = {}) => ({
  id, title, speaker, body, wing, choices,
  era: '傑克的筆記・研發部日常', sourceIds: ['characterFiction'],
  minRules: 16, minTurn: 3, weight: 1.5, ...extra
});

export const JACK_EVENTS = [
  scene('jack-notebook', '研發部經理，兼任記憶體', 'jack',
    '研發部經理傑克問你，剛才會議上的交辦有沒有留紀錄。你說不是有群組嗎？他打開自己的筆記，日期、改過的需求、誰最後拍板，一項都沒少。原來史冊裡好多篇都是他寫的；你原本以為他打字快，現在才知道是公司很會提供題材。',
    '先把事情記清楚。等下改口的時候，至少你知道自己沒聽錯。', [
      c('把決議和還沒確認的地方分開，請他幫忙看。',
        '傑克替你補上一項漏掉的條件。你們把今天的版本寄出去，沒有逼誰當場認錯，也沒讓明天的你只剩「我記得」。',
        { skill: 8, trust: 9, energy: -6, mood: -3 }, ['evidence', 'handover_notes', 'jack_notes']),
      c('先做再說，紀錄等有人問起再補。',
        '工作很快開始，需求也很快改了。傑克問你要以哪次交辦為準，你回頭翻群組，發現昨天的自己比今天還樂觀。',
        { boss: 8, energy: -10, mood: -9, skill: 3 }, ['loop']),
      c('替會議開一張住院單，診斷是反覆失憶。',
        '傑克笑著收下，提醒你病歷也要寫日期。你們在玩笑旁補齊真正的決議；這篇還沒取好標題，下一場會議已經開始提供續集。',
        { slack: 7, trust: 10, mood: 4, energy: -5, boss: -8 }, ['archive', 'evidence', 'jack_notes'])
    ], { minTurn: 1, weight: 2.3 }),

  scene('jack-referral-loop', '問主管，主管說去問傑克', 'jack',
    '你找老闆乾兒子問推播邏輯，他叫你找傑克。你問交接範圍，他還是叫你找傑克。到了傑克桌邊，才發現對方也剛收到通知：這套系統已經交接完成。你們看著同一封信，努力找出那場兩個人都沒參加的交接。',
    '先確認你要接哪一段。別讓一句「都交好了」，變成兩個人都得負責。', [
      c('和傑克逐項走過系統，留下待補清單。',
        '你弄懂了流程，也列出仍然沒人說清楚的地方。老闆乾兒子問怎麼還沒接完，你把需要他確認的那一欄一起寄回去。',
        { skill: 11, trust: 9, energy: -10, boss: -8, mood: -6 }, ['handover_notes', 'evidence', 'jack_notes']),
      c('先簽收，出問題再回頭問他。',
        '老闆乾兒子很高興，傑克請你至少把聯絡方式留好。晚上第一個問題跳出來時，你已經理解「交接完成」主要完成了誰的工作。',
        { boss: 12, skill: 4, energy: -13, mood: -12 }, ['allin', 'role_merge']),
      c('替「已交接」辦追思會，請各位交出它生前的文件。',
        '傑克把自己的操作筆記放到桌上，你把空白的驗收表也擺好。大家笑完，終於有人願意承認，這份交接還有幾個地方沒活過。',
        { slack: 8, trust: 10, skill: 5, boss: -13, energy: -7, mood: 3 }, ['archive', 'handover_notes'])
    ], { roles: ['system', 'ai', 'mis', 'project', 'product', 'executive'] }),

  scene('jack-api-budget', '額度用完以後，願景開始計費', 'jack',
    '推薦功能又被加上附近店家，翅膀嫌 API 額度太慢，說先跑、錢公司會處理。傑克聽到這句，立刻把你叫住，請你先看付款帳戶和費用上限。原來他曾把一段帳單故事寫進史冊；程式可以繼續跑，付款通知不會跟著休息。',
    '先看清楚誰付錢、跑多少。不要等帳單寄來，才開始確認「公司會處理」是哪一種處理。', [
      c('確認預算、付款帳戶和停止條件，再跑小批測試。',
        '你們先估完費用，才開始第一批。翅膀嫌這些確認浪費時間，傑克把預算紀錄留下；這次帳單至少不用靠回憶找負責人。',
        { skill: 10, trust: 6, boss: -10, energy: -7, mood: -4 }, ['evidence', 'offer_checked', 'jack_notes']),
      c('照交辦先跑，把書面確認留到明天。',
        '畫面終於有了進度，翅膀點頭。傑克再提醒你一次計費方式，你才發現今天跑得最快的東西，未必是產品。',
        { boss: 12, skill: 5, energy: -12, mood: -10 }, ['allin', 'loop']),
      c('把信用卡帳單請上台，讓它報告本季成長。',
        '你做了一張費用試算投影片，傑克幫你把假設標清楚。翅膀對成長曲線很滿意，直到發現往上走的是支出，才願意談先做多少。',
        { slack: 7, skill: 7, trust: 7, boss: -13, energy: -7, mood: 3 }, ['archive', 'evidence'])
    ], { roles: ['system', 'ai', 'mis', 'project', 'product', 'executive'] }),

  scene('jack-colleague-defense', '你解釋串接，他聽見頂嘴', 'jack',
    '會議上，翅膀把同事的串接困難講成不用功。傑克補了一句外部資料格式還沒對齊，原本五分鐘的進度就長成一整段態度訓練。散會後他走到你旁邊，說明天還是得把問題處理掉；不然同事挨完罵，工作也沒比較好做。',
    '我剛才是想把困難講清楚，沒想到連態度也多了一份待辦。', [
      c('和他整理重現條件，再陪同事把卡點拆小。',
        '你們終於找到能先測的那一段。同事沒有突然變成萬能，工作倒是往前了一點；傑克把這項進度寫進明天的報告。',
        { skill: 10, trust: 12, energy: -11, boss: -7, mood: -5 }, ['evidence', 'alumni_links', 'handover_notes']),
      c('勸他下次別幫腔，先讓會議準時散場。',
        '傑克點點頭，沒有跟你爭。你們都知道少講話可以省掉一段訓話，只是那位同事的問題仍躺在待辦最上面。',
        { slack: 7, energy: 4, trust: -5, mood: -8 }, ['loop']),
      c('寄出一份「串接困難人格鑑定書」，判定它沒有態度。',
        '傑克幫文件加上錯誤訊息和重現步驟。同事笑了，翅膀嫌標題不正經；但那份被嫌棄的附件，至少能拿去查真正的問題。',
        { slack: 8, trust: 11, skill: 6, boss: -14, energy: -8, mood: 3 }, ['archive', 'evidence'])
    ], { minTurn: 4 }),

  scene('jack-pip-self-score', '傑克的十分，希望的表情', 'hope',
    'PIP 會議前，傑克借你看自己的舊筆記：某次自評只填十分，主持人反而愣住。輪到你的會議，希望也打開自評欄，要你先給自己一個數字。翅膀照例沒有出現，改善標準仍需要你當面追問。那張舊表讓你突然很想知道，大家到底在評哪一件事。',
    '先不要談別人的例子。你覺得自己這段時間的表現，可以給幾分？', [
      c('先列交付和證據，請她對照每項標準。',
        '希望把話題拉回態度，你再把交付日期指給她看。表格終於多了幾項能核對的內容，至於怎麼評分，仍要等這段 PIP 的正式結果。',
        { skill: 9, trust: 6, energy: -7, boss: -8, mood: -7 }, ['evidence', 'jack_notes']),
      c('跟傑克一樣填十分，再問另外九十分評的是什麼。',
        '希望停了一下，問你是不是不夠重視。你說正因為重視，才想知道分數怎麼來；她沒有笑，會議紀錄倒是多了這個問題。',
        { slack: 8, boss: -14, energy: -7, mood: 4 }, ['archive', 'evidence', 'jack_notes']),
      c('替影印機打滿分：它每次都能準時交出改善表。',
        '希望說不要開玩笑。你收起影印機的員工評鑑，照樣把自己的成果列完；今天沒有人保證你過關，只有影印機維持了穩定表現。',
        { slack: 9, trust: 6, boss: -16, energy: -7, mood: 5 }, ['archive'])
    ], { context: 'pip', minTurn: 2, weight: 3 }),

  scene('jack-departure-draft', '離場之前，先把職稱校對好', 'jack',
    '傑克傳來自己寫的離場紀錄，提醒你別只看最後那個總額。故事裡，三件套到齊：法師在旁邊，Moon Dog 翻文件，阿福等著處理權限；證明上的職稱卻還停在好幾次升職以前。你抬頭看自己的工作證，忽然覺得校稿可能也是一種求生技能。',
    '金額、明細、職稱、文件要怎麼拿，都看清楚。故事可以寫得荒謬，你自己的名字不用幫它配合。', [
      c('趁還能查，把自己的職稱、明細和交接紀錄整理好。',
        '你把能確認的項目逐一核對，另外列出需要請對方說明的地方。傑克幫你補上一張漏掉的任命通知；至少這次不是等帳號關了，才想起資料還在裡面。',
        { skill: 8, trust: 7, energy: -7, mood: -4 }, ['evidence', 'handover_notes', 'jack_notes']),
      c('先收藏文章，輪到自己再說。',
        '你把連結放進稍後閱讀。傑克回了一個點頭；今天暫時沒有多一件待辦，明天那份清單也沒有自己變短。',
        { slack: 7, energy: 5, mood: -5 }, ['archive']),
      c('給工作證辦身分證重拍，請它說明這幾年到底升了什麼。',
        '你用名片、任命通知和舊文件替工作證排了一條時間線。傑克說這份履歷比一些系統還新，同事順手拿去對照自己的版本。',
        { slack: 7, skill: 6, trust: 9, energy: -7, boss: -8, mood: 3 }, ['archive', 'evidence', 'alumni_links'])
    ], { minTurn: 7 })
];
