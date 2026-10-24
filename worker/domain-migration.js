import {
  SOURCE_ORIGIN,
  TARGET_ORIGIN,
  MAX_PAYLOAD_BYTES,
  validateMigrationPayload,
  validateReturnTo,
} from '../dist/domain-migration.js';

// Only one bounded multipart field is accepted. Nothing from a migration is
// persisted by the Worker, the archive, or application logs.
export const MAX_MIGRATION_FORM_BYTES = 16 * 1024 * 1024;
const MARKER_COOKIE = 'hodo_migrated_v1';
const MIGRATION_ROOT = '/_hodo';

class MigrationError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

function privateHeaders(extra = {}) {
  return {
    'Cache-Control': 'private, no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    ...extra,
  };
}

function failure(status, code, method) {
  const headers = privateHeaders({ 'Content-Type': 'application/json; charset=utf-8' });
  if (status === 405) headers.Allow = method;
  return new Response(JSON.stringify({ error: code, message: '網址搬移暫時無法完成，原本的進度仍保留在瀏覽器。' }), { status, headers });
}

function jsonForHTML(value) {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, character => ({
    '<': '\\u003c', '>': '\\u003e', '&': '\\u0026', '\u2028': '\\u2028', '\u2029': '\\u2029',
  })[character]);
}

function migrationPage(request, config) {
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const headers = privateHeaders({
    'Content-Type': 'text/html; charset=utf-8',
    // Fetch can turn a cross-origin native form's Origin into null under
    // no-referrer. Export sends only its origin so the exact Origin guard can
    // authenticate the transfer without exposing a path or saved data.
    'Referrer-Policy': config.mode === 'export' ? 'strict-origin' : 'no-referrer',
    'Content-Security-Policy': `default-src 'none'; script-src 'self'; style-src 'nonce-${nonce}'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action ${TARGET_ORIGIN}`,
  });
  const html = `<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>禾多人生・前往新網址</title>
<style nonce="${nonce}">:root{color-scheme:light;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Noto Sans TC",sans-serif;color:#292b25;background:#f5f4ed}body{margin:0;padding:24px;min-height:90vh;display:grid;place-items:center}main{width:min(100%,620px);box-sizing:border-box;padding:32px;border:1px solid #d8dcce;border-radius:20px;background:#fff;box-shadow:0 14px 45px #35452c12}h1{font-size:1.7rem;line-height:1.4}p{line-height:1.8;overflow-wrap:anywhere}button,a{font:inherit}button{display:inline-block;margin:8px 8px 8px 0;padding:12px 18px;border:1px solid #536b43;border-radius:10px;background:#536b43;color:#fff;cursor:pointer}button:disabled{opacity:.6;cursor:wait}a{color:#3f612f}pre{white-space:pre-wrap;overflow-wrap:anywhere}noscript{line-height:1.8}</style>
</head><body><main id="hodo-migration-root" aria-live="polite"><h1>正在前往新網址</h1><p>正在確認這個瀏覽器的進度…</p><noscript>請啟用 JavaScript，以便將這個瀏覽器的遊戲進度帶到新網址。原本的進度仍保留在瀏覽器。</noscript></main>
<script id="hodo-migration-config" type="application/json">${jsonForHTML(config)}</script>
<script type="module" src="/domain-migration-ui.js"></script></body></html>`;
  return new Response(request.method === 'HEAD' ? null : html, { headers });
}

function returnPath(url) {
  try {
    const values = url.searchParams.getAll('returnTo');
    if (values.length > 1) throw new Error('duplicate');
    return validateReturnTo(values[0] ?? '/');
  } catch {
    throw new MigrationError(400, 'invalid_return_path');
  }
}

function isDocumentNavigation(request, url) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;
  if (request.headers.get('Sec-Fetch-Mode') === 'navigate' || request.headers.get('Sec-Fetch-Dest') === 'document') return true;
  if ((request.headers.get('Accept') || '').toLowerCase().includes('text/html')) return true;
  return ['/', '/index.html', '/island', '/island/', '/island/index.html', '/arpg', '/arpg/', '/arpg/index.html', '/gta', '/gta/', '/gta/index.html', '/cards', '/cards/', '/cards/index.html'].includes(url.pathname);
}

function migrationWasVisited(request) {
  return (request.headers.get('Cookie') || '').split(';').some(part => part.trim() === `${MARKER_COOKIE}=1`);
}

