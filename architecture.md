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
solveSeconds?: number         # timer value at solve (visible time only), reported by the client (unverified)
date_skip?: Date              # set when the player skips an unsolved round (first skip only)
date_hidden?: Date            # last time the page was hidden during an unsolved round
hideCount?: number            # times the page was hidden during an unsolved round
activeSeconds?: number        # visible time on an unsolved round at its last hide or skip, from the client (unverified)
date_start?: Date             # set when the game is first shown to a player (unset for unshown preloads)
visitorId?: string            # anonymous visitor (vid cookie) the game was shown to
visitId?: string              # -> Visit the game was shown in
sharedFrom?: string           # original Game id, when this game was opened from a share link
shareCount?: number           # times the player tapped Share on this game
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

### ArtStyle
```
style: string                 # gpt-6-luna's description of the art made at a time and place
coordinates: string           # "lat, lon" it was asked about
year: number                  # negative = BCE
createdAt: Date
```
- Every new description is saved; the first games a player waits on reuse a random saved one (see New Game Flow)

### TopicWord
```
topic: string
language: string
word: string                  # unique per (topic, language)
createdAt: Date               # TTL index: the claim expires after 24 hours
```
- Claimed when a topic game's word is picked, not when the game is saved, so requests running at the same time see each other's words

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
   - With a topic, always asks gpt-6-luna for a list of words and picks one, avoiding (in the prompt and when picking) the words claimed on that topic and language in the last 24 hours (`recentTopicWords`). The picked word is claimed at once as a `TopicWord`, before the slow image step, so parallel preload requests can't pick the same word; a failed claim (unique index) means another request took it, and the next word in the same reply is tried. If every usable word is taken, one is reused so a narrow topic still plays
   - Without a topic, checks DB for existing word not shown today
   - For a word with stored images, `pickImage()` chooses one (uploads first) and its R2 URL is returned; an extra generated image is made in the background unless the word is full
   - Otherwise generates a new image, stores it in R2 and returns its R2 URL. Its art style comes from a new gpt-6-luna description of a random time and place, saved as an `ArtStyle`; with `savedStyle=1` a random saved `ArtStyle` is reused instead, saving that call (falls back to a new description when none are saved)
   - Falls back to OpenAI generation with retry loop
   - After 3 repeats of words shown today, picks random word from local wordlist
   - Gives up and returns 500 after 3 unexpected errors (e.g. OpenAI failures) or 20 attempts in total, so a broken image model can't make a request spin
4. `generateCompliment()` via `gpt-6-luna`; falls back to "🎉" on failure so a compliment can never fail the game
5. `scramblePhrase()` shuffles the word (Fisher-Yates)
6. `getSHA256Hash()` creates client-verifiable hash
7. Game document saved to MongoDB
8. Response: `{ gameId, scramble, picture, solutionHash, compliment, contact }` — `contact` is the chosen image's artist when it has one, otherwise the default contact

### Solving Flow
1. Player drags SVG tiles to reorder letters
2. After each reorder, client computes SHA-256 of current arrangement
3. If hash matches `solutionHash` -> instant auto-submit (no server round-trip)
4. Manual submit: `GET /api/check-game?gameId=X&playerSolution=Y`
   - Correct: sets `date_solve` and `solveSeconds` (optional `&solveSeconds=N` param), returns compliment, score increments by `puzzleValue`
   - Incorrect: returns `mismatches[]` (indices of wrong characters), `puzzleValue` decrements

