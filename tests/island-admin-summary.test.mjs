import test from 'node:test';
import assert from 'node:assert/strict';
import { createIslandAdminSummary } from '../dist/island/admin-summary.js';

class Events {
  handlers = new Map();
  addEventListener(type, listener) { if (!this.handlers.has(type)) this.handlers.set(type, new Set()); this.handlers.get(type).add(listener); }
  removeEventListener(type, listener) { this.handlers.get(type)?.delete(listener); }
  dispatch(type) { for (const listener of this.handlers.get(type) || []) listener(); }
  get listenerCount() { return [...this.handlers.values()].reduce((count, listeners) => count + listeners.size, 0); }
}
function fixture({ hidden = false } = {}) {
  const badge = { textContent: '', dataset: {}, title: '', attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } };
  const windowTarget = new Events(), documentTarget = new Events(); documentTarget.visibilityState = hidden ? 'hidden' : 'visible';
  const timers = new Map(), calls = []; let nextTimer = 0;
  const controller = createIslandAdminSummary({ badge, windowTarget, documentTarget,
    setTimeoutImpl: (fn, delay) => { const id = ++nextTimer; timers.set(id, { fn, delay }); return id; },
    clearTimeoutImpl: id => timers.delete(id),
    fetcher: (url, options) => new Promise((resolve, reject) => calls.push({ url, options, resolve, reject })),
  });
  const settle = async (index, data, status = 200) => { calls[index].resolve(Response.json(data, { status })); await flush(); };
  const fire = delay => {
    const row = [...timers.entries()].find(([, timer]) => timer.delay === delay); assert.ok(row, `expected ${delay}ms timer`);
    timers.delete(row[0]); row[1].fn();
  };
  return { badge, windowTarget, documentTarget, timers, calls, controller, settle, fire };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('badge fetches the public scalar on load, displays zero, and polls in foreground without credentials', async () => {
  const f = fixture(); assert.equal(f.badge.textContent, '…'); assert.equal(f.badge.dataset.state, 'loading'); assert.equal(f.calls.length, 1);
  const call = f.calls[0]; assert.equal(call.url, '/api/island/application-summary');
  assert.equal(call.options.credentials, 'omit'); assert.equal(call.options.mode, 'same-origin'); assert.equal(call.options.cache, 'no-store'); assert.equal(call.options.headers, undefined);
  await f.settle(0, { pending: 0 }); assert.equal(f.badge.textContent, '0'); assert.equal(f.badge.dataset.state, 'ready'); assert.equal(f.badge.dataset.pending, 'false'); assert.match(f.badge.attributes['aria-label'], /0 件/);
  assert.equal(f.timers.size, 1); f.fire(60000); assert.equal(f.calls.length, 2);
  await f.settle(1, { pending: 12 }); assert.equal(f.badge.textContent, '12'); assert.equal(f.badge.dataset.pending, 'true'); assert.match(f.badge.title, /12 件/);
  f.controller.dispose(); assert.equal(f.timers.size, 0);
});

test('network, HTTP, malformed JSON and invalid counts become unknown instead of a false zero', async () => {
  const cases = [new Error('offline'), { status: 503, body: { pending: 0 } }, { body: { pending: -1 } }, { body: { pending: 1.5 } },
    { body: { pending: '0' } }, { body: {} }, { body: { pending: 0, reason: 'private extra data' } }, { invalidJson: true }];
  for (const failure of cases) {
    const f = fixture(); await f.settle(0, { pending: 4 }); const pending = f.controller.refresh(); assert.equal(f.badge.textContent, '4', 'keep settled count while refreshing');
    if (failure instanceof Error) f.calls[1].reject(failure);
    else if (failure.invalidJson) f.calls[1].resolve({ ok: true, json: async () => { throw new SyntaxError(); } });
    else f.calls[1].resolve(Response.json(failure.body, { status: failure.status || 200 }));
    await pending; assert.equal(f.badge.textContent, '—'); assert.equal(f.badge.dataset.state, 'unknown'); assert.equal(f.badge.dataset.pending, 'false'); assert.match(f.badge.title, /暫時無法取得/);
    f.fire(60000); await f.settle(2, { pending: 0 }); assert.equal(f.badge.textContent, '0', 'a later verified zero recovers the badge'); f.controller.dispose();
  }
});

