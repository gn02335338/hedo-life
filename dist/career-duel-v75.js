import { createIslandBrawl } from './island/brawl.js';
import { getBrawlProfile } from './island/brawl-roster.js';
import { displayPersona } from './persona.js';

export const isCareerDuelV75 = value => /^e39-r75-[nsd]-[0-9a-f]{22}$/.test(typeof value === 'string' ? value : value?.seed || '');
export const DUEL_STEP_V75 = 1 / 30;
export const DUEL_FRAME_LIMIT_V75 = 2251;
const clamp = n => Math.max(0, Math.min(100, n));
const nameOf = id => id === 'hidden-visitor' ? '魚酥姐' : displayPersona(id).name;
const copy = value => structuredClone(value);
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join(',') === keys;

// Nine digital directions and four buttons fit in one byte. The same fixed
// 30 Hz inputs drive the browser and canonical replay; no posted score is used.
export function encodeDuelInputV75(input = {}) {
  const axis = n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) >= .25 ? n < 0 ? 0 : 2 : 1;
  return ((axis(input.y) * 3 + axis(input.x)) * 16 + (input.attack === true ? 1 : 0)
    + (input.dodge === true ? 2 : 0) + (input.special === true ? 4 : 0) + (input.throw === true ? 8 : 0)).toString(16).padStart(2, '0');
}
export function decodeDuelInputV75(hex) {
  const value = Number.parseInt(hex, 16), direction = value >> 4;
  if (!/^[0-9a-f]{2}$/.test(hex) || direction > 8) throw new Error('Invalid duel input');
  return { x: direction % 3 - 1, y: Math.floor(direction / 3) - 1, attack: !!(value & 1), dodge: !!(value & 2), special: !!(value & 4), throw: !!(value & 8) };
}
export function validateDuelProofV75(input) {
  if (!exact(input, 'forfeit,frames') || typeof input.forfeit !== 'boolean' || typeof input.frames !== 'string'
    || input.frames.length % 2 || input.frames.length > DUEL_FRAME_LIMIT_V75 * 2 || !/^[0-8][0-9a-f](?:[0-8][0-9a-f])*$|^$/.test(input.frames)) throw new Error('Invalid duel recording');
  return input;
}
export function replayCareerDuelV75(opponentId, seed, input) {
  validateDuelProofV75(input);
  const model = createIslandBrawl({ opponentId, seed }); model.start();
  for (let offset = 0; offset < input.frames.length; offset += 2) {
    if (model.getState().phase !== 'playing') throw new Error('Duel input after finish');
    model.step(DUEL_STEP_V75, decodeDuelInputV75(input.frames.slice(offset, offset + 2)));
  }
  if (input.forfeit) {
    if (model.getState().phase !== 'playing') throw new Error('Duel already finished');
    model.forfeit();
  }
  const state = model.getState();
  if (state.phase !== 'finished') throw new Error('Unfinished duel recording');
  return state;
}
export function createCareerDuelModelV75({ opponentId, seed }) {
  const model = createIslandBrawl({ opponentId, seed });
  let carry = 0, frames = '', paused = false, forfeited = false, pulses = {};
  const getState = () => { const state = model.getState(); return paused && state.phase === 'playing' ? { ...state, phase: 'paused' } : state; };
  return Object.freeze({ getState, start: () => model.start(),
    step(dt, input = {}) {
      if (paused || model.getState().phase !== 'playing' || !Number.isFinite(dt) || dt <= 0) return getState();
      for (const key of ['dodge', 'special', 'throw']) pulses[key] = pulses[key] || input[key] === true;
      carry += Math.min(.05, dt);
      while (carry + 1e-10 >= DUEL_STEP_V75 && model.getState().phase === 'playing') {
        const encoded = encodeDuelInputV75({ ...input, ...pulses }); frames += encoded;
        model.step(DUEL_STEP_V75, decodeDuelInputV75(encoded)); carry -= DUEL_STEP_V75; pulses = {};
      }
      return getState();
    },
    pause() { if (model.getState().phase === 'playing') paused = true; pulses = {}; return getState(); },
    resume() { paused = false; return getState(); },
    forfeit() { if (model.getState().phase === 'playing') { forfeited = true; paused = false; model.forfeit(); } return getState(); },
    getProof: () => ({ frames, forfeit: forfeited }),
  });
}

