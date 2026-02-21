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

interface AppStatusListProps {
  apps: DicedApp[];
}

export function AppStatusList({ apps }: AppStatusListProps) {
  return (
    <div className="space-y-3">
      {apps.map((app) => (
        <div
          key={app.id}
          className="flex items-center justify-between rounded-xl border border-white/5 bg-surface px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <AppIcon icon={app.icon} name={app.name} size="md" />
            <div>
              <p className="text-sm font-medium text-white">{app.name}</p>
              <p className="text-xs text-zinc-500">{app.packageName}</p>
            </div>
          </div>
          <Badge variant={statusVariant[app.status]}>
            {statusLabel[app.status]}
          </Badge>
        </div>
      ))}
    </div>
  );
}
