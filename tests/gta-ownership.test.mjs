import test from 'node:test';
import assert from 'node:assert/strict';
import { MISSIONS, LOCATIONS } from '../dist/gta/world.js';
import { createFleet } from '../dist/gta/fleet.js';
import { freshProgress, sanitizeProgress, completeMission, saveProgress, loadProgress, STORAGE_KEY } from '../dist/gta/progress.js';
import { applyGarageAction, quoteGarageAction, applyGarageCustomizations, GARAGE_PALETTE } from '../dist/gta/garage.js';
import { OWNED_CAR_CATALOG, PRIVATE_GARAGE_RULES, ownershipEligibility, quoteOwnershipAction, applyOwnershipAction,
  createOwnedVehicle, setOwnedVehicleHealth, selectOwnedVehicle } from '../dist/gta/ownership.js';

const collection = LOCATIONS.find(place => place.id === 'collection') || { x: -30, z: 78 };
const serviceBay = LOCATIONS.find(place => place.id === 'garage');
const footContext = overrides => ({ player: { ...collection, speed: 0 }, walking: true, vehicle: null, controlledId: null,
  wantedLevel: 0, transition: null, dead: false, location: collection, ...overrides });
const purchase = (progress, vehicleId, id = `buy-${vehicleId}`, overrides = {}) => applyOwnershipAction(progress, { id, kind: 'purchase', vehicleId }, footContext(overrides));
const recover = (progress, vehicleId, id = `recover-${vehicleId}`) => applyOwnershipAction(progress, { id, kind: 'recover', vehicleId }, footContext());
const rich = () => sanitizeProgress({ version: 3, completed: MISSIONS.map(mission => mission.id), ledger: [] });
const service = (progress, car, action) => applyGarageAction(progress, { ...car, ...serviceBay, id: car.id, name: car.name }, action,
  { player: { ...serviceBay, speed: 0 }, walking: false, controlledId: car.id, wantedLevel: 0, dead: false, transition: null });
const transaction = (id, kind, vehicleId, extra = {}) => ({ id, kind, vehicleId, missionCount: 0, ...extra });

test('catalog purchases fit the starting economy, are idempotent and never spawn or select a car', () => {
  assert.deepEqual(OWNED_CAR_CATALOG.map(car => [car.id, car.price, car.variant]), [
    ['owned-hatch', 250, 'hatch'], ['owned-sedan', 350, 'sedan'], ['owned-suv', 600, 'suv'],
  ]);
  assert.equal(PRIVATE_GARAGE_RULES.capacity, 3);
  const initial = freshProgress(), before = structuredClone(initial), worldFleet = createFleet();
  const first = purchase(initial, 'owned-hatch');
  assert.equal(first.ok, true); assert.equal(first.cost, 250); assert.equal(first.progress.money, 250);
  assert.deepEqual(first.progress.ownedVehicleIds, ['owned-hatch']);
  assert.deepEqual(first.progress.ownedVehicleHealth, { 'owned-hatch': 100 });
  assert.equal(first.progress.selectedOwnedId, null);
  assert.equal(first.vehicle, undefined);
  assert.deepEqual(initial, before);
  assert.equal(worldFleet.some(car => car.owned), false);
  assert.equal(purchase(first.progress, 'owned-hatch').reason, 'duplicate');
  assert.equal(purchase(first.progress, 'owned-hatch', 'another-id').reason, 'already-owned');
  const denied = purchase(first.progress, 'owned-sedan');
  assert.equal(denied.reason, 'insufficient-funds'); assert.deepEqual(denied.progress, first.progress);
  assert.equal(purchase(initial, 'owned-suv').reason, 'insufficient-funds');
  const delivered = completeMission(first.progress, MISSIONS[0].id);
  const second = purchase(delivered, 'owned-sedan');
  assert.equal(second.progress.money, 250);
  assert.deepEqual(second.progress.ownedVehicleIds, ['owned-hatch', 'owned-sedan']);
});

