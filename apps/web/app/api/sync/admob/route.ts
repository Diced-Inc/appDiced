import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  fetchAdMobReport,
  fetchAdMobCountryReport,
  fetchAdMobAdUnitReport,
  listAdMobAccounts,
  listAdMobApps,
} from "@/lib/google/admob";
import { fetchPlayStoreInfo } from "@/lib/google/play-icon";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push";
import { toBrazilDateStr } from "@/lib/date";

interface AdMobReportRow {
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
}

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  // Check if user has an AdMob connection before doing anything
  const { data: connData } = await supabase
    .from("api_connections")
    .select("config, refresh_token")
    .eq("provider", "admob")
    .eq("user_id", userId)
    .single();

  const connection = connData as { config: Record<string, string>; refresh_token: string | null } | null;

  if (!connection?.refresh_token) {
    return NextResponse.json({ skipped: true, reason: "not_connected" });
  }

  const { data: logData } = await supabase
    .from("sync_log")
    .insert({ provider: "admob", status: "running", user_id: userId } as Record<string, unknown>)
    .select("id")
    .single();

  const logEntry = logData as { id: string } | null;

  try {
    let accountId = connection.config?.account_id;

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

    // Auto-discover new apps from AdMob
    const admobApps = await listAdMobApps(userId, accountId);
    console.log(`[AdMob] Found ${admobApps.length} apps in account`);

    // Clean up ALL junk app entries with ca-app-pub-* as package_name
    const { data: junkApps } = await supabase
      .from("apps")
      .select("id, package_name")
      .eq("user_id", userId)
      .like("package_name", "ca-app-pub-%");

    if (junkApps && junkApps.length > 0) {
      const junkIds = (junkApps as { id: string; package_name: string }[]).map((a) => a.id);
      await supabase.from("daily_revenue").delete().in("app_id", junkIds);
      await supabase.from("apps").delete().in("id", junkIds);
      console.log(`[AdMob] Cleaned up ${junkIds.length} junk app entries`);
    }

    for (const admobApp of admobApps) {
      const packageName = admobApp.linkedAppInfo?.appStoreId;
      if (!packageName) {
        console.log(`[AdMob] Skipping unlinked app: ${admobApp.appId}`);
        continue;
      }

      const displayName =
        admobApp.linkedAppInfo?.displayName ??
        admobApp.manualAppInfo?.displayName ??
        packageName;

      console.log(`[AdMob] Processing app: ${displayName} (${packageName}, platform: ${admobApp.platform})`);

      const { data: existing } = await supabase
        .from("apps")
        .select("id")
        .eq("package_name", packageName)
        .eq("user_id", userId)
        .single();

      if (!existing) {
        const storeInfo = await fetchPlayStoreInfo(packageName);

        const { error: insertError } = await supabase.from("apps").insert({
          name: displayName,
          package_name: packageName,
          icon: storeInfo.icon ?? "📱",
          status: "published",
          rating: 0,
          downloads: 0,
          revenue: 0,
          impressions: 0,
          ecpm: 0,
          user_id: userId,
        });

        if (insertError) {
          console.error(`[AdMob] Insert failed for ${packageName}:`, insertError.message);
        } else {
          console.log(`[AdMob] Discovered app: ${displayName} (${packageName})`);
        }
      }
    }

    // Fetch last 30 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const report = await fetchAdMobReport(
      userId,
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

    // Get user's apps with package_name for mapping
    const { data: appsData } = await supabase
      .from("apps")
      .select("id, package_name, revenue")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    const allApps = (appsData as { id: string; package_name: string; revenue: number }[] | null) ?? [];
    const allAppIds = allApps.map((a) => a.id);

    if (allApps.length === 0) {
      console.log(`[AdMob] No apps found for user ${userId}. AdMob returned ${admobApps.length} apps.`);

      if (logEntry) {
        await supabase
          .from("sync_log")
          .update({ status: "success", ended_at: new Date().toISOString() })
          .eq("id", logEntry.id);
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

      return NextResponse.json({
        success: true,
        warning: "No apps found in AdMob account. Make sure your apps are linked in AdMob.",
        admobAppsFound: admobApps.length,
      });
    }

    // Build mapping: AdMob appId/resource name → database app id
    const admobIdToDbId = new Map<string, string>();
    for (const admobApp of admobApps) {
      const pkg = admobApp.linkedAppInfo?.appStoreId;
      if (!pkg) continue;
      const dbApp = allApps.find((a) => a.package_name === pkg);
      if (dbApp) {
        // Map by appId (ca-app-pub-XXX~YYY)
        admobIdToDbId.set(admobApp.appId, dbApp.id);
        // Map by resource name (accounts/pub-XXX/apps/YYY)
        admobIdToDbId.set(admobApp.name, dbApp.id);
        console.log(`[AdMob] Mapped ${admobApp.appId} / ${admobApp.name} → ${pkg} (${dbApp.id})`);
      }
    }
    console.log(`[AdMob] Mapping has ${admobIdToDbId.size} entries for ${allApps.length} apps`);

    const oldTotalRevenue = allApps.reduce((s, a) => s + (a.revenue ?? 0), 0);

    // Delete ALL old daily_revenue for user's apps (replaced each sync)
    if (allAppIds.length > 0) {
      await supabase.from("daily_revenue").delete().in("app_id", allAppIds);
    }

    // Parse report rows — now with per-app data (DATE + APP dimensions)
    const perAppTotals = new Map<string, { revenue: number; impressions: number }>();
    // Aggregate daily revenue per (app_id, date) to handle multiple AdMob apps
    // mapping to the same DB app (e.g. Android + iOS versions)
    const dailyPerApp = new Map<string, number>();
    let totalRevenue = 0;
    let totalImpressions = 0;

    const rows: AdMobReportRow[] = Array.isArray(report)
      ? report.filter((item: { row?: unknown }) => item.row).map((item: { row: AdMobReportRow }) => item.row)
      : [];

    for (const row of rows) {
      const dateStr = row.dimensionValues?.DATE?.value;
      const admobAppId = row.dimensionValues?.APP?.value;
      const earningsMicros = row.metricValues?.ESTIMATED_EARNINGS?.microsValue;
      const impressions = row.metricValues?.IMPRESSIONS?.integerValue;

      if (!dateStr) continue;

      // Map AdMob app to database app; fallback to first app
      const dbAppId = admobIdToDbId.get(admobAppId ?? "") ?? allApps[0]!.id;
      if (admobAppId && !admobIdToDbId.has(admobAppId)) {
        console.log(`[AdMob] UNMAPPED app dimension: "${admobAppId}" — falling back to first app`);
      }

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
      console.error("[AdMob] Snapshot save failed:", e);
    }

    // Notify if total revenue increased by at least $1.00
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
        console.error("[Push] Failed to send notification:", e);
      }
    }

    // Sync country revenue data
    try {
      const countryReport = await fetchAdMobCountryReport(
        userId,
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

      const countryRows: AdMobReportRow[] = Array.isArray(countryReport)
        ? countryReport
            .filter((item: { row?: unknown }) => item.row)
            .map((item: { row: AdMobReportRow }) => item.row)
        : [];

      const periodStart = startDate.toISOString().split("T")[0];
      const periodEnd = endDate.toISOString().split("T")[0];

      // Delete ALL old country data for user (snapshot — replaced each sync)
      await supabase
        .from("country_revenue")
        .delete()
        .eq("user_id", userId);

      for (const row of countryRows) {
        const countryCode = row.dimensionValues?.COUNTRY?.value;
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
      console.error("[AdMob] Country report sync failed:", e);
    }

    // Sync ad unit revenue data
    try {
      const adUnitReport = await fetchAdMobAdUnitReport(
        userId,
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

      const adUnitRows: AdMobReportRow[] = Array.isArray(adUnitReport)
        ? adUnitReport
            .filter((item: { row?: unknown }) => item.row)
            .map((item: { row: AdMobReportRow }) => item.row)
        : [];

      // Delete ALL old ad unit data for user (snapshot — replaced each sync)
      await supabase
        .from("ad_unit_revenue")
        .delete()
        .eq("user_id", userId);

      // Aggregate by (ad_unit, date) to handle multiple rows mapping to same combo
      const adUnitDaily = new Map<string, { name: string; revenue: number; impressions: number }>();
      for (const row of adUnitRows) {
        const dateStr = row.dimensionValues?.DATE?.value;
        const adUnitId = row.dimensionValues?.AD_UNIT?.value;
        const adUnitName = row.dimensionValues?.AD_UNIT?.displayLabel ?? adUnitId ?? "";
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
      console.error("[AdMob] Ad unit report sync failed:", e);
    }

    if (logEntry) {
      await supabase
        .from("sync_log")
        .update({ status: "success", ended_at: new Date().toISOString() })
        .eq("id", logEntry.id);
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

    return NextResponse.json({
      success: true,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalImpressions,
      dailyEntries: dailyPerApp.size,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (logEntry) {
      await supabase
        .from("sync_log")
        .update({
          status: "error",
          message,
          ended_at: new Date().toISOString(),
        })
        .eq("id", logEntry.id);
    }

    console.error("[AdMob Sync Error]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
