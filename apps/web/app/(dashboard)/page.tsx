import { auth } from "@clerk/nextjs/server";
import { Header } from "@/components/header";
import { RevenueChart } from "@/components/revenue-chart";
import { TopApps } from "@/components/top-apps";
import { PeriodSelector } from "@/components/period-selector";
import { KpiCard } from "@diced/ui/kpi-card";
import { Card } from "@diced/ui/card";
import { KpiIcons } from "@/components/kpi-icons";
import {
  getSummary,
  getDailyRevenue,
  getApps,
  getYesterdaySameHourRevenue,
  getBankData,
  computeDailyTotals,
} from "@/lib/data";
import { saveRevenueSnapshot } from "@/lib/sync/snapshot";
import { toBrazilDateStr } from "@/lib/date";
import {
  resolvePeriod,
  comparisonRange,
  isPeriodKey,
  PERIOD_LABELS,
  type PeriodKey,
  type DateRange,
} from "@/lib/period";
import { ecpm } from "@/lib/sync/parse";

export const dynamic = "force-dynamic";

const ADMOB_THRESHOLD = 100;

function fmt(v: number) {
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtBRL(v: number) {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function monthName(month: string) {
  const s = new Date(`${month}T12:00:00`).toLocaleDateString("pt-BR", { month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Próximo dia ~21 (data do repasse do AdMob). */
function nextPaymentDate(today: string): string {
  const d = new Date(`${today}T12:00:00`);
  const target = d.getDate() <= 21 ? new Date(d.getFullYear(), d.getMonth(), 21, 12) : new Date(d.getFullYear(), d.getMonth() + 1, 21, 12);
  return target.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

async function getUsdBrl(): Promise<number | null> {
  try {
    const res = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL", { next: { revalidate: 3600 } });
    const data = await res.json();
    return parseFloat(data?.USDBRL?.bid) || null;
  } catch {
    return null;
  }
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) return null;

  const { period } = await searchParams;
  const periodKey: PeriodKey = isPeriodKey(period) ? period : "month";
  const range = resolvePeriod(periodKey);

  const todayStr = toBrazilDateStr();
  const heroSince = new Date(`${todayStr}T12:00:00`);
  heroSince.setDate(heroSince.getDate() - 7);
  const heroRange: DateRange = { from: heroSince.toISOString().split("T")[0]!, to: todayStr };

  const [monthSummary, bank, heroDaily, periodDaily, apps, yesterdaySameHour, usdBrl] =
    await Promise.all([
      getSummary(userId, resolvePeriod("month"), comparisonRange("month")),
      getBankData(userId),
      getDailyRevenue(userId, heroRange),
      getDailyRevenue(userId, range),
      getApps(userId, range),
      getYesterdaySameHourRevenue(userId),
      getUsdBrl(),
    ]);

  // Snapshot da hora corrente (fire and forget — o cron horário é o titular)
  saveRevenueSnapshot(userId);

  // --- Heros (independentes do seletor) ---
  const heroByDate = new Map<string, number>();
  for (const r of heroDaily) heroByDate.set(r.date, (heroByDate.get(r.date) ?? 0) + r.revenue);

  const yesterdayDate = new Date(`${todayStr}T12:00:00`);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toISOString().split("T")[0]!;

  const todayRevenue = Math.round((heroByDate.get(todayStr) ?? 0) * 100) / 100;
  const yesterdayRevenue = Math.round((heroByDate.get(yesterdayStr) ?? 0) * 100) / 100;

  const sameHourDiff = yesterdaySameHour !== null ? todayRevenue - yesterdaySameHour : null;

  const { receivable, currentMonth } = bank;
  const thresholdMissing = Math.max(0, ADMOB_THRESHOLD - receivable);

  // --- Seção do período (seletor) ---
  const sortedDays = computeDailyTotals(
    periodDaily.map((r) => ({ appId: r.appId ?? "", date: r.date, revenue: r.revenue, impressions: 0 }))
  );
  const periodRevenue = sortedDays.reduce((s, r) => s + r.revenue, 0);
  const periodImpressions = apps.reduce((s, a) => s + a.impressions, 0);
  const periodEcpm = ecpm(periodRevenue, periodImpressions);

  const bestDay = sortedDays.reduce(
    (best, r) => (r.revenue > best.revenue ? r : best),
    { date: "", revenue: 0 }
  );
  const dailyAvg =
    sortedDays.length > 0
      ? Math.round((periodRevenue / sortedDays.length) * 100) / 100
      : 0;

  const periodLabel = PERIOD_LABELS[periodKey];

  return (
    <div>
      <Header title="Visão Geral" />
      <div className="space-y-4 p-4 md:space-y-6 md:p-6">
        {/* Heros: Hoje / Mês corrente / A Receber */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 md:gap-4">
          <KpiCard
            title="Hoje"
            value={fmt(todayRevenue)}
            subtitle={usdBrl ? fmtBRL(todayRevenue * usdBrl) : undefined}
            change={
              sameHourDiff !== null
                ? `${sameHourDiff >= 0 ? "+" : "−"}${fmt(Math.abs(sameHourDiff))} vs ontem nesse horário`
                : "sem comparativo ainda"
            }
            changeType={sameHourDiff !== null && sameHourDiff >= 0 ? "positive" : sameHourDiff !== null ? "negative" : "neutral"}
            icon={KpiIcons.today}
          />
          <KpiCard
            title={`${monthName(currentMonth.month)} (parcial)`}
            value={fmt(currentMonth.gross)}
            subtitle={`projeção ${fmt(currentMonth.projection)}`}
            change={
              monthSummary.revenueChange !== null
                ? `${monthSummary.revenueChange >= 0 ? "+" : ""}${monthSummary.revenueChange}% vs mês passado (mesmo dia)`
                : undefined
            }
            changeType={
              monthSummary.revenueChange === null ? "neutral" : monthSummary.revenueChange >= 0 ? "positive" : "negative"
            }
            icon={KpiIcons.revenue}
          />
          <KpiCard
            title="A Receber"
            value={fmt(receivable)}
            subtitle={usdBrl && receivable > 0 ? fmtBRL(receivable * usdBrl) : undefined}
            change={
              receivable <= 0
                ? "nada fechado pendente"
                : thresholdMissing > 0
                  ? `faltam ${fmt(thresholdMissing)} pro threshold de $100`
                  : `pagamento previsto ~${nextPaymentDate(todayStr)}`
            }
            changeType={receivable > 0 && thresholdMissing <= 0 ? "positive" : "neutral"}
            icon={KpiIcons.average}
          />
        </div>

        <PeriodSelector />

        {/* Métricas do período */}
        <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
          <KpiCard title="Ontem" value={fmt(yesterdayRevenue)} icon={KpiIcons.yesterday} />
          <KpiCard
            title="Melhor Dia"
            value={fmt(bestDay.revenue)}
            change={
              bestDay.date
                ? new Date(`${bestDay.date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
                : undefined
            }
            changeType="neutral"
            icon={KpiIcons.trophy}
          />
          <KpiCard title="Média Diária" value={fmt(dailyAvg)} icon={KpiIcons.average} />
          <KpiCard title="eCPM Médio" value={periodEcpm > 0 ? fmt(periodEcpm) : "N/A"} icon={KpiIcons.trendingUp} />
        </div>

        {/* Gráfico + Top apps */}
        <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <h2 className="mb-3 text-base font-semibold font-heading md:mb-4 md:text-lg">
              Receita ({periodLabel})
            </h2>
            <RevenueChart data={sortedDays} />
          </Card>

          <Card>
            <h2 className="mb-3 text-base font-semibold font-heading md:mb-4 md:text-lg">
              Top Apps ({periodLabel})
            </h2>
            <TopApps apps={apps} />
          </Card>
        </div>
      </div>
    </div>
  );
}
