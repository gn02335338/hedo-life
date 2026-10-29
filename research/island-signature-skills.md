# 移動島人物技能改編

移動島的 34 位官方對手共有 119 招人物技能與 34 段專屬戰鬥插曲。每人有開場白、至少三招技能與一段每局只會觸發一次的事件；翅膀、阿福、傑克各五招，阿良四招。技能與事件的數值只用在島上的即時對戰，不重寫人生故事、匿名史冊或歷史重播。

## 素材與改編範圍

這次以 repository 中已發布的問答題庫改編事件、史冊改編場景、角色日常與公開職稱為母題，另加入本次創作者指定的遊戲設定。技能資料整理未讀取原始私人題庫或私人史冊，也不將原始題庫、史冊、人物照片、管理網址、私人研究索引或逐字筆記發布至公開 repository。原始故事裡的工作流程、紙張、道具、台詞習慣，被重新寫成可走位與反制的卡通招式；並非將這些招式當成真實人物的行為紀錄。

技能資料與完整來源索引位於 [brawl-roster.js](../dist/island/brawl-roster.js)。每筆 sources 指向公開程式檔與既有事件 ID；角色職稱沿用 [persona.js](../dist/persona.js) 的公開顯示。

## Creator brief

- 翅膀的左腿較短、持拐杖，以及「黃金左腳」「三樓喊話」「檀香沐浴回血」是創作者本次指定的角色與戰鬥設定。左腳母題另可對照公開的 `q26-chair-left-shoe`。三樓招式在遊戲裡表現為紙板樓層與地面預警圈，角色透過走位閃開，不演出真實墜樓。
- 阿福低血時的「未開打先工傷」是本次指定的虛構防守技能，台詞只屬於遊戲角色，不作醫療診斷或真實健康斷言。披薩補給與腕力理由的母題可對照 `video-pizza-overtime`、`quiz26-arm-draw`。
- 傑克改穿黑色運動休閒 T 恤的外觀來自本次創作者提供的照片描述；對戰技能中的運動切入、補水與既有籃球生活母題共同改編。照片與其他入鏡者不隨此說明或公開 repository 發布。

## 戰鬥閱讀方式

技能分成近身揮擊、衝刺、飛行紙卡、地面範圍、回血、紙盾與減速七類。名稱與演出依人物不同，數值受統一上限限制。每招都有開招提示、施放台詞與反制說明；回血與紙盾有讀條，傷害招式可依預警走位或閃避。專屬插曲以時間、低血量或連擊壓力觸發，每局僅一次；它們同樣使用可讀的施放流程。

下表列出本次的完整人物範圍。每個來源欄只列第一筆公開母題，其他依據保留在資料檔 sources。

