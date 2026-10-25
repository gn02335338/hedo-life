import test from 'node:test';
import assert from 'node:assert/strict';
import { LOCATIONS, MISSIONS } from '../dist/gta/world.js';
import { createFleet } from '../dist/gta/fleet.js';
import { createVehicle, stepVehicle } from '../dist/gta/driving.js';
import { freshProgress, sanitizeProgress, completeMission, saveProgress, loadProgress, STORAGE_KEY } from '../dist/gta/progress.js';
import { GARAGE_PALETTE, GARAGE_CATALOG, GARAGE_RULES, garageEligibility, quoteGarageAction,
  applyGarageAction, applyGarageCustomizations, getPerformanceProfile } from '../dist/gta/garage.js';
import { validateMigrationPayload } from '../dist/domain-migration.js';

const bay = LOCATIONS.find(location => location.id === 'garage');
const vehicle = overrides => ({ ...createFleet()[0], x: bay.x, z: bay.z, speed: 0, vehicleHealth: 50, damageStage: 'damaged', ...overrides });
const context = car => ({ walking: false, controlledId: car.id, wantedLevel: 0, transition: null, dead: false,
  player: { x: car.x, z: car.z, speed: 0 } });
const action = (id, kind, value) => ({ id, kind, ...(value ? { value } : {}) });
const purchase = (progress, car, choice, overrides = {}) => applyGarageAction(progress, car, choice, { ...context(car), ...overrides });
const near = (actual, expected, epsilon = 1e-8) => assert.ok(Math.abs(actual - expected) < epsilon, `${actual} != ${expected}`);
function savedProgress(completed = MISSIONS.map(mission => mission.id), ledger = []) { return { version: 2, completed, ledger }; }
function drive(input, seconds, fps = 60, initial = createVehicle({ x: 0, z: 100 }), obstacles = []) {
  let state = initial;
  for (let frame = 0; frame < Math.round(seconds * fps); frame += 1) state = stepVehicle(state, input, 1 / fps, obstacles);
  return state;
}

test('repair, repaint and upgrade charge catalog prices once and replay a complete cash flow', () => {
  let progress = freshProgress(), car = vehicle();
  const initial = structuredClone({ progress, car });
  const choices = [action('repair-1', 'repair'), action('paint-1', 'paint', 'pearl'), action('engine-1', 'upgrade', 'engine')];
  for (const choice of choices) {
    const result = purchase(progress, car, choice);
    assert.equal(result.ok, true);
    if (choice.kind === 'repair') {
      assert.equal(result.vehicle.vehicleHealth, 100);
      assert.equal(result.vehicle.damageStage, 'intact');
      assert.equal(result.clearCollisionCooldown, true);
      assert.equal(result.vehicle.burnRemaining, 0);
      assert.equal(result.vehicle.impact, false);
    }
    progress = result.progress; car = result.vehicle;
  }
  assert.equal(progress.money, 170);
  assert.equal(car.upgrades.engine, 1);
  const painted = purchase(progress, car, action('paint-2', 'paint', 'coral'));
  assert.equal(painted.progress.money, 110);
  const insufficient = purchase(painted.progress, painted.vehicle, action('brakes-1', 'upgrade', 'brakes'));
  assert.equal(insufficient.reason, 'insufficient-funds');
  assert.deepEqual(insufficient.progress, painted.progress);
  assert.equal(insufficient.vehicle, painted.vehicle);
  const delivered = completeMission(painted.progress, MISSIONS[0].id);
  assert.equal(delivered.money, 460);
  const upgraded = purchase(delivered, painted.vehicle, action('brakes-2', 'upgrade', 'brakes'));
  assert.equal(upgraded.progress.money, 320);
  assert.equal(upgraded.progress.ledger.at(-1).missionCount, 1);
  assert.deepEqual(sanitizeProgress(JSON.parse(JSON.stringify(upgraded.progress))), upgraded.progress);
  assert.deepEqual(initial, { progress: freshProgress(), car: vehicle() });
});

