import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  fetchAdMobNetworkReport,
  listAdMobAccounts,
  listAdMobApps,
} from "@/lib/google/admob";
import { fetchPlayStoreInfo } from "@/lib/google/play-icon";
import { sendPushToUser } from "@/lib/push";
import { toBrazilDateStr } from "@/lib/date";
import { monthChunks } from "@/lib/period";
import { parseReport, aggregateBy, round2, round4 } from "@/lib/sync/parse";
import { chunkedUpsert } from "@/lib/sync/persist";
import { recomputeMonthlyEarnings } from "@/lib/sync/monthly";
import { saveRevenueSnapshot } from "@/lib/sync/snapshot";

export interface SyncAdMobOptions {
  /** Janela móvel a sincronizar (padrão 7). Ignorado se backfillFrom vier. */
  lookbackDays?: number;
  /** Reconstrói o histórico desde esta data (YYYY-MM-DD), em lotes mensais. */
  backfillFrom?: string;
}

export type SyncAdMobResult =
  | { skipped: true; reason: string }
  | { error: string }
  | {
      success: true;
      range: { from: string; to: string };
      dailyRows: number;
      countryRows: number;
      adUnitRows: number;
      todayRevenue: number;
      warnings: string[];
    };

function shiftDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0]!;
}

/**
 * Sync unificado da AdMob: descobre apps, alimenta o livro-razão
 * (daily_revenue / country_revenue / ad_unit_revenue) via upsert acumulativo,
 * grava snapshot horário e recalcula o extrato mensal.
 *
 * Nunca deleta histórico.
 */
