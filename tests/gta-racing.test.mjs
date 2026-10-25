import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILDINGS, MISSIONS, LOCATIONS } from '../dist/gta/world.js';
import { createVehicle, stepVehicle } from '../dist/gta/driving.js';
import { sanitizeProgress, saveProgress, loadProgress, STORAGE_KEY } from '../dist/gta/progress.js';
import { createOwnedVehicle } from '../dist/gta/ownership.js';
import { applyGarageAction, GARAGE_RULES } from '../dist/gta/garage.js';
import { RACE_CATALOG, RACING_RULES, validRaceReceipt } from '../dist/gta/racing-catalog.js';
import { createRaceState, raceEligibility, startRace, stepRace, cancelRace, settleRace } from '../dist/gta/racing.js';
import { segmentClear } from '../dist/gta/police.js';

const buy = { id: 'buy', kind: 'purchase', vehicleId: 'owned-hatch', missionCount: 0 };
const ownedProgress = (completed = []) => sanitizeProgress({ version: 4, completed, ledger: [buy] });
const initialCar = progress => createOwnedVehicle(progress, 'owned-hatch', { x: -30, z: 60, heading: Math.PI / 2 });
const context = (car, overrides = {}) => ({ player: car, vehicle: car, controlledId: car.id, walking: false,
  wantedLevel: 0, transition: null, dead: false, busted: false, traffic: [], pedestrians: [], ...overrides });
function ready(raceId = 'first-sprint', overrides = {}, runId = 'run', progress = ownedProgress()) {
  const car = initialCar(progress), input = context(car, overrides);
  const result = startRace(progress, raceId, runId, input);
  assert.equal(result.ok, true, result.message);
  let state = result.state;
  for (let n = 0; n < 180; n += 1) state = stepRace(state, input, 1 / 60);
  assert.equal(state.phase, 'racing'); assert.equal(state.elapsed, 0);
  return { progress, car, input, state };
}
function straight(progress = ownedProgress(), hz = 60, runId = 'straight') {
  const car = initialCar(progress);
  let actor = createVehicle(car), state = startRace(progress, 'first-sprint', runId, context(car)).state;
  for (let n = 0; n < hz * 30 && ['countdown', 'racing'].includes(state.phase); n += 1) {
    if (state.phase === 'racing') actor = stepVehicle(actor, { throttle: 1, tuning: car.upgrades }, 1 / hz);
    const vehicle = { ...car, ...actor };
    state = stepRace(state, context(vehicle), 1 / hz);
  }
  return state;
}
function followRoute(raceId, overrides = {}) {
  const fixture = ready(raceId), race = RACE_CATALOG.find(item => item.id === raceId);
  let { state, car } = fixture;
  state = { ...state, ...overrides };
  for (const target of race.route.slice(1)) {
    while (Math.hypot(target.x - car.x, target.z - car.z) > 1e-6 && state.phase === 'racing') {
      const gap = Math.hypot(target.x - car.x, target.z - car.z), amount = Math.min(gap, 20 / 60);
      car = { ...car, x: car.x + (target.x - car.x) / gap * amount, z: car.z + (target.z - car.z) / gap * amount, speed: 20 };
      state = stepRace(state, context(car), 1 / 60);
    }
  }
  return { ...fixture, state };
}
const footprint = car => ({ x: car.x, z: car.z,
  w: Math.abs(Math.cos(car.heading)) * 2.05 + Math.abs(Math.sin(car.heading)) * 4.15,
  d: Math.abs(Math.sin(car.heading)) * 2.05 + Math.abs(Math.cos(car.heading)) * 4.15 });
const intersects = (a, b) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.z - b.z) < (a.d + b.d) / 2;
const receipt = (id = 'prize', extras = {}) => ({ id, kind: 'race', vehicleId: 'owned-hatch', raceId: 'first-sprint',
  elapsedMs: 8000, checkpointTimes: [2000, 5000, 8000], rank: 1, missionCount: 0, ...extras });

