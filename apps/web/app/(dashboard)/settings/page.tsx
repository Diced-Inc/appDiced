import { auth } from "@clerk/nextjs/server";
import { Header } from "@/components/header";
import { Card } from "@diced/ui/card";
import { Badge } from "@diced/ui/badge";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getAdMobAuthUrl } from "@/lib/google/admob";
import { SyncButton } from "@/components/sync-button";
import { NotificationSettings } from "@/components/notification-settings";

export const dynamic = "force-dynamic";

interface ApiConnection {
  provider: string;
  status: string;
  last_sync: string | null;
  error_message: string | null;
}

export default async function SettingsPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const supabase = getSupabaseAdmin();

  const { data } = await supabase
    .from("api_connections")
    .select("provider, status, last_sync, error_message")
    .eq("user_id", userId);

  const connections = data as ApiConnection[] | null;

  const playConnection = connections?.find(
    (c) => c.provider === "google_play"
  );
  const admobConnection = connections?.find((c) => c.provider === "admob");

  const admobAuthUrl = getAdMobAuthUrl();

  const statusVariant = (status: string | undefined) => {
    switch (status) {
      case "connected":
        return "success" as const;
      case "error":
        return "error" as const;
      default:
        return "default" as const;
    }
  };

  const statusLabel = (status: string | undefined) => {
    switch (status) {
      case "connected":
        return "Conectado";
      case "error":
        return "Erro";
      default:
        return "Desconectado";
    }
  };

  return (
    <div>
      <Header title="Configurações" />
      <div className="space-y-4 p-4 md:space-y-6 md:p-6">
        {/* Google Play Connection */}
        <Card>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-base font-semibold font-heading md:text-lg">
                Google Play API
              </h2>
              <p className="mt-1 text-xs text-zinc-400 md:text-sm">
                Autenticação por conta de serviço. Fornece avaliações e informações do app.
              </p>
              {playConnection?.error_message && (
                <p className="mt-1 text-xs text-red-400">
                  {playConnection.error_message}
                </p>
              )}
              {playConnection?.last_sync && (
                <p className="mt-2 text-xs text-zinc-500">
                  Última sync:{" "}
                  {new Date(playConnection.last_sync).toLocaleString("pt-BR")}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <Badge variant={statusVariant(playConnection?.status)}>
                {statusLabel(playConnection?.status)}
              </Badge>
              <SyncButton provider="play-store" />
            </div>
          </div>
        </Card>

        {/* AdMob Connection */}
        <Card>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-base font-semibold font-heading md:text-lg">AdMob API</h2>
              <p className="mt-1 text-xs text-zinc-400 md:text-sm">
                Autenticação OAuth 2.0. Fornece receita, impressões e eCPM.
              </p>
              {admobConnection?.error_message && (
                <p className="mt-1 text-xs text-red-400">
                  {admobConnection.error_message}
                </p>
              )}
              {admobConnection?.last_sync && (
                <p className="mt-2 text-xs text-zinc-500">
                  Última sync:{" "}
                  {new Date(admobConnection.last_sync).toLocaleString("pt-BR")}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <Badge variant={statusVariant(admobConnection?.status)}>
                {statusLabel(admobConnection?.status)}
              </Badge>
              {admobConnection?.status === "connected" && (
                <SyncButton provider="admob" />
              )}
              {admobAuthUrl && (
                <a
                  href={admobAuthUrl}
                  className="rounded-lg bg-violet-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-violet-600 md:px-4 md:py-2"
                >
                  {admobConnection?.status === "connected"
                    ? "Reconectar"
                    : "Conectar"}
                </a>
              )}
              {!admobAuthUrl && (
                <span className="text-xs text-zinc-500">
                  Configure ADMOB_CLIENT_ID no .env
                </span>
              )}
            </div>
          </div>
        </Card>

        {/* Push Notifications */}
        <Card>
          <NotificationSettings />
        </Card>

        {/* Manual Data Info */}
        <Card>
          <h2 className="text-base font-semibold font-heading md:text-lg">Dados Manuais</h2>
          <p className="mt-1 text-xs text-zinc-400 md:text-sm">
            Downloads, avaliações e outras métricas que as APIs não fornecem podem ser atualizadas pela API em{" "}
            <code className="rounded bg-zinc-800 px-1 py-0.5 text-xs">
              PATCH /api/apps/:id
            </code>
          </p>
        </Card>
      </div>
    </div>
  );
}
