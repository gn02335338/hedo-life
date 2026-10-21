// Satirical adaptation of private recollections. Every Wing line, choice and outcome
// is original fictional dialogue; sourceIds identify inspiration, never verified accusations.
import { IMAGE_EVENTS } from './events-images.js';
import { VIDEO_EVENTS } from './events-video.js';
import { CAREER_DAILY_EVENTS } from './career.js';
import { DEPARTURE_EVENTS } from './events-departures.js';
import { ADVISOR_EVENTS } from './events-advisor.js';
import { JACK_EVENTS } from './events-jack.js';
import { MEIMEI_EVENTS } from './events-meimei-v20.js';
import { CHRONICLE_EVENTS_V22 } from './events-chronicle-v22.js';
import { COLLEAGUE_EVENTS_V23 } from './events-colleagues-v23.js';
import { QUIZ_EVENTS_V26_A } from './events-quiz26-a.js';
import { QUIZ_EVENTS_V26_B } from './events-quiz26-b.js';
import { COMMERCIAL_EVENTS_V21 } from './events-commercial-v21.js';
import { DESIGN_EVENTS_V21 } from './events-design-v21.js';
import { PROFESSION_EVENTS_V21 } from './events-professions-v21.js';
import { BACKOFFICE_EVENTS_V28 } from './events-backoffice-v28.js';
const choice = (text, detail, result, delta, flags = []) => ({ text, detail, result, delta, flags });

