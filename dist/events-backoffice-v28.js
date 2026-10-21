// Original back-office fiction. Sanitized chapter IDs identify inspiration;
// tasks, dialogue and outcomes are invented, not payroll or personnel records.
const c = (text, result, delta, flags = [], wild = false) => ({
  text, detail: '', result, delta, flags, ...(wild ? { wild: true } : {})
});
const eras = {
  finance: '原創・財務現金流副本', accounting: '原創・會計憑證副本',
  hr: '原創・人資夾心副本', admin: '原創・行政兼任副本'
};
const scene = (role, id, title, body, wing, choices, extra = {}) => ({
  id, title, body, wing, choices, speaker: 'wing', roles: [role],
  era: eras[role], sourceIds: ['characterFiction'], minRules: 28,
  minTurn: 0, weight: 1.25, ...extra
});

export const BACKOFFICE_EVENTS_V28 = [
  scene('finance', 'finance28-cash-calendar', '錢還沒進來，行事曆先填滿了',
    '你把預計入帳與已確認入帳分開列，翅膀指著月底總額問為什麼少一截。那一截是客戶說「應該下週」的款項；目前最準時的只有每週追問進度的會議。',
    '客戶都說會付了，你怎麼還在那邊分這麼細？', [
      c('分列已確認與待確認款項，逐筆追付款日期。',
        '你拿到兩個能確認的日期，也讓一筆樂觀預估回到待確認欄。翅膀嫌表格變難看，但月底真正能安排的支出終於清楚了。',
        { skill: 8, trust: 6, energy: -8, mood: -5, boss: -4 }, ['evidence']),
      c('先沿用樂觀版本，明天再去追客戶。',
        '會議順利結束，明天的你則收到三筆「今天能不能付」的詢問。那一截預估沒有變成現金，卻先變成你的待辦。',
        { lick: 7, boss: 7, trust: -5, energy: -8, mood: -9 }, ['loop']),
      c('替「應該下週」辦入職，請它每天親自回報。',
        '你在待確認欄貼上它的員工證，同事終於分清楚承諾與到帳。翅膀叫你把圖拿掉，卻留下了逐筆確認的欄位。',
        { slack: 7, trust: 5, mood: 4, energy: -6, boss: -5 }, ['archive', 'evidence'], true)
    ], { sourceIds: ['contract', 'characterFiction'] }),

  scene('finance', 'finance28-budget-weather', '預算有限，但願景不限量',
    '屎潘蛇請你估活動預算，需求從一間會議室長成一場小型發表會。你送出的表格有場地、設備和人力，他回來只問能不能用原本那個總額做到。',
    '小地方省一點，場面還是要有，這才是財務的專業。', [
      c('列出三種規模，讓他選保留哪些項目。',
        '屎潘蛇圈出想要的場面，看到對應費用後刪掉兩項。你重排了一整個下午，至少不必再用同一份預算包辦三種規模。',
        { skill: 8, trust: 5, energy: -8, mood: -5 }, ['evidence']),
      c('先答應控制總額，再逐項找人幫忙。',
        '屎潘蛇稱讚你會想辦法。設備沒有因此免費，行政同事也沒有因此長出分身，你的省錢方案先花掉兩個人的晚上。',
        { lick: 7, trust: -5, energy: -9, mood: -9 }, ['allin', 'loop']),
      c('把預算做成天氣圖，宣布願景區局部豪雨。',
        '你指著超支項目逐區報雨量，大家笑完才肯討論哪一項能縮小。屎潘蛇不喜歡那朵烏雲，但終於選定了一種規模。',
        { slack: 7, trust: 5, mood: 4, energy: -6 }, ['archive', 'evidence'], true)
    ], { speaker: 'spencer', sourceIds: ['budget', 'spring', 'characterFiction'], minTurn: 1 }),

  scene('finance', 'finance28-signature-runway', '到期日不會等簽名有空',
    '付款資料已備齊，最後一格核准還停在翅膀的行程裡。他剛問完為什麼供應商又來催，就轉身進下一場會議；你手上只有已送簽的時間，沒有能代替他簽名的權限。',
    '這不是你的工作嗎？為什麼還要我一直看？', [
      c('把到期日與待核項目濃縮成一頁，再請他確認。',
        '他終於在兩場會議之間看完，付款能往下處理。你還是被問了一次為什麼不早說，只好把原本那封提醒信再轉寄一遍。',
        { skill: 7, trust: 6, energy: -7, mood: -6, boss: -4 }, ['evidence']),
      c('說自己會追到，守著會議室等他出來。',
        '翅膀覺得有人盯就好。你等到下午才拿到回覆，銀行處理時間卻沒有因為你很努力而延長，明天還得補一通說明電話。',
        { lick: 7, boss: 6, energy: -9, mood: -8, trust: -3 }, ['loop']),
      c('替空白簽名格架紅毯，宣布今天的壓軸尚未進場。',
        '你把便條紙剪成紅毯，翅膀經過時終於停下來看。壓軸簽完叫你收掉典禮，供應商則只在意款項哪一天能到。',
        { slack: 7, trust: 4, mood: 4, energy: -6, boss: -6 }, ['archive', 'evidence'], true)
    ], { sourceIds: ['contract', 'characterFiction'], minTurn: 1 }),

  scene('finance', 'finance28-shares-invitation', '股東會的椅子，比試算表的欄位少',
    '員工認股說明會要發通知，屎潘蛇說場地不大，請你把參加與委託兩種方式都排好。你數著回覆人數，發現大家問的不是椅子，而是自己到底能看哪些資料。',
    '流程簡單一點就好，不要弄到每個人都來問。', [
      c('把參與方式與資料取得流程寫清楚，個別寄送。',
        '詢問沒有立刻消失，但每封信終於能用同一套說明回答。你多核了幾次名單，沒有把別人的資料順手包進同一個附件。',
        { skill: 8, trust: 7, energy: -8, mood: -4 }, ['evidence']),
      c('先發簡短通知，等有人問再各自補充。',
        '屎潘蛇覺得通知很俐落。接下來每個人的問題都不同，你用三倍篇幅回完一輪，還得確認大家收到的是同一版說明。',
        { lick: 7, trust: -4, energy: -8, mood: -8 }, ['loop']),
      c('畫一張股東座位迷宮，讓「我要看資料」走直線。',
        '你把流程畫成闖關圖，最短那條路標著正式窗口。大家笑完少問了幾個重複問題，屎潘蛇要求你把迷宮怪獸從正式版刪掉。',
        { slack: 7, trust: 6, mood: 4, energy: -6 }, ['archive', 'evidence'], true)
    ], { speaker: 'spencer', sourceIds: ['benefitsLore', 'characterFiction'], minTurn: 2 }),

  scene('finance', 'finance28-resume-invoice', '看完付款資料，再看一下履歷',
    '你正在核對本週收付款，希望忽然把一份履歷放在旁邊，說今天先請你幫忙約面試。你指著財務待辦，她說大家都是管理部門，名字差兩個字不用分那麼細。',
    '只是約個時間，你處理數字很細，這個應該也沒問題。', [
      c('先確認面試窗口與時段，請主管排定兩邊優先順序。',
        '面試順利約上，你也留下交辦範圍。主管不太愛聽排程衝突，至少這次沒有人以為你整天下來只需要發一封信。',
        { skill: 7, trust: 5, energy: -8, mood: -6 }, ['evidence', 'handover_notes']),
      c('先接下來，等付款資料做完再聯絡。',
        '希望很高興終於有人能幫忙。候選人的可面時段卻在你對完帳前被訂走，兩份工作一起等你想辦法。',
        { lick: 7, trust: -4, energy: -9, mood: -10 }, ['loop']),
      c('在待辦表加上「履歷」幣別，請她提供今日匯率。',
        '你把面試工時換算進排程，希望看完終於知道這件事不只一通電話。她分走了後續確認，你留住今天該完成的付款清單。',
        { slack: 7, trust: 5, mood: 4, energy: -6 }, ['archive', 'evidence'], true)
    ], { speaker: 'hope', sourceIds: ['labor', 'departuresFiction', 'characterFiction'] }),

  scene('finance', 'finance28-scenario-bell', '敲鐘之前，先算跑道',
    '翅膀說上市之後問題都會解決，請你把未來幾季的資金需求做漂亮一點。你手上的版本分成保守、一般與樂觀三種，他第一個問能不能只留最後一欄。',
    '還沒做就先想沒做成，你這個心態要怎麼敲鐘？', [
      c('保留三種情境，逐項標清楚成立條件。',
        '樂觀情境仍然能看，但不再假裝所有款項都同時到位。翅膀嫌你掃興，你把新一版計畫寄給需要真正安排付款的人。',
        { skill: 9, trust: 6, energy: -8, mood: -6, boss: -6 }, ['evidence']),
      c('先做樂觀簡報，另外留一份自己的追蹤表。',
        '翅膀很喜歡封面上的鐘。你卻多了一份不能少做的日常表，兩套版本每天都要維護，真正落差仍得由你一筆筆解釋。',
        { lick: 8, boss: 8, trust: -4, energy: -9, mood: -8 }, ['loop']),
      c('拿桌上計時器當鐘，請每個假設準時進場。',
        '第一聲響起時你念到「客戶如期付款」，第二聲是「人力依計畫補齊」。翅膀叫你關掉，卻開始逐項問哪些條件還沒確認。',
        { slack: 8, trust: 5, mood: 4, energy: -6, boss: -6 }, ['archive', 'evidence'], true)
    ], { sourceIds: ['spring', 'characterFiction'], minTurn: 3 }),

  scene('finance', 'finance28-recurring-tools', '試用期結束的是軟體，提醒信留給你',
    '阿福轉來一串工具訂閱，希望你今天確認續費。申請人有的換組、有的離職，唯一相同的是每封信都寫著「先用看看」，現在每個看看都準備自動續約。',
    '我只是幫忙轉給你，這些用不用應該你們那邊知道吧。', [
      c('逐項請使用單位確認用途與續費窗口。',
        '你找出一項重複服務，也替真的在用的工具補上負責人。阿福說他早就覺得該整理了，你看著寄件時間，決定先完成今天這一輪。',
        { skill: 8, trust: 7, energy: -8, mood: -5 }, ['evidence', 'handover_notes']),
      c('先照上一期處理，免得有人突然不能用。',
        '今天沒有人斷線，明天卻有人問為什麼那個早就沒用的帳號還在。阿福提醒你他只是轉信，你又得開始找最初那位申請人。',
        { lick: 6, trust: -5, energy: -7, mood: -8 }, ['loop']),
      c('幫每項訂閱掛失物招領牌，請主人三天內領回。',
        '你附上實際用途與窗口欄，失散的帳號陸續有人認領。阿福說牌子不必做這麼大，卻第一個把他那項寫成「大家都會用」。',
        { slack: 7, trust: 6, mood: 4, energy: -6 }, ['archive', 'evidence'], true)
    ], { speaker: 'sonny', sourceIds: ['resourceLore', 'characterFiction'], minTurn: 2 }),

  scene('finance', 'finance28-forecast-footnote', '預估可以調整，昨天不能重寫',
    '你替本季收付款預測加上更新日期，翅膀看到上次版本問，怎麼跟今天差那麼多。你說客戶改了付款時程，他問能不能只留下最新一份，免得大家看混。',
    '財務要給答案，不是把每一版都拿出來講故事。', [
      c('保留版本差異，另附目前能採用的摘要。',
        '會議終於有一頁能直接決策的數字，也查得到改動原因。翅膀仍嫌你備註太多，你少了一次事後靠記憶還原的風險。',
        { skill: 8, trust: 6, energy: -7, mood: -5, boss: -4 }, ['evidence']),
      c('簡報只放最新版，等追問再慢慢找舊信。',
        '翅膀很快翻過這頁，下一場卻有人問起原本的預估。你在信箱翻出半天前才整理過的內容，重新證明時間真的有往前走。',
        { lick: 7, boss: 6, trust: -3, energy: -8, mood: -8 }, ['loop']),
      c('替每一版拍證件照，宣布它們不能互相冒名。',
        '你把日期與變更項目做成小卡，同事一眼找到目前版本。翅膀叫你別拍那麼多張，但終於不再拿上週的表問今天的付款。',
        { slack: 7, trust: 5, mood: 4, energy: -6, boss: -4 }, ['archive', 'evidence'], true)
    ], { sourceIds: ['meetingLore', 'characterFiction'], minTurn: 1 }),

  scene('accounting', 'accounting28-final-form', '這份表單，上週不是已經定了嗎',
    '紅茶和阿福一起帶著業務表單來找你，說有幾個欄位想再改。你翻出上週確認的版本，阿福說他只是陪同了解；紅茶則問為什麼不能現在順便調整。',
    '欄位改一下應該很快吧，原本怎麼會設計成這樣？', [
      c('逐項對回憑證與對帳需求，再確認修改範圍。',
        '你把同一套規則解釋第二次，最後只改了真正不清楚的欄位。兩人離開後你多喝了一杯水，表格總算還能接得回月底對帳。',
        { skill: 8, trust: 6, energy: -8, mood: -7 }, ['evidence']),
      c('先照他們說的改，等有問題再補。',
        '紅茶說這樣就對了，第一張送回來的單卻缺了對帳欄。阿福提醒你他當時沒決定什麼，你得把剛刪掉的欄位再加回來。',
        { lick: 7, trust: -5, energy: -9, mood: -10 }, ['loop']),
      c('替上週版本辦追思會，問它究竟哪一欄死得不明。',
        '你把被刪的欄位排成花圈，紅茶笑到願意逐項聽用途。阿福補上一句他本來就支持先確認，你把這句也寫進這次紀錄。',
        { slack: 7, trust: 5, mood: 4, energy: -6 }, ['archive', 'evidence'], true)
    ], { speaker: 'sophie', sourceIds: ['contract', 'officeLore', 'characterFiction'], minTurn: 1 }),

  scene('accounting', 'accounting28-handover-shelf', '交接書很厚，打開只有檔案位置',
    '你接到一批前任留下的月底工作，交接目錄列得整整齊齊，附件卻分散在三個資料夾。主管說照以前的方式做就好，你目前還在考古以前是哪一個以前。',
    '前面的人都做得出來，你先看熟，不要什麼都問。', [
      c('先核對期初資料，列出缺件與待確認窗口。',
        '你找出兩個能接上的資料來源，也把一個缺口明白標出來。進度沒有突然加速，但後面的人終於不用從同一個洞重新掉下去。',
        { skill: 9, trust: 7, energy: -9, mood: -5 }, ['evidence', 'handover_notes']),
      c('沿用最近一次表格，先把這個月填完。',
        '檔案很快有了新月份，舊版本裡的未知欄位也跟著續命。主管問其中一格怎麼來的，你又回到那三個資料夾裡找祖先。',
        { lick: 7, trust: -5, energy: -8, mood: -9 }, ['loop']),
      c('把資料夾畫成古墓，先替未開門的房間插警告旗。',
        '同事一看就懂哪裡還缺資料，主管嫌圖不正式卻肯安排一次交接確認。你在旗子背面補上真正的路徑，考古終於有了地圖。',
        { slack: 7, trust: 6, mood: 4, energy: -6 }, ['archive', 'evidence'], true)
    ], { sourceIds: ['groupExit', 'departuresFiction', 'characterFiction'] }),

  scene('accounting', 'accounting28-receipt-orphan', '這張發票，誰帶它來公司的',
    '真真帶來一張費用憑證，品項寫得很簡單，申請人欄還空著。你問是哪一場活動，她說大家那天都有去，應該問一下就知道；於是全公司忽然都有可能是答案。',
    '先幫忙看能不能處理，不然那張放著也不是辦法。', [
      c('請申請人補用途與核准資料，再依程序處理。',
        '真真找到當天負責人，資料終於湊齊。你花掉一個下午追的不是發票真偽，而是每個人都以為別人知道的那一格。',
        { skill: 8, trust: 6, energy: -8, mood: -5 }, ['evidence']),
      c('先收下來，自己去各群組問用途。',
        '真真鬆了一口氣，你的訊息卻收回五種不同活動名稱。那張紙終於不孤單了，你的下班時間開始比較孤單。',
        { lick: 7, trust: -3, energy: -9, mood: -9 }, ['loop']),
      c('替發票播失物招領廣播，請監護人到櫃檯認領。',
        '你只念必要的缺件項目，真正的申請人很快來補資料。真真請你以後用寄信的，你回座位把廣播稿存成了缺件範本。',
        { slack: 7, trust: 5, mood: 4, energy: -6 }, ['archive', 'evidence'], true)
    ], { speaker: 'jenjen', sourceIds: ['officeLore', 'contract', 'characterFiction'] }),

  scene('accounting', 'accounting28-close-clock', '今天關帳，需求剛好今天才想起來',
    '月底關帳前，你把缺件清單寄完，翅膀忽然想看另一種分類的費用表。他說只是換個角度，你打開資料發現那個角度需要重新核對整個月的用途。',
    '數字不是都在裡面了？拉一下就有了吧。', [
      c('先完成既定關帳，另列新報表需要的核對時間。',
        '翅膀不喜歡聽到明天，但願意先拿現有摘要。你守住今天必須完成的版本，又多排了一件不能只靠拉一下完成的事。',
        { skill: 8, trust: 6, energy: -8, mood: -6, boss: -5 }, ['evidence']),
      c('先承諾今天交，關帳和新分類一起做。',
        '翅膀說會計就是要有彈性。你一邊核憑證一邊搬欄位，晚餐變成兩個表格中間的幾口冷飯。',
        { lick: 8, boss: 7, trust: -4, energy: -11, mood: -10 }, ['allin', 'loop']),
      c('把時鐘貼在透視表上，請時間也跟著重新分類。',
        '你把待核件數與剩餘時間排在同一頁，翅膀看完終於讓報表延後。時鐘沒有替你工作，但你少做了一次不可能的同日交付。',
        { slack: 7, trust: 5, mood: 4, energy: -6, boss: -5 }, ['archive', 'evidence'], true)
    ], { sourceIds: ['meetingLore', 'characterFiction'], minTurn: 2 }),

  scene('accounting', 'accounting28-denominator', '金額對得上，口徑還在開會',
    '業務拿合約總額，產品端拿本月使用量，兩邊都問為什麼跟你這張表不一樣。你把期間和計算方式列出來，翅膀卻先問哪一份數字比較適合放簡報。',
    '你們先對出一個答案，不要每個人報得都不一樣。', [
      c('說明不同表的用途，統一這次報告採用的口徑。',
        '大家終於知道自己問的是不同問題。翅膀仍想把它們合成一個漂亮總數，你花了一輪會議讓附註留在數字旁邊。',
        { skill: 9, trust: 7, energy: -8, mood: -5, boss: -4 }, ['evidence']),
      c('先照簡報要用的數字，其他差異會後補。',
        '投影片順利往下翻，會後的你收到了三封差異追問。原本五分鐘能說清楚的口徑，現在要在每個回信裡再講一次。',
        { lick: 7, boss: 6, trust: -5, energy: -8, mood: -9 }, ['loop']),
      c('讓合約總額與本月金額各戴一頂帽子，禁止交換身分。',
        '你畫出期間與用途，兩邊終於停止拿不同的表互相追殺。翅膀不喜歡帽子配色，卻同意正式簡報要留下那行說明。',
        { slack: 7, trust: 6, mood: 4, energy: -6, boss: -4 }, ['archive', 'evidence'], true)
    ], { sourceIds: ['productLore', 'meetingLore', 'characterFiction'], minTurn: 1 }),

  scene('accounting', 'accounting28-inventory-ghost', '資產在帳上，充電器在誰家',
    '阿福交給你盤點清單，幾件設備只寫了「借同仁」。你請他確認保管人，他說大家都認識啊；你看著資產編號，第一次希望自己也能認識那位叫大家的人。',
    '我只是知道東西能用，放哪裡應該要問拿的人吧。', [
      c('依編號確認位置與保管人，列出待追蹤項目。',
        '你們找回一台放在櫃子裡的螢幕，另外兩件也有了明確窗口。阿福說盤點果然要交給專業，你把他的借用紀錄需求也一起列好。',
        { skill: 8, trust: 7, energy: -8, mood: -5 }, ['evidence', 'handover_notes']),
      c('先照舊清單打勾，下次搬家再一起找。',
        '阿福說這樣比較省事，下一張設備需求單卻正好要借其中那台。你們從原點開始找，這次還多了一個人等著開會。',
        { lick: 6, trust: -5, energy: -7, mood: -8 }, ['loop']),
      c('替「借同仁」印一張通緝海報，懸賞一條原廠充電線。',
        '海報只列設備編號與回報窗口，幾位同事陸續認領。阿福提醒你懸賞線不在他那裡，你也沒有真的批准自己新增採購。',
        { slack: 7, trust: 6, mood: 4, energy: -6 }, ['archive', 'evidence'], true)
    ], { speaker: 'sonny', sourceIds: ['resourceLore', 'officeLore', 'characterFiction'], minTurn: 2 }),

  scene('accounting', 'accounting28-audit-breadcrumb', '補件的附件，還需要一個附件',
    '紅茶請你補一筆費用的核准依據，你附上當時的紀錄，她接著問能不能再補對應日期。你把兩份都放好，她說下次最好一次齊；你的清單裡原本沒有第二份。',
    '我不是找你麻煩，是資料本來就應該完整。', [
      c('確認完整缺件清單，一次補齊並留下版本。',
        '紅茶多補充了一項，你在動手前先把三項都確認好。她還是說應該要主動一點，這次資料至少沒有一路長到下班。',
        { skill: 8, trust: 6, energy: -8, mood: -6 }, ['evidence']),
      c('她問一份就補一份，先維持良好溝通。',
        '每次回信都很有禮貌，每次也都還有下一份。你沒有和她吵架，卻花了一整個下午證明這筆資料沒有在跟大家躲貓貓。',
        { lick: 7, trust: -3, energy: -9, mood: -9 }, ['loop']),
      c('把附件做成套娃，請她先宣布最裡面還有沒有一層。',
        '你在每層紙上寫一個要求，紅茶終於一次說完需要哪些資料。她不肯把紙娃留在桌上，但你保住了那份完整清單。',
        { slack: 7, trust: 5, mood: 4, energy: -6 }, ['archive', 'evidence'], true)
    ], { speaker: 'sophie', sourceIds: ['contract', 'characterFiction'], minTurn: 3 }),

  scene('accounting', 'accounting28-empty-department', '突然多了一場交接會，少了好幾張椅子',
    '你收到一場臨時交接會，進門才發現幾項月底工作都要重新分配。主管說先讓流程維持，你看完清單，發現原本分給幾個人的工作暫時都有了同一位候選人：你。',
    '先撐過這個月，人之後會再找。', [
      c('列出必做項目、承接人與缺口，要求安排優先順序。',
        '主管沒有立刻變出新人，但把一項工作分給其他窗口。你仍然很忙，至少「暫時」這兩個字旁邊終於寫了下次檢視日期。',
        { skill: 9, trust: 7, energy: -9, mood: -7, boss: -4 }, ['evidence', 'handover_notes']),
      c('先說自己可以，等月底結束再談人力。',
        '會議很快散場，你成了幾條流程的共同終點。每個人都說辛苦了，沒有一張新椅子因此坐進能幫忙的人。',
        { lick: 8, boss: 7, trust: -4, energy: -12, mood: -11 }, ['allin', 'loop']),
      c('帶三張空椅子進會議，請臨時人力逐一自我介紹。',
        '你替每張椅子貼上工作清單，大家終於看見缺口有多大。主管叫你把椅子推回去，也留下其中一份清單安排支援。',
        { slack: 7, trust: 6, mood: 3, energy: -7, boss: -5 }, ['archive', 'evidence'], true)
    ], { sourceIds: ['groupExit', 'departuresFiction', 'characterFiction'], minTurn: 3 }),

  scene('hr', 'hr28-coffee-jd', '人力資源，今天先萃取一下',
    '你正和候選人確認報到，希望陪翅膀走到桌邊。他又加了一件交辦：會議開始前幫他準備咖啡。你看著招募進度表，找不到哪一欄適合填牛奶比例。',
    '不就一杯咖啡？大家互相幫忙，你不要分那麼清楚。', [
      c('說明正在處理報到，請安排茶水窗口與優先順序。',
        '翅膀嫌你把小事講得很大，你仍把報到確認做完了。咖啡另外有人處理，對方也終於知道這件事原本不是你整天的待辦。',
        { skill: 7, trust: 5, energy: -7, mood: -7, boss: -6 }, ['evidence']),
      c('先泡好再回電話，希望不要耽誤報到。',
        '咖啡準時進會議，候選人的未接來電也準時留在手機上。翅膀說這樣不就好了，你得再找一個能把入職資料講完的時段。',
        { lick: 8, boss: 8, trust: -4, energy: -8, mood: -10 }, ['loop']),
      c('替咖啡豆排面試，請它先回答為什麼想加入本公司。',
        '你拿紙杯演完自我介紹，希望笑完幫忙分走一通確認電話。翅膀問你到底泡好了沒，你把茶水交辦正式寫進當天工作表。',
        { slack: 8, trust: 5, mood: 4, energy: -6, boss: -5 }, ['archive', 'evidence'], true)
    ], { sourceIds: ['labor', 'officeLore', 'characterFiction'] }),

  scene('hr', 'hr28-admin-half-day', '下午做人資，上午先當行政',
    '你排好的兩場電話訪談旁，真真又放來補文具、收快遞和整理會議室的清單。她說今天人手不夠先互相幫忙；你翻了一下，這句話上週也在同一個時段出現。',
    '你就在辦公室，順路處理一下，時間應該很好安排。', [
      c('把訪談與行政工時一起排出來，請她協調分工。',
        '真真分走一半現場工作，你保住兩場已約好的電話。她還是覺得你很愛列清單，但終於知道「順路」也會撞上別人的行程。',
        { skill: 8, trust: 6, energy: -8, mood: -6 }, ['evidence']),
      c('全部先接著，午休再補招募進度。',
        '會議室乾淨了，包裹也到了，每個窗口都覺得自己的事只占你一下。只有你知道午餐旁邊還開著哪位候選人的履歷。',
        { lick: 7, trust: -4, energy: -10, mood: -10 }, ['loop']),
      c('在桌上擺兩副名牌，讓人資與行政先搶同一張椅子。',
        '你把兩份排程各放一邊，真真看到同時段的三件事終於願意重排。名牌最後都收回抽屜，今天至少不用再假裝你有兩個人。',
        { slack: 7, trust: 5, mood: 4, energy: -6 }, ['archive', 'evidence'], true)
    ], { speaker: 'jenjen', sourceIds: ['labor', 'officeLore', 'characterFiction'] }),

  scene('hr', 'hr28-candidate-chase', '面試聊得很好，誰先傳訊息',
    '翅膀說剛才那位候選人不錯，你準備安排後續，他卻說不要太急，看看對方會不會主動問。候選人昨天已經問過流程，現在兩邊都等著對方再積極一點。',
    '他如果真的想來，就會再問，你不要表現得我們很缺人。', [
      c('按說好的時間回覆，明確說明下一步與期限。',
        '候選人回覆仍有意願，你終於能安排下一場。翅膀覺得你太主動，你把原本承諾回覆的日期放進進度表，免得明天又重新等待。',
        { skill: 8, trust: 6, energy: -7, mood: -5, boss: -4 }, ['evidence']),
      c('先等對方再問，回報仍在觀察意願。',
        '表格裡的狀態維持不動，候選人幾天後通知已接受別的安排。翅膀問人資為什麼沒有追緊一點，你看著上次會議紀錄深呼吸。',
        { lick: 8, boss: 6, trust: -5, energy: -7, mood: -10 }, ['loop']),
      c('放兩支紙做的手機對看，主持第一屆已讀耐力賽。',
        '你報到第四回合，希望先笑出來。翅膀叫你不要玩，最後仍同意發一封正式進度信，這場比賽總算有人願意按送出。',
        { slack: 7, trust: 5, mood: 4, energy: -6, boss: -5 }, ['archive', 'evidence'], true)
    ], { sourceIds: ['interns', 'meetingLore', 'characterFiction'], minTurn: 1 }),

  scene('hr', 'hr28-onboarding-notice', '新人明天報到，通知今天開始找主人',
    '明天有新人報到，座位、帳號與職務窗口還差最後確認。翅膀在會議上問怎麼沒先告知他，阿福說等人資確認，你翻開寄件備份，發現三天前那封信每個人都收到了。',
    '寄信不代表通知到，你應該要確認大家都有看到。', [
      c('列清楚各窗口待回覆項目，逐一確認完成時間。',
        '帳號和座位終於有人接手，你也多花了一輪電話確認。翅膀仍說新人報到不能出錯，這次至少能看見哪一格還在等誰。',
        { skill: 8, trust: 7, energy: -8, mood: -6, boss: -4 }, ['evidence', 'handover_notes']),
      c('先說是自己提醒不夠，全部再追一次。',
        '會議氣氛稍微緩和，大家也自然把其餘待辦轉給你。你多得了一句辛苦了，新人的座位卻還需要一位真正願意搬椅子的人。',
        { lick: 8, boss: 7, trust: -4, energy: -10, mood: -9 }, ['loop']),
      c('用玩具鵝替每個未回覆窗口點名，未到者請補叫一聲。',
        '紙鵝沿著待辦表走完一圈，阿福終於回覆帳號預計何時開好。翅膀說不要把辦公室弄得像幼稚園，清單倒是終於有人填完。',
        { slack: 8, trust: 6, mood: 4, energy: -6, boss: -5 }, ['archive', 'evidence'], true)
    ], { sourceIds: ['meetingLore', 'officeLore', 'characterFiction'], minTurn: 1 }),

  scene('hr', 'hr28-attendance-access', '這張補卡單，為什麼飛到別人手上',
    '水蛇拿著補卡申請來找你，傑克也站在旁邊，問自己何時變成審核窗口。你打開權限設定，看到一個沿用舊名單的流程；系統沒有吵架，收到通知的人已經開始了。',
    '先把今天這張處理好，其他的之後再說。', [
      c('核對審核路徑，只留必要窗口，再測試一次。',
        '補卡單回到正確流程，傑克也不必再替陌生的待辦負責。你多跑一輪測試，換到下一張申請不用重新召集同一批人。',
        { skill: 8, trust: 7, energy: -8, mood: -5 }, ['evidence']),
      c('先人工轉給主管，等有人再反映才改設定。',
        '這一張順利通過，隔天下一張又沿著舊路飛出去。你成了人形轉寄機，還得解釋為什麼這次又是同一個問題。',
        { lick: 6, trust: -4, energy: -8, mood: -9 }, ['loop']),
      c('替補卡單辦迷路協尋，請它先交代昨晚投奔哪個信箱。',
        '你畫出通知路徑，大家終於看懂問題出在舊設定。水蛇笑完願意陪你測一張，傑克只問之後能不能讓他的信箱恢復清靜。',
        { slack: 7, trust: 6, mood: 4, energy: -6 }, ['archive', 'evidence'], true)
    ], { speaker: 'jack', sourceIds: ['workRules', 'characterFiction'], minTurn: 2 }),

  scene('hr', 'hr28-comp-leave', '通知大家休假，先問誰能代班',
    '你提醒一批補休即將到期，同仁回覆願意休，主管卻接著問這週誰能代班。希望請你把兩邊溝通好；你發現提醒信裡最難填的欄位並不是休假日期。',
    '制度都有提醒了，但部門工作也不能停，請你協調一下。', [
      c('請各主管確認代理與交接，再逐人安排時段。',
        '你把沒人承接的工作明白列出來，主管終於分走兩項。不是每個人都排到最想要的日期，但休假不再只是信件裡一句漂亮提醒。',
        { skill: 8, trust: 8, energy: -8, mood: -6 }, ['evidence', 'handover_notes']),
      c('先請同仁自行協調，自己持續追蹤表單。',
        '追蹤表每天都更新，代理欄卻一直空著。同仁問你到底能不能休，主管問你為什麼還沒排完，兩邊都把最後一格留給你。',
        { lick: 7, trust: -5, energy: -9, mood: -10 }, ['loop']),
      c('替補休發倒數登機證，請主管先認領每個代理座位。',
        '你把需要交接的工作印在登機證背面，希望笑完幫你約了一場協調。大家總算開始安排代理，沒有真的把休假當成自己會飛走的東西。',
        { slack: 7, trust: 6, mood: 4, energy: -6 }, ['archive', 'evidence'], true)
    ], { speaker: 'hope', sourceIds: ['workRules', 'rickLore', 'characterFiction'], minTurn: 3 }),

  scene('hr', 'hr28-interview-crowd', '面試有三位，想參加的有四位',
    '設計師面試原本安排兩個窗口，會前又有人說自己也是被叫來幫忙。你確認後發現不是同場，而是輪流各面一遍；候選人的下午正準備被一個「順便」切成好幾段。',
    '大家都是關心人才，你排一下就好。', [
      c('確認必要面試官與分工，先告知候選人完整時程。',
        '面試縮成能講清楚工作的一輪，幾位想旁聽的人改看摘要。你花時間協調大家的關心，候選人終於不必重複介紹自己四次。',
        { skill: 8, trust: 6, energy: -8, mood: -6 }, ['evidence']),
      c('每個人都排進去，免得有人覺得被排除。',
        '內部沒有人被漏掉，候選人卻在第三輪開始問還要多久。你拿著滿滿的行事曆，發現今天最缺的不是面試官。',
        { lick: 7, trust: -5, energy: -9, mood: -9 }, ['loop']),
      c('替面試官發號碼牌，未輪到的請先填「我會問什麼」。',
        '大家把問題寫下來後，四份自我介紹終於合併成一份。有人嫌號碼牌太誇張，你把重複問題刪完，留下真正需要的人。',
        { slack: 7, trust: 6, mood: 4, energy: -6 }, ['archive', 'evidence'], true)
    ], { speaker: 'hope', sourceIds: ['designLore', 'interns', 'characterFiction'], minTurn: 2 }),

  scene('hr', 'hr28-trial-review-notice', '試用期快到了，標準還在路上',
    '希望請你發試用期確認通知，表格裡只有主管印象，沒有一開始約好的目標。新人問該準備什麼，你轉問用人主管，對方回覆「平常怎麼做就怎麼評」。',
    '先把通知發出去，細節主管自己會跟他說。', [
      c('先確認工作目標、具體紀錄與回饋時段。',
        '主管不太愛補資料，最後仍列出幾項能討論的工作。你多追一輪，換到新人不用帶著一張空白表猜今天會被問什麼。',
        { skill: 8, trust: 7, energy: -8, mood: -6 }, ['evidence']),
      c('照原表發出，附上請洽直屬主管。',
        '通知準時完成，新人卻帶著同一個問題回來找你。希望說表單有寄就好，你的信箱開始累積每個人對「自己會說」的不同理解。',
        { lick: 7, trust: -5, energy: -8, mood: -10 }, ['loop']),
      c('替空白評分欄配一顆水晶球，請主管示範怎麼看。',
        '你用玻璃紙包住紙球，希望叫你不要鬧，卻同意先補評估項目。球沒有預知能力，今天至少逼出幾個能用文字講明白的標準。',
        { slack: 7, trust: 5, mood: 4, energy: -6 }, ['archive', 'evidence'], true)
    ], { speaker: 'hope', sourceIds: ['workRules', 'pip', 'characterFiction'], minTurn: 3 }),

  scene('admin', 'admin28-recruiting-hat', '行政專員的抽屜，怎麼開始長履歷',
    '你剛把會議室排好，希望又寄來幾份履歷，請你聯絡候選人。你的行政清單多了一欄招募，她說反正你本來就在安排時間，面試也只是另一種會議。',
    '都在管理部門，大家互相支援，不用被職稱限制。', [
      c('確認招募窗口與回覆內容，把兼任工時一起排進去。',
        '希望接回專業問題，你負責時段安排。工作仍多了一項，至少候選人不會問到薪資時才發現自己一路都在跟行政確認。',
        { skill: 7, trust: 6, energy: -8, mood: -6 }, ['evidence', 'handover_notes']),
      c('先全部接下，今天先把邀約寄完。',
        '希望稱讚你很好配合，候選人接著問工作內容與面試流程。你查完答案，發現行政清單還停在上午那一格。',
        { lick: 7, trust: -4, energy: -10, mood: -10 }, ['loop']),
      c('做一頂可翻面帽子，翻到人資面就請主管重排工作。',
        '你翻帽子時把兩份待辦一起攤開，希望終於看見原本的行政工作沒消失。她分走後續面試確認，你的帽子暫時不用每分鐘翻一次。',
        { slack: 7, trust: 5, mood: 4, energy: -6 }, ['archive', 'evidence'], true)
    ], { speaker: 'hope', sourceIds: ['labor', 'characterFiction'] }),

  scene('admin', 'admin28-coffee-round', '第一杯是幫忙，第二杯開始有固定流程',
    '翅膀開會到一半走出來問誰能幫忙準備咖啡，你剛好在旁邊。昨天你幫過一次，今天他的語氣已經像在問咖啡為什麼還沒自己走進會議室。',
    '你昨天不是做得很好？一樣就好，順便幫大家準備。', [
      c('確認人數與交辦時間，把茶水工作排進行政清單。',
        '咖啡準備好了，原本那件採購延後也有了清楚原因。翅膀嫌你連小事都要記，你知道明天至少不必假裝這半小時從沒發生。',
        { skill: 7, trust: 5, energy: -7, mood: -7, boss: -3 }, ['evidence']),
      c('先幫每個人準備，自己的工作晚點補。',
        '會議裡多了幾杯熱飲，你的待辦沒有少一項。翅膀稱讚你有服務精神，下一場會議的邀請也順便抄送給你。',
        { lick: 8, boss: 8, trust: -3, energy: -9, mood: -10 }, ['loop']),
      c('替咖啡車做打卡機，請它一起申請今天的工時。',
        '你在托盤貼上開始與結束時間，旁邊同事笑完幫你送了兩杯。翅膀叫你不要亂貼，卻終於同意把例行茶水安排寫清楚。',
        { slack: 8, trust: 5, mood: 4, energy: -6, boss: -4 }, ['archive', 'evidence'], true)
    ], { sourceIds: ['labor', 'officeLore', 'characterFiction'] }),

  scene('admin', 'admin28-extension-grandeur', '分機多一碼，公司就大一點',
    '搬電話時，翅膀看見兩位數分機，問為什麼看起來公司這麼小。真真請你改成三位數，法師又問另一層樓要不要留電話；阿福在旁邊表示自己只是來看線。',
    '門面要有規模，你先弄好，樓層怎麼用再討論。', [
      c('先確認各樓需求與線路，再統一分機表。',
        '你讓大家在同一張表上決定哪裡要能接電話。三位數有了，少接錯樓的同事也有了；你則多跑了一趟原本不在行程裡的樓梯。',
        { skill: 8, trust: 7, energy: -8, mood: -6, boss: -3 }, ['evidence']),
      c('先把分機改三位數，其他問題各自再問。',
        '翅膀覺得終於像樣，大家卻開始用舊表打新分機。真真和法師繼續討論樓層，你拿著貼紙回去一張張更新。',
        { lick: 8, boss: 7, trust: -5, energy: -9, mood: -9 }, ['loop']),
      c('替電話掛「國際總部」牌匾，請規模先接一通來電。',
        '你讓每個人實測一次，法師終於發現有個位置真的接不到。翅膀叫你收掉牌匾，阿福則在測完後說他早就猜到了。',
        { slack: 8, trust: 6, mood: 4, energy: -6, boss: -5 }, ['archive', 'evidence'], true)
    ], { sourceIds: ['officeLore', 'characterFiction'], minTurn: 1 }),

  scene('admin', 'admin28-room-tetris', '會議室只有一間，臨時都說很重要',
    '你排好的會議室同時多出翅膀的臨時討論與一場候選人面試。真真說先喬一下，兩邊卻都回不能改；你看著那張桌子，還沒學會讓它在兩個地方同時存在。',
    '你就協調一下，這種事情行政應該很熟。', [
      c('確認不可移動的條件，安排替代空間與緩衝。',
        '面試保住安靜時段，臨時討論換到另一個能用的角落。你多搬一輪設備，至少候選人不必在走道上等大家決定誰比較重要。',
        { skill: 8, trust: 7, energy: -8, mood: -5 }, ['evidence']),
      c('先讓臨時討論進去，邊等邊跟面試窗口道歉。',
        '會議室裡的人說再五分鐘，門外的人已經聽了第三次。你今天最流利的句子變成「不好意思」，排程沒有因此多出一間房。',
        { lick: 7, trust: -5, energy: -9, mood: -10 }, ['loop']),
      c('拿樂高蓋第二間會議室，請兩場會議先選縮小哪一場。',
        '你把實際人數和設備需求排在模型旁，真真終於承認有一場能改線上。樂高留在桌角，真正的會議室今天少擠了一次。',
        { slack: 7, trust: 6, mood: 4, energy: -6 }, ['archive', 'evidence'], true)
    ], { speaker: 'jenjen', sourceIds: ['officeLore', 'interns', 'characterFiction'], minTurn: 1 }),

  scene('admin', 'admin28-dragon-quiz-producer', '端午活動有題庫，沒有製作人',
    '真真請你辦一場端午猜謎，獎品與活動時間都還在等確認，大家已經開始寄梗題。你原本只想知道有幾份禮物，信箱卻先收到一份足以開同事大會的題庫。',
    '就大家輕鬆玩一下，題目你最熟，先弄出來。', [
      c('先確認預算與流程，挑不涉及隱私的職場梗題。',
        '你留下分機、版本和玩具鵝這類大家能笑的題目，也把獎品數量確認好。活動少了幾題八卦，你的下午多了一份完整主持稿。',
        { skill: 8, trust: 7, energy: -8, mood: -5 }, ['evidence', 'archive']),
      c('先做一套完整活動，獎品晚點再說。',
        '投影片做好了，預算卻還沒有人拍板。大家已經在問能抽到什麼，你只好把最後一頁的獎品圖先換成問號。',
        { lick: 7, trust: -4, energy: -9, mood: -9 }, ['loop']),
      c('讓玩具鵝擔任主考官，答錯就聽它審判一句「嘎」。',
        '你給鵝寫了一整套無傷大雅的判詞，同事開始搶著模仿。真真笑完幫你確認場地，這場活動總算有人處理不會自己嘎出來的事。',
        { slack: 8, trust: 6, mood: 5, energy: -7 }, ['archive', 'evidence'], true)
    ], { speaker: 'jenjen', sourceIds: ['dragonQuiz', 'officeLore', 'characterFiction'], minTurn: 2 }),

  scene('admin', 'admin28-supply-minimum', '衛生紙是耗材，申請像買主機',
    '茶水間快沒清潔用品，真真請你一起補，翅膀看到採購清單卻先問每一樣能不能再省。你已經比過價格，現在被要求解釋為什麼同仁每天都會用到擦手紙。',
    '金額小也都是錢，不要覺得公司什麼都能一直買。', [
      c('列出庫存與消耗量，提出最低補貨數量。',
        '翅膀終於核准必要品項，你得在剩下一包用完前把訂單送出。比價做了兩次，辦公室倒是不用靠大家各帶一張衛生紙過日子。',
        { skill: 8, trust: 6, energy: -7, mood: -6, boss: -4 }, ['evidence']),
      c('先刪一半，讓總額看起來比較好過。',
        '清單順利通過，幾天後缺的正好是被刪掉那半。你把同一件事重新申請一遍，這次還多了急件兩個字。',
        { lick: 8, boss: 6, trust: -5, energy: -8, mood: -9 }, ['loop']),
      c('替最後一包擦手紙開庫存記者會，宣布它不接受延長賽。',
        '你拿紙盒當講台，翅膀嫌你誇張，同事卻願意提供實際用量。補貨終於核准，你把講台拆回可以回收的形狀。',
        { slack: 7, trust: 5, mood: 4, energy: -6, boss: -5 }, ['archive', 'evidence'], true)
    ], { sourceIds: ['resourceLore', 'officeLore', 'characterFiction'], minTurn: 2 }),

  scene('admin', 'admin28-seat-key', '座位排好了，門還沒認識主人',
    '你協調一輪座位搬遷，紅茶卻站在辦公室門外問現在要坐哪。位置沒有少，門禁名單卻沒有跟著搬；阿福說他以為名單已經有人通知。',
    '你們先確認好，不要每次搬個位置就搞得一堆問題。', [
      c('確認門禁、座位與通知窗口，再逐一實測。',
        '紅茶終於能回座位，你把漏掉的名單交給正確窗口。阿福說原來只差這個，實測那一輪卻用掉你本來能處理採購的時間。',
        { skill: 8, trust: 7, energy: -8, mood: -6 }, ['evidence', 'handover_notes']),
      c('先讓她坐臨時位置，等有人有空再處理。',
        '桌子暫時能用，紅茶卻每次進出都要再問一次。你變成人形門鈴，原本的小缺口從上午一路響到下午。',
        { lick: 6, trust: -5, energy: -8, mood: -10 }, ['loop']),
      c('替辦公室門安排新人訓練，第一課認識裡面的同仁。',
        '你把應確認的權限列成課表，阿福看完總算逐項核對。門沒有真的上課，今天至少不用再靠站在外面的人提醒它哪裡漏了。',
        { slack: 7, trust: 6, mood: 4, energy: -6 }, ['archive', 'evidence'], true)
    ], { speaker: 'sophie', sourceIds: ['officeLore', 'characterFiction'], minTurn: 2 }),

  scene('admin', 'admin28-event-attendance', '員工活動辦完，打卡單才開始集合',
    '公司提早出發去聚餐，隔天幾位同仁的出勤時間卻少了一截。希望正忙著別的流程，真真請你先幫忙整理；活動已經散場，簽核卻像還沒吃到主菜。',
    '大家都是去公司活動，這個你跟人資對一下就好。', [
      c('核對正式活動通知，請人資確認統一處理方式。',
        '同一場活動終於能用同一套資料說明，你不用替每個人各講一段行程。真真說有你幫忙真好，你也把下次活動的出勤安排加進籌備清單。',
        { skill: 8, trust: 7, energy: -8, mood: -6 }, ['evidence']),
      c('先幫每個人逐筆補單，缺什麼再回頭問。',
        '你替同一頓飯填出好幾種表格，還有兩張因附件不同被退回。真真很感謝你接手，午餐前你還在處理前天的晚餐。',
        { lick: 7, trust: -4, energy: -9, mood: -10 }, ['loop']),
      c('替聚餐辦補卡公聽會，請那桌菜出示到場證明。',
        '你把活動通知、集合時間和窗口排成一張圖，希望終於一次說清楚需要哪些資料。菜沒有出席，這批表格倒是不用再一人一套故事。',
        { slack: 7, trust: 6, mood: 4, energy: -6 }, ['archive', 'evidence'], true)
    ], { speaker: 'jenjen', sourceIds: ['workRules', 'spring', 'characterFiction'], minTurn: 3 })
];
