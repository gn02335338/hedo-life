import { BUILDINGS, SPAWN, WORLD_LIMIT } from './world.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;
const approach = (value, target, amount) => value < target
  ? Math.min(value + amount, target) : Math.max(value - amount, target);
const wrapAngle = angle => Math.atan2(Math.sin(angle), Math.cos(angle));
const damp = (value, target, response, dt) => target + (value - target) * Math.exp(-response * dt);
const CAR_RADIUS = 1.5;
const PERSON_RADIUS = 0.45;

export function createVehicle(overrides = {}) {
  overrides = overrides && typeof overrides === 'object' ? overrides : {};
  return {
    x: clamp(finite(overrides.x, SPAWN.x), -WORLD_LIMIT + CAR_RADIUS, WORLD_LIMIT - CAR_RADIUS),
    z: clamp(finite(overrides.z, SPAWN.z), -WORLD_LIMIT + CAR_RADIUS, WORLD_LIMIT - CAR_RADIUS),
    heading: wrapAngle(finite(overrides.heading, SPAWN.heading)),
    speed: clamp(finite(overrides.speed, SPAWN.speed), -8, 32),
    steerAngle: clamp(finite(overrides.steerAngle, 0), -1, 1),
    yawVelocity: clamp(finite(overrides.yawVelocity, 0), -4, 4),
    impact: false,
    distance: Math.max(0, finite(overrides.distance, 0)),
  };
}

export const resetVehicle = createVehicle;

export function createPedestrian(overrides = {}) {
  overrides = overrides && typeof overrides === 'object' ? overrides : {};
  const y = Math.max(0, finite(overrides.y, 0));
  const vx = clamp(finite(overrides.vx, 0), -8, 8);
  const vz = clamp(finite(overrides.vz, 0), -8, 8);
  return {
    x: clamp(finite(overrides.x, SPAWN.x + 3), -WORLD_LIMIT + PERSON_RADIUS, WORLD_LIMIT - PERSON_RADIUS),
    z: clamp(finite(overrides.z, SPAWN.z), -WORLD_LIMIT + PERSON_RADIUS, WORLD_LIMIT - PERSON_RADIUS),
    heading: wrapAngle(finite(overrides.heading, SPAWN.heading)),
    vx, vz, speed: Math.hypot(vx, vz), y,
    verticalVelocity: clamp(finite(overrides.verticalVelocity, 0), -30, 10),
    grounded: y === 0 && finite(overrides.verticalVelocity, 0) <= 0,
    jumpHeld: overrides.jumpHeld === true,
    impact: false,
    distance: Math.max(0, finite(overrides.distance, 0)),
  };
}

// Swept movement prevents tunnelling even through a very thin footprint. Each
// axis resolves independently so a glancing collision slides along the wall.
function moveAxis(value, other, delta, axis, radius, obstacles) {
  let next = clamp(value + delta, -WORLD_LIMIT + radius, WORLD_LIMIT - radius);
  if (!delta) return next;
  for (const obstacle of obstacles) {
    if (!obstacle || !Number.isFinite(obstacle.x) || !Number.isFinite(obstacle.z)
      || !(obstacle.w > 0) || !(obstacle.d > 0)) continue;
    const center = axis === 'x' ? obstacle.x : obstacle.z;
    const span = (axis === 'x' ? obstacle.w : obstacle.d) / 2 + radius;
    const crossCenter = axis === 'x' ? obstacle.z : obstacle.x;
    const crossSpan = (axis === 'x' ? obstacle.d : obstacle.w) / 2 + radius;
    if (other <= crossCenter - crossSpan + 1e-8 || other >= crossCenter + crossSpan - 1e-8) continue;
    const near = center - span, far = center + span;
    if (delta > 0 && value <= near + 1e-8 && next > near) next = Math.min(next, near);
    if (delta < 0 && value >= far - 1e-8 && next < far) next = Math.max(next, far);
  }
  return next;
}