export const EVENTS = [
  {
    id: 'meeting-ten-minutes', title: '十點二十七分：準備一下十點半的報告', era: '日常・即時發瘋', sourceIds: ['meeting'], weight: 1.4,
    body: '通知跳出來時，你連今天的咖啡都還沒喝。上週已解決的資料庫容量，又被放回議程，彷彿它是公司唯一會準時上班的問題。',
    wing: '三分鐘準備不夠？你不是每天都在做，還需要準備？',
    choices: [
      choice('打開上週的報告，只改日期。', '複製貼上也是一種永續經營。', 'Wing 說這次有進步。你把這句話也複製進下週的備忘錄。', { slack: 9, boss: 8, mood: -5, skill: -3 }, ['loop']),
      choice('投影已結案的紀錄，逐條核對。', '資料會說話，但不一定會拍馬屁。', '同事在桌下比讚。Wing 問你是不是很喜歡糾正人。', { skill: 8, trust: 8, boss: -16, energy: -7 }, ['evidence']),
      choice('先讚美願景，再宣布需要更多人。', '用他喜歡的開場，講他不喜歡的內容。', '你得到一句「要學會用有限資源創造無限可能」。有限的是資源，無限的是加班。', { lick: 8, boss: 6, dream: -8, mood: -7 })
    ]
  },
  {
    id: 'cloud-attachment', title: '雲端化，請寄附件', era: '日常・數位轉型', sourceIds: ['cloud'],
    body: '你把最新文件放上雲端，連權限都逐一確認。五分鐘後，Wing 要你寄 Excel；十分鐘後，他質問為什麼手上的附件不是最新版本。',
    wing: '雲端是公司的方向，不是你不寄附件的藉口。',
    choices: [
      choice('維護雲端與附件兩套版本。', '用你的時間解決平行宇宙。', '版本暫時一致了，你的人生進度則落後一個晚上。', { boss: 11, skill: 3, energy: -13, mood: -8 }),
      choice('訂一個唯一版本，拉同事一起用。', '先讓真正要做事的人找得到東西。', '同事開始少問幾次「最新版在哪」。Wing 覺得你擅自制定公司制度。', { skill: 10, trust: 9, boss: -13, energy: -5 }, ['evidence']),
      choice('把附件命名為「Wing親自指定版」。', '尊重每一份偉大的檔名。', '沒有人敢改它。你用檔名成功建立了一個讀取鎖。', { lick: 10, slack: 5, boss: 9, dream: -5 })
    ]
  },
  {
    id: 'bing-rumor', title: '聽說有一個免費的商業版', era: '日常・網路傳說', sourceIds: ['bing'],
    body: 'Wing 帶來一則沒有連結、沒有日期、沒有價格的產品消息。這則消息已經被排進你本週交付清單，查證成本則尚未被承認存在。',
    wing: '我都聽說有了，你查不到，是不是搜尋能力有問題？',
    choices: [
      choice('先說「可以研究」，多爭取一天。', '承諾用最小字級顯示。', 'Wing 覺得你態度很好，明天的你收到今天的你寄來的爛攤子。', { boss: 10, lick: 6, energy: -6, mood: -8 }, ['loop']),
      choice('整理官方說明與詢價紀錄。', '留存你真的查過的證據。', '你確定了方案條件。Wing 說他要的是解法，不是這麼多資訊。', { skill: 9, trust: 5, boss: -13, energy: -8 }, ['evidence']),
      choice('請他把消息轉給你，一起問窗口。', '把傳說拉回有網址的世界。', '訊息停在「我找一下」。你獲得罕見的安靜，以及一筆未結的老闆情緒帳。', { slack: 7, energy: 7, boss: -17, mood: 4 })
    ]
  },
  {
    id: 'blame-debate', title: '禾多辯論社：誰動了我的素材', era: '日常・責任追蹤', sourceIds: ['debate'], weight: 1.3,
    body: '素材上錯了，現在最重要的事情是找到一個可以被寫進群組的人。修正按鈕就在眼前，會議卻已經開了四十分鐘。',
    wing: '我不是在追究責任，我只是要知道到底是誰的問題。',
    choices: [
      choice('先幫同事修，再共同整理時間線。', '救火跟留證據都要做。', '頁面恢復正常，同事記住了你的名字。Wing 嫌你們浪費時間互相包庇。', { trust: 14, skill: 7, energy: -11, boss: -9 }, ['evidence']),
      choice('高聲附和「流程真的需要改善」。', '不說人名，也不說是哪個流程。', '你被稱讚有管理思維。問題被移到下一場改善會議。', { lick: 10, boss: 10, trust: -6, dream: -5 }, ['loop']),
      choice('亮出版本紀錄，指出拍板的那一刻。', '提交紀錄不會看人臉色。', '會議室忽然比機房還冷。Wing 說不要執著於過去。', { skill: 6, trust: 7, boss: -23, mood: 6 }, ['archive', 'evidence'])
    ]
  },
  {
    id: 'english-class', title: '主管會議，突然考英文', era: '日常・國際接軌', sourceIds: ['english'],
    body: '你準備了進度、風險與預算。投影幕上的一條紅色拼字底線，成功讓所有內容暫停營業。',
    wing: '連這個英文都不會，之後去美國敲鐘怎麼辦？',
    choices: [
      choice('把部門名稱換成縮寫。', '三個字母，四種可能，無限解釋空間。', 'Wing 點頭表示專業。同事開始問你這到底是哪一組。', { slack: 8, boss: 7, skill: -3, trust: -3 }),
      choice('先認錯，把技術風險留在書面。', '尊嚴暫存，紀錄存檔。', '英文課順利結束。你替真正的問題留下了時間戳記。', { lick: 5, boss: 8, mood: -9, skill: 5 }, ['evidence']),
      choice('邀大家一起確認正確拼字。', '知識可以共同更新，面子未必。', '你得到了正確答案，還附贈 Wing 的一句「你很愛辯」。', { skill: 7, trust: 7, boss: -18, mood: 3 })
    ]
  },
  {
    id: 'transcript-speaker', title: '語者一說：我沒說過', era: '日常・逐字稿法庭', sourceIds: ['transcripts'],
    body: '自動逐字稿把所有人分成語者一和語者二。昨天的指令今天被否認，語音模型第一次比人類還確定自己聽到了什麼。',
    wing: 'AI 也會幻覺啊，你怎麼只相信對你有利的那一句？',
    choices: [
      choice('把整份紀錄匿名整理好。', '史官只負責保存，不負責大家想不想看。', '你存下了版本與上下文。未來的同事會感謝現在被嫌太閒的你。', { trust: 9, skill: 5, energy: -8, boss: -9 }, ['archive', 'evidence']),
      choice('依照今天的說法，修訂昨日結論。', '讓時間服從組織架構。', 'Wing 認為溝通終於對齊了。你的記憶體裡多了一筆不可回收的垃圾。', { boss: 13, lick: 9, mood: -12, dream: -7 }, ['loop']),
      choice('關掉錄音，去倒一杯水。', '至少這杯水沒有版本衝突。', '你錯過了第四次改口。回座時大家正在討論要不要再開一次會。', { energy: 8, slack: 8, boss: -7, skill: -3 })
    ]
  },
  {
    id: 'dinner-budget', title: '願景無上限，肉片有配額', era: '日常・感恩餐會', sourceIds: ['budget', 'spring'],
    body: '投影片裡的全球版圖持續擴張，桌上的肉盤則持續萎縮。你伸手想加點時，整桌第一次聽見清楚而具體的數字：預算有限。',
    wing: '創業公司要有共體時艱的精神，你怎麼只想到吃？',
    choices: [
      choice('主動幫老闆夾最後一片肉。', '把蛋白質轉換成政治資本。', 'Wing 稱讚你會照顧人。同事端著白飯對你露出一個很完整的微笑。', { boss: 13, lick: 11, trust: -11, energy: -4 }),
      choice('自掏腰包，和同事買宵夜。', '胃的幸福可以先自行上市。', '路邊攤沒有企業願景，卻有人問你要不要加蛋。', { cash: -9, energy: 10, mood: 12, trust: 12 }),
      choice('把敲鐘夢與空盤拍進同一張照片。', '畫面需要一個有力的對照。', '你得到一張不需要文字的史料。Wing 問你為什麼吃飯也在滑手機。', { slack: 5, trust: 6, boss: -12, mood: 4 }, ['archive'])
    ]
  },
  {
    id: 'bell-before-product', title: '產品還沒穩，敲鐘姿勢先練', era: '日常・大夢進度', sourceIds: ['dream', 'spring'], weight: 1.2,
    body: '會議討論從這季產品跳到納斯達克合照站位。你的待辦清單裡有三個重大缺陷，老闆的待辦清單裡有一條紅色領帶。',
    wing: '不要一直講眼前的小問題，我們的格局要放到全世界。',
    choices: [
      choice('替敲鐘日倒排產品與財務里程碑。', '把宇宙級願景接回地面插座。', '清單寫到第三行時，Wing 就說你把事情想得太複雜。你至少知道缺哪幾塊了。', { skill: 10, energy: -8, boss: -12, dream: 5 }, ['global', 'evidence']),
      choice('認真排演上台微笑，喊一聲相信。', '先把最容易交付的部分交付。', '全場掌聲屬於未來的市值，今天的問題留給安靜的人。', { boss: 15, lick: 12, dream: 9, trust: -8, skill: -4 }, ['global', 'allin']),
      choice('說台灣市場做穩，也值得敲一聲。', '鐘可以遠，客戶就在眼前。', '同事對你點頭。Wing 說你志向太小，你開始懷疑「小」是不是「可執行」的同義詞。', { trust: 8, skill: 6, mood: 4, boss: -14, dream: -6 }, ['taiwan'])
    ]
  },
  {
    id: 'help-at-six', title: '18:45，救火的人又是同事', era: '日常・人還是好的', sourceIds: ['care'],
    body: '你卡在一個故障，群組裡最會問進度的人已經安靜。正準備離開的同事看了一眼訊息，折返回來替你多留了一盞燈。',
    wing: '互相幫忙很好，但明天不要拿這個當進度落後的理由。',
    choices: [
      choice('一起修完，明天把功勞寫清楚。', '努力不是老闆獨資的成果。', '你們把問題解掉了，也約好下次換你留下。這筆人情至少有具體的債權人。', { trust: 15, skill: 7, energy: -12, mood: 7 }, ['evidence']),
      choice('謝謝他，先訂明天可以接續的步驟。', '互助可以有收工時間。', '你們帶著未解的工單下班，帶著還能用的腦袋回家。', { energy: 12, mood: 9, trust: 6, boss: -10 }),
      choice('回報老闆：我已經把事情處理好了。', '一句「我」能省掉很多名字。', 'Wing 說你最近扛得住。身旁的同事默默把外套穿好。', { boss: 13, lick: 6, trust: -20, mood: -7 })
    ]
  },
  {
    id: 'farewell-chair', title: '座位還熱，人已經離職', era: '日常・人力輪迴', sourceIds: ['departures'],
    body: '隔壁同事的椅子還停在熟悉的高度，名字已經從群組消失。交接表在你桌上展開，像一張沒有加薪的升職通知。',
    wing: '他留下來的東西你接一下，很簡單，不要想得太嚴重。',
    choices: [
      choice('把缺口與接手範圍列成清單。', '「一下」要有終點。', '你替自己畫出邊界。Wing 覺得你對工作太計較，同事卻終於知道誰在做什麼。', { skill: 8, trust: 7, boss: -15, energy: -5 }, ['evidence']),
      choice('拍胸脯全接，賭一個升職機會。', '用未來的職稱貸款今天的體力。', 'Wing 說這才是主管思維。你開始同時過兩個人的工作日。', { boss: 15, lick: 6, skill: 5, energy: -19, mood: -13 }, ['allin']),
      choice('留下歡送留言，私下交換聯絡方式。', '人離開公司，情義不用跟著退群。', '一個新群組成立了。群組名稱很普通，裡面的笑話很不普通。', { trust: 13, mood: 9, boss: -6, dream: -5 }, ['archive'])
    ]
  },
  {
    id: 'first-day-map', title: '新人報到，先教逃生路線', era: '日常・員工旅程', sourceIds: ['quickExit', 'labor'],
    body: '新人問公司文化，你與同事同時吸了一口氣。歡迎簡報寫著自由開放，你手上則有一份實際任務與職缺說明的差異表。',
    wing: '不要把你自己的負面情緒傳染給新人，人家是來學習的。',
    choices: [
      choice('只講好處，壞處讓他自行發現。', '招募體驗由你暫時維護。', 'Wing 稱讚你有團隊意識。新人將來會用同一句話問你為什麼沒說。', { boss: 10, lick: 8, trust: -10, mood: -6 }),
      choice('帶他認識會救火的同事與實際工作。', '不替別人決定，但提供地圖。', '新人少走幾條冤枉路。你的同事網絡多了一個還沒被會議磨平的節點。', { trust: 13, skill: 5, energy: -6, boss: -10 }, ['evidence']),
      choice('送他一本空白筆記：自己的事自己記。', '入職贈品：史料意識。', '第一頁寫下「今天說好做什麼」。你看見了下一任史官的幼苗。', { trust: 8, mood: 6, dream: -4, boss: -5 }, ['archive'])
    ]
  },
  {
    id: 'private-coffee', title: '私人會議，公共時間', era: '日常・咖啡會議', sourceIds: ['coffee'],
    body: '行事曆出現一場沒有議程的私人會議。你帶著筆電走進去，發現主題是喝咖啡，以及為什麼你最近看起來沒有熱情。',
    wing: '我都花時間跟你聊了，你應該感受到公司很重視你。',
    choices: [
      choice('說最近在思考怎麼替公司創造更大價值。', '用一團大話擋住一團大話。', '你們的對話互相沒有碰到地面，卻成功結束了。', { lick: 10, boss: 11, mood: -6, energy: -4 }),
      choice('提出明確工作量與休息需求。', '把關心換算成可執行事項。', 'Wing 說大家都很忙。至少你知道這杯咖啡沒有附帶解法。', { mood: 8, skill: 4, boss: -18, dream: -7 }, ['evidence']),
      choice('把這段時間算成行事曆裡的正式會議。', '私人感情，公務時數。', '你的進度延後有了正式原因。Wing 看見標題後，表情比美式咖啡還濃。', { slack: 8, energy: 5, boss: -13, mood: 4 }, ['archive'])
    ]
  },
  {
    id: 'meme-archive', title: '黑糖饅頭，不是員工福利', era: '日常・地下文藝', sourceIds: ['bun'],
    body: '同事丟來一張辦公室反應梗圖，沒有任何人需要解釋。你笑得差點把水噴到鍵盤上，恰好 Wing 從後方經過。',
    wing: '什麼事情這麼好笑？有這個時間怎麼不想想業績？',
    choices: [
      choice('切回滿版進度表，面無表情。', 'Alt＋Tab 是一項可轉移技能。', '你成功把笑意壓回去。偷懶技巧提升，腹肌也獲得一點訓練。', { slack: 12, mood: 7, energy: 4, boss: -3 }),
      choice('說在整理團隊情緒素材。', '連笑話都要包成管理提案。', 'Wing 要你下週報告團隊文化。這張圖突然需要付出十頁簡報的代價。', { lick: 7, boss: 8, energy: -10, mood: -5 }),
      choice('私下保存，標上日期與情境。', '不要讓共同語言只活在聊天室。', '你收進史冊的是一張梗圖，以及一群人還願意一起笑的證明。', { trust: 10, mood: 8, boss: -8 }, ['archive'])
    ]
  },
  {
    id: 'boss-weather', title: '今日公司氣象：局部暴怒', era: '日常・情緒管理', sourceIds: ['meeting'], weight: 1.4,
    body: 'Wing 早上進門沒有打招呼。全公司同時降低鍵盤音量，彷彿工作能力可以靠分貝調整。',
    wing: '大家這麼安靜，是不是沒事情做？',
    choices: [
      choice('找一個小成果給他看，再開始正事。', '先把氣壓拉回可工作範圍。', 'Wing 的眉頭鬆了一格。你學會了為別人的情緒付過路費。', { boss: 14, lick: 8, energy: -6, mood: -6 }),
      choice('照排程工作，不猜臉色。', '今天的需求單裡沒有氣象預報。', '你的工作有進度，Wing 的不滿也有。兩條曲線沒有互相尊重。', { skill: 10, mood: 5, boss: -19, energy: -5 }),
      choice('提醒同事今天先把紀錄留好。', '低氣壓時，加強防災。', '幾個人默默點頭。你不是管理職，卻完成了今天最實際的管理工作。', { trust: 10, slack: 5, boss: -8, dream: -5 }, ['evidence'])
    ]
  },
  {
    id: 'reply-weekend', title: '週六 23:48：在嗎', era: '原創・訊息禮貌', sourceIds: [], minTurn: 3,
    body: '手機亮起，只有兩個字，沒有事情。你盯著「在嗎」，它盯著你的週末，雙方都不肯先交代目的。',
    wing: '我只是問一下，你沒有必要把上下班分得這麼清楚。',
    choices: [
      choice('週一再回，先睡覺。', '電池可以充，人也可以。', '你得到完整的睡眠，以及週一早上那句熟悉的「你最近態度有問題」。', { energy: 15, mood: 13, boss: -19, dream: -3 }),
      choice('秒回，順便報告今天想到的新點子。', '把生活時間投入情緒基金。', 'Wing 說你很有心，然後開始打字。這場對話還沒有打算收盤。', { boss: 17, lick: 10, energy: -15, mood: -13 }, ['allin']),
      choice('回「請問什麼事」，先不承諾交期。', '用一句完整問句換取具體名詞。', '對方已讀十分鐘，最後回了「明天再說」。你失去一小塊週末，保住剩下的大部分。', { boss: -8, mood: 5, energy: 5, skill: 4 }, ['evidence'])
    ]
  },
  {
    id: 'invisible-effort', title: '做完不算，讓他看見才算', era: '原創・績效展示', sourceIds: [],
    body: '你的任務全數完成，卻被問最近到底有沒有在做事。隔壁每天都喊很忙的人，被讚是公司不可或缺的主力。',
    wing: '成果我沒看到就是沒有，你要學會讓主管放心。',
    choices: [
      choice('把成果做成可追蹤的週報。', '多一道行政程序，少一點口說無憑。', '工作第一次有了能被看懂的外殼。你也失去一個本來可以不加班的晚上。', { skill: 8, boss: 9, energy: -10, mood: -4 }, ['evidence']),
      choice('每天皺眉走快一點，會議多說三次很趕。', '表演課，正式開課。', 'Wing 說你終於進入狀況。同事問你的複製貼上為何需要全力衝刺。', { slack: 13, boss: 11, trust: -7, skill: -4 }),
      choice('只交付成果，把下班時間留給自己。', '薪水買的是工作，不是愁眉苦臉。', '你的作品穩定，你的風評變成「太輕鬆」。回家的路倒是準時。', { skill: 6, mood: 11, energy: 8, boss: -17 })
    ]
  },
  {
    id: 'raise-title-only', title: '你升格了，薪水還在孵化', era: '原創・職涯發展', sourceIds: [], minTurn: 5,
    body: 'Wing 說你最近值得被看見，打算讓你先承擔更大的責任。薪資調整被安排在「公司穩定之後」，這個日期已經比產品還難上線。',
    wing: '你怎麼一談成長就只想到錢？先證明你值得啊。',
    choices: [
      choice('欣然接下，把更多責任當面試素材。', '名片升級，履歷也同步升級。', '你拿到新任務與好聽的期待。回家後，你把可量化成果寫進自己的檔案。', { boss: 12, skill: 9, energy: -13, mood: -7 }, ['evidence']),
      choice('請他確認職責、調薪幅度與生效時間。', '成長可以寫進條款。', 'Wing 說你太現實。你發現現實剛好是每個月房租會使用的貨幣。', { cash: 5, mood: 7, boss: -19, skill: 5 }, ['evidence']),
      choice('回「謝謝栽培」，先不接沒有範圍的新工作。', '禮貌與實際行為分開部署。', 'Wing 聽到了想聽的話。你用一份排滿的時程表，讓新責任在門口候位。', { lick: 9, slack: 8, boss: 5, trust: -4 })
    ]
  },
  {
    id: 'deadline-yesterday', title: '這個昨天就應該好了', era: '原創・相對論', sourceIds: [],
    body: '需求今天第一次出現，交期卻被描述成昨天。你開始懷疑公司是否真的掌握了時光旅行，只是不打算編列研發預算。',
    wing: '我上次不是有提過？不能每件事都等我講得很清楚吧。',
    choices: [
      choice('縮小範圍，交一個可用版本。', '先救必要功能，犧牲華麗幻想。', '東西能動了。Wing 問你為什麼跟他心裡的完整版本不一樣。', { skill: 11, trust: 5, energy: -10, boss: -7 }),
      choice('承諾今晚完成，賭一次奇蹟。', '把自己當成尚未折舊的伺服器。', 'Wing 心情轉晴。你晚餐的熱度與自己的心情，同時轉成冰點。', { boss: 16, energy: -20, mood: -15, skill: 4 }, ['allin']),
      choice('貼出需求第一次出現的時間。', '時光旅行要附實驗紀錄。', '對話安靜了一秒。Wing 說不要一直抓字眼，要有解決問題的態度。', { mood: 6, trust: 6, boss: -24, slack: 3 }, ['evidence'])
    ]
  },
  {
    id: 'meeting-loop', title: '會前會的會後檢討會', era: '原創・行政永動機', sourceIds: ['meeting'], minTurn: 3,
    body: '本週進度落後，原因是會議太多。Wing 決定召開一場會議，討論如何提高開會效率，並要求大家先開小組會統一意見。',
    wing: '溝通是為了省時間，你們不要連這點時間都不願意付出。',
    choices: [
      choice('用十分鐘寫好決策清單，提早散會。', '用文字終結一場聲音的馬拉松。', '同事得到了一小段可工作的下午。Wing 覺得你在催他。', { trust: 12, skill: 8, energy: 7, boss: -15 }, ['evidence']),
      choice('每段都補一句「我完全認同」。', '讓會議有回音，讓主管有知音。', 'Wing 覺得今天討論品質很好。議程多延長了半小時。', { boss: 13, lick: 10, energy: -9, trust: -7 }, ['loop']),
      choice('邊聽邊完成自己的事。', '雙核心處理，單核心薪水。', '你的工單少了兩張，被點名時則多了一句「不好意思再說一次」。', { slack: 10, skill: 5, boss: -9, mood: 4 })
    ]
  },
  {
    id: 'credit-parade', title: '成功是領導，失敗是執行', era: '原創・功勞會計', sourceIds: [], minTurn: 4,
    body: '專案成功，外部簡報上出現了「在 Wing 的帶領下」。上次專案延誤時，簡報上寫的是你的全名。',
    wing: '團隊成果不用分那麼細，大家都知道我是怎麼帶你們的。',
    choices: [
      choice('私下整理同事貢獻，寫進結案紀錄。', '功勞不必搶，也不能憑空蒸發。', '名字被留在文件裡。Wing 說你文件太長，同事卻把連結存了起來。', { trust: 13, skill: 6, energy: -7, boss: -10 }, ['archive', 'evidence']),
      choice('公開謝謝 Wing，跟著站到合照前排。', '既然照片會流傳，至少露個臉。', 'Wing 對你點頭。後排的工程師開始研究照片裁切工具。', { boss: 14, lick: 12, trust: -13, dream: -5 }),
      choice('把自己的成果放進個人作品集。', '公司有品牌，你也有名字。', '你留下一份可攜帶的證明。有人看見了你的工作，不一定是這間公司的人。', { skill: 10, mood: 10, boss: -12, energy: -5 }, ['evidence'])
    ]
  },
  {
    id: 'feedback-survey', title: '匿名問卷，請填部門與職稱', era: '原創・暢所欲言', sourceIds: [], minTurn: 3,
    body: '公司發送員工心聲問卷，宣稱完全匿名。你的部門只有你一個人，必填欄位還有到職日與目前專案。',
    wing: '我們很開放，有意見就講，不要在背後抱怨。',
    choices: [
      choice('全填非常滿意，再去跟同事吃飯。', '讓表格幸福，讓真人獲得支持。', '報表顯示滿意度創新高。餐桌上的真實數據則由口耳相傳維護。', { boss: 8, trust: 8, mood: 5, dream: -8 }),
      choice('只寫一項可驗證的流程問題。', '具體到可以改善，也具體到可以認出你。', 'Wing 約你談話，主題是為什麼你只看到負面。問題本人沒有被邀請。', { skill: 5, trust: 7, boss: -21, mood: -5 }, ['evidence']),
      choice('寫三百字感謝公司栽培。', '問卷也可以是競選文宣。', '你的內容被當成公司文化案例朗讀。你努力不和旁邊同事對到眼。', { lick: 14, boss: 13, trust: -12, mood: -7 })
    ]
  },
  {
    id: 'expense-delay', title: '公司的費用，個人的分期', era: '原創・現金管理', sourceIds: [], minTurn: 3,
    body: '你墊付了專案費用，報銷流程正在層層審核。Wing 問你為什麼工具還沒續訂，你看著信用卡帳單，覺得自己有點像沒有牌照的創投。',
    wing: '才這一點錢，你先處理不就好了？不要影響公司進度。',
    choices: [
      choice('再墊一次，先保住專案。', '這輪投資沒有股權，只有收據。', '服務不中斷，Wing 很滿意。你的存款替公司增加了一點跑道。', { cash: -15, boss: 14, trust: 5, mood: -9 }, ['allin']),
      choice('彙整收據，要求先結清再續訂。', '讓公司的帳回到公司手上。', '你終於拿到一個付款時間。Wing 覺得你不夠有主人翁精神。', { cash: 8, skill: 5, boss: -18, mood: 6 }, ['evidence']),
      choice('和同事找一個暫時可用的免費方案。', '用技術換取不刷卡的權利。', '服務勉強運作，你們多做了半天轉換。世界上沒有免費午餐，但有免費加班。', { trust: 8, skill: 9, energy: -13, boss: 4 })
    ]
  },
  {
    id: 'holiday-guilt', title: '特休可以請，表情不能太開心', era: '原創・休假藝術', sourceIds: [], minTurn: 4,
    body: '你把交接與代理安排完，送出一張休假單。Wing 看著日期，像你剛向公司申請分割一塊國土。',
    wing: '這種時候請假，你自己覺得適合嗎？我沒有說不准喔。',
    choices: [
      choice('照計畫休假，交接紀錄留好。', '把假單視為行程，不是道歉書。', '你離開辦公室，世界仍然繼續運轉。回來時 Wing 的語氣證明他也有記憶功能。', { energy: 17, mood: 15, boss: -21, cash: -5 }, ['evidence']),
      choice('取消休假，表態願意一起打拚。', '把機票改成企業忠誠點數。', 'Wing 說辛苦了。你看著取消通知，覺得這三個字有點貴。', { boss: 17, lick: 9, mood: -24, energy: -11, cash: -5 }, ['allin']),
      choice('改成半天，請同事幫忙擋訊息。', '用人情守住一小塊生活。', '假期縮水了，但你至少看見白天的天空。同事回你一個「我懂」。', { trust: 8, energy: 9, mood: 7, boss: -9 })
    ]
  },
  {
    id: 'free-test-project', title: '試作沒有成本，人有', era: '原創・免費提案', sourceIds: [],
    body: '一位還沒簽約的客戶想先看完整展示。Wing 說這是天大的機會，並把「簡單做一下」平均分配給所有還沒下班的人。',
    wing: '你們不要一直算成本，先做出來，客戶自然會買單。',
    choices: [
      choice('限定一天，做出足夠驗證的樣品。', '讓試作真正測試購買意願。', '展示能回答問題，還沒吞掉整個團隊。Wing 說第一印象怎麼能只做這樣。', { skill: 10, trust: 9, boss: -12, energy: -6 }),
      choice('自告奮勇全包，衝一個亮眼成果。', '把風險塞進自己的睡眠。', '客戶很驚豔，還想再加幾個小修改。Wing 說看吧，機會來了。', { boss: 15, skill: 7, energy: -21, mood: -13 }, ['allin']),
      choice('先讓 Wing 選定最重要的三項。', '責任共享從留下選項開始。', '清單在五分鐘內長成九項，但至少有三項是有書面同意的。', { lick: 5, skill: 5, boss: 4, mood: -6 }, ['evidence'])
    ]
  },
  {
    id: 'system-backup', title: '備份不是多存一份在同一台', era: '系統工程師・災難預演', sourceIds: [], roles: ['system'], weight: 1.35,
    body: '你發現主機與備份住在同一個硬碟。Wing 表示資料夾名字不同，理論上應該已經算兩份。',
    wing: '以前都沒出過事，怎麼你一來就要花這麼多錢？',
    choices: [
      choice('做一次還原演練，呈現實際風險。', '讓災難先在測試環境發生。', '演練卡住的時間比簡報更有說服力。Wing 還是覺得你太愛製造焦慮。', { skill: 14, trust: 8, energy: -10, boss: -12 }, ['evidence']),
      choice('替資料夾加上「企業級異地備援」名稱。', '異的是資料夾位置，地還是同一顆硬碟。', 'Wing 終於覺得架構很完整。你路過機房時，腳步比以前輕了一點。', { boss: 13, lick: 9, skill: -9, mood: -10 }),
      choice('先用現有資源補上最低限度備份。', '做得到的先做，做不到的記下來。', '系統多了一條逃生繩，你的休息時間少了一段。', { skill: 10, energy: -14, trust: 7, boss: 3 }, ['evidence'])
    ]
  },
  {
    id: 'system-weekend', title: '你不是維運嗎，怎麼會想睡', era: '系統工程師・服務不中斷', sourceIds: [], roles: ['system'], minTurn: 3,
    body: '服務在半夜發出告警，訊息也準時找到你。職缺寫的彈性工時，原來是系統想彈幾點就彈幾點。',
    wing: '系統又不知道你在放假，做工程師要有基本的責任感。',
    choices: [
      choice('先復原服務，隔天要求輪值與補休。', '可以救火，不能永遠住在消防車裡。', '服務恢復了，排班提案卻被說成「現在人還不多」。', { skill: 12, trust: 8, energy: -17, boss: -11 }, ['evidence']),
      choice('全程在線，回報每一個排查步驟。', '讓困倦成為看得見的忠誠。', 'Wing 在清晨回了個讚。你分不清自己是醒著，還是已經變成監控服務。', { boss: 18, lick: 8, energy: -23, mood: -14 }, ['allin']),
      choice('先確認嚴重度，將可延後的告警排到白天。', '不是每一聲嗶都值得燃燒一個人。', '你保住了半晚睡眠。Wing 一早問你為什麼沒有秒回。', { slack: 8, skill: 8, energy: 7, boss: -17 })
    ]
  },
  {
    id: 'system-printer', title: '系統很廣，影印機也算', era: '系統工程師・其他主管交辦', sourceIds: ['departures'], roles: ['system'],
    body: '你正在處理部署失敗，Wing 走來說影印機卡紙。旁邊有人接著問 Wi-Fi，另一個人問會議室電視，系統工程師的系統開始包括整棟大樓。',
    wing: '都是電腦的東西，有差那麼多嗎？幫忙一下很難？',
    choices: [
      choice('先通影印機，再通自己的氣。', '臨時客服評分：五顆星。', '紙順利出來，部署繼續卡住。Wing 說你今天終於做了一件看得見的事。', { boss: 12, lick: 5, skill: -3, mood: -15, energy: -7 }),
      choice('請他決定部署與卡紙的優先順序。', '所有的「現在」只能排成一條線。', 'Wing 說兩個都重要。你把他的選擇也記進處理紀錄。', { skill: 6, boss: -13, mood: 5, trust: 5 }, ['evidence']),
      choice('教同事處理卡紙，整理簡短指引。', '解決一次問題，也解決下一次求救。', '同事能自己處理了。Wing 問你為什麼花時間寫這種小事。', { skill: 9, trust: 12, energy: -8, boss: -8 })
    ]
  },
  {
    id: 'ai-crud', title: 'AI 工程師，今天先寫 CRUD', era: 'AI 工程師・名稱僅供參考', sourceIds: ['departures'], roles: ['ai'], weight: 1.6,
    body: '你帶著模型實驗計畫入職，第一個任務是後台權限，第二個是報表匯出。當你問模型在哪，Wing 指著產品名稱裡的 AI 兩個字。',
    wing: '不要分那麼細，AI 不也要有系統？你先把該做的做好。',
    choices: [
      choice('把基礎系統做穩，保留一段模型驗證時程。', '能做系統，不代表職涯要被整包吞掉。', '系統進步了，模型時程又被擠掉一次。你把差異留在任務紀錄裡。', { skill: 13, energy: -12, mood: -7, boss: 5 }, ['evidence']),
      choice('把 if-else 改名為自研智慧推論核心。', '有沒有 AI，先看簡報封面。', 'Wing 很滿意。你失去了一點專業信仰，得到一個能拿去展示的標題。', { boss: 17, lick: 11, skill: -6, dream: -10 }),
      choice('攤開職缺內容，要求確認實際職責。', '入職不是職稱盲盒的永久訂閱。', 'Wing 問你是不是只想做有趣的事。同事傳來一個「原來你也以為」的貼圖。', { mood: 7, trust: 8, boss: -24, skill: 5 }, ['evidence'])
    ]
  },
  {
    id: 'ai-training-data', title: '模型為什麼還不會通靈', era: 'AI 工程師・資料不存在', sourceIds: [], roles: ['ai'],
    body: '訓練資料只有幾份不一致的截圖，驗收目標卻是「像人一樣懂」。Wing 要求你在下一次展示前，把所有不確定性先處理掉。',
    wing: 'ChatGPT 都做得到了，你做 AI 的怎麼跟我說資料不夠？',
    choices: [
      choice('先定義資料、指標與可接受的錯誤。', '讓「懂」變成可以驗證的動詞。', '你把霧拆成清單。Wing 說他不是請你來寫學術論文。', { skill: 14, trust: 6, boss: -17, energy: -8 }, ['evidence']),
      choice('只展示最順利的三個案例。', '模型不會的地方，靠投影片轉場。', '展示十分順利。你開始害怕有人突然說「那我試試看」。', { boss: 16, slack: 8, mood: -12, skill: -4 }, ['allin']),
      choice('拉同事一起補一批小而乾淨的資料。', '共同標註，少一點共同受罵。', '準確度終於有了實際進展。你們的下午被資料整理吃掉，老闆只問何時能上線。', { skill: 11, trust: 12, energy: -15, boss: -5 })
    ]
  },
  {
    id: 'ai-human-fallback', title: '人工智慧，人工由你負責', era: 'AI 工程師・展示奇蹟', sourceIds: [], roles: ['ai'], minTurn: 4,
    body: '展示前一天，功能還不穩。有人提議由你躲在後台即時修正輸出，讓前台看起來全自動；這個「暫時」沒有下班時間。',
    wing: '客戶買的是結果，又不是一定要知道後面怎麼做。',
    choices: [
      choice('明示展示限制，準備人工備援。', '人可以幫忙，不能被叫成已完成的模型。', '展示少了一點神蹟，多了一點真實。Wing 嫌你的說明破壞氣氛。', { skill: 9, trust: 10, boss: -20, mood: 6 }, ['evidence']),
      choice('全程待在後台，手動完成魔法。', '你現在是一個會領薪水的 API。', '掌聲傳進耳機。沒有任何一張照片拍到真正讓展示成功的人。', { boss: 18, energy: -19, mood: -17, lick: 5 }, ['allin']),
      choice('縮成有限情境，確保每一項都能重現。', '做小一點，至少是真的能用。', '展示順利完成。Wing 仍然在問，為什麼不能順便再多做五個功能。', { skill: 13, trust: 6, energy: -9, boss: -8 })
    ]
  },
  {
    id: 'project-four-urgent', title: '專案經理的四個第一優先', era: '專案經理・排程魔術', sourceIds: [], roles: ['project'], weight: 1.3,
    body: '四個案子同時被列為第一優先，只有兩個人可以做。你把資源衝突標紅，Wing 問你為什麼簡報看起來這麼負面。',
    wing: '我請 PM 就是要解決這些問題，不是畫紅色給我看。',
    choices: [
      choice('請他明確選一個先做。', '排序是決策，不是 Excel 功能。', 'Wing 不想選，你把三種影響列出來，至少讓代價無法完全隱形。', { skill: 12, trust: 9, boss: -18, energy: -7 }, ['evidence']),
      choice('全部填綠燈，私下祈禱。', '儀表板先健康，團隊之後再說。', '會議氣氛很好。團隊看到報表後，開始懷疑自己是不是另一個專案的人。', { boss: 15, lick: 8, trust: -14, mood: -9, skill: -4 }, ['loop']),
      choice('協調小交付，替每個案子留一點進度。', '用切片爭取喘息空間。', '客戶都看到一點東西，你則看到滿滿的訊息。這份工作終於像是在管理碎玻璃。', { skill: 10, trust: 7, energy: -16, boss: 4 })
    ]
  },
  {
    id: 'project-scope', title: '只是多一個小功能', era: '專案經理・範圍漂移', sourceIds: [], roles: ['project'],
    body: '已簽核的需求在最後一天長出第二顆頭。Wing 說客戶只是多要一個小功能，語氣像是在便當裡多放一片薑。',
    wing: '不要跟客戶說加錢加時間，這樣誰還會跟我們合作？',
    choices: [
      choice('整理變更單，算出時程與成本。', '讓那一小片薑長出重量。', '團隊知道接下來要付出什麼。Wing 認為你把簡單的事複雜化。', { skill: 12, trust: 10, boss: -17, energy: -6 }, ['evidence']),
      choice('先答應，再拆掉一些原本的功能。', '總量守恆，客戶尚未發現。', '展示勉強接上了。新的驗收疑問開始排隊，隊伍比需求單還長。', { boss: 10, slack: 8, trust: -10, mood: -8 }),
      choice('邀工程師一起提出替代做法。', '別把「可以吧」直接翻譯成加班。', '大家找到一條折衷路線。你替同事守住一部分晚上，也讓自己多開了一場會。', { trust: 13, skill: 8, energy: -10, boss: -6 })
    ]
  },
  {
    id: 'project-owner', title: '專案出事，PM 是唯一的專案', era: '專案經理・責任全餐', sourceIds: [], roles: ['project'], minTurn: 4,
    body: '決策由上面拍板，資源由別組分配，交期由客戶宣布。出事的時候，這些人卻整齊地朝你轉頭。',
    wing: '我不管過程，PM 就是要對結果負責。',
    choices: [
      choice('先接住客戶，再公開列出待決策事項。', '危機處理要有出口。', '客戶願意等下一個明確回覆。Wing 發現責任清單上也有自己的名字。', { skill: 13, trust: 8, energy: -14, boss: -13 }, ['evidence']),
      choice('承認自己溝通不夠，吞下全責。', '讓會議用最快速度結束。', 'Wing 說知錯能改就好。會議紀錄裡，你的問題比原本的問題還長。', { boss: 14, lick: 8, mood: -23, trust: -5 }),
      choice('拉同事共同還原時間線。', '一個人的記憶容易被說成情緒。', '幾個人的紀錄終於拼成同一件事。Wing 說你們太團結在錯的地方。', { trust: 15, skill: 6, boss: -22, energy: -6 }, ['archive', 'evidence'])
    ]
  },
  {
    id: 'product-boss-user', title: '唯一的使用者，坐在老闆辦公室', era: '產品經理・需求洞察', sourceIds: [], roles: ['product'], weight: 1.3,
    body: '你做了使用者訪談，三位客戶指向同一個痛點。Wing 聽完說，他自己不會這樣用，所以問題應該不存在。',
    wing: '使用者不知道自己要什麼，我才知道產品應該長怎樣。',
    choices: [
      choice('把訪談與行為資料整理成小型實驗。', '用可驗證結果接住不同意見。', '你得到一個明確學習。Wing 說樣本太小，除非結果剛好支持他的想法。', { skill: 14, trust: 7, boss: -16, energy: -8 }, ['evidence']),
      choice('把他的直覺列成最高優先需求。', '產品市場契合，先契合主管。', '路線圖終於通過。客服的問題沒有減少，只是換到別的群組裡。', { boss: 16, lick: 10, skill: -7, trust: -8 }),
      choice('找一個雙方都能接受的小切入點。', '先把可用的部分送上線。', '客戶問題解了一角，你也練成把同一句話換五種包裝的能力。', { skill: 8, lick: 5, boss: 4, energy: -11, mood: -5 })
    ]
  },
  {
    id: 'product-roadmap', title: '產品路線圖的單位是心情', era: '產品經理・策略轉向', sourceIds: [], roles: ['product'],
    body: '昨天是企業服務，今天是消費平台，下午可能是 AI 生態系。你打開路線圖，發現唯一沒有變動的是上面的截止日期。',
    wing: '市場變化很快，你的思維不要這麼僵化。',
    choices: [
      choice('記錄每次轉向與被放棄的成本。', '快速轉彎也需要煞車紀錄。', '圖表清楚到讓會議室不太舒服。Wing 說你在算舊帳。', { skill: 11, trust: 8, boss: -22, dream: -5 }, ['archive', 'evidence']),
      choice('先挑不受方向影響的基礎功能做。', '風向可以變，登入總得能登入。', '團隊總算有可累積的成果。Wing 問你為什麼看不出新策略的感覺。', { skill: 12, trust: 11, boss: -8, energy: -7 }),
      choice('每個方向都立刻做一套漂亮簡報。', '產品尚未驗證，模板已經成熟。', 'Wing 稱讚你反應快。你在硬碟裡養出四家尚未存在的公司。', { lick: 10, boss: 13, slack: 5, energy: -10, dream: -8 }, ['loop'])
    ]
  },
  {
    id: 'product-metrics', title: '數據說了算，先讓數據懂事', era: '產品經理・成長報表', sourceIds: [], roles: ['product'], minTurn: 4,
    body: '使用人數下降，Wing 要你換一種算法呈現。新的指標把測試帳號、重複登入與路過的同事，全都迎進成長故事裡。',
    wing: '這不是美化，是你要學會從正面的角度看數據。',
    choices: [
      choice('清楚標註口徑，呈現真實留存。', '好消息可以慢，定義不能漂。', '團隊看懂問題在哪。Wing 說這份圖不能拿去給投資人看。', { skill: 14, trust: 9, boss: -24, mood: 6 }, ['evidence']),
      choice('主圖放漂亮數字，註解留完整定義。', '折衷的字通常比較小。', '簡報被接受，你也保住一條可以回頭追溯的線。只是沒有人會主動看那行字。', { boss: 9, lick: 6, mood: -9, skill: 4 }, ['evidence']),
      choice('提出一週小實驗，把力氣花在改善。', '讓曲線真正抬頭需要時間。', '你拿到一小段試驗窗口。Wing 期待的是明天就能截圖的奇蹟。', { skill: 11, dream: 7, energy: -12, boss: -9 })
    ]
  },
  {
    id: 'design-logo-bigger', title: 'Logo 大一點，要大得不明顯', era: '設計師・美感量子學', sourceIds: [], roles: ['design'], weight: 1.3,
    body: 'Wing 要你同時做出簡潔、熱鬧、高級、親民，而且不要像別人。你交了三版，他選回最初那版，並要求保留另外兩版的優點。',
    wing: '我說不出來，但你是設計師，你應該懂我要的感覺。',
    choices: [
      choice('做可比較的方案，請他逐項選擇。', '感覺先拆成看得見的決定。', '選項終於有了理由。Wing 說你為什麼要他做這麼多選擇。', { skill: 13, boss: -13, energy: -9, trust: 5 }, ['evidence']),
      choice('換檔名，說這是依指示重新精修。', '畫面沒變，敘事完成迭代。', 'Wing 說這次終於抓到重點。你對設計史產生了新的疑問。', { slack: 14, boss: 12, lick: 7, dream: -8, skill: -3 }),
      choice('熬夜再畫五版，賭一版剛好撞中。', '把審美不確定性轉成你的睡眠損失。', '其中一版被點頭通過。理由是今天看起來比較順眼。', { skill: 8, boss: 10, energy: -21, mood: -14 }, ['allin'])
    ]
  },
  {
    id: 'design-source-file', title: '最終版＿真的最終＿老闆再改', era: '設計師・版本地獄', sourceIds: ['debate', 'cloud'], roles: ['design'],
    body: '你交出的圖被別人裁過，字也被替換，最後以你的名字出包。原始檔還躺在資料夾裡，像一位沒被傳喚的證人。',
    wing: '作品掛你的名字，你就要全部負責，誰改的不重要。',
    choices: [
      choice('建立交付版本與修改紀錄。', '把像素跟責任分別存好。', '你找回了版本脈絡。Wing 說不要把小事弄得像法庭。', { skill: 11, trust: 6, boss: -20, energy: -7 }, ['evidence']),
      choice('默默修好，讓別人繼續使用舊流程。', '救火速度，換不到防火制度。', '新圖上線了，舊問題準備下次再來。你的設計軟體沒有抱怨功能。', { boss: 10, energy: -15, mood: -14, skill: 5 }, ['loop']),
      choice('教同事用模板，留一份操作說明。', '讓不用設計師的修改也有護欄。', '同事少踩一些坑。你用半天換到未來幾個比較安靜的晚上。', { trust: 13, skill: 8, energy: -10, boss: -5 })
    ]
  },
  {
    id: 'design-ai-prompt', title: '有 AI 了，怎麼設計還要時間', era: '設計師・一鍵幻想', sourceIds: [], roles: ['design'],
    body: 'Wing 看完一段十秒生成影片，宣布設計產能應該翻十倍。影片沒拍到的修稿、授權確認與一致性調整，被一起從預算裡刪掉。',
    wing: '你只要打幾個字，怎麼比以前還慢？工具不是買給你玩的。',
    choices: [
      choice('示範生成到可交付之間的完整步驟。', '讓看不見的工作出現在時間軸上。', '他終於看到需要修正的細節，然後問你能不能不要那麼龜毛。', { skill: 12, boss: -15, energy: -8, trust: 6 }, ['evidence']),
      choice('先交一堆圖，讓他自己挑。', '當需求是數量，品質開始裝死。', 'Wing 覺得效率大幅提升。後面幾輪修稿正在排隊進站。', { boss: 13, slack: 9, skill: -5, mood: -7 }),
      choice('和同事做可重複使用的素材系統。', '把工具變成流程的一部分。', '產出真的穩定了，只是沒有影片裡那種一秒完成的魔法。', { skill: 14, trust: 8, energy: -13, boss: -4 })
    ]
  },
  {
    id: 'bd-network', title: '你的商務開發，從你的通訊錄開始', era: '商務開發・人脈資產', sourceIds: [], roles: ['bd'], weight: 1.3,
    body: 'Wing 問你認不認識某位大老，接著問你朋友的朋友認不認識。產品介紹只有三頁，人脈盤點卻已經追到你的同學會。',
    wing: '做 BD 不能只靠公司資源啊，你自己的價值在哪裡？',
    choices: [
      choice('先整理合作價值，再約合適的窗口。', '讓別人願意接下一通電話。', '聯繫數量沒爆衝，回覆卻開始有內容。Wing 問你為什麼動作不夠大。', { skill: 13, trust: 7, boss: -12, energy: -8 }),
      choice('把私人聯絡圈全拉進名單。', '用人情替公司跑一輪免費廣告。', 'Wing 很滿意名單長度。幾位朋友回訊息的速度開始接近公司的報銷流程。', { boss: 16, lick: 6, trust: -15, mood: -11 }, ['allin']),
      choice('先報出幾個模糊的「持續接洽」。', '把不確定性包成商機進度。', '報表看起來蓬勃發展。下週它們會要求你交出更多沒有發生的細節。', { boss: 9, slack: 10, skill: -5, mood: -7 }, ['loop'])
    ]
  },
  {
    id: 'bd-mou', title: '合作備忘錄，先備忘沒有合作', era: '商務開發・新聞稿經濟', sourceIds: [], roles: ['bd'], minTurn: 3,
    body: '雙方只交換了合作意向，Wing 已經開始想新聞標題。你問後續資源與交付，得到的回答是「先把氣勢做出來」。',
    wing: '有聲量才有機會，你不要每件事都等到百分之百才動。',
    choices: [
      choice('釐清意向與承諾的範圍。', '一張簽名紙不等於一條收入線。', '合作窗口願意繼續談，Wing 卻嫌消息不夠震撼。', { skill: 13, trust: 8, boss: -17, energy: -6 }, ['evidence']),
      choice('把照片與標題做得像已經改變世界。', '專案進度：合照已完成。', 'Wing 在群組連發三個讚。實際工作從拍照結束的下一秒才開始欠債。', { boss: 17, lick: 10, dream: 6, mood: -8, skill: -4 }, ['allin']),
      choice('爭取一個小規模合作試點。', '先讓雙方真正做過一件事。', '沒有驚天動地的新聞，但有了一次可結案的合作。', { skill: 11, trust: 7, energy: -12, boss: -5 }, ['acquire'])
    ]
  },
  {
    id: 'bd-assistant', title: '策略合作第一步：幫老闆訂餐廳', era: '商務開發・隱藏職務', sourceIds: [], roles: ['bd'],
    body: '你以為今天要談合作策略，工作卻變成訂餐廳、找停車位與提醒老闆帶名片。所有事情都很重要，除了你應徵時以為自己會做的那件事。',
    wing: '連這種小事都做不好，怎麼讓你去談大生意？',
    choices: [
      choice('安排妥當，順便取得會議議題與窗口。', '在助理任務裡偷渡真正的商務工作。', '會面順利，至少你知道雙方下一步要談什麼。只是大部分時間還是在查停車場。', { skill: 8, boss: 10, energy: -12, mood: -7 }),
      choice('請行政分工，自己準備商務資料。', '每個重要任務都可以有合適的負責人。', '資料完整了，Wing 說你不夠願意捲起袖子。', { skill: 11, trust: 5, boss: -20, mood: 5 }, ['evidence']),
      choice('全套禮賓服務，連喜歡的座位都記住。', '你正在建立另一種不可取代性。', 'Wing 說你最懂他。你的職涯方向盤，悄悄往私人行程管理轉了半圈。', { lick: 14, boss: 17, skill: -6, mood: -12 })
    ]
  },
  {
    id: 'sales-assistant', title: '應徵業務，到職業務助理', era: '業務・職缺盲盒', sourceIds: [], roles: ['sales'], weight: 1.6,
    body: '面試談的是開發市場與獎金制度，報到拿到的是報價單整理與主管行程。你問客戶名單，對方先問你會不會用印表機雙面列印。',
    wing: '業務就是什麼都要會，你不要連基本功都不願意做。',
    choices: [
      choice('把行政做快，爭取一段自己的開發時間。', '一邊交差，一邊確認還有沒有出口。', '你擠出少量時間聯繫客戶。新的行政需求也聞風而來。', { skill: 11, boss: 7, energy: -15, mood: -8 }),
      choice('確認實際職務、業績歸屬與獎金條件。', '模糊的未來不能拿來付帳。', 'Wing 說你還沒證明自己就計較太多。你終於把職缺盲盒拆到見底。', { mood: 8, skill: 5, boss: -24, trust: 6 }, ['evidence']),
      choice('先把主管服務好，賭他會分案子。', '把名單來源押在他的心情上。', '主管說有機會一定想到你。你被想到的下一件事是幫忙改簡報字體。', { boss: 16, lick: 13, skill: -4, mood: -12 })
    ]
  },
  {
    id: 'sales-promise', title: '先賣，功能之後就會長出來', era: '業務・承諾先行', sourceIds: [], roles: ['sales'],
    body: '客戶問產品有沒有某項功能，答案本來很單純。Wing 在你旁邊點頭，工程師在群組裡打出一個巨大的問號。',
    wing: '先把單簽下來，有錢了什麼做不出來？你不要自己擋自己的業績。',
    choices: [
      choice('說明現況與可談的開發範圍。', '讓訂單建立在大家同意的世界裡。', '客戶需要多一點時間評估。工程師對你保留了最後一點信任。', { trust: 14, skill: 9, boss: -21, mood: 5 }, ['evidence']),
      choice('先說有，回頭拜託工程師幫忙。', '把銷售漏斗接到同事的睡眠上。', 'Wing 很高興。工程群組安靜到你可以聽見鍵盤被握緊的聲音。', { boss: 18, cash: 6, trust: -21, mood: -12 }, ['allin']),
      choice('約下一場技術確認，把決定留到現場。', '再開一次會，換一次不亂說話的機會。', '案子延後了幾天，承諾總算有技術同事一起把關。', { skill: 7, trust: 9, energy: -10, boss: -8 })
    ]
  },
  {
    id: 'sales-commission', title: '獎金算法，成交後才更新', era: '業務・結算驚喜', sourceIds: [], roles: ['sales'], minTurn: 4,
    body: '你以為達標了，結算表卻多出一項從沒看過的排除條件。Wing 說制度需要彈性，彈的方向剛好遠離你的帳戶。',
    wing: '公司也有成本，你不能只看到自己的那一份。',
    choices: [
      choice('整理原先條件與成交紀錄，逐項核對。', '讓數字有出處，讓改動有日期。', '你爭取到一次重新確認。Wing 對你的計算能力有了全新的不滿。', { cash: 10, skill: 7, boss: -23, mood: 4 }, ['evidence']),
      choice('先接受，表態以公司大局為重。', '情緒價值不能匯款，但可以被稱讚。', 'Wing 說會記得你的付出。帳戶餘額的記憶力顯然比較不好。', { boss: 17, lick: 12, cash: -9, mood: -20 }),
      choice('和同事共同釐清下一季的書面規則。', '至少別讓下一個人靠猜。', '團隊有了同一張對照表。Wing 說大家最近怎麼都在研究制度。', { trust: 14, skill: 6, boss: -16, energy: -6 }, ['evidence'])
    ]
  },
  {
    id: 'executive-first-week', title: '空降第一週，已經有人在等你落地', era: '空降主管・蜜月倒數', sourceIds: ['managerKiller'], roles: ['executive'], maxTurn: 9, weight: 1.8,
    body: '你的到職介紹用了很多「帶來新視野」。一週後，你提出的每項改變都被問「你了解我們嗎」，原團隊則在觀察你會先救人還是先畫餅。',
    wing: '我請你來是帶團隊，不是來推翻我之前做的事。',
    choices: [
      choice('先聽基層的實際困難，再調整一件事。', '主管的落地點最好不是同事頭上。', '團隊願意多說一點真話。Wing 認為你進來沒多久就被下面帶偏。', { trust: 16, skill: 9, boss: -22, energy: -9 }),
      choice('先宣布一輪新制度，展現管理氣勢。', '陌生人最容易先管理看得見的地方。', 'Wing 覺得你有魄力。團隊開始把更多資訊留在沒有你的群組裡。', { boss: 14, lick: 6, trust: -20, mood: -7 }),
      choice('反覆說認同既有方向，暫時不改任何事。', '蜜月續費靠口頭付款。', 'Wing 暫時滿意。同事還在等你證明自己不是一個更貴的轉述機。', { boss: 15, lick: 12, trust: -9, skill: -4 }, ['loop'])
    ]
  },
  {
    id: 'executive-buffer', title: '主管的功能：人肉情緒緩衝墊', era: '空降主管・上下都不討好', sourceIds: [], roles: ['executive'], minTurn: 3, weight: 1.5,
    body: 'Wing 要你今晚追出結果，團隊已經連續加班。你站在兩邊中間，職稱越長，能決定的事情卻越短。',
    wing: '你如果連下面的人都叫不動，那我要你這個主管做什麼？',
    choices: [
      choice('擋下不合理交期，提出能完成的範圍。', '主管權限先拿來保住人。', '團隊開始相信你。Wing 開始懷疑你是不是站錯邊。', { trust: 18, skill: 8, boss: -27, energy: -10 }, ['evidence']),
      choice('原封不動轉達，再加一句這是高層要求。', '把壓力當作附件轉寄。', 'Wing 說你執行力不錯。團隊給你的新暱稱沒有出現在組織圖上。', { boss: 17, lick: 8, trust: -24, mood: -11 }),
      choice('自己跳下去補洞，讓大家先走。', '用主管的薪水做整個部門的加班。', '同事記住這個晚上。你也第一次感到自己的職稱快把身體壓彎。', { trust: 15, skill: 10, boss: 5, energy: -24, mood: -12 }, ['allin'])
    ]
  },
  {
    id: 'executive-overruled', title: '充分授權，直到你真的決定', era: '空降主管・權限試用版', sourceIds: [], roles: ['executive'], minTurn: 3, weight: 1.5,
    body: '面試時說的充分授權，在你第一次調整優先順序後到期。Wing 越過你直接派工作，再問你為什麼掌握不了部門進度。',
    wing: '我只是給一點方向，你不要把管理失能怪到我身上。',
    choices: [
      choice('整理決策邊界，要求共用一份任務清單。', '授權若存在，應該能畫出輪廓。', '事情變得可追蹤。Wing 說你還沒做出成績就想管他。', { skill: 12, trust: 11, boss: -29, mood: -5 }, ['evidence']),
      choice('把每個小決定都先請示。', '充分尊重，直到對方受不了。', 'Wing 嫌你沒有自主性。你得到一個很完整的雙重束縛案例。', { slack: 9, lick: 6, boss: -10, energy: -8, dream: -8 }, ['loop']),
      choice('私下跟團隊同步，維持最低限度秩序。', '不能決定風向，先讓船員知道彼此在哪。', '團隊少了一些混亂。你多了一份永遠不會出現在績效表上的翻譯工作。', { trust: 14, skill: 8, energy: -15, boss: -8 })
    ]
  }
  ,{
    id: 'slack-seven-lives', title: 'Slack 七進七出，薪水沒有七份', era: '日常・權限型情緒', sourceIds: ['slackHall'], weight: 1.4,
    body: 'Wing 把你移出工作群組，理由是訊息沒回。你還沒搞懂現在要怎麼接收工作，他又把你加回去，順便問你為什麼沒有跟上進度。',
    wing: '把你加回來是再給你一次機會，不是讓你繼續裝死。',
    choices: [
      choice('整理權限異動與未接收的任務時間。', '帳號有輪迴，工作要有紀錄。', '你拼出了消失期間的任務。Wing 說不要找藉口，同事把遺漏訊息補給了你。', { skill: 8, trust: 9, boss: -18, energy: -7 }, ['archive', 'evidence']),
      choice('重新入群第一句：謝謝老闆給機會。', '歡迎來到聊天室忠誠儀式。', 'Wing 丟了個貼圖，工作繼續。你發現人資系統裡沒有精神折舊這個欄位。', { boss: 17, lick: 12, mood: -17, dream: -5 }, ['loop']),
      choice('權限沒回來前，先喝水休息。', '無法登入不是靠意志力能修。', '你獲得一段被系統正式承認的空白時間。Wing 看起來不欣賞這種因果關係。', { slack: 12, energy: 12, mood: 7, boss: -21 })
    ]
  },
  {
    id: 'telepathy-spec', title: '工程師的基本能力：通靈', era: '工程現場・無字規格書', sourceIds: ['roast'], roles: ['system', 'ai'], weight: 1.4,
    body: '需求只有「像之前那個，但不要一樣」。你問流程與判斷條件，會議室卻開始討論工程師是不是應該更有想像力。',
    wing: '每件事都要寫清楚，那我自己做不就好了？你要會預判我的意思。',
    choices: [
      choice('畫三個流程，讓他選一個並留下紀錄。', '通靈失敗，改用選擇題。', 'Wing 選了第二個，隔天說他其實想要第三個。至少你知道時間線從哪裡裂開。', { skill: 12, boss: -13, energy: -9, trust: 6 }, ['evidence']),
      choice('先做最像他會喜歡的版本。', '模型參數：老闆今天的語速。', '你猜中了一半，另外一半被稱為不用心。舔功有長，需求沒有。', { lick: 9, boss: 7, energy: -14, mood: -10 }),
      choice('說等他夢到答案，再開始開發。', '這個笑話有清楚的受眾風險。', '同事的肩膀抖了一下。Wing 表示他不覺得這有什麼好笑。', { trust: 10, mood: 11, slack: 6, boss: -27 }, ['archive'])
    ]
  },
  {
    id: 'wake-up-officer', title: '新職缺：同事叫醒員', era: '日常・連坐管理', sourceIds: ['roastMeeting'], minTurn: 4,
    body: '有人在冗長會議裡恍神，你被指定提醒他保持清醒。Wing 提議下次再發生就兩個人一起搬座位，組織的警覺性突然獲得了雙倍人力。',
    wing: '你坐他旁邊都不知道提醒？這就是沒有團隊意識。',
    choices: [
      choice('建議縮短會議，讓大家輪流報告。', '不要只修人體，順便修一下流程。', '同事醒了，因為會議開始有重點。Wing 卻覺得你在暗示他講太久。', { skill: 8, trust: 11, energy: 7, boss: -18 }),
      choice('主動當叫醒員，順便報告誰在分心。', '考勤功能正式從系統外包給你。', 'Wing 說你有責任感。午餐群組少了一次通知你的習慣。', { boss: 16, lick: 11, trust: -21, mood: -8 }),
      choice('悄悄給同事一杯水，之後一起伸展。', '相互照顧不需要變成監視器。', '兩個人都撐過這場會議，也都很確定今晚需要早點睡。', { trust: 13, energy: 9, mood: 7, boss: -9 })
    ]
  },
  {
    id: 'ceo-tea-drop', title: '下午茶掉落率：依 CEO 心情', era: '日常・福利抽卡', sourceIds: ['algorithmJob'], weight: 1.1,
    body: '今天桌上出現點心，大家先確認是不是要加班。沒有制度說明，只有一句老闆今天心情很好；同事建議把氣象站移到茶水間。',
    wing: '公司對你們也不差吧？外面哪有這麼自由，還有東西吃。',
    choices: [
      choice('吃點心，和同事一起休息十五分鐘。', '福利先入胃，不急著轉成忠誠。', '一點甜味讓下午不那麼難熬。你們聊了幾句跟公司無關的生活。', { energy: 13, mood: 12, trust: 8, boss: -4 }),
      choice('大聲謝謝老闆，留下感恩合照。', '一塊蛋糕，換一篇文化宣傳。', 'Wing 心情更好了。你拍完十張照片，蛋糕已經被拿走大半。', { boss: 16, lick: 12, energy: 5, trust: -6 }),
      choice('留一份給正在救火的同事。', '有些照顧不用看老闆臉色。', '同事回來時吃到沒有被遺忘的那一份。你自己少吃一點，心情卻好了一點。', { trust: 15, mood: 10, energy: 5, boss: -5 })
    ]
  },
  {
    id: 'contract-concern-chain', title: '你只是想看合約，大家卻開始關心你', era: '日常・專案合約', sourceIds: ['contract'], minTurn: 5,
    body: '新的專案合約多了幾個條件，你說想先看懂。主管、人資與另一個窗口輪流來談，晚間手機再度亮起，彷彿閱讀理解是一種離職前兆。這是專案合約情節，並非離職書。',
    wing: '如果你想繼續做，為什麼連一個名字都不願意簽？',
    choices: [
      choice('列出不清楚的條款，請對方書面說明。', '把被關心的時間換成可閱讀的答案。', '你仍然沒有得到所有答案，但問題終於有一份一致的清單。Wing 的耐性則沒有。', { skill: 8, mood: 5, boss: -22, energy: -10 }, ['evidence']),
      choice('先簽下去，讓這輪約談結束。', '今天很安靜，明天的自己再煩惱。', '所有人突然都很忙，沒有再來關心你。你心裡留下了一個還沒讀完的問號。', { boss: 15, cash: 8, lick: 5, mood: -20, dream: -6 }, ['allin']),
      choice('找信任的同事一起核對各自拿到的版本。', '讀不懂時，先確認是不是同一張紙。', '幾個人交換出一份問題表。Wing 不喜歡你們把個別談話變成共同記憶。', { trust: 13, skill: 7, boss: -17, energy: -7 }, ['archive', 'evidence'])
    ]
  },
  {
    id: 'executive-auto-disappear', title: '自動化唯一準時的功能：主管消失', era: '空降主管・三個月觀察期', sourceIds: ['managerKiller'], roles: ['executive', 'product', 'project'], minTurn: 4, weight: 1.3,
    body: '新主管被交付自動化大業，卻連能調動哪些人都還沒問清楚。你看著組織圖上前任的名字，發現換人似乎比換流程容易很多。',
    wing: '我找你來就是要自動化，你不要什麼事都跟我要人。',
    choices: [
      choice('選一個能落地的流程，和團隊共同試作。', '讓自動化先有使用者，再有漂亮名稱。', '一段重複工作真的減少了。Wing 問你怎麼才做這一點點。', { skill: 13, trust: 12, boss: -15, energy: -10 }),
      choice('報告全公司一季內全面自動化。', '先把承諾跑在現實前面。', 'Wing 很高興，你終於體驗到蜜月可以用未來的自己來支付。', { boss: 18, lick: 10, dream: 8, mood: -10 }, ['allin']),
      choice('保存組織圖版本，問清楚決策與人力。', '每個消失的名字都曾有一份到職介紹。', '同事多給你幾句真話。Wing 說你剛來就太在意過去。', { trust: 10, skill: 6, boss: -21, mood: -4 }, ['archive', 'evidence'])
    ]
  },
  {
    id: 'frozen-third-floor', title: '三樓冷凍庫，意外有陽光', era: '日常・職務冷凍', sourceIds: ['exitBattle', 'samExit'], minTurn: 6,
    body: '你的重要專案被移走，座位也遠離主要工作區。Wing 以為這叫讓你反省，你卻第一次發現窗外下午有一條很好看的光線。',
    wing: '你先待在這邊好好想一想，想清楚自己能替公司做什麼。',
    choices: [
      choice('準時完成剩餘工作，把空檔拿來學習。', '被冷凍的時間，也可以解凍自己的未來。', '技能筆記越寫越厚，你的焦慮慢慢變成一份下一站的準備。', { skill: 14, slack: 9, mood: 12, energy: 10, boss: -15 }, ['evidence']),
      choice('每天主動回報，爭取重回核心。', '回溫需要很多封沒人答應會看的訊息。', 'Wing 偶爾回一個字，你把它解讀成可能的轉機。等待也很消耗人。', { boss: 14, lick: 12, energy: -10, mood: -12 }),
      choice('把同事的故事整理成一份匿名史冊。', '人在邊緣，記憶仍然可以有位置。', '你留住了那些不會出現在公司沿革裡的細節，也留住自己還會笑的證據。', { trust: 12, mood: 13, energy: 7, boss: -12 }, ['archive'])
    ]
  },
  {
    id: 'payday-tiny-victory', title: '薪水入帳，人格暫時回購', era: '原創・每月結算', sourceIds: [], minTurn: 4, weight: 1.3,
    body: '銀行通知亮起，你看了三遍。這個月最清楚的公司承諾終於出現在帳戶裡，雖然它無法回收那些晚上。',
    wing: '公司付薪水給你，是希望你創造價值，不是每天只想著領薪水。',
    choices: [
      choice('先存離職預備金，下班好好休息。', '讓選擇權慢慢長回自己手上。', '存款多了一點，睡眠也多了一點。你第一次覺得「還能走」是一種很實際的福利。', { cash: 15, energy: 13, mood: 10, boss: -8 }),
      choice('請一路救火的同事吃一餐。', '把薪水的一角換成不必演戲的晚上。', '你們吃得沒有願景餐會高級，卻沒有人需要等老闆先夾菜。', { cash: 5, trust: 15, mood: 14, energy: 8 }),
      choice('買課補技能，給自己加一條出口。', '公司不安排成長，自己替自己排。', '你的存款留下一部分，能力往外延伸一點。Wing 問你學這個能不能馬上用在公司。', { cash: 8, skill: 14, mood: 7, energy: -7, boss: -6 }, ['evidence'])
    ]
  }

  ,{
    id: 'employee-stock-payment', title: '員工持股，先持有付款責任', era: '原創・自費買夢', sourceIds: [], minTurn: 8, weight: 1.35,
    body: '以下是原創幻想事件：Wing 在會議末尾推出一份員工投入計畫，要大家用自己的存款表達對上市夢的信心。簡報畫著未來的鐘，付款期限卻寫得比產品交期還清楚。你突然理解了「主人翁精神」的另一種收費方式。',
    wing: '連自己的公司都不敢投，你每天說相信我們的未來，是說給誰聽的？',
    choices: [
      choice('拿出大筆存款，跟公司一起押未來。', '幻想投資：用自己的退路支付這次大夢。', 'Wing 當眾稱讚你有格局。帳戶立刻變薄，未來能不能敲鐘卻沒有因此獲得保證。', { cash: -40, boss: 15, dream: 20, mood: -8 }, ['allin', 'global']),
      choice('說存款已有安排，這次不投入。', '信心可以說，房租要能付。', 'Wing 的笑容暫時停止服務。你保住了能選擇下一步的那筆錢，也練會了在關鍵時刻裝聽不懂。', { boss: -18, slack: 10, mood: 8, dream: -6 }),
      choice('先問清楚文件、條件與可能損失。', '讓漂亮圖表接受具體問題。', '問題越問越長，催款的語氣越來越短。你把仍未釐清的地方記下來，沒有急著替幻想付款。', { boss: -12, skill: 7, mood: 3, energy: -6 }, ['evidence'])
    ]
  }

];