export function duelCompanyIssueV75(id, status) {
  if (status === 'free') return null;
  const who = nameOf(id), where = status === 'hospital' ? '住院' : '留在警局補筆錄';
  if (['wing', 'spencer', 'rick'].includes(id)) return { kind: 'approval', title: '決策與簽核停擺', text: `${who}${where}，公司等不到有權簽字的人。採購與客戶承諾卡在最後一關，大家第一次希望老闆趕快回信。` };
  if (['sonny', 'janet', 'sophie', 'cindy'].includes(id)) return { kind: 'payroll', title: '請款與發薪覆核塞車', text: `${who}${where}，付款清單少了一位覆核窗口。財會得重新對帳，月底的匯款排程也跟著亮紅燈。` };
  if (['jack', 'henry', 'wine', 'jonathan', 'sam', 'peter'].includes(id)) return { kind: 'delivery', title: '技術交付缺一角', text: `${who}${where}，上線窗口與交接都少了一個人。客戶等不到版本，同事只能對著「快好了」三個字值班。` };
  if (['meimei', 'hester', 'action', 'johnny', 'princess', 'joyce'].includes(id)) return { kind: 'customer', title: '客戶與專案窗口斷線', text: `${who}${where}，外部會議沒人能接續確認承諾。專案表沒有受傷，卻第一個需要急救。` };
  return { kind: 'handover', title: '同事工作臨時重分', text: `${who}${where}，原本的交付得找人代班。空椅子沒有請假單，待辦卻照樣每天報到。` };
}
export function duelHistoryChangeV75(run, row) {
  const outcome = row?.duelOutcome;
  if (!isCareerDuelV75(run) || row?.kind !== 'duel' || !outcome || outcome.version !== 1 || row.speaker !== outcome.target || !getBrawlProfile(outcome.target)) return null;
  if (outcome.phase === 'invitation' && exact(outcome, 'accepted,phase,target,version') && row.eventId === 'duel75-invitation' && typeof outcome.accepted === 'boolean') return { affinityDelta: outcome.accepted ? -3 : -2, realHits: 0 };
  if (outcome.phase === 'battle' && exact(outcome, 'companyIssue,outcome,phase,playerStatus,summary,target,targetStatus,version') && row.eventId === 'duel75-result'
    && ['win', 'lose', 'draw'].includes(outcome.outcome) && ['hospital', 'police', 'free'].includes(outcome.playerStatus) && ['hospital', 'police', 'free'].includes(outcome.targetStatus)
    && Number.isFinite(outcome.summary?.damageDealt) && outcome.summary.damageDealt >= 0 && outcome.summary.damageDealt <= 10000) return { affinityDelta: outcome.summary.damageDealt > 0 ? -16 : -2, realHits: outcome.summary.damageDealt > 0 ? 1 : 0 };
  if (outcome.phase === 'aftercare' && exact(outcome, 'choice,companyIssue,phase,resolution,target,version') && row.eventId === 'duel75-aftercare'
    && ['delegated', 'disrupted'].includes(outcome.resolution) && [0, 1, 2].includes(outcome.choice) && row.choiceIndex === outcome.choice) return { affinityDelta: outcome.resolution === 'delegated' ? 3 : -4, realHits: 0 };
  return null;
}
function ledger(next, event, choiceText, result, delta, outcome, label, jobTitle, choiceIndex = 0) {
  const actual = Object.fromEntries(Object.keys(next.stats).map(key => {
    const before = next.stats[key]; next.stats[key] = clamp(before + (delta[key] || 0)); return [key, next.stats[key] - before];
  }));
  if (actual.cash < 0) next.flags.cash_spent_total = (next.flags.cash_spent_total || 0) - actual.cash;
  next.history.push({ eventId: event.id, kind: 'duel', title: event.title, body: event.body, wing: event.wing || '', speaker: event.speaker,
    sourceIds: [], turn: next.turn, choiceIndex, choiceText, result, chanceOutcome: null, delta: actual, weather: null,
    jobTitle, pay: next.pay, breakdown: [{ source: 'duel75', label: '單挑後續', delta: Object.fromEntries(Object.entries(actual).filter(([, value]) => value)) }],
    eventOutcome: { label: '單挑結果', result: label }, duelOutcome: { version: 1, ...outcome } });
  next.pending = true; next.pendingEffect = 'duel75Continue';
}
export function getCareerDuelEventV75(run) {
  const c = run.duelContextV75; if (!c) return null;
  const who = nameOf(c.target), stage = c.stage;
  const base = { id: `duel75-${stage}`, kind: 'duel', era: '同事單挑', scope: 'private', speaker: c.target, sourceIds: [], scene: 'office_day',
    hiddenCharacter: c.target === 'hidden-visitor', wing: '', choices: [] };
  if (stage === 'invitation') return { ...base, title: '一句單挑，對方怎麼回？', body: `你向${who}提出：「現在，出去單挑。」原本的對話停在這裡，等對方回答。` };
  if (stage === 'battle') return { ...base, kind: 'duel-battle', title: `你與${who}的單挑`, body: '移動島的場地已清空。這場要親自走位、連擊與閃避，打完再接回原本的對話。' };
  if (stage === 'result') return { ...base, title: '拳頭收工，後續才報到', body: `你與${who}已停手。勝負、就醫與現場處理都已記下，接著得收拾留下的工作。` };
  if (stage === 'closing') return { ...base, id: 'duel75-aftercare', title: c.issue?.title || '單挑善後完成', body: '這次單挑的現場處理與工作交接，已經留下紀錄。' };
  if (stage === 'aftercare') return { ...base, title: c.issue?.title || '打完了，還要把事情說完', body: `${c.playerStatus === 'hospital' ? '你在醫院處理傷勢，手機裡還有同事等回覆。' : c.playerStatus === 'police' ? '你得先補完筆錄，不能靠一句切磋把經過刪掉。' : '你仍能自由行動，現場經過和代班安排得先說清楚。'}${c.issue?.text || '對方仍能回到工作，你們也得約好別讓下一次討論又變成擂台。'}`,
    choices: [
      { text: '先處理傷勢／筆錄，再把交接補清楚', available: true },
      { text: '花 8 存款請支援代班、整理文件', available: run.stats.cash >= 8 },
      { text: '開一場「拳責歸屬會議」，把拳頭也列入組織圖', available: true },
    ] };
  throw new Error('Unknown duel stage');
}
export function requestCareerDuelStateV75(run, target, event, jobTitle, roll) {
  const next = copy(run), who = nameOf(target);
  const chance = ['wing', 'spencer', 'sonny'].includes(target) ? .38 : ['jack', 'tony', 'owen', 'kind'].includes(target) ? .72 : .55;
  const accepted = roll(next) < chance;
  next.flags.duel75_last_turn = run.turn + 1; next.flags.duel75_count = (next.flags.duel75_count || 0) + 1;
  next.duelContextV75 = { version: 1, target, stage: 'invitation', accepted, returnEventId: run.eventId, sourceTitle: event.title,
    seed: `${run.seed}:duel75:${next.flags.duel75_count}:${target}` };
  const scene = getCareerDuelEventV75(next); next.eventId = scene.id;
  next.actions.push({ type: 'duel-invite', version: 1, eventId: event.id, target });
  const refusal = ['wing', 'spencer', 'rick'].includes(target)
    ? `${who}把邀戰當成一份沒蓋章的公文退回：「要排時間，請先走簽核。」旁邊的人笑出聲，你只好把拳頭放回口袋。`
    : ['jack', 'henry', 'wine'].includes(target) ? `${who}看了一眼待辦：「Bug 還沒打完，先別加你的血條。」他拒絕出場，這次邀戰就到這裡。`
      : `${who}搖頭：「我今天的體力要留給下班。」他沒有接受，也沒有因此被算成輸家；你們把這段尷尬留在對話裡。`;
  ledger(next, scene, `向${who}發起單挑`, accepted ? `${who}接受了，把隨身東西放到場邊：「${getBrawlProfile(target).opening}」你們一起走進移動島戰鬥，原本尚未回答的事暫時擱著。` : refusal,
    accepted ? { trust: -1 } : { mood: -2, trust: -1 }, { phase: 'invitation', target, accepted }, accepted ? '對方接受' : '對方拒絕', jobTitle);
  return next;
}
export function settleCareerDuelStateV75(run, input, jobTitle, roll) {
  const c = run.duelContextV75;
  const state = replayCareerDuelV75(c.target, c.seed, input), next = copy(run), context = next.duelContextV75;
  const won = state.outcome === 'win', lost = state.outcome === 'lose', contact = state.summary.damageDealt + state.summary.damageTaken > 0;
  const knockout = state.summary.reason === 'knockout';
  const playerRoll = roll(next), targetRoll = roll(next);
  const playerStatus = won ? playerRoll < (knockout ? .6 : .3) ? 'police' : 'free'
    : lost && contact && playerRoll < (knockout ? .75 : .35) ? 'hospital' : 'free';
  const targetStatus = won && contact && targetRoll < (knockout ? .75 : .4) ? 'hospital'
    : lost && contact && targetRoll < (knockout ? .55 : .25) ? 'police' : 'free';
  Object.assign(context, { stage: 'result', outcome: state.outcome, playerStatus, targetStatus, issue: duelCompanyIssueV75(c.target, targetStatus), summary: state.summary });
  if (state.summary.damageDealt > 0) next.flags.duel75_real_hits = (next.flags.duel75_real_hits || 0) + 1;
  next.eventId = 'duel75-result';
  next.actions.push({ type: 'duel-play', version: 1, eventId: run.eventId, input: copy(input) });
  const who = nameOf(c.target), disposition = status => status === 'hospital' ? '前往醫院處理傷勢' : status === 'police' ? '到警局說明現場經過' : '留在現場收拾';
  const result = `${state.summary.reason === 'forfeit' ? '你舉手認輸，場上立刻停手。' : won ? '你贏了，滿地紙屑卻不會自己復原。' : lost ? `${who}勝出，你總算知道這不是腦內劇場。` : '時間到，雙方收手，這場沒有分出勝負。'}你${disposition(playerStatus)}；${who}${disposition(targetStatus)}。${context.issue?.text || '兩邊仍能接續工作，場地整理與對話裂痕得另外處理。'}`;
  ledger(next, getCareerDuelEventV75(next), '親自完成移動島單挑', result,
    { energy: playerStatus === 'hospital' ? -12 : contact ? -5 : -1, mood: won ? 4 : lost ? -4 : 0,
      trust: context.issue ? -6 : -2, boss: ['wing', 'spencer'].includes(c.target) ? -8 : context.issue ? -2 : 0 },
    { phase: 'battle', target: c.target, outcome: state.outcome, playerStatus, targetStatus, companyIssue: context.issue?.kind || null, summary: state.summary },
    won ? '單挑勝出' : lost ? '單挑落敗' : '平手收場', jobTitle);
  return next;
}
export function applyCareerDuelChoiceV75(run, index, jobTitle, roll) {
  const event = getCareerDuelEventV75(run);
  if (!Number.isInteger(index) || !event.choices[index] || !event.choices[index].available) throw new Error('Unavailable duel aftermath choice');
  const next = copy(run), c = next.duelContextV75, who = nameOf(c.target), good = roll(next) < (index === 2 ? .35 : .8);
  const result = index === 0 ? `你先完成該辦的手續，再和${who}把現場經過及交接窗口寫清楚。${good ? '同事接手急件，公司卡住的安排終於能往下走。' : '文件補上了，臨時代班仍漏接一件急事，大家又多忙了一輪。'}`
    : index === 1 ? `支援人員拿走 8 存款的費用，協助補齊文件與代班。${good ? '窗口重新接上，欠下的人情還得日後慢慢還。' : '急件救回一半，另一半還得由你和同事補交接。'}`
      : `你把自己、${who}和兩隻拳頭畫進組織圖。${good ? '同事笑完反而開始確認代班人，這張荒謬的圖勉強救回一次交接。' : '會議沒人敢蓋章，缺席的工作還是得分攤，公司的問題沒有被那條箭頭打通。'}`;
  next.actions.push({ type: 'choice', eventId: run.eventId, index }); c.stage = 'closing';
  ledger(next, event, event.choices[index].text, result,
    { cash: index === 1 ? -8 : 0, energy: index === 0 ? -3 : 0, trust: good ? 3 : -4, mood: good ? 3 : -2, boss: c.issue && !good ? -3 : 0 },
    { phase: 'aftercare', target: c.target, resolution: good ? 'delegated' : 'disrupted', companyIssue: c.issue?.kind || null, choice: index }, good ? '完成善後與代班' : '善後留下工作缺口', jobTitle, index);
  // Keep the original event ID until its committed result has been continued.
  return next;
}
export function advanceCareerDuelStateV75(run) {
  if (!run.pending) return run;
  const next = copy(run), c = next.duelContextV75; next.pending = false; next.pendingEffect = null;
  if (c.stage === 'invitation' && c.accepted) { c.stage = 'battle'; next.eventId = 'duel75-battle'; return next; }
  if (c.stage === 'result') { c.stage = 'aftercare'; next.eventId = 'duel75-aftercare'; return next; }
  if (c.stage !== 'invitation' && c.stage !== 'closing') throw new Error('Invalid duel continuation');
  next.eventId = c.returnEventId; delete next.duelContextV75; return next;
}
