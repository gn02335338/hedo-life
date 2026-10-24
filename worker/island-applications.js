import { ApiError, tokenHash } from './http.js';

const DAY = 86400000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const ISLAND_DISTRICTS = Object.freeze(['lobby', 'lab', 'meeting', 'hr', 'finance', 'cafe', 'plaza', 'court', 'harbor']);
export const ISLAND_OUTFITS = Object.freeze(['teal', 'amber', 'coral', 'lavender', 'navy', 'cream']);
export const ISLAND_LIMITS = Object.freeze({ nickname: 16, greeting: 80, introduction: 240, reason: 500, activePerPlayer: 1, submissionsPerDay: 3, residentsPerDistrict: 3, retentionDays: 90 });
const STATUSES = ['pending', 'approved', 'rejected', 'withdrawn'];
const invalid = () => new ApiError(400, 'invalid_island_application', '請確認申請欄位長度，使用純文字，並移除連結、聯絡方式或隱藏字元。');
const conflict = () => new ApiError(409, 'island_application_conflict', '申請狀態已改變，請重新載入後再操作。');
const missing = () => new ApiError(404, 'island_application_not_found', '找不到這份申請。');

function keys(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key))) throw invalid();
}
function plainText(value, min, max) {
  if (typeof value !== 'string' || value.length > max * 4) throw invalid();
  const text = value.normalize('NFKC').trim(), length = [...text].length;
  if (length < min || length > max || /[\u0000-\u001f\u007f-\u009f\u061c\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff<>]/u.test(value) || /[<>]/u.test(text)) throw invalid();
  // Applications are short in-world profiles, not a channel for private contact details.
  if (/(?:[a-z][a-z0-9+.-]*:\/\/|https?:|ftp:|www\.|mailto:|tel:|@|(?:[a-z0-9-]+\.)+[a-z]{2,63}\b)/iu.test(text)
    || /(?:\+?\d[\d ().-]{6,}\d)/u.test(text)
    || /\b(?:line|telegram|wechat|discord|instagram|ig|facebook|fb|whatsapp)\s*(?:id|帳號|账号)?\s*[:=@]\s*\S+/iu.test(text)
    || /(?:電話|手机|手機|電郵|邮箱|信箱|聯絡方式|联系方式|帳號|账号)\s*[:=]\s*\S+/u.test(text)
    || /[縣市].{0,12}[區鄉鎮].{0,16}[路街].{0,10}\d+號/u.test(text)) throw invalid();
  return text;
}
export function validateIslandApplication(body) {
  keys(body, ['version', 'submissionId', 'nickname', 'districtId', 'outfit', 'greeting', 'introduction', 'reason', 'consent']);
  if (body.version !== 1 || body.consent !== true || typeof body.submissionId !== 'string' || !UUID.test(body.submissionId)
    || !ISLAND_DISTRICTS.includes(body.districtId) || !ISLAND_OUTFITS.includes(body.outfit)) throw invalid();
  return { version: 1, submissionId: body.submissionId.toLowerCase(), nickname: plainText(body.nickname, 2, 16), districtId: body.districtId,
    outfit: body.outfit, greeting: plainText(body.greeting, 2, 80), introduction: plainText(body.introduction, 10, 240), reason: plainText(body.reason, 10, 500), consent: true };
}
function validateReview(body) {
  keys(body, ['decision', 'note']);
  if (!['approve', 'reject', 'revoke'].includes(body.decision)) throw invalid();
  return { decision: body.decision, note: plainText(body.note ?? '', body.decision === 'revoke' ? 1 : 0, 240) };
}
function receipt(row) {
  return { id: row.id, status: row.status, nickname: row.nickname, districtId: row.district_id, outfit: row.outfit,
    greeting: row.greeting, introduction: row.introduction, reason: row.reason, reviewNote: row.review_note || '', createdAt: row.created_at, reviewedAt: row.reviewed_at || null };
}
function validId(id) { if (typeof id !== 'string' || !UUID.test(id)) throw invalid(); return id.toLowerCase(); }
function configured(env) {
  try {
    const c = JSON.parse(env.ADMIN_PASSWORD_VERIFIER);
    return c?.v === 1 && c.iterations === 100000 && typeof c.salt === 'string' && /^[a-f0-9]{32}$/.test(c.salt) && typeof c.hash === 'string' && /^[a-f0-9]{64}$/.test(c.hash);
  } catch { return false; }
}
function encodeCursor(row, status) { return btoa(JSON.stringify([status, row.created_at, row.id])).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, ''); }
function decodeCursor(value, status) {
  if (!value) return null;
  try {
    if (value.length > 256 || !/^[A-Za-z0-9_-]+$/.test(value)) throw Error();
    const row = JSON.parse(atob(value.replaceAll('-', '+').replaceAll('_', '/')));
    if (!Array.isArray(row) || row.length !== 3 || row[0] !== status || typeof row[1] !== 'string' || new Date(row[1]).toISOString() !== row[1] || !UUID.test(row[2]) || row[2] !== row[2].toLowerCase()) throw Error();
    return { createdAt: row[1], id: row[2] };
  } catch { throw new ApiError(400, 'invalid_island_cursor', '申請列表頁碼無效，請重新載入。'); }
}

