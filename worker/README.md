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

`runId` must be a UUID. `seed` is 1–32 characters. `actions` is at most 160 entries from the engine's `run.actions`: `{type:'choice',eventId,index}` or `{type:'exit'}`; new `e2-` / `e3-` runs also allow `{type:'break'}`. The server calls `replayRun(roleId,seed,actions)` and accepts only a completed run. Client-supplied endings and scores are ignored. Reusing a committed run ID by its player returns the existing record without increasing counts; a different player receives HTTP 409.

New browser runs use an `e3-` seed prefix, which extends the `e2-` rules for daily mood attrition, PIP without artificial boss recovery, expanded story events, and optional self-care. A break can be opened once per workday from a daily/fantasy event; it records a `break` action followed by a normal `choice` action. The engine validates timing, affordability and return state during replay, so a forged or repeated break is rejected. Spending does not advance the workday or PIP countdown.

Existing `e1-` seeds retain their mid-career optional education conversation; unprefixed v3 seeds retain the earlier schedule. Both keep their original random sequence and outcomes. Ongoing saved games and queued completions remain replayable, and the archive/collection format stays v3. Preserve the complete seed, including its prefix; the maximum length remains 32 characters. The initial expanded events have `minRules:2`; two later chronicle scenes have `minRules:3` and only occur for `e3-` seeds. Published `e2-` seeds retain their 115-scene pool exactly. New events are excluded from older event pools, including the exhausted-pool fallback.

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
