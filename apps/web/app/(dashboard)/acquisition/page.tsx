import { auth } from "@clerk/nextjs/server";
import { AcquisitionDashboard } from "@/components/acquisition-dashboard";
import { Header } from "@/components/header";
import { PeriodSelector } from "@/components/period-selector";
import { getAcquisitionData } from "@/lib/acquisition";
import { isPeriodKey, PERIOD_LABELS, resolvePeriod, type PeriodKey } from "@/lib/period";

export const dynamic = "force-dynamic";

export default async function AcquisitionPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { userId } = await auth();
  if (!userId) return null;

  const { period } = await searchParams;
  const periodKey: PeriodKey = isPeriodKey(period) ? period : "month";
  const data = await getAcquisitionData(userId, resolvePeriod(periodKey));

  return (
    <div>
      <Header title="Aquisição" />
      <div className="space-y-4 p-4 md:space-y-6 md:p-6">
        <PeriodSelector />
        <AcquisitionDashboard
          integrations={data.integrations}
          metrics={data.metrics}
          periodLabel={PERIOD_LABELS[periodKey]}
          setupError={data.setupError}
        />
      </div>
    </div>
  );
}
