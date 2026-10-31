import { PERSONAS, displayPersona } from '../persona.js';
import { DEFAULT_OFFICE_FLOOR, getCharacterFloor, isOfficeFloor } from './floors.js';
import { getCharacterRoutine } from './routine.js';

// These are public, fictional office moments. They are independent of a saved
// life, its RNG, relationships and undiscovered stories or endings. An ambient
// character never claims to be a connected person or a running AI agent.
export const OFFICE_ZONES = Object.freeze([
  { id: 'studio', name: '共同工作區', description: '各自開工，也能把問題帶到隔壁桌。', color: '#728d67' },
  { id: 'meeting', name: '會議室', description: '把需求說清楚，替下一步留下共識。', color: '#b18c59' },
  { id: 'lounge', name: '交誼區', description: '倒杯水、聊兩句，讓工作暫停一下。', color: '#c27f70' },
  { id: 'focus', name: '主管室／專注區', description: '交接成果，也留一段安靜時間處理需要想清楚的事。', color: '#7185a6' },
].map(zone => Object.freeze(zone)));

const PALETTE = ['#d09062', '#a08cc0', '#79a68d', '#6e9eb8', '#c18d9f', '#c4aa61', '#83a4a3'];

// Each character has authored work, conversation and rest copy. The routine
// clock moves these fictional colleagues without executing real work.
// [zone, status, activity, quote]
const MOMENTS = Object.freeze({
  wing: [
    ['meeting', 'working', '在白板整理本週方向', '方向先寫三個字，細節怎麼還有三頁？'],
    ['focus', 'idle', '翻看團隊留下的提案', '這張大餅先別刪，我還沒講完。'],
    ['lounge', 'break', '端著咖啡看窗外', '休息也可以想一下下一個方向。'],
  ],
  spencer: [
    ['meeting', 'working', '核對經營討論的議程', '先把今天要決定的事情圈起來。'],
    ['focus', 'idle', '等下一份討論摘要', '這一頁是結論，還是結論的前言？'],
    ['lounge', 'break', '研究茶包上的沖泡時間', '這個三分鐘，比會議的三分鐘準。'],
  ],
  erich: [
    ['focus', 'working', '逐條檢查合作文件', '這句的「應該」先改成誰負責。'],
    ['meeting', 'idle', '等同事補上文件版本', '我可以等，附件不能靠想像。'],
    ['lounge', 'break', '替馬克杯蓋上杯蓋', '咖啡的有效期限，就是現在。'],
  ],
  sonny: [
    ['studio', 'working', '檢查辦公室網路設備', '先確認有插電，再一起懷疑宇宙。'],
    ['meeting', 'idle', '等設備重新啟動', '它現在需要三十秒，我也需要。'],
    ['lounge', 'break', '替點心盒挑一個位置', '先吃一片，修好的機率不保證。'],
  ],
  jenjen: [
    ['studio', 'working', '核對訪客與會議安排', '時間、地點、幾位，少一個都會回來問。'],
    ['meeting', 'idle', '等各部門確認出席名單', '回覆收到，跟回覆會來，是兩件事。'],
    ['lounge', 'break', '把用完的杯子歸位', '大家的杯子，比大家的行程整齊。'],
  ],
  rick: [
    ['studio', 'working', '轉達今天的臨時交辦', '我先確認這次是哪一版的意思。'],
    ['meeting', 'idle', '等主管的下一則訊息', '訊息正在輸入，椅子先坐穩。'],
    ['lounge', 'break', '挑一杯下午的飲料', '這次我自己選，不用往上確認。'],
  ],
  kind: [
    ['studio', 'working', '整理技術問題與分工', '先把問題拆小，下班才有機會。'],
    ['meeting', 'idle', '等同事確認技術方案', '有疑問先留著，別讓它下班才出現。'],
    ['lounge', 'break', '看今天下班的行程', '先問大家要不要去，先別幫大家答應。'],
  ],
  hope: [
    ['focus', 'working', '整理招募說明與面談問題', '工作內容先寫清楚，再談適不適合。'],
    ['meeting', 'idle', '等面談時段的確認', '邀請寄了，現在等一個確定的時間。'],
    ['lounge', 'break', '讓行事曆休息一會兒', '這五分鐘先不排任何面談。'],
  ],
  jack: [
    ['studio', 'working', '把開發問題拆成待辦', '先讓下一個接手的人看得懂。'],
    ['meeting', 'idle', '等同事完成交接說明', '不知道的就記不知道，別留一個驚喜。'],
    ['lounge', 'break', '看籃球場今晚的天氣', '先喝水，球可以晚一點再約。'],
  ],
  meimei: [
    ['meeting', 'working', '對齊客戶提案的內容', '這一頁是客戶要的，還是我們想講的？'],
    ['studio', 'idle', '等客戶回覆會議時間', '等回覆的時候，先把下一封信存草稿。'],
    ['lounge', 'break', '跟同事聊今天的咖啡', '這杯不用提案，直接喝就好。'],
  ],
  helen: [
    ['studio', 'working', '整理產品需求與交接筆記', '先說這次解決誰的問題。'],
    ['meeting', 'idle', '等團隊確認需求邊界', '多一個功能之前，先看看少了什麼時間。'],
    ['lounge', 'break', '離開螢幕看一眼窗外', '這一刻先不要新增需求。'],
  ],
  sophie: [
    ['focus', 'working', '交叉核對流程與紀錄', '有做過的事情，應該找得到紀錄。'],
    ['meeting', 'idle', '等同事補齊核對資料', '這一格先留白，別替它猜答案。'],
    ['lounge', 'break', '泡一杯紅茶', '今天這杯真的只是紅茶。'],
  ],
  jonathan: [
    ['studio', 'working', '重跑測試並記錄問題', '先確認重現步驟，錯誤才不會變傳說。'],
    ['meeting', 'idle', '等排程與負責人確認', '這一項要我處理，就把決定一起寫下來。'],
    ['lounge', 'break', '挑下午茶的配料', '杯子可以小，配料的討論不能省。'],
  ],
  owen: [
    ['meeting', 'working', '整理合作案的下一步', '交換完名片，還要交換一個明確時間。'],
    ['studio', 'idle', '等合作窗口確認條件', '漂亮的方向，先配一份能執行的清單。'],
    ['lounge', 'break', '把墨鏡收進盒子', '室內的光，今天先交給窗戶。'],
  ],
  sam: [
    ['focus', 'working', '檢查資料欄位與異常值', '這個數字很有趣，先看是不是少了一欄。'],
    ['studio', 'idle', '等分析流程跑完', '進度條還在跑，結論先別跑出去。'],
    ['lounge', 'break', '離開報表伸個懶腰', '先把樣本換成一杯水。'],
  ],
  cindy: [
    ['studio', 'working', '重排專案時程與交接節點', '日期移了，前後的人也要一起知道。'],
    ['meeting', 'idle', '等各部門確認依賴項目', '這一格寫待確認，才知道要找誰確認。'],
    ['lounge', 'break', '把計時器設成五分鐘', '這段休息不需要另一張甘特圖。'],
  ],
  professor: [
    ['focus', 'working', '在筆記上釐清研究問題', '先定義問題，答案才知道要往哪裡去。'],
    ['meeting', 'idle', '等團隊帶來新的實驗紀錄', '我們可以先討論假設，不急著替結果命名。'],
    ['lounge', 'break', '端著熱茶慢慢想事情', '換個地方想，有時候也算進度。'],
  ],
  annie_yu: [
    ['studio', 'working', '整理合作窗口的聯絡事項', '寄出前再看一下收件人和部門。'],
    ['meeting', 'idle', '等歐文確認最新合作方向', '我有記前一版，這版也另外記。'],
    ['lounge', 'break', '選一張空著的椅子坐下', '這個位子不用轉接給別人。'],
  ],
  princess: [
    ['focus', 'working', '比較資料模型的測試結果', '先看測試，再看誰說這樣比較好。'],
    ['studio', 'idle', '等新的資料批次完成', '圖還沒畫完，先別挑最好看的那張。'],
    ['lounge', 'break', '翻看今天的午餐選項', '選餐廳的問題，今天先只解一題。'],
  ],
  joyce: [
    ['meeting', 'working', '整理客戶追蹤與業務回覆', '窗口先對好，訊息才不會各說各的。'],
    ['studio', 'idle', '等提案數字的最後確認', '好消息可以晚一點，數字要先對。'],
    ['lounge', 'break', '把手機暫時扣在桌上', '下一通之前，先把這杯喝完。'],
  ],
  janet: [
    ['focus', 'working', '核對預算與核銷附件', '少一張附件，就多一封來回。'],
    ['studio', 'idle', '等同事補上單據說明', '用途欄不能只寫「用途」。'],
    ['lounge', 'break', '算茶水間還剩幾個茶包', '這個庫存，現在不用填表。'],
  ],
  captain: [
    ['studio', 'working', '安排活動與招募行程', '先數人，再數位子，這次照這個順序。'],
    ['meeting', 'idle', '等大家回覆活動調查', '航線有了，還差幾位乘客點頭。'],
    ['lounge', 'break', '看看茶水間今天的點心', '這一站先停五分鐘。'],
  ],
  zoe: [
    ['meeting', 'working', '準備培訓與員工活動', '今天要學什麼，先別寫成「全部」。'],
    ['studio', 'idle', '等各組交回活動需求', '大家說都可以的時候，我會再問一次。'],
    ['lounge', 'break', '收集同事的下午茶點子', '這次先聊天，投票晚一點再開。'],
  ],
  action: [
    ['meeting', 'working', '拆解新合作構想的條件', '構想先落在紙上，再落到誰來做。'],
    ['focus', 'idle', '翻看待確認的商務提案', '一個新方向，也要有一個舊問題的答案。'],
    ['lounge', 'break', '替收藏櫃擦一擦灰塵', '收藏先欣賞，今天先喝茶。'],
  ],
  hester: [
    ['meeting', 'working', '跟進跨部門的合作事項', '客戶那邊的問題，先由我們對成同一題。'],
    ['studio', 'idle', '等業務窗口確認回覆', '有人接下一步，才算接上了。'],
    ['lounge', 'break', '看窗邊的植物長出新葉', '這個進度不催，它也有在長。'],
  ],
  simon: [
    ['studio', 'working', '調整產品畫面的設計稿', '先把使用方式畫清楚，再換第三種顏色。'],
    ['meeting', 'idle', '等同事回覆設計註記', '這個「再活潑一點」，可以圈一下位置嗎？'],
    ['lounge', 'break', '把草稿本翻到空白頁', '這一頁先拿來亂畫。'],
  ],
  james: [
    ['studio', 'working', '整理系統版本與交接紀錄', '熟悉的畫面，也要看一下這次的版本號。'],
    ['focus', 'idle', '對照新舊流程的差異', '這段我看過，不代表這段沒有改過。'],
    ['lounge', 'break', '看看老位置旁的新擺設', '杯子還在，先確認哪一個是我的。'],
  ],
  johnny: [
    ['studio', 'working', '把臨時交辦排進專案清單', '先問期限，再看看誰的期限會被擠到。'],
    ['meeting', 'idle', '等跨部門確認今天的順序', '全部優先的時候，還是要排第一個。'],
    ['lounge', 'break', '替今天留一段散步時間', '這五分鐘先排給自己。'],
  ],
  alice: [
    ['studio', 'working', '整理同事分享的遊戲活動筆記', '活動期限先寫好，別把每日任務玩成加班。'],
    ['meeting', 'idle', '等隊友確認今天的集合時間', '人還沒到齊，先別替大家按準備。'],
    ['lounge', 'break', '交流今天抽到的新角色', '這張先讓我開心一下，實用度晚點再看。'],
  ],
  wine: [
    ['studio', 'working', '把系統告警分成待辦與雜訊', '先看哪盞真的紅了，別每封信都當火警。'],
    ['focus', 'idle', '等備份檢查回傳最後一筆紀錄', '成功通知要看完，不能只看信件標題。'],
    ['lounge', 'break', '拿著水杯離開值班螢幕', '我叫紅酒，這杯還是水。'],
  ],
  peter: [
    ['studio', 'working', '照檢查清單重現測試問題', '這次先把步驟記好，才知道是哪一關卡住。'],
    ['meeting', 'idle', '等負責人確認需要調整的設定', '助理可以先查，拍板還是要找對人。'],
    ['lounge', 'break', '和同事比較昨晚的遊戲進度', '我先存檔，等等再聊下一關。'],
  ],
  tony: [
    ['studio', 'working', '核對交來的檔案與版本', '檔名寫最終，不代表我就不檢查。'],
    ['meeting', 'idle', '等同事補上操作說明', '哥們，先告訴我要按哪一個。'],
    ['lounge', 'break', '整理明天早餐團的點單', '蛋餅加不加辣，這題現在就能決定。'],
  ],
  henry: [
    ['focus', 'working', '把技術決定整理成可交接的文件', '方向可以改，改之前先讓接手的人知道。'],
    ['meeting', 'idle', '等團隊確認方案的責任與範圍', '大家都說可以之後，還要寫誰來做。'],
    ['lounge', 'break', '問同事週末小聚想去哪裡', '時間先問好，行程別先替大家排滿。'],
  ],
  mia: [
    ['studio', 'working', '整理新同事的報到清單', '要帶什麼、交給誰，我把它寫在同一張。'],
    ['meeting', 'idle', '等當事人確認資料用途', '本人還沒點頭的部分，就先留著。'],
    ['lounge', 'break', '替自己的聯絡視窗暫停通知', '現在先聽你說，不用急著填欄位。'],
  ],
});

