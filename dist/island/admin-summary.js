const SUMMARY_URL = '/api/island/application-summary';

// This badge reads a public count. It does not create an identity or read storage.
export function createIslandAdminSummary({
  badge,
  fetcher = globalThis.fetch,
  windowTarget = globalThis.window,
  documentTarget = globalThis.document,
  setTimeoutImpl = globalThis.setTimeout,
  clearTimeoutImpl = globalThis.clearTimeout,
  intervalMs = 60000,
  timeoutMs = 12000,
} = {}) {
  if (!badge) return { refresh: async () => null, dispose() {} };
  let disposed = false, pageActive = true, version = 0, pollTimer = null, active = null;
  const foreground = () => !disposed && pageActive && documentTarget?.visibilityState !== 'hidden';
  const render = (state, pending) => {
    const label = state === 'ready' ? `待審核上島申請 ${pending} 件`
      : state === 'loading' ? '正在取得待審核申請數量' : '待審核申請數量暫時無法取得';
    badge.textContent = state === 'ready' ? String(pending) : state === 'loading' ? '…' : '—';
    badge.dataset.state = state;
    badge.dataset.pending = String(state === 'ready' && pending > 0);
    badge.title = label;
    badge.setAttribute('aria-label', label);
  };
  const clearPoll = () => {
    if (pollTimer !== null) clearTimeoutImpl(pollTimer);
    pollTimer = null;
  };
  const cancelRequest = () => {
    version++;
    if (active) {
      clearTimeoutImpl(active.timeout);
      active.controller.abort();
      active = null;
    }
  };
  const pause = () => { clearPoll(); cancelRequest(); };
  const schedule = () => {
    clearPoll();
    if (foreground()) pollTimer = setTimeoutImpl(() => { pollTimer = null; void refresh(); }, intervalMs);
  };
  async function refresh() {
    if (!foreground()) return null;
    clearPoll(); cancelRequest();
    const current = version, controller = new AbortController(), request = { controller, timeout: null };
    active = request;
    request.timeout = setTimeoutImpl(() => {
      if (disposed || current !== version) return;
      cancelRequest();
      render('unknown');
      schedule();
    }, timeoutMs);
    try {
      const response = await fetcher(SUMMARY_URL, { method: 'GET', mode: 'same-origin', credentials: 'omit', cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error('Summary unavailable');
      const data = await response.json();
      if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length !== 1
        || !Number.isSafeInteger(data.pending) || data.pending < 0) throw new Error('Invalid summary');
      if (!foreground() || current !== version) return null;
      render('ready', data.pending);
      return data.pending;
    } catch {
      if (foreground() && current === version) render('unknown');
      return null;
    } finally {
      clearTimeoutImpl(request.timeout);
      if (active === request) active = null;
      if (current === version) schedule();
    }
  }
  const onFocus = () => { if (foreground()) void refresh(); };
  const onVisibility = () => { if (foreground()) void refresh(); else pause(); };
  const onPageHide = () => { pageActive = false; pause(); };
  const onPageShow = () => { pageActive = true; if (foreground()) void refresh(); };
  windowTarget?.addEventListener('focus', onFocus);
  windowTarget?.addEventListener('pagehide', onPageHide);
  windowTarget?.addEventListener('pageshow', onPageShow);
  documentTarget?.addEventListener('visibilitychange', onVisibility);
  render('loading');
  void refresh();
  return {
    refresh,
    dispose() {
      if (disposed) return;
      disposed = true;
      pause();
      windowTarget?.removeEventListener('focus', onFocus);
      windowTarget?.removeEventListener('pagehide', onPageHide);
      windowTarget?.removeEventListener('pageshow', onPageShow);
      documentTarget?.removeEventListener('visibilitychange', onVisibility);
    },
  };
}
