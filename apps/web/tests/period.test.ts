import { describe, it, expect } from "vitest";
import { resolvePeriod, comparisonRange, monthOf, monthChunks, isPeriodKey } from "@/lib/period";

describe("resolvePeriod (calendário)", () => {
  it("este mês = dia 1º até hoje", () => {
    expect(resolvePeriod("month", "2026-08-20")).toEqual({ from: "2026-08-01", to: "2026-08-20" });
  });

  it("mês passado = mês inteiro", () => {
    expect(resolvePeriod("last-month", "2026-08-20")).toEqual({ from: "2026-07-01", to: "2026-07-31" });
  });

  it("mês passado atravessa a virada do ano", () => {
    expect(resolvePeriod("last-month", "2026-01-15")).toEqual({ from: "2025-12-01", to: "2025-12-31" });
  });

  it("3 meses = corrente + 2 anteriores desde o dia 1º", () => {
    expect(resolvePeriod("3m", "2026-08-20")).toEqual({ from: "2026-06-01", to: "2026-08-20" });
  });

  it("6 meses", () => {
    expect(resolvePeriod("6m", "2026-08-20")).toEqual({ from: "2026-03-01", to: "2026-08-20" });
  });

  it("tudo não tem limite inferior", () => {
    expect(resolvePeriod("all", "2026-08-20")).toEqual({ from: null, to: "2026-08-20" });
  });
});

describe("comparisonRange", () => {
  it("este mês parcial compara com mês passado até o MESMO dia", () => {
    expect(comparisonRange("month", "2026-08-20")).toEqual({ from: "2026-07-01", to: "2026-07-20" });
  });

  it("dia 31 compara com o último dia do mês anterior mais curto (cap)", () => {
    expect(comparisonRange("month", "2026-07-31")).toEqual({ from: "2026-06-01", to: "2026-06-30" });
  });

  it("mês passado compara com o retrasado inteiro", () => {
    expect(comparisonRange("last-month", "2026-08-20")).toEqual({ from: "2026-06-01", to: "2026-06-30" });
  });

  it("3m compara com o bloco de 3 meses anterior", () => {
    expect(comparisonRange("3m", "2026-08-20")).toEqual({ from: "2026-03-01", to: "2026-05-31" });
  });

  it("tudo → sem comparação", () => {
    expect(comparisonRange("all", "2026-08-20")).toBeNull();
  });
});

describe("monthOf", () => {
  it("normaliza pro primeiro dia", () => {
    expect(monthOf("2026-08-20")).toBe("2026-08-01");
  });
});

describe("monthChunks", () => {
  it("quebra em lotes mensais respeitando o fim", () => {
    expect(monthChunks("2026-06-15", "2026-08-10")).toEqual([
      { from: "2026-06-15", to: "2026-06-30" },
      { from: "2026-07-01", to: "2026-07-31" },
      { from: "2026-08-01", to: "2026-08-10" },
    ]);
  });

  it("intervalo dentro do mesmo mês = 1 chunk", () => {
    expect(monthChunks("2026-08-01", "2026-08-10")).toEqual([{ from: "2026-08-01", to: "2026-08-10" }]);
  });
});

describe("isPeriodKey", () => {
  it("aceita chaves válidas e rejeita lixo", () => {
    expect(isPeriodKey("month")).toBe(true);
    expect(isPeriodKey("all")).toBe(true);
    expect(isPeriodKey("30d")).toBe(false);
    expect(isPeriodKey(undefined)).toBe(false);
  });
});
