import { BUILDINGS, ROAD_LINES, WORLD_LIMIT } from './world.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;
const wrapAngle = angle => Math.atan2(Math.sin(angle), Math.cos(angle));
const approach = (value, target, amount) => value < target ? Math.min(target, value + amount) : Math.max(target, value - amount);

// Rounded routes fit the road grid. Cars never teleport across the city or
// pivot in place when they reach a corner.
function rectangleRoute(left, top, right, bottom) {
  const radius = 6;
  const corners = [
    [right - radius, top + radius, -Math.PI / 2],
    [right - radius, bottom - radius, 0],
    [left + radius, bottom - radius, Math.PI / 2],
    [left + radius, top + radius, Math.PI],
  ];
  return corners.flatMap(([x, z, start]) => Array.from({ length: 7 }, (_, index) => {
    const angle = start + index / 6 * Math.PI / 2;
    return { x: x + Math.cos(angle) * radius, z: z + Math.sin(angle) * radius };
  }));
}

const eastRoute = rectangleRoute(4, 4, 116, 116);
const westRoute = rectangleRoute(-116, -116, -4, -4);
const crossRoute = rectangleRoute(-116, -56, 116, 56);

export function createFleet() {
  const parked = [
    ['starter-sedan', '禾多小黃', 0xf1c967, 4, 20, 0, true],
    ['city-hatch', '薄荷小車', 0x84b5a2, -7, -30, Math.PI, false],
    ['coffee-coupe', '奶茶轎車', 0xb99478, -64, 26, Math.PI, true],
    ['finance-wagon', '紫色旅行車', 0xa49ec8, 64, 82, 0, false],
    ['harbor-sedan', '碼頭白車', 0xdce0e6, -4, 98, Math.PI, false],
    ['lab-compact', '夜班小車', 0x789cab, -56, -96, 0, true],
  ].map(([id, name, color, x, z, heading, occupied]) => ({
    id, name, color, x, z, heading, speed: 0, occupied, stolen: false, kind: 'parked',
  }));
  const traffic = [
    ['traffic-coral', '珊瑚轎車', 0xd08070, 4, 76, 0, eastRoute, 21, 7],
    ['traffic-blue', '藍色通勤車', 0x7299bd, 77, 4, Math.PI / 2, eastRoute, 0, 8],
    ['traffic-green', '綠色通勤車', 0x83a883, -80, -116, Math.PI / 2, westRoute, 0, 7.5],
    ['traffic-cream', '米白轎車', 0xddc79c, -4, -65, Math.PI, westRoute, 7, 7],
    ['traffic-plum', '梅紫小車', 0xb58ba7, -75, 56, -Math.PI / 2, crossRoute, 14, 8],
  ].map(([id, name, color, x, z, heading, route, waypoint, cruiseSpeed]) => ({
    id, name, color, x, z, heading, speed: cruiseSpeed, occupied: true,
    stolen: false, kind: 'traffic', route: route.map(point => ({ ...point })),
    waypoint, cruiseSpeed, lightClock: 0,
  }));
  return [...parked, ...traffic];
}

export function findNearbyCar(cars, person, { maxDistance = 4.8, maxSpeed = 4.5, excludeId } = {}) {
  if (!person || !Number.isFinite(person.x) || !Number.isFinite(person.z)) return null;
  let nearest = null, distance = maxDistance;
  for (const car of cars) {
    if (car.id === excludeId || Math.abs(car.speed) > maxSpeed || !Number.isFinite(car.x) || !Number.isFinite(car.z)) continue;
    if (BUILDINGS.some(block => Math.abs(car.x - block.x) < block.w / 2 + 1.4 && Math.abs(car.z - block.z) < block.d / 2 + 1.4)) continue;
    const candidate = Math.hypot(car.x - person.x, car.z - person.z);
    if (candidate <= distance) { nearest = car; distance = candidate; }
  }
  return nearest;
}

