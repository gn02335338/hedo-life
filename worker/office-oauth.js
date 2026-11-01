import { ApiError, tokenHash } from './http.js';

export const OFFICE_OAUTH_SCOPE = 'office';
export const OFFICE_OAUTH_LIMITS = Object.freeze({ clients: 1000, grantsPerMember: 10, requests: 5000, requestsPerClient: 100, requestMs: 300000, codeMs: 120000, accessMs: 3600000, refreshMs: 2592000000, refreshHistory: 32 });
const HEX = /^[a-f0-9]{64}$/i;
const CHALLENGE = /^[A-Za-z0-9_-]{43}$/;
const VERIFIER = /^[A-Za-z0-9._~-]{43,128}$/;
const UUID = /^[a-f0-9-]{36}$/i;
const fail = (code = 'invalid_request', message = '授權資料無效，請重新開始連線。', status = 400) => new ApiError(status, code, message);
const secret = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
const rows = (sql, query, ...values) => sql.exec(query, ...values).toArray();
const iso = value => new Date(value).toISOString();
const localhost = host => ['localhost', '127.0.0.1', '[::1]'].includes(host);
function originUrl(baseUrl) {
  const url = new URL(baseUrl);
  if (url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && localhost(url.hostname)))) throw fail('invalid_request', '授權伺服器網址無效。');
  return url.origin;
}
function object(value) { if (!value || typeof value !== 'object' || Array.isArray(value)) throw fail(); return value; }
function params(input) {
  if (input instanceof URLSearchParams) {
    const result = {};
    for (const [key, value] of input) { if (Object.hasOwn(result, key)) throw fail(); result[key] = value; }
    return result;
  }
  return object(input);
}
function scope(value = OFFICE_OAUTH_SCOPE) { if (value !== OFFICE_OAUTH_SCOPE) throw fail('invalid_scope', '這個連線僅支援 office 權限。'); return value; }
function resource(value, baseUrl) {
  const expected = `${originUrl(baseUrl)}/api/office/mcp`;
  // MCP resource indicators are mandatory and bind tokens to this exact server.
  if (value !== expected) throw fail('invalid_target', '請指定這個辦公室的 MCP resource 網址。');
  return expected;
}
function redirect(value, baseUrl) {
  if (typeof value !== 'string' || value.length > 2048 || /[\u0000-\u0020\u007f]/u.test(value)) throw fail('invalid_redirect_uri');
  let url; try { url = new URL(value); } catch { throw fail('invalid_redirect_uri'); }
  if (url.username || url.password || url.hash || value.includes('#') || (url.protocol !== 'https:' && !(url.protocol === 'http:' && localhost(url.hostname) && localhost(new URL(baseUrl).hostname)))) throw fail('invalid_redirect_uri', '回呼網址必須是沒有帳密與 fragment 的 HTTPS 網址。');
  return value;
}
function assertOrigin(origin, baseUrl) { if (origin !== originUrl(baseUrl)) throw fail('access_denied', '請從移動辦公室授權頁送出同意。', 403); }

