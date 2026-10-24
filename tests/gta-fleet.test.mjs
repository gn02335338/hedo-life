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

test('traffic safely passes a stopped car and resumes the original lane', () => {
  const cars = createFleet().filter(car => ['traffic-coral', 'starter-sedan'].includes(car.id));
  let state = cars, maximumOffset = 0, passed = false;
  for (let frame = 0; frame < 24 * 60; frame += 1) {
    state = stepFleet(state, 1 / 60);
    const car = state.find(item => item.kind === 'traffic'), parked = state.find(item => item.id === 'starter-sedan');
    maximumOffset = Math.max(maximumOffset, car.laneOffset);
    if (Math.abs(car.z - parked.z) < 4.6) assert.ok(Math.abs(car.x - parked.x) >= 2.7, 'passing keeps lateral clearance');
    if (car.z < parked.z - 7) passed = true;
    assert.ok(car.laneOffset >= 0 && car.laneOffset <= 3.1 && car.x >= 4 - 1e-7, 'never passes into the opposing lane');
  }
  assert.ok(maximumOffset > 2.7 && passed);
  assert.ok(state.find(car => car.kind === 'traffic').laneOffset < .05, 'returns to its route after passing');
  assert.deepEqual(state.find(car => car.id === 'starter-sedan'), cars.find(car => car.id === 'starter-sedan'));
});

const trafficFixture = overrides => ({ ...createFleet().find(car => car.id === 'traffic-coral'), x: 4, z: 50, ...overrides });
const parkedFixture = (id, x = 4, z = 34) => ({ id, kind: 'parked', x, z, heading: 0, speed: 0, occupied: false });

test('a crossing pedestrian is predicted before entering the lane and traffic resumes after they clear', () => {
  const initial = [trafficFixture()];
  const crossing = { id: 'fleeing', x: 8, z: 34, heading: -Math.PI / 2, speed: 4, mode: 'flee' };
  const warned = simulate(initial, 2, { pedestrians: [crossing] });
  assert.equal(warned[0].yieldReason, 'pedestrian');
  assert.ok(warned[0].speed < 3 && warned[0].z >= 37.5);
  const stopped = simulate(warned, 1, { pedestrians: [crossing] });
  assert.equal(stopped[0].speed, 0);
  assert.equal(stopped[0].laneOffset, 0, 'does not steer across a running pedestrian');
  const resumed = simulate(stopped, 3, { pedestrians: [{ ...crossing, x: -6 }] });
  assert.ok(resumed[0].z < 30 && resumed[0].speed > 5);
  const behind = simulate(initial, 1, { pedestrians: [{ ...crossing, x: 4, z: 60, heading: Math.PI }] });
  assert.ok(behind[0].speed > 6, 'someone running away behind the car is not a phantom obstacle');
});

test('stationary players get a full stop with no side sliding, and traffic resumes when they leave', () => {
  let state = [trafficFixture()], stopped = false;
  const player = { x: 4, z: 34, speed: 0 };
  for (let frame = 0; frame < 12 * 60; frame += 1) {
    state = stepFleet(state, 1 / 60, { player }); const car = state[0];
    if (car.speed < .01 && car.z > player.z) stopped = true;
    if (Math.abs(car.z - player.z) < 3.1) {
      assert.ok(Math.abs(car.x - player.x) > 2, 'pedestrian remains outside the passing vehicle');
      assert.ok(car.speed <= 3.5 + 1e-8);
    }
    if (stopped) { near(car.x, 4); assert.ok(car.z >= player.z + 3.5 - 1e-7); }
  }
  assert.ok(stopped);
  const resumed = simulate(state, 4, { player: { ...player, x: -6, speed: 4, heading: -Math.PI / 2 } });
  assert.ok(resumed[0].z < player.z - 7 && resumed[0].speed > 5);
  near(resumed[0].laneOffset, 0, 1e-7);
});

