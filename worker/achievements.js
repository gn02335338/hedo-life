import { deriveAchievements } from '../dist/achievements.js';
import { ApiError, tokenHash } from './http.js';

// Only replay-derived milestones are recorded. Seeds and choice transcripts
// are processed in memory and are never retained in these tables.
export class AchievementStore {
  constructor(sql, storage) {
    this.sql = sql;
    this.storage = storage;
    sql.exec(`
      CREATE TABLE IF NOT EXISTS player_achievements (
        player_id TEXT NOT NULL REFERENCES players(id),
        achievement_id TEXT NOT NULL,
        first_seen_at TEXT NOT NULL,
        PRIMARY KEY (player_id, achievement_id)
      );
      CREATE TABLE IF NOT EXISTS achievement_runs (
        id TEXT PRIMARY KEY,
        player_id TEXT NOT NULL REFERENCES players(id),
        role_id TEXT NOT NULL,
        seed_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
  }

  snapshot(playerId) {
    return this.sql.exec('SELECT achievement_id AS id, first_seen_at AS unlockedAt FROM player_achievements WHERE player_id = ? ORDER BY first_seen_at, achievement_id', playerId).toArray();
  }

  async record(playerId, runId, run, now = new Date().toISOString()) {
    const seedHash = await tokenHash(run.seed);
    const ids = deriveAchievements(run);
    const added = [];
    this.storage.transactionSync(() => {
      const previous = this.sql.exec('SELECT * FROM achievement_runs WHERE id = ?', runId).toArray()[0];
      const completed = this.sql.exec('SELECT player_id, role_id, ending_id FROM runs WHERE id = ?', runId).toArray()[0];
      if ((previous && (previous.player_id !== playerId || previous.role_id !== run.roleId || previous.seed_hash !== seedHash)) ||
          (completed && (completed.player_id !== playerId || completed.role_id !== run.roleId || (run.completed && completed.ending_id !== run.endingId)))) {
        throw new ApiError(409, 'achievement_run_conflict', '這個人生編號已使用，請保留原本的遊戲紀錄。');
      }
      if (!previous) this.sql.exec('INSERT INTO achievement_runs (id, player_id, role_id, seed_hash, created_at) VALUES (?, ?, ?, ?, ?)', runId, playerId, run.roleId, seedHash, now);
      for (const id of ids) {
        const exists = this.sql.exec('SELECT 1 AS found FROM player_achievements WHERE player_id = ? AND achievement_id = ?', playerId, id).toArray()[0];
        if (exists) continue;
        this.sql.exec('INSERT INTO player_achievements (player_id, achievement_id, first_seen_at) VALUES (?, ?, ?)', playerId, id, now);
        added.push(id);
      }
    });
    return added;
  }
}
