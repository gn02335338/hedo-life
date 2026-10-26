import test from 'node:test';
import assert from 'node:assert/strict';
import { ISLAND_CAST } from '../dist/island/cast.js';
import { CHALLENGE_STORAGE_KEY, CHALLENGE_STORAGE_KEYS, CHALLENGE_CHAPTERS, createIslandChallenge } from '../dist/island/challenge.js';

const bosses = ['rick', 'spencer', 'wing'];
const ordinary = ISLAND_CAST.map(person => person.id).filter(id => !bosses.includes(id));
const legacy = { 'hedo-island-v1': '{"version":1,"visited":["lobby"],"choices":{"lobby":2}}', 'hedo-life-v3': 'career', 'hedo-anonymous-v1': 'identity' };
function memoryStorage(initial = {}) {
  const entries = new Map(Object.entries(initial)), reads = [], writes = [];
  return { entries, reads, writes,
    getItem(key) { reads.push(key); return entries.get(key) ?? null; },
    setItem(key, value) { writes.push({ key, value }); entries.set(key, value); },
  };
}
function finish(model, id, outcome = 'win') {
  const battle = model.begin(id); assert.equal(battle.ok, true, `${id}: ${battle.message || ''}`);
  const result = model.settle(battle.token, outcome); assert.equal(result.ok, true, id); return result;
}
function throughColleagues(model) { for (const id of ordinary) finish(model, id); }
function throughBosses(model) { throughColleagues(model); for (const id of bosses) finish(model, id); }
function assertHidden(state) {
  assert.equal(state.hidden, null);
  assert.doesNotMatch(JSON.stringify(state), /hidden-visitor|魚酥姐|assets\/hidden/);
}

test('five story chapters cover each of the 31 ordinary colleagues exactly once', () => {
  assert.equal(CHALLENGE_CHAPTERS.length, 5);
  assert.equal(Object.isFrozen(CHALLENGE_CHAPTERS), true);
  const ids = CHALLENGE_CHAPTERS.flatMap(chapter => {
    assert.ok(chapter.id && chapter.title); assert.ok(Object.isFrozen(chapter) && Object.isFrozen(chapter.opponentIds));
    return chapter.opponentIds;
  });
  assert.equal(ids.length, 31); assert.equal(new Set(ids).size, 31);
  assert.deepEqual([...ids].sort(), [...ordinary].sort());
  assert.equal(new Set(CHALLENGE_STORAGE_KEYS).size, 37);
  assert.equal(CHALLENGE_STORAGE_KEYS[0], CHALLENGE_STORAGE_KEY);
  assert.equal(Object.isFrozen(CHALLENGE_STORAGE_KEYS), true);
});

test('all ordinary victories are required before the ordered executive chain and the secret invitation', () => {
  const model = createIslandChallenge({ storage: memoryStorage() });
  const first = model.getState(); assert.equal(first.ordinary.total, 31); assert.equal(first.ordinary.won.length, 0); assert.equal(first.completed, false);
  assert.ok(first.currentStory.title && first.currentStory.body); assert.equal(first.next.opponentId, 'jack'); assert.equal(first.next.name, '傑克');
  assertHidden(first);
  for (const id of ordinary) {
    for (const boss of bosses) { assert.equal(model.canChallenge(boss).ok, false); assert.equal(model.prepare(boss).ok, false); assert.equal(model.begin(boss).ok, false); }
    assert.equal(model.openInvitation().ok, false);
    const result = finish(model, id); assert.equal(result.newVictory, true); assertHidden(result.state);
  }
  assert.equal(model.getState().ordinary.won.length, 31);
  assert.ok(model.getState().chapters.every(chapter => chapter.complete && chapter.completion));
  for (let index = 0; index < bosses.length; index++) {
    const id = bosses[index];
    assert.equal(model.getState().next.opponentId, id);
    for (const later of bosses.slice(index + 1)) assert.equal(model.begin(later).ok, false);
    assert.equal(model.prepare(id).ok, true);
    const result = finish(model, id); assert.match(result.story.body, /。/); assertHidden(result.state);
  }
  const awaiting = model.getState(); assert.equal(awaiting.next.kind, 'invitation'); assert.equal(awaiting.invitation.available, true); assert.equal(awaiting.invitation.opened, false);
  assertHidden(awaiting); assert.equal(model.prepare('hidden-visitor').ok, false);
  const opened = model.openInvitation(); assert.equal(opened.ok, true); assert.equal(opened.state.hidden.id, 'hidden-visitor'); assert.equal(opened.state.hidden.name, '魚酥姐');
  assert.equal(opened.state.next.opponentId, 'hidden-visitor'); assert.ok(opened.story.body.includes('魚酥姐'));
  const ending = finish(model, 'hidden-visitor'); assert.equal(ending.state.completed, true); assert.equal(ending.state.wins.length, 35);
  assert.equal(ending.state.next.kind, 'complete'); assert.ok(ending.state.completion.title && ending.state.completion.body); assert.ok(ending.story.body.includes('三十五位'));
});

