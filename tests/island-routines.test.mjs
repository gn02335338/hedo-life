import test from 'node:test';
import assert from 'node:assert/strict';
import { ISLAND_CAST } from '../dist/island/cast.js';
import { PLACE_BY_ID } from '../dist/island/places.js';
import { getPersonRoutine, getIslandRoutine, MYSTERY_TRIP } from '../dist/island/routines.js';

test('every public colleague works at the authored department rather than a former scenic home', () => {
  for (const person of ISLAND_CAST) for (const hour of [9, 10, 11.75, 13.25, 14.5, 16.25, 17.99]) {
    const routine = getPersonRoutine(person.id, hour);
    assert.equal(routine.phase, 'work');
    assert.equal(routine.placeId, person.workplaceId);
    assert.equal(routine.districtId, PLACE_BY_ID.get(person.workplaceId).districtId);
  }
  assert.equal(getPersonRoutine('kind', 10).districtId, 'lab');
  assert.equal(getPersonRoutine('sonny', 10).placeId, 'mis-service');
  assert.equal(getPersonRoutine('unknown', 10), null);
});

test('each colleague takes a45minute lunch and tea break then returns to work', () => {
  const lunchStarts = new Set(), teaStarts = new Set();
  for (const { id, workplaceId } of ISLAND_CAST) {
    const lunch = [], tea = [];
    for (let minute = 12 * 60; minute < 13 * 60 + 15; minute++) if (getPersonRoutine(id, minute / 60).phase === 'break') lunch.push(minute);
    for (let minute = 15 * 60; minute < 16 * 60 + 15; minute++) if (getPersonRoutine(id, minute / 60).phase === 'break') tea.push(minute);
    assert.equal(lunch.length, 45, id); assert.equal(tea.length, 45, id);
    for (const sequence of [lunch, tea]) {
      assert.equal(sequence.at(-1) - sequence[0], sequence.length - 1);
      for (const minute of sequence) {
        const routine = getPersonRoutine(id, minute / 60);
        assert.equal(routine.placeId, 'pantry'); assert.equal(routine.districtId, 'cafe');
      }
      assert.equal(getPersonRoutine(id, (sequence.at(-1) + 1) / 60).placeId, workplaceId);
    }
    lunchStarts.add(lunch[0]); teaStarts.add(tea[0]);
  }
  assert.equal(lunchStarts.size, 3); assert.equal(teaStarts.size, 3);
});

test('afterwork preferences are stable and spread across the court and izakaya', () => {
  const destinations = new Set();
  for (const { id } of ISLAND_CAST) {
    const at18 = getPersonRoutine(id, 18), at21 = getPersonRoutine(id, 21);
    assert.deepEqual(at18, at21); assert.equal(at18.phase, 'afterwork');
    assert.ok(['basketball-court', 'izakaya'].includes(at18.placeId)); destinations.add(at18.placeId);
  }
  assert.equal(destinations.size, 2);
  assert.equal(getPersonRoutine('sonny', 18).placeId, 'basketball-court');
  assert.equal(getPersonRoutine('kind', 18).placeId, 'izakaya');
});

test('Aliang invites a known group for a bounded gathering and stroll, then they resume their evenings', () => {
  assert.equal(MYSTERY_TRIP.hostId, 'kind');
  assert.equal(new Set(MYSTERY_TRIP.participantIds).size, MYSTERY_TRIP.participantIds.length);
  assert.ok(MYSTERY_TRIP.participantIds.includes(MYSTERY_TRIP.hostId));
  for (const { id } of ISLAND_CAST) for (const [hour, stage] of [[19, 'gathering'], [19.499, 'gathering'], [19.5, 'stroll'], [19.99, 'stroll']]) {
    const routine = getPersonRoutine(id, hour), member = MYSTERY_TRIP.participantIds.includes(id);
    assert.equal(routine.phase, member ? 'mystery' : 'afterwork');
    if (member) {
      assert.equal(routine.placeId, MYSTERY_TRIP.placeId); assert.equal(routine.districtId, 'harbor'); assert.equal(routine.tripStage, stage);
    }
  }
  for (const id of MYSTERY_TRIP.participantIds) {
    assert.ok(ISLAND_CAST.some(person => person.id === id));
    assert.equal(getPersonRoutine(id, 18.99).phase, 'afterwork');
    assert.equal(getPersonRoutine(id, 20).phase, 'afterwork');
  }
  assert.equal(getIslandRoutine(19).trip.stage, 'gathering');
  assert.equal(getIslandRoutine(19.5).trip.stage, 'stroll');
  assert.equal(getIslandRoutine(20).trip, null);
});

test('schedule lookups are deterministic, immutable and always point to existing places', () => {
  for (const { id } of ISLAND_CAST) for (let hour = 0; hour < 24; hour += .25) {
    const routine = getPersonRoutine(id, hour);
    assert.deepEqual(routine, getPersonRoutine(id, hour + 24));
    assert.equal(PLACE_BY_ID.get(routine.placeId).districtId, routine.districtId);
    assert.ok(Object.isFrozen(routine));
    assert.ok(routine.activity.trim().length && routine.label.trim().length && routine.timeLabel.trim().length);
  }
  for (const hour of [undefined, NaN, Infinity, 'invalid']) assert.deepEqual(getPersonRoutine('wing', hour), getPersonRoutine('wing', 12));
  for (const hour of [6, 9, 12, 13, 15, 16, 18, 19, 19.5, 20, 23]) {
    const overview = getIslandRoutine(hour);
    assert.ok(Object.isFrozen(overview)); assert.ok(overview.title && overview.description);
  }
});

test('trip invitation permits refusal and keeps all three outcomes out of visible choice text', () => {
  const { story } = MYSTERY_TRIP, visible = [MYSTERY_TRIP.invitation, story.title, story.opening, ...story.choices.map(choice => choice.label)].join('\n');
  assert.equal(story.choices.length, 3);
  assert.ok(story.choices.some(choice => choice.label.includes('先不跟')));
  assert.equal(new Set(story.choices.map(choice => choice.response)).size, 3);
  for (const choice of story.choices) {
    assert.ok(choice.label && choice.response); assert.ok(!visible.includes(choice.response)); assert.ok(Object.isFrozen(choice));
  }
  assert.ok(Object.isFrozen(MYSTERY_TRIP)); assert.ok(Object.isFrozen(MYSTERY_TRIP.participantIds));
  assert.ok(Object.isFrozen(story)); assert.ok(Object.isFrozen(story.choices));
});
