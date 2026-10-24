import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILDINGS, LOCATIONS, MISSIONS } from '../dist/gta/world.js';
import { createFleet } from '../dist/gta/fleet.js';
import { freshProgress, sanitizeProgress } from '../dist/gta/progress.js';
import { applyOwnershipAction, createOwnedVehicle, selectOwnedVehicle } from '../dist/gta/ownership.js';
import { isOwnedVehicle, ownedHealth, snapshotOwnedVehicles, collectionSpawnState, retrieveOwnedVehicle, storeOwnedVehicle } from '../dist/gta/ownership-session.js';
import { segmentClear } from '../dist/gta/police.js';

const location = LOCATIONS.find(place => place.id === 'collection');
const foot = { x: -26, z: 78, heading: -Math.PI / 2 };
const context = overrides => ({ player: { ...foot, speed: 0, y: 0 }, walking: true, controlledId: null, vehicle: null,
  wantedLevel: 0, transition: null, dead: false, location, pedestrians: [], policeUnits: [], ...overrides });
function ownedProgress() {
  let progress = sanitizeProgress({ version: 3, completed: MISSIONS.map(mission => mission.id), ledger: [] });
  for (const vehicleId of ['owned-hatch', 'owned-sedan', 'owned-suv']) {
    progress = applyOwnershipAction(progress, { id: `buy-${vehicleId}`, kind: 'purchase', vehicleId }, context()).progress;
  }
  return sanitizeProgress({ ...progress, ledger: [...progress.ledger,
    { id: 'paint-hatch', kind: 'paint', vehicleId: 'owned-hatch', value: 'coral', missionCount: MISSIONS.length },
    { id: 'engine-hatch', kind: 'upgrade', vehicleId: 'owned-hatch', value: 'engine', missionCount: MISSIONS.length },
    { id: 'paint-sedan', kind: 'paint', vehicleId: 'owned-sedan', value: 'violet', missionCount: MISSIONS.length },
    { id: 'brakes-sedan', kind: 'upgrade', vehicleId: 'owned-sedan', value: 'brakes', missionCount: MISSIONS.length },
  ] });
}
function freeze(value) {
  for (const child of Object.values(value)) if (child && typeof child === 'object' && !Object.isFrozen(child)) freeze(child);
  return Object.freeze(value);
}

test('the fixed collection bay and safe foot position are clear of actual city terrain', () => {
  const state = collectionSpawnState(createFleet(), context());
  assert.equal(state.ok, true);
  assert.deepEqual(state.bay, { x: -30, z: 78, heading: 0 });
  assert.deepEqual(state.foot, foot);
  assert.equal(segmentClear(state.bay, state.bay, BUILDINGS, 2.6), true);
  assert.equal(segmentClear(state.foot, state.foot, BUILDINGS, .7), true);
  assert.equal(BUILDINGS.some(building => building.kind === 'collection'), true);
});

test('retrieving and switching keeps exactly one owned car, every civilian and independent paid configuration', () => {
  const progress = freeze(ownedProgress()), originalFleet = freeze(createFleet()), original = structuredClone({ progress, originalFleet });
  const hatch = retrieveOwnedVehicle(progress, originalFleet, 'owned-hatch', context());
  assert.equal(hatch.ok, true);
  assert.equal(hatch.progress.money, progress.money);
  assert.equal(hatch.fleet.filter(isOwnedVehicle).length, 1);
  assert.equal(hatch.fleet.length, originalFleet.length + 1);
  assert.equal(hatch.vehicle.id, 'owned-hatch');
  assert.equal(hatch.vehicle.upgrades.engine, 1);
  assert.equal(hatch.vehicle.x, -30); assert.equal(hatch.vehicle.z, 78);
  assert.deepEqual(hatch.player, foot); assert.equal(hatch.walking, true); assert.equal(hatch.controlledId, null);
  for (const civilian of originalFleet) assert.equal(hatch.fleet.find(car => car.id === civilian.id), civilian);
  const hurtHatch = { ...hatch.vehicle, x: 45, z: 0, vehicleHealth: 44.9, damageStage: 'damaged' };
  const street = [...originalFleet, hurtHatch];
  const sedan = retrieveOwnedVehicle(hatch.progress, street, 'owned-sedan', context());
  assert.equal(sedan.ok, true); assert.equal(sedan.fleet.filter(isOwnedVehicle).length, 1);
  assert.equal(sedan.vehicle.id, 'owned-sedan'); assert.equal(sedan.vehicle.upgrades.brakes, 1);
  assert.equal(sedan.progress.ownedVehicleHealth['owned-hatch'], 44);
  const hurtSedan = { ...sedan.vehicle, vehicleHealth: 25.5, damageStage: 'smoking' };
  const back = retrieveOwnedVehicle(sedan.progress, [...originalFleet, hurtSedan], 'owned-hatch', context());
  assert.equal(back.ok, true); assert.equal(back.vehicle.vehicleHealth, 44); assert.equal(back.vehicle.color, hatch.vehicle.color);
  assert.equal(back.vehicle.upgrades.engine, 1); assert.equal(back.progress.ownedVehicleHealth['owned-sedan'], 25);
  assert.equal(back.progress.customizations['owned-sedan'].upgrades.brakes, 1);
  assert.equal(back.progress.money, progress.money);
  assert.deepEqual({ progress, originalFleet }, original);
});