// The engine schedules these four original fantasy scenes after the ordinary events.
export const FANTASY_EVENTS = [
  {
    id: 'road', title: '大夢分岔：鐘要在哪裡敲', era: '幻想主線・選擇航道', sourceIds: ['dream'],
    body: '你竟然撐到了公司認真討論未來的那一天。這次的簡報除了願景，還有數字；Wing 的手指在台灣、紐約與收購邀約之間來回滑動。以下走向都是遊戲幻想。',
    wing: '三條路我都要，你們先做最有可能成功的那條，再順便把另外兩條做好。',
    choices: [
      choice('押全球市場，走向納斯達克的鐘。', '最大的舞台，最長的待辦清單。', '你替紐約畫下一條路，也替未來幾個月畫上很多紅線。', { dream: 14, boss: 12, energy: -13, cash: -9 }, ['global', 'allin']),
      choice('把台灣市場與營運基礎做穩。', '先讓公司的體質配得上招牌。', '路線沒有那麼浮誇，卻第一次有了可以一項項核對的方向。', { skill: 11, trust: 8, boss: -9, dream: 5 }, ['taiwan', 'evidence']),
      choice('談一份能保住團隊的收購方案。', '出口也可以是另一家公司真正願意接住。', '大家開始問新團隊的文化與工作條件。Wing 則先問自己的頭銜能保留幾個字。', { cash: 9, trust: 8, dream: -7, boss: -11 }, ['acquire'])
    ]
  },
  {
    id: 'runway', title: '離鐘聲還有一季，離沒電只剩一晚', era: '幻想主線・人比夢先耗盡', sourceIds: [],
    body: '外部窗口要資料，產品要修，團隊的眼神也需要充電。Wing 說再衝一下就到了，但你已經聽過很多個形狀相同的「一下」。',
    wing: '成功的人就是比別人多撐那一下，現在休息，你對得起前面的付出嗎？',
    choices: [
      choice('排休、縮範圍，把人留到下一個階段。', '夢想要有人活著走到現場。', '進度放慢了一點，說話的語氣卻開始像人了。Wing 對時程仍然很不滿意。', { energy: 20, mood: 17, trust: 10, boss: -19, dream: -5 }),
      choice('自己多扛一輪，換團隊一點喘息。', '這次的燃料仍然是你。', '同事得到短暫休息，你的倒影看起來像一份沒有完成的工單。', { trust: 16, boss: 9, energy: -23, mood: -17, skill: 6 }, ['allin']),
      choice('動用預算補資源，向外找專業支援。', '請工具與專業做事，不只請大家相信。', '專案多了能幫忙的人，你的存款與資源配置也付出代價。', { cash: -15, skill: 9, energy: 10, boss: -7, mood: 8 }, ['evidence'])
    ]
  },
  {
    id: 'audit', title: '資料室不接受「相信我」格式', era: '幻想主線・最後核對', sourceIds: ['dream'],
    body: '幻想中的審查窗口要看合約、數字、產品與紀錄。漂亮封面無法替空白欄位回答問題，這家公司終於遇到不會因為 Wing 提高音量就改變的表格。',
    wing: '我們都走到這裡了，你現在跟我說還要查？之前在幹嘛？',
    choices: [
      choice('拉同事逐項核對，缺的就註明缺口。', '要走遠，先知道踩的是什麼。', '資料室裡有了可信的脈絡。Wing 很不喜歡那些清楚寫出的限制。', { skill: 15, trust: 10, energy: -12, boss: -18 }, ['evidence', 'archive']),
      choice('連夜補簡報，包裝成一個流暢故事。', '讓所有缺口暫時被轉場遮住。', '故事講得極好，你卻知道有幾頁經不起第二個問題。', { boss: 17, lick: 10, mood: -17, energy: -15, skill: -5 }, ['allin']),
      choice('邀外部專業核對，接受延後時程。', '把最後一哩拆成真的能走的步驟。', '進度表向後移動，未知風險也開始有名字。這份代價至少可以算。', { skill: 11, cash: -12, energy: 7, boss: -11, mood: 7 }, ['evidence'])
    ]
  },
  {
    id: 'finale', title: '最後一張選擇單，這次寫你自己', era: '幻想主線・鐘聲之前', sourceIds: ['dream', 'spring'],
    body: '典禮彩排開始了，你的識別證卻還掛在胸前，像這段人生留下的存檔。前方有不同的出口，不論鐘聲在哪裡響，你都要決定自己為什麼走到這裡。',
    wing: '等成功了你們就會知道，我以前對你們嚴格都是為你們好。',
    choices: [
      choice('走向紐約舞台，但把同事的名字一起帶上。', '最大的夢也不能只有一個主角。', '你望向幻想中的納斯達克燈牆。能不能敲響那口鐘，得看一路留下的是根基，還是只有口號。', { dream: 10, boss: 6, energy: -6 }, ['final_global', 'global']),
      choice('留在台灣，把一間能長久工作的公司做出來。', '掛牌是里程碑，日常才是人生。', '你走向幻想中的台灣掛牌日。成功會不會留下人，取決於一路做過的選擇。', { trust: 8, skill: 6, boss: -7, mood: 5 }, ['final_taiwan', 'taiwan']),
      choice('完成收購談判，讓自己與團隊都有下一站。', '結束這段旅程，不等於結束你的故事。', '你把識別證放回桌上。這份幻想中的交易是否值得，要看最後一起被帶走的是人，還是只有招牌。', { cash: 8, mood: 6, dream: -6, boss: -9 }, ['final_acquire', 'acquire'])
    ]
  }
];

