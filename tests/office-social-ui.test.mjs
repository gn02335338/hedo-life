import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { OFFICE_CAST, getOfficeRoster } from '../dist/office/model.js';
import { OFFICE_FLOORS, getOfficeFloor } from '../dist/office/floors.js';
import { OFFICE_INTERACTION_TOPICS, getOfficeInteraction } from '../dist/office/interactions.js';
import { getOfficeEvent, createOfficeGame, advanceOfficeGame, getOfficeGameActions } from '../dist/office/events.js';
import { getOfficeEncounters } from '../dist/office/social.js';

const source = readFileSync(new URL('../dist/office/app.js', import.meta.url), 'utf8');
function between(startText, endText) {
  const start = source.indexOf(startText), end = source.indexOf(endText, start + startText.length);
  assert.ok(start >= 0 && end > start, `Find app behavior between ${startText} and ${endText}`);
  return source.slice(start, end);
}
const functionSource = (name, next) => between(`function ${name}(`, `\nfunction ${next}(`);

// Execute the shipped renderers and delegated handlers against small DOM
// surfaces. This does not create a browser, start polling, or access the API.
function harness({ now = 0, owner = null, members = [], initialRoster = null, storage = new Map(), snapshot = {} } = {}) {
  let document;
  class Node {
    constructor(id = '') { this.id = id; this.dataset = {}; this.attributes = new Map(); this.listeners = new Map(); this.innerHTML = ''; this.scrollTop = 0; this.open = false; this.classList = { toggle() {} }; }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name); }
    addEventListener(name, fn) { this.listeners.set(name, fn); }
    focus() { document.activeElement = this; }
    contains(node) { return node === this; }
    close() { this.open = false; }
    async emit(name, event = {}) { event.preventDefault ||= () => { event.prevented = true; }; await this.listeners.get(name)?.(event); return event; }
  }
  const nodes = new Map();
  const $ = selector => { if (!nodes.has(selector)) nodes.set(selector, new Node(selector)); return nodes.get(selector); };
  const tabs = ['people', 'tasks', 'feed', 'events'].map(name => { const node = new Node(`tab-${name}`); node.dataset.tab = name; return node; });
  document = { activeElement: null, querySelectorAll: selector => selector === '[data-tab]' ? tabs : [], addEventListener(name, fn) { this[name] = fn; } };
  const dialogs = [], requests = [], toasts = [], floors = [], refreshes = [];
  const openDialog = (kind, html) => { $('#modal').open = true; $('#modal-content').innerHTML = html; dialogs.push({ kind, html }); };
  const api = async (path, options) => { requests.push({ path, options: structuredClone(options) }); return {}; };
  let time = now, uuid = 0;
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [time])); } static now() { return time; } }
  const deps = { $, document, Date: Clock, own: owner, snapshot, roster: initialRoster || getOfficeRoster(members, now), localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    crypto: { randomUUID: () => `local-${++uuid}` }, openDialog, api, refresh: async options => refreshes.push(options), toast: text => toasts.push(text), selectFloor: floor => floors.push(floor),
    OFFICE_CAST, OFFICE_FLOORS, getOfficeFloor, OFFICE_INTERACTION_TOPICS, getOfficeInteraction, getOfficeEvent, createOfficeGame, advanceOfficeGame, getOfficeGameActions, getOfficeEncounters };
  const clickSource = between("document.addEventListener('click',async event=>{", "\ndocument.addEventListener('input',");
  const keyboard = source.split('\n').find(line => line.startsWith("$('.side-tabs').addEventListener('keydown',"));
  assert.ok(keyboard);
  const run = new Function('deps', `
    const {$,document,Date,localStorage,crypto,openDialog,api,refresh,toast,selectFloor,OFFICE_CAST,OFFICE_FLOORS,getOfficeFloor,OFFICE_INTERACTION_TOPICS,getOfficeInteraction,getOfficeEvent,createOfficeGame,advanceOfficeGame,getOfficeGameActions,getOfficeEncounters}=deps;
    let {own,snapshot,roster}=deps;
    let currentGame=null,currentGameEvent=null,activeTab='people',messageDraft='',messageRecipient='',selectedZone='all',rosterFilter='all';
    const buildingView=true, activeFloor=1, scene=null, connected=true;
    const normalizeRoster=()=>{},scopeRoster=()=>roster,floorLabel=value=>value+'F';
    ${between('const esc =', '\nconst TOKEN_KEY')}
    ${between('const zoneNames =', '\nconst typeName')}
    ${between('const typeName =', '\nlet token')}
    ${functionSource('avatar', 'normalizeRoster')}
    ${between('function renderPeople()', '\nfunction renderTasks()')}
    function renderTasks() { $('#panel').innerHTML='tasks'; }
    ${between('function renderFeed()', '\nasync function openAvatarEditor()')}
    ${between('const EVENT_RECORD_KEY=', '\nfunction renderPanel(')}
    ${between('function renderPanel(', '\nconst refresh=')}
    ${source.split('\n').find(line => line.startsWith('function closeDialog()'))}
    ${between('function routineHTML(', '\nfunction openGuide(')}
    ${clickSource}
    ${keyboard}
    return {renderPeople,renderFeed,renderEvents,openPerson,recipientOptions,startOfficeGame,closeDialog,setTab,
      get game(){return currentGame},get gameEvent(){return currentGameEvent},get recipient(){return messageRecipient},get tab(){return activeTab},
      setDraft(value){messageDraft=value},records:eventRecords};
  `)(deps);
  return { ui: run, $, document, tabs, dialogs, requests, toasts, floors, storage, refreshes,
    setTime(value) { time = value; },
    async click(dataset) { const target = { dataset, disabled: false, closest: selector => selector === '[data-action]' ? ('action' in dataset ? target : null) : Object.keys(dataset).some(key => selector === `[data-${key.replace(/[A-Z]/g, char => '-' + char.toLowerCase())}]`) ? target : null }; await document.click({ target }); return target; } };
}