test('loss, draw, preparation and cancellation never become victory receipts or erase prior wins', () => {
  const storage = memoryStorage(legacy), model = createIslandChallenge({ storage });
  assert.equal(model.prepare('jack').ok, true); assert.equal(storage.writes.length, 0);
  const battle = model.begin('jack'); assert.equal(model.getState().active.opponentId, 'jack'); assert.equal(model.openInvitation().ok, false);
  assert.equal(model.cancel(battle.token).ok, true); assert.equal(model.getState().active, null); assert.equal(storage.writes.length, 0);
  const lost = finish(model, 'jack', 'lose'); assert.equal(lost.newVictory, false); assert.equal(lost.state.wins.length, 0); assert.ok(lost.story.body.includes('重新挑戰'));
  const draw = finish(model, 'jack', 'draw'); assert.equal(draw.newVictory, false); assert.equal(draw.state.wins.length, 0); assert.equal(storage.writes.length, 0);
  finish(model, 'jack'); const writes = storage.writes.length;
  finish(model, 'helen', 'lose'); finish(model, 'helen', 'draw'); assert.deepEqual(model.getState().wins, ['jack']); assert.equal(storage.writes.length, writes);
  const repeated = finish(model, 'jack'); assert.equal(repeated.newVictory, false); assert.equal(storage.writes.length, writes); assert.equal(repeated.state.ordinary.won.length, 1);
  for (const [key, value] of Object.entries(legacy)) assert.equal(storage.entries.get(key), value);
  assert.ok(storage.writes.every(({ key }) => CHALLENGE_STORAGE_KEYS.includes(key)));
  assert.ok(storage.reads.every(key => CHALLENGE_STORAGE_KEYS.includes(key)));
});

test('only the current single-use battle token can settle, and malformed results do not consume it', () => {
  const a = createIslandChallenge({ storage: memoryStorage() }), b = createIslandChallenge({ storage: memoryStorage() });
  const aFight = a.begin('jack'), bFight = b.begin('jack');
  assert.equal(a.begin('helen').ok, false); assert.equal(a.settle(bFight.token, 'win').ok, false);
  for (const token of ['', null, undefined, 1, {}, `${aFight.token}-stale`]) assert.equal(a.settle(token, 'win').ok, false);
  for (const outcome of [null, undefined, 'victory', true, 1, {}, 'WIN']) assert.equal(a.settle(aFight.token, outcome).ok, false);
  assert.equal(a.getState().active.opponentId, 'jack');
  const valid = a.settle(aFight.token, 'win'); assert.equal(valid.newVictory, true);
  assert.equal(a.settle(aFight.token, 'win').ok, false); assert.equal(a.cancel(aFight.token).ok, false);
  const cancelled = a.begin('helen'); a.cancel(cancelled.token); const newer = a.begin('sam');
  assert.equal(a.settle(cancelled.token, 'win').ok, false); assert.equal(a.cancel(cancelled.token).ok, false);
  assert.equal(a.getState().active.opponentId, 'sam'); assert.equal(a.settle(newer.token, 'win').ok, true);
  assert.deepEqual(a.getState().ordinary.won.sort(), ['jack', 'sam']);
});

test('unknown IDs and early secret probes do not reveal hidden identity or chapter outcomes', () => {
  const model = createIslandChallenge({ storage: memoryStorage() });
  for (const id of [null, undefined, 1, true, {}, [], '', '__proto__', 'constructor', 'resident:jack', 'unknown', 'hidden-visitor']) {
    for (const result of [model.canChallenge(id), model.prepare(id), model.begin(id)]) {
      assert.equal(result.ok, false); assert.doesNotMatch(JSON.stringify(result), /魚酥姐|hidden-visitor|assets\/hidden/);
    }
  }
  assert.equal(model.openInvitation().ok, false);
  const state = model.getState(); assertHidden(state); assert.ok(state.chapters.every(chapter => !Object.hasOwn(chapter, 'completion'))); assert.equal(state.completion, null);
});

test('reload resumes only completed challenge wins, and stale pre-reload callbacks cannot credit a new model', () => {
  const storage = memoryStorage(legacy), before = createIslandChallenge({ storage });
  finish(before, 'jack'); finish(before, 'helen'); const pending = before.begin('sam');
  const after = createIslandChallenge({ storage }); assert.deepEqual(after.getState().wins.sort(), ['helen', 'jack']); assert.equal(after.getState().active, null);
  assert.equal(after.settle(pending.token, 'win').ok, false); assert.ok(!after.getState().wins.includes('sam'));
  assert.equal(after.getState().next.opponentId, 'sam');
  throughBosses(after); after.openInvitation(); const again = createIslandChallenge({ storage });
  assert.equal(again.getState().hidden.name, '魚酥姐'); assert.equal(again.getState().next.opponentId, 'hidden-visitor');
  finish(again, 'hidden-visitor'); assert.equal(createIslandChallenge({ storage }).getState().completed, true);
});

