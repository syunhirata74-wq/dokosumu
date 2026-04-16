#!/usr/bin/env node
/**
 * One-time: download every Google Places photo referenced in
 * public/town-profiles.json, upload to Supabase Storage, and rewrite the
 * URLs in the JSON to point to the Supabase CDN.
 *
 * After this, end-user photo loads NEVER hit Google (saves runtime API $).
 *
 * Storage path: town-photos/{station_code}/{index}.jpg
 *
 * Usage: node scripts/cache-photos.mjs [limit]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

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

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPA_URL || !SUPA_KEY) { console.error("Missing Supabase env"); process.exit(1); }

const supa = createClient(SUPA_URL, SUPA_KEY);
const BUCKET = "town-photos";
const PUBLIC_BASE = `${SUPA_URL}/storage/v1/object/public/${BUCKET}`;

async function fetchPhoto(url) {
  const r = await fetch(url);
  if (!r.ok) {
    // 403 with PNG = quota error; skip
    const ct = r.headers.get("content-type") || "";
    return { error: `${r.status} ${ct}` };
  }
  const buf = await r.arrayBuffer();
  return { buf: Buffer.from(buf), contentType: r.headers.get("content-type") || "image/jpeg" };
}

async function upload(path, buf, contentType) {
  const { error } = await supa.storage
    .from(BUCKET)
    .upload(path, buf, { contentType, upsert: true });
  return error;
}

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  const LIMIT = process.argv[2] ? parseInt(process.argv[2]) : Infinity;
  const towns = JSON.parse(fs.readFileSync(PROFILES_PATH, "utf8"));
  const startTime = Date.now();

  let processed = 0, photosDone = 0, errors = 0, skipped = 0;

  // Process in JSON order
  for (const t of towns) {
    if (processed >= LIMIT) break;
    processed++;

    // Skip if already migrated (photos[0] already on Supabase domain)
    if (t.photos?.[0]?.startsWith(PUBLIC_BASE)) { skipped++; continue; }

    const photos = t.photos ?? [];
    const newPhotos = [];

    for (let i = 0; i < photos.length; i++) {
      const googleUrl = photos[i];
      if (!googleUrl.includes("maps.googleapis.com")) {
        // Already not a Google URL — keep as-is
        newPhotos.push(googleUrl);
        continue;
      }
      try {
        const { buf, contentType, error } = await fetchPhoto(googleUrl);
        if (error || !buf) {
          console.error(`  ${t.name}[${i}] fetch failed: ${error}`);
          errors++;
          continue;
        }
        const storagePath = `${t.code}/${i}.jpg`;
        const upErr = await upload(storagePath, buf, contentType);
        if (upErr) {
          console.error(`  ${t.name}[${i}] upload failed: ${upErr.message}`);
          errors++;
          continue;
        }
        newPhotos.push(`${PUBLIC_BASE}/${storagePath}`);
        photosDone++;
      } catch (err) {
        console.error(`  ${t.name}[${i}] error: ${err.message}`);
        errors++;
      }
    }

    if (newPhotos.length > 0) t.photos = newPhotos;

    if (processed % 50 === 0) {
      const mins = Math.round((Date.now() - startTime) / 60000);
      console.log(`[${processed}/${towns.length}] ${t.name} → ${newPhotos.length} photos cached [${mins}m] (${photosDone} total, ${errors} errs)`);
      fs.writeFileSync(PROFILES_PATH, JSON.stringify(towns));
    }
  }

  fs.writeFileSync(PROFILES_PATH, JSON.stringify(towns));
  const mins = Math.round((Date.now() - startTime) / 60000);
  console.log(`\nDone. Processed ${processed}, photos cached ${photosDone}, skipped ${skipped}, errors ${errors} in ${mins} min`);
}

main().catch((err) => { console.error(err); process.exit(1); });
