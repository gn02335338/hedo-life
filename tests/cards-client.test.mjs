import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createCardState, projectCardState, applyCardAction } from '../dist/cards/rules.js';

const source = readFileSync(new URL('../dist/cards/client.js', import.meta.url), 'utf8').replace(/^import .*\n/gm, '').replace(/^export /gm, '') + '\nglobalThis.client=cardClient;';
const TOKEN = 'a'.repeat(64), OTHER = 'b'.repeat(64), PENDING = 'hodo-cards-pending-v1', IDENTITY = 'hedo-anonymous-v1';
const initial = () => projectCardState(createCardState('synthetic-client-tests'));
const response = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, async json() { return data; } });
const deferred = () => { let resolve, reject; const promise = new Promise((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; };
function storage(values = { [IDENTITY]: TOKEN }) {
  const records = new Map(Object.entries(values));
  return { records, local: { getItem: key => records.get(key) ?? null, setItem: (key, value) => records.set(key, value), removeItem: key => records.delete(key) } };
}
function client(local, fetch) {
  const scope = vm.createContext({ localStorage: local, crypto, AbortSignal, TextEncoder, createCardState, projectCardState, applyCardAction, fetch });
  vm.runInContext(source, scope); return scope.client;
}
function requests(actionHandler, getState = initial) {
  const calls = [];
  const fetch = async (path, options = {}) => {
    const row = { path, token: options.headers?.Authorization?.slice(7), body: options.body ? JSON.parse(options.body) : null };
    calls.push(row);
    if (path === '/api/player') return response({ playerId: 'synthetic-player' });
    if (path === '/api/cards') return response({ state: getState(row.token) });
    if (path === '/api/cards/action') return actionHandler(row);
    throw new Error('Unexpected endpoint');
  };
  return { fetch, calls };
}

test('card connection reuses anonymous identity without reading or rewriting career saves or proof queues', async () => {
  const saved = storage({ [IDENTITY]: TOKEN, 'hedo-life-v3': 'career-save', 'hedo-sync-queue-v3': 'career-proofs', 'hedo-achievement-queue-v1': 'milestones' });
  const network = requests(() => { throw new Error('Must not mutate'); }), app = client(saved.local, network.fetch);
  const state = await app.connect(); assert.equal(state.tickets, 15); assert.equal(app.mode, 'online');
  assert.deepEqual(network.calls.map(row => row.path), ['/api/player', '/api/cards']);
  assert.ok(network.calls.every(row => row.token === TOKEN)); assert.equal(network.calls[0].body.token, TOKEN);
  assert.equal(saved.records.get('hedo-life-v3'), 'career-save'); assert.equal(saved.records.get('hedo-sync-queue-v3'), 'career-proofs'); assert.equal(saved.records.get('hedo-achievement-queue-v1'), 'milestones');
});

test('an uncertain committed draw survives reload and retries the exact UUID, revision and action once', async () => {
  const saved = storage(), posted = []; let official = initial(), mutations = 0;
  const network = requests(row => {
    posted.push(row.body);
    if (posted.length === 1) { official = projectCardState(applyCardAction(createCardState('synthetic-client-tests'), row.body.action)); mutations++; throw new Error('Synthetic lost response after commit'); }
    return response({ duplicate: true, state: official });
  }, () => official);
  const first = client(saved.local, network.fetch), state = await first.connect();
  await assert.rejects(first.action(state, { type: 'draw', count: 1, banner: 'all' }));
  assert.equal(first.hasPending, true); const receipt = JSON.parse(saved.records.get(PENDING));
  assert.ok(!JSON.stringify(receipt).includes(TOKEN)); assert.equal(receipt.body.revision, 0);
  const reloaded = client(saved.local, network.fetch), recovered = await reloaded.connect();
  assert.deepEqual(posted[1], posted[0]); assert.equal(mutations, 1); assert.equal(recovered.tickets, 14); assert.equal(recovered.revision, 1);
  assert.equal(saved.records.has(PENDING), false); assert.equal(reloaded.hasPending, false);
});

test('a delayed older tab retry cannot erase a newer pending action from the same owner', { timeout: 5000 }, async () => {
  const saved = storage(), waiting = [], retryObserved = deferred();
  const network = requests(row => { const pending = deferred(); waiting.push({ ...pending, ...row }); if (waiting.length === 2) retryObserved.resolve(); return pending.promise; });
  const a = client(saved.local, network.fetch), b = client(saved.local, network.fetch), firstState = await a.connect(); await b.connect();
  const first = a.action(firstState, { type: 'draw', count: 1, banner: 'all' });
  const retry = b.connect(); await retryObserved.promise; assert.equal(waiting.length, 2);
  waiting[0].resolve(response({ state: { ...firstState, revision: 1, tickets: 14 } })); await first;
  const second = a.action({ ...firstState, revision: 1, tickets: 14 }, { type: 'draw', count: 1, banner: 'all' });
  const result = second.catch(error => error); assert.equal(waiting.length, 3);
  const expected = JSON.parse(saved.records.get(PENDING)); assert.equal(expected.body.requestId, waiting[2].body.requestId);
  waiting[1].resolve(response({ duplicate: true, state: { ...firstState, revision: 1, tickets: 14 } })); await retry;
  assert.deepEqual(JSON.parse(saved.records.get(PENDING)), expected);
  waiting[2].reject(new Error('Synthetic uncertain newer action')); await result;
  assert.equal(a.hasPending, true); assert.deepEqual(JSON.parse(saved.records.get(PENDING)), expected);
});

test('a delayed response from an older anonymous owner cannot delete another owner pending slot or replay their proof', async () => {
  const saved = storage(), waiting = [];
  const network = requests(row => { const pending = deferred(); waiting.push({ ...pending, ...row }); return pending.promise; });
  const old = client(saved.local, network.fetch), state = await old.connect();
  const oldAction = old.action(state, { type: 'draw', count: 1, banner: 'all' });
  const oldReceipt = JSON.parse(saved.records.get(PENDING)); saved.records.set(IDENTITY, OTHER);
  const current = client(saved.local, network.fetch); await current.connect();
  assert.equal(waiting.length, 1, 'another owner never replays the stored action');
  const newerAction = current.action(state, { type: 'draw', count: 1, banner: 'all' }), newerResult = newerAction.catch(error => error);
  const currentReceipt = JSON.parse(saved.records.get(PENDING)); assert.notEqual(currentReceipt.owner, oldReceipt.owner);
  waiting[0].resolve(response({ state: { ...state, revision: 1, tickets: 14 } })); await oldAction;
  assert.deepEqual(JSON.parse(saved.records.get(PENDING)), currentReceipt);
  assert.equal(waiting[0].token, TOKEN); assert.equal(waiting[1].token, OTHER);
  waiting[1].reject(new Error('Synthetic current-owner timeout')); await newerResult;
  assert.equal(current.hasPending, true); assert.equal(old.hasPending, false);
});

test('an uncertain request remains persisted when its explicit reconnect retry is throttled', async () => {
  const saved = storage(); let attempts = 0;
  const network = requests(() => { attempts++; if (attempts === 1) throw new Error('Synthetic timeout'); return response({ error: 'rate_limited', message: '稍後重試' }, 429); });
  const app = client(saved.local, network.fetch), state = await app.connect();
  await assert.rejects(app.action(state, { type: 'draw', count: 1, banner: 'all' }));
  const pending = saved.records.get(PENDING); await assert.rejects(app.connect(), error => error.status === 429);
  assert.equal(saved.records.get(PENDING), pending); assert.equal(app.hasPending, true);
});

test('confirmed first-attempt rejection clears only its own request and does not resubmit it in the background', async () => {
  for (const status of [400, 409, 429]) {
    const saved = storage(), network = requests(() => response({ message: 'Synthetic confirmed rejection' }, status));
    const app = client(saved.local, network.fetch), state = await app.connect();
    await assert.rejects(app.action(state, { type: 'draw', count: 1, banner: 'all' }), error => error.status === status);
    assert.equal(saved.records.has(PENDING), false); assert.equal(app.hasPending, false);
    await app.connect(); assert.equal(network.calls.filter(row => row.path === '/api/cards/action').length, 1);
  }
});

test('practice collection and draws stay local and a failed reconnect never routes practice actions to the official API', async () => {
  const saved = storage(), calls = [];
  const app = client(saved.local, async (path) => { calls.push(path); throw new Error('Synthetic offline connection'); });
  let state = await app.practice(); assert.equal(app.mode, 'practice'); assert.equal(calls.length, 0);
  state = await app.action(state, { type: 'draw', count: 1, banner: 'all' }); assert.equal(state.tickets, 14); assert.equal(calls.length, 0);
  await assert.rejects(app.connect()); assert.equal(app.mode, 'practice');
  state = await app.action(state, { type: 'draw', count: 1, banner: 'all' }); assert.equal(state.tickets, 13);
  assert.deepEqual(calls, ['/api/player']); assert.equal(saved.records.has(PENDING), false); assert.equal(saved.records.get(IDENTITY), TOKEN);
  const reloaded = client(saved.local, async () => { throw new Error('Practice must not connect'); });
  assert.equal((await reloaded.practice()).tickets, 13); assert.equal(reloaded.mode, 'practice');
});

test('blocked storage prevents a new anonymous registration or an untracked paid action', async () => {
  const missing = storage({}), missingNetwork = requests(() => { throw new Error('Must not submit'); });
  missing.local.setItem = () => { throw new Error('Storage blocked'); };
  await assert.rejects(client(missing.local, missingNetwork.fetch).connect()); assert.equal(missingNetwork.calls.length, 0);
  const existing = storage(), network = requests(() => { throw new Error('Must not submit untracked action'); });
  const app = client(existing.local, network.fetch), state = await app.connect();
  existing.local.setItem = () => { throw new Error('Storage blocked'); };
  await assert.rejects(app.action(state, { type: 'draw', count: 1, banner: 'all' }));
  assert.equal(network.calls.filter(row => row.path === '/api/cards/action').length, 0);
});
