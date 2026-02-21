import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchPlayStoreInfo } from "@/lib/google/play-icon";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  const { data: logData } = await supabase
    .from("sync_log")
    .insert({ provider: "google_play", status: "running", user_id: userId } as Record<string, unknown>)
    .select("id")
    .single();

  const logEntry = logData as { id: string } | null;

  try {
    const { data } = await supabase
      .from("apps")
      .select("id, package_name, icon")
      .eq("user_id", userId);

    const apps = data as { id: string; package_name: string; icon: string }[] | null;

    for (const app of apps ?? []) {
      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

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

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
