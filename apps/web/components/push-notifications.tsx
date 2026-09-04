"use client";

import { useEffect, useState } from "react";

async function saveSubscription(sub: PushSubscription) {
  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: sub.toJSON() }),
  });
}

async function registerAndSubscribe() {
  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      await saveSubscription(existing);
      return;
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    });

    await saveSubscription(subscription);
  } catch (err) {
    console.error("[Push] Registration failed:", err);
  }
}

export function PushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported" | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      await Promise.resolve();
      if (cancelled) return;

      if (!("Notification" in window) || !("serviceWorker" in navigator)) {
        setPermission("unsupported");
        return;
      }

      setPermission(Notification.permission);
      if (Notification.permission === "granted") {
        await registerAndSubscribe();
      }
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, []);

  async function requestPermission() {
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") {
      await registerAndSubscribe();
    }
  }

  if (permission === null || permission === "unsupported" || permission === "granted") {
    return null;
  }

  if (permission === "denied") {
    return null;
  }

  return (
    <button
      type="button"
      onClick={requestPermission}
      aria-label="Ativar notificações"
      title="Ativar notificações"
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-50 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-violet-500 text-sm font-medium text-white shadow-lg shadow-black/30 transition-colors hover:bg-violet-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 sm:h-auto sm:w-auto sm:gap-2 sm:rounded-lg sm:px-4 sm:py-2"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      <span className="hidden sm:inline">Ativar Notificações</span>
    </button>
  );
}
