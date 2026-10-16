# Picture Scramble — Architecture

This document is the architectural source of truth for the project. All code generation and refactoring should reference and respect these decisions. Update this document whenever a meaningful architectural decision is made.

---

## Core Data Models

### Game
```
id: ObjectId
language: string
solution: string              # correct answer (plaintext, server-only)
solutionHash: string          # SHA-256 hash sent to client for verification
scramble: string              # Fisher-Yates shuffled word
picture: string               # R2 image URL
compliment: string            # AI-generated congratulations message
contact?: Contact             # artist/creator attribution
topic?: string                # optional theme constraint
date_create: Date
date_solve?: Date             # set when player solves the puzzle
date_start?: Date             # set when the game is first shown to a player (unset for unshown preloads)
visitorId?: string            # anonymous visitor (vid cookie) the game was shown to
visitId?: string              # -> Visit the game was shown in
```

### Visit
```
visitorId: string             # anonymous visitor (vid cookie)
startedAt: Date
lastSeenAt: Date              # extended by every event; 30 min idle ends the visit
referrer?: string             # referring site's hostname (other sites only)
utmSource?: string            # ?utm_source= on the landing URL
```

### Word
```
word: string
language: string
imageRef?: ObjectId           # -> Image document
wordImageRef?: string         # legacy reference
uploaded?: boolean            # true if image came from user upload
```

### Image
```
objects: ImageObject[]        # one entry per image stored in R2
wordRef: ObjectId             # -> Word document
wordImageRef?: string         # legacy reference
```

### ImageObject (embedded)
```
key: string                   # R2 object key: img/<sha256 of source bytes>.webp
uploaded: boolean             # true if user-submitted
contact?: Contact             # artist attribution (uploads only)
createdAt: Date
```
- At most 6 images per word (`MAX_IMAGES_PER_WORD`)
- AI generation stops once a word is full; an upload to a full word evicts the oldest non-uploaded image

### Contact (Zod schema, embedded)
```
name?: string
phone?: string
email?: string
[platform]?: string           # dynamic keys (instagram, twitter, etc.)
```

### Relationships
```
Game ---loose join via solution---> Word
Word ---imageRef---> Image
Image ---wordRef---> Word (back-reference)
Image.objects[].key ---> R2 object
Image.objects[].contact ---> Contact (embedded)
```

---

## Essential Flows

### New Game Flow
1. Client calls `GET /api/new-game?score=N&lang=L&topic=T`
2. Server connects to MongoDB (singleton cached connection)
3. `generateWordAndPictureUntilSuccess()` finds or generates a word + image
   - Checks DB for existing word not shown today
   - For a word with stored images, `pickImage()` chooses one (uploads first) and its R2 URL is returned; an extra generated image is made in the background unless the word is full
   - Otherwise generates a new image, stores it in R2 and returns its R2 URL
   - Falls back to OpenAI generation with retry loop
   - After 3 repeats of words shown today, picks random word from local wordlist
   - Gives up and returns 500 after 3 unexpected errors (e.g. OpenAI failures) or 20 attempts in total, so a broken image model can't make a request spin
4. `generateCompliment()` via GPT-3.5-turbo
5. `scramblePhrase()` shuffles the word (Fisher-Yates)
6. `getSHA256Hash()` creates client-verifiable hash
7. Game document saved to MongoDB
8. Response: `{ gameId, scramble, picture, solutionHash, compliment, contact }` — `contact` is the chosen image's artist when it has one, otherwise the default contact

### Solving Flow
1. Player drags SVG tiles to reorder letters
2. After each reorder, client computes SHA-256 of current arrangement
3. If hash matches `solutionHash` -> instant auto-submit (no server round-trip)
4. Manual submit: `GET /api/check-game?gameId=X&playerSolution=Y`
   - Correct: sets `date_solve`, returns compliment, score increments by `puzzleValue`
   - Incorrect: returns `mismatches[]` (indices of wrong characters), `puzzleValue` decrements

### Analytics Flow
1. On page load the client sends `POST /api/game-event {type:"visit", referrer, utmSource}` (once per page load); later events wait for it so a new visitor's cookie is set first
2. Server reads the `vid` cookie (random UUID; created and set on first event, 1 year) and calls `touchVisit()`: extends the visitor's visit if active in the last 30 minutes, otherwise creates a new Visit
3. When a game is shown, client sends `{type:"start", gameId}`; server touches the visit and sets `date_start`, `visitorId`, `visitId` on the game (first event only)
4. On an auto-submit solve the client sends `{type:"solve", gameId, solution}`; the server sets `date_solve` only if the solution matches
5. `getStats(from, to, tz)` unions visits and started games, buckets them by local day, and returns per-day and whole-range visitors, visits, rounds, solves and per-visitor averages. Whole-range visitors are deduplicated, so they are not the sum of the days
6. Viewed at `/stats?key=STATS_KEY` (dashboard; 404 without the key) or `GET /api/stats?key=…&from=&to=&tz=` (JSON). Defaults: last 14 days, America/Los_Angeles
- A **round** is a game that was shown, not a game that was created: preloads that are never shown have no `date_start`

