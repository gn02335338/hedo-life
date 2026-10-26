# 移動島人物技能改編

移動島的 34 位官方對手共有 119 招人物技能與 34 段專屬戰鬥插曲。每人有開場白、至少三招技能與一段每局只會觸發一次的事件；翅膀、阿福、傑克各五招，阿良四招。技能與事件的數值只用在島上的即時對戰，不重寫人生故事、匿名史冊或歷史重播。

## 素材與改編範圍

這次以 repository 中已發布的問答題庫改編事件、史冊改編場景、角色日常與公開職稱為母題，另加入本次創作者指定的遊戲設定。技能資料整理未讀取原始私人題庫或私人史冊，也不將原始題庫、史冊、人物照片、管理網址、私人研究索引或逐字筆記發布至公開 repository。原始故事裡的工作流程、紙張、道具、台詞習慣，被重新寫成可走位與反制的卡通招式；並非將這些招式當成真實人物的行為紀錄。

技能資料與完整來源索引位於 [brawl-roster.js](../dist/island/brawl-roster.js)。每筆 sources 指向公開程式檔與既有事件 ID；角色職稱沿用 [persona.js](../dist/persona.js) 的公開顯示。

## Creator brief

- 翅膀的左腿較短、持拐杖，以及「黃金左腳」「三樓喊話」「檀香沐浴回血」是創作者本次指定的角色與戰鬥設定。左腳母題另可對照公開的 `q26-chair-left-shoe`。三樓招式在遊戲裡表現為紙板樓層與地面預警圈，角色透過走位閃開，不演出真實墜樓。
- 阿福低血時的「舊傷躺平」是本次指定的虛構防守技能，台詞只屬於遊戲角色，不作醫療診斷或真實健康斷言。披薩補給與腕力理由的母題可對照 `video-pizza-overtime`、`quiz26-arm-draw`。
- 傑克改穿黑色運動休閒 T 恤的外觀來自本次創作者提供的照片描述；對戰技能中的運動切入、補水與既有籃球生活母題共同改編。照片與其他入鏡者不隨此說明或公開 repository 發布。

## 戰鬥閱讀方式

技能分成近身揮擊、衝刺、飛行紙卡、地面範圍、回血、紙盾與減速七類。名稱與演出依人物不同，數值受統一上限限制。每招都有開招提示、施放台詞與反制說明；回血與紙盾有讀條，傷害招式可依預警走位或閃避。專屬插曲以時間、低血量或連擊壓力觸發，每局僅一次；它們同樣使用可讀的施放流程。

下表列出本次的完整人物範圍。每個來源欄只列第一筆公開母題，其他依據保留在資料檔 sources。

