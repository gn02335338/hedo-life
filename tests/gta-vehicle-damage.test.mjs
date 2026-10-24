import test from 'node:test';
import assert from 'node:assert/strict';
import { VEHICLE_DAMAGE_RULES as RULES, createVehicleDamageState, stepVehicleDamage } from '../dist/gta/vehicle-damage.js';

const car = (id = 'car-1', overrides = {}) => ({ id, x: 0, z: 0, heading: 0, speed: 12, kind: 'parked', occupied: true, ...overrides });
const context = overrides => ({ vehicles: [car()], player: { x: 30, z: 30 }, obstacles: [], ...overrides });
const bullet = (targetId = 'car-1', damage = 18, source = 'player') => ({ type: 'vehicleHit', targetId, damage, source });
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);
function simulate(initial, input, seconds, fps = 60) {
  let state = initial, vehicles = input.vehicles, playerDamage = 0;
  const events = [];
  for (let frame = 0; frame < Math.round(seconds * fps); frame += 1) {
    const result = stepVehicleDamage(state, { ...input, vehicles }, 1 / fps);
    state = result.state; vehicles = result.vehicles; playerDamage += result.playerDamage; events.push(...state.events);
  }
  return { state, vehicles, playerDamage, events };
}
function freeze(value) {
  for (const child of Object.values(value)) if (child && typeof child === 'object') freeze(child);
  return Object.freeze(value);
}

test('damage thresholds preserve vehicle identity and metadata without changing source data', () => {
  const state = freeze(createVehicleDamageState());
  const input = freeze(context({ vehicles: [car('car-1', { color: 0xff00aa, route: [1, 2], stolen: true })], hits: [bullet('car-1', 35)] }));
  const first = stepVehicleDamage(state, input, 1 / 60);
  assert.equal(first.vehicles[0].vehicleHealth, 65);
  assert.equal(first.vehicles[0].damageStage, 'damaged');
  assert.equal(first.vehicles[0].speed, 12);
  assert.equal(first.vehicles[0].color, 0xff00aa);
  assert.equal(first.vehicles[0].stolen, true);
  assert.deepEqual(first.vehicles[0].route, [1, 2]);
  assert.equal(input.vehicles[0].vehicleHealth, undefined);
  assert.deepEqual(state, createVehicleDamageState());
  const second = stepVehicleDamage(first.state, { ...input, vehicles: first.vehicles }, 1 / 60);
  assert.equal(second.vehicles[0].vehicleHealth, 30);
  assert.equal(second.vehicles[0].damageStage, 'smoking');
  const invalid = stepVehicleDamage(second.state, context({ vehicles: second.vehicles,
    hits: [bullet('missing', 100), bullet('car-1', NaN), bullet('car-1', -10), { type: 'hit', targetId: 'car-1', damage: 100 }] }), 1 / 60);
  assert.equal(invalid.vehicles[0].vehicleHealth, 30);
  assert.deepEqual(invalid.state.events, []);
});

test('zero health gives a three-second escape window and a wreck explodes only once', () => {
  const input = context({ hits: [bullet('car-1', 100)] });
  const ignited = stepVehicleDamage(createVehicleDamageState(), input, 1 / 60);
  assert.equal(ignited.vehicles[0].damageStage, 'burning');
  assert.equal(ignited.vehicles[0].speed, 0);
  close(ignited.vehicles[0].burnRemaining, RULES.burnSeconds - 1 / 60);
  assert.equal(ignited.state.events.filter(event => event.type === 'vehicleBurning').length, 1);
  const before = simulate(ignited.state, { ...input, vehicles: ignited.vehicles, collisions: [{ vehicleId: 'car-1', speed: 100 }] }, 2.9);
  assert.equal(before.vehicles[0].damageStage, 'burning');
  assert.equal(before.events.length, 0, 'extra bullets and collisions cannot shorten or restart the fuse');
  const exploded = simulate(before.state, { ...input, vehicles: before.vehicles }, 5 / 60);
  assert.equal(exploded.vehicles[0].damageStage, 'wreck');
  close(exploded.vehicles[0].wreckAge, 0);
  assert.deepEqual(exploded.events.filter(event => event.type === 'vehicleExploded'), [{
    type: 'vehicleExploded', vehicleId: 'car-1', position: { x: 0, z: 0 }, radius: RULES.explosionRadius, source: 'player',
  }]);
  assert.equal(exploded.playerDamage, 0, 'escaping beyond the blast radius is safe');
  const later = simulate(exploded.state, { ...input, vehicles: exploded.vehicles }, 5);
  assert.equal(later.vehicles[0].vehicleHealth, 0);
  close(later.vehicles[0].wreckAge, 5);
  assert.equal(later.events.length, 0);
  assert.equal(later.state.explosions.length, 0);
});

