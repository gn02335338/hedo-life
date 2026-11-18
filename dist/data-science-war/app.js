import { advanceMeeting, createMeeting, endingFor, restoreMeeting, saveMeeting } from './game.js';

import { ITEM_BY_ID } from './items.js';
import { SAM_RULES, ethanSinging, jackReaction } from './meeting-scenes.js';

const main = document.getElementById('game');
const restart = document.getElementById('reopen');
const restartDialog = document.getElementById('restart-dialog');
const duelDialog = document.getElementById('duel-dialog');
const storage = {
  getItem(key) { return window.localStorage.getItem(key); },
  setItem(key, value) { window.localStorage.setItem(key, value); },
};
const characters = { sam: '山姆', joe: '鷲', wine: '紅酒', ethan: '伊森', jack: '傑克', master: '山姆・戰鬥大師' };
const replyNames = { challenge: '推進問題', mediate: '請傑克協調', apology: '虛心認錯', scold: '大聲斥責', observe: '先聽大家說' };
const art = (name) => {
  const legacyPortrait = name === 'jack' || name === 'wing';
  return new URL(legacyPortrait ? '../assets/' + name + '.png' : './art/' + name + '.webp', import.meta.url).href;
};
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
        <p class="cover-lead">你走錯了會議室。山姆請你坐下，準備連問三題。鷲抱著工作資料等在旁邊，伊森的歌聲已經從門內傳出。</p>
        <button class="primary" data-action="start">看看桌上的道具${arrow}</button>
      </div>
      <div class="cover-edge" aria-hidden="true"></div>
    </section>
    <aside class="intro-note">
      <p><strong>目標是讓會議完美結束。</strong> 推進議題、看山姆的反應，必要時請傑克出面。</p>
      <p>三題隨機提問，再進入會議交鋒 · 進度留在這台瀏覽器</p>
    </aside>`;
}

function renderItems() {
  main.innerHTML = `
    <section class="prep" aria-labelledby="prep-title">
      <div class="prep-note">
        <h1 id="prep-title" tabindex="-1">進門前<br>帶一件東西</h1>
        <p>傑克隔著門偷笑，伊森正在唱林俊傑的《修煉愛情》。紅酒把三樣東西放到門邊的桌上，鷲在入口等你。</p>
      </div>
      <div class="prep-items">
        <h2>門邊的桌子</h2>
        <p>選一樣，拿了就進場。</p>
        <div class="prep-list">
          ${meeting.itemDraw.map((item) => `
            <button class="prep-item" type="button" data-action="pack" data-item="${item.id}">
              <span class="prep-kind">${item.kind}</span>
              <span class="prep-description"><strong>${item.label}</strong><span>${item.detail}</span></span>
              ${arrow}
            </button>`).join('')}
        </div>
      </div>
    </section>`;
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
  const quiz = meeting.rulesVersion === 3 && meeting.index < 3;
  const isReport = meeting.phase === 'report';
  const transformed = meeting.rage === 100;
  const speaker = transformed ? 'master' : scene.speaker;
  const portrait = speaker === 'sam' && meeting.rage >= 75 ? 'sam-angry' : speaker;
  const report = meeting.report;
  const lastAction = meeting.actions.at(-1);
  const submitted = isReport && lastAction?.type === 'reply' ? lastAction.evidence : null;
  const proofAccepted = report?.proof === 'hit';
  const item = meeting.itemId ? ITEM_BY_ID[meeting.itemId] : null;
  const motion = transformed ? ' data-transformed' : '';
  const company = meeting.rulesVersion === 3 ? `
    <aside class="meeting-company" aria-label="會議室旁觀">
      <div class="company-person"><img src="${art('ethan')}" alt=""><p><strong>伊森</strong>${ethanSinging(meeting.index)}</p></div>
      <div class="company-person"><img src="${art('jack')}" alt=""><p><strong>傑克</strong>${jackReaction(meeting)}</p></div>
    </aside>` : '';

  const line = transformed ? '山姆的眼鏡後竄出紅光，惡魔角從髮際冒出。他仍穿著剛才那件外套，但整間會議室都認出了戰鬥大師。' : scene.line;
  const evidence = `
        <aside class="evidence" aria-labelledby="evidence-title">
          <div class="paper-heading"><h2 id="evidence-title">${quiz ? '你的回答' : '會議資料'}</h2><span>${scene.evidence.length} 份</span></div>
          <p id="evidence-guide">${isReport ? '這是本回合的選項。' : quiz ? '先選一個回答，再按「推進問題」。' : '先選一份資料，再用它回答眼前的問題。'}</p>
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
            ${report.intervention ? `<div class="wine-reaction"><img src="${art('wine')}" alt=""><p><strong>紅酒救場</strong>紅酒把可樂和薯片拋給山姆。山姆忙著接住，怒氣從 ${report.snackFrom} 降到 ${meeting.rage}。<span>這一輪的話還沒說完，紅酒先把薯片袋拆開了。</span></p></div>` : ''}
            <dl class="deltas"><div><dt>怒氣</dt><dd>${signed(report.rage)}</dd></div><div><dt>會議信用</dt><dd>${signed(report.credibility)}</dd></div></dl>
            <div class="report-actions">
              ${report.repairable ? '<button class="quiet" data-action="repair">虛心認錯，收回剛才那句</button>' : ''}
              ${transformed ? '<button class="combat" data-action="fight">單挑戰鬥大師</button>' : ''}
              <button class="${transformed ? 'quiet' : 'primary'}" data-action="advance">${meeting.index + 1 === meeting.agenda.length ? '看看怎麼散會' : transformed ? '先冷靜，再繼續' : '下一個議題'}${arrow}</button>
            </div>
          </section>` : `
          <div class="reply-grid">
            ${scene.replies.map((reply) => `<button class="${reply.id === 'challenge' ? 'primary' : 'quiet'} action-choice" data-action="reply" data-reply="${reply.id}" ${reply.id === 'challenge' && !selectedEvidence ? 'disabled' : ''}><b>${replyNames[reply.id]}</b><span>${reply.id === 'challenge' ? quiz ? '送出選好的回答' : '出示選好的資料' : reply.label}</span></button>`).join('')}
            ${item && !meeting.itemUsed && !item.loadout ? `<button class="quiet action-choice" data-action="item"><b>使用道具</b><span>${item.label}</span></button>` : ''}
            <button class="combat action-choice" data-action="fight"><b>跟山姆單挑</b><span>進入禾多島擂台</span></button>
            ${meeting.index + 1 === meeting.agenda.length ? '<button class="quiet action-choice" data-action="wing"><b>請翅膀來收尾</b><span>讓他主持最後一段</span></button>' : ''}
          </div>`}
        </div>
  `;
  main.innerHTML = `
    <section class="meeting" aria-labelledby="scene-title" data-heat="${meeting.rage >= 75 ? 'hot' : meeting.rage >= 50 ? 'warm' : 'cool'}">
      <div class="agenda">
        <div class="agenda-title">
          <p class="round">${quiz ? '山姆連問' : '回合'} <b>${meeting.index + 1}</b> / ${quiz ? 3 : meeting.agenda.length}<span>${scene.category}</span></p>
          <h1 id="scene-title" tabindex="-1">${scene.title}</h1>
        </div>
        ${renderRage(meeting.rage)}
      </div>
      <div class="meeting-log">
        <span>已推進 <b>${meeting.resolved}</b> 題</span>
        ${item ? `<span>道具 <b>${item.label}</b>${meeting.itemUsed ? ' · 已用' : item.loadout ? ' · 單挑時生效' : ''}</span>` : ''}
      </div>
      ${meeting.rulesVersion === 3 && meeting.index === 0 ? `<details class="sam-rules"><summary>山姆的開場規矩</summary><p>${SAM_RULES}</p></details>` : ''}
      <div class="meeting-grid"${isReport ? ' data-report' : ''}>
        <div class="debate">
          <div class="speaker-stage"${motion}>
            <img class="scene-portrait" src="${art(portrait)}" alt="">
            ${proofAccepted && !transformed ? `<span class="objection">${quiz ? '回答成立' : '反駁成立'}</span>` : ''}
            <div class="statement">
              <span class="speaker-name">${characters[speaker]}</span>
              <p>${line}</p>
            </div>
          </div>
          ${company}
          ${scene.mediator && !isReport ? `<aside class="mediator"><img src="${art('jack')}" alt=""><p><strong>傑克</strong>${scene.mediator}</p></aside>` : ''}
        </div>
        ${isReport ? decisions + evidence : evidence + decisions}
      </div>
    </section>`;
}

