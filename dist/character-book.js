import { PERSONAS } from './persona.js';
import { CHARACTER_IDS, CHARACTER_METRICS, deriveCharacterStats, characterAffinity } from './character-stats.js';

const PUBLIC_CACHE = 'hedo-character-public-v1';
const escapeHTML = (value = '') => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const number = value => Number.isSafeInteger(value) && value >= 0 ? value.toLocaleString('zh-TW') : '—';
const METRIC_LABELS = { encounters: '完成互動', imaginedHits: '幻想扁人', realHits: '真的被扁', affinityGained: '好感增加點數', affinityLost: '好感減少點數', affinityUpEvents: '好感增加次數', affinityDownEvents: '好感減少次數' };
const ORIGINAL_CHARACTER_IDS = ['wing','spencer','erich','sonny','jenjen','rick','kind','hope','jack','meimei'];
const rowsById = rows => new Map((Array.isArray(rows) ? rows : []).filter(row =>
  row && CHARACTER_IDS.includes(row.id) && CHARACTER_METRICS.every(key => Number.isSafeInteger(row[key]) && row[key] >= 0)
).map(row => [row.id, row]));
function supportedCharacterSnapshot(rows) {
  if (!Array.isArray(rows)) return false;
  const known = rowsById(rows);
  // Keep verified ten- and eleven-person snapshots as they were. Every new
  // character stays unknown until supplied; malformed supplied rows are errors.
  if (rows.some(row => CHARACTER_IDS.includes(row?.id) && !CHARACTER_METRICS.every(key => Number.isSafeInteger(row[key]) && row[key] >= 0))) return false;
  return ORIGINAL_CHARACTER_IDS.every(id => known.has(id));
}
const dateLabel = value => Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('zh-TW', { hour12: false }) : '';
const countCell = (row, key) => row ? `${number(row[key])}<small>次</small>` : '—';
function affinityCell(row, positive) {
  if (!row) return '—';
  return `${number(row[positive ? 'affinityUpEvents' : 'affinityDownEvents'])}<small>次</small><span class="character-points">${positive ? '+' : '−'}${number(row[positive ? 'affinityGained' : 'affinityLost'])} 點</span>`;
}

