#!/usr/bin/env node
/**
 * Enriches public/town-profiles.json with lineNames for ALL stations by
 * crawling SUUMO's line index pages and building a reverse map
 * (station name → line names).
 *
 * SUUMO line pages have titles like "【SUUMO】ＪＲ山手線（東京都）の..."
 * and list stations with ek codes. We match by station name (fuzzy ヶ/ケ).
 *
 * Usage: node scripts/enrich-line-names.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PROFILES_PATH = path.join(ROOT, "public/town-profiles.json");

const PREFS = ["tokyo", "kanagawa", "saitama", "chiba"];
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";
const FETCH_OPTS = { headers: { "User-Agent": UA, "Accept-Language": "ja" } };

async function fetchText(url) {
  const r = await fetch(url, FETCH_OPTS);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Get all line slugs for a prefecture
async function fetchLineSlugs(pref) {
  const html = await fetchText(`https://suumo.jp/chintai/${pref}/ensen/`);
  const slugs = new Set();
  const re = new RegExp(`/chintai/${pref}/en_([^/"]+)/`, "g");
  let m;
  while ((m = re.exec(html)) !== null) slugs.add(m[1]);
  return [...slugs];
}

// For a line page, extract: display name + station names
async function fetchLineInfo(pref, slug) {
  const html = await fetchText(`https://suumo.jp/chintai/${pref}/en_${slug}/`);

  // Line display name from <title>: "【SUUMO】ＪＲ山手線（東京都）の..."
  const titleMatch = html.match(/<title>【SUUMO】(.+?)（/);
  const lineName = titleMatch
    ? titleMatch[1]
        .replace(/\s+/g, "")
        .replace(/ＪＲ/g, "JR")
        .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) =>
          String.fromCharCode(c.charCodeAt(0) - 0xfee0)
        )
    : slug;

  // Station names from links: <a href="/chintai/{pref}/ek_{code}/...">{name}</a>
  const stationNames = new Set();
  const re = /<a[^>]*href="\/chintai\/[^/]+\/ek_\d+\/[^"]*"[^>]*>([^<]+?)<\/a>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const name = m[1].trim();
    if (name && name.length < 20 && !/物件|一覧|検索/.test(name)) {
      stationNames.add(name);
    }
  }

  return { lineName, stations: [...stationNames] };
}

function normalize(s) {
  return s.replace(/ヶ/g, "ケ");
}

async function main() {
  // Build station → line names map
  const stationToLines = {}; // normalized name → Set<lineName>

  for (const pref of PREFS) {
    console.log(`\n== ${pref} ==`);
    const slugs = await fetchLineSlugs(pref);
    console.log(`  ${slugs.length} lines`);

    for (const slug of slugs) {
      try {
        const { lineName, stations } = await fetchLineInfo(pref, slug);
        for (const name of stations) {
          const key = normalize(name);
          if (!stationToLines[key]) stationToLines[key] = new Set();
          stationToLines[key].add(lineName);
        }
        await sleep(200);
      } catch (err) {
        console.error(`  ✗ ${slug}: ${err.message}`);
      }
    }
    console.log(`  → ${Object.keys(stationToLines).length} unique stations mapped`);
  }

  // Apply to town-profiles.json
  const towns = JSON.parse(fs.readFileSync(PROFILES_PATH, "utf8"));
  let updated = 0;
  for (const t of towns) {
    const key = normalize(t.name);
    const lines = stationToLines[key];
    if (lines && lines.size > 0) {
      t.lineNames = [...lines].sort();
      t.lines = t.lineNames.length;
      updated++;
    }
  }

  fs.writeFileSync(PROFILES_PATH, JSON.stringify(towns));
  console.log(`\nUpdated ${updated}/${towns.length} stations with lineNames.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
