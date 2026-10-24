// Island applications share only the anonymous credential, never career queues.
export const ANONYMOUS_KEY = 'hedo-anonymous-v1';
const TOKEN = /^[a-f0-9]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function validReceipt(row) {
  return row && UUID.test(row.id || '') && ['pending', 'approved', 'rejected', 'withdrawn'].includes(row.status)
    && ['nickname', 'districtId', 'outfit', 'greeting', 'introduction', 'reason', 'reviewNote'].every(key => typeof row[key] === 'string')
    && Number.isFinite(Date.parse(row.createdAt)) && (row.reviewedAt === null || Number.isFinite(Date.parse(row.reviewedAt)));
}
export function createApplicationClient({ storage, fetcher = globalThis.fetch, random = globalThis.crypto, timeoutMs = 12000 } = {}) {
  let readyToken = null;
  let pending = null;
  let sending = null;
  const readToken = () => {
    try { const token = storage?.getItem(ANONYMOUS_KEY); return TOKEN.test(token || '') ? token : null; }
    catch { return null; }
  };
  const credential = () => {
    try {
      if (!storage) throw new Error();
      const stored = storage.getItem(ANONYMOUS_KEY);
      const token = TOKEN.test(stored || '') ? stored : Array.from(random.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, '0')).join('');
      storage.setItem(ANONYMOUS_KEY, token);
      if (storage.getItem(ANONYMOUS_KEY) !== token) throw new Error();
      return token;
    } catch { throw new Error('瀏覽器無法保存申請憑證。請允許本站儲存資料後再送出，以便日後查詢或撤回。'); }
  };
  async function api(path, { token, body, method = body ? 'POST' : 'GET' } = {}) {
    const response = await fetcher(path, {
      method, credentials: 'same-origin', cache: 'no-store',
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(timeoutMs),
    });
    let data;
    try { data = await response.json(); } catch { throw new Error('尚未取得完整回覆，請稍後查詢申請狀態。'); }
    if (!response.ok) throw Object.assign(new Error(data.message || '小島暫時無法連線，請稍後再試。'), { status: response.status, code: data.error });
    return data;
  }
  return {
    hasIdentity: () => Boolean(readToken()),
    hasPending: () => Boolean(pending),
    config: () => api('/api/island/config'),
    residents: () => api('/api/island/residents'),
    async mine() {
      const token = readToken();
      if (!token) return { applications: [] };
      try {
        const data = await api('/api/island/applications/mine', { token });
        if (!Array.isArray(data.applications) || !data.applications.every(validReceipt)) throw new Error('申請狀態回覆不完整，請重新查詢。');
        if (pending?.token === token && data.applications.some(row => row.id === pending.body.submissionId)) pending = null;
        return data;
      }
      catch (error) { if (error.status === 401) return { applications: [] }; throw error; }
    },
    submit(fields) {
      if (sending) return sending;
      // A failed receipt can already be committed server-side. Retain its exact
      // body and ID until a successful receipt or a definitive client rejection.
      sending = (async () => {
        const token = credential();
        if (pending && pending.token !== token) throw new Error('此瀏覽器的申請憑證已變更，請重新整理並查詢狀態。');
        if (!pending) pending = { token, body: { ...fields, version: 1, submissionId: random.randomUUID() } };
        try {
          if (readyToken !== token) { await api('/api/player', { body: { token } }); readyToken = token; }
          const result = await api('/api/island/applications', { token, body: pending.body });
          if (!validReceipt(result.application) || result.application.id !== pending.body.submissionId
            || ['nickname', 'districtId', 'outfit', 'greeting', 'introduction', 'reason'].some(key => result.application[key] !== pending.body[key].normalize('NFKC').trim())) throw new Error('尚未取得正確申請收據，請重試確認。');
          pending = null;
          return result;
        } catch (error) {
          if (error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429) pending = null;
          throw error;
        }
      })().finally(() => { sending = null; });
      return sending;
    },
    async withdraw(id) {
      const token = readToken();
      if (!token) throw new Error('找不到這筆申請的瀏覽器憑證。請回到原本送出申請的瀏覽器。');
      return api(`/api/island/applications/${encodeURIComponent(id)}`, { method: 'DELETE', token });
    },
  };
}
