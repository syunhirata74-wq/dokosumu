import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY ?? "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function getAdmin() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

export async function GET(request: NextRequest) {
  const station = request.nextUrl.searchParams.get("station");
  const stationCode = request.nextUrl.searchParams.get("code") ?? "";
  const types = request.nextUrl.searchParams.get("types");

  if (!station || !types) {
    return NextResponse.json(
      { error: "station and types are required" },
      { status: 400 }
    );
  }

  const typeList = types.split(",").slice(0, 3).map((s) => s.trim()).sort();
  const typesKey = typeList.join(",");
  const admin = getAdmin();

  // 1. Try cache first (keyed by station_code + sorted types)
  if (admin && stationCode) {
    const { data: cached } = await admin
      .from("town_facilities_cache")
      .select("data, fetched_at")
      .eq("station_code", stationCode)
      .eq("types_key", typesKey)
      .maybeSingle();
    if (cached?.data) {
      return NextResponse.json({
        facilities: cached.data,
        cached: true,
        fetched_at: cached.fetched_at,
      });
    }
  }

  if (!GOOGLE_PLACES_API_KEY) {
    return NextResponse.json(
      { error: "Google Places API key not configured" },
      { status: 503 }
    );
  }

  try {
    const allResults: Array<{
      name: string;
      type: string;
      lat: number;
      lng: number;
      rating: number | null;
      address: string | null;
    }> = [];

    for (const type of typeList) {
      const query = `${station}駅 周辺 ${type}`;
      const url =
        `https://maps.googleapis.com/maps/api/place/textsearch/json` +
        `?query=${encodeURIComponent(query)}` +
        `&language=ja` +
        `&key=${GOOGLE_PLACES_API_KEY}`;

      const res = await fetch(url);
      if (!res.ok) continue;

      const data = await res.json();
      if (data.results) {
        for (const place of data.results.slice(0, 8)) {
          allResults.push({
            name: place.name,
            type,
            lat: place.geometry.location.lat,
            lng: place.geometry.location.lng,
            rating: place.rating ?? null,
            address:
              place.formatted_address?.replace(/日本、/, "").replace(/〒\d{3}-\d{4}\s*/, "") ?? null,
          });
        }
      }
    }

    // 2. Persist to cache (next identical request won't hit Google)
    if (admin && stationCode && allResults.length > 0) {
      await admin
        .from("town_facilities_cache")
        .upsert(
          {
            station_code: stationCode,
            types_key: typesKey,
            data: allResults,
            fetched_at: new Date().toISOString(),
          },
          { onConflict: "station_code,types_key" }
        );
    }

    return NextResponse.json({ facilities: allResults, cached: false });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch facilities" },
      { status: 500 }
    );
  }
}
