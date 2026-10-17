// Removes the AI images generated between the switch to gpt-image-2.5-flare
// and the prompt fix that stopped them all coming out as muted old-master
// paintings. A word left with no images gets a fresh one on its next play.
//
// Run with: node --env-file=.env.local scripts/remove-muted-images.mjs [options]
//
//   (no options)     List the images that would be removed. Changes nothing.
//   --apply          Remove them from each word's Image document.
//   --delete-files   With --apply, also delete their files from R2. Games keep
//                    the picture URL, so this breaks the picture in old games
//                    and shared links that used one of these images.
//   --since ISO      Start of the window (default: the model switch commit).
//   --until ISO      End of the window (default: now). Run after the prompt
//                    fix is deployed, or set this to its deploy time.
//
// Uploaded images are never touched.

import mongoose from "mongoose";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};

const apply = flag("--apply");
const deleteFiles = flag("--delete-files");
// Commit 8f7c1e9, "Replace retired DALL-E 3 with gpt-image-2.5-flare"
const since = new Date(option("--since") ?? "2026-10-15T21:48:59-07:00");
const until = new Date(option("--until") ?? Date.now());

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

if (Number.isNaN(since.getTime()) || Number.isNaN(until.getTime())) {
  throw new Error("--since and --until must be ISO dates");
}
if (deleteFiles && !apply) {
  throw new Error("--delete-files only works with --apply");
}

let s3 = null;
let bucket = null;
if (deleteFiles) {
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

const inWindow = (o) =>
  !o.uploaded && o.createdAt >= since && o.createdAt < until;

// Connect exactly as the app does, so this reads the same database
await mongoose.connect(requireEnv("MONGO_URI"));
const db = mongoose.connection.db;
const images = db.collection("images");
const words = db.collection("words");

try {
  console.log(
    `Database "${db.databaseName}": AI images created ${since.toISOString()} to ${until.toISOString()}\n`
  );

  const docs = await images
    .find(
      {
        objects: {
          $elemMatch: {
            uploaded: { $ne: true },
            createdAt: { $gte: since, $lt: until },
          },
        },
      },
      { projection: { objects: 1, wordRef: 1 } }
    )
    .toArray();

  const totals = { images: 0, words: docs.length, emptied: 0, removed: 0, filesDeleted: 0 };
  const removedKeys = new Set();

  for (const doc of docs) {
    const word = await words.findOne({ _id: doc.wordRef }, { projection: { word: 1, language: 1 } });
    const matches = doc.objects.filter(inWindow);
    const keys = matches.map((o) => o.key);
    const left = doc.objects.length - matches.length;
    totals.images += matches.length;
    if (left === 0) totals.emptied++;
    console.log(
      `${word ? `${word.word} (${word.language})` : doc._id}: ${matches.length} of ${doc.objects.length} images, ${left} left`
    );
    for (const key of keys) console.log(`  ${key}`);

    if (!apply) continue;
    // $pull is atomic, so images the live app adds meanwhile are kept
    const result = await images.updateOne(
      { _id: doc._id },
      {
        $pull: {
          objects: {
            key: { $in: keys },
            uploaded: { $ne: true },
            createdAt: { $gte: since, $lt: until },
          },
        },
      }
    );
    if (result.modifiedCount === 1) {
      totals.removed += keys.length;
      keys.forEach((k) => removedKeys.add(k));
    }
  }

  if (deleteFiles) {
    for (const key of removedKeys) {
      // Keys are content hashes, so another word could share the same file
      if (await images.findOne({ "objects.key": key }, { projection: { _id: 1 } })) {
        console.log(`Keeping ${key}: still used by another word`);
        continue;
      }
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      totals.filesDeleted++;
    }
  }

  console.log(`\n${apply ? "Done" : "Dry run, nothing changed (pass --apply to remove)"}`);
  console.log(totals);
} finally {
  await mongoose.disconnect();
}
