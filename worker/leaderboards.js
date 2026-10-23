import { LEADERBOARD_METRICS_V56, SCORE_VERSION_V56, deriveLeaderboardScoreFromMetricsV57, deriveLegacyLeaderboardScoreV1FromMetricsV57 } from '../dist/leaderboard-score-v56.js';
import { ROLE_MAP } from '../dist/roles.js';
import { ENDINGS } from '../dist/endings.js';
import { ApiError } from './http.js';

const metricIds = LEADERBOARD_METRICS_V56.map(metric => metric.id);
const allowedMetrics = new Set(metricIds);
const valueColumn = id => id === 'overall' ? 'total' : `metric_${id}`;
const metricColumns = metricIds.filter(id => id !== 'overall');
const conflict = () => new ApiError(409, 'leaderboard_run_conflict', '這個人生編號已有其他紀錄，請保留原本的遊戲進度。');
const rowMetrics = row => Object.fromEntries(metricIds.map(id => [id, row[valueColumn(id)]]));
const MIGRATION_BATCH = 100;
const endingRoleIds = new Map(ENDINGS.map(ending => [ending.id, ending.roleId]));

export function validateLeaderboardNickname(value) {
  if (typeof value !== 'string' || /[\p{Cc}\p{Cf}<>]/u.test(value)) {
    throw new ApiError(400, 'invalid_nickname', '請使用 2–16 字的暱稱，不要填網址、電子郵件或聯絡資料。');
  }
  const nickname = value.normalize('NFKC').trim();
  if ([...nickname].length < 2 || [...nickname].length > 16 || /[\p{Cc}\p{Cf}<>@]|https?:|www\.|:\/\/|[\w-]+\.(?:com|net|org|tw|io|app|dev)(?:\b|\/)/iu.test(nickname)) {
    throw new ApiError(400, 'invalid_nickname', '請使用 2–16 字的暱稱，不要填網址、電子郵件或聯絡資料。');
  }
  return nickname;
}

export function validateLeaderboardFilter(url) {
  const metric = url.searchParams.get('metric') || 'overall';
  const role = url.searchParams.get('role') || 'all';
  if ([...url.searchParams.keys()].some(key => !['metric', 'role'].includes(key)) || url.searchParams.getAll('metric').length > 1 || url.searchParams.getAll('role').length > 1 || !allowedMetrics.has(metric) || role !== 'all' && !Object.hasOwn(ROLE_MAP, role)) {
    throw new ApiError(400, 'invalid_leaderboard_filter', '排行榜分類無效。');
  }
  return { metric, role };
}

// Only opt-in names, opaque public IDs and replay-derived numeric scores persist.
// Raw seeds, actions, dialogue, ending labels and difficulty hints never do.
export class LeaderboardStore {
  constructor(sql, storage = null) {
    this.sql = sql;
    this.storage = storage;
    sql.exec(`
      CREATE TABLE IF NOT EXISTS leaderboard_entries (
        run_id TEXT PRIMARY KEY REFERENCES runs(id), entry_id TEXT NOT NULL UNIQUE,
        player_id TEXT NOT NULL REFERENCES players(id), nickname TEXT NOT NULL,
        role_id TEXT NOT NULL, actual_role_id TEXT NOT NULL,
        score_version INTEGER NOT NULL, total INTEGER NOT NULL CHECK(total >= 0),
        ${metricColumns.map(id => `metric_${id} INTEGER NOT NULL CHECK(metric_${id} >= 0)`).join(',\n        ')},
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS leaderboard_player ON leaderboard_entries(player_id);
      CREATE INDEX IF NOT EXISTS leaderboard_total ON leaderboard_entries(total DESC, created_at, entry_id);
      CREATE INDEX IF NOT EXISTS leaderboard_role_total ON leaderboard_entries(actual_role_id, total DESC, created_at, entry_id);
    `);
    if (!sql.exec('PRAGMA table_info(leaderboard_entries)').toArray().some(column => column.name === 'migration_status')) {
      sql.exec('ALTER TABLE leaderboard_entries ADD COLUMN migration_status INTEGER NOT NULL DEFAULT 0');
    }
    sql.exec('CREATE INDEX IF NOT EXISTS leaderboard_migration ON leaderboard_entries(score_version,migration_status,run_id)');
  }

