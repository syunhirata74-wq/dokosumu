#!/usr/bin/env node
/**
 * Photos v6: relaxed fallback for rural stations.
 *
 * v5 was too strict (rating>=4.0 AND reviews>=30) so 38 stations had zero
 * candidates and kept stale photos from earlier enrichments. For those,
 * we now retry with rating>=3.0 AND reviews>=5 to give them SOMETHING
 * from their actual neighborhood.
 *
 * Also: re-runs all stations to ensure consistent selection with v5
 * filter rules (NAME_BAD_REGEX was added in v5 but some earlier photos
 * may have slipped through).
 *
 * Usage: node scripts/enrich-photos-v6.mjs [limit]
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
if (!KEY) { console.error("Missing GOOGLE_PLACES_API_KEY"); process.exit(1); }

const GOOD_TYPES = new Set([
  "tourist_attraction", "park", "natural_feature", "stadium", "museum",
  "amusement_park", "aquarium", "zoo", "place_of_worship", "church",
  "hindu_temple", "shinto_shrine", "buddhist_temple", "art_gallery",
  "landmark", "historical_landmark", "library", "city_hall", "university",
]);

const BAD_TYPES = new Set([
  "restaurant", "cafe", "bar", "food", "bakery", "meal_takeaway",
  "meal_delivery", "night_club", "liquor_store", "convenience_store",
  "supermarket", "grocery_or_supermarket", "clothing_store", "store",
  "gas_station", "lodging", "hotel", "real_estate_agency",
  "pharmacy", "doctor", "dentist", "finance", "bank", "atm",
  "beauty_salon", "spa", "hair_care", "lawyer", "accounting",
  "insurance_agency", "parking", "physiotherapist", "veterinary_care",
  "electrician", "plumber", "moving_company", "locksmith",
  "car_dealer", "car_rental", "car_repair", "travel_agency",
]);

const NAME_OUTDOOR_REGEX =
  /(公園|河川|川|堤|神社|寺|城|タワー|庭園|広場|ビーチ|海岸|港|橋|坂|展望|桜|記念館|博物館|美術館|動物園|水族館|ランド|スタジアム|アリーナ|競技場|教会|大聖堂|跡|通り|商店街|テラス|モール|交差点|スクランブル|駅前|繁華街|歓楽街|歩行者天国|センター街|ヒカリエ|スカイツリー|ハチ公|ビル|プラザ|銀座|原宿|竹下|中華街|横丁|坂道|桜並木|赤レンガ|みなとみらい|山下|ランドマーク|丸の内|表参道|パルコ|マルイ|タカシマヤ|三越|伊勢丹|ルミネ|アトレ)/;

const NAME_BAD_REGEX =
  /(税理士|法律事務所|法人|事務所|会計|保険|クリニック|医院|歯科|整骨|整体|動物病院|薬局|弁護士|司法書士|社労士|駐車場|不動産|リフォーム|塾|予備校|スクール|教室|葬儀|斎場|支店|営業所|美容院|美容室|理容|サロン|美容外科)/;

function photoUrl(ref) {
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${ref}&key=${KEY}`;
}

function isBad(types, name) {
  if (types.some((t) => BAD_TYPES.has(t))) return true;
  if (NAME_BAD_REGEX.test(name)) return true;
  return false;
}
function isGood(types, name) {
  if (types.some((t) => GOOD_TYPES.has(t))) return true;
  return NAME_OUTDOOR_REGEX.test(name);
}

async function fetchJson(url) {
  try { return await (await fetch(url)).json(); } catch { return {}; }
}
async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function fetchStationLocation(stationName) {
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(stationName + "駅")}&language=ja&key=${KEY}`;
  const res = await fetchJson(url);
  const first = res.results?.[0];
  if (!first?.geometry?.location) return null;
  return { lat: first.geometry.location.lat, lng: first.geometry.location.lng };
}

async function search(q, loc) {
  let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(q)}&language=ja&key=${KEY}`;
  if (loc) url += `&location=${loc.lat},${loc.lng}&radius=2000`;
  return (await fetchJson(url)).results ?? [];
}

async function collectCandidates(stationName, loc, tier /* "strict" | "relaxed" */) {
  const [minRating, minReviews, hiRating, hiReviews] = tier === "strict"
    ? [4.0, 30, 4.5, 200]
    : [3.0, 5, 4.2, 50];
  const qualifiers = ["駅前 ランドマーク", "名所", "公園 河川敷", "風景 景色"];
  const byId = new Map();
  for (const q of qualifiers) {
    const results = await search(`${stationName} ${q}`, loc);
    for (const p of results) {
      if (!p.photos?.[0]?.photo_reference) continue;
      const types = p.types ?? [];
      const rating = p.rating ?? 0;
      const reviews = p.user_ratings_total ?? 0;
      if (isBad(types, p.name)) continue;
      const hiTier = rating >= hiRating && reviews >= hiReviews;
      if (!hiTier && !isGood(types, p.name)) continue;
      if (rating < minRating || reviews < minReviews) continue;
      const score = rating * Math.log(reviews + 1);
      const existing = byId.get(p.place_id);
      if (!existing || existing.score < score) {
        byId.set(p.place_id, {
          name: p.name, rating, reviews, score,
          photoRef: p.photos[0].photo_reference,
        });
      }
    }
    await sleep(80);
  }
  return [...byId.values()].sort((a, b) => b.score - a.score);
}

async function main() {
  const LIMIT = process.argv[2] ? parseInt(process.argv[2]) : Infinity;
  const towns = JSON.parse(fs.readFileSync(PROFILES_PATH, "utf8"));
  const startTime = Date.now();
  let processed = 0, enriched = 0, relaxed = 0, thin = 0;

  for (const t of towns) {
    if (processed >= LIMIT) break;
    processed++;

    try {
      const loc = await fetchStationLocation(t.name);
      let cands = await collectCandidates(t.name, loc, "strict");
      let usedRelaxed = false;
      if (cands.length === 0) {
        cands = await collectCandidates(t.name, loc, "relaxed");
        if (cands.length > 0) { usedRelaxed = true; relaxed++; }
      }
      if (cands.length >= 1) {
        t.photos = cands.slice(0, 3).map((c) => photoUrl(c.photoRef));
        enriched++;
      } else {
        thin++;
      }
      if (processed % 50 === 0) {
        const mins = Math.round((Date.now() - startTime) / 60000);
        console.log(`[${processed}/${towns.length}] ${t.name} → ${cands.length} cands${usedRelaxed ? " (relaxed)" : ""}, photos=${(t.photos ?? []).length} [${mins}m]`);
        fs.writeFileSync(PROFILES_PATH, JSON.stringify(towns));
      }
    } catch (err) {
      console.error(`[${processed}] ${t.name} ✗ ${err.message}`);
    }
  }

  fs.writeFileSync(PROFILES_PATH, JSON.stringify(towns));
  const mins = Math.round((Date.now() - startTime) / 60000);
  console.log(`\nDone. Processed ${processed}, enriched ${enriched} (${relaxed} via relaxed fallback), thin=${thin} in ${mins} min`);
}

main().catch((err) => { console.error(err); process.exit(1); });
