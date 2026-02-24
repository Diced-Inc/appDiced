"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PipelineApp } from "@/lib/types";
import { AppIcon } from "@/components/app-icon";

const STAGES = [
  { key: "code", label: "Código", color: "border-blue-500/40", badge: "bg-blue-500/20 text-blue-400" },
  { key: "play_store", label: "Play Store", color: "border-green-500/40", badge: "bg-green-500/20 text-green-400" },
  { key: "testers", label: "Testers", color: "border-yellow-500/40", badge: "bg-yellow-500/20 text-yellow-400" },
  { key: "closed_test", label: "Teste Fechado", color: "border-orange-500/40", badge: "bg-orange-500/20 text-orange-400" },
  { key: "admob_banners", label: "Banners AdMob", color: "border-pink-500/40", badge: "bg-pink-500/20 text-pink-400" },
  { key: "ads_version", label: "Versão com Ads", color: "border-violet-500/40", badge: "bg-violet-500/20 text-violet-400" },
] as const;

function getCountdown(stageEnteredAt: string) {
  const entered = new Date(stageEnteredAt);
  const now = new Date();
  const diffMs = now.getTime() - entered.getTime();
  const daysPassed = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1);
  const daysLeft = Math.max(0, 14 - daysPassed);
  return { daysPassed: Math.min(daysPassed, 14), daysLeft };
}

export function PipelineBoard({ apps: initial }: { apps: PipelineApp[] }) {
  const router = useRouter();
  const [apps, setApps] = useState(initial);
  const [loading, setLoading] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", package_name: "", icon: "" });

  async function handleAdvance(id: string) {
    setLoading(id);
    const res = await fetch(`/api/pipeline/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "advance" }),
    });
    const data = await res.json();
    if (data.completed) {
      setApps((prev) => prev.filter((a) => a.id !== id));
    } else {
      router.refresh();
      setApps((prev) =>
        prev.map((a) =>
          a.id === id ? { ...a, stage: data.stage, stageEnteredAt: new Date().toISOString() } : a
        )
      );
    }
    setLoading(null);
  }

  async function handleDelete(id: string) {
    setLoading(id);
    await fetch(`/api/pipeline/${id}`, { method: "DELETE" });
    setApps((prev) => prev.filter((a) => a.id !== id));
    setLoading(null);
  }

  async function handleCreate() {
    if (!form.name.trim()) return;
    setLoading("create");
    const res = await fetch("/api/pipeline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (data.id) {
      setApps((prev) => [
        ...prev,
        {
          id: data.id,
          name: data.name,
          packageName: data.package_name,
          icon: data.icon,
          stage: "code",
          stageEnteredAt: data.stage_entered_at,
          createdAt: data.created_at,
          completedAt: null,
        },
      ]);
      setForm({ name: "", package_name: "", icon: "" });
      setShowForm(false);
    }
    setLoading(null);
  }

  return (
    <div className="space-y-4">
      {/* Header with New App button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-400">
          {apps.length} {apps.length === 1 ? "app" : "apps"} na esteira
        </p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500"
        >
          {showForm ? "Cancelar" : "+ Novo App"}
        </button>
      </div>

      {/* New App Form */}
      {showForm && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input
              type="text"
              placeholder="Nome do app"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-violet-500"
            />
            <input
              type="text"
              placeholder="com.example.app"
              value={form.package_name}
              onChange={(e) => setForm({ ...form, package_name: e.target.value })}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-violet-500"
            />
            <input
              type="text"
              placeholder="URL do ícone (opcional)"
              value={form.icon}
              onChange={(e) => setForm({ ...form, icon: e.target.value })}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-violet-500"
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={loading === "create" || !form.name.trim()}
            className="mt-3 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
          >
            {loading === "create" ? "Criando..." : "Criar App"}
          </button>
        </div>
      )}

      {/* Kanban Board */}
      <div className="flex gap-3 overflow-x-auto pb-4 md:gap-4">
        {STAGES.map((stage) => {
          const stageApps = apps.filter((a) => a.stage === stage.key);
          return (
            <div
              key={stage.key}
              className={`flex w-56 shrink-0 flex-col rounded-xl border ${stage.color} bg-white/[0.02] md:w-64`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between border-b border-white/5 px-3 py-3">
                <h3 className="text-sm font-semibold text-zinc-300">{stage.label}</h3>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${stage.badge}`}>
                  {stageApps.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex flex-1 flex-col gap-2 p-2">
                {stageApps.length === 0 && (
                  <p className="py-6 text-center text-xs text-zinc-600">Nenhum app</p>
                )}
                {stageApps.map((app) => {
                  const isLast = stage.key === "ads_version";
                  const isClosedTest = stage.key === "closed_test";
                  const countdown = isClosedTest ? getCountdown(app.stageEnteredAt) : null;
                  const isLoading = loading === app.id;

                  return (
                    <div
                      key={app.id}
                      className="group rounded-lg border border-white/5 bg-white/5 p-3 transition-colors hover:bg-white/[0.08]"
                    >
                      <div className="flex items-start gap-2.5">
                        <AppIcon icon={app.icon} name={app.name} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-white">{app.name}</p>
                          {app.packageName && (
                            <p className="truncate text-xs text-zinc-500">{app.packageName}</p>
                          )}
                        </div>
                      </div>

                      {/* Countdown for closed_test */}
                      {countdown && (
                        <div className="mt-2 rounded-lg bg-orange-500/10 px-2.5 py-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-orange-400">
                              Dia {countdown.daysPassed}/14
                            </span>
                            <span className="text-orange-300">
                              {countdown.daysLeft > 0
                                ? `faltam ${countdown.daysLeft}d`
                                : "Completo!"}
                            </span>
                          </div>
                          <div className="mt-1.5 h-1.5 rounded-full bg-orange-500/20">
                            <div
                              className="h-1.5 rounded-full bg-orange-400 transition-all"
                              style={{ width: `${Math.min(100, (countdown.daysPassed / 14) * 100)}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="mt-2.5 flex items-center gap-1.5">
                        <button
                          onClick={() => handleAdvance(app.id)}
                          disabled={isLoading}
                          className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                            isLast
                              ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                              : "bg-violet-500/20 text-violet-400 hover:bg-violet-500/30"
                          }`}
                        >
                          {isLoading ? "..." : isLast ? "Concluir" : "Avançar"}
                        </button>
                        <button
                          onClick={() => handleDelete(app.id)}
                          disabled={isLoading}
                          className="rounded-md px-2 py-1 text-xs text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                          title="Remover"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
