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
picture: string               # DALL-E URL or internal /api/image route
compliment: string            # AI-generated congratulations message
contact?: Contact             # artist/creator attribution
topic?: string                # optional theme constraint
date_create: Date
date_solve?: Date             # set when player solves the puzzle
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
images: Buffer[]              # array of PNG buffers (multiple per word)
uploadedIndexes: UploadedIndex[]  # tracks which images are user-submitted
wordRef: ObjectId             # -> Word document
wordImageRef?: string         # legacy reference
```
- 15 MB safety limit per document (under 16 MB BSON cap)
- Oldest non-uploaded images evicted when quota exceeded

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
Image.uploadedIndexes[].contact ---> Contact (embedded)
```

---

## Essential Flows

### New Game Flow
1. Client calls `GET /api/new-game?score=N&lang=L&topic=T`
2. Server connects to MongoDB (singleton cached connection)
3. `generateWordAndPictureUntilSuccess()` finds or generates a word + image
   - Checks DB for existing word not shown today
   - Falls back to OpenAI generation with retry loop
   - After 3 failures, picks random word from local wordlist
4. `generateCompliment()` via GPT-3.5-turbo
5. `scramblePhrase()` shuffles the word (Fisher-Yates)
6. `getSHA256Hash()` creates client-verifiable hash
7. Game document saved to MongoDB
8. Response: `{ gameId, scramble, picture, solutionHash, compliment, contact }`

### Solving Flow
1. Player drags SVG tiles to reorder letters
2. After each reorder, client computes SHA-256 of current arrangement
3. If hash matches `solutionHash` -> instant auto-submit (no server round-trip)
4. Manual submit: `GET /api/check-game?gameId=X&playerSolution=Y`
   - Correct: sets `date_solve`, returns compliment, score increments by `puzzleValue`
   - Incorrect: returns `mismatches[]` (indices of wrong characters), `puzzleValue` decrements

### Pull-to-Submit Gesture
1. Player drags entire tile rack upward toward image
2. If rack overlaps image boundary on release -> triggers manual submit
3. Otherwise snaps back with CSS transition

### Preloading
- Client maintains a queue of 6 pre-fetched games via `usePreloadGames`
- Next game loads instantly from queue; queue refills in background
- Blob URLs for images managed with cleanup on unmount

---

## Architectural Decisions

### State Management
- **No global state library.** All state lives in React hooks.
- `useGame` — central game state (status, score, puzzle data, mismatches)
- `useTileDrag` — tile positions, drag mechanics, reorder logic
- `useRackDrag` — rack-level pull-to-submit gesture
- `usePreloadGames` — background game queue
- Refs (`scoreRef`, `preloadQueue`, `blobUrlsRef`) used to avoid stale closures and unnecessary re-renders

### Pure Game Logic
- All functions in `src/lib/game/` are pure: no side effects, no DB access, no network calls
- Includes: scramble, hash, mismatches, contact-info parsing
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
- Images stored as PNG buffers in MongoDB (not a CDN)
- `storeImage()` handles size management and eviction
- Upload endpoint validates with `UPLOAD_KEY`, converts to PNG via sharp

### Database Connection
- Mongoose singleton pattern: connection promise cached on `globalThis`
- Prevents connection pool exhaustion in serverless-like environments
- Schema strict mode off for Image model (flexible contact fields)

### Deployment
- Fly.io via Docker (not serverless) — DALL-E generation too slow for cold starts
- Persistent server handles long-running AI calls gracefully

---

## Data Sources & Backend

### MongoDB
**Collections:**
| Collection   | Purpose                    |
|-------------|----------------------------|
| `games`     | Game instances              |
| `words`     | Vocabulary index            |
| `images`    | Image storage (PNG buffers) |
| `word_image`| Legacy image cache          |

**Access patterns:**
- Games created on each `/api/new-game` call; `date_solve` updated on correct answer
- Words looked up by language, filtered by "not shown today"
- Images retrieved via Word's `imageRef`; uploaded images prioritized over AI-generated

### OpenAI
- **GPT-3.5-turbo:** word generation, compliment generation
- **DALL-E 3:** image generation for new words
- Prompts stored in environment variables with `topic` and `language` placeholders
- Configurable timeouts and retry counts via env vars

### Auth & Security
- No user authentication (anonymous play)
- Upload endpoint protected by `UPLOAD_KEY` env var
- Solution never sent to client (hash-only verification)
- Zod validation on all API inputs and env vars

---

## API Surface

| Method | Route                | Purpose                          |
|--------|---------------------|----------------------------------|
| GET    | `/api/new-game`     | Generate and return a new game   |
| GET    | `/api/check-game`   | Verify player's answer           |
| GET    | `/api/image/[word]` | Fetch image for a word           |
| POST   | `/api/upload`       | Accept user-submitted images     |
| GET    | `/api/default-contact` | Fetch default artist contact  |

---

## Next Tasks

1. Add language-specific wordlist support (beyond English)
2. Track game analytics (solve time, attempts, score distribution)
3. Implement difficulty scaling based on player performance
4. Add ARIA labels and keyboard navigation for accessibility
5. Move image serving to a CDN instead of base64 from MongoDB
