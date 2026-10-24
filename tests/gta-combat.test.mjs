import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILDINGS } from '../dist/gta/world.js';
import { COMBAT_RULES, WEAPONS, createCombatState, selectWeapon, startReload, stepCombat, applyDamage, getAimTarget, getPoliceCombatants } from '../dist/gta/combat.js';

const patrol = (id = 'police-1', overrides = {}) => ({ id, kind: 'police', x: 0, z: -15, heading: 0, speed: 0, occupied: true, ...overrides });
const police = (level = 1, units = [patrol()]) => ({ level, phase: 'pursuit', units });
const input = overrides => ({ player: { x: -2.8, z: 0, heading: 0, speed: 0 }, walking: true, aimYaw: 0, aiming: false, obstacles: [], traffic: [], ...overrides });
function ready(id = 'pistol') { return { ...selectWeapon(createCombatState(), id), cooldown: 0 }; }
function simulate(state, context, seconds, fps = 60) {
  const events = [];
  for (let i = 0; i < seconds * fps; i += 1) {
    state = stepCombat(state, context, 1 / fps); events.push(...state.events);
  }
  return { state, events };
}

test('loadout starts unarmed and switching cannot create ammunition or bypass death', () => {
  const state = createCombatState(), snapshot = structuredClone(state);
  const fired = simulate(state, input({ fire: true }), 1).state;
  assert.deepEqual(state, snapshot);
  assert.equal(state.weaponId, 'unarmed');
  assert.equal(fired.weapons.pistol.mag, 12);
  assert.equal(fired.tracers.length, 0);
  assert.equal(selectWeapon(state, 'smg').weaponId, 'smg');
  assert.equal(selectWeapon(state, '__proto__').weaponId, 'unarmed');
  assert.equal(selectWeapon(applyDamage(state, 100), 'smg').weaponId, 'unarmed');
});

test('pistol and SMG fire at bounded cadence, consume magazines and throttle gunfire reports', () => {
  const pistol = simulate(ready(), input({ fire: true }), 1);
  const smg = simulate(ready('smg'), input({ fire: true }), 1);
  const pistolShots = pistol.events.filter(event => event.type === 'shot');
  const smgShots = smg.events.filter(event => event.type === 'shot');
  assert.equal(pistolShots.length, 5);
  assert.ok(smgShots.length >= 10 && smgShots.length <= 12);
  assert.equal(pistol.state.weapons.pistol.mag, 12 - pistolShots.length);
  assert.equal(smg.state.weapons.smg.mag, 30 - smgShots.length);
  assert.equal(smg.events.filter(event => event.type === 'crime').length, 1);
  const empty = simulate(ready('smg'), input({ fire: true }), 4);
  assert.equal(empty.state.weapons.smg.mag, 0);
  assert.equal(empty.events.filter(event => event.type === 'shot').length, 30);
  assert.ok(empty.events.some(event => event.type === 'dryFire'));
  assert.equal(empty.state.weapons.smg.reserve, 150);
});

test('reload conserves ammo, respects its duration and cancels safely on weapon switch', () => {
  const state = ready(); state.weapons.pistol = { mag: 4, reserve: 3 };
  const reloading = startReload(state);
  assert.equal(state.reload, null);
  assert.equal(reloading.reload.remaining, WEAPONS.pistol.reloadSeconds);
  const before = simulate(reloading, input({ fire: true }), 1).state;
  assert.equal(before.weapons.pistol.mag, 4);
  assert.ok(before.reload);
  const complete = simulate(reloading, input(), 1.3).state;
  assert.deepEqual(complete.weapons.pistol, { mag: 7, reserve: 0 });
  assert.equal(complete.reload, null);
  assert.equal(startReload(complete).reload, null);
  const switched = selectWeapon(reloading, 'smg');
  assert.equal(switched.reload, null);
  assert.deepEqual(switched.weapons.pistol, state.weapons.pistol);
});

test('disabled transitions freeze timers and weapons cannot fire while driving', () => {
  const state = ready(); state.weapons.pistol.mag = 5;
  const reloading = startReload(state);
  const blocked = simulate(reloading, input({ fire: true, enabled: false, police: police(2) }), 3).state;
  assert.deepEqual(blocked, reloading);
  const driving = simulate(ready(), input({ walking: false, fire: true }), 1).state;
  assert.equal(driving.weapons.pistol.mag, 12);
  assert.equal(driving.hostile, false);
  assert.deepEqual(stepCombat(ready(), input({ fire: true }), 0), ready());
});

