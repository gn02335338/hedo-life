import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { relative, isAbsolute } from 'node:path';
import { getOfficeRoster } from '../dist/office/model.js';

const html = readFileSync(new URL('../dist/office/guide/index.html', import.meta.url), 'utf8');
const source = readFileSync(new URL('../dist/office/guide/guide.js', import.meta.url), 'utf8');
const names = ['start', 'desktop', 'cloud', 'api'];
const app = readFileSync(new URL('../dist/office/app.js', import.meta.url), 'utf8');

function appFunction(name, nextName) {
  const start = app.indexOf(`function ${name}(`), end = app.indexOf(`\nfunction ${nextName}(`, start);
  assert.ok(start >= 0 && end > start, `Find the standalone ${name} renderer`);
  return app.slice(start, end);
}

function localLinks(base, text, markdown = false) {
  const targets = [...text.matchAll(markdown ? /\]\(([^)]+)\)/g : /(?:href|src)="([^"]+)"/g)].map(match => match[1]);
  const root = fileURLToPath(new URL('../', import.meta.url));
  for (const target of targets) {
    let url = new URL(target, base);
    if (url.origin === 'https://hodo.bvivify.com' && url.pathname.startsWith('/office/')) url = new URL(`../dist${url.pathname}${url.hash}`, import.meta.url);
    if (url.protocol !== 'file:') continue;
    const path = fileURLToPath(url), within = relative(root, path);
    assert.ok(!within.startsWith('..') && !isAbsolute(within), `Link stays inside the public clone: ${target}`);
    assert.ok(existsSync(path), `Link exists: ${target}`);
    const resource = statSync(path).isDirectory() ? new URL('index.html', url.href.replace(/\/?(?:#.*)?$/, '/')) : url;
    if (url.hash && resource.pathname.endsWith('.html')) {
      const content = readFileSync(resource, 'utf8'); assert.ok(content.includes(`id="${url.hash.slice(1)}"`), `Anchor exists: ${target}`);
    }
  }
}

function harness({ hash = '', bytes = new TextEncoder().encode('# 移動辦公室\n中文接入指南'), ok = true } = {}) {
  let document;
  class Node {
    constructor(id = '') { this.id = id; this.attributes = new Map(); this.listeners = new Map(); this.dataset = {}; this.children = []; this.textContent = ''; this.classes = new Set(); this.classList = { add: name => this.classes.add(name), remove: name => this.classes.delete(name) }; }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    removeAttribute(name) { this.attributes.delete(name); }
    addEventListener(name, callback) { if (!this.listeners.has(name)) this.listeners.set(name, []); this.listeners.get(name).push(callback); }
    async emit(name, event = {}) { event.target ||= this; event.currentTarget = this; event.preventDefault ||= () => { event.prevented = true; }; for (const callback of this.listeners.get(name) || []) await callback(event); return event; }
    closest(selector) { return selector === '[role="tab"]' && this.getAttribute('role') === 'tab' ? this : null; }
    focus() { document.activeElement = this; }
    scrollIntoView() { this.scrolled = true; }
    append(child) { this.children.push(child); child.parent = this; }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); }
    click() { downloads.push({ href: this.href, filename: this.download }); }
  }
  const ids = new Map(), tablist = new Node('tabs');
  const create = id => { const node = new Node(id); ids.set(id, node); return node; };
  const tabs = names.map(name => { const tab = create(`tab-${name}`); tab.setAttribute('role', 'tab'); tab.setAttribute('aria-controls', name); create(name); return tab; });
  const openLinks = ['desktop', 'cloud'].map(name => { const link = new Node(); link.dataset.openTab = name; return link; });
  const copyButtons = [...html.matchAll(/data-copy="([^"]+)"/g)].map(([, id]) => {
    if (!ids.has(id)) { const block = html.match(new RegExp(`id="${id}"[^>]*>([\\s\\S]*?)<\\/(?:pre|code)>`)); create(id).textContent = block?.[1] || ''; }
    const button = new Node(); button.dataset.copy = id; return button;
  });
  create('status'); const download = create('download-guide');
  download.href = 'https://hodo.bvivify.com/office/agent.md'; download.download = '移動辦公室-Agent-入駐指南.md';
  document = { activeElement: null, body: new Node('body'), createElement: () => new Node(), getElementById: id => ids.get(id), querySelector: selector => selector === '.tabs' ? tablist : null,
    querySelectorAll: selector => selector === '[role="tab"]' ? tabs : selector === '[data-open-tab]' ? openLinks : selector === '[data-copy]' ? copyButtons : [] };
  const window = new Node('window'), location = { hash }, entries = [hash]; let cursor = 0;
  const history = { pushState(_state, _title, next) { entries.splice(++cursor); entries.push(next); location.hash = next; } };
  const copied = [], downloads = [], files = [], fetches = [], revoked = [];
  const fetch = async (url, options) => { fetches.push({ url, options }); return { ok, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) }; };
  const urls = { createObjectURL(file) { files.push(file); return `blob:guide-${files.length}`; }, revokeObjectURL(url) { revoked.push(url); } };
  const timers = new Map(); let timerId = 0;
  new Function('document', 'window', 'location', 'history', 'navigator', 'fetch', 'Blob', 'URL', 'TextDecoder', 'AbortSignal', 'setTimeout', 'clearTimeout', source)(
    document, window, location, history, { clipboard: { writeText: async text => copied.push(text) } }, fetch, Blob, urls, TextDecoder, AbortSignal,
    callback => { const id = ++timerId; timers.set(id, callback); return id; }, id => timers.delete(id));
  async function travel(delta) { cursor = Math.max(0, Math.min(entries.length - 1, cursor + delta)); location.hash = entries[cursor]; await window.emit('popstate'); }
  return { ids, tabs, tablist, openLinks, copyButtons, download, location, window, document, copied, files, downloads, fetches, revoked, timers, travel };
}

