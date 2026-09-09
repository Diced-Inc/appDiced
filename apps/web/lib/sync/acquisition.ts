import { recordCampaignObservation } from "@/lib/campaign-history";
import { toBrazilDateStr } from "@/lib/date";
import { fetchGA4AcquisitionBreakdown, type GA4DailyAcquisition } from "@/lib/google/analytics";
import { fetchMetaDailyInsights, type MetaDailyInsight } from "@/lib/meta/ads";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { chunkedUpsert } from "@/lib/sync/persist";
import { acquisitionSyncRange } from "@/lib/sync/acquisition-range";

interface IntegrationRow {
  id: string;
  user_id: string;
  app_id: string;
  meta_campaign_id: string;
  ga4_property_id: string;
  ga4_stream_id: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  currency: string;
}

export interface SyncAcquisitionOptions {
  lookbackDays?: number;
}

export type SyncAcquisitionResult =
  | { skipped: true; reason: string }
  | {
      success: true;
      range: { from: string; to: string };
      integrations: number;
      rows: number;
      errors: string[];
    };

function shiftDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function dateSequence(from: string, to: string): string[] {
  const dates: string[] = [];
  let current = from;
  while (current <= to) {
    dates.push(current);
    current = shiftDays(current, 1);
  }
  return dates;
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function combineMeta(rows: MetaDailyInsight[]): Map<string, MetaDailyInsight> {
  const result = new Map<string, MetaDailyInsight>();
  for (const row of rows) {
    const previous = result.get(row.date) ?? {
      date: row.date,
      spend: 0,
      impressions: 0,
      reach: 0,
      clicks: 0,
      installs: 0,
    };
    result.set(row.date, {
      date: row.date,
      spend: previous.spend + row.spend,
      impressions: previous.impressions + row.impressions,
      reach: previous.reach + row.reach,
      clicks: previous.clicks + row.clicks,
      installs: previous.installs + row.installs,
    });
  }
  return result;
}

function combineGA4(rows: GA4DailyAcquisition[]): Map<string, GA4DailyAcquisition> {
  const result = new Map<string, GA4DailyAcquisition>();
  for (const row of rows) {
    const previous = result.get(row.date) ?? {
      date: row.date,
      installs: 0,
      adRevenue: 0,
      purchaseRevenue: 0,
      totalRevenue: 0,
      adImpressions: 0,
    };
    result.set(row.date, {
      date: row.date,
      installs: previous.installs + row.installs,
      adRevenue: previous.adRevenue + row.adRevenue,
      purchaseRevenue: previous.purchaseRevenue + row.purchaseRevenue,
      totalRevenue: previous.totalRevenue + row.totalRevenue,
      adImpressions: previous.adImpressions + row.adImpressions,
    });
  }
  return result;
}

export async function syncAcquisition(
  userId: string,
  options: SyncAcquisitionOptions = {}
): Promise<SyncAcquisitionResult> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("marketing_integrations")
    .select("id,user_id,app_id,meta_campaign_id,ga4_property_id,ga4_stream_id,utm_source,utm_medium,utm_campaign,currency")
    .eq("user_id", userId)
    .eq("active", true);
  if (error) throw new Error(`Falha ao ler integrações de aquisição: ${error.message}`);

  const integrations = (data as IntegrationRow[] | null) ?? [];
  if (integrations.length === 0) return { skipped: true, reason: "not_configured" };

  const today = toBrazilDateStr();
  const range = acquisitionSyncRange(today, options.lookbackDays);
  const errors: string[] = [];
  let rowCount = 0;

  for (const integration of integrations) {
    try {
      const metaRows = await fetchMetaDailyInsights(userId, integration.meta_campaign_id, range);
      const metaByDate = combineMeta(metaRows);
      // Persist actual spend before GA4: an attribution failure must not lose bank expenses.
      // Partial upsert preserves previously collected revenue; the integration error signals stale GA4.
      await chunkedUpsert(supabase, "marketing_daily_metrics", dateSequence(range.from, range.to).map(date => {
        const meta = metaByDate.get(date);
        return { integration_id: integration.id, user_id: userId, app_id: integration.app_id,
          date, currency: integration.currency, spend: round4(meta?.spend ?? 0),
          meta_impressions: meta?.impressions ?? 0, meta_reach: meta?.reach ?? 0,
          meta_clicks: meta?.clicks ?? 0, meta_installs: meta?.installs ?? 0,
          synced_at: new Date().toISOString() };
      }), "integration_id,date");
      const analytics = await fetchGA4AcquisitionBreakdown(
          userId,
          {
            propertyId: integration.ga4_property_id,
            streamId: integration.ga4_stream_id,
            source: integration.utm_source,
            medium: integration.utm_medium,
            campaign: integration.utm_campaign,
            currency: integration.currency,
          },
          range
        );
      const utmByDate = combineGA4(analytics.utm);
      const facebookReferralByDate = combineGA4(analytics.facebookReferral);
      const syncedAt = new Date().toISOString();
      // Só grava receita nos dias em que o GA4 devolveu linha. Dia ausente pode ser
      // latência de processamento ou omissão por limite de privacidade — escrever 0 ali
      // apagaria receita já coletada. O gasto desses dias já foi salvo no upsert acima.
      const upserts = dateSequence(range.from, range.to)
        .filter((date) => utmByDate.has(date) || facebookReferralByDate.has(date))
        .map((date) => {
        const meta = metaByDate.get(date);
        const utm = utmByDate.get(date);
        const facebookReferral = facebookReferralByDate.get(date);
        return {
          integration_id: integration.id,
          user_id: userId,
          app_id: integration.app_id,
          date,
          currency: integration.currency,
          spend: round4(meta?.spend ?? 0),
          attributed_ad_revenue: round4(utm?.adRevenue ?? 0),
          attributed_purchase_revenue: round4(utm?.purchaseRevenue ?? 0),
          attributed_total_revenue: round4(utm?.totalRevenue ?? 0),
          facebook_referral_ad_revenue: round4(facebookReferral?.adRevenue ?? 0),
          facebook_referral_purchase_revenue: round4(facebookReferral?.purchaseRevenue ?? 0),
          facebook_referral_total_revenue: round4(facebookReferral?.totalRevenue ?? 0),
          meta_impressions: meta?.impressions ?? 0,
          meta_reach: meta?.reach ?? 0,
          meta_clicks: meta?.clicks ?? 0,
          meta_installs: meta?.installs ?? 0,
          ga4_installs: utm?.installs ?? 0,
          facebook_referral_installs: facebookReferral?.installs ?? 0,
          publisher_ad_impressions: utm?.adImpressions ?? 0,
          facebook_referral_ad_impressions: facebookReferral?.adImpressions ?? 0,
          synced_at: syncedAt,
        };
      });

      if (upserts.length > 0) {
        await chunkedUpsert(supabase, "marketing_daily_metrics", upserts, "integration_id,date");
      }
      rowCount += upserts.length;

      // Marca os dias sob limite de privacidade do GA4 para o painel não exibir 0 como fato.
      // Upsert à parte e tolerante: enquanto a migration ga4_thresholded não estiver aplicada,
      // a coleta principal acima não pode falhar por causa deste sinal.
      try {
        await chunkedUpsert(supabase, "marketing_daily_metrics", dateSequence(range.from, range.to).map((date) => ({
          integration_id: integration.id, user_id: userId, app_id: integration.app_id, date,
          currency: integration.currency,
          ga4_thresholded: analytics.thresholded && !utmByDate.has(date) && !facebookReferralByDate.has(date),
        })), "integration_id,date");
      } catch {
        errors.push("Sinal de limite de privacidade do GA4 não gravado; aplique a migration ga4_thresholded.");
      }
      try { await recordCampaignObservation(userId, integration.id, integration.meta_campaign_id); }
      catch (historyError) { errors.push("Histórico: " + (historyError instanceof Error ? historyError.message : "indisponível")); }
      await supabase
        .from("marketing_integrations")
        .update({ last_sync: syncedAt, error_message: null, updated_at: syncedAt })
        .eq("id", integration.id)
        .eq("user_id", userId);
    } catch (syncError) {
      const message = syncError instanceof Error ? syncError.message : String(syncError);
      errors.push(`${integration.utm_campaign}: ${message}`);
      await supabase
        .from("marketing_integrations")
        .update({ error_message: message, updated_at: new Date().toISOString() })
        .eq("id", integration.id)
        .eq("user_id", userId);
    }
  }

  await supabase
    .from("api_connections")
    .update({
      last_sync: new Date().toISOString(),
      status: errors.length === integrations.length ? "error" : "connected",
      error_message: errors.length > 0 ? errors.join(" | ") : null,
      updated_at: new Date().toISOString(),
    })
    .eq("provider", "meta_ads")
    .eq("user_id", userId);

  return { success: true, range, integrations: integrations.length, rows: rowCount, errors };
}

export async function listConnectedAcquisitionUsers(): Promise<string[]> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("marketing_integrations")
    .select("user_id")
    .eq("active", true);
  return Array.from(new Set(((data as { user_id: string }[] | null) ?? []).map((row) => row.user_id)));
}
