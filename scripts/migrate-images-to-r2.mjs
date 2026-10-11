// Copies the image buffers stored in MongoDB to Cloudflare R2 and records
// them on each Image document as `objects`. See image-storage-migration.md.
//
// Run with: node --env-file=.env.local scripts/migrate-images-to-r2.mjs [options]
//
//   (no options)     Copy every image and write `objects`. Safe to re-run.
//   --dry-run        Read and convert everything, but upload and write nothing.
//   --sample N       Convert the images of N evenly spaced documents at several
//                    WebP qualities and report sizes. Uploads and writes nothing.
//   --out DIR        With --sample, also save the converted files for viewing.
//   --quality Q      WebP quality for the copy (default 85; keep in sync with
//                    WEBP_QUALITY in src/lib/game/image-store.ts).
//   --verify         Check that every recorded object is reachable at
//                    IMAGE_BASE_URL and that no document is missing objects.
//
// The script only ever $sets `objects`. It never modifies or removes the
// legacy `images` and `uploadedIndexes` fields.

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import sharp from "sharp";
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};

const dryRun = flag("--dry-run");
const verify = flag("--verify");
const sampleSize = option("--sample") ? Number(option("--sample")) : 0;
const outDir = option("--out");
const quality = Number(option("--quality") ?? 85);
const SAMPLE_QUALITIES = [75, 85, 92];
const CACHE_CONTROL = "public, max-age=31536000, immutable";

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

// ---- R2 ---------------------------------------------------------------

