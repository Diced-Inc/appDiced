import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  fetchAdMobReport,
  listAdMobAccounts,
  listAdMobApps,
} from "@/lib/google/admob";
import { fetchPlayStoreInfo } from "@/lib/google/play-icon";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push";

interface AdMobReportRow {
  dimensionValues?: { DATE?: { value?: string } };
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

  const { data: logData } = await supabase
    .from("sync_log")
    .insert({ provider: "admob", status: "running", user_id: userId } as Record<string, unknown>)
    .select("id")
    .single();

  const logEntry = logData as { id: string } | null;

  try {
    // Get AdMob account ID for this user
    const { data: connData } = await supabase
      .from("api_connections")
      .select("config")
      .eq("provider", "admob")
      .eq("user_id", userId)
      .single();

    const connection = connData as { config: Record<string, string> } | null;
    let accountId = connection?.config?.account_id;

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
          const icon = storeInfo.icon ?? "📱";

          await supabase.from("apps").insert({
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
        }
      }
    } catch (e) {
      console.error("[AdMob] Auto-discovery failed:", e);
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

    // Get user's apps
    const { data: appsData } = await supabase
      .from("apps")
      .select("id")
      .eq("user_id", userId)
      .limit(1);

    const apps = appsData as { id: string }[] | null;
    const appId = apps?.[0]?.id;
    if (!appId) throw new Error("No app found in database");

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