| 角色／職稱 | 人物技能 | 專屬插曲 | 公開母題 |
| --- | --- | --- | --- |
| 翅膀／執行長 | 黃金左腳、三樓人才自由落體、全身檀香、順便做到投胎、十分鐘無期徒談 | 椅子先過試用期 | [events-quiz26-b.js](../dist/events-quiz26-b.js) · `q26-chair-left-shoe` |
| 屎潘蛇／董事長 | 世界第一大餅墳場、四位數只剩密碼、校友護體免責圈、共同創辦共同超渡 | 股東站票黃泉號 | [events-quiz26-b.js](../dist/events-quiz26-b.js) · `q26-spring-dinner-seats` |
| 法師／法務長 | 生死狀修訂追蹤、掛號直達陰曹、條款長過你的命、此處簽名往生 | 離職三件套合體 | [events-cast-v35-legal.js](../dist/events-cast-v35-legal.js) · `cast35-erich-legal-redline` |
| 阿福／MIS | 未開打先工傷、三片披薩詐傷餐、輸不起無限續杯、未出賽世界冠軍、雞鴨同鍋 PIP | 重大消息胎死腹中 | [events-video.js](../dist/events-video.js) · `video-pizza-overtime` |
| 真真／行政長 | 會議室遺體拼圖、十八層地獄門禁、人沒到魂先簽 | 發票輪迴六道 | [events-backoffice-v28.js](../dist/events-backoffice-v28.js) · `admin28-room-tetris` |
| 瑞克／老闆乾兒子 | 有事傑克沒事乾爹、血統防火牆、推播遺產稅、先上線再上香 | 雙方缺席交接法會 | [events-jack.js](../dist/events-jack.js) · `jack-referral-loop` |
| 阿良／技術經理 | 阿良帶路人間蒸發、外套代打招魂術、SEO 陰間關鍵字、續攤續到投胎 | 五十八度靈魂出竅 | [events-cast-v66.js](../dist/events-cast-v66.js) · `cast66-kind-coat-check` |
| 希望／HR長 | PIP 頭七倒數、學歷驗屍報告、小房間告別式、十分自評百分送終 | 死因日後補件 | [events-jack.js](../dist/events-jack.js) · `jack-pip-self-score` |
| 傑克／研發部經理 | 球鞋先走靈魂加班、會議紀錄迴力鏢、加班遺體補水、First Love 死不瞑目、API 帳單招魂盾 | 九十分失蹤人口 | [events-jack.js](../dist/events-jack.js) · `jack-notebook` |
| 水蛇／業務經理 | First Love 奪魂麥、三百名單百鬼夜行、行銷部全員冥職、獎品紙紮先到貨 | 勝負未定檔名先贏 | [events-cast-v66.js](../dist/events-cast-v66.js) · `cast66-meimei-first-love-rematch` |
| 前女友／產品開發總監 | SELECT 全體背鍋、開門算一版產品、交接延到七月半 | 離職帳號借屍還魂 | [events-chronicle-v22.js](../dist/events-chronicle-v22.js) · `helen-sql-masterclass` |
| 紅茶／稽核主管 | 紅茶超渡點心、附件子子孫孫、二十杯失蹤兩魂 | 印表機冥婚再開機 | [events-backoffice-v28.js](../dist/events-backoffice-v28.js) · `accounting28-audit-breadcrumb` |
| 強哥／助理工程師 | 助理工程師免死牌、螳螂拳靈魂三問、十九點十分斷魂腳 | 閒暇時間服勞役 | [events-colleagues-v23.js](../dist/events-colleagues-v23.js) · `jonathan-assistant-shield` |
| 歐文／商務開發總監 | 墨鏡一戴方向重開、跟進跟到頭七、豪車先佔骨灰位 | 聊聊聊到往生 | [events-cast-v66.js](../dist/events-cast-v66.js) · `cast66-owen-meeting-sunglasses` |
| 山姆／資深資料探勘工程師 | 洋芋片靈壓補給、學士碩士壓棺石、下一集自動送終 | 既生瑜何生 KPI | [events-colleagues-v23.js](../dist/events-colleagues-v23.js) · `sam-chip-study` |
| 辛蒂／資深專案管理師 | PM 駱駝壓棺拳、凌晨四點催魂鐘、交接文件墓誌銘 | 四大天王第五具 | [events-quiz26-a.js](../dist/events-quiz26-a.js) · `quiz26-pm-camel` |
| 林老師／電機領域教授／產學顧問 | 半天顧問七天供奉、電機名片鎮魂牌、問題單排到來世 | 顧問靈位全年在線 | [events-professor-v37.js](../dist/events-professor-v37.js) · `professor37-half-day-queue` |
| 安妮余／商務開發助理 | 馬丁救我三連咒、同名同姓不同命、整季轉寄往生包 | 六道中間人輪迴 | [events-cast-v39-annie.js](../dist/events-cast-v39-annie.js) · `cast39-annie_yu-martin-help` |
| 公主／資料探勘工程師 | Copilot 幻覺遺囑、機器人代班公祭、測試全紅靈堂燈 | 變數不繼承家譜 | [events-cast-v39-princess.js](../dist/events-cast-v39-princess.js) · `cast39-princess-copilot-choice` |
| 914／業務總監 | 正式窗口鬼打牆、成交喜報未收款、CC 全體送肉粽 | 獎金胎教中 | [events-cast-v39-joyce.js](../dist/events-cast-v39-joyce.js) · `cast39-joyce-same-name` |
| Janet／財會主管 | 五千核銷地獄門、憑證投胎重新來、白隊帳本照妖鏡、現金跑道直達陰間 | 表單十八層還魂 | [events-cast-v39-janet.js](../dist/events-cast-v39-janet.js) · `cast39-janet-white-team-budget` |
| 船長／人資行政專員 | 十五椅二十五魂、一點五星米其靈、全船集合渡亡魂、咖啡濃到寫遺書 | 泰坦尼克臨時改線 | [events-cast-v39-captain.js](../dist/events-cast-v39-captain.js) · `cast39-captain-room-capacity` |
| 201／教育訓練專家主管／福委會會長 | Outdoor 團體招魂、培訓簽到魂未到、福委會回魂包 | 冷凍麥克風告別式 | [events-cast-v65.js](../dist/events-cast-v65.js) · `cast65-zoe-outdoor-mic` |
| 順哥／商務長 | 區塊鏈骨牌靈堂、高粱年份比營收老、白皮書紙錢炮、EMBA 同學超渡會 | Proof of 往生 | [events-cast-v65.js](../dist/events-cast-v65.js) · `cast65-action-chain-whiteboard` |
| 海姐／業務總監 | EMBA 百鬼通訊錄、承諾切割太平間、需求海嘯送終潮 | 免費試點試到頭七 | [events-cast-v65.js](../dist/events-cast-v65.js) · `cast65-hester-classmate-scope` |
| 丁哥／產品設計專員 | 第八版回魂第一版、Logo 巨到蓋棺、駱駝馱著需求跑、像素級開棺驗稿 | 一份薪水十二牌位 | [events-cast-v65.js](../dist/events-cast-v65.js) · `cast65-simon-version-one` |
| 詹姆士／回鍋同事 | 七進七出回魂術、歡送歡迎同一鍋、舊系統託夢 | 電腦比本人更長壽 | [events-cast-v65.js](../dist/events-cast-v65.js) · `cast65-james-seventh-login` |
| 強尼／專案管理師 | 排程骨灰再加一格、半夜問號催魂符、會議紀錄鎮魂牆 | 主管最後收訃聞 | [events-cast-v65.js](../dist/events-cast-v65.js) · `cast65-johnny-one-more-task` |
| 愛麗絲／移動手遊王 | 十連抽十張工單、保底不保命、好友共赴黃泉本、SSR 稀有背鍋位 | 瑞克三幻神召喚 | [events-alice-v71.js](../dist/events-alice-v71.js) · `alice71-first-pull` |
| 紅酒／系統工程師 | 讓它爆全村吃席、重開機借屍還魂、On-call 頭七守靈 | Wine 誤收聖旨 | [events-cast-v74.js](../dist/events-cast-v74.js) · `cast74-wine-let-crash` |
| P神／助理工程師 | 快捷鍵超渡十連、遊戲更新免死金牌、鍵盤路過案發現場 | 一加一開壇驗算 | [events-cast74-peter.js](../dist/events-cast74-peter.js) · `cast74-peter-shortcut-macro` |
| 8+9／助理工程師 | 早餐先吃壓驚飯、江湖直球超渡拳、煙休五分鐘還魂 | 前任 Tony 陰魂信 | [events-cast-v74.js](../dist/events-cast-v74.js) · `cast74-tony-old-mail` |
| 老大／技術總監 | 架構圖死後重畫、三件最急三柱香、退役主機英靈召喚 | 三週三天陰陽曆 | [events-cast-v74.js](../dist/events-cast-v74.js) · `cast74-henry-arrow-edit` |
| 米雅／人資專員 | 報到名牌生死簿、客氣不等於賣身契、FAQ 陰陽百科 | 人資兼任孟婆湯 | [events-cast-v74.js](../dist/events-cast-v74.js) · `cast74-mia-welcome-card` |

