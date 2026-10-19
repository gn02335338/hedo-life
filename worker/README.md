# Anonymous archive API

Cloudflare Workers serves `dist/` as Static Assets and routes `/api/*` to the Worker first. One `HedoArchive` Durable Object (`global-v3`) owns the SQLite archive. The application does not require D1, KV, external databases, or API secrets.

## Endpoints

| Method | Path | Input | Response |
| --- | --- | --- | --- |
| GET | `/api/health` | — | `{ok:true,version:3}` |
| POST | `/api/player` | `{token}`: browser-generated 64 hexadecimal characters | `{playerId,unlocked,totalRuns}`; repeat registration returns the existing identity |
| GET | `/api/me` | `Authorization: Bearer <token>` | `{playerId,unlocked,totalRuns}` |
| POST | `/api/complete` | Bearer token; `{runId,roleId,seed,actions}` | Player snapshot plus `{runId,endingId,recorded:true,duplicate}` |
| GET | `/api/stats` | — | `{players,totalRuns,uniqueEndings,averageTurns,roles,endings,daily}` |

`runId` must be a UUID. `seed` is 1–32 characters. `actions` is at most 160 entries from the engine's `run.actions`: `{type:'choice',eventId,index}` or `{type:'exit'}`; new `e2-` / `e3-` / `e4-` / `e5-` / `e6-` / `e7-` / `e8-` / `e9-` runs also allow `{type:'break'}`. The server calls `replayRun(roleId,seed,actions)` and accepts only a completed run. Client-supplied endings and scores are ignored. Reusing a committed run ID by its player returns the existing record without increasing counts; a different player receives HTTP 409.

New browser runs use an `e9-` seed prefix, which extends the `e2-` / `e3-` rules for daily mood attrition, PIP without artificial boss recovery, expanded story events, and optional self-care. A break can be opened once per workday from a daily/fantasy event; it records a `break` action followed by a normal `choice` action. The engine validates timing, affordability and return state during replay, so a forged or repeated break is rejected. Spending does not advance the workday or PIP countdown.

Existing `e1-` seeds retain their mid-career optional education conversation; unprefixed v3 seeds retain the earlier schedule. Both keep their original random sequence and outcomes. Ongoing saved games and queued completions remain replayable, and the archive/collection format stays v3. Preserve the complete seed, including its prefix; the maximum length remains 32 characters. The initial expanded events have `minRules:2`; two later chronicle scenes have `minRules:3` and occur for `e3-` / `e4-` / `e5-` / `e6-` / `e7-` / `e8-` / `e9-` seeds. Image-inspired scenes have `minRules:4`; video-inspired scenes have `minRules:5`. Published `e2-`, `e3-` and `e4-` seeds retain their 115-, 117- and 147-scene pools exactly. New events are excluded from older event pools, including the exhausted-pool fallback.

Image scenes may use a `pip` context: the draw pool and its exhausted-pool fallback include these only during active PIP. The mushroom scene does not automatically pass or end PIP. Some `e4-` / `e5-` / `e6-` / `e7-` / `e8-` / `e9-` choices have weighted story outcomes; resolution consumes seeded RNG only after selection and records an `eventOutcome` label for the result and journal. Weights and possible outcomes are not shown before selection. These fields remain local history; server verification derives them by replay.

The `e5-` and newer cohorts apply a text-only copy layer after checks are computed, including resolved check/draw branch text. It never changes probabilities, effects, numeric deltas, flags, IDs, or RNG consumption. Published cohorts retain their original stored text during replay; the browser displays the new 移動人生 name. The save keys, anonymous identity and collection format remain unchanged.

The `e6-` cohort adds a seeded Kind invitation when opening self-care. The invitation never charges automatically. Its paid option requires enough savings and uses the existing self-care recovery RNG; reaching zero savings still uses the normal broke ending. Declining records a zero-cost choice and opens the ordinary self-care menu within the same break. Both menus preserve the work event, workday and PIP countdown; they cannot open a nested break, reroll the invitation or exit midway. Only resolved history exposes costs and gains. Published `e5-` and older replays consume no additional RNG and preserve their complete prior state.

The `e7-` cohort also draws a spontaneous Kind invitation after resolving a daily work event, before the next ordinary work event. It does not interrupt onboarding, crisis notifications, career events or the fantasy finale. A short workday cooldown prevents consecutive invitations. Opening the invitation adds no charge or extra action; replay derives it from the preceding work choice. Accepting counts as that workday’s self-care, while declining returns directly to the waiting work event without using the self-care allowance. Neither choice adds a workday or reduces the PIP countdown. The current workday cannot offer Kind twice through the automatic and manual paths. Only `e7-` and newer saves add `lastKindInviteTurn`; published `e6-` and older states and queued completions remain unchanged.

