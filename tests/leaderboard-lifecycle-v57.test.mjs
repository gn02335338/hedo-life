import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { replayRun, createRun, applyChoice, advance, enableActivitySchedule, VERSION, MAX_TURNS } from '../dist/engine.js';
import { ROLE_MAP } from '../dist/roles.js';
import { ENDINGS } from '../dist/endings.js';
import { FeedbackStore } from '../worker/feedback-store.js';
import { AchievementStore } from '../worker/achievements.js';
import { CharacterStore } from '../worker/characters.js';
import { ObservationStore } from '../worker/observations.js';
import { LeaderboardStore, validateLeaderboardFilter, validateLeaderboardNickname } from '../worker/leaderboards.js';
import { validateFeedback, validatePublisherToken } from '../worker/feedback.js';
import { deriveLeaderboardScoreV56, deriveLeaderboardScoreFromMetricsV57, deriveLegacyLeaderboardScoreV1FromMetricsV57, leaderboardEligibilityV56, SCORE_VERSION_V56 } from '../dist/leaderboard-score-v56.js';
import { createLeaderboardUIV56, normalizeLeaderboardNicknameV56, endingLeaderboardHTMLV56, leaderboardHTMLV56 } from '../dist/leaderboard-ui-v56.js';
import * as http from '../worker/http.js';

// Run the actual Durable Object router and SQL statements against isolated real
// SQLite. Every submitted score below comes from a canonical seed/action replay;
// synthetic database insertion is reserved for pagination/storage fixtures.
const workerSource = readFileSync(new URL('../worker/index.js', import.meta.url), 'utf8')
  .replace(/^import .*;\n/gm, '')
  .replace('export class HedoArchive', 'globalThis.HedoArchive=class HedoArchive')
  .replace('export default', 'globalThis.worker=');

function harness() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys=ON');
  const sql = {
    exec(query, ...args) {
      let rows = [];
      if (!args.length && query.includes(';')) db.exec(query);
      else {
        const statement = db.prepare(query);
        if (statement.columns().length) rows = statement.all(...args);
        else statement.run(...args);
      }
      return { toArray: () => rows, one: () => { assert.equal(rows.length, 1); return rows[0]; } };
    }
  };
  const storage = {
    sql,
    transactionSync(fn) {
      db.exec('BEGIN IMMEDIATE');
      try { const value = fn(); db.exec('COMMIT'); return value; }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    async getAlarm() { return null; }, async setAlarm() {}
  };
  const ctx = { storage, blockConcurrencyWhile: fn => fn() };
  const scope = vm.createContext({
    DurableObject: class { constructor(context) { this.ctx = context; } },
    replayRun, VERSION, MAX_TURNS, ROLE_MAP, ENDINGS, ...http,
    validateFeedback, validatePublisherToken, FeedbackStore, AchievementStore,
    CharacterStore, ObservationStore, LeaderboardStore, validateLeaderboardFilter,
    validateLeaderboardNickname, deriveLeaderboardScoreV56, leaderboardEligibilityV56,
    SCORE_VERSION_V56, crypto, Response, Request, URL, Date
  });
  vm.runInContext(workerSource, scope);
  const archive = new scope.HedoArchive(ctx, {});
  async function call(path, { method = 'GET', token, body } = {}) {
    archive.rate = new http.RateGuard();
    const response = await archive.fetch(new Request(`https://game.example${path}`, {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    }));
    return { status: response.status, body: await response.json() };
  }
  async function register(token = 'a'.repeat(64)) {
    const response = await call('/api/player', { method: 'POST', body: { token } });
    assert.equal(response.status, 200);
    return { token, id: response.body.playerId };
  }
  return { db, sql, archive, call, register };
}

const completed = n => advance(applyChoice(enableActivitySchedule(createRun('system',
  `e39-cal46-kin49-g-e-s-m-${n.toString(16).padStart(8, '0')}`)), 2));
const proof = (run, runId = randomUUID(), nickname = '職場觀察員') => ({ runId, roleId: run.roleId, seed: run.seed, actions: run.actions, nickname });
const post = (h, player, payload) => h.call('/api/leaderboard', { method: 'POST', token: player.token, body: payload });

