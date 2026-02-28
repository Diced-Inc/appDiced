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

    for (const admobApp of admobApps) {
      const packageName = admobApp.linkedAppInfo?.appStoreId ?? admobApp.appId;
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
        let icon = "📱";
        if (admobApp.linkedAppInfo?.appStoreId) {
          const storeInfo = await fetchPlayStoreInfo(packageName);
          icon = storeInfo.icon ?? "📱";
        }

        const { error: insertError } = await supabase.from("apps").insert({
          name: displayName,
          package_name: packageName,
          icon,
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
          // If unique constraint on package_name alone, try updating existing row to claim it
          const { error: claimError } = await supabase
            .from("apps")
            .update({ user_id: userId, updated_at: new Date().toISOString() })
            .eq("package_name", packageName)
            .is("user_id", null);

          if (claimError) {
            console.error(`[AdMob] Claim also failed for ${packageName}:`, claimError.message);
          }
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

    // Get user's apps — pick first as revenue target, track all IDs
    const { data: appsData } = await supabase
      .from("apps")
      .select("id")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    const allApps = (appsData as { id: string }[] | null) ?? [];
    const appId = allApps[0]?.id;
    const allAppIds = allApps.map((a) => a.id);

    if (!appId) {
      // No apps found — still mark connection as successful
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

    // Delete ALL old daily_revenue for user's apps (account-level snapshot)
    if (allAppIds.length > 0) {
      await supabase.from("daily_revenue").delete().in("app_id", allAppIds);
    }

    // Reset revenue on all apps except the target
    if (allAppIds.length > 1) {
      await supabase
        .from("apps")
        .update({ revenue: 0, impressions: 0, ecpm: 0, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .neq("id", appId);
    }

    // Parse report rows
    let totalRevenue = 0;
    let totalImpressions = 0;

    const rows: AdMobReportRow[] = Array.isArray(report)
      ? report.filter((item: { row?: unknown }) => item.row).map((item: { row: AdMobReportRow }) => item.row)
      : [];

    for (const row of rows) {
      const dateStr = row.dimensionValues?.DATE?.value;
      const earningsMicros = row.metricValues?.ESTIMATED_EARNINGS?.microsValue;
      const impressions = row.metricValues?.IMPRESSIONS?.integerValue;

      if (!dateStr) continue;

      const revenue = earningsMicros
        ? Number(earningsMicros) / 1_000_000
        : 0;
      const impressionCount = impressions ? Number(impressions) : 0;

      totalRevenue += revenue;
      totalImpressions += impressionCount;

      const formattedDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;

      await supabase.from("daily_revenue").insert({
        app_id: appId,
        date: formattedDate,
        revenue: Math.round(revenue * 100) / 100,
      });
    }

    const ecpm =
      totalImpressions > 0
        ? Math.round((totalRevenue / totalImpressions) * 1000 * 100) / 100
        : 0;

    const newRevenue = Math.round(totalRevenue * 100) / 100;

    // Get old revenue to detect changes
    const { data: oldApp } = await supabase
      .from("apps")
      .select("revenue")
      .eq("id", appId)
      .single();
    const oldRevenue = (oldApp as { revenue: number } | null)?.revenue ?? 0;

    await supabase
      .from("apps")
      .update({
        revenue: newRevenue,
        impressions: totalImpressions,
        ecpm,
        updated_at: new Date().toISOString(),
      })
      .eq("id", appId);

    // Save revenue snapshot for "yesterday at same time" comparison
    try {
      const nowBR = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
      const brDate = new Date(nowBR);
      const brHour = brDate.getHours();
      const todayDateStr = toBrazilDateStr();

      const { data: todayData } = await supabase
        .from("daily_revenue")
        .select("revenue")
        .eq("app_id", appId)
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

    // Notify if revenue increased by at least $0.20
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

      const periodStart = startDate.toISOString().split("T")[0];
      const periodEnd = endDate.toISOString().split("T")[0];

      // Delete ALL old ad unit data for user (snapshot — replaced each sync)
      await supabase
        .from("ad_unit_revenue")
        .delete()
        .eq("user_id", userId);

      for (const row of adUnitRows) {
        const adUnitId = row.dimensionValues?.AD_UNIT?.value;
        const adUnitName = row.dimensionValues?.AD_UNIT?.displayLabel ?? adUnitId ?? "";
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

    return NextResponse.json({ success: true, totalRevenue, totalImpressions });
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
