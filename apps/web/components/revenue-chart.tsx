"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { DailyRevenue } from "@/lib/types";

interface RevenueChartProps {
  data: DailyRevenue[];
}

export function RevenueChart({ data }: RevenueChartProps) {
  return (
    <div className="h-[220px] w-full md:h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
          <XAxis
            dataKey="date"
            stroke="#71717a"
            fontSize={12}
            tickFormatter={(value: string) => {
              const d = new Date(value);
              return `${d.getDate()}/${d.getMonth() + 1}`;
            }}
          />
          <YAxis stroke="#71717a" fontSize={12} tickFormatter={(v: number) => `$${v}`} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1B1B26",
              border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: "12px",
              color: "#fff",
            }}
            formatter={(value) => [`$${Number(value ?? 0).toFixed(2)}`, "Receita"]}
            labelFormatter={(label) => {
              const d = new Date(String(label));
              return d.toLocaleDateString("pt-BR");
            }}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#8B5CF6"
            strokeWidth={2}
            fill="url(#revenueGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
