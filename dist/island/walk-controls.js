// Keyboard and touch share one input state; every interruption releases it.
export function bindWalkControls({ pad, canMove, onMove, onInteract, onHome, doc = document, win = window }) {
  const keys = new Set();
  const pointers = new Map();
  const directions = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right' };
  const editable = target => target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="slider"]');
  const listeners = [];
  function listen(target, name, callback) { target.addEventListener(name, callback); listeners.push(() => target.removeEventListener(name, callback)); }
  function update() {
    const held = new Set([...keys].map(key => directions[key]).concat([...pointers.values()].map(p => p.direction)));
    onMove(canMove() ? { x: Number(held.has('right')) - Number(held.has('left')), z: Number(held.has('down')) - Number(held.has('up')) } : { x: 0, z: 0 });
    pad.querySelectorAll('[data-walk]').forEach(node => node.classList.toggle('is-held', held.has(node.dataset.walk)));
  }
  function clear() { keys.clear(); pointers.clear(); update(); }
  listen(doc, 'keydown', event => {
    if (!canMove() || editable(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
    if (directions[event.code]) { event.preventDefault(); keys.add(event.code); update(); }
    else if ((event.code === 'KeyE' || (event.code === 'Space' && !event.target?.closest?.('button,a'))) && !event.repeat) {
      event.preventDefault(); clear(); onInteract();
    } else if (event.code === 'Home' && !event.repeat) { event.preventDefault(); clear(); onHome(); }
  });
  listen(doc, 'keyup', event => { if (keys.delete(event.code)) { event.preventDefault(); update(); } });
  listen(pad, 'pointerdown', event => {
    const node = event.target.closest('[data-walk]');
    if (!node || !canMove() || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault(); node.setPointerCapture?.(event.pointerId);
    pointers.set(event.pointerId, { direction: node.dataset.walk }); update();
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(pad, type, event => { if (pointers.delete(event.pointerId)) update(); });
  listen(doc, 'focusin', event => { if (editable(event.target) || event.target?.closest?.('dialog,aside,header')) clear(); });
  listen(win, 'blur', clear);
  listen(doc, 'visibilitychange', clear);
  listen(win, 'pagehide', clear);
  return { clear, destroy() { clear(); listeners.forEach(remove => remove()); } };
}
