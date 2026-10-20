import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { validateFeedback, renderIssue, validatePublisherToken } from '../worker/feedback.js';
import { FeedbackStore } from '../worker/feedback-store.js';

const submissionId = '5b3ac211-c354-4922-936b-e612e299ac26';
const sample = {
  submissionId, category: 'memory', title: ' 一張會唱歌的離職單 ',
  content: ' 想讓玩家把離職單折成紙飛機，飛過會議室時播放原創主題曲。 ',
  nature: '純原創虛構橋段', choices: '讓影印機擔任機長。', source: '', acknowledged: true,
};

test('feedback validation normalizes only the allowed publication fields', () => {
  const result = validateFeedback({ ...sample, token: 'never publish', playerId: 'never publish', issueUrl: 'https://attacker.example' });
  assert.deepEqual(Object.keys(result).sort(), ['submissionId', 'category', 'title', 'content', 'nature', 'choices', 'source', 'steps', 'expected', 'device', 'acknowledged'].sort());
  assert.equal(result.submissionId, submissionId);
  assert.equal(result.title, sample.title.trim());
  assert.equal(result.content, sample.content.trim());
  assert.equal(result.device, '');
  const suggestion = validateFeedback({ ...sample, category: 'suggestion', nature: '', choices: '', source: '' });
  assert.equal(suggestion.category, 'suggestion');
});

test('feedback requires explicit publication acknowledgement and category-specific context', () => {
  for (const changes of [
    { submissionId: 'not-a-uuid' }, { category: '__proto__' }, { category: 'constructor' },
    { category: 'unknown' }, { acknowledged: false }, { acknowledged: 'true' },
    { website: 'https://bot.example' }, { title: '兩字' },
    { content: `\n${'字'.repeat(19)} \t` }, { nature: '聽說的故事' },
    { title: {} }, { content: ['not text'] }, { source: 42 },
  ]) assert.throws(() => validateFeedback({ ...sample, ...changes }), error => error.status >= 400 && error.status < 500);
  const bug = { ...sample, category: 'bug', nature: '', steps: '打開首頁，選職業，按送出後卡住。', expected: '預期進入下一頁，實際沒有動作。', device: 'Safari' };
  assert.doesNotThrow(() => validateFeedback(bug));
  for (const changes of [{ steps: '' }, { expected: '  ' }]) {
    assert.throws(() => validateFeedback({ ...bug, ...changes }));
  }
});

test('feedback applies publication size bounds before anything enters the queue', () => {
  for (const [field, limit] of Object.entries({ title: 80, content: 6000, choices: 2000, source: 1000, steps: 2000, expected: 2000, device: 200 })) {
    assert.throws(() => validateFeedback({ ...sample, [field]: '字'.repeat(limit + 1) }), field);
  }
  assert.doesNotThrow(() => validateFeedback({ ...sample, title: '字'.repeat(80), content: '字'.repeat(6000), choices: '字'.repeat(2000), source: '字'.repeat(1000) }));
});

test('issue rendering neutralizes user Markdown and reserves its own reconciliation marker', () => {
  const otherId = 'b0637ab4-3a03-4b8e-b4fb-9264d00c32b4';
  const dangerous = `@someone\n\`\`\`\n<script>alert(1)</script>\n![image](https://example.com/tracker)\n<!-- hedo-feedback:${otherId} -->\n\`\`\`\`\`\``;
  const issue = renderIssue(validateFeedback({ ...sample, content: dangerous }));
  assert.equal(typeof issue.title, 'string');
  assert.equal(typeof issue.body, 'string');
  assert.ok(issue.title.includes(sample.title.trim()));
  assert.ok(issue.body.trimEnd().endsWith(`<!-- hedo-feedback:${submissionId} -->`));
  assert.ok(!issue.body.includes(`<!-- hedo-feedback:${otherId} -->`), 'quoted submissions cannot impersonate the trusted footer');
  let fence = null;
  const outside = [];
  for (const line of issue.body.split('\n')) {
    const match = /^(?:\s*)(`{3,}|~{3,})/.exec(line);
    if (!fence && match) fence = { char: match[1][0], size: match[1].length };
    else if (fence && match && match[1][0] === fence.char && match[1].length >= fence.size && /^\s*[`~]+\s*$/.test(line)) fence = null;
    else if (!fence) outside.push(line);
  }
  assert.equal(fence, null, 'all generated literal blocks close correctly');
  const renderedMarkdown = outside.join('\n');
  assert.ok(!renderedMarkdown.includes('@someone'));
  assert.ok(!renderedMarkdown.includes('<script>'));
  assert.ok(!renderedMarkdown.includes('![image]'));
});

