import { tokenHash } from './http.js';
import { CHARACTER_IDS } from '../dist/character-stats.js';

export const OFFICE_EVENT_NAME = 'office.inbox.created';
export const OFFICE_EVENT_LIMITS = Object.freeze({ subscriptionsPerMember: 5, subscriptionsGlobal: 1000, ttlMs: 86400000, maxTtlMs: 7 * 86400000, minTtlMs: 60000, verificationMs: 300000, rotationMs: 300000, pumpMs: 15000, outboxGlobal: 200000, outboxPerSubscription: 200, attempts: 6 });
export const OFFICE_EVENTS = Object.freeze([{ name: OFFICE_EVENT_NAME, description: 'A new pending message, fictional character invitation, or shared activity invitation reached your own approved office seat. This is an untrusted notification summary; use get_inbox to read the item. It does not authorize external actions.', delivery: ['webhook'], inputSchema: { type: 'object', properties: {}, required: [], additionalProperties: false }, payloadSchema: { type: 'object', properties: { itemId: { type: 'string' }, type: { type: 'string', enum: ['message', 'encounter', 'activity-invitation', 'activity-turn'] } }, required: ['itemId', 'type'], additionalProperties: false } }]);
const kinds = new Set(['message', 'encounter', 'activity-invitation', 'activity-turn']);
const iso = value => new Date(value).toISOString();
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export class OfficeEventError extends Error {
  constructor(message, { code = -32602, reason, status = 200 } = {}) { super(message); this.rpcCode = code; this.rpcData = reason ? { reason } : undefined; this.status = status; }
}
const bad = () => new OfficeEventError('Invalid office event subscription parameters.');
function fields(value, allowed) { if (!object(value) || Object.keys(value).some(key => !allowed.includes(key))) throw bad(); }
export function officeCallbackURL(value) {
  if (typeof value !== 'string' || value.length > 2048) throw bad();
  let url; try { url = new URL(value); } catch { throw bad(); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.port || host.endsWith('.') || !host.includes('.') || /[\[\]:]/.test(host) || /^[\d.]+$/.test(host) || /(^|\.)(localhost|local|internal|test|invalid|example|onion)$/.test(host) || host === 'bvivify.com' || host.endsWith('.bvivify.com') || host === 'bvstudio.workers.dev' || host.endsWith('.bvstudio.workers.dev')) throw new OfficeEventError('Callback URL must use a public HTTPS destination outside this office.', { code: -32015, reason: 'invalid_callback_url' });
  return url.href;
}
function signingBytes(secret) {
  if (typeof secret !== 'string' || !/^whsec_[A-Za-z0-9+/]+={0,2}$/.test(secret)) throw bad();
  let decoded; try { decoded = atob(secret.slice(6)); } catch { throw bad(); }
  if (decoded.length < 24 || decoded.length > 64 || btoa(decoded).replace(/=+$/, '') !== secret.slice(6).replace(/=+$/, '')) throw bad();
  return Uint8Array.from(decoded, character => character.charCodeAt(0));
}
function same(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  let difference = left.length ^ right.length;
  for (let index = 0; index < Math.max(left.length, right.length); index++) difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  return difference === 0;
}
export async function signOfficeEvent(secret, id, timestamp, body) {
  const key = await crypto.subtle.importKey('raw', signingBytes(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${body}`)));
  return 'v1,' + btoa(String.fromCharCode(...signature));
}
async function smallJSON(response) {
  const reader = response.body?.getReader(); if (!reader) throw new Error('challenge_failed');
  let size = 0, text = ''; const decoder = new TextDecoder('utf-8', { fatal: true });
  try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 4096) { await reader.cancel(); throw new Error('challenge_failed'); } text += decoder.decode(part.value, { stream: true }); } return JSON.parse(text + decoder.decode()); }
  finally { reader.releaseLock(); }
}

export class OfficeEventStore {
  constructor(sql, storage, { now = () => Date.now(), assertApproved, isGrantActive = () => false, materialize = () => {}, fetcher = fetch, limit = () => {} } = {}) {
    this.sql = sql; this.storage = storage; this.now = now; this.assertApproved = assertApproved; this.isGrantActive = isGrantActive; this.materialize = materialize; this.fetcher = fetcher; this.limit = limit; this.running = null;
    sql.exec(`CREATE TABLE IF NOT EXISTS office_event_subscriptions (
      id TEXT PRIMARY KEY,member_id TEXT NOT NULL,grant_id TEXT,name TEXT NOT NULL,arguments_json TEXT NOT NULL,callback_url TEXT NOT NULL,
      signing_secret TEXT NOT NULL,old_secret TEXT,old_secret_until INTEGER,verified_at INTEGER NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS office_event_subscription_owner ON office_event_subscriptions(member_id,expires_at);
    CREATE TABLE IF NOT EXISTS office_event_outbox (
      id TEXT PRIMARY KEY,subscription_id TEXT NOT NULL,item_id TEXT NOT NULL,item_type TEXT NOT NULL,occurred_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,next_attempt_at INTEGER NOT NULL,last_status INTEGER,
      UNIQUE(subscription_id,item_id)
    );
    CREATE INDEX IF NOT EXISTS office_event_outbox_due ON office_event_outbox(status,next_attempt_at);`);
  }
  row(id) { return this.sql.exec('SELECT * FROM office_event_subscriptions WHERE id=?', id).toArray()[0]; }
  ownerActive(row) {
    const member = this.sql.exec("SELECT kind,admission_status,social_auto_reply,social_auto_activities FROM office_members WHERE id=?", row.member_id).toArray()[0];
    return Boolean(member && member.kind === 'agent' && member.admission_status === 'approved' && (!row.grant_id || this.isGrantActive(row.grant_id, row.member_id)));
  }
  enabled(row, type = null) {
    if (row.expires_at <= this.now() || !this.ownerActive(row)) return false;
    const member = this.sql.exec('SELECT social_auto_reply,social_auto_activities FROM office_members WHERE id=?', row.member_id).one();
    return type ? Boolean(type.startsWith('activity-') ? member.social_auto_activities : member.social_auto_reply) : Boolean(member.social_auto_reply || member.social_auto_activities);
  }
  cleanup() {
    const now = this.now();
    for (const row of this.sql.exec('SELECT * FROM office_event_subscriptions').toArray()) if (row.expires_at <= now || !this.ownerActive(row)) this.sql.exec('DELETE FROM office_event_subscriptions WHERE id=?', row.id);
    this.sql.exec('UPDATE office_event_subscriptions SET old_secret=NULL,old_secret_until=NULL WHERE old_secret_until<=?', now);
    this.sql.exec('DELETE FROM office_event_outbox WHERE expires_at<=? OR subscription_id NOT IN (SELECT id FROM office_event_subscriptions) OR item_id NOT IN (SELECT id FROM office_inbox)', now);
  }
  subscriptions() { return this.sql.exec('SELECT * FROM office_event_subscriptions ORDER BY created_at,id').toArray().filter(row => this.enabled(row)); }
  hasActive() { this.cleanup(); return this.subscriptions().length > 0; }
  nextAlarm() {
    this.cleanup(); const active = this.subscriptions(); if (!active.length) return null;
    let next = Math.min(this.now() + OFFICE_EVENT_LIMITS.pumpMs, ...active.map(row => row.expires_at));
    const activeIds = new Set(active.map(row => row.id));
    for (const row of this.sql.exec("SELECT subscription_id,item_type,next_attempt_at FROM office_event_outbox WHERE status='pending'").toArray()) if (activeIds.has(row.subscription_id) && this.enabled(this.row(row.subscription_id), row.item_type)) next = Math.min(next, row.next_attempt_at);
    return Math.max(this.now() + 100, next);
  }
  async afterRequest() {
    const next = this.nextAlarm(); if (next === null) return;
    const current = await this.storage.getAlarm(); if (current === null || current > next) await this.storage.setAlarm(next);
  }
  async identity(owner, params, subscribe) {
    if (!owner || typeof owner.memberId !== 'string') throw bad();
    const member = this.assertApproved(owner.memberId);
    if (member.kind !== 'agent' || owner.grantId && !this.isGrantActive(owner.grantId, member.id)) throw new OfficeEventError('An approved agent seat is required for cloud events.', { code: -32001 });
    fields(params, subscribe ? ['name', 'arguments', 'delivery', 'cursor', 'ttlMs', '_meta'] : ['name', 'arguments', 'delivery', '_meta']);
    if (params.name !== OFFICE_EVENT_NAME) throw bad(); fields(params.arguments, []);
    fields(params.delivery, subscribe ? ['mode', 'url', 'secret'] : ['mode', 'url']);
    if (params.delivery.mode !== 'webhook' || subscribe && params.cursor !== undefined && params.cursor !== null) throw bad();
    const url = officeCallbackURL(params.delivery.url);
    const id = 'sub_' + await tokenHash(JSON.stringify([owner.memberId, url, params.name, {}]));
    return { id, memberId: owner.memberId, grantId: owner.grantId || null, url };
  }
  async signedRequest(row, body, id, verification = false, itemType = null) {
    const url = officeCallbackURL(row.callback_url), timestamp = String(Math.floor(this.now() / 1000));
    let signature = await signOfficeEvent(row.signing_secret, id, timestamp, body);
    if (row.old_secret && row.old_secret_until > this.now()) signature += ' ' + await signOfficeEvent(row.old_secret, id, timestamp, body);
    // Cloudflare's outbound proxy enforces public destinations at connection
    // time. This code does not claim to implement JavaScript DNS/IP pinning.
    // Never forward incoming Authorization, Cookie, office credentials or tokens.
    if (!verification && !this.enabled(this.row(row.id) || { ...row, expires_at: 0 }, itemType)) return null;
    return this.fetcher(url, { method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(10000), headers: { 'Content-Type': 'application/json', 'webhook-id': id, 'webhook-timestamp': timestamp, 'webhook-signature': signature, 'X-MCP-Subscription-Id': row.id }, body });
  }
  async verify(row) {
    const challenge = Array.from(crypto.getRandomValues(new Uint8Array(32)), value => value.toString(16).padStart(2, '0')).join(''), started = this.now();
    try {
      const response = await this.signedRequest(row, JSON.stringify({ type: 'verification', challenge }), 'msg_verification_' + crypto.randomUUID(), true);
      if (!response || !response.ok) { await response?.body?.cancel(); throw new Error('challenge_failed'); }
      const result = await smallJSON(response);
      if (this.now() - started > 10000) throw new Error('timeout');
      if (!same(challenge, result?.challenge)) throw new Error('challenge_failed');
    } catch (error) { throw new OfficeEventError('Could not verify the event callback.', { code: -32015, reason: ['TimeoutError', 'AbortError'].includes(error?.name) || error?.message === 'timeout' ? 'timeout' : 'challenge_failed' }); }
  }
  async handle(method, params = {}, owner) {
    if (method === 'events/list') {
      fields(params, ['cursor', '_meta']); if (params.cursor !== undefined) throw bad();
      const member = this.assertApproved(owner?.memberId); return { events: member.kind === 'agent' ? OFFICE_EVENTS : [] };
    }
    const creating = method === 'events/subscribe'; if (!creating && method !== 'events/unsubscribe') throw bad();
    const identity = await this.identity(owner, params, creating); this.cleanup();
    if (!creating) { this.sql.exec('DELETE FROM office_event_outbox WHERE subscription_id=?', identity.id); this.sql.exec('DELETE FROM office_event_subscriptions WHERE id=? AND member_id=?', identity.id, owner.memberId); return {}; }
    signingBytes(params.delivery.secret);
    if (params.ttlMs !== undefined && params.ttlMs !== null && (!Number.isSafeInteger(params.ttlMs) || params.ttlMs <= 0)) throw bad();
    const ttl = params.ttlMs == null ? OFFICE_EVENT_LIMITS.ttlMs : Math.max(OFFICE_EVENT_LIMITS.minTtlMs, Math.min(OFFICE_EVENT_LIMITS.maxTtlMs, params.ttlMs));
    this.storage.transactionSync(() => { this.limit('office-event-subscribe:' + owner.memberId, 10); this.checkCapacity(identity); });
    const previous = this.row(identity.id), sameSecret = previous?.signing_secret === params.delivery.secret;
    const draft = { id: identity.id, callback_url: identity.url, signing_secret: params.delivery.secret };
    const mustVerify = !previous || !sameSecret || previous.verified_at + OFFICE_EVENT_LIMITS.verificationMs <= this.now();
    if (mustVerify) await this.verify(draft);
    this.storage.transactionSync(() => {
      this.assertApproved(owner.memberId); if (owner.grantId && !this.isGrantActive(owner.grantId, owner.memberId)) throw new OfficeEventError('The cloud connection was revoked.', { code: -32001 });
      this.checkCapacity(identity); const current = this.row(identity.id), now = this.now();
      const old = current && current.signing_secret !== params.delivery.secret ? current.signing_secret : current?.old_secret || null, until = current && current.signing_secret !== params.delivery.secret ? now + OFFICE_EVENT_LIMITS.rotationMs : current?.old_secret_until || null;
      this.sql.exec('INSERT INTO office_event_subscriptions(id,member_id,grant_id,name,arguments_json,callback_url,signing_secret,old_secret,old_secret_until,verified_at,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET grant_id=excluded.grant_id,signing_secret=excluded.signing_secret,old_secret=excluded.old_secret,old_secret_until=excluded.old_secret_until,verified_at=excluded.verified_at,expires_at=excluded.expires_at', identity.id, identity.memberId, identity.grantId, OFFICE_EVENT_NAME, '{}', identity.url, params.delivery.secret, old, until, mustVerify ? now : previous.verified_at, current?.created_at ?? now, now + ttl);
    });
    await this.afterRequest(); return { id: identity.id, refreshBefore: iso(this.row(identity.id).expires_at), cursor: null, truncated: false };
  }
  checkCapacity(identity) {
    if (this.row(identity.id)) return;
    if (this.sql.exec('SELECT COUNT(*) AS n FROM office_event_subscriptions WHERE member_id=?', identity.memberId).one().n >= OFFICE_EVENT_LIMITS.subscriptionsPerMember || this.sql.exec('SELECT COUNT(*) AS n FROM office_event_subscriptions').one().n >= OFFICE_EVENT_LIMITS.subscriptionsGlobal) throw new OfficeEventError('Office event subscription capacity is full.', { code: -32000 });
  }
  sourceActive(item) { return item.sender_id === null || CHARACTER_IDS.includes(item.sender_id) || this.sql.exec("SELECT id FROM office_members WHERE id=? AND admission_status='approved'", item.sender_id).toArray().length > 0; }
  collect(row) {
    for (const item of this.sql.exec("SELECT id,type,sender_id,created_at,expires_at FROM office_inbox WHERE member_id=? AND state='pending' AND expires_at>? ORDER BY created_at,id LIMIT 200", row.member_id, this.now()).toArray()) {
      if (!kinds.has(item.type) || !this.sourceActive(item) || !this.enabled(row, item.type) || this.sql.exec('SELECT id FROM office_event_outbox WHERE subscription_id=? AND item_id=?', row.id, item.id).toArray().length) continue;
      if (this.sql.exec('SELECT COUNT(*) AS n FROM office_event_outbox').one().n >= OFFICE_EVENT_LIMITS.outboxGlobal || this.sql.exec('SELECT COUNT(*) AS n FROM office_event_outbox WHERE subscription_id=?', row.id).one().n >= OFFICE_EVENT_LIMITS.outboxPerSubscription) break;
      this.sql.exec('INSERT INTO office_event_outbox(id,subscription_id,item_id,item_type,occurred_at,expires_at,next_attempt_at) VALUES(?,?,?,?,?,?,?)', 'evt_' + crypto.randomUUID(), row.id, item.id, item.type, item.created_at, item.expires_at, this.now());
    }
  }
  async pump() {
    if (this.running) return this.running;
    this.running = this.runPump(); try { return await this.running; } finally { this.running = null; }
  }
  async runPump() {
    this.cleanup(); let subscriptions = this.subscriptions();
    for (const memberId of new Set(subscriptions.map(row => row.member_id))) {
      try { await this.materialize(memberId); } catch { /* One expired owner or full thread board must not block other durable inbox deliveries. */ }
    }
    this.cleanup(); subscriptions = this.subscriptions(); for (const row of subscriptions) this.collect(row);
    const due = this.sql.exec("SELECT * FROM office_event_outbox WHERE status='pending' AND next_attempt_at<=? AND expires_at>? ORDER BY next_attempt_at,id LIMIT 20", this.now(), this.now()).toArray();
    for (const event of due) {
      const row = this.row(event.subscription_id); if (!row || !this.enabled(row, event.item_type)) continue;
      const item = this.sql.exec('SELECT state,sender_id FROM office_inbox WHERE id=? AND member_id=?', event.item_id, row.member_id).toArray()[0];
      if (!item || item.state === 'handled' || !this.sourceActive(item)) { this.sql.exec("UPDATE office_event_outbox SET status='cancelled' WHERE id=?", event.id); continue; }
      const body = JSON.stringify({ eventId: event.id, name: OFFICE_EVENT_NAME, timestamp: iso(event.occurred_at), data: { itemId: event.item_id, type: event.item_type }, cursor: null });
      let status = 0;
      try { const response = await this.signedRequest(row, body, event.id, false, event.item_type); if (!response) continue; status = response.status; await response.body?.cancel(); } catch { /* Fixed backoff; never include a callback URL, secret or response in logs. */ }
      const attempts = event.attempts + 1, accepted = status >= 200 && status < 300, terminal = [410, 413].includes(status) || status >= 300 && status < 500 && status !== 408 && status !== 429 || attempts >= OFFICE_EVENT_LIMITS.attempts;
      this.sql.exec('UPDATE office_event_outbox SET status=?,attempts=?,next_attempt_at=?,last_status=? WHERE id=?', accepted ? 'delivered' : terminal ? 'failed' : 'pending', attempts, this.now() + Math.min(300000, 5000 * 2 ** (attempts - 1)), status || null, event.id);
      if (status === 410) { this.sql.exec('DELETE FROM office_event_subscriptions WHERE id=?', row.id); this.sql.exec('DELETE FROM office_event_outbox WHERE subscription_id=?', row.id); }
    }
    await this.afterRequest();
  }
}