test('three bounded routes follow legal streets and branded opponents have safe, distinct starting spaces', () => {
  assert.equal(RACE_CATALOG.length, 3);
  for (const race of RACE_CATALOG) {
    assert.deepEqual([race.start.x, race.start.z], [-30, 60]);
    assert.ok(race.route.length <= 14); assert.ok(race.rivalSpeeds.length <= RACING_RULES.maxRivals);
    for (let index = 1; index < race.route.length; index += 1) {
      const a = race.route[index - 1], b = race.route[index];
      assert.ok(a.x === b.x && a.x % 60 === 0 || a.z === b.z && a.z % 60 === 0);
      assert.ok(segmentClear(a, b, BUILDINGS, 2.7));
    }
    const car = initialCar(ownedProgress()), before = structuredClone(car);
    const state = startRace(ownedProgress(), race.id, 'grid', context(car)).state;
    assert.deepEqual(car, before);
    assert.equal(state.rivals.length, race.rivalSpeeds.length);
    for (const rival of state.rivals) {
      assert.equal(rival.kind, 'racer'); assert.equal(rival.owned, false); assert.equal(rival.vehicleHealth, 100);
      assert.ok(!intersects(footprint(rival), footprint(car)));
      assert.ok(!BUILDINGS.some(building => intersects(footprint(rival), building)));
      assert.ok(rival.path.length <= 100);
    }
    assert.equal(new Set(state.rivals.map(rival => rival.id)).size, state.rivals.length);
  }
  assert.deepEqual(RACE_CATALOG[1].rivalDrivers.map(driver => driver.variant), ['bmw-executive', 'tesla-model-y']);
  assert.deepEqual(RACE_CATALOG[2].rivalDrivers.map(driver => driver.variant), ['maserati-gt', 'bmw-executive']);
});

test('registration requires the purchased car, valid health, parked at the start and no pursuit or transition', () => {
  const progress = ownedProgress(), car = initialCar(progress), normal = context(car);
  const cases = [
    [{ walking: true }, 'vehicle'], [{ controlledId: 'borrowed' }, 'vehicle'], [{ vehicle: { ...car, owned: false } }, 'vehicle'],
    [{ wantedLevel: 1 }, 'wanted'], [{ dead: true }, 'dead'], [{ busted: true }, 'busted'], [{ transition: {} }, 'busy'],
    [{ player: { ...car, speed: 1.01 } }, 'moving'], [{ vehicle: { ...car, speed: -2 } }, 'moving'],
    [{ player: { ...car, x: -38 } }, 'distance'], [{ vehicle: { ...car, z: 68 } }, 'distance'],
    [{ vehicle: { ...car, vehicleHealth: 0 } }, 'vehicle-destroyed'], [{ vehicle: { ...car, damageStage: 'burning' } }, 'vehicle-destroyed'],
  ];
  for (const [overrides, reason] of cases) assert.equal(raceEligibility(progress, 'first-sprint', { ...normal, ...overrides }).reason, reason);
  assert.equal(raceEligibility(sanitizeProgress({ version: 1, completed: [] }), 'first-sprint', normal).reason, 'vehicle');
  assert.equal(raceEligibility(progress, 'unknown', normal).reason, 'race');
  assert.equal(raceEligibility(progress, 'first-sprint', context({ ...car, heading: -Math.PI / 2 })).ok, true, 'heading is a helpful UI hint, not an invisible entry restriction');
});

test('occupied rival grids reject registration without moving people, police or existing traffic', () => {
  const progress = ownedProgress(), car = initialCar(progress);
  const blocked = { id: 'blocker', x: -36, z: 57.6, heading: Math.PI / 2, speed: 0 };
  for (const overrides of [{ traffic: [blocked] }, { policeUnits: [{ ...blocked, kind: 'police' }] },
    { pedestrians: [{ x: blocked.x, z: blocked.z }] }, { obstacles: [{ x: blocked.x, z: blocked.z, w: 3, d: 4 }] },
    { player: { ...car, x: -36 }, vehicle: { ...car, x: -36 } }]) {
    const input = context(car, overrides), before = structuredClone(input);
    assert.equal(startRace(progress, 'block-sprint', 'blocked', input).reason, 'blocked');
    assert.deepEqual(input, before);
  }
});

