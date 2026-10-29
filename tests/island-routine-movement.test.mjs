import { FERRY_SPEED } from '../dist/island/archipelago.js';
import { RESIDENT_POSITIONS } from '../dist/island/residents.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNpcLife, NPC_COMMUTE_SPEED } from '../dist/island/npc-life.js';
import { ISLAND_CAST } from '../dist/island/cast.js';
import { LAYOUT, PLACE_ENTRANCES, isTerrainWalkable } from '../dist/island/navigation.js';
import { PLACE_BY_ID } from '../dist/island/places.js';
import { MYSTERY_TRIP } from '../dist/island/routines.js';
import { npcGroundHeight, findNpcRoute, sweptRoute, routeWalkable } from '../dist/island/npc-routing.js';
const expectedHosts = {
  alice: { districtId: 'omega-city', main: 'omega-terminal', rest: 'omega-overlook' },
  jack: { districtId: 'oneira', main: 'oneira-hub', rest: 'oneira-library' },
  johnny: { districtId: 'oneira', main: 'oneira-library', rest: 'oneira-hub' },
};
const fullRoster = () => LAYOUT.filter(district => Object.hasOwn(RESIDENT_POSITIONS, district.id)).flatMap(({ id: districtId }) => [0, 1, 2].map(slot => ({ id: `${districtId}-${slot}`, districtId, slot })));
const gap = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const positions = life => life.getState().map(row => [row.key, row.position]);
function assertSeparated(rows) {
  rows=rows.filter(row=>!row.ferry);
  for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) assert.ok(gap(rows[i].position, rows[j].position) >= .445 - 1e-7, `${rows[i].key} overlaps ${rows[j].key}`);
}
function settle(life, seconds = 360, observe) {
  let previous = life.getState(), frames = 0;
  for (; frames < seconds * 10; frames++) {
    const rows = life.update(.1);
    observe?.(rows);
    for (let i = 0; i < rows.length; i++) {
      assert.ok(gap(rows[i].position, previous[i].position) <= (rows[i].ferry||previous[i].ferry?FERRY_SPEED:NPC_COMMUTE_SPEED) * .1 + 1e-8, `${rows[i].key}: teleported`);
      if(rows[i].state==='sailing')assert.equal(rows[i].position.y,.58);else assert.equal(rows[i].position.y, npcGroundHeight(rows[i].position));
    }
    assertSeparated(rows);
    if (frames % 10 === 0) for (const row of rows.filter(row=>!row.ferry)) assert.ok(isTerrainWalkable(row.position, .21), `${row.key}: off island or inside building`);
    previous = rows;
    if (frames > 10 && !rows.some(row => row.traveling)) break;
  }
  const traveling = life.getState().filter(row => row.traveling);
  assert.equal(traveling.length, 0, `unresolved trips after ${seconds}s: ${traveling.map(row => `${row.id}:${row.districtId}>${row.destinationDistrictId}`).join(',')}`);
  return frames / 10;
}

test('morning colleagues start at their department or project island and late arrivals do not move established actors', () => {
  const life = createNpcLife({ hour: 10 });
  for (const person of ISLAND_CAST) {
    const placeId = expectedHosts[person.id]?.main || person.workplaceId;
    const actor = life.getState().find(row => row.id === person.id), district = PLACE_BY_ID.get(placeId).districtId;
    assert.equal(actor.districtId, district); assert.equal(actor.destinationPlaceId, placeId); assert.equal(actor.traveling, false);
  }
  const before = positions(life); life.setResidents(fullRoster());
  assert.deepEqual(positions(life).filter(([key]) => key.startsWith('person:')), before); assertSeparated(life.getState());
});

