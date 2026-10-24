import { LOCATIONS, MISSIONS } from './world.js';
import { createFleet } from './fleet.js';
import { OWNED_CAR_CATALOG, PRIVATE_GARAGE_RULES } from './ownership-catalog.js';

export const GARAGE_PALETTE = Object.freeze([
  { id: 'pearl', name: '珍珠白', color: 0xe8e9e3 },
  { id: 'graphite', name: '石墨黑', color: 0x323944 },
  { id: 'coral', name: '珊瑚橘', color: 0xdf806b },
  { id: 'mint', name: '薄荷綠', color: 0x78b6a0 },
  { id: 'violet', name: '暮光紫', color: 0x9484be },
  { id: 'gold', name: '禾多金', color: 0xf1c967 },
].map(Object.freeze));
export const GARAGE_CATALOG = Object.freeze({
  repair: Object.freeze({ name: '完整修復', price: 90 }),
  paint: Object.freeze({ name: '車身換色', price: 60 }),
  upgrades: Object.freeze({
    engine: Object.freeze({ name: '引擎', prices: Object.freeze([180, 320]), maxLevel: 2 }),
    brakes: Object.freeze({ name: '煞車', prices: Object.freeze([140, 240]), maxLevel: 2 }),
    handling: Object.freeze({ name: '操控', prices: Object.freeze([160, 280]), maxLevel: 2 }),
  }),
});
export const GARAGE_RULES = Object.freeze({ radius: 6, maxSpeed: 1, maxLedger: 128, startingMoney: 500 });
const originalCars = new Map([...createFleet(), ...OWNED_CAR_CATALOG].map(car => [car.id, { color: car.color }]));
const ownedCars = new Map(OWNED_CAR_CATALOG.map(car => [car.id, car]));
const colors = new Map(GARAGE_PALETTE.map(color => [color.id, color]));
const tuningKeys = Object.keys(GARAGE_CATALOG.upgrades);
const isRecord = value => value && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const isId = id => typeof id === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(id);
const levels = value => Object.fromEntries(tuningKeys.map(key => [key,
  Number.isInteger(value?.[key]) && value[key] >= 0 && value[key] <= 2 ? value[key] : 0]));
const defaultCustomization = () => ({ colorId: null, upgrades: levels() });
const isCivilian = vehicle => vehicle && originalCars.has(vehicle.id) && ['parked', 'traffic'].includes(vehicle.kind);
const messageByReason = Object.freeze({
  vehicle: '請開一輛可改裝的民用車進廠。', 'on-foot': '請先坐進要改裝的車。',
  wanted: '先甩掉通緝，再回來改裝。', moving: '請把車停穩後再交易。',
  busy: '上下車完成後再進行交易。', dead: '重生後才能使用修車廠。',
  distance: '請把車開進修車廠的服務區。', destroyed: '起火車輛與殘骸無法修復或改裝。',
  'full-health': '車況完整，暫時不需要修理。', 'same-color': '這輛車已經是這個顏色。',
  'max-level': '這項性能已升到最高等級。', 'invalid-action': '這項改裝無法使用。',
  'insufficient-funds': '跑腿基金不足，先完成委託再回來。', 'ledger-full': '本機交易紀錄已滿，這次沒有扣款。',
  duplicate: '這筆交易已完成，不會重複扣款。',
  'not-owned': '請先在私人車庫購買這輛車。',
});
const reject = (reason, extra = {}) => ({ ok: false, reason, message: messageByReason[reason], ...extra });

export function getPerformanceProfile(tuning = {}) {
  const upgrade = levels(tuning), engine = 1 + upgrade.engine * .12;
  const brakes = 1 + upgrade.brakes * .15, handling = 1 + upgrade.handling * .1;
  return { levels: upgrade, engineMultiplier: engine, brakeMultiplier: brakes, handlingMultiplier: handling,
    maxSpeed: 23 * engine, boostSpeed: 32 * engine, acceleration: 17 * engine, boostAcceleration: 24 * engine,
    steeringResponse: 16 * handling, yawResponse: 20 * handling, gripMultiplier: handling };
}

export function createGarageProgress() {
  return { version: 3, completed: [], money: GARAGE_RULES.startingMoney, ledger: [], customizations: {},
    ownedVehicleIds: [], selectedOwnedId: null, ownedVehicleHealth: {} };
}

function actionDetails(customization, vehicleId, action) {
  if (!originalCars.has(vehicleId)) return reject('vehicle');
  if (action?.kind === 'repair') return { ok: true, kind: 'repair', cost: GARAGE_CATALOG.repair.price };
  if (action?.kind === 'paint' && colors.has(action.value)) {
    const color = colors.get(action.value);
    const previousColor = colors.get(customization.colorId)?.color ?? originalCars.get(vehicleId).color;
    if (color.color === previousColor) return reject('same-color', { cost: GARAGE_CATALOG.paint.price });
    return { ok: true, kind: 'paint', value: color.id, color: color.color, cost: GARAGE_CATALOG.paint.price };
  }
  if (action?.kind === 'upgrade' && Object.hasOwn(GARAGE_CATALOG.upgrades, action.value)) {
    const level = customization.upgrades[action.value], option = GARAGE_CATALOG.upgrades[action.value];
    if (level >= option.maxLevel) return reject('max-level', { cost: 0 });
    return { ok: true, kind: 'upgrade', value: action.value, level: level + 1, cost: option.prices[level] };
  }
  return reject('invalid-action');
}

