import type { AcquisitionDailyMetric, MarketingIntegration } from "@/lib/acquisition";

// A generic Facebook referral identifies a stream, never an individual campaign.
export function campaignAttribution(rows: AcquisitionDailyMetric[], integrations: MarketingIntegration[]) {
  const streamKey = (i: MarketingIntegration) => `${i.ga4PropertyId}:${i.ga4StreamId}`;
  const owners = new Map<string, number>();
  const utms = new Map<string, number>();
  const utmKey = (i: MarketingIntegration) => JSON.stringify([streamKey(i), i.utmSource.toLowerCase(), i.utmMedium.toLowerCase(), i.utmCampaign.toLowerCase()]);
  for (const i of integrations) {
    owners.set(streamKey(i), (owners.get(streamKey(i)) || 0) + 1);
    utms.set(utmKey(i), (utms.get(utmKey(i)) || 0) + 1);
  }
  const byId = new Map(integrations.map(i => [i.id, i]));
  const ambiguousIds = integrations.filter(i => (owners.get(streamKey(i)) || 0) > 1).map(i => i.id);
  const duplicateUtmIds = integrations.filter(i => (utms.get(utmKey(i)) || 0) > 1).map(i => i.id);
  return { ambiguousIds, duplicateUtmIds, rows: rows.map(row => {
    const i = byId.get(row.integrationId);
    if (!i || !ambiguousIds.includes(i.id)) return row;
    const duplicate = duplicateUtmIds.includes(i.id);
    const ad = duplicate ? 0 : row.utmAdRevenue;
    const purchase = duplicate ? 0 : row.utmPurchaseRevenue;
    const revenue = duplicate ? 0 : row.utmTotalRevenue;
    const installs = duplicate ? 0 : row.utmInstalls;
    return { ...row, adRevenue: ad, purchaseRevenue: purchase, totalRevenue: revenue, ga4Installs: installs,
      utmAdRevenue: ad, utmPurchaseRevenue: purchase, utmTotalRevenue: revenue, utmInstalls: installs,
      facebookReferralAdRevenue: 0, facebookReferralPurchaseRevenue: 0, facebookReferralTotalRevenue: 0, facebookReferralInstalls: 0 };
  }) };
}

export function campaignResult(spend: number, revenue: number, unavailable = false) {
  if (unavailable) return "Dados indisponíveis";
  if (spend === 0) return "Aguardando dados";
  if (revenue === spend) return "No ponto de equilíbrio";
  return revenue > spend ? "Acima do investimento" : "Abaixo do investimento";
}
