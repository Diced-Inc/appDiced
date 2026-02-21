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
      onClick={handleSync}
      disabled={syncing}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
        result === "success"
          ? "bg-emerald-500/10 text-emerald-400"
          : result === "error"
            ? "bg-red-500/10 text-red-400"
            : "bg-violet-500/10 text-violet-400 hover:bg-violet-500/20"
      }`}
    >
      {syncing ? "Sincronizando..." : result === "success" ? "Pronto!" : result === "error" ? "Falhou" : "Sincronizar"}
    </button>
  );
}
