// Original office self-reflection game. These authored questions and thresholds
// are not a validated psychological scale and do not diagnose attachment styles.
export const STORAGE_KEY = 'hedo-attachment-v1';
export const VERSION = 1;

export const CHAPTERS = [
  { id: 'messages', title: '訊息響起的時候', kicker: '01 / 已讀與想太多' },
  { id: 'trust', title: '一個人，還是一隊人', kicker: '02 / 求助與信任' },
  { id: 'boundaries', title: '你的下班界線', kicker: '03 / 距離與空間' },
  { id: 'conflict', title: '有話，怎麼好好說', kicker: '04 / 衝突與修復' },
];

export const SCALE = [
  { value: 1, label: '很不像我', short: '很不像' },
  { value: 2, label: '不太像我', short: '不太像' },
  { value: 3, label: '看情況', short: '看情況' },
  { value: 4, label: '有點像我', short: '有點像' },
  { value: 5, label: '很像我', short: '很像' },
];

export const QUESTIONS = [
  { id: 'q01', chapter: 'messages', context: '群組裡，主管只回了一個「嗯」。', text: '我會反覆猜想，自己是不是哪裡做得不夠好。', axis: 'anxiety', reverse: false },
  { id: 'q02', chapter: 'messages', context: '提案傳出去了，對方一直沒回。', text: '即使還沒到約好的回覆時間，我也很難停止查看訊息。', axis: 'anxiety', reverse: false },
  { id: 'q03', chapter: 'messages', context: '同事今天的回覆比平常簡短。', text: '在沒有更多線索以前，我能先把它當成對方正在忙。', axis: 'anxiety', reverse: true },
  { id: 'q04', chapter: 'messages', context: '專案夥伴問：「你最近還好嗎？」', text: '我會想把對話拉回工作，少談自己的真實感受。', axis: 'avoidance', reverse: false },
  { id: 'q05', chapter: 'messages', context: '訊息說不清楚，對方想約十分鐘聊聊。', text: '我願意用一段直接對話，釐清彼此的想法。', axis: 'avoidance', reverse: true },
  { id: 'q06', chapter: 'messages', context: '合作窗口說：「有問題可以隨時問我。」', text: '需要時，我能接受這份支持，而不覺得自己欠了很大的人情。', axis: 'avoidance', reverse: true },

  { id: 'q07', chapter: 'trust', context: '討論時，自己的方案沒有被採用。', text: '我能把方案的取捨和別人對我的評價分開。', axis: 'anxiety', reverse: true },
  { id: 'q08', chapter: 'trust', context: '同事約了午餐，這次沒有找我。', text: '我不需要立刻確認，彼此是不是還要好。', axis: 'anxiety', reverse: true },
  { id: 'q09', chapter: 'trust', context: '手上有一個自己也拿不準的決定。', text: '如果沒有熟悉的人表示認同，我會很難安心往下做。', axis: 'anxiety', reverse: false },
  { id: 'q10', chapter: 'trust', context: '專案卡住了，同事主動來幫忙。', text: '就算對方可靠，我仍覺得全部自己扛比較自在。', axis: 'avoidance', reverse: false },
  { id: 'q11', chapter: 'trust', context: '需要把一部分任務交給合作夥伴。', text: '比起彼此依靠，我更希望每個人都只處理自己的事。', axis: 'avoidance', reverse: false },
  { id: 'q12', chapter: 'trust', context: '已經試過幾次，還是解不開這個問題。', text: '我能讓信任的人知道自己卡在哪裡，並開口求助。', axis: 'avoidance', reverse: true },

  { id: 'q13', chapter: 'boundaries', context: '下班後，工作群組又跳出通知。', text: '即使沒有緊急任務，我也怕晚回會讓人對我失望。', axis: 'anxiety', reverse: false },
  { id: 'q14', chapter: 'boundaries', context: '同事有自己的休息安排，暫時不方便聊天。', text: '我能接受這段空間，不急著把它理解為疏遠。', axis: 'anxiety', reverse: true },
  { id: 'q15', chapter: 'boundaries', context: '手上的工作已滿，又有人請託一件小事。', text: '想到拒絕可能影響關係，我常答應超過自己負荷的事。', axis: 'anxiety', reverse: false },
  { id: 'q16', chapter: 'boundaries', context: '和同事相處不錯，但今天需要安靜一下。', text: '我能說明自己需要空間，也讓對方知道之後仍願意交流。', axis: 'avoidance', reverse: true },
  { id: 'q17', chapter: 'boundaries', context: '一位合作愉快的同事開始更常來找我。', text: '只要互動變得密切，我就會想刻意減少聯絡。', axis: 'avoidance', reverse: false },
  { id: 'q18', chapter: 'boundaries', context: '工作壓力很大，有人願意聽我說。', text: '我可以選擇分享一部分近況，不必把所有情緒都收起來。', axis: 'avoidance', reverse: true },

  { id: 'q19', chapter: 'conflict', context: '會議上，熟悉的同事不同意我的做法。', text: '即使意見不同，我仍能相信這段合作有繼續的空間。', axis: 'anxiety', reverse: true },
  { id: 'q20', chapter: 'conflict', context: '一場有點不愉快的討論剛結束。', text: '我會急著確認對方沒有生氣，否則很難專心做其他事。', axis: 'anxiety', reverse: false },
  { id: 'q21', chapter: 'conflict', context: '自己表達得不夠清楚，需要再談一次。', text: '我能容許對話暫時沒有結論，不因此認定關係要壞掉。', axis: 'anxiety', reverse: true },
  { id: 'q22', chapter: 'conflict', context: '對方說：「剛才那句話讓我不太舒服。」', text: '我的第一個反應是結束話題，之後也盡量少接觸。', axis: 'avoidance', reverse: false },
  { id: 'q23', chapter: 'conflict', context: '爭執過後，雙方都稍微冷靜了。', text: '我願意再回到對話，說明自己的需要，也聽聽對方。', axis: 'avoidance', reverse: true },
  { id: 'q24', chapter: 'conflict', context: '合作夥伴想談談彼此的誤會。', text: '就算這段合作對我重要，我也寧願保持距離，讓事情自己淡掉。', axis: 'avoidance', reverse: false },
];