const zoneIds = new Set(OFFICE_ZONES.map(zone => zone.id));
const statusIds = new Set(['working', 'idle', 'break']);

export const OFFICE_CAST = Object.freeze(Object.keys(PERSONAS).map((id, index) => {
  const person = displayPersona(id);
  const [zone, , activity, quote] = MOMENTS[id][0];
  return Object.freeze({ id, name: person.name, title: person.title, portrait: person.image.replace(/^\.\//, '/'), color: PALETTE[index % PALETTE.length], departmentFloor: getCharacterFloor(id), zone, activity, quote });
}));

export function getCastMoment(personaId, nowMs = Date.now()) {
  if (!Object.hasOwn(MOMENTS, personaId)) return null;
  const rows = MOMENTS[personaId];
  const routine = getCharacterRoutine(personaId, nowMs, { homeZone: rows[0][0] });
  const partner = displayPersona(routine.partnerId).name, destination = `${routine.destinationFloor}F`, home = `${routine.homeFloor}F`;
  const visit = routine.visitKind === 'meeting' ? '開會' : '聊天';
  const activities = {
    'home-work': rows[0][2],
    'to-elevator': `前往電梯，準備到${destination}找${partner}${visit}`,
    'outbound-lift': `搭電梯${routine.toFloor > routine.fromFloor ? '上行' : '下行'}：${home} → ${destination}，與${partner}有約`,
    'to-visit': `抵達${destination}，走去找${partner}${visit}`,
    meeting: `正在${destination}和${partner}開會`,
    chat: `正在${destination}和${partner}聊天`,
    'return-to-elevator': `與${partner}談完，前往電梯回${home}`,
    'return-lift': `搭電梯${routine.toFloor > routine.fromFloor ? '上行' : '下行'}：${destination} → ${home}，返回部門`,
    'return-to-work': `回到${home}，走回部門繼續工作`,
  };
  const copy = routine.phase === 'home-work' ? rows[0] : routine.phase === 'chat' ? rows[2] : rows[1];
  return { zone: routine.zone, status: routine.phase === 'chat' ? 'break' : 'working', activity: activities[routine.phase], quote: copy[3], floor: routine.floor, routine };
}

const shortText = (value, max) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max) : '';

export function getOfficeRoster(remoteMembers = [], now = Date.now()) {
  const cast = OFFICE_CAST.map(person => ({
    ...person,
    ...getCastMoment(person.id, now),
    kind: 'character',
    source: 'ambient',
    role: person.title,
    online: false,
  }));
  const knownIds = new Set(cast.map(person => person.id));
  // The office API returns approved members only. Project just its public
  // fields here; credentials, contact details and review data never enter UI.
  const members = [];
  for (const member of Array.isArray(remoteMembers) ? remoteMembers : []) {
    if (!member || typeof member !== 'object' || !['human', 'agent'].includes(member.kind)) continue;
    const id = shortText(member.id, 96), name = shortText(member.name, 40);
    if (!id || !name || knownIds.has(id)) continue;
    knownIds.add(id);
    const online = member.online === true;
    const role = shortText(member.role, 80);
    members.push({
      id, name, role, title: role, kind: member.kind, source: 'connected',
      intro: shortText(member.intro, 500),
      floor: isOfficeFloor(member.floor) ? member.floor : DEFAULT_OFFICE_FLOOR,
      departmentFloor: isOfficeFloor(member.departmentFloor) ? member.departmentFloor : DEFAULT_OFFICE_FLOOR,
      zone: zoneIds.has(member.zone) ? member.zone : 'studio',
      status: online && statusIds.has(member.status) ? member.status : 'idle',
      activity: shortText(member.activity, 160),
      online,
      lastSeenAt: shortText(member.lastSeenAt, 40) || null,
      joinedAt: shortText(member.joinedAt, 40) || null,
      portrait: null,
      color: member.kind === 'agent' ? '#7185a6' : '#79a68d',
    });
  }
  return [...cast, ...members];
}
