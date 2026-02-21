"use client";

import { useState } from "react";
import type { AppStatus } from "@/lib/types";

interface EditAppModalProps {
  appId: string;
  currentDownloads: number;
  currentRating: number;
  currentStatus: AppStatus;
}

const statusOptions: { value: AppStatus; label: string }[] = [
  { value: "published", label: "Publicado" },
  { value: "in_review", label: "Em Revisão" },
  { value: "suspended", label: "Suspenso" },
  { value: "draft", label: "Rascunho" },
  { value: "removed", label: "Removido" },
];

export function EditAppModal({
  appId,
  currentDownloads,
  currentRating,
  currentStatus,
}: EditAppModalProps) {
  const [open, setOpen] = useState(false);
  const [downloads, setDownloads] = useState(String(currentDownloads));
  const [rating, setRating] = useState(String(currentRating));
  const [status, setStatus] = useState<AppStatus>(currentStatus);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/apps/${appId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          downloads: Number(downloads) || 0,
          rating: Math.min(5, Math.max(0, Number(rating) || 0)),
          status,
        }),
      });
      if (res.ok) {
        setOpen(false);
        window.location.reload();
      }
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
      >
        Editar
      </button>
    );
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60"
        onClick={() => setOpen(false)}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#1B1B26] p-6 shadow-xl">
          <h3 className="mb-4 text-lg font-bold text-white">Editar App</h3>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-zinc-400">
                Downloads
              </label>
              <input
                type="number"
                min="0"
                value={downloads}
                onChange={(e) => setDownloads(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-zinc-400">
                Avaliação (0–5)
              </label>
              <input
                type="number"
                min="0"
                max="5"
                step="0.1"
                value={rating}
                onChange={(e) => setRating(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-zinc-400">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as AppStatus)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={() => setOpen(false)}
              className="flex-1 rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-400 transition-colors hover:bg-white/5"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
