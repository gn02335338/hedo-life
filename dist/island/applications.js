import { createApplicationClient } from './application-client.js';
import { DISTRICTS } from './content.js';
import { OUTFITS, normalizeResidents } from './residents.js';
const $ = selector => document.querySelector(selector);
const statusLabels = { pending: '等待審核', approved: '已經上島', rejected: '未通過／已下島', withdrawn: '已撤回' };
function node(tag, className, text) {
  const item = document.createElement(tag); if (className) item.className = className;
  if (text !== undefined) item.textContent = text; return item;
}
function button(text, action, className = 'application-text-button') {
  const item = node('button', className, text); item.type = 'button'; item.addEventListener('click', action); return item;
}
export function residentAvatar(outfit) {
  const avatar = node('span', 'resident-avatar'); avatar.setAttribute('aria-hidden', 'true');
  avatar.style.setProperty('--outfit', OUTFITS.find(item => item.id === outfit)?.color || OUTFITS[0].color); return avatar;
}
function profile(row, introduction = true) {
  const card = node('div', 'resident-profile'), copy = node('div', 'resident-profile-copy');
  copy.append(node('h3', '', row.nickname || '你的島民暱稱'), node('small', '', `${DISTRICTS.find(d => d.id === row.districtId)?.name || '選一個喜歡的角落'} · ${OUTFITS.find(o => o.id === row.outfit)?.label || '苔綠'}`), node('p', '', row.greeting || '一句招呼，讓路過的人停下腳步。'));
  if (introduction) copy.append(node('p', 'resident-introduction', row.introduction || '你的故事，會在對方選擇認識你之後出現。'));
  card.append(residentAvatar(row.outfit), copy); return card;
}
export function bindApplications({ storage, openDialog, closeDialog, onResidents, onMeet, stopTour, onChange = () => {} }) {
  const client = createApplicationClient({ storage });
  const dialog = $('#application-dialog'), form = $('#application-form'), fields = $('#application-fields');
  const submit = $('#application-submit'), refresh = $('#application-refresh'), message = $('#application-message'), submitMessage = $('#application-submit-message');
  const directory = $('#residents-dialog');
  let applications = [], enabled = false, loaded = false, busy = false, disposed = false, rosterBusy = false;
  let residents = [], rosterGeneration = 0, rosterQueued = false;
  const setMessage = (target, text, error = false) => { target.textContent = text; target.classList.toggle('is-error', error); };
  const data = () => Object.fromEntries(['nickname', 'districtId', 'outfit', 'greeting', 'introduction', 'reason'].map(key => [key, form.elements.namedItem(key).value.normalize('NFKC').trim()]));
  function updatePreview() { $('#application-preview-content').replaceChildren(profile(data())); }
  function lock() {
    const active = applications.some(row => ['pending', 'approved'].includes(row.status));
    form.hidden = active && !client.hasPending();
    fields.disabled = busy || !loaded || !enabled || client.hasPending();
    submit.disabled = busy || !loaded || (!enabled && !client.hasPending()) || (active && !client.hasPending());
    submit.textContent = busy ? '正在確認…' : client.hasPending() ? '重試確認這份申請 →' : '送出上島申請 →';
    refresh.disabled = busy;
    $('#application-history').querySelectorAll('button').forEach(item => { item.disabled = busy; });
  }
  function showHistory() {
    const container = $('#application-history'); container.replaceChildren();
    for (const row of applications) {
      const card = node('article', 'application-receipt'); card.dataset.applicationId = row.id;
      const heading = node('h4'); heading.append(node('span', 'application-badge', statusLabels[row.status] || '狀態更新中'), document.createTextNode(row.nickname));
      card.append(heading, node('p', '', row.status === 'pending' ? '申請已收件。管理者審核通過前，你的角色與申請內容不會公開。' : row.status === 'approved' ? `歡迎上島！你的角色已出現在${DISTRICTS.find(d => d.id === row.districtId)?.name || '島上'}，路過的人可以和你聊聊。` : row.status === 'withdrawn' ? '已撤回，島上不再顯示這個角色。' : '目前沒有公開在島上。可以參考備註，修改後重新申請。'));
      if (row.reviewNote) card.append(node('p', '', `管理者備註（只有你看得到）：${row.reviewNote}`));
      const time = node('time', '', `申請時間：${new Date(row.createdAt).toLocaleString('zh-TW')}`); time.dateTime = row.createdAt; card.append(time);
      const detail = node('details'); detail.append(node('summary', '', '查看我的送出內容'), profile(row), node('p', '', `給管理者的理由：${row.reason}`)); card.append(detail);
      if (['pending', 'approved'].includes(row.status)) {
        const controls = node('div');
        controls.append(button(row.status === 'approved' ? '撤回申請並下島' : '撤回這份申請', () => {
          const confirmation = node('div', 'withdraw-confirm');
          confirmation.append(node('p', '', row.status === 'approved' ? '確定撤回嗎？角色會從公開名冊與後續載入的島嶼移除。' : '確定撤回嗎？管理者將無法再核准這份申請。'), button('確認撤回', () => withdraw(row)), button('先保留', () => showHistory()));
          controls.replaceChildren(confirmation); confirmation.querySelector('button').focus();
        })); card.append(controls);
      }
      container.append(card);
    }
  }
  async function refreshMine() {
    if (busy || disposed) return;
    busy = true; lock(); setMessage(message, '正在查詢申請狀態…');
    try {
      const [config, mine] = await Promise.all([client.config(), client.mine()]);
      if (disposed) return;
      enabled = config.enabled === true; loaded = true;
      if (!Array.isArray(mine.applications)) throw new Error('暫時無法讀取申請狀態，請重新查詢。');
      applications = mine.applications; showHistory();
      setMessage(message, !enabled ? '上島申請暫時關閉。已有的申請仍可在這裡查看與撤回。' : applications.length ? '審核結果會更新在這裡，請用這個瀏覽器回來查看。' : '你還沒有申請。填好下面的名片，就可以送給島務管理者。');
      if (!client.hasPending()) setMessage(submitMessage, '');
    } catch (error) { if (!disposed) { loaded = false; setMessage(message, error.message, true); } }
    finally { busy = false; if (!disposed) lock(); }
  }
  async function withdraw(row) {
    if (busy || disposed) return;
    busy = true; lock(); setMessage(message, '正在撤回申請…');
    try {
      const result = await client.withdraw(row.id);
      if (disposed) return;
      if (result.application?.id !== row.id || result.application?.status !== 'withdrawn') throw new Error('尚未確認撤回，請重新查詢狀態。');
      applications = applications.map(item => item.id === row.id ? result.application : item); showHistory();
      onChange();
      setMessage(message, '已撤回申請；公開角色已移除。'); message.focus({ preventScroll: true }); void loadResidents({ invalidate: true });
    } catch (error) { if (!disposed) setMessage(message, `${error.message} 請重新查詢，確認最新狀態。`, true); }
    finally { busy = false; if (!disposed) lock(); }
  }
  async function send(event) {
    event.preventDefault(); if (busy || disposed) return;
    const pending = client.hasPending();
    if (!pending && !form.reportValidity()) return;
    const values = data();
    if (!pending) {
      for (const [key, min, max, label] of [['nickname',2,16,'暱稱'],['greeting',2,80,'招呼'],['introduction',10,240,'自我介紹'],['reason',10,500,'申請理由']]) {
        const length = [...values[key]].length;
        if (length < min || length > max) { setMessage(submitMessage, `${label}請填 ${min}–${max} 字。`, true); form.elements.namedItem(key).focus(); return; }
      }
      if (Object.values(values).some(value => /[\u0000-\u001f\u007f-\u009f\u061c\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff<>]/u.test(value))) {
        setMessage(submitMessage, '請使用單段純文字，移除換行、標籤或隱藏字元。', true); return;
      }
    }
    busy = true; lock(); setMessage(submitMessage, '正在送出，請稍候…');
    try {
      const result = await client.submit({ ...values, consent: form.elements.namedItem('consent').checked });
      if (disposed) return;
      applications = [result.application, ...applications.filter(item => item.id !== result.application.id)];
      showHistory(); form.reset(); updatePreview();
      onChange();
      setMessage(message, result.application.status === 'pending' ? '申請已送達！接下來等待島務管理者審核。' : '已確認這份申請的最新狀態。'); setMessage(submitMessage, '');
      message.focus({ preventScroll: true }); message.scrollIntoView({ block: 'nearest' });
    } catch (error) {
      if (!disposed) setMessage(submitMessage, client.hasPending() ? `${error.message} 尚未確認是否收件；請按「重試確認這份申請」或「重新查詢」，不會重複送件。` : error.message, true);
    } finally { busy = false; if (!disposed) lock(); }
  }
  function showDirectory() {
    const container = $('#residents-list'); container.replaceChildren();
    for (const row of residents) {
      const card = node('article', 'resident-card'); card.append(profile(row, false), button('聽聽島上故事 →', () => { closeDialog(directory); onMeet(row); })); container.append(card);
    }
    $('#resident-count').textContent = String(residents.length);
  }
  async function loadResidents({ invalidate = false } = {}) {
    if (disposed) return;
    if (invalidate) { rosterGeneration++; residents = []; onResidents([]); showDirectory(); }
    if (rosterBusy) { rosterQueued = true; return; }
    const generation = rosterGeneration;
    rosterBusy = true; $('#residents-refresh').disabled = true; $('#residents-message').textContent = '正在更新島民名冊…';
    try {
      const payload = await client.residents(); if (disposed || generation !== rosterGeneration) return;
      const normalized = normalizeResidents(payload);
      if (!Array.isArray(payload.residents) || payload.version !== 1 || normalized.length !== payload.residents.length) throw new Error('名冊資料尚未完整，請稍後重新載入。');
      residents = normalized; onResidents(residents); showDirectory();
      $('#residents-message').textContent = residents.length ? `目前有 ${residents.length} 位新島民。` : '第一張名片，正在等人寫下。你也可以申請成為島上的新鄰居。';
    } catch { if (!disposed && generation === rosterGeneration) { residents = []; onResidents([]); showDirectory(); $('#residents-message').textContent = '暫時無法載入最新名冊，請稍後按「更新名冊」。小島其他故事照常開放。'; } }
    finally { rosterBusy = false; if (!disposed) { $('#residents-refresh').disabled = false; if (rosterQueued) { rosterQueued = false; void loadResidents(); } } }
  }
  const open = () => { stopTour(); openDialog(dialog); void refreshMine(); };
  for (const district of DISTRICTS) { const option = node('option', '', district.name); option.value = district.id; form.elements.namedItem('districtId').append(option); }
  for (const outfit of OUTFITS) {
    const label = node('label'), input = node('input'); input.type = 'radio'; input.name = 'outfit'; input.value = outfit.id; input.checked = input.defaultChecked = outfit.id === 'teal'; input.required = true;
    const choice = node('span', 'outfit-option'), dot = node('span', 'outfit-dot'); dot.style.setProperty('--outfit', outfit.color); choice.append(dot, document.createTextNode(outfit.label)); label.append(input, choice); $('#application-outfits').append(label);
  }
  form.addEventListener('input', updatePreview); form.addEventListener('submit', send); refresh.addEventListener('click', () => { void refreshMine(); void loadResidents(); });
  $('#application-open').addEventListener('click', open);
  $('#residents-open').addEventListener('click', () => { stopTour(); openDialog(directory); void loadResidents(); });
  $('#residents-apply').addEventListener('click', () => { closeDialog(directory); open(); });
  $('#residents-refresh').addEventListener('click', loadResidents);
  updatePreview(); void loadResidents();
  let lastVisibleRefresh = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - lastVisibleRefresh > 30000) { lastVisibleRefresh = Date.now(); void loadResidents(); }
  });
  window.addEventListener('pagehide', () => { disposed = true; applications = []; form.reset(); $('#application-history').replaceChildren(); message.textContent = ''; submitMessage.textContent = ''; }, { once: true });
  return { loadResidents, getResidents: () => residents };
}
