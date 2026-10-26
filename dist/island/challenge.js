import { ISLAND_CAST } from './cast.js';
import { displayIslandPersona } from './persona.js';
import { CHALLENGE_STORAGE_KEY, CHALLENGE_STORAGE_KEYS, CHALLENGE_RECEIPT_KEYS, CHALLENGE_INVITATION_KEY } from './challenge-storage.js';
export { CHALLENGE_STORAGE_KEY, CHALLENGE_STORAGE_KEYS } from './challenge-storage.js';

// Browser-local story progress. This never reads a career run, anonymous bearer,
// private archive, free-fight history or server record.
const bossOrder = Object.freeze(['rick', 'spencer', 'wing']);
const hiddenId = 'hidden-visitor';
const ordinaryIds = Object.freeze(ISLAND_CAST.map(person => person.id).filter(id => !bossOrder.includes(id)));
const allIds = Object.freeze([...ordinaryIds, ...bossOrder, hiddenId]);
const knownIds = new Set(allIds);
const receiptKey = id => CHALLENGE_RECEIPT_KEYS[id];
const invitationKey = CHALLENGE_INVITATION_KEY;

const chapterDefinitions = [
  { id: 'first-page', title: '第一章｜把話說清楚',
    opening: '碼頭收到一冊空白的島上紀錄。第一頁從研發與產品的庭院開始：先認識每個人的步調，再學著看懂對方準備出手的訊號。',
    completion: '第一頁終於寫滿。版本、設計與交付各有主張，但你已學會讓每一場對決都有開始，也有收尾。',
    opponentIds: ['jack', 'helen', 'sam', 'professor', 'princess', 'simon', 'wine', 'henry'] },
  { id: 'promises', title: '第二章｜承諾的另一面',
    opening: '一疊合作名單被海風吹到商務聚落。有人談方向、有人追窗口，這一章要練習在一波又一波承諾之間，替自己留出站位。',
    completion: '合作名單一張張歸位。漂亮的提案與急促的跟進沒有消失，你卻已懂得等一個真正可以回應的空檔。',
    opponentIds: ['meimei', 'owen', 'annie_yu', 'joyce', 'action', 'hester'] },
  { id: 'procedures', title: '第三章｜流程裡的人',
    opening: '行政館的燈還亮著，表格、鑰匙和面談紀錄排成一列。每個流程後面都站著一個人，先聽完他們的開場，再決定怎麼接招。',
    completion: '表格蓋好最後一枚章。你沒有靠衝得更快完成這一章，而是看清了界線、時機和每一個願意把事情說明白的人。',
    opponentIds: ['erich', 'jenjen', 'hope', 'captain', 'mia'] },
  { id: 'handover', title: '第四章｜最後一筆交付',
    opening: '交付清單與帳本一起送到桌上。數字、附件、排程都要對得起來；這一章不比誰喊得大聲，比誰能在壓力裡穩住自己的節奏。',
    completion: '最後一筆資料終於對上。文件收進抽屜，排程暫時停在今天，你把這份完整的交付記進了島上紀錄。',
    opponentIds: ['janet', 'sophie', 'cindy', 'johnny'] },
  { id: 'after-hours', title: '第五章｜下班以後',
    opening: '渡船把白天的聲音留在後方。球場、補給桌與夜色碼頭還有人等你；離開辦公室之後，每個人又露出另一種打法。',
    completion: '夜色中的最後一場也收隊了。三十一位同事的名字都留在冊上，經營總部終於回覆：下一張正式邀請，已經準備好。',
    opponentIds: ['sonny', 'kind', 'jonathan', 'zoe', 'james', 'alice', 'peter', 'tony'] },
].map(chapter => Object.freeze({ ...chapter, opponentIds: Object.freeze(chapter.opponentIds) }));
export const CHALLENGE_CHAPTERS = Object.freeze(chapterDefinitions.map(({ id, title, opponentIds }) => Object.freeze({ id, title, opponentIds })));
const chapterOf = new Map(chapterDefinitions.flatMap(chapter => chapter.opponentIds.map(id => [id, chapter])));
const bossStories = Object.freeze({
  rick: Object.freeze({ title: '第六章｜乾兒子的轉接單', opening: '三十一位同事的紀錄攤在桌上，乾兒子終於把轉接單放下。這一次，他不能再請你先去找別人，必須親自把這場打完。', completion: '轉接單第一次有了真正的收件人。乾兒子把自己的那一頁簽好，董事長室的門燈隨之亮起。' }),
  spencer: Object.freeze({ title: '第七章｜董事長的版圖', opening: '董事長把願景圖展開，整片場地彷彿都成了待決定的市場。你帶著前面所有人的紀錄進場，這一次不只聽方向，也要站穩自己的位置。', completion: '版圖收回桌面，數字紙牌也停了下來。董事長翻到最後一頁，執行長的邀請已經等在那裡。' }),
  wing: Object.freeze({ title: '第八章｜最後一次問進度', opening: '翅膀扶穩拐杖，看完你帶回的整冊紀錄。前面每個人的節奏都走過了，現在換你親自回答這一場最後的進度。', completion: '金色光圈散去，翅膀終於把進度表闔上。這場正式挑戰已經完成；你回到碼頭時，發現紀錄冊裡多了一封沒有署名的信。' }),
});
const story = (title, body) => ({ title, body });
const introStory = () => story('序章｜一冊從碼頭開始的紀錄', '島上的對戰被整理成一趟正式挑戰。先和三十一位同事逐一交手，累積真正勝出的紀錄，再前往經營總部。輸了可以休息、重來，已完成的頁面會留在這個瀏覽器。');
const invitationStory = () => story('碼頭的一封信', '信封沒有署名，只寫著：「如果你還願意把最後一頁翻開，就到安靜的那一側來。」這是一張新的邀請，你可以現在赴約，也可以先回島上走走。');
const hiddenOpening = () => story('終章｜翻開沒有署名的一頁', '魚酥姐把手邊的東西放整齊，抬頭看了你一眼。翻譯、版本和零食櫃的規則，原來都能變成場上的節奏。這一頁沒有主管席，只有一場由你決定是否赴約的最後對決。');
const finalStory = () => story('尾聲｜潮聲裡的最後一頁', '最後一場結束，魚酥姐替紀錄冊補上了句點。你把三十五位對手的名字收進冊裡，回到碼頭時，渡船仍照平常的時刻開航。島上的工作和生活還在繼續，這趟挑戰已經有了完整的結尾。');
const fresh = () => ({ version: 1, wins: [], invitationOpened: false });
const isRecord = value => value && typeof value === 'object' && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
function project(value) {
  try {
    if (!isRecord(value) || !Object.hasOwn(value, 'version') || value.version !== 1
      || !Object.hasOwn(value, 'wins') || !Array.isArray(value.wins)) return fresh();
    const candidates = new Set();
    for (const id of value.wins) if (typeof id === 'string' && knownIds.has(id)) candidates.add(id);
    const wins = ordinaryIds.filter(id => candidates.has(id));
    if (wins.length === ordinaryIds.length) for (const id of bossOrder) { if (!candidates.has(id)) break; wins.push(id); }
    const invitationOpened = wins.includes('wing') && Object.hasOwn(value, 'invitationOpened') && value.invitationOpened === true;
    if (invitationOpened && candidates.has(hiddenId)) wins.push(hiddenId);
    return { version: 1, wins, invitationOpened };
  } catch { return fresh(); }
}
const merge = (a, b) => project({ version: 1, wins: [...a.wins, ...b.wins], invitationOpened: a.invitationOpened || b.invitationOpened });
let sessionSequence = 0;

