import { ApiError, tokenHash } from './http.js';
import { FEEDBACK_REPOSITORY, UUID, renderIssue } from './feedback.js';

const DAY = 86400000;
const PER_PLAYER = 3, PER_NETWORK = 5, GLOBAL_LIMIT = 30, MAX_PENDING = 90;
const LEASE_MS = 15 * 60000;
const snapshot = row => ({
  submissionId: row.id,
  status: row.status,
  issueUrl: row.issue_url || null,
  ...(row.status === 'failed' ? { message: '這份投稿已超過保留期限，無法確認是否建立成功。請先查看 GitHub，再決定是否重新投稿。' } : {}),
});

export class FeedbackStore {
  constructor(sql, storage) {
    this.sql = sql;
    this.storage = storage;
    sql.exec(`
      CREATE TABLE IF NOT EXISTS feedback_submissions (
        id TEXT PRIMARY KEY,
        player_id TEXT NOT NULL REFERENCES players(id),
        payload TEXT NOT NULL,
        payload_hash TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        issue_url TEXT,
        issue_number INTEGER,
        lease_id TEXT,
        lease_until INTEGER,
        attempts INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS feedback_owner ON feedback_submissions(player_id, created_at);
      CREATE INDEX IF NOT EXISTS feedback_queue ON feedback_submissions(status, created_at);
      CREATE TABLE IF NOT EXISTS feedback_limits (
        day TEXT NOT NULL,
        bucket TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (day, bucket)
      );
      CREATE TABLE IF NOT EXISTS feedback_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    `);
  }

  config(now = Date.now()) {
    this.cleanup(now);
    const heartbeat = Number(this.sql.exec("SELECT value FROM feedback_meta WHERE key = 'heartbeat'").toArray()[0]?.value || 0);
    const enabled = heartbeat > now - DAY;
    return { enabled, public: true, repository: FEEDBACK_REPOSITORY, maxPerDay: PER_PLAYER, publishing: 'queue',
      message: enabled ? '投稿會由背景流程建立為公開 Issue，可能需要等候。' : '自動投稿暫時休息；草稿可以先留著，也能自行到 GitHub 開 Issue。' };
  }

  cleanup(now) {
    const day = new Date(now - 2 * DAY).toISOString().slice(0, 10);
    this.sql.exec('DELETE FROM feedback_limits WHERE day < ?', day);
    this.sql.exec("DELETE FROM feedback_meta WHERE key LIKE 'salt:%' AND substr(key, 6) < ?", day);
    this.sql.exec("UPDATE feedback_submissions SET payload = '{}', status = 'failed', lease_id = NULL, lease_until = NULL WHERE status IN ('queued', 'processing') AND created_at <= ?", new Date(now - 30 * DAY).toISOString());
  }

  nextCleanup(now = Date.now()) {
    const oldest = this.sql.exec("SELECT MIN(created_at) AS at FROM feedback_submissions WHERE status IN ('queued', 'processing')").one().at;
    const bucketDay = this.sql.exec('SELECT MIN(day) AS day FROM feedback_limits').one().day;
    const saltDay = this.sql.exec("SELECT MIN(substr(key, 6)) AS day FROM feedback_meta WHERE key LIKE 'salt:%'").one().day;
    const deadlines = [oldest ? Date.parse(oldest) + 30 * DAY : Infinity,
      bucketDay ? Date.parse(`${bucketDay}T00:00:00Z`) + 3 * DAY : Infinity,
      saltDay ? Date.parse(`${saltDay}T00:00:00Z`) + 3 * DAY : Infinity];
    const next = Math.min(...deadlines);
    return Number.isFinite(next) ? Math.max(now + 1000, next) : null;
  }

