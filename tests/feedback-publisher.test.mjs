import test from 'node:test';
import assert from 'node:assert/strict';
import { publishFeedback } from '../scripts/publish-feedback.mjs';

const repository = 'gn02335338/hedo-life';
const baseUrl = 'https://hedo-life.bvstudio.workers.dev';
const submissionId = '5b3ac211-c354-4922-936b-e612e299ac26';
const marker = `<!-- hedo-feedback:${submissionId} -->`;
const item = {
  submissionId, leaseId: '698ce32b-15a0-48a3-bfb3-6b56e17c766d',
  createdAt: '2026-10-20T12:00:00.000Z', title: '[遊戲建議] 讓影印機當機長',
  body: `這是一份匿名投稿的原創遊戲建議。\n\n${marker}`,
};
const issue = (number = 42, extra = {}) => ({ number, html_url: `https://github.com/${repository}/issues/${number}`, body: item.body, user: { login: 'github-actions[bot]', type: 'Bot' }, ...extra });
function harness({ items = [item], list = [], create, ack } = {}) {
  const requests = [];
  const fetchImpl = async (value, options = {}) => {
    const request = value instanceof Request ? value : new Request(value, options);
    const url = new URL(request.url), method = request.method;
    const body = method === 'POST' ? await request.json() : null;
    const record = { url, method, body, authorization: request.headers.get('Authorization') };
    requests.push(record);
    if (url.origin === baseUrl && url.pathname === '/api/feedback-publisher/claim') return Response.json({ items });
    if (url.origin === baseUrl && url.pathname === '/api/feedback-publisher/ack') return ack ? ack(record, requests) : Response.json({ ok: true });
    if (url.origin === 'https://api.github.com' && url.pathname === `/repos/${repository}/issues`) {
      if (method === 'GET') return typeof list === 'function' ? list(record, requests) : Response.json(list);
      if (method === 'POST') return create ? create(record, requests) : Response.json(issue(), { status: 201 });
    }
    throw new Error(`Unexpected mock endpoint: ${method} ${url.origin}${url.pathname}`);
  };
  const run = changes => publishFeedback({ baseUrl, repository, oidcToken: 'oidc-test-token', githubToken: 'github-test-token', fetchImpl, ...changes });
  return { requests, run };
}
const githubCreates = h => h.requests.filter(r => r.url.origin === 'https://api.github.com' && r.method === 'POST');
const acknowledgements = h => h.requests.filter(r => r.url.pathname === '/api/feedback-publisher/ack');

test('publisher creates an issue and acknowledges it without crossing token audiences', async () => {
  const h = harness();
  const result = await h.run();
  assert.deepEqual(result, { claimed: 1, published: 1, reconciled: 0, failed: 0 });
  assert.equal(githubCreates(h).length, 1);
  assert.deepEqual(githubCreates(h)[0].body, { title: item.title, body: item.body });
  assert.deepEqual(acknowledgements(h)[0].body, { submissionId, leaseId: item.leaseId, issueUrl: issue().html_url, issueNumber: 42 });
  for (const request of h.requests) {
    assert.equal(request.authorization, request.url.origin === baseUrl ? 'Bearer oidc-test-token' : 'Bearer github-test-token');
  }
  const listing = h.requests.find(r => r.url.origin === 'https://api.github.com' && r.method === 'GET');
  assert.equal(listing.url.searchParams.get('state'), 'all');
  assert.equal(listing.url.searchParams.get('per_page'), '100');
});

test('publisher reconciles an already-created closed issue before attempting another POST', async () => {
  const h = harness({ list: [issue(17, { state: 'closed' })] });
  const result = await h.run();
  assert.equal(result.claimed, 1);
  assert.equal(result.reconciled, 1);
  assert.equal(result.failed, 0);
  assert.equal(githubCreates(h).length, 0);
  assert.equal(acknowledgements(h)[0].body.issueNumber, 17);
});

test('publisher ignores pull requests and a quoted marker while reconciling', async () => {
  for (const existing of [
    issue(17, { pull_request: { url: `https://api.github.com/repos/${repository}/pulls/17` } }),
    issue(18, { body: `A quoted submission:\n\`\`\`text\n${marker}\n\`\`\`` }),
  ]) {
    const h = harness({ list: [existing] });
    const result = await h.run();
    assert.equal(result.published, 1);
    assert.equal(result.reconciled, 0);
    assert.equal(githubCreates(h).length, 1);
  }
});

