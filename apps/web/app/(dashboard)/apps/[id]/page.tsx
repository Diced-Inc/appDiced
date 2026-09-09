import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { Header } from "@/components/header";
import { KpiCard } from "@diced/ui/kpi-card";
import { Badge } from "@diced/ui/badge";
import { getAppById } from "@/lib/data";
import type { AppStatus } from "@/lib/types";
import { AppIcon } from "@/components/app-icon";
import { EditAppModal } from "@/components/edit-app-modal";
import { KpiIcons } from "@/components/kpi-icons";

export const dynamic = "force-dynamic";

const statusVariant: Record<AppStatus, "success" | "warning" | "error" | "info" | "default"> = {
  published: "success",
  in_review: "warning",
  suspended: "error",
  draft: "default",
  removed: "error",
};

const statusLabel: Record<AppStatus, string> = {
  published: "Publicado",
  in_review: "Em Revisão",
  suspended: "Suspenso",
  draft: "Rascunho",
  removed: "Removido",
};

export default async function AppDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) return notFound();

  const { id } = await params;
  const app = await getAppById(id, userId);

  if (!app) return notFound();

  return (
    <div>
      <Header title={app.name} />
      <div className="space-y-4 p-4 md:space-y-6 md:p-6">
        {/* App Info */}
        <div className="flex items-center gap-3 md:gap-4">
          <AppIcon icon={app.icon} name={app.name} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold font-heading md:text-2xl">{app.name}</h2>
            <p className="truncate text-xs text-zinc-400 md:text-sm">{app.packageName}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={statusVariant[app.status]}>
              {statusLabel[app.status]}
            </Badge>
            <EditAppModal
              appId={app.id}
              currentDownloads={app.downloads}
              currentRating={app.rating}
              currentStatus={app.status}
            />
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
          <KpiCard
            title="Avaliação"
            value={app.rating > 0 ? String(app.rating) : "N/A"}
            icon={KpiIcons.rating}
          />
          <KpiCard
            title="Downloads"
            value={app.downloads > 0 ? app.downloads.toLocaleString() : "N/A"}
            icon={KpiIcons.downloads}
          />
          <KpiCard
            title="Receita"
            value={app.revenue > 0 ? `$${app.revenue.toFixed(2)}` : "N/A"}
            icon={KpiIcons.revenue}
          />
          <KpiCard
            title="eCPM"
            value={app.ecpm > 0 ? `$${app.ecpm.toFixed(2)}` : "N/A"}
            icon={KpiIcons.trendingUp}
          />
        </div>
      </div>
    </div>
  );
}
