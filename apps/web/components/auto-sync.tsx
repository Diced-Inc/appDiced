"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";

const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function AutoSync() {
  const router = useRouter();
  const pathname = usePathname();
  const syncing = useRef(false);
  const initialSyncDone = useRef(false);

  const sync = useCallback(async () => {
    if (syncing.current) return;
    syncing.current = true;

    try {
      const results = await Promise.allSettled([
        fetch("/api/sync/admob", { method: "POST" }).then((r) => r.json()),
        fetch("/api/sync/play-store", { method: "POST" }),
      ]);

      // Only refresh if admob sync actually ran (not skipped)
      const admobResult = results[0].status === "fulfilled" ? results[0].value : null;
      if (admobResult && !admobResult.skipped) {
        router.refresh();
      }
    } finally {
      syncing.current = false;
    }
  }, [router]);

  // Sync on page load (once)
  useEffect(() => {
    if (!initialSyncDone.current) {
      initialSyncDone.current = true;
      sync();
    }
  }, [sync]);

  // Refresh data when navigating between pages (data may have been updated by cron)
  useEffect(() => {
    if (initialSyncDone.current) {
      router.refresh();
    }
  }, [pathname, router]);

  // Periodic sync
  useEffect(() => {
    const id = setInterval(sync, SYNC_INTERVAL);
    return () => clearInterval(id);
  }, [sync]);

  return null;
}
