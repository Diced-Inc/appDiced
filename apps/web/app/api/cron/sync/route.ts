import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { fetchPlayStoreInfo } from "@/lib/google/play-icon";
import {
  fetchAdMobReport,
  fetchAdMobCountryReport,
  fetchAdMobAdUnitReport,
  listAdMobAccounts,
  listAdMobApps,
  getAdMobAccessToken,
} from "@/lib/google/admob";
import { sendPushToUser } from "@/lib/push";
import { toBrazilDateStr } from "@/lib/date";

interface ApiConnection {
  user_id: string;
  config: Record<string, string> | null;
}

interface ReportRow {
  row?: {
    dimensionValues?: {
      DATE?: { value?: string };
      APP?: { value?: string; displayLabel?: string };
      COUNTRY?: { value?: string };
      AD_UNIT?: { value?: string; displayLabel?: string };
    };
    metricValues?: {
      ESTIMATED_EARNINGS?: { microsValue?: string };
      IMPRESSIONS?: { integerValue?: string };
    };
  };
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const results: Record<string, unknown> = {};

  // Get all distinct user_ids that have apps
  const { data: usersData } = await supabase
    .from("apps")
    .select("user_id")
    .not("user_id", "is", null);

  const userIds = [
    ...new Set(
      (usersData as { user_id: string }[] | null)?.map((u) => u.user_id) ?? []
    ),
  ];

