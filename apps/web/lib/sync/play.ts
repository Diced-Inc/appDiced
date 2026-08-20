import { getSupabaseAdmin } from "@/lib/supabase/server";
import { fetchPlayStoreInfo } from "@/lib/google/play-icon";

export interface StatusChange {
  packageName: string;
  name: string;
  from: string;
  to: string;
}

export interface SyncPlayResult {
  success: boolean;
  updated: number;
  statusChanges: StatusChange[];
  error?: string;
}

/**
 * Sync da Play Store (scrape): ícone, rating, downloads e detecção de
 * app removido/restaurado. Só transiciona published ↔ removed — status
 * manuais (draft, in_review, suspended) não são sobrescritos.
 */
export async function syncPlayStore(userId: string): Promise<SyncPlayResult> {
  const supabase = getSupabaseAdmin();

  const { data: logData } = await supabase
    .from("sync_log")
    .insert({ provider: "google_play", status: "running", user_id: userId } as Record<string, unknown>)
    .select("id")
    .single();
  const logEntry = logData as { id: string } | null;

  const statusChanges: StatusChange[] = [];
  let updated = 0;

  try {
    const { data } = await supabase
      .from("apps")
      .select("id, name, package_name, icon, status")
      .eq("user_id", userId);

    const apps =
      (data as { id: string; name: string; package_name: string; icon: string; status: string }[] | null) ?? [];

    for (const app of apps) {
      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      const info = await fetchPlayStoreInfo(app.package_name);

      if (info.icon && (!app.icon || !app.icon.startsWith("http"))) {
        updates.icon = info.icon;
      }
      if (info.rating !== null) updates.rating = info.rating;
      if (info.downloads !== null) updates.downloads = info.downloads;

      // Transições automáticas: sumiu da Play → removed; voltou → published
      if (!info.found && app.status === "published") {
        updates.status = "removed";
        statusChanges.push({ packageName: app.package_name, name: app.name, from: app.status, to: "removed" });
      } else if (info.found && app.status === "removed") {
        updates.status = "published";
        statusChanges.push({ packageName: app.package_name, name: app.name, from: app.status, to: "published" });
      }

      if (Object.keys(updates).length > 1) {
        await supabase.from("apps").update(updates).eq("id", app.id);
        updated++;
      }
    }

    if (logEntry) {
      await supabase
        .from("sync_log")
        .update({ status: "success", ended_at: new Date().toISOString() })
        .eq("id", logEntry.id);
    }

    await supabase.from("api_connections").upsert(
      {
        provider: "google_play",
        user_id: userId,
        last_sync: new Date().toISOString(),
        status: "connected",
        error_message: null,
        updated_at: new Date().toISOString(),
      } as Record<string, unknown>,
      { onConflict: "provider,user_id" }
    );

    return { success: true, updated, statusChanges };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (logEntry) {
      await supabase
        .from("sync_log")
        .update({ status: "error", message, ended_at: new Date().toISOString() })
        .eq("id", logEntry.id);
    }

    await supabase.from("api_connections").upsert(
      {
        provider: "google_play",
        user_id: userId,
        status: "error",
        error_message: message,
        updated_at: new Date().toISOString(),
      } as Record<string, unknown>,
      { onConflict: "provider,user_id" }
    );

    return { success: false, updated, statusChanges, error: message };
  }
}
