"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Pause, Play } from "lucide-react";

export function CampaignToggle({ id, name, status }: { id: string; name: string; status?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmed, setConfirmed] = useState<string>();
  const current = confirmed || status;
  const available = current === "ACTIVE" || current === "PAUSED";
  async function change() {
    const target = current === "ACTIVE" ? "PAUSED" : "ACTIVE";
    if (!window.confirm(`${target === "PAUSED" ? "Pausar" : "Reativar"} a campanha “${name}” na Meta?${target === "ACTIVE" ? " A veiculação poderá voltar a consumir o orçamento configurado." : ""}`)) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/campaigns/${encodeURIComponent(id)}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: target, expectedStatus: current }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível confirmar a alteração.");
      setConfirmed(result.campaign.status);
      setMessage(result.warning || (target === "PAUSED" ? "Pausa confirmada na Meta." : "Reativação confirmada na Meta. A entrega depende dos conjuntos e anúncios."));
    } catch (error) { setMessage(error instanceof Error ? error.message : "Resultado não confirmado. Atualize antes de tentar novamente."); }
    finally { setBusy(false); router.refresh(); }
  }
  return <div>
    <button type="button" aria-label={current === "ACTIVE" ? `Pausar campanha ${name}` : `Reativar campanha ${name}`} disabled={busy || !available} onClick={change} className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-transparent px-2.5 text-[11px] font-medium text-zinc-400 transition-colors duration-150 hover:border-white/10 hover:text-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 disabled:cursor-not-allowed disabled:opacity-40">{busy ? <LoaderCircle className="h-3 w-3 animate-spin" strokeWidth={1.75} aria-hidden="true" /> : current === "ACTIVE" ? <Pause className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" /> : <Play className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />}{busy ? "Confirmando…" : current === "ACTIVE" ? "Pausar" : current === "PAUSED" ? "Reativar" : "Indisponível"}</button>
    {message && <p role="status" className="mt-2 max-w-sm text-xs text-zinc-300">{message}</p>}
    {message.includes("Reconecte") && <a href="/api/auth/meta" className="mt-2 inline-block text-violet-300 underline">Autorizar gerenciamento na Meta</a>}
  </div>;
}
