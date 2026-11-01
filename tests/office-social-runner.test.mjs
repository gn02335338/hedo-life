import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { OfficeStore } from '../worker/office.js';
import { getOfficeEvent } from '../dist/office/events.js';
import { createSocialClient, createSocialState, runSocialTick, createCommandAdapter, createOllamaAdapter, validateSocialDecision, parseSocialArgs } from '../dist/office/hedo-office-social.mjs';

const owner = { id: 'owner-agent', kind: 'agent', name: '真正模型同事', role: '一起聊天', status: 'approved', floor: 6, zone: 'studio', contact: 'PRIVATE_CONTACT', token: 'PRIVATE_TOKEN', configPath: 'PRIVATE_CONFIG' };
const message = (id = 'inbox-one', turn = 0) => ({ id, type: 'message', senderId: 'other-agent', expiresAt: new Date(900_000).toISOString(), payload: { message: { id: 'public-message', memberId: 'other-agent', text: '今天有什麼新點子？', token: 'PRIVATE_MESSAGE_FIELD' }, sender: { id: 'other-agent', kind: 'agent', name: '同事', contact: 'PRIVATE_SENDER' }, conversation: { id: 'conversation', turnIndex: turn, maxTurns: 4 }, command: '/untrusted/server-command', leaseToken: 'PRIVATE_PAYLOAD_LEASE' } });
function fixture({ items = [message()], preferences = {}, status = 'approved', adapter = async () => ({ text: '我想聊聊如何整理好點子。', action: 'reply' }) } = {}) {
  const calls = [], contexts = [], ledger = new Map(), state = createSocialState(); let time = 0;
  const prefs = { autoReply: true, autoActivities: false, maxTurns: 4, cooldownSeconds: 60, ...preferences };
  const client = {
    async getStatus() { calls.push('status'); return { ...owner, status }; },
    async getPreferences() { calls.push('preferences'); return prefs; },
    async heartbeat() { calls.push('heartbeat'); },
    async getInbox() { calls.push('inbox'); return { items }; },
    async claimInbox(id) { calls.push('claim'); return { item: items.find(item => item.id === id), leaseToken: 'a'.repeat(64), leaseExpiresAt: new Date(time + 90_000).toISOString() }; },
    async replyInbox(id, body) { calls.push('reply'); if (!ledger.has(body.submissionId)) ledger.set(body.submissionId, { id, ...body }); return { duplicate: false }; },
    async ackInbox(id, body) { calls.push('ack'); return { id, ...body }; },
    async getActivities() { calls.push('activities'); return { myMatches: [] }; },
    async joinActivity(id) { calls.push('join'); return { eventId: id }; },
    async moveActivity(id, body) { calls.push('move'); return { id, ...body }; },
  };
  const model = async (context, options) => { contexts.push(context); return adapter(context, options); };
  return { client, calls, contexts, ledger, state, prefs, items, setTime(value) { time = value; }, tick: options => runSocialTick({ client, adapter: model, state, now: () => time, ...options }) };
}

test('opt-in is required, revoked seats stop, and only an active enabled runtime heartbeats', async () => {
  const disabled = fixture({ preferences: { autoReply: false, autoActivities: false } });
  assert.equal((await disabled.tick()).status, 'disabled'); assert.deepEqual(disabled.calls, ['status', 'preferences']); assert.equal(disabled.contexts.length, 0);
  const pending = fixture({ status: 'pending' }); assert.equal((await pending.tick()).status, 'awaiting-approval'); assert.deepEqual(pending.calls, ['status']);
  const revoked = fixture({ status: 'revoked' }); assert.equal((await revoked.tick()).status, 'stopped'); assert.equal((await revoked.tick()).status, 'stopped'); assert.deepEqual(revoked.calls, ['status']);
  const active = fixture({ items: [] }); await active.tick(); active.setTime(44_999); await active.tick(); assert.equal(active.calls.filter(call => call === 'heartbeat').length, 1);
  active.setTime(45_000); await active.tick(); assert.equal(active.calls.filter(call => call === 'heartbeat').length, 2); assert.equal(active.contexts.length, 0);
});

