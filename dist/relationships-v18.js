// The boss meter belongs to Wing. Other characters still affect trust, flags and
// their own story branches; they do not share a company-wide mood meter.
// This module is pure. The engine opts new lives in and supplies the resolved
// result, never the collection of outcomes that the player has not selected.
const WING = '(?:翅膀|(?<![A-Za-z0-9_])(?:Wing|WING)(?![A-Za-z0-9_]))';
const wingName = new RegExp(WING, 'u');
const directResponse = new RegExp(`${WING}.{0,18}(?:說|問|回|覺得|認為|嫌|滿意|不滿|點頭|拍桌|生氣|稱讚|要求|決定|下令|通知|傳訊|來電|打來|笑|訓|罵|瞪|同意|否決|批准|核准|記住|看到|看見|看完|讀到|收到|聽到|聽說|知道|接到|接通|交辦|交代|催|群組|訊息|指示|評語)`, 'u');
const reportedToWing = new RegExp(`(?:轉達|轉告|告知|通知|回報|報告|寄給|傳給|送給|傳到|傳進|傳回|送到|告狀|轉給|跟|向).{0,6}${WING}.{0,8}(?:說|報告|回報|$|[，。：「」])`, 'u');
const unnoticed = new RegExp(`(?:沒有|沒|未|並未|不曾|尚未|不會).{0,8}(?:通知|驚動|告知|傳到|傳給|回報|轉告|讓).{0,5}${WING}|${WING}.{0,5}(?:還不知道|並不知道|不知道|沒收到|沒有收到|沒看到|沒有看到|不知情)`, 'u');
const proxySpeakers = new Set(['hope', 'erich', 'jenjen', 'sonny', 'exit-team']);
const aftermathIds = new Set(['rage-aftermath', 'rage-legal', 'rage-showdown', 'rage-public']);

function prose(value) {
  return typeof value === 'string'
    ? value.replace(/(?:https?:\/\/|\.{1,2}\/)[^\s<>"'，。；）]+/gu, '')
    : '';
}

function wingResponds(result) {
  return prose(result).split(/[。！？!?；;\n]/u).some(sentence => {
    if (!wingName.test(sentence) || unnoticed.test(sentence)) return false;
    const beforeName = sentence.slice(0, sentence.search(wingName));
    if (/(?:如果|假如|萬一|要是|假設|等到)[^，,:：]*$/u.test(beforeName)) return false;
    return directResponse.test(sentence) || reportedToWing.test(sentence);
  });
}

function wingProxy(event) {
  if (!proxySpeakers.has(event?.speaker)) return false;
  const text = prose(event.body);
  return wingName.test(text)
    && /轉達|轉述|代言|交給|意見|評語|指示|決定|結論|覺得|說|要求|主導/u.test(text);
}

function indirect(delta, limit = 8) {
  return Math.max(-limit, Math.min(limit, Math.round(delta * .35)));
}

/**
 * Return the part of one resolved boss delta that reaches Wing's own meter.
 * `source: 'weather'` is his independent daily mood and always keeps its value.
 * Rage callers supply the verified context target and resolved mode/effect.
 * All other sources (including incidental luck) follow the conversation scope.
 */
export function scopedBossDeltaV18(event, delta, options = {}) {
  if (!Number.isFinite(delta) || delta === 0) return 0;
  if (options.source === 'weather') return delta;

  const rageRelease = event?.id === 'rage-release';
  const mode = options.mode || (rageRelease
    ? options.effect === 'rageReturn' ? 'imagined'
      : options.effect === 'rageAftermath' ? 'real' : null
    : null);
  if (mode === 'imagined') return 0;
  if (rageRelease && mode === 'real') {
    const target = options.target || event?.speaker;
    if (target === 'wing') return delta;
    // Violence against somebody else may reach him as office news, but the
    // victim's reaction is not secretly counted as Wing's personal reaction.
    return delta < 0 ? Math.max(delta, target === 'spencer' ? -3 : -5) : 0;
  }

  const speaker = event?.speaker || 'wing';
  if (aftermathIds.has(event?.id)) {
    return speaker === 'wing' || wingResponds(options.result) || wingProxy(event)
      ? indirect(delta) : 0;
  }
  if (speaker === 'wing') return delta;
  return wingResponds(options.result) || wingProxy(event) ? indirect(delta) : 0;
}

// Optional post-choice ledger copy. The numeric function above remains usable
// without adding narration, flags, persistent state or random draws.
export function wingMoodScopeV18(event, delta, options = {}) {
  const adjusted = scopedBossDeltaV18(event, delta, options);
  if (adjusted === delta || !Number.isFinite(delta)) return { delta: adjusted };
  const imagined = options.mode === 'imagined'
    || event?.id === 'rage-release' && options.effect === 'rageReturn';
  const notice = imagined
    ? '剛才只在腦內發生，翅膀的心情沒有跟著變。'
    : adjusted === 0
      ? '翅膀心情只記他本人的反應，這段先算你和對方的事。'
      : '消息傳到翅膀那裡，只影響他自己的心情；對方的反應另算。';
  return { delta: adjusted, notice };
}
