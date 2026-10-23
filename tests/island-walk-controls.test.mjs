import test from 'node:test';
import assert from 'node:assert/strict';
import { bindWalkControls } from '../dist/island/walk-controls.js';

// The adapter receives browser EventTargets; no renderer or live document is needed.
class FakeElement extends EventTarget {
  constructor(tagName, { parent = null, direction, editable, role } = {}) {
    super();
    Object.assign(this, { tagName, parent, editable, role });
    this.dataset = direction ? { walk: direction } : {};
    this.classes = new Set();
    this.capturedPointers = [];
    this.classList = { toggle: (name, enabled) => enabled ? this.classes.add(name) : this.classes.delete(name) };
  }
  matches(selector) {
    if (selector === '[data-walk]') return Boolean(this.dataset.walk);
    if (selector === '[contenteditable]:not([contenteditable="false"])') return this.editable === true;
    if (selector === '[role="slider"]') return this.role === 'slider';
    return selector === this.tagName;
  }
  closest(selectors) {
    for (let node = this; node; node = node.parent) {
      if (selectors.split(',').some(selector => node.matches(selector))) return node;
    }
    return null;
  }
  setPointerCapture(id) { this.capturedPointers.push(id); }
}

function dispatch(surface, type, properties = {}) {
  const event = new Event(type, { cancelable: true });
  for (const [name, value] of Object.entries(properties)) Object.defineProperty(event, name, { value });
  surface.dispatchEvent(event);
  return event;
}

function harness(t) {
  const doc = new EventTarget(), win = new EventTarget();
  const pad = new FakeElement('div');
  const buttons = Object.fromEntries(['up', 'down', 'left', 'right'].map(direction => [direction, new FakeElement('button', { parent: pad, direction })]));
  pad.querySelectorAll = selector => selector === '[data-walk]' ? Object.values(buttons) : [];
  const canvas = new FakeElement('canvas');
  const state = { enabled: true, moves: [], interactions: [], homes: [] };
  const controls = bindWalkControls({
    pad, doc, win, canMove: () => state.enabled,
    onMove: input => state.moves.push(input),
    onInteract: () => state.interactions.push(state.moves.at(-1)),
    onHome: () => state.homes.push(state.moves.at(-1)),
  });
  const key = (type, code, extra = {}) => dispatch(doc, type, { target: canvas, code, repeat: false, ...extra });
  const pointer = (type, direction, pointerId, extra = {}) => dispatch(pad, type, {
    target: buttons[direction], pointerId, pointerType: 'touch', button: 0, ...extra,
  });
  const assertMove = (x, z) => assert.deepEqual(state.moves.at(-1), { x, z });
  t.after(() => controls.destroy());
  return { doc, win, pad, buttons, canvas, state, controls, key, pointer, assertMove };
}

test('simultaneous movement keys cancel opposing directions and release independently', t => {
  const h = harness(t);
  assert.equal(h.key('keydown', 'KeyW').defaultPrevented, true);
  h.key('keydown', 'KeyD'); h.assertMove(1, -1);
  h.key('keydown', 'KeyA'); h.assertMove(0, -1);
  h.key('keyup', 'KeyD'); h.assertMove(-1, -1);
  h.key('keyup', 'KeyW'); h.assertMove(-1, 0);
  h.key('keyup', 'KeyA'); h.assertMove(0, 0);
  assert.equal(h.key('keyup', 'KeyQ').defaultPrevented, false);
  assert.ok(Object.values(h.buttons).every(node => !node.classes.has('is-held')));
});

test('WASD and arrow aliases remain held until both keys are released, including repeats', t => {
  const h = harness(t);
  h.key('keydown', 'KeyW');
  h.key('keydown', 'ArrowUp');
  h.key('keydown', 'KeyW', { repeat: true });
  h.key('keyup', 'KeyW'); h.assertMove(0, -1);
  assert.equal(h.buttons.up.classes.has('is-held'), true);
  h.key('keyup', 'ArrowUp'); h.assertMove(0, 0);
  assert.equal(h.buttons.up.classes.has('is-held'), false);
});

test('multiple touch pointers and keyboard input combine without cancelling each other', t => {
  const h = harness(t);
  h.key('keydown', 'KeyW');
  const icon = new FakeElement('span', { parent: h.buttons.right });
  assert.equal(h.pointer('pointerdown', 'right', 11, { target: icon }).defaultPrevented, true);
  assert.deepEqual(h.buttons.right.capturedPointers, [11]);
  h.assertMove(1, -1);
  h.pointer('pointerdown', 'down', 12); h.assertMove(1, 0);
  h.pointer('pointercancel', 'down', 12); h.assertMove(1, -1);
  h.pointer('lostpointercapture', 'right', 11); h.assertMove(0, -1);
  h.key('keyup', 'KeyW'); h.assertMove(0, 0);
  h.pointer('pointerdown', 'left', 13);
  h.pointer('pointerup', 'left', 13); h.assertMove(0, 0);
});

test('non-primary mouse buttons and touches outside the direction buttons do nothing', t => {
  const h = harness(t);
  assert.equal(h.pointer('pointerdown', 'left', 1, { pointerType: 'mouse', button: 2 }).defaultPrevented, false);
  assert.equal(h.pointer('pointerdown', 'left', 2, { target: h.pad }).defaultPrevented, false);
  assert.deepEqual(h.state.moves, []);
  h.pointer('pointerdown', 'left', 3, { pointerType: 'mouse', button: 0 }); h.assertMove(-1, 0);
});

