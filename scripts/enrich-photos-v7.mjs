#!/usr/bin/env node
/**
 * Photos v7: switch to Google Places Nearby Search.
 *
 * v1-v6 used Text Search with keyword queries like "{name} 名所". This was
 * fundamentally unreliable — Google often returned high-rated shops/firms
 * whose name matched a permissive regex (poker rooms, karaoke, etc.) or
 * entirely unrelated places sharing the station name. Even after adding
 * NAME_BAD_REGEX and type filters, edge cases kept slipping in.
 *
 * Nearby Search is the right tool: it takes lat/lng + type + radius and
 * returns geographically-accurate results ranked by prominence. We query
 * once per station per type (tourist_attraction + park), union the results,
 * filter by rating/reviews/name, rank, and keep top 3.
 *
 * Usage: node scripts/enrich-photos-v7.mjs [limit]
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

// Name regex to still skip obviously non-landmark results
const NAME_BAD_REGEX =
  /(税理士|法律事務所|法人|事務所|会計|保険|クリニック|医院|歯科|整骨|整体|動物病院|薬局|弁護士|司法書士|社労士|駐車場|不動産|リフォーム|塾|予備校|スクール|教室|葬儀|斎場|支店|営業所|美容院|美容室|理容|サロン|美容外科|パチンコ|ポーカー|カラオケ|ゲームセンター|ゲーセン|マンション|アパート|ホテル|記念碑|トランクルーム|印刷|事務|販売店|ガソリンスタンド|工務店|工場|倉庫)/;

// Types we definitely don't want
const BAD_TYPES = new Set([
  "lodging", "hotel", "restaurant", "cafe", "bar", "food", "bakery",
  "night_club", "liquor_store", "convenience_store", "supermarket",
  "clothing_store", "store", "gas_station", "real_estate_agency",
  "pharmacy", "doctor", "dentist", "finance", "bank", "atm",
  "beauty_salon", "spa", "hair_care", "lawyer", "accounting",
  "insurance_agency", "parking", "physiotherapist", "veterinary_care",
  "shopping_mall",
]);

function photoUrl(ref) {
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${ref}&key=${KEY}`;
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

async function nearbySearch(loc, type, radius = 1500) {
  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${loc.lat},${loc.lng}&radius=${radius}&type=${type}&language=ja&key=${KEY}`;
  return (await fetchJson(url)).results ?? [];
}

async function collectCandidates(loc, tier /* "strict" | "relaxed" */) {
  const [minRating, minReviews] = tier === "strict" ? [3.8, 50] : [3.0, 5];
  const types = ["tourist_attraction", "park", "museum"];
  const byId = new Map();
  for (const type of types) {
    const results = await nearbySearch(loc, type);
    for (const p of results) {
      if (!p.photos?.[0]?.photo_reference) continue;
      const typeList = p.types ?? [];
      if (typeList.some((t) => BAD_TYPES.has(t))) continue;
      if (NAME_BAD_REGEX.test(p.name)) continue;
      const rating = p.rating ?? 0;
      const reviews = p.user_ratings_total ?? 0;
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
      if (!loc) { thin++; continue; }
      let cands = await collectCandidates(loc, "strict");
      let usedRelaxed = false;
      if (cands.length === 0) {
        cands = await collectCandidates(loc, "relaxed");
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
        console.log(`[${processed}/${towns.length}] ${t.name} → ${cands.length} cands${usedRelaxed ? " (relaxed)" : ""}, photos=${(t.photos ?? []).length} [${mins}m] top=${cands[0]?.name}`);
        fs.writeFileSync(PROFILES_PATH, JSON.stringify(towns));
      }
    } catch (err) {
      console.error(`[${processed}] ${t.name} ✗ ${err.message}`);
    }
  }

  fs.writeFileSync(PROFILES_PATH, JSON.stringify(towns));
  const mins = Math.round((Date.now() - startTime) / 60000);
  console.log(`\nDone. Processed ${processed}, enriched ${enriched} (${relaxed} relaxed), thin=${thin} in ${mins} min`);
}

main().catch((err) => { console.error(err); process.exit(1); });