  async submit(playerId, payload, ip = '', now = Date.now()) {
    const encoded = JSON.stringify(payload);
    const hash = await tokenHash(encoded);
    const previous = this.sql.exec('SELECT * FROM feedback_submissions WHERE id = ?', payload.submissionId).toArray()[0];
    if (previous) return this.retry(previous, playerId, hash);
    if (!this.config(now).enabled) throw new ApiError(503, 'feedback_paused', '自動投稿暫時休息，沒有送出內容。請先保留草稿，稍後再試。');
    const day = new Date(now).toISOString().slice(0, 10);
    // A random daily salt prevents cross-day linking or offline IP guessing
    // from the retained buckets. Raw addresses are never written to storage.
    let salt;
    this.storage.transactionSync(() => {
      this.sql.exec('INSERT OR IGNORE INTO feedback_meta (key, value) VALUES (?, ?)', `salt:${day}`, crypto.randomUUID());
      salt = this.sql.exec('SELECT value FROM feedback_meta WHERE key = ?', `salt:${day}`).one().value;
    });
    const network = await tokenHash(`${salt}:${ip || 'unknown'}`);
    let result;
    this.storage.transactionSync(() => {
      // Async hashing may have interleaved with another identical submission.
      const existing = this.sql.exec('SELECT * FROM feedback_submissions WHERE id = ?', payload.submissionId).toArray()[0];
      if (existing) { result = this.retry(existing, playerId, hash); return; }
      this.cleanup(now);
      const limits = [[`player:${playerId}`, PER_PLAYER], [`network:${network}`, PER_NETWORK], ['global', GLOBAL_LIMIT]];
      for (const [bucket, limit] of limits) {
        const n = this.sql.exec('SELECT count FROM feedback_limits WHERE day = ? AND bucket = ?', day, bucket).toArray()[0]?.count || 0;
        if (n >= limit) throw new ApiError(429, 'feedback_daily_limit', bucket === 'global' ? '今天的投稿箱已滿，請先保留草稿，明天再來。' : '今天先補到這裡，請保留草稿，明天再來投稿。');
      }
      if (this.sql.exec("SELECT COUNT(*) AS n FROM feedback_submissions WHERE status IN ('queued', 'processing')").one().n >= MAX_PENDING) throw new ApiError(503, 'feedback_queue_full', '投稿箱正在整理，請先保留草稿，稍後再來。');
      this.sql.exec("INSERT INTO feedback_submissions (id, player_id, payload, payload_hash, status, created_at) VALUES (?, ?, ?, ?, 'queued', ?)", payload.submissionId, playerId, encoded, hash, new Date(now).toISOString());
      for (const [bucket] of limits) this.sql.exec('INSERT INTO feedback_limits (day, bucket, count) VALUES (?, ?, 1) ON CONFLICT(day, bucket) DO UPDATE SET count = count + 1', day, bucket);
      result = { submissionId: payload.submissionId, status: 'queued', issueUrl: null };
    });
    return result;
  }

  retry(row, playerId, hash) {
    if (row.player_id !== playerId || row.payload_hash !== hash) throw new ApiError(409, 'feedback_id_conflict', '這個投稿編號已使用，請勿更換原本的投稿內容。');
    return snapshot(row);
  }

  status(playerId, id, now = Date.now()) {
    this.cleanup(now);
    if (!UUID.test(id)) throw new ApiError(404, 'feedback_not_found', '找不到這份投稿。');
    const row = this.sql.exec('SELECT * FROM feedback_submissions WHERE id = ? AND player_id = ?', id.toLowerCase(), playerId).toArray()[0];
    if (!row) throw new ApiError(404, 'feedback_not_found', '找不到這份投稿。');
    return snapshot(row);
  }

  claim(now = Date.now()) {
    const items = [];
    this.storage.transactionSync(() => {
      this.cleanup(now);
      this.sql.exec("INSERT INTO feedback_meta (key, value) VALUES ('heartbeat', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", String(now));
      const rows = this.sql.exec("SELECT * FROM feedback_submissions WHERE status = 'queued' OR (status = 'processing' AND lease_until <= ?) ORDER BY created_at, id LIMIT 3", now).toArray();
      for (const row of rows) {
        const leaseId = crypto.randomUUID();
        this.sql.exec("UPDATE feedback_submissions SET status = 'processing', lease_id = ?, lease_until = ?, attempts = attempts + 1 WHERE id = ?", leaseId, now + LEASE_MS, row.id);
        items.push({ submissionId: row.id, leaseId, createdAt: row.created_at, ...renderIssue(JSON.parse(row.payload)) });
      }
    });
    return { items };
  }

  ack(body) {
    if (!UUID.test(body.submissionId || '') || !UUID.test(body.leaseId || '') || !Number.isSafeInteger(body.issueNumber) || body.issueNumber < 1 || body.issueUrl !== `https://github.com/${FEEDBACK_REPOSITORY}/issues/${body.issueNumber}`) throw new ApiError(400, 'invalid_feedback_ack', '處理回報格式無效。');
    this.storage.transactionSync(() => {
      const row = this.sql.exec('SELECT * FROM feedback_submissions WHERE id = ?', body.submissionId).toArray()[0];
      if (!row || row.lease_id !== body.leaseId) throw new ApiError(409, 'feedback_lease_conflict', '這份投稿已由其他流程接手。');
      if (row.status === 'published') {
        if (row.issue_number !== body.issueNumber) throw new ApiError(409, 'feedback_issue_conflict', '這份投稿已建立其他 Issue。');
        return;
      }
      if (row.status !== 'processing') throw new ApiError(409, 'feedback_lease_conflict', '這份投稿目前無法回報。');
      // Retain only the receipt/hash, not a second copy of the public text.
      this.sql.exec("UPDATE feedback_submissions SET status = 'published', payload = '{}', issue_url = ?, issue_number = ?, lease_until = NULL WHERE id = ?", body.issueUrl, body.issueNumber, row.id);
    });
    return { ok: true };
  }
}
