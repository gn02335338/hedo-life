import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILDINGS } from '../dist/gta/world.js';
import { POLICE_RULES, createPoliceState, reportCrime, stepPolice, segmentClear, canSeePlayer } from '../dist/gta/police.js';
import { createFleet, stepFleet, takeCar } from '../dist/gta/fleet.js';

const near = (actual, expected, epsilon = 1e-7) => assert.ok(Math.abs(actual - expected) < epsilon, `${actual} differs from ${expected}`);
function simulate(state, input, seconds, fps = 60) {
  for (let frame = 0; frame < seconds * fps; frame += 1) state = stepPolice(state, input, 1 / fps);
  return state;
}
function patrol(overrides = {}) {
  return {
    id: 'police-1', name: '巡邏警車', kind: 'police', color: 0xe4e9ef,
    x: 0, z: 0, heading: 0, speed: 0, occupied: true, stolen: false,
    siren: true, visible: false, ordinal: 0,
    route: [{ x: 0, z: -20 }], target: { x: 0, z: -20 }, repathIn: 0.45, searchIndex: -1,
    ...overrides,
  };
}
function active(overrides = {}) {
  return { ...createPoliceState(), level: 1, phase: 'pursuit', lastKnown: { x: 0, z: -20 }, units: [patrol()], ...overrides };
}

test('crime reports raise bounded wanted levels and reset escape without mutating state', () => {
  const clean = createPoliceState(), snapshot = structuredClone(clean);
  const theft = reportCrime(clean, { type: 'theft', position: { x: 4, z: 20 } });
  assert.deepEqual(clean, snapshot);
  assert.equal(theft.level, 1);
  assert.equal(theft.phase, 'dispatch');
  assert.equal(theft.dispatchRemaining, POLICE_RULES.dispatchSeconds);
  assert.deepEqual(theft.lastKnown, { x: 4, z: 20 });
  const collision = reportCrime(theft, { type: 'collision', position: { x: 0, z: 15 } });
  assert.equal(collision.level, 2);
  const policeCrash = reportCrime(collision, { type: 'police-collision', position: { x: 0, z: 10 } });
  assert.equal(policeCrash.level, 4);
  const high = reportCrime(policeCrash, { type: 'police-collision' });
  assert.equal(high.level, 5);
  assert.equal(reportCrime(high, { type: 'theft' }).level, 5);
  assert.deepEqual(reportCrime(high, { type: 'unknown' }), high);
  const searched = { ...active(), phase: 'search', searchTime: 10, unseenTime: 11.5, escapeProgress: 0.8, arrestProgress: 0.4 };
  const reported = reportCrime(searched, { type: 'collision', position: { x: 0, z: 8 } });
  assert.equal(reported.phase, 'pursuit');
  assert.equal(reported.searchTime, 0);
  assert.equal(reported.arrestProgress, 0);
  assert.ok(reported.units.every(unit => unit.siren));
});

test('dispatch produces at most four distinct distant road units and no close teleports', () => {
  const wanted = reportCrime(createPoliceState(), { type: 'theft', position: { x: 4, z: 20 } });
  const input = { player: { x: 4, z: 20, speed: 10 }, walking: false };
  const waiting = simulate(wanted, input, 2);
  assert.equal(waiting.units.length, 0);
  assert.equal(waiting.phase, 'dispatch');
  const arrived = simulate(waiting, input, 0.2);
  assert.equal(arrived.units.length, 1);
  assert.ok(Math.hypot(arrived.units[0].x - 4, arrived.units[0].z - 20) >= POLICE_RULES.spawnMinDistance);
  assert.ok(segmentClear(arrived.units[0], arrived.units[0], BUILDINGS, 1.65));
  let high = reportCrime(wanted, { type: 'police-collision' });
  high = reportCrime(high, { type: 'police-collision' });
  const dispatched = simulate(high, input, 7);
  assert.equal(dispatched.units.length, 4);
  assert.deepEqual(dispatched.units.map(unit => unit.id), ['police-1', 'police-2', 'police-3', 'police-4']);
  assert.ok(dispatched.units.every(unit => unit.kind === 'police' && unit.occupied));
});

