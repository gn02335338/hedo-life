import test from 'node:test';
import assert from 'node:assert/strict';
import { mountIslandPvp } from '../dist/island/pvp-ui.js';
import { createIslandPvpCombat } from '../dist/island/pvp-combat.js';

class Surface {
  listeners = new Map();
  addEventListener(type, fn) { const rows = this.listeners.get(type) || []; rows.push(fn); this.listeners.set(type, rows); }
  removeEventListener(type, fn) { this.listeners.set(type, (this.listeners.get(type) || []).filter(row => row !== fn)); }
  emit(type, extra = {}) {
    const event = { target: this, code: '', detail: 1, pointerId: 1, repeat: false, preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {}, ...extra };
    for (const fn of [...this.listeners.get(type) || []]) if ((this.listeners.get(type) || []).includes(fn)) fn(event);
    return event;
  }
  count() { return [...this.listeners.values()].reduce((sum, rows) => sum + rows.length, 0); }
}
class Element extends Surface {
  constructor(tag, doc) { super(); this.tagName = tag; this.ownerDocument = doc; this.children = []; this.dataset = {}; this.attributes = new Map(); this.hidden = false; this.disabled = false; this.value = ''; this.className = ''; this.style = { setProperty() {} }; }
  classList = { add: name => { this.className += ` ${name}`; }, remove: name => { this.className = this.className.split(' ').filter(value => value !== name).join(' '); },
    contains: name => this.className.split(' ').includes(name), toggle: (name, force) => { const add = force ?? !this.classList.contains(name); if (add && !this.classList.contains(name)) this.classList.add(name); else if (!add) this.classList.remove(name); return add; } };
  append(...items) { for (const item of items) { item.parentElement = this; this.children.push(item); } }
  set textContent(value) { this.text = String(value ?? ''); this.children = []; }
  get textContent() { return (this.text || '') + this.children.map(item => item.textContent).join(''); }
  setAttribute(key, value) { this.attributes.set(key, String(value)); if (key === 'id') this.id = String(value); }
  getAttribute(key) { return this.attributes.get(key) ?? null; }
  focus() { this.ownerDocument.activeElement = this; }
  select() { this.selected = true; }
  remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(item => item !== this); this.parentElement = null; }
  closest(selector) { if (selector === '[data-brawl-move]') return this.dataset.brawlMove ? this : null; if (selector === 'summary, [data-brawl-dossier]') return this.tagName === 'summary' ? this : null; return null; }
  setPointerCapture() {}
  getBoundingClientRect() { return { x: 0, y: 0, left: 0, top: 0, width: this.className.includes('pad') ? 132 : 960, height: this.className.includes('pad') ? 132 : 400 }; }
  getContext() { return this.ownerDocument.context; }
  all() { return this.children.flatMap(child => [child, ...child.all()]); }
}
const CODE = 'ABC12345';
function room(phase = 'waiting', more = {}) {
  return { roomCode: CODE, phase, players: [0, 1].map(seat => ({ seat, occupied: true, nickname: seat ? '朋友' : '島民', connected: true, ready: false, rematch: false })),
    expiresAt: Date.now() + 600000, serverNow: Date.now(), matchId: 'match-1', countdownEndsAt: Date.now() + 3000, reconnectDeadline: Date.now() + 15000, reason: null, ...more };
}
const flush = () => new Promise(resolve => setImmediate(resolve));
function fixture({ canvas = true, inviteCode = CODE } = {}) {
  const doc = new Surface(), view = new Surface(), elements = [], frames = new Map(), intervals = new Map(), calls = [], statuses = [];
  let nextId = 0, callbacks, disconnected = false, closed = 0, accepted = true, state = { connection: 'idle', roomCode: null, seat: null, room: null, combat: null, serverOffsetMs: 0, error: null };
  doc.context = canvas ? new Proxy({}, { get(target, name) { return name in target ? target[name] : () => {}; }, set(target, name, value) { target[name] = value; return true; } }) : null;
  doc.defaultView = view; doc.hidden = false; doc.createElement = tag => { const node = new Element(tag, doc); elements.push(node); return node; };
  view.location = { href: 'https://hodo.bvivify.com/island/?duel=ABC12345' }; view.devicePixelRatio = 1; view.localStorage = { getItem() { throw new Error('preview must not read identity'); } };
  view.navigator = { clipboard: { writeText: async text => calls.push(['copy', text]) } };
  view.requestAnimationFrame = callback => { frames.set(++nextId, callback); return nextId; }; view.cancelAnimationFrame = id => frames.delete(id);
  view.setInterval = callback => { intervals.set(++nextId, callback); return nextId; }; view.clearInterval = id => intervals.delete(id);
  view.ResizeObserver = class { constructor(callback) { this.callback = callback; } observe() {} disconnect() { calls.push(['resize-disconnect']); } };
  const container = new Element('div', doc);
  const engine = createIslandPvpCombat({ seed: 'UI authority' }); engine.start();
  const update = patch => { state = { ...state, ...patch }; callbacks.onChange(structuredClone(state)); };
  const client = {
    async create(name) { calls.push(['create', name]); update({ connection: 'connected', roomCode: CODE, seat: 0, room: room(), terminalReason: null }); return { roomCode: CODE, seat: 0 }; },
    async join(code, name) { calls.push(['join', code, name]); update({ connection: 'connected', roomCode: CODE, seat: 0, room: room(), terminalReason: null }); return { roomCode: CODE, seat: 0 }; },
    ready(value) { calls.push(['ready', value]); return true; }, rematch() { calls.push(['rematch']); return true; },
    sendInput(input) { calls.push(['input', structuredClone(input)]); return accepted; }, clearInput() { calls.push(['neutral']); },
    leave() { calls.push(['leave']); }, destroy() { disconnected = true; calls.push(['disconnect']); }, getState: () => structuredClone(state),
  };
  const handle = mountIslandPvp({ container, inviteCode, onClose: () => { closed++; }, onStatus: value => statuses.push(value), clientFactory: options => { callbacks = options; return client; } });
  const find = predicate => elements.find(predicate), data = key => find(node => Object.hasOwn(node.dataset, key)), byClass = name => find(node => node.className.split(' ').includes(name));
  return { handle, container, doc, view, calls, statuses, frames, intervals, engine, update, find, data, byClass, elements,
    getClosed: () => closed, getDisconnected: () => disconnected, setAccepted: value => { accepted = value; },
    playing() { const combat = engine.getState(); update({ connection: 'connected', roomCode: CODE, seat: 0, room: room('playing'), combat }); callbacks.onSnapshot(structuredClone(combat), { matchId: 'match-1', receivedAt: Date.now(), sequence: 1 }); },
    inputs() { for (const callback of [...intervals.values()]) callback(); }, frame(time = performance.now()) { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(time)); },
    late(patch) { callbacks.onChange(patch); callbacks.onSnapshot(engine.getState(), { matchId: 'old', receivedAt: 0, sequence: 99 }); },
  };
}

