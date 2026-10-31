const names = ['start', 'desktop', 'cloud', 'api'];
const tabs = [...document.querySelectorAll('[role="tab"]')];
const panels = names.map(name => document.getElementById(name));
const status = document.getElementById('status');
let messageTimer;

function announce(message) {
  clearTimeout(messageTimer);
  status.textContent = message; status.classList.add('visible');
  messageTimer = setTimeout(() => status.classList.remove('visible'), 4000);
}

function activate(name, { push = false, focus = false } = {}) {
  if (!names.includes(name)) name = 'start';
  for (const tab of tabs) {
    const active = tab.getAttribute('aria-controls') === name;
    tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1;
    if (active && focus) tab.focus();
  }
  for (const panel of panels) panel.hidden = panel.id !== name;
  if (push && location.hash !== `#${name}`) history.pushState(null, '', `#${name}`);
}

document.querySelector('.tabs').addEventListener('click', event => {
  const tab = event.target.closest('[role="tab"]');
  if (!tab || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault(); activate(tab.getAttribute('aria-controls'), { push: true });
});
document.querySelector('.tabs').addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const index = tabs.indexOf(event.target.closest('[role="tab"]')); if (index < 0) return;
  event.preventDefault();
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
  activate(names[next], { push: true, focus: true });
});
document.querySelectorAll('[data-open-tab]').forEach(link => link.addEventListener('click', event => {
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault(); activate(link.dataset.openTab, { push: true, focus: true });
  document.getElementById(link.dataset.openTab).scrollIntoView({ block: 'start' });
}));
window.addEventListener('hashchange', () => activate(location.hash.slice(1)));
window.addEventListener('popstate', () => activate(location.hash.slice(1)));
activate(location.hash.slice(1));

document.querySelectorAll('[data-copy]').forEach(button => button.addEventListener('click', async () => {
  const text = document.getElementById(button.dataset.copy).textContent;
  try { await navigator.clipboard.writeText(text); announce(['setup-command', 'check-command', 'desktop-config', 'desktop-toml'].includes(button.dataset.copy) ? '已複製。請先替換範例路徑，再貼到自己的執行環境。' : '已複製。'); }
  catch { announce('這個瀏覽器無法直接複製，請選取上方文字後複製。'); }
}));

document.getElementById('download-guide').addEventListener('click', async event => {
  event.preventDefault();
  const button = event.currentTarget;
  if (button.getAttribute('aria-busy') === 'true') return;
  button.setAttribute('aria-busy', 'true');
  try {
    const response = await fetch(button.href, { credentials: 'same-origin', signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error('download failed');
    const text = new TextDecoder('utf-8', { fatal: true }).decode(await response.arrayBuffer());
    const file = new Blob(['\ufeff', text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(file), link = document.createElement('a');
    link.href = url; link.download = button.download; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000); announce('指南已準備下載，使用 UTF-8 中文編碼。');
  } catch { announce('目前無法下載指南，請稍後重試；網頁上的內容仍可直接閱讀。'); }
  finally { button.removeAttribute('aria-busy'); }
});
