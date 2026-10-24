import test from 'node:test';
import assert from 'node:assert/strict';
import { bindApplications } from '../dist/island/applications.js';
import { createApplicationClient } from '../dist/island/application-client.js';

const applicationId = '9eb3de23-9371-4cbc-b593-c66c0689da33';
const residentId = '2205c22e-e299-4753-b2d9-43810af9ba55';
const owner = 'a'.repeat(64);
const fields = { nickname: '測試島民', districtId: 'cafe', outfit: 'teal', greeting: '今天一起在島上散步', introduction: '喜歡看看海，也喜歡和大家聊聊日常。', reason: 'PRIVATE_TEST_REASON_ONLY_FOR_REVIEW' };
const application = (extra = {}) => ({ id: applicationId, status: 'approved', ...fields, reviewNote: '', createdAt: '2026-10-24T03:00:00Z', reviewedAt: '2026-10-24T03:10:00Z', ...extra });
const publicResident = { id: residentId, nickname: fields.nickname, districtId: fields.districtId, outfit: fields.outfit, greeting: fields.greeting, introduction: fields.introduction, slot: 0 };
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
const tick = () => new Promise(resolve => setImmediate(resolve));

class Surface {
  listeners = new Map();
  addEventListener(type, callback) { if (!this.listeners.has(type)) this.listeners.set(type, []); this.listeners.get(type).push(callback); }
  async dispatch(type, event = {}) { for (const callback of this.listeners.get(type) || []) await callback({ target: this, preventDefault() {}, ...event }); }
}
class Element extends Surface {
  constructor(tag, document) {
    super(); this.tagName = tag; this.ownerDocument = document; this.children = []; this.dataset = {}; this.classes = new Set();
    this.style = { setProperty() {} }; this.classList = { toggle: (name, value) => value ? this.classes.add(name) : this.classes.delete(name) };
    this.value = ''; this.defaultValue = ''; this.checked = false; this.defaultChecked = false; this.disabled = false; this.hidden = false; this.open = false;
  }
  append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); if (this.tagName === 'select' && this.children.length === 1) this.value = node.value; } }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  set textContent(value) { this.children = []; this.text = String(value ?? ''); }
  get textContent() { return (this.text || '') + this.children.map(node => node.textContent).join(''); }
  setAttribute(name, value) { this[name] = String(value); }
  querySelectorAll(tag) { return this.children.flatMap(child => [...(child.tagName === tag ? [child] : []), ...child.querySelectorAll(tag)]); }
  querySelector(tag) { return this.querySelectorAll(tag)[0] || null; }
  focus() { this.ownerDocument.activeElement = this; }
  scrollIntoView() {}
}

