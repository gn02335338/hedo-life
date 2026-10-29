import { canRequestDuelV75, getDuelTargetsV75, requestDuelV75, applyDuelPlayV75 } from './engine.js';
import { createCareerDuelModelV75, isCareerDuelV75 } from './career-duel-v75.js';
import { mountIslandBrawl } from './island/brawl-ui.js';
import { displayPersona } from './persona.js';

const person = id => id === 'hidden-visitor' ? { name: '魚酥姐', title: '眼前的隱藏角色' } : displayPersona(id);
const portrait = id => (person(id).image || './assets/hidden-visitor.png').replace(/^\.\//, '/');
const escape = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export function createCareerDuelUIV75({ document: doc, getRun, setRun, getScreen, getRevision, view, finishRecord, game, openDialog, dialog, main }) {
  let mounted = null, picker = null;
  const dispose = () => { mounted?.destroy(); mounted = null; picker = null; };
  const current = () => getScreen() === 'game' && !dialog.open;
  function commit(target, expected) {
    const run = getRun();
    if (run !== expected || !getDuelTargetsV75(run).includes(target)) return;
    const next = requestDuelV75(run, target); if (next === run) return;
    setRun(next); finishRecord(); game();
  }
  function begin() {
    const run = getRun();
    if (!current() || !canRequestDuelV75(run)) return;
    const targets = getDuelTargetsV75(run);
    if (targets.length === 1) { commit(targets[0], run); return; }
    picker = { run, revision: getRevision(), targets };
    openDialog(`<section class="rage-target-picker" data-duel-target-picker><span class="eyebrow">OUTSIDE. NOW.</span><h2 id="dialog-title">你要找誰單挑？</h2><p class="dialog-lead">選一位眼前的人，正式提出邀戰。也可以收回這個念頭。</p><div class="rage-target-grid targets-${targets.length}">${targets.map(id => `<button type="button" class="rage-person-card" data-action="duel-target" data-duel-target="${escape(id)}"><img class="rage-person-avatar" src="${escape(portrait(id))}" alt=""><span class="rage-person-title">${escape(person(id).title)}</span><b>${escape(person(id).name)}</b><span class="rage-person-action">就向他發起單挑 ↗</span></button>`).join('')}</div><button type="button" class="secondary" data-action="duel-cancel">先不單挑，回到故事 ←</button></section>`);
  }
  doc.addEventListener('click', event => {
    const node = event.target.closest?.('[data-action]'); if (!node) return;
    if (node.dataset.action === 'duel-invite') begin();
    if (node.dataset.action === 'duel-cancel') { picker = null; dialog.close(); }
    if (node.dataset.action === 'duel-target') {
      const context = picker, target = node.dataset.duelTarget;
      if (!context || !dialog.open || !dialog.querySelector('[data-duel-target-picker]') || context.run !== getRun()
        || context.revision !== getRevision() || !context.targets.includes(target)) return;
      picker = null; dialog.close(); commit(target, context.run);
    }
  });
  return Object.freeze({ dispose,
    controlHTML() {
      const run = getRun(); if (!isCareerDuelV75(run) || !canRequestDuelV75(run)) return '';
      return '<button type="button" class="choice duel-trigger" data-action="duel-invite"><span class="rage-icon" aria-hidden="true">⚔</span><span class="choice-text"><b>發起單挑</b><small>向眼前的人提出邀戰，每個工作回合一次，本局最多兩次。</small></span><span class="choice-arrow" aria-hidden="true">↗</span></button>';
    },
    playScreen(focus = true) {
      const run = getRun(), context = run?.duelContextV75;
      if (!context || context.stage !== 'battle' || run.pending) return false;
      const who = person(context.target);
      view(`<section class="career-duel-page"><div class="page-heading"><span class="eyebrow">同一局人生 / 移動島實戰</span><h1>與${escape(who.name)}單挑</h1><p class="page-lead">打完回到「${escape(context.sourceTitle)}」。</p></div><div data-career-duel-arena></div></section>`, 'game', focus);
      const model = createCareerDuelModelV75({ opponentId: context.target, seed: context.seed });
      mounted = mountIslandBrawl({ container: main.querySelector('[data-career-duel-arena]'), model,
        opponent: { id: context.target, name: who.name, title: who.title, image: portrait(context.target) },
        reducedMotion: doc.defaultView.matchMedia('(prefers-reduced-motion: reduce)').matches,
        onFinish(_outcome, _summary, proof) {
          if (getRun() !== run || getScreen() !== 'game') return;
          const next = applyDuelPlayV75(run, proof); if (next === run) return;
          setRun(next); finishRecord(); game();
        },
      });
      return true;
    },
  });
}
