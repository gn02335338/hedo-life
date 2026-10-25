import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { racingCalendar, dailyChallenge } from '../dist/gta/racing-calendar.js';
import { RACE_CATALOG } from '../dist/gta/racing-catalog.js';
import { createDailyChallengePanel, weekRange } from '../dist/gta/daily-ui.js';

const appSource = readFileSync(new URL('../dist/gta/app.js', import.meta.url), 'utf8');
const monday = Date.parse('2026-10-25T16:00:00.000Z');
const plain = value => JSON.parse(JSON.stringify(value));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

// app.js owns browser startup and does not export its handlers. Execute the
// actual named function declarations in a tiny browser boundary harness. The
// JavaScript parser determines each declaration's end, so braces in strings,
// callbacks and comments do not require a second implementation of the logic.
function appFunction(name) {
  const start = appSource.search(new RegExp(`^(?:async )?function ${name}\\(`, 'm'));
  assert.ok(start >= 0, `Missing app handler: ${name}`);
  let end = appSource.indexOf('\n', start);
  while (end !== -1) {
    const declaration = appSource.slice(start, end);
    try { new vm.Script(declaration); return declaration; }
    catch (error) { if (!(error instanceof SyntaxError)) throw error; }
    end = appSource.indexOf('\n', end + 1);
  }
  assert.fail(`Could not parse the complete app handler: ${name}`);
}

function harness(names = []) {
  let clock = monday - 1000;
  const views = [], withdrawals = [], messages = [], starts = [], refreshed = [];
  const panel = { open: true, scrollTop: 0, close() { this.open = false; } };
  const panelNode = { replaceWith() {} };
  const context = vm.createContext({
    Date: class extends Date { static now() { return clock; } }, crypto,
    racingCalendar, dailyChallenge, RACE_CATALOG, weekRange,
    started: true, pendingDeath: false, pendingArrest: false, transition: false,
    progress: { money: 0 }, race: { phase: 'idle' }, raceTab: 'records',
    calendarOffset: 0, calendarError: '', calendarViewDay: null,
    selectedRaceId: 'first-sprint', rankingScope: 'global', rankingPeriod: 'weekly', rankingStatus: 'idle',
    rankingData: null, rankingMine: null, rankingError: '', rankingMineError: '', rankingBusy: false,
    rankingMessage: '', rankingPending: null, rankingPendingError: '', rankingRequest: 0,
    raceUploadCandidates: new Map(),
    deriveRacingRecords: () => ({ byRace: Object.fromEntries(RACE_CATALOG.map(race => [race.id, { best: null }])) }),
    deriveDailyChallenge: (_, dayId) => ({ definition: dailyChallenge(dayId), best: null, finishCount: 0, completed: false, claimed: false, claimable: false }),
    currentCar: () => null, raceEligibility: () => ({ ok: true }), raceContext: () => ({}),
    raceLive: () => false, navigateRace() {}, beginRace() {}, publishRaceResult() {},
    refreshRaceCalendar: async () => {},
    showRaces: message => messages.push(message),
    startRace: (...args) => { starts.push(args); return { ok: false, message: 'test eligibility gate' }; },
    createRacingPanel: props => { views.push(props); return panelNode; },
    openPanel: () => { panel.open = true; }, panel,
    document: { activeElement: null }, $: id => id === 'race-panel' && panel.open ? panelNode : null,
    loadRaceRankings: async refresh => { refreshed.push(refresh); },
    rankingClient: { withdraw: async (raceId, options) => { withdrawals.push({ raceId, ...options }); } },
  });
  const handlers = new Set(['calendarNow', 'currentRaceCalendar', 'rankingPeriodOptions', 'matchingPeriod',
    'renderRaces', 'refreshRacePanel', 'withdrawRaceResult', ...names]);
  vm.runInContext([...handlers].map(appFunction).join('\n'), context);
  return { context, views, withdrawals, messages, starts, refreshed, setTime(value) { clock = value; } };
}

test('a visible Sunday withdrawal keeps its displayed week when clicked after the Monday boundary', async () => {
  const h = harness();
  h.context.renderRaces();
  const sundayView = h.views.at(-1);
  assert.match(sundayView.board.periodLabel, /10\/19/);
  h.setTime(monday + 1000);
  await sundayView.onWithdraw('first-sprint');
  assert.deepEqual(plain(h.withdrawals), [{ raceId: 'first-sprint', scope: 'weekly', weekId: '2026-10-19' }]);
  assert.match(h.context.rankingMessage, /10\/19/);
  assert.equal(h.context.rankingBusy, false);
  assert.deepEqual(h.refreshed, [true]);
  // The same action refreshes the visible panel to Monday without changing
  // which period the original action was authorized to remove.
  assert.match(h.views.at(-1).board.periodLabel, /10\/26/);
});

