import Link from "next/link";
import type { DicedApp, AppStatus } from "@/lib/types";
import { Badge } from "@diced/ui/badge";
import { AppIcon } from "@/components/app-icon";

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

function fmt(v: number) {
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Ranking de apps por receita do período. Badge de status só aparece
 * quando o app NÃO está publicado — status normal é ruído.
 */
export function TopApps({ apps }: { apps: DicedApp[] }) {
  const sorted = [...apps].sort((a, b) => b.revenue - a.revenue);
  const total = sorted.reduce((s, a) => s + a.revenue, 0);

  const totalDownloads = apps.reduce((s, a) => s + a.downloads, 0);
  const rated = apps.filter((a) => a.rating > 0);
  const avgRating =
    rated.length > 0
      ? Math.round((rated.reduce((s, a) => s + a.rating, 0) / rated.length) * 10) / 10
      : 0;

  return (
    <div>
      <div className="space-y-2">
        {sorted.map((app) => {
          const pct = total > 0 ? (app.revenue / total) * 100 : 0;
          return (
            <Link
              key={app.id}
              href={`/apps/${app.id}`}
              className="relative block overflow-hidden rounded-lg bg-white/[0.03] px-3 py-2.5 transition-colors hover:bg-white/[0.06]"
            >
              <div className="absolute inset-y-0 left-0 bg-violet-500/10" style={{ width: `${pct}%` }} />
              <div className="relative flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <AppIcon icon={app.icon} name={app.name} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{app.name}</p>
                    {app.status !== "published" && (
                      <Badge variant={statusVariant[app.status]}>{statusLabel[app.status]}</Badge>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-white">{fmt(app.revenue)}</p>
                  <p className="text-[10px] text-zinc-500">{pct.toFixed(0)}%</p>
                </div>
              </div>
            </Link>
          );
        })}
        {sorted.length === 0 && (
          <p className="text-sm text-zinc-500">Nenhum app ainda. Conecte o AdMob em Configurações.</p>
        )}
      </div>

      {apps.length > 0 && (
        <p className="mt-3 border-t border-white/5 pt-3 text-xs text-zinc-500">
          {apps.length} apps · {totalDownloads.toLocaleString("pt-BR")} downloads
          {avgRating > 0 ? ` · nota ${avgRating.toLocaleString("pt-BR")}` : ""}
        </p>
      )}
    </div>
  );
}