export function createIslandChallenge({ storage } = {}) {
  const sessionId = ++sessionSequence;
  let progress = fresh(), active = null, battleSequence = 0, lastResult = null, storageAvailable = false;
  function readStorage() {
    try {
      if (typeof storage?.getItem !== 'function') { storageAvailable = false; return fresh(); }
      const parse = key => {
        const raw = storage.getItem(key);
        if (typeof raw !== 'string' || raw.length > 12000) return null;
        try { return JSON.parse(raw); } catch { return null; }
      };
      const aggregate = project(parse(CHALLENGE_STORAGE_KEY));
      const wins = [...aggregate.wins];
      for (const id of allIds) {
        const receipt = parse(receiptKey(id));
        if (isRecord(receipt) && Object.hasOwn(receipt, 'version') && receipt.version === 1
          && Object.hasOwn(receipt, 'opponentId') && receipt.opponentId === id && Object.hasOwn(receipt, 'won') && receipt.won === true) wins.push(id);
      }
      const invitation = parse(invitationKey);
      const opened = aggregate.invitationOpened || (isRecord(invitation) && Object.hasOwn(invitation, 'version') && invitation.version === 1
        && Object.hasOwn(invitation, 'opened') && invitation.opened === true);
      storageAvailable = true;
      return project({ version: 1, wins, invitationOpened: opened });
    } catch { storageAvailable = false; return fresh(); }
  }
  const refresh = () => { progress = merge(progress, readStorage()); };
  function persist(receipt, payload) {
    let available = true;
    try { if (typeof storage?.setItem !== 'function') available = false; else storage.setItem(receipt, JSON.stringify(payload)); }
    catch { available = false; }
    // Receipts are append-only, so a stale aggregate written by another tab can
    // never erase a win. Read them again immediately before updating the index.
    const latest = readStorage(); available = available && storageAvailable;
    progress = merge(progress, latest);
    try { if (typeof storage?.setItem !== 'function') available = false; else storage.setItem(CHALLENGE_STORAGE_KEY, JSON.stringify(progress)); }
    catch { available = false; }
    storageAvailable = available;
  }
  refresh();
  const reject = (code, message) => ({ ok: false, code, message });
  const nameOf = id => id === hiddenId ? '魚酥姐' : displayIslandPersona(id)?.name || id;
  function check(id) {
    if (typeof id !== 'string' || !knownIds.has(id)) return reject('unknown-opponent', '這位對手目前不在故事挑戰名單裡。');
    if (id === hiddenId) {
      if (!progress.invitationOpened) return reject('invitation-unavailable', '這一頁目前還沒有收到邀請。');
      return { ok: true, kind: 'hidden', won: progress.wins.includes(id) };
    }
    if (ordinaryIds.includes(id)) return { ok: true, kind: 'ordinary', won: progress.wins.includes(id) };
    if (ordinaryIds.some(person => !progress.wins.includes(person))) return reject('colleagues-incomplete', '先完成三十一位同事的故事挑戰，再回來接受經營總部的邀請。');
    const index = bossOrder.indexOf(id);
    if (bossOrder.slice(0, index).some(person => !progress.wins.includes(person))) return reject('previous-boss-incomplete', '經營總部的邀請依序進行，先完成眼前這一場。');
    return { ok: true, kind: 'boss', won: progress.wins.includes(id) };
  }
  function preparation(id) {
    const gate = check(id); if (!gate.ok) return gate;
    const chapter = chapterOf.get(id);
    return { ...gate, opponentId: id, name: nameOf(id), story: id === hiddenId ? hiddenOpening()
      : bossStories[id] ? story(bossStories[id].title, bossStories[id].opening)
        : story(chapter.title, `${chapter.opening} 這一場，${nameOf(id)}已經在等你。`) };
  }
  function snapshot() {
    const remaining = ordinaryIds.filter(id => !progress.wins.includes(id));
    const bosses = bossOrder.map(id => ({ id, name: nameOf(id), won: progress.wins.includes(id), available: check(id).ok }));
    const invitation = { available: progress.wins.includes('wing'), opened: progress.invitationOpened };
    const completed = progress.wins.includes(hiddenId);
    const hidden = progress.invitationOpened ? { id: hiddenId, name: nameOf(hiddenId), available: true, won: completed } : null;
    let next;
    if (remaining.length) {
      const id = chapterDefinitions.flatMap(chapter => chapter.opponentIds).find(person => remaining.includes(person));
      next = { kind: 'ordinary', opponentId: id, name: nameOf(id), chapterId: chapterOf.get(id).id };
    } else {
      const boss = bossOrder.find(id => !progress.wins.includes(id));
      next = boss ? { kind: 'boss', opponentId: boss, name: nameOf(boss) }
        : !invitation.opened ? { kind: 'invitation', label: '碼頭的一封信' }
          : !completed ? { kind: 'hidden', opponentId: hiddenId, name: nameOf(hiddenId) }
            : { kind: 'complete', label: '潮聲裡的最後一頁' };
    }
    const chapters = chapterDefinitions.map(chapter => {
      const won = chapter.opponentIds.filter(id => progress.wins.includes(id)).length, complete = won === chapter.opponentIds.length;
      return { id: chapter.id, title: chapter.title, opponentIds: [...chapter.opponentIds], opening: chapter.opening,
        won, total: chapter.opponentIds.length, complete, ...(complete ? { completion: chapter.completion } : {}) };
    });
    const currentStory = completed ? finalStory() : invitation.opened ? hiddenOpening()
      : invitation.available ? invitationStory()
        : next.kind === 'boss' ? story(bossStories[next.opponentId].title, bossStories[next.opponentId].opening)
          : progress.wins.length === 0 ? introStory() : story(chapterOf.get(next.opponentId).title, chapterOf.get(next.opponentId).opening);
    return { version: 1, ordinary: { won: ordinaryIds.filter(id => progress.wins.includes(id)), total: ordinaryIds.length, remaining },
      wins: [...progress.wins], bosses, chapters, invitation, hidden, next, currentStory, completed,
      completion: completed ? finalStory() : null, active: active ? { opponentId: active.opponentId } : null,
      lastResult: lastResult ? { ...lastResult, story: { ...lastResult.story }, chapterCompleted: [...lastResult.chapterCompleted] } : null,
      storageAvailable };
  }
  return Object.freeze({
    getState: snapshot,
    sync() { refresh(); return snapshot(); },
    canChallenge(id) { refresh(); return { ...check(id) }; },
    prepare(id) { refresh(); return preparation(id); },
    begin(id) {
      if (active) return reject('challenge-active', '先完成或離開目前的故事對決。');
      refresh(); const prepared = preparation(id); if (!prepared.ok) return prepared;
      active = { opponentId: id, token: `island-challenge-${sessionId}-${++battleSequence}` };
      return { ...prepared, token: active.token, state: snapshot() };
    },
    settle(token, outcome) {
      if (typeof token !== 'string' || token !== active?.token) return reject('invalid-challenge-token', '這場故事對決已經結束，或不是目前進行中的對決。');
      if (!['win', 'lose', 'draw'].includes(outcome)) return reject('invalid-challenge-outcome', '這場故事對決尚未產生有效結果。');
      const id = active.opponentId; active = null; refresh();
      const before = new Set(progress.wins), beforeChapters = new Set(chapterDefinitions.filter(chapter => chapter.opponentIds.every(person => before.has(person))).map(chapter => chapter.id));
      const newVictory = outcome === 'win' && !before.has(id);
      if (newVictory) {
        progress = project({ ...progress, wins: [...progress.wins, id] });
        persist(receiptKey(id), { version: 1, opponentId: id, won: true });
      }
      const chapterCompleted = chapterDefinitions.filter(chapter => !beforeChapters.has(chapter.id) && chapter.opponentIds.every(person => progress.wins.includes(person))).map(chapter => chapter.id);
      let resultStory;
      if (outcome === 'lose') resultStory = story('這一頁，休息後再寫', `${nameOf(id)}拿下了這場。你把剛才沒看清的出手訊號記在頁邊，先休息一下；已完成的勝場仍留著，回來可以從這位對手重新挑戰。`);
      else if (outcome === 'draw') resultStory = story('先把這場留在頁邊', `你和${nameOf(id)}停下腳步，這次沒有分出勝負。紀錄冊先留下這段交手，勝場還要等下一場真正分出結果；前面完成的頁面仍會保留。`);
      else if (!newVictory) resultStory = story('熟悉的一頁，再打一次', `你再次贏過${nameOf(id)}。這段練習有了新的手感，原本的通關紀錄只會計算一次。`);
      else if (id === hiddenId) resultStory = finalStory();
      else if (bossStories[id]) resultStory = story(bossStories[id].title, bossStories[id].completion);
      else if (chapterCompleted.length) resultStory = story(chapterOf.get(id).title, chapterOf.get(id).completion);
      else resultStory = story('這一場，正式記下', `你贏過${nameOf(id)}，替紀錄冊補上一個名字。對方收好架勢，這一頁完成了；下一位同事還在島上的某個角落等你。`);
      lastResult = { opponentId: id, outcome, newVictory, chapterCompleted, story: resultStory };
      return { ok: true, ...lastResult, chapterCompleted: [...chapterCompleted], story: { ...resultStory }, storageAvailable, state: snapshot() };
    },
    cancel(token) {
      if (typeof token !== 'string' || token !== active?.token) return reject('invalid-challenge-token', '這場故事對決已經結束，或不是目前進行中的對決。');
      active = null; return { ok: true, state: snapshot() };
    },
    openInvitation() {
      if (active) return reject('challenge-active', '先完成或離開目前的故事對決，再拆開新的邀請。');
      refresh();
      if (!progress.wins.includes('wing')) return reject('invitation-unavailable', '碼頭目前還沒有新的邀請。');
      if (!progress.invitationOpened) { progress = project({ ...progress, invitationOpened: true }); persist(invitationKey, { version: 1, opened: true }); }
      return { ok: true, story: progress.wins.includes(hiddenId) ? finalStory() : hiddenOpening(), state: snapshot() };
    },
  });
}
