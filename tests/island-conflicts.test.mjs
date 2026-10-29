import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createIslandConflicts, CONFLICT_PLACES } from '../dist/island/conflicts.js';
import { ISLAND_CAST } from '../dist/island/cast.js';

function finishFight(session, id, outcome = 'win', summary) {
  const start = session.beginFight(id); assert.equal(start.ok, true);
  return session.settleFight(start.token, outcome, summary);
}

test('every colleague retains the played winner while independent aftermath draws decide destinations', () => {
  for (const { id } of ISLAND_CAST) for (const [outcome, playerStatus, npcStatus] of [['win', 'police', 'hospital'], ['lose', 'hospital', 'police']]) {
    let draws = 0;
    const session = createIslandConflicts({ random: () => { draws++; return 0; } });
    assert.equal(session.fight, undefined, 'the old random fight API is absent');
    const start = session.beginFight(id), before = session.getState();
    assert.equal(before.player.status, 'free'); assert.deepEqual(before.people, []); assert.deepEqual(before.history, []);
    assert.deepEqual(before.activeFight, { token: start.token, opponentId: id });
    const result = session.settleFight(start.token, outcome, { duration: 32.5, maxCombo: 3, damageDealt: 90, damageTaken: 45, specialsUsed: 1, reason: 'knockout' });
    assert.equal(result.ok, true); assert.equal(result.kind, 'fight'); assert.equal(result.outcome, outcome);
    assert.equal(result.player.status, playerStatus); assert.equal(result.people[0].id, id); assert.equal(result.people[0].status, npcStatus);
    assert.equal(result.player.placeId, CONFLICT_PLACES[playerStatus].placeId); assert.equal(result.people[0].placeId, CONFLICT_PLACES[npcStatus].placeId);
    assert.match(result.description, /移動醫院/); assert.match(result.description, /島上警局/);
    assert.equal(result.summary.reason, 'knockout'); assert.equal(session.getState().history.length, 1); assert.equal(session.getState().activeFight, null); assert.equal(draws, 2);
  }
});

test('one reservation blocks conflicting actions and cancellation has no consequences', () => {
  let draws = 0; const session = createIslandConflicts({ random: () => { draws++; return 0; } });
  for (const id of ['not-a-person', '', null, {}, 'resident:jack', '__proto__']) {
    assert.equal(session.beginFight(id).code, 'unknown-person'); assert.equal(session.argue(id).code, 'unknown-person');
  }
  const start = session.beginFight('jack'), active = session.getState();
  assert.equal(session.beginFight('wing').code, 'fight-active'); assert.equal(session.argue('wing').code, 'fight-active');
  assert.deepEqual(session.getState(), active); assert.equal(draws, 0);
  assert.equal(session.cancelFight('wrong-token').code, 'invalid-fight-token'); assert.deepEqual(session.getState(), active);
  assert.equal(session.cancelFight(start.token).ok, true);
  assert.deepEqual(session.getState(), { player: { status: 'free', placeId: null, districtId: null }, people: [], history: [], activeFight: null, duelInvitations: [], companyIssues: [] });
  assert.equal(draws, 0); assert.equal(session.argue('wing').outcome, 'exiled'); assert.equal(draws, 1);
});

test('old, foreign, cancelled and duplicate callbacks cannot affect a current match', () => {
  const session = createIslandConflicts({ random: () => 0 }), other = createIslandConflicts({ random: () => 0 });
  const first = session.beginFight('jack'), foreign = other.beginFight('jack');
  assert.notEqual(first.token, foreign.token); assert.equal(session.settleFight(foreign.token, 'win').code, 'invalid-fight-token');
  session.cancelFight(first.token);
  const second = session.beginFight('wing'), pending = session.getState(); assert.notEqual(first.token, second.token);
  assert.equal(session.settleFight(first.token, 'lose').code, 'invalid-fight-token'); assert.equal(session.cancelFight(first.token).code, 'invalid-fight-token');
  assert.deepEqual(session.getState(), pending); assert.equal(session.settleFight(second.token, 'win').ok, true);
  const settled = session.getState();
  assert.equal(session.settleFight(second.token, 'lose').code, 'invalid-fight-token'); assert.equal(session.cancelFight(second.token).code, 'invalid-fight-token');
  assert.deepEqual(session.getState(), settled); assert.equal(settled.history.length, 1); assert.equal(settled.people[0].id, 'wing');
});

