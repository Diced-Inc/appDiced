import { createHmac } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const graphVersion = process.env.META_GRAPH_API_VERSION?.trim() || "v26.0";
const GRAPH_BASE = `https://graph.facebook.com/${graphVersion}`;
const FACEBOOK_BASE = `https://www.facebook.com/${graphVersion}`;

interface MetaErrorResponse {
  error?: { message?: string; code?: number; type?: string };
}

interface MetaConnectionRow {
  access_token: string | null;
  token_expiry: string | null;
}

interface PagedResponse<T> extends MetaErrorResponse {
  data?: T[];
  paging?: { next?: string };
}

export interface MetaAdAccount {
  id: string;
  name: string;
  currency: string;
  timezoneName: string;
  accountStatus: number;
}

export interface MetaCampaign {
  id: string;
  accountId: string;
  name: string;
  status: string;
  effectiveStatus: string;
  dailyBudget?: string;
  lifetimeBudget?: string;
}

export interface MetaDailyInsight {
  date: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  installs: number;
}

interface RawMetaInsight {
  date_start?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  actions?: { action_type?: string; value?: string }[];
}

function requireMetaEnv() {
  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appId || !appSecret || !appUrl) return null;
  return { appId, appSecret, appUrl };
}

function appSecretProof(token: string, secret: string): string {
  return createHmac("sha256", secret).update(token).digest("hex");
}

