import { describe, it, expect } from "vitest";
import {
  extractRows,
  microsToUsd,
  formatAdMobDate,
  parseReport,
  aggregateBy,
  ecpm,
} from "@/lib/sync/parse";

const sampleReport = [
  { header: { dateRange: {} } },
  {
    row: {
      dimensionValues: { DATE: { value: "20260815" }, APP: { value: "ca-app-pub-1~11" } },
      metricValues: {
        ESTIMATED_EARNINGS: { microsValue: "1234567" },
        IMPRESSIONS: { integerValue: "1000" },
      },
    },
  },
  {
    row: {
      dimensionValues: { DATE: { value: "20260815" }, APP: { value: "ca-app-pub-1~22" } },
      metricValues: {
        ESTIMATED_EARNINGS: { microsValue: "500000" },
        IMPRESSIONS: { integerValue: "200" },
      },
    },
  },
  { footer: { matchingRowCount: "2" } },
];

describe("extractRows", () => {
  it("pega só as rows, ignora header/footer", () => {
    expect(extractRows(sampleReport)).toHaveLength(2);
  });

  it("resposta não-array (erro da API) → vazio", () => {
    expect(extractRows({ error: "x" })).toEqual([]);
    expect(extractRows(null)).toEqual([]);
  });
});

describe("microsToUsd", () => {
  it("converte micros", () => {
    expect(microsToUsd("1234567")).toBeCloseTo(1.234567);
  });
  it("undefined/lixo → 0", () => {
    expect(microsToUsd(undefined)).toBe(0);
    expect(microsToUsd("abc")).toBe(0);
  });
});

describe("formatAdMobDate", () => {
  it("YYYYMMDD → YYYY-MM-DD", () => {
    expect(formatAdMobDate("20260815")).toBe("2026-08-15");
  });
  it("malformado → null", () => {
    expect(formatAdMobDate("2026-08")).toBeNull();
    expect(formatAdMobDate(undefined)).toBeNull();
  });
});

describe("parseReport", () => {
  it("normaliza linhas com data e dimensão", () => {
    const rows = parseReport(sampleReport, "APP");
    expect(rows).toEqual([
      { date: "2026-08-15", key: "ca-app-pub-1~11", label: null, revenue: 1.234567, impressions: 1000 },
      { date: "2026-08-15", key: "ca-app-pub-1~22", label: null, revenue: 0.5, impressions: 200 },
    ]);
  });

  it("descarta linhas sem data ou sem dimensão", () => {
    const broken = [
      { row: { dimensionValues: { APP: { value: "x" } }, metricValues: {} } },
      { row: { dimensionValues: { DATE: { value: "20260815" } }, metricValues: {} } },
    ];
    expect(parseReport(broken, "APP")).toEqual([]);
  });

  it("carrega displayLabel de AD_UNIT", () => {
    const report = [
      {
        row: {
          dimensionValues: {
            DATE: { value: "20260815" },
            AD_UNIT: { value: "ca-app-pub-1/999", displayLabel: "Banner Home" },
          },
          metricValues: { ESTIMATED_EARNINGS: { microsValue: "100000" } },
        },
      },
    ];
    expect(parseReport(report, "AD_UNIT")[0]!.label).toBe("Banner Home");
  });
});

describe("aggregateBy", () => {
  it("soma por chave e mantém primeiro label", () => {
    const rows = [
      { date: "2026-08-15", key: "a", label: "A1", revenue: 1, impressions: 10 },
      { date: "2026-08-15", key: "a", label: "A2", revenue: 2, impressions: 20 },
      { date: "2026-08-16", key: "a", label: null, revenue: 4, impressions: 40 },
    ];
    const agg = aggregateBy(rows, (r) => `${r.key}|${r.date}`);
    expect(agg.get("a|2026-08-15")).toEqual({ revenue: 3, impressions: 30, label: "A1" });
    expect(agg.get("a|2026-08-16")).toEqual({ revenue: 4, impressions: 40, label: null });
  });
});

describe("ecpm", () => {
  it("receita/impressões × 1000", () => {
    expect(ecpm(2, 1000)).toBe(2);
    expect(ecpm(1.5, 500)).toBe(3);
  });
  it("sem impressões → 0", () => {
    expect(ecpm(5, 0)).toBe(0);
  });
});

describe("sumEarnings / decimalValue (mediationReport)", () => {
  it("soma linhas DATE-only e aceita decimalValue além de microsValue", async () => {
    const { sumEarnings } = await import("@/lib/sync/parse");
    const report = [
      { header: {} },
      { row: { dimensionValues: { DATE: { value: "20260825" } }, metricValues: { ESTIMATED_EARNINGS: { microsValue: "1500000" } } } },
      { row: { dimensionValues: { DATE: { value: "20260826" } }, metricValues: { ESTIMATED_EARNINGS: { decimalValue: "2500000" } } } },
      { footer: {} },
    ];
    expect(sumEarnings(report)).toBeCloseTo(4);
  });

  it("parseReport também lê decimalValue", () => {
    const report = [
      { row: { dimensionValues: { DATE: { value: "20260826" }, APP: { value: "x" } }, metricValues: { ESTIMATED_EARNINGS: { decimalValue: "750000" } } } },
    ];
    expect(parseReport(report, "APP")[0]!.revenue).toBeCloseTo(0.75);
  });
});
