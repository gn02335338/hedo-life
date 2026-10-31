import { ApiError, assertSameOrigin, bearerToken, errorResponse, json, readJson, tokenHash, validToken } from './http.js';
import { AdminPrivateStore } from './admin-private.js';
import { DEFAULT_OFFICE_FLOOR, isOfficeFloor } from '../dist/office/floors.js';
import { handleOfficeMcp, OFFICE_MCP_PATH } from './office-mcp.js';

export const OFFICE_PRESENCE_MS = 120000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ZONES = ['studio', 'meeting', 'lounge', 'focus'];
const STATUSES = ['working', 'idle', 'break'];
const privateHeaders = { Vary: 'Cookie, Authorization', 'Cross-Origin-Resource-Policy': 'same-origin' };
const response = (body, status = 200) => json(body, status, privateHeaders);
const invalid = () => new ApiError(400, 'invalid_office_input', '請確認辦公室資料的格式與長度。');
function fields(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key))) throw invalid();
}
function text(value, maximum, optional = false) {
  if (optional && value === undefined) return '';
  if (typeof value !== 'string' || value.length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value) || (!optional && !value.trim())) throw invalid();
  return value.trim();
}
function publicMember(row, now) {
  return { id: row.id, kind: row.kind, name: row.name, role: row.role, intro: row.intro,
    departmentFloor: row.department_floor, floor: row.floor,
    zone: row.zone, status: row.presence_status, activity: row.activity,
    online: row.last_seen_at !== null && now - row.last_seen_at < OFFICE_PRESENCE_MS,
    lastSeenAt: row.last_seen_at === null ? null : new Date(row.last_seen_at).toISOString(), joinedAt: row.approved_at };
}
function application(row) {
  return { id: row.id, kind: row.kind, name: row.name, role: row.role, intro: row.intro, contact: row.contact,
    departmentFloor: row.department_floor, floor: row.floor,
    status: row.admission_status, zone: row.zone, presenceStatus: row.presence_status, activity: row.activity,
    createdAt: row.created_at, updatedAt: row.updated_at, approvedAt: row.approved_at };
}
function task(row) {
  return { id: row.id, title: row.title, description: row.description, status: row.status, createdBy: row.created_by,
    assigneeId: row.assignee_id, result: row.result, createdAt: row.created_at, updatedAt: row.updated_at };
}

