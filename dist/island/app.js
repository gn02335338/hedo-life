import { DISTRICTS, TOUR } from './content.js';
import { readProgress, writeProgress } from './progress.js';
import { displayIslandPersona } from './persona.js';
import { ENCOUNTERS } from './encounters.js';
import { bindWalkControls } from './walk-controls.js';
import { bindApplications, residentAvatar } from './applications.js';
import { ISLAND_CAST } from './cast.js';
import { createIslandAdminSummary } from './admin-summary.js';
import { PLACES, PLACE_BY_ID } from './places.js';
import { getPersonRoutine, getIslandRoutine, MYSTERY_TRIP } from './routines.js';
import { createIslandConflicts } from './conflicts.js';
import { createIslandChallenge } from './challenge.js';
import { REGIONS, DOCKS, getRegionForDistrict } from './archipelago.js';

const $ = (selector) => document.querySelector(selector);
const byId = new Map(DISTRICTS.map(d => [d.id, d]));
const placesByDistrict = new Map(DISTRICTS.map(d => [d.id, PLACES.filter(place => place.districtId === d.id)]));
const categoryNames = { department: '部門園區', shared: '共享空間', afterwork: '下班生活', special: '島上另一面' };
const conflicts = createIslandConflicts();
let conflictState = conflicts.getState();
const dispositionNames = { free: '自由散步', hospital: '醫院留觀', police: '警局做筆錄', exile: '流放冷凍中' };
const dispositionOf = id => conflictState.people.find(person => person.id === id);
const personaImage = id => displayPersona(id).image.replace(/^\.\//, '/');
const mobile = matchMedia('(max-width: 780px)');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let storage;
try { storage = window.localStorage; } catch { /* Browsing remains available. */ }
let progress = readProgress(storage);
const challenge = createIslandChallenge({ storage });
const displayPersona = id => displayIslandPersona(id, { revealHidden: !!challenge.getState().hidden });
let currentRegion = 'company';
let pendingTravel = null;
let activeVoyage = null;
let sceneReady = false;
let pageGone = false;
let scene = null;
let activeId = null;
let filter = 'all';
let zoneFilter = 'all';
let focusedPlaceId = null;
let tourIndex = -1;
let hour = 10;
let clockRunning = !reducedMotion.matches;
let lastRoutinePhase = null;
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
const routineChoices = new Map();
// Revised stories never reinterpret a response index saved for the old map.
// Keep the original v1 record intact; new memories belong to this visit.
const districtChoices = new Map();
const placeChoices = new Map();
const placeVisits = new Set();
const residentChoices = new Map();
let residentById = new Map();
let activeEncounter = null;
let activeBrawl = null;
let activePvp = null;
let lifeActors = new Map();
let lifeAvailable = false;
let sceneUnavailable = false;
const encounterById = new Map(ENCOUNTERS.map(item => [item.id, item]));

function currentDistrict(id) {
  if (id === 'hidden-visitor') return DOCKS[currentRegion].districtId;
  const actor = lifeAvailable ? lifeActors.get(`person:${id}`) : null;
  if (actor?.districtId) return actor.districtId;
  const disposition = dispositionOf(id);
  if (disposition) return disposition.districtId;
  return (lifeAvailable ? lifeActors.get(`person:${id}`)?.districtId || getPersonRoutine(id, hour)?.districtId
    : getPersonRoutine(id, hour)?.districtId) || 'lobby';
}
function peopleInDistrict(id) { return ISLAND_CAST.filter(person => currentDistrict(person.id) === id); }
function personLocation(id) {
  const actor = lifeAvailable ? lifeActors.get(`person:${id}`) : null;
  if (actor?.ferry) return `搭船中 · ${REGIONS[actor.ferry.from].name} → ${REGIONS[actor.ferry.to].name}`;
  const disposition = dispositionOf(id);
  if (disposition && actor?.traveling) return `接駁前往 · ${PLACE_BY_ID.get(disposition.placeId)?.name}`;
  if (disposition) return `${dispositionNames[disposition.status]} · ${PLACE_BY_ID.get(disposition.placeId)?.name}`;
  const routine = getPersonRoutine(id, hour);
  const destination = PLACE_BY_ID.get(actor?.destinationPlaceId || routine?.placeId)?.name;
  if (!lifeAvailable) return `今日行程 · ${destination}`;
  const district = byId.get(currentDistrict(id))?.name;
  return actor?.traveling ? `${district} → ${destination}` : `現在在 · ${district}`;
}

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
function syncRegion() {
  $('#current-region').textContent = REGIONS[currentRegion].name;
  $('#ferry-open').setAttribute('aria-label', `搭船旅行，目前在${REGIONS[currentRegion].name}`);
}
// Every remote entry uses this gate before visits, conversations or camera focus.
function requireRegion(regionId, continuation) {
  if (!regionId) return false;
  if (activeBrawl || activePvp || activeVoyage || pageGone) { toast('先完成眼前這段旅程。'); return false; }
  if (regionId === currentRegion) return true;
  openFerry(regionId, continuation);
  return false;
}
function openFerry(destination = null, continuation = null) {
  if (activeBrawl || activePvp || activeVoyage || pageGone) return;
  stopTour();
  document.querySelectorAll('dialog[open]').forEach(dialog => closeDialog(dialog));
  pendingTravel = destination ? { regionId: destination, continuation } : null;
  // An unvisited remote hash must not claim arrival while boarding is pending.
  history.replaceState(null, '', location.pathname + location.search + (focusedPlaceId ? `#${focusedPlaceId}` : activeId ? `#${activeId}` : ''));
  renderFerry(); openDialog($('#ferry-dialog'));
}
function renderFerry() {
  const root = $('#ferry-destinations'); root.replaceChildren();
  $('#ferry-description').textContent = `從${DOCKS[currentRegion].name}出發。選好下一站，搭船靠岸後再繼續探索。`;
  for (const region of Object.values(REGIONS)) {
    const here = region.id === currentRegion;
    const option = button('ferry-destination', '', () => sailTo(region.id));
    option.dataset.sailRegion = region.id;
    option.disabled = here || !sceneReady;
    option.append(element('small', '', here ? '目前所在' : pendingTravel?.regionId === region.id ? '你的目的地' : '渡輪航線'), element('strong', '', region.name), element('span', '', region.subtitle), element('b', '', here ? '已靠岸' : '搭船前往 →'));
    root.append(option);
  }
  if (!sceneReady) root.append(element('p', '', '正在準備碼頭，稍等一下就能出發。'));
}
async function sailTo(regionId) {
  if (!sceneReady || activeVoyage || activeBrawl || activePvp || pageGone || regionId === currentRegion || !REGIONS[regionId]) return false;
  const continuation = pendingTravel?.regionId === regionId ? pendingTravel.continuation : null;
  pendingTravel = null;
  const voyage = { from: currentRegion, to: regionId };
  activeVoyage = voyage;
  document.body.classList.add('voyaging');
  closeDialog($('#ferry-dialog')); setSidebar(false);
  $('#voyage-overlay').hidden = false;
  $('#voyage-from').textContent = REGIONS[voyage.from].name;
  $('#voyage-to').textContent = REGIONS[regionId].name;
  $('#voyage-title').textContent = `航向${REGIONS[regionId].name}`;
  const onProgress = value => {
    if (activeVoyage !== voyage) return;
    $('#voyage-progress').value = Math.round(value * 100);
    $('#voyage-status').textContent = value > .85 ? '準備靠岸' : value > .15 ? '渡輪航行中' : '登船，離港啟航';
  };
  onProgress(0); updateWalking();
  let arrived = false;
  try {
    arrived = sceneUnavailable ? true : await scene.sailToRegion(regionId, { onProgress });
  } catch { arrived = false; }
  if (activeVoyage !== voyage || pageGone) return false;
  activeVoyage = null; document.body.classList.remove('voyaging'); $('#voyage-overlay').hidden = true;
  if (!arrived) { updateWalking(); toast('渡輪暫時未能靠岸，仍留在原島。請再試一次。'); return false; }
  currentRegion = regionId; syncRegion(); browse({ reset: false });
  updateNearby(null); updateWalking();
  toast(`已抵達${REGIONS[regionId].name}，可以下船走走了。`);
  if (continuation) continuation();
  else selectDistrict(DOCKS[regionId].districtId);
  return true;
}
function syncChallenge() {
  const state = challenge.getState();
  $('#challenge-count').textContent = state.completed ? '通關' : state.next.kind === 'invitation' ? '新邀請' : state.next.kind === 'ordinary' ? `${state.ordinary.won.length}/${state.ordinary.total}` : `${state.wins.length}/${state.hidden ? 35 : 34}`;
  if ($('#challenge-dialog').open) renderChallenge();
}
function openChallenge() {
  if (activeBrawl || activePvp || activeVoyage) return;
  if ($('#encounter-dialog').open) closeDialog($('#encounter-dialog'));
  stopTour(); challenge.sync(); renderChallenge(); openDialog($('#challenge-dialog'));
}
function challengeButton(id, label) {
  const gate = challenge.canChallenge(id);
  const action = button('challenge-opponent', label, () => {
    closeDialog($('#challenge-dialog')); startBrawl(id, { story: true });
  });
  action.dataset.challengeOpponent = id; action.disabled = !gate.ok;
  if (!gate.ok) action.title = gate.message;
  return action;
}
function renderChallenge() {
  const state = challenge.getState(), root = $('#challenge-content'); root.replaceChildren();
  root.append(element('h3', '', state.currentStory.title), element('p', 'challenge-intro', state.currentStory.body), element('strong', 'challenge-total', `同事切磋 ${state.ordinary.won.length} / ${state.ordinary.total}`));
  root.append(element('p', 'challenge-next', state.completed ? '整冊故事已完成。可以回島上散步，或重溫每一場切磋。' : `下一頁 · ${state.next.name || state.next.label}`));
  root.append(element('p', 'storage-note', '故事挑戰是正式切磋，勝場會保存；日常「打架」另有醫院與警局的後續，不計入故事戰績。'));
  if (!state.storageAvailable) root.append(element('p', 'storage-note', '瀏覽器目前無法保存；本次仍能挑戰，關閉後可能失去戰績。'));
  for (const chapter of state.chapters) {
    const section = element('details', 'challenge-chapter');
    section.open = !chapter.complete;
    section.append(element('summary', '', `${chapter.title} · ${chapter.won}/${chapter.total}`), element('p', '', chapter.opening));
    const list = element('div', 'challenge-opponents');
    for (const id of chapter.opponentIds) list.append(challengeButton(id, `${state.wins.includes(id) ? '✓ ' : ''}${displayPersona(id).name} →`));
    section.append(list);
    if (chapter.complete && chapter.completion) section.append(element('p', 'challenge-earned', chapter.completion));
    root.append(section);
  }
  const finale = element('section', 'challenge-finale'); finale.append(element('h3', '', '終章 · 辦公室的最高處'));
  finale.append(element('p', '', '完成全部同事後，依序接受乾兒子、董事長與翅膀的邀請。'));
  const bossRoles = { rick: '乾兒子', spencer: '董事長', wing: '翅膀' };
  for (const boss of state.bosses) finale.append(challengeButton(boss.id, `${boss.won ? '✓' : boss.available ? '可挑戰' : '未解鎖'} · ${bossRoles[boss.id]}`));
  root.append(finale);
  if (state.invitation.available && !state.invitation.opened) {
    root.append(button('primary-button', '拆開碼頭留下的神秘邀請 →', () => { const result = challenge.openInvitation(); if (result.ok) { syncChallenge(); renderChallenge(); } }));
  }
  if (state.hidden) root.append(challengeButton(state.hidden.id, `${state.hidden.won ? '✓ ' : ''}隱藏挑戰 · ${state.hidden.name} →`));
  if (state.completed && state.completion) root.append(element('h3', '', state.completion.title), element('p', 'challenge-earned', state.completion.body));
}
function renderStoryResult(result, id) {
  activeEncounter = null; syncChallenge();
  const root = $('#encounter-content'); root.replaceChildren();
  $('#encounter-place').textContent = '移動島大亂鬥 · 故事挑戰';
  const title = element('h2', '', result.story.title); title.id = 'encounter-title'; title.tabIndex = -1;
  root.append(title, element('div', 'conflict-result-stamp', result.outcome === 'win' ? '挑戰成功' : result.outcome === 'draw' ? '這回平手，故事等你再來' : '先喘口氣，還能再挑戰'), element('p', 'encounter-opening', result.story.body));
  root.append(button('primary-button', result.outcome === 'win' ? '回到章節，繼續下一關 →' : '再次挑戰 →', () => {
    if (result.outcome === 'win') openChallenge(); else startBrawl(id, { story: true });
  }));
  if (result.outcome !== 'win') root.append(button('mystery-inline', '看看故事進度', openChallenge));
  $('#encounter-leave').textContent = '先回島上走走 →';
  if (!$('#encounter-dialog').open) openDialog($('#encounter-dialog'));
  updateWalking(); title.focus({ preventScroll: true });
}
function writePvpLink(roomCode = '') {
  const params = new URLSearchParams(location.search);
  if (roomCode) params.set('duel', roomCode); else params.delete('duel');
  const search = params.toString();
  history.replaceState(null, '', location.pathname + (search ? `?${search}` : '') + location.hash);
}
function disposePvp({ preserveInvite = false } = {}) {
  const session = activePvp; if (!session) return;
  activePvp = null;
  session.handle?.destroy();
  if (!preserveInvite) writePvpLink();
  document.body.classList.remove('pvp-open');
  scene?.setPaused(paused);
  updateWalking();
}
async function openPvp(inviteCode = '') {
  if (activeBrawl || activeVoyage || pageGone) return;
  if (activePvp) { $('#pvp-dialog').focus(); return; }
  stopTour();
  document.querySelectorAll('dialog[open]').forEach(dialog => closeDialog(dialog));
  const session = { handle: null, returnHash: location.hash };
  activePvp = session; activeEncounter = null;
  document.body.classList.add('pvp-open');
  scene?.setPaused(true);
  const dialog = $('#pvp-dialog'), content = $('#pvp-content');
  content.replaceChildren(element('p', '', '正在準備雙人對戰場地…'));
  openDialog(dialog);
  try {
    const { mountIslandPvp } = await import('./pvp-ui.js');
    if (activePvp !== session || pageGone) return;
    content.replaceChildren();
    session.handle = mountIslandPvp({
      container: content, storage, inviteCode,
      onStatus(status) {
        if (activePvp !== session || pageGone) return;
        if (/^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{8}$/.test(status?.roomCode || '')) writePvpLink(status.roomCode);
      },
      onClose() {
        if (activePvp !== session) return;
        disposePvp(); dialog.close(); restoreDialogFocus();
      },
    });
  } catch (error) {
    if (activePvp !== session) return;
    content.replaceChildren(element('h3', '', '對戰場地暫時未能開啟'), element('p', '', '請重新整理後再試，或先回島上走走。這次尚未加入房間。'));
    content.append(button('primary-button', '回到小島', () => closeDialog(dialog)));
    console.warn('Island multiplayer unavailable:', error instanceof Error ? error.message : 'initialization failed');
  }
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
  $('#passport-open').setAttribute('aria-label', `小島護照，已踏訪 ${count} 個園區`);
  $('#visited-filter-count').textContent = String(count).padStart(2, '0');
  $('#progress-label').textContent = `${count} / ${DISTRICTS.length}`;
  $('#mobile-progress').textContent = `${count} / ${DISTRICTS.length} 已踏訪`;
  $('#progress-bar').style.width = `${count / DISTRICTS.length * 100}%`;
  $('#encounter-count').textContent = `本次散步 · ${encounterChoices.size} / ${ENCOUNTERS.length} 段偶遇`;
  $('#place-progress').textContent = `本次場所 ${placeVisits.size} / ${PLACES.length}`;
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
  exile: 'M4 21V7h16v14M2 21h20M8 7V3h8v4M10 21v-6h4v6m-7-4h.1m10 0h.1',
  hospital: 'M4 21V6h16v15M2 21h20M10 9h4m-2-2v4m-2 10v-6h4v6',
  police: 'M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7l-9-4m0 5v8m-4-4h8',
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
    if (zoneFilter !== 'all' && d.category !== zoneFilter) return false;
    const text = [d.name, d.summary, ...d.tags, ...placesByDistrict.get(d.id).flatMap(place => [place.name, ...place.tags]), ...peopleInDistrict(d.id).map(({ id }) => {
      const p = displayPersona(id); return `${id} ${p.name} ${p.title}`;
    })].join(' ').toLocaleLowerCase();
    return !query || text.includes(query);
  });
  matches.sort((a, b) => ['department', 'shared', 'afterwork', 'special'].indexOf(a.category) - ['department', 'shared', 'afterwork', 'special'].indexOf(b.category));
  for (const d of matches) {
    if (!query && (!list.lastElementChild || list.lastElementChild.dataset.category !== d.category)) {
      const heading = element('div', 'district-group-label', categoryNames[d.category]);
      heading.dataset.category = d.category; list.append(heading);
    }
    const visited = progress.visited.includes(d.id);
    const card = button(`district-card${visited ? ' is-visited' : ''}`, '', () => selectDistrict(d.id));
    card.dataset.districtLink = d.id;
    card.setAttribute('aria-label', `${d.number} ${d.name}${visited ? '，已踏訪' : ''}`);
    const info = element('span', 'district-info');
    info.append(element('span', 'district-name', d.name), element('span', 'district-meta', placesByDistrict.get(d.id).map(place => place.shortName).join(' · ')));
    card.append(element('span', 'district-number', d.number), districtIcon(d), info, element('span', 'district-arrow', visited ? '✓' : '↗'));
    card.dataset.category = d.category;
    list.append(card);
    if (query) {
      const hits = placesByDistrict.get(d.id).filter(place => [place.name, ...place.tags].join(' ').toLocaleLowerCase().includes(query));
      if (hits.length) {
        const shortcuts = element('div', 'place-search-hits');
        for (const place of hits) { const link = button('', `${place.name} ↗`, () => visitPlace(place.id)); link.dataset.visitPlace = place.id; shortcuts.append(link); }
        list.append(shortcuts);
      }
    }
  }
  $('#zone-result-count').textContent = query ? `找到 ${matches.length} 個園區` : `${matches.length} 個園區 · ${matches.reduce((sum, d) => sum + placesByDistrict.get(d.id).length, 0)} 個場所`;
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
  return roaming && !activeBrawl && !activePvp && !activeVoyage && !sidebarOpen && !document.querySelector('dialog[open]');
}
function updateWalking() {
  walkControls?.clear();
  scene?.setMovementEnabled(canWalk());
  scene?.setConversationTarget($('#encounter-dialog').open ? activeEncounter?.kind === 'routine' ? { kind: 'person', id: MYSTERY_TRIP.hostId } : activeEncounter : null);
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
  if (target.kind === 'dock') {
    $('#nearby-name').textContent = DOCKS[target.regionId].name;
    $('#nearby-greeting').textContent = '下一站想去哪座島？從這裡搭船出發。';
    $('#interact-label').textContent = '搭船';
  } else if (target.kind === 'resident') {
    const resident = residentById.get(target.id);
    if (!resident) { $('#nearby-prompt').hidden = true; return; }
    $('#nearby-name').textContent = resident.nickname;
    $('#nearby-greeting').textContent = resident.greeting;
    $('#interact-label').textContent = '聊聊';
  } else if (target.kind === 'person') {
    const encounter = encounterById.get(target.id);
    $('#nearby-name').textContent = displayPersona(target.id).name;
    $('#nearby-greeting').textContent = dispositionOf(target.id) ? personLocation(target.id) : target.id === MYSTERY_TRIP.hostId && getIslandRoutine(hour).trip ? MYSTERY_TRIP.invitation : actorActivity(lifeActors.get(`person:${target.id}`) || { id: target.id }) || encounter?.greeting;
    $('#interact-label').textContent = '聊聊';
  } else if (target.kind === 'place') {
    const place = PLACE_BY_ID.get(target.id);
    if (!place) { $('#nearby-prompt').hidden = true; return; }
    $('#nearby-name').textContent = place.name;
    $('#nearby-greeting').textContent = place.summary;
    $('#interact-label').textContent = '探索';
  } else {
    $('#nearby-name').textContent = district.name;
    $('#nearby-greeting').textContent = '已經走到門口了，進來聽一段日常。';
    $('#interact-label').textContent = '探索';
  }
}
function renderConflictStatus() {
  const state = conflictState, root = $('#island-conflict-panel');
  root.replaceChildren(); root.dataset.status = state.player.status;
  root.append(element('span', 'eyebrow', 'ISLAND INCIDENTS'), element('h3', '', '你的島上狀態'));
  root.append(element('strong', 'conflict-player-status', dispositionNames[state.player.status]));
  if (state.player.status !== 'free') {
    const place = PLACE_BY_ID.get(state.player.placeId);
    root.append(element('p', '', `在${place.name}完成${state.player.status === 'hospital' ? '包紮與留觀' : state.player.status === 'police' ? '事情經過的筆錄' : '值班或冷宮點名'}，就能恢復一般活動。`));
    const link = button('conflict-location-button', `前往${place.name}處理 →`, () => goToConflictPlace(place.id));
    link.dataset.conflictPlayerPlace = place.id; root.append(link);
  } else root.append(element('p', '', '和同事聊聊，也能選擇吵架或打架。每一次衝突，都會留下下一站。'));
  if (state.people.length) {
    const list = element('div', 'conflict-people');
    for (const person of state.people) {
      const link = button('', `${displayPersona(person.id).name} · ${dispositionNames[person.status]} ↗`, () => goToConflictPlace(person.placeId));
      link.dataset.conflictPerson = person.id; list.append(link);
    }
    root.append(list);
  }
  const latest = state.history.at(-1);
  if (latest) root.append(element('p', 'conflict-latest', `剛剛發生 · ${latest.title}`));
}
function syncConflicts() {
  conflictState = conflicts.getState();
  const actors = scene?.setDispositions?.(conflictState.people);
  if (Array.isArray(actors)) updateIslandLife({ actors });
  renderConflictStatus(); renderDistrictPeople(); renderList();
  if ($('#cast-dialog').open) renderCastDirectory();
  renderRoutineStatus();
}
function goToConflictPlace(placeId) {
  const place = PLACE_BY_ID.get(placeId); if (!place) return;
  if (!requireRegion(getRegionForDistrict(place.districtId), () => goToConflictPlace(placeId))) return;
  if ($('#encounter-dialog').open) closeDialog($('#encounter-dialog'));
  stopTour();
  if (scene && !sceneUnavailable) {
    setRoaming(true);
    if (scene.sendPlayerToPlace?.(placeId) === false) toast('入口暫時有點擠，先從場所清單處理這段插曲。');
  }
  visitPlace(placeId);
}
function renderConflictResult(result) {
  if (!result.ok) { toast(result.message); return; }
  activeEncounter = null;
  syncConflicts();
  const player = conflictState.player;
  if (player.status !== 'free' && getRegionForDistrict(player.districtId) === currentRegion && scene && !sceneUnavailable) {
    stopTour();
    if (!roaming) setRoaming(true);
    setSidebar(false);
    const arrived = scene.sendPlayerToPlace?.(player.placeId) !== false;
    if (arrived && !progress.visited.includes(player.districtId)) { progress.visited.push(player.districtId); save(); }
    if (!arrived) toast('入口暫時有點擠，點下方場所繼續處理。');
    syncProgress();
  }
  const content = $('#encounter-content'); content.replaceChildren();
  $('#encounter-place').textContent = '島上插曲 · 事情已經發生';
  const title = element('h2', '', result.title); title.id = 'encounter-title'; title.tabIndex = -1;
  content.append(title, element('p', 'encounter-opening', result.description));
  if (result.kind === 'fight') {
    content.append(element('div', 'conflict-result-stamp', result.outcome === 'draw' ? '雙方停手，這場不分勝負。' : '一陣卡通煙塵過後，各自有了下一站。'));
    if (result.summary) {
      const score = element('div', 'brawl-result-score');
      score.append(element('strong', '', `對戰 ${Math.round(result.summary.duration)} 秒`), element('span', '', `最高 ${result.summary.maxCombo} 連擊 · 大招 ${result.summary.specialsUsed} 次`));
      score.append(element('span', '', `造成 ${result.summary.damageDealt} 傷害 · 承受 ${result.summary.damageTaken} 傷害`)); content.append(score);
    }
  }
  if (player.status !== 'free') {
    const place = PLACE_BY_ID.get(player.placeId);
    content.append(element('p', 'conflict-outcome', `你：${dispositionNames[player.status]} · ${place.name}`));
    const remote = getRegionForDistrict(place.districtId) !== currentRegion;
    const proceed = button('primary-button', `${remote ? '搭接駁船前往' : '查看'}${place.name}，處理接下來的事 →`, () => goToConflictPlace(place.id));
    proceed.dataset.conflictProceed = place.id; content.append(proceed);
  }
  for (const person of conflictState.people.filter(person => person.id === result.participantId)) {
    content.append(element('p', 'conflict-outcome', `${displayPersona(person.id).name}：${dispositionNames[person.status]} · ${PLACE_BY_ID.get(person.placeId).name}`));
  }
  $('#encounter-leave').textContent = '先看看四周 →';
  if (!$('#encounter-dialog').open) openDialog($('#encounter-dialog'));
  updateWalking(); title.focus({ preventScroll: true });
}
function disposeBrawl({ cancel = true } = {}) {
  const match = activeBrawl; if (!match) return;
  // Clear ownership first: late renderer callbacks must never finish a new bout.
  activeBrawl = null;
  match.handle?.destroy();
  if (cancel) { if (match.story) challenge.cancel(match.token); else conflicts.cancelFight(match.token); }
  conflictState = conflicts.getState();
  $('#encounter-dialog').classList.remove('brawl-dialog');
  $('#encounter-dialog [data-close-dialog]').setAttribute('aria-label', '結束對話，繼續散步');
}
async function startBrawl(id, { story = false } = {}) {
  if (activeBrawl || activePvp || activeVoyage || pageGone) return;
  if (['rick', 'spencer', 'wing', 'hidden-visitor'].includes(id)) story = true;
  if (story) {
    const gate = challenge.canChallenge(id);
    if (!gate.ok) { toast(gate.message); openChallenge(); return; }
  }
  if (conflictState.player.status !== 'free' || dispositionOf(id)) { toast('先到對應場所完成這段插曲，再來挑戰。'); return; }
  if (lifeActors.get(`person:${id}`)?.ferry) { toast('對方正在搭船，等靠岸後再約。'); return; }
  if (!requireRegion(getRegionForDistrict(currentDistrict(id)), () => startBrawl(id, { story }))) return;
  if (!displayPersona(id)) return;
  if ($('#challenge-dialog').open) closeDialog($('#challenge-dialog'));
  const reservation = story ? challenge.begin(id) : conflicts.beginFight(id);
  if (!reservation.ok) { toast(reservation.message); return; }
  stopTour();
  const target = { kind: 'person', id, districtId: currentDistrict(id), key: `person:${id}` };
  activeEncounter = target;
  const match = { token: reservation.token, handle: null, returnHash: location.hash, story };
  activeBrawl = match; conflictState = conflicts.getState();
  const dialog = $('#encounter-dialog'), content = $('#encounter-content');
  content.replaceChildren(); dialog.classList.add('brawl-dialog');
  $('#encounter-dialog [data-close-dialog]').setAttribute('aria-label', '暫停或離開對戰');
  $('#encounter-place').textContent = `${story ? '故事挑戰' : '島上插曲'} · 和${displayPersona(id).name}對戰`;
  const loadingTitle = element('h2', '', '移動島大亂鬥'); loadingTitle.id = 'encounter-title';
  content.append(loadingTitle, element('p', 'encounter-opening', '正在準備場地…'), button('primary-button', '先回到小島', () => closeDialog(dialog)));
  if (!dialog.open) openDialog(dialog);
  updateWalking();
  try {
    const { mountIslandBrawl } = await import('./brawl-ui.js');
    if (activeBrawl !== match) return;
    content.replaceChildren();
    match.handle = mountIslandBrawl({
      container: content, opponent: { id, name: displayPersona(id).name, image: personaImage(id) }, story: story ? reservation.story : null, reducedMotion: reducedMotion.matches,
      onFinish(outcome, summary) {
        if (activeBrawl !== match) return;
        const result = story ? challenge.settle(match.token, outcome) : conflicts.settleFight(match.token, outcome, summary);
        disposeBrawl({ cancel: !result.ok });
        if (!result.ok) { if (story) openChallenge(); else renderEncounter(target); updateWalking(); toast(result.message); return; }
        if (story) renderStoryResult(result, id); else renderConflictResult(result);
      },
    });
  } catch (error) {
    if (activeBrawl !== match) return;
    disposeBrawl(); content.replaceChildren();
    const title = element('h2', '', '場地暫時沒有準備好'); title.id = 'encounter-title';
    content.append(title, element('p', 'encounter-opening', '這台裝置暫時無法開啟對戰畫面。可以重試，或先回去聊天。這場尚未開始。'));
    content.append(button('primary-button', '重新準備對戰 →', () => startBrawl(id, { story })), button('mystery-inline', story ? '回到故事章節' : '回到對話', () => { if (story) openChallenge(); else { renderEncounter(target); updateWalking(); } }));
    $('#encounter-leave').textContent = '先回到小島 →';
    updateWalking();
    console.warn('Island brawl unavailable:', error instanceof Error ? error.message : 'battle initialization failed');
  }
}
function renderConflictMenu(id, kind) {
  if (kind === 'fight') return startBrawl(id);
  activeEncounter = { kind: 'person', id, districtId: currentDistrict(id), key: `person:${id}` };
  const content = $('#encounter-content'); content.replaceChildren();
  const persona = displayPersona(id), title = element('h2', '', `和${persona.name}吵上幾句`);
  title.id = 'encounter-title'; title.tabIndex = -1;
  $('#encounter-place').textContent = '島上插曲 · 選擇你的做法';
  content.append(title, element('p', 'encounter-opening', '話題愈說愈僵，旁邊的人慢慢放下茶杯。這句話，要現在說出口嗎？'));
  const choices = element('div', 'story-choices conflict-choices');
  {
    const action = button('', '把不滿直接說出來', () => renderConflictResult(conflicts.argue(id)));
    action.dataset.conflictArgue = id; choices.append(action);
  }
  choices.append(button('conflict-cancel', '算了，先繼續聊天', () => { renderEncounter(activeEncounter); updateWalking(); $('#encounter-title').tabIndex = -1; $('#encounter-title').focus(); }));
  content.append(choices); $('#encounter-leave').textContent = '離開這場口角 →'; updateWalking(); title.focus();
}
function appendConflictActions(content, id) {
  const disposition = dispositionOf(id), player = conflictState.player;
  const area = element('section', 'conflict-actions');
  if (disposition) {
    const traveling = lifeAvailable && lifeActors.get(`person:${id}`)?.traveling;
    area.append(element('p', '', `${displayPersona(id).name}${traveling ? '正在前往' : '正在'}${PLACE_BY_ID.get(disposition.placeId).name}，先把這段插曲收好。`));
    area.append(button('', `去${PLACE_BY_ID.get(disposition.placeId).name}看看 →`, () => goToConflictPlace(disposition.placeId)));
  } else if (player.status !== 'free') {
    area.append(element('p', '', `你還有${dispositionNames[player.status]}的後續要處理。`));
    area.append(button('', '先處理自己的下一站 →', () => goToConflictPlace(player.placeId)));
  } else {
    area.append(element('span', 'eyebrow', '話不投機，也有下一段'));
    const argue = button('', '吵架', () => renderConflictMenu(id, 'argument')); argue.dataset.conflictAction = 'argue';
    const isBoss = ['rick', 'spencer', 'wing'].includes(id);
    const fight = button('', isBoss ? '故事首領戰' : '打架', () => renderConflictMenu(id, 'fight')); fight.dataset.conflictAction = 'fight';
    area.append(argue, fight);
    const gate = challenge.canChallenge(id);
    const storyButton = button('', gate.ok ? '故事挑戰 →' : '查看故事解鎖條件 →', () => gate.ok ? startBrawl(id, { story: true }) : openChallenge());
    storyButton.dataset.storyChallenge = id; if (!isBoss) area.append(storyButton);
  }
  content.append(area);
}
function appendFacilityActions(content, placeId) {
  const state = conflictState, player = state.player;
  const exileFacilities = ['exile-gate', 'cold-palace'];
  const ownTask = player.status !== 'free' && (player.placeId === placeId || player.status === 'exile' && exileFacilities.includes(placeId));
  const people = state.people.filter(person => person.placeId === placeId);
  if (!ownTask && !people.length) return;
  const area = element('section', 'facility-actions'); area.append(element('h3', '', '把這段插曲處理完'));
  if (ownTask) {
    const label = player.status === 'hospital' ? '完成包紮與留觀，辦理出院' : player.status === 'police' ? '說明事情經過，完成筆錄' : placeId === 'cold-palace' ? '完成冷宮點名，解除冷凍' : '完成看門值班，解除冷凍';
    const complete = button('primary-button', label, () => renderConflictResult(conflicts.recoverPlayer(placeId)));
    complete.dataset.conflictRecover = placeId; area.append(complete);
  }
  for (const person of people) {
    const actor = lifeAvailable ? lifeActors.get(`person:${person.id}`) : null;
    if (lifeAvailable && (!actor || actor.traveling || actor.ferry || actor.districtId !== person.districtId)) {
      area.append(element('p', '', `${displayPersona(person.id).name}還在接駁途中，抵達後就能辦理後續。`));
      const refresh = button('', '更新抵達狀態 ↻', () => renderEncounter({ kind: 'place', id: placeId, districtId: PLACE_BY_ID.get(placeId).districtId, key: `place:${placeId}` }));
      refresh.dataset.conflictAwait = person.id; area.append(refresh);
      continue;
    }
    const label = person.status === 'hospital' ? '辦理出院' : person.status === 'police' ? '完成筆錄' : '解除冷凍';
    const complete = button('', `陪${displayPersona(person.id).name}${label} →`, () => renderConflictResult(conflicts.releasePerson(person.id, placeId)));
    complete.dataset.conflictRelease = person.id; area.append(complete);
  }
  content.append(area);
}
function renderEncounter(target) {
  activeEncounter = target;
  if (target.kind === 'resident') return renderResidentEncounter(target);
  const district = byId.get(target.districtId);
  const isRoutine = target.kind === 'routine';
  const isPerson = target.kind === 'person';
  const place = target.kind === 'place' ? PLACE_BY_ID.get(target.id) : null;
  const story = isRoutine ? MYSTERY_TRIP.story : isPerson ? encounterById.get(target.id) : place?.story || district.story;
  const content = $('#encounter-content'); content.replaceChildren();
  $('#encounter-place').textContent = `${district.number} / ${district.name} · ${isRoutine ? '阿良的邀約' : isPerson ? '島上偶遇' : place?.name || '園區日常'}`;
  if (isPerson || isRoutine) {
    const speakerId = isRoutine ? MYSTERY_TRIP.hostId : target.id;
    const speaker = element('div', 'encounter-speaker');
    const portrait = element('img'); portrait.src = personaImage(speakerId); portrait.alt = '';
    speaker.append(portrait, element('strong', '', displayPersona(speakerId).name)); content.append(speaker);
    if (isPerson) {
      content.append(element('p', 'encounter-routine', `${personLocation(target.id)} · ${actorActivity(lifeActors.get(`person:${target.id}`) || { id: target.id })}`));
      if (target.id === MYSTERY_TRIP.hostId && !dispositionOf(target.id)) content.append(button('mystery-inline', '聽聽阿良的晚間邀約 →', () => { renderEncounter({ kind: 'routine', id: MYSTERY_TRIP.placeId, districtId: currentDistrict(MYSTERY_TRIP.hostId) }); updateWalking(); $('#encounter-title').tabIndex = -1; $('#encounter-title').focus(); }));
      content.append(element('p', 'encounter-memory-label', '聊起一段島上回憶'));
    } else content.append(element('p', 'encounter-routine', getIslandRoutine(hour).trip ? '今晚的集合正在進行，夥伴會從各處慢慢走來。' : '每日 19:00–20:00，在夜色碼頭集合。現在可以先聊聊晚上的安排。'));
  }
  const title = element('h2', '', story.title); title.id = 'encounter-title';
  content.append(title, element('p', 'encounter-opening', story.opening));
  const choicesMap = isRoutine ? routineChoices : isPerson ? encounterChoices : place ? placeChoices : districtChoices;
  const choiceKey = isRoutine || isPerson || place ? target.id : district.id;
  const selected = choicesMap.get(choiceKey);
  if (Number.isInteger(selected)) {
    const result = element('div', 'story-response'); result.id = 'encounter-response'; result.tabIndex = -1;
    result.append(element('b', '', `你說：${story.choices[selected].label}`), element('p', '', story.choices[selected].response));
    content.append(result);
    $('#encounter-leave').textContent = '把這段日常收好，繼續散步 →';
    if (isRoutine) content.append(button('mystery-inline', getIslandRoutine(hour).trip ? '去集合處看看 →' : '切到 19:15，看大家集合 →', () => {
      closeDialog($('#encounter-dialog')); clockRunning = false; if (!getIslandRoutine(hour).trip) setHour(19.25);
      const arrive = () => { selectDistrict('harbor'); scene?.focusPlace(MYSTERY_TRIP.placeId); };
      if (requireRegion('life', arrive)) arrive();
    }));
  } else {
    const choices = element('div', 'story-choices');
    story.choices.forEach((choice, index) => {
      const option = button('', '', () => {
        choicesMap.set(choiceKey, index);
        syncProgress();
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
  if (isPerson || isRoutine) appendConflictActions(content, isRoutine ? MYSTERY_TRIP.hostId : target.id);
  if (place) appendFacilityActions(content, place.id);
}
function renderResidentEncounter(target) {
  const resident = residentById.get(target.id);
  if (!resident) return;
  const district = byId.get(resident.districtId), content = $('#encounter-content');
  content.replaceChildren();
  $('#encounter-place').textContent = `${district.number} / ${district.name} · 新島民偶遇`;
  const speaker = element('div', 'encounter-speaker'); speaker.append(residentAvatar(resident.outfit), element('strong', '', resident.nickname));
  const title = element('h2', '', '在島上，認識一位新鄰居'); title.id = 'encounter-title';
  content.append(speaker, title, element('p', 'encounter-opening', resident.greeting));
  if (residentChoices.has(resident.id)) {
    const response = element('div', 'story-response'); response.id = 'encounter-response'; response.tabIndex = -1;
    response.append(element('b', '', '你說：想聽聽你的島上故事。'), element('p', '', resident.introduction)); content.append(response);
  } else {
    const choices = element('div', 'story-choices');
    choices.append(button('', '想聽聽你的島上故事。', () => { residentChoices.set(resident.id, true); renderEncounter(target); $('#encounter-response').focus({ preventScroll: true }); }));
    content.append(choices);
  }
  $('#encounter-leave').textContent = '下次見，繼續散步 →';
}
function meetResident(resident) {
  if (!residentById.has(resident.id)) return;
  if (!requireRegion(getRegionForDistrict(resident.districtId), () => meetResident(resident))) return;
  renderEncounter({ kind: 'resident', id: resident.id, districtId: resident.districtId, key: `resident:${resident.id}` });
  openDialog($('#encounter-dialog'));
}
function meetColleague(id) {
  const person = encounterById.get(id);
  if (!person) return;
  if (lifeActors.get(`person:${id}`)?.ferry) { toast('對方正在搭船，等靠岸後再聊。'); return; }
  if (!requireRegion(getRegionForDistrict(currentDistrict(id)), () => meetColleague(id))) return;
  stopTour();
  if (id === MYSTERY_TRIP.hostId && getIslandRoutine(hour).trip && !dispositionOf(id)) { openMysteryInvitation(); return; }
  renderEncounter({ kind: 'person', id, districtId: currentDistrict(id), key: `person:${id}` });
  openDialog($('#encounter-dialog'));
}
function visitPlace(id) {
  const place = PLACE_BY_ID.get(id); if (!place) return;
  if (!requireRegion(getRegionForDistrict(place.districtId), () => visitPlace(id))) return;
  stopTour();
  placeVisits.add(id);
  if (!roaming) selectDistrict(place.districtId, { moveFocus: false });
  if (!progress.visited.includes(place.districtId)) { progress.visited.push(place.districtId); save(); }
  focusedPlaceId = id;
  syncProgress();
  if (!roaming) { scene?.focusPlace(id); history.replaceState(null, '', `#${id}`); }
  renderEncounter({ kind: 'place', id, districtId: place.districtId, key: `place:${id}` });
  openDialog($('#encounter-dialog'));
}
function actorActivity(actor) {
  if (actor?.ferry) return `搭船前往${REGIONS[actor.ferry.to].name}`;
  const disposition = dispositionOf(actor?.id);
  if (disposition && actor?.traveling) return `接駁前往${PLACE_BY_ID.get(disposition.placeId)?.name}`;
  if (disposition) return dispositionNames[disposition.status];
  if (!lifeAvailable) return '在島上等你';
  if (actor?.state === 'talking') return '正在聊天';
  if (actor?.state === 'greeting') return '停下來打招呼';
  if (paused) return '歇腳中';
  if (actor?.traveling && actor.activity === actor.routine?.activity && PLACE_BY_ID.has(actor.destinationPlaceId)) return `準備前往${PLACE_BY_ID.get(actor.destinationPlaceId).name}`;
  return actor?.activity || '歇腳中';
}
function renderRoutineStatus() {
  const routine = getIslandRoutine(hour);
  $('#island-routine-title').textContent = routine.title;
  $('#island-routine-description').textContent = routine.description;
  $('#mystery-status').textContent = routine.trip ? routine.trip.stage === 'stroll' ? '碼頭小旅行 · 跟阿良走一段' : '阿良正在揪團 · 夥伴陸續集合' : hour >= 20 ? '今晚已散場 · 下次 19:00 再約' : '晚間預告 · 19:00 夜色碼頭集合';
  $('#mystery-open').textContent = routine.trip ? '聽聽阿良的邀約 ↗' : '看看今晚的邀約 ↗';
  const hostDisposition = dispositionOf(MYSTERY_TRIP.hostId);
  if (hostDisposition) {
    if (routine.trip) {
      $('#island-routine-title').textContent = '今晚的行程，先等阿良一下';
      $('#island-routine-description').textContent = `夥伴仍照原訂行程到夜色碼頭，阿良正在${dispositionNames[hostDisposition.status]}。可以先去看看他。`;
    }
    $('#mystery-status').textContent = `阿良目前${dispositionNames[hostDisposition.status]}，今晚先把行程放一放。`;
    $('#mystery-open').textContent = '先去看看阿良 →';
  }
  $('#time-flow').setAttribute('aria-pressed', String(clockRunning));
  $('#time-flow').disabled = reducedMotion.matches;
  $('#time-flow').textContent = reducedMotion.matches ? '減少動態 · 時間已停' : clockRunning && !paused ? '時間流動中 · 暫停' : '時間已停 · 播放';
}
function openMysteryInvitation() {
  if (dispositionOf(MYSTERY_TRIP.hostId)) { meetColleague(MYSTERY_TRIP.hostId); return; }
  if (lifeActors.get(`person:${MYSTERY_TRIP.hostId}`)?.ferry) { toast('阿良正在搭船，等靠岸後再聽邀約。'); return; }
  if (!requireRegion(getRegionForDistrict(currentDistrict(MYSTERY_TRIP.hostId)), openMysteryInvitation)) return;
  stopTour();
  renderEncounter({ kind: 'routine', id: MYSTERY_TRIP.placeId, districtId: currentDistrict(MYSTERY_TRIP.hostId), key: `person:${MYSTERY_TRIP.hostId}` });
  openDialog($('#encounter-dialog'));
}
function renderDistrictPeople() {
  if (!activeId) return;
  const list = $('#detail-people'); if (!list) return;
  const people = peopleInDistrict(activeId), signature = people.map(person => person.id).join(',');
  $('#detail-people-title').textContent = lifeAvailable ? '此刻，在這個園區' : '這個時段的行程';
  if (list.dataset.roster === signature) return;
  const focusedId = document.activeElement?.dataset?.personId;
  list.dataset.roster = signature; list.replaceChildren();
  for (const { id } of people) {
    const persona = displayPersona(id);
    const chip = button('person-chip', '', () => meetColleague(id)); chip.title = persona.title; chip.dataset.personId = id;
    chip.setAttribute('aria-label', `和${persona.name}聊聊`);
    const portrait = element('img'); portrait.src = personaImage(id); portrait.alt = ''; portrait.loading = 'lazy';
    chip.append(portrait, element('span', '', persona.name)); list.append(chip);
    if (id === focusedId) chip.focus({ preventScroll: true });
  }
  if (!people.length) list.append(element('p', 'people-empty', '大家暫時到別處走走了，從人物名冊看看他們在哪裡。'));
}
function renderLifeStatus() {
  const actors = [...lifeActors.values()];
  const moving = actors.filter(actor => actor.state === 'walking').length;
  const chatting = actors.filter(actor => ['greeting', 'talking'].includes(actor.state)).length;
  $('#island-life-summary').textContent = !lifeAvailable ? '每個角落，都有熟悉的面孔。'
    : paused ? '島上動態已暫停，仍可走近聊天。'
      : `${moving} 位散步中 · ${Math.max(0, actors.length - moving - chatting)} 位歇腳${chatting ? ` · ${chatting} 位打招呼` : ''}`;
  $('#island-life-panel').classList.toggle('is-paused', paused || !lifeAvailable);
  for (const label of document.querySelectorAll('[data-person-activity]')) {
    const actor = lifeActors.get(`person:${label.dataset.personActivity}`);
    label.textContent = actorActivity(actor);
    label.dataset.state = paused ? 'resting' : actor?.state || 'resting';
  }
  for (const label of document.querySelectorAll('[data-person-location]')) label.textContent = personLocation(label.dataset.personLocation);
  for (const locate of document.querySelectorAll('[data-locate-person]')) locate.setAttribute('aria-label', `看看${displayPersona(locate.dataset.locatePerson).name}的位置：${personLocation(locate.dataset.locatePerson)}`);
  renderDistrictPeople();
  renderRoutineStatus();
}
function updateIslandLife({ actors = [] } = {}) {
  if (sceneUnavailable) return;
  const signature = rows => [...rows].filter(actor => actor.kind === 'person').map(actor => `${actor.id}:${actor.districtId}:${actor.destinationPlaceId}`).join('|');
  const changed = signature(lifeActors.values()) !== signature(actors);
  lifeActors = new Map(actors.map(actor => [`${actor.kind}:${actor.id}`, actor]));
  lifeAvailable = actors.length > 0;
  if (changed && $('#search').value.trim()) renderList();
  if (changed && $('#cast-dialog').open && $('#cast-search').value.trim()) {
    const focused = document.activeElement, personId = focused?.dataset?.locatePerson;
    const wasInList = $('#cast-list').contains(focused);
    renderCastDirectory();
    if (personId) document.querySelector(`[data-locate-person="${personId}"]`)?.focus({ preventScroll: true });
    if (wasInList && !document.activeElement?.isConnected) $('#cast-search').focus({ preventScroll: true });
  }
  renderLifeStatus();
}
function renderCastDirectory() {
  const query = $('#cast-search').value.trim().toLocaleLowerCase();
  const matches = ISLAND_CAST.filter(({ id, districtId, workplaceId }) => {
    const p = displayPersona(id);
    return [id, p.name, p.title, byId.get(currentDistrict(id))?.name, personLocation(id), PLACE_BY_ID.get(workplaceId)?.name].join(' ').toLocaleLowerCase().includes(query);
  });
  $('#cast-results').textContent = query ? `找到 ${matches.length} 位同事` : `${ISLAND_CAST.length} 位同事，在各園區工作，也在島上走走。`;
  $('#cast-empty').hidden = matches.length !== 0;
  const list = $('#cast-list'); list.replaceChildren();
  for (const { id, districtId, workplaceId } of matches) {
    const p = displayPersona(id);
    const card = element('article', 'cast-card'); card.dataset.characterId = id;
    const portrait = element('img'); portrait.src = personaImage(id); portrait.alt = ''; portrait.loading = 'lazy';
    const copy = element('div', 'cast-copy');
    copy.append(element('h3', '', p.name), element('p', '', p.title));
    if (PLACE_BY_ID.has(workplaceId)) copy.append(element('span', 'cast-workplace', `工作據點 · ${PLACE_BY_ID.get(workplaceId).name}`));
    const location = element('span', 'cast-place', personLocation(id)); location.dataset.personLocation = id; copy.append(location);
    const activity = element('span', 'cast-activity', actorActivity(lifeActors.get(`person:${id}`) || { id }));
    activity.dataset.personActivity = id;
    copy.append(activity);
    const actions = element('div', 'cast-actions');
    const talk = button('', '聊聊 →', () => { closeDialog($('#cast-dialog')); meetColleague(id); });
    talk.setAttribute('aria-label', `和${p.name}聊聊`);
    const locate = button('', '看看位置', () => {
      closeDialog($('#cast-dialog'));
      const locatePerson = () => { selectDistrict(currentDistrict(id)); scene?.focusPerson(id); };
      if (lifeActors.get(`person:${id}`)?.ferry) { toast('對方正在海上，靠岸後就能定位。'); return; }
      if (requireRegion(getRegionForDistrict(currentDistrict(id)), locatePerson)) locatePerson();
    });
    locate.dataset.locatePerson = id;
    locate.setAttribute('aria-label', `看看${p.name}的位置：${personLocation(id)}`);
    actions.append(talk, locate); card.append(portrait, copy, actions); list.append(card);
  }
}
function updateResidents(residents) {
  residentById = new Map(residents.map(row => [row.id, row]));
  for (const id of residentChoices.keys()) if (!residentById.has(id)) residentChoices.delete(id);
  if (activeEncounter?.kind === 'resident' && !residentById.has(activeEncounter.id) && $('#encounter-dialog').open) closeDialog($('#encounter-dialog'));
  scene?.setResidents(residents);
  if (nearby?.kind === 'resident' && !residentById.has(nearby.id)) updateNearby(null);
}
function interactNearby() {
  if (!canWalk()) return;
  const target = scene?.interactNearby();
  if (!target) return;
  if (target.kind === 'dock') { openFerry(); return; }
  if (target.kind === 'person' && !encounterById.has(target.id)) return;
  if (target.kind === 'resident' && !residentById.has(target.id)) return;
  if (target.kind === 'place') { visitPlace(target.id); return; }
  if (!progress.visited.includes(target.districtId)) { progress.visited.push(target.districtId); save(); syncProgress(); }
  if (target.kind === 'person') { meetColleague(target.id); return; }
  renderEncounter(target); openDialog($('#encounter-dialog'));
}
function browse({ reset = true } = {}) {
  activeId = null;
  focusedPlaceId = null;
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
  const back = button('detail-back', '← 回到園區導覽', () => { stopTour(); browse(); $('#search').focus({ preventScroll: true }); });
  const hero = element('div', 'detail-hero');
  hero.dataset.number = d.number;
  hero.style.setProperty('--district-tint', `${d.color}35`);
  const title = element('h2', '', d.name); title.id = 'detail-title'; title.tabIndex = -1;
  const tags = element('div', 'detail-tags'); d.tags.forEach(t => tags.append(element('span', '', t)));
  hero.append(element('span', 'eyebrow', `${d.number} / ${d.kicker}`), title, tags);
  const units = element('section', 'district-places');
  const unitHeading = element('h3', 'places-heading', d.category === 'department' ? '走進各個部門' : d.category === 'shared' ? '一起使用的空間' : d.category === 'special' ? '在這裡，把事情處理完' : '今晚，想怎麼過？');
  units.append(unitHeading, element('p', 'places-description', '點選場所探索故事，也可以在地圖上找入口。'));
  for (const [index, place] of placesByDistrict.get(d.id).entries()) {
    const card = button('place-card', '', () => visitPlace(place.id));
    card.dataset.visitPlace = place.id;
    const copy = element('span', 'place-copy');
    copy.append(element('strong', '', place.name), element('span', '', place.summary));
    card.append(element('span', 'place-number', `${d.number}.${index + 1}`), copy, element('span', 'place-arrow', placeVisits.has(place.id) ? '✓' : '↗'));
    units.append(card);
  }
  const people = element('div', 'people-list'); people.id = 'detail-people';
  const peopleTitle = element('h3', 'people-title', '此刻，在這個園區'); peopleTitle.id = 'detail-people-title';
  const story = element('section', 'story-card');
  story.append(element('span', 'eyebrow', 'A LITTLE ISLAND STORY'), element('h3', '', d.story.title), element('p', 'story-opening', d.story.opening));
  const choice = districtChoices.get(d.id);
  if (Number.isInteger(choice)) {
    const response = element('div', 'story-response'); response.tabIndex = -1; response.id = 'story-response';
    response.append(element('b', '', `你說：${d.story.choices[choice].label}`), element('p', '', d.story.choices[choice].response), element('small', '', '這段日常，已經成為你的島上回憶。'));
    story.append(response, button('story-again', '再試另一種回話', () => {
      districtChoices.delete(d.id); renderDetail(d);
      $('#detail-panel .story-choices button').focus({ preventScroll: true });
    }));
  } else {
    const choices = element('div', 'story-choices');
    d.story.choices.forEach((c, index) => {
      const option = button('', '', () => {
        districtChoices.set(d.id, index); renderDetail(d);
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
  detail.append(back, hero, element('p', 'detail-summary', d.summary), units, peopleTitle, people, story, element('h3', 'related-title', '順路，再去看看'), related, element('p', 'detail-stamp', `✓ ${d.number} 號島章已蓋進小島護照`));
  renderDistrictPeople();
}
function selectDistrict(id, { touring = false, moveFocus = true } = {}) {
  const d = byId.get(id); if (!d) return;
  if (!requireRegion(getRegionForDistrict(id), () => selectDistrict(id, { touring, moveFocus }))) return;
  if (roaming) setRoaming(false);
  if (!touring) stopTour();
  activeId = id;
  focusedPlaceId = null;
  const firstVisit = !progress.visited.includes(id);
  if (firstVisit) { progress.visited.push(id); save(); }
  $('#browse-panel').hidden = true; $('#detail-panel').hidden = false;
  document.body.classList.add('exploring');
  renderDetail(d); syncProgress();
  scene?.focus(id);
  $('#island-sidebar').scrollTop = 0;
  if (!touring || !mobile.matches) setSidebar(true);
  history.replaceState(null, '', `#${id}`);
  if (firstVisit) toast(progress.visited.length === DISTRICTS.length ? '所有島章集齊了。今天的小島，多了幾段故事。' : `已抵達 ${d.name} · 收下一枚島章`);
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
  const routine = getIslandRoutine(hour);
  if (routine.phase === 'mystery' && !dispositionOf(MYSTERY_TRIP.hostId) && lastRoutinePhase && lastRoutinePhase !== 'mystery') toast('阿良揪團了：到夜色碼頭集合，一起走一段！');
  lastRoutinePhase = routine.phase;
  const minutes = Math.floor(hour * 60 + 1e-6), h = Math.floor(minutes / 60), m = minutes % 60;
  $('#time-output').textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  $('#time-range').value = hour;
  const night = hour >= 19;
  const evening = hour >= 17 && !night;
  const morning = hour < 10;
  const icon = night ? '☾' : evening ? '◒' : '☀';
  $('#time-icon').textContent = icon; $('#weather-icon').textContent = icon;
  $('#time-name').textContent = night ? '晚安小島' : evening ? '收工時分' : morning ? '早安小島' : '午間小島';
  $('#weather-label').textContent = night ? '月亮已經打卡下班' : evening ? '夕陽準時，會議不一定' : '晴時偶有會議';
  // Follow the scene's sun arc for readable text over dawn/dusk water.
  const dimSea = Math.sin((hour - 6) / 12 * Math.PI) < .28;
  document.body.classList.toggle('night', dimSea);
  scene?.setHour(hour);
  renderLifeStatus();
  if (!lifeAvailable) renderList();
  document.querySelectorAll('[data-time-preset]').forEach(node => node.setAttribute('aria-pressed', String(Math.abs(Number(node.dataset.timePreset) - hour) < .04)));
}
function showTour(index) {
  const destination = TOUR[index]; if (!destination) return;
  if (!requireRegion(getRegionForDistrict(destination.districtId), () => showTour(index))) return;
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
  const memories = districtChoices.size + placeChoices.size;
  $('#passport-message').textContent = progress.visited.length === DISTRICTS.length
    ? `十二個園區都留下了你的足跡。本次探索 ${placeVisits.size} / ${PLACES.length} 個場所，收下 ${memories} 段新日常。`
    : `已踏訪 ${progress.visited.length} / ${DISTRICTS.length} 個園區。本次探索 ${placeVisits.size} / ${PLACES.length} 個場所，收下 ${memories} 段新日常。`;
}
function openDialog(dialog) { lastFocus = document.activeElement; dialog.showModal(); updateWalking(); }
function restoreDialogFocus() {
  if (roaming) $('#scene canvas')?.focus({ preventScroll: true });
  else if (lastFocus?.isConnected && lastFocus !== document.body && !lastFocus.closest('[hidden]') && lastFocus.getClientRects().length) lastFocus.focus({ preventScroll: true });
  else if (activeId) $('#detail-title')?.focus({ preventScroll: true });
}
function closeDialog(dialog) {
  if (dialog === $('#pvp-dialog') && activePvp) {
    if (activePvp.handle && !activePvp.handle.requestExit()) return false;
    disposePvp();
  }
  if (dialog === $('#encounter-dialog') && activeBrawl) {
    if (activeBrawl.handle && !activeBrawl.handle.requestExit()) return false;
    disposeBrawl();
  }
  dialog.close(); updateWalking(); restoreDialogFocus(); return true;
}

walkControls = bindWalkControls({ pad: $('#walk-pad'), canMove: canWalk, onMove: input => scene?.setMoveInput(input), onInteract: interactNearby, onHome: () => setRoaming(false) });
$('#ferry-open').addEventListener('click', () => openFerry());
$('#challenge-open').addEventListener('click', openChallenge);
$('#pvp-open').addEventListener('click', () => openPvp());
window.addEventListener('storage', () => { challenge.sync(); syncChallenge(); });
$('#roam-toggle').addEventListener('click', () => setRoaming(!roaming));
$('#interact-button').addEventListener('click', interactNearby);
$('#encounter-leave').addEventListener('click', () => closeDialog($('#encounter-dialog')));
$('#cast-open').addEventListener('click', () => { stopTour(); renderCastDirectory(); openDialog($('#cast-dialog')); });
$('#cast-search').addEventListener('input', renderCastDirectory);
$('#cast-total').textContent = String(ISLAND_CAST.length);

$('#search').addEventListener('input', renderList);
document.querySelectorAll('[data-zone-filter]').forEach(node => node.addEventListener('click', () => {
  zoneFilter = node.dataset.zoneFilter;
  document.querySelectorAll('[data-zone-filter]').forEach(other => other.setAttribute('aria-pressed', String(other === node)));
  renderList();
}));
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
function updatePause() { scene?.setPaused(paused || !!activePvp); $('#pause-toggle').setAttribute('aria-pressed', String(paused)); $('#pause-label').textContent = paused ? '播放' : '暫停'; renderLifeStatus(); }
$('#pause-toggle').addEventListener('click', () => { paused = !paused; updatePause(); });
$('#time-range').addEventListener('input', event => { stopTour(); clockRunning = false; setHour(event.target.value); });
document.querySelectorAll('[data-time-preset]').forEach(node => node.addEventListener('click', () => { stopTour(); clockRunning = false; setHour(Number(node.dataset.timePreset)); }));
$('#time-flow').addEventListener('click', () => {
  if (paused) { clockRunning = true; paused = false; updatePause(); } else clockRunning = !clockRunning;
  renderRoutineStatus();
});
$('#mystery-open').addEventListener('click', openMysteryInvitation);
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
  dialog.addEventListener('cancel', event => {
    if (dialog === $('#pvp-dialog') && activePvp) {
      if (activePvp.handle && !activePvp.handle.requestExit()) { event.preventDefault(); return; }
      disposePvp(); return;
    }
    if (dialog !== $('#encounter-dialog') || !activeBrawl) return;
    if (activeBrawl.handle && !activeBrawl.handle.requestExit()) { event.preventDefault(); return; }
    disposeBrawl();
  });
  dialog.addEventListener('close', () => {
    if (dialog === $('#pvp-dialog') && activePvp) disposePvp();
    if (dialog === $('#encounter-dialog') && activeBrawl) disposeBrawl();
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
window.addEventListener('hashchange', () => {
  if (activePvp) { history.replaceState(null, '', location.pathname + location.search + activePvp.returnHash); return; }
  if (activeVoyage) { history.replaceState(null, '', location.pathname + location.search + (activeId ? `#${activeId}` : '')); return; }
  const id = location.hash.slice(1);
  if ($('#encounter-dialog').open && closeDialog($('#encounter-dialog')) === false) {
    history.replaceState(null, '', location.pathname + location.search + activeBrawl.returnHash); return;
  }
  if (PLACE_BY_ID.has(id)) visitPlace(id);
  else if (byId.has(id)) selectDistrict(id); else browse();
});
let lastClockTick = performance.now();
const clockTimer = setInterval(() => {
  const now = performance.now(), seconds = Math.min(1, Math.max(0, (now - lastClockTick) / 1000)); lastClockTick = now;
  if (!clockRunning || paused || reducedMotion.matches || activeVoyage || document.hidden || tourIndex >= 0 || document.querySelector('dialog[open]')) return;
  setHour(6 + ((hour - 6 + seconds / 240) % 17));
}, 1000);
window.addEventListener('pagehide', () => { pageGone = true; activeVoyage = null; pendingTravel = null; disposePvp({ preserveInvite: true }); disposeBrawl(); clearInterval(clockTimer); walkControls.destroy(); scene?.destroy(); }, { once: true });
// A bfcache restoration needs a fresh renderer after pagehide teardown.
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });

const adminSummary = createIslandAdminSummary({ badge: $('#island-admin-pending') });
const applications = bindApplications({ storage, openDialog, closeDialog, onResidents: updateResidents, onMeet: meetResident, stopTour, onChange: () => { void adminSummary.refresh(); } });
renderList(); syncProgress(); syncRegion(); syncChallenge(); renderConflictStatus(); updatePause(); setHour(hour); setSidebar(!mobile.matches);
// Test storage availability without touching the career game's keys.
save();
const initialId = location.hash.slice(1);
if (byId.has(initialId)) selectDistrict(initialId, { moveFocus: false });
else if (PLACE_BY_ID.has(initialId)) visitPlace(initialId);
const inviteCode = new URLSearchParams(location.search).get('duel');
if (inviteCode) void openPvp(inviteCode.slice(0, 64));
try {
  const { createIslandScene } = await import('./scene.js');
  scene = await createIslandScene({ container: $('#scene'), initialHour: hour, districts: DISTRICTS, onSelect: id => roaming ? interactNearby() : selectDistrict(id), onSelectPlace: visitPlace, onSelectDock: regionId => { if (regionId === currentRegion) openFerry(); }, onNearby: updateNearby, onRoamChange: syncRoaming, onLifeUpdate: updateIslandLife });
  sceneReady = true;
  if ($('#ferry-dialog').open) renderFerry();
  scene.setResidents(applications.getResidents());
  scene.setDispositions?.(conflictState.people);
  $('#loading').hidden = true;
  $('#roam-toggle').disabled = false;
  setHour(hour); updatePause(); updateWalking(); scene.setConnections(connections); scene.setTopView(topView);
  if (focusedPlaceId) scene.focusPlace(focusedPlaceId);
  else if (activeId) scene.focus(activeId);
  syncProgress();
  $('#scene').addEventListener('webglcontextlost', () => {
    syncRoaming(false); $('#roam-toggle').disabled = true; $('#explore-start').disabled = true;
    $('#map-fallback').hidden = false;
    sceneUnavailable = true; lifeAvailable = false; renderLifeStatus();
    toast('地圖暫時休息中，仍可從清單探索。');
  }, true);
} catch (error) {
  sceneReady = true;
  sceneUnavailable = true; lifeAvailable = false; renderLifeStatus();
  if ($('#ferry-dialog').open) renderFerry();
  $('#loading').hidden = true; $('#map-fallback').hidden = false;
  $('#roam-toggle').disabled = true; $('#explore-start').disabled = true;
  document.querySelectorAll('.map-controls button,.zoom-controls button').forEach(node => { node.disabled = true; });
  console.warn('Island map unavailable:', error instanceof Error ? error.message : 'renderer initialization failed');
}