test('countdown, pause and terminal states do not leak time or mutate their input', () => {
  const progress = ownedProgress(), car = initialCar(progress), input = context(car);
  let state = startRace(progress, 'block-sprint', 'paused', input).state;
  const before = structuredClone(state);
  assert.equal(stepRace(state, { ...input, dead: true }, 0), state);
  assert.equal(stepRace(state, input, NaN), state);
  for (let n = 0; n < 120; n += 1) state = stepRace(state, input, 1 / 60);
  assert.ok(Math.abs(state.countdownRemaining - 1) < 1e-8); assert.equal(state.elapsed, 0);
  assert.deepEqual(state.rivals.map(car => [car.x, car.z]), before.rivals.map(car => [car.x, car.z]));
  assert.deepEqual(startRace(progress, 'block-sprint', 'paused', input).state, before);
  state = cancelRace(state);
  assert.equal(state.phase, 'cancelled'); assert.equal(state.result.reward, 0);
  const terminal = stepRace(state, input, .1);
  assert.equal(terminal.elapsed, state.elapsed); assert.equal(terminal.events.length, 0);
  assert.equal(stepRace(terminal, input, .1), terminal);
  assert.equal(createRaceState().phase, 'idle');
});

test('actual stock driving earns a legal prize, engine upgrades improve the same route and frame rate does not change results', () => {
  const stock = [30, 60, 120].map(hz => straight(ownedProgress(), hz));
  for (const state of stock) {
    assert.equal(state.phase, 'finished'); assert.ok(state.elapsed < 12);
    assert.equal(validRaceReceipt(state.result.receipt), true);
    assert.equal(settleRace(ownedProgress(), state).progress.money, 390);
    assert.deepEqual(state.checkpointTimes, stock[0].checkpointTimes);
  }
  let progress = ownedProgress(MISSIONS.map(mission => mission.id)), car = initialCar(progress);
  const bay = LOCATIONS.find(place => place.id === 'garage');
  for (let level = 1; level <= 2; level += 1) {
    car = { ...car, x: bay.x, z: bay.z };
    const result = applyGarageAction(progress, car, { id: `engine-${level}`, kind: 'upgrade', value: 'engine' }, context(car));
    assert.equal(result.ok, true); progress = result.progress; car = result.vehicle;
  }
  const tuned = straight(progress);
  assert.equal(tuned.phase, 'finished'); assert.equal(validRaceReceipt(tuned.result.receipt), true);
  assert.ok(tuned.elapsed < stock[0].elapsed - .8);
  assert.equal(initialCar(progress).upgrades.engine, 2);
});

test('both rivals finish every route without clipping buildings or permanently stalling at corners', () => {
  for (const race of RACE_CATALOG.slice(1)) {
    let { state, car } = ready(race.id);
    car = { ...car, z: 67 }; state = { ...state, lastPlayer: { x: car.x, z: car.z } };
    const before = structuredClone(state);
    for (let n = 0; n < race.timeLimit * 60 && !state.rivals.every(car => car.finished); n += 1) {
      const previous = state;
      state = stepRace(state, context(car), 1 / 60);
      for (const rival of state.rivals) {
        assert.ok(!BUILDINGS.some(building => intersects(footprint(rival), building)), `${race.id} clipped at ${rival.x},${rival.z}`);
        const old = previous.rivals.find(item => item.id === rival.id);
        assert.ok(Math.hypot(rival.x - old.x, rival.z - old.z) <= 20 / 60 + 1e-6, 'rival never teleports');
      }
    }
    assert.equal(state.phase, 'racing');
    assert.ok(state.rivals.every(car => car.finished && car.checkpointIndex === race.checkpoints.length && car.progress === 1 && car.finishTime < race.timeLimit));
    assert.deepEqual(before.rivals.map(car => car.pathIndex), [1, 1]);
  }
});

