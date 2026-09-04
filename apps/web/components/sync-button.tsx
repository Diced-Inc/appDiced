"use client";

import { useState } from "react";

interface SyncButtonProps {
  provider: string;
}

export function SyncButton({ provider }: SyncButtonProps) {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<"success" | "error" | null>(null);

  async function handleSync() {
    setSyncing(true);
    setResult(null);
    try {
      const res = await fetch(`/api/sync/${provider}`, { method: "POST" });
      if (!res.ok) throw new Error("Sync failed");
      setResult("success");
      setTimeout(() => window.location.reload(), 1000);
    } catch {
      setResult("error");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleSync}
      disabled={syncing}
      aria-label={syncing ? "Sincronizando dados" : "Sincronizar dados"}
      title={syncing ? "Sincronizando dados" : "Sincronizar dados"}
      className={`inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg px-2.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400 disabled:cursor-wait disabled:opacity-50 sm:px-3 ${
        result === "success"
          ? "bg-emerald-500/10 text-emerald-400"
          : result === "error"
            ? "bg-red-500/10 text-red-400"
            : "bg-violet-500/10 text-violet-400 hover:bg-violet-500/20"
      }`}
    >
      <svg className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356m-1.094 5.065A8.25 8.25 0 1 0 21.75 12M2.985 14.652H7.98v4.992m-3.901-5.065A8.25 8.25 0 0 0 18.75 12" />
      </svg>
      <span className="hidden sm:inline">
        {syncing ? "Sincronizando..." : result === "success" ? "Pronto!" : result === "error" ? "Falhou" : "Sincronizar"}
      </span>
    </button>
  );
}
