import { Header } from "@/components/header";
import { RevenueChart } from "@/components/revenue-chart";
import { RevenueByAppChart } from "@/components/revenue-by-app-chart";
import { KpiCard } from "@diced/ui/kpi-card";
import { Card } from "@diced/ui/card";
import { mockApps, mockDailyRevenue, mockSummary } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

export default function RevenuePage() {
  const totalImpressions = mockApps.reduce((sum, a) => sum + a.impressions, 0);
  const avgEcpm =
    Math.round(
      (mockApps.filter((a) => a.ecpm > 0).reduce((sum, a) => sum + a.ecpm, 0) /
        mockApps.filter((a) => a.ecpm > 0).length) *
        100
    ) / 100;

  return (
    <div>
      <Header title="Revenue" />
      <div className="space-y-6 p-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard
            title="Total Revenue"
            value={`$${mockSummary.totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
            change={`+${mockSummary.revenueChange}%`}
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
            value={`$${avgEcpm}`}
            icon={<span className="text-lg">📊</span>}
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <h2 className="mb-4 text-lg font-semibold font-heading">
              Daily Revenue
            </h2>
            <RevenueChart data={mockDailyRevenue} />
          </Card>

          <Card>
            <h2 className="mb-4 text-lg font-semibold font-heading">
              Revenue by App
            </h2>
            <RevenueByAppChart apps={mockApps} />
          </Card>
        </div>
      </div>
    </div>
  );
}