test('three distinct cars can be purchased and unknown or duplicate identities cannot expand the garage', () => {
  let progress = rich(); const starting = progress.money;
  for (const car of OWNED_CAR_CATALOG) progress = purchase(progress, car.id).progress;
  assert.equal(progress.money, starting - 1200);
  assert.equal(progress.ownedVehicleIds.length, PRIVATE_GARAGE_RULES.capacity);
  assert.equal(purchase(progress, 'owned-limo').reason, 'invalid-action');
  assert.equal(purchase(progress, 'owned-suv', 'again').reason, 'already-owned');
  assert.equal(purchase(progress, '__proto__').reason, 'invalid-action');
  assert.equal(quoteOwnershipAction(progress, { kind: 'sale', vehicleId: 'owned-hatch' }).reason, 'invalid-action');
  assert.deepEqual(sanitizeProgress(JSON.parse(JSON.stringify(progress))), progress);
});

test('each owned car keeps independent paint, upgrades and normal damage through storage and retrieval', () => {
  let progress = purchase(rich(), 'owned-hatch').progress;
  progress = purchase(progress, 'owned-sedan').progress;
  const hatch = createOwnedVehicle(progress, 'owned-hatch', collection);
  const sedan = createOwnedVehicle(progress, 'owned-sedan', collection);
  assert.deepEqual([hatch.variant, sedan.variant], ['hatch', 'sedan']);
  assert.equal(hatch.owned, true); assert.equal(hatch.stolen, false); assert.equal(hatch.occupied, false);
  const painted = service(progress, hatch, { id: 'paint-hatch', kind: 'paint', value: 'coral' });
  assert.equal(painted.ok, true); progress = painted.progress;
  const tunedHatch = service(progress, painted.vehicle, { id: 'engine-hatch', kind: 'upgrade', value: 'engine' });
  assert.equal(tunedHatch.ok, true); progress = tunedHatch.progress;
  const tunedSedan = service(progress, sedan, { id: 'brakes-sedan', kind: 'upgrade', value: 'brakes' });
  assert.equal(tunedSedan.ok, true); progress = tunedSedan.progress;
  progress = setOwnedVehicleHealth(progress, { ...tunedHatch.vehicle, vehicleHealth: 24, damageStage: 'smoking' });
  progress = setOwnedVehicleHealth(progress, { ...tunedSedan.vehicle, vehicleHealth: 62, damageStage: 'damaged' });
  progress = selectOwnedVehicle(progress, 'owned-sedan');
  const reloaded = sanitizeProgress(JSON.parse(JSON.stringify(progress)));
  const returnedHatch = createOwnedVehicle(reloaded, 'owned-hatch', collection), returnedSedan = createOwnedVehicle(reloaded, 'owned-sedan', collection);
  assert.equal(returnedHatch.vehicleHealth, 24); assert.equal(returnedHatch.damageStage, 'smoking');
  assert.equal(returnedSedan.vehicleHealth, 62); assert.equal(returnedSedan.damageStage, 'damaged');
  assert.equal(returnedHatch.color, GARAGE_PALETTE.find(color => color.id === 'coral').color);
  assert.deepEqual(returnedHatch.upgrades, { engine: 1, brakes: 0, handling: 0 });
  assert.deepEqual(returnedSedan.upgrades, { engine: 0, brakes: 1, handling: 0 });
  assert.equal(returnedSedan.color, OWNED_CAR_CATALOG[1].color);
  assert.equal(reloaded.selectedOwnedId, 'owned-sedan');
  assert.deepEqual(reloaded, progress);
  assert.equal(createFleet().some(car => car.id.startsWith('owned-')), false, 'reload starts with private cars stored');
});

