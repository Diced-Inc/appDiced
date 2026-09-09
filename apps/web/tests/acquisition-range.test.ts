import { describe, expect, it } from "vitest";
import { acquisitionSyncRange } from "@/lib/sync/acquisition-range";
import { campaignPeriod } from "@/lib/campaign-period";
describe("monthly spend retention window", () => {
  it("covers the entire month even with a short requested lookback", () => {
    expect(acquisitionSyncRange("2026-09-30", 1)).toEqual({ from: "2026-09-01", to: "2026-09-30" });
  });
  it("retains previous-month corrections at the month boundary", () => {
    expect(acquisitionSyncRange("2026-01-03")).toEqual({ from: "2025-12-21", to: "2026-01-03" });
  });
  it("preserves the daily ninety-day reconciliation", () => {
    expect(acquisitionSyncRange("2026-09-30", 90)).toEqual({ from: "2026-07-03", to: "2026-09-30" });
  });
  it("defaults display to the full current month without removing the week filter", () => {
    expect(campaignPeriod({}, "2026-09-30").range.from).toBe("2026-09-01");
    expect(campaignPeriod({ period: "7d" }, "2026-09-30").range.from).toBe("2026-09-24");
  });
});