test('one leased item reaches the real adapter with only public fields, and duplicate polls never repeat it', async () => {
  const h = fixture({ items: [message(), message('inbox-two')] });
  assert.equal((await h.tick()).status, 'replied'); assert.equal(h.contexts.length, 1); assert.equal(h.ledger.size, 1);
  assert.deepEqual(h.calls, ['status', 'preferences', 'heartbeat', 'inbox', 'claim', 'reply']);
  const context = h.contexts[0]; assert.equal(context.source.text, '今天有什麼新點子？'); assert.equal(context.self.name, owner.name);
  assert.deepEqual(context.allowedActions, ['reply', 'skip']); assert.doesNotMatch(JSON.stringify(context), /PRIVATE_|leaseToken|configPath|untrusted\/server-command/);
  await h.tick(); assert.equal(h.contexts.length, 1, 'Cooldown prevents a second agent-to-agent reply');
  h.items.splice(1); h.setTime(60_000); await h.tick(); assert.equal(h.contexts.length, 1, 'An already handled inbox ID cannot run the adapter again');
  assert.equal(h.calls.filter(call => call === 'ack').length, 0, 'Reply atomically handles its inbox item');
});

test('lost reply responses reuse the generated text and submission UUID with backoff, not another model call', async () => {
  const h = fixture(), realReply = h.client.replyInbox; let attempts = 0;
  h.client.replyInbox = async (id, body) => { const result = await realReply(id, body); if (++attempts === 1) throw Object.assign(new Error('lost response'), { status: 503 }); return result; };
  assert.equal((await h.tick()).status, 'backoff'); const pending = structuredClone(h.state.pending);
  assert.equal(h.contexts.length, 1); assert.equal(h.ledger.size, 1);
  const before = h.calls.length; h.setTime(4999); assert.equal((await h.tick()).status, 'backoff'); assert.equal(h.calls.length, before);
  h.setTime(5000); assert.equal((await h.tick()).status, 'replied'); assert.equal(h.contexts.length, 1); assert.equal(h.ledger.size, 1);
  assert.equal([...h.ledger.keys()][0], pending.submissionId); assert.equal(attempts, 2); assert.equal(h.state.pending, null);
});

test('concurrent ticks, cancellation, turn bounds and HTTP retry limits cannot turn into runaway replies', async () => {
  let entered, finish; const begun = new Promise(resolve => { entered = resolve; }), waiting = new Promise(resolve => { finish = resolve; });
  const h = fixture({ adapter: async () => { entered(); return waiting; } }), controller = new AbortController();
  const first = h.tick({ signal: controller.signal }); await begun;
  assert.equal((await h.tick()).status, 'busy'); controller.abort(); finish({ action: 'reply', text: '不能送出的回覆' });
  assert.equal((await first).status, 'cancelled'); assert.equal(h.ledger.size, 0); assert.equal(h.state.busy, false);
  const bounded = fixture({ items: [message('last-turn', 2)], preferences: { maxTurns: 2 } });
  assert.equal((await bounded.tick()).status, 'skipped'); assert.equal(bounded.contexts.length, 0); assert.equal(bounded.calls.at(-1), 'ack');
  const limited = fixture(); limited.client.getInbox = async () => { throw Object.assign(new Error('Rate limit'), { status: 429, retryAfterMs: 120_000 }); };
  assert.deepEqual(await limited.tick(), { status: 'backoff', nextPollAt: 120_000 });
  const invalid = fixture({ adapter: async () => ({ action: 'exec', text: 'run server command', command: '/bin/sh' }) });
  assert.equal((await invalid.tick()).status, 'backoff'); assert.equal(invalid.ledger.size, 0);
  const forbidden = fixture(); forbidden.client.claimInbox = async () => { throw Object.assign(new Error('Revoked'), { status: 403 }); };
  assert.equal((await forbidden.tick()).status, 'stopped'); assert.equal(forbidden.contexts.length, 0);
  const capped = fixture({ items: [message('capped-conversation'), message('other-conversation')] }), claim = capped.client.claimInbox;
  capped.client.claimInbox = async (id, signal) => { if (id === 'capped-conversation') throw Object.assign(new Error('Server conversation limit'), { status: 409 }); return claim(id, signal); };
  assert.equal((await capped.tick()).status, 'deferred'); capped.setTime(5000); assert.equal((await capped.tick()).status, 'replied');
  assert.equal([...capped.ledger.values()][0].id, 'other-conversation', 'A capped or concurrently claimed item cannot starve the next inbox item');
});

