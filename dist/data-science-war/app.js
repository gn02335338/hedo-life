import { advanceMeeting, createMeeting, restoreMeeting, saveMeeting } from './game.js';

const main = document.getElementById('game');
const restart = document.getElementById('reopen');
const restartDialog = document.getElementById('restart-dialog');
const storage = {
  getItem(key) { return window.localStorage.getItem(key); },
  setItem(key, value) { window.localStorage.setItem(key, value); },
};
const characters = { sam: '山姆', joe: 'Joe', wine: 'Wine', ethan: 'Ethan', master: '戰鬥大師' };
const art = (name) => new URL('./art/' + name + '.webp', import.meta.url).href;
const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M3 12h17m-7-7 7 7-7 7"/></svg>';

let meeting = restoreMeeting(storage);
let selectedEvidence = '';
let battle = null;

function commit(action) {
  const next = advanceMeeting(meeting, action);
  if (next === meeting) return;
  meeting = next;
  selectedEvidence = '';
  saveMeeting(meeting, storage);
  render(true);
}

function newMeeting() {
  const [seed] = crypto.getRandomValues(new Uint32Array(1));
  meeting = createMeeting(seed);
  selectedEvidence = '';
  saveMeeting(meeting, storage);
  render(true);
}

function renderIntro() {
  main.innerHTML = `
    <section class="cover" aria-labelledby="cover-title">
      <div class="cover-copy">
        <h1 id="cover-title" tabindex="-1">資料科學<span>大戰</span></h1>
        <p class="cover-location">週五下午 · 會議室 B</p>
        <p class="cover-lead">你走錯了會議室。桌上有汽水和洋芋片，門還沒關上，Joe 已經請你留下來報告 SEO。</p>
        <button class="primary" data-action="start">推開會議室的門${arrow}</button>
      </div>
      <div class="cover-edge" aria-hidden="true"></div>
    </section>
    <aside class="intro-note">
      <p><strong>帶證據上桌。</strong> 看會議資料、拆解主張；談不下去，也可以去禾多島打一場。</p>
      <p>單局 6 回合 · 進度留在這台瀏覽器</p>
    </aside>`;
}

function renderRage(rage) {
  const status = rage === 100 ? '戰鬥大師' : rage >= 75 ? '暴怒' : rage >= 50 ? '動怒' : '冷靜';
  const sam = rage === 100 ? 'master' : rage >= 75 ? 'sam-angry' : 'sam';
  return `<div class="rage">
    <img class="rage-face" src="${art(sam)}" alt="">
    <div class="rage-info">
      <span class="rage-label">山姆怒氣 <strong>${status}</strong></span>
      <progress max="100" value="${rage}" aria-label="山姆怒氣 ${status}"></progress>
    </div>
    <span class="rage-value">${rage}<small> / 100</small></span>
  </div>`;
}

function renderMeeting() {
  const scene = meeting.agenda[meeting.index];
  const isReport = meeting.phase === 'report';
  const transformed = meeting.rage === 100;
  const speaker = transformed ? 'master' : scene.speaker;
  const portrait = speaker === 'sam' && meeting.rage >= 75 ? 'sam-angry' : speaker;
  const report = meeting.report;
  const lastAction = meeting.actions.at(-1);
  const submitted = isReport && lastAction?.type === 'reply' ? lastAction.evidence : null;
  const proofAccepted = submitted === scene.rebuttal;
  const motion = transformed ? ' data-transformed' : '';
  const line = transformed ? '投影開始閃爍。山姆的身影被一道黑色護甲蓋過，戰鬥大師從會議簡報裡現身。' : scene.line;
  const evidence = `
        <aside class="evidence" aria-labelledby="evidence-title">
          <div class="paper-heading"><h2 id="evidence-title">會議資料</h2><span>${scene.evidence.length} 份</span></div>
          <p id="evidence-guide">${isReport ? '這是本回合桌上的資料。' : '先選一份資料，再按反駁。'}</p>
          <div class="evidence-list">
            ${scene.evidence.map((item, index) => `
              <button class="slip" data-action="evidence" data-evidence="${item.id}" aria-pressed="${item.id === (isReport ? submitted : selectedEvidence)}" ${isReport ? 'disabled' : ''} aria-describedby="evidence-guide">
                <span class="slip-index">${String(index + 1).padStart(2, '0')}</span><span><strong>${item.title}</strong><span>${item.text}</span></span>
              </button>`).join('')}
          </div>
          ${isReport && scene.citation ? `<a class="source" href="${scene.citation.url}" target="_blank" rel="noopener noreferrer">${scene.citation.label}（另開分頁）</a>` : ''}
        </aside>
  `;
  const decisions = `
        <div class="decisions">
        ${isReport ? `
          <section class="reaction" aria-labelledby="reaction-title">
            <h2 id="reaction-title" tabindex="-1">${report.title}</h2>
            <p>${report.text}</p>
            <dl class="deltas"><div><dt>怒氣</dt><dd>${signed(report.rage)}</dd></div><div><dt>會議信用</dt><dd>${signed(report.credibility)}</dd></div></dl>
            <div class="report-actions">
              ${transformed ? '<button class="combat" data-action="fight">扁他 · 迎戰戰鬥大師</button>' : ''}
              <button class="${transformed ? 'quiet' : 'primary'}" data-action="advance">${meeting.index + 1 === meeting.agenda.length ? '看看會議怎麼收場' : transformed ? '先冷靜，再繼續' : '下一個議題'}${arrow}</button>
            </div>
          </section>` : `
          <div class="reply-grid">
            ${scene.replies.map((reply) => `<button class="${reply.id === 'challenge' ? 'primary' : 'quiet'}" data-action="reply" data-reply="${reply.id}" ${reply.id === 'challenge' && !selectedEvidence ? 'disabled' : ''}>${reply.id === 'challenge' ? '出示證據並反駁' : reply.label}</button>`).join('')}
            <button class="combat" data-action="fight">扁他 <span>進入禾多島戰鬥</span></button>
          </div>`}
        </div>
  `;
  main.innerHTML = `
    <section class="meeting" aria-labelledby="scene-title" data-heat="${meeting.rage >= 75 ? 'hot' : meeting.rage >= 50 ? 'warm' : 'cool'}">
      <div class="agenda">
        <div class="agenda-title">
          <p class="round">回合 <b>${meeting.index + 1}</b> / ${meeting.agenda.length}<span>${scene.category}</span></p>
          <h1 id="scene-title" tabindex="-1">${scene.title}</h1>
        </div>
        ${renderRage(meeting.rage)}
      </div>
      <div class="meeting-grid"${isReport ? ' data-report' : ''}>
        <div class="debate">
          <div class="speaker-stage"${motion}>
            <img class="scene-portrait" src="${art(portrait)}" alt="">
            ${proofAccepted && !transformed ? '<span class="objection">反駁成立</span>' : ''}
            <div class="statement">
              <span class="speaker-name">${characters[speaker]}</span>
              <p>${line}</p>
            </div>
          </div>
        </div>
        ${isReport ? decisions + evidence : evidence + decisions}
      </div>
    </section>`;
}

