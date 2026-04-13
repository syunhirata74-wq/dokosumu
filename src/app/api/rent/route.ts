import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const stationCode = request.nextUrl.searchParams.get("code");
  const prefCode = request.nextUrl.searchParams.get("pref") ?? "tokyo";

  if (!stationCode) {
    return NextResponse.json(
      { error: "code is required" },
      { status: 400 }
    );
  }

  try {
    // Fetch SUUMO soba (相場) page directly using station code
    const url = `https://suumo.jp/chintai/soba/${prefCode}/ek_${stationCode}/`;

    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
        "Accept-Language": "ja,en;q=0.9",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "SUUMO request failed" },
        { status: 502 }
      );
    }

    const html = await res.text();

    // Parse the rent table: each row has <td>間取り名</td><td>...<span>XX.X</span>万円</td>
    const results: Record<string, number | null> = {};
    const rowRegex =
      /<td>([^<]+)<\/td>\s*<td[^>]*><span[^>]*>([\d.]+)<\/span>万円<\/td>/g;
    let match;

    while ((match = rowRegex.exec(html)) !== null) {
      const madori = match[1].trim();
      const price = parseFloat(match[2]);
      results[madori] = price;
    }

    const rent2ldk = results["2LDK"] ?? null;
    const sobaUrl = url;

    return NextResponse.json({
      rent_avg: rent2ldk ? Math.round(rent2ldk * 10000) : null,
      rent_2ldk: rent2ldk,
      all: results,
      sobaUrl,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch rent data" },
      { status: 500 }
    );
  }
}