### Pull-to-Submit Gesture
1. Player drags entire tile rack upward toward image
2. If rack overlaps image boundary on release -> triggers manual submit
3. Otherwise snaps back with CSS transition

### Preloading
- Client maintains a queue of 6 pre-fetched games via `usePreloadGames`
- Next game loads instantly from queue; queue refills in background
- Each queued game's picture URL is loaded once up front so the browser has it cached

---

## Architectural Decisions

### State Management
- **No global state library.** All state lives in React hooks.
- `useGame` — central game state (status, score, puzzle data, mismatches)
- `useTileDrag` — tile positions, drag mechanics, reorder logic
- `useRackDrag` — rack-level pull-to-submit gesture
- `usePreloadGames` — background game queue
- Refs (`scoreRef`, `preloadQueue`) used to avoid stale closures and unnecessary re-renders

### Pure Game Logic
- All functions in `src/lib/game/` are pure: no side effects, no DB access, no network calls
- Includes: scramble, hash, mismatches, contact-info parsing, image picking
- These are the easiest to test and must stay pure

### Dependency Injection for OpenAI Functions
- OpenAI orchestration functions accept a `Deps` interface for DB operations
- Enables testing with mock dependencies without mocking modules
- Example: `generateWordAndPictureUntilSuccess(deps: WordAndPictureDeps)`

### Client-Side Hash Verification
- Server never sends the solution to the client
- Client receives only the SHA-256 hash
- Correct answer detected instantly client-side; server confirms on submit
- Prevents cheating via network inspection while enabling instant UX feedback

### Tile System
- SVG-based tiles with computed x/y positioning
- Viewport divided into 11 sections for spacing
- Responsive recalculation on window resize
- Dual interaction modes:
  - **Normal mode:** full list reordering (splice-insert)
  - **Mismatch mode:** swap-only at error positions (correct tiles locked)

### Image Storage
- Polymorphic: supports both AI-generated and user-uploaded images
- Image bytes live in a Cloudflare R2 bucket, served by Cloudflare's CDN from `IMAGE_BASE_URL`; MongoDB holds only keys and metadata
- Images are converted to WebP (quality 85) before upload
- Keys are content hashes, so image URLs are immutable, cacheable forever, and do not reveal the solution
- `createImageStore(storage)` returns `storeImage()` / `findExistingPicture()`; the `ImageStorage` interface (`src/lib/storage/r2.ts`) is injected so tests use an in-memory fake
- `storeImage()` enforces the per-word cap and eviction, and returns the stored image's public URL (or null when nothing was stored)
- Upload endpoint validates with `UPLOAD_KEY`, normalizes to PNG via sharp

### Database Connection
- Mongoose singleton pattern: connection promise cached on `globalThis`
- Prevents connection pool exhaustion in serverless-like environments
- Schema strict mode off for Image model
- Image queries select only `objects` and `wordRef`, so legacy buffer fields are never loaded

### Deployment
- Fly.io via Docker (not serverless) — image generation too slow for cold starts
- Persistent server handles long-running AI calls gracefully

---

## Data Sources & Backend

### MongoDB
**Collections:**
| Collection   | Purpose                    |
|-------------|----------------------------|
| `games`     | Game instances              |
| `words`     | Vocabulary index            |
| `images`    | Image keys and metadata (bytes are in R2) |
| `visits`    | Visitor sessions for analytics |

**Access patterns:**
- Games created on each `/api/new-game` call; `date_solve` updated on correct answer
- Words looked up by language, filtered by "not shown today"
- Image keys retrieved via Word's `imageRef`; uploaded images prioritized over AI-generated

