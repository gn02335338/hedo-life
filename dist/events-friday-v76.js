const choice = (text, result, delta, flags = []) => ({ text, detail: '', result, delta, flags });

const meeting = {
  kind: 'daily',
  era: '週五讀書會',
  sourceIds: ['characterFiction'],
  minRules: 39,
  requiresFridayCastV76: true,
};

export const FRIDAY_CAST_EVENTS_V76 = [
  {
    ...meeting,
    id: 'friday76-joe-search-terms',
    speaker: 'joe',
    minTurn: 2,
    title: '鷲的報表只有一條上升箭頭',
    body: '週五讀書會快開始了，鷲把搜尋流量的週報貼上白板。總點擊多了三成，但品牌名稱那一欄也突然胖了一圈。剩五分鐘，他想找個人陪他把下週的簡報講順。',
    wing: '如果只是更多人來找我們的名字，這張箭頭該往哪一欄放？',
    choices: [
      choice('把品牌詞和其他查詢分開看', '鷲拆開兩張圖，終於看到哪些頁面真的多了陌生讀者。他把原本那句「全面成長」從簡報第一頁刪掉。', { skill: 5, trust: 5, energy: -4 }, ['evidence']),
      choice('先練總數那一頁，拆細項留給下週', '你幫鷲把報告縮短了一分鐘。他把新版先存成草稿，檔名暫時叫「等查完再寄」。', { slack: 4, trust: -2, mood: 3 }),
      choice('把兩條箭頭都貼上白板，請大家各猜一次', '鷲把答案蓋到最後才翻開。房間裡原本只有一個結論，現在每個人都在找自己猜錯的那一欄。', { skill: 2, trust: 3, energy: -2, mood: 4 }, ['archive']),
    ],
  },
  {
    ...meeting,
    id: 'friday76-ethan-example',
    speaker: 'ethan',
    minTurn: 5,
    title: '伊森借了兩盒色鉛筆',
    body: '伊森把資料夾分成藍、黃兩疊，想示範為什麼驗證資料要分開。他跑出的成績好得有點可疑，紅酒昨天留了一張便條，提醒他回頭看缺值是在哪一步補的。',
    wing: '我先拿整份資料算平均再切開，這樣藍色那疊到底算不算被偷看了？',
    choices: [
      choice('先分開，再用黃色那疊算平均', '伊森重跑一遍，只讓藍色資料套用訓練時的平均。分數掉了一截，他在筆記旁寫下被找回來的那一步。', { skill: 5, trust: 5, energy: -5 }, ['evidence']),
      choice('把舊分數留著，加一行待重跑', '伊森在成績旁貼了醒目的待確認標籤。這回省了時間，但下次讀書會前還有一份作業要補。', { slack: 3, trust: 1, mood: 2 }),
      choice('拿三張有數字的便條做一遍', '你們把兩張便條蓋起來，只用手上那張算平均。伊森照著畫出三格圖例，請下一位上台的人直接拿去用。', { skill: 3, trust: 3, energy: -2, mood: 4 }, ['archive']),
    ],
  },
];