test('invalid outcomes and summaries are atomic while scores are bounded and plain data', () => {
  const session = createIslandConflicts({ random: () => 0 }), start = session.beginFight('jack'), pending = session.getState();
  for (const outcome of ['victory', '', true, null, {}, 0]) {
    assert.equal(session.settleFight(start.token, outcome).code, 'invalid-fight-outcome'); assert.deepEqual(session.getState(), pending);
  }
  const throwing = Object.defineProperty({}, 'duration', { get() { throw new Error('bad getter'); } });
  for (const summary of [null, [], false, 'score', new Date(), { duration: NaN }, { damageTaken: Infinity }, { maxCombo: '3' }, { specialsUsed: {} }, { reason: 'javascript:<script>' }, throwing]) {
    assert.equal(session.settleFight(start.token, 'win', summary).code, 'invalid-fight-summary'); assert.deepEqual(session.getState(), pending);
  }
  const crossRealm = vm.runInNewContext('({duration:100000,maxCombo:1000000,damageDealt:1000000,damageTaken:-22,specialsUsed:7.9,reason:"ko",rawTranscript:"never store",position:{x:4,z:3}})');
  const result = session.settleFight(start.token, 'win', crossRealm); assert.equal(result.ok, true);
  assert.deepEqual(result.summary, { duration: 600, maxCombo: 999, damageDealt: 99999, damageTaken: 0, specialsUsed: 7, reason: 'knockout' });
  assert.deepEqual(Object.keys(result.summary).sort(), ['damageDealt', 'damageTaken', 'duration', 'maxCombo', 'reason', 'specialsUsed']);
  assert.equal(Object.hasOwn(session.getState().history[0].summary, 'rawTranscript'), false);
});

test('draws preserve other holds and terminal copy describes timeout or forfeit', () => {
  const session = createIslandConflicts({ random: () => 0 }); finishFight(session, 'jack'); session.recoverPlayer('police-desk'); const people = session.getState().people;
  const draw = finishFight(session, 'wing', 'draw', { reason: 'timeout' });
  assert.equal(draw.outcome, 'draw'); assert.equal(draw.player.status, 'free'); assert.equal(draw.person, null); assert.deepEqual(draw.people, people);
  assert.equal(draw.summary.reason, 'timeout'); assert.match(draw.description, /沒有分出勝負/); assert.equal(session.getState().activeFight, null);
  const timeout = finishFight(createIslandConflicts({ random: () => 0 }), 'kind', 'win', { reason: 'timeout', duration: 75 });
  assert.match(timeout.description, /鈴聲/); assert.equal(timeout.player.status, 'police');
  const forfeit = finishFight(createIslandConflicts({ random: () => 0 }), 'wing', 'lose', { reason: 'forfeit' });
  assert.match(forfeit.description, /認輸/); assert.equal(forfeit.player.status, 'hospital');
});

test('boss arguments retain their existing RNG and both exile facilities remain valid', () => {
  for (const id of ['wing', 'spencer']) for (const [roll, placeId] of [[.1, 'exile-gate'], [.4, 'cold-palace']]) {
    const session = createIslandConflicts({ random: () => roll }), result = session.argue(id);
    assert.equal(result.outcome, 'exiled'); assert.deepEqual(result.player, { status: 'exile', districtId: 'exile', placeId }); assert.match(result.description, /流放島/);
  }
  for (const { id } of ISLAND_CAST) {
    const session = createIslandConflicts({ random: () => .9 }); assert.equal(session.argue(id).outcome, 'standoff'); assert.equal(session.getState().player.status, 'free');
    if (!['wing', 'spencer'].includes(id)) assert.equal(createIslandConflicts({ random: () => 0 }).argue(id).outcome, 'cooled');
  }
  for (const roll of [.1, .4]) for (const placeId of ['exile-gate', 'cold-palace']) {
    const exile = createIslandConflicts({ random: () => roll }); exile.argue('wing'); assert.equal(exile.recoverPlayer(placeId).ok, true);
  }
});

