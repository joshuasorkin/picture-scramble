# Picture Scramble — CLAUDE.md

## Project Overview
AI-generated word scramble game ("Utu's Wild Words"). Players unscramble words by dragging SVG tiles, with DALL-E generated art as clues.

## Architecture
- **Framework:** Next.js 15 with App Router, TypeScript strict mode
- **Database:** MongoDB via Mongoose (singleton connection cached on globalThis)
- **AI:** OpenAI GPT-3.5-turbo (words/compliments) + DALL-E 3 (images)
- **Styling:** Tailwind CSS + custom CSS animations
- **Deployment:** Fly.io via Docker (persistent server for slow DALL-E calls)

## Key Patterns
- **API:** Route Handlers in `src/app/api/` (GET/POST with Web Request API)
- **Client state:** React hooks (`useGame`, `useTileDrag`, `useRackDrag`, `usePreloadGames`)
- **Language:** URL param `?lang=Spanish` (no server sessions)
- **Validation:** Zod schemas for env vars, API params, and DB documents
- **Testing:** Vitest + mongodb-memory-server for integration tests

## Commands
- `npm run dev` — Start dev server
- `npm run build` — Production build
- `npm run lint` — ESLint
- `npx vitest run` — Run all tests
- `npx vitest run __tests__/lib/` — Run only lib tests
- `npx vitest run __tests__/api/` — Run only API tests

## Directory Structure
```
src/
├── app/           — Pages and API route handlers
├── components/    — React components (all 'use client')
├── hooks/         — Custom React hooks
├── lib/
│   ├── db/        — Mongoose connection + models
│   ├── openai/    — OpenAI client + generation functions
│   └── game/      — Pure game logic (scramble, hash, mismatches)
├── data/          — wordlist4to9.txt
└── types/         — TypeScript type declarations
```

## Conventions
- Pure functions in `src/lib/game/` — no side effects, easily testable
- OpenAI functions use dependency injection for DB operations
- All components in `src/components/game/` are client components
- Tests mirror source structure in `__tests__/`
- Integration tests use mongodb-memory-server (no test models/collections)

## Testing Strategy
- **Unit tests:** Pure functions (scramble, hash, mismatches, contact-info, env)
- **Integration tests:** API routes + DB operations against mongodb-memory-server
- **Component tests:** TileRack rendering and mismatch styling
- No mocking of internal modules — mock only external services (OpenAI)

## Manual Testing Checklist
- [ ] New game loads with image and scrambled tiles
- [ ] Tiles drag to reorder (touch + mouse)
- [ ] Auto-submit on correct arrangement (SHA-256 hash match)
- [ ] Pull-to-submit works (drag rack over image)
- [ ] Victory animation (360° spin + glitter)
- [ ] Score increments correctly
- [ ] Click to continue → next game
- [ ] Skip button works
- [ ] Contact modal opens/closes with correct info
- [ ] Preloading works (2nd game loads instantly)
- [ ] Language via URL param works (?lang=Spanish)
- [ ] Responsive layout on desktop (max-w-lg centered)
