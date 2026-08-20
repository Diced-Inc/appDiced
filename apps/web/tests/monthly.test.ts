import { describe, it, expect } from "vitest";
import {
  computeMonthStatus,
  estimatePaymentDate,
  groupByMonth,
  projectMonthEnd,
} from "@/lib/sync/monthly";

describe("computeMonthStatus", () => {
  it("mês corrente = open", () => {
    expect(computeMonthStatus("2026-08-01", "2026-08-20")).toBe("open");
  });
  it("mês anterior = closed", () => {
    expect(computeMonthStatus("2026-07-01", "2026-08-20")).toBe("closed");
  });
  it("primeiro dia do mês novo já fecha o anterior", () => {
    expect(computeMonthStatus("2026-07-01", "2026-08-01")).toBe("closed");
  });
});

describe("estimatePaymentDate", () => {
  it("~dia 21 do mês seguinte", () => {
    expect(estimatePaymentDate("2026-08-01")).toBe("2026-09-21");
  });
  it("dezembro → janeiro do ano seguinte", () => {
    expect(estimatePaymentDate("2026-12-01")).toBe("2027-01-21");
  });
});

describe("groupByMonth", () => {
  it("soma receitas diárias por mês", () => {
    const map = groupByMonth([
      { date: "2026-07-30", revenue: 1 },
      { date: "2026-07-31", revenue: 2 },
      { date: "2026-08-01", revenue: 4 },
    ]);
    expect(map.get("2026-07-01")).toBe(3);
    expect(map.get("2026-08-01")).toBe(4);
  });
});

describe("projectMonthEnd", () => {
  it("extrapola o ritmo do mês", () => {
    // $100 em 10 dias de agosto (31 dias) → $310
    expect(projectMonthEnd(100, "2026-08-10")).toBe(310);
  });
  it("último dia = valor corrente", () => {
    expect(projectMonthEnd(100, "2026-08-31")).toBe(100);
  });
});
