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
    aiMode: 'cruise', yieldReason: null, laneOffset: 0, blockedTime: 0,
    threatTimer: 0, alertTimer: 0, threatCooldown: 0, threatId: null, threatMemory: [],
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

const CAR_HALF_WIDTH = 1.15, CAR_HALF_LENGTH = 2.3;
const MAX_OFFSET = 3.1;
const direction = heading => ({ x: Math.sin(heading), z: -Math.cos(heading) });
const rightOf = heading => ({ x: Math.cos(heading), z: Math.sin(heading) });
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function roadClear(point) {
  return Math.max(Math.abs(point.x), Math.abs(point.z)) < WORLD_LIMIT - 1.5
    && ROAD_LINES.some(line => Math.min(Math.abs(point.x - line), Math.abs(point.z - line)) <= 8.25)
    && !BUILDINGS.some(block => Math.abs(point.x - block.x) < block.w / 2 + 1.5
      && Math.abs(point.z - block.z) < block.d / 2 + 1.5);
}

function overlapsCar(point, heading, other) {
  const forward = direction(heading), right = rightOf(heading);
  const otherForward = direction(finite(other.heading, 0)), otherRight = rightOf(finite(other.heading, 0));
  const dx = other.x - point.x, dz = other.z - point.z;
  for (const axis of [forward, right, otherForward, otherRight]) {
    const a = Math.abs(axis.x * forward.x + axis.z * forward.z) * CAR_HALF_LENGTH
      + Math.abs(axis.x * right.x + axis.z * right.z) * CAR_HALF_WIDTH;
    const b = Math.abs(axis.x * otherForward.x + axis.z * otherForward.z) * CAR_HALF_LENGTH
      + Math.abs(axis.x * otherRight.x + axis.z * otherRight.z) * CAR_HALF_WIDTH;
    if (Math.abs(dx * axis.x + dz * axis.z) >= a + b) return false;
  }
  return true;
}
function overlapsPerson(point, heading, person) {
  const forward = direction(heading), right = rightOf(heading), dx = person.x - point.x, dz = person.z - point.z;
  const along = Math.max(0, Math.abs(dx * forward.x + dz * forward.z) - CAR_HALF_LENGTH);
  const across = Math.max(0, Math.abs(dx * right.x + dz * right.z) - CAR_HALF_WIDTH);
  return Math.hypot(along, across) < .65;
}
function positionClear(point, heading, id, cars, people, predict = false) {
  if (!roadClear(point)) return false;
  const forward = direction(heading), right = rightOf(heading);
  for (const block of BUILDINGS) {
    const dx = block.x - point.x, dz = block.z - point.z;
    if (Math.abs(dx) > block.w / 2 + 3 || Math.abs(dz) > block.d / 2 + 3) continue;
    const separated = [forward, right, { x: 1, z: 0 }, { x: 0, z: 1 }].some(axis => {
      const vehicle = Math.abs(axis.x * forward.x + axis.z * forward.z) * CAR_HALF_LENGTH
        + Math.abs(axis.x * right.x + axis.z * right.z) * CAR_HALF_WIDTH;
      const building = Math.abs(axis.x) * block.w / 2 + Math.abs(axis.z) * block.d / 2;
      return Math.abs(dx * axis.x + dz * axis.z) >= vehicle + building;
    });
    if (!separated) return false;
  }
  for (const other of cars) {
    if (other.id === id || distance(point, other) > 9) continue;
    if (overlapsCar(point, heading, other)) return false;
  }
  for (const person of people) {
    if (distance(point, person) > 12) continue;
    if (overlapsPerson(point, heading, person)) return false;
    if (predict) {
      const forward = direction(finite(person.heading, 0)), speed = clamp(finite(person.speed, 0), 0, 12);
      const future = { x: person.x + forward.x * speed * .65, z: person.z + forward.z * speed * .65 };
      if (overlapsPerson(point, heading, future)) return false;
    }
  }
  return true;
}

