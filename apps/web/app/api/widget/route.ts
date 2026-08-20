import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSummary, getDailyRevenue } from "@/lib/data";
import { toBrazilDateStr } from "@/lib/date";
import type { DateRange } from "@/lib/period";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Sparkline dos últimos 7 dias corridos; total = mês corrente
  const todayForRange = toBrazilDateStr();
  const since = new Date(`${todayForRange}T12:00:00`);
  since.setDate(since.getDate() - 6);
  const last7: DateRange = { from: since.toISOString().split("T")[0]!, to: todayForRange };

  const [summary, dailyRevenue] = await Promise.all([
    getSummary(userId),
    getDailyRevenue(userId, last7),
  ]);

  const today = toBrazilDateStr();
  const todayRevenue = dailyRevenue
    .filter((r) => r.date === today)
    .reduce((sum, r) => sum + r.revenue, 0);

  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = toBrazilDateStr(yesterdayDate);
  const yesterdayRevenue = dailyRevenue
    .filter((r) => r.date === yesterday)
    .reduce((sum, r) => sum + r.revenue, 0);

  // Aggregate daily totals for the sparkline
  const dailyTotals = new Map<string, number>();
  for (const r of dailyRevenue) {
    dailyTotals.set(r.date, (dailyTotals.get(r.date) ?? 0) + r.revenue);
  }
  const sparkline = Array.from(dailyTotals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => Math.round(v * 100) / 100);

  return NextResponse.json({
    totalRevenue: Math.round(summary.totalRevenue * 100) / 100,
    todayRevenue: Math.round(todayRevenue * 100) / 100,
    yesterdayRevenue: Math.round(yesterdayRevenue * 100) / 100,
    totalApps: summary.totalApps,
    sparkline,
  });
}
