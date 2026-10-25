import { RACE_CATALOG } from './racing-catalog.js';
import { dailyChallenge, RACING_DAY_MS, validWeekId } from './racing-calendar.js';
import { recordTime, recordDelta } from './racing-records-ui.js';

const el = (tag, className = '', text) => { const node = document.createElement(tag); node.className = className; if (text != null) node.textContent = text; return node; };
const action = (label, className, callback, id) => { const node = el('button', className, label); node.type = 'button'; node.addEventListener('click', callback); if (id) node.id = id; return node; };
const shortDay = day => day.slice(5).replace('-', '/');
export function weekRange(weekId) {
  if (!validWeekId(weekId)) return '';
  const last = new Date(Date.parse(weekId + 'T00:00:00Z') + 6 * RACING_DAY_MS).toISOString().slice(0, 10);
  return shortDay(weekId) + ' — ' + shortDay(last);
}
function remaining(end, now) {
  const minutes = Math.max(0, Math.ceil((end - now) / 60000));
  return minutes >= 60 ? Math.floor(minutes / 60) + ' 小時 ' + minutes % 60 + ' 分' : minutes + ' 分鐘';
}

export function createDailyChallengePanel({ daily, calendar, nowMs, clockLabel, clockError, entry, routeArt,
  onStart, onNavigate, onClaim, onWeekly, onRefresh }) {
  const wrap = el('section', 'race-daily'); wrap.id = 'race-daily';
  const definition = daily.definition, race = RACE_CATALOG.find(item => item.id === definition.raceId);
  const header = el('div', 'race-section-heading');
  const heading = el('div'); heading.append(el('span', 'garage-eyebrow', 'DAILY DRIVE / 今天也跑一趟'), el('h3', '', definition.title));
  header.append(heading, el('span', 'daily-date', definition.dayId)); wrap.append(header);
  const hero = el('article', 'daily-challenge-card' + (daily.completed ? ' is-complete' : ''));
  const goal = el('div', 'daily-goal'); goal.append(el('span', 'daily-status', daily.claimed ? '今日獎勵已領取' : daily.completed ? '目標達成 · 待領獎' : '今日挑戰中'),
    el('h3', '', race.name), el('p', '', '在目標時間內通過全部檢查點'), el('strong', 'daily-target-time', recordTime(definition.targetMs)), el('small', '', '目標時間以內有效完賽，不限名次'));
  const art = el('div', 'daily-route'); art.append(routeArt(race.route)); const reward = el('div', 'daily-reward'); reward.append(el('span', '', '今日額外獎金'), el('strong', '', '+$' + definition.reward), el('small', '', '每天一次 · 可用於買車和改裝')); art.append(reward); hero.append(goal, art);
  const metrics = el('div', 'daily-metrics');
  for (const [label,value] of [['今日最佳', daily.best ? recordTime(daily.best.elapsedMs) : '尚未完賽'], ['有效完賽', daily.finishCount + ' 場'], ['目標更新', remaining(definition.endsAt, nowMs)]]) {
    const item = el('div'); item.append(el('span', '', label), el('strong', '', value)); metrics.append(item);
  }
  hero.append(metrics);
  if (daily.best) hero.append(el('p', 'daily-comparison', daily.completed ? '目標已達成。再跑一趟，挑戰今日最佳。' : '距離目標：' + recordDelta(daily.best.elapsedMs - definition.targetMs)));
  const actions = el('div', 'daily-actions');
  if (daily.claimable) actions.append(action('領取今日獎金 +$' + definition.reward, 'primary', onClaim, 'race-daily-claim'));
  const start = action(daily.claimed ? '再戰今日最佳 ↗' : '報名今日挑戰 ↗', daily.claimable ? 'secondary' : 'primary', () => onStart(definition.raceId,definition.dayId), 'race-daily-start');
  start.disabled = !entry?.eligible.ok; start.title = entry?.eligible.message || '使用目前愛車參賽'; actions.append(start,
    action('導航到發車區', 'secondary', () => onNavigate(definition.raceId), 'race-daily-navigate')); hero.append(actions,
    el('p', 'race-eligibility', entry?.eligible.ok ? '停穩的愛車已就緒，報名後倒數 3 秒。' : entry?.eligible.message || '開自己的愛車前往發車區。')); wrap.append(hero);
  const season = el('div', 'daily-season'); const seasonCopy = el('div'); seasonCopy.append(el('span', 'garage-eyebrow', 'WEEKLY SERIES / 每週重新爭先'), el('h3', '', weekRange(calendar.weekId)), el('p', '', '台北時間週一 00:00 換週 · 首次上榜時間決定週次'));
  season.append(seasonCopy, action('挑戰本週排行榜 ↗', 'secondary', onWeekly, 'race-daily-weekly')); wrap.append(season);
  const upcoming = el('div', 'daily-upcoming');
  for (let i = 1; i <= 3; i += 1) {
    const dayId = new Date(Date.parse(definition.dayId + 'T00:00:00Z') + i * RACING_DAY_MS).toISOString().slice(0,10), next = dailyChallenge(dayId);
    const card = el('div'); card.append(el('span', '', i === 1 ? '明日 · ' + shortDay(dayId) : shortDay(dayId)), el('strong', '', RACE_CATALOG.find(item => item.id === next.raceId).name), el('small', '', recordTime(next.targetMs) + ' / +$' + next.reward)); upcoming.append(card);
  }
  wrap.append(el('h3', 'daily-upcoming-title', '接下來的挑戰'), upcoming,
    el('p', 'garage-footnote', '每日 00:00（台北時間）輪換。須於同一天起跑並完賽；暫停跨日不延長期限。達標自動領獎，重賽可刷新紀錄，每日獎金只領一次。'));
  const clock = el('div', 'daily-clock'); clock.append(el('span', '', clockLabel), action('同步賽季時間', 'text-btn', onRefresh, 'race-calendar-refresh')); wrap.append(clock);
  if (clockError) wrap.append(el('p', 'race-board-error', clockError));
  wrap.append(el('p', 'garage-footnote', '每日進度與獎金保存在這台裝置；離線可依裝置時間挑戰，週榜在主動上榜時由伺服器分週。'));
  return wrap;
}