test('hitscan damages the nearest officer, reports one down event and never hits a corpse twice', () => {
  const law = police(1, [patrol(), patrol('police-2', { z: -25 })]);
  const first = stepCombat(ready(), input({ fire: true, police: law }), 1 / 60);
  assert.equal(first.officers['police-1'].health, 41);
  assert.equal(first.officers['police-2'].health, 75);
  const burst = simulate(ready(), input({ fire: true, police: police() }), 1);
  assert.equal(burst.state.officers['police-1'].health, 0);
  assert.equal(burst.state.officers['police-1'].down, true);
  assert.equal(burst.events.filter(event => event.type === 'unitDown').length, 1);
  assert.equal(burst.events.filter(event => event.type === 'crime' && event.crime === 'police-hit').length, 1);
  assert.equal(burst.events.filter(event => event.type === 'hit').length, 3);
  assert.ok(getPoliceCombatants(police(), burst.state, [])[0].down);
});

test('buildings and vehicles stop bullets before officers and block police return fire', () => {
  const wall = { x: -2.8, z: -7, w: 4, d: 2 };
  const wallContext = input({ fire: true, police: police(2), obstacles: [wall] });
  const wallResult = simulate(ready(), wallContext, 3);
  assert.equal(wallResult.state.officers['police-1'].health, 75);
  assert.equal(wallResult.state.health, 100);
  assert.equal(getAimTarget(ready(), wallContext).kind, 'building');
  const cover = { id: 'civilian', x: -2.8, z: -7, heading: 0, speed: 0 };
  const carContext = input({ fire: true, police: police(2), traffic: [cover] });
  const carResult = simulate(ready(), carContext, 3);
  assert.equal(carResult.state.officers['police-1'].health, 75);
  assert.equal(carResult.state.health, 100);
  assert.equal(getAimTarget(ready(), carContext).targetId, 'civilian');
});

test('aim assistance only works while aiming and cannot target through cover', () => {
  const context = input({ player: { x: -4, z: 0 }, police: police(1, [patrol('police-1', { z: -30 })]) });
  assert.notEqual(getAimTarget(ready(), context).kind, 'officer');
  const aimed = getAimTarget(ready(), { ...context, aiming: true });
  assert.equal(aimed.kind, 'officer');
  assert.equal(aimed.y, 1.45);
  const blocked = getAimTarget(ready(), { ...context, aiming: true, obstacles: [{ x: -3, z: -15, w: 6, d: 2 }] });
  assert.equal(blocked.kind, 'building');
});

test('officers deploy only when stopped and occupy clear positions beside their patrol', () => {
  const state = createCombatState();
  assert.deepEqual(getPoliceCombatants(police(2, [patrol('police-1', { speed: 6 })]), state, []), []);
  const law = police(2, [patrol('police-1', { x: 8, z: 20 })]);
  const officer = getPoliceCombatants(law, state, BUILDINGS)[0];
  assert.ok(officer);
  assert.ok(BUILDINGS.every(block => Math.abs(officer.x - block.x) >= block.w / 2 + 0.4 || Math.abs(officer.z - block.z) >= block.d / 2 + 0.4));
  assert.ok(Math.abs(officer.x - 8) > 1.425);
  const clear = getPoliceCombatants(police(), state, []);
  const traffic = [{ id: 'parked', x: clear[0].x, z: clear[0].z, heading: 0 }];
  const shifted = getPoliceCombatants(police(), state, [], traffic)[0];
  assert.ok(shifted && Math.hypot(shifted.x - traffic[0].x, shifted.z - traffic[0].z) > 2);
});

test('one-star theft remains nonlethal, while armed police warn before finite return fire', () => {
  const peaceful = simulate(createCombatState(), input({ police: police(1) }), 6);
  assert.equal(peaceful.state.health, 100);
  assert.equal(peaceful.events.filter(event => event.type === 'shot').length, 0);
  const warning = simulate(createCombatState(), input({ police: police(2) }), 1.3);
  assert.equal(warning.state.health, 100);
  assert.ok(warning.state.officers['police-1'].warning > 1);
  const firstShot = simulate(warning.state, input({ police: police(2) }), 0.2);
  assert.equal(firstShot.state.health, 93);
  assert.equal(firstShot.events.filter(event => event.type === 'shot').length, 1);
  const moving = simulate(createCombatState(), input({ player: { x: -2.8, z: 0, speed: 8 }, police: police(2) }), 5);
  const stopped = simulate(createCombatState(), input({ police: police(2) }), 5);
  assert.ok(moving.state.health > stopped.state.health);
  assert.ok(stopped.events.filter(event => event.type === 'shot').length <= 5);
});