  // V1 retained the complete numeric score evidence and runs retained the
  // canonical ending ID. Regrade only rows that reproduce their original
  // score exactly. A malformed row remains privately manageable, never a
  // fabricated result. Bound each read to one transaction of 100 entries.
  migrateLegacyBatch() {
    if (SCORE_VERSION_V56 !== 2) return;
    const migrate = () => {
      const rows = this.sql.exec(`SELECT e.*,r.ending_id AS canonical_ending_id,
        r.player_id AS canonical_player_id,r.role_id AS canonical_role_id,r.actual_role_id AS canonical_actual_role_id
        FROM leaderboard_entries e LEFT JOIN runs r ON r.id=e.run_id
        WHERE e.score_version=1 AND e.migration_status=0 ORDER BY e.run_id LIMIT ?`, MIGRATION_BATCH).toArray();
      for (const row of rows) {
        let next;
        try {
          if (row.player_id !== row.canonical_player_id || row.role_id !== row.canonical_role_id || row.actual_role_id !== row.canonical_actual_role_id ||
            !Object.hasOwn(ROLE_MAP, row.role_id) || !Object.hasOwn(ROLE_MAP, row.actual_role_id) || endingRoleIds.get(row.canonical_ending_id) !== row.role_id) {
            throw new Error('Legacy identity does not match completion');
          }
          const metrics = rowMetrics(row);
          const legacy = deriveLegacyLeaderboardScoreV1FromMetricsV57(metrics, row.canonical_ending_id);
          if (legacy.total !== row.total) throw new Error('Legacy score does not match retained evidence');
          next = deriveLeaderboardScoreFromMetricsV57(metrics, row.canonical_ending_id);
        } catch {
          this.sql.exec('UPDATE leaderboard_entries SET migration_status=-1 WHERE run_id=? AND score_version=1 AND migration_status=0', row.run_id);
          continue;
        }
        this.sql.exec('UPDATE leaderboard_entries SET total=?,score_version=?,migration_status=1 WHERE run_id=? AND score_version=1 AND migration_status=0', next.total, SCORE_VERSION_V56, row.run_id);
      }
    };
    if (typeof this.storage?.transactionSync === 'function') this.storage.transactionSync(migrate);
    else migrate(); // Single-row SQL writes remain atomic in isolated callers.
    if (this.sql.exec('SELECT 1 AS pending FROM leaderboard_entries WHERE score_version=1 AND migration_status=0 LIMIT 1').toArray().length) {
      throw new ApiError(503, 'leaderboard_recalculating', '排行榜正在依新版規則重新計分，尚未顯示未完成的名次。請稍後按「更新榜單」。');
    }
  }

  // Caller holds the same SQLite transaction as the completion commitment.
  publish(playerId, runId, run, score, nickname, now = new Date().toISOString()) {
    const prior = this.sql.exec('SELECT * FROM leaderboard_entries WHERE run_id = ?', runId).toArray()[0];
    if (prior && prior.player_id !== playerId) throw conflict();
    if (score.scoreVersion !== SCORE_VERSION_V56 || !Number.isSafeInteger(score.total) || score.total < 0 || metricIds.some(id => !Number.isSafeInteger(score.metrics[id]) || score.metrics[id] < 0)) throw new Error('Invalid canonical leaderboard score');
    if (prior) {
      // The caller already verified the exact historical action commitment.
      // Only a known formula upgrade may alter numeric values; preserve opt-in,
      // public identity and tie timestamp when that same proof is resubmitted.
      if (prior.role_id !== run.roleId || prior.actual_role_id !== run.actualRoleId || metricColumns.some(id => prior[`metric_${id}`] !== score.metrics[id])) throw conflict();
      if (prior.score_version === SCORE_VERSION_V56) {
        if (prior.total !== score.total) throw conflict();
        this.sql.exec('UPDATE leaderboard_entries SET nickname = ? WHERE run_id = ?', nickname, runId);
      } else if (prior.score_version === 1 && SCORE_VERSION_V56 === 2) {
        const legacy = deriveLegacyLeaderboardScoreV1FromMetricsV57(score.metrics, run.endingId);
        if (prior.total !== legacy.total) throw conflict();
        this.sql.exec('UPDATE leaderboard_entries SET nickname=?,total=?,score_version=?,migration_status=1 WHERE run_id=?', nickname, score.total, SCORE_VERSION_V56, runId);
      } else throw conflict();
    } else {
      this.sql.exec(`INSERT INTO leaderboard_entries
        (run_id,entry_id,player_id,nickname,role_id,actual_role_id,score_version,total,${metricColumns.map(id => `metric_${id}`).join(',')},created_at)
        VALUES (${Array(9 + metricColumns.length).fill('?').join(',')})`,
        runId, crypto.randomUUID(), playerId, nickname, run.roleId, run.actualRoleId, SCORE_VERSION_V56, score.total, ...metricColumns.map(id => score.metrics[id]), now);
    }
    return this.ownEntry(this.sql.exec('SELECT * FROM leaderboard_entries WHERE run_id = ?', runId).one());
  }