// Only known mission completions and an affordable prefix of purchases are
// replayed. Cached money, colors, levels and prices in localStorage are ignored.
// missionCount prevents a purchase from borrowing rewards earned later.
export function replayGarageProgress(raw) {
  const progress = createGarageProgress();
  try {
    if (!isRecord(raw) || !Object.hasOwn(raw, 'version') || ![1, 2, 3].includes(raw.version)
      || !Object.hasOwn(raw, 'completed') || !Array.isArray(raw.completed)) return progress;
    const completed = new Set(raw.completed.slice(0, 64).filter(id => typeof id === 'string'));
    for (const mission of MISSIONS) {
      if (!completed.has(mission.id)) break;
      progress.completed.push(mission.id); progress.money += mission.reward;
    }
    if (raw.version === 1) return progress;
  } catch { return createGarageProgress(); }
  let entries;
  try { entries = Object.hasOwn(raw, 'ledger') && Array.isArray(raw.ledger) ? raw.ledger.slice(0, GARAGE_RULES.maxLedger) : []; }
  catch { return progress; }
  let spent = 0, lastMissionCount = 0;
  const transactionIds = new Set();
  for (const entry of entries) {
    try {
      if (!isRecord(entry) || !isId(entry.id) || transactionIds.has(entry.id) || !originalCars.has(entry.vehicleId)
        || !Number.isInteger(entry.missionCount) || entry.missionCount < lastMissionCount || entry.missionCount > progress.completed.length) break;
      const customization = progress.customizations[entry.vehicleId] || defaultCustomization();
      const owned = progress.ownedVehicleIds.includes(entry.vehicleId), catalog = ownedCars.get(entry.vehicleId);
      let action;
      if (entry.kind === 'purchase') {
        if (raw.version !== 3 || !catalog || owned || progress.ownedVehicleIds.length >= PRIVATE_GARAGE_RULES.capacity) break;
        action = { ok: true, kind: 'purchase', cost: catalog.price };
      } else if (entry.kind === 'recover') {
        if (raw.version !== 3 || !catalog || !owned) break;
        action = { ok: true, kind: 'recover', cost: PRIVATE_GARAGE_RULES.recoverPrice };
      } else {
        if (catalog && !owned) break;
        action = actionDetails(customization, entry.vehicleId, entry);
      }
      const available = GARAGE_RULES.startingMoney + MISSIONS.slice(0, entry.missionCount).reduce((sum, mission) => sum + mission.reward, 0) - spent;
      if (!action.ok || available < action.cost) break;
      const record = { id: entry.id, vehicleId: entry.vehicleId, kind: action.kind,
        ...(action.value ? { value: action.value } : {}), missionCount: entry.missionCount };
      progress.ledger.push(record); transactionIds.add(record.id);
      lastMissionCount = record.missionCount; spent += action.cost;
      if (action.kind === 'purchase') progress.ownedVehicleIds.push(record.vehicleId);
      if (action.kind === 'purchase' || action.kind === 'recover' || catalog && action.kind === 'repair') progress.ownedVehicleHealth[record.vehicleId] = 100;
      if (action.kind === 'paint') customization.colorId = action.value;
      if (action.kind === 'upgrade') customization.upgrades[action.value] = action.level;
      if (action.kind === 'paint' || action.kind === 'upgrade') progress.customizations[record.vehicleId] = customization;
    } catch { break; }
  }
  progress.money -= spent;
  // Ownership and purchase costs are ledger-derived. The small health snapshot
  // is deliberately separate: storing or switching a car must retain damage.
  for (const id of progress.ownedVehicleIds) {
    try {
      if (isRecord(raw.ownedVehicleHealth) && Object.hasOwn(raw.ownedVehicleHealth, id)) {
        const health = raw.ownedVehicleHealth[id];
        progress.ownedVehicleHealth[id] = Number.isFinite(health) ? Math.max(0, Math.min(100, Math.floor(health))) : 0;
      }
    } catch { progress.ownedVehicleHealth[id] = 0; }
  }
  try { if (progress.ownedVehicleIds.includes(raw.selectedOwnedId)) progress.selectedOwnedId = raw.selectedOwnedId; }
  catch { /* A malformed preference does not invalidate purchases. */ }
  return progress;
}

