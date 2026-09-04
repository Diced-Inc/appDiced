"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PERIOD_KEYS, PERIOD_LABELS, isPeriodKey, type PeriodKey } from "@/lib/period";

/** Seletor global de período — persiste em ?period= na URL. */
export function PeriodSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const raw = searchParams.get("period");
  const current: PeriodKey = isPeriodKey(raw) ? raw : "month";

  function select(key: PeriodKey) {
    const params = new URLSearchParams(searchParams.toString());
    if (key === "month") params.delete("period");
    else params.set("period", key);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div aria-label="Selecionar período" className="flex min-w-0 flex-nowrap items-center gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {PERIOD_KEYS.map((key) => (
        <button
          type="button"
          key={key}
          onClick={() => select(key)}
          className={`min-h-9 shrink-0 cursor-pointer whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400 ${
            current === key
              ? "bg-violet-500/10 text-violet-400"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          {PERIOD_LABELS[key]}
        </button>
      ))}
    </div>
  );
}