test('append-only receipts recover all wins after concurrent tabs overwrite a stale aggregate', () => {
  const storage = memoryStorage(), a = createIslandChallenge({ storage }), b = createIslandChallenge({ storage });
  const first = a.begin('jack'), second = b.begin('helen');
  a.settle(first.token, 'win'); b.settle(second.token, 'win');
  assert.deepEqual(a.sync().wins.sort(), ['helen', 'jack']); assert.deepEqual(b.sync().wins.sort(), ['helen', 'jack']);
  // Reproduce the worst final read-modify-write interleaving: the last index is
  // stale and only mentions one tab's win, while each receipt was atomic.
  storage.entries.set(CHALLENGE_STORAGE_KEY, JSON.stringify({ version: 1, wins: ['helen'], invitationOpened: false }));
  const recovered = createIslandChallenge({ storage }); assert.deepEqual(recovered.getState().wins.sort(), ['helen', 'jack']);
  finish(recovered, 'sam'); storage.entries.set(CHALLENGE_STORAGE_KEY, JSON.stringify({ version: 1, wins: [], invitationOpened: false }));
  assert.deepEqual(a.sync().wins.sort(), ['helen', 'jack', 'sam']);
  throughBosses(recovered); recovered.openInvitation();
  storage.entries.set(CHALLENGE_STORAGE_KEY, JSON.stringify({ version: 1, wins: [], invitationOpened: false }));
  const invitation = createIslandChallenge({ storage }); assert.equal(invitation.getState().invitation.opened, true); assert.equal(invitation.getState().hidden.name, '魚酥姐');
});

test('corrupt records are bounded and cannot skip ordinary, executive or invitation prerequisites', () => {
  const key = CHALLENGE_STORAGE_KEY;
  for (const raw of ['', '{', 'null', '[]', 'false', '1', JSON.stringify({ version: 2, wins: ordinary }), JSON.stringify({ version: 1, wins: 'jack' }), 'x'.repeat(12001)]) {
    const model = createIslandChallenge({ storage: memoryStorage({ [key]: raw }) }); assert.equal(model.getState().wins.length, 0); assertHidden(model.getState());
  }
  for (const wins of [['wing'], ['rick'], ['spencer'], ['hidden-visitor'], [...ordinary.slice(1), ...bosses, 'hidden-visitor'], [...ordinary, 'spencer', 'wing', 'hidden-visitor']]) {
    const storage = memoryStorage({ [key]: JSON.stringify({ version: 1, wins, invitationOpened: true }) });
    const state = createIslandChallenge({ storage }).getState();
    assert.ok(!state.wins.includes('wing')); assert.ok(!state.wins.includes('hidden-visitor')); assert.equal(state.invitation.opened, false); assertHidden(state);
  }
  const storage = memoryStorage({ [key]: '{"version":1,"wins":["jack","jack","__proto__","unknown"],"invitationOpened":true,"token":"bad","__proto__":{"polluted":true}}',
    [`${key}:win:helen`]: '{"version":1,"opponentId":"helen","won":"true"}', [`${key}:invitation`]: '{"version":1,"opened":true}' });
  assert.deepEqual(createIslandChallenge({ storage }).getState().wins, ['jack']); assert.equal(Object.prototype.polluted, undefined);
});

test('snapshots are detached and denied storage still permits a complete session without touching legacy records', () => {
  const failure = () => { throw new Error('denied'); };
  for (const storage of [undefined, null, {}, { getItem: failure, setItem: failure }, new Proxy({}, { get: failure })]) {
    const model = createIslandChallenge({ storage });
    assert.equal(model.getState().storageAvailable, false); assert.doesNotThrow(() => throughBosses(model));
    assert.equal(model.openInvitation().ok, true); const result = finish(model, 'hidden-visitor');
    assert.equal(result.storageAvailable, false); assert.equal(result.state.completed, true);
  }
  const model = createIslandChallenge({ storage: memoryStorage() }); const first = finish(model, 'jack');
  first.state.wins.push('wing'); first.state.ordinary.won.push('wing'); first.state.chapters[0].opponentIds.length = 0;
  first.state.currentStory.body = 'overwritten'; first.state.lastResult.story.body = 'overwritten'; first.state.lastResult.chapterCompleted.push('bad');
  const next = model.getState(); assert.deepEqual(next.wins, ['jack']); assert.equal(next.chapters[0].opponentIds.length, 8); assert.notEqual(next.currentStory.body, 'overwritten'); assert.notEqual(next.lastResult.story.body, 'overwritten'); assert.deepEqual(next.lastResult.chapterCompleted, []);
});
