import test from 'node:test';
import assert from 'node:assert/strict';
import { bindIslandBrawlInput } from '../dist/island/brawl-ui.js';

class Surface {
  listeners = new Map();
  style = { values: new Map(), setProperty(name, value) { this.values.set(name, value); } };
  classes = new Set();
  classList = { add: name => this.classes.add(name), remove: name => this.classes.delete(name) };
  dataset = {};
  addEventListener(type, handler) { const list = this.listeners.get(type) || []; list.push(handler); this.listeners.set(type, list); }
  removeEventListener(type, handler) { this.listeners.set(type, (this.listeners.get(type) || []).filter(item => item !== handler)); }
  emit(type, extra = {}) {
    const event = { target: this, pointerId: 1, detail: 1, repeat: false, prevented: false, stopped: false,
      preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; }, stopPropagation() { this.stopped = true; }, ...extra };
    for (const handler of [...this.listeners.get(type) || []]) handler(event);
    return event;
  }
  setPointerCapture() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: 132, height: 132 }; }
  closest(selector) { return selector === '[data-brawl-move]' && this.dataset.brawlMove ? this : null; }
  count() { return [...this.listeners.values()].reduce((sum, rows) => sum + rows.length, 0); }
}
function fixture() {
  const document = new Surface(), window = new Surface(), pad = new Surface();
  const buttons = Object.fromEntries(['attack', 'dodge', 'special', 'throw'].map(action => [action, new Surface()]));
  const directionButtons = ['up', 'left', 'right', 'down'].map(direction => { const node = new Surface(); node.dataset.brawlMove = direction; return node; });
  let phase = 'playing', pauses = 0, starts = 0;
  const controls = bindIslandBrawlInput({ document, window, pad, buttons, directionButtons, getPhase: () => phase,
    onPause: () => { phase = 'paused'; pauses++; }, onStart: () => { phase = 'playing'; starts++; } });
  return { document, window, pad, buttons, directionButtons, controls, setPhase: value => { phase = value; }, getPauses: () => pauses, getStarts: () => starts };
}
const keyboard = (surface, type, code, extra = {}) => surface.emit(type, { code, ...extra });

test('brief keyboard and pointer attacks survive between frames, while holding repeats until released', () => {
  const f = fixture();
  const key = keyboard(f.document, 'keydown', 'KeyJ'); keyboard(f.document, 'keyup', 'KeyJ');
  assert.equal(key.prevented, true); assert.equal(key.stopped, true);
  assert.equal(f.controls.read().attack, true); assert.equal(f.controls.read().attack, false);
  keyboard(f.document, 'keydown', 'KeyJ');
  assert.equal(f.controls.read().attack, true); assert.equal(f.controls.read().attack, true);
  keyboard(f.document, 'keyup', 'KeyJ'); assert.equal(f.controls.read().attack, false);
  f.buttons.attack.emit('pointerdown', { pointerId: 5 }); f.window.emit('pointerup', { pointerId: 5 });
  assert.equal(f.controls.read().attack, true); assert.equal(f.controls.read().attack, false);
  f.buttons.attack.emit('click', { detail: 0 }); assert.equal(f.controls.read().attack, true);
  f.controls.destroy();
});

test('movement is normalized and a short or accessible direction activation moves once', () => {
  const f = fixture();
  keyboard(f.document, 'keydown', 'KeyD'); keyboard(f.document, 'keyup', 'KeyD');
  assert.equal(f.controls.read().x, 1); assert.equal(f.controls.read().x, 0);
  keyboard(f.document, 'keydown', 'KeyW'); keyboard(f.document, 'keydown', 'ArrowRight');
  const diagonal = f.controls.read(); assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.y) - 1) < 1e-9); assert.ok(diagonal.x > 0 && diagonal.y < 0);
  assert.ok(Math.abs(diagonal.x + diagonal.y) < 1e-9, 'a tap buffer does not bias a held diagonal toward the last key');
  f.controls.clear(); f.directionButtons.find(node => node.dataset.brawlMove === 'left').emit('click', { detail: 0 });
  assert.equal(f.controls.read().x, -1); assert.equal(f.controls.read().x, 0);
  f.controls.destroy();
});

test('dodge, special and throw are single pulses and key-repeat cannot queue a second activation', () => {
  const f = fixture();
  for (const [code, action] of [['Space', 'dodge'], ['KeyK', 'special'], ['KeyL', 'throw']]) {
    keyboard(f.document, 'keydown', code); keyboard(f.document, 'keyup', code);
    assert.equal(f.controls.read()[action], true); assert.equal(f.controls.read()[action], false);
    keyboard(f.document, 'keydown', code, { repeat: true }); assert.equal(f.controls.read()[action], false);
    f.buttons[action].emit('pointerdown', { pointerId: 7 }); f.window.emit('pointerup', { pointerId: 7 });
    assert.equal(f.controls.read()[action], true); assert.equal(f.controls.read()[action], false);
  }
  f.controls.destroy();
});

