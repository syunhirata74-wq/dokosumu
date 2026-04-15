#!/usr/bin/env node
/**
 * Enriches public/town-profiles.json with objective fact fields
 * (facilities, lines, rentAvg2LDK) for the manually-curated stations.
 *
 * For now, uses hand-seeded data for well-known stations. Later this script
 * can be extended to pull live counts from Google Places and SUUMO.
 *
 * Usage: node scripts/enrich-town-profiles.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILES_PATH = path.resolve(__dirname, "../public/town-profiles.json");

// Hand-seeded facility + line data for top manual stations.
// Counts are rough estimates based on Google Places / station references
// and should be replaced by live API enrichment later.
const SEED = {
  // code: { facilities, lines, rentAvg2LDK }
  "16720": { facilities: { cafe: 38, supermarket: 9, park: 4, hospital: 12, gourmet: 180 }, lines: 2, rentAvg2LDK: 224000 }, // 三軒茶屋
  "27280": { facilities: { cafe: 42, supermarket: 6, park: 5, hospital: 10, gourmet: 160 }, lines: 2, rentAvg2LDK: 280000 }, // 中目黒
  "19850": { facilities: { cafe: 55, supermarket: 7, park: 2, hospital: 8, gourmet: 220 }, lines: 2, rentAvg2LDK: 210000 }, // 下北沢
  "11640": { facilities: { cafe: 60, supermarket: 14, park: 8, hospital: 18, gourmet: 280 }, lines: 3, rentAvg2LDK: 195000 }, // 吉祥寺
  "25580": { facilities: { cafe: 28, supermarket: 15, park: 6, hospital: 22, gourmet: 140 }, lines: 5, rentAvg2LDK: 215000 }, // 武蔵小杉
  "26610": { facilities: { cafe: 32, supermarket: 7, park: 4, hospital: 9, gourmet: 120 }, lines: 2, rentAvg2LDK: 290000 }, // 二子玉川
  "04120": { facilities: { cafe: 70, supermarket: 10, park: 3, hospital: 15, gourmet: 300 }, lines: 4, rentAvg2LDK: 285000 }, // 恵比寿
  "22510": { facilities: { cafe: 45, supermarket: 6, park: 4, hospital: 11, gourmet: 170 }, lines: 2, rentAvg2LDK: 260000 }, // 自由が丘
  "02060": { facilities: { cafe: 95, supermarket: 16, park: 2, hospital: 28, gourmet: 420 }, lines: 8, rentAvg2LDK: 175000 }, // 池袋
  "13930": { facilities: { cafe: 35, supermarket: 8, park: 3, hospital: 10, gourmet: 200 }, lines: 1, rentAvg2LDK: 165000 }, // 高円寺
};

const raw = fs.readFileSync(PROFILES_PATH, "utf8");
const towns = JSON.parse(raw);

let enrichedCount = 0;
for (const t of towns) {
  const seed = SEED[t.code];
  if (seed) {
    t.facilities = seed.facilities;
    t.lines = seed.lines;
    t.rentAvg2LDK = seed.rentAvg2LDK;
    enrichedCount++;
  }
}

fs.writeFileSync(PROFILES_PATH, JSON.stringify(towns));
console.log(`Enriched ${enrichedCount}/${towns.length} stations with facts.`);