test('repair and destroyed-car recovery charge separately, preserve customization and persist restored health', () => {
  let progress = purchase(rich(), 'owned-hatch').progress;
  let car = createOwnedVehicle(progress, 'owned-hatch', collection);
  const painted = service(progress, car, { id: 'paint', kind: 'paint', value: 'violet' });
  progress = painted.progress; car = painted.vehicle;
  const tuned = service(progress, car, { id: 'tune', kind: 'upgrade', value: 'handling' });
  progress = setOwnedVehicleHealth(tuned.progress, { ...tuned.vehicle, vehicleHealth: 27 });
  car = createOwnedVehicle(progress, car.id, collection);
  const beforeRepair = progress.money, repaired = service(progress, car, { id: 'repair', kind: 'repair' });
  assert.equal(repaired.ok, true); assert.equal(repaired.progress.money, beforeRepair - 90);
  assert.equal(repaired.progress.ownedVehicleHealth[car.id], 100);
  assert.equal(createOwnedVehicle(repaired.progress, car.id, collection).vehicleHealth, 100);
  assert.equal(recover(repaired.progress, car.id).reason, 'not-destroyed');
  progress = setOwnedVehicleHealth(repaired.progress, { ...repaired.vehicle, damageStage: 'burning', vehicleHealth: 50 });
  assert.equal(progress.ownedVehicleHealth[car.id], 0);
  assert.equal(createOwnedVehicle(progress, car.id, collection), null);
  assert.equal(quoteGarageAction(progress, { ...car, vehicleHealth: 10 }, { kind: 'repair' }).reason, 'destroyed');
  const rescued = recover(progress, car.id);
  assert.equal(rescued.ok, true); assert.equal(rescued.progress.money, progress.money - 120);
  assert.equal(rescued.progress.ownedVehicleHealth[car.id], 100);
  const restored = createOwnedVehicle(rescued.progress, car.id, collection);
  assert.equal(restored.damageStage, 'intact'); assert.equal(restored.upgrades.handling, 1);
  assert.equal(restored.color, painted.vehicle.color);
  assert.equal(recover(rescued.progress, car.id).reason, 'duplicate');
  assert.equal(recover(rescued.progress, car.id, 'again').reason, 'not-destroyed');
  const poor = purchase(freshProgress(), 'owned-sedan').progress;
  const spent = service(poor, createOwnedVehicle(poor, 'owned-sedan', collection), { id: 'paint-poor', kind: 'paint', value: 'coral' }).progress;
  const wreck = setOwnedVehicleHealth(spent, { id: 'owned-sedan', damageStage: 'wreck' });
  assert.equal(recover(wreck, 'owned-sedan').reason, 'insufficient-funds');
  assert.equal(wreck.money, 90);
});

test('a paint or tuning receipt captures unsaved shell damage instead of healing it on reload', () => {
  let progress = purchase(rich(), 'owned-hatch').progress;
  const car = createOwnedVehicle(progress, 'owned-hatch', collection);
  const painted = service(progress, { ...car, vehicleHealth: 48.75, damageStage: 'damaged' }, { id: 'paint-damaged', kind: 'paint', value: 'coral' });
  assert.equal(painted.ok, true);
  assert.equal(painted.vehicle.vehicleHealth, 48.75);
  assert.equal(painted.progress.ownedVehicleHealth[car.id], 48);
  assert.equal(createOwnedVehicle(painted.progress, car.id, collection).vehicleHealth, 48);
  const tuned = service(painted.progress, { ...painted.vehicle, vehicleHealth: 28.5, damageStage: 'smoking' }, { id: 'tune-damaged', kind: 'upgrade', value: 'engine' });
  assert.equal(tuned.ok, true);
  assert.equal(tuned.progress.ownedVehicleHealth[car.id], 28);
  assert.equal(createOwnedVehicle(tuned.progress, car.id, collection).damageStage, 'smoking');
});

test('unbought owned IDs cannot receive garage upgrades, health, selection or a spawned vehicle', () => {
  const progress = freshProgress(), forged = { ...createFleet()[0], id: 'owned-hatch', owned: true, vehicleHealth: 40, ...serviceBay };
  forged.id = 'owned-hatch';
  assert.equal(quoteGarageAction(progress, forged, { kind: 'upgrade', value: 'engine' }).reason, 'not-owned');
  const denied = service(progress, forged, { id: 'free-upgrade', kind: 'upgrade', value: 'engine' });
  assert.equal(denied.reason, 'not-owned'); assert.deepEqual(denied.progress, progress);
  assert.equal(recover(progress, 'owned-hatch').reason, 'not-owned');
  assert.deepEqual(setOwnedVehicleHealth(progress, forged), progress);
  assert.deepEqual(selectOwnedVehicle(progress, forged.id), progress);
  assert.equal(createOwnedVehicle(progress, forged.id, collection), null);
  assert.equal(applyGarageCustomizations([forged], progress)[0], forged);
  const paid = purchase(progress, 'owned-hatch').progress;
  assert.equal(createOwnedVehicle(paid, 'owned-hatch', { x: NaN, z: 0 }), null);
  assert.equal(createOwnedVehicle(paid, 'owned-hatch', { x: 999, z: 0 }), null);
});

