import { NextResponse } from "next/server";
import { fetchPlayStoreInfo } from "@/lib/google/play-icon";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function POST() {
  const supabase = getSupabaseAdmin();

  const { data: logData } = await supabase
    .from("sync_log")
    .insert({ provider: "google_play", status: "running" } as Record<string, unknown>)
    .select("id")
    .single();

  const logEntry = logData as { id: string } | null;

  try {
    const { data } = await supabase
      .from("apps")
      .select("id, package_name, icon");

    const apps = data as { id: string; package_name: string; icon: string }[] | null;

    for (const app of apps ?? []) {
      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      // Fetch icon, rating, and downloads from Play Store page
      const info = await fetchPlayStoreInfo(app.package_name);

      if (info.icon && (!app.icon || !app.icon.startsWith("http"))) {
        updates.icon = info.icon;
      }
      if (info.rating !== null) {
        updates.rating = info.rating;
      }
      if (info.downloads !== null) {
        updates.downloads = info.downloads;
      }

      if (Object.keys(updates).length > 1) {
        await supabase.from("apps").update(updates).eq("id", app.id);
      }
    }

    if (logEntry) {
      await supabase
        .from("sync_log")
        .update({ status: "success", ended_at: new Date().toISOString() })
        .eq("id", logEntry.id);
    }

    await supabase
      .from("api_connections")
      .update({
        last_sync: new Date().toISOString(),
        status: "connected",
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("provider", "google_play");

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (logEntry) {
      await supabase
        .from("sync_log")
        .update({
          status: "error",
          message,
          ended_at: new Date().toISOString(),
        })
        .eq("id", logEntry.id);
    }

    await supabase
      .from("api_connections")
      .update({
        status: "error",
        error_message: message,
        updated_at: new Date().toISOString(),
      })
      .eq("provider", "google_play");

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
