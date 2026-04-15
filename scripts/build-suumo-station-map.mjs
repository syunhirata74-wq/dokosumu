#!/usr/bin/env node
/**
 * Builds a map from station name (JP) to SUUMO's internal `ek_` code by
 * crawling SUUMO's 沿線 (line) index pages for each prefecture.
 *
 * Our internal station codes (from JR-style databases) do not match SUUMO's
 * proprietary codes. So to fetch rent data for a given station, we first
 * need to look up SUUMO's code by name.
 *
 * Output: scripts/suumo-station-codes.json
 *   { "三軒茶屋": { tokyo: "03990" }, "中目黒": { tokyo: "27060" }, ... }
 *
 * Usage: node scripts/build-suumo-station-map.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "suumo-station-codes.json");

const PREFS = ["tokyo", "kanagawa", "saitama", "chiba"];

const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15";
const FETCH_OPTS = { headers: { "User-Agent": UA, "Accept-Language": "ja" } };

async function fetchText(url) {
  const r = await fetch(url, FETCH_OPTS);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
}

// Extract "en_{line}" links from a pref's 沿線 index page
async function fetchLineSlugs(pref) {
  const html = await fetchText(`https://suumo.jp/chintai/${pref}/ensen/`);
  const slugs = new Set();
  const re = new RegExp(`/chintai/${pref}/en_([^/"]+)/`, "g");
  let m;
  while ((m = re.exec(html)) !== null) slugs.add(m[1]);
  return [...slugs];
}

// Extract { name, code } pairs from a line page
async function fetchStationsOnLine(pref, slug) {
  const html = await fetchText(`https://suumo.jp/chintai/${pref}/en_${slug}/`);
  const results = [];
  // Station links look like: <a href="/chintai/{pref}/ek_{code}/...">{name}</a>
  const re = /<a[^>]*href="\/chintai\/[^/]+\/ek_(\d+)\/[^"]*"[^>]*>([^<]+?)<\/a>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const code = m[1];
    const name = m[2].trim();
    if (name && /^[^<>\s]/.test(name)) {
      results.push({ code, name });
    }
  }
  return results;
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const map = {}; // name -> { tokyo?: code, kanagawa?: code, ... }
  let totalPairs = 0;

  for (const pref of PREFS) {
    console.log(`\n== ${pref} ==`);
    let slugs;
    try {
      slugs = await fetchLineSlugs(pref);
      console.log(`  lines: ${slugs.length}`);
    } catch (err) {
      console.error(`  ✗ line index failed: ${err.message}`);
      continue;
    }

    for (const slug of slugs) {
      try {
        const stations = await fetchStationsOnLine(pref, slug);
        for (const { name, code } of stations) {
          if (!map[name]) map[name] = {};
          // Keep the first code found for each (pref, name) combination
          if (!map[name][pref]) {
            map[name][pref] = code;
            totalPairs++;
          }
        }
        await sleep(250); // be polite
      } catch (err) {
        console.error(`  ✗ ${slug}: ${err.message}`);
      }
    }
    console.log(`  unique names so far: ${Object.keys(map).length}`);
  }

  fs.writeFileSync(OUT, JSON.stringify(map, null, 2));
  console.log(`\nWrote ${OUT}`);
  console.log(`${Object.keys(map).length} unique station names (${totalPairs} pref-pairs)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
