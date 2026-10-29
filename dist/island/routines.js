import { ISLAND_CAST } from './cast.js';
import { PLACE_BY_ID } from './places.js';

// An authored island day, not the real colleagues' working hours or whereabouts.
// The selected island clock is the only input: no wall clock, storage or RNG.
const castById = new Map(ISLAND_CAST.map(person => [person.id, person]));
const courtRegulars = new Set(['sonny', 'peter', 'jack', 'owen', 'sam', 'action', 'princess', 'wine',
  'henry', 'tony', 'rick', 'helen', 'professor', 'jonathan', 'zoe', 'mia']);
const seedOf = text => { let value = 2166136261; for (const char of text) value = Math.imul(value ^ char.codePointAt(0), 16777619); return value >>> 0; };
const minutesOf = hour => {
  const value = Number(hour);
  return Math.floor(((Number.isFinite(value) ? value % 24 + 24 : 36) % 24) * 60 + 1e-7);
};
const clockLabel = minutes => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
const story = (title, opening, choices) => Object.freeze({ title, opening,
  choices: Object.freeze(choices.map(([label, response]) => Object.freeze({ label, response }))) });

// Project hosts keep their company affiliation in cast.js; these are their
// authored places to meet visitors while exploring the friend islands.
export const PROJECT_HOSTS = Object.freeze({
  alice: Object.freeze({ districtId: 'omega-city', placeId: 'omega-terminal', restPlaceId: 'omega-overlook', activity: '在市民登記站介紹《終末之都》' }),
  jack: Object.freeze({ districtId: 'oneira', placeId: 'oneira-hub', restPlaceId: 'oneira-library', activity: '在 Oneira 航站迎接來訪的朋友' }),
  johnny: Object.freeze({ districtId: 'oneira', placeId: 'oneira-library', restPlaceId: 'oneira-hub', activity: '在開源靈感館分享今天的靈感' }),
});

export const MYSTERY_TRIP = Object.freeze({
  hostId: 'kind',
  // Includes the host; these five walk to the gathering point independently.
  participantIds: Object.freeze(['kind', 'jack', 'cindy', 'james', 'johnny']),
  startHour: 19, gatherUntilHour: 19.5, endHour: 20,
  placeId: 'aliang-mystery-trip', districtId: 'harbor',
  title: '阿良今晚有一個提議',
  invitation: '19:00 到夜色碼頭集合，19:30 沿著碼頭散步。阿良揪了傑克、辛蒂、詹姆士和強尼，也替你留了一個位置。',
  story: story('神秘行程，先從集合開始',
    '阿良把行程卡翻過來，這次終於寫了時間。傑克問能不能帶飲料，辛蒂先確認回程，詹姆士和強尼還在猜下一站。阿良笑著說：「先沿碼頭走一段，想加入就來，想先回去也可以。」', [
      ['一起走一段，沿途慢慢聊', '你答應加入。大家把工作的話題留在岸邊，從路邊那盞忽明忽暗的燈聊起；今晚最神秘的部分，是誰還記得剛才的笑話。'],
      ['先問清楚集合與散場方式', '辛蒂把集合點和散場時間補在卡上，阿良點頭說好。神秘可以留一點，回程不用靠猜。'],
      ['今天先不跟，替大家留一句祝福', '你揮揮手，阿良把空白小卡留給你，說下次再約。碼頭的路還很長，今晚也可以照自己的步調走。'],
    ]),
});

function routine(phase, placeId, activity, label, timeLabel, extra = {}) {
  return Object.freeze({ phase, placeId, districtId: PLACE_BY_ID.get(placeId).districtId, activity, label, timeLabel, ...extra });
}

function projectHostRoutine(host, minutes, seed) {
  const extra = { projectHost: true }, main = PLACE_BY_ID.get(host.placeId), rest = PLACE_BY_ID.get(host.restPlaceId);
  if (minutes >= 18 * 60 || minutes < 6 * 60) return routine('afterwork', host.restPlaceId,
    `在${rest.name}吹海風、聊聊今天`, '友島晚間歇腳', '18:00–06:00', extra);
  if (minutes < 9 * 60) return routine('arrival', host.placeId,
    `到${main.name}準備迎接來訪的朋友`, '友島早安', '06:00–09:00', extra);
  const lunchStart = 12 * 60 + (seed % 3) * 15;
  const teaStart = 15 * 60 + (Math.floor(seed / 3) % 3) * 15;
  if (minutes >= lunchStart && minutes < lunchStart + 45) return routine('break', host.restPlaceId,
    `在${rest.name}歇腳、喝水，看看海`, '友島午間休息', `${clockLabel(lunchStart)}–${clockLabel(lunchStart + 45)}`, extra);
  if (minutes >= teaStart && minutes < teaStart + 45) return routine('break', host.restPlaceId,
    `到${rest.name}換換心情、聊聊靈感`, '友島午後歇腳', `${clockLabel(teaStart)}–${clockLabel(teaStart + 45)}`, extra);
  return routine('work', host.placeId, host.activity, '專案島接待', '09:00–18:00 · 休息時間除外', extra);
}