function fixture(t, fetcher) {
  const document = new Surface(), window = new Surface(), allNodes = [], ids = new Map(), calls = [], rosterUpdates = [];
  document.visibilityState = 'visible';
  document.createElement = tag => { const node = new Element(tag, document); allNodes.push(node); return node; };
  document.createTextNode = text => { const node = document.createElement('#text'); node.textContent = text; return node; };
  document.querySelector = selector => ids.get(selector.slice(1));
  const keys = ['application-dialog', 'application-form', 'application-fields', 'application-submit', 'application-refresh', 'application-message', 'application-submit-message', 'residents-dialog', 'application-preview-content', 'application-history', 'residents-list', 'resident-count', 'residents-refresh', 'residents-message', 'application-outfits', 'application-open', 'residents-open', 'residents-apply'];
  for (const key of keys) ids.set(key, document.createElement(key.endsWith('dialog') ? 'dialog' : key.endsWith('form') ? 'form' : 'div'));
  const form = ids.get('application-form'), controls = new Map();
  for (const key of ['nickname', 'districtId', 'greeting', 'introduction', 'reason', 'consent']) {
    const node = document.createElement(key === 'districtId' ? 'select' : 'input'); node.name = key; controls.set(key, node);
  }
  controls.set('outfit', { get value() { return allNodes.find(node => node.name === 'outfit' && node.checked)?.value || ''; } });
  form.elements = { namedItem: name => controls.get(name) };
  form.reportValidity = () => true;
  form.reset = () => {
    for (const node of allNodes) {
      if (node.tagName === 'input') { node.value = node.type === 'radio' ? node.value : node.defaultValue; node.checked = node.defaultChecked; }
      if (node.tagName === 'select') node.value = node.children[0]?.value || '';
    }
  };
  const prior = new Map();
  for (const [key, value] of Object.entries({ document, window, fetch: async (path, options) => { calls.push({ path, options }); return fetcher(path, options); } })) {
    prior.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  t.after(async () => {
    await window.dispatch('pagehide');
    for (const [key, descriptor] of prior) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  });
  const storage = { getItem: key => key === 'hedo-anonymous-v1' ? owner : null, setItem() {} };
  const ui = bindApplications({ storage, openDialog: dialog => { dialog.open = true; }, closeDialog: dialog => { dialog.open = false; }, onResidents: residents => rosterUpdates.push(residents), onMeet() {}, stopTour() {} });
  const fill = () => { for (const [key, value] of Object.entries(fields)) if (key !== 'outfit') controls.get(key).value = value; controls.get('consent').checked = true; };
  const clickHistory = text => {
    const button = ids.get('application-history').querySelectorAll('button').find(node => node.textContent.includes(text));
    assert.ok(button, `history action: ${text}`); return button.dispatch('click');
  };
  const open = async () => { await ids.get('application-open').dispatch('click'); await tick(); };
  return { document, window, ids, controls, allNodes, form, ui, calls, rosterUpdates, fill, clickHistory, open };
}

test('resetting a submitted application retains a valid default outfit for a later reapplication', async t => {
  const f = fixture(t, async path => Response.json(path.endsWith('/config') ? { enabled: true } : path.endsWith('/mine') ? { applications: [] } : { version: 1, residents: [] }));
  await f.open();
  assert.equal(f.controls.get('outfit').value, 'teal');
  f.form.reset();
  assert.equal(f.controls.get('outfit').value, 'teal', 'browser form.reset restores the radio default, not just initial checked state');
  assert.ok(f.allNodes.some(node => node.name === 'outfit' && node.required), 'the outfit radio group participates in native form validation');
});

test('leaving while owner history is loading prevents its private response from repopulating DOM', async t => {
  const pending = deferred();
  const f = fixture(t, async path => path.endsWith('/mine') ? pending.promise : Response.json(path.endsWith('/config') ? { enabled: true } : { version: 1, residents: [] }));
  await f.open(); await f.window.dispatch('pagehide');
  pending.resolve(Response.json({ applications: [application()] })); await tick();
  assert.equal(f.ids.get('application-history').textContent, '');
  assert.equal(f.ids.get('application-message').textContent, '');
  assert.ok(!f.ids.get('application-preview-content').textContent.includes(fields.reason));
});

test('withdrawal cannot be undone in the scene by an older in-flight public roster response', async t => {
  const oldRoster = deferred(); let rosterRequests = 0, withdrawn = false;
  const f = fixture(t, async (path, options) => {
    if (path.endsWith('/residents')) { rosterRequests++; return rosterRequests === 1 ? oldRoster.promise : Response.json({ version: 1, residents: [] }); }
    if (path.endsWith('/config')) return Response.json({ enabled: true });
    if (path.endsWith('/mine')) return Response.json({ applications: [application()] });
    if (options.method === 'DELETE') { withdrawn = true; return Response.json({ application: application({ status: 'withdrawn' }) }); }
    throw new Error(`unexpected route ${path}`);
  });
  await f.open(); await f.clickHistory('撤回申請並下島');
  assert.equal(f.document.activeElement.textContent, '確認撤回', 'focus enters the confirmation controls');
  await f.clickHistory('確認撤回');
  assert.equal(f.document.activeElement, f.ids.get('application-message'), 'successful withdrawal focuses its receipt');
  assert.equal(withdrawn, true);
  const start = f.rosterUpdates.length;
  oldRoster.resolve(Response.json({ version: 1, residents: [publicResident] })); await tick(); await tick();
  assert.ok(rosterRequests >= 2, 'withdrawal guarantees a fresh roster request even while an older request is busy');
  assert.ok(f.rosterUpdates.slice(start).every(rows => !rows.some(row => row.id === residentId)), 'stale roster must not resurrect the withdrawn resident');
  assert.deepEqual(f.ui.getResidents(), []);
});

test('private application reasons never appear in the public profile preview or resident directory', async t => {
  const f = fixture(t, async path => Response.json(path.endsWith('/config') ? { enabled: true } : path.endsWith('/mine') ? { applications: [application()] } : { version: 1, residents: [publicResident] }));
  f.fill(); await f.form.dispatch('input'); await f.open(); await tick();
  assert.ok(f.ids.get('application-history').textContent.includes(fields.reason), 'owner can view their own private reason');
  assert.ok(!f.ids.get('application-preview-content').textContent.includes(fields.reason));
  assert.ok(!f.ids.get('residents-list').textContent.includes(fields.reason));
});

test('a failed credential read cannot overwrite an existing anonymous career identity', async () => {
  let stored = owner, reads = 0, writes = 0, requests = 0;
  const storage = {
    getItem() { reads++; if (reads === 1) throw new Error('temporary storage read failure'); return stored; },
    setItem(key, value) { writes++; stored = value; },
  };
  const client = createApplicationClient({
    storage,
    random: { getRandomValues: array => array.fill(187), randomUUID: () => applicationId },
    fetcher: async () => { requests++; return Response.json({ application: application({ id: applicationId, status: 'pending' }) }); },
  });
  await assert.rejects(client.submit({ ...fields, consent: true }), /無法保存申請憑證/);
  assert.equal(stored, owner);
  assert.equal(writes, 0);
  assert.equal(requests, 0);
});
