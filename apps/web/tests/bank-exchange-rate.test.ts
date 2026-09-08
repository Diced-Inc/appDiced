import { afterEach, describe, expect, it, vi } from "vitest";
import { bankExchangeRate } from "@/lib/bank-exchange-rate";

afterEach(() => vi.unstubAllGlobals());
const response = (date: string, value = 5.17) => ({ ok: true, json: async () => ({ amount: 1, base: "USD", date, rates: { BRL: value } }) });
describe("cotação mensal automática", () => {
  it("preserva ajuste manual sem consultar terceiros", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    expect((await bankExchangeRate("2026-08", "2026-09-08", 5.2)).rateSource).toBe("manual");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("consulta fechamento histórico e aceita o dia útil anterior", async () => {
    const fetcher = vi.fn().mockResolvedValue(response("2026-05-29")); vi.stubGlobal("fetch", fetcher);
    const result = await bankExchangeRate("2026-05", "2026-09-08", null);
    expect(fetcher.mock.calls[0]![0]).toContain("/2026-05-31?");
    expect(result).toMatchObject({ usdBrl: 5.17, rateDate: "2026-05-29", rateSource: "frankfurter" });
  });
  it("usa data de hoje somente no mês atual", async () => {
    const fetcher = vi.fn().mockResolvedValue(response("2026-09-04")); vi.stubGlobal("fetch", fetcher);
    expect((await bankExchangeRate("2026-09", "2026-09-08", null)).usdBrl).toBe(5.17);
    expect(fetcher.mock.calls[0]![0]).toContain("/2026-09-08?");
  });
  it.each([response("2026-09-09"), response("2026-08-01"), response("2026-09-08", -1), { ok: false }])("não calcula saldo com cotação inválida ou indisponível", async result => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(result));
    expect(await bankExchangeRate("2026-09", "2026-09-08", null)).toMatchObject({ usdBrl: null, rateSource: null, rateError: expect.any(String) });
  });
  it("falha de rede mantém opção manual", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    expect((await bankExchangeRate("2026-09", "2026-09-08", null)).usdBrl).toBeNull();
  });
});