test('parked cars, patrols and pedestrians blocking either bay or foot exit refuse retrieval without side effects', () => {
  const progress = freeze(ownedProgress());
  const active = createOwnedVehicle(progress, 'owned-hatch', { x: 60, z: 0 });
  const civilian = { id: 'blocker', kind: 'parked', x: -30, z: 78, heading: Math.PI / 2, speed: 0 };
  const patrol = { ...civilian, id: 'police-1', kind: 'police' };
  const cases = [
    { fleet: [...createFleet(), active, civilian], input: context() },
    { fleet: [...createFleet(), active, { ...civilian, x: foot.x }], input: context() },
    { fleet: [...createFleet(), active], input: context({ policeUnits: [patrol] }) },
    { fleet: [...createFleet(), active], input: context({ policeUnits: [{ ...patrol, x: foot.x }] }) },
    { fleet: [...createFleet(), active], input: context({ pedestrians: [{ x: -30, z: 78 }] }) },
    { fleet: [...createFleet(), active], input: context({ pedestrians: [{ x: foot.x, z: foot.z }] }) },
  ];
  for (const item of cases) {
    freeze(item); const before = structuredClone(item);
    assert.equal(collectionSpawnState(item.fleet, item.input).ok, false);
    const result = retrieveOwnedVehicle(progress, item.fleet, 'owned-sedan', item.input);
    assert.equal(result.ok, false);
    assert.equal(result.fleet, undefined); assert.equal(result.player, undefined); assert.equal(result.progress, undefined);
    assert.deepEqual(item, before);
    assert.equal(progress.money, ownedProgress().money);
  }
  const clear = retrieveOwnedVehicle(progress, [...createFleet(), active], 'owned-sedan', context());
  assert.equal(clear.ok, true, 'removing blockers allows a normal switch');
});

test('retrieval while driving a borrowed car is refused, while storing a remote owned car preserves that driver', () => {
  const progress = freeze(ownedProgress());
  const borrowed = { ...createFleet()[0], x: -36, z: 78, speed: 0 };
  const remote = createOwnedVehicle(progress, 'owned-hatch', { x: 60, z: 0 });
  remote.vehicleHealth = 39.2; remote.damageStage = 'damaged';
  const player = { x: borrowed.x, z: borrowed.z, heading: .6, speed: 0, distance: 89 };
  const driving = freeze(context({ walking: false, vehicle: borrowed, controlledId: borrowed.id, player }));
  const fleet = freeze([...createFleet().filter(car => car.id !== borrowed.id), borrowed, remote]);
  const before = structuredClone({ progress, fleet, driving });
  const denied = retrieveOwnedVehicle(progress, fleet, 'owned-sedan', driving);
  assert.equal(denied.ok, false);
  const stored = storeOwnedVehicle(progress, fleet, driving);
  assert.equal(stored.ok, true);
  assert.equal(stored.player, player); assert.equal(stored.walking, false); assert.equal(stored.controlledId, borrowed.id);
  assert.equal(stored.fleet.find(car => car.id === borrowed.id), borrowed);
  assert.equal(stored.fleet.filter(isOwnedVehicle).length, 0);
  assert.equal(stored.progress.ownedVehicleHealth['owned-hatch'], 39);
  assert.equal(stored.progress.money, progress.money);
  assert.deepEqual({ progress, fleet, driving }, before);
});

test('storing a driven owned car places the player on the safe foot point and retains damage and configuration', () => {
  const progress = ownedProgress(), car = createOwnedVehicle(progress, 'owned-hatch', location);
  car.vehicleHealth = 22.8; car.damageStage = 'smoking';
  const fleet = [...createFleet(), car];
  const driving = context({ walking: false, vehicle: car, controlledId: car.id, player: { x: car.x, z: car.z, speed: 0 } });
  const blocked = storeOwnedVehicle(progress, fleet, { ...driving, pedestrians: [{ x: foot.x, z: foot.z }] });
  assert.equal(blocked.ok, false); assert.equal(blocked.player, undefined);
  const stored = storeOwnedVehicle(progress, fleet, driving);
  assert.equal(stored.ok, true); assert.equal(stored.walking, true); assert.equal(stored.controlledId, null);
  assert.deepEqual(stored.player, foot); assert.equal(stored.progress.selectedOwnedId, null);
  assert.equal(stored.progress.ownedVehicleHealth[car.id], 22);
  assert.equal(stored.fleet.some(isOwnedVehicle), false);
  assert.equal(stored.progress.money, progress.money);
  const retrieved = retrieveOwnedVehicle(stored.progress, stored.fleet, car.id, context());
  assert.equal(retrieved.vehicle.vehicleHealth, 22);
  assert.equal(retrieved.vehicle.color, car.color);
  assert.deepEqual(retrieved.vehicle.upgrades, car.upgrades);
});