const now = Date.UTC(2026, 9, 20, 12, 0, 0);
const seconds = Math.floor(now / 1000);
const env = {
  FEEDBACK_REPOSITORY: 'gn02335338/hedo-life', FEEDBACK_REPOSITORY_ID: '123456789',
  FEEDBACK_WORKFLOW_REF: 'gn02335338/hedo-life/.github/workflows/publish-feedback.yml@refs/heads/main',
  FEEDBACK_AUDIENCE: 'https://hedo-life.bvstudio.workers.dev/feedback-publisher',
};
const key = generateKeyPairSync('rsa', { modulusLength: 2048 });
const wrongKey = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...key.publicKey.export({ format: 'jwk' }), kid: 'feedback-unit-key', alg: 'RS256', use: 'sig' };
const claims = {
  iss: 'https://token.actions.githubusercontent.com', aud: env.FEEDBACK_AUDIENCE,
  repository: env.FEEDBACK_REPOSITORY, repository_id: env.FEEDBACK_REPOSITORY_ID,
  ref: 'refs/heads/main', workflow_ref: env.FEEDBACK_WORKFLOW_REF, event_name: 'schedule',
  iat: seconds - 5, nbf: seconds - 5, exp: seconds + 300,
};
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
function jwt(changes = {}, header = {}, privateKey = key.privateKey) {
  const data = `${encode({ alg: 'RS256', typ: 'JWT', kid: jwk.kid, ...header })}.${encode({ ...claims, ...changes })}`;
  return `${data}.${sign('RSA-SHA256', Buffer.from(data), privateKey).toString('base64url')}`;
}
const fetchKeys = async url => {
  assert.equal(new URL(url).origin, 'https://token.actions.githubusercontent.com');
  return Response.json({ keys: [jwk] });
};
const verify = (token, options = {}) => validatePublisherToken(token, env, { fetchImpl: fetchKeys, now, ...options });

test('publisher OIDC accepts a signed token from only the configured main workflow', async () => {
  const verified = await verify(jwt());
  assert.equal(verified.repository, env.FEEDBACK_REPOSITORY);
  assert.equal(verified.repository_id, env.FEEDBACK_REPOSITORY_ID);
});

test('publisher OIDC rejects alternate issuers, repos, refs, workflows, or audiences', async () => {
  for (const change of [
    { iss: 'https://attacker.example' }, { aud: 'another-audience' }, { aud: [env.FEEDBACK_AUDIENCE] },
    { repository: 'attacker/hedo-life' }, { repository_id: '987654321' },
    { ref: 'refs/heads/feature' }, { ref: 'refs/pull/1/merge' },
    { workflow_ref: env.FEEDBACK_WORKFLOW_REF.replace('publish-feedback', 'attacker') },
    { event_name: 'pull_request' }, { event_name: 'pull_request_target' }, { event_name: undefined },
  ]) await assert.rejects(verify(jwt(change)), JSON.stringify(change));
});

test('publisher OIDC rejects expired, not-yet-valid, and malformed time claims', async () => {
  for (const change of [
    { exp: seconds - 600 }, { nbf: seconds + 600 }, { iat: seconds + 600 },
    { exp: String(seconds + 300) }, { exp: null }, { nbf: null }, { iat: null },
    { exp: undefined }, { nbf: undefined }, { iat: undefined },
    { iat: seconds - 1200 }, { exp: seconds + 1200 },
  ]) await assert.rejects(verify(jwt(change)), JSON.stringify(change));
});

test('publisher OIDC rejects signature confusion and unavailable signing keys', async () => {
  for (const token of [
    jwt({}, {}, wrongKey.privateKey), jwt({}, { alg: 'HS256' }), jwt({}, { alg: 'none' }),
    jwt({}, { kid: 'unknown-key' }), 'broken.jwt', `${jwt()}.extra`,
  ]) await assert.rejects(verify(token));
  await assert.rejects(verify(jwt({}, { kid: 'unavailable-key' }), { fetchImpl: async () => { throw new TypeError('offline'); } }));
  await assert.rejects(verify(jwt(), { fetchImpl: async () => Response.json({ keys: [jwk] }, { status: 503 }) }));
  await assert.rejects(verify(jwt(), { fetchImpl: async () => new Response('not JSON') }));
  await assert.rejects(verify(jwt(), { fetchImpl: async () => Response.json({ keys: [] }) }));
});