test('facility recovery is independent and held participants cannot begin another match', () => {
  const session = createIslandConflicts({ random: () => 0 }); finishFight(session, 'jack'); const held = session.getState();
  assert.equal(session.recoverPlayer('hospital-er').code, 'wrong-place'); assert.equal(session.releasePerson('jack', 'police-desk').code, 'wrong-place'); assert.deepEqual(session.getState(), held);
  for (const id of ['jack', 'wing', 'spencer']) { assert.equal(session.beginFight(id).code, 'player-unavailable'); assert.equal(session.argue(id).code, 'player-unavailable'); }
  assert.deepEqual(session.getState(), held); assert.equal(session.recoverPlayer('police-desk').ok, true); assert.equal(session.getState().people.length, 1);
  assert.equal(session.argue('jack').code, 'person-unavailable'); assert.equal(session.beginFight('jack').code, 'person-unavailable');
  assert.equal(session.releasePerson('jack', 'hospital-er').ok, true); assert.deepEqual(session.getState().people, []); assert.equal(session.argue('jack').ok, true);
  assert.equal(session.releasePerson('jack', 'hospital-er').code, 'already-free'); assert.equal(session.recoverPlayer('police-desk').code, 'already-free');
});

test('a broken random source cannot reroll or prevent an actual brawl result', () => {
  for (const random of [() => NaN, () => Infinity, () => -1, () => 1, () => '0', () => { throw new Error('no draw'); }, null]) {
    const session = createIslandConflicts({ random }), initial = session.getState();
    assert.equal(session.argue('wing').code, 'invalid-random'); assert.deepEqual(session.getState(), initial);
    const result = finishFight(session, 'jack', 'lose'); assert.equal(result.outcome, 'lose'); assert.equal(result.player.status, 'hospital');
  }
});

test('reservations, receipts and bounded history are detached from caller mutations', () => {
  const session = createIslandConflicts({ random: () => 0 }), start = session.beginFight('jack');
  const active = session.getState(); active.activeFight.opponentId = 'wing'; active.activeFight.token = 'wrong';
  const result = session.settleFight(start.token, 'win', { maxCombo: 8 });
  result.player.status = 'free'; result.people[0].id = 'wing'; result.person.status = 'free'; result.summary.maxCombo = 1;
  const snapshot = session.getState(); snapshot.player.placeId = 'wrong'; snapshot.people.length = 0; snapshot.history[0].player.status = 'free'; snapshot.history[0].summary.maxCombo = 2;
  const actual = session.getState(); assert.equal(actual.player.status, 'police'); assert.equal(actual.player.placeId, 'police-desk');
  assert.equal(actual.people[0].id, 'jack'); assert.equal(actual.history[0].player.status, 'police'); assert.equal(actual.history[0].summary.maxCombo, 8);
  session.recoverPlayer('police-desk'); session.releasePerson('jack', 'hospital-er');
  for (let index = 0; index < 20; index++) session.argue('jack');
  const final = session.getState(); assert.equal(final.history.length, 12); assert.equal(final.history.at(-1).turn, 23); assert.equal(final.history[0].turn, 12);
  assert.deepEqual(Object.keys(final).sort(), ['activeFight', 'companyIssues', 'duelInvitations', 'history', 'people', 'player']);
  assert.deepEqual(createIslandConflicts({ random: () => 0 }).getState(), { player: { status: 'free', placeId: null, districtId: null }, people: [], history: [], activeFight: null, duelInvitations: [], companyIssues: [] });
});


test('duel refusals commit once without starting combat, moving people or repeatedly drawing', () => {
  let draws = 0;
  const session = createIslandConflicts({ random: () => { draws++; return .99; } });
  const refusal = session.requestDuel('wing');
  assert.equal(refusal.ok, true); assert.equal(refusal.outcome, 'refused'); assert.match(refusal.description, /拒絕|簽核/);
  assert.equal(session.getState().activeFight, null); assert.equal(session.getState().player.status, 'free');
  assert.deepEqual(session.getState().people, []); assert.deepEqual(session.getState().companyIssues, []);
  const snapshot = session.getState();
  assert.equal(session.requestDuel('wing').code, 'duel-already-answered');
  assert.deepEqual(session.getState(), snapshot); assert.equal(draws, 1);
  assert.equal(session.beginFight('wing', { duel: true }).code, 'duel-not-accepted');
  assert.equal(session.getState().history.length, 1);
});

