import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push";
import { toBrazilDateStr } from "@/lib/date";
import { monthOf } from "@/lib/period";
import { round2 } from "@/lib/sync/parse";
import type { StatusChange } from "@/lib/sync/play";

const ADMOB_THRESHOLD = 100;

/** Insere em notifications_sent; false se já enviada (dedup por unique). */
async function tryMarkSent(userId: string, kind: string, key: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("notifications_sent")
    .insert({ user_id: userId, kind, key });
  if (!error) return true;
  if (error.code === "23505") return false; // duplicada — já notificou
  console.error(`[Notify] mark ${kind}/${key} failed:`, error.message);
  return false;
}

async function notify(
  userId: string,
  kind: string,
  key: string,
  payload: { title: string; body: string; url?: string }
): Promise<boolean> {
  if (!(await tryMarkSent(userId, kind, key))) return false;
  try {
    await sendPushToUser(userId, payload);
  } catch (e) {
    console.error(`[Notify] push ${kind} failed:`, e);
  }
  return true;
}

/** Ontem rendeu menos de 50% da média dos 7 dias anteriores (piso de $1 pra não spammar). */
export function isAnomalousDrop(yesterdayRevenue: number, prev7Avg: number): boolean {
  return prev7Avg >= 1 && yesterdayRevenue < prev7Avg * 0.5;
}

export interface NotificationContext {
  statusChanges?: StatusChange[];
}

/**
 * Roda todas as regras de notificação pro usuário. Idempotente — cada
 * notificação sai no máximo uma vez por chave (dedup em notifications_sent).
 */
export async function runNotificationRules(
  userId: string,
  ctx: NotificationContext = {}
): Promise<string[]> {
  const supabase = getSupabaseAdmin();
  const today = toBrazilDateStr();
  const sent: string[] = [];

  // --- 1. Queda anômala de receita (ontem vs média 7d anterior) ---
  try {
    const { data: appsData } = await supabase.from("apps").select("id").eq("user_id", userId);
    const appIds = ((appsData as { id: string }[] | null) ?? []).map((a) => a.id);

    if (appIds.length > 0) {
      const since = new Date(`${today}T12:00:00`);
      since.setDate(since.getDate() - 8);
      const sinceStr = since.toISOString().split("T")[0]!;

      const { data: revData } = await supabase
        .from("daily_revenue")
        .select("date, revenue")
        .in("app_id", appIds)
        .gte("date", sinceStr)
        .lt("date", today);

      const rows = (revData as { date: string; revenue: number }[] | null) ?? [];
      const byDate = new Map<string, number>();
      for (const r of rows) byDate.set(r.date, (byDate.get(r.date) ?? 0) + Number(r.revenue));

      const yesterday = new Date(`${today}T12:00:00`);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0]!;

      const yesterdayRev = byDate.get(yesterdayStr) ?? 0;
      const prevDays = Array.from(byDate.entries()).filter(([d]) => d < yesterdayStr);
      const prevAvg = prevDays.length > 0 ? prevDays.reduce((s, [, v]) => s + v, 0) / prevDays.length : 0;

      if (isAnomalousDrop(yesterdayRev, prevAvg)) {
        if (
          await notify(userId, "revenue_drop", yesterdayStr, {
            title: "Queda de receita",
            body: `Ontem: $${round2(yesterdayRev).toFixed(2)} — média dos 7 dias era $${round2(prevAvg).toFixed(2)}`,
            url: "/revenue",
          })
        )
          sent.push("revenue_drop");
      }
    }
  } catch (e) {
    console.error("[Notify] revenue_drop rule failed:", e);
  }

  // --- 2. App mudou de status na Play (removido / restaurado) ---
  for (const change of ctx.statusChanges ?? []) {
    const key = `${change.packageName}:${change.to}:${today}`;
    const removed = change.to === "removed";
    if (
      await notify(userId, "app_status", key, {
        title: removed ? "App fora da Play Store" : "App de volta na Play Store",
        body: `${change.name} (${change.packageName}) ${removed ? "não está mais listado" : "voltou a ser listado"}`,
        url: "/apps",
      })
    )
      sent.push("app_status");
  }

  // --- 3/4. Threshold de $100 + pagamento previsto ---
  try {
    const { data: monthsData } = await supabase
      .from("monthly_earnings")
      .select("month, gross, status")
      .eq("user_id", userId);
    const months = (monthsData as { month: string; gross: number; status: string }[] | null) ?? [];
    const receivable = months
      .filter((m) => m.status === "closed")
      .reduce((s, m) => s + Number(m.gross), 0);

    if (receivable >= ADMOB_THRESHOLD) {
      if (
        await notify(userId, "threshold", monthOf(today), {
          title: "Threshold do AdMob atingido",
          body: `Saldo fechado a receber: $${round2(receivable).toFixed(2)} (≥ $${ADMOB_THRESHOLD})`,
          url: "/banco",
        })
      )
        sent.push("threshold");
    }

    const dayOfMonth = Number(today.substring(8, 10));
    if (dayOfMonth === 20 && receivable >= ADMOB_THRESHOLD) {
      if (
        await notify(userId, "payment_due", monthOf(today), {
          title: "Pagamento AdMob chegando",
          body: `Previsto pra ~dia 21: $${round2(receivable).toFixed(2)}`,
          url: "/banco",
        })
      )
        sent.push("payment_due");
    }
  } catch (e) {
    console.error("[Notify] threshold rules failed:", e);
  }

  // --- 5. Sync do AdMob parado há mais de 6h ---
  try {
    const { data: lastOk } = await supabase
      .from("sync_log")
      .select("ended_at")
      .eq("user_id", userId)
      .eq("provider", "admob")
      .eq("status", "success")
      .order("ended_at", { ascending: false })
      .limit(1)
      .single();

    const endedAt = (lastOk as { ended_at: string | null } | null)?.ended_at;
    const staleMs = endedAt ? Date.now() - new Date(endedAt).getTime() : Infinity;
    if (endedAt && staleMs > 6 * 60 * 60 * 1000) {
      if (
        await notify(userId, "sync_stale", today, {
          title: "Sync do AdMob parado",
          body: `Último sync bem-sucedido: ${new Date(endedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
          url: "/settings",
        })
      )
        sent.push("sync_stale");
    }
  } catch (e) {
    console.error("[Notify] sync_stale rule failed:", e);
  }

  return sent;
}