test('publisher OIDC can additionally bind the owner account and refuses missing configuration', async () => {
  await assert.rejects(validatePublisherToken(jwt(), { ...env, FEEDBACK_OWNER_ID: '2468' }, { fetchImpl: fetchKeys, now }));
  await assert.doesNotReject(validatePublisherToken(jwt({ repository_owner_id: '2468', event_name: 'workflow_dispatch' }), { ...env, FEEDBACK_OWNER_ID: '2468' }, { fetchImpl: fetchKeys, now }));
  await assert.doesNotReject(verify(jwt({ event_name: 'workflow_run' })));
  for (const name of ['FEEDBACK_AUDIENCE', 'FEEDBACK_REPOSITORY_ID', 'FEEDBACK_WORKFLOW_REF']) {
    await assert.rejects(validatePublisherToken(jwt(), { ...env, [name]: '' }, { fetchImpl: fetchKeys, now }));
  }
});

function storeHarness() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON; CREATE TABLE players (id TEXT PRIMARY KEY);');
  const sql = {
    exec(query, ...args) {
      let rows = [];
      if (!args.length && query.includes(';')) db.exec(query);
      else {
        const statement = db.prepare(query);
        if (statement.columns().length) rows = statement.all(...args);
        else statement.run(...args);
      }
      return { toArray: () => rows, one: () => { assert.equal(rows.length, 1); return rows[0]; } };
    },
  };
  const storage = {
    transactionSync(callback) {
      db.exec('BEGIN IMMEDIATE');
      try { const value = callback(); db.exec('COMMIT'); return value; }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    },
  };
  const player = id => { sql.exec('INSERT OR IGNORE INTO players (id) VALUES (?)', id); return id; };
  const open = () => new FeedbackStore(sql, storage);
  return { db, sql, player, open, store: open() };
}
const payload = (changes = {}) => validateFeedback({ ...sample, submissionId: randomUUID(), ...changes });
const rowCount = h => h.sql.exec('SELECT COUNT(*) AS n FROM feedback_submissions').one().n;

test('the outbox pauses until a publisher heartbeat and exposes no false immediate receipt', async () => {
  const h = storeHarness(), owner = h.player('owner'), input = payload();
  assert.equal(h.store.config(now).enabled, false);
  await assert.rejects(h.store.submit(owner, input, '192.0.2.1', now), error => error.status === 503);
  assert.equal(rowCount(h), 0);
  assert.deepEqual(h.store.claim(now), { items: [] });
  assert.equal(h.store.config(now).enabled, true);
  assert.equal(h.store.config(now + 86400000).enabled, false);
  const receipt = await h.store.submit(owner, input, '192.0.2.1', now);
  assert.deepEqual(receipt, { submissionId: input.submissionId, status: 'queued', issueUrl: null });
  h.db.close();
});

test('outbox retries are owner-bound, payload-bound, and do not consume daily quotas', async () => {
  const h = storeHarness(), owner = h.player('owner'), other = h.player('another-owner');
  h.store.claim(now);
  const original = payload();
  await h.store.submit(owner, original, '192.0.2.1', now);
  await h.store.submit(owner, payload(), '192.0.2.1', now);
  await h.store.submit(owner, payload(), '192.0.2.1', now);
  const restarted = h.open();
  await assert.rejects(restarted.submit(owner, payload(), '192.0.2.1', now), error => error.status === 429);
  assert.equal((await restarted.submit(owner, original, '192.0.2.1', now)).status, 'queued');
  assert.equal(rowCount(h), 3);
  assert.equal(h.sql.exec('SELECT count FROM feedback_limits WHERE bucket = ?', `player:${owner}`).one().count, 3);
  await assert.rejects(restarted.submit(other, original, '192.0.2.2', now), error => error.status === 409);
  await assert.rejects(restarted.submit(owner, { ...original, content: `${original.content}更換內容。` }, '192.0.2.1', now), error => error.status === 409);
  assert.throws(() => restarted.status(other, original.submissionId, now), error => error.status === 404);
  assert.throws(() => restarted.status(owner, '__proto__', now), error => error.status === 404);
  assert.deepEqual(Object.keys(restarted.status(owner, original.submissionId, now)).sort(), ['submissionId', 'status', 'issueUrl'].sort());
  h.db.close();
});