test('an oncoming fast police car triggers early braking and a safe right-side yield', () => {
  let car = trafficFixture(), police = { ...parkedFixture('police-1', 4, 22), kind: 'police', speed: 18, heading: Math.PI };
  let closest = Infinity, earlyBrake = false, maximumOffset = 0;
  for (let frame = 0; frame < 5 * 60; frame += 1) {
    const result = stepFleet([car, police], 1 / 60); car = result[0];
    assert.deepEqual(result[1], police, 'civilian AI never changes police controls');
    police = { ...police, z: police.z + police.speed / 60 };
    maximumOffset = Math.max(maximumOffset, car.laneOffset);
    closest = Math.min(closest, Math.hypot(car.x - police.x, car.z - police.z));
    if (frame < 35 && car.speed <= 3) earlyBrake = true;
    if (Math.abs(car.z - police.z) < 4.6) assert.ok(Math.abs(car.x - police.x) >= 2.7);
  }
  assert.ok(earlyBrake && maximumOffset > 3 && closest > 3);
  assert.ok(car.laneOffset < .1 && car.speed > 3, 'merges back after the oncoming car passes');
});

test('a red-light stop cannot slide sideways or rotate despite a clear passing pocket', () => {
  const car = { ...createFleet().find(item => item.id === 'traffic-blue'), x: 52, speed: 0 };
  const blocker = { ...parkedFixture('front', 66, 4), heading: Math.PI / 2 };
  const state = simulate([car, blocker], 1);
  assert.ok(state[0].offsetTarget > 0, 'there is an available right-side passing plan');
  assert.equal(state[0].speed, 0); near(state[0].x, car.x); near(state[0].z, car.z);
  near(state[0].laneOffset, 0); near(state[0].heading, car.heading);
});

test('a fast reversing player car is classified by its actual velocity and gets the same safe yield', () => {
  let car = trafficFixture(), reversing = { ...parkedFixture('controlled', 4, 22), heading: 0, speed: -18 };
  let recognized = false, closest = Infinity;
  for (let frame = 0; frame < 5 * 60; frame += 1) {
    const result = stepFleet([car, reversing], 1 / 60, { controlledId: reversing.id });
    car = result[0]; assert.deepEqual(result[1], reversing);
    recognized ||= car.yieldReason === 'oncoming';
    reversing = { ...reversing, z: reversing.z + 18 / 60 };
    closest = Math.min(closest, Math.hypot(car.x - reversing.x, car.z - reversing.z));
    if (Math.abs(car.z - reversing.z) < 4.6) assert.ok(Math.abs(car.x - reversing.x) >= 2.7);
  }
  assert.ok(recognized && closest > 3 && car.laneOffset < .1);
});

test('blocked side pockets stop traffic without entering a building or the opposite lane', () => {
  const cars = [trafficFixture(), parkedFixture('front'), parkedFixture('right', 7)];
  const stopped = simulate(cars, 8);
  near(stopped[0].x, 4); near(stopped[0].z, 39.3); assert.equal(stopped[0].speed, 0);
  assert.equal(stopped[0].laneOffset, 0);
  assert.equal(stopped[0].aiMode, 'yield');
  const resumed = simulate(stopped.filter(car => car.id !== 'front'), 10);
  assert.ok(resumed[0].z < 27, 'traffic resumes when the blocking car leaves');
  const edge = simulate([trafficFixture({ x: 7.5, route: [{ x: 7.5, z: 10 }], waypoint: 0 }), parkedFixture('edge', 7.5, 34)], 6);
  assert.equal(edge[0].laneOffset, 0, 'does not choose a passing corridor inside the building');
  assert.ok(edge[0].z >= 39.3 - 1e-6 && edge[0].speed === 0);
});