export async function syncAdMob(
  userId: string,
  opts: SyncAdMobOptions = {}
): Promise<SyncAdMobResult> {
  const supabase = getSupabaseAdmin();
  const warnings: string[] = [];

  // Sem conexão AdMob → nada a fazer
  const { data: connData } = await supabase
    .from("api_connections")
    .select("config, refresh_token")
    .eq("provider", "admob")
    .eq("user_id", userId)
    .single();

  const connection = connData as {
    config: Record<string, string> | null;
    refresh_token: string | null;
  } | null;

  if (!connection?.refresh_token) {
    return { skipped: true, reason: "not_connected" };
  }

  const { data: logData } = await supabase
    .from("sync_log")
    .insert({ provider: "admob", status: "running", user_id: userId } as Record<string, unknown>)
    .select("id")
    .single();
  const logEntry = logData as { id: string } | null;

  try {
    // Conta AdMob
    let accountId = connection.config?.account_id;
    if (!accountId) {
      const account = await listAdMobAccounts(userId);
      if (!account) throw new Error("No AdMob account found");
      accountId = account;
      await supabase
        .from("api_connections")
        .update({ config: { account_id: accountId } })
        .eq("provider", "admob")
        .eq("user_id", userId);
    }

    // Descoberta de apps + limpeza de entradas lixo (package = ca-app-pub-*)
    const admobApps = await listAdMobApps(userId, accountId);

    const { data: junkApps } = await supabase
      .from("apps")
      .select("id")
      .eq("user_id", userId)
      .like("package_name", "ca-app-pub-%");
    if (junkApps && junkApps.length > 0) {
      const junkIds = (junkApps as { id: string }[]).map((a) => a.id);
      await supabase.from("daily_revenue").delete().in("app_id", junkIds);
      await supabase.from("apps").delete().in("id", junkIds);
    }

    for (const admobApp of admobApps) {
      const packageName = admobApp.linkedAppInfo?.appStoreId;
      if (!packageName) continue;

      const { data: existing } = await supabase
        .from("apps")
        .select("id")
        .eq("package_name", packageName)
        .eq("user_id", userId)
        .single();

      if (!existing) {
        const displayName =
          admobApp.linkedAppInfo?.displayName ??
          admobApp.manualAppInfo?.displayName ??
          packageName;
        const storeInfo = await fetchPlayStoreInfo(packageName);
        await supabase.from("apps").insert({
          name: displayName,
          package_name: packageName,
          icon: storeInfo.icon ?? "📱",
          status: "published",
          rating: storeInfo.rating ?? 0,
          downloads: storeInfo.downloads ?? 0,
          revenue: 0,
          impressions: 0,
          ecpm: 0,
          user_id: userId,
        });
      }
    }

    // Mapeamento AdMob appId / resource name → app do banco
    const { data: appsData } = await supabase
      .from("apps")
      .select("id, package_name")
      .eq("user_id", userId);
    const allApps = (appsData as { id: string; package_name: string }[] | null) ?? [];
    const allAppIds = allApps.map((a) => a.id);

    const admobIdToDbId = new Map<string, string>();
    for (const admobApp of admobApps) {
      const pkg = admobApp.linkedAppInfo?.appStoreId;
      if (!pkg) continue;
      const dbApp = allApps.find((a) => a.package_name === pkg);
      if (dbApp) {
        admobIdToDbId.set(admobApp.appId, dbApp.id);
        admobIdToDbId.set(admobApp.name, dbApp.id);
      }
    }

    // Intervalos a sincronizar
    const today = toBrazilDateStr();
    const ranges = opts.backfillFrom
      ? monthChunks(opts.backfillFrom, today)
      : [{ from: shiftDays(today, -((opts.lookbackDays ?? 7) - 1)), to: today }];
    const fullRange = { from: ranges[0]!.from, to: ranges[ranges.length - 1]!.to };

    // Receita de hoje ANTES do upsert (pra notificação de aumento)
    const { data: beforeData } = await supabase
      .from("daily_revenue")
      .select("revenue")
      .in("app_id", allAppIds)
      .eq("date", today);
    const todayBefore =
      (beforeData as { revenue: number }[] | null)?.reduce((s, r) => s + Number(r.revenue), 0) ?? 0;

    // Coleta + upsert por intervalo
    let dailyRows = 0;
    let countryRows = 0;
    let adUnitRows = 0;
    let todayAfter = todayBefore;
    const unmapped = new Set<string>();

    for (const range of ranges) {
      // --- Receita diária por app ---
      const appReport = await fetchAdMobNetworkReport(userId, accountId, range, "APP");
      const appRows = parseReport(appReport, "APP");

      const mappedRows = appRows.filter((r) => {
        if (admobIdToDbId.has(r.key)) return true;
        unmapped.add(r.key);
        return false;
      });

      const dailyAgg = aggregateBy(mappedRows, (r) => `${admobIdToDbId.get(r.key)}|${r.date}`);
      const dailyUpserts = Array.from(dailyAgg.entries()).map(([key, agg]) => {
        const [appId, date] = key.split("|");
        return {
          app_id: appId,
          date,
          revenue: round2(agg.revenue),
          impressions: agg.impressions,
        };
      });
      await chunkedUpsert(supabase, "daily_revenue", dailyUpserts, "app_id,date");
      dailyRows += dailyUpserts.length;

      const todayRow = dailyUpserts.filter((r) => r.date === today);
      if (todayRow.length > 0) {
        todayAfter = todayRow.reduce((s, r) => s + r.revenue, 0);
      }

      // --- Receita diária por país ---
      try {
        const countryReport = await fetchAdMobNetworkReport(userId, accountId, range, "COUNTRY");
        const countryAgg = aggregateBy(parseReport(countryReport, "COUNTRY"), (r) => `${r.key}|${r.date}`);
        const countryUpserts = Array.from(countryAgg.entries())
          .filter(([, agg]) => agg.revenue > 0 || agg.impressions > 0)
          .map(([key, agg]) => {
            const [countryCode, date] = key.split("|");
            return {
              user_id: userId,
              country_code: countryCode,
              revenue: round2(agg.revenue),
              impressions: agg.impressions,
              period_start: date,
              period_end: date,
            };
          });
        await chunkedUpsert(supabase, "country_revenue", countryUpserts, "user_id,country_code,period_start");
        countryRows += countryUpserts.length;
      } catch (e) {
        warnings.push(`country report (${range.from}): ${e instanceof Error ? e.message : String(e)}`);
      }

      // --- Receita diária por ad unit ---
      try {
        const adUnitReport = await fetchAdMobNetworkReport(userId, accountId, range, "AD_UNIT");
        const adUnitAgg = aggregateBy(parseReport(adUnitReport, "AD_UNIT"), (r) => `${r.key}|${r.date}`);
        const adUnitUpserts = Array.from(adUnitAgg.entries())
          .filter(([, agg]) => agg.revenue > 0 || agg.impressions > 0)
          .map(([key, agg]) => {
            const [adUnitId, date] = key.split("|");
            return {
              user_id: userId,
              ad_unit_id: adUnitId,
              ad_unit_name: agg.label ?? adUnitId,
              revenue: round4(agg.revenue),
              impressions: agg.impressions,
              period_start: date,
              period_end: date,
            };
          });
        await chunkedUpsert(supabase, "ad_unit_revenue", adUnitUpserts, "user_id,ad_unit_id,period_start");
        adUnitRows += adUnitUpserts.length;
      } catch (e) {
        warnings.push(`ad unit report (${range.from}): ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // Linha da AdMob sem app correspondente = aviso, nunca receita no app errado
    if (unmapped.size > 0) {
      warnings.push(`apps AdMob sem vínculo (receita ignorada): ${Array.from(unmapped).join(", ")}`);
    }

    // Snapshot horário + extrato mensal
    await saveRevenueSnapshot(userId);
    try {
      await recomputeMonthlyEarnings(userId);
    } catch (e) {
      warnings.push(`monthly earnings: ${e instanceof Error ? e.message : String(e)}`);
    }

    // Notificação de aumento de receita hoje (≥ $1 desde o último sync)
    const diff = round2(todayAfter - todayBefore);
    if (diff >= 1.0) {
      try {
        await sendPushToUser(userId, {
          title: "Receita Atualizada",
          body: `Hoje: $${round2(todayAfter).toFixed(2)} (+$${diff.toFixed(2)})`,
          url: "/revenue",
        });
      } catch (e) {
        console.error("[Push] Failed to send notification:", e);
      }
    }

    if (logEntry) {
      await supabase
        .from("sync_log")
        .update({
          status: "success",
          message: warnings.length > 0 ? warnings.join(" | ") : null,
          ended_at: new Date().toISOString(),
        })
        .eq("id", logEntry.id);
    }

    await supabase
      .from("api_connections")
      .update({
        last_sync: new Date().toISOString(),
        status: "connected",
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("provider", "admob")
      .eq("user_id", userId);

    return {
      success: true,
      range: fullRange,
      dailyRows,
      countryRows,
      adUnitRows,
      todayRevenue: round2(todayAfter),
      warnings,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (logEntry) {
      await supabase
        .from("sync_log")
        .update({ status: "error", message, ended_at: new Date().toISOString() })
        .eq("id", logEntry.id);
    }

    console.error("[AdMob Sync Error]", message);
    return { error: message };
  }
}

/** Todos os user_ids com conexão AdMob válida (pro cron). */
export async function listConnectedAdMobUsers(): Promise<string[]> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("api_connections")
    .select("user_id")
    .eq("provider", "admob")
    .not("refresh_token", "is", null)
    .not("user_id", "is", null);
  return ((data as { user_id: string }[] | null) ?? []).map((c) => c.user_id);
}
