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
  const h = 24;
  const w = 80;
  const step = w / (data.length - 1);

  const points = data
    .map((v, i) => `${i * step},${h - ((v - min) / range) * (h - 2) - 1}`)
    .join(" ");

  return (
    <svg width={w} height={h}>
      <polyline
        points={points}
        fill="none"
        stroke="#a78bfa"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function fmt(v: number) {
  return `$${v.toFixed(2)}`;
}

export default function WidgetPage() {
  const [data, setData] = useState<WidgetData | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/widget");
      if (!res.ok) return;
      setData(await res.json());
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchData();
    const i = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(i);
  }, [fetchData]);

  const diff = data ? data.todayRevenue - data.yesterdayRevenue : 0;

  return (
    <div
      className="flex min-h-screen select-none items-start bg-[#0c0a13] app-region-drag"
      style={{ appRegion: "drag" } as React.CSSProperties}
    >
      <div className="w-full p-2 pt-[env(titlebar-area-height,8px)]">
        {!data ? (
          <div className="flex h-16 items-center justify-center">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-1.5">
            {/* Main revenue + sparkline */}
            <div className="flex items-center justify-between rounded-lg bg-[#13111c] px-2.5 py-2">
              <div>
                <p className="text-[8px] font-medium uppercase tracking-widest text-zinc-500">
                  30 dias
                </p>
                <p className="text-lg font-bold leading-tight text-white font-heading">
                  {fmt(data.totalRevenue)}
                </p>
              </div>
              <Sparkline data={data.sparkline} />
            </div>

            {/* Today / Yesterday row */}
            <div className="flex gap-1.5">
              <div className="flex-1 rounded-lg bg-[#13111c] px-2.5 py-1.5">
                <p className="text-[8px] font-medium uppercase tracking-widest text-zinc-500">
                  Hoje
                </p>
                <p className="text-sm font-bold leading-tight text-white font-heading">
                  {fmt(data.todayRevenue)}
                </p>
                {diff !== 0 && (
                  <p className={`text-[8px] ${diff >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {diff >= 0 ? "+" : ""}{fmt(Math.abs(diff))}
                  </p>
                )}
              </div>
              <div className="flex-1 rounded-lg bg-[#13111c] px-2.5 py-1.5">
                <p className="text-[8px] font-medium uppercase tracking-widest text-zinc-500">
                  Ontem
                </p>
                <p className="text-sm font-bold leading-tight text-white font-heading">
                  {fmt(data.yesterdayRevenue)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