test('near gunshots cause assessment and cautious recovery; distant and expired sounds do not', () => {
  const cars = [trafficFixture()], sound = { id: 'shot-1', kind: 'gunshot', x: 4, z: 32, radius: 48, remaining: 1.2 };
  const nearShot = simulate(cars, .5, { threats: [sound] });
  assert.equal(nearShot[0].aiMode, 'yield'); assert.equal(nearShot[0].yieldReason, 'gunshot');
  assert.ok(nearShot[0].speed < 1.1 && nearShot[0].threatTimer > 0);
  const continued = simulate(cars, 8, { threats: [sound] });
  assert.ok(continued[0].z >= sound.z + 10 - 1e-7 && continued[0].speed === 0, 'does not accelerate into a continuing forward hazard');
  const recovered = simulate(continued, 5);
  assert.ok(recovered[0].z < sound.z - 4 && recovered[0].speed > 5 && recovered[0].threatTimer === 0);
  const normal = simulate(cars, 2);
  assert.deepEqual(simulate(cars, 2, { threats: [{ ...sound, x: 90, z: 90 }] }), normal);
  assert.deepEqual(simulate(cars, 2, { threats: [{ ...sound, remaining: 0 }] }), normal);
  const behind = simulate(cars, .5, { threats: [{ ...sound, z: 60 }] });
  assert.equal(behind[0].threatTimer, 0); assert.ok(behind[0].z < 47 && behind[0].speed >= 3.5);
});

test('fresh repeated sound IDs cannot restart every-frame panic or grow unbounded memory', () => {
  let state = [trafficFixture()], pauseFrames = 0;
  for (let frame = 0; frame < 6 * 60; frame += 1) {
    state = stepFleet(state, 1 / 60, { threats: [{ id: `shot-${frame}`, kind: 'gunshot', x: 12, z: 34, radius: 48, remaining: 1.2 }] });
    if (state[0].threatTimer > 0) pauseFrames += 1;
    assert.ok(state[0].threatMemory.length <= 8);
  }
  assert.ok(pauseFrames < 100 && state[0].z < 37, 'the car advances between bounded assessments');
  const impact = simulate([trafficFixture()], .1, { threats: [{ id: 'crash', kind: 'collision', x: 8, z: 40, radius: 26, remaining: 1.8 }] });
  assert.equal(impact[0].yieldReason, 'collision');
});

test('reserved, controlled and stolen cars never drive away on their own', () => {
  const cars = createFleet();
  const controlledId = 'traffic-coral', reservedId = 'traffic-blue';
  const result = simulate(cars, 2, { controlledId, reservedId, pedestrians: [{ x: 4, z: 70, speed: 4 }],
    threats: [{ id: 'busy-street', kind: 'gunshot', x: 4, z: 73, radius: 48, remaining: 1.2 }] });
  assert.deepEqual(result.find(car => car.id === controlledId), cars.find(car => car.id === controlledId));
  assert.deepEqual(result.find(car => car.id === reservedId), cars.find(car => car.id === reservedId));
  const stolen = takeCar(cars, 'traffic-green');
  assert.deepEqual(simulate(stolen, 2).find(car => car.id === 'traffic-green'), stolen.find(car => car.id === 'traffic-green'));
});

test('avoidance and sound timers remain pure, freeze exactly and agree at 30/60 Hz', () => {
  const cars = [trafficFixture(), parkedFixture('obstacle')], snapshot = structuredClone(cars);
  const options = { pedestrians: [{ id: 'safe-sidewalk', x: -7, z: 35, speed: 2, heading: 0 }],
    threats: [{ id: 'noise', kind: 'gunshot', x: -10, z: 32, radius: 48, remaining: 1.2 }] };
  const optionsSnapshot = structuredClone(options);
  const at30 = simulate(cars, 6, options, 30), at60 = simulate(cars, 6, options, 60);
  assert.deepEqual(at30, at60);
  assert.deepEqual(cars, snapshot); assert.deepEqual(options, optionsSnapshot);
  assert.ok(at60[0].laneOffset > 0 && at60[0].alertTimer > 0);
  assert.deepEqual(stepFleet(at60, 0, options), at60);
  assert.deepEqual(stepFleet(at60, NaN, options), at60);
  assert.deepEqual(stepFleet(cars, 9, options), stepFleet(cars, .1, options));
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
