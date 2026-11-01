// Local office activities. Schedules and opponents are deterministic display
// rules, with no model execution, network traffic or career-game state.
export const OFFICE_EVENT_BUCKET_MS = 8 * 60_000;
export const OFFICE_EVENT_REGISTRATION_MS = 30_000;
export const OFFICE_EVENT_PLAY_MS = 90_000;
export const OFFICE_EVENT_FINISH_MS = 30_000;
export const OFFICE_EVENT_DURATION_MS = OFFICE_EVENT_REGISTRATION_MS + OFFICE_EVENT_PLAY_MS + OFFICE_EVENT_FINISH_MS;

const TYPES = Object.freeze(['duel', 'arm-wrestling', 'coffee']);
const copy = Object.freeze({
  duel: Object.freeze({ title: '友善單挑：過招八回合', description: '到一樓選擇攻、守或閃，和本場腳本對手過招。八輪戰術選擇，沒有手速要求。' }),
  'arm-wrestling': Object.freeze({ title: '腕力小擂台', description: '力量、穩住與蓄力怎麼分配？在一樓玩八輪腕力小遊戲，選完才揭曉這輪比分。' }),
  coffee: Object.freeze({ title: '茶水間碰杯時間', description: '到一樓安排試喝、聊天與碰杯，玩四輪輕鬆小遊戲。這是個人活動，不會替同事發送真實訊息。' }),
});
const mod = (value, divisor) => ((value % divisor) + divisor) % divisor;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
function hash(value) {
  let state = 2166136261;
  for (const letter of String(value)) state = Math.imul(state ^ letter.codePointAt(0), 16777619);
  return state >>> 0;
}
function startsInBucket(bucket) { return bucket * OFFICE_EVENT_BUCKET_MS + hash(`office-event-v1:${bucket}`) % 180_001; }

export function getOfficeEvent(now = Date.now()) {
  const sampledAt = Number.isFinite(now) ? now : 0;
  let bucket = Math.floor(sampledAt / OFFICE_EVENT_BUCKET_MS);
  let startsAt = startsInBucket(bucket);
  if (sampledAt >= startsAt + OFFICE_EVENT_DURATION_MS) startsAt = startsInBucket(++bucket);
  const playStartsAt = startsAt + OFFICE_EVENT_REGISTRATION_MS;
  const playEndsAt = playStartsAt + OFFICE_EVENT_PLAY_MS;
  const endsAt = playEndsAt + OFFICE_EVENT_FINISH_MS;
  const type = TYPES[mod(bucket, TYPES.length)];
  const phase = sampledAt < startsAt ? 'upcoming' : sampledAt < playStartsAt ? 'registration' : sampledAt < playEndsAt ? 'playing' : 'finished';
  const phaseStart = phase === 'registration' ? startsAt : phase === 'playing' ? playStartsAt : playEndsAt;
  const phaseLength = phase === 'registration' ? OFFICE_EVENT_REGISTRATION_MS : phase === 'playing' ? OFFICE_EVENT_PLAY_MS : OFFICE_EVENT_FINISH_MS;
  return {
    id: `office-event-v1-${bucket}`, type, ...copy[type], floor: 1, phase,
    startsAt, playStartsAt, playEndsAt, endsAt, nextStartsAt: startsInBucket(bucket + 1),
    progress: phase === 'upcoming' ? 0 : clamp((sampledAt - phaseStart) / phaseLength, 0, 1),
  };
}

export const OFFICE_GAME_ACTIONS = Object.freeze({
  duel: Object.freeze([
    Object.freeze({ id: 'attack', label: '攻', description: '向前過招，試著抓到對手移位的空檔。' }),
    Object.freeze({ id: 'guard', label: '守', description: '穩住架勢，觀察對手這一輪的出招。' }),
    Object.freeze({ id: 'dodge', label: '閃', description: '換個角度移步，找下一個切入位置。' }),
  ]),
  'arm-wrestling': Object.freeze([
    Object.freeze({ id: 'power', label: '力量', description: '用目前累積的力氣，嘗試推進這一輪。' }),
    Object.freeze({ id: 'steady', label: '穩住', description: '先穩定手臂，也替下一輪保留力氣。' }),
    Object.freeze({ id: 'charge', label: '蓄力', description: '把這一輪留給調整呼吸與累積力氣。' }),
  ]),
  coffee: Object.freeze([
    Object.freeze({ id: 'sip', label: '試喝一口', description: '留一點時間給杯子裡的香氣。' }),
    Object.freeze({ id: 'chat', label: '輕鬆聊聊', description: '替這個虛構的小片刻選一段閒聊。' }),
    Object.freeze({ id: 'cheers', label: '舉杯碰杯', description: '給剛才那段忙碌一個小小的收尾。' }),
  ]),
});

export function getOfficeGameActions(typeOrState) {
  const type = typeof typeOrState === 'string' ? typeOrState : typeOrState?.type;
  return typeof type === 'string' && Object.hasOwn(OFFICE_GAME_ACTIONS, type) ? OFFICE_GAME_ACTIONS[type] : [];
}

