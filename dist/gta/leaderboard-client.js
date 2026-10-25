import { RACE_CATALOG } from './racing-catalog.js';
import { OWNED_CAR_CATALOG } from './ownership-catalog.js';
import { racingCalendar, dailyChallenge, validWeekId } from './racing-calendar.js';

export const RANKING_PENDING_KEY = 'hedo-gta-ranking-pending-v1';
const IDENTITY_KEY = 'hedo-anonymous-v1', TOKEN = /^[a-f0-9]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const races = new Map(RACE_CATALOG.map(race => [race.id, race]));
const cars = new Set(OWNED_CAR_CATALOG.map(car => car.id));
const bytes = value => new TextEncoder().encode(JSON.stringify(value)).byteLength;
const copy = value => JSON.parse(JSON.stringify(value));
function periodFilter({ scope = 'alltime', weekId } = {}) {
  if (scope === 'alltime' && weekId === undefined) return { key: '', query: '' };
  if (scope !== 'weekly' || !validWeekId(weekId)) throw new Error('請選擇有效的每週賽季。');
  return { key: '|weekly|' + weekId, query: 'scope=weekly&weekId=' + encodeURIComponent(weekId), scope, weekId };
}
const validPeriod = (data, filter) => filter.key ? data.scope === 'weekly' && data.weekId === filter.weekId
  : (data.scope === undefined || data.scope === 'alltime') && data.weekId === undefined;
const driverCode = value => typeof value === 'string' && value.length > 0 && value.length <= 32 && !/[\u0000-\u001f\u007f]/u.test(value);
const validEntry = (row, raceId, privateRow = false) => row && races.has(raceId) && cars.has(row.vehicleId)
  && Number.isSafeInteger(row.elapsedMs) && row.elapsedMs > 0 && row.elapsedMs <= races.get(raceId).timeLimit * 1000
  && Number.isSafeInteger(row.position) && row.position > 0
  && (!privateRow || row.raceId === raceId && UUID.test(row.runId || ''));
function validBody(body) {
  const proof = body?.proof;
  return UUID.test(body?.runId || '') && proof?.version === 1 && races.has(proof.raceId) && cars.has(proof.vehicleId)
    && Array.isArray(proof.samples) && proof.samples.length >= 2 && proof.samples.length <= 6002
    && proof.samples.every(sample => Array.isArray(sample) && sample.length === 4 && sample.every(Number.isFinite)
      && Number.isInteger(sample[0]) && sample[0] >= 0 && sample[0] <= 12000
      && Math.abs(sample[1]) <= 150 && Math.abs(sample[2]) <= 150 && Math.abs(sample[3]) <= 45)
    && bytes(body) <= 256 * 1024;
}