### Share Flow
1. A timer starts at 0:00 when a game is shown and stops on solve (`solveSeconds`); wrong guesses don't stop it. It counts only while the page is visible: `clock` in client state (`src/lib/game/clock.ts`) pauses on `visibilitychange` to hidden and resumes when visible, and a game shown in a background tab starts paused
2. On solve, a "Share this puzzle" button appears under the picture. It builds "I solved this Utu's Wild Words puzzle in X seconds, how about you?" and a link `/?puzzle=<gameId>&lang=L&topic=T&utm_source=share` (`src/lib/game/share.ts`). `lang` and `topic` are the sharer's own URL params, so they carry on to the receiver's later games
3. Phones open the native share sheet (`navigator.share`); elsewhere the message and link are copied to the clipboard. Each tap sends `{type:"share", gameId}`, which increments `Game.shareCount`
4. The receiver's page reads `?puzzle=` once and calls `GET /api/shared-game?id=X`, which **copies** the shared game into a new Game (same picture, scramble and solution, with `sharedFrom` pointing at the original) so the receiver's round, start and solve are tracked separately from the sharer's. A missing or invalid id falls back to a normal new game
5. `?puzzle=` is then removed from the URL with `history.replaceState`, so a reload or the next game doesn't replay it; `?lang=` and `?topic=` stay
6. `generateMetadata()` in `src/app/page.tsx` gives a `?puzzle=` link an Open Graph / Twitter preview with the puzzle's picture (which doesn't reveal the word); any failure falls back to the default metadata

### Analytics Flow
1. On page load the client sends `POST /api/game-event {type:"visit", referrer, utmSource}` (once per page load); later events wait for it so a new visitor's cookie is set first
2. Server reads the `vid` cookie (random UUID; created and set on first event, 1 year) and calls `touchVisit()`: extends the visitor's visit if active in the last 30 minutes, otherwise creates a new Visit
3. When a game is shown, client sends `{type:"start", gameId}`; server touches the visit and sets `date_start`, `visitorId`, `visitId` on the game (first event only)
4. On an auto-submit solve the client sends `{type:"solve", gameId, solution, solveSeconds}`; the server sets `date_solve` and `solveSeconds` only if the solution matches. `solveSeconds` is the timer value the player saw; it is client-reported, so `date_solve - date_start` is the tamper-resistant measure (wall-clock, including time away)
5. When the page is hidden during an unsolved round (another tab, minimized, or closed: browsers fire `visibilitychange` on close too), the client sends `{type:"hide", gameId, activeSeconds}`; the server increments `hideCount` and sets `date_hidden` and `activeSeconds`. Skip sends `{type:"skip", gameId, activeSeconds}` and sets `date_skip`. Both are ignored for rounds that were never shown, are solved or are skipped
6. Client-reported seconds (`solveSeconds`, `activeSeconds`) are validated by `reportedSeconds` (whole seconds, 0 to 24 h); a missing or invalid value is dropped and the event or answer check still goes ahead
7. A round's outcome: **solved** (`date_solve`), **skipped** (`date_skip`), otherwise **abandoned** (left open or closed). `date_hidden` says when an abandoned player last left; the server can't tell a closed tab from one still open in the background
8. `getStats(from, to, tz)` unions visits and started games, buckets them by local day, and returns per-day and whole-range visitors, visits, rounds, solves and per-visitor averages. Whole-range visitors are deduplicated, so they are not the sum of the days
9. Viewed at `/stats?key=STATS_KEY` (dashboard; 404 without the key) or `GET /api/stats?key=…&from=&to=&tz=` (JSON). Defaults: last 14 days, America/Los_Angeles
- A **round** is a game that was shown, not a game that was created: preloads that are never shown have no `date_start`

### Pull-to-Submit Gesture
1. Player drags entire tile rack upward toward image
2. If rack overlaps image boundary on release -> triggers manual submit
3. Otherwise snaps back with CSS transition

