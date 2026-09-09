"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CAMPAIGN_PERIODS } from "@/lib/campaign-period";

export function CampaignPeriodSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const current = search.get("period") || "month";
  function select(period: string, from?: string, to?: string) {
    const params = new URLSearchParams(search.toString());
    params.set("period", period);
    params.delete("from"); params.delete("to");
    if (from && to) { params.set("from", from); params.set("to", to); }
    router.replace(`${pathname}?${params}`);
  }
  return <div className="space-y-2">
    <div aria-label="Período das campanhas" className="flex flex-wrap gap-1">
      {Object.entries(CAMPAIGN_PERIODS).map(([key, label]) => <button key={key} type="button" aria-pressed={current === key} onClick={() => select(key)} className={`rounded-lg px-3 py-2 text-sm ${current === key ? "bg-violet-500/10 text-violet-400" : "text-zinc-400 hover:text-white"}`}>{label}</button>)}
    </div>
    {current === "custom" && <form key={search.toString()} className="flex flex-wrap items-end gap-2" onSubmit={event => {
      event.preventDefault(); const form = new FormData(event.currentTarget);
      select("custom", String(form.get("from")), String(form.get("to")));
    }}>
      <label className="text-xs text-zinc-400">De<input required type="date" name="from" defaultValue={search.get("from") || ""} className="block rounded border border-white/10 bg-zinc-900 p-2 text-white" /></label>
      <label className="text-xs text-zinc-400">Até<input required type="date" name="to" defaultValue={search.get("to") || ""} className="block rounded border border-white/10 bg-zinc-900 p-2 text-white" /></label>
      <button className="rounded bg-violet-600 px-3 py-2 text-sm text-white">Aplicar</button>
    </form>}
  </div>;
}