function forwardHazard(point, heading, speed, cars, people, id) {
  const forward = direction(heading), right = rightOf(heading);
  let result = { clearance: Infinity, other: null, reason: null, along: Infinity };
  for (const other of [...cars, ...people]) {
    if (other.id === id || distance(point, other) > 65) continue;
    const dx = other.x - point.x, dz = other.z - point.z;
    let along = dx * forward.x + dz * forward.z;
    const across = dx * right.x + dz * right.z, band = other.person ? 2 : 2.7;
    const otherDirection = direction(finite(other.heading, 0)), otherSpeed = finite(other.speed, 0);
    const otherAlong = otherDirection.x * forward.x + otherDirection.z * forward.z;
    const projectedVelocity = otherAlong * otherSpeed;
    const oncoming = !other.person && projectedVelocity < -3;
    let crossing = Math.abs(across) < band;
    if (other.person && otherSpeed > .2) {
      const horizon = clamp(.8 + Math.abs(speed) / 6, 1, 2.2);
      const futureAcross = across + (otherDirection.x * right.x + otherDirection.z * right.z) * otherSpeed * horizon;
      crossing ||= Math.min(across, futureAcross) < band && Math.max(across, futureAcross) > -band;
      const futureAlong = along + otherAlong * otherSpeed * horizon;
      if (along <= 0 && futureAlong <= 0) continue;
      if (crossing) along = Math.max(.01, Math.min(along, futureAlong));
    }
    const range = oncoming ? Math.min(62, 12 + (Math.abs(speed) - projectedVelocity) * 1.6) : 28;
    if (!crossing || along <= 0 || along > range) continue;
    const clearance = Math.max(0, along - (other.person ? 3.5 : 5.3));
    if (clearance < result.clearance) result = { clearance, other, along, reason: other.person ? 'pedestrian' : oncoming ? 'oncoming' : 'vehicle' };
  }
  return result;
}

function safeOffset(car, offset, cars, people, ahead) {
  const forward = direction(car.routeHeading), right = rightOf(car.routeHeading);
  // Check the whole side pocket, then the passing corridor. Looking beyond the
  // obstruction prevents choosing a gap that would trap the car at its far end.
  for (let step = 0; step <= 6; step += 1) {
    const lateral = car.laneOffset + (offset - car.laneOffset) * step / 6;
    const point = { x: car.routeX + right.x * lateral, z: car.routeZ + right.z * lateral };
    if (!positionClear(point, car.routeHeading, car.id, cars, people, true)) return false;
  }
  const length = clamp(ahead + 7, 9, 28);
  for (let along = 0; along <= length; along += 1.4) {
    const point = { x: car.routeX + forward.x * along + right.x * offset, z: car.routeZ + forward.z * along + right.z * offset };
    if (!positionClear(point, car.routeHeading, car.id, cars, people, true)) return false;
  }
  return true;
}

