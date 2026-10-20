import test from 'node:test';
import assert from 'node:assert/strict';
import { feedbackPayload, feedbackPreview, safeIssueUrl } from '../dist/feedback.js';

const id = '5b3ac211-c354-4922-936b-e612e299ac26';
const draft = {
  title: '  一張會唱歌的離職單  ',
  content: '  想讓玩家把離職單折成紙飛機，飛過會議室時播放原創主題曲。  ',
  nature: '純原創虛構橋段',
  choices: '接受；把飛機交給影印機當機長。',
  source: 'https://example.com/public-story',
  steps: '先進入遊戲，再開啟選單。',
  expected: '按鈕應該能送出。',
  device: 'iPhone / Safari',
};

test('feedback receipt links stay on the project issue path', () => {
  const valid = 'https://github.com/gn02335338/hedo-life/issues/42';
  assert.equal(safeIssueUrl(valid), valid);
  for (const url of [
    'javascript:alert(1)', 'http://github.com/gn02335338/hedo-life/issues/42',
    'https://github.com.attacker.example/gn02335338/hedo-life/issues/42',
    'https://github.com/another/repo/issues/42',
    'https://github.com/gn02335338/hedo-life/pull/42',
    `${valid}?redirect=https://attacker.example`, `${valid}#untrusted`,
    'https://name:password@github.com/gn02335338/hedo-life/issues/42',
    'https://github.com:444/gn02335338/hedo-life/issues/42',
    'https://github.com/gn02335338/hedo-life/issues/%34%32', null, {},
  ]) assert.equal(safeIssueUrl(url), null, String(url));
});

test('feedback payloads keep category fields separate and omit player identity', () => {
  const memory = feedbackPayload('memory', { ...draft, playerId: 'not-public', token: 'not-public' }, id);
  assert.deepEqual(Object.keys(memory).sort(), ['submissionId', 'category', 'title', 'content', 'nature', 'choices', 'source', 'acknowledged', 'website'].sort());
  assert.equal(memory.submissionId, id);
  assert.equal(memory.title, draft.title.trim());
  assert.equal(memory.content, draft.content.trim());
  assert.equal(memory.acknowledged, true);
  assert.equal(memory.website, '');
  const suggestion = feedbackPayload('suggestion', draft, id);
  assert.deepEqual(Object.keys(suggestion).sort(), ['submissionId', 'category', 'title', 'content', 'acknowledged', 'website'].sort());
  const bug = feedbackPayload('bug', draft, id);
  assert.equal(bug.steps, draft.steps);
  assert.equal(bug.expected, draft.expected);
  assert.equal(bug.device, draft.device);
  assert.ok(!Object.hasOwn(bug, 'nature'));
});

test('feedback form rejects empty words, excessive fields, and prototype categories', () => {
  for (const category of ['__proto__', 'constructor', 'toString', 'unknown']) {
    assert.throws(() => feedbackPayload(category, draft, id));
  }
  for (const changes of [
    { title: ' \n 字 \t ' }, { title: '兩字' }, { title: '字'.repeat(81) },
    { content: `\n${'字'.repeat(19)} \n` }, { content: '字'.repeat(6001) },
    { choices: '字'.repeat(2001) }, { source: '字'.repeat(1001) },
    { nature: '別人的保證' },
  ]) assert.throws(() => feedbackPayload('memory', { ...draft, ...changes }, id));
  for (const changes of [{ steps: '字'.repeat(2001) }, { expected: '字'.repeat(2001) }, { device: '字'.repeat(201) }]) {
    assert.throws(() => feedbackPayload('bug', { ...draft, ...changes }, id));
  }
  for (const changes of [{ steps: '' }, { expected: ' \n ' }]) assert.throws(() => feedbackPayload('bug', { ...draft, ...changes }, id));
  assert.doesNotThrow(() => feedbackPayload('memory', { ...draft, title: '字'.repeat(80), content: '字'.repeat(6000), choices: '字'.repeat(2000), source: '字'.repeat(1000) }, id));
});

test('feedback public preview includes only selected fields as literal text', () => {
  const malicious = { ...draft, title: '<img src=x onerror=alert(1)>', content: '@someone **story** <script>text</script> ![pic](https://example.com/image)' };
  const preview = feedbackPreview('suggestion', malicious);
  assert.match(preview, /^\[遊戲建議\]/);
  assert.ok(preview.includes(malicious.title));
  assert.ok(preview.includes(malicious.content));
  assert.ok(!preview.includes(draft.source));
  assert.ok(!preview.includes(draft.steps));
  assert.ok(!preview.includes('not-public'));
  const memory = feedbackPreview('memory', draft);
  assert.ok(memory.includes(draft.nature));
  assert.ok(memory.includes(draft.choices));
  assert.ok(memory.includes(draft.source));
});
