import { BUILDINGS } from './world.js';
import { segmentClear } from './police.js';

export const VEHICLE_DAMAGE_RULES = Object.freeze({
  maxHealth: 100, damagedHealth: 65, smokingHealth: 30,
  burnSeconds: 3, explosionSeconds: 2.4, explosionRadius: 9,
  explosionVehicleDamage: 160, explosionPlayerDamage: 120,
  collisionMinSpeed: 4, collisionCooldownSeconds: 1.1,
  collisionDamagePerSpeed: 2.25, collisionMaxDamage: 65,
  maxExplosions: 8, maxEvents: 64,
});
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const position = value => ({ x: finite(value?.x), z: finite(value?.z) });
const separation = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const validPosition = value => Number.isFinite(value?.x) && Number.isFinite(value?.z);

export function createVehicleDamageState() {
  return { time: 0, nextExplosionId: 1, collisionCooldowns: {}, explosions: [], events: [] };
}

function stageFor(health) {
  if (health <= 0) return 'burning';
  if (health <= VEHICLE_DAMAGE_RULES.smokingHealth) return 'smoking';
  if (health <= VEHICLE_DAMAGE_RULES.damagedHealth) return 'damaged';
  return 'intact';
}
function normalizeVehicle(vehicle) {
  const wreck = vehicle.damageStage === 'wreck';
  const health = wreck || vehicle.damageStage === 'burning' ? 0
    : clamp(finite(vehicle.vehicleHealth, VEHICLE_DAMAGE_RULES.maxHealth), 0, VEHICLE_DAMAGE_RULES.maxHealth);
  const damageStage = wreck ? 'wreck' : stageFor(health);
  return { ...vehicle, vehicleHealth: health, damageStage,
    burnRemaining: damageStage === 'burning' ? clamp(finite(vehicle.burnRemaining, VEHICLE_DAMAGE_RULES.burnSeconds), 0, VEHICLE_DAMAGE_RULES.burnSeconds) : 0,
    wreckAge: wreck ? Math.max(0, finite(vehicle.wreckAge)) : 0,
    ...(damageStage === 'burning' || wreck ? { speed: 0 } : {}) };
}
function emit(state, event) {
  if (state.events.length < VEHICLE_DAMAGE_RULES.maxEvents) state.events.push(event);
}
function damageVehicle(vehicle, amount, source, state) {
  if (!vehicle || vehicle.damageStage === 'wreck' || vehicle.damageStage === 'burning' || !Number.isFinite(amount) || amount <= 0) return;
  const lost = Math.min(vehicle.vehicleHealth, amount);
  vehicle.vehicleHealth = Math.max(0, vehicle.vehicleHealth - lost);
  vehicle.damageStage = stageFor(vehicle.vehicleHealth);
  emit(state, { type: 'vehicleDamaged', vehicleId: vehicle.id, position: position(vehicle), damage: lost,
    vehicleHealth: vehicle.vehicleHealth, damageStage: vehicle.damageStage, source });
  if (!vehicle.vehicleHealth) {
    vehicle.burnRemaining = VEHICLE_DAMAGE_RULES.burnSeconds;
    vehicle.wreckAge = 0; vehicle.speed = 0; vehicle.burnSource = source;
    emit(state, { type: 'vehicleBurning', vehicleId: vehicle.id, position: position(vehicle), source,
      burnRemaining: VEHICLE_DAMAGE_RULES.burnSeconds });
  }
}
function blastDamage(origin, target, maximum, obstacles) {
  if (!validPosition(origin) || !validPosition(target)) return 0;
  const distance = separation(origin, target), radius = VEHICLE_DAMAGE_RULES.explosionRadius;
  if (distance >= radius || !segmentClear(origin, target, obstacles)) return 0;
  return maximum * (1 - distance / radius);
}

