import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEM_BASES } from '../dist/arpg/content.js';
import { createGame, getProgress } from '../dist/arpg/engine.js';
import { STORAGE_KEY, readProgress, writeProgress, clearProgress } from '../dist/arpg/progress.js';
import { createInput } from '../dist/arpg/input.js';

function memoryStorage(initial = {}) {
  const entries = new Map(Object.entries(initial));
  const reads = [], writes = [], removals = [];
  return {
    entries, reads, writes, removals,
    getItem(key) { reads.push(key); return entries.get(key) ?? null; },
    setItem(key, value) { writes.push(key); entries.set(key, value); },
    removeItem(key) { removals.push(key); entries.delete(key); },
  };
}

function item(baseId, extra = {}) {
  const base = ITEM_BASES.find(entry => entry.id === baseId);
  const { id, ...properties } = base;
  return { id: `test-${id}`, baseId: id, rarity: 'common', ...properties, ...extra };
}

function saved() {
  return {
    version: 1, level: 4, xp: 78, gold: 125, wins: 2,
    inventory: [
      item('keyboard', { rarity: 'epic', attack: 28, maxHp: 18, energyRegen: 1.4 }),
      item('hoodie', { rarity: 'rare', armor: 15, maxHp: 44 }),
      item('badge', { rarity: 'epic', attack: 8, maxHp: 30, energyRegen: 2.5 }),
      item('mug', { id: 'spare-mug', rarity: 'rare', attack: 13 }),
    ],
    equipped: { weapon: 'test-keyboard', armor: 'test-hoodie', charm: 'test-badge' },
  };
}

function readValue(value) {
  return readProgress(memoryStorage({ [STORAGE_KEY]: JSON.stringify(value) }));
}

test('ARPG saves preserve equipped IDs, spare loot, rarities and rolled bonuses across reloads', () => {
  const storage = memoryStorage({ 'hedo-life-v3': 'career', 'hedo-anonymous-v1': 'identity', 'hedo-island-v1': 'island' });
  const value = saved();
  assert.equal(STORAGE_KEY, 'hedo-arpg-v1');
  assert.equal(writeProgress(storage, value), true);
  const restored = readProgress(storage);
  assert.ok(restored);
  assert.deepEqual(restored.equipped, value.equipped);
  assert.deepEqual([restored.level, restored.xp, restored.gold, restored.wins], [4, 78, 125, 2]);
  assert.deepEqual(restored.inventory.map(entry => ({ id: entry.id, baseId: entry.baseId, rarity: entry.rarity,
    attack: entry.attack, armor: entry.armor, maxHp: entry.maxHp, energyRegen: entry.energyRegen })),
  value.inventory.map(entry => ({ id: entry.id, baseId: entry.baseId, rarity: entry.rarity,
    attack: entry.attack, armor: entry.armor, maxHp: entry.maxHp, energyRegen: entry.energyRegen })));
  const game = createGame({ progress: restored });
  assert.deepEqual([game.player.attack, game.player.armor, game.player.maxHp], [59, 15, 228]);
  assert.ok(Math.abs(game.player.energyRegen - 13.9) < 1e-9);
  assert.equal(writeProgress(storage, getProgress(game)), true);
  assert.deepEqual(readProgress(storage), restored);
  assert.deepEqual(storage.reads, [STORAGE_KEY, STORAGE_KEY]);
  assert.deepEqual(storage.writes, [STORAGE_KEY, STORAGE_KEY]);
  assert.equal(clearProgress(storage), true);
  assert.equal(readProgress(storage), null);
  assert.deepEqual(storage.removals, [STORAGE_KEY]);
  assert.equal(storage.entries.get('hedo-life-v3'), 'career');
  assert.equal(storage.entries.get('hedo-anonymous-v1'), 'identity');
  assert.equal(storage.entries.get('hedo-island-v1'), 'island');
});

