# Image Storage Migration: MongoDB → Cloudflare R2

Status (2026-10-11): steps 1-4 done. Cluster backed up to `~/backups/atlas-2026-10-11`; all 1,808 images copied to R2 (1,802 unique files, 0.50 GB WebP plus 4.26 GB archived originals) and verified. Step 5 (deploy) in progress. Previous Fly image for rollback: `picture-scramble:deployment-01KNXK30VAG28QC1TF16Z35AQ0`.

## Why

The Atlas bill is about $80/month, all of it for one M10 cluster (`Cluster0`, project `voicemail-chatgpt`, AWS us-west-2). The cluster is paid only because the `images` collection holds 4.3 GB of raw PNG buffers. Everything else on it totals about 5 MB, which fits the free M0 tier (512 MB).

| | Now | After |
|---|---|---|
| Image bytes | MongoDB `images.images[]` (binary PNG) | R2 bucket, served from `img.utuswildwords.com` |
| Image delivery | `/api/image/[word]` returns base64 inside JSON | Browser loads a CDN URL directly |
| Database | Atlas M10, ~$80/month | Atlas M0, free |
| Object storage | none | R2 free tier (10 GB; we need ~5 GB) |

Two side effects worth having:

- The current picture URL is `/api/image/<word>`, so the solution is visible in the network tab. The new URLs are content hashes and reveal nothing.
- Image metadata moves from index-based `uploadedIndexes` (the source of the bug fixed in 75b2a30) to one record per image.

## Target design

### Objects in R2

- Key: `img/<sha256 of the original bytes>.webp`. Content-hash keys make the copy script idempotent and let objects be cached forever (`Cache-Control: public, max-age=31536000, immutable`).
- Format: WebP, converted with `sharp` (already a dependency). The stored PNGs are 0.9–3 MB each; WebP should be several times smaller. The script measures a sample before the full run so the quality setting can be chosen on real numbers.
- Existing originals are also copied unmodified to `orig/<sha256>.png` as an archive the app never reads. This keeps the lossy conversion reversible and still fits the free tier. New images are stored as WebP only.

### `Image` document

```
wordRef: ObjectId
objects: [{
  key: string            # "img/<hash>.webp"
  uploaded: boolean
  contact?: Contact      # only for uploaded images
  createdAt: Date
}]
```

`images` (buffers) and `uploadedIndexes` are removed at the end. The `word_image` collection no longer exists in the database, so the `WordImage` model is deleted too.

### Code changes

