import { notFound } from "next/navigation";
import { Header } from "@/components/header";
import { KpiCard } from "@diced/ui/kpi-card";
import { Badge } from "@diced/ui/badge";
import { getAppById } from "@/lib/data";
import type { AppStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

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

export default async function AppDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const app = await getAppById(id);

  if (!app) return notFound();

  return (
    <div>
      <Header title={app.name} />
      <div className="space-y-6 p-6">
        {/* App Info */}
        <div className="flex items-center gap-4">
          <span className="text-4xl">{app.icon}</span>
          <div>
            <h2 className="text-2xl font-bold font-heading">{app.name}</h2>
            <p className="text-sm text-zinc-400">{app.packageName}</p>
          </div>
          <Badge variant={statusVariant[app.status]}>
            {statusLabel[app.status]}
          </Badge>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Rating"
            value={app.rating > 0 ? String(app.rating) : "N/A"}
            icon={<span className="text-lg">⭐</span>}
          />
          <KpiCard
            title="Downloads"
            value={app.downloads > 0 ? app.downloads.toLocaleString() : "N/A"}
            icon={<span className="text-lg">📥</span>}
          />
          <KpiCard
            title="Revenue"
            value={app.revenue > 0 ? `$${app.revenue.toFixed(2)}` : "N/A"}
            icon={<span className="text-lg">💰</span>}
          />
          <KpiCard
            title="eCPM"
            value={app.ecpm > 0 ? `$${app.ecpm.toFixed(2)}` : "N/A"}
            icon={<span className="text-lg">📊</span>}
          />
        </div>
      </div>
    </div>
  );
}
