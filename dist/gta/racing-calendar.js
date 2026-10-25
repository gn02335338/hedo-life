// One calendar shared by the client and Worker. Taiwan has no daylight-saving
// transition, so fixed UTC+8 boundaries stay independent of the device timezone.
export const RACING_DAY_MS = 24 * 60 * 60 * 1000;
export const RACING_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;
const isoDay = milliseconds => new Date(milliseconds).toISOString().slice(0, 10);

export function validDayId(dayId) {
  if (typeof dayId !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dayId)) return false;
  const milliseconds = Date.parse(`${dayId}T00:00:00.000Z`);
  return Number.isFinite(milliseconds) && isoDay(milliseconds) === dayId;
}

export function validWeekId(weekId) {
  return validDayId(weekId) && new Date(`${weekId}T00:00:00.000Z`).getUTCDay() === 1;
}

export function racingCalendar(nowMs) {
  if (!Number.isFinite(nowMs)) return null;
  const shifted = nowMs + RACING_UTC_OFFSET_MS;
  if (!Number.isFinite(shifted) || Math.abs(shifted) > 8.64e15) return null;
  const dayId = isoDay(shifted);
  if (!validDayId(dayId)) return null;
  const dayUtc = Date.parse(`${dayId}T00:00:00.000Z`);
  const weekday = new Date(dayUtc).getUTCDay();
  const mondayUtc = dayUtc - ((weekday + 6) % 7) * RACING_DAY_MS;
  const weekId = isoDay(mondayUtc), previousWeekId = isoDay(mondayUtc - 7 * RACING_DAY_MS);
  if (!validWeekId(weekId) || !validWeekId(previousWeekId)) return null;
  const dayStartsAt = dayUtc - RACING_UTC_OFFSET_MS;
  const weekStartsAt = mondayUtc - RACING_UTC_OFFSET_MS;
  return { dayId, weekId, previousWeekId, dayStartsAt, dayEndsAt: dayStartsAt + RACING_DAY_MS,
    weekStartsAt, weekEndsAt: weekStartsAt + 7 * RACING_DAY_MS };
}

const dailySchedule = Object.freeze([
  { raceId: 'first-sprint', title: '週日暖身衝刺', targetMs: 10000, reward: 180 },
  { raceId: 'block-sprint', title: '週一街區節奏', targetMs: 45000, reward: 220 },
  { raceId: 'first-sprint', title: '週二直線突破', targetMs: 9000, reward: 200 },
  { raceId: 'city-loop', title: '週三環城巡航', targetMs: 85000, reward: 280 },
  { raceId: 'block-sprint', title: '週四彎道挑戰', targetMs: 40000, reward: 240 },
  { raceId: 'first-sprint', title: '週五八秒俱樂部', targetMs: 8000, reward: 240 },
  { raceId: 'city-loop', title: '週六極速環城', targetMs: 75000, reward: 320 },
].map(Object.freeze));

export function dailyChallenge(dayId) {
  if (!validDayId(dayId)) return null;
  const midnightUtc = Date.parse(`${dayId}T00:00:00.000Z`);
  const definition = dailySchedule[new Date(midnightUtc).getUTCDay()];
  const startsAt = midnightUtc - RACING_UTC_OFFSET_MS;
  return { dayId, ...definition, description: `在 ${definition.targetMs / 1000} 秒內有效完賽，領取今日獎勵。`,
    startsAt, endsAt: startsAt + RACING_DAY_MS };
}
