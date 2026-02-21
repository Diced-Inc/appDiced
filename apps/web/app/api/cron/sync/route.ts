import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { fetchPlayStoreInfo } from "@/lib/google/play-icon";
import {
  fetchAdMobReport,
  listAdMobAccounts,
  listAdMobApps,
  getAdMobAccessToken,
} from "@/lib/google/admob";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const results: Record<string, string> = {};

  // 1. Play Store sync (ratings + icons)
  try {
    const { data } = await supabase
      .from("apps")
      .select("id, package_name, icon");

    const apps = data as { id: string; package_name: string; icon: string }[] | null;

    for (const app of apps ?? []) {
      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      const info = await fetchPlayStoreInfo(app.package_name);
      if (info.icon && (!app.icon || !app.icon.startsWith("http"))) {
        updates.icon = info.icon;
      }
      if (info.rating !== null) updates.rating = info.rating;
      if (info.downloads !== null) updates.downloads = info.downloads;

      if (Object.keys(updates).length > 1) {
        await supabase.from("apps").update(updates).eq("id", app.id);
      }
    }
    results.playStore = "success";
  } catch (e) {
    results.playStore = `error: ${e instanceof Error ? e.message : String(e)}`;
  }

  // 2. AdMob sync (revenue + auto-discovery)
  try {
    const token = await getAdMobAccessToken();
    if (!token) {
      results.admob = "skipped: no token";
    } else {
      const { data: connData } = await supabase
        .from("api_connections")
        .select("config")
        .eq("provider", "admob")
        .single();

      const connection = connData as { config: Record<string, string> } | null;
      let accountId = connection?.config?.account_id;

      if (!accountId) {
        const account = await listAdMobAccounts();
        if (!account) throw new Error("No AdMob account found");
        accountId = account;
        await supabase
          .from("api_connections")
          .update({ config: { account_id: accountId } })
          .eq("provider", "admob");
      }

      // Auto-discover apps
      try {
        const admobApps = await listAdMobApps(accountId);
        for (const admobApp of admobApps) {
          if (admobApp.platform !== "ANDROID") continue;
          const packageName = admobApp.linkedAppInfo?.appStoreId;
          if (!packageName) continue;

          const { data: existing } = await supabase
            .from("apps")
            .select("id")
            .eq("package_name", packageName)
            .single();

          if (!existing) {
            const displayName = admobApp.linkedAppInfo?.displayName ?? packageName;
            const storeInfo = await fetchPlayStoreInfo(packageName);
            await supabase.from("apps").insert({
              name: displayName,
              package_name: packageName,
              icon: storeInfo.icon ?? "📱",
              status: "published",
              rating: storeInfo.rating ?? 0,
              downloads: storeInfo.downloads ?? 0,
              revenue: 0,
              impressions: 0,
              ecpm: 0,
            });
          }
        }
      } catch (e) {
        console.error("[Cron] Auto-discovery failed:", e);
      }

      // Fetch revenue
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const report = await fetchAdMobReport(
        accountId,
        {
          year: startDate.getFullYear(),
          month: startDate.getMonth() + 1,
          day: startDate.getDate(),
        },
        {
          year: endDate.getFullYear(),
          month: endDate.getMonth() + 1,
          day: endDate.getDate(),
        }
      );

      const { data: appsData } = await supabase.from("apps").select("id").limit(1);
      const apps = appsData as { id: string }[] | null;
      const appId = apps?.[0]?.id;

      if (appId) {
        interface ReportRow {
          row?: {
            dimensionValues?: { DATE?: { value?: string } };
            metricValues?: {
              ESTIMATED_EARNINGS?: { microsValue?: string };
              IMPRESSIONS?: { integerValue?: string };
            };
          };
        }

        let totalRevenue = 0;
        let totalImpressions = 0;
        const rows = Array.isArray(report)
          ? report.filter((item: ReportRow) => item.row).map((item: ReportRow) => item.row!)
          : [];

        for (const row of rows) {
          const dateStr = row.dimensionValues?.DATE?.value;
          const earningsMicros = row.metricValues?.ESTIMATED_EARNINGS?.microsValue;
          const impressions = row.metricValues?.IMPRESSIONS?.integerValue;
          if (!dateStr) continue;

          const revenue = earningsMicros ? Number(earningsMicros) / 1_000_000 : 0;
          totalRevenue += revenue;
          totalImpressions += impressions ? Number(impressions) : 0;

          const formattedDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
          await supabase.from("daily_revenue").upsert(
            { app_id: appId, date: formattedDate, revenue: Math.round(revenue * 100) / 100 },
            { onConflict: "app_id,date" }
          );
        }

        const ecpm = totalImpressions > 0
          ? Math.round((totalRevenue / totalImpressions) * 1000 * 100) / 100
          : 0;

        await supabase.from("apps").update({
          revenue: Math.round(totalRevenue * 100) / 100,
          impressions: totalImpressions,
          ecpm,
          updated_at: new Date().toISOString(),
        }).eq("id", appId);
      }

      await supabase
        .from("api_connections")
        .update({
          last_sync: new Date().toISOString(),
          status: "connected",
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq("provider", "admob");

      results.admob = "success";
    }
  } catch (e) {
    results.admob = `error: ${e instanceof Error ? e.message : String(e)}`;
  }

  return NextResponse.json({ results });
}
