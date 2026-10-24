import { BUILDINGS, LOCATIONS } from './world.js';
import { OWNED_CAR_CATALOG } from './ownership-catalog.js';
import { ownershipEligibility, createOwnedVehicle, setOwnedVehicleHealth, selectOwnedVehicle } from './ownership.js';

const ids = new Set(OWNED_CAR_CATALOG.map(car => car.id));
export const isOwnedVehicle = car => Boolean(car?.owned && ids.has(car.id));
export const ownedHealth = car => ['burning', 'wreck'].includes(car.damageStage) ? 0
  : Math.floor(Math.max(0, Math.min(100, car.vehicleHealth ?? 100)));

// Capture only at service/save boundaries, never replay the purchase ledger per frame.
export function snapshotOwnedVehicles(progress, fleet) {
  let next = progress;
  for (const car of fleet) if (isOwnedVehicle(car) && next.ownedVehicleHealth?.[car.id] !== ownedHealth(car)) {
    next = setOwnedVehicleHealth(next, car);
  }
  return next;
}

export function collectionSpawnState(fleet, context) {
  const location = LOCATIONS.find(place => place.id === 'collection');
  const bay = { x: location.x, z: location.z, heading: 0 };
  const foot = { x: bay.x + 4, z: bay.z, heading: -Math.PI / 2 };
  const obstacles = [...BUILDINGS, ...fleet.filter(car => !isOwnedVehicle(car)), ...(context.policeUnits || [])];
  const blocked = obstacles.some(item => {
    const sin = Math.abs(Math.sin(item.heading || 0)), cos = Math.abs(Math.cos(item.heading || 0));
    const w = item.w ?? cos * 2.05 + sin * 4.15;
    const d = item.d ?? sin * 2.05 + cos * 4.15;
    return Math.abs(item.x - bay.x) < w / 2 + 1.5 && Math.abs(item.z - bay.z) < d / 2 + 2.6
      || Math.abs(item.x - foot.x) < w / 2 + .7 && Math.abs(item.z - foot.z) < d / 2 + .7;
  }) || (context.pedestrians || []).some(person =>
    Math.abs(person.x - bay.x) < 2.1 && Math.abs(person.z - bay.z) < 3.2
      || Math.hypot(person.x - foot.x, person.z - foot.z) < 1.2);
  return { ok: !blocked, bay, foot, message: blocked ? '取車格或車門旁被擋住了，請先移開車輛，或等路人通過。' : '' };
}

export function retrieveOwnedVehicle(progress, fleet, id, context) {
  const eligible = ownershipEligibility(context);
  if (!eligible.ok) return eligible;
  if (fleet.some(car => isOwnedVehicle(car) && car.damageStage === 'burning')) return { ok: false, message: '愛車正在起火。先回到街頭，等火勢熄滅後再取車或安排救援。' };
  if (!context.walking && !isOwnedVehicle(context.vehicle)) return { ok: false, message: '先把借來的車停到取車格外，下車後再領取愛車。' };
  if (fleet.some(car => isOwnedVehicle(car) && car.id === id)) return { ok: false, message: '這輛愛車已在街上，可以定位或先收回保管。' };
  const spawn = collectionSpawnState(fleet, context);
  if (!spawn.ok) return spawn;
  const captured = snapshotOwnedVehicles(progress, fleet);
  const vehicle = createOwnedVehicle(captured, id, spawn.bay);
  if (!vehicle) return { ok: false, message: '請先購買這輛車；報廢愛車需救援整備後才能取出。' };
  return { ok: true, progress: selectOwnedVehicle(captured, id), fleet: [...fleet.filter(car => !isOwnedVehicle(car)), vehicle],
    player: spawn.foot, walking: true, controlledId: null, vehicle,
    message: '愛車已停在取車格。走近車門上車，其他愛車已收回保管。' };
}

export function storeOwnedVehicle(progress, fleet, context) {
  const eligible = ownershipEligibility(context);
  if (!eligible.ok) return eligible;
  if (fleet.some(car => isOwnedVehicle(car) && car.damageStage === 'burning')) return { ok: false, message: '愛車正在起火。先回到街頭，等火勢熄滅後再收回保管。' };
  if (!fleet.some(isOwnedVehicle)) return { ok: false, message: '愛車都已在車庫保管。' };
  const leavingCar = isOwnedVehicle(context.vehicle);
  const spawn = collectionSpawnState(fleet, context);
  if (leavingCar && !spawn.ok) return spawn;
  return { ok: true, progress: selectOwnedVehicle(snapshotOwnedVehicles(progress, fleet), null),
    fleet: fleet.filter(car => !isOwnedVehicle(car)), player: leavingCar ? spawn.foot : context.player,
    walking: leavingCar ? true : context.walking, controlledId: leavingCar ? null : context.controlledId,
    message: '愛車已收回保管，車色、性能與車況都保留。' };
}
