const $ = selector => document.querySelector(selector);
const tokenInput = $('#office-token');
let authorization = null, busy = false;

function message(text) { $('#message').textContent = text; }
function setBusy(value) {
  busy = value;
  for (const button of document.querySelectorAll('button')) button.disabled = value;
  tokenInput.disabled = value;
}
async function api(path, options = {}) {
  const response = await fetch(path, { cache: 'no-store', credentials: 'same-origin', redirect: 'error', ...options });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || '連線暫時無法完成，請稍後重試。');
  return data;
}
async function submit(approve) {
  if (busy || !authorization) return;
  const officeToken = tokenInput.value.trim().toLowerCase();
  if (approve && !/^[a-f0-9]{64}$/.test(officeToken)) { message('請輸入 64 碼 Agent 席位憑證。'); tokenInput.focus(); return; }
  setBusy(true); message(approve ? '正在確認授權…' : '正在取消連線…');
  try {
    const body = { requestId: authorization.requestId, csrfToken: authorization.csrfToken, approve };
    if (approve) body.officeToken = officeToken;
    const result = await api('/api/office/oauth/consent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    // The server created this URL from an exact registered redirect. The
    // browser still checks its origin/path against the displayed request.
    const target = new URL(result.redirectUrl), registered = new URL(authorization.redirectUri);
    if (target.origin !== registered.origin || target.pathname !== registered.pathname || target.username || target.password || target.hash) throw new Error('回呼網址不符，請重新連線。');
    tokenInput.value = '';
    authorization = null;
    window.location.replace(target.href);
  } catch (error) { message(error.message); setBusy(false); }
}
$('#consent-form').addEventListener('submit', event => { event.preventDefault(); void submit(true); });
$('#deny').addEventListener('click', () => { void submit(false); });
$('#use-saved').addEventListener('click', async () => {
  if (busy || !authorization) return;
  setBusy(true); message('正在確認此瀏覽器的席位…');
  try {
    let saved = '';
    try { saved = localStorage.getItem('hedo-office-access-v1') || ''; } catch { /* Manual entry remains available. */ }
    if (!/^[a-f0-9]{64}$/i.test(saved)) throw new Error('此瀏覽器沒有可用的辦公室憑證，請手動輸入。');
    const result = await api('/api/office/me', { headers: { Authorization: `Bearer ${saved}` } });
    if (result.application?.kind !== 'agent' || result.application?.status !== 'approved') throw new Error('此瀏覽器的席位不是已核准的 Agent，請輸入另一組憑證。');
    tokenInput.value = saved;
    message(`已選擇 ${result.application.name}。確認權限後，按「同意並連接」完成授權。`);
  } catch (error) { message(error.message); }
  finally { setBusy(false); }
});
window.addEventListener('pagehide', () => { tokenInput.value = ''; authorization = null; });

async function initialize() {
  try {
    const query = new URLSearchParams(window.location.search), ids = query.getAll('request_id');
    if (ids.length !== 1 || !/^[a-f0-9]{64}$/i.test(ids[0])) throw new Error('缺少有效授權請求。請回到雲端 Agent，重新開始連接辦公室。');
    authorization = await api(`/api/office/oauth/request?request_id=${encodeURIComponent(ids[0])}`);
    $('#client-name').textContent = authorization.clientName;
    $('#client-id').textContent = authorization.clientId;
    $('#redirect-uri').textContent = authorization.redirectUri;
    $('#resource').textContent = authorization.resource;
    for (const permission of authorization.permissions) { const item = document.createElement('li'); item.textContent = permission; $('#permissions').append(item); }
    $('#details').hidden = false;
    $('#loading').hidden = true;
  } catch (error) { $('#loading').hidden = true; message(error.message); }
}
void initialize();