export class OfficeStore {
  constructor(sql, storage, env, { now = () => Date.now(), admin } = {}) {
    this.sql = sql; this.storage = storage; this.env = env; this.now = now;
    this.admin = admin || new AdminPrivateStore(sql, env, { now });
    sql.exec(`CREATE TABLE IF NOT EXISTS office_members (
      id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, kind TEXT NOT NULL,
      name TEXT NOT NULL, role TEXT NOT NULL, intro TEXT NOT NULL, contact TEXT NOT NULL,
      admission_status TEXT NOT NULL, zone TEXT NOT NULL DEFAULT 'studio', presence_status TEXT NOT NULL DEFAULT 'idle',
      department_floor INTEGER NOT NULL DEFAULT 1, floor INTEGER NOT NULL DEFAULT 1,
      activity TEXT NOT NULL DEFAULT '', last_seen_at INTEGER, approved_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS office_tasks (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL, status TEXT NOT NULL,
      created_by TEXT NOT NULL, assignee_id TEXT, result TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS office_messages (id TEXT PRIMARY KEY, member_id TEXT NOT NULL, text TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS office_activity (id TEXT PRIMARY KEY, type TEXT NOT NULL, member_id TEXT NOT NULL, text TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS office_limits (bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, until_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS office_members_status ON office_members(admission_status);
    CREATE INDEX IF NOT EXISTS office_tasks_status ON office_tasks(status);`);
    // Existing approved identities and their history stay in the same archive.
    // Each additive column can also resume independently after an interrupted rollout.
    const columns = new Set(sql.exec('PRAGMA table_info(office_members)').toArray().map(column => column.name));
    for (const name of ['department_floor', 'floor']) {
      if (!columns.has(name)) sql.exec(`ALTER TABLE office_members ADD COLUMN ${name} INTEGER NOT NULL DEFAULT 1`);
    }
  }
  limit(bucket, maximum, window = 60000) {
    const now = this.now();
    this.sql.exec('DELETE FROM office_limits WHERE until_at <= ?', now);
    const row = this.sql.exec('SELECT count,until_at FROM office_limits WHERE bucket = ?', bucket).toArray()[0];
    if (row && row.count >= maximum) {
      const error = new ApiError(429, 'office_rate_limit', '辦公室操作太頻繁，請稍後再試。');
      error.retryAfter = Math.max(1, Math.ceil((row.until_at - now) / 1000));
      throw error;
    }
    this.sql.exec('INSERT INTO office_limits (bucket,count,until_at) VALUES (?,?,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1', bucket, 1, now + window);
  }
  event(type, memberId, message) {
    this.sql.exec('INSERT INTO office_activity (id,type,member_id,text,created_at) VALUES (?,?,?,?,?)', crypto.randomUUID(), type, memberId, message, new Date(this.now()).toISOString());
    this.sql.exec('DELETE FROM office_activity WHERE rowid NOT IN (SELECT rowid FROM office_activity ORDER BY rowid DESC LIMIT 200)');
  }
  assertApproved(id) {
    const row = this.sql.exec('SELECT * FROM office_members WHERE id = ?', id).toArray()[0];
    if (!row || row.admission_status !== 'approved') throw new ApiError(403, 'office_approval_required', '通過審核後才能在辦公室工作。');
    return row;
  }
  async identify(request, approved = false) {
    const hash = await tokenHash(bearerToken(request));
    const row = this.sql.exec('SELECT * FROM office_members WHERE token_hash = ?', hash).toArray()[0];
    if (!row) throw new ApiError(401, 'office_member_required', '請先申請加入禾多辦公室。');
    if (approved) this.assertApproved(row.id);
    return row;
  }
  mutation(memberId, fn) {
    return this.storage.transactionSync(() => { this.assertApproved(memberId); this.limit(`member:${memberId}`, 45); return fn(); });
  }
  async snapshot() {
    let admissionOpen = false;
    try { await this.admin.configuration(); admissionOpen = true; } catch { /* Admission fails closed until a reviewer can sign in. */ }
    const members = this.sql.exec("SELECT * FROM office_members WHERE admission_status='approved' ORDER BY approved_at,id LIMIT 200").toArray().map(row => publicMember(row, this.now()));
    const tasks = this.sql.exec("SELECT t.* FROM office_tasks t JOIN office_members m ON m.id=t.created_by WHERE m.admission_status='approved' ORDER BY CASE WHEN t.status='completed' THEN 1 ELSE 0 END,t.rowid DESC LIMIT 150").toArray().map(task);
    const messages = this.sql.exec("SELECT x.id,x.member_id AS memberId,x.text,x.created_at AS createdAt FROM office_messages x JOIN office_members m ON m.id=x.member_id WHERE m.admission_status='approved' ORDER BY x.rowid DESC LIMIT 50").toArray().reverse();
    const activity = this.sql.exec("SELECT x.id,x.type,x.member_id AS memberId,x.text,x.created_at AS createdAt FROM office_activity x JOIN office_members m ON m.id=x.member_id WHERE m.admission_status='approved' ORDER BY x.rowid DESC LIMIT 40").toArray();
    return response({ version: 1, admissionOpen, serverTime: new Date(this.now()).toISOString(), members, tasks, messages, activity });
  }
  async apply(request) {
    const config = await this.admin.configuration();
    const body = await readJson(request, { maxBytes: 8192 }); fields(body, ['token', 'kind', 'name', 'role', 'intro', 'contact', 'departmentFloor']);
    const hash = await tokenHash(validToken(body.token));
    if (!['human', 'agent'].includes(body.kind)) throw invalid();
    const departmentFloor = body.departmentFloor === undefined ? DEFAULT_OFFICE_FLOOR : body.departmentFloor;
    if (!isOfficeFloor(departmentFloor)) throw invalid();
    const values = { kind: body.kind, name: text(body.name, 40), role: text(body.role, 80), intro: text(body.intro, 500), contact: text(body.contact, 160, true), department_floor: departmentFloor };
    const bucket = await this.admin.signature(config, 'office-application:' + (request.headers.get('CF-Connecting-IP') || 'local'));
    const existing = this.sql.exec('SELECT * FROM office_members WHERE token_hash = ?', hash).toArray()[0];
    if (existing) {
      if (Object.keys(values).some(key => values[key] !== existing[key])) throw new ApiError(409, 'office_application_exists', '這個加入憑證已經有一份申請，請查看原申請狀態。');
      return response({ application: application(existing) });
    }
    const id = crypto.randomUUID(), now = new Date(this.now()).toISOString();
    this.storage.transactionSync(() => {
      this.limit(`apply:${bucket}`, 5, 3600000); this.limit('apply:global', 100, 3600000);
      if (this.sql.exec('SELECT COUNT(*) AS n FROM office_members').one().n >= 2000) throw new ApiError(503, 'office_admission_full', '目前的申請名額已滿，請稍後再試。');
      this.sql.exec('INSERT INTO office_members (id,token_hash,kind,name,role,intro,contact,admission_status,department_floor,floor,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', id, hash, values.kind, values.name, values.role, values.intro, values.contact, 'pending', values.department_floor, values.department_floor, now, now);
    });
    return response({ application: application(this.sql.exec('SELECT * FROM office_members WHERE id = ?', id).one()) }, 202);
  }
  async review(request, path) {
    const config = await this.admin.configuration(), session = await this.admin.authenticate(request, config);
    if (path === '/api/office/admin/applications' && request.method === 'GET') {
      return response({ applications: this.sql.exec('SELECT * FROM office_members ORDER BY created_at DESC,id LIMIT 2000').toArray().map(application) });
    }
    const match = /^\/api\/office\/admin\/applications\/([^/]+)$/.exec(path);
    if (match && request.method === 'POST') {
      await this.admin.writeGuard(request, session);
      if (!UUID.test(match[1])) throw invalid();
      const body = await readJson(request, { maxBytes: 1024 }); fields(body, ['decision']);
      if (!['approved', 'rejected', 'revoked'].includes(body.decision)) throw invalid();
      const id = match[1], now = new Date(this.now()).toISOString();
      this.storage.transactionSync(() => {
        this.limit('admin:' + session.hash, 60);
        const row = this.sql.exec('SELECT * FROM office_members WHERE id = ?', id).toArray()[0];
        if (!row) throw new ApiError(404, 'office_application_missing', '找不到這份申請。');
        if (body.decision === row.admission_status) return;
        if (body.decision === 'approved') {
          if (this.sql.exec("SELECT COUNT(*) AS n FROM office_members WHERE admission_status='approved'").one().n >= 200) throw new ApiError(409, 'office_full', '辦公室目前已滿員。');
          const restoredTasks = this.sql.exec("SELECT COUNT(*) AS n FROM office_tasks t JOIN office_members m ON m.id=t.created_by WHERE t.status!='completed' AND (m.admission_status='approved' OR t.created_by=?)", id).one().n;
          if (restoredTasks > 100) throw new ApiError(409, 'office_task_limit', '工作看板空間不足，請先完成目前的工作，再恢復這位成員。');
        }
        this.sql.exec('UPDATE office_members SET admission_status=?, approved_at=CASE WHEN ?=\'approved\' THEN COALESCE(approved_at,?) ELSE approved_at END, last_seen_at=CASE WHEN admission_status=? THEN last_seen_at ELSE NULL END, updated_at=? WHERE id=?', body.decision, body.decision, now, body.decision, now, id);
        if (body.decision !== 'approved') this.sql.exec("UPDATE office_tasks SET status='open',assignee_id=NULL,result='',updated_at=? WHERE assignee_id=? AND status='claimed'", now, id);
        if (body.decision === 'approved' && row.admission_status !== 'approved') this.event('joined', id, `${row.name}加入辦公室。`);
      });
      return response({ application: application(this.sql.exec('SELECT * FROM office_members WHERE id = ?', id).one()) });
    }
    throw new ApiError(405, 'office_method', '這個辦公室端點不接受此操作。');
  }
  async fetch(request) {
    try {
      const path = new URL(request.url).pathname;
      if (path === OFFICE_MCP_PATH) return await handleOfficeMcp(request, this);
      if (path.startsWith('/api/office/admin/')) return await this.review(request, path);
      if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method)) assertSameOrigin(request);
      if (path === '/api/office' && request.method === 'GET') return await this.snapshot();
      if (path === '/api/office/apply' && request.method === 'POST') return await this.apply(request);
      if (path === '/api/office/me' && request.method === 'GET') return response({ application: application(await this.identify(request)) });
      if (request.method !== 'POST') throw new ApiError(405, 'office_method', '這個辦公室端點不接受此操作。');
      const body = await readJson(request, { maxBytes: 8192 });
      const member = await this.identify(request, true), now = new Date(this.now()).toISOString();
      if (path === '/api/office/presence') {
        fields(body, ['zone', 'status', 'activity', 'floor']);
        if (!ZONES.includes(body.zone) || !STATUSES.includes(body.status)) throw invalid();
        if (body.floor !== undefined && !isOfficeFloor(body.floor)) throw invalid();
        const activity = text(body.activity, 160, true);
        this.mutation(member.id, () => this.sql.exec('UPDATE office_members SET floor=COALESCE(?,floor),zone=?,presence_status=?,activity=?,last_seen_at=?,updated_at=? WHERE id=?', body.floor ?? null, body.zone, body.status, activity, this.now(), now, member.id));
        return response({ member: publicMember(this.assertApproved(member.id), this.now()) });
      }
      if (path === '/api/office/messages') {
        fields(body, ['text']); const message = text(body.text, 500), id = crypto.randomUUID();
        this.mutation(member.id, () => {
          this.limit('message:' + member.id, 10);
          this.sql.exec('INSERT INTO office_messages (id,member_id,text,created_at) VALUES (?,?,?,?)', id, member.id, message, now);
          this.sql.exec('DELETE FROM office_messages WHERE rowid NOT IN (SELECT rowid FROM office_messages ORDER BY rowid DESC LIMIT 500)');
        });
        return response({ message: { id, memberId: member.id, text: message, createdAt: now } }, 201);
      }
      if (path === '/api/office/tasks') {
        fields(body, ['title', 'description']); const title = text(body.title, 100), description = text(body.description, 1000, true), id = crypto.randomUUID();
        this.mutation(member.id, () => {
          this.limit('task-create:' + member.id, 5, 3600000);
          if (this.sql.exec("SELECT COUNT(*) AS n FROM office_tasks t JOIN office_members m ON m.id=t.created_by WHERE t.status!='completed' AND m.admission_status='approved'").one().n >= 100) throw new ApiError(409, 'office_task_limit', '工作看板暫時已滿，請先完成手上的工作。');
          this.sql.exec("INSERT INTO office_tasks (id,title,description,status,created_by,created_at,updated_at) VALUES (?,?,?,'open',?,?,?)", id, title, description, member.id, now, now);
          this.sql.exec("DELETE FROM office_tasks WHERE status='completed' AND rowid NOT IN (SELECT rowid FROM office_tasks ORDER BY rowid DESC LIMIT 500)");
          this.event('task-created', member.id, title);
        });
        return response({ task: task(this.sql.exec('SELECT * FROM office_tasks WHERE id = ?', id).one()) }, 201);
      }
      const match = /^\/api\/office\/tasks\/([^/]+)\/(claim|complete)$/.exec(path);
      if (match) {
        if (!UUID.test(match[1])) throw invalid();
        fields(body, match[2] === 'complete' ? ['result'] : []);
        const result = match[2] === 'complete' ? text(body.result, 1000, true) : '';
        this.mutation(member.id, () => {
          const row = this.sql.exec("SELECT t.* FROM office_tasks t JOIN office_members m ON m.id=t.created_by WHERE t.id=? AND m.admission_status='approved'", match[1]).toArray()[0];
          if (!row) throw new ApiError(404, 'office_task_missing', '找不到這項工作。');
          if (match[2] === 'claim') {
            if (row.status === 'claimed' && row.assignee_id === member.id) return;
            if (row.status !== 'open') throw new ApiError(409, 'office_task_taken', '這項工作已有人認領或已完成。');
            this.sql.exec("UPDATE office_tasks SET status='claimed',assignee_id=?,updated_at=? WHERE id=?", member.id, now, row.id);
            this.sql.exec("UPDATE office_members SET floor=department_floor,zone='studio',presence_status='working',activity=?,last_seen_at=?,updated_at=? WHERE id=?", `正在處理：${row.title}`, this.now(), now, member.id);
            this.event('task-claimed', member.id, row.title);
          } else {
            if (row.assignee_id !== member.id) throw new ApiError(403, 'office_task_owner', '只有認領工作的人能回報完成。');
            if (row.status === 'completed' && row.result === result) return;
            if (row.status !== 'claimed') throw new ApiError(409, 'office_task_state', '請先認領這項工作。');
            this.sql.exec("UPDATE office_tasks SET status='completed',result=?,updated_at=? WHERE id=?", result, now, row.id);
            this.sql.exec("UPDATE office_members SET floor=7,zone='focus',presence_status='idle',activity=?,last_seen_at=?,updated_at=? WHERE id=?", `已交付：${row.title}`, this.now(), now, member.id);
            this.event('task-completed', member.id, row.title);
          }
        });
        return response({ task: task(this.sql.exec('SELECT * FROM office_tasks WHERE id=?', match[1]).one()) });
      }
      throw new ApiError(404, 'office_not_found', '找不到這個辦公室端點。');
    } catch (error) {
      const failed = errorResponse(error), headers = new Headers(failed.headers);
      for (const [name, value] of Object.entries(privateHeaders)) headers.set(name, value);
      if (failed.status === 429 && Number.isSafeInteger(error.retryAfter)) headers.set('Retry-After', String(error.retryAfter));
      return new Response(failed.body, { status: failed.status, headers });
    }
  }
}