test('old v1 and v2 saves retain rewards and paid street-car customizations without inventing ownership', () => {
  const v1 = sanitizeProgress({ version: 1, completed: [MISSIONS[0].id], money: 9999, ownedVehicleIds: ['owned-suv'] });
  assert.equal(v1.version, 4); assert.equal(v1.money, 850); assert.deepEqual(v1.ownedVehicleIds, []);
  const oldLedger = [transaction('paint-old', 'paint', 'starter-sedan', { value: 'coral' }),
    transaction('engine-old', 'upgrade', 'starter-sedan', { value: 'engine' }), transaction('repair-old', 'repair', 'starter-sedan')];
  const v2 = sanitizeProgress({ version: 2, completed: [MISSIONS[0].id], ledger: oldLedger, selectedOwnedId: 'owned-suv',
    ownedVehicleIds: ['owned-suv'], ownedVehicleHealth: { 'owned-suv': 100 } });
  assert.equal(v2.version, 4); assert.equal(v2.money, 850 - 60 - 180 - 90);
  assert.deepEqual(v2.ledger, oldLedger);
  assert.equal(v2.customizations['starter-sedan'].colorId, 'coral');
  assert.equal(v2.customizations['starter-sedan'].upgrades.engine, 1);
  assert.deepEqual(v2.ownedVehicleIds, []); assert.equal(v2.selectedOwnedId, null);
  const bought = purchase(v2, 'owned-hatch');
  assert.equal(bought.ok, true); assert.equal(bought.progress.money, v2.money - 250);
  assert.equal(bought.progress.customizations['starter-sedan'].upgrades.engine, 1);
  assert.equal(bought.progress.ledger.at(-1).missionCount, 1);
});

test('ownership ledger replay derives money, rejects illegal prefixes and cannot borrow later mission rewards', () => {
  const buy = transaction('buy', 'purchase', 'owned-hatch');
  const raw = { version: 3, completed: [MISSIONS[0].id], ledger: [buy], money: 9999, ownedVehicleIds: ['owned-suv'],
    selectedOwnedId: 'owned-suv', customizations: { 'owned-hatch': { upgrades: { engine: 2 } } }, ownedVehicleHealth: { 'owned-suv': 100 } };
  const canonical = sanitizeProgress(raw);
  assert.equal(canonical.money, 600); assert.deepEqual(canonical.ownedVehicleIds, ['owned-hatch']);
  assert.equal(canonical.selectedOwnedId, null); assert.deepEqual(canonical.customizations, {});
  assert.deepEqual(canonical.ownedVehicleHealth, { 'owned-hatch': 100 });
  for (const illegal of [transaction('up', 'upgrade', 'owned-hatch', { value: 'engine' }), transaction('rescue', 'recover', 'owned-hatch'),
    transaction('not-known', 'purchase', 'owned-limo')]) {
    const result = sanitizeProgress({ ...raw, ledger: [illegal, buy] });
    assert.equal(result.money, 850); assert.deepEqual(result.ownedVehicleIds, []); assert.deepEqual(result.ledger, []);
  }
  for (const next of [{ ...buy, id: 'again' }, { ...buy, vehicleId: 'owned-sedan' }, transaction('future', 'purchase', 'owned-suv')]) {
    const result = sanitizeProgress({ ...raw, ledger: [buy, next] });
    assert.deepEqual(result.ledger, [buy]); assert.equal(result.money, 600);
  }
  const lateFunds = sanitizeProgress({ ...raw, ledger: [buy, transaction('second', 'purchase', 'owned-sedan', { missionCount: 1 })] });
  assert.equal(lateFunds.money, 250); assert.equal(lateFunds.ownedVehicleIds.length, 2);
  const mixedDuplicate = sanitizeProgress({ ...raw, ledger: [buy, transaction('buy', 'paint', 'owned-hatch', { value: 'coral' })] });
  assert.equal(mixedDuplicate.ledger.length, 1);
});