test('a lost successful publication receipt can be explicitly retried without changing score, age, identity or collections', async t => {
  const h = harness(); t.after(() => h.db.close());
  const p = await h.register(), payload = proof(completed(57));
  const first = await post(h, p, payload);
  assert.equal(first.status, 200);
  // Treat the first response as lost in transit: retry the exact same proof.
  for (let retry = 0; retry < 4; retry++) {
    const again = await post(h, p, payload);
    assert.equal(again.status, 200);
    assert.deepEqual(again.body.entry, first.body.entry);
  }
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM leaderboard_entries').one().n, 1);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM runs').one().n, 1);
  const mine = await h.call('/api/leaderboard/mine', { token: p.token });
  assert.equal(mine.body.entries.length, 1);
  assert.equal((await h.call('/api/me', { token: p.token })).body.totalRuns, 1);
});

test('repeated renames alter only nickname and cannot renew the public tie timestamp', async t => {
  const h = harness(); t.after(() => h.db.close());
  const p = await h.register(), payload = proof(completed(58));
  const first = await post(h, p, payload);
  assert.equal(first.status, 200);
  const original = h.sql.exec('SELECT * FROM leaderboard_entries WHERE run_id = ?', payload.runId).one();
  for (const nickname of ['第一次改名', '第二次改名', '第二次改名']) {
    const renamed = await h.call(`/api/leaderboard/${payload.runId}`, { method: 'PATCH', token: p.token, body: { nickname } });
    assert.equal(renamed.status, 200);
    assert.deepEqual(renamed.body.entry, { ...first.body.entry, nickname });
    assert.deepEqual({ ...h.sql.exec('SELECT * FROM leaderboard_entries WHERE run_id = ?', payload.runId).one() }, { ...original, nickname });
  }
  assert.equal((await h.call('/api/me', { token: p.token })).body.totalRuns, 1);
});

test('withdrawing each player best reveals the next canonical best for that metric, without counting an extra player', async t => {
  const h = harness(); t.after(() => h.db.close());
  const p = await h.register(), payloads = [];
  for (let n = 60; n < 68; n++) {
    const run = completed(n), payload = proof(run, randomUUID(), `候選${n}`);
    payloads.push(payload);
    assert.equal((await post(h, p, payload)).status, 200);
  }
  for (const metric of ['overall', 'skill', 'slack', 'lick', 'cash']) {
    const own = (await h.call('/api/leaderboard/mine', { token: p.token })).body.entries;
    if (own.length < 2) break;
    const before = (await h.call(`/api/leaderboard?metric=${metric}`)).body;
    assert.equal(before.totalPlayers, 1);
    assert.equal(before.entries.length, 1);
    const best = before.entries[0];
    const removed = own.find(row => row.entryId === best.entryId);
    assert.ok(removed);
    assert.equal((await h.call(`/api/leaderboard/${removed.runId}`, { method: 'DELETE', token: p.token })).status, 200);
    const after = (await h.call(`/api/leaderboard?metric=${metric}`)).body;
    assert.equal(after.totalPlayers, 1);
    assert.equal(after.entries.length, 1);
    assert.notEqual(after.entries[0].entryId, best.entryId);
    assert.equal(after.entries[0].value, Math.max(...own.filter(row => row.entryId !== best.entryId).map(row => row.metrics[metric])));
  }
  assert.equal((await h.call('/api/me', { token: p.token })).body.totalRuns, payloads.length);
});

