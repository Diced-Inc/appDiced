import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { DicedApp, DailyRevenue, DashboardSummary } from "./types";

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

export async function getApps(): Promise<DicedApp[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("apps")
    .select("id, name, package_name, icon, status, rating, downloads, revenue, impressions, ecpm")
    .order("name");

  if (error) {
    console.error("Failed to fetch apps:", error);
    return [];
  }

  return ((data as AppRow[]) ?? []).map(mapAppRow);
}

export async function getAppById(id: string): Promise<DicedApp | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("apps")
    .select("id, name, package_name, icon, status, rating, downloads, revenue, impressions, ecpm")
    .eq("id", id)
    .single();

  if (error || !data) return null;

  return mapAppRow(data as AppRow);
}

export async function getDailyRevenue(days: number = 30): Promise<DailyRevenue[]> {
  const supabase = getSupabaseAdmin();
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from("daily_revenue")
    .select("date, revenue, app_id")
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

export async function getSummary(): Promise<DashboardSummary> {
  const apps = await getApps();

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