test('touch movement and attack can coexist, and cancellation clears every held input', () => {
  const f = fixture();
  f.pad.emit('pointerdown', { pointerId: 1, clientX: 106, clientY: 66 });
  f.buttons.attack.emit('pointerdown', { pointerId: 2 });
  const input = f.controls.read(); assert.ok(input.x > .8); assert.equal(input.attack, true);
  f.window.emit('pointercancel', { pointerId: 1 });
  assert.deepEqual(f.controls.read(), { x: 0, y: 0, dodge: false, special: false, throw: false, attack: false });
  assert.equal(f.pad.style.values.get('--brawl-stick-x'), '0px'); assert.equal(f.buttons.attack.classes.has('is-held'), false);
  f.controls.destroy();
});

test('blur, hidden tabs and Escape pause without leaving stale movement or attack', () => {
  for (const interrupt of ['blur', 'visibilitychange', 'escape']) {
    const f = fixture(); keyboard(f.document, 'keydown', 'KeyD'); f.buttons.attack.emit('pointerdown', { pointerId: 2 });
    if (interrupt === 'blur') f.window.emit('blur');
    else if (interrupt === 'visibilitychange') { f.document.hidden = true; f.document.emit('visibilitychange'); }
    else keyboard(f.document, 'keydown', 'Escape');
    assert.equal(f.getPauses(), 1, interrupt);
    assert.deepEqual(f.controls.read(), { x: 0, y: 0, dodge: false, special: false, throw: false, attack: false });
    keyboard(f.document, 'keydown', 'KeyJ'); assert.equal(f.controls.read().attack, false, 'paused controls cannot attack');
    f.controls.destroy();
  }
});

test('ready Enter starts once, and destroy removes all document/window/pointer owners', () => {
  const f = fixture(); f.setPhase('ready'); keyboard(f.document, 'keydown', 'Enter');
  assert.equal(f.getStarts(), 1);
  keyboard(f.document, 'keydown', 'KeyJ'); f.controls.destroy(); f.controls.destroy();
  for (const surface of [f.document, f.window, f.pad, ...Object.values(f.buttons), ...f.directionButtons]) assert.equal(surface.count(), 0);
  assert.deepEqual(f.controls.read(), { x: 0, y: 0, dodge: false, special: false, throw: false, attack: false });
  f.window.emit('blur'); assert.equal(f.getPauses(), 0);
});

test('Escape before the first frame can cancel the native dialog without starting or forfeiting', () => {
  const f = fixture(); f.setPhase('ready');
  const escape = keyboard(f.document, 'keydown', 'Escape');
  assert.equal(escape.prevented, false);
  assert.equal(escape.stopped, false);
  assert.equal(f.getStarts(), 0);
  assert.equal(f.getPauses(), 0);
  assert.deepEqual(f.controls.read(), { x: 0, y: 0, dodge: false, special: false, throw: false, attack: false });
  f.controls.destroy();
});

test('the skill dossier keeps native Enter and Space disclosure keys without starting or attacking', () => {
  for (const phase of ['ready', 'playing', 'paused']) {
    const f = fixture(); f.setPhase(phase);
    const summary = { closest: selector => selector === 'summary, [data-brawl-dossier]' ? summary : null };
    for (const code of ['Enter', 'Space', 'KeyJ', 'KeyD']) {
      for (const type of ['keydown', 'keyup']) {
        const event = keyboard(f.document, type, code, { target: summary });
        assert.equal(event.prevented, false, `${phase}/${type}/${code}: native dossier interaction stays available`);
        assert.equal(event.stopped, false);
      }
      assert.deepEqual(f.controls.read(), { x: 0, y: 0, dodge: false, special: false, throw: false, attack: false });
    }
    assert.equal(f.getStarts(), 0); assert.equal(f.getPauses(), 0);
    if (phase === 'playing') {
      keyboard(f.document, 'keydown', 'KeyJ'); assert.equal(f.controls.read().attack, true);
      keyboard(f.document, 'keyup', 'KeyJ', { target: summary });
      assert.equal(f.controls.read().attack, false, 'releasing a held attack over the dossier still clears it');
      const escape = keyboard(f.document, 'keydown', 'Escape', { target: summary });
      assert.equal(escape.prevented, true); assert.equal(f.getPauses(), 1, 'Escape still pauses from inside the dossier');
    }
    f.controls.destroy();
  }
});