test('activity turns precede invitations and chat, with the earliest expiry first within each priority', async () => {
  const turn = (id, expiresAt) => ({ id, type: 'activity-turn', expiresAt: new Date(expiresAt).toISOString(), payload: { eventId: 'event', matchId: id, round: 1 } });
  const invite = { id: 'invite', type: 'activity-invitation', expiresAt: new Date(20_000).toISOString(), payload: { eventId: 'event', event: { type: 'duel' }, joinClosesAt: 20_000 } };
  const h = fixture({ items: [message('new-chat'), invite, turn('later-turn', 40_000), turn('urgent-turn', 30_000)], preferences: { autoActivities: true }, adapter: async () => ({ action: 'skip', text: '' }) });
  h.client.getActivities = async () => ({ myMatches: ['later-turn', 'urgent-turn'].map(id => ({ id, type: 'duel', participantIds: [owner.id, 'other'], status: 'playing', currentRound: 1, submitted: [false, false], roundDeadline: 45_000, history: [] })) });
  for (let count = 0; count < 4; count++) assert.equal((await h.tick()).status, 'skipped');
  assert.deepEqual(h.contexts.map(context => context.match?.id || context.mode), ['urgent-turn', 'later-turn', 'activity-invitation', 'chat']);
});

test('a claim race defers only that item and retries after the crashed competing runner lease expires', async () => {
  const h = fixture({ items: [message('raced-item'), message('other-item')] }), claim = h.client.claimInbox; let racedAttempts = 0;
  h.client.claimInbox = async (id, signal) => { if (id === 'raced-item' && ++racedAttempts === 1) throw Object.assign(new Error('Competing live lease'), { status: 409 }); return claim(id, signal); };
  assert.equal((await h.tick()).status, 'deferred'); assert.equal(h.state.completed.has('raced-item'), false); assert.equal(h.state.itemRetryAfter.get('raced-item'), 90_000);
  h.setTime(5000); assert.equal((await h.tick()).status, 'replied'); assert.equal([...h.ledger.values()][0].id, 'other-item');
  h.setTime(89_999); assert.equal((await h.tick()).status, 'idle'); assert.equal(racedAttempts, 1);
  h.setTime(90_000); assert.equal((await h.tick()).status, 'replied'); assert.equal(racedAttempts, 2); assert.equal(h.state.completed.has('raced-item'), true); assert.equal(h.state.itemRetryAfter.has('raced-item'), false);
  assert.equal(h.contexts.length, 2); assert.equal(h.ledger.size, 2);
});

test('an expired reply or activity acknowledgment drops its generated pending work so the next item can run', async () => {
  for (const activity of [false, true]) {
    const expired = activity ? { id: 'expired-item', type: 'activity-invitation', expiresAt: new Date(30_000).toISOString(), payload: { eventId: 'event', event: { type: 'duel' }, joinClosesAt: 30_000 } } : { ...message('expired-item'), expiresAt: new Date(30_000).toISOString() };
    const h = fixture({ items: [expired, message('next-item')], preferences: { autoActivities: true }, adapter: async context => ({ action: context.mode === 'activity-invitation' ? 'join' : 'reply', text: '真正生成的回覆' }) });
    const method = activity ? 'ackInbox' : 'replyInbox', original = h.client[method]; let expiredAttempts = 0;
    h.client[method] = async (id, body) => { if (id === 'expired-item') { expiredAttempts++; throw Object.assign(new Error('Expired or evicted inbox item'), { status: 404 }); } return original(id, body); };
    assert.equal((await h.tick()).status, 'expired'); assert.equal(h.state.pending, null); assert.equal(h.state.nextPollAt, 0);
    assert.equal((await h.tick()).status, 'replied'); assert.equal([...h.ledger.values()][0].id, 'next-item');
    assert.equal(expiredAttempts, 1); assert.equal(h.contexts.length, 2, 'The expired model decision is never generated or retried again');
    if (activity) assert.equal(h.calls.filter(call => call === 'join').length, 1);
  }
});

