import test from 'node:test';
import assert from 'node:assert/strict';
import { handleDomainMigration, MAX_MIGRATION_FORM_BYTES } from '../worker/domain-migration.js';
import { SOURCE_ORIGIN, TARGET_ORIGIN, MAX_PAYLOAD_BYTES, LOCAL_KEYS, SESSION_KEYS } from '../dist/domain-migration.js';

const navigation = { headers: { Accept: 'text/html', 'Sec-Fetch-Mode': 'navigate' } };
const payload = changes => ({ version: 1, nonce: 'a'.repeat(64), returnTo: '/island/?walk=1', local: { 'hedo-anonymous-v1': 'b'.repeat(64), 'hedo-life-v3': '{"unlocked":[]}' }, session: {}, ...changes });
const formRequest = (value = payload(), { origin = SOURCE_ORIGIN, url = `${TARGET_ORIGIN}/_hodo/import`, extraFields = [], method = 'POST' } = {}) => {
  const form = new FormData();
  form.append('payload', typeof value === 'string' ? value : JSON.stringify(value));
  for (const [key, content] of extraFields) form.append(key, content);
  return new Request(url, { method, headers: origin === undefined ? {} : { Origin: origin }, body: form });
};
const configOf = async response => {
  const html = await response.text();
  const match = /<script id="hodo-migration-config" type="application\/json">([^]*?)<\/script>/.exec(html);
  assert.ok(match, 'migration config is present');
  return { html, config: JSON.parse(match[1]), rawConfig: match[1] };
};

test('old page navigations use export, preserve pathname/query, and never cache private HTML', async () => {
  const response = await handleDomainMigration(new Request(`${SOURCE_ORIGIN}/gta/?chapter=2`, navigation));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.equal(response.headers.get('Referrer-Policy'), 'strict-origin');
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(response.headers.get('X-Frame-Options'), 'DENY');
  assert.match(response.headers.get('Content-Security-Policy'), /frame-ancestors 'none'/);
  assert.match(response.headers.get('Content-Security-Policy'), new RegExp(`form-action ${TARGET_ORIGIN.replaceAll('.', '\\.')}`));
  const { config, html } = await configOf(response);
  assert.deepEqual(config, { mode: 'export', returnTo: '/gta/?chapter=2' });
  assert.match(html, /src="\/domain-migration-ui\.js"/);
});

test('first target navigation enters the bridge before application code; completed visitors reach assets', async () => {
  const first = await configOf(await handleDomainMigration(new Request(`${TARGET_ORIGIN}/?from=share`, navigation)));
  assert.deepEqual(first.config, { mode: 'entry', returnTo: '/?from=share' });
  for (const cookie of ['hodo_migrated_v1=1', 'other=yes; hodo_migrated_v1=1; final=no']) {
    assert.equal(await handleDomainMigration(new Request(TARGET_ORIGIN, { headers: { Accept: 'text/html', Cookie: cookie } })), null);
  }
  for (const cookie of ['hodo_migrated_v1=10', 'other_hodo_migrated_v1=1', 'hodo_migrated_v1=0']) {
    assert.ok(await handleDomainMigration(new Request(TARGET_ORIGIN, { headers: { Cookie: cookie } })));
  }
});

test('APIs, feedback publisher, static asset requests, localhost, and unknown hosts pass through', async () => {
  for (const origin of [SOURCE_ORIGIN, TARGET_ORIGIN]) {
    for (const path of ['/api', '/api/player', '/api/feedback-publisher/claim', '/app.js', '/domain-migration.js', '/assets/image.webp']) {
      assert.equal(await handleDomainMigration(new Request(`${origin}${path}`)), null, `${origin}${path}`);
    }
    assert.equal(await handleDomainMigration(new Request(`${origin}/api/player`, { method: 'POST', headers: { Accept: 'text/html' }, body: '{}' })), null);
  }
  for (const origin of ['http://127.0.0.1:4173', 'http://localhost:4173', 'https://unrelated.example', 'http://hodo.bvivify.com']) {
    assert.equal(await handleDomainMigration(new Request(`${origin}/_hodo/import`, navigation)), null);
  }
});

