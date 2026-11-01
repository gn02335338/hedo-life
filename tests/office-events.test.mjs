import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { OFFICE_EVENT_BUCKET_MS, OFFICE_EVENT_DURATION_MS, OFFICE_EVENT_REGISTRATION_MS, OFFICE_EVENT_PLAY_MS, OFFICE_EVENT_FINISH_MS, OFFICE_GAME_ACTIONS, getOfficeEvent, getOfficeGameActions, createOfficeGame, advanceOfficeGame } from '../dist/office/events.js';

test('UTC activities use irregular starts, rotate kinds and never overlap across buckets', () => {
  const offsets = new Set(), types = new Set(); let previous = null;
  for (let bucket = -12; bucket <= 48; bucket++) {
    const now = bucket * OFFICE_EVENT_BUCKET_MS, event = getOfficeEvent(now);
    assert.deepEqual(event, getOfficeEvent(now));
    assert.equal(event.id, `office-event-v1-${bucket}`);
    assert.equal(event.floor, 1);
    assert.ok(event.startsAt >= now && event.startsAt <= now + 180_000);
    assert.equal(event.playStartsAt - event.startsAt, OFFICE_EVENT_REGISTRATION_MS);
    assert.equal(event.playEndsAt - event.playStartsAt, OFFICE_EVENT_PLAY_MS);
    assert.equal(event.endsAt - event.playEndsAt, OFFICE_EVENT_FINISH_MS);
    assert.equal(event.endsAt - event.startsAt, OFFICE_EVENT_DURATION_MS);
    assert.ok(event.nextStartsAt >= now + OFFICE_EVENT_BUCKET_MS);
    assert.ok(event.nextStartsAt > event.endsAt);
    assert.ok(event.title.length > 3 && event.description.length > 15);
    if (previous) { assert.notEqual(event.type, previous.type); assert.equal(previous.nextStartsAt, event.startsAt); }
    offsets.add(event.startsAt - now); types.add(event.type); previous = event;
  }
  assert.ok(offsets.size > 10, 'Starts do not repeat at one fixed minute');
  assert.deepEqual([...types].sort(), ['arm-wrestling', 'coffee', 'duel']);
});

test('registration, play, finish and the next upcoming event switch at exact time boundaries', () => {
  const event = getOfficeEvent(Date.UTC(2026, 10, 1, 1, 0));
  for (const [time, phase, progress] of [
    [event.startsAt - 1, 'upcoming', 0], [event.startsAt, 'registration', 0], [event.startsAt + 15_000, 'registration', .5],
    [event.playStartsAt, 'playing', 0], [event.playStartsAt + 45_000, 'playing', .5],
    [event.playEndsAt, 'finished', 0], [event.playEndsAt + 15_000, 'finished', .5],
  ]) {
    const sample = getOfficeEvent(time); assert.equal(sample.id, event.id); assert.equal(sample.phase, phase); assert.equal(sample.progress, progress);
  }
  assert.equal(getOfficeEvent(event.endsAt - 1).phase, 'finished');
  const next = getOfficeEvent(event.endsAt);
  assert.notEqual(next.id, event.id); assert.equal(next.phase, 'upcoming'); assert.equal(next.startsAt, event.nextStartsAt); assert.equal(next.progress, 0);
  for (const invalid of [NaN, Infinity, -Infinity, null, '123']) assert.deepEqual(getOfficeEvent(invalid), getOfficeEvent(0));
});

function eventOf(type) { for (let bucket = 0; bucket < 3; bucket++) { const event = getOfficeEvent(bucket * OFFICE_EVENT_BUCKET_MS); if (event.type === type) return event; } }

