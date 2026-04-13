import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET ?? "";
const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder"
  );
}

function verifySignature(body: string, signature: string): boolean {
  if (!CHANNEL_SECRET) return false;
  const hash = createHmac("SHA256", CHANNEL_SECRET)
    .update(body)
    .digest("base64");
  return hash === signature;
}

async function replyMessage(replyToken: string, messages: object[]) {
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ replyToken, messages }),
  });
}

const APP_URL = "https://doko-sumitai.vercel.app";

function textMessage(text: string) {
  return { type: "text", text };
}

function appLinkButton(title: string, text: string, path: string = "/") {
  return {
    type: "template",
    altText: `${title} - アプリで見る`,
    template: {
      type: "buttons",
      title,
      text,
      actions: [
        {
          type: "uri",
          label: "アプリで見る",
          uri: `${APP_URL}${path}`,
        },
      ],
    },
  };
}

async function handleMessage(event: any) {
  const text = event.message?.text?.trim();
  if (!text) return;

  const replyToken = event.replyToken;

  // Commands
  if (text === "ランキング" || text === "らんきんぐ") {
    // Get all couples' towns with ratings
    const { data: towns } = await getSupabaseAdmin()
      .from("towns")
      .select("*, ratings(*)")
      .eq("visited", true)
      .limit(50);

    if (!towns || towns.length === 0) {
      return replyMessage(replyToken, [
        textMessage("まだ評価済みの町がないよ！\nアプリで町を登録して評価してね 🏠"),
      ]);
    }

    // Calculate scores
    const scored = towns
      .filter((t: any) => t.ratings && t.ratings.length > 0)
      .map((t: any) => {
        const keys = [
          "living_env",
          "transport",
          "shopping",
          "nature",
          "dining",
          "rent",
          "overall",
        ];
        let total = 0;
        let count = 0;
        for (const r of t.ratings) {
          for (const k of keys) {
            total += r[k];
            count++;
          }
        }
        return { name: t.name, avg: count > 0 ? total / count : 0 };
      })
      .sort((a: any, b: any) => b.avg - a.avg);

    if (scored.length === 0) {
      return replyMessage(replyToken, [
        textMessage("まだ評価済みの町がないよ！"),
      ]);
    }

    const medals = ["🥇", "🥈", "🥉"];
    const lines = scored
      .slice(0, 10)
      .map(
        (s: any, i: number) =>
          `${medals[i] ?? `${i + 1}.`} ${s.name}  ${s.avg.toFixed(1)}`
      );

    return replyMessage(replyToken, [
      textMessage(`🏆 ランキング\n\n${lines.join("\n")}`),
      appLinkButton("ランキング詳細", "レーダーチャートで比較もできるよ", "/ranking"),
    ]);
  }

  if (text === "行きたい" || text === "いきたい" || text === "リスト") {
    const { data: towns } = await getSupabaseAdmin()
      .from("towns")
      .select("name, station")
      .eq("visited", false)
      .limit(20);

    if (!towns || towns.length === 0) {
      return replyMessage(replyToken, [
        textMessage("行きたい町リストは空だよ！\nアプリから追加してね 📌"),
      ]);
    }

    const lines = towns.map(
      (t: any) => `📌 ${t.name}${t.station ? ` (${t.station})` : ""}`
    );

    return replyMessage(replyToken, [
      textMessage(`行きたい町リスト\n\n${lines.join("\n")}`),
      appLinkButton("町を追加する", "新しい候補を追加しよう", "/towns/new"),
    ]);
  }

  if (text === "今週どこ行く" || text === "今週どこ行く？" || text === "おすすめ") {
    const { data: towns } = await getSupabaseAdmin()
      .from("towns")
      .select("name, station")
      .eq("visited", false)
      .limit(20);

    if (!towns || towns.length === 0) {
      return replyMessage(replyToken, [
        textMessage("行きたい町リストが空だよ！\nまずアプリで候補を追加しよう 🗺️"),
      ]);
    }

    // Random pick
    const pick = towns[Math.floor(Math.random() * towns.length)];

    return replyMessage(replyToken, [
      textMessage(
        `今週のおすすめ 🎯\n\n${pick.name}${pick.station ? ` (${pick.station})` : ""}\n\nに行ってみない？`
      ),
      appLinkButton("アプリを開く", "町の詳細や評価をチェック"),
    ]);
  }

  if (text === "ヘルプ" || text === "help" || text === "使い方") {
    return replyMessage(replyToken, [
      textMessage(
        `🏠 どこ住む？ Bot\n\n使えるコマンド:\n\n📊「ランキング」\n  → 町の評価ランキング\n\n📌「行きたい」\n  → 行きたい町リスト\n\n🎯「今週どこ行く」\n  → ランダムにおすすめ\n\n🔗 アプリはこちら\nhttps://doko-sumitai.vercel.app`
      ),
    ]);
  }

  // Default response
  return replyMessage(replyToken, [
    textMessage(
      `「ヘルプ」と送ると使い方がわかるよ！\n\nアプリ → https://doko-sumitai.vercel.app`
    ),
  ]);
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("x-line-signature") ?? "";

  if (!verifySignature(body, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  const data = JSON.parse(body);

  for (const event of data.events ?? []) {
    if (event.type === "message" && event.message.type === "text") {
      await handleMessage(event);
    }
  }

  return NextResponse.json({ ok: true });
}
