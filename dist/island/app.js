import { DISTRICTS, TOUR } from './content.js';
import { readProgress, writeProgress } from './progress.js';
import { displayPersona } from '../persona.js';
import { ENCOUNTERS } from './encounters.js';
import { bindWalkControls } from './walk-controls.js';

const $ = (selector) => document.querySelector(selector);
const byId = new Map(DISTRICTS.map(d => [d.id, d]));
const mobile = matchMedia('(max-width: 780px)');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let storage;
try { storage = window.localStorage; } catch { /* Browsing remains available. */ }
let progress = readProgress(storage);
let scene = null;
let activeId = null;
let filter = 'all';
let tourIndex = -1;
let hour = 12;
let paused = reducedMotion.matches;
let topView = false;
let connections = false;
let toastTimer;
let lastFocus;
let storageAvailable = true;
let roaming = false;
let nearby = null;
let walkControls;
const encounterChoices = new Map();
const encounterById = new Map(ENCOUNTERS.map(item => [item.id, item]));

function element(tag, className = '', text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function button(className, text, action) {
  const node = element('button', className, text);
  node.type = 'button';
  node.addEventListener('click', action);
  return node;
}
function toast(text) {
  clearTimeout(toastTimer);
  $('#toast').textContent = text;
  $('#toast').classList.add('show');
  toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 3200);
}
function save() {
  storageAvailable = writeProgress(storage, progress);
  $('#storage-note').textContent = storageAvailable
    ? '足跡保存在這個瀏覽器，不需要登入。'
    : '瀏覽器暫時無法保存足跡；這次散步仍可繼續，關閉後不會保留。';
}
function syncProgress() {
  const count = progress.visited.length;
  $('#passport-count').textContent = count;
  $('#passport-open').setAttribute('aria-label', `小島護照，已踏訪 ${count} 個地點`);
  $('#visited-filter-count').textContent = String(count).padStart(2, '0');
  $('#progress-label').textContent = `${count} / 9`;
  $('#mobile-progress').textContent = `${count} / 9 已踏訪`;
  $('#progress-bar').style.width = `${count / 9 * 100}%`;
  document.querySelectorAll('.map-label').forEach(node => {
    node.classList.toggle('is-visited', progress.visited.includes(node.dataset.district));
    node.setAttribute('aria-pressed', String(node.dataset.district === activeId));
  });
}
const iconPaths = {
  lobby: 'M7 21V5h10v16M3 21h18M10 8h4m-4 4h4m-4 4h4m-2 2v3',
  lab: 'M9 3h6m-5 0v7L5 19q-1 2 2 2h10q3 0 2-2l-5-9V3M8 15h8',
  meeting: 'M4 5h16v11H9l-5 4V5m4 4h8m-8 3h5',
  hr: 'm3 11 9-8 9 8M6 9v12h12V9m-8 12v-6h4v6',
  finance: 'M4 5h16v16H4V5m0 4h16M15 15h.1M9 3h6',
  cafe: 'M5 7h12v8a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5V7m12 1h2a3 3 0 0 1 0 6h-2M8 3v1m4-1v1m4-1v1',
  plaza: 'M4 20h16M6 20V10h12v10M3 10l9-6 9 6H3m6 2v6m6-6v6',
  court: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18m0 0v18M3 12h18M6 5q10 7 0 14M18 5q-10 7 0 14',
  harbor: 'M12 3v12M8 6h8M5 13v3q7 10 14 0v-3M3 21q3-2 6 0t6 0 6 0',
};
function districtIcon(d) {
  const wrap = element('span', 'district-swatch');
  wrap.style.setProperty('--tile', `${d.color}35`);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(svg.namespaceURI, 'path');
  path.setAttribute('d', iconPaths[d.id]);
  path.setAttribute('fill', 'none'); path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '1.3'); path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round'); svg.append(path); wrap.append(svg);
  return wrap;
}
function renderList() {
  const query = $('#search').value.trim().toLocaleLowerCase();
  const list = $('#district-list');
  list.replaceChildren();
  const matches = DISTRICTS.filter(d => {
    if (filter === 'visited' && !progress.visited.includes(d.id)) return false;
    const text = [d.name, d.summary, ...d.tags, ...d.people.map(id => {
      const p = displayPersona(id); return `${p.name} ${p.title}`;
    })].join(' ').toLocaleLowerCase();
    return !query || text.includes(query);
  });
  for (const d of matches) {
    const visited = progress.visited.includes(d.id);
    const card = button(`district-card${visited ? ' is-visited' : ''}`, '', () => selectDistrict(d.id));
    card.dataset.districtLink = d.id;
    card.setAttribute('aria-label', `${d.number} ${d.name}${visited ? '，已踏訪' : ''}`);
    const info = element('span', 'district-info');
    info.append(element('span', 'district-name', d.name), element('span', 'district-meta', `${d.tags[0]} · ${displayPersona(d.people[0]).name}`));
    card.append(element('span', 'district-number', d.number), districtIcon(d), info, element('span', 'district-arrow', visited ? '✓' : '↗'));
    list.append(card);
  }
  $('#empty-search').hidden = matches.length !== 0;
}
function setSidebar(open) {
  if (mobile.matches) {
    document.body.classList.toggle('mobile-sheet-open', open);
    document.body.classList.remove('sidebar-collapsed');
  } else {
    document.body.classList.toggle('sidebar-collapsed', !open);
  }
  $('#list-toggle').setAttribute('aria-expanded', String(open));
  $('#list-toggle').setAttribute('aria-label', open ? '收合地點清單' : '開啟地點清單');
  $('#mobile-explore').setAttribute('aria-expanded', String(open));
  updateWalking();
}
function canWalk() {
  const sidebarOpen = mobile.matches ? document.body.classList.contains('mobile-sheet-open') : !document.body.classList.contains('sidebar-collapsed');
  return roaming && !sidebarOpen && !document.querySelector('dialog[open]');
}
function updateWalking() {
  walkControls?.clear();
  scene?.setMovementEnabled(canWalk());
  document.body.classList.toggle('walking-blocked', roaming && !canWalk());
  $('#walk-hint').textContent = mobile.matches ? '按住左下方向鍵移動 · 靠近後點「聊聊」' : 'W A S D／方向鍵移動 · 靠近後按 E 或空白鍵';
}
function syncRoaming(value) {
  roaming = value;
  document.body.classList.toggle('roaming', value);
  $('#walk-hud').hidden = !value;
  $('#roam-toggle').setAttribute('aria-pressed', String(value));
  $('#roam-toggle').textContent = value ? '↗ 看全島' : '♟ 開始散步';
  updateNearby(value ? nearby : null);
  updateWalking();
}
function setRoaming(value) {
  if (!scene) return;
  stopTour();
  if (value) { browse({ reset: false }); setSidebar(false); }
  scene.setRoaming(value);
  syncRoaming(value);
  topView = false; $('#top-toggle').setAttribute('aria-pressed', 'false');
  if (!value) { browse(); setSidebar(!mobile.matches); }
  else $('#scene canvas')?.focus({ preventScroll: true });
}
function updateNearby(target) {
  nearby = target;
  $('#nearby-prompt').hidden = !target || !roaming;
  if (!target) return;
  const district = byId.get(target.districtId);
  if (target.kind === 'person') {
    const encounter = encounterById.get(target.id);
    $('#nearby-name').textContent = displayPersona(target.id).name;
    $('#nearby-greeting').textContent = encounter?.greeting || '一起聊聊島上的日常。';
    $('#interact-label').textContent = '聊聊';
  } else {
    $('#nearby-name').textContent = district.name;
    $('#nearby-greeting').textContent = '已經走到門口了，進來聽一段日常。';
    $('#interact-label').textContent = '探索';
  }
}
function renderEncounter(target) {
  const district = byId.get(target.districtId);
  const isPerson = target.kind === 'person';
  const story = isPerson ? encounterById.get(target.id) : district.story;
  const content = $('#encounter-content'); content.replaceChildren();
  $('#encounter-place').textContent = `${district.number} / ${district.name} · ${isPerson ? '島上偶遇' : '門口的日常'}`;
  if (isPerson) {
    const speaker = element('div', 'encounter-speaker');
    const portrait = element('img'); portrait.src = `/assets/${target.id}.png`; portrait.alt = '';
    speaker.append(portrait, element('strong', '', displayPersona(target.id).name)); content.append(speaker);
  }
  const title = element('h2', '', story.title); title.id = 'encounter-title';
  content.append(title, element('p', 'encounter-opening', story.opening));
  const selected = isPerson ? encounterChoices.get(target.id) : progress.choices[district.id];
  if (Number.isInteger(selected)) {
    const result = element('div', 'story-response'); result.id = 'encounter-response'; result.tabIndex = -1;
    result.append(element('b', '', `你說：${story.choices[selected].label}`), element('p', '', story.choices[selected].response));
    content.append(result);
    $('#encounter-leave').textContent = '把這段日常收好，繼續散步 →';
  } else {
    const choices = element('div', 'story-choices');
    story.choices.forEach((choice, index) => {
      const option = button('', '', () => {
        if (isPerson) encounterChoices.set(target.id, index);
        else { progress.choices[district.id] = index; save(); }
        $('#encounter-count').textContent = `本次散步 · ${encounterChoices.size} / 9 段偶遇`;
        renderEncounter(target);
        $('#encounter-response').focus({ preventScroll: true });
        $('#encounter-response').scrollIntoView({ block: 'nearest' });
      });
      option.dataset.encounterChoice = index;
      option.append(element('span', '', `0${index + 1}`), document.createTextNode(choice.label)); choices.append(option);
    });
    content.append(choices);
    $('#encounter-leave').textContent = '先聊到這裡，繼續走走 →';
  }
}
function interactNearby() {
  if (!canWalk()) return;
  const target = scene?.interactNearby();
  if (!target) return;
  if (target.kind === 'person' && !encounterById.has(target.id)) return;
  if (!progress.visited.includes(target.districtId)) { progress.visited.push(target.districtId); save(); syncProgress(); }
  renderEncounter(target); openDialog($('#encounter-dialog'));
}
function browse({ reset = true } = {}) {
  activeId = null;
  $('#browse-panel').hidden = false;
  $('#detail-panel').hidden = true;
  document.body.classList.remove('exploring');
  history.replaceState(null, '', location.pathname + location.search);
  if (reset) { scene?.reset(); topView = false; $('#top-toggle').setAttribute('aria-pressed', 'false'); }
  renderList(); syncProgress();
  $('#island-sidebar').scrollTop = 0;
}
function openList() {
  if (roaming) setRoaming(false);
  stopTour(); browse(); setSidebar(true);
  $('#district-list').focus({ preventScroll: true });
}
function renderDetail(d) {
  const detail = $('#detail-panel');
  detail.replaceChildren();
  const back = button('detail-back', '← 回到地點清單', () => { stopTour(); browse(); $('#search').focus({ preventScroll: true }); });
  const hero = element('div', 'detail-hero');
  hero.dataset.number = d.number;
  hero.style.setProperty('--district-tint', `${d.color}35`);
  const title = element('h2', '', d.name); title.id = 'detail-title'; title.tabIndex = -1;
  const tags = element('div', 'detail-tags'); d.tags.forEach(t => tags.append(element('span', '', t)));
  hero.append(element('span', 'eyebrow', `${d.number} / ${d.kicker}`), title, tags);
  const people = element('div', 'people-list');
  for (const id of d.people) {
    const persona = displayPersona(id);
    const chip = element('span', 'person-chip'); chip.title = persona.title;
    const portrait = element('img'); portrait.src = `/assets/${id}.png`; portrait.alt = ''; portrait.loading = 'lazy';
    chip.append(portrait, element('span', '', persona.name)); people.append(chip);
  }
  const story = element('section', 'story-card');
  story.append(element('span', 'eyebrow', 'A LITTLE ISLAND STORY'), element('h3', '', d.story.title), element('p', 'story-opening', d.story.opening));
  const choice = progress.choices[d.id];
  if (Number.isInteger(choice)) {
    const response = element('div', 'story-response'); response.tabIndex = -1; response.id = 'story-response';
    response.append(element('b', '', `你說：${d.story.choices[choice].label}`), element('p', '', d.story.choices[choice].response), element('small', '', '這段日常，已經成為你的島上回憶。'));
    story.append(response, button('story-again', '再試另一種回話', () => {
      delete progress.choices[d.id]; save(); renderDetail(d);
      $('#detail-panel .story-choices button').focus({ preventScroll: true });
    }));
  } else {
    const choices = element('div', 'story-choices');
    d.story.choices.forEach((c, index) => {
      const option = button('', '', () => {
        progress.choices[d.id] = index; save(); renderDetail(d);
        const result = $('#story-response');
        result.focus({ preventScroll: true }); result.scrollIntoView({ block: 'nearest', behavior: reducedMotion.matches ? 'instant' : 'smooth' });
      });
      option.dataset.choice = index;
      option.append(element('span', '', `0${index + 1}`), document.createTextNode(c.label));
      choices.append(option);
    });
    story.append(choices);
  }
  const related = element('div', 'related-list');
  d.related.forEach(id => related.append(button('', `${byId.get(id).name} ↗`, () => selectDistrict(id))));
  detail.append(back, hero, element('p', 'detail-summary', d.summary), element('h3', 'people-title', '在這裡可能遇見'), people, story, element('h3', 'related-title', '順路，再去看看'), related, element('p', 'detail-stamp', `✓ ${d.number} 號島章已蓋進小島護照`));
}
function selectDistrict(id, { touring = false, moveFocus = true } = {}) {
  const d = byId.get(id); if (!d) return;
  if (roaming) setRoaming(false);
  if (!touring) stopTour();
  activeId = id;
  const firstVisit = !progress.visited.includes(id);
  if (firstVisit) { progress.visited.push(id); save(); }
  $('#browse-panel').hidden = true; $('#detail-panel').hidden = false;
  document.body.classList.add('exploring');
  renderDetail(d); syncProgress();
  scene?.focus(id);
  $('#island-sidebar').scrollTop = 0;
  if (!touring || !mobile.matches) setSidebar(true);
  history.replaceState(null, '', `#${id}`);
  if (firstVisit) toast(progress.visited.length === 9 ? '九個島章集齊了。今日宜，準時下班！' : `已抵達 ${d.name} · 收下一枚島章`);
  if (moveFocus && !touring) $('#detail-title').focus({ preventScroll: true });
}
function wander() {
  const remaining = DISTRICTS.filter(d => !progress.visited.includes(d.id));
  const candidates = remaining.length ? remaining : DISTRICTS.filter(d => d.id !== activeId);
  const d = candidates[Math.floor(Math.random() * candidates.length)];
  selectDistrict(d.id);
}
function setHour(value) {
  hour = Math.min(23, Math.max(6, Number(value) || 12));
  const h = Math.floor(hour), m = Math.round((hour % 1) * 60);
  $('#time-output').textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  $('#time-range').value = hour;
  const night = hour >= 19;
  const evening = hour >= 17 && !night;
  const morning = hour < 10;
  const icon = night ? '☾' : evening ? '◒' : '☀';
  $('#time-icon').textContent = icon; $('#weather-icon').textContent = icon;
  $('#time-name').textContent = night ? '晚安小島' : evening ? '收工時分' : morning ? '早安小島' : '午間小島';
  $('#weather-label').textContent = night ? '月亮已經打卡下班' : evening ? '夕陽準時，會議不一定' : '晴時偶有會議';
  document.body.classList.toggle('night', night);
  scene?.setHour(hour);
}
function showTour(index) {
  if (roaming) setRoaming(false);
  tourIndex = index;
  const stop = TOUR[index];
  document.body.classList.add('touring');
  if (mobile.matches) setSidebar(false);
  $('#tour-card').hidden = false;
  const [h, m] = stop.hour.split(':').map(Number); setHour(h + m / 60);
  $('#tour-time').textContent = stop.hour; $('#tour-title').textContent = stop.label;
  $('#tour-note').textContent = stop.note;
  $('#tour-next').textContent = index === TOUR.length - 1 ? '走完了，去看海 ✓' : '下一站 →';
  $('#tour-dots').replaceChildren(...TOUR.map((_, i) => element('span', `tour-dot${i === index ? ' active' : ''}`)));
  $('#tour-dots').setAttribute('aria-label', `第 ${index + 1} 站，共 ${TOUR.length} 站`);
  selectDistrict(stop.districtId, { touring: true, moveFocus: false });
}
function stopTour() { tourIndex = -1; $('#tour-card').hidden = true; document.body.classList.remove('touring'); }
function renderPassport() {
  const grid = $('#passport-grid'); grid.replaceChildren();
  for (const d of DISTRICTS) {
    const visited = progress.visited.includes(d.id);
    const stamp = button(`passport-stamp${visited ? ' visited' : ''}`, '', () => { closeDialog($('#passport-dialog')); selectDistrict(d.id); });
    stamp.setAttribute('aria-label', `${d.name}，${visited ? '已踏訪' : '尚未踏訪'}，前往探索`);
    stamp.append(element('strong', '', d.number), element('span', '', d.name), element('small', '', visited ? 'HEDO · 已踏訪' : '等待你的足跡'));
    grid.append(stamp);
  }
  const memories = Object.keys(progress.choices).length;
  $('#passport-message').textContent = progress.visited.length === 9
    ? `九座小島都留下了你的足跡，也收下 ${memories} 段日常。今天的行程完成，剩下的時間是你的。`
    : `已踏訪 ${progress.visited.length} / 9 個地點，收下 ${memories} 段日常。還有 ${9 - progress.visited.length} 個地方等你慢慢發現。`;
}
function openDialog(dialog) { lastFocus = document.activeElement; dialog.showModal(); updateWalking(); }
function restoreDialogFocus() {
  if (roaming) $('#scene canvas')?.focus({ preventScroll: true });
  else if (lastFocus?.isConnected) lastFocus.focus({ preventScroll: true });
}
function closeDialog(dialog) { dialog.close(); updateWalking(); restoreDialogFocus(); }

