import {
  SOURCE_ORIGIN, TARGET_ORIGIN, captureSnapshot, snapshotDigest,
  createNonce, validateReturnTo, validateMigrationPayload, sourceWasAcknowledged,
  rememberPending, acknowledgeSource, importMigration, readBackups, restoreBackup,
} from './domain-migration.js';

const root = document.getElementById('hodo-migration-root');
const config = JSON.parse(document.getElementById('hodo-migration-config').textContent);
const recoverURL = `${TARGET_ORIGIN}/_hodo/recover`;
let busy = false;

function element(tag, text) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  return node;
}

function screen(title, message) {
  root.replaceChildren(element('h1', title), element('p', message));
}

function button(label, action) {
  const node = element('button', label);
  node.type = 'button';
  node.addEventListener('click', () => void guarded(action));
  root.append(node);
  return node;
}

function recoveryLink() {
  const link = element('a', '查看搬家備份');
  link.href = recoverURL;
  const paragraph = element('p');
  paragraph.append(link);
  root.append(paragraph);
}

function migrationCookie() {
  document.cookie = 'hodo_migrated_v1=1; Path=/; Max-Age=31536000; Secure; SameSite=Lax';
  if (!document.cookie.split(';').some(value => value.trim() === 'hodo_migrated_v1=1')) throw new Error('migration_cookie_blocked');
}

async function guarded(action) {
  if (busy) return;
  busy = true;
  try { await action(); }
  catch (error) {
    screen('進度還沒有搬好', error?.message === 'migration_cookie_blocked'
      ? '瀏覽器封鎖了這個網站的 Cookie，還無法完成轉址。進度與搬家備份已保留；請允許網站 Cookie 後再重試。'
      : '瀏覽器目前無法完整保存搬家資料。原網址的進度仍保留；請確認瀏覽器允許網站儲存資料，再重試。');
    button('重新嘗試', start);
    recoveryLink();
  } finally { busy = false; }
}

function returnPath() {
  const path = validateReturnTo(config.returnTo || '/');
  if (new URL(path, TARGET_ORIGIN).hash || !location.hash || config.mode === 'complete') return path;
  return validateReturnTo(`${path}${location.hash}`);
}

function formPost(payload) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = `${TARGET_ORIGIN}/_hodo/import`;
  form.enctype = 'multipart/form-data';
  const field = document.createElement('input');
  field.type = 'hidden'; field.name = 'payload'; field.value = JSON.stringify(payload);
  form.append(field);
  document.body.append(form);
  form.submit();
}

async function exportProgress() {
  if (location.origin !== SOURCE_ORIGIN) throw new Error('wrong_migration_origin');
  const returnTo = returnPath();
  const snapshot = captureSnapshot(localStorage, sessionStorage);
  const digest = await snapshotDigest(snapshot);
  // Explicit entry checks must revisit the importer to reissue a cleared cookie.
  // Its receipt prevents an unchanged source from replacing newer target data.
  if (!config.force && location.pathname !== '/_hodo/export' && sourceWasAcknowledged(localStorage, digest)) {
    location.replace(`${TARGET_ORIGIN}${returnTo}`);
    return;
  }
  const nonce = createNonce();
  rememberPending(sessionStorage, { nonce, digest, returnTo });
  formPost(validateMigrationPayload({ version: 1, nonce, returnTo, ...snapshot }));
}

async function importProgress(choice = null) {
  if (location.origin !== TARGET_ORIGIN) throw new Error('wrong_migration_origin');
  const payload = validateMigrationPayload(config.payload);
  const result = await importMigration(payload, localStorage, sessionStorage, { choice });
  if (!result.complete) {
    screen('找到兩份不同的進度', '兩份資料都已備份在這個瀏覽器。請選擇現在要繼續使用的進度；之後也能從搬家備份切換。');
    button('沿用原網址的進度', () => importProgress('source'));
    button('保留新網址的進度', () => importProgress('destination'));
    recoveryLink();
    return;
  }
  migrationCookie();
  location.replace(`${SOURCE_ORIGIN}/_hodo/complete?returnTo=${encodeURIComponent(payload.returnTo)}#${payload.nonce}`);
}

function completeProgress() {
  if (location.origin !== SOURCE_ORIGIN) throw new Error('wrong_migration_origin');
  const returnTo = acknowledgeSource(localStorage, sessionStorage, location.hash.slice(1), validateReturnTo(config.returnTo || '/'));
  location.replace(`${TARGET_ORIGIN}${returnTo}`);
}

function showBackups() {
  if (location.origin !== TARGET_ORIGIN) throw new Error('wrong_migration_origin');
  const records = readBackups(localStorage);
  screen('搬家備份', '切換進度前會先保存目前資料。備份只留在這個瀏覽器；清除網站資料也會刪除備份。');
  if (!records.length) root.append(element('p', '這個瀏覽器沒有需要切換的備份。第一次搬家時，原始進度仍保留在原網址的瀏覽器資料中。'));
  for (const record of [...records].reverse()) {
    const date = new Date(record.createdAt);
    root.append(element('h2', Number.isNaN(date.getTime()) ? '保留的進度' : date.toLocaleString('zh-TW', { hour12: false })));
    for (const side of ['source', 'destination']) {
      if (!record[side]) continue;
      button(side === 'source' ? '使用原網址／保留的進度' : '使用當時新網址的進度', async () => {
        await restoreBackup(localStorage, sessionStorage, record.id, side);
        migrationCookie();
        location.replace(`${TARGET_ORIGIN}${returnPath()}`);
      });
    }
  }
  const link = element('a', '回到遊戲');
  link.href = `${TARGET_ORIGIN}${returnPath()}`;
  root.append(link);
}

async function start() {
  if (config.mode === 'export') return exportProgress();
  if (config.mode === 'import') return importProgress();
  if (config.mode === 'complete') return completeProgress();
  if (config.mode === 'recover') return showBackups();
  if (config.mode === 'entry') {
    if (location.origin !== TARGET_ORIGIN) throw new Error('wrong_migration_origin');
    location.replace(`${SOURCE_ORIGIN}/_hodo/export?returnTo=${encodeURIComponent(returnPath())}`);
    return;
  }
  throw new Error('invalid_migration_mode');
}

void guarded(start);