test('a delayed Sunday GET is discarded after rollover and fetches the new week before showing results', async () => {
  const h = harness(['loadRaceRankings']), sunday = deferred(), current = deferred(), calls = [];
  h.context.rankingClient = {
    pending: async () => null,
    board: (raceId, options) => {
      calls.push({ raceId, ...options });
      return options.weekId === '2026-10-19' ? sunday.promise : current.promise;
    },
    mine: async options => ({ version: 1, ...options, driverCode: null, entries: [] }),
  };
  const oldRequest = h.context.loadRaceRankings();
  assert.equal(calls.length, 1);
  h.setTime(monday + 1000);
  sunday.resolve({ version: 1, scope: 'weekly', weekId: '2026-10-19', raceId: 'first-sprint', totalDrivers: 1, entries: [{ driverCode: 'old-week' }] });
  await oldRequest;
  assert.deepEqual(plain(calls), [
    { raceId: 'first-sprint', refresh: false, scope: 'weekly', weekId: '2026-10-19' },
    { raceId: 'first-sprint', refresh: true, scope: 'weekly', weekId: '2026-10-26' },
  ]);
  assert.equal(h.context.rankingData, null);
  assert.equal(h.context.rankingStatus, 'loading');
  current.resolve({ version: 1, scope: 'weekly', weekId: '2026-10-26', raceId: 'first-sprint', totalDrivers: 0, entries: [] });
  await new Promise(setImmediate);
  assert.equal(h.context.rankingStatus, 'ready');
  assert.equal(h.context.rankingData.weekId, '2026-10-26');
  assert.equal(h.views.at(-1).board.data.weekId, '2026-10-26');
  assert.ok(h.views.every(view => view.board.data?.weekId !== '2026-10-19'));
});

test('a delayed rollover response does not start a new request after the race centre closes', async () => {
  const h = harness(['loadRaceRankings']), pending = deferred(); let requests = 0;
  h.context.rankingClient = { pending: async () => null, board: () => { requests += 1; return pending.promise; }, mine: async () => null };
  const request = h.context.loadRaceRankings();
  h.setTime(monday + 1000); h.context.panel.close();
  pending.resolve({ weekId: '2026-10-19' });
  await request;
  assert.equal(requests, 1); assert.equal(h.context.rankingData, null);
});

class Element {
  constructor(tag) { this.tagName = tag; this.children = []; this.listeners = new Map(); }
  append(...children) { this.children.push(...children); }
  addEventListener(type, callback) { this.listeners.set(type, callback); }
  click() { return this.listeners.get('click')?.(); }
}
function findId(node, id) {
  if (node.id === id) return node;
  for (const child of node.children || []) { const found = findId(child, id); if (found) return found; }
  return null;
}

test('the real daily card carries its displayed day and an outdated click cannot start yesterday’s challenge', t => {
  const h = harness(['beginRace']); h.context.raceTab = 'daily';
  const priorDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: tag => new Element(tag) } });
  t.after(() => { if (priorDocument) Object.defineProperty(globalThis, 'document', priorDocument); else delete globalThis.document; });
  const dailyCard = () => {
    h.context.renderRaces(); const props = h.views.at(-1);
    return createDailyChallengePanel({ ...props.daily, entry: props.entries.find(item => item.id === props.daily.daily.definition.raceId),
      routeArt: () => new Element('svg'), onStart: props.onStart, onNavigate: props.onNavigate });
  };
  const oldStart = findId(dailyCard(), 'race-daily-start'); assert.ok(oldStart); assert.equal(oldStart.disabled, false);
  h.setTime(monday + 1000); oldStart.click();
  assert.equal(h.starts.length, 0); assert.equal(h.context.raceTab, 'daily');
  assert.deepEqual(h.messages, ['每日目標已更新，請確認新目標後重新報名。']);
  // A newly rendered Monday card still reaches the normal eligibility check.
  findId(dailyCard(), 'race-daily-start').click();
  assert.equal(h.starts.length, 1); assert.equal(h.starts[0][1], 'block-sprint');
  assert.equal(h.starts[0][3].dailyDay, '2026-10-26');
});
