import { ISLAND_CAST } from './cast.js';
import { displayPersona } from '../persona.js';

// Fictional island consequences belong only to the current visit. This model
// never reads career runs, anonymous identity, browser storage or an API.
const peopleIds = new Set(ISLAND_CAST.map(person => person.id));
const bosses = new Set(['wing', 'spencer']);
const HISTORY_LIMIT = 12;
let nextSessionId = 0;
const free = () => ({ status: 'free', placeId: null, districtId: null });
const copy = value => JSON.parse(JSON.stringify(value));

export const CONFLICT_PLACES = Object.freeze({
  hospital: Object.freeze({ status: 'hospital', placeId: 'hospital-er', districtId: 'hospital', label: '在醫院休養' }),
  police: Object.freeze({ status: 'police', placeId: 'police-desk', districtId: 'police', label: '在警局做筆錄' }),
  exile: Object.freeze({ status: 'exile', placeId: 'exile-gate', districtId: 'exile', label: '在流放島看門' }),
});
export const FIGHT_STYLES = Object.freeze([
  Object.freeze({ id: 'steady', label: '穩住腳步' }),
  Object.freeze({ id: 'swift', label: '找準空檔' }),
  Object.freeze({ id: 'bold', label: '直接迎上去' }),
]);
const destination = status => {
  const { label, ...place } = CONFLICT_PLACES[status];
  return { ...place };
};

/** A bounded, renderer-independent conflict session. Only a completed action
 * draws an outcome. Invalid/repeated actions cannot alter another disposition. */