  // 1. Play Store sync per user
  for (const userId of userIds) {
    try {
      const { data } = await supabase
        .from("apps")
        .select("id, package_name, icon")
        .eq("user_id", userId);

      const apps =
        (data as { id: string; package_name: string; icon: string }[] | null) ??
        [];

      for (const app of apps) {
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
      results[`playStore_${userId}`] = "success";
    } catch (e) {
      results[`playStore_${userId}`] =
        `error: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  // 2. AdMob sync per user (only users with admob connection)
  const { data: admobConns } = await supabase
    .from("api_connections")
    .select("user_id, config")
    .eq("provider", "admob")
    .not("user_id", "is", null);

  const connections = (admobConns as ApiConnection[] | null) ?? [];

  for (const conn of connections) {
    const userId = conn.user_id;
    try {
      const token = await getAdMobAccessToken(userId);
      if (!token) {
        results[`admob_${userId}`] = "skipped: no token";
        continue;
      }

      let accountId = conn.config?.account_id;

      if (!accountId) {
        const account = await listAdMobAccounts(userId);
        if (!account) throw new Error("No AdMob account found");
        accountId = account;
        await supabase
          .from("api_connections")
          .update({ config: { account_id: accountId } })
          .eq("provider", "admob")
          .eq("user_id", userId);
      }

      // Auto-discover apps
      try {
        // Clean up ALL junk app entries with ca-app-pub-* as package_name
        const { data: junkApps } = await supabase
          .from("apps")
          .select("id")
          .eq("user_id", userId)
          .like("package_name", "ca-app-pub-%");

        if (junkApps && junkApps.length > 0) {
          const junkIds = (junkApps as { id: string }[]).map((a) => a.id);
          await supabase.from("daily_revenue").delete().in("app_id", junkIds);
          await supabase.from("apps").delete().in("id", junkIds);
          console.log(`[Cron] Cleaned up ${junkIds.length} junk app entries for ${userId}`);
        }

        const admobApps = await listAdMobApps(userId, accountId);
        for (const admobApp of admobApps) {
          const packageName = admobApp.linkedAppInfo?.appStoreId;
          if (!packageName) continue;

          const { data: existing } = await supabase
            .from("apps")
            .select("id")
            .eq("package_name", packageName)
            .eq("user_id", userId)
            .single();

          if (!existing) {
            const displayName =
              admobApp.linkedAppInfo?.displayName ?? packageName;
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
              user_id: userId,
            });
          }
        }
      } catch (e) {
        console.error(`[Cron] Auto-discovery failed for ${userId}:`, e);
      }

      // Fetch revenue
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const report = await fetchAdMobReport(userId, accountId, {
        year: startDate.getFullYear(),
        month: startDate.getMonth() + 1,
        day: startDate.getDate(),
      }, {
        year: endDate.getFullYear(),
        month: endDate.getMonth() + 1,
        day: endDate.getDate(),
      });

      const { data: appsData } = await supabase
        .from("apps")
        .select("id, package_name, revenue")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      const allApps = (appsData as { id: string; package_name: string; revenue: number }[] | null) ?? [];
      const allAppIds = allApps.map((a) => a.id);

      if (allApps.length > 0) {
        // Build mapping: AdMob appId/resource name → database app id
        const admobIdToDbId = new Map<string, string>();
        try {
          const admobAppsList = await listAdMobApps(userId, accountId);
          for (const admobApp of admobAppsList) {
            const pkg = admobApp.linkedAppInfo?.appStoreId;
            if (!pkg) continue;
            const dbApp = allApps.find((a) => a.package_name === pkg);
            if (dbApp) {
              admobIdToDbId.set(admobApp.appId, dbApp.id);
              admobIdToDbId.set(admobApp.name, dbApp.id);
            }
          }
        } catch (e) {
          console.error(`[Cron] Failed to list AdMob apps for mapping:`, e);
        }

        const oldTotalRevenue = allApps.reduce((s, a) => s + (a.revenue ?? 0), 0);

        // Delete ALL old daily_revenue for user's apps (replaced each sync)
        if (allAppIds.length > 0) {
          await supabase.from("daily_revenue").delete().in("app_id", allAppIds);
        }

        const perAppTotals = new Map<string, { revenue: number; impressions: number }>();
        const dailyPerApp = new Map<string, number>();
        let totalRevenue = 0;
        let totalImpressions = 0;
        const rows = Array.isArray(report)
          ? report
              .filter((item: ReportRow) => item.row)
              .map((item: ReportRow) => item.row!)
          : [];

        for (const row of rows) {
          const dateStr = row.dimensionValues?.DATE?.value;
          const admobAppId = row.dimensionValues?.APP?.value;
          const earningsMicros =
            row.metricValues?.ESTIMATED_EARNINGS?.microsValue;
          const impressions = row.metricValues?.IMPRESSIONS?.integerValue;
          if (!dateStr) continue;

          // Map AdMob app to database app; fallback to first app
          const dbAppId = admobIdToDbId.get(admobAppId ?? "") ?? allApps[0]!.id;

          const revenue = earningsMicros
            ? Number(earningsMicros) / 1_000_000
            : 0;
          const impressionCount = impressions ? Number(impressions) : 0;
          totalRevenue += revenue;
          totalImpressions += impressionCount;

          // Accumulate per-app totals
          const prev = perAppTotals.get(dbAppId) ?? { revenue: 0, impressions: 0 };
          perAppTotals.set(dbAppId, {
            revenue: prev.revenue + revenue,
            impressions: prev.impressions + impressionCount,
          });

          const formattedDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
          const dailyKey = `${dbAppId}|${formattedDate}`;
          dailyPerApp.set(dailyKey, (dailyPerApp.get(dailyKey) ?? 0) + revenue);
        }

        // Insert aggregated daily revenue (one row per app per date)
        for (const [key, rev] of dailyPerApp) {
          const [appId, date] = key.split("|");
          await supabase.from("daily_revenue").insert({
            app_id: appId,
            date,
            revenue: Math.round(rev * 100) / 100,
          });
        }

        // Update each app with its own revenue totals
        for (const app of allApps) {
          const totals = perAppTotals.get(app.id);
          const appRevenue = totals ? Math.round(totals.revenue * 100) / 100 : 0;
          const appImpressions = totals?.impressions ?? 0;
          const appEcpm = appImpressions > 0
            ? Math.round((totals!.revenue / appImpressions) * 1000 * 100) / 100
            : 0;

          await supabase
            .from("apps")
            .update({
              revenue: appRevenue,
              impressions: appImpressions,
              ecpm: appEcpm,
              updated_at: new Date().toISOString(),
            })
            .eq("id", app.id);
        }

        const newTotalRevenue = Math.round(totalRevenue * 100) / 100;

        // Save revenue snapshot for "yesterday at same time" comparison
        try {
          const nowBR = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
          const brDate = new Date(nowBR);
          const brHour = brDate.getHours();
          const todayDateStr = toBrazilDateStr();

          const { data: todayData } = await supabase
            .from("daily_revenue")
            .select("revenue")
            .in("app_id", allAppIds)
            .eq("date", todayDateStr);
          const todayRev = (todayData as { revenue: number }[] | null)?.reduce((s, r) => s + Number(r.revenue), 0) ?? 0;

          await supabase
            .from("revenue_snapshots")
            .upsert({
              user_id: userId,
              date: todayDateStr,
              hour: brHour,
              revenue: Math.round(todayRev * 100) / 100,
              captured_at: new Date().toISOString(),
            }, { onConflict: "user_id,date,hour" });
        } catch (e) {
          console.error(`[Cron] Snapshot save failed for ${userId}:`, e);
        }

        // Notify user if total revenue increased by at least $1.00
        const diff = newTotalRevenue - oldTotalRevenue;
        if (diff >= 1.00) {
          const sign = diff > 0 ? "+" : "";
          try {
            await sendPushToUser(userId, {
              title: "Receita Atualizada",
              body: `Nova receita: $${newTotalRevenue.toFixed(2)} (${sign}$${diff.toFixed(2)})`,
              url: "/revenue",
            });
          } catch (e) {
            console.error(`[Cron] Push failed for ${userId}:`, e);
          }
        }
      }

      // Country revenue sync
      try {
        const countryReport = await fetchAdMobCountryReport(userId, accountId, {
          year: startDate.getFullYear(),
          month: startDate.getMonth() + 1,
          day: startDate.getDate(),
        }, {
          year: endDate.getFullYear(),
          month: endDate.getMonth() + 1,
          day: endDate.getDate(),
        });

        const countryRows = Array.isArray(countryReport)
          ? countryReport
              .filter((item: ReportRow) => item.row)
              .map((item: ReportRow) => item.row!)
          : [];

        const periodStart = startDate.toISOString().split("T")[0];
        const periodEnd = endDate.toISOString().split("T")[0];

        // Delete ALL old country data for user (snapshot — replaced each sync)
        await supabase
          .from("country_revenue")
          .delete()
          .eq("user_id", userId);

        for (const row of countryRows) {
          const countryCode = (row.dimensionValues as Record<string, { value?: string }> | undefined)?.COUNTRY?.value;
          const earningsMicros = row.metricValues?.ESTIMATED_EARNINGS?.microsValue;
          const impressions = row.metricValues?.IMPRESSIONS?.integerValue;
          if (!countryCode) continue;

          const revenue = earningsMicros ? Number(earningsMicros) / 1_000_000 : 0;
          const impressionCount = impressions ? Number(impressions) : 0;
          if (revenue <= 0 && impressionCount <= 0) continue;

          await supabase.from("country_revenue").insert({
            user_id: userId,
            country_code: countryCode,
            revenue: Math.round(revenue * 100) / 100,
            impressions: impressionCount,
            period_start: periodStart,
            period_end: periodEnd,
          });
        }
      } catch (e) {
        console.error(`[Cron] Country report failed for ${userId}:`, e);
      }

      // Ad unit revenue sync
      try {
        const adUnitReport = await fetchAdMobAdUnitReport(userId, accountId, {
          year: startDate.getFullYear(),
          month: startDate.getMonth() + 1,
          day: startDate.getDate(),
        }, {
          year: endDate.getFullYear(),
          month: endDate.getMonth() + 1,
          day: endDate.getDate(),
        });

        const adUnitRows = Array.isArray(adUnitReport)
          ? adUnitReport
              .filter((item: ReportRow) => item.row)
              .map((item: ReportRow) => item.row!)
          : [];

        // Delete ALL old ad unit data for user (snapshot — replaced each sync)
        await supabase
          .from("ad_unit_revenue")
          .delete()
          .eq("user_id", userId);

        // Aggregate by (ad_unit, date)
        const adUnitDaily = new Map<string, { name: string; revenue: number; impressions: number }>();
        for (const row of adUnitRows) {
          const dateStr = row.dimensionValues?.DATE?.value;
          const adUnitId = (row.dimensionValues as Record<string, { value?: string; displayLabel?: string }> | undefined)?.AD_UNIT?.value;
          const adUnitName = (row.dimensionValues as Record<string, { value?: string; displayLabel?: string }> | undefined)?.AD_UNIT?.displayLabel ?? adUnitId ?? "";
          const earningsMicros = row.metricValues?.ESTIMATED_EARNINGS?.microsValue;
          const impressions = row.metricValues?.IMPRESSIONS?.integerValue;
          if (!adUnitId || !dateStr) continue;

          const revenue = earningsMicros ? Number(earningsMicros) / 1_000_000 : 0;
          const impressionCount = impressions ? Number(impressions) : 0;
          if (revenue <= 0 && impressionCount <= 0) continue;

          const formattedDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
          const key = `${adUnitId}|${formattedDate}`;
          const prev = adUnitDaily.get(key) ?? { name: adUnitName, revenue: 0, impressions: 0 };
          adUnitDaily.set(key, {
            name: adUnitName,
            revenue: prev.revenue + revenue,
            impressions: prev.impressions + impressionCount,
          });
        }

        for (const [key, data] of adUnitDaily) {
          const [adUnitId, date] = key.split("|");
          await supabase.from("ad_unit_revenue").insert({
            user_id: userId,
            ad_unit_id: adUnitId,
            ad_unit_name: data.name,
            revenue: Math.round(data.revenue * 10000) / 10000,
            impressions: data.impressions,
            period_start: date,
            period_end: date,
          });
        }
      } catch (e) {
        console.error(`[Cron] Ad unit report failed for ${userId}:`, e);
      }

      await supabase
        .from("api_connections")
        .update({
          last_sync: new Date().toISOString(),
          status: "connected",
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq("provider", "admob")
        .eq("user_id", userId);

      results[`admob_${userId}`] = "success";
    } catch (e) {
      results[`admob_${userId}`] =
        `error: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  return NextResponse.json({ results });
}
