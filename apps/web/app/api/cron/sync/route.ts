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

interface ApiConnection {
  user_id: string;
  config: Record<string, string> | null;
}

interface ReportRow {
  row?: {
    dimensionValues?: {
      DATE?: { value?: string };
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
        const admobApps = await listAdMobApps(userId, accountId);
        for (const admobApp of admobApps) {
          if (admobApp.platform !== "ANDROID") continue;
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
        .select("id, revenue")
        .eq("user_id", userId)
        .limit(1);

      const apps = appsData as { id: string; revenue: number }[] | null;
      const appId = apps?.[0]?.id;
      const oldRevenue = apps?.[0]?.revenue ?? 0;

      if (appId) {
        let totalRevenue = 0;
        let totalImpressions = 0;
        const rows = Array.isArray(report)
          ? report
              .filter((item: ReportRow) => item.row)
              .map((item: ReportRow) => item.row!)
          : [];

        for (const row of rows) {
          const dateStr = row.dimensionValues?.DATE?.value;
          const earningsMicros =
            row.metricValues?.ESTIMATED_EARNINGS?.microsValue;
          const impressions = row.metricValues?.IMPRESSIONS?.integerValue;
          if (!dateStr) continue;

          const revenue = earningsMicros
            ? Number(earningsMicros) / 1_000_000
            : 0;
          totalRevenue += revenue;
          totalImpressions += impressions ? Number(impressions) : 0;

          const formattedDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
          await supabase.from("daily_revenue").upsert(
            {
              app_id: appId,
              date: formattedDate,
              revenue: Math.round(revenue * 100) / 100,
            },
            { onConflict: "app_id,date" }
          );
        }

        const ecpm =
          totalImpressions > 0
            ? Math.round(
                (totalRevenue / totalImpressions) * 1000 * 100
              ) / 100
            : 0;

        const newRevenue = Math.round(totalRevenue * 100) / 100;

        await supabase
          .from("apps")
          .update({
            revenue: newRevenue,
            impressions: totalImpressions,
            ecpm,
            updated_at: new Date().toISOString(),
          })
          .eq("id", appId);

        // Notify user if revenue increased by at least $0.20
        const diff = newRevenue - oldRevenue;
        if (diff >= 0.20) {
          const sign = diff > 0 ? "+" : "";
          try {
            await sendPushToUser(userId, {
              title: "Receita Atualizada",
              body: `Nova receita: $${newRevenue.toFixed(2)} (${sign}$${diff.toFixed(2)})`,
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

        await supabase
          .from("country_revenue")
          .delete()
          .eq("user_id", userId)
          .eq("period_start", periodStart)
          .eq("period_end", periodEnd);

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

        const periodStart = startDate.toISOString().split("T")[0];
        const periodEnd = endDate.toISOString().split("T")[0];

        await supabase
          .from("ad_unit_revenue")
          .delete()
          .eq("user_id", userId)
          .eq("period_start", periodStart)
          .eq("period_end", periodEnd);

        for (const row of adUnitRows) {
          const adUnitId = (row.dimensionValues as Record<string, { value?: string; displayLabel?: string }> | undefined)?.AD_UNIT?.value;
          const adUnitName = (row.dimensionValues as Record<string, { value?: string; displayLabel?: string }> | undefined)?.AD_UNIT?.displayLabel ?? adUnitId ?? "";
          const earningsMicros = row.metricValues?.ESTIMATED_EARNINGS?.microsValue;
          const impressions = row.metricValues?.IMPRESSIONS?.integerValue;
          if (!adUnitId) continue;

          const revenue = earningsMicros ? Number(earningsMicros) / 1_000_000 : 0;
          const impressionCount = impressions ? Number(impressions) : 0;
          if (revenue <= 0 && impressionCount <= 0) continue;

          await supabase.from("ad_unit_revenue").insert({
            user_id: userId,
            ad_unit_id: adUnitId,
            ad_unit_name: adUnitName,
            revenue: Math.round(revenue * 10000) / 10000,
            impressions: impressionCount,
            period_start: periodStart,
            period_end: periodEnd,
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
