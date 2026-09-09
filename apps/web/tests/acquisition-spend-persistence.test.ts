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
  it("persists a whole month of Meta spend even if GA4 fails, without overwriting revenue", async () => {
    mocks.ga4.mockRejectedValue(new Error("GA4 unavailable"));
    const result = await syncAcquisition("owner");
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    const [, table, rows, conflict] = mocks.upsert.mock.calls[0]!;
    expect(table).toBe("marketing_daily_metrics"); expect(conflict).toBe("integration_id,date");
    expect(rows).toHaveLength(30);
    expect(rows[29]).toMatchObject({ date: "2026-09-30", spend: 6, user_id: "owner" });
    expect(rows[29]).not.toHaveProperty("attributed_total_revenue");
    expect("errors" in result && result.errors).toContain("campaign: GA4 unavailable");
  });
  it("does not replace recorded spend with zero when Meta fails", async () => {
    mocks.meta.mockRejectedValue(new Error("Meta unavailable"));
    await syncAcquisition("owner");
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
