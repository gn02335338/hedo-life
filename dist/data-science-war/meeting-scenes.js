import { OPENING, CLOSING } from './cases.js';

export const SAM_RULES = '山姆還在用 Gemma 4 寫 unit test，但不准 vibe coding。Code review 必須一行一行看，他管的人也一律照做。';

export const ARRIVAL = {
  id: 'accidental-arrival',
  category: '誤闖會議',
  title: '你為什麼進來？',
  speaker: 'sam',
  line: '等一下，你是哪一場的？怎麼自己推門進來了？你進來做什麼？',
  evidence: [],
  replies: [
    { id: 'challenge', label: '我走錯會議室了，以為這裡是另一場會議。', result: '山姆看了看門口。「既然都進來了，先坐。我問你三題。」傑克把空椅子往你這邊挪，笑得更明顯了。', rage: 0, cred: 0 },
    { id: 'mediate', label: '我聽見裡面有人唱歌，想看看在開什麼會。', result: '山姆朝伊森看了一眼。「這裡是讀書會。你也坐，先回答三題。」伊森沒有停下來。', rage: 0, cred: 0 },
    { id: 'apology', label: '抱歉，我看錯門牌了。', result: '你回頭確認門牌。山姆示意你坐下，說反正多一個人也能一起讀，接著把三道題翻出來。', rage: 0, cred: 1 },
    { id: 'scold', label: '門沒鎖，進來一下也要報告嗎？', result: '山姆把講義放下。「那就請你坐好，先回答我的三個問題。」鷲靠在椅背上，還沒有插話。', rage: 28, cred: -1 },
    { id: 'observe', label: '我只是看見有可樂和薯片。', result: '山姆把薯片往自己那邊移了一點。「可以拿，但要先回答三題。」紅酒把空杯推到你面前。', rage: 8, cred: 0 },
  ],
};

const conflictResults = [
  {
    challenge: '你把鷲的工作資料和矩陣的秩畫在同一張白板上。山姆把筆蓋扣得很響，卻又轉身補了一條箭頭。',
    mediate: '傑克說「先讓他講完」，山姆勉強留了十分鐘看實例。',
    apology: '你先為插話道歉，請山姆把定義講完。鷲把提問紙壓在講義下面，等著再問。',
    scold: '山姆把講義闔上，反問你是不是覺得整桌都不用讀書。鷲把椅子向前拉了一點。',
    observe: '你留在座位上聽。鷲一張張攤開工作資料，山姆一張張把它推回去。',
  },
  {
    challenge: '你圈出查詢組成變化的部分。山姆承認這裡有個歸因問題，隨即轉頭問鷲昨晚有沒有打開講義。',
    mediate: '你先把問題改成「哪些查詢真的多了點擊」。鷲把總量那頁翻過去，山姆答應聽這一題。',
    apology: '你放慢語速，重新說明自己在量什麼。山姆把報表拖到投影正中央。',
    scold: '鷲嘴角動了一下。山姆把筆停在白板上，問大家今晚到底是來讀書，還是來趕人。',
    observe: '你等兩人講完。山姆問回家到底有沒有人讀書，鷲問工作問題到底什麼時候能談。',
  },
  {
    challenge: '你從白板左右各挑一題，說明下週要怎麼驗。山姆盯了一會，伸手去拿桌角的薯片。',
    mediate: '你把一題基礎和一題實務排在一起，讓山姆和鷲各備一小段。紅酒提議把散會時間也寫上去。',
    apology: '你為今晚太硬的語氣道歉，邀山姆下週再來。他沒有馬上答應，但也沒把薯片帶走。',
    scold: '山姆把椅子往後一推。紅酒先捏住薯片袋口，鷲一手扶住快倒的杯子。',
    observe: '你關上投影，輪值欄仍然空白。山姆拎起薯片，鷲留下來擦白板。',
  },
];

const baseScenes = [
  {
    ...OPENING[0],
    title: '鷲終於把問題攤上桌',
    speaker: 'joe',
    line: '三題問完了，換我問。開會時間都在考基礎，工作卡住的問題什麼時候談？要讀課本，回家讀不行嗎？',
    evidence: [
      OPENING[0].evidence[0],
      { ...OPENING[0].evidence[1], text: '本週讀矩陣的秩。講義頁角寫著「定義已列，實務例子待補」。' },
      OPENING[0].evidence[2],
    ],
  },
  {
    ...OPENING[1],
    evidence: [
      OPENING[1].evidence[0],
      { ...OPENING[1].evidence[1], title: '會議前的讀書紀錄', text: '共筆列了本週讀到的頁數，沒有記錄工作卡點是否因此解決。' },
      OPENING[1].evidence[2],
    ],
  },
  {
    ...CLOSING,
    line: '我把白板分成兩欄了。左邊是山姆想教的，右邊是鷲急著解的。下週誰主持，先看今天能不能挑出一對一起驗證的問題。',
    evidence: [
      CLOSING.evidence[0],
      { ...CLOSING.evidence[1], text: '左欄列基礎觀念，右欄列工作卡點。兩欄間有箭頭，也留下了下週要驗證的問題。' },
      CLOSING.evidence[2],
    ],
  },
];

export const MEETING_SCENES = baseScenes.map((scene, index) => ({
  ...scene,
  mediator: null,
  replies: scene.replies.map(reply => ({ ...reply, result: conflictResults[index][reply.id] })),
}));

const SINGING = [
  '坐在一旁，唱著林俊傑的《修煉愛情》。',
  '還在唱《修煉愛情》，完全沒有換歌的打算。',
  '山姆停下來等你的回答，伊森的《修煉愛情》正好接上那個空檔。',
  '鷲和山姆互相提高音量，伊森照樣唱著《修煉愛情》。',
  '投影片已經換了幾張，伊森仍在唱同一首《修煉愛情》。',
  '會議快收場了，還沒唱完他的《修煉愛情》。',
];

export function ethanSinging(index) {
  return SINGING[Math.min(index, SINGING.length - 1)];
}

export function jackReaction(state) {
  if (state.jackConcerned) return '終於收起笑，往兩人中間移了一步。「先別動手，事情一件一件講。」';
  return state.index < (state.rulesVersion >= 4 ? 4 : 3)
    ? '低頭捂著嘴，肩膀一下一下抖，假裝在看講義。'
    : '還在旁邊偷笑，視線在山姆和鷲之間來回。';
}
