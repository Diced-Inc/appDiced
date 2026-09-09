import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { metaCampaignsTag, setMetaCampaignStatus } from "@/lib/meta/ads";
import { revalidateTag } from "next/cache";

export const maxDuration = 60;
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  const { userId } = await auth();
  if (!userId) return json({ error: "Sessão necessária." }, 401);
  if (req.headers.get("origin") !== req.nextUrl.origin) return json({ error: "Origem inválida." }, 403);
  const body = await req.json().catch(() => null);
  if (!["ACTIVE", "PAUSED"].includes(body?.status) || !["ACTIVE", "PAUSED"].includes(body?.expectedStatus)) return json({ error: "Status inválido." }, 400);
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "Campanha não encontrada." }, 404);
  try {
    const db = getSupabaseAdmin();
    const { data: integration, error } = await db.from("marketing_integrations")
      .select("id,meta_campaign_id,meta_ad_account_id").eq("id", id).eq("user_id", userId).maybeSingle();
    if (error) throw new Error("Não foi possível consultar a campanha.");
    if (!integration) return json({ error: "Campanha não encontrada." }, 404);
    const campaign = await setMetaCampaignStatus(userId, integration.meta_ad_account_id, integration.meta_campaign_id, body.status, body.expectedStatus);
    // Derruba a listagem cacheada para o novo status aparecer no refresh seguinte.
    // Como o histórico, uma falha aqui não invalida uma mutação já confirmada na Meta.
    try { revalidateTag(metaCampaignsTag(userId), { expire: 0 }); } catch { /* cache não invalidado; expira sozinho em 120s */ }
    // A history failure must not turn a confirmed Meta mutation into an apparent failure.
    let warning: string | undefined;
    try {
      const result = await db.from("campaign_history").insert({ integration_id: id, user_id: userId, kind: "decision", note: `Campanha ${body.status === "PAUSED" ? "pausada" : "reativada"} pelo appDiced. Status confirmado pela Meta: ${campaign.status}.` });
      if (result.error) warning = "Status confirmado na Meta; não foi possível registrar o histórico.";
    } catch { warning = "Status confirmado na Meta; não foi possível registrar o histórico."; }
    return json({ campaign, warning });
  } catch (error) { return json({ error: error instanceof Error ? error.message : "Não foi possível alterar a campanha." }, 502); }
}
