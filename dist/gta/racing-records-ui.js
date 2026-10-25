import { RACE_CATALOG } from './racing-catalog.js';
import { OWNED_CAR_CATALOG } from './ownership-catalog.js';

const el = (tag, className = '', text) => { const node = document.createElement(tag); node.className = className; if (text != null) node.textContent = text; return node; };
const action = (label, className, onClick) => { const node = el('button', className, label); node.type = 'button'; node.addEventListener('click', onClick); return node; };
const carName = id => OWNED_CAR_CATALOG.find(car => car.id === id)?.name || '自有車輛';
export function recordTime(milliseconds) {
  const ms = Number.isFinite(milliseconds) ? Math.max(0, Math.round(milliseconds)) : 0;
  return String(Math.floor(ms / 60000)).padStart(2, '0') + ':' + String(Math.floor(ms / 1000) % 60).padStart(2, '0') + '.' + String(ms % 1000).padStart(3, '0');
}
export const recordDelta = ms => ms === 0 ? '與最佳相同' : (ms < 0 ? '快 ' : '慢 ') + (Math.abs(ms) / 1000).toFixed(3) + ' 秒';

export function createRaceCentreTabs(tab, onTab) {
  const nav = el('nav', 'race-centre-tabs'); nav.setAttribute('aria-label', '賽事中心');
  for (const [id, label] of [['races', '01 · 賽事'], ['records', '02 · 排行榜'], ['achievements', '03 · 成就']]) {
    const button = action(label, '', () => onTab(id)); button.dataset.raceTab = id; button.setAttribute('aria-pressed', String(tab === id)); nav.append(button);
  }
  return nav;
}
function metric(label, value) { const node = el('div'); node.append(el('span', '', label), el('strong', '', value)); return node; }
function empty(title, text) { const node = el('div', 'race-record-empty'); node.append(el('span', 'garage-eyebrow', 'THE NEXT LAP IS YOURS'), el('h3', '', title), el('p', '', text)); return node; }
function pendingCard(board, callbacks) {
  const wrap = el('div', 'race-publication');
  if (board.message) { const note = el('p', 'race-publication-message', board.message); note.setAttribute('role', 'status'); wrap.append(note); }
  if (board.pendingError) wrap.append(el('p', 'race-board-error', board.pendingError));
  if (board.pending) {
    const name = RACE_CATALOG.find(race => race.id === board.pending.raceId)?.name || '賽事';
    wrap.append(el('strong', '', '有一筆成績待確認'), el('p', '', name + ' · ' + recordTime(board.pending.elapsedMs) + '。重試會核對同一筆紀錄。'));
    const retry = action(board.busy ? '確認中…' : '重試上傳', 'secondary', callbacks.onRetry); retry.id = 'race-ranking-retry'; retry.disabled = board.busy; wrap.append(retry);
  }
  return wrap;
}
export function createRaceRecordsPanel({ records, raceId, board, onSelectRace, onScope, onChallenge, onRefresh, onPublish, onRetry, onWithdraw }) {
  const wrap = el('section', 'race-records'); wrap.id = 'race-records';
  const controls = el('div', 'race-record-controls');
  const scope = el('div', 'race-record-scope'); scope.setAttribute('aria-label', '排行榜範圍');
  for (const [id, label] of [['personal', '個人最佳'], ['global', '全站排行']]) {
    const button = action(label, '', () => onScope(id)); button.dataset.rankingScope = id; button.setAttribute('aria-pressed', String(board.scope === id)); scope.append(button);
  }
  const label = el('label', 'race-select-label', '比較賽道'); const select = el('select'); select.id = 'race-record-course';
  for (const race of RACE_CATALOG) { const option = el('option', '', race.name); option.value = race.id; select.append(option); } select.value = raceId;
  select.addEventListener('change', () => onSelectRace(select.value)); label.append(select); controls.append(scope, label); wrap.append(controls);
  const definition = RACE_CATALOG.find(race => race.id === raceId), record = records.byRace[raceId], best = record.best;
  if (board.scope === 'personal') {
    const summary = el('div', 'race-pb-summary');
    const headline = el('div'); headline.append(el('span', 'garage-eyebrow', 'PERSONAL BEST / ' + definition.name), el('strong', 'race-pb-time', best ? recordTime(best.elapsedMs) : '— — : — —'), el('p', '', best ? carName(best.vehicleId) + ' · 引擎 ' + best.upgrades.engine + ' / 煞車 ' + best.upgrades.brakes + ' / 操控 ' + best.upgrades.handling : '下一場，就是你的第一個基準。'));
    const challenge = action(best ? '挑戰最佳紀錄 ↗' : '導航去第一場 ↗', 'primary', () => onChallenge(raceId)); challenge.id = 'race-challenge-best'; summary.append(headline, challenge); wrap.append(summary);
    const metrics = el('div', 'race-record-metrics'); metrics.append(metric('有效完賽', record.finishCount + ' 場'), metric('第一名', record.winCount + ' 次'), metric('突破最佳', record.pbCount + ' 次')); wrap.append(metrics);
    if (record.recent.length) {
      const heading = el('div', 'race-section-heading'); heading.append(el('h3', '', '最近的完賽'), el('span', '', '最近 8 場 · 本機保存')); wrap.append(heading);
      const table = el('table', 'race-times-table'); table.setAttribute('aria-label', definition.name + '最近完賽紀錄');
      const head = el('thead'), row = el('tr'); for (const title of ['順序', '完賽時間', '名次', '車輛']) { const th = el('th', '', title); th.scope = 'col'; row.append(th); } head.append(row); table.append(head);
      const body = el('tbody');
      for (const [i, run] of record.recent.entries()) { const tr = el('tr'); if (run.id === best?.id) tr.className = 'is-best'; const time = el('td', 'race-table-time', recordTime(run.elapsedMs)); if (run.id === best?.id) time.append(el('small', '', 'BEST')); tr.append(el('td', '', i === 0 ? '最新' : String(i + 1)), time, el('td', '', String(run.rank)), el('td', '', carName(run.vehicleId))); body.append(tr); } table.append(body); wrap.append(table);
    } else wrap.append(empty('還沒有完賽紀錄', '完成賽事後會記下時間、名次與當時改裝。下次出發時，沿途比較與最佳紀錄的差距。'));
    wrap.append(el('p', 'garage-footnote', '個人最佳包含有效完賽；即使名次未達賽事獎金條件，仍會留下紀錄。取消或未完成不計。'));
  } else {
    const heading = el('div', 'race-section-heading'); const title = el('div'); title.append(el('span', 'garage-eyebrow', 'STREET RECORDS / 改裝不限'), el('h3', '', definition.name));
    const refresh = action(board.status === 'loading' ? '讀取中…' : '更新榜單', 'secondary', onRefresh); refresh.id = 'race-ranking-refresh'; refresh.disabled = board.status === 'loading' || board.busy; heading.append(title, refresh); wrap.append(heading);
    if (board.error) { const error = el('p', 'race-board-error', board.error + (board.data ? ' 以下保留上次讀取的榜單。' : '')); error.setAttribute('role', 'status'); wrap.append(error); }
    if (board.status === 'loading' && !board.data) wrap.append(el('p', 'race-board-loading', '正在讀取全站成績…'));
    if (board.data?.entries.length) {
      const table = el('table', 'race-times-table race-global-table'); table.setAttribute('aria-label', definition.name + '全站前二十名');
      const head = el('thead'), row = el('tr'); for (const title of ['名次', '車手', '最佳時間', '車輛']) { const th = el('th', '', title); th.scope = 'col'; row.append(th); } head.append(row); table.append(head); const body = el('tbody');
      for (const entry of board.data.entries) { const tr = el('tr'); if (entry.driverCode === board.mine?.driverCode) tr.className = 'is-best'; const driver = el('td', 'race-driver-code', entry.driverCode); if (entry.driverCode === board.mine?.driverCode) driver.append(el('small', '', '你')); tr.append(el('td', 'race-rank', String(entry.position).padStart(2, '0')), driver, el('td', 'race-table-time', recordTime(entry.elapsedMs)), el('td', '', carName(entry.vehicleId))); body.append(tr); } table.append(body); wrap.append(table);
    } else if (board.data) wrap.append(empty('這條街，等你留下紀錄', '目前還沒有公開成績。完成一場新賽事後，可自行決定是否上傳。'));
    if (board.data) wrap.append(el('p', 'garage-footnote', board.data.totalDrivers + ' 位匿名車手 · 顯示前 20 名 · 同毫秒並列 · 每人每賽道保留最快一筆'));
    const mine = board.mine?.entries.find(entry => entry.raceId === raceId);
    if (board.mineError) wrap.append(el('p', 'race-board-error', board.mineError));
    if (mine) { const card = el('div', 'race-mine-row'); card.append(el('div', '', '我的上榜最佳 · 第 ' + mine.position + ' 名 · ' + recordTime(mine.elapsedMs))); const remove = action('撤下我的這條賽道紀錄', 'text-btn', () => onWithdraw(raceId)); remove.id = 'race-ranking-withdraw'; remove.disabled = board.busy; card.append(remove); wrap.append(card); }
    if (board.candidate) {
      const share = el('div', 'race-share-card'); share.append(el('span', 'garage-eyebrow', 'YOUR RUN / 由你決定是否上榜'), el('h3', '', '本次完賽 ' + recordTime(board.candidate.elapsedMs)), el('p', '', '上榜會公開匿名車手代號、車型與時間，可隨時撤下。個人紀錄與獎金不受是否上榜影響。'));
      const publish = action(board.busy ? '正在確認…' : '公開這次成績 ↗', 'primary', () => onPublish(raceId)); publish.id = 'race-ranking-publish'; publish.disabled = board.busy || Boolean(board.pending && board.pending.runId !== board.candidate.runId); share.append(publish); wrap.append(share);
    } else wrap.append(el('p', 'garage-footnote', '只有新版完整記錄行駛路線的完賽可上傳。既有成績保留為個人最佳，跑完下一場即可公開。'));
  }
  wrap.append(pendingCard(board, { onRetry })); return wrap;
}