function assertTab(h, name) {
  for (const expected of names) {
    assert.equal(h.ids.get(expected).hidden, expected !== name);
    assert.equal(h.ids.get(`tab-${expected}`).getAttribute('aria-selected'), String(expected === name));
    assert.equal(h.ids.get(`tab-${expected}`).tabIndex, expected === name ? 0 : -1);
  }
}

test('guide is UTF-8 HTML with four addressable, labelled panels and complete connection choices', () => {
  assert.match(html, /<html lang="zh-Hant">/);
  assert.match(html, /<meta charset="UTF-8">/i);
  for (const name of names) {
    assert.match(html, new RegExp(`href="#${name}" role="tab" id="tab-${name}" aria-controls="${name}"`));
    assert.match(html, new RegExp(`<section id="${name}" role="tabpanel" aria-labelledby="tab-${name}"`));
  }
  for (const tool of ['get_office', 'get_my_status', 'update_presence', 'post_message', 'create_task', 'claim_task', 'complete_task']) assert.ok(html.includes(tool));
  assert.ok(html.includes('https://hodo.bvivify.com/api/office/mcp'));
  assert.ok(html.includes('沒有 OAuth 登入流程'));
  assert.ok(html.includes('--setup') && html.includes('--check'));
  assert.ok(html.includes('mcpServers') && html.includes('[mcp_servers.hedo_office]'));
  assert.doesNotMatch(html, /[?&](?:token|access_token)=/i);
  assert.ok(html.includes('另一個瀏覽器設定檔申請 Agent'));
});

test('office entry links land on the four existing guide panels and all guide assets stay in the public clone', () => {
  let modal;
  new Function('openDialog', `${appFunction('openGuide', 'openNewTask')}\nopenGuide();`)((kind, content) => { assert.equal(kind, 'guide'); modal = content; });
  for (const name of names) assert.ok(modal.includes(`./guide/#${name}`), name);
  localLinks(new URL('../dist/office/app.js', import.meta.url), modal);
  localLinks(new URL('../dist/office/guide/index.html', import.meta.url), html);
  for (const path of ['../dist/office/README.md', '../dist/office/agent.md']) {
    const url = new URL(path, import.meta.url); localLinks(url, readFileSync(url, 'utf8'), true);
  }
  for (const [path, heading] of [['../README.md', '## 移動辦公室'], ['../worker/README.md', '## Moving Office']]) {
    const url = new URL(path, import.meta.url), text = readFileSync(url, 'utf8');
    localLinks(url, text.slice(text.lastIndexOf(heading)), true);
  }
  for (const path of ['../dist/office/guide/index.html', '../dist/office/guide/guide.css', '../dist/office/guide/guide.js', '../dist/office/agent.md']) {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(new URL(path, import.meta.url)));
    assert.ok(!text.includes('\ufffd'), `${path} contains no replacement characters`);
  }
});

test('the colleague itinerary card renders every actual routine phase with a valid partner and return destination', () => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const phases = new Set();
  for (const now of [0, 85_000, 103_000, 115_000, 133_000, 178_000, 196_000, 208_000, 359_000]) {
    const roster = getOfficeRoster([], now), member = roster.find(person => person.id === 'jack');
    const render = new Function('roster', 'esc', `${appFunction('routineHTML', 'openPerson')}\nreturn routineHTML;`)(roster, esc);
    const card = render(member), route = member.routine; phases.add(route.phase);
    assert.ok(!card.includes('undefined'));
    assert.ok(card.includes(`${route.homeFloor}F 部門`));
    assert.ok(card.includes(`${route.destinationFloor}F`));
    assert.ok(card.includes(`data-person="${route.partnerId}"`));
    if (route.inElevator) assert.ok(card.includes(`前往 ${route.phase === 'return-lift' ? route.homeFloor : route.destinationFloor}F`));
    assert.equal(render({ kind: 'agent' }), '');
  }
  assert.deepEqual([...phases].sort(), ['chat', 'home-work', 'meeting', 'outbound-lift', 'return-lift', 'return-to-elevator', 'return-to-work', 'to-elevator', 'to-visit'].sort());
});

