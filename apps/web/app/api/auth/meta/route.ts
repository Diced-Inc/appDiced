import { randomUUID } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getMetaAuthUrl } from "@/lib/meta/ads";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.redirect(new URL("/sign-in", req.url));

  const state = randomUUID();
  const authUrl = getMetaAuthUrl(state);
  if (!authUrl) {
    return NextResponse.redirect(new URL("/settings?meta=not_configured", req.url));
  }

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("meta_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 10 * 60,
    path: "/api/auth/meta/callback",
  });
  return response;
}
