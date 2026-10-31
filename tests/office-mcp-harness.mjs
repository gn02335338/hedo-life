import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { OfficeStore } from '../worker/office.js';
import { AdminPrivateStore } from '../worker/admin-private.js';
import * as http from '../worker/http.js';
import { FeedbackStore } from '../worker/feedback-store.js';
import { AchievementStore } from '../worker/achievements.js';
import { CharacterStore } from '../worker/characters.js';
import { ObservationStore } from '../worker/observations.js';
import { validateFeedback, validatePublisherToken } from '../worker/feedback.js';
import { replayRun, VERSION, MAX_TURNS } from '../dist/engine.js';
import { ROLE_MAP } from '../dist/roles.js';
import { ENDINGS } from '../dist/endings.js';

export const officeToken = () => randomBytes(32).toString('hex');
export const initialization = protocolVersion => ({ jsonrpc: '2.0', id: 0, method: 'initialize', params: { protocolVersion, capabilities: {}, clientInfo: { name: 'synthetic-test-client', version: '1.0.0' } } });
export function mcpHarness(t) {
  const db = new DatabaseSync(':memory:'); t.after(() => db.close());
  const sql = { exec(query, ...values) {
    let rows = []; if (!values.length && query.includes(';')) db.exec(query);
    else { const statement = db.prepare(query); if (statement.columns().length) rows = statement.all(...values); else statement.run(...values); }
    return { toArray: () => rows, one: () => { assert.equal(rows.length, 1); return rows[0]; } };
  } };
  const storage = { sql, transactionSync(fn) { db.exec('BEGIN'); try { const result = fn(); db.exec('COMMIT'); return result; } catch (error) { db.exec('ROLLBACK'); throw error; } }, async getAlarm() { return null; }, async setAlarm() {} };
  const password = 'synthetic-mcp-administrator-password', salt = randomBytes(16);
  const env = { ADMIN_PASSWORD_VERIFIER: JSON.stringify({ v: 1, iterations: 100000, salt: salt.toString('hex'), hash: pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex') }) };
  const source = readFileSync(new URL('../worker/index.js', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '').replace('export class HedoArchive', 'globalThis.HedoArchive=class HedoArchive').replace('export default', 'globalThis.worker=');
  const scope = vm.createContext({ DurableObject: class { constructor(ctx) { this.ctx = ctx; } }, OfficeStore, AdminPrivateStore, ...http,
    replayRun, VERSION, MAX_TURNS, ROLE_MAP, ENDINGS, validateFeedback, validatePublisherToken, FeedbackStore, AchievementStore, CharacterStore, ObservationStore, crypto, Response, Request, URL, Date });
  vm.runInContext(source, scope); const create = () => new scope.HedoArchive({ storage, blockConcurrencyWhile: fn => fn() }, env); let archive = create();
  const call = (path, { method = 'GET', body, raw, bearer, origin = null, site, extra = {} } = {}) => {
    const headers = { ...(body !== undefined || raw !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(bearer ? { Authorization: 'Bearer ' + bearer } : {}), ...(origin === null ? {} : { Origin: origin }), ...(site ? { 'Sec-Fetch-Site': site } : {}), ...extra };
    return archive.fetch(new Request('https://office.example' + path, { method, headers, ...(raw !== undefined || body !== undefined ? { body: raw ?? JSON.stringify(body) } : {}) }));
  };
  const mcp = (body, bearer, options = {}) => call('/api/office/mcp', { method: 'POST', body, bearer, ...options, extra: { Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-11-25', ...(options.extra || {}) } });
  const tool = (name, args, bearer, options = {}) => mcp({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name, arguments: args } }, bearer, options);
  const login = async () => {
    const response = await call('/api/admin/login', { method: 'POST', origin: 'https://office.example', body: { password }, extra: { 'X-Admin-Intent': 'private-archive' } }); assert.equal(response.status, 200);
    return { Cookie: response.headers.get('Set-Cookie').split(';')[0], 'X-CSRF-Token': (await response.json()).csrfToken };
  };
  const review = (id, decision, auth) => call('/api/office/admin/applications/' + id, { method: 'POST', body: { decision }, origin: 'https://office.example', extra: auth });
  const apply = async (bearer = officeToken(), fields = {}) => {
    const payload = { token: bearer, kind: 'agent', name: 'Synthetic member', role: 'Research', intro: 'Independent test agent', contact: 'private-contact@example.test', departmentFloor: 6, ...fields };
    const response = await call('/api/office/apply', { method: 'POST', body: payload }); assert.equal(response.status, 202);
    return { token: bearer, application: (await response.json()).application, payload };
  };
  const approve = async (member, auth) => { const result = await review(member.application.id, 'approved', auth || await login()); assert.equal(result.status, 200); };
  return { sql, call, mcp, tool, login, apply, approve, review, reopen() { archive = create(); } };
}
