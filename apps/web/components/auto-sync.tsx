"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function AutoSync() {
  const router = useRouter();
  const syncing = useRef(false);

  useEffect(() => {
    async function sync() {
      if (syncing.current) return;
      syncing.current = true;

      try {
        await Promise.allSettled([
          fetch("/api/sync/admob", { method: "POST" }),
          fetch("/api/sync/play-store", { method: "POST" }),
        ]);
        router.refresh();
      } finally {
        syncing.current = false;
      }
    }

    sync(); // sync on page load
    const id = setInterval(sync, SYNC_INTERVAL);
    return () => clearInterval(id);
  }, [router]);

  return null;
}
