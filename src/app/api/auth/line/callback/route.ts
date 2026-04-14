import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

const LINE_CLIENT_ID = process.env.LINE_LOGIN_CLIENT_ID ?? "";
const LINE_CLIENT_SECRET = process.env.LINE_LOGIN_CLIENT_SECRET ?? "";
const LINE_REDIRECT_URI = process.env.NEXT_PUBLIC_SITE_URL
  ? `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/line/callback`
  : "https://dokosumu.vercel.app/api/auth/line/callback";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder"
  );
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const stateParam = request.nextUrl.searchParams.get("state");

  if (!code || !stateParam) {
    return NextResponse.redirect(
      new URL("/login?line=error&reason=nocode", request.url)
    );
  }

  try {
    const state = JSON.parse(
      Buffer.from(stateParam, "base64url").toString()
    );
    const mode = state.mode ?? "link";

    // Exchange code for LINE access token
    const tokenRes = await fetch("https://api.line.me/oauth2/v2.1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: LINE_REDIRECT_URI,
        client_id: LINE_CLIENT_ID,
        client_secret: LINE_CLIENT_SECRET,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("LINE token exchange failed:", tokenRes.status, errText);
      return NextResponse.redirect(
        new URL("/login?line=error&reason=token", request.url)
      );
    }

    const tokenData = await tokenRes.json();

    // Get LINE profile
    const profileRes = await fetch("https://api.line.me/v2/profile", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!profileRes.ok) {
      console.error("LINE profile failed:", profileRes.status);
      return NextResponse.redirect(
        new URL("/login?line=error&reason=profile", request.url)
      );
    }

    const lineProfile = await profileRes.json();
    const admin = getSupabaseAdmin();

    // MODE: "login" - Create or sign in via LINE (no Supabase account needed)
    if (mode === "login") {
      // Check if a profile with this LINE user ID exists
      const lineUserId = lineProfile.userId;
      const email = `line_${lineUserId}@doko-sumitai.app`;
      const password = createHash("sha256")
        .update(`line_${lineUserId}_${LINE_CLIENT_SECRET}`)
        .digest("hex");

      // Try to sign in first
      const supabaseClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { data: signInData, error: signInError } =
        await supabaseClient.auth.signInWithPassword({ email, password });

      if (signInData?.session) {
        // Existing user - update profile with latest LINE info
        await admin
          .from("profiles")
          .update({
            name: lineProfile.displayName,
            avatar_url: lineProfile.pictureUrl,
          })
          .eq("id", signInData.user.id);

        // Set session cookie via redirect
        const redirectUrl = new URL("/", request.url);
        redirectUrl.searchParams.set("access_token", signInData.session.access_token);
        redirectUrl.searchParams.set("refresh_token", signInData.session.refresh_token);
        return NextResponse.redirect(
          new URL(
            `/api/auth/line/session?access_token=${signInData.session.access_token}&refresh_token=${signInData.session.refresh_token}`,
            request.url
          )
        );
      }

      // New user - create account
      const { data: newUser, error: createError } =
        await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            name: lineProfile.displayName,
            avatar_url: lineProfile.pictureUrl,
            line_user_id: lineUserId,
          },
        });

      if (createError || !newUser?.user) {
        console.error("Failed to create user:", createError?.message);
        return NextResponse.redirect(
          new URL("/login?line=error&reason=create", request.url)
        );
      }

      // Profile is auto-created by trigger, but update with LINE data
      await admin
        .from("profiles")
        .update({
          name: lineProfile.displayName,
          avatar_url: lineProfile.pictureUrl,
        })
        .eq("id", newUser.user.id);

      // Sign in the new user
      const { data: newSession } =
        await supabaseClient.auth.signInWithPassword({ email, password });

      if (newSession?.session) {
        return NextResponse.redirect(
          new URL(
            `/api/auth/line/session?access_token=${newSession.session.access_token}&refresh_token=${newSession.session.refresh_token}`,
            request.url
          )
        );
      }

      return NextResponse.redirect(
        new URL("/login?line=error&reason=session", request.url)
      );
    }

    // MODE: "link" - Link LINE to existing Supabase account
    const supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser(state.token);

    if (!user || authError) {
      console.error("Supabase auth failed:", authError?.message);
      return NextResponse.redirect(
        new URL("/settings?line=error&reason=auth", request.url)
      );
    }

    await admin
      .from("profiles")
      .update({
        name: lineProfile.displayName,
        avatar_url: lineProfile.pictureUrl,
      })
      .eq("id", user.id);

    return NextResponse.redirect(
      new URL("/settings?line=success", request.url)
    );
  } catch (e) {
    console.error("LINE callback error:", e);
    return NextResponse.redirect(
      new URL("/login?line=error&reason=unknown", request.url)
    );
  }
}
