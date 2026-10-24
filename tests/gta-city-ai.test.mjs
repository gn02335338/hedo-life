import test from 'node:test';
import assert from 'node:assert/strict';
import { createCrowd, stepCrowd } from '../dist/gta/crowd.js';
import { createFleet, stepFleet, takeCar } from '../dist/gta/fleet.js';
import { createAwareness, stepAwareness } from '../dist/gta/awareness.js';
import { createCombatState, selectWeapon, stepCombat } from '../dist/gta/combat.js';
import { BUILDINGS } from '../dist/gta/world.js';

const player = { x: 7, z: 32, speed: 0, heading: 0 };
const law = { level: 0, phase: 'clear', units: [] };
function initial() {
  return { crowd: createCrowd(), fleet: createFleet(), awareness: createAwareness(),
    combat: { ...selectWeapon(createCombatState(), 'pistol'), cooldown: 0 } };
}
function frame(state, fire, dt = 1 / 60, controlledId = null) {
  const fleet = stepFleet(state.fleet, dt, { player, pedestrians: state.crowd, threats: state.awareness.threats, controlledId });
  const combat = stepCombat(state.combat, { player, walking: true, fire, aimYaw: 0,
    police: law, obstacles: BUILDINGS, traffic: fleet }, dt);
  const awareness = stepAwareness(state.awareness, combat.events, dt);
  const crowd = stepCrowd(state.crowd, dt, { threats: awareness.threats, vehicles: fleet, player });
  return { crowd, fleet, awareness, combat };
}

test('a real trigger pull reaches nearby pedestrians and traffic, while distant traffic stays calm', () => {
  const original = initial(), before = structuredClone(original);
  let state = frame(original, true);
  assert.equal(state.combat.weapons.pistol.mag, 11);
  assert.equal(state.crowd[0].mode, 'startled');
  const start = { x: state.crowd[0].x, z: state.crowd[0].z };
  state = frame(state, false); // Traffic consumes the shared event on the next fixed tick.
  assert.ok(state.fleet.find(car => car.id === 'traffic-coral').threatTimer > 0);
  assert.equal(state.fleet.find(car => car.id === 'traffic-green').threatTimer || 0, 0);
  for (let tick = 0; tick < 90; tick++) state = frame(state, false);
  assert.equal(state.crowd[0].mode, 'flee');
  assert.ok(Math.hypot(state.crowd[0].x - player.x, state.crowd[0].z - player.z)
    > Math.hypot(start.x - player.x, start.z - player.z) + 2);
  assert.deepEqual(original, before);
});

test('one isolated shot clears without persistence, while controlled cars retain their exact state', () => {
  let state = initial();
  state.fleet = takeCar(state.fleet, 'traffic-coral');
  const owned = structuredClone(state.fleet.find(car => car.id === 'traffic-coral'));
  state = frame(state, true, 1 / 60, owned.id);
  for (let tick = 0; tick < 15 * 60; tick++) state = frame(state, false, 1 / 60, owned.id);
  assert.deepEqual(state.awareness.threats, []);
  assert.ok(state.crowd.every(person => person.mode === 'walk'));
  assert.ok(state.fleet.every(car => !(car.threatTimer > 0)));
  assert.deepEqual(state.fleet.find(car => car.id === owned.id), owned);
  assert.equal(state.combat.weapons.pistol.mag, 11);
  assert.equal(state.crowd.length, 12);
  assert.equal(state.fleet.length, createFleet().length);
});

test('pausing the combined AI freezes positions, reactions and sensory lifetimes', () => {
  let state = frame(initial(), true);
  for (let tick = 0; tick < 40; tick++) state = frame(state, false);
  const before = structuredClone(state);
  // The application skips simulation entirely for menus/background; the pure
  // AI APIs also tolerate a zero-delta render/inspection without advancing.
  assert.deepEqual(stepCrowd(state.crowd, 0, { threats: state.awareness.threats, vehicles: state.fleet, player }), state.crowd);
  assert.deepEqual(stepFleet(state.fleet, 0, { threats: state.awareness.threats, pedestrians: state.crowd, player }), state.fleet);
  assert.deepEqual(stepAwareness(state.awareness, [], 0), state.awareness);
  assert.deepEqual(state, before);
});