test('a lost successful withdrawal receipt is safe to retry and no sync or metadata patch can revive the name', async t => {
  const h = harness(); t.after(() => h.db.close());
  const p = await h.register(), payload = proof(completed(68));
  assert.equal((await post(h, p, payload)).status, 200);
  for (let retry = 0; retry < 4; retry++) assert.equal((await h.call(`/api/leaderboard/${payload.runId}`, { method: 'DELETE', token: p.token })).status, 200);
  assert.equal((await h.call('/api/complete', { method: 'POST', token: p.token, body: payload })).status, 200);
  assert.equal((await h.call(`/api/leaderboard/${payload.runId}`, { method: 'PATCH', token: p.token, body: { nickname: '不能偷偷回榜' } })).status, 404);
  assert.equal((await h.call('/api/leaderboard')).body.totalPlayers, 0);
  assert.equal((await h.call('/api/leaderboard/mine', { token: p.token })).body.entries.length, 0);
  assert.equal((await h.call('/api/me', { token: p.token })).body.totalRuns, 1);
  assert.equal((await post(h, p, { ...payload, nickname: '我明確重新留名' })).status, 200);
  assert.equal((await h.call('/api/leaderboard')).body.totalPlayers, 1);
});

test('pagination with identical timestamps visits all owned names once and deletion of a cursor fails explicitly', async t => {
  const h = harness(); t.after(() => h.db.close());
  const p = await h.register(), other = await h.register('b'.repeat(64));
  const run = completed(69), score = deriveLeaderboardScoreV56(run), store = h.archive.leaderboardStore();
  const date = '2026-10-23T00:00:00.000Z';
  for (let i = 0; i < 207; i++) {
    const runId = randomUUID();
    h.sql.exec('INSERT INTO runs (id,player_id,ending_id,role_id,actual_role_id,rank,salary,turns,game_version,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
      runId, p.id, run.endingId, run.roleId, run.actualRoleId, run.rank, run.pay, run.turn, VERSION, date);
    store.publish(p.id, runId, run, score, `同時留名${i}`, date);
  }
  const pages = [];
  let after = null;
  do {
    const response = await h.call(`/api/leaderboard/mine${after ? `?after=${after}` : ''}`, { token: p.token });
    assert.equal(response.status, 200);
    pages.push(response.body);
    after = response.body.nextCursor;
  } while (after);
  assert.deepEqual(pages.map(row => row.entries.length), [100, 100, 7]);
  assert.equal(new Set(pages.flatMap(row => row.entries.map(entry => entry.runId))).size, 207);
  assert.equal((await h.call(`/api/leaderboard/mine?after=${pages[0].nextCursor}`, { token: other.token })).status, 400);
  const cursorRow = pages[0].entries.at(-1);
  assert.equal((await h.call(`/api/leaderboard/${cursorRow.runId}`, { method: 'DELETE', token: p.token })).status, 200);
  const stale = await h.call(`/api/leaderboard/mine?after=${pages[0].nextCursor}`, { token: p.token });
  assert.equal(stale.status, 400);
  assert.equal(stale.body.error, 'invalid_leaderboard_cursor');
  assert.equal((await h.call('/api/leaderboard')).body.totalPlayers, 1);
});