test('duplicate transactions, the current paint, complete repairs and capped upgrades never charge', () => {
  const car = vehicle(), initial = freshProgress();
  const first = purchase(initial, car, action('once', 'paint', 'pearl'));
  const duplicate = purchase(first.progress, first.vehicle, action('once', 'upgrade', 'engine'));
  assert.equal(duplicate.reason, 'duplicate');
  assert.deepEqual(duplicate.progress, first.progress);
  assert.equal(purchase(first.progress, first.vehicle, action('again', 'paint', 'pearl')).reason, 'same-color');
  assert.equal(purchase(initial, car, action('original', 'paint', 'gold')).reason, 'same-color');
  assert.equal(purchase(initial, vehicle({ vehicleHealth: 100 }), action('healthy', 'repair')).reason, 'full-health');
  let progress = sanitizeProgress(savedProgress()), updated = car;
  for (const kind of ['engine', 'brakes', 'handling']) {
    for (let level = 1; level <= 2; level += 1) {
      const result = purchase(progress, updated, action(`${kind}-${level}`, 'upgrade', kind));
      assert.equal(result.cost, GARAGE_CATALOG.upgrades[kind].prices[level - 1]);
      assert.equal(result.vehicle.upgrades[kind], level);
      progress = result.progress; updated = result.vehicle;
    }
    const capped = purchase(progress, updated, action(`${kind}-3`, 'upgrade', kind));
    assert.equal(capped.reason, 'max-level');
    assert.deepEqual(capped.progress, progress);
  }
  for (const invalid of [null, { kind: 'repair' }, action('__proto__', 'repair'), action('bad', 'upgrade', 'constructor'), action('bad', 'paint', 'pink')]) {
    const result = purchase(initial, car, invalid);
    assert.equal(result.ok, false);
    assert.deepEqual(result.progress, initial);
  }
});

test('transactions recheck driver, service bay, wanted, speed and lifecycle state after a quote', () => {
  const car = vehicle(), progress = freshProgress(), choice = action('quoted', 'repair');
  assert.equal(quoteGarageAction(progress, car, choice).ok, true);
  assert.equal(garageEligibility({ ...context(car), vehicle: car }).ok, true);
  const rejections = [
    [{ walking: true }, car, 'on-foot'], [{ wantedLevel: 1 }, car, 'wanted'], [{ dead: true }, car, 'dead'],
    [{ transition: { kind: 'exit' } }, car, 'busy'], [{ controlledId: 'other' }, car, 'vehicle'],
    [{ player: { x: car.x, z: car.z, speed: 1.01 } }, car, 'moving'],
    [{}, { ...car, speed: -1.01 }, 'moving'], [{}, { ...car, x: car.x + 6.01 }, 'distance'],
    [{ player: { x: car.x, z: car.z + 6.01, speed: 0 } }, car, 'distance'],
    [{}, { ...car, damageStage: 'burning', vehicleHealth: 0 }, 'destroyed'],
    [{}, { ...car, damageStage: 'wreck', vehicleHealth: 0 }, 'destroyed'],
    [{}, { ...car, kind: 'police' }, 'vehicle'], [{}, { ...car, id: 'police-1' }, 'vehicle'],
  ];
  for (const [override, currentCar, reason] of rejections) {
    const result = purchase(progress, currentCar, choice, override);
    assert.equal(result.reason, reason);
    assert.deepEqual(result.progress, progress);
    assert.equal(result.vehicle, currentCar);
  }
  assert.equal(purchase(progress, { ...car, speed: 1, x: bay.x + 6 }, choice).ok, true);
});

test('fixed vehicle IDs retain paid paint and performance while damage and motion stay session-only', () => {
  const car = vehicle(), painted = purchase(freshProgress(), car, action('paint', 'paint', 'violet'));
  const upgraded = purchase(painted.progress, painted.vehicle, action('engine', 'upgrade', 'engine'));
  const sessionFleet = [vehicle({ x: 20, z: 40, speed: 8, vehicleHealth: 24, damageStage: 'smoking' }), createFleet()[1], { id: 'police-1', kind: 'police', color: 0x000000 }];
  const snapshot = structuredClone(sessionFleet);
  const applied = applyGarageCustomizations(sessionFleet, upgraded.progress);
  assert.equal(applied[0].color, GARAGE_PALETTE.find(color => color.id === 'violet').color);
  assert.deepEqual(applied[0].upgrades, { engine: 1, brakes: 0, handling: 0 });
  assert.equal(applied[0].vehicleHealth, 24);
  assert.equal(applied[0].speed, 8);
  assert.equal(applied[0].x, 20);
  assert.equal(applied[1].color, sessionFleet[1].color);
  assert.equal(applied[2], sessionFleet[2]);
  assert.deepEqual(sessionFleet, snapshot);
  const actor = createVehicle(applied[0]);
  assert.equal(Object.hasOwn(actor, 'vehicleHealth'), false);
  assert.equal(Object.hasOwn(actor, 'color'), false);
  assert.equal(Object.hasOwn(actor, 'upgrades'), false);
  const moved = stepVehicle(actor, { throttle: 1, tuning: applied[0].upgrades }, 1 / 60, []);
  const merged = { ...applied[0], ...moved };
  assert.equal(merged.vehicleHealth, 24);
  assert.equal(merged.color, applied[0].color);
  assert.equal(merged.upgrades.engine, 1);
});