test('publisher does not trust reconciliation markers from humans or other bots', async () => {
  for (const user of [
    { login: 'github-actions[bot]', type: 'User' },
    { login: 'a-human', type: 'User' },
    { login: 'another-app[bot]', type: 'Bot' },
    undefined,
  ]) {
    const h = harness({ list: [issue(17, { user })] });
    const result = await h.run();
    assert.equal(result.published, 1);
    assert.equal(result.reconciled, 0);
    assert.equal(githubCreates(h).length, 1);
    assert.equal(acknowledgements(h)[0].body.issueNumber, 42);
  }
});

test('publisher follows issue-list pagination when a prior creation is on the next page', async () => {
  const firstPage = Array.from({ length: 100 }, (_, index) => issue(index + 100, { body: 'Some other issue.' }));
  const h = harness({ list: ({ url }) => Response.json(url.searchParams.get('page') === '2' ? [issue(17)] : firstPage) });
  const result = await h.run();
  assert.equal(result.reconciled, 1);
  assert.equal(githubCreates(h).length, 0);
  assert.equal(acknowledgements(h)[0].body.issueNumber, 17);
});

test('ambiguous GitHub create failure is not retried or acknowledged', async () => {
  const h = harness({ create: async () => { throw new TypeError('network ended after remote POST'); } });
  const result = await h.run();
  assert.equal(result.failed, 1);
  assert.equal(githubCreates(h).length, 1);
  assert.equal(acknowledgements(h).length, 0);
});

test('publisher retries the same acknowledgement without creating the issue again', async () => {
  let count = 0;
  const h = harness({ ack: () => ++count < 3 ? Response.json({ error: 'unavailable' }, { status: 503 }) : Response.json({ ok: true }) });
  const result = await h.run();
  assert.equal(result.failed, 0);
  assert.equal(githubCreates(h).length, 1);
  assert.equal(acknowledgements(h).length, 3);
  assert.ok(acknowledgements(h).every(r => JSON.stringify(r.body) === JSON.stringify(acknowledgements(h)[0].body)));
});

test('publisher refuses malformed claims before publishing any part of a batch', async () => {
  for (const invalid of [
    { ...item, submissionId: '__proto__' }, { ...item, leaseId: '' },
    { ...item, body: 'Missing reconciliation marker.' }, { ...item, title: {} },
  ]) {
    const h = harness({ items: [item, invalid] });
    await assert.rejects(h.run());
    assert.equal(githubCreates(h).length, 0);
  }
});

test('publisher refuses foreign issue URLs and mismatched issue numbers before acknowledgement', async () => {
  for (const result of [
    issue(42, { html_url: 'https://github.com/attacker/repo/issues/42' }),
    issue(42, { html_url: `https://github.com/${repository}/issues/43` }),
  ]) {
    const h = harness({ create: () => Response.json(result, { status: 201 }) });
    assert.equal((await h.run()).failed, 1);
    assert.equal(acknowledgements(h).length, 0);
  }
});

test('publisher refuses a create response without the expected GitHub Actions author', async () => {
  for (const user of [undefined, { login: 'a-human', type: 'User' }, { login: 'another-app[bot]', type: 'Bot' }]) {
    const h = harness({ create: () => Response.json(issue(42, { user }), { status: 201 }) });
    assert.equal((await h.run()).failed, 1);
    assert.equal(githubCreates(h).length, 1);
    assert.equal(acknowledgements(h).length, 0);
  }
});

test('publisher never creates if it cannot reconcile against GitHub first', async () => {
  const h = harness({ list: () => Response.json({ message: 'unavailable' }, { status: 503 }) });
  assert.equal((await h.run()).failed, 1);
  assert.equal(githubCreates(h).length, 0);
  assert.equal(acknowledgements(h).length, 0);
});

test('publisher configuration cannot redirect either credential to another destination', async () => {
  for (const changes of [
    { baseUrl: 'https://attacker.example' }, { baseUrl: 'http://localhost:4173' },
    { repository: 'attacker/repo' }, { oidcToken: '' }, { githubToken: '' },
  ]) {
    const h = harness();
    await assert.rejects(h.run(changes));
    assert.equal(h.requests.length, 0);
  }
});
