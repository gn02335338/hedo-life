export const MAX_BODY_BYTES = 64 * 1024;
export const MAX_ACTIONS = 160;

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function json(data, status = 200, extraHeaders = {}) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders,
    },
  });
}

export function errorResponse(error) {
  if (error instanceof ApiError) {
    return json({ error: error.code, message: error.message }, error.status,
      error.status === 429 ? { 'Retry-After': '10' } : {});
  }
  // Do not include request bodies, tokens, or internal errors in responses/logs.
  return json({ error: 'unavailable', message: '雲端史冊暫時無法使用，請稍後重試。' }, 503);
}

export function assertSameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (origin !== null && origin !== new URL(request.url).origin) {
    throw new ApiError(403, 'cross_origin', '請從遊戲網站內送出。');
  }
  if (request.headers.get('Sec-Fetch-Site') === 'cross-site') {
    throw new ApiError(403, 'cross_origin', '請從遊戲網站內送出。');
  }
}

export function validToken(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/i.test(value)) {
    throw new ApiError(401, 'invalid_token', '匿名收藏識別碼無效。');
  }
  return value.toLowerCase();
}

export function bearerToken(request) {
  const match = /^Bearer ([a-f0-9]{64})$/i.exec(request.headers.get('Authorization') || '');
  return validToken(match?.[1]);
}

export async function tokenHash(token) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function readJson(request) {
  const type = request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase();
  if (type !== 'application/json') throw new ApiError(415, 'json_required', '請使用 JSON 格式。');
  const declaredSize = Number(request.headers.get('Content-Length') || 0);
  if (declaredSize > MAX_BODY_BYTES) throw new ApiError(413, 'body_too_large', '送出的資料太大。');
  if (!request.body) throw new ApiError(400, 'invalid_json', '缺少 JSON 資料。');
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new ApiError(413, 'body_too_large', '送出的資料太大。');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try {
    const body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch {
    throw new ApiError(400, 'invalid_json', 'JSON 資料無法讀取。');
  }
}

export function validateCompletion(body, roleMap) {
  if (typeof body.runId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.runId)) {
    throw new ApiError(400, 'invalid_run_id', '遊戲紀錄識別碼無效。');
  }
  if (typeof body.roleId !== 'string' || !Object.hasOwn(roleMap, body.roleId)) {
    throw new ApiError(400, 'invalid_role', '職業無效。');
  }
  if (typeof body.seed !== 'string' || body.seed.length < 1 || body.seed.length > 32) {
    throw new ApiError(400, 'invalid_seed', '遊戲種子無效。');
  }
  const actionLimit = /^e(?:13|14|15|16)-/.test(body.seed) ? 300 : MAX_ACTIONS;
  if (!Array.isArray(body.actions) || body.actions.length < 1 || body.actions.length > actionLimit) {
    throw new ApiError(400, 'invalid_actions', '遊戲操作紀錄無效。');
  }
  for (const action of body.actions) {
    if (!action || typeof action !== 'object' || Array.isArray(action)) {
      throw new ApiError(400, 'invalid_actions', '遊戲操作紀錄無效。');
    }
    if (action.type === 'exit' || (action.type === 'break' && /^e(?:[2-9]|10|11|12|13|14|15|16)-/.test(body.seed)) || (action.type === 'career' && /^e(?:10|11|12|13|14|15|16)-/.test(body.seed)) || (action.type === 'rage' && (body.seed.startsWith('e13-') || (/^e(?:14|15|16)-/.test(body.seed) && ['event','result'].includes(action.phase) && typeof action.eventId === 'string' && action.eventId.length > 0 && action.eventId.length <= 100)))) continue;
    if (action.type !== 'choice' || typeof action.eventId !== 'string' || action.eventId.length > 100 ||
        !Number.isInteger(action.index) || action.index < 0 || action.index > 12) {
      throw new ApiError(400, 'invalid_actions', '遊戲操作紀錄無效。');
    }
  }
  return { runId: body.runId.toLowerCase(), roleId: body.roleId, seed: body.seed, actions: body.actions };
}

// Modest per-player guard. It is intentionally not an anti-cheat system.
// It stores only token hashes in memory and resets if this object restarts.
export class RateGuard {
  constructor() { this.windows = new Map(); }
  check(key, now = Date.now()) {
    let window = this.windows.get(key);
    if (!window || now >= window.until) window = { until: now + 10_000, count: 0 };
    window.count += 1;
    this.windows.set(key, window);
    if (this.windows.size > 1_000) {
      for (const [id, value] of this.windows) if (now >= value.until) this.windows.delete(id);
      if (this.windows.size > 10_000) this.windows.delete(this.windows.keys().next().value);
    }
    if (window.count > 10) throw new ApiError(429, 'rate_limited', '翻頁太快了，請稍等幾秒。');
  }
}
