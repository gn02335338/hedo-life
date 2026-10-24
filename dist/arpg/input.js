const SKILLS = ['attack', 'burst', 'dash', 'potion'];
const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']);
const ATTACK_KEYS = new Set(['Space', 'KeyJ']);
const ONE_SHOTS = { KeyQ: 'burst', ShiftLeft: 'dash', ShiftRight: 'dash', KeyE: 'potion' };
const INTERACTIVE = 'input, textarea, select, button, a, [contenteditable]:not([contenteditable="false"]), [role="button"], [role="textbox"], dialog, [role="dialog"]';

// Keyboard, pointer and touch share one frame snapshot. Every interruption
// releases held controls, so returning from a panel cannot queue an old attack.
export function createInput({ canvas, joystick, joystickZone, knob, buttons, isActive = () => true, onAction = () => {}, onActionGesture = () => {}, onAim = () => null, doc = document, win = window }) {
  const keys = new Set();
  const pulses = new Set();
  const skillPointers = new Map();
  const mousePointers = new Set();
  const captures = new Map();
  const cleanups = [];
  const skillButtons = new Map();
  let stickId = null;
  let stick = { x: 0, z: 0 };
  let stickOrigin = null;
  let stickRadius = 36;
  let aim = null;
  let destroyed = false;
  knob ||= joystick?.querySelector?.('.stick-knob');
  const stickSurface = joystickZone || joystick;

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

  function gesture(event) {
    try { onActionGesture(event); } catch { /* Optional sound must never break a control. */ }
  }

  function clearTouchAim(event) {
    if (event.pointerType !== 'mouse') aim = null;
  }

  function resetStick() {
    stickId = null;
    stickOrigin = null;
    stick = { x: 0, z: 0 };
    if (joystickZone && joystick?.style) {
      joystick.style.left = '';
      joystick.style.top = '';
      joystick.style.bottom = '';
    }
    paintStick();
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
    resetStick();
    aim = null;
    const ids = [...captures.keys()];
    for (const id of ids) releaseCapture(id);
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
      if (!event.repeat && !keys.has(code)) { gesture(event); clear(); onAction(action); }
      return;
    }
    if (!MOVE_KEYS.has(code) && !ATTACK_KEYS.has(code) && !Object.hasOwn(ONE_SHOTS, code)) return;
    event.preventDefault();
    // A key held while a panel or blur cleared input must be released before
    // it can start again; OS autorepeat is not a fresh gameplay gesture.
    if (event.repeat && !keys.has(code)) return;
    if (keys.has(code)) return;
    gesture(event);
    keys.add(code);
    if (Object.hasOwn(ONE_SHOTS, code)) pulses.add(ONE_SHOTS[code]);
    paint();
  });
  // Always accept key releases, including after focus moved into a dialog.
  listen(doc, 'keyup', event => { keys.delete(event.code); paint(); });

  function updateAim(event) {
    if (event.pointerType !== 'mouse' || event.sourceCapabilities?.firesTouchEvents) { aim = null; return; }
    try {
      const value = onAim(event.clientX, event.clientY);
      if (value && Number.isFinite(value.x) && Number.isFinite(value.z)) aim = { x: value.x, z: value.z };
      else aim = null;
    } catch { aim = null; /* A stale world target should not survive a changed layout. */ }
  }

  function updateStick(event) {
    if (event.pointerId !== stickId) return;
    if (!enabled(event)) return;
    event.preventDefault();
    const radius = stickRadius;
    const dx = event.clientX - stickOrigin.x;
    const dy = event.clientY - stickOrigin.y;
    const length = Math.hypot(dx, dy);
    if (!Number.isFinite(length)) return;
    const scale = length > radius ? radius / length : 1;
    // Remap the radial deadzone to zero continuously; crossing it never jumps
    // straight to 12% speed. Direction remains stable beyond the visual radius.
    const magnitude = Math.max(0, (Math.min(1, length / radius) - .09) / .91);
    stick = length > 0 && magnitude > 0 ? { x: dx / length * magnitude, z: dy / length * magnitude } : { x: 0, z: 0 };
    paintStick(dx * scale, dy * scale);
  }

  listen(stickSurface, 'pointerdown', event => {
    if (!enabled(event) || stickId !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const rect = stickSurface.getBoundingClientRect();
    if (![event.clientX, event.clientY].every(Number.isFinite) || event.clientX < rect.left || event.clientX > rect.left + rect.width || event.clientY < rect.top || event.clientY > rect.top + rect.height) return;
    event.preventDefault();
    gesture(event);
    clearTouchAim(event);
    focusCanvas();
    stickId = event.pointerId;
    stickOrigin = { x: event.clientX, y: event.clientY };
    const base = joystick.getBoundingClientRect();
    stickRadius = Math.max(24, Math.min(48, Math.min(base.width, base.height) * .34));
    if (joystickZone && joystick?.style) {
      // Only the drawing is clamped at the screen edge; the exact press remains
      // the input origin, so a thumb near a safe-area inset still starts at zero.
      const half = base.width / 2, halfHeight = base.height / 2;
      joystick.style.left = `${Math.max(0, Math.min(rect.width - base.width, event.clientX - rect.left - half))}px`;
      joystick.style.top = `${Math.max(0, Math.min(rect.height - base.height, event.clientY - rect.top - halfHeight))}px`;
      joystick.style.bottom = 'auto';
    }
    capture(stickSurface, event.pointerId);
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
      gesture(event);
      clearTouchAim(event);
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
      gesture(event);
      pulses.add(skill);
    });
    listen(button, 'lostpointercapture', event => releasePointer(event, true));
  }

  listen(canvas, 'pointerdown', event => {
    if (!enabled(event) || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    gesture(event);
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

  function releasePointer(event, cancelled = false) {
    const id = event.pointerId;
    const skill = skillPointers.get(id);
    const mouseAttack = mousePointers.has(id);
    skillPointers.delete(id);
    mousePointers.delete(id);
    if (cancelled) {
      if (skill && !pressed(skill)) pulses.delete(skill);
      if (mouseAttack && !pressed('attack')) pulses.delete('attack');
    }
    if (id === stickId) {
      resetStick();
    }
    releaseCapture(id);
    paint();
  }

  listen(win, 'pointerup', releasePointer);
  listen(win, 'pointercancel', clear);
  listen(stickSurface, 'lostpointercapture', event => releasePointer(event, true));
  listen(canvas, 'lostpointercapture', event => releasePointer(event, true));
  for (const surface of [canvas, stickSurface, buttons]) listen(surface, 'contextmenu', event => {
    if (active()) event.preventDefault();
  });
  listen(win, 'blur', clear);
  listen(win, 'pagehide', clear);
  listen(win, 'resize', clear);
  listen(win, 'orientationchange', clear);
  listen(win?.screen?.orientation, 'change', clear);
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