test('rivals brake for stopped traffic and pedestrians, recover when clear, and retain authoritative destruction', () => {
  let { state, car } = ready('block-sprint');
  car = { ...car, z: 67 }; state = { ...state, lastPlayer: { x: car.x, z: car.z } };
  const blocker = { id: 'stopped', x: 5, z: 57.6, speed: 0, heading: Math.PI / 2 };
  for (let n = 0; n < 600; n += 1) state = stepRace(state, context(car, { traffic: [blocker] }), 1 / 60);
  const first = state.rivals[0];
  assert.ok(first.x < blocker.x - 4.4); assert.ok(first.speed < .1);
  assert.ok(!intersects(footprint(first), footprint(blocker)));
  for (let n = 0; n < 180; n += 1) state = stepRace(state, context(car), 1 / 60);
  assert.ok(state.rivals[0].x > blocker.x + 10); assert.ok(state.rivals[0].speed > 5);
  state = { ...state, rivals: state.rivals.map((rival, index) => index ? rival : { ...rival, vehicleHealth: 0, damageStage: 'burning', burnRemaining: 2.8 }) };
  const burned = state.rivals[0];
  const after = stepRace(state, context(car), .1).rivals[0];
  assert.equal(after.x, burned.x); assert.equal(after.z, burned.z); assert.equal(after.speed, 0);
  assert.equal(after.burnRemaining, 2.8); assert.equal(after.damageStage, 'burning');
  let pedestrians = ready('block-sprint');
  car = { ...pedestrians.car, z: 67 }; state = { ...pedestrians.state, lastPlayer: { x: car.x, z: car.z } };
  for (let n = 0; n < 360; n += 1) state = stepRace(state, context(car, { pedestrians: [{ x: 0, z: 57.6 }] }), 1 / 60);
  assert.ok(state.rivals[0].x < -3); assert.ok(state.rivals[0].speed < .1);
});

test('rival simulation gives the same progress at 30, 60 and 120 Hz', () => {
  const samples = [30, 60, 120].map(hz => {
    let { state, car } = ready('city-loop');
    car = { ...car, z: 67 }; state = { ...state, lastPlayer: { x: car.x, z: car.z } };
    for (let n = 0; n < hz * 20; n += 1) state = stepRace(state, context(car), 1 / hz);
    return state;
  });
  for (const sample of samples.slice(1)) for (let index = 0; index < 2; index += 1) {
    assert.ok(Math.hypot(sample.rivals[index].x - samples[0].rivals[index].x, sample.rivals[index].z - samples[0].rivals[index].z) < 1e-7);
    assert.equal(sample.rivals[index].checkpointIndex, samples[0].rivals[index].checkpointIndex);
    assert.ok(Math.abs(sample.elapsed - samples[0].elapsed) < 1e-8);
  }
});

test('leaving, changing cars, capture, death, destruction and cancellation cannot pay out; pursuit alone continues', () => {
  const fixture = ready(), before = structuredClone(fixture.state);
  const cases = [[{ walking: true }, 'left-vehicle'], [{ transition: {} }, 'left-vehicle'],
    [{ controlledId: 'other' }, 'vehicle-changed'], [{ dead: true }, 'dead'], [{ busted: true }, 'busted'],
    [{ vehicle: { ...fixture.car, damageStage: 'wreck' } }, 'vehicle-destroyed']];
  for (const [input, reason] of cases) {
    const result = stepRace(fixture.state, { ...fixture.input, ...input }, 1 / 60);
    assert.equal(result.phase, 'failed'); assert.equal(result.result.reason, reason);
    assert.equal(settleRace(fixture.progress, result).reward, 0);
  }
  assert.deepEqual(fixture.state, before);
  assert.equal(stepRace(fixture.state, { ...fixture.input, wantedLevel: 5 }, .1).phase, 'racing');
  assert.equal(settleRace(fixture.progress, cancelRace(fixture.state)).ok, false);
});