test('missing, malformed, oversized and unsupported records never become progress', () => {
  for (const raw of [null, undefined, '', '{bad json', 'undefined', 7, {}, ' '.repeat(100_001)]) {
    assert.equal(readProgress({ getItem: () => raw }), null);
  }
  for (const value of [null, false, [], {}, 'save', { ...saved(), version: 0 }, { ...saved(), version: 2 },
    { ...saved(), version: '1' }, { ...saved(), inventory: {} }, { ...saved(), equipped: [] }]) {
    assert.equal(readValue(value), null);
  }
});

test('level, XP, money and clears reject nonnumeric or out-of-range values', () => {
  const invalid = {
    level: [0, 51, 1.5, '4', null], xp: [-1, 136, 1.2, '78', null],
    gold: [-1, 1_000_000, 0.5, '125', null], wins: [-1, 100, 0.2, '2', null],
  };
  for (const [field, values] of Object.entries(invalid)) {
    for (const value of values) assert.equal(readValue({ ...saved(), [field]: value }), null, `${field}=${value}`);
  }
});

test('unknown bases, rarities, mismatched slots, duplicate loot and broken equipment reject the record', () => {
  const mutations = [
    value => { value.inventory[0].baseId = 'diablo-sword'; },
    value => { value.inventory[0].baseId = 'constructor'; },
    value => { value.inventory[0].rarity = 'legendary'; },
    value => { value.inventory[0].rarity = '__proto__'; },
    value => { value.inventory[0].slot = 'armor'; },
    value => { value.inventory[0].attack = 101; },
    value => { value.inventory[0].attack = -1; },
    value => { value.inventory[0].armor = 61; },
    value => { value.inventory[0].maxHp = 201; },
    value => { value.inventory[0].energyRegen = 11; },
    value => { value.inventory[0].attack = '28'; },
    value => { value.inventory[0].attack = null; },
    value => { value.inventory[0].id = ''; },
    value => { value.inventory[0].id = 'x'.repeat(65); },
    value => { value.inventory.push({ ...value.inventory[0] }); },
    value => { value.inventory = Array.from({ length: 61 }, (_, index) => item('keyboard', { id: `loot-${index}` })); },
    value => { value.equipped.weapon = 'missing-loot'; },
    value => { value.equipped.weapon = 'test-hoodie'; },
    value => { value.equipped.charm = {}; },
  ];
  for (const mutate of mutations) {
    const value = saved(); mutate(value);
    assert.equal(readValue(value), null, mutate.toString());
  }
});

test('only canonical fields survive and supplied keys cannot change object prototypes', () => {
  const value = saved();
  value.token = 'never-save';
  value.player = { hp: 99999 };
  value.inventory[0].script = '<script>untrusted</script>';
  value.equipped.unrecognized = 'test-keyboard';
  const raw = JSON.stringify(value).replace('"version":1', '"version":1,"__proto__":{"arpgPolluted":true}');
  const restored = readProgress({ getItem: () => raw });
  assert.ok(restored);
  assert.equal(Object.hasOwn(restored, 'token'), false);
  assert.equal(Object.hasOwn(restored, 'player'), false);
  assert.equal(Object.hasOwn(restored, '__proto__'), false);
  assert.equal(Object.hasOwn(restored.inventory[0], 'script'), false);
  assert.equal(Object.hasOwn(restored.equipped, 'unrecognized'), false);
  assert.equal(Object.prototype.arpgPolluted, undefined);
  const inherited = Object.create(saved());
  assert.equal(writeProgress(memoryStorage(), inherited), false);
});