walkControls = bindWalkControls({ pad: $('#walk-pad'), canMove: canWalk, onMove: input => scene?.setMoveInput(input), onInteract: interactNearby, onHome: () => setRoaming(false) });
$('#roam-toggle').addEventListener('click', () => setRoaming(!roaming));
$('#interact-button').addEventListener('click', interactNearby);
$('#encounter-leave').addEventListener('click', () => closeDialog($('#encounter-dialog')));

$('#search').addEventListener('input', renderList);
for (const name of ['all', 'visited']) $('#filter-' + name).addEventListener('click', () => {
  filter = name;
  $('#filter-all').setAttribute('aria-pressed', String(name === 'all'));
  $('#filter-visited').setAttribute('aria-pressed', String(name === 'visited')); renderList();
});
$('#list-toggle').addEventListener('click', () => {
  const open = mobile.matches ? document.body.classList.contains('mobile-sheet-open') : !document.body.classList.contains('sidebar-collapsed');
  stopTour(); setSidebar(!open);
});
$('#sidebar-close').addEventListener('click', () => { setSidebar(false); $('#mobile-explore').focus({ preventScroll: true }); });
$('#mobile-explore').addEventListener('click', () => { stopTour(); setSidebar(true); });
$('#fallback-list').addEventListener('click', openList);
$('.skip-link').addEventListener('click', event => { event.preventDefault(); openList(); });
$('#explore-start').addEventListener('click', () => setRoaming(true));
$('#zoom-in').addEventListener('click', () => scene?.zoom(1));
$('#zoom-out').addEventListener('click', () => scene?.zoom(-1));
$('#map-reset').addEventListener('click', () => { if (roaming) setRoaming(false); else { stopTour(); browse(); if (mobile.matches) setSidebar(false); } });
$('#connections-toggle').addEventListener('click', () => { connections = !connections; scene?.setConnections(connections); $('#connections-toggle').setAttribute('aria-pressed', String(connections)); });
$('#top-toggle').addEventListener('click', () => { topView = !topView; scene?.setTopView(topView); $('#top-toggle').setAttribute('aria-pressed', String(topView)); });
function updatePause() { scene?.setPaused(paused); $('#pause-toggle').setAttribute('aria-pressed', String(paused)); $('#pause-label').textContent = paused ? '播放' : '暫停'; }
$('#pause-toggle').addEventListener('click', () => { paused = !paused; updatePause(); });
$('#time-range').addEventListener('input', event => { stopTour(); setHour(event.target.value); });
$('#tour-start').addEventListener('click', () => showTour(0));
$('#tour-next').addEventListener('click', () => {
  if (tourIndex < TOUR.length - 1) showTour(tourIndex + 1);
  else { stopTour(); setSidebar(true); $('#detail-title')?.focus({ preventScroll: true }); toast('散步完成。今天剩下的時間，留給自己。'); }
});
$('#tour-close').addEventListener('click', () => { stopTour(); if (mobile.matches) setSidebar(false); $('#tour-start').focus({ preventScroll: true }); });
$('#passport-open').addEventListener('click', () => { renderPassport(); openDialog($('#passport-dialog')); });
$('#passport-explore').addEventListener('click', () => { closeDialog($('#passport-dialog')); wander(); });
$('#help-open').addEventListener('click', () => openDialog($('#help-dialog')));
$('#help-sidebar').addEventListener('click', () => openDialog($('#help-dialog')));
document.querySelectorAll('[data-close-dialog]').forEach(node => node.addEventListener('click', () => closeDialog(node.closest('dialog'))));
document.querySelectorAll('dialog').forEach(dialog => {
  dialog.addEventListener('close', () => {
    updateWalking();
    // Native Escape can need restoration; explicit navigation after close owns
    // its new focus and must not be overridden by this queued close event.
    if (document.activeElement === document.body || dialog.contains(document.activeElement)) restoreDialogFocus();
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog(dialog);
  });
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !document.querySelector('dialog[open]')) {
    if (tourIndex >= 0) stopTour();
    else if (mobile.matches) setSidebar(false);
    else if (activeId) browse();
  }
});
mobile.addEventListener('change', () => { document.body.classList.remove('mobile-sheet-open', 'sidebar-collapsed'); setSidebar(!mobile.matches && !roaming); });
window.addEventListener('hashchange', () => { const id = location.hash.slice(1); if (byId.has(id)) selectDistrict(id); else browse(); });
window.addEventListener('pagehide', () => { walkControls.destroy(); scene?.destroy(); }, { once: true });
// A bfcache restoration needs a fresh renderer after pagehide teardown.
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });

renderList(); syncProgress(); updatePause(); setSidebar(!mobile.matches);
// Test storage availability without touching the career game's keys.
save();
const initialId = location.hash.slice(1);
if (byId.has(initialId)) selectDistrict(initialId, { moveFocus: false });
try {
  const { createIslandScene } = await import('./scene.js');
  scene = await createIslandScene({ container: $('#scene'), districts: DISTRICTS, onSelect: id => roaming ? interactNearby() : selectDistrict(id), onNearby: updateNearby, onRoamChange: syncRoaming });
  $('#loading').hidden = true;
  $('#roam-toggle').disabled = false;
  setHour(hour); updatePause(); scene.setConnections(connections); scene.setTopView(topView);
  if (activeId) scene.focus(activeId);
  syncProgress();
  $('#scene').addEventListener('webglcontextlost', () => {
    syncRoaming(false); $('#roam-toggle').disabled = true; $('#explore-start').disabled = true;
    $('#map-fallback').hidden = false;
    toast('地圖暫時休息中，仍可從清單探索。');
  }, true);
} catch (error) {
  $('#loading').hidden = true; $('#map-fallback').hidden = false;
  $('#roam-toggle').disabled = true; $('#explore-start').disabled = true;
  document.querySelectorAll('.map-controls button,.zoom-controls button').forEach(node => { node.disabled = true; });
  console.warn('Island map unavailable:', error instanceof Error ? error.message : 'renderer initialization failed');
}
