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
    <div className="flex flex-wrap items-center gap-1">
      {PERIOD_KEYS.map((key) => (
        <button
          key={key}
          onClick={() => select(key)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
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
