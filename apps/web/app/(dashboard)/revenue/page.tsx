import { auth } from "@clerk/nextjs/server";
import { Header } from "@/components/header";
import { RevenueDashboard } from "@/components/revenue-dashboard";
import { PeriodSelector } from "@/components/period-selector";
import { getApps, getDailyRevenue, getCountryRevenue, getAdUnitRevenue, getYesterdaySameHourRevenue } from "@/lib/data";
import { saveRevenueSnapshot } from "@/lib/sync/snapshot";
import { resolvePeriod, isPeriodKey, PERIOD_LABELS, type PeriodKey } from "@/lib/period";

export const dynamic = "force-dynamic";

export default async function RevenuePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) return null;

  const { period } = await searchParams;
  const periodKey: PeriodKey = isPeriodKey(period) ? period : "30d";
  const range = resolvePeriod(periodKey);

  const [apps, dailyRevenue, countryRevenue, adUnitRevenue, yesterdaySameHour] = await Promise.all([
    getApps(userId, range),
    getDailyRevenue(userId, range),
    getCountryRevenue(userId, range),
    getAdUnitRevenue(userId),
    getYesterdaySameHourRevenue(userId),
  ]);

  // Snapshot da hora corrente (fire and forget — o cron horário é o titular)
  saveRevenueSnapshot(userId);

  return (
    <div>
      <Header title="Receita" />
      <div className="space-y-4 p-4 md:space-y-6 md:p-6">
        <PeriodSelector />
        <RevenueDashboard
          apps={apps}
          dailyRevenue={dailyRevenue}
          countryRevenue={countryRevenue}
          adUnitRevenue={adUnitRevenue}
          yesterdaySameHour={yesterdaySameHour}
          periodLabel={PERIOD_LABELS[periodKey]}
        />
      </div>
    </div>
  );
}
