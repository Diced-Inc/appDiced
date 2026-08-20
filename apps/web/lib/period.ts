import { toBrazilDateStr } from "@/lib/date";

/**
 * Períodos por mês-calendário (não janela móvel) — o ciclo do AdMob é
 * mensal: fecha o mês N e paga em N+1, então "30 dias corridos" não
 * casa com nada que o usuário recebe.
 */
export const PERIOD_KEYS = ["month", "last-month", "3m", "6m", "all"] as const;
export type PeriodKey = (typeof PERIOD_KEYS)[number];

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  month: "Este mês",
  "last-month": "Mês passado",
  "3m": "3 meses",
  "6m": "6 meses",
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

function iso(d: Date): string {
  return d.toISOString().split("T")[0]!;
}

function parse(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00`);
}

/** "2026-08-15" → "2026-08-01" */
export function monthOf(dateStr: string): string {
  return `${dateStr.substring(0, 7)}-01`;
}

/** Primeiro dia do mês, deslocado em `offset` meses. */
function firstOfMonth(today: string, offset = 0): string {
  const d = parse(today);
  return iso(new Date(d.getFullYear(), d.getMonth() + offset, 1, 12));
}

/** Último dia do mês, deslocado em `offset` meses. */
function lastOfMonth(today: string, offset = 0): string {
  const d = parse(today);
  return iso(new Date(d.getFullYear(), d.getMonth() + offset + 1, 0, 12));
}

/** Resolve uma chave de período num intervalo de datas alinhado ao calendário. */
export function resolvePeriod(key: PeriodKey, today = toBrazilDateStr()): DateRange {
  switch (key) {
    case "month":
      return { from: firstOfMonth(today), to: today };
    case "last-month":
      return { from: firstOfMonth(today, -1), to: lastOfMonth(today, -1) };
    case "3m":
      // mês corrente + 2 anteriores completos
      return { from: firstOfMonth(today, -2), to: today };
    case "6m":
      return { from: firstOfMonth(today, -5), to: today };
    case "all":
      return { from: null, to: today };
  }
}

/**
 * Janela de comparação equivalente no calendário:
 *  - Este mês (parcial) → mês passado até o MESMO dia (comparação justa)
 *  - Mês passado → mês retrasado inteiro
 *  - 3m/6m → bloco de meses imediatamente anterior
 *  - Tudo → sem comparação
 */
export function comparisonRange(key: PeriodKey, today = toBrazilDateStr()): DateRange | null {
  const d = parse(today);
  switch (key) {
    case "month": {
      const dayOfMonth = d.getDate();
      const prevLast = new Date(d.getFullYear(), d.getMonth(), 0, 12); // último dia do mês passado
      const cappedDay = Math.min(dayOfMonth, prevLast.getDate());
      return {
        from: firstOfMonth(today, -1),
        to: iso(new Date(prevLast.getFullYear(), prevLast.getMonth(), cappedDay, 12)),
      };
    }
    case "last-month":
      return { from: firstOfMonth(today, -2), to: lastOfMonth(today, -2) };
    case "3m":
      return { from: firstOfMonth(today, -5), to: lastOfMonth(today, -3) };
    case "6m":
      return { from: firstOfMonth(today, -11), to: lastOfMonth(today, -6) };
    case "all":
      return null;
  }
}

/** Quebra [from, to] em intervalos mensais (para backfill em lotes). */
export function monthChunks(from: string, to: string): { from: string; to: string }[] {
  const chunks: { from: string; to: string }[] = [];
  let cursor = from;
  while (cursor <= to) {
    const d = parse(cursor);
    const chunkEnd = iso(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12));
    chunks.push({ from: cursor, to: chunkEnd < to ? chunkEnd : to });
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1, 12);
    cursor = iso(next);
  }
  return chunks;
}
