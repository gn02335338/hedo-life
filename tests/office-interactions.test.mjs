import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { OFFICE_CAST } from '../dist/office/model.js';
import { OFFICE_INTERACTION_TOPICS, getOfficeInteraction } from '../dist/office/interactions.js';

test('every public office character has three distinct authored exchanges', () => {
  assert.deepEqual(OFFICE_INTERACTION_TOPICS.map(topic => topic.id), ['work', 'chat', 'break']);
  const prompts = new Set(), responses = new Set();
  for (const person of OFFICE_CAST) {
    for (const topic of OFFICE_INTERACTION_TOPICS) {
      const result = getOfficeInteraction(person.id, topic.id);
      assert.equal(result.characterId, person.id);
      assert.equal(result.name, person.name);
      assert.equal(result.topic, topic.id);
      assert.equal(result.label, topic.label);
      assert.equal(result.source, 'scripted');
      assert.ok(result.prompt.length > 8);
      assert.ok(result.response.length > 30);
      prompts.add(result.prompt); responses.add(result.response);
    }
  }
  assert.equal(prompts.size, OFFICE_CAST.length * 3);
  assert.equal(responses.size, OFFICE_CAST.length * 3);
});

test('office dialogue accepts only known public characters and topics', () => {
  for (const id of ['not-public', '__proto__', 'constructor', 'toString', null, undefined]) {
    assert.equal(getOfficeInteraction(id, 'work'), null);
  }
  for (const topic of ['unknown', '__proto__', 'constructor', null, undefined]) {
    assert.equal(getOfficeInteraction('jack', topic), null);
  }
});

test('dialogue is a fresh read-only projection, independent of live agents or saved games', () => {
  const first = getOfficeInteraction('jack', 'work');
  const original = structuredClone(first);
  first.response = 'changed';
  assert.deepEqual(getOfficeInteraction('jack', 'work'), original);
  const source = readFileSync(new URL('../dist/office/interactions.js', import.meta.url), 'utf8');
  const imports = [...source.matchAll(/from ['"]([^'"]+)/g)].map(match => match[1]);
  assert.deepEqual(imports, ['./model.js']);
  assert.doesNotMatch(source, /\b(?:fetch|localStorage|sessionStorage)\b/);
});
