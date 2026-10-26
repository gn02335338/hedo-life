import test from 'node:test';
import assert from 'node:assert/strict';
import { createNpcLife } from '../dist/island/npc-life.js';
import { ISLAND_CAST } from '../dist/island/cast.js';
import { PLACE_ENTRANCES, LAYOUT, CAST_RADIUS, PLAYER_RADIUS, isTerrainWalkable } from '../dist/island/navigation.js';
import { RESIDENT_POSITIONS, normalizeResidents } from '../dist/island/residents.js';
import { findNpcRoute, ROUTE_GAP, sweptRoute, routeWalkable } from '../dist/island/npc-routing.js';

const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const disposition = (id, status, placeId, districtId = status) => ({ id, status, placeId, districtId });
const residentRoster = Object.keys(RESIDENT_POSITIONS).flatMap(districtId => [0, 1, 2].map(slot => ({ id: `${districtId}:${slot}`, districtId, slot })));
function assertClear(rows, player = null) {
  for (let i = 0; i < rows.length; i++) {
    const actor = rows[i];
    assert.ok(isTerrainWalkable(actor.position, CAST_RADIUS + ROUTE_GAP), `${actor.key} is on clear ground`);
    for (let j = i + 1; j < rows.length; j++) assert.ok(distance(actor.position, rows[j].position) >= 2 * CAST_RADIUS + ROUTE_GAP - 1e-8, `${actor.key} and ${rows[j].key} do not overlap`);
    if (player) assert.ok(distance(actor.position, player) >= CAST_RADIUS + PLAYER_RADIUS + ROUTE_GAP - 1e-8, `${actor.key} leaves player room`);
  }
}

test('emergency transfers move affected colleagues to their actual facilities without moving residents or bystanders', () => {
  const life = createNpcLife({ residents: residentRoster, hour: 10 }), before = life.getState();
  const rows = life.setDispositions([
    disposition('jack', 'hospital', 'hospital-er'), disposition('wing', 'police', 'police-desk'),
    disposition('henry', 'exile', 'cold-palace'),
  ]);
  assert.equal(rows.length, 61);
  assertClear(rows);
  for (const actor of rows) {
    if (['jack', 'wing', 'henry'].includes(actor.id) && actor.kind === 'person') {
      assert.equal(actor.destinationPlaceId, actor.disposition.placeId);
      assert.equal(actor.districtId, actor.disposition.districtId);
      assert.equal(actor.traveling, false);
      assert.equal(actor.routine.phase, actor.disposition.status);
      assert.ok(distance(actor.position, PLACE_ENTRANCES[actor.destinationPlaceId]) < 4);
      assert.ok(Object.values(PLACE_ENTRANCES).every(entry => distance(entry, actor.position) > .9));
    } else assert.deepEqual(actor, before.find(row => row.key === actor.key), `${actor.key} is untouched`);
  }
  assert.deepEqual(life.setDispositions([
    disposition('jack', 'hospital', 'hospital-er'), disposition('wing', 'police', 'police-desk'),
    disposition('henry', 'exile', 'cold-palace'),
  ]), rows, 'refreshing the same disposition batch does not teleport again');
});

test('facility holds survive manual clock changes and release resumes the current timetable from the facility', () => {
  const life = createNpcLife({ hour: 10 });
  life.setDispositions([disposition('jack', 'hospital', 'hospital-er')]);
  const held = life.getState().find(row => row.id === 'jack');
  for (const hour of [12.25, 15.25, 18, 19.25, 10]) {
    life.setHour(hour);
    const actor = life.getState().find(row => row.id === 'jack');
    assert.deepEqual(actor.position, held.position);
    assert.equal(actor.destinationPlaceId, 'hospital-er');
    assert.equal(actor.disposition.status, 'hospital');
  }
  const released = life.setDispositions([]).find(row => row.id === 'jack');
  assert.equal(released.disposition, null);
  assert.equal(released.destinationPlaceId, 'research-center');
  assert.equal(released.traveling, true);
  assert.deepEqual(released.position, held.position, 'release walks back rather than moving to the old workplace instantly');
  const center = LAYOUT.find(row => row.id === 'lab');
  const route = findNpcRoute(released.position, PLACE_ENTRANCES['research-center']);
  assert.ok(route?.length, 'the route graph includes the northern hospital and its bridges');
  let previous = released.position;
  for (const point of route) { assert.ok(sweptRoute(previous, point, routeWalkable)); previous = point; }
  assert.ok(distance(previous, center) < 4);
});

