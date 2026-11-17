// Removes the saved art styles, and the AI images drawn with them, that came
// out as Buddhist or Hindu temple murals: haloed deities and celestial figures
// among clouds and lotuses. The style prompt chose that look for most of
// Chinese, Indian and Himalayan history, so players kept seeing it. A word
// left with no images gets a fresh one on its next play.
//
// Images don't record their style, so a vision model looks at each AI image
// made since styles were first saved and says whether it's in that style.
//
// Run with: node --env-file=.env.local scripts/remove-mural-images.mjs [options]
//
//   (no options)     List the styles and images that would be removed.
//                    Classifies the images (OpenAI calls) but changes nothing.
//   --apply          Delete the styles and remove the images from each word's
//                    Image document.
//   --delete-files   With --apply, also delete the image files from R2. Games
//                    keep the picture URL, so this breaks the picture in old
//                    games and shared links that used one of these images.
//
// Uploaded images are never touched.

import mongoose from "mongoose";
import OpenAI from "openai";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const deleteFiles = args.includes("--delete-files");
if (deleteFiles && !apply) {
  throw new Error("--delete-files only works with --apply");
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const CHAT_MODEL = "gpt-6-luna";
const CONCURRENCY = 8;

// Religious-figure murals and paintings; the second test keeps out murals
// that only share a word, like Maya or Teotihuacan ones
const MURAL_STYLE = /(Buddhist|temple|cave|deit|bodhisattva|Buddha|celestial|apsara)/i;
const MURAL_MEDIUM = /(mural|wall painting|lotus|cloud|thangka|paubha|silk painting|palm-leaf|stucco|relief)/i;
const NOT_THE_LOOK = /(Teotihuacan|Maya|Kofun|cotton textile)/i;
const isMuralStyle = (style) =>
  MURAL_STYLE.test(style) && MURAL_MEDIUM.test(style) && !NOT_THE_LOOK.test(style);

const QUESTION =
  "Is this picture drawn in the style of an East or South Asian Buddhist or Hindu temple, cave or tomb mural or religious painting (thangka, paubha, palm-leaf, Buddhist silk painting), for example with haloed deities, bodhisattvas or celestial figures among clouds and lotuses? Answer only yes or no.";

const openai = new OpenAI();
const imageBase = requireEnv("IMAGE_BASE_URL").replace(/\/$/, "");

async function isMuralImage(key) {
  const response = await openai.chat.completions.create({
    model: CHAT_MODEL,
    reasoning_effort: "low",
    max_completion_tokens: 500,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: QUESTION },
          { type: "image_url", image_url: { url: `${imageBase}/${key}`, detail: "low" } },
        ],
      },
    ],
  });
  return /^\s*yes/i.test(response.choices[0]?.message?.content ?? "");
}

// Runs fn over items, a few at a time
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i], i);
      }
    })
  );
  return results;
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

// Connect exactly as the app does, so this reads the same database
await mongoose.connect(requireEnv("MONGO_URI"));
const db = mongoose.connection.db;
const artStyles = db.collection("artstyles");
const images = db.collection("images");
const words = db.collection("words");

try {
  console.log(`Database "${db.databaseName}"\n`);

  // Styles
  const styles = (await artStyles.find({}, { projection: { style: 1, createdAt: 1 } }).toArray())
    .sort((a, b) => a.createdAt - b.createdAt);
  const muralStyles = styles.filter((d) => isMuralStyle(d.style));
  console.log(`Styles: ${muralStyles.length} of ${styles.length} are murals`);
  for (const d of muralStyles) console.log(`  ${d.style.slice(0, 110)}`);

  // Images made since styles were first saved; older images used fixed styles
  const since = styles[0]?.createdAt ?? new Date();
  const docs = await images
    .find(
      { objects: { $elemMatch: { uploaded: { $ne: true }, createdAt: { $gte: since } } } },
      { projection: { objects: 1, wordRef: 1 } }
    )
    .toArray();
  const candidates = docs.flatMap((doc) =>
    doc.objects
      .filter((o) => !o.uploaded && o.createdAt >= since)
      .map((o) => ({ doc, key: o.key }))
  );
  console.log(`\nClassifying ${candidates.length} AI images made since ${since.toISOString()}...`);

  let failed = 0;
  const verdicts = await mapLimit(candidates, CONCURRENCY, async ({ key }) => {
    try {
      return await isMuralImage(key);
    } catch (err) {
      failed++;
      console.error(`  Couldn't classify ${key}, keeping it: ${err.message}`);
      return false;
    }
  });

  const byDoc = new Map();
  candidates.forEach(({ doc, key }, i) => {
    if (!verdicts[i]) return;
    if (!byDoc.has(doc)) byDoc.set(doc, []);
    byDoc.get(doc).push(key);
  });

  const totals = {
    styles: muralStyles.length,
    stylesDeleted: 0,
    images: 0,
    words: byDoc.size,
    emptied: 0,
    removed: 0,
    filesDeleted: 0,
    unclassified: failed,
  };
  const removedKeys = new Set();

  console.log("\nMural images:");
  for (const [doc, keys] of byDoc) {
    const word = await words.findOne({ _id: doc.wordRef }, { projection: { word: 1, language: 1 } });
    const left = doc.objects.length - keys.length;
    totals.images += keys.length;
    if (left === 0) totals.emptied++;
    console.log(
      `${word ? `${word.word} (${word.language})` : doc._id}: ${keys.length} of ${doc.objects.length} images, ${left} left`
    );
    for (const key of keys) console.log(`  ${imageBase}/${key}`);

    if (!apply) continue;
    // $pull is atomic, so images the live app adds meanwhile are kept
    const result = await images.updateOne(
      { _id: doc._id },
      { $pull: { objects: { key: { $in: keys }, uploaded: { $ne: true } } } }
    );
    if (result.modifiedCount === 1) {
      totals.removed += keys.length;
      keys.forEach((k) => removedKeys.add(k));
    }
  }

  if (apply && muralStyles.length > 0) {
    const result = await artStyles.deleteMany({ _id: { $in: muralStyles.map((d) => d._id) } });
    totals.stylesDeleted = result.deletedCount;
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