function uiOverWorker(h, p, run, { losePublishReceipt = false, loseWithdrawalReceipt = false } = {}) {
  const listeners = new Map(), calls = [];
  let html = '', publishLost = false, withdrawalLost = false;
  const doc = { activeElement: null, addEventListener(type, fn) { (listeners.get(type) || listeners.set(type, []).get(type)).push(fn); } };
  const dialog = { open: false, scrollTop: 0, ownerDocument: doc, querySelector(selector) {
    if (selector === '[data-leaderboard-board]' && html.includes('data-leaderboard-board')) return {};
    if (selector === '.lb-my-entries' || selector === '.lb-rules') return { open: true };
    return null;
  } };
  async function request(path, options = {}) {
    calls.push({ path, method: options.method || 'GET' });
    const response = await h.call(path, { ...options, token: p.token });
    if (response.status !== 200) throw Object.assign(new Error(response.body.message), { status: response.status });
    return response.body;
  }
  const cloud = {
    leaderboard: ({ metric, role }) => request(`/api/leaderboard?metric=${metric}&role=${role}`),
    myLeaderboard: ({ after } = {}) => request(`/api/leaderboard/mine${after ? `?after=${after}` : ''}`),
    async submitLeaderboard(state, nickname) {
      const body = proof(state, state.runId, nickname);
      const response = await request('/api/leaderboard', { method: 'POST', body });
      if (losePublishReceipt && !publishLost) { publishLost = true; throw new TypeError('lost accepted receipt'); }
      return response;
    },
    renameLeaderboard: (runId, nickname) => request(`/api/leaderboard/${runId}`, { method: 'PATCH', body: { nickname } }),
    async removeLeaderboard(runId) {
      const response = await request(`/api/leaderboard/${runId}`, { method: 'DELETE' });
      if (loseWithdrawalReceipt && !withdrawalLost) { withdrawalLost = true; throw new TypeError('lost withdrawal receipt'); }
      return response;
    }
  };
  const ui = createLeaderboardUIV56({ dialog, cloud, document: doc, getRun: () => run,
    openDialog(value) { html = value; dialog.open = true; } });
  function dispatch(type, target) { for (const fn of listeners.get(type) || []) fn({ target, preventDefault() {} }); }
  return {
    ui, calls, html: () => html, ending: () => ui.endingHTML(run),
    submit(nickname, { scope = 'ending', index = 0, consent = true } = {}) {
      const input = { value: nickname }, checkbox = { checked: consent };
      const form = { dataset: { lbForm: scope, lbIndex: String(index) }, closest: selector => selector === '[data-lb-form]' ? form : null,
        querySelector: selector => selector === '[data-lb-name]' ? input : selector === '[data-lb-consent]' ? checkbox : null };
      dispatch('submit', form);
    },
    command(command, scope = 'ending', index = 0) {
      dispatch('click', { closest: selector => selector === '[data-lb-command]' ? { dataset: { lbCommand: command, lbScope: scope, lbIndex: String(index) } } : null });
    }
  };
}
// Worker authentication uses WebCrypto, whose thread-pool completion is not
// tied to a fixed number of event-loop turns. Await the observable result that
// each interaction promises, with a bounded timeout for a useful failure.
async function waitForUI(condition, description) {
  const deadline = Date.now() + 15_000;
  while (!condition() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5));
  assert.ok(condition(), `UI did not finish: ${description}`);
}

test('leave-name, rename and confirmed withdrawal work end-to-end through UI controller and real Worker receipts', async t => {
  const h = harness(); t.after(() => h.db.close());
  const p = await h.register(), run = { ...completed(70), runId: randomUUID() };
  const flow = uiOverWorker(h, p, run);
  await flow.ui.open();
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM leaderboard_entries').one().n, 0);
  flow.command('skip'); flow.command('unskip');
  assert.equal(flow.calls.filter(row => row.method === 'POST').length, 0, 'opening, skipping and reopening the prompt never publishes');
  flow.submit('第一個化名'); flow.submit('第一個化名');
  await waitForUI(() => /留名已確認/.test(flow.ending()), 'publication acknowledgement');
  assert.equal(flow.calls.filter(row => row.method === 'POST').length, 1);
  assert.match(flow.ending(), /留名已確認/);
  const before = h.sql.exec('SELECT * FROM leaderboard_entries').one();
  flow.submit('修改後的化名', { scope: 'mine' });
  await waitForUI(() => /修改後的化名/.test(flow.html()) && /留名已確認/.test(flow.html()), 'metadata rename acknowledgement');
  assert.equal(flow.calls.filter(row => row.method === 'PATCH').length, 1);
  assert.deepEqual({ ...h.sql.exec('SELECT * FROM leaderboard_entries').one() }, { ...before, nickname: '修改後的化名' });
  assert.match(flow.html(), /修改後的化名/);
  flow.command('withdraw', 'mine');
  assert.equal(flow.calls.filter(row => row.method === 'DELETE').length, 0, 'opening confirmation is read-only');
  flow.command('withdraw-confirm', 'mine'); flow.command('withdraw-confirm', 'mine');
  await waitForUI(() => /目前沒有公開留名/.test(flow.html()), 'confirmed withdrawal acknowledgement');
  assert.equal(flow.calls.filter(row => row.method === 'DELETE').length, 1);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM leaderboard_entries').one().n, 0);
  assert.match(flow.html(), /目前沒有公開留名/);
  assert.equal((await h.call('/api/me', { token: p.token })).body.totalRuns, 1);
});

