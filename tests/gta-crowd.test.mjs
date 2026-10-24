import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILDINGS, WORLD_LIMIT } from '../dist/gta/world.js';
import { CROWD_RULES, createCrowd, stepCrowd } from '../dist/gta/crowd.js';

const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const near = (a, b, epsilon = 1e-7) => assert.ok(Math.abs(a - b) <= epsilon, `${a} differs from ${b}`);
function freeze(value) {
  if (value && typeof value === 'object') { Object.freeze(value); for (const child of Object.values(value)) freeze(child); }
  return value;
}
function simulate(crowd, seconds, input = {}, fps = 60) {
  for (let i = 0; i < seconds * fps; i++) crowd = stepCrowd(crowd, 1 / fps, typeof input === 'function' ? input(i / fps, crowd) : input);
  return crowd;
}
function gunshot(person, overrides = {}) { return { id: 'shot-1', kind: 'gunshot', x: person.x, z: person.z + 4, radius: 20, remaining: 1, ...overrides }; }
function clearBuilding(person, radius = CROWD_RULES.radius) {
  return BUILDINGS.every(b => Math.abs(person.x - b.x) >= b.w / 2 + radius - 1e-7 || Math.abs(person.z - b.z) >= b.d / 2 + radius - 1e-7);
}
function clearProps(person) {
  return BUILDINGS.every(b => [-1, 1].every(side => {
    const planter = Math.abs(person.x - (b.x + side * 20.65)) >= .55 + CROWD_RULES.radius
      || Math.abs(person.z - (b.z + 14)) >= 1.1 + CROWD_RULES.radius;
    return planter && Math.hypot(person.x - (b.x + side * 20.7), person.z - (b.z - 14)) >= .3 + CROWD_RULES.radius;
  }));
}

test('crowd starts as twelve deterministic independent people on clear sidewalks', () => {
  const a = createCrowd(), b = createCrowd();
  assert.equal(a.length, 12); assert.equal(new Set(a.map(p => p.id)).size, 12); assert.deepEqual(a, b);
  assert.notEqual(a[0], b[0]); assert.notEqual(a[0].seenThreatIds, b[0].seenThreatIds);
  assert.ok(a.every(p => p.mode === 'walk' && p.speed > 0 && clearBuilding(p) && clearProps(p)));
  assert.ok(distance(a[0], { x: 7, z: 32 }) < 8, 'one visible pedestrian starts near the player');
});

test('step is immutable and zero, invalid or negative time freezes every timer and pose', () => {
  const original = freeze(createCrowd()), threat = freeze(gunshot(original[0]));
  const input = freeze({ threats: [threat], vehicles: [{ x: 4, z: 20, heading: 0, speed: 3 }], player: { x: 7, z: 32 } });
  const after = stepCrowd(original, 1 / 60, input);
  assert.notEqual(after, original); assert.notEqual(after[0], original[0]); assert.notEqual(after[0].seenThreatIds, original[0].seenThreatIds);
  assert.deepEqual(original, createCrowd()); assert.equal(after[0].mode, 'startled');
  for (const dt of [0, -1, NaN, Infinity]) assert.deepEqual(stepCrowd(after, dt, input), after);
});

test('only nearby live gunshots or collisions startle; expired, far and malformed events do not', () => {
  const crowd = createCrowd(), p = crowd[0];
  const nearShot = stepCrowd(crowd, .1, { threats: [gunshot(p, { radius: 8 })] });
  assert.equal(nearShot[0].mode, 'startled'); assert.equal(nearShot[0].speed, 0);
  assert.equal(nearShot.filter(person => person.mode === 'startled').length, 1);
  const collision = stepCrowd(crowd, .1, { threats: [gunshot(p, { id: 'crash', kind: 'collision', radius: 7 })] });
  assert.equal(collision[0].mode, 'startled');
  const ignored = [gunshot(p, { x: 120, z: -120, radius: 2 }), gunshot(p, { remaining: 0 }), gunshot(p, { kind: 'horn' }), gunshot(p, { x: NaN }), gunshot(p, { radius: Infinity })];
  assert.deepEqual(stepCrowd(crowd, .1, { threats: ignored }), stepCrowd(crowd, .1));
});