test('checkpoint order, building occlusion, continuous movement, corridor and time limit reject shortcuts', () => {
  let { progress, state, car } = ready();
  const teleported = stepRace(state, context({ ...car, x: 120 }), 1 / 60);
  assert.equal(teleported.result.reason, 'teleport');
  const wall = [{ x: -29.8, z: 60, w: .05, d: 10 }];
  assert.equal(stepRace(state, context({ ...car, x: -29.5 }, { obstacles: wall }), 1 / 60).result.reason, 'teleport');
  let skipped = { ...state, lastPlayer: { x: 119, z: 60 } };
  skipped = stepRace(skipped, context({ ...car, x: 119.2 }), 1 / 60);
  assert.equal(skipped.phase, 'racing'); assert.equal(skipped.checkpointIndex, 0);
  for (let n = 0; n < 60; n += 1) {
    car = { ...car, z: car.z + 1 / 3 };
    state = stepRace(state, context(car, { obstacles: [] }), 1 / 60);
  }
  for (let n = 0; n < 180; n += 1) state = stepRace(state, context(car, { obstacles: [] }), 1 / 60);
  assert.equal(state.result.reason, 'off-route'); assert.equal(settleRace(progress, state).reward, 0);
  ({ state, car } = ready());
  for (let n = 0; n < 24 * 60; n += 1) state = stepRace(state, context(car), 1 / 60);
  assert.equal(state.result.reason, 'time-limit');
});

test('rank and sequential timestamps determine street prizes; third place gets no award', () => {
  for (const raceId of ['block-sprint', 'city-loop']) {
    const result = followRoute(raceId);
    assert.equal(result.state.phase, 'finished'); assert.equal(result.state.rank, 1);
    assert.equal(validRaceReceipt(result.state.result.receipt), true);
    assert.equal(settleRace(result.progress, result.state).reward, RACE_CATALOG.find(race => race.id === raceId).reward);
  }
  const { state: initial } = ready('block-sprint');
  const lost = followRoute('block-sprint', { rivals: initial.rivals.map(rival => ({ ...rival, finished: true, progress: 1, finishTime: .1 })) });
  assert.equal(lost.state.result.reason, 'lost'); assert.equal(lost.state.rank, 3);
  assert.equal(lost.state.result.reward, 0);
  const settled = settleRace(lost.progress, lost.state);
  assert.equal(settled.ok, true); assert.equal(settled.reward, 0); assert.equal(settled.progress.money, lost.progress.money);
  assert.equal(settled.progress.ledger.at(-1).kind, 'race-finish');
});

test('settlement uses catalog rewards, is idempotent, survives reload and allows separately completed reruns', () => {
  const progress = ownedProgress(), state = straight(progress), before = structuredClone(state);
  state.result.reward = 999999;
  const first = settleRace(progress, state);
  assert.equal(first.ok, true); assert.equal(first.reward, 140); assert.equal(first.progress.money, 390);
  assert.deepEqual(state, { ...before, result: { ...before.result, reward: 999999 } });
  assert.equal(settleRace(first.progress, state).reason, 'duplicate');
  assert.equal(startRace(first.progress, 'first-sprint', state.runId, context(initialCar(first.progress))).reason, 'duplicate');
  const entries = new Map([['hedo-life-v3', 'untouched']]);
  const storage = { getItem: key => entries.get(key), setItem: (key, value) => entries.set(key, value) };
  assert.equal(saveProgress(storage, first.progress), true);
  assert.equal(entries.get('hedo-life-v3'), 'untouched'); assert.ok(entries.has(STORAGE_KEY));
  const loaded = loadProgress(storage); assert.deepEqual(loaded, first.progress);
  const again = settleRace(loaded, straight(loaded, 60, 'rerun'));
  assert.equal(again.ok, true); assert.equal(again.progress.money, 530);
  assert.equal(settleRace(progress, null).reason, 'invalid-result');
});

