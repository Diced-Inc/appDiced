import { describe, it, expect } from "vitest";
import { isAnomalousDrop } from "@/lib/notifications/rules";

describe("isAnomalousDrop", () => {
  it("dispara quando ontem < 50% da média", () => {
    expect(isAnomalousDrop(2, 10)).toBe(true);
  });
  it("não dispara em queda leve", () => {
    expect(isAnomalousDrop(6, 10)).toBe(false);
  });
  it("piso de $1 na média evita ruído de contas pequenas", () => {
    expect(isAnomalousDrop(0.1, 0.9)).toBe(false);
  });
  it("exatamente 50% não dispara", () => {
    expect(isAnomalousDrop(5, 10)).toBe(false);
  });
});