test('deep links, ordinary clicks, and backward/forward navigation keep one matching panel active', async () => {
  const h = harness({ hash: '#cloud' }); assertTab(h, 'cloud');
  await h.tablist.emit('click', { target: h.ids.get('tab-api') }); assertTab(h, 'api'); assert.equal(h.location.hash, '#api');
  await h.tablist.emit('click', { target: h.ids.get('tab-desktop') }); assertTab(h, 'desktop');
  await h.travel(-1); assertTab(h, 'api'); await h.travel(-1); assertTab(h, 'cloud'); await h.travel(1); assertTab(h, 'api');
  const modified = await h.tablist.emit('click', { target: h.ids.get('tab-start'), ctrlKey: true });
  assert.equal(modified.prevented, undefined); assertTab(h, 'api');
  h.location.hash = '#invalid'; await h.window.emit('hashchange'); assertTab(h, 'start');
  await h.openLinks[0].emit('click'); assertTab(h, 'desktop'); assert.equal(h.document.activeElement.id, 'tab-desktop'); assert.equal(h.ids.get('desktop').scrolled, true);
});

test('arrow, Home and End keys move selection and keyboard focus together without losing tab semantics', async () => {
  const h = harness(); assertTab(h, 'start');
  await h.tablist.emit('keydown', { key: 'ArrowLeft', target: h.ids.get('tab-start') }); assertTab(h, 'api'); assert.equal(h.document.activeElement.id, 'tab-api');
  await h.tablist.emit('keydown', { key: 'Home', target: h.ids.get('tab-api') }); assertTab(h, 'start');
  await h.tablist.emit('keydown', { key: 'ArrowRight', target: h.ids.get('tab-start') }); assertTab(h, 'desktop');
  await h.tablist.emit('keydown', { key: 'End', target: h.ids.get('tab-desktop') }); assertTab(h, 'api');
  await h.tablist.emit('keydown', { key: 'Escape', target: h.ids.get('tab-api') }); assertTab(h, 'api');
});

test('copyable Agent instructions contain the authorized work sequence without embedding credentials', async () => {
  const h = harness(), button = h.copyButtons.find(button => button.dataset.copy === 'agent-instructions');
  await button.emit('click');
  assert.equal(h.copied.length, 1);
  assert.ok(h.copied[0].indexOf('get_my_status') < h.copied[0].indexOf('get_office'));
  assert.ok(h.copied[0].indexOf('claim_task') < h.copied[0].indexOf('complete_task'));
  assert.ok(h.copied[0].includes('明確指定或授權'));
  assert.doesNotMatch(h.copied[0], /\b[0-9a-f]{64}\b/i);
});

test('Markdown download decodes UTF-8 and adds one BOM before triggering a named download', async () => {
  const h = harness(); await h.download.emit('click');
  assert.equal(h.fetches.length, 1); assert.equal(h.fetches[0].url, 'https://hodo.bvivify.com/office/agent.md');
  assert.equal(h.fetches[0].options.credentials, 'same-origin');
  assert.equal(h.files.length, 1); assert.equal(h.files[0].type, 'text/markdown;charset=utf-8');
  const bytes = new Uint8Array(await h.files[0].arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf]);
  assert.equal(new TextDecoder('utf-8').decode(bytes), '# 移動辦公室\n中文接入指南');
  assert.deepEqual(h.downloads, [{ href: 'blob:guide-1', filename: '移動辦公室-Agent-入駐指南.md' }]);
  assert.equal(h.download.getAttribute('aria-busy'), null);
  for (const callback of h.timers.values()) callback(); assert.deepEqual(h.revoked, ['blob:guide-1']);
});

test('invalid UTF-8 and failed downloads show an error instead of producing a corrupted file', async () => {
  for (const options of [{ bytes: new Uint8Array([0xc3, 0x28]) }, { ok: false }]) {
    const h = harness(options); await h.download.emit('click');
    assert.equal(h.files.length, 0); assert.equal(h.downloads.length, 0);
    assert.ok(h.ids.get('status').textContent.includes('無法下載'));
    assert.equal(h.download.getAttribute('aria-busy'), null);
  }
});
