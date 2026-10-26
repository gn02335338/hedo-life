// Original island vignettes. These are separate from career runs and archives.
// Present the opening and labels first; reveal a response only after a choice.
export const DISTRICTS = [
  {
    id: 'lobby', number: '01', name: '經營總部', category: 'department', kicker: 'A PLACE TO SET DIRECTION',
    summary: '總經理室與董事長室在這裡，先把大方向變成能走的路。', color: '#f28a5c',
    people: ['wing', 'spencer', 'rick'], tags: ['總經理室', '董事長室', '經營策略'], time: '09:00',
    story: {
      title: '今天的方向，先從門口開始',
      opening: '經營總部大廳正在換指標。總經理室的箭頭指向董事長室，董事長室的箭頭又指回來。翅膀看了一圈，瑞克已經很認真地走完兩次。',
      choices: [
        { label: '把兩間辦公室的位置標清楚', response: '你在地圖上補好門牌，瑞克終於走到原本想去的那一間。翅膀點點頭，今天第一個方向有了實際目的地。' },
        { label: '先問來訪的人要找誰', response: '你把指標分成兩條明確的路，來訪的人不必再猜。大廳安靜了一點，大家可以開始處理真正要談的事情。' },
        { label: '替剛才的繞圈路線發紀念章', response: '你畫了一個小小的環島章，瑞克收下後說今天已經熱身完畢。指標換好，這條限定路線也正式結束營業。' },
      ],
    },
    related: ['hr', 'lab'],
  },
  {
    id: 'lab', number: '02', name: '創研園區', category: 'department', kicker: 'MAKE IT WORK TOGETHER',
    summary: '研發、產品、資訊、設計與專案管理，把不同的問號接在一起。', color: '#6ca9c5',
    people: ['jack', 'helen', 'simon'], tags: ['研發中心', '產品開發', 'MIS資訊服務', '產品設計', '專案管理'], time: '10:00',
    story: {
      title: '它在我這裡會動',
      opening: '山姆的畫面一切正常，你的畫面卻只剩一顆轉圈圈。紅酒推來椅子，傑克把「五分鐘排查」寫在創研園區的共用白板上。大家都很有禮貌，沒問是哪一天的五分鐘。',
      choices: [
        { label: '把操作步驟重新走一次', response: '第三步少了一個小勾。你補上它，畫面終於醒來。山姆在筆記寫下原因，傑克替那個小勾畫了個很大的圈。' },
        { label: '請山姆交換電腦試試', response: '換到山姆的座位後，一切正常；山姆坐到你這邊，也開始轉圈。大家終於同意，今天至少不是你的椅子不夠努力。' },
        { label: '替轉圈圈辦一場記者會', response: '你拿筆當麥克風：「請問還要轉多久？」紅酒配音：「目前沒有進一步消息。」全桌笑完，又一起回頭找問題。' },
      ],
    },
    related: ['meeting', 'cafe'],
  },
  {
    id: 'meeting', number: '03', name: '品牌學苑', category: 'department', kicker: 'SHARE WHAT YOU KNOW',
    summary: '行銷把想法說給人聽，教育訓練替提問留一個位置。', color: '#b49bcb',
    people: ['zoe', 'professor', 'henry'], tags: ['行銷', '教育訓練', '品牌學習'], time: '11:00',
    story: {
      title: '最後一頁的最後一頁',
      opening: '品牌學苑的分享課剛翻到「謝謝」，201正準備收筆。老大指著右下角的小字：「這裡還有附件。」林老師看了第一頁，上面也寫著「簡單說明」。',
      choices: [
        { label: '先記下今天最想問的事', response: '你把問題排成三行。大家發現，其中兩行剛才已經有答案。201圈出剩下一行，留給大家一起討論。' },
        { label: '請林老師用白板畫重點', response: '林老師畫了三個方框和兩支箭頭。老大看了一眼：「對，我就是這個意思。」白板成了本場最短的課程摘要。' },
        { label: '替「謝謝」安排安可', response: '你輕聲哼起散場音樂，201忍著笑把附件改名為「安可一」。大家看完真正的最後一頁，這次有人記得關投影機。' },
      ],
    },
    related: ['finance', 'cafe'],
  },
  {
    id: 'hr', number: '04', name: '人事行政館', category: 'department', kicker: 'PEOPLE & EVERYDAY DETAILS',
    summary: '人資、行政與法務，把流程裡說不清的小問號慢慢解開。', color: '#e8a1a6',
    people: ['hope', 'jenjen', 'erich'], tags: ['人資部', '行政部', '法務部'], time: '09:30',
    story: {
      title: '表單的第二個家',
      opening: '你來領識別證。船長翻出一張申請表，希望提醒用最新版，真真則問你有沒有先填線上版。三個人一起看向你，你一起看向那台正在休眠的電腦。',
      choices: [
        { label: '請大家確認目前要填哪一份', response: '三人比對完日期，找出真正的最新版。希望在上面貼了一張便條：「以此份為準。」這張便條成了今天最受歡迎的文件。' },
        { label: '先把已經填好的資料拿出來', response: '船長照著資料幫你核對，真真把重複欄位劃掉。識別證終於拿到手，照片中的你看起來比剛才少一點困惑。' },
        { label: '提議幫所有表單辦個同學會', response: '你把紙本排成一圈，讓線上版坐主位。船長笑著說席次不夠，接著順手收走了三份早該退休的舊表。' },
      ],
    },
    related: ['lobby', 'plaza'],
  },
  {
    id: 'finance', number: '05', name: '財會中心', category: 'department', kicker: 'EVERY DETAIL COUNTS',
    summary: '財務部看資源怎麼安排，會計部陪每張憑證找到位置。', color: '#d6b25a',
    people: ['janet', 'sophie'], tags: ['財務部', '會計部', '收據整理'], time: '13:30',
    story: {
      title: '收據往哪裡去',
      opening: 'Janet 的桌上有三個資料夾，分別叫「待補」、「待確認」和「待補後確認」。紅茶拿著一張沒有日期的收據，問你還記不記得那杯咖啡是哪天喝的。',
      choices: [
        { label: '查一查當天的付款紀錄', response: '你找到對應的時間與金額。紅茶核對後補上註記，Janet 把收據放進第四個資料夾。原來「完成」真的存在，只是平常藏在後面。' },
        { label: '先列出目前缺少的資料', response: 'Janet 指出需要補的兩項，你逐一記下。事情沒有瞬間完成，但下次回來時，至少不必從「這張是哪張」重新開始。' },
        { label: '替收據畫一張返家車票', response: '你在便條紙上畫了車票，目的地是「完成夾」。Janet 留下車票，把收據推回來：「旅客先補日期，才可以上車。」' },
      ],
    },
    related: ['meeting', 'hr'],
  },
  {
    id: 'cafe', number: '06', name: '共享生活館', category: 'shared', kicker: 'ROOM FOR A LITTLE BREAK',
    summary: '會議室、茶水間與福委會，共用一段大家都能停留的時間。', color: '#87bda5',
    people: ['jonathan', 'annie_yu', 'alice'], tags: ['會議室', '茶水間', '福委會'], time: '14:30',
    story: {
      title: '冰箱裡的會議室',
      opening: '共享生活館裡的咖啡還在滴，安妮余正在替便當找空位。冰箱上層有一個只寫著「請勿動」的空盒，強哥看了一眼：「這格好像比隔壁會議室還難借。」',
      choices: [
        { label: '貼張便條，問問空盒是誰的', response: '便條剛貼好，失主就出現了，原來只是忘了帶走。安妮余把便當放進去，今天的冰箱空間問題順利結案。' },
        { label: '幫忙整理一小塊空間', response: '你們挪好水瓶，把大家的餐盒排齊。強哥指著空出的一格說：「不用開會就協調成功，值得再喝一口。」' },
        { label: '替空盒做一張預約表', response: '你寫下「本週開放預約，請自備內容物」。愛麗絲端著茶路過，笑到忘了原本要拿湯匙，於是又多待了一分鐘。' },
      ],
    },
    related: ['lab', 'plaza'],
  },
  {
    id: 'plaza', number: '07', name: '商務聚落', category: 'department', kicker: 'START A CONVERSATION',
    summary: '商務開發、電商與廣告業務，把合作從一句話接起來。', color: '#e7b76f',
    people: ['action', 'meimei', 'owen'], tags: ['商務開發', '電商業務', '廣告業務'], time: '16:00',
    story: {
      title: '同一張桌，三種版本',
      opening: '商務聚落正在合用一張展示桌。水蛇想擺商品，914想放提案，順哥則帶來一個很大的名片盒。歐文把椅子拉過來，先問：「今天誰要坐在對面？」',
      choices: [
        { label: '先確認今天來訪的人想看什麼', response: '大家把對方的需求列成三點，展示桌終於排出順序。名片盒退後一點，談話多了一點空間。' },
        { label: '把商品、提案與合作資訊分成三區', response: '每個區塊留下一個清楚的標題，水蛇也能好好展示商品。大家不必搶同一個桌角，來的人也比較知道從哪裡看。' },
        { label: '替那個太大的名片盒訂一張座位', response: '你搬出一張小凳，順哥笑著把名片盒放上去。展示桌空了出來，今天最先獲得專屬座位的居然是盒子。' },
      ],
    },
    related: ['court', 'cafe'],
  },
  {
    id: 'court', number: '08', name: '下班球場', category: 'afterwork', kicker: 'LEAVE WORK ON THE SIDELINE',
    summary: '白天傳文件，傍晚傳一顆不用簽核的球。', color: '#a3be79',
    people: ['sonny', 'peter'], tags: ['球場', '傍晚運動', '一起收工'], time: '18:00',
    story: {
      title: '今天換一種傳球',
      opening: 'P神在籃下熱身，阿福把一整袋水放到場邊。球傳到你手上，大家沒有問進度，只問：「要不要一起玩一下？」不想上場，也有一張可以坐著聊天的長椅。',
      choices: [
        { label: '先暖身，再加入傳球', response: '你繞著球場走了一圈，再和大家慢慢傳球。第一球沒有進，第二球也沒有，P神卻很認真地說：「手感正在路上。」' },
        { label: '在場邊幫大家記分', response: '你寫下比分，阿福補上一欄喝水次數。最後沒人記得誰贏，但每個人的水瓶都空了，收隊時剛好一起去裝水。' },
        { label: '替今晚的比賽當主播', response: '你播報：「阿福突破晚餐時間，P神傳出下班後的第一個好消息！」球還沒落地，場上先笑成一團。' },
      ],
    },
    related: ['plaza', 'harbor'],
  },
  {
    id: 'harbor', number: '09', name: '夜色碼頭', category: 'afterwork', kicker: 'THE REST OF THE DAY IS YOURS',
    summary: '居酒屋亮起暖燈，阿良的神秘行程還留著空白；下一站自己選。', color: '#8aaec4',
    people: ['kind', 'cindy', 'james'], tags: ['居酒屋', '阿良的神秘行程', '看海時間'], time: '19:00',
    story: {
      title: '船還沒來的十分鐘',
      opening: '居酒屋亮起暖黃的燈。辛蒂把手機收進包裡，詹姆士望著海，阿良拿著還沒寫完的行程卡，說晚一點再出發也可以。難得沒有下一場會議接著，你可以決定這段空白怎麼過。',
      choices: [
        { label: '聊聊今天最好笑的一件事', response: '你提起那個被當成會議室的冰箱空盒。辛蒂笑著說她也看過預約表，詹姆士決定明天替自己的餐盒準備一張名片。' },
        { label: '安靜看一會兒海', response: '你們沒急著找話題。浪聲把下午的雜音慢慢蓋過去，直到渡船的燈出現在遠處。十分鐘，原來也能過得很寬。' },
        { label: '替今晚寫一張只有一句的行程表', response: '你寫下：「吃點喜歡的，剩下再說。」阿良看完點點頭。這張行程表沒有附件，也沒有人要求再開一場會討論。' },
      ],
    },
    related: ['court', 'lobby'],
  },
  {
    id: 'exile', number: '10', name: '流放島', category: 'special', kicker: 'A QUIETER CORNER OF THE ISLAND',
    summary: '被冷凍的日子，先到看門值班亭報到；冷宮裡也留著重新出發的位置。', color: '#9a9db8',
    people: [], tags: ['看門值班亭', '冷宮', '流放', '冷凍'], time: '10:30',
    story: {
      title: '沒有訪客的訪客簿',
      opening: '橋的另一頭掛著「流放島」木牌。看門值班亭裡有一張椅子，冷宮的窗邊有一壺熱茶。訪客簿上寫著：「今天也請記得，冷凍不代表你整個人都結冰了。」',
      choices: [
        { label: '先去值班亭看看今天的安排', response: '值班表只有一行：「替經過的人留一盞燈。」你把燈打開，空白的下午多了一件做得完的小事。' },
        { label: '到冷宮窗邊坐一下', response: '窗外看得到原本的部門，茶杯還是溫的。你慢慢整理剛才的話，決定回去時只帶走真正需要說清楚的那一句。' },
        { label: '替訪客簿補一句歡迎', response: '你寫下「路過也可以來喝茶」。第一個來的人不是主管，是一隻把腳印蓋得很整齊的海鳥。' },
      ],
    }, related: ['lab', 'hospital'],
  },
  {
    id: 'hospital', number: '11', name: '移動醫院', category: 'special', kicker: 'TAKE A BREATH, GET SOME REST',
    summary: '急診室先處理擦傷與瘀青，等人恢復精神，再談下一步。', color: '#d28483',
    people: [], tags: ['急診室', '醫院', '包紮', '休養'], time: '15:00',
    story: {
      title: '號碼牌也想休息',
      opening: '移動醫院的急診室亮著柔和的燈。櫃台提醒先坐下，號碼牌背面還印著「今天不必趕進度」。走廊的水壺咕嚕一聲，彷彿替大家鬆了一口氣。',
      choices: [
        { label: '先坐好，等護理人員叫號', response: '你把肩膀放鬆，終於聽得見自己的呼吸。叫號響起時，不必再跟另一個人比誰先站起來。' },
        { label: '替等候的人倒一杯水', response: '紙杯排成一列，等候室安靜下來。有人小聲說謝謝，這是今天最容易聽懂的一句回應。' },
        { label: '替號碼牌畫一個深呼吸符號', response: '你畫了兩個慢慢展開的括號。旁邊的人跟著吸氣、吐氣，連號碼機都像是放慢了一拍。' },
      ],
    }, related: ['meeting', 'police'],
  },
  {
    id: 'police', number: '12', name: '島上警局', category: 'special', kicker: 'TELL THE STORY ONE SENTENCE AT A TIME',
    summary: '把剛才的衝突寫進筆錄，先讓每個人把一句話說完。', color: '#738fae',
    people: [], tags: ['筆錄室', '警局', '筆錄', '冷靜'], time: '16:30',
    story: {
      title: '先把驚嘆號放下',
      opening: '島上警局的接待桌擺著兩支筆，一支寫得很順，另一支專門借給一直指著別人的手。筆錄室門上貼著「輪流說話」，後面還有一張小紙：「也記得聽。」',
      choices: [
        { label: '依照事情的順序說清楚', response: '你把事情拆成三段，原本混在一起的火氣和經過終於分開。紙上多了一份能好好讀完的紀錄。' },
        { label: '先聽對方把一句話說完', response: '等對方說完，你發現有一段剛才根本沒聽見。筆錄多補了一行，聲音也降了一點。' },
        { label: '替筆錄室的筆安排休息座位', response: '你把兩支筆並排放好，說它們今天已經跑過很多圈。櫃台笑了一下，接著把真正該填的欄位指給你看。' },
      ],
    }, related: ['finance', 'hospital'],
  },

];

export const TOUR = [
  { districtId: 'lobby', hour: '09:00', label: '早安，經營總部', note: '從總部出發，先看看總經理室與董事長室的方向牌。' },
  { districtId: 'lab', hour: '10:00', label: '走進創研園區', note: '沿著五個單位的門牌，看看想法怎麼變成能用的東西。' },
  { districtId: 'meeting', hour: '11:00', label: '在品牌學苑問一題', note: '從行銷到教育訓練，替還沒問完的問題留一張椅子。' },
  { districtId: 'cafe', hour: '14:30', label: '共享一段休息時間', note: '會議室、茶水間與福委會都在這裡，慢慢選一站。' },
  { districtId: 'court', hour: '18:00', label: '換個地方相處', note: '沿著步道到球場，參加或在場邊坐坐都可以。' },
  { districtId: 'harbor', hour: '19:00', label: '把時間還給自己', note: '到夜色碼頭看海、吃晚餐，阿良的行程想參加再問。' },
];
