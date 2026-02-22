"use client";

import type { AdUnitRevenue } from "@/lib/types";

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

export function AdUnitRevenueTable({ data }: AdUnitRevenueTableProps) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Nenhum dado de ad unit disponível. Sincronize o AdMob.
      </p>
    );
  }

  const totalRevenue = data.reduce((sum, d) => sum + d.revenue, 0);

  return (
    <div className="space-y-2">
      {data.map((unit, i) => {
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
  );
}
