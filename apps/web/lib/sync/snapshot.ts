import { getSupabaseAdmin } from "@/lib/supabase/server";
import { toBrazilDateStr } from "@/lib/date";
import { round2 } from "@/lib/sync/parse";

/**
 * Grava o snapshot horário da receita de hoje (base do card "Ontem nesse horário").
 * Chamado pelo cron horário e, como fallback, no load das páginas.
 */
export async function saveRevenueSnapshot(userId: string): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    const nowBR = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const todayDateStr = toBrazilDateStr();

    const { data: appsData } = await supabase.from("apps").select("id").eq("user_id", userId);
    const appIds = ((appsData as { id: string }[] | null) ?? []).map((a) => a.id);
    if (appIds.length === 0) return;

    const { data: todayData } = await supabase
      .from("daily_revenue")
      .select("revenue")
      .in("app_id", appIds)
      .eq("date", todayDateStr);
    const todayRev =
      (todayData as { revenue: number }[] | null)?.reduce((s, r) => s + Number(r.revenue), 0) ?? 0;

    await supabase.from("revenue_snapshots").upsert(
      {
        user_id: userId,
        date: todayDateStr,
        hour: nowBR.getHours(),
        revenue: round2(todayRev),
        captured_at: new Date().toISOString(),
      },
      { onConflict: "user_id,date,hour" }
    );
  } catch (e) {
    console.error("[Snapshot] Save failed:", e);
  }
}
