"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutos

/**
 * A coleta pesada roda no cron (hourly/daily). Aqui só:
 *  1. um sync leve (7d) no primeiro load — fallback caso o cron externo caia
 *  2. router.refresh() periódico e ao navegar, pra puxar dados novos do cron
 */
export function AutoSync() {
  const router = useRouter();
  const pathname = usePathname();
  const initialSyncDone = useRef(false);

  const initialSync = useCallback(async () => {
    try {
      const res = await fetch("/api/sync/admob", { method: "POST" });
      const result = await res.json().catch(() => null);
      if (result && !result.skipped) {
        router.refresh();
      }
    } catch {
      // silencioso — o cron cobre
    }
  }, [router]);

  useEffect(() => {
    if (!initialSyncDone.current) {
      initialSyncDone.current = true;
      initialSync();
    }
  }, [initialSync]);

  // Dados podem ter sido atualizados pelo cron — refresh ao navegar
  useEffect(() => {
    if (initialSyncDone.current) {
      router.refresh();
    }
  }, [pathname, router]);

  // Refresh periódico (sem sync — só re-render dos server components)
  useEffect(() => {
    const id = setInterval(() => router.refresh(), REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [router]);

  return null;
}