test('concurrent identical retries commit one outbox row and consume one quota slot', async () => {
  const h = storeHarness(), owner = h.player('owner'); h.store.claim(now);
  const original = payload();
  const receipts = await Promise.all(Array.from({ length: 12 }, () => h.open().submit(owner, original, '192.0.2.1', now)));
  assert.ok(receipts.every(receipt => receipt.submissionId === original.submissionId && receipt.status === 'queued'));
  assert.equal(rowCount(h), 1);
  assert.equal(h.sql.exec("SELECT count FROM feedback_limits WHERE bucket = 'global'").one().count, 1);
  h.db.close();
});

test('persistent network and global limits survive reconstruction and failed submissions roll back counters', async () => {
  const network = storeHarness(); network.store.claim(now);
  for (let index = 0; index < 5; index++) await network.store.submit(network.player(`net-${index}`), payload(), '192.0.2.2', now);
  await assert.rejects(network.open().submit(network.player('net-overflow'), payload(), '192.0.2.2', now), error => error.status === 429);
  assert.equal(rowCount(network), 5);
  assert.equal(network.sql.exec("SELECT count FROM feedback_limits WHERE bucket = 'global'").one().count, 5);
  const stored = JSON.stringify(network.sql.exec('SELECT * FROM feedback_limits').toArray());
  assert.ok(!stored.includes('192.0.2.2'));
  network.db.close();
  const global = storeHarness(); global.store.claim(now);
  for (let index = 0; index < 30; index++) await global.store.submit(global.player(`global-${index}`), payload(), `192.0.2.${index + 1}`, now);
  await assert.rejects(global.open().submit(global.player('global-overflow'), payload(), '198.51.100.1', now), error => error.status === 429);
  assert.equal(rowCount(global), 30);
  global.db.close();
});

test('publisher claims use exclusive recoverable leases and acknowledgements erase the stored text', async () => {
  const h = storeHarness(), owner = h.player('owner'); h.store.claim(now);
  const originals = [payload(), payload(), payload()];
  for (const input of originals) await h.store.submit(owner, input, '192.0.2.1', now);
  const initial = h.store.claim(now).items;
  assert.equal(initial.length, 3);
  assert.equal(h.open().claim(now + 1000).items.length, 0);
  const renewed = h.open().claim(now + 15 * 60000).items;
  assert.equal(renewed.length, 3);
  const first = renewed.find(row => row.submissionId === initial[0].submissionId);
  assert.notEqual(first.leaseId, initial[0].leaseId);
  const ack = { submissionId: first.submissionId, leaseId: first.leaseId, issueNumber: 42, issueUrl: `https://github.com/gn02335338/hedo-life/issues/42` };
  assert.throws(() => h.store.ack({ ...ack, leaseId: initial[0].leaseId }), error => error.status === 409);
  for (const changes of [{ issueUrl: 'https://github.com/another/repo/issues/42' }, { issueNumber: 43 }, { issueNumber: 0 }]) {
    assert.throws(() => h.store.ack({ ...ack, ...changes }), error => error.status === 400);
  }
  assert.deepEqual(h.store.ack(ack), { ok: true });
  assert.deepEqual(h.open().ack(ack), { ok: true });
  assert.throws(() => h.store.ack({ ...ack, issueNumber: 43, issueUrl: 'https://github.com/gn02335338/hedo-life/issues/43' }), error => error.status === 409);
  assert.deepEqual(h.store.status(owner, first.submissionId, now), { submissionId: first.submissionId, status: 'published', issueUrl: ack.issueUrl });
  assert.equal(h.sql.exec('SELECT payload FROM feedback_submissions WHERE id = ?', first.submissionId).one().payload, '{}');
  const original = originals.find(row => row.submissionId === first.submissionId);
  assert.equal((await h.store.submit(owner, original, '192.0.2.1', now)).status, 'published');
  h.db.close();
});

