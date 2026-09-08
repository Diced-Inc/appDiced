import { auth } from "@clerk/nextjs/server";
import { AcquisitionDashboard } from "@/components/acquisition-dashboard";
import { Header } from "@/components/header";
import { CampaignPeriodSelector } from "@/components/campaign-period-selector";
import { listMetaCampaigns } from "@/lib/meta/ads";
import { SyncButton } from "@/components/sync-button";
import { getAcquisitionData } from "@/lib/acquisition";
import { campaignPeriod } from "@/lib/campaign-period";

export const dynamic = "force-dynamic";

export default async function AcquisitionPage({ searchParams }: { searchParams: Promise<{ period?: string; from?: string; to?: string }> }) {
  const { userId } = await auth();
  if (!userId) return null;

  const period = campaignPeriod(await searchParams);
  const data = await getAcquisitionData(userId, period.range);
  const accounts = [...new Set(data.integrations.map(i => i.metaAdAccountId))];
  const results = await Promise.allSettled(accounts.map(id => listMetaCampaigns(userId, id)));
  const campaigns = results.flatMap(result => result.status === "fulfilled" ? result.value : []);
  const metaUnavailable = results.some(result => result.status === "rejected");

  return (
    <div>
      <Header title="Campanhas" />
      <div className="space-y-4 p-4 md:space-y-6 md:p-6">
        <div className="flex min-w-0 items-center gap-2">
          <div className="min-w-0 flex-1">
            <CampaignPeriodSelector />
          </div>
          <SyncButton provider="acquisition" />
        </div>
        {period.error && <p role="alert" className="text-sm text-amber-300">{period.error}</p>}
        <AcquisitionDashboard
          integrations={data.integrations}
          metrics={data.metrics}
          periodLabel={period.label}
          range={period.range}
          campaigns={campaigns}
          metaUnavailable={metaUnavailable}
          setupError={data.setupError}
        />
      </div>
    </div>
  );
}