const needsR2 = !sampleSize && !dryRun && !verify;
let s3 = null;
let bucket = null;
if (needsR2) {
  bucket = requireEnv("R2_BUCKET");
  s3 = new S3Client({
    region: "auto",
    endpoint: `https://${requireEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
    },
  });
}

async function objectExists(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (err) {
    if (err?.$metadata?.httpStatusCode === 404) return false;
    throw err;
  }
}

// Returns true if the object was uploaded, false if it was already there.
async function putIfMissing(key, makeBody, contentType) {
  if (await objectExists(key)) return false;
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: await makeBody(),
      ContentType: contentType,
      CacheControl: CACHE_CONTROL,
    })
  );
  return true;
}

// ---- Legacy document handling -----------------------------------------

function toBuffer(value) {
  if (Buffer.isBuffer(value)) return value;
  // BSON Binary
  if (value?.buffer) return Buffer.from(value.buffer);
  return null;
}

// Maps legacy uploadedIndexes onto image positions. Entries are either a
// bare integer or { imageIndex, contact }; anything else is reported.
function readUploadedIndexes(doc, imageCount) {
  const uploaded = new Map();
  const malformed = [];
  for (const entry of doc.uploadedIndexes ?? []) {
    const index =
      typeof entry === "object" && entry !== null ? entry.imageIndex : entry;
    const contact =
      typeof entry === "object" && entry !== null ? entry.contact ?? null : null;
    if (Number.isInteger(index) && index >= 0 && index < imageCount) {
      uploaded.set(index, contact);
    } else {
      malformed.push(entry);
    }
  }
  return { uploaded, malformed };
}

// Builds the `objects` entries for a document's legacy buffers, de-duplicated
// by content hash. Each entry carries its source bytes for upload.
function legacyEntries(doc) {
  const images = doc.images ?? [];
  const { uploaded, malformed } = readUploadedIndexes(doc, images.length);
  const createdAt = doc._id.getTimestamp();
  const byKey = new Map();
  let unreadable = 0;

  images.forEach((image, index) => {
    const bytes = toBuffer(image);
    if (!bytes || bytes.length === 0) {
      unreadable++;
      return;
    }
    const hash = createHash("sha256").update(bytes).digest("hex");
    const key = `img/${hash}.webp`;
    const isUploaded = uploaded.has(index);
    const existing = byKey.get(key);
    if (existing) {
      // Same bytes stored twice: keep one, and keep the upload attribution
      if (isUploaded && !existing.entry.uploaded) {
        existing.entry.uploaded = true;
        existing.entry.contact = uploaded.get(index);
      }
      return;
    }
    byKey.set(key, {
      hash,
      bytes,
      entry: {
        key,
        uploaded: isUploaded,
        contact: isUploaded ? uploaded.get(index) : null,
        createdAt,
      },
    });
  });

  return { items: [...byKey.values()], malformed, unreadable };
}

// ---- Modes ------------------------------------------------------------

async function runSample(collection, ids) {
  const step = Math.max(1, Math.floor(ids.length / sampleSize));
  const picked = ids.filter((_, i) => i % step === 0).slice(0, sampleSize);
  if (outDir) await mkdir(outDir, { recursive: true });

  let pngTotal = 0;
  let count = 0;
  const webpTotals = Object.fromEntries(SAMPLE_QUALITIES.map((q) => [q, 0]));

  for (const _id of picked) {
    const doc = await collection.findOne({ _id });
    const { items } = legacyEntries(doc);
    for (const { hash, bytes } of items) {
      const meta = await sharp(bytes).metadata();
      const sizes = [];
      for (const q of SAMPLE_QUALITIES) {
        const webp = await sharp(bytes).webp({ quality: q }).toBuffer();
        webpTotals[q] += webp.length;
        sizes.push(`q${q} ${mb(webp.length)}`);
        if (outDir) {
          await writeFile(path.join(outDir, `${hash.slice(0, 12)}-q${q}.webp`), webp);
        }
      }
      if (outDir) {
        await writeFile(path.join(outDir, `${hash.slice(0, 12)}-original.png`), bytes);
      }
      pngTotal += bytes.length;
      count++;
      console.log(
        `${hash.slice(0, 12)}  ${meta.width}x${meta.height} ${meta.format}  ${mb(bytes.length)}  ->  ${sizes.join("  ")}`
      );
    }
  }

  console.log(`\n${count} images from ${picked.length} documents`);
  console.log(`original: ${mb(pngTotal)} total, ${mb(pngTotal / count)} average`);
  for (const q of SAMPLE_QUALITIES) {
    console.log(
      `webp q${q}: ${mb(webpTotals[q])} total, ${mb(webpTotals[q] / count)} average, ${(pngTotal / webpTotals[q]).toFixed(1)}x smaller`
    );
  }
}

async function runVerify(collection, ids) {
  const baseUrl = requireEnv("IMAGE_BASE_URL").replace(/\/+$/, "");
  let docsWithoutObjects = 0;
  let docsWithUncopiedImages = 0;
  let checked = 0;
  let unreachable = 0;

  for (const _id of ids) {
    // $size avoids pulling the legacy buffers over the network
    const [doc] = await collection
      .aggregate([
        { $match: { _id } },
        {
          $project: {
            objects: 1,
            legacyCount: { $size: { $ifNull: ["$images", []] } },
          },
        },
      ])
      .toArray();
    const objects = doc.objects ?? [];
    if (objects.length === 0) {
      docsWithoutObjects++;
      console.log(`${_id}: no objects (${doc.legacyCount} legacy images)`);
    } else if (objects.length < doc.legacyCount) {
      // Expected only where a document held the same bytes more than once
      docsWithUncopiedImages++;
      console.log(`${_id}: ${objects.length} objects but ${doc.legacyCount} legacy images`);
    }
    for (const { key } of objects) {
      const response = await fetch(`${baseUrl}/${key}`, { method: "HEAD" });
      checked++;
      if (!response.ok) {
        unreachable++;
        console.log(`${_id}: ${key} -> ${response.status}`);
      }
    }
  }

  console.log(
    `\n${ids.length} documents, ${checked} objects checked, ${unreachable} unreachable, ` +
      `${docsWithoutObjects} documents without objects, ` +
      `${docsWithUncopiedImages} documents with fewer objects than legacy images`
  );
  if (unreachable > 0 || docsWithoutObjects > 0) process.exitCode = 1;
}

async function runCopy(collection, ids) {
  const totals = {
    images: 0,
    uploaded: 0,
    alreadyThere: 0,
    docsWritten: 0,
    docsUnchanged: 0,
    docsRaced: 0,
    malformed: 0,
    unreadable: 0,
    pngBytes: 0,
    webpBytes: 0,
  };

  for (const [n, _id] of ids.entries()) {
    const doc = await collection.findOne({ _id });
    const { items, malformed, unreadable } = legacyEntries(doc);
    totals.malformed += malformed.length;
    totals.unreadable += unreadable;
    if (malformed.length > 0) {
      console.log(`${_id}: dropping malformed uploadedIndexes ${JSON.stringify(malformed)}`);
    }
    if (unreadable > 0) {
      console.log(`${_id}: ${unreadable} unreadable image entries skipped`);
    }

    await Promise.all(
      items.map(async ({ hash, bytes, entry }) => {
        totals.images++;
        totals.pngBytes += bytes.length;
        const webp = await sharp(bytes).webp({ quality }).toBuffer();
        totals.webpBytes += webp.length;
        if (dryRun) return;
        await putIfMissing(`orig/${hash}.png`, () => bytes, "image/png");
        const put = await putIfMissing(entry.key, () => webp, "image/webp");
        if (put) totals.uploaded++;
        else totals.alreadyThere++;
      })
    );

    // Keep anything the new application code has already added
    const legacyKeys = new Set(items.map((i) => i.entry.key));
    const existing = doc.objects ?? [];
    const existingByKey = new Map(existing.map((o) => [o.key, o]));
    const objects = [
      ...items.map((i) => existingByKey.get(i.entry.key) ?? i.entry),
      ...existing.filter((o) => !legacyKeys.has(o.key)),
    ];

    const unchanged =
      objects.length === existing.length &&
      objects.every((o, i) => o.key === existing[i].key);
    if (unchanged) {
      totals.docsUnchanged++;
    } else if (!dryRun) {
      // Only write if `objects` is still what we read, so a concurrent write
      // from the live app is never overwritten. A re-run picks up the rest.
      const result = await collection.updateOne(
        { _id, objects: doc.objects === undefined ? { $exists: false } : doc.objects },
        { $set: { objects } }
      );
      if (result.matchedCount === 1) totals.docsWritten++;
      else {
        totals.docsRaced++;
        console.log(`${_id}: changed while copying; re-run to pick it up`);
      }
    }

    if ((n + 1) % 25 === 0 || n + 1 === ids.length) {
      console.log(
        `${n + 1}/${ids.length} documents, ${totals.images} images, ${mb(totals.pngBytes)} -> ${mb(totals.webpBytes)}`
      );
    }
  }

  console.log(`\n${dryRun ? "Dry run complete" : "Copy complete"}`);
  console.log(totals);
  if (totals.docsRaced > 0) process.exitCode = 1;
}

// ---- Main -------------------------------------------------------------

// Connect exactly as the app does, so this reads the same database
await mongoose.connect(requireEnv("MONGO_URI"));
const db = mongoose.connection.db;
const collection = db.collection("images");
const ids = (await collection.find({}, { projection: { _id: 1 } }).sort({ _id: 1 }).toArray()).map(
  (d) => d._id
);
console.log(`Database "${db.databaseName}": ${ids.length} image documents\n`);

try {
  if (sampleSize) await runSample(collection, ids);
  else if (verify) await runVerify(collection, ids);
  else await runCopy(collection, ids);
} finally {
  await mongoose.disconnect();
}
