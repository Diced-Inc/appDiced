import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getBankData } from "@/lib/data";
import { expenseInput, monthlyBalance, type Expense, type MediaSpend } from "@/lib/bank-expenses";
import { fetchAll } from "@/lib/sync/persist";
import { toBrazilDateStr } from "@/lib/date";
import { bankExchangeRate } from "@/lib/bank-exchange-rate";

const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
function monthRange(value: string | null) {
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null;
  const date = new Date(`${value}-01T12:00:00Z`);
  return { from: `${value}-01`, to: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 12)).toISOString().slice(0, 10) };
}

export async function GET(req: NextRequest) {
  const { userId } = await auth(); if (!userId) return json({ error: "Sessão necessária." }, 401);
  const range = monthRange(req.nextUrl.searchParams.get("month")); if (!range) return json({ error: "Mês inválido." }, 400);
  try {
    const db = getSupabaseAdmin();
    const [expenses, rate, integrations, bank] = await Promise.all([
      db.from("bank_expenses").select("id,occurred_on,description,category,amount,currency,voided_at").eq("user_id", userId).gte("occurred_on", range.from).lte("occurred_on", range.to).order("occurred_on", { ascending: false }),
      db.from("bank_month_rates").select("usd_brl,updated_at").eq("user_id", userId).eq("month", range.from).maybeSingle(),
      db.from("marketing_integrations").select("id,meta_campaign_id,meta_ad_account_id,meta_campaign_name,last_sync,error_message").eq("user_id", userId), getBankData(userId),
    ]);
    if (expenses.error || rate.error || integrations.error) throw new Error("Não foi possível carregar as despesas e a cotação. Verifique a configuração do banco.");
    const metrics = await fetchAll<{ integration_id: string; date: string; currency: string; spend: number; synced_at: string }>(db, "marketing_daily_metrics", "integration_id,date,currency,spend,synced_at", q => q.eq("user_id", userId).gte("date", range.from).lte("date", range.to).order("date", { ascending: true }));
    const owners = new Map((integrations.data || []).map(i => [i.id, i]));
    const unique = new Map<string, typeof metrics[number]>();
    for (const row of metrics) { const i = owners.get(row.integration_id); if (!i) continue; const key = `${i.meta_ad_account_id}:${i.meta_campaign_id}:${row.date}:${row.currency}`; const old = unique.get(key); if (!old || row.synced_at > old.synced_at) unique.set(key, row); }
    const mediaByCampaign = new Map<string, MediaSpend>();
    for (const row of unique.values()) { const i = owners.get(row.integration_id)!; const key = `${i.meta_ad_account_id}:${i.meta_campaign_id}:${row.currency}`; const old = mediaByCampaign.get(key); mediaByCampaign.set(key, { campaign: i.meta_campaign_name, currency: row.currency, spend: (old?.spend || 0) + Number(row.spend) }); }
    const media = [...mediaByCampaign.values()]; const grossUsd = bank.months.find(m => m.month === range.from)?.gross ?? (bank.currentMonth.month === range.from ? bank.currentMonth.gross : 0);
    const expenseRows = (expenses.data || []).map(e => ({ ...e, amount: Number(e.amount) })) as Expense[];
    const exchange = await bankExchangeRate(range.from.slice(0, 7), toBrazilDateStr(), rate.data ? Number(rate.data.usd_brl) : null);
    const { usdBrl } = exchange;
    const mediaIncomplete = (integrations.data || []).some(i => i.error_message || !i.last_sync);
    return json({ month: range.from, grossUsd, media, expenses: expenseRows, ...exchange, rateUpdatedAt: rate.data?.updated_at || null, ...monthlyBalance(grossUsd, media, expenseRows, usdBrl), mediaIncomplete, monitoredCampaigns: integrations.data?.length || 0 });
  } catch (error) { return json({ error: error instanceof Error ? error.message : "Despesas indisponíveis." }, 502); }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth(); if (!userId) return json({ error: "Sessão necessária." }, 401);
  const origin = req.headers.get("origin"); if (origin && origin !== req.nextUrl.origin) return json({ error: "Origem inválida." }, 403);
  try {
    const body = await req.json().catch(() => null); const db = getSupabaseAdmin();
    if (body?.action === "rate") {
      const range = monthRange(body.month); const rate = Number(body.usdBrl);
      if (!range || !Number.isFinite(rate) || rate <= 0 || rate >= 1000) return json({ error: "Mês ou cotação inválida." }, 400);
      const { error } = await db.from("bank_month_rates").upsert({ user_id: userId, month: range.from, usd_brl: rate, updated_at: new Date().toISOString() });
      if (error) throw new Error("Não foi possível salvar a cotação.");
    } else if (body?.action === "void" || body?.action === "restore") {
      if (typeof body.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id)) return json({ error: "Despesa inválida." }, 400);
      const { data, error } = await db.from("bank_expenses").update({ voided_at: body.action === "void" ? new Date().toISOString() : null }).eq("id", body.id).eq("user_id", userId).select("id").maybeSingle();
      if (error) throw new Error("Não foi possível atualizar a despesa.");
      if (!data) return json({ error: "Despesa não encontrada." }, 404);
    } else {
      const expense = expenseInput(body); if (!expense || expense.occurred_on > toBrazilDateStr()) return json({ error: "Confira descrição, valor, moeda, categoria e data (até hoje)." }, 400);
      const { error } = await db.from("bank_expenses").insert({ user_id: userId, ...expense }); if (error) throw new Error("Não foi possível salvar a despesa.");
    }
    return json({ success: true });
  } catch (error) { return json({ error: error instanceof Error ? error.message : "Operação indisponível." }, 502); }
}
