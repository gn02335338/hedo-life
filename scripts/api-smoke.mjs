import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createRun, applyChoice, advance, requestBreak, requestExit, canRequestBreak } from '../dist/engine.js';

const base = (process.env.API_BASE || 'http://127.0.0.1:4174').replace(/\/$/, '');
const parsed = new URL(base);
if (!['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)) {
  throw new Error('This smoke test creates anonymous test records. Run it only against local Wrangler.');
}
const token = () => randomBytes(32).toString('hex');
const first = token(), second = token();
async function call(path, { method = 'GET', auth, body, origin = parsed.origin, headers = {} } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      ...(method === 'POST' ? { Origin: origin, 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
  });
  assert.match(response.headers.get('Cache-Control') || '', /no-store/);
  return { status: response.status, body: await response.json(), headers: response.headers };
}
const status = (response, expected) => assert.equal(response.status, expected, JSON.stringify(response.body));
const health = await call('/api/health'); status(health, 200); assert.deepEqual(health.body, { ok: true, version: 3 });
const home = await fetch(base); assert.equal(home.status, 200); assert.match(await home.text(), /移動人生/);
const before = await call('/api/stats'); status(before, 200);
const player = await call('/api/player', { method: 'POST', body: { token: first } }); status(player, 200);
assert.deepEqual(player.body.unlocked, []); assert.equal(player.body.totalRuns, 0);
const again = await call('/api/player', { method: 'POST', body: { token: first } }); status(again, 200); assert.equal(again.body.playerId, player.body.playerId);
status(await call('/api/me'), 401);
status(await call('/api/me', { auth: token() }), 401);
status(await call('/api/player', { method: 'POST', origin: 'https://attacker.example', body: { token: first } }), 403);
status(await call('/api/player', { method: 'POST', body: '{broken' }), 400);
status(await call('/api/player', { method: 'POST', body: 'x'.repeat(65_537) }), 413);
status(await call('/api/player', { method: 'POST', body: { token: 'invalid' } }), 401);

const seed = `smoke-${Date.now()}`;
let run = createRun('ai', seed);
run = advance(applyChoice(run, 2));
assert.equal(run.completed, true);
const completion = { runId: randomUUID(), roleId: 'ai', seed, actions: run.actions };
status(await call('/api/complete', { method: 'POST', body: completion }), 401);
status(await call('/api/complete', { method: 'POST', auth: first, body: { ...completion, actions: [{ type: 'choice', eventId: 'onboarding', index: 0 }] } }), 400);
status(await call('/api/complete', { method: 'POST', auth: first, body: { ...completion, roleId: '__proto__' } }), 400);
status(await call('/api/complete', { method: 'POST', auth: first, body: { ...completion, actions: [{ type: 'choice', eventId: 'forged-event', index: 2 }] } }), 400);

const completed = await call('/api/complete', { method: 'POST', auth: first, body: { ...completion, endingId: 'nasdaq-ai', stats: { boss: 100 } } });
status(completed, 200); assert.equal(completed.body.endingId, run.endingId); assert.notEqual(run.endingId, 'nasdaq-ai');
assert.equal(completed.body.totalRuns, 1); assert.equal(completed.body.duplicate, false);
const duplicate = await call('/api/complete', { method: 'POST', auth: first, body: completion });
status(duplicate, 200); assert.equal(duplicate.body.totalRuns, 1); assert.equal(duplicate.body.duplicate, true);
const me = await call('/api/me', { auth: first }); status(me, 200); assert.deepEqual(me.body.unlocked, [run.endingId]);

status(await call('/api/player', { method: 'POST', body: { token: second } }), 200);
status(await call('/api/complete', { method: 'POST', auth: second, body: completion }), 409);
const another = await call('/api/complete', { method: 'POST', auth: first, body: { ...completion, runId: randomUUID() } });
status(another, 200); assert.equal(another.body.totalRuns, 2); assert.deepEqual(another.body.unlocked, [run.endingId]);
const after = await call('/api/stats'); status(after, 200);
assert.equal(after.body.totalRuns, before.body.totalRuns + 2);
// The UI counts a first-day exit as one turn, rather than the zero-based engine index.
if (before.body.totalRuns === 0) assert.equal(after.body.averageTurns, 1, 'first-day exits must count as one displayed turn');
assert.equal(after.body.players, before.body.players + 2);
assert.equal(after.body.roles.find(row => row.id === 'ai').count, (before.body.roles.find(row => row.id === 'ai')?.count || 0) + 2);
assert.equal(after.body.endings.find(row => row.id === run.endingId).count, (before.body.endings.find(row => row.id === run.endingId)?.count || 0) + 2);
assert.ok(after.body.daily.length > 0);
const serializedStats = JSON.stringify(after.body);
assert.ok(!serializedStats.includes(player.body.playerId)); assert.ok(!serializedStats.includes(first));
assert.deepEqual(Object.keys(after.body).sort(), ['averageTurns', 'daily', 'endings', 'players', 'roles', 'totalRuns', 'uniqueEndings'].sort());

// Verify the real server can replay the new self-care action, with a separate local identity.
const restToken=token();
status(await call('/api/player',{method:'POST',body:{token:restToken}}),200);
let rested;
for(let i=0;i<100;i++){
  const candidate=advance(applyChoice(createRun('system',`e5-api-break-${i}`),0));
  if(canRequestBreak(candidate)){rested=candidate;break;}
}
assert.ok(rested,'expected a natural workday eligible for self-care');
rested=requestBreak(rested);
rested=advance(applyChoice(rested,0));
rested=requestExit(rested);
rested=advance(applyChoice(rested,0));
assert.equal(rested.completed,true);
const restCompletion={runId:randomUUID(),roleId:rested.roleId,seed:rested.seed,actions:rested.actions};
const restRecorded=await call('/api/complete',{method:'POST',auth:restToken,body:restCompletion});
status(restRecorded,200);assert.equal(restRecorded.body.endingId,rested.endingId);
const forgedBreak={...restCompletion,runId:randomUUID(),actions:[{type:'break'},...rested.actions]};
status(await call('/api/complete',{method:'POST',auth:restToken,body:forgedBreak}),400);

const rateToken = token();
status(await call('/api/player', { method: 'POST', body: { token: rateToken } }), 200);
for (let i = 0; i < 9; i++) status(await call('/api/me', { auth: rateToken }), 200);
const limited = await call('/api/me', { auth: rateToken }); status(limited, 429); assert.equal(limited.headers.get('Retry-After'), '10');
status(await call('/api/does-not-exist'), 404);
status(await call('/api/player'), 405);
console.log('API smoke passed: static assets, health, registration, hash identity, bearer auth, origin/body guards, replay validation, idempotency, run ownership, unique collection, aggregate privacy, self-care replay and tamper rejection, rate guard.');