function reactToThreats(car, threats, slice) {
  car.threatTimer = Math.max(0, finite(car.threatTimer, 0) - slice);
  car.alertTimer = Math.max(0, finite(car.alertTimer, 0) - slice);
  car.threatCooldown = Math.max(0, finite(car.threatCooldown, 0) - slice);
  car.threatMemory = [...(car.threatMemory || [])].slice(-8);
  const forward = direction(car.routeHeading), right = rightOf(car.routeHeading);
  let ahead = Infinity, frontKind = null, heardAhead = false, heardBehind = false;
  for (const threat of threats) {
    if (!(threat.remaining > 0) || !['gunshot', 'collision'].includes(threat.kind)) continue;
    const separation = distance(car, threat), radius = clamp(finite(threat.radius, 0), 0, 60);
    if (separation > radius) continue;
    const dx = threat.x - car.x, dz = threat.z - car.z;
    const along = dx * forward.x + dz * forward.z, across = Math.abs(dx * right.x + dz * right.z);
    if (along > -3) heardAhead = true; else heardBehind = true;
    car.alertTimer = Math.max(car.alertTimer, along > -3 ? 1.8 : .8);
    if (along > 0 && across < 6 && along < ahead) { ahead = along; frontKind = threat.kind; }
    if (car.threatCooldown <= 1e-8 && !car.threatMemory.includes(threat.id)) {
      car.threatId = threat.id; car.threatKind = threat.kind; car.threatMemory.push(threat.id); car.threatMemory = car.threatMemory.slice(-8);
      // A driver already leaving the sound continues away. Sustained firing
      // cannot restart this assessment every frame or every fresh event ID.
      car.threatTimer = along > -3 ? (threat.kind === 'gunshot' ? .65 : .4) : 0;
      car.threatCooldown = 3.8; car.alertTimer = Math.max(car.alertTimer, 3.2);
    }
  }
  if (heardAhead || heardBehind) car.threatBehind = heardBehind && !heardAhead;
  return { clearance: Math.max(0, ahead - 10), reason: frontKind };
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

export function stepFleet(cars, dt, { controlledId, reservedId, player, pedestrians = [], threats = [] } = {}) {
  const elapsed = clamp(finite(dt, 0), 0, 0.1);
  let result = cars.map(car => ({ ...car }));
  if (!elapsed) return result;
  const people = [...(player ? [{ ...player, id: '__player' }] : []), ...pedestrians].filter(person => Number.isFinite(person.x) && Number.isFinite(person.z))
    .map((person, index) => ({ ...person, id: person.id || `__pedestrian-${index}`, person: true }));
  const steps = Math.max(1, Math.ceil(elapsed * 120));
  const slice = elapsed / steps;
  for (let step = 0; step < steps; step += 1) {
    const before = result;
    result = before.map(previous => {
      if (previous.id === controlledId || previous.id === reservedId || previous.kind !== 'traffic' || previous.stolen || !previous.route?.length) return previous;
      const car = { ...previous, lightClock: finite(previous.lightClock, 0) + slice,
        routeX: finite(previous.routeX, previous.x), routeZ: finite(previous.routeZ, previous.z),
        routeHeading: finite(previous.routeHeading, previous.heading), laneOffset: clamp(finite(previous.laneOffset, 0), 0, MAX_OFFSET) };
      const hazard = forwardHazard(car, car.routeHeading, car.speed, before, people, car.id);
      const central = forwardHazard({ x: car.routeX, z: car.routeZ }, car.routeHeading, car.speed, before, people, car.id);
      const threat = reactToThreats(car, threats, slice);
      car.avoidCheckIn = Math.max(0, finite(car.avoidCheckIn, 0) - slice);
      car.blockedTime = hazard.clearance < 8 && car.speed < 1 ? finite(car.blockedTime, 0) + slice : Math.max(0, finite(car.blockedTime, 0) - slice * 2);
      const other = central.other;
      const passable = other && (central.reason === 'oncoming'
        || other.person && finite(other.speed, 0) < .2 && car.blockedTime > 1.2
        || !other.person && Math.abs(finite(other.speed, 0)) < .5
          && (other.kind !== 'traffic' || other.stolen || other.id === controlledId || other.id === reservedId));
      if (!car.avoidCheckIn && passable && central.along < 34) {
        car.avoidCheckIn = .35;
        if (safeOffset(car, MAX_OFFSET, before, people, central.along)) { car.avoidId = other.id; car.offsetTarget = MAX_OFFSET; car.avoidUrgent = central.reason === 'oncoming'; }
      }
      const avoided = [...before, ...people].find(item => item.id === car.avoidId);
      if (car.avoidId && avoided) {
        const forward = direction(car.routeHeading), right = rightOf(car.routeHeading);
        const along = (avoided.x - car.routeX) * forward.x + (avoided.z - car.routeZ) * forward.z;
        const across = (avoided.x - car.routeX) * right.x + (avoided.z - car.routeZ) * right.z;
        if (along < -7 || along > 40 || Math.abs(across) > 2.7) { car.avoidId = null; car.offsetTarget = 0; }
      } else if (!passable) { car.avoidId = null; car.offsetTarget = 0; }
      const signal = signalClearance({ ...car, heading: car.routeHeading });
      const clearance = Math.min(hazard.clearance, signal, threat.clearance);
      const cautious = car.alertTimer > 0 || car.laneOffset > .05 || car.offsetTarget > 0;
      const slowPassing = car.laneOffset > .05 || car.offsetTarget > 0 || car.alertTimer > 0 && !car.threatBehind;
      const limit = car.threatTimer > 0 ? 0
        : Math.min(finite(car.cruiseSpeed, 7), slowPassing ? 3.5 : Infinity, hazard.reason === 'oncoming' ? 3 : Infinity);
      const desiredSpeed = Math.min(limit, Math.sqrt(2 * 5 * clearance));
      car.speed = approach(car.speed, desiredSpeed, (car.speed > desiredSpeed ? 12 : 3.2) * slice);
      car.aiMode = car.threatTimer > 0 || clearance < 1 ? 'yield' : car.offsetTarget > 0 || car.laneOffset > .1 ? 'avoid' : cautious ? 'cautious' : hazard.clearance < 22 ? 'yield' : 'cruise';
      car.yieldReason = car.threatTimer > 0 ? (threat.reason || car.threatKind) : threat.clearance < hazard.clearance ? threat.reason : hazard.reason;
      let travel = Math.min(car.speed * slice, clearance);
      if (travel <= 1e-8 && clearance < 0.05) car.speed = 0;
      const originalRoute = { x: car.routeX, z: car.routeZ, waypoint: car.waypoint, heading: car.routeHeading };
      let pathHeading = car.routeHeading;
      while (travel > 1e-8) {
        const target = car.route[car.waypoint];
        const dx = target.x - car.routeX, dz = target.z - car.routeZ;
        const distance = Math.hypot(dx, dz);
        if (distance < 1e-8) { car.waypoint = (car.waypoint + 1) % car.route.length; continue; }
        const movement = Math.min(travel, distance);
        car.routeX += dx / distance * movement;
        car.routeZ += dz / distance * movement;
        pathHeading = Math.atan2(dx, -dz);
        travel -= movement;
        if (movement >= distance - 1e-8) car.waypoint = (car.waypoint + 1) % car.route.length;
      }
      const moved = Math.hypot(car.routeX - originalRoute.x, car.routeZ - originalRoute.z);
      // Rounded route nodes change tangent discretely. Rotate the offset frame
      // by distance travelled, so a lane-shifted car never jumps at a node.
      car.routeHeading = wrapAngle(car.routeHeading + clamp(wrapAngle(pathHeading - car.routeHeading), -.22 * moved, .22 * moved));
      const right = rightOf(car.routeHeading);
      // Lateral travel is a steering manoeuvre: a stationary car cannot slide
      // into a gap, and a stopped queue must wait for forward room to reopen.
      const lateralTravel = Math.min(moved * .9, (car.offsetTarget > 0 && car.avoidUrgent ? 2.8 : .95) * slice);
      const offset = approach(car.laneOffset, finite(car.offsetTarget, 0), lateralTravel);
      const proposed = { x: car.routeX + right.x * offset, z: car.routeZ + right.z * offset };
      const steer = clamp(Math.atan2(offset - car.laneOffset, Math.max(.035, moved)), -.32, .32);
      const heading = moved > 1e-8 ? wrapAngle(car.heading + wrapAngle(car.routeHeading + steer - car.heading) * (1 - Math.exp(-12 * slice))) : car.heading;
      if (positionClear(proposed, heading, car.id, before, people)) {
        car.heading = heading;
        car.x = proposed.x; car.z = proposed.z; car.laneOffset = offset;
      } else {
        car.routeX = originalRoute.x; car.routeZ = originalRoute.z; car.waypoint = originalRoute.waypoint; car.routeHeading = originalRoute.heading;
        car.speed = 0; car.aiMode = 'yield'; car.yieldReason = hazard.reason || 'blocked';
      }
      return car;
    });
  }
  return result;
}
