"use client";

import { useState } from "react";
import type { PipelineInsight } from "@/lib/types";

const PLATFORM_COLORS: Record<string, string> = {
  moodlr: "bg-purple-500/20 text-purple-400",
  tn: "bg-sky-500/20 text-sky-400",
  trek: "bg-emerald-500/20 text-emerald-400",
};

const PLATFORM_OPTIONS = ["moodlr", "tn", "trek"];

function getPlatformClass(platform: string) {
  return PLATFORM_COLORS[platform.toLowerCase()] ?? "bg-zinc-500/20 text-zinc-400";
}

export function PipelineInsights({ insights: initial }: { insights: PipelineInsight[] }) {
  const [insights, setInsights] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  function togglePlatform(p: string) {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  async function handleCreate() {
    if (!name.trim()) return;
    setLoading(true);
    const res = await fetch("/api/pipeline/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, platforms: selectedPlatforms, notes }),
    });
    const data = await res.json();
    if (data.id) {
      setInsights((prev) => [
        { id: data.id, name: data.name, platforms: data.platforms, notes: data.notes, createdAt: data.created_at },
        ...prev,
      ]);
      setName("");
      setNotes("");
      setSelectedPlatforms([]);
      setShowForm(false);
    }
    setLoading(false);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/pipeline/insights/${id}`, { method: "DELETE" });
    setInsights((prev) => prev.filter((i) => i.id !== id));
  }

  async function handleMoveToPipeline(insight: PipelineInsight) {
    // Create pipeline app from insight, then delete insight
    await fetch("/api/pipeline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: insight.name, package_name: "", icon: "", stage: "code" }),
    });
    await handleDelete(insight.id);
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02]">
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
          </svg>
          <h3 className="text-sm font-semibold text-zinc-300">
            Insights
            <span className="ml-2 text-xs font-normal text-zinc-500">{insights.length} ideias</span>
          </h3>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-md bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400 transition-colors hover:bg-amber-500/20"
        >
          {showForm ? "Cancelar" : "+ Ideia"}
        </button>
      </div>

      {showForm && (
        <div className="border-b border-white/5 px-4 py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="text"
              placeholder="Nome do app"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-amber-500"
              autoFocus
            />
            <div className="flex items-center gap-1.5">
              {PLATFORM_OPTIONS.map((p) => (
                <button
                  key={p}
                  onClick={() => togglePlatform(p)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    selectedPlatforms.includes(p)
                      ? getPlatformClass(p)
                      : "bg-white/5 text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <input
            type="text"
            placeholder="Notas (opcional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-amber-500"
          />
          <button
            onClick={handleCreate}
            disabled={loading || !name.trim()}
            className="mt-2 rounded-lg bg-amber-500/20 px-4 py-1.5 text-xs font-medium text-amber-400 transition-colors hover:bg-amber-500/30 disabled:opacity-50"
          >
            {loading ? "Salvando..." : "Salvar"}
          </button>
        </div>
      )}

      {insights.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 py-3">
          {insights.map((insight) => (
            <div
              key={insight.id}
              className="group flex items-center gap-2 rounded-lg border border-white/5 bg-white/5 px-3 py-2 transition-colors hover:bg-white/[0.08]"
            >
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-white">{insight.name}</span>
                  {insight.platforms.map((p) => (
                    <span key={p} className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${getPlatformClass(p)}`}>
                      {p}
                    </span>
                  ))}
                </div>
                {insight.notes && (
                  <p className="text-xs text-zinc-500">{insight.notes}</p>
                )}
              </div>
              <div className="ml-2 flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={() => handleMoveToPipeline(insight)}
                  className="rounded p-0.5 text-zinc-500 hover:text-emerald-400 transition-colors"
                  title="Mover para Pipeline"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(insight.id)}
                  className="rounded p-0.5 text-zinc-500 hover:text-red-400 transition-colors"
                  title="Remover"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {insights.length === 0 && !showForm && (
        <p className="px-4 py-4 text-center text-xs text-zinc-600">Nenhuma ideia ainda</p>
      )}
    </div>
  );
}
