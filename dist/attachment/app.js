import { QUESTIONS, CHAPTERS, SCALE, TYPES, scoreQuiz, freshProgress } from './model.js';
import { loadProgress, saveProgress, clearProgress } from './progress.js';

const main = document.querySelector('#main');
const loaded = loadProgress();
let state = loaded.progress || freshProgress();
let storageAvailable = loaded.available;
let toastTimer;
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const answered = () => state.answers.filter(value => Number.isInteger(value) && value >= 1 && value <= 5).length;
const chapterFor = question => CHAPTERS.find(chapter => chapter.id === question.chapter) || CHAPTERS[Math.floor(state.cursor / 6)];
const typeList = Object.entries(TYPES);

function persist() {
  if (!saveProgress(state)) storageAvailable = false;
  showStorage();
}
function showStorage() {
  document.querySelector('#storage-note').hidden = storageAvailable;
}
function announce(message) { document.querySelector('#announcement').textContent = message; }
function toast(message) {
  document.querySelector('.toast')?.remove();
  const element = document.createElement('div');
  element.className = 'toast';
  element.textContent = message;
  document.body.append(element);
  announce(message);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.remove(), 3800);
}
function focusHeading(selector) {
  requestAnimationFrame(() => {
    const target = main.querySelector(selector);
    target?.focus({ preventScroll: true });
    if (window.scrollY > 80) window.scrollTo({ top: 0, behavior: 'instant' });
  });
}

function heroArt() {
  return `<div class="hero-art" aria-hidden="true"><svg class="hero-svg" viewBox="0 0 560 550" fill="none"><defs><linearGradient id="moss" x1="110" y1="70" x2="390" y2="460" gradientUnits="userSpaceOnUse"><stop stop-color="#dce4b5"/><stop offset=".48" stop-color="#9aac87"/><stop offset="1" stop-color="#386559"/></linearGradient><linearGradient id="clay" x1="400" y1="60" x2="140" y2="450" gradientUnits="userSpaceOnUse"><stop stop-color="#f1cfb2"/><stop offset=".45" stop-color="#d39b78"/><stop offset="1" stop-color="#a55e46"/></linearGradient><filter id="shadow"><feGaussianBlur stdDeviation="18"/></filter></defs><circle cx="282" cy="267" r="211" stroke="#d9ddce" stroke-width="1"/><circle cx="282" cy="267" r="174" stroke="#e3e4d6" stroke-width="1" stroke-dasharray="2 8"/><ellipse cx="289" cy="454" rx="151" ry="18" fill="#234c43" opacity=".1" filter="url(#shadow)"/><path d="M192 116C124 130 109 223 145 320C178 410 248 430 286 385C329 333 279 245 292 185C304 127 261 101 192 116Z" stroke="url(#moss)" stroke-width="70"/><path d="M324 114C389 90 446 135 435 210C425 276 329 302 299 363C268 427 202 437 174 386" stroke="url(#clay)" stroke-width="67" stroke-linecap="round"/><path d="M174 386C163 368 159 342 163 320" stroke="url(#moss)" stroke-width="70" stroke-linecap="round"/><circle cx="103" cy="367" r="7" fill="#a6b992"/><circle cx="458" cy="318" r="5" fill="#d4a47b"/><path d="M442 103v20m-10-10h20" stroke="#a8b595"/><path d="M106 181v13m-6.5-6.5h13" stroke="#d4a47b"/></svg><div class="art-bubble bubble-one"><small>翅膀　14:32</small>「有空來一下。」</div><div class="art-bubble bubble-two"><small>你的內心小劇場</small>是工作，還是我的問題？</div><span class="art-caption">EVERY CONNECTION HAS A RHYTHM.</span><span class="art-stamp">a little closer, a little space.</span></div>`;
}

