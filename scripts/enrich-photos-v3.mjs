#!/usr/bin/env node
/**
 * Photos v3: higher-intent area photos.
 *
 * Strategy:
 *   - Run 3 targeted Google Places Text Searches per station:
 *       1. "{name} 名所"
 *       2. "{name} 公園"
 *       3. "{name}駅 周辺"
 *   - Collect unique candidates (by place_id).
 *   - Strict type filter: exclude anything with interior-heavy types
 *     (restaurant/cafe/bar/food/store etc.); require at least one
 *     "outdoor / landmark" type OR a name matching an outdoor regex.
 *   - Minimum rating 4.0 + at least 30 reviews (to cut low-signal noise).
 *   - Rank by: rating × log(user_ratings_total + 1).
 *   - Take top 3 distinct photos.
 *
 * Usage: node scripts/enrich-photos-v3.mjs [limit]
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
  "library",
  "city_hall",
  "university",
]);

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
  "real_estate_agency",
  "pharmacy",
  "doctor",
  "dentist",
  "finance",
  "bank",
  "atm",
  "beauty_salon",
  "spa",
  "hair_care",
]);

const NAME_OUTDOOR_REGEX = /(公園|河川|川|堤|神社|寺|城|タワー|庭園|広場|ビーチ|海岸|港|橋|坂|展望|桜|記念館|博物館|美術館|動物園|水族館|ランド|スタジアム|アリーナ|競技場|教会|大聖堂|跡|通り|商店街|テラス|モール)/;

function photoUrl(ref) {
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${ref}&key=${KEY}`;
}

function isBad(types) {
  return types.some((t) => BAD_TYPES.has(t));
}
function isGood(types, name) {
  if (types.some((t) => GOOD_TYPES.has(t))) return true;
  return NAME_OUTDOOR_REGEX.test(name);
}

async function search(stationName, qualifier) {
  const q = `${stationName} ${qualifier}`;
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
    q
  )}&language=ja&key=${KEY}`;
  const res = await fetch(url).then((r) => r.json()).catch(() => ({}));
  return res.results ?? [];
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function collectCandidates(stationName) {
  const qualifiers = ["名所", "公園", "駅 周辺"];
  const byId = new Map();
  for (const q of qualifiers) {
    const results = await search(stationName, q);
    for (const p of results) {
      if (!p.photos?.[0]?.photo_reference) continue;
      const types = p.types ?? [];
      if (isBad(types)) continue;
      if (!isGood(types, p.name)) continue;
      const rating = p.rating ?? 0;
      const reviews = p.user_ratings_total ?? 0;
      if (rating < 4.0 || reviews < 30) continue;
      const score = rating * Math.log(reviews + 1);
      const existing = byId.get(p.place_id);
      if (!existing || existing.score < score) {
        byId.set(p.place_id, {
          name: p.name,
          rating,
          reviews,
          score,
          photoRef: p.photos[0].photo_reference,
        });
      }
    }
    await sleep(100);
  }
  return [...byId.values()].sort((a, b) => b.score - a.score);
}

async function main() {
  const LIMIT = process.argv[2] ? parseInt(process.argv[2]) : Infinity;
  const towns = JSON.parse(fs.readFileSync(PROFILES_PATH, "utf8"));
  const startTime = Date.now();
  let processed = 0;
  let enriched = 0;
  let thinCoverage = 0;

  for (const t of towns) {
    if (processed >= LIMIT) break;
    processed++;

    try {
      const candidates = await collectCandidates(t.name);
      if (candidates.length >= 1) {
        t.photos = candidates.slice(0, 3).map((c) => photoUrl(c.photoRef));
        enriched++;
      } else {
        // No good candidates — keep existing photos
        thinCoverage++;
      }
      const mins = Math.round((Date.now() - startTime) / 60000);
      if (processed % 25 === 0) {
        console.log(
          `[${processed}/${towns.length}] ${t.name} → ${candidates.length} candidates, photos=${(t.photos ?? []).length} [${mins}m]`
        );
        fs.writeFileSync(PROFILES_PATH, JSON.stringify(towns));
      }
    } catch (err) {
      console.error(`[${processed}] ${t.name} ✗ ${err.message}`);
    }
  }

  fs.writeFileSync(PROFILES_PATH, JSON.stringify(towns));
  const mins = Math.round((Date.now() - startTime) / 60000);
  console.log(
    `\nDone. Processed ${processed}, enriched ${enriched}, thin=${thinCoverage} in ${mins} min`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
