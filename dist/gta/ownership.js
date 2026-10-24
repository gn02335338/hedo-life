import { LOCATIONS, WORLD_LIMIT } from './world.js';
import { OWNED_CAR_CATALOG, PRIVATE_GARAGE_RULES } from './ownership-catalog.js';
import { GARAGE_RULES, applyGarageCustomizations, replayGarageProgress } from './garage.js';

export { OWNED_CAR_CATALOG, PRIVATE_GARAGE_RULES } from './ownership-catalog.js';
const catalog = new Map(OWNED_CAR_CATALOG.map(car => [car.id, car]));
const validId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(value);
const messages = Object.freeze({
  dead: '重生後才能使用私人車庫。', busy: '請先落地並完成上下車。', wanted: '先解除通緝，再回私人車庫。',
  moving: '請先停穩，再辦理車庫服務。', distance: '請到私人車庫的服務區。', vehicle: '請先下車，或駕駛民用車進場。',
  destroyed: '先離開起火或報廢的車輛，再辦理車庫服務。', 'invalid-action': '這項車庫服務無法使用。',
  'already-owned': '這輛車已經在你的私人車庫。', 'not-owned': '請先購買這輛車。', capacity: '三個私人車位已滿。',
  'not-destroyed': '這輛車仍可行駛；受損時可開到修車廠修復。', 'insufficient-funds': '跑腿基金不足，先完成委託再回來。',
  'ledger-full': '本機交易紀錄已滿，這次沒有扣款。', duplicate: '這筆交易已完成，不會重複扣款。',
});
const reject = (reason, extra = {}) => ({ ok: false, reason, message: messages[reason], ...extra });

export function ownershipEligibility(context = {}) {
  const { player, vehicle, controlledId, wantedLevel, transition, dead, walking } = context;
  if (dead) return reject('dead');
  if (transition || Number.isFinite(player?.y) && player.y > .15) return reject('busy');
  if (!Number.isFinite(wantedLevel) || wantedLevel !== 0) return reject('wanted');
  if (walking !== true && walking !== false) return reject('vehicle');
  if (walking === false) {
    if (!vehicle || !['parked', 'traffic'].includes(vehicle.kind) || vehicle.id !== controlledId) return reject('vehicle');
    if (['burning', 'wreck'].includes(vehicle.damageStage) || vehicle.vehicleHealth <= 0) return reject('destroyed');
    if (!Number.isFinite(vehicle.speed) || !Number.isFinite(player?.speed)
      || Math.max(Math.abs(vehicle.speed), Math.abs(player.speed)) > PRIVATE_GARAGE_RULES.maxSpeed) return reject('moving');
  }
  const location = context.location || LOCATIONS.find(place => place.id === 'collection');
  if (!location || ![player?.x, player?.z, location.x, location.z].every(Number.isFinite)
    || Math.hypot(player.x - location.x, player.z - location.z) > PRIVATE_GARAGE_RULES.radius
    || walking === false && (![vehicle.x, vehicle.z].every(Number.isFinite)
      || Math.hypot(vehicle.x - location.x, vehicle.z - location.z) > PRIVATE_GARAGE_RULES.radius)) return reject('distance');
  return { ok: true, reason: null, message: '已到私人車庫，可以辦理服務。' };
}

export function quoteOwnershipAction(progress, action) {
  const current = replayGarageProgress(progress), car = catalog.get(action?.vehicleId);
  if (!car || !['purchase', 'recover'].includes(action?.kind)) return reject('invalid-action');
  if (current.ledger.length >= GARAGE_RULES.maxLedger) return reject('ledger-full');
  const owned = current.ownedVehicleIds.includes(car.id);
  if (action.kind === 'purchase') {
    if (owned) return reject('already-owned');
    if (current.ownedVehicleIds.length >= PRIVATE_GARAGE_RULES.capacity) return reject('capacity');
  } else {
    if (!owned) return reject('not-owned');
    if (current.ownedVehicleHealth[car.id] > 0) return reject('not-destroyed');
  }
  const cost = action.kind === 'purchase' ? car.price : PRIVATE_GARAGE_RULES.recoverPrice;
  if (current.money < cost) return reject('insufficient-funds', { cost });
  return { ok: true, reason: null, message: '', kind: action.kind, vehicleId: car.id, cost, balanceAfter: current.money - cost };
}

export function applyOwnershipAction(progress, action, context = {}) {
  const current = replayGarageProgress(progress);
  const fail = result => ({ ...result, progress: current });
  if (!validId(action?.id)) return fail(reject('invalid-action'));
  if (current.ledger.some(entry => entry.id === action.id)) return fail(reject('duplicate'));
  const eligible = ownershipEligibility(context);
  if (!eligible.ok) return fail(eligible);
  const quote = quoteOwnershipAction(current, action);
  if (!quote.ok) return fail(quote);
  const record = { id: action.id, vehicleId: quote.vehicleId, kind: quote.kind, missionCount: current.completed.length };
  const next = replayGarageProgress({ ...current, ledger: [...current.ledger, record],
    ownedVehicleHealth: { ...current.ownedVehicleHealth, [quote.vehicleId]: 100 } });
  return { ok: true, reason: null, message: quote.kind === 'purchase' ? '已購入，車輛保管在私人車庫。' : '救援與修復完成，可重新取車。',
    progress: next, cost: quote.cost };
}

export function createOwnedVehicle(progress, id, position) {
  const current = replayGarageProgress(progress), car = catalog.get(id);
  if (!car || !current.ownedVehicleIds.includes(id) || !(current.ownedVehicleHealth[id] > 0)
    || !position || ![position.x, position.z].every(Number.isFinite)
    || Math.max(Math.abs(position.x), Math.abs(position.z)) > WORLD_LIMIT - 1.5) return null;
  const health = current.ownedVehicleHealth[id], heading = Number.isFinite(position.heading) ? position.heading : 0;
  const vehicle = { id, name: car.name, variant: car.variant, color: car.color,
    x: position.x, z: position.z, heading: Math.atan2(Math.sin(heading), Math.cos(heading)), speed: 0,
    kind: 'parked', owned: true, occupied: false, stolen: false,
    vehicleHealth: health, damageStage: health <= 30 ? 'smoking' : health <= 65 ? 'damaged' : 'intact',
    burnRemaining: 0, wreckAge: 0, impact: false, impactSpeed: 0, impactVehicleId: null };
  return applyGarageCustomizations([vehicle], current)[0];
}

export function setOwnedVehicleHealth(progress, vehicle) {
  const current = replayGarageProgress(progress);
  if (!current.ownedVehicleIds.includes(vehicle?.id)) return current;
  const health = ['burning', 'wreck'].includes(vehicle.damageStage) ? 0 : Number.isFinite(vehicle.vehicleHealth)
    ? Math.max(0, Math.min(100, Math.floor(vehicle.vehicleHealth))) : current.ownedVehicleHealth[vehicle.id];
  return { ...current, ownedVehicleHealth: { ...current.ownedVehicleHealth, [vehicle.id]: health } };
}

export function selectOwnedVehicle(progress, idOrNull) {
  const current = replayGarageProgress(progress);
  if (idOrNull !== null && !current.ownedVehicleIds.includes(idOrNull)) return current;
  return { ...current, selectedOwnedId: idOrNull };
}
