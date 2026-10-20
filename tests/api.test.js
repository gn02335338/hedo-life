import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, MAX_BODY_BYTES, RateGuard, assertSameOrigin, bearerToken, readJson, tokenHash, validToken, validateCompletion } from '../worker/http.js';

const token = 'a'.repeat(64);
const validBody = { runId: '7ce894aa-4605-4bca-b31d-5317d32bb12e', roleId: 'ai', seed: 'api-test', actions: [{ type: 'choice', eventId: 'onboarding', index: 2 }] };

test('anonymous tokens are exact 256-bit hex and only hashes are derived', async () => {
  assert.equal(validToken(token.toUpperCase()), token);
  assert.equal(bearerToken(new Request('https://game.example/api/me', { headers: { Authorization: `Bearer ${token}` } })), token);
  assert.throws(() => validToken('short'), error => error instanceof ApiError && error.status === 401);
  assert.throws(() => bearerToken(new Request('https://game.example/api/me')));
  const hash = await tokenHash(token);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.notEqual(hash, token);
});

test('POST origin guard blocks foreign and null origins', () => {
  for (const origin of ['https://attacker.example', 'null']) {
    assert.throws(() => assertSameOrigin(new Request('https://game.example/api/player', { headers: { Origin: origin } })), error => error.status === 403);
  }
  assert.doesNotThrow(() => assertSameOrigin(new Request('https://game.example/api/player', { headers: { Origin: 'https://game.example' } })));
  assert.doesNotThrow(() => assertSameOrigin(new Request('https://game.example/api/player')));
});

test('JSON is object-only and streamed request bodies cannot exceed 64 KiB', async () => {
  const request = body => new Request('https://game.example/api/player', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  assert.deepEqual(await readJson(request('{"token":"ok"}')), { token: 'ok' });
  for (const body of ['[]', 'null', '{broken']) await assert.rejects(readJson(request(body)), error => error.status === 400);
  await assert.rejects(readJson(request('x'.repeat(MAX_BODY_BYTES + 1))), error => error.status === 413);
  await assert.rejects(readJson(new Request('https://game.example/api/player', { method: 'POST', body: '{}' })), error => error.status === 415);
});

test('completion input is bounded and prototype names cannot become roles', () => {
  assert.deepEqual(validateCompletion(validBody, { ai: {} }), validBody);
  for (const changes of [
    { roleId: '__proto__' }, { roleId: 'constructor' }, { runId: 'anything' },
    { seed: 42 }, { seed: 'x'.repeat(33) }, { actions: [] },
    { actions: Array(161).fill({ type: 'exit' }) },
    { actions: [{ type: 'choice', eventId: 'onboarding', index: 2.1 }] },
    { actions: [{ type: 'forged', endingId: 'nasdaq-ai' }] },
  ]) assert.throws(() => validateCompletion({ ...validBody, ...changes }, { ai: {} }), error => error.status === 400);
});

test('self-care action is accepted only for new-rule seeds and still requires replay validation', () => {
  const body={...validBody,seed:'e2-api-self-care',actions:[{type:'break'}]};
  assert.deepEqual(validateCompletion(body,{ai:{}}),body);
  const latest={...body,seed:'e3-api-self-care'};assert.deepEqual(validateCompletion(latest,{ai:{}}),latest);
  const images={...body,seed:'e4-api-self-care'};assert.deepEqual(validateCompletion(images,{ai:{}}),images);
  const video={...body,seed:'e5-api-self-care'};assert.deepEqual(validateCompletion(video,{ai:{}}),video);
  const kind={...body,seed:'e6-api-self-care'};assert.deepEqual(validateCompletion(kind,{ai:{}}),kind);
  const workday={...body,seed:'e7-api-self-care'};assert.deepEqual(validateCompletion(workday,{ai:{}}),workday);
  const career={...body,seed:'e8-api-self-care'};assert.deepEqual(validateCompletion(career,{ai:{}}),career);
  const balanced={...body,seed:'e9-api-self-care'};assert.deepEqual(validateCompletion(balanced,{ai:{}}),balanced);
  const paced={...body,seed:'e10-api-self-care'};assert.deepEqual(validateCompletion(paced,{ai:{}}),paced);
  const education={...body,seed:'e11-api-self-care'};assert.deepEqual(validateCompletion(education,{ai:{}}),education);
  for(const seed of ['api-test','e1-api-self-care']) assert.throws(()=>validateCompletion({...body,seed},{ai:{}}), error=>error.status===400);
});

test('manual career action is an e10/e11 envelope action whose timing is checked by replay',()=>{
  const body={...validBody,seed:'e10-api-career',actions:[{type:'career'}]};
  assert.deepEqual(validateCompletion(body,{ai:{}}),body);
  const latest={...body,seed:'e11-api-career'};assert.deepEqual(validateCompletion(latest,{ai:{}}),latest);
  for(const seed of ['api-test','e1-api-career','e8-api-career','e9-api-career'])assert.throws(()=>validateCompletion({...body,seed},{ai:{}}),error=>error.status===400);
});

test('rate guard allows ten per player per ten seconds and resets', () => {
  const guard = new RateGuard();
  for (let i = 0; i < 10; i++) guard.check('one', 1_000);
  assert.throws(() => guard.check('one', 1_001), error => error.status === 429);
  assert.doesNotThrow(() => guard.check('two', 1_001));
  assert.doesNotThrow(() => guard.check('one', 11_000));
});
