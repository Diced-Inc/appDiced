import { auth } from "@clerk/nextjs/server";
import { Header } from "@/components/header";
import { RevenueChart } from "@/components/revenue-chart";
import { AppStatusList } from "@/components/app-status-list";
import { PeriodSelector } from "@/components/period-selector";
import { KpiCard } from "@diced/ui/kpi-card";
import { Card } from "@diced/ui/card";
import { KpiIcons } from "@/components/kpi-icons";
import { getSummary, getDailyRevenue, getApps, getYesterdaySameHourRevenue, computeDailyTotals } from "@/lib/data";
import { saveRevenueSnapshot } from "@/lib/sync/snapshot";
import { toBrazilDateStr } from "@/lib/date";
import { resolvePeriod, isPeriodKey, PERIOD_LABELS, type PeriodKey } from "@/lib/period";

export const dynamic = "force-dynamic";

function fmt(v: number) {
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtBRL(v: number) {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
  const periodKey: PeriodKey = isPeriodKey(period) ? period : "30d";
  const range = resolvePeriod(periodKey);

  const [summary, dailyRevenue, apps, yesterdaySameHour, usdBrl] = await Promise.all([
    getSummary(userId, range),
    getDailyRevenue(userId, range),
    getApps(userId, range),
    getYesterdaySameHourRevenue(userId),
    getUsdBrl(),
  ]);

  // Snapshot da hora corrente (fire and forget — o cron horário é o titular)
  saveRevenueSnapshot(userId);

  const sortedDays = computeDailyTotals(
    dailyRevenue.map((r) => ({ appId: r.appId ?? "", date: r.date, revenue: r.revenue, impressions: 0 }))
  );
  const byDate = new Map(sortedDays.map((d) => [d.date, d.revenue]));

  const todayStr = toBrazilDateStr();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = toBrazilDateStr(yesterdayDate);

  const todayRevenue = byDate.get(todayStr) ?? 0;
  const yesterdayRevenue = byDate.get(yesterdayStr) ?? 0;
  const todayDiff = todayRevenue - yesterdayRevenue;

  const dailyAvg =
    sortedDays.length > 0
      ? Math.round((sortedDays.reduce((s, r) => s + r.revenue, 0) / sortedDays.length) * 100) / 100
      : 0;

  const periodLabel = PERIOD_LABELS[periodKey];

  return (
    <div>
      <Header title="Visão Geral" />
      <div className="space-y-4 p-4 md:space-y-6 md:p-6">
        <PeriodSelector />

        {/* KPI Cards - Row 1: Revenue focus */}
        <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-5">
          <KpiCard
            title={`Receita (${periodLabel})`}
            value={fmt(summary.totalRevenue)}
            change={
              summary.revenueChange !== null
                ? `${summary.revenueChange >= 0 ? "+" : ""}${summary.revenueChange}% vs período anterior`
                : undefined
            }
            changeType={
              summary.revenueChange === null ? "neutral" : summary.revenueChange >= 0 ? "positive" : "negative"
            }
            icon={KpiIcons.revenue}
          />
          <KpiCard
            title="Hoje"
            value={fmt(todayRevenue)}
            subtitle={usdBrl ? fmtBRL(todayRevenue * usdBrl) : undefined}
            change={
              todayDiff !== 0
                ? `${todayDiff >= 0 ? "+" : ""}${fmt(Math.abs(todayDiff))} vs ontem`
                : undefined
            }
            changeType={todayDiff >= 0 ? "positive" : "negative"}
            icon={KpiIcons.today}
          />
          <KpiCard
            title="Ontem"
            value={fmt(yesterdayRevenue)}
            icon={KpiIcons.yesterday}
          />
          <KpiCard
            title="Ontem nesse horário"
            value={yesterdaySameHour !== null ? fmt(yesterdaySameHour) : "—"}
            change={
              yesterdaySameHour !== null && todayRevenue > 0
                ? `${todayRevenue >= yesterdaySameHour ? "+" : ""}${fmt(Math.abs(todayRevenue - yesterdaySameHour))} vs hoje`
                : yesterdaySameHour === null ? "sem dados ainda" : undefined
            }
            changeType={yesterdaySameHour !== null && todayRevenue >= yesterdaySameHour ? "positive" : "negative"}
            icon={KpiIcons.sameTime}
          />
          <KpiCard
            title="Média Diária"
            value={fmt(dailyAvg)}
            icon={KpiIcons.average}
          />
        </div>

        {/* KPI Cards - Row 2: App metrics */}
        <div className="grid grid-cols-3 gap-3 md:gap-4">
          <KpiCard
            title="Total de Apps"
            value={String(summary.totalApps)}
            icon={KpiIcons.apps}
          />
          <KpiCard
            title="Downloads"
            value={summary.totalDownloads.toLocaleString()}
            icon={KpiIcons.downloads}
          />
          <KpiCard
            title="Avaliação"
            value={summary.averageRating > 0 ? String(summary.averageRating) : "N/A"}
            icon={KpiIcons.rating}
          />
        </div>

        {/* Charts + App List */}
        <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <h2 className="mb-3 text-base font-semibold font-heading md:mb-4 md:text-lg">
              Receita ({periodLabel})
            </h2>
            <RevenueChart data={sortedDays} />
          </Card>

          <Card>
            <h2 className="mb-3 text-base font-semibold font-heading md:mb-4 md:text-lg">
              Status dos Apps
            </h2>
            <AppStatusList apps={apps} />
          </Card>
        </div>
      </div>
    </div>
  );
}