test('legacy progress upgrades without losing mission rewards and ignores forged money or customizations', () => {
  const legacy = { version: 1, completed: [MISSIONS[0].id], money: 999999, ledger: [{ id: 'fake' }], customizations: { 'starter-sedan': { colorId: 'coral', upgrades: { engine: 2 } } } };
  const current = sanitizeProgress(legacy);
  assert.equal(current.version, 5);
  assert.equal(current.money, 850);
  assert.deepEqual(current.ledger, []);
  assert.deepEqual(current.customizations, {});
  const record = { id: 'legal', vehicleId: 'starter-sedan', kind: 'upgrade', value: 'engine', missionCount: 0, price: 0, level: 2 };
  const forged = sanitizeProgress({ ...legacy, version: 2, ledger: [record] });
  assert.equal(forged.money, 670);
  assert.equal(forged.customizations['starter-sedan'].upgrades.engine, 1);
  assert.equal(Object.hasOwn(forged.ledger[0], 'price'), false);
});

test('invalid, duplicate or unaffordable ledger entries stop replay but preserve valid mission income', () => {
  const first = { id: 'first', vehicleId: 'starter-sedan', kind: 'paint', value: 'pearl', missionCount: 0 };
  const following = { ...first, id: 'later', value: 'coral' };
  const invalid = [
    { ...following, vehicleId: '__proto__' }, { ...following, value: 'unknown' }, { ...following, missionCount: -1 },
    { ...following, missionCount: 100 }, { ...following, missionCount: 0.5 }, { ...following, id: first.id },
    Object.create({ ...following }), null,
    Object.defineProperty({ ...following }, 'kind', { get() { throw new Error('invalid record'); } }),
  ];
  for (const corrupt of invalid) {
    const replay = sanitizeProgress(savedProgress([MISSIONS[0].id], [first, corrupt, following]));
    assert.equal(replay.money, 790);
    assert.deepEqual(replay.ledger, [first]);
    assert.equal(replay.customizations['starter-sedan'].colorId, 'pearl');
  }
  const engine = { id: 'engine-1', vehicleId: 'starter-sedan', kind: 'upgrade', value: 'engine', missionCount: 0 };
  const noBorrowing = sanitizeProgress(savedProgress(MISSIONS.map(mission => mission.id), [engine, { ...engine, id: 'engine-2' },
    { ...engine, id: 'brakes-1', value: 'brakes' }]));
  const earnings = 500 + MISSIONS.reduce((sum, mission) => sum + mission.reward, 0);
  assert.equal(noBorrowing.money, earnings - 500, 'later mission rewards cannot fund a past purchase');
  assert.equal(noBorrowing.ledger.length, 2);
  assert.equal(noBorrowing.customizations['starter-sedan'].upgrades.brakes, 0);
  const backwards = sanitizeProgress(savedProgress([MISSIONS[0].id], [{ ...first, missionCount: 1 }, following]));
  assert.equal(backwards.ledger.length, 1);
  const broken = Object.defineProperty(savedProgress([MISSIONS[0].id]), 'ledger', { get() { throw new Error('broken ledger'); } });
  assert.equal(sanitizeProgress(broken).money, 850);
});

test('purchase history remains bounded and cached customization cannot grant free levels', () => {
  const all = MISSIONS.map(mission => mission.id);
  const ledger = Array.from({ length: 10000 }, (_, index) => ({ id: `paint-${index}`, vehicleId: 'starter-sedan',
    kind: 'paint', value: index % 2 ? 'coral' : 'pearl', missionCount: all.length }));
  const result = sanitizeProgress({ ...savedProgress(all, ledger), money: Infinity, customizations: { 'city-hatch': { upgrades: { engine: 2 } } } });
  assert.ok(result.ledger.length <= GARAGE_RULES.maxLedger);
  assert.equal(result.ledger.length, Math.floor((500 + MISSIONS.reduce((sum, mission) => sum + mission.reward, 0)) / 60));
  assert.ok(result.money >= 0 && result.money < 60);
  assert.equal(result.customizations['city-hatch'], undefined);
  assert.deepEqual(sanitizeProgress(result), result);
});