test('UI recovers lost successful publish and withdrawal receipts by querying, without silently issuing mutations', async t => {
  const h = harness(); t.after(() => h.db.close());
  const p = await h.register(), run = { ...completed(71), runId: randomUUID() };
  const flow = uiOverWorker(h, p, run, { losePublishReceipt: true, loseWithdrawalReceipt: true });
  await flow.ui.open();
  flow.submit('封包迷路但有上榜');
  await waitForUI(() => /還不能確認結果/.test(flow.ending()), 'lost publication receipt error');
  assert.match(flow.ending(), /還不能確認結果/);
  assert.doesNotMatch(flow.ending(), /留名已確認|這局已以/);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM leaderboard_entries').one().n, 1);
  flow.command('mine-refresh');
  await waitForUI(() => /這局已以/.test(flow.ending()), 'authenticated read after lost publication receipt');
  assert.match(flow.ending(), /這局已以/);
  assert.match(flow.ending(), /封包迷路但有上榜/);
  flow.command('withdraw'); flow.command('withdraw-confirm');
  await waitForUI(() => /還不能確認結果/.test(flow.ending()), 'lost withdrawal receipt error');
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM leaderboard_entries').one().n, 0);
  assert.match(flow.ending(), /還不能確認結果/);
  flow.command('mine-refresh');
  await waitForUI(() => !/這局已以|正在確認這局是否已留名/.test(flow.ending()), 'authenticated read after lost withdrawal receipt');
  assert.doesNotMatch(flow.ending(), /這局已以/);
  assert.equal(flow.calls.filter(row => row.method === 'POST').length, 1);
  assert.equal(flow.calls.filter(row => row.method === 'DELETE').length, 1);
  assert.equal((await h.call('/api/leaderboard')).body.totalPlayers, 0);
});

function storedLegacy(h, player, run, { runId = randomUUID(), nickname = '原來的化名', date = '2026-10-22T12:00:00.000Z' } = {}) {
  const score = deriveLeaderboardScoreV56(run);
  const legacy = deriveLegacyLeaderboardScoreV1FromMetricsV57(score.metrics, run.endingId);
  h.sql.exec('INSERT INTO runs (id,player_id,ending_id,role_id,actual_role_id,rank,salary,turns,game_version,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
    runId, player.id, run.endingId, run.roleId, run.actualRoleId, run.rank, run.pay, run.turn, VERSION, date);
  h.archive.leaderboardStore().publish(player.id, runId, run, score, nickname, date);
  h.sql.exec('UPDATE leaderboard_entries SET score_version=1,total=?,migration_status=0 WHERE run_id=?', legacy.total, runId);
  return { ...h.sql.exec('SELECT * FROM leaderboard_entries WHERE run_id=?', runId).one() };
}

test('score-v1 migration is bounded, transactional and never serves a partially regraded public board', async t => {
  const h = harness(); t.after(() => h.db.close());
  const p = await h.register(), before = [];
  for (let i = 0; i < 103; i++) before.push(storedLegacy(h, p, completed(80 + i), { nickname: `舊化名${i}` }));
  const first = await h.call('/api/leaderboard');
  assert.equal(first.status, 503);
  assert.equal(first.body.error, 'leaderboard_recalculating');
  assert.equal(first.body.entries, undefined, 'partial rankings must not look final');
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM leaderboard_entries WHERE score_version=2').one().n, 100);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM leaderboard_entries WHERE score_version=1 AND migration_status=0').one().n, 3);
  const mineDuring = (await h.call('/api/leaderboard/mine', { token: p.token })).body;
  assert.equal(mineDuring.entries.length, 100, 'private name management remains available while regrading');
  assert.ok(mineDuring.entries.every(row => [1, 2].includes(row.scoreVersion)));
  const second = await h.call('/api/leaderboard');
  assert.equal(second.status, 200);
  assert.equal(second.body.scoreVersion, 2);
  assert.equal(second.body.totalPlayers, 1);
  assert.equal(second.body.entries.length, 1);
  for (const row of before) {
    const after = { ...h.sql.exec('SELECT * FROM leaderboard_entries WHERE run_id=?', row.run_id).one() };
    const metrics = Object.fromEntries(Object.entries(deriveLeaderboardScoreV56(completed(80 + Number(row.nickname.slice(3)))) .metrics));
    const expected = deriveLeaderboardScoreFromMetricsV57(metrics, 'ragequit-system');
    assert.equal(after.total, expected.total);
    assert.deepEqual(after, { ...row, total: expected.total, score_version: 2, migration_status: 1 });
  }
  const snapshot = JSON.stringify(h.sql.exec('SELECT * FROM leaderboard_entries ORDER BY run_id').toArray());
  assert.equal((await h.call('/api/leaderboard')).status, 200);
  assert.equal(JSON.stringify(h.sql.exec('SELECT * FROM leaderboard_entries ORDER BY run_id').toArray()), snapshot, 'repeated reads do not regrade or change public identities');
});

