"use client";

import { useEffect, useState } from "react";

type Status = "loading" | "unsupported" | "denied" | "default" | "granted";

export function NotificationSettings() {
  const [status, setStatus] = useState<Status>("loading");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setStatus("unsupported");
      return;
    }
    setStatus(Notification.permission);
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

  async function handleEnable() {
    const result = await Notification.requestPermission();
    setStatus(result);
    if (result === "granted") {
      await registerAndSubscribe();
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      if (res.ok) {
        setTestResult("success");
      } else {
        const data = await res.json();
        setTestResult(data.error || "Erro ao enviar");
      }
    } catch {
      setTestResult("Erro de conexão");
    } finally {
      setTesting(false);
    }
  }

  if (status === "loading") return null;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-base font-semibold font-heading md:text-lg">
          Notificações Push
        </h2>
        <p className="mt-1 text-xs text-zinc-400 md:text-sm">
          {status === "unsupported" && "Seu navegador não suporta notificações push."}
          {status === "denied" && "Notificações bloqueadas. Altere nas configurações do navegador."}
          {status === "default" && "Ative para receber alertas de receita e atualizações."}
          {status === "granted" && "Notificações ativadas. Envie um teste para verificar."}
        </p>
        {testResult && (
          <p className={`mt-1 text-xs ${testResult === "success" ? "text-emerald-400" : "text-red-400"}`}>
            {testResult === "success" ? "Notificação enviada com sucesso!" : testResult}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            status === "granted"
              ? "bg-emerald-500/10 text-emerald-400"
              : status === "denied"
                ? "bg-red-500/10 text-red-400"
                : "bg-zinc-500/10 text-zinc-400"
          }`}
        >
          {status === "granted" ? "Ativado" : status === "denied" ? "Bloqueado" : status === "unsupported" ? "Indisponível" : "Desativado"}
        </span>

        {status === "default" && (
          <button
            onClick={handleEnable}
            className="rounded-lg bg-violet-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-violet-600"
          >
            Ativar
          </button>
        )}

        {status === "granted" && (
          <button
            onClick={handleTest}
            disabled={testing}
            className="rounded-lg bg-zinc-700 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-600 disabled:opacity-50"
          >
            {testing ? "Enviando..." : "Testar"}
          </button>
        )}
      </div>
    </div>
  );
}