test('expired queued text is erased and cannot be republished by a stale lease', async () => {
  const h = storeHarness(), owner = h.player('owner'); h.store.claim(now);
  const original = payload(); await h.store.submit(owner, original, '192.0.2.1', now);
  const leased = h.store.claim(now).items[0];
  assert.deepEqual(h.store.claim(now + 31 * 86400000), { items: [] });
  const status = h.store.status(owner, original.submissionId, now + 31 * 86400000);
  assert.equal(status.status, 'failed');
  assert.equal(status.issueUrl, null);
  assert.equal(h.sql.exec('SELECT payload FROM feedback_submissions WHERE id = ?', original.submissionId).one().payload, '{}');
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM feedback_limits').one().n, 0);
  assert.equal(h.sql.exec("SELECT COUNT(*) AS n FROM feedback_meta WHERE key LIKE 'salt:%'").one().n, 0);
  assert.throws(() => h.store.ack({ submissionId: original.submissionId, leaseId: leased.leaseId, issueNumber: 42, issueUrl: 'https://github.com/gn02335338/hedo-life/issues/42' }), error => error.status === 409);
  h.db.close();
});

test('retention deadlines schedule metadata cleanup first and erase queued text at exactly thirty days', async () => {
  const h = storeHarness(), owner = h.player('owner');
  assert.equal(h.store.nextCleanup(now), null);
  h.store.claim(now);
  assert.equal(h.store.nextCleanup(now), null, 'a heartbeat does not need a retention alarm');
  const original = payload(); await h.store.submit(owner, original, '192.0.2.1', now);
  const metadataDeadline = Date.UTC(2026, 9, 23);
  const textDeadline = now + 30 * 86400000;
  assert.equal(h.store.nextCleanup(now), metadataDeadline);
  assert.equal(h.store.nextCleanup(metadataDeadline + 2000), metadataDeadline + 3000, 'an overdue alarm is scheduled a second ahead');
  h.store.cleanup(metadataDeadline);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM feedback_limits').one().n, 0);
  assert.equal(h.sql.exec("SELECT COUNT(*) AS n FROM feedback_meta WHERE key LIKE 'salt:%'").one().n, 0);
  assert.equal(h.store.nextCleanup(metadataDeadline), textDeadline);
  assert.equal(h.store.status(owner, original.submissionId, textDeadline - 1).status, 'queued');
  assert.notEqual(h.sql.exec('SELECT payload FROM feedback_submissions WHERE id = ?', original.submissionId).one().payload, '{}');
  assert.equal(h.store.status(owner, original.submissionId, textDeadline).status, 'failed');
  assert.equal(h.sql.exec('SELECT payload FROM feedback_submissions WHERE id = ?', original.submissionId).one().payload, '{}');
  assert.equal(h.store.nextCleanup(textDeadline), null);
  h.db.close();
});

test('retention scheduling independently considers the oldest rate bucket and salt', () => {
  const h = storeHarness();
  h.sql.exec('INSERT INTO feedback_limits (day, bucket, count) VALUES (?, ?, 1)', '2026-10-18', 'global');
  h.sql.exec('INSERT INTO feedback_meta (key, value) VALUES (?, ?)', 'salt:2026-10-19', 'unit-test-salt');
  const bucketDeadline = Date.UTC(2026, 9, 21);
  const saltDeadline = Date.UTC(2026, 9, 22);
  assert.equal(h.store.nextCleanup(now), bucketDeadline);
  h.store.cleanup(bucketDeadline);
  assert.equal(h.store.nextCleanup(bucketDeadline), saltDeadline);
  h.store.cleanup(saltDeadline);
  assert.equal(h.store.nextCleanup(saltDeadline), null);
  h.db.close();
});

test('new-day quotas reset while an unhealthy queue remains bounded at ninety submissions', async () => {
  const h = storeHarness();
  for (let day = 0; day < 3; day++) {
    const at = now + day * 86400000;
    h.store.claim(at);
    for (let index = 0; index < 30; index++) {
      await h.store.submit(h.player(`queue-${day}-${index}`), payload(), `192.0.${day}.${index + 1}`, at);
    }
  }
  assert.equal(rowCount(h), 90);
  const nextDay = now + 3 * 86400000;
  h.store.claim(nextDay);
  await assert.rejects(h.open().submit(h.player('queue-overflow'), payload(), '198.51.100.42', nextDay), error => error.status === 503);
  assert.equal(rowCount(h), 90);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM feedback_limits WHERE day = ?', new Date(nextDay).toISOString().slice(0, 10)).one().n, 0);
  h.db.close();
});
