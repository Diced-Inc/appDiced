"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { CAMPAIGN_PERIODS } from "@/lib/campaign-period";

export function CampaignPeriodSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [pending, setPending] = useState<string | null>(null);
  const current = search.get("period") || "month";

  function select(period: string, from?: string, to?: string) {
    const params = new URLSearchParams(search.toString());
    params.set("period", period);
    params.delete("from"); params.delete("to");
    if (from && to) { params.set("from", from); params.set("to", to); }
    // A troca refaz a página no servidor; sem transition o clique não dá sinal nenhum.
    setPending(period);
    startTransition(() => router.replace(`${pathname}?${params}`));
  }

  return <div className="space-y-2">
    <div aria-label="Período das campanhas" aria-busy={isPending} className="flex flex-wrap gap-1">
      {Object.entries(CAMPAIGN_PERIODS).map(([key, label]) => {
        const loading = isPending && pending === key;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={current === key}
            onClick={() => select(key)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-colors ${current === key ? "bg-violet-500/10 text-violet-400" : "text-zinc-400 hover:text-white"} ${isPending && !loading ? "opacity-50" : ""}`}
          >
            {loading && <LoaderCircle className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} aria-hidden="true" />}
            {label}
          </button>
        );
      })}
    </div>
    {current === "custom" && <form key={search.toString()} className="flex flex-wrap items-end gap-2" onSubmit={event => {
      event.preventDefault(); const form = new FormData(event.currentTarget);
      select("custom", String(form.get("from")), String(form.get("to")));
    }}>
      <label className="text-xs text-zinc-400">De<input required type="date" name="from" defaultValue={search.get("from") || ""} className="block rounded-lg border border-white/10 bg-surface p-2 text-white [color-scheme:dark]" /></label>
      <label className="text-xs text-zinc-400">Até<input required type="date" name="to" defaultValue={search.get("to") || ""} className="block rounded-lg border border-white/10 bg-surface p-2 text-white [color-scheme:dark]" /></label>
      <button disabled={isPending} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-sm text-white transition-colors hover:bg-violet-500 disabled:opacity-50">
        {isPending && <LoaderCircle className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} aria-hidden="true" />}
        Aplicar
      </button>
    </form>}
  </div>;
}