test('accepted duels resume the same reply after pre-start cancellation and finish only once', () => {
  let draws = 0;
  const session = createIslandConflicts({ random: () => { draws++; return 0; } });
  const accepted = session.requestDuel('jack');
  assert.equal(accepted.outcome, 'accepted'); assert.ok(accepted.token); assert.match(accepted.description, /走位與出招/);
  assert.equal(session.getState().history.length, 1); assert.equal(draws, 1);
  assert.equal(session.requestDuel('wing').code, 'fight-active'); assert.equal(draws, 1);
  session.cancelFight(accepted.token);
  const resumed = session.requestDuel('jack');
  assert.equal(resumed.outcome, 'accepted'); assert.notEqual(resumed.token, accepted.token);
  assert.equal(draws, 1); assert.equal(session.getState().history.length, 1);
  const result = session.settleFight(resumed.token, 'win');
  assert.equal(result.outcome, 'win'); assert.equal(draws, 3);
  assert.equal(session.getState().duelInvitations[0].outcome, 'completed');
  const completed = session.getState();
  assert.equal(session.settleFight(resumed.token, 'lose').code, 'invalid-fight-token'); assert.equal(draws, 3);
  assert.deepEqual(session.getState(), completed);
  session.recoverPlayer('police-desk'); session.releasePerson('jack', 'hospital-er');
  assert.equal(session.requestDuel('jack').code, 'duel-already-answered'); assert.equal(draws, 3);
});

test('acceptance rates differ by character and the boundary itself refuses', () => {
  for (const [id, threshold] of [['wing', .4], ['hope', .35], ['owen', .8], ['jack', .6]]) {
    assert.equal(createIslandConflicts({ random: () => threshold - .000001 }).requestDuel(id).outcome, 'accepted');
    assert.equal(createIslandConflicts({ random: () => threshold }).requestDuel(id).outcome, 'refused');
  }
});

test('aftercare is probabilistic, independent and less severe for consensual timeout or forfeit', () => {
  for (const outcome of ['win', 'lose']) for (const [playerRoll, personRoll, playerHeld, personHeld] of [[0, 0, true, true], [.99, .99, false, false], [0, .99, true, false], [.99, 0, false, true]]) {
    const samples = [0, playerRoll, personRoll], session = createIslandConflicts({ random: () => samples.shift() });
    const start = session.requestDuel('jack'), result = session.settleFight(start.token, outcome);
    assert.equal(result.outcome, outcome);
    assert.equal(result.player.status !== 'free', playerHeld);
    assert.equal(result.people.length > 0, personHeld);
    if (playerHeld) assert.equal(result.player.status, outcome === 'win' ? 'police' : 'hospital');
    if (personHeld) assert.equal(result.people[0].status, outcome === 'win' ? 'hospital' : 'police');
    assert.equal(samples.length, 0);
  }
  for (const [outcome, threshold] of [['win', .55], ['lose', .75]]) {
    for (const [reason, reduction] of [['knockout', 0], ['timeout', .15], ['forfeit', .35]]) {
      const samples = [0, threshold - reduction, .99], session = createIslandConflicts({ random: () => samples.shift() });
      const start = session.requestDuel('jack'), result = session.settleFight(start.token, outcome, { reason });
      assert.equal(result.player.status, 'free', `${outcome}/${reason} uses an exclusive boundary`);
    }
  }
});

test('company interruptions derive from the absent responsible person and release restores only that window', () => {
  const samples = [0, .99, 0, 0, .99, 0], session = createIslandConflicts({ random: () => samples.shift() });
  let start = session.requestDuel('wing'); session.settleFight(start.token, 'win');
  assert.equal(session.getState().player.status, 'free');
  const first = session.getState().companyIssues;
  assert.equal(first[0].id, 'executive-approval'); assert.deepEqual(first[0].placeIds, ['general-manager-office']);
  assert.equal(first[0].recoveryPlaceId, 'hospital-er'); assert.equal(first[0].participantId, 'wing');
  first[0].placeIds.length = 0; assert.equal(session.getState().companyIssues[0].placeIds.length, 1, 'snapshots do not mutate company rules');
  start = session.requestDuel('janet'); session.settleFight(start.token, 'lose');
  const both = session.getState().companyIssues;
  assert.deepEqual(both.map(item => item.id), ['executive-approval', 'cashflow']);
  assert.equal(both[1].status, 'police');
  assert.equal(session.releasePerson('wing', 'police-desk').code, 'wrong-place');
  assert.equal(session.getState().companyIssues.length, 2);
  const restored = session.releasePerson('wing', 'hospital-er'); assert.match(restored.description, /窗口已恢復/);
  assert.deepEqual(session.getState().companyIssues.map(item => item.id), ['cashflow']);
  session.releasePerson('janet', 'police-desk'); assert.deepEqual(session.getState().companyIssues, []);
});
