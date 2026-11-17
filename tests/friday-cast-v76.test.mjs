import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { advance, applyChoice, createRun, enableActivitySchedule, getEvent, replayRun, validRun } from '../dist/engine.js';
import { deriveCharacterStats } from '../dist/character-stats.js';
import { characterBookHTML } from '../dist/character-book.js';
import { displayPersona } from '../dist/persona.js';
import { renderSceneIllustration } from '../dist/illustrations-v38.js';
import { recruitmentSeedV60 } from '../dist/seed-profile-v60.js';
import { ROLE_MAP } from '../dist/roles.js';
import { validateCompletion } from '../worker/http.js';

const guests = { joe: '鷲', ethan: '伊森' };
const start = profile => enableActivitySchedule(createRun('system', recruitmentSeedV60('2'.padStart(22, '0'), 'normal', profile)));

test('career character book and event portraits reuse the standalone art', async () => {
  for (const [id, name] of Object.entries(guests)) {
    const person = displayPersona(id);
    assert.equal(person.name, name);
    assert.equal(person.image, `./data-science-war/art/${id}.webp`);
    const image = await readFile(new URL(`../dist/${person.image.slice(2)}`, import.meta.url));
    assert.equal(image.toString('ascii', 8, 12), 'WEBP');
    const html = characterBookHTML({ filter: id });
    assert.ok(html.includes(`id="character-card-${id}"`));
    assert.ok(html.includes(`<p class="character-bio">${person.about}</p>`));
    assert.ok(html.includes(`src="${person.image}"`));
    assert.ok(renderSceneIllustration({ title: name }, { people: [id] }).includes(`src="${person.image}"`));
  }
  assert.equal(displayPersona('wine').name, '紅酒');
  assert.equal(displayPersona('jack').name, '傑克');
});

test('two reading-club guests are reachable and replayable through ordinary r76 work choices', () => {
  let run = start(76);
  const encounters = [];
  for (let step = 0; step < 18 && !run.completed && encounters.length < 2; step++) {
    const event = getEvent(run);
    const index = event.kind === 'activity-invitation' ? 1 : event.choices.findIndex(choice => choice.available !== false);
    const pending = applyChoice(run, index);
    if (Object.hasOwn(guests, event.speaker)) {
      assert.equal(event.kind, 'daily');
      assert.equal(event.choices.length, 3);
      assert.equal(pending.history.at(-1).speaker, event.speaker);
      assert.ok(validRun(JSON.parse(JSON.stringify(pending))));
      encounters.push(event.speaker);
    }
    run = advance(pending);
  }
  assert.deepEqual(encounters, ['joe', 'ethan']);
  const proof = validateCompletion({ runId: '76767676-7676-4767-8767-767676767676', roleId: run.roleId, seed: run.seed, actions: run.actions }, ROLE_MAP);
  const replayed = replayRun(proof.roleId, proof.seed, proof.actions);
  assert.deepEqual(replayed, run);
  const stats = deriveCharacterStats(replayed).filter(row => Object.hasOwn(guests, row.id));
  assert.deepEqual(stats.map(row => [row.id, row.encounters, row.affinityGained]), [['joe', 1, 5], ['ethan', 1, 5]]);
});

test('published r75 histories and replay grammar reject the new reading-club scenes', () => {
  const prior = start(75);
  const forged = { ...prior, eventId: 'friday76-joe-search-terms' };
  assert.equal(validRun(forged), false);
  assert.throws(() => getEvent(forged), /Unknown event friday76-joe-search-terms/);
  assert.throws(() => replayRun(prior.roleId, prior.seed, [...prior.actions, { type: 'choice', eventId: forged.eventId, index: 0 }]), /Replay event mismatch/);
  assert.ok(deriveCharacterStats(prior).filter(row => Object.hasOwn(guests, row.id)).every(row => row.encounters === 0));
});