test('shared activity decisions join and submit only an own unsubmitted round, then acknowledge the invitation', async () => {
  const invitation = { id: 'invite-one', type: 'activity-invitation', expiresAt: new Date(90_000).toISOString(), payload: { eventId: 'event-one', event: { type: 'duel', title: '共同單挑' }, joinClosesAt: 30_000 } };
  const joined = fixture({ items: [invitation], preferences: { autoReply: false, autoActivities: true }, adapter: async context => ({ action: context.allowedActions[0], text: '' }) });
  assert.equal((await joined.tick()).status, 'activity'); assert.deepEqual(joined.calls.slice(-2), ['join', 'ack']); assert.equal(joined.ledger.size, 0);
  const turn = { id: 'turn-one', type: 'activity-turn', expiresAt: new Date(45_000).toISOString(), payload: { eventId: 'event-one', matchId: 'match-one', round: 1 } };
  const player = fixture({ items: [turn], preferences: { autoReply: false, autoActivities: true }, adapter: async () => ({ action: 'guard', text: '' }) });
  const match = { id: 'match-one', type: 'duel', participantIds: [owner.id, 'other-agent'], participants: [owner, { id: 'other-agent', name: '對手', kind: 'agent' }], status: 'playing', currentRound: 1, maxRounds: 8, submitted: [false, true], roundDeadline: 45_000, scores: [0, 0], energy: [2, 2], history: [], pendingOpponentAction: 'PRIVATE_HIDDEN_MOVE' };
  player.client.getActivities = async () => ({ myMatches: [match] });
  let moved; player.client.moveActivity = async (id, body) => { moved = { id, body }; player.calls.push('move'); };
  assert.equal((await player.tick()).status, 'activity'); assert.equal(moved.id, 'match-one'); assert.equal(moved.body.round, 1); assert.equal(moved.body.action, 'guard'); assert.match(moved.body.submissionId, /^[a-f0-9-]{36}$/);
  assert.deepEqual(player.calls.slice(-2), ['move', 'ack']); assert.doesNotMatch(JSON.stringify(player.contexts[0]), /PRIVATE_|pendingOpponentAction|leaseToken/);
  const already = fixture({ items: [turn], preferences: { autoReply: false, autoActivities: true } }); already.client.getActivities = async () => ({ myMatches: [{ ...match, submitted: [true, true] }] });
  assert.equal((await already.tick()).status, 'skipped'); assert.equal(already.contexts.length, 0); assert.equal(already.calls.at(-1), 'ack');
});

test('Ollama uses local structured generation without tools or office authorization and rejects tool calls', async () => {
  let sent;
  const adapter = createOllamaAdapter({ model: 'installed-local-model', fetcher: async (url, request) => { sent = { url, request, body: JSON.parse(request.body) }; return Response.json({ done: true, message: { content: JSON.stringify({ action: 'reply', text: '真正生成的短回覆' }) } }); } });
  assert.deepEqual(await adapter({ version: 1, source: { text: '你好' } }), { action: 'reply', text: '真正生成的短回覆' });
  assert.equal(sent.url, 'http://127.0.0.1:11434/api/chat'); assert.equal(sent.body.stream, false); assert.deepEqual(sent.body.tools, []); assert.equal(sent.body.format.additionalProperties, false);
  assert.equal(sent.request.headers.Authorization, undefined);
  assert.throws(() => createOllamaAdapter({ model: 'model', url: 'https://external.invalid' }));
  const toolCall = createOllamaAdapter({ model: 'model', fetcher: async () => Response.json({ done: true, message: { content: '{}', tool_calls: [{}] } }) });
  await assert.rejects(toolCall({}), /Invalid local model response/);
});

test('trusted command adapter isolates env and cwd, preserves literal args, and bounds time/output/cancellation', async () => {
  const script = "let input='';for await(const chunk of process.stdin)input+=chunk;const p=JSON.parse(input);console.log(JSON.stringify({action:'reply',text:JSON.stringify({arg:process.argv.at(-1),cwd:process.cwd(),token:process.env.HEDO_OFFICE_TOKEN,cloud:process.env.OPENAI_API_KEY,source:p.source})}));";
  const adapter = createCommandAdapter({ command: process.execPath, args: ['--input-type=module', '-e', script, 'literal;$(never-executed)'], env: { PATH: process.env.PATH, HEDO_OFFICE_TOKEN: 'PRIVATE_TOKEN', OPENAI_API_KEY: 'PRIVATE_MODEL_KEY' } });
  const result = await adapter({ source: 'public-only' }), response = JSON.parse(result.text);
  assert.equal(response.arg, 'literal;$(never-executed)'); assert.equal(response.source, 'public-only'); assert.equal(response.token, undefined); assert.equal(response.cloud, undefined); await assert.rejects(access(response.cwd));
  assert.throws(() => createCommandAdapter({ command: 'node' }), /absolute/);
  const slow = createCommandAdapter({ command: process.execPath, args: ['-e', 'setInterval(()=>{},1000)'], timeoutMs: 30 }); await assert.rejects(slow({}), /timed out/);
  const huge = createCommandAdapter({ command: process.execPath, args: ['-e', "process.stdin.resume();process.stdout.write('x'.repeat(9000))"] }); await assert.rejects(huge({}), /too large|input failed/);
  const controller = new AbortController(); controller.abort(); await assert.rejects(adapter({}, { signal: controller.signal }), { name: 'AbortError' });
});

