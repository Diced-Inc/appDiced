import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { listGA4AndroidStreams } from "@/lib/google/analytics";
import { listMetaAdAccounts, listMetaCampaigns } from "@/lib/meta/ads";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { syncAcquisition } from "@/lib/sync/acquisition";

export const maxDuration = 300;

function textField(value: unknown, maxLength = 200): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  return clean && clean.length <= maxLength ? clean : null;
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const appId = textField(body?.appId);
  const accountId = textField(body?.metaAdAccountId);
  const campaignId = textField(body?.metaCampaignId);
  const propertyId = textField(body?.ga4PropertyId);
  const streamId = textField(body?.ga4StreamId);
  const utmSource = textField(body?.utmSource, 100)?.toLowerCase();
  const utmMedium = textField(body?.utmMedium, 100)?.toLowerCase();
  const utmCampaign = textField(body?.utmCampaign, 200);
  if (!appId || !accountId || !campaignId || !propertyId || !streamId || !utmSource || !utmMedium || !utmCampaign) {
    return NextResponse.json({ error: "Preencha todos os campos da integração." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: app } = await supabase
    .from("apps")
    .select("id,package_name")
    .eq("id", appId)
    .eq("user_id", userId)
    .single();
  if (!app) return NextResponse.json({ error: "Aplicativo inválido." }, { status: 400 });

  try {
    const accounts = await listMetaAdAccounts(userId);
    const account = accounts.find((item) => item.id === accountId);
    if (!account) throw new Error("Conta de anúncios não pertence à conexão atual.");

    const [campaigns, streams] = await Promise.all([
      listMetaCampaigns(userId, account.id),
      listGA4AndroidStreams(userId),
    ]);
    const campaign = campaigns.find((item) => item.id === campaignId);
    const stream = streams.find(
      (item) => item.propertyId === propertyId && item.streamId === streamId && item.packageName === app.package_name
    );
    if (!campaign) throw new Error("Campanha da Meta inválida.");
    if (!stream) throw new Error("Fluxo Android do GA4 não corresponde ao pacote do app.");

    const now = new Date().toISOString();
    const { error } = await supabase.from("marketing_integrations").upsert(
      {
        user_id: userId,
        app_id: appId,
        meta_ad_account_id: account.id,
        meta_ad_account_name: account.name,
        meta_campaign_id: campaign.id,
        meta_campaign_name: campaign.name,
        ga4_property_id: stream.propertyId,
        ga4_stream_id: stream.streamId,
        utm_source: utmSource,
        utm_medium: utmMedium,
        utm_campaign: utmCampaign,
        currency: account.currency,
        active: true,
        error_message: null,
        updated_at: now,
      } as Record<string, unknown>,
      { onConflict: "user_id,app_id" }
    );
    if (error) throw new Error(error.message);

    const sync = await syncAcquisition(userId, { lookbackDays: 14 });
    return NextResponse.json({ success: true, sync });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