export function stepPedestrian(state, input = {}, dt = 0, obstacles = BUILDINGS) {
  const person = createPedestrian(state);
  const elapsed = clamp(finite(dt, 0), 0, 0.1);
  const forward = clamp(finite(input.forward, 0), -1, 1);
  const right = clamp(finite(input.right, 0), -1, 1);
  const length = Math.max(1, Math.hypot(forward, right));
  const cameraYaw = finite(input.cameraYaw, 0);
  const maximum = input.sprint === true ? 8 : 4.5;
  const targetX = (Math.sin(cameraYaw) * forward + Math.cos(cameraYaw) * right) / length * maximum;
  const targetZ = (-Math.cos(cameraYaw) * forward + Math.sin(cameraYaw) * right) / length * maximum;
  const moving = Math.hypot(targetX, targetZ) > 0.001;
  const collisionBlocks = Array.isArray(obstacles) ? obstacles : BUILDINGS;
  const steps = Math.max(1, Math.ceil(elapsed * 120));
  const slice = elapsed / steps;
  if (elapsed > 0 && input.jump === true && !person.jumpHeld && person.grounded) {
    person.verticalVelocity = 8.25;
    person.grounded = false;
  }
  person.jumpHeld = input.jump === true;

  for (let index = 0; index < steps; index += 1) {
    person.vx = damp(person.vx, targetX, moving ? 22 : 28, slice);
    person.vz = damp(person.vz, targetZ, moving ? 22 : 28, slice);
    if (!moving && Math.hypot(person.vx, person.vz) < 0.01) person.vx = person.vz = 0;
    if (moving) {
      const desiredHeading = Math.atan2(targetX, -targetZ);
      person.heading = wrapAngle(person.heading + wrapAngle(desiredHeading - person.heading) * (1 - Math.exp(-18 * slice)));
    }
    const dx = person.vx * slice, dz = person.vz * slice;
    const previousX = person.x, previousZ = person.z;
    person.x = moveAxis(person.x, person.z, dx, 'x', PERSON_RADIUS, collisionBlocks);
    person.z = moveAxis(person.z, person.x, dz, 'z', PERSON_RADIUS, collisionBlocks);
    if (Math.abs(person.x - previousX - dx) > 1e-7) { person.vx = 0; person.impact = true; }
    if (Math.abs(person.z - previousZ - dz) > 1e-7) { person.vz = 0; person.impact = true; }
    person.distance += Math.hypot(person.x - previousX, person.z - previousZ);
    if (!person.grounded) {
      person.y += person.verticalVelocity * slice - 12.5 * slice * slice;
      person.verticalVelocity -= 25 * slice;
      if (person.y <= 0) { person.y = 0; person.verticalVelocity = 0; person.grounded = true; }
    }
  }
  person.speed = Math.hypot(person.vx, person.vz);
  return person;
}

export function stepVehicle(state, input = {}, dt = 0, obstacles = BUILDINGS) {
  const vehicle = createVehicle(state);
  const elapsed = clamp(finite(dt, 0), 0, 0.1);
  const throttle = clamp(finite(input.throttle, 0), -1, 1);
  const steer = clamp(finite(input.steer, 0), -1, 1);
  const handbrake = input.brake === true;
  const boost = input.boost === true && throttle > 0;
  const maximum = boost ? 32 : 23;
  const collisionBlocks = Array.isArray(obstacles) ? obstacles : BUILDINGS;
  const steps = Math.max(1, Math.ceil(elapsed * 120));
  const slice = elapsed / steps;

  for (let index = 0; index < steps; index += 1) {
    if (handbrake) {
      vehicle.speed = approach(vehicle.speed, 0, 40 * slice);
    } else if (throttle * vehicle.speed < -0.01) {
      // S first brakes forward motion; reversing starts only after a stop.
      vehicle.speed = approach(vehicle.speed, 0, 30 * Math.abs(throttle) * slice);
    } else if (throttle !== 0) {
      if (throttle > 0 && vehicle.speed > maximum) {
        vehicle.speed = approach(vehicle.speed, maximum, 18 * slice);
      } else {
        const acceleration = throttle < 0 ? 12 : boost ? 24 : 17;
        vehicle.speed = clamp(vehicle.speed + throttle * acceleration * slice, -8, maximum);
      }
    } else {
      vehicle.speed = approach(vehicle.speed, 0, (2.2 + Math.abs(vehicle.speed) * 0.11) * slice);
    }
    const speed = Math.abs(vehicle.speed);
    vehicle.steerAngle = damp(vehicle.steerAngle, steer, 16 / (1 + speed / 36), slice);
    const turnRate = 2.6 * speed / (speed + 3) / (1 + speed / 25);
    const desiredYaw = vehicle.steerAngle * Math.sign(vehicle.speed) * turnRate * (handbrake ? 1.25 : 1);
    vehicle.yawVelocity = speed < 0.06 ? 0 : damp(vehicle.yawVelocity, desiredYaw, 20, slice);
    vehicle.heading = wrapAngle(vehicle.heading + vehicle.yawVelocity * slice);
    const dx = Math.sin(vehicle.heading) * vehicle.speed * slice;
    const dz = -Math.cos(vehicle.heading) * vehicle.speed * slice;
    const previousX = vehicle.x, previousZ = vehicle.z;
    vehicle.x = moveAxis(vehicle.x, vehicle.z, dx, 'x', CAR_RADIUS, collisionBlocks);
    vehicle.z = moveAxis(vehicle.z, vehicle.x, dz, 'z', CAR_RADIUS, collisionBlocks);
    vehicle.distance += Math.hypot(vehicle.x - previousX, vehicle.z - previousZ);
    if (Math.abs(vehicle.x - previousX - dx) > 1e-7 || Math.abs(vehicle.z - previousZ - dz) > 1e-7) {
      if (!vehicle.impact) vehicle.speed *= 0.18;
      vehicle.impact = true;
    }
  }
  return vehicle;
}