// Product names and public news provide scene-setting only. All workplace dialogue,
// failures, assignments and outcomes here are authored fiction.
EVENTS.push(
  {
    id: 'spencer-menu-freedom', title: '董事長說：想吃什麼隨便點', era: '日常・董事長預算宇宙', speaker: 'spencer', sourceIds: ['budget2'], weight: 1.15,
    body: 'Spencer 邀大家吃飯，路上強調今天隨便點。你翻到生魚片拼盤，服務生剛拿出筆，董事長就把整桌的自由收束成一份精緻套餐。',
    wing: '套餐最均衡，大家選一樣的，才有團隊精神。',
    choices: [
      choice('合上菜單，稱讚董事長很會安排。', '桌上的選項突然很整齊。', 'Spencer 點頭，把下一次餐會的統計工作交給你。你得到認可，以及一份不能開放自由填答的表單。', { lick: 10, boss: 9, mood: -7, energy: 5 }),
      choice('和同事約好散場後再去吃。', '這頓先負責出席。', '便利商店的關東煮沒有董事長主持，大家卻吃出久違的參與感。', { cash: -7, energy: 10, trust: 12, mood: 8 }),
      choice('把「隨便點」留在餐會紀錄裡。', '忠實記下邀請內容。', '你多存下一條公司語言：隨便，指說的人方便。下次聚餐大家會先吃一個飯糰。', { slack: 6, mood: 5, boss: -9 }, ['archive'])
    ]
  },
  {
    id: 'spencer-bali-roadmap', title: '從峇里島到八里，路線持續優化', era: '日常・董事長旅遊局', speaker: 'spencer', sourceIds: ['spring'],
    body: '員工旅遊簡報第一頁是峇里島的海，第二頁是預算，第三頁還沒做。Spencer 說等公司更上一層樓，大家就能一起出發；目前最確定的移動是從會議室回座位。',
    wing: '不要只看現在的距離，我們要看未來的格局。',
    choices: [
      choice('先整理一份八里的輕旅行提案。', '目的地要有抵達的可能。', '提案很完整，完整到董事長必須認真看預算。最後被列入「之後再討論」的高優先級資料夾。', { skill: 6, dream: -8, boss: -9, mood: 4 }, ['evidence']),
      choice('幫大家做一張海島合照背板。', '照片先抵達。', '大家在會議室完成了出國感。Spencer 說這個點子很有創意，你則開始理解什麼叫低成本國際化。', { lick: 8, boss: 10, slack: 7, trust: -3 }),
      choice('先把自己的特休安排好。', '行程表留一個自己能決定的日期。', '你沒有等公司的海島專案驗收。手機裡多了一份可用的行程，心裡也多了一點陸地。', { mood: 13, energy: 10, cash: -9, dream: -6 })
    ]
  },
  {
    id: 'spencer-investor-deck', title: '投資人明天看，今天先成長', era: '原創・董事長關切', speaker: 'spencer', sourceIds: ['spring', 'characterFiction'], minTurn: 3,
    body: 'Spencer 要一份能讓投資人看見未來的簡報。你打開實際數字，發現未來和現在之間隔著整整十二張投影片。董事長說敘事很重要，你開始替每個假設找註腳。',
    wing: '信心要先到，數字才會跟上。你這頁怎麼看起來那麼沒精神？',
    choices: [
      choice('把實績、預估和前提分開標示。', '讓故事有可以核對的邊界。', '字變多了，線也沒那麼漂亮。Spencer 要你再簡潔一點，但至少你保住了每個數字的出生證明。', { skill: 9, trust: 6, energy: -8, boss: -10 }, ['evidence']),
      choice('把願景頁做得更有舞台感。', '先調整說故事的順序。', '董事長滿意地練習開場。你把尚未實現的部分留在「願景」標題下，投影片終於比今天的心情亮。', { lick: 9, boss: 11, dream: 7, mood: -6 }),
      choice('找同事一起補出真正缺的資料。', '一個人的樂觀不夠做資料庫。', '你們補上了幾項關鍵缺口，也交換了看見同一條曲線時的眼神。這次默契比簡報先交付。', { trust: 12, skill: 8, energy: -12, mood: 4 }, ['archive'])
    ]
  },
  {
    id: 'likr-employee-recommendation', title: '數位店長，請推薦下一個救火的人', era: '原創・產品穿越日常', speaker: 'wing', sourceIds: ['officialStore'],
    body: '數位店長的介紹說要理解使用者、推薦合適內容。會議一轉頭，Wing 問能不能順便推薦今天誰最適合接急件。全場的推薦結果都在偷偷避開自己。',
    wing: '我們都能懂消費者了，難道還不懂誰可以多做一點？',
    choices: [
      choice('先列每個人的工作量與專長。', '推薦需要輸入資料。', '表格讓大家看清楚誰已經接了三個人的工作。Wing 說不用這麼複雜，你卻很高興模型沒有讀心術。', { skill: 10, trust: 10, boss: -12, energy: -6 }, ['evidence']),
      choice('表示願意示範一次跨領域接單。', '你的名字被放進候選名單。', '示範成功，後續需求也成功找到同一個人。你得到一次肯定，以及推薦系統永遠記得你的代價。', { boss: 14, lick: 7, skill: 4, energy: -17, mood: -9 }),
      choice('建議先測試，樣本就從主管開始。', '先用熟悉產品的人驗證。', '討論突然回到客戶的真正需求。你沒有拿到測試資料，卻短暫減少了今天的工單。', { slack: 9, mood: 8, boss: -16 })
    ]
  },
  {
    id: 'cdp-single-truth', title: 'CDP 可以整合資料，能整合說法嗎', era: '原創・全渠道對齊', speaker: 'wing', sourceIds: ['officialHome', 'officialMedia'],
    body: '產品談的是跨渠道整合。你卻收到 Email、會議和私訊三種不同規格，而且每種都被稱為最後確認版。現在最需要統一的輪廓，是需求本人。',
    wing: '不要把管道分那麼細，我說的意思一直都一樣。',
    choices: [
      choice('整理成一張差異表，請大家確認。', '讓三個版本見一次面。', '差異表清楚到會議沒辦法直接跳過。你花掉一段時間，換來同事不必各做一個宇宙。', { skill: 11, trust: 9, boss: -12, energy: -8 }, ['evidence']),
      choice('先照最新一則私訊動手。', '時間戳記暫時擔任主管。', '你很快做出東西，隔天又收到「不是這個意思」。熟悉的流程使你熟練，熟練使你更加熟悉。', { boss: 10, slack: 5, energy: -11, mood: -9 }, ['loop']),
      choice('把所有版本留好，先處理共同部分。', '交集通常比願景小一點。', '你交付了一小塊真正不變的需求，並替剩下的幾塊加上了日期。這回至少知道在哪裡分岔。', { skill: 7, mood: 5, trust: 5, boss: -5 }, ['archive'])
    ]
  },
  {
    id: 'copy-master-late', title: '文案大師與「快好了」的十八種寫法', era: '原創・AI寫作課', speaker: 'wing', sourceIds: ['officialMedia'],
    body: '文案大師可以生成標題與文章。你被要求幫進度週報換一個更有信心的說法，而實際進度仍然卡在同一個尚待確認。',
    wing: '不要每次都寫有風險，文字要讓人有往前走的感覺。',
    choices: [
      choice('保留風險，把下一步寫清楚。', '語氣可以改，期限需要人確認。', '週報沒有變成勵志文學，但同事終於看懂明天先做哪件事。Wing 說還可以再積極一點。', { skill: 9, trust: 7, boss: -9, mood: 3 }, ['evidence']),
      choice('把標題改成「持續朝目標推進」。', '先讓標題抵達下一階段。', '標題成功通過審核。內文裡的問題仍在原地，只是現在有了一個比較漂亮的信封。', { lick: 10, boss: 12, slack: 6, dream: -6 }),
      choice('做一份常用句，留給下次會議。', '把重複的文學需求模組化。', '你建立一個很穩定的句庫。它沒有自我意識，但每一句都非常有主人翁精神。', { slack: 11, skill: 3, mood: 5, boss: -5 }, ['archive'])
    ]
  },
  {
    id: 'askonly-unasked', title: '問問 AI，先不要問預算', era: '原創・智慧問答', speaker: 'wing', sourceIds: ['officialHome'],
    body: '官網的 AskONLY.ai 提供問答入口。你想到一個適合會議的問題：這個需求到底誰驗收？Wing 覺得這題沒有展現 AI 的前瞻性，建議改問如何讓營收成長。',
    wing: '你要問能讓公司前進的問題，不要一直問那些限制。',
    choices: [
      choice('把驗收問題拆成可回答的小項。', '一個大問號拆成很多小問號。', '終於有人說出交付形式和期限。AI 還沒上場，人類已經完成今天最難的推論。', { skill: 10, trust: 6, boss: -10, energy: -6 }, ['evidence']),
      choice('問一個能帶出公司優勢的問題。', '先讓示範順利進行。', 'Wing 在答案還沒出來前就開始補充。你知道了今天最積極的生成式模型坐在哪一張椅子上。', { lick: 9, boss: 12, mood: -5, slack: 4 }),
      choice('把自己的問題存到會後待辦。', '等一個比較有答案的時間。', '待辦清單又多一行。你也多拿回幾分鐘，用來做一件真的有負責人的事。', { energy: 7, slack: 7, dream: -5, boss: -4 })
    ]
  },
  {
    id: 'icml-reading-club', title: '新聞登上頂會，今天輪到你報告', era: '原創・午間讀書會', speaker: 'wing', sourceIds: ['officialNtu'], minTurn: 2,
    body: '公司與台大團隊合作研究的消息被貼進群組。下一則訊息是 Wing 問大家讀懂了沒有，再下一則是你的名字。你還在找論文，午餐已經進入長期保存模式。',
    wing: '人家都能發表了，你有沒有在讀書？別每次只跟我講手上很忙。',
    choices: [
      choice('先讀摘要，列出需要再確認的問題。', '把懂的和還不懂的分開。', '你講清楚了一個概念，也承認兩個問題還在查。Wing 嫌不夠深入，同事卻終於有了一個能接著讀的入口。', { skill: 12, trust: 5, energy: -9, boss: -7 }, ['evidence']),
      choice('先把新聞重點做成三張簡報。', '報告先有一個能打開的版本。', 'Wing 聽到熟悉的關鍵字很滿意。你決定下班再讀真正的方法，因為至少不能永遠只讀新聞標題。', { boss: 11, lick: 8, skill: 3, mood: -5 }),
      choice('請大家輪流，每人講一小節。', '研究團隊之外，也來一次閱讀團隊。', '同事把難點拆開，沒有人需要假裝一口氣懂完。Wing 說你很會分派工作，你第一次把它當成讚美。', { trust: 13, skill: 9, boss: -8, mood: 5 })
    ]
  },
  {
    id: 'rmn-summit-adapter', title: '高峰會的高度，取決於轉接頭', era: '原創・大型論壇', speaker: 'spencer', sourceIds: ['officialSummit'],
    body: '舞台背板寫著 AI 與資訊安全，倒數螢幕剩五分鐘。Spencer 準備開場，你發現簡報電腦和現場接頭來自兩個沒有互通協議的時代。',
    wing: '今天來的都是重要夥伴，畫面一定要漂亮，這個應該很快吧？',
    choices: [
      choice('借轉接頭，再準備離線備份。', '先讓畫面有第二條路。', '投影亮起，論壇順利開始。台上講的是韌性，台下的你用一條線把它接出來了。', { skill: 11, trust: 8, boss: 6, energy: -13 }, ['evidence']),
      choice('先向現場人員確認設備規格。', '把需求送到知道答案的人手上。', '場務找到正確接口。你沒有成為會場英雄，卻避免了在全場面前現場發明一個標準。', { trust: 7, slack: 8, energy: -4, boss: -4 }),
      choice('先跟著董事長彩排開場。', '讓舞台上的部分先準備好。', '開場講得很流暢，接頭最後由同事補上。Spencer 記住你的配合度，同事記住你站在哪裡。', { lick: 10, boss: 12, trust: -11, mood: -6 })
    ]
  },
  {
    id: 'sea-deck-tonight', title: '市場出海，你的簡報先熬夜', era: '原創・東南亞時區', speaker: 'wing', sourceIds: ['officialSea'],
    body: '新馬合作的消息讓會議充滿跨境想像。Wing 問你能不能順便準備不同語言、不同尺寸、不同客群的三套版本；唯一不變的規格是明天早上要。',
    wing: '國際化本來就不能只做一份，你要學著把格局放大。',
    choices: [
      choice('先確認窗口需要的那一套。', '目的地明確，船才開得出去。', '你聯絡到真正使用簡報的人，刪掉兩套沒人要的版本。Wing 說還是要有備案，你已經替今晚省下一點睡眠。', { skill: 9, slack: 6, boss: -10, energy: 4 }, ['evidence']),
      choice('全部先做，內容沿用共用模板。', '把海洋裝進同一份母片。', '你完成三份檔案，並發現同一段話在三種語言裡都叫「待確認」。', { skill: 6, boss: 12, energy: -17, mood: -8 }),
      choice('請各部門認領自己熟的部分。', '跨境之前先跨部門。', '合作比預期慢一點，但終於不是一個人的凌晨。你們留下了一份下次能接著用的素材庫。', { trust: 13, skill: 7, boss: -6, mood: 5 }, ['archive'])
    ]
  },
  {
    id: 'degree-weekly-question', title: '進度報告突然翻到學歷那一頁', era: '原創・履歷複習考', speaker: 'wing', sourceIds: ['schoolLore', 'characterFiction'],
    body: '你正在說明一個可重現的問題，Wing 卻開始問你大學讀什麼。投影幕還停在同一張錯誤截圖，討論已經回到十年前的選填志願。',
    wing: '你們是不是都不讀書？學校教的東西總要拿出來用吧。',
    choices: [
      choice('回到實驗步驟，示範問題怎麼發生。', '讓討論回到眼前的工作。', '問題被重現了，學歷暫時無法修改錯誤訊息。Wing 說態度可以更好，你把操作步驟交給同事。', { skill: 10, trust: 7, boss: -13, mood: -4 }, ['evidence']),
      choice('先說自己還有很多要學。', '先把履歷關起來。', 'Wing 終於翻回進度頁。你今天學到的是有些問題沒有考試範圍，卻永遠需要考生謙虛。', { lick: 10, boss: 12, mood: -9, dream: -5 }),
      choice('約同事午休一起讀一篇實用文件。', '讀書至少要對自己有用。', '你們解掉另一個卡很久的問題。沒有人問對方哪裡畢業，大家只問這段能不能再解釋一次。', { skill: 9, trust: 12, mood: 8, energy: -5 })
    ]
  },
  {
    id: 'degree-ntu-footnote', title: '台大兩個字，後面還要看括號', era: '原創・學歷篩選器', speaker: 'wing', sourceIds: ['characterFiction'],
    body: '履歷討論會上，Wing 聽見台大先點了頭，聽見 EMBA 又把頭收回去。接著有人提到商管，他便把整張表往旁邊推，彷彿科系名稱是一套已經訓練完成的判斷模型。',
    wing: '不要只看校名，還要看讀的是什麼。算了，你們先把作品給我看。',
    choices: [
      choice('提議先匿名看作品與解題過程。', '把標籤放到最後再看。', '大家意外選中了剛才被跳過的作品。Wing 說他本來就重視能力，你沒有急著替這句話加上時間戳。', { skill: 10, trust: 10, boss: -12, mood: 4 }, ['evidence']),
      choice('把候選人的校系資料排得更清楚。', '表格先讓決策者看得順。', '欄位增加到足以辦一場升學說明會。工作測驗還沒開始，履歷卻已經考了三輪。', { lick: 8, boss: 10, mood: -8, skill: -3 }),
      choice('問這個職位真正要完成哪三件事。', '職缺也需要一份題目。', '會議終於出現三個具體任務。你記下它們，因為今天最稀有的學歷叫做知道自己在招什麼人。', { skill: 8, trust: 7, boss: -8, energy: -5 }, ['archive'])
    ]
  },
  {
    id: 'reading-list-rush', title: '叫你多讀書，也叫你現在交', era: '原創・知識排程衝突', speaker: 'wing', sourceIds: ['characterFiction'],
    body: 'Wing 一早傳了三篇文章，說大家就是不讀書才做不好。你剛讀到第二段，同一個聊天室跳出一則：「我昨天要的東西呢？」',
    wing: '讀書要利用自己的時間，公司的時間要拿來創造價值。',
    choices: [
      choice('把閱讀與交付排進同一張待辦。', '先算今天究竟有幾個小時。', '你完成一件事並讀懂一個概念。Wing 對另一項沒完成仍有意見，時間卻沒有因為意見增加。', { skill: 11, mood: 4, boss: -10, energy: -6 }, ['evidence']),
      choice('先回「已讀」，再趕交付。', '訊息狀態先更新。', '工作交了，文章沒讀。你熟練地維持了組織中最常見的知識狀態：大家都知道大家看過了。', { slack: 10, boss: 8, skill: -3, energy: -6 }),
      choice('整理一頁重點分享給同事。', '讓閱讀至少不只消耗一個人。', '同事補上你漏掉的一段，你們讀得比各自假裝懂更快。聊天室第一次多了一則有用的回覆。', { skill: 9, trust: 11, energy: -9, mood: 6 }, ['archive'])
    ]
  },
  {
    id: 'hope-care-spreadsheet', title: 'Hope 的關懷表，欄位比關懷多', era: '原創・人資關懷', speaker: 'hope', sourceIds: ['pip'], minTurn: 3,
    body: 'Hope 說這不是考核，只是想了解你的近況。表格裡卻有改善項目、完成期限與主管觀察，最後一欄叫「其他」。你有很多其他，但不知道從哪一項開始。',
    wing: '我們都是希望你更好，你不要先帶著防備心，好嗎？',
    choices: [
      choice('請她把每項標準與例子寫下來。', '先確認彼此說的是同一件事。', 'Hope 說還要回去了解。表格沒有填滿，你卻替自己留下了今天真正問過的問題。', { skill: 8, boss: -10, mood: 4, energy: -6 }, ['evidence']),
      choice('把每一欄都寫得積極又謙虛。', '讓表格擁有它想要的情緒。', 'Hope 稱讚態度有進步。你交出一份漂亮的近況，真正的近況則等下班才跟同事說。', { lick: 9, boss: 12, mood: -10, dream: -6 }),
      choice('約同事一起釐清工作分工。', '先找知道實際工作的人談。', '你們把幾個被混在一起的責任拆開。表格還在，至少你不必獨自承受所有空白欄位。', { trust: 12, mood: 9, boss: -8, energy: -4 }, ['archive'])
    ]
  },
  {
    id: 'mis-printer-is-ai', title: '公司有 AI，印表機先找你', era: '職業・MIS', speaker: 'sonny', sourceIds: ['characterFiction'], roles: ['mis'], weight: 1.3,
    body: '你正在整理存取權限，Sonny 丟來一張印表機面板照。機器說卡紙，群組說很急，Wing 的會議在樓上等紙；這是你今天第一個沒有任何人工智慧成分的智慧辦公任務。',
    wing: '先讓它能印，其他事情等大家開完會再說。',
    choices: [
      choice('排除卡紙，順便留下故障紀錄。', '先解眼前問題。', '紙順利出來，會議也順利延長。你留下一張紀錄，證明今天延誤的不是網路。', { skill: 10, boss: 7, energy: -9, mood: -4 }, ['evidence']),
      choice('提供電子檔，請大家先用平板看。', '找一條不需要紙的路。', '同事打開文件，Wing 說他還是習慣紙本。你暫時解決一半需求，剩下一半叫做習慣。', { skill: 6, trust: 9, boss: -12, slack: 5 }),
      choice('寫一張簡單排除步驟貼在機器旁。', '讓下一位使用者也有辦法。', '有人照著做成功了。你少接到一通電話，又多接到一項「順便幫其他設備也貼一下」。', { skill: 7, slack: 10, trust: 7, energy: -6 })
    ]
  },
  {
    id: 'mis-account-handover', title: '帳號先關，交接還在裡面', era: '職業・MIS', speaker: 'sonny', sourceIds: ['slackHall', 'characterFiction'], roles: ['mis'], minTurn: 2,
    body: 'Sonny 要你核對一份帳號清單。某個帳號已經停用，交接文件的擁有者卻正好是它，部門群組開始問檔案去哪了。你看見了一個很完整的離職流程，除了順序。',
    wing: '先確認交接在哪裡，不要等大家找不到才來問。',
    choices: [
      choice('核對授權，完成文件移轉再確認關閉。', '每一步都留下紀錄。', '文件回到該管理的人手上。你補出一份清單，免得下次又要從搜尋不到的名字開始找。', { skill: 12, trust: 10, energy: -8, boss: -6 }, ['evidence']),
      choice('先請部門確認需要保留哪些資料。', '不要替所有人猜一次。', '各部門交來四份格式不同的清單。工作增加了，至少責任不再只有你一個登入帳號。', { skill: 7, trust: 6, boss: -7, energy: -5 }, ['archive']),
      choice('建立一份可重複使用的離職檢核表。', '讓流程記住今天的順序。', '這張表成了你的熱門作品。大家說做得很好，下次急件來時又問能不能先跳過兩格。', { slack: 11, skill: 8, boss: 5, mood: -4 })
    ]
  },
  {
    id: 'mis-access-approval', title: '全公司都要權限，只有你沒有決定權', era: '職業・MIS', speaker: 'jenjen', sourceIds: ['characterFiction'], roles: ['mis'], weight: 1.2,
    body: 'JenJen 說新主管今天就要所有系統的權限。你問授權範圍，她說先處理再補；資安文件則安靜地躺在另一個視窗，裡面每一行都寫著先核准。',
    wing: '不要每件小事都卡流程，現在需要的是效率。',
    choices: [
      choice('列出必要權限，請權責主管確認。', '先讓需求有一個簽名的人。', '你花了一個下午等核准，最後只需要原清單的一小部分。大家忙著登入，沒人注意你替公司少開了幾扇門。', { skill: 12, trust: 7, boss: -13, energy: -7 }, ['evidence']),
      choice('先提供不涉及敏感功能的基本存取。', '把可做和待確認的拆開。', '新人開始工作，剩下項目排進審核。JenJen 說這樣也可以，你悄悄把這句話留在工單裡。', { skill: 9, boss: 5, mood: 4, energy: -5 }, ['archive']),
      choice('請主管帶著需求一起找核准窗口。', '讓緊急程度親自出席。', '當主管自己要解釋每項用途時，清單突然變短。你第一次發現最有效的權限管理工具叫同行。', { slack: 10, trust: 6, boss: -9, mood: 6 })
    ]
  },
  {
    id: 'legal-title-sync', title: '名片升過了，系統還沒升', era: '原創・文件同步', speaker: 'erich', sourceIds: ['pip', 'departures'], minTurn: 4,
    body: '你核對人事資料，發現名片、通訊錄與系統裡有三種職稱。Erich 請你把需要修正的地方列清楚，JenJen 則說系統一直就是這樣。現在輪到你證明自己究竟是誰。',
    wing: '有紀錄的話就一起提出來，先把資料對齊。',
    choices: [
      choice('整理任命通知和名片版本。', '每次變動都附上日期。', '資料終於更新了。你花掉半天，完成一件照理不該由自己舉證的身份驗證。', { skill: 8, mood: 6, energy: -8, boss: -5 }, ['evidence']),
      choice('先保留副本，等有需要時一起處理。', '別讓今天又被表格吃光。', '你把三個版本收進同一個資料夾。電腦第一次清楚知道你的升遷歷程，比公司系統早了一步。', { slack: 9, mood: 4, boss: -4 }, ['archive']),
      choice('主動幫同事一起檢查。', '或許平行職稱不只一份。', '又找出兩個不同步的欄位。你們共同完成一次組織考古，並約好以後升職先存通知。', { trust: 13, skill: 5, energy: -10, mood: 7 })
    ]
  }
);