async function boundedForm(request) {
  const contentType = request.headers.get('Content-Type') || '';
  if (contentType.split(';')[0].trim().toLowerCase() !== 'multipart/form-data') throw new MigrationError(415, 'multipart_required');
  const declared = request.headers.get('Content-Length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MAX_MIGRATION_FORM_BYTES)) {
    throw new MigrationError(/^\d+$/.test(declared) ? 413 : 400, 'invalid_migration_size');
  }
  if (!request.body) throw new MigrationError(400, 'missing_migration_payload');
  const reader = request.body.getReader();
  let size = 0, tooLarge = false;
  const body = new ReadableStream({
    async pull(controller) {
      try {
        const part = await reader.read();
        if (part.done) { controller.close(); return; }
        size += part.value.byteLength;
        if (size > MAX_MIGRATION_FORM_BYTES) {
          tooLarge = true;
          controller.error(new Error('migration_size_limit'));
          await reader.cancel().catch(() => {});
          return;
        }
        controller.enqueue(part.value);
      } catch {
        controller.error(new Error('migration_read_failed'));
      }
    },
    async cancel() { await reader.cancel().catch(() => {}); },
  });
  try {
    return await new Response(body, { headers: { 'Content-Type': contentType } }).formData();
  } catch {
    throw new MigrationError(tooLarge ? 413 : 400, tooLarge ? 'migration_too_large' : 'invalid_migration_form');
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

async function importPayload(request) {
  const form = await boundedForm(request);
  const fields = [...form.entries()];
  if (fields.length !== 1 || fields[0][0] !== 'payload' || typeof fields[0][1] !== 'string') throw new MigrationError(400, 'invalid_migration_form');
  const raw = fields[0][1];
  if (raw.length > MAX_PAYLOAD_BYTES || new TextEncoder().encode(raw).byteLength > MAX_PAYLOAD_BYTES) throw new MigrationError(413, 'migration_too_large');
  try {
    return validateMigrationPayload(JSON.parse(raw));
  } catch (error) {
    throw new MigrationError(error?.message === 'migration_too_large' ? 413 : 400,
      error?.message === 'migration_too_large' ? 'migration_too_large' : 'invalid_migration_payload');
  }
}

// Returning null lets the existing same-origin API and static asset dispatch
// continue unchanged, including on localhost and on the old production host.
export async function handleDomainMigration(request) {
  const url = new URL(request.url);
  if (![SOURCE_ORIGIN, TARGET_ORIGIN].includes(url.origin)) return null;
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return null;
  const isSource = url.origin === SOURCE_ORIGIN;
  try {
    if (url.pathname === MIGRATION_ROOT || url.pathname.startsWith(`${MIGRATION_ROOT}/`)) {
      if (url.pathname === `${MIGRATION_ROOT}/import` && !isSource) {
        if (request.method !== 'POST') return failure(405, 'method_not_allowed', 'POST');
        if (request.headers.get('Origin') !== SOURCE_ORIGIN) return failure(403, 'invalid_migration_origin');
        const payload = await importPayload(request);
        return migrationPage(request, { mode: 'import', returnTo: payload.returnTo, payload });
      }
      const mode = isSource && url.pathname === `${MIGRATION_ROOT}/export` ? 'export'
        : isSource && url.pathname === `${MIGRATION_ROOT}/complete` ? 'complete'
          : !isSource && url.pathname === `${MIGRATION_ROOT}/recover` ? 'recover' : null;
      if (mode) {
        if (!['GET', 'HEAD'].includes(request.method)) return failure(405, 'method_not_allowed', 'GET, HEAD');
        return migrationPage(request, { mode, returnTo: returnPath(url), ...(mode === 'export' ? { force: true } : {}) });
      }
      return failure(404, 'migration_not_found');
    }
    if (!isDocumentNavigation(request, url)) return null;
    if (!isSource && migrationWasVisited(request)) return null;
    const returnTo = validateReturnTo(`${url.pathname}${url.search}`);
    return migrationPage(request, { mode: isSource ? 'export' : 'entry', returnTo });
  } catch (error) {
    if (error instanceof MigrationError) return failure(error.status, error.code);
    // Never expose request bodies, credentials, or parser errors.
    return failure(400, 'invalid_migration_request');
  }
}
