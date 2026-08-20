import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase/server";

function relTime(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/** Badge de saúde da coleta: último sync AdMob ok / erro / parado. */
export async function SyncHealth() {
  const { userId } = await auth();
  if (!userId) return null;

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("api_connections")
    .select("status, last_sync, error_message")
    .eq("provider", "admob")
    .eq("user_id", userId)
    .single();

  const conn = data as { status: string; last_sync: string | null; error_message: string | null } | null;
  if (!conn) return null;

  // Server component renderizado por request (force-dynamic) — Date.now é estável aqui
  // eslint-disable-next-line react-hooks/purity
  const staleMs = conn.last_sync ? Date.now() - new Date(conn.last_sync).getTime() : Infinity;
  const isError = conn.status === "error";
  const isStale = staleMs > 6 * 60 * 60 * 1000;

  const color = isError ? "bg-red-400" : isStale ? "bg-amber-400" : "bg-emerald-400";
  const label = isError
    ? `Falha no sync${conn.last_sync ? ` · último ok há ${relTime(conn.last_sync)}` : ""}`
    : conn.last_sync
      ? `Sync há ${relTime(conn.last_sync)}`
      : "Sem sync ainda";

  return (
    <Link
      href="/settings"
      title={conn.error_message ?? label}
      className="hidden items-center gap-2 rounded-lg border border-white/5 px-2.5 py-1 text-xs text-zinc-400 transition-colors hover:text-white sm:flex"
    >
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </Link>
  );
}