export class IslandApplicationStore {
  constructor(sql, storage, env, { now = () => Date.now() } = {}) {
    this.sql = sql; this.storage = storage; this.env = env; this.now = now;
    sql.exec(`
      CREATE TABLE IF NOT EXISTS island_applications (
        id TEXT PRIMARY KEY, player_id TEXT NOT NULL REFERENCES players(id), payload_hash TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected','withdrawn')),
        nickname TEXT NOT NULL, district_id TEXT NOT NULL, outfit TEXT NOT NULL, greeting TEXT NOT NULL,
        introduction TEXT NOT NULL, reason TEXT NOT NULL, review_note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL, reviewed_at TEXT, terminal_at TEXT, resident_id TEXT UNIQUE, slot INTEGER,
        CHECK((status = 'approved' AND resident_id IS NOT NULL AND slot BETWEEN 0 AND 2) OR (status != 'approved' AND slot IS NULL))
      );
      CREATE INDEX IF NOT EXISTS island_applications_owner ON island_applications(player_id, created_at);
      CREATE INDEX IF NOT EXISTS island_applications_queue ON island_applications(status, created_at, id);
      CREATE UNIQUE INDEX IF NOT EXISTS island_applications_active ON island_applications(player_id) WHERE status IN ('pending','approved');
      CREATE UNIQUE INDEX IF NOT EXISTS island_applications_slot ON island_applications(district_id, slot) WHERE status = 'approved';
      CREATE TABLE IF NOT EXISTS island_application_limits (day TEXT NOT NULL, bucket TEXT NOT NULL, count INTEGER NOT NULL, PRIMARY KEY(day,bucket));
      CREATE TABLE IF NOT EXISTS island_application_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    `);
  }
  config() { this.cleanup(); return { enabled: configured(this.env), limits: { ...ISLAND_LIMITS } }; }
  publicSummary() {
    // A scalar aggregate only: never select application records for this public route.
    return { pending: this.sql.exec("SELECT COUNT(*) AS pending FROM island_applications WHERE status = 'pending'").one().pending };
  }
  cleanup(now = this.now()) {
    const cutoff = new Date(now - ISLAND_LIMITS.retentionDays * DAY).toISOString(), day = new Date(now - 2 * DAY).toISOString().slice(0, 10);
    this.sql.exec("DELETE FROM island_applications WHERE status IN ('rejected','withdrawn') AND terminal_at <= ?", cutoff);
    this.sql.exec('DELETE FROM island_application_limits WHERE day < ?', day);
    this.sql.exec("DELETE FROM island_application_meta WHERE key LIKE 'salt:%' AND substr(key, 6) < ?", day);
  }
  retry(row, playerId, hash) {
    if (row.player_id !== playerId || row.payload_hash !== hash) throw new ApiError(409, 'island_submission_conflict', '這個申請編號已使用，請保留原本的申請內容。');
    return { application: receipt(row) };
  }
  async submit(playerId, payload, ip = '') {
    const hash = await tokenHash(JSON.stringify(payload)), now = this.now();
    this.cleanup(now);
    const old = this.sql.exec('SELECT * FROM island_applications WHERE id = ?', payload.submissionId).toArray()[0];
    if (old) return this.retry(old, playerId, hash);
    if (!configured(this.env)) throw new ApiError(503, 'island_applications_disabled', '上島申請暫時關閉，請稍後再試。');
    const day = new Date(now).toISOString().slice(0, 10); let salt;
    this.storage.transactionSync(() => {
      this.sql.exec('INSERT OR IGNORE INTO island_application_meta (key,value) VALUES (?,?)', `salt:${day}`, crypto.randomUUID());
      salt = this.sql.exec('SELECT value FROM island_application_meta WHERE key = ?', `salt:${day}`).one().value;
    });
    const network = await tokenHash(`${salt}:${ip || 'unknown'}`);
    return this.storage.transactionSync(() => {
      const existing = this.sql.exec('SELECT * FROM island_applications WHERE id = ?', payload.submissionId).toArray()[0];
      if (existing) return this.retry(existing, playerId, hash);
      if (this.sql.exec("SELECT id FROM island_applications WHERE player_id = ? AND status IN ('pending','approved')", playerId).toArray().length) throw new ApiError(409, 'island_active_application', '你已有待審核或已上島的申請，請先撤回再重新申請。');
      const limits = [[`player:${playerId}`, 3], [`network:${network}`, 10], ['global', 100]];
      for (const [bucket, limit] of limits) {
        const count = this.sql.exec('SELECT count FROM island_application_limits WHERE day = ? AND bucket = ?', day, bucket).toArray()[0]?.count || 0;
        if (count >= limit) throw new ApiError(429, 'island_daily_limit', '今天的上島申請已達上限，請明天再試。');
      }
      if (this.sql.exec("SELECT COUNT(*) AS n FROM island_applications WHERE status = 'pending'").one().n >= 200) throw new ApiError(503, 'island_queue_full', '申請箱正在整理，請稍後再試。');
      this.sql.exec("INSERT INTO island_applications (id,player_id,payload_hash,status,nickname,district_id,outfit,greeting,introduction,reason,created_at) VALUES (?,?,?,'pending',?,?,?,?,?,?,?)",
        payload.submissionId, playerId, hash, payload.nickname, payload.districtId, payload.outfit, payload.greeting, payload.introduction, payload.reason, new Date(now).toISOString());
      for (const [bucket] of limits) this.sql.exec('INSERT INTO island_application_limits (day,bucket,count) VALUES (?,?,1) ON CONFLICT(day,bucket) DO UPDATE SET count=count+1', day, bucket);
      return { application: receipt(this.sql.exec('SELECT * FROM island_applications WHERE id = ?', payload.submissionId).one()) };
    });
  }
  mine(playerId) {
    this.cleanup();
    return { applications: this.sql.exec('SELECT * FROM island_applications WHERE player_id = ? ORDER BY created_at DESC,id DESC', playerId).toArray().map(receipt) };
  }
  withdraw(playerId, id) {
    id = validId(id); this.cleanup();
    return this.storage.transactionSync(() => {
      const row = this.sql.exec('SELECT * FROM island_applications WHERE id = ? AND player_id = ?', id, playerId).toArray()[0];
      if (!row) throw missing();
      if (row.status === 'withdrawn') return { application: receipt(row) };
      if (!['pending', 'approved'].includes(row.status)) throw conflict();
      this.sql.exec("UPDATE island_applications SET status='withdrawn',slot=NULL,terminal_at=? WHERE id=?", new Date(this.now()).toISOString(), id);
      return { application: receipt(this.sql.exec('SELECT * FROM island_applications WHERE id = ?', id).one()) };
    });
  }
  residents() {
    this.cleanup();
    // Explicit projection is the only public application read path.
    const residents = this.sql.exec("SELECT resident_id,nickname,district_id,outfit,greeting,introduction,slot FROM island_applications WHERE status = 'approved' ORDER BY district_id,slot").toArray()
      .map(row => ({ id: row.resident_id, nickname: row.nickname, districtId: row.district_id, outfit: row.outfit, greeting: row.greeting, introduction: row.introduction, slot: row.slot }));
    return { version: 1, residents };
  }
  list(params) {
    if ([...params.keys()].some(key => !['status', 'after'].includes(key)) || params.getAll('status').length > 1 || params.getAll('after').length > 1) throw invalid();
    const status = params.get('status') || 'pending'; if (!STATUSES.includes(status)) throw invalid();
    const cursor = decodeCursor(params.get('after'), status); this.cleanup();
    const counts = Object.fromEntries(STATUSES.map(status => [status, 0]));
    for (const row of this.sql.exec('SELECT status,COUNT(*) AS n FROM island_applications GROUP BY status').toArray()) counts[row.status] = row.n;
    const rows = cursor
      ? this.sql.exec('SELECT * FROM island_applications WHERE status=? AND (created_at>? OR (created_at=? AND id>?)) ORDER BY created_at,id LIMIT 101', status, cursor.createdAt, cursor.createdAt, cursor.id).toArray()
      : this.sql.exec('SELECT * FROM island_applications WHERE status=? ORDER BY created_at,id LIMIT 101', status).toArray();
    const more = rows.length > 100, items = rows.slice(0, 100);
    return { items: items.map(receipt), nextCursor: more ? encodeCursor(items.at(-1), status) : null, counts, total: counts[status], more };
  }
  review(id, body) {
    id = validId(id); const { decision, note } = validateReview(body); this.cleanup();
    return this.storage.transactionSync(() => {
      const row = this.sql.exec('SELECT * FROM island_applications WHERE id = ?', id).toArray()[0];
      if (!row) throw missing();
      if (row.status !== (decision === 'revoke' ? 'approved' : 'pending')) throw conflict();
      const now = new Date(this.now()).toISOString();
      if (decision === 'approve') {
        const used = new Set(this.sql.exec("SELECT slot FROM island_applications WHERE district_id=? AND status='approved'", row.district_id).toArray().map(row => row.slot));
        const slot = [0, 1, 2].find(slot => !used.has(slot));
        if (slot === undefined) throw new ApiError(409, 'island_district_full', '這一區的島民名額已滿，請稍後再審核。');
        this.sql.exec("UPDATE island_applications SET status='approved',review_note=?,reviewed_at=?,resident_id=?,slot=? WHERE id=?", note, now, crypto.randomUUID(), slot, id);
      } else this.sql.exec("UPDATE island_applications SET status='rejected',review_note=?,reviewed_at=?,terminal_at=?,slot=NULL WHERE id=?", note, now, now, id);
      return { application: receipt(this.sql.exec('SELECT * FROM island_applications WHERE id = ?', id).one()) };
    });
  }
}
