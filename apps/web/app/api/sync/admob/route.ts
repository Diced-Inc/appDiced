import { NextResponse } from "next/server";
import { fetchAdMobReport, listAdMobAccounts } from "@/lib/google/admob";
import { getSupabaseAdmin } from "@/lib/supabase/server";

interface AdMobReportRow {
  dimensionValues?: { DATE?: { value?: string } };
  metricValues?: {
    ESTIMATED_EARNINGS?: { microsValue?: string };
    IMPRESSIONS?: { integerValue?: string };
  };
}

export async function POST() {
  const supabase = getSupabaseAdmin();

  const { data: logData } = await supabase
    .from("sync_log")
    .insert({ provider: "admob", status: "running" } as Record<string, unknown>)
    .select("id")
    .single();

  const logEntry = logData as { id: string } | null;

  try {
    // Get AdMob account ID
    const { data: connData } = await supabase
      .from("api_connections")
      .select("config")
      .eq("provider", "admob")
      .single();

    const connection = connData as { config: Record<string, string> } | null;
    let accountId = connection?.config?.account_id;

    // Auto-discover account if not configured
    if (!accountId) {
      const account = await listAdMobAccounts();
      if (!account) throw new Error("No AdMob account found");
      accountId = account;

      await supabase
        .from("api_connections")
        .update({ config: { account_id: accountId } })
        .eq("provider", "admob");
    }

    // Fetch last 30 days
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

    // Get the Watchio app from Supabase
    const { data: appsData } = await supabase
      .from("apps")
      .select("id")
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

      // Format date as YYYY-MM-DD
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

    // Update app totals
    const ecpm =
      totalImpressions > 0
        ? Math.round((totalRevenue / totalImpressions) * 1000 * 100) / 100
        : 0;

    await supabase
      .from("apps")
      .update({
        revenue: Math.round(totalRevenue * 100) / 100,
        impressions: totalImpressions,
        ecpm,
        updated_at: new Date().toISOString(),
      })
      .eq("id", appId);

    // Update sync log
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
      .eq("provider", "admob");

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

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