test('storage failure leaves session purchases usable and the unchanged migration key carries current progress verbatim', () => {
  const purchased = purchase(freshProgress(), vehicle(), action('paid', 'paint', 'mint'));
  const fail = { setItem() { throw new Error('quota exceeded'); }, getItem() { return null; } };
  assert.equal(saveProgress(fail, purchased.progress), false);
  assert.equal(purchased.progress.money, 440);
  assert.equal(purchased.vehicle.color, GARAGE_PALETTE.find(color => color.id === 'mint').color);
  assert.equal(saveProgress({ setItem() {}, getItem() { return null; } }, purchased.progress), false);
  const entries = new Map(), storage = { setItem(key, value) { entries.set(key, value); }, getItem(key) { return entries.get(key) ?? null; } };
  assert.equal(saveProgress(storage, purchased.progress), true);
  assert.deepEqual(loadProgress(storage), purchased.progress);
  assert.equal(STORAGE_KEY, 'hedo-gta-v1');
  const migrated = validateMigrationPayload({ version: 1, nonce: 'a'.repeat(64), returnTo: '/gta/', local: { [STORAGE_KEY]: entries.get(STORAGE_KEY) }, session: {} });
  assert.equal(migrated.local[STORAGE_KEY], entries.get(STORAGE_KEY));
  assert.deepEqual(loadProgress({ getItem: key => migrated.local[key] }), purchased.progress);
});

test('engine levels improve acceleration and top speed within bounded limits', () => {
  const base = drive({ throttle: 1 }, 2), one = drive({ throttle: 1, tuning: { engine: 1 } }, 2);
  const two = drive({ throttle: 1, tuning: { engine: 2 } }, 2);
  near(base.speed, 23); near(one.speed, 23 * 1.12); near(two.speed, 23 * 1.24);
  assert.ok(one.distance > base.distance && two.distance > one.distance);
  const boosted = drive({ throttle: 1, boost: true, tuning: { engine: 2 } }, 2);
  near(boosted.speed, 32 * 1.24);
  const released = drive({ throttle: 1, tuning: { engine: 2 } }, 1, 60, boosted);
  near(released.speed, 23 * 1.24);
  for (const tuning of [{ engine: 99 }, { engine: -1 }, { engine: 1.5 }, { engine: '2' }, { engine: NaN }]) {
    near(drive({ throttle: 1, tuning }, 2).speed, base.speed);
  }
});

test('upgraded brakes shorten stopping distance while handling improves response without rotation at rest', () => {
  const initial = createVehicle({ x: 0, z: 100, speed: 23 });
  const base = drive({ brake: true }, 1, 60, initial), improved = drive({ brake: true, tuning: { brakes: 2 } }, 1, 60, initial);
  assert.equal(base.speed, 0); assert.equal(improved.speed, 0);
  assert.ok(improved.distance < base.distance * .8);
  const pedal = drive({ throttle: -1, tuning: { brakes: 2 } }, .4, 60, initial);
  assert.ok(pedal.speed > 0 && pedal.speed < drive({ throttle: -1 }, .4, 60, initial).speed);
  const normalTurn = drive({ steer: .5, throttle: .1 }, .25, 60, initial);
  const tunedTurn = drive({ steer: .5, throttle: .1, tuning: { handling: 2 } }, .25, 60, initial);
  assert.ok(tunedTurn.heading > normalTurn.heading);
  assert.ok(tunedTurn.yawVelocity < 2.6);
  const resting = drive({ steer: 1, tuning: { handling: 2 } }, 1);
  near(resting.heading, 0);
  assert.deepEqual(getPerformanceProfile({ engine: 2, brakes: 2, handling: 2 }).levels, { engine: 2, brakes: 2, handling: 2 });
});

test('all upgrades preserve 30/60 Hz motion and swept low-frame-rate collisions', () => {
  const input = { throttle: 1, steer: .25, boost: true, tuning: { engine: 2, brakes: 2, handling: 2 } };
  const at30 = drive(input, 2, 30), at60 = drive(input, 2, 60);
  for (const key of ['x', 'z', 'speed', 'heading', 'distance', 'yawVelocity']) near(at30[key], at60[key]);
  const wall = [{ x: 0, z: 0, w: .01, d: 80, vehicleId: 'cover-car' }];
  const start = createVehicle({ x: -4, z: 0, heading: Math.PI / 2, speed: 32 * 1.24 });
  const hit = stepVehicle(start, { ...input, steer: 0 }, .1, wall);
  assert.ok(hit.x <= -1.505 + 1e-8);
  assert.equal(hit.impact, true);
  assert.equal(hit.impactVehicleId, 'cover-car');
  assert.ok(hit.impactSpeed > 32 && hit.speed < start.speed);
  assert.deepEqual(stepVehicle(start, input, 50, wall), stepVehicle(start, input, .1, wall));
  const frozen = stepVehicle(at60, input, 0, []);
  for (const key of ['x', 'z', 'speed', 'heading', 'distance']) near(frozen[key], at60[key]);
});