test('all 61 actors remain solid while colleagues complete tea, work, after-work and group-trip routes', () => {
  const life = createNpcLife({ hour: 10, residents: fullRoster() });
  for (const hour of [12.6, 13.5, 15.6, 18, 19.25, 19.75, 20.25, 10]) {
    const before = positions(life); life.setHour(hour); assert.deepEqual(positions(life), before, 'changing time retargets without moving bodies');
    const hostSailings = new Set();
    const duration = settle(life, 360, rows => {
      for (const row of rows) if (['jack', 'johnny'].includes(row.id) && row.state === 'sailing') {
        hostSailings.add(`${row.id}:${row.ferry.from}>${row.ferry.to}`);
      }
    }); assert.ok(duration <= 360);
    if (hour === 19.25 || hour === 20.25) for (const id of ['jack', 'johnny']) {
      const route = hour === 19.25 ? 'oneira>life' : 'life>oneira';
      assert.ok(hostSailings.has(`${id}:${route}`), `${id}: ${route} uses an actual boat`);
    }
    for (const row of life.getState()) {
      assert.equal(row.districtId, row.destinationDistrictId, `${row.id}: wrong venue at ${hour}`);
      if (row.kind === 'resident') assert.equal(row.districtId, row.id.split('-')[0], 'approved residents keep their assigned homes');
    }
    if ([12.6, 15.6].includes(hour)) for (const row of life.getState().filter(row => row.kind === 'person')) {
      assert.equal(row.destinationPlaceId, expectedHosts[row.id]?.rest || 'pantry');
    }
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
  settle(life, 360);
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


test('Alice, Jack and Johnny are unique moving hosts who stop to greet and remain pinned during conversation', () => {
  const life = createNpcLife({ hour: 10 }), initial = new Map(life.getState().map(row => [row.id, row.position]));
  const moved = new Set();
  assert.equal(life.getState().length, 34);
  for (let frame = 0; frame < 300; frame++) for (const row of life.update(.1)) {
    if (expectedHosts[row.id] && gap(initial.get(row.id), row.position) > .15) moved.add(row.id);
  }
  assert.deepEqual([...moved].sort(), Object.keys(expectedHosts).sort());
  for (const [id, host] of Object.entries(expectedHosts)) {
    let actor = life.getState().find(row => row.id === id);
    assert.equal(actor.districtId, host.districtId);
    assert.ok(isTerrainWalkable(actor.position, .21));
    const before = { ...actor.position }, player = { x: before.x + .8, z: before.z };
    life.update(.1, { player, roaming: true });
    actor = life.getState().find(row => row.id === id);
    assert.deepEqual(actor.position, before); assert.equal(actor.state, 'greeting');
    life.setConversationTarget({ kind: 'person', id });
    life.setHour(12.6);
    for (let frame = 0; frame < 20; frame++) life.update(.1);
    actor = life.getState().find(row => row.id === id);
    assert.deepEqual(actor.position, before, `${id}: changing the schedule cannot move a conversation`);
    assert.equal(actor.state, 'talking');
    assert.equal(actor.destinationDistrictId, host.districtId);
    life.setConversationTarget(null);
  }
});

test('host incidents override hosting until release, then they actually sail back to their project islands', () => {
  const life = createNpcLife({ hour: 10 });
  const incidents = [
    { id: 'alice', status: 'hospital', districtId: 'hospital', placeId: 'hospital-er' },
    { id: 'jack', status: 'police', districtId: 'police', placeId: 'police-desk' },
    { id: 'johnny', status: 'exile', districtId: 'exile', placeId: 'exile-gate' },
  ];
  const before = positions(life); life.setDispositions(incidents);
  assert.deepEqual(positions(life), before, 'cross-island emergency transfers start from real positions');
  settle(life);
  life.setHour(18);
  for (const incident of incidents) {
    const actor = life.getState().find(row => row.id === incident.id);
    assert.equal(actor.districtId, incident.districtId);
    assert.equal(actor.routine.phase, incident.status);
  }
  life.setHour(10);
  const heldPositions = positions(life); life.setDispositions([]);
  assert.deepEqual(positions(life), heldPositions, 'release retargets without teleporting');
  const sailings = new Set();
  settle(life, 360, rows => {
    for (const row of rows) if (expectedHosts[row.id] && row.state === 'sailing') sailings.add(`${row.id}:${row.ferry.to}`);
  });
  for (const [id, host] of Object.entries(expectedHosts)) {
    const actor = life.getState().find(row => row.id === id);
    assert.equal(actor.disposition, null);
    assert.equal(actor.districtId, host.districtId);
    assert.equal(actor.destinationPlaceId, host.main);
    assert.ok(sailings.has(`${id}:${host.districtId}`), `${id}: recovery returns via a real boat`);
  }
});