const humanId = 'f78f223b-a26c-4b13-b546-724ce5e81a20', agentId = '85d6d741-4730-47c0-8aa1-20d1df2fe399';
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

test('disconnected human and Agent seats render as first-floor rest rather than offline work', () => {
  const members = [
    { id: humanId, kind: 'human', name: '喝茶的人', floor: 5, departmentFloor: 5, zone: 'studio', online: false, status: 'working', activity: '不應顯示的舊工作' },
    { id: agentId, kind: 'agent', name: '茶水助手', floor: 6, departmentFloor: 6, zone: 'focus', online: false, status: 'working', activity: '不應顯示的舊工作' },
  ];
  const h = harness({ members }); h.ui.renderPeople();
  const list = h.$('#panel').innerHTML;
  assert.equal((list.match(/休息中 · /g) || []).length, 2);
  assert.equal((list.match(/aria-label="休息日常"/g) || []).length, 2);
  assert.doesNotMatch(list, /離線|不應顯示的舊工作/);
  for (const member of members) {
    h.ui.openPerson(member.id); const card = h.dialogs.at(-1).html;
    assert.ok(card.includes(`${member.kind === 'human' ? '真人' : 'Agent'} · 休息中`));
    assert.ok(card.includes('1F') && card.includes('交誼區'));
    assert.ok(card.includes('實際回覆顯示於公開留言'));
    assert.doesNotMatch(card, /離線|不應顯示的舊工作/);
  }
  assert.equal(h.requests.length, 0, 'Resting and opening a profile never publish a heartbeat or fake speech');
});

