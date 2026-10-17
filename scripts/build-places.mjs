// Builds src/data/places.json, the populated places that art styles are drawn
// from, out of Natural Earth's populated places.
//
// Run with: node scripts/build-places.mjs <ne_10m_populated_places_simple.geojson>
//
// Download the input from
// https://github.com/nvkelso/natural-earth-vector/tree/master/geojson

import { readFileSync, writeFileSync } from "node:fs";

const [input] = process.argv.slice(2);
if (!input) throw new Error("Pass the path to the Natural Earth populated places GeoJSON");

const places = JSON.parse(readFileSync(input, "utf8"))
  .features.map(({ properties: p }) => [
    Math.round(p.latitude * 100) / 100,
    Math.round(p.longitude * 100) / 100,
    Math.max(0, Math.round(p.pop_max ?? 0)),
  ])
  .filter(([lat, lon, pop]) => Number.isFinite(lat) && Number.isFinite(lon) && pop > 0);

// One place per line keeps diffs readable
writeFileSync(
  new URL("../src/data/places.json", import.meta.url),
  `[\n${places.map((p) => JSON.stringify(p)).join(",\n")}\n]\n`
);
console.log(`Wrote ${places.length} places`);
