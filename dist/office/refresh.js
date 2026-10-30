// Polls share the current read. A forced refresh waits for that read, then
// shares one queued read with other force callers. A force request arriving
// after the queued read has started schedules another read, so writes never
// settle for a response whose request began before the write completed.
export function createRefreshQueue(load) {
  if (typeof load !== 'function') throw new TypeError('A refresh loader is required.');
  let active = null, queued = null;

  function deferred() {
    let resolve, reject;
    const promise = new Promise((accept, fail) => { resolve = accept; reject = fail; });
    return { promise, resolve, reject };
  }

  function finish() {
    active = null;
    if (!queued) return;
    const next = queued;
    queued = null;
    start().then(next.resolve, next.reject);
  }

  function start() {
    const current = deferred();
    active = current.promise;
    current.promise.then(finish, finish);
    // Set active before invoking the loader and handle synchronous failures in
    // the same way as rejected network reads. Neither failure locks the queue.
    try { Promise.resolve(load()).then(current.resolve, current.reject); }
    catch (error) { current.reject(error); }
    return current.promise;
  }

  return function refresh({ force = false } = {}) {
    if (!active) return start();
    if (!force) return active;
    if (!queued) queued = deferred();
    return queued.promise;
  };
}