test('startle is brief, flight increases distance and heading matches actual travel', () => {
  const original = createCrowd(), threat = gunshot(original[0]);
  let crowd = stepCrowd(original, 1 / 60, { threats: [threat] });
  const stopped = crowd[0]; crowd = simulate(crowd, .2);
  assert.equal(crowd[0].mode, 'startled'); near(distance(crowd[0], stopped), 0);
  crowd = simulate(crowd, 1.5); const before = crowd[0];
  assert.equal(before.mode, 'flee'); assert.ok(before.speed > 4);
  assert.ok(distance(before, threat) > distance(original[0], threat) + 4);
  const after = stepCrowd(crowd, 1 / 60)[0], dx = after.x - before.x, dz = after.z - before.z;
  assert.ok(dx * Math.sin(after.heading) - dz * Math.cos(after.heading) > 0, 'facing agrees with displacement');
});

test('one persistent event cannot trap people in panic; new shots can alert them again', () => {
  const start = createCrowd(), threat = gunshot(start[0], { radius: 100 });
  const active = simulate(start, 2, { threats: [threat] }); assert.equal(active[0].mode, 'flee');
  const recovery = simulate(active, 4, { threats: [threat] }); assert.equal(recovery[0].mode, 'recover');
  const calm = simulate(recovery, 4, { threats: [threat] });
  assert.equal(calm[0].mode, 'walk'); near(calm[0].speed, calm[0].walkSpeed, .03);
  assert.ok(distance(calm[0], start[0]) > 10, 'recovery does not return people to their spawn');
  const again = stepCrowd(calm, 1 / 60, { threats: [gunshot(calm[0], { id: 'shot-new' })] });
  assert.equal(again[0].mode, 'startled'); assert.ok(again[0].panicRemaining > 5);
});

test('continuous fresh gunshots extend escape without repeatedly immobilizing fleeing people', () => {
  let crowd = createCrowd();
  crowd = simulate(crowd, 5, (time, current) => ({ threats: [gunshot(current[0], { id: `shot-${Math.floor(time * 5)}` })] }));
  assert.equal(crowd[0].mode, 'flee'); assert.ok(crowd[0].speed > 4); assert.ok(crowd[0].distance > 9);
  assert.ok(crowd[0].seenThreatIds.length <= CROWD_RULES.rememberedThreats);
  const calm = simulate(crowd, 10); assert.equal(calm[0].mode, 'walk');
});

test('all patrol and flee routes stay outside buildings, planters, lamps and world bounds without jumps', () => {
  let crowd = createCrowd();
  for (let frame = 0; frame < 60 * 130; frame++) {
    const before = crowd;
    const threats = frame % 300 === 0 ? before.slice(0, 8).map((p, i) => gunshot(p, { id: `shot-${frame}-${i}`, radius: 100 })) : [];
    crowd = stepCrowd(crowd, 1 / 60, { threats });
    for (let i = 0; i < crowd.length; i++) {
      const person = crowd[i];
      assert.ok(clearBuilding(person), `${person.id} crossed a building`);
      assert.ok(clearProps(person), `${person.id} crossed a planter/lamp`);
      assert.ok(Math.max(Math.abs(person.x), Math.abs(person.z)) < WORLD_LIMIT - CROWD_RULES.radius);
      assert.ok(distance(person, before[i]) <= 5.21 / 60 + 1e-7, 'path wrap or turn must not teleport');
      assert.ok(['x', 'z', 'speed', 'heading', 'phase'].every(key => Number.isFinite(person[key])));
    }
  }
});