test('focus entering editable controls, a dialog, the sidebar or header releases all movement', t => {
  const h = harness(t);
  const focusTargets = [
    new FakeElement('input'), new FakeElement('textarea'), new FakeElement('select'),
    new FakeElement('span', { parent: new FakeElement('div', { editable: true }) }),
    new FakeElement('div', { role: 'slider' }),
    ...['dialog', 'aside', 'header'].map(tagName => new FakeElement('button', { parent: new FakeElement(tagName) })),
  ];
  for (const target of focusTargets) {
    h.key('keydown', 'KeyW'); h.pointer('pointerdown', 'right', 1); h.assertMove(1, -1);
    dispatch(h.doc, 'focusin', { target }); h.assertMove(0, 0);
    assert.ok(Object.values(h.buttons).every(node => !node.classes.has('is-held')));
    const count = h.state.moves.length;
    h.key('keyup', 'KeyW'); h.pointer('pointerup', 'right', 1);
    assert.equal(h.state.moves.length, count, 'old releases cannot revive input');
  }
});

test('window blur, pagehide and visibility changes clear held keys and pointers', t => {
  const h = harness(t);
  for (const [surface, event] of [[h.win, 'blur'], [h.win, 'pagehide'], [h.doc, 'visibilitychange']]) {
    h.key('keydown', 'ArrowDown'); h.pointer('pointerdown', 'left', 8); h.assertMove(-1, 1);
    dispatch(surface, event); h.assertMove(0, 0);
    h.key('keydown', 'KeyD'); h.assertMove(1, 0);
    h.key('keyup', 'KeyD'); h.assertMove(0, 0);
  }
});

test('text entry, sliders and modified browser shortcuts are not consumed', t => {
  const h = harness(t);
  const targets = [
    new FakeElement('input'), new FakeElement('textarea'), new FakeElement('select'),
    new FakeElement('span', { parent: new FakeElement('div', { editable: true }) }),
    new FakeElement('div', { role: 'slider' }),
  ];
  for (const code of ['KeyW', 'ArrowLeft', 'KeyE', 'Space', 'Home']) {
    for (const target of targets) assert.equal(h.key('keydown', code, { target }).defaultPrevented, false);
    for (const modifier of ['ctrlKey', 'metaKey', 'altKey']) assert.equal(h.key('keydown', code, { [modifier]: true }).defaultPrevented, false);
  }
  assert.deepEqual(h.state.moves, []);
  assert.deepEqual(h.state.interactions, []);
  assert.deepEqual(h.state.homes, []);
});

test('interaction clears movement before opening a conversation and ignores autorepeat', t => {
  const h = harness(t);
  h.key('keydown', 'KeyW'); h.pointer('pointerdown', 'right', 1);
  assert.equal(h.key('keydown', 'KeyE').defaultPrevented, true);
  assert.deepEqual(h.state.interactions, [{ x: 0, z: 0 }]);
  h.key('keydown', 'KeyE', { repeat: true });
  h.key('keydown', 'Space', { repeat: true });
  assert.equal(h.state.interactions.length, 1);
  assert.equal(h.key('keydown', 'Space').defaultPrevented, true);
  assert.equal(h.state.interactions.length, 2);
  for (const tagName of ['button', 'a']) {
    const target = new FakeElement('span', { parent: new FakeElement(tagName) });
    assert.equal(h.key('keydown', 'Space', { target }).defaultPrevented, false, 'Space remains native activation on controls');
  }
  assert.equal(h.state.interactions.length, 2);
});

test('Home clears movement before leaving the walking view and ignores autorepeat', t => {
  const h = harness(t);
  h.key('keydown', 'ArrowRight');
  assert.equal(h.key('keydown', 'Home').defaultPrevented, true);
  assert.deepEqual(h.state.homes, [{ x: 0, z: 0 }]);
  h.key('keydown', 'Home', { repeat: true });
  assert.equal(h.state.homes.length, 1);
});

test('blocked movement ignores new actions and an explicit clear does not resume old input', t => {
  const h = harness(t);
  h.key('keydown', 'KeyW');
  h.state.enabled = false;
  h.controls.clear(); h.assertMove(0, 0);
  const count = h.state.moves.length;
  for (const code of ['KeyD', 'ArrowRight', 'KeyE', 'Space', 'Home']) assert.equal(h.key('keydown', code).defaultPrevented, false);
  assert.equal(h.pointer('pointerdown', 'left', 4).defaultPrevented, false);
  assert.equal(h.state.moves.length, count);
  assert.deepEqual(h.state.interactions, []);
  assert.deepEqual(h.state.homes, []);
  h.state.enabled = true;
  h.key('keydown', 'KeyD'); h.assertMove(1, 0);
});

test('destroy stops movement and detaches keyboard, pointer and lifecycle listeners', t => {
  const h = harness(t);
  h.key('keydown', 'KeyW'); h.pointer('pointerdown', 'right', 9);
  h.controls.destroy(); h.assertMove(0, 0);
  const count = h.state.moves.length;
  h.key('keydown', 'KeyD'); h.key('keyup', 'KeyW'); h.key('keydown', 'KeyE'); h.key('keydown', 'Home');
  h.pointer('pointerdown', 'right', 10); h.pointer('pointerup', 'right', 9); h.pointer('pointercancel', 'right', 10);
  dispatch(h.doc, 'focusin', { target: new FakeElement('input') });
  dispatch(h.doc, 'visibilitychange'); dispatch(h.win, 'blur'); dispatch(h.win, 'pagehide');
  assert.equal(h.state.moves.length, count);
  assert.deepEqual(h.state.interactions, []);
  assert.deepEqual(h.state.homes, []);
});
