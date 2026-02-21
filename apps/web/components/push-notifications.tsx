"use client";

import { useEffect, useState } from "react";

export function PushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);

    if (Notification.permission === "granted") {
      registerAndSubscribe();
    }
  }, []);

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

  async function saveSubscription(sub: PushSubscription) {
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });
  }

  async function requestPermission() {
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") {
      await registerAndSubscribe();
    }
  }

  if (permission === "unsupported" || permission === "granted") {
    return null;
  }

  if (permission === "denied") {
    return null;
  }

  return (
    <button
      onClick={requestPermission}
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-white shadow-lg transition-colors hover:bg-violet-600"
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
      >
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      Ativar Notificações
    </button>
  );
}