| File | Change |
|---|---|
| `src/lib/storage/r2.ts` (new) | `putObject`, `deleteObject`, `publicUrl(key)` using `@aws-sdk/client-s3` against the R2 endpoint |
| `src/lib/game/pick-image.ts` (new) | Pure function: choose an entry from `objects`, preferring uploaded ones (logic lifted from the image route) |
| `src/lib/game/image-store.ts` | `storeImage` converts to WebP, uploads, pushes an `objects` entry. `findExistingPicture` returns `{ url, contact }`. Storage is injected, matching the existing `Deps` pattern |
| `src/lib/openai/generate-picture.ts` | `PictureDeps.findExistingPicture` return type carries the contact |
| `src/app/api/new-game/route.ts` | Returns the R2 URL as `picture` and the image's contact (falling back to the default contact) |
| `src/app/api/image/[word]/route.ts` | Deleted |
| `src/app/api/upload/route.ts` | Unchanged apart from going through the new `storeImage` |
| `src/hooks/useGame.ts` | Drop the base64/JSON branch; preload by URL with `new Image()` |
| `src/lib/env.ts`, `.env.example` | Add `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `IMAGE_BASE_URL` |
| `src/lib/db/models/image.ts`, `word-image.ts` | New schema; delete `word-image.ts` |
| `scripts/migrate-images-to-r2.mjs` (new) | One-off copy script, described below |
| `__tests__/`, `e2e/` | Image tests use an in-memory storage fake (R2 is an external service, so faking it follows the testing rules); e2e mocks return image URLs |
| `architecture.md` | Update data model, new-game flow, image storage section, API table; remove Next Task 5 |

### Per-word image cap

The 15 MB document limit currently acts as the cap on images per word. With R2 that limit disappears, so `storeImage` needs an explicit one: keep at most 6 images per word. AI generation stops once a word is full; an upload to a full word evicts the oldest non-uploaded image and deletes its object.

## Steps

### 1. Account setup (Joshua)

1. Create a Cloudflare account and add `utuswildwords.com` on the Free plan.
2. Check the imported DNS records match Joker's, and set each to **DNS only** (grey cloud) so Fly keeps issuing its own certificates:
   - `A` `@` → `66.241.125.93`
   - `AAAA` `@` → `2a09:8280:1::f7:3a0e:0`
   - `A` `www` → `66.241.125.93`
   - anything else Joker's DNS panel lists
3. If DNSSEC is enabled at Joker, turn it off first. Then change the domain's nameservers at Joker to the two Cloudflare assigns. Wait for Cloudflare to show the domain as Active (usually under an hour, up to a day).
4. Enable R2 (needs a card on file) and create a bucket, e.g. `utus-wild-words`, location hint Western North America.
5. In the bucket settings, add the custom domain `img.utuswildwords.com`.
6. Create an R2 API token with Object Read & Write, scoped to that bucket. Put the account ID, access key ID and secret into `.env.local` under the variable names above. Do not paste them into chat.
7. Run `fly auth login`.
8. Find where the `voice-chatGPT` app is deployed, since its connection string changes in step 6.

`utuswildwords.art` stays on Joker untouched.

### 2. Back up (Claude)

`mongodump` the whole cluster to a local directory (about 5 GB). This is the rollback copy for everything that follows.

### 3. Write the code and the copy script (Claude)

Implement the changes in the table on a branch, with tests passing (`npx vitest run`, `npm run test:e2e`, `npm run lint`). Nothing is deployed yet.

### 4. Copy images to R2 (Claude)

`scripts/migrate-images-to-r2.mjs`, run locally:

- Reads `Image` documents one at a time (they are up to 15 MB each).
- For each buffer: hash it, upload `orig/<hash>.png` and `img/<hash>.webp`, skipping keys that already exist.
- Builds the `objects` array, mapping `uploadedIndexes` onto entries. Both legacy formats (bare integer, `{ imageIndex, contact }`) are handled; out-of-range entries are logged and dropped.
- Writes `objects` with `$set` only. It does not touch `images` or `uploadedIndexes`, so the live app is unaffected.
- Supports `--dry-run` and `--sample N`, and is safe to re-run.

Verification before moving on: every `Image` document has `objects.length === images.length`, every key returns 200 from `img.utuswildwords.com`, and a spot check of a few dozen images looks right.

### 5. Deploy and re-sync (Claude, with Joshua's go-ahead)

1. Set the R2 secrets on Fly and deploy the branch.
2. Re-run the copy script to pick up any images the old code wrote between step 4 and the deploy.
3. Run through the manual testing checklist in `CLAUDE.md` on production, plus an upload.

Rollback at this point is a redeploy of the previous release; MongoDB still holds every buffer.

### 6. Move to a free cluster (Claude, with Joshua's go-ahead)

After a few days of clean running:

1. `$unset` `images` and `uploadedIndexes` on all `Image` documents.
2. Create an M0 cluster in AWS us-west-2 (closest free region to Fly's `sjc`), with the same database user and network access rules.
3. `mongodump` / `mongorestore` the `picture-scramble` and `voice-chatGPT` databases.
4. Update `MONGO_URI` on Fly (and in `.env.local`), deploy, verify.
5. Update the connection string in the `voice-chatGPT` app (Joshua, or Claude if pointed at where it is deployed).
6. Pause the M10 for a week as a safety net, then terminate it. Terminating is what stops the bill.

## Limits of the free cluster

- No managed backups. The data is small, so a scheduled `mongodump` to R2 from GitHub Actions would cover it if wanted.
- Atlas pauses an M0 after 60 days with no connections. A live game keeps it awake.
- Capped at 500 connections and 100 operations per second, far above this app's usage.

## Decisions (2026-10-11)

1. **WebP: yes, quality 85.** Originals are archived under `orig/`. A sample of 18 images averaged 2.35 MB as PNG and 0.28 MB as WebP at quality 85 (8.3x smaller; quality 75 gave 12x, quality 92 gave 6x), which projects the 4.3 GB collection to roughly 0.5 GB.
2. **Extra image generation: stop at the cap.** `generatePicture` only generates another DALL-E image for an existing word while that word has fewer than 6 images.
3. **Other databases.** `voice-chatGPT` is live (last call logged 2026-08-29) and holds 3.8 MB, so it moves to the free cluster and its app needs the new connection string. `tradefidence` is empty and `test` has had no writes since 2023; both are left behind unless Joshua says otherwise.
