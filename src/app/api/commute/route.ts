import { NextRequest, NextResponse } from "next/server";

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

    return NextResponse.json({
      from: cleanFrom,
      to: cleanTo,
      minutes,
      fare,
      transfers,
      route: routeSummary.length > 0 ? routeSummary : null,
      transitUrl,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch commute data" },
      { status: 500 }
    );
  }
}