test('a failed score migration batch rolls back all converted entries and resumes safely', async t => {
  const h = harness(); t.after(() => h.db.close());
  const p = await h.register();
  for (let i = 0; i < 5; i++) storedLegacy(h, p, completed(200 + i));
  const execute = h.sql.exec;
  let updates = 0;
  h.sql.exec = (query, ...args) => {
    if (query.startsWith('UPDATE leaderboard_entries SET total=') && ++updates === 3) throw new Error('simulated SQL write failure');
    return execute(query, ...args);
  };
  assert.equal((await h.call('/api/leaderboard')).status, 503);
  h.sql.exec = execute;
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM leaderboard_entries WHERE score_version=1 AND migration_status=0').one().n, 5);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM leaderboard_entries WHERE score_version=2').one().n, 0);
  assert.equal((await h.call('/api/leaderboard')).status, 200);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM leaderboard_entries WHERE score_version=2').one().n, 5);
});

test('malformed old score evidence is quarantined without deleting its opt-in name or blocking valid rankings', async t => {
  const h = harness(); t.after(() => h.db.close());
  const p = await h.register(), other = await h.register('b'.repeat(64));
  const good = storedLegacy(h, p, completed(210));
  const badTotal = storedLegacy(h, p, completed(211), { nickname: '分數待核對' });
  const badMetric = storedLegacy(h, p, completed(212), { nickname: '能力待核對' });
  const badEnding = storedLegacy(h, p, completed(213), { nickname: '結局待核對' });
  h.sql.exec('UPDATE leaderboard_entries SET total=total+1 WHERE run_id=?', badTotal.run_id);
  h.sql.exec('UPDATE leaderboard_entries SET metric_turns=24 WHERE run_id=?', badMetric.run_id);
  h.sql.exec('UPDATE runs SET ending_id=? WHERE id=?', 'unknown-future-ending', badEnding.run_id);
  const board = await h.call('/api/leaderboard');
  assert.equal(board.status, 200);
  assert.equal(board.body.entries.length, 1);
  assert.equal(board.body.entries[0].entryId, good.entry_id);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM leaderboard_entries WHERE migration_status=-1').one().n, 3);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM leaderboard_entries').one().n, 4);
  const own = (await h.call('/api/leaderboard/mine', { token: p.token })).body.entries;
  assert.equal(own.length, 4);
  assert.equal(own.find(row => row.runId === badTotal.run_id).scoreVersion, 1);
  const renamed = await h.call(`/api/leaderboard/${badTotal.run_id}`, { method: 'PATCH', token: p.token, body: { nickname: '我仍可管理舊名' } });
  assert.equal(renamed.status, 200);
  assert.equal(renamed.body.entry.scoreVersion, 1, 'a rename does not pretend an old score was upgraded');
  assert.equal(renamed.body.entry.total, badTotal.total + 1);
  assert.equal((await h.call(`/api/leaderboard/${badTotal.run_id}`, { method: 'PATCH', token: other.token, body: { nickname: '冒名改舊名' } })).status, 404);
  assert.equal((await h.call(`/api/leaderboard/${badTotal.run_id}`, { method: 'DELETE', token: p.token })).status, 200);
  assert.equal((await h.call('/api/leaderboard')).body.entries.length, 1);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM runs').one().n, 4, 'withdrawing a name preserves completion history');
});

