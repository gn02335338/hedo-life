import test from 'node:test';
import assert from 'node:assert/strict';
import {
  QUESTIONS, CHAPTERS, SCALE, TYPES, STORAGE_KEY, VERSION,
  scoreQuiz, freshProgress, sanitizeProgress,
} from '../dist/attachment/model.js';

const answersFor = (anxiety, avoidance) => QUESTIONS.map((question) => {
  const oriented = question.axis === 'anxiety' ? anxiety : avoidance;
  return question.reverse ? 6 - oriented : oriented;
});

test('question bank balances both dimensions, reverse items and chapters', () => {
  assert.equal(QUESTIONS.length, 24);
  assert.equal(new Set(QUESTIONS.map(({ id }) => id)).size, 24);
  assert.deepEqual(SCALE.map(({ value }) => value), [1, 2, 3, 4, 5]);
  for (const axis of ['anxiety', 'avoidance']) {
    const items = QUESTIONS.filter((question) => question.axis === axis);
    assert.equal(items.length, 12);
    assert.equal(items.filter(({ reverse }) => reverse).length, 6);
  }
  for (const chapter of CHAPTERS) {
    const items = QUESTIONS.filter((question) => question.chapter === chapter.id);
    assert.equal(items.length, 6);
    assert.equal(items.filter(({ axis }) => axis === 'anxiety').length, 3);
    assert.ok(items.every(({ context, text }) => context && text));
  }
  for (const [id, type] of Object.entries(TYPES)) {
    assert.equal(type.id, id);
    assert.equal(type.practice.length, 3);
    assert.ok(type.summary && type.script.you && type.sentence);
  }
});

test('both score dimensions independently place all four extreme patterns', () => {
  for (const [anxietyValue, avoidanceValue, type, anxiety, avoidance] of [
    [1, 1, 'secure', 0, 0],
    [5, 1, 'anxious', 100, 0],
    [1, 5, 'avoidant', 0, 100],
    [5, 5, 'fearful', 100, 100],
  ]) {
    const result = scoreQuiz(answersFor(anxietyValue, avoidanceValue));
    assert.equal(result.type, type);
    assert.equal(result.anxiety, anxiety);
    assert.equal(result.avoidance, avoidance);
    assert.equal(result.axes.anxiety.percentage, anxiety);
    assert.equal(result.axes.avoidance.percentage, avoidance);
    assert.equal(result.closeToBoundary, false);
  }
});

test('reverse scoring treats opposite answers equivalently and does not reward acquiescence', () => {
  const allAgree = scoreQuiz(Array(24).fill(5));
  const allDisagree = scoreQuiz(Array(24).fill(1));
  assert.equal(allAgree.anxiety, 50);
  assert.equal(allAgree.avoidance, 50);
  assert.deepEqual(allAgree, allDisagree);
  const nearLow = answersFor(1, 1);
  const reverseIndex = QUESTIONS.findIndex(({ axis, reverse }) => axis === 'anxiety' && reverse);
  nearLow[reverseIndex] = 1;
  const result = scoreQuiz(nearLow);
  assert.equal(result.anxiety, 8, 'one reverse anxiety item contributes 1/12 of that dimension');
  assert.equal(result.avoidance, 0, 'changing one axis leaves the other alone');
});

test('middle answers and near-cutoff answers are clearly marked as close to a boundary', () => {
  const middle = scoreQuiz(Array(24).fill(3));
  assert.equal(middle.type, 'fearful', 'exactly 50 uses the authored high-side rule');
  assert.equal(middle.anxiety, 50);
  assert.equal(middle.avoidance, 50);
  assert.equal(middle.closeToBoundary, true);
  const values = answersFor(3, 1);
  const one = QUESTIONS.findIndex(({ axis, reverse }) => axis === 'anxiety' && !reverse);
  values[one] = 2;
  const justBelow = scoreQuiz(values);
  assert.equal(justBelow.type, 'secure');
  assert.equal(justBelow.anxiety, 48);
  assert.equal(justBelow.closeToBoundary, true);
});

test('results require exactly 24 present integer answers without coercion', () => {
  for (const invalid of [null, {}, [], Array(23).fill(3), Array(25).fill(3), Array(24)]) {
    assert.equal(scoreQuiz(invalid), null);
  }
  for (const value of [null, undefined, 0, 6, 2.5, NaN, Infinity, '3', true]) {
    const answers = Array(24).fill(3);
    answers[4] = value;
    assert.equal(scoreQuiz(answers), null, String(value));
  }
});

test('fresh progress has isolated answer arrays and only the local game schema', () => {
  const first = freshProgress();
  const second = freshProgress();
  first.answers[0] = 4;
  assert.equal(second.answers[0], null);
  assert.deepEqual(Object.keys(second), ['version', 'answers', 'cursor', 'phase']);
  assert.equal(STORAGE_KEY, 'hedo-attachment-v1');
  assert.equal(VERSION, 1);
});

test('storage sanitization removes unsupported data, invalid answers and impossible result state', () => {
  const raw = { version: 1, answers: [4, '5', 0, 6, 2.5, 2], cursor: 999, phase: 'result', email: 'discard', identity: 'discard', arbitrary: { ignored: true } };
  const clean = sanitizeProgress(raw);
  assert.equal(clean.answers.length, 24);
  assert.deepEqual(clean.answers.slice(0, 6), [4, null, null, null, null, 2]);
  assert.equal(clean.cursor, 1, 'cannot skip the first unanswered question');
  assert.equal(clean.phase, 'quiz');
  assert.deepEqual(Object.keys(clean), ['version', 'answers', 'cursor', 'phase']);
  assert.equal(raw.phase, 'result', 'input is not mutated');
  assert.deepEqual(sanitizeProgress({ ...raw, version: 2 }), freshProgress());
  for (const invalid of [undefined, null, [], 'text', 5]) assert.deepEqual(sanitizeProgress(invalid), freshProgress());
});

test('storage round-trip retains complete results, earlier review positions and bounded cursor', () => {
  const progress = { version: 1, answers: answersFor(5, 1), cursor: 8, phase: 'result' };
  const clean = sanitizeProgress(JSON.parse(JSON.stringify(progress)));
  assert.deepEqual(clean, progress);
  assert.equal(scoreQuiz(clean.answers).type, 'anxious');
  assert.equal(sanitizeProgress({ ...progress, cursor: 100 }).cursor, 23);
  assert.equal(sanitizeProgress({ ...progress, cursor: -9 }).cursor, 0);
  assert.equal(sanitizeProgress({ ...progress, cursor: 1.5 }).cursor, 0);
  assert.equal(sanitizeProgress({ ...progress, phase: 'surprise' }).phase, 'intro');
  assert.deepEqual(sanitizeProgress(clean), clean, 'projection is idempotent');
});
