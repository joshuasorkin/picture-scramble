// Generates a promotional image for Utu's Wild Words using DALL-E 3.
// Run with: node --env-file=.env.local scripts/generate-promo.mjs

import OpenAI from "openai";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const prompt = `A fanciful science-fiction illustration in the mashed-up style of Chris Foss, Chris Moore, and Syd Mead. A cuddly stuffed lion named Utu — plush, warm, storybook-friendly — sits at the center of a vast, sleek retro-futurist scene, magically conjuring glowing holographic letter tiles and vivid picture-puzzle clues that swirl around him in the air. Beams of iridescent light, crystalline reflections, and airbrushed chrome surfaces. Dramatic deep-space backdrop with pastel nebulae, distant megastructures, and that clean, painterly 1970s–80s sci-fi paperback cover aesthetic. Cinematic composition, landscape framing, rich saturated colors.`;

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

console.log("Requesting image from DALL-E 3...");
const response = await client.images.generate({
  model: "dall-e-3",
  prompt,
  n: 1,
  size: "1792x1024",
  quality: "hd",
  style: "vivid",
  response_format: "b64_json",
});

const b64 = response.data?.[0]?.b64_json;
if (!b64) throw new Error("No image data in DALL-E response");

const outDir = path.resolve("public");
await mkdir(outDir, { recursive: true });
const outPath = path.join(outDir, "promo.png");
await writeFile(outPath, Buffer.from(b64, "base64"));

console.log(`Saved: ${outPath}`);
if (response.data[0].revised_prompt) {
  console.log("\nRevised prompt used by DALL-E:");
  console.log(response.data[0].revised_prompt);
}
