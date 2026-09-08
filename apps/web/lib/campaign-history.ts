import { getSupabaseAdmin } from "@/lib/supabase/server";
import { fetchCampaignObservation } from "@/lib/meta/ads";

export async function recordCampaignObservation(userId: string, integrationId: string, campaignId: string) {
  const snapshot = await fetchCampaignObservation(userId, campaignId);
  const { error } = await getSupabaseAdmin().rpc("record_campaign_observation", { p_integration_id: integrationId, p_user_id: userId, p_snapshot: snapshot });
  if (error) throw new Error("Não foi possível salvar o histórico de configuração.");
}
