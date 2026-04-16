#!/usr/bin/env node
/**
 * Photos v2: replace each station's photos[] with higher-quality area shots.
 *
 * Strategy:
 *   1. Photo #1: Google Street View Static at station lat/lng (guaranteed
 *      outdoor street-level shot of the neighborhood).
 *   2. Photos #2-3: Google Places Text Search for "{name} 名所 公園 河川敷",
 *      filtered to outdoor/landmark types (park, tourist_attraction, etc.)
 *      and excluding food/bar/cafe types (interior-heavy).
 *
 * Usage: node scripts/enrich-photos-v2.mjs [limit]
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

// Types we want (outdoor / landmark / civic)
const GOOD_TYPES = new Set([
  "tourist_attraction",
  "park",
  "natural_feature",
  "stadium",
  "museum",
  "amusement_park",
  "aquarium",
  "zoo",
  "place_of_worship",
  "church",
  "hindu_temple",
  "shinto_shrine",
  "buddhist_temple",
  "art_gallery",
  "landmark",
  "historical_landmark",
  "establishment", // fallback, paired with other signals
]);

// Types we want to EXCLUDE (interior-heavy)
const BAD_TYPES = new Set([
  "restaurant",
  "cafe",
  "bar",
  "food",
  "bakery",
  "meal_takeaway",
  "meal_delivery",
  "night_club",
  "liquor_store",
  "convenience_store",
  "supermarket",
  "grocery_or_supermarket",
  "clothing_store",
  "store",
  "shopping_mall",
  "gas_station",
  "lodging",
  "hotel",
]);

function photoUrl(ref) {
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${ref}&key=${KEY}`;
}

function streetViewUrl(lat, lng) {
  return `https://maps.googleapis.com/maps/api/streetview?size=800x600&location=${lat},${lng}&fov=80&pitch=0&key=${KEY}`;
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

async function fetchLandmarkPhotos(stationName) {
  const query = `${stationName} 名所 公園 河川敷`;
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
    query
  )}&language=ja&key=${KEY}`;
  const res = await fetch(url).then((r) => r.json()).catch(() => ({}));
  const results = res.results ?? [];

  const photos = [];
  for (const p of results) {
    const types = p.types ?? [];
    // Skip if any "bad" type present
    if (types.some((t) => BAD_TYPES.has(t))) continue;
    // Require at least one "good" type OR a generic but outdoor-ish name
    const hasGood = types.some((t) => GOOD_TYPES.has(t));
    if (!hasGood && !/(公園|河川|神社|寺|城|タワー|駅|川)/.test(p.name)) continue;
    const ref = p.photos?.[0]?.photo_reference;
    if (ref) photos.push(photoUrl(ref));
    if (photos.length >= 2) break;
  }
  return photos;
}

async function main() {
  const LIMIT = process.argv[2] ? parseInt(process.argv[2]) : Infinity;
  const towns = JSON.parse(fs.readFileSync(PROFILES_PATH, "utf8"));

  let processed = 0;
  let enriched = 0;
  const startTime = Date.now();

  for (const t of towns) {
    if (processed >= LIMIT) break;
    processed++;

    try {
      // 1. station location for Street View
      const loc = await fetchStationLocation(t.name);
      const newPhotos = [];
      if (loc) newPhotos.push(streetViewUrl(loc.lat, loc.lng));

      // 2. landmark/outdoor Places photos
      const landmarks = await fetchLandmarkPhotos(t.name);
      newPhotos.push(...landmarks);

      if (newPhotos.length > 0) {
        t.photos = newPhotos.slice(0, 3);
        enriched++;
      }

      const mins = Math.round((Date.now() - startTime) / 60000);
      console.log(
        `[${processed}] ${t.pref}/${t.name} ✓ ${newPhotos.length} photos (streetview=${loc ? "yes" : "no"}) [${mins}m]`
      );
    } catch (err) {
      console.error(`[${processed}] ${t.name} ✗ ${err.message}`);
    }

    if (processed % 50 === 0) {
      fs.writeFileSync(PROFILES_PATH, JSON.stringify(towns));
      console.log(`  -- checkpoint (${processed} / ${towns.length})`);
    }
  }

  fs.writeFileSync(PROFILES_PATH, JSON.stringify(towns));
  const mins = Math.round((Date.now() - startTime) / 60000);
  console.log(`\nDone. Processed ${processed}, enriched ${enriched} in ${mins} min`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