function signed(value) {
  return value > 0 ? '+' + value : String(value);
}

function renderEnding() {
  main.innerHTML = `
    <section class="cover ending" aria-labelledby="ending-title">
      <div class="cover-copy">
        <h1 id="ending-title" tabindex="-1">${meeting.ending.title}</h1>
        <p class="cover-lead">${meeting.ending.text}</p>
        <dl class="deltas"><div><dt>有效反駁</dt><dd>${meeting.correct}</dd></div><div><dt>會議信用</dt><dd>${meeting.credibility}</dd></div><div><dt>擂台勝場</dt><dd>${meeting.wins}</dd></div></dl>
        <button class="primary" data-action="start">再開一場會${arrow}</button>
      </div>
    </section>`;
}

async function renderBattle() {
  main.innerHTML = `
    <section class="battle-view" aria-labelledby="battle-title">
      <div class="battle-header"><h1 id="battle-title" tabindex="-1">禾多島戰鬥</h1><button class="quiet" data-action="battle-exit">返回會議室</button></div>
      <div id="battle-container"><p>前往擂台中…</p></div>
    </section>`;
  const container = document.getElementById('battle-container');
  try {
    const { startDataScienceBattle } = await import('./battle.js');
    if (!container.isConnected) return;
    container.replaceChildren();
    battle = startDataScienceBattle({
      container,
      image: art('master'),
      seed: (meeting.seed ^ Math.imul(meeting.index + 1, 0x9e3779b9)) >>> 0,
      enraged: meeting.rage === 100,
      onFinish(outcome) { commit({ type: 'battle', result: outcome }); },
    });
  } catch {
    if (container.isConnected) container.textContent = '擂台載入失敗。你可以返回會議室，或重新整理再試一次。';
  }
}

function render(focus = false) {
  battle?.destroy();
  battle = null;
  restart.hidden = !meeting || meeting.phase === 'ending' || meeting.phase === 'battle';
  if (!meeting) renderIntro();
  else if (meeting.phase === 'battle') renderBattle();
  else if (meeting.phase === 'ending') renderEnding();
  else renderMeeting();

  if (focus) {
    const reaction = main.querySelector('.reaction');
    const current = reaction?.querySelector('h2') || main.querySelector('h1');
    current?.focus({ preventScroll: true });
    (reaction || current)?.scrollIntoView({ block: 'nearest' });
  }
}

main.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button || button.disabled) return;
  const { action, reply, evidence } = button.dataset;
  if (action === 'start') newMeeting();
  if (action === 'reply') commit({ type: 'reply', reply, evidence: selectedEvidence });
  if (action === 'advance' || action === 'fight') commit({ type: action });
  if (action === 'battle-exit' && (!battle || battle.requestExit())) commit({ type: 'battle', result: 'quit' });
  if (action === 'evidence') {
    selectedEvidence = selectedEvidence === evidence ? '' : evidence;
    for (const slip of main.querySelectorAll('.slip')) {
      slip.setAttribute('aria-pressed', String(slip.dataset.evidence === selectedEvidence));
    }
    main.querySelector('[data-reply="challenge"]').disabled = !selectedEvidence;
    document.getElementById('evidence-guide').textContent = selectedEvidence ? '已選資料，可以出示證據並反駁。' : '先選一份資料，再按反駁。';
  }
});

restart.addEventListener('click', () => {
  restartDialog.returnValue = '';
  restartDialog.showModal();
});
restartDialog.addEventListener('close', () => {
  if (restartDialog.returnValue === 'restart') newMeeting();
});
render();