test('ledger rewards require prior ownership and cannot fund earlier transactions or trust cached awards', () => {
  const upgrade = { id: 'engine', kind: 'upgrade', vehicleId: 'owned-hatch', value: 'engine', missionCount: 0 };
  const levelTwo = { ...upgrade, id: 'engine-two' }, prize = receipt();
  const replay = ledger => sanitizeProgress({ version: 4, completed: [], ledger, money: 99999, rewards: 99999 });
  assert.equal(replay([prize, buy]).money, 500); assert.equal(replay([prize, buy]).ledger.length, 0);
  assert.equal(replay([buy, { ...prize, reward: 99999 }]).money, 390);
  const futureIncome = replay([buy, upgrade, levelTwo, prize, receipt('again')]);
  assert.equal(futureIncome.ledger.length, 2); assert.equal(futureIncome.money, 70);
  const earnedFirst = replay([buy, upgrade, prize, receipt('again'), levelTwo]);
  assert.equal(earnedFirst.money, 30); assert.equal(earnedFirst.customizations['owned-hatch'].upgrades.engine, 2);
  assert.equal(replay([buy, prize, { ...prize }, receipt('later')]).money, 390);
  const missionLater = sanitizeProgress({ version: 4, completed: [MISSIONS[0].id], ledger: [buy, upgrade, levelTwo, prize] });
  assert.equal(missionLater.money, 420); assert.equal(missionLater.ledger.length, 2);
});

test('invalid or forged receipt facts stop the valid prefix, preserving existing owned cars and mission income', () => {
  const bad = [{ raceId: 'missing' }, { elapsedMs: 100 }, { elapsedMs: 24001 }, { elapsedMs: NaN },
    { rank: 0 }, { rank: 2 }, { checkpointTimes: [1, 2, 8000] }, { checkpointTimes: [2000, 1000, 8000] },
    { checkpointTimes: [2000, 5000] }, { checkpointTimes: [2000, 5000, 7999] }, { vehicleId: 'owned-sedan' }, { missionCount: 1 }];
  for (const invalid of bad) {
    const result = sanitizeProgress({ version: 4, completed: [], ledger: [buy, receipt('bad', invalid), receipt('later')] });
    assert.equal(result.money, 250, JSON.stringify(invalid)); assert.deepEqual(result.ledger, [buy]);
    assert.deepEqual(result.ownedVehicleIds, ['owned-hatch']);
  }
  for (const version of [1, 2, 3]) {
    const oldLedger = version === 3 ? [buy] : version === 2 ? [{ id: 'paint', vehicleId: 'starter-sedan', kind: 'paint', value: 'pearl', missionCount: 0 }] : [];
    const legacy = sanitizeProgress({ version, completed: [MISSIONS[0].id], ledger: [...oldLedger, receipt()], money: 9999 });
    assert.equal(legacy.version, 6);
    assert.equal(legacy.money, version === 3 ? 600 : version === 2 ? 790 : 850);
    assert.equal(legacy.ledger.length, oldLedger.length);
  }
});

test('receipt storage has a finite cap and a full ledger rejects entry and payout without losing valid balance', () => {
  const ledger = [buy, ...Array.from({ length: GARAGE_RULES.maxLedger + 2 }, (_, index) => receipt(`race-${index}`))];
  const progress = sanitizeProgress({ version: 4, completed: [], ledger });
  assert.equal(progress.ledger.length, GARAGE_RULES.maxLedger);
  assert.equal(progress.money, 250 + (GARAGE_RULES.maxLedger - 1) * 140);
  assert.equal(raceEligibility(progress, 'first-sprint', context(initialCar(progress))).reason, 'ledger-full');
  assert.equal(settleRace(progress, straight()).reason, 'ledger-full');
  assert.deepEqual(sanitizeProgress(JSON.parse(JSON.stringify(progress))), progress);
});