test('previewing an invite only prefills its public room code, with no client create/join or game keyboard owner', async () => {
  const f = fixture(); assert.equal(f.data('pvpCodeInput').value, CODE); assert.deepEqual(f.calls, []); assert.equal(f.doc.count(), 1, 'only visibility cleanup is installed in lobby');
  f.doc.emit('keydown', { code: 'KeyW' }); assert.deepEqual(f.calls, []);
  f.find(node => node.placeholder === '島民').value = '測試島民'; f.data('pvpJoin').parentElement.emit('submit'); await flush();
  assert.deepEqual(f.calls[0], ['join', CODE, '測試島民']); assert.equal(f.statuses.at(-1).roomCode, CODE); assert.equal(f.data('pvpReady').disabled, false);
  f.handle.destroy();
});

test('room ownership and readiness follow the server; queued actions never invent local health, pause or outcome', async () => {
  const f = fixture(); f.data('pvpCreate').emit('click'); await flush(); f.data('pvpReady').emit('click'); assert.ok(f.calls.some(row => row[0] === 'ready'));
  assert.equal(f.intervals.size, 0); assert.equal(f.handle.getState().room.phase, 'waiting');
  f.playing(); assert.equal(f.intervals.size, 1); f.doc.emit('keydown', { code: 'KeyJ' });
  for (let i = 0; i < 12; i++) { f.inputs(); f.frame(); }
  assert.ok(f.calls.some(row => row[0] === 'input' && row[1].attack)); assert.equal(f.handle.getState().combat.fighters[1].hp, 160);
  assert.equal(f.handle.getState().room.phase, 'playing'); assert.equal(f.handle.getState().combat.winner, null);
  f.handle.destroy();
});

