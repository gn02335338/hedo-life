import { ApiError } from './http.js';

export const FEEDBACK_REPOSITORY = 'gn02335338/hedo-life';
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CATEGORIES = { memory: '[史冊靈感]', suggestion: '[遊戲建議]', bug: '[問題回報]' };
const NATURES = ['個人回憶的摘要', '聽說的故事（未查證）', '純原創虛構橋段', '公開新聞或產品資料'];
const CAPS = { title: 80, content: 6000, nature: 100, choices: 2000, source: 1000, steps: 2000, expected: 2000, device: 200 };
const invalid = message => new ApiError(400, 'invalid_feedback', message);
const meaningful = text => text.replace(/\s/gu, '').length;

export function validateFeedback(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalid('投稿內容無法讀取。');
  if (typeof body.submissionId !== 'string' || !UUID.test(body.submissionId)) throw invalid('投稿編號無效。');
  if (typeof body.category !== 'string' || !Object.hasOwn(CATEGORIES, body.category)) throw invalid('請選擇投稿類型。');
  if (body.acknowledged !== true) throw invalid('公開前，請先確認這份投稿可以公開在 GitHub。');
  if (body.website !== undefined && body.website !== '') throw invalid('投稿內容無法讀取。');
  const result = { submissionId: body.submissionId.toLowerCase(), category: body.category, acknowledged: true };
  for (const [field, max] of Object.entries(CAPS)) {
    if (body[field] !== undefined && typeof body[field] !== 'string') throw invalid('投稿欄位必須是文字。');
    const value = (body[field] || '').trim();
    if (value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) throw invalid('有欄位超過字數上限，或含有無法使用的字元。');
    result[field] = value;
  }
  if (meaningful(result.title) < 3 || /[\r\n]/u.test(result.title)) throw invalid('標題請至少寫 3 個字，並使用單行文字。');
  if (meaningful(result.content) < 20) throw invalid('內容請至少寫 20 個字。');
  if (body.category === 'memory' && !NATURES.includes(result.nature)) throw invalid('請選擇素材性質。');
  if (body.category === 'bug' && (!result.steps || !result.expected)) throw invalid('請補上重現步驟與預期結果。');
  // Only category-specific fields are retained, never arbitrary client metadata.
  for (const field of ['nature', 'choices', 'source']) if (body.category !== 'memory') result[field] = '';
  for (const field of ['steps', 'expected', 'device']) if (body.category !== 'bug') result[field] = '';
  return result;
}

function plainBlock(value) {
  // A dynamic fence keeps Markdown, HTML, images, and mentions inert, even when
  // the submission itself includes fences. Disarm @mentions in the title too.
  const text = value.replace(/@/g, '@\u200b').replace(/<!-- hedo-feedback:/g, '<!-- hedo-feedback\u200b:');
  const longest = Math.max(2, ...(text.match(/`+/g) || []).map(run => run.length));
  const fence = '`'.repeat(longest + 1);
  return `${fence}text\n${text}\n${fence}`;
}

export function renderIssue(submission) {
  const fields = submission.category === 'memory'
    ? [['故事或經典橋段', 'content'], ['素材性質', 'nature'], ['你想讓玩家怎麼選？', 'choices'], ['可公開的參考來源', 'source']]
    : submission.category === 'bug'
      ? [['發生了什麼？', 'content'], ['重現步驟', 'steps'], ['預期與實際結果', 'expected'], ['裝置與瀏覽器', 'device']]
      : [['你的點子／希望改變什麼', 'content']];
  return {
    title: `${CATEGORIES[submission.category]} ${submission.title.replace(/@/g, '@\u200b')}`,
    body: [
      '透過「移動人生・史冊補完計畫」匿名投稿。投稿者已確認內容可公開，並可作為遊戲創作素材。內容尚未查證，不會自動加入遊戲。',
      ...fields.filter(([, field]) => submission[field]).map(([label, field]) => `### ${label}\n\n${plainBlock(submission[field])}`),
      `投稿編號：\`${submission.submissionId}\``,
      `<!-- hedo-feedback:${submission.submissionId} -->`,
    ].join('\n\n'),
  };
}

const ISSUER = 'https://token.actions.githubusercontent.com';
const JWKS_URL = `${ISSUER}/.well-known/jwks`;
const denied = () => new ApiError(401, 'publisher_unauthorized', '背景處理身分無效。');
function decodePart(part) {
  if (!/^[A-Za-z0-9_-]+$/.test(part)) throw denied();
  const binary = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

// GitHub signs a short-lived OIDC token for this exact main-branch workflow.
// It grants access to the outbox only; there is no long-lived GitHub PAT.
export async function validatePublisherToken(token, env, { fetchImpl = fetch, now = Date.now() } = {}) {
  try {
    if (typeof token !== 'string' || token.length > 16000) throw denied();
    const parts = token.split('.');
    if (parts.length !== 3) throw denied();
    const header = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(decodePart(parts[0])));
    const claims = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(decodePart(parts[1])));
    const seconds = Math.floor(now / 1000);
    if (header.alg !== 'RS256' || typeof header.kid !== 'string' || header.crit ||
        claims.iss !== ISSUER || claims.aud !== env.FEEDBACK_AUDIENCE ||
        !env.FEEDBACK_AUDIENCE || !env.FEEDBACK_REPOSITORY_ID || !env.FEEDBACK_WORKFLOW_REF ||
        claims.repository !== env.FEEDBACK_REPOSITORY || String(claims.repository_id) !== String(env.FEEDBACK_REPOSITORY_ID) ||
        claims.ref !== 'refs/heads/main' || claims.workflow_ref !== env.FEEDBACK_WORKFLOW_REF ||
        !['schedule', 'workflow_dispatch', 'workflow_run'].includes(claims.event_name) ||
        (env.FEEDBACK_OWNER_ID && String(claims.repository_owner_id) !== String(env.FEEDBACK_OWNER_ID)) ||
        !Number.isFinite(claims.exp) || claims.exp <= seconds ||
        !Number.isFinite(claims.iat) || claims.iat > seconds + 30 || claims.iat < seconds - 900 ||
        !Number.isFinite(claims.nbf) || claims.nbf > seconds + 30 || claims.exp - claims.iat > 900) throw denied();
    const response = await fetchImpl(JWKS_URL, { signal: AbortSignal.timeout(5000), cf: { cacheTtl: 300, cacheEverything: true } });
    if (!response.ok) throw denied();
    const jwks = await response.json();
    const jwk = jwks.keys?.find(key => key.kid === header.kid && key.kty === 'RSA' && (!key.alg || key.alg === 'RS256') && (!key.use || key.use === 'sig'));
    if (!jwk) throw denied();
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, decodePart(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`))) throw denied();
    return claims;
  } catch {
    throw denied();
  }
}
