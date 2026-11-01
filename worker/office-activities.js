import { ApiError } from './http.js';
import { getOfficeEvent, getOfficeGameActions } from '../dist/office/events.js';
import { SHARED_OFFICE_ROUND_MS, createSharedOfficeGame, resolveSharedOfficeRound, sharedOfficeActionIds } from '../dist/office/shared-activities.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVENT_ID = /^office-event-v1--?\d{1,12}$/;
// Exact-once move receipts live with their retained match. An evicted match
// returns 404; its old commands cannot recreate or settle another game.
export const OFFICE_ACTIVITY_RETENTION = Object.freeze({ finishedMatches: 1000, recentEvents: 200 });
const invalid = () => new ApiError(400, 'invalid_office_activity', '請確認活動、回合、動作與提交識別碼。');
function fields(value, allowed) { if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key))) throw invalid(); }
function eventId(value) { if (typeof value !== 'string' || !EVENT_ID.test(value)) throw invalid(); return value; }
const iso = value => value === null ? null : new Date(value).toISOString();
function sharedEvent(event) {
  return { ...event, mode: 'shared', roundSeconds: SHARED_OFFICE_ROUND_MS / 1000, maxRounds: event.type === 'coffee' ? 4 : 8,
    description: '核准成員報名後兩兩配對。每人封存自己的選擇，雙方都提交後由伺服器結算；對手可以是真人或 Agent。' };
}
function registration(row) { return row ? { eventId: row.event_id, memberId: row.member_id, status: row.status, matchId: row.match_id, joinedAt: iso(row.joined_at), updatedAt: iso(row.updated_at) } : null; }

