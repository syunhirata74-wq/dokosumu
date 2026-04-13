import { NextRequest, NextResponse } from "next/server";

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY ?? "";

export async function GET(request: NextRequest) {
  const station = request.nextUrl.searchParams.get("station");
  const types = request.nextUrl.searchParams.get("types");

  if (!station || !types) {
    return NextResponse.json(
      { error: "station and types are required" },
      { status: 400 }
    );
  }

  if (!GOOGLE_PLACES_API_KEY) {
    return NextResponse.json(
      { error: "Google Places API key not configured" },
      { status: 503 }
    );
  }

  try {
    const typeList = types.split(",");
    const allResults: any[] = [];

    for (const type of typeList.slice(0, 3)) {
      // Use Text Search to find facilities near the station
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
            type: type.trim(),
            lat: place.geometry.location.lat,
            lng: place.geometry.location.lng,
            rating: place.rating ?? null,
            address: place.formatted_address?.replace(/日本、/, "").replace(/〒\d{3}-\d{4}\s*/, "") ?? null,
          });
        }
      }
    }

    return NextResponse.json({ facilities: allResults });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch facilities" },
      { status: 500 }
    );
  }
}
