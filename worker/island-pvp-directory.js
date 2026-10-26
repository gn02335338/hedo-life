import { ApiError, json, readJson, tokenHash } from './http.js';

export const PVP_ROOM_LIFETIME_MS = 10 * 60 * 1000;
export const PVP_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const PVP_CODE_PATTERN = /^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{8}$/;
const ROOT = '/api/island/pvp/rooms';
const socketPattern = /^\/api\/island\/pvp\/rooms\/([0-9ABCDEFGHJKMNPQRSTVWXYZ]{8})\/socket$/;
const joinPattern = /^\/api\/island\/pvp\/rooms\/([0-9ABCDEFGHJKMNPQRSTVWXYZ]{8})\/join$/;

export function assertPvpOrigin(request) {
  if (request.headers.get('Origin') !== new URL(request.url).origin || request.headers.get('Sec-Fetch-Site') === 'cross-site') {
    throw new ApiError(403, 'cross_origin', '請從移動島內開啟玩家對戰。');
  }
}
export function validatePvpNickname(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => key !== 'nickname')) {
    throw new ApiError(400, 'invalid_pvp_profile', '對戰資料只能包含島上暱稱。');
  }
  if (body.nickname === undefined || body.nickname === '') return null;
  if (typeof body.nickname !== 'string') throw new ApiError(400, 'invalid_pvp_nickname', '暱稱請填一到十二個字。');
  const nickname = body.nickname.normalize('NFC').trim();
  if (!nickname || [...nickname].length > 12 || /[\u0000-\u001f\u007f-\u009f<>\u2028\u2029]/u.test(nickname)) {
    throw new ApiError(400, 'invalid_pvp_nickname', '暱稱請填一到十二個字，不使用控制符號或角括號。');
  }
  return nickname;
}
export function randomPvpRoomCode(cryptoApi = crypto) {
  return [...cryptoApi.getRandomValues(new Uint8Array(8))].map(value => PVP_CODE_ALPHABET[value & 31]).join('');
}
export function isPvpSocketPath(path) { return socketPattern.test(path); }
function validatePvpSocket(request) {
  assertPvpOrigin(request);
  const url = new URL(request.url), match = socketPattern.exec(url.pathname);
  if (!match || url.search || request.method !== 'GET' || request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
    throw new ApiError(400, 'invalid_pvp_socket', '請透過房間內的即時連線加入。');
  }
  // A public room code identifies the destination. Seat tickets only travel in
  // the first WebSocket frame, never in request URLs or protocol headers.
  if (request.headers.has('Sec-WebSocket-Protocol')) throw new ApiError(400, 'invalid_pvp_socket', '連線格式不正確。');
  return match[1];
}
export async function proxyPvpSocket(request, env) {
  const roomCode = validatePvpSocket(request);
  if (!env.ISLAND_PVP) throw new ApiError(503, 'pvp_unavailable', '玩家對戰暫時休息中，請稍後重試。');
  return env.ISLAND_PVP.get(env.ISLAND_PVP.idFromName(`island-pvp-v1:${roomCode}`)).fetch(request);
}

function consumePvpRate(archive, limits, now, code, message) {
  const sql = archive.sql;
  sql.exec(`CREATE TABLE IF NOT EXISTS island_pvp_room_limits (
    rate_key TEXT PRIMARY KEY, window_start INTEGER NOT NULL, count INTEGER NOT NULL
  )`);
  archive.ctx.storage.transactionSync(() => {
    sql.exec('DELETE FROM island_pvp_room_limits WHERE window_start <= ?', now - PVP_ROOM_LIFETIME_MS);
    for (const [key, limit] of limits) {
      const row = sql.exec('SELECT window_start, count FROM island_pvp_room_limits WHERE rate_key = ?', key).toArray()[0];
      if (row && row.count >= limit) throw new ApiError(429, code, message);
      sql.exec(`INSERT INTO island_pvp_room_limits (rate_key, window_start, count) VALUES (?, ?, 1)
        ON CONFLICT(rate_key) DO UPDATE SET count = count + 1`, key, now);
    }
  });
}
export async function handlePvpArchive(request, archive) {
  assertPvpOrigin(request);
  const url = new URL(request.url), path = url.pathname, join = joinPattern.exec(path);
  if (url.search) throw new ApiError(400, 'invalid_pvp_query', '對戰端點不接受額外查詢欄位。');
  const env = archive.feedbackEnv;
  if (isPvpSocketPath(path)) {
    // Validate before touching the shared rate store or resolving any room DO.
    // Only the HTTP upgrade passes through the archive; all frames belong to
    // the independently accepted room socket. Unknown codes share this budget.
    validatePvpSocket(request);
    const ipHash = await tokenHash(`pvp-ip:${request.headers.get('CF-Connecting-IP') || 'unknown'}`);
    consumePvpRate(archive, [[`ws-ip:${ipHash}`, 240]], Date.now(), 'pvp_connection_rate', '這個網路剛剛建立了較多連線，請稍後重新加入。');
    return proxyPvpSocket(request, env);
  }
  if (request.method !== 'POST') throw new ApiError(405, 'method_not_allowed', '請從移動島建立或加入房間。');
  if (path !== ROOT && !join) throw new ApiError(404, 'pvp_not_found', '找不到這個對戰端點。');
  const playerId = await archive.authenticate(request);
  const nickname = validatePvpNickname(await readJson(request, { maxBytes: 1024 }));
  if (!env.ISLAND_PVP) throw new ApiError(503, 'pvp_unavailable', '玩家對戰暫時休息中，請稍後重試。');
  if (path === ROOT) {
    const ipHash = await tokenHash(`pvp-ip:${request.headers.get('CF-Connecting-IP') || 'unknown'}`);
    consumePvpRate(archive, [[`player:${playerId}`, 6], [`ip:${ipHash}`, 40]], Date.now(), 'pvp_room_rate', '剛剛建立了較多房間，先到現有房間玩一場吧。');
    for (let attempt = 0; attempt < 3; attempt++) {
      const roomCode = randomPvpRoomCode();
      const response = await env.ISLAND_PVP.get(env.ISLAND_PVP.idFromName(`island-pvp-v1:${roomCode}`)).fetch(new Request('https://island-pvp.internal/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playerId, nickname, roomCode }),
      }));
      if (response.status === 409) continue;
      return response;
    }
    throw new ApiError(503, 'pvp_room_busy', '碼頭正在安排房間，請稍後再試。');
  }
  return env.ISLAND_PVP.get(env.ISLAND_PVP.idFromName(`island-pvp-v1:${join[1]}`)).fetch(new Request('https://island-pvp.internal/join', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playerId, nickname }),
  }));
}
