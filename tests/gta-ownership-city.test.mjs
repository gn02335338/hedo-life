import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILDINGS, LOCATIONS, MISSIONS } from '../dist/gta/world.js';
import { createVehicle, stepVehicle, createPedestrian, stepPedestrian } from '../dist/gta/driving.js';
import { createCrowd, stepCrowd } from '../dist/gta/crowd.js';
import { addCollectionVisuals } from '../dist/gta/visual-collection.js';
import { resolveVehicleVariant } from '../dist/gta/visual-vehicles.js';

const bay = LOCATIONS.find(place => place.id === 'collection');
const building = BUILDINGS.find(place => place.kind === 'collection');

test('the private garage occupies an ordinary block and preserves both existing service landmarks', () => {
  assert.equal(BUILDINGS.length, 16);
  assert.deepEqual([bay.x, bay.z], [-30, 78]);
  assert.deepEqual([building.x, building.z, building.w, building.d, building.h], [-30, 97, 36, 22, 9]);
  assert.deepEqual(BUILDINGS.filter(b => b.kind === 'finance').map(b => [b.x, b.z]), [[30, 90]]);
  assert.deepEqual(BUILDINGS.filter(b => b.kind === 'garage').map(b => [b.x, b.z]), [[-90, 37]]);
  assert.deepEqual(LOCATIONS.filter(place => place.id === 'finance').map(place => [place.x, place.z]), [[64, 86]]);
  assert.equal(MISSIONS.filter(mission => mission.pickup === 'finance' || mission.dropoff === 'finance').length, 2);
  assert.ok(bay.z + 7 < building.z - building.d / 2, 'the service radius ends before the closed facade');
});

test('real vehicle physics can enter, brake and reverse out of the collection bay without a collision', () => {
  let actor = createVehicle({ x: bay.x, z: 60, heading: Math.PI });
  let frames = 0;
  while (actor.z < bay.z && frames++ < 300) {
    actor = stepVehicle(actor, { throttle: .3 }, 1 / 60);
    assert.equal(actor.impact, false, 'inbound approach');
  }
  assert.ok(actor.z >= bay.z);
  for (let i = 0; i < 60; i++) {
    actor = stepVehicle(actor, { brake: true }, 1 / 60);
    assert.equal(actor.impact, false, 'braking inside the bay');
  }
  assert.ok(Math.abs(actor.z - bay.z) < 7);
  frames = 0;
  while (actor.z > 60 && frames++ < 400) {
    actor = stepVehicle(actor, { throttle: -1 }, 1 / 60);
    assert.equal(actor.impact, false, 'reversing to the street');
  }
  assert.ok(actor.z <= 60);
  actor = createVehicle({ x: bay.x, z: bay.z, heading: 0 });
  frames = 0;
  while (actor.z > 60 && frames++ < 300) {
    actor = stepVehicle(actor, { throttle: .4 }, 1 / 60);
    assert.equal(actor.impact, false, 'a retrieved car faces the street');
  }
  assert.ok(actor.z <= 60);
});

test('the closed facade blocks driving while the right-hand walking exit stays clear', () => {
  let actor = createVehicle({ x: bay.x, z: bay.z, heading: Math.PI });
  let collided = false;
  for (let i = 0; i < 180; i++) {
    actor = stepVehicle(actor, { throttle: 1 }, 1 / 60);
    collided ||= actor.impact;
  }
  assert.ok(collided);
  assert.ok(actor.z <= building.z - building.d / 2 - 1.5 + 1e-8);
  let walker = createPedestrian({ x: bay.x + 4, z: bay.z });
  const obstacles = [...BUILDINGS, { x: bay.x, z: bay.z, w: 2.1, d: 4.3 }];
  for (let i = 0; i < 240; i++) {
    walker = stepPedestrian(walker, { forward: 1, cameraYaw: 0 }, 1 / 60, obstacles);
    assert.equal(walker.impact, false);
  }
  assert.ok(walker.z < 61);
  assert.ok(Math.abs(walker.x - (bay.x + 4)) < 1e-8);
});

