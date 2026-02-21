import { Header } from "@/components/header";
import { RevenueChart } from "@/components/revenue-chart";
import { RevenueByAppChart } from "@/components/revenue-by-app-chart";
import { KpiCard } from "@diced/ui/kpi-card";
import { Card } from "@diced/ui/card";
import { getApps, getDailyRevenue, getSummary } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function RevenuePage() {
  const [apps, dailyRevenue, summary] = await Promise.all([
    getApps(),
    getDailyRevenue(),
    getSummary(),
  ]);

  const totalImpressions = apps.reduce((sum, a) => sum + a.impressions, 0);
  const appsWithEcpm = apps.filter((a) => a.ecpm > 0);
  const avgEcpm =
    appsWithEcpm.length > 0
      ? Math.round(
          (appsWithEcpm.reduce((sum, a) => sum + a.ecpm, 0) / appsWithEcpm.length) * 100
        ) / 100
      : 0;

  return (
    <div>
      <Header title="Revenue" />
      <div className="space-y-4 p-4 md:space-y-6 md:p-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-3">
          <KpiCard
            title="Total Revenue"
            value={`$${summary.totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
            change={summary.revenueChange !== 0 ? `+${summary.revenueChange}%` : undefined}
            changeType="positive"
            icon={<span className="text-lg">💰</span>}
          />
          <KpiCard
            title="Total Impressions"
            value={totalImpressions.toLocaleString()}
            icon={<span className="text-lg">👁️</span>}
          />
          <KpiCard
            title="Avg eCPM"
            value={avgEcpm > 0 ? `$${avgEcpm}` : "N/A"}
            icon={<span className="text-lg">📊</span>}
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2">
          <Card>
            <h2 className="mb-4 text-lg font-semibold font-heading">
              Daily Revenue
            </h2>
            <RevenueChart data={dailyRevenue} />
          </Card>

          <Card>
            <h2 className="mb-4 text-lg font-semibold font-heading">
              Revenue by App
            </h2>
            <RevenueByAppChart apps={apps} />
          </Card>
        </div>
      </div>
    </div>
  );
}