test('short action pulses remain queued until a network send succeeds and never persist after blur', () => {
  const f = fixture(); f.playing(); f.setAccepted(false);
  f.doc.emit('keydown', { code: 'Space' }); f.doc.emit('keyup', { code: 'Space' }); f.inputs();
  assert.equal(f.calls.filter(row => row[0] === 'input').at(-1)[1].dodge, true);
  f.inputs(); assert.equal(f.calls.filter(row => row[0] === 'input').at(-1)[1].dodge, true, 'unsent pulse survives a neutral sample');
  f.setAccepted(true); f.inputs(); f.inputs(); assert.equal(f.calls.filter(row => row[0] === 'input').at(-1)[1].dodge, false);
  f.doc.emit('keydown', { code: 'KeyJ' }); f.inputs(); f.view.emit('blur'); assert.equal(f.intervals.size, 1); assert.equal(f.getClosed(), 0); assert.equal(f.calls.at(-1)[0], 'neutral');
  f.view.emit('focus'); f.inputs(); assert.equal(f.calls.filter(row => row[0] === 'input').at(-1)[1].attack, false);
  f.doc.hidden = true; f.doc.emit('visibilitychange'); assert.equal(f.intervals.size, 0); f.handle.destroy();
});

test('Escape presents an explicit exit decision without pausing the other player or silently forfeiting', () => {
  const f = fixture(); f.playing(); f.doc.emit('keydown', { code: 'Escape' });
  assert.equal(f.byClass('pvp-exit-overlay').hidden, false); assert.equal(f.intervals.size, 0); assert.equal(f.getClosed(), 0); assert.equal(f.calls.some(row => row[0] === 'leave'), false);
  assert.equal(f.handle.getState().room.phase, 'playing'); f.data('pvpStay').emit('click'); assert.equal(f.intervals.size, 1);
  assert.equal(f.handle.requestExit(), false); f.data('pvpConfirmLeave').emit('click'); assert.equal(f.getClosed(), 1); assert.equal(f.calls.filter(row => row[0] === 'leave').length, 1); assert.equal(f.handle.requestExit(), true);
  f.handle.destroy();
});

test('reload-style page teardown only disconnects and destroys every input, frame, resize and late-callback owner', () => {
  const f = fixture(); f.playing(); f.doc.emit('keydown', { code: 'KeyD' }); f.inputs(); f.view.emit('pagehide');
  assert.equal(f.getDisconnected(), true); assert.equal(f.calls.some(row => row[0] === 'leave'), false, 'reload retains the server grace window');
  const count = f.statuses.length; f.handle.destroy(); f.handle.destroy();
  assert.equal(f.frames.size, 0); assert.equal(f.intervals.size, 0); assert.equal(f.doc.count() + f.view.count(), 0); assert.equal(f.container.children.length, 0);
  assert.ok(f.elements.every(node => node.count() === 0));
  f.late({ room: room('finished'), connection: 'connected' }); assert.equal(f.statuses.length, count);
});

test('a rematch needs server completion and a separate vote; old controls are stopped between rounds', () => {
  const f = fixture(); f.playing(); f.engine.forfeit(1); f.update({ room: room('finished'), combat: f.engine.getState() });
  assert.equal(f.intervals.size, 0); assert.equal(f.data('pvpRematch').hidden, false); f.data('pvpRematch').emit('click'); assert.equal(f.calls.at(-1)[0], 'rematch');
  assert.equal(f.handle.getState().room.phase, 'finished', 'the view cannot reset the server match by itself');
  f.update({ room: room('waiting', { matchId: 'match-2' }), combat: null }); assert.equal(f.intervals.size, 0); assert.equal(f.data('pvpReady').hidden, false);
  f.handle.destroy();
});

