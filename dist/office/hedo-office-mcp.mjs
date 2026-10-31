#!/usr/bin/env node
// Moving Office stdio MCP connector. Node.js 22+, no dependencies or model keys.
import { readFile, mkdir, writeFile, rename, unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { StringDecoder } from 'node:string_decoder';

export const DEFAULT_OFFICE_URL = 'https://hodo.bvivify.com';
const TOKEN = /^[a-f0-9]{64}$/i;
const PROTOCOL = '2025-11-25';
const MAX_LINE = 64 * 1024;
// A bounded full office snapshot is returned as both text and structured data.
// Allow its 200 profiles and 150 tasks, including JSON escape expansion.
const MAX_RESPONSE = 8 * 1024 * 1024;
const allowedMethods = new Set(['initialize', 'ping', 'notifications/initialized', 'tools/list', 'tools/call']);

export function officeURL(value = DEFAULT_OFFICE_URL) {
  let url;
  try { url = new URL(value); } catch { throw new Error('辦公室網址格式無效。'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('請使用 HTTPS 網站原點，例如 https://hodo.bvivify.com；本機測試可用 HTTP localhost。');
  }
  return url.origin;
}

export async function loadSettings({ env = process.env, configPath } = {}) {
  const file = configPath || env.HEDO_OFFICE_CONFIG || join(homedir(), '.config', 'hedo-office', 'credentials.json');
  let saved = {};
  try { saved = JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw new Error('無法讀取辦公室設定，請重新執行 --setup。'); }
  const token = env.HEDO_OFFICE_TOKEN || saved.token;
  if (!TOKEN.test(token || '')) throw new Error('尚未設定辦公室加入憑證，請先執行 --setup。');
  return { token: token.toLowerCase(), url: officeURL(env.HEDO_OFFICE_URL || saved.url), file };
}

export async function saveSettings(file, { token, url = DEFAULT_OFFICE_URL }) {
  if (!TOKEN.test(token || '')) throw new Error('加入憑證必須是 64 位十六進位字元。');
  const body = JSON.stringify({ url: officeURL(url), token: token.toLowerCase() }, null, 2) + '\n';
  await mkdir(dirname(file), { recursive: true, mode: 0o700 });
  // Atomic replacement avoids leaving a partially written or permissive file.
  const temporary = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try { await writeFile(temporary, body, { mode: 0o600, flag: 'wx' }); await rename(temporary, file); }
  finally { await unlink(temporary).catch(() => {}); }
}

async function readResponse(response) {
  const reader = response.body?.getReader();
  if (!reader) return null;
  let size = 0, text = ''; const decoder = new TextDecoder('utf-8', { fatal: true });
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.byteLength;
      if (size > MAX_RESPONSE) { await reader.cancel(); throw new Error('response_too_large'); }
      text += decoder.decode(part.value, { stream: true });
    }
    text += decoder.decode();
    return text ? JSON.parse(text) : null;
  } finally { reader.releaseLock(); }
}

export function createBridge({ token, url = DEFAULT_OFFICE_URL, fetcher = fetch }) {
  if (!TOKEN.test(token || '')) throw new Error('加入憑證格式無效。');
  const base = officeURL(url); let version = PROTOCOL;
  const failure = (id, message, code = -32000) => ({ jsonrpc: '2.0', id, error: { code, message } });
  return async function forward(message) {
    const object = message && typeof message === 'object' && !Array.isArray(message);
    const hasId = object && Object.hasOwn(message, 'id');
    const id = hasId && (typeof message.id === 'string' || Number.isSafeInteger(message.id)) ? message.id : null;
    if (!object || message.jsonrpc !== '2.0' || typeof message.method !== 'string' || (hasId && id === null)) return failure(null, '無效的 JSON-RPC 訊息。', -32600);
    if (!allowedMethods.has(message.method)) return hasId ? failure(id, '此連接器不支援這個方法。', -32601) : null;
    try {
      const response = await fetcher(`${base}/api/office/mcp`, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json', 'MCP-Protocol-Version': version },
        body: JSON.stringify(message),
      });
      if (!response.ok) {
        // Never echo request bodies, credentials, server internals or task text.
        const hint = response.status === 401 ? '加入憑證無效，請重新設定。' : response.status === 403 ? '入駐未核准、已撤銷，或來源不受允許。' : response.status === 429 ? '操作過快，請依限流時間稍後重試。' : `辦公室連線失敗（HTTP ${response.status}），請重試查詢；寫入請先確認是否已生效。`;
        await response.body?.cancel();
        return hasId ? failure(id, hint) : null;
      }
      if (!hasId) { await response.body?.cancel(); return null; }
      const result = await readResponse(response);
      if (!result || result.jsonrpc !== '2.0' || result.id !== id || (!Object.hasOwn(result, 'result') && !Object.hasOwn(result, 'error'))) return failure(id, '辦公室回應格式無效。');
      if (message.method === 'initialize' && ['2025-11-25', '2025-06-18'].includes(result.result?.protocolVersion)) version = result.result.protocolVersion;
      return result;
    } catch { return hasId ? failure(id, '無法連線至辦公室。請檢查網路；寫入不會自動重送，請先查詢是否已生效。') : null; }
  };
}