| 角色／職稱 | 人物技能 | 專屬插曲 | 公開母題 |
| --- | --- | --- | --- |
| 翅膀／執行長 | 黃金左腳、三樓震撼教育、全身檀香、需求再加一項、十分鐘相談 | 辦公椅的績效 | [events-quiz26-b.js](../dist/events-quiz26-b.js) · `q26-chair-left-shoe` |
| 屎潘蛇／董事長 | 世界第一版圖、四位數股價、成大校友圈、共同創辦人名片 | 股東會椅子不足 | [events-quiz26-b.js](../dist/events-quiz26-b.js) · `q26-spring-dinner-seats` |
| 法師／法務長 | 合約紅線、存證信函、逐條確認、簽名欄橫掃 | 三件套到齊 | [events-cast-v35-legal.js](../dist/events-cast-v35-legal.js) · `cast35-erich-legal-redline` |
| 阿福／MIS | 舊傷躺平、三片披薩補給、理由伯連發、未出賽世界冠軍、雞同鴨講 | 重大消息另行通知 | [events-video.js](../dist/events-video.js) · `video-pizza-overtime` |
| 真真／行政長 | 會議室俄羅斯方塊、總務鑰匙串、活動簽到盾 | 發票再跑一圈 | [events-backoffice-v28.js](../dist/events-backoffice-v28.js) · `admin28-room-tetris` |
| 瑞克／老闆乾兒子 | 電話請找傑克、特別任用、推播整包轉交、先說可以 | 兩人都沒參加的交接 | [events-jack.js](../dist/events-jack.js) · `jack-referral-loop` |
| 阿良／技術經理 | 阿良神秘行程、外套先到場、關鍵字先出海、下一攤補給 | 五十八度的續航測試 | [events-cast-v66.js](../dist/events-cast-v66.js) · `cast66-kind-coat-check` |
| 希望／HR長 | PIP 倒數表、學歷比對、面談結界、十分自評 | 標準下次再補 | [events-jack.js](../dist/events-jack.js) · `jack-pip-self-score` |
| 傑克／研發部經理 | 球場切入、會議筆記反擊、運動補水、First Love 申覆、API 額度上限 | 研發經理自評十分 | [events-jack.js](../dist/events-jack.js) · `jack-notebook` |
| 水蛇／業務經理 | First Love 搶麥、三百個客戶名單、全公司行銷、獎品已公告 | 決鬥影片改檔名 | [events-cast-v66.js](../dist/events-cast-v66.js) · `cast66-meimei-first-love-rematch` |
| 前女友／產品開發總監 | SQL 查詢波、產品開門、交接日期再延期 | 帳號不等於合約 | [events-chronicle-v22.js](../dist/events-chronicle-v22.js) · `helen-sql-masterclass` |
| 紅茶／稽核主管 | 紅茶補給、附件的附件、十八個杯子的盤點 | 印表機復活 | [events-backoffice-v28.js](../dist/events-backoffice-v28.js) · `accounting28-audit-breadcrumb` |
| 強哥／助理工程師 | 助理工程師防護罩、螳螂拳三問、十九點十分 | 閒暇時間做測試 | [events-colleagues-v23.js](../dist/events-colleagues-v23.js) · `jonathan-assistant-shield` |
| 歐文／商務開發總監 | 墨鏡轉向、三重跟進、豪車停車格 | 行事曆只寫聊聊 | [events-cast-v66.js](../dist/events-cast-v66.js) · `cast66-owen-meeting-sunglasses` |
| 山姆／資深資料探勘工程師 | 洋芋片補給、學碩連段、影集自動續播 | 瑜亮讀書會 | [events-colleagues-v23.js](../dist/events-colleagues-v23.js) · `sam-chip-study` |
| 辛蒂／資深專案管理師 | PM 駱駝負重、凌晨四點排程、交接文件盾 | 第五件事也歸她 | [events-quiz26-a.js](../dist/events-quiz26-a.js) · `quiz26-pm-camel` |
| 林老師／電機領域教授／產學顧問 | 半天顧問時段、電機名片盾、一整週的問題 | 顧問欄位沒有下班 | [events-professor-v37.js](../dist/events-professor-v37.js) · `professor37-half-day-queue` |
| 安妮余／商務開發助理 | 馬丁幫我、同名信件誤投、主管整季轉寄 | 六位中間人 | [events-cast-v39-annie.js](../dist/events-cast-v39-annie.js) · `cast39-annie_yu-martin-help` |
| 公主／資料探勘工程師 | Copilot 自動補字、機器人評審席、先跑測試 | 變數不會自動認親 | [events-cast-v39-princess.js](../dist/events-cast-v39-princess.js) · `cast39-princess-copilot-choice` |
| 914／業務總監 | 總監正式窗口、成交簡報、副本全體通知 | 獎金欄還沒出生 | [events-cast-v39-joyce.js](../dist/events-cast-v39-joyce.js) · `cast39-joyce-same-name` |
| Janet／財會主管 | 五千元核銷圈、憑證退件、白隊公費帳本、現金跑道 | 表單又改一版 | [events-cast-v39-janet.js](../dist/events-cast-v39-janet.js) · `cast39-janet-white-team-budget` |
| 船長／人資行政專員 | 十五座位結界、一點五星下午茶、全船集合、咖啡濃度試題 | 新航線另行通知 | [events-cast-v39-captain.js](../dist/events-cast-v39-captain.js) · `cast39-captain-room-capacity` |
| 201／教育訓練專家主管／福委會會長 | Outdoor 集合、培訓點名、福委會補給 | 冷凍麥克風 | [events-cast-v65.js](../dist/events-cast-v65.js) · `cast65-zoe-outdoor-mic` |
| 順哥／商務長 | 區塊鏈連線、高粱收藏盾、空白預算書、EMBA 連段 | Proof of 高粱 | [events-cast-v65.js](../dist/events-cast-v65.js) · `cast65-action-chain-whiteboard` |
| 海姐／業務總監 | EMBA 聯絡網、客戶範圍盾、追加需求潮 | 免費試點的下一步 | [events-cast-v65.js](../dist/events-cast-v65.js) · `cast65-hester-classmate-scope` |
| 丁哥／產品設計專員 | 還是第一版、Logo 再大一點、駱駝賽開跑、像素尺橫掃 | 全才副理十二合一 | [events-cast-v65.js](../dist/events-cast-v65.js) · `cast65-simon-version-one` |
| 詹姆士／回鍋同事 | 七進七出、歡迎餐補給、舊系統記憶 | 電腦也辦回鍋 | [events-cast-v65.js](../dist/events-cast-v65.js) · `cast65-james-seventh-login` |
| 強尼／專案管理師 | 多一格排程、半夜一個問號、會議紀錄盾 | 主管最後才知道 | [events-cast-v65.js](../dist/events-cast-v65.js) · `cast65-johnny-one-more-task` |
| 愛麗絲／移動手遊王 | 十連抽紙牌、保底補給、好友副本護盾、SSR 追加需求 | 又抽到同一通電話 | [events-alice-v71.js](../dist/events-alice-v71.js) · `alice71-first-pull` |
| 紅酒／系統工程師 | 讓它爆、系統重新啟動、值班通知 | Wine 還是 Wing | [events-cast-v74.js](../dist/events-cast-v74.js) · `cast74-wine-let-crash` |
| P神／助理工程師 | 快捷鍵十連發、遊戲更新護盾、鍵盤路過 | 計算機的一加一 | [events-cast74-peter.js](../dist/events-cast74-peter.js) · `cast74-peter-shortcut-macro` |
| 8+9／助理工程師 | 早餐揪團補給、江湖直球、五分鐘煙休 | 上一個 Tony 的信 | [events-cast-v74.js](../dist/events-cast-v74.js) · `cast74-tony-old-mail` |
| 老大／技術總監 | 架構箭頭重畫、三件最高優先、退役主機投影 | 三週改成三天 | [events-cast-v74.js](../dist/events-cast-v74.js) · `cast74-henry-arrow-edit` |
| 米雅／人資專員 | 報到名牌、本人同意盾、整本 FAQ | 先幫忙泡咖啡 | [events-cast-v74.js](../dist/events-cast-v74.js) · `cast74-mia-welcome-card` |

## 資料驗證

角色 ID 與 `ISLAND_CAST` 一一對應；技能與插曲 ID 在所有人物之間皆唯一。所有 profile、陣列與招式記錄皆凍結，未知 ID 安全回傳 `null`。資料檢查包含每人至少三招、至少兩類機制、非空開場白／提示／反制說明、有限數值與公開來源事件對應；實際施放、打斷、暫停、勝敗與畫面由對戰模型及整合測試驗證。
