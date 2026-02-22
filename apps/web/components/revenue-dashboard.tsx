"use client";

import { useState, useMemo } from "react";
import type { DicedApp, DailyRevenue, CountryRevenue, AdUnitRevenue } from "@/lib/types";
import { KpiCard } from "@diced/ui/kpi-card";
import { Card } from "@diced/ui/card";
import { RevenueChart } from "@/components/revenue-chart";
import { RevenueByAppChart } from "@/components/revenue-by-app-chart";
import { CountryRevenueTable } from "@/components/country-revenue-table";
import { AdUnitRevenueTable } from "@/components/ad-unit-revenue-table";

interface RevenueDashboardProps {
  apps: DicedApp[];
  dailyRevenue: DailyRevenue[];
  countryRevenue: CountryRevenue[];
  adUnitRevenue: AdUnitRevenue[];
}

function fmt(v: number) {
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function RevenueDashboard({ apps, dailyRevenue, countryRevenue, adUnitRevenue }: RevenueDashboardProps) {
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

  // Daily breakdown: today, yesterday, best day
  const todayStr = new Date().toISOString().split("T")[0];
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toISOString().split("T")[0];

  const todayRevenue = filteredRevenue.find((r) => r.date === todayStr)?.revenue ?? 0;
  const yesterdayRevenue = filteredRevenue.find((r) => r.date === yesterdayStr)?.revenue ?? 0;

  const bestDay = filteredRevenue.reduce(
    (best, r) => (r.revenue > best.revenue ? r : best),
    { date: "", revenue: 0 }
  );
  const dailyAvg =
    filteredRevenue.length > 0
      ? Math.round(
          (filteredRevenue.reduce((s, r) => s + r.revenue, 0) / filteredRevenue.length) * 100
        ) / 100
      : 0;

  const todayDiff = todayRevenue - yesterdayRevenue;

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
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <KpiCard
          title="Receita Total (30d)"
          value={fmt(totalRevenue)}
          icon={<span className="text-lg">💰</span>}
        />
        <KpiCard
          title="Hoje"
          value={fmt(todayRevenue)}
          change={todayDiff !== 0 ? `${todayDiff >= 0 ? "+" : ""}${fmt(Math.abs(todayDiff))} vs ontem` : undefined}
          changeType={todayDiff >= 0 ? "positive" : "negative"}
          icon={<span className="text-lg">📅</span>}
        />
        <KpiCard
          title="Média Diária"
          value={fmt(dailyAvg)}
          icon={<span className="text-lg">📊</span>}
        />
        <KpiCard
          title="Melhor Dia"
          value={fmt(bestDay.revenue)}
          change={bestDay.date ? new Date(bestDay.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : undefined}
          changeType="neutral"
          icon={<span className="text-lg">🏆</span>}
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-3">
        <KpiCard
          title="Ontem"
          value={fmt(yesterdayRevenue)}
          icon={<span className="text-lg">📆</span>}
        />
        <KpiCard
          title="Total de Impressões"
          value={totalImpressions.toLocaleString()}
          icon={<span className="text-lg">👁️</span>}
        />
        <KpiCard
          title="eCPM Médio"
          value={avgEcpm > 0 ? fmt(avgEcpm) : "N/A"}
          icon={<span className="text-lg">💹</span>}
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

      {/* Ad Units + Countries */}
      <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-lg font-semibold font-heading">
            Receita por Ad Unit
          </h2>
          <AdUnitRevenueTable data={adUnitRevenue} />
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-semibold font-heading">
            Top Países
          </h2>
          <CountryRevenueTable data={countryRevenue} />
        </Card>
      </div>
    </>
  );
}
