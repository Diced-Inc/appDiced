import { getSupabaseAdmin } from "@/lib/supabase/server";
import { toBrazilDateStr } from "@/lib/date";
import type { DicedApp, DailyRevenue, DashboardSummary, CountryRevenue, AdUnitRevenue } from "./types";

interface AppRow {
  id: string;
  name: string;
  package_name: string;
  icon: string;
  status: string;
  rating: number;
  downloads: number;
  revenue: number;
  impressions: number;
  ecpm: number;
}

interface RevenueRow {
  date: string;
  revenue: number;
  app_id: string;
}

function mapAppRow(row: AppRow): DicedApp {
  return {
    id: row.id,
    name: row.name,
    packageName: row.package_name,
    icon: row.icon,
    status: row.status as DicedApp["status"],
    rating: Number(row.rating),
    downloads: Number(row.downloads),
    revenue: Number(row.revenue),
    impressions: Number(row.impressions),
    ecpm: Number(row.ecpm),
  };
}

export async function getApps(userId: string): Promise<DicedApp[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("apps")
    .select("id, name, package_name, icon, status, rating, downloads, revenue, impressions, ecpm")
    .eq("user_id", userId)
    .order("name");

  if (error) {
    console.error("Failed to fetch apps:", error);
    return [];
  }

  return ((data as AppRow[]) ?? []).map(mapAppRow);
}

export async function getAppById(id: string, userId: string): Promise<DicedApp | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("apps")
    .select("id, name, package_name, icon, status, rating, downloads, revenue, impressions, ecpm")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;

  return mapAppRow(data as AppRow);
}

export async function getDailyRevenue(userId: string, days: number = 30): Promise<DailyRevenue[]> {
  const supabase = getSupabaseAdmin();
  const since = new Date();
  since.setDate(since.getDate() - days);

  // Get user's app IDs first, then filter revenue
  const { data: appsData } = await supabase
    .from("apps")
    .select("id")
    .eq("user_id", userId);

  const appIds = (appsData as { id: string }[] | null)?.map((a) => a.id) ?? [];
  if (appIds.length === 0) return [];

  const { data, error } = await supabase
    .from("daily_revenue")
    .select("date, revenue, app_id")
    .in("app_id", appIds)
    .gte("date", toBrazilDateStr(since))
    .order("date", { ascending: true });

  if (error) {
    console.error("Failed to fetch daily revenue:", error);
    return [];
  }

  return ((data as RevenueRow[]) ?? []).map((row) => ({
    date: row.date,
    revenue: Math.round(Number(row.revenue) * 100) / 100,
    appId: row.app_id,
  }));
}

interface CountryRevenueRow {
  country_code: string;
  revenue: number;
  impressions: number;
}

export async function getCountryRevenue(userId: string): Promise<CountryRevenue[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("country_revenue")
    .select("country_code, revenue, impressions")
    .eq("user_id", userId)
    .order("revenue", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Failed to fetch country revenue:", error);
    return [];
  }

  return ((data as CountryRevenueRow[]) ?? []).map((row) => ({
    countryCode: row.country_code,
    revenue: Math.round(Number(row.revenue) * 100) / 100,
    impressions: Number(row.impressions),
  }));
}

interface AdUnitRevenueRow {
  ad_unit_id: string;
  ad_unit_name: string;
  revenue: number;
  impressions: number;
}

export async function getAdUnitRevenue(userId: string): Promise<AdUnitRevenue[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("ad_unit_revenue")
    .select("ad_unit_id, ad_unit_name, revenue, impressions")
    .eq("user_id", userId)
    .order("revenue", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Failed to fetch ad unit revenue:", error);
    return [];
  }

  return ((data as AdUnitRevenueRow[]) ?? []).map((row) => {
    const revenue = Math.round(Number(row.revenue) * 10000) / 10000;
    const impressions = Number(row.impressions);
    const ecpm = impressions > 0 ? Math.round((revenue / impressions) * 1000 * 100) / 100 : 0;
    return {
      adUnitId: row.ad_unit_id,
      adUnitName: row.ad_unit_name || row.ad_unit_id,
      revenue,
      impressions,
      ecpm,
    };
  });
}

export async function getYesterdaySameHourRevenue(userId: string): Promise<number | null> {
  const supabase = getSupabaseAdmin();
  const nowBR = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
  const brDate = new Date(nowBR);
  const brHour = brDate.getHours();

  const yesterday = new Date(brDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = toBrazilDateStr(yesterday);

  const { data, error } = await supabase
    .from("revenue_snapshots")
    .select("revenue")
    .eq("user_id", userId)
    .eq("date", yesterdayStr)
    .eq("hour", brHour)
    .single();

  if (error || !data) return null;
  return Math.round(Number((data as { revenue: number }).revenue) * 100) / 100;
}

export async function getSummary(userId: string): Promise<DashboardSummary> {
  const apps = await getApps(userId);

  const totalRevenue = apps.reduce((sum, a) => sum + a.revenue, 0);
  const totalDownloads = apps.reduce((sum, a) => sum + a.downloads, 0);
  const ratedApps = apps.filter((a) => a.rating > 0);
  const averageRating =
    ratedApps.length > 0
      ? Math.round(
          (ratedApps.reduce((sum, a) => sum + a.rating, 0) / ratedApps.length) * 10
        ) / 10
      : 0;

  return {
    totalApps: apps.length,
    totalRevenue,
    totalDownloads,
    averageRating,
    revenueChange: 0,
    downloadsChange: 0,
  };
}
