import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILDINGS, LOCATIONS, MISSIONS, ROAD_LINES, SPAWN, WORLD_LIMIT } from '../dist/gta/world.js';
import { createVehicle, resetVehicle, stepVehicle, createPedestrian, stepPedestrian } from '../dist/gta/driving.js';
import { STORAGE_KEY, freshProgress, sanitizeProgress, loadProgress, saveProgress, completeMission } from '../dist/gta/progress.js';

const near = (actual, expected, epsilon = 1e-7) => assert.ok(Math.abs(actual - expected) < epsilon, `${actual} differs from ${expected}`);
const collides = (x, z, radius = 1.5) => BUILDINGS.some(block =>
  Math.abs(x - block.x) < block.w / 2 + radius - 1e-7
  && Math.abs(z - block.z) < block.d / 2 + radius - 1e-7);
function simulate(state, input, seconds, obstacles = []) {
  for (let frame = 0; frame < seconds * 60; frame += 1) state = stepVehicle(state, input, 1 / 60, obstacles);
  return state;
}
function memoryStorage() {
  const entries = new Map([['hedo-life-v3', 'career untouched'], ['hedo-island-v1', 'island untouched']]);
  return { entries, getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) };
}

test('all mission stops are reachable along the connected road grid with car clearance', () => {
  assert.equal(BUILDINGS.length, 16);
  assert.equal(new Set(MISSIONS.map(mission => mission.id)).size, 6);
  assert.equal(collides(SPAWN.x, SPAWN.z), false);
  const ids = new Set(LOCATIONS.map(location => location.id));
  for (const mission of MISSIONS) {
    assert.ok(ids.has(mission.pickup) && ids.has(mission.dropoff));
    assert.ok(mission.reward > 0);
    assert.ok(mission.brief && mission.completion);
  }
  for (const road of ROAD_LINES) {
    for (let axis = -120; axis <= 120; axis += 1) {
      assert.equal(collides(road, axis), false, `blocked vertical road at ${road}, ${axis}`);
      assert.equal(collides(axis, road), false, `blocked horizontal road at ${axis}, ${road}`);
    }
  }
  for (const location of LOCATIONS) {
    assert.equal(collides(location.x, location.z), false, location.id);
    assert.ok(Math.max(Math.abs(location.x), Math.abs(location.z)) < WORLD_LIMIT - 1.5);
    const nearestX = ROAD_LINES.reduce((a, b) => Math.abs(a - location.x) < Math.abs(b - location.x) ? a : b);
    const nearestZ = ROAD_LINES.reduce((a, b) => Math.abs(a - location.z) < Math.abs(b - location.z) ? a : b);
    const vertical = Math.abs(nearestX - location.x) < Math.abs(nearestZ - location.z);
    // Sample each driveway from its road center all the way to the pickup spot.
    for (let i = 0; i <= 20; i += 1) {
      const t = i / 20;
      const x = vertical ? nearestX + (location.x - nearestX) * t : location.x;
      const z = vertical ? location.z : nearestZ + (location.z - nearestZ) * t;
      assert.equal(collides(x, z), false, `${location.id} driveway is blocked`);
    }
  }
});

function walk(state, input, seconds, obstacles = [], fps = 60) {
  for (let frame = 0; frame < seconds * fps; frame += 1) state = stepPedestrian(state, input, 1 / fps, obstacles);
  return state;
}

test('driving is pure, forward faces -z, reverse and braking work', () => {
  const initial = createVehicle();
  const untouched = structuredClone(initial);
  const forward = simulate(initial, { throttle: 1 }, 1);
  assert.deepEqual(initial, untouched);
  near(forward.x, SPAWN.x);
  assert.ok(forward.z < SPAWN.z && forward.speed > 16);
  near(forward.distance, SPAWN.z - forward.z);
  const reverse = simulate(initial, { throttle: -1 }, 1);
  assert.ok(reverse.z > initial.z && reverse.speed < 0);
  const stopped = simulate(forward, { brake: true }, 1);
  assert.equal(stopped.speed, 0);
  assert.deepEqual(resetVehicle(), initial);
});