test('active burning cars cannot be erased by retrieval or storage, while settled wrecks remain recorded as destroyed', () => {
  const progress = ownedProgress(), car = createOwnedVehicle(progress, 'owned-hatch', { x: 60, z: 0 });
  const burning = { ...car, damageStage: 'burning', vehicleHealth: 0, burnRemaining: 2.4 };
  const fleet = freeze([...createFleet(), burning]), snapshot = structuredClone(fleet);
  assert.equal(retrieveOwnedVehicle(progress, fleet, 'owned-sedan', context()).ok, false);
  assert.equal(storeOwnedVehicle(progress, fleet, context()).ok, false);
  assert.deepEqual(fleet, snapshot); assert.equal(burning.burnRemaining, 2.4);
  const wreckFleet = [...createFleet(), { ...burning, damageStage: 'wreck', burnRemaining: 0, wreckAge: 1 }];
  const stored = storeOwnedVehicle(progress, wreckFleet, context());
  assert.equal(stored.ok, true); assert.equal(stored.progress.ownedVehicleHealth[car.id], 0);
  assert.equal(retrieveOwnedVehicle(stored.progress, stored.fleet, car.id, context()).ok, false);
  const switched = retrieveOwnedVehicle(progress, wreckFleet, 'owned-sedan', context());
  assert.equal(switched.ok, true); assert.equal(switched.progress.ownedVehicleHealth[car.id], 0);
  assert.equal(switched.fleet.filter(isOwnedVehicle).length, 1);
});

test('unauthorized IDs, duplicate retrieval and unsafe contexts cannot create or move cars', () => {
  const fleet = freeze(createFleet()), initial = freeze(freshProgress());
  assert.equal(retrieveOwnedVehicle(initial, fleet, 'owned-hatch', context()).ok, false);
  assert.equal(retrieveOwnedVehicle(ownedProgress(), fleet, 'owned-limo', context()).ok, false);
  const progress = ownedProgress(), car = createOwnedVehicle(progress, 'owned-hatch', location), street = freeze([...fleet, car]);
  assert.equal(retrieveOwnedVehicle(progress, street, car.id, context()).ok, false);
  for (const override of [{ wantedLevel: 1 }, { dead: true }, { transition: { kind: 'exit' } },
    { player: { x: 0, z: 0, speed: 0 } }, { player: { ...foot, speed: 0, y: .5 } }]) {
    const unsafe = freeze(context(override));
    assert.equal(retrieveOwnedVehicle(progress, street, 'owned-sedan', unsafe).ok, false);
    assert.equal(storeOwnedVehicle(progress, street, unsafe).ok, false);
  }
  assert.equal(storeOwnedVehicle(progress, fleet, context()).ok, false);
  assert.equal(street.filter(isOwnedVehicle).length, 1);
});

test('snapshot and selection preserve only owned health and preference, with no implicit fleet creation', () => {
  const progress = ownedProgress(), car = createOwnedVehicle(progress, 'owned-hatch', location);
  const selected = selectOwnedVehicle(progress, car.id), fleet = createFleet();
  assert.equal(selected.selectedOwnedId, car.id);
  assert.equal(fleet.some(isOwnedVehicle), false);
  assert.equal(snapshotOwnedVehicles(selected, fleet), selected);
  assert.equal(snapshotOwnedVehicles(selected, [...fleet, car]), selected, 'unchanged integer health does not replay or mark progress dirty');
  const snapshot = snapshotOwnedVehicles(selected, [...fleet, { ...car, vehicleHealth: 61.9 }]);
  assert.equal(snapshot.ownedVehicleHealth[car.id], 61); assert.equal(snapshot.selectedOwnedId, car.id);
  assert.equal(snapshotOwnedVehicles(snapshot, [...fleet, { ...car, vehicleHealth: 61.1 }]), snapshot);
  assert.equal(ownedHealth({ ...car, damageStage: 'burning', vehicleHealth: 100 }), 0);
  assert.equal(ownedHealth({ ...car, vehicleHealth: 101 }), 100);
  assert.equal(ownedHealth({ ...car, vehicleHealth: -1 }), 0);
  assert.equal(isOwnedVehicle({ ...car, id: 'owned-forged' }), false);
  assert.equal(isOwnedVehicle({ ...car, owned: false }), false);
  assert.deepEqual(sanitizeProgress(JSON.parse(JSON.stringify(snapshot))), snapshot);
});
