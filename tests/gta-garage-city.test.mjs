import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILDINGS, LOCATIONS } from '../dist/gta/world.js';
import { createVehicle, stepVehicle } from '../dist/gta/driving.js';
import { createFleet } from '../dist/gta/fleet.js';
import { createCrowd, stepCrowd } from '../dist/gta/crowd.js';
import { garageEligibility } from '../dist/gta/garage.js';

test('the workshop forecourt is reachable from the street and its facade remains solid', () => {
  const bay = LOCATIONS.find(place => place.id === 'garage');
  const building = BUILDINGS.find(place => place.kind === 'garage');
  assert.ok(building);
  let actor = createVehicle({ x: bay.x, z: 8, heading: Math.PI });
  for (let i = 0; i < 120; i++) {
    actor = stepVehicle(actor, { throttle: .25 }, 1 / 60);
    assert.equal(actor.impact, false, 'the service entrance must be clear');
  }
  for (let i = 0; i < 30; i++) actor = stepVehicle(actor, { brake: true }, 1 / 60);
  const vehicle = { ...createFleet()[0], ...actor, vehicleHealth: 40, damageStage: 'damaged' };
  assert.equal(garageEligibility({ vehicle, player: actor, walking: false,
    controlledId: vehicle.id, wantedLevel: 0, dead: false }).ok, true);
  let collided = false;
  for (let i = 0; i < 120; i++) {
    actor = stepVehicle(actor, { throttle: 1, tuning: { engine: 2 } }, 1 / 60);
    collided ||= actor.impact;
  }
  assert.ok(collided);
  assert.ok(actor.z <= building.z - building.d / 2 - 1.5 + 1e-8);
});

test('pedestrians circle the smaller workshop without the old high-rise detours or jumps', () => {
  const index = BUILDINGS.findIndex(building => building.kind === 'garage');
  const building = BUILDINGS[index];
  let crowd = createCrowd(), previous = crowd.find(person => person.blockIndex === index);
  assert.ok(previous, 'the workshop district remains populated');
  const visited = { north: false, south: false, east: false, west: false };
  for (let i = 0; i < 2400; i++) {
    crowd = stepCrowd(crowd, .1, { vehicles: [] });
    const person = crowd.find(item => item.id === previous.id);
    const x = person.x - building.x, z = person.z - building.z;
    assert.ok(Math.hypot(person.x - previous.x, person.z - previous.z) <= person.walkSpeed * .1 + 1e-6);
    assert.ok(Math.abs(x) <= building.w / 2 + .801);
    assert.ok(Math.abs(z) <= building.d / 2 + .801);
    assert.ok(Math.abs(x) >= building.w / 2 + .4 || Math.abs(z) >= building.d / 2 + .4);
    if (z < -building.d / 2) visited.north = true;
    if (z > building.d / 2) visited.south = true;
    if (x > building.w / 2) visited.east = true;
    if (x < -building.w / 2) visited.west = true;
    previous = person;
  }
  assert.ok(Object.values(visited).every(Boolean));
});
