import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { DISTRICTS, TOUR } from '../dist/island/content.js';
import { PLACES, PLACE_BY_ID } from '../dist/island/places.js';
import { ISLAND_CAST } from '../dist/island/cast.js';
import { ENCOUNTERS } from '../dist/island/encounters.js';
import { displayPersona } from '../dist/persona.js';
import { readProgress, writeProgress } from '../dist/island/progress.js';
import * as routines from '../dist/island/routines.js';

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
  document.querySelector = selector => document.querySelectorAll(selector)[0] || null;
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
async function fixture({ fallback = false, reducedMotion = false } = {}) {
  const [source, html] = await Promise.all(['app.js', 'index.html'].map(name => readFile(new URL(`../dist/island/${name}`, import.meta.url), 'utf8')));
  const document = makeDocument(html), window = new Surface(), calls = [], timers = new Map(); let nextTimer = 0, onLifeUpdate, now = 0;
  const bytes = new Map([['hedo-island-v1', JSON.stringify({ version: 1, visited: ['lobby'], choices: { lobby: 2 } })], ['hedo-anonymous-v1', 'TEST_IDENTITY'], ['hedo-life-v1', 'UNCHANGED_CAREER']]);
  const writes = [];
  window.localStorage = { getItem: key => bytes.get(key) ?? null, setItem: (key, value) => { writes.push(key); bytes.set(key, value); } };
  const scene = Object.fromEntries(['setResidents', 'setHour', 'setPaused', 'setMovementEnabled', 'setConversationTarget', 'setConnections', 'setTopView', 'focus', 'focusPlace', 'focusPerson', 'reset', 'destroy', 'setMoveInput', 'zoom'].map(method => [method, (...args) => { calls.push({ method, args }); }]));
  const createIslandScene = async config => { if (fallback) throw new Error('intentional renderer unavailable'); onLifeUpdate = config.onLifeUpdate; document.querySelector('#scene').append(document.createElement('canvas')); return scene; };
  const media = query => Object.assign(new Surface(), { matches: query.includes('reduced-motion') && reducedMotion });
  const location = { pathname: '/island/', search: '', hash: '', reload() {} };
  const history = { replaceState: (_state, _unused, path) => { location.hash = path.includes('#') ? path.slice(path.indexOf('#')) : ''; } };
  const context = vm.createContext({
    ...routines, DISTRICTS, TOUR, PLACES, PLACE_BY_ID, ISLAND_CAST, ENCOUNTERS, displayPersona, readProgress, writeProgress,
    document, window, matchMedia: media, history, location, createIslandScene,
    bindWalkControls: () => ({ clear() {}, destroy() {} }), bindApplications: () => ({ getResidents: () => [] }),
    createIslandAdminSummary: () => ({ refresh: async () => {} }), residentAvatar: () => document.createElement('span'),
    console: { warn() {} }, setTimeout: callback => { timers.set(++nextTimer, { kind: 'timeout', callback }); return nextTimer; }, clearTimeout: id => timers.delete(id),
    setInterval: callback => { timers.set(++nextTimer, { kind: 'interval', callback }); return nextTimer; }, clearInterval: id => timers.delete(id),
    performance: { now: () => now }, requestAnimationFrame: callback => { timers.set(++nextTimer, callback); return nextTimer; }, cancelAnimationFrame: id => timers.delete(id),
  });
  const script = source.replace(/^import\s[\s\S]*?;\r?\n/gm, '').replace("const { createIslandScene } = await import('./scene.js');", '');
  const api = await new vm.Script(`(async () => { ${script}\n return { setHour, renderCastDirectory, renderDetail, renderEncounter, meetColleague, updateIslandLife, renderLifeStatus, closeDialog, getHour: () => hour }; })()`, { filename: 'dist/island/app.js' }).runInContext(context);
  return { api, document, window, calls, scene, timers, bytes, writes, advanceClock: seconds => { now += seconds * 1000; for (const timer of timers.values()) if (timer.kind === 'interval') timer.callback(); }, life: rows => onLifeUpdate?.({ actors: rows }), node: selector => document.querySelector(selector) };
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