function renderIntro(focus = false) {
  const count = answered();
  const complete = count === QUESTIONS.length;
  main.innerHTML = `<section class="intro fade-in"><div class="intro-grid"><div class="intro-copy"><p class="eyebrow">HEDO / 禾多職場依附測驗</p><h1 tabindex="-1">靠近一點，<br>還是<em>先已讀？</em></h1><p class="intro-description">主管一句「有空來一下」，<br>你的腦中已經演到第幾集？<br><strong>24 道職場情境，看看你如何靠近、信任，<br>也練習留一點空間給自己。</strong></p><div class="intro-meta"><span>24 道原創情境</span><span>約 4 分鐘</span><span>無須登入</span></div>${count ? `<p class="resume-label">${complete ? '你的職場便條已經整理好了。' : `上次已完成 ${count} / ${QUESTIONS.length} 題，隨時接著聊。`}</p>` : ''}<div class="start-row"><button class="primary intro-start" data-action="start">${complete ? '查看我的結果' : count ? '接著探索' : '開始認識自己'} <span aria-hidden="true">↗</span></button>${count ? '<button class="text-button" data-action="restart">重新作答</button>' : ''}</div><p class="local-note">只留在這個瀏覽器。答案不交給主管，也不上傳。</p></div>${heroArt()}</div><div class="type-strip"><p>沒有理想員工，只有不同的靠近方式。</p><div class="type-chips">${typeList.map(([id, type]) => `<span class="type-chip" style="--type-color:${escapeHTML(type.color)}"><i class="type-dot"></i>${escapeHTML(type.name.replace(/型$/, ''))}</span>`).join('')}</div></div><p class="intro-disclaimer">禾多職場依附測驗是一份原創自我探索遊戲，借用依附的兩個方向理解工作中的感受。題目與分界未經心理計量驗證，不代表正式心理量表、診斷或固定人格；也不適合拿來評斷別人。</p></section>`;
  if (focus) focusHeading('h1');
}

function renderQuiz(focus = true) {
  const question = QUESTIONS[state.cursor];
  const chapter = chapterFor(question);
  const count = answered();
  const value = state.answers[state.cursor];
  main.innerHTML = `<section class="quiz-shell fade-in" aria-label="職場情境作答"><div class="quiz-top"><span>禾多職場依附測驗</span><strong>已回答 ${count} / ${QUESTIONS.length}</strong></div><div class="progress-track" role="progressbar" aria-label="作答進度" aria-valuemin="0" aria-valuemax="${QUESTIONS.length}" aria-valuenow="${count}"><div class="progress-fill" style="width:${count / QUESTIONS.length * 100}%"></div></div><div class="chapter-tabs" aria-label="四段探索">${CHAPTERS.map((item, index) => `<span class="chapter-tab ${item.id === chapter.id ? 'active' : ''}" ${item.id === chapter.id ? 'aria-current="step"' : ''}><span class="chapter-number">0${index + 1}</span>${escapeHTML(item.title)}</span>`).join('')}</div><form id="question-form" class="question-body"><div class="question-meta"><span class="question-index">${String(state.cursor + 1).padStart(2, '0')} / ${QUESTIONS.length}</span><span class="question-context">${escapeHTML(question.context)}</span></div><h1 class="question-title" id="question-title" tabindex="-1">${escapeHTML(question.text)}</h1><p class="question-hint" id="question-hint">想著最近的工作日常，選最接近你的感受。</p><fieldset class="answer-options" aria-labelledby="question-title" aria-describedby="question-hint"><legend class="sr-only">這句話與你有多接近？</legend>${SCALE.map(item => `<label class="answer-option"><input type="radio" name="answer" value="${item.value}" ${item.value === value ? 'checked' : ''} required><span class="answer-number" aria-hidden="true">${item.value}</span><span class="answer-label">${escapeHTML(item.label)}</span></label>`).join('')}</fieldset><div class="question-nav"><button type="button" class="previous" data-action="previous" ${state.cursor === 0 ? 'disabled' : ''}>← 上一題</button><button type="submit" class="primary" id="next-button" ${!value ? 'disabled' : ''}>${state.cursor === QUESTIONS.length - 1 ? '看看我的結果' : '下一題'} <span aria-hidden="true">↗</span></button></div><div class="question-bottom"><span>${escapeHTML(chapter.kicker || '關係不是考績，照自己的感受回答。')}</span><button type="button" class="quiz-pause" data-action="pause">暫停，回到開場 ↗</button></div></form></section>`;
  if (focus) focusHeading('h1');
}

