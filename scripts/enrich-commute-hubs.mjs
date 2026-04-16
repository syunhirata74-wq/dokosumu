#!/usr/bin/env node
/**
 * Enriches each station with commute time to 東京 / 渋谷 / 新宿 via Yahoo
 * Transit scraping. Stores result in t.commuteHubs.
 *
 * Throttle: 3 concurrent fetches, jitter. Resumable: skips stations that
 * already have all 3 hub values.
 *
 * Usage: node scripts/enrich-commute-hubs.mjs [limit]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PROFILES_PATH = path.join(ROOT, "public/town-profiles.json");

const HUBS = ["東京", "渋谷", "新宿"];
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15";

async function fetchCommute(fromStation, toStation) {
  const cleanFrom = fromStation.replace(/駅$/, "");
  const cleanTo = toStation.replace(/駅$/, "");
  const url = `https://transit.yahoo.co.jp/search/result?from=${encodeURIComponent(
    cleanFrom
  )}&to=${encodeURIComponent(cleanTo)}&type=1&ticket=ic`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "ja" },
  });
  if (!res.ok) return null;
  const html = await res.text();
  const timeMatch = html.match(/(\d+)時間(\d+)分/) || html.match(/(\d+)分/);
  if (!timeMatch) return null;
  if (timeMatch.length === 3) {
    return parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2]);
  }
  return parseInt(timeMatch[1]);
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Process a list of tasks with concurrency
async function runConcurrent(tasks, concurrency) {
  const results = [];
  let idx = 0;
  async function worker() {
    while (idx < tasks.length) {
      const my = idx++;
      try {
        results[my] = await tasks[my]();
      } catch (err) {
        results[my] = { error: err.message };
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

async function main() {
  const LIMIT = process.argv[2] ? parseInt(process.argv[2]) : Infinity;
  const towns = JSON.parse(fs.readFileSync(PROFILES_PATH, "utf8"));
  const startTime = Date.now();

  let processed = 0;
  let enriched = 0;
  let skipped = 0;

  for (const t of towns) {
    if (processed >= LIMIT) break;

    // Skip if all 3 hubs already present
    const hubs = t.commuteHubs ?? {};
    const missing = HUBS.filter((h) => hubs[h] === undefined);
    if (missing.length === 0) {
      skipped++;
      continue;
    }
    // Don't waste a lookup on the hub station itself
    const neededHubs = missing.filter((h) => h !== t.name);
    processed++;

    const tasks = neededHubs.map((hub) => async () => {
      const mins = await fetchCommute(t.name, hub);
      return { hub, mins };
    });
    const results = await runConcurrent(tasks, 3);

    t.commuteHubs = { ...hubs };
    for (const r of results) {
      if (r && r.mins !== null && !r.error) t.commuteHubs[r.hub] = r.mins;
    }
    // Hub=self → 0
    if (HUBS.includes(t.name)) t.commuteHubs[t.name] = 0;

    enriched++;
    const mins = Math.round((Date.now() - startTime) / 60000);
    console.log(
      `[${processed}] ${t.pref}/${t.name} ${JSON.stringify(t.commuteHubs)} [${mins}m]`
    );

    if (processed % 50 === 0) {
      fs.writeFileSync(PROFILES_PATH, JSON.stringify(towns));
      console.log(`  -- checkpoint (enriched ${enriched}, skipped ${skipped})`);
    }
  }

  fs.writeFileSync(PROFILES_PATH, JSON.stringify(towns));
  const mins = Math.round((Date.now() - startTime) / 60000);
  console.log(`\nDone. Processed ${processed}, enriched ${enriched}, skipped ${skipped} in ${mins} min`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
