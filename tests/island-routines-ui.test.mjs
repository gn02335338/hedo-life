import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { DISTRICTS, TOUR } from '../dist/island/content.js';
import { PLACES, PLACE_BY_ID } from '../dist/island/places.js';
import { ISLAND_CAST } from '../dist/island/cast.js';
import { ENCOUNTERS } from '../dist/island/encounters.js';
import { displayIslandPersona, displayIslandPersona as displayPersona } from '../dist/island/persona.js';
import { readProgress, writeProgress } from '../dist/island/progress.js';
import * as routines from '../dist/island/routines.js';
import { createIslandConflicts } from '../dist/island/conflicts.js';
import { createIslandChallenge, CHALLENGE_STORAGE_KEY } from '../dist/island/challenge.js';
import { getRegionForDistrict, REGIONS, DOCKS } from '../dist/island/archipelago.js';
import { ONEIRA_PORT, getOneiraArrival } from '../dist/island/friend-islands.js';

// Execute the real app controller against a small DOM, replacing only renderer,
// network and timers. This exercises user-visible controls and event handlers;
// schedule changes must not quietly put destination labels over old locations.
class Surface {
  listeners = new Map();
  addEventListener(type, callback) { const list = this.listeners.get(type) || []; list.push(callback); this.listeners.set(type, list); }
  removeEventListener(type, callback) { this.listeners.set(type, (this.listeners.get(type) || []).filter(item => item !== callback)); }
  async dispatch(type, extra = {}) { for (const callback of this.listeners.get(type) || []) await callback({ target: this, preventDefault() {}, ...extra }); }
}
const camel = text => text.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
function matches(node, selector) {
  if (!node.tagName || node.tagName === '#text') return false;
  const attributes = [...selector.matchAll(/\[([^\]=]+)(?:=["']?([^\]"']*)["']?)?\]/g)];
  let rest = selector.replace(/\[[^\]]*\]/g, '');
  if (rest.includes(':')) throw new Error(`Unsupported DOM selector ${selector}`);
  const id = rest.match(/#([\w-]+)/)?.[1];
  if (id && node.id !== id) return false;
  const classes = [...rest.matchAll(/\.([\w-]+)/g)].map(match => match[1]);
  if (classes.some(name => !node.classList.contains(name))) return false;
  const tag = rest.replace(/[#.][\w-]+/g, '');
  if (tag && tag !== '*' && node.tagName !== tag.toLowerCase()) return false;
  return attributes.every(([, name, value]) => {
    const actual = node.getAttribute(name);
    return value === undefined ? actual !== null : actual === value;
  });
}
function query(root, selector) {
  const selectors = selector.split(',').map(item => item.trim());
  const descendants = root.children.flatMap(node => [node, ...node.descendants()]);
  return descendants.filter(node => selectors.some(item => {
    const parts = item.split(/\s+/);
    if (!matches(node, parts.pop())) return false;
    let ancestor = node.parentElement;
    while (parts.length) {
      const wanted = parts.pop();
      while (ancestor && !matches(ancestor, wanted)) ancestor = ancestor.parentElement;
      if (!ancestor) return false;
      ancestor = ancestor.parentElement;
    }
    return true;
  }));
}
class Element extends Surface {
  constructor(tag, document) {
    super(); this.tagName = tag; this.ownerDocument = document; this.children = []; this.dataset = {}; this.attributes = new Map();
    this.value = ''; this.hidden = false; this.open = false; this.disabled = false; this.style = { setProperty() {} };
    this.classList = {
      contains: name => this.className.split(/\s+/).includes(name),
      add: (...names) => { this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), ...names])].join(' '); },
      remove: (...names) => { this.className = this.className.split(/\s+/).filter(name => !names.includes(name)).join(' '); },
      toggle: (name, force) => { const next = force ?? !this.classList.contains(name); next ? this.classList.add(name) : this.classList.remove(name); return next; },
    };
    this.className = '';
  }
  descendants() { return this.children.flatMap(node => [node, ...node.descendants()]); }
  append(...nodes) { for (const item of nodes) { const node = typeof item === 'string' ? this.ownerDocument.createTextNode(item) : item; node.parentElement = this; this.children.push(node); } }
  replaceChildren(...nodes) { for (const node of this.children) node.parentElement = null; this.children = []; this.append(...nodes); }
  get firstElementChild() { return this.children.find(node => node.tagName !== '#text') || null; }
  get lastElementChild() { return this.children.findLast(node => node.tagName !== '#text') || null; }
  set textContent(value) { this.replaceChildren(); this.text = String(value ?? ''); }
  get textContent() { return (this.text || '') + this.children.map(node => node.textContent).join(''); }
  get innerText() { return this.textContent; }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name.startsWith('data-')) this.dataset[camel(name.slice(5))] = String(value);
    else if (name === 'class') this.className = String(value);
    else if (['hidden', 'open', 'disabled'].includes(name)) this[name] = true;
    else if (name === 'id' || name === 'value') this[name] = String(value);
  }
  removeAttribute(name) { this.attributes.delete(name); if (['hidden', 'open', 'disabled'].includes(name)) this[name] = false; }
  getAttribute(name) {
    if (name.startsWith('data-')) { const value = this.dataset[camel(name.slice(5))]; return value === undefined ? null : String(value); }
    if (['hidden', 'open', 'disabled'].includes(name)) return this[name] ? '' : null;
    if (name === 'class') return this.className || null;
    if (name === 'id') return this.id ?? null;
    return this.attributes.get(name) ?? null;
  }
  querySelectorAll(selector) { return query(this, selector); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  closest(selector) { for (let node = this; node; node = node.parentElement) if (matches(node, selector)) return node; return null; }
  contains(node) { return node === this || this.descendants().includes(node); }
  get isConnected() { return this === this.ownerDocument.root || Boolean(this.parentElement?.isConnected); }
  focus() { this.ownerDocument.activeElement = this; }
  scrollIntoView() {}
  getClientRects() { return this.closest('[hidden]') ? [] : [{}]; }
  getBoundingClientRect() { return { x: 0, y: 0, left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 }; }
  showModal() { this.open = true; this.querySelector('button')?.focus(); }
  close() { this.open = false; void this.dispatch('close'); }
}
function makeDocument(html) {
  const document = new Surface();
  document.createElement = tag => new Element(tag, document);
  document.createElementNS = (namespace, tag) => { const node = document.createElement(tag); node.namespaceURI = namespace; return node; };
  document.createTextNode = text => { const node = document.createElement('#text'); node.text = text; return node; };
  document.root = document.createElement('root');
  document.querySelectorAll = selector => query(document.root, selector);
  document.querySelector = selector => {
    const found = document.querySelectorAll(selector)[0];
    if (found || !/^#[\w-]+$/.test(selector)) return found || null;
    // New controller panels can be exercised before the page's HTML lands.
    // Only root ID lookups are stubbed; missing dynamic controls stay missing.
    const node = document.createElement('div'); node.id = selector.slice(1);
    (document.body || document.root).append(node); return node;
  };
  const stack = [document.root], voids = new Set(['meta', 'link', 'input', 'img', 'br', 'hr']);
  for (const token of html.matchAll(/<!--[\s\S]*?-->|<![^>]*>|<\/?[^>]+>|[^<]+/g)) {
    const text = token[0];
    if (text.startsWith('<!')) continue;
    if (text.startsWith('</')) { stack.pop(); continue; }
    if (!text.startsWith('<')) { stack.at(-1).append(document.createTextNode(text)); continue; }
    const tag = text.match(/^<([\w-]+)/)[1].toLowerCase(), node = document.createElement(tag);
    for (const attr of text.slice(tag.length + 1, -1).matchAll(/([^\s=/>]+)(?:="([^"]*)"|='([^']*)'|=([^\s>]+))?/g)) node.setAttribute(attr[1], attr[2] ?? attr[3] ?? attr[4] ?? '');
    stack.at(-1).append(node);
    if (!voids.has(tag) && !text.endsWith('/>')) stack.push(node);
  }
  document.body = document.querySelector('body'); document.activeElement = document.body;
  document.hidden = false; document.visibilityState = 'visible';
  return document;
}
async function fixture({ fallback = false, reducedMotion = false, conflictRandom = () => .01, brawlFails = false, brawlDeferred = false,
  challengeProgress, initialHash = '', initialSearch = '', sailDeferred = false, sailFails = false, pvpDeferred = false, pvpFails = false } = {}) {
  const [source, html] = await Promise.all(['app.js', 'index.html'].map(name => readFile(new URL(`../dist/island/${name}`, import.meta.url), 'utf8')));
  const document = makeDocument(html), window = new Surface(), calls = [], timers = new Map(); let nextTimer = 0, onLifeUpdate, onSelectDock, now = 0;
  const bytes = new Map([['hedo-island-v1', JSON.stringify({ version: 1, visited: ['lobby'], choices: { lobby: 2 } })], ['hedo-anonymous-v1', 'TEST_IDENTITY'], ['hedo-life-v1', 'UNCHANGED_CAREER']]);
  if (challengeProgress) bytes.set(CHALLENGE_STORAGE_KEY, JSON.stringify(challengeProgress));
  const writes = [], brawls = [], voyages = [], pvps = []; let sceneRegion = 'company';
  let resolveBrawlImport;
  const brawlImportWait = brawlDeferred ? new Promise(resolve => { resolveBrawlImport = resolve; }) : Promise.resolve();
  const mountIslandBrawl = config => {
    if (brawlFails) throw new Error('intentional 2D canvas failure');
    const state = { phase: 'ready', destroyed: 0, pauses: 0, config }; brawls.push(state);
    const title = document.createElement('h2'); title.id = 'encounter-title'; title.textContent = '移動島大亂鬥'; config.container.append(title);
    return { getState: () => ({ phase: state.phase }), destroy: () => { state.destroyed++; }, pause: () => { state.phase = 'paused'; state.pauses++; }, requestExit: () => { if (state.phase === 'ready') return true; state.phase = 'paused'; state.pauses++; return false; } };
  };
  let resolvePvpImport;
  const pvpImportWait = pvpDeferred ? new Promise(resolve => { resolvePvpImport = resolve; }) : Promise.resolve();
  const mountIslandPvp = config => {
    if (pvpFails) throw new Error('intentional multiplayer initialization failure');
    const state = { config, destroyed: 0, exitRequests: 0, allowExit: true }; pvps.push(state);
    return { destroy() { state.destroyed++; }, requestExit() { state.exitRequests++; return state.allowExit; } };
  };
  window.localStorage = { getItem: key => bytes.get(key) ?? null, setItem: (key, value) => { writes.push(key); bytes.set(key, value); } };
  const scene = Object.fromEntries(['setResidents', 'setDispositions', 'sendPlayerToPlace', 'setRoaming', 'setHour', 'setPaused', 'setMovementEnabled', 'setConversationTarget', 'setConnections', 'setTopView', 'focus', 'focusPlace', 'focusPerson', 'reset', 'destroy', 'setMoveInput', 'zoom'].map(method => [method, (...args) => { calls.push({ method, args }); }]));
  scene.getRegion = () => sceneRegion;
  scene.focusRegion = (...args) => { calls.push({ method: 'focusRegion', args }); };
  scene.sailToRegion = (regionId, options = {}) => {
    calls.push({ method: 'sailToRegion', args: [regionId, options] });
    return new Promise((resolve, reject) => {
      const voyage = { regionId, options, settled: false,
        settle(success) { if (this.settled) return; this.settled = true; if (success) { sceneRegion = regionId; options.onProgress?.(1); } resolve(success); },
        reject() { if (this.settled) return; this.settled = true; reject(new Error('intentional interrupted sailing')); } };
      voyages.push(voyage); options.onProgress?.(0);
      if (!sailDeferred) voyage.settle(!sailFails);
    });
  };
  scene.destroy = () => { calls.push({ method: 'destroy', args: [] }); for (const voyage of voyages) voyage.settle(false); };
  const createIslandScene = async config => { if (fallback) throw new Error('intentional renderer unavailable'); onLifeUpdate = config.onLifeUpdate; onSelectDock = config.onSelectDock; sceneRegion = config.initialRegion || 'company'; calls.push({ method: 'initialRegion', args: [sceneRegion] }); document.querySelector('#scene').append(document.createElement('canvas')); return scene; };
  const media = query => Object.assign(new Surface(), { matches: query.includes('reduced-motion') && reducedMotion });
  const location = { pathname: '/island/', search: initialSearch, hash: initialHash, reload() {} };
  const history = { replaceState: (_state, _unused, path) => { const url = new URL(path, 'https://island.test' + location.pathname + location.search + location.hash); location.search = url.search; location.hash = url.hash; } };
  const context = vm.createContext({
    createIslandConflicts: () => createIslandConflicts({ random: conflictRandom }),
    ...routines, DISTRICTS, TOUR, PLACES, PLACE_BY_ID, ISLAND_CAST, ENCOUNTERS, displayPersona, displayIslandPersona, readProgress, writeProgress,
    createIslandChallenge, getRegionForDistrict, REGIONS, DOCKS, ONEIRA_PORT, getOneiraArrival,
    document, window, URLSearchParams, matchMedia: media, history, location, createIslandScene, mountIslandBrawl, brawlImportWait, mountIslandPvp, pvpImportWait,
    bindWalkControls: () => ({ clear() {}, destroy() {} }), bindApplications: () => ({ getResidents: () => [] }),
    createIslandAdminSummary: () => ({ refresh: async () => {} }), residentAvatar: () => document.createElement('span'),
    console: { warn() {} }, setTimeout: callback => { timers.set(++nextTimer, { kind: 'timeout', callback }); return nextTimer; }, clearTimeout: id => timers.delete(id),
    setInterval: callback => { timers.set(++nextTimer, { kind: 'interval', callback }); return nextTimer; }, clearInterval: id => timers.delete(id),
    performance: { now: () => now }, requestAnimationFrame: callback => { timers.set(++nextTimer, callback); return nextTimer; }, cancelAnimationFrame: id => timers.delete(id),
  });
  const script = source.replace(/^import\s[\s\S]*?;\r?\n/gm, '').replace("const { createIslandScene } = await import('./scene.js');", '').replace("const { mountIslandBrawl } = await import('./brawl-ui.js');", 'await brawlImportWait;').replace("const { mountIslandPvp } = await import('./pvp-ui.js');", 'await pvpImportWait;');
  const api = await new vm.Script(`(async () => { ${script}\n return { setHour, renderCastDirectory, renderDetail, renderEncounter, meetColleague, updateIslandLife, renderLifeStatus, closeDialog, getHour: () => hour, renderConflictMenu, visitPlace, selectDistrict, startBrawl, openChallenge, openFerry, sailTo, openPvp, getPvpActive: () => !!activePvp, getConflictState: () => conflicts.getState(), getChallengeState: () => challenge.getState(), getTravelState: () => ({ currentRegion, pendingTravel, activeVoyage: !!activeVoyage }), getVisited: () => [...progress.visited], getPlaceVisits: () => [...placeVisits] }; })()`, { filename: 'dist/island/app.js' }).runInContext(context);
  return { api, document, window, calls, scene, timers, bytes, writes, brawls, voyages, pvps, location, resolveBrawlImport, resolvePvpImport,
    dock: regionId => onSelectDock(regionId),
    resolveSail: success => voyages.at(-1)?.settle(success), rejectSail: () => voyages.at(-1)?.reject(),
    startBattle: () => { brawls.at(-1).phase = 'playing'; }, finishBattle: (outcome, summary = {}) => brawls.at(-1).config.onFinish(outcome, { duration: 25, maxCombo: 5, damageDealt: 110, damageTaken: 35, specialsUsed: 1, reason: 'knockout', ...summary }), advanceClock: seconds => { now += seconds * 1000; for (const timer of timers.values()) if (timer.kind === 'interval') timer.callback(); }, life: rows => onLifeUpdate?.({ actors: rows }), node: selector => document.querySelector(selector) };
}

test('routine controls retain the legacy island passport, career bytes and anonymous identity', async () => {
  const f = await fixture();
  for (const hour of [10, 12.25, 15.25, 18, 19.25, 19.75, 21, 10]) f.api.setHour(hour);
  assert.equal(f.bytes.get('hedo-life-v1'), 'UNCHANGED_CAREER');
  assert.equal(f.bytes.get('hedo-anonymous-v1'), 'TEST_IDENTITY');
  assert.deepEqual([...f.bytes.keys()].sort(), ['hedo-anonymous-v1', 'hedo-island-v1', 'hedo-life-v1']);
  assert.deepEqual(JSON.parse(f.bytes.get('hedo-island-v1')), { version: 1, visited: ['lobby'], choices: { lobby: 2 } });
  assert.ok(f.writes.every(key => key === 'hedo-island-v1'));
});

const actor = (id, districtId, extra = {}) => ({
  key: `person:${id}`, kind: 'person', id, districtId, position: { x: 0, y: 1.07, z: 0 }, heading: 0,
  state: 'resting', activity: '在附近歇腳', routine: routines.getPersonRoutine(id, 10),
  destinationDistrictId: districtId, destinationPlaceId: ISLAND_CAST.find(person => person.id === id).workplaceId,
  traveling: false, ...extra,
});

test('multiplayer pauses only the island and guards travel, story battles and hashes until an accepted exit', async () => {
  const f = await fixture();
  await f.api.openPvp();
  assert.equal(f.node('#pvp-dialog').open, true);
  assert.equal(f.api.getPvpActive(), true);
  assert.equal(f.calls.filter(call => call.method === 'setPaused').at(-1).args[0], true);
  const visited = f.api.getVisited();
  f.api.selectDistrict('court'); f.api.openFerry(); f.api.openChallenge();
  await f.api.startBrawl('jack', { story: true });
  assert.deepEqual(f.api.getVisited(), visited);
  assert.equal(f.node('#ferry-dialog').open, false);
  assert.equal(f.node('#challenge-dialog').open, false);
  assert.equal(f.brawls.length, 0);
  f.location.hash = '#court'; await f.window.dispatch('hashchange');
  assert.equal(f.location.hash, '');
  f.pvps[0].allowExit = false;
  assert.equal(f.api.closeDialog(f.node('#pvp-dialog')), false);
  assert.equal(f.pvps[0].destroyed, 0);
  let prevented = false;
  await f.node('#pvp-dialog').dispatch('cancel', { preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  f.pvps[0].config.onClose();
  assert.equal(f.api.getPvpActive(), false);
  assert.equal(f.node('#pvp-dialog').open, false);
  assert.equal(f.pvps[0].destroyed, 1);
  assert.equal(f.calls.filter(call => call.method === 'setPaused').at(-1).args[0], false);
  assert.equal(f.api.getChallengeState().wins.length, 0);
  assert.equal(f.api.getConflictState().player.status, 'free');
  assert.equal(f.bytes.get('hedo-anonymous-v1'), 'TEST_IDENTITY');
});

test('invite links prefill the multiplayer UI without changing the passport or anonymous identity', async () => {
  const f = await fixture({ initialSearch: '?duel=ABCD2345' });
  assert.equal(f.node('#pvp-dialog').open, true);
  assert.equal(f.pvps[0].config.inviteCode, 'ABCD2345');
  assert.equal(f.pvps[0].config.storage, f.window.localStorage);
  assert.deepEqual(Array.from(f.api.getVisited()), ['lobby']);
  assert.ok(f.writes.every(key => key === 'hedo-island-v1'));
  assert.equal(f.bytes.get('hedo-anonymous-v1'), 'TEST_IDENTITY');
});

test('closing multiplayer during module loading prevents a late mount, and teardown preserves the pause preference', async () => {
  const f = await fixture({ pvpDeferred: true });
  await f.node('#pause-toggle').dispatch('click');
  const loading = f.api.openPvp();
  assert.equal(f.node('#pvp-dialog').open, true);
  f.api.closeDialog(f.node('#pvp-dialog'));
  f.resolvePvpImport(); await loading;
  assert.equal(f.pvps.length, 0);
  assert.equal(f.calls.filter(call => call.method === 'setPaused').at(-1).args[0], true);
  await f.api.openPvp();
  assert.equal(f.pvps.length, 1);
  await f.window.dispatch('pagehide');
  assert.equal(f.pvps[0].destroyed, 1);
  assert.equal(f.api.getPvpActive(), false);
  assert.equal(f.api.getChallengeState().wins.length, 0);
});

test('failed multiplayer initialization remains closable and cannot interrupt an owned NPC battle', async () => {
  const f = await fixture({ pvpFails: true });
  await f.api.openPvp();
  assert.match(f.node('#pvp-content').textContent, /尚未加入房間/);
  f.api.closeDialog(f.node('#pvp-dialog'));
  await f.api.startBrawl('jack');
  await f.api.openPvp();
  assert.equal(f.node('#pvp-dialog').open, false);
  assert.equal(f.api.getPvpActive(), false);
  assert.equal(f.brawls.length, 1);
});

test('only the owned multiplayer room updates the public invite URL, which survives reload but clears on normal exit', async () => {
  const f = await fixture({ initialSearch: '?view=island', initialHash: '#lab' });
  await f.api.openPvp();
  const old = f.pvps[0];
  old.config.onStatus({ roomCode: 'ABCD2345', phase: 'waiting' });
  assert.equal(f.location.search, '?view=island&duel=ABCD2345');
  assert.equal(f.location.hash, '#lab');
  f.api.closeDialog(f.node('#pvp-dialog'));
  assert.equal(f.location.search, '?view=island');
  await f.api.openPvp();
  old.config.onStatus({ roomCode: 'ZZZZ9999' }); old.config.onClose();
  assert.equal(f.api.getPvpActive(), true);
  assert.equal(f.location.search, '?view=island');
  f.pvps[1].config.onStatus({ roomCode: 'WXYZ7890', phase: 'playing' });
  await f.window.dispatch('pagehide');
  assert.equal(f.location.search, '?view=island&duel=WXYZ7890');
  assert.equal(f.pvps[1].destroyed, 1);
  assert.equal(f.api.getPvpActive(), false);
});

test('directory tracks the current body while commuting and locates its latest district, not its home or destination', async () => {
  const f = await fixture();
  f.life([actor('kind', 'lab', { state: 'walking', activity: '正前往碼頭', traveling: true, destinationDistrictId: 'harbor', destinationPlaceId: 'aliang-mystery-trip' })]);
  await f.node('#cast-open').dispatch('click');
  const card = f.node('[data-character-id="kind"]');
  assert.ok(card.textContent.includes('創研園區 → 阿良的神秘行程'));
  assert.ok(card.textContent.includes('正前往碼頭'));
  assert.ok(card.textContent.includes('工作據點 · 研發中心'));
  assert.ok(!card.textContent.includes('現在在 · 夜色碼頭'), 'destination is not presented as an already-arrived location');
  // Movement continues while the directory is open. The existing locator must
  // use fresh state when clicked, even though its DOM was created beforehand.
  f.life([actor('kind', 'cafe', { traveling: true, destinationDistrictId: 'harbor', destinationPlaceId: 'aliang-mystery-trip' })]);
  assert.ok(card.textContent.includes('共享生活館 → 阿良的神秘行程'));
  await card.querySelector('[data-locate-person]').dispatch('click');
  assert.equal(f.calls.filter(call => call.method === 'focus').at(-1)?.args[0], 'cafe');
  assert.equal(f.calls.filter(call => call.method === 'focusPerson').at(-1)?.args[0], 'kind');
});

test('district colleagues follow live arrivals and departures without replacing unrelated story content', async () => {
  const f = await fixture();
  f.life([actor('kind', 'lab'), actor('wing', 'lobby')]);
  await f.node('[data-district-link="lab"]').dispatch('click');
  assert.ok(f.node('#detail-people').querySelector('[data-person-id="kind"]'));
  const story = f.node('.story-card');
  f.life([actor('kind', 'harbor'), actor('wing', 'lab')]);
  assert.equal(f.node('#detail-people').querySelector('[data-person-id="kind"]'), null);
  assert.ok(f.node('#detail-people').querySelector('[data-person-id="wing"]'));
  assert.equal(f.node('.story-card'), story, 'routine updates do not recreate the open district story or choice controls');
});

test('Aliang invitation has a separate response memory and pins the host while the player reads it', async () => {
  const f = await fixture();
  f.api.setHour(10);
  f.life([actor('kind', 'lab')]);
  f.api.meetColleague('kind');
  const ordinary = ENCOUNTERS.find(person => person.id === 'kind');
  await f.node('[data-encounter-choice="0"]').dispatch('click');
  assert.ok(f.node('#encounter-content').textContent.includes(ordinary.choices[0].response));
  f.api.closeDialog(f.node('#encounter-dialog'));
  await f.node('#mystery-open').dispatch('click');
  assert.equal(f.node('#encounter-title').textContent, routines.MYSTERY_TRIP.story.title);
  const before = f.node('#encounter-content').textContent;
  for (const choice of routines.MYSTERY_TRIP.story.choices) assert.ok(!before.includes(choice.response), 'future invitation outcomes stay hidden');
  assert.ok(!before.includes(ordinary.choices[0].response), 'an ordinary colleague choice cannot answer the invitation');
  assert.deepEqual(JSON.parse(JSON.stringify(f.calls.filter(call => call.method === 'setConversationTarget').at(-1).args[0])), { kind: 'person', id: 'kind' });
  await f.node('[data-encounter-choice="1"]').dispatch('click');
  const after = f.node('#encounter-content').textContent;
  assert.ok(after.includes(routines.MYSTERY_TRIP.story.choices[1].response));
  assert.ok(!after.includes(routines.MYSTERY_TRIP.story.choices[0].response));
  assert.ok(!after.includes(routines.MYSTERY_TRIP.story.choices[2].response));
  f.api.closeDialog(f.node('#encounter-dialog'));
  f.api.meetColleague('kind');
  assert.ok(f.node('#encounter-content').textContent.includes(ordinary.choices[0].response), 'ordinary response survives independently');
});

test('manual time presets pause the clock, while visible playback advances without hidden-tab catch-up', async () => {
  const f = await fixture();
  const initial = f.api.getHour(); f.advanceClock(1);
  assert.ok(Math.abs(f.api.getHour() - initial - 1 / 240) < 1e-10);
  await f.node('[data-time-preset="19.25"]').dispatch('click');
  assert.equal(f.api.getHour(), 19.25);
  assert.match(f.node('#island-routine-title').textContent, /阿良/);
  f.advanceClock(1); assert.equal(f.api.getHour(), 19.25, 'chosen preview time stays put');
  await f.node('#time-flow').dispatch('click');
  f.document.hidden = true; f.advanceClock(3600); assert.equal(f.api.getHour(), 19.25);
  f.document.hidden = false; f.advanceClock(1);
  assert.ok(Math.abs(f.api.getHour() - 19.25 - 1 / 240) < 1e-10, 'returning advances one tick rather than the hidden hour');
  await f.node('#mystery-open').dispatch('click'); const readingHour = f.api.getHour();
  f.advanceClock(1); assert.equal(f.api.getHour(), readingHour, 'reading a story holds the current time');
});

test('fallback and reduced motion retain schedules and invitation choices without claiming live positions', async () => {
  const f = await fixture({ fallback: true, reducedMotion: true });
  await f.node('[data-time-preset="18"]').dispatch('click');
  await f.node('#cast-open').dispatch('click');
  assert.ok(f.node('[data-character-id="kind"]').textContent.includes('今日行程 · 居酒屋'));
  assert.ok(!f.node('[data-character-id="kind"]').textContent.includes('現在在 ·'));
  f.api.closeDialog(f.node('#cast-dialog'));
  await f.node('#mystery-open').dispatch('click');
  assert.equal(f.node('#ferry-dialog').open, true);
  await f.node('[data-sail-region="life"]').dispatch('click');
  assert.equal(f.node('#encounter-title').textContent, routines.MYSTERY_TRIP.story.title);
  assert.equal(f.document.querySelectorAll('[data-encounter-choice]').length, 3);
  const hour = f.api.getHour(); f.advanceClock(1); assert.equal(f.api.getHour(), hour);
});

test('open name searches and location filters refresh when a colleague changes districts', async () => {
  const f = await fixture();
  f.life([actor('kind', 'lab')]);
  f.node('#search').value = displayPersona('kind').name;
  await f.node('#search').dispatch('input');
  assert.ok(f.node('[data-district-link="lab"]'));
  await f.node('#cast-open').dispatch('click');
  f.node('#cast-search').value = '創研園區'; await f.node('#cast-search').dispatch('input');
  assert.ok(f.node('[data-character-id="kind"]'));
  f.life([actor('kind', 'harbor')]);
  assert.equal(f.node('[data-district-link="lab"]'), null);
  assert.ok(f.node('[data-district-link="harbor"]'));
  assert.equal(f.node('[data-character-id="kind"]'), null, 'a location-filtered directory loses a departed colleague');
});

test('one clock-play click resumes a global pause and starts time again', async () => {
  const f = await fixture();
  await f.node('#pause-toggle').dispatch('click');
  const pausedHour = f.api.getHour(); f.advanceClock(1);
  assert.equal(f.api.getHour(), pausedHour);
  assert.equal(f.node('#pause-toggle').getAttribute('aria-pressed'), 'true');
  await f.node('#time-flow').dispatch('click');
  assert.equal(f.node('#pause-toggle').getAttribute('aria-pressed'), 'false');
  assert.equal(f.calls.filter(call => call.method === 'setPaused').at(-1).args[0], false);
  f.advanceClock(1);
  assert.ok(Math.abs(f.api.getHour() - pausedHour - 1 / 240) < 1e-10);
});

test('a lost WebGL context switches stale live destinations to the selected schedule without changing identity', async () => {
  const f = await fixture();
  f.life([actor('kind', 'lab', { destinationPlaceId: 'research-center' })]);
  const identity = f.bytes.get('hedo-anonymous-v1'), career = f.bytes.get('hedo-life-v1');
  const passport = f.bytes.get('hedo-island-v1'), keys = [...f.bytes.keys()].sort();
  await f.node('#scene').dispatch('webglcontextlost');
  f.api.setHour(18);
  await f.node('#cast-open').dispatch('click');
  const card = f.node('[data-character-id="kind"]');
  assert.ok(card.textContent.includes('今日行程 · 居酒屋'));
  assert.ok(!card.textContent.includes('今日行程 · 研發中心'), 'stale renderer destination does not override the fallback schedule');
  assert.ok(!card.textContent.includes('現在在 ·'), 'lost renderer cannot claim a live location');
  assert.equal(f.bytes.get('hedo-anonymous-v1'), identity);
  assert.equal(f.bytes.get('hedo-life-v1'), career);
  assert.equal(f.bytes.get('hedo-island-v1'), passport);
  assert.deepEqual([...f.bytes.keys()].sort(), keys);
});

test('fight choices resolve only after selection, transfer both sides, and recover at the matching facility', async () => {
  for (const [outcome, playerStatus, placeId, otherStatus] of [['win', 'police', 'police-desk', 'hospital'], ['lose', 'hospital', 'hospital-er', 'police']]) {
    const f = await fixture({ conflictRandom: () => { throw new Error('a played fight must never roll a result'); } });
    f.api.meetColleague('jack');
    await f.node('[data-conflict-action="fight"]').dispatch('click');
    assert.equal(f.api.getConflictState().history.length, 0, 'opening a confrontation does not draw a result');
    assert.ok(!f.node('#encounter-content').textContent.includes('打贏了'));
    assert.ok(!f.node('#encounter-content').textContent.includes('先去醫院'));
    f.startBattle(); f.finishBattle(outcome);
    const state = f.api.getConflictState();
    assert.equal(state.player.status, playerStatus);
    assert.equal(state.people[0].status, otherStatus);
    assert.equal(f.node('#island-conflict-panel').dataset.status, playerStatus);
    assert.equal(f.calls.filter(call => call.method === 'sendPlayerToPlace').length, 0, 'a remote consequence does not teleport the player');
    assert.ok(!f.api.getVisited().includes(playerStatus));
    assert.equal(f.calls.filter(call => call.method === 'setDispositions').at(-1).args[0][0].id, 'jack');
    f.api.visitPlace('pantry');
    assert.equal(f.node('[data-conflict-recover]'), null, 'an unrelated facility cannot complete treatment or a police statement');
    await f.node(`[data-conflict-player-place="${placeId}"]`).dispatch('click');
    assert.equal(f.node('#ferry-dialog').open, true);
    await f.node('[data-sail-region="life"]').dispatch('click');
    assert.equal(f.calls.filter(call => call.method === 'sendPlayerToPlace').at(-1).args[0], placeId);
    await f.node('[data-conflict-recover]').dispatch('click');
    assert.equal(f.api.getConflictState().player.status, 'free');
    assert.equal(f.api.getConflictState().people.length, 1, 'the opponent is not implicitly released');
    const other = f.api.getConflictState().people[0];
    f.api.visitPlace(other.placeId);
    await f.node('[data-conflict-release="jack"]').dispatch('click');
    assert.equal(f.api.getConflictState().people.length, 0);
    assert.equal(f.bytes.get('hedo-life-v1'), 'UNCHANGED_CAREER');
    assert.equal(f.bytes.get('hedo-anonymous-v1'), 'TEST_IDENTITY');
    assert.deepEqual([...f.bytes.keys()].sort(), ['hedo-anonymous-v1', 'hedo-island-v1', 'hedo-life-v1']);
  }
});

test('boss arguments can exile the visitor, clock changes retain the hold, and either exile facility can release it', async () => {
  const f = await fixture({ conflictRandom: () => .3 });
  f.api.meetColleague('wing');
  await f.node('[data-conflict-action="argue"]').dispatch('click');
  assert.equal(f.api.getConflictState().history.length, 0);
  await f.node('[data-conflict-argue="wing"]').dispatch('click');
  assert.equal(f.api.getConflictState().player.status, 'exile');
  assert.equal(f.api.getConflictState().player.placeId, 'cold-palace');
  f.api.setHour(19.25);
  assert.equal(f.api.getConflictState().player.status, 'exile');
  f.api.meetColleague('jack');
  assert.equal(f.node('[data-conflict-action="fight"]'), null, 'an unresolved hold blocks further fights');
  f.api.visitPlace('exile-gate');
  await f.node('[data-sail-region="exile"]').dispatch('click');
  await f.node('[data-conflict-recover]').dispatch('click');
  assert.equal(f.api.getConflictState().player.status, 'free');
});

test('fallback exposes incident recovery and a held Aliang does not pretend to lead the evening trip', async () => {
  const f = await fixture({ fallback: true, reducedMotion: true, conflictRandom: () => .99 });
  f.api.meetColleague('kind');
  await f.node('[data-conflict-action="fight"]').dispatch('click');
  f.startBattle(); f.finishBattle('lose');
  assert.equal(f.api.getConflictState().people[0].status, 'police');
  assert.equal(f.calls.filter(call => call.method === 'sendPlayerToPlace').length, 0, 'fallback does not claim a physical transfer rendered on a map');
  f.api.setHour(19.25);
  assert.ok(f.node('#island-routine-title').textContent.includes('先等阿良一下'));
  assert.ok(!f.node('#island-routine-description').textContent.includes('阿良與夥伴正前往'));
  await f.node('#mystery-open').dispatch('click');
  await f.node('[data-sail-region="life"]').dispatch('click');
  assert.notEqual(f.node('#encounter-title').textContent, routines.MYSTERY_TRIP.story.title);
  assert.ok(f.node('#encounter-content').textContent.includes('警局做筆錄'));
  assert.ok(!f.node('#encounter-content').textContent.includes('今晚的集合正在進行'));
  f.api.visitPlace('hospital-er');
  await f.node('[data-conflict-recover]').dispatch('click');
  assert.equal(f.api.getConflictState().player.status, 'free');
});

test('Aliang still supports conflict choices while hosting the evening invitation', async () => {
  const f = await fixture();
  f.api.setHour(19.25);
  f.api.meetColleague('kind');
  await f.node('[data-sail-region="life"]').dispatch('click');
  assert.equal(f.node('#encounter-title').textContent, routines.MYSTERY_TRIP.story.title);
  assert.ok(f.node('[data-conflict-action="argue"]'));
  await f.node('[data-conflict-action="fight"]').dispatch('click');
  f.startBattle(); f.finishBattle('win');
  assert.equal(f.api.getConflictState().people[0].id, 'kind');
  assert.equal(f.api.getConflictState().people[0].status, 'hospital');
  assert.ok(f.node('#mystery-status').textContent.includes('醫院留觀'));
});

test('a pending bout pins the opponent and clock, while closing before start cancels without a result', async () => {
  const f = await fixture();
  f.api.meetColleague('jack');
  await f.node('[data-conflict-action="fight"]').dispatch('click');
  assert.equal(f.api.getConflictState().activeFight.opponentId, 'jack');
  assert.equal(f.brawls[0].config.opponent.image, '/assets/jack-sport.webp');
  assert.equal(f.api.getConflictState().history.length, 0);
  const before = f.api.getHour(); f.advanceClock(60); assert.equal(f.api.getHour(), before);
  assert.equal(f.calls.filter(call => call.method === 'setConversationTarget').at(-1).args[0].id, 'jack');
  assert.equal(f.api.closeDialog(f.node('#encounter-dialog')), true);
  assert.equal(f.brawls[0].destroyed, 1);
  assert.equal(f.api.getConflictState().activeFight, null);
  assert.equal(f.api.getConflictState().history.length, 0);
  assert.equal(f.api.getConflictState().player.status, 'free');
  assert.equal(f.node('#encounter-dialog').classList.contains('brawl-dialog'), false);
});

test('closing or native Escape during a started bout pauses instead of silently escaping, and forfeit settles once', async () => {
  const f = await fixture();
  f.api.meetColleague('jack');
  await f.node('[data-conflict-action="fight"]').dispatch('click'); f.startBattle();
  assert.equal(f.api.closeDialog(f.node('#encounter-dialog')), false);
  assert.equal(f.node('#encounter-dialog').open, true);
  assert.equal(f.brawls[0].phase, 'paused');
  let prevented = false;
  await f.node('#encounter-dialog').dispatch('cancel', { preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(f.api.getConflictState().history.length, 0);
  const callback = f.brawls[0].config.onFinish;
  f.finishBattle('lose', { reason: 'forfeit' });
  assert.equal(f.brawls[0].destroyed, 1);
  assert.equal(f.api.getConflictState().player.status, 'hospital');
  assert.equal(f.api.getConflictState().history.length, 1);
  callback('win', { duration: 1 });
  assert.equal(f.api.getConflictState().history.length, 1, 'late renderer callbacks cannot settle a completed bout again');
  assert.equal(f.api.getConflictState().player.status, 'hospital');
});

test('a stale callback cannot finish a newer bout, and a draw keeps both participants free', async () => {
  const f = await fixture();
  f.api.meetColleague('jack'); await f.node('[data-conflict-action="fight"]').dispatch('click');
  const oldFinish = f.brawls[0].config.onFinish;
  f.api.closeDialog(f.node('#encounter-dialog'));
  f.api.meetColleague('kind'); await f.node('[data-conflict-action="fight"]').dispatch('click'); f.startBattle();
  oldFinish('win', { duration: 20 });
  assert.equal(f.api.getConflictState().history.length, 0);
  assert.equal(f.api.getConflictState().activeFight.opponentId, 'kind');
  f.finishBattle('draw', { duration: 75, damageDealt: 40, damageTaken: 40, reason: 'timeout' });
  assert.equal(f.api.getConflictState().player.status, 'free');
  assert.equal(f.api.getConflictState().people.length, 0);
  assert.equal(f.api.getConflictState().history.at(-1).outcome, 'draw');
  assert.ok(f.node('#encounter-content').textContent.includes('不分勝負'));
  assert.ok(f.node('.brawl-result-score').textContent.includes('75 秒'));
});

test('an unavailable 2D canvas or page teardown never invents a fight result', async () => {
  const failed = await fixture({ brawlFails: true });
  failed.api.meetColleague('jack'); await failed.node('[data-conflict-action="fight"]').dispatch('click');
  assert.equal(failed.api.getConflictState().activeFight, null);
  assert.equal(failed.api.getConflictState().history.length, 0);
  assert.ok(failed.node('#encounter-content').textContent.includes('這場尚未開始'));
  assert.equal(failed.node('#encounter-dialog').classList.contains('brawl-dialog'), false);
  const f = await fixture();
  f.api.meetColleague('jack'); await f.node('[data-conflict-action="fight"]').dispatch('click'); f.startBattle();
  await f.window.dispatch('pagehide');
  assert.equal(f.brawls[0].destroyed, 1);
  assert.equal(f.api.getConflictState().history.length, 0);
  assert.equal(f.api.getConflictState().activeFight, null);
});

test('closing while the battle module loads prevents a late mount and preserves existing saved data', async () => {
  const f = await fixture({ brawlDeferred: true });
  f.api.meetColleague('jack');
  const pending = f.node('[data-conflict-action="fight"]').dispatch('click');
  assert.ok(f.api.getConflictState().activeFight);
  f.api.closeDialog(f.node('#encounter-dialog'));
  f.resolveBrawlImport(); await pending;
  assert.equal(f.brawls.length, 0);
  assert.equal(f.api.getConflictState().activeFight, null);
  assert.equal(f.api.getConflictState().history.length, 0);
  assert.equal(f.bytes.get('hedo-life-v1'), 'UNCHANGED_CAREER');
  assert.equal(f.bytes.get('hedo-anonymous-v1'), 'TEST_IDENTITY');
  assert.deepEqual([...f.bytes.keys()].sort(), ['hedo-anonymous-v1', 'hedo-island-v1', 'hedo-life-v1']);
});

test('a hash navigation during combat pauses the owned match without replacing its DOM or opponent', async () => {
  const f = await fixture();
  f.api.meetColleague('jack'); await f.node('[data-conflict-action="fight"]').dispatch('click'); f.startBattle();
  f.location.hash = '#harbor'; await f.window.dispatch('hashchange');
  assert.equal(f.location.hash, '');
  assert.equal(f.node('#encounter-title').textContent, '移動島大亂鬥');
  assert.equal(f.brawls[0].phase, 'paused');
  assert.equal(f.brawls[0].destroyed, 0);
  assert.equal(f.api.getConflictState().activeFight.opponentId, 'jack');
  assert.equal(f.api.getConflictState().history.length, 0);
});

test('locked bosses cannot bypass story progression through the legacy fight controller', async () => {
  for (const id of ['rick', 'spencer', 'wing', 'hidden-visitor']) {
    const f = await fixture();
    await f.api.renderConflictMenu(id, 'fight');
    assert.equal(f.brawls.length, 0, `${id}: no renderer is mounted before its invitation`);
    assert.equal(f.api.getConflictState().activeFight, null, `${id}: no free-fight reservation`);
    assert.equal(f.api.getChallengeState().active, null, `${id}: no story token is issued`);
    assert.deepEqual(f.api.getChallengeState().wins, []);
    if (id === 'hidden-visitor') {
      assert.ok(!f.document.body.textContent.includes('魚酥姐'), 'the locked visitor is not named by a forged legacy entry');
      assert.ok(!f.document.querySelectorAll('img').some(node => (node.src || node.getAttribute('src') || '').includes('hidden-visitor.png')));
    }
  }
});

test('story results count only a win and never apply hospital or police consequences', async () => {
  for (const outcome of ['win', 'lose', 'draw']) {
    const f = await fixture();
    f.api.meetColleague('jack');
    await f.node('[data-story-challenge="jack"]').dispatch('click');
    assert.equal(f.api.getChallengeState().active.opponentId, 'jack');
    assert.equal(f.api.getConflictState().activeFight, null);
    assert.deepEqual(f.api.getChallengeState().wins, []);
    f.startBattle(); f.finishBattle(outcome);
    assert.deepEqual(f.api.getChallengeState().wins, outcome === 'win' ? ['jack'] : []);
    assert.equal(f.api.getChallengeState().active, null);
    assert.equal(f.api.getConflictState().history.length, 0);
    assert.equal(f.api.getConflictState().player.status, 'free');
    assert.equal(f.api.getConflictState().people.length, 0);
    assert.equal(f.calls.filter(call => call.method === 'sendPlayerToPlace').length, 0);
    assert.equal(f.node('[data-conflict-proceed]'), null);
    assert.equal(f.bytes.get('hedo-life-v1'), 'UNCHANGED_CAREER');
    assert.equal(f.bytes.get('hedo-anonymous-v1'), 'TEST_IDENTITY');
  }
});

test('canceled or stale story callbacks cannot add a win or settle a newer story battle', async () => {
  const f = await fixture();
  await f.api.startBrawl('jack', { story: true });
  const oldFinish = f.brawls[0].config.onFinish;
  assert.equal(f.api.closeDialog(f.node('#encounter-dialog')), true);
  assert.equal(f.api.getChallengeState().active, null);
  assert.deepEqual(f.api.getChallengeState().wins, []);
  await f.api.startBrawl('kind', { story: true }); f.startBattle();
  oldFinish('win', { duration: 20 });
  assert.equal(f.api.getChallengeState().active.opponentId, 'kind');
  assert.deepEqual(f.api.getChallengeState().wins, []);
  f.finishBattle('lose', { reason: 'forfeit' });
  oldFinish('win', { duration: 20 });
  assert.deepEqual(f.api.getChallengeState().wins, []);
  await f.api.startBrawl('jack', { story: true }); f.startBattle(); f.finishBattle('win');
  assert.deepEqual(f.api.getChallengeState().wins, ['jack']);
  oldFinish('win', { duration: 20 });
  assert.deepEqual(f.api.getChallengeState().wins, ['jack']);
  assert.equal(f.api.getConflictState().history.length, 0);
});

test('story cancellation during lazy import, canvas failure and page teardown never create victory receipts', async () => {
  const deferred = await fixture({ brawlDeferred: true });
  const pending = deferred.api.startBrawl('jack', { story: true });
  assert.equal(deferred.api.getChallengeState().active.opponentId, 'jack');
  deferred.api.closeDialog(deferred.node('#encounter-dialog'));
  deferred.resolveBrawlImport(); await pending;
  assert.equal(deferred.brawls.length, 0);
  assert.equal(deferred.api.getChallengeState().active, null);
  const failed = await fixture({ brawlFails: true });
  await failed.api.startBrawl('jack', { story: true });
  assert.equal(failed.api.getChallengeState().active, null);
  const ended = await fixture();
  await ended.api.startBrawl('jack', { story: true }); ended.startBattle();
  const finishAfterTeardown = ended.brawls[0].config.onFinish;
  await ended.window.dispatch('pagehide'); finishAfterTeardown('win', { duration: 20 });
  for (const f of [deferred, failed, ended]) {
    assert.deepEqual(f.api.getChallengeState().wins, []);
    assert.ok(!f.writes.some(key => key.startsWith(CHALLENGE_STORAGE_KEY)));
    assert.equal(f.api.getConflictState().history.length, 0);
  }
});

test('the unlocked legacy boss route enforces boss order and reveals the final visitor only after opening its invitation', async () => {
  const ordinary = ISLAND_CAST.map(person => person.id).filter(id => !['rick', 'spencer', 'wing'].includes(id));
  const f = await fixture({ challengeProgress: { version: 1, wins: ordinary, invitationOpened: false } });
  await f.api.startBrawl('spencer'); assert.equal(f.brawls.length, 0);
  for (const id of ['rick', 'spencer', 'wing']) {
    await f.api.renderConflictMenu(id, 'fight');
    assert.equal(f.api.getChallengeState().active.opponentId, id);
    assert.equal(f.api.getConflictState().activeFight, null, 'the legacy boss entry becomes a story battle');
    f.startBattle(); f.finishBattle('win');
  }
  f.api.openChallenge();
  assert.equal(f.api.getChallengeState().hidden, null);
  assert.equal(f.node('[data-challenge-opponent="hidden-visitor"]'), null);
  assert.ok(!f.node('#challenge-content').textContent.includes('魚酥姐'));
  const brawlsBefore = f.brawls.length;
  await f.api.startBrawl('hidden-visitor'); assert.equal(f.brawls.length, brawlsBefore);
  const invitation = f.node('#challenge-content').querySelectorAll('button').find(node => node.textContent.includes('拆開碼頭'));
  assert.ok(invitation); await invitation.dispatch('click');
  assert.equal(f.api.getChallengeState().hidden.name, '魚酥姐');
  await f.node('[data-challenge-opponent="hidden-visitor"]').dispatch('click');
  await Promise.resolve();
  assert.equal(f.api.getChallengeState().active?.opponentId, 'hidden-visitor');
  assert.equal(f.brawls.at(-1).config.opponent.image, '/assets/hidden-visitor.png');
  f.startBattle(); f.finishBattle('win');
  assert.equal(f.api.getChallengeState().completed, true);
  assert.equal(f.api.getChallengeState().wins.length, 35);
  assert.equal(f.api.getConflictState().history.length, 0);
  assert.equal(f.api.getConflictState().player.status, 'free');
});

test('a free ordinary fight keeps its consequences separate from the story win list', async () => {
  const f = await fixture();
  await f.api.startBrawl('jack'); f.startBattle(); f.finishBattle('win');
  assert.equal(f.api.getConflictState().player.status, 'police');
  assert.equal(f.api.getConflictState().people[0].status, 'hospital');
  assert.deepEqual(f.api.getChallengeState().wins, []);
  assert.ok(!f.writes.some(key => key.startsWith(CHALLENGE_STORAGE_KEY)));
});

test('Oneira return links start at its port and wait for a real ferry arrival without sharing identity or career data', async () => {
  const f = await fixture({ initialSearch: '?from=oneira', initialHash: '#oneira', sailDeferred: true });
  assert.equal(f.calls.find(call => call.method === 'initialRegion').args[0], 'oneira');
  assert.equal(f.api.getTravelState().currentRegion, 'oneira');
  assert.equal(f.api.getTravelState().activeVoyage, true);
  assert.deepEqual(f.voyages.map(voyage => voyage.regionId), ['company']);
  assert.equal(f.node('#voyage-from').textContent, REGIONS.oneira.name);
  assert.equal(f.node('#voyage-to').textContent, REGIONS.company.name);
  assert.deepEqual([...f.api.getVisited()], ['lobby'], 'the voyage does not claim a visit before landing');
  assert.equal(f.location.search, '');
  assert.equal(f.location.hash, '', 'the return marker is consumed before normal location links');
  assert.equal(f.node('#ferry-dialog').open, false, 'the explicit Oneira return link already chose the incoming voyage');
  f.resolveSail(true); await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.api.getTravelState().currentRegion, 'company');
  assert.equal(f.api.getTravelState().activeVoyage, false);
  assert.ok(f.api.getVisited().includes('cafe'));
  assert.ok(!f.api.getVisited().includes('oneira'), 'an origin marker does not invent an explored project island');
  assert.equal(f.bytes.get('hedo-anonymous-v1'), 'TEST_IDENTITY');
  assert.equal(f.bytes.get('hedo-life-v1'), 'UNCHANGED_CAREER');
  assert.ok(f.writes.every(key => key === 'hedo-island-v1'));
});

test('ordinary, duplicate or unrelated location markers do not auto-board an incoming Oneira ferry', async () => {
  for (const [initialSearch, initialHash] of [
    ['', '#oneira'], ['?from=other', '#oneira'],
    ['?from=oneira&from=oneira', '#oneira'], ['?from=oneira', '#oneira-hub'],
    ['?from=oneira&duel=ABCD2345', '#oneira'],
  ]) {
    const f = await fixture({ initialSearch, initialHash, sailDeferred: true });
    assert.equal(f.api.getTravelState().currentRegion, 'company', `${initialSearch}${initialHash}`);
    assert.equal(f.api.getTravelState().activeVoyage, false);
    assert.equal(f.voyages.length, 0, 'only the exact return link chooses an automatic crossing');
    assert.equal(f.bytes.get('hedo-anonymous-v1'), 'TEST_IDENTITY');
    assert.equal(f.bytes.get('hedo-life-v1'), 'UNCHANGED_CAREER');
  }
});

test('an interrupted incoming Oneira ferry stays at its origin and cannot grant a company visit', async () => {
  for (const stop of ['false', 'reject', 'pagehide']) {
    const f = await fixture({ initialSearch: '?from=oneira', initialHash: '#oneira', sailDeferred: true });
    const passport = f.bytes.get('hedo-island-v1');
    if (stop === 'false') f.resolveSail(false);
    else if (stop === 'reject') f.rejectSail();
    else await f.window.dispatch('pagehide');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.api.getTravelState().currentRegion, 'oneira', stop);
    assert.equal(f.api.getTravelState().activeVoyage, false, stop);
    assert.equal(f.bytes.get('hedo-island-v1'), passport);
    assert.equal(f.bytes.get('hedo-anonymous-v1'), 'TEST_IDENTITY');
    assert.equal(f.bytes.get('hedo-life-v1'), 'UNCHANGED_CAREER');
  }
});

test('the non-WebGL Oneira return keeps the fixed crossing and lands at the company port', async () => {
  const f = await fixture({ fallback: true, initialSearch: '?from=oneira', initialHash: '#oneira' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.api.getTravelState().currentRegion, 'company');
  assert.equal(f.api.getTravelState().activeVoyage, false);
  assert.equal(f.voyages.length, 0, 'fallback does not pretend a renderer performed a voyage');
  assert.ok(f.api.getVisited().includes('cafe'));
  assert.equal(f.bytes.get('hedo-anonymous-v1'), 'TEST_IDENTITY');
  assert.equal(f.bytes.get('hedo-life-v1'), 'UNCHANGED_CAREER');
});

test('Oneira website links appear only after local arrival and use the fixed public harbor address', async () => {
  const f = await fixture({ initialSearch: '?redirect=https%3A%2F%2Fevil.example%2F&token=TEST_IDENTITY', sailDeferred: true });
  const projectLinks = () => f.document.querySelectorAll('a').filter(link => link.dataset.projectPort === 'oneira');
  assert.equal(projectLinks().length, 0);
  f.api.visitPlace('oneira-hub');
  assert.equal(f.node('#ferry-dialog').open, true);
  assert.equal(projectLinks().length, 0, 'a remote place request is not an external navigation');
  assert.equal(f.voyages.length, 0);
  const sailing = f.node('[data-sail-region="oneira"]').dispatch('click');
  assert.equal(projectLinks().length, 0, 'the project website remains behind the arrival gate');
  f.resolveSail(true); await sailing;
  assert.equal(f.api.getTravelState().currentRegion, 'oneira');
  assert.ok(projectLinks().length >= 1);
  for (const link of projectLinks()) {
    assert.equal(link.href, ONEIRA_PORT.harborUrl);
    assert.ok(!link.href.includes('TEST_IDENTITY') && !link.href.includes('evil.example'));
  }
  assert.equal(f.voyages.length, 1, 'a normal anchor is left for the visitor to choose explicitly');
  assert.equal(f.bytes.get('hedo-anonymous-v1'), 'TEST_IDENTITY');
  assert.equal(f.bytes.get('hedo-life-v1'), 'UNCHANGED_CAREER');
});

test('each arrived island dock opens boarding without sailing, while stale remote markers and mid-voyage clicks are ignored', async () => {
  const f = await fixture({ sailDeferred: true });
  const journey = ['company', 'life', 'exile', 'oneira', 'company'];
  for (const [index, regionId] of journey.entries()) {
    const progress = [...f.bytes], voyages = f.voyages.length;
    assert.equal(f.api.getTravelState().currentRegion, regionId);
    for (const remote of Object.keys(REGIONS).filter(id => id !== regionId)) {
      f.dock(remote);
      assert.equal(f.node('#ferry-dialog').open, false, `${regionId}: a stale ${remote} marker cannot open boarding`);
    }
    f.dock(regionId);
    assert.equal(f.node('#ferry-dialog').open, true, `${regionId}: the physical dock opens its destination choices`);
    assert.equal(f.node(`[data-sail-region="${regionId}"]`).disabled, true, 'the current island is already docked');
    assert.equal(f.api.getTravelState().currentRegion, regionId);
    assert.equal(f.api.getTravelState().activeVoyage, false, 'clicking a dock does not auto-board');
    assert.equal(f.voyages.length, voyages);
    assert.deepEqual([...f.bytes], progress, 'opening a dock does not change passport, identity or career progress');
    const nextRegion = journey[index + 1];
    if (!nextRegion) { f.api.closeDialog(f.node('#ferry-dialog')); break; }
    const sailing = f.node(`[data-sail-region="${nextRegion}"]`).dispatch('click');
    assert.equal(f.api.getTravelState().activeVoyage, true);
    f.dock(regionId);
    assert.equal(f.node('#ferry-dialog').open, false, 'the departing dock cannot reopen while at sea');
    assert.equal(f.voyages.length, voyages + 1);
    f.resolveSail(true); await sailing;
  }
});

test('district, place, colleague and hash navigation all wait for an actual ferry arrival', async () => {
  const cases = [
    { name: 'district', region: 'exile', district: 'exile', open: false, enter: f => f.api.selectDistrict('exile') },
    { name: 'place', region: 'life', district: 'harbor', place: 'izakaya', open: true, enter: f => f.api.visitPlace('izakaya') },
    { name: 'colleague', region: 'life', open: true, enter: f => { f.life([actor('kind', 'harbor')]); f.api.meetColleague('kind'); } },
    { name: 'district hash', region: 'life', district: 'court', open: false, enter: f => { f.location.hash = '#court'; return f.window.dispatch('hashchange'); } },
    { name: 'place hash', region: 'life', district: 'hospital', place: 'hospital-er', open: true, enter: f => { f.location.hash = '#hospital-er'; return f.window.dispatch('hashchange'); } },
  ];
  for (const entry of cases) {
    const f = await fixture({ sailDeferred: true });
    const passport = f.bytes.get('hedo-island-v1');
    await entry.enter(f);
    assert.equal(f.node('#ferry-dialog').open, true, `${entry.name}: boarding is offered first`);
    assert.equal(f.api.getTravelState().pendingTravel.regionId, entry.region);
    assert.equal(f.api.getTravelState().currentRegion, 'company');
    assert.equal(f.node('#encounter-dialog').open, false, `${entry.name}: no remote conversation before boarding`);
    assert.equal(f.bytes.get('hedo-island-v1'), passport);
    assert.equal(f.api.getPlaceVisits().length, 0);
    assert.equal(f.calls.filter(call => call.method === 'sailToRegion').length, 0, 'selecting a destination does not auto-board');
    assert.equal(f.location.hash, '', 'the pending remote URL does not claim arrival');
    const sailing = f.node(`[data-sail-region="${entry.region}"]`).dispatch('click');
    assert.equal(f.api.getTravelState().activeVoyage, true);
    assert.equal(f.node('#voyage-overlay').hidden, false);
    assert.equal(f.node('#encounter-dialog').open, false, `${entry.name}: no conversation while at sea`);
    assert.equal(f.bytes.get('hedo-island-v1'), passport);
    assert.equal(f.api.getPlaceVisits().length, 0);
    f.api.visitPlace('cold-palace');
    assert.equal(f.node('#ferry-dialog').open, false, 'another request cannot replace the voyage in progress');
    assert.equal(f.calls.filter(call => call.method === 'sailToRegion').length, 1);
    f.resolveSail(true); await sailing;
    assert.equal(f.api.getTravelState().currentRegion, entry.region);
    assert.equal(f.api.getTravelState().activeVoyage, false);
    assert.equal(f.node('#voyage-overlay').hidden, true);
    assert.equal(f.node('#encounter-dialog').open, entry.open);
    if (entry.district) assert.ok(f.api.getVisited().includes(entry.district));
    if (entry.place) assert.ok(f.api.getPlaceVisits().includes(entry.place));
  }
});

test('failed, interrupted or torn-down ferries never grant remote visits or conversations', async () => {
  for (const stop of ['false', 'reject', 'pagehide']) {
    const f = await fixture({ sailDeferred: true });
    const passport = f.bytes.get('hedo-island-v1');
    f.api.visitPlace('hospital-er');
    const sailing = f.api.sailTo('life');
    assert.equal(f.api.getTravelState().activeVoyage, true);
    if (stop === 'false') f.resolveSail(false);
    else if (stop === 'reject') f.rejectSail();
    else await f.window.dispatch('pagehide');
    assert.equal(await sailing, false);
    assert.equal(f.api.getTravelState().currentRegion, 'company');
    assert.equal(f.node('#encounter-dialog').open, false);
    assert.equal(f.bytes.get('hedo-island-v1'), passport);
    assert.ok(!f.api.getVisited().includes('hospital'));
    assert.equal(f.api.getPlaceVisits().length, 0);
    assert.equal(f.calls.filter(call => call.method === 'focusPlace').length, 0);
  }
});

test('initial remote links and WebGL fallback preserve the ferry UI gate', async () => {
  for (const fallback of [false, true]) {
    const f = await fixture({ fallback, reducedMotion: true, initialHash: '#hospital-er' });
    assert.equal(f.node('#ferry-dialog').open, true);
    assert.equal(f.node('#encounter-dialog').open, false);
    assert.equal(f.location.hash, '');
    assert.ok(!f.api.getVisited().includes('hospital'));
    assert.equal(f.node('[data-sail-region="life"]').disabled, false, 'a prepared fallback dock remains usable');
    await f.node('[data-sail-region="life"]').dispatch('click');
    assert.equal(f.api.getTravelState().currentRegion, 'life');
    assert.equal(f.node('#encounter-dialog').open, true);
    assert.ok(f.api.getVisited().includes('hospital'));
    assert.ok(f.api.getPlaceVisits().includes('hospital-er'));
    assert.equal(f.calls.filter(call => call.method === 'sailToRegion').length, fallback ? 0 : 1, 'fallback arrival follows an explicit boat choice');
  }
});

test('colleagues on a ferry cannot be remotely chatted with or reserved for combat', async () => {
  const f = await fixture();
  f.life([actor('kind', 'cafe', { state: 'sailing', traveling: true, ferry: { from: 'company', to: 'life' }, destinationDistrictId: 'harbor' })]);
  f.api.meetColleague('kind');
  await f.node('#mystery-open').dispatch('click');
  await f.api.startBrawl('kind', { story: true });
  assert.equal(f.node('#encounter-dialog').open, false);
  assert.equal(f.node('#ferry-dialog').open, false);
  assert.equal(f.brawls.length, 0);
  assert.equal(f.api.getChallengeState().active, null);
  assert.equal(f.api.getConflictState().activeFight, null);
});

test('a hospital hold follows the actual body through departure, ferry and arrival without clearing the hold', async () => {
  const f = await fixture();
  f.life([actor('jack', 'lab')]);
  await f.api.startBrawl('jack'); f.startBattle(); f.finishBattle('win');
  f.api.closeDialog(f.node('#encounter-dialog'));
  const transfer = { traveling: true, destinationDistrictId: 'hospital', destinationPlaceId: 'hospital-er' };
  f.life([actor('jack', 'lab', { ...transfer, state: 'walking', activity: '前往應急船碼頭' })]);
  f.node('#cast-search').value = DISTRICTS.find(district => district.id === 'lab').name;
  await f.node('#cast-open').dispatch('click');
  const departing = f.node('[data-character-id="jack"]');
  assert.ok(departing, 'the department location filter follows the body before boarding');
  assert.match(departing.querySelector('[data-person-location]').textContent, /接駁前往.*急診室/);
  assert.ok(!departing.textContent.includes('醫院留觀'), 'the intended hold is not presented as an already-arrived body');
  await departing.querySelector('[data-locate-person]').dispatch('click');
  assert.equal(f.calls.filter(call => call.method === 'focus').at(-1).args[0], 'lab');
  assert.equal(f.node('#ferry-dialog').open, false, 'a colleague still on the company island can be located locally');
  f.api.meetColleague('jack');
  assert.equal(f.node('#encounter-dialog').open, true);
  assert.ok(f.node('#encounter-place').textContent.includes(DISTRICTS.find(district => district.id === 'lab').name));
  assert.ok(f.node('#encounter-content').textContent.includes('正在前往急診室'));
  assert.equal(f.node('[data-conflict-action="fight"]'), null);
  assert.equal(f.node('[data-story-challenge="jack"]'), null);
  f.api.closeDialog(f.node('#encounter-dialog'));

  f.life([actor('jack', 'cafe', { ...transfer, state: 'sailing', ferry: { from: 'company', to: 'life' } })]);
  f.api.meetColleague('jack');
  assert.equal(f.node('#encounter-dialog').open, false, 'a held passenger is not available for conversation at sea');
  f.node('#cast-search').value = ''; await f.node('#cast-open').dispatch('click');
  const aboard = f.node('[data-character-id="jack"]');
  assert.match(aboard.querySelector('[data-person-location]').textContent, /搭船中.*公司本島.*下班生活島/);
  const focusedBefore = f.calls.filter(call => call.method === 'focusPerson').length;
  await aboard.querySelector('[data-locate-person]').dispatch('click');
  assert.equal(f.calls.filter(call => call.method === 'focusPerson').length, focusedBefore, 'the sea does not become a remote location shortcut');
  assert.equal(f.node('#ferry-dialog').open, false);

  f.api.visitPlace('hospital-er');
  await f.node('[data-sail-region="life"]').dispatch('click');
  assert.equal(f.node('[data-conflict-release="jack"]'), null, 'the facility cannot discharge a passenger who is still at sea');
  const awaitingArrival = f.node('[data-conflict-await="jack"]');
  assert.ok(awaitingArrival);
  await awaitingArrival.dispatch('click');
  assert.equal(f.node('[data-conflict-release="jack"]'), null, 'refreshing cannot clear an in-transit hold');
  assert.equal(f.api.getConflictState().people.find(person => person.id === 'jack').status, 'hospital');
  f.life([actor('jack', 'hospital', { destinationDistrictId: 'hospital', destinationPlaceId: 'hospital-er', traveling: false })]);
  await f.node('[data-conflict-await="jack"]').dispatch('click');
  assert.ok(f.node('[data-conflict-release="jack"]'), 'the discharge action appears only after a real arrival is refreshed');
  f.api.closeDialog(f.node('#encounter-dialog'));
  f.api.openFerry('company'); await f.node('[data-sail-region="company"]').dispatch('click');
  await f.node('#cast-open').dispatch('click');
  const arrived = f.node('[data-character-id="jack"]');
  assert.match(arrived.querySelector('[data-person-location]').textContent, /醫院留觀.*急診室/);
  await arrived.querySelector('[data-locate-person]').dispatch('click');
  assert.equal(f.node('#ferry-dialog').open, true, 'locating the arrived body now requires a trip to the life island');
  assert.equal(f.calls.filter(call => call.method === 'focusPerson').length, focusedBefore);
  await f.node('[data-sail-region="life"]').dispatch('click');
  assert.equal(f.calls.filter(call => call.method === 'focus').at(-1).args[0], 'hospital');
  assert.equal(f.calls.filter(call => call.method === 'focusPerson').at(-1).args[0], 'jack');
  f.api.meetColleague('jack');
  assert.ok(f.node('#encounter-place').textContent.includes(DISTRICTS.find(district => district.id === 'hospital').name));
  await f.api.startBrawl('jack', { story: true });
  assert.equal(f.brawls.length, 1, 'arrival does not remove the hold or permit another battle');
  assert.equal(f.api.getConflictState().people.find(person => person.id === 'jack').status, 'hospital');
  assert.equal(f.api.getConflictState().player.status, 'police');
  assert.equal(f.api.getChallengeState().active, null);
  assert.deepEqual(f.api.getChallengeState().wins, []);
});
