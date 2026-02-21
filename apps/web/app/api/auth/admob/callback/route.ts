import { NextRequest, NextResponse } from "next/server";
import { exchangeAdMobCode } from "@/lib/google/admob";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(
      new URL("/settings?admob=error", req.nextUrl.origin)
    );
  }

  try {
    const tokens = await exchangeAdMobCode(code);
    const supabase = getSupabaseAdmin();

    await supabase.from("api_connections").upsert(
      {
        provider: "admob",
        status: "connected",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expiry: new Date(
          Date.now() + tokens.expires_in * 1000
        ).toISOString(),
        error_message: null,
        updated_at: new Date().toISOString(),
      } as Record<string, unknown>,
      { onConflict: "provider" }
    );

    return NextResponse.redirect(
      new URL("/settings?admob=connected", req.nextUrl.origin)
    );
  } catch (err) {
    console.error("AdMob OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/settings?admob=error", req.nextUrl.origin)
    );
  }
}
