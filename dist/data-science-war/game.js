import { OPENING, TOPICS, CLOSING } from './cases.js';
import { ITEMS, ITEM_BY_ID, meetingItemEffect } from './items.js';

export const SAVE_KEY = 'hedo-data-science-war-v1';
const STARTING_RAGE = 34;

const ENDINGS = {
  policeEntry: { title: '會議室門口的筆錄', text: '鷲發現前 CEO 留下的擬真玩具槍，先請你離開，再打電話報警。傑克在會議室裡把議程改回五人。你連椅子都沒坐到。' },
  kicked: { title: '連汽水都沒喝到', text: '鷲發現你帶了不適合進會議室的道具，當場請你出去。門關上的那一刻，紅酒正好打開薯片。' },
  angry: { title: '山姆帶走了薯片', text: '山姆把線代課本闔上，拎著剩下的薯片離開。下週五的讀書會從行事曆消失。傑克手上的輪值表，一個名字都還沒填。' },
  calm: { title: '下週五，換人主持', text: '山姆把講義留下來，請鷲把最急的卡點寄給大家。伊森在共筆寫下分工。傑克看了一眼時間，準時散會。' },
  friends: { title: '以後早餐一起吃', text: '山姆難得笑出聲。「你以後就是我兄弟，兄妹也算。早餐我都要跟你去吃。」他把講義塞回包裡，壓低聲音又補一句。「老闆乾兒子跟傑克都是垃圾廢物。」傑克剛好回來拿筆，假裝只聽見早餐。', perfect: true },
  postponed: { title: '週五留了一份共筆', text: '傑克把每個人的疑問記了下來。六題看完，桌上仍有好幾題沒人接手。紅酒把記錄取名為「下次有空再打開」。' },
  soup: { title: '全員喝到想請假', text: '翅膀推門進來，說再好的模型都需要心靈雞湯。他把保溫桶的內容倒進五個杯子，也給自己盛一杯。第一口下去，全桌都吐了，翅膀也在找紙巾。傑克緩過來，把「會議完美結束」換成「請總務拿拖把」。', portrait: 'wing' },
  duelWin: { title: '山姆進醫院，你進警局', text: '禾多島擂台判你勝。山姆被送去醫院檢查，鷲把你留在現場等警察。傑克到警局說明來龍去脈，帶去的資料只有一份沒講完的會議記錄。' },
  duelLose: { title: '山姆進警局，你進醫院', text: '擂台判山姆勝。你醒來時人在醫院，伊森坐在旁邊。山姆被警方帶去說明。你手機裡最後一則會議通知寫著「暫停」。' },
  duelDraw: { title: '兩個人一起做筆錄', text: '倒數歸零，擂台判定平手。鷲叫來的人請你們分開說明。傑克的會議記錄停在「雙方同意各講兩分鐘」。' },
  duelQuit: { title: '擂台空了，會也散了', text: '你放棄單挑。紅酒關掉投影，山姆拎起講義走人。等大家回過神，傑克已把白板擦乾淨。' },
};

const BATTLE_ENDING = { win: 'duelWin', lose: 'duelLose', draw: 'duelDraw', quit: 'duelQuit' };
const LEGACY_BATTLE = {
  win: { title: '把議程打回原形', text: '山姆把線代講義翻到空白頁，問你要從哪個問題重新開始。', rage: -46, credibility: 2 },
  lose: { title: '被送回會議室', text: '伊森幫你把會議資料撿起來，紅酒宣布休息五分鐘。', rage: -40, credibility: 0 },
  draw: { title: '戰到投影機休眠', text: '時間用完，兩邊都收手。鷲決定把剩下的時間留給實驗。', rage: -44, credibility: 1 },
  quit: { title: '從禾多島撤回', text: '紅酒把投影切回會議資料，請大家先寫下今天的決定。', rage: -45, credibility: 0 },
};

function sample(values, count, seed) {
  let random = seed >>> 0;
  const pool = [...values];
  for (let index = pool.length - 1; index > 0; index--) {
    random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
    const target = Math.floor(random / 4294967296 * (index + 1));
    [pool[index], pool[target]] = [pool[target], pool[index]];
  }
  return pool.slice(0, count);
}

export function buildAgenda(seed) {
  return [...OPENING, ...sample(TOPICS, 3, seed), CLOSING];
}

export function buildItemDraw(seed) {
  return sample(ITEMS, 3, seed ^ 0x546a9de1);
}

export function createMeeting(seed, legacyCount = null) {
  return {
    seed: seed >>> 0,
    agenda: buildAgenda(seed),
    itemDraw: buildItemDraw(seed),
    itemId: null,
    itemUsed: false,
    legacyCount,
    index: 0,
    phase: legacyCount === null ? 'items' : 'debate',
    rage: STARTING_RAGE,
    credibility: 0,
    wins: 0,
    correct: 0,
    resolved: 0,
    report: null,
    actions: [],
  };
}

function finish(state, id) {
  return { ...state, phase: 'ending', ending: id, report: null };
}

function withReport(state, { title, text, rage, credibility, repairable = false, proof = null }) {
  const nextRage = Math.min(100, Math.max(0, state.rage + rage));
  const nextCredibility = Math.max(0, state.credibility + credibility);
  return {
    ...state,
    phase: 'report',
    rage: nextRage,
    credibility: nextCredibility,
    report: { title, text, rage: nextRage - state.rage, credibility: nextCredibility - state.credibility, repairable, proof },
  };
}

function meetingEnding(state, legacy) {
  if (legacy) {
    if (state.wins) return 'legacyIsland';
    if (state.rage >= 75) return 'legacyChips';
    return state.credibility >= 5 ? 'legacyRotation' : 'legacyMemo';
  }
  if (state.rage >= 75) return 'angry';
  if (state.resolved >= 3 && state.credibility >= 7 && state.rage <= 42) return 'friends';
  if (state.credibility >= 4 || state.resolved >= 2) return 'calm';
  return 'postponed';
}

