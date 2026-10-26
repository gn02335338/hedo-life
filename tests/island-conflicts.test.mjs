import test from 'node:test';
import assert from 'node:assert/strict';
import { createIslandConflicts, FIGHT_STYLES, CONFLICT_PLACES } from '../dist/island/conflicts.js';
import { ISLAND_CAST } from '../dist/island/cast.js';

test('each public colleague can participate and both fight outcomes send each side to the opposite facility', () => {
  for (const { id } of ISLAND_CAST) for (const [random, outcome, playerStatus, npcStatus] of [
    [() => 0, 'win', 'police', 'hospital'], [() => .999, 'lose', 'hospital', 'police'],
  ]) for (const { id: style } of FIGHT_STYLES) {
    const session = createIslandConflicts({ random }), result = session.fight(id, style);
    assert.equal(result.ok, true); assert.equal(result.kind, 'fight'); assert.equal(result.outcome, outcome);
    assert.equal(result.player.status, playerStatus); assert.equal(result.people[0].id, id); assert.equal(result.people[0].status, npcStatus);
    assert.equal(result.player.placeId, CONFLICT_PLACES[playerStatus].placeId);
    assert.equal(result.people[0].placeId, CONFLICT_PLACES[npcStatus].placeId);
    assert.match(result.description, /移動醫院/); assert.match(result.description, /島上警局/);
    assert.equal(session.getState().history.length, 1);
  }
});

test('only the two bosses can exile the player, with gate duty and cold palace both reachable', () => {
  for (const id of ['wing', 'spencer']) for (const [roll, placeId] of [[.1, 'exile-gate'], [.4, 'cold-palace']]) {
    const session = createIslandConflicts({ random: () => roll }), result = session.argue(id);
    assert.equal(result.outcome, 'exiled'); assert.deepEqual(result.player, { status: 'exile', districtId: 'exile', placeId });
    assert.match(result.description, /流放島/);
  }
  for (const { id } of ISLAND_CAST) {
    const session = createIslandConflicts({ random: () => .9 });
    assert.equal(session.argue(id).outcome, 'standoff'); assert.equal(session.getState().player.status, 'free');
    if (!['wing', 'spencer'].includes(id)) {
      const calm = createIslandConflicts({ random: () => 0 });
      assert.equal(calm.argue(id).outcome, 'cooled'); assert.equal(calm.getState().player.status, 'free');
    }
  }
});

test('recovery requires the correct facility, frees only its participant, and restores ordinary interactions', () => {
  const session = createIslandConflicts({ random: () => 0 });
  session.fight('jack');
  const held = session.getState();
  assert.equal(session.recoverPlayer('hospital-er').code, 'wrong-place'); assert.deepEqual(session.getState(), held);
  assert.equal(session.releasePerson('jack', 'police-desk').code, 'wrong-place'); assert.deepEqual(session.getState(), held);
  assert.equal(session.recoverPlayer('police-desk').ok, true);
  assert.equal(session.getState().player.status, 'free'); assert.equal(session.getState().people.length, 1);
  assert.equal(session.argue('jack').code, 'person-unavailable');
  assert.equal(session.releasePerson('jack', 'hospital-er').ok, true);
  assert.deepEqual(session.getState().people, []); assert.equal(session.argue('jack').ok, true);
  assert.equal(session.releasePerson('jack', 'hospital-er').code, 'already-free');
  assert.equal(session.recoverPlayer('police-desk').code, 'already-free');
  for (const roll of [.1, .4]) for (const placeId of ['exile-gate', 'cold-palace']) {
    const exile = createIslandConflicts({ random: () => roll }); exile.argue('wing');
    assert.equal(exile.recoverPlayer(placeId).ok, true); assert.equal(exile.getState().player.status, 'free');
  }
});

test('detention and unrecognised inputs cannot draw or mutate a result', () => {
  let draws = 0;
  const session = createIslandConflicts({ random: () => { draws++; return 0; } });
  for (const id of ['not-a-person', '', null, {}, 'resident:jack', '__proto__']) {
    assert.equal(session.fight(id).code, 'unknown-person'); assert.equal(session.argue(id).code, 'unknown-person');
  }
  assert.equal(session.fight('jack', 'unknown-style').code, 'invalid-style'); assert.equal(draws, 0);
  session.fight('jack'); const held = session.getState();
  for (const id of ['jack', 'wing', 'spencer']) {
    assert.equal(session.fight(id).code, 'player-unavailable'); assert.equal(session.argue(id).code, 'player-unavailable');
  }
  assert.equal(draws, 1); assert.deepEqual(session.getState(), held);
  session.recoverPlayer('police-desk');
  assert.equal(session.fight('jack').code, 'person-unavailable'); assert.equal(draws, 1);
});

test('invalid random providers fail without creating consequences or partial history', () => {
  for (const random of [() => NaN, () => Infinity, () => -1, () => 1, () => '0', () => { throw new Error('no draw'); }, null]) {
    const session = createIslandConflicts({ random }), initial = session.getState();
    assert.equal(session.argue('wing').code, 'invalid-random'); assert.deepEqual(session.getState(), initial);
    assert.equal(session.fight('jack').code, 'invalid-random'); assert.deepEqual(session.getState(), initial);
  }
});

test('snapshots and action receipts are detached and island history is bounded independently of career data', () => {
  const session = createIslandConflicts({ random: () => 0 });
  const result = session.fight('jack');
  result.player.status = 'free'; result.people[0].id = 'wing'; result.person.status = 'free';
  const snapshot = session.getState(); snapshot.player.placeId = 'wrong'; snapshot.people.length = 0; snapshot.history[0].player.status = 'free';
  const actual = session.getState();
  assert.equal(actual.player.status, 'police'); assert.equal(actual.player.placeId, 'police-desk');
  assert.equal(actual.people[0].id, 'jack'); assert.equal(actual.history[0].player.status, 'police');
  session.recoverPlayer('police-desk'); session.releasePerson('jack', 'hospital-er');
  for (let index = 0; index < 20; index++) session.argue('jack');
  const final = session.getState();
  assert.equal(final.history.length, 12); assert.equal(final.history.at(-1).turn, 23); assert.equal(final.history[0].turn, 12);
  assert.deepEqual(Object.keys(final).sort(), ['history', 'people', 'player']);
  assert.deepEqual(createIslandConflicts().getState(), { player: { status: 'free', placeId: null, districtId: null }, people: [], history: [] });
});
