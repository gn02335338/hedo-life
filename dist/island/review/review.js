import { DISTRICTS } from '../content.js';

const STATUS = { pending: '待審核', approved: '已登島', rejected: '未通過', withdrawn: '已撤回' };
const DISTRICT_NAMES = new Map(DISTRICTS.map(place => [place.id, place.name]));
const OUTFITS = {
  teal: ['海風綠', '#547f73'], amber: ['暖陽黃', '#bc934a'], coral: ['珊瑚橘', '#c68164'],
  lavender: ['薰衣草紫', '#9e8daf'], navy: ['深海藍', '#52647b'], cream: ['奶油白', '#b7ad8c'],
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const dateText = value => {
  const date = new Date(value);
  return value && Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(date)
    : '時間未提供';
};

export function reviewLoginHTML({ message = '', busy = false, error = false } = {}) {
  return `<section class="login-card"><span class="eyebrow">ISLAND ADMINISTRATION</span><h1>讓新朋友登島。</h1><p>登入後可查看島民申請、確認公開介紹，再決定是否邀請登島。</p>${message ? `<div class="message${error ? ' error' : ''}" role="status">${esc(message)}</div>` : ''}<form data-review-login><label for="review-password">管理員密碼</label><input id="review-password" name="password" type="password" autocomplete="current-password" required maxlength="1024" ${busy ? 'disabled' : ''}><button class="primary" type="submit" ${busy ? 'disabled' : ''}>${busy ? '正在確認…' : '登入審核 →'}</button></form><p class="session-note">沿用管理員登入。密碼不會保存在瀏覽器；登出或工作階段到期後，申請內容會從畫面清除。</p></section>`;
}

function applicationHTML(item, { notes, busy }) {
  const [outfitName, color] = OUTFITS[item.outfit] || ['島民服裝', '#729789'];
  const editable = item.status === 'pending' || item.status === 'approved';
  const note = notes.get(item.id) ?? '';
  return `<article class="application" data-application-id="${esc(item.id)}"><div class="application-top"><span>送出於 ${esc(dateText(item.createdAt))} · 台北時間</span><span class="status-badge ${esc(item.status)}">${STATUS[item.status]}</span></div><div class="application-columns"><section class="public-preview" aria-label="核准後公開的島民介紹"><span class="eyebrow">PUBLIC PROFILE · 核准後公開</span><div class="preview-title"><span class="avatar" style="--outfit:${color}" aria-hidden="true">${esc([...item.nickname][0] || '島')}</span><div><h2>${esc(item.nickname)}</h2><p class="preview-meta">${esc(DISTRICT_NAMES.get(item.districtId))} · ${outfitName}</p></div></div><blockquote class="greeting">${esc(item.greeting)}</blockquote><p class="introduction">${esc(item.introduction)}</p></section><section class="private-review" aria-label="審核專用資料"><span class="eyebrow private-label">FOR REVIEW ONLY · 不公開</span><h3 class="field-label">想登島的原因</h3><p class="private-copy">${esc(item.reason || '未填寫')}</p>${item.reviewNote ? `<h3 class="field-label">前次審核備註</h3><p class="private-copy">${esc(item.reviewNote)}</p>` : ''}${editable ? `<label class="field-label" for="note-${esc(item.id)}">審核備註</label><textarea class="review-note" id="note-${esc(item.id)}" data-review-note="${esc(item.id)}" maxlength="240" rows="3" ${busy ? 'disabled' : ''}>${esc(note)}</textarea><p class="field-hint">最多 240 字。退回或撤銷時必填；備註不會出現在公開島民介紹。</p><div class="review-actions">${item.status === 'pending' ? `<button class="primary" data-review-action="approve" data-id="${esc(item.id)}" ${busy ? 'disabled' : ''}>核准並公開到島上 ↗</button><button class="reject" data-review-action="reject" data-id="${esc(item.id)}" ${busy ? 'disabled' : ''}>不予核准</button>` : `<button class="reject" data-review-action="revoke" data-id="${esc(item.id)}" ${busy ? 'disabled' : ''}>撤銷核准並移出小島</button>`}</div>` : ''}${item.reviewedAt ? `<p class="reviewed-at">審核於 ${esc(dateText(item.reviewedAt))}</p>` : ''}</section></div></article>`;
}

export function reviewQueueHTML({ items = [], status = 'pending', counts = {}, total = 0, page = 1, nextCursor = null, busy = false, message = '', error = false, notes = new Map(), expiresAt } = {}) {
  return `<section data-review-queue><div class="page-heading"><div><span class="eyebrow">WELCOME TO THE NEIGHBORHOOD</span><h1>島民申請審核</h1><p class="intro">看看新朋友想說的話。確認左側公開介紹後，核准的島民就能在小島與大家相遇。</p></div><div class="session-controls"><button class="quiet-button" data-review-action="refresh" ${busy ? 'disabled' : ''}>重新整理</button><button class="quiet-button" data-review-action="logout">登出</button></div></div><p class="session-note">工作階段至 ${esc(dateText(expiresAt))}（台北時間） · 右側申請原因與審核備註不會公開到島上。</p><nav class="status-tabs" aria-label="依申請狀態篩選">${Object.entries(STATUS).map(([key, label]) => `<button class="status-tab" data-review-status="${key}" aria-pressed="${status === key}" ${busy ? 'disabled' : ''}>${label}${Number.isSafeInteger(counts[key]) ? `<small>${counts[key]}</small>` : ''}</button>`).join('')}</nav>${message ? `<div class="message${error ? ' error' : ''}" role="status">${esc(message)}</div>` : ''}<div class="queue" aria-busy="${busy}">${items.length ? items.map(item => applicationHTML(item, { notes, busy })).join('') : `<section class="empty"><span class="empty-symbol" aria-hidden="true">⌁</span><h2>${busy ? '正在查看申請…' : `目前沒有${STATUS[status]}的申請`}</h2><p>${busy ? '資料正在路上，稍等一下。' : '可以切換其他狀態，或稍後重新整理。'}</p></section>`}</div><div class="pagination"><span>第 ${page} 頁 · 這頁 ${items.length} 筆${Number.isSafeInteger(total) ? ` / 共 ${total} 筆` : ''}</span><div><button class="quiet-button" data-review-action="previous" ${busy || page <= 1 ? 'disabled' : ''}>← 上一頁</button><button class="quiet-button" data-review-action="next" ${busy || !nextCursor ? 'disabled' : ''}>下一頁 →</button></div></div></section>`;
}

function receipt(value) {
  if (!value || !UUID.test(value.id || '') || !Object.hasOwn(STATUS, value.status) || !DISTRICT_NAMES.has(value.districtId)) throw new Error('invalid_receipt');
  for (const field of ['nickname', 'outfit', 'greeting', 'introduction', 'reason', 'reviewNote', 'createdAt']) if (typeof value[field] !== 'string') throw new Error('invalid_receipt');
  if (value.reviewedAt !== null && typeof value.reviewedAt !== 'string') throw new Error('invalid_receipt');
  return Object.fromEntries(['id', 'status', 'nickname', 'districtId', 'outfit', 'greeting', 'introduction', 'reason', 'reviewNote', 'createdAt', 'reviewedAt'].map(key => [key, value[key]]));
}

export function createReviewUI({ root, fetcher = (...args) => fetch(...args), lifecycle = globalThis.window, clock = { now: () => Date.now(), setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: id => clearTimeout(id) } }) {
  let csrf = '', expiresAt = 0, expiryTimer = null, epoch = 0, active = true, destroyed = false, busy = false;
  let status = 'pending', items = [], counts = {}, total = 0, nextCursor = null, cursors = [null], notes = new Map(), message = '', error = false;
  const pending = new Set(), listeners = [];
  const listen = (target, type, callback) => { target?.addEventListener(type, callback); listeners.push(() => target?.removeEventListener(type, callback)); };
  const current = request => request === epoch && active && !destroyed;
  const paintLogin = options => { root.innerHTML = reviewLoginHTML(options); };
  const paint = () => { root.innerHTML = reviewQueueHTML({ items, status, counts, total, nextCursor, page: cursors.length, busy, message, error, notes, expiresAt }); };
  function clear() {
    epoch++;
    for (const operation of pending) { operation.controller.abort(); clock.clearTimeout(operation.timer); }
    pending.clear();
    if (expiryTimer !== null) clock.clearTimeout(expiryTimer);
    expiryTimer = null; csrf = ''; expiresAt = 0; items = []; counts = {}; total = 0; nextCursor = null; cursors = [null]; notes.clear(); busy = false; message = ''; error = false;
  }
  function expire() {
    clear();
    if (active && !destroyed) paintLogin({ message: '工作階段已到期，申請內容已清除。請重新登入。' });
  }
  function acceptSession(session) {
    const deadline = Date.parse(session?.expiresAt);
    if (session?.authenticated !== true || !Number.isFinite(deadline) || deadline <= clock.now() || !/^[a-f0-9]{64}$/.test(session.csrfToken || '')) throw Object.assign(new Error('invalid_session'), { status: 401 });
    csrf = session.csrfToken; expiresAt = deadline;
    if (expiryTimer !== null) clock.clearTimeout(expiryTimer);
    expiryTimer = clock.setTimeout(expire, Math.min(deadline - clock.now(), 2147483647));
  }
  async function call(path, { method = 'GET', body, csrfToken = csrf } = {}) {
    const controller = new AbortController();
    const operation = { controller, timer: clock.setTimeout(() => controller.abort(), 15000) };
    pending.add(operation);
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (path === '/api/admin/login') headers['X-Admin-Intent'] = 'private-archive';
    else if (method !== 'GET') headers['X-CSRF-Token'] = csrfToken;
    try {
      const response = await fetcher(path, { method, headers, credentials: 'same-origin', cache: 'no-store', signal: controller.signal, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw Object.assign(new Error('request_failed'), { status: response.status });
      return result;
    } finally { pending.delete(operation); clock.clearTimeout(operation.timer); }
  }
  const errorText = failure => failure?.status === 429 ? '操作較頻繁，請稍後再試。' : failure?.status === 409 ? '這份申請的狀態已改變，或該地點暫無空位。請重新整理後確認。' : failure?.status === 400 ? '送出的資料未通過檢查，請確認備註後再試。' : '目前無法完成操作，請稍後重試。';
  function handleFailure(failure, request) {
    if (!current(request)) return;
    if ([401, 403].includes(failure?.status)) { expire(); return; }
    message = errorText(failure); error = true; busy = false; paint();
  }
  async function load(request = epoch, successMessage = '') {
    if (!current(request)) return;
    if (clock.now() >= expiresAt) { expire(); return; }
    busy = true; message = successMessage; error = false; paint();
    const parameters = new URLSearchParams({ status });
    if (cursors.at(-1)) parameters.set('after', cursors.at(-1));
    try {
      const result = await call(`/api/admin/island-applications?${parameters}`);
      if (!current(request)) return;
      if (clock.now() >= expiresAt) { expire(); return; }
      if (!Array.isArray(result?.items) || result.items.length > 100 || (result.nextCursor !== null && typeof result.nextCursor !== 'string')) throw new Error('invalid_list');
      const received = result.items.map(receipt);
      if (received.some(item => item.status !== status)) throw new Error('invalid_list');
      items = received;
      counts = Object.fromEntries(Object.keys(STATUS).filter(key => Number.isSafeInteger(result.counts?.[key]) && result.counts[key] >= 0).map(key => [key, result.counts[key]]));
      total = Number.isSafeInteger(result.total) && result.total >= 0 ? result.total : items.length;
      nextCursor = result.nextCursor || null; busy = false; paint();
    } catch (failure) { handleFailure(failure, request); }
  }
  async function start() {
    if (destroyed) return;
    active = true; clear(); status = 'pending'; const request = epoch;
    paintLogin({ busy: true, message: '正在確認登入狀態…' });
    try {
      const session = await call('/api/admin/session');
      if (!current(request)) return;
      acceptSession(session); await load(request);
    } catch (failure) {
      if (!current(request)) return;
      clear(); paintLogin({ message: failure?.status === 401 ? '' : failure?.status === 503 ? '管理員登入暫時無法使用，請稍後再試。' : '目前無法確認登入狀態，請重新登入。', error: failure?.status !== 401 });
    }
  }
  async function login(event) {
    if (!event.target.matches?.('[data-review-login]')) return;
    event.preventDefault(); if (busy || !active || destroyed) return;
    const input = event.target.querySelector('input[name="password"]');
    const password = input?.value || ''; if (input) input.value = '';
    clear(); const request = epoch; busy = true; paintLogin({ busy: true });
    try {
      const session = await call('/api/admin/login', { method: 'POST', body: { password } });
      if (!current(request)) return;
      acceptSession(session); await load(request);
    } catch (failure) {
      if (!current(request)) return;
      clear(); paintLogin({ message: failure?.status === 401 ? '驗證未通過，請重新輸入管理員密碼。' : errorText(failure), error: true });
    }
  }
  async function logout() {
    const token = csrf; clear(); const request = epoch; busy = true;
    paintLogin({ busy: true, message: '申請內容已清除，正在登出…' });
    try {
      const result = await call('/api/admin/logout', { method: 'POST', body: {}, csrfToken: token });
      if (result?.authenticated !== false) throw new Error('invalid_logout');
      if (!current(request)) return;
      clear(); paintLogin({ message: '已登出，申請內容已從畫面清除。' });
    } catch (failure) {
      if (!current(request)) return;
      clear(); paintLogin({ message: failure?.status === 401 ? '工作階段已失效，申請內容已清除。' : '畫面已清除，但暫時無法確認伺服器已登出。恢復連線後，請重新登入再登出。', error: failure?.status !== 401 });
    }
  }
  async function review(decision, id) {
    const item = items.find(row => row.id === id);
    if (!item || !['approve', 'reject', 'revoke'].includes(decision) || (decision === 'revoke' ? item.status !== 'approved' : item.status !== 'pending')) return;
    const note = (notes.get(id) || '').trim();
    if (note.length > 240 || (decision !== 'approve' && !note)) {
      message = note.length > 240 ? '審核備註請縮短至 240 字內。' : '請先填寫不予核准或撤銷的原因。'; error = true; paint();
      root.querySelector(`#note-${id}`)?.focus(); return;
    }
    const request = epoch; busy = true; message = ''; error = false; paint();
    try {
      const result = await call(`/api/admin/island-applications/${encodeURIComponent(id)}/review`, { method: 'POST', body: { decision, note } });
      if (!current(request)) return;
      if (clock.now() >= expiresAt) { expire(); return; }
      const updated = receipt(result?.application);
      if (updated.id !== id || updated.status !== (decision === 'approve' ? 'approved' : 'rejected')) throw new Error('invalid_review_receipt');
      items = items.filter(row => row.id !== id); notes.delete(id); cursors = [null];
      await load(request, decision === 'approve' ? '已核准，這位島民已公開到小島。' : decision === 'revoke' ? '已撤銷核准，這位島民已移出公開小島。' : '已完成審核，這份申請不會公開。');
    } catch (failure) { handleFailure(failure, request); }
  }
  listen(root, 'submit', login);
  listen(root, 'input', event => {
    const id = event.target.dataset?.reviewNote;
    if (id && items.some(item => item.id === id) && !busy) notes.set(id, event.target.value);
  });
  listen(root, 'click', async event => {
    const filter = event.target.closest?.('[data-review-status]')?.dataset.reviewStatus;
    const action = event.target.closest?.('[data-review-action]');
    if (action?.dataset.reviewAction === 'logout' && csrf) { await logout(); return; }
    if (!csrf || busy || !active || destroyed) return;
    if (clock.now() >= expiresAt) { expire(); return; }
    if (filter && Object.hasOwn(STATUS, filter)) {
      status = filter; items = []; cursors = [null]; nextCursor = null; notes.clear(); await load(); return;
    }
    if (!action) return;
    const name = action.dataset.reviewAction;
    if (name === 'refresh') { await load(); return; }
    if (name === 'next' && nextCursor) { cursors.push(nextCursor); items = []; notes.clear(); await load(); return; }
    if (name === 'previous' && cursors.length > 1) { cursors.pop(); items = []; notes.clear(); await load(); return; }
    await review(name, action.dataset.id);
  });
  listen(lifecycle, 'pagehide', () => { active = false; clear(); paintLogin({ message: '返回頁面後會重新確認登入狀態。', busy: true }); });
  listen(lifecycle, 'pageshow', () => { if (!active && !destroyed) void start(); });
  return { start, destroy() { destroyed = true; active = false; clear(); listeners.forEach(remove => remove()); root.innerHTML = ''; } };
}

if (typeof document !== 'undefined') {
  const root = document.getElementById('review-root');
  if (root) void createReviewUI({ root }).start();
}
