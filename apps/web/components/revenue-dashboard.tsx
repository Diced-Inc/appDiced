"use client";

import { useState, useMemo } from "react";
import type { DicedApp, DailyRevenue } from "@/lib/types";
import { KpiCard } from "@diced/ui/kpi-card";
import { Card } from "@diced/ui/card";
import { RevenueChart } from "@/components/revenue-chart";
import { RevenueByAppChart } from "@/components/revenue-by-app-chart";

interface RevenueDashboardProps {
  apps: DicedApp[];
  dailyRevenue: DailyRevenue[];
}

export function RevenueDashboard({ apps, dailyRevenue }: RevenueDashboardProps) {
  const [selectedAppId, setSelectedAppId] = useState<string>("all");

  const filteredRevenue = useMemo(() => {
    const rows =
      selectedAppId === "all"
        ? dailyRevenue
        : dailyRevenue.filter((r) => r.appId === selectedAppId);

    // Aggregate by date
    const byDate = new Map<string, number>();
    for (const row of rows) {
      byDate.set(row.date, (byDate.get(row.date) ?? 0) + row.revenue);
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, revenue]) => ({ date, revenue }));
  }, [dailyRevenue, selectedAppId]);

  const filteredApps = useMemo(
    () =>
      selectedAppId === "all"
        ? apps
        : apps.filter((a) => a.id === selectedAppId),
    [apps, selectedAppId]
  );

  const totalRevenue = filteredApps.reduce((sum, a) => sum + a.revenue, 0);
  const totalImpressions = filteredApps.reduce(
    (sum, a) => sum + a.impressions,
    0
  );
  const appsWithEcpm = filteredApps.filter((a) => a.ecpm > 0);
  const avgEcpm =
    appsWithEcpm.length > 0
      ? Math.round(
          (appsWithEcpm.reduce((sum, a) => sum + a.ecpm, 0) /
            appsWithEcpm.length) *
            100
        ) / 100
      : 0;

  return (
    <>
      {/* Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setSelectedAppId("all")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            selectedAppId === "all"
              ? "bg-violet-500/10 text-violet-400"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          Todos os Apps
        </button>
        {apps.map((app) => (
          <button
            key={app.id}
            onClick={() => setSelectedAppId(app.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              selectedAppId === app.id
                ? "bg-violet-500/10 text-violet-400"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            {app.name}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-3">
        <KpiCard
          title="Receita Total"
          value={`$${totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
          icon={<span className="text-lg">💰</span>}
        />
        <KpiCard
          title="Total de Impressões"
          value={totalImpressions.toLocaleString()}
          icon={<span className="text-lg">👁️</span>}
        />
        <KpiCard
          title="eCPM Médio"
          value={avgEcpm > 0 ? `$${avgEcpm}` : "N/A"}
          icon={<span className="text-lg">📊</span>}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-lg font-semibold font-heading">
            Receita Diária
          </h2>
          <RevenueChart data={filteredRevenue} />
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-semibold font-heading">
            Receita por App
          </h2>
          <RevenueByAppChart apps={filteredApps} />
        </Card>
      </div>
    </>
  );
}
