import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { IslandPvpSession } from '../worker/island-pvp-session.js';
import { createIslandPvpCombat } from '../dist/island/pvp-combat.js';

const source = readFileSync(new URL('../worker/island-pvp-room.js', import.meta.url), 'utf8')
  .replace(/^import .*;\n/gm, '').replace('export class IslandPvpRoom', 'globalThis.IslandPvpRoom = class IslandPvpRoom');
const scope = vm.createContext({ DurableObject: class {} }); vm.runInContext(source, scope);
const Room = scope.IslandPvpRoom;

test('close/error callbacks release session ownership before completing the transport handshake with safe server reasons', async () => {
  for (const [method, code, reason] of [['webSocketClose', 1000, 'closed'], ['webSocketError', 1011, 'unavailable']]) {
    const order = [], socket = { close(...args) { order.push(['transport', ...args]); } };
    const room = { ready: Promise.resolve(), session: { async closed(value) { assert.equal(value, socket); order.push(['session']); } } };
    await Room.prototype[method].call(room, socket, 4000, 'untrusted-client-ticket-or-private-text');
    assert.deepEqual(order, [['session'], ['transport', code, reason]]);
    assert.ok(!JSON.stringify(order).includes('untrusted-client'));
  }
});

test('close acknowledgement is attempted even when metadata cleanup fails or the transport is already closed', async () => {
  for (const method of ['webSocketClose', 'webSocketError']) {
    let acknowledged = 0;
    const socket = { close() { acknowledged++; throw new Error('already closed'); } };
    const room = { ready: Promise.resolve(), session: { async closed() { throw new Error('synthetic store failure'); } } };
    await assert.rejects(Room.prototype[method].call(room, socket), /synthetic store failure/);
    assert.equal(acknowledged, 1);
  }
});

class Socket {
  constructor() { this.messages = []; this.closes = []; }
  send(text) { this.messages.push(JSON.parse(text)); }
  close(code, reason) { this.closes.push({ code, reason }); }
  serializeAttachment(value) { this.attachment = structuredClone(value); }
}
test('a late close acknowledgement for a replaced socket cannot disconnect the new socket occupying that seat', async () => {
  const session = new IslandPvpSession({ createCombat: createIslandPvpCombat, setInterval() { throw new Error('waiting room should not run a timer'); }, clearInterval() {} });
  const first = await session.create('ABCD2345', 'same-anonymous-owner', '甲'), oldSocket = new Socket();
  await session.connect(oldSocket); await session.message(oldSocket, JSON.stringify({ type: 'auth', ticket: first.ticket }));
  const next = await session.claim('same-anonymous-owner', '甲'), newSocket = new Socket();
  await session.connect(newSocket); await session.message(newSocket, JSON.stringify({ type: 'auth', ticket: next.ticket }));
  assert.equal(oldSocket.closes.at(-1).code, 4009);
  const room = { ready: Promise.resolve(), session };
  await Room.prototype.webSocketClose.call(room, oldSocket, 4009, 'not reflected');
  await Room.prototype.webSocketError.call(room, oldSocket, new Error('not reflected'));
  assert.equal(session.publicRoom().players[0].connected, true); assert.equal(session.owners[0], newSocket);
  assert.equal(newSocket.closes.length, 0); assert.equal(session.publicRoom().phase, 'waiting');
});