### Preloading
- Client maintains a queue of 6 pre-fetched games via `usePreloadGames`
- Next game loads instantly from queue; queue refills in background
- Each queued game's picture URL is loaded once up front so the browser has it cached
- The first 3 requests of a page load (the first game and the 2 preloaded with it) send `savedStyle=1`, since a player may be waiting on them and a new style description adds several seconds to a new image

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
- **`gpt-6-luna`:** word generation, compliment generation (`CHAT_MODEL` in `client.ts`), with `reasoning_effort: "none"` for speed. Without that, reasoning tokens use up the small `max_completion_tokens` budget and the answer comes back empty. Replaced `gpt-3.5-turbo`, which OpenAI shut down on 23 October 2026
- **Word generation asks for a list of 20 and `pickWord()` picks one at random** (single words of 4 to `WORD_LENGTH_MAX` letters). Current models answer "a random word" with the same word nearly every time (e.g. "lantern" 8 out of 8), and raising temperature does not help
- **`gpt-image-2.5-flare`:** image generation for new words (1024×1024, medium quality, WebP; about $0.013 and 10–13 s per image in October 2026). It returns image data rather than a URL, so images are stored in R2 before being served. DALL-E 3 was shut down by OpenAI on 12 May 2026
- **Art style comes from a random time and place.** Asked for "a random historical art style", the image model always drew muted European old-master paintings. Instead `randomArtOrigin()` (`src/lib/game/art-style.ts`) picks a populated place from `src/data/places.json` (Natural Earth, weighted by √population, jittered ~55 km) and a year from 5000 BCE to now (weighted towards recent eras). `describeArtStyle()` asks `gpt-6-luna` (`reasoning_effort: "low"`) what art was made there and then, preferring the culture's most colorful medium (without that, a third of descriptions were dull pottery), and the answer goes into the image prompt. The image model can't place coordinates itself: given them directly, it drew Mediterranean scenes for places like Australia and Patagonia. Each description is saved as an `ArtStyle` for reuse. If the description fails, a fixed `ART_STYLES` list is the fallback. The extra call brings a new image to about 20–30 s. Rebuild the places file with `scripts/build-places.mjs`
- Image prompts ask for vivid color, the word as the clear main subject, and pictures suitable for all ages. OpenAI's output moderation occasionally blocks an image (e.g. nude figures in some traditions); that counts as one of the retry loop's 3 unexpected errors
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
| GET    | `/api/new-game`     | Generate and return a new game (`score`, `lang`, `topic`, `savedStyle=1` to reuse a saved art style) |
| GET    | `/api/check-game`   | Verify player's answer           |
| POST   | `/api/upload`       | Accept user-submitted images     |
| GET    | `/api/default-contact` | Fetch default artist contact  |
| GET    | `/api/shared-game`  | Copy a shared game into a new game for the receiver |
| POST   | `/api/game-event`   | Record visit / round start / client-side solve / share / hide / skip |
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
| 6 | Skip and solve rate by difficulty | Per word length and language: share of rounds solved, share skipped (`date_skip`), share abandoned, and median time to solve (`solveSeconds` for visible time, `date_solve - date_start` for wall-clock) | Existing | planned |
| 7 | Sharing | Shares per day and visits arriving from a share | `Game.shareCount` (per game, not per day: a per-day count needs share timestamps), `Visit.utmSource = "share"`, and games with `sharedFrom` (puzzles opened from a share) | planned |
| 8 | Mobile vs. desktop | KPIs 1, 3 and 9 split by device class | New: device class (mobile/tablet/desktop, from user agent) on `Visit` | planned |
| 9 | Daily activity (baseline) | Unique visitors, visits / visitor, puzzles played / visitor, puzzles solved / visitor, per day and for the range | Existing | done |

## Next Tasks

**Later, depending on share data:** let players type a word for a friend and generate the picture (no photo uploads); user photo uploads come last, if ever, because of moderation.

0. Build the next `planned` Growth KPI (one per session; see Growth KPIs)
1. Add language-specific wordlist support (beyond English)
2. Extend game analytics (solve time, attempts, score distribution); visitors, visits, rounds and solves are done
3. Implement difficulty scaling based on player performance
4. Add ARIA labels and keyboard navigation for accessibility
