import { DISTRICTS, TOUR } from './content.js';
import { readProgress, writeProgress } from './progress.js';
import { displayPersona } from '../persona.js';
import { ENCOUNTERS } from './encounters.js';
import { bindWalkControls } from './walk-controls.js';
import { bindApplications, residentAvatar } from './applications.js';
import { ISLAND_CAST } from './cast.js';
import { createIslandAdminSummary } from './admin-summary.js';
import { PLACES, PLACE_BY_ID } from './places.js';
import { getPersonRoutine, getIslandRoutine, MYSTERY_TRIP } from './routines.js';

const $ = (selector) => document.querySelector(selector);
const byId = new Map(DISTRICTS.map(d => [d.id, d]));
const placesByDistrict = new Map(DISTRICTS.map(d => [d.id, PLACES.filter(place => place.districtId === d.id)]));
const categoryNames = { department: '部門園區', shared: '共享空間', afterwork: '下班生活' };
const personaImage = id => displayPersona(id).image.replace(/^\.\//, '/');
const mobile = matchMedia('(max-width: 780px)');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let storage;
try { storage = window.localStorage; } catch { /* Browsing remains available. */ }
let progress = readProgress(storage);
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
let lifeActors = new Map();
let lifeAvailable = false;
let sceneUnavailable = false;
const encounterById = new Map(ENCOUNTERS.map(item => [item.id, item]));

function currentDistrict(id) {
  return lifeAvailable ? lifeActors.get(`person:${id}`)?.districtId || getPersonRoutine(id, hour)?.districtId
    : getPersonRoutine(id, hour)?.districtId;
}
function peopleInDistrict(id) { return ISLAND_CAST.filter(person => currentDistrict(person.id) === id); }
function personLocation(id) {
  const actor = lifeAvailable ? lifeActors.get(`person:${id}`) : null, routine = getPersonRoutine(id, hour);
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
  $('#progress-label').textContent = `${count} / 9`;
  $('#mobile-progress').textContent = `${count} / 9 已踏訪`;
  $('#progress-bar').style.width = `${count / 9 * 100}%`;
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
  matches.sort((a, b) => ['department', 'shared', 'afterwork'].indexOf(a.category) - ['department', 'shared', 'afterwork'].indexOf(b.category));
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
  return roaming && !sidebarOpen && !document.querySelector('dialog[open]');
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
  if (target.kind === 'resident') {
    const resident = residentById.get(target.id);
    if (!resident) { $('#nearby-prompt').hidden = true; return; }
    $('#nearby-name').textContent = resident.nickname;
    $('#nearby-greeting').textContent = resident.greeting;
    $('#interact-label').textContent = '聊聊';
  } else if (target.kind === 'person') {
    const encounter = encounterById.get(target.id);
    $('#nearby-name').textContent = displayPersona(target.id).name;
    $('#nearby-greeting').textContent = target.id === MYSTERY_TRIP.hostId && getIslandRoutine(hour).trip ? MYSTERY_TRIP.invitation : actorActivity(lifeActors.get(`person:${target.id}`)) || encounter?.greeting;
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
      content.append(element('p', 'encounter-routine', `${personLocation(target.id)} · ${actorActivity(lifeActors.get(`person:${target.id}`))}`));
      if (target.id === MYSTERY_TRIP.hostId) content.append(button('mystery-inline', '聽聽阿良的晚間邀約 →', () => { renderEncounter({ kind: 'routine', id: MYSTERY_TRIP.placeId, districtId: currentDistrict(MYSTERY_TRIP.hostId) }); updateWalking(); $('#encounter-title').tabIndex = -1; $('#encounter-title').focus(); }));
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
      selectDistrict('harbor'); scene?.focusPlace(MYSTERY_TRIP.placeId);
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
  renderEncounter({ kind: 'resident', id: resident.id, districtId: resident.districtId, key: `resident:${resident.id}` });
  openDialog($('#encounter-dialog'));
}
function meetColleague(id) {
  const person = encounterById.get(id);
  if (!person) return;
  stopTour();
  if (id === MYSTERY_TRIP.hostId && getIslandRoutine(hour).trip) { openMysteryInvitation(); return; }
  renderEncounter({ kind: 'person', id, districtId: currentDistrict(id), key: `person:${id}` });
  openDialog($('#encounter-dialog'));
}
function visitPlace(id) {
  const place = PLACE_BY_ID.get(id); if (!place) return;
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
  $('#time-flow').setAttribute('aria-pressed', String(clockRunning));
  $('#time-flow').disabled = reducedMotion.matches;
  $('#time-flow').textContent = reducedMotion.matches ? '減少動態 · 時間已停' : clockRunning && !paused ? '時間流動中 · 暫停' : '時間已停 · 播放';
}
function openMysteryInvitation() {
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
    const activity = element('span', 'cast-activity', actorActivity(lifeActors.get(`person:${id}`)));
    activity.dataset.personActivity = id;
    copy.append(activity);
    const actions = element('div', 'cast-actions');
    const talk = button('', '聊聊 →', () => { closeDialog($('#cast-dialog')); meetColleague(id); });
    talk.setAttribute('aria-label', `和${p.name}聊聊`);
    const locate = button('', '看看位置', () => { closeDialog($('#cast-dialog')); selectDistrict(currentDistrict(id)); scene?.focusPerson(id); });
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
  const unitHeading = element('h3', 'places-heading', d.category === 'department' ? '走進各個部門' : d.category === 'shared' ? '一起使用的空間' : '今晚，想怎麼過？');
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
  const routine = getIslandRoutine(hour);
  if (routine.phase === 'mystery' && lastRoutinePhase && lastRoutinePhase !== 'mystery') toast('阿良揪團了：到夜色碼頭集合，一起走一段！');
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
  $('#passport-message').textContent = progress.visited.length === 9
    ? `九個園區都留下了你的足跡。本次探索 ${placeVisits.size} / ${PLACES.length} 個場所，收下 ${memories} 段新日常。`
    : `已踏訪 ${progress.visited.length} / 9 個園區。本次探索 ${placeVisits.size} / ${PLACES.length} 個場所，收下 ${memories} 段新日常。`;
}
function openDialog(dialog) { lastFocus = document.activeElement; dialog.showModal(); updateWalking(); }
function restoreDialogFocus() {
  if (roaming) $('#scene canvas')?.focus({ preventScroll: true });
  else if (lastFocus?.isConnected && lastFocus !== document.body && !lastFocus.closest('[hidden]') && lastFocus.getClientRects().length) lastFocus.focus({ preventScroll: true });
  else if (activeId) $('#detail-title')?.focus({ preventScroll: true });
}
function closeDialog(dialog) { dialog.close(); updateWalking(); restoreDialogFocus(); }

walkControls = bindWalkControls({ pad: $('#walk-pad'), canMove: canWalk, onMove: input => scene?.setMoveInput(input), onInteract: interactNearby, onHome: () => setRoaming(false) });
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
function updatePause() { scene?.setPaused(paused); $('#pause-toggle').setAttribute('aria-pressed', String(paused)); $('#pause-label').textContent = paused ? '播放' : '暫停'; renderLifeStatus(); }
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
window.addEventListener('hashchange', () => {
  const id = location.hash.slice(1);
  if ($('#encounter-dialog').open) closeDialog($('#encounter-dialog'));
  if (PLACE_BY_ID.has(id)) visitPlace(id);
  else if (byId.has(id)) selectDistrict(id); else browse();
});
let lastClockTick = performance.now();
const clockTimer = setInterval(() => {
  const now = performance.now(), seconds = Math.min(1, Math.max(0, (now - lastClockTick) / 1000)); lastClockTick = now;
  if (!clockRunning || paused || reducedMotion.matches || document.hidden || tourIndex >= 0 || document.querySelector('dialog[open]')) return;
  setHour(6 + ((hour - 6 + seconds / 240) % 17));
}, 1000);
window.addEventListener('pagehide', () => { clearInterval(clockTimer); walkControls.destroy(); scene?.destroy(); }, { once: true });
// A bfcache restoration needs a fresh renderer after pagehide teardown.
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });

const adminSummary = createIslandAdminSummary({ badge: $('#island-admin-pending') });
const applications = bindApplications({ storage, openDialog, closeDialog, onResidents: updateResidents, onMeet: meetResident, stopTour, onChange: () => { void adminSummary.refresh(); } });
renderList(); syncProgress(); updatePause(); setHour(hour); setSidebar(!mobile.matches);
// Test storage availability without touching the career game's keys.
save();
const initialId = location.hash.slice(1);
if (byId.has(initialId)) selectDistrict(initialId, { moveFocus: false });
else if (PLACE_BY_ID.has(initialId)) visitPlace(initialId);
try {
  const { createIslandScene } = await import('./scene.js');
  scene = await createIslandScene({ container: $('#scene'), initialHour: hour, districts: DISTRICTS, onSelect: id => roaming ? interactNearby() : selectDistrict(id), onSelectPlace: visitPlace, onNearby: updateNearby, onRoamChange: syncRoaming, onLifeUpdate: updateIslandLife });
  scene.setResidents(applications.getResidents());
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
  sceneUnavailable = true; lifeAvailable = false; renderLifeStatus();
  $('#loading').hidden = true; $('#map-fallback').hidden = false;
  $('#roam-toggle').disabled = true; $('#explore-start').disabled = true;
  document.querySelectorAll('.map-controls button,.zoom-controls button').forEach(node => { node.disabled = true; });
  console.warn('Island map unavailable:', error instanceof Error ? error.message : 'renderer initialization failed');
}