The `e8-` cohort adds a five-stage career track, separate from the published role ladders: professional staff, deputy manager, manager, director, and C-level/VP. Assistants first regularize; parachute managers enter at rank 2 and may voluntarily step down. Reviews can recur every three workdays from turn 3, with distinct merit/politics requirements, seeded checks, training and deferral choices. Promotions update the actual-role title and salary, followed by a management decision before resuming the waiting work event. Management pressure appears in the resolved delta ledger; reviews and duties do not advance the workday or the PIP timer. Tier-specific endings require actual work/decisions at that tier. Existing endings remain reachable through the legacy career list.

The `e9-` cohort balances the career track without changing published e8 replays. `flags.career_service` counts only resolved daily/fantasy work in the current position, including assistant work. Successful regularization/promotion or voluntary demotion resets it; failed reviews, training, duties, breaks and exit menus do not. Promotion requires 2/3/4/5 actual work turns at staff/deputy/manager/director, with global earliest promotion turns 4/8/13/18. Assistant regularization requires two work turns and turn 3. Review attempts remain at least three work turns apart and stop at turn 20. Director and C-level checks have lower success rates and caps; training adds less skill/flattery. Passing PIP and choosing to remain gives six work turns of crisis cooldown without raising boss mood. Salary proposal timing, cut ranges and negotiation rules are unchanged.

The new departure scenes use only `minRules:8` and public-safe source labels. Their offer-checking, handover and alumni flags unlock additional story exits; rank-limited scenes use `minRank`/`maxRank` only in e8 and later. New career state lives in the existing `flags` object, including the peak rank and per-tier work/duty records. The database schema, anonymous identity, save keys and version-3 replay envelope do not change. All published e8 and older histories keep their original titles, pools, numeric effects and RNG sequences. New ending IDs are appended after the original 144; collection and aggregate queries use the expanded catalog. The frontend career chart counts only the five new tier-ending families, so it does not reinterpret the historical meaning of stored ranks.

The browser displays only resolved history deltas, never future choice effects or odds. New histories contain an actual, clamped `breakdown` for the choice, RNG, boss weather, workday pressure and income; its contributions sum to the recorded net delta. This detail is local save data and is not stored in the archive database.

The bearer token is the anonymous player's recovery credential. The browser should create it with cryptographically secure randomness, keep it locally, and send it only to this origin. The database stores its SHA-256 hash, never the token itself. Clearing local browser data loses access unless the player has retained that token elsewhere; there is no name, email, password, or cross-device account.

## Stored data and limits

- `players`: random player UUID, token hash, creation time.
- `runs`: UUID, player UUID, actual ending, advertised and actual roles, rank, fictional salary, turns, engine version, completion time.
- `player_endings`: unique player/ending pair and first-unlocked time.
- Seed, action history, education, IP, user agent, and name are not stored by this application.
- Public stats contain only aggregates. Role counts use the role selected on entry. Turns match the UI: a first-day exit counts as 1 and the maximum is 24. Daily counts use UTC dates. `players` counts registered anonymous identities, not distinct humans.
- JSON bodies are streamed and capped at 64 KiB. POST requests reject a foreign `Origin` or cross-site fetch metadata; command-line requests without `Origin` remain supported. All API responses use `Cache-Control: private, no-store`.
- A lightweight memory guard allows 10 authenticated/registration requests per token hash per 10 seconds; HTTP 429 includes `Retry-After: 10`. The guard resets when the Durable Object restarts.
- Replay verification rejects basic fabricated results. Users can replay a valid route under a new UUID or create a new anonymous identity. These are recreational statistics, not a competitive leaderboard or unique-human measurement.
- Worker observability is disabled in configuration. No application request-body/token logging is implemented. Cloudflare's service-level processing is separate from these application tables.

## Local verification

From the project root:

```sh
npx wrangler dev --local --ip 127.0.0.1 --port 4174 --inspector-port 9231 --persist-to .wrangler/api-smoke-state
node --test tests/api.test.js
node scripts/api-smoke.mjs
```

The smoke script creates local test players and runs and refuses non-localhost targets. It checks the real Workers/SQLite runtime, static assets, replay validation, duplicate submission, ownership, authentication, request limits, aggregate privacy, and rate limiting. Its local database is separate from production.

The frontend can continue using its local collection if the API is unavailable. Unsent runs remain in the local queue, with automatic retries that back off to at most once per minute. A 500-run queue limit reports a message instead of removing older unsent games. Replays permanently rejected by the server are removed from the upload queue so later valid games can sync; their local ending collection is preserved. Only completed runs with valid v3 replay data can be uploaded; older local collection entries do not have enough evidence to fabricate matching server runs.

## Cloudflare references

Configuration follows [Static Assets Worker-first routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/), [SQLite-backed Durable Object storage](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/), and [SQLite namespace creation](https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-storage/). The `HedoArchive` migration creates a SQLite-backed class, and multi-table completion writes use `transactionSync`.

[Durable Objects permissions](https://developers.cloudflare.com/workers/authorization/durable-objects/) are inherited from the implementing Worker; they have no separate roles or permissions.
