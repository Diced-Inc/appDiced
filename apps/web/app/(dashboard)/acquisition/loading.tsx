import { Header } from "@/components/header";
import { Card } from "@diced/ui/card";

/** Trocar período remonta a página inteira no servidor — sem isto a tela fica congelada nos dados antigos. */
export default function LoadingAcquisition() {
  return (
    <div>
      <Header title="Campanhas" />
      <div className="animate-pulse space-y-4 p-4 md:space-y-6 md:p-6" role="status" aria-label="Carregando campanhas">
        <div className="flex flex-wrap gap-1">
          {[64, 56, 88, 72, 96].map((w, i) => (
            <div key={i} className="h-9 rounded-lg bg-white/[0.04]" style={{ width: w }} />
          ))}
        </div>

        <div className="grid grid-cols-2 items-stretch gap-2 sm:gap-3 md:gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[124px] rounded-xl border border-white/5 bg-surface-2 md:rounded-2xl" />
          ))}
        </div>

        <Card>
          <div className="h-4 w-52 rounded bg-white/[0.06]" />
          <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[92px] rounded-xl border border-white/5 bg-white/[0.02]" />
            ))}
          </div>
        </Card>

        <Card>
          <div className="h-4 w-44 rounded bg-white/[0.06]" />
          <div className="mt-4 h-[240px] rounded-xl bg-white/[0.02] sm:h-[260px] md:h-[340px]" />
        </Card>

        <Card>
          <div className="h-4 w-48 rounded bg-white/[0.06]" />
          <div className="mt-4 space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 rounded-xl border border-white/5 bg-white/[0.02]" />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
