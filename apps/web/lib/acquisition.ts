import { getAppMeta } from "@/lib/data";
import type { DateRange } from "@/lib/period";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/sync/persist";

export interface MarketingIntegration {
  id: string;
  appId: string;
  appName: string;
  packageName: string;
  appIcon: string;
  metaAdAccountId: string;
  metaAdAccountName: string;
  metaCampaignId: string;
  metaCampaignName: string;
  ga4PropertyId: string;
  ga4StreamId: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  currency: string;
  active: boolean;
  lastSync: string | null;
  errorMessage: string | null;
}

export interface AcquisitionDailyMetric {
  integrationId: string;
  appId: string;
  date: string;
  currency: string;
  spend: number;
  adRevenue: number;
  purchaseRevenue: number;
  totalRevenue: number;
  metaImpressions: number;
  metaReach: number;
  metaClicks: number;
  metaInstalls: number;
  ga4Installs: number;
  publisherAdImpressions: number;
}

export interface AcquisitionSummary {
  spend: number;
  adRevenue: number;
  purchaseRevenue: number;
  revenue: number;
  profit: number;
  roas: number | null;
  ga4Installs: number;
  metaInstalls: number;
  costPerInstall: number | null;
  clicks: number;
  impressions: number;
  ctr: number | null;
}

export interface AcquisitionData {
  integrations: MarketingIntegration[];
  metrics: AcquisitionDailyMetric[];
  setupError: string | null;
}

function money(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export function computeAcquisitionSummary(rows: AcquisitionDailyMetric[]): AcquisitionSummary {
  const spend = money(rows.reduce((sum, row) => sum + row.spend, 0));
  const adRevenue = money(rows.reduce((sum, row) => sum + row.adRevenue, 0));
  const purchaseRevenue = money(rows.reduce((sum, row) => sum + row.purchaseRevenue, 0));
  const revenue = money(rows.reduce((sum, row) => sum + row.totalRevenue, 0));
  const ga4Installs = rows.reduce((sum, row) => sum + row.ga4Installs, 0);
  const metaInstalls = rows.reduce((sum, row) => sum + row.metaInstalls, 0);
  const clicks = rows.reduce((sum, row) => sum + row.metaClicks, 0);
  const impressions = rows.reduce((sum, row) => sum + row.metaImpressions, 0);

  return {
    spend,
    adRevenue,
    purchaseRevenue,
    revenue,
    profit: money(revenue - spend),
    roas: spend > 0 ? revenue / spend : null,
    ga4Installs,
    metaInstalls,
    costPerInstall: ga4Installs > 0 ? spend / ga4Installs : null,
    clicks,
    impressions,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
  };
}

export async function getAcquisitionData(userId: string, range: DateRange): Promise<AcquisitionData> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("marketing_integrations")
    .select("id,app_id,meta_ad_account_id,meta_ad_account_name,meta_campaign_id,meta_campaign_name,ga4_property_id,ga4_stream_id,utm_source,utm_medium,utm_campaign,currency,active,last_sync,error_message")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Falha ao ler marketing_integrations:", error.message);
    return { integrations: [], metrics: [], setupError: error.message };
  }

  const rawIntegrations = (data as {
    id: string;
    app_id: string;
    meta_ad_account_id: string;
    meta_ad_account_name: string;
    meta_campaign_id: string;
    meta_campaign_name: string;
    ga4_property_id: string;
    ga4_stream_id: string;
    utm_source: string;
    utm_medium: string;
    utm_campaign: string;
    currency: string;
    active: boolean;
    last_sync: string | null;
    error_message: string | null;
  }[] | null) ?? [];
  const apps = await getAppMeta(userId);
  const appById = new Map(apps.map((app) => [app.id, app]));

  const integrations: MarketingIntegration[] = rawIntegrations.map((row) => {
    const app = appById.get(row.app_id);
    return {
      id: row.id,
      appId: row.app_id,
      appName: app?.name ?? "App removido",
      packageName: app?.packageName ?? "",
      appIcon: app?.icon ?? "",
      metaAdAccountId: row.meta_ad_account_id,
      metaAdAccountName: row.meta_ad_account_name,
      metaCampaignId: row.meta_campaign_id,
      metaCampaignName: row.meta_campaign_name,
      ga4PropertyId: row.ga4_property_id,
      ga4StreamId: row.ga4_stream_id,
      utmSource: row.utm_source,
      utmMedium: row.utm_medium,
      utmCampaign: row.utm_campaign,
      currency: row.currency,
      active: row.active,
      lastSync: row.last_sync,
      errorMessage: row.error_message,
    };
  });

  const ids = integrations.map((integration) => integration.id);
  if (ids.length === 0) return { integrations, metrics: [], setupError: null };

  try {
    const rows = await fetchAll<{
      integration_id: string;
      app_id: string;
      date: string;
      currency: string;
      spend: number;
      attributed_ad_revenue: number;
      attributed_purchase_revenue: number;
      attributed_total_revenue: number;
      meta_impressions: number;
      meta_reach: number;
      meta_clicks: number;
      meta_installs: number;
      ga4_installs: number;
      publisher_ad_impressions: number;
    }>(
      supabase,
      "marketing_daily_metrics",
      "integration_id,app_id,date,currency,spend,attributed_ad_revenue,attributed_purchase_revenue,attributed_total_revenue,meta_impressions,meta_reach,meta_clicks,meta_installs,ga4_installs,publisher_ad_impressions",
      (query) => {
        let filtered = query.in("integration_id", ids).lte("date", range.to).order("date", { ascending: true });
        if (range.from) filtered = filtered.gte("date", range.from);
        return filtered;
      }
    );

    return {
      integrations,
      setupError: null,
      metrics: rows.map((row) => ({
        integrationId: row.integration_id,
        appId: row.app_id,
        date: row.date,
        currency: row.currency,
        spend: Number(row.spend),
        adRevenue: Number(row.attributed_ad_revenue),
        purchaseRevenue: Number(row.attributed_purchase_revenue),
        totalRevenue: Number(row.attributed_total_revenue),
        metaImpressions: Number(row.meta_impressions),
        metaReach: Number(row.meta_reach),
        metaClicks: Number(row.meta_clicks),
        metaInstalls: Number(row.meta_installs),
        ga4Installs: Number(row.ga4_installs),
        publisherAdImpressions: Number(row.publisher_ad_impressions),
      })),
    };
  } catch (metricsError) {
    const message = metricsError instanceof Error ? metricsError.message : String(metricsError);
    return { integrations, metrics: [], setupError: message };
  }
}