test('steering only turns a moving car, reverses in reverse, and responds at low speed', () => {
  const resting = createVehicle({ heading: 0.7 });
  const turnedAtRest = simulate(resting, { steer: 1 }, 1);
  near(turnedAtRest.heading, resting.heading);
  near(turnedAtRest.x, resting.x);
  near(turnedAtRest.z, resting.z);
  const forward = simulate(createVehicle({ speed: 3 }), { throttle: 0.15, steer: 1 }, 0.5);
  const reverse = simulate(createVehicle({ speed: -3 }), { throttle: -0.15, steer: 1 }, 0.5);
  assert.ok(forward.heading > 0.25 && reverse.heading < -0.25);
  assert.ok(forward.x > SPAWN.x && forward.z < SPAWN.z);
  assert.ok(Math.abs(forward.yawVelocity) < 2.6);
});

test('S brakes before reverse and handbrake gives a shorter controllable stop', () => {
  const initial = createVehicle({ speed: 20 });
  const slowing = simulate(initial, { throttle: -1 }, 0.5);
  assert.ok(slowing.speed > 0 && slowing.speed < 6);
  assert.ok(slowing.z < initial.z);
  const backing = simulate(slowing, { throttle: -1 }, 0.5);
  assert.ok(backing.speed < 0);
  const pedal = simulate(initial, { throttle: -1, steer: 1 }, 0.3);
  const handbrake = simulate(initial, { brake: true, steer: 1 }, 0.3);
  assert.ok(handbrake.speed < pedal.speed);
  assert.ok(handbrake.distance < pedal.distance);
  assert.ok(handbrake.heading > 0.1, 'handbraking should retain steering while moving');
  const stopped = simulate(handbrake, { brake: true, steer: 1 }, 1);
  const held = simulate(stopped, { brake: true, steer: 1 }, 1);
  near(held.heading, stopped.heading);
});

test('boost increases speed, releases to normal top speed, and steering is stable across frame rates', () => {
  const car = createVehicle({ x: 4, z: 100 });
  const normal = simulate(car, { throttle: 1 }, 2);
  const boosted = simulate(car, { throttle: 1, boost: true }, 2);
  near(normal.speed, 23);
  near(boosted.speed, 32);
  assert.ok(boosted.distance > normal.distance);
  const releasedBoost = simulate(boosted, { throttle: 1 }, 1);
  assert.ok(releasedBoost.speed <= 23.001);
  let at30 = car, at60 = car;
  for (let i = 0; i < 30; i += 1) at30 = stepVehicle(at30, { throttle: 1, steer: 0.2 }, 1 / 30, []);
  for (let i = 0; i < 60; i += 1) at60 = stepVehicle(at60, { throttle: 1, steer: 0.2 }, 1 / 60, []);
  near(at30.x, at60.x);
  near(at30.z, at60.z);
  near(at30.speed, at60.speed);
  near(at30.heading, at60.heading);
  let at144 = car;
  for (let i = 0; i < 144; i += 1) at144 = stepVehicle(at144, { throttle: 1, steer: 0.2 }, 1 / 144, []);
  assert.ok(Math.hypot(at30.x - at144.x, at30.z - at144.z) < 0.08);
});

test('walking starts on foot and camera-relative A/D moves directly sideways', () => {
  const initial = createPedestrian();
  assert.ok(initial.grounded && initial.speed === 0);
  const snapshot = structuredClone(initial);
  const right = walk(initial, { right: 1, cameraYaw: 0 }, 1);
  assert.deepEqual(initial, snapshot);
  assert.ok(right.x > initial.x + 4);
  near(right.z, initial.z);
  near(right.heading, Math.PI / 2, 0.001);
  const turnedCamera = walk(initial, { forward: 1, cameraYaw: Math.PI / 2 }, 1);
  near(turnedCamera.x, right.x);
  near(turnedCamera.z, right.z);
  const backwards = walk(initial, { forward: -1 }, 1);
  assert.ok(backwards.z > initial.z + 4);
  near(backwards.x, initial.x);
});

