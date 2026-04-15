#!/usr/bin/env node
/**
 * Full-coverage enrichment for public/town-profiles.json.
 *
 * For each station in the JSON, tries to enrich with:
 *   - rentRange (1LDK/2LDK/3LDK) — Playwright renders SUUMO 相場 page and
 *     extracts the マンション・駅徒歩10分以内 table (JS-rendered).
 *   - photos[] (3-5 URLs) — Google Places Text Search.
 *   - topSpots[] (3 names) — Google Places Text Search, top-rated.
 *   - facilities (cafe/gourmet/supermarket/park/hospital counts) — same.
 *
 * Skips stations already fully enriched (has rentRange + photos + topSpots)
 * so the script is resumable.
 *
 * Usage: node scripts/enrich-all-stations.mjs [limit]
 *   limit: optional, stop after N stations (useful for smoke test)
 *
 * Environment: requires .env.local with GOOGLE_PLACES_API_KEY.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PROFILES_PATH = path.join(ROOT, "public/town-profiles.json");
const CODE_MAP_PATH = path.join(__dirname, "suumo-station-codes.json");
const ENV_PATH = path.join(ROOT, ".env.local");

// Load .env.local
if (fs.existsSync(ENV_PATH)) {
  for (const line of fs.readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)="?(.+?)"?$/);
    if (m) process.env[m[1]] = m[2];
  }
}

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY ?? "";
if (!GOOGLE_PLACES_API_KEY) {
  console.error("Missing GOOGLE_PLACES_API_KEY");
  process.exit(1);
}

const PREF_SLUG = {
  "東京都": "tokyo",
  "神奈川県": "kanagawa",
  "埼玉県": "saitama",
  "千葉県": "chiba",
};

function photoUrl(ref) {
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${ref}&key=${GOOGLE_PLACES_API_KEY}`;
}

async function fetchGooglePlacesData(stationName) {
  // Station itself: photos
  const stationUrl =
    `https://maps.googleapis.com/maps/api/place/textsearch/json` +
    `?query=${encodeURIComponent(stationName + "駅")}&language=ja&key=${GOOGLE_PLACES_API_KEY}`;
  const stationRes = await fetch(stationUrl).then((r) => r.json()).catch(() => ({}));
  const stationResult = stationRes.results?.[0];
  const stationPhotos = (stationResult?.photos ?? [])
    .slice(0, 2)
    .map((p) => photoUrl(p.photo_reference));

  // Facilities by type
  const types = ["cafe", "supermarket", "park", "hospital", "restaurant"];
  const counts = {};
  const allFacilities = [];
  for (const type of types) {
    const q = `${stationName}駅 周辺 ${type}`;
    const u = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(q)}&language=ja&key=${GOOGLE_PLACES_API_KEY}`;
    const r = await fetch(u).then((res) => res.json()).catch(() => ({}));
    const results = r.results ?? [];
    counts[type] = results.length;
    for (const p of results) {
      if (p.rating && (p.user_ratings_total ?? 0) >= 20) {
        allFacilities.push({
          name: p.name,
          rating: p.rating,
          photoRef: p.photos?.[0]?.photo_reference,
        });
      }
    }
  }
  const ranked = allFacilities
    .sort((a, b) => b.rating - a.rating)
    .filter((f, i, arr) => arr.findIndex((x) => x.name === f.name) === i);
  const topSpots = ranked.slice(0, 3).map((f) => f.name);
  const facilityPhotos = ranked
    .filter((f) => f.photoRef)
    .slice(0, 3)
    .map((f) => photoUrl(f.photoRef));
  const photos = [...stationPhotos, ...facilityPhotos].slice(0, 5);

  return {
    photos,
    topSpots,
    facilities: {
      cafe: counts.cafe ?? 0,
      supermarket: counts.supermarket ?? 0,
      park: counts.park ?? 0,
      hospital: counts.hospital ?? 0,
      gourmet: counts.restaurant ?? 0,
    },
  };
}

function deriveRentRange(rent2ldk) {
  return {
    "1LDK": Math.round(rent2ldk * 0.75),
    "2LDK": rent2ldk,
    "3LDK": Math.round(rent2ldk * 1.35),
  };
}

// Scrape SUUMO 相場 page via Playwright, returns {1LDK, 2LDK, 3LDK} or null.
async function scrapeSuumoRents(page, prefSlug, suumoCode) {
  const url = `https://suumo.jp/chintai/soba/${prefSlug}/ek_${suumoCode}/`;
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForSelector("table.graphpanel_matrix--floor", { timeout: 15000 });
    const rows = await page.$$eval("table.graphpanel_matrix--floor tr", (trs) => {
      const out = {};
      for (const tr of trs) {
        const cells = tr.querySelectorAll("td");
        if (cells.length < 2) continue;
        const madori = cells[0].textContent.trim();
        const rentText = cells[1].textContent.trim();
        const m = rentText.match(/([\d.]+)\s*万円/);
        if (m && ["1LDK", "2LDK", "3LDK"].includes(madori)) {
          out[madori] = Math.round(parseFloat(m[1]) * 10000);
        }
      }
      return out;
    });
    if (!rows["2LDK"] || rows["2LDK"] < 50_000) {
      console.error(`    (scrape: 2LDK missing or < 50k at ${url}, rows=${JSON.stringify(rows)})`);
      return null;
    }
    return rows;
  } catch (err) {
    console.error(`    (scrape error at ${url}: ${err.message.split("\n")[0]})`);
    return null;
  }
}

async function main() {
  const LIMIT = process.argv[2] ? parseInt(process.argv[2]) : Infinity;

  const towns = JSON.parse(fs.readFileSync(PROFILES_PATH, "utf8"));
  const codeMap = JSON.parse(fs.readFileSync(CODE_MAP_PATH, "utf8"));

  const browser = await chromium.launch({ headless: true });
  // Use default (desktop) UA — SUUMO's mobile pages have a different DOM structure
  // and the 相場 matrix table (graphpanel_matrix--floor) only appears on desktop view.
  const context = await browser.newContext();
  const page = await context.newPage();

  let processed = 0;
  let enriched = 0;
  let skipped = 0;
  const startTime = Date.now();

  for (const t of towns) {
    if (processed >= LIMIT) break;

    // Skip if already fully enriched
    const alreadyDone =
      t.rentRange && t.photos && t.photos.length > 0 && t.topSpots && t.topSpots.length > 0;
    if (alreadyDone) {
      skipped++;
      continue;
    }
    processed++;

    const prefSlug = PREF_SLUG[t.pref];
    // Lookup with ケ/ヶ normalization fallback
    let suumoEntry = codeMap[t.name];
    if (!suumoEntry) {
      const normalized = t.name.replace(/ヶ/g, "ケ");
      for (const k of Object.keys(codeMap)) {
        if (k.replace(/ヶ/g, "ケ") === normalized) {
          suumoEntry = codeMap[k];
          break;
        }
      }
    }
    const suumoCode =
      suumoEntry?.[prefSlug] ??
      suumoEntry?.tokyo ??
      suumoEntry?.kanagawa ??
      suumoEntry?.saitama ??
      suumoEntry?.chiba;

    try {
      const [places, rents] = await Promise.all([
        fetchGooglePlacesData(t.name),
        suumoCode && prefSlug ? scrapeSuumoRents(page, prefSlug, suumoCode) : Promise.resolve(null),
      ]);

      t.photos = places.photos;
      t.topSpots = places.topSpots;
      t.facilities = places.facilities;
      const range = rents ?? (t.rent2ldk ? deriveRentRange(t.rent2ldk) : null);
      if (range) {
        t.rentRange = range;
        if (range["2LDK"]) t.rentAvg2LDK = range["2LDK"];
      }

      enriched++;
      const source = rents ? "SUUMO" : "derived";
      const mins = Math.round((Date.now() - startTime) / 60000);
      console.log(
        `[${processed}] ${t.pref}/${t.name} ✓ spots=${places.topSpots.length} photos=${places.photos.length} 2LDK=${
          t.rentAvg2LDK ? (t.rentAvg2LDK / 10000).toFixed(1) : "—"
        }万(${source}) [${mins}m]`
      );
    } catch (err) {
      console.error(`[${processed}] ${t.name} ✗ ${err.message}`);
    }

    // Write JSON incrementally every 25 stations for resumability
    if (processed % 25 === 0) {
      fs.writeFileSync(PROFILES_PATH, JSON.stringify(towns));
      console.log(`  -- checkpoint saved (processed ${processed}, enriched ${enriched})`);
    }
  }

  await browser.close();
  fs.writeFileSync(PROFILES_PATH, JSON.stringify(towns));
  const mins = Math.round((Date.now() - startTime) / 60000);
  console.log(`\nDone. Processed ${processed}, enriched ${enriched}, skipped ${skipped} in ${mins} min`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