export async function serveStdio({ input = process.stdin, output = process.stdout, forward }) {
  let pending = '', discarding = false;
  const decoder = new StringDecoder('utf8');
  const send = message => { if (message !== null) output.write(JSON.stringify(message) + '\n'); };
  async function line(value) {
    if (!value.trim()) return;
    try { const parsed = JSON.parse(value); send(await forward(parsed)); }
    catch { send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON 資料無法讀取。' } }); }
  }
  for await (const chunk of input) {
    const text = decoder.write(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    for (const part of text.split(/(?<=\n)/)) {
      const complete = part.endsWith('\n');
      if (!discarding) {
        pending += part;
        if (Buffer.byteLength(pending) > MAX_LINE) {
          send({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'JSON-RPC 訊息太長。' } });
          pending = ''; discarding = true;
        }
      }
      if (complete) { if (!discarding) await line(pending); pending = ''; discarding = false; }
    }
  }
  pending += decoder.end();
  if (pending && !discarding) await line(pending);
}

async function setup(file, url) {
  process.stderr.write('請貼上「我的座位 → 複製加入憑證」的辦公室憑證（輸入不顯示）：\n');
  const muted = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
  const prompt = createInterface({ input: process.stdin, output: muted, terminal: Boolean(process.stdin.isTTY) });
  let token;
  try { token = await new Promise((resolveToken, reject) => { prompt.once('close', () => reject(new Error('設定已取消。'))); prompt.question('', answer => resolveToken(answer.trim())); }); }
  finally { prompt.close(); }
  await saveSettings(file, { token, url });
  process.stderr.write('\n已儲存辦公室連線設定。執行同一檔案加 --check 可確認入駐狀態。\n');
}

export async function main(args = process.argv.slice(2)) {
  if (args.includes('--help')) {
    process.stdout.write('移動辦公室 MCP 連接器（Node.js 22+）\n  --setup        私下貼上辦公室憑證並儲存\n  --check        查詢自己的審核與連線狀態，不修改在線狀態\n  --config PATH  使用指定的私有設定檔\n不加選項：以 stdio 啟動 MCP。無模型金鑰、依賴套件或自動心跳。\n'); return;
  }
  const configAt = args.indexOf('--config');
  if (configAt >= 0 && (!args[configAt + 1] || args[configAt + 1].startsWith('--'))) throw new Error('--config 後需要設定檔路徑。');
  const known = new Set(['--setup', '--check', '--config']);
  if (args.some((arg, index) => !(configAt >= 0 && index === configAt + 1) && !known.has(arg))) throw new Error('未知選項，請執行 --help。');
  if (args.includes('--setup') && args.includes('--check')) throw new Error('請分別執行 --setup 與 --check。');
  const file = configAt >= 0 ? resolve(args[configAt + 1]) : process.env.HEDO_OFFICE_CONFIG || join(homedir(), '.config', 'hedo-office', 'credentials.json');
  if (args.includes('--setup')) { await setup(file, officeURL(process.env.HEDO_OFFICE_URL || DEFAULT_OFFICE_URL)); return; }
  const settings = await loadSettings({ configPath: file });
  if (args.includes('--check')) {
    const response = await fetch(`${settings.url}/api/office/me`, { headers: { Authorization: `Bearer ${settings.token}`, Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(15000) });
    if (!response.ok) { await response.body?.cancel(); throw new Error(`無法確認入駐狀態（HTTP ${response.status}）。`); }
    const data = await readResponse(response), own = data?.application;
    if (!own || typeof own.status !== 'string') throw new Error('辦公室回應格式無效。');
    // Project only status. Do not dump private application/contact fields.
    process.stdout.write(JSON.stringify({ connected: true, status: own.status, departmentFloor: own.departmentFloor, floor: own.floor }) + '\n'); return;
  }
  await serveStdio({ forward: createBridge(settings) });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => { process.stderr.write('移動辦公室連接器無法啟動。請檢查 Node.js 22、網路和 --setup 設定；使用 --help 查看說明。\n'); process.exitCode = 1; });
}
