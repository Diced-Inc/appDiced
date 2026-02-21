import { Header } from "@/components/header";
import { RevenueDashboard } from "@/components/revenue-dashboard";
import { getApps, getDailyRevenue } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function RevenuePage() {
  const [apps, dailyRevenue] = await Promise.all([
    getApps(),
    getDailyRevenue(),
  ]);

  return (
    <div>
      <Header title="Receita" />
      <div className="space-y-4 p-4 md:space-y-6 md:p-6">
        <RevenueDashboard apps={apps} dailyRevenue={dailyRevenue} />
      </div>
    </div>
  );
}
