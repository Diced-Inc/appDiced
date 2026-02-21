import { Header } from "@/components/header";
import { Card } from "@diced/ui/card";
import { Badge } from "@diced/ui/badge";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getAdMobAuthUrl } from "@/lib/google/admob";
import { SyncButton } from "@/components/sync-button";

export const dynamic = "force-dynamic";

interface ApiConnection {
  provider: string;
  status: string;
  last_sync: string | null;
  error_message: string | null;
}

export default async function SettingsPage() {
  const supabase = getSupabaseAdmin();

  const { data } = await supabase
    .from("api_connections")
    .select("provider, status, last_sync, error_message");

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
        return "Connected";
      case "error":
        return "Error";
      default:
        return "Not connected";
    }
  };

  return (
    <div>
      <Header title="Settings" />
      <div className="space-y-6 p-6">
        {/* Google Play Connection */}
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold font-heading">
                Google Play API
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                Service account authentication. Provides reviews and app info.
              </p>
              {playConnection?.error_message && (
                <p className="mt-1 text-xs text-red-400">
                  {playConnection.error_message}
                </p>
              )}
              {playConnection?.last_sync && (
                <p className="mt-2 text-xs text-zinc-500">
                  Last sync:{" "}
                  {new Date(playConnection.last_sync).toLocaleString("pt-BR")}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={statusVariant(playConnection?.status)}>
                {statusLabel(playConnection?.status)}
              </Badge>
              <SyncButton provider="play-store" />
            </div>
          </div>
        </Card>

        {/* AdMob Connection */}
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold font-heading">AdMob API</h2>
              <p className="mt-1 text-sm text-zinc-400">
                OAuth 2.0 authentication. Provides revenue, impressions, eCPM.
              </p>
              {admobConnection?.error_message && (
                <p className="mt-1 text-xs text-red-400">
                  {admobConnection.error_message}
                </p>
              )}
              {admobConnection?.last_sync && (
                <p className="mt-2 text-xs text-zinc-500">
                  Last sync:{" "}
                  {new Date(admobConnection.last_sync).toLocaleString("pt-BR")}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={statusVariant(admobConnection?.status)}>
                {statusLabel(admobConnection?.status)}
              </Badge>
              {admobConnection?.status === "connected" && (
                <SyncButton provider="admob" />
              )}
              {admobAuthUrl && (
                <a
                  href={admobAuthUrl}
                  className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-600"
                >
                  {admobConnection?.status === "connected"
                    ? "Reconnect"
                    : "Connect"}
                </a>
              )}
              {!admobAuthUrl && (
                <span className="text-xs text-zinc-500">
                  Configure ADMOB_CLIENT_ID in .env
                </span>
              )}
            </div>
          </div>
        </Card>

        {/* Manual Data Info */}
        <Card>
          <h2 className="text-lg font-semibold font-heading">Manual Data</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Downloads, ratings, and other metrics that APIs cannot provide can be
            updated via the API at{" "}
            <code className="rounded bg-zinc-800 px-1 py-0.5 text-xs">
              PATCH /api/apps/:id
            </code>
          </p>
        </Card>
      </div>
    </div>
  );
}
