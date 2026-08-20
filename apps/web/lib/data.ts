import { getSupabaseAdmin } from "@/lib/supabase/server";
import { toBrazilDateStr } from "@/lib/date";
import { resolvePeriod, previousRange, monthOf, type DateRange } from "@/lib/period";
import { round2, ecpm } from "@/lib/sync/parse";
import { fetchAll } from "@/lib/sync/persist";
import { estimatePaymentDate, projectMonthEnd, recomputeMonthlyEarnings } from "@/lib/sync/monthly";
import type {
  DicedApp,
  DailyRevenue,
  DashboardSummary,
  CountryRevenue,
  AdUnitRevenue,
  MonthlyEarning,
} from "./types";

/**
 * Camada de leitura. Fonte de verdade da receita é SEMPRE o livro-razão
 * (daily_revenue) — os campos revenue/impressions/ecpm de DicedApp são
 * agregados computados pro período pedido, nunca lidos de apps.*.
 */

export interface AppMeta {
  id: string;
  name: string;
  packageName: string;
  icon: string;
  status: DicedApp["status"];
  rating: number;
  downloads: number;
}

export interface LedgerRow {
  appId: string;
  date: string;
  revenue: number;
  impressions: number;
}

export async function getAppMeta(userId: string): Promise<AppMeta[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("apps")
    .select("id, name, package_name, icon, status, rating, downloads")
    .eq("user_id", userId)
    .order("name");

  if (error) {
    console.error("Failed to fetch apps:", error);
    return [];
  }

  return (
    (data as {
      id: string;
      name: string;
      package_name: string;
      icon: string;
      status: string;
      rating: number;
      downloads: number;
    }[]) ?? []
  ).map((row) => ({
    id: row.id,
    name: row.name,
    packageName: row.package_name,
    icon: row.icon,
    status: row.status as DicedApp["status"],
    rating: Number(row.rating),
    downloads: Number(row.downloads),
  }));
}

export async function getLedger(
  userId: string,
  range: DateRange,
  appIds?: string[]
): Promise<LedgerRow[]> {
  const supabase = getSupabaseAdmin();
  const ids = appIds ?? (await getAppMeta(userId)).map((a) => a.id);
  if (ids.length === 0) return [];

  const rows = await fetchAll<{ app_id: string; date: string; revenue: number; impressions: number }>(
    supabase,
    "daily_revenue",
    "app_id, date, revenue, impressions",
    (q) => {
      let query = q.in("app_id", ids).lte("date", range.to).order("date", { ascending: true });
      if (range.from) query = query.gte("date", range.from);
      return query;
    }
  );

  return rows.map((r) => ({
    appId: r.app_id,
    date: r.date,
    revenue: Number(r.revenue),
    impressions: Number(r.impressions ?? 0),
  }));
}

/** Combina metadados + agregados do livro-razão no shape DicedApp. */
export function computeAppMetrics(apps: AppMeta[], ledger: LedgerRow[]): DicedApp[] {
  const totals = new Map<string, { revenue: number; impressions: number }>();
  for (const row of ledger) {
    const prev = totals.get(row.appId) ?? { revenue: 0, impressions: 0 };
    totals.set(row.appId, {
      revenue: prev.revenue + row.revenue,
      impressions: prev.impressions + row.impressions,
    });
  }

  return apps.map((app) => {
    const t = totals.get(app.id) ?? { revenue: 0, impressions: 0 };
    return {
      ...app,
      revenue: round2(t.revenue),
      impressions: t.impressions,
      ecpm: ecpm(t.revenue, t.impressions),
    };
  });
}

/** Totais por dia (todas as linhas do razão somadas por data). */
export function computeDailyTotals(ledger: LedgerRow[]): { date: string; revenue: number }[] {
  const byDate = new Map<string, number>();
  for (const row of ledger) {
    byDate.set(row.date, (byDate.get(row.date) ?? 0) + row.revenue);
  }
  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, revenue]) => ({ date, revenue: round2(revenue) }));
}

export async function getApps(
  userId: string,
  range: DateRange = resolvePeriod("30d")
): Promise<DicedApp[]> {
  const apps = await getAppMeta(userId);
  if (apps.length === 0) return [];
  const ledger = await getLedger(userId, range, apps.map((a) => a.id));
  return computeAppMetrics(apps, ledger);
}

