import { describe, it, expect } from "vitest";
import { computeAppMetrics, computeDailyTotals, type AppMeta, type LedgerRow } from "@/lib/data";

const apps: AppMeta[] = [
  { id: "a1", name: "App 1", packageName: "com.a1", icon: "x", status: "published", rating: 4.5, downloads: 100 },
  { id: "a2", name: "App 2", packageName: "com.a2", icon: "x", status: "published", rating: 0, downloads: 50 },
];

const ledger: LedgerRow[] = [
  { appId: "a1", date: "2026-08-18", revenue: 2, impressions: 1000 },
  { appId: "a1", date: "2026-08-19", revenue: 3, impressions: 2000 },
  { appId: "a2", date: "2026-08-19", revenue: 1.5, impressions: 500 },
];

describe("computeAppMetrics", () => {
  it("agrega receita/impressões/eCPM por app a partir do razão", () => {
    const result = computeAppMetrics(apps, ledger);
    const a1 = result.find((a) => a.id === "a1")!;
    expect(a1.revenue).toBe(5);
    expect(a1.impressions).toBe(3000);
    expect(a1.ecpm).toBeCloseTo(1.67, 2);
  });

  it("app sem linhas no período fica zerado (não herda lixo)", () => {
    const result = computeAppMetrics(apps, []);
    expect(result.every((a) => a.revenue === 0 && a.impressions === 0 && a.ecpm === 0)).toBe(true);
  });
});

describe("computeDailyTotals", () => {
  it("soma todos os apps por dia, ordenado", () => {
    expect(computeDailyTotals(ledger)).toEqual([
      { date: "2026-08-18", revenue: 2 },
      { date: "2026-08-19", revenue: 4.5 },
    ]);
  });
});