test('pedestrians reverse around a parked vehicle and continue instead of running into it', () => {
  const crowd = createCrowd(), p = crowd[0];
  const vehicle = { x: p.x, z: p.z - 4, heading: 0, speed: 0 };
  const after = simulate(crowd, 5, { vehicles: [vehicle] });
  assert.ok(after[0].z > p.z + 2, 'pedestrian goes away from the blocked forward route');
  assert.ok(distance(after[0], vehicle) > distance(p, vehicle));
  assert.ok(after[0].speed > .5, 'pedestrian is not stuck stopped at the obstacle');
  assert.ok(clearBuilding(after[0]) && clearProps(after[0]));
});

test('close player and approaching vehicle cause avoidance, while distant traffic leaves patrol unchanged', () => {
  const crowd = createCrowd(), p = crowd[0];
  const player = { x: p.x, z: p.z - 2 };
  const avoided = simulate(crowd, 3, { player }); assert.ok(avoided[0].z > p.z + 1);
  const car = { x: p.x, z: p.z - 9, heading: Math.PI, speed: 10 };
  const reacting = simulate(crowd, 1, { vehicles: [car] }); assert.ok(reacting[0].z > p.z, 'swept vehicle position is anticipated');
  const plain = simulate(crowd, 2), distant = simulate(crowd, 2, { vehicles: [{ x: 130, z: 130, speed: 20, heading: 0 }], player: { x: -130, z: -130 } });
  assert.deepEqual(distant, plain);
});

test('overlapping blockers allow safe outward escape and do not push people through walls', () => {
  const crowd = createCrowd(), p = crowd[0], vehicle = { x: p.x, z: p.z - .5, heading: 0, speed: 0 };
  const after = simulate(crowd, 4, { vehicles: [vehicle] });
  assert.ok(distance(after[0], vehicle) > 3); assert.ok(clearBuilding(after[0]) && clearProps(after[0]));
});

test('30 and 60 Hz updates agree through startle, rounded corners, flight and recovery', () => {
  const initial = createCrowd(), threat = gunshot(initial[0], { radius: 90 });
  const inputs = time => ({ threats: time < .5 ? [threat] : [] });
  const slow = simulate(initial, 16, inputs, 30), fast = simulate(initial, 16, inputs, 60);
  for (let i = 0; i < slow.length; i++) {
    assert.equal(slow[i].mode, fast[i].mode); assert.equal(slow[i].direction, fast[i].direction);
    for (const key of ['x', 'z', 'heading', 'speed', 'phase', 'distance']) near(slow[i][key], fast[i][key], 1e-6);
  }
});

test('30 and 60 Hz avoidance agrees and invalid environmental coordinates stay harmless', () => {
  const initial = createCrowd(), p = initial[0], input = { vehicles: [{ x: p.x, z: p.z - 4, heading: 0, speed: 0 }, { x: NaN, z: 0 }], player: { x: Infinity, z: 0 } };
  const slow = simulate(initial, 8, input, 30), fast = simulate(initial, 8, input, 60);
  for (let i = 0; i < slow.length; i++) for (const key of ['x', 'z', 'heading', 'speed']) near(slow[i][key], fast[i][key], 1e-6);
});


test('a blocked sidewalk stops feet safely and movement resumes when the obstruction leaves', () => {
  const initial = createCrowd(), p = initial[0];
  const cars = [-3, 3].map(offset => ({ x: p.x, z: p.z + offset, heading: 0, speed: 0 }));
  let crowd = initial;
  for (let i = 0; i < 60 * 3; i++) {
    crowd = stepCrowd(crowd, 1 / 60, { vehicles: cars });
    assert.ok(cars.every(car => Math.abs(crowd[0].x - car.x) >= 1.5 - 1e-7 || Math.abs(crowd[0].z - car.z) >= 2.6 - 1e-7));
    assert.ok(clearBuilding(crowd[0]) && clearProps(crowd[0]));
  }
  assert.ok(crowd[0].speed < .01, 'blocked pedestrian stops instead of animating a run into the car');
  const stopped = crowd[0], released = simulate(crowd, 3);
  assert.ok(distance(released[0], stopped) > 2.5); assert.ok(released[0].speed > 1);
});
