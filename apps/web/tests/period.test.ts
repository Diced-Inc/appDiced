import { describe, it, expect } from "vitest";
import { resolvePeriod, previousRange, monthOf, monthChunks, isPeriodKey } from "@/lib/period";

describe("resolvePeriod", () => {
  it("30d inclui o dia de hoje (30 dias no total)", () => {
    expect(resolvePeriod("30d", "2026-08-20")).toEqual({ from: "2026-07-22", to: "2026-08-20" });
  });

  it("7d", () => {
    expect(resolvePeriod("7d", "2026-08-20")).toEqual({ from: "2026-08-14", to: "2026-08-20" });
  });

  it("all não tem limite inferior", () => {
    expect(resolvePeriod("all", "2026-08-20")).toEqual({ from: null, to: "2026-08-20" });
  });

  it("atravessa virada de mês e ano", () => {
    expect(resolvePeriod("30d", "2026-01-05")).toEqual({ from: "2025-12-07", to: "2026-01-05" });
  });
});

describe("previousRange", () => {
  it("janela anterior de mesmo tamanho, encostada", () => {
    expect(previousRange({ from: "2026-08-14", to: "2026-08-20" })).toEqual({
      from: "2026-08-07",
      to: "2026-08-13",
    });
  });

  it("null pra período aberto", () => {
    expect(previousRange({ from: null, to: "2026-08-20" })).toBeNull();
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
    expect(isPeriodKey("7d")).toBe(true);
    expect(isPeriodKey("all")).toBe(true);
    expect(isPeriodKey("14d")).toBe(false);
    expect(isPeriodKey(undefined)).toBe(false);
  });
});
