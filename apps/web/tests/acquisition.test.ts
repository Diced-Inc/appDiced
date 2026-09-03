import { describe, expect, it } from "vitest";
import { computeAcquisitionSummary, type AcquisitionDailyMetric } from "@/lib/acquisition";
import { parseGA4AcquisitionReport } from "@/lib/google/analytics";
import { parseMetaInstallActions } from "@/lib/meta/ads";

const base: AcquisitionDailyMetric = {
  integrationId: "i1",
  appId: "a1",
  date: "2026-09-01",
  currency: "BRL",
  spend: 10,
  adRevenue: 3,
  purchaseRevenue: 2,
  totalRevenue: 5,
  metaImpressions: 1000,
  metaReach: 800,
  metaClicks: 50,
  metaInstalls: 12,
  ga4Installs: 10,
  publisherAdImpressions: 500,
};

describe("computeAcquisitionSummary", () => {
  it("calcula lucro, ROAS, CPI e CTR sem misturar unidades", () => {
    const summary = computeAcquisitionSummary([base, { ...base, date: "2026-09-02" }]);
    expect(summary.spend).toBe(20);
    expect(summary.revenue).toBe(10);
    expect(summary.profit).toBe(-10);
    expect(summary.roas).toBe(0.5);
    expect(summary.costPerInstall).toBe(1);
    expect(summary.ctr).toBe(5);
  });

  it("não inventa ROAS/CPI quando o denominador é zero", () => {
    const summary = computeAcquisitionSummary([{ ...base, spend: 0, ga4Installs: 0 }]);
    expect(summary.roas).toBeNull();
    expect(summary.costPerInstall).toBeNull();
  });
});

describe("parseGA4AcquisitionReport", () => {
  it("usa os headers em vez de depender da posição fixa", () => {
    const rows = parseGA4AcquisitionReport({
      dimensionHeaders: [{ name: "firstUserSource" }, { name: "date" }],
      metricHeaders: [
        { name: "totalRevenue" },
        { name: "newUsers" },
        { name: "totalAdRevenue" },
        { name: "purchaseRevenue" },
        { name: "publisherAdImpressions" },
      ],
      rows: [{
        dimensionValues: [{ value: "meta" }, { value: "20260901" }],
        metricValues: [{ value: "8.75" }, { value: "4" }, { value: "6.5" }, { value: "2.25" }, { value: "900" }],
      }],
    });
    expect(rows).toEqual([{ date: "2026-09-01", installs: 4, adRevenue: 6.5, purchaseRevenue: 2.25, totalRevenue: 8.75, adImpressions: 900 }]);
  });
});

describe("parseMetaInstallActions", () => {
  it("prefere mobile_app_install sem somar aliases duplicados", () => {
    expect(parseMetaInstallActions([
      { action_type: "omni_app_install", value: "12" },
      { action_type: "mobile_app_install", value: "10" },
    ])).toBe(10);
  });
});
