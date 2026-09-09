import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ db: vi.fn(), meta: vi.fn(), ga4: vi.fn(), upsert: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseAdmin: mocks.db }));
vi.mock("@/lib/meta/ads", () => ({ fetchMetaDailyInsights: mocks.meta }));
vi.mock("@/lib/google/analytics", () => ({ fetchGA4AcquisitionBreakdown: mocks.ga4 }));
vi.mock("@/lib/sync/persist", () => ({ chunkedUpsert: mocks.upsert }));
vi.mock("@/lib/campaign-history", () => ({ recordCampaignObservation: vi.fn() }));
vi.mock("@/lib/date", () => ({ toBrazilDateStr: () => "2026-09-30" }));
import { syncAcquisition } from "@/lib/sync/acquisition";
describe("spend is independent from attribution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const data = [{ id: "i", user_id: "owner", app_id: "app", meta_campaign_id: "123", currency: "BRL", utm_campaign: "campaign" }];
    const chain = { select: vi.fn(), eq: vi.fn(), update: vi.fn(), then: (resolve: (value: unknown) => void) => resolve({ data, error: null }) };
    chain.select.mockReturnValue(chain); chain.eq.mockReturnValue(chain); chain.update.mockReturnValue(chain);
    mocks.db.mockReturnValue({ from: () => chain });
    mocks.meta.mockResolvedValue([{ date: "2026-09-30", spend: 6, impressions: 100, reach: 90, clicks: 10, installs: 2 }]);
    mocks.upsert.mockResolvedValue(undefined);
  });
  it("persists reported Meta spend even if GA4 fails, without overwriting revenue", async () => {
    mocks.ga4.mockRejectedValue(new Error("GA4 unavailable"));
    const result = await syncAcquisition("owner");
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    const [, table, rows, conflict] = mocks.upsert.mock.calls[0]!;
    expect(table).toBe("marketing_daily_metrics"); expect(conflict).toBe("integration_id,date");
    expect(rows[0]).toMatchObject({ date: "2026-09-30", spend: 6, user_id: "owner" });
    expect(rows[0]).not.toHaveProperty("attributed_total_revenue");
    expect("errors" in result && result.errors).toContain("campaign: GA4 unavailable");
  });

  it("only writes spend for days Meta actually reported", async () => {
    // A API de insights não devolve linha para dia sem entrega. Escrever 0 na janela
    // inteira apagaria o gasto historico numa recoleta longa — e ele alimenta o Banco.
    mocks.ga4.mockRejectedValue(new Error("GA4 unavailable"));
    await syncAcquisition("owner");
    const rows = mocks.upsert.mock.calls[0]![2] as Record<string, unknown>[];
    expect(rows).toHaveLength(1);
    expect(rows.every(r => r.date === "2026-09-30")).toBe(true);
  });

  it("keeps Meta columns out of the revenue upsert", async () => {
    // Se um dia tem GA4 e nao tem Meta, repetir as colunas da Meta aqui zeraria o gasto.
    mocks.ga4.mockResolvedValue({
      utm: [{ date: "2026-09-15", installs: 1, adRevenue: 2, purchaseRevenue: 0, totalRevenue: 2, adImpressions: 4 }],
      facebookReferral: [], thresholded: false,
    });
    await syncAcquisition("owner");
    const revenueRows = mocks.upsert.mock.calls[1]![2] as Record<string, unknown>[];
    expect(revenueRows[0]).toMatchObject({ date: "2026-09-15", attributed_total_revenue: 2 });
    expect(revenueRows[0]).not.toHaveProperty("spend");
    expect(revenueRows[0]).not.toHaveProperty("meta_impressions");
  });
  it("does not replace recorded spend with zero when Meta fails", async () => {
    mocks.meta.mockRejectedValue(new Error("Meta unavailable"));
    await syncAcquisition("owner");
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("only writes revenue for days GA4 actually reported", async () => {
    // GA4 respondeu 200 mas só tem linha para um dia do mês: latência de processamento
    // ou omissão por limite de privacidade. Os outros 29 dias não podem virar zero.
    mocks.ga4.mockResolvedValue({
      utm: [{ date: "2026-09-30", installs: 1, adRevenue: 5, purchaseRevenue: 0, totalRevenue: 5, adImpressions: 10 }],
      facebookReferral: [],
      thresholded: false,
    });
    await syncAcquisition("owner");

    const revenueRows = mocks.upsert.mock.calls[1]![2] as Record<string, unknown>[];
    expect(revenueRows).toHaveLength(1);
    expect(revenueRows[0]).toMatchObject({ date: "2026-09-30", attributed_total_revenue: 5 });
  });

  it("flags days the GA4 privacy threshold hid, without touching revenue columns", async () => {
    mocks.ga4.mockResolvedValue({
      utm: [{ date: "2026-09-30", installs: 1, adRevenue: 5, purchaseRevenue: 0, totalRevenue: 5, adImpressions: 10 }],
      facebookReferral: [],
      thresholded: true,
    });
    await syncAcquisition("owner");

    const flagRows = mocks.upsert.mock.calls[2]![2] as Record<string, unknown>[];
    expect(flagRows).toHaveLength(30);
    // o dia reportado não é marcado; os omitidos sim
    expect(flagRows.find(r => r.date === "2026-09-30")).toMatchObject({ ga4_thresholded: false });
    expect(flagRows.find(r => r.date === "2026-09-01")).toMatchObject({ ga4_thresholded: true });
    expect(flagRows[0]).not.toHaveProperty("attributed_total_revenue");
  });
});
