import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { OfficeOAuthStore, OFFICE_OAUTH_LIMITS } from '../worker/office-oauth.js';
import { ApiError, tokenHash } from '../worker/http.js';

const BASE = 'https://office.example', RESOURCE = `${BASE}/api/office/mcp`, CALLBACK = 'https://chatgpt.com/connector_platform_oauth_redirect';
const secret = () => randomBytes(32).toString('hex');
const pkce = () => { const verifier = randomBytes(48).toString('base64url'); return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') }; };
const errorCode = (code, status = null) => error => error instanceof ApiError && error.code === code && (status === null || error.status === status);
async function harness(t) {
  const db = new DatabaseSync(':memory:'); t.after(() => db.close()); let clock = 1800000000000, active = false;
  db.exec('CREATE TABLE office_members(id TEXT PRIMARY KEY,token_hash TEXT NOT NULL UNIQUE,kind TEXT NOT NULL,admission_status TEXT NOT NULL,name TEXT NOT NULL);');
  const sql = { exec(query, ...values) { let rows = []; if (!values.length && query.includes(';')) db.exec(query); else { const statement = db.prepare(query); if (statement.columns().length) rows = statement.all(...values); else statement.run(...values); } return { toArray: () => rows, one: () => { assert.equal(rows.length, 1); return rows[0]; } }; } };
  const storage = { transactionSync(fn) { assert.equal(active, false); active = true; db.exec('BEGIN'); try { const result = fn(); db.exec('COMMIT'); return result; } catch (error) { db.exec('ROLLBACK'); throw error; } finally { active = false; } } };
  const members = [];
  for (const [kind, status] of [['agent', 'approved'], ['agent', 'approved'], ['human', 'approved'], ['agent', 'pending']]) {
    const token = secret(), id = randomUUID(); members.push({ id, token, kind, status });
    sql.exec('INSERT INTO office_members(id,token_hash,kind,admission_status,name) VALUES(?,?,?,?,?)', id, await tokenHash(token), kind, status, `Member ${members.length}`);
  }
  const makeStore = () => new OfficeOAuthStore(sql, storage, { now: () => clock, assertApproved: id => { const member = sql.exec("SELECT * FROM office_members WHERE id=? AND admission_status='approved'", id).toArray()[0]; if (!member) throw new ApiError(403, 'office_approval_required', 'not approved'); return member; } });
  let store = makeStore();
  const client = (extra = {}) => store.register({ client_name: 'Test Cloud Agent', redirect_uris: [CALLBACK], ...extra }, BASE);
  const authorize = async (registered = client(), extra = {}) => { const proof = pkce(), query = { client_id: registered.client_id, response_type: 'code', redirect_uri: registered.redirect_uris[0], code_challenge_method: 'S256', code_challenge: proof.challenge, scope: 'office', state: 'opaque-state', resource: RESOURCE, ...extra }, request = await store.authorizationRequest(query, BASE), info = await store.requestInfo(request.requestId); return { registered, proof, query, request, info }; };
  const consent = async (flow, member = members[0], extra = {}, context = {}) => store.consent({ requestId: flow.info.requestId, csrfToken: flow.info.csrfToken, approve: true, officeToken: member.token, ...extra }, { origin: BASE, baseUrl: BASE, ...context });
  const exchange = async (flow, member = members[0]) => { const approval = await consent(flow, member), code = new URL(approval.redirectUrl).searchParams.get('code'), form = { grant_type: 'authorization_code', client_id: flow.registered.client_id, redirect_uri: flow.registered.redirect_uris[0], code_verifier: flow.proof.verifier, code, resource: RESOURCE }; return { approval, code, form, tokens: await store.token(form, BASE) }; };
  return { db, sql, members, client, authorize, consent, exchange, get store() { return store; }, now: () => clock, advance: ms => { clock += ms; }, reopen() { store = makeStore(); } };
}

test('discovery and DCR describe a public S256 client without secrets or arbitrary metadata fetches', async t => {
  const h = await harness(t), metadata = h.store.metadata(BASE);
  assert.equal(metadata.issuer, `${BASE}/api/office/oauth`); assert.deepEqual(metadata.token_endpoint_auth_methods_supported, ['none']); assert.deepEqual(metadata.code_challenge_methods_supported, ['S256']); assert.equal(metadata.authorization_response_iss_parameter_supported, true);
  const originalFetch = globalThis.fetch; globalThis.fetch = () => { throw new Error('DCR must never fetch client-controlled URLs'); }; t.after(() => { globalThis.fetch = originalFetch; });
  const client = h.client({ client_uri: 'http://169.254.169.254/latest/meta-data', logo_uri: 'file:///etc/passwd' });
  assert.equal(client.token_endpoint_auth_method, 'none'); assert.equal(Object.hasOwn(client, 'client_secret'), false); assert.deepEqual(client.grant_types, ['authorization_code', 'refresh_token']); assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM office_oauth_grants').one().n, 0);
  for (const uri of ['http://attacker.example/cb', 'https://user:password@cloud.example/cb', 'https://cloud.example/cb#fragment', 'https://cloud.example/cb#', 'javascript:alert(1)', 'https://cloud.example/ cb', 'http://localhost/cb']) assert.throws(() => h.client({ redirect_uris: [uri] }), errorCode('invalid_redirect_uri'));
  assert.throws(() => h.client({ token_endpoint_auth_method: 'client_secret_basic' }), errorCode('invalid_client_metadata'));
  assert.throws(() => h.client({ grant_types: ['client_credentials'] }), errorCode('invalid_client_metadata'));
  assert.throws(() => h.client({ scope: 'office admin' }), errorCode('invalid_scope'));
  const local = h.store.register({ redirect_uris: ['http://localhost:1234/cb'] }, 'http://localhost:4173'); assert.equal(local.redirect_uris[0], 'http://localhost:1234/cb');
});

test('authorization is stored and exact-bound without granting access on GET', async t => {
  const h = await harness(t), registered = h.client(), flow = await h.authorize(registered);
  assert.match(flow.request.requestId, /^[a-f0-9]{64}$/); assert.equal(new URL(flow.request.consentUrl).pathname, '/office/connect/'); assert.equal(flow.info.clientName, 'Test Cloud Agent'); assert.equal(flow.info.redirectUri, CALLBACK); assert.equal(flow.info.agentOnly, true);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM office_oauth_grants').one().n, 0);
  for (const patch of [{ redirect_uri: `${CALLBACK}/` }, { response_type: 'token' }, { code_challenge_method: 'plain' }, { code_challenge: 'weak' }, { resource: undefined }, { resource: 'https://other.example/api/office/mcp' }, { scope: 'admin' }]) await assert.rejects(h.store.authorizationRequest({ ...flow.query, ...patch }, BASE));
  const duplicated = new URLSearchParams(flow.query); duplicated.append('resource', RESOURCE); await assert.rejects(h.store.authorizationRequest(duplicated, BASE), errorCode('invalid_request'));
  h.advance(OFFICE_OAUTH_LIMITS.requestMs); await assert.rejects(h.store.requestInfo(flow.request.requestId), errorCode('invalid_request'));
});

test('consent requires an exact-origin explicit one-use challenge and the original approved agent credential', async t => {
  const h = await harness(t), flow = await h.authorize();
  for (const origin of [null, undefined, 'https://attacker.example', `${BASE}/`]) await assert.rejects(h.consent(flow, h.members[0], {}, { origin }), errorCode('access_denied', 403));
  await assert.rejects(h.consent(flow, h.members[0], { csrfToken: secret() }), errorCode('access_denied', 403));
  await assert.rejects(h.consent(flow, h.members[0], { officeToken: secret() }), errorCode('access_denied', 403));
  await assert.rejects(h.consent(flow, h.members[2]), errorCode('access_denied', 403)); await assert.rejects(h.consent(flow, h.members[3]), errorCode('access_denied', 403));
  await assert.rejects(h.consent(flow, h.members[0], { approve: 'true' }), errorCode('invalid_request'));
  const consent = await h.consent(flow), target = new URL(consent.redirectUrl);
  assert.equal(target.origin, 'https://chatgpt.com'); assert.equal(target.searchParams.get('state'), 'opaque-state'); assert.equal(target.searchParams.get('iss'), `${BASE}/api/office/oauth`); assert.ok(target.searchParams.get('code'));
  for (const member of h.members) assert.equal(consent.redirectUrl.includes(member.token), false);
  await assert.rejects(h.consent(flow), errorCode('access_denied', 403));
  const denied = await h.authorize(), result = new URL((await h.consent(denied, h.members[0], { approve: false, officeToken: undefined })).redirectUrl); assert.equal(result.searchParams.get('error'), 'access_denied'); assert.equal(result.searchParams.has('code'), false);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM office_oauth_grants').one().n, 1);
});

test('PKCE code is short-lived, single-use and bound to exact client, redirect and resource without consuming a failed proof', async t => {
  const h = await harness(t), flow = await h.authorize(), approval = await h.consent(flow), code = new URL(approval.redirectUrl).searchParams.get('code'), other = h.client();
  const form = { grant_type: 'authorization_code', client_id: flow.registered.client_id, redirect_uri: CALLBACK, code_verifier: flow.proof.verifier, code, resource: RESOURCE };
  for (const patch of [{ client_id: other.client_id }, { redirect_uri: `${CALLBACK}/` }, { code_verifier: pkce().verifier }, { code_verifier: 'short' }, { resource: 'https://other.example/api/office/mcp' }, { resource: undefined }, { scope: 'admin' }]) await assert.rejects(h.store.token({ ...form, ...patch }, BASE));
  h.reopen(); const result = await h.store.token(new URLSearchParams(form), BASE); assert.match(result.access_token, /^[a-f0-9]{64}$/); assert.match(result.refresh_token, /^[a-f0-9]{64}$/); assert.notEqual(result.access_token, result.refresh_token); assert.equal(result.expires_in, 3600); assert.equal(result.token_type, 'Bearer');
  await assert.rejects(h.store.token(form, BASE), errorCode('invalid_grant'));
  const expired = await h.authorize(), oldApproval = await h.consent(expired); h.advance(OFFICE_OAUTH_LIMITS.codeMs);
  await assert.rejects(h.store.token({ ...form, client_id: expired.registered.client_id, code: new URL(oldApproval.redirectUrl).searchParams.get('code'), code_verifier: expired.proof.verifier }, BASE), errorCode('invalid_grant'));
});

test('only hashes are persisted and access resolves to a live approved agent until expiry', async t => {
  const h = await harness(t), flow = await h.authorize(), { code, tokens } = await h.exchange(flow), hash = await tokenHash(tokens.access_token);
  assert.equal(h.store.resolveAccessToken(hash), h.members[0].id); assert.equal(h.store.resolveAccessToken(tokens.access_token), null); assert.equal(h.store.resolveAccessToken('bad'), null);
  assert.equal(h.store.resolveAccessToken(hash, BASE), h.members[0].id); assert.equal(h.store.resolveAccessToken(hash, 'https://legacy.example'), null); assert.equal(h.store.resolveAccessGrant(hash, 'https://legacy.example'), null);
  const delegation = await h.authorize(flow.registered);
  await assert.rejects(h.consent(delegation, h.members[0], { officeToken: tokens.access_token }), errorCode('access_denied', 403));
  for (const table of ['office_oauth_requests', 'office_oauth_codes', 'office_oauth_grants', 'office_oauth_access', 'office_oauth_refresh']) {
    const dump = JSON.stringify(h.sql.exec(`SELECT * FROM ${table}`).toArray());
    for (const value of [flow.request.requestId, flow.info.csrfToken, code, tokens.access_token, tokens.refresh_token, ...h.members.map(member => member.token)]) assert.equal(dump.includes(value), false, `${table} must not store raw credentials`);
  }
  h.sql.exec("UPDATE office_members SET admission_status='revoked' WHERE id=?", h.members[0].id); assert.equal(h.store.resolveAccessToken(hash), null);
  await assert.rejects(h.store.token({ grant_type: 'refresh_token', client_id: flow.registered.client_id, refresh_token: tokens.refresh_token, resource: RESOURCE }, BASE), errorCode('invalid_grant'));
  h.sql.exec("UPDATE office_members SET admission_status='approved' WHERE id=?", h.members[0].id); h.advance(OFFICE_OAUTH_LIMITS.accessMs); assert.equal(h.store.resolveAccessToken(hash), null);
});

test('refresh tokens rotate, cannot cross clients or resources, and replay revokes the entire family durably', async t => {
  const h = await harness(t), flow = await h.authorize(), { tokens } = await h.exchange(flow), other = h.client(), form = { grant_type: 'refresh_token', client_id: flow.registered.client_id, refresh_token: tokens.refresh_token, resource: RESOURCE };
  await assert.rejects(h.store.token({ ...form, client_id: other.client_id }, BASE), errorCode('invalid_grant')); await assert.rejects(h.store.token({ ...form, resource: 'https://other.example/api/office/mcp' }, BASE), errorCode('invalid_target'));
  const next = await h.store.token(form, BASE); assert.notEqual(next.refresh_token, tokens.refresh_token); assert.equal(h.store.resolveAccessToken(await tokenHash(tokens.access_token)), null); assert.equal(h.store.resolveAccessToken(await tokenHash(next.access_token)), h.members[0].id);
  h.reopen(); await assert.rejects(h.store.token(form, BASE), errorCode('invalid_grant')); assert.equal(h.store.resolveAccessToken(await tokenHash(next.access_token)), null);
  await assert.rejects(h.store.token({ ...form, refresh_token: next.refresh_token }, BASE), errorCode('invalid_grant'));
  assert.ok(h.store.connections(h.members[0].id).connections[0].revokedAt); assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM office_oauth_refresh').one().n, 0);
});

test('connection lists and revocation are owner-only, expose no credentials, and revoke access immediately', async t => {
  const h = await harness(t), flow = await h.authorize(), { tokens } = await h.exchange(flow), own = h.store.connections(h.members[0].id), grant = own.connections[0];
  assert.equal(own.connections.length, 1); assert.equal(grant.clientName, 'Test Cloud Agent'); assert.deepEqual(h.store.connections(h.members[1].id), { connections: [] }); assert.equal(JSON.stringify(own).includes(tokens.access_token), false);
  assert.deepEqual(h.store.resolveAccessGrant(await tokenHash(tokens.access_token)), { memberId: h.members[0].id, grantId: grant.id }); assert.equal(h.store.isGrantActive(grant.id, h.members[0].id), true); assert.equal(h.store.isGrantActive(grant.id, h.members[1].id), false);
  assert.throws(() => h.store.revoke(h.members[1].id, grant.id), errorCode('invalid_request', 404)); assert.equal(h.store.resolveAccessToken(await tokenHash(tokens.access_token)), h.members[0].id);
  assert.deepEqual(h.store.revoke(h.members[0].id, grant.id), { revoked: true, id: grant.id }); assert.equal(h.store.resolveAccessToken(await tokenHash(tokens.access_token)), null); assert.equal(h.store.revoke(h.members[0].id, grant.id).revoked, true);
  assert.equal(h.store.resolveAccessGrant(await tokenHash(tokens.access_token)), null); assert.equal(h.store.isGrantActive(grant.id, h.members[0].id), false);
  const nextFlow = await h.authorize(), next = await h.exchange(nextFlow); await h.store.revokeToken({ client_id: nextFlow.registered.client_id, token: next.tokens.refresh_token }, BASE); assert.equal(h.store.resolveAccessToken(await tokenHash(next.tokens.access_token)), null);
  assert.deepEqual(await h.store.revokeToken({ client_id: nextFlow.registered.client_id, token: secret() }, BASE), {});
});

test('client, pending-request, per-member grant and rotating refresh storage stay bounded without evicting live connections', async t => {
  const h = await harness(t), registered = h.client(), proof = pkce();
  for (let index = 1; index < OFFICE_OAUTH_LIMITS.clients; index++) h.sql.exec('INSERT INTO office_oauth_clients(id,name,redirects_json,created_at) VALUES(?,?,?,?)', randomUUID(), 'Seeded client', JSON.stringify([CALLBACK]), h.now());
  assert.throws(() => h.client(), errorCode('temporarily_unavailable', 429));
  const query = { client_id: registered.client_id, response_type: 'code', redirect_uri: CALLBACK, code_challenge_method: 'S256', code_challenge: proof.challenge, resource: RESOURCE };
  for (let index = 0; index < OFFICE_OAUTH_LIMITS.requestsPerClient; index++) await h.store.authorizationRequest(query, BASE);
  await assert.rejects(h.store.authorizationRequest(query, BASE), errorCode('temporarily_unavailable', 429)); h.advance(OFFICE_OAUTH_LIMITS.requestMs); await h.store.authorizationRequest(query, BASE); assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM office_oauth_requests').one().n, 1);
  const first = await h.authorize(registered), firstTokens = await h.exchange(first);
  for (let index = 1; index < OFFICE_OAUTH_LIMITS.grantsPerMember; index++) await h.consent(await h.authorize(registered));
  await assert.rejects(h.consent(await h.authorize(registered)), errorCode('access_denied', 409)); assert.equal(h.store.resolveAccessToken(await tokenHash(firstTokens.tokens.access_token)), h.members[0].id);
  let refreshToken = firstTokens.tokens.refresh_token;
  for (let index = 0; index < OFFICE_OAUTH_LIMITS.refreshHistory + 5; index++) { const result = await h.store.token({ grant_type: 'refresh_token', client_id: registered.client_id, refresh_token: refreshToken, resource: RESOURCE }, BASE); refreshToken = result.refresh_token; }
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM office_oauth_refresh').one().n, OFFICE_OAUTH_LIMITS.refreshHistory); assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM office_oauth_access').one().n, 1);
  await assert.rejects(h.store.token({ grant_type: 'refresh_token', client_id: registered.client_id, refresh_token: firstTokens.tokens.refresh_token, resource: RESOURCE }, BASE), errorCode('invalid_grant'));
  const current = await h.store.token({ grant_type: 'refresh_token', client_id: registered.client_id, refresh_token: refreshToken, resource: RESOURCE }, BASE); assert.equal(h.store.resolveAccessToken(await tokenHash(current.access_token)), h.members[0].id);
  h.advance(OFFICE_OAUTH_LIMITS.refreshMs); h.store.connections(h.members[0].id); assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM office_oauth_grants').one().n, 0); assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM office_oauth_refresh').one().n, 0);
});

test('consent UI uses safe text, no automatic credential submission, no URL credential and no new credential persistence', async () => {
  const script = await readFile(new URL('../dist/office/connect/connect.js', import.meta.url), 'utf8'), html = await readFile(new URL('../dist/office/connect/index.html', import.meta.url), 'utf8');
  assert.equal(script.includes('innerHTML'), false); assert.equal(script.includes('localStorage.setItem'), false); assert.equal(script.includes('console.'), false); assert.match(script, /textContent = authorization\.clientName/); assert.match(script, /addEventListener\('submit'/); assert.match(script, /body\.officeToken = officeToken/); assert.match(script, /JSON\.stringify\(body\)/); assert.equal(script.includes('officeToken='), false); assert.match(html, /name="referrer" content="no-referrer"/); assert.match(html, /type="password" autocomplete="off"/); assert.match(html, /<form id="consent-form" method="post" action="\/api\/office\/oauth\/consent">/); assert.equal(html.includes('onclick='), false);
});
