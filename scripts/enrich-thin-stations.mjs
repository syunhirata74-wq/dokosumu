#!/usr/bin/env node
/**
 * Enrich thin stations — those that v9 couldn't enrich with the strict
 * or relaxed filters. Uses ultra-relaxed filters: any rating, any reviews,
 * including smaller types like `establishment`.
 *
 * Maintains global image-key dedup with v9's already-used images
 * (loaded from scripts/v9-verify.json).
 *
 * Usage: node scripts/enrich-thin-stations.mjs
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

const NAME_BAD_REGEX =
  /(税理士|法律事務所|法人|事務所|会計|保険|クリニック|医院|歯科|整骨|整体|動物病院|薬局|弁護士|司法書士|社労士|駐車場|不動産|リフォーム|塾|予備校|スクール|教室|葬儀|斎場|支店|営業所|美容院|美容室|理容|サロン|美容外科|パチンコ|ポーカー|カラオケ|ゲームセンター|ゲーセン|マンション|アパート|ホテル|トランクルーム|印刷|事務|販売店|ガソリンスタンド|工務店|工場|倉庫|スターバックス|Starbucks|スタバ|マクドナルド|コメダ|タリーズ|ファミリーマート|セブン|ローソン|109|PARCO|パルコ|ルミネ|アトレ|マルイ|伊勢丹|三越|東急ハンズ|ロフト|ビックカメラ|ヨドバシ|ドンキホーテ|コストコ|居酒屋|焼肉|ラーメン|鮨|寿司|天ぷら|スナック|ラウンジ)/;

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
async function fetchJson(url) { try { return await (await fetch(url)).json(); } catch { return {}; } }
async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function fetchStationLocation(stationName) {
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(stationName + "駅")}&language=ja&key=${KEY}`;
  const res = await fetchJson(url);
  const first = res.results?.[0];
  if (!first?.geometry?.location) return null;
  return { lat: first.geometry.location.lat, lng: first.geometry.location.lng };
}

async function nearbySearch(loc, type, radius) {
  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${loc.lat},${loc.lng}&radius=${radius}&type=${type}&language=ja&key=${KEY}`;
  return (await fetchJson(url)).results ?? [];
}

async function resolveImageKey(ref) {
  try {
    const r = await fetch(photoUrl(ref), { redirect: "manual" });
    const loc = r.headers.get("location");
    if (!loc) return null;
    const m = loc.match(/\/place-photos\/([^=?/]+)/);
    return m ? m[1] : loc.slice(0, 200);
  } catch { return null; }
}

// Ultra-relaxed: any place with a photo, no rating minimums, name filter only
async function collectCandidatesUltraRelaxed(loc) {
  // Try multiple types and widened radius
  const types = ["tourist_attraction", "park", "museum", "point_of_interest"];
  const byId = new Map();
  for (const type of types) {
    const results = await nearbySearch(loc, type, 3000); // 3km
    for (const p of results) {
      if (!p.photos?.[0]?.photo_reference) continue;
      const typeList = p.types ?? [];
      if (typeList.some((t) => BAD_TYPES.has(t))) continue;
      if (NAME_BAD_REGEX.test(p.name)) continue;
      const rating = p.rating ?? 0;
      const reviews = p.user_ratings_total ?? 0;
      const score = rating * Math.log(reviews + 2) + reviews * 0.01;
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
  const towns = JSON.parse(fs.readFileSync(PROFILES_PATH, "utf8"));
  const verify = JSON.parse(fs.readFileSync(VERIFY_PATH, "utf8"));

  // Load already-used image keys from v9 run
  const usedImageKeyPrimary = new Set();
  for (const v of verify) if (v.imageKey) usedImageKeyPrimary.add(v.imageKey);
  console.log(`Loaded ${usedImageKeyPrimary.size} existing primary image keys from v9-verify`);

  // Find thin stations: ones not in verify
  const verifiedNames = new Set(verify.map((v) => v.station));
  const thin = towns.filter((t) => !verifiedNames.has(t.name));
  console.log(`Processing ${thin.length} thin stations...`);

  // Clear their current (stale, possibly duplicate) photos so we don't ship them
  for (const t of thin) t.photos = [];

  let enriched = 0;
  const startTime = Date.now();
  const newVerify = [...verify];

  for (let i = 0; i < thin.length; i++) {
    const t = thin[i];
    try {
      const loc = await fetchStationLocation(t.name);
      if (!loc) {
        console.log(`[${i + 1}/${thin.length}] ${t.name} → no loc`);
        continue;
      }
      const cands = await collectCandidatesUltraRelaxed(loc);
      const picks = [];
      for (const c of cands) {
        if (picks.length >= 3) break;
        const imageKey = await resolveImageKey(c.photoRef);
        if (!imageKey) continue;
        const isPrimary = picks.length === 0;
        if (isPrimary && usedImageKeyPrimary.has(imageKey)) continue;
        picks.push({ ...c, imageKey });
        if (isPrimary) usedImageKeyPrimary.add(imageKey);
      }
      if (picks.length >= 1) {
        t.photos = picks.map((c) => photoUrl(c.photoRef));
        enriched++;
        const primary = picks[0];
        newVerify.push({
          station: t.name, pref: t.pref, stationLoc: loc,
          primaryName: primary.name, primaryPlaceId: primary.placeId,
          primaryLoc: primary.placeLoc,
          distanceKm: +distanceKm(loc, primary.placeLoc).toFixed(2),
          imageKey: primary.imageKey,
        });
        const mins = Math.round((Date.now() - startTime) / 60000);
        console.log(`[${i + 1}/${thin.length}] ${t.name} → ${primary.name} (${picks.length} pics) [${mins}m]`);
      } else {
        console.log(`[${i + 1}/${thin.length}] ${t.name} → still thin (cleared)`);
      }
    } catch (err) {
      console.error(`[${i + 1}] ${t.name} ✗ ${err.message}`);
    }
  }

  fs.writeFileSync(PROFILES_PATH, JSON.stringify(towns));
  fs.writeFileSync(VERIFY_PATH, JSON.stringify(newVerify, null, 2));
  const mins = Math.round((Date.now() - startTime) / 60000);
  console.log(`\nDone. ${enriched}/${thin.length} enriched in ${mins} min`);
}

main().catch((err) => { console.error(err); process.exit(1); });
