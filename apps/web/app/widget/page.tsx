"use client";

import { useEffect, useState, useCallback } from "react";

interface WidgetData {
  totalRevenue: number;
  todayRevenue: number;
  yesterdayRevenue: number;
  totalApps: number;
  sparkline: number[];
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const h = 40;
  const w = 160;
  const step = w / (data.length - 1);

  const points = data
    .map((v, i) => `${i * step},${h - ((v - min) / range) * (h - 4) - 2}`)
    .join(" ");

  return (
    <svg width={w} height={h} className="opacity-80">
      <polyline
        points={points}
        fill="none"
        stroke="#a78bfa"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatCurrency(value: number) {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function WidgetPage() {
  const [data, setData] = useState<WidgetData | null>(null);
  const [error, setError] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/widget");
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData(json);
      setError(false);
      setLastUpdate(new Date());
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000); // refresh every 5min
    return () => clearInterval(interval);
  }, [fetchData]);

  const diff = data ? data.todayRevenue - data.yesterdayRevenue : 0;
  const diffSign = diff >= 0 ? "+" : "";

  return (
    <div className="flex min-h-screen select-none items-center justify-center bg-[#0c0a13] p-3">
      <div className="w-full max-w-xs space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-500/20">
              <span className="text-xs">🎲</span>
            </div>
            <span className="text-xs font-medium tracking-wide text-zinc-400">
              DICED
            </span>
          </div>
          {lastUpdate && (
            <span className="text-[10px] text-zinc-600">
              {lastUpdate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>

        {error && (
          <div className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
            Erro ao carregar dados
          </div>
        )}

        {data && (
          <>
            {/* Total Revenue - Main KPI */}
            <div className="rounded-xl bg-[#13111c] p-4">
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                Receita Total (30d)
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-white font-heading">
                {formatCurrency(data.totalRevenue)}
              </p>
              <div className="mt-2">
                <Sparkline data={data.sparkline} />
              </div>
            </div>

            {/* Today + Yesterday */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-[#13111c] p-3">
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                  Hoje
                </p>
                <p className="mt-0.5 text-lg font-bold text-white font-heading">
                  {formatCurrency(data.todayRevenue)}
                </p>
                {diff !== 0 && (
                  <p className={`text-[10px] font-medium ${diff >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {diffSign}{formatCurrency(Math.abs(diff))} vs ontem
                  </p>
                )}
              </div>

              <div className="rounded-xl bg-[#13111c] p-3">
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                  Ontem
                </p>
                <p className="mt-0.5 text-lg font-bold text-white font-heading">
                  {formatCurrency(data.yesterdayRevenue)}
                </p>
                <p className="text-[10px] text-zinc-600">
                  {data.totalApps} app{data.totalApps !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          </>
        )}

        {!data && !error && (
          <div className="flex h-32 items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          </div>
        )}

        {/* Open Dashboard link */}
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-lg bg-violet-500/10 px-3 py-1.5 text-center text-[10px] font-medium text-violet-400 transition-colors hover:bg-violet-500/20"
        >
          Abrir Dashboard
        </a>
      </div>
    </div>
  );
}
