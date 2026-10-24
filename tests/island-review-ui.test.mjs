import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reviewLoginHTML, reviewQueueHTML, createReviewUI } from '../dist/island/review/review.js';

const id = 'b01af760-c2b1-4e2f-a097-7c511a065a79';
const csrf = 'c'.repeat(64);
const application = (extra = {}) => ({
  id, status: 'pending', nickname: '合成島民', districtId: 'cafe', outfit: 'teal',
  greeting: '測試用的公開問候。', introduction: '測試用的公開介紹。', reason: 'PRIVATE_TEST_REASON',
  reviewNote: '', createdAt: '2026-10-24T01:00:00.000Z', reviewedAt: null, ...extra,
});
const queue = (items = [application()], extra = {}) => ({
  items, nextCursor: null, counts: { pending: items.length, approved: 0, rejected: 0, withdrawn: 0 }, total: items.length, more: false, ...extra,
});
const response = (body, status = 200) => Response.json(body, { status });
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
const tick = () => new Promise(resolve => setImmediate(resolve));

class Surface {
  listeners = new Map();
  addEventListener(type, callback) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(callback); }
  removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
  async dispatch(type, event = {}) { for (const callback of this.listeners.get(type) || []) await callback(event); }
}
function fakeClock() {
  let now = Date.parse('2026-10-24T02:00:00.000Z'), next = 0;
  const tasks = new Map();
  return {
    now: () => now,
    setTimeout(fn, delay) { const id = ++next; tasks.set(id, { fn, at: now + delay }); return id; },
    clearTimeout(id) { tasks.delete(id); },
    advance(ms) { now += ms; for (const [id, task] of [...tasks]) if (task.at <= now) { tasks.delete(id); task.fn(); } },
    pending: () => tasks.size,
  };
}
function harness(t, handler) {
  const root = new Surface(), lifecycle = new Surface(), clock = fakeClock(), calls = [], renders = [], focused = [];
  let html = '';
  Object.defineProperty(root, 'innerHTML', { get: () => html, set(value) { html = value; renders.push(value); } });
  root.querySelector = selector => ({ focus: () => focused.push(selector) });
  const session = () => ({ authenticated: true, csrfToken: csrf, expiresAt: new Date(clock.now() + 4 * 60 * 60 * 1000).toISOString() });
  const ui = createReviewUI({ root, lifecycle, clock, fetcher: async (path, options) => { calls.push({ path, options }); return handler(path, options, { session, calls }); } });
  t.after(() => ui.destroy());
  const click = (action, applicationId = id) => root.dispatch('click', { target: { closest: selector => selector === '[data-review-action]' ? { dataset: { reviewAction: action, id: applicationId } } : null } });
  const filter = status => root.dispatch('click', { target: { closest: selector => selector === '[data-review-status]' ? { dataset: { reviewStatus: status } } : null } });
  const input = value => root.dispatch('input', { target: { dataset: { reviewNote: id }, value } });
  const login = password => {
    const input = { value: password };
    const pending = root.dispatch('submit', { target: { matches: selector => selector === '[data-review-login]', querySelector: () => input }, preventDefault() {} });
    return { input, pending };
  };
  return { root, lifecycle, clock, calls, renders, focused, ui, session, click, filter, input, login, html: () => html };
}

