const SKILLS = ['attack', 'burst', 'dash', 'potion'];
const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']);
const ATTACK_KEYS = new Set(['Space', 'KeyJ']);
const ONE_SHOTS = { KeyQ: 'burst', ShiftLeft: 'dash', ShiftRight: 'dash', KeyE: 'potion' };
const INTERACTIVE = 'input, textarea, select, button, a, [contenteditable]:not([contenteditable="false"]), [role="button"], [role="textbox"], dialog, [role="dialog"]';

// Keyboard, pointer and touch share one frame snapshot. Every interruption
// releases held controls, so returning from a panel cannot queue an old attack.
export function createInput({ canvas, joystick, knob, buttons, isActive = () => true, onAction = () => {}, onAim = () => null, doc = document, win = window }) {
  const keys = new Set();
  const pulses = new Set();
  const skillPointers = new Map();
  const mousePointers = new Set();
  const captures = new Map();
  const cleanups = [];
  const skillButtons = new Map();
  let stickId = null;
  let stick = { x: 0, z: 0 };
  let aim = null;
  let destroyed = false;
  knob ||= joystick?.querySelector?.('.stick-knob');

  function listen(target, type, handler, options) {
    if (!target?.addEventListener) return;
    target.addEventListener(type, handler, options);
    cleanups.push(() => target.removeEventListener(type, handler, options));
  }

  function active() {
    try { return !destroyed && !doc?.hidden && Boolean(isActive()); } catch { return false; }
  }

  function pressed(skill) {
    if ([...skillPointers.values()].includes(skill)) return true;
    if (skill === 'attack') return mousePointers.size > 0 || [...ATTACK_KEYS].some(key => keys.has(key));
    return Object.entries(ONE_SHOTS).some(([key, action]) => action === skill && keys.has(key));
  }

  function paint() {
    for (const [skill, nodes] of skillButtons) {
      for (const node of nodes) node.classList?.toggle('pressed', pressed(skill));
    }
    joystick?.classList?.toggle('pressed', stickId !== null);
  }

  function paintStick(dx = 0, dy = 0) {
    if (knob?.style) knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }

  function capture(target, id) {
    try { target?.setPointerCapture?.(id); captures.set(id, target); } catch { /* Pointer already ended. */ }
  }

  function releaseCapture(id) {
    const target = captures.get(id);
    captures.delete(id);
    try { if (target?.hasPointerCapture?.(id)) target.releasePointerCapture(id); } catch { /* Already released. */ }
  }

  function clear() {
    keys.clear();
    pulses.clear();
    skillPointers.clear();
    mousePointers.clear();
    stickId = null;
    stick = { x: 0, z: 0 };
    aim = null;
    const ids = [...captures.keys()];
    for (const id of ids) releaseCapture(id);
    paintStick();
    paint();
  }

  function enabled(event) {
    if (active()) return true;
    clear();
    return false;
  }

  function nativeTarget(event) {
    return Boolean(event.target?.closest?.(INTERACTIVE));
  }

  function focusCanvas() {
    try { canvas?.focus?.({ preventScroll: true }); } catch { /* Removed during navigation. */ }
  }

  listen(doc, 'keydown', event => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || nativeTarget(event) || !enabled(event)) return;
    const code = event.code;
    const action = code === 'Escape' ? 'pause' : ['KeyI', 'KeyB'].includes(code) ? 'inventory' : null;
    if (action) {
      event.preventDefault();
      if (!event.repeat && !keys.has(code)) { clear(); onAction(action); }
      return;
    }
    if (!MOVE_KEYS.has(code) && !ATTACK_KEYS.has(code) && !Object.hasOwn(ONE_SHOTS, code)) return;
    event.preventDefault();
    // A key held while a panel or blur cleared input must be released before
    // it can start again; OS autorepeat is not a fresh gameplay gesture.
    if (event.repeat && !keys.has(code)) return;
    if (keys.has(code)) return;
    keys.add(code);
    if (Object.hasOwn(ONE_SHOTS, code)) pulses.add(ONE_SHOTS[code]);
    paint();
  });
  // Always accept key releases, including after focus moved into a dialog.
  listen(doc, 'keyup', event => { keys.delete(event.code); paint(); });

  function updateAim(event) {
    try {
      const value = onAim(event.clientX, event.clientY);
      if (value && Number.isFinite(value.x) && Number.isFinite(value.z)) aim = { x: value.x, z: value.z };
    } catch { /* A renderer may be between layouts; retain the last valid aim. */ }
  }

  function updateStick(event) {
    if (event.pointerId !== stickId) return;
    if (!enabled(event)) return;
    event.preventDefault();
    const rect = joystick.getBoundingClientRect();
    const radius = Math.max(12, Math.min(rect.width, rect.height) * .34);
    const dx = event.clientX - rect.left - rect.width / 2;
    const dy = event.clientY - rect.top - rect.height / 2;
    const length = Math.hypot(dx, dy);
    const scale = length > radius ? radius / length : 1;
    const x = dx * scale / radius, z = dy * scale / radius;
    stick = length / radius < .12 ? { x: 0, z: 0 } : { x, z };
    paintStick(dx * scale, dy * scale);
  }

  listen(joystick, 'pointerdown', event => {
    if (!enabled(event) || stickId !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    focusCanvas();
    stickId = event.pointerId;
    capture(joystick, event.pointerId);
    updateStick(event);
    paint();
  }, { passive: false });
  listen(win, 'pointermove', updateStick, { passive: false });

  for (const button of buttons?.querySelectorAll?.('[data-skill]') || []) {
    const skill = button.dataset.skill;
    if (!SKILLS.includes(skill)) continue;
    if (!skillButtons.has(skill)) skillButtons.set(skill, []);
    skillButtons.get(skill).push(button);
    listen(button, 'pointerdown', event => {
      if (!enabled(event) || (event.pointerType === 'mouse' && event.button !== 0)) return;
      event.preventDefault();
      focusCanvas();
      if (skillPointers.has(event.pointerId)) return;
      skillPointers.set(event.pointerId, skill);
      pulses.add(skill);
      capture(button, event.pointerId);
      paint();
    }, { passive: false });
    // Native keyboard and assistive-technology button activation has no pointer.
    listen(button, 'click', event => {
      if (event.detail !== 0 || !enabled(event)) return;
      event.preventDefault();
      pulses.add(skill);
    });
    listen(button, 'lostpointercapture', event => releasePointer(event));
  }

  listen(canvas, 'pointerdown', event => {
    if (!enabled(event) || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    focusCanvas();
    updateAim(event);
    if (event.pointerType === 'mouse') {
      mousePointers.add(event.pointerId);
      pulses.add('attack');
      capture(canvas, event.pointerId);
      paint();
    }
  }, { passive: false });
  listen(canvas, 'pointermove', event => {
    if (enabled(event)) updateAim(event);
  });

  function releasePointer(event) {
    const id = event.pointerId;
    skillPointers.delete(id);
    mousePointers.delete(id);
    if (id === stickId) {
      stickId = null;
      stick = { x: 0, z: 0 };
      paintStick();
    }
    releaseCapture(id);
    paint();
  }

  listen(win, 'pointerup', releasePointer);
  listen(win, 'pointercancel', clear);
  listen(joystick, 'lostpointercapture', releasePointer);
  listen(canvas, 'lostpointercapture', releasePointer);
  listen(win, 'blur', clear);
  listen(win, 'pagehide', clear);
  listen(doc, 'focusin', event => { if (nativeTarget(event)) clear(); });
  listen(doc, 'visibilitychange', () => { if (doc.hidden) clear(); });

  function read() {
    if (!active()) clear();
    let x = stick.x + Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
    let z = stick.z + Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp'));
    const length = Math.hypot(x, z);
    if (length > 1) { x /= length; z /= length; }
    const value = { x, z, attack: pressed('attack') || pulses.has('attack'), burst: pulses.has('burst'), dash: pulses.has('dash'), potion: pulses.has('potion') };
    if (aim) value.aim = { ...aim };
    pulses.clear();
    return value;
  }

  return {
    read, clear,
    destroy() {
      if (destroyed) return;
      clear();
      destroyed = true;
      for (const cleanup of cleanups) cleanup();
    },
  };
}