test('diagonals are normalized, running is faster, and release stops promptly', () => {
  const initial = createPedestrian();
  const straight = walk(initial, { forward: 1 }, 1);
  const diagonal = walk(initial, { forward: 1, right: 1 }, 1);
  near(diagonal.distance, straight.distance);
  near(diagonal.speed, straight.speed);
  const run = walk(initial, { forward: 1, sprint: true }, 1);
  assert.ok(run.distance > straight.distance * 1.7);
  assert.ok(run.speed <= 8);
  const stopped = walk(run, {}, 0.3);
  assert.equal(stopped.speed, 0);
  assert.ok(stopped.distance - run.distance < 0.3);
  const at30 = walk(initial, { forward: 1, right: -0.4, cameraYaw: 0.8, sprint: true }, 1, [], 30);
  const at60 = walk(initial, { forward: 1, right: -0.4, cameraYaw: 0.8, sprint: true }, 1, [], 60);
  near(at30.x, at60.x);
  near(at30.z, at60.z);
});

test('jump is ballistic, lands, and holding jump does not cause repeated hopping', () => {
  const initial = createPedestrian();
  const launched = stepPedestrian(initial, { jump: true, forward: 1 }, 0.1, []);
  assert.ok(launched.y > 0.6 && launched.verticalVelocity > 0 && !launched.grounded);
  const landed = walk(launched, { jump: true, forward: 1 }, 1);
  assert.ok(landed.grounded && landed.y === 0 && landed.verticalVelocity === 0);
  const stillHeld = walk(landed, { jump: true }, 1);
  assert.ok(stillHeld.grounded && stillHeld.y === 0);
  const released = stepPedestrian(landed, {}, 1 / 60, []);
  const jumpedAgain = stepPedestrian(released, { jump: true }, 1 / 60, []);
  assert.ok(jumpedAgain.y > 0 && !jumpedAgain.grounded);
});

test('swept movement stops at thin obstacles and reports only current-frame impact', () => {
  const wall = [{ x: 0, z: 0, w: 0.01, d: 80 }];
  const start = createVehicle({ x: -3, z: 0, heading: Math.PI / 2, speed: 32 });
  const hit = stepVehicle(start, { throttle: 1, boost: true }, 0.1, wall);
  assert.equal(hit.impact, true);
  assert.ok(hit.x <= -1.505 + 1e-8, 'car tunneled through a thin wall');
  assert.ok(hit.speed < start.speed);
  near(hit.distance, hit.x - start.x);
  const still = stepVehicle(hit, {}, 0, wall);
  assert.equal(still.impact, false);
  const backing = simulate(hit, { throttle: -1 }, 1, wall);
  assert.ok(backing.x < hit.x);
  const person = walk(createPedestrian({ x: -1, z: 0 }), { right: 1, sprint: true }, 1, wall);
  near(person.x, -0.455);
  assert.ok(person.impact);
});

test('building collisions allow sliding and people have smaller clearance than cars', () => {
  const block = [{ x: 0, z: 0, w: 10, d: 10 }];
  const car = stepVehicle(createVehicle({ x: -7, z: 0, heading: Math.PI / 2, speed: 12 }), { throttle: 1 }, 0.1, block);
  const foot = walk(createPedestrian({ x: -7, z: 0 }), { right: 1, sprint: true }, 1, block);
  near(car.x, -6.5);
  near(foot.x, -5.45);
  const slide = stepVehicle(createVehicle({ x: -6.5, z: 0, heading: Math.PI / 4, speed: 15 }), { throttle: 1 }, 0.1, block);
  near(slide.x, -6.5);
  assert.ok(slide.z < 0 && slide.impact);
  const footSlide = walk(createPedestrian({ x: -5.45, z: 0 }), { forward: 1, right: 1 }, 0.5, block);
  near(footSlide.x, -5.45);
  assert.ok(footSlide.z < -1 && footSlide.impact);
});