test('each local game completes in at most eight deliberate rounds with reproducible opponent moves and results', () => {
  for (const type of ['duel', 'arm-wrestling', 'coffee']) {
    const event = eventOf(type), initial = createOfficeGame(event, 'jack');
    assert.deepEqual(initial, createOfficeGame(event, 'jack'));
    assert.equal(initial.round, 0); assert.equal(initial.status, 'playing'); assert.equal(initial.winner, null);
    const choices = getOfficeGameActions(initial); assert.equal(choices.length, 3);
    let first = initial, second = structuredClone(initial);
    for (let round = 0; round < initial.maxRounds; round++) {
      const before = structuredClone(first), action = choices[round % choices.length].id;
      const next = advanceOfficeGame(first, action); second = advanceOfficeGame(second, action);
      assert.deepEqual(first, before, 'A turn never mutates the old state');
      assert.deepEqual(next, second);
      assert.equal(next.round, round + 1); assert.equal(next.history.length, next.round);
      assert.equal(next.lastRound.playerPoints + next.lastRound.opponentPoints, 2);
      assert.equal(next.playerScore + next.opponentScore, 2 * next.round);
      assert.ok(choices.some(option => option.id === next.lastRound.opponentAction));
      assert.equal(next.winner, next.round === next.maxRounds ? next.playerScore === next.opponentScore ? 'draw' : next.playerScore > next.opponentScore ? 'player' : 'opponent' : null);
      first = next;
    }
    assert.ok(first.round <= 8); assert.equal(first.status, 'finished');
    assert.deepEqual(advanceOfficeGame(first, choices[0].id), first, 'Finished rounds cannot be replayed for more points');
    const altered = advanceOfficeGame(first, choices[0].id); altered.history[0].text = 'changed'; assert.notEqual(first.history[0].text, 'changed');
  }
});

test('player tactics change scores and arm wrestling preserves bounded energy for later turns', () => {
  const duel = createOfficeGame(eventOf('duel'), 'hope');
  const alternatives = getOfficeGameActions('duel').map(option => advanceOfficeGame(duel, option.id));
  assert.equal(new Set(alternatives.map(game => game.playerScore)).size, 3);
  assert.equal(new Set(alternatives.map(game => game.lastRound.opponentAction)).size, 1, 'A chosen action does not reroll the opponent');
  let arm = createOfficeGame(eventOf('arm-wrestling'), 'cindy');
  arm = advanceOfficeGame(arm, 'charge'); assert.equal(arm.playerEnergy, 4);
  arm = advanceOfficeGame(arm, 'charge'); assert.equal(arm.playerEnergy, 6);
  arm = advanceOfficeGame(arm, 'charge'); assert.equal(arm.playerEnergy, 6);
  arm = advanceOfficeGame(arm, 'power'); assert.equal(arm.playerEnergy, 4);
  arm = advanceOfficeGame(arm, 'power'); assert.equal(arm.playerEnergy, 2);
  arm = advanceOfficeGame(arm, 'power'); assert.equal(arm.playerEnergy, 0);
  arm = advanceOfficeGame(arm, 'steady'); assert.equal(arm.playerEnergy, 1);
  arm = advanceOfficeGame(arm, 'power'); assert.equal(arm.playerEnergy, 0); assert.equal(arm.status, 'finished');
});

test('games reject malformed input and contain no network, storage, model calls or career imports', () => {
  for (const type of ['unknown', '__proto__', 'constructor', null, undefined]) assert.deepEqual(getOfficeGameActions(type), []);
  for (const event of [null, {}, { id: 'event', type: 'unknown' }]) assert.throws(() => createOfficeGame(event, 'jack'), TypeError);
  for (const opponent of ['', null, '\n', 'x'.repeat(121)]) assert.throws(() => createOfficeGame(eventOf('duel'), opponent), TypeError);
  const game = createOfficeGame(eventOf('duel'), 'jack');
  for (const invalid of [null, {}, { ...game, round: -1 }, { ...game, round: 9 }, { ...game, history: [{}] }, { ...game, playerEnergy: 20 }, { ...game, playerScore: 99 }]) assert.throws(() => advanceOfficeGame(invalid, 'attack'), TypeError);
  for (const action of ['power', '__proto__', null, {}, '']) assert.throws(() => advanceOfficeGame(game, action), TypeError);
  assert.ok(Object.isFrozen(OFFICE_GAME_ACTIONS.duel));
  const source = readFileSync(new URL('../dist/office/events.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^\s*import\b/m);
  assert.doesNotMatch(source, /\b(?:fetch|localStorage|sessionStorage|Math\.random)\b/);
});
