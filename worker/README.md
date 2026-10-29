# Anonymous archive API

Cloudflare Workers serves `dist/` as Static Assets and runs the Worker before assets so that navigation can pass through the domain-migration gate; `/api/*` still uses the existing API dispatch. One `HedoArchive` Durable Object (`global-v3`) owns the SQLite archive. The public game does not require D1, KV, external databases, or API secrets. The optional private administrator archive below requires its own Worker secret.

## Endpoints

Fresh `e39-r70-[nsd]-` lives inherit all r69 rules, including complete version-2 patronage replies. Kind’s paid piano outing still costs 36 cash-index points and grants 16 slack, but its base recovery is now 55 mood and 45 energy; existing self-care processing and 0–100 limits determine the final recorded changes. It retains the original break return, affordability, once-per-workday and no-extra-PIP/workday rules. r69 and earlier cohorts retain the published 10-energy base recovery and their exact replay results. The white-team wallet scene separately identifies 阿福’s “friend” as finance lead Janet through a browser-only presentation helper for current and archived text. It never changes event choices, committed history, RNG, action schemas, anonymous identity or archive tables, and preserves property descriptors without reading hidden outcome accessors.

Fresh `e39-r69-[nsd]-` lives inherit r68 benefits and familiarity rules. In an eligible work scene, a version-2 `patronage-reply` is a complete alternative reply: it writes one source-scene history row with `patronageOutcome.version:2`, then normal continuation resolves that scene once. Daily work retains its ordinary workday, PIP and income accounting; a safe private invitation closes through its existing return path without an extra workday or automatic meal charge. The three appointment-specific review/conversation scenes are also eligible. Salary/PIP/legal decisions, activities, paid arrangements and the company finale do not expose this alternative; their explicit decisions remain required. The browser shows the spoken line and committed result once, then offers “繼續”, with no return to the same unanswered choices. Earlier cohorts keep their exact action versions, continuation and replay behavior. Anonymous identity and archive tables remain unchanged.

Fresh `e39-r68-[nsd]-` lives inherit the r67 appointment benefits. A canonical patronage reply with negative affinity no longer contributes friendly familiarity to any of the 28 public meal guests; its encounter and affinity counters remain intact. Positive cooperation still contributes familiarity. This changes no salary, allowance, workday, PIP, action schema or archive field. Earlier meal draws retain their original rules. The browser also explains the difference when continuing an appointment predating r67 instead of silently suggesting that the older life has current benefits.

Fresh `e39-r67-[nsd]-` lives inherit r66 features and add replay-derived special-appointment benefits. Acceptance through direct recruitment or an earned application uses `appointmentPayV67` (at least 180K, up to 500K), grants a one-time 24-point cash-index subsidy, and credits 6 cash-index points per two distinct completed work scenes after appointment. Cash is still clamped to 0–100. Introductions, conversations, rest, invitations, missed work and company-route navigation do not earn this allowance. The existing history breakdown exposes actual credited amounts; no client-supplied balance or benefit field is trusted. Three identity-specific scenes replace personal education and ordinary pay-cut reviews after appointment. Workplace patronage replies can save energy and improve mood while changing personal affinity; private responses keep their own rules. Existing action schemas, archive tables and anonymous identity remain unchanged, and all earlier seed cohorts retain their published behavior.

Appointed e29–e39 lives through r68 also accept the optional versioned action
`{type:'patronage-reply',version:1,eventId,target}`. All four fields are required;
the target must be a public character physically present in the current scene.
The engine verifies the appointment, timing and once-per-workday limit. Previewing
or canceling does not draw RNG; committing draws once, records a separate
`patronageOutcome` and affects only the chosen character's affinity. These replies
do not count as insults or hits. They return to the unanswered source scene without
spending another workday, PIP turn, income payment or meal cost. No new cohort or
save version is required: existing actions and source choice indices remain intact.
Lives containing this action are checked against full canonical replay at both
pending and continued save boundaries; clients cannot submit a reaction or delta.

| Method | Path | Input | Response |
| --- | --- | --- | --- |
| GET | `/api/health` | — | `{ok:true,version:3}` |
| POST | `/api/player` | `{token}`: browser-generated 64 hexadecimal characters | `{playerId,unlocked,totalRuns}`; repeat registration returns the existing identity |
| GET | `/api/me` | `Authorization: Bearer <token>` | `{playerId,unlocked,totalRuns}` |
| GET | `/api/characters` | — | `{version:1,characters,trackingSince}`; aggregate counters only |
| POST | `/api/characters` | Bearer token; `{runId,roleId,seed,actions}` for a resolved prefix | Authenticated snapshot with all sixteen character rows and `verified:true` |
| POST | `/api/complete` | Bearer token; `{runId,roleId,seed,actions}` | Player snapshot plus `{runId,endingId,recorded:true,duplicate}` |
| POST | `/api/achievements` | Bearer token; `{runId,roleId,seed,actions}` for a resolved prefix | Snapshot with `{achievements:[{id,unlockedAt}],verified:true,newlyUnlocked}`; no completed-game count |
| GET | `/api/stats` | — | `{players,totalRuns,uniqueEndings,averageTurns,roles,endings,daily,observatory}` |
| GET | `/api/feedback-config` | — | Posting availability, public destination and limits |
| POST | `/api/feedback` | Bearer token; acknowledged, category-specific text and UUID `submissionId` | HTTP 202: `{submissionId,status,issueUrl}`; retrying identical content returns its existing receipt |
| GET | `/api/feedback/:submissionId` | Bearer token | Only the submitting player's receipt; no raw text or identity |
| POST | `/api/feedback-publisher/claim` | GitHub OIDC Bearer token; `{}` | Private leased batch, at most three items |
| POST | `/api/feedback-publisher/ack` | GitHub OIDC Bearer token; receipt and matching lease | Marks publication complete and clears stored text |

`runId` must be a UUID. `seed` is 1–32 characters. `actions` is at most 160 entries (300 for e13 through e31) from the engine's `run.actions`: `{type:'choice',eventId,index}` or `{type:'exit'}`; `e2-` through `e31-` runs also allow `{type:'break'}`, and `e10-` through `e30-` additionally allow `{type:'career'}`. e13 permits `{type:'rage'}`; e14 through e31 require `{type:'rage',phase:'event'|'result',eventId}` with the actual visible scene; the engine derives the default target during replay. e19 through e31 allow `{type:'raise'}`: this action accepts no additional fields, and replay rejects it unless the engine's current availability checks pass. The completion endpoint calls `replayRun(roleId,seed,actions)` and accepts only a completed run; the achievements and character endpoints also accept an unfinished, valid replay prefix. Client-supplied endings, scores and character totals are ignored. Reusing a committed run ID by its player returns the existing record without increasing counts; a different player receives HTTP 409. Authenticated player snapshots now also include `characters`, a sixteen-row array of that player's verified cumulative counters. e30 and e31 additionally accept the verified spoken-outburst action described below.

For e14 and later, a rage action in an explicitly registered group conversation may additionally include a `target` persona ID. For example, an exit-team conversation permits `'erich'`, `'jenjen'` or `'sonny'`. The engine verifies actual presence from the source scene, for both event and committed-result phases; a mere mention of somebody's name does not place them in the room. An explicit target is rejected in a solo conversation, even if it names that speaker; an out-of-room target is also rejected. Omitted targets retain the published default and identical old replay behavior. This extends the existing action envelope without a new seed cohort, extra RNG draw or save-version change.

New browser runs use an `e37-` seed prefix. They retain the eight-stage career, volatile mood/energy, competing abilities, expanded spending, zero-mood collapse, separate salary conversation and e20 personnel routing. e21 adds role-exclusive work scenes and a work scheduler based on the actual job after reassignment. The earlier e20 flow includes post-PIP reassignment to third-floor watch duty, reduced tolerance after passing PIP, direct dismissal without another improvement offer, and fictional labor-dispute scenes. Ordinary PIP remains a possible route; it is no longer an option in every dismissal notice. A break can be opened once per workday from a daily/fantasy event; it records a `break` action followed by a normal `choice` action. The engine validates timing, affordability and return state during replay, so a forged or repeated break is rejected. Spending does not advance the workday or PIP countdown.

The entry screen offers twelve explicit occupations and a random occupation card. Random entry draws from all thirteen roles, including the hidden executive role, before creating the candidate; rerolls draw the occupation again within the existing three-reroll allowance. The saved run and API proof contain the concrete role ID, never a `random` role. This presentation change adds no engine cohort or archive fields.

Existing `e1-` seeds retain their mid-career optional education conversation; unprefixed v3 seeds retain the earlier schedule. Both keep their original random sequence and outcomes. Ongoing saved games and queued completions remain replayable, and the archive/collection format stays v3. Preserve the complete seed, including its prefix; the maximum length remains 32 characters. The initial expanded events have `minRules:2`; two later chronicle scenes have `minRules:3` and occur for `e3-` / `e4-` / `e5-` / `e6-` / `e7-` / `e8-` / `e9-` / `e10-` / `e11-` / `e12-` seeds. Image-inspired scenes have `minRules:4`; video-inspired scenes have `minRules:5`. Published `e2-`, `e3-` and `e4-` seeds retain their 115-, 117- and 147-scene pools exactly. New events are excluded from older event pools, including the exhausted-pool fallback.

Image scenes may use a `pip` context: the draw pool and its exhausted-pool fallback include these only during active PIP. The mushroom scene does not automatically pass or end PIP. Some `e4-` / `e5-` / `e6-` / `e7-` / `e8-` / `e9-` / `e10-` / `e11-` / `e12-` choices have weighted story outcomes; resolution consumes seeded RNG only after selection and records an `eventOutcome` label for the result and journal. Weights and possible outcomes are not shown before selection. These fields remain local history; server verification derives them by replay.

The `e5-` and newer cohorts apply a text-only copy layer after checks are computed, including resolved check/draw branch text. It never changes probabilities, effects, numeric deltas, flags, IDs, or RNG consumption. Published cohorts retain their original stored text during replay; the browser displays the new 移動人生 name. The save keys, anonymous identity and collection format remain unchanged.

The `e6-` cohort adds a seeded invitation from 阿良 when opening self-care. The invitation never charges automatically. Its paid option requires enough savings and uses the existing self-care recovery RNG; reaching zero savings still uses the normal broke ending. Declining records a zero-cost choice and opens the ordinary self-care menu within the same break. Both menus preserve the work event, workday and PIP countdown; they cannot open a nested break, reroll the invitation or exit midway. Only resolved history exposes costs and gains. Published `e5-` and older replays consume no additional RNG and preserve their complete prior state.

The `e7-` cohort also draws a spontaneous invitation from 阿良 after resolving a daily work event, before the next ordinary work event. It does not interrupt onboarding, crisis notifications, career events or the fantasy finale. A short workday cooldown prevents consecutive invitations. Opening the invitation adds no charge or extra action; replay derives it from the preceding work choice. Accepting counts as that workday’s self-care, while declining returns directly to the waiting work event without using the self-care allowance. Neither choice adds a workday or reduces the PIP countdown. The current workday cannot offer 阿良 twice through the automatic and manual paths. Only `e7-` and newer saves add `lastKindInviteTurn`; published `e6-` and older states and queued completions remain unchanged.

The `e8-` cohort adds a five-stage career track, separate from the published role ladders: professional staff, deputy manager, manager, director, and C-level/VP. Assistants first regularize; senior managers (高階主管 in the UI) enter at rank 2 and may voluntarily step down. Reviews can recur every three workdays from turn 3, with distinct merit/politics requirements, seeded checks, training and deferral choices. Promotions update the actual-role title and salary, followed by a management decision before resuming the waiting work event. Management pressure appears in the resolved delta ledger; reviews and duties do not advance the workday or the PIP timer. Tier-specific endings require actual work/decisions at that tier. Existing endings remain reachable through the legacy career list.

The `e9-` cohort balances the career track without changing published e8 replays. `flags.career_service` counts only resolved daily/fantasy work in the current position, including assistant work. Successful regularization/promotion or voluntary demotion resets it; failed reviews, training, duties, breaks and exit menus do not. Promotion requires 2/3/4/5 actual work turns at staff/deputy/manager/director, with global earliest promotion turns 4/8/13/18. Assistant regularization requires two work turns and turn 3. Review attempts remain at least three work turns apart and stop at turn 20. Director and C-level checks have lower success rates and caps; training adds less skill/flattery. Passing PIP and choosing to remain gives six work turns of crisis cooldown without raising boss mood. Salary proposal timing, cut ranges and negotiation rules are unchanged.

The `e10-` cohort changes notification pacing while keeping the e9 promotion requirements, success checks and pay multipliers. Automatic career invitations require an available regularization/promotion application, earned tenure and the normal review wait. Players may open preparation themselves with `{type:'career'}` from an uninterrupted work event at turns 3–19. Opening consumes neither RNG nor a workday; choosing training or deferral still uses the review wait. Deferral waits six workdays. The engine and HTTP layer reject early, repeated, modal, PIP, high-rank and legacy-cohort preparation actions.

For e10, one continuous low-boss-mood episode triggers at most one dismissal/PIP dispute. A resolved workday outside active PIP must reach boss mood 35 before a later fall can trigger a new dispute; menus, self-care and an improving mood during active PIP cannot rearm it. The existing six-workday cooldown still applies after staying. A new three-workday PIP is available only through turn 20, and its expired assessment is resolved before career/fantasy closure. Existing e9 and earlier saves retain their complete original state and RNG. New state remains in the version-3 `flags` object; anonymous storage and the archive schema are unchanged.

The `e11-` cohort adds one early education/salary assessment after daily work, at turns 2–4 (UI DAY 3–5). A scheduled turn is drawn only for new e11 runs; an already-imminent low-boss dispute can pull it earlier within that window. The assessment does not interrupt active PIP or an existing modal and expires after the early window. Risk comes from the fictional boss's school/subject preferences and engineering-role mismatch, with salary measured against the actual role's range adjusted for assistants and rank. This is not a school-quality ranking. Information management remains technically relevant to engineering roles; the boss's dislike of business backgrounds is a separate criterion.

The seeded education response routes to either an early `salary-cut` (`salaryCut.reason:'education'`) or the existing exit-team dispute. Nothing is charged or concluded by merely opening a notice. Salary changes only on acceptance, negotiation/rejection/PIP remain available, and the suspended workday resumes without extra workday or PIP consumption. New integer `flags.education_*` fields record the due turn, one-time assessment, reason bits, active case and resolved route. Entering the case consumes the shared boss-crisis arm to prevent the same unresolved prejudice from immediately triggering a duplicate low-boss dispute. New choice outcomes and actual deltas appear only after selection. Existing e10 and older runs consume no new RNG and keep their original text/state/actions; the database schema and anonymous keys remain version 3.

The `e12-` cohort adds an authored absurd-option text layer after the existing copy layer. All 205 daily, four fantasy and 25 dynamic menus have at least one available wild option. The same choice index, delta, effect, flags, availability, checks, weighted outcomes and RNG consumption remain intact; only choice/result strings and an internal `wild` metadata flag differ. Check success/failure and weighted draw branches retain their original mechanics with coherent rewritten results. The layer never appends a new action or consumes a workday. Existing e11 and older states and queued completions are unchanged. Freeform input and raw player-text collection are not enabled by this update; archive data remains unchanged.

The `e13-` cohort adds a rage overlay and an optional three-stage year-end banquet, plus 32 shared replay-derived achievements. New run fields `rageContext` and `banquetReturnEventId` exist in e13 and later. Opening rage draws no RNG; a nonterminal pending result is first advanced once, matching normal replay. An already-selected ending cannot be undone. The overlay preserves all HR, exit, break, career and banquet pointers and returns without advancing a workday or consuming PIP. Each workday can resolve one target attempt; reopening after that only offers a free return, so it cannot reroll rewards. Character presence, own mood, boss mood and seeded draws select slapstick outcomes. New flags identify targets and actual resolved outcomes for achievements.

After ordinary daily work at turns 10–18, an eligible run has a seeded 36% chance to enter the banquet once; urgent notifications, active PIP and existing modals take priority. Welcome, lottery and afterparty scenes do not consume workdays or PIP. Both 阿良-invitation choices always agree then disappear, with no charge. Choosing independent paid self-care remains an explicit choice with affordability validation. Prize narration avoids nominal gains that could contradict clamped actual ledger deltas. On return, a waiting daily scene is checked against the current rank, including if the player stepped down during the banquet.

The `e14-` cohort replaces target selection with one direct rage action below the final story choice. The engine derives the target from the current scene (including a fixed spokesperson in exit-team scenes), resolves a seeded imagined/actual result immediately, and records its clamped numeric ledger. The browser displays that result pending; canonical replay advances it. A result-phase action must immediately follow the original choice, match its visible event and have no client-supplied target. Replay keeps that choice pending until the interruption resolves, preserving its speaker and committed transition. An absent transition is serialized as `null`. Imagined action resumes the suspended scene or advances the original result once. Actual action opens a separate, bounded aftermath; generic exhaustion does not cut this world short. Nested rage, exit, career and break controls are blocked there. Six dedicated ending families add 54 role-specific endings; the ordinary promotion ladder remains unchanged. All old e13 actions, states and RNG sequences retain their original semantics.

The shared achievement catalog has 112 IDs (39 through e17, including 38 through e15). Imagined/actual and first-day badges require resolved replay facts; legal, defeat and coup badges require the corresponding completed ending. Added goals cover occupations, education, eight career ranks, spending, ability tradeoffs, emotional recovery/collapse, PIP, salary disputes and banquet outcomes. Eligible historical proofs may earn added badges from already-resolved facts; the engine does not rewrite those runs. No new personal fields, raw transcript tables or client-authoritative achievement inputs are introduced.

The `e15-` cohort adds four original advisor events with `minRules:15`, preserving all older daily pools. Its text layer follows the actual education dialogue priority: engineering mismatch first, then a school complaint, then subject/degree bias. A department complaint offers an NTU electrical engineering application and an inquiry to the advisor character; no admission or supervision is guaranteed. The copy layer changes no weights, deltas, flags, effects or RNG. Dream outcomes are rewritten for all eight conversational targets while retaining the `腦內劇場` replay label. The browser adds a lavender dream frame, explicit reality badge and wake-up control only after resolution; journal entries use the same per-result classification instead of cumulative flags. A display-only exact phrase replacement polishes old e14 dream results without mutating their stored history. Existing anonymous identity, database tables and completion/achievement validation stay unchanged.

The `e16-` cohort adds six original scenes for the R&D manager 傑克, bringing the daily pool to 215 scenes alongside four fantasy events. His scenes cover meeting records, handover, API costs, colleague support, PIP self-assessment and departure paperwork; the PIP scene requires active PIP and never decides its outcome. 傑克 has an original portrait and becomes a direct-rage conversational target with a replay-derived badge. The catalog remains 288 endings and now includes 39 achievements.