// The budget dinner belongs to the chairman's fictional role, not the CEO's.
const budgetDinner = EVENTS.find((event) => event.id === 'dinner-budget');
if (budgetDinner) {
  budgetDinner.speaker = 'spencer';
  budgetDinner.choices = budgetDinner.choices.map((option) => ({ ...option, result: option.result.replaceAll('Wing', 'Spencer') }));
}

// Expanded fictional scenes are exclusive to e2 rules. Keep older scenes and their
// order intact so earlier saved runs retain their original replay sequence.
EVENTS.push(...[
  {
    id: 'rick-phone-wakeup', title: '待機中的資深經理，來電即喚醒', era: '史冊改編・乾兒子宇宙', speaker: 'rick', sourceIds: ['rickLore', 'characterFiction'], weight: 1.8,
    body: '技術資深經理 Rick 剛才還閉著眼，Wing 的電話一響，立刻坐直：「老闆，你這個想法真的走在前面。」同事惡搞的角色卡寫著「工作 8／舔功 100」，技能叫「乾兒子模式」。你手上的故障單等了半小時，他的讚美卻沒有冷啟動時間。',
    wing: '老闆的方向我完全理解。細節你先處理，我待會兒再看。',
    choices: [
      choice('把故障狀況整理成三句，等他掛電話。', '', '電話講完，Rick 把你那三句轉述給 Wing，開頭是「我剛剛查了一下」。問題有人聽見了，作者沒有。', { skill: 7, boss: 5, energy: -9, mood: -12 }, ['evidence']),
      choice('學他那個點頭角度，幫忙補一句願景。', '', 'Rick 滿意地示範第二種笑聲。你今天沒有學到技術，倒是學會了聲帶如何替職涯服務。', { lick: 11, boss: 10, skill: -3, trust: -7, mood: -8 }),
      choice('先和同事把故障修好，記下實際分工。', '', '故障恢復，Rick 說「我就知道你們可以」。你們的工單裡多了一條完成紀錄，以及一條未被領導過的領導成果。', { skill: 10, trust: 9, energy: -10, mood: -5, boss: -7 }, ['archive', 'evidence'])
    ]
  },
  {
    id: 'rick-author-name', title: '作者欄是他，使用說明是你', era: '史冊改編・技術資深轉接台', speaker: 'rick', sourceIds: ['rickLore'], roles: ['system', 'ai', 'mis', 'project', 'product'], weight: 1.4,
    body: '你追查排程，在作者欄看到 Rick，便去問他設計原理。他說名字只是放上去方便管理，程式可以去問別組。你繞了一圈回來，別組正在等你接手。問題像電話，被轉接得很有禮貌。',
    wing: '你先研究啊。你會了，我們部門不就都會了？',
    choices: [
      choice('讀程式、畫流程，附上真正的維護名單。', '', '你搞懂了排程，Rick 也收到一份。下次會議他說「我們很熟」，你已經不確定「我們」是一個代名詞還是一種授權方式。', { skill: 12, trust: 7, energy: -13, mood: -8 }, ['evidence']),
      choice('請 Rick 親自帶你跑一次操作。', '', '他說下午再約，下午改成明天。你保住一點體力，也得到一個會自動展延的主管行事曆。', { slack: 8, energy: 4, boss: -12, mood: -7 }),
      choice('把他寫成顧問，自己把問題處理掉。', '', '文件上的組織架構很完整，實際解題的人還是只有你。Rick 稱讚你開始懂得團隊合作了。', { skill: 6, lick: 7, boss: 9, energy: -10, mood: -11 })
    ]
  },
  {
    id: 'rick-vacation-proxy', title: '職務代理人，正在問登入網址', era: '史冊改編・休假前置作業', speaker: 'rick', sourceIds: ['rickLore', 'workRules'], minTurn: 3,
    body: '人資提醒補休快到期，你填好休假單，代理人是 Rick。他先問當天誰要處理系統，再問後台在哪裡，最後問能不能請假時保持聯絡。休假明明還沒開始，你已經累了。',
    wing: '我當然可以代理。真的有事，還是你最熟嘛。',
    choices: [
      choice('做一次交接演練，請他親手操作。', '', 'Rick 終於登入成功。你用半天證明了代理人的第一關叫做登入，而不是把電話轉給正在休假的人。', { skill: 9, trust: 6, energy: -10, mood: -7, boss: -8 }, ['evidence']),
      choice('答應保持聯絡，先讓假單過關。', '', '假單寫著休假，通知寫著在線。Rick 說有你在比較放心，你開始覺得那張假單只是不同背景色的工單。', { boss: 9, lick: 5, mood: -14, energy: -7 }),
      choice('把必要資訊交清楚，約定回來再處理非急件。', '', 'Rick 再問了一次「真的都在文件裡嗎」。你指出目錄，終於替自己的假期保留了一小塊沒有鈴聲的地方。', { mood: 6, energy: 7, boss: -14, trust: 4 }, ['evidence'])
    ]
  },
  {
    id: 'rick-architecture-relic', title: '架構圖是真跡，箭頭方向請通靈', era: '史冊改編・技術會議', speaker: 'rick', sourceIds: ['rickLore'], roles: ['system', 'ai', 'mis', 'project', 'product', 'executive'], minTurn: 2,
    body: 'Rick 拿出 Wing 手畫的架構圖，向廠商介紹未來。廠商問兩個方框之間傳什麼，他把同一支箭頭描粗一點。你原本來聽解法，現在像在參加書畫鑑賞。',
    wing: '老闆畫這個一定有他的考量，你們再理解一下。',
    choices: [
      choice('補上資料流、介面與待確認項目。', '', '廠商終於能估工。Rick 說你的版本少了一點宏觀，你看著新增的十二個問號，覺得它已經很寬廣。', { skill: 12, trust: 8, boss: -10, energy: -9, mood: -5 }, ['evidence']),
      choice('先把原圖做成漂亮簡報。', '', '箭頭變成漸層色，沒有任何資料因此知道自己該去哪裡。Rick 說這樣就有專業感了。', { lick: 8, boss: 11, skill: -4, mood: -9 }),
      choice('請 Rick 解說每個方框負責什麼。', '', '他繞著圖講了一圈，最後說細節再請你補。你第一次看見一場真正沒有出口的架構。', { slack: 6, boss: -12, mood: -10, energy: -5 }, ['archive'])
    ]
  },
  {
    id: 'rick-two-voices', title: '兩個人報告，一個人知道系統在幹嘛', era: '史冊改編・父子雙聲道', speaker: 'rick', sourceIds: ['rickLore'], minTurn: 4, weight: 1.3,
    body: '客戶追著成效問，Rick 拉你進會議，先說自己一直有掌握；Wing 接著稱讚方向正確。輪到你，投影片只剩一頁標著「工程待改善」。這份報告有兩個主持人，一個待辦事項。',
    wing: '你把技術面的部分解釋一下，我們剛剛已經把大方向講完了。',
    choices: [
      choice('照時間線說明需求、決策與目前進度。', '', '你的說明讓問題變清楚，也讓氣氛變僵。Rick 說不要把大家分那麼細，剛才分功勞時倒是沒有這個困擾。', { skill: 8, trust: 11, boss: -18, mood: -6, energy: -7 }, ['evidence']),
      choice('把問題先接下來，讓兩位順利下台。', '', 'Wing 覺得你這次有擔當。Rick 說辛苦了，轉身又說「我們處理得不錯」。你同時獲得兩份肯定與全部的加班。', { boss: 15, lick: 6, energy: -15, mood: -14, trust: -4 }),
      choice('把下一步分成三份，逐一請負責人確認。', '', 'Rick 的那份被改叫「方向指導」。至少你與同事那兩份有了邊界，不必再替整場戲收字幕。', { skill: 7, trust: 8, boss: -10, energy: -5, mood: -4 }, ['evidence'])
    ]
  },
  {
    id: 'rick-formula-owner', title: '公式改一下，誰決定的先別問', era: '史冊改編・報表口徑', speaker: 'rick', sourceIds: ['rickLore', 'productLore'], roles: ['system', 'ai', 'project', 'product', 'bd', 'sales'], minTurn: 4,
    body: 'Rick 拿來一張新的內部試算表，說參數要調整，對外的說明之後再補。BD 已經在追兩個版本為什麼不同。你看見問題根本不在小數點，而在每個人拿著不同的答案。',
    wing: '方向上面決定了，你先改，問題真的來了再說。',
    choices: [
      choice('先記錄口徑與核准人，請各部門確認。', '', '討論拖長了，正式參數也終於有人簽名。Rick 說你很愛留紀錄，你覺得這句評語比沒人承認的口頭指令可靠。', { skill: 10, trust: 10, boss: -14, energy: -7, mood: -5 }, ['evidence', 'archive']),
      choice('只做模擬版本，留待對齊後才上線。', '', '兩張表放在一起，差異突然不再抽象。你多做一份比較，也少做一場日後必開的責任辯論。', { skill: 9, boss: -8, energy: -8, mood: -4 }, ['evidence']),
      choice('先埋頭更新，之後再追說明。', '', '表改好了，BD 開始追你。Rick 說方向不是他定的。你發現只有程式碼能準確記得最後是誰按下儲存。', { boss: 8, skill: 4, trust: -10, energy: -10, mood: -15 })
    ]
  },
  {
    id: 'rick-common-fund', title: '共同基金，共同的部分由主管定義', era: '史冊改編・部門飲料', speaker: 'rick', sourceIds: ['rickLore', 'benefitsLore'], minTurn: 3,
    body: '同事準備離開，想用還沒用完的部門活動額度請幫忙過的隔壁組喝飲料。Rick 說這樣範圍太廣。大家一起出的錢，忽然需要研究誰才算「大家」。',
    wing: '部門的錢就要照部門的規矩，你不要每件事都想自己決定。',
    choices: [
      choice('整理帳目和使用規則，一起問清楚。', '', 'Rick 覺得一杯飲料沒有必要這麼複雜。你也這麼覺得，所以才想知道是誰把它弄得這麼複雜。', { skill: 6, trust: 11, boss: -13, energy: -6, mood: -7 }, ['evidence']),
      choice('自己請大家喝，歡送先照辦。', '', '大家好好喝完一杯，也好好說了再見。Rick 說這樣處理就很好，你決定把收據留給自己，感謝留給同事。', { cash: -7, trust: 12, mood: 7, energy: 3, boss: 3 }),
      choice('把聚會移到下班後，各自買喜歡的。', '', '沒有核准人，大家卻意外很會合作。你們坐在路邊聊了一晚，沒有任何人被要求代表部門感恩。', { cash: -3, mood: 8, trust: 7, boss: -6 }, ['archive'])
    ]
  },
  {
    id: 'rick-four-am-delivery', title: '凌晨四點交付，主管下午想起來', era: '史冊改編・急件時差', speaker: 'rick', sourceIds: ['rickLore', 'departures'], minTurn: 3, weight: 1.3,
    body: 'Rick 昨天說急到不能等，你熬夜把東西送出去。今天問他看了沒，他說還沒空。你經過他的座位，手機螢幕暗著，眼睛也暗著。原來最急的只有你的睡眠。',
    wing: '做完就好，先放著。我有需要的時候再找你。',
    choices: [
      choice('留下交付時間，約一個實際驗收時段。', '', '你終於約到驗收。Rick 說不必一直強調幾點完成，你心想那他昨天也可以不必一直強調幾點要。', { skill: 8, trust: 5, boss: -12, energy: -8, mood: -12 }, ['evidence']),
      choice('順便多做兩版，證明自己扛得住。', '', '兩版都被收進「之後再看」。Rick 稱讚你積極，你把這份積極折算成了今天第三杯咖啡。', { skill: 7, boss: 12, energy: -17, mood: -14 }, ['allin']),
      choice('先補休一下，醒來再回非急件。', '', '休息前有三則訊息，醒來還是那三則。你第一次用實驗證明，有些公司的急件可以自己等。', { energy: 13, mood: 5, boss: -15, slack: 7 })
    ]
  },
  {
    id: 'cdn-teacher-license', title: 'CDN 可以快取，老闆的面子不能失效', era: '史冊改編・網路常識', sourceIds: ['resourceLore'], roles: ['system', 'ai', 'mis', 'project'],
    body: '連線數看起來不對，你才說出 CDN 三個字，Wing 就打斷你，表示這東西最早是他教大家的。數據還沒有開始解釋，講課資格已經先被撤銷。',
    wing: '這些基本的東西我都知道，你不要把時間浪費在教我。',
    choices: [
      choice('跳過名詞，直接比對請求紀錄。', '', '紀錄指向快取設定。你把答案寫在報告裡，Wing 說這就是他原本想講的。至少設定終於能改了。', { skill: 12, boss: -8, energy: -7, mood: -7 }, ['evidence']),
      choice('說「對，就是照您的思路查的」。', '', '同一張圖忽然變得容易理解。你看著邏輯終於通過人際關係防火牆，不知道該開心還是關機。', { lick: 10, boss: 12, mood: -10, skill: 3 }),
      choice('讓監控先跑，會後和同事查。', '', '會議少吵一輪，你們多做一輪。晚上找到原因時，群組正在稱讚今天的會議很有效率。', { slack: 5, trust: 9, skill: 7, energy: -10, mood: -8 })
    ]
  },
  {
    id: 'disk-suitcase-cloud', title: '雲端空間不足，請裝進主管筆電', era: '史冊改編・硬碟搬家', sourceIds: ['resourceLore', 'cloud'], roles: ['system', 'ai', 'mis', 'project'],
    body: '儲存空間快滿，擴充申請沒過。新解法是先把檔案下載到主管電腦。公司的雲終於有了具體形狀：一台明天可能被帶去出差的筆電。',
    wing: '不能什麼問題都靠花錢，工程師就是要想辦法。',
    choices: [
      choice('先清理可刪資料，列出保留與備份需求。', '', '你省下一點空間，留下真正需要預算的清單。Wing 覺得這次有辦法，下次額度滿時應該還會覺得你有辦法。', { skill: 11, boss: 5, energy: -11, mood: -9 }, ['evidence']),
      choice('做一份容量與故障風險比較。', '', '你解釋了筆電休眠與雲端可用性的關係。Wing 問能不能叫主管先不要休眠，包含電腦和人。', { skill: 9, trust: 7, boss: -12, mood: -7, energy: -6 }, ['evidence']),
      choice('先分類冷資料，排定之後的搬遷。', '', '緊急警報暫時解除。你多出一張搬遷清單，清單最後一欄寫著「等預算」，沒有日期。', { slack: 8, skill: 6, boss: 4, mood: -6 })
    ]
  },
  {
    id: 'overtime-version-history', title: '加班是真的，計算單位持續更新', era: '史冊改編・工時版本庫', speaker: 'hope', sourceIds: ['workRules'], minTurn: 3,
    body: '同事翻出舊公告：以前記分鐘，後來記半小時，現在又多了一道審核。Hope 說以最新版為準。你的疲勞沿用舊版累積，報表卻不提供版本轉換工具。',
    wing: '我們先把流程補齊，不要讓一張表影響大家對你的觀感。',
    choices: [
      choice('把實際工時與主管交辦紀錄一起整理。', '', '表格變厚了，疲勞沒有變薄。至少哪天做了什麼，現在有一份不用靠誰記性的紀錄。', { skill: 7, trust: 6, energy: -8, mood: -9, boss: -10 }, ['evidence']),
      choice('吞下這次麻煩，表態以後會更有效率。', '', 'Hope 說你的態度很好。你多學會一種效率：用一句自責，替所有人省掉研究制度的時間。', { lick: 8, boss: 10, mood: -15, dream: -6 }),
      choice('重排工作量，把做不完的列給主管選。', '', '主管覺得每項都重要，你請他先選三項。清單沒有神奇縮短，你也沒有神奇長出另一個晚上。', { skill: 8, energy: 5, mood: -4, boss: -13 }, ['evidence'])
    ]
  },
  {
    id: 'leave-still-online', title: '請你快點休假，順便快點回來', era: '史冊改編・補休雙重指令', speaker: 'hope', sourceIds: ['workRules'], minTurn: 3,
    body: '昨天才提醒你補休快過期，今天假一排下去，主管又說辦公室需要幫忙。系統成功核准了一天休假，組織尚未核准你那天不存在。',
    wing: '假還是你的假，只是大家有需要的時候互相體諒一下。',
    choices: [
      choice('確認代理窗口，把訊息通知關掉。', '', '回來後有人問你昨天為何沒回。你打開假單，大家像第一次見到這種可以預先告知的文件。', { energy: 12, mood: 7, boss: -16, slack: 5 }, ['evidence']),
      choice('留在線上，至少不用通勤。', '', '你在家完成同樣的工作。公司少用一張椅子，你少了一天真正能補回來的休息。', { boss: 9, energy: -8, mood: -13, lick: 4 }),
      choice('只接一個已約好的交接時段。', '', '十分鐘拖成半小時，你仍在時間到時收線。界線沒有完整守住，總比整天只剩一句「都可以」好。', { mood: 3, energy: 5, trust: 5, boss: -7 })
    ]
  },
  {
    id: 'clock-human-alarm', title: '18:30，會走路的下班鈴', era: '史冊改編・時間守恆', sourceIds: ['workRules'],
    body: '一位同事收包起身，另一位的下班鬧鐘剛好響。整排的人同時抬頭，像收到一個久違的系統校時訊號。Wing 正在這時丟來一句「順便聊一下」。',
    wing: '怎麼時間一到就走？你們對事情有沒有一點熱情？',
    choices: [
      choice('記下待辦，明天一早接著做。', '', '你準時走出門，背後還有一點不滿。外面的天空沒有要求你先寫熱情報告，感覺挺新鮮。', { energy: 10, mood: 6, boss: -14, slack: 4 }),
      choice('留下來聽完那個「一下」。', '', '熱情被延長四十分鐘，內容可以濃縮成兩行。你錯過一班車，順便更新了對「一下」的認識。', { boss: 9, lick: 4, energy: -12, mood: -11 }),
      choice('先問要決定什麼，再約明天的時段。', '', 'Wing 說只是聊聊，你說那明天聊得更完整。他不太高興，但行事曆終於有了一個有邊界的格子。', { skill: 6, mood: 3, energy: 6, boss: -9 }, ['evidence'])
    ]
  },
  {
    id: 'shareholder-no-chair', title: '你有股份，現場沒有你的椅子', era: '史冊改編・股東座位有限', speaker: 'spencer', sourceIds: ['benefitsLore'], minTurn: 6,
    body: '股東會通知到了，接著又有人提醒現場座位有限，員工股東可以委託出席。你當初買的是公司的一小部分，沒想到其中似乎不含一張折疊椅。',
    wing: '大家都是一家人，程序有人幫忙處理就好。',
    choices: [
      choice('確認會議資料與出席方式。', '', '你拿到一份正式資料。Spencer 覺得你很認真，你則覺得認真是把錢放進去後很合理的後續動作。', { skill: 7, mood: -5, boss: -8, dream: -6 }, ['evidence']),
      choice('交給熟悉的人，自己把工作做好。', '', '流程順利完成，你仍不知道那張空椅子最後坐了誰。對願景的參與感暫時維持在通訊軟體的已讀狀態。', { boss: 7, slack: 6, mood: -7, dream: -5 }),
      choice('把問題和同事一起整理再提。', '', '你們發現問題其實很像：進度、資訊，以及自己到底有沒有被算進「大家」。共同持有的東西多了一份問題清單。', { trust: 11, skill: 5, mood: -4, boss: -10 }, ['archive', 'evidence'])
    ]
  },
  {
    id: 'travel-staff-prize', title: '員工旅遊，工作人員也想當員工', era: '史冊改編・加碼的邊界', speaker: 'spencer', sourceIds: ['benefitsLore'],
    body: '各組比賽頒獎，Spencer 興致一來宣布加碼。你和幫忙搬東西、計分、控場的同事對看一眼：大家今天也有一組，名字叫工作人員。獎金表裡還沒找到這組。',
    wing: '你們今天也很辛苦啦，這個我們回去再看看怎麼安排。',
    choices: [
      choice('請活動窗口記下用途、金額與後續負責人。', '', '一句加碼終於變成有人要追的事情。你得到的第一個獎品是追蹤表，希望最後一個不會也是它。', { skill: 6, trust: 8, boss: -8, energy: -5, mood: -7 }, ['evidence']),
      choice('先說謝謝董事長，幫大家拍合照。', '', '照片裡每個人都很有收穫。你負責拍照，所以今天最完整的收穫仍然不包含你自己。', { lick: 8, boss: 11, energy: -6, mood: -10 }),
      choice('收完最後一箱，和工作組自己吃點東西。', '', '大家終於能坐下。沒有頒獎台，但有人把最後一塊點心分給你，這份加碼當場到帳。', { cash: -4, trust: 11, mood: 8, energy: 6 })
    ]
  },
  {
    id: 'wireframe-revival', title: '昨天不收線框圖，今天問你會不會', era: '史冊改編・設計輪迴', sourceIds: ['designLore'], roles: ['design', 'product', 'project'], weight: 1.4,
    body: '你照先前要求，把完整介面輸出成 PDF。Wing 看了一眼，開始介紹線框圖多麼適合溝通。你硬碟裡那份半年前被嫌「我要看真的畫面」的檔案，忽然等到了復活日。',
    wing: '設計之前要先想流程，你們會不會用線框圖？',
    choices: [
      choice('打開舊稿，接著確認流程。', '', '舊稿得到今天的認可。你沒有說它上次被退回的原因，免得又要重畫一個更早的版本。', { skill: 9, slack: 7, boss: 5, mood: -8 }, ['loop']),
      choice('把各階段要看的內容寫成確認表。', '', 'Wing 說不用搞得那麼制式。你留下一份自己看得懂的流程，至少下次復活時能找到墓碑。', { skill: 10, trust: 7, boss: -13, mood: -6, energy: -5 }, ['evidence']),
      choice('稱讚新方法，重新包裝一次。', '', '同一條流程換了標題，成為今天最大的創新。你學到設計不只要會做，還要懂得何時假裝第一次做。', { lick: 10, boss: 12, energy: -8, mood: -11 })
    ]
  },
  {
    id: 'ai-copy-proofreader', title: 'AI 寫完了，人工請開始收尾', era: '史冊改編・新聞稿生成器', sourceIds: ['designLore', 'productLore'],
    body: '一份生成的新聞稿被丟進群組，語氣雄心萬丈，產品名稱與繁簡字卻各自旅行。主管說只要稍微潤一下。這個「稍微」包含查資料、改語氣，以及把還不存在的功能請出文章。',
    wing: '工具都幫你寫完了，怎麼還要花那麼久？',
    choices: [
      choice('逐項核對功能，再校稿。', '', '文章終於能讀，也比較接近能交付的產品。你花掉的時間沒有被叫做工作，被叫做工具還不熟。', { skill: 10, trust: 7, energy: -10, mood: -9, boss: -8 }, ['evidence']),
      choice('先修最明顯的字，再列出待確認處。', '', '主管說括號太多，氣勢會斷。你想產品缺的地方也不少，只是現在先由括號負責誠實。', { skill: 6, slack: 5, boss: -6, mood: -5 }, ['evidence']),
      choice('照他喜歡的口氣，再生成一個華麗版本。', '', '文章又長了一倍，產品沒有。主管覺得這版有高度，你負責往下看，確認下面到底還有沒有地板。', { lick: 7, boss: 11, skill: -3, mood: -10, dream: 3 })
    ]
  },
  {
    id: 'statistics-eighty-percent', title: '中位數以下，可以塞進八成人', era: '史冊改編・辦公室統計課', sourceIds: ['meetingLore'],
    body: 'Wing 指著表格講績效分布，宣布大部分工程師都在中位數以下。你看著圖表，發現統計學今天也需要先通過試用期。會議室裡沒有人想當那個舉手的人。',
    wing: '不要抓字眼，我在講的是你們整體還有很大的進步空間。',
    choices: [
      choice('把定義與資料範圍一起補在圖上。', '', '圖表正確了，Wing 說你太執著細節。你得到一張可以解釋的分布圖，與一個不能解釋的臉色。', { skill: 10, trust: 6, boss: -16, mood: -7 }, ['evidence']),
      choice('點頭，改用「成長空間」當標題。', '', '數學沒有變，只是從標題撤退。Wing 說這樣就抓到重點了，你默默替中位數辦了離場手續。', { lick: 9, boss: 12, skill: -4, mood: -10 }),
      choice('會後和同事確認各自真正要改善什麼。', '', '你們列出具體任務，終於有了不需要猜老闆情緒的進步方式。今天的課後輔導比正課有用。', { skill: 7, trust: 11, energy: -6, mood: 3, boss: -5 })
    ]
  },
  {
    id: 'chips-linear-algebra', title: '讀書會帶了洋芋片，忘了帶共識', era: '史冊改編・資料科學社團', sourceIds: ['meetingLore'], roles: ['ai', 'system', 'product', 'project'],
    body: '有人想分享線性代數，有人想解決明天要上的功能。你抱著電腦坐中間，桌上洋芋片還沒吃完，會議已經開始爭論什麼才算真正的學習。',
    wing: '你們平常到底有沒有讀書？可是工作進度也不能落後。',
    choices: [
      choice('把理論接到一個實際問題上。', '', '大家終於討論同一件事。你用一包洋芋片的時間完成一次翻譯：把學習翻成彼此聽得懂的需求。', { skill: 11, trust: 10, energy: -7, mood: 3 }),
      choice('先說讀書重要，回座再補進度。', '', '會議有了氣質，你的晚上沒有了。你多懂一個公式，少了一段可以自由使用的時間。', { skill: 8, boss: 7, energy: -12, mood: -10 }),
      choice('提議輪流分享，今天先收工。', '', '下一次的題目先排好了。大家走出會議室時各有一點不服，至少沒有把整週都拿來證明自己比較愛讀書。', { slack: 7, trust: 5, boss: -8, mood: -4, energy: 4 })
    ]
  },
  {
    id: 'aircon-career', title: '工程師的專長，取決於現在什麼壞了', era: '史冊改編・隱藏職務', sourceIds: ['resourceLore', 'officeLore'], roles: ['system', 'ai', 'mis', 'design'],
    body: '辦公室冷氣沒開，你剛好離遙控器最近。主管問為什麼不處理，你看著自己的工作清單，發現冷氣、印表機、採買和主業正在角逐第一優先。今天的工程領域叫室內溫度。',
    wing: '都是工程師，這種小事情還要分那麼清楚？',
    choices: [
      choice('處理眼前設備，順便把操作方式貼好。', '', '冷氣啟動，大家都舒服了。你多了一項人人記得的技能，和一項大家暫時忘記的原定交付。', { skill: 5, trust: 8, boss: 5, energy: -7, mood: -8 }),
      choice('找設備窗口，先把主業完成。', '', '事情被交給真正的窗口。主管覺得你不夠彈性，你卻終於記起自己當初應徵的是什麼。', { skill: 8, energy: 3, boss: -12, mood: -4 }, ['evidence']),
      choice('先接下來，笑說今天又跨域了。', '', '大家笑了，新的雜事也跟著來了。你發現幽默可以化解尷尬，不能自動縮小職務範圍。', { lick: 6, boss: 9, trust: 4, energy: -10, mood: -10 })
    ]
  },
  {
    id: 'monitor-chain', title: '螢幕串螢幕，責任串到 MIS', era: '史冊改編・桌面拓樸', speaker: 'sonny', sourceIds: ['officeLore'], roles: ['mis', 'system', 'ai'],
    body: '有人把一台螢幕接到另一台，期待畫面自然延伸。兩台都不亮時，群組開始問 MIS 為什麼沒有弄好。你走近，覺得這個連線方式倒是很像公司的責任傳遞。',
    wing: '先讓它亮，大家現在都在等。',
    choices: [
      choice('檢查輸出與線材，把接法重新整理。', '', '螢幕亮了，同事很感激。主管說這麼簡單怎麼花這麼久，你低頭收線，避免讓表情也成為故障項目。', { skill: 11, trust: 7, boss: 5, energy: -7, mood: -8 }),
      choice('畫一張簡單接線圖，讓使用者一起確認。', '', '下次有人真的照圖接好了。你的支援時間少一點，圖卻被叫做「可以請你再畫一張」的開始。', { skill: 7, slack: 9, trust: 8, energy: -6, mood: -4 }),
      choice('請大家先共用一台，等合適的線材。', '', '會議先開始，硬體需求也有了清單。你沒有現場變出轉接頭，這點讓某些人頗感失望。', { slack: 7, boss: -10, energy: 4, mood: -5 }, ['evidence'])
    ]
  },
  {
    id: 'patent-php-hybrid', title: '專利工程師，請先把 PHP 修好', era: '史冊改編・職稱發明展', sourceIds: ['resourceLore', 'productLore'], roles: ['system', 'ai', 'mis', 'project', 'executive'],
    body: '公司想申請更多專利，又覺得專門寫文件的人應該順便修系統。你被問能不能替新職缺寫 JD，條件逐漸變成一個人、一台電腦，以及不存在的時間總量。',
    wing: '只做一件事太可惜，要能跨領域創造價值。',
    choices: [
      choice('拆出不同職能，列明各自工時。', '', 'JD 變得清楚，招募預算也變得難看。Wing 問有沒有更靈活的寫法，你沒有把工時改成心願。', { skill: 9, trust: 7, boss: -13, mood: -6, energy: -6 }, ['evidence']),
      choice('寫上「跨域全能人才」，先完成需求。', '', '標題很吸引人，內容像三份工作黏在一起。你希望應徵者讀到最後一行之前還有咖啡。', { lick: 8, boss: 10, skill: -3, mood: -10 }),
      choice('先排一個最需要解決的主職務。', '', '清單終於有了主次，其他項目仍在「未來可培養」。你把未來標得很遠，盡量別讓它週一就到。', { skill: 8, slack: 6, boss: -6, mood: -4 })
    ]
  },
  {
    id: 'bird-reminder-loop', title: '八哥一直叫，事情還是那一件', era: '史冊改編・工單自動化', sourceIds: ['productLore'],
    body: '提醒機器人又把同一張工單推到你面前。Wing 說這套做好以後就能遠端工作。你看著通知一則接一則，感覺遠端已經先做到一半：老闆不用走過來，也能一直在旁邊。',
    wing: '提醒這麼多次還沒做完，系統都幫你記住了耶。',
    choices: [
      choice('把重複提醒合併，標出真正的阻礙。', '', '通知安靜了，缺的核准還是缺。至少現在你不用每十分鐘重新認識同一個障礙。', { skill: 10, slack: 8, energy: -5, mood: 3, boss: -8 }, ['evidence']),
      choice('每則都回「處理中」，維持可見的忙碌。', '', '你的回覆速度創新高，工單進度沒有。Wing 說最近溝通有改善，你開始懷疑這系統衡量的是手指運動。', { lick: 7, boss: 9, skill: -4, energy: -8, mood: -11 }, ['loop']),
      choice('關掉非必要提醒，保留真正的急件。', '', '你終於能連續思考二十分鐘。有人問怎麼突然都沒看到你回覆，你只好說剛剛正在把事情做完。', { slack: 10, skill: 5, energy: 5, boss: -13, mood: 3 })
    ]
  },
  {
    id: 'slack-ipad-engineer', title: '別人的 App，公司的工程師來修', era: '史冊改編・相容性擔當', sourceIds: ['resourceLore'], roles: ['system', 'ai', 'mis'],
    body: '平板上的通訊軟體少了一個功能，你被借來一台裝置研究。你解釋這是第三方 App，收到的回覆是「你不是工程師嗎」。你還沒領到對方公司的識別證，已經先接到維護責任。',
    wing: '你先想辦法，不要一開始就跟我說不是我們能改的。',
    choices: [
      choice('重現問題，整理可用的替代操作。', '', '使用者終於能完成工作。你交付了一份操作指南，也正式成為下次所有平板問題的第一搜尋結果。', { skill: 9, trust: 7, energy: -8, mood: -7, boss: 5 }),
      choice('查官方限制，列清楚支援範圍。', '', '限制有了來源。Wing 說他想聽的是解法，你覺得知道牆在哪裡也是地圖的一部分。', { skill: 8, boss: -13, mood: -7 }, ['evidence']),
      choice('先讓對方改用電腦，回到原任務。', '', '事情用另一台裝置完成了。主管問為什麼不一開始就這樣，你決定把答案留在心裡，省一場會。', { slack: 9, energy: 4, boss: -7, mood: -4 })
    ]
  },
  {
    id: 'meeting-chair-host', title: '恭喜擔任會議主席，麥克風測試一下', era: '史冊改編・職稱與功能', sourceIds: ['meetingLore'], roles: ['project', 'product', 'sales', 'bd', 'executive'],
    body: '你被宣布擔任專案會議主席，原以為終於能決定議程。會前收到的任務是點名、開連結、提醒下一位。你這才明白，主席的「主」是主持，決策的那一席還是別人的。',
    wing: '先把場子帶順，方向我會掌握。',
    choices: [
      choice('把每題的決策人與期限記進會議紀錄。', '', '你不能替大家決定，至少可以記得是誰沒決定。會議終於留下比出席名單更有用的東西。', { skill: 9, trust: 7, boss: -9, energy: -6, mood: -5 }, ['evidence']),
      choice('笑著控場，替老闆每次發言接掌聲。', '', 'Wing 說今天很有氣氛。你用上所有主持技巧，成功讓一場沒有結論的會議很像有結論。', { lick: 11, boss: 11, mood: -10, energy: -7 }),
      choice('時間到了就問是否要另約續會。', '', 'Wing 說還有最後一點，那一點展開成三個分支。你仍替大家守住部分時間，收到幾個無聲的感謝。', { slack: 8, trust: 8, boss: -12, mood: -4, energy: 3 })
    ]
  },
  {
    id: 'attendance-accidental-admin', title: '補卡單寄給你，權限比職稱先升', era: '史冊改編・人事系統奇遇', speaker: 'jenjen', sourceIds: ['officeLore'],
    body: '一張補卡單寄到你的信箱，你回報沒有權限，行政就幫你開了權限。你再看一次職稱，沒有任何變化。到了下午，權限又被收回，彷彿你短暫代理了一個系統誤會。',
    wing: '先幫忙看一下，大家互相支援，不要想太多。',
    choices: [
      choice('確認真正的簽核人，再把單轉回去。', '', '補卡單回到對的人手上。你花了一點時間，阻止自己在不知道的情況下多出一份人事工作。', { skill: 8, boss: -6, mood: -5, energy: -5 }, ['evidence']),
      choice('先按流程幫忙處理，等行政再通知。', '', '事情辦完了，權限也不見了。你今天的主管體驗版沒有薪資，只有到期通知。', { boss: 7, lick: 4, energy: -6, mood: -9 }),
      choice('留下錯誤回報，順便檢查通知設定。', '', '你找到一個寄錯收件人的規則。系統修好後，再也沒有人覺得你突然升了人資主管。', { skill: 10, slack: 6, trust: 5, energy: -7, mood: -4 }, ['archive'])
    ]
  },
  {
    id: 'tissue-real-name', title: '日用品領用，先確認你的月配額', era: '史冊改編・行政精算', speaker: 'jenjen', sourceIds: ['officeLore'],
    body: '你要領一包衛生紙，JenJen 把登記表推過來。公司談全球市場時不用填表，擦桌子時倒是需要留下姓名。你開始佩服組織能把成本控制精準到這個層級。',
    wing: '不是不給你，是大家都要有節約的觀念。',
    choices: [
      choice('按規則登記，把用品缺口一併回報。', '', '衛生紙領到了，表格也填滿了。你今天的第一個具體交付，是證明自己有合理的擦拭需求。', { boss: 5, energy: -4, mood: -8, skill: 3 }),
      choice('自己買一包放桌邊。', '', '問題用自己的錢快速解決。你不必再填表，但很清楚公司所謂效率，有時候是把帳單換個人收。', { cash: -2, mood: 3, slack: 5 }),
      choice('和同事整理共同用品清單。', '', '大家發現缺的還有垃圾桶與幾條線。清單很小，足夠讓整間辦公室的願景突然變得具體。', { trust: 9, skill: 5, boss: -8, energy: -5, mood: -4 }, ['evidence'])
    ]
  },
  {
    id: 'profit-credit-arena', title: 'ROAS 競技場：客人買單，部門搶單', era: '史冊改編・成效歸因', sourceIds: ['productLore'], roles: ['ai', 'product', 'project', 'sales', 'bd'],
    body: '一筆訂單同時出現在三份成效報告。推薦系統說是它，投放說是它，另一位同事提醒那是固定團購客。客戶只刷了一次卡，內部已經慶功三次。',
    wing: '這些數字怎麼差那麼多？你們先對齊，但成長不能變少。',
    choices: [
      choice('確認歸因窗口，把重複計算拆開。', '', '大家終於看到同一個數字，雖然那個數字沒剛才漂亮。你還原了成效，也不小心刪掉幾份簡報的高潮。', { skill: 11, trust: 8, boss: -13, mood: -6, energy: -7 }, ['evidence']),
      choice('先各自列成效，把差異放註解。', '', '註解越寫越長，標題仍是成長亮眼。你學會了報表的一項特殊功能：可以同時裝下三種開心。', { lick: 7, boss: 10, skill: -3, mood: -9 }),
      choice('直接訪談客戶，確認購買路徑。', '', '客戶說只是剛好要買。這個答案沒有神奇演算法，但至少足夠替下次實驗找一個正常起點。', { skill: 9, trust: 6, energy: -8, boss: -7, mood: -4 }, ['evidence'])
    ]
  },
  {
    id: 'empty-floor-map', title: '辦公室更寬敞，因為同事更少了', era: '史冊改編・座位輪迴', sourceIds: ['officeLore', 'departures'], minTurn: 5,
    body: '又一次換座位之後，整層樓安靜不少。你以前抱怨走道太窄，現在走到另一頭只為了找一個能問問題的人。空間利用率的改善方式，和你原本想的不太一樣。',
    wing: '調整是為了讓組織更有效率，你們要往好的方向看。',
    choices: [
      choice('把剩下的系統與負責人重新整理。', '', '清單裡空白不少，你先補出可聯絡的窗口。組織圖看起來更簡單了，你的交接圖卻剛好相反。', { skill: 9, trust: 10, energy: -11, mood: -10 }, ['evidence']),
      choice('主動接下空出的工作，爭取表現。', '', 'Wing 看見你的企圖心。你也看見更多工單，只是它們沒有像座位一樣，隨著人離開而消失。', { boss: 14, skill: 6, energy: -17, mood: -14 }, ['allin']),
      choice('先和還在的同事吃頓飯。', '', '你們把聯絡方式留好，聊聊各自還想做什麼。飯桌上少了幾個人，但還有人記得你原本的樣子。', { cash: -5, trust: 12, mood: 7, energy: 4 }, ['archive'])
    ]
  },
  {
    id: 'dragon-office-quiz', title: '端午猜謎，題庫比交接文件完整', era: '史冊改編・共同記憶', sourceIds: ['dragonQuiz', 'archiveLore'],
    body: '節慶活動開始，題目從公司標語一路問到誰最會附和老闆。你發現同事們記得每個梗，卻沒人知道最新規格在哪。這家公司其實很會知識管理，只是知識種類比較特別。',
    wing: '活動要正向一點，不要什麼事情都拿來開玩笑。',
    choices: [
      choice('答共同經歷的題，避開別人的私事。', '', '大家笑得很熟悉。你們把難熬的日子換了一種講法，至少這次麥克風在自己手裡。', { trust: 12, mood: 8, boss: -6 }, ['archive']),
      choice('每題都導向公司的偉大願景。', '', 'Wing 覺得這組態度很好。你的隊友則覺得你是不是拿到了另一份題庫，還附主管評分表。', { lick: 10, boss: 11, trust: -7, mood: -7 }, ['allin']),
      choice('提議把常見工作問題也做成小抄。', '', '同事笑說你又在加班，還是一起補了幾條。梗圖與操作說明第一次待在同一個資料夾。', { skill: 7, trust: 8, energy: -5, mood: 4 }, ['archive', 'evidence'])
    ]
  },
  {
    id: 'ok-means-received', title: '那個 OK，只是代表他有看到', era: '史冊改編・手勢相容性', sourceIds: ['designLore', 'meetingLore'],
    body: '上次提案時 Wing 比了 OK，大家照著做了一週。今天展示，他問為什麼會做成這樣。你翻出紀錄，才知道原來同一個手勢還有「我收到了」這個版本。',
    wing: '我說收到，什麼時候說過可以照這樣做？',
    choices: [
      choice('逐項確認這次真正通過哪些內容。', '', '每個 OK 都被拆成一句具體的話。Wing 覺得你很囉唆，你覺得它們比下週的重做便宜。', { skill: 10, trust: 9, boss: -14, energy: -6, mood: -8 }, ['evidence']),
      choice('先道歉，再把進度重排一次。', '', '大家的時間退回一週前，Wing 的心情往前一步。你的版本紀錄很完整，裡面每版都叫做最後一次。', { lick: 8, boss: 12, energy: -13, mood: -13 }, ['loop']),
      choice('先保留可用部分，做一個小範圍確認。', '', '你用更小的交付換到更明確的回答。這次沒有大獲全勝，只有少一點白做，已經算是不錯的消息。', { skill: 8, slack: 6, boss: -7, mood: -5 }, ['evidence'])
    ]
  },
  {
    id: 'boss-meeting-ticket', title: '老闆辦公室，請先領號碼牌', era: '史冊改編・第一時間', sourceIds: ['meetingLore'],
    body: 'Wing 要大家問題一發現就報告，又說不要擠在門口，先向窗口預約。你拿著急件等了一上午，下午他問怎麼現在才講。號碼牌上沒有「老闆說他一直有空」這個選項。',
    wing: '我中間明明有空檔，你們就是不夠積極。',
    choices: [
      choice('把問題、等候時間與可選方案一次寄出。', '', '訊息留下了時點與選項。Wing 說不用寫這麼長，你卻終於不用把整個上午壓縮成一句「對不起」。', { skill: 8, boss: -11, energy: -6, mood: -8 }, ['evidence']),
      choice('趁門一開立刻跟上去。', '', '你成功卡進第一時間，也被問為什麼沒先預約。流程的兩個分支在你身上完成了合流。', { lick: 6, boss: 7, energy: -9, mood: -12 }),
      choice('先處理能自主完成的部分，保留待決事項。', '', '工作至少往前了一小段。Wing 問為什麼沒先問，你看著那張號碼牌，決定把它當今天最準確的會議紀錄。', { skill: 8, slack: 7, boss: -10, mood: -6 }, ['archive'])
    ]
  },
  {
    id: 'budget-free-tools', title: '預算是零，功能請對標企業版', era: '史冊改編・免費的願景', sourceIds: ['resourceLore'],
    body: '工具提示試用到期，素材需要授權，課程也要付費。Wing 問網路上不是都有免費的嗎。你看著待辦，突然理解「零成本」通常只是指沒有計算你。',
    wing: '別人能做出來，你先研究，不要一開始就想到花錢。',
    choices: [
      choice('比較免費版限制與付費方案，請他取捨。', '', 'Wing 最後選了較小的範圍，仍不太高興。你保住一部分交付，也把不存在的功能從承諾裡刪掉。', { skill: 10, trust: 6, boss: -11, mood: -6, energy: -6 }, ['evidence']),
      choice('用現有工具繞一圈做出替代方案。', '', '功能勉強完成，你的晚上也勉強結束。Wing 說早就知道有辦法，沒有提到這個辦法其實有一張人力帳單。', { skill: 8, boss: 10, energy: -14, mood: -12 }),
      choice('和同事分享已經踩過的限制。', '', '大家少撞了幾次牆。預算沒有變多，但至少不用每個人都為同一堵牆重新寫一次研究報告。', { trust: 10, skill: 6, slack: 6, energy: -5, mood: -3 }, ['archive'])
    ]
  },
  {
    id: 'api-bill-surprise', title: '說好的公司會出，帳單來了先問你', era: '史冊改編・呼叫有價', sourceIds: ['resourceLore', 'productLore'], minTurn: 3,
    body: '新功能需要外部 API，Wing 嫌免費額度太慢，要你快點處理。帳單到了，他又問為什麼會花這麼多。你發現公司的成本概念，有時候只在收到通知時才開始執行。',
    wing: '我說可以花錢，不是叫你不知道節制。',
    choices: [
      choice('整理原先需求、使用量與預算上限。', '', '你把問題拆成可控制的數字。Wing 還是不太滿意，至少下一次上限不會只有一句「快一點」。', { skill: 11, trust: 6, boss: -13, energy: -8, mood: -9 }, ['evidence']),
      choice('先降低呼叫頻率，再慢慢解釋。', '', '成本下來，速度也下來。Wing 問功能怎麼變慢了，你覺得自己正在替帳單與進度主持一場辯論。', { skill: 7, slack: 5, boss: -7, mood: -8, energy: -5 }),
      choice('吞下責備，保證下次會提前報告。', '', '對話終於結束。你得到一份沒有寫進文件的新要求：每次照做之前，要先猜對方將來會怎麼想。', { lick: 8, boss: 10, mood: -14, dream: -6 })
    ]
  }
  ,{
    id: 'pm-human-buffer', title: '測試環境取消，緩衝層改成 PM', era: '史冊改編・正式環境見', sourceIds: ['productLore'], roles: ['system', 'ai', 'mis', 'project', 'product'], weight: 1.2,
    body: '你建議先在測試環境確認產品整合，Wing 說不要浪費時間，正式上線才知道問題。至於客戶的反應，他指向 PM：「有人協調就好。」系統圖裡的緩衝層，突然有了健保卡。',
    wing: '想那麼多幹嘛？有問題再改，PM 就是要會處理這些。',
    choices: [
      choice('縮小上線範圍，先驗證最容易出事的一段。', '', '你把風險壓到能處理的範圍。Wing 覺得進度不夠快，PM 看你的眼神倒是像看見消防通道。', { skill: 12, trust: 11, boss: -12, energy: -8, mood: -6 }, ['evidence']),
      choice('先照要求推進，整晚留在線上。', '', '系統上線，通知也上線。Wing 稱讚執行力，PM 和你一起把這份執行力收拾到凌晨。', { boss: 12, skill: 5, energy: -17, mood: -15 }, ['allin']),
      choice('把測試、回復與客戶溝通分工列清楚。', '', '大家終於知道自己要做什麼。Wing 問怎麼有這麼多流程，你看著那個原本只寫「PM」的風險欄，覺得它總算比較像人話。', { skill: 9, trust: 9, boss: -10, energy: -7, mood: -5 }, ['evidence'])
    ]
  },
  {
    id: 'ai-replaces-tests', title: '老闆用 AI 寫完了，剩下都是你的', era: '史冊改編・工程師轉型', sourceIds: ['productLore'], roles: ['system', 'ai', 'mis', 'design', 'project', 'product'],
    body: 'Wing 宣布以後自己用 AI 寫程式，工程師只要測試。第一份成品看起來很完整，按下按鈕後什麼也沒發生。你的工作範圍突然縮成兩個字：其餘。',
    wing: '你看，幾分鐘就能寫出來。你們以前到底在忙什麼？',
    choices: [
      choice('逐一測試，把缺的功能整理成清單。', '', '清單很長，Wing 說你怎麼一直挑毛病。你想這就是他剛剛宣布的新工作，只是工作成果不太討喜。', { skill: 12, trust: 7, boss: -14, energy: -9, mood: -9 }, ['evidence']),
      choice('先稱讚雛形，再默默把功能補完。', '', '展示終於能跑，Wing 更確定 AI 已經取代大部分工程工作。你在背後完成的那部分，恰好不算在他的統計裡。', { skill: 7, lick: 8, boss: 12, energy: -15, mood: -14 }),
      choice('請他示範一遍完整操作流程。', '', '示範卡在第二步，問題終於有了共同畫面。Wing 把鍵盤推給你，說現在輪到你展示專業了。', { slack: 7, skill: 6, boss: -11, mood: -6, energy: -5 }, ['archive'])
    ]
  },
  {
    id: 'platform-link-willpower', title: '不能點的連結，被判定是不夠用心', era: '史冊改編・平台功能許願', sourceIds: ['designLore'], roles: ['design', 'bd', 'sales', 'product', 'project'],
    body: '這次活動使用的貼文版型不能直接放可點擊連結，你提供了替代入口。Wing 看完問為什麼不能直接點。平台功能的限制，到公司裡變成了你的態度問題。',
    wing: '不要只跟我講限制，你有沒有真的想辦法？',
    choices: [
      choice('示範可用入口，讓大家選一個方案。', '', '大家完成了選擇。你沒有改造整個平台，卻花半天讓一個本來就存在的入口得到正式認可。', { skill: 10, trust: 6, boss: -7, energy: -7, mood: -7 }, ['evidence']),
      choice('先說會研究，再換個位置放入口。', '', '同一個替代方案用「研究成果」的名義回來，這次順利通過。你發現路徑沒有變，只有尊重被重新命名。', { lick: 8, boss: 10, slack: 6, mood: -10 }),
      choice('列出限制，請主管直接操作一次。', '', 'Wing 點了三次，連結依然沒有向管理職屈服。你終於可以回到設計工作，空氣卻比剛才冷了一點。', { skill: 6, boss: -16, mood: -5, trust: 5 }, ['archive'])
    ]
  },
  {
    id: 'efficiency-network-block', title: '為了提高效率，工作網站一起封了', era: '史冊改編・網路管理', speaker: 'sonny', sourceIds: ['officeLore', 'resourceLore'],
    body: '公司決定限制上班看影片，新的網路規則一上線，連部分工作頁面也打不開。群組裡沒人在看影片了，大家都在問為什麼工作做不了。效率報告看起來應該很乾淨。',
    wing: '先把不能用的處理好，但限制不能放掉。',
    choices: [
      choice('整理受影響清單，協助逐項調整規則。', '', '工作頁面逐漸恢復，你的原定工作逐漸延後。大家感謝救火，造成火勢的那張規則單沒有出來致詞。', { skill: 10, trust: 10, energy: -11, mood: -9 }, ['evidence']),
      choice('把卡住的工作與時間一起回報。', '', '報告準確記錄了效率改善期間損失的效率。Wing 不喜歡這種寫法，但問題總算被當成問題。', { skill: 6, boss: -14, mood: -7, energy: -5 }, ['evidence']),
      choice('先做離線工作，等窗口修復。', '', '你完成幾件不用登入的事。主管問進度時，你把那個載入失敗的畫面一起附上，省下一場口頭網速測試。', { slack: 8, energy: 4, boss: -7, mood: -5 })
    ]
  },
  {
    id: 'interview-wrong-paper', title: '考卷發錯了，請工程師重新出題', era: '史冊改編・招募流程', speaker: 'hope', sourceIds: ['resourceLore', 'officeLore'], minTurn: 3,
    body: '面試者拿到別組的考題，分數不理想。Hope 要你重出一份回家作業，順便問考卷可不可以護貝重用。你原本下午要修系統，現在正在為四張紙與一場誤會開流程檢討。',
    wing: '人選要求不低，我們一定要多確認，不能浪費公司的資源。',
    choices: [
      choice('先對齊職缺與測驗目的，再安排重測。', '', '流程總算回到要找什麼人。你花掉半個下午，阻止錯的考卷替一個尚未入職的人寫完整份評語。', { skill: 9, trust: 8, energy: -10, mood: -8, boss: -7 }, ['evidence']),
      choice('快速出一份新題，先把這關過完。', '', 'Hope 覺得你很有效率。你的系統待辦仍在原地，沒有人幫它重新安排面試時間。', { boss: 9, skill: 5, energy: -12, mood: -11 }),
      choice('把現有題庫分類，請對應主管接手。', '', '下一位面試者至少會拿到對的題目。你沒有替全公司重新發明招募，只是讓檔名終於跟內容一致。', { skill: 8, slack: 7, boss: -9, energy: -5, mood: -4 }, ['archive'])
    ]
  },
  {
    id: 'extension-big-company', title: '分機多一位數，公司就大了一點', era: '史冊改編・辦公室規模', speaker: 'jenjen', sourceIds: ['officeLore'],
    body: '搬辦公室後，兩位數分機被嫌看起來像小公司，決定改成三位數。你準備更新清單，另一位主管又問這層樓到底需不需要電話。組織還沒變大，待辦已經先成長了。',
    wing: '這種門面很重要，客戶一聽就知道我們的規模。',
    choices: [
      choice('確認使用需求，再統一修改設定與名單。', '', '電話能用了，名單也正確。沒有人因此多出一位同事，但你終於可以少接幾通問分機的電話。', { skill: 9, slack: 7, trust: 5, energy: -8, mood: -6 }, ['evidence']),
      choice('先替新分機做一張很有規模的公告。', '', '公告看起來像跨國企業，電話依然在同一間辦公室響。主管很滿意，你的設計能力又完成一次行政轉職。', { lick: 8, boss: 11, energy: -7, mood: -10 }),
      choice('請兩位主管先對齊需要哪些設備。', '', '討論再開一輪，最後清單短了一點。你省下一部分無效設定，也收到一句「不要什麼都等我們決定」。', { skill: 7, boss: -12, energy: -5, mood: -6 }, ['evidence'])
    ]
  }
].map((event) => ({ minRules: 2, ...event })));

