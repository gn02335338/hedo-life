import test from 'node:test';
import assert from 'node:assert/strict';
import { createAwareness, stepAwareness, AWARENESS_RULES } from '../dist/gta/awareness.js';
import { createCombatState, selectWeapon, stepCombat, getPoliceCombatants } from '../dist/gta/combat.js';

test('only actual shots and collisions create local sensory events; empty clicks and crime reports do not', () => {
  const initial = createAwareness(), before = structuredClone(initial);
  const events = [{ type: 'shot', shooter: 'player', position: { x: 7, z: 32 } },
    { type: 'collision', position: { x: -40, z: 0 } }, { type: 'dryFire', position: { x: 0, z: 0 } },
    { type: 'crime', position: { x: 0, z: 0 } }, { type: 'shot', position: { x: NaN, z: 1 } }];
  const result = stepAwareness(initial, events, 1 / 60);
  assert.deepEqual(initial, before);
  assert.equal(result.threats.length, 2);
  assert.deepEqual(result.threats.map(threat => threat.kind), ['gunshot', 'collision']);
  assert.equal(result.threats[0].radius, AWARENESS_RULES.gunshotRadius);
  assert.equal(result.threats[0].x, 7);
  events[0].position.x = 999;
  assert.equal(result.threats[0].x, 7);
});

test('bursts renew identity without growing memory, while dispersed hazards have a fixed bound', () => {
  let state = createAwareness();
  for (let i = 0; i < 1000; i++) state = stepAwareness(state, [{ type: 'shot', position: { x: 2, z: 3 } }], 1 / 60);
  assert.equal(state.threats.length, 1);
  assert.equal(state.threats[0].id, 1000);
  state = stepAwareness(state, Array.from({ length: 100 }, (_, index) => ({ type: 'shot', position: { x: index * 8, z: 0 } })), 1 / 60);
  assert.equal(state.threats.length, AWARENESS_RULES.maxThreats);
  assert.equal(state.threats.at(-1).x, 792);
});

test('pause freezes sensory time, silence expires hazards and frame rates agree', () => {
  const initial = stepAwareness(createAwareness(), [{ type: 'shot', position: { x: 0, z: 0 } }], 1 / 60);
  for (const dt of [0, -1, NaN]) assert.deepEqual(stepAwareness(initial, [{ type: 'shot', position: { x: 8, z: 0 } }], dt), initial);
  const run = fps => { let state = initial; for (let i = 0; i < fps * 2; i++) state = stepAwareness(state, [], 1 / fps); return state; };
  assert.deepEqual(run(30), run(60));
  assert.deepEqual(run(60).threats, []);
  assert.equal(createAwareness().nextId, 1);
});

test('combat exports the real player and police muzzle positions for civilian hearing', () => {
  const player = { x: -2.8, z: 12, heading: 0, speed: 0 };
  const police = { level: 2, phase: 'pursuit', units: [{ id: 'patrol', kind: 'police', x: 0, z: -12, heading: 0, speed: 0 }] };
  let state = { ...selectWeapon(createCombatState(), 'pistol'), cooldown: 0 };
  const context = { player, walking: true, fire: true, aimYaw: Math.PI / 2, police, obstacles: [], traffic: [] };
  state = stepCombat(state, context, 1 / 60);
  assert.deepEqual(state.events.find(event => event.shooter === 'player').position, { x: player.x, z: player.z });
  let policeShot;
  for (let i = 0; i < 120 && !policeShot; i++) {
    state = stepCombat(state, { ...context, fire: false }, 1 / 60);
    policeShot = state.events.find(event => event.shooter === 'police');
  }
  const officer = getPoliceCombatants(police, state, [], [])[0];
  assert.ok(policeShot);
  assert.deepEqual(policeShot.position, { x: officer.x, z: officer.z });
  assert.notDeepEqual(policeShot.position, { x: player.x, z: player.z });
});
