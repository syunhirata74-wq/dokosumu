#!/usr/bin/env node
/**
 * Merge station lat/lng from scripts/v9-verify.json into
 * public/town-profiles.json (as field `location: {lat, lng}`). For
 * stations missing in verify (thin 48 + any other), fetch via Google
 * Places Text Search one-by-one.
 *
 * Usage: node scripts/merge-station-locations.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PROFILES_PATH = path.join(ROOT, "public/town-profiles.json");
const VERIFY_PATH = path.join(__dirname, "v9-verify.json");
const ENV_PATH = path.join(ROOT, ".env.local");

if (fs.existsSync(ENV_PATH)) {
  for (const line of fs.readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)="?(.+?)"?$/);
    if (m) process.env[m[1]] = m[2];
  }
}

const KEY = process.env.GOOGLE_PLACES_API_KEY ?? "";
if (!KEY) { console.error("Missing GOOGLE_PLACES_API_KEY"); process.exit(1); }

async function fetchStationLocation(stationName) {
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(stationName + "駅")}&language=ja&key=${KEY}`;
  const res = await fetch(url).then((r) => r.json()).catch(() => ({}));
  const first = res.results?.[0];
  if (!first?.geometry?.location) return null;
  return { lat: first.geometry.location.lat, lng: first.geometry.location.lng };
}

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  const towns = JSON.parse(fs.readFileSync(PROFILES_PATH, "utf8"));
  const verify = fs.existsSync(VERIFY_PATH) ? JSON.parse(fs.readFileSync(VERIFY_PATH, "utf8")) : [];
  const locByName = new Map();
  for (const v of verify) {
    if (v.station && v.stationLoc) locByName.set(v.station, v.stationLoc);
  }

  let merged = 0, fetched = 0, errors = 0;
  for (let i = 0; i < towns.length; i++) {
    const t = towns[i];
    if (t.location?.lat && t.location?.lng) continue; // already has it
    const cached = locByName.get(t.name);
    if (cached) {
      t.location = { lat: cached.lat, lng: cached.lng };
      merged++;
      continue;
    }
    try {
      const loc = await fetchStationLocation(t.name);
      if (loc) {
        t.location = loc;
        fetched++;
        console.log(`[${i + 1}/${towns.length}] ${t.name} fetched lat/lng`);
      } else {
        errors++;
      }
    } catch {
      errors++;
    }
    await sleep(50);
  }

  fs.writeFileSync(PROFILES_PATH, JSON.stringify(towns));
  console.log(`\nDone. Merged from verify: ${merged}, fetched via Places: ${fetched}, errors: ${errors}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