// Added after e2 was published: keep these out of that revision's replay pool.
EVENTS.push(...[
  {
    id: 'boss-mood-tabletop', title: '禾多殺：這次換老闆抽情緒 KPI', era: '幻想日常・午休桌遊', sourceIds: ['archiveLore', 'characterFiction'], minTurn: 4,
    body: '同事把辦公室梗做成紙牌，午休試玩。你抽到一張幻想制度卡：老闆每次亂發脾氣，也要扣自己的績效。大家笑得太大聲，Wing 剛好走過來，問這遊戲為什麼要把時間花在這種地方。紙上的老闆已經快扣完了。',
    wing: '管理哪有你們想得那麼簡單？你們先把自己的工作做好。',
    choices: [
      choice('邀他也抽一張，照規則玩一輪。', '', 'Wing 說自己很忙，沒有坐下。你們把制度卡留在桌上；它只存在遊戲裡，卻是今天最讓人想認真執行的制度。', { trust: 10, mood: 7, boss: -17, energy: 4 }, ['archive']),
      choice('立刻解釋這張是老闆壓力管理獎勵卡。', '', '負分被你講成成長機會，Wing 點頭離開。同事說你的角色技能應該叫「規則即時改版」，舔功果然也能用在桌遊。', { lick: 10, boss: 11, trust: -5, mood: -8 }),
      choice('先把牌收好，下班再和大家試玩。', '', '你們約了下班場，把今天新增的台詞寫進卡背。現實又出了一張牌，至少這次抽到它的人可以笑出來。', { slack: 7, trust: 9, mood: 5, boss: -6 }, ['archive'])
    ]
  },
  {
    id: 'office-access-escape-room', title: '公司密室逃脫：先找到你的門禁卡', era: '史冊改編・門禁驗收', speaker: 'sonny', sourceIds: ['officeLore'],
    body: '門禁更新，熟悉的開門按鈕不見了。新人想出去裝水，才發現卡還放在座位，只好在門邊求救。你們今天第一個跨部門專案是「如何順利走出辦公室」，驗收對象就是所有每天要經過這扇門的人。',
    wing: '先協助他通行，再把忘帶卡要找誰的流程寫清楚。',
    choices: [
      choice('聯絡門禁窗口協助通行，補測常見使用情境。', '', '新人終於裝到水，你把忘卡與緊急通行都列進檢核。系統以前只測會不會鎖，現在終於開始測人怎麼走。', { skill: 10, trust: 11, energy: -7, mood: -5 }, ['evidence']),
      choice('幫新人找回卡，陪他再走一次流程。', '', '門開了，新人學會報到手冊沒寫的第一課。你多認識一個同事，也少了一段本來要拿來做正事的時間。', { trust: 12, skill: 4, energy: -6, mood: -4 }),
      choice('把實際卡住的步驟整理給主管確認。', '', '主管說只是大家還不習慣。你把回報附上時間與步驟，讓「不習慣」至少有一份可以改善的說明書。', { skill: 7, boss: -10, mood: -7, energy: -5 }, ['archive', 'evidence'])
    ]
  }
].map((event) => ({ minRules: 3, ...event })));

