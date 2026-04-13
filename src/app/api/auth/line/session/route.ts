import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const accessToken = request.nextUrl.searchParams.get("access_token");
  const refreshToken = request.nextUrl.searchParams.get("refresh_token");

  if (!accessToken || !refreshToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Redirect to home page with tokens as hash params
  // The client will pick these up and set the Supabase session
  const redirectUrl = new URL("/", request.url);
  redirectUrl.hash = `access_token=${accessToken}&refresh_token=${refreshToken}&type=line_login`;

  return NextResponse.redirect(redirectUrl);
}
