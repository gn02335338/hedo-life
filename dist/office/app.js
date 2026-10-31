import { OFFICE_CAST, OFFICE_ZONES, getOfficeRoster } from './model.js';
import { OFFICE_INTERACTION_TOPICS, getOfficeInteraction } from './interactions.js';
import { createRefreshQueue } from './refresh.js';
import { OFFICE_FLOORS, DEFAULT_OFFICE_FLOOR, getOfficeFloor, isOfficeFloor } from './floors.js';
import { adjacentOfficeFloor } from './view-navigation.js';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const TOKEN_KEY = 'hedo-office-access-v1';
const statusNames = {pending:'等待審核',approved:'已核准入駐',rejected:'申請未通過',revoked:'入駐已撤銷'};
const zoneNames = {studio:'共同工位',meeting:'會議區',lounge:'交誼區',focus:'主管室／專注區'};
const typeName = kind => kind === 'agent' ? 'Agent' : kind === 'human' ? '真人' : '遊戲角色';
let token = '', snapshot = null, own = null, scene = null, activeTab = 'people', rosterFilter = 'all', selectedZone = 'all';
let activeFloor=DEFAULT_OFFICE_FLOOR, buildingView=true, messageDraft='';
let roster = getOfficeRoster(), paused = matchMedia('(prefers-reduced-motion: reduce)').matches, frozenAt = paused ? Date.now() : null;
let connected = false, lastRefresh = 0, modalEpoch = 0, modalKind = '', toastTimer, csrf = '', adminTimer;
try { const saved = localStorage.getItem(TOKEN_KEY); if (/^[a-f0-9]{64}$/.test(saved)) token = saved; } catch { /* A visitor can still look around. */ }

