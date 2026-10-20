import test from 'node:test';
import assert from 'node:assert/strict';
import { replayRun, validRun, getEvent, applyChoice, advance } from '../dist/engine.js';

// A naturally played e25 life: repeated unpaid leave reduces the monthly
// salary below the historical 20K proposal floor. No state/RNG injection.
const route = {
  "roleId": "system",
  "seed": "e25-mood-0",
  "actions": [
    {
      "type": "choice",
      "eventId": "onboarding",
      "index": 0
    },
    {
      "type": "break"
    },
    {
      "type": "choice",
      "eventId": "self-care",
      "index": 7
    },
    {
      "type": "choice",
      "eventId": "job-system-rollback",
      "index": 1
    },
    {
      "type": "choice",
      "eventId": "rick-fault-friendship",
      "index": 1
    },
    {
      "type": "choice",
      "eventId": "kind-workday",
      "index": 1
    },
    {
      "type": "choice",
      "eventId": "quiz-dragon-seasick",
      "index": 1
    },
    {
      "type": "choice",
      "eventId": "career-review",
      "index": 1
    },
    {
      "type": "choice",
      "eventId": "job-system-schema",
      "index": 1
    },
    {
      "type": "choice",
      "eventId": "job-system-phone-monitor",
      "index": 1
    },
    {
      "type": "choice",
      "eventId": "education-review",
      "index": 0
    },
    {
      "type": "choice",
      "eventId": "dp-retention-bonus",
      "index": 0
    },
    {
      "type": "choice",
      "eventId": "crisis-mood",
      "index": 2
    },
    {
      "type": "choice",
      "eventId": "crisis-mood",
      "index": 2
    },
    {
      "type": "choice",
      "eventId": "system-backup",
      "index": 1
    },
    {
      "type": "choice",
      "eventId": "mood-collapse",
      "index": 1
    },
    {
      "type": "choice",
      "eventId": "campus-double-standard",
      "index": 1
    },
    {
      "type": "choice",
      "eventId": "mood-collapse",
      "index": 1
    },
    {
      "type": "choice",
      "eventId": "raise-title-only",
      "index": 2
    },
    {
      "type": "choice",
      "eventId": "mood-collapse",
      "index": 1
    },
    {
      "type": "choice",
      "eventId": "system-weekend",
      "index": 2
    },
    {
      "type": "choice",
      "eventId": "banquet-welcome",
      "index": 0
    },
    {
      "type": "choice",
      "eventId": "banquet-draw",
      "index": 1
    },
    {
      "type": "choice",
      "eventId": "banquet-afterparty",
      "index": 0
    },
    {
      "type": "choice",
      "eventId": "system-printer",
      "index": 0
    },
    {
      "type": "choice",
      "eventId": "mood-collapse",
      "index": 1
    },
    {
      "type": "choice",
      "eventId": "low-pay-tip",
      "index": 0
    },
    {
      "type": "choice",
      "eventId": "jonathan-today-release",
      "index": 0
    },
    {
      "type": "choice",
      "eventId": "mood-collapse",
      "index": 1
    },
    {
      "type": "choice",
      "eventId": "job-system-credit-expiry",
      "index": 2
    },
    {
      "type": "choice",
      "eventId": "mood-collapse",
      "index": 1
    },
    {
      "type": "choice",
      "eventId": "efficiency-network-block",
      "index": 2
    },
    {
      "type": "choice",
      "eventId": "mood-collapse",
      "index": 1
    },
    {
      "type": "choice",
      "eventId": "rmn-summit-adapter",
      "index": 2
    },
    {
      "type": "choice",
      "eventId": "crisis-mood",
      "index": 2
    },
    {
      "type": "choice",
      "eventId": "rick-author-name",
      "index": 1
    }
  ]
};

test('e25 late salary proposals remain reductions after repeated unpaid leave takes pay below 20K', () => {
 for (let length = 0; length <= route.actions.length; length++) {
  const run = replayRun(route.roleId, route.seed, route.actions.slice(0, length));
  assert.equal(validRun(run), true, `natural prefix ${length}/${run.eventId}`);
 }
 const run = replayRun(route.roleId, route.seed, route.actions);
 assert.equal(run.flags.mood_crash_count, 7);
 assert.equal(run.pay, 13);
 assert.equal(run.eventId, 'salary-cut');
 assert.deepEqual(run.salaryCut, { percent: 24, from: 13, to: 10, status: 'pending' });
 assert.match(getEvent(run).body, /13K.*10K/);
 const pending = applyChoice(run, 0);
 assert.equal(pending.pay, 10);
 assert.equal(pending.salaryCut.status, 'accepted');
 assert.equal(validRun(pending), true);
 const after = advance(pending);
 assert.equal(validRun(after), true);
 assert.equal(after.eventId, 'mood-collapse');
 assert.deepEqual(replayRun(after.roleId, after.seed, after.actions), after);
});

test('e25 high-rank salary acceptance keeps a valid positive base salary at the 1K boundary', () => {
 const source = replayRun(route.roleId, route.seed, route.actions);
 // Deliberate unit boundary, separate from the natural replay proof above.
 const run = { ...source, pay: 2, basePay: 1, rank: 6,
  flags: { ...source.flags, career_peak_rank: 6 },
  salaryCut: { percent: 35, from: 2, to: 1, status: 'pending' } };
 assert.equal(validRun(run), true);
 const pending = applyChoice(run, 0);
 assert.equal(pending.pay, 1);
 assert.equal(pending.basePay, 1);
 assert.equal(validRun(pending), true);
 assert.equal(validRun(advance(pending)), true);
});
