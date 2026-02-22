import { auth } from "@clerk/nextjs/server";
import { Header } from "@/components/header";
import { RevenueDashboard } from "@/components/revenue-dashboard";
import { getApps, getDailyRevenue, getCountryRevenue, getAdUnitRevenue } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function RevenuePage() {
  const { userId } = await auth();
  if (!userId) return null;

  const [apps, dailyRevenue, countryRevenue, adUnitRevenue] = await Promise.all([
    getApps(userId),
    getDailyRevenue(userId),
    getCountryRevenue(userId),
    getAdUnitRevenue(userId),
  ]);

  return (
    <div>
      <Header title="Receita" />
      <div className="space-y-4 p-4 md:space-y-6 md:p-6">
        <RevenueDashboard
          apps={apps}
          dailyRevenue={dailyRevenue}
          countryRevenue={countryRevenue}
          adUnitRevenue={adUnitRevenue}
        />
      </div>
    </div>
  );
}