function signed(value) {
  return value > 0 ? '+' + value : String(value);
}

function renderEnding() {
  const ending = endingFor(meeting);
  const item = meeting.itemId ? ITEM_BY_ID[meeting.itemId] : null;
  main.innerHTML = `
    <section class="cover ending" aria-labelledby="ending-title"${ending.portrait ? ' data-portrait' : ''}>
      ${ending.portrait ? `<img class="ending-portrait" src="${art(ending.portrait)}" alt="">` : ''}
      <div class="cover-copy">
        <h1 id="ending-title" tabindex="-1">${ending.title}</h1>
        ${ending.perfect ? '<p class="perfect">會議完美結束</p>' : ''}
        <p class="cover-lead">${ending.text}</p>
        ${meeting.rulesVersion === 3 ? '<p class="ending-song">走廊那頭，伊森還在唱《修煉愛情》。</p>' : ''}
        <dl class="deltas"><div><dt>議題推進</dt><dd>${meeting.resolved}</dd></div><div><dt>會議信用</dt><dd>${meeting.credibility}</dd></div>${item ? `<div><dt>帶進場的道具</dt><dd>${item.label}</dd></div>` : ''}</dl>
        <button class="primary" data-action="start">再開一場會${arrow}</button>
      </div>
    </section>`;
}