test('health snapshots are bounded and never heal a stored car, and selection remains a harmless preference', () => {
  const bought = purchase(freshProgress(), 'owned-hatch').progress;
  const selected = selectOwnedVehicle(bought, 'owned-hatch');
  assert.equal(selected.selectedOwnedId, 'owned-hatch'); assert.equal(bought.selectedOwnedId, null);
  const damaged = setOwnedVehicleHealth(selected, { id: 'owned-hatch', vehicleHealth: 42.25 });
  const returned = createOwnedVehicle(damaged, 'owned-hatch', collection);
  const stored = setOwnedVehicleHealth(damaged, returned);
  assert.equal(stored.ownedVehicleHealth['owned-hatch'], 42);
  assert.equal(createOwnedVehicle(stored, 'owned-hatch', collection).vehicleHealth, 42);
  assert.equal(selectOwnedVehicle(stored, null).selectedOwnedId, null);
  assert.equal(setOwnedVehicleHealth(stored, { id: 'owned-hatch', vehicleHealth: NaN }).ownedVehicleHealth['owned-hatch'], 42);
  for (const [health, expected] of [[-4, 0], [150, 100], [42.9, 42], [NaN, 0], [Infinity, 0], ['100', 0]]) {
    const result = sanitizeProgress({ ...bought, ownedVehicleHealth: { 'owned-hatch': health, 'owned-suv': 100, '__proto__': 100 } });
    assert.deepEqual(result.ownedVehicleHealth, { 'owned-hatch': expected });
  }
  assert.equal(setOwnedVehicleHealth(stored, { id: 'owned-hatch', damageStage: 'wreck', vehicleHealth: 100 }).ownedVehicleHealth['owned-hatch'], 0);
});

test('private garage revalidates proximity, stop, wanted and lifecycle for both pedestrians and drivers', () => {
  assert.equal(ownershipEligibility(footContext()).ok, true);
  for (const player of [undefined, null, {}, { x: NaN, z: collection.z }, { x: collection.x, z: Infinity }]) {
    assert.equal(ownershipEligibility(footContext({ player })).reason, 'distance');
    assert.equal(purchase(freshProgress(), 'owned-hatch', 'invalid-location', { player }).ok, false);
  }
  const civilian = { ...createFleet()[0], ...collection, id: 'starter-sedan', speed: 0, vehicleHealth: 100 };
  const driving = footContext({ walking: false, vehicle: civilian, controlledId: civilian.id });
  assert.equal(ownershipEligibility(driving).ok, true);
  const changes = [
    [{ wantedLevel: 1 }, 'wanted'], [{ dead: true }, 'dead'], [{ transition: { kind: 'enter' } }, 'busy'],
    [{ player: { x: collection.x, z: collection.z, speed: 0, y: .16 } }, 'busy'],
    [{ player: { x: collection.x + 7.01, z: collection.z, speed: 0 } }, 'distance'],
  ];
  for (const [override, reason] of changes) {
    const result = purchase(freshProgress(), 'owned-hatch', 'refused', override);
    assert.equal(result.reason, reason); assert.deepEqual(result.progress, freshProgress());
  }
  assert.equal(ownershipEligibility({ ...driving, vehicle: { ...civilian, speed: -1.1 } }).reason, 'moving');
  assert.equal(ownershipEligibility({ ...driving, player: { ...driving.player, speed: 1.1 } }).reason, 'moving');
  assert.equal(ownershipEligibility({ ...driving, vehicle: { ...civilian, damageStage: 'burning' } }).reason, 'destroyed');
  assert.equal(ownershipEligibility({ ...driving, vehicle: { ...civilian, kind: 'police' } }).reason, 'vehicle');
  assert.equal(ownershipEligibility({ ...driving, vehicle: { ...civilian, x: collection.x + 8 } }).reason, 'distance');
  assert.equal(ownershipEligibility(footContext({ player: { x: collection.x + 7, z: collection.z, speed: 1 } })).ok, true);
  assert.equal(ownershipEligibility(footContext({ player: { x: collection.x, z: collection.z, speed: 8, y: 0 } })).ok, true, 'opening a modal stops a walking player without waiting for another physics tick');
});

test('v3 ownership, preference and damage survive storage while blocked storage keeps the session usable', () => {
  let progress = purchase(freshProgress(), 'owned-hatch').progress;
  progress = selectOwnedVehicle(setOwnedVehicleHealth(progress, { id: 'owned-hatch', vehicleHealth: 33 }), 'owned-hatch');
  const entries = new Map(), storage = { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) };
  assert.equal(saveProgress(storage, progress), true); assert.equal(STORAGE_KEY, 'hedo-gta-v1');
  const reloaded = loadProgress(storage);
  assert.deepEqual(reloaded, progress); assert.equal(reloaded.version, 4);
  assert.equal(createOwnedVehicle(reloaded, 'owned-hatch', collection).vehicleHealth, 33);
  assert.equal(saveProgress({ setItem() { throw new Error('blocked'); } }, progress), false);
  assert.equal(progress.money, 250); assert.deepEqual(progress.ownedVehicleIds, ['owned-hatch']);
  assert.equal(progress.vehicle, undefined); assert.equal(progress.fleet, undefined);
});
