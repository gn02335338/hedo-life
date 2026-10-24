// Input owns gestures only. Movement, camera angles and game state stay in app.js.
export function createGameInput({ canvas, joystick, knob, lookPad, pedals, fireButton, isActive = () => true,
  isWalking = () => true, isArmed = () => false, onAction = () => {}, onLook = () => {}, onUnlock = () => {} } = {}) {
  const keys = new Set();
  const boostPointers = new Set();
  const brakePointers = new Set();
  const firePointers = new Set();
  const captures = new Map();
  const cleanups = [];
  const pedalPointers = new Map();
  const movement = new Set(['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'Space', 'KeyX', 'KeyZ']);
  const actions = { KeyF: 'vehicle', KeyE: 'interact', KeyR: 'reload', KeyH: 'reset', KeyQ: 'cycleWeapon', Tab: 'weapons', Digit1: 'unarmed', Digit2: 'pistol', Digit3: 'smg', KeyM: 'map', KeyG: 'garage', KeyJ: 'jobs', KeyV: 'camera', KeyC: 'camera', Escape: 'pause' };
  let joystickPointer = null, touchLookPointer = null, dragPointer = null;
  let joystickCenter = { x: 0, y: 0 }, joystickRadius = 46;
  let analog = { x: 0, y: 0 }, lastLook = { x: 0, y: 0 }, lastDrag = { x: 0, y: 0 };
  let jumpPending = false, intentionalUnlock = false, wasLocked = false, disposed = false;
  let mouseFire = false, mouseAim = false, aimLatched = false;
  const pedalButtons = pedals?.dataset?.control ? [pedals]
    : pedals?.querySelectorAll ? [...pedals.querySelectorAll('[data-control]')]
      : pedals ? [...pedals] : [];

  function listen(target, type, handler, options) {
    if (!target) return;
    target.addEventListener(type, handler, options);
    cleanups.push(() => target.removeEventListener(type, handler, options));
  }
  function capture(target, id) {
    try { target.setPointerCapture(id); captures.set(id, target); } catch { /* Gesture may already have ended. */ }
  }
  function release(id) {
    const target = captures.get(id); captures.delete(id);
    try { if (target?.hasPointerCapture(id)) target.releasePointerCapture(id); } catch { /* Browser canceled this pointer. */ }
  }
  function moveKnob(x = 0, y = 0) {
    if (knob) knob.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
  }
  function clear() {
    keys.clear(); boostPointers.clear(); brakePointers.clear(); jumpPending = false;
    firePointers.clear(); mouseFire = mouseAim = aimLatched = false;
    fireButton?.classList.remove('pressed');
    analog = { x: 0, y: 0 }; joystickPointer = touchLookPointer = dragPointer = null;
    pedalPointers.clear(); pedalButtons.forEach(button => button.classList.remove('pressed'));
    joystick?.classList.remove('pressed'); lookPad?.classList.remove('pressed'); moveKnob();
    for (const id of [...captures.keys()]) release(id);
  }
  const active = () => !disposed && isActive();
  const isTextEntry = target => target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])');
  const focusCanvas = () => canvas?.focus({ preventScroll: true });

  listen(window, 'keydown', event => {
    if (!active() || event.metaKey || event.ctrlKey || event.altKey || isTextEntry(event.target)) return;
    if (movement.has(event.code)) {
      event.preventDefault();
      if (event.code === 'Space' && !keys.has('Space') && !event.repeat && isWalking()) jumpPending = true;
      keys.add(event.code); focusCanvas(); return;
    }
    if (actions[event.code] && !event.repeat) {
      event.preventDefault(); onAction(actions[event.code]);
    }
  });
  listen(window, 'keyup', event => { keys.delete(event.code); });
  listen(window, 'blur', clear);

  function updateJoystick(event) {
    const x = event.clientX - joystickCenter.x, y = event.clientY - joystickCenter.y;
    const distance = Math.hypot(x, y), scale = distance > joystickRadius ? joystickRadius / distance : 1;
    moveKnob(x * scale, y * scale);
    const magnitude = Math.min(1, distance / joystickRadius);
    // A small deadzone prevents a resting thumb from creeping the character.
    const strength = magnitude > .1 ? (magnitude - .1) / .9 : 0;
    analog = distance ? { x: x / distance * strength, y: y / distance * strength } : { x: 0, y: 0 };
  }
  listen(joystick, 'pointerdown', event => {
    if (!active() || joystickPointer !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    const rect = joystick.getBoundingClientRect();
    joystickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    joystickRadius = Math.max(1, Math.min(46, rect.width / 2, rect.height / 2));
    joystickPointer = event.pointerId; capture(joystick, event.pointerId);
    joystick.classList.add('pressed'); updateJoystick(event);
  });
  listen(joystick, 'pointermove', event => {
    if (event.pointerId !== joystickPointer || !active()) return;
    event.preventDefault(); updateJoystick(event);
  });
  function stopJoystick(event) {
    if (event.pointerId !== joystickPointer) return;
    joystickPointer = null; analog = { x: 0, y: 0 }; joystick.classList.remove('pressed'); moveKnob(); release(event.pointerId);
  }
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(joystick, type, stopJoystick);

  for (const button of pedalButtons) {
    listen(button, 'pointerdown', event => {
      if (!active() || (event.pointerType === 'mouse' && event.button !== 0)) return;
      event.preventDefault(); capture(button, event.pointerId);
      pedalPointers.set(event.pointerId, button); button.classList.add('pressed');
      if (button.dataset.control === 'boost') boostPointers.add(event.pointerId);
      if (button.dataset.control === 'brake') {
        if (isWalking()) jumpPending = true;
        else brakePointers.add(event.pointerId);
      }
    });
    const stopPedal = event => {
      if (pedalPointers.get(event.pointerId) !== button) return;
      pedalPointers.delete(event.pointerId); boostPointers.delete(event.pointerId); brakePointers.delete(event.pointerId);
      if (![...pedalPointers.values()].includes(button)) button.classList.remove('pressed');
      release(event.pointerId);
    };
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(button, type, stopPedal);
    listen(button, 'contextmenu', event => event.preventDefault());
  }

  function requestLook() {
    if (!active() || !canvas?.requestPointerLock || window.matchMedia('(pointer: coarse)').matches) return false;
    if (document.pointerLockElement === canvas) return true;
    try {
      const result = canvas.requestPointerLock();
      result?.catch?.(() => {}); // Drag look remains available when the browser refuses a lock.
      return true;
    } catch { return false; }
  }
  function unlock() {
    if (document.pointerLockElement === canvas) {
      intentionalUnlock = true;
      document.exitPointerLock?.();
    }
  }
  listen(document, 'pointerlockchange', () => {
    const locked = document.pointerLockElement === canvas;
    if (locked) {
      intentionalUnlock = false; wasLocked = true;
      if (!active()) unlock();
      return;
    }
    if (wasLocked) {
      wasLocked = false; clear();
      if (!intentionalUnlock) onUnlock();
    }
    intentionalUnlock = false;
  });
  listen(window, 'mousemove', event => {
    if (active() && document.pointerLockElement === canvas) onLook(event.movementX || 0, event.movementY || 0);
  });
  listen(canvas, 'pointerdown', event => {
    if (!active() || event.pointerType === 'touch') return;
    focusCanvas();
    if (event.button === 2 && document.pointerLockElement !== canvas) {
      // Keep the compatibility mousedown: it owns each button in aim/fire chords.
      dragPointer = event.pointerId;
      lastDrag = { x: event.clientX, y: event.clientY }; capture(canvas, event.pointerId);
    }
  });
  listen(canvas, 'pointermove', event => {
    if (!active() || event.pointerId !== dragPointer || document.pointerLockElement === canvas) return;
    event.preventDefault(); onLook(event.clientX - lastDrag.x, event.clientY - lastDrag.y);
    lastDrag = { x: event.clientX, y: event.clientY };
  });
  const stopDrag = event => {
    if (event.pointerId !== dragPointer) return;
    dragPointer = null; release(event.pointerId);
  };
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(canvas, type, stopDrag);
  // Mouse events report each button in a chord. Pointerdown/up only report the
  // first press / last release, so they cannot safely own aim+fire together.
  listen(canvas, 'mousedown', event => {
    if(!active())return;
    if(event.button===0){
      if(document.pointerLockElement===canvas||mouseAim)mouseFire=true;
      else requestLook(); // First click only captures the view.
    }
    if(event.button===2)mouseAim=true;
  });
  listen(window, 'mouseup', event => {
    if (event.button === 0) mouseFire = false;
    if (event.button === 2) mouseAim = false;
  });
  listen(window, 'pointercancel', () => { mouseFire = mouseAim = false; });
  listen(fireButton, 'pointerdown', event => {
    if (!active() || !isWalking() || !isArmed() || fireButton.disabled || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault(); capture(fireButton, event.pointerId); firePointers.add(event.pointerId); fireButton.classList.add('pressed');
  });
  const stopFire = event => {
    firePointers.delete(event.pointerId); release(event.pointerId);
    if (!firePointers.size) fireButton?.classList.remove('pressed');
  };
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(fireButton, type, stopFire);
  listen(fireButton, 'contextmenu', event => event.preventDefault());

  listen(lookPad, 'pointerdown', event => {
    if (!active() || touchLookPointer !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault(); touchLookPointer = event.pointerId;
    lastLook = { x: event.clientX, y: event.clientY }; capture(lookPad, event.pointerId); lookPad.classList.add('pressed');
  });
  listen(lookPad, 'pointermove', event => {
    if (!active() || event.pointerId !== touchLookPointer) return;
    event.preventDefault(); onLook(event.clientX - lastLook.x, event.clientY - lastLook.y);
    lastLook = { x: event.clientX, y: event.clientY };
  });
  const stopLook = event => {
    if (event.pointerId !== touchLookPointer) return;
    touchLookPointer = null; lookPad.classList.remove('pressed'); release(event.pointerId);
  };
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(lookPad, type, stopLook);
  for (const target of [canvas, joystick, lookPad]) listen(target, 'contextmenu', event => event.preventDefault());

  function read() {
    if (!active()) { clear(); return { forward: 0, right: 0, sprint: false, brake: false, jump: false, fire: false, aiming: false }; }
    const forward = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown')) - analog.y;
    const right = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft')) + analog.x;
    const jump = jumpPending && isWalking(); jumpPending = false;
    return {
      forward: Math.max(-1, Math.min(1, forward)), right: Math.max(-1, Math.min(1, right)),
      sprint: keys.has('ShiftLeft') || keys.has('ShiftRight') || boostPointers.size > 0,
      brake: !isWalking() && (keys.has('Space') || brakePointers.size > 0), jump,
      fire: isWalking() && isArmed() && (mouseFire || firePointers.size > 0 || keys.has('KeyX')),
      aiming: isWalking() && isArmed() && (mouseAim || aimLatched || keys.has('KeyZ')),
    };
  }
  function dispose() {
    if (disposed) return;
    clear(); unlock(); disposed = true; cleanups.forEach(cleanup => cleanup());
  }
  moveKnob();
  return { read, clear, dispose, requestLook, unlock, toggleAim() { aimLatched = !aimLatched; return aimLatched; } };
}
