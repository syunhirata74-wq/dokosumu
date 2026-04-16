import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function getAdmin() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

export async function GET(request: NextRequest) {
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json(
      { error: "from and to are required" },
      { status: 400 }
    );
  }

  const cleanFrom = from.replace(/駅$/, "");
  const cleanTo = to.replace(/駅$/, "");

  // 1. Try cache first
  const admin = getAdmin();
  if (admin) {
    const { data: cached } = await admin
      .from("town_commutes_cache")
      .select("*")
      .eq("from_station", cleanFrom)
      .eq("to_station", cleanTo)
      .maybeSingle();
    if (cached) {
      return NextResponse.json({
        from: cached.from_station,
        to: cached.to_station,
        minutes: cached.minutes,
        fare: cached.fare,
        transfers: cached.transfers,
        route: cached.route,
        transitUrl: `https://transit.yahoo.co.jp/search/result?from=${encodeURIComponent(cleanFrom)}&to=${encodeURIComponent(cleanTo)}&type=1&ticket=ic`,
        cached: true,
      });
    }
  }

  try {
    // Use Yahoo Transit (mobile page) for route search
    const url = `https://transit.yahoo.co.jp/search/result?from=${encodeURIComponent(cleanFrom)}&to=${encodeURIComponent(cleanTo)}&type=1&ticket=ic`;

    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
        "Accept-Language": "ja,en;q=0.9",
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Transit search failed" }, { status: 502 });
    }

    const html = await res.text();

    // Extract first route's time
    const timeMatch = html.match(/(\d+)時間(\d+)分/) || html.match(/(\d+)分/);
    let minutes: number | null = null;
    if (timeMatch) {
      if (timeMatch.length === 3) {
        minutes = parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2]);
      } else {
        minutes = parseInt(timeMatch[1]);
      }
    }

    // Extract fare
    const fareMatch = html.match(/(\d{1,3}(?:,\d{3})*)円/);
    let fare: number | null = null;
    if (fareMatch) {
      fare = parseInt(fareMatch[1].replace(/,/g, ""));
    }

    // Extract transfers count
    const transferMatch = html.match(/乗換[：:]?\s*(\d+)回/) || html.match(/乗り換え[：:]?\s*(\d+)回/);
    const transfers = transferMatch ? parseInt(transferMatch[1]) : null;

    // Extract route lines
    const lineMatches = html.match(/<div class="[^"]*routeDetail[^"]*">[\s\S]*?<\/div>/g);
    const routeSummary: string[] = [];

    // Try to extract line names from route detail
    const lineNameRegex = /([^\s<>]+(?:線|ライン|急行|特急|快速))/g;
    let lineMatch;
    const seen = new Set<string>();
    while ((lineMatch = lineNameRegex.exec(html)) !== null) {
      const name = lineMatch[1];
      if (!seen.has(name) && !name.includes("class") && name.length < 20) {
        seen.add(name);
        routeSummary.push(name);
        if (routeSummary.length >= 5) break;
      }
    }

    // Yahoo Transit link for user
    const transitUrl = `https://transit.yahoo.co.jp/search/result?from=${encodeURIComponent(cleanFrom)}&to=${encodeURIComponent(cleanTo)}&type=1&ticket=ic`;

    // Persist to cache
    if (admin && minutes != null) {
      await admin
        .from("town_commutes_cache")
        .upsert(
          {
            from_station: cleanFrom,
            to_station: cleanTo,
            minutes,
            fare,
            transfers,
            route: routeSummary.length > 0 ? routeSummary : null,
            fetched_at: new Date().toISOString(),
          },
          { onConflict: "from_station,to_station" }
        );
    }

    return NextResponse.json({
      from: cleanFrom,
      to: cleanTo,
      minutes,
      fare,
      transfers,
      route: routeSummary.length > 0 ? routeSummary : null,
      transitUrl,
      cached: false,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch commute data" },
      { status: 500 }
    );
  }
}