async function renderBattle() {
  main.innerHTML = `
    <section class="battle-view" aria-labelledby="battle-title">
      <div class="battle-header"><h1 id="battle-title" tabindex="-1">禾多島戰鬥</h1><button class="quiet" data-action="battle-exit">放棄單挑</button></div>
      ${meeting.rulesVersion === 3 ? '<p class="battle-song">伊森站到擂台旁邊，繼續唱林俊傑的《修煉愛情》。</p>' : ''}
      <div id="battle-container"><p>前往擂台中…</p></div>
    </section>`;
  const container = document.getElementById('battle-container');
  try {
    const { startDataScienceBattle } = await import('./battle.js');
    if (!container.isConnected) return;
    container.replaceChildren();
    battle = startDataScienceBattle({
      container,
      image: art(meeting.rage === 100 ? 'master' : meeting.rage >= 75 ? 'sam-angry' : 'sam'),
      loadout: meeting.itemId ? ITEM_BY_ID[meeting.itemId].loadout : null,
      seed: (meeting.seed ^ Math.imul(meeting.index + 1, 0x9e3779b9)) >>> 0,
      enraged: meeting.rage === 100,
      onFinish(outcome) { commit({ type: 'battle', result: outcome }); },
    });
  } catch {
    if (container.isConnected) container.textContent = '擂台載入失敗。請重新整理再試一次，或放棄單挑結束本局。';
  }
}

function render(focus = false) {
  battle?.destroy();
  battle = null;
  restart.hidden = !meeting || meeting.phase === 'ending' || meeting.phase === 'battle';
  if (!meeting) renderIntro();
  else if (meeting.phase === 'items') renderItems();
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
  const { action, reply, evidence, item } = button.dataset;
  if (action === 'start') newMeeting();
  if (action === 'reply') commit({ type: 'reply', reply, evidence: selectedEvidence });
  if (action === 'pack') commit({ type: action, item });
  if (['advance', 'repair', 'item', 'wing'].includes(action)) commit({ type: action });
  if (action === 'fight') {
    duelDialog.returnValue = '';
    duelDialog.showModal();
  }
  if (action === 'battle-exit' && (!battle || battle.requestExit())) commit({ type: 'battle', result: 'quit' });
  if (action === 'evidence') {
    selectedEvidence = selectedEvidence === evidence ? '' : evidence;
    for (const slip of main.querySelectorAll('.slip')) {
      slip.setAttribute('aria-pressed', String(slip.dataset.evidence === selectedEvidence));
    }
    main.querySelector('[data-reply="challenge"]').disabled = !selectedEvidence;
    document.getElementById('evidence-guide').textContent = selectedEvidence ? '已選好，可以按「推進問題」回答。' : '先選一份資料，再用它回答眼前的問題。';
  }
});

restart.addEventListener('click', () => {
  restartDialog.returnValue = '';
  restartDialog.showModal();
});
restartDialog.addEventListener('close', () => {
  if (restartDialog.returnValue === 'restart') newMeeting();
});
duelDialog.addEventListener('close', () => {
  if (duelDialog.returnValue === 'fight') commit({ type: 'fight' });
});
render();