test('all 34 official colleagues can be safely transferred to either full facility', () => {
  for (const [status, placeId] of [['hospital', 'hospital-er'], ['police', 'police-desk'], ['exile', 'exile-gate']]) {
    const life = createNpcLife({ residents: residentRoster });
    const rows = life.setDispositions(ISLAND_CAST.map(({ id }) => disposition(id, status, placeId)));
    assert.equal(rows.filter(row => row.disposition?.status === status).length, 34, `${status} admits the complete cast`);
    assertClear(rows);
    assert.ok(rows.filter(row => row.disposition).every(row => row.districtId === status));
    assert.ok(rows.filter(row => row.disposition).every(row => distance(row.position, PLACE_ENTRANCES[placeId]) > .9));
    for (let i = 0; i < 50; i++) life.update(.1);
    assertClear(life.getState());
    assert.ok(life.getState().filter(row => row.disposition).every(row => row.districtId === status), 'confined colleagues cannot resume a commute by themselves');
  }
});

test('a released colleague physically walks out of the hospital and back to work', () => {
  const life = createNpcLife({ hour: 10 });
  life.setDispositions([disposition('jack', 'hospital', 'hospital-er')]);
  let previous = life.setDispositions([]).find(row => row.id === 'jack'), arrived = false;
  for (let tick = 0; tick < 4000; tick++) {
    const actor = life.update(.1).find(row => row.id === 'jack');
    assert.ok(distance(previous.position, actor.position) <= .136, 'normal release never teleports across a bridge');
    assert.ok(isTerrainWalkable(actor.position, CAST_RADIUS + ROUTE_GAP));
    previous = actor;
    if (!actor.traveling) { arrived = true; break; }
  }
  assert.equal(arrived, true);
  assert.equal(previous.districtId, 'lab');
  assert.equal(previous.destinationPlaceId, 'research-center');
  assert.equal(previous.disposition, null);
});

test('an emergency transfer reserves the visitor body and malformed batches leave the entire state intact', () => {
  const initial = createNpcLife({ hour: 10 });
  const player = initial.setDispositions([disposition('jack', 'hospital', 'hospital-er')]).find(row => row.id === 'jack').position;
  const life = createNpcLife({ hour: 10 });
  life.update(0, { player, roaming: true });
  life.setDispositions([disposition('jack', 'hospital', 'hospital-er')]);
  assertClear(life.getState(), player);
  const held = life.getState();
  for (const input of [null, {}, [disposition('made-up', 'hospital', 'hospital-er')],
    [disposition('jack', '__proto__', 'hospital-er')], [disposition('jack', 'hospital', 'police-desk')],
    [disposition('jack', 'hospital', 'hospital-er'), disposition('jack', 'hospital', 'hospital-er')]]) {
    assert.deepEqual(life.setDispositions(input), held);
  }
});

test('special districts never become community application slots', () => {
  assert.equal(Object.keys(RESIDENT_POSITIONS).length, 9);
  const life = createNpcLife();
  life.setResidents([{ id: 'invalid-special-slot', districtId: 'hospital', slot: 0 }]);
  assert.equal(life.getState().length, 34);
  const payload = { version: 1, residents: [{ id: '00000000-0000-4000-8000-000000000001', districtId: 'hospital', slot: 0,
    nickname: '測試島民', outfit: 'teal', greeting: '一起散步', introduction: '喜歡一起在島上散步聊天。' }] };
  assert.deepEqual(normalizeResidents(payload), []);
});