test('HTTP transport fixes endpoint paths, sends credentials only to office, and CLI defaults cannot opt in silently', async () => {
  const requests = [], client = createSocialClient({ token: 'a'.repeat(64), fetcher: async (url, request) => { requests.push({ url, request }); return Response.json({ application: owner, socialPreferences: { autoReply: false, autoActivities: false } }); } });
  await client.getStatus(); await client.getPreferences(); await client.claimInbox('safe-id');
  assert.deepEqual(requests.map(row => new URL(row.url).pathname), ['/api/office/me', '/api/office/social-preferences', '/api/office/inbox/safe-id/claim']);
  assert.ok(requests.every(row => row.request.redirect === 'error' && row.request.headers.Authorization === `Bearer ${'a'.repeat(64)}`));
  assert.throws(() => client.claimInbox('../admin'), /Invalid inbox ID/);
  const options = parseSocialArgs(['--ollama-model', 'existing-model']); assert.equal(options.enableChat, undefined); assert.equal(options.enableActivities, undefined);
  assert.deepEqual(parseSocialArgs(['--adapter-command', process.execPath, '--adapter-arg', '--literal']).adapterArgs, ['--literal']);
  assert.throws(() => parseSocialArgs(['--cooldown-seconds', '0'])); assert.throws(() => parseSocialArgs(['--unknown']));
  assert.throws(() => validateSocialDecision({ action: 'reply', text: '' })); assert.throws(() => validateSocialDecision({ action: 'reply', text: 'x'.repeat(501) }));
});

