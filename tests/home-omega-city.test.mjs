import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../dist/app.js', import.meta.url), 'utf8');
const start = source.indexOf('function homeHubHTML()');
const end = source.indexOf('\nfunction home(', start);
assert.ok(start >= 0 && end > start, 'the home game lobby renderer exists');
const html = vm.runInNewContext(`${source.slice(start, end)}; homeHubHTML();`);

test('home presents Alice’s game with an attributed fixed external link', () => {
  const card = html.match(/<a\b[^>]*class="home-game-card omega"[^>]*>[\s\S]*?<\/a>/)?.[0];
  assert.ok(card, 'the friend game has a visible card in the home lobby');
  const attributes = Object.fromEntries([...card.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
  assert.equal(attributes.href, 'https://omegacity-life.vercel.app/');
  assert.equal(attributes.target, '_blank');
  assert.ok(attributes.rel.split(/\s+/).includes('noopener'));
  assert.ok(attributes.rel.split(/\s+/).includes('noreferrer'));
  assert.equal(attributes.referrerpolicy, 'no-referrer');
  assert.match(attributes['aria-label'], /終末之都.*另開分頁/);
  assert.match(card, /手遊王愛麗絲製作/);
  assert.match(card, /<h3>終末之都<\/h3>/);
  assert.match(card, /前往終末之都/);
  assert.doesNotMatch(card, /data-action=|[?&](?:token|player|runId)=/);
});

test('the original four games remain available before the friend game', () => {
  for (const route of ['/island/', '/gta/', '/arpg/', '/cards/']) {
    assert.ok(html.indexOf(`href="${route}"`) >= 0);
    assert.ok(html.indexOf(`href="${route}"`) < html.indexOf('https://omegacity-life.vercel.app/'));
  }
});