// e4-only: published cohorts keep their original draw pools and replay outcomes.
EVENTS.push(...IMAGE_EVENTS);
EVENTS.push(...VIDEO_EVENTS);

// e8 adds management work without changing published draw pools.
EVENTS.push(...CAREER_DAILY_EVENTS);

EVENTS.push(...DEPARTURE_EVENTS);

// Original advisor branches are excluded from all published e14 and older pools.
EVENTS.push(...ADVISOR_EVENTS);

// New chronicler scenes never enter published e15 or earlier pools.
EVENTS.push(...JACK_EVENTS);

// e20 adds original sales-manager scenes without changing earlier draw pools.
EVENTS.push(...MEIMEI_EVENTS);

// New job-specific work belongs only to new e21 lives. Earlier cohorts keep
// their published event order, eligibility and replay results.
EVENTS.push(...COMMERCIAL_EVENTS_V21, ...DESIGN_EVENTS_V21, ...PROFESSION_EVENTS_V21);

// e22 recollections stay out of every published e21 or earlier draw pool.
EVENTS.push(...CHRONICLE_EVENTS_V22);
// New colleagues enter e23 lives; all published cohorts keep their draw pools.
EVENTS.push(...COLLEAGUE_EVENTS_V23);

// Verified quiz recollections become original scenes only in e26 and later lives.
EVENTS.push(...QUIZ_EVENTS_V26_A, ...QUIZ_EVENTS_V26_B);

// New backoffice occupations retain their own work; older pools stay frozen.
EVENTS.push(...BACKOFFICE_EVENTS_V28);