export function createOfficeGame(event, opponentId = 'office-host') {
  if (!event || typeof event.id !== 'string' || !event.id || event.id.length > 120 || !TYPES.includes(event.type)) throw new TypeError('請選擇一場有效的辦公室活動。');
  if (typeof opponentId !== 'string' || !opponentId.trim() || opponentId.length > 120 || /[\u0000-\u001f\u007f]/u.test(opponentId)) throw new TypeError('請選擇一位活動對手。');
  return {
    version: 1, eventId: event.id, type: event.type, opponentId,
    round: 0, maxRounds: event.type === 'coffee' ? 4 : 8, status: 'playing',
    playerScore: 0, opponentScore: 0, playerEnergy: 2, opponentEnergy: 2,
    lastRound: null, history: [], winner: null, seed: hash(`${event.id}:${event.type}:${opponentId}`),
  };
}

function validateState(state) {
  if (!state || state.version !== 1 || !TYPES.includes(state.type) || typeof state.eventId !== 'string' || typeof state.opponentId !== 'string'
    || state.maxRounds !== (state.type === 'coffee' ? 4 : 8) || !Number.isInteger(state.round) || state.round < 0 || state.round > state.maxRounds
    || !Array.isArray(state.history) || state.history.length !== state.round || !['playing', 'finished'].includes(state.status)
    || state.status !== (state.round === state.maxRounds ? 'finished' : 'playing')
    || !Number.isInteger(state.seed) || state.seed < 0 || state.seed > 0xffffffff
    || ![state.playerScore, state.opponentScore].every(value => Number.isInteger(value) && value >= 0 && value <= state.maxRounds * 2)
    || ![state.playerEnergy, state.opponentEnergy].every(value => Number.isInteger(value) && value >= 0 && value <= 6)) throw new TypeError('這輪活動紀錄無法使用，請重新開啟小遊戲。');
}

function armMove(action, energy) {
  if (action === 'power') return { force: 2 + Math.min(3, energy), energy: Math.max(0, energy - 2) };
  if (action === 'steady') return { force: 2, energy: Math.min(6, energy + 1) };
  return { force: 1, energy: Math.min(6, energy + 2) };
}

export function advanceOfficeGame(state, action) {
  validateState(state);
  if (state.status === 'finished') return { ...state, lastRound: state.lastRound ? { ...state.lastRound } : null, history: state.history.map(row => ({ ...row })) };
  const options = getOfficeGameActions(state), playerIndex = options.findIndex(option => option.id === action);
  if (playerIndex < 0) throw new TypeError('請選擇這場活動提供的動作。');
  const round = state.round + 1;
  const opponentIndex = hash(`${state.seed}:opponent:${round}`) % options.length;
  const opponentAction = options[opponentIndex].id;
  let playerEnergy = state.playerEnergy, opponentEnergy = state.opponentEnergy, comparison;
  if (state.type === 'arm-wrestling') {
    const player = armMove(action, playerEnergy), opponent = armMove(opponentAction, opponentEnergy);
    playerEnergy = player.energy; opponentEnergy = opponent.energy;
    const playerForce = player.force - (opponentAction === 'steady' && action === 'power' ? 1 : 0);
    const opponentForce = opponent.force - (action === 'steady' && opponentAction === 'power' ? 1 : 0);
    comparison = Math.sign(playerForce - opponentForce);
  } else {
    // Attack catches a dodge, guarding holds an attack, and a side step finds
    // the opening in a guard. Coffee uses the same small, choice-led rhythm.
    comparison = playerIndex === opponentIndex ? 0 : mod(playerIndex - opponentIndex, 3) === 1 ? 1 : -1;
  }
  const playerPoints = comparison === 0 ? 1 : comparison > 0 ? 2 : 0;
  const opponentPoints = comparison === 0 ? 1 : comparison < 0 ? 2 : 0;
  const playerScore = state.playerScore + playerPoints, opponentScore = state.opponentScore + opponentPoints;
  const result = comparison === 0 ? '這輪勢均力敵，雙方各得一分。' : comparison > 0 ? '這輪你找到節奏，拿下兩分。' : '這輪腳本對手先抓到機會，拿下兩分。';
  const row = {
    round, playerAction: action, opponentAction, playerPoints, opponentPoints,
    playerScore, opponentScore, playerEnergy, opponentEnergy,
    text: `你選「${options[playerIndex].label}」，腳本對手選「${options[opponentIndex].label}」。${result}`,
  };
  const finished = round === state.maxRounds;
  return {
    ...state, round, playerScore, opponentScore, playerEnergy, opponentEnergy,
    lastRound: row, history: [...state.history.map(previous => ({ ...previous })), row],
    status: finished ? 'finished' : 'playing',
    winner: finished ? playerScore === opponentScore ? 'draw' : playerScore > opponentScore ? 'player' : 'opponent' : null,
  };
}