function relationshipMap(result) {
  const x = 44 + result.avoidance * 2.32;
  const y = 276 - result.anxiety * 2.32;
  const labelX = Math.max(60, Math.min(260, x));
  const labelY = y > 65 ? y - 14 : y + 25;
  return `<div class="map-panel"><div class="map-title"><span>你此刻的關係座標 · 自訂傾向分數</span><span>HEDO / 01</span></div><svg class="relationship-map" viewBox="0 0 320 320" role="img" aria-label="關係座標：擔心失去連結 ${result.anxiety} 分，傾向保持距離 ${result.avoidance} 分。自訂傾向分數範圍 0 至 100，分界為 50。"><rect x="44" y="44" width="116" height="116" fill="#e6d8bb"/><rect x="160" y="44" width="116" height="116" fill="#e6d5c9"/><rect x="44" y="160" width="116" height="116" fill="#d7e1bb"/><rect x="160" y="160" width="116" height="116" fill="#d8dfcf"/><path d="M160 44v232M44 160h232" fill="none" stroke="#879b77" stroke-width="1" stroke-dasharray="3 5"/><path d="M44 44v232h232" fill="none" stroke="#889c7b"/><text x="102" y="83" class="map-label" text-anchor="middle">訊息雷達</text><text x="218" y="83" class="map-label" text-anchor="middle">靠近又撤回</text><text x="102" y="253" class="map-label" text-anchor="middle">穩穩接球</text><text x="218" y="253" class="map-label" text-anchor="middle">獨立作業</text><text x="160" y="304" text-anchor="middle" class="map-axis">傾向保持距離 →</text><text x="16" y="160" transform="rotate(-90 16 160)" text-anchor="middle" class="map-axis">擔心失去連結 →</text><circle cx="${x}" cy="${y}" r="13" fill="#234c43" opacity=".12"/><circle cx="${x}" cy="${y}" r="6" fill="#234c43" stroke="#fffefa" stroke-width="2"/><text x="${labelX}" y="${labelY}" text-anchor="middle" class="map-current">你在這裡</text></svg><div class="axis-list">${[['anxiety','擔心失去連結'],['avoidance','傾向保持距離']].map(([key,label]) => `<div class="axis-row"><div><span>${label}</span><span>${result[key]} / 100</span></div><div class="axis-track"><div class="axis-fill" style="width:${result[key]}%"></div></div></div>`).join('')}</div></div>`;
}

