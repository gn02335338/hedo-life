import { OPENING, TOPICS, CLOSING } from './cases.js';

export const SAVE_KEY = 'hedo-data-science-war-v1';
const STARTING_RAGE = 34;
const BATTLE_RESULTS = {
  win: { title: '把議程打回原形', text: '戰鬥大師的護甲在投影裡散開。山姆把桌上的線代講義翻到空白頁，問你要從哪個問題重新開始。', rage: -46, credibility: 2 },
  lose: { title: '被送回會議室', text: '你在投影熄滅前回到座位。Ethan 幫你把散落的會議資料撿起來，Wine 宣布休息五分鐘。', rage: -40, credibility: 0 },
  draw: { title: '戰到投影機休眠', text: '時間用完，兩邊都收招。Joe 瞄了時鐘一眼，決定把剩下的時間留給實驗。', rage: -44, credibility: 1 },
  quit: { title: '從禾多島撤回', text: '你按下退出。Wine 把投影切回會議資料，問大家能不能先把今天唯一要做的決定寫下來。', rage: -45, credibility: 0 },
};

const ENDINGS = {
  island: { title: '週五雙主場', text: '白天的會議紀錄多了一條附註。「有證據就投影，有爭議先離開擂台再談。」下週的主持人還是輪流當。' },
  rotation: { title: '下週換你主持', text: '山姆留下線代講義，Joe 帶走有待查證的問題。Ethan 開了一份共筆，Wine 把剩下的洋芋片留到下週。' },
  chips: { title: '洋芋片散會', text: '山姆收起書，帶走剩下的洋芋片。下週五，行事曆空了出來，只有那份共筆還開著。' },
  memo: { title: '只留一份逐字稿', text: '會議在下班前結束。你把各自的立場記了下來，卻沒人認領下一個問題。Wine 留了最後一句。「至少洋芋片有被處理。」' },
};

export function buildAgenda(seed) {
  let random = seed >>> 0;
  const pool = [...TOPICS];
  for (let index = pool.length - 1; index > 0; index--) {
    random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
    const target = Math.floor(random / 4294967296 * (index + 1));
    [pool[index], pool[target]] = [pool[target], pool[index]];
  }
  return [...OPENING, ...pool.slice(0, 3), CLOSING];
}

export function createMeeting(seed) {
  return {
    seed: seed >>> 0,
    agenda: buildAgenda(seed),
    index: 0,
    phase: 'debate',
    rage: STARTING_RAGE,
    credibility: 0,
    wins: 0,
    correct: 0,
    transformed: false,
    report: null,
    actions: [],
  };
}

const keepInRange = (value) => Math.min(100, Math.max(0, value));

function withReport(state, { title, text, rage, credibility }) {
  const nextRage = keepInRange(state.rage + rage);
  return {
    ...state,
    phase: 'report',
    rage: nextRage,
    credibility: Math.max(0, state.credibility + credibility),
    transformed: state.transformed || nextRage === 100,
    report: {
      title, text, rage: nextRage - state.rage,
      credibility: Math.max(0, state.credibility + credibility) - state.credibility,
    },
  };
}

function getEnding(state) {
  if (state.wins) return ENDINGS.island;
  if (state.rage >= 75) return ENDINGS.chips;
  if (state.credibility >= 5) return ENDINGS.rotation;
  return ENDINGS.memo;
}

function applyAction(state, action) {
  if (state.phase === 'ending') return state;
  if (action.type === 'fight' && (state.phase === 'debate' || state.phase === 'report' && state.rage === 100)) {
    return { ...state, phase: 'battle' };
  }
  if (action.type === 'battle' && state.phase === 'battle' && Object.hasOwn(BATTLE_RESULTS, action.result)) {
    return withReport({ ...state, wins: state.wins + Number(action.result === 'win') }, BATTLE_RESULTS[action.result]);
  }
  if (action.type === 'advance' && state.phase === 'report') {
    if (state.index + 1 === state.agenda.length) return { ...state, phase: 'ending', ending: getEnding(state) };
    return {
      ...state, index: state.index + 1, phase: 'debate',
      rage: state.rage === 100 ? 78 : state.rage, report: null,
    };
  }
  if (action.type !== 'reply' || state.phase !== 'debate') return state;
  const scene = state.agenda[state.index];
  const reply = scene.replies.find(({ id }) => id === action.reply);
  if (!reply) return state;
  const label = reply.label;
  if (reply.id === 'challenge') {
    if (!scene.evidence.some(({ id }) => id === action.evidence)) return state;
    if (action.evidence !== scene.rebuttal) {
      return withReport(state, {
        title: '反駁失焦',
        text: '這份資料和眼前的主張接不上。山姆把資料推了回來，請你指出哪一段能動搖原本的結論。',
        rage: 18, credibility: -1,
      });
    }
    state = { ...state, correct: state.correct + 1 };
  }
  return withReport(state, { title: label, text: reply.result, rage: reply.rage, credibility: reply.cred });
}

export function advanceMeeting(state, action) {
  if (!state || !action || typeof action !== 'object') return state;
  const next = applyAction(state, action);
  if (next === state) return state;
  const record = { type: action.type };
  if (action.type === 'reply') {
    record.reply = action.reply;
    if (action.reply === 'challenge') record.evidence = action.evidence;
  }
  if (action.type === 'battle') record.result = action.result;
  return { ...next, actions: [...state.actions, record] };
}

export function saveMeeting(state, storage) {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 1, seed: state.seed, actions: state.actions }));
  } catch {
    // The current meeting remains playable if browser storage is unavailable.
  }
}

export function restoreMeeting(storage) {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw || raw.length > 7000) return null;
    const save = JSON.parse(raw);
    if (save?.version !== 1 || !Number.isInteger(save.seed) || save.seed < 0 || save.seed > 0xffffffff) return null;
    if (!Array.isArray(save.actions) || save.actions.length > 30) return null;
    let state = createMeeting(save.seed);
    for (const action of save.actions) {
      const next = advanceMeeting(state, action);
      if (next === state) return null;
      state = next;
    }
    return state;
  } catch {
    return null;
  }
}