/** Current destination and activity for one public colleague; unknown IDs stay out. */
export function getPersonRoutine(id, hour = 12) {
  const person = castById.get(id);
  if (!person) return null;
  const minutes = minutesOf(hour), seed = seedOf(id), work = PLACE_BY_ID.get(person.workplaceId);
  if (minutes >= 19 * 60 && minutes < 20 * 60 && MYSTERY_TRIP.participantIds.includes(id)) {
    const gathering = minutes < 19 * 60 + 30;
    return routine('mystery', MYSTERY_TRIP.placeId,
      gathering ? id === MYSTERY_TRIP.hostId ? '在碼頭揪大家集合' : '赴阿良的碼頭之約'
        : id === MYSTERY_TRIP.hostId ? '帶大家沿碼頭散步' : '和阿良一起逛碼頭',
      gathering ? '神秘行程集合' : '神秘行程散步', gathering ? '19:00–19:30' : '19:30–20:00', { tripStage: gathering ? 'gathering' : 'stroll' });
  }
  const host = PROJECT_HOSTS[id];
  if (host) return projectHostRoutine(host, minutes, seed);
  if (minutes >= 18 * 60 || minutes < 6 * 60) {
    const court = courtRegulars.has(id);
    return routine('afterwork', court ? 'basketball-court' : 'izakaya',
      court ? '在球場投籃、場邊聊天' : '在居酒屋聊聊今天', minutes < 6 * 60 ? '晚間歇腳' : '下班生活', '18:00 以後');
  }
  if (minutes < 9 * 60) return routine('arrival', person.workplaceId, `到${work.name}準備今天的事`, '早安，慢慢就位', '06:00–09:00');
  // Three stable cohorts leave15minutes apart. Their45minute breaks include
  // travel time and overlap briefly, but they do not all depart at once.
  const lunchStart = 12 * 60 + (seed % 3) * 15;
  const teaStart = 15 * 60 + (Math.floor(seed / 3) % 3) * 15;
  if (minutes >= lunchStart && minutes < lunchStart + 45) return routine('break', 'pantry', '午休時到茶水間喝水、聊兩句', '午間休息', `${clockLabel(lunchStart)}–${clockLabel(lunchStart + 45)}`);
  if (minutes >= teaStart && minutes < teaStart + 45) return routine('break', 'pantry', '到茶水間補杯水，換換心情', '午後茶水時間', `${clockLabel(teaStart)}–${clockLabel(teaStart + 45)}`);
  return routine('work', person.workplaceId, `在${work.name}處理手邊的事`, '部門日常', '09:00–18:00 · 休息時間除外');
}

/** Public overview copy follows the same clock as the individual schedules. */
export function getIslandRoutine(hour = 12) {
  const minutes = minutesOf(hour);
  if (minutes >= 19 * 60 && minutes < 20 * 60) {
    const gathering = minutes < 19 * 60 + 30;
    return Object.freeze({ phase: 'mystery', title: gathering ? '阿良正在揪人集合' : '阿良的碼頭小旅行', timeLabel: gathering ? '19:00–19:30' : '19:30–20:00',
      description: gathering ? '阿良與夥伴正前往夜色碼頭。想加入，19:30 一起沿碼頭走走。' : '阿良與夥伴在碼頭散步；其他同事各自享受下班時間。',
      trip: Object.freeze({ ...MYSTERY_TRIP, stage: gathering ? 'gathering' : 'stroll' }) });
  }
  if (minutes >= 18 * 60 || minutes < 6 * 60) return Object.freeze({ phase: 'afterwork', title: '下班，各有下一站', timeLabel: '18:00 以後',
    description: minutes >= 20 * 60 || minutes < 6 * 60 ? '神秘行程散場了。有人回球場，有人回居酒屋，接下來照自己的步調走。'
      : '有人去球場活動，有人在居酒屋坐坐。19:00，阿良會在夜色碼頭揪一趟神秘行程。', trip: null });
  if (minutes < 9 * 60) return Object.freeze({ phase: 'arrival', title: '早安，慢慢就位', timeLabel: '06:00–09:00',
    description: '同事陸續到各自部門，準備今天的小事。', trip: null });
  if (minutes >= 12 * 60 && minutes < 13 * 60 + 15) return Object.freeze({ phase: 'break', title: '午間，輪流歇一會兒', timeLabel: '12:00–13:15 · 分批休息',
    description: '同事分批到茶水間喝水、聊天，休息後再回自己的部門。', trip: null });
  if (minutes >= 15 * 60 && minutes < 16 * 60 + 15) return Object.freeze({ phase: 'break', title: '午後，換一杯水', timeLabel: '15:00–16:15 · 分批休息',
    description: '茶水間開始熱鬧起來；每個人的休息時間稍微錯開。', trip: null });
  return Object.freeze({ phase: 'work', title: '白天，在各自的部門', timeLabel: '09:00–18:00 · 依個人作息歇腳',
    description: '同事在自己的工作據點活動。午間與午後去茶水間，18:00 後換個地方相聚。', trip: null });
}