function renderResult(focus = true) {
  const result = scoreQuiz(state.answers);
  if (!result) { state.phase = 'quiz'; state.cursor = state.answers.findIndex(value => value === null); renderQuiz(focus); return; }
  const type = TYPES[result.type];
  main.innerHTML = `<section class="result fade-in"><div class="result-lead"><div><p class="eyebrow">YOUR WORKPLACE CONNECTION NOTE</p><p class="result-overline">你此刻比較接近</p><h1 class="result-title" tabindex="-1">${escapeHTML(type.name)}</h1>${result.closeToBoundary ? '<p class="boundary-note">你的回答接近交界，可能同時有不同傾向；以下只是這次回答的暫時落點。</p>' : ''}<p class="result-subtitle">${escapeHTML(type.subtitle)}</p><p class="result-summary">${escapeHTML(type.summary)}</p><p class="result-sentence">「${escapeHTML(type.sentence)}」</p></div>${relationshipMap(result)}</div><div class="result-grid"><section class="result-section"><h2><span class="section-index">01</span>你帶進關係的力量</h2><ul>${type.strengths.map(text => `<li>${escapeHTML(text)}</li>`).join('')}</ul></section><section class="result-section"><h2><span class="section-index">02</span>累的時候，可能會…</h2><ul>${type.traps.map(text => `<li>${escapeHTML(text)}</li>`).join('')}</ul></section><section class="result-section practice-section"><h2><span class="section-index">03</span>下一個工作日，練習一點點</h2><div class="practices">${type.practice.map(item => `<article class="practice-card"><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.text)}</p></article>`).join('')}</div></section><section class="result-section script-section"><div><h2><span class="section-index">04</span>移動辦公室・換句話說</h2><p class="script-scene">${escapeHTML(type.script.scene)}</p></div><div class="script-dialogue"><div class="script-line you"><small>你可以這樣說</small>${escapeHTML(type.script.you)}</div><div class="script-line reply"><small>小劇場裡的回應</small>${escapeHTML(type.script.reply)}</div></div></section></div><div class="result-actions"><button class="primary" data-action="copy">複製我的職場便條 <span aria-hidden="true">↗</span></button><button class="secondary" data-action="download">下載結果卡 ↓</button><button class="secondary" data-action="review">回看我的答案 ↗</button></div><p class="result-footnote">這是依據你本次回答整理的探索結果，並非診斷。環境、對象與當下的安全感，都可能讓你的答案改變。下載與複製的便條只含結果摘要，不含逐題答案。</p><div class="result-links"><button class="text-button" data-action="restart">換個心情，重新作答</button><button class="text-button" data-action="method">看看計分與資料說明 ↗</button></div></section>`;
  if (focus) focusHeading('h1');
}

function render(focus = false) {
  if (state.phase === 'result') renderResult(focus);
  else if (state.phase === 'quiz') renderQuiz(focus);
  else renderIntro(focus);
  showStorage();
}

function shareText() {
  const result = scoreQuiz(state.answers);
  const type = TYPES[result.type];
  return `我的禾多職場便條｜${type.name}\n${type.subtitle}\n「${type.sentence}」\n\n擔心失去連結 ${result.anxiety}/100・傾向保持距離 ${result.avoidance}/100\n${result.closeToBoundary ? '我的分數接近分界，可能同時帶有多種傾向。\n' : ''}一份職場自我探索遊戲，非心理診斷。\n${new URL('./', location.href).href}`;
}

async function copyResult() {
  const text = shareText();
  try {
    if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
    await navigator.clipboard.writeText(text);
    toast('職場便條已複製。分享前，先照顧自己的心情。');
  } catch {
    const textarea = document.querySelector('#copy-text');
    textarea.value = text;
    document.querySelector('#copy-dialog').showModal();
    textarea.focus();
    textarea.select();
  }
}

