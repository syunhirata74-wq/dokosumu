#!/usr/bin/env node
/**
 * Photos v9: dedup by actual redirect URL (real image identity).
 *
 * Root cause discovered: Google Places returns DIFFERENT photo_reference
 * strings that resolve to the SAME underlying image (same
 * googleusercontent.com path). Deduping by photo_reference is useless.
 *
 * Fix: HEAD each candidate's photo URL to get the 302 redirect Location,
 * extract the googleusercontent path as a stable image key, and dedupe
 * globally by that key.
 *
 * Usage: node scripts/enrich-photos-v9.mjs [limit]
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

const NAME_BAD_REGEX =
  /(税理士|法律事務所|法人|事務所|会計|保険|クリニック|医院|歯科|整骨|整体|動物病院|薬局|弁護士|司法書士|社労士|駐車場|不動産|リフォーム|塾|予備校|スクール|教室|葬儀|斎場|支店|営業所|美容院|美容室|理容|サロン|美容外科|パチンコ|ポーカー|カラオケ|ゲームセンター|ゲーセン|マンション|アパート|ホテル|トランクルーム|印刷|事務|販売店|ガソリンスタンド|工務店|工場|倉庫|スターバックス|Starbucks|スタバ|マクドナルド|McDonald|モス|サイゼリヤ|ガスト|吉野家|松屋|すき家|ドトール|コメダ|タリーズ|Tully|ファミリーマート|セブン|ローソン|109|PARCO|パルコ|ルミネ|アトレ|マルイ|高島屋|伊勢丹|三越|東急ハンズ|ロフト|ビックカメラ|ヨドバシ|ドンキホーテ|コストコ|居酒屋|焼肉|ラーメン|鮨|寿司|天ぷら|スナック|ラウンジ)/;

const BAD_TYPES = new Set([
  "lodging", "hotel", "restaurant", "cafe", "bar", "food", "bakery",
  "night_club", "liquor_store", "convenience_store", "supermarket",
  "clothing_store", "store", "gas_station", "real_estate_agency",
  "pharmacy", "doctor", "dentist", "finance", "bank", "atm",
  "beauty_salon", "spa", "hair_care", "lawyer", "accounting",
  "insurance_agency", "parking", "physiotherapist", "veterinary_care",
  "shopping_mall", "department_store", "electronics_store",
  "furniture_store", "home_goods_store",
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

/**
 * Get the actual image path (googleusercontent key) by HEAD-requesting
 * the Places Photo URL and reading the Location header from the 302.
 */
async function resolveImageKey(ref) {
  const url = photoUrl(ref);
  try {
    const r = await fetch(url, { redirect: "manual" });
    const loc = r.headers.get("location");
    if (!loc) return null;
    // Location looks like: https://lh3.googleusercontent.com/place-photos/AJRVUZ...=s1600-w800
    // Extract the path component (AJRVUZ...) as the stable key
    const m = loc.match(/\/place-photos\/([^=?/]+)/);
    return m ? m[1] : loc.slice(0, 200);
  } catch {
    return null;
  }
}

async function collectCandidates(loc, tier) {
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
          placeId: p.place_id,
          name: p.name, rating, reviews, score,
          photoRef: p.photos[0].photo_reference,
          placeLoc: p.geometry?.location ?? null,
        });
      }
    }
    await sleep(80);
  }
  return [...byId.values()].sort((a, b) => b.score - a.score);
}

function distanceKm(a, b) {
  if (!a || !b) return null;
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function main() {
  const LIMIT = process.argv[2] ? parseInt(process.argv[2]) : Infinity;
  const towns = JSON.parse(fs.readFileSync(PROFILES_PATH, "utf8"));
  const startTime = Date.now();
  let processed = 0, enriched = 0, relaxed = 0, thin = 0;

  // Two dedup sets:
  //   - usedImageKeyPrimary: image keys already used as photo[0]
  //   - usedImageKeyCount: how many times the image key has been used anywhere
  const usedImageKeyPrimary = new Set();
  const usedImageKeyCount = new Map();
  // Verification log: per-station primary photo place + distance
  const verify = [];

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
      if (cands.length === 0) { thin++; continue; }

      // For each candidate, resolve its image key. Pick up to 3 photos
      // with global image dedup.
      const picks = [];
      for (const c of cands) {
        if (picks.length >= 3) break;
        const imageKey = await resolveImageKey(c.photoRef);
        if (!imageKey) continue;
        const count = usedImageKeyCount.get(imageKey) ?? 0;
        const isPrimarySlot = picks.length === 0;
        // Slot 0: must be image never used as primary anywhere
        // Slot 1-2: allow up to 2 uses globally
        if (isPrimarySlot && usedImageKeyPrimary.has(imageKey)) continue;
        if (!isPrimarySlot && count >= 2) continue;
        picks.push({ ...c, imageKey });
        if (isPrimarySlot) usedImageKeyPrimary.add(imageKey);
        usedImageKeyCount.set(imageKey, count + 1);
      }

      if (picks.length >= 1) {
        t.photos = picks.map((c) => photoUrl(c.photoRef));
        enriched++;
        const primary = picks[0];
        const dist = distanceKm(loc, primary.placeLoc);
        verify.push({
          station: t.name, pref: t.pref,
          stationLoc: loc, primaryName: primary.name,
          primaryPlaceId: primary.placeId,
          primaryLoc: primary.placeLoc,
          distanceKm: dist != null ? +dist.toFixed(2) : null,
          imageKey: primary.imageKey,
        });
      } else {
        thin++;
      }
      if (processed % 50 === 0) {
        const mins = Math.round((Date.now() - startTime) / 60000);
        console.log(`[${processed}/${towns.length}] ${t.name} → ${cands.length} cands${usedRelaxed ? " (rx)" : ""}, picked=${picks.length} [${mins}m] primary=${picks[0]?.name}`);
        fs.writeFileSync(PROFILES_PATH, JSON.stringify(towns));
      }
    } catch (err) {
      console.error(`[${processed}] ${t.name} ✗ ${err.message}`);
    }
  }

  fs.writeFileSync(PROFILES_PATH, JSON.stringify(towns));
  fs.writeFileSync(path.join(__dirname, "v9-verify.json"), JSON.stringify(verify, null, 2));
  const mins = Math.round((Date.now() - startTime) / 60000);
  console.log(`\nDone. Processed ${processed}, enriched ${enriched} (${relaxed} relaxed), thin=${thin} in ${mins} min`);
  console.log(`Unique primary image keys: ${usedImageKeyPrimary.size}`);
  // Distance summary
  const dists = verify.map((v) => v.distanceKm).filter((x) => x != null);
  if (dists.length) {
    dists.sort((a, b) => a - b);
    const mean = dists.reduce((s, x) => s + x, 0) / dists.length;
    const p95 = dists[Math.floor(dists.length * 0.95)];
    const over2km = dists.filter((x) => x > 2).length;
    console.log(`Distance to primary photo place: mean=${mean.toFixed(2)}km, p95=${p95.toFixed(2)}km, over 2km=${over2km}`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