export function takeCar(cars, id) {
  return cars.map(car => car.id === id ? { ...car, occupied: false, stolen: true, speed: 0 } : car);
}

export function parkCar(cars, id, state) {
  return cars.map(car => car.id === id ? {
    ...car,
    x: clamp(finite(state?.x, car.x), -WORLD_LIMIT + 1.5, WORLD_LIMIT - 1.5),
    z: clamp(finite(state?.z, car.z), -WORLD_LIMIT + 1.5, WORLD_LIMIT - 1.5),
    heading: wrapAngle(finite(state?.heading, car.heading)),
    speed: 0, occupied: false, kind: 'parked',
  } : car);
}

function clearanceAhead(car, cars, player) {
  const fx = Math.sin(car.heading), fz = -Math.cos(car.heading);
  let clearance = Infinity;
  const blockers = player ? [...cars, { ...player, id: '__player', person: true }] : cars;
  for (const other of blockers) {
    if (other.id === car.id) continue;
    const dx = other.x - car.x, dz = other.z - car.z;
    const along = dx * fx + dz * fz;
    const across = Math.abs(dx * -fz + dz * fx);
    if (along > 0 && across < (other.person ? 2.1 : 2.7)) {
      clearance = Math.min(clearance, Math.max(0, along - (other.person ? 3.2 : 5.2)));
    }
  }
  return clearance;
}

function signalClearance(car) {
  const fx = Math.sin(car.heading), fz = -Math.cos(car.heading);
  const vertical = Math.abs(fz) > 0.98, horizontal = Math.abs(fx) > 0.98;
  if (!vertical && !horizontal) return Infinity;
  const verticalGreen = car.lightClock % 16 < 8;
  if (vertical === verticalGreen) return Infinity;
  const value = vertical ? car.z : car.x, direction = vertical ? Math.sign(fz) : Math.sign(fx);
  const ahead = ROAD_LINES.map(line => (line - value) * direction).filter(distance => distance > 5.5 && distance < 25);
  return ahead.length ? Math.max(0, Math.min(...ahead) - 8) : Infinity;
}

export function stepFleet(cars, dt, { controlledId, reservedId, player } = {}) {
  const elapsed = clamp(finite(dt, 0), 0, 0.1);
  let result = cars.map(car => ({ ...car }));
  const steps = Math.max(1, Math.ceil(elapsed * 120));
  const slice = elapsed / steps;
  for (let step = 0; step < steps; step += 1) {
    const before = result;
    result = before.map(previous => {
      if (previous.id === controlledId || previous.id === reservedId || previous.kind !== 'traffic' || previous.stolen || !previous.route?.length) return previous;
      const car = { ...previous, lightClock: previous.lightClock + slice };
      const clearance = Math.min(clearanceAhead(car, before, player), signalClearance(car));
      const desiredSpeed = Math.min(car.cruiseSpeed, Math.sqrt(2 * 5 * clearance));
      car.speed = approach(car.speed, desiredSpeed, (car.speed > desiredSpeed ? 8 : 3.5) * slice);
      let travel = Math.min(car.speed * slice, clearance);
      if (travel <= 1e-8 && clearance < 0.05) car.speed = 0;
      while (travel > 1e-8) {
        const target = car.route[car.waypoint];
        const dx = target.x - car.x, dz = target.z - car.z;
        const distance = Math.hypot(dx, dz);
        if (distance < 1e-8) { car.waypoint = (car.waypoint + 1) % car.route.length; continue; }
        const movement = Math.min(travel, distance);
        car.x += dx / distance * movement;
        car.z += dz / distance * movement;
        const heading = Math.atan2(dx, -dz);
        car.heading = wrapAngle(car.heading + wrapAngle(heading - car.heading) * (1 - Math.exp(-12 * slice)));
        travel -= movement;
        if (movement >= distance - 1e-8) car.waypoint = (car.waypoint + 1) % car.route.length;
      }
      return car;
    });
  }
  return result;
}
