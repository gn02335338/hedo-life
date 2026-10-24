import test from 'node:test';
import assert from 'node:assert/strict';
import { createApplicationClient, ANONYMOUS_KEY } from '../dist/island/application-client.js';
const token = 'ab'.repeat(32);
const fields = { nickname: '測試島民', districtId: 'cafe', outfit: 'teal', greeting: '今天一起散步吧', introduction: '喜歡在島上看海和聊聊日常。', reason: '希望在島上和大家分享生活。', consent: true };
function fixture({ saved, run } = {}) {
  const values = new Map(saved ? [[ANONYMOUS_KEY, saved]] : []), calls = [], writes = [];
  const storage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => { values.set(k, v); writes.push(k); } };
  const client = createApplicationClient({ storage, random: { getRandomValues: a => a.fill(171), randomUUID: () => '5c56eec5-ed5b-4f76-82b9-295e360d006b' }, fetcher: async (url, options) => {
    calls.push({ url, ...options });
    if (run) { const response = await run(url, options, calls); if (response) return response; }
    return Response.json(url === '/api/island/applications' ? { application: { ...JSON.parse(options.body), id: JSON.parse(options.body).submissionId, status: 'pending', reviewNote: '', createdAt: new Date().toISOString(), reviewedAt: null } } : url.endsWith('/mine') ? { applications: [] } : {});
  }});
  return { client, calls, writes, values };
}
test('browsing config, public residents and empty owner status creates no identity', async () => {
  const f = fixture(); await f.client.config(); await f.client.residents(); await f.client.mine();
  assert.equal(f.calls.length, 2); assert.equal(f.writes.length, 0);
  assert.ok(f.calls.every(c => !c.headers.Authorization));
});
test('submission lazily persists identity and never reads or writes career queues', async () => {
  const f = fixture(); await f.client.submit(fields);
  assert.deepEqual(f.writes, [ANONYMOUS_KEY]); assert.equal(f.values.get(ANONYMOUS_KEY), token);
  assert.deepEqual(f.calls.map(c => c.url), ['/api/player', '/api/island/applications']);
  assert.equal(f.calls[1].headers.Authorization, `Bearer ${token}`);
  assert.equal(JSON.parse(f.calls[1].body).consent, true);
});
test('existing owner status reuses credential without registration', async () => {
  const f = fixture({ saved: token }); await f.client.mine();
  assert.equal(f.calls.length, 1); assert.equal(f.writes.length, 0);
  assert.equal(f.calls[0].headers.Authorization, `Bearer ${token}`);
});
test('uncertain receipt retries exact payload and ID even if edited; double click shares request', async () => {
  let failed = false;
  const f = fixture({ run: async url => { if (url === '/api/island/applications' && !failed) { failed = true; throw new Error('lost receipt'); } } });
  const first = f.client.submit(fields); assert.equal(f.client.submit(fields), first);
  await assert.rejects(first, /lost receipt/); assert.equal(f.client.hasPending(), true);
  await f.client.submit({ ...fields, nickname: '不同暱稱' });
  const posts = f.calls.filter(c => c.url === '/api/island/applications');
  assert.equal(posts[0].body, posts[1].body); assert.equal(f.client.hasPending(), false);
});
test('definitive rejection clears the submission; failed withdrawal does not claim success', async () => {
  const f = fixture({ saved: token, run: url => url === '/api/island/applications' ? Response.json({ error: 'invalid', message: '請修正內容' }, { status: 400 }) : url.includes('/id') ? Response.json({ message: '暫時無法撤回' }, { status: 503 }) : null });
  await assert.rejects(f.client.submit(fields), /請修正內容/); assert.equal(f.client.hasPending(), false);
  await assert.rejects(f.client.withdraw('id'), /暫時無法撤回/);
});
test('blocked or silently failing browser storage prevents publishing', async () => {
  for (const storage of [undefined, { getItem: () => null, setItem: () => {} }, { getItem: () => token, setItem: () => { throw new Error(); } }]) {
    let calls = 0;
    const c = createApplicationClient({ storage, fetcher: () => { calls++; }, random: { getRandomValues: a => a.fill(171) } });
    await assert.rejects(c.submit(fields), /無法保存申請憑證/); assert.equal(calls, 0);
  }
});

test('wrong or incomplete receipts retain the original submission for safe retry', async () => {
  for (const application of [{id:'wrong',status:'pending'}, {id:'5c56eec5-ed5b-4f76-82b9-295e360d006b',status:'unknown'}]) {
    const f = fixture({ run: url => url === '/api/island/applications' ? Response.json({application}) : null });
    await assert.rejects(f.client.submit(fields), /正確申請收據/); assert.equal(f.client.hasPending(), true);
  }
});
