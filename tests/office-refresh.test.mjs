import test from 'node:test';
import assert from 'node:assert/strict';
import { createRefreshQueue } from '../dist/office/refresh.js';

function deferred() {
  let resolve, reject;
  const promise = new Promise((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
}

test('polls coalesce, while mutation refreshes wait for one read started after the mutation', async () => {
  let version = 0, inFlight = 0, maximumInFlight = 0;
  const reads = [];
  const refresh = createRefreshQueue(() => {
    const response = deferred(), captured = version;
    inFlight++; maximumInFlight = Math.max(maximumInFlight, inFlight);
    reads.push({ response, captured });
    return response.promise.finally(() => { inFlight--; });
  });

  const poll = refresh(), follower = refresh();
  assert.equal(reads.length, 1);
  version = 1; // A task mutation completes while the old poll is delayed.
  const afterMutation = refresh({ force: true }), forceFollower = refresh({ force: true });
  assert.equal(reads.length, 1, 'a fresh read must wait instead of racing the old poll');

  reads[0].response.resolve(reads[0].captured);
  assert.equal(await poll, 0); assert.equal(await follower, 0);
  assert.equal(reads.length, 2);
  assert.equal(reads[1].captured, 1);
  reads[1].response.resolve(reads[1].captured);
  assert.equal(await afterMutation, 1); assert.equal(await forceFollower, 1);
  assert.equal(reads.length, 2, 'concurrent force callers share the fresh read');
  assert.equal(maximumInFlight, 1);
});

test('a mutation during the queued read requires another read begun after that newer mutation', async () => {
  let version = 0;
  const reads = [];
  const refresh = createRefreshQueue(() => {
    const response = deferred(); reads.push({ ...response, captured: version }); return response.promise;
  });
  const oldPoll = refresh(); version = 1;
  const firstMutation = refresh({ force: true });
  reads[0].resolve(reads[0].captured); await oldPoll;
  assert.equal(reads.length, 2);

  version = 2;
  const newerMutation = refresh({ force: true }), anotherFollower = refresh({ force: true });
  reads[1].resolve(reads[1].captured);
  assert.equal(await firstMutation, 1);
  assert.equal(reads.length, 3);
  assert.equal(reads[2].captured, 2);
  reads[2].resolve(reads[2].captured);
  assert.equal(await newerMutation, 2); assert.equal(await anotherFollower, 2);
  assert.equal(reads.length, 3);
});

test('a failed old poll propagates its error and still permits the queued fresh read and later retries', async () => {
  const reads = [];
  const refresh = createRefreshQueue(() => { const response = deferred(); reads.push(response); return response.promise; });
  const error = new Error('Connection interrupted'), poll = refresh();
  const failedPoll = assert.rejects(poll, candidate => candidate === error);
  const forced = refresh({ force: true });
  reads[0].reject(error); await failedPoll;
  assert.equal(reads.length, 2);
  reads[1].resolve('fresh'); assert.equal(await forced, 'fresh');

  const failedFresh = refresh(), failure = assert.rejects(failedFresh, /Service unavailable/);
  reads[2].reject(new Error('Service unavailable')); await failure;
  const retry = refresh(); assert.equal(reads.length, 4);
  reads[3].resolve('recovered'); assert.equal(await retry, 'recovered');
});

test('a synchronous loader failure rejects its caller without leaving the queue locked', async () => {
  let attempts = 0;
  const refresh = createRefreshQueue(() => {
    if (++attempts === 1) throw new Error('Cannot begin the read');
    return 'ready';
  });
  await assert.rejects(refresh(), /Cannot begin the read/);
  assert.equal(await refresh(), 'ready');
  assert.equal(attempts, 2);
});