const LEGACY_ENDINGS = {
  legacyIsland: { title: '週五雙主場', text: '下週的主持人還是輪流當。這次的會議記錄多了一條擂台附註。' },
  legacyChips: { title: '洋芋片散會', text: ENDINGS.angry.text },
  legacyRotation: { title: '下週換你主持', text: ENDINGS.calm.text },
  legacyMemo: { title: '只留一份逐字稿', text: ENDINGS.postponed.text },
};

export function endingFor(state) {
  return ENDINGS[state.ending] ?? LEGACY_ENDINGS[state.ending];
}

function checkAtTheDoor(seed, item) {
  const check = (Math.imul(seed ^ 0xd167319b, 2654435761) >>> 0) / 4294967296;
  return check * 100 < item.scrutiny;
}

function applyAction(state, action, legacy) {
  const scene = state.agenda[state.index];
  const item = state.itemId ? ITEM_BY_ID[state.itemId] : null;
  if (state.phase === 'ending') return state;
  if (state.phase === 'items') {
    if (action.type !== 'pack') return state;
    const chosen = state.itemDraw.find(entry => entry.id === action.item);
    if (!chosen) return state;
    const arrived = { ...state, itemId: chosen.id, phase: 'debate' };
    if (chosen.loadout && checkAtTheDoor(state.seed, chosen)) {
      return finish(arrived, chosen.police ? 'policeEntry' : 'kicked');
    }
    return arrived;
  }
  if (state.phase === 'battle') {
    if (action.type !== 'battle' || typeof action.result !== 'string' || !Object.hasOwn(BATTLE_ENDING, action.result)) return state;
    const resolved = { ...state, wins: state.wins + Number(action.result === 'win') };
    return legacy
      ? withReport(resolved, LEGACY_BATTLE[action.result])
      : finish(resolved, BATTLE_ENDING[action.result]);
  }
  if (action.type === 'fight' && (state.phase === 'debate' || state.phase === 'report' && state.rage === 100)) {
    return { ...state, phase: 'battle' };
  }
  if (state.phase === 'report') {
    if (action.type === 'repair' && !legacy && state.report.repairable) {
      const apology = scene.replies.find(reply => reply.id === 'apology');
      return withReport(state, { title: '收回剛才那句', text: apology.result, rage: apology.rage, credibility: apology.cred });
    }
    if (action.type !== 'advance') return state;
    if (state.index + 1 === state.agenda.length) return finish(state, meetingEnding(state, legacy));
    return {
      ...state, index: state.index + 1, phase: 'debate',
      rage: state.rage === 100 ? 78 : state.rage, report: null,
    };
  }
  if (action.type === 'wing' && !legacy && scene === CLOSING) return finish(state, 'soup');
  if (action.type === 'item' && !legacy && !state.itemUsed) {
    const effect = meetingItemEffect(item, scene);
    if (!effect) return state;
    const used = { ...state, itemUsed: true, resolved: state.resolved + Number(effect.solved) };
    return withReport(used, { ...effect, title: item.label });
  }
  if (action.type !== 'reply') return state;
  const reply = scene.replies.find(entry => entry.id === action.reply);
  if (!reply || legacy && (reply.id === 'scold' || reply.id === 'apology')) return state;
  if (reply.id !== 'challenge') {
    return withReport(state, {
      title: reply.label, text: reply.result, rage: reply.rage, credibility: reply.cred,
      repairable: reply.id === 'scold',
    });
  }
  if (!scene.evidence.some(entry => entry.id === action.evidence)) return state;
  if (action.evidence !== scene.rebuttal) {
    return withReport(state, {
      title: legacy ? '反駁失焦' : '答錯了',
      text: '你拿出的資料回答了另一個問題。伊森指了指投影上的原句，傑克請你再對照一次。',
      rage: 18, credibility: -1, repairable: !legacy, proof: 'miss',
    });
  }
  const answered = { ...state, correct: state.correct + 1, resolved: state.resolved + 1 };
  return withReport(answered, {
    title: reply.label, text: reply.result, rage: legacy ? reply.rage : reply.rage - 5,
    credibility: reply.cred, proof: 'hit',
  });
}

export function advanceMeeting(state, action) {
  if (!state || !action || typeof action !== 'object') return state;
  const legacy = state.legacyCount !== null && state.actions.length < state.legacyCount;
  const next = applyAction(state, action, legacy);
  if (next === state) return state;
  const record = { type: action.type };
  if (action.type === 'pack') record.item = action.item;
  if (action.type === 'reply') {
    record.reply = action.reply;
    if (action.reply === 'challenge') record.evidence = action.evidence;
  }
  if (action.type === 'battle') record.result = action.result;
  return { ...next, actions: [...state.actions, record] };
}

export function saveMeeting(state, storage) {
  try {
    const { seed, actions, legacyCount } = state;
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 2, seed, actions, legacyCount }));
  } catch {
    // Storage denial leaves the current meeting playable.
  }
}

export function restoreMeeting(storage) {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw || raw.length > 7000) return null;
    const save = JSON.parse(raw);
    if (!save || ![1, 2].includes(save.version) || !Number.isInteger(save.seed) || save.seed < 0 || save.seed > 0xffffffff) return null;
    if (!Array.isArray(save.actions) || save.actions.length > 30) return null;
    const legacyCount = save.version === 1 ? save.actions.length : save.legacyCount;
    if (legacyCount !== null && (!Number.isInteger(legacyCount) || legacyCount < 0 || legacyCount > save.actions.length)) return null;
    let state = createMeeting(save.seed, legacyCount);
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