test('a missing canvas offers a safe close without creating identity, rooms or leaked listeners', () => {
  const f = fixture({ canvas: false }); assert.deepEqual(f.calls, []); assert.equal(f.handle.requestExit(), true); assert.equal(f.handle.getState().connection, 'unavailable');
  f.find(node => node.tagName === 'button' && node.textContent === '回到小島').emit('click'); assert.equal(f.getClosed(), 1); f.handle.destroy(); assert.ok(f.elements.every(node => node.count() === 0));
});

test('a rejected or still-pending join keeps the lobby closable instead of hiding its exit confirmation inside the room', () => {
  const f = fixture();
  for (const connection of ['connecting', 'failed']) {
    f.update({ connection, roomCode: CODE, seat: null, room: null, error: connection === 'failed' ? '房間已滿' : null });
    assert.equal(f.byClass('pvp-lobby').hidden, false); assert.equal(f.handle.requestExit(), true);
    assert.equal(f.byClass('pvp-exit-overlay').hidden, true);
  }
  f.handle.destroy();
});

test('returning through visibility alone restores cleared controls without requiring another window focus event', () => {
  const f = fixture(); f.playing(); f.doc.emit('keydown', { code: 'KeyJ' }); f.doc.emit('keydown', { code: 'KeyD' }); f.inputs();
  f.view.emit('blur'); f.doc.hidden = true; f.doc.emit('visibilitychange'); assert.equal(f.intervals.size, 0);
  f.doc.hidden = false; f.doc.emit('visibilitychange'); assert.equal(f.intervals.size, 1, 'visible tab resumes without window focus');
  f.inputs(); assert.deepEqual(f.calls.filter(row => row[0] === 'input').at(-1)[1], { x: 0, y: 0, attack: false, dodge: false, special: false, throw: false });
  f.doc.emit('keydown', { code: 'KeyD' }); f.inputs(); assert.equal(f.calls.filter(row => row[0] === 'input').at(-1)[1].x, 1);
  f.handle.destroy();
});

test('expired rooms keep their terminal explanation after socket close and offer a new room instead of retrying a dead code', async () => {
  const f = fixture(); f.playing(); f.update({ connection: 'closed', room: room('expired'), terminalReason: 'expired' });
  assert.match(f.byClass('pvp-overlay-panel').textContent, /房間已到期，請重新開房/);
  assert.equal(f.data('pvpReconnect').hidden, true); assert.equal(f.data('pvpNewRoom').hidden, false); assert.equal(f.handle.requestExit(), true); assert.equal(f.intervals.size, 0);
  f.data('pvpNewRoom').emit('click'); await flush(); assert.equal(f.calls.filter(row => ['create', 'join'].includes(row[0])).at(-1)[0], 'create');
  assert.equal(f.handle.getState().room.phase, 'waiting'); f.handle.destroy();
});

test('a visible blur clears held actions while the first pointer still operates without a separate canvas or window focus', () => {
  const f = fixture(); f.playing(); f.doc.emit('keydown', { code: 'KeyJ' }); f.doc.emit('keydown', { code: 'KeyD' }); f.inputs();
  f.view.emit('blur'); assert.equal(f.doc.hidden, false); assert.equal(f.intervals.size, 1); f.inputs();
  assert.deepEqual(f.calls.filter(row => row[0] === 'input').at(-1)[1], { x: 0, y: 0, attack: false, dodge: false, special: false, throw: false });
  const attack = f.find(node => node.tagName === 'button' && node.classList.contains('is-attack'));
  assert.equal(attack.disabled, false); attack.emit('pointerdown', { pointerId: 7 });
  f.byClass('pvp-pad').emit('pointerdown', { pointerId: 8, clientX: 112, clientY: 66 }); f.inputs();
  const firstTouch = f.calls.filter(row => row[0] === 'input').at(-1)[1]; assert.equal(firstTouch.attack, true); assert.ok(firstTouch.x > .8);
  f.view.emit('pointerup', { pointerId: 7 }); f.view.emit('pointerup', { pointerId: 8 }); f.inputs();
  assert.deepEqual(f.calls.filter(row => row[0] === 'input').at(-1)[1], { x: 0, y: 0, attack: false, dodge: false, special: false, throw: false });
  f.doc.hidden = true; f.doc.emit('visibilitychange'); assert.equal(f.intervals.size, 0); assert.equal(attack.disabled, true); f.handle.destroy();
});