For e16 only, career version gates restore the e12 readiness checks, training gains, upper-rank success limits and eligible automatic invitations that were omitted in e13–e15. The education salary-cut and dismissal copy also uses its matching early-assessment context. Historical cohorts retain their published behavior.

Public copy uses the aliases 翅膀, 屎潘蛇, 法師, 阿福, 真真, 老闆乾兒子, 阿良, 希望, 傑克 and 水蛇; the advisor is displayed as 林澤教授. The executive role is displayed as 高階主管. The e16 engine introduced aliases applied only to authored text after mechanical checks, leaving IDs, flags, effects, weights and URLs intact. The browser also formats older saved history, collections and certificates with these names without changing stored proofs. The e20 sales-manager character 水蛇 uses a completely original animated portrait, not a likeness of a real person. All e15 and earlier pools, RNG consumption, actions and replay states remain unchanged; anonymous identity and the version-3 archive schema are preserved.

The `e17-` cohort replaces the five-stage career model for new lives with eight ranks: assistant (0), professional staff (1), senior professional (2), principal professional (3), deputy manager (4), manager (5), director (6), and C-level (7). Ordinary formal appointments start at rank 1, assistant appointments at rank 0, and the hidden executive role at rank 5. Each actual role has eight corresponding titles. The system-engineering path is 助理工程師 → 工程師 → 資深工程師 → 主任工程師 → 工程副理 → 工程經理 → 工程總監 → 技術長 CTO. Senior and principal work concerns delivery, judgment and mentoring; personnel management starts at deputy rank. Promotion still requires current-position work, review eligibility and seeded approval; upper ranks have stricter requirements and lower success caps. Professional duty scenes and management duty scenes are distinct, and resolved rank pressure appears in the numeric ledger.

Three new tier-ending families add 26 stories: eight assistant endings (no executive assistant appointment), nine senior endings and nine principal endings. The existing 288 ending IDs retain their meanings, bringing the catalog to 314; the daily/fantasy pools remain 215/4 and the achievement catalog remains 39. Assistant and staff tier exits require actual work, while later tier exits require work or a duty decision at that rank. Managers may voluntarily step down to staff or deputy, with a corresponding salary reduction; the executive's professional path can therefore be reached without adding an assistant reassignment.

The e17 onboarding copy distinguishes an unchanged appointment, reassignment to another profession, and an assistant appointment. The unchanged opening begins naturally with the badge, business card and first assignments, without announcing that an unexpected reassignment did not occur. Reassignment names the actual position; an assistant appointment also compares the offered and actual salary. Each variant has separate accept, negotiate and leave text, including separate success/failure narration. This copy layer preserves choice indices, effects, checks, deltas and RNG consumption; it does not change assignment probabilities.

`career-api.js` dispatches by seed prefix. Existing e16 and earlier career saves retain their original ranks 0–4, titles, mechanics and exact replay state; their stored ranks are not migrated. The `e17-` through `e21-` cohorts carry the full rank 0–7, which fits the existing SQLite integer column. Seed-prefix validation governs the engine's rank range, not a client-supplied rank field. Save/collection version 3, anonymous identity and the database schema remain unchanged, so no database migration is required. Career distribution uses ending-family IDs rather than merging historical and current raw rank numbers.

The `e18-` cohort keeps the 314 endings and 215/4 daily/fantasy pools. General authored mood/energy deltas are multiplied by 1.35, except self-care, rage and the new mood-crisis scenes. A separate seeded pulse after daily/fantasy work adds a particularly draining day, accumulated interruptions, mixed relief, or a favorable day. This draw affects mood and energy only; ordinary work pressure, fatigue, PIP and accepted-pay-cut pressure still apply. The resolved ledger exposes the actual clamped contributions after selection. e17 and earlier histories, numeric rules and RNG sequences remain exact.

The initial skill/slack/flattery dice are normalized proportionally when their combined score exceeds 180. After each e18 choice, the largest actual positive ability gain becomes the focus; the other two cannot exceed their respective pre-choice values minus half that gain, rounded up and floored at zero. Proportional normalization enforces the 180 total again. The final correction is a separate `ability-tradeoff` ledger entry, and `flags.resource_friction_count` records resolved corrections. Paid training follows the same rule. No new random draw is consumed by ability normalization or tradeoffs, and e18 state validation rejects a combined ability score above 180.

The e18 self-care menu offers seven purchases: a drink/walk, undisturbed sleep, a practical course, evidence backups, a networking meal, a restorative weekend, and a rehearsal-room meeting chaired by a toy goose. Costs are disclosed before purchase; future stat deltas and odds remain hidden. Unaffordable options are unavailable, and a no-spend return remains available. Resolved purchases use `flags.spend_*` and existing evidence/archive/alumni flags where relevant. `flags.cash_spent_total` sums actual negative cash movements while resolving choices, before any later income can offset the net delta; it is not a nominal cost total or merely the final cash difference. Only this e18 counter may be an integer up to 10,000; other flags retain the existing 0–500 limit. Flags stay in the replay state and are not new database columns.

After an e18 pending result advances, a nonterminal run at zero mood enters `mood-collapse` unless already resolving rage or a collapse. This is a real witnessed outburst, not a dream and not mandatory physical violence. The engine suspends the exact next scene in the e18-only `meltdownReturnEventId`; its validation checks that the pointer is consistent with the collapse scene and references a valid return scene. The player may pay 18 savings for emergency support, take unpaid leave with a rounded 10% reduction to subsequent fictional salary and a trust cost, or choose a dramatic resignation. Recovery resumes the suspended scene without another workday or PIP tick. Low but nonzero mood still permits a separate warning: paid support or a small free reprieve that costs energy and trust. Terminal endings remain final. Finishing a run clears the new pointer, and e17 or earlier states never gain this field.

In e18, the `boss` stat is explicitly 翅膀心情. Direct interaction with 翅膀 keeps its authored delta. Other NPC-only conversations do not alter it; a resolved reply that actually reaches him, or an HR/legal/administrative proxy explicitly conveying his position, scales that delta to 35%, capped at ±8. Unselected outcomes and mere mentions of earlier remarks do not count. Imagined rage has zero effect on his mood even when he is the target. Actual rage against 翅膀 retains the authored effect; against 屎潘蛇 the mood decrease is capped at 3, and against another character at 5. Later aftermath news is limited separately. The daily Wing-weather draw remains an independent change in his own mood. Colleague reactions remain represented by trust, replay flags and their story branches rather than a shared company-wide mood meter. These routing helpers consume no RNG and do not add per-character mood fields.

The `e19-` cohort adds `salary-raise-v19.js` and a separate `raise` replay action without changing the promotion requirements. A player must have resolved three daily/fantasy work choices, be viewing an uninterrupted ordinary work scene, have no active PIP or pending salary cut, and remain below the current rank's fictional salary ceiling. A formal attempt is recorded only after choosing a proposal approach. The first-stage cancellation neither spends an attempt nor starts the cooldown. After a formal attempt, five additional daily/fantasy work choices are required; each run permits at most three attempts. Nested menus, pending results, rage and collapse prevent starting a new conversation. Opening it draws no RNG.

The three salary scenes resolve seeded offers, promises, angry refusals and offset proposals. An offer alone leaves salary unchanged. Only accepting a written grant changes `pay` and recalculates `basePay`, preserving the basis for later promotions and demotions; it does not change rank. An accepted offset also charges the explicitly narrated one-time savings loss. Rejected terms, unconfirmed promises and angry refusals do not grant salary. Each resolved effect remains in the existing numeric/history ledger; possible outcomes and weights stay hidden before selection. The dialogue is original fiction with public-safe `careerFiction` labels, not private chronicle text or a quotation asserted as fact.

The `raiseContext` introduced in e19 keeps the suspended work-event ID and the proposed amounts, percentage, approach and resolved/viewed phase. Its validation checks allowed fields, a real daily/fantasy return event, bounded amounts and consistent phase values. Direct rage can suspend a salary scene; imagined rage returns to the same negotiation, while actual rage follows the existing aftermath and ending rules. Zero-mood collapse preserves the waiting salary scene and its context; unpaid-leave recovery recalculates an unconfirmed offer from the reduced salary. Salary scenes add no workday, current-position service or PIP tick. Closing clears the context before normal continuation, and terminal endings clear it as well. Published e18 and older runs retain their exact state, history, actions and RNG sequence and never acquire this field. e19 required no new endpoint, personal-data field, archive table, schema migration or save-version change and retained its 112-achievement, 314-ending catalog.

The `e20-` cohort adds personnel routing without adding an action type or API endpoint. Passing PIP and choosing to stay can lead to a third-floor watch assignment while the ordinary office remains on the fifth floor. Watch duty uses its own daily scenes and later review; these resolved daily choices count as workdays, while notices and dispute conversations do not. The assignment initially preserves the role title and salary. It limits ordinary work invitations and career preparation until the assignment is resolved. Result history records the actual costs and changes only after selection.

Passing PIP also records reduced tolerance for later provocation. A fresh resolved choice that angers 翅膀 can trigger another personnel decision; a persistently low meter alone does not generate the same penalty every turn, and active PIP or a pending modal is not interrupted by a duplicate notice. A severe confrontation can instead route directly to the exit team without offering PIP. Those scenes allow departure or a fictional complaint/mediation path, with no promised real-world legal result. Deferred personnel decisions wait for existing salary, rage, collapse, break and banquet scenes to finish rather than discarding their return state.

e20 adds eight sales-manager 水蛇 scenes to the daily pool, bringing the daily/fantasy catalog to 223/4, plus three dynamic watch-duty conversations. The expanded ending catalog has 341 entries; existing ending IDs are retained. Two new illustrated achievements bring the total to 114. The target badge follows a resolved engine target flag; the dream badge additionally requires the same resolved `rage-release` history entry to identify 水蛇 and an imagined outcome. Opening a menu or combining unrelated attempts is insufficient. Locked titles, art, conditions, possible outcomes and draw weights remain hidden in player-facing UI.

The `e21-` cohort adds 60 exclusive work scenes: 12 each for sales, business development and design, and four each for system engineering, AI engineering, MIS, project management, product management and executives. The daily catalog becomes 283, with four fantasy scenes, 341 endings and 114 achievements unchanged. Every new scene has at least one authored absurd option with its own coherent result. Chapter IDs reference the existing public-safe inspiration catalog; no raw private research is added.

Only e21 uses `selectWorkEventV21`. Eligibility follows `actualRoleId`, not the advertised role: a reassigned engineer does not continue drawing another profession's exclusive duties. The first eligible ordinary work selection uses an exclusive actual-role scene. Later draws first select an exclusive/related/shared bucket with weights 50/20/30, then select a scene within the bucket using its event weight. A missing bucket falls back to exclusive, then related, then shared. After two completed shared work scenes, the next ordinary selection prioritizes exclusive work, or related work if none is eligible. Only resolved ordinary daily rows count toward this pacing check; opening or cancelling a break, rage picker or career menu does not count. Personnel, PIP, watch duty, career, banquet and invitation routing keep their existing priority. These are developer scheduling rules, not player-facing probability promises; future outcomes and weights remain hidden in the game.

The scheduler derives its recent history from existing replay rows and adds no save field, action type, endpoint or personal-data collection. Seeded RNG is consumed only by the engine; old e20 and earlier lives retain their exact event pools, draws, states and queued proofs. Version-3 saves, anonymous credentials, server replay validation and archive tables remain unchanged; no database migration is required.

All e19 and earlier states retain their published history, event pools, RNG sequence and replay behavior. e20 personnel markers remain in replay state, using the existing flags and validated return state; they are not archive columns. The personnel update adds no database migration, save-version change, anonymous-identity reset, personal-data field or freeform-answer collection. The separate character-statistics tables are described below.

Gemini integration has only been assessed for feasibility. No LLM calls or freeform in-game answers are enabled, and no new player-text collection is introduced. Explicit website feedback continues through the separate acknowledged submission flow.

`deriveAchievements(run)` is shared by browser and Worker. The API ignores any client achievement list and replays the supplied action prefix. Successful proofs store only earned IDs/times and a seed hash/run ownership binding; they do not create `runs` rows or alter aggregate ending counts. Completion also derives achievements. Browser milestones are retained locally; an offline queue keeps the newest proof per run and retries, preserving a newer prefix that arrives during an older upload. The public stats endpoint does not reveal individual achievement lists. Imported collections remain local and are not labeled server-verified until proven by an actual replay.

The current catalog has 123 active badges. Rage goals now distinguish a resolved `rage-release` entry with `kind: 'rage'`, `choiceIndex: 0`, its single speaker and the actual `eventOutcome.result`. Neither target flags nor independent real/imagined flags establish a hit. `real-hit-*`, `real-first-day` and `real-documented` use new IDs so a previously stored dream cannot satisfy them. First-day goals pair the release with the same rage action's `onboarding` origin; turn zero alone is insufficient. Dream goals, including first-day imagination, are separate. The 14 former mixed badges remain in additive storage under their original IDs and dates, displayed only as collected legacy memorabilia outside active progress. No database migration or record deletion is needed. Existing replay inputs/RNG are unchanged; retained valid runs can prove new goals through the regular achievement endpoint, while an old ID/time alone cannot.

`chronicle-scene-copy.js` corrects the displayed First Love duel and arm-wrestling story without changing engine records. It preserves choice indices, draws, deltas, speakers and all proof inputs; recognized resolved text is replaced only in the browser, keeping appended RNG notes. Result and journal rendering share that correction, while character counters continue to use the original history objects. Private source files and original conversations are not shipped. Three scene achievements read the canonical resolved choice history: `banquet-first-love` requires welcome choice 1 and either recognized song draw, while `sonny-press-conference` and `sonny-unplayed-champion` require arm-wrestling choices 1 and 2 respectively. An open scene, supplied badge ID, display wording or broad banquet flag is insufficient. Valid retained replay prefixes can backfill these goals; the rules do not consume RNG or alter saved histories, character hit counters, anonymous identity or database schema.

Four additional illustrated wealth achievements are derived by the shared `wealth-achievements.js` helper. They require resolved e27 career/self history: startup choices 0/1 must match the actual success/setback draw and paid investment ledger, full retirement requires choice 0 or 2, and the toy-goose chairman additionally requires choice 2. Opening or cancelling the plan, flexible consulting, toy production by itself, supplied IDs and broad wealth flags cannot substitute for those records. The browser reveals only earned art/copy; locked cards contain no achievement identity or image. Retained canonical e27 proofs may backfill the goals through the existing achievement endpoint. This is a derived catalog expansion, with no new cohort, RNG draw, action, saved field, database migration or aggregate ending count change.

## Chronicle expansion (e22)

The `e22-` cohort appends twenty original scenes: eight holiday-quiz adaptations, six Sonny conversations, and six Helen stories. They all require `minRules:22`, and retain the existing profession scheduler, personnel priorities, numeric tradeoffs and action envelope. Helen has the stable persona ID `helen`; her office nickname is fictional characterization, not a verified relationship claim. `rage-v22.js` adds her resolved imagined/real release and delegates every older target unchanged.

All published e21 and older lives retain their pools, seeded RNG, histories and replay outcomes. There are no new saved fields, anonymous credentials, database columns or migrations. Helen extends the existing character-ID projection and additive tables: older server progress appears with zero Helen counters and keeps every existing total. Verified legacy ten-person offline caches retain those actual rows; Helen remains unknown until a valid response supplies her counters. Private source bodies, photos, question-bank data and Zeabur configuration are not shipped.

The administrative character now displays as 真真, retaining the stable ID `jenjen`. `replayText` keeps the published engine aliases and history text, while `displayText` maps both older display names and original aliases to the current public name. Recruitment posters are read-only presentation on role selection and onboarding. Neither change adds a saved field, stat effect, random draw or database migration.

## Colleague expansion (e23)

The `e23-` cohort uses `e23-` seeds. Twenty original scenes require `minRules:23`, four each for the appended stable IDs `sophie`, `jonathan`, `owen`, `sam` and `cindy`. The existing profession scheduler selects related work from the actual job. Their original animated portraits are project assets; office relationship rumors are not established as factual relationships or causes of anyone's departure.

`rage-v23.js` supplies each new speaker's seeded imagined/real release and delegates every older target to the frozen e22 handler. Three explicitly co-present conversations register two targets each: Sophie/Sonny's printer dispute, Jonathan/Rick's testing meeting and Sam/Jack's study group. Merely mentioning a character never makes that person a target. The HTTP envelope accepts the same verified actions with an e23 seed and enforces the existing 300-action limit. No saved fields, credentials, database columns or migrations are added. All 341 published e22 routes retain 14,329 exact saved-state checkpoints.

Character tables already store string IDs additively. Existing personal/global totals and their tracking date remain intact; the server synthesizes zero rows for new characters until a verified interaction occurs. Legacy ten- and eleven-character offline snapshots keep their supplied values; absent appended rows remain unknown in the UI, and explicitly malformed supplied rows are rejected. The source and outcome remain determined by server replay, including prefix extension, conflict rejection, duplicate protection and anonymous player isolation.

## Salary advice (e24)

The `e24-` cohort queues one `low-pay-tip` conversation after an actual salary reduction leaves monthly pay below 30K. An unaccepted proposal or initial offer does not trigger it, and 30K is excluded. The display uses 月薪 and 林澤教授, including older saves, while canonical historical text remains frozen for replay.

Only e24 and later saves gain `salaryAdvice`, initially `null`, then `{from,to,historyIndex,returnEventId,status}` with `queued`, `open` or `done` status. Validation ties the amounts to the committed reduction and its preceding history entry. The reminder waits for a safe daily/fantasy return scene after urgent personnel, mood, salary, banquet or rage contexts. Active PIP alone does not block it; a pending assessment takes priority. A confirmed recovery to at least 30K cancels a queued reminder. Once shown, later cuts do not repeat it.

The three responses use ordinary verified choice actions, reveal consequences only after selection, and restore the exact suspended event without spending a workday, current-rank service, PIP tick or RNG draw. Imagined/actual rage uses existing replay semantics with 法師 as the present target. The public legal reference distinguishes the 2026 monthly minimum of NT$29,500 for normal full-time work from take-home pay and part-time arrangements; fictional dialogue promises no legal outcome. No external complaint is sent by any choice.

All 341 published e23 lives retain 14,474 exact save boundaries. Thirteen natural e24 prefixes cover reductions, offers, the threshold and interrupted conversations, with replay/API checks for duplicates, branch conflicts and anonymous isolation. Anonymous keys, version-3 storage, archive tables, character totals and tracking dates remain unchanged; no database migration is needed.

## Repeated mood collapse and dinner guests (e25)