// This renderer never combines local previews with verified server totals.
// Missing data remains a dash; only a real zero from a valid row becomes 0.
export function characterBookHTML({ personal = null, global = null, currentRun = null, status = 'local', pending = 0, personalAt = '', publicAt = '', loading = false, error = '', filter = 'all', metric = 'realHits', rankingOpen = false } = {}) {
  const mine = rowsById(personal), all = rowsById(global?.characters), preview = currentRun ? rowsById(deriveCharacterStats(currentRun)) : new Map();
  const selectedMetric = Object.hasOwn(METRIC_LABELS, metric) ? metric : 'realHits';
  const ids = CHARACTER_IDS.filter(id => filter === 'all' || id === filter);
  const ranking = [...CHARACTER_IDS].sort((left, right) => (all.get(right)?.[selectedMetric] || 0) - (all.get(left)?.[selectedMetric] || 0));
  const largest = Math.max(1, ...ranking.map(id => all.get(id)?.[selectedMetric] || 0));
  const personalKnown = mine.size > 0, publicKnown = all.size > 0;
  const networkLabel = status === 'online' ? '已驗證雲端紀錄' : personalKnown ? '離線・顯示上次已驗證紀錄' : '尚未取得個人雲端紀錄';
  const empty = publicKnown && [...all.values()].every(row => row.encounters === 0);
  return `<section class="character-book" data-character-book><div class="character-book-heading"><div><span class="eyebrow">THE CAST, AND OUR BAD IDEAS.</span><h2 id="dialog-title">角色圖鑑。</h2><p class="dialog-lead">這次跟誰結下樑子，又跟誰處得來？</p></div><span class="character-count">${CHARACTER_IDS.length}<small>位遊戲角色</small></span></div>
    <div class="character-sync-state" aria-live="polite"><span class="character-sync-dot ${status === 'online' ? 'online' : ''}" aria-hidden="true"></span><div><b>${networkLabel}</b>${pending ? `<p>有 ${number(pending)} 筆紀錄等待同步。</p>` : ''}</div><button type="button" class="text-button" data-character-retry ${loading ? 'disabled' : ''}>${loading ? '更新中…' : '更新資料 ↻'}</button></div>
    ${loading ? '<p class="character-loading" role="status">正在取得角色互動紀錄…</p>' : ''}${error ? `<p class="character-error" role="status">${escapeHTML(error)} <button type="button" data-character-retry ${loading ? 'disabled' : ''}>重新連線 ↻</button></p>` : ''}
    ${!personalKnown && !loading ? '<p class="character-empty">還沒取得個人累計，這局預覽仍保留。</p>' : ''}
    <div class="character-book-controls"><label for="character-filter">想看誰<select id="character-filter" data-character-filter><option value="all" ${filter === 'all' ? 'selected' : ''}>全部角色</option>${CHARACTER_IDS.map(id => `<option value="${id}" ${filter === id ? 'selected' : ''}>${escapeHTML(PERSONAS[id].name)}</option>`).join('')}</select></label><label for="character-metric">全站排行<select id="character-metric" data-character-metric>${CHARACTER_METRICS.map(key => `<option value="${key}" ${selectedMetric === key ? 'selected' : ''}>${METRIC_LABELS[key]}</option>`).join('')}</select></label></div>
    <div class="character-card-grid">${ids.map(id => {
      const person = PERSONAS[id], own = mine.get(id), total = all.get(id), local = preview.get(id), affinity = currentRun ? characterAffinity(currentRun, id) : null;
      return `<article class="character-card" id="character-card-${id}" tabindex="-1" aria-labelledby="character-title-${id}"><div class="character-card-top"><img src="${person.image}" alt="${escapeHTML(person.name)}原創動畫角色" loading="lazy"><div><span>${escapeHTML(person.title)}</span><h3 id="character-title-${id}">${escapeHTML(person.name)}</h3><p>遊戲角色 / ${String(CHARACTER_IDS.indexOf(id) + 1).padStart(2, '0')}</p></div></div>${person.about ? `<p class="character-bio">${escapeHTML(person.about)}</p>` : ''}<table class="character-comparison"><caption class="sr-only">${escapeHTML(person.name)}：你的累計與全體玩家累計</caption><thead><tr><th scope="col">已完成的互動</th><th scope="col">你的累計</th><th scope="col">全體累計</th></tr></thead><tbody><tr><th scope="row">完成互動</th><td>${countCell(own, 'encounters')}</td><td>${countCell(total, 'encounters')}</td></tr><tr><th scope="row">幻想扁人</th><td>${countCell(own, 'imaginedHits')}</td><td>${countCell(total, 'imaginedHits')}</td></tr><tr><th scope="row">真的被扁</th><td>${countCell(own, 'realHits')}</td><td>${countCell(total, 'realHits')}</td></tr><tr><th scope="row">好感增加</th><td>${affinityCell(own, true)}</td><td>${affinityCell(total, true)}</td></tr><tr><th scope="row">好感減少</th><td>${affinityCell(own, false)}</td><td>${affinityCell(total, false)}</td></tr></tbody></table><details class="character-local-preview"><summary>這局預覽${affinity ? `<span>好感 ${number(affinity.score)} / 100</span>` : '<span>尚未開始</span>'}</summary>${local && affinity ? `<p>本局從 ${number(affinity.start)} 開始。只累積已發生的互動，不預告下一個選項。</p><div class="character-affinity-track" role="meter" aria-label="${escapeHTML(person.name)}本局好感" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${affinity.score}"><i style="width:${affinity.score}%"></i></div><dl>${CHARACTER_METRICS.map(key => `<div><dt>${METRIC_LABELS[key]}</dt><dd>${number(local[key])}${['affinityGained', 'affinityLost'].includes(key) ? ' 點' : ' 次'}</dd></div>`).join('')}</dl>` : '<p>開始一段人生，選完互動後，這裡就會留下這局的預覽。</p>'}</details></article>`;
    }).join('')}</div><details class="character-ranking-details" id="character-ranking-details" ${rankingOpen ? 'open' : ''}><summary>全站互動排行 <span>${METRIC_LABELS[selectedMetric]} ↘</span></summary><section class="character-ranking" aria-labelledby="character-ranking-title"><div class="character-section-heading"><h3 id="character-ranking-title">${METRIC_LABELS[selectedMetric]}排行</h3><span>全體玩家・已驗證累計</span></div>${!publicKnown ? '<p class="character-empty">全站數字還沒取得，先不替角色編戰績。</p>' : `<ol>${ranking.map((id, index) => { const row = all.get(id), value = row?.[selectedMetric]; return `<li><button type="button" data-character-focus="${id}" aria-label="查看${escapeHTML(PERSONAS[id].name)}的互動紀錄"><small>${String(index + 1).padStart(2, '0')}</small><span>${escapeHTML(PERSONAS[id].name)}</span></button><span class="character-rank-track" aria-hidden="true"><i style="width:${row ? value / largest * 100 : 0}%"></i></span><b>${number(value)}<small>${['affinityGained', 'affinityLost'].includes(selectedMetric) ? '點' : '次'}</small></b></li>`; }).join('')}</ol>`}</section></details><details class="character-book-help"><summary>統計怎麼記？</summary><div class="character-data-notice"><b>這是遊戲角色統計，不是真人評價。</b><p>全站角色統計從上線後開始；舊版沒有逐步互動紀錄，不推算。好感由已選完的互動結果換算，與翅膀心情分開；目前不影響升遷或事件機率。</p></div><p class="character-preview-note">「你的累計」和「全體累計」只顯示已驗證數字。「這局預覽」另外列出，可能已包含在累計裡，兩者不相加。惡言相向會記互動與好感，不計為扁人；幻想扁人與真的動手也分開計算，同一個結果只記一次。</p>${empty ? '<p class="character-empty">全站還沒有完成的角色互動。下一次選擇，可能就是第一筆。</p>' : ''}<p class="character-cache-dates">${personalAt ? `個人紀錄更新：${escapeHTML(dateLabel(personalAt))}。` : ''}${publicAt ? ` 全站資料取得：${escapeHTML(dateLabel(publicAt))}。` : ''}</p>${global?.trackingSince ? `<p class="character-tracking-since">全站開始記錄：${escapeHTML(dateLabel(global.trackingSince))}。只收遊戲中的已完成互動。</p>` : ''}</details></section>`;
}