function toast(message) {
  clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').classList.add('show');
  toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 4200);
}
async function api(path, {method='GET', body, auth=false, admin=false, login=false} = {}) {
  const headers = {Accept:'application/json'};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) { if (!token) throw new Error('請先申請加入辦公室。'); headers.Authorization = `Bearer ${token}`; }
  if (admin && method !== 'GET') headers['X-CSRF-Token'] = csrf;
  if (login) headers['X-Admin-Intent'] = 'private-archive';
  const response = await fetch(path, {method, headers, credentials:'same-origin', cache:'no-store', signal:AbortSignal.timeout(12000), ...(body !== undefined ? {body:JSON.stringify(body)} : {})});
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const message = result?.error?.message || (typeof result?.message === 'string' && result.message) || (response.status === 503 ? '入駐審核尚未開放，請稍後再來。' : response.status === 401 ? '請重新確認加入憑證或管理員登入。' : '目前無法完成，請稍後再試。');
    const error = new Error(message); error.status = response.status; throw error;
  }
  return result;
}
function avatar(member, large = false) {
  return `<span class="avatar ${esc(member.kind)}${large?' large':''}">${member.portrait ? `<img src="${esc(member.portrait)}" alt="" loading="lazy">` : member.kind === 'agent' ? '⌘' : esc(member.name.slice(0,1))}</span>`;
}
function normalizeRoster() {
  const members = (snapshot?.members || []).map(member => ({...member, online: connected && member.online && Date.now() - Date.parse(member.lastSeenAt) < 120000}));
  roster = getOfficeRoster(members, frozenAt ?? Date.now());
  scene?.setRoster(roster);
}
const floorLabel=value=>{const floor=getOfficeFloor(value)||OFFICE_FLOORS[0];return `${floor.id}F · ${floor.name}`;};
const scopeRoster=()=>buildingView?roster:roster.filter(person=>person.floor===activeFloor);
function renderFloorDirectory(){
  $('#floor-buttons').innerHTML=[...OFFICE_FLOORS].reverse().map(floor=>`<button type="button" class="floor-button" data-floor="${floor.id}" aria-pressed="false" style="--floor-color:${floor.color}"><span class="floor-number">${floor.id}<small>F</small></span><span class="floor-info"><strong>${esc(floor.name)}</strong><small data-floor-count="${floor.id}"></small></span><span class="floor-arrow" aria-hidden="true">↗</span></button>`).join('');
  $('#quick-floor').innerHTML='<option value="all">全棟透視 · 七層樓</option>'+[...OFFICE_FLOORS].reverse().map(floor=>`<option value="${floor.id}">${esc(floorLabel(floor.id))}</option>`).join('');
}
function updateFloorNavigation(){
  const floor=getOfficeFloor(activeFloor);
  $('#floor-tag').textContent=buildingView?'1–7 F':`${String(activeFloor).padStart(2,'0')} F`;
  $('#floor-title').textContent=buildingView?'禾多總部 · 全棟透視':floor.name;
  $('#floor-description').textContent=buildingView?'透過半透明外牆，看見七層同事的日常。點樓層或用上下樓拜訪。':floor.description;
  $('#presence-scope').textContent=buildingView?'整棟辦公室':`${activeFloor}F · ${floor.name}`;
  $('#building-view').classList.toggle('active',buildingView);$('#building-view').setAttribute('aria-pressed',String(buildingView));
  document.querySelectorAll('[data-floor]').forEach(button=>{const selected=!buildingView&&Number(button.dataset.floor)===activeFloor;button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected));});
  document.querySelectorAll('[data-floor-count]').forEach(label=>{const id=Number(label.dataset.floorCount);const home=roster.filter(p=>p.departmentFloor===id).length,present=roster.filter(p=>p.floor===id&&(p.kind==='character'||p.online)).length;label.textContent=id===1&&!home?`共享空間 · ${present} 位在場`:`${home} 位成員 · ${present} 位在場`;});
  document.querySelectorAll('[data-zone]').forEach(button=>{button.disabled=buildingView;const selected=button.dataset.zone===selectedZone;button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected));});
  $('#scene-hint').textContent=buildingView?'拖曳旋轉 · 點樓層或同事 · 上下樓快速切換':'拖曳旋轉 · 上下樓／PageUp、PageDown 切層';
  if(document.activeElement!==$('#quick-floor'))$('#quick-floor').value=buildingView?'all':String(activeFloor);
  $('#floor-up').disabled=!buildingView&&activeFloor===OFFICE_FLOORS.length;
  $('#floor-down').disabled=!buildingView&&activeFloor===1;
  $('#enter-floor').hidden=buildingView||own?.status!=='approved';$('#enter-floor').disabled=own?.floor===activeFloor||Boolean($('#enter-floor').dataset.busy);
  $('#enter-floor').textContent=own?.floor===activeFloor?'你已在本層':'搭電梯到本層 ↗';
  $('.office-stage').classList.toggle('building-overview',buildingView);
  if(scene)$('#scene-status').textContent=buildingView?'七層日常看得見':`${scopeRoster().filter(p=>p.kind==='character'||p.online).length} 位同事在這層`;
}
function selectFloor(id){
  if(!isOfficeFloor(id))return;
  activeFloor=id;buildingView=false;selectedZone='all';scene?.setFloor(id);updateFloorNavigation();renderCounters();renderPanel(true);
  $('#ambient-caption').textContent=getOfficeFloor(id).description;
}
function showBuilding(){
  buildingView=true;selectedZone='all';scene?.showBuilding();updateFloorNavigation();renderCounters();renderPanel(true);
  $('#ambient-caption').textContent='半透明的七層樓，每個部門的日常都看得見。';
}
function stepFloor(direction){const next=adjacentOfficeFloor(activeFloor,direction,buildingView);if(!buildingView&&next===activeFloor)return;selectFloor(next);}
function renderCounters() {
  const people=scopeRoster();
  $('#cast-count').textContent = people.filter(p=>p.kind==='character').length;
  $('#human-count').textContent = people.filter(p => p.kind === 'human' && p.online).length;
  $('#agent-count').textContent = people.filter(p => p.kind === 'agent' && p.online).length;
  $('#member-count').textContent = people.length;
  $('#connection').textContent = connected ? '已同步' : lastRefresh ? '連線中斷' : '連線中';
  $('#join').innerHTML = own ? '我的座位 <span>↗</span>' : '申請入駐 <span>＋</span>';
  updateFloorNavigation();
}
function renderPeople() {
  let people = scopeRoster().filter(p => selectedZone === 'all' || p.zone === selectedZone);
  if (rosterFilter !== 'all') people = people.filter(p => p.kind === rosterFilter);
  people.sort((a,b) => (a.kind === 'character') - (b.kind === 'character'));
  $('#panel').innerHTML = `<div class="roster-tools"><p>${buildingView?'跨樓層找同事，點選名字就能拜訪。':selectedZone==='all'?esc(getOfficeFloor(activeFloor).department):esc(zoneNames[selectedZone])}</p><select id="roster-filter" aria-label="篩選同事類型"><option value="all">所有同事</option><option value="character">遊戲角色</option><option value="human">真人</option><option value="agent">Agent</option></select></div>${people.length ? people.map(member => `<button class="person-row" data-person="${esc(member.id)}">${avatar(member)}<span class="person-info"><div><span class="person-name">${esc(member.name)}</span>${member.kind === 'character' ? `<span class="person-role">${esc(member.title)}</span>` : `<span class="type-tag ${esc(member.kind)}">${typeName(member.kind)}</span>`}<span class="status-dot ${member.kind!=='character'&&!member.online?'offline':esc(member.status)}" aria-label="${member.kind==='character'?'角色日常':member.online?'在線':'離線'}"></span></div><p class="person-activity">${member.floor}F · ${member.kind!=='character'&&!member.online?'離線 · ':''}${esc(member.activity || member.role || '準備開工')}</p></span></button>`).join('') : `<div class="empty"><p class="empty-icon">＋</p><h3>這裡還有空位</h3><p>真人與 Agent 通過審核後，<br>就能一起坐進這間辦公室。</p><button class="primary" data-action="join">申請入駐 →</button></div>`}`;
  $('#roster-filter').value = rosterFilter;
}
const memberName = id => snapshot?.members?.find(member => member.id === id)?.name || '已離開的成員';
function renderTasks() {
  const tasks = snapshot?.tasks || [];
  $('#panel').innerHTML = `<div class="panel-action"><p>${tasks.filter(t=>t.status!=='completed').length} 項進行中的工作 · 全棟看板</p><button class="small-button" data-action="new-task">＋ 建立任務</button></div>${!connected?'<div class="notice">看板尚未連線，連線恢復後會更新。</div>':''}${tasks.length ? tasks.map(task => `<article class="task"><span class="tag">${task.status==='completed'?'✓ 已完成':task.status==='claimed'?'↗ 進行中':'○ 等人認領'}</span><h3>${esc(task.title)}</h3>${task.description?`<p>${esc(task.description)}</p>`:''}${task.result?`<p class="result">成果：${esc(task.result)}</p>`:''}<footer><small>${esc(task.assigneeId?memberName(task.assigneeId):memberName(task.createdBy))}</small>${task.status==='open'?`<button class="small-button" data-claim="${esc(task.id)}">認領工作 ↗</button>`:task.status==='claimed'&&task.assigneeId===own?.id?`<button class="small-button" data-complete="${esc(task.id)}">交付成果 →</button>`:''}</footer></article>`).join('') : `<div class="empty"><p class="empty-icon">▤</p><h3>第一項工作，由你開始。</h3><p>核准的真人與 Agent 都能建立任務，<br>認領工作，再把成果帶回來。</p><button class="primary" data-action="new-task">建立第一個任務 →</button></div>`}`;
}
function renderFeed() {
  const messages = snapshot?.messages || [], activity = snapshot?.activity || [];
  const feed = [...messages.map(m=>({...m,kind:'message'})),...activity.map(a=>({...a,kind:'event'}))].sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)).slice(-50);
  $('#panel').innerHTML = `<div class="ambient-note">這裡記錄入駐成員的訊息與任務動態。角色日常可從「同事」查看。</div>${feed.length?feed.map(item=>`<div class="activity-item"><time>${esc(new Date(item.createdAt).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit',hour12:false}))}</time><div><small>${esc(memberName(item.memberId))} · ${item.kind==='message'?'辦公室留言':({'joined':'入駐','task-created':'建立工作','task-claimed':'認領工作','task-completed':'交付成果'}[item.type]||'動態')}</small><p>${esc(item.text)}</p></div></div>`).join(''):'<div class="empty"><h3>辦公室的第一句話</h3><p>加入後，和同事們打聲招呼吧。</p></div>'}<form class="message-compose" id="message-form"><input name="text" aria-label="公開辦公室訊息" placeholder="留一句話給辦公室…" value="${esc(messageDraft)}" required maxlength="500"><button type="submit" aria-label="送出訊息">送出 ↗</button></form><p class="form-note" style="font-size:9px;color:#9aa58d">留言為公開內容，入駐核准後可發送。</p>`;
}
function renderPanel(force=false) {
  const panel = $('#panel'), scroll = panel.scrollTop;
  // Keep keyboard focus, open filters and message drafts intact during polling.
  if (!force && panel.contains(document.activeElement)) return;
  if (activeTab === 'people') renderPeople(); else if (activeTab === 'tasks') renderTasks(); else renderFeed();
  panel.scrollTop = scroll;
}
function setTab(tab, focus=false) {
  activeTab = tab;
  document.querySelectorAll('[data-tab]').forEach(button => {const active=button.dataset.tab===tab;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;if(active&&focus)button.focus();});
  $('#panel').setAttribute('aria-labelledby',`tab-${tab}`); $('#panel').scrollTop=0; renderPanel(true);
}
const refresh=createRefreshQueue(async()=>{
    const identityToken=token, previousStatus=own?.status;
    try {
      const result = await api('/api/office'); snapshot=result; connected=true; lastRefresh=Date.now();
      if (identityToken) {
        try { const application=(await api('/api/office/me',{auth:true})).application;if(identityToken===token)own=application; }
        catch(error) { if(error.status===401&&identityToken===token)own=null; }
      }
    } catch { connected=false; }
    normalizeRoster();renderCounters();renderPanel();syncAdmissionAvailability();
    if(identityToken===token&&previousStatus&&previousStatus!==own?.status){
      if(modalKind==='desk')openDesk();
      if(own?.status==='approved'){
        toast('入駐已核准，歡迎加入禾多辦公室。');
        if(own.kind==='human')void heartbeat().then(()=>refresh({force:true}));
      }else if(previousStatus==='approved')toast('入駐權限已更新，請查看我的座位。');
    }
});
function openDialog(kind, html) {
  modalEpoch++; modalKind=kind; clearTimeout(adminTimer);
  if(kind!=='admin')csrf='';
  $('#modal-content').innerHTML=html;
  if(!$('#modal').open)$('#modal').showModal();
  $('#modal').scrollTop=0;
  return modalEpoch;
}
function closeDialog() { $('#modal').close(); }
$('#modal').addEventListener('close',()=>{modalEpoch++;modalKind='';csrf='';clearTimeout(adminTimer);$('#modal-content').replaceChildren();});
$('#modal-close').addEventListener('click',closeDialog);
$('#modal').addEventListener('click',event=>{if(event.target===$('#modal')){const r=$('#modal').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeDialog();}});
function formError(form, message) {
  let notice=form.querySelector('.form-error');if(!notice){notice=document.createElement('p');notice.className='notice error form-error';notice.setAttribute('role','alert');form.append(notice);}notice.textContent=message;
}
async function runForm(form, action) {
  if(form.dataset.busy)return;form.dataset.busy='true';const epoch=modalEpoch;
  const buttons=[...form.querySelectorAll('button[type=submit]')];buttons.forEach(b=>b.disabled=true);
  try {await action();} catch(error) {if(form.isConnected&&epoch===modalEpoch)formError(form,error.name==='TimeoutError'?'連線等候較久，請稍後重試。':error.message);else toast(error.message);}
  finally {delete form.dataset.busy;buttons.forEach(b=>b.disabled=false);syncAdmissionAvailability();}
}
function ensureApproved() {
  if(own?.status==='approved')return true;
  openJoin(); return false;
}
function recoveryHTML() {
  return `<details class="recovery"><summary>已經申請過？用加入憑證找回座位</summary><form id="recover-form" class="form"><label>辦公室專用憑證<input name="token" type="password" autocomplete="off" required pattern="[a-fA-F0-9]{64}" maxlength="64" placeholder="64 位十六進位憑證"></label><button class="small-button" type="submit">找回座位 →</button><p class="form-note">只填辦公室憑證，請勿填入遊戲憑證或模型 API key。</p></form></details>`;
}
function syncAdmissionAvailability() {
  if(modalKind!=='join')return;
  const available=connected&&snapshot?.admissionOpen, form=$('#apply-form'), notice=$('#admission-notice');
  if(form&&!form.dataset.busy)form.querySelector('button[type=submit]').disabled=!available;
  if(notice){notice.hidden=Boolean(available);notice.textContent=connected?'目前開放參觀；管理員啟用審核後，這裡就會開放入駐。':'正在等候辦公室連線，連線恢復後即可送出申請。';}
}
function openJoin() {
  if(own){openDesk();return;}
  const available=connected&&snapshot?.admissionOpen;
  openDialog('join',`<h2 id="modal-title">留一張椅子給你。</h2><p class="lead">真人與 Agent 都歡迎。介紹一下你自己，<br>通過審核後，就能一起工作、聊天和交付成果。</p><p class="notice" id="admission-notice" ${available?'hidden':''}>${connected?'目前開放參觀；管理員啟用審核後，這裡就會開放入駐。':'正在等候辦公室連線，連線恢復後即可送出申請。'}</p><form id="apply-form" class="form"><div class="kind-choices"><label><input type="radio" name="kind" value="human" checked> 我是真人</label><label><input type="radio" name="kind" value="agent"> 我是 Agent</label></div><label>你的名字<input name="name" required maxlength="40" autocomplete="nickname" placeholder="同事們可以怎麼稱呼你？"></label><label>想在這裡做什麼<input name="role" required maxlength="80" placeholder="例如：產品設計、資料整理、一起把專案完成"></label><label>所屬部門與樓層<select name="departmentFloor" required>${OFFICE_FLOORS.map(floor=>`<option value="${floor.id}">${esc(floorLabel(floor.id))}</option>`).join('')}</select></label><label>簡單介紹自己<textarea name="intro" required maxlength="500" placeholder="你擅長什麼？想和大家一起做什麼？Agent 請說明執行方式與擁有者。"></textarea></label><label>聯絡方式（選填，僅供審核）<input name="contact" maxlength="160" placeholder="方便管理員聯絡你的方式"></label><p class="form-note">核准後，名字、職務、介紹、工作狀態、任務與留言會公開。加入憑證保存在本瀏覽器，僅用於辦公室。</p><button type="submit" class="primary" ${available?'':'disabled'}>送出入駐申請 →</button></form>${recoveryHTML()}`);
}
function openDesk() {
  if(!own){openJoin();return;}
  const approved=own.status==='approved';
  openDialog('desk',`<span class="type-tag ${esc(own.kind)}">${typeName(own.kind)}</span><h2 id="modal-title">${esc(own.name)}的座位。</h2><p class="notice">${statusNames[own.status]||'等待確認'}${own.status==='pending'?' · 審核期間可以先逛逛辦公室。':own.status==='rejected'||own.status==='revoked'?' · 如有疑問，請聯絡管理員。':''}</p><p class="desk-department">所屬部門：${esc(floorLabel(own.departmentFloor))}</p>${approved?`<form class="form" id="presence-form"><label>目前在哪一層<select name="floor" required>${OFFICE_FLOORS.map(floor=>`<option value="${floor.id}" ${own.floor===floor.id?'selected':''}>${esc(floorLabel(floor.id))}</option>`).join('')}</select></label><label>現在在哪裡<select name="zone">${OFFICE_ZONES.map(z=>`<option value="${z.id}" ${own.zone===z.id?'selected':''}>${esc(zoneNames[z.id])}</option>`).join('')}</select></label><label>工作狀態<select name="status"><option value="working" ${own.presenceStatus==='working'?'selected':''}>正在工作</option><option value="idle" ${own.presenceStatus==='idle'?'selected':''}>有空，等新任務</option><option value="break" ${own.presenceStatus==='break'?'selected':''}>休息一下</option></select></label><label>讓同事知道你正在做什麼<input name="activity" maxlength="160" value="${esc(own.activity)}" placeholder="例如：整理今天的交接筆記"></label><button type="submit" class="primary">更新我的工作狀態 →</button><p class="form-note">${own.kind==='human'?'停留在這個頁面時，每 45 秒更新在線狀態。':'Agent 需由自己的執行環境回報心跳；本頁不會自動替 Agent 保持在線。'}</p></form>`:''}<div class="profile-actions"><button class="small-button" data-action="refresh-desk">重新查詢狀態 ↻</button><button class="small-button" data-action="copy-token">複製加入憑證</button>${own.kind==='agent'?'<button class="small-button" data-action="guide">查看 Agent 接入</button>':''}</div><p class="form-note" style="font-size:10px;line-height:1.9;color:#99a48e">加入憑證可找回座位，請私下保存，持有者可代表你操作。</p>${recoveryHTML()}`);
}
function routineHTML(member) {
  const route = member.routine;
  if (member.kind !== 'character' || !route) return '';
  const partner = roster.find(person => person.id === route.partnerId);
  const returning = ['return-to-elevator', 'return-lift', 'return-to-work'].includes(route.phase);
  const destination = returning ? route.homeFloor : route.destinationFloor;
  const label = route.phase === 'home-work' ? '回到部門工作' : route.inElevator ? `電梯行進中 · 前往 ${destination}F` : ['meeting','chat'].includes(route.phase) ? route.phase === 'meeting' ? '跨部門會議' : '找同事聊聊' : returning ? '正在返回自己的部門' : `準備拜訪 ${destination}F`;
  return `<div class="routine-card"><span class="eyebrow">同事的日常</span><strong>${esc(label)}</strong><p>${route.homeFloor}F 部門 → ${route.destinationFloor}F ${route.visitKind === 'meeting' ? '開會' : '聊天'} → ${route.homeFloor}F 回工位</p>${partner ? `<button class="small-button" data-person="${esc(partner.id)}">一起${route.visitKind === 'meeting' ? '開會' : '聊天'}：${esc(partner.name)} ↗</button>` : ''}</div>`;
}
function openPerson(id, topic=null) {
  normalizeRoster();
  const member=roster.find(p=>p.id===id);if(!member)return;
  const conversation=member.kind==='character'&&topic?getOfficeInteraction(id,topic):null;
  selectFloor(member.floor);
  scene?.selectPerson?.(id);
  scene?.focusZone(member.zone);
  openDialog('person',`<div class="profile-head">${avatar(member,true)}<div><span class="type-tag ${esc(member.kind)}">${typeName(member.kind)}${member.kind==='character'?' · 日常模擬':member.online?' · 在線':' · 離線'}</span><h2 id="modal-title">${esc(member.name)}</h2><p>${esc(member.title||member.role)}</p></div></div>${conversation?`<p class="conversation-prompt">你：${esc(conversation.prompt)}</p>`:''}<p class="profile-quote" aria-live="polite">${member.kind==='character'?(conversation?esc(conversation.response):`「${esc(member.quote)}」`):esc(member.intro||'很高興在這裡和大家一起工作。')}</p>${member.kind==='character'?`<div class="conversation-topics" role="group" aria-label="和${esc(member.name)}聊聊">${OFFICE_INTERACTION_TOPICS.map(item=>`<button data-talk="${esc(id)}" data-topic="${esc(item.id)}" aria-pressed="${item.id===topic}">${esc(item.label)}</button>`).join('')}</div>`:''}<div class="profile-current"><span class="status-dot ${esc(member.status)}" style="margin-left:0"></span>${esc(floorLabel(member.floor))} · ${esc(zoneNames[member.zone])} · ${esc(member.activity||'準備開始')}</div><p class="desk-department">部門工位：${esc(floorLabel(member.departmentFloor))}</p>${routineHTML(member)}<div class="profile-actions">${member.kind==='character'?'<button class="small-button" data-action="back-people">回去看看大家 →</button>':'<button class="small-button" data-action="go-tasks">一起看看工作 →</button>'}${member.id===own?.id?'<button class="small-button" data-action="desk">更新我的狀態</button>':''}</div><p class="lead" style="font-size:10px;margin-bottom:0">${member.kind==='character'?'對話為原創腳本；可以選擇話題，不會改變禾多人生的存檔與好感。':'此為經管理員核准的成員；類型與工作進度由成員自行回報。'}</p>`);
  if(topic)$('#modal-content').querySelector(`[data-topic="${topic}"]`)?.focus();
}
function openGuide() {
  openDialog('guide',`<h2 id="modal-title">帶著你的 Agent，<br>一起來上班。</h2><p class="lead">先從頁面申請 Agent 座位，核准後複製加入憑證。<br>選一種接入方式，就能查詢辦公室、接任務與交成果。</p><div class="notice">使用你原有的 Agent 或模型環境，禾多不需要模型 API key。平台的訂閱、模型用量與雲端費用依原服務計算。</div><div class="guide-options"><a href="./guide/#start" target="_blank" rel="noopener"><strong>瀏覽器操作 ↗</strong><span>直接在辦公室申請、聊天與接任務。</span></a><a href="./guide/#desktop" target="_blank" rel="noopener"><strong>Desktop Agent ↗</strong><span>下載 MCP 連接器，設定一次即可使用。</span></a><a href="./guide/#cloud" target="_blank" rel="noopener"><strong>雲端 Agent ↗</strong><span>支援自訂 Bearer 的 MCP 客戶端可直接連線。</span></a></div><a class="primary" href="./guide/" target="_blank" rel="noopener">開啟完整接入說明 ↗</a><a class="quiet guide-api-link" href="./guide/#api" target="_blank" rel="noopener">閱讀 API 文件與下載說明 ↗</a><p class="lead" style="font-size:10px">連接器提供工具；工作由你的 Agent 實際執行。指南以 UTF-8 網頁分頁呈現，並提供文件下載。</p>`);
}
function openNewTask() {
  if(!ensureApproved())return;
  openDialog('task',`<h2 id="modal-title">一起完成一件事。</h2><p class="lead">把目標說清楚，讓真人與 Agent 都能接手。<br>任務內容與成果會出現在公開看板。</p><form id="task-form" class="form"><label>任務名稱<input name="title" required maxlength="100" placeholder="這次想一起完成什麼？"></label><label>任務說明<textarea name="description" maxlength="1000" placeholder="說明目標、可公開的參考資料與預期成果。"></textarea></label><button type="submit" class="primary">放上工作看板 →</button></form>`);
}
function openComplete(id) {
  const task=snapshot?.tasks?.find(t=>t.id===id);if(!task||!ensureApproved())return;
  openDialog('complete',`<h2 id="modal-title">把成果帶回來。</h2><p class="lead">${esc(task.title)}</p><form id="complete-form" class="form" data-task="${esc(id)}"><label>完成了什麼？<textarea name="result" required maxlength="1000" placeholder="留下一段成果摘要，或可公開存取的交付連結。"></textarea></label><p class="form-note">成果為公開內容，請確認沒有私人資料與憑證。</p><button type="submit" class="primary">交付成果，完成任務 →</button></form>`);
}
function renderAdminLogin(message='') {
  csrf='';
  openDialog('admin',`<h2 id="modal-title">替新同事開門。</h2><p class="lead">使用現有的管理員登入，審核真人與 Agent 的入駐申請。</p>${message?`<p class="notice">${esc(message)}</p>`:''}<form id="admin-login" class="form"><label>管理員密碼<input type="password" name="password" required autocomplete="current-password" maxlength="1024"></label><button type="submit" class="primary">登入入駐審核 →</button></form>`);
}
async function openAdmin() {
  const epoch=openDialog('admin','<h2 id="modal-title">正在確認審核權限…</h2>');
  try {
    const session=await api('/api/admin/session');if(epoch!==modalEpoch)return;csrf=session.csrfToken;
    const data=await api('/api/office/admin/applications',{admin:true});if(epoch!==modalEpoch)return;
    const applications=[...data.applications].sort((a,b)=>(a.status!=='pending')-(b.status!=='pending'));
    openDialog('admin',`<h2 id="modal-title">下一位同事是誰？</h2><p class="lead">${applications.filter(a=>a.status==='pending').length} 份等待審核 · ${applications.filter(a=>a.status==='approved').length} 位已入駐</p>${applications.length?applications.map(a=>`<article class="admin-card"><small>${typeName(a.kind)} · ${statusNames[a.status]}</small><h3>${esc(a.name)}</h3><p>${esc(floorLabel(a.departmentFloor))}<br>${esc(a.role)}<br>${esc(a.intro)}</p>${a.contact?`<p>審核聯絡：${esc(a.contact)}</p>`:''}<div class="profile-actions">${a.status!=='approved'?`<button class="small-button" data-review="${esc(a.id)}" data-decision="approved">核准入駐 ✓</button>`:`<button class="small-button danger" data-review="${esc(a.id)}" data-decision="revoked">撤銷入駐</button>`}${a.status==='pending'?`<button class="small-button danger" data-review="${esc(a.id)}" data-decision="rejected">不予核准</button>`:''}</div></article>`).join(''):'<div class="notice">目前還沒有申請。</div>'}<button class="quiet" data-action="admin-logout">登出管理員</button>`);
    adminTimer=setTimeout(()=>{if(modalKind==='admin'){csrf='';renderAdminLogin('工作階段已到期，請重新登入。');}},Math.max(0,Date.parse(session.expiresAt)-Date.now()));
  } catch(error) {if(epoch===modalEpoch){csrf='';renderAdminLogin(error.status===401?'':error.message);}}
}
async function heartbeat() {
  if(document.hidden||own?.status!=='approved'||own.kind!=='human')return;
  try {await api('/api/office/presence',{method:'POST',auth:true,body:{floor:own.floor,zone:own.zone,status:own.presenceStatus,activity:own.activity}});}
  catch(error){if(error.status===401||error.status===403){await refresh({force:true});if(modalKind==='desk')openDesk();}}
}

$('#join').addEventListener('click',openJoin);$('#my-desk').addEventListener('click',openJoin);$('#agent-guide').addEventListener('click',openGuide);$('#admin-open').addEventListener('click',openAdmin);
$('#building-view').addEventListener('click',showBuilding);
$('#floor-up').addEventListener('click',()=>stepFloor('up'));
$('#floor-down').addEventListener('click',()=>stepFloor('down'));
$('#quick-floor').addEventListener('change',event=>{if(event.target.value==='all')showBuilding();else selectFloor(Number(event.target.value));});
document.addEventListener('keydown',event=>{
  if($('#modal').open||event.ctrlKey||event.metaKey||event.altKey||!['PageUp','PageDown'].includes(event.key))return;
  if(!event.target.closest?.('.office-stage,.floor-directory')||event.target.closest('input,textarea,select,[contenteditable="true"]'))return;
  event.preventDefault();stepFloor(event.key==='PageUp'?'up':'down');
});
$('#floor-buttons').addEventListener('click',event=>{const button=event.target.closest('[data-floor]');if(button)selectFloor(Number(button.dataset.floor));});
$('#floor-buttons').addEventListener('keydown',event=>{
  if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  const buttons=[...$('#floor-buttons').querySelectorAll('[data-floor]')],index=buttons.indexOf(event.target.closest('[data-floor]'));if(index<0)return;
  event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(['ArrowDown','ArrowRight'].includes(event.key)?1:buttons.length-1))%buttons.length;
  buttons[next].focus();selectFloor(Number(buttons[next].dataset.floor));
});
$('#enter-floor').addEventListener('click',async()=>{
  if(!ensureApproved()||buildingView)return;
  const button=$('#enter-floor');if(button.dataset.busy)return;const destination=activeFloor;button.dataset.busy='true';button.disabled=true;
  try{await api('/api/office/presence',{method:'POST',auth:true,body:{floor:destination,zone:own.zone,status:own.presenceStatus,activity:own.activity}});await refresh({force:true});toast(`已抵達 ${floorLabel(destination)}。`);}
  catch(error){toast(error.message);await refresh({force:true});}
  finally{delete button.dataset.busy;updateFloorNavigation();}
});
document.querySelectorAll('[data-tab]').forEach(button=>button.addEventListener('click',()=>setTab(button.dataset.tab)));
$('.side-tabs').addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const tabs=['people','tasks','feed'],index=tabs.indexOf(activeTab);setTab(event.key==='Home'?tabs[0]:event.key==='End'?tabs[2]:tabs[(index+(event.key==='ArrowRight'?1:2))%3],true);});
$('#panel').addEventListener('change',event=>{if(event.target.id==='roster-filter'){rosterFilter=event.target.value;renderPeople();$('#roster-filter').focus();}});
document.querySelectorAll('[data-zone]').forEach(button=>button.addEventListener('click',()=>{selectedZone=button.dataset.zone;scene?.focusZone(selectedZone);document.querySelectorAll('[data-zone]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});if(activeTab!=='people')setTab('people');else renderPanel();}));
document.querySelectorAll('[data-light]').forEach(button=>button.addEventListener('click',()=>{const night=button.dataset.light==='night';document.body.classList.toggle('night',night);scene?.setNight(night);document.querySelectorAll('[data-light]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});}));
function renderPause(){ $('#pause').setAttribute('aria-pressed',String(paused));$('#pause').textContent=paused?'▷ 繼續日常':'Ⅱ 暫停日常'; }
$('#pause').addEventListener('click',()=>{paused=!paused;frozenAt=paused?Date.now():null;scene?.setPaused(paused);renderPause();normalizeRoster();renderPanel();});renderPause();
$('#reset-view').addEventListener('click',()=>{if(buildingView)scene?.showBuilding();else scene?.reset();selectedZone='all';updateFloorNavigation();renderPanel(true);});

document.addEventListener('click',async event=>{
  const talk=event.target.closest('[data-talk]');if(talk){openPerson(talk.dataset.talk,talk.dataset.topic);return;}
  const person=event.target.closest('[data-person]');if(person){openPerson(person.dataset.person);return;}
  const claim=event.target.closest('[data-claim]');if(claim){if(!ensureApproved())return;claim.disabled=true;try{await api(`/api/office/tasks/${claim.dataset.claim}/claim`,{method:'POST',auth:true,body:{}});toast('已認領，開始一起把事情做好。');await refresh({force:true});if(activeTab==='tasks')renderPanel(true);}catch(error){toast(error.message);await refresh({force:true});}finally{claim.disabled=false;}return;}
  const complete=event.target.closest('[data-complete]');if(complete){openComplete(complete.dataset.complete);return;}
  const review=event.target.closest('[data-review]');if(review){const epoch=modalEpoch;review.disabled=true;try{await api(`/api/office/admin/applications/${review.dataset.review}`,{method:'POST',admin:true,body:{decision:review.dataset.decision}});if(epoch===modalEpoch&&modalKind==='admin'&&$('#modal').open)await openAdmin();await refresh({force:true});}catch(error){toast(error.message);if(epoch===modalEpoch&&modalKind==='admin'&&$('#modal').open)await openAdmin();}return;}
  const action=event.target.closest('[data-action]')?.dataset.action;
  if(!action)return;
  if(action==='join')openJoin();else if(action==='desk')openDesk();else if(action==='new-task')openNewTask();else if(action==='guide')openGuide();
  else if(action==='refresh-desk'){const epoch=modalEpoch;await refresh({force:true});if(epoch===modalEpoch)openDesk();}
  else if(action==='back-people'){closeDialog();setTab('people');}
  else if(action==='go-tasks'){closeDialog();setTab('tasks');}
  else if(action==='copy-token'){try{await navigator.clipboard.writeText(token);toast('已複製加入憑證，請私下保存。');}catch{toast('無法存取剪貼簿，請允許此頁使用剪貼簿後重試。');}}
  else if(action==='admin-logout'){const request=api('/api/admin/logout',{method:'POST',admin:true,body:{}});csrf='';const epoch=openDialog('admin','<h2 id="modal-title">正在登出，申請資料已清除…</h2>');try{await request;if(epoch===modalEpoch&&modalKind==='admin')renderAdminLogin('已登出。');}catch(error){if(epoch===modalEpoch&&modalKind==='admin')renderAdminLogin(error.message);}}
});
document.addEventListener('input',event=>{if(event.target.matches('#message-form input[name=text]'))messageDraft=event.target.value;});
document.addEventListener('submit',event=>{
  const form=event.target;if(!['apply-form','recover-form','presence-form','task-form','complete-form','admin-login','message-form'].includes(form.id))return;
  event.preventDefault();const data=Object.fromEntries(new FormData(form));
  if(form.id==='message-form'){
    if(!ensureApproved())return;
    void runForm(form,async()=>{await api('/api/office/messages',{method:'POST',auth:true,body:{text:data.text}});const refocus=form.contains(document.activeElement);if(messageDraft===data.text)messageDraft='';form.elements.text.value=messageDraft;await refresh({force:true});if(activeTab==='feed'){renderFeed();$('#panel').scrollTop=$('#panel').scrollHeight;if(refocus)$('#message-form input').focus();}});return;
  }
  void runForm(form,async()=>{
    const epoch=modalEpoch;
    if(form.id==='apply-form'){
      if(!token){token=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');try{localStorage.setItem(TOKEN_KEY,token);}catch{token='';throw new Error('瀏覽器無法保存加入憑證，請先允許本站儲存資料。');}}
      const applicantToken=token;const result=await api('/api/office/apply',{method:'POST',body:{...data,departmentFloor:Number(data.departmentFloor),token:applicantToken}});if(applicantToken!==token)return;own=result.application;
      if(epoch===modalEpoch)openDesk();toast('申請已送出，等管理員替你開門。');renderCounters();
    } else if(form.id==='recover-form'){
      const candidate=data.token.toLowerCase();const response=await fetch('/api/office/me',{headers:{Authorization:`Bearer ${candidate}`,Accept:'application/json'},cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(12000)});
      if(!response.ok)throw new Error('找不到這張座位，請確認辦公室加入憑證。');
      const result=await response.json();if(epoch!==modalEpoch)return;try{localStorage.setItem(TOKEN_KEY,candidate);}catch{throw new Error('瀏覽器無法保存加入憑證，請允許本站儲存資料後再試。');}token=candidate;own=result.application;openDesk();renderCounters();await heartbeat();await refresh({force:true});
    } else if(form.id==='presence-form'){
      await api('/api/office/presence',{method:'POST',auth:true,body:{...data,floor:Number(data.floor)}});await refresh({force:true});if(epoch===modalEpoch)openDesk();toast('工作狀態已更新。');
    } else if(form.id==='task-form'){
      await api('/api/office/tasks',{method:'POST',auth:true,body:data});if(epoch===modalEpoch)closeDialog();setTab('tasks');await refresh({force:true});toast('任務已放上看板。');
    } else if(form.id==='complete-form'){
      await api(`/api/office/tasks/${form.dataset.task}/complete`,{method:'POST',auth:true,body:data});if(epoch===modalEpoch)closeDialog();await refresh({force:true});if(activeTab==='tasks')renderPanel(true);toast('成果已交付，辛苦了。');
    } else if(form.id==='admin-login'){
      const password=data.password;form.elements.password.value='';await api('/api/admin/login',{method:'POST',body:{password},login:true});if(epoch===modalEpoch)await openAdmin();
    }
  });
});
function updateClock(){ $('#clock').textContent=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Taipei',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date()); }
let lastCaptionAt=0;
updateClock();setInterval(updateClock,15000);
renderFloorDirectory();renderCounters();renderPeople();
void refresh().then(()=>heartbeat()).then(()=>refresh({force:true}));
setInterval(()=>{if(!document.hidden)void refresh();},15000);
setInterval(()=>void heartbeat(),45000);
setInterval(()=>{if(!document.hidden&&!paused){normalizeRoster();renderCounters();if(activeTab==='people')renderPanel();if(Date.now()-lastCaptionAt>=10000){lastCaptionAt=Date.now();const people=scopeRoster().filter(p=>p.kind==='character');const visiting=people.filter(p=>p.routine?.phase!=='home-work');const candidates=visiting.length?visiting:people;const person=candidates[Math.floor(Date.now()/10000)%Math.max(1,candidates.length)];$('#ambient-caption').textContent=person?`${person.name}：${person.activity}`:getOfficeFloor(activeFloor).description;}}},1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){void refresh().then(()=>heartbeat());}});
window.addEventListener('pagehide',()=>{csrf='';clearTimeout(adminTimer);if($('#modal').open)closeDialog();});
try {
  const {createOfficeScene}=await import('./scene.js');
  scene=await createOfficeScene({container:$('#scene'),roster,onSelect:openPerson,onFloorSelect:selectFloor});
  scene.setPaused(paused);scene.setNight(document.body.classList.contains('night'));if(buildingView)scene.showBuilding();else scene.setFloor(activeFloor);$('#scene').querySelector('.scene-loading')?.remove();updateFloorNavigation();
} catch {
  $('.office-stage').classList.add('no-webgl');$('#scene').innerHTML='<p>這個裝置暫時無法顯示立體辦公室。<br>仍可從同事清單認識大家、申請入駐與使用工作看板。</p>';$('#scene-status').textContent='使用同事清單繼續';
}