test('an explicitly resubmitted exact old proof upgrades the score without changing public identity or original publication date', async t => {
  const h = harness(); t.after(() => h.db.close());
  const p = await h.register(), run = completed(220), payload = proof(run);
  const first = await post(h, p, payload);
  assert.equal(first.status, 200);
  const legacy = deriveLegacyLeaderboardScoreV1FromMetricsV57(first.body.entry.metrics, run.endingId);
  h.sql.exec('UPDATE leaderboard_entries SET score_version=1,total=?,migration_status=0 WHERE run_id=?', legacy.total, payload.runId);
  const upgraded = await post(h, p, { ...payload, nickname: '同一人生新計分' });
  assert.equal(upgraded.status, 200);
  assert.deepEqual(upgraded.body.entry, { ...first.body.entry, nickname: '同一人生新計分' });
  assert.equal(upgraded.body.entry.entryId, first.body.entry.entryId);
  assert.equal(upgraded.body.entry.createdAt, first.body.entry.createdAt);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM runs').one().n, 1);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM leaderboard_entries').one().n, 1);
});

test('old row owner, requested job, actual job and ending role must match the canonical completion before regrading', async t => {
  const h = harness(); t.after(() => h.db.close());
  const p = await h.register(), other = await h.register('b'.repeat(64));
  const good = storedLegacy(h, p, completed(230));
  const rows = Array.from({ length: 5 }, (_, i) => storedLegacy(h, p, completed(231 + i)));
  h.sql.exec('UPDATE leaderboard_entries SET player_id=? WHERE run_id=?', other.id, rows[0].run_id);
  h.sql.exec('UPDATE leaderboard_entries SET role_id=? WHERE run_id=?', 'ai', rows[1].run_id);
  h.sql.exec('UPDATE leaderboard_entries SET actual_role_id=? WHERE run_id=?', 'sales', rows[2].run_id);
  h.sql.exec('UPDATE runs SET ending_id=? WHERE id=?', 'ragequit-ai', rows[3].run_id);
  h.sql.exec('UPDATE leaderboard_entries SET actual_role_id=? WHERE run_id=?', 'unknown-role', rows[4].run_id);
  const board = await h.call('/api/leaderboard');
  assert.equal(board.status, 200);
  assert.equal(board.body.entries.length, 1);
  assert.equal(board.body.entries[0].entryId, good.entry_id);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM leaderboard_entries WHERE migration_status=-1').one().n, 5);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM leaderboard_entries').one().n, 6);
});

test('nickname acceptance agrees between browser and Worker, and score rules explain experience and retained old-name management', () => {
  for (const nickname of ['台灣打工仔', '  ＪＫ　同學  ', '🚀🚀', '兩  個空白']) assert.equal(normalizeLeaderboardNicknameV56(nickname), validateLeaderboardNickname(nickname));
  for (const nickname of ['alice.dev', 'a@b', '測試@玩家', 'ＡＢ．ｃｏｍ', '網址://範例', 'ab\n玩家', 'ab\u202E', '<暱稱>']) {
    assert.throws(() => normalizeLeaderboardNicknameV56(nickname));
    assert.throws(() => validateLeaderboardNickname(nickname));
  }
  const run = completed(221), score = deriveLeaderboardScoreV56(run);
  const ending = endingLeaderboardHTMLV56(run);
  assert.match(ending, /工作經驗/);
  assert.match(ending, new RegExp(`${score.experience.percent}%`));
  assert.match(ending, /完成 19 個工作回合/);
  assert.match(ending, /報到就離開不會靠初始數值/);
  const own = leaderboardHTMLV56({ mineKnown: true, mine: [{ runId: randomUUID(), nickname: '舊計分化名', roleId: run.roleId, actualRoleId: run.actualRoleId, scoreVersion: 1, total: 5623, turns: 0 }] });
  assert.match(own, /這筆留名採第 1 版計分，尚未列入新版名次/);
  assert.match(own, /確認公開改名/);
  assert.match(own, /撤下這局留名/);
  assert.doesNotMatch(ending + own, /data-lb-consent|type="checkbox"/);
});