test('HTML HEAD uses the same private routing without a response body', async () => {
  const response = await handleDomainMigration(new Request(`${SOURCE_ORIGIN}/island/`, { ...navigation, method: 'HEAD' }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'text/html; charset=utf-8');
  assert.equal(await response.text(), '');
});

test('reserved endpoints only expose supported modes on their intended host and methods', async () => {
  for (const [origin, path, mode] of [[SOURCE_ORIGIN, 'export', 'export'], [SOURCE_ORIGIN, 'complete', 'complete'], [TARGET_ORIGIN, 'recover', 'recover']]) {
    const response = await handleDomainMigration(new Request(`${origin}/_hodo/${path}?returnTo=%2Farpg%2F`));
    assert.deepEqual((await configOf(response)).config, { mode, returnTo: '/arpg/', ...(mode === 'export' ? { force: true } : {}) });
    const wrongMethod = await handleDomainMigration(new Request(`${origin}/_hodo/${path}`, { method: 'POST' }));
    assert.equal(wrongMethod.status, 405);
    assert.equal(wrongMethod.headers.get('Allow'), 'GET, HEAD');
  }
  for (const [origin, path] of [[SOURCE_ORIGIN, 'import'], [SOURCE_ORIGIN, 'recover'], [TARGET_ORIGIN, 'export'], [TARGET_ORIGIN, 'complete'], [TARGET_ORIGIN, 'unknown']]) {
    assert.equal((await handleDomainMigration(new Request(`${origin}/_hodo/${path}`))).status, 404);
  }
  const getImport = await handleDomainMigration(new Request(`${TARGET_ORIGIN}/_hodo/import`));
  assert.equal(getImport.status, 405);
  assert.equal(getImport.headers.get('Allow'), 'POST');
});

test('import accepts only exact old Origin and a bounded native multipart form', async () => {
  for (const origin of ['https://attacker.example', TARGET_ORIGIN, 'null', '', `${SOURCE_ORIGIN}/`, `${SOURCE_ORIGIN}.attacker.example`]) {
    assert.equal((await handleDomainMigration(formRequest(payload(), { origin }))).status, 403);
  }
  const absent = formRequest();
  absent.headers.delete('Origin');
  assert.equal((await handleDomainMigration(absent)).status, 403);
  const accepted = await handleDomainMigration(formRequest());
  assert.equal(accepted.headers.get('Referrer-Policy'), 'no-referrer');
  const imported = (await configOf(accepted)).config;
  const expected = payload();
  expected.local = Object.fromEntries(LOCAL_KEYS.map(key => [key, expected.local[key] ?? null]));
  expected.session = Object.fromEntries(SESSION_KEYS.map(key => [key, expected.session[key] ?? null]));
  assert.deepEqual(imported, { mode: 'import', returnTo: expected.returnTo, payload: expected });
  const wrongType = new Request(`${TARGET_ORIGIN}/_hodo/import`, { method: 'POST', headers: { Origin: SOURCE_ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify(payload()) });
  assert.equal((await handleDomainMigration(wrongType)).status, 415);
  const malformed = new Request(`${TARGET_ORIGIN}/_hodo/import`, { method: 'POST', headers: { Origin: SOURCE_ORIGIN, 'Content-Type': 'multipart/form-data; boundary=missing' }, body: 'broken' });
  assert.equal((await handleDomainMigration(malformed)).status, 400);
});

test('import rejects unknown/duplicate fields, files, malformed JSON, and unallowlisted storage', async () => {
  for (const request of [
    formRequest(payload(), { extraFields: [['extra', 'no']] }),
    formRequest(payload(), { extraFields: [['payload', JSON.stringify(payload())]] }),
    formRequest('{broken'),
    formRequest(payload({ local: { private_secret: 'no' } })),
    formRequest(payload({ session: { 'hedo-anonymous-v1': 'no' } })),
    formRequest(payload({ nonce: 'wrong' })),
  ]) assert.equal((await handleDomainMigration(request)).status, 400);
  const fileForm = new FormData();
  fileForm.append('payload', new Blob([JSON.stringify(payload())]), 'data.json');
  assert.equal((await handleDomainMigration(new Request(`${TARGET_ORIGIN}/_hodo/import`, { method: 'POST', headers: { Origin: SOURCE_ORIGIN }, body: fileForm }))).status, 400);
});

test('migration paths reject foreign paths, normalization attacks, loops, and duplicate returnTo', async () => {
  for (const path of ['//attacker.example/path', 'https://attacker.example', '/\\attacker.example', '/_hodo/export', '/%5cattacker.example', '/%2f%2fattacker.example', '/a\nnew', '/x/../_hodo/import']) {
    const url = `${SOURCE_ORIGIN}/_hodo/export?returnTo=${encodeURIComponent(path)}`;
    assert.equal((await handleDomainMigration(new Request(url))).status, 400, path);
    assert.equal((await handleDomainMigration(formRequest(payload({ returnTo: path })))).status, 400, `payload ${path}`);
  }
  assert.equal((await handleDomainMigration(new Request(`${SOURCE_ORIGIN}/_hodo/export?returnTo=%2F&returnTo=%2Farpg%2F`))).status, 400);
});

test('payload embedded in JSON cannot end its script element or inject HTML', async () => {
  const text = '</script><img src=x onerror=alert(1)>&\u2028\u2029';
  const value = payload({ local: { 'hedo-life-v3': text } });
  const { config, html, rawConfig } = await configOf(await handleDomainMigration(formRequest(value)));
  assert.equal(config.payload.local['hedo-life-v3'], text);
  assert.ok(!rawConfig.includes('<'));
  assert.ok(!rawConfig.includes('>'));
  assert.ok(!rawConfig.includes('&'));
  assert.ok(!html.includes('<img src=x'));
});

test('declared and streamed form limits both reject oversized bodies without reflecting data', async () => {
  const headers = { Origin: SOURCE_ORIGIN, 'Content-Type': 'multipart/form-data; boundary=test' };
  const declared = new Request(`${TARGET_ORIGIN}/_hodo/import`, { method: 'POST', headers: { ...headers, 'Content-Length': String(MAX_MIGRATION_FORM_BYTES + 1) }, body: 'secret' });
  assert.equal((await handleDomainMigration(declared)).status, 413);
  const streamed = new Request(`${TARGET_ORIGIN}/_hodo/import`, { method: 'POST', headers, body: new ReadableStream({ start(controller) { for (let i = 0; i < 17; i++) controller.enqueue(new Uint8Array(1024 * 1024)); controller.close(); } }), duplex: 'half' });
  const response = await handleDomainMigration(streamed);
  assert.equal(response.status, 413);
  assert.ok(!(await response.text()).includes('secret'));
  const oversizedPayload = payload({ local: { 'hedo-life-v3': 'x'.repeat(MAX_PAYLOAD_BYTES) } });
  assert.equal((await handleDomainMigration(formRequest(oversizedPayload))).status, 413);
});
