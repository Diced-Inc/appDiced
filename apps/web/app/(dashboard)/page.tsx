import { auth } from "@clerk/nextjs/server";
import { Header } from "@/components/header";
import { RevenueChart } from "@/components/revenue-chart";
import { AppStatusList } from "@/components/app-status-list";
import { KpiCard } from "@diced/ui/kpi-card";
import { Card } from "@diced/ui/card";
import { getSummary, getDailyRevenue, getApps } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const [summary, dailyRevenue, apps] = await Promise.all([
    getSummary(userId),
    getDailyRevenue(userId),
    getApps(userId),
  ]);

  return (
    <div>
      <Header title="Visão Geral" />
      <div className="space-y-4 p-4 md:space-y-6 md:p-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
          <KpiCard
            title="Total de Apps"
            value={String(summary.totalApps)}
            icon={<span className="text-lg">📱</span>}
          />
          <KpiCard
            title="Receita Mensal"
            value={`$${summary.totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
            change={summary.revenueChange !== 0 ? `+${summary.revenueChange}%` : undefined}
            changeType="positive"
            icon={<span className="text-lg">💰</span>}
          />
          <KpiCard
            title="Total de Downloads"
            value={summary.totalDownloads.toLocaleString()}
            change={summary.downloadsChange !== 0 ? `+${summary.downloadsChange}%` : undefined}
            changeType="positive"
            icon={<span className="text-lg">📥</span>}
          />
          <KpiCard
            title="Avaliação Média"
            value={summary.averageRating > 0 ? String(summary.averageRating) : "N/A"}
            icon={<span className="text-lg">⭐</span>}
          />
        </div>

        {/* Charts + App List */}
        <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <h2 className="mb-3 text-base font-semibold font-heading md:mb-4 md:text-lg">
              Receita (Últimos 30 Dias)
            </h2>
            <RevenueChart data={dailyRevenue} />
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
