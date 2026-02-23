import { auth } from "@clerk/nextjs/server";
import { Header } from "@/components/header";
import { RevenueChart } from "@/components/revenue-chart";
import { AppStatusList } from "@/components/app-status-list";
import { KpiCard } from "@diced/ui/kpi-card";
import { Card } from "@diced/ui/card";
import { KpiIcons } from "@/components/kpi-icons";
import { getSummary, getDailyRevenue, getApps } from "@/lib/data";
import { toBrazilDateStr } from "@/lib/date";

export const dynamic = "force-dynamic";

function fmt(v: number) {
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function OverviewPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const [summary, dailyRevenue, apps] = await Promise.all([
    getSummary(userId),
    getDailyRevenue(userId),
    getApps(userId),
  ]);

  // Aggregate daily totals
  const byDate = new Map<string, number>();
  for (const r of dailyRevenue) {
    byDate.set(r.date, (byDate.get(r.date) ?? 0) + r.revenue);
  }
  const sortedDays = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, revenue]) => ({ date, revenue }));

  const todayStr = toBrazilDateStr();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = toBrazilDateStr(yesterdayDate);

  const todayRevenue = byDate.get(todayStr) ?? 0;
  const yesterdayRevenue = byDate.get(yesterdayStr) ?? 0;
  const todayDiff = todayRevenue - yesterdayRevenue;

  const dailyAvg =
    sortedDays.length > 0
      ? Math.round(
          (sortedDays.reduce((s, r) => s + r.revenue, 0) / sortedDays.length) * 100
        ) / 100
      : 0;

  return (
    <div>
      <Header title="Visão Geral" />
      <div className="space-y-4 p-4 md:space-y-6 md:p-6">
        {/* KPI Cards - Row 1: Revenue focus */}
        <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
          <KpiCard
            title="Receita (30d)"
            value={fmt(summary.totalRevenue)}
            icon={KpiIcons.revenue}
          />
          <KpiCard
            title="Hoje"
            value={fmt(todayRevenue)}
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
              Receita (Últimos 30 Dias)
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