New `e25-` lives keep the existing `flags.mood_crash_count` and use four escalating collapse profiles. Paid rescue costs 18/26/36/48 cash and restores 50/38/28/18 mood; unpaid leave restores 20/14/10/6 mood and reduces salary by 10/15/20/25 percent. Later episodes use the fourth profile. These are game rules, not employment-law advice. The UI shows only the current episode and upfront cost, with actual deltas revealed after selection.

The last collapse control is 受不了了，自爆. It records ordinary choice index 3 with `moodSelfDestruct`, enters `mood-self-destruct` and offers paid recovery, unpaid leave or departure. The fictional outburst publishes the character's complaints inside the game; it sends no real message. It never proves a hit or unlocks a hit achievement. Recovery preserves the suspended event, workday, career service, RNG and PIP timer. It does not register a second collapse simply because the outburst begins at zero mood.

e25 and later lives include `mealContext:null|{origin,page,guest}`. The self-care and low-mood dinner entries open two eight-person guest pages; selecting, paging and cancelling record canonical choices but spend no cash, RNG, workday or PIP tick. The browser advances these navigation choices immediately. Every guest has a portrait, original dinner dialogue, two paid responses including an absurd one, and a free cancellation. Actual payment records spending and character affinity; browsing alone does not count toward the paid self-care achievement. A table cancellation is still a conversation encounter, with no payment, affinity change or hit. Choice indexes remain below ten and use existing replay validation and endpoints.

Dinner rage can interrupt the event or its result; dreams return to the suspended dinner/finished work, while actual violence uses the separate aftermath. Dinner wording stays in the restaurant setting. Meals and emotional rescue preserve queued salary/personnel work and clear their return contexts on completion. Repeated unpaid leave can lower game salary below 20K; e25 salary-cut proposals now remain actual reductions instead of inheriting the old 20K floor, and ordinary proposals stop at 1K.

Seventy-one natural action prefixes cover every dinner response, four collapse stages and self-destruct resolutions. All 341 e24 lives retain 14,208 exact save checkpoints. Version-3 saves, anonymous credentials, sixteen-person aggregates, ending/achievement IDs and database schema remain intact, without a migration. Earlier cohorts keep their published fields, RNG, history and rules.

## Character statistics

`dist/character-stats.js` projects committed history independently of the engine cohort and RNG. It covers the sixteen public persona IDs. Each character has seven cumulative metrics: `encounters`, `imaginedHits`, `realHits`, `affinityGained`, `affinityLost`, `affinityUpEvents` and `affinityDownEvents`. A resolved ordinary response counts one encounter with its known speaker; an exit-team response counts one for each of 法師, 真真 and 阿福. Self/unknown speakers and unresolved records are ignored.

Hit counters require an exact resolved `rage-release` outcome and that entry's single speaker. Imagined release never changes affinity; actual release requests a 25-point decrease. The e13 cartoon menu, prose mentioning a hit, cumulative flags and later rage-world scenes do not establish additional hits. Rage-world responses can count as encounters but do not infer another affinity change.

The group-target picker is UI preparation only: opening or cancelling adds no action, random draw, time or character counter. Confirmation records the selected in-room target in the rage action; the resolved release uses that person's speaker ID. Only the selected character gains the rage encounter/hit, while an ordinary exit-team response still counts one encounter for each of the three. Other group scenes expose only their registered present characters. Appending a result-phase rage after an already committed ordinary response keeps the same action prefix and does not count that earlier response again. Once a target action has been accepted, replacing its target under the same run UUID is a branch conflict, not another increment.

Per-life affinity starts at 50 and stays in 0–100. Ordinary 翅膀 affinity reads only the resolved `choice` ledger's boss delta; other speakers use that ledger's trust delta. Each requested ordinary change is capped at 12 in either direction, then clamped to the character's remaining range. Only the actual nonzero change contributes gain/loss amounts and occurrence counts. Weather, RNG, ability tradeoffs and raw net history deltas do not substitute for choice evidence. Historical rows without a choice ledger retain encounters without guessed affinity. This score records interaction; it does not change PIP, promotion or any engine probability.

The authenticated progress endpoint, achievements endpoint and completion endpoint replay the same proof before updating counters. The first proof binds owner, role, seed hash, action count and action-sequence hash to its run UUID. A later proof must extend the committed action prefix; a same-length fork or nonmatching extension receives HTTP 409. Identical proofs are idempotent, and delayed shorter proofs are no-ops after identity checks. Only the new cumulative difference is added to player/global totals, so progress uploads followed by completion do not count the same event twice. Progress alone does not increase completed-run counts.

`GET /api/characters` publishes only all-character aggregates and `trackingSince`, the UTC initialization timestamp. Personal counters appear only in authenticated snapshots; public responses never expose player IDs, credentials, run IDs, seeds, actions or individual transcripts. These are recreational counts, not unique-human counts. Local current-life previews are distinct from verified personal totals and public aggregates.

Tracking starts with this feature's deployment. A previously completed run lacking a committed character proof cannot be reconstructed from its ending, so character backfill returns HTTP 409; ordinary duplicate completion still returns HTTP 200 and does not increase totals. Existing collections and achievements remain intact. Ongoing valid histories can be verified under their existing rules without a new seed cohort or replay change. Character tables are created with `CREATE TABLE IF NOT EXISTS` in the existing Durable Object; no namespace migration or recreation of existing game data is needed.

The earlier departure scenes use `minRules:8` and public-safe source labels. Their offer-checking, handover and alumni flags unlock additional story exits; rank-limited scenes use `minRank`/`maxRank` only in e8 and later. For e17, e18, e19 and e20, legacy scene requirements are interpreted through the corresponding professional/management level, so a senior professional is not mistaken for a manager. Career state lives in the existing `flags` object, including the peak rank and per-tier work/duty records. The database schema, anonymous identity, save keys and version-3 replay envelope do not change. All published e19 and older histories keep their original titles, pools, numeric effects and RNG sequences. Additional ending IDs are appended without renaming existing entries; collection and aggregate queries use the expanded catalog. The frontend career chart groups the eight tier-ending families, so it does not reinterpret the historical meaning of stored ranks.

The browser displays only resolved history deltas, never future choice effects or odds. New histories contain an actual, clamped `breakdown` for the choice, RNG, boss weather, workday pressure and income; its contributions sum to the recorded net delta. This detail is local save data and is not stored in the archive database.

The bearer token is the anonymous player's recovery credential. The browser should create it with cryptographically secure randomness, keep it locally, and send it only to this origin. The database stores its SHA-256 hash, never the token itself. Clearing local browser data loses access unless the player has retained that token elsewhere; there is no name, email, password, or cross-device account.

## Stored data and limits

- `players`: random player UUID, token hash, creation time.
- `runs`: UUID, player UUID, actual ending, advertised and actual roles, rank, fictional salary, turns, engine version, completion time.
- `player_endings`: unique player/ending pair and first-unlocked time.
- `player_achievements`: unique player/achievement pair and first-unlocked time.
- `achievement_runs`: run UUID, owner UUID, role, seed SHA-256 hash and creation time, to bind replay proofs to one anonymous run. Raw seeds, actions and story text are not stored.
- `character_runs`: run UUID, owner UUID, role, seed hash, committed action count/hash, completion flag, ending ID and timestamps. Only hashes are retained, not original seeds or actions.
- `character_run_totals`: the seven derived counters per run and character, used to calculate increments.
- `player_characters` and `global_characters`: authenticated personal and public aggregate counters. `character_meta` retains the tracking-start timestamp. These records persist with the anonymous archive; clearing browser data does not delete an existing server record.
- Seed, action history, education, raw IP, user agent, and name are not automatically stored by this application. Explicit feedback submissions are separate, as described below.
- Public stats contain only aggregates. Role counts use the role selected on entry. Turns match the UI: a first-day exit counts as 1 and the maximum is 24. Daily counts use UTC dates. `players` counts registered anonymous identities, not distinct humans.
- JSON bodies are streamed and capped at 64 KiB. POST requests reject a foreign `Origin` or cross-site fetch metadata; command-line requests without `Origin` remain supported. All API responses use `Cache-Control: private, no-store`.
- A lightweight memory guard allows 10 authenticated/registration requests per token hash per 10 seconds; HTTP 429 includes `Retry-After: 10`. The guard resets when the Durable Object restarts.
- Replay verification rejects basic fabricated results. Users can replay a valid route under a new UUID or create a new anonymous identity. These are recreational statistics, not a competitive leaderboard or unique-human measurement.
- Worker observability is disabled in configuration. No application request-body/token logging is implemented. Cloudflare's service-level processing is separate from these application tables.

## Website feedback → GitHub Issues

The three website forms accept memories, game suggestions, and bug reports. Text is transmitted only after an explicit submit with an unchecked-by-default public acknowledgement. The public Issue contains only the selected form fields and a random submission UUID, never the anonymous player UUID, credential, or game history. User text is rendered in safely sized plain-text fences; mentions, Markdown images and HTML cannot execute or notify people. The submission UUID is also a final-line reconciliation marker.

`feedback_submissions` stores the player UUID, submission UUID, normalized text, payload hash, creation time, processing lease and receipt. Same-ID/same-player/same-content retries are idempotent; altered content conflicts. Status lookup is owner-only. Text is cleared immediately after a successful acknowledgement; unconfirmed text expires after 30 days. A retained receipt does not prove a failed remote POST was never published: check GitHub before reposting an expired submission. Daily quota buckets use a random daily salt and a one-way connection-IP hash; no raw address is stored. A Durable Object alarm schedules salt/bucket cleanup within three days and text expiry at thirty days, even without page views or publisher activity. Reads also clear expired records; platform outages can delay alarm execution. Limits persist across Worker restarts: three submissions per anonymous player, five per connection bucket, thirty globally per UTC day, plus ninety pending items. These are modest spam controls, not proof of distinct humans.

The `Publish player feedback` Actions workflow runs every five minutes, after a successful production deploy, or via **Actions → Publish player feedback → Run workflow**. GitHub schedules may be delayed or dropped, and public repositories may have schedules disabled after 60 days without activity. The website stops accepting new submissions if no authenticated publisher heartbeat has arrived for 24 hours; drafts and the direct GitHub fallback remain available. A manual workflow run restores the heartbeat and processes the queue. No instant publication guarantee is made.

The publisher uses only the job's short-lived `GITHUB_TOKEN` with `issues: write` and `contents: read`. `id-token: write` obtains a signed GitHub OIDC token for the private outbox. The Worker verifies RS256 against GitHub's fixed JWKS URL and pins issuer, audience, immutable repository/owner IDs, repository name, main ref, workflow path, event type and token lifetime. Only the named publisher workflow can claim/ack; no new personal token or bridge secret is required. Trust settings are public non-secret `wrangler.jsonc` variables. The workflow never handles deploy credentials. Forks and PR workflows are rejected.

An exclusive 15-minute lease, workflow concurrency, and exact final-line Issue markers from `github-actions[bot]` handle retries. Before each create, the publisher lists all recent open/closed Issues (not the search index); if an earlier create succeeded before an acknowledgement failed, it reconciles the original Issue. Ambiguous creates are never immediately retried. Private text/tokens do not enter Actions logs, which contain aggregate batch counts only.

