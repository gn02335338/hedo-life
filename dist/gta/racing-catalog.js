const point = (x, z) => Object.freeze({ x, z });
const drivers = Object.freeze({
  wings: Object.freeze({ name: '翅膀的 BMW', variant: 'bmw-executive', color: 0xb9c3cf }),
  owen: Object.freeze({ name: '歐文的黑色 Tesla Model Y', variant: 'tesla-model-y', color: 0x171c24 }),
  chairman: Object.freeze({ name: '董事長的藍色 Maserati', variant: 'maserati-gt', color: 0x245aab }),
});
export const RACING_RULES = Object.freeze({ countdownSeconds: 3, startRadius: 7, startMaxSpeed: 1,
  checkpointRadius: 7, corridorWidth: 12, offRouteSeconds: 3, maxRivals: 2,
  maxStep: .1, maximumPlayerSpeed: 43, teleportSlack: .35 });
const makeRace = (id, name, description, route, timeLimit, reward, maxRank, rivalSpeeds) => {
  const distance = route.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - route[i].x, p.z - route[i].z), 0);
  return Object.freeze({ id, name, description, type: rivalSpeeds.length ? 'street' : 'time-trial',
    start: Object.freeze({ ...route[0], heading: Math.PI / 2, radius: RACING_RULES.startRadius }),
    route: Object.freeze(route), checkpoints: Object.freeze(route.slice(1).map(p => Object.freeze({ ...p, radius: RACING_RULES.checkpointRadius }))),
    distance, timeLimit, reward, maxRank, rivalSpeeds: Object.freeze(rivalSpeeds),
    rivalDrivers: Object.freeze(!rivalSpeeds.length ? [] : id === 'block-sprint' ? [drivers.wings, drivers.owen] : [drivers.chairman, drivers.wings]) });
};
export const RACE_CATALOG = Object.freeze([
  makeRace('first-sprint', '首發直線計時', '沿著東向街道依序穿過三個標記。原裝小車也能從容完成。',
    [point(-30, 60), point(0, 60), point(60, 60), point(120, 60)], 24, 140, 1, []),
  makeRace('block-sprint', '街區短途賽', '繞行中央街區一圈，前兩名完成即可領取獎金。',
    [point(-30, 60), point(0, 60), point(60, 60), point(60, 0), point(0, 0), point(-60, 0), point(-60, 60), point(-30, 60)], 60, 260, 2, [15, 16.5]),
  makeRace('city-loop', '環城挑戰賽', '沿外環街道回到起點，搶下第一名。彎前提早煞車。',
    [point(-30, 60), point(0, 60), point(60, 60), point(120, 60), point(120, 0), point(120, -60), point(60, -60),
      point(0, -60), point(-60, -60), point(-120, -60), point(-120, 0), point(-120, 60), point(-60, 60), point(-30, 60)], 100, 420, 1, [18, 19]),
]);

// Receipts contain only bounded route facts. Rewards always come from this
// catalog, never from cached money or a caller-supplied prize value.
export function validRaceCompletion(receipt) {
  const race = RACE_CATALOG.find(item => item.id === receipt?.raceId);
  if (!race || !Number.isInteger(receipt.elapsedMs) || receipt.elapsedMs <= 0 || receipt.elapsedMs > race.timeLimit * 1000
    || !Number.isInteger(receipt.rank) || receipt.rank < 1 || receipt.rank > race.rivalSpeeds.length + 1
    || !Array.isArray(receipt.checkpointTimes) || receipt.checkpointTimes.length !== race.checkpoints.length) return false;
  let previousTime = 0;
  for (let index = 0; index < race.checkpoints.length; index += 1) {
    const time = receipt.checkpointTimes[index], from = race.route[index], to = race.route[index + 1];
    const minimum = Math.max(0, Math.hypot(to.x - from.x, to.z - from.z) - 2 * RACING_RULES.checkpointRadius) / RACING_RULES.maximumPlayerSpeed * 1000;
    if (!Number.isInteger(time) || time < previousTime || time > receipt.elapsedMs || time - previousTime + 2 < minimum) return false;
    previousTime = time;
  }
  return previousTime === receipt.elapsedMs;
}

export function validRaceReceipt(receipt) {
  const race = RACE_CATALOG.find(item => item.id === receipt?.raceId);
  return Boolean(race && validRaceCompletion(receipt) && receipt.rank <= race.maxRank);
}
