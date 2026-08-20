"use client";

import { useState, useMemo } from "react";
import type { AdUnitRevenue } from "@/lib/types";
import { toBrazilDateStr } from "@/lib/date";

interface AdUnitRevenueTableProps {
  data: AdUnitRevenue[];
}

const AD_TYPE_LABELS: Record<string, string> = {
  banner: "Banner",
  interstitial: "Intersticial",
  rewarded: "Recompensado",
  native: "Nativo",
  "rewarded interstitial": "Intersticial Recompensado",
  "app open": "App Open",
};

function guessAdType(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, label] of Object.entries(AD_TYPE_LABELS)) {
    if (lower.includes(key)) return label;
  }
  return "Anúncio";
}

function formatCurrency(value: number) {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type Period = "today" | "yesterday" | "7d" | "30d";

const PERIOD_LABELS: { value: Period; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "yesterday", label: "Ontem" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
];

export function AdUnitRevenueTable({ data }: AdUnitRevenueTableProps) {
  const [period, setPeriod] = useState<Period>("30d");

  const aggregated = useMemo(() => {
    const todayStr = toBrazilDateStr();
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = toBrazilDateStr(yesterdayDate);

    let filtered: AdUnitRevenue[];
    if (period === "today") {
      filtered = data.filter((d) => d.date === todayStr);
    } else if (period === "yesterday") {
      filtered = data.filter((d) => d.date === yesterdayStr);
    } else if (period === "7d") {
      const since = new Date();
      since.setDate(since.getDate() - 7);
      const sinceStr = toBrazilDateStr(since);
      filtered = data.filter((d) => d.date >= sinceStr);
    } else {
      filtered = data;
    }

    // Aggregate by ad unit across the filtered dates
    const byUnit = new Map<string, { name: string; revenue: number; impressions: number }>();
    for (const row of filtered) {
      const prev = byUnit.get(row.adUnitId) ?? { name: row.adUnitName, revenue: 0, impressions: 0 };
      byUnit.set(row.adUnitId, {
        name: row.adUnitName,
        revenue: prev.revenue + row.revenue,
        impressions: prev.impressions + row.impressions,
      });
    }

    return Array.from(byUnit.entries())
      .map(([id, d]) => ({
        adUnitId: id,
        adUnitName: d.name,
        revenue: Math.round(d.revenue * 10000) / 10000,
        impressions: d.impressions,
        ecpm: d.impressions > 0 ? Math.round((d.revenue / d.impressions) * 1000 * 100) / 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [data, period]);

  if (data.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Nenhum dado de ad unit disponível. Sincronize o AdMob.
      </p>
    );
  }

  const totalRevenue = aggregated.reduce((sum, d) => sum + d.revenue, 0);

  return (
    <div className="space-y-3">
      {/* Period filter */}
      <div className="flex flex-wrap gap-1">
        {PERIOD_LABELS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              period === p.value
                ? "bg-violet-500/10 text-violet-400"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {aggregated.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Sem dados para este período.
        </p>
      ) : (
        <div className="space-y-2">
          {aggregated.map((unit, i) => {
            const pct = totalRevenue > 0 ? (unit.revenue / totalRevenue) * 100 : 0;

            return (
              <div
                key={unit.adUnitId}
                className="relative overflow-hidden rounded-lg bg-white/[0.03] px-3 py-2.5"
              >
                {/* Progress bar background */}
                <div
                  className="absolute inset-y-0 left-0 bg-violet-500/10"
                  style={{ width: `${pct}%` }}
                />

                <div className="relative flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-zinc-500">
                        #{i + 1}
                      </span>
                      <p className="truncate text-sm font-medium text-white">
                        {unit.adUnitName}
                      </p>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="rounded bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-400">
                        {guessAdType(unit.adUnitName)}
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        {unit.impressions.toLocaleString()} imp
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        eCPM {formatCurrency(unit.ecpm)}
                      </span>
                    </div>
                  </div>

                  <p className="whitespace-nowrap text-sm font-bold text-white">
                    {formatCurrency(unit.revenue)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
