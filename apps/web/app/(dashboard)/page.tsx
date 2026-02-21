import { Header } from "@/components/header";
import { RevenueChart } from "@/components/revenue-chart";
import { AppStatusList } from "@/components/app-status-list";
import { KpiCard } from "@diced/ui/kpi-card";
import { Card } from "@diced/ui/card";
import { getSummary, getDailyRevenue, getApps } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const [summary, dailyRevenue, apps] = await Promise.all([
    getSummary(),
    getDailyRevenue(),
    getApps(),
  ]);

  return (
    <div>
      <Header title="Overview" />
      <div className="space-y-6 p-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Total Apps"
            value={String(summary.totalApps)}
            icon={<span className="text-lg">📱</span>}
          />
          <KpiCard
            title="Monthly Revenue"
            value={`$${summary.totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
            change={summary.revenueChange !== 0 ? `+${summary.revenueChange}%` : undefined}
            changeType="positive"
            icon={<span className="text-lg">💰</span>}
          />
          <KpiCard
            title="Total Downloads"
            value={summary.totalDownloads.toLocaleString()}
            change={summary.downloadsChange !== 0 ? `+${summary.downloadsChange}%` : undefined}
            changeType="positive"
            icon={<span className="text-lg">📥</span>}
          />
          <KpiCard
            title="Avg Rating"
            value={summary.averageRating > 0 ? String(summary.averageRating) : "N/A"}
            icon={<span className="text-lg">⭐</span>}
          />
        </div>

        {/* Charts + App List */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <h2 className="mb-4 text-lg font-semibold font-heading">
              Revenue (Last 30 Days)
            </h2>
            <RevenueChart data={dailyRevenue} />
          </Card>

          <Card>
            <h2 className="mb-4 text-lg font-semibold font-heading">
              App Status
            </h2>
            <AppStatusList apps={apps} />
          </Card>
        </div>
      </div>
    </div>
  );
}
