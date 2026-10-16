// Generates a distorted SVG title with blocky angular outcroppings.
// Run with: node scripts/generate-title.mjs
// Output: public/title.svg and public/promo-titled.png (composited)

import opentype from "opentype.js";
import sharp from "sharp";
import { writeFile } from "node:fs/promises";
import path from "node:path";

// --- Seeded PRNG (mulberry32) for reproducibility ---
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(42);

// --- Bezier flattening utilities ---
function lerp(a, b, t) {
  return a + (b - a) * t;
}

function flattenCubic(x0, y0, x1, y1, x2, y2, x3, y3, steps = 8) {
  const pts = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const x =
      u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3;
    const y =
      u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3;
    pts.push({ x, y });
  }
  return pts;
}

function flattenQuadratic(x0, y0, x1, y1, x2, y2, steps = 6) {
  const pts = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const x = u * u * x0 + 2 * u * t * x1 + t * t * x2;
    const y = u * u * y0 + 2 * u * t * y1 + t * t * y2;
    pts.push({ x, y });
  }
  return pts;
}

// --- Core distortion: walk a line segment and add angular outcroppings ---
function addOutcroppings(result, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.sqrt(dx * dx + dy * dy);

  if (len < 3) {
    result.push({ type: "L", x: x1, y: y1 });
    return;
  }

  // Normal (perpendicular) direction
  const nx = -dy / len;
  const ny = dx / len;

  // Tangent direction
  const tx = dx / len;
  const ty = dy / len;

  const stepSize = 3 + rand() * 3; // segment granularity
  const numSteps = Math.max(1, Math.floor(len / stepSize));

  let cx = x0;
  let cy = y0;

  for (let i = 1; i <= numSteps; i++) {
    const t = i / (numSteps + 1);
    const px = x0 + dx * t;
    const py = y0 + dy * t;

    if (rand() < 0.25) {
      // Angular outcropping: a rectangular bump jutting outward
      const bumpHeight = (2 + rand() * 5) * (rand() < 0.5 ? 1 : -1);
      const bumpWidth = 1.5 + rand() * 3;

      // Walk to start of bump
      result.push({ type: "L", x: px - tx * bumpWidth * 0.5, y: py - ty * bumpWidth * 0.5 });
      // Out perpendicular
      result.push({
        type: "L",
        x: px - tx * bumpWidth * 0.5 + nx * bumpHeight,
        y: py - ty * bumpWidth * 0.5 + ny * bumpHeight,
      });
      // Along bump top
      result.push({
        type: "L",
        x: px + tx * bumpWidth * 0.5 + nx * bumpHeight,
        y: py + ty * bumpWidth * 0.5 + ny * bumpHeight,
      });
      // Back to baseline
      result.push({ type: "L", x: px + tx * bumpWidth * 0.5, y: py + ty * bumpWidth * 0.5 });
    } else if (rand() < 0.15) {
      // Notch: angular indent
      const notchDepth = 1 + rand() * 3;
      const notchWidth = 1 + rand() * 2;
      const dir = rand() < 0.5 ? 1 : -1;

      result.push({ type: "L", x: px - tx * notchWidth * 0.5, y: py - ty * notchWidth * 0.5 });
      result.push({
        type: "L",
        x: px + nx * notchDepth * dir,
        y: py + ny * notchDepth * dir,
      });
      result.push({ type: "L", x: px + tx * notchWidth * 0.5, y: py + ty * notchWidth * 0.5 });
    } else {
      result.push({ type: "L", x: px, y: py });
    }

    cx = px;
    cy = py;
  }

  result.push({ type: "L", x: x1, y: y1 });
}

// --- Distort all path commands ---
function distortCommands(commands) {
  const result = [];
  let curX = 0;
  let curY = 0;

  for (const cmd of commands) {
    switch (cmd.type) {
      case "M":
        result.push(cmd);
        curX = cmd.x;
        curY = cmd.y;
        break;

      case "L":
        addOutcroppings(result, curX, curY, cmd.x, cmd.y);
        curX = cmd.x;
        curY = cmd.y;
        break;

      case "C": {
        const pts = flattenCubic(curX, curY, cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y);
        let px = curX;
        let py = curY;
        for (const pt of pts) {
          addOutcroppings(result, px, py, pt.x, pt.y);
          px = pt.x;
          py = pt.y;
        }
        curX = cmd.x;
        curY = cmd.y;
        break;
      }

      case "Q": {
        const pts = flattenQuadratic(curX, curY, cmd.x1, cmd.y1, cmd.x, cmd.y);
        let px = curX;
        let py = curY;
        for (const pt of pts) {
          addOutcroppings(result, px, py, pt.x, pt.y);
          px = pt.x;
          py = pt.y;
        }
        curX = cmd.x;
        curY = cmd.y;
        break;
      }

      case "Z":
        result.push(cmd);
        break;
    }
  }

  return result;
}

// --- Convert commands back to SVG path d attribute ---
function commandsToD(commands) {
  return commands
    .map((c) => {
      switch (c.type) {
        case "M": return `M${c.x.toFixed(2)} ${c.y.toFixed(2)}`;
        case "L": return `L${c.x.toFixed(2)} ${c.y.toFixed(2)}`;
        case "Z": return "Z";
        default: return "";
      }
    })
    .join(" ");
}

// --- Main ---
const FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";
const FONT_SIZE = 96;
const TEXT = "Utu's Wild Words";

const SVG_WIDTH = 1792;
const SVG_HEIGHT = 200;

const font = await opentype.load(FONT_PATH);

// Measure text to center it
const textWidth = font.getAdvanceWidth(TEXT, FONT_SIZE);
const xOffset = (SVG_WIDTH - textWidth) / 2;
const yOffset = FONT_SIZE + 40; // baseline position

const textPath = font.getPath(TEXT, xOffset, yOffset, FONT_SIZE);
const distorted = distortCommands(textPath.commands);
const d = commandsToD(distorted);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}">
  <defs>
    <filter id="glow">
      <feGaussianBlur stdDeviation="2" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <path d="${d}" fill="white" stroke="white" stroke-width="0.5" filter="url(#glow)"/>
</svg>`;

// Save standalone SVG
const svgPath = path.resolve("public/title.svg");
await writeFile(svgPath, svg);
console.log(`Saved SVG: ${svgPath}`);

// Composite onto promo image if it exists
try {
  const promoPath = path.resolve("public/promo.png");
  const outputPath = path.resolve("public/promo-titled.png");

  await sharp(promoPath)
    .composite([
      {
        input: Buffer.from(svg),
        top: 1024 - SVG_HEIGHT - 20,
        left: 0,
      },
    ])
    .toFile(outputPath);

  console.log(`Saved composited: ${outputPath}`);
} catch {
  console.log("No promo.png found — skipped compositing. SVG is still available.");
}