test('sight respects both distance and actual building occlusion', () => {
  assert.equal(canSeePlayer({ x: 0, z: 0 }, { x: 0, z: -47 }), true);
  assert.equal(canSeePlayer({ x: 0, z: 0 }, { x: 0, z: -49 }), false);
  assert.equal(canSeePlayer({ x: 8, z: 20 }, { x: 52, z: 20 }), false);
  assert.equal(canSeePlayer({ x: 8, z: 20 }, { x: 52, z: 20 }, []), true);
  assert.equal(segmentClear({ x: 0, z: 0 }, { x: 60, z: 0 }, BUILDINGS, 1.65), true);
  assert.equal(segmentClear({ x: 0, z: 30 }, { x: 60, z: 30 }, BUILDINGS, 1.65), false);
  assert.equal(segmentClear({ x: 30, z: 30 }, { x: 30, z: 30 }), false);
});

test('visible pursuit never loses wanted stars even after a long chase', () => {
  const initial = active({ level: 3 });
  const input = { player: { x: 0, z: -20, speed: 12 }, obstacles: [], traffic: [{ id: 'blocker', x: 0, z: -4.8 }] };
  const after = simulate(initial, input, 45);
  assert.equal(after.level, 3);
  assert.equal(after.phase, 'pursuit');
  assert.equal(after.seen, true);
  assert.equal(after.unseenTime, 0);
  assert.equal(after.searchTime, 0);
  assert.equal(after.escapeProgress, 0);
  assert.equal(after.arrestProgress, 0);
});

test('breaking sight starts search, while reacquisition resets its countdown', () => {
  const unit = patrol({ x: 8, z: 20, route: [{ x: 8, z: -20 }], target: { x: 8, z: -20 } });
  const initial = active({ lastKnown: { x: 8, z: -20 }, units: [unit] });
  const hiddenInput = { player: { x: 52, z: 20, speed: 10 } };
  const searched = simulate(initial, hiddenInput, 7);
  assert.equal(searched.phase, 'search');
  assert.equal(searched.level, 1);
  assert.ok(searched.searchTime > 5 && searched.escapeProgress > 0.4);
  assert.deepEqual(searched.lastKnown, initial.lastKnown);
  assert.ok(searched.units.every(unit => !unit.siren));
  const car = searched.units[0];
  const reacquired = stepPolice(searched, { player: { x: car.x, z: car.z - 6, speed: 10 }, obstacles: [] }, 1 / 60);
  assert.equal(reacquired.phase, 'pursuit');
  assert.equal(reacquired.seen, true);
  assert.equal(reacquired.unseenTime, 0);
  assert.equal(reacquired.searchTime, 0);
  assert.equal(reacquired.escapeProgress, 0);
  near(reacquired.searchRemaining, POLICE_RULES.searchSeconds);
});

test('hidden-player coordinates do not change search targets or navigation', () => {
  const initial = active({ phase: 'search', unseenTime: 3, searchTime: 1.5, lastKnown: { x: 4, z: 20 },
    units: [patrol({ x: 0, z: 60, route: [{ x: 4, z: 20 }], target: { x: 4, z: 20 } })] });
  const left = simulate(initial, { player: { x: -120, z: -120, speed: 10 } }, 8);
  const right = simulate(initial, { player: { x: 120, z: -120, speed: 10 } }, 8);
  assert.deepEqual(left, right, 'unseen position must not leak into search routing');
  assert.deepEqual(left.lastKnown, initial.lastKnown);
  assert.ok(left.units[0].searchIndex >= 0, 'patrol should reach last known position and check nearby roads');
});

test('all stars clear only after uninterrupted unseen search intervals', () => {
  const initial = active({ level: 5, lastKnown: { x: 4, z: 20 },
    units: [patrol({ x: 0, z: 60, route: [{ x: 4, z: 20 }], target: { x: 4, z: 20 } })] });
  const input = { player: { x: 120, z: -120, speed: 20 } };
  const almost = simulate(initial, input, 13);
  assert.equal(almost.level, 5);
  assert.equal(almost.phase, 'search');
  const first = simulate(almost, input, 1);
  assert.equal(first.level, 4);
  const second = simulate(first, input, 6);
  assert.equal(second.level, 3);
  const cleared = simulate(second, input, 18);
  assert.equal(cleared.level, 0);
  assert.equal(cleared.phase, 'clear');
  assert.equal(cleared.units.length, 0);
  assert.equal(cleared.arrestProgress, 0);
});

