import { NextRequest, NextResponse } from "next/server";

const LINE_CLIENT_ID = process.env.LINE_LOGIN_CLIENT_ID ?? "";
const LINE_REDIRECT_URI = process.env.NEXT_PUBLIC_SITE_URL
  ? `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/line/callback`
  : "https://doko-sumitai.vercel.app/api/auth/line/callback";

export async function GET(request: NextRequest) {
  // token is optional - if logged in, passes Supabase token for profile update
  // if not logged in, will create a new account
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const mode = request.nextUrl.searchParams.get("mode") ?? "link"; // "link" or "login"

  const state = Buffer.from(JSON.stringify({ token, mode })).toString("base64url");

  const lineAuthUrl =
    `https://access.line.me/oauth2/v2.1/authorize` +
    `?response_type=code` +
    `&client_id=${LINE_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(LINE_REDIRECT_URI)}` +
    `&state=${state}` +
    `&scope=profile%20openid%20email` +
    `&bot_prompt=aggressive`;

  return NextResponse.redirect(lineAuthUrl);
}
