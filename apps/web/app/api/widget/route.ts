import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSummary, getDailyRevenue } from "@/lib/data";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [summary, dailyRevenue] = await Promise.all([
    getSummary(userId),
    getDailyRevenue(userId, 7),
  ]);

  const today = new Date().toISOString().split("T")[0];
  const todayRevenue = dailyRevenue
    .filter((r) => r.date === today)
    .reduce((sum, r) => sum + r.revenue, 0);

  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = yesterdayDate.toISOString().split("T")[0];
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