References: [GitHub OIDC claims](https://docs.github.com/en/actions/reference/security/oidc), [scheduled workflow limits](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule), [temporary GITHUB_TOKEN permissions](https://docs.github.com/en/actions/tutorials/authenticate-with-github_token).

## Local verification

From the project root:

```sh
npx wrangler dev --local --ip 127.0.0.1 --port 4174 --inspector-port 9231 --persist-to .wrangler/api-smoke-state
node --test tests/api.test.js
node scripts/api-smoke.mjs
```

The smoke script creates local test players and runs and refuses non-localhost targets. It checks the real Workers/SQLite runtime, static assets, replay validation, duplicate submission, ownership, authentication, request limits, aggregate privacy, and rate limiting. Its local database is separate from production.

Character statistics have an additional localhost-only smoke:

```sh
npx wrangler dev --local --ip 127.0.0.1 --port 4178 --inspector-port 9238 --persist-to .wrangler/characters-state
node --test tests/character-stats.test.js tests/api-characters.test.mjs
node scripts/characters-smoke.mjs
```

The character smoke accepts only localhost HTTP on port 4178. It checks natural replay prefixes, append-only extension, duplicate/shorter uploads, completion without double counting, rejected branch replacement, personal isolation, separate imagined/actual hits and public aggregate privacy. Unit migration tests prepopulate historical completion rows to test the no-backfill rule; the public smoke does not create a test-only bypass.

The group-target flow has a separate local smoke:

```sh
npx wrangler dev --local --ip 127.0.0.1 --port 4179 --inspector-port 9239 --persist-to .wrangler/rage-group-state
node scripts/rage-group-smoke.mjs
```

This script accepts only localhost HTTP on port 4179. It uses natural group-conversation fixtures for all three in-room targets, event/result phases and imagined/actual modes. It checks that a previously submitted prefix can be extended, achievements and completion do not double count interactions, selected-target changes under a committed run ID conflict, out-of-room targets are rejected, and public aggregates expose no proof or identity.

Role-work e21 has an additional smoke on the same local server:

```sh
API_BASE=http://127.0.0.1:4179 node scripts/jobs-v21-api-smoke.mjs
```

It requires one naturally replayed completed proof for each of the nine occupations, each resolving at least one new e21 work scene for the actual job. It checks prefix extension through characters/achievements/completion, duplicate counts, rejected event/target/RNG forgeries, isolated personal counters and public privacy, plus acceptance of a historical e20 prefix. It refuses non-localhost targets and missing role coverage rather than silently skipping a case. Reports go to the ignored `artifacts/jobs-v21/` directory.

The frontend can continue using its local collection if the API is unavailable. Unsent runs remain in the local queue, with automatic retries that back off to at most once per minute. A 500-run queue limit reports a message instead of removing older unsent games. Replays permanently rejected by the server are removed from the upload queue so later valid games can sync; their local ending collection is preserved. Only completed runs with valid v3 replay data can be uploaded; older local collection entries do not have enough evidence to fabricate matching server runs.

## Cloudflare references

Configuration follows [Static Assets Worker-first routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/), [SQLite-backed Durable Object storage](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/), and [SQLite namespace creation](https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-storage/). The `HedoArchive` migration creates a SQLite-backed class, and multi-table completion writes use `transactionSync`.

[Durable Objects permissions](https://developers.cloudflare.com/workers/authorization/durable-objects/) are inherited from the implementing Worker; they have no separate roles or permissions.


## Private quiz adaptations (e26)

New browser lives use `e26-` seeds. The private 149-question collection was reviewed against the existing scenes; this release adds 95 original scenes and 285 responses, for 418 daily scenes and four fantasy scenes. The source bank, answer table, administrator URL, provider identities, original images and credentials are not shipped. Sensitive recollections are adapted as anonymous workplace fiction.

Only e26 adds these scenes to its event pool. The actual-job work scheduler, career and personnel rules, escalating collapse, dinner flow, anonymous identity, character aggregates and database schema stay unchanged. Fifteen new conversations explicitly have multiple characters present; 33 legal targets are checked in both event and result phases. Merely mentioning somebody in a story does not put them in the target picker.

`tests/fixtures/quiz-routes-v26.json` contains 294 synthetic natural-operation witnesses: every one of the 285 responses plus all nine actual occupations, each with a completed continuation. The API tests replay unfinished progress and completions, verify idempotent retries and player isolation, reject forged actions and ignore client-supplied stats. The e25 fixture freezes all 341 published lives and 14,114 save boundaries. No database migration or replacement of existing player data is needed.


## Savings-funded departure plans (e27)

New `e27-` lives add `wealthReturnEventId:null|string`, three self-narrated planning scenes, and 36 endings in four appended families. Cash remains the existing 0–100 resource; no real money, investment service or player financial data is involved. Six completed daily/fantasy work scenes plus cash 75 permit a business launch; ten completed work scenes plus cash 90 permit retirement. An unresolved work result does not count yet.

Each newly qualified option can prompt once, after an ordinary completed work scene with sufficient mood/energy, no active PIP and no other pending arrangements. Urgent personnel and mood handling keep priority. Players can also enter via appended choices in the exit/career menus. Opening, inspecting, going back and cancelling spend no RNG, resource, workday or PIP tick; cancellation returns to the exact suspended scene. The launch costs 35 or 40 cash, stated before selection, and uses one deterministic capability-based check for an independent business or a finite first-attempt setback. The outcome branches each carry the full fee. Retirement and selective consultancy require explicit confirmation and do not silently conclude a life.

No new action type or endpoint is needed. The server replays the existing choice proof, validates the computed ending and ignores client-supplied wealth or outcomes. Repeated submissions retain existing idempotence, owner and append-only checks. Earlier seed cohorts retain their original fields, RNG and routes; the e26 fixture freezes 341 lives and 14,502 save boundaries. New ending IDs append to the catalog without replacing old collection entries or changing the database schema.

## Backoffice occupations (e28)

The e28 cohort adds finance, accounting, HR and administration as stable role IDs `finance`, `accounting`, `hr` and `admin`. Older seeds cannot create or validate a run containing one of these jobs. Each has an eight-level ladder and salary range. Reassignment can change HR/admin at onboarding; later dual-duty work is a resolved scene and retains the main job. Thirty-two original exclusive work scenes use `minRules:28` and follow `actualRoleId`, with existing work scheduling, personnel priority, mood/energy pressure and PIP behavior. Seven explicitly co-present groups support target selection in story and result phases, including the four-person extension-number scene; the UI waits for a target and replay validates the selected identity before recording interactions.

The original 377 ending IDs and order are frozen; 168 backoffice endings append with `minRules:28`, for 545 total. The 122 achievements and 16 characters remain available through the existing proof projection. New seeds retain all inherited rule gates and the 300-action envelope. No new action type, personal-data field, database migration or anonymous-identity reset is required. Public aggregates add four role buckets without replacing previous counts.

Before core changes, all 377 published e27 lives were captured at 16,192 JSON-compatible state boundaries. The legacy suite checks exact saved hashes and canonical server replay. Natural e28 event witnesses cover all 96 new responses and valid completed continuations, while UI and SQLite Worker tests cover the new professions without production writes. Raw private source bodies and evidence indexes are not shipped.


## Fictional gender and patronage applications (e29)

New lives append one seeded male/female character roll after the existing resume draws. `characterGender` is fictional story state, never a request for the player's gender. It does not alter innate ability dice, education, initial salary ranges or appointment odds. Four female-only, two male-only and six shared original scenes add bias, fair-work responses and Rick stories. `requireGender` filters both the ordinary pool and exhausted-pool fallback. The public persona is named 瑞克, with the literal position 老闆乾兒子; earlier canonical history text remains frozen and is formatted at display time.

The `patronage-application` scene is a special appointment, not a fourteenth entry role. Eligible lives may receive it after at least three completed work scenes, or enter through an appended career-review choice. Offers are bounded to two per life and separated by at least five completed workdays. Active PIP, post-PIP scrutiny and watch duty exclude the offer. Application navigation advances no workday or PIP tick. A seeded check can appoint the character as 乾兒子 or 乾女兒 and increase salary; failure or declining preserves the previous title and salary. Exact odds, future effects and outcomes remain hidden before choice.

`patronage` records the actual successful history index, former salary and appointment salary. `patronageContext` preserves the suspended daily/fantasy scene and entry origin. Save validation recomputes gender from the seed, verifies the successful canonical choice, and rejects mismatched title, salary or return state. The original role, actual role, rank and ending keys stay intact. Appointment pauses ordinary promotion and reduces ordinary workload pressure; it does not grant immunity from personnel or mood events. Female characters cannot enter Kind's dark-invitation scenes; their banquet afterparty is a neutral dessert invitation with the same agree-and-disappear structure. Ordinary colleague dinners remain available.

Three new explicitly co-present groups support target selection in both story and result phases. Fifty natural replay witnesses cover all 36 new scene responses, formal/absurd application successes and rejections, cancellations, manual entry and retained title/pay/perks. The e28 legacy fixture freezes all 545 published lives and 23,902 JSON save boundaries. Anonymous credentials, the version-3 proof envelope and existing sixteen-person statistics are unchanged. Character gender is not stored in the archive. The observatory companion table is described below; existing archive tables do not need alteration or replacement. Raw private sources and evidence indexes are not published.


## Observatory aggregates

`GET /api/stats` retains its existing keys and adds a versioned `observatory` object. Actual-job distribution, reassignment count, ending-type distribution, tenure bands and fictional salary bands use the existing completed `runs`. No ending titles are added. The companion `run_observations` table stores canonical replay-derived rule cohort, five/eight-stage career scheme, final rank, special appointment and bounded occurrence counts for PIP, promotion, salary cuts and mood collapse. It stores no character gender, raw seed, action transcript, contact data or credential. The table is created additively inside the existing Durable Object, preserving existing player, ending, achievement and interaction records.

Five-stage and eight-stage ranks are never merged by numerical index. Special appointments appear separately. An old completion without observations remains unclassified until the owner resubmits a verified matching canonical proof; a valid duplicate may enrich its observations without creating another completion or counting interactions again. Unknown historical branches are not reconstructed from rank or ending alone. Observation tracking time describes collection, not the date when an old game was played. New experience-rate denominators use only recorded observations, while established completion and role totals continue covering all archived runs. Public responses expose aggregates only.

`observatory.departureWays` is an additive, ordered array of `{id,count}` with thirteen groups: `voluntary`, `forced_signed`, `company_exit`, `pip_failed`, `pip_passed_exit`, `cold_storage`, `labor_dispute`, `burnout`, `cash_exhausted`, `startup`, `retirement`, `other`, and `unclassified`. It classifies the published ending family in every archived `runs` row, including old completions without a replay or `run_observations` record; each life contributes exactly once, so the sum equals `totalRuns`. Unknown ending IDs or future unmapped families contribute only to `unclassified` without exposing their text. The company-exit group includes refused signatures, dismissal and mergers; it makes no claim about whether PIP occurred. Fantasy and other outcomes that do not establish a departure remain `other`. Client-supplied classifications are ignored. Before e38, this projection required no extra stored departure fields. The existing observation-specific `unclassifiedRuns` retains its original meaning and is separate from the departure group's `unclassified` count.

Starting with e38, an otherwise nonterminal workplace chapter can become a genuine resignation only when the player confirms the canonical `chapter-resolution` departure choice. The server replay must establish both that choice and its `departure38_voluntary` flag. The additive `run_departures` table retains only the related `run_id`, coarse `way`, and collection `created_at`; it stores no dialogue, seed, action transcript, personal field, or credential. New completion, ending collection, observation and departure writes share one SQL transaction. An owner retry can backfill this small classification only after matching the committed action hash; foreign owners, incomplete branches and supplied labels cannot change it. Old rows without this evidence keep the published family fallback, including `other` for earlier still-employed outburst chapters. Exhaustion and depleted-savings confirmations retain their separate `burnout` and `cash_exhausted` categories. A left join counts every archived life exactly once without rewriting older completions or exposing locked ending text.


## Spoken outbursts (e30)

An e30 proof may include `{type:'verbal',phase:'event'|'result',eventId,target?}`. The engine derives the in-room default target; an explicit target is accepted only in a registered group and must name somebody actually present. Self-narrated scenes target the air (`self`) without creating a character. This is a real spoken sentence, separate from imagined and actual hits. The browser adds it below regular choices and above the rage control. Picker preparation and cancellation are UI-only: they record no action, RNG draw or resource change. Confirmation resolves one seeded draw into a pending result; the internal release choice cannot be submitted separately.

New saves add `verbalContext` and `lastVerbalTurn`. At most one actual outburst is allowed per work turn, including before/after-choice phases. Context records the suspended scene, speaker, selected target, phase, history boundary, original pending effect, resolved outcome and any legal result. The engine preserves an already committed response and resumes it exactly once. Regular work, PIP, salary talks, meals, appointment, banquet and mood-recovery continuations remain valid. Current verbal/rage aftermath, zero mood or exhausted resources and an already determined ending cannot recursively start another outburst. Ordinary resource endings still apply to actual release costs.

Six outcomes cover being ignored, a damaged relationship, a retort, colleague support, personnel handling and a legal dispute. Weighted draws vary with the target, mood, scene and post-PIP scrutiny. Personnel responses offer a warning; post-PIP scrutiny or an extremely angry boss can route directly to the existing dismissal flow, without another PIP. The legal branch provides free clarification/apology or explicitly priced 12-cash assistance, then a withdrawn/settled/pending result and return. Paid help must leave cash and sufficient energy; the brief free followups remain finishable. These are fictional procedures, not findings of liability or legal advice.

Resolved `verbal-release` history stores `verbalOutcome:{kind,target,affinityDelta,origin,phase}`. The character projection validates that evidence, applies the requested change only to the selected speaker, clamps it to the remaining 0–100 relationship range and counts only the actual gain/loss. Unlike ordinary conversation's 12-point cap, a verbal rupture can request a 32-point loss. It never creates a real or imagined hit. Existing seven character metrics, anonymous identity, character tracking date, ending/achievement IDs and archive tables remain intact; no schema migration is required. Raw verbal text stays in local history; the server replays the proof transiently and retains hashes/counters under the existing policy.

The e29 fixture freezes all 545 published lives and 24,090 saved-state boundaries. Natural e30 witnesses cover every NPC and self in both phases, every random outcome, all legal responses/results, group targets and interrupted contexts. Server tests reject forged phases, targets, scenes, client-supplied results and replacement branches while preserving idempotent replay and player isolation.


## AI database work (e31)

New browser lives use e31. The actual AI job can draw `ai31-auto-increment`; an advertised AI hire reassigned to another profession cannot. All three committed responses discover the database-numbering joke and derive `ai-auto-increment`. Opening the scene, unplayed choices, supplied badge IDs and flags do not prove it. The shared server replay remains authoritative, with existing player isolation and idempotency. The public catalog now contains 123 active achievements; locked art, titles and conditions remain hidden.

The assistant badge retains its `assistant` ID and original predicate, with its wording corrected to adding「助理」rather than removing it. Existing unlock dates and collections are preserved. e31 inherits all e30 controls, spoken-outburst evidence and observation projections. The e30 fixture freezes all 545 published ending routes and 24,245 complete JSON boundaries. No migration, new API action, player-data field or credential is required.


## Starting-pay advice correction (e28–e31)

The optional, replayable `{type:'salary-advice'}` action repairs the missed initial-pay case without changing published seeds, RNG or old action prefixes. It accepts no extra fields. The browser requests it only while continuing a life or advancing a result into safe daily/fantasy work; simply rendering, inspecting the candidate or opening the onboarding result does not mutate the save. An existing eligible 27K administrative life can continue with its current seed and anonymous identity.

Eligibility checks the canonical initial roll, committed onboarding salary and current salary below 30K, a missing prior advice record, and the absence of pending results, endings or other conversational contexts. The new six-field advice object adds `origin:'starting-pay'`, records the committed starting salary and current salary, and binds to a real history index plus suspended work scene. The existing five-field pay-reduction advice schema and older text remain unchanged. The three replies resolve without RNG, extra workdays or a PIP tick; the same scene resumes and the advice is marked done. API validation rejects injected pay/context, extra action fields, repeats, wrong timing and older unsupported cohorts. No new personal fields, database migration or credentials are required.


## Scene-specific spoken responses (verbal version 2)

New UI outbursts opt into `{type:'verbal',phase,eventId,target?,version:2}` within supported e30/e31 lives. Omitted `version` retains the original v1 replay. Only the integer `2` is accepted when the field is supplied; dialogue, target presence, branches and effects come from canonical replay, never supplied text or client results. This requires no seed reset, ending-ID migration or new player data.

Before a decision, the spoken response is its own authored alternative rather than an implicit choice of one of the original answers. Work scenes account for the ordinary workday once. Formal salary, PIP, appointment and other decisions retain explicit consent in their new aftermath; a spoken insult cannot accept a pay reduction, grant a promotion or make a purchase. A response after a committed result preserves that choice and finishes its transition once, without charging or ticking it twice. The browser previews only the literal sentence; consequences and odds remain hidden until resolution. Scene and speaker bind the line, while verified character counters record only the selected person, independently of any hit goals.


## Spoken and company finales (e32)

The e32 cohort appends 260 role-specific ending cards and 26 illustrated goals while preserving all 545 published ending objects, their order and prior replay cohorts. Version-2 verbal actions retain their action/history envelope; only e32 reactions insert the new `verbal-v32-aftermath` stage. Its draw depends on the actual target, source timing and reaction severity. Completing the dedicated aftermath requires its own committed choice. Continuing instead resumes the original formal decision or work transition once, preserving explicit salary, appointment and PIP decisions. Opening another UI or cancelling a picker never creates that evidence. Spoken interactions remain separate from imagined and physical hit counters.

The company finale uses only ordinary choice actions and an e32-only `companyContext` with `{returnEventId,historyLength,route}`. The market, buyer and Vietnam menus bind to the committed entry scene. Previewing, returning or changing menus does not rerun a workday, income or mood/energy drain. Nested career, raise, break, exit, rage, speech and salary-advice shortcuts are unavailable while a plan is open. The actual plan draw resolves one of ten company directions without requiring a C-level rank; old `nasdaq`, `taiwan` and `acquired` proofs retain their original meaning. Taiwan success is displayed as 上櫃 for the new cohort without rewriting the historical card objects.

New badges require resolved e32 history and its source outcome/actor/choice, including an actual matching verbal action for the explicit group-target badge. A client-provided ending, severity, label, context or achievement list cannot supply proof. The server still replays actions, retains only anonymous commitments and derived counters, and deduplicates completion. No schema migration, new personal field, API credential or original story-text storage is introduced. Departure statistics explicitly classify the new families, including endings where the player remains employed.


## Spoken follow-up pacing (e33)

New browser lives use e33 and inherit all e32 API action envelopes, the 300-action limit, company context validation, eight-stage careers and proof-derived observations. No database migration, storage-key change, new credential or new action type is required. An e33 verbal follow-up may resolve the existing `verbalV32Continue` effect instead of a terminal family, so ordinary clarification and absurd replies usually resume their suspended work or explicit decision. Escalating replies remain riskier, and a recruitment offer already withdrawn is not silently reinstated. Old e32 seeds retain every original draw, history row, state boundary and achievement/character projection.

Incomplete follow-ups and continuation outcomes do not award terminal verbal badges or completed-game counts. Result-phase replies retain the original committed choice and settle its workday, income and PIP timer once. All ten company branches keep their e32 rules; natural-player company proof fixtures cover every occupation and both sides of each genuinely random decision, while a chosen Vietnam business remains the chosen business. Progress and completion are still derived by canonical server replay, with append-only proofs and idempotent totals.


## Meal invitations (e34)

New lives resolve a seeded reply before entering any of the sixteen dinner scenes. Familiarity and affinity come only from this life’s committed character history, using the actual job’s department after reassignment. Unfamiliar guests, executives and managers in other departments are harder to invite. Real hits and recent hostile exchanges reduce access; imagined hits do not. Neither archive totals nor client-supplied relationship fields affect the draw. Probabilities and reply branches stay hidden until selection.

Invitations, acceptance and refusal cost no money, workday or PIP time. The existing ordinary `choice` action commits one reply and one guest/workday flag; browsing, cancelling or reopening cannot reroll it. A refusal returns to the guest list, with other guests and a guaranteed solo meal still available. The solo meal costs 8 savings (requires more than 8 to preserve living funds), restores resources and creates no shared-dinner or character encounter evidence. Only a committed dinner response charges its displayed fee. No new action type, context shape, credential or database migration is required. The observatory records the cohort as 34.

Published e33 proofs, pending-result boundaries, badges and character projections remain frozen in `tests/fixtures/legacy-e33-routes.json`; earlier cohorts keep their original draws. Canonical e34 invitation proofs cover acceptance and refusal for all sixteen guests, desktop/mobile result pacing, anonymous progress, payment and idempotent completion.

## Character-balanced daily work (e35)

The e35 cohort adds 218 authored daily scenes with `minRules:35`, raising the pool to 681 and every previously underrepresented main speaker to 30 scenes. Private recollections, quiz answers and evidence manifests remain outside the public repository; public events contain only adapted fiction and safe bibliography identifiers. New scenes retain ordinary choice envelopes and existing resource/relationship rules. Explicit, known co-present actors can use a canonical event `participants` array for the existing rage/verbal target picker; mentions and remote correspondents do not imply presence.

The new pure scheduler preserves actual-role buckets and the first-exclusive/two-shared safeguards. It groups a selected bucket by main speaker, gives unseen daily speakers priority, avoids the last speaker when alternatives exist and retains scene weights within the chosen speaker. After a novelty drought it may select another eligible bucket while preserving the two-shared occupational safeguard. Only committed daily history counts; menus and notifications do not manufacture novelty or a workday. All randomness comes from the engine’s seeded generator. e34 and earlier retain the published scheduler and exact replay boundaries.

No new action, run-context shape, credential, database migration or client-authoritative relationship field is introduced. The observatory records e35 as cohort 35. Existing anonymous identity, totals and locked-catalog behavior are preserved; meal affinity remains a projection of resolved choice deltas, separate from invitation RNG.

## Seeded dinner reactions (e36)

Only the two paid responses in each of the sixteen dinner scenes receive a new weighted draw. Target personality, the fixed conversation topic, and current-life familiarity, affinity and recent conflict determine the weights. These inputs are reconstructed from committed history, never client counters or global totals. Looking at a scene does not read or advance RNG; committing the response consumes one seeded draw and reveals a warm, neutral or offended reaction with character-specific fiction. Fees and the existing recovery/ability effects remain attached to the chosen response. Only a dinner with Wing changes his boss-mood stat according to that reaction; other guests cannot change it remotely.

Resolved history carries a bounded `mealOutcome` (`version`, `target`, `replyIndex`, `reaction`, `affinityDelta`). It is not a new request field or run context. Character projection uses this evidence instead of the choice's team-trust delta, clamps personal affinity to 0–100, and records only the actual change. Invitation replies, menu navigation, cancellation and the solo meal create no dinner-affinity evidence. Event/result interruptions preserve an already committed meal, including its one charge and reaction; normal replay remains authoritative for progress, completions, deduplication and aggregate counters.

The observatory recognizes cohort 36 without a database migration. Published e35 paths, including their fixed meal affinity, exact JSON boundaries, character counters and badges, are frozen in `tests/fixtures/legacy-e35-routes.json`. Older anonymous identities and collections remain intact.


## Professor character and third meal page (e37)

The e37 cohort appends `professor` as the seventeenth canonical character and adds 30 daily scenes with `minRules:37`, raising the catalogue from 681 to 711. There are still four fantasy scenes, 805 ending cards and 149 active achievements. The new scripts extend two directly reviewed chronicle themes with player-provided recollections and fictional character settings. Those recollections are creative inputs, not independently verified factual dialogue or biography; the thirty authored situations are not a claim of thirty documented incidents. Private source text and evidence manifests remain outside the public repository.

The four older advisor scenes remain unchanged. Mentioning the professor does not put him in the room or retrospectively create an encounter. Only the e37 eligible scenes and actual in-scene targets enable his new interactions. Existing actual-occupation buckets and the speaker-novelty scheduler still govern ordinary work.

Only e37 can open `meal-guests-c` and `meal-with-professor`. The new menu adds a third page after the original sixteen guests; e36 and earlier retain their two-page menus, context values, choice indices and RNG draws. The existing meal-context keys and ordinary choice/action protocol are retained. Professor invitations and paid conversations have separate seeded reactions, with fees charged only on the committed dinner reply. Menu navigation, cancellation and solo recovery do not create professor affinity. Rage and verbal actions use the canonical scene's actual participants; accepting `professor` as a known HTTP target does not authorize an absent or old-cohort target.

The character snapshot is additive: the original sixteen entries must retain their exact verified counts, and historical lives gain only a professor entry with all seven counters zero. `tests/character-compat.mjs` enforces that comparison without rewriting any historical fixture. `tests/fixtures/legacy-e36-routes.json`, captured from the isolated published commit, preserves 474 natural routes and all 17,860 pending/resolved JSON boundaries, including all 96 table reactions, refusal, cancellation and representative interruptions. The observatory records cohort 37. Anonymous identities, existing totals, storage version 3 and archive tables remain intact; no new credential or personal field is introduced.

## Workplace chapters and explicit departures (e38)

New lives inherit the e37 occupational, professor, meal and relationship rules. Fifteen personal finales that did not end employment now open `chapter-resolution` instead of completing a life. A new-only `chapterContext` stores the committed source history/action positions, family and suspended verbal/rage context. Ordinary choice 0 continues the original decision or work transition once; choice 1 explicitly resigns. The two resource-exhaustion confirmations offer only explicit departure responses. No new action type, probability draw, extra workday, fee or PIP tick is attached to the confirmation. Contexts and their pending choices must match canonical replay after JSON serialization; client-provided contexts, flags or outcomes cannot authorize completion.

The chosen resignation records `departure38_voluntary` in the replayed flags and only then completes the existing thematic ending ID. Speech milestones derive their achievements from the resolved source conversation while the life is still active. Existing career exits state their departure intent in the actual choice/result; an external consultancy starts only after ending the old full-time employment. Company future finales, including the absurd boardroom takeover, remain valid non-departure grand finales. All 805 ending IDs, original ending objects and earlier-cohort replay boundaries are retained.

The ending transition and retrospective copy are display-only. They read the committed final history and milestone reference; acknowledging the final scene does not save or re-submit the life. Reloaded completed lives remain navigable, older workplace chapters are not rewritten into resignations, and a collection containing only ending IDs is never treated as departure evidence. The additional departure classification described above stores only a server-derived coarse category; anonymous ownership, idempotent completion and existing aggregate totals are unchanged.

## e39 public proof and company classifications

The HTTP action envelope also accepts e39 for all existing actions and the five additional public participant IDs. This is only an input envelope: canonical replay still verifies cohort availability, actual scene presence, the selected target and each action's timing. The private administrator card is never an accepted replay participant. Observation rows retain cohort 39 and the inherited eight-stage career scheme; confirmed workplace departures use the same server-derived classification as e38.

The six additional company families add seventy-eight role-specific ending IDs. Closure, Taiwan-team removal and retained-brand/outsourced-service outcomes use `company_exit`; unpaid-wage disputes use `labor_dispute`, with no invented resignation; stagnation and restructuring with continued employment remain `other`. All thirteen aggregate group IDs and the original 805 ending classifications keep their published meaning. A company finale may end the game while the player remains employed; that is separate from a personal workplace chapter, which requires an explicit departure before collection.

## Optional private administrator archive

The public character book shows a generic locked slot. The complete administrator card, private notes and source photos are **not** shipped in static assets or fetched by the public game. The separate administrator API stores the full archive in SQLite. At the author’s request, the hidden visitor’s existing game illustration and eight already-authored fictional office scenes are also used for rare public encounters. Only that selected game content is shipped; there is no runtime dependency on administrator authentication or archived payloads. The public alias, illustration and scenes are inspectable with the game source, while the full private card remains protected. It is excluded from the public character book, filters, rankings, character snapshots and aggregate counters. Merely hiding an imported static module or a public image URL would not protect private material.

| Method | Path | Behavior |
| --- | --- | --- |
| POST | `/api/admin/login` | `{password}`; exact same-origin `Origin`, JSON and `X-Admin-Intent: private-archive` required |
| GET | `/api/admin/session` | Authenticated status, session expiry and session-bound `csrfToken`; 401 when signed out |
| POST | `/api/admin/logout` | Same-origin request with `X-CSRF-Token`; revokes this session and expires its cookie |
| GET | `/api/admin/archive` | Authenticated `{version:1,updatedAt,card}`; `card:null` until imported |
| PUT | `/api/admin/archive` | Authenticated, same-origin, CSRF-checked replacement of the card and portrait in one SQLite statement |
| GET | `/api/admin/portrait` | Authenticated PNG/WebP bytes; no static image URL, redirect or public-cache copy |

Login returns `{authenticated:true,csrfToken,expiresAt}` and a host-only `__Host-private_archive` cookie with `HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=14400`. Sessions last at most four hours, including across restarts. SQLite holds only the random cookie token's SHA-256 hash, a CSRF-token hash, a verifier rotation tag and expiry. The CSRF value can be reconstructed server-side using HMAC and the HttpOnly session cookie, so a reloaded administrator page can request `/session` without storing credentials in localStorage. Changing the verifier invalidates old sessions. Logout revokes the server record as well as the cookie.

Login allows five attempts per client and thirty overall in fifteen minutes, including successful attempts. Durable rate-limit records contain HMAC-derived buckets, counts and expiry, never a raw IP address or password. All private responses, including errors and images, use `Cache-Control: private, no-store`, `Vary: Cookie`, `nosniff` and same-origin resource policy. Foreign/null/missing write origins and cross-site Fetch Metadata are rejected. There is no CORS credential grant; password errors are generic and no raw request, password, cookie or card is logged.

Provision `ADMIN_PASSWORD_VERIFIER` as a **Cloudflare Worker Secret**, never a Wrangler variable, committed file, log or documentation value. Its JSON structure is `{v,iterations,salt,hash}` with version 1, 100000 PBKDF2-SHA256 iterations, a random 16-byte lowercase-hex salt and a 32-byte lowercase-hex derived key. Generate from the exact UTF-8 password bytes offline, and pipe the JSON directly to `wrangler secret put ADMIN_PASSWORD_VERIFIER`; do not print the verifier or password. The chosen iteration count respects the Workers PBKDF2 limit. See [Cloudflare Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/) and [the workerd PBKDF2 limit](https://github.com/cloudflare/workerd/issues/1346). Without a valid server secret all private endpoints fail closed. Existing anonymous-player credentials and storage are separate.

The import body is `{card:{name,title,alias,description,stories},portrait:{mime,base64}}`. Each story has `{title,body}` and optional `choices:[{text,result}]`. Unknown fields, control characters, SVG/HTML image types, mismatched image signatures and malformed base64 are rejected. The image limit is 1 MiB; normalized card JSON is at most 128 KiB, with at most eighty stories and five choices per story. A successful card response adds only the protected `portraitUrl`; it never returns the stored base64. Larger administrator uploads do not change the ordinary public API's 64 KiB request limit. Provisioning payloads and original portraits must remain outside the public checkout or in ignored private files.

`tests/api-admin-private.test.mjs` exercises the actual Worker handlers with isolated SQLite and synthetic content only: authentication, durable rate limits, origin/CSRF checks, hashed sessions, restart/expiry/rotation/logout, protected images, atomic imports, input limits and absence of private content from public counters. No production player, administrator session or private identity is used by these tests.

## Published optional activity chapters (v44 action, historical e39 lives)

The strict action `{type:'activity',version:1,activityId}` opens one of `arm`,
`diet`, `roadshow`, `dinner`, `banquet`, `basketball`, or `review`. These are the
only three accepted keys. It is available only in eligible unanswered e39 daily
work scenes; the canonical engine checks resources, timing, conflicts, the
per-activity lifetime limit and the two-workday cooldown. The original annual
party and optional banquet share the same attendance guard. Reading an invitation
or canceling the UI picker does not create an action or consume RNG.

Stages use ordinary `choice` actions and versioned `activityContext` state. A
committed stage draws exactly once, records the result and actual stat changes,
and waits for Continue. Continuing advances the activity stage or returns to the
unanswered source scene; it does not pay income or move a working/PIP day. Other
side menus cannot be nested during the activity. Resource exhaustion gets an
explicit aftermath instead of a silent departure. Each pending, continued and
returned state is compared with canonical replay, including contexts, scores,
flags, history and RNG. Forged activity state without an authorized operation is
rejected. No database migration, credential, account field or public identity is
added; completion, character and achievement proofs retain their existing
anonymous ownership and validation.

## Scheduled activity invitations (v46, e39-cal46 lives)

New lives use the `e39-cal46-` seed prefix within the existing e39 content cohort.
Their first action must be `{type:'activity-schedule',version:1}`. It activates
the versioned calendar without a draw, stat change, workday or income. The new
calendar suppresses the historical automatic banquet trigger; older action lists
and active v44 activities keep their original behavior.

At safe unanswered daily boundaries, the UI requests the strict action
`{type:'activity-invitation',version:1,eventId}`. The server recomputes which
invitation is due from the seed, actual occupation, turn, seen flags and cooldown.
Neither this request nor any other new input accepts a chosen activity ID.
Historical `activity` actions are rejected for the new calendar prefix. PIP,
personnel notices, watch duty, low resources and active interludes take priority.
Reading or rendering never advances the RNG or opens another invitation.

Each activity has a turn window; the year-end banquet appears only at turns
16–19 (displayed DAY 17–20), with a seeded due turn and final-slot priority.
This is compressed in-game progress, not a real-world month or device clock.
At most three non-banquet invitations plus one banquet can appear per life.
Invitations are marked seen when offered, including declined invitations; normal
offers are separated by two actual work turns. The final banquet slot may
override this cooldown so the year-end notice is not displaced past the year.

Ordinary choice 0 accepts; choices 1 and 2 decline. RSVP history records
`activityInvitationOutcome:{version:1,id,accepted}` and zero deltas. Continue
opens the existing v44 activity context only after acceptance, or restores the
unanswered source after declining. No RSVP changes RNG, income, PIP, time or
fees, and private meal/year-end achievements still require actual attendance.
Pending RSVP, context, flags, selected activity and all later stages must match
canonical replay. The anonymous identity and aggregate schemas are unchanged.

The new calendar also removes four explicit live banquet snippets from both
ordinary work-pool passes so they cannot bypass an RSVP or stage a second party.
Two next-day banquet recollections require completed attendance and late-year
progress. Other daily events, including spring dinners and generic staffing,
retain their eligibility; the historical deck is unchanged.

## Rare hidden encounters (v45 action, e39 lives)

`{type:'hidden-encounter',version:1,eventId}` is a strict three-key action.
Canonical replay verifies the unanswered daily source, deterministic rarity gate,
resources, context conflicts and once-per-life limit before opening it. Merely
checking availability consumes no RNG; opening chooses a scene with one seeded
draw. Stages use ordinary `choice` actions and a canonical
`hiddenEncounterContext`. Each resolved choice records its actual deltas and
`hiddenOutcome`; pending and continued JSON saves are compared with full replay.
The final continuation restores the unanswered source without extra workday,
income or PIP ticks. Client-created contexts, outcomes and invitations are not
trusted. Existing action sequences retain their original behavior.

The public hidden visitor reuses eight previously authored fictional scenes and
the existing game illustration selected by the author. These selected assets
are bundled for all players; there is no runtime access to private payloads,
source photos, credentials or `/api/admin/*`. The full administrator archive
remains separate. The visitor is intentionally outside `PERSONAS` and
`CHARACTER_IDS`, so public character APIs, book filters, rankings and aggregate
metrics remain at twenty-two entries. The local committed story can show the
alias and rare-encounter frame after meeting the visitor. No new identity field,
secret, database table or authentication permission is introduced.

The professor’s new display alias is presentation-only. Canonical engine prose
imports the frozen `publishedDisplayText` function, preserving old histories,
queued proofs and seeds while current UI uses the new alias and short biographies.

## Expanded achievement projection (v48)

The catalogue appends sixty illustrated achievements after the existing 149 IDs.
New goals are read-only projections of committed e39 histories, including ongoing
and completed e39 lives. Older cohorts retain their previous award derivation.
No new rule cohort, game action, random draw, anonymous identifier, API field or
database migration is introduced.

Repeated verbal-survival goals require completed work after the qualifying
speech. A safe return after actual violence requires the same attempt's resolved
follow-up and subsequent work; an unfinished conflict or an imagined attempt is
insufficient. The browser and Worker import the same derivation. Progress proofs
still replay canonical actions before recording unique player/achievement pairs;
supplied badge IDs, flags and histories are discarded by the existing envelope.
Only IDs and first-unlocked dates are added to stored collections. Source story
text, action transcripts and seeds are not retained by the achievement store.

## Gated patronage applications (v49, e39 lives)

New browser lives use `e39-cal46-kin49-` plus sixteen random hexadecimal
characters, retaining the 32-character seed limit and existing calendar rules.
Automatic offers, career-review entry and the actual entry transition all require
lick at least 70 and Wing mood at least 65, in addition to the published tenure,
cooldown and offer-count restrictions. Both existing application checks remain
random and capped below certainty. An opened application finishes normally even
if rejection subsequently lowers Wing mood below the entry threshold.

A submitted application records
`patronageApplicationOutcome:{version:1,result,target:'rick',affinityDelta}` on its
canonical career history row. Appointed and rejected outcomes respectively
request -18 and -12 affinity; cancellation records no such evidence. The shared
projection validates the target, check result, choice and exact evidence shape,
then counts a separate Rick encounter and clamps his actual loss to the remaining
score. Wing's own interaction remains separate. The browser shows the change
only after resolution; verified player and global character totals use the same
projection and existing idempotent replay commitments.

All earlier seeds retain their original eligibility, text, draws and character
totals. No new action type, anonymous identity field, database migration or secret
is introduced. The Worker derives relationships from replayed actions, never
from a submitted history or client-supplied affinity result.


## Between-work rest (v50, e39 lives)

New browser lives use `e39-cal46-kin49-g-` plus fourteen random hexadecimal
characters, preserving the 32-character seed limit, calendar and patronage gates.
A completed work/onboarding turn sets the replay-derived `work_gap_open` flag.
Mandatory personnel, PIP reviews, salary notices and resource crises finish
before the public event can become `work-gap-v50`. This placeholder reveals no
selected next scene, actor, source or outcome.

Only this safe interval accepts `break`; an unanswered event and its pending
result cannot be interrupted by rest. Paid recovery, meals and cancellation
return to the same interval, retaining the existing one-arrangement-per-turn
limit. Career, raise and voluntary exit planning may also return to the interval.
The sole gap choice records the existing `{type:'choice',eventId:'work-gap-v50',
index:0}` envelope and starts the selected work scene without drawing RNG, adding
history, advancing a workday, paying salary or ticking PIP. Activity/hidden
encounter catch-up runs after this choice; NPC conflict actions are unavailable
in the interval. Dream and conversation returns do not create a new interval
before the suspended work is actually completed.

Published earlier seeds retain their exact rest rules and replays. The flag,
interval-start choice and underlying event are checked by canonical replay; a
client cannot remove the interval or address the unrevealed scene directly. No
new HTTP action, database field, anonymous identity or credential is introduced.


## Arm-scene presentation (v51)

The client distinguishes nine existing single-scene arm-wrestling recollections
from the accepted, three-stage `arm` activity. The former receive a passing-scene,
scheduling or replay caption; the latter announces its first unanswered stage,
ongoing stages and already-resolved result separately. No caption opens an
activity, spends a day or supplies a new participant.

The referee-committee scene's known self-directed speech is displayed as a
complaint about competing referees rather than an unrelated work schedule.
Preview, spoken quotation, result, journal and ending explanation share this
read-only correction. Only recognized historical wording is translated, with
committed branch identifiers, reactions, numeric ledgers and unknown appended
notes retained. Canonical histories, actions, RNG, targeting and Worker replay
remain unchanged, so existing lives receive the display correction on reload.


## Contextual dialogue and activity boundaries (v52)

Client speech presentation now preserves explicit scene/participant replies
before adding tone. Fifty-five editorial overrides cover consultant, social and
other known mismatches. Otherwise the fallback addresses only the visible scene
title and the selected speaker's actual quote; incidental body keywords cannot
select a different profession or premise. Other participants do not inherit the
main speaker's words. No unselected response or future draw is read for dialogue.

A quoted history is projected using its original canonical action prefix,
including the preceding pending choice for result-phase speech. This restores
the actual onboarding, salary-advice and raise context rather than applying the
final run's possibly-closed context. Lazy per-row weak caching and a bounded 64-entry exact-prefix cache avoid
repeated replay across immutable later run states. Only visible copy context is
cached, rather than full histories. Unknown or unverifiable historical evidence is kept as-is.
Preview, committed quotation, journal and ending explanation share this renderer;
canonical histories, actions, employment branches, RNG and Worker proofs remain
unchanged. No new API action, storage schema or identity is introduced.

All seven activities and the original three-scene banquet now identify start,
progress, committed scene result and completion. Completion requires the last
scene's own done outcome (or the legacy banquetFinish effect), never merely
viewing the final prompt. A bounded notice at the immediate return explains that
the activity ended; a new action, workday or mandatory interruption hides it.
All captions are read-only and retain hidden choice outcomes and costs.


## Warning-triggered rest (v53, e39 lives)

New browser lives use `e39-cal46-kin49-g-e-` plus twelve random hexadecimal
characters, retaining the 32-character seed limit and the existing calendar,
patronage and between-work rules. After an actual work/onboarding turn,
`work_gap_open` is set only when energy is in the warning range (1–30). Healthy
work continues directly to the next scene. Mood alone does not open this rest
interval, and energy zero retains its mandatory exhaustion aftermath.

A triggered interval stays queued behind mandatory notices and stays open after
recovery, until the player chooses Continue. Returning from rest, a meal or a
canceled plan does not recheck the threshold or manufacture another workday,
paycheck or PIP tick. The existing once-per-work-turn rest allowance still
applies. Unfinished activities and conversations cannot create another interval.

Published seeds keep their original rest timing and canonical proofs. The new
threshold is derived by the shared engine, and the existing full replay
validation rejects a forged interval flag or an unauthorized rest action. No
new action envelope, identifier, database field or credential is introduced.


## Warning opportunity safety (v54, e39 lives)

New browser seeds use `e39-cal46-kin49-g-e-s-` plus ten hexadecimal characters.
Published v53 and older seeds keep their original results. The replay-derived
integer flag `energy54_rest_owed` starts at zero. A transition from energy above
30 into the warning range arms it; recovery above 30 rearms a later episode.

A healthy ordinary work choice loses at most 30 energy in total. If a first
warning occurs inside an activity or mandatory conversation, owed recovery
keeps at least one energy until a usable interval can be offered. The shared
choice hook records every adjustment as `fatigue-buffer` in the actual ledger,
before resource consequences and history are finalized. The buffer does not alter other stats, fees or resolved choice branches, add
random draws, or advance work/PIP counters.

Only a completed workday or fully closed activity, hidden encounter, or required
conversation can surface the waiting gap. Active stages, pending results and
returns to an unfinished rage/verbal conversation cannot open it. A usable
interval clears the owed flag; continuing past that opportunity can still lead
to exhaustion. A rest already used in the same work turn cannot be renewed by
a no-turn interlude; its newly owed warning is protected until the next completed
workday. Paid recovery and cancellation return to the same held interval.

A workday’s queued personnel decision also resumes after a private invitation
or recovery meal closes, using its normal seeded decision once. Fresh private
conversations retain their exclusion from workplace provocations.

Canonical replay verifies the flag, ledger and action availability. No new HTTP
action, player identifier, database schema or credential is introduced.


## Interactive activity controls (v55, e39 lives)

New browser seeds use `e39-cal46-kin49-g-e-s-m-` plus eight random hex digits.
At accepted activity stage 1, the strict action is
`{type:'activity-play',version:1,eventId,index:1,input}`. The shared engine
requires the actual unanswered stage and rejects an ordinary choice bypass.
Preparation and closing scenes retain ordinary choices; historical lives retain
their original action grammar and outcomes.

Inputs have exact keys and bounded integer arrays: arm mode/tap times, seven
fictional meal/exercise days, six visitor assignments, six dish slots, twelve
rhythm beat times, five basketball moves, or four evidence assignments. HTTP
validation checks the same schema under the existing 64 KiB body and 300-action
limits. Canonical replay derives performance from the controls, uses one seeded
draw, and records a compact performance summary in the activity result. Supplied
scores, outcomes, extra fields and duplicate/stale submissions are rejected.
The trace is bounded game input, not an attestation of physical human timing;
untimed accessible modes use logical beat positions.

Controls remain local until submission. The UI cleans timers/listeners when
leaving, cancels an uncommitted timed round on backgrounding, and never submits
a result automatically. A committed result survives refresh and cannot reroll.
Basketball collision risk depends on moves and the existing stage state; a
collision benches the player for the closing scene. All effects use the normal
ledger and v54 fatigue buffer. No workday, salary or PIP tick is added by the
minigame. A warning interval still waits until the complete activity has ended.

Character/achievement/completion endpoints replay the same action, keep anonymous
ownership and idempotent commitments, and ignore client statistics. No new player
identifier, database migration, credential or public raw-control dataset is added.

## Opt-in leaderboards (v56 API, score version 2)

Ranking is independent of game rules and does not change seeds, actions, RNG,
endings, anonymous credentials or existing archive tables. The shared
`dist/leaderboard-score-v56.js` projects a completed canonical replay. Season 1
accepts `e39-cal46-kin49-g-e-s-m-` lives; historical lives may preview a score but
cannot enter this season under their different rules.

The 10,000-point score uses abilities 30% (60% strongest ability, 40% sum capped
at the current 180-point budget), mood/energy 15%, cash 10%, trust/boss/belief 10%,
actual completed work 20%, and a static ending challenge tier 15%. All groups
except completed work are multiplied by `min(completedWork / 19, 1)`, then
rounded separately. Zero-work onboarding exits therefore score zero overall;
raw single-metric boards still show the verified values. Work counts distinct committed
work turns from history, up to 23; onboarding, rest, activities, menu visits and
shortfall jumps do not create work. Every current ending family has a reviewed
fixed tier. Career tiers are capped at `1 + earned promotions`, so a starting
executive title earns no free challenge tier; a random coup has tier 3.
Popularity and good/bad labels never determine challenge. Verbal,
imagined-hit, actual-hit and promotion counters are separate single-metric
boards, not extra overall-score bonuses.

- `GET /api/leaderboard?metric=overall&role=all`: public top 50. Fixed metric and
  actual-role allowlists; every opted-in life ranks independently, including
  multiple lives by the same anonymous owner. Equal selected values receive equal competition ranks
  (`1,1,3`), with total, first publication time and opaque entry ID resolving
  display order. `totalEntries` counts matching published lives; `totalPlayers`
  continues to count their distinct anonymous owners. Existing lower-scoring
  listings remain stored and now participate without a data migration.
- `POST /api/leaderboard`: authenticated opt-in with the normal completion proof
  plus `nickname`. Requires a completed replay, season eligibility and the exact
  owner/role/seed/action commitment. An unsynced valid completion can be recorded
  with its listing in the same completion transaction. A legacy completion
  without its original commitment is never used to guess a score. Posted scores
  or statistics are ignored.
- `GET /api/leaderboard/mine?after=<entryId>`: authenticated own records, 100 per
  page with `nextCursor`/`hasMore`; cursors must belong to that owner. Older
  published entries remain manageable.
- `PATCH /api/leaderboard/<runId>`: authenticated explicit nickname change only;
  preserves scores, public entry ID and first publication time. Cannot republish
  a withdrawn record.
- `DELETE /api/leaderboard/<runId>`: authenticated idempotent withdrawal of an
  owned listing. Completion receipts, collections, achievements and statistics
  remain. Ordinary completion retries never republish a withdrawn listing.

Nicknames are NFKC-normalized and limited to 2–16 Unicode code points; controls,
bidi formatting, markup, URLs and contact-like strings are rejected. Mutations
use the existing origin, bearer authentication, rate and 64 KiB body checks.
Raw proof is replayed transiently. The additive `leaderboard_entries` table
stores owner/run bindings, an opaque public entry ID, nickname, score version,
actual/advertised roles, derived metric numbers and first publication time.
No raw seed, action, dialogue or ending label is stored in this table.

Score v1 opt-in records are upgraded in transactions of at most 100 per public
read, using retained metric numbers and the canonical ending ID in `runs`.
The frozen v1 formula must reproduce the stored total before the v2 formula is
applied. Names, public entry IDs, owner bindings and first publication timestamps
are preserved. While unprocessed rows remain, public reads return 503
`leaderboard_recalculating` with `Retry-After: 1`, rather than mixing score
versions or showing a partially migrated ranking. Malformed evidence is
quarantined from public rankings and remains privately renameable/withdrawable;
no record is silently deleted. Own responses include each row's actual
`scoreVersion`. Resubmitting the exact original replay can also upgrade v1.

Public responses expose only nickname, advertised/actual roles, selected value,
overall score, completed work turns, publication time and opaque entry ID; no
player ID, run ID, ending identity, proof or difficulty hint. Private own-record
responses include run IDs for management. Clearing the anonymous credential can
lose management access; a nickname is not an account or recovery key.

The browser requires an explicit “留名，加入排行榜” action at the ending, with
a short disclosure of public fields and no extra consent checkbox. It supports
skipping, renaming and withdrawal, and never automatically queues a public name for later
posting. Network failures preserve an in-page draft and show an unconfirmed
state; successful state is based on a canonical server receipt. Existing local
collections and completion-sync queues continue independently.

## Employee shares and shareholder hearing (v58)

New browser lives use `e39-cal46-kin49-g-e-s-m-h-` plus six hexadecimal digits,
within the existing 32-character seed limit. Earlier seeds retain their exact
replays. A safe, unanswered ordinary work scene can be suspended by the stock
offer, then a later meeting notice after purchase. PIP, mandatory personnel,
activities, rest intervals, pending results and other conversations take priority.
The calendar must already be enabled. Offers cost 35 or 50 cash index points and
keep a nine-point living buffer. The engine derives ownership and eligibility;
neither a client flag nor a forged context grants attendance. Unrealized shares
remain separate from available cash and leaderboard wealth.

Only the strong attendance replies enter the hearing. Four rounds accept the
strict action `{type:'shareholder-play',version:1,eventId,input}` with exact input
keys `{mode,statement,evidence}`. Modes are `press`, `present` and `yield`;
statement indices are 0–2 and evidence IDs come from a fixed allowlist. A press
can be committed once per statement and may reveal a document. Presenting a
document also requires canonical acquisition and the actual active round.
Clients never provide grades, credibility, pressure, victories or outcomes.
The evidence puzzle rewards the correct statement/document pair; three mistakes
end the hearing. Browsing, selecting a statement and selecting a document remain
local drafts and create no action. There is no timing requirement.

Each committed interaction produces ordinary pending-result history and must be
continued once before the next move. Replay checks context, ownership, the
evidence folder, action schema, scores and all prior committed rows. JSON saves
and cloud proofs use the existing anonymous identity and 300-action limit.
The hearing does not pay salary, spend another workday, tick PIP, or force an
employment ending. All meeting results restore the suspended work scene. Public
statistics retain their existing aggregate behavior; raw dialogue and documents
are not added to server storage. No new secret or database table is required.


## Random recruitment and direct appointment (v60)

New browser profiles use `e39-r60-[nsd]-` and 22 hexadecimal entropy characters,
within the existing 32-character seed limit. This compact profile retains the
calendar, patronage eligibility, warning rest, fatigue buffer, interactive
activities, shareholder hearing and current leaderboard season. Published
profiles retain their exact replay paths. The browser's ordinary-profession bag
continues across rerolls and new applications in the same page session; rare
management and special-appointment tickets are drawn separately. The bag is not
server evidence or a guarantee of human random selection.

Special `s`/`d` profiles derive a fixed ordinary professional record and character
gender from the seed. They do not add role IDs, ending dimensions or public role
filters. The candidate is shown a special vacancy; only reporting reveals the
appointment. Accepting writes the existing patronage structure and salary
formula. Declining ends employment without appointing the character. Two
mandatory introduction scenes then use ordinary choice envelopes and committed
`recruitmentOutcome` rows, with no extra workday, wage or PIP tick. Other menus
cannot interrupt the introductions. Full canonical replay rejects supplied
appointments, genders, relationship deltas, omitted scenes and altered histories.

The 32 new achievements read committed action/history evidence for the shareholder
hearing, interactive activities and special appointments. Character affinity uses
the validated recruitment outcome, keeping Rick's jealousy separate from
Wing's mood and from imagined or actual hits. Existing achievement, character
and completion APIs, anonymous ownership, storage and opt-in rankings remain in
use; no new credential or database migration is required.


## Office treats (v61)

Fresh browser lives use `e39-r61-[nsd]-` plus 22 random hexadecimal characters.
The compact recruitment predicate recognizes both r60 and r61; explicit helper
profile 61 generates the new cohort, while its historical default 60 remains
available. All earlier seeds and stored proofs retain their exact rules.

Three optional workplace interludes suspend an unanswered ordinary work scene.
They open only in their seeded work-turn windows, with a cooldown and each story
limited to once per life. Personnel notices, PIP, active conversations, activities,
resource warnings and recovery intervals take priority. The new `treatsContext`
uses the existing choice action envelope; no free-form server outcome is accepted.
Each submitted choice commits a bounded `treatsOutcome`, the ordinary effect
ledger, seeded mood variation and ability tradeoffs. No additional workday,
paycheck or PIP tick is created, and the player never pays Jack's drink bill.

Company tea cancellation takes effect when the accident scene begins, after the
preceding result is continued. It excludes later company-tea stories while
leaving private drinks, meals and other activities available. The birthday
story establishes the shared photo and Jack's solo struggle before responses.
Completed interludes return to the suspended scene; the client skips optional
catch-up prompts on that one continuation. Other menus cannot interrupt a
started interlude. Unresolved resource consequences remain subject to the
existing fatigue and collapse rules.

Character affinity reads the validated resolved speaker outcome. Nine new badges
require matching committed choices and structured results, with receipt/plan
awards also requiring their final scene. The existing anonymous character,
achievement and completion endpoints replay these actions, enforce ownership,
reject changed steps and deduplicate submissions. No new API endpoint, table,
player identifier or deployment secret is introduced.


## Mood intervals, financed shares and princess meals (v62)

Fresh browser lives use `e39-r62-[nsd]-` and retain the r61 office stories and
previous feature gates. Earlier profiles keep their exact replay rules. Positive
mood at 30 or less can now open the same between-scene recovery interval as low
energy. Ongoing activities, personnel conversations and other owned scenes finish
first. Paid recovery returns to the same interval; zero mood still follows the
existing collapse path. Neither rest nor opening an interval advances work or PIP.

The fifth employee-share offer is r62-only. It spends all current savings on
shares and adds 30 borrowed stat points to the investment. Another 10 borrowed
points remain available for living costs. The fixed fictional financing contract
borrows 40 and owes 48 in total, repaid in four installments of 12 after every four
unique resolved work turns following purchase. Income resolves before repayment.
Menus, activities, rest, repeated continuations and shareholder hearings do not
count as work. Payment never makes cash negative; any shortfall stays owed and
uses the existing cash-exhaustion resolution. Unlisted shares are not spendable
cash, and leaving the company does not erase the outstanding balance. Purchase,
repayment ledger, shares, Wing's resolved reaction and remaining loan are derived
by canonical replay, including pending saves. Earlier seeds reject invented loan
state. The sidebar and ending show the remaining debt separately from savings.

Princess meals cost 52 stat points in r62, disclosed before invitation and before
ordering. Refused or canceled invitations cost nothing. Insufficient funds disable
the purchase; spending exactly the available 52 can reach the existing zero-cash
resolution. Familiarity, invitation rejection and seeded conversation reactions
remain in use, and older profiles retain their original meal prices.

These rules use the existing anonymous proof endpoints and storage. No new
credential, personal-data field or database migration is required.


## Event departure and Roadshow (v63)

Fresh browser lives use `e39-r63-[nsd]-` and inherit the r62 rules. Earlier
profiles keep their existing choices, random draws and replay transcripts.
The new public action is `{type:'event-departure',version:1,eventId}`; `eventId`
is the currently visible scene, including `work-gap-v50` instead of its hidden
next-work pointer. Both HTTP validation and canonical replay enforce this exact
shape, profile, availability and source. No outcome or numeric delta is accepted
from the client.

Departure previews contain only scene-specific wording. Committing resolves one
seeded response and stores a separate `departureOutcome`; pending results cannot
be undone or submitted twice. The pending screen reads the committed history row
instead of inspecting an unrevealed work scene. Finishing departure clears the
owned activity or conversation and resumes its actual parent flow. Draft games
and evidence selections are discarded without submitting them. Completed
employment outcomes remain final.

Leaving ordinary work uses that day without crediting delivered work, income or
loan service. A missed PIP day still consumes its improvement deadline and affects
review. Leaving a private activity or optional conversation does not create an
additional workday, payment or PIP tick. Already confirmed salary, appointment,
spending, shares and debt remain in force; departure is not a refund or a legal
resolution. HR notices and unresolved disputes retain their own consequences.
Declining onboarding is presented as not accepting the appointment and grouped
under the existing observation category `other`, rather than company dismissal.

Departure records are excluded from ordinary-choice achievement predicates and
from action cursors for treat/shareholder evidence. Aborted activities cannot
claim completion or immediately restart. Valid previously earned achievements
remain eligible. Character affinity projects only validated departure targets;
departure is not a spoken outburst, dream hit or actual hit.

The r63 Roadshow retains the six-card raw `matches` input and engine-derived
performance. Its descriptor supplies the current questions, options and staging:
all-company attendance, Meimei hosting and three contrasting speakers. Coffee
costs in the story refer to NT$300 charged by the venue, never 300 savings stat
points or a new player purchase. No new endpoint, identity field, credential or
database migration is required.


## Cast and activity expansion (v65)

Fresh lives use `e39-r65-[nsd]-` and inherit the r63 participation rules.
Historical seed cohorts keep their published event pools, meal pages, random
draws, invitation schedules and transcripts. Six public character IDs are added
to the existing anonymous character store; their gameplay is gated to r65.
No credential, identity field or database migration is introduced.

Camel remains an `activity-play` version 1 action with source index 1. Its exact
input is `{kind:'camel',move:0|1|2,prediction:[0,1,2]}` with a permutation for
`prediction`. The first prediction is locked. Six submissions each reveal one
server-derived color and a 1–3 die; colors are drawn without replacement in
three-color legs. Client-provided dice, points, altered predictions and extra
rounds are rejected. Structured `activityOutcome.camel` records the revealed
board and ranking; `performance` continues to represent only the bounded raw
input, so existing report reconstruction remains compatible. Six rounds are
part of one activity, with no added workday, payroll, loan installment or PIP
tick. Activity points are not cash. Mid-event departure retains resolved rounds
but does not mark the whole activity complete.

The four-stage blockchain interlude uses existing `choice` actions and an owned
context. Its structured outcomes project character affinity only after a reply
is committed. It has explicit start and end notices, can be left early and
returns to the original work scene without re-answering that scene or crediting
a workday. Pending scenes own the screen until continued; recovery and other
side actions cannot interrupt the interlude.

The diet interlude retains its seven-day calendar and uses three different
team introductions. Neither the new activities nor character-book reads reveal
unselected outcomes or change already published achievements. New portraits
are generated cartoons; original reference photographs are not shipped.

## Sharing readiness and additive content (v66)

Fresh browser lives use `e39-r66-[nsd]-` and inherit the previous participation,
recruitment, recovery, loans and calendar rules. Published cohorts retain their
event eligibility, random draws, hidden-story range and canonical transcripts.
The current pool adds 160 independently authored daily stories and 23 hidden
base stories. Character counts exclude old short scenes permanently replaced
by scheduled activities or office treats. Each public character, and the
separately concealed company character, has at least 31 current playable stories.
Run `node scripts/audit-cast-v66.mjs` for the reproducible inventory.

The achievement catalog is now 1,000 IDs. Its original 250 IDs and order remain
unchanged; 750 additive achievements derive only from committed canonical
history. Historical complete histories can qualify for new badges. Frozen-save
tests compare the original badge projection while separately testing additive
awards. Clients cannot post trusted achievement IDs, counts or outcomes. The
server derives the entire catalog without a fixed 250-row limit. Pagination and
filters affect only presentation; locked cards do not load artwork or reveal
names or criteria. Collection import accepts up to 500 KB so a full exported
collection can be restored, while validating known IDs and dates as before.

The current acquisition discussion offers an employee transfer arrangement
independent of the former boss's board seat. A bounded consultant proposal is
available through the real career/exit menu after sufficient high-level work,
resources and experience; choosing to discuss it does not itself end employment.
Both paths use existing strict `choice` actions and explicit later acceptance.
Declining the standard offer at onboarding is presented as an unaccepted
appointment, with departure group `other`. This is a read-only projection of
canonical history, not a new ending ID or altered saved state.

All changes use existing anonymous proof endpoints. Per-run leaderboard entries
retain owner isolation, idempotency and server-derived scores. There is no new
credential, personal-data field or database migration.

## The Moving Island static experience

`/island/` is served from `dist/island/` through the existing static asset binding.
It is a standalone original 3D archipelago with four sea regions: the company
island, after-work life island, remote exile island and Oneira friend island. The company region has
seven department/shared districts; the court, harbor, hospital and police are
on the life island, while exile has its own distant shore. All original nine
district identities plus the three special districts remain stable. There are 29 independently
explorable places (87 choices), thirteen district stories (39 choices), a six-stop
day tour, and all 34 current public colleagues (102 encounter choices).
Walking uses connected paths and bridges within each island, reachable place
entries and a controllable visitor. No inter-island walking surface exists.
Each shore has a visible timber terminal, sheltered waiting area, destination
signs and a moored ferry. Current-island dock labels open the ferry menu in
overview; while walking they become usable within boarding range, independently
of nearby NPC priority. The header ferry control and four dock interactions
share the same departure, voyage and arrival flow. District/place hashes, directory locations, tours and
incident destinations require arrival before opening remote content; the
non-WebGL list retains this flow. A failed voyage leaves the visitor on the
original island. Region and transit state are session-only.

Oneira is a separate fourth island with its own dock, original creative campus
and open-source pavilion. Its two places use the `project` category and add no
official colleague schedules or residency slots. After arriving, explicit links
open only `https://oneirahub.com/harbor?from=moving-island`. The other site offers
the fixed return link `https://hodo.bvivify.com/island/?from=oneira#oneira`.
`friend-islands.js` accepts that public source marker only once, with its matching
hash and no duel invitation. The renderer starts at the Oneira dock and plays
the normal local ferry to the company dock before opening its
content. Failure remains on Oneira; the non-WebGL flow retains the same arrival
gate. The consumed source/hash are removed, so reloading does not replay the
return. No credentials, career proof, player storage or arbitrary redirect URL
are passed between projects. Existing archive, worker, migrations and residency
API schema stay unchanged.
The roster matches `PERSONAS`, includes Alice, and assigns each colleague a department,
staggered pantry breaks and a court or izakaya destination after 18:00. At 19:00,
Aliang (`kind`) invites Jack, Cindy, James and Johnny to the harbor; they stroll
there from 19:30 to 20:00. These authored schedules describe fictional island
characters, not real people's availability. The searchable character directory
and district character buttons also support conversations without WebGL. Hidden anonymous character-book
cards are not revealed by the island roster.
Keyboard and touch controls release movement when interrupted; conversations and
the open district list stop walking. Public resident profiles are loaded from the
approved-only island API described below. Career saved games, collections and
replay validation remain unchanged.

NPC motion is a renderer-independent, bounded local simulation. Changing the island
clock retargets official characters without relocating established bodies; they
walk between districts along terrain-safe routes and wait for occupied paths or
bridges. Cross-island schedules route to a dock, use a bounded ferry transit,
then continue from the destination dock. Characters in transit cannot be
conversed with or located on land; their directory status shows the route.
Approved residents retain their chosen districts and existing slots. All
actors avoid terrain and other bodies, stop near the roaming visitor, and remain
pinned during their own conversation (including one opened from the directory).
The invitation dialogue pins Aliang and has its own response memory. Interaction
targets, name labels and player collision follow current positions rather than
old homes. Directory search, location buttons and district rosters use live
locations, with destinations shown separately during travel. Existing encounter
prose is framed as a recalled island story. Without WebGL, the UI shows planned
activities without claiming live whereabouts.

The island starts at 10:00 and its playback clock advances one game hour per four
real minutes. Manual presets or slider changes pause automatic time; the player
can resume it explicitly. Pause/reduced-motion and hidden tabs stop movement and
the clock without elapsed-time catch-up; open dialogues and guided tours also
hold the automatic clock. Life snapshots drive public activity counts and
character status once per second; positions, schedules, routes, timers and
activities are never uploaded or stored. Changing the displayed time of day does
not advance or reset a career run.

Island exploration reads and writes the browser-local `hedo-island-v1` key. Its version 1
record contains visited district IDs and selected choice indexes (0–2), with no
credentials, free text or dialogue transcripts. Reads and writes project onto
known districts, deduplicate visits and discard invalid indexes or choices for
unvisited districts. If storage is unavailable, exploration remains usable for
the current page session. Clearing browser storage removes these island memories.

The campus redesign preserves that key, all nine district IDs and the version 1
schema. Exploring a district/place or meeting a colleague can mark its district
visited. Old `progress.choices` values remain stored without being reinterpreted
as a response to a rewritten story. New district responses (`districtChoices`),
place responses (`placeChoices`), place visits (`placeVisits`) and NPC responses
(`encounterChoices`), plus the separate invitation responses (`routineChoices`),
live only in page memory. Reloading clears these new visit
memories. Story-challenge victories use the separate local records described
below. No identity or server table is added. Legacy `#court`-style links keep
working through the ferry gate; place hashes such as `#mis-service` open the
matching place without selecting a response. Public
place IDs never enter the application/review API's district-ID schema.

Three.js 0.180.0 and its helpers are bundled locally under MIT; see
`dist/island/THREE-LICENSE.txt`. The island application, dialogue and procedural
geometry are original; no reference-site code or assets are included. A WebGL
fallback retains the list, stories and passport.

After `npm start`, open `http://127.0.0.1:4173/island/`. Run the island checks with
`node --test tests/island-*.test.mjs`, and
the repository checks with `npm test` and `npm run build:check`.


## Island conflicts and temporary dispositions

The island-only conflict model lets visitors argue or fight with the 34 authored
colleagues. Fighting opens an original, browser-local 75-second realtime duel:
movement, combo attacks, invulnerable dodges, charged specials and paper pickups.
The visitor and all 34 colleagues use the same rounded-head, dot-eye, short-limb
canvas character renderer. Public character-book illustrations inform a frozen
per-person trait profile: hair, clothing, glasses and signature props. Combat
poses share this drawing style, while the HUD shows the original portraits
again. Jack uses a new sport-clothing portrait at presentation time; the original
PNG and historical art manifest remain intact. Wing has a half-length left leg
and a cane; Jack wears a black sport T-shirt, grey trousers and trainers in both
island and duel views. These traits do not change collision geometry.

The roster supplies 119 skills, 34 one-use incidents and 34 opening lines, based
on already-public adapted stories and the creator brief. Shared mechanisms are
cone strikes, obstacle-stopped rushes, bounded projectiles, locked circular
targets, slows, interruptible heals and expiring shields. Low-health reactions
take priority. Cooldown and one-use ownership are consumed at windup, including
interrupted recovery. Warnings use the same cast geometry as resolution. Opening
the dossier pauses without stealing focus. Bounded cloned signature history
is session-only and does not enter career proofs or server storage.
Health and actual inputs decide win/loss; an equal-health timeout is a draw with
no holds. An opaque single-use begin/settle/cancel token binds the active opponent,
rejects stale or duplicate completion, and never rerolls the played outcome.
Bounded numerical combat summaries are projected into the session history.
In an ordinary free fight, the loser is assigned
to `hospital-er`, and the winner to `police-desk`. Remote visitor recovery uses
the same ferry gate as exploration. Arguments with the two fictional
bosses may transfer the visitor to `exile-gate` or `cold-palace`. Explicit incident
transfers use collision-safe landings; ordinary schedules still move by walking.
Active NPC dispositions override daily routines and cannot be cleared by changing
the island clock. Facility actions release the visitor or the specific colleague;
released colleagues walk back to their current scheduled destination.

The battle controller owns scoped keyboard/pointer input, animation frames and
resize observation. Hidden/blur pauses and clears held inputs; explicit resume
resets its frame clock without catch-up. Closing before play cancels; after play
starts it offers resume or forfeit. Escape, native dialog close, hash changes and
page teardown cannot leave a detached fight or input owner running. The 2D duel
works independently of WebGL; unavailable 2D rendering cancels the reservation
with a retry option rather than fabricating an outcome.

All incident state, bounded history and holds live only in page memory. Reloading
ends the session. No identity, saved career, server replay, leaderboard, HTTP API,
secret, database table or deployment binding changes. New districts can earn
passport visits in the existing version-1 browser record, while the original nine
district IDs and saved choices remain intact. Applications, review and approved
resident slots stay limited to the original nine districts and 27 total slots;
medical/police/exile locations are not available as community residences. The
non-WebGL list also provides all incident choices, status and recovery actions.

## Island story challenge

The header and colleague dialogues offer a separate story challenge. Five
authored chapters cover all 31 ordinary colleagues. Only actual wins in this
mode unlock the headquarters sequence: Rick, Spencer, then Wing. Every battle
entry, including a headquarters character's ordinary fight button, uses the
same gate and forces the headquarters fight into story mode. Completing that
sequence unlocks an anonymous invitation; its visitor identity, portrait and
abilities stay out of the player interface until the invitation is opened.
The final result has an authored ending. Story bouts are formal sparring and
do not apply the ordinary hospital/police dispositions. An unresolved visitor
or opponent disposition must be handled before beginning another story bout.

`dist/island/challenge.js` owns prerequisite projection, readable openings,
chapter/result stories, next targets and a detached progress snapshot. Opaque
single-use begin/settle/cancel tokens reject stale, foreign and duplicate
callbacks. Loss, draw, cancellation, loading failure and ordinary free-fight
history cannot award story victories. A rematch never counts twice. Reloading
keeps victories but drops any incomplete bout; retrying does not reset the
completed chapters.

This progress is browser-local: `hedo-island-challenge-v1` is a version-1
aggregate, with fixed append-only victory and invitation receipts. The 37
allowlisted storage names live in `dist/island/challenge-storage.js`, which
imports only public roster data, avoiding story or hidden-character imports
in the domain-migration module. Receipts preserve completed wins when a stale
tab writes an older aggregate, and storage events refresh the visible progress.
Storage denial shows a warning while allowing the current in-memory session.
Clearing browser storage removes this challenge progress. The existing
`hedo-island-v1` passport, anonymous bearer, application ownership, career
proofs, collections and server replay are untouched. No challenge endpoint,
server reward, account, database table, binding or deployment secret is added.

Focused checks include `tests/island-challenge.test.mjs` and
`tests/island-challenge-migration.test.mjs`, alongside the regular island tests.

## Island applications and approved residents

The public `/island/` entry includes an application form, live public-profile
preview, owner status/history and withdrawal. `/island/review/` is a separate
administrator queue using the existing private-admin session cookie, login intent
and CSRF token. It never requests the private archive blob or portraits. Admin
credentials stay in session memory; logout, expiry and pagehide clear private UI.
Submissions are enabled only when the existing admin verifier is configured; no
new production secret, binding, Durable Object migration or GitHub workflow is
needed. The UI has no email notifications; applicants return to the same browser
to check the result.

| Method | Path | Access / behavior |
| --- | --- | --- |
| GET | `/api/island/config` | Public enabled flag and field/capacity limits; no verifier data |
| GET | `/api/island/application-summary` | Public `{pending:number}` only; exact pending count, no applicant fields |
| GET | `/api/island/residents` | Approved-only `{version:1,residents}` |
| POST | `/api/island/applications` | Existing anonymous bearer; validated version-1 application; returns 202 `{application}` |
| GET | `/api/island/applications/mine` | Existing bearer; only that owner's receipts |
| DELETE | `/api/island/applications/:id` | Owner only; withdraw pending/approved, repeat withdrawal is idempotent |
| GET | `/api/admin/island-applications?status=pending` | Admin cookie; status filter and optional opaque `after` cursor, 100 per page |
| POST | `/api/admin/island-applications/:id/review` | Admin cookie + same-origin + CSRF; `{decision:'approve'|'reject'|'revoke',note}` |

Applications carry a UUID `submissionId`, `version:1`, `nickname` (2–16 Unicode
code points), `districtId` (one of nine), `outfit` (`teal`, `amber`, `coral`,
`lavender`, `navy`, `cream`), `greeting` (2–80), `introduction` (10–240), private
`reason` (10–500), and `consent:true`. Input is normalized with NFKC and trimmed;
control/hidden characters, markup, URLs and common private-contact patterns are
rejected server-side. Browser drafts remain in page memory. An uncertain receipt
retains the exact request ID/body for an explicit retry; it is never automatically
submitted in the background.

Browsing the roster creates no anonymous player. The separate application client
reads only `hedo-anonymous-v1` when checking the owner; on explicit submission it
reuses or persists a credential and registers via `/api/player`. Blocked storage
prevents submission rather than losing ownership. The career cloud module,
proof queues and caches are never imported, read, flushed or rewritten.

`IslandApplicationStore` lazily creates dedicated SQLite tables in `global-v3`.
It does not use `FeedbackStore` or the GitHub publication outbox. An owner may
have only one pending/approved application. UTC-day quotas are 3 submissions per
owner, 10 per salted network hash and 100 globally; pending queue capacity is 200.
Raw IPs are not stored. Old quota salts/counters are pruned, and rejected/withdrawn
content is deleted on subsequent island access after 90 days. Existing feedback
alarms are untouched. Pending and approved records remain until a review or
withdrawal; pending capacity is bounded. Schema uniqueness and transactions
serialize active-owner checks, review transitions and the three approved slots
per district. Stale decisions return 409; no existing resident is evicted.

Approval creates a separate random public resident UUID. The public projection
contains only that UUID, nickname, districtId, outfit, greeting, introduction and
slot (0–2). Application IDs, owner identity, private reasons and review notes
never appear in public responses. All island API responses use no-store; admin
responses retain the existing private headers. The homepage summary reads only
the aggregate number of pending applications without credentials or storage. It
refreshes every 60 seconds while visible, on returning to the page, and after a
local submission or withdrawal. Zero remains a valid count; failures show an
unknown state instead of a stale or false zero. Summary requests reject foreign
origins and extra query parameters. Withdrawal/revocation removes the
row from the public projection immediately; already-open pages refresh on return
to the tab or via the roster refresh control. The owner's withdrawal also
invalidates in-flight roster reads before refreshing the local scene.

The renderer accepts at most 27 fully validated records, uses predetermined safe
positions, and reuses a bounded set of models. Resident collisions and targets
are separate from the 34 official colleagues. Removing a resident clears its
interaction and obstacle; loading around a player relocates them to a walkable
spot if needed. Conversations reveal the introduction only after a choice, and
resident choices stay in their own in-memory map. The official-encounter counter follows the current roster size; its choices stay
in page memory and the existing island passport schema remains unchanged. The accessible
resident directory and application flow work when WebGL is unavailable.

Tests include actual SQLite routing for owner isolation, idempotency, quotas,
capacity, restart, private-field projection, stale decisions and admin auth/CSRF,
plus public-client retries/storage failures, reviewer session cleanup, and all
27 resident approach positions with existing bridges/entrances preserved. Use
synthetic applications only in local tests, never to seed the production queue.


## Hodo domain migration

The canonical public origin is `https://hodo.bvivify.com`. Its Custom Domain is
attached to the existing `hedo-life` Worker through Cloudflare's dashboard.
Domain bindings are dashboard-managed: `wrangler.jsonc` deliberately omits
`routes` so the deployment token needs no broader zone access. `workers_dev:
true` keeps `https://hedo-life.bvstudio.workers.dev` available as the source of
browser-local migration and as the existing feedback-publisher API origin.
Do not rename the Worker, replace `ARCHIVE`, change the `HedoArchive` namespace,
or change `idFromName('global-v3')` while migrating domains.

`assets.run_worker_first: true` is required. HTML navigations on the old origin
receive a small, private migration document before any game code loads. It
reads only the explicit public-game localStorage allowlist and the session-only
feedback draft, then submits one bounded native multipart form to the new
origin's `POST /_hodo/import`. Only this dedicated route accepts an exact old
`Origin`; normal API same-origin checks stay unchanged. Source and target APIs
and assets remain usable, including by already-open old tabs and the existing
OIDC feedback publisher. Keep `FEEDBACK_AUDIENCE`, publisher base URL and the
publisher's pinned audience consistent; no publisher change is needed here.

The import response safely embeds the validated payload in inert JSON, with
no-store, no-referrer and frame-denying CSP. The Worker does not store migration
payloads, tokens, raw saves or draft text in the archive, or log them. Credentials
never appear in query strings or fragments. The client writes and reads back
all active keys before acknowledging the source with a per-tab random nonce.
A destination receipt prevents interrupted acknowledgements and later visits
from replacing newer progress with the same old snapshot. Local-only digests
separately prevent a changed session draft from replaying old game state.
The source snapshot is never deleted. A pristine destination does not duplicate
the whole source as a backup, preserving localStorage capacity; its original
remains at the old origin. Existing destination copies are backed up before
changes, and differing identities, active saves, sidegames, drafts or divergent
proof queues require the player to choose a copy. Queues belonging to different
anonymous tokens are never combined. Storage/readback/receipt failures stop the
flow without acknowledging success; rollback is attempted and source data stays
available. The committed revision refreshes other open new-origin game tabs
before they can continue from an earlier in-memory identity/save.

The island story challenge's 37 local records participate in the same
allowlist. Compatible copies union valid append-only victory and opened
invitation receipts, plus aggregate victories, without changing anonymous
identity or the existing conflict-choice rules. Different identities are never
combined. Older snapshots and retained backups may omit these optional keys;
they project to null and remain restorable. Null challenge keys are omitted
only from digest calculation, retaining acknowledgement/receipt compatibility
for pre-challenge snapshots. Existing non-null records still affect the digest,
so genuinely new story progress can migrate. Passport records retain their
original bytes and schema.

New-origin first visits also pass through the old origin, before `cloud.js` can
create an anonymous credential. A successful cookie marker skips this round trip
on future visits. An explicit `/_hodo/export` check can reissue a cleared marker
without resetting already-migrated local progress. Private administrator
HttpOnly cookies are host-only and are not transferred; sign in again on the new
origin. The new-origin `/_hodo/recover` page, linked from the game's footer,
allows selecting a retained browser-local backup and first preserves the current
copy. Clearing browser data also clears these browser-local backups.

Verification:

```sh
node --test tests/domain-migration-client.test.mjs tests/domain-migration-server.test.mjs tests/domain-session-guard.test.mjs tests/island-challenge-migration.test.mjs
npm test
npm run build:check
```

The migration changes no engine rules, published replay seeds, anonymous token
format, database schema, achievement IDs, or locked-content presentation.

## GTA street racing leaderboards (v11)

`/gta/` has opt-in, per-course time rankings. It reuses the existing anonymous
bearer, `ARCHIVE` binding and `HedoArchive` SQLite object `global-v3`. No new
Worker, namespace, deployment secret or career replay cohort is required.

| Method | Path | Contract |
| --- | --- | --- |
| GET | `/api/gta/leaderboard?raceId=…` | Public top twenty: `{version,raceId,entries,totalDrivers}`; entries contain only `{driverCode,elapsedMs,position,vehicleId}` |
| GET | `/api/gta/leaderboard/mine` | Existing bearer; this player's driver code and published best receipts, at most one per course |
| POST | `/api/gta/leaderboard` | Existing bearer; exact `{runId,proof}`; returns `{recorded,duplicate,improved,entry,driverCode}` |
| DELETE | `/api/gta/leaderboard?raceId=…` | Existing bearer; withdraw own course best; returns `{removed,raceId}` |

`proof` is `{version:1,raceId,vehicleId,samples}` with bounded `[tick,x,z,speed]`
samples. Fixed steps, a stationary valid start, speed/acceleration bounds,
building intersections, route departure and sequential checkpoint crossings
are checked by the shared `dist/gta/racing-proof.js`. Finish and split times
are derived from the proof, never accepted as caller-supplied scores. At most
6,002 samples cover the longest 100-second route. This is trajectory plausibility
validation, not a full authoritative replay of dynamic traffic, combat and
vehicle physics; local funds, ownership, upgrades and achievements are not
server-authoritative rewards.

The GTA POST uses a streaming 256 KiB body cap; ordinary public JSON endpoints
retain their 64 KiB cap. Existing same-origin, bearer and request-rate guards
apply. All responses remain no-store. New `gta_racers`,
`gta_race_submissions` and `gta_race_bests` tables are created additively in the
existing object. They store an independent random public driver code, player/run
ownership, a canonical proof hash and numeric result receipts. Raw trajectories,
client storage, credentials and career contents are not retained in these tables
or exposed publicly. Best updates and immutable receipts commit atomically.

Each player has one best per course; a slower run does not replace it. Equal
millisecond times share competition ranks (1, 1, 3). Same-ID/same-owner/same-proof
retries return the existing receipt; changing its owner or proof returns 409.
The POST entry describes the submitted run, even when `improved` is false.
Withdrawal removes the public best, preserving its receipt for idempotency;
explicitly resubmitting that same proof can publish it again. Withdrawal never
changes local game funds, personal bests, achievements or saved vehicles.

The browser uploads only after a player's explicit action. Its one-slot
`hedo-gta-ranking-pending-v1` queue binds the exact body to a SHA-256 digest of
the existing token. Network failures retain it for manual retry; another run
cannot overwrite it. This key participates in the existing domain migration,
including conflict detection, without changing the anonymous identity. Public
reads do not create a credential. The in-memory 60-second board cache is
invalidated after publication or withdrawal, including in-flight older reads.
No networking or storage writes run in the driving loop. Local v5 progress
continues accepting v1–v4 saves; achievement cash is replayed locally from
fixed catalog rules and can be claimed only once.

Targeted checks: `node --test tests/gta-racing*.test.mjs
tests/gta-leaderboard-client.test.mjs tests/api-gta-racing.test.mjs`. API tests
exercise isolated real SQLite Durable Objects and synthetic driving proofs;
they must not seed the production rankings. Production smoke runs use actual
browser gameplay and withdraw only their own test rankings afterward.

## GTA daily calendar and weekly rankings (v12)

The existing GTA leaderboard POST also records a weekly best for new evidence.
The week starts Monday 00:00 in Taiwan (UTC+8). The shared
`dist/gta/racing-calendar.js` defines date, week and seven rotating daily targets.
`GET /api/gta/calendar` is public and returns `{version:1,serverNow,dayId,weekId,
previousWeekId,dayStartsAt,dayEndsAt,weekStartsAt,weekEndsAt,dailyChallenge}`;
timestamps are epoch milliseconds. A calendar read never creates an identity.

Public leaderboard GET, authenticated `/mine` GET and authenticated leaderboard
DELETE accept `scope=weekly&weekId=YYYY-MM-DD`. The date must be a Monday and
must identify the server's current or previous week; omitting `weekId` selects
the current week. These responses add `scope:'weekly',weekId`. Default all-time
requests retain the v11 contract. A scope-specific withdrawal changes only that
board, leaving the other boards and local progress intact.

POST input remains `{runId,proof}`. In addition to the v11 receipt, it returns
`weekly:{weekId,improved,entry}` for eligible evidence or `weekly:null` for legacy
or expired evidence. The weekly entry describes the submitted receipt, even
when a faster weekly best is retained. A slower new run may improve the weekly
board while leaving the all-time best unchanged. Both updates, the immutable
receipt and the weekly evidence marker commit in the same SQLite transaction.

Two additive tables, `gta_race_week_entries` and `gta_race_week_bests`, retain
evidence-week bindings and per-player/course/week bests. The first server receipt
time determines the week; there is no claim that the server observes the wall
clock time when an offline race was driven. Retrying the same run or submitting
identical evidence with a new UUID cannot move that evidence into another week.
Pre-v12 receipts are not backfilled into weekly rankings. A withdrawn eligible
receipt may be explicitly republished in its original current/previous week;
older evidence remains available only to the all-time logic. Random driver codes,
public projection, top-twenty limit and competition ranks remain unchanged.
Raw trajectories are still discarded; no new binding, secret, anonymous identity
or career replay rule is introduced.

Daily money remains local game progress. v6 receipts bind a valid finish to its
matching start/end day; a separate fixed-rule reward can be claimed once per
date. Earlier saves never gain invented dates. The browser synchronizes the
calendar when opening the race centre and explicitly shows an offline/device
clock fallback; it does not present local daily funds as server-verified prizes.
All-time, current and previous-week client caches are separate, and mutations
invalidate all cached periods for the course. Nothing polls the network in the
driving loop. No new localStorage key is needed, so existing domain migration
continues preserving the same progress and pending-publication keys.

Validation includes `tests/gta-daily*.test.mjs`,
`tests/gta-weekly-client.test.mjs` and `tests/api-gta-weekly.test.mjs`, alongside
the v11 tests. Calendar boundary tests use controlled clocks only in isolated
models/SQLite tests. Production smoke tests use real browser play and withdraw
their own published results from both current-week and all-time boards.

## Moving Cards anonymous game

`/cards/` combines the existing collection with the v72 deck-building adventure.
It reuses `hedo-anonymous-v1` and `ARCHIVE` / `global-v3`; no new binding,
service, external API, secret or database table is required by the adventure.
There are no purchases or cash redemption. The public catalog and rules live
under `dist/cards/`; `expedition.js` owns the new pure adventure model.

| Method | Path | Authenticated input / response |
| --- | --- | --- |
| GET | `/api/cards` | Existing bearer; `{state}` containing only this player's projected card state |
| POST | `/api/cards/action` | `{requestId,revision,action}`; `{duplicate,appliedRevision,state}` |
| POST | `/api/cards/claim-life` | Exact career proof `{runId,roleId,seed,actions}`; `{ticketsAwarded,duplicate,score,workTurns,state}` |

The stored envelope remains `state.version === 1`. New runs add an optional
`state.expedition` with its own `version:2`, status, current room, borrowed deck,
run-only coins and relics. Its phases are `route`, `battle`, `reward`, `rest`,
`event` and terminal `finished`; status distinguishes `won`, `lost` and
`abandoned`. Existing collection, levels, balances, pity counter, campaign
clears, receipts and private RNG are not reset. Legacy `start-battle`,
`battle-turn` and `abandon-battle` intentions retain their rules. An active
legacy battle must be finished or explicitly abandoned before starting an
adventure. Active adventures also block permanent drawing, crafting, upgrading
and deck replacement until the run ends.

The existing action endpoint additionally accepts these exact intentions:

| Action type | Additional fields |
| --- | --- |
| `start-expedition` | `stage` integer 1–10; `archetype`: `evidence`, `slack` or `lick` |
| `expedition-room` | `choice` 0 or 1, checked against the currently offered routes |
| `expedition-play` | `handIndex` integer 0–9, checked against the current hand |
| `expedition-end-turn` | None |
| `expedition-reward` | `choice` 0–2 for the offered cards, or 3 to skip |
| `expedition-rest` | `choice:'heal'`; or `choice:'upgrade'` plus current deck `cardIndex` |
| `expedition-event` | `choice` 0 or 1 |
| `abandon-expedition` | None |

The API bounds a rest upgrade index to 0–99; the model further checks the actual
run deck, available coins, phase and maximum level. Unknown fields, invented
cards, damage, energy, health, rewards and client-provided outcomes are rejected.
The server decides draw order, reshuffles, drafts, room alternatives and event
results using the existing private seed/counter stream.

Each chapter has five rooms and ends at its final meeting. A starting deck has
13 cards derived from the saved three-character lineup, archetype and equipped
event. Players draw five cards and normally receive three energy per turn; they
may play several cards before ending the turn. Current enemy intent is public,
block expires after the enemy action, and combat is bounded to 20 turns and
20 card plays per turn. The model applies card-order combinations, item passives
and character-specific effects. `getExpeditionCardMeta` and
`getExpeditionItemPassive` supply the current adventure descriptions; legacy
cooldowns and item/event numbers are not adventure tooltips.

Draw order stays private. The public projection removes `battle.drawPile` and
the run's next-instance counter, exposes only sorted draw-pile composition and
counts, and includes the current hand, discard, exhausted cards and current
choices. It never sends future room selections or future drafts. The top-level
private seed/counter remain omitted as before. Card art and catalogs are public;
the browser is not authoritative for combat or rewards.

Borrowed cards, upgrades, relics and coins belong only to the current adventure.
Only the final boss can award permanent tickets/shards, using the existing
stage reward schedule and shared `campaign.completed` first-clear check. A
legacy clear therefore remains cleared in the adventure; repeats, intermediate
wins, drafts, rests and abandonment cannot mint another first-clear reward.
Defeat never removes permanent collection cards. New adventure state is saved
in the existing JSON column and existing practice storage key, so anonymous
ownership and domain migration continue without a new browser key.

Every card mutation requires a UUID request ID and exact current revision.
SQLite transactions serialize concurrent tabs; a different request based on an
old revision receives 409. The same request ID and content never executes twice,
including after a Worker restart. An exact retry returns the current authoritative
state plus its original `appliedRevision`, so it cannot overwrite newer progress.
Reusing an ID with different content receives 409. Receipts are owner-scoped and
persist independently of page memory. Failed mutations roll back state and receipt
together. Existing same-origin checks, no-store headers, streaming JSON limits
and anonymous request throttling apply. Card endpoints permit 30 requests per
10 seconds; the separate career/feedback guard remains at its published
10 requests per 10 seconds. A 429 retains all committed progress and sends
`Retry-After: 10`.

Career rewards are computed from `replayRun` and the current leaderboard score,
never from client-posted scores, stats or workday cursors. At least three actual,
distinct completed work scenes are required. An eligible life earns
`min(12, 1 + floor(score / 1000) + floor(completedWorkTurns / 6))` tickets; lives
with fewer than three earn zero. Every claimed life, including a zero award, has
one immutable receipt. Replaying the same completed life cannot issue more
tickets. A hash-only reservation uniquely binds each player's role and complete
seed to the original run UUID before asynchronous counter updates. Copying the
same proof or a same-seed fork under a different UUID receives 409 before adding
character or achievement counters, including concurrent requests and retries
after restart. Different new-life seeds remain eligible. An interrupted grant
retains its reservation so the original UUID can safely retry. Claiming does not
publish a leaderboard name or reveal a locked ending.

New claims require the exact owner, role, seed hash, ending and full committed
action hash/count. Existing completed proofs with an exact historical commitment
can claim without replacing it or increasing archive counters again. Old receipts
without an action commitment cannot be reconstructed from a matching ending and
are rejected. The final commitment check, new completion/ending insert, ticket
grant and claim receipt share one transaction. Raw career seeds, actions and
transcripts are not retained in the reward receipt. Existing career storage,
proof queues, character counters and anonymous identity are preserved.

Focused verification uses actual SQLite storage, restart and concurrent-request
tests: `node --test tests/api-cards.test.mjs tests/cards-*.test.mjs`.
`tests/cards-expedition.test.mjs` also checks a public-state-only policy,
all-three-archetype chapter witnesses, an all-N lineup that refuses every SSR
borrow, card-order effects, item passives and bounded losses. Deterministic
fixtures and synthetic accounts stay in isolated tests; no test rankings or
career proofs are seeded into production. Model balance samples are documented
in `research/card-redesign-v72.md` and are not population win-rate estimates.

## Captain private voyage (v73)

Fresh exact `e39-r73-[nsd]-[0-9a-f]{22}` career seeds inherit the published
r72 rules and may open one private captain invitation after a completed work
scene. Eligibility uses the rolled character gender and canonical captain
affinity/encounters, not personal data about the anonymous player. A stable
seeded check chooses whether to offer; acceptance is the player's decision.
The four-scene context chooses two distinct outings and stores its return
event. Invitations do not interrupt personnel, PIP, rest or an active activity.

The existing strict `choice`, private conflict and departure action grammar
replays all decisions. No endpoint, binding, secret, identity or database
schema is added. `captainVoyageOutcome` is a bounded, typed history projection
that credits only the actual speaker, once; team trust and weather do not
become extra affection. Scenes do not increment workday, payroll or PIP, and
closing them restores the pending work/gap with resource safeguards. Crew
status has no independent client-submitted reward. Old r72 and earlier proofs
keep their original results; new career UI starts r73. Raw source research,
private identifiers and unverified private-life claims are not shipped.


## New cast profile v74

Fresh browser lives use the strict `e39-r74-[nsd]-[0-9a-f]{22}` profile. It inherits the published v60–v73 rules and enables 156 original source events, including 31 for each of five new public characters. Earlier profiles retain their event pools, RNG and action envelopes. The character projection appends `wine`, `peter`, `tony`, `henry` and `mia` after the existing 29 IDs. The verified cloud snapshot supplies the extended roster; historical offline caches remain historical until a valid snapshot arrives. No anonymous identity, archive key, Durable Object binding, SQL migration or HTTP endpoint changes.

The five dinner guests use a fifth chooser page through the existing `mealPage` and `mealPick` effects. Invitation and dinner replies are server-replayed; no client-supplied affection or random result is accepted. Ordinary new private gatherings use the `private-social` history kind and do not count as completed work, tenure, salary, PIP service or loan repayment. They are excluded during active PIP, queued personnel notices or resource warnings. Closing one marks it seen and arms a same-workday cooldown; normal answers, leaving and conflict aftermath resume the waiting work rules without creating an employment departure. All source IDs, presence checks and consequences remain canonical engine decisions.

The 1,000-card achievement catalog retains its published IDs and art. Its v66 relationship roster is explicitly frozen at the original 28 people, so later character additions do not silently resize or reorder that catalog. Locked names, pictures and choice outcomes stay hidden in player UI. New avatar files and generation prompts are documented in `research/portraits-v74.md`; private photos and raw source material are excluded from the repository.

## Island player-versus-player rooms

The island header opens an invite-only two-player duel. `worker/entry.js`
re-exports the existing default Worker and `HedoArchive` together with the new
`IslandPvpRoom` class. The `ARCHIVE` binding, `global-v3` object name, archive
identity and v1 migration remain unchanged; a separate `ISLAND_PVP` binding and
additive SQLite DO migration own ephemeral rooms.

Authenticated JSON `POST /api/island/pvp/rooms` and
`POST /api/island/pvp/rooms/:code/join` reuse the browser's existing anonymous
bearer and accept only a nickname of up to twelve code points. Same-origin
checks and persisted creation limits bound room creation. An eight-character
Crockford code identifies the room. HTTP responses are private and no-store;
the returned seat ticket is sent only in the first WebSocket frame, never in a
URL, subprotocol, log, invite link, public state or browser persistence.
`GET /api/island/pvp/rooms/:code/socket` requires a same-origin WebSocket upgrade.
Its HTTP handshake passes through the existing Archive with a persisted
SHA-256 IP budget of 240 attempts per ten-minute window, including unknown
rooms, before any room lookup; excess attempts return 429. After admission,
all WebSocket frames are handled only by the room DO.

Each room uses the pure `dist/island/pvp-combat.js` simulation: both sides have
160 HP and identical moves, no NPC AI or hidden character powers. The server
steps combat at 20 Hz and broadcasts snapshots at 10 Hz. Clients send bounded
inputs with increasing sequence numbers and the current match ID; they cannot
supply positions, damage or results. Inputs become neutral after 250 ms without
updates. Per-socket message budgets, a small unauthenticated-socket cap and a
five-second ticket deadline bound inbound work. Replacing a seat connection
invalidates the previous socket's late messages and close events.

Both players must ready before a three-second countdown. A dropped player
neutralizes input and pauses the match for a fifteen-second reconnect grace;
one absent player forfeits, while both absent players cancel without a winner.
A server restart or failed simulation/storage tick cancels an interrupted match
rather than inventing a result. Explicitly leaving a running match forfeits;
leaving a waiting/countdown seat frees it. Both players must request a rematch,
then ready again; a new match ID rejects old-round packets. The room expires
after ten minutes. Waiting/terminal rooms can hibernate. Countdown, active play
and the bounded 15-second reconnect grace retain one interval. During grace,
its callbacks only check deadlines and never advance physics, health or the
battle clock. This preserves the in-memory match through the platform's normal
10-second idle hibernation window; reconnect reuses the interval, and every
terminal path clears it. A true runtime restart still cancels without a winner.
See the [Durable Object lifecycle](https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/).

The player interface uses fixed blue/coral visitor appearances and authoritative
HP/results, with interpolation only for visual movement. Blur clears all held
controls. Pagehide disconnects rather than sending a forfeit; the public
`?duel=CODE` link allows rejoining the same anonymous seat. No story challenge
victories, career actions, archive rewards or island incident dispositions are
awarded by multiplayer. Nicknames and room metadata are isolated from career
saves and removed when the room expires; no public match history is retained.

`node scripts/island-pvp-smoke.mjs --base http://127.0.0.1:4196` exercises real
HTTP admission and two real WebSockets, including third-player rejection,
countdown, input authority, stale-input release, a twelve-second disconnect
and same-match resume with unchanged HP/position/time, forfeit agreement and
public state privacy. It uses temporary anonymous credentials only in memory and
closes both test sockets. Unit tests cover the pure combat model, room/session
lifecycle, request validation, client ownership, keyboard/touch cleanup and the
island modal integration. The standard `npm test` and `npm run build:check`
remain required before publication.

## Career duels and typhoon encounter (v75)

Fresh strict `e39-r75-[nsd]-[0-9a-f]{22}` lives inherit r74 and add one fictional
warehouse-store encounter to the rare hidden pool. Earlier cohorts retain their
pool sizes, random draws, histories and transcripts. The scene's two explicit
participants are available only while actually present; the hidden visitor stays
outside public character cards and counters.

`duel-invite` version 1 accepts exactly `{type,version,eventId,target}`. Canonical
replay verifies the live unanswered source, actual participants, resources,
screen ownership, one invitation per work turn and two invitations per life.
The committed invitation records its seeded acceptance or refusal before another
action may run. Refusals return to the source; accepted invitations own a battle
context and survive JSON saves. No caller can inject a target, score or result.

`duel-play` version 1 accepts exactly `{type,version,eventId,input}` with
`eventId:'duel75-battle'` and input exactly `{frames,forfeit}`. Frames contain at
most 2,251 lowercase hexadecimal byte pairs: nine digital directions and four
buttons. Both the browser's supplied model and server replay use the existing
island brawl at fixed 30 Hz with a canonical per-invitation seed. Pauses add no
simulation time. Invalid directions, extra fields, incomplete fights, frames
after a terminal result and a forged winner are rejected. Only raw controls are
submitted, and the engine derives damage, victory, summary and aftermath. Two
full bouts add under 10 KB to the existing 64 KiB proof envelope.
The v75 combat rules, seeded skill schedule and committed narrative are a replay
contract: future balance/content changes must preserve this version or introduce
a separately gated simulation, rather than changing published recordings.

Two independent seeded aftermath draws determine the player's and opponent's
hospital/police disposition; a clean early surrender does not invent injuries.
Actual absence causes role-specific company handoff problems. Normal `choice`
actions resolve aftercare, with the optional eight-point payment disclosed in
advance and included in the spending ledger. Stat, affinity, real-hit, chart and
leaderboard projections read the committed canonical rows. Returning restores
the original source and any hidden encounter context without answering it,
advancing a workday, paying salary, servicing a loan or consuming PIP. Resource
exhaustion waits for the owned scene's safe return boundary.

Island free-roam conflicts remain visit-local; invitation receipts cannot reroll
a refusal, and actual NPC absence temporarily closes its related company
window until recovery. Story challenge and invite-only PvP remain separate.
The battle renderer uses a large sticky skill banner and bounded procedural
effects; reduced-motion preferences suppress animated visual flourishes.

No endpoint, database migration, credential, anonymous identity or player storage
key is added. The existing anonymous proof APIs perform canonical replay, prefix
ownership checks, deduplication and public projections. Focused checks are
`node --test tests/*duel*v75.test.mjs tests/typhoon-story-v75.test.mjs` in addition
to the standard full test and dry-run build commands.