function normalizeAccountId(accountId: string): string {
  return accountId.startsWith("act_") ? accountId : `act_${accountId}`;
}

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function graphRequest<T>(path: string, token: string, params: Record<string, string> = {}): Promise<T> {
  const env = requireMetaEnv();
  if (!env) throw new Error("META_APP_ID/META_APP_SECRET/NEXT_PUBLIC_APP_URL não configurados");

  const url = new URL(`${GRAPH_BASE}/${path.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set("access_token", token);
  url.searchParams.set("appsecret_proof", appSecretProof(token, env.appSecret));

  const response = await fetch(url, { cache: "no-store" });
  const body = (await response.json()) as T & MetaErrorResponse;
  if (!response.ok || body.error) {
    throw new Error(body.error?.message || `Meta API falhou (${response.status})`);
  }
  return body;
}

async function fetchAllPages<T>(
  path: string,
  token: string,
  params: Record<string, string>
): Promise<T[]> {
  const first = await graphRequest<PagedResponse<T>>(path, token, params);
  const rows = [...(first.data ?? [])];
  let next = first.paging?.next;

  while (next) {
    const response = await fetch(next, { cache: "no-store" });
    const page = (await response.json()) as PagedResponse<T>;
    if (!response.ok || page.error) {
      throw new Error(page.error?.message || `Meta API falhou (${response.status})`);
    }
    rows.push(...(page.data ?? []));
    next = page.paging?.next;
  }

  return rows;
}

export function isMetaConfigured(): boolean {
  return requireMetaEnv() !== null;
}

export function getMetaAuthUrl(state: string): string | null {
  const env = requireMetaEnv();
  if (!env) return null;

  const params = new URLSearchParams({
    client_id: env.appId,
    redirect_uri: `${env.appUrl}/api/auth/meta/callback`,
    response_type: "code",
    scope: "ads_read,ads_management",
    state,
  });
  return `${FACEBOOK_BASE}/dialog/oauth?${params}`;
}

export async function setMetaCampaignStatus(userId: string, accountId: string, campaignId: string, status: "ACTIVE" | "PAUSED", expectedStatus: string) {
  if (!/^\d+$/.test(campaignId) || !/^(act_)?\d+$/.test(accountId) || !["ACTIVE", "PAUSED"].includes(status)) throw new Error("Campanha ou status inválido.");
  const token = await getMetaAccessToken(userId);
  const env = requireMetaEnv();
  if (!token || !env) throw new Error("Reconecte a Meta em Configurações para gerenciar campanhas.");
  const read = () => graphRequest<{ id: string; account_id: string; status: string; effective_status: string }>(campaignId, token, { fields: "id,account_id,status,effective_status" });
  const before = await read();
  if (normalizeAccountId(before.account_id) !== normalizeAccountId(accountId)) throw new Error("A campanha não pertence à conta vinculada.");
  if (!["ACTIVE", "PAUSED"].includes(before.status)) throw new Error("Esta campanha não pode ser pausada ou reativada.");
  if (before.status === status) return before;
  if (before.status !== expectedStatus) throw new Error("O status mudou na Meta. Atualize a página antes de tentar novamente.");
  const permissions = await graphRequest<{ data: { permission: string; status: string }[] }>("me/permissions", token);
  if (!permissions.data.some(p => p.permission === "ads_management" && p.status === "granted")) throw new Error("Reconecte a Meta em Configurações e autorize o gerenciamento de anúncios.");
  const response = await fetch(`${GRAPH_BASE}/${campaignId}`, {
    method: "POST", cache: "no-store", signal: AbortSignal.timeout(30000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ status, access_token: token, appsecret_proof: appSecretProof(token, env.appSecret) }),
  });
  const result = await response.json() as { success?: boolean } & MetaErrorResponse;
  if (!response.ok || result.error || !result.success) throw new Error(result.error?.message || "A Meta não confirmou a alteração. Atualize o status antes de tentar novamente.");
  const after = await read();
  if (after.status !== status) throw new Error("Pedido enviado, mas o status ainda não foi confirmado. Atualize a página.");
  return after;
}

export async function exchangeMetaCode(code: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const env = requireMetaEnv();
  if (!env) throw new Error("Meta OAuth não configurado");

  const shortUrl = new URL(`${GRAPH_BASE}/oauth/access_token`);
  shortUrl.search = new URLSearchParams({
    client_id: env.appId,
    client_secret: env.appSecret,
    redirect_uri: `${env.appUrl}/api/auth/meta/callback`,
    code,
  }).toString();
  const shortResponse = await fetch(shortUrl, { cache: "no-store" });
  const shortBody = (await shortResponse.json()) as MetaErrorResponse & {
    access_token?: string;
    expires_in?: number;
  };
  if (!shortResponse.ok || !shortBody.access_token) {
    throw new Error(shortBody.error?.message || "Falha ao trocar o código da Meta");
  }

  const longUrl = new URL(`${GRAPH_BASE}/oauth/access_token`);
  longUrl.search = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: env.appId,
    client_secret: env.appSecret,
    fb_exchange_token: shortBody.access_token,
  }).toString();
  const longResponse = await fetch(longUrl, { cache: "no-store" });
  const longBody = (await longResponse.json()) as MetaErrorResponse & {
    access_token?: string;
    expires_in?: number;
  };
  if (!longResponse.ok || !longBody.access_token) {
    throw new Error(longBody.error?.message || "Falha ao obter token de longa duração da Meta");
  }

  return {
    accessToken: longBody.access_token,
    expiresIn: longBody.expires_in ?? 60 * 24 * 60 * 60,
  };
}

export async function getMetaAccessToken(userId: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("api_connections")
    .select("access_token, token_expiry")
    .eq("provider", "meta_ads")
    .eq("user_id", userId)
    .single();
  const connection = data as MetaConnectionRow | null;
  if (!connection?.access_token) return null;

  if (connection.token_expiry && new Date(connection.token_expiry) <= new Date()) {
    await supabase
      .from("api_connections")
      .update({ status: "error", error_message: "Token da Meta expirado; reconecte a conta." })
      .eq("provider", "meta_ads")
      .eq("user_id", userId);
    return null;
  }
  return connection.access_token;
}

export async function listMetaAdAccounts(userId: string): Promise<MetaAdAccount[]> {
  const token = await getMetaAccessToken(userId);
  if (!token) return [];

  const rows = await fetchAllPages<{
    id: string;
    name?: string;
    currency?: string;
    timezone_name?: string;
    account_status?: number;
  }>("me/adaccounts", token, {
    fields: "id,name,currency,timezone_name,account_status",
    limit: "200",
  });

  return rows.map((row) => ({
    id: normalizeAccountId(row.id),
    name: row.name || row.id,
    currency: row.currency || "BRL",
    timezoneName: row.timezone_name || "",
    accountStatus: row.account_status ?? 0,
  }));
}

export async function listMetaCampaigns(userId: string, accountId: string): Promise<MetaCampaign[]> {
  const token = await getMetaAccessToken(userId);
  if (!token) return [];
  const normalized = normalizeAccountId(accountId);
  const rows = await fetchAllPages<{
    id: string;
    name?: string;
    status?: string;
    effective_status?: string;
    daily_budget?: string;
    lifetime_budget?: string;
  }>(`${normalized}/campaigns`, token, {
    fields: "id,name,status,effective_status,daily_budget,lifetime_budget",
    limit: "200",
  });

  return rows.map((row) => ({
    id: row.id,
    accountId: normalized,
    name: row.name || row.id,
    status: row.status || "UNKNOWN",
    effectiveStatus: row.effective_status || "UNKNOWN",
    dailyBudget: row.daily_budget,
    lifetimeBudget: row.lifetime_budget,
  }));
}

export function parseMetaInstallActions(actions: RawMetaInsight["actions"]): number {
  if (!actions) return 0;
  const candidates = ["mobile_app_install", "omni_app_install", "app_install"];
  for (const actionType of candidates) {
    const match = actions.find((action) => action.action_type === actionType);
    if (match) return Math.round(toNumber(match.value));
  }
  return 0;
}

export async function fetchMetaDailyInsights(
  userId: string,
  campaignId: string,
  range: { from: string; to: string }
): Promise<MetaDailyInsight[]> {
  const token = await getMetaAccessToken(userId);
  if (!token) throw new Error("Conta Meta Ads não conectada ou token expirado");

  const rows = await fetchAllPages<RawMetaInsight>(`${campaignId}/insights`, token, {
    fields: "date_start,spend,impressions,reach,clicks,actions",
    level: "campaign",
    time_increment: "1",
    time_range: JSON.stringify({ since: range.from, until: range.to }),
    limit: "500",
  });

  return rows
    .filter((row): row is RawMetaInsight & { date_start: string } => Boolean(row.date_start))
    .map((row) => ({
      date: row.date_start,
      spend: toNumber(row.spend),
      impressions: Math.round(toNumber(row.impressions)),
      reach: Math.round(toNumber(row.reach)),
      clicks: Math.round(toNumber(row.clicks)),
      installs: parseMetaInstallActions(row.actions),
    }));
}

export async function fetchCampaignCreatives(userId: string, campaignId: string, range: { from: string; to: string }): Promise<import("@/lib/campaign-detail-types").CreativeResult[]> {
  const token = await getMetaAccessToken(userId);
  if (!token) throw new Error("Meta desconectada ou sessão expirada.");
  type Ad = { id: string; name?: string; effective_status?: string; creative?: { id?: string; thumbnail_url?: string; body?: string; title?: string; object_story_spec?: { video_data?: { message?: string; title?: string }; link_data?: { message?: string; name?: string } } } };
  type Insight = RawMetaInsight & { ad_id?: string; ad_name?: string };
  const [ads, insights] = await Promise.all([
    fetchAllPages<Ad>(`${campaignId}/ads`, token, { fields: "id,name,effective_status,creative{id,thumbnail_url,body,title,object_story_spec}", limit: "100" }),
    fetchAllPages<Insight>(`${campaignId}/insights`, token, { fields: "ad_id,ad_name,spend,impressions,clicks,actions", level: "ad", time_range: JSON.stringify({ since: range.from, until: range.to }), limit: "500" }),
  ]);
  const byId = new Map(insights.filter(i => i.ad_id).map(i => [i.ad_id!, i]));
  const allAds = new Map(ads.map(a => [a.id, a]));
  for (const i of insights) if (i.ad_id && !allAds.has(i.ad_id)) allAds.set(i.ad_id, { id: i.ad_id, name: i.ad_name, effective_status: "UNKNOWN" });
  return [...allAds.values()].map(ad => {
    const row = byId.get(ad.id); const spend = toNumber(row?.spend); const impressions = toNumber(row?.impressions);
    const clicks = toNumber(row?.clicks); const installs = parseMetaInstallActions(row?.actions);
    const creative = ad.creative; const story = creative?.object_story_spec;
    const thumbnail = creative?.thumbnail_url;
    return { id: ad.id, name: ad.name || ad.id, status: ad.effective_status || "UNKNOWN",
      thumbnail: thumbnail?.startsWith("https://") ? thumbnail : null, creativeId: creative?.id || null,
      body: creative?.body || story?.video_data?.message || story?.link_data?.message || "",
      title: creative?.title || story?.video_data?.title || story?.link_data?.name || "",
      spend, impressions, clicks, installs, cpi: installs > 0 ? spend / installs : null, ctr: impressions > 0 ? clicks / impressions * 100 : null };
  }).sort((a, b) => b.spend - a.spend || a.name.localeCompare(b.name));
}

export async function fetchCampaignObservation(userId: string, campaignId: string) {
  const token = await getMetaAccessToken(userId);
  if (!token) throw new Error("Meta desconectada.");
  const campaign = await graphRequest<{ name?: string; status?: string; effective_status?: string; daily_budget?: string; lifetime_budget?: string }>(campaignId, token, { fields: "name,status,effective_status,daily_budget,lifetime_budget" });
  const ads = await fetchAllPages<{ id: string; name?: string; status?: string; creative?: { id?: string } }>(`${campaignId}/ads`, token, { fields: "id,name,status,creative{id}", limit: "100" });
  return { campaign, ads: ads.map(a => ({ id: a.id, name: a.name, status: a.status, creativeId: a.creative?.id || null })).sort((a, b) => a.id.localeCompare(b.id)) };
}
