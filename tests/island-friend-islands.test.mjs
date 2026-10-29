import test from 'node:test';
import assert from 'node:assert/strict';
import { ONEIRA_PORT, OMEGA_CITY_PORT, getOneiraArrival } from '../dist/island/friend-islands.js';

test('Oneira has one fixed public harbor address with no player identity or arbitrary destination', () => {
  assert.ok(Object.isFrozen(ONEIRA_PORT));
  assert.equal(ONEIRA_PORT.id, 'oneira');
  assert.equal(ONEIRA_PORT.placeId, 'oneira-hub');
  const harbor = new URL(ONEIRA_PORT.harborUrl);
  assert.equal(harbor.origin, 'https://oneirahub.com');
  assert.equal(harbor.pathname, '/harbor');
  assert.deepEqual([...harbor.searchParams], [['from', 'moving-island']]);
  assert.equal(harbor.username + harbor.password + harbor.hash, '');
});

test('only the exact Oneira arrival marker requests the fixed inbound ferry', () => {
  assert.deepEqual(getOneiraArrival('?from=oneira', '#oneira'), { from: 'oneira', to: 'company' });
  for (const [search, hash] of [
    ['', '#oneira'], ['?from=oneira', ''], ['?from=oneira', '#oneira-hub'],
    ['?from=other', '#oneira'], ['?from=Oneira', '#oneira'],
    ['?from=oneira&from=oneira', '#oneira'], ['?from=oneira&from=other', '#oneira'],
    ['?from=other&from=oneira', '#oneira'], ['?from=oneira&duel=ABCD2345', '#oneira'],
    ['?from=oneira&duel=', '#oneira'], ['?from=oneira', '#__proto__'],
  ]) assert.equal(getOneiraArrival(search, hash), null, `${search}${hash}`);
  const arrival = getOneiraArrival('?from=oneira&redirect=https%3A%2F%2Fevil.example%2F&token=not-an-identity', '#oneira');
  assert.deepEqual(arrival, { from: 'oneira', to: 'company' }, 'unrelated query fields cannot choose a destination or become ferry data');
});

test('Alice has a fixed public game destination without account or source parameters', () => {
  assert.ok(Object.isFrozen(OMEGA_CITY_PORT));
  assert.equal(OMEGA_CITY_PORT.id, 'omega-city');
  assert.equal(OMEGA_CITY_PORT.placeId, 'omega-terminal');
  assert.equal(OMEGA_CITY_PORT.author, '手遊王愛麗絲');
  assert.equal(OMEGA_CITY_PORT.gameUrl, 'https://omegacity-life.vercel.app/');
  assert.equal(getOneiraArrival('?from=omega-city', '#omega-city'), null);
});
