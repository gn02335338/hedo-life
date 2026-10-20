// Original fictional advisor scenes, not transcripts or statements of verified conduct.
// The private recollections inspire the referral and office Wi-Fi premises only.
// Research projects, university applications, dialogue and outcomes below are invented.
const c = (text, result, delta, flags = []) => ({ text, detail: '', result, delta, flags });
const scene = (id, title, speaker, body, wing, choices, extra = {}) => ({
  id, title, speaker, body, wing, choices,
  era: '顧問支線・教授也有待辦', sourceIds: ['characterFiction'],
  minRules: 15, minTurn: 4, weight: 1.05, ...extra
});

export const ADVISOR_EVENTS = [
  scene('advisor-office-wifi', '顧問來談模型，你先救 Wi-Fi', 'sonny',
    '林澤教授來討論技術，辦公室的 Wi-Fi 卻先斷線。Sonny 來問你能不能一起查，Wing 在群組問怎麼沒有人先知道。你看著還沒打開的技術文件，今天第一個需要改善的模型，是大家猜老闆什麼時候會生氣的模型。',
    '先讓教授連得上，其他的等一下再說。', [
      c('和 Sonny 分頭查連線，留下故障與修復紀錄。',
        '連線恢復，教授終於能打開資料。Wing 問怎麼花這麼久，你把真正卡住的原因寫進紀錄；下次至少不用再從「你們怎麼都不知道」開始查。',
        { skill: 10, trust: 9, energy: -9, mood: -5, boss: -6 }, ['evidence', 'handover_notes']),
      c('先分享手機網路，讓討論繼續。',
        '會議準時開始，你的手機則一路燙到散會。Wing 說臨場反應很好，順口問下次能不能也這樣；你趕快把暫用兩個字補進會議紀錄。',
        { boss: 10, trust: 4, cash: -3, energy: -7, mood: -7 }, ['evidence']),
      c('替路由器印一張台大電機旁聽證，請它振作。',
        'Sonny 笑到差點拿反網路線。證件沒有讓訊號變強，你們還是一起找到壞掉的設定；Wing 只問這張證為什麼沒有學號。',
        { slack: 7, trust: 8, skill: 4, energy: -6, mood: 5, boss: -11 }, ['archive'])
    ], { roles: ['system', 'ai', 'mis', 'project', 'product', 'executive'] }),

  scene('advisor-referral-renewal', '教授還沒回信，留任表先到了', 'wing',
    '你提到想準備研究所，Wing 馬上說可以介紹林澤教授，接著問明年的專案能不能先接。你只是想知道研究方向，話題已經繞到留下來比較好安排。招生簡章還沒看完，人力表裡的你倒是續了一年。',
    '我都願意幫你介紹了，你自己也要拿出誠意吧？', [
      c('先問研究方向、申請流程與可以聯絡的窗口。',
        'Wing 說人脈不是問這麼細的。你謝過他的好意，另外把公開的申請時程查清楚；教授還沒回信，你至少不用連自己的計畫也一起停在已讀。',
        { skill: 8, energy: -6, boss: -13, mood: 3 }, ['evidence', 'offer_checked']),
      c('答應先幫專案，介紹的事再慢慢談。',
        'Wing 當場替你加進新專案群組。教授的聯絡方式還在等，明早的進度會已經排好；這份進修規劃目前最確定的部分，是你還要上班。',
        { boss: 13, lick: 7, energy: -13, mood: -12 }, ['loop']),
      c('把留任表改成推薦函，請 Wing 先寫三個優點。',
        'Wing 寫下積極、配合、隨時能支援。你問這三項適合申請哪個研究領域，他想了一下，說公司現在最需要的就是這個領域。',
        { slack: 8, trust: 5, boss: -15, mood: 5 }, ['archive'])
    ]),

  scene('advisor-research-deadline', '研究問題，怎麼長出上線日期', 'rick',
    '林澤教授那場技術討論留下幾個待研究的問題。你整理資料時，Rick 已經把其中一題貼進專案清單，狀態寫開發中。你問誰確認過可行，他說教授都提到了，總不會只是聊聊。從研究到產品，中間只經過一次複製貼上。',
    '先做個可以展示的，下次老闆問才有東西看。', [
      c('把研究假設、驗證方法和產品需求分開列。',
        '清單終於看得出哪些已知、哪些還不知道。Rick 說這樣不夠積極，你仍然留下驗證步驟；至少展示失敗時，不會只剩你今天點過頭這件事。',
        { skill: 11, trust: 7, energy: -8, boss: -12, mood: -4 }, ['evidence', 'handover_notes']),
      c('先做小展示，明確標上還沒驗證的部分。',
        'Rick 很滿意畫面，對註記有點意見。你把範例與限制一起寄出，免得明天醒來，這份展示就已經成為客戶買到的功能。',
        { skill: 8, boss: 7, energy: -12, mood: -7 }, ['evidence']),
      c('把「待研究」供在白板上，宣布上線日期請示神諭。',
        '同事替白板多畫了一個筊。Rick 問能不能先訂下週，你說神諭目前只確認還沒驗證；這次笑話的規格，居然比專案清楚。',
        { slack: 8, trust: 8, boss: -15, mood: 5, energy: -4 }, ['archive'])
    ], { roles: ['system', 'ai', 'mis', 'project', 'product', 'design', 'executive'] }),

  scene('advisor-application-progress', '報考進度，也要每天站會', 'wing',
    '螢幕上開著台大電機的招生資訊，Wing 路過看到校名，忽然追問報考進度，還問你找過林澤教授沒有。你從沒答應把進修列成公司的 KPI，他倒先替你開了每日站會。你一時分不清，他在問公司的功能，還是你的人生補件。',
    '想進修就要認真啊。準備到哪裡了？', [
      c('先把背景和想研究的問題整理清楚，再回覆他。',
        '你把還不會的基礎列出來，沒有替自己編一份已經準備好的研究計畫。Wing 嫌進度慢，但這次至少是你自己決定要學什麼。',
        { skill: 10, energy: -8, boss: -9, mood: 3 }, ['evidence']),
      c('先說正在積極準備，回座把今天工作做完。',
        'Wing 點頭，補一句讀書也不能影響工作。你把兩份清單排在一起，發現他對時間的期待很像對預算：最好不用增加，就能同時多做一套。',
        { lick: 7, boss: 10, energy: -9, mood: -10 }, ['loop']),
      c('把申請信做成十頁簡報，最後一頁只問准不准時下班。',
        'Wing 對封面台大兩字很滿意，看到最後一頁才說不要牽拖。你收起簡報，確認今天最難申請到的東西仍然是自己的晚上。',
        { slack: 8, trust: 5, boss: -14, mood: 5, energy: -4 }, ['archive'])
    ], { roles: ['system', 'ai', 'mis', 'project', 'product', 'executive'] })
];