test('cover resets the police warning and dead or downed actors cannot fire', () => {
  const primed = simulate(createCombatState(), input({ police: police(2) }), 1).state;
  const covered = simulate(primed, input({ police: police(2), obstacles: [{ x: -2.8, z: -7, w: 4, d: 2 }] }), 1).state;
  assert.equal(covered.officers['police-1'].warning, 0);
  const returned = simulate(covered, input({ police: police(2) }), 1).state;
  assert.equal(returned.health, 100);
  const down = { ...primed, officers: { 'police-1': { ...primed.officers['police-1'], health: 0, down: true } } };
  const quiet = simulate(down, input({ police: police(2) }), 5);
  assert.equal(quiet.state.health, 100);
  assert.equal(quiet.events.filter(event => event.type === 'shot').length, 0);
  const death = simulate(createCombatState(), input({ police: police(2) }), 25);
  assert.equal(death.state.health, 0);
  assert.equal(death.state.dead, true);
  assert.equal(death.events.filter(event => event.type === 'death').length, 1);
  assert.equal(stepCombat(death.state, input({ fire: true, police: police(2) }), 0.1).events.length, 0);
});

test('stationary armed officers face visible targets and retain their facing behind cover', () => {
  const law = police(2), original = createCombatState();
  const first = stepCombat(original, input({ police: law }), 1 / 60);
  const firstOfficer = getPoliceCombatants(law, first, [])[0];
  assert.equal(Math.abs(firstOfficer.heading), Math.PI);
  const beside = { x: -20, z: -15, speed: 0 };
  const turned = stepCombat(first, input({ police: law, player: beside }), 1 / 60);
  assert.equal(getPoliceCombatants(law, turned, [])[0].heading, -Math.PI / 2);
  assert.deepEqual(getPoliceCombatants(law, turned, [])[0].x, firstOfficer.x);
  const wall = [{ x: -10, z: -7, w: 3, d: 14 }];
  const hidden = stepCombat(turned, input({ police: law, player: { x: -20, z: 0 }, obstacles: wall }), 1 / 60);
  assert.equal(getPoliceCombatants(law, hidden, wall)[0].heading, -Math.PI / 2);
  assert.equal(hidden.officers['police-1'].warning, 0);
  const down = { ...turned, officers: { 'police-1': { ...turned.officers['police-1'], health: 0, down: true } } };
  assert.equal(getPoliceCombatants(law, stepCombat(down, input({ police: law }), 1 / 60), [])[0].heading, -Math.PI / 2);
  assert.deepEqual(original, createCombatState());
});

test('damage is bounded, hostility clears only after the pursuit ends, and effects remain bounded', () => {
  const state = createCombatState(), hit = applyDamage(state, 8);
  assert.equal(state.health, 100);
  assert.equal(hit.health, 92);
  assert.equal(applyDamage(state, NaN).health, 100);
  assert.equal(applyDamage(state, -100).health, 100);
  assert.equal(applyDamage(state, 999).health, 0);
  const fired = stepCombat(ready(), input({ fire: true }), 0.1);
  assert.equal(fired.hostile, true);
  assert.equal(simulate(fired, input(), 3.1).state.hostile, false);
  assert.equal(simulate(fired, input({ police: { level: 1, phase: 'search', units: [] } }), 3.1).state.hostile, true);
  const long = simulate(ready('smg'), input({ fire: true, police: police(2) }), 12).state;
  assert.ok(long.tracers.length <= COMBAT_RULES.maxTracers && long.events.length <= COMBAT_RULES.maxEvents);
});

test('combat is pure, catches suspended-frame bounds and is stable at 30/60 Hz', () => {
  const state = ready('smg'), snapshot = structuredClone(state);
  const context = input({ fire: true, aiming: true, police: police(2) }), inputSnapshot = structuredClone(context);
  const at30 = simulate(state, context, 3, 30), at60 = simulate(state, context, 3, 60);
  assert.deepEqual({ ...at30.state, events: [] }, { ...at60.state, events: [] });
  assert.deepEqual(at30.events, at60.events);
  assert.deepEqual(state, snapshot);
  assert.deepEqual(context, inputSnapshot);
  assert.deepEqual(stepCombat(state, context, 99), stepCombat(state, context, 0.1));
});