test('collision damage uses impact speed, affects both shells once and has a contact cooldown', () => {
  const vehicles = [car('a'), car('b', { x: 4 })];
  const harmless = stepVehicleDamage(createVehicleDamageState(), context({ vehicles,
    collisions: [{ vehicleId: 'a', speed: 4 }, { vehicleId: 'a', speed: NaN }] }), 1 / 60);
  assert.equal(harmless.vehicles[0].vehicleHealth, 100);
  const collisions = [{ vehicleId: 'a', otherId: 'b', speed: -10 }, { vehicleId: 'b', otherId: 'a', speed: 10 }];
  const first = stepVehicleDamage(harmless.state, context({ vehicles: harmless.vehicles, collisions }), 1 / 60);
  close(first.vehicles[0].vehicleHealth, 86.5);
  close(first.vehicles[1].vehicleHealth, 90.55);
  assert.equal(first.state.events.length, 2);
  const held = simulate(first.state, context({ vehicles: first.vehicles, collisions }), 1);
  assert.equal(held.events.length, 0);
  assert.equal(held.vehicles[0].vehicleHealth, first.vehicles[0].vehicleHealth);
  const again = simulate(held.state, context({ vehicles: held.vehicles, collisions }), .2);
  close(again.vehicles[0].vehicleHealth, 73);
  assert.equal(again.events.length, 2);
  const severe = stepVehicleDamage(createVehicleDamageState(), context({ collisions: [{ vehicleId: 'car-1', speed: 999 }] }), 1 / 60);
  assert.equal(severe.vehicles[0].vehicleHealth, 35, 'one hard impact does not instantly explode a fresh vehicle');
});

test('explosion damage falls off with distance, stops at buildings and kills a driver inside its shell', () => {
  const ready = car('car-1', { damageStage: 'burning', burnRemaining: 1 / 60 });
  const explodeAt = (x, overrides = {}) => stepVehicleDamage(createVehicleDamageState(), context({ vehicles: [ready], player: { x, z: 0 }, ...overrides }), 1 / 60);
  assert.equal(explodeAt(0).playerDamage, 100);
  close(explodeAt(3).playerDamage, 80);
  close(explodeAt(8).playerDamage, 120 / 9);
  assert.equal(explodeAt(9).playerDamage, 0);
  assert.equal(explodeAt(3, { obstacles: [{ x: 1.5, z: 0, w: 1, d: 8 }] }).playerDamage, 0);
  assert.equal(explodeAt(30, { controlledId: 'car-1' }).playerDamage, 100, 'own shell never shields the driver');
  const shielded = stepVehicleDamage(createVehicleDamageState(), context({ vehicles: [ready, car('behind', { x: 3 })],
    obstacles: [{ x: 1.5, z: 0, w: 1, d: 8 }] }), 1 / 60);
  assert.equal(shielded.vehicles[1].vehicleHealth, 100);
});