test('storage denial and hostile supplied objects fail without touching existing progress', () => {
  const failure = () => { throw new Error('storage denied'); };
  for (const storage of [null, undefined, {}, { getItem: failure, setItem: failure, removeItem: failure },
    new Proxy({}, { get: failure })]) {
    assert.equal(readProgress(storage), null);
    assert.equal(writeProgress(storage, saved()), false);
    assert.equal(clearProgress(storage), false);
  }
  const storage = memoryStorage();
  assert.equal(writeProgress(storage, saved()), true);
  const previous = storage.entries.get(STORAGE_KEY);
  assert.equal(writeProgress(storage, { ...saved(), level: Infinity }), false);
  assert.equal(writeProgress(storage, Object.defineProperty({}, 'version', { get: failure })), false);
  assert.equal(writeProgress(storage, new Proxy({}, { get: failure })), false);
  assert.equal(storage.entries.get(STORAGE_KEY), previous);
});

class FakeElement extends EventTarget {
  constructor(tagName = 'div', skill) {
    super();
    this.tagName = tagName;
    this.dataset = skill ? { skill } : {};
    this.style = {};
    this.classes = new Set();
    this.classList = { toggle: (name, enabled) => enabled ? this.classes.add(name) : this.classes.delete(name) };
    this.captures = new Set();
  }
  closest() { return ['input', 'textarea', 'select', 'button', 'a', 'dialog'].includes(this.tagName) ? this : null; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; }
  setPointerCapture(id) { this.captures.add(id); }
  hasPointerCapture(id) { return this.captures.has(id); }
  releasePointerCapture(id) { this.captures.delete(id); }
}

function dispatch(target, type, properties = {}) {
  const event = new Event(type, { cancelable: true });
  for (const [name, value] of Object.entries(properties)) Object.defineProperty(event, name, { value });
  target.dispatchEvent(event);
  return event;
}

function inputs(t) {
  const doc = new EventTarget(), win = new EventTarget();
  const canvas = new FakeElement('canvas'), joystick = new FakeElement(), knob = new FakeElement();
  const skills = Object.fromEntries(['attack', 'burst', 'dash', 'potion'].map(skill => [skill, new FakeElement('button', skill)]));
  const state = { active: true, actions: [] };
  const input = createInput({ canvas, joystick, knob, buttons: { querySelectorAll: () => Object.values(skills) }, doc, win,
    isActive: () => state.active, onAction: action => state.actions.push(action), onAim: (x, y) => ({ x: x / 10, z: y / 10 }) });
  const key = (type, code, extra = {}) => dispatch(doc, type, { code, target: canvas, repeat: false, ...extra });
  const pointer = (target, type, id, extra = {}) => dispatch(target, type, {
    pointerId: id, pointerType: 'touch', button: 0, clientX: 50, clientY: 50, ...extra,
  });
  t.after(() => input.destroy());
  return { doc, win, canvas, joystick, knob, skills, state, input, key, pointer };
}

const idleInput = { x: 0, z: 0, attack: false, burst: false, dash: false, potion: false };

test('ARPG input normalizes diagonal movement, holds attacks and consumes skills once', t => {
  const h = inputs(t);
  h.key('keydown', 'KeyW'); h.key('keydown', 'ArrowRight'); h.key('keydown', 'Space');
  h.key('keydown', 'KeyQ'); h.key('keydown', 'ShiftLeft'); h.key('keydown', 'KeyE');
  const first = h.input.read();
  assert.equal(Math.hypot(first.x, first.z), 1);
  assert.ok(first.x > 0 && first.z < 0);
  assert.deepEqual([first.attack, first.burst, first.dash, first.potion], [true, true, true, true]);
  assert.deepEqual(h.input.read(), { ...first, burst: false, dash: false, potion: false });
  h.key('keydown', 'KeyQ', { repeat: true });
  assert.equal(h.input.read().burst, false);
  h.key('keyup', 'KeyQ'); h.key('keydown', 'KeyQ');
  assert.equal(h.input.read().burst, true);
});