export class OfficeActivityStore {
  constructor(sql, storage, { now = () => Date.now(), assertApproved, mutation, event, deliverActivity } = {}) {
    this.sql = sql; this.storage = storage; this.now = now; this.assertApproved = assertApproved;
    this.mutation = mutation || ((memberId, fn) => storage.transactionSync(() => { this.assertApproved(memberId); return fn(); }));
    this.event = event; this.deliverActivity = deliverActivity;
    sql.exec(`CREATE TABLE IF NOT EXISTS office_event_catalog (
      id TEXT PRIMARY KEY, type TEXT NOT NULL, starts_at INTEGER NOT NULL, join_closes_at INTEGER NOT NULL, event_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS office_event_registrations (
      event_id TEXT NOT NULL, member_id TEXT NOT NULL, status TEXT NOT NULL, match_id TEXT, joined_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
      PRIMARY KEY(event_id,member_id)
    );
    CREATE TABLE IF NOT EXISTS office_event_matches (
      id TEXT PRIMARY KEY,event_id TEXT NOT NULL,type TEXT NOT NULL,participant_a TEXT NOT NULL,participant_b TEXT NOT NULL,state_json TEXT NOT NULL,
      round_deadline INTEGER NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,finished_at INTEGER,finish_reason TEXT,winner_id TEXT,forfeited_json TEXT NOT NULL DEFAULT '[]'
    );
    CREATE TABLE IF NOT EXISTS office_event_moves (
      match_id TEXT NOT NULL,round INTEGER NOT NULL,member_id TEXT NOT NULL,action TEXT NOT NULL,submission_id TEXT NOT NULL,created_at INTEGER NOT NULL,
      PRIMARY KEY(match_id,round,member_id),UNIQUE(member_id,submission_id)
    );
    CREATE INDEX IF NOT EXISTS office_event_waiting ON office_event_registrations(event_id,status,joined_at);
    CREATE INDEX IF NOT EXISTS office_event_deadlines ON office_event_matches(finished_at,round_deadline);
    CREATE INDEX IF NOT EXISTS office_event_recent_matches ON office_event_matches(finished_at DESC,created_at DESC,id DESC);
    CREATE INDEX IF NOT EXISTS office_event_recent_catalog ON office_event_catalog(starts_at DESC,id DESC);`);
  }
  prune(currentId = getOfficeEvent(this.now()).id) {
    // All callers already own a SQLite transaction. Current-event outcomes and
    // every active match survive even when their timestamps are unusually old.
    this.sql.exec('DELETE FROM office_event_matches WHERE finished_at IS NOT NULL AND event_id<>? AND id NOT IN (SELECT id FROM office_event_matches WHERE finished_at IS NOT NULL ORDER BY finished_at DESC,created_at DESC,id DESC LIMIT ?)', currentId, OFFICE_ACTIVITY_RETENTION.finishedMatches);
    this.sql.exec('DELETE FROM office_event_moves WHERE NOT EXISTS (SELECT 1 FROM office_event_matches m WHERE m.id=office_event_moves.match_id)');
    this.sql.exec('DELETE FROM office_event_registrations WHERE event_id<>? AND event_id NOT IN (SELECT id FROM office_event_catalog ORDER BY starts_at DESC,id DESC LIMIT ?) AND NOT EXISTS (SELECT 1 FROM office_event_matches m WHERE m.event_id=office_event_registrations.event_id AND m.finished_at IS NULL)', currentId, OFFICE_ACTIVITY_RETENTION.recentEvents);
    this.sql.exec('DELETE FROM office_event_catalog WHERE id<>? AND id NOT IN (SELECT id FROM office_event_catalog ORDER BY starts_at DESC,id DESC LIMIT ?) AND NOT EXISTS (SELECT 1 FROM office_event_matches m WHERE m.event_id=office_event_catalog.id AND m.finished_at IS NULL)', currentId, OFFICE_ACTIVITY_RETENTION.recentEvents);
  }
  row(id) { return this.sql.exec('SELECT * FROM office_event_matches WHERE id=?', id).toArray()[0]; }
  approved(id) { return this.sql.exec("SELECT id,name,kind FROM office_members WHERE id=? AND admission_status='approved' AND kind IN ('human','agent')", id).toArray()[0]; }
  permitted(id) {
    const member = this.assertApproved(id);
    if (!['human', 'agent'].includes(member.kind)) throw new ApiError(403, 'office_activity_member', '共享活動僅供核准的真人與 Agent 參加。');
    if (member.kind === 'agent' && member.social_auto_activities !== 1) throw new ApiError(403, 'office_activity_opted_out', '這位 Agent 尚未開啟自動參與活動。');
    return member;
  }
  tell(memberId, type, payload, expiresAt, key) {
    if (!this.deliverActivity || !this.approved(memberId)) return;
    this.deliverActivity(memberId, { id: key, type, senderId: null, payload, expiresAt });
  }
  turn(row) {
    const state = JSON.parse(row.state_json); if (state.status !== 'playing') return;
    const submitted = new Set(this.sql.exec('SELECT member_id FROM office_event_moves WHERE match_id=? AND round=?', row.id, state.round + 1).toArray().map(move => move.member_id));
    for (const memberId of [row.participant_a, row.participant_b]) if (!submitted.has(memberId)) this.tell(memberId, 'activity-turn', { eventId: row.event_id, matchId: row.id, type: row.type, round: state.round + 1, roundDeadline: row.round_deadline, allowedActions: getOfficeGameActions(row.type) }, row.round_deadline, `activity-turn:${row.id}:${state.round + 1}:${memberId}`);
  }
  startMatch(event, first, second) {
    const id = crypto.randomUUID(), now = this.now(), state = createSharedOfficeGame(event.type);
    this.sql.exec('INSERT INTO office_event_matches(id,event_id,type,participant_a,participant_b,state_json,round_deadline,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)', id, event.id, event.type, first, second, JSON.stringify(state), now + SHARED_OFFICE_ROUND_MS, now, now);
    this.sql.exec("UPDATE office_event_registrations SET status='matched',match_id=?,updated_at=? WHERE event_id=? AND member_id IN (?,?)", id, now, event.id, first, second);
    const row = this.row(id); this.turn(row); this.event?.('activity-matched', second, '兩位核准成員已配對，開始共享活動。'); return row;
  }
  finish(row, state, reason, winnerId, forfeited = []) {
    const now = this.now(), winner = winnerId ? [row.participant_a, row.participant_b].indexOf(winnerId) : 'draw';
    this.sql.exec("UPDATE office_event_matches SET state_json=?,finished_at=?,updated_at=?,finish_reason=?,winner_id=?,forfeited_json=? WHERE id=? AND finished_at IS NULL", JSON.stringify({ ...state, status: 'finished', winner }), now, now, reason, winnerId, JSON.stringify(forfeited), row.id);
    this.event?.('activity-finished', winnerId || row.participant_a, '共享辦公室活動已結算。');
    this.prune();
  }
  settle() {
    const now = this.now();
    this.storage.transactionSync(() => {
      this.sql.exec("UPDATE office_event_registrations SET status='expired',updated_at=? WHERE status='waiting' AND event_id IN (SELECT id FROM office_event_catalog WHERE join_closes_at<=?)", now, now);
      for (const row of this.sql.exec('SELECT * FROM office_event_matches WHERE finished_at IS NULL').toArray()) {
        const ids = [row.participant_a, row.participant_b], revoked = ids.filter(id => !this.approved(id)), state = JSON.parse(row.state_json);
        if (revoked.length) { this.finish(row, state, 'revoked', revoked.length === 1 ? ids.find(id => !revoked.includes(id)) : null, revoked); continue; }
        if (row.round_deadline > now) continue;
        const submitted = new Set(this.sql.exec('SELECT member_id FROM office_event_moves WHERE match_id=? AND round=?', row.id, state.round + 1).toArray().map(move => move.member_id));
        const missing = ids.filter(id => !submitted.has(id));
        this.finish(row, state, 'timeout', missing.length === 1 ? ids.find(id => submitted.has(id)) : null, missing);
      }
      const event = getOfficeEvent(now);
      if (['registration', 'playing'].includes(event.phase)) {
        const waiting = this.sql.exec("SELECT r.member_id FROM office_event_registrations r JOIN office_members m ON m.id=r.member_id WHERE r.event_id=? AND r.status='waiting' AND m.admission_status='approved' AND m.kind IN ('human','agent') AND NOT EXISTS (SELECT 1 FROM office_event_matches x WHERE x.finished_at IS NULL AND (x.participant_a=r.member_id OR x.participant_b=r.member_id)) ORDER BY r.joined_at,r.member_id LIMIT 200", event.id).toArray().filter(candidate => { const member = this.assertApproved(candidate.member_id); return member.kind !== 'agent' || member.social_auto_activities === 1; });
        for (let index = 0; index + 1 < waiting.length; index += 2) this.startMatch(event, waiting[index].member_id, waiting[index + 1].member_id);
      }
      this.prune(event.id);
    });
  }
  project(row) {
    if (!row) return null;
    const state = JSON.parse(row.state_json), ids = [row.participant_a, row.participant_b];
    const submitted = new Set(this.sql.exec('SELECT member_id FROM office_event_moves WHERE match_id=? AND round=?', row.id, state.round + 1).toArray().map(move => move.member_id));
    return { id: row.id, eventId: row.event_id, type: row.type, mode: 'shared', participantIds: ids,
      participants: ids.map(id => this.approved(id) || { id, name: '已離場成員', kind: null }),
      status: state.status, round: state.round, currentRound: state.status === 'playing' ? state.round + 1 : null, maxRounds: state.maxRounds,
      scores: [...state.scores], energy: [...state.energy], history: state.history,
      submitted: ids.map(id => submitted.has(id)), roundDeadline: row.round_deadline,
      winnerId: row.winner_id, draw: state.status === 'finished' && row.winner_id === null, finishReason: row.finish_reason,
      forfeitedIds: JSON.parse(row.forfeited_json), allowedActions: getOfficeGameActions(row.type), createdAt: iso(row.created_at), finishedAt: iso(row.finished_at) };
  }
  join(memberId, body) {
    fields(body, ['eventId']); const id = eventId(body.eventId); this.permitted(memberId); this.settle();
    return this.mutation(memberId, () => {
      this.permitted(memberId);
      const old = this.sql.exec('SELECT * FROM office_event_registrations WHERE event_id=? AND member_id=?', id, memberId).toArray()[0];
      if (old) return { registration: registration(old), match: this.project(old.match_id ? this.row(old.match_id) : null), duplicate: true };
      if (this.sql.exec('SELECT id FROM office_event_matches WHERE finished_at IS NULL AND (participant_a=? OR participant_b=?) LIMIT 1', memberId, memberId).toArray().length) throw new ApiError(409, 'office_activity_busy', '請先完成或退出目前的共享活動，再報名下一場。');
      const event = getOfficeEvent(this.now());
      if (event.id !== id || !['registration', 'playing'].includes(event.phase)) throw new ApiError(409, 'office_activity_closed', '這場活動目前不接受新的報名。');
      const now = this.now();
      this.sql.exec('INSERT INTO office_event_catalog(id,type,starts_at,join_closes_at,event_json) VALUES(?,?,?,?,?) ON CONFLICT(id) DO NOTHING', id, event.type, event.startsAt, event.playEndsAt, JSON.stringify(sharedEvent(event)));
      this.sql.exec("INSERT INTO office_event_registrations(event_id,member_id,status,joined_at,updated_at) VALUES(?,?,'waiting',?,?)", id, memberId, now, now);
      const waiting = this.sql.exec("SELECT r.member_id FROM office_event_registrations r JOIN office_members m ON m.id=r.member_id WHERE r.event_id=? AND r.status='waiting' AND r.member_id!=? AND m.admission_status='approved' AND m.kind IN ('human','agent') AND NOT EXISTS (SELECT 1 FROM office_event_matches x WHERE x.finished_at IS NULL AND (x.participant_a=r.member_id OR x.participant_b=r.member_id)) ORDER BY r.joined_at,r.member_id LIMIT 200", id, memberId).toArray().find(candidate => { const member = this.assertApproved(candidate.member_id); return member.kind !== 'agent' || member.social_auto_activities === 1; });
      let match = null;
      if (waiting) {
        match = this.project(this.startMatch(event, waiting.member_id, memberId));
      }
      this.prune(event.id);
      return { registration: registration(this.sql.exec('SELECT * FROM office_event_registrations WHERE event_id=? AND member_id=?', id, memberId).one()), match, duplicate: false };
    });
  }
  move(memberId, matchId, body) {
    fields(body, ['round', 'action', 'submissionId']);
    if (typeof matchId !== 'string' || !UUID.test(matchId) || !Number.isInteger(body.round) || body.round < 1 || body.round > 8 || typeof body.action !== 'string' || typeof body.submissionId !== 'string' || !UUID.test(body.submissionId)) throw invalid();
    const submissionId = body.submissionId.toLowerCase(); this.permitted(memberId); this.settle();
    return this.mutation(memberId, () => {
      this.permitted(memberId);
      const row = this.row(matchId); if (!row) throw new ApiError(404, 'office_match_missing', '找不到這場共享活動。');
      if (![row.participant_a, row.participant_b].includes(memberId)) throw new ApiError(403, 'office_match_member', '只有本場參加者可以提交動作。');
      const previous = this.sql.exec('SELECT * FROM office_event_moves WHERE member_id=? AND submission_id=?', memberId, submissionId).toArray()[0];
      const receipt = { submissionId, matchId, round: body.round, action: body.action, accepted: true };
      if (previous) {
        if (previous.match_id !== matchId || previous.round !== body.round || previous.action !== body.action) throw new ApiError(409, 'office_submission_conflict', '這個提交識別碼已用於其他動作。');
        return { match: this.project(row), receipt, duplicate: true };
      }
      const state = JSON.parse(row.state_json);
      if (state.status !== 'playing' || body.round !== state.round + 1) throw new ApiError(409, 'office_round_changed', '這個回合已經結束或尚未開始，請重新讀取活動。');
      if (row.round_deadline <= this.now()) throw new ApiError(409, 'office_round_expired', '這個回合已逾時，請重新讀取活動結算。');
      if (!sharedOfficeActionIds(row.type).includes(body.action)) throw invalid();
      if (this.sql.exec('SELECT member_id FROM office_event_moves WHERE match_id=? AND round=? AND member_id=?', matchId, body.round, memberId).toArray().length) throw new ApiError(409, 'office_move_sealed', '本回合已提交，請使用原提交識別碼查詢結果。');
      const now = this.now();
      this.sql.exec('INSERT INTO office_event_moves(match_id,round,member_id,action,submission_id,created_at) VALUES(?,?,?,?,?,?)', matchId, body.round, memberId, body.action, submissionId, now);
      const moves = this.sql.exec('SELECT member_id,action FROM office_event_moves WHERE match_id=? AND round=?', matchId, body.round).toArray();
      if (moves.length === 2) {
        const next = resolveSharedOfficeRound(state, [row.participant_a, row.participant_b].map(id => moves.find(move => move.member_id === id).action));
        if (next.status === 'finished') this.finish(row, next, 'completed', next.winner === 'draw' ? null : [row.participant_a, row.participant_b][next.winner]);
        else {
          this.sql.exec('UPDATE office_event_matches SET state_json=?,round_deadline=?,updated_at=? WHERE id=?', JSON.stringify(next), now + SHARED_OFFICE_ROUND_MS, now, matchId);
          this.turn(this.row(matchId));
        }
      }
      return { match: this.project(this.row(matchId)), receipt, duplicate: false };
    });
  }
  leave(memberId, body) {
    fields(body, ['eventId']); const id = eventId(body.eventId); this.assertApproved(memberId); this.settle();
    return this.mutation(memberId, () => {
      const row = this.sql.exec('SELECT * FROM office_event_registrations WHERE event_id=? AND member_id=?', id, memberId).toArray()[0];
      if (!row) return { registration: null, match: null, duplicate: true };
      const duplicate = row.status === 'withdrawn';
      if (!duplicate) this.sql.exec("UPDATE office_event_registrations SET status='withdrawn',updated_at=? WHERE event_id=? AND member_id=?", this.now(), id, memberId);
      const match = row.match_id ? this.row(row.match_id) : null;
      if (match && match.finished_at === null) { const other = match.participant_a === memberId ? match.participant_b : match.participant_a; this.finish(match, JSON.parse(match.state_json), 'withdrawal', this.approved(other) ? other : null, [memberId]); }
      return { registration: registration(this.sql.exec('SELECT * FROM office_event_registrations WHERE event_id=? AND member_id=?', id, memberId).one()), match: this.project(match ? this.row(match.id) : null), duplicate };
    });
  }
  snapshot(viewerId = null) {
    if (viewerId) this.assertApproved(viewerId); this.settle();
    const event = sharedEvent(getOfficeEvent(this.now()));
    const participants = this.sql.exec("SELECT r.*,m.name,m.kind FROM office_event_registrations r JOIN office_members m ON m.id=r.member_id WHERE r.event_id=? AND r.status IN ('waiting','matched') AND m.admission_status='approved' ORDER BY r.joined_at,r.member_id", event.id).toArray().map(row => ({ ...registration(row), id: row.member_id, name: row.name, kind: row.kind }));
    const matches = this.sql.exec('SELECT * FROM office_event_matches WHERE event_id=? OR finished_at IS NULL ORDER BY created_at DESC,id LIMIT 200', event.id).toArray().map(row => this.project(row));
    const result = { version: 1, serverTime: iso(this.now()), event, participants, matches };
    if (viewerId) {
      result.myRegistration = registration(this.sql.exec('SELECT * FROM office_event_registrations WHERE event_id=? AND member_id=?', event.id, viewerId).toArray()[0]);
      result.myMatches = this.sql.exec('SELECT * FROM office_event_matches WHERE participant_a=? OR participant_b=? ORDER BY CASE WHEN finished_at IS NULL THEN 0 ELSE 1 END,created_at DESC,id LIMIT 20', viewerId, viewerId).toArray().map(row => this.project(row));
    }
    return result;
  }
  invitations(memberId) {
    this.assertApproved(memberId); this.settle(); const event = sharedEvent(getOfficeEvent(this.now())), invitations = [];
    const registered = this.sql.exec('SELECT status FROM office_event_registrations WHERE event_id=? AND member_id=?', event.id, memberId).toArray()[0];
    if (!registered && ['registration', 'playing'].includes(event.phase)) {
      const payload = { eventId: event.id, event, joinOpensAt: event.startsAt, joinClosesAt: event.playEndsAt };
      const invitation = { id: `activity-invite:${event.id}:${memberId}`, type: 'activity-invitation', senderId: null, payload, expiresAt: event.playEndsAt };
      invitations.push(invitation); this.tell(memberId, invitation.type, payload, invitation.expiresAt, invitation.id);
    }
    for (const row of this.sql.exec('SELECT * FROM office_event_matches WHERE finished_at IS NULL AND (participant_a=? OR participant_b=?)', memberId, memberId).toArray()) this.turn(row);
    return invitations;
  }
}
