import test from 'node:test';
import assert from 'node:assert/strict';
import { createNpcLife, NPC_COMMUTE_SPEED } from '../dist/island/npc-life.js';
import { ISLAND_CAST } from '../dist/island/cast.js';
import { LAYOUT, PLACE_ENTRANCES, isTerrainWalkable } from '../dist/island/navigation.js';
import { PLACE_BY_ID } from '../dist/island/places.js';
import { MYSTERY_TRIP } from '../dist/island/routines.js';
import { npcGroundHeight, findNpcRoute, sweptRoute, routeWalkable } from '../dist/island/npc-routing.js';
const fullRoster = () => LAYOUT.flatMap(({ id: districtId }) => [0, 1, 2].map(slot => ({ id: `${districtId}-${slot}`, districtId, slot })));
const gap = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const positions = life => life.getState().map(row => [row.key, row.position]);
function assertSeparated(rows) {
  for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) assert.ok(gap(rows[i].position, rows[j].position) >= .445 - 1e-7, `${rows[i].key} overlaps ${rows[j].key}`);
}
function settle(life, seconds = 240) {
  let previous = life.getState(), frames = 0;
  for (; frames < seconds * 10; frames++) {
    const rows = life.update(.1);
    for (let i = 0; i < rows.length; i++) {
      assert.ok(gap(rows[i].position, previous[i].position) <= NPC_COMMUTE_SPEED * .1 + 1e-8, `${rows[i].key}: teleported`);
      assert.equal(rows[i].position.y, npcGroundHeight(rows[i].position));
    }
    assertSeparated(rows);
    if (frames % 10 === 0) for (const row of rows) assert.ok(isTerrainWalkable(row.position, .21), `${row.key}: off island or inside building`);
    previous = rows;
    if (frames > 10 && !rows.some(row => row.traveling)) break;
  }
  const traveling = life.getState().filter(row => row.traveling);
  assert.equal(traveling.length, 0, `unresolved trips after ${seconds}s: ${traveling.map(row => `${row.id}:${row.districtId}>${row.destinationDistrictId}`).join(',')}`);
  return frames / 10;
}

test('morning colleagues start at their own department and late arrivals do not move established actors', () => {
  const life = createNpcLife({ hour: 10 });
  for (const person of ISLAND_CAST) {
    const actor = life.getState().find(row => row.id === person.id), district = PLACE_BY_ID.get(person.workplaceId).districtId;
    assert.equal(actor.districtId, district); assert.equal(actor.destinationPlaceId, person.workplaceId); assert.equal(actor.traveling, false);
  }
  const before = positions(life); life.setResidents(fullRoster());
  assert.deepEqual(positions(life).filter(([key]) => key.startsWith('person:')), before); assertSeparated(life.getState());
});

test('all 61 actors remain solid while colleagues complete tea, work, after-work and group-trip routes', () => {
  const life = createNpcLife({ hour: 10, residents: fullRoster() });
  for (const hour of [12.6, 13.5, 15.6, 18, 19.25, 19.75, 20.25, 10]) {
    const before = positions(life); life.setHour(hour); assert.deepEqual(positions(life), before, 'changing time retargets without moving bodies');
    const duration = settle(life); assert.ok(duration <= 240);
    for (const row of life.getState()) {
      assert.equal(row.districtId, row.destinationDistrictId, `${row.id}: wrong venue at ${hour}`);
      if (row.kind === 'resident') assert.equal(row.districtId, row.id.split('-')[0], 'approved residents keep their assigned homes');
    }
    if ([12.6, 15.6].includes(hour)) assert.ok(life.getState().filter(row => row.kind === 'person').every(row => row.destinationPlaceId === 'pantry'));
    if (hour === 19.25 || hour === 19.75) for (const id of MYSTERY_TRIP.participantIds) {
      const actor = life.getState().find(row => row.id === id);
      assert.equal(actor.destinationPlaceId, 'aliang-mystery-trip'); assert.equal(actor.routine.tripStage, hour === 19.25 ? 'gathering' : 'stroll');
    }
  }
});

test('time changes respect ongoing conversations, freeze flags and repeated clock ticks', () => {
  for (const flag of ['paused', 'hidden', 'reducedMotion']) {
    const life = createNpcLife({ hour: 10 }), before = positions(life);
    life.setHour(18); for (let i = 0; i < 10; i++) life.update(.1, { [flag]: true });
    assert.deepEqual(positions(life), before, `${flag}: frozen actors must not jump to their evening venue`);
  }
  const life = createNpcLife({ hour: 10 }), before = { ...life.getState().find(row => row.id === 'kind').position };
  life.setConversationTarget({ kind: 'person', id: 'kind' }); life.setHour(19.25);
  for (let i = 0; i < 100; i++) { life.setHour(19.25 + i / 3600); life.update(.1); }
  assert.deepEqual(life.getState().find(row => row.id === 'kind').position, before);
  assert.equal(life.getState().find(row => row.id === 'kind').state, 'talking');
  life.setConversationTarget(null); settle(life);
  assert.equal(life.getState().find(row => row.id === 'kind').districtId, 'harbor');
});

test('rapid clock scrubbing during a crossing releases bridge traffic and retains snapshots safely', () => {
  const life = createNpcLife({ hour: 12.6, residents: fullRoster() }); life.setHour(18);
  for (let i = 0; i < 150; i++) life.update(.1);
  for (const hour of [10, 19.25, 12.6, 18]) { const before = positions(life); life.setHour(hour); assert.deepEqual(positions(life), before); for (let i = 0; i < 10; i++) life.update(.1); }
  settle(life, 300);
  const snapshot = life.getState()[0]; snapshot.position.x = Infinity; snapshot.routine.placeId = 'broken';
  assert.ok(Number.isFinite(life.getState()[0].position.x)); assert.ok(PLACE_ENTRANCES[life.getState()[0].routine.placeId]);
});


test('bridge-corner routes leave continuous clearance instead of trapping a walker between coarse samples', () => {
  const start = { x: -9.113927237628713, z: 4.722140933985567 }, corner = { x: -9.2, z: 5.6 };
  assert.equal(routeWalkable(start), true); assert.equal(routeWalkable(corner), true);
  assert.equal(sweptRoute(start, corner), false, 'the endpoints are safe but their shortcut clips the railing');
  const path = findNpcRoute(start, { x: -10.5, z: 6.3 }); assert.ok(path?.length);
  let prior = start;
  for (const point of path) {
    const steps = Math.ceil(gap(prior, point) / .005);
    for (let n = 1; n <= steps; n++) assert.ok(routeWalkable({ x: prior.x + (point.x - prior.x) * n / steps, z: prior.z + (point.z - prior.z) * n / steps }));
    prior = point;
  }
});
