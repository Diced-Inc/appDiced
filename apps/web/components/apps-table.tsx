"use client";

import { useState } from "react";
import Link from "next/link";
import type { AppStatus, DicedApp } from "@/lib/types";
import { Badge } from "@diced/ui/badge";

const statusVariant: Record<AppStatus, "success" | "warning" | "error" | "info" | "default"> = {
  published: "success",
  in_review: "warning",
  suspended: "error",
  draft: "default",
  removed: "error",
};

const statusLabel: Record<AppStatus, string> = {
  published: "Published",
  in_review: "In Review",
  suspended: "Suspended",
  draft: "Draft",
  removed: "Removed",
};

const filters: { label: string; value: AppStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Published", value: "published" },
  { label: "In Review", value: "in_review" },
  { label: "Suspended", value: "suspended" },
  { label: "Draft", value: "draft" },
];

interface AppsTableProps {
  apps: DicedApp[];
}

export function AppsTable({ apps }: AppsTableProps) {
  const [filter, setFilter] = useState<AppStatus | "all">("all");

  const filtered = filter === "all" ? apps : apps.filter((a) => a.status === filter);

  return (
    <div>
      {/* Filters */}
      <div className="mb-4 flex gap-2">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === f.value
                ? "bg-violet-500/10 text-violet-400"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-white/5">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/5 bg-surface">
            <tr>
              <th className="px-4 py-3 font-medium text-zinc-400">App</th>
              <th className="px-4 py-3 font-medium text-zinc-400">Status</th>
              <th className="px-4 py-3 font-medium text-zinc-400 text-right">Rating</th>
              <th className="px-4 py-3 font-medium text-zinc-400 text-right">Downloads</th>
              <th className="px-4 py-3 font-medium text-zinc-400 text-right">Revenue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.map((app) => (
              <tr key={app.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3">
                  <Link href={`/apps/${app.id}`} className="flex items-center gap-3">
                    <span className="text-xl">{app.icon}</span>
                    <div>
                      <p className="font-medium text-white">{app.name}</p>
                      <p className="text-xs text-zinc-500">{app.packageName}</p>
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={statusVariant[app.status]}>
                    {statusLabel[app.status]}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right text-zinc-300">
                  {app.rating > 0 ? `${app.rating} ⭐` : "—"}
                </td>
                <td className="px-4 py-3 text-right text-zinc-300">
                  {app.downloads > 0 ? app.downloads.toLocaleString() : "—"}
                </td>
                <td className="px-4 py-3 text-right text-zinc-300">
                  {app.revenue > 0 ? `$${app.revenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
