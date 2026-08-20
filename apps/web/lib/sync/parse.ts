/**
 * Parsers puros do relatório da AdMob API (networkReport:generate).
 * Sem I/O — testável isoladamente.
 */

export interface AdMobReportRow {
  dimensionValues?: {
    DATE?: { value?: string };
    APP?: { value?: string; displayLabel?: string };
    COUNTRY?: { value?: string };
    AD_UNIT?: { value?: string; displayLabel?: string };
  };
  metricValues?: {
    ESTIMATED_EARNINGS?: { microsValue?: string };
    IMPRESSIONS?: { integerValue?: string };
  };
}

export type ReportDimension = "APP" | "COUNTRY" | "AD_UNIT";

export interface ParsedRow {
  /** YYYY-MM-DD */
  date: string;
  /** valor da dimensão (appId, código de país, adUnitId) */
  key: string;
  /** displayLabel quando a API fornece (AD_UNIT, APP) */
  label: string | null;
  revenue: number;
  impressions: number;
}

/** A resposta do AdMob é um array de {header|row|footer}; extrai só as rows. */
export function extractRows(report: unknown): AdMobReportRow[] {
  if (!Array.isArray(report)) return [];
  return report
    .filter((item: { row?: unknown }) => item && typeof item === "object" && "row" in item && item.row)
    .map((item: { row: AdMobReportRow }) => item.row);
}

export function microsToUsd(micros: string | undefined): number {
  if (!micros) return 0;
  const n = Number(micros);
  return Number.isFinite(n) ? n / 1_000_000 : 0;
}

/** "20260815" → "2026-08-15"; null se malformado */
export function formatAdMobDate(raw: string | undefined): string | null {
  if (!raw || !/^\d{8}$/.test(raw)) return null;
  return `${raw.substring(0, 4)}-${raw.substring(4, 6)}-${raw.substring(6, 8)}`;
}

/**
 * Normaliza um relatório (DATE + dimensão) em linhas {date, key, revenue, impressions}.
 * Linhas sem data ou sem valor de dimensão são descartadas.
 */
export function parseReport(report: unknown, dimension: ReportDimension): ParsedRow[] {
  const out: ParsedRow[] = [];
  for (const row of extractRows(report)) {
    const date = formatAdMobDate(row.dimensionValues?.DATE?.value);
    const dim = row.dimensionValues?.[dimension];
    const key = dim?.value;
    if (!date || !key) continue;

    const revenue = microsToUsd(row.metricValues?.ESTIMATED_EARNINGS?.microsValue);
    const impressions = Number(row.metricValues?.IMPRESSIONS?.integerValue ?? 0) || 0;

    out.push({
      date,
      key,
      label: (dim as { displayLabel?: string }).displayLabel ?? null,
      revenue,
      impressions,
    });
  }
  return out;
}

export interface Aggregate {
  revenue: number;
  impressions: number;
  label: string | null;
}

/**
 * Agrega linhas por chave arbitrária (ex.: `${appId}|${date}`).
 * Mantém o primeiro label não-nulo visto.
 */
export function aggregateBy(rows: ParsedRow[], keyFn: (r: ParsedRow) => string): Map<string, Aggregate> {
  const map = new Map<string, Aggregate>();
  for (const row of rows) {
    const key = keyFn(row);
    const prev = map.get(key) ?? { revenue: 0, impressions: 0, label: null };
    map.set(key, {
      revenue: prev.revenue + row.revenue,
      impressions: prev.impressions + row.impressions,
      label: prev.label ?? row.label,
    });
  }
  return map;
}

export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

export function ecpm(revenue: number, impressions: number): number {
  return impressions > 0 ? round2((revenue / impressions) * 1000) : 0;
}
