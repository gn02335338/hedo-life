import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/island/vendor/three.module.js';
import { createEventCursor } from '../dist/arpg/combat-events.js';
import { createFeedback } from '../dist/arpg/feedback.js';
import { createCombatVisuals } from '../dist/arpg/combat-visuals.js';
import { movementToWorld } from '../dist/arpg/scene.js';
import { attackPhase, advanceLocomotion } from '../dist/arpg/art-layer.js';
import { createGame, startGame, stepGame, FIXED_STEP } from '../dist/arpg/engine.js';

test('presentation events play once, skip stale history, and resume after a new run', () => {
  const cursor = createEventCursor();
  const state = { runId: 1, time: 2, combatEvents: [{ serial: 1, time: 1 }, { serial: 2, time: 1.95 }] };
  assert.deepEqual(cursor.read(state).map(event => event.serial), [2]);
  assert.deepEqual(cursor.read(state), []);
  state.time = 2.05; state.combatEvents.push({ serial: 3, time: 2.05 });
  assert.deepEqual(cursor.read(state).map(event => event.serial), [3]);
  state.runId = 2; state.time = 0.02; state.combatEvents = [{ serial: 1, time: 0.02 }];
  assert.deepEqual(cursor.read(state).map(event => event.serial), [1]);
});

test('screen movement follows the actual camera axes without a seven-degree drift', () => {
  const up = movementToWorld(0, -1), right = movementToWorld(1, 0);
  // Real screen-right basis for a camera at (17,25,22).
  assert.ok(Math.abs(up.x * 22 - up.z * 17) < 1e-12);
  assert.ok(Math.abs(right.x * 17 + right.z * 22) < 1e-12);
  assert.ok(right.x * 22 - right.z * 17 > 0);
  assert.ok(up.x * 17 + up.z * 22 < 0);
  assert.ok(Math.abs(Math.hypot(up.x, up.z) - 1) < 1e-12);
  assert.ok(Math.abs(Math.hypot(right.x, right.z) - 1) < 1e-12);
});

test('each real engine contact already selects the strike pose, including the second combo float boundary', () => {
  const state = createGame({ seed: 7 }); state.enemies = []; startGame(state);
  const found = new Set(); let serial = 0;
  for (let i = 0; i < 100; i++) {
    stepGame(state, { attack: true }, FIXED_STEP);
    const strike = state.combatEvents.findLast(event => event.type === 'strike');
    if (strike && strike.serial !== serial) {
      serial = strike.serial; found.add(strike.combo);
      assert.equal(attackPhase(state.player.action), 'strike');
    }
  }
  assert.deepEqual([...found].sort(), [1, 2, 3]);
});

test('120Hz rendering keeps a continuous gait between 60Hz physics ticks and settles promptly after release', () => {
  const state = createGame(); state.enemies = []; startGame(state);
  const gait = { phase: 0, motion: 0 };
  let previous = state.player.z, started = false;
  for (let i = 0; i < 80; i++) {
    stepGame(state, { z: -1 }, 1 / 120);
    const moved = Math.abs(state.player.z - previous); previous = state.player.z;
    const walking = advanceLocomotion(gait, moved, 1 / 120);
    if (moved > 0) started = true;
    if (started) assert.equal(walking, true, `paint ${i} retains walk even when the simulation has no new position`);
  }
  assert.ok(gait.phase > 3);
  for (let i = 0; i < 7; i++) advanceLocomotion(gait, 0, 1 / 120);
  assert.equal(gait.motion, 0, 'release settles to idle in under 60ms');
});

test('20, 30 and 60 fps all preserve a fresh impact frame and dispose their bounded presentation objects', () => {
  for (const dt of [1 / 20, 1 / 30, 1 / 60]) {
    const scene = new THREE.Scene();
    const ctx = { clearRect() {}, strokeText() {}, fillText() {} };
    const doc = { createElement: () => ({ getContext: () => ctx }) };
    const host = { innerWidth: 390, matchMedia: () => ({ matches: false }) };
    const fx = createCombatVisuals({ scene, host, doc });
    const state = { runId: 1, time: 1, enemies: [], combatEvents: [{ type: 'hit', serial: 1, time: 1, targetId: 'enemy', damage: 15, x: 0, z: 0 }] };
    fx.update(state, dt);
    assert.equal(fx.held('player'), true, `${Math.round(1 / dt)}fps contact owns a rendered frame`);
    fx.update(state, 0.08);
    assert.equal(fx.held('player'), false);
    fx.destroy(); assert.equal(scene.children.length, 0);
  }
});

test('audio requires a gesture, does not replay contacts, and mute/unsupported browsers stay silent', () => {
  let instances = 0, starts = 0, closed = 0;
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = () => ({ connect() {}, disconnect() {}, gain: param(), frequency: param(), Q: param(), start() { starts++; }, stop() {} });
  class Audio {
    constructor() { instances++; this.state = 'running'; this.currentTime = 1; this.sampleRate = 1000; this.destination = {}; }
    createGain() { return node(); }
    createBuffer() { return { getChannelData: () => new Float32Array(700) }; }
    createBufferSource() { return node(); }
    createOscillator() { return node(); }
    createBiquadFilter() { return node(); }
    close() { closed++; return Promise.resolve(); }
  }
  const feedback = createFeedback({ host: { AudioContext: Audio } });
  const state = { runId: 1, time: 1, player: { x: 0, z: 0 }, combatEvents: [{ serial: 1, time: 1, type: 'hit', weapon: 'mug' }] };
  feedback.consume(state); assert.equal(instances, 0); assert.equal(starts, 0);
  feedback.unlock(); assert.equal(instances, 1);
  state.time += 0.1; state.combatEvents.push({ serial: 2, time: state.time, type: 'hit', weapon: 'mug' });
  feedback.consume(state); assert.equal(starts, 3, 'mug has one impact, one thud and one metallic layer');
  feedback.consume(state); assert.equal(starts, 3);
  feedback.toggle(); state.time += 0.1; state.combatEvents.push({ serial: 3, time: state.time, type: 'strike' });
  feedback.consume(state); assert.equal(starts, 3);
  feedback.destroy(); assert.equal(closed, 1);
  const silent = createFeedback({ host: {} }); silent.unlock(); silent.consume(state); silent.destroy();
});