export async function getAppById(
  id: string,
  userId: string,
  range: DateRange = resolvePeriod("30d")
): Promise<DicedApp | null> {
  const apps = await getApps(userId, range);
  return apps.find((a) => a.id === id) ?? null;
}

export async function getDailyRevenue(
  userId: string,
  range: DateRange = resolvePeriod("30d")
): Promise<DailyRevenue[]> {
  const ledger = await getLedger(userId, range);
  return ledger.map((r) => ({
    date: r.date,
    revenue: round2(r.revenue),
    impressions: r.impressions,
    appId: r.appId,
  }));
}

export async function getCountryRevenue(
  userId: string,
  range: DateRange = resolvePeriod("30d")
): Promise<CountryRevenue[]> {
  const supabase = getSupabaseAdmin();

  // Agregação no Postgres (RPC) — evita puxar milhares de linhas diárias
  const { data, error } = await supabase.rpc("country_revenue_totals", {
    p_user_id: userId,
    p_from: range.from,
    p_to: range.to,
  });

  if (!error && data) {
    return (data as { country_code: string; revenue: number; impressions: number }[]).map((row) => ({
      countryCode: row.country_code,
      revenue: round2(Number(row.revenue)),
      impressions: Number(row.impressions),
    }));
  }

  // Fallback: agrega em JS (RPC ainda não criada no banco)
  console.error("country_revenue_totals RPC falhou, usando fallback:", error?.message);
  const rows = await fetchAll<{ country_code: string; revenue: number; impressions: number }>(
    supabase,
    "country_revenue",
    "country_code, revenue, impressions",
    (q) => {
      let query = q.eq("user_id", userId).lte("period_start", range.to);
      if (range.from) query = query.gte("period_start", range.from);
      return query;
    }
  );

  const byCountry = new Map<string, { revenue: number; impressions: number }>();
  for (const row of rows) {
    const prev = byCountry.get(row.country_code) ?? { revenue: 0, impressions: 0 };
    byCountry.set(row.country_code, {
      revenue: prev.revenue + Number(row.revenue),
      impressions: prev.impressions + Number(row.impressions),
    });
  }
  return Array.from(byCountry.entries())
    .map(([countryCode, t]) => ({
      countryCode,
      revenue: round2(t.revenue),
      impressions: t.impressions,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

/**
 * Painel de ad units: sempre os últimos 30 dias, linha a linha por dia
 * (o componente tem filtros próprios hoje/ontem/7d/30d).
 */
export async function getAdUnitRevenue(userId: string): Promise<AdUnitRevenue[]> {
  const supabase = getSupabaseAdmin();
  const range = resolvePeriod("30d");

  const rows = await fetchAll<{
    ad_unit_id: string;
    ad_unit_name: string;
    revenue: number;
    impressions: number;
    period_start: string;
  }>(
    supabase,
    "ad_unit_revenue",
    "ad_unit_id, ad_unit_name, revenue, impressions, period_start",
    (q) =>
      q
        .eq("user_id", userId)
        .gte("period_start", range.from!)
        .lte("period_start", range.to)
        .order("period_start", { ascending: false })
  );

  return rows.map((row) => {
    const revenue = Math.round(Number(row.revenue) * 10000) / 10000;
    const impressions = Number(row.impressions);
    return {
      adUnitId: row.ad_unit_id,
      adUnitName: row.ad_unit_name || row.ad_unit_id,
      revenue,
      impressions,
      ecpm: ecpm(revenue, impressions),
      date: row.period_start,
    };
  });
}

export async function getYesterdaySameHourRevenue(userId: string): Promise<number | null> {
  const supabase = getSupabaseAdmin();
  const nowBR = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const brHour = nowBR.getHours();

  const yesterday = new Date(nowBR);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = toBrazilDateStr(yesterday);

  const { data, error } = await supabase
    .from("revenue_snapshots")
    .select("revenue")
    .eq("user_id", userId)
    .eq("date", yesterdayStr)
    .eq("hour", brHour)
    .single();

  if (error || !data) return null;
  return round2(Number((data as { revenue: number }).revenue));
}

export async function getSummary(
  userId: string,
  range: DateRange = resolvePeriod("30d")
): Promise<DashboardSummary> {
  const apps = await getAppMeta(userId);
  const appIds = apps.map((a) => a.id);
  const ledger = appIds.length > 0 ? await getLedger(userId, range, appIds) : [];

  const totalRevenue = round2(ledger.reduce((s, r) => s + r.revenue, 0));
  const totalImpressions = ledger.reduce((s, r) => s + r.impressions, 0);
  const totalDownloads = apps.reduce((s, a) => s + a.downloads, 0);
  const ratedApps = apps.filter((a) => a.rating > 0);
  const averageRating =
    ratedApps.length > 0
      ? Math.round((ratedApps.reduce((s, a) => s + a.rating, 0) / ratedApps.length) * 10) / 10
      : 0;

  // Variação vs janela anterior de mesmo tamanho
  let revenueChange: number | null = null;
  const prev = previousRange(range);
  if (prev && appIds.length > 0) {
    const prevLedger = await getLedger(userId, prev, appIds);
    const prevRevenue = prevLedger.reduce((s, r) => s + r.revenue, 0);
    if (prevRevenue > 0) {
      revenueChange = Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 1000) / 10;
    }
  }

  return {
    totalApps: apps.length,
    totalRevenue,
    totalImpressions,
    totalDownloads,
    averageRating,
    revenueChange,
  };
}

export async function getMonthlyEarnings(userId: string): Promise<MonthlyEarning[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("monthly_earnings")
    .select("month, gross, status, paid_at, paid_amount")
    .eq("user_id", userId)
    .order("month", { ascending: false });

  if (error) {
    console.error("Failed to fetch monthly earnings:", error);
    return [];
  }

  return (
    (data as {
      month: string;
      gross: number;
      status: string;
      paid_at: string | null;
      paid_amount: number | null;
    }[]) ?? []
  ).map((row) => {
    const month = row.month.substring(0, 10);
    return {
      month,
      gross: round2(Number(row.gross)),
      status: row.status as MonthlyEarning["status"],
      paidAt: row.paid_at,
      paidAmount: row.paid_amount !== null ? round2(Number(row.paid_amount)) : null,
      estimatedPayment: estimatePaymentDate(month),
    };
  });
}

export interface Withdrawal {
  id: string;
  amount: number;
  date: string;
  note: string | null;
  created_at: string;
}

export interface BankData {
  /** meses fechados ainda não pagos */
  receivable: number;
  /** soma de tudo que já caiu (withdrawals) */
  receivedLifetime: number;
  currentMonth: { month: string; gross: number; projection: number };
  months: MonthlyEarning[];
  withdrawals: Withdrawal[];
}

export async function getBankData(userId: string): Promise<BankData> {
  const supabase = getSupabaseAdmin();
  const today = toBrazilDateStr();

  let months = await getMonthlyEarnings(userId);

  // Primeira visita pós-migração: materializa o extrato a partir do razão
  if (months.length === 0) {
    await recomputeMonthlyEarnings(userId);
    months = await getMonthlyEarnings(userId);
  }

  const { data: wData } = await supabase
    .from("withdrawals")
    .select("id, amount, date, note, created_at")
    .eq("user_id", userId)
    .order("date", { ascending: false });
  const withdrawals = ((wData as Withdrawal[] | null) ?? []).map((w) => ({
    ...w,
    amount: round2(Number(w.amount)),
  }));

  const receivable = round2(
    months.filter((m) => m.status === "closed").reduce((s, m) => s + m.gross, 0)
  );
  const receivedLifetime = round2(withdrawals.reduce((s, w) => s + w.amount, 0));

  const currentMonthKey = monthOf(today);
  const current = months.find((m) => m.month === currentMonthKey);
  const currentGross = current?.gross ?? 0;

  return {
    receivable,
    receivedLifetime,
    currentMonth: {
      month: currentMonthKey,
      gross: currentGross,
      projection: projectMonthEnd(currentGross, today),
    },
    months,
    withdrawals,
  };
}
