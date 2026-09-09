"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { PERIOD_KEYS, PERIOD_LABELS, isPeriodKey, type PeriodKey } from "@/lib/period";

/** Seletor global de período — persiste em ?period= na URL. */
export function PeriodSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [pending, setPending] = useState<PeriodKey | null>(null);

  const raw = searchParams.get("period");
  const current: PeriodKey = isPeriodKey(raw) ? raw : "month";

  function select(key: PeriodKey) {
    const params = new URLSearchParams(searchParams.toString());
    if (key === "month") params.delete("period");
    else params.set("period", key);
    const qs = params.toString();
    // A página é force-dynamic; sem transition o clique fica sem resposta visível.
    setPending(key);
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname));
  }

  return (
    <div aria-label="Selecionar período" aria-busy={isPending} className="flex min-w-0 flex-nowrap items-center gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {PERIOD_KEYS.map((key) => {
        const loading = isPending && pending === key;
        return (
          <button
            type="button"
            key={key}
            aria-pressed={current === key}
            onClick={() => select(key)}
            className={`inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400 ${
              current === key
                ? "bg-violet-500/10 text-violet-400"
                : "text-zinc-400 hover:text-white"
            } ${isPending && !loading ? "opacity-50" : ""}`}
          >
            {loading && <LoaderCircle className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} aria-hidden="true" />}
            {PERIOD_LABELS[key]}
          </button>
        );
      })}
    </div>
  );
}
