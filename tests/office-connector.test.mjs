import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable, Writable } from 'node:stream';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import { createBridge, loadSettings, officeURL, saveSettings, serveStdio } from '../dist/office/hedo-office-mcp.mjs';
import { mcpHarness, initialization } from './office-mcp-harness.mjs';

const token = 'a'.repeat(64);
const connector = fileURLToPath(new URL('../dist/office/hedo-office-mcp.mjs', import.meta.url));
const rpc = (id, method, params) => ({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) });
const result = (id, value) => Response.json({ jsonrpc: '2.0', id, result: value });

test('connector negotiates protocol, forwards UTF-8 tools unchanged, and consumes notification responses', async () => {
  const requests = [];
  const bridge = createBridge({ token, fetcher: async (url, init) => {
    const body = JSON.parse(init.body); requests.push({ url, init, body });
    if (body.method === 'initialize') return result(body.id, { protocolVersion: '2025-06-18' });
    if (!Object.hasOwn(body, 'id')) return new Response(null, { status: 202 });
    return result(body.id, { content: [{ type: 'text', text: '米雅：會議後回部門。' }] });
  } });
  assert.equal((await bridge(rpc(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } }))).result.protocolVersion, '2025-06-18');
  assert.equal(await bridge({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
  const input = rpc('中文請求', 'tools/call', { name: 'post_message', arguments: { text: '大家好，來開會。' } });
  assert.equal((await bridge(input)).result.content[0].text, '米雅：會議後回部門。');
  assert.deepEqual(requests.at(-1).body, input);
  assert.equal(requests[0].init.headers['MCP-Protocol-Version'], '2025-11-25');
  assert.equal(requests.at(-1).init.headers['MCP-Protocol-Version'], '2025-06-18');
  assert.equal(requests.at(-1).init.headers.Authorization, `Bearer ${token}`);
  assert.equal(requests.at(-1).init.redirect, 'error');
  assert.equal(requests.at(-1).url, 'https://hodo.bvivify.com/api/office/mcp');
});

test('connector rejects invalid messages and never retries writes or leaks credentials on failures', async () => {
  let calls = 0;
  const bridge = createBridge({ token, fetcher: async () => { calls++; throw new Error(`private ${token}`); } });
  for (const input of [null, [], {}, { jsonrpc: '1.0', id: 1, method: 'ping' }, rpc(null, 'ping')]) assert.equal((await bridge(input)).error.code, -32600);
  assert.equal((await bridge(rpc(1, 'no-method'))).error.code, -32601);
  assert.equal(calls, 0);
  const failure = await bridge(rpc(2, 'tools/call', { name: 'create_task', arguments: { title: '請勿重送' } }));
  assert.equal(calls, 1); assert.equal(failure.id, 2); assert.doesNotMatch(JSON.stringify(failure), new RegExp(token));
  for (const status of [401, 403, 429, 503]) {
    const down = createBridge({ token, fetcher: async () => new Response(`private ${token}`, { status }) });
    const output = await down(rpc(3, 'ping'));
    assert.ok(output.error); assert.doesNotMatch(JSON.stringify(output), new RegExp(token));
  }
  const wrongId = createBridge({ token, fetcher: async () => result(999, {}) });
  assert.ok((await wrongId(rpc(4, 'ping'))).error);
});

test('stdio framing preserves split UTF-8 and recovers from malformed and oversized lines', async () => {
  const message = JSON.stringify(rpc(1, 'tools/call', { name: 'post_message', arguments: { text: '禾多開會' } }));
  const buffer = Buffer.from(message + '\n');
  const chunks = [...buffer].map(byte => Buffer.from([byte]));
  chunks.push(Buffer.from('invalid\n' + 'x'.repeat(70_000) + '\n' + JSON.stringify(rpc(2, 'ping'))));
  let text = ''; const forwarded = [];
  const output = new Writable({ write(chunk, _encoding, done) { text += chunk.toString(); done(); } });
  await serveStdio({ input: Readable.from(chunks), output, forward: async input => { forwarded.push(input); return { jsonrpc: '2.0', id: input.id, result: {} }; } });
  assert.equal(forwarded[0].params.arguments.text, '禾多開會');
  assert.deepEqual(forwarded.map(item => item.id), [1, 2]);
  const responses = text.trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(responses.map(item => item.id), [1, null, null, 2]);
  assert.deepEqual(responses.slice(1, 3).map(item => item.error.code), [-32700, -32600]);
});

test('private local settings default to canonical production and reject unsafe credential destinations', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'hedo-office-connector-')); t.after(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, 'credentials.json');
  await saveSettings(file, { token: token.toUpperCase() });
  const settings = await loadSettings({ env: {}, configPath: file });
  assert.equal(settings.token, token); assert.equal(settings.url, 'https://hodo.bvivify.com');
  if (process.platform !== 'win32') assert.equal((await stat(file)).mode & 0o777, 0o600);
  assert.equal((await loadSettings({ env: { HEDO_OFFICE_TOKEN: 'b'.repeat(64), HEDO_OFFICE_URL: 'http://127.0.0.1:4567' }, configPath: file })).url, 'http://127.0.0.1:4567');
  for (const value of ['http://example.com', 'https://private:secret@example.com', 'https://example.com/?token=secret', 'https://example.com/#secret', 'https://example.com/path', 'file:///tmp']) assert.throws(() => officeURL(value));
  await assert.rejects(saveSettings(file, { token: 'bad' }));
  assert.equal(JSON.parse(await readFile(file)).token, token);
});