test('arrest requires sustained close slow contact and resets when the player drives away', () => {
  const initial = active({ lastKnown: { x: 0, z: -3 }, units: [patrol({ route: [{ x: 0, z: -3 }], target: { x: 0, z: -3 } })] });
  const stopped = { player: { x: 0, z: -3, speed: 0 }, walking: true, obstacles: [] };
  const buildup = simulate(initial, stopped, 2);
  assert.equal(buildup.phase, 'pursuit');
  assert.ok(buildup.arrestProgress > 0.6 && buildup.arrestProgress < 0.7);
  const driveBy = simulate(buildup, { ...stopped, player: { ...stopped.player, speed: 10 } }, 0.1);
  assert.equal(driveBy.arrestProgress, 0);
  const far = stepPolice(buildup, { ...stopped, player: { x: 0, z: -20, speed: 0 } }, 1 / 60);
  assert.equal(far.arrestProgress, 0);
  const busted = simulate(initial, stopped, 3.3);
  assert.equal(busted.phase, 'busted');
  assert.equal(busted.arrestProgress, 1);
  assert.ok(busted.units.every(unit => unit.speed === 0 && !unit.siren));
  assert.deepEqual(stepPolice(busted, stopped, 0.1), busted);
  assert.deepEqual(reportCrime(busted, { type: 'theft' }), busted);
});

test('police routes approach a suspect around blocks without clipping buildings or traffic', () => {
  let state = reportCrime(createPoliceState(), { type: 'theft', position: { x: 64, z: -80 } });
  state = reportCrime(state, { type: 'police-collision' });
  state = reportCrime(state, { type: 'police-collision' });
  const input = { player: { x: 64, z: -80, speed: 10 } };
  let seen = false, cornerRoute = false;
  for (let frame = 0; frame < 600; frame += 1) {
    state = stepPolice(state, input, 0.1);
    seen ||= state.seen;
    cornerRoute ||= state.units.some(unit => unit.route.length > 3);
    for (const unit of state.units) assert.ok(segmentClear(unit, unit, BUILDINGS, 1.65), `${unit.id} clipped a building at ${unit.x},${unit.z}`);
  }
  assert.ok(seen && cornerRoute);
  assert.equal(state.level, 5);
  assert.ok(state.units.some(unit => Math.hypot(unit.x - input.player.x, unit.z - input.player.z) < 8));
  const blocker = { id: 'parked', x: 0, z: -10 };
  let bypass = active();
  for (let frame = 0; frame < 600; frame += 1) {
    bypass = stepPolice(bypass, { player: { x: 0, z: -30, speed: 10 }, traffic: [blocker], obstacles: [] }, 1 / 60);
    const unit = bypass.units[0];
    assert.ok(Math.abs(unit.x - blocker.x) >= 3 - 1e-7 || Math.abs(unit.z - blocker.z) >= 4.1 - 1e-7,
      'police must drive around, not through, a stationary vehicle');
  }
  assert.ok(bypass.units[0].z < -10, 'a blocked patrol should find a way around the queue');
});

test('the real starter traffic queue cannot prevent a nearby stationary suspect from being caught', () => {
  const player = { x: 4, z: 20, speed: 0 };
  let fleet = takeCar(createFleet(), 'starter-sedan');
  let state = reportCrime(createPoliceState(), { type: 'theft', position: player });
  for (let frame = 0; frame < 22 * 60 && state.phase !== 'busted'; frame += 1) {
    fleet = stepFleet([...fleet, ...state.units], 1 / 60, { controlledId: 'starter-sedan' }).filter(car => car.kind !== 'police');
    state = stepPolice(state, { player, traffic: fleet }, 1 / 60);
    for (const unit of state.units) assert.ok(segmentClear(unit, unit, BUILDINGS, 1.65));
  }
  assert.equal(state.phase, 'busted');
  assert.equal(state.arrestProgress, 1);
});

test('police approach suspects at building edges instead of stopping at the road centre', () => {
  for (const walking of [false, true]) {
    const player = { x: walking ? 9.5 : 8.5, z: 14.211, speed: 0 };
    let state = reportCrime(createPoliceState(), { type: 'theft', position: player });
    state = reportCrime(state, { type: 'collision', position: player });
    state = simulate(state, { player, walking }, 22);
    assert.equal(state.phase, 'busted', walking ? 'person beside a wall' : 'car stopped at a wall');
    assert.ok(state.units.every(unit => segmentClear(unit, unit, BUILDINGS, 1.65)));
  }
});