function downloadResult() {
  const result = scoreQuiz(state.answers);
  const type = TYPES[result.type];
  const wrap = (text, width = 22) => Array.from(text).reduce((lines, char, index) => { if (index % width === 0) lines.push(''); lines[lines.length - 1] += char; return lines; }, []);
  const subtitleLines = wrap(type.subtitle, 20);
  const sentenceLines = wrap(`「${type.sentence}」`, 22);
  const note = result.closeToBoundary ? '分數接近分界，也可能同時帶有不同傾向。' : '關係不是考績，不必拿滿分。';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1120" viewBox="0 0 900 1120"><rect width="900" height="1120" fill="#f7f4ec"/><g font-family="PingFang TC,Microsoft JhengHei,sans-serif" fill="#234c43"><circle cx="102" cy="97" r="34" fill="none" stroke="#234c43"/><text x="102" y="109" text-anchor="middle" font-size="33">禾</text><text x="157" y="95" font-size="23">禾多人生</text><text x="157" y="119" font-size="10" letter-spacing="3">HEDO LIFE / RELATIONSHIP LAB</text><path d="M70 160h760" stroke="#cdd4c1"/><text x="75" y="230" font-size="15" letter-spacing="3">MY WORKPLACE CONNECTION NOTE</text><text x="75" y="300" font-size="20" fill="#ad573e">我此刻比較接近</text><text x="70" y="385" font-size="68">${escapeHTML(type.name)}</text>${subtitleLines.map((line,index) => `<text x="75" y="${445 + index * 35}" font-size="25">${escapeHTML(line)}</text>`).join('')}<path d="M75 550h750" stroke="#cdd4c1"/>${sentenceLines.map((line,index) => `<text x="75" y="${615 + index * 40}" font-size="28">${escapeHTML(line)}</text>`).join('')}<text x="75" y="790" font-size="18">擔心失去連結</text><text x="825" y="790" font-size="20" text-anchor="end">${result.anxiety} / 100</text><rect x="75" y="809" width="750" height="7" fill="#dce3ce"/><rect x="75" y="809" width="${result.anxiety * 7.5}" height="7" fill="#234c43"/><text x="75" y="862" font-size="18">傾向保持距離</text><text x="825" y="862" font-size="20" text-anchor="end">${result.avoidance} / 100</text><rect x="75" y="881" width="750" height="7" fill="#dce3ce"/><rect x="75" y="881" width="${result.avoidance * 7.5}" height="7" fill="#ad573e"/><text x="75" y="947" font-size="17" fill="#687560">${escapeHTML(note)}</text><path d="M75 983h750" stroke="#cdd4c1"/><text x="75" y="1025" font-size="16">禾多職場依附測驗 · 原創自我探索遊戲，非心理診斷。</text><text x="75" y="1060" font-size="15" fill="#687560">${escapeHTML(new URL('./', location.href).href)}</text></g></svg>`;
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `禾多職場便條-${type.name}.svg`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  toast('已準備結果卡，請查看瀏覽器的下載項目。');
}

document.addEventListener('change', event => {
  if (!event.target.matches('input[name="answer"]')) return;
  const value = Number(event.target.value);
  if (!Number.isInteger(value) || value < 1 || value > 5) return;
  state.answers[state.cursor] = value;
  persist();
  const button = document.querySelector('#next-button');
  if (button) button.disabled = false;
  const count = answered();
  document.querySelector('.quiz-top strong').textContent = `已回答 ${count} / ${QUESTIONS.length}`;
  document.querySelector('.progress-track').setAttribute('aria-valuenow', String(count));
  document.querySelector('.progress-fill').style.width = `${count / QUESTIONS.length * 100}%`;
});

document.addEventListener('submit', event => {
  if (event.target.id !== 'question-form') return;
  event.preventDefault();
  if (!state.answers[state.cursor]) return;
  if (state.cursor < QUESTIONS.length - 1) state.cursor++;
  else if (scoreQuiz(state.answers)) state.phase = 'result';
  else state.cursor = state.answers.findIndex(value => value === null);
  persist();
  render(true);
});

document.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  switch (button.dataset.action) {
    case 'start':
      state.phase = answered() === QUESTIONS.length ? 'result' : 'quiz';
      if (state.phase === 'quiz' && state.cursor === 0 && answered()) state.cursor = state.answers.findIndex(value => value === null);
      persist(); render(true); break;
    case 'previous':
      if (state.cursor > 0) state.cursor--;
      persist(); renderQuiz(); break;
    case 'pause':
      state.phase = 'intro'; persist(); renderIntro(true); break;
    case 'review':
      state.phase = 'quiz'; state.cursor = 0; persist(); renderQuiz(); break;
    case 'restart': document.querySelector('#restart-dialog').showModal(); break;
    case 'confirm-restart':
      if (!clearProgress()) storageAvailable = false;
      state = freshProgress();
      state.phase = 'quiz';
      persist();
      document.querySelector('#restart-dialog').close();
      render(true); break;
    case 'method': document.querySelector('#method-dialog').showModal(); break;
    case 'close-dialog': button.closest('dialog')?.close(); break;
    case 'copy': void copyResult(); break;
    case 'download': downloadResult(); break;
  }
});

render();
