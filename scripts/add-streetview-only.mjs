#!/usr/bin/env node
/**
 * Prepends a Google Street View Static URL to each station's photos[].
 *
 * Gets station lat/lng via Google Places Text Search, then generates a
 * Street View URL. Keeps existing landmark photos intact.
 *
 * Usage: node scripts/add-streetview-only.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PROFILES_PATH = path.join(ROOT, "public/town-profiles.json");
const ENV_PATH = path.join(ROOT, ".env.local");

if (fs.existsSync(ENV_PATH)) {
  for (const line of fs.readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)="?(.+?)"?$/);
    if (m) process.env[m[1]] = m[2];
  }
}

const KEY = process.env.GOOGLE_PLACES_API_KEY ?? "";
if (!KEY) {
  console.error("Missing GOOGLE_PLACES_API_KEY");
  process.exit(1);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchStationLocation(stationName) {
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
    stationName + "駅"
  )}&language=ja&key=${KEY}`;
  const res = await fetch(url).then((r) => r.json()).catch(() => ({}));
  const first = res.results?.[0];
  if (!first?.geometry?.location) return null;
  return { lat: first.geometry.location.lat, lng: first.geometry.location.lng };
}

async function main() {
  const towns = JSON.parse(fs.readFileSync(PROFILES_PATH, "utf8"));
  const startTime = Date.now();
  let processed = 0;
  let succeeded = 0;
  let skipped = 0;

  for (const t of towns) {
    // Skip if already has a Street View photo at index 0
    if (t.photos?.[0]?.includes("/streetview?")) {
      skipped++;
      continue;
    }
    processed++;

    try {
      const loc = await fetchStationLocation(t.name);
      if (loc) {
        const sv = `https://maps.googleapis.com/maps/api/streetview?size=800x600&location=${loc.lat},${loc.lng}&fov=80&pitch=0&key=${KEY}`;
        t.photos = [sv, ...(t.photos ?? [])].slice(0, 3);
        succeeded++;
      }
      const mins = Math.round((Date.now() - startTime) / 60000);
      if (processed % 50 === 0) {
        console.log(`[${processed}] ${t.name} (loc=${loc ? "yes" : "no"}) [${mins}m]`);
        fs.writeFileSync(PROFILES_PATH, JSON.stringify(towns));
      }
    } catch (err) {
      console.error(`[${processed}] ${t.name} ✗ ${err.message}`);
    }
    await sleep(50); // gentle rate
  }

  fs.writeFileSync(PROFILES_PATH, JSON.stringify(towns));
  const mins = Math.round((Date.now() - startTime) / 60000);
  console.log(`\nDone. Processed ${processed}, added SV ${succeeded}, skipped ${skipped} in ${mins} min`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