export function createIslandConflicts({ random = Math.random } = {}) {
  const sessionId = ++nextSessionId;
  let player = free(), turn = 0, nextFightId = 0, activeFight = null;
  const people = new Map(), history = [];
  const snapshot = () => ({ player: { ...player }, people: [...people.values()].map(person => ({ ...person })), history: copy(history), activeFight: activeFight ? { ...activeFight } : null });
  const reject = (kind, code, message) => ({ ok: false, kind, code, message });
  const checkPerson = (kind, id) => {
    if (!peopleIds.has(id)) return reject(kind, 'unknown-person', '這位角色目前不在島上的人物名冊。');
    if (activeFight) return reject(kind, 'fight-active', '先完成或離開目前的對決，再開始下一段互動。');
    if (player.status !== 'free') return reject(kind, 'player-unavailable', '先處理目前的島上事件，再找人起爭執。');
    if (people.has(id)) return reject(kind, 'person-unavailable', '對方正在處理剛才的事件，先讓他休息或完成筆錄。');
    return null;
  };
  function draw(kind) {
    let value;
    try { value = typeof random === 'function' ? random() : NaN; } catch { value = NaN; }
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 1
      ? { value } : { error: reject(kind, 'invalid-random', '這段插曲暫時沒有開始，請再試一次。') };
  }
  function finish(kind, participantId, outcome, title, description, summary) {
    turn++;
    const entry = { turn, kind, participantId, outcome, title, description,
      player: { ...player }, person: people.has(participantId) ? { ...people.get(participantId) } : null };
    if (summary) entry.summary = { ...summary };
    history.push(entry);
    if (history.length > HISTORY_LIMIT) history.splice(0, history.length - HISTORY_LIMIT);
    return { ok: true, ...copy(entry), people: [...people.values()].map(person => ({ ...person })) };
  }
  function argue(id) {
    const invalid = checkPerson('argue', id); if (invalid) return invalid;
    const sample = draw('argue'); if (sample.error) return sample.error;
    const name = displayPersona(id).name;
    if (bosses.has(id) && sample.value < .5) {
      const coldPalace = sample.value >= .25;
      player = { ...destination('exile'), placeId: coldPalace ? 'cold-palace' : 'exile-gate' };
      return finish('argue', id, 'exiled', '一句話，換了一個辦公地點',
        coldPalace
          ? `你和${name}越吵越大聲，最後收到一張寫著「暫時冷靜」的調派單。你被送到流放島冷宮，桌上只有一盆還在努力工作的植物。完成冷宮點名後，可以申請回島。`
          : `你和${name}互不相讓，最後被調到流放島看門。門口沒有訪客，卻有一張很認真的簽到表。完成看門交班後，可以重新回到小島。`);
    }
    if (sample.value < .5) return finish('argue', id, 'cooled', '話說完，先各退一步',
      `你把不滿說了出來，${name}也回了幾句。音量快蓋過海浪時，兩人先停下來喝口水，這場爭執暫時收場。`);
    return finish('argue', id, 'standoff', '誰也沒有說服誰',
      `你和${name}各說各的，連路過的海鷗都聽不出結論。最後兩人各自轉身，留下一句「下次再說」，小島又恢復了原本的聲音。`);
  }
  function beginFight(id) {
    const invalid = checkPerson('begin-fight', id); if (invalid) return invalid;
    activeFight = { token: `island-fight-${sessionId}-${++nextFightId}`, opponentId: id };
    return { ok: true, kind: 'begin-fight', ...activeFight };
  }
  function validToken(token) { return typeof token === 'string' && activeFight?.token === token; }
  function fightSummary(value, outcome) {
    try {
      if (value !== undefined && (!value || typeof value !== 'object' || Array.isArray(value)
        || Object.prototype.toString.call(value) !== '[object Object]')) return null;
      const summary = {}, limits = { duration: 600, maxCombo: 999, damageDealt: 99999, damageTaken: 99999, specialsUsed: 999 };
      for (const [key, max] of Object.entries(limits)) {
        const number = value && Object.hasOwn(value, key) ? value[key] : 0;
        if (typeof number !== 'number' || !Number.isFinite(number)) return null;
        const bounded = Math.min(max, Math.max(0, number));
        summary[key] = key === 'duration' ? Math.round(bounded * 100) / 100 : Math.floor(bounded);
      }
      const reason = value && Object.hasOwn(value, 'reason') ? value.reason : outcome === 'draw' ? 'timeout' : 'knockout';
      summary.reason = reason === 'ko' ? 'knockout' : reason;
      if (!['knockout', 'timeout', 'forfeit'].includes(summary.reason)) return null;
      return summary;
    } catch { return null; }
  }
  function settleFight(token, outcome, summaryInput) {
    if (!validToken(token)) return reject('fight', 'invalid-fight-token', '這場對決已經結束，或不是目前進行中的對決。');
    if (!['win', 'lose', 'draw'].includes(outcome)) return reject('fight', 'invalid-fight-outcome', '這場對決尚未產生有效結果。');
    const summary = fightSummary(summaryInput, outcome);
    if (!summary) return reject('fight', 'invalid-fight-summary', '這場對決的紀錄尚未完整，請重新確認。');
    const id = activeFight.opponentId, name = displayPersona(id).name;
    activeFight = null;
    if (outcome === 'draw') return finish('fight', id, 'draw', '這一場，先算平手',
      `對決結束，你和${name}都停下腳步。這次沒有分出勝負，兩人各退一步，先把火氣放在場邊，再回到自己的島上日常。`, summary);
    const won = outcome === 'win';
    player = destination(won ? 'police' : 'hospital');
    people.set(id, { id, ...destination(won ? 'hospital' : 'police') });
    const ending = summary.reason === 'forfeit'
      ? won ? `${name}放下架勢，提早認輸。` : `你舉手認輸，讓這場對決提早結束。`
      : summary.reason === 'timeout'
        ? won ? `鈴聲響起，這場對決由你勝出。` : `鈴聲響起，這場對決由${name}勝出。`
        : won ? `一陣卡通煙塵散去，你還站著，${name}坐在地上喊暫停。` : `${name}抓準空檔，你在一陣卡通煙塵裡倒下。`;
    return finish('fight', id, outcome, won ? '打贏了，下一站是警局' : '打輸了，先去醫院',
      ending + (won
        ? `救護車把${name}送往移動醫院；你則被請到島上警局，把剛才的經過寫成筆錄。`
        : `你被送往移動醫院包紮；${name}雖然贏了，仍被請到島上警局說明經過。`), summary);
  }
  function cancelFight(token) {
    if (!validToken(token)) return reject('cancel-fight', 'invalid-fight-token', '這場對決已經結束，或不是目前進行中的對決。');
    activeFight = null;
    return { ok: true, kind: 'cancel-fight' };
  }
  function recoverPlayer(placeId) {
    if (player.status === 'free') return reject('recover-player', 'already-free', '你現在可以自由散步。');
    const matches = player.status === 'exile' ? ['exile-gate', 'cold-palace'].includes(placeId) : placeId === player.placeId;
    if (!matches) return reject('recover-player', 'wrong-place', '要先到目前事件對應的場所，才能完成這件事。');
    const prior = player.status;
    player = free();
    const copyByStatus = {
      hospital: ['包紮完成，慢慢走回去', '醫護人員收好繃帶，提醒你先把腳步放慢。出院手續完成，你可以重新在島上散步。'],
      police: ['筆錄寫完，先把這頁翻過去', '你把事情經過補充清楚，簽好這份虛構的島上筆錄。值勤人員收起紙張，讓你重新回到小島。'],
      exile: ['交班完成，冷凍暫時解除', '你完成看門交班與冷宮點名，終於收到回島通知。門仍然有人顧，植物也留在原位，這次換你重新出發。'],
    };
    return finish('recover-player', null, 'free', ...copyByStatus[prior]);
  }
  function releasePerson(id, placeId) {
    if (!peopleIds.has(id)) return reject('release-person', 'unknown-person', '這位角色目前不在島上的人物名冊。');
    const person = people.get(id);
    if (!person) return reject('release-person', 'already-free', '對方已經回到自己的島上作息。');
    if (placeId !== person.placeId) return reject('release-person', 'wrong-place', '請到對方目前停留的場所，協助完成這段插曲。');
    people.delete(id);
    const name = displayPersona(id).name;
    return finish('release-person', id, 'free', `${name}準備回到小島`,
      person.status === 'hospital'
        ? `你到移動醫院探望${name}，陪他完成出院手續。繃帶收好，他準備沿著小路回到原本的作息。`
        : person.status === 'police'
          ? `你陪${name}補完筆錄，等值勤人員把資料收齊。手續完成，他準備回到原本的島上行程。`
          : `你陪${name}辦好交班與點名，等回島通知送到。冷凍解除，他準備回到原本的島上行程。`);
  }
  return Object.freeze({ getState: snapshot, argue, beginFight, settleFight, cancelFight, recoverPlayer, releasePerson });
}