function run(args, { env = {}, input = '' } = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, [connector, ...args], { env: { ...process.env, HEDO_OFFICE_TOKEN: '', HEDO_OFFICE_URL: '', HEDO_OFFICE_CONFIG: '', ...env }, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = ''; child.stdout.on('data', chunk => { out += chunk; }); child.stderr.on('data', chunk => { err += chunk; });
    child.on('error', reject); child.on('close', code => resolveRun({ code, out, err })); child.stdin.end(input);
  });
}

test('downloaded CLI setup hides the credential and check reads status without heartbeat or private contact', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'hedo-office-cli-')); t.after(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, 'credentials.json'), setup = await run(['--setup', '--config', file], { input: token + '\n' });
  assert.equal(setup.code, 0, setup.err); assert.doesNotMatch(setup.out + setup.err, new RegExp(token));
  assert.equal(JSON.parse(await readFile(file)).token, token);
  const requests = [];
  const server = createServer((request, response) => {
    requests.push({ method: request.method, path: request.url, token: request.headers.authorization });
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.end(JSON.stringify({ application: { name: '私有名字', contact: 'private@example.test', token, status: 'approved', floor: 3, departmentFloor: 6 } }));
  });
  await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen)); t.after(() => new Promise(resolveClose => server.close(resolveClose)));
  const check = await run(['--check', '--config', file], { env: { HEDO_OFFICE_URL: `http://127.0.0.1:${server.address().port}` } });
  assert.equal(check.code, 0, check.err);
  assert.deepEqual(JSON.parse(check.out), { connected: true, status: 'approved', departmentFloor: 6, floor: 3 });
  assert.doesNotMatch(check.out + check.err, /私有名字|private@example|aaaaaaaa/);
  assert.deepEqual(requests.map(request => [request.method, request.path]), [['GET', '/api/office/me']]);
  const invalid = await run(['--unknown', '--config', file]); assert.equal(invalid.code, 1);
});