test('targeted conversation escapes public text and recipients, excludes self, and focuses the composer', async () => {
  const name = '<img src=x onerror="bad()">', text = '</p><script>bad()</script>&', owner = { id: humanId, name: '自己', status: 'approved' };
  const h = harness({ owner, members: [{ ...owner, kind: 'human' }, { id: agentId, kind: 'agent', name }], snapshot: { messages: [{ id: 'message', memberId: humanId, recipientId: agentId, text, createdAt: '2026-11-01T00:00:00Z' }] } });
  h.ui.setDraft('" autofocus onfocus="bad()');
  await h.click({ chatTo: agentId });
  assert.equal(h.ui.recipient, agentId); assert.equal(h.ui.tab, 'feed');
  assert.equal(h.document.activeElement, h.$('#message-form input'));
  const options = h.ui.recipientOptions(), feed = h.$('#panel').innerHTML;
  assert.ok(!options.includes(`value="${humanId}"`));
  assert.ok(options.includes(`value="${agentId}" selected`));
  assert.ok(options.includes(escape(name)) && options.includes('遊戲角色') && options.includes('Agent'));
  assert.ok(feed.includes(`給 ${escape(name)} · 公開留言`));
  assert.ok(feed.includes(escape(text)) && feed.includes('&quot; autofocus onfocus=&quot;bad()'));
  assert.doesNotMatch(feed, /<script>|<img src=x|value="" autofocus/);
  assert.equal(h.requests.length, 0, 'Choosing a recipient only prepares a public message');
});

test('ambient greetings invite a real public reply without inventing human or Agent speech', async () => {
  const owner = { id: humanId, kind: 'human', name: '<本人&>', status: 'approved' };
  const npc = { ...OFFICE_CAST[0], kind: 'character' }, agent = { id: agentId, kind: 'agent', name: '<Agent>' }, other = { id: 'other-human', kind: 'human', name: '另一位真人' };
  const pair = (left, right, id) => [left, right].map((person, index) => ({ ...person, routine: { phase: 'chat', meetingId: id, partnerId: index ? left.id : right.id, destinationFloor: 1, phaseStartedAt: 25_000, phaseEndsAt: 70_000 } }));
  const roster = [...pair(npc, owner, 'npc-greeting'), ...pair(agent, other, 'member-encounter')];
  const encounters = getOfficeEncounters(roster);
  assert.equal(encounters.length, 2); assert.ok(encounters.every(item => item.simulated === true));
  const greeting = encounters.find(item => item.speakerId === npc.id), memberMeeting = encounters.find(item => item.speakerId === null);
  assert.equal(greeting.recipientId, owner.id); assert.equal(memberMeeting.recipientId, null);
  const h = harness({ owner, initialRoster: roster }); h.ui.renderFeed();
  const feed = h.$('#panel').innerHTML;
  assert.ok(feed.includes(`${escape(npc.name)}：${escape(greeting.prompt)}`));
  assert.ok(feed.includes(escape(memberMeeting.prompt)) && feed.includes('角色日常'));
  assert.ok(!feed.includes('<Agent>') && !feed.includes('<本人&>'));
  assert.ok(feed.includes(`data-chat-to="${npc.id}"`));
  await h.click({ chatTo: npc.id });
  assert.equal(h.ui.recipient, npc.id); assert.ok(h.ui.recipientOptions().includes(`value="${npc.id}" selected`));
  assert.equal(h.requests.length, 0, 'A greeting card never publishes a member reply by itself');
});

function scheduled(type = 'duel') {
  for (let bucket = 0; bucket < 3; bucket++) { const event = getOfficeEvent(bucket * 480_000); if (event.type === type) return event; }
  throw new Error('Missing scheduled activity');
}

