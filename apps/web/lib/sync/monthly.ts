import { getSupabaseAdmin } from "@/lib/supabase/server";
import { toBrazilDateStr } from "@/lib/date";
import { monthOf } from "@/lib/period";
import { round2 } from "@/lib/sync/parse";
import { fetchAll, chunkedUpsert } from "@/lib/sync/persist";

/** Dia estimado do pagamento AdMob no mês seguinte ao fechamento. */
const ADMOB_PAYMENT_DAY = 21;

export type MonthStatus = "open" | "closed" | "paid";

/** Mês anterior ao corrente = fechado; corrente = aberto. Pago só via ação do usuário. */
export function computeMonthStatus(month: string, today: string): Exclude<MonthStatus, "paid"> {
  return month < monthOf(today) ? "closed" : "open";
}

/** "2026-08-01" → "2026-09-21" (data estimada do pagamento do mês). */
export function estimatePaymentDate(month: string): string {
  const d = new Date(`${month}T12:00:00`);
  d.setMonth(d.getMonth() + 1);
  d.setDate(ADMOB_PAYMENT_DAY);
  return d.toISOString().split("T")[0]!;
}

/** Agrupa linhas diárias por mês (YYYY-MM-01 → receita bruta). */
export function groupByMonth(rows: { date: string; revenue: number }[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const m = monthOf(row.date);
    map.set(m, (map.get(m) ?? 0) + row.revenue);
  }
  return map;
}

/** Projeção de fim de mês pelo ritmo corrente. */
export function projectMonthEnd(grossSoFar: number, today: string): number {
  const d = new Date(`${today}T12:00:00`);
  const dayOfMonth = d.getDate();
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  if (dayOfMonth === 0) return grossSoFar;
  return round2((grossSoFar / dayOfMonth) * daysInMonth);
}

/**
 * Recalcula monthly_earnings a partir do livro-razão (daily_revenue).
 * `gross` é sempre derivado; status `paid` nunca é rebaixado automaticamente.
 */
export async function recomputeMonthlyEarnings(userId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const today = toBrazilDateStr();

  const { data: appsData } = await supabase.from("apps").select("id").eq("user_id", userId);
  const appIds = ((appsData as { id: string }[] | null) ?? []).map((a) => a.id);
  if (appIds.length === 0) return;

  const ledger = await fetchAll<{ date: string; revenue: number }>(
    supabase,
    "daily_revenue",
    "date, revenue",
    (q) => q.in("app_id", appIds)
  );

  const byMonth = groupByMonth(
    ledger.map((r) => ({ date: r.date, revenue: Number(r.revenue) }))
  );
  if (byMonth.size === 0) return;

  const { data: existingData } = await supabase
    .from("monthly_earnings")
    .select("month, status")
    .eq("user_id", userId);
  const existingStatus = new Map(
    ((existingData as { month: string; status: string }[] | null) ?? []).map((r) => [
      monthOf(r.month),
      r.status,
    ])
  );

  const rows = Array.from(byMonth.entries()).map(([month, gross]) => ({
    user_id: userId,
    month,
    gross: round2(gross),
    status: existingStatus.get(month) === "paid" ? "paid" : computeMonthStatus(month, today),
    updated_at: new Date().toISOString(),
  }));

  await chunkedUpsert(supabase, "monthly_earnings", rows, "user_id,month");
}