test('review render distinguishes public profile and private notes while escaping every applicant field', () => {
  const raw = '<img src=x onerror="test()"><script>PRIVATE</script>';
  const item = application({ nickname: raw, greeting: raw, introduction: raw, reason: raw, reviewNote: raw, playerId: 'OWNER_SHOULD_NOT_RENDER' });
  const html = reviewQueueHTML({ items: [item], notes: new Map([[id, raw]]), expiresAt: '2026-10-24T06:00:00Z' });
  assert.match(html, /PUBLIC PROFILE · 核准後公開/);
  assert.match(html, /FOR REVIEW ONLY · 不公開/);
  assert.match(html, /核准並公開到島上/);
  assert.ok(html.includes('&lt;img src=x onerror=&quot;test()&quot;&gt;'));
  assert.ok(!html.includes(raw));
  assert.doesNotMatch(html, /<script|<img|OWNER_SHOULD_NOT_RENDER|api\/admin\/archive|api\/admin\/portrait/);
  const login = reviewLoginHTML();
  assert.match(login, /type="password"/);
  assert.doesNotMatch(login, /value=/);
  const source = readFileSync(new URL('../dist/island/review/review.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|document\.cookie|console\./);
});

test('signed-out session checks fetch no protected list or private archive', async t => {
  for (const status of [401, 403, 503]) {
    const h = harness(t, async () => response({ message: 'SERVER_TEXT_MUST_NOT_RENDER' }, status));
    await h.ui.start();
    assert.deepEqual(h.calls.map(call => call.path), ['/api/admin/session']);
    assert.match(h.html(), /data-review-login/);
    assert.doesNotMatch(h.html(), /PRIVATE_TEST_REASON|SERVER_TEXT_MUST_NOT_RENDER/);
  }
});

test('valid session loads only the bounded moderation queue using cookie credentials and no-store', async t => {
  const h = harness(t, async (path, options, { session }) => response(path === '/api/admin/session' ? session() : queue()));
  await h.ui.start();
  assert.deepEqual(h.calls.map(call => call.path), ['/api/admin/session', '/api/admin/island-applications?status=pending']);
  assert.match(h.html(), /PRIVATE_TEST_REASON/);
  assert.ok(!h.html().includes(csrf));
  for (const { options } of h.calls) {
    assert.equal(options.credentials, 'same-origin'); assert.equal(options.cache, 'no-store');
    assert.equal(options.headers.Authorization, undefined); assert.equal(options.headers.Cookie, undefined);
    assert.equal(options.headers['X-CSRF-Token'], undefined);
  }
});

test('password input clears immediately, is sent only to login, and never enters rendered markup', async t => {
  const pending = deferred(), password = 'test-only-password-for-island-review';
  const h = harness(t, async path => path === '/api/admin/session' ? response({}, 401) : path === '/api/admin/login' ? pending.promise : response(queue()));
  await h.ui.start();
  const form = h.login(password);
  assert.equal(form.input.value, '');
  const login = h.calls.find(call => call.path === '/api/admin/login');
  assert.deepEqual(JSON.parse(login.options.body), { password });
  assert.equal(login.options.headers['X-Admin-Intent'], 'private-archive');
  pending.resolve(response(h.session())); await form.pending;
  assert.match(h.html(), /PRIVATE_TEST_REASON/);
  assert.ok(h.renders.every(html => !html.includes(password)));
  assert.equal(h.calls.filter(call => call.options.body?.includes(password)).length, 1);
});

test('failed approval keeps the application and note, then successful receipt makes the result explicit', async t => {
  let fail = true, approved = false;
  const h = harness(t, async (path, options, { session }) => {
    if (path === '/api/admin/session') return response(session());
    if (options.method === 'POST') {
      if (fail) return response({}, 503);
      approved = true; return response({ application: application({ status: 'approved', reviewedAt: '2026-10-24T03:00:00Z' }) });
    }
    return response(queue(approved ? [] : [application()]));
  });
  await h.ui.start(); await h.input('保留的審核備註'); await h.click('approve');
  assert.match(h.html(), /PRIVATE_TEST_REASON|保留的審核備註/);
  assert.doesNotMatch(h.html(), /已核准，這位島民已公開/);
  fail = false; await h.click('approve');
  assert.match(h.html(), /已核准，這位島民已公開到小島/);
  assert.doesNotMatch(h.html(), /PRIVATE_TEST_REASON/);
  const posts = h.calls.filter(call => call.options.method === 'POST');
  assert.equal(posts.length, 2);
  for (const post of posts) {
    assert.equal(post.path, `/api/admin/island-applications/${id}/review`);
    assert.equal(post.options.headers['X-CSRF-Token'], csrf);
    assert.deepEqual(JSON.parse(post.options.body), { decision: 'approve', note: '保留的審核備註' });
  }
});

test('rejection and revocation require a note and send only the chosen application decision', async t => {
  for (const [status, decision] of [['pending', 'reject'], ['approved', 'revoke']]) {
    let reviewed = false;
    const h = harness(t, async (path, options, { session }) => {
      if (path === '/api/admin/session') return response(session());
      if (options.method === 'POST') { reviewed = true; return response({ application: application({ status: 'rejected', reviewNote: '需要調整介紹', reviewedAt: '2026-10-24T03:00:00Z' }) }); }
      const requested = new URL(path, 'https://example.test').searchParams.get('status');
      return response(queue(!reviewed && requested === status ? [application({ status })] : []));
    });
    await h.ui.start(); if (status !== 'pending') await h.filter(status);
    await h.click(decision);
    assert.equal(h.calls.filter(call => call.options.method === 'POST').length, 0);
    assert.deepEqual(h.focused, [`#note-${id}`]);
    await h.input('  需要調整介紹  '); await h.click(decision);
    const post = h.calls.find(call => call.options.method === 'POST');
    assert.deepEqual(JSON.parse(post.options.body), { decision, note: '需要調整介紹' });
    assert.doesNotMatch(h.html(), /PRIVATE_TEST_REASON/);
  }
});

test('a success HTTP status without the matching application receipt cannot claim approval', async t => {
  const h = harness(t, async (path, options, { session }) => response(path === '/api/admin/session' ? session() : options.method === 'POST' ? { ok: true } : queue()));
  await h.ui.start(); await h.click('approve');
  assert.match(h.html(), /PRIVATE_TEST_REASON/);
  assert.doesNotMatch(h.html(), /已核准，這位島民已公開/);
});

test('pagination uses only the returned cursor and status changes reset the page', async t => {
  const cursor = 'opaque:cursor/with?characters';
  const h = harness(t, async (path, options, { session }) => {
    if (path === '/api/admin/session') return response(session());
    const parameters = new URL(path, 'https://example.test').searchParams;
    return response(queue([], { total: 102, nextCursor: parameters.has('after') ? null : cursor, more: !parameters.has('after') }));
  });
  await h.ui.start(); await h.click('next');
  let parameters = new URL(h.calls.at(-1).path, 'https://example.test').searchParams;
  assert.equal(parameters.get('after'), cursor); assert.equal(parameters.get('status'), 'pending');
  assert.match(h.html(), /第 2 頁/);
  await h.click('previous'); assert.equal(new URL(h.calls.at(-1).path, 'https://example.test').searchParams.has('after'), false);
  await h.filter('withdrawn'); parameters = new URL(h.calls.at(-1).path, 'https://example.test').searchParams;
  assert.equal(parameters.get('status'), 'withdrawn'); assert.equal(parameters.has('after'), false);
  assert.match(h.html(), /第 1 頁/);
});

test('logout clears private fields before awaiting the server and sends session-bound CSRF', async t => {
  const pending = deferred();
  const h = harness(t, async (path, options, { session }) => path === '/api/admin/logout' ? pending.promise : response(path === '/api/admin/session' ? session() : queue()));
  await h.ui.start(); await h.input('PRIVATE_DRAFT_NOTE');
  const closing = h.click('logout');
  assert.doesNotMatch(h.html(), /PRIVATE_TEST_REASON|PRIVATE_DRAFT_NOTE/);
  const logout = h.calls.at(-1); assert.equal(logout.path, '/api/admin/logout');
  assert.equal(logout.options.headers['X-CSRF-Token'], csrf);
  pending.resolve(response({}, 503)); await closing;
  assert.doesNotMatch(h.html(), /PRIVATE_TEST_REASON|PRIVATE_DRAFT_NOTE/);
  assert.match(h.html(), /暫時無法確認伺服器已登出/);
});

test('session expiry clears private content, aborts pending review, and ignores its late response', async t => {
  const pending = deferred();
  const h = harness(t, async (path, options, { session }) => options.method === 'POST' ? pending.promise : response(path === '/api/admin/session' ? session() : queue()));
  await h.ui.start(); const reviewing = h.click('approve'); const request = h.calls.at(-1);
  h.clock.advance(4 * 60 * 60 * 1000);
  assert.equal(request.options.signal.aborted, true);
  assert.doesNotMatch(h.html(), /PRIVATE_TEST_REASON/);
  assert.match(h.html(), /工作階段已到期/);
  pending.resolve(response({ application: application({ status: 'approved', reviewedAt: '2026-10-24T03:00:00Z' }) })); await reviewing;
  assert.doesNotMatch(h.html(), /PRIVATE_TEST_REASON|已核准，這位島民已公開/);
});

test('pagehide aborts a late protected list; pageshow checks authentication again before refetching', async t => {
  const pending = deferred(); let sessions = 0;
  const h = harness(t, async (path, options, { session }) => {
    if (path === '/api/admin/session') { sessions++; return sessions === 1 ? response(session()) : response({}, 401); }
    return pending.promise;
  });
  const opening = h.ui.start(); await tick();
  const list = h.calls.at(-1); assert.match(list.path, /island-applications/);
  await h.lifecycle.dispatch('pagehide'); assert.equal(list.options.signal.aborted, true);
  pending.resolve(response(queue())); await opening;
  assert.doesNotMatch(h.html(), /PRIVATE_TEST_REASON/);
  await h.lifecycle.dispatch('pageshow'); await tick();
  assert.equal(sessions, 2);
  assert.equal(h.calls.filter(call => call.path.includes('island-applications')).length, 1);
  assert.doesNotMatch(h.html(), /PRIVATE_TEST_REASON/);
});

test('invalid or expired sessions cannot fetch the queue, and destroy removes private DOM', async t => {
  for (const invalid of [{ authenticated: true, csrfToken: csrf }, { authenticated: true, csrfToken: 'invalid', expiresAt: '2027-01-01T00:00:00Z' }, { authenticated: true, csrfToken: csrf, expiresAt: '2020-01-01T00:00:00Z' }]) {
    const h = harness(t, async () => response(invalid)); await h.ui.start();
    assert.equal(h.calls.length, 1); assert.match(h.html(), /data-review-login/);
  }
  const h = harness(t, async (path, options, { session }) => response(path === '/api/admin/session' ? session() : queue()));
  await h.ui.start(); assert.match(h.html(), /PRIVATE_TEST_REASON/);
  h.ui.destroy(); assert.equal(h.html(), ''); assert.equal(h.clock.pending(), 0);
  await h.lifecycle.dispatch('pageshow'); await h.click('refresh'); assert.equal(h.calls.length, 2);
});
