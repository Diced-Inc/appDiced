import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { fetchCampaignCreatives, fetchMetaDailyInsights } from "@/lib/meta/ads";
import { fetchCampaignCohortRows, fetchCampaignTracking } from "@/lib/google/analytics";
import { cohortWindows, shiftDate, validCohortDate } from "@/lib/campaign-cohorts";
import { decisionText, exclusiveUtm } from "@/lib/campaign-detail-validation";
import { recordCampaignObservation } from "@/lib/campaign-history";
import { toBrazilDateStr } from "@/lib/date";

export const maxDuration = 120;
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

async function owner(id: string, userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await getSupabaseAdmin().from("marketing_integrations")
    .select("id,user_id,meta_campaign_id,meta_ad_account_id,ga4_property_id,ga4_stream_id,utm_source,utm_medium,utm_campaign,currency")
    .eq("id", id).eq("user_id", userId).maybeSingle();
  if (error) throw new Error("Falha ao consultar campanha.");
  return data;
}

export async function GET(req: NextRequest, context: Context) {
  const { userId } = await auth();
  if (!userId) return json({ error: "Sessão necessária." }, 401);
  try {
    const { id } = await context.params; const i = await owner(id, userId);
    if (!i) return json({ error: "Campanha não encontrada." }, 404);
    const today = toBrazilDateStr(); const section = req.nextUrl.searchParams.get("section");
    const config = { propertyId: i.ga4_property_id, streamId: i.ga4_stream_id, source: i.utm_source, medium: i.utm_medium, campaign: i.utm_campaign, currency: i.currency };
    if (section === "history") {
      const { data, error } = await getSupabaseAdmin().from("campaign_history").select("id,kind,note,snapshot,created_at")
        .eq("integration_id", id).eq("user_id", userId).order("created_at", { ascending: false }).limit(100);
      if (error) throw new Error("Histórico indisponível. Verifique a configuração do banco.");
      return json({ history: data });
    }
    if (section === "creatives") {
      const from = req.nextUrl.searchParams.get("from") || shiftDate(today, -6); const to = req.nextUrl.searchParams.get("to") || today;
      if (!validCohortDate(from, today) || !validCohortDate(to, today) || from > to) return json({ error: "Período inválido; máximo de 366 dias." }, 400);
      return json({ creatives: await fetchCampaignCreatives(userId, i.meta_campaign_id, { from, to }), range: { from, to } });
    }
    if (section === "tracking" || section === "cohort") {
      const { data: siblings, error } = await getSupabaseAdmin().from("marketing_integrations")
        .select("id,ga4_property_id,ga4_stream_id,utm_source,utm_medium,utm_campaign").eq("user_id", userId);
      if (error) throw new Error("Não foi possível verificar a exclusividade da UTM.");
      if (!exclusiveUtm(i, siblings || [])) return json({ error: "UTM compartilhada entre campanhas. Corrija o vínculo antes de atribuir retorno." }, 409);
      if (section === "tracking") return json(await fetchCampaignTracking(userId, config, { from: shiftDate(today, -27), to: today }));
      const date = req.nextUrl.searchParams.get("date");
      if (!validCohortDate(date, today)) return json({ error: "Escolha um dia válido dos últimos 366 dias." }, 400);
      const end = shiftDate(date, 30); const until = end < today ? end : today;
      const [report, spendRows] = await Promise.all([fetchCampaignCohortRows(userId, config, date, until), fetchMetaDailyInsights(userId, i.meta_campaign_id, { from: date, to: date })]);
      const spend = spendRows.reduce((sum, r) => sum + r.spend, 0);
      return json({ date, spend, windows: cohortWindows(date, today, spend, report.rows), thresholded: report.thresholded, timeZone: report.timeZone });
    }
    return json({ error: "Seção inválida." }, 400);
  } catch (error) { console.error("Campaign detail:", error instanceof Error ? error.message : "unknown"); return json({ error: error instanceof Error ? error.message : "Consulta indisponível." }, 502); }
}

export async function POST(req: NextRequest, context: Context) {
  const { userId } = await auth();
  if (!userId) return json({ error: "Sessão necessária." }, 401);
  const origin = req.headers.get("origin");
  if (origin && origin !== req.nextUrl.origin) return json({ error: "Origem inválida." }, 403);
  try {
    const { id } = await context.params; const i = await owner(id, userId);
    if (!i) return json({ error: "Campanha não encontrada." }, 404);
    const body = await req.json().catch(() => null);
    if (body?.action === "observe") { await recordCampaignObservation(userId, id, i.meta_campaign_id); return json({ success: true }); }
    const note = decisionText(body?.note);
    if (!note) return json({ error: "Escreva uma decisão de 1 a 2.000 caracteres." }, 400);
    const { error } = await getSupabaseAdmin().from("campaign_history").insert({ integration_id: id, user_id: userId, kind: "decision", note });
    if (error) throw new Error("Não foi possível salvar a decisão.");
    return json({ success: true });
  } catch (error) { return json({ error: error instanceof Error ? error.message : "Operação indisponível." }, 502); }
}
