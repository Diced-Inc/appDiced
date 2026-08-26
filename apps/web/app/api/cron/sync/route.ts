import { NextRequest, NextResponse } from "next/server";
import { syncAdMob, listConnectedAdMobUsers } from "@/lib/sync/admob";
import { syncPlayStore } from "@/lib/sync/play";
import { saveRevenueSnapshot } from "@/lib/sync/snapshot";
import { runNotificationRules } from "@/lib/notifications/rules";

export const maxDuration = 300;

/**
 * Cron de coleta. Dois modos:
 *  - ?mode=hourly (padrão): snapshot horário + AdMob lookback 7d — chamado
 *    de hora em hora pelo cron-job.org
 *  - ?mode=daily: AdMob lookback 90d + Play Store + notificações — chamado
 *    1x/dia pelo cron da Vercel
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mode = req.nextUrl.searchParams.get("mode") === "daily" ? "daily" : "hourly";
  const userIds = await listConnectedAdMobUsers();
  const results: Record<string, unknown> = { mode };

  for (const userId of userIds) {
    try {
      const admob = await syncAdMob(userId, {
        lookbackDays: mode === "daily" ? 90 : 7,
      });
      // Resultado completo (contagens + warnings): rota é protegida por CRON_SECRET
      // e os warnings são a única visão de falhas parciais (país / ad unit)
      results[`admob_${userId}`] = admob;

      await saveRevenueSnapshot(userId);

      if (mode === "daily") {
        const play = await syncPlayStore(userId);
        results[`play_${userId}`] = play.success ? "success" : `error: ${play.error}`;

        const sent = await runNotificationRules(userId, { statusChanges: play.statusChanges });
        if (sent.length > 0) results[`notify_${userId}`] = sent;
      }
    } catch (e) {
      results[`user_${userId}`] = `error: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  return NextResponse.json({ success: true, results });
}