test('hidden pages stop work and refresh on foreground, focus, and restored pageshow', async () => {
  const f = fixture(); await f.settle(0, { pending: 2 });
  f.documentTarget.visibilityState = 'hidden'; f.documentTarget.dispatch('visibilitychange'); assert.equal(f.timers.size, 0);
  f.windowTarget.dispatch('focus'); await f.controller.refresh(); assert.equal(f.calls.length, 1);
  f.documentTarget.visibilityState = 'visible'; f.documentTarget.dispatch('visibilitychange'); assert.equal(f.calls.length, 2); await f.settle(1, { pending: 3 });
  f.windowTarget.dispatch('focus'); assert.equal(f.calls.length, 3); await f.settle(2, { pending: 4 });
  f.windowTarget.dispatch('pagehide'); assert.equal(f.timers.size, 0); f.windowTarget.dispatch('focus'); assert.equal(f.calls.length, 3);
  f.windowTarget.dispatch('pageshow'); assert.equal(f.calls.length, 4); await f.settle(3, { pending: 1 }); assert.equal(f.badge.textContent, '1'); f.controller.dispose();
  const initiallyHidden = fixture({ hidden: true }); assert.equal(initiallyHidden.calls.length, 0); assert.equal(initiallyHidden.timers.size, 0);
  initiallyHidden.documentTarget.visibilityState = 'visible'; initiallyHidden.documentTarget.dispatch('visibilitychange'); assert.equal(initiallyHidden.calls.length, 1); initiallyHidden.controller.dispose();
});

test('late requests cannot overwrite newer counts, hidden state, or a disposed badge', async () => {
  const f = fixture(); const second = f.controller.refresh(); assert.equal(f.calls[0].options.signal.aborted, true);
  await f.settle(1, { pending: 3 }); await second; await f.settle(0, { pending: 100 }); assert.equal(f.badge.textContent, '3');
  const hiddenRequest = f.controller.refresh();
  f.documentTarget.visibilityState = 'hidden'; f.documentTarget.dispatch('visibilitychange'); assert.equal(f.calls[2].options.signal.aborted, true);
  await f.settle(2, { pending: 50 }); await hiddenRequest; assert.equal(f.badge.textContent, '3'); assert.equal(f.timers.size, 0);
  f.documentTarget.visibilityState = 'visible'; f.documentTarget.dispatch('visibilitychange'); const count = f.calls.length;
  f.controller.dispose(); f.controller.dispose(); assert.equal(f.calls.at(-1).options.signal.aborted, true);
  assert.equal(f.windowTarget.listenerCount + f.documentTarget.listenerCount, 0); assert.equal(f.timers.size, 0);
  await f.settle(count - 1, { pending: 80 }); assert.equal(f.badge.textContent, '3');
  f.windowTarget.dispatch('pageshow'); await f.controller.refresh(); assert.equal(f.calls.length, count); assert.equal(f.timers.size, 0);
});

test('a stalled request times out to unknown and its late response cannot undo recovery', async () => {
  const f = fixture(); f.fire(12000); assert.equal(f.calls[0].options.signal.aborted, true); assert.equal(f.badge.textContent, '—'); assert.equal(f.badge.dataset.state, 'unknown');
  f.fire(60000); await f.settle(1, { pending: 0 }); await f.settle(0, { pending: 99 }); assert.equal(f.badge.textContent, '0'); assert.equal(f.timers.size, 1); f.controller.dispose();
});

test('a missing badge installs no timers, listeners, or requests', async () => {
  const windowTarget = new Events(); let requests = 0;
  const controller = createIslandAdminSummary({ windowTarget, fetcher: () => { requests++; }, setTimeoutImpl: () => { throw new Error('unexpected timer'); } });
  assert.equal(await controller.refresh(), null); controller.dispose(); assert.equal(requests, 0); assert.equal(windowTarget.listenerCount, 0);
});