export function createCharacterBook({ dialog, openDialog, cloud, getRun = () => null, storage = globalThis.localStorage } = {}) {
  let publicData = null, publicAt = '', snapshot = cloud.state || {}, filter = 'all', metric = 'realHits', loading = false, error = '', activeRequest = 0, rankingOpen = false;
  try { const cached = JSON.parse(storage?.getItem(PUBLIC_CACHE) || 'null');if (cached?.version === 1 && supportedCharacterSnapshot(cached.characters)) { publicData = cached;publicAt = cached.fetchedAt || ''; } } catch { /* An unavailable cache does not create fake totals. */ }
  const visible = () => dialog.open && Boolean(dialog.querySelector('[data-character-book]'));
  function render({ focus = false, focusId = '' } = {}) {
    if (!focus && !visible()) return;
    const scroll = dialog.scrollTop || 0;
    openDialog(characterBookHTML({ personal: snapshot.characters, global: publicData, currentRun: getRun(), status: snapshot.status, pending: snapshot.pending, personalAt: snapshot.charactersVerifiedAt || snapshot.charactersCachedAt || '', publicAt, loading, error, filter, metric, rankingOpen }));
    if (!focus) { dialog.scrollTop = scroll;if (focusId) dialog.querySelector(`#${focusId}`)?.focus({ preventScroll: true }); }
  }
  async function refresh({ focus = false } = {}) {
    const request = ++activeRequest;loading = true;error = '';render({ focus });
    let personal, global;
    try { personal = { status: 'fulfilled', value: await cloud.init() }; } catch { personal = { status: 'rejected' }; }
    if (request !== activeRequest) return;
    // Read public totals only after pending personal proofs have been flushed.
    // Otherwise a just-verified personal interaction can precede its public count.
    try { global = { status: 'fulfilled', value: await cloud.characters() }; } catch { global = { status: 'rejected' }; }
    if (request !== activeRequest) return;
    snapshot = cloud.state || snapshot;
    const errors = [];
    if (personal.status === 'rejected' || !personal.value) errors.push(rowsById(snapshot.characters).size ? '個人紀錄暫時無法更新，保留上次已驗證資料。' : '個人紀錄暫時連不上。');
    if (global.status === 'fulfilled' && global.value?.version === 1 && supportedCharacterSnapshot(global.value.characters)) {
      publicAt = new Date().toISOString();publicData = { ...global.value, fetchedAt: publicAt };
      try { storage?.setItem(PUBLIC_CACHE, JSON.stringify(publicData)); } catch { /* The current response remains usable without a cache. */ }
    } else errors.push(publicData ? '全站紀錄暫時無法更新，顯示上次取得的數字。' : '全站紀錄暫時連不上，尚未取得的數字以 — 顯示。');
    error = errors.join(' ');loading = false;render();
  }
  dialog.addEventListener('change', event => {
    if (!visible()) return;
    if (event.target.id === 'character-filter') { filter = CHARACTER_IDS.includes(event.target.value) ? event.target.value : 'all';render({ focusId: 'character-filter' }); }
    if (event.target.id === 'character-metric') { metric = CHARACTER_METRICS.includes(event.target.value) ? event.target.value : 'realHits';rankingOpen = true;render({ focusId: 'character-metric' });const ranking = dialog.querySelector('#character-ranking-details');if (ranking) { ranking.open = true;ranking.scrollIntoView({ block: 'start', behavior: 'smooth' }); } }
  });
  dialog.addEventListener('toggle', event => { if (event.target.id === 'character-ranking-details') rankingOpen = event.target.open; }, true);
  dialog.addEventListener('click', event => {
    if (!visible()) return;
    if (event.target.closest('[data-character-retry]') && !loading) void refresh();
    const id = event.target.closest('[data-character-focus]')?.dataset.characterFocus;
    if (CHARACTER_IDS.includes(id)) { filter = id;render();const card = dialog.querySelector(`#character-card-${id}`);card?.scrollIntoView({ block: 'start', behavior: 'smooth' });card?.focus({ preventScroll: true }); }
  });
  return {
    open(id = 'all') { filter = CHARACTER_IDS.includes(id) ? id : 'all';rankingOpen = false;return refresh({ focus: true }); },
    onSnapshot(value) { snapshot = value || cloud.state || snapshot;render(); },
    onRunChanged() { render(); },
  };
}