// Only explicit publication creates a credential or writes this one-slot queue.
// The owner hash binds uncertain responses to their original anonymous identity.
export function createLeaderboardClient({ storage, fetcher = globalThis.fetch, random = globalThis.crypto,
  timeoutMs = 8000, now = Date.now } = {}) {
  const cache = new Map(), inflight = new Map(), revisions = new Map();
  const invalidate = raceId => {
    const keys = new Set([raceId, ...cache.keys(), ...inflight.keys(), ...revisions.keys()]);
    for (const key of keys) if (key === raceId || key.startsWith(raceId + '|')) {
      revisions.set(key, (revisions.get(key) || 0) + 1); cache.delete(key);
    }
  };
  let calendarCache = null, calendarRequest = null;
  let readyToken = null, sending = null, sendingBody = null;
  const readToken = () => { try { const token = storage?.getItem(IDENTITY_KEY); return TOKEN.test(token || '') ? token : null; } catch { return null; } };
  const sameIdentity = token => { if (readToken() !== token) throw new Error('匿名身分已在其他分頁變更，請重新整理後再查詢。'); };
  const hash = async token => Array.from(new Uint8Array(await random.subtle.digest('SHA-256', new TextEncoder().encode(token))), n => n.toString(16).padStart(2, '0')).join('');
  function credential() {
    try {
      if (!storage) throw new Error();
      const existing = storage.getItem(IDENTITY_KEY);
      if (existing !== null && !TOKEN.test(existing)) throw new Error();
      const token = existing || Array.from(random.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, '0')).join('');
      storage.setItem(IDENTITY_KEY, token);
      if (storage.getItem(IDENTITY_KEY) !== token) throw new Error();
      return token;
    } catch { throw new Error('瀏覽器無法保存上榜憑證。請允許本站儲存資料；個人紀錄仍可在本機遊玩。'); }
  }
  function readPending() {
    try {
      const raw = storage?.getItem(RANKING_PENDING_KEY);
      if (!raw) return null;
      if (raw.length > 270000) throw new Error();
      const pending = JSON.parse(raw);
      if (pending?.version !== 1 || !TOKEN.test(pending.owner || '') || !validBody(pending.body)) throw new Error();
      return pending;
    } catch { throw new Error('待確認的上榜紀錄無法讀取。請保留本機存檔，重新整理後再試。'); }
  }
  function writePending(pending) {
    try {
      const current = readPending();
      if (current && (current.owner !== pending.owner || JSON.stringify(current.body) !== JSON.stringify(pending.body))) throw new Error();
      const value = JSON.stringify(pending); storage.setItem(RANKING_PENDING_KEY, value);
      if (storage.getItem(RANKING_PENDING_KEY) !== value) throw new Error();
    } catch { throw new Error('無法保存待確認成績，這次尚未送出。請釋放瀏覽器儲存空間後重試。'); }
  }
  function clearPending(owner, runId) {
    const pending = readPending();
    if (pending?.owner === owner && pending.body.runId === runId) {
      storage.removeItem(RANKING_PENDING_KEY);
      if (storage.getItem(RANKING_PENDING_KEY)) throw new Error('成績已送達，但待確認紀錄尚未清除；重試可核對同一筆結果。');
    }
  }
  async function api(path, { token, body, method = body ? 'POST' : 'GET' } = {}) {
    if (token) sameIdentity(token);
    let response;
    try {
      response = await fetcher(path, { method, credentials: 'same-origin', cache: 'no-store',
        headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(timeoutMs) });
    } catch { throw new Error('暫時無法連上排行榜。個人紀錄與獎勵已保留，可稍後再試。'); }
    if (token) sameIdentity(token);
    const data = await response.json().catch(() => null);
    if (token) sameIdentity(token);
    if (!response.ok) throw Object.assign(new Error(data?.message || '排行榜暫時無法回覆，請稍後再試。'), { status: response.status, code: data?.error });
    if (!data) throw new Error('尚未取得完整回覆，請重試確認。');
    return data;
  }
  async function pendingFor(token) {
    const pending = readPending();
    if (!pending) return null;
    if (!token || pending.owner !== await hash(token)) throw new Error('待確認成績屬於原本的匿名身分，請回到原瀏覽器紀錄後重試。');
    sameIdentity(token); return pending;
  }
  async function publish(body) {
    const token = credential(), owner = await hash(token); sameIdentity(token);
    let pending = await pendingFor(token);
    if (body && !validBody(body)) throw new Error('這場缺少完整的行駛紀錄，請重新完成賽事後上傳。');
    if (pending && body && JSON.stringify(pending.body) !== JSON.stringify(body)) throw new Error('上一場成績尚未確認，請先按「重試上傳」。');
    if (!pending) {
      if (!body) throw new Error('目前沒有待確認的上榜成績。');
      pending = { version: 1, owner, body: copy(body) }; writePending(pending);
    }
    try {
      if (readyToken !== token) { await api('/api/player', { body: { token } }); sameIdentity(token); readyToken = token; }
      const committed = await pendingFor(token);
      if (!committed || JSON.stringify(committed.body) !== JSON.stringify(pending.body)) throw new Error('待確認成績已在其他分頁變更，請重新查詢後重試。');
      const result = await api('/api/gta/leaderboard', { token, body: pending.body });
      const entry = result.entry, raceId = pending.body.proof.raceId;
      if (result.recorded !== true || typeof result.duplicate !== 'boolean' || typeof result.improved !== 'boolean'
        || !validEntry(entry, raceId, true) || entry.runId.toLowerCase() !== pending.body.runId.toLowerCase()
        || entry.elapsedMs !== Math.round(pending.body.proof.samples.at(-1)[0] / 120 * 1000)
        || entry.vehicleId !== pending.body.proof.vehicleId || !driverCode(entry.driverCode)) throw new Error('上榜收據尚未核對完成，請重試同一筆成績。');
      if (result.weekly != null && (!validWeekId(result.weekly.weekId) || typeof result.weekly.improved !== 'boolean'
        || !validEntry(result.weekly.entry, raceId, true) || result.weekly.entry.runId.toLowerCase() !== entry.runId.toLowerCase()
        || result.weekly.entry.elapsedMs !== entry.elapsedMs || result.weekly.entry.vehicleId !== entry.vehicleId
        || result.weekly.entry.driverCode !== entry.driverCode)) throw new Error('每週成績收據尚未核對完成，請重試同一筆成績。');
      invalidate(raceId);clearPending(owner, pending.body.runId); return result;
    } catch (error) {
      if ([400, 409, 413, 422].includes(error.status)) clearPending(owner, pending.body.runId);
      if (error.status === 401) readyToken = null;
      throw error;
    }
  }
  function send(body) {
    const canonical = body ? { ...body, runId: typeof body.runId === 'string' ? body.runId.toLowerCase() : body.runId } : null;
    const signature = canonical ? JSON.stringify(canonical) : null;
    if (sending) return !canonical || signature === sendingBody ? sending : Promise.reject(new Error('另一場成績正在確認，請稍後再送出。'));
    sendingBody = signature;
    sending = publish(canonical).finally(() => { sending = null; sendingBody = null; }); return sending;
  }
  return {
    hasIdentity: () => Boolean(readToken()),
    async pending() {
      const item = await pendingFor(readToken());
      return item ? { runId: item.body.runId, raceId: item.body.proof.raceId,
        elapsedMs: Math.round(item.body.proof.samples.at(-1)[0] / 120 * 1000) } : null;
    },
    async calendar({ refresh = false } = {}) {
      if (!refresh && calendarCache && now() - calendarCache.at < 60000) return copy(calendarCache.data);
      if (calendarRequest) return calendarRequest;
      calendarRequest = (async () => {
        const data = await api('/api/gta/calendar');
        const expected = Number.isSafeInteger(data.serverNow) ? racingCalendar(data.serverNow) : null;
        const challenge = expected && dailyChallenge(expected.dayId);
        if (data.version !== 1 || !expected || Object.entries(expected).some(([key,value]) => data[key] !== value)
          || !data.dailyChallenge || Object.entries(challenge).some(([key,value]) => data.dailyChallenge[key] !== value)) throw new Error('賽季時間尚未核對完成，暫時使用裝置時間。');
        const safe = { version: 1, serverNow: data.serverNow, receivedAt: now(), ...expected, dailyChallenge: challenge };
        calendarCache = { at: safe.receivedAt, data: safe }; return copy(safe);
      })().finally(() => { calendarRequest = null; });
      return calendarRequest;
    },
    async board(raceId, { refresh = false, ...options } = {}) {
      if (!races.has(raceId)) throw new Error('找不到這條賽道。');
      const filter = periodFilter(options), key = raceId + filter.key;
      const previous = cache.get(key);
      if (!refresh && previous && now() - previous.at < 60000) return previous.data;
      const revision = revisions.get(key) || 0;
      if (inflight.get(key)?.revision === revision) return inflight.get(key).promise;
      const promise = (async () => {
        const data = await api('/api/gta/leaderboard?raceId=' + encodeURIComponent(raceId) + (filter.query ? '&' + filter.query : ''));
        if (data.version !== 1 || data.raceId !== raceId || !validPeriod(data, filter) || !Number.isSafeInteger(data.totalDrivers) || data.totalDrivers < 0
          || !Array.isArray(data.entries) || data.entries.length > 20
          || data.entries.some((row, i) => !validEntry(row, raceId) || !driverCode(row.driverCode)
            || i > 0 && row.elapsedMs < data.entries[i - 1].elapsedMs)) throw new Error('排行榜回覆不完整，請重新整理榜單。');
        const safe = { version: 1, raceId, ...(filter.key ? { scope: 'weekly', weekId: filter.weekId } : {}), totalDrivers: data.totalDrivers, entries: data.entries.map(({ driverCode, elapsedMs, position, vehicleId }) => ({ driverCode, elapsedMs, position, vehicleId })) };
        if ((revisions.get(key) || 0) === revision) cache.set(key, { at: now(), data: safe }); return safe;
      })().finally(() => { if (inflight.get(key)?.promise === promise) inflight.delete(key); });
      inflight.set(key, { revision, promise }); return promise;
    },
    async mine(options = {}) {
      const filter = periodFilter(options), empty = { version: 1, ...(filter.key ? { scope: 'weekly', weekId: filter.weekId } : {}), driverCode: null, entries: [] };
      const token = readToken(); if (!token) return empty;
      let data;
      try { data = await api('/api/gta/leaderboard/mine' + (filter.query ? '?' + filter.query : ''), { token }); }
      catch (error) { if (error.status === 401) return empty; throw error; }
      if (data.version !== 1 || !validPeriod(data, filter) || !(data.driverCode === null || driverCode(data.driverCode)) || !Array.isArray(data.entries)
        || data.entries.length > races.size || new Set(data.entries.map(row => row.raceId)).size !== data.entries.length
        || data.entries.some(row => !validEntry(row, row.raceId, true))) throw new Error('個人上榜紀錄尚未取得完整回覆。');
      return data;
    },
    submit: body => send(body), retry: () => send(null),
    async withdraw(raceId, options = {}) {
      if (sending) throw new Error('請等待目前的上榜操作完成。');
      const filter = periodFilter(options);
      const token = readToken(); if (!token || !races.has(raceId)) throw new Error('請使用原本上榜的瀏覽器撤下紀錄。');
      const pending = await pendingFor(token);
      const data = await api('/api/gta/leaderboard?raceId=' + encodeURIComponent(raceId) + (filter.query ? '&' + filter.query : ''), { method: 'DELETE', token });
      if (data.raceId !== raceId || !validPeriod(data, filter) || typeof data.removed !== 'boolean') throw new Error('撤榜狀態尚未確認，請重新查詢。');
      invalidate(raceId);
      if (pending?.body.proof.raceId === raceId) clearPending(pending.owner, pending.body.runId);
      return data;
    },
  };
}