test('nearby vehicles chain with their own complete fuse, while remote cars and wrecks stay unchanged', () => {
  const vehicles = [car('origin', { damageStage: 'burning', burnRemaining: 1 / 60 }), car('near', { x: 3 }),
    car('edge', { x: 8 }), car('outside', { x: 12 }), car('old-wreck', { x: 1, damageStage: 'wreck', wreckAge: 10 })];
  const first = stepVehicleDamage(createVehicleDamageState(), context({ vehicles }), 1 / 60);
  assert.equal(first.vehicles[0].damageStage, 'wreck');
  assert.equal(first.vehicles[1].damageStage, 'burning');
  close(first.vehicles[1].burnRemaining, RULES.burnSeconds);
  close(first.vehicles[2].vehicleHealth, 100 - 160 / 9);
  assert.equal(first.vehicles[3].vehicleHealth, 100);
  close(first.vehicles[4].wreckAge, 10 + 1 / 60);
  assert.equal(first.state.events.filter(event => event.type === 'vehicleExploded').length, 1);
  const before = simulate(first.state, context({ vehicles: first.vehicles }), 2.9);
  assert.equal(before.vehicles[1].damageStage, 'burning');
  const second = simulate(before.state, context({ vehicles: before.vehicles }), .1);
  assert.equal(second.vehicles[1].damageStage, 'wreck');
  assert.equal(second.events.filter(event => event.type === 'vehicleExploded').length, 1);
  assert.equal(second.events.find(event => event.type === 'vehicleExploded').vehicleId, 'near');
  assert.equal(second.events.some(event => event.vehicleId === 'old-wreck'), false);
});

test('short-lived effects, single-step events and collision IDs stay bounded and are reclaimed', () => {
  const state = createVehicleDamageState(); state.collisionCooldowns = { removed: .8, 'car-0': .8 };
  const vehicles = Array.from({ length: 12 }, (_, index) => car(`car-${index}`, { x: index * 20, damageStage: 'burning', burnRemaining: 1 / 120 }));
  const exploded = stepVehicleDamage(state, context({ vehicles }), 1 / 60);
  assert.equal(exploded.state.explosions.length, RULES.maxExplosions);
  assert.equal(new Set(exploded.state.explosions.map(effect => effect.id)).size, RULES.maxExplosions);
  assert.equal(exploded.state.events.filter(event => event.type === 'vehicleExploded').length, 12);
  assert.equal('removed' in exploded.state.collisionCooldowns, false);
  const empty = stepVehicleDamage(exploded.state, context({ vehicles: [] }), 1 / 60);
  assert.deepEqual(empty.state.collisionCooldowns, {});
  assert.deepEqual(empty.state.events, []);
  const expired = simulate(empty.state, context({ vehicles: [] }), RULES.explosionSeconds);
  assert.deepEqual(expired.state.explosions, []);
  const many = stepVehicleDamage(createVehicleDamageState(), context({ hits: Array.from({ length: 200 }, () => bullet('car-1', .01)) }), 1 / 60);
  assert.equal(many.state.events.length, RULES.maxEvents);
  close(many.vehicles[0].vehicleHealth, 98);
});

test('paused or invalid time is a complete no-op even with pending impacts', () => {
  const state = freeze({ ...createVehicleDamageState(), events: [{ type: 'existing' }], explosions: [{ id: 'fx', age: .4, duration: 2.4 }] });
  const input = freeze(context({ vehicles: [car('car-1', { damageStage: 'burning', burnRemaining: .05 })], hits: [bullet('car-1', 100)] }));
  for (const dt of [0, -1, NaN, Infinity]) {
    const result = stepVehicleDamage(state, input, dt);
    assert.equal(result.state, state);
    assert.equal(result.vehicles, input.vehicles);
    assert.equal(result.playerDamage, 0);
  }
  assert.deepEqual(stepVehicleDamage(state, input, 30), stepVehicleDamage(state, input, .1));
});

test('damage, chain fuse timing and effect aging are deterministic at 30 and 60 Hz', () => {
  function run(fps) {
    let state = createVehicleDamageState(), vehicles = [car('a'), car('b', { x: 3 }), car('c', { x: 25 })];
    const events = []; let playerDamage = 0;
    for (let frame = 0; frame < fps * 7; frame += 1) {
      const result = stepVehicleDamage(state, context({ vehicles, hits: frame === 0 ? [bullet('a', 100)] : [], player: { x: 7, z: 0 } }), 1 / fps);
      state = result.state; vehicles = result.vehicles; playerDamage += result.playerDamage; events.push(...state.events);
    }
    return { state, vehicles, playerDamage, events };
  }
  assert.deepEqual(run(30), run(60));
});