test('scheduled games preserve deliberate rounds across close and reload, finish once, and share only on request', async () => {
  const event = scheduled(), owner = { id: humanId, name: '測試同事', status: 'approved' }, storage = new Map();
  let h = harness({ now: event.startsAt, owner, storage });
  h.ui.renderEvents(); assert.match(h.$('#panel').innerHTML, /開放集合/);
  await h.click({ action: 'play-event' });
  assert.equal(h.ui.game.round, 0); assert.equal(h.$('#modal').open, true);
  assert.equal(h.ui.game.eventId, event.id);
  for (const action of ['attack', 'guard', 'dodge']) await h.click({ gameAction: action });
  const saved = structuredClone(h.ui.game); h.ui.closeDialog();
  assert.equal(h.$('#modal').open, false); assert.equal(h.requests.length, 0);
  h = harness({ now: event.endsAt + 1, owner, storage });
  h.ui.setTab('events'); assert.ok(h.$('#panel').innerHTML.includes(`data-resume-game="${event.id}"`));
  await h.click({ resumeGame: event.id }); assert.deepEqual(h.ui.game, saved);
  for (let round = saved.round; round < 8; round++) await h.click({ gameAction: 'attack' });
  assert.equal(h.ui.game.round, 8); assert.equal(h.ui.game.status, 'finished');
  assert.equal(h.ui.game.playerScore + h.ui.game.opponentScore, 16);
  assert.ok(h.dialogs.at(-1).html.includes('data-share-game'));
  assert.ok(!h.dialogs.at(-1).html.includes('data-game-action='));
  const finished = structuredClone(h.ui.game); await h.click({ gameAction: 'attack' }); assert.deepEqual(h.ui.game, finished);
  assert.equal(h.requests.length, 0, 'Eight rounds and local persistence do not modify tasks or the server');
  await h.click({ shareGame: '' });
  assert.equal(h.requests.length, 1); assert.equal(h.requests[0].path, '/api/office/messages');
  assert.equal(h.requests[0].options.method, 'POST'); assert.equal(h.requests[0].options.auth, true);
  const shared = h.requests[0].options.body;
  assert.deepEqual(Object.keys(shared), ['text']);
  assert.ok(shared.text.includes(event.title) && shared.text.includes(`${finished.playerScore} 比 ${finished.opponentScore}`));
  assert.ok(shared.text.includes('【個人活動】') && shared.text.includes('本機回合制小遊戲'));
  assert.equal(h.ui.tab, 'feed'); assert.equal(h.$('#modal').open, false); assert.equal(h.refreshes.length, 1);
  const again = harness({ now: event.startsAt + 5000, owner, storage });
  again.ui.startOfficeGame(); assert.deepEqual(again.ui.game, finished, 'The same owner cannot restart the scheduled event for a new result');
});

test('upcoming events remain gated while practice and visitor games work without a server identity', async () => {
  const event = scheduled(), h = harness({ now: event.startsAt - 1 });
  await h.click({ action: 'play-event' }); assert.equal(h.ui.game, null); assert.equal(h.$('#modal').open, false);
  assert.ok(h.toasts.at(-1).includes('還沒開始'));
  for (const [type, action] of [['duel', 'attack'], ['arm-wrestling', 'charge']]) {
    await h.click({ action: type === 'duel' ? 'practice-duel' : 'practice-arm' });
    assert.equal(h.ui.game.type, type);
    for (let round = 0; round < 8; round++) await h.click({ gameAction: action });
    assert.equal(h.ui.game.status, 'finished'); assert.ok(!h.dialogs.at(-1).html.includes('data-share-game'));
  }
  assert.equal(h.requests.length, 0); assert.equal(h.ui.records().length, 2);
  const other = harness({ now: event.startsAt, storage: h.storage, owner: { id: humanId, status: 'approved' } });
  other.ui.renderEvents(); assert.ok(!other.$('#panel').innerHTML.includes('data-resume-game='));
});

test('the fourth office tab participates in End, Home, arrows and matching focus semantics', async () => {
  const h = harness(); h.ui.setTab('people');
  await h.$('.side-tabs').emit('keydown', { key: 'End' });
  assert.equal(h.ui.tab, 'events'); assert.equal(h.document.activeElement, h.tabs[3]);
  assert.equal(h.$('#panel').getAttribute('aria-labelledby'), 'tab-events');
  assert.ok(h.$('#panel').innerHTML.includes('我的活動紀錄'));
  assert.deepEqual(h.tabs.map(tab => [tab.getAttribute('aria-selected'), tab.tabIndex]), [['false', -1], ['false', -1], ['false', -1], ['true', 0]]);
  await h.$('.side-tabs').emit('keydown', { key: 'ArrowRight' }); assert.equal(h.ui.tab, 'people');
  await h.$('.side-tabs').emit('keydown', { key: 'ArrowLeft' }); assert.equal(h.ui.tab, 'events');
  await h.$('.side-tabs').emit('keydown', { key: 'Home' }); assert.equal(h.ui.tab, 'people');
  const ignored = await h.$('.side-tabs').emit('keydown', { key: 'Escape' }); assert.equal(ignored.prevented, undefined);
});