  ownEntry(row) {
    return { runId: row.run_id, entryId: row.entry_id, nickname: row.nickname, total: row.total, scoreVersion: row.score_version,
      metrics: rowMetrics(row),
      roleId: row.role_id, actualRoleId: row.actual_role_id, turns: row.metric_turns, createdAt: row.created_at };
  }

  mine(playerId, after = null) {
    let cursor = null;
    if (after !== null) {
      if (typeof after !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(after)) throw new ApiError(400, 'invalid_leaderboard_cursor', '留名紀錄的頁碼無效。');
      cursor = this.sql.exec('SELECT created_at,entry_id FROM leaderboard_entries WHERE entry_id = ? AND player_id = ?', after.toLowerCase(), playerId).toArray()[0];
      if (!cursor) throw new ApiError(400, 'invalid_leaderboard_cursor', '這頁留名紀錄已變更，請重新載入。');
    }
    const rows = cursor ? this.sql.exec('SELECT * FROM leaderboard_entries WHERE player_id = ? AND (created_at < ? OR (created_at = ? AND entry_id < ?)) ORDER BY created_at DESC,entry_id DESC LIMIT 101', playerId, cursor.created_at, cursor.created_at, cursor.entry_id).toArray()
      : this.sql.exec('SELECT * FROM leaderboard_entries WHERE player_id = ? ORDER BY created_at DESC,entry_id DESC LIMIT 101', playerId).toArray();
    return { version: 1, scoreVersion: SCORE_VERSION_V56, entries: rows.slice(0, 100).map(row => this.ownEntry(row)), hasMore: rows.length > 100, nextCursor: rows.length > 100 ? rows[99].entry_id : null };
  }

  remove(playerId, runId) {
    const owner = this.sql.exec('SELECT player_id FROM runs WHERE id = ?', runId).toArray()[0];
    if (!owner || owner.player_id !== playerId) throw new ApiError(404, 'leaderboard_not_found', '找不到這筆自己的排行榜紀錄。');
    this.sql.exec('DELETE FROM leaderboard_entries WHERE run_id = ? AND player_id = ?', runId, playerId);
    return { version: 1, removed: true, runId };
  }

  rename(playerId, runId, nickname) {
    const prior = this.sql.exec('SELECT * FROM leaderboard_entries WHERE run_id = ? AND player_id = ?', runId, playerId).toArray()[0];
    if (!prior) throw new ApiError(404, 'leaderboard_not_found', '找不到這筆自己的排行榜紀錄。');
    this.sql.exec('UPDATE leaderboard_entries SET nickname = ? WHERE run_id = ? AND player_id = ?', nickname, runId, playerId);
    return { version: 1, scoreVersion: SCORE_VERSION_V56, published: true, entry: this.ownEntry({ ...prior, nickname }) };
  }

  public({ metric, role }, now = new Date().toISOString()) {
    this.migrateLegacyBatch();
    // Interpolated column names come only from the fixed shared metric allowlist.
    // Each verified, named run owns one row. Keep every run eligible; the
    // public 50-row window never replaces a player's lower-scoring entries.
    const column = valueColumn(metric), where = role === 'all' ? 'score_version = ?' : 'score_version = ? AND actual_role_id = ?';
    const args = role === 'all' ? [SCORE_VERSION_V56] : [SCORE_VERSION_V56, role];
    const rows = this.sql.exec(`SELECT entry_id,nickname,role_id,actual_role_id,total,metric_turns,created_at,${column} AS value
      FROM leaderboard_entries WHERE ${where}
      ORDER BY value DESC,total DESC,created_at ASC,entry_id ASC LIMIT 50`, ...args).toArray();
    const count = this.sql.exec(`SELECT COUNT(*) AS entries,COUNT(DISTINCT player_id) AS players FROM leaderboard_entries WHERE ${where}`, ...args).one();
    let rank = 0, previousValue = null;
    return { version: 1, scoreVersion: SCORE_VERSION_V56, metric, role,
      entries: rows.map((row, index) => {
        if (row.value !== previousValue) rank = index + 1;
        previousValue = row.value;
        return { rank, nickname: row.nickname, value: row.value, total: row.total,
          roleId: row.role_id, actualRoleId: row.actual_role_id, turns: row.metric_turns, createdAt: row.created_at, entryId: row.entry_id };
      }),
      totalEntries: count.entries, totalPlayers: count.players, updatedAt: now };
  }
}