function realOffice(t) {
  const db = new DatabaseSync(':memory:'); t.after(() => db.close()); let time = 0;
  const sql = { exec(query, ...values) { let rows = []; if (!values.length && query.includes(';')) db.exec(query); else { const statement = db.prepare(query); if (statement.columns().length) rows = statement.all(...values); else statement.run(...values); } return { toArray: () => rows, one: () => { assert.equal(rows.length, 1); return rows[0]; } }; } };
  const storage = { transactionSync(fn) { db.exec('BEGIN'); try { const result = fn(); db.exec('COMMIT'); return result; } catch (error) { db.exec('ROLLBACK'); throw error; } } };
  // Only admission setup is synthetic. All office/social/activity routes, SQL,
  // credentials, claims, receipts and runner HTTP requests are the real code.
  const admin = { configuration: async () => ({}), signature: async () => 'synthetic-social-admission' };
  const office = new OfficeStore(sql, storage, {}, { now: () => time, admin });
  const fetcher = (url, init = {}) => office.fetch(new Request(url, init));
  const call = (path, token, body) => fetcher(`https://office.example/api/office${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  async function seat(name) {
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
    const response = await call('/apply', null, { token, kind: 'agent', name, role: '測試模型社交', intro: '公開簡介', contact: 'PRIVATE_REAL_CONTACT', departmentFloor: 6 }); assert.equal(response.status, 202);
    const member = (await response.json()).application;
    sql.exec("UPDATE office_members SET admission_status='approved',approved_at=? WHERE id=?", new Date(time).toISOString(), member.id);
    return { id: member.id, token, client: createSocialClient({ token, url: 'https://office.example', fetcher }) };
  }
  return { sql, office, call, seat, fetcher, get time() { return time; }, setTime(value) { time = value; } };
}

test('two real OfficeStore clients exchange bounded automated replies and recover a committed response loss without duplicates', async t => {
  const h = realOffice(t), a = await h.seat('模型甲'), b = await h.seat('模型乙');
  assert.deepEqual(await a.client.getPreferences(), { autoReply: false, autoActivities: false, maxTurns: 4, cooldownSeconds: 60 });
  for (const seat of [a, b]) await seat.client.setPreferences({ autoReply: true, autoActivities: false, maxTurns: 4, cooldownSeconds: 30 });
  assert.equal((await h.call('/presence', b.token, { floor: 6, zone: 'focus', status: 'working', activity: '整理真正認領的交接任務' })).status, 200);
  const seed = await h.call('/messages', a.token, { text: '想一起聊聊今天的工作嗎？', recipientId: b.id }); assert.equal(seed.status, 201);
  let lost = false, callsB = 0;
  b.client = createSocialClient({ token: b.token, url: 'https://office.example', fetcher: async (url, init) => { const response = await h.fetcher(url, init); if (new URL(url).pathname.endsWith('/reply') && !lost && response.ok) { lost = true; await response.body.cancel(); throw new TypeError('synthetic connection loss after commit'); } return response; } });
  const stateB = createSocialState(), runB = () => runSocialTick({ client: b.client, state: stateB, now: () => h.time, adapter: async context => { callsB++; assert.equal(context.source.text, '想一起聊聊今天的工作嗎？'); assert.doesNotMatch(JSON.stringify(context), /PRIVATE_REAL_CONTACT|leaseToken|token_hash/); return { action: 'reply', text: '可以，我正在想怎麼整理交接。' }; } });
  assert.equal((await runB()).status, 'backoff'); h.setTime(5000); assert.equal((await runB()).status, 'replied'); assert.equal(callsB, 1);
  const stillWorking = await b.client.getStatus();
  assert.equal(stillWorking.presenceStatus, 'working'); assert.equal(stillWorking.activity, '整理真正認領的交接任務'); assert.equal(stillWorking.floor, 6); assert.equal(stillWorking.zone, 'focus');
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM office_messages WHERE member_id=?', b.id).one().n, 1);
  h.setTime(30_000);
  const stateA = createSocialState();
  assert.equal((await runSocialTick({ client: a.client, state: stateA, now: () => h.time, adapter: async context => { assert.equal(context.source.text, '可以，我正在想怎麼整理交接。'); return { action: 'reply', text: '那我們先把交接的重點說清楚。' }; } })).status, 'replied');
  const snapshot = await (await h.call('')).json(), replies = snapshot.messages.filter(message => message.automated);
  assert.equal(replies.length, 2); assert.equal(replies[0].recipientId, a.id); assert.equal(replies[1].recipientId, b.id);
  assert.equal(replies[1].replyToId, replies[0].id); assert.equal(replies[0].conversationId, replies[1].conversationId);
  assert.deepEqual(replies.map(message => message.turnIndex), [2, 3]);
  const restarted = await runSocialTick({ client: a.client, state: createSocialState(), now: () => h.time, adapter: async () => { assert.fail('Handled inbox entries must not rerun the model after a restart'); } }); assert.equal(restarted.status, 'idle');
  h.sql.exec("UPDATE office_members SET admission_status='revoked' WHERE id=?", b.id); assert.equal((await runB()).status, 'stopped');
});

test('two real runners opt into a shared activity, choose their own eight rounds and observe one server result', async t => {
  const h = realOffice(t), a = await h.seat('選招模型甲'), b = await h.seat('選招模型乙'), event = getOfficeEvent(0); h.setTime(event.startsAt);
  for (const seat of [a, b]) await seat.client.setPreferences({ autoReply: false, autoActivities: true, maxTurns: 4, cooldownSeconds: 30 });
  const contexts = [], run = seat => runSocialTick({ client: seat.client, state: seat.state ||= createSocialState(), now: () => h.time, adapter: async context => { contexts.push(context); assert.ok(!JSON.stringify(context).includes('leaseToken')); return { action: context.mode === 'activity-invitation' ? 'join' : context.allowedActions[0], text: '' }; } });
  assert.equal((await run(a)).status, 'activity'); assert.equal((await run(b)).status, 'activity');
  let own = await a.client.getActivities(); assert.equal(own.myMatches.length, 1); const matchId = own.myMatches[0].id;
  for (let round = 1; round <= 8; round++) { assert.equal((await run(a)).status, 'activity', `Agent A round ${round}`); assert.equal((await run(b)).status, 'activity', `Agent B round ${round}`); }
  own = await a.client.getActivities(); const match = own.myMatches.find(row => row.id === matchId);
  assert.equal(match.status, 'finished'); assert.equal(match.round, 8); assert.deepEqual(match.scores, [8, 8]); assert.equal(match.draw, true);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM office_event_moves WHERE match_id=?', matchId).one().n, 16);
  assert.equal(contexts.filter(context => context.mode === 'activity-turn').length, 16);
  assert.deepEqual(contexts.find(context => context.match?.currentRound === 2).match.history[0].actions, ['attack', 'attack']);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM office_messages').one().n, 0, 'Activity moves do not impersonate public speech');
});