## 資料驗證

角色 ID 與 `ISLAND_CAST` 一一對應；技能與插曲 ID 在所有人物之間皆唯一。所有 profile、陣列與招式記錄皆凍結，未知 ID 安全回傳 `null`。資料檢查包含每人至少三招、至少兩類機制、非空開場白／提示／反制說明、有限數值與公開來源事件對應；實際施放、打斷、暫停、勝敗與畫面由對戰模型及整合測試驗證。

## v75 戰鬥演出與台詞

119 招公開人物技能、34 段專屬插曲，以及隱藏對手的六招與兩段插曲，共 161 段名稱／出招台詞重新改寫成職場黑色幽默。數值、技能 ID、讀條、冷卻與觸發規則維持原樣，採用上述已發布的事件母題，不新增私人研究來源。

招式名稱改在畫布上方獨立顯示：手機為 26–34px、桌面為 29–44px，不隨競技場比例縮小。蓄招時持續顯示名稱、台詞、反制方式與進度條；完成、打斷及玩家無雙各有對應狀態。新增短暫人物切入、速度線、斬擊弧線、命中星芒與氣勢光環；減少動態模式停止切入動畫、震動及轉動。全部效果由目前戰鬥狀態推導，不另設持續粒子或改寫戰鬥勝負。

`mountIslandBrawl` 可選擇注入相同介面的 `model`，結束回呼第三個參數讀取 `model.getProof?.()`，讓人生單挑共用同一套演出並由既有重播流程驗證操作。一般島上對戰仍使用原本的預設模型。

驗證：`node --test tests/island-brawl*.test.mjs tests/island-hidden-boss.test.mjs`；新增標題測試驗證實際蓄招、完成與破招狀態，保留所有可操作技能及鍵盤／觸控測試。