test('downloadable stdio executable completes real Worker admission, seven-tool workflow and revocation over HTTP', { timeout: 15000 }, async t => {
  const h = mcpHarness(t), member = await h.apply(), auth = await h.login();
  const directory = await mkdtemp(join(tmpdir(), 'hedo-office-stdio-')); t.after(() => rm(directory, { recursive: true, force: true }));
  let requestCount = 0;
  const server = createServer(async (request, response) => {
    requestCount++;
    try {
      let body = ''; for await (const chunk of request) body += chunk;
      const reply = await h.call(request.url, { method: request.method, raw: body, extra: {
        Authorization: request.headers.authorization, Accept: request.headers.accept,
        'MCP-Protocol-Version': request.headers['mcp-protocol-version'],
      } });
      response.writeHead(reply.status, Object.fromEntries(reply.headers)); response.end(Buffer.from(await reply.arrayBuffer()));
    } catch { response.writeHead(500); response.end(); }
  });
  await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  t.after(() => new Promise(resolveClose => { server.closeAllConnections(); server.close(resolveClose); }));
  const child = spawn(process.execPath, [connector, '--config', join(directory, 'unused.json')], {
    env: { ...process.env, HEDO_OFFICE_TOKEN: member.token, HEDO_OFFICE_URL: `http://127.0.0.1:${server.address().port}` }, stdio: ['pipe', 'pipe', 'pipe'],
  });
  t.after(() => { if (child.exitCode === null) child.kill(); });
  let id = 0, stderr = ''; const pending = new Map(), lines = createInterface({ input: child.stdout });
  child.stderr.on('data', chunk => { stderr += chunk; });
  lines.on('line', text => {
    const message = JSON.parse(text); assert.doesNotMatch(text, new RegExp(member.token));
    const resolveReply = pending.get(message.id); assert.ok(resolveReply, 'stdio stdout must contain only matching JSON-RPC responses');
    pending.delete(message.id); resolveReply(message);
  });
  const send = (method, params) => new Promise(resolveReply => { const request = rpc(++id, method, params); pending.set(id, resolveReply); child.stdin.write(JSON.stringify(request) + '\n'); });
  const tool = async (name, args = {}) => { const reply = await send('tools/call', { name, arguments: args }); assert.ok(!reply.error); return reply.result; };
  assert.equal((await send('initialize', initialization('2025-11-25').params)).result.protocolVersion, '2025-11-25');
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  assert.equal((await tool('get_my_status')).structuredContent.application.status, 'pending');
  assert.equal((await tool('post_message', { text: 'Must wait for review' })).structuredContent.httpStatus, 403);
  await h.approve(member, auth);
  assert.equal((await send('tools/list')).result.tools.length, 7);
  assert.equal((await tool('update_presence', { floor: 4, zone: 'meeting', status: 'working', activity: '實際連線測試' })).isError, false);
  assert.equal((await tool('post_message', { text: '桌面 Agent 已準備好。' })).isError, false);
  const task = (await tool('create_task', { title: '產出可公開的交接摘要' })).structuredContent.task;
  assert.equal((await tool('claim_task', { taskId: task.id })).structuredContent.task.assigneeId, member.application.id);
  assert.equal((await tool('get_my_status')).structuredContent.application.floor, 6);
  assert.equal((await tool('complete_task', { taskId: task.id, result: '交接摘要已完成。' })).structuredContent.task.status, 'completed');
  const snapshot = (await tool('get_office')).structuredContent;
  assert.equal(snapshot.messages[0].text, '桌面 Agent 已準備好。'); assert.equal(snapshot.tasks[0].result, '交接摘要已完成。');
  await h.review(member.application.id, 'revoked', auth);
  assert.equal((await tool('update_presence', { zone: 'studio', status: 'working' })).structuredContent.httpStatus, 403);
  const countAtEnd = requestCount;
  const exited = new Promise(resolveExit => child.once('close', resolveExit)); child.stdin.end();
  assert.equal(await exited, 0, stderr); assert.equal(requestCount, countAtEnd, 'connector must not add automatic writes or heartbeat');
});

test('connector accepts a complete legitimate office snapshot larger than two MiB', async t => {
  const h = mcpHarness(t), member = await h.apply(); await h.approve(member);
  const now = new Date().toISOString();
  for (let index = 0; index < 199; index++) h.sql.exec("INSERT INTO office_members(id,token_hash,kind,name,role,intro,contact,admission_status,activity,created_at,updated_at) VALUES(?,?,'agent',?,?,?,'','approved',?,?,?)", crypto.randomUUID(), 'synthetic-snapshot-' + index, '名'.repeat(40), '職'.repeat(80), '介'.repeat(500), '工'.repeat(160), now, now);
  for (let index = 0; index < 150; index++) h.sql.exec("INSERT INTO office_tasks(id,title,description,status,created_by,assignee_id,result,created_at,updated_at) VALUES(?,?,?,'completed',?,?,?,?,?)", crypto.randomUUID(), '題'.repeat(100), '說'.repeat(1000), member.application.id, member.application.id, '果'.repeat(1000), now, now);
  let responseBytes = 0;
  const bridge = createBridge({ token: member.token, fetcher: async (url, init) => {
    const response = await h.call(new URL(url).pathname, { method: init.method, raw: init.body, extra: init.headers });
    responseBytes = (await response.clone().arrayBuffer()).byteLength; return response;
  } });
  const response = await bridge(rpc('full-office', 'tools/call', { name: 'get_office', arguments: {} }));
  assert.ok(responseBytes > 2 * 1024 * 1024); assert.equal(response.result.isError, false);
  assert.equal(response.result.structuredContent.members.length, 200); assert.equal(response.result.structuredContent.tasks.length, 150);
  assert.deepEqual(JSON.parse(response.result.content[0].text), response.result.structuredContent);
});
