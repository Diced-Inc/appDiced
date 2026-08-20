import { toBrazilDateStr } from "@/lib/date";

export const PERIOD_KEYS = ["7d", "30d", "60d", "90d", "all"] as const;
export type PeriodKey = (typeof PERIOD_KEYS)[number];

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  "7d": "7 dias",
  "30d": "30 dias",
  "60d": "60 dias",
  "90d": "90 dias",
  all: "Tudo",
};

export interface DateRange {
  /** YYYY-MM-DD (inclusive) no fuso de São Paulo; null = sem limite inferior */
  from: string | null;
  /** YYYY-MM-DD (inclusive) */
  to: string;
}

export function isPeriodKey(value: unknown): value is PeriodKey {
  return typeof value === "string" && (PERIOD_KEYS as readonly string[]).includes(value);
}

function shiftDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0]!;
}

/** Resolve uma chave de período num intervalo de datas (fuso BR). */
export function resolvePeriod(key: PeriodKey, today = toBrazilDateStr()): DateRange {
  if (key === "all") return { from: null, to: today };
  const days = parseInt(key, 10);
  return { from: shiftDays(today, -(days - 1)), to: today };
}

/** Janela imediatamente anterior, de mesmo tamanho. null se o período é "tudo". */
export function previousRange(range: DateRange): DateRange | null {
  if (!range.from) return null;
  const from = new Date(`${range.from}T12:00:00`);
  const to = new Date(`${range.to}T12:00:00`);
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
  return { from: shiftDays(range.from, -days), to: shiftDays(range.from, -1) };
}

/** "2026-08-15" → "2026-08-01" */
export function monthOf(dateStr: string): string {
  return `${dateStr.substring(0, 7)}-01`;
}

/** Quebra [from, to] em intervalos mensais (para backfill em lotes). */
export function monthChunks(from: string, to: string): { from: string; to: string }[] {
  const chunks: { from: string; to: string }[] = [];
  let cursor = from;
  while (cursor <= to) {
    const d = new Date(`${cursor}T12:00:00`);
    const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const chunkEnd = endOfMonth.toISOString().split("T")[0]!;
    chunks.push({ from: cursor, to: chunkEnd < to ? chunkEnd : to });
    cursor = shiftDays(chunkEnd, 1);
  }
  return chunks;
}
