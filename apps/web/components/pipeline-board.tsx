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

function getDaysInStage(stageEnteredAt: string): number {
  const tz = "America/Sao_Paulo";
  const enteredStr = new Date(stageEnteredAt).toLocaleDateString("en-CA", { timeZone: tz });
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: tz });
  const entered = new Date(enteredStr + "T00:00:00");
  const today = new Date(todayStr + "T00:00:00");
  const diff = Math.floor((today.getTime() - entered.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff + 1);
}

export function PipelineBoard({ apps: initial }: { apps: PipelineApp[] }) {
  const router = useRouter();
  const [apps, setApps] = useState(initial);
  const [loading, setLoading] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", package_name: "", icon: "" });
  const [editingDays, setEditingDays] = useState<string | null>(null);
  const [daysInput, setDaysInput] = useState("");

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

  async function handleSetDays(id: string) {
    const days = parseInt(daysInput);
    if (isNaN(days) || days < 1 || days > 14) return;
    setLoading(id);
    // Calculate stage_entered_at = now - (days - 1) days
    const entered = new Date();
    entered.setDate(entered.getDate() - (days - 1));
    await fetch(`/api/pipeline/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage_entered_at: entered.toISOString() }),
    });
    setApps((prev) =>
      prev.map((a) => (a.id === id ? { ...a, stageEnteredAt: entered.toISOString() } : a))
    );
    setEditingDays(null);
    setDaysInput("");
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
          const stageApps = apps
            .filter((a) => a.stage === stage.key)
            .sort((a, b) => new Date(a.stageEnteredAt).getTime() - new Date(b.stageEnteredAt).getTime());
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
                  const days = getDaysInStage(app.stageEnteredAt);
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
                        <span className="shrink-0 rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
                          {days}d
                        </span>
                      </div>

                      {/* Countdown for closed_test */}
                      {isClosedTest && (
                        <div className="mt-2 rounded-lg bg-orange-500/10 px-2.5 py-1.5">
                          {editingDays === app.id ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-orange-400">Dia</span>
                              <div className="flex items-center rounded-md border border-orange-500/30 bg-black/20">
                                <button
                                  type="button"
                                  onClick={() => setDaysInput(String(Math.max(1, (parseInt(daysInput) || 1) - 1)))}
                                  className="px-1.5 py-0.5 text-xs text-orange-400 hover:text-orange-300 transition-colors"
                                >
                                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" /></svg>
                                </button>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={daysInput}
                                  onChange={(e) => { const v = e.target.value.replace(/\D/g, ""); if (v === "" || (Number(v) >= 1 && Number(v) <= 14)) setDaysInput(v); }}
                                  onKeyDown={(e) => e.key === "Enter" && handleSetDays(app.id)}
                                  className="w-6 bg-transparent text-center text-xs font-medium text-orange-300 outline-none"
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  onClick={() => setDaysInput(String(Math.min(14, (parseInt(daysInput) || 0) + 1)))}
                                  className="px-1.5 py-0.5 text-xs text-orange-400 hover:text-orange-300 transition-colors"
                                >
                                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                                </button>
                              </div>
                              <span className="text-xs text-orange-400/70">/14</span>
                              <button
                                onClick={() => handleSetDays(app.id)}
                                className="ml-auto rounded-md bg-orange-500/20 px-2 py-0.5 text-xs font-medium text-orange-300 hover:bg-orange-500/30 transition-colors"
                              >
                                OK
                              </button>
                              <button
                                onClick={() => { setEditingDays(null); setDaysInput(""); }}
                                className="rounded-md p-0.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                            </div>
                          ) : (
                            <div
                              className="flex cursor-pointer items-center justify-between text-xs"
                              onClick={() => { setEditingDays(app.id); setDaysInput(String(Math.min(days, 14))); }}
                              title="Clique para editar os dias"
                            >
                              <span className="font-medium text-orange-400">
                                Dia {Math.min(days, 14)}/14
                              </span>
                              <span className="text-orange-300">
                                {days < 14
                                  ? `faltam ${14 - days}d`
                                  : "Completo!"}
                              </span>
                            </div>
                          )}
                          <div className="mt-1.5 h-1.5 rounded-full bg-orange-500/20">
                            <div
                              className="h-1.5 rounded-full bg-orange-400 transition-all"
                              style={{ width: `${Math.min(100, (Math.min(days, 14) / 14) * 100)}%` }}
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
