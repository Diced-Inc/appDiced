import { describe, expect, it } from "vitest";
import { cohortWindows, validCohortDate } from "@/lib/campaign-cohorts";
import { decisionText, exclusiveUtm } from "@/lib/campaign-detail-validation";
import { expenseInput, monthlyBalance, type Expense } from "@/lib/bank-expenses";

describe("retorno por data de primeiro acesso", () => {
  const rows = [
    { date: "2026-09-01", users: 10, revenue: 1, adRevenue: 1 },
    { date: "2026-09-02", users: 0, revenue: 2, adRevenue: 2 },
    { date: "2026-09-08", users: 0, revenue: 4, adRevenue: 4 },
    { date: "2026-10-01", users: 0, revenue: 8, adRevenue: 8 },
  ];
  it("acumula D0–Dn sem misturar novos usuários de outros dias", () => {
    const windows = cohortWindows("2026-09-01", "2026-10-03", 6, rows);
    expect(windows.map(w => w.revenue)).toEqual([3, 7, 15]);
    expect(windows.map(w => w.users)).toEqual([10, 10, 10]);
    expect(windows[2]!.roas).toBe(2.5);
    expect(windows[2]!.perUser).toBe(1.5);
  });
  it("mantém janela incompleta e não inventa retorno sem coorte identificada", () => {
    expect(cohortWindows("2026-09-01", "2026-09-08", 6, rows).map(w => w.complete)).toEqual([true, false, false]);
    expect(cohortWindows("2026-09-01", "2026-10-03", 6, []).every(w => w.revenue === null && w.roas === null)).toBe(true);
    expect(validCohortDate("2026-02-30", "2026-09-08")).toBe(false);
    expect(validCohortDate("2026-09-09", "2026-09-08")).toBe(false);
  });
});

describe("decisões e UTM exclusiva", () => {
  it("valida tamanho e remove espaços vazios", () => { expect(decisionText("   ")).toBeNull(); expect(decisionText("a".repeat(2001))).toBeNull(); expect(decisionText(" manter ")).toBe("manter"); });
  it("bloqueia retorno com UTMs iguais no mesmo fluxo", () => {
    const i = { id: "a", ga4_property_id: "p", ga4_stream_id: "s", utm_source: "meta", utm_medium: "paid_social", utm_campaign: "voice" };
    expect(exclusiveUtm(i, [i, { ...i, id: "b", utm_campaign: "VOICE" }])).toBe(false);
    expect(exclusiveUtm(i, [i, { ...i, id: "b", ga4_stream_id: "other" }])).toBe(true);
  });
});

describe("controle de gastos", () => {
  const expense = { id: "e", occurred_on: "2026-09-01", amount: 10, currency: "USD", category: "software", description: "Ferramenta", voided_at: null } as Expense;
  it("não soma moedas sem cotação", () => {
    const result = monthlyBalance(100, [{ campaign: "Voz", currency: "BRL", spend: 30 }], [expense], null);
    expect(result.netBrl).toBeNull(); expect(result.totals).toEqual({ BRL: 30, USD: 10 });
  });
  it("abate mídia e outras despesas uma vez e ignora lançamentos cancelados", () => {
    const result = monthlyBalance(100, [{ campaign: "Voz", currency: "BRL", spend: 30 }], [expense, { ...expense, id: "c", voided_at: "2026-09-02" }], 5);
    expect(result.expensesBrl).toBe(80); expect(result.netBrl).toBe(420);
  });
  it("bloqueia totais com moeda não convertível e entradas inválidas", () => {
    expect(monthlyBalance(100, [{ campaign: "X", currency: "EUR", spend: 10 }], [], 5).netBrl).toBeNull();
    expect(expenseInput({ amount: Infinity })).toBeNull();
    expect(expenseInput({ amount: 10, date: "2026-02-30", description: "Teste", currency: "BRL", category: "other" })).toBeNull();
  });
});