export function createRaceAchievementsPanel({ records, onClaim }) {
  const wrap = el('section', 'race-achievements'); wrap.id = 'race-achievements';
  const unlocked = records.achievements.filter(item => item.unlocked).length;
  const summary = el('div', 'race-achievement-summary'); const title = el('div'); title.append(el('span', 'garage-eyebrow', 'STREET REPUTATION / 每一步都算數'), el('h3', '', unlocked + ' / ' + records.achievements.length + ' 成就達成'), el('p', '', '完成目標，解鎖一次性獎金。完賽後自動領取，可用於買車與改裝。')); summary.append(title, metric('已領取成就獎金', '$' + records.claimedReward)); wrap.append(summary);
  if (records.claimableReward) { const claim = action('領取已達成獎勵 +$' + records.claimableReward, 'primary', onClaim); claim.id = 'race-achievement-claim'; wrap.append(claim); }
  const grid = el('div', 'race-achievement-grid');
  for (const [i, item] of records.achievements.entries()) {
    const card = el('article', 'race-achievement-card' + (item.unlocked ? ' is-unlocked' : '')); card.dataset.achievement = item.id;
    const badge = el('div', 'race-achievement-badge', item.unlocked ? '✦' : String(i + 1).padStart(2, '0')); badge.setAttribute('aria-hidden', 'true');
    const content = el('div'); const meta = el('div', 'race-achievement-meta'); meta.append(el('span', '', item.claimed ? '已領取' : item.unlocked ? '已達成 · 待領取' : '挑戰中'), el('strong', '', '+$' + item.reward)); content.append(meta, el('h3', '', item.name), el('p', '', item.description));
    const ratio = item.id === 'eight-second-sprint' ? item.unlocked ? 1 : 0 : Math.min(1, (item.progress || 0) / item.target);
    const meter = el('div', 'race-achievement-track'); meter.setAttribute('role', 'progressbar'); meter.setAttribute('aria-label', item.name); meter.setAttribute('aria-valuemin', '0'); meter.setAttribute('aria-valuemax', '100'); meter.setAttribute('aria-valuenow', String(Math.round(ratio * 100))); const fill = el('span'); fill.style.width = Math.round(ratio * 100) + '%'; meter.append(fill);
    const text = item.id === 'eight-second-sprint' ? item.progress === null ? '最佳：尚無紀錄' : '最佳：' + recordTime(item.progress) : Math.min(item.progress || 0, item.target) + ' / ' + item.target;
    content.append(meter, el('small', 'race-achievement-progress', text)); card.append(badge, content); grid.append(card);
  }
  wrap.append(grid, el('p', 'garage-footnote', '成就與獎勵保存在這台裝置。同一成就只發獎一次；清除瀏覽器資料將失去本機收藏。')); return wrap;
}