test('zero time is a no-op, inputs remain pure, and frame rates produce stable simulation', () => {
  const state = reportCrime(createPoliceState(), { type: 'theft', position: { x: 4, z: 20 } });
  const input = { player: { x: 4, z: -20, speed: 10 } };
  const snapshot = structuredClone(state), inputSnapshot = structuredClone(input);
  assert.deepEqual(stepPolice(state, input, 0), state);
  assert.deepEqual(stepPolice(state, input, -1), state);
  assert.deepEqual(stepPolice(state, input, 999), stepPolice(state, input, 0.1));
  const at30 = simulate(state, input, 8, 30), at60 = simulate(state, input, 8, 60);
  assert.deepEqual(at30, at60);
  assert.deepEqual(state, snapshot);
  assert.deepEqual(input, inputSnapshot);
  assert.deepEqual(stepPolice(createPoliceState(), input, 0.1), createPoliceState());
});

test('gunfire and officer hits escalate reports while disabled units lose sight and arrest powers', () => {
  const gunfire = reportCrime(createPoliceState(), { type: 'gunfire', position: { x: 0, z: 0 } });
  assert.equal(gunfire.level, 2);
  assert.equal(reportCrime(gunfire, { type: 'police-hit' }).level, 3);
  const initial = active({ dispatchRemaining: 100, lastKnown: { x: 0, z: -3 } });
  const input = { player: { x: 0, z: -3, speed: 0 }, walking: true, obstacles: [], disabledUnitIds: ['police-1'] };
  const down = simulate(initial, input, 5);
  assert.equal(down.seen, false);
  assert.equal(down.phase, 'search');
  assert.equal(down.arrestProgress, 0);
  assert.equal(down.units[0].disabled, true);
  assert.equal(down.units[0].siren, false);
  assert.equal(canSeePlayer(down.units[0], input.player, []), false);
  near(down.units[0].x, initial.units[0].x);
  near(down.units[0].z, initial.units[0].z);
  const removed = simulate(down, input, 3.2);
  assert.equal(removed.units.length, 0);
});

test('armed-response patrols stop at firing range and do not also build arrest progress', () => {
  const initial = active({ lastKnown: { x: 0, z: 0 }, units: [patrol({ z: 40, target: { x: 0, z: 0 }, route: [{ x: 0, z: 0 }] })] });
  const context = { player: { x: 0, z: 0, speed: 0 }, walking: true, obstacles: [], armedHostile: true };
  const stopped = simulate(initial, context, 10);
  assert.equal(stopped.phase, 'pursuit');
  assert.equal(stopped.arrestProgress, 0);
  near(stopped.units[0].z, POLICE_RULES.armedStandoffDistance);
  assert.equal(stopped.units[0].speed, 0);
});

test('replacement police IDs stay unique while active and retained patrol counts remain bounded', () => {
  let state = reportCrime(createPoliceState(), { type: 'gunfire', position: { x: 4, z: 20 } });
  state = reportCrime(state, { type: 'gunfire' });
  state = reportCrime(state, { type: 'police-hit' });
  const context = { player: { x: 4, z: 20, speed: 10 }, armedHostile: true };
  state = simulate(state, context, 7);
  const allIds = new Set(state.units.map(unit => unit.id));
  let largestId = Math.max(...state.units.map(unit => Number(unit.id.split('-').at(-1))));
  for (let frame = 0; frame < 14 * 60; frame += 1) {
    const previousIds = new Set(state.units.map(unit => unit.id));
    state = stepPolice(state, { ...context, disabledUnitIds: state.units.map(unit => unit.id) }, 1 / 60);
    assert.ok(state.units.length <= POLICE_RULES.maxRetainedUnits);
    assert.ok(state.units.filter(unit => !unit.disabled).length <= 4);
    assert.equal(new Set(state.units.map(unit => unit.id)).size, state.units.length);
    for (const unit of state.units) if (!previousIds.has(unit.id)) {
      assert.equal(allIds.has(unit.id), false, 'a cleaned-up officer identity was reused');
      const serial = Number(unit.id.split('-').at(-1));
      assert.ok(serial > largestId);
      largestId = serial; allIds.add(unit.id);
    }
  }
  assert.ok(allIds.size >= 10);
});
