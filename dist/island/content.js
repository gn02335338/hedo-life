// Original island vignettes. These are separate from career runs and archives.
// Present the opening and labels first; reveal a response only after a choice.
export const DISTRICTS = [
  {
    id: 'lobby', number: '01', name: '禾多辦公樓', kicker: 'WELCOME ABOARD',
    summary: '電梯還沒到，新的故事已經在大廳等你。', color: '#f28a5c',
    people: ['wing', 'jack', 'hope'], tags: ['初次報到', '島上日常'], time: '09:00',
    story: {
      title: '歡迎，先找你的位子',
      opening: '希望遞來一張座位圖，傑克說昨天才搬過桌子。翅膀經過，補上一句：「我們的組織很靈活。」你手上的地圖，恰好還停在上個版本。',
      choices: [
        { label: '跟著傑克走一圈', response: '傑克帶你認識飲水機、插座和最容易卡住的門。座位還沒找著，你倒是先拿到一份很實用的生存地圖。' },
        { label: '請希望在圖上標個位置', response: '希望拿起筆，畫了一顆星，再加上一個問號。「先坐這裡，我去確認。」你決定把這張限量版地圖收好。' },
        { label: '替座位圖加上尋寶路線', response: '你畫上虛線和一個寶箱。路過的同事認真看了半天，指著寶箱說：「這裡好像真的有餅乾。」' },
      ],
    },
    related: ['hr', 'lab'],
  },
  {
    id: 'lab', number: '02', name: '研發基地', kicker: 'MAKE IT WORK',
    summary: '有些靈感來自白板，有些來自重開機。', color: '#6ca9c5',
    people: ['jack', 'sam', 'jonathan'], tags: ['開發日常', '一起解題'], time: '10:00',
    story: {
      title: '它在我這裡會動',
      opening: '山姆的畫面一切正常，你的畫面卻只剩一顆轉圈圈。強哥推來椅子，傑克把「五分鐘排查」寫在白板上。大家都很有禮貌，沒問是哪一天的五分鐘。',
      choices: [
        { label: '把操作步驟重新走一次', response: '第三步少了一個小勾。你補上它，畫面終於醒來。山姆在筆記寫下原因，傑克替那個小勾畫了個很大的圈。' },
        { label: '請山姆交換電腦試試', response: '換到山姆的座位後，一切正常；山姆坐到你這邊，也開始轉圈。大家終於同意，今天至少不是你的椅子不夠努力。' },
        { label: '替轉圈圈辦一場記者會', response: '你拿筆當麥克風：「請問還要轉多久？」強哥配音：「目前沒有進一步消息。」全桌笑完，又一起回頭找問題。' },
      ],
    },
    related: ['meeting', 'cafe'],
  },
  {
    id: 'meeting', number: '03', name: '無限會議室', kicker: 'ONE MORE THING',
    summary: '再確認最後一件事，然後還有最後一件事。', color: '#b49bcb',
    people: ['meimei', 'johnny', 'simon'], tags: ['提案時間', '白板宇宙'], time: '11:00',
    story: {
      title: '最後一頁的最後一頁',
      opening: '水蛇翻到寫著「謝謝」的投影片，強尼正準備收筆。丁哥指著右下角的小字：「這裡還有附件。」附件的第一頁，也寫著「簡單說明」。',
      choices: [
        { label: '先記下今天要決定的事', response: '你把待決定事項排成三行。大家發現，其中兩行已經有答案。強尼很快圈出剩下一行，筆終於有機會蓋回去了。' },
        { label: '請丁哥用白板畫重點', response: '丁哥畫了三個方框和兩支箭頭。水蛇看了一眼：「對，我就是這個意思。」白板獲選本場最短的簡報。' },
        { label: '替「謝謝」安排安可', response: '你輕聲哼起散場音樂，強尼忍著笑把附件改名為「安可一」。大家看完真正的最後一頁，這次有人記得關投影機。' },
      ],
    },
    related: ['finance', 'cafe'],
  },
  {
    id: 'hr', number: '04', name: '人事小屋', kicker: 'PEOPLE & PAPER',
    summary: '把名字填好，也替自己的問題留一格。', color: '#e8a1a6',
    people: ['hope', 'captain', 'jenjen'], tags: ['流程問答', '新手指南'], time: '09:30',
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
    id: 'finance', number: '05', name: '財務金庫', kicker: 'EVERY RECEIPT COUNTS',
    summary: '小小一張收據，也有自己的返鄉旅程。', color: '#d6b25a',
    people: ['janet', 'sophie'], tags: ['收據整理', '核對細節'], time: '13:30',
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
    id: 'cafe', number: '06', name: '茶水間', kicker: 'TAKE A LITTLE BREAK',
    summary: '讓咖啡慢一點，讓話題離開工作一會兒。', color: '#87bda5',
    people: ['jack', 'jonathan', 'annie_yu'], tags: ['咖啡時間', '同事閒聊'], time: '14:30',
    story: {
      title: '冰箱裡的會議室',
      opening: '傑克的咖啡還在滴，安妮余正在替便當找空位。冰箱上層有一個只寫著「請勿動」的空盒，強哥看了一眼：「這格好像比會議室還難借。」',
      choices: [
        { label: '貼張便條，問問空盒是誰的', response: '便條剛貼好，失主就出現了，原來只是忘了帶走。安妮余把便當放進去，今天的冰箱空間問題順利結案。' },
        { label: '幫忙整理一小塊空間', response: '你們挪好水瓶，把大家的餐盒排齊。強哥指著空出的一格說：「不用開會就協調成功，值得再喝一口。」' },
        { label: '替空盒做一張預約表', response: '你寫下「本週開放預約，請自備內容物」。傑克端著咖啡路過，笑到忘了原本要拿湯匙，於是又多待了一分鐘。' },
      ],
    },
    related: ['lab', 'plaza'],
  },
  {
    id: 'plaza', number: '07', name: '福委廣場', kicker: 'A REASON TO GATHER',
    summary: '企劃很多，先從大家真的想參加的開始。', color: '#e7b76f',
    people: ['zoe', 'captain', 'simon'], tags: ['員工活動', '集合一下'], time: '16:00',
    story: {
      title: '每個人都有一票',
      opening: '201 在廣場擺出活動投票板：散步、桌遊、野餐。船長忙著數貼紙，丁哥在角落補上一欄「坐著就好」。那一欄還沒畫完，已經有人排隊。',
      choices: [
        { label: '投給散步，順便標一條短路線', response: '你畫出繞廣場一圈的路。201 在旁邊寫上「走累隨時回座位」，船長把補水點設在終點，也就是起點。' },
        { label: '問問大家想怎麼休息', response: '有人想聊天，有人想曬太陽，也有人只想安靜。201 把活動拆成幾個小角落，終於不用全島在同一分鐘做同一件事。' },
        { label: '認真替「坐著就好」拉票', response: '你搬來一張椅子作為政見展示。丁哥立刻加入體驗，船長宣布不用再找道具，這個攤位已經布置完成。' },
      ],
    },
    related: ['court', 'cafe'],
  },
  {
    id: 'court', number: '08', name: '下班球場', kicker: 'LEAVE WORK ON THE SIDELINE',
    summary: '白天傳文件，傍晚傳一顆不用簽核的球。', color: '#a3be79',
    people: ['jack', 'owen', 'sonny'], tags: ['傍晚運動', '一起收工'], time: '18:00',
    story: {
      title: '今天換一種傳球',
      opening: '傑克在籃下熱身，歐文把墨鏡收進球袋，阿福帶來一整袋水。球傳到你手上，大家沒有問進度，只問：「要不要一起玩一下？」',
      choices: [
        { label: '先暖身，再加入傳球', response: '你繞著球場走了一圈，再和大家慢慢傳球。第一球沒有進，第二球也沒有，傑克卻很認真地說：「手感正在路上。」' },
        { label: '在場邊幫大家記分', response: '你寫下比分，阿福補上一欄喝水次數。最後沒人記得誰贏，但每個人的水瓶都空了，收隊時剛好一起去裝水。' },
        { label: '替今晚的比賽當主播', response: '你播報：「歐文突破晚餐時間，傑克傳出下班後的第一個好消息！」球還沒落地，場上先笑成一團。' },
      ],
    },
    related: ['plaza', 'harbor'],
  },
  {
    id: 'harbor', number: '09', name: '下班碼頭', kicker: 'THE REST OF THE DAY IS YOURS',
    summary: '把今天留在岸上，下一站由你自己決定。', color: '#8aaec4',
    people: ['jack', 'cindy', 'james'], tags: ['看海時間', '收好今天'], time: '19:00',
    story: {
      title: '船還沒來的十分鐘',
      opening: '碼頭亮起暖黃的燈。辛蒂把手機收進包裡，詹姆士望著海，傑克說渡船還有十分鐘。難得沒有下一場會議接著，你可以決定這段空白怎麼過。',
      choices: [
        { label: '聊聊今天最好笑的一件事', response: '你提起那個被當成會議室的冰箱空盒。辛蒂笑著說她也看過預約表，詹姆士決定明天替自己的餐盒準備一張名片。' },
        { label: '安靜看一會兒海', response: '你們沒急著找話題。浪聲把下午的雜音慢慢蓋過去，直到渡船的燈出現在遠處。十分鐘，原來也能過得很寬。' },
        { label: '替今晚寫一張只有一句的行程表', response: '你寫下：「吃點喜歡的，剩下再說。」傑克看完點點頭。這張行程表沒有附件，也沒有人要求再開一場會討論。' },
      ],
    },
    related: ['court', 'lobby'],
  },
];

export const TOUR = [
  { districtId: 'lobby', hour: '09:00', label: '早安，禾多島', note: '從大廳出發，先認識今天會遇見的人。' },
  { districtId: 'lab', hour: '10:00', label: '一起找答案', note: '走進研發基地，看看今天卡在哪一個小地方。' },
  { districtId: 'meeting', hour: '11:00', label: '再說最後一件事', note: '拉張椅子，加入一場正在尋找句點的會議。' },
  { districtId: 'cafe', hour: '14:30', label: '讓腦袋透個氣', note: '在茶水間停一下，讓話題跟著咖啡慢下來。' },
  { districtId: 'court', hour: '18:00', label: '換個地方相處', note: '沿著步道到球場，參加或在場邊坐坐都可以。' },
  { districtId: 'harbor', hour: '19:00', label: '把時間還給自己', note: '最後到碼頭看海，替這趟島上散步收個尾。' },
];