export const TYPES = {
  secure: {
    id: 'secure', name: '穩穩接球型', subtitle: '靠得近，也站得穩。', color: '#577b61',
    summary: '在這次回答裡，你比較能接受合作、表達需要，也容許彼此保留空間。一句「明天再聊」可以只是行程安排，不必立刻變成關係警報。這份穩定仍會隨對象、壓力和環境改變。',
    strengths: ['能把工作意見和自我價值分開。', '願意求助，也能說明自己的界線。', '有摩擦時，仍替下一次對話留位置。'],
    traps: ['容易把「我還可以」說得太順，忘記自己也會累。', '遇到反覆失信的環境，可能太久才承認它讓自己不舒服。'],
    practice: [
      { title: '把穩定分一點給自己', text: '今天先確認一次自己的負荷，再答應下一件請託。可靠不需要靠無限加班證明。' },
      { title: '說出具體的需要', text: '把「都可以」換成一個真實偏好，例如「我希望明天下午前確認需求」。' },
      { title: '觀察環境也很重要', text: '留意承諾是否被履行、界線是否被尊重。合作品質不只取決於你怎麼回應。' },
    ],
    script: { scene: '禾多小劇場｜傑克又來揪臨時支援。', you: '我今天能幫你看十五分鐘，剩下的我們明早一起排。', reply: '傑克：「好，那我先整理最卡的三件事。」' },
    sentence: '我可以和你一起處理，也可以先照顧自己的電量。',
  },
  anxious: {
    id: 'anxious', name: '訊息雷達型', subtitle: '那個「已讀」，你聽得很大聲。', color: '#c27349',
    summary: '在這次回答裡，你比較在意回應、認同和合作是否安穩，也願意與人保持連結。這讓你容易察覺氣氛，但回覆空白時，也可能替別人寫出太多內心旁白。這描述的是本次傾向，不是固定人格。',
    strengths: ['能注意到合作裡細微的變化。', '珍惜關係，願意主動聯絡和修復。', '對別人的需要通常很有感覺。'],
    traps: ['把一個簡短回覆，自動翻譯成「是不是我不好」。', '為了維持和氣，答應超過負荷的工作。'],
    practice: [
      { title: '先分開事實和猜測', text: '寫下「他還沒回」這個事實，再辨認「他不滿意我」是尚未被確認的解釋。' },
      { title: '約一個回覆時間', text: '把反覆刷新換成明確約定：「這份想請你週三前看一下，來不及也告訴我。」' },
      { title: '讓拒絕小一點', text: '先練習一個有範圍的回應：「我今天排不進去，可以明天下午處理。」' },
    ],
    script: { scene: '禾多小劇場｜翅膀只傳來「晚點聊」。', you: '好，我三點後有空。想先確認一下，主要要討論哪件事？', reply: '翅膀：「下午那份簡報，幫我帶一下。」' },
    sentence: '訊息還沒回，不等於我的價值也在等待核准。',
  },
  avoidant: {
    id: 'avoidant', name: '獨立作業型', subtitle: '先讓我自己處理一下。', color: '#597d91',
    summary: '在這次回答裡，你比較重視自主、距離和可掌握的工作節奏。獨立能讓你安心，但有時也會把可以分擔的壓力一起留在自己桌上。需要空間很合理，值得再看看自己是否也有安全求助的選項。',
    strengths: ['能自行整理問題，維持自己的節奏。', '對空間與自主有清楚的感受。', '遇到混亂時，常能先專注手上能做的事。'],
    traps: ['把需要協助理解成能力不足。', '用安靜退開代替說明，讓對方不知道如何配合。'],
    practice: [
      { title: '只借一小段力', text: '找一位可靠的夥伴，提出範圍很小的請求，例如「幫我看這一頁的邏輯就好」。' },
      { title: '替空間加上時間', text: '需要暫停時，補一句「我先整理二十分鐘，四點再回來談」，讓距離也有訊號。' },
      { title: '分享一點，不必全交代', text: '試著說一個當下感受或困難。保有自主和接受支持可以同時存在。' },
    ],
    script: { scene: '禾多小劇場｜傑克問你要不要一起看卡住的案子。', you: '我先自己查十五分鐘。如果還沒解開，想請你幫我看一下這個錯誤。', reply: '傑克：「可以，我四點前都在。」' },
    sentence: '求助可以是一個小小的分工，不必是交出整個方向盤。',
  },
  fearful: {
    id: 'fearful', name: '靠近又撤回型', subtitle: '想有人接住，又想先躲一下。', color: '#92709a',
    summary: '在這次回答裡，你既在意連結是否穩固，也會想用距離保護自己。有時想確認對方還在，有時又不想讓人知道自己需要什麼。這種拉扯可能和最近的壓力、對象或合作經驗有關，不代表你難相處或無法改變。',
    strengths: ['對合作裡的風險與氣氛很敏銳。', '知道自己需要保護，也重視可靠的連結。', '能理解一個人同時想靠近又需要空間的感受。'],
    traps: ['還沒確認對方的意思，就在靠近與退開之間消耗自己。', '把需要藏得太深，讓願意支持你的人也找不到入口。'],
    practice: [
      { title: '先把速度放慢', text: '察覺想連發訊息或立刻消失時，先停一會兒，看看此刻最需要的是資訊、休息，還是陪伴。' },
      { title: '給出兩個真實訊號', text: '可以一起說：「這件事我很在意，也需要一點時間整理。我們明早再談。」' },
      { title: '從可預期的小合作開始', text: '選一件範圍清楚、時間明確的合作，觀察對方是否尊重約定。信任可以慢慢累積。' },
    ],
    script: { scene: '禾多小劇場｜討論有點卡，傑克想繼續聊。', you: '我想把這件事談清楚，但現在有點滿了。我先休息一下，明早十點一起看好嗎？', reply: '傑克：「好，我把問題整理好，明早再一起看。」' },
    sentence: '我可以慢慢靠近，也可以把需要空間這件事說清楚。',
  },
};

