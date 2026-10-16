// Overlays "Utu's Wild Words" title onto public/promo.png using sharp + SVG.
// Run with: node scripts/add-title.mjs

import sharp from "sharp";
import path from "node:path";

const inputPath = path.resolve("public/promo.png");
const outputPath = path.resolve("public/promo-titled.png");

const WIDTH = 1792;
const HEIGHT = 1024;

const svg = `
<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow" x="-5%" y="-5%" width="115%" height="115%">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#000" flood-opacity="0.7"/>
    </filter>
  </defs>
  <text
    x="${WIDTH / 2}"
    y="${HEIGHT - 80}"
    text-anchor="middle"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="96"
    font-weight="bold"
    font-style="italic"
    fill="white"
    filter="url(#shadow)"
  >Utu&#x2019;s Wild Words</text>
</svg>`;

await sharp(inputPath)
  .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
  .toFile(outputPath);

console.log(`Saved: ${outputPath}`);