export class OfficeOAuthStore {
  constructor(sql, storage, { now = () => Date.now(), assertApproved, event } = {}) {
    this.sql = sql; this.storage = storage; this.now = now; this.assertApproved = assertApproved; this.event = event;
    sql.exec(`CREATE TABLE IF NOT EXISTS office_oauth_clients (
      id TEXT PRIMARY KEY,name TEXT NOT NULL,redirects_json TEXT NOT NULL,created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS office_oauth_requests (
      id_hash TEXT PRIMARY KEY,client_id TEXT NOT NULL,redirect_uri TEXT NOT NULL,challenge TEXT NOT NULL,scope TEXT NOT NULL,resource TEXT NOT NULL,state TEXT,csrf_hash TEXT,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,used_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS office_oauth_codes (
      code_hash TEXT PRIMARY KEY,grant_id TEXT NOT NULL,client_id TEXT NOT NULL,redirect_uri TEXT NOT NULL,challenge TEXT NOT NULL,scope TEXT NOT NULL,resource TEXT NOT NULL,expires_at INTEGER NOT NULL,used_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS office_oauth_grants (
      id TEXT PRIMARY KEY,member_id TEXT NOT NULL,client_id TEXT NOT NULL,scope TEXT NOT NULL,resource TEXT NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,revoked_at INTEGER,last_used_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS office_oauth_access (
      token_hash TEXT PRIMARY KEY,grant_id TEXT NOT NULL UNIQUE,expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS office_oauth_refresh (
      token_hash TEXT PRIMARY KEY,grant_id TEXT NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,used_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS office_oauth_request_expiry ON office_oauth_requests(expires_at);
    CREATE INDEX IF NOT EXISTS office_oauth_grant_member ON office_oauth_grants(member_id,revoked_at);
    CREATE INDEX IF NOT EXISTS office_oauth_refresh_grant ON office_oauth_refresh(grant_id,created_at DESC);`);
  }
  metadata(baseUrl) {
    const issuer = `${originUrl(baseUrl)}/api/office/oauth`;
    return { issuer, authorization_endpoint: `${issuer}/authorize`, token_endpoint: `${issuer}/token`, registration_endpoint: `${issuer}/register`, revocation_endpoint: `${issuer}/revoke`, response_types_supported: ['code'], grant_types_supported: ['authorization_code', 'refresh_token'], token_endpoint_auth_methods_supported: ['none'], code_challenge_methods_supported: ['S256'], scopes_supported: [OFFICE_OAUTH_SCOPE], authorization_response_iss_parameter_supported: true };
  }
  prune() {
    const now = this.now();
    this.sql.exec('DELETE FROM office_oauth_requests WHERE expires_at<=?', now);
    this.sql.exec('DELETE FROM office_oauth_codes WHERE expires_at<=? OR grant_id NOT IN (SELECT id FROM office_oauth_grants)', now);
    this.sql.exec('DELETE FROM office_oauth_grants WHERE expires_at<=?', now);
    this.sql.exec('DELETE FROM office_oauth_access WHERE expires_at<=? OR grant_id NOT IN (SELECT id FROM office_oauth_grants)', now);
    this.sql.exec('DELETE FROM office_oauth_refresh WHERE expires_at<=? OR grant_id NOT IN (SELECT id FROM office_oauth_grants)', now);
  }
  client(id) {
    if (typeof id !== 'string' || !UUID.test(id)) throw fail('invalid_client');
    const client = rows(this.sql, 'SELECT * FROM office_oauth_clients WHERE id=?', id)[0];
    if (!client) throw fail('invalid_client');
    return client;
  }
  member(id) {
    const row = rows(this.sql, "SELECT * FROM office_members WHERE id=? AND kind='agent' AND admission_status='approved'", id)[0];
    if (!row) throw fail('access_denied', '只有審核通過的 Agent 席位可以連接雲端。', 403);
    this.assertApproved?.(id);
    return row;
  }
  register(input, baseUrl) {
    const body = object(input), name = body.client_name ?? '雲端 Agent';
    if (typeof name !== 'string' || !name.trim() || name.length > 80 || /[\u0000-\u001f\u007f]/u.test(name) || !Array.isArray(body.redirect_uris) || body.redirect_uris.length < 1 || body.redirect_uris.length > 10) throw fail('invalid_client_metadata');
    const redirects = [...new Set(body.redirect_uris.map(value => redirect(value, baseUrl)))];
    if ((body.token_endpoint_auth_method ?? 'none') !== 'none' || (body.grant_types !== undefined && (!Array.isArray(body.grant_types) || !body.grant_types.includes('authorization_code') || body.grant_types.some(value => !['authorization_code', 'refresh_token'].includes(value)))) || (body.response_types !== undefined && (!Array.isArray(body.response_types) || body.response_types.length !== 1 || body.response_types[0] !== 'code'))) throw fail('invalid_client_metadata');
    scope(body.scope);
    return this.storage.transactionSync(() => {
      this.prune();
      if (rows(this.sql, 'SELECT COUNT(*) AS n FROM office_oauth_clients')[0].n >= OFFICE_OAUTH_LIMITS.clients) throw fail('temporarily_unavailable', '連線程式註冊已達上限，請聯絡辦公室管理員。', 429);
      const id = crypto.randomUUID(), now = this.now();
      this.sql.exec('INSERT INTO office_oauth_clients(id,name,redirects_json,created_at) VALUES(?,?,?,?)', id, name.trim(), JSON.stringify(redirects), now);
      return { client_id: id, client_id_issued_at: Math.floor(now / 1000), client_name: name.trim(), redirect_uris: redirects, token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], scope: OFFICE_OAUTH_SCOPE };
    });
  }
  async authorizationRequest(input, baseUrl) {
    const query = params(input), client = this.client(query.client_id), redirectUri = redirect(query.redirect_uri, baseUrl);
    if (!JSON.parse(client.redirects_json).includes(redirectUri)) throw fail('invalid_redirect_uri');
    if (query.response_type !== 'code' || query.code_challenge_method !== 'S256' || typeof query.code_challenge !== 'string' || !CHALLENGE.test(query.code_challenge) || (query.state !== undefined && (typeof query.state !== 'string' || query.state.length > 2048)) || (query.response_mode !== undefined && query.response_mode !== 'query')) throw fail();
    const requestedScope = scope(query.scope), requestedResource = resource(query.resource, baseUrl), requestId = secret(), hash = await tokenHash(requestId);
    return this.storage.transactionSync(() => {
      this.prune();
      if (rows(this.sql, 'SELECT COUNT(*) AS n FROM office_oauth_requests')[0].n >= OFFICE_OAUTH_LIMITS.requests || rows(this.sql, 'SELECT COUNT(*) AS n FROM office_oauth_requests WHERE client_id=?', client.id)[0].n >= OFFICE_OAUTH_LIMITS.requestsPerClient) throw fail('temporarily_unavailable', '授權請求太頻繁，請稍後重試。', 429);
      const now = this.now();
      this.sql.exec('INSERT INTO office_oauth_requests(id_hash,client_id,redirect_uri,challenge,scope,resource,state,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?)', hash, client.id, redirectUri, query.code_challenge, requestedScope, requestedResource, query.state ?? null, now, now + OFFICE_OAUTH_LIMITS.requestMs);
      return { requestId, consentUrl: `${originUrl(baseUrl)}/office/connect/?request_id=${encodeURIComponent(requestId)}` };
    });
  }
  async requestInfo(requestId) {
    if (typeof requestId !== 'string' || !HEX.test(requestId)) throw fail();
    const hash = await tokenHash(requestId.toLowerCase()), csrfToken = secret(), csrfHash = await tokenHash(csrfToken);
    return this.storage.transactionSync(() => {
      this.prune();
      const row = rows(this.sql, 'SELECT * FROM office_oauth_requests WHERE id_hash=? AND used_at IS NULL AND expires_at>?', hash, this.now())[0];
      if (!row) throw fail('invalid_request', '授權請求已失效，請回到雲端 Agent 重新連線。');
      const client = this.client(row.client_id);
      this.sql.exec('UPDATE office_oauth_requests SET csrf_hash=? WHERE id_hash=?', csrfHash, hash);
      return { requestId, csrfToken, clientId: client.id, clientName: client.name, redirectUri: row.redirect_uri, scope: row.scope, resource: row.resource, expiresAt: iso(row.expires_at), permissions: ['讀取公開辦公室與自己的 Agent 席位資料。', '以這個席位回覆訊息、處理任務、更新狀態與外觀。', '依席位的自動互動設定，收邀請、聊天及參加共享活動。'], agentOnly: true };
    });
  }
  async consent(input, { origin, baseUrl } = {}) {
    assertOrigin(origin, baseUrl);
    const body = object(input);
    if (typeof body.requestId !== 'string' || !HEX.test(body.requestId) || typeof body.csrfToken !== 'string' || !HEX.test(body.csrfToken) || typeof body.approve !== 'boolean' || Object.keys(body).some(key => !['requestId', 'csrfToken', 'officeToken', 'approve'].includes(key))) throw fail();
    if (body.approve && (typeof body.officeToken !== 'string' || !HEX.test(body.officeToken))) throw fail('access_denied', '請輸入審核通過的 Agent 席位憑證。', 403);
    const requestHash = await tokenHash(body.requestId.toLowerCase()), csrfHash = await tokenHash(body.csrfToken.toLowerCase());
    const officeHash = body.approve ? await tokenHash(body.officeToken.toLowerCase()) : null;
    const code = secret(), codeHash = await tokenHash(code);
    return this.storage.transactionSync(() => {
      this.prune();
      const request = rows(this.sql, 'SELECT * FROM office_oauth_requests WHERE id_hash=? AND used_at IS NULL AND expires_at>?', requestHash, this.now())[0];
      if (!request || request.csrf_hash !== csrfHash) throw fail('access_denied', '授權頁已失效，請重新開啟連線。', 403);
      const client = this.client(request.client_id);
      if (!JSON.parse(client.redirects_json).includes(request.redirect_uri) || request.resource !== `${originUrl(baseUrl)}/api/office/mcp`) throw fail();
      const target = new URL(request.redirect_uri), now = this.now();
      // Existing query strings are registered exactly; OAuth result parameters
      // are replaced so the redirect contains one unambiguous response.
      for (const name of ['code', 'state', 'error', 'error_description', 'iss']) target.searchParams.delete(name);
      target.searchParams.set('iss', this.metadata(baseUrl).issuer);
      if (request.state !== null) target.searchParams.set('state', request.state);
      if (!body.approve) {
        this.sql.exec('UPDATE office_oauth_requests SET used_at=? WHERE id_hash=?', now, requestHash);
        target.searchParams.set('error', 'access_denied'); return { redirectUrl: target.href };
      }
      const member = rows(this.sql, 'SELECT id FROM office_members WHERE token_hash=?', officeHash)[0];
      if (!member) throw fail('access_denied', 'Agent 憑證無效或尚未通過審核。', 403);
      this.member(member.id);
      // Revoked connections may be replaced; live connections are never evicted.
      this.sql.exec('DELETE FROM office_oauth_grants WHERE member_id=? AND revoked_at IS NOT NULL', member.id);
      this.prune();
      if (rows(this.sql, 'SELECT COUNT(*) AS n FROM office_oauth_grants WHERE member_id=?', member.id)[0].n >= OFFICE_OAUTH_LIMITS.grantsPerMember) throw fail('access_denied', '這個席位已有 10 個雲端連線，請先撤銷舊連線。', 409);
      if (rows(this.sql, 'SELECT COUNT(*) AS n FROM office_oauth_codes')[0].n >= OFFICE_OAUTH_LIMITS.requests) throw fail('temporarily_unavailable', '授權請求太頻繁，請稍後重試。', 429);
      const grantId = crypto.randomUUID();
      this.sql.exec('INSERT INTO office_oauth_grants(id,member_id,client_id,scope,resource,created_at,expires_at) VALUES(?,?,?,?,?,?,?)', grantId, member.id, request.client_id, request.scope, request.resource, now, now + OFFICE_OAUTH_LIMITS.refreshMs);
      this.sql.exec('INSERT INTO office_oauth_codes(code_hash,grant_id,client_id,redirect_uri,challenge,scope,resource,expires_at) VALUES(?,?,?,?,?,?,?,?)', codeHash, grantId, request.client_id, request.redirect_uri, request.challenge, request.scope, request.resource, now + OFFICE_OAUTH_LIMITS.codeMs);
      this.sql.exec('UPDATE office_oauth_requests SET used_at=? WHERE id_hash=?', now, requestHash);
      this.event?.('cloud-connected', member.id, '已同意一個雲端 Agent 連線。');
      target.searchParams.set('code', code); return { redirectUrl: target.href };
    });
  }
  grant(id, clientId, requestedResource) {
    const grant = rows(this.sql, 'SELECT * FROM office_oauth_grants WHERE id=? AND client_id=? AND resource=? AND revoked_at IS NULL AND expires_at>?', id, clientId, requestedResource, this.now())[0];
    if (!grant) throw fail('invalid_grant');
    try { this.member(grant.member_id); } catch { throw fail('invalid_grant'); }
    return grant;
  }
  async token(input, baseUrl) {
    const body = params(input), client = this.client(body.client_id), requestedResource = resource(body.resource, baseUrl);
    if (body.client_secret !== undefined) throw fail('invalid_client');
    if (body.scope !== undefined) scope(body.scope);
    const authorizationCode = body.grant_type === 'authorization_code', refresh = body.grant_type === 'refresh_token';
    if (!authorizationCode && !refresh) throw fail('unsupported_grant_type');
    if (authorizationCode && (typeof body.code !== 'string' || !HEX.test(body.code) || typeof body.code_verifier !== 'string' || !VERIFIER.test(body.code_verifier) || typeof body.redirect_uri !== 'string')) throw fail('invalid_grant');
    if (refresh && (typeof body.refresh_token !== 'string' || !HEX.test(body.refresh_token))) throw fail('invalid_grant');
    const suppliedHash = await tokenHash((authorizationCode ? body.code : body.refresh_token).toLowerCase());
    const challenge = authorizationCode ? btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body.code_verifier))))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : null;
    const accessToken = secret(), refreshToken = secret(), accessHash = await tokenHash(accessToken), refreshHash = await tokenHash(refreshToken);
    const result = this.storage.transactionSync(() => {
      this.prune(); const now = this.now(); let grant;
      if (authorizationCode) {
        const code = rows(this.sql, 'SELECT * FROM office_oauth_codes WHERE code_hash=?', suppliedHash)[0];
        if (!code || code.client_id !== client.id || code.redirect_uri !== body.redirect_uri || code.resource !== requestedResource || code.challenge !== challenge || code.used_at !== null || code.expires_at <= now) throw fail('invalid_grant');
        grant = this.grant(code.grant_id, client.id, requestedResource);
        this.sql.exec('UPDATE office_oauth_codes SET used_at=? WHERE code_hash=?', now, suppliedHash);
      } else {
        const previous = rows(this.sql, 'SELECT * FROM office_oauth_refresh WHERE token_hash=?', suppliedHash)[0];
        if (!previous || previous.expires_at <= now) throw fail('invalid_grant');
        grant = this.grant(previous.grant_id, client.id, requestedResource);
        if (previous.used_at !== null) {
          this.revokeGrant(grant.id); return { error: fail('invalid_grant', '更新憑證已使用，這個雲端連線已撤銷。') };
        }
        this.sql.exec('UPDATE office_oauth_refresh SET used_at=? WHERE token_hash=?', now, suppliedHash);
      }
      this.sql.exec('DELETE FROM office_oauth_access WHERE grant_id=?', grant.id);
      this.sql.exec('INSERT INTO office_oauth_access(token_hash,grant_id,expires_at) VALUES(?,?,?)', accessHash, grant.id, Math.min(now + OFFICE_OAUTH_LIMITS.accessMs, grant.expires_at));
      this.sql.exec('INSERT INTO office_oauth_refresh(token_hash,grant_id,created_at,expires_at) VALUES(?,?,?,?)', refreshHash, grant.id, now, grant.expires_at);
      this.sql.exec('DELETE FROM office_oauth_refresh WHERE grant_id=? AND token_hash NOT IN (SELECT token_hash FROM office_oauth_refresh WHERE grant_id=? ORDER BY created_at DESC,rowid DESC LIMIT ?)', grant.id, grant.id, OFFICE_OAUTH_LIMITS.refreshHistory);
      this.sql.exec('UPDATE office_oauth_grants SET last_used_at=? WHERE id=?', now, grant.id);
      return { access_token: accessToken, token_type: 'Bearer', expires_in: Math.max(1, Math.floor(Math.min(OFFICE_OAUTH_LIMITS.accessMs, grant.expires_at - now) / 1000)), refresh_token: refreshToken, scope: grant.scope };
    });
    if (result.error) throw result.error;
    return result;
  }
  resolveAccessGrant(hash, baseUrl) {
    if (typeof hash !== 'string' || !HEX.test(hash)) return null;
    const row = rows(this.sql, "SELECT g.member_id,g.id,g.resource FROM office_oauth_access a JOIN office_oauth_grants g ON g.id=a.grant_id JOIN office_members m ON m.id=g.member_id WHERE a.token_hash=? AND a.expires_at>? AND g.expires_at>? AND g.revoked_at IS NULL AND m.kind='agent' AND m.admission_status='approved'", hash.toLowerCase(), this.now(), this.now())[0];
    if (row && baseUrl !== undefined && row.resource !== `${originUrl(baseUrl)}/api/office/mcp`) return null;
    return row ? { memberId: row.member_id, grantId: row.id } : null;
  }
  resolveAccessToken(hash, baseUrl) { return this.resolveAccessGrant(hash, baseUrl)?.memberId ?? null; }
  isGrantActive(grantId, memberId) {
    if (typeof grantId !== 'string' || !UUID.test(grantId) || typeof memberId !== 'string') return false;
    return rows(this.sql, "SELECT g.id FROM office_oauth_grants g JOIN office_members m ON m.id=g.member_id WHERE g.id=? AND g.member_id=? AND g.expires_at>? AND g.revoked_at IS NULL AND m.kind='agent' AND m.admission_status='approved'", grantId, memberId, this.now()).length === 1;
  }
  connections(memberId) {
    this.member(memberId);
    return this.storage.transactionSync(() => {
      this.prune();
      return { connections: rows(this.sql, 'SELECT g.*,c.name,c.redirects_json FROM office_oauth_grants g JOIN office_oauth_clients c ON c.id=g.client_id WHERE g.member_id=? ORDER BY g.created_at DESC,g.id LIMIT ?', memberId, OFFICE_OAUTH_LIMITS.grantsPerMember).map(row => ({ id: row.id, clientId: row.client_id, clientName: row.name, redirectUris: JSON.parse(row.redirects_json), scope: row.scope, resource: row.resource, createdAt: iso(row.created_at), expiresAt: iso(row.expires_at), lastUsedAt: row.last_used_at === null ? null : iso(row.last_used_at), revokedAt: row.revoked_at === null ? null : iso(row.revoked_at) })) };
    });
  }
  revokeGrant(id) {
    this.sql.exec('UPDATE office_oauth_grants SET revoked_at=COALESCE(revoked_at,?) WHERE id=?', this.now(), id);
    this.sql.exec('DELETE FROM office_oauth_access WHERE grant_id=?', id);
    this.sql.exec('DELETE FROM office_oauth_refresh WHERE grant_id=?', id);
    this.sql.exec('DELETE FROM office_oauth_codes WHERE grant_id=?', id);
  }
  revoke(memberId, grantId) {
    this.member(memberId);
    if (typeof grantId !== 'string' || !UUID.test(grantId)) throw fail();
    return this.storage.transactionSync(() => {
      if (!rows(this.sql, 'SELECT id FROM office_oauth_grants WHERE id=? AND member_id=?', grantId, memberId).length) throw fail('invalid_request', '找不到這個席位的雲端連線。', 404);
      this.revokeGrant(grantId); return { revoked: true, id: grantId };
    });
  }
  async revokeToken(input, baseUrl) {
    const body = params(input), client = this.client(body.client_id);
    if (typeof body.token !== 'string' || !HEX.test(body.token) || body.client_secret !== undefined) throw fail();
    originUrl(baseUrl); const hash = await tokenHash(body.token.toLowerCase());
    return this.storage.transactionSync(() => {
      const row = rows(this.sql, 'SELECT g.id FROM office_oauth_grants g WHERE g.client_id=? AND (g.id IN (SELECT grant_id FROM office_oauth_access WHERE token_hash=?) OR g.id IN (SELECT grant_id FROM office_oauth_refresh WHERE token_hash=?))', client.id, hash, hash)[0];
      if (row) this.revokeGrant(row.id);
      return {};
    });
  }
}
