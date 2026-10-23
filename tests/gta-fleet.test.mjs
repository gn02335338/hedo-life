import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILDINGS } from '../dist/gta/world.js';
import { createFleet, findNearbyCar, stepFleet, takeCar, parkCar } from '../dist/gta/fleet.js';

const near = (actual, expected, epsilon = 1e-7) => assert.ok(Math.abs(actual - expected) < epsilon, `${actual} differs from ${expected}`);
function simulate(cars, seconds, options = {}, fps = 60) {
  for (let frame = 0; frame < seconds * fps; frame += 1) cars = stepFleet(cars, 1 / fps, options);
  return cars;
}

test('fresh fleets have independent parked cars and traffic with a driver to take at the start', () => {
  const first = createFleet(), second = createFleet();
  assert.deepEqual(first, second);
  assert.equal(new Set(first.map(car => car.id)).size, first.length);
  assert.ok(first.filter(car => car.kind === 'traffic').length >= 4);
  const starter = first.find(car => car.id === 'starter-sedan');
  assert.deepEqual({ x: starter.x, z: starter.z, heading: starter.heading, occupied: starter.occupied }, { x: 4, z: 20, heading: 0, occupied: true });
  assert.equal(findNearbyCar(first, { x: 7, z: 32 }), null, 'players must walk to their first car');
  assert.equal(findNearbyCar(first, { x: 7, z: 20 })?.id, starter.id);
  first.find(car => car.kind === 'traffic').route[0].x = 999;
  assert.notEqual(second.find(car => car.kind === 'traffic').route[0].x, 999);
});

test('entry selects the closest slow vehicle and excludes distant, moving, controlled and blocked cars', () => {
  const cars = createFleet();
  const starter = cars.find(car => car.id === 'starter-sedan');
  assert.equal(findNearbyCar(cars, { x: 7, z: 20 }, { excludeId: starter.id }), null);
  const fast = { ...starter, id: 'fast', x: 6, speed: 6 };
  assert.equal(findNearbyCar([fast, starter], { x: 7, z: 20 })?.id, starter.id);
  assert.equal(findNearbyCar([{ ...fast, speed: 4 }], { x: 7, z: 20 })?.id, fast.id);
  assert.equal(findNearbyCar([starter], { x: 7, z: 20 }, { maxDistance: 2 }), null);
  assert.equal(findNearbyCar([{ ...starter, x: 30, z: 30 }], { x: 30, z: 30 }), null);
  assert.equal(findNearbyCar(cars, { x: NaN, z: 20 }), null);
});

test('taking and parking retain one car identity, do not mutate input, and are idempotent', () => {
  const original = createFleet(), snapshot = structuredClone(original);
  const taken = takeCar(original, 'starter-sedan');
  assert.deepEqual(original, snapshot);
  assert.equal(taken.length, original.length);
  assert.equal(taken.find(car => car.id === 'starter-sedan').occupied, false);
  assert.equal(taken.find(car => car.id === 'starter-sedan').stolen, true);
  assert.deepEqual(takeCar(taken, 'starter-sedan'), taken);
  const parked = parkCar(taken, 'starter-sedan', { x: 4, z: -12, heading: 1, speed: 20 });
  const car = parked.find(car => car.id === 'starter-sedan');
  assert.equal(car.x, 4);
  assert.equal(car.z, -12);
  assert.equal(car.speed, 0);
  assert.equal(car.kind, 'parked');
  assert.equal(car.occupied, false);
  assert.equal(findNearbyCar(parked, { x: 5, z: -12 })?.id, car.id);
  assert.deepEqual(parkCar(parked, car.id, car), parked);
  assert.deepEqual(takeCar(original, 'missing'), original);
});

test('NPC traffic stops before a red intersection then resumes on green', () => {
  const car = { ...createFleet().find(car => car.id === 'traffic-blue'), x: 40 };
  const stopped = simulate([car], 5);
  near(stopped[0].x, 52);
  assert.equal(stopped[0].speed, 0);
  assert.equal(findNearbyCar(stopped, { x: 52, z: 7 })?.id, car.id, 'a stopped driver can be taken');
  const resumed = simulate(stopped, 5);
  assert.ok(resumed[0].x > 58 && resumed[0].speed > 5);
});

test('traffic avoids a stopped car and a pedestrian ahead', () => {
  const cars = createFleet().filter(car => ['traffic-coral', 'starter-sedan'].includes(car.id));
  const behindCar = simulate(cars, 15).find(car => car.id === 'traffic-coral');
  assert.ok(behindCar.z >= 25.2 - 1e-6 && behindCar.speed < 0.1);
  const behindPerson = simulate(cars, 15, { player: { x: 4, z: 42 } }).find(car => car.id === 'traffic-coral');
  assert.ok(behindPerson.z >= 45.2 - 1e-6 && behindPerson.speed < 0.1);
  const released = simulate(cars.filter(car => car.kind === 'traffic'), 15);
  assert.ok(released[0].z < behindCar.z);
});

test('reserved, controlled and stolen cars never drive away on their own', () => {
  const cars = createFleet();
  const controlledId = 'traffic-coral', reservedId = 'traffic-blue';
  const result = simulate(cars, 2, { controlledId, reservedId });
  assert.deepEqual(result.find(car => car.id === controlledId), cars.find(car => car.id === controlledId));
  assert.deepEqual(result.find(car => car.id === reservedId), cars.find(car => car.id === reservedId));
  const stolen = takeCar(cars, 'traffic-green');
  assert.deepEqual(simulate(stolen, 2).find(car => car.id === 'traffic-green'), stolen.find(car => car.id === 'traffic-green'));
});

test('traffic routes stay clear of buildings throughout corners and remain deterministic across frame rates', () => {
  let cars = createFleet();
  const initial = structuredClone(cars);
  for (let frame = 0; frame < 1200; frame += 1) {
    cars = stepFleet(cars, 0.1);
    for (const car of cars) {
      assert.equal(BUILDINGS.some(block => Math.abs(car.x - block.x) < block.w / 2 + 1.5 - 1e-7
        && Math.abs(car.z - block.z) < block.d / 2 + 1.5 - 1e-7), false, `${car.id} entered a building`);
    }
  }
  assert.deepEqual(createFleet(), initial);
  const at30 = simulate(initial, 4, {}, 30), at60 = simulate(initial, 4, {}, 60);
  for (let index = 0; index < at30.length; index += 1) {
    near(at30[index].x, at60[index].x);
    near(at30[index].z, at60[index].z);
    near(at30[index].speed, at60[index].speed);
  }
  assert.deepEqual(stepFleet(initial, 60), stepFleet(initial, 0.1));
  assert.deepEqual(stepFleet(initial, -1), initial);
});
