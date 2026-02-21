import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { DicedApp, DailyRevenue, DashboardSummary, CountryRevenue } from "./types";

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
    .gte("date", since.toISOString().split("T")[0])
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