### Cloudflare R2
- One bucket; `img/<hash>.webp` objects are what the app serves, `orig/<hash>.png` holds archived originals from the MongoDB migration
- Configured by `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `IMAGE_BASE_URL`

### OpenAI
- **GPT-3.5-turbo:** word generation, compliment generation
- **`gpt-image-2.5-flare`:** image generation for new words (1024×1024, medium quality, WebP; about $0.013 and 10–13 s per image in October 2026). It returns image data rather than a URL, so images are stored in R2 before being served. DALL-E 3 was shut down by OpenAI on 12 May 2026
- Prompts stored in environment variables with `topic` and `language` placeholders
- Configurable timeouts and retry counts via env vars

### Auth & Security
- No user authentication (anonymous play)
- Upload endpoint protected by `UPLOAD_KEY` env var
- Stats endpoint and page protected by `STATS_KEY` env var (disabled while unset)
- Visitors are identified only by a random first-party cookie; no IPs or personal data stored
- Solution never sent to client (hash-only verification)
- Zod validation on all API inputs and env vars

---

## API Surface

| Method | Route                | Purpose                          |
|--------|---------------------|----------------------------------|
| GET    | `/api/new-game`     | Generate and return a new game   |
| GET    | `/api/check-game`   | Verify player's answer           |
| POST   | `/api/upload`       | Accept user-submitted images     |
| GET    | `/api/default-contact` | Fetch default artist contact  |
| POST   | `/api/game-event`   | Record visit / round start / client-side solve |
| GET    | `/api/stats`        | Visitor/visit/round stats as JSON (needs `STATS_KEY`) |
| GET    | `/stats`            | Stats dashboard page (needs `STATS_KEY`) |

---

## Growth KPIs

The product goal is more active users: bring new players in, keep them past the first visit, and bring them back. These KPIs measure that goal. They are built **one per agent session**: build the first `planned` KPI in table order, then set its status to `done`. The order puts KPIs that need no new tracking first; KPI 9 is the existing baseline.

**Conventions for every KPI**
- Computed in `src/lib/analytics/` against MongoDB, with integration tests (mongodb-memory-server) like `stats.ts`
- Shown on the `/stats` dashboard and returned by `GET /api/stats`, using the dashboard's date range and timezone
- Days are local calendar days in the selected timezone; a visitor is a `vid` cookie, a visit is a `Visit`, a round is a game with `date_start`
- New client tracking goes through `POST /api/game-event`: fire-and-forget, never affects the game, and no personal data (no IPs, no fingerprinting; see Auth & Security)
- A visitor's **first day** is the local day of their earliest `Visit.startedAt`, over all time, not only the selected range

| # | KPI | Definition | Data | Status |
|---|-----|------------|------|--------|
| 1 | Return rate (D1 / D7 / D30) | Of visitors whose first day is D, the share with any visit on day D+1, within D+1..D+7, and within D+1..D+30. Shown as cohort rows by first day; a cohort's figure stays blank until its window has fully passed | Existing `visits` | planned |
| 2 | New vs. returning visitors | Per day: visitors whose first day is that day vs. all other visitors that day | Existing `visits` | planned |
| 3 | Bounce rate and time to first puzzle | Bounce rate: share of visits with no round. Time to first puzzle: time from a visit's start to its first round's `date_start` (median and p90) | Existing for bounce rate; time to first puzzle needs a first-round marker per visit, or the client to report load time | planned |
| 4 | First-visit funnel | For visitors on their first visit: share reaching each step: landed, 1st puzzle shown, 1st solve, 2nd puzzle, 5th puzzle | Rounds and solves per visit (`Game.visitId`); landed = `Visit` exists | planned |
| 5 | Acquisition by source | Visitors, new visitors and return rate (KPI 1) grouped by `utmSource`, falling back to `referrer`, then "direct" | `Visit.referrer` and `Visit.utmSource` (already recorded) | planned |
| 6 | Skip and solve rate by difficulty | Per word length and language: share of rounds solved, share skipped (started, not solved, followed by another round in the same visit) and median time to solve (`date_solve - date_start`) | Mostly existing; skips may need an explicit `skip` event | planned |
| 7 | Sharing | Shares per day and visits arriving from a share. Needs a share button first (e.g. "share my score" with `?utm_source=share`) | New share event and share feature | planned |
| 8 | Mobile vs. desktop | KPIs 1, 3 and 9 split by device class | New: device class (mobile/tablet/desktop, from user agent) on `Visit` | planned |
| 9 | Daily activity (baseline) | Unique visitors, visits / visitor, puzzles played / visitor, puzzles solved / visitor, per day and for the range | Existing | done |

## Next Tasks

**Priority:**
- **B. "Share this puzzle" link.** After solving, the player can share a link that opens the exact puzzle they solved, with Wordle-style text (e.g. "Solved in 14s, can you beat me?") and `?utm_source=share`. No uploads. This feeds Growth KPI 7 (Sharing). Later, depending on share data: let players type a word for a friend and generate the picture (no photo uploads); user photo uploads come last, if ever, because of moderation.

0. Build the next `planned` Growth KPI (one per session; see Growth KPIs)
1. Add language-specific wordlist support (beyond English)
2. Extend game analytics (solve time, attempts, score distribution); visitors, visits, rounds and solves are done
3. Implement difficulty scaling based on player performance
4. Add ARIA labels and keyboard navigation for accessibility