export function garageEligibility(context = {}) {
  const { vehicle, player, controlledId, wantedLevel, transition, dead } = context;
  if (dead) return reject('dead');
  if (transition) return reject('busy');
  if (context.walking !== false) return reject('on-foot');
  if (!isCivilian(vehicle) || controlledId !== vehicle.id) return reject('vehicle');
  if (vehicle.damageStage === 'burning' || vehicle.damageStage === 'wreck' || vehicle.vehicleHealth <= 0) return reject('destroyed');
  if (!Number.isFinite(wantedLevel) || wantedLevel !== 0) return reject('wanted');
  if (!Number.isFinite(vehicle.speed) || !Number.isFinite(player?.speed)
    || Math.max(Math.abs(vehicle.speed), Math.abs(player.speed)) > GARAGE_RULES.maxSpeed) return reject('moving');
  const location = context.location || LOCATIONS.find(place => place.id === 'garage');
  if (!location || ![vehicle.x, vehicle.z, player.x, player.z, location.x, location.z].every(Number.isFinite)
    || Math.hypot(vehicle.x - location.x, vehicle.z - location.z) > GARAGE_RULES.radius
    || Math.hypot(player.x - location.x, player.z - location.z) > GARAGE_RULES.radius) return reject('distance');
  return { ok: true, reason: null, message: '車輛已停妥，可以開始改裝。' };
}

export function quoteGarageAction(progress, vehicle, action) {
  const current = replayGarageProgress(progress);
  if (!isCivilian(vehicle)) return reject('vehicle');
  if (ownedCars.has(vehicle.id) && !current.ownedVehicleIds.includes(vehicle.id)) return reject('not-owned');
  if (ownedCars.has(vehicle.id) && current.ownedVehicleHealth[vehicle.id] <= 0) return reject('destroyed');
  if (vehicle.damageStage === 'burning' || vehicle.damageStage === 'wreck' || vehicle.vehicleHealth <= 0) return reject('destroyed');
  if (current.ledger.length >= GARAGE_RULES.maxLedger) return reject('ledger-full');
  const customization = current.customizations[vehicle.id] || defaultCustomization();
  const quote = actionDetails(customization, vehicle.id, action);
  if (!quote.ok) return quote;
  if (quote.kind === 'repair' && (!Number.isFinite(vehicle.vehicleHealth) || vehicle.vehicleHealth >= 100)) return reject('full-health', { cost: quote.cost });
  if (quote.kind === 'paint' && vehicle.color === quote.color) return reject('same-color', { cost: quote.cost });
  if (current.money < quote.cost) return reject('insufficient-funds', { cost: quote.cost });
  return { ...quote, reason: null, message: '', balanceAfter: current.money - quote.cost };
}

export function applyGarageCustomizations(fleet, progress) {
  const current = replayGarageProgress(progress);
  return fleet.map(vehicle => {
    if (!isCivilian(vehicle)) return vehicle;
    if (ownedCars.has(vehicle.id) && !current.ownedVehicleIds.includes(vehicle.id)) return vehicle;
    const customization = current.customizations[vehicle.id] || defaultCustomization();
    return { ...vehicle, color: colors.get(customization.colorId)?.color ?? originalCars.get(vehicle.id).color,
      upgrades: { ...customization.upgrades } };
  });
}

export function applyGarageAction(progress, vehicle, action, context = {}) {
  const current = replayGarageProgress(progress);
  const fail = result => ({ ...result, progress: current, vehicle, clearCollisionCooldown: false });
  if (!isId(action?.id)) return fail(reject('invalid-action'));
  if (current.ledger.some(entry => entry.id === action.id)) return fail(reject('duplicate'));
  const eligible = garageEligibility({ ...context, vehicle });
  if (!eligible.ok) return fail(eligible);
  const quote = quoteGarageAction(current, vehicle, action);
  if (!quote.ok) return fail(quote);
  const record = { id: action.id, vehicleId: vehicle.id, kind: quote.kind,
    ...(quote.value ? { value: quote.value } : {}), missionCount: current.completed.length };
  const health = { ...current.ownedVehicleHealth };
  if (current.ownedVehicleIds.includes(vehicle.id)) {
    // A paint or tuning receipt may be saved before the periodic damage
    // snapshot. Carry this shell's current health without healing it on reload.
    health[vehicle.id] = quote.kind === 'repair' ? 100 : Number.isFinite(vehicle.vehicleHealth)
      ? Math.max(0, Math.min(100, Math.floor(vehicle.vehicleHealth))) : health[vehicle.id];
  }
  const next = replayGarageProgress({ ...current, ledger: [...current.ledger, record], ownedVehicleHealth: health });
  let updated = applyGarageCustomizations([vehicle], next)[0];
  if (quote.kind === 'repair') updated = { ...updated, vehicleHealth: 100, damageStage: 'intact',
    burnRemaining: 0, wreckAge: 0, burnSource: null, impact: false, impactSpeed: 0, impactVehicleId: null };
  return { ok: true, reason: null, message: quote.kind === 'repair' ? '車輛已完整修復。' : quote.kind === 'paint' ? '新車色已完成。' : '性能升級已完成。',
    cost: quote.cost, progress: next, vehicle: updated, clearCollisionCooldown: quote.kind === 'repair' };
}
