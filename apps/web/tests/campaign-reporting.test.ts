import { describe, it, expect } from "vitest";
import { campaignAttribution, campaignResult } from "@/lib/campaign-reporting";
import { campaignPeriod } from "@/lib/campaign-period";
import type { MarketingIntegration, AcquisitionDailyMetric } from "@/lib/acquisition";

const integration = (id: string, campaign = id, stream = "s1") => ({ id, ga4PropertyId: "p1", ga4StreamId: stream, utmSource: "meta", utmMedium: "paid_social", utmCampaign: campaign }) as MarketingIntegration;
const metric = (id: string) => ({ integrationId: id, spend: 6, totalRevenue: 12, adRevenue: 12, purchaseRevenue: 0, ga4Installs: 10, utmAdRevenue: 2, utmPurchaseRevenue: 0, utmTotalRevenue: 2, utmInstalls: 3, facebookReferralTotalRevenue: 10, facebookReferralAdRevenue: 10, facebookReferralPurchaseRevenue: 0, facebookReferralInstalls: 7 }) as AcquisitionDailyMetric;

describe("campaign attribution", () => {
  it("excludes stream-wide Facebook revenue from both campaigns without losing spend", () => {
    const result = campaignAttribution([metric("a"), metric("b")], [integration("a"), integration("b")]);
    expect(result.rows.map(r => r.totalRevenue)).toEqual([2, 2]);
    expect(result.rows.map(r => r.ga4Installs)).toEqual([3, 3]);
    expect(result.rows.map(r => r.spend)).toEqual([6, 6]);
    expect(result.ambiguousIds).toEqual(["a", "b"]);
  });
  it("excludes case-insensitive duplicate UTMs and flags them as unavailable", () => {
    const result = campaignAttribution([metric("a"), metric("b")], [integration("a", "TEST"), integration("b", "test")]);
    expect(result.duplicateUtmIds).toEqual(["a", "b"]);
    expect(result.rows.map(r => r.totalRevenue)).toEqual([0, 0]);
  });
  it("does not merge different streams and does not mutate source rows", () => {
    const rows = [metric("a"), metric("b")];
    expect(campaignAttribution(rows, [integration("a"), integration("b", "b", "s2")]).rows).toEqual(rows);
    campaignAttribution(rows, [integration("a"), integration("b")]);
    expect(rows[0]!.totalRevenue).toBe(12);
  });
  it("never reports an empty or failed period as profitable", () => {
    expect(campaignResult(0, 0)).toBe("Aguardando dados");
    expect(campaignResult(6, 6)).toBe("No ponto de equilíbrio");
    expect(campaignResult(6, 9, true)).toBe("Dados indisponíveis");
  });
});

describe("campaign dates", () => {
  it("handles rolling windows across months and years inclusively", () => {
    expect(campaignPeriod({ period: "7d" }, "2026-01-03").range).toEqual({ from: "2025-12-28", to: "2026-01-03" });
    expect(campaignPeriod({ period: "yesterday" }, "2026-01-01").range.from).toBe("2025-12-31");
  });
  it("rejects impossible, reversed and future dates", () => {
    for (const [from, to] of [["2026-02-30", "2026-03-01"], ["2026-09-02", "2026-09-01"], ["2026-09-01", "2026-09-09"]]) {
      expect(campaignPeriod({ period: "custom", from, to }, "2026-09-08").error).toBeTruthy();
    }
    expect(campaignPeriod({ period: "custom", from: "2026-09-01", to: "2026-09-08" }, "2026-09-08").error).toBeUndefined();
  });
});