// Health lives on the authoritative vehicle record. The separate state retains
// only short effects and collision cooldowns, so removed patrol IDs are reclaimable.
export function stepVehicleDamage(state, input = {}, dt = 0) {
  const elapsed = clamp(finite(dt), 0, .1);
  const original = Array.isArray(input.vehicles) ? input.vehicles : [];
  if (!elapsed) return { state, vehicles: original, playerDamage: 0 };
  const vehicles = original.map(normalizeVehicle);
  const byId = new Map(vehicles.map(vehicle => [vehicle.id, vehicle]));
  const obstacles = Array.isArray(input.obstacles) ? input.obstacles : BUILDINGS;
  const cooldowns = new Map(Object.entries(state.collisionCooldowns || {}).filter(([id]) => byId.has(id)));
  const next = { time: Math.max(0, finite(state.time)), nextExplosionId: Math.max(1, finite(state.nextExplosionId, 1)),
    collisionCooldowns: {}, explosions: (state.explosions || []).slice(-VEHICLE_DAMAGE_RULES.maxExplosions).map(explosion => ({ ...explosion })), events: [] };
  for (const hit of Array.isArray(input.hits) ? input.hits : []) {
    if (hit?.type && hit.type !== 'vehicleHit') continue;
    damageVehicle(byId.get(hit?.targetId), hit?.damage, hit?.source || 'bullet', next);
  }
  for (const collision of Array.isArray(input.collisions) ? input.collisions : []) {
    const vehicle = byId.get(collision?.vehicleId), speed = Math.abs(finite(collision?.speed));
    if (!vehicle || vehicle.damageStage === 'wreck' || vehicle.damageStage === 'burning'
      || speed <= VEHICLE_DAMAGE_RULES.collisionMinSpeed || finite(cooldowns.get(vehicle.id)) > 1e-8) continue;
    const amount = Math.min(VEHICLE_DAMAGE_RULES.collisionMaxDamage,
      (speed - VEHICLE_DAMAGE_RULES.collisionMinSpeed) * VEHICLE_DAMAGE_RULES.collisionDamagePerSpeed);
    damageVehicle(vehicle, amount, 'collision', next);
    cooldowns.set(vehicle.id, VEHICLE_DAMAGE_RULES.collisionCooldownSeconds);
    const other = byId.get(collision.otherId);
    if (other && other.id !== vehicle.id && finite(cooldowns.get(other.id)) <= 1e-8) {
      damageVehicle(other, amount * .7, 'collision', next);
      cooldowns.set(other.id, VEHICLE_DAMAGE_RULES.collisionCooldownSeconds);
    }
  }

  let playerDamage = 0;
  const steps = Math.ceil(elapsed * 120), slice = elapsed / steps;
  for (let frame = 0; frame < steps; frame += 1) {
    next.time += slice;
    next.explosions = next.explosions.map(explosion => ({ ...explosion, age: explosion.age + slice }))
      .filter(explosion => explosion.age + 1e-8 < explosion.duration);
    for (const [id, remaining] of cooldowns) {
      const left = remaining - slice;
      if (left <= 1e-8) cooldowns.delete(id); else cooldowns.set(id, left);
    }
    const ready = [];
    for (const vehicle of vehicles) {
      if (vehicle.damageStage === 'wreck') { vehicle.wreckAge += slice; continue; }
      if (vehicle.damageStage !== 'burning') continue;
      vehicle.speed = 0;
      vehicle.burnRemaining = Math.max(0, vehicle.burnRemaining - slice);
      if (vehicle.burnRemaining <= 1e-8) ready.push(vehicle);
    }
    // All fuse expirations are collected first. A car newly ignited by this
    // blast gets its complete fuse; it cannot chain-explode within the same slice.
    for (const vehicle of ready) {
      vehicle.damageStage = 'wreck'; vehicle.vehicleHealth = 0; vehicle.burnRemaining = 0; vehicle.wreckAge = 0; vehicle.speed = 0;
      const explosion = { id: `vehicle-explosion-${next.nextExplosionId++}`, vehicleId: vehicle.id,
        ...position(vehicle), age: 0, duration: VEHICLE_DAMAGE_RULES.explosionSeconds, radius: VEHICLE_DAMAGE_RULES.explosionRadius };
      next.explosions.push(explosion);
      if (next.explosions.length > VEHICLE_DAMAGE_RULES.maxExplosions) next.explosions.shift();
      emit(next, { type: 'vehicleExploded', vehicleId: vehicle.id, position: position(vehicle),
        radius: VEHICLE_DAMAGE_RULES.explosionRadius, source: vehicle.burnSource || 'vehicle' });
      for (const other of vehicles) {
        if (other.id === vehicle.id) continue;
        damageVehicle(other, blastDamage(vehicle, other, VEHICLE_DAMAGE_RULES.explosionVehicleDamage, obstacles), 'explosion', next);
      }
      if (input.controlledId === vehicle.id) {
        // The driver is inside this shell even if the root's actor interpolation
        // trails the authoritative position by a frame. There is no self-cover.
        playerDamage += VEHICLE_DAMAGE_RULES.explosionPlayerDamage;
      } else {
        playerDamage += blastDamage(vehicle, input.player, VEHICLE_DAMAGE_RULES.explosionPlayerDamage, obstacles);
      }
    }
  }
  next.collisionCooldowns = Object.fromEntries(cooldowns);
  return { state: next, vehicles, playerDamage: clamp(playerDamage, 0, 100) };
}
