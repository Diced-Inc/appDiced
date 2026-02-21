"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { DicedApp } from "@/lib/types";

interface RevenueByAppChartProps {
  apps: DicedApp[];
}

export function RevenueByAppChart({ apps }: RevenueByAppChartProps) {
  const data = apps
    .filter((a) => a.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .map((a) => ({ name: a.name.replace("Diced ", ""), revenue: a.revenue }));

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
          <XAxis dataKey="name" stroke="#71717a" fontSize={12} />
          <YAxis stroke="#71717a" fontSize={12} tickFormatter={(v: number) => `$${v}`} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1B1B26",
              border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: "12px",
              color: "#fff",
            }}
            formatter={(value) => [`$${Number(value ?? 0).toFixed(2)}`, "Revenue"]}
          />
          <Bar dataKey="revenue" fill="#8B5CF6" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