test('rendered fixtures match the building and leave the approach, safe point and sidewalk routes clear', () => {
  const boxes = [], signs = [];
  const M = Object.fromEntries(['sidewalk', 'curb', 'roof', 'metal', 'glass', 'white', 'lit'].map(key => [key, key]));
  addCollectionVisuals({ building, location: bay, M, wall: 'wall', accent: 'accent',
    box: (material, x, y, z, w, h, d, rotation = 0) => boxes.push({ material, x, y, z, w, h, d, rotation }),
    sign: () => { const result = { rotation: {}, position: { set(x, y, z) { this.x = x; this.y = y; this.z = z; } } }; signs.push(result); return result; },
  });
  assert.equal(signs.length, 3, 'only a bounded set of static sign textures is created');
  assert.ok(boxes.every(b => [b.x, b.y, b.z, b.w, b.h, b.d, b.rotation].every(Number.isFinite) && b.w > 0 && b.h > 0 && b.d > 0));
  assert.ok(boxes.some(b => b.material === 'wall' && b.x === building.x && b.z === building.z && b.w === building.w && b.d === building.d && b.h === building.h));
  const tall = boxes.filter(b => b.y + b.h / 2 > .36 && b.y - b.h / 2 < 2.2);
  function clear(x1, x2, z1, z2) {
    for (const b of tall) {
      const halfX = (Math.abs(Math.cos(b.rotation)) * b.w + Math.abs(Math.sin(b.rotation)) * b.d) / 2;
      const halfZ = (Math.abs(Math.sin(b.rotation)) * b.w + Math.abs(Math.cos(b.rotation)) * b.d) / 2;
      assert.ok(b.x + halfX <= x1 || b.x - halfX >= x2 || b.z + halfZ <= z1 || b.z - halfZ >= z2,
        `fixture ${b.material} at ${b.x},${b.z} blocks a traversable route`);
    }
  }
  clear(bay.x - 1.5, bay.x + 1.5, 60, bay.z + 3);
  clear(bay.x + 3.5, bay.x + 4.5, bay.z - .5, bay.z + .5);
  for (const side of [-1, 1]) {
    const x = building.x + side * (building.w / 2 + .8);
    clear(x - .45, x + .45, building.z - building.d / 2, building.z + building.d / 2);
  }
});

test('the crowd completes the smaller private-garage loop without old street-prop detours', () => {
  const blockIndex = BUILDINGS.indexOf(building);
  let crowd = createCrowd(), previous = crowd.find(person => person.blockIndex === blockIndex);
  assert.ok(previous);
  const sides = new Set();
  for (let i = 0; i < 2400; i++) {
    crowd = stepCrowd(crowd, .1);
    const person = crowd.find(item => item.id === previous.id);
    const x = person.x - building.x, z = person.z - building.z;
    assert.ok(Math.hypot(person.x - previous.x, person.z - previous.z) <= person.walkSpeed * .1 + 1e-6);
    assert.ok(Math.abs(x) <= building.w / 2 + .801 && Math.abs(z) <= building.d / 2 + .801);
    assert.ok(Math.abs(x) >= building.w / 2 + .4 || Math.abs(z) >= building.d / 2 + .4);
    if (z < -building.d / 2) sides.add('north');
    if (z > building.d / 2) sides.add('south');
    if (x > building.w / 2) sides.add('east');
    if (x < -building.w / 2) sides.add('west');
    previous = person;
  }
  assert.equal(sides.size, 4);
});

test('catalog variants override ID-derived shapes while police and existing traffic remain stable', () => {
  for (const variant of ['hatch', 'sedan', 'suv']) {
    assert.equal(resolveVehicleVariant(`owned-${variant}`, 'parked', variant), variant);
    assert.equal(resolveVehicleVariant('starter-sedan', 'parked', variant), variant);
    assert.equal(resolveVehicleVariant('police-1', 'police', variant), 'sedan');
  }
  for (const invalid of [undefined, null, '', '__proto__', 'constructor', 'truck', {}]) {
    assert.equal(resolveVehicleVariant('starter-sedan', 'parked', invalid), 'sedan');
    assert.equal(resolveVehicleVariant('plum', null, invalid), 'hatch');
    assert.equal(resolveVehicleVariant('green', null, invalid), 'suv');
  }
});
