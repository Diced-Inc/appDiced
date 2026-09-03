import { timingSafeEqual } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { exchangeMetaCode } from "@/lib/meta/ads";
import { getSupabaseAdmin } from "@/lib/supabase/server";

function sameState(expected: string, received: string): boolean {
  const left = Buffer.from(expected);
  const right = Buffer.from(received);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.redirect(new URL("/sign-in", req.url));

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const expectedState = req.cookies.get("meta_oauth_state")?.value;
  const denied = req.nextUrl.searchParams.get("error");

  if (denied || !code || !state || !expectedState || !sameState(expectedState, state)) {
    return NextResponse.redirect(new URL("/settings?meta=error", req.url));
  }

  try {
    const token = await exchangeMetaCode(code);
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("api_connections").upsert(
      {
        provider: "meta_ads",
        user_id: userId,
        status: "connected",
        access_token: token.accessToken,
        refresh_token: null,
        token_expiry: new Date(Date.now() + token.expiresIn * 1000).toISOString(),
        error_message: null,
        updated_at: new Date().toISOString(),
      } as Record<string, unknown>,
      { onConflict: "provider,user_id" }
    );
    if (error) throw new Error(error.message);

    const response = NextResponse.redirect(new URL("/settings?meta=connected", req.url));
    response.cookies.delete("meta_oauth_state");
    return response;
  } catch (error) {
    console.error("Meta OAuth callback error:", error instanceof Error ? error.message : error);
    return NextResponse.redirect(new URL("/settings?meta=error", req.url));
  }
}