const isAnswer = (value) => Number.isInteger(value) && value >= 1 && value <= 5;
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** All 24 answers are required. Higher means more of the named axis. */
export function scoreQuiz(answers) {
  if (!Array.isArray(answers) || answers.length !== QUESTIONS.length) return null;
  // Array#every alone would accept sparse arrays without visiting their holes.
  for (let i = 0; i < QUESTIONS.length; i++) if (!isAnswer(answers[i])) return null;
  const totals = { anxiety: 0, avoidance: 0 };
  const counts = { anxiety: 0, avoidance: 0 };
  QUESTIONS.forEach((question, index) => {
    const oriented = question.reverse ? 6 - answers[index] : answers[index];
    totals[question.axis] += (oriented - 1) / 4;
    counts[question.axis]++;
  });
  const rawAnxiety = totals.anxiety / counts.anxiety * 100;
  const rawAvoidance = totals.avoidance / counts.avoidance * 100;
  const anxiety = Math.round(rawAnxiety);
  const avoidance = Math.round(rawAvoidance);
  const type = rawAnxiety >= 50
    ? (rawAvoidance >= 50 ? 'fearful' : 'anxious')
    : (rawAvoidance >= 50 ? 'avoidant' : 'secure');
  return {
    type, anxiety, avoidance,
    axes: {
      anxiety: { percentage: anxiety, label: '回應不安' },
      avoidance: { percentage: avoidance, label: '保持距離' },
    },
    closeToBoundary: Math.abs(rawAnxiety - 50) <= 10 || Math.abs(rawAvoidance - 50) <= 10,
  };
}

export function freshProgress() {
  return { version: VERSION, answers: Array(QUESTIONS.length).fill(null), cursor: 0, phase: 'intro' };
}

/** Project storage onto the quiz schema, retaining no arbitrary user fields. */
export function sanitizeProgress(raw) {
  if (!isRecord(raw) || raw.version !== VERSION) return freshProgress();
  const answers = Array.from({ length: QUESTIONS.length }, (_, index) =>
    Array.isArray(raw.answers) && isAnswer(raw.answers[index]) ? raw.answers[index] : null);
  const complete = scoreQuiz(answers) !== null;
  const firstUnanswered = answers.findIndex((answer) => answer === null);
  const requestedCursor = Number.isInteger(raw.cursor) ? raw.cursor : 0;
  const cursor = Math.max(0, Math.min(requestedCursor, QUESTIONS.length - 1, complete ? QUESTIONS.length - 1 : firstUnanswered));
  let phase = ['intro', 'quiz', 'result'].includes(raw.phase) ? raw.phase : 'intro';
  if (phase === 'result' && !complete) phase = 'quiz';
  return { version: VERSION, answers, cursor, phase };
}