test('world boundaries and suspended frames cannot launch actors outside the city', () => {
  for (const heading of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const car = createVehicle({ x: Math.sin(heading) * 131, z: -Math.cos(heading) * 131, heading, speed: 32 });
    const next = stepVehicle(car, { throttle: 1, boost: true }, 0.1, []);
    assert.ok(Math.max(Math.abs(next.x), Math.abs(next.z)) <= WORLD_LIMIT - 1.5 + 1e-8);
    assert.equal(next.impact, true);
  }
  const start = createVehicle({ speed: 30 });
  assert.deepEqual(stepVehicle(start, { throttle: 1 }, 50, []), stepVehicle(start, { throttle: 1 }, 0.1, []));
  assert.deepEqual(stepVehicle(start, {}, -1, []), { ...start, impact: false });
  const malformed = stepVehicle({ x: NaN, z: Infinity, heading: NaN, speed: Infinity, distance: -9 }, { throttle: NaN, steer: Infinity }, NaN, []);
  assert.deepEqual(malformed, createVehicle());
  const foot = walk(createPedestrian({ x: 132.5, z: 0 }), { right: 1, sprint: true }, 1);
  near(foot.x, WORLD_LIMIT - 0.45);
  const startFoot = createPedestrian();
  assert.deepEqual(stepPedestrian(startFoot, { forward: 1 }, 50, []), stepPedestrian(startFoot, { forward: 1 }, 0.1, []));
  assert.deepEqual(stepPedestrian({ x: NaN, z: Infinity, vx: NaN }, {}, NaN, []), startFoot);
});

test('completion is sequential, idempotent and derives rewards without mutating state', () => {
  const initial = freshProgress();
  assert.deepEqual(completeMission(initial, MISSIONS[1].id), initial);
  assert.deepEqual(completeMission(initial, 'unknown'), initial);
  let progress = initial;
  for (const mission of MISSIONS) {
    const previous = structuredClone(progress);
    const next = completeMission(progress, mission.id);
    assert.deepEqual(progress, previous);
    assert.equal(next.money, progress.money + mission.reward);
    assert.deepEqual(completeMission(next, mission.id), next);
    progress = next;
  }
  assert.deepEqual(progress.completed, MISSIONS.map(mission => mission.id));
  assert.equal(progress.money, 500 + MISSIONS.reduce((total, mission) => total + mission.reward, 0));
  assert.deepEqual(initial, { version: 6, completed: [], money: 500, ledger: [], customizations: {},
    ownedVehicleIds: [], selectedOwnedId: null, ownedVehicleHealth: {} });
});

test('storage projects known progress, strips ephemeral data and preserves other games', () => {
  const storage = memoryStorage();
  const progress = { version: 1, completed: [MISSIONS[0].id, 'unknown', MISSIONS[0].id], money: 999999,
    activeMission: MISSIONS[1].id, phase: 'dropoff', x: 9, token: 'discard' };
  const expected = { ...freshProgress(), completed: [MISSIONS[0].id], money: 850 };
  assert.equal(saveProgress(storage, progress), true);
  assert.deepEqual(loadProgress(storage), expected);
  assert.deepEqual(JSON.parse(storage.entries.get(STORAGE_KEY)), expected);
  assert.equal(storage.entries.get('hedo-life-v3'), 'career untouched');
  assert.equal(storage.entries.get('hedo-island-v1'), 'island untouched');
  assert.deepEqual(sanitizeProgress({ version: 1, completed: [MISSIONS[2].id] }), freshProgress());
});

test('invalid records, unavailable storage and throwing accessors fail safely', () => {
  for (const value of [null, 1, [], 'progress', {}, { version: 5, completed: [] }, { version: 1, completed: null },
    Object.create({ version: 1, completed: [MISSIONS[0].id] }),
    Object.defineProperty({ version: 1 }, 'completed', { get() { throw new Error('broken accessor'); } })]) {
    assert.deepEqual(sanitizeProgress(value), freshProgress());
  }
  for (const raw of ['{bad json', '', 'null', '[]', 'false', '{"version":1,"completed":["__proto__","constructor"]}']) {
    assert.deepEqual(loadProgress({ getItem: () => raw }), freshProgress());
  }
  const failure = () => { throw new Error('storage denied'); };
  for (const storage of [null, undefined, {}, { getItem: failure, setItem: failure }, new Proxy({}, { get: failure })]) {
    assert.deepEqual(loadProgress(storage), freshProgress());
    assert.equal(saveProgress(storage, freshProgress()), false);
  }
  const a = freshProgress(), b = freshProgress();
  a.completed.push('changed');
  assert.deepEqual(b.completed, []);
});