test('ARPG touch joystick and multiple skill pointers remain independent', t => {
  const h = inputs(t);
  h.pointer(h.joystick, 'pointerdown', 1, { clientX: 90 });
  h.pointer(h.skills.attack, 'pointerdown', 2);
  h.pointer(h.skills.burst, 'pointerdown', 3);
  assert.deepEqual(h.input.read(), { ...idleInput, x: 1, attack: true, burst: true });
  assert.equal(h.skills.attack.classes.has('pressed'), true);
  h.pointer(h.win, 'pointerup', 3);
  assert.deepEqual(h.input.read(), { ...idleInput, x: 1, attack: true });
  h.pointer(h.win, 'pointerup', 2);
  assert.deepEqual(h.input.read(), { ...idleInput, x: 1 });
  h.pointer(h.win, 'pointerup', 1);
  assert.deepEqual(h.input.read(), idleInput);
  assert.equal(h.joystick.captures.size, 0);
  assert.equal(h.skills.attack.classes.has('pressed'), false);
});

test('ARPG mouse clicks retain one attack and touch canvas only updates aim', t => {
  const h = inputs(t);
  h.pointer(h.canvas, 'pointerdown', 1, { pointerType: 'mouse', clientX: 90, clientY: 20 });
  h.pointer(h.win, 'pointerup', 1);
  assert.deepEqual(h.input.read(), { ...idleInput, attack: true, aim: { x: 9, z: 2 } });
  assert.deepEqual(h.input.read(), { ...idleInput, aim: { x: 9, z: 2 } });
  h.pointer(h.canvas, 'pointerdown', 2, { clientX: 30, clientY: 70 });
  assert.deepEqual(h.input.read(), { ...idleInput, aim: { x: 3, z: 7 } });
});

test('ARPG interruptions release every source and discard unconsumed actions', t => {
  const h = inputs(t);
  const interruptions = [
    () => dispatch(h.win, 'blur'), () => dispatch(h.win, 'pagehide'),
    () => { h.doc.hidden = true; dispatch(h.doc, 'visibilitychange'); h.doc.hidden = false; },
    () => h.pointer(h.win, 'pointercancel', 1),
    () => { h.state.active = false; h.input.read(); h.state.active = true; },
    () => dispatch(h.doc, 'focusin', { target: new FakeElement('button') }),
  ];
  for (const interrupt of interruptions) {
    h.key('keydown', 'KeyW'); h.key('keydown', 'KeyQ'); h.pointer(h.skills.attack, 'pointerdown', 2);
    h.pointer(h.joystick, 'pointerdown', 1, { clientX: 90 });
    interrupt();
    assert.deepEqual(h.input.read(), idleInput);
    h.key('keydown', 'KeyW', { repeat: true });
    h.key('keydown', 'KeyQ', { repeat: true });
    assert.deepEqual(h.input.read(), idleInput, 'autorepeat after interruption must not revive a held key');
    assert.equal(h.skills.attack.classes.has('pressed'), false);
    assert.equal(h.joystick.captures.size, 0);
  }
});

test('ARPG controls preserve native dialog/button keys and modified browser shortcuts', t => {
  const h = inputs(t);
  for (const tag of ['input', 'textarea', 'select', 'button', 'a', 'dialog']) {
    for (const code of ['Space', 'ArrowDown', 'Escape', 'KeyI']) {
      assert.equal(h.key('keydown', code, { target: new FakeElement(tag) }).defaultPrevented, false);
    }
  }
  for (const modifier of ['ctrlKey', 'metaKey', 'altKey']) {
    assert.equal(h.key('keydown', 'KeyW', { [modifier]: true }).defaultPrevented, false);
  }
  assert.deepEqual(h.input.read(), idleInput);
  assert.deepEqual(h.state.actions, []);
  h.key('keydown', 'KeyI'); h.key('keydown', 'Escape');
  assert.deepEqual(h.state.actions, ['inventory', 'pause']);
  h.input.destroy();
  h.key('keydown', 'KeyW');
  assert.deepEqual(h.input.read(), idleInput);
});
