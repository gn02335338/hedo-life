import { DurableObject } from 'cloudflare:workers';
import { createIslandPvpCombat } from '../dist/island/pvp-combat.js';
import { IslandPvpSession } from './island-pvp-session.js';
import { assertPvpOrigin, isPvpSocketPath, PVP_CODE_PATTERN, validatePvpNickname } from './island-pvp-directory.js';
import { ApiError, json, readJson, errorResponse } from './http.js';

const validOwner = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export class IslandPvpRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ready = ctx.blockConcurrencyWhile(async () => {
      const persisted = await ctx.storage.get('room-v1');
      this.session = new IslandPvpSession({
        persisted, sockets: ctx.getWebSockets(), createCombat: createIslandPvpCombat,
        persist: value => ctx.storage.put('room-v1', value), erase: () => ctx.storage.deleteAll(), schedule: timestamp => ctx.storage.setAlarm(timestamp),
      });
      await this.session.restore();
    });
  }
  async fetch(request) {
    try {
      await this.ready;
      const url = new URL(request.url);
      if (url.origin === 'https://island-pvp.internal' && request.method === 'POST' && ['/create', '/join'].includes(url.pathname)) {
        const body = await readJson(request, { maxBytes: 1024 });
        if (!validOwner(body.playerId) || Object.keys(body).some(key => !['playerId', 'nickname', ...(url.pathname === '/create' ? ['roomCode'] : [])].includes(key))) {
          throw new ApiError(400, 'invalid_pvp_owner', '房間身分資料不正確。');
        }
        const nickname = body.nickname === null ? null : validatePvpNickname({ ...(body.nickname === undefined ? {} : { nickname: body.nickname }) });
        if (url.pathname === '/create') {
          if (!PVP_CODE_PATTERN.test(body.roomCode)) throw new ApiError(400, 'invalid_pvp_room', '房間編號不正確。');
          return json(await this.session.create(body.roomCode, body.playerId, nickname), 201);
        }
        return json(await this.session.claim(body.playerId, nickname));
      }
      assertPvpOrigin(request);
      if (url.search || !isPvpSocketPath(url.pathname) || request.method !== 'GET' || request.headers.get('Upgrade')?.toLowerCase() !== 'websocket' || request.headers.has('Sec-WebSocket-Protocol')) {
        throw new ApiError(400, 'invalid_pvp_socket', '請從房間內建立即時連線。');
      }
      if (!this.session.meta) throw new ApiError(404, 'pvp_room_not_found', '找不到這個房間，請確認邀請碼。');
      if (!url.pathname.includes(`/${this.session.meta.roomCode}/`)) throw new ApiError(404, 'pvp_room_not_found', '找不到這個房間。');
      const pair = new WebSocketPair(), [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      try { await this.session.connect(server); }
      catch (error) { try { server.close(1008, 'unavailable'); } catch {} throw error; }
      return new Response(null, { status: 101, webSocket: client });
    } catch (error) { return errorResponse(error); }
  }
  async webSocketMessage(socket, message) { await this.ready; await this.session.message(socket, message); }
  async webSocketClose(socket) { await this.ready; await this.session.closed(socket); }
  async webSocketError(socket) { await this.ready; await this.session.closed(socket); }
  async alarm() { await this.ready; await this.session.alarm(); }
}
