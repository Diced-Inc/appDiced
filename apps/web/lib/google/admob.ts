import { getSupabaseAdmin } from "@/lib/supabase/server";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const ADMOB_API_BASE = "https://admob.googleapis.com/v1";
const SCOPE = "https://www.googleapis.com/auth/admob.report";

export function getAdMobAuthUrl(): string | null {
  const clientId = process.env.ADMOB_CLIENT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!clientId || !appUrl) return null;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${appUrl}/api/auth/admob/callback`,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
  });

  return `${AUTH_URL}?${params}`;
}

export async function exchangeAdMobCode(code: string) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.ADMOB_CLIENT_ID!,
      client_secret: process.env.ADMOB_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/admob/callback`,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`);

  return res.json() as Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }>;
}

async function refreshAdMobToken(refreshToken: string) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.ADMOB_CLIENT_ID!,
      client_secret: process.env.ADMOB_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`);

  return res.json() as Promise<{ access_token: string; expires_in: number }>;
}

interface TokenRow {
  access_token: string | null;
  refresh_token: string | null;
  token_expiry: string | null;
}

export async function getAdMobAccessToken(): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data: raw } = await supabase
    .from("api_connections")
    .select("access_token, refresh_token, token_expiry")
    .eq("provider", "admob")
    .single();

  const data = raw as TokenRow | null;

  if (!data?.refresh_token) return null;

  const expiry = data.token_expiry ? new Date(data.token_expiry) : new Date(0);
  if (expiry > new Date(Date.now() + 5 * 60 * 1000) && data.access_token) {
    return data.access_token;
  }

  try {
    const tokens = await refreshAdMobToken(data.refresh_token);
    const newExpiry = new Date(Date.now() + tokens.expires_in * 1000);

    await supabase
      .from("api_connections")
      .update({
        access_token: tokens.access_token,
        token_expiry: newExpiry.toISOString(),
        status: "connected",
        updated_at: new Date().toISOString(),
      })
      .eq("provider", "admob");

    return tokens.access_token;
  } catch (error) {
    await supabase
      .from("api_connections")
      .update({
        status: "error",
        error_message: error instanceof Error ? error.message : String(error),
        updated_at: new Date().toISOString(),
      })
      .eq("provider", "admob");
    return null;
  }
}

export async function fetchAdMobReport(
  accountId: string,
  startDate: { year: number; month: number; day: number },
  endDate: { year: number; month: number; day: number }
) {
  const token = await getAdMobAccessToken();
  if (!token) throw new Error("No valid AdMob token");

  const res = await fetch(
    `${ADMOB_API_BASE}/accounts/${accountId}/networkReport:generate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reportSpec: {
          dateRange: { startDate, endDate },
          dimensions: ["DATE"],
          metrics: ["ESTIMATED_EARNINGS", "IMPRESSIONS", "MATCHED_REQUESTS"],
          sortConditions: [{ dimension: "DATE", order: "ASCENDING" }],
        },
      }),
    }
  );

  if (!res.ok) throw new Error(`AdMob report failed: ${await res.text()}`);
  return res.json();
}

export async function listAdMobAccounts(): Promise<string | null> {
  const token = await getAdMobAccessToken();
  if (!token) return null;

  const res = await fetch(`${ADMOB_API_BASE}/accounts`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return null;

  const data = await res.json();
  return data.account?.[0]?.name ?? null;
}
